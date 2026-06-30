<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Full Shift with Results (S-04)

- **Plan**: context/changes/full-shift-with-results/plan.md
- **Scope**: Full plan (Phases 1–3 of 3)
- **Date**: 2026-06-30
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 4 observations

> Phase 2 was already reviewed (APPROVED, 7744db1). This full sweep weighted toward the new Phase 3 (start-screen coin/level HUD) + cross-phase integrity. Phase 3 is clean; all 4 observations sit in already-approved Phase-1 route/service code and are non-blocking.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS (4 observations) |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Success Criteria (re-verified 2026-06-30)

- `npm run check` — ✅ 0 errors, 0 warnings
- `npm run lint` — ✅ clean
- `npm run build` — ✅ complete
- `npm test` — ✅ 71 passed (13 files), against the live local Supabase stack
- Manual 3.5–3.7 — ✅ confirmed by maintainer

## Verified clean (no findings)

- L-001/L-002 RLS isolation: route never accepts `account_id` from client; ownership enforced via RLS on the row reached by `id`; coins recomputed server-side from accuracy (no client-supplied coin amount → no inflation).
- `prerender = false` present; zod bounds `taskCount`/`cleanCount` with `cleanCount <= taskCount` refine.
- `savedRef` guards the single shift-end POST against strict-mode double-invoke (FR-016 — no mid-shift persistence).
- `useCoinTask` clears the completion timer on unmount.
- Migration adds non-negative / min-1 CHECK constraints, reuses the shared `set_updated_at()` trigger, no new policy, and keeps `business_level` distinct from `starting_level`.
- L-003: all user-visible strings sourced from `t.*` (no inline literals); `profile.name`/`coins`/`business_level` auto-escaped (never `set:html`).
- Fresh profile (0 shifts) HUD renders 0 coins / level 1 cleanly via NOT NULL defaults — no null-guard needed.
- Same pure functions (`coinsForShift`/`starsForShift`/`businessLevelForShifts`) imported by both client and server, so displayed and persisted numbers agree by construction.

## Findings

### F1 — Coins read-modify-write is not atomic

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Reliability)
- **Location**: src/lib/services/child-profiles.ts:97–109
- **Detail**: `recordShiftResult` reads `current.coins`, computes `coins + earned`, then writes back. Concurrent completions for one profile could lose an update (last-writer-wins). Server-recompute still prevents coin *inflation* (the security goal holds). For a single child tapping one shift at a time this is effectively unreachable; FR-016 means no mid-shift writes. Phase-1 code, already approved.
- **Fix**: Future hardening — atomic `update ... set coins = coins + $1` or an RPC. Candidate for the S-08 network-loss slice. Not needed for v1.
- **Decision**: SKIPPED (save report only)

### F2 — Route collapses "profile not found" into an opaque 500

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Reliability)
- **Location**: src/pages/api/shifts/complete.ts:50
- **Detail**: `recordShiftResult` returns `{ error }` for a non-owned/missing profile (really a 403/404 condition) and for genuine DB failures alike — all mapped to 500. Not leaking ownership is arguably a feature; the cost is that a legitimately-missing profile reads as a server error. Cosmetic.
- **Fix**: Optional — distinguish the not-found path if S-08 wants a cleaner client signal. Leave as-is for v1.
- **Decision**: SKIPPED (save report only)

### F3 — Coin-label idiom differs between start HUD and results

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/app/start.astro:64 vs src/components/child/ShiftResults.tsx:38
- **Detail**: The start HUD uses an sr-only label ("Monety") + bare number; the results screen uses the visible localized "Zarobione monety: {coins}" with a decorative coin image. Both are accessible and correct — two reasonable idioms for the same concept. No defect.
- **Fix**: None required. Noting for consistency awareness only.
- **Decision**: SKIPPED (save report only)

### F4 — formData() read without a content-type guard

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Reliability)
- **Location**: src/pages/api/shifts/complete.ts:38
- **Detail**: The route calls `request.formData()`; a non-form body throws and surfaces as an unhandled 500 rather than a clean 400. Low impact — authed-only, same-origin island fetch, and zod still guards field values. Mirrors the existing `profiles/create.ts` idiom. Phase-1 code, already approved.
- **Fix**: Optional defensive try/catch → 400. No sibling route does this today, so leaving it keeps route consistency.
- **Decision**: SKIPPED (save report only)
