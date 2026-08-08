# AI Code Review in CI (stage 2) — Implementation Plan

## Overview

Wire the stage-1 review agent (`packages/code-reviewer/`) into GitHub Actions as a non-skippable merge gate: a new `review.yml` workflow calls the repo's first local composite action (`.github/actions/ai-reviewer/`), workflow steps own all GitHub side effects (upserted PR comment, `ai-cr:*` labels) via `gh`, and classic branch protection on `main` requires `ci`, `e2e`, and `review`. The CLI contract is consumed as-is; `ci.yml` is not modified.

## Current State Analysis

From `context/changes/ai-code-review-ci/research.md` (commit `8aceb3c`):

- **CLI is CI-ready unchanged**: stdin diff → stdout JSON `{scores, findings, verdict, summary}` → exit 0/1/2. Install `npm --prefix packages/code-reviewer ci`; run `npx --prefix packages/code-reviewer tsx packages/code-reviewer/review.ts`. Node ≥22 (`packages/code-reviewer/package.json:6-8`), tsx-run, not a workspace. Rubric resolution is file-relative — cwd-safe (`review.ts:31-34`).
- **Edge cases the workflow must own**: noise-only diff → exit 0 with **no stdout JSON** (`review.ts:167-170`); empty stdin → exit 2 (`review.ts:149-151`); cost only on stderr (`Tokens: <in> in / <out> out | Cost: $X.XXXX | Time: Ns`, `review.ts:234-238`); ANSI-colored diff headers → exit 2 (use `--no-color`, precedent `fixtures.ts:83-87`).
- **CI house style** (`.github/workflows/ci.yml`): check names are bare job ids (`ci`, `e2e` — no `name:` keys); `actions/checkout@v4` + `actions/setup-node@v4` with `node-version: 22`, `cache: npm`; no `permissions:`/`concurrency:`/`timeout-minutes:` anywhere (adding them is an improvement, not a deviation). No `.github/actions/` exists — this is the repo's first composite action.
- **Live GitHub state**: repo `vince307/mathshop` is now **public** (branch protection unblocked — the stage-1 403 blocker is resolved); `ANTHROPIC_API_KEY` Actions secret exists (2026-08-08); no `ai-cr:*` labels; no repo variables.
- **Stage-1 bindings**: exit 1 exclusively means "code failed review" (archive `plan.md:56`); prompt-injection via diff is an inherent, documented LLM-review limit; fork-PR secret exposure was flagged in `archive change.md:16`.

## Desired End State

Every PR targeting `main` gets an automatic AI review: a red/green `review` check, one continuously-updated bot comment (scores table, verdict, findings, cost), and an `ai-cr:passed`/`ai-cr:failed` label. Adding `ai-cr:review` re-runs the review on demand. Branch protection makes `ci`, `e2e`, and `review` required — merging with a red review is a deliberate admin act, not the default. Verified by three live acceptance PRs (bad config change → red with criterion-6 finding; docs typo → green at ~$0.01; label → refreshed comment, not duplicated).

### Key Discoveries:

- The PR that introduces `review.yml` will itself trigger the workflow (pull_request runs use the PR merge ref's workflow file) — the gate self-tests on its own introducing PR, which is itself a criterion-6 "CI workflow edit".
- A job-level `if:` that evaluates false produces a **skipped** check run, and skipped conclusions **satisfy** required status checks — so draft/fork/other-label skips can never deadlock a merge (drafts can't merge anyway; fork PRs fall to the documented manual-review policy).
- `gh` CLI is preinstalled on `ubuntu-latest` runners and authenticates via `GH_TOKEN` — no third-party actions are needed anywhere, so the SHA-pinning rule has nothing to bite on.
- Solo-repo constraint: `required_pull_request_reviews` must be **null** in branch protection — the author can't approve their own PR, so requiring approvals would deadlock every merge.

## What We're NOT Doing

- Modifying `ci.yml` or the `packages/code-reviewer` CLI contract (both frozen by requirements)
- PR title/body as model context; promptfoo evals (`code-review-evals`); triage/model-laddering; extracting the action to a standalone repo; moving side effects into agent tools (all parked)
- Reviewing fork PRs (skipped by policy — no secrets, prompt-injection limit documented; maintainer reviews fork PRs by hand)
- Repository rulesets (classic branch protection chosen)
- The broader stale-docs sweep parked in the stage-1 archive — only the `.env.example` comment is updated here
- `REVIEW_MODEL` repo variable creation (CLI default `claude-haiku-4-5` stands; the wiring supports the variable when it's ever set)

## Implementation Approach

Four phases, each landing on `main` before the next depends on it: (1) the composite action + comment renderer as pure, locally-testable pieces; (2) the workflow that composes them and owns side effects — its introducing PR is the first live test; (3) the committed enforcement script (labels + branch protection) run once against the live repo, plus the `.env.example` sync; (4) the three acceptance PRs producing 10xChampion evidence.

The action never fails its own steps: it captures the CLI exit code as an output so the comment/label steps always run; a final workflow step re-emits the code as the job's verdict. Exit 1 and exit 2 both fail the check, but logs, the comment, and labels keep them distinguishable (exit 2 never swaps labels — it is not a code verdict).

## Critical Implementation Details

- **Exit-code capture ordering**: the CLI invocation must run under `set +e` (or `continue-on-error` semantics) with stdout and stderr captured to separate files (`review.json` / `review.log`) — cost lives only on stderr, and the JSON may legitimately be empty (noise-only pass). The job's failure comes from a dedicated final gate step, after side effects.
- **Unset repo variable becomes empty string**: `${{ vars.REVIEW_MODEL }}` renders as `""` when unset. An empty `REVIEW_MODEL` in the environment could reach the CLI as a real (empty) model id. Guard in bash: export `REVIEW_MODEL` only when the input is non-empty; otherwise leave it undefined so the CLI default applies.
- **`ai-cr:review` label removal must be unconditional and early** (before the review runs or `if: always()`): if it's removed only on success, a failing run leaves the label attached and the retry trigger dead (re-adding an already-present label fires no `labeled` event).
- **`labeled` events fire for every label**: the job-level `if:` must pass `labeled` events only when `github.event.label.name == 'ai-cr:review'`; adding e.g. a `roadmap` label produces a skipped run, which is harmless (skipped satisfies required checks).
- **setup-node cache keying**: use `cache: npm` with `cache-dependency-path: packages/code-reviewer/package-lock.json` — the root lockfile would miss sub-package dependency changes.

## Phase 1: Composite action + comment renderer

### Overview

Create `.github/actions/ai-reviewer/` — the review mechanics (Node setup, package install, diff, CLI run, output capture) — and the comment-rendering script, both testable without a workflow run.

### Changes Required:

#### 1. Composite action

**File**: `.github/actions/ai-reviewer/action.yml`

**Intent**: Encapsulate everything between "checkout done" and "verdict known" so `review.yml` stays a few readable lines. The action assumes the caller checked out with `fetch-depth: 0` and passes the base ref; it performs Node setup and package install itself.

**Contract**: Inputs: `base-ref` (required), `model` (optional — exported as `REVIEW_MODEL` only when non-empty), `anthropic-api-key` (required — passed to the CLI step's env). Outputs: `exit-code` (raw CLI code: 0/1/2), `json-path` and `log-path` (files under `$RUNNER_TEMP`), `cost-line` (the greppable `Tokens: ...` stderr line, may be empty). Steps: `actions/setup-node@v4` (node 22, npm cache keyed on `packages/code-reviewer/package-lock.json`) → `npm --prefix packages/code-reviewer ci` → the review step. The review step is the one non-obvious piece:

```bash
set +e
git diff --no-color "origin/${BASE_REF}...HEAD" \
  | npx --prefix packages/code-reviewer tsx packages/code-reviewer/review.ts \
  1>"$RUNNER_TEMP/review.json" 2>"$RUNNER_TEMP/review.log"
code=$?
set -e
cat "$RUNNER_TEMP/review.log"   # progress + cost visible in the step log
echo "exit-code=$code" >> "$GITHUB_OUTPUT"
```

An empty diff (possible after merges/reverts) is short-circuited before invoking the CLI: emit `exit-code=0` with empty JSON, matching the noise-only pass shape. The step itself always succeeds; exit 2 is annotated in the log (`::notice::exit 2 = setup/budget error, not a code verdict`) but enforcement is the workflow's job.

#### 2. Comment renderer

**File**: `.github/scripts/render-review-comment.mjs`

**Intent**: Turn the action's outputs into the PR comment body — deterministic, dependency-free Node (≥22), testable locally against a fixture JSON. Keeps `review.yml` free of markdown-assembly noise.

**Contract**: Args: path to `review.json`, path to `review.log`, exit code. Stdout: markdown beginning with the upsert marker `<!-- ai-reviewer -->`. Three shapes: (a) exit 0/1 with JSON — verdict headline (✅/❌), six-criterion scores table, findings list (`file:line`, criterion, severity, description, suggested fix), summary, cost line + model; (b) exit 0 without JSON — minimal "nothing to review after noise stripping" pass note; (c) exit 2 — "setup/budget error — not a code verdict" plus the relevant stderr message (this is how the 4000-line "split this PR" message reaches the author). All copy in English (bot surface, not app UI — FR-013 does not apply).

#### 3. Renderer fixture

**File**: `.github/scripts/render-review-comment.fixture.json`

**Intent**: A sample CLI output (schema per `packages/code-reviewer/schema.ts:17-60`) used to exercise the renderer locally and in Phase 1 verification. Not consumed at runtime.

**Contract**: Valid `{scores, findings, verdict, summary}` JSON with at least one finding including `suggestedFix`.

### Success Criteria:

#### Automated Verification:

- Renderer syntax-checks: `node --check .github/scripts/render-review-comment.mjs`
- Renderer produces all three shapes: run it against the fixture (exit 0), against an empty file with exit 0, and against an empty JSON + a log containing a budget-error line with exit 2; each output starts with `<!-- ai-reviewer -->` and matches its shape
- Local parity check (spends ~$0.01): `git diff --no-color main~1...main | npx --prefix packages/code-reviewer tsx packages/code-reviewer/review.ts` exits 0/1 and emits JSON the renderer accepts end-to-end

#### Manual Verification:

- `action.yml` reads as a reviewable contract: inputs/outputs documented, no secrets echoed to logs

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: `review.yml` workflow

### Overview

The workflow that composes the action and owns all GitHub side effects. Its own introducing PR is the first live run of the gate.

### Changes Required:

#### 1. Review workflow

**File**: `.github/workflows/review.yml`

**Intent**: PR-triggered review gate targeting `main`, with on-demand retry via the `ai-cr:review` label, per-PR concurrency with cancellation, least-privilege permissions, and the job id `review` (no `name:` key — the check string must be exactly `review`, matching the `ci`/`e2e` convention).

**Contract**: Triggers: `pull_request` types `[opened, synchronize, reopened, labeled]`, `branches: [main]`. `permissions: contents: read, pull-requests: write`. `concurrency: group: review-${{ github.event.pull_request.number }}, cancel-in-progress: true`. Single job `review` on `ubuntu-latest` with `timeout-minutes: 10` and the three-part guard (the one non-obvious block):

```yaml
if: >-
  (github.event.action != 'labeled' || github.event.label.name == 'ai-cr:review') &&
  !github.event.pull_request.draft &&
  github.event.pull_request.head.repo.full_name == github.repository
```

Steps, in order: `actions/checkout@v4` with `fetch-depth: 0` → remove `ai-cr:review` label when the trigger was `labeled` (idempotent, `|| true`, so the retry mechanism re-arms even if this run fails) → `uses: ./.github/actions/ai-reviewer` with `base-ref: ${{ github.base_ref }}`, `model: ${{ vars.REVIEW_MODEL }}`, `anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}` → comment upsert → label swap → verdict gate. `GH_TOKEN: ${{ github.token }}` on the `gh` steps.

#### 2. Comment upsert step (inside review.yml)

**Intent**: One bot comment per PR, updated in place — find the existing comment by the `<!-- ai-reviewer -->` marker, PATCH it if found, POST otherwise. Runs for every exit code (the exit-2 shape carries the "split this PR" budget message).

**Contract**: `gh api repos/${{ github.repository }}/issues/<PR>/comments --paginate` filtered with `--jq` on the marker prefix → comment id or empty; body from `node .github/scripts/render-review-comment.mjs <json> <log> <code>`.

#### 3. Label swap + verdict gate steps (inside review.yml)

**Intent**: Mutually exclusive labels that mirror the *verdict* — exit 0 → add `ai-cr:passed`, remove `ai-cr:failed`; exit 1 → the reverse; **exit 2 → no label change** (setup errors are not verdicts; the red check + comment carry the signal). The final gate step turns the captured exit code into the job result with distinguishable log annotations (`::error::AI review failed (verdict: fail)` vs `::error::Review could not run (setup/budget error, exit 2) — see the PR comment`).

**Contract**: Label operations idempotent (`|| true` on removals). Gate: `exit ${{ steps.review.outputs.exit-code }}` semantics — job fails on 1 and 2, passes on 0.

### Success Criteria:

#### Automated Verification:

- Workflow YAML is accepted by GitHub: pushing the branch and opening the PR produces a `review` check run (not a workflow-parse error in the Actions tab)
- The introducing PR's own review run completes: check concludes (green or red — this PR is a criterion-6 CI edit, so red with findings is a legitimate outcome to read, not a bug)

#### Manual Verification:

- Bot comment appears on the introducing PR with scores table, verdict, findings, cost; pushing a follow-up commit updates the same comment (no duplicate)
- Label matches the verdict; Actions log shows the exit-code annotation
- A draft PR (flip to draft briefly) produces a skipped run, not a red one

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 3: Enforcement script + repo sync

### Overview

Make the gate non-skippable: committed, re-runnable setup script (labels + classic branch protection), executed once against the live repo; sync the `.env.example` comment.

### Changes Required:

#### 1. Setup script

**File**: `scripts/setup-review-gate.sh`

**Intent**: The reproducible record of the enforcement config — labels and branch protection survive repo recreation by re-running one script. Idempotent (`gh label create --force`; protection PUT is naturally last-write-wins).

**Contract**: Creates labels `ai-cr:review` (#0075ca, "Re-run the AI review"), `ai-cr:passed` (#1a7f37), `ai-cr:failed` (#d73a4a) — colors matching the existing `ready`/`bug` palette. Then the protection call; the payload is the load-bearing part (solo-repo constraints):

```bash
gh api -X PUT "repos/$REPO/branches/main/protection" --input - <<'JSON'
{
  "required_status_checks": { "strict": false, "contexts": ["ci", "e2e", "review"] },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null
}
JSON
```

`required_pull_request_reviews: null` — a solo author can't approve their own PR (requiring reviews deadlocks every merge). `enforce_admins: false` — admin bypass stays possible and deliberate, per requirements. `strict: false` — no update-branch-before-merge friction for a solo flow.

#### 2. Env docs sync

**File**: `.env.example`

**Intent**: Close the stage-1 self-review loop — the comment currently says the key "powers ONLY the local code-review agent"; it now also powers the CI gate via the repository Actions secret. The key must still never enter `astro.config.mjs` `env.schema` (archive `plan.md:97`).

**Contract**: Comment-only edit on lines 16-19; the `ANTHROPIC_API_KEY=###` line itself is unchanged.

### Success Criteria:

#### Automated Verification:

- `bash scripts/setup-review-gate.sh` exits 0 (run it — this is the one-time live application)
- `gh api repos/vince307/mathshop/branches/main/protection --jq '.required_status_checks.contexts'` returns exactly `["ci","e2e","review"]`
- `gh label list --search ai-cr` shows all three labels
- `npm run lint` passes (script is outside lint scope, but confirms nothing regressed)

#### Manual Verification:

- GitHub Settings → Branches shows the rule on `main`; the merge box on an open PR shows all three required checks

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 4: Acceptance on live PRs (10xChampion evidence)

### Overview

The three scenario PRs from requirements, run against the finished gate; screenshots captured as evidence.

### Changes Required:

#### 1. Known-bad PR (never merged)

**Branch**: `test/ai-cr-bad-config`

**Intent**: A deliberately bad config-class change — rename an env var in `astro.config.mjs`'s `env.schema` (e.g. `SUPABASE_KEY` → `SUPABASE_API_KEY`) *without* syncing `.env.example` or CI — the literal criterion-6 score-1 anchor. Expect: `review` check red, `ai-cr:failed`, comment naming criterion 6 with a concrete fix. PR is closed unmerged; the branch never touches `main`.

**Contract**: The change must be plausible-looking (not a comment saying "this is bad") so the review is honest.

#### 2. Clean PR (merged — first real gated merge)

**Branch**: `test/ai-cr-clean-docs`

**Intent**: A trivial docs typo fix (e.g. README wording). Expect: check green, `ai-cr:passed`, comment present, cost ≈ $0.01. Merging it exercises the full protected-merge path.

#### 3. Label retrigger

**Intent**: Add `ai-cr:review` to one of the open test PRs. Expect: fresh run, label auto-removed, the existing comment updated (same comment id — verify via timestamp "edited", not a second comment).

#### 4. Evidence capture

**Location**: `context/changes/ai-code-review-ci/evidence/`

**Intent**: Screenshots per requirements: workflow view with jobs, review-job logs (incl. the cost line), the LLM comment on both PRs, the blocked-merge box on the bad PR.

### Success Criteria:

#### Automated Verification:

- Bad PR: `gh pr checks <N>` shows `review` failing; `gh pr view <N> --json labels` contains `ai-cr:failed`
- Clean PR: `gh pr checks <N>` shows all three green; labels contain `ai-cr:passed`; merged successfully
- Retrigger: `gh api .../issues/<N>/comments` shows exactly one bot comment (marker match count = 1) after the label run

#### Manual Verification:

- Bad-PR comment names criterion 6 with a concrete, actionable fix
- Clean-PR cost line ≈ $0.01–0.02
- Bad PR's merge box shows "Required check failed" (screenshot)
- Evidence folder populated (workflow view, logs, comments)

---

## Testing Strategy

### Unit Tests:

- The renderer is the only unit-testable piece: exercise its three shapes locally (fixture JSON / empty-JSON pass / exit-2 log). No test-runner wiring — plain `node` invocations recorded in Phase 1 criteria (the repo has no root test scope for `.github/`, and adding one is out of scope).

### Integration Tests:

- The live PRs *are* the integration tests (Phases 2 & 4) — the gate is validated against the real GitHub event surface (opened, synchronize, labeled, draft) rather than mocks.

### Manual Testing Steps:

1. Phase 2 PR: verify comment upsert across two pushes (one comment, edited)
2. Flip the Phase 2 PR to draft and back: skipped run appears, then a real run on ready-for-review… (note: `ready_for_review` is not a trigger type — a push or `ai-cr:review` label re-runs it; acceptable, documented behavior)
3. Phase 4 scenarios as listed

## Performance Considerations

Review job runs in parallel with `ci`/`e2e` and needs no Supabase/Docker — expected wall time ~1–2 min (checkout + npm ci + one Haiku call). `concurrency.cancel-in-progress` caps cost on rapid pushes; `timeout-minutes: 10` bounds runaway runs. Expected spend ~$0.01–0.02 per run (stage-1 measured $0.0147).

## Migration Notes

No data or code migration. Rollback = delete `review.yml` (check disappears) and drop `review` from the protection contexts (`scripts/setup-review-gate.sh` edited + re-run, or one `gh api` PUT). Existing open PRs simply gain the check on their next push or `ai-cr:review` label.

## References

- Requirements: `context/changes/ai-code-review-ci/requirements.md`
- Research: `context/changes/ai-code-review-ci/research.md`
- Stage-1 archive: `context/archive/2026-08-08-ai-code-review/` (CLI contract decisions, impl-review F1–F7)
- Rubric: `context/team/code-review-dod.md` (criterion 6 = acceptance anchor)
- CLI contract: `packages/code-reviewer/review.ts:17-19` (exit codes), `schema.ts:17-71` (JSON shape)
- CI house style: `.github/workflows/ci.yml:10-18`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Composite action + comment renderer

#### Automated

- [x] 1.1 Renderer syntax-checks (`node --check`) — fbd56c8
- [x] 1.2 Renderer produces all three shapes (fixture / empty-JSON pass / exit-2) — fbd56c8
- [x] 1.3 Local parity check: real diff through CLI + renderer end-to-end — fbd56c8

#### Manual

- [x] 1.4 `action.yml` contract review (inputs/outputs documented, no secret leakage) — fbd56c8

### Phase 2: `review.yml` workflow

#### Automated

- [x] 2.1 Introducing PR produces a `review` check run (no workflow-parse error) — abc23d3
- [x] 2.2 Introducing PR's review run completes with a readable verdict — abc23d3

#### Manual

- [x] 2.3 Comment upserts across pushes (one comment, edited) — abc23d3
- [x] 2.4 Label matches verdict; exit-code annotation visible in logs — abc23d3
- [x] 2.5 Draft PR produces a skipped run — abc23d3

### Phase 3: Enforcement script + repo sync

#### Automated

- [x] 3.1 `scripts/setup-review-gate.sh` runs clean against the live repo
- [x] 3.2 Protection contexts verify as `["ci","e2e","review"]`
- [x] 3.3 All three `ai-cr:*` labels exist
- [x] 3.4 `npm run lint` passes

#### Manual

- [ ] 3.5 Settings → Branches shows the rule; PR merge box lists three required checks

### Phase 4: Acceptance on live PRs

#### Automated

- [ ] 4.1 Bad PR: `review` red + `ai-cr:failed`
- [ ] 4.2 Clean PR: all green + `ai-cr:passed` + merged
- [ ] 4.3 Retrigger: exactly one bot comment after label run

#### Manual

- [ ] 4.4 Bad-PR comment names criterion 6 with concrete fix
- [ ] 4.5 Clean-PR cost ≈ $0.01–0.02
- [ ] 4.6 Blocked-merge box screenshot on bad PR
- [ ] 4.7 Evidence folder populated
