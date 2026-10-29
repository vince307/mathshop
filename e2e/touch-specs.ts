/**
 * The specs that must run at a touch viewport — the single source of truth for
 * the `touch` Playwright project's `testMatch`.
 *
 * Extracted from `playwright.config.ts` so a unit test can assert on it:
 * dropping a name from the alternation does NOT turn a Playwright run red, it
 * quietly runs fewer tests and still exits 0. The run of 2026-08-27 proved that
 * empirically — removing `worlds` produced **27 passed, exit 0**, the only
 * signal being a hand-computed count
 * (`context/runs/2026-08-27-world-economy/run-log.md:353-361`). The guard that
 * closes it is `tests/e2e-touch-project.test.ts`.
 *
 * **Zero dependencies, deliberately.** No `@playwright/test` import, no env
 * access — `playwright.config.ts` runs `loadEnv` and throws on missing env at
 * import time, so the unit suite must be able to import this list without
 * dragging harness setup in. Keep it that way.
 */

/**
 * Spec base names (without `.spec.ts`) that run in the `touch` project.
 * EXTEND this array when adding one; never replace an entry.
 */
export const TOUCH_SPECS = ["gameplay-restore", "growth", "worlds", "marketing-worlds"] as const;

/**
 * Builds the `touch` project's `testMatch` from {@link TOUCH_SPECS}.
 *
 * **The anchoring is load-bearing.** This alternation used to be an unanchored
 * substring match, so `marketing-worlds.spec.ts` joined the project purely
 * because its name ENDS in `worlds.spec.ts` — coverage acquired by accident, and
 * silently lost to a rename. `(?:^|\/)` pins the filename to a path segment and
 * `$` pins the end, so a spec runs here because someone listed it and for no
 * other reason. `tests/e2e-touch-project.test.ts` asserts a near-miss
 * (`e2e/foo-growth.spec.ts`) is still rejected.
 */
export function touchTestMatch(): RegExp {
  return new RegExp(`(?:^|/)(${TOUCH_SPECS.join("|")})\\.spec\\.ts$`);
}
