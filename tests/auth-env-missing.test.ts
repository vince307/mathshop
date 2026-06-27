import { describe, expect, it, vi } from "vitest";

// Force the env-missing branch for every test in this file: `createClient`
// returns null before any network call, so these run offline. Kept in a separate
// file because this file-scoped mock would otherwise poison the real-session
// tests in `tests/auth-session-gating.test.ts`. (`vi.mock` is hoisted above the
// imports below.)
vi.mock("astro:env/server", () => ({ SUPABASE_URL: undefined, SUPABASE_KEY: undefined }));

import { onRequest } from "@/middleware";
import { POST as signinPOST } from "@/pages/api/auth/signin";
import { POST as signupPOST } from "@/pages/api/auth/signup";
import { POST as signoutPOST } from "@/pages/api/auth/signout";
import { buildContext, createCookieJar, runMiddleware } from "./helpers/astro";
import { t } from "@/i18n";

// The unconfigured branch now returns the Polish "not configured" message (FR-013).
const NOT_CONFIGURED = encodeURIComponent(t.auth.serverError.notConfigured);

/**
 * Assert a response carries the anti-CDN-cache headers (Phase 3). Any response
 * that sets or clears auth cookies must be non-cacheable on Vercel's CDN, or a
 * cached auth-cookie response could serve one user's session to another. Checked
 * here on the offline (unconfigured) path — the headers are response-level and
 * don't depend on a live Supabase round-trip.
 */
function expectNoStore(response: Response) {
  expect(response.headers.get("Cache-Control")).toBe("private, no-cache, no-store, must-revalidate, max-age=0");
  expect(response.headers.get("Pragma")).toBe("no-cache");
  expect(response.headers.get("Expires")).toBe("0");
}

describe("Risk #3 — env missing / null client", () => {
  it("fail-closed: a protected route still redirects when Supabase is unconfigured", async () => {
    // The null-client branch must NOT fail open — locals.user stays null and the
    // gate redirects, even though no GoTrue round-trip happened.
    const context = buildContext({ url: "https://test.local/app" });

    const response = await runMiddleware(onRequest, context);

    expect(response.headers.get("Location")).toBe("/auth/signin");
    expect(context.locals.user).toBeNull();
    // The gate redirect sets/clears no cookies here, but it is an auth-path
    // response and must still be non-cacheable on the CDN.
    expectNoStore(response);
  });

  it("sign-out clears the auth cookies even when Supabase is unconfigured", async () => {
    // createClient is null → there is no client to call signOut(), so the route
    // clears the `sb-…-auth-token` cookies directly. Sign-out must never be a
    // silent no-op that leaves a stale session behind. (Previously pinned as the
    // known-issue no-op; Phase 3 fixes it.)
    const jar = createCookieJar({ "sb-localhost-auth-token": "stale-value" });
    const context = buildContext({ url: "https://test.local/api/auth/signout", method: "POST", cookies: jar });

    const response = await signoutPOST(context);

    expect(response.headers.get("Location")).toBe("/");
    // Cleared = set to an empty value; the harness jar drops empty cookies from a
    // replayed `Cookie:` header, so the session no longer travels.
    expect(jar.get("sb-localhost-auth-token")?.value).toBe("");
    expect(jar.toCookieHeader()).toBe("");
    expectNoStore(response);
  });
});

describe("Risk #4 — auth routes, unconfigured branch", () => {
  it("signin redirects with the Polish 'not configured' message when unconfigured", async () => {
    const context = buildContext({
      url: "https://test.local/api/auth/signin",
      method: "POST",
      formData: { email: "a@example.test", password: "whatever" },
    });

    const response = await signinPOST(context);

    expect(response.headers.get("Location")).toBe(`/auth/signin?error=${NOT_CONFIGURED}`);
    expectNoStore(response);
  });

  it("signup redirects with the Polish 'not configured' message when unconfigured", async () => {
    const context = buildContext({
      url: "https://test.local/api/auth/signup",
      method: "POST",
      formData: { email: "a@example.test", password: "whatever" },
    });

    const response = await signupPOST(context);

    expect(response.headers.get("Location")).toBe(`/auth/signup?error=${NOT_CONFIGURED}`);
    expectNoStore(response);
  });
});
