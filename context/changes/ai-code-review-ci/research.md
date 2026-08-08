---
date: 2026-08-08T21:01:08+02:00
researcher: Claude Code (Fable 5)
git_commit: 8aceb3ce3b8d8cce75081507865b5ca688b52e5f
branch: main
repository: vince307/mathshop
topic: "Wire the stage-1 review agent into GitHub Actions as a merge gate (ai-code-review-ci)"
tags: [research, codebase, code-reviewer, github-actions, ci, branch-protection]
status: complete
last_updated: 2026-08-08
last_updated_by: Claude Code (Fable 5)
---

# Research: Wiring the stage-1 review agent into GitHub Actions as a merge gate

**Date**: 2026-08-08T21:01:08+02:00
**Researcher**: Claude Code (Fable 5)
**Git Commit**: `8aceb3c` (pushed to origin/main; permalink base: `https://github.com/vince307/mathshop/blob/8aceb3ce3b8d8cce75081507865b5ca688b52e5f/`)
**Branch**: main
**Repository**: vince307/mathshop (private)

## Research Question

Ground the stage-2 plan (per `context/changes/ai-code-review-ci/requirements.md`): everything CI needs to invoke the stage-1 agent in `packages/code-reviewer/`, the existing GitHub Actions conventions to match, the stage-1 decisions/findings that constrain stage 2, and the live GitHub repo state (labels, secrets, branch protection).

## Summary

- **The CLI contract is CI-ready as-is**: pipe a `git diff` to stdin, JSON verdict on stdout, logs+cost on stderr, exit 0/1/2. Invocation from repo root: `npm --prefix packages/code-reviewer ci` then `git diff --no-color origin/main...HEAD | npx --prefix packages/code-reviewer tsx packages/code-reviewer/review.ts`. `REVIEW_MODEL` env override already exists — the requirements' "repo variable" maps 1:1 onto it.
- **⚠️ Branch protection is unavailable today**: the repo is **private on GitHub Free** — both branch-protection and rulesets APIs return 403 ("Upgrade to GitHub Pro or make this repository public"). This blocker was already recorded in the stage-1 archive as unresolved since 2026-06-11, and it collides with the stage-2 DoD ("branch protection is part of the definition of done"). Decision needed: upgrade to Pro (~$4/mo), make the repo public, or ship the gate advisory-only and document the residual risk.
- **`ANTHROPIC_API_KEY` is already a repo Actions secret** (created 2026-08-08) — the stage-1 self-review finding is half-resolved; what remains is the `.env.example` comment update.
- **No `ai-cr:*` labels exist yet** (`gh label list` shows only default + roadmap labels) — the workflow (or a setup step) must create `ai-cr:review` / `ai-cr:passed` / `ai-cr:failed`.
- **House CI style**: check names are bare job ids (`ci`, `e2e` — no `name:` keys), first-party actions tag-pinned `@v4`, `setup-node` with `node-version: 22` + `cache: npm`. There is **no** `permissions:`, `concurrency:`, or `timeout-minutes` anywhere, and no `.github/actions/` — the composite action will be the repo's first.
- **Workflow-side edge cases the CLI pushes upward**: empty stdin → exit 2 (short-circuit diff-less PRs before invoking), noise-only diff → exit 0 with **empty stdout** (comment step must tolerate missing JSON), cost lives **only on stderr** (`Tokens: ... | Cost: $X.XXXX | Time: Ns`), and ANSI-colored diffs break header parsing (`--no-color`).

## Detailed Findings

### 1. Stage-1 agent CLI contract (`packages/code-reviewer/`)

**Invocation & install**
- Entry: `packages/code-reviewer/review.ts` — TypeScript ESM run via **tsx**, no build step, no `bin` (`tsconfig.json:11` `noEmit`; `.ts`-extension imports, so plain `node` won't run it).
- **Not an npm workspace** — deliberately isolated: own `package.json` + committed `package-lock.json`. Install: `npm --prefix packages/code-reviewer ci` (`packages/code-reviewer/CLAUDE.md:9`, `README.md:168`). Root `npm ci` does **not** install its deps.
- Canonical run from repo root (`README.md:174`): `git diff main...HEAD | npx --prefix packages/code-reviewer tsx packages/code-reviewer/review.ts`.
- `engines: { "node": ">=22" }` (`package.json:6-8`) — genuinely required (`process.loadEnvFile`, `review.ts:141`). Matches `.nvmrc` 22.14.0 / CI's `node-version: 22`.
- Optional type-check step: `npx tsc --noEmit -p packages/code-reviewer` (`packages/code-reviewer/CLAUDE.md:8`). Package is excluded from root ESLint (`eslint.config.js:81`) and root tsconfig (`tsconfig.json:4`), so existing `ci` job never touches it.

**I/O contract**
- stdin: unified git diff, read fully (`review.ts:81-87`). stdout: exactly one pretty-printed JSON doc `{scores, findings, verdict, summary}` (`review.ts:240`; shape `schema.ts:17-60`). stderr: progress, scores table, and the machine-greppable cost line (`review.ts:234-238`): `Tokens: <in> in / <out> out | Cost: $X.XXXX | Time: Ns`.
- `scores`: six 1–10 ints — `correctness`, `typeIdiom`, `complexity`, `testCoverage`, `security`, `configDeployment` (`schema.ts:17-26`). `findings[]`: `{file, line (0 = file-level), criterion (1-6), severity: blocker|major|minor, description, suggestedFix}` (`schema.ts:28-43`). `verdict` recomputed in code by `deriveVerdict` — pass iff all scores ≥ 5 and no blocker (`schema.ts:67-71`).
- **Exit codes** (`review.ts:17-19`): `0` pass (also when the diff is noise-only — then **no stdout JSON**, `review.ts:167-170`); `1` review fail, exclusively (`review.ts:241`); `2` everything else — TTY/no-pipe (`:145-147`), empty stdin (`:149-151`), no `diff --git` headers (`:153-156`), over-budget (`:174-180`), missing `ANTHROPIC_API_KEY` (`:182-190`), missing rubric (`:192-197`), API failure after SDK retries (`:213-215`), top-level catch (`:244-247`).

**Configuration**
- Env: `ANTHROPIC_API_KEY` (required, `review.ts:182`), `REVIEW_MODEL` (override, `review.ts:143`). Precedence: `--model` flag > `REVIEW_MODEL` > default `claude-haiku-4-5` (`review.ts:21,138,143`). `--model` is the only flag; unknown flags throw → exit 2.
- Repo-root `.env` loaded if present, shell env wins (`review.ts:35,141`) — on CI, plain env from secrets works with no `.env`.
- Rubric `context/team/code-review-dod.md` resolved **file-relative** (`import.meta.url` → repo root, `review.ts:31-34`) — cwd-independent; missing → exit 2.

**Budget guard**
- `MAX_DIFF_LINES = 4000` (`review.ts:22`), counted after noise stripping (lockfiles, `context/**`, `public/**` binaries — `review.ts:69-79`), checked **before** the API-key check and any API call (`review.ts:172-180`). Message: "Refusing to review: N changed lines ... Split the change or review it by hand." → exit 2, which matches the requirements' intended "split this PR" red check.

**Cost**
- Computed client-side from token usage against a hardcoded price table (haiku-4-5 $1/$5, sonnet-4-6 $3/$15 per MTok — `review.ts:25-29,220-224`). **Not in the JSON** — stderr only. The PR-comment step must either parse stderr (regex precedent: `fixtures.ts:115` uses `/^Tokens: .*$/m`) or the JSON must be extended (contract change — requirements say consume as-is).

**CI fragility notes**
- Diff must be piped and un-colored: use `git diff --no-color origin/<base>...HEAD` (precedent `fixtures.ts:83-87`); ANSI headers → exit 2.
- `fetch-depth: 0` on checkout is required for the three-dot merge-base diff (known M5L3 pitfall; also impl-review F5 flagged shallow-clone SHA issues).
- Deps: AI SDK v6 (`ai@6.0.246`, `@ai-sdk/anthropic@3.0.107`), zod 4, tsx — only network egress is `api.anthropic.com`. No writes, no TTY prompts.

### 2. Existing GitHub Actions conventions (`.github/workflows/ci.yml`)

- The **only** workflow file; no `.github/actions/`, no dependabot/CODEOWNERS/templates. The composite action `.github/actions/ai-reviewer/` will be the repo's first.
- `name: CI`; triggers `push`/`pull_request` on `[main]` (`ci.yml:3-7`). Two parallel jobs on `ubuntu-latest`: `ci` (`ci.yml:10`) and `e2e` (`ci.yml:63`). **Neither sets `name:`** — the branch-protection check strings are exactly the job ids **`ci`** and **`e2e`**. The review job should follow the same convention (bare job id = check name) to keep required-check strings predictable.
- Pinning style: all first-party actions on major tags — `actions/checkout@v4` (`ci.yml:13,66`), `actions/setup-node@v4` (`:14,67`), `actions/cache@v4` (`:73`), `actions/upload-artifact@v4` (`:103`). Consistent with the requirements' "first-party `actions/*` may stay on major tags"; any third-party action must be SHA-pinned (none exist yet).
- Node setup: `node-version: 22`, `cache: npm` (`ci.yml:14-17`) — hardcoded major, not `node-version-file: .nvmrc` (mild drift vs 22.14.0; match `22` for consistency).
- **No `permissions:`, `concurrency:`, `timeout-minutes`, or `env:` blocks anywhere** — adding them to `review.yml` is an improvement, not a house-style deviation.
- Secrets usage precedent: only `SUPABASE_URL`/`SUPABASE_KEY` on the build step (`ci.yml:26-28`). No `vars.*` usage anywhere yet — `REVIEW_MODEL` as a repo variable would be the first.
- The review job needs **no Supabase/Docker bootstrap** (stage-1 archive `research.md:73` says explicitly: do not copy the bootstrap block). It only needs: checkout (fetch-depth 0) → setup-node → `npm --prefix packages/code-reviewer ci` → pipe diff → post side effects via `gh`.
- Closest precedent for adding a gate job: commit `9e6b23e` (e2e change phase 5, "blocking e2e CI job").

### 3. Live GitHub repo state (checked via `gh`, 2026-08-08)

- Repo: `vince307/mathshop`, **private**, default branch `main`.
- **Branch protection & rulesets: HTTP 403 — "Upgrade to GitHub Pro or make this repository public to enable this feature."** Both `branches/main/protection` and `rulesets` endpoints. Corroborates the stage-1 archive's open blocker (unresolved since 2026-06-11).
- Actions secrets: `ANTHROPIC_API_KEY` (created **2026-08-08T18:29Z** — already in place), `SUPABASE_KEY`, `SUPABASE_URL`. Repo variables: **none** (`REVIEW_MODEL` not set — fine, the CLI defaults to `claude-haiku-4-5`).
- Labels: only defaults + roadmap-process labels (`roadmap`, `foundation`, `ready`, `slice`, `proposed`, `stream-a/b/c`, `north-star`). **No `ai-cr:*` labels** — must be created (one-time `gh label create` or idempotent workflow step).

### 4. Stage-1 decisions and review findings that bind stage 2

Settled decisions (do not relitigate — archive `plan-brief.md:20-31`): no npm workspaces; AI SDK v6 pinned; verdict derived in code; exit codes 0/1/2 with "1 exclusively means the code failed review" (`plan.md:56`); stdout JSON only, nothing on disk; default model `claude-haiku-4-5`.

Impl-review findings with stage-2 relevance (archive `reviews/impl-review.md`, all FIXED except F7 accepted):
- **F2**: non-diff garbage on stdin now exits 2 — a broken CI pipe can't read as a green gate.
- **F3**: crafted filenames (`evil b/context/x.ts`) could evade the noise filter — fixed, but **quoted/octal-escaped paths remain a stage-2 note** (matters if third-party PRs are ever reviewed).
- **F5**: fixtures pin 7-char SHAs — shallow CI clones break them; note full-SHA + `fetch-depth: 0` (fixtures aren't part of the gate, but the fetch-depth lesson applies to the diff itself).
- **F6 / `change.md:21` stage-2 hardening list (verbatim commitments)**: bound stdin size before buffering; `loadEnvFile` pulls the whole `.env` (service-role key, SMTP) into `process.env` — narrow if the tool ever spawns children; **prompt-injection via diff content can steer scores** (inherent LLM-review limit — document before gating third-party PRs); quoted/octal path bypasses.
- The env-var-sync finding: `archive change.md:16` — "`ANTHROPIC_API_KEY` becomes a GitHub Actions secret — mind fork-PR secret exposure". Secret now exists; **fork-PR exposure** is moot-ish for a solo private repo but should be handled anyway (`pull_request` from forks doesn't get secrets by default — the gate will exit 2 on fork PRs; worth a deliberate note in the plan).

Rubric (`context/team/code-review-dod.md`): six criteria, fail if any < 5 or any blocker. **Criterion 6 "Config & deployment safety"** (`:42-47`) is the acceptance anchor — its score-1 anchor is literally "renamed/removed env var without updating `.env.example`, CI, and Vercel", which is acceptance test #1. Self-referential loop: `review.yml` itself is a criterion-6 "CI workflow edit" — the gate will review its own follow-up edits.

Mom Test validation (`context/team/mom-test-validation.md`): the gate's justification is enforcement, not tooling — "review exists but is unenforced" (`:21`); "branch protection + required status checks are adopted as the enforcement layer, not rebuilt" (`:23`, `:57`); evidence: 2h config-incident downtime, 5/5 recent merges unreviewed (`:15-17`). Verdict GO (`:61`). This is why the branch-protection 403 needs an explicit resolution, not a shrug.

### 5. `.env.example` and docs to touch

- `.env.example:16-19`: comment says the key "powers ONLY the local code-review agent … the app never reads it" — requirements (`requirements.md:26`) call for updating it to mention the CI Actions secret. Constraint stands: never add `ANTHROPIC_API_KEY` to `astro.config.mjs` `env.schema` (archive `plan.md:97`).
- Parked stale-docs sweep (archive `change.md:18`) overlaps: `ci.yml:33` stale "merge-blocking" comment, `README.md` §CI, root `CLAUDE.md` "No test runner is wired yet" — the plan may fold in the ones the workflow touches.

## Code References

- `packages/code-reviewer/review.ts:17-19` — exit-code constants (0 pass / 1 fail / 2 setup)
- `packages/code-reviewer/review.ts:21-22` — default model `claude-haiku-4-5`, `MAX_DIFF_LINES = 4000`
- `packages/code-reviewer/review.ts:31-35` — file-relative rubric/.env resolution (cwd-safe)
- `packages/code-reviewer/review.ts:143` — `REVIEW_MODEL` env override
- `packages/code-reviewer/review.ts:145-156` — TTY / empty-stdin / non-diff guards (all exit 2)
- `packages/code-reviewer/review.ts:167-180` — noise-only exit 0 (no stdout JSON); budget guard exit 2
- `packages/code-reviewer/review.ts:234-241` — stderr cost line; exit 1 on fail verdict
- `packages/code-reviewer/schema.ts:17-71` — JSON shape + `deriveVerdict`
- `packages/code-reviewer/fixtures.ts:83-87,115` — `--no-color` precedent; cost-line regex `/^Tokens: .*$/m`
- `packages/code-reviewer/CLAUDE.md:8-12` — install/type-check commands, CLI contract
- `.github/workflows/ci.yml:10,63` — job ids `ci`/`e2e` = required-check names
- `.github/workflows/ci.yml:13-18,26-28` — checkout/setup-node/npm ci pattern; secrets precedent
- `context/team/code-review-dod.md:42-54` — criterion 6 + verdict rules
- `.env.example:16-19` — ANTHROPIC_API_KEY comment to update

## Architecture Insights

- **The agent/workflow boundary is already clean**: agent = pure stdin→stdout/exit-code function; all GitHub side effects (comment upsert, labels) belong to workflow steps via `gh` with `GITHUB_TOKEN` (`pull-requests: write`). Nothing in the CLI needs to change — the requirements' "consume as-is" constraint holds.
- **Check-name convention**: bare job ids. Name the review job something stable (e.g. `review`) and never add a `name:` key, so the (future) required-check string is exactly the job id.
- **Two structural gaps the CLI hands the workflow**: (a) the noise-only-pass emits no JSON, so the comment step needs an "empty stdout = pass, no findings" branch; (b) cost is stderr-only, so the workflow must capture both streams separately (e.g. `1>review.json 2>review.log`) and grep the `Tokens:` line.
- **Exit 2 vs exit 1 in the check**: both must fail the check (requirements), but logs should distinguish them; a step that captures the exit code and prints "review failed" vs "setup/budget error — not a code verdict" keeps F1's hard-won distinction visible in CI.
- **Fork PRs**: `pull_request` runs from forks get no secrets → missing `ANTHROPIC_API_KEY` → exit 2 (red check, but a confusing one). Solo private repo makes this theoretical today; a `github.event.pull_request.head.repo.fork == false` guard (or accepting the red check) should be a deliberate plan decision. Avoid `pull_request_target` — that's the classic secret-exfiltration trap.
- **Label-retrigger loop**: trigger on `labeled` + filter `github.event.label.name == 'ai-cr:review'`, then remove the label via `gh` — needs `pull-requests: write`, which is already required for comments/labels.

## Historical Context (from prior changes)

- `context/archive/2026-08-08-ai-code-review/` (note: archive folders are **date-prefixed**) — stage-1 change: `plan-brief.md:20-31` decisions table; `plan.md:56` exit-code semantics; `reviews/impl-review.md` findings F1–F7; `change.md:14-21` the verbatim stage-2 scope + hardening list, **including the branch-protection 403 blocker "unresolved since 2026-06-11"**.
- `context/team/mom-test-validation.md` — GO verdict; enforcement (branch protection) is the point, floor-2 of the cheapest-fix ladder.
- Commit `9e6b23e` — precedent: e2e job added as a blocking CI gate (testing-e2e-playwright change).
- Known-bad fixture commit `d6c93d8` (reversed) — a 1-line env-var removal from CI; the class of change the gate exists to catch.

## Related Research

- `context/archive/2026-08-08-ai-code-review/research.md` — stage-1 research (AI SDK v6 choice, cost measurements at `:118`, CI-shape notes at `:70-77`).
- Future sibling change (named only): `code-review-evals` (promptfoo; `fixtures.ts` rows as seed cases) — no folder yet, no overlap today.

## Open Questions

1. **Branch protection (DoD conflict, needs a user decision):** private repo on GitHub Free → protection/rulesets 403. Options: upgrade to GitHub Pro (~$4/mo), make the repo public, or land the gate advisory-only (red check visible but not merge-blocking) and record the residual risk. The requirements make protection part of DoD, so the plan can't silently pick.
2. **Label bootstrap:** create `ai-cr:*` labels once by hand (`gh label create`) or idempotently in the workflow (`gh label create --force` per run)? (Idempotent step is self-healing; one-time is cleaner logs.)
3. **Fork-PR stance:** guard the job (`!github.event.pull_request.head.repo.fork`) vs. accept exit-2 red checks on fork PRs. Theoretical for a solo private repo, but cheap to decide now.
4. **Draft-PR skip mechanics:** requirements say don't run on drafts — `if: !github.event.pull_request.draft` leaves the check absent on drafts; confirm that's acceptable for the (future) required-check semantics (a skipped required check blocks merge; drafts can't merge anyway, so likely fine — verify when protection exists).
5. **Cost surfacing:** parse the stderr `Tokens:` line (regex precedent exists) — acceptable, or extend the JSON contract later? (Requirements: consume CLI as-is → stderr parsing for now.)
