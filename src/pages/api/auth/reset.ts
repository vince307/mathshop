import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { applyNoStore } from "@/lib/http";
import { resendFailureMessage } from "@/lib/auth-errors";
import { t } from "@/i18n";

export const prerender = false;

/**
 * Request a password-reset link. Redirect-only, like its sibling auth routes.
 *
 * Deliberately blind to whether the address has an account: Supabase's
 * `resetPasswordForEmail` succeeds either way, and branching on that here would
 * turn this form into an oracle for which parents are registered. The page's
 * copy carries the conditional wording instead ("Jeśli konto z tym adresem
 * istnieje…"), so both cases render identically.
 *
 * `redirectTo` is deliberately NOT passed: the emailed link hardcodes
 * `next=/auth/update-password` as a path, because the confirm route's `safeNext`
 * accepts only same-origin paths and silently falls back to /app for the
 * absolute URL that `{{ .RedirectTo }}` renders (see recovery.html).
 */
export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const emailRaw = form.get("email");
  const email = typeof emailRaw === "string" ? emailRaw.trim() : "";
  const back = "/auth/reset-password";

  if (!email) {
    return applyNoStore(context.redirect(`${back}?error=${encodeURIComponent(t.auth.validation.emailRequired)}`));
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return applyNoStore(context.redirect(`${back}?error=${encodeURIComponent(t.auth.serverError.notConfigured)}`));
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email);

  // Only transport/throttle failures surface — never "no such account". The
  // rate-limit branch reuses the resend mapper so a throttled parent sees the
  // established Polish "Zbyt wiele prób…" message.
  if (error) {
    return applyNoStore(context.redirect(`${back}?error=${encodeURIComponent(resendFailureMessage(error))}`));
  }

  return applyNoStore(context.redirect(`${back}?sent=1`));
};
