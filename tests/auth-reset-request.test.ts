import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { POST as resetPOST } from "@/pages/api/auth/reset";
import { createSignedInUser, deleteUser, type TestAccount } from "./helpers/supabase";
import { buildContext } from "./helpers/astro";
import { t } from "@/i18n";

/**
 * Password-reset request route (`src/pages/api/auth/reset.ts`).
 *
 * The contract that matters here is NOT "an email went out" — it is that the
 * route reveals nothing about which addresses have accounts. Supabase's
 * `resetPasswordForEmail` succeeds for unknown addresses by design; the route
 * must not undo that by branching on the result. This is the same enumeration
 * posture the signup route was fixed to hold (2026-08-13).
 *
 * Requires the local Supabase stack + `.env.test`.
 */

function resetRequest(email: string | undefined) {
  return buildContext({
    url: "https://test.local/api/auth/reset",
    method: "POST",
    formData: email === undefined ? {} : { email },
  });
}

describe("password-reset request route (real Supabase)", () => {
  const createdIds: string[] = [];
  let account: TestAccount;

  afterAll(async () => {
    for (const id of createdIds) await deleteUser(id);
  });

  it("answers a registered and an unknown address identically", async () => {
    account = await createSignedInUser("reset-known");
    createdIds.push(account.id);

    const known = await resetPOST(resetRequest(account.email));
    const unknown = await resetPOST(resetRequest(`reset-unknown-${randomUUID()}@example.test`));

    expect(known.status).toBe(unknown.status);
    expect(known.headers.get("Location")).toBe(unknown.headers.get("Location"));
    expect(await known.text()).toBe(await unknown.text());
  });

  it("lands back on the request page with the sent notice", async () => {
    const response = await resetPOST(resetRequest(`reset-notice-${randomUUID()}@example.test`));

    expect(response.headers.get("Location")).toBe("/auth/reset-password?sent=1");
  });

  it("carries the anti-CDN-cache headers", async () => {
    const response = await resetPOST(resetRequest(`reset-nostore-${randomUUID()}@example.test`));

    expect(response.headers.get("Cache-Control")).toBe("private, no-cache, no-store, must-revalidate, max-age=0");
    expect(response.headers.get("Pragma")).toBe("no-cache");
    expect(response.headers.get("Expires")).toBe("0");
  });

  it("redirects back with a Polish error when no address was submitted", async () => {
    const response = await resetPOST(resetRequest(undefined));
    const location = response.headers.get("Location") ?? "";

    expect(location).toMatch(/^\/auth\/reset-password\?error=/);
    const error = decodeURIComponent(new URL(location, "https://test.local").searchParams.get("error") ?? "");
    expect(error).toBe(t.auth.validation.emailRequired);
  });
});
