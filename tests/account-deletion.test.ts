import { afterAll, describe, expect, it } from "vitest";
import { POST as signinPOST } from "@/pages/api/auth/signin";
import { POST as deleteAccountPOST } from "@/pages/api/account/delete";
import { createChildProfile } from "@/lib/services/child-profiles";
import { setPin, signMarker, PARENT_VERIFIED_COOKIE } from "@/lib/services/parent-pin";
import { admin, createSignedInUser, deleteUser, PASSWORD, type TestAccount } from "./helpers/supabase";
import { buildContext, createCookieJar, type CookieJar } from "./helpers/astro";

/**
 * Account-deletion route contract (MAT-17) — the GDPR-erasure proof. One route
 * call must erase the auth user and EVERY owned row across all three tables
 * (F-01 cascades), and none of the stacked gates (session, marker, fresh PIN,
 * typed e-mail) can be skipped. L-002 discipline: durable state asserted via
 * the service-role `admin` client, never the response alone. Requires the
 * local Supabase stack + `.env.test`.
 */

async function signedInJar(account: TestAccount): Promise<CookieJar> {
  const jar = createCookieJar();
  const context = buildContext({
    url: "https://test.local/api/auth/signin",
    method: "POST",
    formData: { email: account.email, password: PASSWORD },
    cookies: jar,
  });
  const response = await signinPOST(context);
  expect(response.headers.get("Location")).toBe("/app");
  return jar;
}

function armMarker(jar: CookieJar, accountId: string): void {
  jar.set(PARENT_VERIFIED_COOKIE, signMarker(accountId, Date.now() + 60_000));
}

/** Seed a full owned footprint: profile + shift_log row + PIN (account_settings). */
async function seedFootprint(account: TestAccount, pin: string): Promise<string> {
  const { data, error } = await createChildProfile(account.client, {
    accountId: account.id,
    name: "Dziecko",
    age: 7,
    avatar: "kuba",
    theme: "kawiarnia",
    startingLevel: 1,
  });
  if (error) throw error;
  const { error: logError } = await account.client.from("shift_log").insert({
    account_id: account.id,
    profile_id: data.id,
    skills: { counting: { firstTryCorrect: 1, completed: 1, misses: 0 } },
  });
  if (logError) throw logError;
  expect(await setPin(account.client, pin)).toBe(true);
  return data.id;
}

async function ownedRowCount(table: string, accountId: string): Promise<number> {
  const { count } = await admin.from(table).select("*", { count: "exact", head: true }).eq("account_id", accountId);
  return count ?? 0;
}

async function authUserExists(id: string): Promise<boolean> {
  const { data, error } = await admin.auth.admin.getUserById(id);
  if (error) return false;
  return Boolean(data.user);
}

function deleteContext(jar: CookieJar, fields: Record<string, string>) {
  return buildContext({
    url: "https://test.local/api/account/delete",
    method: "POST",
    formData: fields,
    cookies: jar,
  });
}

describe("account deletion route (MAT-17)", () => {
  // Torn down defensively in afterAll; the happy path deletes its own account.
  const cleanup: string[] = [];

  afterAll(async () => {
    for (const id of cleanup) await deleteUser(id);
  });

  it("erases the auth user and every owned row across all three tables", async () => {
    const a = await createSignedInUser("accdel-happy");
    cleanup.push(a.id);
    await seedFootprint(a, "1234");
    const jar = await signedInJar(a);
    armMarker(jar, a.id);

    const response = await deleteAccountPOST(deleteContext(jar, { pin: "1234", email: a.email }));

    expect(response.status).toBe(200);
    // L-002: the durable proof — auth user gone, zero rows in every owned table.
    expect(await authUserExists(a.id)).toBe(false);
    expect(await ownedRowCount("child_profiles", a.id)).toBe(0);
    expect(await ownedRowCount("shift_log", a.id)).toBe(0);
    expect(await ownedRowCount("account_settings", a.id)).toBe(0);
    // Session cookies cleared in the response jar (sb-* set empty / deleted).
    const liveAuthCookies = jar.getAll().filter((c) => c.name.startsWith("sb-") && c.value !== "");
    expect(liveAuthCookies).toHaveLength(0);
  });

  it("wrong PIN refuses (401), counts toward the throttle, and nothing is deleted", async () => {
    const a = await createSignedInUser("accdel-wrongpin");
    cleanup.push(a.id);
    await seedFootprint(a, "1234");
    const jar = await signedInJar(a);
    armMarker(jar, a.id);

    const response = await deleteAccountPOST(deleteContext(jar, { pin: "9999", email: a.email }));

    expect(response.status).toBe(401);
    expect(await authUserExists(a.id)).toBe(true);
    expect(await ownedRowCount("child_profiles", a.id)).toBe(1);
    // Throttle is live: the failed attempt was recorded on the settings row.
    const { data } = await admin
      .from("account_settings")
      .select("failed_attempts")
      .eq("account_id", a.id)
      .single()
      .overrideTypes<{ failed_attempts: number }, { merge: false }>();
    expect(data?.failed_attempts).toBeGreaterThanOrEqual(1);
  });

  it("missing marker refuses (403) even with the correct PIN and e-mail", async () => {
    const a = await createSignedInUser("accdel-nomarker");
    cleanup.push(a.id);
    await seedFootprint(a, "1234");
    const jar = await signedInJar(a); // authed, NOT parent-verified

    const response = await deleteAccountPOST(deleteContext(jar, { pin: "1234", email: a.email }));

    expect(response.status).toBe(403);
    expect(await authUserExists(a.id)).toBe(true);
  });

  it("e-mail mismatch refuses (400) after the PIN check and nothing is deleted", async () => {
    const a = await createSignedInUser("accdel-badmail");
    cleanup.push(a.id);
    await seedFootprint(a, "1234");
    const jar = await signedInJar(a);
    armMarker(jar, a.id);

    const response = await deleteAccountPOST(deleteContext(jar, { pin: "1234", email: "kto-inny@example.test" }));

    expect(response.status).toBe(400);
    expect(((await response.json()) as { reason?: string }).reason).toBe("email-mismatch");
    expect(await authUserExists(a.id)).toBe(true);
  });

  it("a second account is untouched by a neighbor's deletion", async () => {
    const a = await createSignedInUser("accdel-self");
    const b = await createSignedInUser("accdel-bystander");
    cleanup.push(a.id, b.id);
    await seedFootprint(a, "1234");
    await seedFootprint(b, "5678");
    const jar = await signedInJar(a);
    armMarker(jar, a.id);

    const response = await deleteAccountPOST(deleteContext(jar, { pin: "1234", email: a.email }));

    expect(response.status).toBe(200);
    expect(await authUserExists(a.id)).toBe(false);
    // The bystander's world is intact — the admin call is pinned to the session id.
    expect(await authUserExists(b.id)).toBe(true);
    expect(await ownedRowCount("child_profiles", b.id)).toBe(1);
    expect(await ownedRowCount("shift_log", b.id)).toBe(1);
    expect(await ownedRowCount("account_settings", b.id)).toBe(1);
  });
});
