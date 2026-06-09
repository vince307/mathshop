<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Per-Account Data Isolation Contract (F-01)

- **Plan**: context/changes/per-account-isolation-contract/plan.md
- **Mode**: Deep
- **Date**: 2026-06-09
- **Verdict**: REVISE → SOUND (after triage; all findings fixed or consciously dismissed)
- **Findings**: 1 critical, 3 warnings, 1 observation

## Verdicts

| Dimension | Verdict (initial) |
|-----------|-------------------|
| End-State Alignment | PASS |
| Lean Execution | WARNING |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | FAIL |

## Grounding

6/6 paths ✓, 3/3 symbols ✓, brief↔plan ✓, `docs/reference/contract-surfaces.md` absent (surface check skipped — the plan creates it).

## Findings

### F1 — Checkbox bullets inside phase blocks break Progress contract

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phases 1–4 Success Criteria
- **Detail**: 22 `- [ ]` bullets in phase Success-Criteria blocks duplicated the checkbox state the single `## Progress` section is meant to own; `/10x-implement` could mis-parse. Progress section itself well-formed (4↔4 phases, items numbered).
- **Fix**: Converted the 22 in-phase `- [ ]` bullets to plain `- ` bullets; `## Progress` is now the only checkbox owner.
- **Decision**: FIXED

### F2 — `updated_at` has no trigger; dead column propagates via template

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — child_profiles schema
- **Detail**: `updated_at default now()` with no `before update` trigger is just a second `created_at`; as the canonical copyable template, the dead column would seed project-wide.
- **Fix A ⭐ Recommended**: Add a shared `set_updated_at()` trigger function + `before update` trigger to the migration, and note the reuse rule in the Phase 4 template.
  - Strength: `updated_at` becomes truthful; the template ships a complete pattern.
  - Tradeoff: ~6 lines + a shared function the template must flag as "create once".
  - Confidence: HIGH — standard Supabase idiom (`moddatetime`/`set_updated_at`).
  - Blind spot: None significant.
- **Fix B**: Drop `updated_at` from F-01 until a writer needs it.
- **Decision**: FIXED (Fix A) — migration contract + Phase 4 template updated.

### F3 — CI `supabase start` cost understated; full stack pulled

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 — CI workflow
- **Detail**: Cold `npx supabase start` in CI pulls the entire stack (~2–4+ min on image pulls); the isolation test needs only db + auth + rest. Estimate said "~1–2 min".
- **Fix**: Start an excluded subset (`supabase start -x studio,storage,imgproxy,realtime,inbucket,…`), re-baseline the estimate to ~2–4 min cold, and verify the exclude list against `supabase start --help` for the installed CLI version.
- **Decision**: FIXED — Phase 3 contract + time estimate (phase bullet + Progress 3.4) updated.

### F4 — CI key sourcing underspecified; demo-key nature not stated

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 (.env.test) + Phase 3 (CI key export)
- **Detail**: `supabase status -o env` emits `API_URL`/`ANON_KEY`/`SERVICE_ROLE_KEY`, but `.env.test.example` uses `SUPABASE_*` names — mapping omitted. Local-stack keys are fixed public demo JWTs (no GitHub secrets needed) — unstated.
- **Fix**: Documented the exact env-var mapping in Phase 2, and a note that local-stack keys are non-secret fixtures CI reads from `supabase status` (with a "don't reuse for deployed envs" caveat).
- **Decision**: FIXED

### F5 — `theme` column unexercised by any F-01 criterion

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 1 — child_profiles schema
- **Detail**: F-01 has no write path, so `avatar`/`theme` aren't exercised by F-01 criteria. `theme` is most cuttable (v1 ships one theme; PRD carries it "for v2").
- **Fix**: Keep `theme` — realistic table shape, roadmap-sanctioned ("F-01 ships the child_profiles table"), PRD carries it for v2.
- **Decision**: DISMISSED (keep `theme`)
