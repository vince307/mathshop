// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { TaskScreen } from "@/components/child/TaskScreen";
import ChangeMakingTask from "@/components/child/ChangeMakingTask";
import { RETRY_HINT_THRESHOLD, type ChangeMakingTask as ChangeMakingTaskInstance } from "@/types";
import { DEFAULT_WORLD } from "@/data/worlds";
import { t } from "@/i18n";

/**
 * Risk #6 — soft-failure guardrail (test-plan §2/§3 Phase 4). The PRD premise:
 * a wrong answer must NEVER punish — no game-over, no lost work, gentle retry,
 * scaffolding hint after RETRY_HINT_THRESHOLD misses, and the task still
 * completes on an eventual correct answer. These are behavioral invariants on
 * the real components (no CSS/animation assertions — §7 exclusion; the
 * softness signal asserted here is polite `role="status"`, never `alert`).
 *
 * First component-level suite in the repo (jsdom + RTL, added by Phase 4 as
 * §4 planned). Completion runs on a 1.4s beat — driven with fake timers.
 */

afterEach(cleanup);

const COIN = (n: number) => t.task.coinLabel.replace("{n}", String(n));

/** Render the shared TaskScreen with a header that exposes the showHint flag. */
function renderTask(opts: { coinCount?: number; target?: number; onComplete?: (o: unknown) => void } = {}) {
  const { coinCount = 4, target = 3, onComplete } = opts;
  return render(
    <TaskScreen
      coinCount={coinCount}
      target={target}
      arrangement="scatter"
      hintCopy="Policz jeszcze raz powoli."
      successCopy="Brawo!"
      onComplete={onComplete as never}
      renderHeader={(showHint) => <div data-testid="header">{showHint ? "hint-on" : "hint-off"}</div>}
    />,
  );
}

const tapCoins = (count: number) => {
  for (let i = 1; i <= count; i++) fireEvent.click(screen.getByRole("button", { name: COIN(i) }));
};
const check = () => {
  fireEvent.click(screen.getByRole("button", { name: t.task.check }));
};

describe("Risk #6 — wrong answers stay soft (TaskScreen)", () => {
  it("a wrong answer shows the gentle retry, keeps the child's work, and nothing locks up", () => {
    renderTask();
    tapCoins(1); // 1 of target 3
    check();

    // Gentle retry in a polite live region — and NOTHING assertive anywhere.
    expect(screen.getByRole("status")).toHaveTextContent(t.task.retry);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // The tapped coin keeps its counted state — no work is wiped on a miss.
    expect(screen.getByRole("button", { name: COIN(1) })).toHaveAttribute("aria-pressed", "true");
    // No game-over: coins and the check button stay enabled.
    expect(screen.getByRole("button", { name: COIN(2) })).toBeEnabled();
    expect(screen.getByRole("button", { name: t.task.check })).toBeEnabled();
  });

  it("adjusting a coin clears the retry message (the child is never stuck with a red-letter state)", () => {
    renderTask();
    tapCoins(1);
    check();
    expect(screen.getByRole("status")).toHaveTextContent(t.task.retry);

    fireEvent.click(screen.getByRole("button", { name: COIN(2) }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it(`the scaffolding hint appears only after ${RETRY_HINT_THRESHOLD} consecutive misses (FR-009)`, () => {
    renderTask();

    for (let miss = 1; miss <= RETRY_HINT_THRESHOLD; miss++) {
      check(); // tally 0 ≠ target 3 → miss
      if (miss < RETRY_HINT_THRESHOLD) {
        expect(screen.queryByText(t.task.hintTitle)).not.toBeInTheDocument();
        expect(screen.getByTestId("header")).toHaveTextContent("hint-off");
      }
    }

    // Threshold reached: amber hint card + the header receives the highlight cue.
    expect(screen.getByText(t.task.hintTitle)).toBeInTheDocument();
    expect(screen.getByText("Policz jeszcze raz powoli.")).toBeInTheDocument();
    expect(screen.getByTestId("header")).toHaveTextContent("hint-on");
  });

  it("completes on the eventual correct answer, reporting honest misses — never blocking retries", () => {
    vi.useFakeTimers();
    try {
      const onComplete = vi.fn();
      renderTask({ onComplete });

      check(); // miss 1
      check(); // miss 2
      tapCoins(3); // fix the tally (coins 1..3)
      check(); // correct

      expect(screen.getByRole("status")).toHaveTextContent("Brawo!");
      // Board freezes only AFTER success (not as punishment): coins disabled now.
      expect(screen.getByRole("button", { name: COIN(1) })).toBeDisabled();
      // Completion waits for the celebratory beat.
      expect(onComplete).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(1400);
      });
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith({ firstTry: false, misses: 2 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports a clean first-try outcome when there were no misses", () => {
    vi.useFakeTimers();
    try {
      const onComplete = vi.fn();
      renderTask({ onComplete });
      tapCoins(3);
      check();
      act(() => {
        vi.advanceTimersByTime(1400);
      });
      expect(onComplete).toHaveBeenCalledWith({ firstTry: true, misses: 0 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("a fast unmount before the beat never fires a stale completion", () => {
    vi.useFakeTimers();
    try {
      const onComplete = vi.fn();
      const { unmount } = renderTask({ onComplete });
      tapCoins(3);
      check();
      unmount();
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(onComplete).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Risk #6 — two-stage stock_and_change keeps the guarantees per stage", () => {
  const task: ChangeMakingTaskInstance = {
    type: "change_making",
    scenario: "stock_and_change",
    paid: 5,
    price: 2,
    change: 3,
    availableCount: 5,
    stockCount: 4,
    arrangement: "scatter",
    stockArrangement: "scatter",
  };
  const stageLabel = (step: number) => t.task.stock_and_change.stageLabel.replace("{step}", String(step));

  it("advances stage 1 → stage 2 with fresh board state, and reports ONE aggregate outcome", () => {
    vi.useFakeTimers();
    try {
      const onComplete = vi.fn();
      render(<ChangeMakingTask task={task} world={DEFAULT_WORLD} onComplete={onComplete} />);

      // Stage 1: one miss (empty check), then count the price (2 coins).
      expect(screen.getByText(stageLabel(1))).toBeInTheDocument();
      check(); // miss in stage 1
      tapCoins(2);
      check();
      act(() => {
        vi.advanceTimersByTime(1400);
      });

      // Stage 2 remounts fresh: label 2, no coin carries a counted state over.
      expect(screen.getByText(stageLabel(2))).toBeInTheDocument();
      expect(screen.getByRole("button", { name: COIN(1) })).toHaveAttribute("aria-pressed", "false");
      expect(onComplete).not.toHaveBeenCalled(); // no premature aggregate

      // Stage 2 first-try: give the change (3 coins).
      tapCoins(3);
      check();
      act(() => {
        vi.advanceTimersByTime(1400);
      });

      // One aggregate outcome: firstTry poisoned by the stage-1 miss, misses summed.
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith({ firstTry: false, misses: 1 });
    } finally {
      vi.useRealTimers();
    }
  });
});
