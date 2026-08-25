import { describe, expect, it } from "vitest";
import type { Task } from "@/types";
import {
  ADAPT_RATE,
  DIFFICULTY_MAX,
  DIFFICULTY_MIN,
  MAX_SHIFT_DRIFT,
  TARGET_SUCCESS,
  TIER_ANCHOR,
  TWO_STAGE_THRESHOLD,
  ceilingForLevel,
  changeCapFor,
  countRangeFor,
  createSeededRandom,
  type DifficultyState,
  nextDifficulty,
  paidMaxFor,
  readDifficultyState,
  seedDifficultyFor,
  shiftLengthRangeFor,
  tierForLevel,
} from "@/data/adaptive";
import { SCATTER_MAX, generateCountingTask } from "@/data/counting-tasks";
import { STOCK_CHANGE_MAX, STOCK_PRICE_MAX, generateChangeMakingTask } from "@/data/change-making-tasks";
import { MAX_SHIFT_TASKS, generateShift, shiftLength } from "@/data/shift";
import { MAX_BONUS_TASKS } from "@/data/upgrades";

/**
 * The continuous difficulty model (adaptive-task-engine P3). Pure — no DOM, no
 * Supabase. Two things are being locked here, and they are different in kind:
 *
 *  - **Calibration.** That `d = 0` reproduces today's tier-1 parameters EXACTLY
 *    is what lets phases 3–4 ship invisibly. Four e2e executions assert on the
 *    tier-1 earnings/star envelope, and one task of drift in shift length
 *    silently flips which upgrade is affordable — so a calibration regression
 *    surfaces as a mystifying e2e failure, not as a failure here, unless these
 *    tests catch it first.
 *  - **Bounds.** No outcome stream and no seed may put a child outside their age
 *    band or in front of a task shape they are too young for. These are the
 *    failure modes that would be *wrong* rather than merely suboptimal.
 *
 * Determinism comes from injected pickers and the seeded PRNG — there is no
 * property-testing dependency, so "property-style" means a hand-rolled invariant
 * helper called inside a sweep loop (the `assertInvariants` convention from
 * `tests/change-making-tasks.test.ts`).
 */

/** The `d` grid every sweep walks — endpoints and both tier anchors land on it exactly. */
const D_SWEEP = Array.from({ length: 21 }, (_, i) => i / 20);
const SEEDS = [1, 7, 42, 1337, 90210];
const TRAY_CAP = 20;

const uniform = (d: number): DifficultyState => ({ math: d, money: d });

/**
 * Fold a shift's outcomes through the adaptation rule the way the engine will:
 * `index` is positional (0 is the warm-up), `shiftStartDifficulty` is the drift
 * clamp's anchor, and `afterMiss` looks at the PREVIOUS task. Phase 5's client
 * hook and server recompute both reduce to this; keeping the model here means the
 * guard tests exercise the real sequencing rather than one call in isolation.
 */
function foldShift(start: number, outcomes: readonly boolean[], ceiling: number): number {
  let d = start;
  outcomes.forEach((firstTry, index) => {
    d = nextDifficulty(
      d,
      { firstTry },
      { index, shiftStartDifficulty: start, ceiling, afterMiss: index > 0 && !outcomes[index - 1] },
    );
  });
  return d;
}

describe("calibration — the tier anchors reproduce today's parameters exactly", () => {
  it("d = 0 is tier 1: SHIFT_LENGTH {5,7}, COUNT_RANGE {3,10}, CHANGE_CAP 5, PAID_MAX 10", () => {
    expect(shiftLengthRangeFor(0)).toEqual({ min: 5, max: 7 });
    expect(countRangeFor(0)).toEqual({ min: 3, max: 10 });
    expect(changeCapFor(0)).toBe(5);
    expect(paidMaxFor(0)).toBe(10);
  });

  it("d = 0.5 is tier 2 and d = 1 is tier 3", () => {
    expect(shiftLengthRangeFor(TIER_ANCHOR[2])).toEqual({ min: 8, max: 10 });
    expect(countRangeFor(TIER_ANCHOR[2])).toEqual({ min: 6, max: 20 });
    expect(changeCapFor(TIER_ANCHOR[2])).toBe(10);
    expect(paidMaxFor(TIER_ANCHOR[2])).toBe(20);

    expect(shiftLengthRangeFor(TIER_ANCHOR[3])).toEqual({ min: 9, max: 12 });
    expect(countRangeFor(TIER_ANCHOR[3])).toEqual({ min: 10, max: 25 });
    expect(changeCapFor(TIER_ANCHOR[3])).toBe(15);
    expect(paidMaxFor(TIER_ANCHOR[3])).toBe(30);
  });

  it("a fresh profile seeds to its old tier, so no existing child sees a jump", () => {
    expect(seedDifficultyFor(1)).toEqual({ math: TIER_ANCHOR[1], money: TIER_ANCHOR[1] });
    expect(seedDifficultyFor(2)).toEqual({ math: TIER_ANCHOR[2], money: TIER_ANCHOR[2] });
    expect(seedDifficultyFor(3)).toEqual({ math: TIER_ANCHOR[3], money: TIER_ANCHOR[3] });
    // Out-of-range levels clamp into the band, as tierForLevel always has.
    expect(seedDifficultyFor(0)).toEqual(seedDifficultyFor(1));
    expect(seedDifficultyFor(9)).toEqual(seedDifficultyFor(3));
  });

  it("a level-1 seed generates inside the tier-1 envelope the e2e suite asserts on", () => {
    const d = seedDifficultyFor(1);
    for (const seed of SEEDS) {
      const rng = createSeededRandom(seed);
      for (let i = 0; i < 40; i++) {
        const n = shiftLength(Math.max(d.math, d.money), 0, rng.pick);
        expect(n).toBeGreaterThanOrEqual(5);
        expect(n).toBeLessThanOrEqual(7);
      }
    }
  });

  it("tierForLevel survives as the seed mapping only", () => {
    expect(tierForLevel(1)).toBe(1);
    expect(tierForLevel(2)).toBe(2);
    expect(tierForLevel(3)).toBe(3);
    expect(tierForLevel(-3)).toBe(1);
    expect(tierForLevel(5)).toBe(3);
  });

  it("a valid price is always rollable: the paid ceiling stays above the change cap", () => {
    for (const d of D_SWEEP) expect(paidMaxFor(d) - changeCapFor(d)).toBeGreaterThanOrEqual(1);
  });

  it("every band stays a band — a fixed d still varies the numbers", () => {
    for (const d of D_SWEEP) {
      expect(countRangeFor(d).max).toBeGreaterThan(countRangeFor(d).min);
      expect(shiftLengthRangeFor(d).max).toBeGreaterThan(shiftLengthRangeFor(d).min);
    }
  });
});

describe("readDifficultyState", () => {
  it("normalizes a fresh/empty column to the starting_level seed — no data migration", () => {
    expect(readDifficultyState({}, 1)).toEqual(seedDifficultyFor(1));
    expect(readDifficultyState(null, 2)).toEqual(seedDifficultyFor(2));
    expect(readDifficultyState(undefined, 3)).toEqual(seedDifficultyFor(3));
  });

  it("fills a missing key from the seed and keeps the present one", () => {
    expect(readDifficultyState({ math: 0.25 }, 1)).toEqual({ math: 0.25, money: TIER_ANCHOR[1] });
  });

  it("falls back to the seed on garbage rather than clamping garbage", () => {
    for (const junk of [NaN, Infinity, -1, 2, "0.4", null, {}, []]) {
      expect(readDifficultyState({ math: junk, money: junk }, 1)).toEqual(seedDifficultyFor(1));
    }
  });

  it("clamps an in-scale value that sits above the profile's age band", () => {
    // 0.9 is a legal `d`, but not for a level-1 child — the band ceiling wins.
    expect(readDifficultyState({ math: 0.9, money: 0.9 }, 1)).toEqual({
      math: ceilingForLevel(1),
      money: ceilingForLevel(1),
    });
  });

  it("returns a fresh object, never aliasing the persisted value", () => {
    const stored = { math: 0.2, money: 0.3 };
    const read = readDifficultyState(stored, 1);
    read.math = 0.9;
    expect(stored.math).toBe(0.2);
  });
});

describe("the adaptation rule", () => {
  it("moves d down four times as fast as it moves up — the asymmetry is the point", () => {
    const ctx = { index: 1, shiftStartDifficulty: 0.5, ceiling: 1, afterMiss: false };
    const up = nextDifficulty(0.5, { firstTry: true }, ctx) - 0.5;
    const down = 0.5 - nextDifficulty(0.5, { firstTry: false }, ctx);
    expect(up).toBeCloseTo(ADAPT_RATE * (1 - TARGET_SUCCESS), 10);
    expect(down).toBeCloseTo(ADAPT_RATE * TARGET_SUCCESS, 10);
    expect(down / up).toBeCloseTo(4, 10);
  });

  it("guard 1 — the shift's first task never moves d (warm-up)", () => {
    const ctx = { index: 0, shiftStartDifficulty: 0.5, ceiling: 1, afterMiss: false };
    expect(nextDifficulty(0.5, { firstTry: true }, ctx)).toBe(0.5);
    expect(nextDifficulty(0.5, { firstTry: false }, ctx)).toBe(0.5);
  });

  it("guard 2 — d never rises on the task straight after a miss (cooldown)", () => {
    const after = { index: 3, shiftStartDifficulty: 0.5, ceiling: 1, afterMiss: true };
    expect(nextDifficulty(0.5, { firstTry: true }, after)).toBe(0.5);
    // The cooldown suppresses the RISE only — a second miss still lowers d.
    expect(nextDifficulty(0.5, { firstTry: false }, after)).toBeLessThan(0.5);
    // And across a whole stream: no task following a miss ends higher than it started.
    const outcomes = [true, false, true, true, false, true, false, true];
    let d = 0.5;
    outcomes.forEach((firstTry, index) => {
      const before = d;
      d = nextDifficulty(
        d,
        { firstTry },
        { index, shiftStartDifficulty: 0.5, ceiling: 1, afterMiss: index > 0 && !outcomes[index - 1] },
      );
      if (index > 0 && !outcomes[index - 1]) expect(d).toBeLessThanOrEqual(before);
    });
  });

  it("guard 3 — one shift cannot move d further than MAX_SHIFT_DRIFT either way", () => {
    const longest = MAX_SHIFT_TASKS;
    const allClean = Array.from({ length: longest }, () => true);
    const allMissed = Array.from({ length: longest }, () => false);
    expect(foldShift(0.5, allClean, 1) - 0.5).toBeLessThanOrEqual(MAX_SHIFT_DRIFT + 1e-9);
    expect(0.5 - foldShift(0.5, allMissed, 1)).toBeLessThanOrEqual(MAX_SHIFT_DRIFT + 1e-9);
    // An all-missed shift of this length is long enough for the clamp to BIND —
    // without that the assertion above would pass on a broken clamp.
    expect(0.5 - foldShift(0.5, allMissed, 1)).toBeCloseTo(MAX_SHIFT_DRIFT, 10);
  });

  it("guard 4 — no stream, at any level, escapes [0, ceilingForLevel]", () => {
    for (const level of [1, 2, 3]) {
      const ceiling = ceilingForLevel(level);
      const rng = createSeededRandom(level * 977);
      let d = seedDifficultyFor(level).math;
      for (let shift = 0; shift < 200; shift++) {
        const outcomes = Array.from({ length: rng.pick(5, MAX_SHIFT_TASKS) }, () => rng.chance(0.5));
        d = foldShift(d, outcomes, ceiling);
        expect(d).toBeGreaterThanOrEqual(DIFFICULTY_MIN);
        expect(d).toBeLessThanOrEqual(ceiling);
      }
    }
    // A perfect streak is the case that matters: it must stop AT the band ceiling.
    let perfect = seedDifficultyFor(1).math;
    for (let shift = 0; shift < 200; shift++) {
      perfect = foldShift(
        perfect,
        Array.from({ length: 7 }, () => true),
        ceilingForLevel(1),
      );
    }
    expect(perfect).toBe(ceilingForLevel(1));
  });

  it("converges on TARGET_SUCCESS against a learner who struggles as d rises", () => {
    // A synthetic child whose first-try chance falls linearly with difficulty.
    // p(d) = 0.8 at d = 1/3, so a rule that steers to TARGET_SUCCESS must park
    // the child near there — not at either bound, which is what a broken sign or
    // a runaway rate would produce.
    const rng = createSeededRandom(20260825);
    const chanceAt = (d: number) => 1 - 0.6 * d;
    let d = 0;
    let firstTries = 0;
    let tasks = 0;
    for (let shift = 0; shift < 400; shift++) {
      const outcomes = Array.from({ length: 8 }, () => rng.chance(chanceAt(d)));
      d = foldShift(d, outcomes, DIFFICULTY_MAX);
      if (shift >= 200) {
        firstTries += outcomes.filter(Boolean).length;
        tasks += outcomes.length;
      }
    }
    expect(d).toBeGreaterThan(0.1);
    expect(d).toBeLessThan(0.5);
    expect(firstTries / tasks).toBeGreaterThan(TARGET_SUCCESS - 0.06);
    expect(firstTries / tasks).toBeLessThan(TARGET_SUCCESS + 0.06);
  });

  it("all-clean rises, all-missed falls to the floor", () => {
    let up = 0.5;
    let down = 0.5;
    for (let shift = 0; shift < 100; shift++) {
      up = foldShift(
        up,
        Array.from({ length: 8 }, () => true),
        1,
      );
      down = foldShift(
        down,
        Array.from({ length: 8 }, () => false),
        1,
      );
    }
    expect(up).toBe(DIFFICULTY_MAX);
    expect(down).toBe(DIFFICULTY_MIN);
  });
});

describe("scenario admission — the two-stage guarantee", () => {
  it("the invariant that carries it: ceilingForLevel(2) < TWO_STAGE_THRESHOLD", () => {
    // Warm-up, the cooldown, the drift clamp and the band ceiling all bound the
    // MAGNITUDE of the numbers. None of them can keep a multi-step task away from
    // a six-year-old — only this ordering does.
    expect(ceilingForLevel(1)).toBeLessThan(TWO_STAGE_THRESHOLD);
    expect(ceilingForLevel(2)).toBeLessThan(TWO_STAGE_THRESHOLD);
    expect(ceilingForLevel(3)).toBeGreaterThanOrEqual(TWO_STAGE_THRESHOLD);
  });

  it("no d a level-1/2 child can reach emits stock_and_change, even with the gate forced on", () => {
    const ceiling = ceilingForLevel(2);
    for (const seed of SEEDS) {
      const rng = createSeededRandom(seed);
      for (const d of D_SWEEP.filter((v) => v <= ceiling)) {
        for (let i = 0; i < 20; i++) {
          expect(generateChangeMakingTask(d, rng.pick, () => true).scenario).toBe("give_change");
        }
      }
    }
  });

  it("and not through the shift mixer either", () => {
    const ceiling = ceilingForLevel(2);
    for (const d of D_SWEEP.filter((v) => v <= ceiling)) {
      for (let i = 0; i < 10; i++) {
        for (const task of generateShift(uniform(d))) {
          if (task.type === "change_making") expect(task.scenario).toBe("give_change");
        }
      }
    }
  });

  it("a level-3 profile still reaches it — the scenario is not stranded", () => {
    const d = seedDifficultyFor(3).math;
    expect(d).toBeGreaterThanOrEqual(TWO_STAGE_THRESHOLD);
    expect(
      generateChangeMakingTask(
        d,
        (min) => min,
        () => true,
      ).scenario,
    ).toBe("stock_and_change");
  });
});

describe("shift-length ceiling", () => {
  it("no reachable d can generate a shift longer than MAX_SHIFT_TASKS", () => {
    // A shift longer than the route's cap is not a cosmetic bug: complete.ts 400s
    // on a parse failure and mid-shift state is never persisted (FR-016), so the
    // child plays a whole shift and loses the entire write.
    for (const d of D_SWEEP) {
      expect(shiftLengthRangeFor(d).max + MAX_BONUS_TASKS).toBeLessThanOrEqual(MAX_SHIFT_TASKS);
      expect(shiftLength(d, MAX_BONUS_TASKS, (_min, max) => max)).toBeLessThanOrEqual(MAX_SHIFT_TASKS);
      expect(generateShift(uniform(d), MAX_BONUS_TASKS, (_min, max) => max).length).toBeLessThanOrEqual(
        MAX_SHIFT_TASKS,
      );
    }
  });

  it("MAX_SHIFT_TASKS is not slack — the longest reachable shift actually reaches it", () => {
    expect(shiftLength(DIFFICULTY_MAX, MAX_BONUS_TASKS, (_min, max) => max)).toBe(MAX_SHIFT_TASKS);
  });
});

describe("determinism — a seed reproduces a whole shift", () => {
  const shiftFrom = (seed: number, d: DifficultyState) => {
    const rng = createSeededRandom(seed);
    return generateShift(
      d,
      0,
      rng.pick,
      () => (rng.chance(0.5) ? "counting" : "change_making"),
      () => rng.chance(0.3),
    );
  };

  it("the same seed and difficulty produce an identical task sequence", () => {
    for (const seed of SEEDS) {
      for (const d of [0, 0.5, 1]) {
        expect(shiftFrom(seed, uniform(d))).toEqual(shiftFrom(seed, uniform(d)));
      }
    }
  });

  it("a different seed produces a different one — the seed is load-bearing", () => {
    expect(shiftFrom(1, uniform(0.5))).not.toEqual(shiftFrom(2, uniform(0.5)));
  });

  it("the picker itself replays exactly", () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    for (let i = 0; i < 200; i++) expect(a.pick(0, 1000)).toBe(b.pick(0, 1000));
  });

  it("pick stays inclusive on both ends and never leaves the range", () => {
    const rng = createSeededRandom(3);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const v = rng.pick(2, 5);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
      seen.add(v);
    }
    expect(seen).toEqual(new Set([2, 3, 4, 5]));
  });
});

/**
 * The shared invariant helper the range sweep leans on — one place that knows
 * what a generated task must satisfy at ANY difficulty, so a new interpolation
 * curve is checked against the same bar as the old one.
 */
function assertTaskInvariants(task: Task, d: number) {
  expect(task.difficulty).toBe(d);
  if (task.type === "counting") {
    const { min, max } = countRangeFor(d);
    expect(task.targetCount).toBeGreaterThanOrEqual(min);
    expect(task.targetCount).toBeLessThanOrEqual(max);
    expect(task.arrangement).toBe(task.targetCount <= SCATTER_MAX ? "scatter" : "rows_of_5");
    return;
  }
  const money = task;
  expect(money.change).toBeGreaterThanOrEqual(1);
  expect(money.price).toBeGreaterThanOrEqual(1);
  expect(money.paid).toBe(money.price + money.change);
  expect(money.availableCount).toBeGreaterThan(money.change);
  expect(money.availableCount).toBeLessThanOrEqual(TRAY_CAP);
  expect(money.arrangement).toBe(money.availableCount <= SCATTER_MAX ? "scatter" : "rows_of_5");
  if (money.scenario === "give_change") {
    expect(money.change).toBeLessThanOrEqual(changeCapFor(d));
    expect(money.paid).toBeLessThanOrEqual(paidMaxFor(d));
    expect(money.stockCount).toBeUndefined();
    return;
  }
  // Two-stage: per-stage ceilings are fixed, not functions of d, so the second
  // board never compounds the scenario's own difficulty with a bigger number.
  expect(d).toBeGreaterThanOrEqual(TWO_STAGE_THRESHOLD);
  expect(money.price).toBeLessThanOrEqual(STOCK_PRICE_MAX);
  expect(money.change).toBeLessThanOrEqual(STOCK_CHANGE_MAX);
  expect(money.stockCount).toBeGreaterThan(money.price);
  expect(money.stockCount).toBeLessThanOrEqual(TRAY_CAP);
  expect(money.stockArrangement).toBe((money.stockCount ?? 0) <= SCATTER_MAX ? "scatter" : "rows_of_5");
}

describe("range invariants across the whole scale", () => {
  it("every task generated at every d, from every seed, is well-formed", () => {
    for (const seed of SEEDS) {
      const rng = createSeededRandom(seed);
      for (const d of D_SWEEP) {
        for (let i = 0; i < 10; i++) {
          assertTaskInvariants(generateCountingTask(d, rng.pick), d);
          assertTaskInvariants(
            generateChangeMakingTask(d, rng.pick, () => rng.chance(0.5)),
            d,
          );
        }
      }
    }
  });

  it("a hostile picker cannot push a task out of band at any d", () => {
    for (const d of D_SWEEP) {
      // A non-finite picker must floor to the easiest legal task, never strand the
      // child on an answer that can't be matched.
      for (const rogue of [() => -999, () => 999, () => NaN] as const) {
        const counting = generateCountingTask(d, rogue);
        expect(counting.targetCount).toBeGreaterThanOrEqual(countRangeFor(d).min);
        expect(counting.targetCount).toBeLessThanOrEqual(countRangeFor(d).max);
      }
      for (const rogue of [() => -999, () => 999, () => NaN] as const) {
        assertTaskInvariants(
          generateChangeMakingTask(d, rogue, () => false),
          d,
        );
      }
      // Shift LENGTH is the third generator driven by the same picker, and its
      // failure mode is the worst of the three: a NaN length makes `generateShift`
      // emit a zero-task shift, so the child is handed nothing to do and the shift
      // can never be completed. The two loops above would not have caught it.
      for (const rogue of [() => -999, () => 999, () => NaN] as const) {
        const { min, max } = shiftLengthRangeFor(d);
        const n = shiftLength(d, 0, rogue);
        expect(n).toBeGreaterThanOrEqual(min);
        expect(n).toBeLessThanOrEqual(max);
        expect(generateShift(uniform(d), 0, rogue)).toHaveLength(n);
      }
    }
  });

  it("an off-scale difficulty is clamped onto the scale, never propagated", () => {
    expect(generateCountingTask(-5).difficulty).toBe(DIFFICULTY_MIN);
    expect(generateCountingTask(5).difficulty).toBe(DIFFICULTY_MAX);
    expect(generateChangeMakingTask(-5, undefined, () => false).difficulty).toBe(DIFFICULTY_MIN);
    expect(generateChangeMakingTask(NaN, undefined, () => false).difficulty).toBe(DIFFICULTY_MIN);
  });
});
