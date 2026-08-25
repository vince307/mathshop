import { describe, expect, it } from "vitest";
import { TIER_ANCHOR, type DifficultyState, countRangeFor } from "@/data/adaptive";
import { generateTask } from "@/data/tasks";

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
