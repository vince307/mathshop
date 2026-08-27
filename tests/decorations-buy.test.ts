import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as buyDecorationPOST } from "@/pages/api/decorations/buy";
import { POST as buyUpgradePOST } from "@/pages/api/upgrades/buy";
import { POST as signinPOST } from "@/pages/api/auth/signin";
import { admin, createSignedInUser, deleteUser, PASSWORD, type TestAccount } from "./helpers/supabase";
import { buildContext, type CookieJar, createCookieJar } from "./helpers/astro";
import { decorationsForWorld, getDecoration } from "@/data/decorations";

/**
 * Route-level money integrity + isolation for POST /api/decorations/buy (E1 /
 * D-11) — the SECOND sanctioned spend path beside the upgrade buy, and held to
 * exactly the same standard.
 *
 * Proves the route (a) debits the wallet by EXACTLY the catalogue cost and
 * records the id only for a server-validated buy, (b) rejects owned /
 * wrong-world / insufficient / unknown buys with the durable state unchanged,
 * (c) never writes another account's profile (L-002 — RLS gates by id,
 * `account_id` is never trusted), and (d) makes the two deliberate departures
 * from `buyUpgrade` that AD-6 records: **no `shift_log` row** and **no `+1
 * decisions`**, each for a reason that would otherwise corrupt the parent report.
 *
 * Durable state is verified via the service-role `admin` client. Requires the
 * local Supabase stack + `.env.test`.
 */

/** Resolve a decoration or fail loudly (avoids the forbidden non-null assertion). */
function decoration(id: string) {
  const found = getDecoration(id);
  if (!found) throw new Error(`missing decoration: ${id}`);
  return found;
}

const CAFE = decorationsForWorld("kawiarnia");
const LAMPKI = decoration("kawiarnia-lampki"); // cheapest kawiarnia entry
const KWIATY = decoration("kawiarnia-kwiaty"); // second kawiarnia entry
const BAKERY = decoration("piekarnia-wstazki"); // another world's entry

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
  return buildContext({ url: "https://test.local/api/decorations/buy", method: "POST", formData, cookies: jar });
}

/** Seed a profile owned by `accountId` with explicit gameplay state (bypasses RLS). */
async function seedProfile(
  accountId: string,
  state: {
    walletBalance: number;
    theme?: string;
    purchased?: string[];
    purchasedMeta?: Record<string, { world: string; at: string }>;
    decorations?: string[];
  },
): Promise<string> {
  const shopState: Record<string, unknown> = { purchased: state.purchased ?? [] };
  if (state.purchasedMeta) shopState.purchasedMeta = state.purchasedMeta;
  if (state.decorations) shopState.decorations = state.decorations;
  const { data } = await admin
    .from("child_profiles")
    .insert({
      account_id: accountId,
      name: "Ala",
      age: 7,
      avatar: "lis",
      theme: state.theme ?? "kawiarnia",
      wallet_balance: state.walletBalance,
      business_level: 1,
      shop_state: shopState,
      skill_state: {},
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
        shop_state: {
          purchased: string[];
          purchasedMeta?: Record<string, { world: string; at: string }>;
          decorations?: string[];
        };
        skill_state: Record<string, { firstTryCorrect: number; completed: number; misses: number }>;
      },
      { merge: false }
    >();
  return data;
}

describe("POST /api/decorations/buy (route money integrity + isolation)", () => {
  let accountA: TestAccount;
  let accountB: TestAccount;

  beforeAll(async () => {
    accountA = await createSignedInUser("deco");
    accountB = await createSignedInUser("deco");
  });

  afterAll(async () => {
    if (accountA.id) await deleteUser(accountA.id);
    if (accountB.id) await deleteUser(accountB.id);
  });

  it("affordable, in-world, unowned buy → 200, wallet debited by cost, id persisted", async () => {
    const profileId = await seedProfile(accountA.id, { walletBalance: 200 });
    const jar = await mintSession(accountA.email);
    const res = await buyDecorationPOST(buyContext(jar, { profileId, decorationId: LAMPKI.id }));
    expect(res.status).toBe(200);

    const state = await readState(profileId);
    expect(state?.wallet_balance).toBe(200 - LAMPKI.cost);
    expect(state?.shop_state.decorations).toEqual([LAMPKI.id]);
    // The sink's list is its OWN. A decoration in `purchased` would reach
    // `shopRunningCost` and `canBuy` and recreate the trap by the back door.
    expect(state?.shop_state.purchased).toEqual([]);
  });

  it("insufficient funds → 400, wallet + state unchanged", async () => {
    const profileId = await seedProfile(accountA.id, { walletBalance: LAMPKI.cost - 1 });
    const jar = await mintSession(accountA.email);
    const res = await buyDecorationPOST(buyContext(jar, { profileId, decorationId: LAMPKI.id }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { reason: string }).reason).toBe("insufficient");

    const state = await readState(profileId);
    expect(state?.wallet_balance).toBe(LAMPKI.cost - 1);
    expect(state?.shop_state.decorations ?? []).toEqual([]);
  });

  it("a decoration from another world → 400 wrong-world, unchanged", async () => {
    const profileId = await seedProfile(accountA.id, { walletBalance: 1000, theme: "kawiarnia" });
    const jar = await mintSession(accountA.email);
    const res = await buyDecorationPOST(buyContext(jar, { profileId, decorationId: BAKERY.id }));
    expect(res.status).toBe(400);
    // NOT "locked": that reason renders as a business level, which has nothing to
    // do with why this buy failed.
    expect(((await res.json()) as { reason: string }).reason).toBe("wrong-world");

    const state = await readState(profileId);
    expect(state?.wallet_balance).toBe(1000);
    expect(state?.shop_state.decorations ?? []).toEqual([]);
  });

  it("already-owned → 400, unchanged (no double-debit)", async () => {
    const profileId = await seedProfile(accountA.id, { walletBalance: 1000, decorations: [LAMPKI.id] });
    const jar = await mintSession(accountA.email);
    const res = await buyDecorationPOST(buyContext(jar, { profileId, decorationId: LAMPKI.id }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { reason: string }).reason).toBe("owned");

    const state = await readState(profileId);
    expect(state?.wallet_balance).toBe(1000);
    expect(state?.shop_state.decorations).toEqual([LAMPKI.id]);
  });

  it("rejects an unknown decoration id and writes nothing", async () => {
    const profileId = await seedProfile(accountA.id, { walletBalance: 1000 });
    const jar = await mintSession(accountA.email);
    const res = await buyDecorationPOST(buyContext(jar, { profileId, decorationId: "not-a-decoration" }));
    expect(res.status).toBe(400);

    const state = await readState(profileId);
    expect(state?.wallet_balance).toBe(1000);
    expect(state?.shop_state.decorations ?? []).toEqual([]);
  });

  it("rejects a catalogue upgrade id — the two lists never cross", async () => {
    const profileId = await seedProfile(accountA.id, { walletBalance: 1000 });
    const jar = await mintSession(accountA.email);
    const res = await buyDecorationPOST(buyContext(jar, { profileId, decorationId: "sign" }));
    expect(res.status).toBe(400);

    const state = await readState(profileId);
    expect(state?.wallet_balance).toBe(1000);
    expect(state?.shop_state.decorations ?? []).toEqual([]);
  });

  /**
   * L-002. Account B names A's profile id. RLS gates the read by id, so B sees no
   * row and gets a 404 — and, critically, A's durable state is verified with the
   * RLS-bypassing admin client rather than trusted from the response.
   */
  it("L-002 spoof: account B cannot buy on account A's profile; A's row unchanged", async () => {
    const profileId = await seedProfile(accountA.id, { walletBalance: 1000 });
    const jarB = await mintSession(accountB.email);
    const res = await buyDecorationPOST(buyContext(jarB, { profileId, decorationId: LAMPKI.id }));
    expect(res.status).toBe(404);

    const state = await readState(profileId);
    expect(state?.wallet_balance).toBe(1000);
    expect(state?.shop_state.decorations ?? []).toEqual([]);
  });

  /**
   * The inner spread is load-bearing: naming `decorations` as an explicit key
   * SHADOWS the outer `...current.shop_state`, so `purchased` and `purchasedMeta`
   * must be carried forward by hand. Without that, one decoration purchase would
   * silently erase the child's entire shop — no error, no crash, just a shop that
   * un-grew.
   */
  it("carries `purchased` and `purchasedMeta` through a decoration buy, and accumulates across two", async () => {
    const meta = { sign: { world: "kawiarnia", at: "2026-01-01T00:00:00.000Z" } };
    const profileId = await seedProfile(accountA.id, {
      walletBalance: 1000,
      purchased: ["sign"],
      purchasedMeta: meta,
    });
    const jar = await mintSession(accountA.email);

    expect((await buyDecorationPOST(buyContext(jar, { profileId, decorationId: LAMPKI.id }))).status).toBe(200);
    expect((await buyDecorationPOST(buyContext(jar, { profileId, decorationId: KWIATY.id }))).status).toBe(200);

    const shopState = (await readState(profileId))?.shop_state;
    expect(shopState?.purchased).toEqual(["sign"]);
    expect(Object.keys(shopState?.purchasedMeta ?? {})).toEqual(["sign"]);
    expect(shopState?.decorations).toEqual([LAMPKI.id, KWIATY.id]);
  });

  it("an upgrade buy after a decoration buy keeps the decorations", async () => {
    const profileId = await seedProfile(accountA.id, { walletBalance: 1000 });
    const jar = await mintSession(accountA.email);
    expect((await buyDecorationPOST(buyContext(jar, { profileId, decorationId: LAMPKI.id }))).status).toBe(200);

    const upgradeCtx = buildContext({
      url: "https://test.local/api/upgrades/buy",
      method: "POST",
      formData: { profileId, upgradeId: "sign" },
      cookies: jar,
    });
    expect((await buyUpgradePOST(upgradeCtx)).status).toBe(200);

    const shopState = (await readState(profileId))?.shop_state;
    expect(shopState?.purchased).toEqual(["sign"]);
    expect(shopState?.decorations).toEqual([LAMPKI.id]);
  });

  /**
   * AD-6, half one. A `{ upgrade_purchased: null, earned: null }` row flips
   * `computeWeeklyReport`'s `earningsKnown` false **permanently**, silently
   * suppressing the parent report's earnings tile from then on; tagging it as
   * `upgrade_purchased` would list a decoration among "upgrades bought this week".
   */
  it("writes NO shift_log row — a decoration is not a shift and not an upgrade", async () => {
    const profileId = await seedProfile(accountA.id, { walletBalance: 1000 });
    const jar = await mintSession(accountA.email);
    expect((await buyDecorationPOST(buyContext(jar, { profileId, decorationId: LAMPKI.id }))).status).toBe(200);

    const { data: rows } = await admin
      .from("shift_log")
      .select("upgrade_purchased, earned")
      .eq("profile_id", profileId)
      .overrideTypes<{ upgrade_purchased: string | null; earned: number | null }[], { merge: false }>();
    expect(rows).toHaveLength(0);
  });

  /**
   * AD-6, half two. `decisions` is surfaced to the parent and gates nothing, so
   * crediting it here would make decoration-spam a way to inflate a competency a
   * parent reads. Choosing an UPGRADE is the decision.
   */
  it("grants NO decisions credit — buying an ozdoba is not a business decision", async () => {
    const profileId = await seedProfile(accountA.id, { walletBalance: 1000 });
    const jar = await mintSession(accountA.email);
    // A fresh profile seeds `skill_state: {}`, so `decisions` is genuinely absent
    // here — read it defensively rather than through the typed shape.
    const readDecisions = async (): Promise<number> => {
      const raw = (await readState(profileId))?.skill_state as
        | Record<string, { completed?: number } | undefined>
        | undefined;
      return raw?.decisions?.completed ?? 0;
    };
    const before = await readDecisions();
    for (const entry of CAFE.slice(0, 2)) {
      expect((await buyDecorationPOST(buyContext(jar, { profileId, decorationId: entry.id }))).status).toBe(200);
    }
    const after = await readDecisions();
    expect(after).toBe(before);
  });
});
