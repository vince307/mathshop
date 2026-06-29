/**
 * Shared domain types. First module under the CLAUDE.md "shared types in
 * src/types.ts" convention. Kept dependency-free (no i18n / React / Supabase
 * imports) so it can be consumed from pure logic, `.astro` SSR frontmatter, and
 * React islands alike.
 */

/**
 * Consecutive wrong submissions before the scaffolding hint surfaces (FR-009:
 * "after 1–2 consecutive wrong attempts"). Shared by the counting island and
 * its tests so there's a single source of truth for the threshold.
 */
export const RETRY_HINT_THRESHOLD = 2;

/**
 * Counting-task scenarios. v1 (S-02) ships only `count_till` — counting the
 * coins in the till before opening. The value doubles as the i18n content key:
 * the island resolves prompt/question/success/hint from `t.task[scenario]`, so
 * this type carries no literal copy (FR-013 / L-003). S-04 adds more scenarios.
 */
export type CountingScenario = "count_till";

/**
 * A single procedurally-generated counting-task instance. The `type`
 * discriminant leaves room for S-03's change-making and S-04's shift mixer to
 * join the union without reshaping consumers.
 */
export interface CountingTask {
  type: "counting";
  scenario: CountingScenario;
  objectType: "coin";
  /** True number of objects shown = the correct answer. Clamped to the grades 1–2 band (≤ 20). */
  targetCount: number;
  /** Layout hint: ≤ 5 scattered; larger counts grouped into rows of 5 to aid subitizing. */
  arrangement: "scatter" | "rows_of_5";
  difficultyTier: 1 | 2;
}
