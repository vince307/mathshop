import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
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

/**
 * Flag-driven stub for a failing mail transport. The route's real client is used
 * untouched unless `enabled` is set, so the rest of this file still exercises
 * Supabase for real; when set, `resetPasswordForEmail` fails the way a dead SMTP
 * makes it fail. Proxies (not spreads) so every other client method keeps its
 * binding.
 */
const sendFailure = vi.hoisted(() => ({ enabled: false }));

vi.mock("@/lib/supabase", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase")>();
  return {
    ...actual,
    createClient: (...args: Parameters<typeof actual.createClient>) => {
      const client = actual.createClient(...args);
      if (!client || !sendFailure.enabled) return client;
      return new Proxy(client, {
        get(target, prop, receiver): unknown {
          if (prop !== "auth") return Reflect.get(target, prop, receiver);
          return new Proxy(target.auth, {
            get(authTarget, authProp, authReceiver): unknown {
              if (authProp !== "resetPasswordForEmail") return Reflect.get(authTarget, authProp, authReceiver);
              return () =>
                Promise.resolve({
                  data: null,
                  error: { code: "unexpected_failure", status: 500, message: "smtp down" },
                });
            },
          });
        },
      });
    },
  };
});

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

  /**
   * The oracle this closes: a send is attempted only for a REGISTERED address,
   * so when the transport is down the registered case errors while an unknown
   * one still "succeeds" — which is precisely how production behaved on
   * 2026-08-13 with SMTP blanked. Both must read as sent, and the operator must
   * still get the signal in the logs.
   */
  it("masks a dead transport as the sent notice, and logs it server-side", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    sendFailure.enabled = true;
    try {
      const known = await resetPOST(resetRequest(`reset-fail-known-${randomUUID()}@example.test`));
      const unknown = await resetPOST(resetRequest(`reset-fail-unknown-${randomUUID()}@example.test`));

      expect(known.headers.get("Location")).toBe("/auth/reset-password?sent=1");
      expect(unknown.headers.get("Location")).toBe("/auth/reset-password?sent=1");
      expect(logged).toHaveBeenCalled();
    } finally {
      sendFailure.enabled = false;
      logged.mockRestore();
    }
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
