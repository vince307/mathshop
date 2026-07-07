import { useState } from "react";
import { CircleCheck, Check, Lock } from "lucide-react";
import type { World } from "@/data/worlds";
import type { SkillState } from "@/types";
import { ChildButton } from "@/components/child/ChildButton";
import { WalletPill } from "@/components/child/HudChip";
import { childCard } from "@/components/child/childCard";
import { ShopArt } from "@/components/child/ShopArt";
import { SkillBars } from "@/components/child/SkillBars";
import { UPGRADES, canBuy, isOwned, nextUpgrade, type Upgrade } from "@/data/upgrades";
import { t } from "@/i18n";

interface UpgradeShopProps {
  profileId: string;
  walletBalance: number;
  businessLevel: number;
  purchased: string[];
  /** Normalized per-competency skill (S-07) — feeds the skill/task-history gate. */
  skillState: SkillState;
  world: World;
}

/** Resolve the localized upgrade copy (catalog ids match the i18n keys; L-003). */
function upgradeCopy(id: string): { name: string; desc: string } {
  return t.upgrades[id as keyof typeof t.upgrades];
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
 *
 * S-13 spirit polish: art-forward tile cards (mockup catalog language), honest
 * state affordances (green "Dostępne" pill / lock chip with the requirement),
 * benefit lines from the existing desc keys, and a warm inline unlock moment
 * after a successful buy — presentational state only, the buy flow is untouched.
 */
export default function UpgradeShop({
  profileId,
  walletBalance,
  businessLevel,
  purchased,
  skillState,
  world,
}: UpgradeShopProps) {
  const [wallet, setWallet] = useState(walletBalance);
  const [owned, setOwned] = useState(purchased);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  // The unlock moment (S-13): the id just bought, shown as an inline celebration
  // card until the child taps it away. Pure presentation on top of the buy state.
  const [unlockedId, setUnlockedId] = useState<string | null>(null);

  const ctx = { walletBalance: wallet, businessLevel, purchased: owned, skillState };
  const affordable = UPGRADES.filter((u) => canBuy(u, ctx).ok);
  const locked = UPGRADES.filter((u) => !isOwned(u.id, owned) && !canBuy(u, ctx).ok);
  const ownedList = UPGRADES.filter((u) => isOwned(u.id, owned));
  const next = nextUpgrade({ businessLevel, purchased: owned });
  const unlocked = unlockedId ? UPGRADES.find((u) => u.id === unlockedId) : undefined;

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
      setUnlockedId(upgrade.id);
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
    if (check.reason === "skill-locked" && upgrade.requiredSkill) {
      return fill(t.upgradeShop.lockedBySkill, {
        competency: t.skills[upgrade.requiredSkill.competency],
        level: upgrade.requiredSkill.level,
      });
    }
    if (check.reason === "history-locked" && upgrade.requiredTaskHistory) {
      return fill(t.upgradeShop.lockedByHistory, {
        competency: t.skills[upgrade.requiredTaskHistory.competency],
        count: upgrade.requiredTaskHistory.count,
      });
    }
    return fill(t.upgradeShop.lockedByFunds, { amount: upgrade.cost - wallet });
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-8">
      {/* Header: title + wallet */}
      <div className="flex items-center justify-between">
        <h1 className="text-foreground text-2xl font-extrabold">{t.upgradeShop.title}</h1>
        <WalletPill amount={wallet} label={t.upgradeShop.walletLabel} />
      </div>

      {/* The shop as it stands — grows as owned upgrades are bought (S-06) */}
      <div className={childCard("3xl", "overflow-hidden")}>
        <ShopArt world={world} purchased={owned} />
      </div>

      {/* Unlock moment (S-13) — warm, factual, dismissed by the child */}
      {unlocked && (
        <div
          role="status"
          className="bg-success/10 border-success/30 animate-in fade-in zoom-in-95 flex flex-col items-center gap-3 rounded-3xl border p-6 text-center"
        >
          <span className="bg-success text-success-foreground inline-flex size-12 items-center justify-center rounded-full shadow-sm">
            <CircleCheck className="size-7" aria-hidden="true" />
          </span>
          <p className="text-foreground text-xl font-extrabold">{t.upgradeShop.unlockedHeading}</p>
          <img src={unlocked.art} alt="" className="size-20 object-contain" />
          <p className="text-foreground font-bold">{upgradeCopy(unlocked.id).name}</p>
          <p className="text-muted-foreground text-sm">{upgradeCopy(unlocked.id).desc}</p>
          <ChildButton
            variant="primary"
            className="min-h-14 px-6 text-lg"
            onClick={() => {
              setUnlockedId(null);
            }}
          >
            {t.upgradeShop.unlockedDismiss}
          </ChildButton>
        </div>
      )}

      {/* Per-competency skill progress (S-07) — learning reflected back to the child */}
      <SkillBars skillState={skillState} />

      {/* Next-upgrade progress / all-owned (factual encouragement, no urgency) */}
      {next && wallet < next.cost ? (
        <p className="text-muted-foreground text-sm font-semibold">
          {fill(t.upgradeShop.nextProgress, { amount: next.cost - wallet, name: upgradeCopy(next.id).name })}
        </p>
      ) : ownedList.length === UPGRADES.length ? (
        <p className="text-primary text-sm font-bold">{t.upgradeShop.allOwned}</p>
      ) : null}

      {/* Affordable — the framed decision, art-forward tiles */}
      <section className="flex flex-col gap-4">
        <h2 className="text-foreground text-lg font-bold">{t.upgradeShop.affordableHeading}</h2>
        {affordable.length > 0 ? (
          <>
            <p className="text-muted-foreground text-sm">{fill(t.upgradeShop.decisionPrompt, { wallet })}</p>
            <ul className="grid grid-cols-2 gap-4">
              {affordable.map((u) => (
                <li key={u.id} className={childCard("2xl", "flex flex-col items-center gap-2 p-4 text-center")}>
                  <span className="bg-success/15 text-success rounded-full px-2.5 py-0.5 text-xs font-bold">
                    {t.upgradeShop.availableTag}
                  </span>
                  <img src={u.art} alt="" className="size-20 object-contain" />
                  <p className="text-foreground leading-tight font-bold">{upgradeCopy(u.id).name}</p>
                  <p className="text-muted-foreground text-xs leading-snug">{upgradeCopy(u.id).desc}</p>
                  <p className="text-accent flex items-center gap-1 font-extrabold">
                    <img src="/illustrations/coin.png" alt="" className="size-4 rounded-full object-cover" />
                    {fill(t.upgradeShop.costLabel, { cost: u.cost })}
                  </p>
                  {errorId === u.id && (
                    <p className="text-destructive text-xs font-semibold">{t.upgradeShop.buyError}</p>
                  )}
                  <ChildButton
                    variant="primary"
                    className="min-h-14 w-full px-4 text-lg"
                    disabled={buyingId !== null}
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

      {/* Locked — one concrete missing requirement each, honest and calm */}
      {locked.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-muted-foreground text-lg font-bold">{t.upgradeShop.lockedHeading}</h2>
          <ul className="grid grid-cols-2 gap-4">
            {locked.map((u) => (
              <li
                key={u.id}
                className="border-border flex flex-col items-center gap-2 rounded-2xl border border-dashed p-4 text-center opacity-80"
              >
                <img src={u.art} alt="" className="size-20 object-contain grayscale" />
                <p className="text-foreground leading-tight font-bold">{upgradeCopy(u.id).name}</p>
                <p className="bg-muted text-muted-foreground flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">
                  <Lock className="size-3 shrink-0" aria-hidden="true" />
                  <span>{lockedReason(u)}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Owned — the shop already has these */}
      {ownedList.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-foreground text-lg font-bold">{t.upgradeShop.ownedHeading}</h2>
          <ul className="flex flex-col gap-4">
            {ownedList.map((u) => (
              <li key={u.id} className="bg-secondary/40 border-border flex items-center gap-4 rounded-2xl border p-4">
                <img src={u.art} alt="" className="size-16 shrink-0 object-contain" />
                <div className="flex-1">
                  <p className="text-foreground font-bold">{upgradeCopy(u.id).name}</p>
                </div>
                <span className="text-primary flex items-center gap-1 text-sm font-bold">
                  <Check className="size-4" aria-hidden="true" />
                  {t.upgradeShop.ownedTag}
                </span>
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
