import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, createSignedInUser, type TestAccount } from "./helpers/supabase";

/**
 * Cross-account data-isolation contract test for `account_settings` (S-07, L-001).
 *
 * Proves the RLS policies in
 * supabase/migrations/20260701160000_create_account_settings.sql isolate one
 * parent account from another — critically, one parent must never read or set
 * another's PIN. Each assertion maps 1:1 to one of the four per-operation
 * policies, acting as *signed-in users* (never the service-role client) so RLS is
 * genuinely exercised. Admin is used ONLY to provision users and confirm durable
 * state for INSERT-isolation (L-002 — no chained `.select()` read-back).
 *
 * Requires the local Supabase stack + `.env.test`.
 */

interface AccountSettingsRow {
  account_id: string;
  pin_hash: string;
  failed_attempts: number;
  locked_until: string | null;
}

describe("account_settings per-account isolation (RLS contract)", () => {
  let accountA: TestAccount;
  let accountB: TestAccount;
  let accountC: TestAccount; // a victim with NO row — the INSERT-on-behalf target (avoids PK conflict)

  beforeAll(async () => {
    accountA = await createSignedInUser("settings");
    accountB = await createSignedInUser("settings");
    accountC = await createSignedInUser("settings");

    // A owns its settings row (positive control for INSERT + SELECT).
    const { error } = await accountA.client
      .from("account_settings")
      .insert({ account_id: accountA.id, pin_hash: "seed-hash" });
    expect(error).toBeNull();
  });

  afterAll(async () => {
    if (accountA.id) await admin.auth.admin.deleteUser(accountA.id);
    if (accountB.id) await admin.auth.admin.deleteUser(accountB.id);
    if (accountC.id) await admin.auth.admin.deleteUser(accountC.id);
  });

  it("positive control: account A can read its own settings", async () => {
    const { data, error } = await accountA.client
      .from("account_settings")
      .select("*")
      .overrideTypes<AccountSettingsRow[], { merge: false }>();
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].account_id).toBe(accountA.id);
  });

  it("SELECT isolation: account B cannot see account A's PIN", async () => {
    const { data, error } = await accountB.client
      .from("account_settings")
      .select("*")
      .overrideTypes<AccountSettingsRow[], { merge: false }>();
    expect(error).toBeNull(); // RLS filters silently
    expect(data).toHaveLength(0);
  });

  it("UPDATE isolation: account B cannot modify account A's settings", async () => {
    const { data, error } = await accountB.client
      .from("account_settings")
      .update({ pin_hash: "hacked", failed_attempts: 99 })
      .eq("account_id", accountA.id)
      .select()
      .overrideTypes<AccountSettingsRow[], { merge: false }>();
    expect(error).toBeNull();
    expect(data).toHaveLength(0); // USING filtered the row out

    const { data: aData } = await accountA.client
      .from("account_settings")
      .select("pin_hash")
      .eq("account_id", accountA.id)
      .single()
      .overrideTypes<Pick<AccountSettingsRow, "pin_hash">, { merge: false }>();
    expect(aData?.pin_hash).toBe("seed-hash"); // unchanged
  });

  it("DELETE isolation: account B cannot delete account A's settings", async () => {
    const { data, error } = await accountB.client
      .from("account_settings")
      .delete()
      .eq("account_id", accountA.id)
      .select()
      .overrideTypes<AccountSettingsRow[], { merge: false }>();
    expect(error).toBeNull();
    expect(data).toHaveLength(0);

    const { data: aData } = await accountA.client
      .from("account_settings")
      .select("account_id")
      .eq("account_id", accountA.id)
      .overrideTypes<Pick<AccountSettingsRow, "account_id">[], { merge: false }>();
    expect(aData).toHaveLength(1); // still present
  });

  it("INSERT-on-behalf isolation: account B cannot set a PIN owned by account C", async () => {
    // Target C (which has NO row) so the ONLY possible rejection is the RLS WITH
    // CHECK — not a primary-key conflict (which would be a false green, L-002).
    const { error } = await accountB.client
      .from("account_settings")
      .insert({ account_id: accountC.id, pin_hash: "on-behalf" });
    expect(error).not.toBeNull();

    // Service-role confirmation that no row was actually written for C.
    const { data: cRows } = await admin
      .from("account_settings")
      .select("account_id")
      .eq("account_id", accountC.id)
      .overrideTypes<Pick<AccountSettingsRow, "account_id">[], { merge: false }>();
    expect(cRows).toHaveLength(0);
  });
});
