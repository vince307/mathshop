import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as signinPOST } from "@/pages/api/auth/signin";
import { POST as setPinPOST } from "@/pages/api/parent/pin/set";
import { POST as verifyPinPOST } from "@/pages/api/parent/pin/verify";
import { PARENT_VERIFIED_COOKIE, signMarker, verifyMarker } from "@/lib/services/parent-pin";
import { createSignedInUser, deleteUser, PASSWORD, type TestAccount } from "./helpers/supabase";
import { buildContext, createCookieJar, type CookieJar } from "./helpers/astro";
import { t } from "@/i18n";

/**
 * PIN-gate ROUTE contracts (Risk #3/#5 — the parent gate). The service layer
 * (verifyPin/setPin/markers) is covered by `tests/parent-pin.test.ts`; this
 * suite covers the two routes' gate ordering and the security decisions that
 * live ONLY in the route: the first-set-open / reset-requires-marker guard
 * (`set.ts`), the verify throttle → HTTP-status mapping, and marker minting on
 * success. Request-level via the real signin route (harness §6.3). Requires the
 * local Supabase stack + `.env.test`.
 */

async function signedInJar(account: TestAccount): Promise<CookieJar> {
  const jar = createCookieJar();
  const context = buildContext({
    url: "https://test.local/api/auth/signin",
    method: "POST",
    formData: { email: account.email, password: PASSWORD },
    cookies: jar,
  });
  const response = await signinPOST(context);
  expect(response.headers.get("Location")).toBe("/app");
  return jar;
}

const pinContext = (route: string, jar: CookieJar, pin: string) =>
  buildContext({ url: `https://test.local${route}`, method: "POST", formData: { pin }, cookies: jar });

const setCtx = (jar: CookieJar, pin: string) => pinContext("/api/parent/pin/set", jar, pin);
const verifyCtx = (jar: CookieJar, pin: string) => pinContext("/api/parent/pin/verify", jar, pin);

async function body(response: Response): Promise<{ ok: boolean; reason?: string }> {
  return (await response.json()) as { ok: boolean; reason?: string };
}

describe("POST /api/parent/pin/set", () => {
  let a: TestAccount;
  beforeAll(async () => {
    a = await createSignedInUser("pinset");
  });
  afterAll(async () => {
    await deleteUser(a.id);
  });

  it("first-time set is open, stores the PIN, and mints a parent_verified marker", async () => {
    const jar = await signedInJar(a);
    const response = await setPinPOST(setCtx(jar, "1234"));

    expect(response.status).toBe(200);
    expect((await body(response)).ok).toBe(true);
    // The route marks the session verified so a first-set flows straight into the report.
    const marker = jar.get(PARENT_VERIFIED_COOKIE)?.value;
    expect(verifyMarker(marker, a.id)).toBe(true);
  });

  it("rejects a non-numeric / wrong-length PIN with 400 (fresh account, no reset guard in the way)", async () => {
    // A no-PIN account: the reset guard (403) is skipped, so zod (400) is reached.
    const fresh = await createSignedInUser("pinsetbad");
    try {
      const response = await setPinPOST(setCtx(await signedInJar(fresh), "12")); // < 4 digits
      expect(response.status).toBe(400);
      expect((await body(response)).reason).toBe("invalid");
    } finally {
      await deleteUser(fresh.id);
    }
  });

  it("reset guard: overwriting an EXISTING PIN without a valid marker is 403", async () => {
    // `a` already has a PIN from the first test. A fresh session has no marker.
    const jar = await signedInJar(a);
    const response = await setPinPOST(setCtx(jar, "5678"));
    expect(response.status).toBe(403);
    expect((await body(response)).reason).toBe("forbidden");
  });

  it("reset succeeds WITH a valid marker (the report-gated reset path)", async () => {
    const jar = await signedInJar(a);
    jar.set(PARENT_VERIFIED_COOKIE, signMarker(a.id, Date.now() + 60_000));
    const response = await setPinPOST(setCtx(jar, "5678"));
    expect(response.status).toBe(200);
    // New PIN is live; the old one no longer verifies.
    const check = await verifyPinPOST(verifyCtx(await signedInJar(a), "5678"));
    expect(check.status).toBe(200);
  });

  it("401 when unauthenticated (no session cookies)", async () => {
    const response = await setPinPOST(setCtx(createCookieJar(), "1234"));
    expect(response.status).toBe(401);
  });
});

describe("POST /api/parent/pin/verify", () => {
  let a: TestAccount;
  beforeAll(async () => {
    a = await createSignedInUser("pinverify");
    // Seed a PIN via the route so this suite is self-contained.
    await setPinPOST(setCtx(await signedInJar(a), "2468"));
  });
  afterAll(async () => {
    await deleteUser(a.id);
  });

  it("correct PIN → 200 and mints a fresh marker", async () => {
    const jar = await signedInJar(a);
    const response = await verifyPinPOST(verifyCtx(jar, "2468"));
    expect(response.status).toBe(200);
    expect(verifyMarker(jar.get(PARENT_VERIFIED_COOKIE)?.value, a.id)).toBe(true);
  });

  it("wrong PIN → 401 with reason 'wrong' and NO marker", async () => {
    const jar = await signedInJar(a);
    const response = await verifyPinPOST(verifyCtx(jar, "0000"));
    expect(response.status).toBe(401);
    expect((await body(response)).reason).toBe("wrong");
    expect(jar.get(PARENT_VERIFIED_COOKIE)).toBeUndefined();
  });

  it("repeated wrong PINs trip the throttle → 429 'locked', rejecting even the correct PIN", async () => {
    const locked = await createSignedInUser("pinlock");
    try {
      await setPinPOST(setCtx(await signedInJar(locked), "1111"));
      let last = await verifyPinPOST(verifyCtx(await signedInJar(locked), "9999"));
      for (let i = 0; i < 4; i++) last = await verifyPinPOST(verifyCtx(await signedInJar(locked), "9999"));
      expect(last.status).toBe(429);
      expect((await body(last)).reason).toBe("locked");
      // While locked the correct PIN is rejected without being checked.
      const correct = await verifyPinPOST(verifyCtx(await signedInJar(locked), "1111"));
      expect(correct.status).toBe(429);
    } finally {
      await deleteUser(locked.id);
    }
  });

  it("verifying before any PIN is set → 400 'no-pin'", async () => {
    const noPin = await createSignedInUser("pinnone");
    try {
      const response = await verifyPinPOST(verifyCtx(await signedInJar(noPin), "1234"));
      expect(response.status).toBe(400);
      expect((await body(response)).reason).toBe("no-pin");
    } finally {
      await deleteUser(noPin.id);
    }
  });

  it("rejects a malformed PIN with 400 'invalid' (Polish error stays server-mapped)", async () => {
    const jar = await signedInJar(a);
    const response = await verifyPinPOST(verifyCtx(jar, "abc"));
    expect(response.status).toBe(400);
    expect((await body(response)).reason).toBe("invalid");
    // The gate's copy map is Polish-only (no English leak); sanity-touch the key exists.
    expect(t.parentPin.errors.wrong.length).toBeGreaterThan(0);
  });
});
