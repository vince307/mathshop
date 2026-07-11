import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as signinPOST } from "@/pages/api/auth/signin";
import { POST as deletePOST } from "@/pages/api/profiles/delete";
import { createChildProfile } from "@/lib/services/child-profiles";
import { signMarker, PARENT_VERIFIED_COOKIE } from "@/lib/services/parent-pin";
import { ACTIVE_PROFILE_COOKIE } from "@/lib/services/active-profile";
import { admin, createSignedInUser, deleteUser, PASSWORD, type TestAccount } from "./helpers/supabase";
import { buildContext, createCookieJar, type CookieJar } from "./helpers/astro";

/**
 * Child-profile deletion route contract (MAT-17). Fills the coverage gap the
 * research flagged: every pre-existing DELETE test is negative (cross-account
 * blocked) — nothing proved a same-account delete SUCCEEDS, cascades shift_log,
 * and leaves siblings/settings untouched. L-002 discipline throughout: durable
 * state is asserted via the service-role `admin` client read-back, never via the
 * API response alone. Requires the local Supabase stack + `.env.test`.
 */

/** Sign the account in through the real route so the jar carries a genuine session. */
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

/** Arm the jar with a fresh parent_verified marker for the account (the PIN gate's cookie). */
function armMarker(jar: CookieJar, accountId: string): void {
  jar.set(PARENT_VERIFIED_COOKIE, signMarker(accountId, Date.now() + 60_000));
}

async function createProfile(account: TestAccount, name: string): Promise<string> {
  const { data, error } = await createChildProfile(account.client, {
    accountId: account.id,
    name,
    age: 7,
    avatar: "fox",
    theme: "kawiarnia",
    startingLevel: 1,
  });
  if (error) throw error;
  return data.id;
}

async function seedShiftLog(account: TestAccount, profileId: string, rows: number): Promise<void> {
  for (let i = 0; i < rows; i++) {
    const { error } = await account.client.from("shift_log").insert({
      account_id: account.id,
      profile_id: profileId,
      skills: { counting: { firstTryCorrect: 1, completed: 1, misses: 0 } },
    });
    if (error) throw error;
  }
}

async function adminCount(table: string, column: string, value: string): Promise<number> {
  const { count } = await admin.from(table).select("*", { count: "exact", head: true }).eq(column, value);
  return count ?? 0;
}

function deleteContext(jar: CookieJar, profileId: string) {
  return buildContext({
    url: "https://test.local/api/profiles/delete",
    method: "POST",
    formData: { profileId },
    cookies: jar,
  });
}

describe("profile deletion route (MAT-17)", () => {
  let a: TestAccount;
  let b: TestAccount;

  beforeAll(async () => {
    a = await createSignedInUser("proffdel-a");
    b = await createSignedInUser("proffdel-b");
  });

  afterAll(async () => {
    await deleteUser(a.id);
    await deleteUser(b.id);
  });

  it("deletes an owned profile, cascades its shift_log, and spares the sibling", async () => {
    const target = await createProfile(a, "Kasia");
    const sibling = await createProfile(a, "Tomek");
    await seedShiftLog(a, target, 2);
    await seedShiftLog(a, sibling, 1);

    const jar = await signedInJar(a);
    armMarker(jar, a.id);
    const response = await deletePOST(deleteContext(jar, target));

    expect(response.status).toBe(200);
    // L-002: prove the durable state, not the response — admin (RLS-bypassing) read-back.
    expect(await adminCount("child_profiles", "id", target)).toBe(0);
    expect(await adminCount("shift_log", "profile_id", target)).toBe(0); // FK cascade
    expect(await adminCount("child_profiles", "id", sibling)).toBe(1); // sibling survives
    expect(await adminCount("shift_log", "profile_id", sibling)).toBe(1);
  });

  it("clears the active_profile cookie when it pointed at the deleted profile", async () => {
    const target = await createProfile(a, "Zosia");
    const jar = await signedInJar(a);
    armMarker(jar, a.id);
    jar.set(ACTIVE_PROFILE_COOKIE, target);

    const response = await deletePOST(deleteContext(jar, target));

    expect(response.status).toBe(200);
    expect(jar.get(ACTIVE_PROFILE_COOKIE)).toBeUndefined();
  });

  it("allows deleting the LAST profile (0-profile state is legal post-onboarding)", async () => {
    // Account B keeps exactly one profile, then deletes it.
    const only = await createProfile(b, "Janek");
    const jar = await signedInJar(b);
    armMarker(jar, b.id);

    const response = await deletePOST(deleteContext(jar, only));

    expect(response.status).toBe(200);
    expect(await adminCount("child_profiles", "account_id", b.id)).toBe(0);
  });

  it("cross-account delete via the route reads as not-found and the row durably remains", async () => {
    const victim = await createProfile(a, "Ola");
    const jar = await signedInJar(b);
    armMarker(jar, b.id); // B's own valid marker — the RLS layer is what must refuse

    const response = await deletePOST(deleteContext(jar, victim));

    expect(response.status).toBe(404);
    expect(await adminCount("child_profiles", "id", victim)).toBe(1); // durable (L-002)
  });

  it("refuses without a parent_verified marker (403) and the row remains", async () => {
    const target = await createProfile(a, "Basia");
    const jar = await signedInJar(a); // authed, but NOT parent-verified

    const response = await deletePOST(deleteContext(jar, target));

    expect(response.status).toBe(403);
    expect(await adminCount("child_profiles", "id", target)).toBe(1);
  });

  it("refuses a marker signed for a different account (403)", async () => {
    const target = await createProfile(a, "Marta");
    const jar = await signedInJar(a);
    armMarker(jar, b.id); // wrong account's marker

    const response = await deletePOST(deleteContext(jar, target));

    expect(response.status).toBe(403);
    expect(await adminCount("child_profiles", "id", target)).toBe(1);
  });

  it("rejects a malformed profile id with 400", async () => {
    const jar = await signedInJar(a);
    armMarker(jar, a.id);

    const response = await deletePOST(deleteContext(jar, "not-a-uuid"));

    expect(response.status).toBe(400);
  });
});
