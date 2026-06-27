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
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/app` },
  });

  if (error) {
    return applyNoStore(context.redirect(`/auth/signup?error=${encodeURIComponent(mapAuthError(error))}`));
  }

  // Carry the email to the interstitial so its resend control knows where to send.
  return applyNoStore(context.redirect(`/auth/confirm-email?email=${encodeURIComponent(email)}`));
};
