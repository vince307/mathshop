# AI Code Review — requirements (brainstorm note)

Validated by `context/team/opportunity-map.md` and `context/team/mom-test-validation.md` (verdict: GO, tests-first ordering). Tests already run on PR via `.github/workflows/ci.yml` — this change adds the review gate on top, it does not rebuild CI.

## Overall concept

- Stage 1 (M5L2, this change): a local review agent — `git diff | npx tsx review.ts` in, structured JSON verdict out. No CI yet.
- Stage 2 (M5L3, follow-up change): the same agent as a job in GitHub Actions on every PR to `main`, alongside the existing `ci` and `e2e` jobs; review logic wrapped as a composite action so the workflow stays readable.
- Enforcement is GitHub branch protection / required status checks — not custom code.

## Agent construction

- Vercel AI SDK (v6, `ToolLoopAgent` or `generateText` — keep it a narrow 2-step loop, `stopWhen: stepCountIs(2)`).
- Provider: `@ai-sdk/anthropic` with `ANTHROPIC_API_KEY` (Console, commercial terms).
- Models: `claude-haiku-4-5` as default while iterating (cost), `claude-sonnet-4-6` for final runs; model id must be a CLI arg / env var, not hardcoded.
- Lives in an isolated workspace (e.g. `packages/code-reviewer/` with its own `package.json`) so agent deps never enter the app's dependency tree. Exact layout: decide in research.
- Shared verdict schema in zod (single source of truth, `.describe()` on every field, `z.toJSONSchema` not needed while we stay on Vercel AI SDK).
- Report token usage and cost per run (`totalUsage` + provider metadata) to stdout.

## Input parameters

- git diff (PR branch vs `main`; locally: stdin)
- PR title (stage 2)
- PR description (stage 2 — conscious cost tradeoff)
- Noise stripped before the model sees the diff: lockfiles (`package-lock.json`), generated files (`dist/`, `.astro/`), snapshots.

## Code review criteria

The rubric is NOT inlined here. The agent loads `context/team/code-review-dod.md` (six criteria, anchored 1/10 scales, verdict rules) as its single source of truth. Changing review standards means editing that file, not the agent.

## Output contract

- JSON verdict: per-criterion scores (1–10), `verdict: pass | fail`, findings list (file/line, criterion, severity blocker/major/minor, suggested fix), 2–3 sentence Markdown summary.
- Exit code 0 on pass, 1 on fail (so CI can gate on it directly).

## Parked for later

- Business alignment / architectural fit (needs broader context than a diff)
- Plan-adherence review (`10x-impl-review-ci`-style) — only after the basic gate proves itself
- promptfoo eval set (M5L3 task 3: same diffs, Haiku vs Sonnet matrix) — separate change
- PR comment + labels `ai-cr:passed` / `ai-cr:failed` (stage 2 side effects)
- On-demand retry via label `ai-cr:review` (stage 2)

## Expected behavior (stage 1 acceptance)

- `git diff main...HEAD | npx tsx review.ts` returns schema-valid JSON in < ~60s on a typical diff.
- Verified against 2–3 historical diffs, including at least one known-bad change (config-class, mirroring the downtime incident) which must score < 5 on criterion 6 and fail.
- A trivially clean diff (docs typo) must pass — the gate must not cry wolf.
- Cost per review with Haiku: expected ≈ $0.01–0.02; hard budget guard: refuse diffs > ~4000 lines with a clear message instead of burning tokens.

## Constraints

- Do not touch the existing `ci.yml` in stage 1.
- No secrets in the repo: `ANTHROPIC_API_KEY` via `.env` (gitignored) locally, GitHub secret in stage 2.
- Base branch is `main`.
