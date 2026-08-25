/**
 * Task dispatcher (S-03). One entry point `/app/task` calls to get "a task" —
 * randomly counting or change-making — so the page serves both types. S-04
 * extends this into the mixed shift. Pure and client-safe.
 */
import type { Task } from "@/types";
import type { DifficultyState } from "@/data/adaptive";
import { competencyForTaskType } from "@/data/skills";
import { generateCountingTask } from "@/data/counting-tasks";
import { generateChangeMakingTask } from "@/data/change-making-tasks";

export type { Task };

export type TaskType = Task["type"];

/**
 * Probability that a drawn task is `counting` — an even split between the two v1
 * types. Named because the seeded shift source has to roll the SAME split from
 * its own PRNG, and two hand-kept 0.5s would drift apart silently: the sequence
 * would still look plausible, it would just stop matching the server's.
 * P5 biases this toward the weaker competency; it is the unbiased baseline.
 */
export const TYPE_SPLIT = 0.5;

/** Default ~50/50 split between the two v1 task types. Injectable for tests. */
function defaultPickType(): TaskType {
  return Math.random() < TYPE_SPLIT ? "counting" : "change_making";
}

/**
 * Build a task at the caller's per-competency difficulty, randomly counting or
 * change-making. The type is drawn first and then selects which `d` applies —
 * counting is the `math` competency, change-making is `money`, so a child strong
 * at counting and weak at giving change gets each at its own level.
 *
 * `pick` / `pickTwoStage` are **forwarded** to the leaf generators. Until P3 they
 * were not: this function called the generators with no picker at all, so
 * `generateShift` had no way to inject one and seeded generation was impossible.
 * Passing `undefined` through is deliberate — it falls through to each leaf's own
 * default RNG rather than duplicating it here.
 */
export function generateTask(
  difficulty: DifficultyState,
  pickType: () => TaskType = defaultPickType,
  pick?: (min: number, max: number) => number,
  pickTwoStage?: () => boolean,
): Task {
  const type = pickType();
  const d = difficulty[competencyForTaskType(type)];
  return type === "counting" ? generateCountingTask(d, pick) : generateChangeMakingTask(d, pick, pickTwoStage);
}
