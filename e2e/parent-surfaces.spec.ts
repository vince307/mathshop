import { expect, test } from "@playwright/test";
import { deleteUser, findUserIdByEmail, provisionAccount, signInViaUI } from "./helpers/accounts";
import { waitForIslands } from "./helpers/hydration";
import { fill, t } from "./helpers/i18n";

/**
 * Parent surfaces (test-plan.md §3 Phase 5 scope) — the PIN-gate cookie
 * lifecycle and the destructive account-deletion chain. Modeled on
 * e2e/seed.spec.ts; grounding: context/changes/testing-e2e-playwright/research.md.
 *
 * What only this layer proves: the per-page gate + signed 15-min marker cookie
 * through real navigations (middleware does NOT check the PIN), the radix
 * dialog's disabled-until-armed physics in a real browser, and the post-delete
 * chain (farewell → cookies cleared → /app re-gates). PIN hashing, lockout
 * throttle, and the route's durable cascade stay in the vitest suites; the
 * lockout (5 tries + 60 s cooldown) is deliberately NOT e2e'd (forced sleep).
 * DESTRUCTIVE: each test provisions its own throwaway account; deletion is
 * cascade-isolated to that account (research.md §Parent surfaces).
 */

const setPinAndLandOnReport = async (page: import("@playwright/test").Page, pin: string): Promise<void> => {
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
};

test("parent PIN gate: set → auto-land → marker persists → re-gate → wrong then right PIN", async ({
  page,
  context,
}) => {
  const account = await provisionAccount("e2e-pin");
  const pin = "2468";
  try {
    await signInViaUI(page, account.email);
    await setPinAndLandOnReport(page, pin);

    // Marker persists across navigation (15-min TTL) — no re-PIN within it.
    await page.goto("/app");
    await page.goto("/app/report");
    await expect(page.getByRole("heading", { name: t.report.heading })).toBeVisible();

    // Cleared marker (browser restart / expiry) → re-gate in ENTER mode.
    await context.clearCookies({ name: "parent_verified" });
    await page.goto("/app/report");
    await page.waitForURL((url) => url.pathname.startsWith("/app/parent-pin"));
    await expect(page.getByRole("heading", { name: t.parentPin.enterHeading })).toBeVisible();
    await waitForIslands(page);

    // Wrong PIN → soft, announced error; still gated.
    await page.getByLabel(t.parentPin.pinLabel).fill("9999");
    await page.getByRole("button", { name: t.parentPin.enterSubmit }).click();
    await expect(page.getByRole("alert")).toHaveText(t.parentPin.errors.wrong);

    // Correct PIN → admitted again.
    await page.getByLabel(t.parentPin.pinLabel).fill(pin);
    await page.getByRole("button", { name: t.parentPin.enterSubmit }).click();
    await page.waitForURL((url) => url.pathname.startsWith("/app/report"));
    await expect(page.getByRole("heading", { name: t.report.heading })).toBeVisible();
  } finally {
    await deleteUser(account.id);
  }
});

test("account deletion: arms only on typed email, deletes, farewell, and the app re-gates", async ({ page }) => {
  test.slow();
  const account = await provisionAccount("e2e-delete");
  const pin = "1357";
  try {
    await signInViaUI(page, account.email);
    await setPinAndLandOnReport(page, pin);
    await waitForIslands(page);

    // Danger zone → the typed-confirmation dialog.
    await expect(page.getByRole("heading", { name: t.deletion.accountHeading })).toBeVisible();
    await page.getByRole("button", { name: t.deletion.accountAction }).click();
    const dialog = page.getByRole("alertdialog", { name: t.deletion.accountTitle });
    await expect(dialog).toBeVisible();

    const confirmButton = dialog.getByRole("button", { name: t.deletion.accountConfirm });
    const typedInput = dialog.getByLabel(fill(t.deletion.typeToConfirm, { expected: account.email }));
    const pinInput = dialog.getByLabel(t.deletion.accountPinLabel);

    // Boundary: a wrong typed string never arms the destructive button — even
    // with the PIN filled. Arming is the conscious-choice gate.
    await pinInput.fill(pin);
    await typedInput.fill("nie ten adres");
    await expect(confirmButton).toBeDisabled();

    await typedInput.fill(account.email);
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    // Farewell landing — the route signed the browser out and cleared cookies.
    await page.waitForURL((url) => url.pathname === "/" && url.searchParams.get("deleted") === "1");
    await expect(page.getByRole("status")).toHaveText(t.deletion.accountDeleted);

    // Durable outcome, not just the copy: the session is gone (gate re-triggers)…
    await page.goto("/app");
    await page.waitForURL((url) => url.pathname.startsWith("/auth/signin"));
    // …and the account itself is gone (admin-side existence check, L-002 spirit).
    expect(await findUserIdByEmail(account.email)).toBeNull();
  } finally {
    // Normally already deleted by the flow — clean up only if it broke early.
    const leftoverId = await findUserIdByEmail(account.email);
    if (leftoverId) await deleteUser(leftoverId);
  }
});
