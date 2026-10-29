/**
 * Counting-task generator + correctness logic (S-02). Pure and client-safe
 * (mirrors `src/data/leveling.ts`) so the `/app/task` SSR loader and the
 * counting island share one source of truth. The reusable contract S-03 /
 * S-04 build on: `generate → render → answer → isCorrect`.
 *
 * The count band is now a function of the continuous difficulty `d`
 * (`src/data/adaptive.ts`) rather than a three-tier lookup — `d = 0` reproduces
 * the old tier-1 band exactly, so this is a rewrite of *where the numbers come
 * from*, not of what they are.
 */
import type { CountingScenario, CountingTask } from "@/types";
import { clampDifficulty, clampToBand, countRangeFor } from "@/data/adaptive";

/** Count at/below which objects are scattered; above it they group into rows of 5 (subitizing aid). Shared with the change-making generator. */
export const SCATTER_MAX = 5;

/** Default count picker — inclusive on both ends. Injectable so tests stay deterministic. */
function defaultPickCount(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Build a concrete `count_till` task at difficulty `d`. The count is drawn within
 * the band `countRangeFor(d)` and clamped, so callers can't produce an
 * out-of-band task however the picker misbehaves. `pickCount` is injectable for
 * deterministic tests — and, from P4, for seeded client-side generation.
 */
export function generateCountingTask(
  difficulty: number,
  pickCount: (min: number, max: number) => number = defaultPickCount,
): CountingTask {
  const d = clampDifficulty(difficulty);
  const { min, max } = countRangeFor(d);
  const targetCount = clampToBand(pickCount(min, max), min, max);
  const scenario: CountingScenario = "count_till";
  return {
    type: "counting",
    scenario,
    objectType: "coin",
    targetCount,
    arrangement: targetCount <= SCATTER_MAX ? "scatter" : "rows_of_5",
    difficulty: d,
  };
}

/** Correctness check: the child's tally must equal the number of objects shown. */
export function isCorrect(task: CountingTask, tally: number): boolean {
  return tally === task.targetCount;
}
