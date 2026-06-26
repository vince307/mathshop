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
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return applyNoStore(context.redirect(`/auth/signup?error=${encodeURIComponent(mapAuthError(error))}`));
  }

  return applyNoStore(context.redirect("/auth/confirm-email"));
};
