import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { onRequest } from "@/middleware";
import { POST as signinPOST } from "@/pages/api/auth/signin";
import { POST as signoutPOST } from "@/pages/api/auth/signout";
import { createSignedInUser, deleteUser, PASSWORD, type TestAccount } from "./helpers/supabase";
import { buildContext, type CookieJar, createCookieJar, reachedNext, runMiddleware } from "./helpers/astro";

/**
 * Risk #3 — session gating (test-plan §2). Proves the middleware gate never
 * fails open: an anonymous request to a protected route redirects to login, an
 * authenticated parent reaches the gated surface, and sign-out re-triggers the
 * gate. Runs the REAL `src/middleware.ts` and REAL auth route handlers against a
 * REAL local Supabase session — mocking the Supabase client here would assert
 * the mock, not the gate (the §2 anti-pattern). The env-missing / null-client
 * pins live in `tests/auth-env-missing.test.ts` (a file-scoped env mock can't
 * coexist with these real-session tests).
 *
 * Requires the local Supabase stack + `.env.test`.
 */

/** Mint a real session by driving the signin route; the jar captures its cookies. */
async function mintSession(email: string): Promise<CookieJar> {
  const jar = createCookieJar();
  const context = buildContext({
    url: "https://test.local/api/auth/signin",
    method: "POST",
    formData: { email, password: PASSWORD },
    cookies: jar,
  });
  const response = await signinPOST(context);
  // Signin success is the redirect to "/"; if this fails the session was never
  // established and the downstream gate assertions would be meaningless.
  expect(response.headers.get("Location")).toBe("/");
  return jar;
}

describe("Risk #3 — session gating (real middleware + Supabase)", () => {
  let account: TestAccount;

  beforeAll(async () => {
    account = await createSignedInUser("gating");
  });

  afterAll(async () => {
    if (account.id) await deleteUser(account.id);
  });

  it("anonymous request to a protected route redirects to /auth/signin", async () => {
    const context = buildContext({ url: "https://test.local/dashboard" });

    const response = await runMiddleware(onRequest, context);

    expect(response.headers.get("Location")).toBe("/auth/signin");
    expect(context.locals.user).toBeNull();
  });

  it("authenticated request reaches the gated surface and resolves a durable session", async () => {
    const jar = await mintSession(account.email);
    const context = buildContext({ url: "https://test.local/dashboard", cookies: jar });

    const response = await runMiddleware(onRequest, context);

    expect(reachedNext(response)).toBe(true); // gate passed → next()
    expect(response.headers.get("Location")).toBeNull();
    // L-002: assert the session is durably resolved (real getUser round-trip),
    // not merely the absence of a redirect.
    expect(context.locals.user?.id).toBe(account.id);
  });

  it("sign-out invalidates the session so the gate re-triggers", async () => {
    const jar = await mintSession(account.email);

    const signoutResponse = await signoutPOST(
      buildContext({ url: "https://test.local/api/auth/signout", method: "POST", cookies: jar }),
    );
    expect(signoutResponse.headers.get("Location")).toBe("/");

    // Replaying the now-cleared cookies: the gate must redirect again.
    const context = buildContext({ url: "https://test.local/dashboard", cookies: jar });
    const response = await runMiddleware(onRequest, context);

    expect(response.headers.get("Location")).toBe("/auth/signin");
    expect(context.locals.user).toBeNull();
  });

  it("protected-set guard: only the intended routes gate; other paths stay public", async () => {
    // The gate is opt-in (fail-open by default). This pins the *intended*
    // protected set: /dashboard gates, and any non-listed path stays public — so
    // changing PROTECTED_ROUTES (adding or removing a route) surfaces here as a
    // failing expectation. (Meta-check: temporarily adding a path to
    // PROTECTED_ROUTES turns the matching assertion below red.)
    const dashboard = await runMiddleware(onRequest, buildContext({ url: "https://test.local/dashboard" }));
    expect(dashboard.headers.get("Location")).toBe("/auth/signin");

    const root = await runMiddleware(onRequest, buildContext({ url: "https://test.local/" }));
    expect(reachedNext(root)).toBe(true);

    // A representative non-listed path stays public (asserts it is NOT gated).
    const other = await runMiddleware(onRequest, buildContext({ url: "https://test.local/play" }));
    expect(reachedNext(other)).toBe(true);
  });

  it("KNOWN ISSUE: the startsWith gate over-matches sibling paths (/dashboardXYZ)", async () => {
    // No trailing-slash boundary on the prefix match, so /dashboardXYZ also gates.
    // Pinned as current behavior; tighten PROTECTED_ROUTES matching to fix.
    const response = await runMiddleware(onRequest, buildContext({ url: "https://test.local/dashboardXYZ" }));
    expect(response.headers.get("Location")).toBe("/auth/signin");
  });
});
