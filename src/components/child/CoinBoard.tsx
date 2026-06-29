import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

interface CoinBoardProps {
  counted: boolean[];
  toggle: (index: number) => void;
  arrangement: "scatter" | "rows_of_5";
  disabled: boolean;
  /** Pulse the board as the FR-009 scaffolding cue (the "look at the coins" highlight). */
  hint: boolean;
}

/**
 * The tappable-coin board shared by both task types (S-02 till / S-03 change
 * tray). Oversized 64px (`size-16`), non-adjacently-spaced coins; tapping toggles
 * a counted ring + check badge. Each coin carries a positional accessible name
 * so screen-reader users can track the count.
 */
export function CoinBoard({ counted, toggle, arrangement, disabled, hint }: CoinBoardProps) {
  const isGrid = arrangement === "rows_of_5";
  return (
    <div
      className={cn(
        "bg-card border-border w-full rounded-3xl border p-5 shadow-sm transition-all",
        isGrid ? "grid grid-cols-5 gap-4" : "flex flex-wrap justify-center gap-4",
        hint && "ring-primary/40 animate-pulse ring-4",
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
          disabled={disabled}
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
  );
}
