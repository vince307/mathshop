import type { SupabaseClient } from "@supabase/supabase-js";
import type { AstroCookies } from "astro";
import { listChildProfiles, type ChildProfile } from "@/lib/services/child-profiles";

/**
 * Active-profile selection (S-11, FR-002). The cookie stores ONLY a profile id —
 * a pointer, not a credential: every consumer re-resolves it through the caller's
 * RLS-scoped client, so a forged/stale/foreign id yields zero rows → fallback,
 * never another account's child. Session-lifetime (no maxAge), so each fresh
 * browser session lands 2+ accounts back on the picker ("picker on launch").
 */

export const ACTIVE_PROFILE_COOKIE = "active_profile";

/** Cheap shape guard so a garbage cookie never even reaches the DB. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve a selected profile id (from the cookie) against the parent's own
 * profiles. Missing, malformed, stale, or foreign ids all resolve to null —
 * the callers' fallback ladder takes over (1 profile → it; else the /app router).
 */
export async function resolveActiveProfile(
  client: SupabaseClient,
  profileId: string | null | undefined,
): Promise<ChildProfile | null> {
  if (!profileId || !UUID_RE.test(profileId)) return null;
  const { data } = await client.from("child_profiles").select("*").eq("id", profileId).limit(1);
  return (data?.[0] as ChildProfile | undefined) ?? null;
}

/** Set the session-lifetime selection cookie (see module doc for semantics). */
export function setActiveProfileCookie(cookies: AstroCookies, profileId: string): void {
  cookies.set(ACTIVE_PROFILE_COOKIE, profileId, {
    httpOnly: true,
    sameSite: "lax",
    secure: import.meta.env.PROD,
    path: "/",
    // No maxAge/expires: browser-session lifetime — FR-002's picker-on-launch.
  });
}

/** Read the raw selection id from the request cookies (may be absent). */
export function readActiveProfileId(cookies: AstroCookies): string | null {
  return cookies.get(ACTIVE_PROFILE_COOKIE)?.value ?? null;
}

/**
 * The profile a child page should render, via the fallback ladder: a valid
 * selection wins; else a single-profile account's sole profile (picker skipped,
 * FR-002 — today's behavior, provably unchanged); else null — the caller
 * redirects to `/app`, whose router sends 2+ to the picker and 0 to the wizard.
 * One RLS-scoped list serves both the lookup and the count; the selection is
 * matched INSIDE the owned list, so a foreign id can never resolve.
 */
export async function resolvePageProfile(
  client: SupabaseClient,
  cookies: AstroCookies,
): Promise<{ profile: ChildProfile | null; profileCount: number }> {
  const profiles = await listChildProfiles(client);
  const selectedId = readActiveProfileId(cookies);
  const selected = selectedId ? (profiles.find((profile) => profile.id === selectedId) ?? null) : null;
  const profile = selected ?? (profiles.length === 1 ? profiles[0] : null);
  return { profile, profileCount: profiles.length };
}
