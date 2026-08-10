# Promptfoo Eval Set for the Code Review Agent — Implementation Plan

## Overview

Build a promptfoo eval set under `packages/code-reviewer/evals/` that runs six committed fixture diffs through the **unchanged** `review.ts` CLI on both `claude-haiku-4-5` and `claude-sonnet-4-6`, then writes `context/changes/code-review-evals/results.md` with two measured recommendations: (a) the permanent `REVIEW_MODEL`, and (b) whether the PR #19 false-positive class needs a prompt-rule edit or a model bump. The eval set then remains as the standing regression gate for any future edit to `context/team/code-review-dod.md` or the system prompt.

## Current State Analysis

- `packages/code-reviewer/` (stage 1) is a frozen-contract CLI: diff on stdin, JSON verdict on stdout, exit 0/1/2 (`review.ts:17-19`). Model resolves `--model` → `REVIEW_MODEL` env → `claude-haiku-4-5` default (`review.ts:143`) — the eval provider's hook, no code change needed.
- `fixtures.ts` regenerates diffs from git history at run time — exactly what breaks for PR #20, whose head commit `21f30b53` is **dangling** (unreachable from every ref; one `git gc --prune` deletes it).
- The CI gate (stage 2) runs Haiku on every PR; PR #19 documented the false-positive class (criterion-6 "absence is evidence" firing on an infra-setup diff whose sync counterpart already lived on `main`), PR #20/#21 documented the true positive and clean control.
- `packages/code-reviewer/evals/` does not exist. ESLint ignores `packages/**` (`eslint.config.js:80`), Prettier skips `.diff`, `.gitignore` has no conflicting patterns.
- promptfoo research (see `research.md`) ruled out the `exec:` provider (prompt passed as argv, never stdin; non-zero exit → provider error, so exit-1 "fail" verdicts would never reach assertions) and confirmed the custom JS provider path, verified against promptfoo **0.122.0**.

## Desired End State

- `packages/code-reviewer/evals/` contains: `fixtures/*.diff` (6 committed diffs), `generate-fixtures.mjs`, `review-provider.mjs`, `promptfooconfig.yaml`, and a `review-schema.json` for the `is-json` assert.
- `npm run evals` inside `packages/code-reviewer` runs the full 12-cell matrix (2 providers × 6 tests) for ≈ $0.20–0.35 and exits green (PR #19 row is report-only by design).
- `context/changes/code-review-evals/results.md` holds the matrix, per-model cost, and both recommendations; raw promptfoo output committed under `context/changes/code-review-evals/evidence/`.

Verify: `npm --prefix packages/code-reviewer run evals` completes green; `results.md` exists with an explicit REVIEW_MODEL decision and a yes/no on the prompt-rule edit.

### Key Discoveries (from `research.md`):

- `exec:` provider disqualified; custom JS provider (`file://review-provider.mjs`) is the wiring — per-provider `config: { model }` → `REVIEW_MODEL` env var (`review.ts:143`).
- `9ee3a49` post-strips to zero and exits 0 **without an API call** (`review.ts:167-170`) — replaced by PR #21's diff as the clean row (decision).
- `git show -R` emits a swapped header that `pathFromHeader` (`review.ts:43-56`) parses as `"unknown"` — normalize at fixture materialization (decision).
- PR #20's commit `21f30b536c5ae3e9ba134d637cace6cd11f2812f` is dangling — materialize first, before anything else.
- llm-rubric grader auto-selection must be pinned to an Anthropic model (no OpenAI key); custom JS providers are **not cached** by promptfoo, so every run spends real dollars.
- Spawn pattern for the CLI already proven in `fixtures.ts:95`: `process.execPath --import tsx review.ts` with `cwd` = package dir.
- Secret scan of all fixture diffs: clean (two documented dummy `PARENT_SESSION_SECRET` values already public on `main`).

## What We're NOT Doing

- No changes to `review.ts`, `schema.ts`, the system prompt, `context/team/code-review-dod.md`, or `.github/workflows/review.yml` (eval-only constraint; the wiring needs none).
- No prompt-rule edit for criterion 6 — that's the follow-up change these evals gate.
- No `pathFromHeader` fix for reversed headers — filed as a candidate separate bug change; the fixture normalization sidesteps it here.
- No CI integration of evals, no OpenRouter/third-party models, no `repeat > 1`, no provider-side caching layer.
- Not keeping `9ee3a49` or `3ba28eb` as eval rows — the pre-filter/noise-strip paths stay covered by `fixtures.ts`, which remains untouched and in place.

## Implementation Approach

Three phases: (1) materialize fixtures offline (no API spend) — urgent for the dangling PR #20 commit; (2) build the provider + promptfoo config and prove it on one cheap smoke cell; (3) run the full matrix once and write `results.md`. All new files live under `packages/code-reviewer/evals/`; the results narrative lives in this change folder. Decisions already made: PR #21 replaces `9ee3a49` as the clean row; PR #19 is report-only on both models; reversed header normalized at materialization; Haiku judges the single llm-rubric assert; promptfoo pinned as an exact devDependency; REVIEW_MODEL decision rule = "Haiku stays unless Sonnet is strictly better" (Sonnet must clear PR #19 AND match every other row's expected verdict; cost reported, vetoes only if a sweep breaks $1).

## Critical Implementation Details

- **PR #20 first.** `21f30b536c5ae3e9ba134d637cace6cd11f2812f` survives only as a loose object. Materializing its `.diff` is the first action of Phase 1 — before any other git operation that could trigger a gc.
- **PR #21's merge commit is not yet resolved.** Find it via `git log --merges --oneline --grep "#21"` (or `gh pr view 21 --json mergeCommit`), then `git diff --no-color <merge>^1...<merge>^2`. Verify the diff is the docs-typo change (1 file, ~2 lines) before committing it as the clean fixture.
- **Reversed-header normalization** (d6c93d8 fixture): rewrite the three header lines of the `-R` output to canonical orientation (`diff --git a/X b/X`, `--- a/X`, `+++ b/X`) inside `generate-fixtures.mjs`, with a comment documenting the transform. Everything else stays byte-exact.
- **Exit-code mapping in the provider**: exit 0 and 1 are both *valid outputs* (resolve with `output: stdout`, `metadata: { exitCode }`); exit 2 resolves with `{ error }` so infra failures show as errored cells, never as graded verdicts — mirroring `review.yml`'s label semantics.
- **Cost totals**: parse the CLI's stderr line `Tokens: N in / M out | Cost: $X` (`review.ts:234-238`) into `tokenUsage`/`cost` on the ProviderResponse so promptfoo's summary prints real spend.
- **Grader pin**: `defaultTest.options.provider: anthropic:messages:claude-haiku-4-5` — without it, a promptfoo version change could re-route grading to a missing OpenAI key.
- **Full SHAs everywhere** in `generate-fixtures.mjs` (7-char SHAs were a stage-2 hardening note).

## Phase 1: Fixture Materialization

### Overview

Commit the six eval diffs as static files so evals never depend on reachable git history, with PR #20 rescued from its dangling commit and the reversed fixture's header normalized.

### Changes Required:

#### 1. Fixture generation script

**File**: `packages/code-reviewer/evals/generate-fixtures.mjs`

**Intent**: One-shot, re-runnable Node ESM script (no deps) that regenerates all six `.diff` files from git and applies the documented header normalization for the reversed fixture. It documents provenance; the committed `.diff` files are the source of truth afterward.

**Contract**: Emits exactly these files under `evals/fixtures/`, using full 40-char SHAs and `--no-color --format=`:

| File | Source | Expected verdict (per requirements) |
|---|---|---|
| `07da072-parent-pin-config.diff` | `git show 07da072…` (full SHA) | fail, `configDeployment < 5` |
| `879315e-account-deletion-synced.diff` | `git show 879315e…` | pass |
| `d6c93d8-R-env-var-removed-from-ci.diff` | `git show -R d6c93d8…` + header normalization | fail (criterion 6) |
| `pr19-gate-setup.diff` | `git diff 6ab9b76419c089aa708daa082cf955a10741a2ea^1...^2` | desired pass (report-only) |
| `pr20-supabase-key-rename.diff` | `git show 21f30b536c5ae3e9ba134d637cace6cd11f2812f` | fail, criterion-6 blocker |
| `pr21-clean-docs.diff` | `git diff <pr21-merge>^1...^2` (resolve merge SHA first) | pass |

If a source object is missing (e.g. PR #20's commit pruned on another clone), the script reports it and leaves the committed file untouched rather than failing the world — fixtures outlive their git sources.

### Success Criteria:

#### Automated Verification:

- All six `.diff` files exist under `packages/code-reviewer/evals/fixtures/` and each contains at least one `diff --git` header
- Re-running `node evals/generate-fixtures.mjs` is idempotent (no file changes on second run)
- Normalized reversed fixture carries the real path: `grep -q 'a/.github/workflows/ci.yml' evals/fixtures/d6c93d8-R-*.diff`
- Secret scan clean: grep for `eyJ`, `sk-ant-`, `sb_secret`, `ghp_`, `github_pat_`, `AKIA`, `BEGIN.*PRIVATE KEY` over `evals/fixtures/` returns no hits

#### Manual Verification:

- Line counts roughly match research's table (07da072 ≈ 884 raw, PR #19 ≈ 149, PR #20 ≈ 57, etc.) and PR #21's diff is the expected docs-typo change

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Provider + Promptfoo Config

### Overview

The custom JS provider wrapping the CLI, the promptfoo config encoding the matrix and assertions, the pinned dependency, and a one-cell smoke run proving the wiring end-to-end for ~$0.02.

### Changes Required:

#### 1. Custom provider

**File**: `packages/code-reviewer/evals/review-provider.mjs`

**Intent**: ~40-line ESM class wrapping the CLI: pipes the rendered prompt (the diff) to stdin, selects the model per provider instance, maps exit codes, and reports cost.

**Contract**: Default-export class with `id()` and `async callApi(prompt)`. Constructor gets `{ id, config }`; `config.model` is passed to the child as `REVIEW_MODEL`. Spawns `process.execPath --import tsx review.ts` with `cwd` = the package dir (pattern: `fixtures.ts:95`). Exit 0/1 → `{ output: stdout, tokenUsage, cost, metadata: { exitCode } }`; exit 2 → `{ error: <stderr tail> }`. `tokenUsage`/`cost` parsed from the stderr `Tokens:` line.

#### 2. Promptfoo config + output schema

**File**: `packages/code-reviewer/evals/promptfooconfig.yaml`

**Intent**: Encode the 2×6 matrix and all assertions; this file is the regression gate's definition.

**Contract**:
- `prompts: ['{{diff}}']`; two providers referencing `file://./review-provider.mjs` with labels `haiku-4-5` / `sonnet-4-6` and `config: { model: … }`.
- `defaultTest`: `is-json` against `file://review-schema.json`, plus `options.provider: anthropic:messages:claude-haiku-4-5` (grader pin).
- Per-test `javascript` asserts on `JSON.parse(output)`:
  - `07da072`: `verdict === 'fail' && scores.configDeployment < 5`
  - `879315e`: `verdict === 'pass'`
  - `pr21`: `verdict === 'pass'`
  - `d6c93d8-R`: `verdict === 'fail' && scores.configDeployment < 5`
  - `pr20`: `verdict === 'fail'` and a criterion-6 blocker finding exists; plus the single `llm-rubric` assert: "names the env-var desynchronization (SUPABASE_KEY → SUPABASE_API_KEY without .env.example/CI sync) concretely"
  - `pr19`: **report-only on both models** — always `{ pass: true, score: verdict === 'pass' ? 1 : 0, reason: '<label>: verdict=<v>, configDeployment=<n>' }` so the matrix records the answer without ever going red
- Each test loads its diff via `vars: { diff: file://fixtures/<name>.diff }`.

**File**: `packages/code-reviewer/evals/review-schema.json`

**Intent**: Minimal hand-written JSON Schema mirroring `ReviewSchema` (`schema.ts:45-56`) — required keys `scores`/`findings`/`verdict`/`summary`, `verdict` enum `pass|fail`, six integer score keys — for the `is-json` assert. Not generated from zod; drift is caught because `is-json` failures would show immediately.

#### 3. Package wiring

**File**: `packages/code-reviewer/package.json`

**Intent**: Pin promptfoo and expose the run command.

**Contract**: `devDependencies` gains `"promptfoo": "0.122.0"` (exact pin, committed nested lockfile per package convention). `scripts` gains `"evals": "PROMPTFOO_DISABLE_TELEMETRY=1 PROMPTFOO_DISABLE_SHARING=true promptfoo eval -c evals/promptfooconfig.yaml -o ../../context/changes/code-review-evals/evidence/results.json"`.

### Success Criteria:

#### Automated Verification:

- `npm --prefix packages/code-reviewer install` succeeds; lockfile updated and committed
- `npx tsc --noEmit -p packages/code-reviewer` still clean (evals `.mjs`/`.yaml` files don't disturb the package type-check)
- Smoke run of the PR #20 row only (`promptfoo eval -c … --filter-pattern 'pr20'`): both providers return parseable JSON, all asserts evaluate (no provider-error cells), cost ≈ $0.02
- Negative check: with `ANTHROPIC_API_KEY` unset for the child, cells surface as provider **errors** (exit-2 mapping), not as graded fails

#### Manual Verification:

- Smoke-run output eyeballed: Haiku and Sonnet cells both show verdict, scores, and a real cost figure in the promptfoo summary

**Implementation Note**: Pause for manual confirmation before the full-sweep phase (it spends the real budget).

---

## Phase 3: Full Matrix Run + results.md

### Overview

One full 12-cell sweep, evidence capture, and the written decision.

### Changes Required:

#### 1. The sweep

**Intent**: `npm run evals` inside `packages/code-reviewer`, once (`repeat` stays 1; no caching exists for JS providers, so re-runs re-spend — don't re-run casually). Raw `results.json` lands in `context/changes/code-review-evals/evidence/` (committed, matching the stage-2 evidence pattern).

**Contract**: Full sweep total cost must be printed and come in under $1 (estimate $0.20–0.35). The run must be green: every hard assert passes; PR #19 rows are report-only by construction.

#### 2. Results document

**File**: `context/changes/code-review-evals/results.md`

**Intent**: The deliverable that turns the matrix into decisions.

**Contract**: Contains (a) the 6×2 matrix — per cell: verdict, `configDeployment` score, cost; (b) per-model totals (cost, wall time); (c) the REVIEW_MODEL recommendation applying the agreed rule — *Haiku stays unless Sonnet both clears PR #19 (verdict pass) AND matches every other row's expected verdict; cost reported, vetoes only if a sweep breaks $1*; (d) the prompt-rule verdict — *if Sonnet also false-positives PR #19, the fix is a prompt edit (follow-up change); if only Haiku misfires, a model bump is a viable alternative and the tradeoff is stated with measured cost*; (e) green-gate confirmation for the regression role.

### Success Criteria:

#### Automated Verification:

- `npm --prefix packages/code-reviewer run evals` exits green (all hard asserts pass)
- `context/changes/code-review-evals/evidence/results.json` exists and total cost across the sweep < $1

#### Manual Verification:

- `results.md` reviewed: matrix complete (no errored cells), both recommendations explicit and consistent with the decision rule
- Account balance sanity check (~$4 pre-run) — spend matches the printed cost

---

## Testing Strategy

### Unit Tests:

- None added — the provider is exercised end-to-end by the smoke run and sweep; `fixtures.ts` (untouched) keeps covering the CLI's own contract including the strip path.

### Integration Tests:

- The eval set *is* the integration test: 12 cells through the real CLI against the real API, plus the exit-2 negative check in Phase 2.

### Manual Testing Steps:

1. Phase 1: eyeball each fixture diff against research's line counts; confirm PR #21's diff is the docs-typo change.
2. Phase 2: read the smoke-run summary — verdicts, scores, cost present for both providers.
3. Phase 3: read `results.md` against `evidence/results.json` — the recommendation must follow mechanically from the matrix.

## Performance Considerations

Every run spends real API dollars (no caching for JS providers). Budget: smoke ≈ $0.02, full sweep ≈ $0.20–0.35, hard cap $1; account balance ~$4, so at most ~2 full sweeps during this change. `repeat: 1` throughout.

## Migration Notes

None — additive dev tooling. `fixtures.ts` and the CI gate are untouched. Future note: when the criterion-6 prompt edit lands (follow-up change), flip the PR #19 row from report-only to a hard assert as part of that change.

## References

- Related research: `context/changes/code-review-evals/research.md`
- Requirements: `context/changes/code-review-evals/requirements.md`
- CLI contract: `packages/code-reviewer/review.ts:17-19,143` · verdict: `packages/code-reviewer/schema.ts:67-71`
- Spawn pattern: `packages/code-reviewer/fixtures.ts:94-100`
- False-positive evidence: `context/changes/ai-code-review-ci/evidence/pr19-false-positive-comment.md`
- True-positive evidence: `context/changes/ai-code-review-ci/evidence/pr20-review-comment.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Fixture Materialization

#### Automated

- [x] 1.1 All six `.diff` files exist under `evals/fixtures/` with `diff --git` headers — 5dee0cb
- [x] 1.2 `generate-fixtures.mjs` re-run is idempotent — 5dee0cb
- [x] 1.3 Reversed fixture carries real path (`a/.github/workflows/ci.yml`) — 5dee0cb
- [x] 1.4 Secret scan over `evals/fixtures/` clean — 5dee0cb

#### Manual

- [ ] 1.5 Line counts match research table; PR #21 diff confirmed as docs-typo change

### Phase 2: Provider + Promptfoo Config

#### Automated

- [x] 2.1 `npm install` succeeds with pinned promptfoo; lockfile committed — bf9010a
- [x] 2.2 `npx tsc --noEmit -p packages/code-reviewer` clean — bf9010a
- [x] 2.3 PR #20 smoke run: both providers graded, no error cells, cost ≈ $0.02 — bf9010a
- [x] 2.4 Exit-2 negative check: missing API key surfaces as provider error, not graded fail — bf9010a

#### Manual

- [ ] 2.5 Smoke-run summary shows verdict, scores, and cost for both providers

### Phase 3: Full Matrix Run + results.md

#### Automated

- [x] 3.1 Full sweep exits green; total cost < $1 — 846c489
- [x] 3.2 `evidence/results.json` committed — 846c489

#### Manual

- [ ] 3.3 `results.md` reviewed: complete matrix, explicit REVIEW_MODEL + prompt-rule recommendations per the decision rule
- [ ] 3.4 Account balance spend matches printed cost
