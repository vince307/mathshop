import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The production `migrate matmaverse` command (ariom-infra) rejects any migration file containing a backslash.
// Catch it in the PR instead of in the deploy job after the merge.
const dir = join(process.cwd(), "supabase", "migrations");

describe("supabase/migrations", () => {
  it("has no file containing a backslash", () => {
    const offenders = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .filter((f) => readFileSync(join(dir, f), "utf8").includes("\\"));
    expect(offenders).toEqual([]);
  });

  it("names every file <14 digits>_<name>.sql", () => {
    const bad = readdirSync(dir).filter((f) => !/^\d{14}_[a-z0-9_]+\.sql$/.test(f));
    expect(bad).toEqual([]);
  });
});
