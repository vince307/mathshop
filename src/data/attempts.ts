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
   * The continuous difficulty the task was generated at. Null until P3
   * introduces the scale — see `attemptDifficulty` below.
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
 * Difficulty to record for a task. **Null in P1/P2 by design**: the continuous
 * `d` scale does not exist until P3, and recording a normalised tier here would
 * put two incomparable quantities in one column of the very table whose purpose
 * is tuning the model. Difficulty is constant per profile in this phase, so
 * nothing is lost. P3 replaces this with the real `d`.
 */
export function attemptDifficulty(): number | null {
  return null;
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
    difficulty: attemptDifficulty(),
    params: attemptParams(task),
    first_try: outcome.firstTry,
    misses: outcome.misses,
    duration_ms: outcome.durationMs,
  };
}
