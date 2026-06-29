/**
 * Task dispatcher (S-03). One entry point `/app/task` calls to get "a task" —
 * randomly counting or change-making — so the page serves both types. S-04
 * extends this into the mixed shift. Pure and client-safe.
 */
import type { Task } from "@/types";
import { generateCountingTask } from "@/data/counting-tasks";
import { generateChangeMakingTask } from "@/data/change-making-tasks";

export type { Task };

export type TaskType = Task["type"];

/** Default ~50/50 split between the two v1 task types. Injectable for tests. */
function defaultPickType(): TaskType {
  return Math.random() < 0.5 ? "counting" : "change_making";
}

/**
 * Build a task for a child at `startingLevel`, randomly counting or
 * change-making. `pickType` is injectable so tests assert dispatch deterministically.
 */
export function generateTask(startingLevel: number, pickType: () => TaskType = defaultPickType): Task {
  return pickType() === "counting" ? generateCountingTask(startingLevel) : generateChangeMakingTask(startingLevel);
}
