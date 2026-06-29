import type { ReactNode } from "react";
import { ChildButton } from "@/components/child/ChildButton";
import { CoinBoard } from "@/components/child/CoinBoard";
import { useCoinTask } from "@/components/hooks/useCoinTask";
import { t } from "@/i18n";

interface TaskScreenProps {
  /** Number of coins to render (counting: coins shown; change: tray size). */
  coinCount: number;
  /** Tally that counts as correct (counting: coins shown; change: the change owed). */
  target: number;
  arrangement: "scatter" | "rows_of_5";
  /** Type-specific narrative header; receives `showHint` so it can highlight (e.g. count-up cue). */
  renderHeader: (showHint: boolean) => ReactNode;
  /** Scaffolding-hint copy shown in the retry card after RETRY_HINT_THRESHOLD misses. */
  hintCopy: string;
  successCopy: string;
}

/**
 * Shared task-screen chrome (S-02/S-03): a type-specific header, the shared
 * CoinBoard, the running tally, "Sprawdź", and the gentle retry / hint / success
 * feedback. Counting and change-making differ only in header, hint, target, and
 * success copy — everything here is one implementation both types drive.
 */
export function TaskScreen({ coinCount, target, arrangement, renderHeader, hintCopy, successCopy }: TaskScreenProps) {
  const { counted, tally, status, showHint, toggle, check } = useCoinTask({ coinCount, target });

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6">
      {renderHeader(showHint)}

      <CoinBoard
        counted={counted}
        toggle={toggle}
        arrangement={arrangement}
        disabled={status === "correct"}
        hint={showHint}
      />

      <p className="text-foreground text-lg font-bold" aria-live="polite">
        {t.task.tally.replace("{count}", String(tally))}
      </p>

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
          {showHint && <p className="text-muted-foreground mt-1 text-sm">{hintCopy}</p>}
        </div>
      )}
      {status === "correct" && (
        <div
          role="status"
          className="bg-card border-border animate-in fade-in zoom-in-95 max-w-sm rounded-2xl border p-4 text-center shadow-sm"
        >
          <p className="text-foreground font-bold">{successCopy}</p>
        </div>
      )}
    </div>
  );
}
