import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, createSignedInUser, type TestAccount } from "./helpers/supabase";

/**
 * Cross-account data-isolation contract test (Foundation F-01).
 *
 * Proves the RLS policies in
 * supabase/migrations/20260609120000_child_profiles_isolation.sql actually
 * isolate one parent account from another. Account B must never be able to
 * SELECT, UPDATE, DELETE, or INSERT-on-behalf-of account A's child_profiles
 * rows; account A must see its own.
 *
 * Each assertion maps 1:1 to one of the four per-operation policies. The test
 * acts as *signed-in users* for every assertion — never the service-role
 * client — so RLS is genuinely exercised (auth.uid() is non-null). The
 * service-role admin client is used ONLY to provision and tear down the two
 * test users. Provisioning helpers live in `tests/helpers/supabase.ts`.
 *
 * Requires the local Supabase stack (`npx supabase start` + `npx supabase db
 * reset`) and `.env.test` (see .env.test.example).
 */

// Row shape mirrors the child_profiles columns from the migration. Query
// results are typed via `.overrideTypes<..., { merge: false }>()` rather than a full generated
// `Database` type (regenerate with `supabase gen types` once S-01 consumes it).
interface ChildProfileRow {
  id: string;
  account_id: string;
  avatar: string;
  theme: string;
  created_at: string;
  updated_at: string;
}

describe("child_profiles per-account isolation (RLS contract)", () => {
  let accountA: TestAccount;
  let accountB: TestAccount;
  let aRowId: string;

  beforeAll(async () => {
    accountA = await createSignedInUser("isolation");
    accountB = await createSignedInUser("isolation");

    // Account A creates a profile it owns (positive control for INSERT + SELECT).
    const { data, error } = await accountA.client
      .from("child_profiles")
      .insert({ account_id: accountA.id, avatar: "lis" })
      .select()
      .overrideTypes<ChildProfileRow[], { merge: false }>();
    expect(error).toBeNull();
    if (!data || data.length === 0) throw new Error("account A insert returned no row");
    aRowId = data[0].id;
  });

  afterAll(async () => {
    // ON DELETE CASCADE removes each account's child_profiles rows.
    if (accountA.id) await admin.auth.admin.deleteUser(accountA.id);
    if (accountB.id) await admin.auth.admin.deleteUser(accountB.id);
  });

  it("positive control: account A can read its own row", async () => {
    const { data, error } = await accountA.client
      .from("child_profiles")
      .select("*")
      .overrideTypes<ChildProfileRow[], { merge: false }>();
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    if (!data) throw new Error("account A read returned no data");
    expect(data[0].id).toBe(aRowId);
    expect(data[0].account_id).toBe(accountA.id);
  });

  it("SELECT isolation: account B cannot see account A's row", async () => {
    const { data, error } = await accountB.client
      .from("child_profiles")
      .select("*")
      .overrideTypes<ChildProfileRow[], { merge: false }>();
    expect(error).toBeNull(); // RLS filters silently — not an error
    expect(data).toHaveLength(0);
  });

  it("UPDATE isolation: account B cannot modify account A's row", async () => {
    const { data, error } = await accountB.client
      .from("child_profiles")
      .update({ avatar: "wilk" })
      .eq("id", aRowId)
      .select()
      .overrideTypes<ChildProfileRow[], { merge: false }>();
    // RLS USING filters the row out: no rows affected, no error.
    expect(error).toBeNull();
    expect(data).toHaveLength(0);

    // A re-reads: avatar must be unchanged.
    const { data: aData } = await accountA.client
      .from("child_profiles")
      .select("avatar")
      .eq("id", aRowId)
      .single()
      .overrideTypes<Pick<ChildProfileRow, "avatar">, { merge: false }>();
    expect(aData?.avatar).toBe("lis");
  });

  it("DELETE isolation: account B cannot delete account A's row", async () => {
    const { data, error } = await accountB.client
      .from("child_profiles")
      .delete()
      .eq("id", aRowId)
      .select()
      .overrideTypes<ChildProfileRow[], { merge: false }>();
    expect(error).toBeNull();
    expect(data).toHaveLength(0);

    // A's row still present.
    const { data: aData } = await accountA.client
      .from("child_profiles")
      .select("id")
      .eq("id", aRowId)
      .overrideTypes<Pick<ChildProfileRow, "id">[], { merge: false }>();
    expect(aData).toHaveLength(1);
  });

  it("INSERT-on-behalf isolation: account B cannot insert a row owned by account A", async () => {
    // No `.select()` here on purpose: a read-back would be hidden by the SELECT
    // policy regardless of the INSERT WITH CHECK, so chaining it would conflate
    // the two policies and let a broken WITH CHECK pass silently.
    const { error } = await accountB.client.from("child_profiles").insert({ account_id: accountA.id, avatar: "kot" });
    // The WITH CHECK predicate must reject the on-behalf insert outright.
    expect(error).not.toBeNull();

    // Independently confirm via the service-role client (bypasses RLS) that no
    // such row was actually written. This is what truly proves the INSERT
    // policy — not the client-visible error.
    const { data: adminRows } = await admin
      .from("child_profiles")
      .select("id")
      .eq("account_id", accountA.id)
      .eq("avatar", "kot")
      .overrideTypes<Pick<ChildProfileRow, "id">[], { merge: false }>();
    expect(adminRows).toHaveLength(0);
  });
});
