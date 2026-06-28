<!-- PLAN-REVIEW-REPORT -->
# Plan Review: First Child Profile Wizard + Child Start Screen (S-01b)

- **Plan**: context/changes/first-child-profile-and-start-screen/plan.md
- **Mode**: Deep
- **Date**: 2026-06-28
- **Verdict**: SOUND (after triage)
- **Findings**: 0 critical, 1 warning, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

11/11 paths ✓ (existing modify-targets present, all 5 new paths absent); `child_profiles` blast radius ✓ (only `app.astro` comment + isolation test consume it); no generated `Database` types file (`.overrideTypes()` used) ✓; post-auth funnel → `/app` ✓ (signin + confirm both redirect there); no redirect loop with `/app/new-profile`·`/app/start` (middleware `startsWith("/app")`, AUTH_FORM_PAGES exact-match) ✓; Progress↔Phase 5/5 ✓; contract-surfaces (`public.child_profiles`, `set_updated_at()`) handled — additive migration, reuse-don't-redefine ✓.

## Findings

### F1 — Profile-count router branch has no automated test

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 5 — /app router (success criteria were manual-only)
- **Detail**: The router (0→wizard, 1→start, 2+→most-recent) is the slice's load-bearing new behavior but was verified manual-only; it's request-testable with the existing harness (`tests/auth-session-gating.test.ts`).
- **Fix**: Add a request-level router test (seed 0/1/2 profiles via admin client, drive `/app`, assert redirect target).
- **Decision**: FIXED — added `tests/app-router.test.ts` to Phase 5 (Changes #3) + automated criterion 5.3 + Progress row.

### F2 — Theme/interest value set not enumerated; 4th-world naming mismatch

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 (interest) + Phase 5 (theme→art)
- **Detail**: "theme ∈ world slugs" never enumerated; mockup "Sklep kolekcjonera" vs art `world-sklep-ksiegarnia.png` mismatch.
- **Fix**: Enumerate the four theme slugs + pin the interest-label↔slug↔art map.
- **Decision**: FIXED — added a "Theme/interest value set is closed and art-aligned" bullet to Critical Implementation Details (slugs: kawiarnia/piekarnia/galaktyczna-baza/sklep-ksiegarnia, default→kawiarnia; zod validates the closed set).

### F3 — `npx supabase db reset` (1.1) requires Docker/local stack

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Automated Verification 1.1
- **Detail**: Migration-apply + child_profiles tests need the local Supabase (Docker) stack; fail with `fetch failed` in a Docker-less agent (hit earlier this session).
- **Fix**: Note the dependency on the relevant automated criteria.
- **Decision**: FIXED — added a "Local-stack dependency" note to the Testing Strategy section.

### F4 — No server-side cap on profiles-per-account in the create route

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 — POST /api/profiles/create
- **Detail**: The route is directly POSTable with no cap; harmless for S-01b (2+ routes to most-recent; add-2nd flow is S-07) but unbounded.
- **Fix**: Accept as in-scope-for-S-07, or add a soft guard.
- **Decision**: ACCEPTED — added a "No server-side profiles-per-account cap" line to "What We're NOT Doing" (cap deferred to S-07).

## Triage summary

- **Fixed**: F1 (router test added), F2 (theme slugs pinned), F3 (Docker-dependency note)
- **Accepted**: F4 (profile-cap deferred to S-07, noted in scope)
- Verdict after fixes: **SOUND** — ready to implement.
