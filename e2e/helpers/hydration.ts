import type { Page } from "@playwright/test";

/**
 * Wait until every Astro island on the page has hydrated (Astro removes the
 * `ssr` attribute from `<astro-island>` when the framework component mounts).
 *
 * Needed before exercising client-side-only behavior — e.g. React form
 * validation on the `noValidate` auth forms: a click on a pre-hydration form
 * fires the NATIVE POST (server round-trip) instead of the client validation
 * under test. This is an infrastructure wait, not an element locator (the one
 * sanctioned non-role selector — see e2e/CLAUDE.md).
 */
export async function waitForIslands(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const islands = document.querySelectorAll("astro-island");
    return islands.length > 0 && Array.from(islands).every((island) => !island.hasAttribute("ssr"));
  });
}
