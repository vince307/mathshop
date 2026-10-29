import { describe, expect, it } from "vitest";
import {
  STOCK_CHANGE_MAX,
  STOCK_PRICE_MAX,
  generateChangeMakingTask,
  generateStockAndChangeTask,
  isChangeCorrect,
} from "@/data/change-making-tasks";
import { TIER_ANCHOR, changeCapFor, paidMaxFor } from "@/data/adaptive";
import type { ChangeMakingTask } from "@/types";

/**
 * Pure change-making domain logic (S-03). No Supabase / DOM. Locks the
 * generation invariants (change cap, change = paid − price, band ceiling,
 * tray > change) and correctness. The picker is injected for determinism.
 *
 * The generator now takes the continuous difficulty `d`, so these exercise the
 * three tier anchors (`d = 0 / 0.5 / 1`), calibrated to reproduce the old
 * tier-1/2/3 caps exactly. The scale itself lives in `tests/adaptive.test.ts`.
 */

const D1 = TIER_ANCHOR[1];
const D2 = TIER_ANCHOR[2];
const D3 = TIER_ANCHOR[3];

function assertInvariants(task: ChangeMakingTask, d: number) {
  expect(task.type).toBe("change_making");
  expect(task.scenario).toBe("give_change");
  expect(task.objectType).toBe("coin");
  expect(task.difficulty).toBe(d);
  expect(task.change).toBeGreaterThanOrEqual(1);
  expect(task.change).toBeLessThanOrEqual(changeCapFor(d));
  expect(task.price).toBeGreaterThanOrEqual(1);
  expect(task.paid).toBe(task.price + task.change);
  expect(task.paid).toBeLessThanOrEqual(paidMaxFor(d));
  expect(task.availableCount).toBeGreaterThan(task.change);
  expect(task.availableCount).toBeLessThanOrEqual(20);
  expect(task.arrangement).toBe(task.availableCount <= 5 ? "scatter" : "rows_of_5");
}

describe("generateChangeMakingTask", () => {
  it("holds invariants across a sweep of injected picks (d = 0)", () => {
    for (let v = 1; v <= 12; v++) {
      assertInvariants(
        generateChangeMakingTask(D1, () => v),
        D1,
      );
    }
  });

  it("holds invariants across a sweep of injected picks (d = 0.5)", () => {
    for (let v = 1; v <= 22; v++) {
      assertInvariants(
        generateChangeMakingTask(D2, () => v),
        D2,
      );
    }
  });

  it("holds invariants across a sweep of injected picks (d = 1, S-08)", () => {
    // Scenario gate forced off: this sweep pins the single-stage top band.
    for (let v = 1; v <= 32; v++) {
      assertInvariants(
        generateChangeMakingTask(
          D3,
          () => v,
          () => false,
        ),
        D3,
      );
    }
  });

  it("a max picker hits the band ceiling without overshooting it", () => {
    const task = generateChangeMakingTask(D2, (_min, max) => max);
    expect(task.change).toBe(changeCapFor(D2));
    expect(task.paid).toBe(paidMaxFor(D2));
    expect(task.price).toBe(paidMaxFor(D2) - changeCapFor(D2));
  });

  it("a max picker hits the top band ceiling (S-08)", () => {
    const task = generateChangeMakingTask(
      D3,
      (_min, max) => max,
      () => false,
    );
    expect(task.change).toBe(changeCapFor(D3));
    expect(task.paid).toBe(paidMaxFor(D3));
    expect(task.price).toBe(paidMaxFor(D3) - changeCapFor(D3));
  });

  it("a min picker floors to the smallest valid task", () => {
    const task = generateChangeMakingTask(D1, (min) => min);
    expect(task.change).toBe(1);
    expect(task.price).toBe(1);
    expect(task.paid).toBe(2);
    expect(task.availableCount).toBeGreaterThan(1);
  });

  it("the default RNG stays within the band over many draws", () => {
    for (let i = 0; i < 50; i++) {
      assertInvariants(generateChangeMakingTask(D1), D1);
      assertInvariants(generateChangeMakingTask(D2), D2);
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
  expect(task.difficulty).toBe(D3);
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
      assertStockAndChangeInvariants(generateStockAndChangeTask(D3, () => v));
    }
  });

  it("a max picker hits the modest per-stage ceilings, not the top single-stage maxima", () => {
    const task = generateStockAndChangeTask(D3, (_min, max) => max);
    expect(task.price).toBe(STOCK_PRICE_MAX);
    expect(task.change).toBe(STOCK_CHANGE_MAX);
    expect(task.paid).toBe(STOCK_PRICE_MAX + STOCK_CHANGE_MAX);
    // Both stage trays stay comfortably renderable even at the ceiling.
    expect(task.stockCount).toBeLessThanOrEqual(20);
    expect(task.availableCount).toBeLessThanOrEqual(20);
  });

  it("a min picker floors to the smallest valid two-stage task", () => {
    const task = generateStockAndChangeTask(D3, (min) => min);
    expect(task.price).toBe(1);
    expect(task.change).toBe(1);
    expect(task.paid).toBe(2);
    expect(task.stockCount).toBeGreaterThan(1);
    expect(task.availableCount).toBeGreaterThan(1);
  });

  it("the default RNG stays within the two-stage band over many draws", () => {
    for (let i = 0; i < 50; i++) {
      assertStockAndChangeInvariants(generateStockAndChangeTask(D3));
    }
  });
});

describe("generateChangeMakingTask scenario gate (S-08)", () => {
  const twoStageOn = () => true;
  const twoStageOff = () => false;

  it("d = 1 with the scenario picker forced on emits the two-stage scenario", () => {
    const task = generateChangeMakingTask(D3, (min) => min, twoStageOn);
    expect(task.scenario).toBe("stock_and_change");
    assertStockAndChangeInvariants(task);
  });

  it("d = 1 with the scenario picker forced off emits single-stage give_change", () => {
    assertInvariants(
      generateChangeMakingTask(D3, (min) => min, twoStageOff),
      D3,
    );
  });

  // The "young children never meet the two-stage scenario" guarantee used to rest
  // on the tier veto (`difficultyTier === 3`) that this file asserted here. That
  // premise is gone: admission is now a threshold on `d`, so the guarantee rests on
  // `ceilingForLevel(2) < TWO_STAGE_THRESHOLD` instead — proved over the whole
  // reachable range of `d`, and through the shift mixer, in `tests/adaptive.test.ts`
  // ("scenario admission — the two-stage guarantee"). Do not re-add a level-shaped
  // test here; there is no level to veto on any more.
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
    difficulty: D1,
  };

  it("is true only when the coins given equal the change owed", () => {
    expect(isChangeCorrect(task, 2)).toBe(true);
    expect(isChangeCorrect(task, 1)).toBe(false);
    expect(isChangeCorrect(task, 3)).toBe(false);
    expect(isChangeCorrect(task, 0)).toBe(false);
  });
});
