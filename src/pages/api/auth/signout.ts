import type { APIRoute } from "astro";
import { createClient, clearAuthCookies } from "@/lib/supabase";
import { applyNoStore } from "@/lib/http";
import { ACTIVE_PROFILE_COOKIE } from "@/lib/services/active-profile";
import { PARENT_VERIFIED_COOKIE } from "@/lib/services/parent-pin";
import { REMEMBER_ME_COOKIE } from "@/lib/services/remember-me";

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
  // Per-session state — clear it so the next account on this browser starts
  // fresh: the profile pointer (S-11; harmless under RLS but explicit) and the
  // parent-verified PIN marker (S-10; signing out must revoke verification, or
  // the same account re-signing-in within the 15-min TTL skips the PIN gate);
  // and the remember-me marker, so the next parent on this browser does not
  // inherit the previous one's persistence choice.
  context.cookies.delete(ACTIVE_PROFILE_COOKIE, { path: "/" });
  context.cookies.delete(PARENT_VERIFIED_COOKIE, { path: "/" });
  context.cookies.delete(REMEMBER_ME_COOKIE, { path: "/" });
  return applyNoStore(context.redirect("/"));
};
