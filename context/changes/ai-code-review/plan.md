# Local AI Code Review Agent (Stage 1) Implementation Plan

## Overview

Build `packages/code-reviewer/` — an isolated CLI agent that reads a git diff from stdin, scores it against the six criteria in `context/team/code-review-dod.md`, and emits a schema-valid JSON verdict with exit codes CI can gate on (`0` pass / `1` fail / `2` setup-or-budget error). Stage 1 is local-only: `git diff main...HEAD | npx tsx review.ts`. Stage 2 (CI job, PR comments, labels) is a separate follow-up change.

## Current State Analysis

- The repo is a **flat single-package Astro app** — no `packages/`, no npm workspaces, no `engines`/`packageManager` (`package.json:1-82`). Node pinned via `.nvmrc` → 22.14.0.
- Three tooling surfaces sweep in any new top-level code unless fenced: root `tsconfig.json:3-4` includes `**/*` (CI's `astro check` would type-check the package against deps not installed at root), `eslint.config.js:12` derives ignores solely from `.gitignore` (pre-commit `lint-staged` → `eslint --fix` would hit package files and fail hard once the root tsconfig excludes them), and Prettier has no `.prettierignore`.
- Tests run on PR via `.github/workflows/ci.yml` (jobs `ci` + `e2e`, parallel). This change does **not** touch it.
- `.env` is gitignored; the working tree already carries an uncommitted `.env.example:16` line `ANTHROPIC_API_KEY=###` — folded into this change. `ANTHROPIC_API_KEY` is deliberately absent from `astro.config.mjs`'s `env.schema` and must stay out: the app never depends on it.
- The rubric `context/team/code-review-dod.md` exists and is final: six anchored 1–10 criteria, verdict rules at `:49-54` (pass = all ≥ 5 and no blocker finding).
- Historical fixtures exist in git history: known-bad config-class `07da072`, trivially-clean `9ee3a49`, lockfile-noise exerciser `3ba28eb`, borderline should-pass `879315e`, 1-line known-bad `d6c93d8` (reversed).
- `tsx` is not installed anywhere; `zod@^4` exists at root but the package must declare its own copy.

## Desired End State

From a checkout with a valid `ANTHROPIC_API_KEY` in `.env`:

```bash
npm --prefix packages/code-reviewer ci        # one-time install, root tree untouched
git diff main...HEAD | npx --prefix packages/code-reviewer tsx packages/code-reviewer/review.ts
```

prints a schema-valid JSON verdict on stdout (per-criterion scores, findings with file/line/criterion/severity/fix, 2–3 sentence summary), human-readable progress + token usage + cost on stderr, and exits 0/1/2 — in under ~60 s, at ≈ $0.01–0.02 per run on Haiku. `npm run fixtures` inside the package proves the gate goes red on the known-bad commit and stays green on the clean one.

### Key Discoveries:

- `packages/code-reviewer/` with its own `package.json` + **committed nested lockfile, no npm workspaces** is the only layout that keeps AI SDK deps out of the root tree (workspaces would hoist them into the root lockfile) — `research.md` §1.
- AI SDK v6 is a superseded major: pin via the `ai-v6` dist-tag → `ai@^6.0.246` + `@ai-sdk/anthropic@^3.0.107`; zod v4 supported. In v6, `generateObject` is deprecated — use `generateText` with `output: Output.object({ schema })`; the validated object lands on `result.output`; use `result.totalUsage` for tokens — `research.md` §6.
- Model ids verified: `claude-haiku-4-5` ($1/$5 per MTok, default) and `claude-sonnet-4-6` ($3/$15). Never append date suffixes — `research.md` §7.
- Diff noise is repo-specific: `package-lock.json` (up to +12.5K lines per commit) and `context/**/*.md` plan-checkbox churn dominate; there are **no** snapshot files and no committed `dist/` — don't build stripping for them. `supabase/` must NOT be stripped (migrations are criterion-6 material) — `research.md` §4.
- Prior lesson (e2e change): a missing env var must fail loudly as a *setup* error, never masquerade as a review failure — hence exit 2 distinct from exit 1.
- L-002 generalized: prove the gate can go red — a gate that stays green when its risk materializes is decorative.

## What We're NOT Doing

- **No CI wiring** — `ci.yml` untouched; the GitHub Actions job, PR comments, `ai-cr:*` labels, and retry-on-label are stage 2 (separate change). Branch-protection enforcement is additionally blocked by the GitHub Free + private repo 403 (open risk carried to stage 2).
- **No PR title/description input** — stage 1 reviews the bare diff (stage 2 adds them).
- **No business-alignment or plan-adherence review** — parked per requirements.
- **No promptfoo eval set** — the fixtures script is its seed, but the Haiku-vs-Sonnet matrix is M5L3.
- **No prompt caching** — the rubric (~3.5 KB) is likely below Haiku's 4096-token cache minimum; revisit if real token counts say otherwise.
- **No broad stale-docs sweep** — `AGENTS.md` branch/CI errors, `README.md` §CI, `CLAUDE.md` "no test runner" line, and `ci.yml:33`'s stale "merge-blocking" comment get a parked follow-up note, fixed only where this change already edits the file.
- **No v7 migration** — build on pinned v6 per requirements; v7 deltas are small and a codemod exists (parked follow-up).

## Implementation Approach

One new fenced package plus three surgical root-side edits, built inside-out: scaffold + fencing first (prove the app's toolchain is untouched), then the agent core, then the fixture harness that makes the acceptance criteria executable, then docs. The verdict is **derived mechanically in code** from scores + findings per the rubric's verdict rules — the model proposes scores and findings; the CLI computes pass/fail, so the gate logic is deterministic and testable.

## Critical Implementation Details

- **Fencing must land atomically with the package.** Once root `tsconfig.json` excludes `packages`, any package `.ts` file visible to root ESLint makes typescript-eslint throw "file was not found by the project service" — and pre-commit fails hard. The root tsconfig `exclude`, the ESLint ignore for `packages/**`, and the package files must be in the same commit.
- **Verdict is computed, not trusted.** The schema still asks the model for `verdict`, but the CLI recomputes it from scores/findings (`pass` = all ≥ 5 AND no blocker) and the computed value wins. This keeps exit codes honest even if the model contradicts itself.
- **Rubric and `.env` paths resolve relative to the script file** (`import.meta.url` → `../../context/team/code-review-dod.md`, `../../.env`), not `process.cwd()` — the CLI must work when invoked from repo root or from inside the package.
- **Exit-code discipline:** `2` for anything that isn't a review verdict — missing/empty stdin, missing `ANTHROPIC_API_KEY`, oversized diff (post-strip > 4000 lines, checked *before* any API call), API/schema failure after SDK retries. `1` exclusively means "the code failed review".
- **Determinism for fixtures:** `temperature: 0`. Fixture assertions are limited to exit codes and the criterion-6 threshold — not exact scores — to tolerate residual run-to-run variance.

## Phase 1: Package Scaffold + Repo Fencing

### Overview

Create the isolated workspace and fence it off from the app's toolchain; prove root `check`/`lint`/`build` and pre-commit stay green and the root lockfile stays byte-identical.

### Changes Required:

#### 1. Package manifest + lockfile

**File**: `packages/code-reviewer/package.json` (new), `packages/code-reviewer/package-lock.json` (new, committed)

**Intent**: Own dependency universe so AI SDK deps never enter the root tree. Install via `npm --prefix packages/code-reviewer ci`; nested `node_modules` is auto-ignored by the existing `.gitignore` pattern.

**Contract**: `"private": true`, `"type": "module"`. Dependencies pinned to the v6 line: `"ai": "^6.0.246"`, `"@ai-sdk/anthropic": "^3.0.107"`, `"zod": "^4"` (own copy — never hoist-resolve against the app's). DevDependency: `"tsx"` (so `npx tsx` resolves deterministically). Scripts: `"review"` and `"fixtures"`. No `dotenv` — Node 22's `process.loadEnvFile()` covers `.env` loading.

#### 2. Package tsconfig

**File**: `packages/code-reviewer/tsconfig.json` (new)

**Intent**: Self-governed type-checking for a Node CLI; also required so typescript-eslint's project service can resolve package files if they're ever linted locally.

**Contract**: `strict: true`, `module: "esnext"`, `moduleResolution: "bundler"`, `include: ["**/*.ts"]`. Does **not** extend the root Astro tsconfig.

#### 3. Root fencing

**File**: `tsconfig.json`, `eslint.config.js`

**Intent**: Keep `astro check` (CI runs it after a root-only `npm ci`) and root ESLint/pre-commit away from package files.

**Contract**: add `"packages"` to root tsconfig `exclude` (currently `["dist", "assets"]`); add a `packages/**` entry to ESLint's global ignores. Both in the same commit as the package files (see Critical Implementation Details). No `.prettierignore` — Prettier formatting package JSON/MD matches existing house behavior on the root lockfile.

#### 4. Env placeholder

**File**: `.env.example`

**Intent**: Land the already-present uncommitted `ANTHROPIC_API_KEY` line as part of this change, following the house pattern (placeholder + comment naming where the value comes from).

**Contract**: comment states it's for the local code-review agent, key from the Anthropic Console (commercial terms); value placeholder `###`. Key must NOT be added to `astro.config.mjs`'s `env.schema`.

### Success Criteria:

#### Automated Verification:

- Root toolchain green with the package present: `npm run check && npm run lint && npm run build`
- Root lockfile untouched: `git diff --exit-code package-lock.json`
- Package installs from its committed lockfile: `npm --prefix packages/code-reviewer ci`
- Pre-commit passes on a commit touching a package `.ts` file (ESLint skips ignored file with a warning, Prettier formats)
- No secret in the diff: `git grep -c "sk-ant" -- . ':!*.md'` returns nothing

#### Manual Verification:

- Root `node_modules` contains no `ai` / `@ai-sdk` packages after a fresh root `npm ci`

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Review Agent Core

### Overview

The CLI itself: stdin → strip → budget guard → rubric + diff → model → validated verdict → stdout/stderr → exit code.

### Changes Required:

#### 1. Verdict schema

**File**: `packages/code-reviewer/schema.ts` (new)

**Intent**: Single source of truth for the output contract, mirroring the rubric's verdict rules; `.describe()` on every field so the model sees the semantics.

**Contract**: zod schema — other phases and stage 2 depend on this shape:

```ts
scores: { correctness, typeIdiom, complexity, testCoverage, security, configDeployment } // each z.number().int().min(1).max(10)
findings: Array<{ file, line, criterion /* 1-6 */, severity: "blocker"|"major"|"minor", description, suggestedFix }>
verdict: "pass" | "fail"
summary: string // 2-3 sentences of actionable Markdown
```

Also exported: `deriveVerdict(scores, findings)` implementing `code-review-dod.md:49-54` mechanically (pass = all ≥ 5 AND no blocker).

#### 2. The CLI

**File**: `packages/code-reviewer/review.ts` (new)

**Intent**: The pipeline described in the Overview. Model id from `--model` arg or `REVIEW_MODEL` env, default `claude-haiku-4-5`.

**Contract**:
- **Input**: unified diff on stdin. Empty stdin / TTY → usage message, exit 2.
- **Env**: load repo-root `.env` via `process.loadEnvFile()` if present (path resolved from `import.meta.url`); missing `ANTHROPIC_API_KEY` → clear setup-error message, exit 2.
- **Stripping** (parse diff into per-file segments, drop by path): any `package-lock.json`, all of `context/**`, `public/**` binary files. Nothing else — explicitly keep `supabase/**`.
- **Budget guard**: post-strip changed-line count > 4000 → refusal message with the count, exit 2, **no API call**.
- **Model call**: `generateText` with `output: Output.object({ schema })`, `temperature: 0`, sensible `maxOutputTokens` (~4096). System prompt = rubric file content verbatim + output instructions; user prompt = stripped diff. No tools, no `stopWhen` needed.
- **Output**: stdout gets exactly one JSON document (the verdict, with `verdict` replaced by `deriveVerdict`'s result). stderr gets progress, per-criterion scores, summary, `totalUsage` tokens and computed cost from a hardcoded price table (`claude-haiku-4-5`: $1/$5 per MTok; `claude-sonnet-4-6`: $3/$15).
- **Exit**: 0 pass, 1 fail, 2 for API/schema errors after the SDK's built-in retries.

### Success Criteria:

#### Automated Verification:

- Happy path: a small synthetic clean diff piped in returns schema-valid JSON (`node -e` parse + zod check) and exit 0
- `ANTHROPIC_API_KEY` unset → exit 2, stderr names the missing variable
- Empty stdin → exit 2 with usage message
- Synthetic > 4000-line post-strip diff → exit 2 with line count, and no API call occurred (runs with the key unset still produce the budget message, proving guard-before-call ordering)
- A diff consisting only of `package-lock.json` + `context/**` changes → strip leaves nothing; CLI reports "nothing to review" and exits 0 without an API call

#### Manual Verification:

- Run on the current working-tree diff: verdict is sensible, summary actionable, findings carry real file/line
- Cost on stderr ≈ $0.01–0.02 with Haiku; wall time < 60 s
- `--model claude-sonnet-4-6` works and reports Sonnet pricing

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Fixture Harness + Acceptance

### Overview

Make the requirements' acceptance criteria a repeatable command: `npm run fixtures` pipes historical commits through the reviewer and asserts expectations — the L-002 "prove the gate goes red" meta-check, and the seed of the M5L3 promptfoo eval set.

### Changes Required:

#### 1. Fixture runner

**File**: `packages/code-reviewer/fixtures.ts` (new)

**Intent**: Obtain each fixture's diff via `git show <sha> --format=` (child process), run it through the same review pipeline, compare against expectations, print a result table, exit non-zero on any hard-assertion failure.

**Contract**: two assertion tiers to balance the meta-check against LLM variance:

- **Hard assertions** (fail the run):
  - `07da072` (parent-PIN config-class, the downtime-incident proxy) → exit 1 AND criterion-6 score < 5
  - `9ee3a49` (1-line timestamp fix) → exit 0
- **Report-only rows** (printed, never fail the run):
  - `3ba28eb` — post-strip line count (expect ~320 of 1336; proves stripping) and cost
  - `d6c93d8` reversed (`git show -R`) — 1-line env-var removal from CI; expected fail on criterion 6
  - `879315e` — borderline should-pass (service-role change that did sync `.env.example`); the not-cry-wolf case

Full sweep costs ≈ $0.05 on Haiku.

### Success Criteria:

#### Automated Verification:

- `npm run fixtures` exits 0 (both hard assertions hold)
- Result table shows all five fixtures ran to completion (no exit-2 rows)

#### Manual Verification:

- Read `07da072`'s findings — they should name the real gaps (env var missing from `.env.example` and CI, fail-open HMAC default), not generic complaints
- Run `npm run fixtures` twice — hard-assertion outcomes stable across runs at temperature 0
- `879315e` report row: passes (or, if it fails, the findings justify it — record the observation in Progress)

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Docs

### Overview

Document usage and the package's deviations from app conventions; record parked follow-ups. Only docs this change touches — no broad stale-docs sweep.

### Changes Required:

#### 1. README usage section

**File**: `README.md`

**Intent**: A short "AI code review (local)" section: one-time install, the pipe command, env requirement, exit-code contract, fixtures command.

**Contract**: commands copy-paste runnable from repo root. Do not rewrite the (stale) §CI here — parked.

#### 2. Package-scoped agent rules

**File**: `packages/code-reviewer/CLAUDE.md` (new)

**Intent**: Directory-scoped rules (precedent: `e2e/CLAUDE.md`) so future agents don't apply app conventions to this Node CLI.

**Contract**: states — this is dev-tooling, not product AI (`tech-stack.md`'s `has_ai: false` refers to the product); `process.env`/`loadEnvFile` is correct here, `astro:env` impossible outside the Astro build; output is developer-facing English (L-003 is scoped to product UI); `console`/stderr output is the point, not a lint violation; deps stay in this package — never add them to root; pin the `ai-v6` line until the parked v7 migration.

#### 3. Parked follow-ups

**File**: `context/changes/ai-code-review/change.md`

**Intent**: Record what stage 1 deliberately leaves behind so stage 2 planning starts from facts.

**Contract**: notes list — stage 2 (CI job, PR comment, labels, fork-PR secret caution, branch-protection 403 blocker), v7 migration (codemod), stale-docs sweep (`AGENTS.md`, `README.md` §CI, `CLAUDE.md` test-runner line, `ci.yml:33`), promptfoo eval set (M5L3), prompt caching if token counts justify it.

### Success Criteria:

#### Automated Verification:

- `npm run lint` and `npx prettier --check README.md packages/code-reviewer/CLAUDE.md` pass

#### Manual Verification:

- README commands work verbatim on a fresh shell (copy-paste test)

---

## Testing Strategy

### Unit Tests:

None as vitest suites — the package stays outside the root test glob (`vitest.config.ts:31` includes `tests/**` only) and stage 1 keeps the harness minimal. Deterministic logic (`deriveVerdict`, stripping, budget guard) is exercised by Phase 2's synthetic-diff checks and Phase 3's fixtures; if stage 2 grows logic, add package-local vitest then.

### Integration Tests:

`npm run fixtures` — real API calls against five historical diffs with two hard assertions (known-bad fails on criterion 6, clean passes).

### Manual Testing Steps:

1. `git diff main...HEAD | npx --prefix packages/code-reviewer tsx packages/code-reviewer/review.ts` on a real branch — sensible verdict, < 60 s, cost printed.
2. Unset `ANTHROPIC_API_KEY` and re-run — exit 2, setup message (not a "fail" verdict).
3. `npm run fixtures` twice — stable hard-assertion outcomes.

## Performance Considerations

Latency (~10–30 s per run) and cost (≈ $0.01–0.02 Haiku) are dominated by the model call; stripping cuts input tokens by the largest factor available (lockfile + context churn). The 4000-line budget guard bounds worst-case spend before any tokens burn. No caching in stage 1.

## Migration Notes

Rollback is one commit revert: delete `packages/code-reviewer/`, restore the two-line root edits (`tsconfig.json` exclude, `eslint.config.js` ignore) and the `.env.example` line. Nothing else in the repo depends on the package.

## References

- Requirements: `context/changes/ai-code-review/requirements.md`
- Related research: `context/changes/ai-code-review/research.md`
- Rubric: `context/team/code-review-dod.md`
- Validation: `context/team/opportunity-map.md`, `context/team/mom-test-validation.md`
- House plan precedent: `context/archive/2026-07-12-testing-e2e-playwright/plan.md`
- Fencing targets: `tsconfig.json:3-4`, `eslint.config.js:12`, `.github/workflows/ci.yml:23-24`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Package Scaffold + Repo Fencing

#### Automated

- [x] 1.1 Root toolchain green with the package present (`npm run check && npm run lint && npm run build`) — 04a5839
- [x] 1.2 Root lockfile untouched (`git diff --exit-code package-lock.json`) — 04a5839
- [x] 1.3 Package installs from its committed lockfile (`npm --prefix packages/code-reviewer ci`) — 04a5839
- [x] 1.4 Pre-commit passes on a commit touching a package `.ts` file — 04a5839
- [x] 1.5 No secret in the diff (`git grep` for the key returns nothing) — 04a5839

#### Manual

- [x] 1.6 Root `node_modules` contains no `ai` / `@ai-sdk` packages after fresh root `npm ci` — 04a5839

### Phase 2: Review Agent Core

#### Automated

- [x] 2.1 Happy path: synthetic clean diff → schema-valid JSON, exit 0 — 07adcdd
- [x] 2.2 Missing `ANTHROPIC_API_KEY` → exit 2 naming the variable — 07adcdd
- [x] 2.3 Empty stdin → exit 2 with usage message — 07adcdd
- [x] 2.4 Oversized post-strip diff → exit 2 with line count, no API call — 07adcdd
- [x] 2.5 Noise-only diff → "nothing to review", exit 0, no API call — 07adcdd

#### Manual

- [x] 2.6 Real working-tree diff: sensible verdict, actionable summary, real file/line findings — 07adcdd
- [x] 2.7 Cost ≈ $0.01–0.02 on Haiku, wall time < 60 s — 07adcdd
- [x] 2.8 `--model claude-sonnet-4-6` works and reports Sonnet pricing — 07adcdd

### Phase 3: Fixture Harness + Acceptance

#### Automated

- [x] 3.1 `npm run fixtures` exits 0 (07da072 → exit 1 + criterion-6 < 5; 9ee3a49 → exit 0)
- [x] 3.2 All five fixture rows ran to completion (no exit-2 rows)

#### Manual

- [x] 3.3 07da072 findings name the real gaps (env var sync, fail-open HMAC), not generic complaints
- [x] 3.4 Two consecutive `npm run fixtures` runs: stable hard-assertion outcomes
- [x] 3.5 879315e report row reviewed (pass, or justified findings recorded)

### Phase 4: Docs

#### Automated

- [ ] 4.1 `npm run lint` + Prettier check pass on edited docs

#### Manual

- [ ] 4.2 README commands work verbatim from a fresh shell
