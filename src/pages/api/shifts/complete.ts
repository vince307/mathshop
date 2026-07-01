import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { applyNoStore } from "@/lib/http";
import { recordShiftResult } from "@/lib/services/child-profiles";

export const prerender = false;

// account_id is NOT accepted from the client — ownership is enforced by RLS on
// the profile row reached by `id` (L-002). Wallet earnings are recomputed
// server-side from the reported accuracy (the client never sends an amount), so a
// tampered client cannot inflate the wallet. taskCount caps at 12 (max shift
// length is 10, with margin); cleanCount cannot exceed taskCount.
const completeSchema = z
  .object({
    profileId: z.uuid(),
    taskCount: z.coerce.number().int().min(1).max(12),
    cleanCount: z.coerce.number().int().min(0).max(12),
  })
  .refine((v) => v.cleanCount <= v.taskCount);

/** JSON response with anti-CDN-cache headers (the call rides the authed session). */
function json(status: number, body: unknown): Response {
  return applyNoStore(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

// Unlike the form-POST→redirect routes, this is fetched from the still-mounted
// ShiftScreen island (results are an in-island phase), so it returns JSON.
export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return json(503, { ok: false });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json(401, { ok: false });

  const form = await context.request.formData();
  const parsed = completeSchema.safeParse({
    profileId: form.get("profileId"),
    taskCount: form.get("taskCount"),
    cleanCount: form.get("cleanCount"),
  });
  if (!parsed.success) return json(400, { ok: false });

  const result = await recordShiftResult(supabase, parsed.data.profileId, {
    taskCount: parsed.data.taskCount,
    cleanCount: parsed.data.cleanCount,
  });
  if ("error" in result) return json(500, { ok: false });

  return json(200, {
    ok: true,
    earned: result.earned,
    businessLevel: result.businessLevel,
    leveledUp: result.leveledUp,
  });
};
