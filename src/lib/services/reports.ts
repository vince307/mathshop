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

/** The report's calendar anchor: the audience's civil time (S-09, FR-016). */
const REPORT_TIME_ZONE = "Europe/Warsaw";

const WEEKDAY_FROM_MONDAY: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/** The zone's UTC offset (minutes) in force at `instant`, via Intl (DST-correct, no dependency). */
function zoneOffsetMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIME_ZONE,
    timeZoneName: "longOffset",
  }).formatToParts(instant);
  const name = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!match) return 0; // "GMT" = UTC±00:00
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/**
 * Start of the current week — Monday 00:00 **Europe/Warsaw** — as a UTC ISO
 * instant (the report's window, S-09). Computed from `now`'s Warsaw wall-clock
 * date, walked back to Monday, then resolved to the UTC instant using the
 * zone offset in force at that midnight (Warsaw DST shifts happen at 02:00/03:00
 * local, so Monday midnight always exists; the second offset pass settles the
 * guess when `now` and that midnight sit on opposite sides of a transition).
 */
export function startOfWeek(now: Date): string {
  const wall = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: REPORT_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  // Walk back to Monday in wall-clock space (UTC-noon arithmetic avoids day underflow issues).
  const mondayNoon = new Date(Date.UTC(+wall.year, +wall.month - 1, +wall.day - WEEKDAY_FROM_MONDAY[wall.weekday], 12));
  const midnightUtcGuess = Date.UTC(mondayNoon.getUTCFullYear(), mondayNoon.getUTCMonth(), mondayNoon.getUTCDate());
  const firstPass = new Date(midnightUtcGuess - zoneOffsetMinutes(new Date(midnightUtcGuess)) * 60_000);
  return new Date(midnightUtcGuess - zoneOffsetMinutes(firstPass) * 60_000).toISOString();
}

/**
 * The current-week report for one profile (RLS-scoped — a non-owner reads no
 * rows, so the report is naturally empty rather than another account's data).
 * A query error THROWS rather than folding into an empty report, so a DB
 * failure can never masquerade as "nothing practiced this week" (S-09); the
 * route catches per child and renders an honest error card. `now` is
 * injectable for deterministic tests.
 */
export async function getWeeklyReport(
  client: SupabaseClient,
  profileId: string,
  now: Date = new Date(),
): Promise<WeeklyReport> {
  const { data, error } = await client
    .from("shift_log")
    .select("skills, upgrade_purchased")
    .eq("profile_id", profileId)
    .gte("created_at", startOfWeek(now))
    .order("created_at", { ascending: true });
  if (error) throw error;
  return aggregateWeeklyReport(profileId, data);
}
