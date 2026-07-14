import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared Supabase provisioning helpers for integration tests.
 *
 * Extracted from `tests/child-profiles-isolation.test.ts` so every suite that
 * needs a real signed-in user (isolation, session gating, auth routes) draws
 * from one source of truth instead of re-inlining the pattern.
 *
 * Requires the local Supabase stack (`npx supabase start` + `npx supabase db
 * reset`) and `.env.test` (see `.env.test.example`). The service-role admin
 * client is used ONLY to provision and tear down users — never to act as a user
 * under test (that would bypass RLS).
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY. " +
      "Copy .env.test.example to .env.test and fill from `npx supabase status -o env`.",
  );
}

export const url = SUPABASE_URL;
export const anonKey = ANON_KEY;
export const PASSWORD = "test-password-123!";

/** Admin client (service role) — provisioning only, bypasses RLS. */
export const admin = createClient(url, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export interface TestAccount {
  id: string;
  email: string;
  client: SupabaseClient;
}

/** Create a confirmed user and return an anon client already signed in as them. */
export async function createSignedInUser(prefix = "auth-test"): Promise<TestAccount> {
  const email = `${prefix}-${randomUUID()}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;

  return { id: data.user.id, email, client };
}

/** Tear down a provisioned user. ON DELETE CASCADE removes their owned rows.
 * Non-throwing (cleanup must tolerate an already-deleted account), but real
 * teardown failures are logged so stale users don't silently accumulate. */
export async function deleteUser(id: string): Promise<void> {
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error && error.status !== 404) {
    // eslint-disable-next-line no-console -- teardown diagnostics must reach the runner output
    console.warn(`deleteUser(${id}): teardown failed — ${error.message}`);
  }
}

/**
 * Resolve the id of a user created through the signup route (which returns only
 * a redirect, never the new id). Paginates listUsers so it stays correct even
 * when stale users from earlier local runs have accumulated past one page.
 * Returns null if not found. Capture the id right after signup, then tear the
 * user down with `deleteUser(id)` — deterministic, no end-of-run lookup.
 */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage });
    const user = data.users.find((candidate) => candidate.email === email);
    if (user) return user.id;
    if (data.users.length < perPage) return null;
  }
}
