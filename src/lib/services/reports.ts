import type { SupabaseClient } from "@supabase/supabase-js";
import type { Competency, WeeklyReport, WeeklyReportDay, WeeklyReportUpgrade } from "@/types";
import { warsawDayKey } from "@/data/activity";
import { addSkillDelta, COMPETENCIES, readSkillState } from "@/data/skills";
import { getUpgrade } from "@/data/upgrades";

/**
 * Parent weekly report aggregation (S-07 / FR-016). The pure `aggregateWeeklyReport`
 * rolls `shift_log` rows into a per-child summary; `getWeeklyReport` is the thin
 * RLS-scoped query wrapper. Read-only, non-comparative, non-shaming (guardrail).
 */

/**
 * One `shift_log` row as the aggregator consumes it (timestamp + skills jsonb +
 * optional purchase). `created_at` is **required**, not optional: it is what
 * places a row on a day of the week, and an optional field would let a caller
 * silently produce an all-zero chart instead of failing to compile.
 */
export interface ShiftLogRow {
  created_at: string;
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
 * (monotonic add — same fold the write path uses), list each purchased upgrade
 * tied to the skills it exercised, and decompose the same rows across the week's
 * seven Warsaw days. Pure; unit-tested without a DB.
 *
 * `now` is a **third, optional** parameter so no existing call site changes
 * shape — but it is what fixes the seven-day frame, so a test asserting on
 * `daily` must pass the same instant its fixture timestamps were built against.
 *
 * **`Σ daily[].completed === Σ practice[*].completed`** for rows inside the
 * frame: both sides coerce through the same `safeCount` on the same field
 * (`addSkillDelta` / `readSkillState`), so a parent adding the seven bars gets
 * the number printed above them. A row inside the open-ended `.gte` window but
 * outside the frame is counted in `practice` and skipped for `daily` — existing
 * `practice` behaviour is unchanged by this addition.
 */
export function aggregateWeeklyReport(profileId: string, rows: ShiftLogRow[], now: Date = new Date()): WeeklyReport {
  let practice = readSkillState(null);
  const purchasedIds: string[] = [];
  const frame = weekDayKeys(now);
  const perDay = new Map(frame.map((key) => [key, 0]));
  for (const row of rows) {
    practice = addSkillDelta(practice, row.skills ?? {});
    if (row.upgrade_purchased) purchasedIds.push(row.upgrade_purchased);
    const dayKey = warsawDayKey(new Date(row.created_at));
    const bucket = perDay.get(dayKey);
    if (bucket === undefined) continue; // outside the seven-day frame — practice only
    const rowSkills = readSkillState(row.skills);
    const completed = COMPETENCIES.reduce((sum, competency) => sum + rowSkills[competency].completed, 0);
    perDay.set(dayKey, bucket + completed);
  }
  const daily: WeeklyReportDay[] = frame.map((date, weekday) => ({
    date,
    weekday,
    completed: perDay.get(date) ?? 0,
  }));
  const practiced = COMPETENCIES.filter((competency) => practice[competency].completed > 0);
  const upgrades = purchasedIds.map((id) => upgradeSkillTie(id, practiced));
  return { profileId, practice, upgrades, daily };
}

/** The report's calendar anchor: the audience's civil time (S-09, FR-016). */
const REPORT_TIME_ZONE = "Europe/Warsaw";

const WEEKDAY_FROM_MONDAY: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/**
 * The zone's UTC offset (minutes) in force at `instant`, via Intl (DST-correct, no dependency).
 *
 * **This is the project's only UTC-offset parser — do not re-implement it.** A
 * second copy is a DST bug waiting for the last Sunday in October. Anything that
 * only needs to know *which civil day* an instant falls on wants
 * `warsawDayKey` (`src/data/activity.ts`) instead, which compares date strings
 * and needs no offset arithmetic at all.
 */
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
 * The report week as seven `"YYYY-MM-DD"` Europe/Warsaw civil dates, Monday
 * first — the fixed frame the activity chart buckets into.
 *
 * Derived by taking the Warsaw civil date of `startOfWeek(now)` and stepping the
 * **key** forward 0–6 calendar days, mirroring `previousDayKey`
 * (`src/data/activity.ts`). Stepping the key is a pure calendar operation with
 * no timezone in it, so the 23- and 25-hour DST days cannot shift a bar; adding
 * 86 400 000 ms to an instant would.
 */
export function weekDayKeys(now: Date): string[] {
  const monday = warsawDayKey(new Date(startOfWeek(now)));
  const [year, month, day] = monday.split("-").map(Number);
  return Array.from({ length: 7 }, (_, offset) => {
    const stepped = new Date(Date.UTC(year, month - 1, day + offset));
    const pad2 = (value: number) => String(value).padStart(2, "0");
    return `${stepped.getUTCFullYear()}-${pad2(stepped.getUTCMonth() + 1)}-${pad2(stepped.getUTCDate())}`;
  });
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
    .select("created_at, skills, upgrade_purchased")
    .eq("profile_id", profileId)
    .gte("created_at", startOfWeek(now))
    .order("created_at", { ascending: true });
  if (error) throw error;
  // The same `now` fixes the query window AND the seven-day frame: computing
  // them from two instants would drop rows from the chart across a Sunday→Monday
  // midnight while still counting them in `practice`.
  return aggregateWeeklyReport(profileId, data, now);
}

/** One `shift_log` row as the activity feed consumes it (id + timestamp + payload). */
export interface RecentActivityRow {
  id: string;
  created_at: string;
  skills: unknown;
  upgrade_purchased: string | null;
}

/**
 * The newest `shift_log` events for ONE child, newest first (F2 — the dashboard
 * activity feed). The only read of raw `shift_log` rows in the codebase.
 *
 * **`.eq("profile_id", …)` is load-bearing, not a convenience.** RLS on
 * `shift_log` is *account*-scoped (`auth.uid() = account_id`), so a signed-in
 * parent legitimately reads every child's rows on the account; without this
 * filter a sibling's shifts and purchases appear in this child's feed. Treat its
 * absence as a cross-profile data leak inside one account —
 * `tests/recent-activity-isolation.test.ts` is the guard, and no RLS policy can
 * be. Covered end-to-end by `shift_log_profile_created_idx` (`profile_id,
 * created_at`), so no secondary sort and no new index.
 *
 * A query error THROWS rather than folding into an empty list, matching
 * `getWeeklyReport`: a DB failure must never masquerade as "nothing happened
 * yet" to the child. The caller catches and renders an honest error line.
 *
 * **Not a reconciliation.** The writer (`appendShiftLog`) is best-effort — it
 * swallows its own error and shares no transaction with the profile UPDATE — so
 * the feed can legitimately be missing an event that happened. Never present or
 * read it as an audit of `wallet_balance` or `completed_shift_count`.
 */
export async function listRecentActivity(
  client: SupabaseClient,
  profileId: string,
  limit = 3,
): Promise<RecentActivityRow[]> {
  const { data, error } = await client
    .from("shift_log")
    .select("id, created_at, skills, upgrade_purchased")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}
