import { describe, expect, it } from "vitest";
import { RETRY_HINT_THRESHOLD, type CountingTask } from "@/types";
import { TIER_ANCHOR, countRangeFor } from "@/data/adaptive";
import { generateCountingTask, isCorrect } from "@/data/counting-tasks";

/**
 * Pure counting-task domain logic (S-02). No Supabase / DOM — locks the
 * high-risk procedural generation + correctness against regression. The count
 * picker is injected so band/clamp behavior is asserted deterministically.
 *
 * The generator now takes the continuous difficulty `d` rather than a starting
 * level, so these exercise the three tier anchors (`d = 0 / 0.5 / 1`), which are
 * calibrated to reproduce the old tier-1/2/3 bands exactly. The scale itself —
 * interpolation between anchors, seeding, the ceiling — is
 * `tests/adaptive.test.ts`; this file stays about the generator.
 */

const D1 = TIER_ANCHOR[1];
const D2 = TIER_ANCHOR[2];
const D3 = TIER_ANCHOR[3];

describe("generateCountingTask", () => {
  it("returns a well-formed count_till coin task", () => {
    const task = generateCountingTask(D1, () => 4);
    expect(task).toMatchObject({ type: "counting", scenario: "count_till", objectType: "coin" });
  });

  it("honors a deterministic picker across the full band at the lowest difficulty", () => {
    const { min, max } = countRangeFor(D1);
    for (let n = min; n <= max; n++) {
      const task = generateCountingTask(D1, () => n);
      expect(task.targetCount).toBe(n);
      expect(task.difficulty).toBe(D1);
    }
  });

  it("picks from the mid band at d = 0.5", () => {
    const task = generateCountingTask(D2, () => countRangeFor(D2).max);
    expect(task.targetCount).toBe(countRangeFor(D2).max);
    expect(task.difficulty).toBe(D2);
  });

  it("picks from the top band at d = 1 (S-08 upper cohort)", () => {
    const task = generateCountingTask(D3, () => countRangeFor(D3).max);
    expect(task.targetCount).toBe(countRangeFor(D3).max);
    expect(task.difficulty).toBe(D3);
  });

  it("honors a deterministic picker across the full top band", () => {
    const { min, max } = countRangeFor(D3);
    for (let n = min; n <= max; n++) {
      expect(generateCountingTask(D3, () => n).targetCount).toBe(n);
    }
  });

  it("clamps a picker that returns below the band min", () => {
    expect(generateCountingTask(D1, () => 0).targetCount).toBe(countRangeFor(D1).min);
  });

  it("clamps a picker that returns above the band max", () => {
    expect(generateCountingTask(D2, () => 999).targetCount).toBe(countRangeFor(D2).max);
    expect(generateCountingTask(D3, () => 999).targetCount).toBe(countRangeFor(D3).max);
  });

  it("respects the pedagogical ceilings (grades 1–2 ≤ 20, upper cohort ≤ 25)", () => {
    // Not tunable, unlike the shift/skill constants: "never exceed ~20 in v1"
    // is the FR-007 band, and 25 is S-08's deliberate widening for age 9.
    expect(generateCountingTask(D2, () => 999).targetCount).toBeLessThanOrEqual(20);
    expect(generateCountingTask(D3, () => 999).targetCount).toBeLessThanOrEqual(25);
  });

  it("scatters counts ≤ 5 and groups larger counts into rows of 5", () => {
    expect(generateCountingTask(D1, () => 5).arrangement).toBe("scatter");
    expect(generateCountingTask(D1, () => 6).arrangement).toBe("rows_of_5");
  });

  it("default picker stays within the band", () => {
    const { min, max } = countRangeFor(D1);
    for (let i = 0; i < 50; i++) {
      const task = generateCountingTask(D1);
      expect(task.targetCount).toBeGreaterThanOrEqual(min);
      expect(task.targetCount).toBeLessThanOrEqual(max);
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
    difficulty: D1,
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
