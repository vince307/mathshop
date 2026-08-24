import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { mapAuthError } from "@/lib/auth-errors";
import { applyNoStore } from "@/lib/http";
import { setRememberChoice } from "@/lib/services/remember-me";
import { t } from "@/i18n";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return applyNoStore(context.redirect(`/auth/signin?error=${encodeURIComponent(t.auth.serverError.notConfigured)}`));
  }
  // ORDERING IS LOAD-BEARING: the marker must be written *before*
  // `signInWithPassword`, because that call is what triggers `setAll`, and
  // `setAll` reads the marker back through `cookies.get()`. Written afterwards,
  // the first sign-in gets the wrong lifetime and then self-heals on the next
  // refresh — a bug no sign-in-only test can see. It also sits *after* the
  // `!supabase` guard so the env-missing redirect leaves no stray marker.
  //
  // `form.has` (not a value comparison): HTML omits unchecked checkboxes
  // entirely, so presence is the signal and nothing drifts if the control's
  // `value` ever changes.
  setRememberChoice(context.cookies, form.has("remember"));

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return applyNoStore(context.redirect(`/auth/signin?error=${encodeURIComponent(mapAuthError(error))}`));
  }

  return applyNoStore(context.redirect("/app"));
};
