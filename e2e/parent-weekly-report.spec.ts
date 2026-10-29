import { expect, test } from "@playwright/test";
import { deleteUser, provisionAccount, seedChildProfile, seedShiftWeek, signInViaUI } from "./helpers/accounts";
import { waitForIslands } from "./helpers/hydration";
import { t } from "./helpers/i18n";
import { setPinAndLandOnReport } from "./helpers/parent-pin";

/**
 * The parent weekly report's activity chart and first-try tile
 * (`context/changes/parent-weekly-activity-chart/plan.md`, Phase 6). Modeled on
 * e2e/seed.spec.ts.
 *
 * **What only this layer proves.** The report is a `client:load` island, and the
 * `<h1>` above it is rendered by AppShell on the SERVER — so a component that
 * throws during hydration leaves the heading visible and every pre-existing
 * assertion green. The jsdom suites prove the chart's and the tile's shapes;
 * only a real browser proves the enlarged island still hydrates, and only a real
 * viewport proves the widened three-tile row plus the new `<svg>` stay inside a
 * 390 px screen. CI otherwise renders `/app/report` at 1280 px and nowhere else.
 *
 * - **A NON-ZERO week actually renders.** Every assertion above runs on an empty
 *   week, which takes `WeeklyActivityChart`'s `maxCount === 0` early return — so
 *   the live chart path (axis, bars, the sr-only day list) was never reached in a
 *   browser at all, and the tasks tile was only ever seen printing 0. `e2e/helpers/
 *   accounts.ts` now exports `seedShiftWeek`, which places real `shift_log` rows on
 *   real Warsaw chart days, so the seeded total can be read off the tile and the
 *   bars beneath it (Risk E2E-3).
 */

/** The whole rendered page as text — a measurement, not an element locator. */
const pageText = (page: import("@playwright/test").Page) => page.evaluate(() => document.body.innerText);

test("empty-week report hydrates: chart, first-try tile, and no NaN (Risk E2E-1)", async ({ page }) => {
  const account = await provisionAccount("e2e-report-chart");
  try {
    await seedChildProfile(account.id, { name: "Iga" });
    await signInViaUI(page, account.email);
    await setPinAndLandOnReport(page, "2468");
    await waitForIslands(page);

    // The chart section renders, and a week with no shifts says so in words
    // rather than drawing an axis of seven zeros.
    await expect(page.getByText(t.report.chartHeading, { exact: true })).toBeVisible();
    await expect(page.getByText(t.report.chartEmpty, { exact: true })).toBeVisible();

    // The first-try tile renders its zero-denominator state: an em-dash plus a
    // spoken reason. Asserting the reason (not just the dash) is what proves the
    // `null` branch rather than merely that some tile exists.
    await expect(page.getByText(t.report.statFirstTry, { exact: true })).toBeVisible();
    await expect(page.getByText(t.report.statFirstTryNoData, { exact: true })).toBeAttached();
    await expect(page.getByText(t.report.statFirstTryNone, { exact: true })).toBeVisible();

    // `0/0` must never reach the parent as `NaN%`.
    expect(await pageText(page)).not.toContain("NaN");

    // The pre-existing heading locator three other assertions rely on must not
    // have become ambiguous by adding a section to the card.
    await expect(page.getByRole("heading", { name: t.report.heading })).toHaveCount(1);
  } finally {
    await deleteUser(account.id);
  }
});

test("a seeded non-zero week renders live bars whose total matches the tasks tile (Risk E2E-3)", async ({ page }) => {
  const account = await provisionAccount("e2e-report-seeded");
  try {
    const profileId = await seedChildProfile(account.id, { name: "Iga" });
    // 4 + 3 + 2 = 9 completed tasks, on Monday, Wednesday and Saturday of the
    // CURRENT Warsaw report week. Seeded BEFORE sign-in so the server render
    // already has them.
    await seedShiftWeek(account.id, profileId, [4, 0, 3, 0, 0, 2, 0]);

    await signInViaUI(page, account.email);
    // /app/report is behind the parent-PIN gate; without this the test never
    // reaches the report at all. `waitForIslands` is what keeps it from racing
    // the `client:load` island.
    await setPinAndLandOnReport(page, "3690");
    await waitForIslands(page);

    await expect(page.getByText(t.report.chartHeading, { exact: true })).toBeVisible();

    // The live chart path, not the maxCount === 0 early return.
    await expect(page.getByText(t.report.chartEmpty, { exact: true })).toHaveCount(0);

    // The tile prints the seeded total…
    await expect(page.getByText(t.report.statTasks, { exact: true })).toBeVisible();
    await expect(page.getByText("9", { exact: true })).toHaveCount(1);

    // …and the sr-only bar list decomposes it: the three seeded days carry their
    // own counts, which is what proves the rows landed on the intended weekdays
    // rather than being bucketed by UTC into the wrong bar.
    const bars = page.getByRole("list", { name: t.report.chartHeading });
    await expect(bars).toHaveCount(1);
    for (const [weekday, count] of [
      [0, 4],
      [2, 3],
      [5, 2],
    ] as const) {
      const label = t.report.chartDayValue
        .replace("{day}", t.report.chartDaysLong[weekday])
        .replace("{count}", String(count));
      await expect(bars.getByText(label, { exact: true })).toHaveCount(1);
    }

    // `earned` was set explicitly on every seeded row, so the earnings tile is
    // present rather than suppressed by an unknown payout.
    await expect(page.getByText(t.report.statEarned, { exact: true })).toBeVisible();
  } finally {
    await deleteUser(account.id);
  }
});

test("the report stays inside a 390 px phone screen (Risk E2E-2)", async ({ page }) => {
  const account = await provisionAccount("e2e-report-phone");
  try {
    await seedChildProfile(account.id, { name: "Iga" });
    await page.setViewportSize({ width: 390, height: 844 });
    await signInViaUI(page, account.email);
    await setPinAndLandOnReport(page, "1357");
    await waitForIslands(page);

    // Both new surfaces are readable at phone width — no breakpoint hides them.
    await expect(page.getByText(t.report.chartHeading, { exact: true })).toBeVisible();
    await expect(page.getByText(t.report.statFirstTry, { exact: true })).toBeVisible();

    // Nothing the change added pushes the page off-screen sideways. The 1 px
    // slack absorbs sub-pixel rounding at fractional device scales.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  } finally {
    await deleteUser(account.id);
  }
});
