# AI Code Review in CI (stage 2) — requirements (brainstorm note)

Builds on the stage-1 agent in `packages/code-reviewer/` (done: `git diff` on stdin → JSON verdict on stdout, exit 0/1/2, rubric loaded from `context/team/code-review-dod.md`). Stage 2 wires that agent into GitHub Actions as a merge gate. Validated by `context/team/mom-test-validation.md` — the point of this stage is making review **non-skippable**, so branch protection is part of the definition of done, not an afterthought.

## Overall concept

- New workflow `.github/workflows/review.yml`, separate from the existing `ci.yml` (do not modify `ci` / `e2e` jobs).
- Triggers: `pull_request` (types: `opened`, `synchronize`, `reopened`, `labeled`) targeting `main`; label `ai-cr:review` acts as on-demand retry (run when that label is added, then remove it).
- Review mechanics wrapped as a **local composite action** `.github/actions/ai-reviewer/` (lesson M5L3 option 2) so `review.yml` stays a few readable lines; extraction to a standalone repo is parked.
- The job's exit code IS the gate: agent exits 1 on fail → check goes red. Exit 2 (setup error) must also fail the check but be distinguishable in logs.

## Inputs to the agent

- Diff: `git diff origin/${{ github.base_ref }}...HEAD` on the runner; requires `actions/checkout` with `fetch-depth: 0` (shallow checkout yields an empty diff — known M5L3 pitfall).
- Diff is passed via stdin exactly like locally — no divergence between local and CI invocation.
- PR title/body as additional context: **parked** (stage-1 CLI is diff-only; keep local/CI parity until promptfoo shows the context earns its tokens).

## Side effects (via `gh` in workflow steps, not inside the agent)

- One summary comment on the PR: scores table, verdict, findings, cost. **Upsert** (find and update a previous bot comment) instead of stacking a new comment per push.
- Labels: `ai-cr:passed` (green) / `ai-cr:failed` (red) — mutually exclusive, swap on each run.
- Agent stays side-effect-free (stdout JSON only); the workflow owns GitHub interactions. Moving side effects into agent tools is parked (M5L3 "drabina sprawczości").

## Secrets, permissions, security

- `ANTHROPIC_API_KEY` as a repository **Actions secret** (this resolves the stage-1 self-review finding: env var must be synced to CI; also update `.env.example` comment to reflect it).
- Workflow `permissions`: `contents: read`, `pull-requests: write` — nothing broader.
- Pin third-party actions to commit SHA (`@<sha>`), not moving tags (M5L3 security note). First-party `actions/*` may stay on major tags, consistent with existing `ci.yml`.
- Concurrency group per PR with `cancel-in-progress: true` — a new push cancels the stale review run (cost control).
- Do not run on draft PRs.

## Model & cost policy

- Default model: `claude-haiku-4-5` (stage-1 default); overridable via repo variable `REVIEW_MODEL` without code changes.
- Expected cost: ~$0.01–0.02 per PR run on Haiku (stage-1 measured: $0.0147 for a ~7-commit diff).
- Existing budget guard (4000 changed lines → exit 2) stays; an oversized PR fails the check with a clear "split this PR" message, which is the intended behavior for a review gate.

## Enforcement (part of DoD for this change)

- Branch protection on `main`: require status checks `ci`, `e2e`, and the review job before merge.
- Note: repo admin can still bypass — acceptable for solo; the gate's job is to make skipping a *deliberate* act instead of the default.

## Acceptance (also produces 10xChampion evidence)

1. Open a test PR with a deliberately bad config-class change (e.g. rename an env var without syncing `.env.example`/CI) → review check **red**, label `ai-cr:failed`, comment names criterion 6 with a concrete fix.
2. Open a trivially clean PR (docs typo) → check **green**, label `ai-cr:passed`, comment present, cost ≈ $0.01.
3. Add label `ai-cr:review` to re-run on demand → fresh run, updated (not duplicated) comment.
4. Screenshots: workflow view with jobs, review-job logs, LLM comment on the PR.

## Parked for later

- promptfoo eval set (separate change `code-review-evals`; fixtures.ts rows are the seed test cases)
- PR title/body as model context
- Plan-adherence review (`10x-impl-review-ci` skill)
- Triage step (size/path-based depth selection, cheap vs strong model)
- Extracting the composite action to a standalone repo for reuse

## Constraints

- Base branch: `main`. Do not touch `ci.yml`. No secrets in the repo. Keep `packages/code-reviewer` CLI contract unchanged (CI consumes it as-is).
