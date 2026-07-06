import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { applyNoStore } from "@/lib/http";
import { resolveActiveProfile, setActiveProfileCookie } from "@/lib/services/active-profile";

export const prerender = false;

/** Where ownership/validation failures land — back on the picker, no error leak. */
const PICKER = "/app/pick-profile";

const selectSchema = z.object({
  profileId: z.uuid(),
});

/**
 * Set the active-profile selection (S-11). Ownership is proven by resolving the
 * id through the caller's RLS-scoped client — a foreign or stale id reads no row
 * and bounces back to the picker without revealing whether it exists (L-002
 * spirit: the durable decision comes from the session, never client input).
 */
export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return applyNoStore(context.redirect("/auth/signin"));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return applyNoStore(context.redirect("/auth/signin"));
  }

  const form = await context.request.formData();
  const parsed = selectSchema.safeParse({ profileId: form.get("profileId") });
  if (!parsed.success) {
    return applyNoStore(context.redirect(PICKER));
  }

  const profile = await resolveActiveProfile(supabase, parsed.data.profileId);
  if (!profile) {
    return applyNoStore(context.redirect(PICKER));
  }

  setActiveProfileCookie(context.cookies, profile.id);
  return applyNoStore(context.redirect("/app/start"));
};
