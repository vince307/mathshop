import { describe, expect, it } from "vitest";
import {
  COIN_PER_CLEAN,
  COIN_PER_TASK,
  SHIFT_LENGTH,
  SHIFTS_PER_LEVEL,
  businessLevelForShifts,
  coinsForShift,
  generateShift,
  shiftLength,
  starsForShift,
} from "@/data/shift";

/**
 * Pure shift composition + scoring (S-04). No DOM / Supabase. The same math the
 * server route uses to persist, so these lock the authoritative formulas.
 */

const pickMin = (min: number) => min;
const pickMax = (_min: number, max: number) => max;

describe("shiftLength", () => {
  it("stays in the tier-1 band (5–7) for level 1", () => {
    expect(shiftLength(1, pickMin)).toBe(SHIFT_LENGTH[1].min);
    expect(shiftLength(1, pickMax)).toBe(SHIFT_LENGTH[1].max);
  });
  it("stays in the tier-2 band (8–10) for level 2", () => {
    expect(shiftLength(2, pickMin)).toBe(SHIFT_LENGTH[2].min);
    expect(shiftLength(2, pickMax)).toBe(SHIFT_LENGTH[2].max);
  });
});

describe("generateShift", () => {
  it("produces shiftLength tasks", () => {
    const shift = generateShift(1, pickMin);
    expect(shift).toHaveLength(SHIFT_LENGTH[1].min);
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
  });
});

describe("coinsForShift", () => {
  it("pays base per task + bonus per clean task", () => {
    expect(coinsForShift(6, 6)).toBe(COIN_PER_TASK * 6 + COIN_PER_CLEAN * 6); // 48
    expect(coinsForShift(5, 1)).toBe(COIN_PER_TASK * 5 + COIN_PER_CLEAN * 1); // 28
    expect(coinsForShift(9, 9)).toBe(72);
  });
  it("never pays zero — the floor is base * tasks", () => {
    expect(coinsForShift(5, 0)).toBe(COIN_PER_TASK * 5); // 25
    expect(coinsForShift(5, 0)).toBeGreaterThan(0);
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
