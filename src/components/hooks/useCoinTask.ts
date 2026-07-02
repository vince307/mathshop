import { useEffect, useState } from "react";
import { RETRY_HINT_THRESHOLD } from "@/types";

export type CoinTaskStatus = "idle" | "wrong" | "correct";

/**
 * Per-task outcome surfaced at success. `firstTry` (no misses) drives shift
 * accuracy/earnings; `misses` (the exact wrong-attempt count, S-07) feeds the
 * per-competency skill signal the shift folds server-side.
 */
export interface TaskOutcome {
  firstTry: boolean;
  misses: number;
}

export interface CoinTaskState {
  counted: boolean[];
  tally: number;
  status: CoinTaskStatus;
  showHint: boolean;
  toggle: (index: number) => void;
  check: () => void;
}

/** Default completion: return to the start screen (standalone S-02/S-03 use). */
function goToStart() {
  window.location.href = "/app/start";
}

/**
 * Shared tap-coins interaction (S-02 counting + S-03 change-making + S-04 shift).
 * Renders `coinCount` coins as toggle state, tracks a running tally, and on
 * `check` compares it to `target`: correct → after a short beat call `onComplete`
 * (default: navigate to /app/start; in a shift it advances to the next task),
 * passing `{ firstTry }` for accuracy; wrong → bump the miss counter. The
 * scaffolding hint surfaces after RETRY_HINT_THRESHOLD misses (FR-009). The timer
 * is cleared on unmount so a fast nav can't fire a stale completion.
 */
export function useCoinTask({
  coinCount,
  target,
  onComplete = goToStart,
}: {
  coinCount: number;
  target: number;
  onComplete?: (outcome: TaskOutcome) => void;
}): CoinTaskState {
  const [counted, setCounted] = useState<boolean[]>(() => Array<boolean>(coinCount).fill(false));
  const [misses, setMisses] = useState(0);
  const [status, setStatus] = useState<CoinTaskStatus>("idle");

  const tally = counted.filter(Boolean).length;
  const showHint = status !== "correct" && misses >= RETRY_HINT_THRESHOLD;

  useEffect(() => {
    if (status !== "correct") return;
    const timer = window.setTimeout(() => {
      onComplete({ firstTry: misses === 0, misses });
    }, 1400);
    return () => {
      window.clearTimeout(timer);
    };
  }, [status, onComplete, misses]);

  function toggle(index: number) {
    if (status === "correct") return;
    setStatus("idle"); // clear the gentle-retry message the moment they adjust
    setCounted((prev) => prev.map((v, i) => (i === index ? !v : v)));
  }

  function check() {
    if (tally === target) {
      setStatus("correct"); // the redirect is owned by the effect keyed on status
    } else {
      setStatus("wrong");
      setMisses((m) => m + 1);
    }
  }

  return { counted, tally, status, showHint, toggle, check };
}
