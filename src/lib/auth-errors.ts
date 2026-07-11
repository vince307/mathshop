import type { AuthError } from "@supabase/supabase-js";
import { t } from "@/i18n";

/**
 * Map a Supabase `AuthError` to a Polish, user-facing message (FR-013).
 *
 * Switches on the stable `error.code` (never the English `error.message`, which
 * would leak English into the `?error=` URL and is Supabase-version-coupled),
 * with an HTTP-status fallback, and a generic Polish default for anything
 * unmapped. The mapped string is what the auth routes put in `?error=`, so no
 * English ever reaches the URL or the client. Polish strings live in the i18n
 * dictionary (`t.auth.serverError.*`) — this module is just the code → message
 * switch, keeping "new locale = content only".
 */
const messageByCode: Record<string, string> = {
  invalid_credentials: t.auth.serverError.invalidCredentials,
  email_not_confirmed: t.auth.serverError.emailNotConfirmed,
  user_already_exists: t.auth.serverError.userAlreadyRegistered,
  email_exists: t.auth.serverError.userAlreadyRegistered,
  weak_password: t.auth.serverError.weakPassword,
  over_request_rate_limit: t.auth.serverError.rateLimited,
  over_email_send_rate_limit: t.auth.serverError.rateLimited,
  // Email-verification (token_hash + verifyOtp) failures — expired or already-used link.
  otp_expired: t.auth.serverError.linkInvalid,
  otp_disabled: t.auth.serverError.linkInvalid,
};

export function mapAuthError(error: AuthError): string {
  if (error.code && messageByCode[error.code]) {
    return messageByCode[error.code];
  }
  if (error.status === 429) {
    return t.auth.serverError.rateLimited;
  }
  return t.auth.serverError.default;
}

/**
 * Failure copy for the resend-confirmation route's interstitial. Rate-limit
 * signals (same set as `messageByCode` + the 429 fallback above) get the honest
 * "too many attempts" message — real in production under the 30/hr custom-SMTP
 * cap and `max_frequency` — everything else keeps the interstitial's generic
 * message. Deliberately NOT `mapAuthError`: its other mappings are
 * signin-flavored and wrong for that context.
 */
export function resendFailureMessage(error: Pick<AuthError, "code" | "status">): string {
  const rateLimited =
    error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit" || error.status === 429;
  return rateLimited ? t.auth.serverError.rateLimited : t.confirmEmail.checkEmail.resendError;
}
