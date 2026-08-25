import { describe, expect, it } from "vitest";
import type { DifficultyState } from "@/data/adaptive";
import { TIER_ANCHOR, createSeededRandom, randomSeed } from "@/data/adaptive";
import { STOCK_AND_CHANGE_RATE } from "@/data/change-making-tasks";
import { MAX_SHIFT_TASKS, createShiftSource, generateShift, openShift, planShift } from "@/data/shift";
import { TYPE_SPLIT } from "@/data/tasks";
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
    () => (rng.chance(TYPE_SPLIT) ? "counting" : "change_making"),
    () => rng.chance(STOCK_AND_CHANGE_RATE),
  );
}

/** P4's path: fix a plan, then draw one task at a time from it. */
function lazyShift(seed: number, difficulty: DifficultyState, bonus = 0) {
  const plan = planShift(difficulty, bonus, seed);
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
          expect(planShift(difficulty, bonus, seed).length).toBe(eagerShift(seed, difficulty, bonus).length);
        }
      }
    }
  });

  it("still honours MAX_SHIFT_TASKS — the cap the completion route 400s on", () => {
    // A plan longer than the route's cap costs the child the ENTIRE shift write:
    // complete.ts 400s on a parse failure and mid-shift state is never persisted.
    for (const seed of SEEDS) {
      for (const difficulty of DIFFICULTIES) {
        expect(planShift(difficulty, MAX_BONUS_TASKS, seed).length).toBeLessThanOrEqual(MAX_SHIFT_TASKS);
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
        const { plan, firstTask } = openShift(difficulty, 0, seed);
        expect(plan.seed).toBe(seed);
        expect(firstTask).toEqual(lazyShift(seed, difficulty)[0]);
      }
    }
  });

  it("carries the opening difficulty in the plan, so the client draws at the same d", () => {
    const { plan } = openShift(SPLIT, 0, 42);
    expect(plan.difficulty).toEqual(SPLIT);
  });

  it("draws its own seed when none is given, and two shifts do not share one", () => {
    const seeds = new Set(Array.from({ length: 50 }, () => openShift(uniform(TIER_ANCHOR[1])).plan.seed));
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
    const plan = planShift(uniform(TIER_ANCHOR[2]), 0, 7);
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
    const plan = planShift(uniform(TIER_ANCHOR[1]), 0, 3);
    const source = createShiftSource(plan);
    for (let i = 0; i < plan.length + 3; i++) {
      expect(source.next(plan.difficulty).type).toBeDefined();
    }
  });
});
