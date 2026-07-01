import { describe, expect, it } from "vitest";
import {
  canBuy,
  getUpgrade,
  isOwned,
  MAX_BONUS_TASKS,
  nextUpgrade,
  readPurchased,
  shiftBonusTasks,
  UPGRADES,
} from "@/data/upgrades";

/**
 * Pure upgrade catalog + derivations (S-06). No DOM / Supabase. These are the
 * same fns the buy route uses to authorize a purchase, so they lock the
 * server-authoritative rules.
 */

function up(id: string) {
  const u = getUpgrade(id);
  if (!u) throw new Error(`test setup: no upgrade "${id}"`);
  return u;
}
const sign = up("sign"); // cost 30, level 1, +0
const shelf = up("shelf"); // cost 60, level 1, +1
const register = up("register"); // cost 100, level 2, +1

describe("readPurchased", () => {
  it("normalizes missing / empty / populated shop_state", () => {
    expect(readPurchased(undefined)).toEqual([]);
    expect(readPurchased(null)).toEqual([]);
    expect(readPurchased({})).toEqual([]);
    expect(readPurchased({ purchased: ["sign", "shelf"] })).toEqual(["sign", "shelf"]);
  });
});

describe("canBuy", () => {
  const ctx = { walletBalance: 1000, businessLevel: 3, purchased: [] as string[] };

  it("ok when affordable, level-met, unowned", () => {
    expect(canBuy(shelf, ctx)).toEqual({ ok: true });
  });
  it("unknown for a missing upgrade", () => {
    expect(canBuy(getUpgrade("nope"), ctx)).toEqual({ ok: false, reason: "unknown" });
  });
  it("owned when already purchased", () => {
    expect(canBuy(shelf, { ...ctx, purchased: ["shelf"] })).toEqual({ ok: false, reason: "owned" });
  });
  it("locked when world level too low", () => {
    expect(canBuy(register, { ...ctx, businessLevel: 1 })).toEqual({ ok: false, reason: "locked" });
  });
  it("insufficient when funds below cost", () => {
    expect(canBuy(shelf, { ...ctx, walletBalance: shelf.cost - 1 })).toEqual({ ok: false, reason: "insufficient" });
  });
  it("owned takes precedence over locked/insufficient", () => {
    expect(canBuy(shelf, { walletBalance: 0, businessLevel: 0, purchased: ["shelf"] })).toEqual({
      ok: false,
      reason: "owned",
    });
  });
});

describe("nextUpgrade", () => {
  it("picks the cheapest level-eligible unowned", () => {
    expect(nextUpgrade({ businessLevel: 1, purchased: [] })).toEqual(sign); // sign (30) cheapest at level 1
  });
  it("skips owned and level-locked", () => {
    // sign owned → next cheapest at level 1 is shelf (60); register (level 2) still locked at level 1
    expect(nextUpgrade({ businessLevel: 1, purchased: ["sign"] })).toEqual(shelf);
  });
  it("null when everything eligible is owned", () => {
    const allIds = UPGRADES.map((u) => u.id);
    expect(nextUpgrade({ businessLevel: 3, purchased: allIds })).toBeNull();
  });
});

describe("shiftBonusTasks", () => {
  it("sums owned extraTasks", () => {
    expect(shiftBonusTasks([])).toBe(0);
    expect(shiftBonusTasks(["sign"])).toBe(0); // visual-only
    expect(shiftBonusTasks(["sign", "shelf"])).toBe(1); // 0 + 1
    expect(shiftBonusTasks(["shelf", "register"])).toBe(2);
  });
  it("clamps to MAX_BONUS_TASKS", () => {
    const allIds = UPGRADES.map((u) => u.id);
    expect(shiftBonusTasks(allIds)).toBe(MAX_BONUS_TASKS);
  });
  it("ignores unknown ids", () => {
    expect(shiftBonusTasks(["nope", "shelf"])).toBe(1);
  });
});

describe("isOwned", () => {
  it("reports membership", () => {
    expect(isOwned("shelf", ["shelf"])).toBe(true);
    expect(isOwned("shelf", [])).toBe(false);
  });
});

describe("catalog invariants", () => {
  it("has 5–8 upgrades with unique ids and increasing order", () => {
    expect(UPGRADES.length).toBeGreaterThanOrEqual(5);
    expect(UPGRADES.length).toBeLessThanOrEqual(8);
    const ids = UPGRADES.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
    const orders = UPGRADES.map((u) => u.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
  });
  it("total extraTasks never exceeds MAX_BONUS_TASKS-worth of clamp headroom sanity", () => {
    const total = UPGRADES.reduce((n, u) => n + u.extraTasks, 0);
    expect(total).toBeGreaterThanOrEqual(MAX_BONUS_TASKS); // ensures the clamp is reachable/meaningful
  });
});
