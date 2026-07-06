import { describe, expect, it } from "vitest";
import {
  EARN_PER_CLEAN,
  EARN_PER_TASK,
  MAX_SHIFT_TASKS,
  SHIFT_LENGTH,
  SHIFTS_PER_LEVEL,
  businessLevelForShifts,
  earningsForShift,
  generateShift,
  shiftLength,
  starsForShift,
} from "@/data/shift";
import { MAX_BONUS_TASKS } from "@/data/upgrades";

/**
 * Pure shift composition + scoring (S-04). No DOM / Supabase. The same math the
 * server route uses to persist, so these lock the authoritative formulas.
 */

const pickMin = (min: number) => min;
const pickMax = (_min: number, max: number) => max;

describe("shiftLength", () => {
  it("stays in the tier-1 band (5–7) for level 1", () => {
    expect(shiftLength(1, 0, pickMin)).toBe(SHIFT_LENGTH[1].min);
    expect(shiftLength(1, 0, pickMax)).toBe(SHIFT_LENGTH[1].max);
  });
  it("stays in the tier-2 band (8–10) for level 2", () => {
    expect(shiftLength(2, 0, pickMin)).toBe(SHIFT_LENGTH[2].min);
    expect(shiftLength(2, 0, pickMax)).toBe(SHIFT_LENGTH[2].max);
  });
  it("stays in the tier-3 band (9–12) for level 3 (S-08)", () => {
    expect(shiftLength(3, 0, pickMin)).toBe(SHIFT_LENGTH[3].min);
    expect(shiftLength(3, 0, pickMax)).toBe(SHIFT_LENGTH[3].max);
  });
  it("adds the capacity bonus to the base length (S-06)", () => {
    expect(shiftLength(1, 3, pickMax)).toBe(SHIFT_LENGTH[1].max + 3);
    expect(shiftLength(2, 2, pickMin)).toBe(SHIFT_LENGTH[2].min + 2);
  });
  it("clamps the base + bonus total to MAX_SHIFT_TASKS", () => {
    expect(shiftLength(2, MAX_BONUS_TASKS + 5, pickMax)).toBe(MAX_SHIFT_TASKS);
  });
});

describe("generateShift", () => {
  it("produces shiftLength tasks", () => {
    const shift = generateShift(1, 0, pickMin);
    expect(shift).toHaveLength(SHIFT_LENGTH[1].min);
  });
  it("produces base + bonus tasks with a capacity bonus (S-06)", () => {
    expect(generateShift(1, 2, pickMin)).toHaveLength(SHIFT_LENGTH[1].min + 2);
    // Tier 3 is the longest base shift, so it reaches MAX_SHIFT_TASKS with full bonus (S-08).
    expect(generateShift(3, MAX_BONUS_TASKS, pickMax)).toHaveLength(MAX_SHIFT_TASKS);
  });
  it("mixes both task types (never all-one-type)", () => {
    for (let i = 0; i < 20; i++) {
      const types = new Set(generateShift(2).map((t) => t.type));
      expect(types.has("counting")).toBe(true);
      expect(types.has("change_making")).toBe(true);
    }
  });
  it("every task is band-valid for the level", () => {
    for (const task of generateShift(2)) {
      expect(task.difficultyTier).toBe(2);
    }
    for (const task of generateShift(3)) {
      expect(task.difficultyTier).toBe(3);
    }
  });

  it("a tier-3 shift can include a two-stage task, counted as one change_making task (S-08)", () => {
    // Each shift guarantees ≥ 1 change-making task and the default gate emits
    // two-stage at a fixed rate, so P(none across 60 shifts) is ~0.7^60 ≈ 5e-10 —
    // statistically deterministic without threading a picker through the mixer.
    const twoStage = [];
    for (let i = 0; i < 60; i++) {
      for (const task of generateShift(3)) {
        if (task.type === "change_making" && task.scenario === "stock_and_change") {
          twoStage.push(task);
        }
      }
    }
    expect(twoStage.length).toBeGreaterThan(0);
    for (const task of twoStage) {
      // One shift entry, renderable as two stages: stage-1 tray present and valid.
      expect(task.difficultyTier).toBe(3);
      expect(task.stockCount).toBeGreaterThan(task.price);
      expect(task.paid).toBe(task.price + task.change);
    }
  });

  it("tier-1/2 shifts never contain a two-stage task (S-08)", () => {
    for (let i = 0; i < 20; i++) {
      for (const task of [...generateShift(1), ...generateShift(2)]) {
        if (task.type === "change_making") {
          expect(task.scenario).toBe("give_change");
        }
      }
    }
  });
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
