import { expect, test } from "@playwright/test";
import { deleteUser, provisionAccount, seedChildProfile, signInViaUI } from "./helpers/accounts";
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
 * A seeded-week variant (non-zero bars) is deliberately NOT here: `e2e/helpers/`
 * has no `shift_log` seeder, so it would cost a full gameplay run per assertion
 * for coverage the Phase 4 jsdom test already gives in milliseconds.
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
