import { expect, test } from "@playwright/test";
import { deleteUser, provisionAccount, signInViaUI } from "./helpers/accounts";
import { t } from "./helpers/i18n";

/**
 * Harness smoke — proves the e2e bootstrap end-to-end before any journey spec
 * exists: webServer env mapping, Supabase provisioning helpers, real-browser
 * middleware gating, and UI sign-in. Deliberately shallow on product logic.
 */
test.describe("harness smoke", () => {
  test("home page renders with the brand", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(new RegExp(t.brand));
  });

  test("anonymous /app redirects to signin", async ({ page }) => {
    await page.goto("/app");
    await page.waitForURL((url) => url.pathname.startsWith("/auth/signin"));
    await expect(page.getByRole("button", { name: t.auth.signin.submit })).toBeVisible();
  });

  test("provisioned account signs in via UI and reaches the app", async ({ page }) => {
    const account = await provisionAccount("e2e-smoke");
    try {
      await signInViaUI(page, account.email);
      // Zero profiles → the /app router lands on the create-profile wizard.
      await page.waitForURL((url) => url.pathname.startsWith("/app/new-profile"));
      await expect(page.getByRole("heading", { name: t.profileWizard.title })).toBeVisible();
    } finally {
      await deleteUser(account.id);
    }
  });
});
