import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { AVATARS } from "../src/data/avatars";
import { WORLDS } from "../src/data/worlds";
import { admin, deleteUser, findUserIdByEmail, PASSWORD, provisionAccount, signInViaUI } from "./helpers/accounts";
import { waitForIslands } from "./helpers/hydration";
import { fill, t } from "./helpers/i18n";

/**
 * Risk #4 (test-plan.md §2) — onboarding critical path, browser half.
 * Modeled on e2e/seed.spec.ts; grounding: context/changes/testing-e2e-playwright/research.md.
 *
 * What only this layer proves: the full multi-page 302 chain in ONE real cookie
 * jar (signup POST → interstitial → confirm-link hop → /app router → wizard
 * POST → start screen), island hydration of the noValidate forms, and the
 * wizard's client-side step machine. The per-hop route contracts stay covered
 * by tests/auth-routes.test.ts / auth-confirm.test.ts — not re-asserted here.
 */

test("onboarding: signup → confirm link → first profile → start screen (Risk #4)", async ({ page }) => {
  const email = `e2e-onboarding-${randomUUID()}@example.test`;
  let userId: string | null = null;
  try {
    // Sign up through the real, hydrated form.
    await page.goto("/auth/signup");
    await waitForIslands(page);
    await page.getByLabel(t.auth.fields.emailLabel).fill(email);
    await page.getByLabel(t.auth.fields.passwordLabel, { exact: true }).fill(PASSWORD);
    await page.getByLabel(t.auth.fields.confirmLabel).fill(PASSWORD);
    await page.getByRole("button", { name: t.auth.signup.submit }).click();

    // Interstitial: the signup route always lands here, email echoed in the URL.
    await page.waitForURL((url) => url.pathname === "/auth/confirm-email");
    await expect(page.getByRole("heading", { name: t.confirmEmail.checkEmail.heading })).toBeVisible();
    userId = await findUserIdByEmail(email);
    expect(userId, "signup should have created the user").not.toBeNull();

    // Production semantics: the device that opens the email link starts with no
    // session (locally the signup POST auto-confirms and sets one — research.md
    // follow-up). Clear cookies so the confirm hop alone must mint the session;
    // without this, a broken confirm route is masked by the signup session and
    // the assertion below is decorative (deliberate-break verified).
    await page.context().clearCookies();

    // The emailed-link hop, minted without an inbox round-trip. Local Supabase
    // auto-confirms on signup (enable_confirmations=false), so a `signup`-type
    // link can no longer be generated for this user — `magiclink` drives the
    // same whitelisted verifyOtp path + redirect glue in /api/auth/confirm.
    // The `signup` type itself is pinned at route level in tests/auth-confirm.test.ts.
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (error) throw error;
    await page.goto(`/api/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`);

    // Confirm route → /app → router sends the profile-less account to the wizard.
    await page.waitForURL((url) => url.pathname === "/app/new-profile");
    await waitForIslands(page);

    // Wizard step 1 — identity.
    const childName = "Marysia";
    await expect(page.getByRole("heading", { name: t.profileWizard.title })).toBeVisible();
    await page.getByLabel(t.profileWizard.nameLabel).fill(childName);
    await page.getByRole("button", { name: `7 ${t.profileWizard.ageUnit}` }).click();
    await page.getByRole("button", { name: t.profileWizard.next }).click();

    // Wizard step 2 — avatar + world (tile names = img alt + label composite).
    await page.getByRole("button", { name: AVATARS[1].alt }).click();
    await page.getByRole("button", { name: WORLDS[0].name }).first().click();
    await page.getByRole("button", { name: t.profileWizard.next }).click();

    // Wizard step 3 — review carries step-1/2 state, then the native POST.
    await expect(page.getByText(t.profileWizard.reviewIntro)).toBeVisible();
    await expect(page.getByText(childName)).toBeVisible();
    await page.getByRole("button", { name: t.profileWizard.create }).click();

    // Create route sets active_profile → /app router → start screen greets the child.
    await page.waitForURL((url) => url.pathname === "/app/start");
    await expect(page.getByRole("heading", { name: fill(t.start.greeting, { name: childName }) })).toBeVisible();
  } finally {
    const id = userId ?? (await findUserIdByEmail(email));
    if (id) await deleteUser(id);
  }
});

test("hydrated signup form blocks invalid input with Polish inline errors (Risk #4 edge)", async ({ page }) => {
  await page.goto("/auth/signup");
  await waitForIslands(page);

  // Empty submit: client validation blocks the POST — we stay on the page.
  await page.getByRole("button", { name: t.auth.signup.submit }).click();
  await expect(page.getByText(t.auth.validation.emailRequired)).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/signup/);

  // Short + mismatched passwords surface their own Polish errors, still client-side.
  await page.getByLabel(t.auth.fields.emailLabel).fill(`e2e-validation-${randomUUID()}@example.test`);
  await page.getByLabel(t.auth.fields.passwordLabel, { exact: true }).fill("abc");
  await page.getByLabel(t.auth.fields.confirmLabel).fill("abcd");
  await page.getByRole("button", { name: t.auth.signup.submit }).click();
  await expect(page.getByText(t.auth.validation.passwordTooShort)).toBeVisible();
  await expect(page.getByText(t.auth.validation.passwordMismatch)).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/signup/);
  // No user is created — nothing to clean up (the POST never fired).
});

test("an authenticated parent is bounced off /auth/signup back into the app (Risk #4 edge)", async ({ page }) => {
  const account = await provisionAccount("e2e-bounce");
  try {
    await signInViaUI(page, account.email);
    await page.goto("/auth/signup");
    await page.waitForURL((url) => url.pathname.startsWith("/app"));
  } finally {
    await deleteUser(account.id);
  }
});
