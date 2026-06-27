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
