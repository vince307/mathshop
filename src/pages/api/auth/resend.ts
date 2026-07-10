import type { APIRoute } from "astro";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { applyNoStore } from "@/lib/http";
import { t } from "@/i18n";

export const prerender = false;

/**
 * Pick the interstitial's Polish failure copy. Rate-limit signals (same set as
 * src/lib/auth-errors.ts) get the honest "too many attempts" message — real in
 * production under the 30/hr custom-SMTP cap and `max_frequency` — everything
 * else keeps the generic one. Deliberately NOT full `mapAuthError`: its other
 * mappings are signin-flavored and wrong for this context.
 */
export function resendFailureMessage(error: Pick<AuthError, "code" | "status">): string {
  const rateLimited =
    error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit" || error.status === 429;
  return rateLimited ? t.auth.serverError.rateLimited : t.confirmEmail.checkEmail.resendError;
}

/**
 * Resend the signup confirmation email. Driven by the plain form on the
 * confirm-email interstitial (redirect-only, like the sibling auth routes), so
 * it re-renders the same page with a Polish "sent again" notice (or an error).
 * Establishes no session itself — only the confirm route does. `emailRedirectTo`
 * mirrors signup so the resent link lands on the same post-confirm target.
 */
export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const emailRaw = form.get("email");
  const email = typeof emailRaw === "string" ? emailRaw : "";
  const back = `/auth/confirm-email?email=${encodeURIComponent(email)}`;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase || !email) {
    return applyNoStore(context.redirect(`${back}&error=${encodeURIComponent(t.confirmEmail.checkEmail.resendError)}`));
  }

  const origin = new URL(context.request.url).origin;
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origin}/app` },
  });

  if (error) {
    return applyNoStore(context.redirect(`${back}&error=${encodeURIComponent(resendFailureMessage(error))}`));
  }

  return applyNoStore(context.redirect(`${back}&resent=1`));
};
