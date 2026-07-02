import type { SupabaseClient } from "@supabase/supabase-js";
import type { Competency, WeeklyReport, WeeklyReportUpgrade } from "@/types";
import { addSkillDelta, COMPETENCIES, readSkillState } from "@/data/skills";
import { getUpgrade } from "@/data/upgrades";

/**
 * Parent weekly report aggregation (S-07 / FR-016). The pure `aggregateWeeklyReport`
 * rolls `shift_log` rows into a per-child summary; `getWeeklyReport` is the thin
 * RLS-scoped query wrapper. Read-only, non-comparative, non-shaming (guardrail).
 */

/** One `shift_log` row as the aggregator consumes it (skills jsonb + optional purchase). */
export interface ShiftLogRow {
  skills: unknown;
  upgrade_purchased: string | null;
}

/**
 * Tie an unlocked upgrade to the skills it exercised: a gated upgrade → its
 * required competencies; a cost-only upgrade → the competencies actually
 * practiced that week; neither → `generalPractice` (so no upgrade shows blank).
 */
function upgradeSkillTie(upgradeId: string, practiced: Competency[]): WeeklyReportUpgrade {
  const upgrade = getUpgrade(upgradeId);
  const gated: Competency[] = [];
  if (upgrade?.requiredSkill) gated.push(upgrade.requiredSkill.competency);
  if (upgrade?.requiredTaskHistory) gated.push(upgrade.requiredTaskHistory.competency);
  const competencies = gated.length > 0 ? [...new Set(gated)] : practiced;
  return { upgradeId, competencies, generalPractice: competencies.length === 0 };
}

/**
 * Fold a week's `shift_log` rows into a `WeeklyReport`: sum per-competency practice
 * (monotonic add — same fold the write path uses) and list each purchased upgrade
 * tied to the skills it exercised. Pure; unit-tested without a DB.
 */
export function aggregateWeeklyReport(profileId: string, rows: ShiftLogRow[]): WeeklyReport {
  let practice = readSkillState(null);
  const purchasedIds: string[] = [];
  for (const row of rows) {
    practice = addSkillDelta(practice, row.skills ?? {});
    if (row.upgrade_purchased) purchasedIds.push(row.upgrade_purchased);
  }
  const practiced = COMPETENCIES.filter((competency) => practice[competency].completed > 0);
  const upgrades = purchasedIds.map((id) => upgradeSkillTie(id, practiced));
  return { profileId, practice, upgrades };
}

/** Start of the current ISO week (Monday 00:00 UTC) — the report's window. */
function startOfWeek(now: Date): string {
  const dayFromMonday = (now.getUTCDay() + 6) % 7; // Sun=0 → 6, Mon=1 → 0, …
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayFromMonday));
  return monday.toISOString();
}

/**
 * The current-week report for one profile (RLS-scoped — a non-owner reads no
 * rows, so the report is naturally empty rather than another account's data).
 * `now` is injectable for deterministic tests.
 */
export async function getWeeklyReport(
  client: SupabaseClient,
  profileId: string,
  now: Date = new Date(),
): Promise<WeeklyReport> {
  const { data } = await client
    .from("shift_log")
    .select("skills, upgrade_purchased")
    .eq("profile_id", profileId)
    .gte("created_at", startOfWeek(now))
    .order("created_at", { ascending: true });
  return aggregateWeeklyReport(profileId, data ?? []);
}
