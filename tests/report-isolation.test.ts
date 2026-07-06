import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, createSignedInUser, type TestAccount } from "./helpers/supabase";
import { getWeeklyReport } from "@/lib/services/reports";
import { listChildProfiles } from "@/lib/services/child-profiles";
import { readSkillState } from "@/data/skills";

/**
 * Cross-account isolation for the parent weekly-report READ PATH (S-09, FR-016).
 *
 * The table-level RLS contracts are pinned by tests/shift-log-isolation.test.ts
 * and tests/child-profiles-isolation.test.ts; this suite re-exercises them
 * through the surface the PRD names — `getWeeklyReport` and the profile listing
 * the report route composes — acting as *signed-in users* so a policy
 * regression surfaces exactly where a parent would read another family's data.
 * Admin is used ONLY to provision/tear down users (L-001/L-002 conventions).
 *
 * Requires the local Supabase stack + `.env.test`.
 */

/** A math-heavy current-week shift delta, seeded through A's own client. */
const SKILLS = { math: { firstTryCorrect: 2, completed: 3, misses: 1 } };

describe("weekly-report read-path isolation (S-09)", () => {
  let accountA: TestAccount;
  let accountB: TestAccount;
  let aProfileId: string;

  beforeAll(async () => {
    accountA = await createSignedInUser("report");
    accountB = await createSignedInUser("report");

    const { data: profile } = await accountA.client
      .from("child_profiles")
      .insert({ account_id: accountA.id, avatar: "lis", name: "Ala", age: 7 })
      .select("id")
      .single()
      .overrideTypes<{ id: string }, { merge: false }>();
    if (!profile) throw new Error("account A profile insert returned no row");
    aProfileId = profile.id;

    // One current-week row (created_at defaults to now — inside any week window).
    const { error } = await accountA.client
      .from("shift_log")
      .insert({ account_id: accountA.id, profile_id: aProfileId, skills: SKILLS, upgrade_purchased: "sign" });
    expect(error).toBeNull();
  });

  afterAll(async () => {
    if (accountA.id) await admin.auth.admin.deleteUser(accountA.id);
    if (accountB.id) await admin.auth.admin.deleteUser(accountB.id);
  });

  it("positive control: the owner's report reflects the seeded week", async () => {
    const report = await getWeeklyReport(accountA.client, aProfileId);
    expect(report.practice.math).toEqual(SKILLS.math);
    expect(report.upgrades.map((upgrade) => upgrade.upgradeId)).toEqual(["sign"]);
  });

  it("a non-owner probing the profile id reads an empty report, never A's data", async () => {
    // RLS hides the rows — the read path resolves to the zeroed report rather
    // than erroring, and must never surface another account's practice.
    const report = await getWeeklyReport(accountB.client, aProfileId);
    expect(report.practice).toEqual(readSkillState(null));
    expect(report.upgrades).toEqual([]);
  });

  it("the report route's profile listing never includes another account's child", async () => {
    const profiles = await listChildProfiles(accountB.client);
    expect(profiles.map((profile) => profile.id)).not.toContain(aProfileId);
    expect(profiles).toHaveLength(0);
  });
});
