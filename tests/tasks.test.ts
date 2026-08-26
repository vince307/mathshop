import { describe, expect, it } from "vitest";
import { DIFFICULTY_MAX, DIFFICULTY_MIN, TIER_ANCHOR, type DifficultyState, countRangeFor } from "@/data/adaptive";
import { MAX_TYPE_SHARE, TYPE_SPLIT, generateTask, typeSplitFor } from "@/data/tasks";

/**
 * The task-type dispatcher (S-03). `/app/task` calls this to get either a
 * counting or a change-making task. Dispatch is asserted deterministically via
 * an injected `pickType`; the default RNG is checked to reach both types.
 */

const D1 = TIER_ANCHOR[1];
const D2 = TIER_ANCHOR[2];
const uniform = (d: number): DifficultyState => ({ math: d, money: d });

describe("generateTask", () => {
  it("dispatches to a counting task when pickType says counting", () => {
    expect(generateTask(uniform(D1), () => "counting").type).toBe("counting");
  });

  it("dispatches to a change-making task when pickType says change_making", () => {
    expect(generateTask(uniform(D1), () => "change_making").type).toBe("change_making");
  });

  it("produces both task types over many default draws", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(generateTask(uniform(D1)).type);
    expect(seen.has("counting")).toBe(true);
    expect(seen.has("change_making")).toBe(true);
  });

  it("selects the difficulty by the task's competency, not by a single global value", () => {
    // counting → math, change_making → money. This is the seam that makes a child
    // strong at counting and weak at giving change get each at its own level.
    const split: DifficultyState = { math: D1, money: D2 };
    expect(generateTask(split, () => "counting").difficulty).toBe(D1);
    expect(generateTask(split, () => "change_making").difficulty).toBe(D2);
  });

  it("forwards `pick` to the leaf generators", () => {
    // The repaired injection chain: this function used to call the generators
    // with no picker at all, so `generateShift` had no way to inject one and
    // seeded (P4) client-side generation was impossible.
    const counting = generateTask(
      uniform(D2),
      () => "counting",
      (min) => min,
    );
    expect(counting.type === "counting" && counting.targetCount).toBe(countRangeFor(D2).min);

    const money = generateTask(
      uniform(D2),
      () => "change_making",
      (min) => min,
    );
    expect(money.type === "change_making" && money.change).toBe(1);
  });

  it("forwards `pickTwoStage` to the change-making generator", () => {
    const task = generateTask(
      uniform(TIER_ANCHOR[3]),
      () => "change_making",
      (min) => min,
      () => true,
    );
    expect(task.scenario).toBe("stock_and_change");
  });

  it("falls through to each leaf's own default RNG when no picker is given", () => {
    // Passing `undefined` through is deliberate — the dispatcher must not carry a
    // duplicate copy of the default RNG.
    for (let i = 0; i < 50; i++) {
      const task = generateTask(uniform(D1), () => "counting");
      expect(task.type === "counting" && task.targetCount).toBeGreaterThanOrEqual(countRangeFor(D1).min);
    }
  });
});

/**
 * The weak-competency bias (adaptive-task-engine P5). The pedagogical claim is
 * "practise what you are worse at"; the counter-claim, which is what the cap is
 * for, is that a shift made almost entirely of the thing a child keeps getting
 * wrong is how you make them stop playing. So the two properties worth locking
 * are that the bias points the right way and that it cannot run away.
 */
describe("typeSplitFor", () => {
  it("is exactly the unbiased split when both competencies are equal", () => {
    for (const d of [DIFFICULTY_MIN, 0.25, TIER_ANCHOR[2], DIFFICULTY_MAX]) {
      expect(typeSplitFor(uniform(d))).toBe(TYPE_SPLIT);
    }
  });

  it("raises counting's share when math is the weaker competency", () => {
    // counting → math. A child worse at counting should meet more of it.
    expect(typeSplitFor({ math: 0.1, money: 0.4 })).toBeGreaterThan(TYPE_SPLIT);
  });

  it("raises change-making's share when money is the weaker one", () => {
    expect(typeSplitFor({ math: 0.4, money: 0.1 })).toBeLessThan(TYPE_SPLIT);
  });

  it("is symmetric: mirroring the gap mirrors the split", () => {
    const gap = { math: 0.2, money: 0.5 };
    const mirrored = { math: 0.5, money: 0.2 };
    expect(typeSplitFor(gap) - TYPE_SPLIT).toBeCloseTo(TYPE_SPLIT - typeSplitFor(mirrored), 10);
  });

  it("never exceeds the cap in either direction, at any pair of difficulties", () => {
    // The runaway guard. Swept rather than spot-checked because the cap is the
    // only thing standing between "a nudge" and "a shift of nothing but the
    // thing they are worst at".
    for (let math = 0; math <= 1.0001; math += 0.05) {
      for (let money = 0; money <= 1.0001; money += 0.05) {
        const split = typeSplitFor({ math, money });
        expect(split).toBeLessThanOrEqual(MAX_TYPE_SHARE);
        expect(split).toBeGreaterThanOrEqual(1 - MAX_TYPE_SHARE);
      }
    }
  });

  it("reaches the cap exactly at the full width of the level-1/2 band", () => {
    // A gap of 0.5 is one competency at the floor with the other at the band
    // ceiling — maximally lopsided for a child who is inside their band at all.
    expect(typeSplitFor({ math: DIFFICULTY_MIN, money: TIER_ANCHOR[2] })).toBeCloseTo(MAX_TYPE_SHARE, 10);
    expect(typeSplitFor({ math: TIER_ANCHOR[2], money: DIFFICULTY_MIN })).toBeCloseTo(1 - MAX_TYPE_SHARE, 10);
  });

  it("drives the default draw: a lopsided profile sees more of its weak type", () => {
    const weakAtCounting: DifficultyState = { math: DIFFICULTY_MIN, money: TIER_ANCHOR[2] };
    let counting = 0;
    for (let i = 0; i < 4000; i++) {
      if (generateTask(weakAtCounting).type === "counting") counting += 1;
    }
    // ~0.65 expected; the window is wide enough that 4000 draws make a flake
    // astronomically unlikely while still excluding the unbiased 0.5.
    expect(counting / 4000).toBeGreaterThan(0.58);
    expect(counting / 4000).toBeLessThan(0.72);
  });
});
