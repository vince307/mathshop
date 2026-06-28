import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as createPOST } from "@/pages/api/profiles/create";
import { POST as signinPOST } from "@/pages/api/auth/signin";
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
    expect(bRows?.[0]?.starting_level).toBe(2); // age 9 → band 2
  });

  it("rejects invalid input and writes nothing", async () => {
    const jar = await mintSession(accountC.email);
    const res = await createPOST(createContext(jar, { name: "", age: "99", avatar: "nieznany", theme: "nope" }));
    expect(res.headers.get("Location")).toMatch(/^\/app\/new-profile\?error=/);

    const { data } = await admin.from("child_profiles").select("id").eq("account_id", accountC.id);
    expect(data).toHaveLength(0);
  });
});
