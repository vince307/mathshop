---
change_id: ai-code-review
title: Local AI code review agent (stage 1)
status: impl_reviewed
created: 2026-08-08
updated: 2026-08-08
archived_at: null
---

## Notes

introducing a local AI code review agent based on @context/changes/ai-code-review/requirements.md

## Parked follow-ups (stage 1 leaves these behind deliberately)

- **Stage 2 (separate change):** the reviewer as a third parallel GitHub Actions job on PRs to `main` (no Supabase/Docker bootstrap needed), PR comment with the verdict, `ai-cr:passed` / `ai-cr:failed` labels, retry via `ai-cr:review` label, PR title/description added to the prompt. `ANTHROPIC_API_KEY` becomes a GitHub Actions secret — mind fork-PR secret exposure (`context/foundation/infrastructure.md`). **Open blocker:** branch protection / required checks return 403 on GitHub Free + private repo (unresolved since 2026-06-11) — the gate is advisory-only until a plan upgrade or visibility change.
- **AI SDK v7 migration:** v6 is a superseded major; deltas are small (`system`→`instructions`, `stepCountIs`→`isStepCount`, `totalUsage`→`usage`, `result.output` move) and `npx @ai-sdk/codemod` exists.
- **Stale-docs sweep:** `AGENTS.md` (wrong branch `master`, wrong CI description), `README.md` §CI (predates check/test/e2e steps), root `CLAUDE.md` ("No test runner is wired yet" — false), `ci.yml:33` (stale "merge-blocking" comment).
- **promptfoo eval set (M5L3):** `fixtures.ts` is the seed; the Haiku-vs-Sonnet matrix over the same diffs is a separate change.
- **Prompt caching:** revisit if real token counts justify it — the rubric+instructions (~4.2K tokens input on a small diff) sit near Haiku's 4096-token cache minimum.
- **Stage-2 hardening (from impl review):** bound stdin size before buffering (a multi-GB pipe is fully materialized before the budget guard); `loadEnvFile` pulls the entire repo `.env` (service-role key, SMTP creds) into `process.env` — narrow to `ANTHROPIC_API_KEY` if the tool ever spawns children; prompt-injection via diff content can steer model scores (inherent LLM-review limitation — document before gating third-party PRs); fixtures pin 7-char SHAs — use full SHAs + `fetch-depth: 0` on the CI clone; quoted/octal-escaped diff paths can still bypass the noise-filter prefix checks.
