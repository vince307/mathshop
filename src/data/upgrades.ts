/**
 * Upgrade catalog + pure derivations (S-06). Client-safe and dependency-free
 * (mirrors `src/data/shift.ts`): imported by the /app/upgrades island for display
 * AND by the buy route for the authoritative purchase, so both sides agree by
 * construction. Costs / levels / effects are named tunable constants —
 * first-guess defaults, adjust after kid-testing.
 *
 * v1 is a single shared catalog for the current single world (per-world catalogs
 * are the multi-world tranche). Gates on cost + world level (S-06) and, for a
 * sparingly-chosen few entries, skill level / task history (S-07). The only
 * functional effect is capacity: owned upgrades add tasks to the shift, so a
 * busier shop earns more via `earningsForShift`.
 */
import type { Competency, ShopState, SkillState } from "@/types";
import { skillLevel } from "@/data/skills";

export interface Upgrade {
  id: string;
  /** i18n key: resolved as `t.upgrades[id]` — the catalog carries no literal copy (L-003). */
  nameKey: string;
  /** Cost in wallet funds (zł). */
  cost: number;
  /** Minimum `business_level` to unlock. */
  requiredWorldLevel: number;
  /** Capacity effect: extra tasks added to a shift when owned (0 = visual-only). */
  extraTasks: number;
  /** Committed art path (served raw from `public/`). */
  art: string;
  /** Display / progression order. */
  order: number;
  /**
   * Optional S-07 skill gate: the child must have reached `level` in `competency`
   * (derived from first-try counts via `skillLevel`) before this can be bought.
   */
  requiredSkill?: { competency: Competency; level: number };
  /**
   * Optional S-07 task-history gate: the child must have `count` completed tasks
   * in `competency` before this can be bought.
   */
  requiredTaskHistory?: { competency: Competency; count: number };
}

/** Max total bonus tasks from owned upgrades — caps how far shift length can grow. */
export const MAX_BONUS_TASKS = 5;

export const UPGRADES: readonly Upgrade[] = [
  {
    id: "sign",
    nameKey: "sign",
    cost: 30,
    requiredWorldLevel: 1,
    extraTasks: 0,
    art: "/illustrations/upgrade-sign.svg",
    order: 1,
  },
  {
    id: "shelf",
    nameKey: "shelf",
    cost: 60,
    requiredWorldLevel: 1,
    extraTasks: 1,
    art: "/illustrations/upgrade-shelf.svg",
    order: 2,
  },
  {
    id: "register",
    nameKey: "register",
    cost: 100,
    requiredWorldLevel: 2,
    extraTasks: 1,
    art: "/illustrations/upgrade-register.svg",
    order: 3,
    // S-07: a register rewards money handling — gate on money skill level 1 (first-guess).
    requiredSkill: { competency: "money", level: 1 },
  },
  {
    id: "slot",
    nameKey: "slot",
    cost: 150,
    requiredWorldLevel: 2,
    extraTasks: 1,
    art: "/illustrations/upgrade-slot.svg",
    order: 4,
  },
  {
    id: "storage",
    nameKey: "storage",
    cost: 210,
    requiredWorldLevel: 3,
    extraTasks: 1,
    art: "/illustrations/upgrade-storage.svg",
    order: 5,
  },
  {
    id: "customers",
    nameKey: "customers",
    cost: 300,
    requiredWorldLevel: 3,
    extraTasks: 1,
    art: "/illustrations/upgrade-customers.svg",
    order: 6,
    // S-07: more customers rewards counting practice — gate on 8 completed math tasks (first-guess).
    requiredTaskHistory: { competency: "math", count: 8 },
  },
] as const;

/** Valid upgrade ids — the closed set for app-layer (zod) validation. */
export const UPGRADE_IDS = UPGRADES.map((u) => u.id) as [string, ...string[]];

const BY_ID = new Map(UPGRADES.map((u) => [u.id, u] as const));

export function getUpgrade(id: string): Upgrade | undefined {
  return BY_ID.get(id);
}

/** Normalize the persisted `shop_state` to the owned-upgrade id list (missing → []). */
export function readPurchased(shopState: Partial<ShopState> | null | undefined): string[] {
  return shopState?.purchased ?? [];
}

export function isOwned(id: string, purchased: string[]): boolean {
  return purchased.includes(id);
}

export interface BuyContext {
  walletBalance: number;
  businessLevel: number;
  purchased: string[];
  /** Normalized per-competency skill (S-07) — feeds the skill/task-history rungs. */
  skillState: SkillState;
}

export type BuyReason = "owned" | "locked" | "skill-locked" | "history-locked" | "insufficient" | "unknown";

export type BuyCheck = { ok: true } | { ok: false; reason: BuyReason };

/**
 * Server-authoritative purchasability — reused by the buy route (authority) and
 * the upgrades screen (display), so they never disagree. Order matters: unknown
 * id first, then already-owned (so an owned upgrade is NEVER retro-locked by a
 * later rung), then world-level lock, then the optional S-07 skill / task-history
 * gates (skipped entirely for entries without them), then affordability.
 */
export function canBuy(upgrade: Upgrade | undefined, ctx: BuyContext): BuyCheck {
  if (!upgrade) return { ok: false, reason: "unknown" };
  if (isOwned(upgrade.id, ctx.purchased)) return { ok: false, reason: "owned" };
  if (ctx.businessLevel < upgrade.requiredWorldLevel) return { ok: false, reason: "locked" };
  if (upgrade.requiredSkill) {
    const { competency, level } = upgrade.requiredSkill;
    if (skillLevel(ctx.skillState[competency].firstTryCorrect) < level) return { ok: false, reason: "skill-locked" };
  }
  if (upgrade.requiredTaskHistory) {
    const { competency, count } = upgrade.requiredTaskHistory;
    if (ctx.skillState[competency].completed < count) return { ok: false, reason: "history-locked" };
  }
  if (ctx.walletBalance < upgrade.cost) return { ok: false, reason: "insufficient" };
  return { ok: true };
}

/** The next upgrade to aim for: cheapest level-eligible unowned, or null if none. */
export function nextUpgrade(ctx: { businessLevel: number; purchased: string[] }): Upgrade | null {
  const eligible = UPGRADES.filter((u) => !isOwned(u.id, ctx.purchased) && u.requiredWorldLevel <= ctx.businessLevel);
  if (eligible.length === 0) return null;
  return eligible.reduce((a, b) => (b.cost < a.cost ? b : a));
}

/** Capacity effect: total bonus tasks from owned upgrades, clamped to `MAX_BONUS_TASKS`. */
export function shiftBonusTasks(purchased: string[]): number {
  const sum = purchased.reduce((n, id) => n + (getUpgrade(id)?.extraTasks ?? 0), 0);
  return Math.min(sum, MAX_BONUS_TASKS);
}
