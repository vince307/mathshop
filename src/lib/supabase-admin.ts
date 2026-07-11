import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "astro:env/server";

/**
 * Service-role admin client (MAT-17) — the first and ONLY production
 * service-role surface. It exists for exactly one operation: account
 * self-deletion (`auth.admin.deleteUser`). Discipline (mirrors the test
 * helpers' rule): NEVER use this client to act as a user or to read/write app
 * tables — that bypasses RLS, the project's highest-risk invariant. Identity
 * and ownership are always established through the request-scoped RLS client
 * first; the admin client then receives only a session-derived id.
 *
 * Plain `@supabase/supabase-js` client — deliberately NOT `createServerClient`:
 * it must never touch the request's cookie jar or mint sessions. A fresh,
 * factory-scoped instance per call site; no module-level singleton so tests can
 * mock the env module for the absent-key branch. Fails closed: missing
 * URL/key → null → the route answers 503.
 */
export function createAdminClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
