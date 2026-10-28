import type { APIContext } from "astro";
import { describe, expect, it, vi } from "vitest";

// A Supabase client that cannot even be built (e.g. a malformed SUPABASE_URL in the server env file). The health
// probe must still answer: it reports that the process serves HTTP, nothing more. (`vi.mock` is hoisted.)
vi.mock("@/lib/supabase", () => ({
  createClient: () => {
    throw new Error("Invalid supabaseUrl");
  },
}));

import { onRequest } from "@/middleware";
import { GET, prerender } from "@/pages/api/health";
import { buildContext, reachedNext, runMiddleware } from "./helpers/astro";

describe("GET /api/health", () => {
  it("answers 200 {status: ok} without touching Supabase", async () => {
    // The route reads nothing from the context: the container healthcheck must pass with no Supabase env.
    const res = await GET({} as APIContext);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("is server-rendered, never prerendered", () => {
    expect(prerender).toBe(false);
  });

  it("passes the middleware without building a Supabase client", async () => {
    const context = buildContext({ url: "https://test.local/api/health" });
    const response = await runMiddleware(onRequest, context);
    expect(reachedNext(response)).toBe(true);
  });
});
