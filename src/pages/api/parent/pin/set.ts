import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { applyNoStore } from "@/lib/http";
import { PARENT_VERIFIED_COOKIE, hasPin, setParentVerified, setPin, verifyMarker } from "@/lib/services/parent-pin";

export const prerender = false;

// Only the PIN is accepted (4–6 digits); account_id comes from the session (L-002).
const setSchema = z.object({ pin: z.string().regex(/^\d{4,6}$/) });

function json(status: number, body: unknown): Response {
  return applyNoStore(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

// POST /api/parent/pin/set — set (first time) or reset the parent PIN, then mark
// this session parent-verified so a first-time set flows straight into the report.
// RESET GUARD: setting the FIRST PIN is open, but overwriting an EXISTING one
// requires a valid parent_verified marker — otherwise a child on the parent's
// logged-in device could POST here to silently reset the PIN and mint a marker,
// defeating the gate. Enforced server-side (not just in parent-pin.astro's mode).
export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return json(503, { ok: false });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json(401, { ok: false });

  if (await hasPin(supabase)) {
    const marker = context.cookies.get(PARENT_VERIFIED_COOKIE)?.value;
    if (!verifyMarker(marker, user.id)) return json(403, { ok: false, reason: "forbidden" });
  }

  const form = await context.request.formData();
  const parsed = setSchema.safeParse({ pin: form.get("pin") });
  if (!parsed.success) return json(400, { ok: false, reason: "invalid" });

  const ok = await setPin(supabase, parsed.data.pin);
  if (!ok) return json(500, { ok: false });

  setParentVerified(context.cookies, user.id);
  return json(200, { ok: true });
};
