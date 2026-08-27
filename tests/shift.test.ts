import { describe, expect, it } from "vitest";
import {
  EARN_PER_CLEAN,
  EARN_PER_TASK,
  MAX_SHIFT_TASKS,
  SHIFTS_PER_LEVEL,
  businessLevelForShifts,
  earningsForShift,
  generateShift,
  lengthDifficulty,
  profitForShift,
  shiftLength,
  starsForShift,
} from "@/data/shift";
import { UPGRADES, shopEffects } from "@/data/upgrades";
import { STOCK_AND_CHANGE_RATE } from "@/data/change-making-tasks";
import {
  TIER_ANCHOR,
  TWO_STAGE_THRESHOLD,
  countRangeFor,
  type DifficultyState,
  shiftLengthRangeFor,
} from "@/data/adaptive";
import { MAX_BONUS_TASKS } from "@/data/upgrades";

/**
 * Pure shift composition + scoring (S-04). No DOM / Supabase. The same math the
 * server route uses to persist, so these lock the authoritative formulas.
 *
 * Composition now runs off the continuous difficulty (`d = 0 / 0.5 / 1` are the
 * tier anchors, calibrated to reproduce the old per-tier shift lengths exactly);
 * the scale itself is `tests/adaptive.test.ts`.
 */

const pickMin = (min: number) => min;
const pickMax = (_min: number, max: number) => max;

const D1 = TIER_ANCHOR[1];
const D2 = TIER_ANCHOR[2];
const D3 = TIER_ANCHOR[3];
/** Both competencies at the same difficulty — the shape a freshly-seeded profile has. */
const uniform = (d: number): DifficultyState => ({ math: d, money: d });

describe("shiftLength", () => {
  it("stays in the 5–7 band at d = 0", () => {
    expect(shiftLength(D1, 0, pickMin)).toBe(5);
    expect(shiftLength(D1, 0, pickMax)).toBe(7);
  });
  it("stays in the 8–10 band at d = 0.5", () => {
    expect(shiftLength(D2, 0, pickMin)).toBe(8);
    expect(shiftLength(D2, 0, pickMax)).toBe(10);
  });
  it("stays in the 9–12 band at d = 1 (S-08)", () => {
    expect(shiftLength(D3, 0, pickMin)).toBe(9);
    expect(shiftLength(D3, 0, pickMax)).toBe(12);
  });
  it("adds the capacity bonus to the base length (S-06)", () => {
    expect(shiftLength(D1, 3, pickMax)).toBe(shiftLengthRangeFor(D1).max + 3);
    expect(shiftLength(D2, 2, pickMin)).toBe(shiftLengthRangeFor(D2).min + 2);
  });
  it("clamps the base + bonus total to MAX_SHIFT_TASKS", () => {
    expect(shiftLength(D2, MAX_BONUS_TASKS + 5, pickMax)).toBe(MAX_SHIFT_TASKS);
  });
});

describe("lengthDifficulty", () => {
  it("takes the harder competency — ready for longer at either kind means a longer shift", () => {
    expect(lengthDifficulty({ math: 0.2, money: 0.6 })).toBe(0.6);
    expect(lengthDifficulty({ math: 0.6, money: 0.2 })).toBe(0.6);
    expect(lengthDifficulty(uniform(0.4))).toBe(0.4);
  });
});

describe("generateShift", () => {
  it("produces shiftLength tasks", () => {
    expect(generateShift(uniform(D1), 0, pickMin)).toHaveLength(shiftLengthRangeFor(D1).min);
  });
  it("produces base + bonus tasks with a capacity bonus (S-06)", () => {
    expect(generateShift(uniform(D1), 2, pickMin)).toHaveLength(shiftLengthRangeFor(D1).min + 2);
    // d = 1 is the longest base shift, so it reaches MAX_SHIFT_TASKS with full bonus (S-08).
    expect(generateShift(uniform(D3), MAX_BONUS_TASKS, pickMax)).toHaveLength(MAX_SHIFT_TASKS);
  });
  it("mixes both task types (never all-one-type)", () => {
    for (let i = 0; i < 20; i++) {
      const types = new Set(generateShift(uniform(D2)).map((t) => t.type));
      expect(types.has("counting")).toBe(true);
      expect(types.has("change_making")).toBe(true);
    }
  });

  it("still mixes both types under the HARDEST weak-competency bias (P5)", () => {
    // The bias caps at MAX_TYPE_SHARE, but the both-types guarantee does not rest
    // on the cap — `drawTypes` seeds one of each before it fills. Asserted at the
    // most lopsided profile in both directions, because a bias that could starve
    // a competency entirely would also stop it ever recovering: a child would
    // never again be measured on the skill they had been doing well at.
    for (const lopsided of [
      { math: D1, money: D2 },
      { math: D2, money: D1 },
    ] satisfies DifficultyState[]) {
      for (let i = 0; i < 30; i++) {
        const types = new Set(generateShift(lopsided).map((t) => t.type));
        expect(types.has("counting")).toBe(true);
        expect(types.has("change_making")).toBe(true);
      }
    }
  });
  it("every task carries the difficulty it was generated at", () => {
    for (const task of generateShift(uniform(D2))) {
      expect(task.difficulty).toBe(D2);
    }
    for (const task of generateShift(uniform(D3))) {
      expect(task.difficulty).toBe(D3);
    }
  });
  it("gives each task ITS OWN competency's difficulty (counting → math, change → money)", () => {
    // The whole point of holding `d` per competency: a child strong at counting
    // and weak at giving change must get each at its own level within one shift.
    const split: DifficultyState = { math: D1, money: D2 };
    for (const task of generateShift(split, 0, pickMin)) {
      expect(task.difficulty).toBe(task.type === "counting" ? D1 : D2);
    }
  });
  it("forwards its picker all the way to the leaf generators", () => {
    // Until P3 the dispatcher called the generators with NO picker, so this
    // injection chain was broken at `src/data/tasks.ts` and seeded generation was
    // impossible. A min picker must now floor every task's numbers.
    for (const task of generateShift(uniform(D2), 0, pickMin)) {
      if (task.type === "counting") {
        expect(task.targetCount).toBe(countRangeFor(D2).min);
      } else {
        expect(task.change).toBe(1);
        expect(task.price).toBe(1);
        expect(task.paid).toBe(2);
      }
    }
  });

  it("a shift above the two-stage threshold can include one, counted as a single change_making task (S-08)", () => {
    // Each shift guarantees ≥ 1 change-making task and the default gate emits
    // two-stage at STOCK_AND_CHANGE_RATE, so the chance that NO shift in 60 draws
    // produces one is at most (1 − rate)^60 ≈ 0.7^60 ≈ 5e-10 — statistically
    // deterministic without threading a picker through the mixer. (An upper bound:
    // a shift often holds several change-making tasks, each rolling the gate.)
    expect(D3).toBeGreaterThanOrEqual(TWO_STAGE_THRESHOLD);
    expect((1 - STOCK_AND_CHANGE_RATE) ** 60).toBeLessThan(1e-6);
    const twoStage = [];
    for (let i = 0; i < 60; i++) {
      for (const task of generateShift(uniform(D3))) {
        if (task.type === "change_making" && task.scenario === "stock_and_change") {
          twoStage.push(task);
        }
      }
    }
    expect(twoStage.length).toBeGreaterThan(0);
    for (const task of twoStage) {
      // One shift entry, renderable as two stages: stage-1 tray present and valid.
      expect(task.difficulty).toBe(D3);
      expect(task.stockCount).toBeGreaterThan(task.price);
      expect(task.paid).toBe(task.price + task.change);
    }
  });

  // The "shifts below the threshold never contain a two-stage task" guarantee used
  // to be asserted here against levels 1–2. Levels no longer reach the generator, so
  // it is proved over the whole reachable range of `d` — and through this same
  // mixer — in `tests/adaptive.test.ts` ("scenario admission — the two-stage
  // guarantee"), which is the only place that can also assert the
  // `ceilingForLevel(2) < TWO_STAGE_THRESHOLD` ordering the guarantee now rests on.
});

describe("earningsForShift", () => {
  it("pays base per task + bonus per clean task", () => {
    expect(earningsForShift(6, 6)).toBe(EARN_PER_TASK * 6 + EARN_PER_CLEAN * 6); // 48
    expect(earningsForShift(5, 1)).toBe(EARN_PER_TASK * 5 + EARN_PER_CLEAN * 1); // 28
    expect(earningsForShift(9, 9)).toBe(72);
  });
  it("never pays zero — the floor is base * tasks", () => {
    expect(earningsForShift(5, 0)).toBe(EARN_PER_TASK * 5); // 25
    expect(earningsForShift(5, 0)).toBeGreaterThan(0);
  });
});

describe("profitForShift", () => {
  const NO_SHOP = shopEffects([]);

  it("equals revenue minus cost at margin 1 — the profit rule's base case", () => {
    const owned = ["shelf", "register"];
    const effects = shopEffects(owned);
    const { revenue, cost, profit } = profitForShift(6, 6, effects);
    expect(revenue).toBe(earningsForShift(6, 6));
    expect(cost).toBe(effects.runningCost);
    expect(profit).toBe(earningsForShift(6, 6) - effects.runningCost);
  });

  it("pays revenue outright when nothing with a running cost is owned", () => {
    expect(profitForShift(6, 6, NO_SHOP)).toEqual({
      revenue: earningsForShift(6, 6),
      cost: 0,
      profit: earningsForShift(6, 6),
    });
  });

  it("`sign` is free to run — the whole catalogue's cost still lands on what EARNS", () => {
    expect(shopEffects(["sign"]).runningCost).toBe(0);
    expect(profitForShift(5, 4, shopEffects(["sign"]))).toEqual(profitForShift(5, 4, NO_SHOP));
  });

  /**
   * FR-008's floor, expressed at the formula: a shop whose running cost outruns a
   * bad shift pays NOTHING — it never takes anything away. `max(0, …)` is what
   * makes `wallet += profit` safe to write, so this case is the one that licenses
   * the wallet update in `recordShiftResult`.
   */
  it("clamps at zero on the degenerate shift — never negative, whatever is owned", () => {
    const everything = UPGRADES.map((u) => u.id);
    const { revenue, cost, profit } = profitForShift(1, 0, shopEffects(everything));
    expect(cost).toBeGreaterThan(revenue);
    expect(profit).toBe(0);
  });

  it("never returns a negative profit, over every subset of the catalogue and a degenerate shift", () => {
    const ids = UPGRADES.map((u) => u.id);
    for (let mask = 0; mask < 1 << ids.length; mask++) {
      const owned = ids.filter((_, i) => (mask & (1 << i)) !== 0);
      expect(profitForShift(1, 0, shopEffects(owned)).profit).toBeGreaterThanOrEqual(0);
    }
  });

  it("rounds the per-UNIT rate, not the total — margins stay whole zloty per task", () => {
    // A 1.5× accuracy margin on a 3 zl clean bonus is 5 zl per clean task (round(4.5)),
    // never 4.5 × cleanCount rounded once at the end. The difference is visible at
    // any even cleanCount, and the per-unit form is what keeps the number legible.
    const margin = { bonusTasks: 0, quantityMargin: 1, accuracyMargin: 1.5, runningCost: 0 };
    expect(profitForShift(4, 4, margin).revenue).toBe(EARN_PER_TASK * 4 + Math.round(EARN_PER_CLEAN * 1.5) * 4);
    expect(profitForShift(4, 4, margin).revenue).not.toBe(Math.round(EARN_PER_TASK * 4 + EARN_PER_CLEAN * 1.5 * 4));
  });
});

describe("starsForShift", () => {
  it("3 stars only for a perfect shift", () => {
    expect(starsForShift(6, 6)).toBe(3);
    expect(starsForShift(6, 5)).toBe(2);
  });
  it("maps clean-task rate to 2/1/0 at the 70%/40% boundaries", () => {
    expect(starsForShift(10, 7)).toBe(2); // 70%
    expect(starsForShift(10, 6)).toBe(1); // 60%
    expect(starsForShift(10, 4)).toBe(1); // 40%
    expect(starsForShift(10, 3)).toBe(0); // 30%
    expect(starsForShift(10, 0)).toBe(0);
  });
});

describe("businessLevelForShifts", () => {
  it("starts at level 1 and levels up every SHIFTS_PER_LEVEL shifts", () => {
    expect(businessLevelForShifts(0)).toBe(1);
    expect(businessLevelForShifts(SHIFTS_PER_LEVEL - 1)).toBe(1);
    expect(businessLevelForShifts(SHIFTS_PER_LEVEL)).toBe(2);
    expect(businessLevelForShifts(SHIFTS_PER_LEVEL * 2)).toBe(3);
  });
});
