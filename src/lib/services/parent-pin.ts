import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { AstroCookies } from "astro";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PARENT_SESSION_SECRET } from "astro:env/server";

/**
 * Parent-PIN gate (S-07 / FR-016). Hash + store the PIN, verify it server-side
 * with a brute-force throttle, and mint/read a short-lived signed session marker.
 * Every function takes the request-scoped RLS client so `account_settings` reads/
 * writes are scoped to the authenticated parent (a non-owner sees no row). The PIN
 * and the HMAC secret are NEVER logged and the PIN is NEVER stored in plaintext.
 */

/** Cookie carrying the parent-verified marker. httpOnly + short TTL (see setParentVerified). */
export const PARENT_VERIFIED_COOKIE = "parent_verified";
/** Marker lifetime — the report re-prompts for the PIN after this elapses. */
export const MARKER_TTL_MS = 15 * 60_000; // 15 minutes

/** Wrong-PIN attempts before a cooldown kicks in (bounds brute-force of a 4–6 digit PIN). */
const MAX_FAILED_ATTEMPTS = 5;
/** Cooldown applied once the threshold is hit. */
const LOCKOUT_MS = 60_000; // 1 minute
const SCRYPT_KEYLEN = 64;

interface AccountSettingsRow {
  account_id: string;
  pin_hash: string;
  failed_attempts: number;
  locked_until: string | null;
}

/** Hash a PIN as `salt:hash` hex (scrypt, per-PIN random salt). */
function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(pin, salt, SCRYPT_KEYLEN);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

/** Constant-time check of a PIN against a stored `salt:hash`. */
function matchesPin(pin: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const derived = scryptSync(pin, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

/** The authenticated parent's account id (from the session — never client input, L-002). */
async function currentUserId(client: SupabaseClient): Promise<string | null> {
  const {
    data: { user },
  } = await client.auth.getUser();
  return user?.id ?? null;
}

/** Whether the authenticated parent has already set a PIN (RLS-scoped). */
export async function hasPin(client: SupabaseClient): Promise<boolean> {
  const { data } = await client.from("account_settings").select("account_id").limit(1);
  return (data?.length ?? 0) > 0;
}

/**
 * Set (or reset) the parent PIN: hash it and upsert the row under RLS, clearing
 * any throttle. `account_id` comes from the session; the INSERT `with check`
 * policy is the backstop. Returns false if unauthenticated or the write fails.
 */
export async function setPin(client: SupabaseClient, pin: string): Promise<boolean> {
  const accountId = await currentUserId(client);
  if (!accountId) return false;
  const { error } = await client
    .from("account_settings")
    .upsert(
      { account_id: accountId, pin_hash: hashPin(pin), failed_attempts: 0, locked_until: null },
      { onConflict: "account_id" },
    );
  return !error;
}

export type VerifyResult = { ok: true } | { ok: false; reason: "no-pin" | "locked" | "wrong" | "error" };

/**
 * Verify a PIN under the throttle: a live `locked_until` rejects WITHOUT checking
 * the PIN; a correct PIN resets the counter; a wrong PIN increments it and, at the
 * threshold, sets a short cooldown. All state lives on the RLS-scoped row, so this
 * only ever affects the authenticated parent's own settings.
 */
export async function verifyPin(client: SupabaseClient, pin: string): Promise<VerifyResult> {
  const { data, error } = await client
    .from("account_settings")
    .select("account_id, pin_hash, failed_attempts, locked_until")
    .limit(1);
  if (error) return { ok: false, reason: "error" };
  const row = data[0] as AccountSettingsRow | undefined;
  if (!row) return { ok: false, reason: "no-pin" };

  if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
    return { ok: false, reason: "locked" };
  }

  if (matchesPin(pin, row.pin_hash)) {
    await client
      .from("account_settings")
      .update({ failed_attempts: 0, locked_until: null })
      .eq("account_id", row.account_id);
    return { ok: true };
  }

  // Wrong PIN → increment the counter + decide the lockout ATOMICALLY in one
  // row-locked UPDATE (register_pin_failure). A JS read-modify-write here would
  // lose increments under a parallel verify burst, letting an attacker exceed the
  // cap (review finding F3). The RPC runs under the caller's RLS (auth.uid()).
  const { data: throttle, error: rpcErr } = (await client.rpc("register_pin_failure", {
    p_max: MAX_FAILED_ATTEMPTS,
    p_lockout_seconds: Math.floor(LOCKOUT_MS / 1000),
  })) as { data: { locked_until: string | null }[] | null; error: unknown };
  if (rpcErr) return { ok: false, reason: "error" };
  const lockedUntil = throttle?.[0]?.locked_until;
  const locked = lockedUntil !== null && lockedUntil !== undefined && new Date(lockedUntil).getTime() > Date.now();
  return { ok: false, reason: locked ? "locked" : "wrong" };
}

/**
 * The HMAC key, or null when unset/empty. Markers FAIL CLOSED on a missing secret:
 * `PARENT_SESSION_SECRET` is declared optional (so builds/CI without it don't fail),
 * but signing/verifying under an empty key would make every marker forgeable. So a
 * misconfigured prod blocks the report (verifyMarker → false, signMarker → throw)
 * rather than silently opening it.
 */
function markerSecret(): string | null {
  return PARENT_SESSION_SECRET && PARENT_SESSION_SECRET.length > 0 ? PARENT_SESSION_SECRET : null;
}

/** HMAC-sign an `accountId.expiresAt` marker payload with the session secret. Throws if unset (fail closed). */
export function signMarker(accountId: string, expiresAt: number): string {
  const secret = markerSecret();
  if (!secret) throw new Error("PARENT_SESSION_SECRET is not configured");
  const payload = `${accountId}.${expiresAt}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

/**
 * Validate a `parent_verified` cookie: right account, unexpired, and a signature
 * that verifies under the secret (constant-time). A missing/garbage/tampered/
 * expired marker — or an unconfigured secret — returns false so the report route
 * re-prompts for the PIN.
 */
export function verifyMarker(cookie: string | undefined, accountId: string): boolean {
  const secret = markerSecret();
  if (!secret) return false;
  if (!cookie) return false;
  const parts = cookie.split(".");
  if (parts.length !== 3) return false;
  const [acct, expStr, sig] = parts;
  if (acct !== accountId) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = createHmac("sha256", secret).update(`${acct}.${expStr}`).digest("hex");
  const given = Buffer.from(sig);
  const want = Buffer.from(expected);
  return given.length === want.length && timingSafeEqual(given, want);
}

/** Set the signed, httpOnly, short-TTL parent-verified cookie for `accountId`. */
export function setParentVerified(cookies: AstroCookies, accountId: string): void {
  const expiresAt = Date.now() + MARKER_TTL_MS;
  cookies.set(PARENT_VERIFIED_COOKIE, signMarker(accountId, expiresAt), {
    httpOnly: true,
    sameSite: "lax",
    secure: import.meta.env.PROD,
    path: "/",
    maxAge: Math.floor(MARKER_TTL_MS / 1000),
  });
}
