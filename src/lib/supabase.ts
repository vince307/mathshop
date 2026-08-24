import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { AstroCookies } from "astro";
import { SUPABASE_URL, SUPABASE_KEY } from "astro:env/server";
import { authCookieMaxAge } from "@/lib/services/remember-me";

/**
 * Hardened cookie options for the Supabase auth cookies. `httpOnly` keeps the
 * session token out of `document.cookie` (XSS), `sameSite: "lax"` blocks
 * cross-site send, and `secure` is on in production so the cookie never travels
 * over plain HTTP (kept off in dev/test where there is no TLS). Spread *after*
 * the library's own options so these win.
 *
 * `maxAge` must NEVER be added here: `clearAuthCookies` spreads this object
 * *after* its own `maxAge: 0`, so a lifetime living in here would override the
 * deliberate expiry and turn the env-missing sign-out into a silent no-op.
 * Auth-cookie lifetime is set in `setAll` instead — see the contract surface
 * "Auth cookie lifetime (session-policy surface)".
 */
const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: import.meta.env.PROD,
};

/** Supabase auth cookies are named `sb-<project-ref>-auth-token`, optionally chunked (`.0`, `.1`). */
export const AUTH_COOKIE_RE = /^sb-.+-auth-token(\.\d+)?$/;

export function createClient(requestHeaders: Headers, cookies: AstroCookies) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return null;
  }
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return parseCookieHeader(requestHeaders.get("Cookie") ?? "").map(({ name, value }) => ({
          name,
          value: value ?? "",
        }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          // Removals (sign-out, chunk cleanup) arrive here as value:"" + maxAge:0,
          // built by the library's `removeCookieOptions`. Overriding their lifetime
          // would blank the cookie instead of expiring it — the browser would keep
          // an empty-valued cookie for the whole session and sign-out would look
          // like it worked. Let removals through exactly as the caller built them.
          const isRemoval = options.maxAge === 0;
          // Writes: the library hard-codes 400 days nobody chose. Last spread wins,
          // and an explicit `undefined` REMOVES the attribute (a spread cannot
          // delete a key, so "just don't set maxAge" would do nothing here).
          cookies.set(name, value, {
            ...options,
            ...AUTH_COOKIE_OPTIONS,
            ...(isRemoval ? {} : { maxAge: authCookieMaxAge(cookies) }),
          });
        });
      },
    },
  });
}

/**
 * Clear any Supabase auth cookies present on the request, even when no client
 * could be built (env missing). Sign-out must never be a silent no-op: without
 * this, the unconfigured path would redirect while the stale session cookie
 * survived. Mirrors how `signOut()` clears cookies (empty value, expired).
 */
export function clearAuthCookies(requestHeaders: Headers, cookies: AstroCookies) {
  for (const { name } of parseCookieHeader(requestHeaders.get("Cookie") ?? "")) {
    if (AUTH_COOKIE_RE.test(name)) {
      cookies.set(name, "", { path: "/", maxAge: 0, ...AUTH_COOKIE_OPTIONS });
    }
  }
}
