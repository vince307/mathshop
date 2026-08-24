import type { AstroCookies } from "astro";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AUTH_COOKIE_RE, createClient as createAppClient } from "@/lib/supabase";
import { REMEMBER_ME_COOKIE, REMEMBER_ME_MAX_AGE_SECONDS } from "@/lib/services/remember-me";
import { POST as signinPOST } from "@/pages/api/auth/signin";
import { POST as signoutPOST } from "@/pages/api/auth/signout";
import { createSignedInUser, deleteUser, PASSWORD, type TestAccount } from "./helpers/supabase";
import { buildContext, type CookieJar, type StoredCookie, createCookieJar } from "./helpers/astro";

/**
 * "Zapamiętaj mnie" — the auth cookie's lifetime as a function of the parent's
 * choice. Exercised through the REAL routes against the REAL local Supabase,
 * because the seam under test (`setAll` in `src/lib/supabase.ts`) is only ever
 * reached from inside `@supabase/ssr`.
 *
 * The two refresh tests are the load-bearing ones. `getUser()` on a valid token
 * writes no cookie at all, so a request-scoped (rather than persisted)
 * implementation is indistinguishable from a correct one for a full hour — the
 * refresh is the first moment the difference is observable.
 *
 * HONEST LIMIT — read before trusting these assertions further than they go: the
 * cookie jar captures the `options` object handed to `cookies.set`; it does not
 * serialize cookies and it does not model expiry. So test 3 proves the marker is
 * *written* as persistent, not that a browser keeps it, and tests 1/5 prove the
 * option is `undefined`, not that the `Set-Cookie` header lacks `Max-Age`. The
 * header-level step is `serialize()`'s `if (cookie.maxAge !== undefined)` guard in
 * `cookie` 1.1.1, verified by reading `node_modules/cookie/dist/index.js` rather
 * than asserted here — `cookie` is a transitive dependency of Astro that this
 * project's own manifest does not declare (plan AD-5).
 *
 * Requires the local Supabase stack + `.env.test`.
 */

/** The `sb-<ref>-auth-token` write the routes produced — never a hard-coded ref. */
function authCookieWrite(jar: CookieJar): StoredCookie {
  const write = jar.getAll().find((cookie) => AUTH_COOKIE_RE.test(cookie.name));
  if (!write) throw new Error("no sb-…-auth-token write was captured");
  return write;
}

/** Build an app client that reads the jar's session, the way `userFromJar` does. */
function clientFromJar(jar: CookieJar) {
  const headers = new Headers();
  const cookieHeader = jar.toCookieHeader();
  if (cookieHeader) headers.set("Cookie", cookieHeader);
  const supabase = createAppClient(headers, jar as unknown as AstroCookies);
  if (!supabase) throw new Error("no Supabase client — SUPABASE_URL/KEY missing from .env.test");
  return supabase;
}

/** Run the real signin route into `jar`, with or without the checkbox posted. */
async function signin(jar: CookieJar, email: string, remember: boolean) {
  const formData: Record<string, string> = { email, password: PASSWORD };
  // HTML omits an unchecked checkbox entirely; Radix posts "on" when ticked.
  if (remember) formData.remember = "on";
  const response = await signinPOST(
    buildContext({ url: "https://test.local/api/auth/signin", method: "POST", formData, cookies: jar }),
  );
  expect(response.headers.get("Location"), "sign-in did not succeed").toBe("/app");
}

describe("remember-me — auth cookie lifetime (real routes, real Supabase)", () => {
  let account: TestAccount;

  beforeAll(async () => {
    account = await createSignedInUser("remember-me");
  });

  afterAll(async () => {
    if (account.id) await deleteUser(account.id);
  });

  it("1 — signin WITHOUT remember writes a browser-session auth cookie and no marker", async () => {
    const jar = createCookieJar();
    await signin(jar, account.email, false);

    expect(authCookieWrite(jar).options?.maxAge).toBeUndefined();
    expect(jar.get(REMEMBER_ME_COOKIE)).toBeUndefined();
  });

  it("2 — signin WITH remember writes a 30-day auth cookie", async () => {
    const jar = createCookieJar();
    await signin(jar, account.email, true);

    // Also pins the same-request read path: the marker is written by the route
    // and read back by `setAll` through `cookies.get()`, never from the incoming
    // `Cookie:` header — where it does not exist yet on this very request.
    expect(authCookieWrite(jar).options?.maxAge).toBe(REMEMBER_ME_MAX_AGE_SECONDS);
  });

  it("3 — the remember_me marker itself is written as a persistent cookie", async () => {
    const jar = createCookieJar();
    await signin(jar, account.email, true);

    const marker = jar.getAll().find((cookie) => cookie.name === REMEMBER_ME_COOKIE);
    expect(marker?.value).toBe("1");
    // A session-lifetime marker would die with the browser, so every remembered
    // session would silently revert to a session cookie on the next launch.
    expect(marker?.options?.maxAge).toBe(REMEMBER_ME_MAX_AGE_SECONDS);
  });

  it("4 — a remembered session KEEPS 30 days across a token refresh", async () => {
    const jar = createCookieJar();
    await signin(jar, account.email, true);

    const { error } = await clientFromJar(jar).auth.refreshSession();
    expect(error).toBeNull();

    // The load-bearing assertion of this file: an implementation that threads the
    // choice through the sign-in request instead of persisting it is correct here
    // for exactly one token lifetime, then silently downgrades.
    expect(authCookieWrite(jar).options?.maxAge).toBe(REMEMBER_ME_MAX_AGE_SECONDS);
  });

  it("5 — an unremembered session stays a session cookie across a token refresh", async () => {
    const jar = createCookieJar();
    await signin(jar, account.email, false);

    const { error } = await clientFromJar(jar).auth.refreshSession();
    expect(error).toBeNull();

    // The library's 400-day default must never leak back in on the refresh path.
    expect(authCookieWrite(jar).options?.maxAge).toBeUndefined();
  });

  it("6 — a stale marker does not re-lengthen a later signin without remember", async () => {
    const jar = createCookieJar({ [REMEMBER_ME_COOKIE]: "1" });
    await signin(jar, account.email, false);

    // Without the delete branch, a parent who ticked the box once would keep a
    // 30-day cookie forever.
    expect(jar.get(REMEMBER_ME_COOKIE)).toBeUndefined();
    expect(authCookieWrite(jar).options?.maxAge).toBeUndefined();
  });

  it("7 — signout still EXPIRES the auth cookie rather than blanking it", async () => {
    const jar = createCookieJar();
    await signin(jar, account.email, true);

    const response = await signoutPOST(
      buildContext({ url: "https://test.local/api/auth/signout", method: "POST", cookies: jar }),
    );
    expect(response.headers.get("Location")).toBe("/");

    // Removals travel through the same `setAll`. Without its `isRemoval` guard the
    // lifetime override turns sign-out into an empty-valued *session* cookie the
    // browser keeps — and nothing else in the repo catches that, because the jar's
    // `toCookieHeader()` filters empty values so replayed requests look signed out.
    const write = authCookieWrite(jar);
    expect(write.value).toBe("");
    expect(write.options?.maxAge).toBe(0);
    expect(jar.get(REMEMBER_ME_COOKIE)).toBeUndefined();
  });
});
