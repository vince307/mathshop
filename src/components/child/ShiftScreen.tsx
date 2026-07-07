import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Task } from "@/types";
import type { World } from "@/data/worlds";
import CountingTask from "@/components/child/CountingTask";
import ChangeMakingTask from "@/components/child/ChangeMakingTask";
import ShiftResults from "@/components/child/ShiftResults";
import { ChildButton } from "@/components/child/ChildButton";
import OfflineOverlay from "@/components/child/OfflineOverlay";
import { useConnectivity } from "@/components/hooks/useConnectivity";
import { earningsForShift, generateShift, starsForShift } from "@/data/shift";
import { isNetworkFailure, SHIFT_SAVE_TIMEOUT_MS } from "@/lib/connectivity";
import { nextUpgrade, shiftBonusTasks } from "@/data/upgrades";
import { competencyForTaskType, readSkillState } from "@/data/skills";
import type { TaskOutcome } from "@/components/hooks/useCoinTask";
import { t } from "@/i18n";

interface ShiftScreenProps {
  startingLevel: number;
  world: World;
  profileId: string;
  /** Pre-shift wallet balance — the shift's earnings add to it (S-06 results nudge). */
  walletBalance: number;
  /** Owned-upgrade ids — feed the results nudge's next-upgrade check (S-06). */
  purchased: string[];
}

type Phase = "playing" | "saving" | "results" | "error";

interface Outcome {
  earned: number;
  stars: 0 | 1 | 2 | 3;
  leveledUp: boolean;
  /** Whether the post-shift wallet can afford an upgrade — drives the results nudge. */
  canUpgrade: boolean;
}

/**
 * Shift orchestrator (S-04). Runs a generated sequence of tasks, auto-advancing
 * on each task's success beat (a fresh per-task `key` resets the hook state), and
 * accumulates per-task accuracy. When the shift ends it POSTs the result ONCE
 * (wallet earnings recomputed server-side from accuracy) and shows the celebration, or a
 * gentle fallback on persist failure. Mid-shift state is never persisted (FR-016);
 * the only server write is the single shift-end POST.
 */
export default function ShiftScreen({ startingLevel, world, profileId, walletBalance, purchased }: ShiftScreenProps) {
  // Owned upgrades lengthen the shift (capacity effect, S-06): a busier shop means
  // more practice + more earning via the unchanged `earningsForShift`.
  const tasks = useMemo<Task[]>(
    () => generateShift(startingLevel, shiftBonusTasks(purchased)),
    [startingLevel, purchased],
  );
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<TaskOutcome[]>([]);
  const [phase, setPhase] = useState<Phase>("playing");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const savedRef = useRef(false);
  // Offline halt (S-12): the overlay renders OVER the shift, never unmounting
  // it — discard happens only when the child taps through to /app/start.
  const { offline, markOffline } = useConnectivity();

  const advance = useCallback((o: TaskOutcome) => {
    setResults((prev) => [...prev, o]);
    setIndex((i) => i + 1);
  }, []);

  // When the last task completes, persist the shift exactly once (savedRef guards
  // against React strict-mode double-invoke / re-renders).
  useEffect(() => {
    if (results.length < tasks.length || savedRef.current) return;
    savedRef.current = true;
    setPhase("saving");

    const taskCount = results.length;
    const cleanCount = results.filter((r) => r.firstTry).length;
    const earned = earningsForShift(taskCount, cleanCount);
    const stars = starsForShift(taskCount, cleanCount);

    // Per-competency skill delta (S-07): pair each task's type with its outcome.
    // Only the two play competencies accrue here (decisions is a purchase event);
    // the server caps + reconciles + folds this monotonically into skill_state.
    const delta = readSkillState(null);
    results.forEach((r, i) => {
      const bucket = delta[competencyForTaskType(tasks[i].type)];
      bucket.completed += 1;
      bucket.firstTryCorrect += r.firstTry ? 1 : 0;
      bucket.misses += r.misses;
    });

    const body = new FormData();
    body.set("profileId", profileId);
    body.set("taskCount", String(taskCount));
    body.set("cleanCount", String(cleanCount));
    body.set("skills", JSON.stringify({ math: delta.math, money: delta.money }));

    // Time-bounded (S-12): a hung network fails fast into the gentle error path
    // instead of stranding the child on "saving" forever.
    fetch("/api/shifts/complete", { method: "POST", body, signal: AbortSignal.timeout(SHIFT_SAVE_TIMEOUT_MS) })
      .then(async (res) => {
        if (!res.ok) {
          setPhase("error");
          return;
        }
        const data = (await res.json()) as { leveledUp: boolean; businessLevel: number };
        // Post-shift affordability: does the new wallet cover the cheapest
        // level-eligible unowned upgrade? Drives the (factual) results nudge.
        const next = nextUpgrade({ businessLevel: data.businessLevel, purchased });
        const canUpgrade = next !== null && walletBalance + earned >= next.cost;
        setOutcome({ earned, stars, leveledUp: data.leveledUp, canUpgrade });
        setPhase("results");
      })
      .catch((err: unknown) => {
        // Network-shaped failure (transport dead / timed out) → the in-world
        // offline halt; anything else keeps the server-error fallback (S-12).
        if (isNetworkFailure(err)) {
          markOffline();
        } else {
          setPhase("error");
        }
      });
  }, [results, tasks, profileId, walletBalance, purchased, markOffline]);

  if (phase === "results" && outcome) {
    return (
      <ShiftResults
        earned={outcome.earned}
        stars={outcome.stars}
        leveledUp={outcome.leveledUp}
        canUpgrade={outcome.canUpgrade}
      />
    );
  }

  if (phase === "error") {
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center" role="status">
        <p className="text-foreground text-xl font-bold">{t.results.saveError}</p>
        <ChildButton
          variant="gold"
          onClick={() => {
            window.location.href = "/app/start";
          }}
        >
          {t.results.backToStart}
        </ChildButton>
      </div>
    );
  }

  const task = phase === "playing" ? tasks[index] : undefined;

  // "saving", or the transient render after the last advance (index out of range,
  // before the effect flips the phase).
  if (!task) {
    return (
      <>
        {offline && <OfflineOverlay />}
        <p className="text-muted-foreground text-lg font-bold" role="status">
          {t.results.saving}
        </p>
      </>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4">
      {offline && <OfflineOverlay />}
      <p className="text-muted-foreground text-sm font-semibold">
        {t.results.progress.replace("{current}", String(index + 1)).replace("{total}", String(tasks.length))}
      </p>
      {task.type === "counting" ? (
        <CountingTask key={index} task={task} world={world} onComplete={advance} />
      ) : (
        <ChangeMakingTask key={index} task={task} world={world} onComplete={advance} />
      )}
    </div>
  );
}
