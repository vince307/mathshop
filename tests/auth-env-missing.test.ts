import { describe, expect, it, vi } from "vitest";

// Force the env-missing branch for every test in this file: `createClient`
// returns null before any network call, so these run offline. Kept in a separate
// file because this file-scoped mock would otherwise poison the real-session
// tests in `tests/auth-session-gating.test.ts`. (`vi.mock` is hoisted above the
// imports below.)
vi.mock("astro:env/server", () => ({ SUPABASE_URL: undefined, SUPABASE_KEY: undefined }));

import { onRequest } from "@/middleware";
import { POST as signoutPOST } from "@/pages/api/auth/signout";
import { buildContext, createCookieJar, runMiddleware } from "./helpers/astro";

describe("Risk #3 — env missing / null client", () => {
  it("fail-closed: a protected route still redirects when Supabase is unconfigured", async () => {
    // The null-client branch must NOT fail open — locals.user stays null and the
    // gate redirects, even though no GoTrue round-trip happened.
    const context = buildContext({ url: "https://test.local/dashboard" });

    const response = await runMiddleware(onRequest, context);

    expect(response.headers.get("Location")).toBe("/auth/signin");
    expect(context.locals.user).toBeNull();
  });

  it("KNOWN ISSUE: sign-out is a silent no-op when Supabase is unconfigured (cookies survive)", async () => {
    // createClient is null → signOut() is skipped → the redirect happens but the
    // auth cookie is never cleared. Pinned as current behavior (stale-session
    // surface); fix by clearing cookies even on the unconfigured path.
    const jar = createCookieJar({ "sb-localhost-auth-token": "stale-value" });
    const context = buildContext({ url: "https://test.local/api/auth/signout", method: "POST", cookies: jar });

    const response = await signoutPOST(context);

    expect(response.headers.get("Location")).toBe("/");
    expect(jar.get("sb-localhost-auth-token")?.value).toBe("stale-value");
  });
});
