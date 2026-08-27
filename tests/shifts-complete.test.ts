import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as completePOST } from "@/pages/api/shifts/complete";
import { POST as signinPOST } from "@/pages/api/auth/signin";
import { admin, createSignedInUser, deleteUser, PASSWORD, type TestAccount } from "./helpers/supabase";
import { buildContext, type CookieJar, createCookieJar } from "./helpers/astro";
import { businessLevelForShifts, earningsForShift, MAX_SHIFT_TASKS, profitForShift } from "@/data/shift";
import { UPGRADES, shopEffects } from "@/data/upgrades";
import { readSkillState, type SkillState } from "@/data/skills";
import {
  DIFFICULTY_MAX,
  ceilingForLevel,
  foldShiftOutcomes,
  readDifficultyState,
  seedDifficultyFor,
  type DifficultyState,
  type ScoredTask,
} from "@/data/adaptive";

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

/**
 * A valid per-task `attempts` array (P1) that reconciles with the reported
 * aggregates: `taskCount` counting tasks (so `competency` matches `task_type`),
 * the first `cleanCount` of them first-try, and `shift_index` running 0..n-1.
 *
 * `difficulty` defaults to null (the P1/P2 shape) and is overridable so the P5
 * tamper case can put a hostile value in it. It is telemetry either way — the
 * persisted difficulty is recomputed from `first_try`, never read from here.
 */
function attemptsFor(taskCount: number, cleanCount: number, difficulty: number | null = null): string {
  return JSON.stringify(
    Array.from({ length: taskCount }, (_unused, i) => ({
      shift_index: i,
      task_type: "counting",
      scenario: "count_till",
      competency: "math",
      difficulty,
      params: { targetCount: 5 },
      first_try: i < cleanCount,
      misses: i < cleanCount ? 0 : 1,
      duration_ms: 3000,
    })),
  );
}

/**
 * The scored-task view of `attemptsFor`'s shift — the same shift, as the
 * adaptation rule sees it. Used to state the expected difficulty independently
 * of the route, so the assertion is "the server ran the rule", not "the server
 * agrees with itself".
 */
function scoredFor(taskCount: number, cleanCount: number): ScoredTask[] {
  return Array.from({ length: taskCount }, (_unused, i) => ({
    index: i,
    competency: "math" as const,
    firstTry: i < cleanCount,
  }));
}

function completeContext(jar: CookieJar, formData: Record<string, string>) {
  // The client always posts `skills` + `attempts`; auto-attach reconciling values
  // unless the test provides its own (e.g. to exercise a rejection path).
  const fd = { ...formData };
  if ("taskCount" in fd && !("skills" in fd)) {
    fd.skills = skillsFor(Number(fd.taskCount), Number("cleanCount" in fd ? fd.cleanCount : 0));
  }
  if ("taskCount" in fd && !("attempts" in fd)) {
    fd.attempts = attemptsFor(Number(fd.taskCount), Number("cleanCount" in fd ? fd.cleanCount : 0));
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

/** Give a seeded profile an owned catalogue, via the RLS-bypassing admin client. */
async function ownUpgrades(profileId: string, purchased: string[]): Promise<void> {
  await admin.from("child_profiles").update({ shop_state: { purchased } }).eq("id", profileId);
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

/**
 * How many task_attempt rows exist for a profile (admin client, RLS-bypassing).
 * A rejected shift must leave this at zero — a 400 that still wrote telemetry
 * would be worse than no validation at all.
 */
async function countAttempts(profileId: string): Promise<number> {
  const { data } = await admin
    .from("task_attempt")
    .select("id")
    .eq("profile_id", profileId)
    .overrideTypes<{ id: string }[], { merge: false }>();
  return data?.length ?? 0;
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

/** Read the profile's normalized difficulty_state via the RLS-bypassing admin client. */
async function readDifficulty(profileId: string): Promise<DifficultyState> {
  const { data } = await admin
    .from("child_profiles")
    .select("difficulty_state, starting_level")
    .eq("id", profileId)
    .single()
    .overrideTypes<{ difficulty_state: unknown; starting_level: number }, { merge: false }>();
  return readDifficultyState(data?.difficulty_state, data?.starting_level ?? 1);
}

/** Read the profile's shift_log rows via the RLS-bypassing admin client. */
async function readLogRows(profileId: string) {
  const { data } = await admin
    .from("shift_log")
    .select("skills, upgrade_purchased, earned")
    .eq("profile_id", profileId)
    .overrideTypes<{ skills: unknown; upgrade_purchased: string | null; earned: number | null }[], { merge: false }>();
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

  /**
   * The four P1 reconciliation refines. Unlike the `skills` refines above, which
   * use `<=` because a delta is an aggregate, these are exact: `attempts` is a
   * COMPLETE per-task record, so any deviation means a broken or tampered client.
   * Each case asserts the shift is rejected AND that nothing was persisted — a
   * 400 that still wrote telemetry would be worse than no validation at all.
   */
  it("rejects an attempts array whose length disagrees with taskCount", async () => {
    const profileId = await seedProfile(accountA.id);
    const jar = await mintSession(accountA.email);
    const res = await completePOST(
      completeContext(jar, { profileId, taskCount: "4", cleanCount: "4", attempts: attemptsFor(3, 3) }),
    );
    expect(res.status).toBe(400);
    expect((await readState(profileId))?.completed_shift_count).toBe(0);
    expect(await countAttempts(profileId)).toBe(0);
  });

  it("rejects an attempts array whose first-try count disagrees with cleanCount", async () => {
    const profileId = await seedProfile(accountA.id);
    const jar = await mintSession(accountA.email);
    // 4 tasks, all first-try, but the shift claims only 2 were clean.
    const res = await completePOST(
      completeContext(jar, { profileId, taskCount: "4", cleanCount: "2", attempts: attemptsFor(4, 4) }),
    );
    expect(res.status).toBe(400);
    expect(await countAttempts(profileId)).toBe(0);
  });

  it("rejects an attempt whose competency contradicts its task_type", async () => {
    const profileId = await seedProfile(accountA.id);
    const jar = await mintSession(accountA.email);
    // counting implies math; claiming money is only possible from a broken client.
    const mismatched = JSON.stringify([
      {
        shift_index: 0,
        task_type: "counting",
        scenario: "count_till",
        competency: "money",
        difficulty: null,
        params: { targetCount: 5 },
        first_try: true,
        misses: 0,
        duration_ms: 3000,
      },
    ]);
    const res = await completePOST(
      completeContext(jar, { profileId, taskCount: "1", cleanCount: "1", attempts: mismatched }),
    );
    expect(res.status).toBe(400);
    expect(await countAttempts(profileId)).toBe(0);
  });

  it("rejects duplicate shift_index values (a replayed task)", async () => {
    const profileId = await seedProfile(accountA.id);
    const jar = await mintSession(accountA.email);
    const duplicated = JSON.parse(attemptsFor(2, 2)) as { shift_index: number }[];
    duplicated[1].shift_index = 0; // 0,0 instead of 0,1
    const res = await completePOST(
      completeContext(jar, {
        profileId,
        taskCount: "2",
        cleanCount: "2",
        attempts: JSON.stringify(duplicated),
      }),
    );
    expect(res.status).toBe(400);
    expect(await countAttempts(profileId)).toBe(0);
  });

  it("writes one task_attempt row per task, with difficulty still null in this phase", async () => {
    const profileId = await seedProfile(accountA.id);
    const jar = await mintSession(accountA.email);
    const res = await completePOST(completeContext(jar, { profileId, taskCount: "4", cleanCount: "3" }));
    expect(res.status).toBe(200);

    const { data: rows } = await admin
      .from("task_attempt")
      .select("shift_index, task_type, competency, difficulty, first_try, duration_ms")
      .eq("profile_id", profileId)
      .order("shift_index")
      .overrideTypes<
        {
          shift_index: number;
          task_type: string;
          competency: string;
          difficulty: number | null;
          first_try: boolean;
          duration_ms: number;
        }[],
        { merge: false }
      >();
    expect(rows).toHaveLength(4);
    expect(rows?.map((r) => r.shift_index)).toEqual([0, 1, 2, 3]);
    expect(rows?.filter((r) => r.first_try)).toHaveLength(3);
    // P3 introduces the continuous scale; until then the column stays empty
    // rather than holding a normalised tier that later rows would not match.
    expect(rows?.every((r) => r.difficulty === null)).toBe(true);
    expect(rows?.every((r) => r.duration_ms === 3000)).toBe(true);
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

  it("records the server-computed payout in shift_log.earned (F4)", async () => {
    // The payout is recomputed server-side from taskCount/cleanCount; the client
    // never supplies an amount. Asserted against the fixture, NOT against
    // wallet_balance: appendShiftLog is best-effort and swallows its insert error,
    // so `wallet == sum(earned)` would be flaky by construction.
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
    expect(rows[0].earned).toBe(5 * 4 + 3 * 3); // earningsForShift(taskCount, cleanCount) = 29
  });

  /**
   * The profit rule (E1), end to end and from the TRUSTED row. The route is
   * handed nothing about the shop; it resolves `shopEffects` from what the
   * database says the child owns, so a client cannot claim a margin — or dodge a
   * cost — by what it POSTs.
   */
  it("returns revenue, cost and profit, all recomputed from the row's own shop_state", async () => {
    const profileId = await seedProfile(accountA.id);
    await ownUpgrades(profileId, ["shelf", "register"]);
    const jar = await mintSession(accountA.email);
    const res = await completePOST(completeContext(jar, { profileId, taskCount: "6", cleanCount: "6" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { earned: number; revenue: number; cost: number; profit: number };

    const expected = profitForShift(6, 6, shopEffects(["shelf", "register"]));
    expect(body).toMatchObject(expected);
    // `earned` IS the wallet delta and IS profit — the two names, one number.
    expect(body.earned).toBe(expected.profit);
    expect(body.cost).toBeGreaterThan(0);
    expect(body.revenue).toBe(earningsForShift(6, 6));

    const state = await readState(profileId);
    expect(state?.wallet_balance).toBe(expected.profit);
  });

  it("credits the wallet with PROFIT, not revenue — the cost never reaches the wallet twice", async () => {
    const profileId = await seedProfile(accountA.id);
    await ownUpgrades(profileId, ["shelf", "register", "slot"]);
    const jar = await mintSession(accountA.email);
    const before = await readState(profileId);
    const res = await completePOST(completeContext(jar, { profileId, taskCount: "6", cleanCount: "4" }));
    expect(res.status).toBe(200);
    const { profit, revenue } = profitForShift(6, 4, shopEffects(["shelf", "register", "slot"]));
    expect(profit).toBeLessThan(revenue); // the fixture is only meaningful if a cost exists
    const after = await readState(profileId);
    expect(after?.wallet_balance).toBe((before?.wallet_balance ?? 0) + profit);
    expect(after?.wallet_balance).not.toBe((before?.wallet_balance ?? 0) + revenue);
  });

  /**
   * FR-008 as a durable guard: the wallet may NEVER go down on the shift path,
   * whatever the shop costs to run and however badly the shift went. This is the
   * assertion that catches a future refactor reaching for `wallet -= cost`; it is
   * deliberately a monotonicity guard and NOT a profit guard, so it stays true
   * (and stays meaningful) independently of how the payout is computed.
   */
  it("FR-008: the wallet never decreases on a shift, even with the whole catalogue running", async () => {
    const profileId = await seedProfile(accountA.id);
    await ownUpgrades(
      profileId,
      UPGRADES.map((u) => u.id),
    );
    const jar = await mintSession(accountA.email);
    const before = await readState(profileId);
    // The worst shift the route accepts: one task, none clean. Revenue 5 zl
    // against a fully-owned shop's running cost — profit clamps to 0.
    const res = await completePOST(completeContext(jar, { profileId, taskCount: "1", cleanCount: "0" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { revenue: number; cost: number; profit: number };
    expect(body.cost).toBeGreaterThan(body.revenue);
    expect(body.profit).toBe(0);
    const after = await readState(profileId);
    expect(after?.wallet_balance).toBeGreaterThanOrEqual(before?.wallet_balance ?? 0);
  });

  it("PINS current behavior: a duplicate shift-end POST pays twice (no idempotency key — Risk #2 §6.3.4)", async () => {
    // The design has no shift idempotency key: each POST is treated as a new
    // legitimate shift, so an accidental client/network replay double-pays.
    // Pinned consciously (test-plan cookbook §6.3 step 4) so that adding an
    // idempotency key later is a deliberate hardening change, not an accident.
    // Relevant horizon: supabase-js auto-retry lands at v2.102.0 (§4 note).
    const profileId = await seedProfile(accountA.id);
    const jar = await mintSession(accountA.email);
    const shift = { profileId, taskCount: "5", cleanCount: "5" };

    expect((await completePOST(completeContext(jar, shift))).status).toBe(200);
    expect((await completePOST(completeContext(jar, shift))).status).toBe(200);

    const state = await readState(profileId);
    expect(state?.completed_shift_count).toBe(2); // replay counted as a 2nd shift
    expect(state?.wallet_balance).toBe(2 * earningsForShift(5, 5)); // and paid twice
  });

  /**
   * Server-side difficulty recompute (adaptive-task-engine P5).
   *
   * The whole security argument of this phase is one sentence: the client is
   * asked what HAPPENED, never what it should become. It reports outcomes; the
   * server folds them through the same rule the island ran, from the stored
   * state, inside this profile's own age band. So the only lie available to a
   * tampered client is about how well its child did — and that lie moves its own
   * difficulty, which is a punishment, not an exploit.
   */
  it("recomputes and persists difficulty from the reported outcomes", async () => {
    const profileId = await seedProfile(accountA.id);
    const jar = await mintSession(accountA.email);
    // A fresh profile normalises to its starting_level seed — no data migration.
    expect(await readDifficulty(profileId)).toEqual(seedDifficultyFor(1));

    const res = await completePOST(completeContext(jar, { profileId, taskCount: "6", cleanCount: "6" }));
    expect(res.status).toBe(200);
    expect(await readDifficulty(profileId)).toEqual(
      foldShiftOutcomes(seedDifficultyFor(1), scoredFor(6, 6), ceilingForLevel(1)),
    );
  });

  it("carries difficulty across consecutive shifts — the second starts where the first ended", async () => {
    const profileId = await seedProfile(accountA.id);
    const jar = await mintSession(accountA.email);
    const ceiling = ceilingForLevel(1);

    expect((await completePOST(completeContext(jar, { profileId, taskCount: "6", cleanCount: "6" }))).status).toBe(200);
    const afterOne = await readDifficulty(profileId);
    expect((await completePOST(completeContext(jar, { profileId, taskCount: "6", cleanCount: "6" }))).status).toBe(200);

    // Folded from the STORED state, not from the seed: `d` is the profile's, not
    // the shift's, and a child who improved yesterday keeps it today.
    expect(await readDifficulty(profileId)).toEqual(foldShiftOutcomes(afterOne, scoredFor(6, 6), ceiling));
    expect((await readDifficulty(profileId)).math).toBeGreaterThan(afterOne.math);
  });

  it("moves difficulty DOWN on a missed shift, and only for the competency played", async () => {
    const profileId = await seedProfile(accountA.id);
    const jar = await mintSession(accountA.email);
    // Climb first — a level-1 profile seeds at the floor and has nowhere to fall.
    for (let i = 0; i < 6; i++) {
      expect((await completePOST(completeContext(jar, { profileId, taskCount: "8", cleanCount: "8" }))).status).toBe(
        200,
      );
    }
    const climbed = await readDifficulty(profileId);
    expect(climbed.math).toBeGreaterThan(0);

    // attemptsFor credits every task to `math`, so `money` must not move at all.
    expect((await completePOST(completeContext(jar, { profileId, taskCount: "8", cleanCount: "0" }))).status).toBe(200);
    const after = await readDifficulty(profileId);
    expect(after.math).toBeLessThan(climbed.math);
    expect(after.money).toBe(climbed.money);
  });

  it("TAMPER: a client-supplied difficulty in the payload is ignored", async () => {
    const profileId = await seedProfile(accountA.id);
    const jar = await mintSession(accountA.email);
    // Every attempt claims it was generated at the very top of the scale, and
    // every one of them was missed. If the route trusted the field the profile
    // would jump to the hardest tasks in the game on its worst possible shift.
    const res = await completePOST(
      completeContext(jar, {
        profileId,
        taskCount: "6",
        cleanCount: "0",
        attempts: attemptsFor(6, 0, DIFFICULTY_MAX),
      }),
    );
    expect(res.status).toBe(200);
    expect(await readDifficulty(profileId)).toEqual(
      foldShiftOutcomes(seedDifficultyFor(1), scoredFor(6, 0), ceilingForLevel(1)),
    );
    // The claimed value is still STORED as telemetry — it is what the client says
    // it generated at, and discarding it would lose the tuning signal entirely.
    const { data: rows } = await admin
      .from("task_attempt")
      .select("difficulty")
      .eq("profile_id", profileId)
      .overrideTypes<{ difficulty: number | null }[], { merge: false }>();
    expect(rows?.every((r) => r.difficulty === DIFFICULTY_MAX)).toBe(true);
  });

  it("CEILING: no number of perfect shifts can drive persisted difficulty past the age band", async () => {
    // The pedagogical guardrail, at the route. Enforced against the server's own
    // `ceilingForLevel(starting_level)` — the plan's ceiling crosses the wire for
    // the island's benefit, and is never what the persisted value is bounded by.
    const profileId = await seedProfile(accountA.id);
    const jar = await mintSession(accountA.email);
    const ceiling = ceilingForLevel(1);

    for (let shift = 0; shift < 40; shift++) {
      const res = await completePOST(
        completeContext(jar, { profileId, taskCount: String(MAX_SHIFT_TASKS), cleanCount: String(MAX_SHIFT_TASKS) }),
      );
      expect(res.status).toBe(200);
      const d = await readDifficulty(profileId);
      expect(d.math).toBeLessThanOrEqual(ceiling);
      expect(d.money).toBeLessThanOrEqual(ceiling);
    }
    // …and it does climb all the way there, so the bound is doing work rather
    // than sitting above anything reachable.
    expect((await readDifficulty(profileId)).math).toBe(ceiling);
  });

  it("a rejected shift leaves difficulty untouched", async () => {
    const profileId = await seedProfile(accountA.id);
    const jar = await mintSession(accountA.email);
    expect((await completePOST(completeContext(jar, { profileId, taskCount: "6", cleanCount: "6" }))).status).toBe(200);
    const before = await readDifficulty(profileId);

    // Length disagreement — the P1 reconciliation refine 400s it.
    const res = await completePOST(
      completeContext(jar, { profileId, taskCount: "4", cleanCount: "4", attempts: attemptsFor(3, 3) }),
    );
    expect(res.status).toBe(400);
    expect(await readDifficulty(profileId)).toEqual(before);
  });

  it("L-002: account B's shift never writes a shift_log row for account A", async () => {
    const profileId = await seedProfile(accountA.id);
    const jar = await mintSession(accountB.email);
    const res = await completePOST(completeContext(jar, { profileId, taskCount: "5", cleanCount: "5" }));
    expect(res.status).not.toBe(200); // B can't reach A's profile
    expect(await readLogRows(profileId)).toHaveLength(0); // no log row leaked onto A
  });
});
