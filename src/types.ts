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

/**
 * Change-making scenarios. v1 (S-03) ships only `give_change` — give the
 * customer their change. Like `CountingScenario`, the value doubles as the i18n
 * content key (`t.task[scenario]`), so the type carries no literal copy.
 */
export type ChangeMakingScenario = "give_change";

/**
 * A single change-making-task instance: the child gives `change` (= `paid − price`)
 * by tapping 1-zł coins from a tray of `availableCount` coins (`availableCount > change`,
 * so the child must stop at the right number rather than tapping everything).
 */
export interface ChangeMakingTask {
  type: "change_making";
  scenario: ChangeMakingScenario;
  objectType: "coin";
  /** Amount the customer paid (zł), within the grades 1–2 band. */
  paid: number;
  /** Item price (zł); `price < paid`. */
  price: number;
  /** Correct answer: the change to give = `paid − price`, kept small for the age band. */
  change: number;
  /** Coins offered in the tray to give from; `> change` so tapping-all isn't auto-correct. */
  availableCount: number;
  /** Layout hint for the coin tray: ≤ 5 scattered; larger groups into rows of 5. */
  arrangement: "scatter" | "rows_of_5";
  difficultyTier: 1 | 2;
}

/**
 * Any procedurally-generated task. The `type` discriminant lets one page, one
 * shared interaction core, and (S-04) one shift hold either task without
 * reshaping consumers.
 */
export type Task = CountingTask | ChangeMakingTask;

/**
 * Persisted shop-customization state (S-06) held in `child_profiles.shop_state`
 * jsonb. v1 stores only the ids of purchased upgrades; art layers, capacity
 * effects, and progression are all derived from the catalog (`src/data/upgrades.ts`)
 * by id — the catalog is the single source of truth. Pre-S-06 rows default to
 * `{}` (no `purchased`); `readPurchased` normalizes a missing key to `[]`.
 */
export interface ShopState {
  purchased: string[];
}
