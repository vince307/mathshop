# Promptfoo Eval Set for the Code Review Agent — Plan Brief

> Full plan: `context/changes/code-review-evals/plan.md`
> Research: `context/changes/code-review-evals/research.md`

## What & Why

Build a promptfoo eval set that turns two open questions into measured answers: does `claude-haiku-4-5` match `claude-sonnet-4-6` on our fixture verdicts (deciding the permanent `REVIEW_MODEL`), and does the criterion-6 "absence is evidence" rule false-positive infra-setup diffs on both models or only Haiku (deciding whether the PR #19 fix is a prompt edit or a model bump)? The set then remains the standing regression gate for any future rubric or prompt edit.

## Starting Point

Stage 1 (`packages/code-reviewer/` CLI) and stage 2 (the live CI review gate) exist with a frozen contract. `fixtures.ts` seeds the fixture idea but regenerates diffs from git at run time — which already breaks for PR #20, whose commit is dangling. PR #19's false positive is documented evidence; no eval tooling exists yet.

## Desired End State

`npm run evals` inside `packages/code-reviewer` runs a 12-cell matrix (2 models × 6 committed fixture diffs) through the unchanged CLI for ~$0.25 and exits green. `results.md` in this change folder states, with numbers: keep or switch `REVIEW_MODEL`, and prompt-edit-yes/no for the PR #19 class.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Wiring | Custom JS provider wrapping the CLI (not `exec:`, not raw anthropic providers) | `exec:` can't pipe stdin and treats exit-1 verdicts as provider errors; the JS provider tests exactly what CI runs with zero `review.ts` changes | Research |
| Clean row | PR #21's diff replaces `9ee3a49` | `9ee3a49` strips to zero and never calls the model — a dead cell; PR #21 is a real merged clean control | Plan |
| PR #19 row | Report-only on both models | Gate runs green immediately while the matrix still answers the Haiku-vs-Sonnet question; assert flips to hard in the follow-up prompt-fix change | Plan |
| Reversed fixture header | Normalize at materialization | `git show -R` header parses as file `"unknown"`, hiding that it's a CI workflow file — the signal the criterion-6 row needs | Plan |
| llm-rubric judge | Haiku, pinned explicitly | The single rubric assert is simple; pinning avoids grader auto-selection reaching for a missing OpenAI key | Plan |
| promptfoo install | Exact-pinned devDependency (0.122.0) | Reproducible runs; grader/provider behavior can't shift under us; matches the package's lockfile convention | Plan |
| REVIEW_MODEL rule | Haiku stays unless Sonnet is strictly better | A 3–5× cost bump must earn itself: Sonnet must clear PR #19 AND match every other expected verdict | Plan |

## Scope

**In scope:** committed fixture diffs + generation script; `review-provider.mjs`; `promptfooconfig.yaml` + JSON schema; pinned promptfoo devDep + `npm run evals`; one full sweep; `results.md` + raw `evidence/results.json`.

**Out of scope:** any edit to `review.ts`/system prompt/`code-review-dod.md`/CI workflow; the criterion-6 prompt fix itself; evals in CI; OpenRouter models; fixing `pathFromHeader` for reversed diffs (separate bug change).

## Architecture / Approach

One ~40-line ESM provider class spawns the unchanged CLI (`tsx review.ts`), pipes the fixture diff to stdin, sets the model via `REVIEW_MODEL`, maps exit 0/1 → graded output and exit 2 → provider error, and parses the stderr cost line into promptfoo's cost totals. `promptfooconfig.yaml` declares two provider instances (Haiku/Sonnet) over six file-loaded diff vars; `defaultTest` carries the JSON-schema assert and the Anthropic grader pin; per-test JS asserts encode expected verdicts and criterion-6 thresholds.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Fixture materialization | Six committed `.diff` files + generation script (offline, $0) | PR #20's dangling commit vanishes before capture — do it first |
| 2. Provider + config | Working wiring proven by a ~$0.02 one-row smoke run | Provider/promptfoo interface mismatch — caught cheaply by the smoke cell |
| 3. Sweep + results.md | The 12-cell matrix, costs, and both recommendations | A model behaves unexpectedly on a hard row → gate red; budget caps at ~2 sweeps |

**Prerequisites:** `ANTHROPIC_API_KEY` in `.env` (~$4 balance); git objects for the fixture commits still present locally.
**Estimated effort:** 1–2 sessions across 3 phases; API spend ≈ $0.25–0.60 total.

## Open Risks & Assumptions

- PR #21's merge commit SHA still needs resolving in Phase 1 (verified trivial via `git log --merges` / `gh`).
- Assumed both models hard-fail `d6c93d8-R` (a real env-var removal); if one passes it, the gate goes red and that itself is decision-grade evidence for `results.md`.
- promptfoo 0.122.0 behavior verified from docs/source, not yet executed locally — the Phase 2 smoke run is the checkpoint.

## Success Criteria (Summary)

- One full matrix run completed under $1, evidence committed.
- `results.md` gives an explicit, rule-derived REVIEW_MODEL decision and prompt-rule-edit yes/no.
- `npm run evals` runs green and stands as the regression gate for future rubric/prompt edits.
