/**
 * Shift composition + scoring (S-04). Pure and client-safe (mirrors
 * `src/data/counting-tasks.ts`): imported by the client for the results
 * celebration AND by the shift-completion route for the authoritative wallet/level
 * write, so both sides agree by construction. All tunables are named constants —
 * first-guess defaults, adjust after kid-testing.
 */
import type { Task } from "@/types";
import {
  type DifficultyState,
  type ScoredTask,
  type SeededRandom,
  clampToBand,
  createSeededRandom,
  foldShiftOutcomes,
  randomSeed,
  relieveForFinalTask,
  shiftLengthRangeFor,
} from "@/data/adaptive";
import { STOCK_AND_CHANGE_RATE } from "@/data/change-making-tasks";
import { generateTask, typeSplitFor, type TaskType } from "@/data/tasks";

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
  // Same absolute-safe-bound clamp the leaf generators use: a non-finite pick
  // floors to `min` instead of poisoning the length. The naive
  // `Math.min(max, Math.max(min, NaN))` yields NaN, and a NaN length makes
  // `generateShift` emit a ZERO-task shift — a child handed nothing to do.
  const base = clampToBand(pick(min, max), min, max);
  return Math.min(base + bonus, MAX_SHIFT_TASKS);
}

/**
 * Draw the shift's ordered task types. Guarantees at least one of each type
 * (when length ≥ 2) so the child never gets an all-one-type shift, then fills +
 * shuffles the rest.
 *
 * Split out of `generateShift` in P4 so the eager path and the seeded lazy
 * source (`createShiftSource`) share ONE implementation. Two copies would draw
 * from the picker in subtly different orders and the client's shift would
 * silently stop matching the server's first task — which reads as a flaky
 * generator, not as a bug.
 */
function drawTypes(n: number, pick: (min: number, max: number) => number, pickType: () => TaskType): TaskType[] {
  const types: TaskType[] = [];
  if (n >= 2) types.push("counting", "change_making"); // guarantee both appear
  while (types.length < n) types.push(pickType());
  // Fisher–Yates shuffle so the guaranteed pair isn't always first. The index is
  // clamped because it INDEXES the array: an out-of-range pick would assign past
  // the end, extending `types` with holes and routing around the MAX_SHIFT_TASKS
  // clamp `shiftLength` just applied — the one overrun this module must not have.
  for (let i = types.length - 1; i > 0; i--) {
    const j = clampToBand(pick(0, i), 0, i);
    [types[i], types[j]] = [types[j], types[i]];
  }
  return types;
}

/**
 * Build a whole shift eagerly: `shiftLength` tasks mixing counting +
 * change-making, each drawn at ITS OWN competency's difficulty. `bonus` adds
 * capacity-effect tasks (S-06). `pick`/`pickType`/`pickTwoStage` are injectable
 * for deterministic tests, and `pick` is genuinely forwarded to the leaf
 * generators — it used to stop at the dispatcher.
 *
 * **`/app/task` no longer calls this.** From P4 the page fixes a plan and the
 * client draws tasks 2…N lazily (`createShiftSource`), because a task generated
 * *after* the previous one is scored is the precondition for in-shift adaptation
 * (P5). This stays as the eager reference the lazy path is pinned against
 * (`tests/shift-source.test.ts`): given the same seeded picker the two must
 * produce the identical sequence, and that equality is the whole safety argument
 * for moving generation across the wire.
 */
export function generateShift(
  difficulty: DifficultyState,
  bonus = 0,
  pick: (min: number, max: number) => number = defaultPick,
  pickType: () => TaskType = () => (Math.random() < typeSplitFor(difficulty) ? "counting" : "change_making"),
  pickTwoStage?: () => boolean,
): Task[] {
  const n = shiftLength(lengthDifficulty(difficulty), bonus, pick);
  return drawTypes(n, pick, pickType).map((type) => generateTask(difficulty, () => type, pick, pickTwoStage));
}

/**
 * Everything the client needs to reproduce the rest of a shift, and the only
 * shift state that crosses the wire. Serialized into the `ShiftScreen` island
 * props, so it is part of the hydration payload.
 *
 * `length` is decided ONCE, server-side, and is never recomputed mid-shift: five
 * `ShiftScreen` sites and `e2e/helpers/solve-shift.ts` need the total to be known
 * from task 1. `seed` is the single point where real randomness enters —
 * everything downstream of it is a pure function of this object.
 */
export interface ShiftPlan {
  /** Fixed total task count, capacity bonus already folded in and clamped. */
  length: number;
  /** Seed for `createSeededRandom` — the client replays the server's draw order from it. */
  seed: number;
  /**
   * Per-competency `d` the shift opened at. From P5 the client moves this as the
   * shift is played; the value here stays the OPENING one, because it is also the
   * drift clamp's anchor and the type-bias's input — both of which must be fixed
   * for the whole shift.
   */
  difficulty: DifficultyState;
  /**
   * The profile's age-band bound (`ceilingForLevel(starting_level)`), carried
   * across the wire so the client's in-shift adaptation honours the same
   * pedagogical guardrail the server enforces on the persisted value (P5).
   *
   * Sending it is safe: it is a bound, not an authority. The server recomputes
   * `d` from the reported outcomes against its OWN `ceilingForLevel`, so raising
   * this number in the payload buys a tampered client nothing more durable than
   * harder tasks for itself, for one shift.
   */
  ceiling: number;
}

/**
 * Fix a shift's plan. The length draw happens HERE and nowhere else; the client
 * receives the number rather than re-deriving it, so a capacity bonus it does not
 * know about can never make the two disagree.
 */
export function planShift(
  difficulty: DifficultyState,
  ceiling: number,
  bonus = 0,
  seed: number = randomSeed(),
): ShiftPlan {
  const rng = createSeededRandom(seed);
  return { length: shiftLength(lengthDifficulty(difficulty), bonus, rng.pick), seed, difficulty, ceiling };
}

/** A cursor over a planned shift's tasks: yields them in order, one at a time. */
export interface ShiftSource {
  /** The shift's ordered task types — fixed at plan time, unlike the tasks themselves. */
  types: readonly TaskType[];
  /**
   * The next task, drawn at the difficulty passed in. Taking `difficulty` per
   * call rather than reading it off the plan is what P5 needs: the task after a
   * scored one is generated at the `d` that scoring produced.
   */
  next(difficulty: DifficultyState): Task;
}

/**
 * Open a cursor over a plan. Deterministic: the server and the client both call
 * this and, from task 1 on, walk the identical stream.
 *
 * The stream is replayed rather than resumed because a PRNG position is not
 * something you can put in a prop — mulberry32's state is internal, and
 * exporting it would tie the wire format to the generator's implementation.
 * Replay costs a handful of arithmetic ops and keeps the payload at one number.
 */
export function createShiftSource(plan: ShiftPlan): ShiftSource {
  const rng: SeededRandom = createSeededRandom(plan.seed);
  // Replay `planShift`'s length draw. The RESULT is deliberately discarded —
  // `plan.length` is authoritative and already carries the capacity bonus — but
  // the draw itself MUST happen, or every later draw lands one step off the
  // server's stream and the client's task 1 stops matching the rendered one.
  // Called through `shiftLength` rather than a bare `rng.pick` so the two stay in
  // step even if the length draw ever grows a second roll.
  shiftLength(lengthDifficulty(plan.difficulty), 0, rng.pick);
  // Biased toward the child's weaker competency (P5), from the shift's OPENING
  // difficulty — the same number the server drew task 1 from, so the two agree.
  const split = typeSplitFor(plan.difficulty);
  const types = drawTypes(plan.length, rng.pick, () => (rng.chance(split) ? "counting" : "change_making"));
  let cursor = 0;
  return {
    types,
    next(difficulty: DifficultyState): Task {
      // Past the end, repeat the last type rather than throwing: an over-long
      // shift is a caller bug, and a throw mid-play would strand a child in a
      // shift whose result is not persisted until the end (FR-016).
      const type = types[Math.min(cursor, types.length - 1)];
      cursor += 1;
      return generateTask(
        difficulty,
        () => type,
        rng.pick,
        () => rng.chance(STOCK_AND_CHANGE_RATE),
      );
    },
  };
}

/**
 * The difficulty the shift's NEXT task should be generated at (P5) — the whole
 * in-shift adaptation policy, in one pure expression.
 *
 * It lives here, beside the plan, rather than inside `useShiftEngine`, because
 * the hook is the only stateful part of the loop and a policy trapped inside a
 * hook can only be tested through a rendered component. Everything the decision
 * needs is an argument: where the shift opened, what has been scored, and which
 * task is about to be drawn.
 *
 * `scored` is folded whole on every call rather than accumulated — it is at most
 * `MAX_SHIFT_TASKS` long, and recomputing removes the class of bug where a
 * running total drifts out of agreement with the outcomes it summarises, which
 * is exactly what the server's own fold would then contradict at shift end.
 *
 * The last task of the shift comes back relieved (`relieveForFinalTask`): end on
 * something the child can do. Generation only — the relieved value is never
 * persisted, because the server folds the reported outcomes, not this.
 */
export function drawDifficultyFor(plan: ShiftPlan, scored: readonly ScoredTask[], nextIndex: number): DifficultyState {
  const difficulty = foldShiftOutcomes(plan.difficulty, scored, plan.ceiling);
  return nextIndex >= plan.length - 1 ? relieveForFinalTask(difficulty) : difficulty;
}

/**
 * Open a shift on the server: fix the plan and draw the first task from it.
 *
 * Task 1 is drawn HERE, through the very same source the client will use, so
 * "the server's task 1" and "the client's task 1" are one expression rather than
 * two implementations that happen to agree. It is server-rendered because
 * generating it in the island would draw one task during SSR and a different one
 * at hydration — React discards the server tree on the mismatch and the child
 * watches one task flip into another.
 */
export function openShift(
  difficulty: DifficultyState,
  ceiling: number,
  bonus = 0,
  seed: number = randomSeed(),
): { plan: ShiftPlan; firstTask: Task } {
  const plan = planShift(difficulty, ceiling, bonus, seed);
  return { plan, firstTask: createShiftSource(plan).next(difficulty) };
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
