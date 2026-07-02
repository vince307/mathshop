import { describe, expect, it } from "vitest";
import {
  addSkillDelta,
  competencyForTaskType,
  readSkillState,
  skillLevel,
  skillLevelsFor,
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
