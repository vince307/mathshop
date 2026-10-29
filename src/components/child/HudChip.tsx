import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { t } from "@/i18n";

/**
 * The HUD chip family (S-13 primitive): rounded-full pills showing status at a
 * glance. `WalletPill` (absorbed the identical copies on start/upgrades) pairs
 * the coin art with a gold amount — gold is the money color, never an action.
 * `LevelBadge` is its secondary-toned sibling for the business level.
 */
export function WalletPill({ amount, label, live = false }: { amount: number; label: string; live?: boolean }) {
  return (
    <div className="bg-card border-border flex items-center gap-2 rounded-full border px-3 py-1.5 shadow-sm">
      <img src="/illustrations/coin-stack.png" alt="" className="size-6 object-contain" loading="lazy" />
      <span className="sr-only">{label}</span>
      {/* Money always carries its unit, as in the mockups' "126 zł" HUD chip.
          `live` marks the shell's copy so an island that spends money (the upgrade
          shop) can refresh it without a page reload — see AppShell's listener. */}
      <span className="text-accent text-lg font-extrabold" data-wallet-amount={live ? "" : undefined}>
        {t.start.amountZl.replace("{amount}", String(amount))}
      </span>
    </div>
  );
}

export function LevelBadge({ children, withStar = false }: { children: ReactNode; withStar?: boolean }) {
  return (
    <div className="bg-secondary text-secondary-foreground flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold">
      {withStar && <Star className="text-accent size-4 fill-current" aria-hidden="true" />}
      {children}
    </div>
  );
}
