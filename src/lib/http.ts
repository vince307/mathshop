/**
 * Anti-CDN-cache headers for any response that sets or clears auth cookies.
 *
 * On Vercel's CDN a cached auth-cookie response could serve one user's session
 * to another (a silent cross-account leak). Every response that touches the auth
 * cookies — auth/confirm routes and gated/auth middleware paths — is marked
 * non-cacheable so the CDN never stores it. These headers live at the response
 * level, not in the `@supabase/ssr` `setAll` callback: that callback only
 * receives the cookie jar and runs during `getUser()`/`verifyOtp()` before a
 * Response exists, so the library's `headers` argument cannot be applied there.
 */
export const NO_STORE_HEADERS: Readonly<Record<string, string>> = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
};

/** Apply the anti-cache headers onto an existing Response (mutates its headers). */
export function applyNoStore(response: Response): Response {
  for (const [name, value] of Object.entries(NO_STORE_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}
