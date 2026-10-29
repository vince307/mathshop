import type { AstroCookies } from "astro";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AUTH_COOKIE_RE, createClient as createAppClient } from "@/lib/supabase";
import { REMEMBER_ME_COOKIE, REMEMBER_ME_MAX_AGE_SECONDS } from "@/lib/services/remember-me";
import { POST as signinPOST } from "@/pages/api/auth/signin";
import { POST as signoutPOST } from "@/pages/api/auth/signout";
import { GET as confirmGET } from "@/pages/api/auth/confirm";
import { POST as updatePasswordPOST } from "@/pages/api/auth/update-password";
import { admin, createSignedInUser, deleteUser, PASSWORD, type TestAccount } from "./helpers/supabase";
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

/**
 * RF-1 — the auth-cookie lifetime on the paths a parent reaches by clicking a
 * link in an email, rather than by submitting the sign-in form.
 *
 * `setAll` is *every* auth-cookie write path, but only `POST /api/auth/signin`
 * carries the checkbox. `GET /api/auth/confirm` (`verifyOtp`, for both signup
 * verification and recovery) and `POST /api/auth/update-password` therefore mint
 * their session with whatever marker the browser already has — and a fresh
 * browser has none, so the session dies when the browser closes.
 *
 * THAT IS THE DECISION, NOT AN OVERSIGHT (see
 * `context/changes/rf1-session-cookie-on-email-links/change.md`): 30 days is
 * something a parent opts into on a device they consider theirs, and clicking a
 * link in an email is not that act. These tests exist so the behaviour cannot
 * drift in either direction unnoticed — neither into an unchosen 30 days, nor
 * into the library's unchosen 400.
 *
 * `POST /api/auth/signup` is deliberately NOT covered. Under production config
 * (`enable_confirmations = true`) `signUp` returns `session: null` and the route
 * writes no auth cookie at all; it only writes one because the local stack has
 * confirmations off (`supabase/config.toml`). A test here would assert a config
 * toggle, so the route is documented in `docs/reference/contract-surfaces.md`
 * instead.
 */

const RF1_NEW_PASSWORD = "rf1-brand-new-password-789!";

/** Mint a real signup `token_hash` (and the new user's id) — no email round-trip. */
async function generateSignupToken(email: string): Promise<{ tokenHash: string; userId: string }> {
  const { data, error } = await admin.auth.admin.generateLink({ type: "signup", email, password: PASSWORD });
  if (error) throw error;
  return { tokenHash: data.properties.hashed_token, userId: data.user.id };
}

/** Run the real confirm route into `jar` and assert it landed where expected. */
async function confirm(jar: CookieJar, tokenHash: string, type: "signup" | "recovery", next?: string) {
  const query = `token_hash=${tokenHash}&type=${type}${next ? `&next=${encodeURIComponent(next)}` : ""}`;
  const response = await confirmGET(
    buildContext({ url: `https://test.local/api/auth/confirm?${query}`, cookies: jar }),
  );
  expect(response.headers.get("Location"), "confirm did not succeed").toBe(next ?? "/app");
}

/** Walk the real recovery hop into `jar`: session cookie + reset marker. */
async function recoveryHop(jar: CookieJar, email: string) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (error) throw error;
  await confirm(jar, data.properties.hashed_token, "recovery", "/auth/update-password");
}

/**
 * Carry a jar's cookies into a FRESH jar, dropping the captured `options`.
 *
 * Why this matters for the update-password cases: the recovery hop has already
 * written an auth cookie into the jar, and the jar is keyed by name, so asserting
 * on the same jar after `POST /api/auth/update-password` cannot tell that route's
 * write apart from `confirm`'s. Replaying into a fresh jar makes any surviving
 * `options` object proof that update-password wrote the cookie itself.
 */
function carryOver(jar: CookieJar): CookieJar {
  const carried: Record<string, string> = {};
  for (const cookie of jar.getAll()) {
    if (cookie.value !== "") carried[cookie.name] = cookie.value;
  }
  return createCookieJar(carried);
}

/** Like `authCookieWrite`, but refuses to pass on a merely *carried* cookie. */
function freshAuthCookieWrite(jar: CookieJar): StoredCookie {
  const write = authCookieWrite(jar);
  expect(write.options, "the route wrote no auth cookie — a carried-over value was matched").toBeDefined();
  return write;
}

describe("remember-me — RF-1: lifetime on the email-link paths (real routes, real Supabase)", () => {
  const createdIds: string[] = [];

  afterAll(async () => {
    for (const id of createdIds) await deleteUser(id);
  });

  it("8 — confirm in a fresh browser writes a browser-session cookie and mints no marker", async () => {
    const email = `rf1-confirm-${randomUUID()}@example.test`;
    const { tokenHash, userId } = await generateSignupToken(email);
    createdIds.push(userId);

    const jar = createCookieJar();
    await confirm(jar, tokenHash, "signup");

    expect(freshAuthCookieWrite(jar).options?.maxAge).toBeUndefined();
    // The route must not decide "remember me" on the parent's behalf. If a later
    // maintainer adds `setRememberChoice(cookies, true)` here, this is what fails.
    expect(jar.get(REMEMBER_ME_COOKIE)).toBeUndefined();
  });

  it("9 — confirm in an ALREADY-remembered browser keeps the 30 days", async () => {
    const email = `rf1-confirm-remembered-${randomUUID()}@example.test`;
    const { tokenHash, userId } = await generateSignupToken(email);
    createdIds.push(userId);

    // The parent ticked the box on this device at some earlier sign-in.
    const jar = createCookieJar({ [REMEMBER_ME_COOKIE]: "1" });
    await confirm(jar, tokenHash, "signup");

    // The choice is a property of the browser, not of the request — so a session
    // minted by a link click inherits it instead of silently downgrading.
    expect(freshAuthCookieWrite(jar).options?.maxAge).toBe(REMEMBER_ME_MAX_AGE_SECONDS);
  });

  it("10 — update-password in a fresh browser writes a browser-session cookie", async () => {
    const account = await createSignedInUser("rf1-update");
    createdIds.push(account.id);

    const recovered = createCookieJar();
    await recoveryHop(recovered, account.email);

    const jar = carryOver(recovered);
    const response = await updatePasswordPOST(
      buildContext({
        url: "https://test.local/api/auth/update-password",
        method: "POST",
        formData: { password: RF1_NEW_PASSWORD, confirm: RF1_NEW_PASSWORD },
        cookies: jar,
      }),
    );
    expect(response.headers.get("Location"), "password update did not succeed").toBe("/app");

    expect(freshAuthCookieWrite(jar).options?.maxAge).toBeUndefined();
    expect(jar.get(REMEMBER_ME_COOKIE)).toBeUndefined();
  });

  it("11 — update-password in an ALREADY-remembered browser keeps the 30 days", async () => {
    const account = await createSignedInUser("rf1-update-remembered");
    createdIds.push(account.id);

    const recovered = createCookieJar({ [REMEMBER_ME_COOKIE]: "1" });
    await recoveryHop(recovered, account.email);

    const jar = carryOver(recovered);
    const response = await updatePasswordPOST(
      buildContext({
        url: "https://test.local/api/auth/update-password",
        method: "POST",
        formData: { password: RF1_NEW_PASSWORD, confirm: RF1_NEW_PASSWORD },
        cookies: jar,
      }),
    );
    expect(response.headers.get("Location"), "password update did not succeed").toBe("/app");

    expect(freshAuthCookieWrite(jar).options?.maxAge).toBe(REMEMBER_ME_MAX_AGE_SECONDS);
    // A password reset revokes the OTHER devices (`scope: "others"`); it must not
    // also revoke this device's remembered status.
    expect(jar.get(REMEMBER_ME_COOKIE)?.value).toBe("1");
  });
});
