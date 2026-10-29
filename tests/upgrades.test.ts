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
import { readSkillState, SKILL_THRESHOLDS, type SkillDelta } from "@/data/skills";

/**
 * Pure upgrade catalog + derivations (S-06/S-07). No DOM / Supabase. These are the
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
const register = up("register"); // cost 100, level 2, requiredSkill money level 1
const customers = up("customers"); // cost 300, level 3, requiredTaskHistory math 8
const precision = up("precision"); // cost 140, level 2, requiredUpgrade sign, requiredSkill money level 2
const margin = up("margin"); // cost 180, level 3, requiredUpgrade sign, requiredTaskHistory math 20

/** Fully-zeroed skill state, optionally overlaid with a delta — for gate ctxs. */
function skills(delta?: SkillDelta): ReturnType<typeof readSkillState> {
  return readSkillState(delta ?? null);
}
const MONEY_L1 = SKILL_THRESHOLDS[0]; // firstTryCorrect that reaches money level 1
const MONEY_L2 = SKILL_THRESHOLDS[1]; // firstTryCorrect that reaches money level 2

describe("readPurchased", () => {
  it("normalizes missing / empty / populated shop_state", () => {
    expect(readPurchased(undefined)).toEqual([]);
    expect(readPurchased(null)).toEqual([]);
    expect(readPurchased({})).toEqual([]);
    expect(readPurchased({ purchased: ["sign", "shelf"] })).toEqual(["sign", "shelf"]);
  });
});

describe("canBuy", () => {
  // Level 3 + full money skill + rich math history → the S-07 rungs pass, so the
  // ungated S-06 cases behave exactly as before. Individual tests peel a field back.
  const ctx = {
    walletBalance: 1000,
    businessLevel: 3,
    purchased: [] as string[],
    skillState: skills({ money: { firstTryCorrect: MONEY_L1 }, math: { completed: 8 } }),
  };

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
    expect(canBuy(shelf, { walletBalance: 0, businessLevel: 0, purchased: ["shelf"], skillState: skills() })).toEqual({
      ok: false,
      reason: "owned",
    });
  });

  it("skips the new rungs entirely for an ungated upgrade (zero skill)", () => {
    expect(canBuy(shelf, { ...ctx, skillState: skills() })).toEqual({ ok: true });
  });

  it("skill-locked when the required skill level isn't reached", () => {
    expect(canBuy(register, { ...ctx, skillState: skills({ money: { firstTryCorrect: MONEY_L1 - 1 } }) })).toEqual({
      ok: false,
      reason: "skill-locked",
    });
  });
  it("passes the skill rung once the level is reached", () => {
    expect(canBuy(register, { ...ctx, skillState: skills({ money: { firstTryCorrect: MONEY_L1 } }) })).toEqual({
      ok: true,
    });
  });
  it("world lock precedes the skill lock", () => {
    // register: world 2 unmet AND money skill unmet → the earlier (world) rung wins.
    expect(canBuy(register, { ...ctx, businessLevel: 1, skillState: skills() })).toEqual({
      ok: false,
      reason: "locked",
    });
  });
  it("skill lock precedes insufficient funds", () => {
    expect(canBuy(register, { ...ctx, walletBalance: 0, skillState: skills() })).toEqual({
      ok: false,
      reason: "skill-locked",
    });
  });

  it("history-locked when the completed-task count isn't reached", () => {
    expect(canBuy(customers, { ...ctx, skillState: skills({ math: { completed: 7 } }) })).toEqual({
      ok: false,
      reason: "history-locked",
    });
  });
  it("passes the history rung once the count is reached", () => {
    expect(canBuy(customers, { ...ctx, skillState: skills({ math: { completed: 8 } }) })).toEqual({ ok: true });
  });
  it("owned short-circuits before the skill/history rungs (no retro-lock)", () => {
    // A profile owning register with zero skill is still owned, never skill-locked.
    expect(canBuy(register, { ...ctx, purchased: ["register"], skillState: skills() })).toEqual({
      ok: false,
      reason: "owned",
    });
  });

  /**
   * The E1 branch gate. `sign` has no effect of its own — it exists so the FIRST
   * purchase is a choice of DIRECTION (capacity or margin) instead of a step on a
   * single line. Branches govern visibility and order, never availability.
   */
  it("branch-locked when the gateway upgrade is unowned", () => {
    expect(canBuy(precision, { ...ctx, purchased: [] })).toEqual({ ok: false, reason: "branch-locked" });
    expect(canBuy(margin, { ...ctx, purchased: [] })).toEqual({ ok: false, reason: "branch-locked" });
  });
  it("opens the branch the moment the gateway is owned", () => {
    expect(
      canBuy(precision, { ...ctx, purchased: ["sign"], skillState: skills({ money: { firstTryCorrect: MONEY_L2 } }) }),
    ).toEqual({
      ok: true,
    });
  });
  it("world lock precedes the branch lock", () => {
    // precision: world 2 unmet AND sign unowned → the earlier (world) rung wins.
    expect(canBuy(precision, { ...ctx, businessLevel: 1, purchased: [] })).toEqual({ ok: false, reason: "locked" });
  });
  it("branch lock precedes the skill lock", () => {
    // precision: sign unowned AND money skill unmet → the earlier (branch) rung wins.
    expect(canBuy(precision, { ...ctx, purchased: [], skillState: skills() })).toEqual({
      ok: false,
      reason: "branch-locked",
    });
  });
  it("owned short-circuits the branch rung too — a branch entry is NEVER retro-locked", () => {
    // The one state that would be a product disaster: a child who bought
    // `precision` and then somehow has `sign` missing from `purchased` must still
    // own `precision`. Owned wins over every later rung, branch included.
    expect(canBuy(precision, { ...ctx, purchased: ["precision"], skillState: skills() })).toEqual({
      ok: false,
      reason: "owned",
    });
  });
  it("forecloses nothing: every entry is reachable from a full-owner state", () => {
    // No purchase may make another entry permanently unbuyable. Owning the whole
    // catalogue minus one, every remaining entry is buyable at max level/skill.
    for (const target of UPGRADES) {
      const others = UPGRADES.filter((u) => u.id !== target.id).map((u) => u.id);
      const check = canBuy(target, {
        walletBalance: 100000,
        businessLevel: 99,
        purchased: others,
        skillState: skills({ money: { firstTryCorrect: 1000 }, math: { completed: 1000, firstTryCorrect: 1000 } }),
      });
      expect(check, `"${target.id}" is unreachable even from a full-owner state`).toEqual({ ok: true });
    }
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

  /**
   * Capacity is EXACTLY full at `MAX_BONUS_TASKS`, and that is why the two margin
   * entries must carry `extraTasks: 0`. One more bonus task anywhere and the
   * clamp swallows it — so the last capacity purchase a child makes would add
   * nothing while still adding its running cost. That is a trap manufactured by
   * the catalogue itself, and this is the assertion that forbids it.
   */
  it("capacity sums to exactly MAX_BONUS_TASKS — no entry's effect can be clamped away", () => {
    expect(UPGRADES.reduce((n, u) => n + u.extraTasks, 0)).toBe(MAX_BONUS_TASKS);
  });

  it("every entry declares a running cost, and only earning entries pay one", () => {
    for (const u of UPGRADES) {
      expect(typeof u.runningCost, `"${u.id}" has no runningCost`).toBe("number");
      expect(u.runningCost, `"${u.id}" runningCost is negative`).toBeGreaterThanOrEqual(0);
      const earns = u.extraTasks > 0 || u.quantityMargin !== undefined || u.accuracyMargin !== undefined;
      if (!earns) {
        expect(u.runningCost, `"${u.id}" earns nothing but costs ${u.runningCost} to run`).toBe(0);
      }
    }
  });

  it("margins move the rate, never the count", () => {
    for (const u of UPGRADES) {
      if (u.quantityMargin !== undefined || u.accuracyMargin !== undefined) {
        expect(u.extraTasks, `margin entry "${u.id}" also adds tasks`).toBe(0);
      }
    }
  });

  /**
   * `tests/stages.test.ts` § "returns an honest empty list for the terminal stage"
   * asserts `unlocksForStage(STAGES[3]) === []`. An entry at the terminal level
   * would turn that red from a file nobody touched.
   */
  it("no entry gates on the terminal stage's level", () => {
    for (const u of UPGRADES) expect(u.requiredWorldLevel).toBeLessThanOrEqual(3);
  });

  it("every branch gate names a real catalogue entry that is itself ungated", () => {
    for (const u of UPGRADES) {
      if (!u.requiredUpgrade) continue;
      const gateway = getUpgrade(u.requiredUpgrade);
      expect(gateway, `"${u.id}" gates on unknown "${u.requiredUpgrade}"`).toBeDefined();
      // A gateway behind another gateway is a chain a child cannot see the end of.
      expect(gateway?.requiredUpgrade, `"${u.requiredUpgrade}" is itself branch-gated`).toBeUndefined();
    }
  });
});
