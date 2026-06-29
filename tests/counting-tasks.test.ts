import { describe, expect, it } from "vitest";
import { RETRY_HINT_THRESHOLD, type CountingTask } from "@/types";
import { COUNT_RANGE, generateCountingTask, isCorrect, tierForLevel } from "@/data/counting-tasks";

/**
 * Pure counting-task domain logic (S-02). No Supabase / DOM — locks the
 * high-risk procedural generation + correctness against regression. The count
 * picker is injected so band/clamp behavior is asserted deterministically.
 */

describe("tierForLevel", () => {
  it("maps starting level 1 → tier 1, level 2 → tier 2", () => {
    expect(tierForLevel(1)).toBe(1);
    expect(tierForLevel(2)).toBe(2);
  });

  it("clamps out-of-range levels into the band", () => {
    expect(tierForLevel(0)).toBe(1);
    expect(tierForLevel(-3)).toBe(1);
    expect(tierForLevel(5)).toBe(2);
  });
});

describe("generateCountingTask", () => {
  it("returns a well-formed count_till coin task", () => {
    const task = generateCountingTask(1, () => 4);
    expect(task).toMatchObject({ type: "counting", scenario: "count_till", objectType: "coin" });
  });

  it("honors a deterministic picker across the full tier-1 band", () => {
    const { min, max } = COUNT_RANGE[1];
    for (let n = min; n <= max; n++) {
      const task = generateCountingTask(1, () => n);
      expect(task.targetCount).toBe(n);
      expect(task.difficultyTier).toBe(1);
    }
  });

  it("picks from the tier-2 band for level 2", () => {
    const task = generateCountingTask(2, () => COUNT_RANGE[2].max);
    expect(task.targetCount).toBe(COUNT_RANGE[2].max);
    expect(task.difficultyTier).toBe(2);
  });

  it("clamps a picker that returns below the tier min", () => {
    expect(generateCountingTask(1, () => 0).targetCount).toBe(COUNT_RANGE[1].min);
  });

  it("clamps a picker that returns above the tier max", () => {
    expect(generateCountingTask(2, () => 999).targetCount).toBe(COUNT_RANGE[2].max);
  });

  it("never exceeds 20 — the grades 1–2 band ceiling", () => {
    expect(generateCountingTask(2, () => 999).targetCount).toBeLessThanOrEqual(20);
  });

  it("scatters counts ≤ 5 and groups larger counts into rows of 5", () => {
    expect(generateCountingTask(1, () => 5).arrangement).toBe("scatter");
    expect(generateCountingTask(1, () => 6).arrangement).toBe("rows_of_5");
  });

  it("default picker stays within the tier band", () => {
    for (let i = 0; i < 50; i++) {
      const task = generateCountingTask(1);
      expect(task.targetCount).toBeGreaterThanOrEqual(COUNT_RANGE[1].min);
      expect(task.targetCount).toBeLessThanOrEqual(COUNT_RANGE[1].max);
    }
  });
});

describe("isCorrect", () => {
  const task: CountingTask = {
    type: "counting",
    scenario: "count_till",
    objectType: "coin",
    targetCount: 7,
    arrangement: "rows_of_5",
    difficultyTier: 1,
  };

  it("is true only on an exact tally match", () => {
    expect(isCorrect(task, 7)).toBe(true);
    expect(isCorrect(task, 6)).toBe(false);
    expect(isCorrect(task, 8)).toBe(false);
    expect(isCorrect(task, 0)).toBe(false);
  });
});

describe("RETRY_HINT_THRESHOLD", () => {
  it("surfaces the hint after 1–2 misses (FR-009)", () => {
    expect(RETRY_HINT_THRESHOLD).toBe(2);
  });
});
