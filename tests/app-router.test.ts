import { afterEach, describe, expect, it } from "vitest";
import { countChildProfiles, getMostRecentProfile, resolveLandingPath } from "@/lib/services/child-profiles";
import { admin, createSignedInUser, deleteUser, type TestAccount } from "./helpers/supabase";

/**
 * Profile-count router branch (S-01b). The `/app` page is a thin wrapper that
 * counts the parent's profiles (RLS-scoped) and redirects via
 * `resolveLandingPath`. This locks the load-bearing decision against regression:
 * the RLS-scoped count is exercised with a REAL signed-in client, and the path
 * mapping is asserted for 0 / 1 / 2 profiles. Requires the local stack + .env.test.
 */

let account: TestAccount | undefined;

/** Seed N profiles for an account via the service-role admin client (bypasses RLS). */
async function seedProfiles(accountId: string, n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    const { error } = await admin
      .from("child_profiles")
      .insert({ account_id: accountId, name: `Dziecko${i}`, age: 7, avatar: "kuba", theme: "kawiarnia" });
    if (error) throw error;
  }
}

afterEach(async () => {
  if (account?.id) await deleteUser(account.id);
  account = undefined;
});

describe("/app profile-count router", () => {
  it("0 profiles → /app/new-profile", async () => {
    account = await createSignedInUser("router");
    const count = await countChildProfiles(account.client);
    expect(count).toBe(0);
    expect(resolveLandingPath(count)).toBe("/app/new-profile");
  });

  it("1 profile → /app/start", async () => {
    account = await createSignedInUser("router");
    await seedProfiles(account.id, 1);
    const count = await countChildProfiles(account.client);
    expect(count).toBe(1);
    expect(resolveLandingPath(count)).toBe("/app/start");
  });

  it("2 profiles → /app/start (most-recent; picker is S-07)", async () => {
    account = await createSignedInUser("router");
    await seedProfiles(account.id, 2);
    const count = await countChildProfiles(account.client);
    expect(count).toBe(2);
    expect(resolveLandingPath(count)).toBe("/app/start");

    // The start screen loads *a* profile (RLS-scoped) — confirm one resolves.
    const profile = await getMostRecentProfile(account.client);
    expect(profile?.account_id).toBe(account.id);
  });
});
