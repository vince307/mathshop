/**
 * Shift composition + scoring (S-04). Pure and client-safe (mirrors
 * `src/data/counting-tasks.ts`): imported by the client for the results
 * celebration AND by the shift-completion route for the authoritative wallet/level
 * write, so both sides agree by construction. All tunables are named constants —
 * first-guess defaults, adjust after kid-testing.
 */
import type { Task } from "@/types";
import { tierForLevel } from "@/data/counting-tasks";
import { generateTask, type TaskType } from "@/data/tasks";

/** Inclusive task-count band per difficulty tier — the grades 1–2 shift lengths (FR-006). */
export const SHIFT_LENGTH: Record<1 | 2, { min: number; max: number }> = {
  1: { min: 5, max: 7 },
  2: { min: 8, max: 10 },
};

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

/** Number of tasks in a shift for a child at `startingLevel` (FR-006 adaptivity). */
export function shiftLength(startingLevel: number, pick: (min: number, max: number) => number = defaultPick): number {
  const { min, max } = SHIFT_LENGTH[tierForLevel(startingLevel)];
  return Math.min(max, Math.max(min, Math.round(pick(min, max))));
}

/**
 * Build a shift: `shiftLength` tasks mixing counting + change-making. Guarantees
 * at least one of each type (when length ≥ 2) so the child never gets an
 * all-one-type shift, then fills + shuffles the rest. `pick`/`pickType` are
 * injectable for deterministic tests.
 */
export function generateShift(
  startingLevel: number,
  pick: (min: number, max: number) => number = defaultPick,
  pickType: () => TaskType = () => (Math.random() < 0.5 ? "counting" : "change_making"),
): Task[] {
  const n = shiftLength(startingLevel, pick);
  const types: TaskType[] = [];
  if (n >= 2) types.push("counting", "change_making"); // guarantee both appear
  while (types.length < n) types.push(pickType());
  // Fisher–Yates shuffle so the guaranteed pair isn't always first.
  for (let i = types.length - 1; i > 0; i--) {
    const j = pick(0, i);
    [types[i], types[j]] = [types[j], types[i]];
  }
  return types.map((type) => generateTask(startingLevel, () => type));
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
