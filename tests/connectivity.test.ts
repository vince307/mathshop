import { describe, expect, it } from "vitest";
import { isNetworkFailure, probeConnectivity } from "@/lib/connectivity";

/**
 * Connectivity semantics (S-12, FR-017). Pure — no browser, no DB. Pins the
 * research's classification rule: a fetch that REJECTS (TypeError, abort,
 * timeout) means transport failure → offline; a fetch that RESOLVES — even
 * with a non-ok status — means the server was reached → NOT offline. The
 * probe is the only thing allowed to lift the halt, so it must never throw.
 */

describe("isNetworkFailure", () => {
  it("classifies fetch rejection shapes as network failures", () => {
    expect(isNetworkFailure(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkFailure(new DOMException("Aborted", "AbortError"))).toBe(true);
    expect(isNetworkFailure(new DOMException("Timed out", "TimeoutError"))).toBe(true);
  });

  it("never classifies server-shaped or unknown errors as network failures", () => {
    expect(isNetworkFailure(new Error("boom"))).toBe(false);
    expect(isNetworkFailure(new DOMException("Denied", "NotAllowedError"))).toBe(false);
    expect(isNetworkFailure({ status: 500 })).toBe(false);
    expect(isNetworkFailure(undefined)).toBe(false);
  });
});

describe("probeConnectivity", () => {
  it("confirms connectivity when the probe target responds ok", async () => {
    const okFetch = () => Promise.resolve(new Response(null, { status: 200 }));
    await expect(probeConnectivity(okFetch as typeof fetch)).resolves.toBe(true);
  });

  it("stays offline when the probe rejects (transport failure) — and never throws", async () => {
    const deadFetch = () => Promise.reject(new TypeError("Failed to fetch"));
    await expect(probeConnectivity(deadFetch as typeof fetch)).resolves.toBe(false);
  });

  it("stays offline when the probe target answers non-ok (server reached is not enough to navigate blind)", async () => {
    const brokenFetch = () => Promise.resolve(new Response(null, { status: 503 }));
    await expect(probeConnectivity(brokenFetch as typeof fetch)).resolves.toBe(false);
  });
});
