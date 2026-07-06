import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aggregateWeeklyReport, getWeeklyReport, startOfWeek, type ShiftLogRow } from "@/lib/services/reports";
import { readSkillState } from "@/data/skills";

/**
 * Pure weekly-report aggregation (S-07 / FR-016). No DB. Locks the per-competency
 * roll-up and the upgrade→skill tie (gated → required competency; cost-only →
 * practiced; neither → general practice), so the parent report never shows a
 * blank tie.
 */

function row(skills: unknown, upgrade?: string): ShiftLogRow {
  return { skills, upgrade_purchased: upgrade ?? null };
}

/** Minimal query-chain stub so the error contract is testable without a DB. */
function stubClient(result: { data: ShiftLogRow[] | null; error: { message: string } | null }): SupabaseClient {
  const chain = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    order: () => Promise.resolve(result),
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
    const ok = stubClient({ data: [{ skills: { math: { completed: 2 } }, upgrade_purchased: null }], error: null });
    const report = await getWeeklyReport(ok, "p1");
    expect(report.practice.math.completed).toBe(2);
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
