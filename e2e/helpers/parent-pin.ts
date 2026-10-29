import { expect, type Page } from "@playwright/test";
import { waitForIslands } from "./hydration";
import { t } from "./i18n";

/**
 * Set the parent PIN for the first time and land on `/app/report`.
 *
 * Shared by every spec that needs to be *behind* the gate rather than to test
 * the gate itself: the report page redirects to `/app/parent-pin` without the
 * signed marker, and a first-time set mints the marker immediately, so this is
 * the shortest honest route in. Extracted from `parent-surfaces.spec.ts` so a
 * second spec does not fork the flow — each caller still provisions and cleans
 * up its own throwaway account, so tests stay independent.
 */
export async function setPinAndLandOnReport(page: Page, pin: string): Promise<void> {
  await page.goto("/app/report");
  // No marker → the report page redirects to the gate, in SET mode (no PIN yet).
  await page.waitForURL((url) => url.pathname.startsWith("/app/parent-pin"));
  await expect(page.getByRole("heading", { name: t.parentPin.setHeading })).toBeVisible();
  await waitForIslands(page);
  await page.getByLabel(t.parentPin.pinLabel).fill(pin);
  await page.getByLabel(t.parentPin.confirmLabel).fill(pin);
  await page.getByRole("button", { name: t.parentPin.setSubmit }).click();
  // First-time set mints the marker immediately → auto-land on the report.
  await page.waitForURL((url) => url.pathname.startsWith("/app/report"));
  await expect(page.getByRole("heading", { name: t.report.heading })).toBeVisible();
}
