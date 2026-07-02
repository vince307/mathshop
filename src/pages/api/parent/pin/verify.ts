import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { applyNoStore } from "@/lib/http";
import { setParentVerified, verifyPin } from "@/lib/services/parent-pin";

export const prerender = false;

// Only the PIN is accepted (4–6 digits); account_id comes from the session (L-002).
const verifySchema = z.object({ pin: z.string().regex(/^\d{4,6}$/) });

function json(status: number, body: unknown): Response {
  return applyNoStore(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

// Map a verify failure to an HTTP status (the island reads `reason` for copy).
const STATUS_FOR: Record<string, number> = { locked: 429, "no-pin": 400, wrong: 401, error: 500 };

// POST /api/parent/pin/verify — check the PIN under the throttle; on success set
// the short-lived signed parent_verified marker.
export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return json(503, { ok: false });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json(401, { ok: false });

  const form = await context.request.formData();
  const parsed = verifySchema.safeParse({ pin: form.get("pin") });
  if (!parsed.success) return json(400, { ok: false, reason: "invalid" });

  const result = await verifyPin(supabase, parsed.data.pin);
  if (!result.ok) return json(STATUS_FOR[result.reason] ?? 400, { ok: false, reason: result.reason });

  setParentVerified(context.cookies, user.id);
  return json(200, { ok: true });
};
