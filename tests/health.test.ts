import type { APIContext } from "astro";
import { describe, expect, it } from "vitest";

import { GET, prerender } from "@/pages/api/health";

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
});
