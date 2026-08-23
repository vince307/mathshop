import React from "react";
import type { WeeklyReportDay } from "@/types";
import { t } from "@/i18n";

/**
 * The parent report's Monday–Sunday activity chart (FR-016), per
 * `assets/matmaverse-missing-screens-v3-web/05-parent-weekly-report-web.png`.
 *
 * **The project's first hand-rolled `<svg>` and no charting library** — the
 * mockup wants gridlines, per-bar value labels and axis ticks, which SVG draws
 * natively, and the stack has no chart dependency to gain one for seven bars.
 *
 * **The bars decompose the "Ukończone zadania" tile above them**: each day is
 * that day's tasks summed across all three competencies, so the seven bars add
 * up to the number printed above (`aggregateWeeklyReport`). `days` always
 * carries exactly seven Monday-first entries, so nothing here null-checks.
 *
 * **Accessibility is a real DOM list, not SVG semantics.** Screen-reader support
 * for `<svg role="img">` / `<title>` is uneven; the `<svg>` is therefore
 * `aria-hidden` and an `sr-only` `<ul>` beside it carries the same seven
 * day/count pairs — navigable, unambiguous, and directly assertable in jsdom.
 * The list names itself, because the heading above it is a `div` (adding a real
 * heading would change the page's heading tree under existing e2e locators).
 *
 * No colour is hard-coded: bars, gridlines and labels inherit `currentColor`
 * from semantic-token groups, the way `SkillBars` does, so both themes follow.
 */

/** SVG user-unit geometry. One fixed `viewBox`, scaled fluidly — no breakpoint. */
const VIEW_WIDTH = 320;
const VIEW_HEIGHT = 180;
const PLOT_LEFT = 26; // room for a two-digit y tick at font-size 9
const PLOT_RIGHT = 314;
const BASELINE_Y = 150;
const PLOT_TOP = 12; // headroom for the value label above the tallest bar
const DAY_LABEL_Y = 166;
const TICK_COUNT = 4; // 5 gridlines: 0, 1x, 2x, 3x, 4x step
const BAR_WIDTH_RATIO = 0.55;

/**
 * Round the axis up to four equal ticks, so a max of 16 reproduces the mockup's
 * `0 4 8 12 16` and a single completed task fills a quarter of the card rather
 * than the whole of it.
 */
function axisScale(maxCount: number): { step: number; yMax: number } {
  const step = Math.max(1, Math.ceil(maxCount / TICK_COUNT));
  return { step, yMax: step * TICK_COUNT };
}

export default function WeeklyActivityChart({ days }: { days: WeeklyReportDay[] }) {
  const copy = t.report;
  const maxCount = days.reduce((max, day) => Math.max(max, day.completed), 0);

  // An axis of seven zeros is noise, and it is the state a brand-new parent
  // actually sees — say so in words instead, in the same voice as `noPractice`.
  if (maxCount === 0) {
    return <p className="text-muted-foreground mt-2 text-sm">{copy.chartEmpty}</p>;
  }

  const { step, yMax } = axisScale(maxCount);
  const plotWidth = PLOT_RIGHT - PLOT_LEFT;
  const plotHeight = BASELINE_Y - PLOT_TOP;
  const barStep = plotWidth / days.length;
  const barWidth = barStep * BAR_WIDTH_RATIO;
  const yFor = (count: number) => BASELINE_Y - (count / yMax) * plotHeight;
  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => i * step);

  return (
    <div className="mt-2">
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-auto w-full max-w-md"
        aria-hidden="true"
        focusable="false"
      >
        <g className="text-border" stroke="currentColor" strokeWidth="1">
          {ticks.map((tick) => (
            <line key={tick} x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={yFor(tick)} y2={yFor(tick)} />
          ))}
        </g>

        <g className="text-muted-foreground" fill="currentColor" fontSize="9" textAnchor="end">
          {ticks.map((tick) => (
            <text key={tick} x={PLOT_LEFT - 4} y={yFor(tick) + 3}>
              {tick}
            </text>
          ))}
        </g>

        <g className="text-primary" fill="currentColor">
          {days.map((day) => {
            // A zero day draws NO rect — a stub rectangle would read as a small
            // non-zero value. Its label and its `0` are still drawn below.
            if (day.completed === 0) return null;
            const centre = PLOT_LEFT + barStep * day.weekday + barStep / 2;
            const top = yFor(day.completed);
            return (
              <rect
                key={day.date}
                x={centre - barWidth / 2}
                y={top}
                width={barWidth}
                height={BASELINE_Y - top}
                rx="3"
              />
            );
          })}
        </g>

        <g className="text-foreground" fill="currentColor" fontSize="10" textAnchor="middle" fontWeight="700">
          {days.map((day) => (
            <text key={day.date} x={PLOT_LEFT + barStep * day.weekday + barStep / 2} y={yFor(day.completed) - 4}>
              {day.completed}
            </text>
          ))}
        </g>

        <g className="text-muted-foreground" fill="currentColor" fontSize="11" textAnchor="middle">
          {days.map((day) => (
            <text key={day.date} x={PLOT_LEFT + barStep * day.weekday + barStep / 2} y={DAY_LABEL_Y}>
              {copy.chartDaysShort[day.weekday]}
            </text>
          ))}
        </g>
      </svg>

      <ul className="sr-only" aria-label={copy.chartHeading}>
        {days.map((day) => (
          <li key={day.date}>
            {copy.chartDayValue
              .replace("{day}", copy.chartDaysLong[day.weekday])
              .replace("{count}", String(day.completed))}
          </li>
        ))}
      </ul>

      <p className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
        <span className="bg-primary size-2.5 shrink-0 rounded-sm" aria-hidden="true" />
        {copy.chartLegend}
      </p>
    </div>
  );
}
