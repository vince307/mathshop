import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  aggregateWeeklyReport,
  getWeeklyReport,
  startOfWeek,
  weekDayKeys,
  type ShiftLogRow,
} from "@/lib/services/reports";
import { COMPETENCIES, readSkillState } from "@/data/skills";

/**
 * Pure weekly-report aggregation (S-07 / FR-016). No DB. Locks the per-competency
 * roll-up, the upgrade→skill tie (gated → required competency; cost-only →
 * practiced; neither → general practice) so the parent report never shows a
 * blank tie, and the seven-day Warsaw frame the activity chart draws.
 */

/**
 * The frame anchor. Wed 2026-07-08 12:00 UTC → the report week runs Mon
 * 2026-07-06 … Sun 2026-07-12 (Warsaw civil dates). `daily` is only meaningful
 * relative to a fixed `now`, so **every assertion about `daily` passes `NOW`
 * explicitly as the third argument** — omitting it silently asserts against an
 * all-zero chart built from the real clock.
 */
const NOW = new Date("2026-07-08T12:00:00Z");
/** 12:00 CEST on Wed 2026-07-08 — inside `weekDayKeys(NOW)`, at index 2. */
const IN_FRAME_CREATED_AT = "2026-07-08T10:00:00Z";

function row(skills: unknown, upgrade?: string, createdAt: string = IN_FRAME_CREATED_AT): ShiftLogRow {
  return { created_at: createdAt, skills, upgrade_purchased: upgrade ?? null };
}

/** One chained query-builder call, as `stubClient` records it. */
interface ChainCall {
  method: string;
  args: unknown[];
}

/**
 * Minimal query-chain stub so the error contract is testable without a DB.
 * `calls` optionally records what the service asked for — the chain SHAPE is
 * unchanged (`select` / `eq` / `gte` / `order`, only `order` thenable).
 */
function stubClient(
  result: { data: ShiftLogRow[] | null; error: { message: string } | null },
  calls: ChainCall[] = [],
): SupabaseClient {
  const record = (method: string, args: unknown[]) => {
    calls.push({ method, args });
  };
  const chain = {
    select: (...args: unknown[]) => (record("select", args), chain),
    eq: (...args: unknown[]) => (record("eq", args), chain),
    gte: (...args: unknown[]) => (record("gte", args), chain),
    order: (...args: unknown[]) => (record("order", args), Promise.resolve(result)),
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

/**
 * A failed query must surface, never masquerade as an empty week (S-09) —
 * otherwise a DB error renders as "nothing practiced this week" to the parent.
 */
describe("getWeeklyReport error contract", () => {
  it("rejects when the query returns an error instead of reporting an empty week", async () => {
    const failing = stubClient({ data: null, error: { message: "boom" } });
    await expect(getWeeklyReport(failing, "p1")).rejects.toBeDefined();
  });

  it("aggregates normally when the query succeeds", async () => {
    const ok = stubClient({
      data: [{ created_at: IN_FRAME_CREATED_AT, skills: { math: { completed: 2 } }, upgrade_purchased: null }],
      error: null,
    });
    const report = await getWeeklyReport(ok, "p1");
    expect(report.practice.math.completed).toBe(2);
  });

  /**
   * `shift_log` RLS is *account*-scoped, so a parent legitimately reads every
   * child's rows on the account. `.eq("profile_id", …)` is the ONLY thing
   * separating siblings inside one account — a refactor that drops it leaks
   * quietly rather than failing, so the filter is asserted, not assumed.
   */
  it("filters the query to the requested profile (sibling isolation, not RLS)", async () => {
    const calls: ChainCall[] = [];
    const ok = stubClient({ data: [], error: null }, calls);
    await getWeeklyReport(ok, "p-requested", NOW);
    expect(calls).toContainEqual({ method: "eq", args: ["profile_id", "p-requested"] });
  });

  it("projects created_at so the chart has a day dimension", async () => {
    const calls: ChainCall[] = [];
    const ok = stubClient({ data: [], error: null }, calls);
    await getWeeklyReport(ok, "p1", NOW);
    expect(calls[0]).toEqual({ method: "select", args: ["created_at, skills, upgrade_purchased"] });
  });
});

/**
 * The report week starts Monday 00:00 **Europe/Warsaw** (S-09) — the audience's
 * calendar week, not UTC. July is CEST (UTC+2): Warsaw Monday midnight is
 * Sunday 22:00 UTC. The DST cases pin that the boundary uses the offset in
 * force *at that Monday midnight*, not at `now`.
 */
describe("startOfWeek (Europe/Warsaw)", () => {
  it("returns Warsaw Monday midnight for a mid-week instant", () => {
    // Wed 2026-07-08 12:00 UTC → week began Mon 2026-07-06 00:00 CEST.
    expect(startOfWeek(new Date("2026-07-08T12:00:00Z"))).toBe("2026-07-05T22:00:00.000Z");
  });

  it("treats late Sunday UTC that is already Monday in Warsaw as the new week", () => {
    // Sun 2026-07-05 23:30 UTC = Mon 2026-07-06 01:30 CEST → same Monday's midnight.
    expect(startOfWeek(new Date("2026-07-05T23:30:00Z"))).toBe("2026-07-05T22:00:00.000Z");
  });

  it("uses the pre-transition offset across the fall-back weekend", () => {
    // Sun 2026-10-25 12:00 UTC is after the CEST→CET shift, but the week's
    // Monday (2026-10-19) was still CEST → midnight is 22:00 UTC, not 23:00.
    expect(startOfWeek(new Date("2026-10-25T12:00:00Z"))).toBe("2026-10-18T22:00:00.000Z");
  });

  it("uses the pre-transition offset across the spring-forward weekend", () => {
    // Sun 2026-03-29 12:00 UTC is after the CET→CEST shift, but the week's
    // Monday (2026-03-23) was still CET → midnight is 23:00 UTC, not 22:00.
    expect(startOfWeek(new Date("2026-03-29T12:00:00Z"))).toBe("2026-03-22T23:00:00.000Z");
  });
});

describe("aggregateWeeklyReport", () => {
  it("returns zeroed practice + no upgrades for an empty week", () => {
    const report = aggregateWeeklyReport("p1", []);
    expect(report.profileId).toBe("p1");
    expect(report.practice).toEqual(readSkillState(null));
    expect(report.upgrades).toEqual([]);
  });

  it("sums per-competency practice across shift rows (monotonic add)", () => {
    const report = aggregateWeeklyReport("p1", [
      row({ math: { firstTryCorrect: 2, completed: 3, misses: 1 } }),
      row({ math: { firstTryCorrect: 1, completed: 1, misses: 0 }, money: { firstTryCorrect: 2, completed: 2 } }),
    ]);
    expect(report.practice.math).toEqual({ firstTryCorrect: 3, completed: 4, misses: 1 });
    expect(report.practice.money).toEqual({ firstTryCorrect: 2, completed: 2, misses: 0 });
  });

  it("ties a skill-gated upgrade to its required competency (money)", () => {
    const report = aggregateWeeklyReport("p1", [row({}, "register")]);
    expect(report.upgrades).toEqual([{ upgradeId: "register", competencies: ["money"], generalPractice: false }]);
  });

  it("ties a history-gated upgrade to its required competency (math)", () => {
    const report = aggregateWeeklyReport("p1", [row({}, "customers")]);
    expect(report.upgrades).toEqual([{ upgradeId: "customers", competencies: ["math"], generalPractice: false }]);
  });

  it("ties a cost-only upgrade to the competencies actually practiced that week", () => {
    const report = aggregateWeeklyReport("p1", [row({ math: { completed: 3 } }), row({}, "sign")]);
    expect(report.upgrades).toEqual([{ upgradeId: "sign", competencies: ["math"], generalPractice: false }]);
  });

  it("falls back to general practice when a cost-only upgrade has no practice to tie to", () => {
    const report = aggregateWeeklyReport("p1", [row({}, "sign")]);
    expect(report.upgrades).toEqual([{ upgradeId: "sign", competencies: [], generalPractice: true }]);
  });
});

/**
 * The seven-day Warsaw frame the parent-report activity chart draws. Bucketing
 * compares **civil-date strings**, never millisecond deltas, so the 23- and
 * 25-hour DST days cannot shift a bar.
 */
describe("weekDayKeys (Europe/Warsaw)", () => {
  it("returns seven Monday-first civil dates for the week containing `now`", () => {
    expect(weekDayKeys(NOW)).toEqual([
      "2026-07-06",
      "2026-07-07",
      "2026-07-08",
      "2026-07-09",
      "2026-07-10",
      "2026-07-11",
      "2026-07-12",
    ]);
  });

  it("steps calendar days, not 24-hour spans, across the fall-back weekend", () => {
    // The week of Mon 2026-10-19 contains the 25-hour Sunday (CEST→CET).
    expect(weekDayKeys(new Date("2026-10-25T12:00:00Z"))).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ]);
  });
});

describe("aggregateWeeklyReport daily buckets", () => {
  it("always returns seven zero-filled Monday-first days for an empty week", () => {
    const report = aggregateWeeklyReport("p1", [], NOW);
    expect(report.daily).toHaveLength(7);
    expect(report.daily.map((day) => day.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(report.daily.map((day) => day.date)).toEqual(weekDayKeys(NOW));
    expect(report.daily.every((day) => day.completed === 0)).toBe(true);
  });

  it("buckets a row into its Warsaw civil day, summing all three competencies", () => {
    const report = aggregateWeeklyReport(
      "p1",
      [row({ math: { completed: 3 }, money: { completed: 2 }, decisions: { completed: 1 } })],
      NOW,
    );
    // 12:00 CEST on Wed 2026-07-08 → index 2.
    expect(report.daily[2]).toEqual({ date: "2026-07-08", weekday: 2, completed: 6 });
    expect(report.daily.filter((day) => day.completed > 0)).toHaveLength(1);
  });

  it("treats late-Sunday UTC that is already Monday in Warsaw as the next week (not Sunday)", () => {
    // Sun 2026-07-12 23:30 UTC = Mon 2026-07-13 01:30 CEST — past the frame's end.
    const report = aggregateWeeklyReport(
      "p1",
      [row({ math: { completed: 4 } }, undefined, "2026-07-12T23:30:00Z")],
      NOW,
    );
    expect(report.daily[6].completed).toBe(0);
    expect(report.daily.every((day) => day.completed === 0)).toBe(true);
  });

  it("buckets the fall-back Sunday correctly (civil date, not offset arithmetic)", () => {
    const dstNow = new Date("2026-10-25T12:00:00Z");
    // 22:30 UTC on 2026-10-25 is 23:30 CET — still Sunday the 25th in Warsaw.
    const report = aggregateWeeklyReport(
      "p1",
      [row({ math: { completed: 5 } }, undefined, "2026-10-25T22:30:00Z")],
      dstNow,
    );
    expect(report.daily[6]).toEqual({ date: "2026-10-25", weekday: 6, completed: 5 });
  });

  it("makes the bars a decomposition of the tasks tile: Σ daily === Σ practice.completed", () => {
    const report = aggregateWeeklyReport(
      "p1",
      [
        row({ math: { completed: 3, firstTryCorrect: 2 } }, undefined, "2026-07-06T08:00:00Z"),
        row({ money: { completed: 2 } }, undefined, "2026-07-09T18:00:00Z"),
        row({ decisions: { completed: 1, firstTryCorrect: 1 } }, "sign", "2026-07-12T09:00:00Z"),
      ],
      NOW,
    );
    const barsTotal = report.daily.reduce((sum, day) => sum + day.completed, 0);
    const tileTotal = COMPETENCIES.reduce((sum, competency) => sum + report.practice[competency].completed, 0);
    expect(barsTotal).toBe(tileTotal);
    expect(barsTotal).toBe(6);
  });

  it("counts an out-of-frame row in practice but not in daily", () => {
    const report = aggregateWeeklyReport(
      "p1",
      [row({ math: { completed: 7 } }, undefined, "2026-07-20T10:00:00Z")],
      NOW,
    );
    expect(report.practice.math.completed).toBe(7);
    expect(report.daily.reduce((sum, day) => sum + day.completed, 0)).toBe(0);
  });

  it("contributes 0 rather than throwing for a malformed skills payload", () => {
    const report = aggregateWeeklyReport("p1", [row("not-an-object"), row(null)], NOW);
    expect(report.daily.reduce((sum, day) => sum + day.completed, 0)).toBe(0);
  });
});
