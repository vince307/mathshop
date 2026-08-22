/**
 * Recent-activity core (F2). Pure and dependency-free (no i18n / React /
 * Supabase — mirrors `src/data/shift.ts` / `src/data/skills.ts`): turns one raw
 * `shift_log` row plus a `now` instant into everything the dashboard feed needs
 * to draw a card, so the mapping is unit-testable without a browser or a DB.
 *
 * Deliberately carries NO money figure: `shift_log` stores no earnings column,
 * and re-deriving one from the tunable earn rates (or from the catalog's
 * *current* upgrade cost) would silently re-price history — invented data (D1).
 */
import { readSkillState } from "@/data/skills";

/**
 * The feed's calendar anchor: the audience's civil time. Same zone
 * `REPORT_TIME_ZONE` names, deliberately declared here as its own constant so
 * this module stays free of any dependency on the service layer (D5).
 */
export const ACTIVITY_TIME_ZONE = "Europe/Warsaw";

/** Which day word a row gets; `older` falls back to the numeric `DD.MM` date. */
export type ActivityDayBucket = "today" | "yesterday" | "older";

/** The two kinds of event `shift_log` records — a completed shift, or a purchase. */
export type ActivityKind = "shift" | "purchase";

/** One feed card's worth of already-resolved, presentation-ready facts. */
export interface ActivityEntry {
  kind: ActivityKind;
  /** Catalog id of the purchased upgrade; `null` on a shift row. */
  upgradeId: string | null;
  /** Tasks the shift completed (math + money); 0 on a purchase row (never shown). */
  taskCount: number;
  bucket: ActivityDayBucket;
  /** `"DD.MM"` in Warsaw civil time — meaningful only when `bucket === "older"`. */
  dayMonth: string;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * The `"YYYY-MM-DD"` **Europe/Warsaw civil date** of an instant, assembled from
 * `formatToParts` rather than a locale's `format()` string shape (which varies
 * by ICU build). Comparing civil-date strings needs no UTC-offset arithmetic at
 * all, which is why this module does not duplicate `reports.ts`'s DST maths.
 */
export function warsawDayKey(instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ACTIVITY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * The calendar day before a `"YYYY-MM-DD"` key.
 *
 * **Not** `now - 86_400_000`: Europe/Warsaw has a 25-hour day each October, and
 * on it a 24-hour subtraction from a late hour lands back on the *same* civil
 * day (23:59 CET → −24h → 00:59 CEST, still Sunday). Stepping the *key* is a
 * pure calendar operation with no timezone involved, so it is DST-proof.
 */
function previousDayKey(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  const previous = new Date(Date.UTC(year, month - 1, day - 1));
  return `${previous.getUTCFullYear()}-${pad2(previous.getUTCMonth() + 1)}-${pad2(previous.getUTCDate())}`;
}

/** `"2026-08-19"` → `"19.08"` — short, unambiguous, and needs no plural forms (D6). */
function dayMonthFromKey(key: string): string {
  const [, month, day] = key.split("-");
  return `${day}.${month}`;
}

/** The row shape `toActivityEntry` consumes — a structural subset of `RecentActivityRow`. */
export interface ActivityRowInput {
  created_at: string;
  skills: unknown;
  upgrade_purchased: string | null;
}

/**
 * Map one `shift_log` row to its feed entry, bucketed against `now`.
 *
 * `kind` comes from `upgrade_purchased !== null` and **nothing else**: `skills`
 * is `not null` on both kinds (a purchase row carries a fixed `decisions`
 * payload), so the jsonb keys are a hint and never a discriminator.
 */
export function toActivityEntry(row: ActivityRowInput, now: Date): ActivityEntry {
  const rowKey = warsawDayKey(new Date(row.created_at));
  const todayKey = warsawDayKey(now);
  const bucket: ActivityDayBucket =
    rowKey === todayKey ? "today" : rowKey === previousDayKey(todayKey) ? "yesterday" : "older";

  const skills = readSkillState(row.skills);
  return {
    kind: row.upgrade_purchased !== null ? "purchase" : "shift",
    upgradeId: row.upgrade_purchased,
    taskCount: skills.math.completed + skills.money.completed,
    bucket,
    dayMonth: dayMonthFromKey(rowKey),
  };
}
