import type { AstroCookies } from "astro";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createClient as createAppClient } from "@/lib/supabase";
import { GET as confirmGET } from "@/pages/api/auth/confirm";
import { admin, createSignedInUser, deleteUser, PASSWORD } from "./helpers/supabase";
import { buildContext, type CookieJar, createCookieJar } from "./helpers/astro";
import { RESET_MARKER_COOKIE, verifyResetMarker } from "@/lib/services/password-reset";
import { t } from "@/i18n";

/**
 * Email-verification confirm route (`src/pages/api/auth/confirm.ts`). Exercises
 * the real `verifyOtp({ type: "signup", token_hash })` path against the local
 * Supabase stack WITHOUT an email round-trip: `admin.generateLink` mints a real
 * `hashed_token` (spike-verified — works even with enable_confirmations = false).
 * The route writes the session cookie via the SSR client's hardened `setAll`,
 * so success is proved by re-reading the jar (a durable `getUser`, L-002), not
 * just the redirect Location. The failure case pins the Polish error mapping
 * (no English leak — FR-013).
 *
 * Requires the local Supabase stack + `.env.test`.
 */

/** Re-read the session a route minted into the jar — a durable check (L-002). */
async function userFromJar(jar: CookieJar): Promise<{ id: string } | null> {
  const headers = new Headers();
  const cookieHeader = jar.toCookieHeader();
  if (cookieHeader) headers.set("Cookie", cookieHeader);
  const supabase = createAppClient(headers, jar as unknown as AstroCookies);
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Mint a real signup `token_hash` (and the new user's id) with no email round-trip. */
async function generateSignupToken(email: string): Promise<{ tokenHash: string; userId: string }> {
  const { data, error } = await admin.auth.admin.generateLink({ type: "signup", email, password: PASSWORD });
  if (error) throw error;
  return { tokenHash: data.properties.hashed_token, userId: data.user.id };
}

describe("Risk #4 — email verification confirm route (real Supabase)", () => {
  const createdIds: string[] = [];

  afterAll(async () => {
    for (const id of createdIds) await deleteUser(id);
  });

  it("a generated signup token_hash establishes a durable session and redirects to /app", async () => {
    const email = `confirm-${randomUUID()}@example.test`;
    const { tokenHash, userId } = await generateSignupToken(email);
    createdIds.push(userId);

    const jar = createCookieJar();
    const context = buildContext({
      url: `https://test.local/api/auth/confirm?token_hash=${tokenHash}&type=signup`,
      cookies: jar,
    });

    const response = await confirmGET(context);

    // Single source of the post-confirm target → default /app (no `next` here).
    expect(response.headers.get("Location")).toBe("/app");
    // L-002: prove the session is durable (re-read), not merely the redirect.
    expect((await userFromJar(jar))?.id).toBe(userId);
  });

  it("honors a same-origin `next` path as the post-confirm target", async () => {
    const email = `confirm-next-${randomUUID()}@example.test`;
    const { tokenHash, userId } = await generateSignupToken(email);
    createdIds.push(userId);

    const jar = createCookieJar();
    const context = buildContext({
      url: `https://test.local/api/auth/confirm?token_hash=${tokenHash}&type=signup&next=${encodeURIComponent("/app/profiles")}`,
      cookies: jar,
    });

    const response = await confirmGET(context);

    expect(response.headers.get("Location")).toBe("/app/profiles");
    expect((await userFromJar(jar))?.id).toBe(userId);
  });

  // Open-redirect vectors that must all fall back to /app, not bounce off-site.
  // "//" is canonical protocol-relative; "/\\" relies on browsers normalizing
  // "\\"→"/"; the others are control-char strips. One token per case (single-use).
  it.each([
    ["protocol-relative //", "//evil.example/phish"],
    ["backslash /\\", "/\\evil.example/phish"],
    ["leading tab", "/\tevil"],
  ])("rejects an off-origin `next` (%s), falling back to /app", async (_label, payload) => {
    const email = `confirm-evil-${randomUUID()}@example.test`;
    const { tokenHash, userId } = await generateSignupToken(email);
    createdIds.push(userId);

    const jar = createCookieJar();
    const context = buildContext({
      url: `https://test.local/api/auth/confirm?token_hash=${tokenHash}&type=signup&next=${encodeURIComponent(payload)}`,
      cookies: jar,
    });

    const response = await confirmGET(context);

    expect(response.headers.get("Location")).toBe("/app");
  });

  it("a recovery token mints BOTH a session and the reset marker, landing on the update page", async () => {
    // The password-reset gate: a recovery link is the only thing that authorizes
    // setting a new password, so the marker must be minted here — after verifyOtp
    // proves mailbox control — and nowhere else.
    const account = await createSignedInUser("confirm-recovery");
    createdIds.push(account.id);
    const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email: account.email });
    if (error) throw error;

    const jar = createCookieJar();
    const context = buildContext({
      url: `https://test.local/api/auth/confirm?token_hash=${data.properties.hashed_token}&type=recovery&next=${encodeURIComponent("/auth/update-password")}`,
      cookies: jar,
    });

    const response = await confirmGET(context);

    expect(response.headers.get("Location")).toBe("/auth/update-password");
    expect((await userFromJar(jar))?.id).toBe(account.id);
    expect(verifyResetMarker(jar.get(RESET_MARKER_COOKIE)?.value, account.id)).toBe(true);
  });

  it("mints NO reset marker for a signup confirmation", async () => {
    // Guards the blast radius of the recovery branch: only a recovery link may
    // authorize a password change, never an ordinary email verification.
    const email = `confirm-nomarker-${randomUUID()}@example.test`;
    const { tokenHash, userId } = await generateSignupToken(email);
    createdIds.push(userId);

    const jar = createCookieJar();
    const context = buildContext({
      url: `https://test.local/api/auth/confirm?token_hash=${tokenHash}&type=signup`,
      cookies: jar,
    });

    await confirmGET(context);

    expect(jar.get(RESET_MARKER_COOKIE)?.value ?? "").toBe("");
  });

  it("a bad/expired token_hash redirects to a Polish ?error= and mints no session", async () => {
    const jar = createCookieJar();
    const context = buildContext({
      url: `https://test.local/api/auth/confirm?token_hash=not-a-real-token&type=signup`,
      cookies: jar,
    });

    const response = await confirmGET(context);
    const location = response.headers.get("Location") ?? "";
    expect(location).toMatch(/^\/auth\/signin\?error=/);
    const error = decodeURIComponent(new URL(location, "https://test.local").searchParams.get("error") ?? "");
    expect(error).toBe(t.auth.serverError.linkInvalid); // Polish, mapped from otp_expired
    expect(await userFromJar(jar)).toBeNull();
  });

  it("missing token_hash redirects to a Polish ?error=", async () => {
    const context = buildContext({ url: `https://test.local/api/auth/confirm?type=signup` });

    const response = await confirmGET(context);
    const location = response.headers.get("Location") ?? "";
    const error = decodeURIComponent(new URL(location, "https://test.local").searchParams.get("error") ?? "");
    expect(error).toBe(t.auth.serverError.linkInvalid);
  });
});
