<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Multi-Profile Picker (S-11)

- **Plan**: context/changes/multi-profile-picker/plan.md
- **Scope**: Full plan (Phases 1–2)
- **Date**: 2026-07-07
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Stale-cookie router glue is untested (false-green shaped)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/app.astro:18
- **Detail**: No test composes `resolvePageProfile` + `resolveLandingPath`. A regression passing raw cookie presence instead of the validated profile would stay green while breaking stale-cookie → picker.
- **Fix**: Integration case in active-profile.test.ts — 2-profile account + garbage cookie → composed result `/app/pick-profile`; valid cookie → `/app/start`.
- **Decision**: FIXED — two "router glue" cases added composing resolvePageProfile + resolveLandingPath (stale → picker, valid → start).

### F2 — Signout leaves the active_profile cookie behind

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/signout.ts
- **Detail**: Account B on a shared browser inherits A's stale pointer. No leak (RLS resolves it to null), but clearing it makes fresh-account state explicit.
- **Fix**: `context.cookies.delete(ACTIVE_PROFILE_COOKIE, { path: "/" })` in signout.
- **Decision**: FIXED — signout now clears the selection cookie with an intent comment.

### F3 — Cap check has a TOCTOU race (acceptable for a soft cap)

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/profiles/create.ts:58
- **Detail**: Parallel creates at count 5 can exceed the cap. Overflow self-limits (add entries hide at ≥6); consistent with documented soft-cap intent.
- **Fix**: Note the race in the MAX_PROFILES_PER_ACCOUNT comment; DB trigger only if the cap becomes a hard rule.
- **Decision**: FIXED — TOCTOU note added to the constant's docstring.

### F4 — Minor pattern nits (consolidated)

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: select.ts:13, active-profile.ts:28, child-profiles.ts:92
- **Detail**: z.uuid() vs create.ts's version-robust refine philosophy; select("*") where select("id") suffices in the select route's ownership check; getMostRecentProfile has no production consumer left (tests only).
- **Fix**: Align opportunistically; remove getMostRecentProfile on the next touch.
- **Decision**: FIXED (c) — getMostRecentProfile removed, its test repointed to listChildProfiles. NO_CHANGE (a, b) with rationale: z.uuid() is the zod-4 idiom (create.ts's refine style predates it and aligns on its next touch); the select route keeps resolveActiveProfile's full-row read rather than forking the RLS seam for a one-column micro-optimization.
