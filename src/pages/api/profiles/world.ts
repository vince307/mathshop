import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { applyNoStore } from "@/lib/http";
import { WORLD_SLUGS } from "@/data/worlds";
import { resolveActiveProfile } from "@/lib/services/active-profile";
import { updateChildProfileTheme } from "@/lib/services/child-profiles";

export const prerender = false;

/** Where ownership/validation failures land — back on the picker, no error leak. */
const WORLDS = "/app/worlds";

// Closed-set membership via refine, not `z.enum`: `WORLD_SLUGS` is typed
// `[string, ...string[]]` (widened by `WORLDS: readonly World[]`), so `z.enum`
// would preserve no literal narrowing here — same rationale as `create.ts:29`.
// There is NO DB CHECK on `child_profiles.theme` and `worldForTheme` is total,
// so this refine is the only thing standing between a client string and the
// column; an unknown slug would render silently as the fallback world, not fail.
const worldSchema = z.object({
  profileId: z.uuid(),
  theme: z.string().refine((v) => (WORLD_SLUGS as readonly string[]).includes(v)),
});

/**
 * Change the active world of one of the parent's own child profiles (F5). The
 * form target for `/app/worlds`; mirrors `select.ts` end to end — a form POST
 * followed by a full page navigation, not a JSON island call.
 *
 * Ownership is proven TWICE and never rests on client input: `resolveActiveProfile`
 * re-resolves the id through the caller's RLS-scoped client (a foreign id reads
 * zero rows and bounces), and `child_profiles_update_own` would independently
 * match zero rows even if that gate were removed. Every failure redirects back to
 * `/app/worlds` with NO error param, so the route is not an existence oracle.
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
  const parsed = worldSchema.safeParse({ profileId: form.get("profileId"), theme: form.get("theme") });
  if (!parsed.success) {
    return applyNoStore(context.redirect(WORLDS));
  }

  const profile = await resolveActiveProfile(supabase, parsed.data.profileId);
  if (!profile) {
    return applyNoStore(context.redirect(WORLDS));
  }

  const result = await updateChildProfileTheme(supabase, profile.id, parsed.data.theme);
  if ("error" in result) {
    // A database failure and a routine ownership bounce produced the SAME silent
    // redirect, so a real outage left no trace anywhere. `updateChildProfileTheme`
    // returns `{ error } | { failure: "not-found" } | { ok: true }`, so this
    // discriminates exactly. The response is unchanged on purpose (KR-1): the
    // route must not become an existence oracle, so the signal lives in the log.
    // Operation-scoped context only — `profileId` identifies a child row and the
    // theme is the caller's input; neither belongs in an operator log.
    // eslint-disable-next-line no-console
    console.error("[profiles/world] updateChildProfileTheme failed", {
      code: result.error.code,
      message: result.error.message,
    });
    return applyNoStore(context.redirect(WORLDS));
  }
  if (!("ok" in result)) {
    return applyNoStore(context.redirect(WORLDS));
  }

  // The active-profile cookie is deliberately NOT touched: this changes a
  // profile's world, not which profile is active. `/app/start` shows it at once.
  return applyNoStore(context.redirect("/app/start"));
};
