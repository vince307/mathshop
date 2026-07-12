import { expect, test } from "@playwright/test";
import { deleteUser, provisionAccount, seedChildProfile, signInViaUI } from "./helpers/accounts";
import { fill, t } from "./helpers/i18n";

/**
 * SEED EXEMPLAR — every generated e2e spec is modeled on this test.
 *
 * It demonstrates the four load-bearing patterns (see e2e/CLAUDE.md):
 *  1. Role/label locators resolved from the i18n dictionary (never CSS/XPath).
 *  2. Test independence: own provisioning (UUID email), own cleanup (finally),
 *     safe under parallel, any-order runs.
 *  3. Wait for state (waitForURL / toBeVisible), never for time.
 *  4. Risk-tied name + assertion on the durable, user-visible business outcome.
 *
 * Risk protected: seeded durable state (child profile) is what the child
 * actually sees after a real sign-in — the SSR render path, not an API echo.
 */
test("seed: a seeded child profile greets the child on the start screen", async ({ page }) => {
  const account = await provisionAccount("e2e-seed");
  try {
    const childName = "Iga";
    await seedChildProfile(account.id, { name: childName });

    await signInViaUI(page, account.email);

    // Sole profile → the /app router lands directly on the start screen.
    await page.waitForURL((url) => url.pathname.startsWith("/app/start"));
    await expect(page.getByRole("heading", { name: fill(t.start.greeting, { name: childName }) })).toBeVisible();
    await expect(page.getByText(t.start.walletLabel)).toBeVisible();
  } finally {
    await deleteUser(account.id);
  }
});
