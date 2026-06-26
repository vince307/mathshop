import type { APIRoute } from "astro";
import { createClient, clearAuthCookies } from "@/lib/supabase";
import { applyNoStore } from "@/lib/http";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (supabase) {
    await supabase.auth.signOut();
  } else {
    // Env missing → no client to call signOut(). Clear the auth cookies directly
    // so sign-out is never a silent no-op (stale-session surface).
    clearAuthCookies(context.request.headers, context.cookies);
  }
  return applyNoStore(context.redirect("/"));
};
