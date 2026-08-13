import { expect, test } from "@playwright/test";
import { admin, deleteUser, PASSWORD, provisionAccount, signInViaUI } from "./helpers/accounts";
import { waitForIslands } from "./helpers/hydration";
import { t } from "./helpers/i18n";

/**
 * Password recovery — the browser half (plan phase 3).
 *
 * What only this layer proves: the whole loop in ONE real cookie jar — request
 * form → recovery link → marker-gated form → signed in at /app — plus that the
 * NEW password actually works at the sign-in form afterwards and the old one
 * does not. The per-route contracts (enumeration parity, marker refusals,
 * other-device revocation) stay covered by tests/auth-update-password.test.ts
 * and tests/auth-reset-request.test.ts — not re-asserted here.
 *
 * The emailed link is minted with `generateLink({ type: "recovery" })`, the same
 * inbox-free technique the onboarding spec uses; the template's link shape is
 * proven separately against Mailpit.
 */

const NEW_PASSWORD = "e2e-new-password-456!";

test("recovery: request → link → new password → signed in, old password dead (MAT password reset)", async ({
  page,
}) => {
  const account = await provisionAccount("e2e-recovery");
  try {
    // Request the link through the real form.
    await page.goto("/auth/reset-password");
    await waitForIslands(page);
    await page.getByLabel(t.auth.fields.emailLabel).fill(account.email);
    await page.getByRole("button", { name: t.auth.reset.submit }).click();

    // Enumeration-safe notice — the same one an unknown address would see.
    await page.waitForURL((url) => url.searchParams.get("sent") === "1");
    await expect(page.getByText(t.auth.reset.sentNotice)).toBeVisible();

    // The emailed hop, minted without an inbox round-trip.
    const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email: account.email });
    if (error) throw error;
    await page.goto(
      `/api/auth/confirm?token_hash=${data.properties.hashed_token}&type=recovery&next=/auth/update-password`,
    );

    // The link must land on the set-new-password form, NOT /app — the safeNext
    // trap would silently drop `next` and leave the parent unable to reset.
    await page.waitForURL((url) => url.pathname === "/auth/update-password");
    await waitForIslands(page);
    await expect(page.getByRole("heading", { name: t.auth.updatePassword.heading })).toBeVisible();

    // `exact` because "Nowe hasło" is a substring of "Powtórz nowe hasło" — the
    // same disambiguation the sign-in/up specs use for their password label.
    await page.getByLabel(t.auth.updatePassword.newPasswordLabel, { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel(t.auth.updatePassword.repeatLabel).fill(NEW_PASSWORD);
    await page.getByRole("button", { name: t.auth.updatePassword.submit }).click();

    // Still signed in — the reset must not dump the parent back at the login form.
    await page.waitForURL((url) => url.pathname.startsWith("/app"));

    // The durable proof: sign out, then the NEW password works at the real form.
    await page.context().clearCookies();
    await signInViaUI(page, account.email, NEW_PASSWORD);

    // …and the OLD one does not.
    await page.context().clearCookies();
    await page.goto("/auth/signin");
    await waitForIslands(page);
    await page.getByLabel(t.auth.fields.emailLabel).fill(account.email);
    await page.getByLabel(t.auth.fields.passwordLabel, { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: t.auth.signin.submit }).click();
    // `exact` so the assertion binds to the rendered message, not the dev
    // toolbar's island-props JSON, which echoes the same string.
    await expect(page.getByText(t.auth.serverError.invalidCredentials, { exact: true })).toBeVisible();
  } finally {
    await deleteUser(account.id);
  }
});

test("the set-new-password page refuses a parent who arrived without a recovery link", async ({ page }) => {
  // A signed-in parent who simply navigates to the URL holds a session but no
  // marker — the gate must send them to request a link instead of showing a form
  // they cannot submit.
  const account = await provisionAccount("e2e-nomarker");
  try {
    await signInViaUI(page, account.email);

    await page.goto("/auth/update-password");

    await page.waitForURL((url) => url.pathname === "/auth/reset-password");
    await expect(page.getByRole("heading", { name: t.auth.reset.heading })).toBeVisible();
  } finally {
    await deleteUser(account.id);
  }
});
