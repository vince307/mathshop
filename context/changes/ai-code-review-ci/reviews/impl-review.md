<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: AI Code Review in CI (stage 2)

- **Plan**: context/changes/ai-code-review-ci/plan.md
- **Scope**: Phases 1–4 of 4 (full plan)
- **Date**: 2026-08-08
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 6 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Success criteria: all automated criteria re-verified live during this review (renderer shapes 1.1–1.2, parity 1.3 via the noise-only path, protection contexts `["ci","e2e","review"]`, all three `ai-cr:*` labels, lint clean, PR #20 red + `ai-cr:failed`, PR #21 green + `ai-cr:passed` + merged, exactly one bot comment per PR). Manual criteria backed by the populated evidence folder. Side note: Vercel deployments failing on recent PRs — unrelated to this change (not a required check).

## Findings

### F1 — Draft-turned-ready PRs can merge without any review

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: .github/workflows/review.yml:12
- **Detail**: Trigger types are `[opened, synchronize, reopened, labeled]`. A PR opened as draft gets a *skipped* review check (`!draft` guard); marking it ready fires `ready_for_review`, which is not in the list, so nothing runs. A skipped check satisfies required status checks, so the PR can merge with zero AI review. The plan documented this as "acceptable" but understated the consequence — it's a silent hole in the gate, not a delayed review.
- **Fix**: Add `ready_for_review` to the trigger types; the existing `!draft` guard already makes the run correct. One-line plan addendum retiring the "acceptable behavior" note.
- **Decision**: FIXED (trigger type added, plan addendum recorded)

### F2 — Comment upsert has no author guard — spoofable

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: .github/workflows/review.yml:73-74
- **Detail**: The upsert finds "the" bot comment by body marker only. The repo is public: anyone who can comment can post a body starting with `<!-- ai-reviewer -->` (e.g. a fake "PASS"), and the next run will PATCH *their* comment and adopt it as canonical (`pull-requests: write` can edit others' comments).
- **Fix**: Add an author filter to the jq: `select(.user.login == "github-actions[bot]" and (.body | startswith("<!-- ai-reviewer -->")))`.
- **Decision**: FIXED (author filter added to upsert jq)

### F3 — Renderer crashes on malformed review.json

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: .github/scripts/render-review-comment.mjs:78
- **Detail**: `JSON.parse` is unguarded. A truncated/partial review.json throws — the comment step fails with a stack trace and the label-swap + verdict-gate steps are skipped. Red job, no comment explaining why — exactly the case the "could not run" shape was built for.
- **Fix**: Wrap the parse in try/catch and fall through to the existing exit-2 "could not run" rendering path.
- **Decision**: FIXED (couldNotRun helper extracted; parse failures route to it; verified with malformed JSON + fixture)

### F4 — Protection PUT silently resets unlisted settings on re-run

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: scripts/setup-review-gate.sh:37-44
- **Detail**: The REST PUT replaces the entire protection object. The header says "last-write-wins" but understates the blast radius: any protection setting added later outside this script (linear history, force-push blocks, extra contexts) is silently wiped by a re-run. "Idempotent" only holds while this script is the sole author of protection config.
- **Fix A ⭐ Recommended**: Fetch and print current protection before the PUT (404 fallback)
  - Strength: A re-run shows what it's about to clobber; script stays simple.
  - Tradeoff: Warns rather than prevents.
  - Confidence: HIGH — few lines, no gate behavior change.
  - Blind spot: None significant.
- **Fix B**: Merge contexts into the existing config instead of replacing
  - Strength: Structurally can't clobber later settings.
  - Tradeoff: Materially more jq complexity for a script that runs ~once; read-modify-write has its own races.
  - Confidence: MEDIUM.
  - Blind spot: GET/PUT payload shapes differ subtly.
- **Decision**: FIXED via Fix A (current protection printed before the PUT, 404 fallback)

### F5 — Step outputs interpolated via `${{ }}` in a run: block

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: .github/workflows/review.yml:69-72
- **Detail**: The renderer invocation splices `steps.review.outputs.*` directly into shell text — the canonical Actions injection shape. Values are self-controlled today, but the action also exports `cost-line`, derived from CLI stderr produced over the PR's diff. The safe `env:` pattern is already used two steps down.
- **Fix**: Pass the outputs through `env:` and reference `"$JSON_PATH"` etc., matching lines 87-89.
- **Decision**: FIXED (outputs routed through env: vars)

### F6 — Fence breakout in exit-2 comment from untrusted log tail

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: .github/scripts/render-review-comment.mjs:60-62
- **Detail**: The exit-2 shape embeds the last 8 stderr lines in a ``` fence; a diff-influenced line containing ``` escapes the fence and renders arbitrary markdown in the bot comment. Cosmetic spoofing only.
- **Fix**: Strip or indent-escape backtick fences from the log tail before embedding.
- **Decision**: FIXED (4-backtick outer fence + content backtick runs of 4+ capped at 3; verified with hostile log)

### F7 — Comment-lookup failure silently degrades to duplicates

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: .github/workflows/review.yml:73-74
- **Detail**: Workflow `run:` steps get `bash -e` without pipefail. If the `gh api --paginate` lookup dies mid-pipe, the pipeline exits 0 via the tail command, `comment_id` is empty, and the step POSTs a duplicate bot comment instead of failing.
- **Fix**: Add `set -o pipefail` to the upsert step.
- **Decision**: FIXED (pipe removed entirely — gh failure now fails the step under bash -e; first id taken in bash, avoiding head/SIGPIPE)

### F8 — Unplanned files: eslint ignore + .github/scripts/README.md

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: eslint.config.js:82, .github/scripts/README.md
- **Detail**: Neither is in the plan. Both justified: the type-checked root ESLint config would fail on the planned .mjs renderer, so `.github/scripts/**` was fenced like `packages/**`, and the README documents the rationale. Necessary consequence of a planned deliverable — the omission is on the plan's side.
- **Fix**: One-line plan addendum recording the fencing decision.
- **Decision**: FIXED (plan addendum added under Phase 1 Changes Required)

### F9 — Non-verdict failures partially conflated with a fail verdict

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: .github/actions/ai-reviewer/action.yml:5, .github/workflows/review.yml:85-97
- **Detail**: (a) action.yml claims it "never fails its own steps", but setup-node / npm ci failures do hard-fail it (overclaim only). (b) If the CLI *crashes* it exits 1 with no JSON — the renderer correctly shows "could not run" (defensive branch), but the label step keys on exit code alone and still swaps to `ai-cr:failed`, labeling a non-verdict as a verdict.
- **Fix**: Soften the action.yml comment; optionally gate the exit-1 label swap on review.json being non-empty.
- **Decision**: FIXED (doc claim corrected; label swap skips exit-1-without-JSON as a non-verdict)

### F10 — Minor divergences from CI house style

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: .github/workflows/review.yml, .github/scripts/README.md:11
- **Detail**: ci.yml names every non-trivial step; review.yml's steps are all unnamed. The README's stated bar for .github/scripts/ (`node --check`) is enforced nowhere in CI (ci.yml was frozen for this change — future work, not a miss). Everything else consistent; added permissions/concurrency/timeout are strictly tighter.
- **Fix**: Add `name:` keys to review.yml steps; park the `node --check` CI step for a future ci.yml change.
- **Decision**: FIXED (step names added: Remove ai-cr:review retry label / Run AI review / Upsert review comment / Swap verdict labels / Enforce verdict; node --check CI step parked as future ci.yml work)
