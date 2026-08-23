import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as buyPOST } from "@/pages/api/upgrades/buy";
import { POST as signinPOST } from "@/pages/api/auth/signin";
import { admin, createSignedInUser, deleteUser, PASSWORD, type TestAccount } from "./helpers/supabase";
import { buildContext, type CookieJar, createCookieJar } from "./helpers/astro";
import { getUpgrade } from "@/data/upgrades";
import { DEFAULT_THEME } from "@/data/worlds";
import { readSkillState, SKILL_THRESHOLDS, type SkillState } from "@/data/skills";

/**
 * Route-level money integrity + isolation for POST /api/upgrades/buy (S-06) — the
 * only currency-moving spend path. Proves the route (a) debits the wallet by
 * EXACTLY the catalog cost and records the id ONLY for a server-validated buy
 * (affordable / level-met / unowned), (b) rejects insufficient / locked / owned
 * buys with the durable state unchanged (no debit, no double-add), and (c) never
 * writes another account's profile (L-002 — RLS gates by id, account_id is never
 * trusted). Cost / level / ownership are recomputed server-side; the client only
 * names an upgradeId. Durable state is verified via the service-role `admin`
 * client. Requires the local Supabase stack + `.env.test`.
 */

/** Resolve a catalog entry or fail loudly (avoids the forbidden non-null assertion). */
function upgrade(id: string) {
  const found = getUpgrade(id);
  if (!found) throw new Error(`missing catalog upgrade: ${id}`);
  return found;
}

const SIGN = upgrade("sign"); // cost 30, requiredWorldLevel 1
const REGISTER = upgrade("register"); // cost 100, world 2, requiredSkill money level 1
const CUSTOMERS = upgrade("customers"); // cost 300, world 3, requiredTaskHistory math 8
const SHELF = upgrade("shelf"); // F5: a second level-1 buy, for the purchasedMeta accumulation test

async function mintSession(email: string): Promise<CookieJar> {
  const jar = createCookieJar();
  const ctx = buildContext({
    url: "https://test.local/api/auth/signin",
    method: "POST",
    formData: { email, password: PASSWORD },
    cookies: jar,
  });
  const res = await signinPOST(ctx);
  expect(res.headers.get("Location")).toBe("/app");
  return jar;
}

function buyContext(jar: CookieJar, formData: Record<string, string>) {
  return buildContext({ url: "https://test.local/api/upgrades/buy", method: "POST", formData, cookies: jar });
}

/** Seed a profile owned by `accountId` with explicit gameplay state (bypasses RLS). */
async function seedProfile(
  accountId: string,
  state: {
    walletBalance: number;
    businessLevel: number;
    purchased?: string[];
    skillState?: SkillState;
    /** F5: defaults to the shipped value so every pre-existing call site is unchanged. */
    theme?: string;
  },
): Promise<string> {
  const { data } = await admin
    .from("child_profiles")
    .insert({
      account_id: accountId,
      name: "Ala",
      age: 7,
      avatar: "lis",
      theme: state.theme ?? "kawiarnia",
      wallet_balance: state.walletBalance,
      business_level: state.businessLevel,
      shop_state: { purchased: state.purchased ?? [] },
      skill_state: state.skillState ?? {},
    })
    .select("id")
    .single()
    .overrideTypes<{ id: string }, { merge: false }>();
  if (!data) throw new Error("seed failed");
  return data.id;
}

async function readState(profileId: string) {
  const { data } = await admin
    .from("child_profiles")
    .select("wallet_balance, shop_state, skill_state")
    .eq("id", profileId)
    .single()
    .overrideTypes<
      {
        wallet_balance: number;
        shop_state: { purchased: string[]; purchasedMeta?: Record<string, { world: string; at: string }> };
        skill_state: unknown;
      },
      { merge: false }
    >();
  return data;
}

describe("POST /api/upgrades/buy (route money integrity + isolation)", () => {
  let accountA: TestAccount;
  let accountB: TestAccount;

  beforeAll(async () => {
    accountA = await createSignedInUser("buy");
    accountB = await createSignedInUser("buy");
  });

  afterAll(async () => {
    if (accountA.id) await deleteUser(accountA.id);
    if (accountB.id) await deleteUser(accountB.id);
  });

  it("affordable, level-met, unowned buy → 200, wallet debited by cost, id persisted", async () => {
    const profileId = await seedProfile(accountA.id, { walletBalance: 100, businessLevel: 1 });
    const jar = await mintSession(accountA.email);
    const res = await buyPOST(buyContext(jar, { profileId, upgradeId: SIGN.id }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; walletBalance: number; purchased: string[] };
    expect(body.ok).toBe(true);
    expect(body.walletBalance).toBe(100 - SIGN.cost);
    expect(body.purchased).toEqual([SIGN.id]);

    const state = await readState(profileId);
    expect(state?.wallet_balance).toBe(100 - SIGN.cost);
    expect(state?.shop_state.purchased).toEqual([SIGN.id]);
  });

  it("insufficient funds → 400, wallet + state unchanged", async () => {
    const profileId = await seedProfile(accountA.id, { walletBalance: 10, businessLevel: 1 });
    const jar = await mintSession(accountA.email);
    const res = await buyPOST(buyContext(jar, { profileId, upgradeId: SIGN.id }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; reason: string };
    expect(body.reason).toBe("insufficient");

    const state = await readState(profileId);
    expect(state?.wallet_balance).toBe(10);
    expect(state?.shop_state.purchased).toEqual([]);
  });

  it("locked (world level too low) → 400, unchanged", async () => {
    const profileId = await seedProfile(accountA.id, { walletBalance: 500, businessLevel: 1 });
    const jar = await mintSession(accountA.email);
    const res = await buyPOST(buyContext(jar, { profileId, upgradeId: REGISTER.id }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; reason: string };
    expect(body.reason).toBe("locked");

    const state = await readState(profileId);
    expect(state?.wallet_balance).toBe(500);
    expect(state?.shop_state.purchased).toEqual([]);
  });

  it("already-owned → 400, unchanged (no double-debit)", async () => {
    const profileId = await seedProfile(accountA.id, {
      walletBalance: 500,
      businessLevel: 1,
      purchased: [SIGN.id],
    });
    const jar = await mintSession(accountA.email);
    const res = await buyPOST(buyContext(jar, { profileId, upgradeId: SIGN.id }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; reason: string };
    expect(body.reason).toBe("owned");

    const state = await readState(profileId);
    expect(state?.wallet_balance).toBe(500); // no second debit
    expect(state?.shop_state.purchased).toEqual([SIGN.id]); // no duplicate
  });

  it("L-002 spoof: account B cannot buy on account A's profile; A's row unchanged", async () => {
    const profileId = await seedProfile(accountA.id, { walletBalance: 100, businessLevel: 1 });
    const jar = await mintSession(accountB.email);
    const res = await buyPOST(buyContext(jar, { profileId, upgradeId: SIGN.id }));
    expect(res.status).not.toBe(200); // B can neither read nor write A's row

    const state = await readState(profileId);
    expect(state?.wallet_balance).toBe(100); // untouched
    expect(state?.shop_state.purchased).toEqual([]);
  });

  it("rejects an unknown upgrade id and writes nothing", async () => {
    const profileId = await seedProfile(accountA.id, { walletBalance: 500, businessLevel: 1 });
    const jar = await mintSession(accountA.email);
    const res = await buyPOST(buyContext(jar, { profileId, upgradeId: "not-a-real-upgrade" }));
    expect(res.status).toBe(400);

    const state = await readState(profileId);
    expect(state?.wallet_balance).toBe(500);
    expect(state?.shop_state.purchased).toEqual([]);
  });

  it("skill-locked (world met, skill unearned) → 400, wallet + state unchanged", async () => {
    // register: world 2 met, money skill 0 (< level 1). Affordable, so only the skill rung blocks it.
    const profileId = await seedProfile(accountA.id, { walletBalance: 500, businessLevel: 2 });
    const jar = await mintSession(accountA.email);
    const res = await buyPOST(buyContext(jar, { profileId, upgradeId: REGISTER.id }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { reason: string };
    expect(body.reason).toBe("skill-locked");

    const state = await readState(profileId);
    expect(state?.wallet_balance).toBe(500);
    expect(state?.shop_state.purchased).toEqual([]);
  });

  it("history-locked (world met, task history unearned) → 400, unchanged", async () => {
    // customers: world 3 met, math completed 0 (< 8). Affordable, so only the history rung blocks it.
    const profileId = await seedProfile(accountA.id, { walletBalance: 500, businessLevel: 3 });
    const jar = await mintSession(accountA.email);
    const res = await buyPOST(buyContext(jar, { profileId, upgradeId: CUSTOMERS.id }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { reason: string };
    expect(body.reason).toBe("history-locked");

    const state = await readState(profileId);
    expect(state?.wallet_balance).toBe(500);
    expect(state?.shop_state.purchased).toEqual([]);
  });

  it("skill-gated buy succeeds once the skill is earned → 200, decisions accrues", async () => {
    const profileId = await seedProfile(accountA.id, {
      walletBalance: 500,
      businessLevel: 2,
      skillState: readSkillState({ money: { firstTryCorrect: SKILL_THRESHOLDS[0] } }), // money level 1
    });
    const jar = await mintSession(accountA.email);
    const res = await buyPOST(buyContext(jar, { profileId, upgradeId: REGISTER.id }));
    expect(res.status).toBe(200);

    const state = await readState(profileId);
    expect(state?.wallet_balance).toBe(500 - REGISTER.cost);
    expect(state?.shop_state.purchased).toEqual([REGISTER.id]);
    const skill = readSkillState(state?.skill_state);
    expect(skill.decisions.firstTryCorrect).toBe(1); // choosing an upgrade IS the decisions competency
    expect(skill.money.firstTryCorrect).toBe(SKILL_THRESHOLDS[0]); // spending never lowered the money skill
  });

  it("a purchase increments the decisions competency (durable state)", async () => {
    const profileId = await seedProfile(accountA.id, { walletBalance: 100, businessLevel: 1 });
    const jar = await mintSession(accountA.email);
    expect(readSkillState((await readState(profileId))?.skill_state).decisions.firstTryCorrect).toBe(0);

    const res = await buyPOST(buyContext(jar, { profileId, upgradeId: SIGN.id }));
    expect(res.status).toBe(200);
    const skill = readSkillState((await readState(profileId))?.skill_state);
    expect(skill.decisions).toEqual({ firstTryCorrect: 1, completed: 1, misses: 0 });
  });

  it("an owned skill-gated upgrade is never retro-locked → 400 owned, not skill-locked", async () => {
    // Owns register with zero skill: the owned rung short-circuits before the skill rung.
    const profileId = await seedProfile(accountA.id, {
      walletBalance: 500,
      businessLevel: 3,
      purchased: [REGISTER.id],
    });
    const jar = await mintSession(accountA.email);
    const res = await buyPOST(buyContext(jar, { profileId, upgradeId: REGISTER.id }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { reason: string };
    expect(body.reason).toBe("owned");

    const state = await readState(profileId);
    expect(state?.wallet_balance).toBe(500); // no debit
    expect(state?.shop_state.purchased).toEqual([REGISTER.id]); // no duplicate
  });

  // --- F5: record the world on each purchase (write-only `purchasedMeta`) ---

  it("records the world and a timestamp on purchase", async () => {
    const profileId = await seedProfile(accountA.id, { walletBalance: 100, businessLevel: 1, theme: "piekarnia" });
    const jar = await mintSession(accountA.email);

    const res = await buyPOST(buyContext(jar, { profileId, upgradeId: SIGN.id }));
    expect(res.status).toBe(200);

    const meta = (await readState(profileId))?.shop_state.purchasedMeta;
    expect(meta?.[SIGN.id]?.world).toBe("piekarnia");
    expect(Number.isNaN(Date.parse(meta?.[SIGN.id]?.at ?? ""))).toBe(false);
  });

  it("normalises the DB default theme to the fallback slug, never 'default'", async () => {
    const profileId = await seedProfile(accountA.id, { walletBalance: 100, businessLevel: 1, theme: "default" });
    const jar = await mintSession(accountA.email);

    const res = await buyPOST(buyContext(jar, { profileId, upgradeId: SIGN.id }));
    expect(res.status).toBe(200);

    const meta = (await readState(profileId))?.shop_state.purchasedMeta;
    expect(meta?.[SIGN.id]?.world).toBe(DEFAULT_THEME);
    expect(meta?.[SIGN.id]?.world).not.toBe("default");
  });

  it("leaves `purchased` untouched across two buys, and keeps BOTH meta entries", async () => {
    const profileId = await seedProfile(accountA.id, { walletBalance: 500, businessLevel: 1 });
    const jar = await mintSession(accountA.email);

    expect((await buyPOST(buyContext(jar, { profileId, upgradeId: SIGN.id }))).status).toBe(200);
    expect((await buyPOST(buyContext(jar, { profileId, upgradeId: SHELF.id }))).status).toBe(200);

    const shopState = (await readState(profileId))?.shop_state;
    // The flat list keeps its shape and its purchase order (cross-device-restore
    // and the whole upgrade loop read it).
    expect(shopState?.purchased).toEqual([SIGN.id, SHELF.id]);
    // The inner spread is load-bearing: without it the second buy would discard
    // the first entry, because naming the key shadows the outer spread.
    expect(Object.keys(shopState?.purchasedMeta ?? {}).sort()).toEqual([SHELF.id, SIGN.id].sort());
  });
});
