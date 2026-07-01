import { Star } from "lucide-react";
import { ChildButton } from "@/components/child/ChildButton";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

interface ShiftResultsProps {
  earned: number;
  stars: 0 | 1 | 2 | 3;
  leveledUp: boolean;
}

/**
 * Shift-end results celebration (S-04/S-05). The big payoff (FR-008): wallet
 * earnings ("Do portfela") + 0–3 stars, with an optional "level up!" text (shop
 * art / spending is S-06). Warm at every level — a 0-star result still pays out
 * and never reads as "game over". Returns to the start screen, which re-reads the
 * persisted wallet.
 */
export default function ShiftResults({ earned, stars, leveledUp }: ShiftResultsProps) {
  const starCopy = [t.results.star0, t.results.star1, t.results.star2, t.results.star3][stars];
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
      <h1 className="text-foreground text-2xl font-extrabold">{t.results.heading}</h1>

      <div className="flex gap-2" role="img" aria-label={t.results.starsLabel.replace("{earned}", String(stars))}>
        {[0, 1, 2].map((i) => (
          <Star
            key={i}
            className={cn(
              "size-12 transition-all",
              i < stars ? "text-accent animate-in zoom-in fill-current" : "text-muted-foreground",
            )}
          />
        ))}
      </div>
      <p className="text-foreground font-bold">{starCopy}</p>

      <div className="bg-card border-border flex flex-col items-center gap-1 rounded-2xl border p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/illustrations/coin-stack.png" alt="" className="size-10 object-contain" />
          <p className="text-foreground text-xl font-extrabold">
            {t.results.earnedLabel.replace("{earned}", String(earned))}
          </p>
        </div>
        <p className="text-muted-foreground text-sm">{t.results.savingsHint}</p>
      </div>

      {leveledUp && <p className="text-primary font-bold">{t.results.levelUp}</p>}

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
