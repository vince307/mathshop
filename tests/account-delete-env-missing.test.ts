import { describe, expect, it, vi } from "vitest";

/**
 * The account-deletion route's fail-closed branch (MAT-17). When
 * SUPABASE_SERVICE_ROLE_KEY is absent, `createAdminClient()` returns null and
 * the route must answer 503 BEFORE any auth/marker/PIN work — the admin client
 * is a hard prerequisite. File-scoped `vi.mock` (hoisted above imports) forces
 * the env-missing state; it lives in its own file so it can't poison the
 * real-session suites in `account-deletion.test.ts`. URL/anon key are kept
 * present so this isolates the SERVICE-KEY-absent branch specifically (not the
 * generic no-RLS-client 503). Mirrors `tests/auth-env-missing.test.ts`.
 */
vi.mock("astro:env/server", () => ({
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_ANON_KEY,
  PARENT_SESSION_SECRET: process.env.PARENT_SESSION_SECRET,
  SUPABASE_SERVICE_ROLE_KEY: undefined,
}));

import { POST as deleteAccountPOST } from "@/pages/api/account/delete";
import { buildContext } from "./helpers/astro";

describe("account deletion — service key absent (MAT-17 fail-closed)", () => {
  it("returns 503 without touching auth/marker/PIN when the admin client can't be built", async () => {
    const context = buildContext({
      url: "https://test.local/api/account/delete",
      method: "POST",
      formData: { pin: "1234", email: "someone@example.test" },
    });

    const response = await deleteAccountPOST(context);

    expect(response.status).toBe(503);
    expect(((await response.json()) as { ok: boolean }).ok).toBe(false);
  });
});
