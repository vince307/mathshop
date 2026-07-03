import { describe, expect, it } from "vitest";
import { CHANGE_CAP, PAID_MAX, generateChangeMakingTask, isChangeCorrect } from "@/data/change-making-tasks";
import type { ChangeMakingTask } from "@/types";

/**
 * Pure change-making domain logic (S-03). No Supabase / DOM. Locks the
 * generation invariants (change cap, change = paid − price, band ceiling,
 * tray > change) and correctness. The picker is injected for determinism.
 */

function assertInvariants(task: ChangeMakingTask, tier: 1 | 2 | 3) {
  expect(task.type).toBe("change_making");
  expect(task.scenario).toBe("give_change");
  expect(task.objectType).toBe("coin");
  expect(task.difficultyTier).toBe(tier);
  expect(task.change).toBeGreaterThanOrEqual(1);
  expect(task.change).toBeLessThanOrEqual(CHANGE_CAP[tier]);
  expect(task.price).toBeGreaterThanOrEqual(1);
  expect(task.paid).toBe(task.price + task.change);
  expect(task.paid).toBeLessThanOrEqual(PAID_MAX[tier]);
  expect(task.availableCount).toBeGreaterThan(task.change);
  expect(task.availableCount).toBeLessThanOrEqual(20);
  expect(task.arrangement).toBe(task.availableCount <= 5 ? "scatter" : "rows_of_5");
}

describe("generateChangeMakingTask", () => {
  it("holds invariants across a sweep of injected picks (tier 1)", () => {
    for (let v = 1; v <= 12; v++) {
      assertInvariants(
        generateChangeMakingTask(1, () => v),
        1,
      );
    }
  });

  it("holds invariants across a sweep of injected picks (tier 2)", () => {
    for (let v = 1; v <= 22; v++) {
      assertInvariants(
        generateChangeMakingTask(2, () => v),
        2,
      );
    }
  });

  it("holds invariants across a sweep of injected picks (tier 3, S-08)", () => {
    for (let v = 1; v <= 32; v++) {
      assertInvariants(
        generateChangeMakingTask(3, () => v),
        3,
      );
    }
  });

  it("a max picker hits the tier ceiling without overshooting the band", () => {
    const task = generateChangeMakingTask(2, (_min, max) => max);
    expect(task.change).toBe(CHANGE_CAP[2]);
    expect(task.paid).toBe(PAID_MAX[2]);
    expect(task.price).toBe(PAID_MAX[2] - CHANGE_CAP[2]);
  });

  it("a max picker hits the tier-3 ceiling (S-08)", () => {
    const task = generateChangeMakingTask(3, (_min, max) => max);
    expect(task.change).toBe(CHANGE_CAP[3]);
    expect(task.paid).toBe(PAID_MAX[3]);
    expect(task.price).toBe(PAID_MAX[3] - CHANGE_CAP[3]);
  });

  it("a min picker floors to the smallest valid task", () => {
    const task = generateChangeMakingTask(1, (min) => min);
    expect(task.change).toBe(1);
    expect(task.price).toBe(1);
    expect(task.paid).toBe(2);
    expect(task.availableCount).toBeGreaterThan(1);
  });

  it("the default RNG stays within the band over many draws", () => {
    for (let i = 0; i < 50; i++) {
      assertInvariants(generateChangeMakingTask(1), 1);
      assertInvariants(generateChangeMakingTask(2), 2);
    }
  });
});

describe("isChangeCorrect", () => {
  const task: ChangeMakingTask = {
    type: "change_making",
    scenario: "give_change",
    objectType: "coin",
    paid: 5,
    price: 3,
    change: 2,
    availableCount: 4,
    arrangement: "scatter",
    difficultyTier: 1,
  };

  it("is true only when the coins given equal the change owed", () => {
    expect(isChangeCorrect(task, 2)).toBe(true);
    expect(isChangeCorrect(task, 1)).toBe(false);
    expect(isChangeCorrect(task, 3)).toBe(false);
    expect(isChangeCorrect(task, 0)).toBe(false);
  });
});
