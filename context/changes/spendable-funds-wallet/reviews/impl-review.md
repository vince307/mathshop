<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Spendable Funds Wallet (Portfel) — S-05

- **Plan**: context/changes/spendable-funds-wallet/plan.md
- **Scope**: Full plan (Phases 1–3)
- **Date**: 2026-07-01
- **Verdict**: APPROVED
- **Findings**: 0 critical · 1 warning · 2 observations (all triaged → FIXED)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Summary

Clean, behavior-preserving rename of the persisted balance (`coins` → `wallet_balance`) plus a Polish UI reframe to the child's "Portfel". Two independent review agents confirmed: migration non-destructive with the non-negative guard preserved, RLS untouched (column-agnostic F-01 policies), L-002 upheld (no client `account_id`; durable state verified in tests), server-authoritative earning intact, i18n discipline held (no inline literals, L-003), amounts provably preserved (`earningsForShift` == old `coinsForShift`), and no runtime-breaking `coins` leftovers (surviving `coins`/`monety` are the intentional tappable task-coins). Three LOW-impact findings, all fixed.

## Findings

### F1 — Contract-surfaces registry not updated for the rename

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency (L-001 registry contract)
- **Location**: docs/reference/contract-surfaces.md:13,15
- **Detail**: The load-bearing-names registry still listed the column as `coins` and its "Defined in" migration chain stopped at the S-04 gameplay migration — the S-05 rename migration was unregistered. The file's own rule treats renaming a listed surface as breaking and requiring the registry stay current (L-001). Also a plan gap — the plan didn't list updating this file.
- **Fix**: Updated line 15 `coins` → `wallet_balance` (+ the gameplay-state wording and `>= 0` note) and added `20260701120000_rename_coins_to_wallet_balance.sql` (S-05) to the "Defined in" chain on line 13.
- **Decision**: FIXED

### F2 — Tamper-test spoof field still uses the old name

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria (test fidelity)
- **Location**: tests/shifts-complete.test.ts:95
- **Detail**: The anti-tamper test injected `coins: "99999"`; post-rename a probe would send `wallet_balance`. Test still proved the point (zod ignores extra fields; server recomputes), so fidelity polish only.
- **Fix**: Renamed the injected key to `wallet_balance: "99999"`. Test still green (4 passed).
- **Decision**: FIXED

### F3 — Stale "coin/level write" wording in a doc comment

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/data/shift.ts:4
- **Detail**: Module header still said "authoritative coin/level write" while the rest of the file was reframed to "wallet earnings".
- **Fix**: Changed "coin/level write" → "wallet/level write".
- **Decision**: FIXED
