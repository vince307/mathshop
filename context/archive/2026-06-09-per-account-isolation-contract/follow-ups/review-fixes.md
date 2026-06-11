# Review Follow-ups — per-account-isolation-contract

Deferred items from the implementation review (2026-06-11). See `reviews/impl-review.md`.

## Deferred

- **F3 — Isolation tests share one mutable row.** When the isolation suite grows (a second owned-table test, or a test adding a second account-A row), refactor `tests/child-profiles-isolation.test.ts` to provision per-test rows (`beforeEach`) instead of the single `beforeAll` `aRowId`. Safe under the current `fileParallelism: false` config; no action needed until then.

## Open (from the plan, not this review)

- **3.5 — merge-blocking CI check.** Requires GitHub Pro or a public repo (Free + private returns 403 for branch protection and rulesets). The CI gate runs and reports on every PR but isn't enforced. Revisit on plan upgrade or repo-visibility change.
