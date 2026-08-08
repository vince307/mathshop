# Local AI Code Review Agent (Stage 1) — Plan Brief

> Full plan: `context/changes/ai-code-review/plan.md`
> Research: `context/changes/ai-code-review/research.md`

## What & Why

A local CLI review agent: `git diff main...HEAD | npx tsx review.ts` in, JSON verdict out — six 1–10 scores against `context/team/code-review-dod.md`, findings with file/line/severity/fix, and exit codes CI can gate on (0 pass / 1 fail / 2 setup error). Validated by the team's opportunity map and Mom Test interviews (verdict: GO); the motivating incident class is the config change that caused 2h of downtime. Stage 2 (the CI job) is a separate follow-up change.

## Starting Point

The repo is a flat single-package Astro app — no `packages/` pattern exists, and three tooling surfaces (root tsconfig's `**/*` include, gitignore-derived ESLint ignores, Prettier) sweep in any new code unless fenced. Tests already run on PR via `ci.yml`; the rubric file exists and is final; known-good and known-bad test fixtures exist in git history.

## Desired End State

Any developer with an `ANTHROPIC_API_KEY` in `.env` can pipe a diff through the reviewer and get a schema-valid verdict in under a minute for ~$0.01–0.02. `npm run fixtures` replays five historical commits and proves the gate goes red on the known-bad config change and green on a trivial fix — so when stage 2 wires it into CI, the gate is already known to work.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Workspace layout | `packages/code-reviewer/`, own `package.json` + committed nested lockfile, **no npm workspaces** | Only option that keeps AI SDK deps out of the root tree (workspaces hoist into the root lockfile) | Research |
| SDK major | AI SDK v6 pinned (`ai-v6` dist-tag: `ai@^6.0.246`, `@ai-sdk/anthropic@^3.0.107`) | Matches requirements and course material; v7 migration parked (codemod exists) | Plan |
| Agent shape | Plain `generateText` + `Output.object({ schema })`, no `ToolLoopAgent` | Simplest correct v6 shape for a read→verdict flow; `generateObject` is deprecated in v6 | Research |
| Verdict computation | Derived in code from scores+findings; model's own `verdict` field overridden | Verdict rules are mechanical — keeps exit codes deterministic and testable | Plan |
| Exit codes | 0 pass / 1 fail / 2 setup-or-budget error | Prior lesson: a missing env var must never masquerade as "bad code" | Research |
| Diff stripping | Strip ALL of `context/**`, `package-lock.json`, `public/**` binaries; keep `supabase/**` | Max noise cut, simplest rule; intent arrives via PR description in stage 2; migrations are criterion-6 material | Plan |
| Artifacts | stdout = JSON verdict only, stderr = logs+cost; nothing on disk | Clean pipe contract, exactly what stage-2 CI consumes | Plan |
| Acceptance fixtures | `npm run fixtures` with hard assertions (07da072 fails + crit-6 < 5, 9ee3a49 passes) + report-only rows | Makes the L-002 "gate goes red" meta-check one repeatable command; seed of the M5L3 eval set | Plan |
| Docs scope | Only docs this change touches; stale-docs sweep parked | Keeps the diff one-concern per our own rubric's criterion 3 | Plan |
| Default model | `claude-haiku-4-5` ($1/$5 MTok), overridable via `--model`/`REVIEW_MODEL` | Cost while iterating; Sonnet swap is free since the id is a parameter | Requirements |

## Scope

**In scope:** new `packages/code-reviewer/` (schema, CLI, fixtures, package CLAUDE.md); root fencing edits (tsconfig `exclude`, ESLint ignore); `.env.example` key line; README usage section; parked-follow-ups note.

**Out of scope:** CI wiring, PR comments/labels (stage 2); PR title/description input; promptfoo evals (M5L3); prompt caching; v7 migration; broad stale-docs sweep; business-alignment review.

## Architecture / Approach

stdin diff → path-based noise stripping → 4000-line budget guard (refuses before any API call) → rubric file + stripped diff into `generateText` with a zod-validated output schema at `temperature: 0` → verdict recomputed mechanically in code → JSON on stdout, cost from `totalUsage` on stderr, exit 0/1/2. The package is dependency-isolated; the app's toolchain never sees it.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Scaffold + fencing | Isolated package; root toolchain provably untouched | Fencing not atomic → pre-commit fails hard ("file not found by project service") |
| 2. Agent core | Working CLI: strip → guard → model → verdict → exit code | v6 API misuse (deprecated `generateObject`, `usage` vs `totalUsage`) |
| 3. Fixture harness | `npm run fixtures` proving the gate goes red/green | LLM variance — mitigated by temperature 0 + coarse assertions (exit codes, not exact scores) |
| 4. Docs | README section, package CLAUDE.md, parked follow-ups | Scope creep into the stale-docs sweep (explicitly parked) |

**Prerequisites:** `ANTHROPIC_API_KEY` (already in local `.env`), Node 22.14 per `.nvmrc`.
**Estimated effort:** ~2–3 sessions across 4 phases; fixture sweep ≈ $0.05/run on Haiku.

## Open Risks & Assumptions

- Stage-2 enforcement is blocked: branch protection / required checks 403 on GitHub Free + private repo (open since 2026-06-11) — the future CI gate is advisory until plan/visibility changes. Stage-1 scope is unaffected.
- LLM scoring variance could flake the borderline fixture (`879315e`) — it's report-only for exactly that reason; only the clear-cut fixtures are hard assertions.
- Assumption: the rubric file stays the single source of truth — prompt tweaks happen in `code-review-dod.md`, not in the agent.

## Success Criteria (Summary)

- A real diff pipes through to a schema-valid verdict in < 60 s at ~$0.01–0.02, with exit codes usable as a gate.
- The known-bad config commit (`07da072`) fails with criterion 6 < 5; the trivial clean commit passes — proven by one repeatable command.
- Root `npm run check/lint/build`, pre-commit, and the root lockfile are byte-for-byte unaffected by the package's existence.
