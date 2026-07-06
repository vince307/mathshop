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

/**
 * Chance that a tier-3 change-making task is the two-stage `stock_and_change`
 * scenario instead of single-stage `give_change` (S-08 "occasional" clause).
 * First-guess, tunable after kid-testing.
 */
export const STOCK_AND_CHANGE_RATE = 0.3;

/** Default inclusive picker. Injectable so tests stay deterministic. */
function defaultPick(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Default two-stage scenario gate. Injectable so tests stay deterministic. */
function defaultPickTwoStage(): boolean {
  return Math.random() < STOCK_AND_CHANGE_RATE;
}

/** Clamp a picked value into an inclusive range and round it. */
function pickIn(pick: (min: number, max: number) => number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(pick(min, max))));
}

/**
 * Build a change-making task for a child at `startingLevel`. Tier 3 (S-08)
 * occasionally delegates to the two-stage `stock_and_change` generator via
 * `pickTwoStage`; tiers 1–2 always get single-stage `give_change`. For
 * `give_change` the change is kept within the tier cap, the price is rolled so
 * `paid = price + change` never exceeds the band ceiling, and the tray offers a
 * few coins more than the change. `pick`/`pickTwoStage` are injectable for
 * deterministic tests.
 */
export function generateChangeMakingTask(
  startingLevel: number,
  pick: (min: number, max: number) => number = defaultPick,
  pickTwoStage: () => boolean = defaultPickTwoStage,
): ChangeMakingTask {
  const difficultyTier = tierForLevel(startingLevel);
  if (difficultyTier === 3 && pickTwoStage()) {
    return generateStockAndChangeTask(startingLevel, pick);
  }
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

/**
 * Per-stage ceilings for the two-stage `stock_and_change` scenario (S-08).
 * Deliberately below the tier-3 single-stage maxima — the difficulty is the
 * two-step structure, not a huge count — so each stage's tray stays comfortably
 * renderable (≤ 18 coins with the extra-tray margin). First-guess, tunable.
 */
export const STOCK_PRICE_MAX = 15;
export const STOCK_CHANGE_MAX = 10;

/**
 * Build a two-stage "stock then sell" task (S-08): stage 1 counts `price` into
 * the register from a tray of `stockCount` (> price), stage 2 gives `change`
 * from `availableCount` (> change), with `paid = price + change`. Standalone in
 * Phase 2 — not reachable from the shift mixer until the Phase 3 turn-on.
 * `pick` is injectable for deterministic tests.
 */
export function generateStockAndChangeTask(
  startingLevel: number,
  pick: (min: number, max: number) => number = defaultPick,
): ChangeMakingTask {
  const difficultyTier = tierForLevel(startingLevel);
  const price = pickIn(pick, 1, STOCK_PRICE_MAX);
  const stockCount = Math.min(TRAY_CAP, price + pickIn(pick, EXTRA_TRAY_MIN, EXTRA_TRAY_MAX));
  const change = pickIn(pick, 1, STOCK_CHANGE_MAX);
  const paid = price + change;
  const availableCount = Math.min(TRAY_CAP, change + pickIn(pick, EXTRA_TRAY_MIN, EXTRA_TRAY_MAX));
  const scenario: ChangeMakingScenario = "stock_and_change";
  return {
    type: "change_making",
    scenario,
    objectType: "coin",
    paid,
    price,
    change,
    availableCount,
    stockCount,
    arrangement: availableCount <= SCATTER_MAX ? "scatter" : "rows_of_5",
    difficultyTier,
  };
}

/** Correctness check: the coins the child gives must equal the change owed. */
export function isChangeCorrect(task: ChangeMakingTask, given: number): boolean {
  return given === task.change;
}
