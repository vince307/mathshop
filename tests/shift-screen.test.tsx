// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import ShiftScreen from "@/components/child/ShiftScreen";
import type { Task } from "@/types";
import { DEFAULT_WORLD } from "@/data/worlds";
import {
  DIFFICULTY_MIN,
  FINAL_TASK_RELIEF,
  TIER_ANCHOR,
  ceilingForLevel,
  type DifficultyState,
  type ScoredTask,
} from "@/data/adaptive";
import { createShiftSource, drawDifficultyFor, earningsForShift, openShift } from "@/data/shift";
import { attemptParams } from "@/data/attempts";
import { competencyForTaskType } from "@/data/skills";
import type { TaskAttempt } from "@/data/attempts";
import { t } from "@/i18n";

/** Interpolate an i18n template, exactly as the components do. */
function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((out, [key, value]) => out.replace(`{${key}}`, String(value)), template);
}

/**
 * The shift orchestrator under lazy generation (adaptive-task-engine P4).
 *
 * `tests/shift-source.test.ts` proves the lazy DRAW matches P3's eager one. This
 * file proves the orchestrator built on top of it still behaves: the shift's
 * total is known from task 1, task 1 renders as the server drew it, and the
 * shift-end payload's positional join survives — `attempts[i]` still describes
 * `tasks[i]`, which is the join that attributes a task to its competency and
 * writes its telemetry. That join used to read a prop array that was complete
 * from the first render; it now reads one the engine fills in as it goes, so it
 * is exactly the thing this phase could have broken silently.
 *
 * The console is asserted quiet throughout. A hydration mismatch, a key
 * collision or a state update on an unmounted component all surface as a React
 * console error and nothing else — no assertion in this file would otherwise
 * notice.
 */

/** A level-1 profile: the tier-1 envelope, and never a two-stage task. */
const LEVEL_1: DifficultyState = { math: TIER_ANCHOR[1], money: TIER_ANCHOR[1] };
const SEED = 20260825;
/** The band a level-1 profile adapts inside — what `task.astro` puts in the plan. */
const LEVEL_1_CEILING = ceilingForLevel(1);
/**
 * A profile sitting mid-band, where adaptation is visible in both directions.
 * A level-1 profile seeds at the FLOOR of the scale, so a shift it plays can
 * only ever move up by hundredths and its closing task's relief floors at 0 —
 * true to life, and useless as an assertion. This is the plan's own Open Risks
 * note ("any manual check of difficulty rising must be run on a level-1
 * profile") read the other way: the DOWNWARD half needs headroom below.
 */
const MID: DifficultyState = { math: 0.4, money: 0.4 };
const MID_CEILING = ceilingForLevel(3);

const COIN = (n: number) => t.task.coinLabel.replace("{n}", String(n));
const progressText = (current: number, total: number) =>
  t.results.progress.replace("{current}", String(current)).replace("{total}", String(total));

/**
 * The whole sequence the engine will draw for a given outcome stream, replayed
 * the same way it does — including P5's adaptation, which is why this can no
 * longer be a fixed-difficulty `Array.from`.
 *
 * The POLICY is not duplicated here: `drawDifficultyFor` is the production one,
 * imported. What this mirrors is only the plumbing — replay the source, skip the
 * server's task 1, score each drawn task in turn — so a change to how difficulty
 * moves cannot make this helper and the hook agree on the wrong thing.
 */
function expectedTasks(
  seed: number,
  difficulty: DifficultyState,
  firstTries: readonly boolean[] = [],
  ceiling = LEVEL_1_CEILING,
): Task[] {
  const plan = openShift(difficulty, ceiling, 0, seed).plan;
  const source = createShiftSource(plan);
  const tasks: Task[] = [source.next(plan.difficulty)];
  const scored: ScoredTask[] = [];
  while (tasks.length < plan.length) {
    const index = tasks.length - 1;
    scored.push({
      index,
      competency: competencyForTaskType(tasks[index].type),
      firstTry: firstTries[index] ?? true,
    });
    tasks.push(source.next(drawDifficultyFor(plan, scored, tasks.length)));
  }
  return tasks;
}

/** Tap the correct number of coins and submit; then run out the 1.4 s beat. */
function solve(task: Task) {
  const taps = task.type === "counting" ? task.targetCount : task.change;
  for (let i = 1; i <= taps; i++) {
    fireEvent.click(screen.getByRole("button", { name: COIN(i) }));
  }
  fireEvent.click(screen.getByRole("button", { name: t.task.check }));
  act(() => {
    vi.advanceTimersByTime(1400);
  });
}

function renderShift(seed = SEED, difficulty = LEVEL_1, ceiling = LEVEL_1_CEILING) {
  const { plan, firstTask } = openShift(difficulty, ceiling, 0, seed);
  render(
    <ShiftScreen
      plan={plan}
      firstTask={firstTask}
      world={DEFAULT_WORLD}
      profileId="profile-1"
      walletBalance={0}
      purchased={[]}
      decorations={[]}
    />,
  );
  return { plan, firstTask };
}

/**
 * The server's payout, as this file's mock reports it. Deliberately a shift with
 * a real running cost (`profit < revenue`), so a component that displayed
 * revenue where the payout belongs would be visibly wrong rather than
 * accidentally right — the exact divergence the island stopped computing its own
 * number to avoid.
 */
const MOCK_REVENUE = 48;
const MOCK_COST = 6;
const MOCK_PROFIT = MOCK_REVENUE - MOCK_COST;

let fetchMock: ReturnType<typeof vi.fn>;
let consoleError: ReturnType<typeof vi.spyOn>;
let consoleWarn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  // The mock MUST carry `revenue`/`cost`/`profit` (E1). The island reads them off
  // the response; a mock missing them yields `undefined`, and the results copy
  // interpolates the string "undefined" WITHOUT throwing — a silent green. Keep
  // this shape in step with `src/pages/api/shifts/complete.ts`'s 200 body.
  fetchMock = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          leveledUp: false,
          businessLevel: 1,
          revenue: MOCK_REVENUE,
          cost: MOCK_COST,
          profit: MOCK_PROFIT,
        }),
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  // Asserted in teardown so EVERY test in the file is covered, not just the one
  // that remembers to check.
  expect(consoleError).not.toHaveBeenCalled();
  expect(consoleWarn).not.toHaveBeenCalled();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("ShiftScreen — the plan's length is known from task 1", () => {
  it("shows the full total in the progress counter before any task is drawn", () => {
    const { plan } = renderShift();
    // Only ONE task exists at this point. The counter must still read the plan's
    // total: `e2e/helpers/solve-shift.ts` parses it here and loops on it, and a
    // counter that grew per task would tell it the shift is one task long.
    expect(screen.getByText(progressText(1, plan.length))).toBeInTheDocument();
  });

  it("renders task 1 exactly as the server drew it", () => {
    const { firstTask } = renderShift();
    const coinCount = firstTask.type === "counting" ? firstTask.targetCount : firstTask.availableCount;
    expect(screen.getAllByRole("button", { name: /^Moneta \d+$/ })).toHaveLength(coinCount);
  });

  it("counts up through the shift without the total moving", () => {
    const { plan } = renderShift();
    const tasks = expectedTasks(SEED, LEVEL_1);
    for (let i = 0; i < plan.length - 1; i++) {
      expect(screen.getByText(progressText(i + 1, plan.length))).toBeInTheDocument();
      solve(tasks[i]);
    }
    expect(screen.getByText(progressText(plan.length, plan.length))).toBeInTheDocument();
  });
});

describe("ShiftScreen — the shift-end payload", () => {
  it("keeps the positional join: attempts[i] describes the task actually played at i", async () => {
    const { plan } = renderShift();
    const tasks = expectedTasks(SEED, LEVEL_1);
    expect(tasks).toHaveLength(plan.length);

    for (const task of tasks) solve(task);
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = init.body as FormData;
    expect(body.get("taskCount")).toBe(String(plan.length));
    expect(body.get("cleanCount")).toBe(String(plan.length)); // every task solved first try

    const attempts = JSON.parse(body.get("attempts") as string) as TaskAttempt[];
    expect(attempts).toHaveLength(plan.length);
    attempts.forEach((attempt, i) => {
      expect(attempt.shift_index).toBe(i);
      expect(attempt.task_type).toBe(tasks[i].type);
      expect(attempt.scenario).toBe(tasks[i].scenario);
      expect(attempt.competency).toBe(competencyForTaskType(tasks[i].type));
      expect(attempt.difficulty).toBe(tasks[i].difficulty);
      expect(attempt.params).toEqual(attemptParams(tasks[i]));
      expect(attempt.first_try).toBe(true);
    });
  });

  /**
   * The island shows the SERVER's payout and nothing it computed itself (E1).
   * Before the profit rule it called `earningsForShift` locally; that number is
   * revenue, so under a running cost the celebration would have named money the
   * wallet never received — and no test would have failed.
   */
  it("credits the server's profit, never a locally recomputed payout", async () => {
    const { plan } = renderShift();
    for (const task of expectedTasks(SEED, LEVEL_1)) solve(task);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(fill(t.results.earnedLabel, { earned: MOCK_PROFIT }))).toBeInTheDocument();
    // The locally computable figure — what the island used to show — must be absent.
    expect(
      screen.queryByText(fill(t.results.earnedLabel, { earned: earningsForShift(plan.length, plan.length) })),
    ).toBeNull();
  });

  it("shows the breakdown the server sent: przychód − koszt = zysk", async () => {
    renderShift();
    for (const task of expectedTasks(SEED, LEVEL_1)) solve(task);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(t.results.breakdownHeading)).toBeInTheDocument();
    expect(screen.getByText(fill(t.results.revenueLabel, { revenue: MOCK_REVENUE }))).toBeInTheDocument();
    expect(screen.getByText(fill(t.results.costLabel, { cost: MOCK_COST }))).toBeInTheDocument();
    expect(screen.getByText(fill(t.results.profitLabel, { profit: MOCK_PROFIT }))).toBeInTheDocument();
  });

  it("posts once and only once, at the end", async () => {
    const { plan } = renderShift();
    const tasks = expectedTasks(SEED, LEVEL_1);

    for (let i = 0; i < plan.length - 1; i++) {
      solve(tasks[i]);
      expect(fetchMock).not.toHaveBeenCalled(); // no per-task write (FR-016 / S-12)
    }
    solve(tasks[plan.length - 1]);
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: t.results.heading })).toBeInTheDocument();
  });
});

/**
 * In-shift adaptation (adaptive-task-engine P5) — the only phase that changes
 * what the child experiences, asserted through the orchestrator that drives it
 * rather than against the policy in isolation (`tests/shift-source.test.ts` owns
 * that). What could break here and nowhere else: the engine scoring a task
 * against the wrong competency, or drawing the next one before folding the last
 * outcome in — both of which leave a shift that still looks well-formed.
 *
 * The recorded `difficulty` is the observable, because it is the number the
 * child's next task was generated from AND the number the tuning data will be
 * read against. It is telemetry, not authority: the server recomputes what it
 * persists from the reported outcomes (`tests/shifts-complete.test.ts`).
 */
describe("ShiftScreen — the shift adapts as it is played", () => {
  /** Play a whole shift first-try and return the telemetry it posted. */
  async function playPerfectShift(difficulty: DifficultyState, ceiling: number) {
    const { plan } = renderShift(SEED, difficulty, ceiling);
    for (const task of expectedTasks(SEED, difficulty, [], ceiling)) solve(task);
    await act(async () => {
      await Promise.resolve();
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const attempts = JSON.parse((init.body as FormData).get("attempts") as string) as TaskAttempt[];
    return { plan, attempts };
  }

  it("raises difficulty within the shift on a clean streak, per competency", async () => {
    const { plan, attempts } = await playPerfectShift(MID, MID_CEILING);
    expect(attempts.length).toBeGreaterThanOrEqual(4);

    // Task 1 is the server's — drawn before anything was scored, so at the
    // opening value — and the warm-up (index 0) never moves `d`.
    expect(attempts[0].difficulty).toBe(plan.difficulty[attempts[0].competency]);

    // Somewhere in the middle a task is generated ABOVE where the shift opened.
    // Guaranteed rather than likely: both types appear, index 1's clean answer
    // moves its competency, so by index 3 at the latest a task is drawn on a
    // competency that has already risen.
    const middle = attempts.slice(1, -1);
    expect(middle.some((a) => (a.difficulty ?? 0) > plan.difficulty[a.competency])).toBe(true);

    // And no task in that stretch is drawn BELOW the opening: a clean streak
    // has nothing in it that should ever make the next task easier.
    for (const attempt of middle) {
      expect(attempt.difficulty).toBeGreaterThanOrEqual(plan.difficulty[attempt.competency]);
    }
  });

  it("never lets a mid-shift task exceed the age band, even played perfectly", async () => {
    const { attempts } = await playPerfectShift(LEVEL_1, LEVEL_1_CEILING);
    for (const attempt of attempts) {
      expect(attempt.difficulty).toBeLessThanOrEqual(LEVEL_1_CEILING);
      expect(attempt.difficulty).toBeGreaterThanOrEqual(DIFFICULTY_MIN);
    }
  });

  it("generates the CLOSING task easier — the shift ends on something they can do", async () => {
    const { plan, attempts } = await playPerfectShift(MID, MID_CEILING);
    const closing = attempts[attempts.length - 1];
    // Below where the shift OPENED, not merely below its predecessor: after a
    // perfect streak the fold has been climbing, so "lower than the last one"
    // would pass on a relief of nearly zero.
    expect(closing.difficulty).toBeLessThan(plan.difficulty[closing.competency]);
    expect(closing.difficulty).toBeGreaterThanOrEqual(plan.difficulty[closing.competency] - FINAL_TASK_RELIEF);
  });

  it("scores each task against the competency it actually exercised", async () => {
    // The positional join, from the adaptation side: a task's difficulty must be
    // the one held for ITS type. Attribute a counting streak to `money` and the
    // shift still looks fine — the child just gets the wrong tasks next time.
    const { attempts } = await playPerfectShift(MID, MID_CEILING);
    for (const attempt of attempts) {
      expect(attempt.competency).toBe(attempt.task_type === "counting" ? "math" : "money");
    }
  });
});
