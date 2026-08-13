import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { applyNoStore } from "@/lib/http";
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
 *
 * EVERY `resetPasswordForEmail` failure is masked as the sent notice, because
 * every one of them is address-correlated and would rebuild the oracle this
 * route exists to avoid:
 *   - transport/SMTP failures fire only when a send is ATTEMPTED, i.e. only for
 *     a registered address — an unknown one short-circuits and "succeeds". A
 *     dead mailer therefore split the two cases apart, which is exactly what
 *     happened in production on 2026-08-13 when a config push blanked SMTP.
 *   - `max_frequency` (1m in production) throttles per ADDRESS, so a repeated
 *     request returns 429 for a registered parent and success for a stranger.
 * The failure is logged server-side instead, where it belongs: a mail outage is
 * an operator problem, and telling the parent about it is what leaks.
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

  // Deliberately NOT surfaced to the parent — see the enumeration note above.
  // Logged with the stable code/status only; the address stays out of the log.
  if (error) {
    // Same deliberate exception as the signup route's enumeration branch: masking
    // the failure is what protects the parent, but it also makes a mail outage
    // invisible from the outside, so the operator signal has to live in the log.
    // eslint-disable-next-line no-console
    console.error("[auth/reset] resetPasswordForEmail failed", {
      code: error.code,
      status: error.status,
    });
  }

  return applyNoStore(context.redirect(`${back}?sent=1`));
};
