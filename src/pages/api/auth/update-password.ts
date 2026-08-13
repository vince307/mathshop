import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { mapAuthError } from "@/lib/auth-errors";
import { applyNoStore } from "@/lib/http";
import { RESET_MARKER_COOKIE, clearResetMarker, verifyResetMarker } from "@/lib/services/password-reset";
import { t } from "@/i18n";

export const prerender = false;

const schema = z
  .object({
    password: z.string().min(6),
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm);

/**
 * Set a new password at the end of the recovery flow.
 *
 * Re-checks the marker itself rather than trusting the page that rendered the
 * form — the page check is UX, this one is the gate. A session alone is NOT
 * sufficient: a recovery link mints a full session, so accepting one here would
 * let any stolen cookie take the account over permanently.
 *
 * On success the parent's OTHER devices are signed out (`scope: "others"`), which
 * is what makes a reset meaningful when it was prompted by a suspected
 * compromise. Note the current session must survive — the parent has to reach
 * /app. Then the marker is cleared, so the authorization is single-use.
 */
export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return applyNoStore(context.redirect(`/auth/signin?error=${encodeURIComponent(t.auth.serverError.notConfigured)}`));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return applyNoStore(
      context.redirect(`/auth/signin?error=${encodeURIComponent(t.auth.serverError.sessionExpired)}`),
    );
  }

  // No marker (or a stale/foreign one) → send them back for a fresh link rather
  // than to a form they cannot submit.
  const marker = context.cookies.get(RESET_MARKER_COOKIE)?.value;
  if (!verifyResetMarker(marker, user.id)) {
    return applyNoStore(
      context.redirect(`/auth/reset-password?error=${encodeURIComponent(t.auth.serverError.sessionExpired)}`),
    );
  }

  const form = await context.request.formData();
  const parsed = schema.safeParse({
    password: form.get("password"),
    confirm: form.get("confirm"),
  });
  if (!parsed.success) {
    return applyNoStore(
      context.redirect(`/auth/update-password?error=${encodeURIComponent(t.auth.validation.passwordTooShort)}`),
    );
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return applyNoStore(context.redirect(`/auth/update-password?error=${encodeURIComponent(mapAuthError(error))}`));
  }

  // Revoke every OTHER session; this device stays signed in and continues to /app.
  await supabase.auth.signOut({ scope: "others" });
  clearResetMarker(context.cookies);

  return applyNoStore(context.redirect("/app"));
};
