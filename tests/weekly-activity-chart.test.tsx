// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import WeeklyActivityChart from "@/components/parent/WeeklyActivityChart";
import type { WeeklyReportDay } from "@/types";
import { t } from "@/i18n";

/**
 * The parent report's weekly activity chart. **Every expected string in this
 * file is read from `t.report.*` — there is no hard-coded Polish literal here**
 * (L-003): a test that pins its own copy would go green against a component
 * that stopped using the dictionary.
 */

const copy = t.report;

/** A zero-filled Monday-first week, the invariant shape `daily` always has. */
function week(counts: number[]): WeeklyReportDay[] {
  return counts.map((completed, weekday) => ({
    date: `2026-07-${String(6 + weekday).padStart(2, "0")}`,
    weekday,
    completed,
  }));
}

afterEach(cleanup);

describe("WeeklyActivityChart", () => {
  it("renders the seven short day labels in Monday-first order", () => {
    const { container } = render(<WeeklyActivityChart days={week([8, 10, 14, 12, 16, 6, 8])} />);
    // `{ exact: true }`: getByText matches substrings, and every short form is a
    // prefix of its long form rendered in the sr-only list in the same subtree.
    const labels = copy.chartDaysShort.map((short) => screen.getByText(short, { exact: true }));
    expect(labels).toHaveLength(7);
    const drawn = [...container.querySelectorAll("svg text")]
      .map((node) => node.textContent)
      .filter((text) => (copy.chartDaysShort as readonly string[]).includes(text));
    expect(drawn).toEqual([...copy.chartDaysShort]);
  });

  it("exposes the week to a screen reader as a real DOM list of day/count pairs", () => {
    const counts = [8, 10, 14, 12, 16, 6, 8];
    render(<WeeklyActivityChart days={week(counts)} />);
    const list = screen.getByRole("list", { name: copy.chartHeading });
    const items = [...list.querySelectorAll("li")].map((node) => node.textContent);
    expect(items).toEqual(
      counts.map((count, weekday) =>
        copy.chartDayValue.replace("{day}", copy.chartDaysLong[weekday]).replace("{count}", String(count)),
      ),
    );
  });

  it("draws no bar for a zero day but still labels it and prints its 0", () => {
    const { container } = render(<WeeklyActivityChart days={week([3, 0, 0, 0, 0, 0, 0])} />);
    expect(container.querySelectorAll("rect")).toHaveLength(1);
    expect(screen.getByText(copy.chartDaysShort[1], { exact: true })).toBeInTheDocument();
    const srItems = [...screen.getByRole("list", { name: copy.chartHeading }).querySelectorAll("li")];
    expect(srItems[1]).toHaveTextContent(
      copy.chartDayValue.replace("{day}", copy.chartDaysLong[1]).replace("{count}", "0"),
    );
  });

  it("keeps the five-gridline axis when a single day carries the whole week", () => {
    const { container } = render(<WeeklyActivityChart days={week([0, 0, 1, 0, 0, 0, 0])} />);
    expect(container.querySelectorAll("rect")).toHaveLength(1);
    expect(container.querySelectorAll("line")).toHaveLength(5);
    // One task must not fill the card: the axis rounds up to four ticks, so the
    // bar reaches a quarter of the plot height.
    const bar = container.querySelector("rect");
    expect(Number(bar?.getAttribute("height"))).toBeCloseTo((150 - 12) / 4, 5);
  });

  it("renders the calm empty-week line and no svg at all for a week with no activity", () => {
    const { container } = render(<WeeklyActivityChart days={week([0, 0, 0, 0, 0, 0, 0])} />);
    expect(screen.getByText(copy.chartEmpty, { exact: true })).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders the legend and never NaN or undefined, for any fixture", () => {
    for (const counts of [
      [8, 10, 14, 12, 16, 6, 8],
      [0, 0, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
    ]) {
      const { container, unmount } = render(<WeeklyActivityChart days={week(counts)} />);
      expect(container.textContent).not.toMatch(/NaN/);
      expect(container.textContent).not.toMatch(/undefined/);
      expect(container.innerHTML).not.toMatch(/NaN|undefined/);
      unmount();
    }
    render(<WeeklyActivityChart days={week([1, 2, 3, 4, 5, 6, 7])} />);
    expect(screen.getByText(copy.chartLegend, { exact: true })).toBeInTheDocument();
  });
});
