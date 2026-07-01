# Spendable Funds Wallet (Portfel) Implementation Plan

## Overview

Reinterpret the shipped, accumulating `coins` balance as the single spendable **wallet** (`virtualBalance`) that the child sees as their **"Portfel"** — money they've saved to grow their shop. This is the lead-tranche precursor (roadmap **S-05**, PRD-v3 **FR-007 / FR-008**) to the north-star S-06 (`upgrade-choice-and-growth`), which will spend against this wallet. No spend logic lands here; this slice renames the money model end-to-end, guards it with the project's first unit-test runner, and reframes the balance in the UI as a wallet.

## Current State Analysis

The persisted balance already does most of what a "wallet" needs — it accumulates, persists per profile under RLS, is paid once at shift end (server-authoritative), and displays on the start + results screens. What's missing is (a) vocabulary that distinguishes the *balance* from the tappable in-task 1-zł coins, and (b) a clean model seam S-06 can spend against.

### Key Discoveries:

- **`coins` is overloaded.** It means both the persisted balance (`child_profiles.coins`, `profile.coins`, `coinsEarned`) *and* the tappable task coins (`useCoinTask`, `CoinBoard`, counting/change-making). This slice touches only the balance; the task-coin concept stays "monety". (grep: `src/components/hooks/useCoinTask.ts`, `src/data/change-making-tasks.ts` vs. `child-profiles.ts:33`.)
- **Server-authoritative earning already exists** — `recordShiftResult` (`src/lib/services/child-profiles.ts:89-113`) recomputes the payout from accuracy via `coinsForShift` and writes it in a single RLS-scoped UPDATE reached by `id`; the client never supplies an amount (L-002). The rename must preserve this exactly.
- **"Agree by construction" pattern** — `src/data/shift.ts:1-7` pure fns are imported by both the client (display) and the server (authoritative write). The renamed earning fn keeps this dual-import shape.
- **Non-negative guard** — DB constraint `child_profiles_coins_nonneg` (`migration:27`) must be carried through the rename so the wallet can never go negative (matters once S-06 spends).
- **No test runner exists** (CLAUDE.md: "No test runner is wired yet") — this slice introduces one.
- **Display surfaces:** `src/pages/app/start.astro:60-70` (balance chip, `t.start.coinsLabel = "Monety"`) and `src/components/child/ShiftResults.tsx:37-42` (`t.results.coinsLabel = "Zarobione monety: {coins}"`).
- **No new art needed** — the wallet reuses existing `coin.png` / `coin-stack.png`; this deliberately avoids the local-only / gitignored art dependency that gates S-06.

## Desired End State

A returning child sees their saved money as a **"Portfel"** on the start screen and their per-shift earnings landing in it on the results screen, with light copy framing it as *savings to grow the shop*. Under the hood the balance is a `wallet_balance` column, the earning is computed by a renamed pure fn covered by unit tests, and the money model is a clean seam S-06 spends against. The tappable task coins are unchanged. Verify: `npm test` passes, the app builds, and a manual playthrough shows the wallet balance persisting and labeled "Portfel".

## What We're NOT Doing

- **No spend logic, upgrade catalog, or choose-upgrade UI** — that is S-06 (`upgrade-choice-and-growth`).
- **No visible shop growth / shop art** — absorbed into S-06 (was paused `visible-shop-growth`).
- **No change to the tappable in-task coins** (`useCoinTask`, `CoinBoard`, counting/change-making) — different concept, stays "monety".
- **No new art assets** — reuse existing coin imagery.
- **No change to stars, business level, shift composition, or scoring math** — only the money field/label is renamed; amounts are unchanged.
- **No fake "coming soon" upgrade affordance** — no vaporware.

## Implementation Approach

Three phases, ordered so the money math is provably behavior-preserving across the rename: (1) stand up a unit-test runner and lock the current pure-fn behavior; (2) rename the money model end-to-end (DB column + types + service + earning fn + route + island wiring), updating the tests to the new names; (3) reframe the balance in the UI as the "Portfel" with savings copy. Amounts never change — only names and labels — so the tests from Phase 1 stay green through Phases 2-3.

## Phase 1: Test-runner foundation

### Overview

Introduce the project's first unit-test runner (Vitest) and lock the current behavior of the pure economy functions in `src/data/shift.ts` *before* renaming anything, so Phase 2's rename is provably behavior-preserving.

### Changes Required:

#### 1. Test tooling

**File**: `package.json`, `vitest.config.ts` (new)

**Intent**: Add Vitest as a dev dependency and a `test` script (and `test:watch`) so `npm test` runs the suite in CI and locally. Configure Vitest for the existing TS path alias (`@/* → ./src/*`) so tests import domain modules the same way the app does.

**Contract**: New `test` script in `package.json`; `vitest.config.ts` resolves the `@/` alias (mirror `tsconfig.json` paths) and runs in a node environment (these are pure-fn tests, no DOM). Wire it into `.github/workflows/ci.yml` as a step after lint/build.

#### 2. Pure-fn behavior lock

**File**: `src/data/shift.test.ts` (new)

**Intent**: Cover the pure economy fns at their *current* names so any behavior change during the rename is caught. Use the injectable `pick` parameters for determinism (no reliance on `Math.random`).

**Contract**: Tests for `coinsForShift(taskCount, cleanCount)` (base + clean-bonus arithmetic, zero floor), `starsForShift` (the 0/0.4/0.7/1.0 rate thresholds), `businessLevelForShifts` (the `1 + floor(n/3)` boundaries), and `shiftLength` (band clamping via injected `pick`). Assert exact values from the current constants (`COIN_PER_TASK=5`, `COIN_PER_CLEAN=3`, `SHIFTS_PER_LEVEL=3`).

### Success Criteria:

#### Automated Verification:

- Test runner executes: `npm test`
- All new unit tests pass
- Linting passes: `npm run lint`
- Production build still succeeds: `npm run build`

#### Manual Verification:

- `npm test` output shows the economy-fn suite running and green

**Implementation Note**: After Phase 1 automated verification passes, pause for human confirmation before Phase 2.

---

## Phase 2: Money-model rename (coins → wallet_balance)

### Overview

Rename the persisted-balance concept end-to-end — DB column, types, service, earning fn, route response, and island wiring — from `coins` to `wallet_balance` / "earnings into the wallet". Amounts are unchanged; the Phase-1 tests are updated to the new fn name and must stay green.

### Changes Required:

#### 1. Database rename

**File**: `supabase/migrations/20260701120000_rename_coins_to_wallet_balance.sql` (new)

**Intent**: Non-destructively rename the balance column and its non-negative constraint, and update the column comment to describe the spendable wallet. Data is preserved by the rename (and pre-launch there are no production rows regardless). Do NOT add/alter RLS policies or the `set_updated_at` trigger — the column-agnostic F-01 policies already cover the renamed column (L-001).

**Contract**: `alter table public.child_profiles rename column coins to wallet_balance;` plus rename the check constraint `child_profiles_coins_nonneg → child_profiles_wallet_balance_nonneg` (drop + re-add against `wallet_balance >= 0`, or `alter table ... rename constraint`), and refresh the `comment on column` text to "Spendable wallet balance (virtualBalance) earned across shifts; non-negative; spent on upgrades from S-06."

#### 2. Service + types

**File**: `src/lib/services/child-profiles.ts`

**Intent**: Rename the `ChildProfile.coins` field to `wallet_balance`; in `recordShiftResult` read/write the renamed column and rename the returned `ShiftResult.coinsEarned` to `earned`. The single-UPDATE-by-`id`, no-`account_id`-from-client contract is unchanged.

**Contract**: `ChildProfile.wallet_balance: number`; `ShiftResult.earned: number`; the `.update({...})` sets `wallet_balance: current.wallet_balance + earned`. No second query, no policy change.

#### 3. Pure earning fn

**File**: `src/data/shift.ts`

**Intent**: Rename `coinsForShift` → `earningsForShift` (and the constants `COIN_PER_TASK`/`COIN_PER_CLEAN` → `EARN_PER_TASK`/`EARN_PER_CLEAN`) to speak "wallet earnings", keeping the dual-import purity contract. Behavior/values unchanged.

**Contract**: `earningsForShift(taskCount, cleanCount): number` with identical arithmetic to the current `coinsForShift`. Update the file's doc comment.

#### 4. Route response

**File**: `src/pages/api/shifts/complete.ts`

**Intent**: Rename the JSON response field `coinsEarned` → `earned`. Request schema and the server-authoritative recompute are unchanged.

**Contract**: Response `{ ok, earned, businessLevel, leveledUp }`.

#### 5. Island wiring

**File**: `src/components/child/ShiftScreen.tsx`

**Intent**: Update the import + local computation to `earningsForShift`, rename the `Outcome.coinsEarned` field to `earned`, and read `data.earned` semantics from the route. Client display stays computed-locally (agree-by-construction); server value remains authoritative for persistence.

**Contract**: `Outcome.earned: number`; passes `earned` to `ShiftResults`.

#### 6. Update Phase-1 tests

**File**: `src/data/shift.test.ts`

**Intent**: Point the earning-fn tests at `earningsForShift` / renamed constants. Assertions (values) are identical — proving the rename preserved behavior.

**Contract**: Same expected values; new symbol names.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly against a local reset: `npx supabase db reset` (or `npx supabase migration up`)
- Unit tests pass unchanged in value: `npm test`
- Type checking passes: `npm run lint` (type-checked ESLint per CLAUDE.md)
- Production build succeeds: `npm run build`
- No remaining references to the old balance symbols: `grep -rn "\.coins\b\|coinsEarned\|coinsForShift" src` returns only task-coin (non-balance) matches

#### Manual Verification:

- A completed shift still increases the persisted balance by the same amount as before the rename
- Existing profile balances are intact after the migration (no reset of saved money)
- No 500s from `/api/shifts/complete`; results screen still shows the earned amount

**Implementation Note**: After Phase 2 automated verification passes, pause for human confirmation before Phase 3.

---

## Phase 3: Wallet UI + "Portfel" vocabulary + savings framing

### Overview

Reframe the balance in the child UI as the **"Portfel"** — savings to grow the shop — on the start and results screens, with light forward-looking copy. This is the user-visible delta. Task screens keep "monety".

### Changes Required:

#### 1. Localized copy

**File**: `src/i18n/pl.ts`

**Intent**: Introduce wallet vocabulary and a light savings hint; retire the balance-as-"Monety" label (the task-coin "monety" strings elsewhere stay). Keep `results.levelUp` and star copy unchanged.

**Contract**: `start.walletLabel: "Portfel"` (replaces the balance `coinsLabel`), `start.savingsHint: "Zbierasz na rozwój sklepu"` (or similar), `results.earnedLabel: "Do portfela: +{earned}"` (replaces `coinsLabel`), optional `results.savingsHint`. Interpolation key renamed `{coins}` → `{earned}`.

#### 2. Start-screen wallet chip

**File**: `src/pages/app/start.astro`

**Intent**: Relabel the balance chip as the Portfel showing `profile.wallet_balance`, using existing coin imagery (reuse `coin-stack.png` as the "saved stack"), and add the light savings hint near the wallet/level HUD. No layout overhaul — mirror the existing chip pattern.

**Contract**: Chip renders `profile.wallet_balance` with `sr-only` `t.start.walletLabel`; savings hint rendered as muted text; no new asset files.

#### 3. Results earnings framing

**File**: `src/components/child/ShiftResults.tsx`

**Intent**: Rename the `coinsEarned` prop to `earned`, present it as money landing in the wallet ("Do portfela: +{earned}"), and add the light savings framing line. Keep the warm, never-"game-over" tone and the `coin-stack.png` visual.

**Contract**: `ShiftResultsProps.earned: number`; uses `t.results.earnedLabel`; savings line gated to always-friendly copy (no scarcity/FOMO — guardrail).

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Unit tests still pass: `npm test`
- Production build succeeds: `npm run build`
- No leftover balance-"Monety" key references: `grep -rn "coinsLabel" src` returns nothing

#### Manual Verification:

- Start screen shows the persisted balance labeled/announced as "Portfel", with the savings hint
- Completing a shift shows the earned amount landing in the wallet on the results screen
- Balance persists across a page reload and across sign-out/sign-in (same profile)
- Task screens (counting / change-making) still refer to the tappable coins as "monety" — untouched
- Copy reads as encouraging savings-toward-the-shop; no urgency/scarcity language (guardrail)

**Implementation Note**: Final phase — after automated + manual verification, the slice is complete and ready to hand to S-06.

---

## Testing Strategy

### Unit Tests:

- `earningsForShift` — base-per-task + clean-bonus arithmetic; zero floor; matches pre-rename `coinsForShift` values exactly.
- `starsForShift` — the 1.0 / 0.7 / 0.4 rate thresholds and the `taskCount<=0 → 0` guard.
- `businessLevelForShifts` — `1 + floor(n/3)` at boundaries (n = 0, 2, 3, 5, 6).
- `shiftLength` — band clamping for tier 1 (5-7) and tier 2 (8-10) via injected `pick`.

### Integration Tests:

- None automated (no integration harness in the project). Covered by the manual playthrough below.

### Manual Testing Steps:

1. Sign in, open the start screen — confirm the balance chip reads as "Portfel" with the saved amount and the savings hint.
2. Play a full shift — on the results screen confirm the earned amount is framed as landing in the wallet.
3. Reload the start screen — confirm the wallet balance increased and persisted.
4. Sign out and back in (same parent) — confirm the wallet balance is unchanged.
5. Enter a counting and a change-making task — confirm the tappable coins are still called "monety" (unchanged).
6. Confirm no urgency/scarcity wording anywhere in the wallet copy.

## Migration Notes

The rename is non-destructive (`rename column` preserves data) and the app is pre-launch (no production rows), so no backfill is needed. Rollback = the inverse rename migration. The non-negative constraint is carried through the rename so the wallet cannot go negative once S-06 introduces spending. No RLS policy or trigger changes (column-agnostic F-01 policies already cover the renamed column — L-001).

## References

- Research baseline: `context/changes/visible-shop-growth/research.md` (render/persist/RLS path; still valid)
- Roadmap slice: `context/foundation/roadmap.md` → S-05 `spendable-funds-wallet`
- PRD: `context/foundation/prd-v3.md` FR-007, FR-008 (advances US-01)
- Server-authoritative pattern: `src/lib/services/child-profiles.ts:89-113`; pure fns `src/data/shift.ts`
- Lessons: `context/foundation/lessons.md` L-001 (RLS column-agnostic), L-002 (no client-supplied `account_id`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Test-runner foundation

#### Automated

- [x] 1.1 Test runner executes: `npm test` — d51b04d
- [x] 1.2 All new unit tests pass — d51b04d
- [x] 1.3 Linting passes: `npm run lint` — d51b04d
- [x] 1.4 Production build still succeeds: `npm run build` — d51b04d

#### Manual

- [x] 1.5 `npm test` output shows the economy-fn suite running and green — d51b04d

### Phase 2: Money-model rename (coins → wallet_balance)

#### Automated

- [x] 2.1 Migration applies cleanly against a local reset
- [x] 2.2 Unit tests pass unchanged in value: `npm test`
- [x] 2.3 Type checking passes: `npm run lint`
- [x] 2.4 Production build succeeds: `npm run build`
- [x] 2.5 No remaining references to old balance symbols (grep clean except task-coins)

#### Manual

- [x] 2.6 A completed shift increases the persisted balance by the same amount as before
- [x] 2.7 Existing profile balances intact after the migration
- [x] 2.8 No 500s from `/api/shifts/complete`; results still shows earned amount

### Phase 3: Wallet UI + "Portfel" vocabulary + savings framing

#### Automated

- [ ] 3.1 Linting passes: `npm run lint`
- [ ] 3.2 Unit tests still pass: `npm test`
- [ ] 3.3 Production build succeeds: `npm run build`
- [ ] 3.4 No leftover balance-"Monety" key references (`grep coinsLabel src` empty)

#### Manual

- [ ] 3.5 Start screen shows the balance as "Portfel" with savings hint
- [ ] 3.6 Results screen shows earnings landing in the wallet
- [ ] 3.7 Balance persists across reload and sign-out/sign-in
- [ ] 3.8 Task screens still call the tappable coins "monety"
- [ ] 3.9 Copy reads as encouraging savings; no urgency/scarcity language
