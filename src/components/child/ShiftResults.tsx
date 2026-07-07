import { CircleCheck, Star } from "lucide-react";
import { ChildButton } from "@/components/child/ChildButton";
import { childCard } from "@/components/child/childCard";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

interface ShiftResultsProps {
  earned: number;
  stars: 0 | 1 | 2 | 3;
  leveledUp: boolean;
  /** True when the child can now afford an upgrade — shows a gentle, factual nudge (S-06). */
  canUpgrade: boolean;
  /** Cheapest eligible unowned upgrade + post-shift wallet (S-13 progress card); null when none. */
  nextInfo: { id: string; art: string; cost: number; wallet: number } | null;
}

/** Resolve the localized upgrade name (catalog ids match the i18n keys; L-003). */
function upgradeName(id: string): string {
  return t.upgrades[id as keyof typeof t.upgrades].name;
}

/**
 * Shift-end results celebration (S-04/S-05, S-13 spirit polish). The big payoff
 * (FR-008) on a pale-green success panel with a check disc — the mockups'
 * celebration language: earnings and stars as two labeled cells, gold strictly
 * for money/stars. When the new balance can afford an upgrade, a gentle factual
 * nudge links to /app/upgrades; otherwise a small art+progress card shows the
 * honest gap to the next upgrade (no urgency). Warm at every level — a 0-star
 * result still pays out and never reads as "game over".
 */
export default function ShiftResults({ earned, stars, leveledUp, canUpgrade, nextInfo }: ShiftResultsProps) {
  const starCopy = [t.results.star0, t.results.star1, t.results.star2, t.results.star3][stars];
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
      {/* Celebration panel — success-tinted, never punishing */}
      <div className="bg-success/10 border-success/30 flex w-full flex-col items-center gap-4 rounded-3xl border p-6">
        <span className="bg-success text-success-foreground animate-in zoom-in inline-flex size-14 items-center justify-center rounded-full shadow-sm">
          <CircleCheck className="size-8" aria-hidden="true" />
        </span>
        <h1 className="text-foreground text-2xl font-extrabold">{t.results.heading}</h1>

        {/* Reward cells: earnings + stars, side by side */}
        <div className="flex w-full items-stretch gap-3">
          <div className={childCard("2xl", "flex flex-1 flex-col items-center gap-1 p-4")}>
            <img src="/illustrations/coin-stack.png" alt="" className="size-10 object-contain" />
            <p className="text-foreground font-extrabold">
              {t.results.earnedLabel.replace("{earned}", String(earned))}
            </p>
            <p className="text-muted-foreground text-xs">{t.results.savingsHint}</p>
          </div>
          <div className={childCard("2xl", "flex flex-1 flex-col items-center justify-center gap-1 p-4")}>
            <div className="flex gap-1" role="img" aria-label={t.results.starsLabel.replace("{earned}", String(stars))}>
              {[0, 1, 2].map((i) => (
                <Star
                  key={i}
                  className={cn(
                    "size-8 transition-all",
                    i < stars ? "text-accent animate-in zoom-in fill-current" : "text-muted-foreground",
                  )}
                />
              ))}
            </div>
            <p className="text-foreground text-sm font-bold">{starCopy}</p>
          </div>
        </div>

        {leveledUp && <p className="text-primary font-bold">{t.results.levelUp}</p>}
      </div>

      {/* Next-upgrade: affordable → factual nudge; not yet → honest progress card */}
      {canUpgrade && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-foreground font-semibold">{t.results.upgradesNudge}</p>
        </div>
      )}
      {!canUpgrade && nextInfo && (
        <div className={childCard("2xl", "flex w-full items-center gap-4 p-4 text-left")}>
          <img src={nextInfo.art} alt="" className="size-12 shrink-0 object-contain" loading="lazy" />
          <div className="min-w-0 flex-1">
            <div className="bg-muted h-3 w-full overflow-hidden rounded-full">
              <div
                className="bg-accent h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.round((nextInfo.wallet / nextInfo.cost) * 100))}%` }}
              />
            </div>
            <p className="text-muted-foreground mt-1 text-sm font-semibold">
              {t.upgradeShop.nextProgress
                .replace("{amount}", String(nextInfo.cost - nextInfo.wallet))
                .replace("{name}", upgradeName(nextInfo.id))}
            </p>
          </div>
        </div>
      )}

      {/* Action row: primary continue + outline upgrades */}
      <div className="flex w-full flex-col items-center gap-3">
        <ChildButton
          variant="primary"
          className="w-full"
          onClick={() => {
            window.location.href = "/app/start";
          }}
        >
          {t.results.backToStart}
        </ChildButton>
        {canUpgrade && (
          <a href="/app/upgrades" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}>
            {t.results.upgradesNudgeLink}
          </a>
        )}
      </div>
    </div>
  );
}
