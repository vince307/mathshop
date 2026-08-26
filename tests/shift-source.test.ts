import { describe, expect, it } from "vitest";
import type { DifficultyState } from "@/data/adaptive";
import {
  DIFFICULTY_MAX,
  DIFFICULTY_MIN,
  FINAL_TASK_RELIEF,
  TIER_ANCHOR,
  ceilingForLevel,
  createSeededRandom,
  foldShiftOutcomes,
  randomSeed,
  type ScoredTask,
} from "@/data/adaptive";
import { STOCK_AND_CHANGE_RATE } from "@/data/change-making-tasks";
import {
  MAX_SHIFT_TASKS,
  createShiftSource,
  drawDifficultyFor,
  generateShift,
  openShift,
  planShift,
} from "@/data/shift";
import { typeSplitFor } from "@/data/tasks";
import { MAX_BONUS_TASKS } from "@/data/upgrades";

/**
 * Lazy client-side generation (adaptive-task-engine P4). Pure — no DOM, no
 * Supabase.
 *
 * The one claim this file exists to prove: **moving generation across the wire
 * changed nothing about what gets generated.** The server no longer sends the
 * shift; it sends a plan, and the client draws tasks 2…N from the plan's seed. If
 * the lazy draw diverged from the eager one by so much as a single pick, the
 * child would get a different shift than P3 shipped — and the four e2e executions
 * that assert on the tier-1 earnings/star envelope would start failing for a
 * reason nothing in their own file explains. So the equivalence is pinned
 * directly, sequence against sequence, rather than sampled through invariants.
 *
 * The other claim, quieter but sharper: the server's task 1 and the client's
 * first draw are the SAME task. That one is a hydration bug when it breaks — the
 * child sees one task flash into another — and it is invisible to any test that
 * only checks the shift is well-formed.
 */

const SEEDS = [1, 7, 42, 1337, 90210];
/**
 * The plan's age-band ceiling, wide open. Nothing in this file adapts — every
 * draw here is at a fixed `d` — so the bound has nothing to bind, and pinning it
 * to the top of the scale keeps these sequence assertions about GENERATION.
 * `tests/adaptive.test.ts` and `tests/shifts-complete.test.ts` own the ceiling.
 */
const NO_CEILING = DIFFICULTY_MAX;
const BONUSES = [0, 2, MAX_BONUS_TASKS];

const uniform = (d: number): DifficultyState => ({ math: d, money: d });
/** A child strong at counting, weak at giving change — each task at its own `d`. */
const SPLIT: DifficultyState = { math: TIER_ANCHOR[1], money: TIER_ANCHOR[2] };
const DIFFICULTIES: DifficultyState[] = [
  uniform(TIER_ANCHOR[1]),
  uniform(TIER_ANCHOR[2]),
  uniform(TIER_ANCHOR[3]),
  SPLIT,
];

/**
 * P3's path: the whole shift materialised up front from one seeded stream. This
 * is the reference the lazy path is measured against, and it is the same
 * expression `tests/adaptive.test.ts` uses for its determinism check.
 */
function eagerShift(seed: number, difficulty: DifficultyState, bonus = 0) {
  const rng = createSeededRandom(seed);
  return generateShift(
    difficulty,
    bonus,
    rng.pick,
    () => (rng.chance(typeSplitFor(difficulty)) ? "counting" : "change_making"),
    () => rng.chance(STOCK_AND_CHANGE_RATE),
  );
}

/** P4's path: fix a plan, then draw one task at a time from it. */
function lazyShift(seed: number, difficulty: DifficultyState, bonus = 0) {
  const plan = planShift(difficulty, NO_CEILING, bonus, seed);
  const source = createShiftSource(plan);
  return Array.from({ length: plan.length }, () => source.next(difficulty));
}

describe("sequence equivalence — lazy generation reproduces P3 exactly", () => {
  it("draws the identical task sequence for every seed, difficulty and capacity bonus", () => {
    for (const seed of SEEDS) {
      for (const difficulty of DIFFICULTIES) {
        for (const bonus of BONUSES) {
          expect(lazyShift(seed, difficulty, bonus)).toEqual(eagerShift(seed, difficulty, bonus));
        }
      }
    }
  });

  it("agrees on the shift's LENGTH — the number five ShiftScreen sites and solve-shift.ts read", () => {
    for (const seed of SEEDS) {
      for (const difficulty of DIFFICULTIES) {
        for (const bonus of BONUSES) {
          expect(planShift(difficulty, NO_CEILING, bonus, seed).length).toBe(
            eagerShift(seed, difficulty, bonus).length,
          );
        }
      }
    }
  });

  it("still honours MAX_SHIFT_TASKS — the cap the completion route 400s on", () => {
    // A plan longer than the route's cap costs the child the ENTIRE shift write:
    // complete.ts 400s on a parse failure and mid-shift state is never persisted.
    for (const seed of SEEDS) {
      for (const difficulty of DIFFICULTIES) {
        expect(planShift(difficulty, NO_CEILING, MAX_BONUS_TASKS, seed).length).toBeLessThanOrEqual(MAX_SHIFT_TASKS);
      }
    }
  });

  it("is reproducible: the same plan replays into the same sequence", () => {
    for (const seed of SEEDS) {
      expect(lazyShift(seed, uniform(TIER_ANCHOR[2]))).toEqual(lazyShift(seed, uniform(TIER_ANCHOR[2])));
    }
  });

  it("a different seed produces a different shift — the seed is load-bearing", () => {
    expect(lazyShift(1, uniform(TIER_ANCHOR[2]))).not.toEqual(lazyShift(2, uniform(TIER_ANCHOR[2])));
  });
});

describe("openShift — the server's task 1 is the client's first draw", () => {
  it("hands out exactly the task the client would have drawn", () => {
    // The hydration contract. If these two ever diverge the server renders one
    // task, the island renders another, React discards the server tree and the
    // child watches the shift flip on load.
    for (const seed of SEEDS) {
      for (const difficulty of DIFFICULTIES) {
        const { plan, firstTask } = openShift(difficulty, NO_CEILING, 0, seed);
        expect(plan.seed).toBe(seed);
        expect(firstTask).toEqual(lazyShift(seed, difficulty)[0]);
      }
    }
  });

  it("carries the opening difficulty in the plan, so the client draws at the same d", () => {
    const { plan } = openShift(SPLIT, NO_CEILING, 0, 42);
    expect(plan.difficulty).toEqual(SPLIT);
  });

  it("draws its own seed when none is given, and two shifts do not share one", () => {
    const seeds = new Set(Array.from({ length: 50 }, () => openShift(uniform(TIER_ANCHOR[1]), NO_CEILING).plan.seed));
    expect(seeds.size).toBeGreaterThan(40); // collisions are possible, a constant is not
    for (const seed of seeds) {
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(0x1_0000_0000); // wider than mulberry32's state would be truncated
    }
  });

  it("randomSeed stays inside the 32 bits the PRNG actually keeps", () => {
    for (let i = 0; i < 500; i++) {
      const seed = randomSeed();
      expect(seed >>> 0).toBe(seed);
    }
  });
});

describe("the source cursor", () => {
  it("fixes the type sequence at plan time and yields it in order", () => {
    const plan = planShift(uniform(TIER_ANCHOR[2]), NO_CEILING, 0, 7);
    const source = createShiftSource(plan);
    expect(source.types).toHaveLength(plan.length);
    for (const type of source.types) {
      expect(source.next(plan.difficulty).type).toBe(type);
    }
  });

  it("gives each task ITS OWN competency's difficulty", () => {
    for (const task of lazyShift(42, SPLIT)) {
      expect(task.difficulty).toBe(task.type === "counting" ? SPLIT.math : SPLIT.money);
    }
  });

  it("never throws past the end of the shift", () => {
    // An over-long shift is a caller bug, but throwing here would strand a child
    // mid-play in a shift whose result is not persisted until the end (FR-016) —
    // the failure would cost them everything they had just done.
    const plan = planShift(uniform(TIER_ANCHOR[1]), NO_CEILING, 0, 3);
    const source = createShiftSource(plan);
    for (let i = 0; i < plan.length + 3; i++) {
      expect(source.next(plan.difficulty).type).toBeDefined();
    }
  });
});

/**
 * The in-shift adaptation policy (adaptive-task-engine P5) — the phase that
 * finally changes what the child experiences. `drawDifficultyFor` is the whole
 * of it: everything `useShiftEngine` does around this call is plumbing, and
 * keeping the decision here is what lets it be checked without rendering
 * anything.
 */
describe("drawDifficultyFor — the shift adapts as it is played", () => {
  const LEVEL_1_CEILING = ceilingForLevel(1);
  const plan = planShift({ math: DIFFICULTY_MIN, money: DIFFICULTY_MIN }, LEVEL_1_CEILING, 0, 42);
  const scoredThrough = (n: number, firstTry: boolean): ScoredTask[] =>
    Array.from({ length: n }, (_unused, index) => ({ index, competency: "math" as const, firstTry }));

  it("opens at the plan's difficulty — nothing has been scored yet", () => {
    expect(drawDifficultyFor(plan, [], 1)).toEqual(plan.difficulty);
  });

  it("raises the next task's difficulty after a clean answer", () => {
    // Not after the FIRST one: index 0 is the warm-up and never moves `d`.
    expect(drawDifficultyFor(plan, scoredThrough(1, true), 1).math).toBe(plan.difficulty.math);
    expect(drawDifficultyFor(plan, scoredThrough(2, true), 2).math).toBeGreaterThan(plan.difficulty.math);
  });

  it("lowers it after a miss, and never raises it on the task straight after one", () => {
    // Level 1 seeds at the floor, so there is no room to fall — the downward
    // direction is only observable from inside the band.
    const mid = planShift({ math: 0.4, money: 0.4 }, ceilingForLevel(3), 0, 42);
    expect(drawDifficultyFor(mid, scoredThrough(2, false), 2).math).toBeLessThan(mid.difficulty.math);
    // A clean answer immediately after a miss is held flat by the cooldown.
    const missThenClean: ScoredTask[] = [
      { index: 0, competency: "math", firstTry: true },
      { index: 1, competency: "math", firstTry: false },
      { index: 2, competency: "math", firstTry: true },
    ];
    const afterMiss = drawDifficultyFor(mid, missThenClean.slice(0, 2), 2).math;
    expect(drawDifficultyFor(mid, missThenClean, 3).math).toBe(afterMiss);
  });

  it("generates the CLOSING task easier than the fold would — end on a win", () => {
    const mid = planShift({ math: 0.4, money: 0.4 }, ceilingForLevel(3), 0, 42);
    const scored = scoredThrough(mid.length - 1, true);
    const folded = foldShiftOutcomes(mid.difficulty, scored, mid.ceiling);
    expect(drawDifficultyFor(mid, scored, mid.length - 1)).toEqual({
      math: folded.math - FINAL_TASK_RELIEF,
      money: folded.money - FINAL_TASK_RELIEF,
    });
    // …and only the closing one. The task before it is drawn at the full value.
    expect(drawDifficultyFor(mid, scored, mid.length - 2)).toEqual(folded);
  });

  it("relief floors at the bottom of the scale rather than going negative", () => {
    const closing = drawDifficultyFor(plan, scoredThrough(plan.length - 1, true), plan.length - 1);
    expect(closing.math).toBe(DIFFICULTY_MIN);
    expect(closing.money).toBe(DIFFICULTY_MIN);
  });

  it("never draws above the plan's ceiling, on any outcome stream", () => {
    // The pedagogical guardrail, at the draw site rather than at the fold. The
    // relief only ever lowers, so the ceiling is the binding side.
    for (const seed of SEEDS) {
      const rng = createSeededRandom(seed);
      const scored: ScoredTask[] = Array.from({ length: plan.length }, (_unused, index) => ({
        index,
        competency: rng.chance(0.5) ? "math" : "money",
        firstTry: rng.chance(0.7),
      }));
      for (let n = 0; n <= scored.length; n++) {
        const d = drawDifficultyFor(plan, scored.slice(0, n), n);
        expect(Math.max(d.math, d.money)).toBeLessThanOrEqual(LEVEL_1_CEILING);
        expect(Math.min(d.math, d.money)).toBeGreaterThanOrEqual(DIFFICULTY_MIN);
      }
    }
  });
});
