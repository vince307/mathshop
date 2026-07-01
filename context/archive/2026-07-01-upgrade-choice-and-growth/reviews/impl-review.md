<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Upgrade Choice & Visible+Functional Shop Growth (S-06)

- **Plan**: context/changes/upgrade-choice-and-growth/plan.md
- **Scope**: All 4 phases
- **Date**: 2026-07-01
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

Automated criteria (fresh run): `npm run check` 0 errors · `npm run lint` clean · `npm run build` ✓ · `npx vitest run` 97 tests pass. Money path verified server-authoritative and L-002-safe (durable-state spoof test confirmed via service-role client).

## Findings

### F1 — Concurrent buys can silently drop a purchase (lost update)

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Reliability)
- **Location**: src/components/child/UpgradeShop.tsx:127; src/lib/services/child-profiles.ts:153-172
- **Detail**: buyUpgrade does read → compute → write with an absolute wallet value and a wholesale shop_state replace. The island only disables the clicked button (`disabled={buyingId === u.id}`), so a fast child can fire two concurrent buys from one stale read; last-write-wins drops the first debit + ownership. Confirmed NOT a money leak (each write replaces shop_state from the same stale read; the wallet non-negative DB constraint blocks negatives) — worst case is a benign lost transaction. Sibling recordShiftResult shares this exact pattern, so it's consistent, not a regression.
- **Fix**: Disable all buy buttons while any buy is in flight — `disabled={buyingId !== null}` in UpgradeShop.tsx. (Server-side atomic/conditional UPDATE is the deeper fix; fair to defer for a single-session kids app.)
- **Decision**: FIXED — client-side guard applied (server atomicity deferred)

### F2 — shop_state overwritten wholesale on each buy

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Data-safety)
- **Location**: src/lib/services/child-profiles.ts:171
- **Detail**: The UPDATE writes `shop_state: { purchased: nextPurchased }`, replacing the whole JSONB. Correct today (purchased is the only key), but any future shop_state key would be silently dropped on every purchase.
- **Fix**: When the shape grows, merge existing keys (`{ ...current.shop_state, purchased: nextPurchased }`). No change needed now.
- **Decision**: FIXED — defensive merge applied proactively

### F3 — `unknown` failure branch is unreachable from the route

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/upgrades/buy.ts:15-18
- **Detail**: z.enum(UPGRADE_IDS) rejects out-of-catalog ids at parse time (400), so buyUpgrade's `{ failure: "unknown" }` branch only fires if the service is called directly. The test's "unknown upgrade id" case asserts the zod 400, not the service branch. Harmless defense-in-depth — noted so no one assumes the service branch is route-tested.
- **Fix**: None required. Optionally add a direct buyUpgrade unit test for the unknown branch if you want it covered.
- **Decision**: SKIPPED — intentional defense-in-depth, left as-is
