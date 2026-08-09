import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The keep-alive cron route (`/api/keep-alive`) — pure unit suite, no local
 * Supabase stack needed: env comes from a mutable `vi.hoisted` holder (so one
 * file covers every env state, unlike the file-per-state pattern the signin
 * routes need for their real-session suites) and the Supabase roundtrip is a
 * mocked `fetch`. Covers the auth gate (fails closed without a configured
 * secret), the env-missing 503, and the three Supabase outcomes (ok /
 * non-2xx surfaced as 502 / network failure).
 */

const env = vi.hoisted(() => ({
  CRON_SECRET: undefined as string | undefined,
  SUPABASE_URL: undefined as string | undefined,
  SUPABASE_KEY: undefined as string | undefined,
}));

vi.mock("astro:env/server", () => ({
  get CRON_SECRET() {
    return env.CRON_SECRET;
  },
  get SUPABASE_URL() {
    return env.SUPABASE_URL;
  },
  get SUPABASE_KEY() {
    return env.SUPABASE_KEY;
  },
}));

import { GET as keepAliveGET } from "@/pages/api/keep-alive";
import { buildContext } from "./helpers/astro";

const SECRET = "test-cron-secret";

function request(headers?: Record<string, string>) {
  return keepAliveGET(buildContext({ url: "https://test.local/api/keep-alive", headers }));
}

describe("keep-alive cron route", () => {
  beforeEach(() => {
    env.CRON_SECRET = SECRET;
    env.SUPABASE_URL = "https://stub.supabase.local";
    env.SUPABASE_KEY = "stub-anon-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when no CRON_SECRET is configured, even with a bearer header (fails closed)", async () => {
    env.CRON_SECRET = undefined;

    const response = await request({ Authorization: `Bearer ${SECRET}` });

    expect(response.status).toBe(401);
  });

  it("returns 401 when the Authorization header is absent or mismatched", async () => {
    expect((await request()).status).toBe(401);
    expect((await request({ Authorization: "Bearer wrong-secret" })).status).toBe(401);
    // The docs-mandated `Bearer ` prefix is part of the contract, not optional.
    expect((await request({ Authorization: SECRET })).status).toBe(401);
  });

  it("returns 503 when the Supabase env is missing, without calling fetch", async () => {
    env.SUPABASE_URL = undefined;
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const response = await request({ Authorization: `Bearer ${SECRET}` });

    expect(response.status).toBe(503);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns 200 and queries Supabase with the anon key when authorized", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("[]", { status: 200 }));

    const response = await request({ Authorization: `Bearer ${SECRET}` });

    expect(response.status).toBe(200);
    expect((await response.json()) as { ok: boolean }).toMatchObject({ ok: true, supabaseStatus: 200 });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://stub.supabase.local/rest/v1/child_profiles?select=id&limit=1");
    expect((init.headers as Record<string, string>).apikey).toBe("stub-anon-key");
  });

  it("surfaces a non-2xx Supabase answer as 502 with the upstream status (drift stays visible)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("gone", { status: 404 }));

    const response = await request({ Authorization: `Bearer ${SECRET}` });

    expect(response.status).toBe(502);
    expect((await response.json()) as { ok: boolean }).toMatchObject({ ok: false, supabaseStatus: 404 });
  });

  it("returns 502 when the Supabase fetch itself fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    const response = await request({ Authorization: `Bearer ${SECRET}` });

    expect(response.status).toBe(502);
    expect((await response.json()) as { ok: boolean; error: string }).toMatchObject({
      ok: false,
      error: "network down",
    });
  });
});
