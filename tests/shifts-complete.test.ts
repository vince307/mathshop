import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as completePOST } from "@/pages/api/shifts/complete";
import { POST as signinPOST } from "@/pages/api/auth/signin";
import { admin, createSignedInUser, deleteUser, PASSWORD, type TestAccount } from "./helpers/supabase";
import { buildContext, type CookieJar, createCookieJar } from "./helpers/astro";
import { businessLevelForShifts, earningsForShift, MAX_SHIFT_TASKS } from "@/data/shift";
import { readSkillState, type SkillState } from "@/data/skills";

/**
 * Route-level persistence + isolation for POST /api/shifts/complete (S-04/S-05).
 * Proves the route (a) persists wallet/shift-count/level computed SERVER-SIDE from
 * the reported accuracy (the client never supplies an amount), and (b) never
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

/**
 * A valid per-competency `skills` delta (S-07) that reconciles with the reported
 * aggregates: all play credited to math, so Σ completed = taskCount and Σ
 * firstTry = cleanCount (the route's reconciliation refine passes).
 */
function skillsFor(taskCount: number, cleanCount: number): string {
  return JSON.stringify({
    math: { firstTryCorrect: cleanCount, completed: taskCount, misses: 0 },
    money: { firstTryCorrect: 0, completed: 0, misses: 0 },
  });
}

function completeContext(jar: CookieJar, formData: Record<string, string>) {
  // The client always posts `skills`; auto-attach a reconciling delta unless the
  // test provides its own (e.g. to exercise inflation rejection).
  const fd = { ...formData };
  if ("taskCount" in fd && !("skills" in fd)) {
    fd.skills = skillsFor(Number(fd.taskCount), Number("cleanCount" in fd ? fd.cleanCount : 0));
  }
  return buildContext({ url: "https://test.local/api/shifts/complete", method: "POST", formData: fd, cookies: jar });
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
    .select("wallet_balance, completed_shift_count, business_level")
    .eq("id", profileId)
    .single()
    .overrideTypes<
      { wallet_balance: number; completed_shift_count: number; business_level: number },
      { merge: false }
    >();
  return data;
}

/** Read the profile's normalized skill_state via the RLS-bypassing admin client. */
async function readSkill(profileId: string): Promise<SkillState> {
  const { data } = await admin
    .from("child_profiles")
    .select("skill_state")
    .eq("id", profileId)
    .single()
    .overrideTypes<{ skill_state: unknown }, { merge: false }>();
  return readSkillState(data?.skill_state);
}

/** Read the profile's shift_log rows via the RLS-bypassing admin client. */
async function readLogRows(profileId: string) {
  const { data } = await admin
    .from("shift_log")
    .select("skills, upgrade_purchased")
    .eq("profile_id", profileId)
    .overrideTypes<{ skills: unknown; upgrade_purchased: string | null }[], { merge: false }>();
  return data ?? [];
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

  it("persists wallet/shift-count/level computed server-side from accuracy", async () => {
    const jar = await mintSession(accountA.email);
    const res = await completePOST(completeContext(jar, { profileId: aProfileId, taskCount: "6", cleanCount: "6" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { earned: number; businessLevel: number; leveledUp: boolean };
    expect(body.earned).toBe(earningsForShift(6, 6)); // 48
    expect(body.businessLevel).toBe(businessLevelForShifts(1)); // 1

    const state = await readState(aProfileId);
    expect(state).toMatchObject({
      wallet_balance: earningsForShift(6, 6),
      completed_shift_count: 1,
      business_level: 1,
    });
  });

  it("never trusts a client-sent amount — wallet earnings come from accuracy only", async () => {
    const jar = await mintSession(accountA.email);
    const before = await readState(aProfileId);
    const res = await completePOST(
      completeContext(jar, { profileId: aProfileId, taskCount: "5", cleanCount: "0", wallet_balance: "99999" }),
    );
    expect(res.status).toBe(200);
    const after = await readState(aProfileId);
    expect(after?.wallet_balance).toBe((before?.wallet_balance ?? 0) + earningsForShift(5, 0)); // +25, not +99999
    expect(after?.completed_shift_count).toBe((before?.completed_shift_count ?? 0) + 1);
  });

  it("L-002 spoof: account B cannot write account A's profile", async () => {
    const jar = await mintSession(accountB.email);
    const before = await readState(aProfileId);
    const res = await completePOST(completeContext(jar, { profileId: aProfileId, taskCount: "9", cleanCount: "9" }));
    expect(res.status).not.toBe(200); // B can neither read nor write A's row
    const after = await readState(aProfileId);
    expect(after?.wallet_balance).toBe(before?.wallet_balance);
    expect(after?.completed_shift_count).toBe(before?.completed_shift_count);
  });

  it("accepts a max-length shift (a fully-upgraded shop, S-06 cap)", async () => {
    const jar = await mintSession(accountA.email);
    const before = await readState(aProfileId);
    const res = await completePOST(
      completeContext(jar, {
        profileId: aProfileId,
        taskCount: String(MAX_SHIFT_TASKS),
        cleanCount: String(MAX_SHIFT_TASKS),
      }),
    );
    expect(res.status).toBe(200); // the longest possible upgraded shift isn't rejected
    const after = await readState(aProfileId);
    expect(after?.wallet_balance).toBe(
      (before?.wallet_balance ?? 0) + earningsForShift(MAX_SHIFT_TASKS, MAX_SHIFT_TASKS),
    );
  });

  it("rejects invalid input and writes nothing", async () => {
    const jar = await mintSession(accountA.email);
    const before = await readState(aProfileId);
    const res = await completePOST(completeContext(jar, { profileId: aProfileId, taskCount: "0", cleanCount: "5" }));
    expect(res.status).toBe(400);
    const after = await readState(aProfileId);
    expect(after?.wallet_balance).toBe(before?.wallet_balance);
    expect(after?.completed_shift_count).toBe(before?.completed_shift_count);
  });

  it("folds the per-competency skill delta into skill_state, monotonically on replay", async () => {
    // Fresh profile so the counters are asserted from a known zero baseline.
    const profileId = await seedProfile(accountA.id);
    const jar = await mintSession(accountA.email);
    expect(await readSkill(profileId)).toEqual(readSkillState(null)); // starts fully zeroed

    // A 4-task shift, 3 clean: math 2/2 (1 miss), money 1/2 (3 misses). Σ completed=4≤4, Σ firstTry=3≤3.
    const skills = JSON.stringify({
      math: { firstTryCorrect: 2, completed: 2, misses: 1 },
      money: { firstTryCorrect: 1, completed: 2, misses: 3 },
    });
    const res = await completePOST(completeContext(jar, { profileId, taskCount: "4", cleanCount: "3", skills }));
    expect(res.status).toBe(200);
    const afterOne = await readSkill(profileId);
    expect(afterOne.math).toEqual({ firstTryCorrect: 2, completed: 2, misses: 1 });
    expect(afterOne.money).toEqual({ firstTryCorrect: 1, completed: 2, misses: 3 });
    expect(afterOne.decisions).toEqual({ firstTryCorrect: 0, completed: 0, misses: 0 }); // never touched by a shift

    // Replaying the identical shift only ever increases the counters (monotonic).
    const res2 = await completePOST(completeContext(jar, { profileId, taskCount: "4", cleanCount: "3", skills }));
    expect(res2.status).toBe(200);
    const afterTwo = await readSkill(profileId);
    expect(afterTwo.math).toEqual({ firstTryCorrect: 4, completed: 4, misses: 2 });
    expect(afterTwo.money).toEqual({ firstTryCorrect: 2, completed: 4, misses: 6 });
  });

  it("rejects a skill delta that exceeds the reported shift and writes no skill change", async () => {
    const profileId = await seedProfile(accountA.id);
    const jar = await mintSession(accountA.email);
    // Σ completed = 8 > taskCount 4 — the reconciliation refine must reject it.
    const inflated = JSON.stringify({
      math: { firstTryCorrect: 4, completed: 8, misses: 0 },
      money: { firstTryCorrect: 0, completed: 0, misses: 0 },
    });
    const res = await completePOST(
      completeContext(jar, { profileId, taskCount: "4", cleanCount: "4", skills: inflated }),
    );
    expect(res.status).toBe(400);
    const state = await readState(profileId);
    expect(state?.completed_shift_count).toBe(0); // nothing persisted
    expect(await readSkill(profileId)).toEqual(readSkillState(null)); // skill untouched
  });

  it("writes exactly one shift_log row per completed shift with the right deltas", async () => {
    const profileId = await seedProfile(accountA.id);
    const jar = await mintSession(accountA.email);
    const skills = JSON.stringify({
      math: { firstTryCorrect: 2, completed: 2, misses: 1 },
      money: { firstTryCorrect: 1, completed: 2, misses: 0 },
    });
    const res = await completePOST(completeContext(jar, { profileId, taskCount: "4", cleanCount: "3", skills }));
    expect(res.status).toBe(200);

    const rows = await readLogRows(profileId);
    expect(rows).toHaveLength(1);
    expect(rows[0].upgrade_purchased).toBeNull(); // a plain shift, not a purchase
    const logged = readSkillState(rows[0].skills);
    expect(logged.math).toEqual({ firstTryCorrect: 2, completed: 2, misses: 1 });
    expect(logged.money).toEqual({ firstTryCorrect: 1, completed: 2, misses: 0 });
  });

  it("L-002: account B's shift never writes a shift_log row for account A", async () => {
    const profileId = await seedProfile(accountA.id);
    const jar = await mintSession(accountB.email);
    const res = await completePOST(completeContext(jar, { profileId, taskCount: "5", cleanCount: "5" }));
    expect(res.status).not.toBe(200); // B can't reach A's profile
    expect(await readLogRows(profileId)).toHaveLength(0); // no log row leaked onto A
  });
});
