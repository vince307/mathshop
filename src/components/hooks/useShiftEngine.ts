import { useCallback, useRef, useState } from "react";
import type { Task } from "@/types";
import { createShiftSource, type ShiftPlan, type ShiftSource } from "@/data/shift";
import type { TaskOutcome } from "@/components/hooks/useCoinTask";

/** What the orchestrator needs to render and advance a shift. */
export interface ShiftEngine {
  /** 0-based position of the task being played; equals `total` once the shift is over. */
  index: number;
  /** The shift's fixed task count, from the plan. Never recomputed mid-shift. */
  total: number;
  /** The task to render, or `undefined` once every task has been played. */
  task: Task | undefined;
  /**
   * Every task generated so far, IN ORDER. Retained rather than discarded after
   * render because the shift's competency delta and its telemetry are both a
   * POSITIONAL join — `results[i]` against `tasks[i]`. Dropping a played task
   * would silently attribute the wrong competency and write the wrong `params`.
   */
  tasks: Task[];
  /** One outcome per completed task, in the same order. */
  results: TaskOutcome[];
  /** Score the current task and draw the next one. */
  advance: (outcome: TaskOutcome) => void;
}

/**
 * The shift engine (adaptive-task-engine P4). Holds a shift's cursor and draws
 * tasks 2…N on the client, on demand, from the server's seed.
 *
 * **Why lazily, when the server could just send the whole array?** Because a task
 * drawn *after* the previous one is scored is the precondition for adaptation
 * (P5): a fully-materialised array is decided before the child has answered
 * anything, so nothing it contains can react to how the shift is going. P4 moves
 * the generation without moving `d`, so the output is still identical to P3's —
 * that is the point, it isolates the hydration risk from the adaptation logic.
 *
 * Task 1 arrives as a prop, drawn server-side by `openShift`. It is NOT redrawn
 * here: the server rendered its markup, and a second draw at hydration would
 * produce a different task, mismatch the server tree, and flash one task into
 * another. The engine instead advances its own stream past task 1 so it lands on
 * exactly the draw the server would have made next.
 *
 * No network calls: everything after the initial page load is local, which is
 * what keeps S-12's mid-shift offline tolerance intact.
 */
export function useShiftEngine(plan: ShiftPlan, firstTask: Task): ShiftEngine {
  const [tasks, setTasks] = useState<Task[]>(() => [firstTask]);
  const [results, setResults] = useState<TaskOutcome[]>([]);
  const sourceRef = useRef<ShiftSource | null>(null);
  /** How many tasks exist, counted OUTSIDE React state — see `advance`. */
  const generatedRef = useRef(1);

  const advance = useCallback(
    (outcome: TaskOutcome) => {
      setResults((prev) => [...prev, outcome]);
      if (generatedRef.current >= plan.length) return; // last task: nothing left to draw

      // Drawn HERE and not inside the `setTasks` updater. Updaters must be pure
      // and React re-invokes them (StrictMode double-invoke, a rebased render),
      // which would pull two draws from the seeded stream for one task and
      // desynchronise every task after it.
      if (!sourceRef.current) {
        const source = createShiftSource(plan);
        source.next(plan.difficulty); // skip task 1 — it came from the server
        sourceRef.current = source;
      }
      const task = sourceRef.current.next(plan.difficulty);
      generatedRef.current += 1;
      setTasks((prev) => [...prev, task]);
    },
    [plan],
  );

  // Derived, not stored: the cursor IS how many tasks have been scored, and two
  // counters that must agree is one counter too many.
  const index = results.length;

  return { index, total: plan.length, task: tasks[index], tasks, results, advance };
}
