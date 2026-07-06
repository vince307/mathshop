import { describe, expect, it } from "vitest";
import {
  CHANGE_CAP,
  PAID_MAX,
  STOCK_CHANGE_MAX,
  STOCK_PRICE_MAX,
  generateChangeMakingTask,
  generateStockAndChangeTask,
  isChangeCorrect,
} from "@/data/change-making-tasks";
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
    // Scenario gate forced off: this sweep pins the single-stage tier-3 band.
    for (let v = 1; v <= 32; v++) {
      assertInvariants(
        generateChangeMakingTask(
          3,
          () => v,
          () => false,
        ),
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
    const task = generateChangeMakingTask(
      3,
      (_min, max) => max,
      () => false,
    );
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

/**
 * Two-stage "stock then sell" scenario (S-08, Phase 2). Standalone generator —
 * not yet reachable from the shift mixer. Stage 1: count `price` into the
 * register from a tray of `stockCount`; stage 2: give `change` from
 * `availableCount`. Per-stage numbers stay modest (independent of the tier-3
 * single-stage ceiling) so neither board overwhelms the child.
 */
function assertStockAndChangeInvariants(task: ChangeMakingTask) {
  expect(task.type).toBe("change_making");
  expect(task.scenario).toBe("stock_and_change");
  expect(task.objectType).toBe("coin");
  expect(task.difficultyTier).toBe(3);
  // Stage 1: the tray offers more than the price, so the child must stop at it.
  expect(task.price).toBeGreaterThanOrEqual(1);
  expect(task.price).toBeLessThanOrEqual(STOCK_PRICE_MAX);
  expect(task.stockCount).toBeGreaterThan(task.price);
  expect(task.stockCount).toBeLessThanOrEqual(20);
  // Stage 2: standard give-change invariants under the modest two-stage cap.
  expect(task.change).toBeGreaterThanOrEqual(1);
  expect(task.change).toBeLessThanOrEqual(STOCK_CHANGE_MAX);
  expect(task.availableCount).toBeGreaterThan(task.change);
  expect(task.availableCount).toBeLessThanOrEqual(20);
  expect(task.paid).toBe(task.price + task.change);
  expect(task.arrangement).toBe(task.availableCount <= 5 ? "scatter" : "rows_of_5");
  expect(task.stockArrangement).toBe((task.stockCount ?? 0) <= 5 ? "scatter" : "rows_of_5");
}

describe("generateStockAndChangeTask", () => {
  it("holds two-stage invariants across a sweep of injected picks", () => {
    for (let v = 1; v <= 18; v++) {
      assertStockAndChangeInvariants(generateStockAndChangeTask(3, () => v));
    }
  });

  it("a max picker hits the modest per-stage ceilings, not the tier-3 maxima", () => {
    const task = generateStockAndChangeTask(3, (_min, max) => max);
    expect(task.price).toBe(STOCK_PRICE_MAX);
    expect(task.change).toBe(STOCK_CHANGE_MAX);
    expect(task.paid).toBe(STOCK_PRICE_MAX + STOCK_CHANGE_MAX);
    // Both stage trays stay comfortably renderable even at the ceiling.
    expect(task.stockCount).toBeLessThanOrEqual(20);
    expect(task.availableCount).toBeLessThanOrEqual(20);
  });

  it("a min picker floors to the smallest valid two-stage task", () => {
    const task = generateStockAndChangeTask(3, (min) => min);
    expect(task.price).toBe(1);
    expect(task.change).toBe(1);
    expect(task.paid).toBe(2);
    expect(task.stockCount).toBeGreaterThan(1);
    expect(task.availableCount).toBeGreaterThan(1);
  });

  it("the default RNG stays within the two-stage band over many draws", () => {
    for (let i = 0; i < 50; i++) {
      assertStockAndChangeInvariants(generateStockAndChangeTask(3));
    }
  });
});

describe("generateChangeMakingTask scenario gate (S-08, Phase 3)", () => {
  const twoStageOn = () => true;
  const twoStageOff = () => false;

  it("tier 3 with the scenario picker forced on emits the two-stage scenario", () => {
    const task = generateChangeMakingTask(3, (min) => min, twoStageOn);
    expect(task.scenario).toBe("stock_and_change");
    assertStockAndChangeInvariants(task);
  });

  it("tier 3 with the scenario picker forced off emits single-stage give_change", () => {
    assertInvariants(
      generateChangeMakingTask(3, (min) => min, twoStageOff),
      3,
    );
  });

  it("tiers 1–2 never emit the two-stage scenario, even with the picker forced on", () => {
    for (const level of [1, 2] as const) {
      for (let v = 1; v <= 12; v++) {
        const task = generateChangeMakingTask(level, () => v, twoStageOn);
        expect(task.scenario).toBe("give_change");
      }
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
