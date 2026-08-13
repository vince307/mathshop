import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { mapAuthError } from "@/lib/auth-errors";
import { applyNoStore } from "@/lib/http";
import { t } from "@/i18n";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return applyNoStore(context.redirect(`/auth/signup?error=${encodeURIComponent(t.auth.serverError.notConfigured)}`));
  }

  // emailRedirectTo is the single source of the post-confirm target ({{ .RedirectTo }}
  // in the email template). Origin comes from the request, not a hardcoded URL, so
  // it works across local / preview / prod without per-env config.
  const origin = new URL(context.request.url).origin;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/app` },
  });

  if (error) {
    return applyNoStore(context.redirect(`/auth/signup?error=${encodeURIComponent(mapAuthError(error))}`));
  }

  // Signing up an ALREADY-CONFIRMED address is not an error to Supabase: with
  // confirmations on (production) its enumeration protection answers 200 with an
  // obfuscated user — empty `identities` — and sends no email. `user_already_exists`
  // (auth-errors.ts) only ever fires with confirmations OFF, i.e. locally.
  //
  // The redirect below stays the same on purpose: telling the browser the address
  // is taken would turn this form into the existence oracle the protection exists
  // to deny. The interstitial covers the case in copy instead. So the only thing
  // this branch does is stop the path from being invisible in production logs —
  // without the address, since the parent's email is the app's only PII.
  if (data.user?.identities?.length === 0) {
    // The app logs nothing by default (no-console is on), so this is a deliberate
    // exception: the branch is otherwise undetectable in production — 200, no error,
    // no email — which is how it went unnoticed until 2026-08-13.
    // eslint-disable-next-line no-console
    console.warn(
      "[auth/signup] enumeration-protected response: address already registered, no confirmation email sent",
    );
  }

  // Carry the email to the interstitial so its resend control knows where to send.
  return applyNoStore(context.redirect(`/auth/confirm-email?email=${encodeURIComponent(email)}`));
};
