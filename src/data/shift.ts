/**
 * Shift composition + scoring (S-04). Pure and client-safe (mirrors
 * `src/data/counting-tasks.ts`): imported by the client for the results
 * celebration AND by the shift-completion route for the authoritative wallet/level
 * write, so both sides agree by construction. All tunables are named constants —
 * first-guess defaults, adjust after kid-testing.
 */
import type { Task } from "@/types";
import { type DifficultyState, shiftLengthRangeFor } from "@/data/adaptive";
import { generateTask, type TaskType } from "@/data/tasks";

/**
 * Absolute ceiling on tasks in one shift (S-06): the longest base shift plus the
 * most bonus tasks owned upgrades can add — `max(shiftLengthRangeFor(d).max)` over
 * `d ∈ [0,1]`, which is 12 at `d = 1`, plus `MAX_BONUS_TASKS` (5, `src/data/upgrades.ts`).
 *
 * Written out rather than derived on purpose. A derived cap would track a change
 * to the length curve SILENTLY, and the dangerous direction here is the cap
 * getting smaller — see below. A literal plus the sweep in `tests/adaptive.test.ts`
 * (which fails if the curve outgrows this, and also if this drifts above the
 * longest reachable shift) turns that into a loud failure instead.
 *
 * **It must never fall below the longest reachable shift.**
 * `src/pages/api/shifts/complete.ts` returns 400 on any parse failure, and mid-shift
 * state is never persisted (FR-016) — so a child would play a whole shift and lose
 * the entire write (wallet, `completed_shift_count`, `business_level`,
 * `skill_state`, the `shift_log` row and the whole telemetry array), seeing only
 * the gentle error path. `MAX_SHIFT_MISSES` is derived from it at 10×, and gates
 * `misses`, which feeds `skill_state`, which gates upgrades.
 */
export const MAX_SHIFT_TASKS = 17;

/** Wallet earnings per completed task (length term — every task always completes, FR-009). */
export const EARN_PER_TASK = 5;
/** Bonus wallet earnings per task done with zero misses (accuracy term). */
export const EARN_PER_CLEAN = 3;
/** Completed shifts needed to advance one business level. */
export const SHIFTS_PER_LEVEL = 3;

/** Default inclusive picker. Injectable so tests stay deterministic. */
function defaultPick(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * The single `d` that governs shift LENGTH. Length is one number for a shift that
 * mixes both competencies, so it takes the harder of the two: a child who is
 * ready for longer at either kind of task is ready for a longer shift.
 */
export function lengthDifficulty(difficulty: DifficultyState): number {
  return Math.max(difficulty.math, difficulty.money);
}

/**
 * Number of tasks in a shift at difficulty `d` (FR-006 adaptivity). `bonus`
 * (capacity effect from owned upgrades, S-06) lengthens the shift — more practice
 * + more earning via `earningsForShift` — clamped to `MAX_SHIFT_TASKS`.
 *
 * Computed ONCE per shift and then fixed. Five `ShiftScreen` sites and
 * `e2e/helpers/solve-shift.ts` need the total to be known from task 1, so this
 * must never be re-derived mid-shift.
 */
export function shiftLength(
  difficulty: number,
  bonus = 0,
  pick: (min: number, max: number) => number = defaultPick,
): number {
  const { min, max } = shiftLengthRangeFor(difficulty);
  const base = Math.min(max, Math.max(min, Math.round(pick(min, max))));
  return Math.min(base + bonus, MAX_SHIFT_TASKS);
}

/**
 * Build a shift: `shiftLength` tasks mixing counting + change-making, each drawn
 * at ITS OWN competency's difficulty. Guarantees at least one of each type (when
 * length ≥ 2) so the child never gets an all-one-type shift, then fills +
 * shuffles the rest. `bonus` adds capacity-effect tasks (S-06).
 * `pick`/`pickType`/`pickTwoStage` are injectable for deterministic tests, and
 * `pick` is now genuinely forwarded to the leaf generators — it previously
 * stopped at the dispatcher.
 */
export function generateShift(
  difficulty: DifficultyState,
  bonus = 0,
  pick: (min: number, max: number) => number = defaultPick,
  pickType: () => TaskType = () => (Math.random() < 0.5 ? "counting" : "change_making"),
  pickTwoStage?: () => boolean,
): Task[] {
  const n = shiftLength(lengthDifficulty(difficulty), bonus, pick);
  const types: TaskType[] = [];
  if (n >= 2) types.push("counting", "change_making"); // guarantee both appear
  while (types.length < n) types.push(pickType());
  // Fisher–Yates shuffle so the guaranteed pair isn't always first.
  for (let i = types.length - 1; i > 0; i--) {
    const j = pick(0, i);
    [types[i], types[j]] = [types[j], types[i]];
  }
  return types.map((type) => generateTask(difficulty, () => type, pick, pickTwoStage));
}

/** Wallet earnings paid once at shift end (FR-007): base per task + perfect-task bonus. Floor is never zero. */
export function earningsForShift(taskCount: number, cleanCount: number): number {
  return EARN_PER_TASK * taskCount + EARN_PER_CLEAN * cleanCount;
}

/** Stars 0–3 by clean-task rate (FR-011). 3 = a perfect shift (every task first-try correct). */
export function starsForShift(taskCount: number, cleanCount: number): 0 | 1 | 2 | 3 {
  if (taskCount <= 0) return 0;
  const rate = cleanCount / taskCount;
  if (rate >= 1) return 3;
  if (rate >= 0.7) return 2;
  if (rate >= 0.4) return 1;
  return 0;
}

/** Business level from completed-shift count: levels up every `SHIFTS_PER_LEVEL` shifts. */
export function businessLevelForShifts(completedShiftCount: number): number {
  return 1 + Math.floor(completedShiftCount / SHIFTS_PER_LEVEL);
}
