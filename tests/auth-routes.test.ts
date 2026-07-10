import type { AstroCookies } from "astro";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createAppClient } from "@/lib/supabase";
import { POST as signinPOST } from "@/pages/api/auth/signin";
import { POST as signupPOST } from "@/pages/api/auth/signup";
import { POST as resendPOST, resendFailureMessage } from "@/pages/api/auth/resend";
import { createSignedInUser, deleteUser, findUserIdByEmail, PASSWORD, type TestAccount } from "./helpers/supabase";
import { buildContext, type CookieJar, createCookieJar } from "./helpers/astro";
import { t } from "@/i18n";

/**
 * Risk #4 — built leg of onboarding (test-plan §2): the signup/signin API route
 * contracts. These routes are redirect-only (never JSON), do NO server-side
 * validation, and surface the raw Supabase error message via `?error=`. We pin
 * the redirect targets, the error branches, and the no-validation behavior
 * against a real local Supabase. The unconfigured-env branch lives in
 * `tests/auth-env-missing.test.ts` (file-scoped env mock).
 *
 * Requires the local Supabase stack + `.env.test`.
 */

/** Re-read the session a route minted into the jar — a durable check (L-002). */
async function userFromJar(jar: CookieJar): Promise<{ id: string } | null> {
  const headers = new Headers();
  const cookieHeader = jar.toCookieHeader();
  if (cookieHeader) headers.set("Cookie", cookieHeader);
  const supabase = createAppClient(headers, jar as unknown as AstroCookies);
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

describe("Risk #4 — auth route contracts (real Supabase)", () => {
  let account: TestAccount;
  const createdIds: string[] = [];

  beforeAll(async () => {
    account = await createSignedInUser("routes");
  });

  afterAll(async () => {
    if (account.id) await deleteUser(account.id);
    for (const id of createdIds) await deleteUser(id);
  });

  it("signin success redirects to /app and establishes a durable session", async () => {
    const jar = createCookieJar();
    const context = buildContext({
      url: "https://test.local/api/auth/signin",
      method: "POST",
      formData: { email: account.email, password: PASSWORD },
      cookies: jar,
    });

    const response = await signinPOST(context);

    expect(response.headers.get("Location")).toBe("/app");
    // L-002: prove the session is durable (re-read), not just the redirect.
    expect((await userFromJar(jar))?.id).toBe(account.id);
  });

  it("signin with bad credentials redirects to /auth/signin?error=", async () => {
    const context = buildContext({
      url: "https://test.local/api/auth/signin",
      method: "POST",
      formData: { email: `nobody-${randomUUID()}@example.test`, password: "wrong-password" },
    });

    const response = await signinPOST(context);

    expect(response.headers.get("Location")).toMatch(/^\/auth\/signin\?error=/);
  });

  it("signup success redirects to the confirm-email interstitial (carrying the email)", async () => {
    const email = `signup-${randomUUID()}@example.test`;
    const context = buildContext({
      url: "https://test.local/api/auth/signup",
      method: "POST",
      formData: { email, password: PASSWORD },
    });

    const response = await signupPOST(context);

    // The interstitial carries the email so its resend control knows the address.
    expect(response.headers.get("Location")).toBe(`/auth/confirm-email?email=${encodeURIComponent(email)}`);
    // Capture the id now (the route returns only a redirect) for deterministic teardown.
    const id = await findUserIdByEmail(email);
    if (id) createdIds.push(id);
  });

  it("signup error (weak password) redirects to /auth/signup?error=", async () => {
    // Depends on GoTrue's minimum_password_length (supabase/config.toml, default 6).
    // If that minimum is lowered below 4, "123" would be accepted and this test
    // would (correctly) fail — adjust the password to stay below the configured min.
    const email = `weak-${randomUUID()}@example.test`;
    const context = buildContext({
      url: "https://test.local/api/auth/signup",
      method: "POST",
      formData: { email, password: "123" }, // below Supabase's 6-char minimum
    });

    const response = await signupPOST(context);

    expect(response.headers.get("Location")).toMatch(/^\/auth\/signup\?error=/);
  });

  it("no server-side validation: empty fields produce an error redirect, not a crash", async () => {
    // The route does `form.get(...) as string` with no zod; empty values reach
    // Supabase and come back as an error redirect (no 500, no throw).
    const context = buildContext({
      url: "https://test.local/api/auth/signin",
      method: "POST",
      formData: { email: "", password: "" },
    });

    const response = await signinPOST(context);

    expect(response.headers.get("Location")).toMatch(/^\/auth\/signin\?error=/);
  });

  it("maps the Supabase error to a Polish message (no English leak — FR-013)", async () => {
    // The route boundary maps error.code -> Polish (src/lib/auth-errors.ts), so
    // the raw English Supabase message never reaches ?error=. Single coarse
    // assertion (test-plan §7 forbids per-phrase tests).
    const context = buildContext({
      url: "https://test.local/api/auth/signin",
      method: "POST",
      formData: { email: `nobody-${randomUUID()}@example.test`, password: "wrong-password" },
    });

    const response = await signinPOST(context);
    const location = response.headers.get("Location") ?? "";
    const error = decodeURIComponent(new URL(location, "https://test.local").searchParams.get("error") ?? "");

    expect(error).toBe(t.auth.serverError.invalidCredentials); // Polish, mapped from error.code
  });
});

describe("resend route — failure copy (production-email-delivery)", () => {
  // The rate-limit path can't be triggered deterministically at route level in
  // the local stack: enable_confirmations = false means signup never sends a
  // confirmation email, so GoTrue's send throttles never engage. The route-level
  // test pins the generic branch; the selector is unit-tested for the rate-limit
  // signal set (same codes/status as src/lib/auth-errors.ts).
  it("missing email redirects back with the generic Polish resend error", async () => {
    const context = buildContext({
      url: "https://test.local/api/auth/resend",
      method: "POST",
      formData: { email: "" },
    });

    const response = await resendPOST(context);
    const location = response.headers.get("Location") ?? "";
    const error = decodeURIComponent(new URL(location, "https://test.local").searchParams.get("error") ?? "");

    expect(location).toMatch(/^\/auth\/confirm-email\?email=/);
    expect(error).toBe(t.confirmEmail.checkEmail.resendError);
  });

  it("maps rate-limit signals to the 'too many attempts' copy, everything else to the generic one", () => {
    expect(resendFailureMessage({ code: "over_email_send_rate_limit", status: 429 })).toBe(
      t.auth.serverError.rateLimited,
    );
    expect(resendFailureMessage({ code: "over_request_rate_limit", status: 429 })).toBe(t.auth.serverError.rateLimited);
    expect(resendFailureMessage({ code: undefined, status: 429 })).toBe(t.auth.serverError.rateLimited);
    expect(resendFailureMessage({ code: "user_already_exists", status: 400 })).toBe(
      t.confirmEmail.checkEmail.resendError,
    );
    expect(resendFailureMessage({ code: undefined, status: 500 })).toBe(t.confirmEmail.checkEmail.resendError);
  });
});
