import type { APIRoute } from "astro";
import { z } from "zod";
import { clearAuthCookies, createClient } from "@/lib/supabase";
import { createAdminClient } from "@/lib/supabase-admin";
import { applyNoStore } from "@/lib/http";
import { PARENT_VERIFIED_COOKIE, verifyMarker, verifyPin } from "@/lib/services/parent-pin";
import { ACTIVE_PROFILE_COOKIE } from "@/lib/services/active-profile";

export const prerender = false;

// PIN (4–6 digits) + the account e-mail retyped in the dialog. The e-mail is
// defense-in-depth against a mis-targeted request — the real gates are the
// marker and the fresh PIN. No account id is ever accepted from the client:
// the deletion target is strictly the session's own user (L-002).
const deleteSchema = z.object({ pin: z.string().regex(/^\d{4,6}$/), email: z.string().min(1) });

function json(status: number, body: unknown): Response {
  return applyNoStore(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

// PIN-failure statuses mirror pin/verify.ts so the island can reuse its copy map.
const STATUS_FOR: Record<string, number> = { locked: 429, "no-pin": 400, wrong: 401, error: 500 };

/**
 * POST /api/account/delete — the nuclear option (MAT-17): erase the parent's
 * auth user; every owned row (child_profiles → shift_log, account_settings)
 * plus auth.sessions dies by the F-01 cascades. Hard delete, irreversible —
 * this IS the GDPR right-to-erasure surface.
 *
 * Two privilege planes, strictly ordered: the request-scoped RLS client
 * establishes WHO (session) and re-authenticates (marker + FRESH PIN under the
 * atomic throttle — a possibly-15-min-old marker alone is not enough for the
 * nuclear option); the service-role admin client then performs exactly one
 * operation with the session-derived id. It never reads app tables and never
 * sees request input.
 *
 * Cleanup: the auth user is already gone, so signOut() may fail — best-effort,
 * ignored. Cookies are cleared explicitly (middleware redirects on a dead
 * session but never clears cookies).
 */
export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  const admin = createAdminClient();
  if (!supabase || !admin) return json(503, { ok: false });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json(401, { ok: false });

  const marker = context.cookies.get(PARENT_VERIFIED_COOKIE)?.value;
  if (!verifyMarker(marker, user.id)) return json(403, { ok: false, reason: "forbidden" });

  const form = await context.request.formData();
  const parsed = deleteSchema.safeParse({ pin: form.get("pin"), email: form.get("email") });
  if (!parsed.success) return json(400, { ok: false, reason: "invalid" });

  // Fresh PIN, throttle included — wrong attempts count toward the lockout.
  const pinResult = await verifyPin(supabase, parsed.data.pin);
  if (!pinResult.ok) return json(STATUS_FOR[pinResult.reason] ?? 400, { ok: false, reason: pinResult.reason });

  if (parsed.data.email.trim().toLowerCase() !== (user.email ?? "").toLowerCase()) {
    return json(400, { ok: false, reason: "email-mismatch" });
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return json(500, { ok: false });

  // Best-effort local sign-out; the user no longer exists, so errors are moot.
  try {
    await supabase.auth.signOut();
  } catch {
    // ignored — cookie clearing below is the effective cleanup
  }
  clearAuthCookies(context.request.headers, context.cookies);
  context.cookies.delete(ACTIVE_PROFILE_COOKIE, { path: "/" });
  context.cookies.delete(PARENT_VERIFIED_COOKIE, { path: "/" });

  return json(200, { ok: true });
};
