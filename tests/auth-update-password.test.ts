import type { AstroCookies } from "astro";
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { POST as updatePOST } from "@/pages/api/auth/update-password";
import { GET as confirmGET } from "@/pages/api/auth/confirm";
import { admin, anonKey, createSignedInUser, deleteUser, PASSWORD, url } from "./helpers/supabase";
import { buildContext, type CookieJar, createCookieJar } from "./helpers/astro";
import { RESET_MARKER_COOKIE, signResetMarker } from "@/lib/services/password-reset";
import { t } from "@/i18n";

/**
 * Set-new-password route (`src/pages/api/auth/update-password.ts`).
 *
 * The gate is the point: a recovery link mints a FULL session, so a session
 * alone must not be enough to change the password — otherwise a stolen cookie is
 * a permanent account takeover. Every refusal here is asserted on DURABLE state
 * (the old password still signs in), never on the redirect alone (L-002): a
 * route that returned the right redirect while writing the password anyway would
 * pass a response-only assertion.
 *
 * Requires the local Supabase stack + `.env.test`.
 */

const NEW_PASSWORD = "brand-new-password-456!";

/** A standalone client, i.e. a different "device" than the one under test. */
function device() {
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Can this password sign the account in right now? The durable check. */
async function canSignIn(email: string, password: string): Promise<boolean> {
  const { error } = await device().auth.signInWithPassword({ email, password });
  return !error;
}

/**
 * Walk the real recovery hop: mint a recovery token, run it through the confirm
 * route, and hand back the jar carrying both the session and the reset marker.
 */
async function recoveredJar(email: string): Promise<CookieJar> {
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (error) throw error;
  const jar = createCookieJar();
  await confirmGET(
    buildContext({
      url: `https://test.local/api/auth/confirm?token_hash=${data.properties.hashed_token}&type=recovery&next=${encodeURIComponent("/auth/update-password")}`,
      cookies: jar,
    }),
  );
  return jar;
}

function updateRequest(jar: CookieJar, password: string, confirm = password) {
  return buildContext({
    url: "https://test.local/api/auth/update-password",
    method: "POST",
    formData: { password, confirm },
    cookies: jar,
  });
}

describe("set-new-password route (real Supabase)", () => {
  const createdIds: string[] = [];

  afterAll(async () => {
    for (const id of createdIds) await deleteUser(id);
  });

  it("changes the password, kills the old one, and lands the parent in the app", async () => {
    const account = await createSignedInUser("update-ok");
    createdIds.push(account.id);
    const jar = await recoveredJar(account.email);

    const response = await updatePOST(updateRequest(jar, NEW_PASSWORD));

    expect(response.headers.get("Location")).toBe("/app");
    expect(await canSignIn(account.email, NEW_PASSWORD)).toBe(true);
    expect(await canSignIn(account.email, PASSWORD)).toBe(false);
  });

  it("consumes the marker so a completed reset cannot be replayed", async () => {
    const account = await createSignedInUser("update-replay");
    createdIds.push(account.id);
    const jar = await recoveredJar(account.email);

    await updatePOST(updateRequest(jar, NEW_PASSWORD));
    // Same jar, second attempt — the marker must be gone.
    const replay = await updatePOST(updateRequest(jar, "yet-another-password-789!"));

    expect(replay.headers.get("Location")).not.toBe("/app");
    expect(await canSignIn(account.email, "yet-another-password-789!")).toBe(false);
    expect(await canSignIn(account.email, NEW_PASSWORD)).toBe(true);
  });

  it("refuses a session with NO marker and leaves the password untouched", async () => {
    // The core threat: a live session (e.g. a stolen cookie) that never went
    // through a recovery link must not be able to change the password.
    const account = await createSignedInUser("update-nomarker");
    createdIds.push(account.id);
    const jar = createCookieJar();
    const signedIn = await device().auth.signInWithPassword({ email: account.email, password: PASSWORD });
    if (signedIn.error) throw signedIn.error;
    // Put a real session in the jar without ever touching a recovery link.
    const sessionJar = await recoveredJar(account.email);
    for (const cookie of sessionJar.getAll()) {
      if (cookie.name !== RESET_MARKER_COOKIE) jar.set(cookie.name, cookie.value, cookie.options);
    }

    const response = await updatePOST(updateRequest(jar, NEW_PASSWORD));

    expect(response.headers.get("Location")).not.toBe("/app");
    // L-002: the durable check. A response-only assertion would pass even if the
    // route wrote the password before redirecting.
    expect(await canSignIn(account.email, PASSWORD)).toBe(true);
    expect(await canSignIn(account.email, NEW_PASSWORD)).toBe(false);
  });

  it("refuses a marker signed for a different account", async () => {
    const account = await createSignedInUser("update-wrongacct");
    const other = await createSignedInUser("update-otheracct");
    createdIds.push(account.id, other.id);
    const jar = await recoveredJar(account.email);
    jar.set(RESET_MARKER_COOKIE, signResetMarker(other.id, Date.now() + 15 * 60_000));

    const response = await updatePOST(updateRequest(jar, NEW_PASSWORD));

    expect(response.headers.get("Location")).not.toBe("/app");
    expect(await canSignIn(account.email, PASSWORD)).toBe(true);
  });

  it("refuses an expired marker and points the parent at a fresh link", async () => {
    const account = await createSignedInUser("update-expired");
    createdIds.push(account.id);
    const jar = await recoveredJar(account.email);
    jar.set(RESET_MARKER_COOKIE, signResetMarker(account.id, Date.now() - 1000));

    const response = await updatePOST(updateRequest(jar, NEW_PASSWORD));
    const location = response.headers.get("Location") ?? "";

    expect(location).toMatch(/^\/auth\/reset-password\?error=/);
    expect(await canSignIn(account.email, PASSWORD)).toBe(true);
  });

  it("rejects a too-short password and a mismatch without touching the account", async () => {
    const account = await createSignedInUser("update-invalid");
    createdIds.push(account.id);
    const jar = await recoveredJar(account.email);

    const short = await updatePOST(updateRequest(jar, "abc"));
    expect(short.headers.get("Location")).toMatch(/^\/auth\/update-password\?error=/);

    const mismatch = await updatePOST(updateRequest(jar, NEW_PASSWORD, "different-password-123!"));
    expect(mismatch.headers.get("Location")).toMatch(/^\/auth\/update-password\?error=/);

    expect(await canSignIn(account.email, PASSWORD)).toBe(true);
  });

  it("surfaces the Polish same-password message when nothing changed", async () => {
    const account = await createSignedInUser("update-same");
    createdIds.push(account.id);
    const jar = await recoveredJar(account.email);

    const response = await updatePOST(updateRequest(jar, PASSWORD));
    const location = response.headers.get("Location") ?? "";
    const error = decodeURIComponent(new URL(location, "https://test.local").searchParams.get("error") ?? "");

    expect(error).toBe(t.auth.serverError.samePassword);
  });

  it("signs out the parent's OTHER devices but keeps this one signed in", async () => {
    const account = await createSignedInUser("update-others");
    createdIds.push(account.id);

    // A second device, signed in before the reset.
    const other = device();
    const otherSession = await other.auth.signInWithPassword({ email: account.email, password: PASSWORD });
    if (otherSession.error) throw otherSession.error;

    const jar = await recoveredJar(account.email);
    const response = await updatePOST(updateRequest(jar, NEW_PASSWORD));

    expect(response.headers.get("Location")).toBe("/app");
    // The other device is rejected on its next request — which is what the app's
    // middleware does on every navigation.
    const { error: otherAfter } = await other.auth.getUser();
    expect(otherAfter).not.toBeNull();
    // …while the resetting device keeps its session (it must reach /app).
    const headers = new Headers();
    const cookieHeader = jar.toCookieHeader();
    if (cookieHeader) headers.set("Cookie", cookieHeader);
    const { createClient: createAppClient } = await import("@/lib/supabase");
    const appClient = createAppClient(headers, jar as unknown as AstroCookies);
    const {
      data: { user },
    } = await (appClient?.auth.getUser() ?? Promise.resolve({ data: { user: null } }));
    expect(user?.id).toBe(account.id);
  });
});
