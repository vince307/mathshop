import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { ShopState, SkillState } from "@/types";
import { businessLevelForShifts, earningsForShift } from "@/data/shift";
import { addSkillDelta, readSkillState, type SkillDelta } from "@/data/skills";
import { type BuyReason, canBuy, getUpgrade, readPurchased } from "@/data/upgrades";

export { deriveStartingLevel } from "@/data/leveling";

/**
 * Child-profile data access. Every function takes the request-scoped SSR client
 * (built from the parent's session cookie), so queries run AS the authenticated
 * parent and the F-01 RLS policies scope reads/writes to their own rows — no
 * manual `account_id` filtering. The caller must always set `account_id` from the
 * session, never from client input (L-002); the `with check` policy is the backstop.
 */

export interface NewChildProfile {
  accountId: string;
  name: string;
  age: number;
  avatar: string;
  theme: string;
  startingLevel: number;
}

export interface ChildProfile {
  id: string;
  account_id: string;
  name: string;
  age: number;
  avatar: string;
  theme: string;
  starting_level: number;
  // Gameplay state (S-04/S-05). business_level is mutable progression, distinct
  // from the frozen starting_level difficulty band. wallet_balance is the spendable
  // wallet (virtualBalance) — the former `coins` field, renamed in S-05.
  wallet_balance: number;
  completed_shift_count: number;
  business_level: number;
  shop_state: ShopState;
  // Per-competency skill progress (S-07). Pre-S-07 rows may be `{}`; always read
  // through `readSkillState` before use so missing keys normalize to zero.
  skill_state: SkillState;
  created_at: string;
  updated_at: string;
}

/**
 * Soft ceiling on child profiles per account (S-11) — bounds junk-profile
 * accumulation now that the picker exposes an add entry a child can reach.
 * Route-level only (no DB constraint); first-guess, tunable. The create route's
 * read-then-insert check can briefly overshoot under parallel requests (TOCTOU)
 * — acceptable for a soft cap; add a DB trigger if this ever hardens.
 */
export const MAX_PROFILES_PER_ACCOUNT = 6;

/** Insert a profile and return its id (RLS-read of the own row — powers the post-create selection). */
export function createChildProfile(client: SupabaseClient, p: NewChildProfile) {
  return client
    .from("child_profiles")
    .insert({
      account_id: p.accountId,
      name: p.name,
      age: p.age,
      avatar: p.avatar,
      theme: p.theme,
      starting_level: p.startingLevel,
    })
    .select("id")
    .single()
    .overrideTypes<{ id: string }, { merge: false }>();
}

/** How many profiles the authenticated parent owns (RLS-scoped, indexed count). */
export async function countChildProfiles(client: SupabaseClient): Promise<number> {
  const { count } = await client.from("child_profiles").select("*", { count: "exact", head: true });
  return count ?? 0;
}

/**
 * Where the `/app` router sends an authenticated parent: 0 profiles → the
 * create-first-profile wizard; 1 → that child's start screen (picker skipped,
 * FR-002); 2+ → the profile picker (S-11), unless a VALID selection already
 * exists (validated by the caller via `resolveActiveProfile`, never trusted
 * from the raw cookie) — then straight to the selected child's start screen.
 */
export function resolveLandingPath(profileCount: number, hasSelection: boolean): string {
  if (profileCount === 0) return "/app/new-profile";
  if (profileCount >= 2 && !hasSelection) return "/app/pick-profile";
  return "/app/start";
}

/** All of the authenticated parent's profiles (RLS-scoped), newest first. Powers the report + picker. */
export async function listChildProfiles(client: SupabaseClient): Promise<ChildProfile[]> {
  const { data } = await client.from("child_profiles").select("*").order("created_at", { ascending: false });
  return (data as ChildProfile[] | null) ?? [];
}

/**
 * Append one `shift_log` row (S-07) — the history the parent report reads. Best
 * effort: a log failure must NOT fail an already-persisted shift/purchase (the
 * authoritative profile UPDATE has committed by the time this runs), so its error
 * is swallowed. `account_id` comes from the RLS-verified profile row, never from
 * client input (L-002); the INSERT `with check` policy is the backstop.
 */
async function appendShiftLog(
  client: SupabaseClient,
  entry: { accountId: string; profileId: string; skills: SkillDelta; upgradePurchased?: string },
): Promise<void> {
  await client.from("shift_log").insert({
    account_id: entry.accountId,
    profile_id: entry.profileId,
    skills: entry.skills,
    upgrade_purchased: entry.upgradePurchased ?? null,
  });
}

export interface ShiftResult {
  earned: number;
  businessLevel: number;
  leveledUp: boolean;
}

/**
 * Persist a completed shift onto the parent's own profile (S-04/S-05). Wallet
 * earnings are recomputed server-side from the reported accuracy (`earningsForShift`),
 * so the client never supplies an amount — it cannot inflate the wallet. The row
 * is reached by `id` and the F-01 `child_profiles_update_own` RLS policy gates
 * ownership (a non-owner read returns no row, a non-owner update affects 0 rows);
 * `account_id` is NEVER taken from the caller (L-002). The per-competency `skills`
 * delta (already capped + reconciled against taskCount/cleanCount by the route)
 * is folded into `skill_state` MONOTONICALLY via `addSkillDelta` — it only ever
 * adds, so replaying shifts can never lower a skill (PRD guardrail). Returns the
 * wallet earnings + new level, or `{ error }` if the profile isn't readable/owned.
 */
export async function recordShiftResult(
  client: SupabaseClient,
  profileId: string,
  shift: { taskCount: number; cleanCount: number; skills: SkillDelta },
): Promise<ShiftResult | { error: PostgrestError | Error }> {
  // Read the row AS the parent (RLS-scoped): a non-owner sees no row. Use limit(1)
  // + data?.[0] rather than .single() so the result stays typed for the
  // ChildProfile cast under the strict lint.
  const { data, error: readErr } = await client.from("child_profiles").select("*").eq("id", profileId).limit(1);
  if (readErr) return { error: readErr };
  const current = (data[0] as ChildProfile | undefined) ?? null;
  if (!current) return { error: new Error("profile not found") };

  const earned = earningsForShift(shift.taskCount, shift.cleanCount);
  const newCount = current.completed_shift_count + 1;
  const businessLevel = businessLevelForShifts(newCount);
  const skillState = addSkillDelta(readSkillState(current.skill_state), shift.skills);

  const { error: updateErr } = await client
    .from("child_profiles")
    .update({
      wallet_balance: current.wallet_balance + earned,
      completed_shift_count: newCount,
      business_level: businessLevel,
      skill_state: skillState,
    })
    .eq("id", profileId);
  if (updateErr) return { error: updateErr };

  // History row for the weekly report — account_id from the RLS-verified row (L-002).
  await appendShiftLog(client, { accountId: current.account_id, profileId, skills: shift.skills });

  return { earned, businessLevel, leveledUp: businessLevel > current.business_level };
}

/** Why a buy could not proceed. `not-found` = the row isn't readable/owned (RLS). */
export type BuyFailure = BuyReason | "not-found";

export type BuyUpgradeResult =
  | { walletBalance: number; purchased: string[] }
  | { failure: BuyFailure }
  | { error: PostgrestError | Error };

/**
 * Purchase an upgrade onto the parent's own profile (S-06) — the ONLY
 * currency-moving spend path, server-authoritative like `recordShiftResult`.
 * The row is read by `id` under RLS (a non-owner sees no row → `not-found`,
 * never A's data); `account_id` is NEVER taken from the caller (L-002).
 * Affordability, world-level and ownership are recomputed from the TRUSTED row
 * via the shared `canBuy` (the client only names an `upgradeId`), so a tampered
 * client cannot buy what it can't afford, hasn't unlocked, or already owns. On
 * success one UPDATE debits `wallet_balance` by the catalog cost and appends the
 * id to `shop_state.purchased`; the wallet non-negative DB constraint backstops
 * overspend. Returns the new wallet + owned list, a `failure` reason, or `{ error }`.
 */
export async function buyUpgrade(
  client: SupabaseClient,
  profileId: string,
  upgradeId: string,
): Promise<BuyUpgradeResult> {
  const upgrade = getUpgrade(upgradeId);
  // Unknown-id short-circuit: no DB round-trip needed for a value not in the catalog.
  if (!upgrade) return { failure: "unknown" };

  // Read AS the parent (RLS-scoped): a non-owner sees no row. limit(1) + data?.[0]
  // (mirrors recordShiftResult) keeps the result typed under the strict lint.
  const { data, error: readErr } = await client.from("child_profiles").select("*").eq("id", profileId).limit(1);
  if (readErr) return { error: readErr };
  const current = (data[0] as ChildProfile | undefined) ?? null;
  if (!current) return { failure: "not-found" };

  const purchased = readPurchased(current.shop_state);
  const skillState = readSkillState(current.skill_state);
  const check = canBuy(upgrade, {
    walletBalance: current.wallet_balance,
    businessLevel: current.business_level,
    purchased,
    skillState,
  });
  if (!check.ok) return { failure: check.reason };

  const nextPurchased = [...purchased, upgrade.id];
  const walletBalance = current.wallet_balance - upgrade.cost;
  // Choosing an upgrade IS the decisions competency (+1 per purchase, fully
  // server-side). Folded monotonically into the same UPDATE that debits the
  // wallet — spending never lowers a skill (PRD guardrail).
  const decisionsDelta: SkillDelta = { decisions: { firstTryCorrect: 1, completed: 1, misses: 0 } };
  const nextSkillState = addSkillDelta(skillState, decisionsDelta);

  const { error: updateErr } = await client
    .from("child_profiles")
    .update({
      wallet_balance: walletBalance,
      shop_state: { ...current.shop_state, purchased: nextPurchased },
      skill_state: nextSkillState,
    })
    .eq("id", profileId);
  if (updateErr) return { error: updateErr };

  // Purchase event in the history log — ties this upgrade to the week (report).
  await appendShiftLog(client, {
    accountId: current.account_id,
    profileId,
    skills: decisionsDelta,
    upgradePurchased: upgrade.id,
  });

  return { walletBalance, purchased: nextPurchased };
}
