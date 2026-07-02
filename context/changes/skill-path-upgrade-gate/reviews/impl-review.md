<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Skill-Path Upgrade Gate + Parent Weekly Report

- **Plan**: context/changes/skill-path-upgrade-gate/plan.md
- **Scope**: All 6 phases
- **Date**: 2026-07-02
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — PIN "set" route accepts a new PIN with no current-PIN check (gate bypass)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/parent/pin/set.ts:18-35, src/lib/services/parent-pin.ts:67-77
- **Detail**: The set/enter decision is made only in parent-pin.astro; the API doesn't enforce it. Any authenticated session can POST /api/parent/pin/set with any PIN, which unconditionally upserts, clears the throttle, and mints a parent_verified marker. A child on the parent's logged-in device can reach /app/report AND silently reset the PIN. The plan frames the PIN as a "soft gate," so partly by-design — but reset-without-knowledge defeats even the soft intent.
- **Fix A ⭐ Recommended**: When a PIN already exists, require a valid parent_verified marker (or the current PIN) to reset; keep first-time set open.
  - Strength: Closes the bypass, preserves first-run UX, matches the gate's intent.
  - Tradeoff: A parent who forgets the PIN needs a recovery path (separate follow-up).
  - Confidence: HIGH — hasPin() exists; marker check already used in report.astro.
  - Blind spot: Forgot-PIN recovery flow isn't designed yet.
- **Fix B**: Accept as documented soft-gate limitation; add a code comment + PRD note.
  - Strength: Zero code risk; honors the explicit "soft gate" scope.
  - Tradeoff: The gate is trivially bypassable by a curious child.
  - Confidence: MED — depends how much the product wants the gate to actually hold.
- **Decision**: FIXED via Fix A — set.ts now requires a valid parent_verified marker to overwrite an existing PIN; first-time set stays open. Follow-up: forgot-PIN recovery flow not yet designed.

### F2 — PARENT_SESSION_SECRET optional → empty HMAC key makes markers forgeable

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: astro.config.mjs:28, src/lib/services/parent-pin.ts:120,139
- **Detail**: The secret is optional:true and the HMAC helpers fall back to `?? ""`. If unset in prod (build/CI won't catch it — only a human deploy note guards it), every marker is signed/verified under an empty key, so any authenticated user can forge a valid marker for their own account_id and skip their PIN. Flagged independently by both review agents.
- **Fix A ⭐ Recommended**: Fail closed at runtime — signMarker/verifyMarker return false (or throw) when the secret is empty, so a misconfig blocks the report.
  - Strength: Report unreachable on misconfig instead of wide open; builds/tests still work (test stub supplies the secret).
  - Tradeoff: A prod deploy that forgets the var breaks the report loudly (arguably good).
  - Confidence: HIGH — one guard in each helper.
  - Blind spot: None significant.
- **Fix B**: Make the env var required (drop optional:true) so the build fails fast if absent.
  - Strength: Impossible to deploy without it.
  - Tradeoff: Any build/CI context lacking the var fails (test stub covers vitest, but bare `npm run build` in a fresh env breaks).
  - Confidence: MED — depends on all build environments having the var.
- **Decision**: FIXED via Fix A — markerSecret() returns null on an empty secret; verifyMarker → false, signMarker → throws. Report fails closed on misconfig.

### F3 — PIN verify throttle is a read-modify-write TOCTOU race (parallel brute-force)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/parent-pin.ts:87-115
- **Detail**: verifyPin SELECTs failed_attempts then UPDATEs. N parallel verify requests all read the same pre-increment count, so an attacker gets N guesses before any lock lands — the 5-attempt lockout doesn't bound a parallel attack on a 4–6 digit PIN.
- **Fix**: Increment atomically DB-side — an RPC or `update … set failed_attempts = failed_attempts + 1 … returning` — instead of read-then-write in JS.
  - Strength: Closes the race; lockout holds under concurrency.
  - Tradeoff: Needs a small SQL function or reworked update; more than a one-liner.
  - Confidence: MED — standard pattern, adds a migration/RPC surface.
  - Blind spot: Real-world exploitability limited (soft gate, local device).
- **Decision**: FIXED — new migration 20260702120000_pin_failure_throttle_rpc.sql adds register_pin_failure() (single row-locked UPDATE, security invoker under auth.uid()); verifyPin calls it on a wrong PIN instead of read-modify-write.

### F4 — Non-atomic read-modify-write on wallet & skill_state (lost updates)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/child-profiles.ts:132-151 (recordShiftResult), 190-221 (buyUpgrade)
- **Detail**: Both read the profile row, compute in JS, then UPDATE by id with no concurrency guard. Concurrent ops (double-submit, retry, shift+purchase overlap) can lose a wallet debit, a completed_shift_count, or a skill_state increment. DB non-negative constraint prevents overspend but not lost earnings/skill. Pre-existing pattern from S-04/05/06, extended (not introduced) by S-07's fold.
- **Fix**: Conditional update (guard on updated_at / wallet_balance) or DB-side arithmetic. Best handled as a cross-cutting follow-up since it spans earlier slices too.
  - Strength: Removes the lost-update class across all currency/skill writes.
  - Tradeoff: Broader than this change; touches already-shipped S-04/05/06 code.
  - Confidence: MED — correct direction; scope wider than one file.
  - Blind spot: Concurrency is low for a single-child single-session game today.
- **Decision**: DEFERRED — logged in follow-ups/review-fixes.md as a cross-cutting hardening task (spans S-04–S-07). Not blocking.

### F5 — upgradeName() throws on a stale upgrade id in the report

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/parent/WeeklyReport.tsx:122-124
- **Detail**: `t.upgrades[id].name` assumes the id is still in the catalog. A shift_log upgrade_purchased for a later-removed upgrade dereferences undefined.name and crashes the report render. reports.ts:upgradeSkillTie already tolerates unknown ids — the two sides are inconsistent. Not reachable today (catalog only grows).
- **Fix**: Guard the lookup — return `t.upgrades[id]?.name ?? id` — mirroring the tolerance already in reports.ts.
- **Decision**: FIXED — upgradeName casts t.upgrades to a string-keyed record and falls back to the id on an unknown key (typed guard, no lint issue).
