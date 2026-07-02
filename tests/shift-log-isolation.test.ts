import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, createSignedInUser, type TestAccount } from "./helpers/supabase";

/**
 * Cross-account data-isolation contract test for `shift_log` (S-07, L-001).
 *
 * Proves the RLS policies in
 * supabase/migrations/20260701150000_create_shift_log.sql actually isolate one
 * parent account from another. Account B must never SELECT, UPDATE, DELETE, or
 * INSERT-on-behalf-of account A's shift_log rows; account A sees its own.
 *
 * Mirrors tests/child-profiles-isolation.test.ts: each assertion maps 1:1 to one
 * of the four per-operation policies, acting as *signed-in users* (never the
 * service-role client) so RLS is genuinely exercised. Admin is used ONLY to
 * provision/tear down users and to confirm durable state for INSERT-isolation
 * (L-002 — no chained `.select()` read-back).
 *
 * Requires the local Supabase stack + `.env.test`.
 */

interface ShiftLogRow {
  id: string;
  account_id: string;
  profile_id: string;
  created_at: string;
  skills: Record<string, unknown>;
  upgrade_purchased: string | null;
}

/** A math-heavy shift delta — the shape the write path stores. */
const SKILLS = { math: { firstTryCorrect: 2, completed: 3, misses: 1 } };

describe("shift_log per-account isolation (RLS contract)", () => {
  let accountA: TestAccount;
  let accountB: TestAccount;
  let aProfileId: string;
  let aRowId: string;

  beforeAll(async () => {
    accountA = await createSignedInUser("shiftlog");
    accountB = await createSignedInUser("shiftlog");

    // A owns a profile (FK target) and one shift_log row (positive control).
    const { data: profile } = await accountA.client
      .from("child_profiles")
      .insert({ account_id: accountA.id, avatar: "lis", name: "Ala", age: 7 })
      .select("id")
      .single()
      .overrideTypes<{ id: string }, { merge: false }>();
    if (!profile) throw new Error("account A profile insert returned no row");
    aProfileId = profile.id;

    const { data: row, error } = await accountA.client
      .from("shift_log")
      .insert({ account_id: accountA.id, profile_id: aProfileId, skills: SKILLS })
      .select()
      .overrideTypes<ShiftLogRow[], { merge: false }>();
    expect(error).toBeNull();
    if (!row || row.length === 0) throw new Error("account A shift_log insert returned no row");
    aRowId = row[0].id;
  });

  afterAll(async () => {
    if (accountA.id) await admin.auth.admin.deleteUser(accountA.id);
    if (accountB.id) await admin.auth.admin.deleteUser(accountB.id);
  });

  it("positive control: account A can read its own row", async () => {
    const { data, error } = await accountA.client
      .from("shift_log")
      .select("*")
      .overrideTypes<ShiftLogRow[], { merge: false }>();
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].id).toBe(aRowId);
    expect(data?.[0].account_id).toBe(accountA.id);
  });

  it("SELECT isolation: account B cannot see account A's row", async () => {
    const { data, error } = await accountB.client
      .from("shift_log")
      .select("*")
      .overrideTypes<ShiftLogRow[], { merge: false }>();
    expect(error).toBeNull(); // RLS filters silently — not an error
    expect(data).toHaveLength(0);
  });

  it("UPDATE isolation: account B cannot modify account A's row", async () => {
    const { data, error } = await accountB.client
      .from("shift_log")
      .update({ upgrade_purchased: "sign" })
      .eq("id", aRowId)
      .select()
      .overrideTypes<ShiftLogRow[], { merge: false }>();
    expect(error).toBeNull();
    expect(data).toHaveLength(0); // USING filtered the row out — no rows affected

    const { data: aData } = await accountA.client
      .from("shift_log")
      .select("upgrade_purchased")
      .eq("id", aRowId)
      .single()
      .overrideTypes<Pick<ShiftLogRow, "upgrade_purchased">, { merge: false }>();
    expect(aData?.upgrade_purchased).toBeNull(); // unchanged
  });

  it("DELETE isolation: account B cannot delete account A's row", async () => {
    const { data, error } = await accountB.client
      .from("shift_log")
      .delete()
      .eq("id", aRowId)
      .select()
      .overrideTypes<ShiftLogRow[], { merge: false }>();
    expect(error).toBeNull();
    expect(data).toHaveLength(0);

    const { data: aData } = await accountA.client
      .from("shift_log")
      .select("id")
      .eq("id", aRowId)
      .overrideTypes<Pick<ShiftLogRow, "id">[], { merge: false }>();
    expect(aData).toHaveLength(1); // still present
  });

  it("INSERT-on-behalf isolation: account B cannot insert a row owned by account A", async () => {
    // No `.select()` read-back (it would be hidden by the SELECT policy regardless
    // of WITH CHECK — L-002). profile_id is A's real profile so the ONLY possible
    // rejection reason is the RLS WITH CHECK, not an FK/NOT NULL violation.
    const { error } = await accountB.client
      .from("shift_log")
      .insert({ account_id: accountA.id, profile_id: aProfileId, skills: SKILLS });
    expect(error).not.toBeNull();

    // Independently confirm via the service-role client that no such row exists.
    const { data: adminRows } = await admin
      .from("shift_log")
      .select("id")
      .eq("account_id", accountA.id)
      .eq("upgrade_purchased", "__on_behalf_probe__")
      .overrideTypes<Pick<ShiftLogRow, "id">[], { merge: false }>();
    expect(adminRows).toHaveLength(0);

    // And that A still owns exactly the one seeded row (no on-behalf row leaked in).
    const { data: aRows } = await admin
      .from("shift_log")
      .select("id")
      .eq("account_id", accountA.id)
      .overrideTypes<Pick<ShiftLogRow, "id">[], { merge: false }>();
    expect(aRows).toHaveLength(1);
  });
});
