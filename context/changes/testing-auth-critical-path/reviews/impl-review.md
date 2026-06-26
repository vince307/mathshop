<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Auth Critical-Path + Session Gating Tests

- **Plan**: context/changes/testing-auth-critical-path/plan.md
- **Scope**: Phases 1–4 of 4 (full plan)
- **Date**: 2026-06-26
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Success criteria verified: full suite 5 files / 21 tests green; `npm run lint` exit 0.
Plan-drift agent: full MATCH across all 4 phases (no drift, no creep, zero src/ changes;
L-002 durable-session assertions are genuine getUser re-reads; isolation refactor
behavior-preserving; known-issue pins honestly document current behavior).

## Findings

### F1 — deleteUserByEmail is best-effort; signup users can leak across runs

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: tests/helpers/supabase.ts:72-76 (used by tests/auth-routes.test.ts)
- **Detail**: The signup-success test creates a real persisted Supabase user; teardown calls listUsers() with no pagination and searches only the first page (~50). Across repeated local runs without `db reset`, signup-created users silently stop being cleaned up → leaked users accumulate. CI does `supabase db reset` each run (safe); local repeat-runs are the exposure.
- **Fix A ⭐ Recommended**: Capture the id at creation instead of looking it up — after signup, query admin for the email once and store the id; teardown deletes by id.
  - Strength: Deterministic, no pagination dependency; mirrors how the isolation test deletes by known id.
  - Tradeoff: One extra admin lookup per signup test.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Fix B**: Paginate listUsers() in deleteUserByEmail until found.
  - Strength: Keeps the by-email helper; fixes at source for all callers.
  - Tradeoff: Loops pages; still O(users) on a large local DB.
  - Confidence: HIGH.
  - Blind spot: Very large local DBs stay slow.
- **Decision**: FIXED via Fix A — capture id at signup (findUserIdByEmail, now paginated), delete by id in teardown.

### F2 — The "/play future surface" guard is aspirational, not a real guard

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/auth-session-gating.test.ts:97-99
- **Detail**: `/play` has no route page and isn't in PROTECTED_ROUTES, so reachedNext just means "this path isn't gated." The comment frames it as a future-play-surface guard, but it passes regardless of whether /play is ever built or gated elsewhere. The real guard value is the meta-check + the /dashboard assertion.
- **Fix**: Reword the comment to "any non-listed path stays public" (drop the play-surface framing), or remove the /play line.
- **Decision**: FIXED — reworded to "any non-listed path stays public" + meta-check note.

### F3 — weak-password signup test couples to GoTrue min-length config

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision
- **Dimension**: Safety & Quality
- **Location**: tests/auth-routes.test.ts:88-100
- **Detail**: The error-branch assertion depends on local `minimum_password_length`; if it drops below 4 the weak signup would succeed and the test would (correctly) fail. Acceptable; consider noting the dependency.
- **Fix**: Add a comment noting the dependency on GoTrue's minimum_password_length.
- **Decision**: FIXED — added the dependency note to the weak-password test.

### F4 — isolation test provisioned-user email prefix changed

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision
- **Dimension**: Pattern Consistency
- **Location**: tests/child-profiles-isolation.test.ts (via helpers/supabase.ts createSignedInUser default)
- **Detail**: Email prefix changed `isolation-` → `auth-test-` (helper default). Cosmetic; UUID still guarantees uniqueness. Behavior-preserving.
- **Fix**: Pass `createSignedInUser("isolation")` to restore the original prefix (optional).
- **Decision**: FIXED — isolation test now passes the "isolation" prefix.

### F5 — duplicate bad-credential signin tests

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision
- **Dimension**: Safety & Quality
- **Location**: tests/auth-routes.test.ts:62 and :116
- **Detail**: Two tests drive identical bad-credential signin with different random emails; the second (English-leak pin) subsumes the first. Harmless; could consolidate.
- **Fix**: Optionally merge the two into the English-leak pin.
- **Decision**: SKIPPED — the plain bad-creds test and the leak pin document distinct contracts.
