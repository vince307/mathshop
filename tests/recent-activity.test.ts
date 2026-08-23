import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listRecentActivity, type RecentActivityRow } from "@/lib/services/reports";

/**
 * `listRecentActivity` without a DB (F2). Pins the error contract and the query
 * SHAPE — newest-first, default limit 3, and the `profile_id` filter that is the
 * only thing separating siblings inside one account (RLS on `shift_log` is
 * account-scoped, so a dropped filter is a silent leak no policy can catch;
 * `tests/recent-activity-isolation.test.ts` proves it against a real database).
 *
 * The stub is local to this file on purpose: the one in `tests/reports.test.ts`
 * terminates its await on `.order`, so a `.limit()` query needs a different
 * shape, and generalising it would put the existing report suite at risk.
 */

interface RecordedCall {
  method: string;
  args: unknown[];
}

/**
 * A **thenable** chain stub: every method returns the chain, and the chain
 * itself resolves the seeded result — so the terminal call can be `.limit()`,
 * `.order()` or anything else without the stub caring.
 */
function stubClient(result: { data: RecentActivityRow[] | null; error: { message: string } | null }) {
  const calls: RecordedCall[] = [];
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return chain;
    };
  const chain = {
    select: record("select"),
    eq: record("eq"),
    order: record("order"),
    limit: record("limit"),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  };
  const client = { from: record("from") } as unknown as SupabaseClient;
  return { client, calls };
}

const ROW: RecentActivityRow = {
  id: "row-1",
  created_at: "2026-08-22T09:00:00.000Z",
  skills: { math: { completed: 2 } },
  upgrade_purchased: null,
};

describe("listRecentActivity error contract", () => {
  it("rejects when the query errors instead of reporting an empty feed", async () => {
    // "We could not load it" must never render as "you have not played yet".
    const { client } = stubClient({ data: null, error: { message: "boom" } });
    await expect(listRecentActivity(client, "p1")).rejects.toBeDefined();
  });

  it("returns the rows verbatim when the query succeeds", async () => {
    const { client } = stubClient({ data: [ROW], error: null });
    await expect(listRecentActivity(client, "p1")).resolves.toEqual([ROW]);
  });
});

describe("listRecentActivity query shape", () => {
  it("scopes to the profile, orders newest-first and defaults to a limit of 3", async () => {
    const { client, calls } = stubClient({ data: [], error: null });
    await listRecentActivity(client, "profile-a");

    expect(calls.find((call) => call.method === "from")?.args).toEqual(["shift_log"]);
    // The load-bearing filter — a leak inside one account if it goes missing.
    expect(calls.find((call) => call.method === "eq")?.args).toEqual(["profile_id", "profile-a"]);
    expect(calls.find((call) => call.method === "order")?.args).toEqual(["created_at", { ascending: false }]);
    expect(calls.find((call) => call.method === "limit")?.args).toEqual([3]);
    expect(String(calls.find((call) => call.method === "select")?.args[0])).toContain("id");
  });

  it("passes an explicit limit through", async () => {
    const { client, calls } = stubClient({ data: [], error: null });
    await listRecentActivity(client, "profile-a", 10);
    expect(calls.find((call) => call.method === "limit")?.args).toEqual([10]);
  });
});
