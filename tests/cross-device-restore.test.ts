import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AstroCookies } from "astro";
import { POST as completePOST } from "@/pages/api/shifts/complete";
import { POST as buyPOST } from "@/pages/api/upgrades/buy";
import { POST as signinPOST } from "@/pages/api/auth/signin";
import { readSkillState } from "@/data/skills";
import { resolvePageProfile } from "@/lib/services/active-profile";
import type { ChildProfile } from "@/lib/services/child-profiles";
import { anonKey, createSignedInUser, deleteUser, PASSWORD, url, type TestAccount } from "./helpers/supabase";
import { buildContext, type CookieJar, createCookieJar } from "./helpers/astro";

/**
 * Cross-device economy restore (S-10, FR-001/FR-005/FR-012). The "second
 * device" is, to the server, a second independent session of the same account.
 * This suite closes the admin-client false-green (test-plan Risk #2): state
 * written through the REAL production routes by session 1 must be readable,
 * identical, by a brand-new session of the same account THROUGH RLS — and a
 * fresh session of another account must see none of it. The two sessions share
 * nothing (fresh client + signInWithPassword each). Requires the local stack
 * + `.env.test`.
 */

/** A brand-new, independent session for an EXISTING account — the "second device". */
async function freshSession(email: string): Promise<SupabaseClient> {
  const client = createSupabaseClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

/** Mint a real cookie-session by driving the signin route (the "first device"). */
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

function routeContext(jar: CookieJar, path: string, formData: Record<string, string>) {
  return buildContext({ url: `https://test.local${path}`, method: "POST", formData, cookies: jar });
}

/** The exact skill delta session 1 reports — asserted verbatim on device 2. */
const SHIFT_SKILLS = {
  math: { firstTryCorrect: 3, completed: 3, misses: 1 },
  money: { firstTryCorrect: 3, completed: 3, misses: 0 },
};

describe("cross-device economy restore (S-10)", () => {
  let accountA: TestAccount;
  let accountB: TestAccount;
  let profileId: string;

  beforeAll(async () => {
    accountA = await createSignedInUser("device");
    accountB = await createSignedInUser("device");

    const { data, error } = await accountA.client
      .from("child_profiles")
      .insert({ account_id: accountA.id, avatar: "kuba", name: "Ala", age: 7 })
      .select("id")
      .single()
      .overrideTypes<{ id: string }, { merge: false }>();
    if (error) throw error;
    profileId = data.id;

    // "Device 1": drive the REAL production write path — a clean 6-task shift
    // (earns 5*6 + 3*6 = 48) then buy the cheapest upgrade ("sign", cost 30).
    const jar = await mintSession(accountA.email);
    const shiftRes = await completePOST(
      routeContext(jar, "/api/shifts/complete", {
        profileId,
        taskCount: "6",
        cleanCount: "6",
        skills: JSON.stringify(SHIFT_SKILLS),
      }),
    );
    expect(shiftRes.status).toBe(200);
    const buyRes = await buyPOST(routeContext(jar, "/api/upgrades/buy", { profileId, upgradeId: "sign" }));
    expect(buyRes.status).toBe(200);
  });

  afterAll(async () => {
    // A beforeAll failure can leave these unassigned (TS's definite-assignment
    // doesn't know that) — widen so teardown never throws its own TypeError.
    const a = accountA as TestAccount | undefined;
    const b = accountB as TestAccount | undefined;
    if (a?.id) await deleteUser(a.id);
    if (b?.id) await deleteUser(b.id);
  });

  it("a fresh session of the same account reads the state device 1 wrote — through RLS, identically", async () => {
    const deviceTwo = await freshSession(accountA.email);
    const { data, error } = await deviceTwo
      .from("child_profiles")
      .select("*")
      .eq("id", profileId)
      .limit(1)
      .overrideTypes<ChildProfile[], { merge: false }>();
    expect(error).toBeNull();
    const profile = data?.[0];
    expect(profile).toBeDefined();

    // Wallet: 48 earned − 30 spent; one completed shift; level 1 (levels every 3 shifts).
    expect(profile?.wallet_balance).toBe(18);
    expect(profile?.completed_shift_count).toBe(1);
    expect(profile?.business_level).toBe(1);
    expect(profile?.shop_state.purchased).toEqual(["sign"]);
    // Skill state: the shift's math/money delta plus the purchase's decisions +1.
    expect(readSkillState(profile?.skill_state)).toEqual({
      math: SHIFT_SKILLS.math,
      money: SHIFT_SKILLS.money,
      decisions: { firstTryCorrect: 1, completed: 1, misses: 0 },
    });

    // The app's own read ladder resolves the same row (fresh device: no
    // selection cookie → sole-profile fallback) — covers the render-side path.
    const { profile: viaApp } = await resolvePageProfile(deviceTwo, createCookieJar() as unknown as AstroCookies);
    expect(viaApp?.id).toBe(profileId);
    expect(viaApp?.wallet_balance).toBe(18);
  });

  it("a fresh session of another account sees none of it", async () => {
    const strangerDevice = await freshSession(accountB.email);
    const { data: byId } = await strangerDevice.from("child_profiles").select("id").eq("id", profileId);
    expect(byId).toHaveLength(0);
    const { data: all } = await strangerDevice.from("child_profiles").select("id");
    expect(all).toHaveLength(0);
  });
});
