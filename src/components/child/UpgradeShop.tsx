import { useState } from "react";
import type { World } from "@/data/worlds";
import { ChildButton } from "@/components/child/ChildButton";
import { ShopArt } from "@/components/child/ShopArt";
import { UPGRADES, canBuy, isOwned, nextUpgrade, type Upgrade } from "@/data/upgrades";
import { t } from "@/i18n";

interface UpgradeShopProps {
  profileId: string;
  walletBalance: number;
  businessLevel: number;
  purchased: string[];
  world: World;
}

/** Resolve the localized upgrade name (catalog ids match the i18n keys; L-003). */
function upgradeName(id: string): string {
  return t.upgrades[id as keyof typeof t.upgrades].name;
}

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), template);
}

/**
 * The dedicated /app/upgrades surface (S-06): the child browses the catalog split
 * into **affordable** (buyable now, framed as a decision), **locked** (shows the
 * single missing requirement — funds or level, in plain Polish), and **owned**,
 * and buys via POST /api/upgrades/buy. The server is authoritative (it recomputes
 * cost/level/ownership); the client only names an id and, on success, applies the
 * returned wallet + owned list to local state so the shop reflects the buy without
 * a full reload. Copy is warm and factual — no timers/scarcity (guardrail).
 */
export default function UpgradeShop({ profileId, walletBalance, businessLevel, purchased, world }: UpgradeShopProps) {
  const [wallet, setWallet] = useState(walletBalance);
  const [owned, setOwned] = useState(purchased);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  const ctx = { walletBalance: wallet, businessLevel, purchased: owned };
  const affordable = UPGRADES.filter((u) => canBuy(u, ctx).ok);
  const locked = UPGRADES.filter((u) => !isOwned(u.id, owned) && !canBuy(u, ctx).ok);
  const ownedList = UPGRADES.filter((u) => isOwned(u.id, owned));
  const next = nextUpgrade({ businessLevel, purchased: owned });

  async function buy(upgrade: Upgrade) {
    setBuyingId(upgrade.id);
    setErrorId(null);
    const body = new FormData();
    body.set("profileId", profileId);
    body.set("upgradeId", upgrade.id);
    try {
      const res = await fetch("/api/upgrades/buy", { method: "POST", body });
      if (!res.ok) {
        setErrorId(upgrade.id);
        setBuyingId(null);
        return;
      }
      const data = (await res.json()) as { walletBalance: number; purchased: string[] };
      setWallet(data.walletBalance);
      setOwned(data.purchased);
      setBuyingId(null);
    } catch {
      setErrorId(upgrade.id);
      setBuyingId(null);
    }
  }

  function lockedReason(upgrade: Upgrade): string {
    const check = canBuy(upgrade, ctx);
    if (check.ok) return "";
    if (check.reason === "locked") {
      return fill(t.upgradeShop.lockedByLevel, { level: upgrade.requiredWorldLevel });
    }
    return fill(t.upgradeShop.lockedByFunds, { amount: upgrade.cost - wallet });
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-8">
      {/* Header: title + wallet */}
      <div className="flex items-center justify-between">
        <h1 className="text-foreground text-2xl font-extrabold">{t.upgradeShop.title}</h1>
        <div className="bg-card border-border flex items-center gap-2 rounded-full border px-3 py-1.5 shadow-sm">
          <img src="/illustrations/coin-stack.png" alt="" className="size-6 object-contain" loading="lazy" />
          <span className="sr-only">{t.upgradeShop.walletLabel}</span>
          <span className="text-accent text-lg font-extrabold">{wallet}</span>
        </div>
      </div>

      {/* The shop as it stands — grows as owned upgrades are bought (S-06) */}
      <div className="bg-card border-border overflow-hidden rounded-3xl border shadow-sm">
        <ShopArt world={world} purchased={owned} />
      </div>

      {/* Next-upgrade progress / all-owned (factual encouragement, no urgency) */}
      {next && wallet < next.cost ? (
        <p className="text-muted-foreground text-sm font-semibold">
          {fill(t.upgradeShop.nextProgress, { amount: next.cost - wallet, name: upgradeName(next.id) })}
        </p>
      ) : ownedList.length === UPGRADES.length ? (
        <p className="text-primary text-sm font-bold">{t.upgradeShop.allOwned}</p>
      ) : null}

      {/* Affordable — the framed decision */}
      <section className="flex flex-col gap-4">
        <h2 className="text-foreground text-lg font-bold">{t.upgradeShop.affordableHeading}</h2>
        {affordable.length > 0 ? (
          <>
            <p className="text-muted-foreground text-sm">{fill(t.upgradeShop.decisionPrompt, { wallet })}</p>
            <ul className="flex flex-col gap-4">
              {affordable.map((u) => (
                <li
                  key={u.id}
                  className="bg-card border-border flex items-center gap-4 rounded-2xl border p-4 shadow-sm"
                >
                  <img src={u.art} alt="" className="size-16 shrink-0 object-contain" />
                  <div className="flex-1">
                    <p className="text-foreground font-bold">{upgradeName(u.id)}</p>
                    <p className="text-accent font-extrabold">{fill(t.upgradeShop.costLabel, { cost: u.cost })}</p>
                    {errorId === u.id && (
                      <p className="text-destructive text-sm font-semibold">{t.upgradeShop.buyError}</p>
                    )}
                  </div>
                  <ChildButton
                    variant="gold"
                    className="min-h-14 px-6 text-lg"
                    disabled={buyingId === u.id}
                    onClick={() => buy(u)}
                  >
                    {buyingId === u.id ? t.upgradeShop.buying : t.upgradeShop.buy}
                  </ChildButton>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">{t.upgradeShop.emptyAffordable}</p>
        )}
      </section>

      {/* Locked — one concrete missing requirement each */}
      {locked.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-muted-foreground text-lg font-bold">{t.upgradeShop.lockedHeading}</h2>
          <ul className="flex flex-col gap-4">
            {locked.map((u) => (
              <li
                key={u.id}
                className="border-border flex items-center gap-4 rounded-2xl border border-dashed p-4 opacity-80"
              >
                <img src={u.art} alt="" className="size-16 shrink-0 object-contain grayscale" />
                <div className="flex-1">
                  <p className="text-foreground font-bold">{upgradeName(u.id)}</p>
                  <p className="text-muted-foreground text-sm font-semibold">{lockedReason(u)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Owned */}
      {ownedList.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-foreground text-lg font-bold">{t.upgradeShop.ownedHeading}</h2>
          <ul className="flex flex-col gap-4">
            {ownedList.map((u) => (
              <li key={u.id} className="bg-secondary/40 border-border flex items-center gap-4 rounded-2xl border p-4">
                <img src={u.art} alt="" className="size-16 shrink-0 object-contain" />
                <div className="flex-1">
                  <p className="text-foreground font-bold">{upgradeName(u.id)}</p>
                </div>
                <span className="text-primary text-sm font-bold">{t.upgradeShop.ownedTag}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <a href="/app/start" className="text-muted-foreground hover:text-foreground text-center text-sm font-semibold">
        {t.upgradeShop.back}
      </a>
    </div>
  );
}
