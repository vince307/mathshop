/**
 * Change-making generator + correctness logic (S-03). Pure and client-safe,
 * mirroring `src/data/counting-tasks.ts`. Reuses `tierForLevel` + `SCATTER_MAX`
 * from the counting module so the two task types share one level→tier mapping
 * and one layout threshold.
 */
import type { ChangeMakingScenario, ChangeMakingTask } from "@/types";
import { SCATTER_MAX, tierForLevel } from "@/data/counting-tasks";

/**
 * Max change (paid − price) per tier — kept small so the child taps a manageable
 * number of coins. Tiers 1–2 are grades 1–2; tier 3 (S-08) widens the upper
 * cohort to ≤ 15. Strictly below the paid ceiling so a valid price (≥ 1) always
 * exists. First-guess, tunable.
 */
export const CHANGE_CAP: Record<1 | 2 | 3, number> = { 1: 5, 2: 10, 3: 15 };

/** Ceiling for the amount paid per tier. Tiers 1–2 = grades 1–2 (≤ 20); tier 3 (S-08) ≤ 30. */
export const PAID_MAX: Record<1 | 2 | 3, number> = { 1: 10, 2: 20, 3: 30 };

/** Coins offered beyond the change, so the child must stop at the right number. */
const EXTRA_TRAY_MIN = 1;
const EXTRA_TRAY_MAX = 3;
/** Hard cap on tray size so the coins stay tappable in a `max-w-md` grid. */
const TRAY_CAP = 20;

/** Default inclusive picker. Injectable so tests stay deterministic. */
function defaultPick(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Clamp a picked value into an inclusive range and round it. */
function pickIn(pick: (min: number, max: number) => number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(pick(min, max))));
}

/**
 * Build a concrete `give_change` task for a child at `startingLevel`. The change
 * is kept within the tier cap, the price is rolled so `paid = price + change`
 * never exceeds the band ceiling, and the tray offers a few coins more than the
 * change. `pick` is injectable for deterministic tests.
 */
export function generateChangeMakingTask(
  startingLevel: number,
  pick: (min: number, max: number) => number = defaultPick,
): ChangeMakingTask {
  const difficultyTier = tierForLevel(startingLevel);
  const change = pickIn(pick, 1, CHANGE_CAP[difficultyTier]);
  const price = pickIn(pick, 1, PAID_MAX[difficultyTier] - change);
  const paid = price + change;
  const availableCount = Math.min(TRAY_CAP, change + pickIn(pick, EXTRA_TRAY_MIN, EXTRA_TRAY_MAX));
  const scenario: ChangeMakingScenario = "give_change";
  return {
    type: "change_making",
    scenario,
    objectType: "coin",
    paid,
    price,
    change,
    availableCount,
    arrangement: availableCount <= SCATTER_MAX ? "scatter" : "rows_of_5",
    difficultyTier,
  };
}

/** Correctness check: the coins the child gives must equal the change owed. */
export function isChangeCorrect(task: ChangeMakingTask, given: number): boolean {
  return given === task.change;
}
