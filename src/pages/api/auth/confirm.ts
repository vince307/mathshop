import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { mapAuthError } from "@/lib/auth-errors";
import { applyNoStore } from "@/lib/http";
import { t } from "@/i18n";

export const prerender = false;

// Whitelist of email-OTP types we accept on the confirm link (a subset of
// `EmailOtpType`). Matching against this both types `type` correctly for
// `verifyOtp` and rejects an arbitrary injected `type` value.
const EMAIL_OTP_TYPES = ["signup", "email", "recovery", "invite", "magiclink", "email_change"] as const;

/**
 * Email-verification confirm route. The confirmation email links here with a
 * `token_hash` + `type` (the `verifyOtp` server-confirm pattern, not PKCE
 * `?code=`). On success `verifyOtp` writes the session cookie via the hardened
 * `setAll`, and we land the parent on `next`. The single source of the redirect
 * target is the `next` query param (populated from `{{ .RedirectTo }}` =
 * signup's `emailRedirectTo`); we still validate it as a same-origin path so a
 * crafted link can't bounce the user off-site.
 */
function safeNext(next: string | null): string {
  // Same-origin absolute path only: leading "/" but not "//" (protocol-relative).
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/app";
}

export const GET: APIRoute = async (context) => {
  const params = context.url.searchParams;
  const token_hash = params.get("token_hash");
  const typeParam = params.get("type");
  const type = EMAIL_OTP_TYPES.find((candidate) => candidate === typeParam);
  const next = safeNext(params.get("next"));

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return applyNoStore(context.redirect(`/auth/signin?error=${encodeURIComponent(t.auth.serverError.notConfigured)}`));
  }

  if (!token_hash || !type) {
    return applyNoStore(context.redirect(`/auth/signin?error=${encodeURIComponent(t.auth.serverError.linkInvalid)}`));
  }

  const { error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error) {
    return applyNoStore(context.redirect(`/auth/signin?error=${encodeURIComponent(mapAuthError(error))}`));
  }

  return applyNoStore(context.redirect(next));
};
