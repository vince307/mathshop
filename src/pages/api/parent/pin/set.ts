import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { applyNoStore } from "@/lib/http";
import { setParentVerified, setPin } from "@/lib/services/parent-pin";

export const prerender = false;

// Only the PIN is accepted (4–6 digits); account_id comes from the session (L-002).
const setSchema = z.object({ pin: z.string().regex(/^\d{4,6}$/) });

function json(status: number, body: unknown): Response {
  return applyNoStore(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

// POST /api/parent/pin/set — set (or reset) the parent PIN, then mark this session
// parent-verified so a first-time set flows straight into the report.
export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return json(503, { ok: false });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json(401, { ok: false });

  const form = await context.request.formData();
  const parsed = setSchema.safeParse({ pin: form.get("pin") });
  if (!parsed.success) return json(400, { ok: false, reason: "invalid" });

  const ok = await setPin(supabase, parsed.data.pin);
  if (!ok) return json(500, { ok: false });

  setParentVerified(context.cookies, user.id);
  return json(200, { ok: true });
};
