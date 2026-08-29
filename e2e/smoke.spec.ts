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

    /*
      The sign-in fields carry no VISIBLE label — the mockups put the field's
      name in the placeholder and clip the <label> with `sr-only`. Their only
      remaining name is the accessible one, so it is asserted here.

      This assertion exists because the obvious guard is not one. Fifteen specs
      locate these inputs with `getByLabel`, and the change that hid the labels
      assumed those locators were the safety net — but `getByLabel` matches the
      label's TEXT IN THE DOM and never asks whether it reached the accessibility
      tree. Swapping `sr-only` for `hidden` was run as a deliberate break and the
      whole suite stayed green while a screen reader would have announced two
      unnamed text boxes (L-009: a check that can pass without the thing it
      checks). `toHaveAccessibleName` computes the name per the accname spec,
      which skips `display: none` subtrees — so this one goes red on exactly that
      edit. Verified falsifiable in both directions before it landed.

      The two mechanisms are different, which is what stops this being circular:
      `getByLabel` REACHES the input through the label's DOM text (and keeps
      working when the label is hidden), while `toHaveAccessibleName` RECOMPUTES
      the name the way a screen reader would. The locator resolving and the
      assertion failing is precisely the state being guarded against.
    */
    await expect(page.getByLabel(t.auth.fields.emailLabel)).toHaveAccessibleName(t.auth.fields.emailLabel);
    await expect(page.getByLabel(t.auth.fields.passwordLabel, { exact: true })).toHaveAccessibleName(
      t.auth.fields.passwordLabel,
    );
  });

  // `PROTECTED_ROUTES` gates on a `startsWith("/app")` prefix, so a new screen
  // under /app is auth-gated by construction — this pins that "by construction"
  // for the newest route, the one most likely to be moved out from under the
  // prefix (F4, /app/growth).
  test("anonymous /app/growth redirects to signin", async ({ page }) => {
    await page.goto("/app/growth");
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
