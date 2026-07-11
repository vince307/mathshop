import { describe, expect, it } from "vitest";
import type { AuthError } from "@supabase/supabase-js";
import { mapAuthError, resendFailureMessage } from "@/lib/auth-errors";
import { t } from "@/i18n";

/**
 * The auth error → Polish message mapper (FR-013: no English `error.message`
 * ever reaches the `?error=` URL). Not per-phrase copy tests (§7) — these assert
 * the MAPPING LOGIC: code precedence, the 429 fallback, and the generic default
 * for anything unmapped. `resendFailureMessage` is covered from its route in
 * auth-routes.test.ts; the rate-limit-signal unit check lives there too.
 */

const err = (partial: Partial<AuthError>): AuthError => partial as AuthError;

describe("mapAuthError", () => {
  it("maps known codes to their Polish message (code wins over status)", () => {
    expect(mapAuthError(err({ code: "invalid_credentials" }))).toBe(t.auth.serverError.invalidCredentials);
    expect(mapAuthError(err({ code: "email_not_confirmed" }))).toBe(t.auth.serverError.emailNotConfirmed);
    expect(mapAuthError(err({ code: "user_already_exists" }))).toBe(t.auth.serverError.userAlreadyRegistered);
    expect(mapAuthError(err({ code: "email_exists" }))).toBe(t.auth.serverError.userAlreadyRegistered);
    expect(mapAuthError(err({ code: "weak_password" }))).toBe(t.auth.serverError.weakPassword);
    expect(mapAuthError(err({ code: "over_email_send_rate_limit" }))).toBe(t.auth.serverError.rateLimited);
    expect(mapAuthError(err({ code: "otp_expired" }))).toBe(t.auth.serverError.linkInvalid);
    expect(mapAuthError(err({ code: "otp_disabled" }))).toBe(t.auth.serverError.linkInvalid);
  });

  it("code precedence: a mapped code wins even when status is 429", () => {
    expect(mapAuthError(err({ code: "weak_password", status: 429 }))).toBe(t.auth.serverError.weakPassword);
  });

  it("falls back to rateLimited on HTTP 429 when the code is unmapped/absent", () => {
    expect(mapAuthError(err({ status: 429 }))).toBe(t.auth.serverError.rateLimited);
    expect(mapAuthError(err({ code: "some_unknown_429_code", status: 429 }))).toBe(t.auth.serverError.rateLimited);
  });

  it("returns the generic Polish default for any unmapped, non-429 error (never English)", () => {
    expect(mapAuthError(err({ code: "totally_new_code", status: 500 }))).toBe(t.auth.serverError.default);
    expect(mapAuthError(err({ status: 400 }))).toBe(t.auth.serverError.default);
    expect(mapAuthError(err({}))).toBe(t.auth.serverError.default);
    // No branch leaks the raw English message.
    expect(mapAuthError(err({ message: "Something went wrong in English" }))).toBe(t.auth.serverError.default);
  });
});

describe("resendFailureMessage — rate-limit-only differentiation", () => {
  it("rate-limit signals → the 'too many attempts' copy; everything else → generic resend error", () => {
    expect(resendFailureMessage({ code: "over_email_send_rate_limit", status: 429 })).toBe(
      t.auth.serverError.rateLimited,
    );
    expect(resendFailureMessage({ code: "over_request_rate_limit", status: 400 })).toBe(t.auth.serverError.rateLimited);
    expect(resendFailureMessage({ code: undefined, status: 429 })).toBe(t.auth.serverError.rateLimited);
    expect(resendFailureMessage({ code: "user_already_exists", status: 400 })).toBe(
      t.confirmEmail.checkEmail.resendError,
    );
    expect(resendFailureMessage({ code: undefined, status: 500 })).toBe(t.confirmEmail.checkEmail.resendError);
  });
});
