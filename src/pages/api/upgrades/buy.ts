import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { applyNoStore } from "@/lib/http";
import { buyUpgrade } from "@/lib/services/child-profiles";
import { UPGRADE_IDS } from "@/data/upgrades";

export const prerender = false;

// Nothing trust-bearing is accepted from the client: no cost, no account_id.
// Ownership is enforced by RLS on the row reached by `id` (L-002), and cost /
// affordability / level / ownership are all recomputed server-side from the
// trusted row in `buyUpgrade`. `upgradeId` is constrained to the closed catalog
// set so a value outside it is rejected before any DB round-trip.
const buySchema = z.object({
  profileId: z.uuid(),
  upgradeId: z.enum(UPGRADE_IDS),
});

/** JSON response with anti-CDN-cache headers (the call rides the authed session). */
function json(status: number, body: unknown): Response {
  return applyNoStore(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

// Fetched from the still-mounted UpgradeShop island (buy is an in-island action),
// so it returns JSON rather than redirecting like the form-POST auth routes.
export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return json(503, { ok: false });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json(401, { ok: false });

  const form = await context.request.formData();
  const parsed = buySchema.safeParse({
    profileId: form.get("profileId"),
    upgradeId: form.get("upgradeId"),
  });
  if (!parsed.success) return json(400, { ok: false });

  const result = await buyUpgrade(supabase, parsed.data.profileId, parsed.data.upgradeId);
  if ("error" in result) return json(500, { ok: false });
  if ("failure" in result) {
    // not-found = the row isn't readable/owned (RLS) → 404; the rest are invalid
    // buys (owned / locked / insufficient / unknown) → 400 with the reason.
    return json(result.failure === "not-found" ? 404 : 400, { ok: false, reason: result.failure });
  }

  return json(200, { ok: true, walletBalance: result.walletBalance, purchased: result.purchased });
};
