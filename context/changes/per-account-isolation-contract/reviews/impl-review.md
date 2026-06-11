<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Per-Account Data Isolation Contract (F-01)

- **Plan**: context/changes/per-account-isolation-contract/plan.md
- **Scope**: All 4 phases
- **Date**: 2026-06-11
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Notes

- Plan adherence: all planned files MATCH. One sanctioned drift (CI exclude-list, F4) and one beneficial extra (lessons L-002 + hardened INSERT test).
- Safety: RLS boundary correct — no cross-account read/write path. No critical/exploitable issues.
- Success criteria re-checked: lint, docs-exist, markdown-prettier, policy-name-match all PASS. DB-dependent criteria (1.1–1.3, 2.2/2.3) verified live during implementation and by CI on PR #11 (green) / spike PR #12 (red); local stack down at review time so not re-run.

## Findings

### F1 — CI relies on `supabase start` implicitly applying migrations

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: .github/workflows/ci.yml:36-48
- **Detail**: No explicit migration-apply step; `supabase start` applies migrations today but implicitly. A future volume-cache or CLI change could run the test against a table-less DB with a confusing failure.
- **Fix**: Add an explicit `npx supabase db reset` step after start (before the test).
- **Decision**: FIXED (fix/f-01-review) — added "Apply migrations to a fresh DB" step.

### F2 — Template trigger fn `set_updated_at()` has an unpinned search_path

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260609120000_child_profiles_isolation.sql:35-43 + docs/reference/rls-template.sql
- **Detail**: `set_updated_at()` doesn't pin `search_path` (Supabase advisor `function_search_path_mutable`). Low-risk as written, but it's the canonical template every future owned table reuses.
- **Fix**: Add `set search_path = ''` to the function in the migration and rls-template.sql.
- **Decision**: FIXED (fix/f-01-review) — pinned in both files.

### F3 — Isolation tests share one mutable row (ordering coupling)

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/child-profiles-isolation.test.ts:85-165
- **Detail**: All 5 tests share `aRowId` from beforeAll. Safe today (serial, single row); could read confusingly if the suite grows. The global `toHaveLength(1)` positive control doubles as a leakage check.
- **Fix**: If/when the suite grows, move to per-test rows (beforeEach re-provision).
- **Decision**: SKIPPED — deferred until a second owned-table test or more rows are added (see follow-ups).

### F4 — CI exclude-list differs from the plan's literal names

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: .github/workflows/ci.yml:34-35
- **Detail**: Uses storage-api/mailpit/postgres-meta vs the plan's storage/inbucket/pooler — the sanctioned CLI-version adjustment the plan explicitly called for. Intent preserved (db+auth+rest+kong kept).
- **Decision**: DISMISSED — no action; sanctioned.

## Carry-over / open items

- **3.5** (from the plan): make the CI check merge-blocking (branch protection / required check). Blocked on GitHub Pro or a public repo. Unchanged by this review.
