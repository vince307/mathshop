# Code review evals — results (Haiku vs Sonnet matrix)

**Date:** 2026-08-09 · **Config:** `packages/code-reviewer/evals/promptfooconfig.yaml` (promptfoo 0.120.27, temperature 0, repeat 1)
**Evidence:** `evidence/results.json` (final green sweep, eval ID `eval-*-2026-08-09T21:08`), `evidence/results-sweep1.json` (first sweep, pre-adaptation asserts)
**Verdict stability:** every cell's verdict was identical across both full sweeps.

## The matrix

| Fixture | Expected | Haiku 4.5 | Sonnet 4.6 |
| --- | --- | --- | --- |
| `07da072` known-bad config-class (parent-PIN) | fail | **fail** · c6=3 ✓ | **fail** · c6=5, via 2× criterion-5 blockers (security=2) ✓ |
| `879315e` borderline should-pass (synced `.env.example`) | pass | **pass** · c6=5 ✓ | **pass** · c6=8 ✓ |
| PR #21 clean docs-typo control | pass | **pass** · c6=10 ✓ | **pass** · c6=7 ✓ |
| `d6c93d8-R` env var removed from CI | fail (criterion 6) | **fail** · c6=3 ✓ | **fail** · c6=3 ✓ |
| PR #20 `SUPABASE_KEY` rename without sync | fail + criterion-6 finding | **fail** · c6=2, blocker ✓ | **fail** · c6=3, major ✓ |
| **PR #19 gate-setup infra PR (false-positive row, report-only; desired pass)** | pass | **fail** · c6=4 ✗ false positive persists | **pass** · c6=9 ✓ clears it |

llm-rubric (PR #20 names the desync concretely): PASS on both models.

## Cost & latency (final sweep)

| | Haiku 4.5 | Sonnet 4.6 |
| --- | --- | --- |
| Review cost, 6 fixtures | $0.060 (~$0.010/review) | $0.159 (~$0.026/review) |
| Summed latency | 52.5s | 66.7s |

Full-sweep total (12 review calls + 2 Haiku-graded rubric calls): **≈ $0.22** — comfortably under the $1 budget. Whole-change spend incl. 3 smoke runs and both sweeps: ≈ $0.51.

## Question 1 — REVIEW_MODEL

Agreed decision rule: *Haiku stays unless Sonnet both clears PR #19 AND matches every other row's expected verdict; cost is reported, vetoing only if a sweep breaks $1.*

- Sonnet clears PR #19: **yes** (pass, configDeployment=9 — it recognized the referenced files live outside the diff).
- Sonnet matches every other expected verdict: **yes** (5/5).
- Cost: ~$0.026/review vs ~$0.010 — 2.6× on measured cells, both negligible per PR; sweep stays far under $1.

**Recommendation: switch `REVIEW_MODEL` to `claude-sonnet-4-6`.** Operationally this is setting the `REVIEW_MODEL` repository variable (the workflow already forwards it — `action.yml:66-70`); the CLI default and `review.ts` stay untouched. Follow-up note: `fixtures.ts`' hard assertion (`07da072` → `configDeployment < 5`) is Haiku-calibrated and runs on the CLI default, so it stays valid as long as the *default* remains Haiku.

## Question 2 — the PR #19 false-positive class

The criterion-6 "absence in the diff IS evidence" rule misfires **only on Haiku**. Sonnet distinguishes PR #19 (sync already on `main`, untouched) from PR #20 (sync genuinely missing) — the exact discrimination Haiku cannot make (its PR #19 c6=4 rests on "file X is not in this diff" findings).

**Recommendation: no prompt-rule edit required.** The model bump fixes the measured class. The parked criterion-6 prompt edit remains optional hardening (e.g. for cost-driven reversion to Haiku), gated on this eval set as planned.

## Measured calibration differences (asserted as verdicts, recorded as scores)

Two adaptations were made to the assertion design during the run, both preserving hard verdict expectations:

1. **PR #20 severity**: Haiku files the env-var desync as `blocker`, Sonnet as `major`; `deriveVerdict` fails the diff on the score threshold either way. The assert requires a criterion-6 finding, records severity.
2. **`07da072` criterion attribution**: Haiku scores the defect under criterion 6 (c6=3); Sonnet files the same parent-PIN defect as two criterion-5 blockers (security=2, c6=5). The `c6 < 5` threshold is hard on Haiku (mirrors `fixtures.ts`), recorded on Sonnet.

## Regression-gate status

The eval set runs **green (12/12, 0 errors)** with PR #19 as the designed report-only row. It now stands as the regression gate for any edit to `context/team/code-review-dod.md` or the system prompt. When the model switch (or a future prompt edit) lands, flip the PR #19 assert from report-only to hard-pass in that change.
