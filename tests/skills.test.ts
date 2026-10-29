import { describe, expect, it } from "vitest";
import {
  addSkillDelta,
  competencyForTaskType,
  firstTryPercent,
  readSkillState,
  skillLevel,
  skillLevelsFor,
  skillProgress,
  SKILL_THRESHOLDS,
  type SkillState,
} from "@/data/skills";

/**
 * Pure skill-progress core (S-07). No DOM / Supabase. These are the same fns the
 * shift-complete route and the buy route use to fold + read skill state, so they
 * lock the server-authoritative rules — above all monotonicity (spending /
 * attempts never regress a skill).
 */

describe("competencyForTaskType", () => {
  it("maps counting → math and change_making → money", () => {
    expect(competencyForTaskType("counting")).toBe("math");
    expect(competencyForTaskType("change_making")).toBe("money");
  });
});

describe("skillLevel", () => {
  it("is 0 below the first threshold", () => {
    expect(skillLevel(0)).toBe(0);
    expect(skillLevel(SKILL_THRESHOLDS[0] - 1)).toBe(0);
  });
  it("advances one level at each threshold boundary", () => {
    SKILL_THRESHOLDS.forEach((threshold, i) => {
      expect(skillLevel(threshold)).toBe(i + 1); // exactly on the boundary counts
      expect(skillLevel(threshold - 1)).toBe(i); // one below does not
    });
  });
  it("caps at the number of thresholds", () => {
    expect(skillLevel(Number.MAX_SAFE_INTEGER)).toBe(SKILL_THRESHOLDS.length);
  });
});

describe("readSkillState", () => {
  it("normalizes '{}' / null / undefined to a fully-zeroed shape", () => {
    const zero = { firstTryCorrect: 0, completed: 0, misses: 0 };
    for (const input of [undefined, null, {}]) {
      expect(readSkillState(input)).toEqual({ math: zero, money: zero, decisions: zero });
    }
  });
  it("fills missing keys and preserves present ones", () => {
    const state = readSkillState({ math: { firstTryCorrect: 5, completed: 7, misses: 2 } });
    expect(state.math).toEqual({ firstTryCorrect: 5, completed: 7, misses: 2 });
    expect(state.money).toEqual({ firstTryCorrect: 0, completed: 0, misses: 0 });
    expect(state.decisions).toEqual({ firstTryCorrect: 0, completed: 0, misses: 0 });
  });
  it("coerces garbage / negative / partial counters to safe non-negative ints", () => {
    const state = readSkillState({
      math: { firstTryCorrect: -3, completed: 2.9, misses: "x" as unknown as number },
    });
    expect(state.math).toEqual({ firstTryCorrect: 0, completed: 2, misses: 0 });
  });
  it("returns a fresh object (no shared references across calls)", () => {
    const a = readSkillState(null);
    a.math.completed += 1;
    expect(readSkillState(null).math.completed).toBe(0);
  });
});

describe("addSkillDelta", () => {
  const base: SkillState = readSkillState({
    math: { firstTryCorrect: 2, completed: 3, misses: 1 },
    money: { firstTryCorrect: 1, completed: 1, misses: 0 },
  });

  it("adds a per-competency delta field by field", () => {
    const next = addSkillDelta(base, { math: { firstTryCorrect: 1, completed: 2, misses: 4 } });
    expect(next.math).toEqual({ firstTryCorrect: 3, completed: 5, misses: 5 });
    expect(next.money).toEqual({ firstTryCorrect: 1, completed: 1, misses: 0 }); // untouched
  });

  it("accrues the decisions competency (purchase event)", () => {
    const next = addSkillDelta(base, { decisions: { firstTryCorrect: 1, completed: 1, misses: 0 } });
    expect(next.decisions).toEqual({ firstTryCorrect: 1, completed: 1, misses: 0 });
  });

  it("is monotonic — a negative delta never lowers a stored field", () => {
    const next = addSkillDelta(base, { math: { firstTryCorrect: -100, completed: -100, misses: -100 } });
    expect(next.math).toEqual(base.math); // clamped: nothing decreases
  });

  it("does not mutate the input state", () => {
    addSkillDelta(base, { math: { completed: 10 } });
    expect(base.math.completed).toBe(3);
  });
});

describe("skillProgress", () => {
  it("is level 0 at a fresh profile, climbing toward the first threshold", () => {
    expect(skillProgress(0)).toEqual({ level: 0, fraction: 0, atMax: false });
    // halfway to the first threshold
    const half = SKILL_THRESHOLDS[0] / 2;
    expect(skillProgress(half).fraction).toBeCloseTo(0.5);
  });
  it("resets the fraction to 0 right at a threshold boundary", () => {
    expect(skillProgress(SKILL_THRESHOLDS[0])).toEqual({ level: 1, fraction: 0, atMax: false });
  });
  it("is full + atMax at the top of the ladder", () => {
    const top = SKILL_THRESHOLDS[SKILL_THRESHOLDS.length - 1];
    expect(skillProgress(top)).toEqual({ level: SKILL_THRESHOLDS.length, fraction: 1, atMax: true });
    expect(skillProgress(top + 100)).toEqual({ level: SKILL_THRESHOLDS.length, fraction: 1, atMax: true });
  });
});

describe("skillLevelsFor", () => {
  it("derives each competency's level from its first-try count", () => {
    const state = readSkillState({
      math: { firstTryCorrect: SKILL_THRESHOLDS[1], completed: 0, misses: 0 },
      money: { firstTryCorrect: SKILL_THRESHOLDS[0], completed: 0, misses: 0 },
    });
    const levels = skillLevelsFor(state);
    expect(levels.math).toBe(2);
    expect(levels.money).toBe(1);
    expect(levels.decisions).toBe(0);
  });
});

/**
 * The parent report's first-try share (FR-016). Two traps live here: the
 * `decisions` inflation (a purchase is 100 % correct by construction) and the
 * `0/0 → NaN%` render.
 */
describe("firstTryPercent", () => {
  it("ignores decisions so shopping cannot inflate the number", () => {
    const state = readSkillState({
      math: { firstTryCorrect: 5, completed: 10 },
      decisions: { firstTryCorrect: 5, completed: 5 },
    });
    // 5/10 over math+money = 50. Folding decisions back in would give 10/15 = 67.
    expect(firstTryPercent(state)).toBe(50);
  });

  it("returns null, not 100, for a week of purchases and no tasks", () => {
    const state = readSkillState({ decisions: { firstTryCorrect: 7, completed: 7 } });
    expect(firstTryPercent(state)).toBeNull();
  });

  it("returns null for an all-zero state — never NaN, never a shaming 0", () => {
    const result = firstTryPercent(readSkillState(null));
    expect(result).toBeNull();
    expect(Number.isNaN(result)).toBe(false);
  });

  it("stays finite for a denormalised state cast to SkillState", () => {
    const denormalised = {
      math: { firstTryCorrect: undefined, completed: Number.NaN, misses: 0 },
      money: { firstTryCorrect: -4, completed: -9, misses: 0 },
      decisions: { firstTryCorrect: 3, completed: 3, misses: 0 },
    } as unknown as SkillState;
    const result = firstTryPercent(denormalised);
    expect(result).toBeNull();
    expect(Number.isNaN(result)).toBe(false);
  });

  it("sums math and money together rather than averaging them", () => {
    const state = readSkillState({
      math: { firstTryCorrect: 3, completed: 4 },
      money: { firstTryCorrect: 1, completed: 4 },
    });
    // Summed: 4/8 = 50. Averaged it would be (75 + 25) / 2 = 50 too, so make the
    // populations uneven to tell them apart.
    expect(state.math.completed + state.money.completed).toBe(8);
    const uneven = readSkillState({
      math: { firstTryCorrect: 6, completed: 6 },
      money: { firstTryCorrect: 0, completed: 2 },
    });
    // Summed: 6/8 = 75. Averaged: (100 + 0) / 2 = 50.
    expect(firstTryPercent(uneven)).toBe(75);
  });

  it("rounds to the nearest integer and stays within 0-100", () => {
    const state = readSkillState({ math: { firstTryCorrect: 1, completed: 3 } });
    expect(firstTryPercent(state)).toBe(33);
    const perfect = readSkillState({ money: { firstTryCorrect: 9, completed: 9 } });
    expect(firstTryPercent(perfect)).toBe(100);
    const none = readSkillState({ money: { firstTryCorrect: 0, completed: 5 } });
    expect(firstTryPercent(none)).toBe(0);
  });
});
