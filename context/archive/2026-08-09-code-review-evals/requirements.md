# Code review evals (promptfoo) — requirements (brainstorm note)

Closes the last gap of M5L3 (task 3) and turns the PR #19 false-positive question into a measured decision instead of a guess. Builds on `packages/code-reviewer/` (stage 1) and the live CI gate (stage 2). The change is eval-only: no behavior change to the agent or the workflow in this change — a prompt-rule fix, if the evals justify one, is a separate follow-up change.

## Goal

A promptfoo eval set that answers two questions with a results matrix, not intuition:

1. **Model choice**: does `claude-haiku-4-5` (current default) match `claude-sonnet-4-6` on our fixture verdicts, and at what cost difference? Decide the permanent `REVIEW_MODEL`.
2. **False-positive class (PR #19)**: does the criterion-6 rule "absence in the diff IS evidence" misfire on infra-setup diffs for both models, or only for Haiku? This decides whether the fix is a prompt edit or a model bump.

Secondary goal: the eval set becomes the standing regression gate for any future edit to `context/team/code-review-dod.md` or the system prompt (M5L3: "cicha regresja jakości").

## Test cases (fixtures from real history — no synthetic diffs needed)

Reuse the diffs already identified by `packages/code-reviewer/fixtures.ts` and the stage-2 acceptance evidence:

- `07da072` — known-bad config-class change → must **fail**, `configDeployment < 5`.
- `9ee3a49` — trivially clean one-line fix → must **pass**.
- PR #20 diff (`SUPABASE_KEY` → `SUPABASE_API_KEY` rename without sync) → must **fail**, criterion-6 blocker.
- PR #19 diff (gate-setup infra PR, the documented false positive; see `context/changes/ai-code-review-ci/evidence/pr19-false-positive-comment.md`) → desired verdict **pass**; current Haiku behavior is fail. Track this row as the false-positive indicator — whether it hard-fails the eval or is report-only is a design decision for the plan.
- `d6c93d8` (reversed) — env-var removal from CI → expected criterion-6 **fail** (report-only today in fixtures).
- `879315e` — borderline should-pass (service-role change that did sync `.env.example`) → **pass**.

Store fixture diffs as committed files (e.g. `packages/code-reviewer/evals/fixtures/*.diff`) generated once via `git show`/`git diff` — evals must not depend on git history being reachable at eval time.

## Mechanics (research decides the exact wiring)

- Two candidate wirings; research picks one and justifies it:
  a) promptfoo **providers = anthropic models** with our system prompt (rubric inlined via prompt file) — tests the prompt+model pair directly;
  b) promptfoo **custom/exec provider** wrapping `review.ts` — tests the whole CLI including diff filtering and `deriveVerdict`. Preference: (b) if promptfoo supports it cleanly, because that is what CI actually runs.
- Providers: `claude-haiku-4-5` vs `claude-sonnet-4-6` via `ANTHROPIC_API_KEY` (no OpenRouter — we sit on the Anthropic Console key).
- Assertions per case: valid JSON against the schema; `javascript` asserts on `verdict` and the relevant criterion scores; one `llm-rubric` assert only where verdict alone is not enough (e.g. PR #20: "the review names the env-var desynchronization concretely"). Keep llm-rubric usage minimal — it doubles token cost.
- Run locally via `npm run evals` inside `packages/code-reviewer`. CI integration of evals is parked.

## Budget

- Full sweep ≈ 6 cases × 2 models ≈ 12 review calls + a few llm-rubric judge calls. Estimate and print total cost; hard expectation: **< $1 per full sweep** (Haiku rows ≈ $0.01, Sonnet rows ≈ $0.05 each).
- Account balance context: ~$4 total — do not add more models or repeat-runs (`repeat: 1`).

## Deliverables / acceptance

1. `promptfooconfig.yaml` (+ fixtures dir + any wrapper script) committed under `packages/code-reviewer/`.
2. One full matrix run completed; results summarized in `context/changes/code-review-evals/results.md`: pass/fail per cell, cost per model, and an explicit recommendation — (a) keep Haiku or switch REVIEW_MODEL, (b) prompt-rule edit for the PR #19 class: yes/no, with the measured evidence.
3. The eval set runs green (except the PR #19 row if kept as report-only) so it can serve as the regression gate.

## Parked for later

- The actual prompt-rule edit for criterion 6 (separate change, gated by these evals)
- Running evals in CI (cost/trigger policy needed first)
- Third-party models via OpenRouter

## Constraints

- Do not modify `review.ts`, the system prompt, `code-review-dod.md`, or the CI workflow in this change (eval-only; a thin export/refactor in `review.ts` is acceptable ONLY if wiring (b) strictly requires it and behavior is proven unchanged).
- No secrets in the repo; `ANTHROPIC_API_KEY` from `.env` as today.
- Fixture diffs must not contain real secrets (check before committing).
