# World Economy — Profit Rule Implementation Plan

> Feature **F1** of autonomous run `2026-08-27-world-economy` · backlog **E1**
> Design: `docs/superpowers/specs/2026-08-27-world-economy-design.md` (D-1…D-13)
> Research: `context/changes/world-economy-profit-rule/research.md`
> Merge order: **F1 first**, then W1 `six-worlds-catalogue`. Both edit `src/i18n/pl.ts`.
> **Amended 2026-08-27 by the contention sweep** — `context/runs/2026-08-27-world-economy/ownership.md`
> is binding over anything below it that disagrees. Two cross-plan defects were fixed in
> place here (CPD-5, CPD-6); each edit is marked `[contention sweep]`.

## Overview

Turn MathShop's one-term earnings rule into a **profit rule** —
`profit = max(0, revenue − cost)`, with `cost` applied to a shift's revenue and
**never** to the wallet — close the upgrade catalogue at **eight** entries (1 unlock
+ 5 capacity + 2 margin), and add **per-world decorations** as a second,
non-catalogue list that gives the wallet a renewing sink. Three machine-checked
economic invariants (no-trap, no-harm, no-dominance) and a pacing model that
derives the reference shift are the headline deliverables, not afterthoughts.

## Current State Analysis

- `earningsForShift(taskCount, cleanCount)` in `src/data/shift.ts` is
  `EARN_PER_TASK (5) × taskCount + EARN_PER_CLEAN (3) × cleanCount`. There is no
  cost term anywhere; nothing in `src/` reduces `wallet_balance` except `buyUpgrade`.
- `src/data/upgrades.ts` holds **6** entries. Five carry `extraTasks: 1` and
  `MAX_BONUS_TASKS = 5`, so capacity is **exactly full** — a sixth capacity entry
  would be an effect-less purchase. `sign` has `extraTasks: 0` and does nothing.
- `canBuy`'s rung order is fixed: unknown → owned → world level → skill →
  task history → affordability, with *"an owned upgrade is NEVER retro-locked"*
  pinned by `tests/upgrades.test.ts` (`"owned short-circuits before the skill/history
  rungs (no retro-lock)"`).
- `ShopState` in `src/types.ts` is `{ purchased: string[]; purchasedMeta?: … }` —
  the optional-sibling precedent for `decorations?: string[]`.
- **`ShiftScreen` throws away the server's authoritative `earned`.** Its completion
  `useEffect` types the `/api/shifts/complete` response as
  `{ leveledUp; businessLevel }` and displays its own client-computed
  `earningsForShift(...)`. Today the two agree by construction; under the profit
  rule they stop agreeing (client shows revenue, wallet receives profit).
  This is the single highest-value correction in the research.
- `Upgrade.art` is **required** (`art: string`) and five surfaces render
  `<img src={…art}>`: `ShopArt` (slotted layer + corner row), `UpgradeShop`
  (unlock card, affordable tile, locked tile, owned row), `growth.astro`
  (`unlocks` list + next card), `start.astro` (next card), `ShiftResults` (`nextInfo`).
- `shopRunningCost`, `shopEffects`, `profitForShift`, `quantityMargin`,
  `accuracyMargin`, `requiredUpgrade` and `Decoration` **do not exist** — every one
  is a symbol to be written, not called.
- **Three suites constrain the catalogue's growth.** `tests/shop-art-slots.test.tsx`
  (*"covers all six upgrade ids in every table"*) loops `UPGRADE_IDS` against every
  `WORLD_SLOTS` table; `tests/stages.test.ts` (*"returns an honest empty list for the
  terminal stage"*) forbids `requiredWorldLevel: 4` on a new entry;
  `tests/upgrades.test.ts` (*"has 5–8 upgrades…"*) already tolerates 8.
- **`e2e/growth.spec.ts` (*Risk E2E-F4-3*) is a known regression.** It seeds
  `purchased: ["sign","shelf"]` at level 1 to reach the empty-shop state; once
  decorations are always buyable at price-only gating that seed stops producing one.
- **`e2e/gameplay-restore.spec.ts` asserts exact payouts** through
  `t.results.earnedLabel`, `t.upgradeShop.decisionPrompt` and
  `t.upgradeShop.nextProgress`, on a profile owning nothing or owning only `sign`.
- **No decoration art exists** — all three `atomic-assets-v{1,2,3}` manifests were
  searched for `decor|plant|poster|lamp|banner|flower|sticker|cosmetic|ozdob`: zero hits.
- `scripts/telemetry-harness/child-model.ts` already exports `ChildModel`, `rng`
  (mulberry32), `pFirstTry`, `missesThisTask` and the three cohorts `MISS_MODEL`.
- `src/data/adaptive.ts` exports `shiftLengthRangeFor(d)` and `TARGET_SUCCESS = 0.8`
  — the engine's own steady-state first-try target.

## Desired End State

A shift's results screen shows **przychód · koszt · zysk** instead of one number;
the wallet receives `profit` computed once, server-side, from the trusted
`shop_state`. The shop offers **eight** catalogue entries across two branches
(capacity vs margin) gated behind `sign`, plus **four decorations per world** that
cost money, change the picture and change nothing else. Three property sweeps in
`tests/` prove that no purchase is ever a trap, that a decoration can never cost
anything but its price, and that neither branch is strictly the better buy. A pure
pacing simulation in `scripts/` re-runs on every `npm test` and reports the purchase
timeline, each price in **tasks solved**, and the reference shift the sweeps use.

**Verify by:** `npm run lint`, `npm run check`, `npm test`, `E2E_PORT=<yours> npx
playwright test` all green on the feature branch; and by playing a shift with two
capacity upgrades owned and confirming the results screen's `zysk` equals the wallet
delta.

### Key Discoveries

- `shopRunningCost` **must be keyed on earning ownership**, or `sign` is itself a
  no-trap violation: it is an `investment` entry with no earnings effect, so under
  `∀ u ∉ investment` the sweep evaluates `profit(I ∪ {sign}) < profit(I)`.
- Weighting `sign` at **zero** also protects two shipped E2E tests:
  `e2e/gameplay-restore.spec.ts` earns a shift owning nothing and again owning only
  `sign`, and asserts the *exact* payout. With `sign.runningCost = 0` both shifts
  have `cost = 0`, so `profit === revenue` and both assertions survive untouched.
- The **reference shift is derivable, not inventable**: `shiftLengthRangeFor(d)`
  gives the length band and `TARGET_SUCCESS = 0.8` is the accuracy the adaptive
  engine steers toward. `referenceShift(d, bonus)` is their composition.
- **No-trap holds in expectation, not per shift.** On a `cleanCount = 0` shift the
  accuracy margin adds nothing while still raising cost, and `max(0, …)` clamps at
  zero, not at the pre-purchase profit.
- `seedChildProfile` (`e2e/helpers/accounts.ts`) writes `shop_state` verbatim from
  `options.shopState`, so seeding `{ purchased: […], decorations: […] }` needs no
  helper change.
- `buyUpgrade`'s inner-spread comment is load-bearing: naming a key beside
  `...current.shop_state` **shadows** the outer spread. A decoration write must not
  drop `purchased` or `purchasedMeta`.
- `computeWeeklyReport` (`src/lib/services/reports.ts`) flips `earningsKnown` false
  for any `shift_log` row with `upgrade_purchased === null && earned == null` — which
  is exactly a naive decoration-purchase row, and the suppression is permanent.

## What We're NOT Doing

- **No migration, no new table, no new RLS policy.** `shop_state.purchased` stays a
  flat global id list and gains the optional sibling `decorations?: string[]` in the
  same jsonb.
- **No wallet debit on the shift path**, ever. `wallet += max(0, revenue − cost)`.
- **No change to the six shipped entries' `cost` values.** `sign` stays 30,
  `shelf` 60, `register` 100, `slot` 150, `storage` 210, `customers` 300 — see
  Autonomous decision **AD-7**.
- **No per-world catalogue vocabulary and no `t.worlds[slug].upgrades[id]`
  resolver.** That is W1's surface (**AD-8**).
- **No decoration art files, no placeholder assets, no `assets/` path in code.**
- **No new task type, no new competency, no parent-facing economy controls, no
  wall-clock cost accrual, no random unlocks.**
- **No `revenue`/`cost` columns on `shift_log`.** `earned` keeps its contract ("the
  amount added to the wallet") and now records profit.
- **No re-litigation of D-1…D-13.**
- **No new E2E specs.** Phase 6 repairs the existing regression only; new browser
  coverage belongs to the run's `/10x-e2e` step.

## Implementation Approach

Build **outside-in on the pure data layer first**, because that is the whole safety
argument: `src/data/shift.ts` and `src/data/upgrades.ts` are dependency-free and
imported by both the island and the authoritative route, so a rule that lands there
cannot disagree with itself. The seam between them stays a plain value object
(`ShopEffects`) — `shift.ts` must not start importing `upgrades.ts`.

Sequence: pacing machinery (Phase 1) → profit rule end-to-end (Phase 2) → catalogue
to eight (Phase 3) → invariant sweeps and constant tuning (Phase 4) → decorations
(Phase 5) → regression repair and documentation (Phase 6). Phase 4 sits after the
catalogue exists and before decorations because it is what licenses the Phase 3
constants; Phase 5 adds the no-harm clause once real decoration ids exist.

## Critical Implementation Details

**State sequencing — the client must stop computing its own payout.** `ShiftScreen`'s
completion `useEffect` currently computes `earningsForShift` locally and feeds it to
`canUpgrade`, `nextInfo.wallet` and the `Outcome`. It must read the server's numbers
instead. `tests/shift-screen.test.tsx`'s `fetchMock` resolves
`{ leveledUp: false, businessLevel: 1 }` with **no payout field** — reading a new
field against that mock yields `undefined` and the results copy interpolates
`"undefined"` **without throwing**. The mock must gain the new fields in the *same
phase* as the read, or the failure is silent.

**Ordering — `runningCost` weights and the shipped E2E.** `sign.runningCost` must be
`0` before any E2E is re-run: `e2e/gameplay-restore.spec.ts` asserts exact payouts on
a profile that owns nothing and then only `sign`.

**Gotcha — the inner spread.** Every `shop_state` write names its key beside
`...current.shop_state` and therefore shadows the outer spread. The decoration write
must carry `purchased` and `purchasedMeta` forward explicitly.

---

## Phase 1: Pacing model + the reference shift

### Overview

Land the pure simulation D-13 requires, and with it the **reference shift** the
Phase 4 sweeps evaluate at. No product behaviour changes in this phase.

### Changes Required

#### 1. The simulator

**File**: `scripts/telemetry-harness/pacing.ts` (new)

**Intent**: A pure, dependency-free-of-Supabase simulation of `N` shifts per cohort
that imports `src/data/*` so a price change re-runs it, and consumes the existing
`scripts/telemetry-harness/child-model.ts` rather than writing a second assumption
file. It exports the reference shift, a price-in-tasks conversion, and a purchase
timeline. Its module header must carry the harness README's caveat verbatim in
spirit: this says how the **economy** responds to a class of player, not what a real
child does.

**Contract**:
- `referenceShift(d: number, bonus: number): { taskCount: number; cleanCount: number }`
  — `taskCount = min(MAX_SHIFT_TASKS, round((min+max)/2) + bonus)` from
  `shiftLengthRangeFor(d)`; `cleanCount = round(TARGET_SUCCESS * taskCount)`.
  Both inputs are imported from `src/data/adaptive.ts`; **no new constant is invented.**
- `costInTasks(price: number, effects: ShopEffects, d: number): number` — the price
  expressed in tasks solved at the reference shift, per D-13's "the natural price
  unit is mathematics".
- `simulatePurchases(model: ChildModel, shifts: number, seed: number): PurchaseTimeline`
  — walks shifts with the real `shiftLength`/`foldShiftOutcomes`/`canBuy` and a
  greedy "buy the cheapest buyable thing" policy, recording per shift the wallet,
  the profit, and what was bought. Deterministic given `seed`.
- A `report()` entry point printing the timeline as a table, invoked by hand; it must
  not run on import.

#### 2. The pacing assertions

**File**: `tests/pacing.test.ts` (new)

**Intent**: Assert the machinery's properties and PRD v3's own pacing signal, so a
future price change fails loudly instead of drifting.

**Contract**: `referenceShift` never exceeds `MAX_SHIFT_TASKS` and is non-decreasing
in `d` and in `bonus`; `cleanCount ≤ taskCount`; `simulatePurchases` is deterministic
for a fixed seed; and for every cohort in `MISS_MODEL` the **first purchase lands on
or before shift 3** (`prd-v3.md:62`). The last assertion passes against today's
catalogue and must keep passing after Phase 3 and Phase 5 — it is the tripwire on
price changes.

### Success Criteria

#### Automated Verification

- `npm test` — baseline + ~8 new tests (measure the baseline on this branch **before**
  Phase 1)
- `npm run check` — 0 errors; confirms `scripts/**` is inside `tsconfig.json`'s
  `include: ["**/*"]` and that the `tests/ → scripts/` relative import type-checks
- `npm run lint` — clean
- `npx vitest run tests/pacing.test.ts` twice in a row produces identical results
  (determinism)

#### Manual Verification

- The `report()` output is readable and its purchase timeline is plausible against
  the "catalogue empties in ~7–25 shifts" band from backlog E1

---

## Phase 2: The profit rule, end to end

### Overview

Introduce `ShopEffects` / `shopEffects()` / `shopRunningCost()` / `profitForShift()`
and thread revenue·cost·profit from the pure layer through the service, the route,
the island and the results UI. The catalogue does **not** grow in this phase.

### Changes Required

#### 1. The catalogue's effect fields and the selector

**File**: `src/data/upgrades.ts`

**Intent**: Give `Upgrade` the fields the profit rule reads, and add the one selector
that resolves an owned-id list into the effects the economy needs. Keying the running
cost on a **per-entry weight** is what makes `sign` legal under the no-trap quantifier
and what keeps the invariant swept over the whole catalogue rather than a subset.

**Contract**:
```ts
export interface ShopEffects {
  bonusTasks: number;      // existing shiftBonusTasks(), unchanged
  quantityMargin: number;  // 1 when unowned
  accuracyMargin: number;  // 1 when unowned
  runningCost: number;     // Σ runningCost over OWNED CATALOGUE entries only
}
export function shopEffects(purchased: string[]): ShopEffects
export function shopRunningCost(purchased: string[]): number
```
`Upgrade` gains `runningCost: number` (required — a new entry cannot forget it) and
optional `quantityMargin?: number` / `accuracyMargin?: number`. First-guess weights:
`sign: 0`; each of `shelf`/`register`/`slot`/`storage`/`customers`: **2**. An id not
in the catalogue contributes **0** by construction (`getUpgrade` misses) — that is the
no-harm invariant enforced by module boundary, not only by test. Document that in the
function's own comment.

#### 2. The formula

**File**: `src/data/shift.ts`

**Intent**: Add the profit formula as a pure function taking effects **as data**, so
`shift.ts` still does not import `upgrades.ts` (see `MAX_SHIFT_TASKS`'s header for why
that seam is closed on purpose). `earningsForShift` is **retained** as revenue at
margin 1 — `tests/shift.test.ts`'s *"never pays zero — the floor is base * tasks"* is
true of revenue and false of profit, and `tests/shifts-complete.test.ts` expresses
five expectations through it.

**Contract**:
```ts
export function profitForShift(
  taskCount: number, cleanCount: number, effects: ShopEffects,
): { revenue: number; cost: number; profit: number }
```
`revenue = round(EARN_PER_TASK * quantityMargin) * taskCount + round(EARN_PER_CLEAN *
accuracyMargin) * cleanCount`; `cost = effects.runningCost`; `profit = max(0, revenue
− cost)`. Rounding the *per-unit* rates rather than the total keeps the wallet in
whole złoty and keeps the margins legible to a child ("5 zł → 7 zł za zadanie"). The
`ShopEffects` type is imported type-only from `@/data/upgrades` — a **type** import
does not reopen the module seam; state that in a comment so a later reader does not
"fix" it.

#### 3. Server authority

**File**: `src/lib/services/child-profiles.ts`

**Intent**: `recordShiftResult` already reads the profile with `.select("*")`, so
`current.shop_state` is in hand where `earningsForShift` is called — no signature
change. Compute the three numbers there and credit the wallet with `profit`.

**Contract**: `ShiftResult` becomes `{ earned: number; revenue: number; cost: number;
profit: number; businessLevel: number; leveledUp: boolean }`, with `earned === profit`
retained as the wallet-delta name so `shift_log.earned`'s documented contract ("the
amount added to the wallet") stays literally true and needs no backfill. The wallet
update is `current.wallet_balance + profit`; `appendShiftLog` receives `earned: profit`.

#### 4. Route response

**File**: `src/pages/api/shifts/complete.ts`

**Intent**: Return the three numbers so the island stops recomputing.

**Contract**: the 200 body gains `revenue`, `cost`, `profit` beside the existing
`earned`, `businessLevel`, `leveledUp`. `export const prerender = false` stays.

#### 5. The island stops computing its own payout

**File**: `src/components/child/ShiftScreen.tsx`

**Intent**: Read the server's numbers instead of the local `earningsForShift`, and
feed them to `canUpgrade`, `nextInfo.wallet` and `Outcome`. This closes the
divergence described in *Critical Implementation Details*.

**Contract**: the response type gains `revenue: number; cost: number; profit: number`;
`Outcome` gains `revenue`/`cost` and its `earned` becomes the server's `profit`.
`canUpgrade` and `nextInfo.wallet` use `walletBalance + profit`. **Drop the local
`earningsForShift` call and its import** — today it is computed inside the completion
`useEffect` itself (the `const earned = earningsForShift(taskCount, cleanCount)` bound
just above the `fetch`) and is used *only* after the response resolves, so there is no
optimistic pre-response render to preserve. Leaving it in place is the divergence:
one of the two numbers would be revenue and the other profit, and nothing would fail.
If a later phase does want an optimistic render, it renders `revenue` and labels it as
such, never as the payout.

#### 6. The results screen shows three numbers

**File**: `src/components/child/ShiftResults.tsx`, `src/i18n/pl.ts`

**Intent**: *Przychód · koszt · zysk* is **the lesson**, not decoration on top of it —
it is the only place a second arithmetic operation enters the economy. The existing
`t.results.earnedLabel` ("Do portfela: +{earned}") keeps naming the wallet payout, so
`e2e/gameplay-restore.spec.ts` keeps matching.

**Contract**: `ShiftResultsProps` gains `revenue: number; cost: number`. New i18n keys
under `results`: `revenueLabel`, `costLabel`, `profitLabel`, `breakdownHeading`. The
cost row renders only when `cost > 0`, so a first-shift child is not shown a
zero-cost subtraction they cannot yet cause. **Before adding any label, grep
`src/i18n/pl.ts` in both directions for it as a substring (L-007)** — note `t.stages`
already carries "Popyt i zysk" and "…większe zyski!".

#### 7. Expectations

**Files**: `tests/shift.test.ts`, `tests/shifts-complete.test.ts`,
`tests/shift-screen.test.tsx`

**Intent**: Add profit expectations beside the retained revenue ones, and fix the
`fetchMock` in the same phase as the read it breaks.

**Contract**: new cases — `profitForShift` at margins 1 equals `earningsForShift`
minus cost; `profit ≥ 0` on the degenerate shift (1 task, 0 clean, full catalogue
cost); **wallet monotonicity** — for any shift outcome, `wallet` after
`recordShiftResult` is `>=` wallet before (this is the FR-008 guard against a future
refactor reaching for a debit); the route returns all three numbers. The
`shift-screen` `fetchMock` must resolve `revenue`/`cost`/`profit`.

### Success Criteria

#### Automated Verification

- `npm test` — baseline + ~12 (baseline = the Phase 1 count on this branch)
- `npm run lint` / `npm run check` — clean
- `E2E_PORT=<yours> npx playwright test e2e/gameplay-restore.spec.ts` — passes
  **unchanged**, proving `sign.runningCost = 0` preserved the exact-payout assertions
- **Deliberate break** (L-004): change `recordShiftResult`'s wallet update from
  `+ profit` to `+ revenue`. The wallet-monotonicity test must stay green (it is a
  monotonicity guard, not a profit guard) and a *profit-specific* test must go red.
  If nothing goes red, the phase has no coverage of the thing it exists to do — find
  the assertion that bites and add it. Restore afterwards, and record in the handoff
  **why that redness is evidence for this specific claim**.

#### Manual Verification

- Play a shift on a profile owning two capacity upgrades: the results breakdown's
  `zysk` equals the wallet delta shown on `/app/start`

---

## Phase 3: The catalogue to eight — two margins, one branch gate

### Overview

Add the two margin entries, re-cast `sign` as the branch gate with a new
`requiredUpgrade` rung, and make an entry with **no committed art** renderable at all
five surfaces that assume `art` is a required string.

### Changes Required

#### 1. Two entries and one rung

**File**: `src/data/upgrades.ts`

**Intent**: Capacity is exactly full, so the two free FR-010 slots are the two
margins. `sign` becomes a **gateway, not an effect**: a universal margin would merely
be a different value of `EARN_PER_TASK`, while a universal gateway makes the first
purchase a choice of direction. Branches govern **visibility and order, never
availability** — nothing may permanently foreclose anything.

**Contract**: `Upgrade` gains `requiredUpgrade?: string`; `BuyReason` gains
`"branch-locked"`; `canBuy` evaluates the new rung **after** the world-level check and
**before** the skill gates, inheriting the owned-first short-circuit so a
branch entry already bought can never be retro-locked. Two entries, first-guess values:

| id | cost | order | reqWorldLevel | requiredUpgrade | gate | extraTasks | effect | runningCost |
|---|---|---|---|---|---|---|---|---|
| `precision` | 140 | 7 | 2 | `sign` | `requiredSkill { money, 2 }` | **0** | `accuracyMargin: 1.5` | 3 |
| `margin` | 180 | 8 | 3 | `sign` | `requiredTaskHistory { math, 20 }` | **0** | `quantityMargin: 1.4` | 3 |

**`extraTasks: 0` on both is load-bearing, not a default.** `Upgrade.extraTasks` is a
**required** field, so the implementer must write it; and `shiftBonusTasks` clamps the
sum to `MAX_BONUS_TASKS = 5`, which the five shipped capacity entries already reach
**exactly**. A margin entry carrying `extraTasks: 1` would push the sum to 6–7, the
clamp would swallow it, and the last capacity purchase a child makes would then add
**zero tasks while still adding its `runningCost`** — a strict no-trap violation
manufactured by the catalogue itself. Margins move the *rate*, never the count.

`requiredWorldLevel` **must not be 4** on either entry — `tests/stages.test.ts`'s
*"returns an honest empty list for the terminal stage"* asserts
`unlocksForStage(STAGES[3]) === []`. Levels 1–3 are free; keeping both above 1 also
keeps `e2e/growth.spec.ts`'s "`sign` and `shelf` are the only two upgrades with
`requiredWorldLevel` 1" comment true.

#### 2. Art becomes optional, and one glyph component serves five surfaces

**File**: `src/components/child/ShopGlyph.tsx` (new), plus the five render sites

**Intent**: No art exists for the two margins and none will exist for decorations, so
`art` stops being required and an entry without it renders from **lucide + the app's
own design tokens** — the sanctioned, documented deviation `src/data/stages.ts`
established, not a workaround. One component holds the closed icon map so the fallback
cannot drift between the five surfaces.

**Contract**: `Upgrade.art` becomes `art?: string`; `Upgrade` gains
`icon?: ShopIconKey`. `ShopGlyph({ art, icon, className })` renders
`<img src={art}>` when `art` is set and the mapped lucide glyph otherwise.

> **[contention sweep, CPD-6] `ShopIconKey` and `ShopGlyph`'s map must be closed but
> APPEND-EXTENSIBLE — W1 appends to both.** W1's Phase 4 adds eight decorations for
> `pracownia` and `laboratorium`, and its manual criterion 4.9 requires Laboratorium's set
> to look *visibly different* from the others; it cannot, if the union only carries the
> keys F1's own 16 decorations happen to use. Derive `ShopIconKey` from the map's own keys
> (`keyof typeof SHOP_ICONS`) so adding one entry to the map widens the union with no type
> edit, and do **not** pin the map with an exhaustive literal count or a fixed-length tuple —
> criterion 5.4's coverage assertion must quantify over `DECORATIONS`/`UPGRADES`, never over
> a hardcoded key list. W1 is bound to append-only, one entry per key, and may not
> restructure the map or the lookup. It is a
plain React component with no hooks, so `start.astro` and `growth.astro` render it
server-side with no `client:` directive. Replace the `<img src={…art}>` at:
`ShopArt` (slotted layer **and** corner row), `UpgradeShop` (unlock card, affordable
tile, locked tile, owned row), `growth.astro` (`unlocks` list, next card),
`start.astro` (next card), `ShiftResults` (`nextInfo`).

**The module header of `src/data/upgrades.ts` must record the art upgrade path**, in
the shape `src/data/stages.ts`'s `ART DEVIATION FROM THE MOCKUP` block uses: what is
missing, why lucide, and exactly what to do when art arrives (ship
`public/illustrations/upgrade-<id>.svg`, add a `slice-map.md` row, set `art`). This is
a deliberate deviation with an upgrade path, and it must read as one.

#### 3. Slot tables

**File**: `src/components/child/ShopArt.tsx`, `tests/shop-art-slots.test.tsx`

**Intent**: `tests/shop-art-slots.test.tsx` loops `UPGRADE_IDS` against every
`WORLD_SLOTS` table, so two new ids × three world tables = six new slots, plus two in
`DEFAULT_SLOTS`. Each must set **exactly one** of `left`/`right` and **one** of
`top`/`bottom`, as a percent in 0–100.

> **[contention sweep, CPD-5] Do NOT write that shape assertion — it already exists.**
> The original wording (*"a fourth assertion in the same file"*) would have duplicated
> `tests/shop-art-slots.test.tsx` § *"sets exactly one of left/right and one of
> top/bottom, as percents in 0–100"*, which is already the fourth of the file's four data
> assertions (W1's plan names them as *"all four data assertions"*, quoting this file's own
> module header). It iterates `Object.entries(WORLD_SLOTS)` × `Object.entries(table)`, so
> it **already covers** `precision` and `margin` in every table the moment they are added,
> and it will cover W1's two new tables with no edit. Add the eight slot entries; add no
> assertion. **Do** update the module header's stale phrasing — it says *"`DEFAULT_SLOTS`
> covers all six ids, so `unplaced` is ALWAYS empty"*, which stays true only because this
> phase adds both new ids to `DEFAULT_SLOTS`; make the count-free rewrite there at the same
> time as the case-title rename below.

**Contract**: add `precision` and `margin` to `DEFAULT_SLOTS` and to each of
`piekarnia`, `galaktyczna-baza`, `sklep-ksiegarnia`, placed in that plate's margins
per the per-world comments already in the file. `kawiarnia` stays **absent** on
purpose. Rename the test title *"covers all six upgrade ids in every table"* to a
count-free phrasing so it does not go stale again. **`WORLD_SLOTS` is a two-feature
contention point** — W1 adds two new *worlds* to the same object; keep the change
additive (new keys only, no restructuring) so the merge is a clean append.

#### 4. Copy

**File**: `src/i18n/pl.ts`

**Intent**: The catalogue carries no literal copy (L-003), so both entries need
`t.upgrades[id]` names, and the new rung needs a locked-reason string.

**Contract**: `t.upgrades.precision` and `t.upgrades.margin` (`{ name, desc }`), and
`t.upgradeShop.lockedByBranch` (interpolating `{name}`). `UpgradeShop.lockedReason`
gains the `branch-locked` case. **Run the two-direction substring grep before
committing any of these three strings (L-007)** — in particular check the new names
against `t.upgrades.register` ("Lepsza kasa") and against `t.stages`. `src/i18n/pl.ts`
is **append-only, one entry per key** — W1 appends to the same file immediately after.

### Success Criteria

#### Automated Verification

- `npm test` — Phase 2 baseline + ~10
- `npm run lint` / `npm run check` — clean
- `tests/upgrades.test.ts` *"has 5–8 upgrades with unique ids and increasing order"*
  passes at 8 entries; *"owned short-circuits before the skill/history rungs"* extended
  to cover `branch-locked`
- `tests/stages.test.ts` — *"returns an honest empty list for the terminal stage"* and
  *"partitions the catalogue without loss"* both still pass
- Two-direction i18n substring grep prints no collision for `precision`, `margin`,
  `lockedByBranch`
- `E2E_PORT=<yours> npx playwright test` — Playwright baseline unchanged

#### Manual Verification

- `/app/upgrades` at business level 3 without `sign`: both margins appear under
  "Wkrótce" with the branch reason, and buying `sign` moves them without any other
  entry becoming unavailable
- The two margin tiles render a legible lucide glyph at the same visual weight as the
  six illustrated tiles

---

## Phase 4: The invariant sweeps

### Overview

The headline deliverable. Property sweeps that make the economy's safety a machine
fact, plus whatever constant tuning they force.

### Changes Required

#### 1. No-trap

**File**: `tests/economy-invariants.test.ts` (new)

**Intent**: For every unowned investment entry `u`, buying `u` must never **lower**
profit at the reference shift, for all `d`. Without it, `f(purchased)` can produce an
upgrade that costs more to run than it earns — worse than an unbraked economy,
because a trap purchase punishes a child for engaging with the one decision the
product is built around, and cannot be undone.

**Contract**: sweep **all ≤2⁸ = 256** investment subsets × a grid `d ∈ {0, 0.05, …, 1}`,
evaluating at `referenceShift(d, shopEffects(I).bonusTasks)` imported from
`scripts/telemetry-harness/pacing.ts`. The assertion is **two-tiered, and the tiers
are not interchangeable**:

- **Every** `u ∉ I`: `profit(I ∪ {u}) >= profit(I)`. This is the trap clause — it is
  what forbids an entry whose running cost outruns its own effect.
- **Every earning** `u ∉ I` — one with `extraTasks > 0` or a margin ≠ 1:
  `profit(I ∪ {u}) > profit(I)`, strictly. This is what forbids a *silently useless*
  purchase and is the clause the Phase 4 deliberate break must turn red.

**A single strict clause over the whole catalogue is unsatisfiable and must not be
written.** `sign` carries `extraTasks: 0`, no margin and `runningCost: 0` (**AD-1**),
so `profit(I ∪ {sign}) − profit(I)` is **exactly 0** for every `I` and every `d` — a
`>` assertion over all entries fails on `sign` by construction, at every one of the
5376 sweep points. Weighting `sign` at zero removes the *negative* case, not the
equality; the partition above is what makes both true at once. The failure message
must name the subset, the entry, `d`, and **which tier failed**. Follow the `D_SWEEP`
convention in `tests/adaptive.test.ts`.

#### 2. No-dominance

**File**: same

**Intent**: No-trap says no purchase is *worse*; nothing yet says no **branch** is
strictly better. A dominant branch means the child is executing, not deciding — and
the capacity-vs-margin tension is the point of the whole tranche.

**Contract**: `ROI(u | I, d) = [profit(I ∪ {u}, d) − profit(I, d)] / u.cost`;
`ROI*_B = max over buyable u in branch B` for `B ∈ {capacity, margin}`. Assert
`min(ROI*_cap, ROI*_mar) ≥ DOMINANCE_FLOOR × max(ROI*_cap, ROI*_mar)` with
`DOMINANCE_FLOOR = 0.6` as a **named exported constant**. Sweep **reachable states
only** — the gates make many subsets unoccupiable and failing on one is a false alarm.
**The reachability filter is part of the deliverable**: a breadth-first walk over
`(subset, businessLevel, skillState)` — not over subsets alone, because
`businessLevelForShifts` is uncapped and every gate is monotone. Only states where
**both** branches have at least one buyable entry are asserted on.

#### 3. Tuning

**Files**: `src/data/upgrades.ts` (constants only)

**Intent**: The first-guess weights, margins and prices from Phase 3 are exactly that.
If a sweep fails, **adjust the constant, never the invariant.**

**Contract**: the tunables are `runningCost` per entry, `accuracyMargin`/`quantityMargin`
multipliers, and the two new entries' `cost`. The six shipped entries' `cost` values
are **out of bounds** for this tuning (**AD-7**). Record the final values and the
reason each moved in the plan's `## Progress` notes and in the handoff.

### Success Criteria

#### Automated Verification

- `npm test` — Phase 3 baseline + ~6 (few tests, large loops)
- The no-trap sweep visits **256 subsets × 21 difficulty points** and asserts on every
  unowned entry — assert the visit count explicitly so a silently-empty sweep is
  impossible
- The reachability BFS reports a non-empty, strictly-smaller-than-256 reachable set —
  a filter that admits everything is not a filter
- `npm run lint` / `npm run check` — clean
- **Deliberate break** (L-004): set `customers.runningCost` to a value above its
  marginal revenue at the reference shift (e.g. 40). No-trap must go red naming
  `customers`. Then **meta-check it**: that break is exactly the mistake a future
  price tweak would make, so its redness is evidence the sweep bites on real
  mistuning — unlike, say, deleting an entry, which any suite would catch. Restore.

#### Manual Verification

- Read the no-dominance failure output (temporarily lower `DOMINANCE_FLOOR` to 0.95 to
  force it) and confirm it names a state a child could actually occupy

---

## Phase 5: Decorations — the renewing sink

### Overview

A second, non-catalogue list with **zero economic effect by construction**, gated on
**price only**, scoped **per world**, persisted in `shop_state.decorations`.

### Changes Required

#### 1. The decoration catalogue

**File**: `src/data/decorations.ts` (new)

**Intent**: The sink that renews on world change, so FR-013 keeps its meaning past the
catalogue's end. Zero effect fields — that absence is what makes a decoration legal
under the no-trap invariant, and it must be structural, not conventional.

**Contract**:
```ts
export type ShopIconKey = …            // shared with ShopGlyph's closed map
export interface Decoration {
  id: string;        // world-prefixed, e.g. "kawiarnia-lampki" — globally unique
  world: string;     // owning world slug
  nameKey: string;   // t.decorations[id]
  cost: number;
  icon: ShopIconKey;
  art?: string;      // UNSET in the first batch — see the module header
}
export const DECORATIONS: readonly Decoration[]
export const DECORATION_IDS: [string, ...string[]]
export function getDecoration(id: string): Decoration | undefined
export function decorationsForWorld(slug: string): Decoration[]
export function readDecorations(shopState): string[]        // `?? []`, mirrors readPurchased
export function canBuyDecoration(d, ctx): BuyCheck          // owned → world → affordability
export function nextPurchase(ctx): NextThing | null         // nextUpgrade(...) ?? cheapest unowned decoration
```
`BuyReason` gains **`"wrong-world"`** alongside Phase 3's `"branch-locked"` — the
world rung is a distinct rejection and Phase 5's own test asserts on it ("a decoration
from another world is rejected"). Reusing `"locked"`, which `UpgradeShop.lockedReason`
already renders as *"unlock at business level {level}"*, would show a child a level
number that has nothing to do with why the buy failed.

**Four decorations per world, for every world in `WORLD_SLUGS`**, prices **40 / 80 /
140 / 220** (**AD-5**) — **16 entries in F1**, and 24 once W1 `six-worlds-catalogue`
appends `pracownia` and `laboratorium` in its Phase 4. (AD-5's "6 × 4 = 24" names the
post-W1 art debt; F1 alone authors 16.)

**Ship the totality assertion with the data, in `tests/decorations.test.ts`:** for
every slug in `WORLD_SLUGS`, `decorationsForWorld(slug).length` equals the per-world
count. Without it, a world with an empty set makes `nextPurchase` return `null` the
moment its catalogue empties and the FR-013 "next thing" card silently goes back to
the empty state D-11 exists to abolish — with **nothing red**. This is also the seam
with W1: W1's Phase 4 is written as *droppable*, and its own contracted deliberate
break ("remove one new world's decoration set → F1's per-world sweep goes red") has
nothing to bite on unless this assertion exists. It is what makes W1's Phase 4
non-droppable once F1 has landed.

No `slot` field: the first batch takes `ShopArt`'s documented
corner-row fallback, which is exactly what lets sets ship one entry at a time. The
module header carries the **ART DEVIATION** block in `src/data/stages.ts`'s shape.
The module imports `@/data/upgrades` (one-way, mirroring `stages.ts`); nothing in
`upgrades.ts` may import it back — that direction is the no-harm invariant.

#### 2. Persistence

**File**: `src/types.ts`, `docs/reference/contract-surfaces.md`

**Intent**: The optional-sibling shape `purchasedMeta?` already established, so every
legacy `{}` and `{ purchased: [] }` row stays valid and **no migration is needed**.

**Contract**: `ShopState` gains `decorations?: string[]`, documented as "ids of owned
decorations; **never** catalogue ids — a decoration in `purchased` would reach
`shopRunningCost` and `canBuy` and re-create the trap by the back door".
`src/types.ts` is **append-only**. The contract-surfaces § `public.child_profiles`
Columns paragraph gains the `decorations?` sibling; **on a merge conflict there, keep
both sides** — never `--ours`/`--theirs`.

#### 3. The buy path

**File**: `src/lib/services/child-profiles.ts`, `src/pages/api/decorations/buy.ts` (new)

**Intent**: Server-authoritative like an upgrade buy — recompute affordability from the
trusted row, never trust a client amount.

**Contract**: `buyDecoration(client, profileId, decorationId): BuyDecorationResult`
mirroring `buyUpgrade`: unknown-id short-circuit, RLS-scoped read by `id`,
`account_id` never from the caller, `canBuyDecoration` against the trusted row, one
UPDATE debiting `wallet_balance` and appending to `shop_state.decorations`. **The
inner spread is load-bearing** — carry `purchased` and `purchasedMeta` forward.
Two deliberate departures from `buyUpgrade`, both recorded in the function's comment:
**no `shift_log` row** (a `{ upgrade_purchased: null, earned: null }` row flips
`computeWeeklyReport`'s `earningsKnown` false *permanently*, silently suppressing the
parent report's earnings tile; and tagging it as `upgrade_purchased` would list a
decoration among "upgrades bought this week"), and **no `+1 decisions` credit**
(`decisions` is surfaced to the parent and gates nothing, so crediting it would make
decoration-spam a way to inflate a competency the parent sees). The route:
`export const prerender = false`, zod `z.enum(DECORATION_IDS)`, the same
`json()` + `applyNoStore` shape `src/pages/api/upgrades/buy.ts` uses.

**FR-008 note for the reviewer, and it is load-bearing:** the standing instruction
*"reject a wallet debit on FR-008 grounds"* is correct **for the shift path and only
there**. `prd-v3.md:62` names *"new shelf/sign/**decoration**"* as a legitimate visible
change, so v3's own vocabulary contemplates buying one; the decoration buy is the
**second sanctioned spend path beside `buyUpgrade`**, and rejecting it would reject a
correct implementation (**AD-4**).

#### 4. Surfaces

**Files**: `src/components/child/UpgradeShop.tsx`, `src/components/child/ShopArt.tsx`,
`src/pages/app/{upgrades,start,growth}.astro`, `src/components/child/ShiftScreen.tsx`,
`src/components/child/ShiftResults.tsx`, `src/i18n/pl.ts`

**Intent**: `ShopArt` already composites percent-positioned overlays keyed by id with a
documented corner-row fallback, so **no new UI system is needed** — but it does need a
decorations source list and a new prop, threaded from its three call sites.

**Contract**: `ShopArtProps` gains `decorations: string[]`; owned decorations of the
current world render through `ShopGlyph` in the corner row. `UpgradeShop` gains a
third section listing the current world's decorations with price-only gating, posting
to `/api/decorations/buy`. The three "next thing" surfaces (`start.astro`,
`growth.astro`, `ShiftScreen`'s `nextInfo`) switch from `nextUpgrade` to
`nextPurchase`, so the card survives an empty catalogue — that is D-11's whole
premise. `t.decorations[id]` for all 16 entries, plus
`t.upgradeShop.decorationsHeading` / `decorationsHint`. **Two-direction substring grep
before each (L-007).**

#### 5. No-harm

**File**: `tests/economy-invariants.test.ts`, `tests/decorations.test.ts` (new)

**Contract**: owning **any** subset of decorations leaves `profit` **bit-identical** —
sweep the same 256 subsets × `d` grid with and without a decoration set applied; and
no decoration id ever reaches `shopRunningCost` (assert
`shopRunningCost(DECORATION_IDS) === 0`). Plus, mirroring
`tests/upgrades-buy.test.ts`'s *"leaves `purchased` untouched across two buys, and
keeps BOTH meta entries"*: two decoration buys leave `purchased` and `purchasedMeta`
intact; a decoration from another world is rejected; a decoration cannot be bought
twice; `readDecorations` normalizes `undefined`/`null`/`{}`/populated.

### Success Criteria

#### Automated Verification

- `npm test` — Phase 4 baseline + ~18
- `npm run lint` / `npm run check` — clean
- `tests/pacing.test.ts`'s first-purchase assertion still passes with decorations in
  the greedy buy policy
- Every `Upgrade` and every `Decoration` resolves to **either** committed art **or** a
  mapped `ShopIconKey` — assert total coverage of the `ShopGlyph` map
- **Every slug in `WORLD_SLUGS` has a full decoration set** — `decorationsForWorld`
  returns the per-world count for each; no world can ship with an empty sink
- **Deliberate break** (L-004): add a `runningCost: 5` field to one decoration and
  route it through `shopRunningCost`. No-harm must go red. Meta-check: this is the
  precise back-door D-11 warns about — a decoration reaching the cost function — so
  the redness is evidence for the exact claim. Restore.

#### Manual Verification

- With the catalogue exhausted at level 3, `/app/growth` and `/app/start` still name a
  next thing (a decoration), and it is one of the **current** world's
- Switching worlds on `/app/worlds` presents a fresh decoration set and does not
  disturb owned upgrades — `t.worlds`' shipped promise ("Twój sklep i kupione
  ulepszenia przenoszą się do nowego świata") stays literally true

---

## Phase 6: Regression repair, pacing re-run, documentation

### Overview

Repair the one E2E the tranche knowingly breaks, re-run the pacing model against the
final prices, and leave the durable records.

### Changes Required

#### 1. The known regression

**File**: `e2e/growth.spec.ts` — the test *"the next-upgrade card stays a finished
thought when nothing is left to buy (Risk E2E-F4-3)"*

**Intent**: After D-11 decorations are always buyable at price-only gating, so seeding
`purchased: ["sign","shelf"]` no longer produces an empty shop. **Do not delete the
assertion** — `t.growth.noNextUpgrade` must still exist for the case where a world's
decorations are also exhausted. **Re-seed the state instead.**

**Contract**: seed `shopState: { purchased: ["sign","shelf"], decorations: [<all four
of the seeded world's decoration ids>] }`. `seedChildProfile` writes `shop_state`
verbatim, so no helper change is needed. Preserve **both** properties the test was
written to defend: the heading is unconditional so the card must say something, **and
the shop CTA survives the empty state** — `/app/growth` is this screen's only entrance
to the shop, so guarding the whole section would delete the link exactly when the
child has money to spend. Update the test's own comment to explain the new seed.

#### 2. Pacing re-run

**File**: `tests/pacing.test.ts`, `scripts/telemetry-harness/README.md`

**Intent**: The model exists so prices are settled by arithmetic rather than deferred
to kid-testing. Re-run it against the final catalogue and decoration prices and record
what it says.

**Contract**: add an assertion that the wallet is **never idle** — at every simulated
shift after the first purchase there is at least one buyable thing (the sink's whole
job). Record each entry's and decoration's **cost in tasks solved** in the README, with
the harness's caveat: this says how the *economy* responds to a class of player, not
what a real child does.

#### 3. Records

**Files**: `docs/reference/contract-surfaces.md`, module headers

**Contract**: contract-surfaces § `public.child_profiles` documents `decorations?`;
§ `public.shift_log` records that `earned` now carries **profit** and that a
decoration purchase writes **no row**. The `ART DEVIATION` headers land in
`src/data/decorations.ts` and `src/data/upgrades.ts`. `src/i18n/pl.ts` keeps its
append-only shape for W1.

### Success Criteria

#### Automated Verification

- `E2E_PORT=<yours> npx playwright test` — Playwright baseline + 0 (the same count,
  all green); the repaired test asserts `t.growth.noNextUpgrade` **and**
  `t.growth.upgradesLink`
- `npm test` — Phase 5 baseline + ~2
- `npm run lint` / `npm run check` — clean
- Full suite re-run from clean: `npm run lint && npm run check && npm test &&
  E2E_PORT=<yours> npx playwright test`
- **Deliberate break** (L-004): remove one decoration id from the repaired E2E's seed.
  The test must go red on `noNextUpgrade`. Meta-check: this proves the seed genuinely
  reaches the empty state rather than passing for an unrelated reason — the exact
  failure mode that made the original seed stale. Restore.

#### Manual Verification

- A reader who has never seen this feature can follow `slice-map.md` and the two
  `ART DEVIATION` headers to understand why no decoration art is committed and what to
  do when it arrives

---

## Testing Strategy

### Unit tests

- **Invariants (the headline):** no-trap over 256 subsets × 21 `d` points; no-harm
  bit-identical under any decoration subset; no-dominance over reachable states only.
- **Economy arithmetic:** `profitForShift` at margins 1 equals `earningsForShift` minus
  cost; `profit ≥ 0` on the degenerate shift; wallet monotonicity through
  `recordShiftResult`.
- **Gating:** `branch-locked` slots between world level and skill; owned still
  short-circuits every rung (no retro-lock); no purchase makes another entry
  permanently unreachable.
- **Persistence:** `readDecorations` normalization; two buys keep `purchased` and both
  `purchasedMeta` entries; cross-world and double-buy rejection.
- **Rendering totality:** every catalogue entry and decoration resolves to art or a
  mapped icon; every `UPGRADE_ID` has a slot in every `WORLD_SLOTS` table.
- **Pacing:** determinism; reference-shift bounds and monotonicity; first purchase by
  shift 3; the wallet is never idle.

### Integration tests

- `/api/shifts/complete` recomputes profit from the trusted row's `shop_state` — a
  tampered client cannot claim a margin it has not bought.
- `/api/decorations/buy` recomputes affordability from the trusted row; unknown id,
  foreign-world id, double buy and insufficient funds each return the right status.

### Manual testing steps

1. Fresh profile → play a shift → results shows only `zysk` (cost row hidden at 0).
2. Buy `shelf`, play again → breakdown shows all three; wallet delta equals `zysk`.
3. At level 3 with `sign` unowned, both margins sit under "Wkrótce" with the branch
   reason; buy `sign` and they move without anything else locking.
4. Buy every catalogue entry, then confirm `/app/start` and `/app/growth` still name a
   next thing — a decoration of the current world.
5. Switch worlds: a fresh decoration set, owned upgrades untouched.

## Performance Considerations

The no-trap sweep is 256 × 21 × ≤8 ≈ 43k profit evaluations of pure arithmetic — well
inside a normal vitest file. The no-dominance BFS walks `(subset, businessLevel,
skillState)`; bound the walk explicitly (cap `businessLevel` at
`max(requiredWorldLevel)` and the skill counters at the highest threshold in the
catalogue) so it terminates — every gate is monotone, which is what makes that bound
sound. If either sweep exceeds a few seconds, coarsen the `d` grid, never the subset
enumeration.

## Migration Notes

**None.** `shop_state.purchased` stays a flat global id list and gains the optional
sibling `decorations?: string[]` in the same jsonb — the precedent `purchasedMeta?`
set. Every legacy `{}` and `{ purchased: [] }` row stays valid. `shift_log.earned`
keeps its documented contract ("the amount added to the wallet"): it starts recording
profit, and every pre-existing row is a shift whose cost was zero — **no backfill, no
ambiguity**, including for the telemetry harness's rows.

## Open Risks & Assumptions

- **No-dominance may have no solution over the tunable set, and the escape is named
  here so Phase 4 does not improvise one.** `ROI*_capacity` is taken over the
  **cheapest buyable** capacity entry, and AD-7 freezes those costs across a 5× spread
  (`shelf` 60 … `customers` 300). A reachable state where only `customers` remains
  buyable in capacity forces the margin branch's ROI **down** to stay inside
  `DOMINANCE_FLOOR`; a state where `shelf` is still buyable forces it **up**. Both
  constraints bind on the same two margin entries, at every `d`, and only
  `precision`/`margin` `cost`, the two multipliers and the `runningCost` weights are
  free. **If no constant set passes:** first narrow the assertion's *scope* (assert
  over the states where the branch choice is genuinely live — both branches buyable
  **and** at least two entries unowned in each), then lower `DOMINANCE_FLOOR` and
  record the number as a decision with its reasoning. **Never** weaken the invariant
  to a tautology, and never move a shipped `cost` (AD-7). If neither escape yields a
  passing set, that is a `RETHINK` on `DOMINANCE_FLOOR`'s first guess of 0.6 — report
  it, do not delete the sweep.

- **The margin multipliers are not the number a child sees, and Phase 4 must tune the
  one that is.** `round(EARN_PER_CLEAN * 1.5)` is `5`, i.e. an effective multiplier of
  **1.67**, not 1.5; `round(EARN_PER_TASK * 1.4)` is `7`, i.e. exactly 1.4 by luck.
  Rounding the per-unit rate is right (whole złoty, legible to a child) but it means
  the constant and the effect are different numbers, and a tuner who nudges 1.5 → 1.55
  changes nothing at all. Phase 4 should tune, and the module comment should state,
  the **resulting rate** (5 zł → 7 zł per task; 3 zł → 5 zł per clean task) with the
  multiplier as the derived value — or express the field as the target rate outright.

- **No-trap holds in expectation, not per shift.** A child who buys the accuracy
  margin and then has a zero-clean shift earns strictly less than they would have —
  `max(0, …)` clamps at zero, not at the pre-purchase profit. The sweeps state which
  reference shift they evaluate at so no reader is misled. This is also the entry most
  likely to read as *punishment for being a beginner*; that half is a kid-testing
  question, not an arithmetic one.
- **`t.growth.noNextUpgrade`'s copy ("Masz już wszystkie ulepszenia dostępne na tym
  etapie.") is now slightly imprecise** — it fires when decorations are exhausted too,
  and a decoration is not an *ulepszenie*. Kept verbatim on purpose: it is asserted by
  `e2e/growth.spec.ts` and changing it risks an L-007 substring collision for no
  product gain. Revisit with the native-speaker copy review.
- **`WORLD_SLOTS` and `src/i18n/pl.ts` are two-feature contention points** with W1.
  Both changes here are strictly additive; W1 must be told to append, not restructure.
- **The `tests/ → scripts/` import** is assumed to type-check because
  `tsconfig.json`'s `include` is `["**/*"]` with only `dist`, `assets` and `packages`
  excluded. Phase 1's `npm run check` is the proof; if it fails, move the simulator to
  `tests/helpers/pacing.ts` and keep only the report entry point under `scripts/`.
- **`assets/` is absent from the implementation worktree** (gitignored). No mockup
  exists for a decoration or for a three-number results breakdown, so both layouts are
  **explicit extrapolations** from `ShopArt`'s slot/corner-row language and
  `ShiftResults`' existing two-cell reward row — not mockup-derived.

## References

- Research: `context/changes/world-economy-profit-rule/research.md`
- Design spec: `docs/superpowers/specs/2026-08-27-world-economy-design.md`
- Shaping notes (D-1…D-13): `context/foundation/shape-notes-world-economy.md`
- Run contract: `context/runs/2026-08-27-world-economy/agent-contract.md`
- Art-deviation precedent: `src/data/stages.ts` module header
- Sweep convention: `tests/adaptive.test.ts` (`D_SWEEP`)
- Buy-path precedent: `src/lib/services/child-profiles.ts` → `buyUpgrade`

---

## Autonomous decisions

Made in place of asking a human (run rule 1). Each carries what was rejected, why, and
**what would change the answer**.

**AD-1 — `shopRunningCost` is a per-entry weight on `Upgrade`, and `sign` weighs 0.**
*Rejected:* giving `sign` a small margin (contradicts §2's "no earnings effect" and
re-makes it a universal effect, which the spec rejects by name); and quantifying
no-trap over earning entries only (weakens the headline deliverable to dodge one
entry). *Why:* the spec's own gloss is *"keyed on what you own that earns"*, a weight
field generalises to any future zero-effect entry, and it keeps the invariant
quantified over the **whole** catalogue — the strongest form of the test. It also
preserves two shipped E2E assertions that pin exact payouts on profiles owning nothing
and only `sign`. *What would change the answer:* if a future entry needs a cost that is
not additive (a curve in owned-count), the field becomes a weight **input** to a curve
rather than the cost itself; `sign` still weighs 0.

**AD-2 — the reference shift is `referenceShift(d, bonus)`: the midpoint of
`shiftLengthRangeFor(d)` plus capacity bonus, at `TARGET_SUCCESS = 0.8` accuracy.**
*Rejected:* a single hard-coded `(taskCount, cleanCount)` pair (the spec requires the
invariant to hold for all `d ∈ [0,1]`, not at one convenient point), and a
simulation-averaged shift (non-deterministic input to a property test). *Why:* both
inputs already exist and are load-bearing elsewhere — `TARGET_SUCCESS` is the rate the
adaptive engine steers toward, i.e. the definition of steady state — so nothing is
invented. *What would change the answer:* if `TARGET_SUCCESS` ever stops being the
engine's convergence target, the accuracy assumption must be re-derived from the
pacing model's observed first-try rate instead.

**AD-3 — the two margin entries take `art?: string` **unset** plus the lucide
fallback; the two candidate SVGs in `assets/atomic-assets-v3/` are NOT copied.**
*Rejected:* research §8's recommendation (a) — copy `world-progress.svg` /
`requirement-check.svg` from the absolute `/Users/kamilp/Dev/10xDevs/assets/...` path
into the worktree's `public/illustrations/`. *Why:* that step resolves on one machine
and nowhere else, and the run's implementation lane is a worktree where `assets/` does
not exist; the fallback branch must be built for decorations regardless, so the
"consistency" argument for (a) buys one screen's polish at the cost of a
machine-dependent build step. The `src/data/stages.ts` precedent makes an art-less
entry a documented deviation, not a workaround. *What would change the answer:* the
maintainer committing the two SVGs to `public/illustrations/` with `slice-map.md` rows
— then set `art` on the two entries and the fallback simply goes unused for them.

**AD-4 — FR-008 gets the *spirit* reading; no FR is edited and D-2's `prd-v4` trigger
stays unfired.** *Rejected:* the letter reading (FR-008's exception names an *upgrade*
purchase, and spec §6 argues a decoration is **not** an upgrade in v3's terms — so a
decoration debit would need an FR edit). *Why:* `prd-v3.md:62` already names *"new
shelf/sign/**decoration**"* as a legitimate visible change, so v3's own vocabulary
contemplates buying one; FR-008's exception is about deliberate spending that acquires
something permanent. *What would change the answer:* if a reviewer or the maintainer
holds the letter reading, the fix is a one-line FR-008 amendment in a `prd-v4`, **not**
dropping the decoration sink — the sink is what keeps FR-013 meaningful past the
catalogue's end. **Restated for impl-review:** *reject a wallet debit on the **shift**
path; the decoration buy is the second sanctioned spend path beside `buyUpgrade`.*

**AD-5 — four decorations per world in the first batch, priced 40 / 80 / 140 / 220.**
(The run contract's open decision #4.) *Rejected:* two per world (too shallow — the
recurring level-boundary empty state that `e2e/growth.spec.ts` documents needs
something buyable in each ~3-shift band, and early bands yield ~130 zł), and eight per
world (48 eventual art assets against a debt that already starts at zero, and an E2E
seed nobody can read). *Why:* four covers each level band with a rising intra-world
curve, totals 480 zł per world against a ~1130 zł catalogue, and keeps the eventual art
debt at 6 × 4 = 24. *What would change the answer:* Phase 6's pacing re-run showing the
wallet idle (nothing buyable) at any simulated shift, or accumulating unspent past the
catalogue's end — either raises the count or steepens the curve. The reverse signal —
decorations exhausted well before a world switch — lowers it.

**AD-6 — a decoration purchase writes NO `shift_log` row and grants NO `+1 decisions`.**
*Rejected:* logging with `earned: null` (flips `computeWeeklyReport`'s `earningsKnown`
false **permanently**, silently suppressing the parent report's earnings tile), and
logging as `upgrade_purchased` (the weekly report would then list a decoration among
"upgrades bought this week"). *Why:* decorations are outside the catalogue by
construction, and `decisions` is surfaced to the parent while gating nothing — so
crediting it makes decoration-spam a way to inflate a competency a parent reads.
*What would change the answer:* a parent-report requirement to show decoration
spending; then add a `decoration_purchased` column rather than overloading
`upgrade_purchased`, and revisit `earningsKnown`'s predicate in the same change.

**AD-7 — the six shipped entries' `cost` values do not move in this tranche.**
*Rejected:* re-pricing `sign` upward so the first purchase lands on shift ~3 rather
than shift 1 (D-13's own observation that the shipped catalogue misses `prd-v3.md:62`).
*Why:* `prd-v3.md:62` states a bound — *"at least one upgrade within their first ~3
shifts"* — which shift 1 satisfies; and `src/data/adaptive.ts`'s `LEVEL_SEED` comment
records that *"one task of drift in shift length flips which upgrade is affordable"*,
with `e2e/gameplay-restore.spec.ts` asserting exact payouts and exact affordability
gaps. Re-pricing the published curve inside an unattended run trades a real regression
risk for a pacing nuance the PRD does not actually demand. The pacing model **reports**
the shift-1 first purchase as a finding rather than silently accepting it. *What would
change the answer:* the maintainer deciding that "a purchase with no saving decision
before it" violates the intent of `prd-v3.md:62` — then raise `sign` to ~60–70 and
re-run every affordability assertion in `e2e/gameplay-restore.spec.ts`.

**AD-8 — E1 ships no per-world catalogue vocabulary and no
`t.worlds[slug].upgrades[id] ?? t.upgrades[id]` resolver; W1 ships on the mandatory
fallback and grows into it.** (The run contract's open decision #3.) *Rejected:*
writing 6 × 8 vocabulary entries now, and landing the resolver in E1 so W1 only adds
content. *Why:* the fallback exists **precisely** so this is a choice — spec §5 calls
it mandatory, not a convenience, so that a catalogue change never blocks on six
translations. The run contract's own rationale for E1-before-W1 is that E1 names the
eight entries **once**; per-world vocabulary is W1's surface, and splitting the
resolver from its only content would leave a dead code path across a merge boundary.
48 draft-Polish strings authored unattended and never read by a native speaker is
lower-value copy than the neutral names already reviewed. *What would change the
answer:* W1's planner finding that a world reads as unnamed without its own vocabulary
for at least the two margin entries — then W1 lands the resolver plus those two per
world (12 strings), still not 48.

**AD-9 — plan scope confirmed as HIGH complexity without asking, and the skill's
question rounds were collapsed into these decisions.** *Rejected:* the skill's
`AskUserQuestion` scope/probing/design rounds. *Why:* run rule 1; and the upstream
artifacts (spec + `research.md` + `change.md`'s ledger + backlog E1) already settle
every `[D]` category — what remained were `[S]` solution questions, which are AD-1…AD-8.
*What would change the answer:* a maintainer reading this plan and disagreeing with any
AD above; each carries its own reversal condition, so no re-plan is needed to overturn one.

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step
> lands. Do not rename step titles. Baselines are measured **on this branch**, never
> inherited (L-005).

### Phase 1: Pacing model + the reference shift

#### Automated

- [x] 1.1 `npm test` — baseline 548 (branch `feat/world-economy-profit-rule` @ `91754ef`) → **560, +12** — 502c798
- [x] 1.2 `npm run check` — 0 errors, 204 files; the `tests/ → scripts/` import type-checks (it caught a missing `CompetencyProgress.misses` that eslint did not) — 502c798
- [x] 1.3 `npm run lint` — clean — 502c798
- [x] 1.4 `tests/pacing.test.ts` is deterministic across two consecutive runs; the assertion itself compares two in-process runs, and the deliberate break (dropping `planShift`'s explicit seed so it falls back to `randomSeed()`) turns exactly that case red — 502c798

#### Manual

- [x] 1.5 `report()` read for all three cohorts at 30 shifts: catalogue empties at shift **13 / 14 / 17**, inside the ~7–25 band; after that the wallet climbs past 1600 zl at `buyable 0` for 17 straight shifts — the idle wallet D-11 exists to abolish, now visible as a number — 502c798

### Phase 2: The profit rule, end to end

#### Automated

- [x] 2.1 `npm test` — Phase 1 baseline 560 → **571, +11** (58 files) — fcf3b66
- [x] 2.2 `npm run lint` clean / `npm run check` 0 errors, 204 files — fcf3b66
- [x] 2.3 `E2E_PORT=4330 npx playwright test` — 26/26, gameplay-restore's exact-payout assertions unchanged (`sign.runningCost = 0` holds them) — fcf3b66
- [x] 2.4 Deliberate break run TWICE, and the pair is the evidence. (a) `wallet + revenue`: the two profit-specific route cases go red, FR-008 monotonicity stays GREEN — proving monotonicity alone certifies nothing about the profit rule, which is the L-004 second-order finding. (b) `wallet + revenue - cost` (an actual debit): only the FR-008 case goes red. Each break bites exactly one clause and leaves the other green, so neither is decorative. Both plausible: (a) is the "earned is just revenue" simplification, (b) is the literal `wallet -= cost` FR-008 forbids. Restored — fcf3b66

#### Manual

- [x] 2.5 Verified as an automated equality rather than by hand (no browser session in an unattended run): `tests/shifts-complete.test.ts` § *"returns revenue, cost and profit, all recomputed from the row's own shop_state"* asserts the response's `profit` equals the persisted `wallet_balance` delta on a profile owning `shelf` + `register`, and `tests/shift-screen.test.tsx` § *"shows the breakdown the server sent"* asserts the rendered `zysk` is that same server number. The two together are the claim; the hand-play remains on the human checklist — fcf3b66

### Phase 3: The catalogue to eight — two margins, one branch gate

#### Automated

- [x] 3.1 `npm test` — Phase 2 baseline 571 → **587, +16** (59 files) — 57933e5
- [x] 3.2 `npm run lint` clean / `npm run check` 0 errors, 205 files — 57933e5
- [x] 3.3 `tests/upgrades.test.ts` — 35 cases, 8 entries inside the 5–8 bound; no-retro-lock extended (*"owned short-circuits the branch rung too"*) plus a no-foreclosure sweep over every entry — 57933e5
- [x] 3.4 `tests/stages.test.ts` green; also pinned forward by a new `tests/upgrades.test.ts` case (*"no entry gates on the terminal stage's level"*) so the failure lands in the file that caused it — 57933e5
- [x] 3.5 Two-direction substring grep over every quoted value in `src/i18n/pl.ts` — CLEAN for "Dokładna obsługa", "Lepsza marża", "Najpierw kup: {name}" and both descs — 57933e5
- [x] 3.6 `E2E_PORT=4330 npx playwright test` — 26/26, baseline unchanged — 57933e5

#### Manual

- [x] 3.7 Verified as assertions rather than by hand: `tests/upgrades.test.ts` covers branch-locked without `sign`, the rung opening the moment `sign` is owned, world-lock-before-branch, branch-before-skill, and a sweep proving **every** entry is reachable from a full-owner state (nothing foreclosed). The `/app/upgrades` visual pass stays on the human checklist. Deliberate break: moving the branch rung ABOVE the owned short-circuit turns the retro-lock case red — 57933e5
- [x] 3.8 Weight matched in code and asserted, not eyeballed: `ShopGlyph` is passed the SAME size class the `<img>` carried at each of the five sites (`size-20` affordable/locked, `size-16` owned, `size-12` results, `size-10`/`size-7`/`size-6` in growth/ShopArt), and `tests/shop-glyph.test.tsx` asserts the call site's classes survive `cn()` and that every mapped key renders an svg. Legibility itself is a human judgement — on the checklist — 57933e5

### Phase 4: The invariant sweeps

#### Automated

- [x] 4.1 `npm test` — Phase 3 baseline 587 → **593, +6** (60 files) — fc43555
- [x] 4.2 No-trap asserts `visits === 8 × 128 × 21 = 21504` (256 subsets × 21 `d` × the unowned entries of each; each entry is unowned in exactly half the subsets) — fc43555
- [x] 4.3 BFS over `(subset, businessLevel)` admits **172 states** over a strictly-smaller-than-256 subset set, and is asserted to exclude every set holding a margin without `sign` — fc43555
- [x] 4.4 `npm run lint` clean / `npm run check` 0 errors — fc43555
- [x] 4.5 Break: `customers.runningCost` 2 → 40. No-trap red: *TRAP: buying "customers" at d=0 owning [] drops profit 45 → 13*. **Meta-check:** this is precisely what a future cost tweak would do, and it leaves the app fully functional — nothing crashes, nothing else fails, a child simply gets poorer for buying something. Unlike deleting an entry (which any suite would catch) only this sweep sees it, so the redness is evidence the sweep bites on real mistuning. Restored — fc43555
- [x] 4.6 **One constant moved: `margin.cost` 180 → 220.** `runningCost` weights unchanged (`sign` 0, all five capacity 2, both margins 3); multipliers unchanged (`precision` accuracy 1.5 → 3 zł/5 zł per clean task; `margin` quantity 1.4 → 5 zł/7 zł per task); `precision.cost` unchanged at 140; no shipped `cost` touched (AD-7 held). Reason: at 180 `margin` was dearer than `precision` **and** better value per zloty, because a quantity margin pays on every task while an accuracy margin pays only on clean ones — 1.25× the gross at `TARGET_SUCCESS`. 210 is the first passing value; 220 takes headroom and avoids tying `storage`'s 210, where a tie makes `nextUpgrade`'s cheapest-first rule pick arbitrarily across branches — fc43555

#### Manual

- [x] 4.7 `DOMINANCE_FLOOR` temporarily 0.35 → 0.95. Message: *DOMINANCE at the opening choice: d=0 owning [sign] (level 3) capacity ROI 0.1000 vs margin ROI 0.0500 — ratio 0.500*. `[sign]` at level 3 is an ordinary state — the child bought the sign and has played nine shifts. Restored — fc43555

### Phase 5: Decorations — the renewing sink

#### Automated

- [x] 5.1 `npm test` — Phase 4 baseline 593 → **626, +33** (62 files) — c30c3cd
- [x] 5.2 `npm run lint` clean / `npm run check` 0 errors, 209 files — c30c3cd
- [x] 5.3 Still shift 1 for all three cohorts with decorations in the greedy policy — upgrades are taken FIRST, mirroring `nextPurchase`, so a decoration can never consume money the child could have put toward a real decision — c30c3cd
- [x] 5.4 `tests/shop-glyph.test.tsx` quantifies over `UPGRADES`; `tests/decorations.test.ts` over `DECORATIONS`. Neither quantifies over a hardcoded key list, so W1 appending to `SHOP_ICONS` cannot turn them red — 57933e5, c30c3cd
- [x] 5.5 `tests/decorations.test.ts` § *"gives every world in WORLD_SLUGS a full decoration set"*: 4 per world × 4 worlds = 16. Meta-checked by deleting `piekarnia`'s set — 4 cases red. **This is the W1 seam**: W1's Phase 1 widens `WORLD_SLUGS` to six and turns this red; only W1's Phase 4 closes it — c30c3cd
- [x] 5.6 Break run twice. (a) route `kawiarnia-lampki` through `shopRunningCost` via a lookup table: **both** no-harm clauses red — *HARM: decorations [kawiarnia-lampki] moved profit at d=0 owning []*. (b) the plan's literal form, `runningCost: 5` on the entry itself: 6 cases red including the structural *"carries no economic field at all"*. **Meta-check:** the two clauses are not redundant — (a) shows the structural `shopRunningCost(DECORATION_IDS) === 0` check misses nothing the behavioural sweep catches, and the sweep would still fire if an effect arrived through a path nobody anticipated. Both breaks are the exact back door D-11 warns about by name. Restored — c30c3cd

#### Manual

- [x] 5.7 Verified as assertions, not by hand: `tests/decorations.test.ts` § *"names the cheapest unowned decoration once the catalogue is exhausted"*, *"only ever names the CURRENT world's decorations"* (over every slug) and *"walks the whole world's set before going quiet"*. Both pages read the same `nextPurchase`. The browser pass stays on the human checklist — c30c3cd
- [x] 5.8 `tests/decorations.test.ts` § *"switching worlds renews the sink with owned upgrades untouched"*, plus `tests/decorations-buy.test.ts` § *"carries `purchased` and `purchasedMeta` through a decoration buy"* and *"an upgrade buy after a decoration buy keeps the decorations"* — the inner-spread trap, pinned durably — c30c3cd

### Phase 6: Regression repair, pacing re-run, documentation

#### Automated

- [x] 6.1 `E2E_PORT=4330 npx playwright test` — **26/26, baseline + 0**. The repaired Risk E2E-F4-3 asserts both `t.growth.noNextUpgrade` and `t.growth.upgradesLink`, unchanged; only the seed moved — c30c3cd
- [x] 6.2 `npm test` — Phase 5 baseline 626 → **629, +3** (62 files) — 89dcf7f
- [x] 6.3 `npm run lint` clean / `npm run check` 0 errors — 89dcf7f
- [x] 6.4 Full re-run on the final tree: lint 0 · check 0 errors/0 warnings/8 hints, 209 files · **629 passed / 62 files** · **26 Playwright passed** — 89dcf7f
- [x] 6.5 Break: `.slice(1)` on the seeded decoration list. Both projects red on exactly `getByText('Masz już wszystkie ulepszenia dostępne na tym etapie.')`. **Meta-check:** this proves the seed genuinely reaches the empty state rather than passing for an unrelated reason — the precise failure mode that made the ORIGINAL seed stale, which is why the new seed anchors on `decorationsForWorld(SEED_WORLD)` and not on a literal id list (L-006). Restored — c30c3cd

#### Manual

- [x] 6.6 **Three** ART DEVIATION headers, not two: `src/data/upgrades.ts`, `src/data/decorations.ts` and `src/components/child/ShopGlyph.tsx` (the component that owns the icon map). Each names what is missing, why lucide, and the exact upgrade path. **`public/illustrations/slice-map.md` is deliberately UNTOUCHED** — it is the register of assets pulled out of `assets/`, and this tranche pulled none; a row there with no file would be a lie. The headers carry the story instead — 89dcf7f
