import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, createSignedInUser, type TestAccount } from "./helpers/supabase";
import { listRecentActivity } from "@/lib/services/reports";

/**
 * **Intra-account** isolation for the dashboard activity feed (F2).
 *
 * This suite exists because RLS on `shift_log` is *account*-scoped: all four
 * policies are `auth.uid() = account_id`, nothing predicates on `profile_id`.
 * So with two children on one account, BOTH children's rows are legitimately
 * readable by that one signed-in client, and the app-side
 * `.eq("profile_id", …)` in `listRecentActivity` is the ONLY thing keeping a
 * sibling's shifts out of this child's feed. No policy can catch its absence,
 * and neither `tests/shift-log-isolation.test.ts` (table-level RLS) nor
 * `tests/report-isolation.test.ts` (cross-account) goes red when it is dropped —
 * both stay green. This one does.
 *
 * Account B is seeded with its own profile AND its own row on purpose: without
 * a row of its own, the cross-account case would return `[]` whether or not the
 * filter existed, certifying nothing about it while looking like it might.
 *
 * Admin is used ONLY to provision and tear down users (L-001 / L-002).
 * Requires the local Supabase stack + `.env.test`.
 */

const SHIFT_SKILLS = { math: { firstTryCorrect: 2, completed: 3, misses: 1 } };

/** Insert a child profile through the account's OWN client (never admin). */
async function seedProfile(account: TestAccount, name: string): Promise<string> {
  const { data } = await account.client
    .from("child_profiles")
    .insert({ account_id: account.id, avatar: "lis", name, age: 7 })
    .select("id")
    .single()
    .overrideTypes<{ id: string }, { merge: false }>();
  if (!data) throw new Error(`profile insert for ${name} returned no row`);
  return data.id;
}

/** Insert one `shift_log` row through the account's OWN client and return its id. */
async function seedShiftRow(account: TestAccount, profileId: string, upgrade: string | null): Promise<string> {
  const { data } = await account.client
    .from("shift_log")
    .insert({
      account_id: account.id,
      profile_id: profileId,
      skills: SHIFT_SKILLS,
      upgrade_purchased: upgrade,
    })
    .select("id")
    .single()
    .overrideTypes<{ id: string }, { merge: false }>();
  if (!data) throw new Error(`shift_log insert for ${profileId} returned no row`);
  return data.id;
}

describe("recent-activity feed isolation (F2)", () => {
  let accountA: TestAccount;
  let accountB: TestAccount;
  let profileA1: string;
  let profileA2: string;
  let profileB1: string;
  let rowA1: string;
  let rowA2: string;

  beforeAll(async () => {
    accountA = await createSignedInUser("activity");
    accountB = await createSignedInUser("activity");

    // TWO siblings on ONE account — the shape RLS cannot separate.
    profileA1 = await seedProfile(accountA, "Ania");
    profileA2 = await seedProfile(accountA, "Bartek");
    rowA1 = await seedShiftRow(accountA, profileA1, null);
    rowA2 = await seedShiftRow(accountA, profileA2, "sign");

    // Account B has data of its own, so the cross-account case has something to leak.
    profileB1 = await seedProfile(accountB, "Celina");
    await seedShiftRow(accountB, profileB1, null);
  });

  afterAll(async () => {
    if (accountA.id) await admin.auth.admin.deleteUser(accountA.id);
    if (accountB.id) await admin.auth.admin.deleteUser(accountB.id);
  });

  it("positive control: the feed returns exactly the queried child's own row", async () => {
    const rows = await listRecentActivity(accountA.client, profileA1);
    expect(rows).toHaveLength(1);
    // Assert the identity, not just the count — two same-shaped rows must not satisfy this.
    expect(rows[0].id).toBe(rowA1);
  });

  it("never leaks a SIBLING's row, even though RLS lets this client read it", async () => {
    // The regression guard: drop `.eq("profile_id", …)` and this returns both
    // rows on the account. RLS is account-scoped and stays silent.
    const rows = await listRecentActivity(accountA.client, profileA1);
    expect(rows.map((row) => row.id)).not.toContain(rowA2);
  });

  it("a sibling's own feed returns only the sibling's row", async () => {
    const rows = await listRecentActivity(accountA.client, profileA2);
    expect(rows.map((row) => row.id)).toEqual([rowA2]);
  });

  it("a non-owner probing another account's profile id reads nothing", async () => {
    const rows = await listRecentActivity(accountB.client, profileA1);
    expect(rows).toEqual([]);
  });
});
