# Upgrade Choice & Visible+Functional Shop Growth Implementation Plan

## Overview

Deliver the roadmap **north star (S-06)**: the earn→choose→grow loop. A child spends wallet funds on a **chosen** upgrade from a small catalog (cost + world-level gated) via a dedicated **/app/upgrades** screen; the purchase is server-authoritative; the shop grows **visibly** (owned-upgrade art) and **functionally** (owned upgrades lengthen the shift, so a bigger shop earns more); the choice persists. PRD-v3 US-01, FR-010–FR-014. Skill-progress gating is deferred to S-07.

## Current State Analysis

The wallet economy's *earning* half shipped (S-05): `wallet_balance` accumulates server-side and is framed as the child's "Portfel". What's missing is *spending* — there is no catalog, no purchase path, and no growth. The reserved `shop_state jsonb` column exists but is written by nothing. The single world renders one static PNG with no upgrade art.

### Key Discoveries:

- **`shop_state jsonb not null default '{}'`** on `child_profiles` (`supabase/migrations/20260630120000_...:23`), typed `Record<string, unknown>` (`child-profiles.ts:37`), read/written by nothing — the persistence slot for purchased upgrades. Column-agnostic F-01 RLS already covers it (no new policy — L-001).
- **Server-authoritative pattern to mirror:** `recordShiftResult` (`child-profiles.ts:89-113`) reads the row by `id` under RLS, computes server-side, writes one UPDATE, never takes `account_id` from the client (L-002). `POST /api/shifts/complete` (`complete.ts`) is the endpoint shape: `prerender=false`, zod, JSON.
- **"Agree by construction" purity:** `src/data/shift.ts` pure fns are imported by both client (display) and server (authoritative write). The upgrade requirement/effect fns adopt the same shape so the screen and the buy endpoint never disagree.
- **`earningsForShift(taskCount, cleanCount)`** already scales with task count — a longer shift earns more with no new multiplier. But **`complete.ts` caps `taskCount`/`cleanCount` at 12** (`complete.ts:14-20`); a capacity effect that lengthens shifts must raise that cap.
- **`generateShift(startingLevel)`** (`shift.ts:42`) builds the task list client-side in `ShiftScreen` (`ShiftScreen.tsx:35`); the capacity effect adds bonus tasks here.
- **Art:** committed `public/illustrations/` has only 4 world PNGs + coins (no upgrade art). The needed v3 assets exist locally at `assets/atomic-assets-v3-progression/{png/illustrations,svg/icons}/` (e.g. `upgrade-shelf.png`, `product-unlock.svg`, `shelf-upgrade.svg`, `cash-register-upgrade.svg`, `plus-product-slot.svg`) — **gitignored**, so they must be copied into `public/` to reach CI/Vercel. The illustration-pipeline precedent (`slice-map.md` + committed PNGs) is the convention.
- **`/app` is the only PROTECTED_ROUTE** (`middleware.ts:5`); a new `/app/upgrades` is auth-gated automatically.
- **L-003:** every user-visible string comes from `src/i18n` (`t.*`) — no inline literals.

## Desired End State

A child with enough funds opens **/app/upgrades** (from a start-screen link or a results-screen nudge), sees the catalog split into affordable / locked / owned, and **buys** one in a framed decision ("masz X zł: A za … czy B za …?"). Their wallet drops by the cost, the upgrade is recorded, and the shop art on the start + upgrades screens visibly reflects it; subsequent shifts are a little longer (more practice + earning). Spending never lowers level or (future) skill progress. Verify: buy an affordable upgrade → wallet debited + shop grows + it persists across reload; an unaffordable/locked/owned upgrade cannot be bought; account B cannot buy on account A.

## What We're NOT Doing

- **No skill-progress or completed-mission-type gates** — S-07. S-06 gates on cost + `requiredWorldLevel` only.
- **No new task types** (set-price, manage-stock) or **products** — deferred pricing/inventory tranche. The only functional effect is shift-length capacity.
- **No multi-world / per-world catalogs / world-selection** — pillar-2 tranche. One shared catalog for the current single world per profile.
- **No parent weekly report** — S-09.
- **No earnings multiplier** — capacity (longer shift) is the sole effect.
- **No un-buy / refund / respec.** Purchases are permanent (doc 08: spending never regresses competence, and there's nothing to regret).

## Implementation Approach

Bottom-up, money-integrity first: (1) the catalog data + committed art + `shop_state` shape + pure requirement/effect fns (the shared source of truth), (2) the server-authoritative buy transaction + its integration test, (3) the dedicated upgrades screen that consumes them, (4) the visible growth + wiring the capacity effect into the shift. Every currency-moving path is server-authoritative and tested; the client only ever names *which* upgrade to buy.

## Critical Implementation Details

- **Shift-length cap interaction.** The capacity effect adds bonus tasks to a shift. `complete.ts` currently rejects `taskCount > 12`. Phase 4 must raise that ceiling to `SHIFT_LENGTH[2].max + MAX_BONUS_TASKS` (a named constant) so a maxed-out shop's shift isn't rejected with a 400. `cleanCount`'s cap moves with it.
- **`shop_state` normalization.** Existing rows default to `'{}'` (no `purchased` key). All consumers must treat a missing `purchased` as `[]` (a pure `readPurchased(shop_state)` normalizer), so the code is robust whether a row predates or postdates the default change.
- **Purchase validation is server-only and total.** The buy service recomputes affordability, level, and ownership from the trusted row; the client's posted `upgradeId` is validated against the catalog. A tampered client cannot buy an upgrade it can't afford, hasn't unlocked, or already owns.

## Phase 1: Catalog, committed art, shop_state shape, pure fns

### Overview

Establish the shared source of truth: the upgrade catalog, the committed art it references, the `shop_state` shape, and the pure requirement/effect functions both the screen and the buy endpoint will use — all unit-tested.

### Changes Required:

#### 1. Upgrade catalog + pure fns

**File**: `src/data/upgrades.ts` (new)

**Intent**: Define the single shared catalog (5–8 upgrades) and the pure, client-safe functions that derive availability, purchasability, the next target, and the capacity effect — mirroring `shift.ts`'s dual-import purity so client display and server writes agree by construction. Values are named tunable constants (first-guess; adjust after kid-testing).

**Contract**: An `Upgrade` type `{ id: string; nameKey: string; cost: number; requiredWorldLevel: number; extraTasks: number; art: string /* /illustrations/... */; order: number }` and a `readonly UPGRADES` list ordered by an increasing cost + `requiredWorldLevel` ladder (a couple are pure-visual `extraTasks: 0`). Pure fns: `readPurchased(shopState): string[]` (normalizes missing → `[]`), `isOwned(id, purchased)`, `canBuy(upgrade, { walletBalance, businessLevel, purchased }): { ok: true } | { ok: false; reason: "owned" | "locked" | "insufficient" | "unknown" }`, `nextUpgrade({ businessLevel, purchased }): Upgrade | null` (cheapest level-eligible unowned), and `shiftBonusTasks(purchased): number` (sum of owned `extraTasks`, clamped to `MAX_BONUS_TASKS`). No i18n/React/Supabase imports.

#### 2. Commit the v3 upgrade art

**File**: `public/illustrations/` (+ `public/illustrations/slice-map.md`)

**Intent**: Copy the specific upgrade art the catalog references from the local (gitignored) `assets/atomic-assets-v3-progression/` into the committed `public/illustrations/` so it ships to CI/Vercel, and record each in `slice-map.md` (source + stable stem) per the existing pipeline convention.

**Contract**: One committed asset per catalog `art` reference (PNG for rich art, SVG for icon-like upgrades), named with a stable `upgrade-<slug>` stem; `slice-map.md` gains a row per new file (source path under `assets/…`, purpose). No bundler change (served raw from `public/`).

#### 3. shop_state shape

**File**: `src/types.ts`, `src/lib/services/child-profiles.ts`, `supabase/migrations/20260701130000_child_profiles_shop_state_default.sql` (new)

**Intent**: Give `shop_state` a concrete `ShopState = { purchased: string[] }` type, retype `ChildProfile.shop_state`, and set the column default to `'{"purchased": []}'` for new rows (existing pre-launch rows stay `'{}'` and are handled by `readPurchased`).

**Contract**: `ShopState` in `types.ts`; `ChildProfile.shop_state: ShopState`; migration does `alter column shop_state set default '{"purchased": []}'::jsonb` + refreshed comment. No RLS/trigger change (column-agnostic policies — L-001). Non-destructive.

#### 4. i18n upgrade names

**File**: `src/i18n/pl.ts`

**Intent**: Add Polish names (and short descriptions if shown) for each catalog upgrade, keyed by `nameKey`, so the catalog carries no literal copy (L-003).

**Contract**: An `upgrades` block in the dictionary with one entry per catalog id (`name`, optional `desc`), resolved as `t.upgrades[id].name`.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npx vitest run tests/upgrades.test.ts`
- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Production build succeeds: `npm run build`
- Committed art resolves: every catalog `art` path exists under `public/illustrations/`

#### Manual Verification:

- The committed upgrade art renders (open a file / preview) and looks acceptable as v1 art
- The catalog ladder reads sensibly (costs/levels increase; a first upgrade is affordable within a few shifts)

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: Server-authoritative buy endpoint

### Overview

Add the purchase transaction — the only currency-moving path — server-side, and lock it with an integration test mirroring `shifts-complete.test.ts`.

### Changes Required:

#### 1. Buy service function

**File**: `src/lib/services/child-profiles.ts`

**Intent**: Add `buyUpgrade(client, profileId, upgradeId)` that reads the row by `id` under RLS, validates the purchase server-side via `canBuy`, and on success debits `wallet_balance` and appends the id to `shop_state.purchased` in a single UPDATE — never taking `account_id` from the caller (L-002). Mirrors `recordShiftResult`.

**Contract**: Returns `{ walletBalance: number; purchased: string[] } | { error: ... }` where the error distinguishes the `canBuy` reason (owned / locked / insufficient / unknown-upgrade / not-found). The UPDATE sets `wallet_balance: current.wallet_balance - upgrade.cost` and `shop_state: { purchased: [...readPurchased(current.shop_state), upgradeId] }`, reached by `.eq("id", profileId)`. The wallet non-negative DB constraint backstops overspend.

#### 2. Buy route

**File**: `src/pages/api/upgrades/buy.ts` (new)

**Intent**: A `POST` endpoint that authenticates, validates input with zod (`profileId` uuid, `upgradeId` constrained to catalog ids), calls `buyUpgrade`, and returns JSON. `prerender = false`. Takes nothing trust-bearing from the client (no cost, no account_id).

**Contract**: Request `{ profileId, upgradeId }`; success `200 { ok: true, walletBalance, purchased }`; invalid buy (insufficient/locked/owned/unknown) `400 { ok: false, reason }`; unauth `401`; server error `500`. Anti-CDN-cache headers like `complete.ts`.

#### 3. Integration test

**File**: `tests/upgrades-buy.test.ts` (new)

**Intent**: Prove the money paths against the local Supabase stack, modeled on `shifts-complete.test.ts` (seed via admin, mint session, verify durable state via service-role client).

**Contract**: Cases — (a) affordable, level-met, unowned buy → `200`, wallet debited by exactly the cost, id in `shop_state.purchased`; (b) insufficient funds → `400`, wallet + state unchanged; (c) locked (world level too low) → `400`, unchanged; (d) already-owned → `400`, unchanged (no double-debit); (e) L-002 spoof: account B buying on account A's profile → non-200, A's row unchanged (durable state checked via admin).

### Success Criteria:

#### Automated Verification:

- Migration + buy test pass against a fresh DB: `npx supabase db reset` then `npx vitest run tests/upgrades-buy.test.ts`
- Unit tests still pass: `npx vitest run tests/upgrades.test.ts`
- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- A buy request debits the wallet by exactly the cost and records the upgrade (checked in Studio or via the test output)
- No path lets the wallet go negative or an upgrade be bought twice

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Dedicated /app/upgrades screen

### Overview

The user-facing choose-and-buy surface: an auth-gated screen listing the catalog with owned/affordable/locked states, a framed decision, the buy action, and next-upgrade progress — reachable from the start screen.

### Changes Required:

#### 1. Upgrades page (SSR shell)

**File**: `src/pages/app/upgrades.astro` (new)

**Intent**: Load the parent's most-recent profile (like `start.astro`), resolve its world + `wallet_balance` + `readPurchased(shop_state)` + `business_level`, and render the upgrades island. Gated under `/app` by existing middleware.

**Contract**: Passes `walletBalance`, `businessLevel`, `purchased`, and the resolved `world` into the island; defensive no-profile fallback mirrors `start.astro`.

#### 2. Upgrades island

**File**: `src/components/child/UpgradeShop.tsx` (new)

**Intent**: Render the catalog split into **affordable** (buyable now), **locked** (shows the single missing requirement — funds or level, in plain Polish), and **owned**; present the choice as an in-world decision, POST to `/api/upgrades/buy` on select, and on success reflect the debited wallet + grown shop without a full reload. Show the **next-upgrade progress** ("brakuje X zł do …"). Warm, non-manipulative copy (no timers/scarcity — guardrail).

**Contract**: Uses the pure `canBuy`/`nextUpgrade`/`readPurchased` fns for display; buy handler posts `{ profileId, upgradeId }`, applies the returned `{ walletBalance, purchased }` to local state; every string via `t.*`. Oversized, non-adjacent tap targets (NFR). Uses committed upgrade art.

#### 3. Entry point + results nudge

**File**: `src/pages/app/start.astro`, `src/components/child/ShiftResults.tsx`

**Intent**: Add a start-screen link/button to `/app/upgrades` ("Rozbuduj sklep") and, on the results screen, a gentle nudge/link to the upgrades screen when the child can now afford something (factual, not FOMO).

**Contract**: Start-screen CTA to `/app/upgrades`; results shows the nudge only when `nextUpgrade`/affordability warrants; both strings via `t.*`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- Unit + buy tests still pass: `npx vitest run tests/upgrades.test.ts tests/upgrades-buy.test.ts`

#### Manual Verification:

- /app/upgrades shows affordable / locked / owned correctly for a seeded profile
- Buying an upgrade debits the wallet in the UI and moves it to "owned" without a full reload
- Locked upgrades show the concrete missing requirement; no scarcity/urgency copy
- The start-screen link and the results nudge navigate to the upgrades screen
- Unauthenticated access to /app/upgrades redirects to sign-in (middleware)

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Visible growth + capacity-effect wiring

### Overview

Make growth real on both axes: render owned-upgrade art on the shop (start + upgrades screens) and feed the capacity effect into the shift so a bigger shop runs longer, busier shifts.

### Changes Required:

#### 1. Visible growth rendering

**File**: `src/pages/app/start.astro` (and the shop visual shared with `UpgradeShop.tsx` if factored out)

**Intent**: Render the shop as the base world art plus the art of each purchased upgrade (layered/badged), so the shop visibly reflects what the child bought — on the start screen and the upgrades screen. Keep the existing framed-card treatment.

**Contract**: Derives the art set from `readPurchased(shop_state)` → catalog `art` paths; renders base `world.image` + owned-upgrade art. Above-the-fold, so no lazy-load on the base image (mirrors current). If a shared `ShopArt` component is extracted, both `start.astro` and `UpgradeShop.tsx` use it.

#### 2. Capacity effect into the shift

**File**: `src/components/child/ShiftScreen.tsx`, `src/pages/app/task.astro` (whichever passes `purchased` in), `src/data/shift.ts`

**Intent**: Add the owned-upgrade bonus tasks to the generated shift so a more-upgraded shop plays a longer shift (more practice + more earning via the existing `earningsForShift`). Thread `purchased` from the profile into `ShiftScreen`.

**Contract**: `shiftLength`/`generateShift` accept a bonus (from `shiftBonusTasks(purchased)`) added to the base length, clamped to `SHIFT_LENGTH[2].max + MAX_BONUS_TASKS`. `ShiftScreen` receives `purchased` (from the page that mounts it) and applies the bonus. No change to the earnings formula.

#### 3. Raise the shift-completion cap

**File**: `src/pages/api/shifts/complete.ts`

**Intent**: Raise the `taskCount`/`cleanCount` zod ceiling so the longest possible upgraded shift is accepted (currently capped at 12 → would 400 a long shift).

**Contract**: Cap becomes a named `MAX_SHIFT_TASKS = SHIFT_LENGTH[2].max + MAX_BONUS_TASKS`; `taskCount ≤ MAX_SHIFT_TASKS`, `cleanCount ≤ taskCount` unchanged.

#### 4. Next-upgrade progress on start

**File**: `src/pages/app/start.astro`

**Intent**: Show the next upgrade + how much more is needed ("brakuje X zł do …") on the start screen, using `nextUpgrade` — factual encouragement (FR-013), no urgency.

**Contract**: Renders `nextUpgrade({ businessLevel, purchased })` + the gap to its cost; string via `t.*`; hidden when nothing is next (all owned / none eligible).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- All tests pass (incl. a shift test asserting bonus tasks extend length; and `complete.ts` accepts a max-length shift): `npx vitest run`
- Grep: no inline user-visible literals introduced in the new/edited components (spot-check L-003)

#### Manual Verification:

- Buying an upgrade visibly changes the shop art on the start + upgrades screens
- With upgrades owned, a shift has more tasks (up to the cap) and pays more; a max shop's shift still completes (no 400)
- The start screen shows the correct "next upgrade / brakuje X zł" and hides it when nothing's next
- Spending never lowers level; the full loop (earn → open upgrades → choose → shop grows → longer next shift) works end-to-end
- Copy across all new surfaces is encouraging, Polish, no scarcity/urgency (guardrail)

**Implementation Note**: Final phase — after automated + manual verification, S-06 (the north star) is complete.

---

## Testing Strategy

### Unit Tests (`tests/upgrades.test.ts`):

- `canBuy` — each reason branch (owned / locked / insufficient / ok) at boundaries.
- `nextUpgrade` — picks the cheapest level-eligible unowned; null when none.
- `shiftBonusTasks` — sums owned `extraTasks`, clamps to `MAX_BONUS_TASKS`.
- `readPurchased` — normalizes `'{}'`, missing key, and populated state.
- A shift test: `generateShift`/`shiftLength` with a bonus yields base+bonus length, clamped.

### Integration Tests (`tests/upgrades-buy.test.ts`, needs local Supabase stack):

- Affordable/level-met/unowned buy → 200, wallet debited by cost, id persisted.
- Insufficient / locked / already-owned → 400, durable state unchanged (no debit, no double-add).
- L-002 spoof: account B cannot buy on account A; A's row unchanged (verified via admin/service-role client).

### Manual Testing Steps:

1. Seed/sign in a profile with enough funds; open /app/upgrades — confirm affordable/locked/owned split.
2. Buy an affordable upgrade — wallet drops by the cost, it moves to owned, shop art updates (no full reload).
3. Reload start — grown shop + correct "next upgrade / brakuje X zł".
4. Play a shift — it's longer than before the upgrade and pays more; a fully-upgraded shop's shift still completes.
5. Try a locked upgrade — shows the missing requirement, can't buy.
6. Confirm no urgency/scarcity copy anywhere.

## Performance Considerations

One profile read already loads `shop_state` (`select("*")`) — no new query for rendering the shop or the upgrades screen. The buy is a single read + single UPDATE (like `recordShiftResult`), no N+1. Committed art is a handful of small static PNG/SVG served raw.

## Migration Notes

`shop_state` default change is non-destructive (`set default`) and affects only new inserts; existing pre-launch rows (`'{}'`) are handled by `readPurchased`. No backfill. Rollback = revert the default. No RLS/policy/trigger change (column-agnostic F-01 policies — L-001). The wallet non-negative constraint (from S-05) is the overspend backstop.

## References

- Roadmap: `context/foundation/roadmap.md` → S-06 `upgrade-choice-and-growth` (north star)
- PRD: `context/foundation/prd-v3.md` US-01, FR-010–FR-014
- Render/persist/shop_state path: `context/changes/visible-shop-growth/research.md` (paused change; still valid)
- Server-authoritative pattern: `src/lib/services/child-profiles.ts:89-113`, `src/pages/api/shifts/complete.ts`
- Pure-fn "agree by construction": `src/data/shift.ts`
- Wallet (spent against): archived `context/archive/2026-07-01-spendable-funds-wallet/`
- Lessons: `context/foundation/lessons.md` L-001 (RLS column-agnostic), L-002 (no client `account_id`; verify durable state), L-003 (i18n strings)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Catalog, committed art, shop_state shape, pure fns

#### Automated

- [x] 1.1 Unit tests pass: `npx vitest run tests/upgrades.test.ts` — 6e85501
- [x] 1.2 Type checking passes: `npm run check` — 6e85501
- [x] 1.3 Linting passes: `npm run lint` — 6e85501
- [x] 1.4 Production build succeeds: `npm run build` — 6e85501
- [x] 1.5 Every catalog `art` path exists under `public/illustrations/` — 6e85501

#### Manual

- [x] 1.6 Committed upgrade art renders and is acceptable as v1 art — 6e85501
- [x] 1.7 Catalog ladder reads sensibly (costs/levels increase; first upgrade affordable within a few shifts) — 6e85501

### Phase 2: Server-authoritative buy endpoint

#### Automated

- [x] 2.1 Migration + buy test pass against a fresh DB (`supabase db reset` + `vitest run tests/upgrades-buy.test.ts`)
- [x] 2.2 Unit tests still pass: `npx vitest run tests/upgrades.test.ts`
- [x] 2.3 Type checking passes: `npm run check`
- [x] 2.4 Linting passes: `npm run lint`
- [x] 2.5 Build succeeds: `npm run build`

#### Manual

- [x] 2.6 A buy debits the wallet by exactly the cost and records the upgrade
- [x] 2.7 No path lets the wallet go negative or an upgrade be bought twice

### Phase 3: Dedicated /app/upgrades screen

#### Automated

- [ ] 3.1 Type checking passes: `npm run check`
- [ ] 3.2 Linting passes: `npm run lint`
- [ ] 3.3 Build succeeds: `npm run build`
- [ ] 3.4 Unit + buy tests still pass: `npx vitest run tests/upgrades.test.ts tests/upgrades-buy.test.ts`

#### Manual

- [ ] 3.5 /app/upgrades shows affordable / locked / owned correctly
- [ ] 3.6 Buying debits the wallet in the UI and moves the upgrade to owned without a full reload
- [ ] 3.7 Locked upgrades show the concrete missing requirement; no scarcity copy
- [ ] 3.8 Start-screen link + results nudge navigate to the upgrades screen
- [ ] 3.9 Unauthenticated /app/upgrades redirects to sign-in

### Phase 4: Visible growth + capacity-effect wiring

#### Automated

- [ ] 4.1 Type checking passes: `npm run check`
- [ ] 4.2 Linting passes: `npm run lint`
- [ ] 4.3 Build succeeds: `npm run build`
- [ ] 4.4 All tests pass incl. bonus-length + max-shift-accepted (`npx vitest run`)
- [ ] 4.5 No inline user-visible literals introduced (L-003 spot-check)

#### Manual

- [ ] 4.6 Buying visibly changes the shop art on start + upgrades screens
- [ ] 4.7 Owned upgrades lengthen the shift (up to the cap) and pay more; a max shop's shift still completes
- [ ] 4.8 Start screen shows the correct "next upgrade / brakuje X zł" and hides it when nothing's next
- [ ] 4.9 Full loop works end-to-end; spending never lowers level; copy is encouraging Polish, no scarcity
