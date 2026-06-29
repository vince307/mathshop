import { useEffect, useState } from "react";
import { RETRY_HINT_THRESHOLD } from "@/types";

export type CoinTaskStatus = "idle" | "wrong" | "correct";

export interface CoinTaskState {
  counted: boolean[];
  tally: number;
  status: CoinTaskStatus;
  showHint: boolean;
  toggle: (index: number) => void;
  check: () => void;
}

/**
 * Shared tap-coins interaction (S-02 counting + S-03 change-making). Renders
 * `coinCount` coins as toggle state, tracks a running tally, and on `check`
 * compares it to `target`: correct → after a short beat navigate to /app/start
 * (timer cleared on unmount so a fast nav can't fire a stale redirect); wrong →
 * bump the miss counter. The scaffolding hint surfaces after
 * RETRY_HINT_THRESHOLD misses (FR-009). No persistence / no per-tap network.
 */
export function useCoinTask({ coinCount, target }: { coinCount: number; target: number }): CoinTaskState {
  const [counted, setCounted] = useState<boolean[]>(() => Array<boolean>(coinCount).fill(false));
  const [misses, setMisses] = useState(0);
  const [status, setStatus] = useState<CoinTaskStatus>("idle");

  const tally = counted.filter(Boolean).length;
  const showHint = status !== "correct" && misses >= RETRY_HINT_THRESHOLD;

  useEffect(() => {
    if (status !== "correct") return;
    const timer = window.setTimeout(() => {
      window.location.href = "/app/start";
    }, 1400);
    return () => {
      window.clearTimeout(timer);
    };
  }, [status]);

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
