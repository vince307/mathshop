import { describe, expect, it, vi } from "vitest";

// Force the env-missing branch so this smoke test runs WITHOUT a live Supabase:
// `createClient` returns null, the middleware sets `locals.user = null`, and a
// public route reaches `next()`. This proves the real `src/middleware.ts` imports
// and runs under Vitest through the virtual-module stubs — and exercises the
// `vi.mock("astro:env/server", …)` override that the env-missing cases in later
// phases reuse. (`vi.mock` is hoisted above the imports below.)
vi.mock("astro:env/server", () => ({ SUPABASE_URL: undefined, SUPABASE_KEY: undefined }));

import { onRequest } from "@/middleware";
import { buildContext, createCookieJar, reachedNext, runMiddleware } from "./helpers/astro";

describe("test harness smoke", () => {
  it("imports the real middleware and reaches next() on a public route", async () => {
    const jar = createCookieJar();
    const context = buildContext({ url: "https://test.local/", cookies: jar });

    const response = await runMiddleware(onRequest, context);

    expect(reachedNext(response)).toBe(true); // gate passed → next() reached
    expect(response.headers.get("Location")).toBeNull(); // not a redirect
    expect(context.locals.user).toBeNull(); // null client → null user
  });
});
