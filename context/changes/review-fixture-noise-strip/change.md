---
change_id: review-fixture-noise-strip
title: Strip committed eval fixture diffs from review input (fixtures-as-code false positive)
status: impl_reviewed
created: 2026-08-10
updated: 2026-08-24
archived_at: null
---

## Notes

PR #24 (the code-review-evals change) was blocked twice by the review gate — once per model — through a new false-positive class: **fixtures-as-code**. The committed `packages/code-reviewer/evals/fixtures/*.diff` files are inert test data (deliberately known-bad historical diffs), but a diff-only reviewer sees their content as live change:

- **Haiku** (`claude-haiku-4-5`, run 31420164043): criterion-6 blockers on three fixture files via "absence is evidence" — demanded env-var sync for variables that only exist inside the fixture diffs. Its own summary conceded "These are intentional test cases demonstrating known-bad patterns" and blocked anyway.
- **Sonnet** (`claude-sonnet-4-6`, run 31420676881): criterion-5 blocker — read the embedded parent-PIN `PARENT_SESSION_SECRET ?? ""` fail-open inside `07da072-parent-pin-config.diff` as "production code paths that ship with this PR."

Both models fooled, each via its strongest lens → the fix is mechanical, not prompt- or model-level: extend `isNoise` in `packages/code-reviewer/review.ts` to strip `packages/code-reviewer/evals/fixtures/**` (or `*.diff` paths generally — decide in plan) from review input, same class as the already-stripped `context/**`. Add a fixture/regression row proving it (L-002: prove the gate stops going red on this class). PR #24 landed via documented admin bypass (precedent: PR #19).

Constraint notes for the plan: `review.ts` was frozen during code-review-evals but is fair game here; keep the change tiny (one predicate + tests); consider whether `fixtures.ts`'s `3ba28eb` noise row pattern fits. Evidence: `evidence/pr24-haiku-review-comment.md`, `evidence/pr24-sonnet-review-comment.md`.
