import { describe, expect, it } from "vitest";
import { aggregateWeeklyReport, type ShiftLogRow } from "@/lib/services/reports";
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
