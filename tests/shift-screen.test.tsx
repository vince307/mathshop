// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import ShiftScreen from "@/components/child/ShiftScreen";
import type { Task } from "@/types";
import { DEFAULT_WORLD } from "@/data/worlds";
import { TIER_ANCHOR, type DifficultyState } from "@/data/adaptive";
import { createShiftSource, openShift } from "@/data/shift";
import { attemptParams } from "@/data/attempts";
import { competencyForTaskType } from "@/data/skills";
import type { TaskAttempt } from "@/data/attempts";
import { t } from "@/i18n";

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

const COIN = (n: number) => t.task.coinLabel.replace("{n}", String(n));
const progressText = (current: number, total: number) =>
  t.results.progress.replace("{current}", String(current)).replace("{total}", String(total));

/** The whole sequence the engine will draw, computed the same way it does. */
function expectedTasks(seed: number, difficulty: DifficultyState): Task[] {
  const plan = openShift(difficulty, 0, seed).plan;
  const source = createShiftSource(plan);
  return Array.from({ length: plan.length }, () => source.next(difficulty));
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

function renderShift(seed = SEED, difficulty = LEVEL_1) {
  const { plan, firstTask } = openShift(difficulty, 0, seed);
  render(
    <ShiftScreen
      plan={plan}
      firstTask={firstTask}
      world={DEFAULT_WORLD}
      profileId="profile-1"
      walletBalance={0}
      purchased={[]}
    />,
  );
  return { plan, firstTask };
}

let fetchMock: ReturnType<typeof vi.fn>;
let consoleError: ReturnType<typeof vi.spyOn>;
let consoleWarn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ leveledUp: false, businessLevel: 1 }) }),
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
