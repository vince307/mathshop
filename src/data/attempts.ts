/**
 * Per-task telemetry records (adaptive-task-engine P1). Pure and client-safe
 * (mirrors `src/data/skills.ts` / `src/data/shift.ts`): imported by the client to
 * BUILD the array AND by the shift-completion route to VALIDATE it, so both sides
 * agree on the shape by construction rather than by two hand-kept copies.
 *
 * Field names are snake_case because a record maps 1:1 onto a `task_attempt`
 * column. Keeping the wire shape identical to the table shape means the write
 * path never re-maps, so a column and its payload field cannot silently drift.
 */
import type { Task } from "@/types";
import type { TaskType } from "@/data/tasks";
import { competencyForTaskType, type Competency } from "@/data/skills";
import type { TaskOutcome } from "@/components/hooks/useCoinTask";

/** One task's telemetry row, as sent by the client and stored by the server. */
export interface TaskAttempt {
  /** 0-based position within the shift. Positional: the adaptation guards are. */
  shift_index: number;
  task_type: TaskType;
  scenario: string;
  competency: Competency;
  /**
   * The continuous difficulty `d ∈ [0,1]` the task was generated at. Nullable for
   * the P1/P2 rows written before the scale existed — see `attemptDifficulty`.
   * **Telemetry only**: from P5 the server recomputes the persisted `d` from the
   * reported outcomes and never trusts this number.
   */
  difficulty: number | null;
  /** The generated numbers, keyed as the generator names them. */
  params: Record<string, number>;
  first_try: boolean;
  misses: number;
  duration_ms: number;
}

/**
 * The generated numbers for a task, as `task_attempt.params`. Only generator
 * OUTPUT belongs here — not layout hints (`arrangement`) or the discriminants
 * already stored in their own columns, which would be dead weight in the jsonb.
 */
export function attemptParams(task: Task): Record<string, number> {
  if (task.type === "counting") return { targetCount: task.targetCount };
  const params: Record<string, number> = {
    paid: task.paid,
    price: task.price,
    change: task.change,
    availableCount: task.availableCount,
  };
  // Two-stage only; absent for single-stage `give_change`.
  if (task.stockCount !== undefined) params.stockCount = task.stockCount;
  return params;
}

/**
 * Difficulty to record for a task: the continuous `d` it was generated at (P3).
 *
 * It was deliberately `null` in P1/P2, because recording a normalised tier before
 * the continuous scale existed would have put two incomparable quantities in one
 * column of the very table whose purpose is tuning the model. Rows from those
 * phases keep their `null`, which is why the column and this return type stay
 * nullable: **null means "not measured", not "zero"** — and zero is a real,
 * meaningful difficulty.
 */
export function attemptDifficulty(task: Task): number | null {
  return task.difficulty;
}

/**
 * Pair a generated task with its outcome into a telemetry record. `shiftIndex`
 * is the task's position in the shift — the same positional join the shift
 * already performs to attribute a task to its competency.
 */
export function buildAttempt(task: Task, outcome: TaskOutcome, shiftIndex: number): TaskAttempt {
  return {
    shift_index: shiftIndex,
    task_type: task.type,
    scenario: task.scenario,
    competency: competencyForTaskType(task.type),
    difficulty: attemptDifficulty(task),
    params: attemptParams(task),
    first_try: outcome.firstTry,
    misses: outcome.misses,
    duration_ms: outcome.durationMs,
  };
}
