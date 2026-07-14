import type { Browser, BrowserContext } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { deleteUser, provisionAccount, seedChildProfile, signInViaUI } from "./helpers/accounts";
import { waitForIslands } from "./helpers/hydration";
import { fill, t } from "./helpers/i18n";
import { solveShift } from "./helpers/solve-shift";

/**
 * Risks #6 + #2 (test-plan.md §2) — the child gameplay loop via real taps, and
 * the user-visible cross-context restore. Modeled on e2e/seed.spec.ts;
 * grounding: context/changes/testing-e2e-playwright/research.md.
 *
 * Runs in BOTH projects (desktop + touch — see playwright.config.ts testMatch).
 * What only this layer proves: island hydration + tap/beat/auto-advance across a
 * nondeterministically generated shift, the real browser fetch to
 * /api/shifts/complete, and that a brand-new context (UI re-signin, never
 * storageState) sees the SSR-rendered earned state. Scoring math, route
 * persistence, and guardrail feedback invariants stay in the vitest suites.
 */

/** browser.newContext() does not inherit the project's use options — pass them. */
function freshContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext(test.info().project.use);
}

async function startShift(page: import("@playwright/test").Page): Promise<void> {
  await page.waitForURL((url) => url.pathname.startsWith("/app/start"));
  // The start button is an island navigating via onClick — a pre-hydration
  // click is silently lost (same class of race as the signin form fill).
  await waitForIslands(page);
  await page.getByRole("button", { name: t.start.open }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/app/task"));
  await waitForIslands(page);
}

test("gameplay: start → tasks (one soft retry) → results → upgrade purchase (Risk #6)", async ({ page }) => {
  test.slow();
  const account = await provisionAccount("e2e-gameplay");
  try {
    await seedChildProfile(account.id, { name: "Iga", walletBalance: 0 });
    await signInViaUI(page, account.email);
    await startShift(page);

    const { earned } = await solveShift(page, { failFirstTaskOnce: true });

    // Exact server-computed payout, recomputed independently (5/task + 3/clean).
    await expect(page.getByText(fill(t.results.earnedLabel, { earned }))).toBeVisible();
    // One dirty task in a 5–7 task shift → clean rate in [0.8, 0.86] → always 2 stars.
    await expect(page.getByRole("img", { name: fill(t.results.starsLabel, { earned: 2 }) })).toBeVisible();

    await page.getByRole("button", { name: t.results.backToStart }).click();
    await page.waitForURL((url) => url.pathname.startsWith("/app/start"));

    // Upgrade purchase: the 30 zł Szyld is affordable after any shift (min 37 zł).
    await page.getByRole("link", { name: t.start.upgradesLink }).click();
    await page.waitForURL((url) => url.pathname.startsWith("/app/upgrades"));
    await waitForIslands(page);
    // The decision prompt pins the exact wallet balance in user-visible copy.
    await expect(page.getByText(fill(t.upgradeShop.decisionPrompt, { wallet: earned }))).toBeVisible();
    await page
      .getByRole("listitem")
      .filter({ hasText: t.upgrades.sign.name })
      .getByRole("button", { name: t.upgradeShop.buy })
      .click();
    await expect(page.getByText(t.upgradeShop.unlockedHeading)).toBeVisible();
    await page.getByRole("button", { name: t.upgradeShop.unlockedDismiss }).click();
    await expect(
      page.getByRole("listitem").filter({ hasText: t.upgrades.sign.name }).getByText(t.upgradeShop.ownedTag),
    ).toBeVisible();
  } finally {
    await deleteUser(account.id);
  }
});

test("restore: a fresh browser context re-signs in and sees the earned state (Risk #2)", async ({ browser }) => {
  test.slow();
  const account = await provisionAccount("e2e-restore");
  // Track manually created contexts so a mid-test throw can't leak them for
  // the worker's lifetime (impl-review F4); closed in the finally.
  const openContexts: BrowserContext[] = [];
  const trackedContext = async (): Promise<BrowserContext> => {
    const context = await freshContext(browser);
    openContexts.push(context);
    return context;
  };
  try {
    // Seed the cheapest upgrade as owned so the restore assertion covers shop state.
    await seedChildProfile(account.id, { name: "Pola", walletBalance: 0, shopState: { purchased: ["sign"] } });

    // Context A: earn a clean shift, then "close the browser".
    const contextA = await trackedContext();
    const pageA = await contextA.newPage();
    await signInViaUI(pageA, account.email);
    await startShift(pageA);
    const { earned } = await solveShift(pageA);
    await expect(pageA.getByText(fill(t.results.earnedLabel, { earned }))).toBeVisible();
    await contextA.close();

    // Context B: a brand-new browser — UI re-signin, never storageState (it would
    // falsely carry the session-lifetime active_profile cookie; research.md §Risk #2).
    const contextB = await trackedContext();
    const pageB = await contextB.newPage();
    await signInViaUI(pageB, account.email);
    await pageB.waitForURL((url) => url.pathname.startsWith("/app/start"));
    await expect(pageB.getByRole("heading", { name: fill(t.start.greeting, { name: "Pola" }) })).toBeVisible();
    await pageB.goto("/app/upgrades");
    await waitForIslands(pageB);
    // Exact restored wallet via user-visible copy: with sign owned and 40–56 zł
    // earned, the next upgrade is the 60 zł shelf — the gap line pins the balance.
    await expect(
      pageB.getByText(fill(t.upgradeShop.nextProgress, { amount: 60 - earned, name: t.upgrades.shelf.name })),
    ).toBeVisible();
    await expect(pageB.getByText(t.upgradeShop.ownedTag)).toBeVisible();
    await contextB.close();

    // Context C: with a second profile, a fresh browser lands on the picker —
    // the active_profile cookie is session-lifetime BY DESIGN (picker on launch).
    await seedChildProfile(account.id, { name: "Karol" });
    const contextC = await trackedContext();
    const pageC = await contextC.newPage();
    await signInViaUI(pageC, account.email);
    await pageC.waitForURL((url) => url.pathname.startsWith("/app/pick-profile"));
    await expect(pageC.getByRole("heading", { name: t.picker.heading })).toBeVisible();
    await pageC.getByRole("button", { name: fill(t.picker.tileLabel, { name: "Pola" }) }).click();
    await pageC.waitForURL((url) => url.pathname.startsWith("/app/start"));
    await expect(pageC.getByRole("heading", { name: fill(t.start.greeting, { name: "Pola" }) })).toBeVisible();
    await contextC.close();
  } finally {
    for (const context of openContexts) await context.close().catch(() => undefined);
    await deleteUser(account.id);
  }
});
