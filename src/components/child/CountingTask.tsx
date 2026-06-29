import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { ChildButton } from "@/components/child/ChildButton";
import { isCorrect } from "@/data/counting-tasks";
import { RETRY_HINT_THRESHOLD, type CountingTask as CountingTaskInstance } from "@/types";
import type { World } from "@/data/worlds";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

/**
 * Counting-task island (S-02). The child counts the coins in the till by tapping
 * each one (tap again to un-count a mistake — toggle); the running tally shows
 * how many are counted. "Sprawdź" submits: a correct tally returns to the start
 * screen with a gentle acknowledgment; a wrong one keeps the taps and, after
 * RETRY_HINT_THRESHOLD misses, highlights the coin pile (FR-009). No payout, no
 * persistence (S-04); no bare-math framing (prd-v2.md:158). All interaction is
 * client-side — no per-tap network round-trip (prd-v2.md:148).
 */
type Status = "idle" | "wrong" | "correct";

interface CountingTaskProps {
  task: CountingTaskInstance;
  world: World;
}

export default function CountingTask({ task, world }: CountingTaskProps) {
  const copy = t.task[task.scenario];
  const [counted, setCounted] = useState<boolean[]>(() => Array<boolean>(task.targetCount).fill(false));
  const [misses, setMisses] = useState(0);
  const [status, setStatus] = useState<Status>("idle");

  const tally = counted.filter(Boolean).length;
  const showHint = status !== "correct" && misses >= RETRY_HINT_THRESHOLD;
  const isGrid = task.arrangement === "rows_of_5";

  // On a correct answer, briefly hold the acknowledgment, then return to the
  // start screen (no shift loop in v1). The timer is cleared on unmount so a
  // fast navigation can't fire a stale redirect.
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
    if (isCorrect(task, tally)) {
      setStatus("correct"); // the redirect is owned by the effect keyed on status
    } else {
      setStatus("wrong");
      setMisses((m) => m + 1);
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6">
      {/* In-world narrative + the counting question, anchored to the child's shop */}
      <div className="text-center">
        <p className="text-primary text-sm font-bold tracking-wide uppercase">{world.name}</p>
        <p className="text-foreground mt-1 text-xl font-bold">{copy.prompt}</p>
        <p className="text-muted-foreground mt-1">{copy.question}</p>
      </div>

      {/* The till — tappable coins; the highlight ring is the scaffolding hint */}
      <div
        className={cn(
          "bg-card border-border w-full rounded-3xl border p-5 shadow-sm transition-all",
          isGrid ? "grid grid-cols-5 gap-4" : "flex flex-wrap justify-center gap-4",
          showHint && "ring-primary/40 animate-pulse ring-4",
        )}
      >
        {counted.map((isCounted, index) => (
          <button
            key={index}
            type="button"
            onClick={() => {
              toggle(index);
            }}
            aria-pressed={isCounted}
            aria-label={t.task.coinLabel.replace("{n}", String(index + 1))}
            disabled={status === "correct"}
            className={cn(
              "relative inline-flex size-16 items-center justify-center rounded-full border-2 transition-all",
              "focus-visible:ring-ring focus-visible:ring-4 focus-visible:outline-none",
              isCounted ? "border-primary ring-primary/30 ring-4" : "border-border hover:border-primary/50",
            )}
          >
            <img src="/illustrations/coin.png" alt="" className="size-full rounded-full object-cover" />
            {isCounted && (
              <span className="bg-primary text-primary-foreground absolute -right-1 -bottom-1 inline-flex size-5 items-center justify-center rounded-full shadow">
                <Check className="size-3" />
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Running tally */}
      <p className="text-foreground text-lg font-bold" aria-live="polite">
        {t.task.tally.replace("{count}", String(tally))}
      </p>

      {/* Submit */}
      <ChildButton variant="gold" onClick={check} disabled={status === "correct"}>
        {t.task.check}
      </ChildButton>

      {/* Feedback — gentle retry / hint / success (never punishing) */}
      {status === "wrong" && (
        <div
          role="status"
          className="bg-card border-border animate-in fade-in max-w-sm rounded-2xl border p-4 text-center shadow-sm"
        >
          <p className="text-foreground font-bold">{t.task.retry}</p>
          {showHint && <p className="text-muted-foreground mt-1 text-sm">{copy.hint}</p>}
        </div>
      )}
      {status === "correct" && (
        <div
          role="status"
          className="bg-card border-border animate-in fade-in zoom-in-95 max-w-sm rounded-2xl border p-4 text-center shadow-sm"
        >
          <p className="text-foreground font-bold">{copy.success}</p>
        </div>
      )}
    </div>
  );
}
