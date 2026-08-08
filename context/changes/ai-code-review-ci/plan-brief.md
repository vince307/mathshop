# AI Code Review in CI (stage 2) — Plan Brief

> Full plan: `context/changes/ai-code-review-ci/plan.md`
> Research: `context/changes/ai-code-review-ci/research.md`

## What & Why

Wire the stage-1 review agent (`packages/code-reviewer/`) into GitHub Actions as a merge gate on `main`. The Mom-Test validation showed review *exists* but is *unenforced* (5/5 recent merges landed with zero diff inspection; one 2h config-incident) — the missing piece is a non-skippable gate, so branch protection is part of the definition of done, not an afterthought.

## Starting Point

Stage 1 is done and archived: a side-effect-free CLI (`git diff` on stdin → JSON verdict on stdout, exit 0/1/2, ~$0.015/run on Haiku). The repo just went **public**, unblocking branch protection (previously 403 on Free+private). The `ANTHROPIC_API_KEY` Actions secret already exists; `ai-cr:*` labels don't; `ci.yml` has two required-check-shaped jobs (`ci`, `e2e`) and no composite actions yet.

## Desired End State

Every PR to `main` gets a red/green `review` check, one continuously-updated bot comment (scores, verdict, findings, cost), and an `ai-cr:passed`/`ai-cr:failed` label. Adding `ai-cr:review` re-runs on demand. Merging past a red review requires deliberate admin bypass. Three live acceptance PRs prove it and produce 10xChampion evidence.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Enforcement mechanism | Classic branch protection (`ci`, `e2e`, `review`) | One well-documented API call; adopt, don't rebuild | Plan (user) |
| How protection is applied | Committed `scripts/setup-review-gate.sh` via `gh api`, run once | Reproducible and reviewable; survives repo recreation | Plan (user) |
| Fork PRs (repo now public) | Skip the review job; manual-review policy | No secrets on forks, avoids fake exit-2 reds, honest about prompt-injection limit | Plan (user) |
| Label bootstrap | One-time creation in the setup script | Clean logs; missing-label is a once-ever problem | Plan (user) |
| Exit 2 (setup/budget error) | Red check, comment, **no label swap** | Preserves stage 1's "exit 2 is never a verdict" invariant | Plan (user) |
| Noise-only diff (exit 0, no JSON) | Minimal "nothing to review" pass comment | Every PR gets a consistent, explainable comment | Plan (user) |
| Review mechanics packaging | Local composite action `.github/actions/ai-reviewer/` | Keeps `review.yml` readable; extraction to standalone repo parked | Requirements |
| Side effects (comment, labels) | Workflow steps via preinstalled `gh` | Agent stays pure; no third-party actions → SHA-pinning moot | Requirements / Research |
| Check name | Bare job id `review`, no `name:` key | Matches `ci`/`e2e` convention; predictable required-check string | Research |
| Solo-repo protection payload | `required_pull_request_reviews: null`, `enforce_admins: false` | Author can't approve own PR (deadlock); admin bypass stays deliberate | Plan |

## Scope

**In scope:** `review.yml` (triggers, guards, concurrency, permissions), composite action, comment renderer script + fixture, comment upsert + label swap, setup script (labels + protection) run live, `.env.example` comment sync, three acceptance PRs + evidence.

**Out of scope:** touching `ci.yml` or the CLI contract; PR title/body context; promptfoo evals; triage/model laddering; standalone action repo; reviewing fork PRs; rulesets; broader stale-docs sweep.

## Architecture / Approach

`review.yml` (PR events on `main`, `ai-cr:review` retrigger, draft/fork/other-label guard, per-PR cancel-in-progress concurrency, `contents: read` + `pull-requests: write`) → composite action (setup-node, `npm --prefix` install, `git diff --no-color origin/base...HEAD` piped to the CLI, stdout/stderr/exit-code captured as outputs, never fails its own steps) → workflow side-effect steps (renderer script → upserted marker comment; verdict-mirroring label swap) → final gate step re-emits the exit code as the job result. Branch protection makes the check required.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Composite action + renderer | Locally-testable review mechanics + comment markdown | Stream/exit-code capture subtleties (cost is stderr-only) |
| 2. `review.yml` | Live gate; its own introducing PR is the first test | Trigger/guard logic (`labeled` filter, fork/draft skip) |
| 3. Enforcement + repo sync | Labels, branch protection live, `.env.example` synced | Solo-repo payload mistakes could deadlock merges |
| 4. Acceptance PRs | Red/green/retrigger scenarios + 10xChampion evidence | LLM verdict variance on the "bad" PR |

**Prerequisites:** repo public (done), `ANTHROPIC_API_KEY` secret (done), `gh` authenticated locally (done)
**Estimated effort:** ~2 sessions across 4 phases; API spend well under $1

## Open Risks & Assumptions

- The introducing PR (a criterion-6 CI edit) may itself get a red review — that's a legitimate first data point to read, not a bug.
- LLM verdict variance: the known-bad acceptance PR mirrors the criterion-6 score-1 anchor and the stage-1 fixture that reliably failed, but a flaky pass would mean re-tuning the test PR, not the gate.
- Skipped checks satisfy branch protection: fork PRs could merge un-reviewed — accepted, since a solo maintainer merges them by hand anyway.

## Success Criteria (Summary)

- Bad config-class PR → red `review` check, `ai-cr:failed`, comment naming criterion 6 with a concrete fix; merge box shows a failed required check
- Clean docs PR → green, `ai-cr:passed`, comment present, ~$0.01; merges through the protected path
- `ai-cr:review` label → fresh run that updates (not duplicates) the bot comment
