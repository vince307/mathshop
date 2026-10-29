/**
 * Change-making generator + correctness logic (S-03). Pure and client-safe,
 * mirroring `src/data/counting-tasks.ts`. Reuses `SCATTER_MAX` from the counting
 * module so the two task types share one layout threshold, and drives its number
 * bands from the same continuous difficulty scale (`src/data/adaptive.ts`) —
 * `changeCapFor` / `paidMaxFor` replace the old per-tier lookups, reproducing
 * them exactly at the tier anchors.
 */
import type { ChangeMakingScenario, ChangeMakingTask } from "@/types";
import { SCATTER_MAX } from "@/data/counting-tasks";
import { TWO_STAGE_THRESHOLD, changeCapFor, clampDifficulty, clampToBand, paidMaxFor } from "@/data/adaptive";

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

/** Draw from an inclusive range under the shared absolute-safe-bound clamp. */
function pickIn(pick: (min: number, max: number) => number, min: number, max: number): number {
  return clampToBand(pick(min, max), min, max);
}

/**
 * Build a change-making task at difficulty `d`. At or above
 * `TWO_STAGE_THRESHOLD` (S-08) it occasionally delegates to the two-stage
 * `stock_and_change` generator via `pickTwoStage`; below it, always single-stage
 * `give_change`. For `give_change` the change is kept within `changeCapFor(d)`,
 * the price is rolled so `paid = price + change` never exceeds `paidMaxFor(d)`,
 * and the tray offers a few coins more than the change.
 * `pick`/`pickTwoStage` are injectable for deterministic tests — and, from P4,
 * for seeded client-side generation.
 *
 * The scenario gate was `difficultyTier === 3`, which made two-stage
 * *structurally* unreachable below level 3. A threshold makes it reachable by
 * drift, so the guarantee now rests on `ceilingForLevel(2) < TWO_STAGE_THRESHOLD`
 * (asserted in `tests/adaptive.test.ts`) — see the constant's own note.
 */
export function generateChangeMakingTask(
  difficulty: number,
  pick: (min: number, max: number) => number = defaultPick,
  pickTwoStage: () => boolean = defaultPickTwoStage,
): ChangeMakingTask {
  const d = clampDifficulty(difficulty);
  if (d >= TWO_STAGE_THRESHOLD && pickTwoStage()) {
    return generateStockAndChangeTask(d, pick);
  }
  const change = pickIn(pick, 1, changeCapFor(d));
  const price = pickIn(pick, 1, paidMaxFor(d) - change);
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
    difficulty: d,
  };
}

/**
 * Per-stage ceilings for the two-stage `stock_and_change` scenario (S-08).
 * Deliberately below the top single-stage maxima — the difficulty is the two-step
 * structure, not a huge count — so each stage's tray stays comfortably renderable
 * (≤ 18 coins with the extra-tray margin). Fixed, NOT functions of `d`: the
 * scenario's own admission threshold is what scales it, and letting the per-stage
 * numbers grow too would compound two difficulty sources into one task.
 * First-guess, tunable.
 */
export const STOCK_PRICE_MAX = 15;
export const STOCK_CHANGE_MAX = 10;

/**
 * Build a two-stage "stock then sell" task (S-08): stage 1 counts `price` into
 * the register from a tray of `stockCount` (> price), stage 2 gives `change`
 * from `availableCount` (> change), with `paid = price + change`. Reached from
 * `generateChangeMakingTask` once `d >= TWO_STAGE_THRESHOLD`; `pick` is injectable
 * for deterministic tests.
 */
export function generateStockAndChangeTask(
  difficulty: number,
  pick: (min: number, max: number) => number = defaultPick,
): ChangeMakingTask {
  const d = clampDifficulty(difficulty);
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
    stockArrangement: stockCount <= SCATTER_MAX ? "scatter" : "rows_of_5",
    arrangement: availableCount <= SCATTER_MAX ? "scatter" : "rows_of_5",
    difficulty: d,
  };
}

/** Correctness check: the coins the child gives must equal the change owed. */
export function isChangeCorrect(task: ChangeMakingTask, given: number): boolean {
  return given === task.change;
}
