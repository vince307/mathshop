import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

/**
 * Supabase's email-enumeration protection answers a signup for an ALREADY-CONFIRMED
 * address with HTTP 200, `error: null`, and an obfuscated user whose `identities`
 * array is empty — and sends no email at all (Supabase auth docs: "an obfuscated /
 * fake user object will be returned"; "does not send a verification email").
 *
 * The route used to read only `error`, so it promised an activation email that was
 * never sent — the production incident of 2026-08-13 (vince307@gmail.com, an account
 * confirmed on 2026-07-09). The local stack runs `enable_confirmations = false`, so
 * this branch is unreachable against real Supabase: the client is mocked here to
 * return the two shapes production actually returns.
 *
 * The contract is deliberately two-sided: the response to the browser must stay
 * IDENTICAL for both shapes (revealing which addresses exist is precisely what the
 * protection prevents), while the server keeps a trace so the silent path is
 * diagnosable from Vercel function logs instead of invisible.
 */

const signUp = vi.fn();
vi.mock("@/lib/supabase", () => ({ createClient: () => ({ auth: { signUp } }) }));

const { POST: signupPOST } = await import("@/pages/api/auth/signup");
const { buildContext } = await import("./helpers/astro");

const EMAIL = "already-registered@example.test";

/** Production's answer for an address that already has a confirmed account. */
function obfuscatedResponse() {
  return {
    data: {
      user: {
        id: "00000000-0000-0000-0000-000000000000",
        email: EMAIL,
        // The fingerprint: Supabase strips the identity from the fake user.
        identities: [],
      },
      session: null,
    },
    error: null,
  };
}

/** Production's answer for a genuinely new address (confirmation email sent). */
function freshUserResponse() {
  return {
    data: {
      user: {
        id: "11111111-1111-1111-1111-111111111111",
        email: EMAIL,
        identities: [{ id: "22222222-2222-2222-2222-222222222222", provider: "email" }],
      },
      session: null,
    },
    error: null,
  };
}

function signupRequest() {
  return buildContext({
    url: "https://test.local/api/auth/signup",
    method: "POST",
    formData: { email: EMAIL, password: "correct-horse-battery-staple" },
  });
}

describe("signup — Supabase enumeration protection (existing confirmed account)", () => {
  let warn: MockInstance<typeof console.warn>;

  beforeEach(() => {
    signUp.mockReset();
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it("leaves a server-side trace when Supabase obfuscates the signup (no email was sent)", async () => {
    signUp.mockResolvedValue(obfuscatedResponse());

    await signupPOST(signupRequest());

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.join(" ")).toMatch(/auth\/signup/);
  });

  it("keeps the address out of the log — an email is the only PII this app holds", async () => {
    signUp.mockResolvedValue(obfuscatedResponse());

    await signupPOST(signupRequest());

    expect(warn.mock.calls[0]?.join(" ")).not.toContain(EMAIL);
  });

  it("stays silent for a genuine new signup", async () => {
    signUp.mockResolvedValue(freshUserResponse());

    await signupPOST(signupRequest());

    expect(warn).not.toHaveBeenCalled();
  });

  it("answers both cases identically, so signup never reveals which addresses exist", async () => {
    signUp.mockResolvedValue(obfuscatedResponse());
    const existing = await signupPOST(signupRequest());

    signUp.mockResolvedValue(freshUserResponse());
    const fresh = await signupPOST(signupRequest());

    expect(existing.status).toBe(fresh.status);
    expect(existing.headers.get("Location")).toBe(fresh.headers.get("Location"));
    expect(await existing.text()).toBe(await fresh.text());
  });
});
