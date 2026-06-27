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

/** True if the string contains any ASCII control char (0x00–0x1F) — some user
 * agents strip these before parsing a URL, which can resurrect an off-site target. */
function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) < 0x20) return true;
  }
  return false;
}

/**
 * Validate the post-confirm redirect target as a same-origin path.
 *
 * Accept only a single leading "/". Reject "//" and "/\" — browsers normalize
 * "\"→"/", so both are protocol-relative and resolve off-site — and reject any
 * control char. Anything else falls back to "/app". Keeps a crafted confirm link
 * from bouncing the freshly-confirmed session to an attacker origin.
 */
function safeNext(next: string | null): string {
  if (next && next.startsWith("/") && !/^\/[/\\]/.test(next) && !hasControlChars(next)) {
    return next;
  }
  return "/app";
}

/**
 * Email-verification confirm route. The confirmation email links here with a
 * `token_hash` + `type` (the `verifyOtp` server-confirm pattern, not PKCE
 * `?code=`). On success `verifyOtp` writes the session cookie via the hardened
 * `setAll`, and we land the parent on `next`. The single source of the redirect
 * target is the `next` query param (populated from `{{ .RedirectTo }}` =
 * signup's `emailRedirectTo`).
 */
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
