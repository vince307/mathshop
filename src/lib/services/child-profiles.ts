import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { ShopState, SkillState } from "@/types";
import { businessLevelForShifts, earningsForShift } from "@/data/shift";
import { addSkillDelta, readSkillState, type SkillDelta } from "@/data/skills";
import { canBuy, getUpgrade, readPurchased } from "@/data/upgrades";

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

export function createChildProfile(client: SupabaseClient, p: NewChildProfile) {
  return client.from("child_profiles").insert({
    account_id: p.accountId,
    name: p.name,
    age: p.age,
    avatar: p.avatar,
    theme: p.theme,
    starting_level: p.startingLevel,
  });
}

/** How many profiles the authenticated parent owns (RLS-scoped, indexed count). */
export async function countChildProfiles(client: SupabaseClient): Promise<number> {
  const { count } = await client.from("child_profiles").select("*", { count: "exact", head: true });
  return count ?? 0;
}

/**
 * Where the `/app` router sends an authenticated parent based on their profile
 * count: 0 → the create-first-profile wizard; ≥1 → the start screen (which loads
 * the most-recent profile). The multi-profile picker for ≥2 is S-07 — until then
 * 2+ also lands on the most-recent profile's start screen (no dead-end).
 */
export function resolveLandingPath(profileCount: number): string {
  return profileCount === 0 ? "/app/new-profile" : "/app/start";
}

/** The parent's most-recently-created profile (RLS-scoped), or null if none. */
export async function getMostRecentProfile(client: SupabaseClient): Promise<ChildProfile | null> {
  const { data } = await client.from("child_profiles").select("*").order("created_at", { ascending: false }).limit(1);
  return (data?.[0] as ChildProfile | undefined) ?? null;
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
  // + data?.[0] (mirrors getMostRecentProfile) rather than .single() so the result
  // stays typed for the ChildProfile cast under the strict lint.
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

  return { earned, businessLevel, leveledUp: businessLevel > current.business_level };
}

/** Why a buy could not proceed. `not-found` = the row isn't readable/owned (RLS). */
export type BuyFailure = "owned" | "locked" | "insufficient" | "unknown" | "not-found";

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
  const check = canBuy(upgrade, {
    walletBalance: current.wallet_balance,
    businessLevel: current.business_level,
    purchased,
  });
  if (!check.ok) return { failure: check.reason };

  const nextPurchased = [...purchased, upgrade.id];
  const walletBalance = current.wallet_balance - upgrade.cost;

  const { error: updateErr } = await client
    .from("child_profiles")
    .update({ wallet_balance: walletBalance, shop_state: { ...current.shop_state, purchased: nextPurchased } })
    .eq("id", profileId);
  if (updateErr) return { error: updateErr };

  return { walletBalance, purchased: nextPurchased };
}
