import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as createPOST } from "@/pages/api/profiles/create";
import { POST as signinPOST } from "@/pages/api/auth/signin";
import { ACTIVE_PROFILE_COOKIE } from "@/lib/services/active-profile";
import { MAX_PROFILES_PER_ACCOUNT } from "@/lib/services/child-profiles";
import { admin, createSignedInUser, deleteUser, PASSWORD, type TestAccount } from "./helpers/supabase";
import { buildContext, type CookieJar, createCookieJar } from "./helpers/astro";

/**
 * Route-level isolation for POST /api/profiles/create (S-01b). Proves the route
 * writes only `auth.uid()`-owned rows and never trusts a client-supplied
 * `account_id` (lessons L-001/L-002). Durable state is verified via the
 * service-role `admin` client (bypasses RLS) — not a read-back through the same
 * RLS-scoped session. Drives the REAL route + REAL signin route against a REAL
 * local Supabase session. Requires the local stack + `.env.test`.
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

function createContext(jar: CookieJar, formData: Record<string, string>) {
  return buildContext({ url: "https://test.local/api/profiles/create", method: "POST", formData, cookies: jar });
}

describe("POST /api/profiles/create (route-level isolation)", () => {
  let accountA: TestAccount;
  let accountB: TestAccount;
  let accountC: TestAccount;

  beforeAll(async () => {
    accountA = await createSignedInUser("create");
    accountB = await createSignedInUser("create");
    accountC = await createSignedInUser("create");
  });

  afterAll(async () => {
    if (accountA.id) await deleteUser(accountA.id);
    if (accountB.id) await deleteUser(accountB.id);
    if (accountC.id) await deleteUser(accountC.id);
  });

  it("creates a profile owned by the authenticated account and redirects to /app", async () => {
    const jar = await mintSession(accountA.email);
    const res = await createPOST(createContext(jar, { name: "Ola", age: "7", avatar: "kuba", theme: "kawiarnia" }));
    expect(res.headers.get("Location")).toBe("/app");

    // Durable state via service-role client (bypasses RLS).
    const { data } = await admin
      .from("child_profiles")
      .select("name, age, avatar, theme, starting_level, account_id")
      .eq("account_id", accountA.id);
    expect(data).toHaveLength(1);
    expect(data?.[0]).toMatchObject({
      name: "Ola",
      age: 7,
      avatar: "kuba",
      theme: "kawiarnia",
      starting_level: 1, // age 7 → band 1
      account_id: accountA.id,
    });
  });

  it("ignores a client-supplied account_id — the row is owned by the session user, not the spoofed account", async () => {
    const jar = await mintSession(accountB.email);
    const res = await createPOST(
      createContext(jar, {
        name: "Spoof",
        age: "9",
        avatar: "ola",
        theme: "piekarnia",
        account_id: accountA.id, // attempt to write on behalf of A
      }),
    );
    expect(res.headers.get("Location")).toBe("/app");

    // No A-owned "Spoof" row; the row belongs to the session user B.
    const { data: aRows } = await admin
      .from("child_profiles")
      .select("id")
      .eq("account_id", accountA.id)
      .eq("name", "Spoof");
    expect(aRows).toHaveLength(0);

    const { data: bRows } = await admin
      .from("child_profiles")
      .select("name, starting_level")
      .eq("account_id", accountB.id)
      .eq("name", "Spoof");
    expect(bRows).toHaveLength(1);
    expect(bRows?.[0]?.starting_level).toBe(3); // age 9 → band 3 (S-08)
  });

  it("rejects invalid input and writes nothing", async () => {
    const jar = await mintSession(accountC.email);
    const res = await createPOST(createContext(jar, { name: "", age: "99", avatar: "nieznany", theme: "nope" }));
    expect(res.headers.get("Location")).toMatch(/^\/app\/new-profile\?error=/);

    const { data } = await admin.from("child_profiles").select("id").eq("account_id", accountC.id);
    expect(data).toHaveLength(0);
  });
});

/** Seed N profiles directly via the service-role client (provisioning only). */
async function seedProfiles(accountId: string, n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    const { error } = await admin
      .from("child_profiles")
      .insert({ account_id: accountId, name: `Dziecko${i}`, age: 7, avatar: "kuba", theme: "kawiarnia" });
    if (error) throw error;
  }
}

describe("POST /api/profiles/create — second profile + cap (S-11)", () => {
  let accountD: TestAccount;
  let accountE: TestAccount;

  beforeAll(async () => {
    accountD = await createSignedInUser("cap");
    accountE = await createSignedInUser("cap");
  });

  afterAll(async () => {
    if (accountD.id) await deleteUser(accountD.id);
    if (accountE.id) await deleteUser(accountE.id);
  });

  it("creates a second profile and makes it the active selection", async () => {
    await seedProfiles(accountD.id, 1);
    const jar = await mintSession(accountD.email);
    const res = await createPOST(createContext(jar, { name: "Drugie", age: "8", avatar: "zosia", theme: "piekarnia" }));
    expect(res.headers.get("Location")).toBe("/app");

    const { data } = await admin
      .from("child_profiles")
      .select("id, name")
      .eq("account_id", accountD.id)
      .order("created_at", { ascending: true });
    expect(data).toHaveLength(2);
    // The freshly-created child becomes the selection, so the post-create
    // redirect lands on the NEW child's start screen instead of re-picking.
    expect(jar.get(ACTIVE_PROFILE_COOKIE)?.value).toBe(data?.[1]?.id);
  });

  it("refuses a profile past the cap and writes nothing (L-002 durable check)", async () => {
    await seedProfiles(accountE.id, MAX_PROFILES_PER_ACCOUNT);
    const jar = await mintSession(accountE.email);
    const res = await createPOST(createContext(jar, { name: "Nadmiar", age: "7", avatar: "ola", theme: "kawiarnia" }));
    expect(res.headers.get("Location")).toMatch(/^\/app\/new-profile\?error=/);

    const { data } = await admin.from("child_profiles").select("id").eq("account_id", accountE.id);
    expect(data).toHaveLength(MAX_PROFILES_PER_ACCOUNT);
  });
});
