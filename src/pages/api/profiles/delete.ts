import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { applyNoStore } from "@/lib/http";
import { PARENT_VERIFIED_COOKIE, verifyMarker } from "@/lib/services/parent-pin";
import { ACTIVE_PROFILE_COOKIE, readActiveProfileId } from "@/lib/services/active-profile";
import { deleteChildProfile } from "@/lib/services/child-profiles";

export const prerender = false;

// Only the profile id is accepted; ownership is enforced by RLS on the row it
// reaches (L-002) — account_id never comes from the client.
const deleteSchema = z.object({ profileId: z.uuid() });

function json(status: number, body: unknown): Response {
  return applyNoStore(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

/**
 * POST /api/profiles/delete — delete one child profile (MAT-17), parent-zone
 * destructive action. Gate order is the contract: 503 no client → 401 no user →
 * 403 no/invalid parent_verified marker (the PIN-reset lesson: a destructive
 * mutation must never be open to any authed session — a child on the parent's
 * logged-in device is the threat model) → 400 zod → 404 not-found/not-owned
 * (RLS) → 500 → 200. On success the stale `active_profile` cookie is dropped
 * when it pointed at the deleted row; page routing would degrade anyway, but a
 * known-dead pointer shouldn't outlive the row.
 */
export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return json(503, { ok: false });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json(401, { ok: false });

  const marker = context.cookies.get(PARENT_VERIFIED_COOKIE)?.value;
  if (!verifyMarker(marker, user.id)) return json(403, { ok: false, reason: "forbidden" });

  const form = await context.request.formData();
  const parsed = deleteSchema.safeParse({ profileId: form.get("profileId") });
  if (!parsed.success) return json(400, { ok: false, reason: "invalid" });

  const result = await deleteChildProfile(supabase, parsed.data.profileId);
  if ("failure" in result) return json(404, { ok: false, reason: "not-found" });
  if ("error" in result) return json(500, { ok: false });

  if (readActiveProfileId(context.cookies) === parsed.data.profileId) {
    context.cookies.delete(ACTIVE_PROFILE_COOKIE, { path: "/" });
  }

  return json(200, { ok: true });
};
