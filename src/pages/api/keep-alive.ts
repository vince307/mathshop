import type { APIRoute } from "astro";
import { SUPABASE_URL, SUPABASE_KEY, CRON_SECRET } from "astro:env/server";

export const prerender = false;

/**
 * Supabase keep-alive ping, invoked by the daily Vercel cron (vercel.json).
 *
 * The free-tier Supabase project auto-pauses after ~a week without API
 * activity, which takes production down AND breaks every Vercel deploy
 * ("Resource provisioning failed" — seen 2026-08-09). A Vercel-side ping is
 * not enough: the request must reach Supabase itself, so this route runs a
 * real PostgREST query (RLS returns no rows to the anon key — the point is
 * the roundtrip, not the data).
 *
 * Auth: Vercel sends `Authorization: Bearer <CRON_SECRET>` on cron
 * invocations. No secret configured, or a mismatch → 401 (fails closed).
 */
export const GET: APIRoute = async ({ request }) => {
  const json = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  const authHeader = request.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return json(401, { ok: false });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return json(503, { ok: false, error: "supabase env missing" });
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/child_profiles?select=id&limit=1`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    // Any HTTP response proves Supabase answered — activity registered. A
    // non-2xx status is still surfaced so the cron log shows contract drift
    // (e.g. a renamed table) instead of hiding it behind a green 200.
    return json(res.ok ? 200 : 502, { ok: res.ok, supabaseStatus: res.status });
  } catch (err) {
    return json(502, { ok: false, error: err instanceof Error ? err.message : "fetch failed" });
  }
};
