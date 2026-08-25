import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, createSignedInUser, type TestAccount } from "./helpers/supabase";

/**
 * Cross-account data-isolation contract test for `task_attempt`
 * (adaptive-task-engine P1, L-001).
 *
 * Proves the RLS policies in
 * supabase/migrations/20260825120000_create_task_attempt.sql actually isolate one
 * parent account from another. Account B must never SELECT, UPDATE, DELETE, or
 * INSERT-on-behalf-of account A's task_attempt rows; account A sees its own.
 *
 * Mirrors tests/shift-log-isolation.test.ts: each assertion maps 1:1 to one of
 * the four per-operation policies, acting as *signed-in users* (never the
 * service-role client) so RLS is genuinely exercised. Admin is used ONLY to
 * provision/tear down users and to confirm durable state for INSERT-isolation
 * (L-002 — no chained `.select()` read-back).
 *
 * Requires the local Supabase stack + `.env.test`.
 */

interface TaskAttemptRow {
  id: string;
  account_id: string;
  profile_id: string;
  created_at: string;
  shift_index: number;
  task_type: string;
  scenario: string;
  competency: string;
  // Nullable until P3 introduces the continuous scale — the insert below
  // deliberately omits it, which is what proves the column is optional for a writer.
  difficulty: number | null;
  params: Record<string, unknown>;
  first_try: boolean;
  misses: number;
  duration_ms: number | null;
}

/** A counting attempt — the shape the write path stores. */
const ATTEMPT = {
  shift_index: 0,
  task_type: "counting",
  scenario: "count_till",
  competency: "math",
  params: { targetCount: 7 },
  first_try: true,
  misses: 0,
  duration_ms: 4200,
};

/**
 * Marker written into the on-behalf INSERT attempt so the service-role check can
 * look for *that specific row* rather than merely counting. `scenario` carries it
 * because the column is free text with no CHECK constraint, so a legal value
 * cannot be the reason the insert is rejected — only the WITH CHECK can be.
 */
const ON_BEHALF_PROBE = "__on_behalf_probe__";

describe("task_attempt per-account isolation (RLS contract)", () => {
  let accountA: TestAccount;
  let accountB: TestAccount;
  let aProfileId: string;
  let aRowId: string;

  beforeAll(async () => {
    accountA = await createSignedInUser("taskattempt");
    accountB = await createSignedInUser("taskattempt");

    // A owns a profile (FK target) and one task_attempt row (positive control).
    const { data: profile } = await accountA.client
      .from("child_profiles")
      .insert({ account_id: accountA.id, avatar: "lis", name: "Ala", age: 7 })
      .select("id")
      .single()
      .overrideTypes<{ id: string }, { merge: false }>();
    if (!profile) throw new Error("account A profile insert returned no row");
    aProfileId = profile.id;

    const { data: row, error } = await accountA.client
      .from("task_attempt")
      .insert({ account_id: accountA.id, profile_id: aProfileId, ...ATTEMPT })
      .select()
      .overrideTypes<TaskAttemptRow[], { merge: false }>();
    expect(error).toBeNull();
    if (!row || row.length === 0) throw new Error("account A task_attempt insert returned no row");
    aRowId = row[0].id;
  });

  afterAll(async () => {
    if (accountA.id) await admin.auth.admin.deleteUser(accountA.id);
    if (accountB.id) await admin.auth.admin.deleteUser(accountB.id);
  });

  it("positive control: account A can read its own row", async () => {
    const { data, error } = await accountA.client
      .from("task_attempt")
      .select("*")
      .overrideTypes<TaskAttemptRow[], { merge: false }>();
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].id).toBe(aRowId);
    expect(data?.[0].account_id).toBe(accountA.id);
    // The omitted column is genuinely nullable — a writer predating P3 is valid.
    expect(data?.[0].difficulty).toBeNull();
  });

  it("SELECT isolation: account B cannot see account A's row", async () => {
    const { data, error } = await accountB.client
      .from("task_attempt")
      .select("*")
      .overrideTypes<TaskAttemptRow[], { merge: false }>();
    expect(error).toBeNull(); // RLS filters silently — not an error
    expect(data).toHaveLength(0);
  });

  it("UPDATE isolation: account B cannot modify account A's row", async () => {
    const { data, error } = await accountB.client
      .from("task_attempt")
      .update({ misses: 99 })
      .eq("id", aRowId)
      .select()
      .overrideTypes<TaskAttemptRow[], { merge: false }>();
    expect(error).toBeNull();
    expect(data).toHaveLength(0); // USING filtered the row out — no rows affected

    const { data: aData } = await accountA.client
      .from("task_attempt")
      .select("misses")
      .eq("id", aRowId)
      .single()
      .overrideTypes<Pick<TaskAttemptRow, "misses">, { merge: false }>();
    expect(aData?.misses).toBe(ATTEMPT.misses); // unchanged
  });

  it("DELETE isolation: account B cannot delete account A's row", async () => {
    const { data, error } = await accountB.client
      .from("task_attempt")
      .delete()
      .eq("id", aRowId)
      .select()
      .overrideTypes<TaskAttemptRow[], { merge: false }>();
    expect(error).toBeNull();
    expect(data).toHaveLength(0);

    const { data: aData } = await accountA.client
      .from("task_attempt")
      .select("id")
      .eq("id", aRowId)
      .overrideTypes<Pick<TaskAttemptRow, "id">[], { merge: false }>();
    expect(aData).toHaveLength(1); // still present
  });

  it("INSERT-on-behalf isolation: account B cannot insert a row owned by account A", async () => {
    // No `.select()` read-back (it would be hidden by the SELECT policy regardless
    // of WITH CHECK — L-002). profile_id is A's real profile and every other column
    // carries a legal value, so the ONLY possible rejection reason is the RLS WITH
    // CHECK — not an FK, NOT NULL, or CHECK-constraint violation.
    const { error } = await accountB.client.from("task_attempt").insert({
      account_id: accountA.id,
      profile_id: aProfileId,
      ...ATTEMPT,
      scenario: ON_BEHALF_PROBE,
    });
    expect(error).not.toBeNull();

    // Independently confirm via the service-role client that no such row exists.
    const { data: adminRows } = await admin
      .from("task_attempt")
      .select("id")
      .eq("account_id", accountA.id)
      .eq("scenario", ON_BEHALF_PROBE)
      .overrideTypes<Pick<TaskAttemptRow, "id">[], { merge: false }>();
    expect(adminRows).toHaveLength(0);

    // And that A still owns exactly the one seeded row (no on-behalf row leaked in).
    const { data: aRows } = await admin
      .from("task_attempt")
      .select("id")
      .eq("account_id", accountA.id)
      .overrideTypes<Pick<TaskAttemptRow, "id">[], { merge: false }>();
    expect(aRows).toHaveLength(1);
  });
});
