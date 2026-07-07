<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Cross-Device Economy Restore (S-10)

- **Plan**: context/changes/cross-device-economy-restore/plan.md
- **Scope**: Full plan (Phases 1–2)
- **Date**: 2026-07-07
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Offline back-navigation now hits a browser error page

- **Severity**: 👁 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/layouts/Layout.astro:28
- **Detail**: bfcache restores work offline; reloads don't. Offline → Back → persisted restore → forced reload → browser network-error page instead of the stale frame/overlay. Defensible: the stale frame is the security hazard; shared-device logout is an online scenario.
- **Fix A ⭐ Recommended**: `if (event.persisted && navigator.onLine !== false) reload` — onLine === false is the reliable direction of the flag; security reload survives every online case.
- **Fix B**: Keep as shipped (maximal security posture; offline back-nav shows a browser error page).
- **Decision**: FIXED via Fix A — guard now `event.persisted && navigator.onLine \!== false`, rationale in the code comment.

### F2 — Restore test covers the write path; the read is a raw select

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: tests/cross-device-restore.test.ts:95
- **Detail**: Device 2 reads via a raw RLS select, not the app's read ladder (resolvePageProfile) — matches the stated claim, but the app's read path isn't exercised.
- **Fix**: Extra assertion resolving device 2's profile via resolvePageProfile (empty jar; sole-profile fallback) — same row.
- **Decision**: FIXED — the restore test now also resolves device 2 through the app's read ladder.

### F3 — afterAll throws noisily if beforeAll dies early

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: tests/cross-device-restore.test.ts:90
- **Detail**: accountB undefined on early beforeAll failure → TypeError in teardown (noisy, no leak).
- **Fix**: Optional chaining in afterAll.
- **Decision**: FIXED — teardown widens the accounts to `| undefined` and guards, so a beforeAll failure can't throw in afterAll.
