// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import WeeklyReport, { type ChildReport } from "@/components/parent/WeeklyReport";
import type { SkillDelta } from "@/data/skills";
import type { WeeklyReportDay } from "@/types";
import { addSkillDelta, readSkillState } from "@/data/skills";
import { t } from "@/i18n";

/**
 * The parent report's three summary tiles, with the first-try share added.
 * Every expected string is read from `t.report.*` (L-003).
 *
 * **`NaN` is asserted absent from EVERY fixture, not only the zero-denominator
 * one.** The `—` branch structurally cannot produce `NaN`; the branch that can
 * is `String(firstTry)` on a played week, which is exactly where a regression
 * (a caller bypassing `firstTryPercent`, or its `readSkillState` normalisation
 * being dropped) would surface.
 */

const copy = t.report;

const EMPTY_WEEK: WeeklyReportDay[] = Array.from({ length: 7 }, (_, weekday) => ({
  date: `2026-07-${String(6 + weekday).padStart(2, "0")}`,
  weekday,
  completed: 0,
}));

function child(
  practiceDelta: SkillDelta,
  upgradeIds: string[] = [],
  earnings: { earned?: number; earningsKnown?: boolean } = {},
): ChildReport {
  return {
    profileId: "p1",
    name: "Ania",
    avatarImage: null,
    avatarAlt: "",
    report: {
      profileId: "p1",
      practice: addSkillDelta(readSkillState(null), practiceDelta),
      upgrades: upgradeIds.map((upgradeId) => ({ upgradeId, competencies: [], generalPractice: true })),
      daily: EMPTY_WEEK,
      earned: earnings.earned ?? 0,
      // Default `true`: the tile is the normal state, suppression the exception.
      earningsKnown: earnings.earningsKnown ?? true,
    },
  };
}

/** AD-3: `NaN%` must be unreachable, so this runs on every fixture in the file. */
function expectNoNaN(container: HTMLElement) {
  expect(container.textContent).not.toMatch(/NaN/);
}

afterEach(cleanup);

describe("WeeklyReport summary tiles", () => {
  it("renders the weekly earnings tile with its label when the payouts are known (F4)", () => {
    render(<WeeklyReport reports={[child({ math: { completed: 4 } }, [], { earned: 29 })]} />);
    expect(screen.getByText(copy.statEarned, { exact: true })).toBeInTheDocument();
    expect(screen.getByText(copy.statEarnedValue.replace("{amount}", "29"), { exact: true })).toBeInTheDocument();
  });

  it("renders 0 zł — not nothing — for a week with no recorded earnings (F4)", () => {
    // Zero is a fact, and `statTasks` already renders 0 for the same week.
    // Suppression is reserved for UNKNOWN; conflating the two would hide the tile
    // in every week the child only bought upgrades.
    render(<WeeklyReport reports={[child({}, ["sign"], { earned: 0, earningsKnown: true })]} />);
    expect(screen.getByText(copy.statEarned, { exact: true })).toBeInTheDocument();
    expect(screen.getByText(copy.statEarnedValue.replace("{amount}", "0"), { exact: true })).toBeInTheDocument();
  });

  it("suppresses the earnings tile entirely — no label, no zero — when a shift row's payout is unknown (F4)", () => {
    render(<WeeklyReport reports={[child({ math: { completed: 4 } }, [], { earned: 12, earningsKnown: false })]} />);
    expect(screen.queryByText(copy.statEarned, { exact: true })).not.toBeInTheDocument();
    // Not merely hidden behind a different figure: the undercount never renders.
    expect(screen.queryByText(copy.statEarnedValue.replace("{amount}", "12"), { exact: true })).not.toBeInTheDocument();
    // The other three tiles are untouched.
    expect(screen.getByText(copy.statTasks, { exact: true })).toBeInTheDocument();
  });

  it("renders the first-try share as a whole percent for a played week", () => {
    const { container } = render(
      <WeeklyReport
        reports={[
          child({
            math: { firstTryCorrect: 5, completed: 8 },
            money: { firstTryCorrect: 3, completed: 5 },
          }),
        ]}
      />,
    );
    // 8 first-try out of 13 countable tasks = 62 %.
    expect(screen.getByText(copy.statFirstTryValue.replace("{percent}", "62"), { exact: true })).toBeInTheDocument();
    expectNoNaN(container);
  });

  it("renders an em-dash with a spoken reason, not NaN%, for a fresh profile", () => {
    const { container } = render(<WeeklyReport reports={[child({})]} />);
    expect(screen.getByText(copy.statFirstTryNone, { exact: true })).toBeInTheDocument();
    expect(screen.getByText(copy.statFirstTryNoData, { exact: true })).toBeInTheDocument();
    expectNoNaN(container);
  });

  it("does not read 100% for a week of purchases and no tasks", () => {
    const { container } = render(
      <WeeklyReport
        reports={[child({ decisions: { firstTryCorrect: 3, completed: 3 } }, ["sign", "register", "customers"])]}
      />,
    );
    expect(screen.getByText(copy.statFirstTryNone, { exact: true })).toBeInTheDocument();
    expect(screen.queryByText(copy.statFirstTryValue.replace("{percent}", "100"), { exact: true })).toBeNull();
    expectNoNaN(container);
  });

  it("renders all three tile labels, leaving the two existing ones unchanged", () => {
    const { container } = render(<WeeklyReport reports={[child({ math: { firstTryCorrect: 2, completed: 4 } })]} />);
    expect(screen.getByText(copy.statTasks, { exact: true })).toBeInTheDocument();
    expect(screen.getByText(copy.statFirstTry, { exact: true })).toBeInTheDocument();
    // `statUpgrades` is byte-identical to `upgradesHeading`, so it legitimately
    // appears twice on the card — assert the count, not uniqueness.
    expect(screen.getAllByText(copy.statUpgrades, { exact: true })).toHaveLength(2);
    expectNoNaN(container);
  });

  it("leaves the load-error card free of tiles and of the chart", () => {
    const failed: ChildReport = { ...child({}), report: null };
    const { container } = render(<WeeklyReport reports={[failed]} />);
    expect(screen.getByRole("status")).toHaveTextContent(copy.loadError);
    expect(screen.queryByText(copy.statTasks, { exact: true })).toBeNull();
    expect(screen.queryByText(copy.statFirstTry, { exact: true })).toBeNull();
    expect(screen.queryByText(copy.chartHeading, { exact: true })).toBeNull();
    expectNoNaN(container);
  });
});
