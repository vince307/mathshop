import type { APIRoute } from "astro";
import { createClient, clearAuthCookies } from "@/lib/supabase";
import { applyNoStore } from "@/lib/http";
import { ACTIVE_PROFILE_COOKIE } from "@/lib/services/active-profile";

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
  // The profile selection is per-session state — clear it so the next account
  // on this browser starts fresh (a stale pointer is harmless under RLS, but
  // "fresh account, fresh state" should be explicit; S-11).
  context.cookies.delete(ACTIVE_PROFILE_COOKIE, { path: "/" });
  return applyNoStore(context.redirect("/"));
};
