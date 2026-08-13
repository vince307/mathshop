import { createHmac, randomUUID } from "node:crypto";
import type { AstroCookies } from "astro";
import { describe, expect, it } from "vitest";
import {
  RESET_MARKER_COOKIE,
  RESET_MARKER_TTL_MS,
  clearResetMarker,
  setResetMarker,
  signResetMarker,
  verifyResetMarker,
} from "@/lib/services/password-reset";
import { signMarker } from "@/lib/services/parent-pin";
import { createCookieJar } from "./helpers/astro";

/**
 * The password-reset marker (plan phase 1) — the gate that authorizes setting a
 * new password. It exists because a recovery link mints a FULL session, so a
 * session alone must not be enough to change the password: this app already
 * refuses a bare session for the report and for account deletion.
 *
 * Runs offline (pure crypto + a cookie jar). `PARENT_SESSION_SECRET` comes from
 * `.env.test` via the `astro:env/server` stub.
 *
 * The cross-purpose case is the one worth staring at: the reset marker and the
 * parent-PIN marker share one secret, so they must NOT share a signature space.
 */

const ACCOUNT = "11111111-1111-1111-1111-111111111111";

describe("password-reset marker", () => {
  it("verifies a marker it just signed for the same account", () => {
    const marker = signResetMarker(ACCOUNT, Date.now() + RESET_MARKER_TTL_MS);

    expect(verifyResetMarker(marker, ACCOUNT)).toBe(true);
  });

  it("refuses a marker minted for a different account", () => {
    const marker = signResetMarker(ACCOUNT, Date.now() + RESET_MARKER_TTL_MS);

    expect(verifyResetMarker(marker, randomUUID())).toBe(false);
  });

  it("refuses an expired marker", () => {
    const marker = signResetMarker(ACCOUNT, Date.now() - 1000);

    expect(verifyResetMarker(marker, ACCOUNT)).toBe(false);
  });

  it("refuses a tampered signature", () => {
    const marker = signResetMarker(ACCOUNT, Date.now() + RESET_MARKER_TTL_MS);
    const [acct, exp, sig] = marker.split(".");
    const flipped = sig.startsWith("a") ? `b${sig.slice(1)}` : `a${sig.slice(1)}`;

    expect(verifyResetMarker(`${acct}.${exp}.${flipped}`, ACCOUNT)).toBe(false);
  });

  it("refuses a marker whose expiry was extended without re-signing", () => {
    const marker = signResetMarker(ACCOUNT, Date.now() - 1000);
    const [acct, , sig] = marker.split(".");
    const farFuture = Date.now() + 60 * 60_000;

    expect(verifyResetMarker(`${acct}.${farFuture}.${sig}`, ACCOUNT)).toBe(false);
  });

  it("refuses garbage and missing cookies", () => {
    expect(verifyResetMarker(undefined, ACCOUNT)).toBe(false);
    expect(verifyResetMarker("", ACCOUNT)).toBe(false);
    expect(verifyResetMarker("not.a.marker", ACCOUNT)).toBe(false);
    expect(verifyResetMarker(`${ACCOUNT}.${Date.now() + 60_000}`, ACCOUNT)).toBe(false);
  });

  it("refuses a parent_verified marker replayed as a reset marker", () => {
    // Both markers are HMAC'd with PARENT_SESSION_SECRET and share the cookie
    // SHAPE (`account.exp.sig`). Without domain separation in the signed payload,
    // a PIN marker — which a parent obtains by typing a 4-6 digit PIN — would
    // authorize a password change.
    const pinMarker = signMarker(ACCOUNT, Date.now() + 15 * 60_000);

    expect(verifyResetMarker(pinMarker, ACCOUNT)).toBe(false);
  });

  it("is not itself accepted by the parent-PIN gate (separation holds both ways)", async () => {
    const { verifyMarker } = await import("@/lib/services/parent-pin");
    const resetMarker = signResetMarker(ACCOUNT, Date.now() + RESET_MARKER_TTL_MS);

    expect(verifyMarker(resetMarker, ACCOUNT)).toBe(false);
  });

  it("signs a payload that is domain-separated, not the bare account.exp", () => {
    // Pins the actual signed string, so a refactor cannot quietly drop the prefix
    // and reintroduce the cross-purpose replay the test above forbids.
    const exp = Date.now() + RESET_MARKER_TTL_MS;
    const secret = process.env.PARENT_SESSION_SECRET ?? "";
    expect(secret, "PARENT_SESSION_SECRET must be set in .env.test").not.toBe("");
    const expected = createHmac("sha256", secret).update(`pwreset:${ACCOUNT}:${exp}`).digest("hex");

    expect(signResetMarker(ACCOUNT, exp)).toBe(`${ACCOUNT}.${exp}.${expected}`);
  });

  it("sets an httpOnly, path-wide cookie that verifies, and clears it on demand", () => {
    const jar = createCookieJar();
    // Same cast the sibling auth suites use — the jar stands in for AstroCookies.
    const cookies = jar as unknown as AstroCookies;

    setResetMarker(cookies, ACCOUNT);

    const stored = jar.get(RESET_MARKER_COOKIE);
    expect(stored?.value).toBeTruthy();
    expect(verifyResetMarker(stored?.value, ACCOUNT)).toBe(true);
    const options = jar.getAll().find((cookie) => cookie.name === RESET_MARKER_COOKIE)?.options ?? {};
    expect(options.httpOnly).toBe(true);
    expect(options.path).toBe("/");
    expect(options.sameSite).toBe("lax");

    clearResetMarker(cookies);

    expect(verifyResetMarker(jar.get(RESET_MARKER_COOKIE)?.value, ACCOUNT)).toBe(false);
  });
});
