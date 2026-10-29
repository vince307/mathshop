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
      tree, so it keeps resolving through any amount of CSS.

      **Be precise about what this catches, because an earlier version of this
      comment was not.** It claimed `toHaveAccessibleName` "skips display: none
      subtrees" and therefore goes red when `sr-only` is swapped for `hidden`. It
      does not. Measured in Chromium against this very page:

        as shipped (sr-only)       getByLabel: 1   accessible name: PASS
        label display:none         getByLabel: 1   accessible name: PASS
        label deleted              getByLabel: 0   accessible name: FAIL

      Chromium resolves a `<label for>` association regardless of the label's CSS
      or `aria-hidden`, and the name survives even with the placeholder removed.
      So hiding the label costs the field nothing, and NOTHING here guards
      against hiding it — there is nothing to guard against.

      What this assertion does catch is the one edit that genuinely removes the
      name: DELETING a label that renders nothing, which is the tidy-up a future
      reader is most likely to attempt and which the `getByLabel` locators would
      have caught only as fifteen confusing timeouts. It is asserted on every
      route `FormField` backs — here, `e2e/onboarding.spec.ts` for `/auth/signup`
      and `e2e/password-reset.spec.ts` for the recovery pair — because this spec
      alone covers one of the four.
    */
    await expect(page.getByLabel(t.auth.fields.emailLabel)).toHaveAccessibleName(t.auth.fields.emailLabel);
    await expect(page.getByLabel(t.auth.fields.passwordLabel, { exact: true })).toHaveAccessibleName(
      t.auth.fields.passwordLabel,
    );

    /*
      The secondary CTA's label is two strings, not one: the mockup asks a
      question in muted weight and answers it in bold blue. The question half
      (`noAccount`) is the fragile one — it sat in the dictionary referenced by
      nothing at all until this change wired it, which is exactly the kind of
      string that gets silently dropped a second time. Asserting the composed
      ACCESSIBLE NAME, rather than the presence of either half, is what makes
      dropping one of them fail.
    */
    await expect(
      page.getByRole("link", { name: `${t.auth.signin.noAccount} ${t.auth.signin.signupLink}` }),
    ).toBeVisible();
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
