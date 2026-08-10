---
date: 2026-08-09T22:34:23+02:00
researcher: Claude (Fable 5)
git_commit: 7edc87da5862523101df48da3a0909be8a3dae3e
branch: main
repository: vince307/mathshop
topic: "Promptfoo eval set for the review agent — wiring (exec vs custom provider vs anthropic providers), fixture viability, assertion design"
tags: [research, codebase, code-reviewer, promptfoo, evals, ci-gate]
status: complete
last_updated: 2026-08-09
last_updated_by: Claude (Fable 5)
---

# Research: Promptfoo eval set for the review agent

**Date**: 2026-08-09T22:34:23+02:00
**Researcher**: Claude (Fable 5)
**Git Commit**: `7edc87d` (main, pushed)
**Repository**: vince307/mathshop

## Research Question

Based on `requirements.md`: how to wire a promptfoo eval set for `packages/code-reviewer/` — the key open question being a promptfoo **custom/exec provider wrapping `review.ts`** (preferred) vs **direct anthropic providers with our system prompt**. Plus: fixture viability, assertion design, cost, and constraints.

## Summary

**The wiring decision is settled: wiring (b), implemented as a promptfoo custom JavaScript provider (`file://review-provider.mjs`) — NOT the `exec:` provider.** The `exec:` provider is disqualified twice over: it passes the prompt as a positional **argv argument, never stdin** (our CLI reads the diff from stdin), and a **non-zero exit code rejects as a provider error** — so every legitimate "fail" verdict (exit 1) would surface as an errored cell with no assertions evaluated. A ~40-line custom JS provider avoids both: it spawns the CLI, pipes `{{diff}}` to stdin, treats exit 0/1 as valid output and exit 2 as `{ error }`, serves both models from one script via per-provider `config: { model }` (through the `REVIEW_MODEL` env var, already supported at `review.ts:143` — **no `review.ts` change needed**), and returns `tokenUsage`/`cost` so promptfoo's cost totals work.

Fixture verification surfaced **two blockers the plan must resolve**:

1. **`9ee3a49` never reaches the model** — its only file is under `context/`, so the pre-filter strips everything and the CLI exits 0 *without an API call* (`review.ts:167-170`). As an eval row it produces no JSON to assert on. Best replacement for the "trivially clean" row: **PR #21's diff** (the docs-typo control PR from stage-2 acceptance, merged, `ai-cr:passed`).
2. **PR #20's commit is dangling** — head OID `21f30b53` is unreachable from every ref and survives only as a loose object; one `git gc --prune` deletes it. The `.diff` fixture must be materialized **now**, which the requirements already mandate (committed `.diff` files).

Everything else is green: all 7 candidate diffs regenerate offline and byte-identically match `gh pr diff` where applicable, all are far under the 4000-line budget, the secret scan is clean (two dummy values already public on `main`), `packages/code-reviewer/evals/` is unclaimed, and neither `.gitignore` nor ESLint/Prettier interferes with committed `*.diff` files. Full-sweep cost is comfortably under the $1 budget (~$0.05 Haiku side + ~$0.15–0.25 Sonnet side + a few rubric-judge calls).

## Detailed Findings

### 1. Wiring decision: custom JS provider (wiring b), exec ruled out

Verified against promptfoo **0.122.0** (latest npm release as of 2026-08-09; pin it — the grader auto-selection behavior below is recent).

**Why `exec:` fails** (source: `src/providers/scriptCompletion.ts`; docs: promptfoo.dev/docs/providers/custom-script):
- Prompt is appended as a positional argv argument (plus JSON-serialized config and context argv args). Nothing is written to the child's stdin — our CLI would see an empty stdin and exit 2.
- Non-zero exit → `reject(error)` → the cell is recorded as a provider **error**; assertions never run. Our exit-code contract (`review.ts:17-19`: 0 pass / 1 fail / 2 setup) makes every "fail" verdict exit 1 by design.
- Additional fragility: if stderr is non-empty while stdout is empty, promptfoo throws — our CLI always writes progress/cost to stderr.

**Why the custom JS provider works** (docs: promptfoo.dev/docs/providers/custom-api):
- Interface: default-export class with `id()` and `async callApi(prompt, context, options)`; constructor receives `{ id, config }`. ESM (`.mjs`), CJS, and TypeScript all supported.
- `callApi` is fully async and may spawn child processes — it controls error semantics itself: exit 0/1 → `resolve({ output: stdout, metadata: { exitCode } })`, exit 2 → `resolve({ error: ... })`.
- One script serves both models:
  ```yaml
  providers:
    - id: file://./evals/review-provider.mjs
      label: haiku-4-5
      config: { model: claude-haiku-4-5 }
    - id: file://./evals/review-provider.mjs
      label: sonnet-4-6
      config: { model: claude-sonnet-4-6 }
  ```
  The provider passes `config.model` as `REVIEW_MODEL` in the child env — `review.ts:143` (`values.model ?? process.env.REVIEW_MODEL ?? DEFAULT_MODEL`) picks it up unchanged. (`--model` argv would work equally well.)
- `ProviderResponse` supports `tokenUsage: { total, prompt, completion }` and `cost` (dollars) — parseable from the CLI's stderr `Tokens: N in / M out | Cost: $X` line (`review.ts:234-238`), feeding promptfoo's aggregate cost display.
- The prompt template is literally `{{diff}}`; each test loads its fixture via `vars: { diff: file://fixtures/<name>.diff }` (paths resolve relative to `promptfooconfig.yaml`; no practical size limit for text vars).

**Wiring (a)** (two `anthropic:messages:*` providers + a chat-format prompt file with the system prompt) remains cleanly possible — `anthropic:messages:claude-haiku-4-5` / `claude-sonnet-4-6` are in promptfoo's pricing table, `ANTHROPIC_API_KEY` is read from env automatically — but it re-implements what `review.ts` already does (rubric loading, prompt assembly, schema enforcement, `deriveVerdict`) and tests a *copy* of the prompt, not what CI runs. Keep as an optional future config for isolating prompt quality from pipeline code; not part of this change.

### 2. Assertion & matrix mechanics

- **Cross-product**: 1 prompt × 2 providers × 6 tests = 12 cells, run by default. `repeat` defaults to 1 (matches the budget constraint).
- **`defaultTest.assert` merges with per-test asserts** — put `is-json` (with a JSON schema for `{scores, findings, verdict, summary}`, loadable via `value: file://…`) in `defaultTest`, per-fixture verdict/score expectations in each test.
- **`javascript` asserts** receive `output` as the raw string (JSON.parse it, or set a test-level `transform`) plus a context carrying `vars`, `test`, and **`provider`** — `context.provider.label` / `.id()` identifies which model produced the output. There is no per-provider `assert:` block in YAML; a provider-aware JS assert is the idiomatic way to encode "PR #19: hard expectation on Sonnet, report-only on Haiku":
  ```yaml
  - type: javascript
    value: |
      const r = JSON.parse(output);
      const sonnet = (context.provider.label || '').includes('sonnet');
      if (sonnet) return { pass: r.verdict === 'pass', reason: `sonnet verdict=${r.verdict}` };
      return { pass: true, score: r.verdict === 'pass' ? 1 : 0, reason: `haiku verdict=${r.verdict} (report-only)` };
  ```
- **`llm-rubric` grader must be pinned to Anthropic** — the default grader is auto-selected from available credentials (with only `ANTHROPIC_API_KEY` set, current versions pick Anthropic), but pin it explicitly so a version change can't break the run:
  ```yaml
  defaultTest:
    options:
      provider: anthropic:messages:claude-haiku-4-5   # or sonnet; judge model choice is a plan decision
  ```
  Requirements say minimal llm-rubric use — only PR #20's "names the env-var desynchronization concretely" needs it; verdict/score asserts cover the rest.
- **Caching**: promptfoo's disk cache does **not** apply to custom JS providers (only exec and built-in providers) — every run re-spends API dollars. Acceptable at ~$0.25/sweep; `--no-cache` semantics are moot.
- **Privacy/offline**: sharing is opt-in; set `PROMPTFOO_DISABLE_SHARING=true` + `PROMPTFOO_DISABLE_TELEMETRY=1`. Outputs: `-o results.json` / `-o report.html`; total cost is printed in the summary.

### 3. Fixture verification (all regenerable offline; two blockers)

| Fixture | Regeneration (offline, verified) | Changed lines | Post-strip | Notes |
|---|---|---|---|---|
| `07da072` fwd | `git show --no-color --format= 07da072` | 765 | ~735 | known-bad config-class; must fail, `configDeployment < 5` |
| `9ee3a49` fwd | `git show --no-color --format= 9ee3a49` | 2 | **0** | ⚠️ Blocker 1: strips to nothing, exits 0 with **no API call** |
| `d6c93d8` -R | `git show -R --no-color --format= d6c93d8` | 1 | 1 | ⚠️ reversed header parses to path `"unknown"` (see below) |
| `879315e` fwd | `git show --no-color --format= 879315e` | 436 | ~402 | borderline should-pass (synced `.env.example`) |
| `3ba28eb` fwd | `git show --no-color --format= 3ba28eb` | 1336 | ~263 | lockfile-noise exerciser (80% stripped); optional row |
| PR #19 | `git diff --no-color 6ab9b76^1...6ab9b76^2` | 97 | ~79 | byte-identical to `gh pr diff 19`; the false-positive row |
| PR #20 | `git show --no-color --format= 21f30b53` | 12 | 12 | ⚠️ Blocker 2: commit **dangling** (unreachable from all refs) — materialize now |

- **Blocker 1 — `9ee3a49`**: only touches `context/archive/...`, which `isNoise` strips (`review.ts:69-75`); the CLI prints "Nothing to review" and exits 0 pre-API (`review.ts:167-170`). As a promptfoo row it yields empty stdout. Candidate replacement for the clean row: **PR #21** (`test/ai-cr-clean-docs`, docs typo, merged 2026-08-08 with `ai-cr:passed` — `evidence/pr21-checks.txt`). The strip-path behavior itself is already covered by `fixtures.ts` and needn't burn an eval row (design decision for the plan).
- **Reversed-diff caveat (`d6c93d8 -R`)**: `git show -R` emits swapped sides (`diff --git b/X a/X`); `pathFromHeader` (`review.ts:43-56`) returns `"unknown"` for that header, so the model sees `unknown` as the file and — more importantly — reversed `context/**`/lockfile paths would escape `isNoise`. Harmless for this 1-line fixture, but committing the raw `-R` output bakes the broken header in. Options for the plan: normalize the header when materializing the fixture (fixture-generation concern, not a `review.ts` edit — allowed under the constraints), or keep raw and note `file: "unknown"` in assertions; the underlying parser gap is a candidate `review.ts` bug for a separate change.
- **Secret scan: clean.** Two hits, both documented dummies already public on `main`: `PARENT_SESSION_SECRET=test-…` in `07da072`'s `.env.test.example` (placeholder file) and `PARENT_SESSION_SECRET=ci-…` in `d6c93d8`'s CI workflow (hardcoded demo value, still live at `.github/workflows/ci.yml:53`). No new exposure from committing the fixtures.
- **Tooling**: `packages/code-reviewer/evals/` doesn't exist yet; `.gitignore` has no matching pattern; ESLint ignores `packages/**` (`eslint.config.js:80`); Prettier skips `.diff` (no parser). Nothing blocks committed fixtures.
- All sizes are far below `MAX_DIFF_LINES = 4000` (`review.ts:22`).

### 4. What the evals are actually measuring (rubric + history)

- **Criterion 6** (`context/team/code-review-dod.md:42-47`): 1-anchor = "renamed/removed env var without updating `.env.example`, CI, and Vercel"; 10-anchor = "env var changes are synchronized across `.env.example`, CI secrets, and deployment". "CI workflow edits" are explicitly in criterion-6 scope (`:44`), so an infra-setup PR is by construction a criterion-6 change.
- **The prompt amplification** is where the false positive lives: `review.ts:107-114` ("Absence IS evidence for criterion 6 … do not assume the sync happened elsewhere … Partial synchronization still fails") overrides the general "don't invent problems about code you cannot see; score it 7" rule at `review.ts:105-106`.
- **PR #19 vs PR #20 — the measured contrast**: both got nearly identical Haiku prose ("not shown in the diff … partial synchronization fails"). In PR #20 (`SUPABASE_KEY` rename, scores 10/10/10/7/4/**2**, blocker) the sync genuinely never happened — true positive, PR never merged. In PR #19 (gate's own Phase-3 setup PR, scores 7/7/7/5/6/**4**, three findings all of the form "file X is not in this diff") the referenced files already existed untouched on `main` — the model demanded already-merged files be pasted into the diff, penalizing exactly the PR-splitting hygiene criterion 3 rewards. PR #19 was blocked twice and landed via documented admin bypass (`change.md:14` of `ai-code-review-ci`). The eval's question 2 is whether Sonnet separates these two cases when Haiku can't.
- **Verdict is computed, not trusted**: `deriveVerdict` (`schema.ts:67-71`) recomputes pass/fail from scores+findings — wiring (b) inherits this for free; wiring (a) would have to reimplement it inside asserts (another reason (b) wins).
- **Cost baselines** (measured, stage 2): Haiku ≈ $0.0066–0.0078 and 6–8s per review on the PR-sized diffs; Sonnet ≈ 3–5× on the price table (`review.ts:26-29`: Haiku $1/$5, Sonnet $3/$15 per MTok). 12 cells + ≤2 judge calls lands ~$0.20–0.35 — well under the $1 budget; the biggest rows (`07da072` ~735 lines, `879315e` ~402 lines) dominate.

## Code References

Permalink base: `https://github.com/vince307/mathshop/blob/7edc87da5862523101df48da3a0909be8a3dae3e/`

- `packages/code-reviewer/review.ts:17-23` — exit-code contract, model default, 4000-line budget ([permalink](https://github.com/vince307/mathshop/blob/7edc87da5862523101df48da3a0909be8a3dae3e/packages/code-reviewer/review.ts#L17-L23))
- `packages/code-reviewer/review.ts:143` — model resolution `--model ?? REVIEW_MODEL ?? default` (the provider's hook; no code change needed)
- `packages/code-reviewer/review.ts:69-75, 167-170` — noise filter + "nothing to review" early exit (the `9ee3a49` blocker)
- `packages/code-reviewer/review.ts:43-56` — `pathFromHeader` (returns `"unknown"` for reversed `-R` headers)
- `packages/code-reviewer/review.ts:107-114` — the "absence IS evidence" criterion-6 prompt rule under test
- `packages/code-reviewer/review.ts:234-238` — stderr `Tokens/Cost` line the provider can parse for promptfoo cost totals
- `packages/code-reviewer/schema.ts:45-56, 67-71` — `ReviewSchema` (JSON shape for `is-json`) and `deriveVerdict`
- `packages/code-reviewer/fixtures.ts:39-80` — existing fixture rows + hard assertions (the seed being generalized)
- `context/team/code-review-dod.md:42-47` — criterion 6 anchors ([permalink](https://github.com/vince307/mathshop/blob/7edc87da5862523101df48da3a0909be8a3dae3e/context/team/code-review-dod.md#L42-L47))
- `.github/actions/ai-reviewer/action.yml:66-70, 85-86` — how CI invokes the CLI (what wiring (b) replicates)
- `.github/workflows/ci.yml:53` — the public dummy `PARENT_SESSION_SECRET` matching the `d6c93d8` fixture content
- `eslint.config.js:80` — `packages/**` lint exclusion (fixtures/config safe to commit)
- `context/changes/ai-code-review-ci/evidence/pr19-false-positive-comment.md` — the false-positive scores/findings/cost
- `context/changes/ai-code-review-ci/evidence/pr20-review-comment.md` — the true-positive scores/blocker/cost

## Architecture Insights

- **The eval provider is a thin adapter, not a reimplementation**: everything the eval needs (model override, schema enforcement, verdict computation, cost line) already exists behind the CLI's contract. The custom provider's whole job is stdin piping + exit-code translation + stderr cost parsing. This keeps the "eval-only, don't touch `review.ts`" constraint intact.
- **Exit-code semantics are load-bearing across all three stages**: local CLI, CI action, and now the eval provider all rely on 0/1 = verdict, 2 = setup. The provider must map 2 → `{ error }` so infra failures show as errored cells, never as graded verdicts — the same distinction `review.yml` makes with labels (`review.yml:90-91`).
- **Criterion 3 vs criterion 6 are in structural tension for staged infra work**: the rubric rewards small single-concern PRs while the criterion-6 prompt amplification punishes diffs whose sync counterpart already landed. The eval set is the instrument that decides where that tension gets resolved (prompt edit vs model bump) — which is why the PR #19 row's hard-fail-vs-report-only status is the plan's key design decision.
- **Fixtures must be static files** — `fixtures.ts`'s runtime `git show` approach already breaks for PR #20's dangling commit; the requirements' committed-`.diff` mandate is not just hygiene but the only way that row survives at all.

## Historical Context (from prior changes)

- `context/archive/2026-07-12-…` n/a; the relevant arc:
- `context/archive/2026-08-08-ai-code-review/plan.md:42` + `change.md:19` — promptfoo evals explicitly parked as M5L3; `fixtures.ts:4` calls itself "the seed of the future promptfoo eval set". Model rationale: Haiku default at $1/$5, Sonnet wired as override; `temperature: 0`; assertions on exit codes + criterion-6 threshold, not exact scores (variance tolerance — carry this principle into the eval asserts).
- `context/changes/ai-code-review-ci/plan.md:30-35` — stage 2 froze the CLI contract and parked both "PR title/body as model context" and evals; `plan.md:23` predicted the gate would self-flag its own introducing PR.
- `context/changes/ai-code-review-ci/change.md:14` — the recorded false-positive analysis: "the 'absence is evidence' prompt rule cannot see cross-file state outside the diff … Remedies parked: PR title/body as model context; eval fixture from PR #19's diff."
- `context/changes/ai-code-review-ci/evidence/pr21-checks.txt` — PR #21 (clean docs control, merged, `ai-cr:passed`): the natural replacement clean fixture.

## Related Research

- `context/archive/2026-08-08-ai-code-review/research.md` — stage-1 research (model ids, AI SDK v6 idioms; "never append date suffixes to model ids").
- `context/changes/ai-code-review-ci/research.md` — stage-2 research (workflow/action mechanics).

## Open Questions

1. **Clean-row replacement**: swap `9ee3a49` for PR #21's diff (recommended), keep `9ee3a49` as an explicit pre-filter row asserting empty output + exit 0, or both? (The strip path is already guarded by `fixtures.ts`.)
2. **PR #19 row semantics**: hard-fail on Sonnet + report-only on Haiku (provider-aware assert), or report-only on both until the follow-up prompt-fix change? Requirements leave this to the plan; acceptance criterion 3 ("runs green except possibly PR #19") suggests report-only-by-default is safest for the regression-gate role.
3. **Reversed fixture header**: normalize `d6c93d8 -R`'s `diff --git` header at fixture-materialization time, or commit raw and assert around `file: "unknown"`? (The `pathFromHeader` gap itself → candidate separate bug change.)
4. **Judge model for the single llm-rubric assert**: Haiku (cheaper, and the assert is simple string-presence-level) vs Sonnet (safer grading). ~1–2 calls either way; cost impact is cents.
5. **Where `npm run evals` lives**: requirements say "inside `packages/code-reviewer`" — add a script entry `"evals": "promptfoo eval -c evals/promptfooconfig.yaml …"` and decide whether promptfoo is a devDependency (pinned 0.122.0, recommended for reproducibility) or `npx promptfoo@0.122.0`.
