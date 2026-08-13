import { createHmac, timingSafeEqual } from "node:crypto";
import type { AstroCookies } from "astro";
import { PARENT_SESSION_SECRET } from "astro:env/server";

/**
 * Password-reset gate. A recovery link mints a FULL session, so a session alone
 * must not authorize changing the password — otherwise a stolen cookie becomes a
 * permanent account takeover, and the password would be the one sensitive action
 * less protected than viewing the weekly report (which needs the parent PIN).
 *
 * `/api/auth/confirm` mints this marker only after `verifyOtp({ type: "recovery" })`
 * succeeds — i.e. only for someone who demonstrably controls the mailbox. The
 * set-new-password page and its POST both require it, and the POST clears it, so
 * the authorization is single-use.
 *
 * Shares `PARENT_SESSION_SECRET` with the parent-PIN marker but NOT its signature
 * space: the signed payload carries a `pwreset:` prefix, so a `parent_verified`
 * cookie (obtained with a 4-6 digit PIN) cannot be replayed here, nor this one
 * there. The cookie shape is identical to the PIN marker's on purpose — the
 * separation lives in what gets signed, not in what gets stored.
 */

/** Cookie carrying the reset marker. httpOnly + short TTL (see setResetMarker). */
export const RESET_MARKER_COOKIE = "password_reset";
/** Marker lifetime — long enough to choose a password, short enough to not linger. */
export const RESET_MARKER_TTL_MS = 15 * 60_000; // 15 minutes

/** Domain-separation prefix. Changing this invalidates every live reset marker. */
const MARKER_PURPOSE = "pwreset";

/**
 * The HMAC key, or null when unset/empty. Fails closed exactly like the PIN
 * marker: `PARENT_SESSION_SECRET` is declared optional so builds/CI without it
 * don't fail, but signing under an empty key would make every marker forgeable.
 */
function markerSecret(): string | null {
  return PARENT_SESSION_SECRET && PARENT_SESSION_SECRET.length > 0 ? PARENT_SESSION_SECRET : null;
}

/**
 * HMAC-sign a reset marker for `accountId`. The stored cookie is
 * `accountId.expiresAt.signature`, but the SIGNED payload is
 * `pwreset:accountId:expiresAt` — see the domain-separation note above.
 * Throws if the secret is unset (fail closed).
 */
export function signResetMarker(accountId: string, expiresAt: number): string {
  const secret = markerSecret();
  if (!secret) throw new Error("PARENT_SESSION_SECRET is not configured");
  const sig = createHmac("sha256", secret).update(`${MARKER_PURPOSE}:${accountId}:${expiresAt}`).digest("hex");
  return `${accountId}.${expiresAt}.${sig}`;
}

/**
 * Validate a `password_reset` cookie: right account, unexpired, and a signature
 * that verifies under the secret (constant-time). Anything missing, malformed,
 * tampered, expired, signed for another account, or signed for another purpose —
 * or an unconfigured secret — returns false, and the caller sends the parent back
 * to request a fresh link.
 */
export function verifyResetMarker(cookie: string | undefined, accountId: string): boolean {
  const secret = markerSecret();
  if (!secret) return false;
  if (!cookie) return false;
  const parts = cookie.split(".");
  if (parts.length !== 3) return false;
  const [acct, expStr, sig] = parts;
  if (acct !== accountId) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = createHmac("sha256", secret).update(`${MARKER_PURPOSE}:${acct}:${expStr}`).digest("hex");
  const given = Buffer.from(sig);
  const want = Buffer.from(expected);
  return given.length === want.length && timingSafeEqual(given, want);
}

/** Set the signed, httpOnly, short-TTL reset marker for `accountId`. */
export function setResetMarker(cookies: AstroCookies, accountId: string): void {
  const expiresAt = Date.now() + RESET_MARKER_TTL_MS;
  cookies.set(RESET_MARKER_COOKIE, signResetMarker(accountId, expiresAt), {
    httpOnly: true,
    sameSite: "lax",
    secure: import.meta.env.PROD,
    path: "/",
    maxAge: Math.floor(RESET_MARKER_TTL_MS / 1000),
  });
}

/** Consume the marker so a completed reset cannot be replayed. */
export function clearResetMarker(cookies: AstroCookies): void {
  cookies.set(RESET_MARKER_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: import.meta.env.PROD,
    path: "/",
    maxAge: 0,
  });
}
