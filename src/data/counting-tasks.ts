/**
 * Counting-task generator + correctness logic (S-02). Pure and client-safe
 * (mirrors `src/data/leveling.ts`) so the `/app/task` SSR loader and the
 * counting island share one source of truth. The reusable contract S-03 /
 * S-04 build on: `generate → render → answer → isCorrect`.
 */
import type { CountingScenario, CountingTask } from "@/types";

/**
 * Inclusive count range per difficulty tier — the grades 1–2 band (FR-007).
 * Tier ceilings never exceed 20: counting stays in the v1 difficulty band.
 */
export const COUNT_RANGE: Record<1 | 2, { min: number; max: number }> = {
  1: { min: 3, max: 10 },
  2: { min: 6, max: 20 },
};

/** Count at/below which objects are scattered; above it they group into rows of 5 (subitizing aid). */
const SCATTER_MAX = 5;

/**
 * Map a profile's stored `starting_level` (1|2 today, see `deriveStartingLevel`)
 * to a counting tier. Out-of-range values clamp into the band so generation can
 * never produce an out-of-band count.
 */
export function tierForLevel(startingLevel: number): 1 | 2 {
  return startingLevel >= 2 ? 2 : 1;
}

/** Default count picker — inclusive on both ends. Injectable so tests stay deterministic. */
function defaultPickCount(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Build a concrete `count_till` task for a child at `startingLevel`. The count
 * is drawn within the tier's band and clamped, so callers can't produce an
 * out-of-band task. `pickCount` is injectable for deterministic tests.
 */
export function generateCountingTask(
  startingLevel: number,
  pickCount: (min: number, max: number) => number = defaultPickCount,
): CountingTask {
  const difficultyTier = tierForLevel(startingLevel);
  const { min, max } = COUNT_RANGE[difficultyTier];
  const targetCount = Math.min(max, Math.max(min, Math.round(pickCount(min, max))));
  const scenario: CountingScenario = "count_till";
  return {
    type: "counting",
    scenario,
    objectType: "coin",
    targetCount,
    arrangement: targetCount <= SCATTER_MAX ? "scatter" : "rows_of_5",
    difficultyTier,
  };
}

/** Correctness check: the child's tally must equal the number of objects shown. */
export function isCorrect(task: CountingTask, tally: number): boolean {
  return tally === task.targetCount;
}
