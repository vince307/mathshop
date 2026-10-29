import { useCallback, useRef, useState } from "react";
import type { Task } from "@/types";
import { createShiftSource, drawDifficultyFor, type ShiftPlan, type ShiftSource } from "@/data/shift";
import type { ScoredTask } from "@/data/adaptive";
import { competencyForTaskType } from "@/data/skills";
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
 * The shift engine (adaptive-task-engine P4, adapting from P5). Holds a shift's
 * cursor, draws tasks 2…N on the client from the server's seed, and — since P5 —
 * moves the per-competency difficulty after each scored task so the NEXT task is
 * generated at what the last answer earned.
 *
 * **Why lazily, when the server could just send the whole array?** Because a task
 * drawn *after* the previous one is scored is the precondition for adaptation: a
 * fully-materialised array is decided before the child has answered anything, so
 * nothing it contains can react to how the shift is going. P4 moved the
 * generation without moving `d`; this is the phase that moves `d`.
 *
 * Task 1 arrives as a prop, drawn server-side by `openShift`. It is NOT redrawn
 * here: the server rendered its markup, and a second draw at hydration would
 * produce a different task, mismatch the server tree, and flash one task into
 * another. The engine instead advances its own stream past task 1 so it lands on
 * exactly the draw the server would have made next. That skip replays at the
 * shift's OPENING difficulty, which is what the server drew task 1 from —
 * adaptation starts at task 2, the first draw the server never made.
 *
 * The difficulty is **recomputed from the whole prefix** on every advance rather
 * than accumulated: the fold is pure and the prefix is at most `MAX_SHIFT_TASKS`
 * long, so re-running it costs nothing and removes the class of bug where a
 * re-render, a replay or a dropped update leaves a running total one step out of
 * agreement with the outcomes it is supposed to summarise — which is precisely
 * what the server would then contradict at shift end.
 *
 * Nothing here is persisted. The server recomputes `d` from the reported
 * outcomes through the same `foldShiftOutcomes` and writes THAT, so this value
 * only ever decides what the child sees next. No network calls either:
 * everything after the initial page load is local, which is what keeps S-12's
 * mid-shift offline tolerance intact.
 */
export function useShiftEngine(plan: ShiftPlan, firstTask: Task): ShiftEngine {
  const [tasks, setTasks] = useState<Task[]>(() => [firstTask]);
  const [results, setResults] = useState<TaskOutcome[]>([]);
  const sourceRef = useRef<ShiftSource | null>(null);
  /**
   * The shift's tasks and its scored outcomes, mirrored OUTSIDE React state.
   * `advance` reads both to decide what to draw next, and reading them from
   * state would give it whatever the last committed render held — stale under a
   * batched double-advance, which is exactly when a shift desynchronises.
   */
  const tasksRef = useRef<Task[]>([firstTask]);
  const scoredRef = useRef<ScoredTask[]>([]);

  const advance = useCallback(
    (outcome: TaskOutcome) => {
      const index = scoredRef.current.length; // position of the task just played
      const played = tasksRef.current[index];
      scoredRef.current = [
        ...scoredRef.current,
        // Which `d` this task moves is derived from what it WAS, never chosen.
        { index, competency: competencyForTaskType(played.type), firstTry: outcome.firstTry },
      ];
      setResults((prev) => [...prev, outcome]);
      if (tasksRef.current.length >= plan.length) return; // last task: nothing left to draw

      // Drawn HERE and not inside a `setTasks` updater. Updaters must be pure and
      // React re-invokes them (StrictMode double-invoke, a rebased render), which
      // would pull two draws from the seeded stream for one task and
      // desynchronise every task after it.
      if (!sourceRef.current) {
        const source = createShiftSource(plan);
        source.next(plan.difficulty); // skip task 1 — it came from the server
        sourceRef.current = source;
      }

      // The whole adaptation policy — the fold plus the closing task's relief —
      // is `drawDifficultyFor`. Kept out here so it can be tested without
      // rendering anything, and so the test that drives the orchestrator checks
      // against the real policy rather than a copy of it.
      const task = sourceRef.current.next(drawDifficultyFor(plan, scoredRef.current, tasksRef.current.length));
      tasksRef.current = [...tasksRef.current, task];
      setTasks(tasksRef.current);
    },
    [plan],
  );

  // Derived, not stored: the cursor IS how many tasks have been scored, and two
  // counters that must agree is one counter too many.
  const index = results.length;

  return { index, total: plan.length, task: tasks[index], tasks, results, advance };
}
