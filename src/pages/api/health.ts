import type { APIRoute } from "astro";

export const prerender = false;

// Liveness probe for the VPS container: the compose healthcheck and app-deploy (ariom-infra) poll
// http://127.0.0.1:4401/api/health. Deliberately touches nothing else — no Supabase, no env — so a healthy
// process answers 200 even when the hosted database is paused or the env file is incomplete.
export const GET: APIRoute = () =>
  new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
