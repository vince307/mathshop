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
 * `typeSplitFor` biases it toward the weaker competency; this is the unbiased
 * baseline it starts from.
 */
export const TYPE_SPLIT = 0.5;

/**
 * Hardest split one task type may be pushed to (P5). A child who is weak at
 * giving change should meet more change-making — but a shift made almost
 * entirely of the thing they are worst at is the fastest way to make them stop
 * playing, and it also starves the competency they were doing well at. 65/35 is
 * a nudge, not a curriculum.
 */
export const MAX_TYPE_SHARE = 0.65;

/**
 * How hard a competency gap pulls the split. Chosen so the cap is reached at a
 * gap of 0.5 — the full width of the level-1/2 band, i.e. one competency at the
 * floor of the scale while the other sits at its ceiling. Any child inside their
 * band therefore gets a bias strictly proportional to how lopsided they actually
 * are, and only a maximally lopsided one gets the maximum.
 */
export const TYPE_BIAS_RATE = (MAX_TYPE_SHARE - TYPE_SPLIT) / 0.5;

/**
 * Probability that a drawn task is `counting`, biased toward the child's WEAKER
 * competency (P5) and hard-capped at `MAX_TYPE_SHARE` either way.
 *
 * Counting is the `math` competency, change-making is `money`, so a `math` below
 * `money` means counting is the weak side and its share goes UP. Symmetric by
 * construction: the same gap the other way biases change-making by the same
 * amount, and equal competencies give exactly `TYPE_SPLIT`.
 *
 * Read at PLAN time from the shift's opening difficulty, not per task. The type
 * sequence is fixed when the shift is planned (`ShiftSource.types`) because the
 * shift's length and its progress bar are; re-rolling the bias mid-shift would
 * make the sequence depend on how far the child had got, which is the one thing
 * the server's task 1 and the client's replay could not agree on.
 */
export function typeSplitFor(difficulty: DifficultyState): number {
  // money − math: positive when math is the weaker one, so counting's share rises.
  const gap = difficulty.money - difficulty.math;
  return Math.min(MAX_TYPE_SHARE, Math.max(1 - MAX_TYPE_SHARE, TYPE_SPLIT + TYPE_BIAS_RATE * gap));
}

/** Default split between the two v1 task types, biased by `typeSplitFor`. Injectable for tests. */
function defaultPickType(difficulty: DifficultyState): TaskType {
  return Math.random() < typeSplitFor(difficulty) ? "counting" : "change_making";
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
  pickType: () => TaskType = () => defaultPickType(difficulty),
  pick?: (min: number, max: number) => number,
  pickTwoStage?: () => boolean,
): Task {
  const type = pickType();
  const d = difficulty[competencyForTaskType(type)];
  return type === "counting" ? generateCountingTask(d, pick) : generateChangeMakingTask(d, pick, pickTwoStage);
}
