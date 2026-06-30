import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as completePOST } from "@/pages/api/shifts/complete";
import { POST as signinPOST } from "@/pages/api/auth/signin";
import { admin, createSignedInUser, deleteUser, PASSWORD, type TestAccount } from "./helpers/supabase";
import { buildContext, type CookieJar, createCookieJar } from "./helpers/astro";
import { businessLevelForShifts, coinsForShift } from "@/data/shift";

/**
 * Route-level persistence + isolation for POST /api/shifts/complete (S-04).
 * Proves the route (a) persists coins/shift-count/level computed SERVER-SIDE from
 * the reported accuracy (the client never supplies a coin amount), and (b) never
 * writes another account's profile (L-002 — RLS gates by id, account_id is never
 * trusted). Durable state is verified via the service-role `admin` client.
 * Requires the local Supabase stack + `.env.test`.
 */

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

function completeContext(jar: CookieJar, formData: Record<string, string>) {
  return buildContext({ url: "https://test.local/api/shifts/complete", method: "POST", formData, cookies: jar });
}

/** Seed a profile owned by `accountId` via the admin client (bypasses RLS). */
async function seedProfile(accountId: string): Promise<string> {
  const { data } = await admin
    .from("child_profiles")
    .insert({ account_id: accountId, name: "Ala", age: 7, avatar: "lis", theme: "kawiarnia" })
    .select("id")
    .single()
    .overrideTypes<{ id: string }, { merge: false }>();
  if (!data) throw new Error("seed failed");
  return data.id;
}

async function readState(profileId: string) {
  const { data } = await admin
    .from("child_profiles")
    .select("coins, completed_shift_count, business_level")
    .eq("id", profileId)
    .single()
    .overrideTypes<{ coins: number; completed_shift_count: number; business_level: number }, { merge: false }>();
  return data;
}

describe("POST /api/shifts/complete (route persistence + isolation)", () => {
  let accountA: TestAccount;
  let accountB: TestAccount;
  let aProfileId: string;

  beforeAll(async () => {
    accountA = await createSignedInUser("shift");
    accountB = await createSignedInUser("shift");
    aProfileId = await seedProfile(accountA.id);
  });

  afterAll(async () => {
    if (accountA.id) await deleteUser(accountA.id);
    if (accountB.id) await deleteUser(accountB.id);
  });

  it("persists coins/shift-count/level computed server-side from accuracy", async () => {
    const jar = await mintSession(accountA.email);
    const res = await completePOST(completeContext(jar, { profileId: aProfileId, taskCount: "6", cleanCount: "6" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { coinsEarned: number; businessLevel: number; leveledUp: boolean };
    expect(body.coinsEarned).toBe(coinsForShift(6, 6)); // 48
    expect(body.businessLevel).toBe(businessLevelForShifts(1)); // 1

    const state = await readState(aProfileId);
    expect(state).toMatchObject({ coins: coinsForShift(6, 6), completed_shift_count: 1, business_level: 1 });
  });

  it("never trusts a client-sent coin amount — coins come from accuracy only", async () => {
    const jar = await mintSession(accountA.email);
    const before = await readState(aProfileId);
    const res = await completePOST(
      completeContext(jar, { profileId: aProfileId, taskCount: "5", cleanCount: "0", coins: "99999" }),
    );
    expect(res.status).toBe(200);
    const after = await readState(aProfileId);
    expect(after?.coins).toBe((before?.coins ?? 0) + coinsForShift(5, 0)); // +25, not +99999
    expect(after?.completed_shift_count).toBe((before?.completed_shift_count ?? 0) + 1);
  });

  it("L-002 spoof: account B cannot write account A's profile", async () => {
    const jar = await mintSession(accountB.email);
    const before = await readState(aProfileId);
    const res = await completePOST(completeContext(jar, { profileId: aProfileId, taskCount: "9", cleanCount: "9" }));
    expect(res.status).not.toBe(200); // B can neither read nor write A's row
    const after = await readState(aProfileId);
    expect(after?.coins).toBe(before?.coins);
    expect(after?.completed_shift_count).toBe(before?.completed_shift_count);
  });

  it("rejects invalid input and writes nothing", async () => {
    const jar = await mintSession(accountA.email);
    const before = await readState(aProfileId);
    const res = await completePOST(completeContext(jar, { profileId: aProfileId, taskCount: "0", cleanCount: "5" }));
    expect(res.status).toBe(400);
    const after = await readState(aProfileId);
    expect(after?.coins).toBe(before?.coins);
    expect(after?.completed_shift_count).toBe(before?.completed_shift_count);
  });
});
