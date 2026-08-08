---
date: 2026-08-08T15:22:25+0200
researcher: Claude Code
git_commit: 9ee3a49a3d33c2007b1cd5c7ea87e9fdff0e2775
branch: main
repository: 10xDevs
topic: "Local AI code review agent (stage 1) — repo grounding, AI SDK v6 facts, CI/noise profile, historical patterns"
tags: [research, codebase, ai-code-review, code-reviewer, vercel-ai-sdk, ci, tooling]
status: complete
last_updated: 2026-08-08
last_updated_by: Claude Code
---

# Research: Local AI code review agent (stage 1)

**Date**: 2026-08-08T15:22:25+0200
**Researcher**: Claude Code
**Git Commit**: 9ee3a49a3d33c2007b1cd5c7ea87e9fdff0e2775
**Branch**: main
**Repository**: 10xDevs

## Research Question

Ground the plan for `context/changes/ai-code-review/requirements.md`: a stage-1 local review agent (`git diff main...HEAD | npx tsx review.ts` → JSON verdict, exit 0/1) built on Vercel AI SDK v6 + `@ai-sdk/anthropic`, loading `context/team/code-review-dod.md` as its rubric, in an isolated workspace whose deps never enter the app's dependency tree. The requirements explicitly defer the workspace layout to research (`requirements.md:16`).

## Summary

1. **The repo is a flat single-package Astro app — `packages/` is a new pattern, and three tooling surfaces will sweep it in unless explicitly fenced off.** Root `tsconfig.json` includes `**/*` (so `astro check` in CI would type-check the new package against deps that aren't installed at root and go red), ESLint inherits ignores only from `.gitignore` (so `npm run lint` and the husky pre-commit `eslint --fix` run type-checked rules on it), and Prettier has no `.prettierignore`. The isolation-preserving combo: `packages/code-reviewer/` with its own `package.json` + committed nested lockfile (no npm `workspaces` — workspaces would hoist the AI SDK back into the root lockfile), `"packages"` added to root tsconfig `exclude`, a package-local `tsconfig.json`, and an ESLint ignore for `packages/**`.
2. **AI SDK version correction: v6 is a superseded major.** `ai@latest` is now **7.0.58**; building on v6 as the requirements specify means pinning the `ai-v6` dist-tag → `ai@6.0.x` + `@ai-sdk/anthropic@3.0.x`. Zod v4 is fully supported. In v6, `generateObject` is deprecated — the idiomatic shape is `generateText` with `output: Output.object({ schema })`, which composes with `tools` + `stopWhen: stepCountIs(2)`; `ToolLoopAgent` is the reusable-instance variant. Use `result.totalUsage` (summed across steps) for cost reporting.
3. **Model ids verified, cost matches the budget.** `claude-haiku-4-5` ($1/$5 per MTok) and `claude-sonnet-4-6` ($3/$15) are both valid current Anthropic API ids. A typical review (~5–15K input tokens post-strip, ~1–2K output) ≈ **$0.01–0.02 on Haiku**, ~$0.05–0.10 on Sonnet. `claude-sonnet-5` exists at the same list price — free swap later since the model id is a CLI arg/env var.
4. **Diff-noise profile is repo-specific**: the two dominant noise sources are `package-lock.json` (563 KB; single commits added 1000–12500 lock lines) and `context/**/*.md` plan-checkbox churn (644 of 917 lines in one commit). There are **no** snapshot files and no committed `dist/`. `supabase/migrations/` must NOT be stripped — migrations are criterion-6 material. Realistic post-strip diffs are 100–500 lines; the 4000-line budget guard is comfortably above everything except the scaffold commit.
5. **Test fixtures exist in git history**: known-bad config-class change `07da072` (parent-PIN gate — four independent later commits fixed its env-var/CI/docs/fail-open gaps; the best committed proxy for the 2h-downtime incident class), trivially-clean `9ee3a49` (1-line timestamp fix), and noise/budget exerciser `3ba28eb` (1015 of 1336 lines are lockfile). The actual downtime incident (Supabase dashboard config) is not reproducible from git.
6. **Stage-2 enforcement is blocked**: branch protection / required checks return 403 on this GitHub Free + private repo — documented and unresolved since 2026-06-11. Stage 2's gate will be advisory-only until a plan upgrade or visibility change; the plan should carry this as an open risk, not an assumption.

## Detailed Findings

### 1. Workspace layout — the deferred decision

No `packages/`, `scripts/`, or tools directory exists; tracked top-level dirs are `.github .husky .vscode context docs e2e public src supabase tests` (`git ls-files`). Root `package.json` has **no `workspaces`, no `engines`, no `packageManager`** — single-package npm repo (`package.json:1-82`), Node pinned via `.nvmrc` → `22.14.0`.

Options weighed:

| Option | Isolation | Fit with precedent | Cost |
|---|---|---|---|
| (a) top-level sibling dir (like `e2e/`), deps in root | ✗ AI SDK enters root tree | ✓ matches `tests/`/`e2e/` precedent | violates requirements.md:16 |
| (b) `packages/code-reviewer/` own `package.json` + nested lockfile, **no** workspaces | ✓ root `npm ci` untouched; nested `node_modules` auto-ignored (`.gitignore:8`); nested lockfile committed for reproducibility | new pattern (justify in plan) | needs explicit `npm --prefix packages/code-reviewer ci` install step (README + stage-2 CI) |
| (c) npm workspaces | ✗ deps land in the **root** lockfile and root `npm ci` | new pattern | defeats the purpose |

**(b) is the only option satisfying the isolation requirement.** Required fencing (all verified live):

- `tsconfig.json:3-4` — `include: ["**/*"]`, `exclude: ["dist", "assets"]` → **add `"packages"` to `exclude`**, else CI's `npm run check` (`astro check`, `.github/workflows/ci.yml:23`) type-checks `review.ts` with unresolvable imports after a root-only `npm ci`.
- `eslint.config.js:12,78` — ignores come solely from `.gitignore`; `baseConfig` (`:14-38`, `strictTypeChecked` + `projectService: true`) has no `files` restriction → `eslint .` and pre-commit lint the package. With `"packages"` excluded from the root tsconfig and no package tsconfig, typescript-eslint throws "file was not found by the project service" and **pre-commit fails hard**. → add `packages/**` to ESLint ignores (or global ignores entry) and let the package self-lint; a package-local `tsconfig.json` including `**/*.ts` is needed regardless.
- lint-staged (`package.json:74-81`) matches by basename — `*.{ts,tsx,astro}` catches `packages/code-reviewer/review.ts` via husky `.husky/pre-commit:1` (`npx lint-staged`). The ESLint-ignore route neutralizes this (ignored files are skipped with a warning).
- No `.prettierignore` exists; `npm run format` (`prettier --write .`) will reformat package files. Acceptable, or add `.prettierignore` if the package should self-govern.
- `no-console: "warn"` (`eslint.config.js:23`) — a stdout-reporting CLI is exactly the case for keeping the package outside the app's ESLint config.
- Package-local tsconfig note: root inherits `astro/tsconfigs/strict` with `moduleResolution: "Bundler"` + `verbatimModuleSyntax` — wrong-ish for a Node CLI; the package tsconfig should target `module: esnext` / `moduleResolution: "bundler"` (tsx is happy with either) with `strict: true`.
- `tsx` is **not installed** anywhere (only a transitive optional peer in the lockfile) → declare it as a devDependency of the package so `npx tsx` resolves deterministically instead of prompting a download.
- `zod ^4.4.3` is already a root dependency (`package.json:40`) but the package must declare its own zod (AI SDK v6 peer: `^3.25.76 || ^4.1.8`) so it never hoist-resolves against the app's copy.

### 2. Env & secrets

- `.env` is gitignored (`.gitignore:17`); `.env.example` is committed and the **working tree already carries an uncommitted line 16 `ANTHROPIC_API_KEY=###`** — the only change vs HEAD. The plan should land this line (with a comment, per house pattern below) as part of the change.
- A real `sk-ant-api03-…` key already sits in the local `.env:14` (gitignored — flagged as a live secret on disk, fine but worth knowing).
- `ANTHROPIC_API_KEY` is deliberately **absent from `astro.config.mjs`'s `env.schema`** (`astro.config.mjs:21-37`) — keep it out; the app must never depend on it. The CLAUDE.md rule "secrets via `astro:env/server`, never `import.meta.env`" applies to the *app*; a standalone Node script outside the Astro build cannot use `astro:env` and must use `process.env`/dotenv — a deliberate, documentable deviation (precedent: `context/archive/2026-07-01-skill-path-upgrade-gate/plan.md:302` states the app-side rule; the boundary reasoning is in §Historical Context).
- House pattern for introducing a secret (isolation-contract + production-email changes): `.env.example` placeholder + comment naming where the value comes from; key exists only in the operator's shell/`.env`; verification is a literal `git grep` of the key returning nothing (`context/archive/2026-07-10-production-email-delivery/plan.md:153,175`).
- **Exit-code design**: prior lesson — a missing env var must fail loudly as a *setup* error, never masquerade as a product/review failure (`context/archive/2026-07-12-testing-e2e-playwright/plan.md:14,115`). Since exit 1 is reserved for `verdict: fail`, config/budget errors need **exit 2**.

### 3. CI today and the stage-2 slot

Single workflow `.github/workflows/ci.yml` (109 lines): triggers `push`/`pull_request` → `main` (`:3-7`), **no `concurrency`, no `timeout-minutes`, no `permissions` block**. Job `ci` (`:10-57`): `npm ci` → `astro sync` → `check` → `lint` → `build` (only place repo secrets `SUPABASE_URL`/`SUPABASE_KEY` are used, `:26-28`) → local Supabase stack + `db reset` → env export (incl. hardcoded `PARENT_SESSION_SECRET` literal, `:53`) → `vitest run`. Job `e2e` (`:63-109`) runs **in parallel** (deliberately not `needs`-chained, comment `:59-62`), duplicating ~30 lines of Supabase bootstrap; Playwright browser cache; artifacts on failure only.

Stage-2 implications (recorded for the follow-up change, not this one):
- The review job becomes a **third parallel job needing no Supabase/Docker** — do not copy the bootstrap block.
- `ANTHROPIC_API_KEY` → new GitHub Actions secret (GitHub Secrets is the right store for a CI-only key, not Vercel — `context/foundation/infrastructure.md:82`).
- Fork-PR secret exposure needs a thought (`infrastructure.md:81`).
- CI hardcodes `node-version: 22` while `.nvmrc` pins `22.14.0` — minor drift, not this change's problem.
- **Blocker**: branch protection / required checks are unavailable — GitHub Free + private returns 403 (`context/archive/2026-06-09-per-account-isolation-contract/plan.md:456`, restated in its impl-review and follow-ups; repo recorded as `github.com/vince307/mathshop`, private, in `context/deployment/deploy-plan.md`). The `ci.yml:33` comment calling the isolation test "merge-blocking" is stale. Until plan/visibility changes, any gate is advisory.

### 4. Diff-noise profile and stripping rules

Never in diffs (gitignored, no stripping needed): `dist/`, `.astro/`, `node_modules/`, `.env*`, `.vercel`, `.wrangler/`, `.claude/`, `assets/`, `coverage/`, `playwright-report/`, `test-results/`, `blob-report/` (`.gitignore:2-47`).

Committed noise worth stripping (328 tracked files total):
- `package-lock.json` — 563,239 bytes; historical commits added +1015 (`3ba28eb`), +1869 (`c31ecb9`), +12510 (`cec0de4`) lock lines. Single biggest source.
- `public/**` binaries — 19 tracked (`*.png`, `*.webp`, `*.svg`; `public/template.png` = 1.27 MB). Git emits "Binary files differ" but paths still add tokens.
- `context/**/*.md` — **the repo-specific noise source**: plan-checkbox churn dominated real diffs (`1190b10`: 644 of 917 lines; `30350cb`: 113 of 214). Strip by default; optionally keep `context/changes/<id>/change.md` for intent.
- `context/archive/**` — archival commits are 100% renames (`475435f`).

Do **not** strip: `supabase/` content (only hand-written `config.toml`, 10 migrations, an email template — migrations are explicitly criterion-6 material, `context/team/code-review-dod.md:44`). No `*.snap` files or snapshot dirs exist anywhere; don't build stripping for them.

Size profile: last-20-commits median ~135 changed lines, realistic `main...HEAD` diffs 100–1500 lines, dropping to ~500 max after stripping. The 4000-line guard (`requirements.md:49`) exceeds everything but the scaffold (`cec0de4`, 15,656 lines).

### 5. Historical test fixtures (acceptance §requirements.md:44-49)

- **Known-bad config-class (must score <5 on criterion 6): `07da072`** — `feat(skill-path-upgrade-gate): parent-PIN gate (p5)`, 14 files / 750 lines. Introduced `PARENT_SESSION_SECRET` while: missing it from `.env.example` (fixed 9 days later by `26dd33e`), missing it from both CI jobs (fixed by `d6c93d8` a week+ later, latent because `astro check` failed first), documenting the wrong Vercel scope (fixed by `33963de`), and falling back to an **empty HMAC key** instead of failing closed (hardened by `41af275`). Four independent fixes to one config change = defensible ground truth. Also carries a migration + new API routes (criteria 4/5 material).
- **Tiny known-bad variant**: `git show d6c93d8 -R` — the 1-line inverse (removing `PARENT_SESSION_SECRET` from the CI env export) should trip criterion 6's "removed env var without updating CI". Cheap to iterate on.
- **Trivially clean (must pass): `9ee3a49`** — 1-line frontmatter timestamp fix in an archived change.md. Alternatives: `9e61731`, `66a3620`, `0f2b78f`.
- **Noise/budget exerciser: `3ba28eb`** — 1336 lines of which 1015 are `package-lock.json`; post-strip ~320 lines. Exercises stripping + the cost path near realistic maxima.
- **Borderline/should-pass: `879315e`** — account-deletion service-role introduction that *did* sync `.env.example`; useful as a not-cry-wolf case with real security surface.
- The actual ~2h-downtime incident (`context/team/mom-test-validation.md:15`) was hosted-Supabase dashboard config (MAT-14, `context/archive/2026-07-10-production-email-delivery/research.md:32,74`) — **no commit exists**; `07da072` is the closest committed proxy.

### 6. Vercel AI SDK v6 + @ai-sdk/anthropic — verified API facts

*(All verified 2026-08-08 against npm dist-tags, ai-sdk.dev migration guides, and context7 docs pinned to `ai@6.0.0`.)*

- **Versions**: `ai@latest` = **7.0.58**; v6 line = `ai@6.0.246` via dist-tag `ai-v6`; matching provider `@ai-sdk/anthropic@3.0.107` (`ai-v6` tag; its `latest` is 4.x for SDK v7). Pin explicitly: `"ai": "^6.0.246"`, `"@ai-sdk/anthropic": "^3.0.107"`. Zod peer `^3.25.76 || ^4.1.8` → **zod v4 supported**; `z.toJSONSchema` never called by hand (matches `requirements.md:17`).
- **Agent shape**: `ToolLoopAgent` (v6 rename of `Experimental_Agent`) — `new ToolLoopAgent({ model, instructions, tools, stopWhen: stepCountIs(2) })`, run via `.generate({ prompt })`. `instructions` is the v6 name for the system prompt; default `stopWhen` is `stepCountIs(20)`. `stepCountIs(n)` is a **maximum** — the loop also ends when a step produces no tool calls. Equivalent: plain `generateText({ model, tools, stopWhen, ... })`. **For a reviewer whose only flow is "read context → emit verdict", plain `generateText` is the simplest correct v6 shape**; `ToolLoopAgent` only buys a reusable configured instance.
- **Structured output**: `generateObject` is **deprecated in v6** → `generateText` with `output: Output.object({ schema: ReviewSchema })`; the validated object is on `result.output` (typed as `z.infer<...>`). Composes with `tools`/`stopWhen`, so a 2-step loop can terminate in validated JSON.
- **Usage/cost**: use `result.totalUsage` (all steps; `result.usage` is final-step-only in v6). Fields: `inputTokens`, `outputTokens`, `totalTokens`, `inputTokenDetails.{noCacheTokens,cacheReadTokens,cacheWriteTokens}`, `outputTokenDetails.{textTokens,reasoningTokens}` (legacy `cachedInputTokens` deprecated). SDK returns tokens only — cost is computed client-side from a price table. Raw provider fields additionally on `result.providerMetadata?.anthropic`.
- **Provider**: `createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })` → `anthropic('claude-haiku-4-5')`. `maxOutputTokens` (v5+ rename of `maxTokens`) and `temperature` are top-level call settings, not provider options. `providerOptions.anthropic` carries `cacheControl` (prompt caching) and `thinking` — **omit thinking entirely** for this agent (Haiku 4.5 uses the old `budgetTokens` form; not needed for a cheap reviewer).
- **v7 deltas if ever upgrading** (small): `system`→`instructions` on `generateText`, `stepCountIs`→`isStepCount`, top-level `usage` sums all steps (`totalUsage` deprecated), result `output` → `result.finalStep` moves for providerMetadata, Node 22+/ESM only. Codemod exists (`npx @ai-sdk/codemod`).

### 7. Models & cost (verified via claude-api reference)

- `claude-haiku-4-5` — valid current id (alias of `claude-haiku-4-5-20251001`), $1/$5 per MTok, 200K context, 64K max output.
- `claude-sonnet-4-6` — valid current id, $3/$15 per MTok, 1M context. (`claude-sonnet-5` exists at the same list price, intro $2/$10 through 2026-08-31 — model id is a CLI arg/env var per requirements, so swapping later is free.)
- Never append date suffixes to these ids.
- Cost per review at ~5–15K input / 1–2K output tokens: **Haiku ≈ $0.01–0.02** (matches `requirements.md:49`), Sonnet ≈ $0.05–0.10. Cache reads ≈ 0.1× input price, writes 1.25× (5-min TTL) if prompt caching is used on the rubric.

### 8. Rubric & output-contract alignment

- Rubric file: `context/team/code-review-dod.md` — 6 criteria with anchored 1/10 descriptions; verdict rules at `:49-54` (pass = all ≥5 and no blocker findings; fail = any <5 or any blocker; every finding names file/line, criterion, severity `blocker/major/minor`, concrete fix; summary = 2–3 sentences of actionable Markdown). The zod schema falls out of `:49-54` almost mechanically.
- The house `reviews/impl-review.md` format (e.g. `context/archive/2026-06-19-testing-auth-critical-path/reviews/impl-review.md:1-85`) — findings as `F<n>` with Severity / Dimension / Location (file:line) / Detail / Fix — is the human counterpart of the JSON verdict; aligning the finding shape is a free consistency win.
- L-003 (i18n, all user-visible strings Polish) is scoped to product UI; the reviewer's output is developer-facing English/JSON — the plan should state this explicitly so the agent doesn't flag itself.

## Code References

- `context/changes/ai-code-review/requirements.md:16` — layout deferred to research; `:44-49` acceptance; `:52-55` constraints
- `context/team/code-review-dod.md:3,44-47,49-54` — rubric, criterion 6, verdict rules
- `package.json:2-17,40,74-81` — single package, scripts, zod, lint-staged config
- `tsconfig.json:3-4` — `include: ["**/*"]`, `exclude: ["dist","assets"]` (must add `"packages"`)
- `eslint.config.js:12,14-38,78,84` — gitignore-derived ignores, unrestricted type-checked base config, prettier-as-error
- `.husky/pre-commit:1` — `npx lint-staged`
- `.gitignore:2-47` — full ignore inventory; nothing about `packages/`
- `.env.example:16` — uncommitted `ANTHROPIC_API_KEY=###` line (the only working-tree delta)
- `astro.config.mjs:21-37` — `astro:env` schema (deliberately excludes ANTHROPIC_API_KEY)
- `.github/workflows/ci.yml:3-7,10-57,63-109` — triggers, ci job, e2e job; `:23-24` the check/lint steps a stray package file would break; `:33` stale "merge-blocking" comment
- `vitest.config.ts:31` — `include: ["tests/**"]` (package is outside root test glob)
- Fixtures: `07da072`, `d6c93d8`, `9ee3a49`, `3ba28eb`, `879315e` (git history)

## Architecture Insights

- **Recommended layout**: `packages/code-reviewer/{package.json, package-lock.json (committed), tsconfig.json, review.ts, CLAUDE.md}` — no npm workspaces; deps `ai@^6.0.246`, `@ai-sdk/anthropic@^3.0.107`, `zod@^4`, `tsx` (devDep), optionally `dotenv`. Root-side edits: tsconfig `exclude` + ESLint ignore for `packages/**` (+ optional `.prettierignore`). `e2e/CLAUDE.md` is the precedent for a directory-scoped agent-rules file.
- **Recommended agent shape**: plain `generateText` + `output: Output.object({ schema })` (+ `stopWhen: stepCountIs(2)` only if a tool is added); rubric read from disk at runtime; diff from stdin; model id from `--model`/`REVIEW_MODEL` env with `claude-haiku-4-5` default.
- **Exit codes**: 0 pass / 1 fail / 2 config-or-budget error (missing key, oversized diff) — so tool misconfiguration never reads as "bad code".
- **House plan skeleton** to follow: `context/archive/2026-07-12-testing-e2e-playwright/plan.md` (Overview → Current State → Desired End State + Key Discoveries → NOT Doing → phases with File/Intent/Contract triplets, Automated vs Manual verification, pause between phases → Migration Notes one-line rollback → References → Progress with `— <sha>` convention). Deps+scripts is always Changes-Required item #1, stating what stays untouched; one-time setup steps are documented, not postinstall hooks.
- **Meta-check discipline (L-002 generalized)**: prove the gate can go red — known-bad fixture must fail, clean fixture must pass, as explicit Progress checkboxes (`context/foundation/test-plan.md:228-231`: "a spec that stays green when its risk materializes is decorative").

## Historical Context (from prior changes)

- `context/archive/2026-07-12-testing-e2e-playwright/` — closest precedent: infra-first/CI-last phasing ("CI + docs last, once the suite is stable enough to gate merges", `plan.md:44`); env-fail-fast lesson (`plan.md:14,115`); addendum blocks for sanctioned drift (`plan.md:216-225`); one-line rollback recipe (`plan.md:326-327`).
- `context/archive/2026-06-09-per-account-isolation-contract/plan.md:204-218,300,456` — canonical new-env-file item; the branch-protection 403 blocker (unresolved since 2026-06-11).
- `context/archive/2026-07-01-skill-path-upgrade-gate/` — the known-bad fixture change itself; `reviews/impl-review.md:41` — "`?? ""` on a secret made HMAC markers forgeable" → never default a missing secret; fail closed.
- `context/archive/2026-07-11-account-deletion/plan.md:17,205,301` — prod-env drift found late; secret provisioning as explicit ops checkbox ("no secrets leaked").
- `context/archive/2026-07-10-production-email-delivery/plan.md:153,175` — third-party API-key handling model (`git grep` verification).
- `context/foundation/test-plan.md:112-120` — §5 Quality Gates table is where a stage-2 "AI code review verdict" row belongs; `:295` parks the overlapping gitleaks/service-key-grep idea (state "not replacing" explicitly); `:74-80` all test phases complete, no pending CI phases.
- `context/foundation/tech-stack.md:1-20` — `has_ai: false` frontmatter becomes stale with this change; note the reviewer is dev-tooling, not product AI (or flip the flag).
- Stale docs worth truthing-up in the plan's docs phase: `CLAUDE.md:29` ("No test runner is wired yet" — false), `AGENTS.md:39` (wrong branch `master`, wrong CI description), `README.md:184-186` (§CI predates check/test/e2e steps), `ci.yml:33` (stale "merge-blocking").

## Related Research

- `context/archive/2026-07-12-testing-e2e-playwright/research.md` — tooling-introduction research pattern; `:87` env name-mapping trap
- `context/archive/2026-06-19-testing-auth-critical-path/research.md:30,145,168` — "docs say X, repo says Y" verification habit; tsconfig-alias mirroring friction
- `context/team/opportunity-map.md`, `context/team/mom-test-validation.md` — problem validation (GO, tests-first ordering)

## Open Questions

1. **v6 vs v7**: requirements pin v6 ("keep it a narrow 2-step loop"), but v6 is a superseded major and the v7 deltas are small (codemod exists). Recommend building on pinned v6 per requirements and recording v7 migration as a parked follow-up — but the planner may choose v7 outright; decide in the plan's Key Decisions table.
2. **`context/**` stripping default**: strip all of `context/**/*.md` (max noise reduction) vs keep `context/changes/<current-id>/change.md` for reviewer intent? Recommend strip-all for stage 1 (PR title/description arrive in stage 2 anyway).
3. **Prompt caching on the rubric**: `providerOptions.anthropic.cacheControl` could cut repeat-run cost, but the rubric (~3.5 KB) is likely below Haiku's 4096-token cache minimum — probably not worth it; verify with real token counts during implementation.
4. **Where run artifacts go** (verdict JSON dumps, logs): stdout-only vs a gitignored `packages/code-reviewer/out/` — decide in plan; if files are written, add the `.gitignore` entry (artifact-hygiene pattern).
5. **Committing the `.env.example` line**: the uncommitted `ANTHROPIC_API_KEY=###` edit predates this change's implementation — fold it into the change's first commit (with an explanatory comment, matching the file's house comment style).
