import type { AstroCookies } from "astro";

/**
 * The "Zapamiętaj mnie" choice on the parent login (mockup
 * `01-parent-login-web.png`). It owns exactly one thing: the *persistence* of the
 * Supabase auth cookie. Ticked ⇒ that cookie carries an explicit 30-day
 * `Max-Age`; unticked (the default) ⇒ it carries none at all and dies with the
 * browser session.
 *
 * WHY A COOKIE AND NOT A REQUEST-SCOPED FLAG: `@supabase/ssr` re-writes the auth
 * cookie on every token refresh (~hourly), through the same `setAll` seam. A
 * choice held only in the sign-in request is silently reverted an hour later, and
 * no test that only looks at sign-in can see it. The marker is what makes the
 * choice survive the refresh.
 *
 * WHY THIS MARKER IS **NOT** SIGNED, unlike `RESET_MARKER_COOKIE`
 * (`password-reset.ts`) and `PARENT_VERIFIED_COOKIE` (`parent-pin.ts`): those two
 * are HMAC-signed because forging them *grants a privilege* — setting a new
 * password, or skipping the PIN gate. Forging this one lengthens only the
 * attacker's own auth cookie in their own browser, which they already control.
 * There is nothing to steal, so the crypto would be cargo cult. Do not "harden"
 * it by analogy; copy the option shape of `setActiveProfileCookie`, not the
 * signature.
 */

export const REMEMBER_ME_COOKIE = "remember_me";

/**
 * 30 days — an explicitly chosen lifetime, against `@supabase/ssr`'s unchosen
 * 400-day `DEFAULT_COOKIE_OPTIONS.maxAge`. Shipping the checkbox *shortens* the
 * default rather than lengthening it: today every login is an unchosen 400-day
 * "remember me", and 400 days on a shared family device is indefensible for a
 * product whose parent surface is PIN-gated.
 */
export const REMEMBER_ME_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * Record the parent's choice. Both branches must run on every sign-in: without
 * the delete branch a parent who ticked the box once keeps a 30-day cookie
 * forever, because the stale marker re-lengthens every later sign-in.
 */
export function setRememberChoice(cookies: AstroCookies, remember: boolean): void {
  if (remember) {
    cookies.set(REMEMBER_ME_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: import.meta.env.PROD,
      path: "/",
      // Unlike `setActiveProfileCookie`, this one DOES carry a maxAge: a marker
      // that died with the browser session could never outlive it to keep the
      // auth cookie alive, so every remembered session would revert on launch.
      maxAge: REMEMBER_ME_MAX_AGE_SECONDS,
    });
  } else {
    cookies.delete(REMEMBER_ME_COOKIE, { path: "/" });
  }
}

/**
 * The lifetime to stamp on an auth-cookie write, read from the marker.
 *
 * Returns `number | undefined`, never a boolean, on purpose: `undefined` **is**
 * the mechanism that removes the `Max-Age` attribute (`cookie`'s `serialize()`
 * guards on `maxAge !== undefined`), and a boolean return invites the caller to
 * write `maxAge: remember ? N : 0` — which expires the auth cookie instantly and
 * signs everybody out.
 */
export function authCookieMaxAge(cookies: AstroCookies): number | undefined {
  return cookies.get(REMEMBER_ME_COOKIE)?.value === "1" ? REMEMBER_ME_MAX_AGE_SECONDS : undefined;
}
