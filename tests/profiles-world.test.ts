import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as worldPOST } from "@/pages/api/profiles/world";
import { POST as signinPOST } from "@/pages/api/auth/signin";
import { admin, createSignedInUser, deleteUser, PASSWORD, type TestAccount } from "./helpers/supabase";
import { buildContext, type CookieJar, createCookieJar } from "./helpers/astro";

/**
 * Route-level isolation for POST /api/profiles/world (F5). Proves the world
 * switch can only ever land on a profile the SESSION account owns — the
 * project's highest-risk correctness requirement (CLAUDE.md, lessons L-001/L-002).
 * Durable state is verified via the service-role `admin` client (bypasses RLS),
 * never through a read-back on the same RLS-scoped session (L-002). Drives the
 * REAL route + REAL signin route against a REAL local Supabase session.
 * Requires the local stack + `.env.test`.
 */

/** Mint a real session by driving the signin route; the jar captures its cookies. */
async function mintSession(email: string): Promise<CookieJar> {
  const jar = createCookieJar();
  const ctx = buildContext({
    url: "https://test.local/api/auth/signin",
    method: "POST",
    formData: { email, password: PASSWORD },
    cookies: jar,
  });
  const res = await signinPOST(ctx);
  expect(res.headers.get("Location")).toBe("/app");
  return jar;
}

function worldContext(jar: CookieJar, formData: Record<string, string>) {
  return buildContext({ url: "https://test.local/api/profiles/world", method: "POST", formData, cookies: jar });
}

/** Seed one profile via the service-role client (provisioning only). */
async function seedProfile(accountId: string, name: string, theme = "kawiarnia"): Promise<string> {
  const { data, error } = await admin
    .from("child_profiles")
    .insert({ account_id: accountId, name, age: 7, avatar: "kuba", theme })
    .select("id")
    .single()
    .overrideTypes<{ id: string }, { merge: false }>();
  if (error) throw error;
  return data.id;
}

/** Read the durable `theme` through the RLS-bypassing admin client (L-002). */
async function readTheme(profileId: string): Promise<string | null> {
  const { data } = await admin
    .from("child_profiles")
    .select("theme")
    .eq("id", profileId)
    .limit(1)
    .overrideTypes<{ theme: string }[], { merge: false }>();
  return data?.[0]?.theme ?? null;
}

describe("POST /api/profiles/world (route-level isolation)", () => {
  let accountA: TestAccount;
  let accountB: TestAccount;
  let profileA: string;
  let profileB: string;

  beforeAll(async () => {
    accountA = await createSignedInUser("world");
    accountB = await createSignedInUser("world");
    profileA = await seedProfile(accountA.id, "Ania");
    profileB = await seedProfile(accountB.id, "Borys");
  });

  afterAll(async () => {
    if (accountA.id) await deleteUser(accountA.id);
    if (accountB.id) await deleteUser(accountB.id);
  });

  it("changes the caller's own profile theme and redirects to /app/start", async () => {
    const jar = await mintSession(accountA.email);
    const res = await worldPOST(worldContext(jar, { profileId: profileA, theme: "piekarnia" }));
    expect(res.headers.get("Location")).toBe("/app/start");

    expect(await readTheme(profileA)).toBe("piekarnia");
  });

  it("rejects a foreign profileId and leaves the other account's row untouched", async () => {
    // THE isolation test: per-account data isolation is the project's highest-risk
    // requirement, and this route is the first to mutate a profile row from a
    // child-reachable surface. Durable state is asserted through `admin` (L-002).
    const before = await readTheme(profileA);
    const jar = await mintSession(accountA.email);
    const res = await worldPOST(worldContext(jar, { profileId: profileB, theme: "galaktyczna-baza" }));

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/app/worlds");
    // No error param — the route must not become an existence oracle.
    expect(res.headers.get("Location")).not.toContain("error");

    // B's row is untouched...
    expect(await readTheme(profileB)).toBe("kawiarnia");
    // ...and the route did NOT silently fall back to the caller's own sole profile.
    expect(await readTheme(profileA)).toBe(before);
  });

  it("does not leak existence — a nonexistent uuid gets the byte-identical redirect", async () => {
    const jar = await mintSession(accountA.email);
    const foreign = await worldPOST(worldContext(jar, { profileId: profileB, theme: "galaktyczna-baza" }));
    const missing = await worldPOST(
      worldContext(jar, { profileId: "00000000-0000-4000-8000-000000000000", theme: "galaktyczna-baza" }),
    );

    expect(missing.status).toBe(foreign.status);
    expect(missing.headers.get("Location")).toBe(foreign.headers.get("Location"));
  });

  it("rejects a theme outside WORLD_SLUGS and writes nothing", async () => {
    const before = await readTheme(profileA);
    const jar = await mintSession(accountA.email);
    const res = await worldPOST(worldContext(jar, { profileId: profileA, theme: "nope" }));

    expect(res.headers.get("Location")).toBe("/app/worlds");
    expect(await readTheme(profileA)).toBe(before);
  });

  it("rejects a malformed profileId and writes nothing", async () => {
    const before = await readTheme(profileA);
    const jar = await mintSession(accountA.email);
    const res = await worldPOST(worldContext(jar, { profileId: "not-a-uuid", theme: "piekarnia" }));

    expect(res.headers.get("Location")).toBe("/app/worlds");
    expect(await readTheme(profileA)).toBe(before);
  });

  it("redirects an unauthenticated caller to /auth/signin and writes nothing", async () => {
    const before = await readTheme(profileA);
    const res = await worldPOST(worldContext(createCookieJar(), { profileId: profileA, theme: "galaktyczna-baza" }));

    expect(res.headers.get("Location")).toBe("/auth/signin");
    expect(await readTheme(profileA)).toBe(before);
  });
});
