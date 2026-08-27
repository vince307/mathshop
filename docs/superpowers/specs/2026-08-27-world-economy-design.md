# World Economy — worlds, catalogue, profit rule

**Status:** design approved, ready for `/10x-new` → `/10x-plan`
**Date:** 2026-08-27
**Scope:** the four-layer world/catalogue/economy tranche (W1 + the economy it depends on)
**Shaping notes:** `context/foundation/shape-notes-world-economy.md` (decisions D-1 … D-10)
**Governing PRD:** `context/foundation/prd-v3.md` — unchanged by this tranche

---

## Problem

MathShop's economy is one equation with one purchasable effect.

```
earningsForShift = EARN_PER_TASK (5) × taskCount + EARN_PER_CLEAN (3) × cleanCount
```

Six upgrades exist. Five of them do exactly one thing — `extraTasks: 1` — and
the sixth (`sign`) does nothing at all. So the entire loop is *buy capacity →
longer shift → more money → buy more capacity*, and `src/data/upgrades.ts` says
as much in its own header: a single shared catalogue is v1, and per-world
catalogues are "the multi-world tranche".

That design has one genuinely elegant property, and it is the thing this spec is
most careful not to break: **because capacity is the only purchasable effect, the
only thing money can buy is more mathematics.** Spending *is* the reward for
practising, with no shortcut around it.

Three things are missing.

**There is no decision.** With one effect type, every purchase is the same
purchase at a different price. PRD v3's central bet — FR-011's *"in-world
math/decision moment"* — needs at least two directions worth choosing between.

**There is no sink.** Every effect raises earning power, so every purchase makes
the next one easier. The economy accelerates and never resolves.

**A world is a picture.** `World = { slug, name, image }` **[V]**
`src/data/worlds.ts`. A world selects an illustration and touches nothing else —
not tasks, not the catalogue, not the economy. PRD v3 assumes six worlds; four
exist (backlog W1).

## Scope

The shaping session decomposed this into four nested layers. All four are in
this spec, because 4 governs 3, 3 governs 2, and layer 1 turned out to be cheap
once it was settled.

| Layer | Subject | Decision |
| ----- | ------- | -------- |
| 1 | What a world IS, mechanically | D-3 — a skin over a shared spine |
| 2 | The purchase catalogue | D-4, D-7, D-8, D-10 |
| 3 | The profit rule's shape | D-6 |
| 4 | What the economy is for | D-5 |

`/10x-shape` ran this to completion, scoped to
`shape-notes-world-economy.md`; every decision below was put to the maintainer
and answered. This document transcribes them. **It does not re-open them** — the
rejected alternatives and their reasoning live in the D-numbered sections of the
notes.

**Why a spec and not `prd-v4`.** Same path the adaptive task engine took (D-2).
The one condition that would have forced a PRD re-baseline — an earnings-rule
change that invalidates v3's economy FRs — was checked against FR-008 and does
not hold. See *Constraint compliance* below.

## Non-goals

- **B2 `pricing-and-inventory` is not absorbed.** It needs a product entity *and*
  a new task type (`set-price` / `manage-stock`); **[V]** `src/types.ts:113–120`
  puts those and their `inventory` / `profit` competencies out of scope "until
  those task types exist", and new task types are P2, which is parked pending
  telemetry. B2 stays its own tranche; B5 stays blocked on B2.
- **No real money, ever.** PRD v3 §Non-Goals. "Virtual monetization" here means
  the in-game funds economy that already ships.
- **No casino mechanics.** No random unlocks, timers, streak pressure, scarcity
  or urgency messaging, rankings, child-vs-child comparison. This rules out most
  conventional economy levers, and it is why several obvious answers below were
  rejected.
- **No new task type, no new competency.** Both are P2.
- **No parent-facing economy controls.** Parked per PRD v3 §Non-Goals.
- **No growth in catalogue size.** FR-010 caps it at 5–8 entries; this tranche
  lands on 8 and stops.

---

## Design

### 1. The profit rule

A shift has a cost of doing business, subtracted from that shift's revenue before
anything reaches the wallet.

```
revenue = (EARN_PER_TASK  × quantityMargin) × taskCount
        + (EARN_PER_CLEAN × accuracyMargin) × cleanCount
cost    = shopRunningCost(purchased)
profit  = max(0, revenue − cost)
wallet += profit
```

The results screen stops showing one number and starts showing three —
*przychód · koszt · zysk*. **That display is the lesson**, not decoration on top
of it: it is the only place in the product where a second arithmetic operation
enters the economy, and it is the entrepreneurship framing PRD v3 asks for
rather than a label applied to a score.

Two guardrails, both load-bearing:

1. **The cost accrues per shift, never over wall-clock time.** A cost that ticks
   while the child is away is a timer, and timers are banned. There is no
   scheduled job and no "time since last login" arithmetic anywhere in this
   design.
2. **`profit` is clamped at zero.** A shift is never net-negative.

### 2. The catalogue — eight entries, three kinds

FR-010 bounds the catalogue at 5–8 entries. There are 6 today, so there are
exactly two free slots, and the composition is close to forced:

| Count | Kind | Entries | Effect |
| ----- | ---- | ------- | ------ |
| 1 | unlock | `sign` | opens the "marka" branch; no earnings effect |
| 5 | capacity | `shelf`, `register`, `slot`, `storage`, `customers` | `extraTasks: 1` each (unchanged) |
| 2 | margin | **new** — accuracy, quantity | raise `EARN_PER_CLEAN` / `EARN_PER_TASK` |

**Why capacity cannot grow.** **[V]** `src/data/upgrades.ts` — the five capacity
entries carry `extraTasks: 1` each and `MAX_BONUS_TASKS = 5`. They sum to
*exactly* the cap. A sixth capacity entry would be a purchase with no effect,
which is the trap condition §4 forbids. Capacity is full; the two free slots are
the two margins.

**`sign` becomes the branch gate.** It is the cheapest entry (30 zł), so
essentially every child buys it and buys it first. A universal *effect* is not a
decision — a universal margin is merely a different value of `EARN_PER_TASK`. A
universal *gateway* makes the first 30 zł a choice of direction, so the
capacity-vs-margin tension starts at the first purchase. It also satisfies
FR-012 (`prd-v3.md:108`) with both halves literally: a sign is a **visible**
change and now carries a **functional** unlock.

**Branches are non-exclusive.** A branch governs **visibility and order, never
availability**. Buying `sign` opens the margins without closing capacity, and
nothing in the catalogue can permanently foreclose anything else. An
un-undoable wrong choice is pressure by another name.

### 3. Gates — each margin is gated by what it pays for

| Entry | Gate | Mechanism |
| ----- | ---- | --------- |
| accuracy margin | first-try-correct level | `requiredSkill { competency, level }` |
| quantity margin | completed task count | `requiredTaskHistory { competency, count }` |
| `sign` | world level only | `requiredWorldLevel` |
| capacity ×5 | unchanged | as shipped |

Precision opens the bonus for precision; practised volume opens the per-task
bonus. Gate and reward describe the same ability, which makes the branch legible
to a child and — through FR-016's weekly report — to a parent.

**No new gating machinery for the margins.** Both mechanisms exist and `canBuy`
already evaluates them in a fixed order — unknown id → owned → world level →
skill → task history → affordability — with the explicit property that *"an owned
upgrade is NEVER retro-locked by a later rung"*. **[V]** `src/data/upgrades.ts`.

**One new rung is needed**, for the branch: `requiredUpgrade?: string`, with a
new `BuyReason` (`"branch-locked"`). It slots in after the world-level check and
before the skill gates, and it inherits the owned-first ordering, so a
branch entry already bought can never be retro-locked either.

**Why not gate on difficulty `d`.** `d` is the most current measure of ability
and the only one nobody has used as a gate. It was rejected because **`d` moves
down as well as up** (`src/data/adaptive.ts`). A `d`-gate would withdraw an
unbought upgrade from a child who had a worse day — visible yesterday, gone
today — and `canBuy`'s retro-lock protection covers *owned* entries only. That is
a punishment for struggling. `firstTryCorrect` and `completed` are monotone, so
an entry that becomes reachable stays reachable.

**This deepens FR-015.** `prd-v3.md:115` makes skill progress load-bearing
because upgrade requirements reference it. Today **2 of 6** entries carry an S-07
gate (`register`, `customers`). After this tranche it is **4 of 8** — half the
catalogue — with no new concept invented.

### 4. The running cost, and the no-trap invariant

```
cost = shopRunningCost(purchased)      // a bigger shop is more expensive to run
```

Keyed on **what you own**, not on business level and not a flat constant. This is
the only shape where **the brake is paid by whoever compounds**: capacity and the
quantity margin multiply each other (`taskCount` is itself raised by capacity),
and `MAX_BONUS_TASKS` clamps only one of the two factors. A cost that rises with
ownership damps that runaway with the same mechanism that creates it, and no
second cap has to be invented.

The price of that shape is a hard invariant, which is part of the design and not
a testing detail:

> **No-trap invariant.** For every unowned entry `u`, buying `u` must **strictly
> increase** steady-state profit:
> `∀ u ∉ purchased : profit(purchased ∪ {u}) > profit(purchased)`

Without it, `f(purchased)` can produce an upgrade that costs more to run than it
earns. That is worse than an unbraked economy: an unbraked economy is merely too
easy, whereas a trap purchase punishes a child for engaging with the one decision
the whole product is built around (FR-011/FR-012), and it cannot be undone.

**The invariant needs a canonical evaluation point.** `profit` is not a single
number — it depends on the shift, and shift length depends on per-competency
difficulty `d` **[V]** `src/data/shift.ts:56–86`. The plan must pin
"steady-state profit" to a reference shift (the expected shift at difficulty `d`
under a fixed accuracy assumption is the obvious candidate) and the invariant
must then hold **for all `d ∈ [0,1]`**, not at one convenient point.

**It is exhaustively checkable.** FR-010 bounds the catalogue at 8 entries, so
`purchased` has at most **2⁸ = 256** states. Every subset × a grid over `d` runs
as an ordinary property test — no sampling, no flakiness. This is an established
technique in this repo: **[V]** `src/data/shift.ts:22–32` describes the sweep in
`tests/adaptive.test.ts` that fails if the length curve outgrows
`MAX_SHIFT_TASKS`, and `src/data/stages.ts:15` locks stage
monotonicity/reachability in `tests/stages.test.ts`.

### 5. A world is a skin over one shared mechanical spine

A world supplies **identity** — its name, its art, and its own vocabulary for
every catalogue entry — and nothing mechanical. Same ids, same costs, same
effects, same gates, in every world. A `register` bought in the galactic base is
the same purchase as a `register` bought in the bakery; only the word and the
picture change.

```ts
World = { slug, name, image, art?: Record<UpgradeId, string> }
// copy: t.worlds[slug].upgrades[id] ?? t.upgrades[id]
```

**The fallback is mandatory, not a convenience.** A world that has not yet been
given its own vocabulary must still render, with world-neutral names. Without it,
every catalogue change would block on six translations before it could ship, and
W1 would become a prerequisite for the economy instead of a sibling of it.

The catalogue keeps carrying no literal copy — the L-003 rule is unchanged; only
the resolution path gains a fallback layer.

**Why not per-world economies.** An economically better world is a mechanically
better world, which is exactly what the world-switch screen promises does not
happen; and switching worlds would start to read as a restart. The
`purchasedMeta` attribution data **[V]** `src/types.ts:98–107` — written on every
buy, read by nothing, and documented as "the attribution data that change will
need" — keeps that door open if telemetry ever argues for it. This tranche does
not build it.

**W1 is priced by this.** Backlog W1's inherited claim that "the gap is art plus
per-world copy" now has a number: **6 worlds × ≤8 entries** of vocabulary,
bounded above by FR-010, shippable incrementally because of the fallback.

### 6. Constraint compliance

**FR-008 — the one that decides whether `prd-v4` is needed.** `prd-v3.md:102`:
*"Funds accumulate across shifts and are **never reduced except by a deliberate
upgrade purchase**; the balance is shown as a wallet, framed so that spending
reads as acquiring a permanent upgrade, not losing coins."*

The cost applies to a **shift's revenue**, never to the **wallet balance**. With
`profit ≥ 0` the wallet is monotonically non-decreasing outside a purchase, so
FR-008 holds by the letter and by its intent.

> **This dictates the implementation.** `wallet -= rent` breaks FR-008;
> `wallet += max(0, revenue − cost)` does not. A reviewer who sees a wallet debit
> should reject it on FR-008 grounds, not on taste.

The same reading answers **`prd-v3.md:180`, risk 5** — *"the risk that a
6-year-old reads a dropping balance as losing progress"*. The balance never drops
outside a purchase; the subtraction appears only in the per-shift breakdown, on
money the child has not yet banked.

**FR-010 wording.** It reads *"the world defines a small upgrade catalog"*, which
sounds like per-world catalogues. Under §5 *"the world defines"* is satisfied by
identity — each world names and pictures the catalogue as its own — while the
mechanical spine stays shared. None of FR-010's stated requirements (cost, world
level, skill progress, task history, "no random unlocks") is per-world. Recorded
here so it is not re-litigated during planning.

**FR-012 — the one place this tranche exceeds v3's letter.** `prd-v3.md:108`
enumerates a purchase's functional effect as *"new product, task type, or
capacity"*. `capacity` and `unlock` sit inside that list; **the two margins do
not**. This is an extension rather than a contradiction — FR-012 constrains what
a purchase *does*, and a margin is a new kind of functional effect rather than an
absence of one — but it is stated out loud rather than glossed.

### 7. What deliberately does not change

**`SHIFTS_PER_LEVEL = 3` stays.** **[V]** `src/data/shift.ts:303–305` —
`businessLevelForShifts(n) = 1 + floor(n / 3)`, uncapped, and `requiredWorldLevel`
sits on every entry. The shaping session opened this as a suspected weakness
("level advances on a bare shift counter while everything else is earned") and
closed it as the opposite. After this tranche, cost, `requiredSkill` and
`requiredTaskHistory` are all merit-based; `requiredWorldLevel` is the **only**
time-based gate, and therefore the only guarantee that a slower child eventually
sees the whole catalogue. Making it earned too would close every gate in the game
behind merit at once. The uncapped formula also already has a documented reason to
stay uncapped **[V]** `src/data/stages.ts:10–13`: capping it "would make
`recordShiftResult`'s `leveledUp` flag permanently false and silence the level-up
celebration forever".

**No migration.** `shop_state.purchased` stays a flat global list of ids; the new
effect fields live in the catalogue, which is code. `purchasedMeta` stays
write-only.

**`shift_log.earned` keeps its contract.** The column is documented as the
server-computed shift payout and constrained `>= 0` **[V]**
`supabase/migrations/20260822120000_shift_log_add_earned.sql`. Its real contract
is *the amount added to the wallet*, and that stays true: it now records profit,
and every pre-existing row is a shift whose cost was zero. **No migration, no
backfill, no ambiguity** — including for the telemetry harness's existing rows.
Splitting revenue/cost into their own columns is a follow-on, not this tranche.

**Everything the shipped world-switch screen promises.** `src/i18n/pl.ts:204–205`
— *"Każdy świat uczy tych samych umiejętności"* and *"Twój sklep i kupione
ulepszenia przenoszą się do nowego świata"* — stays literally true and is not
rewritten. **[V]** rendered by `WorldPicker.tsx:76,78`.

Also unchanged: `MAX_SHIFT_TASKS = 17` and the deliberate decision that it is a
literal rather than a derived cap; FR-016's no-mid-shift-persistence; the RLS
surface (no new table, no new route).

### 8. Module boundaries

`src/data/shift.ts` does **not** import `src/data/upgrades.ts` today, and this
design keeps it that way — `MAX_SHIFT_TASKS`'s header explains why a derived cap
was rejected there, and reversing that quietly would undo the reasoning.

The seam is a plain value object:

```ts
// upgrades.ts — catalogue domain: reads `purchased`, resolves the catalogue
export interface ShopEffects {
  bonusTasks: number;      // existing shiftBonusTasks(), unchanged
  quantityMargin: number;  // 1 when unowned
  accuracyMargin: number;  // 1 when unowned
  runningCost: number;
}
export function shopEffects(purchased: string[]): ShopEffects

// shift.ts — economy domain: one formula, takes effects as data
export function profitForShift(
  taskCount: number, cleanCount: number, effects: ShopEffects,
): { revenue: number; cost: number; profit: number }
```

One selector, one formula. Both callers — the island's celebration and the
authoritative `/api/shifts/complete` write — call the same pair, preserving the
property both module headers already assert: *"so both sides agree by
construction"* **[V]** `src/data/shift.ts:1–6`, `src/data/upgrades.ts:1–13`.

`earningsForShift` is retained as `revenue` at margin 1, or replaced outright —
a plan-level call. It has direct test coverage at `tests/shift.test.ts:170–179`
and `tests/shifts-complete.test.ts` in five places.

### 9. Testing

- **No-trap invariant** — property sweep over all ≤2⁸ `purchased` subsets × a
  grid of `d ∈ [0,1]`. The headline deliverable; same family as
  `tests/adaptive.test.ts` and `tests/stages.test.ts`.
- **Wallet monotonicity** — for any shift outcome, `wallet` after
  `recordShiftResult` is `>=` wallet before. Guards FR-008 against a future
  refactor that reaches for a debit.
- **`profit ≥ 0`** — including the degenerate shift (few tasks, high cost).
- **No re-locking** — for any pair of skill states where the later dominates,
  `canBuy` never moves from `ok` to a gate failure. Extends the existing
  property **[V]** `tests/upgrades.test.ts:115` — *"owned short-circuits before
  the skill/history rungs (no retro-lock)"* — which the new `branch-locked` rung
  must inherit.
- **Branch non-exclusivity** — no purchase makes any other entry permanently
  unreachable.
- **Copy fallback** — a world with no vocabulary entry renders the neutral
  `t.upgrades[id]` name; extends `tests/worlds-picker.test.tsx` / i18n helpers.
- **Server authority** — `/api/shifts/complete` recomputes profit from the
  trusted row's `shop_state`; a tampered client cannot claim a margin it has not
  bought. Extends `tests/shifts-complete.test.ts`.
- **Regression** — the shift E2E and `tests/upgrades-buy.test.ts` pass with
  updated expectations only.

---

## Files affected

| Path | Change |
| ---- | ------ |
| `src/data/upgrades.ts` | `Upgrade` gains `quantityMargin?` / `accuracyMargin?` / `requiredUpgrade?`; two new entries; `sign` becomes the branch gate; `shopEffects()` + `shopRunningCost()`; `canBuy` gains the `branch-locked` rung |
| `src/data/shift.ts` | `profitForShift()`; `earningsForShift` retained as revenue or replaced |
| `src/data/worlds.ts` | `World` gains optional per-world art override |
| `src/i18n/pl.ts` | per-world upgrade vocabulary with fallback; two new entries; three result-screen strings (przychód / koszt / zysk) |
| `src/lib/services/child-profiles.ts` | `recordShiftResult` reads `shop_state`, writes profit; `ShiftResult` carries revenue/cost/profit |
| `src/pages/api/shifts/complete.ts` | response carries the three numbers |
| `src/components/child/ShiftScreen.tsx` | celebration shows three numbers. **[V]** it already receives `purchased` (`ShiftScreen.tsx:41,72`), so the island needs no new prop |
| `src/pages/app/task.astro` | **no change expected** — already reads `readPurchased(profile.shop_state)` and passes it (`task.astro:29,84`) |
| `src/components/child/UpgradeShop.tsx` | renders margin effects and the branch-locked state |
| `tests/` | new invariant suites; updated expectations in `shift`, `shifts-complete`, `upgrades`, `upgrades-buy` |

No migration. No new table, route, or RLS policy.

## Open tuning parameters

Named constants, first-guess values, settled after kid-testing — not blockers for
implementation. This is the repo's standing convention for economy constants.

- `shopRunningCost`'s curve shape and per-entry weights — **checked against the
  compounding case (capacity × quantity-margin), not the base case**
- The two margin multipliers and the two entry costs
- Which competency each margin gates on, and its threshold. Proposed, not
  decided: accuracy margin ← `money` (change-making is where precision with
  money lives, the pattern `register` already uses); quantity margin ← `math`
  (counting volume, the pattern `customers` already uses)
- `sign`'s cost, if 30 zł stops being right once it gates a branch — note
  `prd-v3.md:62`'s loop signal, "a first purchase within ~3 shifts"
- The reference shift used to evaluate the no-trap invariant

## Follow-on

- **W1 `six-worlds-catalogue`** — art plus 6 × ≤8 vocabulary entries. A sibling
  of this tranche, not a prerequisite: the copy fallback lets worlds be named
  incrementally. Two known art debts to price in: per-world *upgrade* art does
  not exist (the six `upgrade-*.svg` are world-neutral), and per-stage world art
  exists for **zero** worlds **[V]** `src/data/stages.ts:17–31`, which documents
  the upgrade path. Neither blocks anything here.
- **B2 `pricing-and-inventory`** — unblocked by neither this tranche nor W1. It
  needs P2's task types first.
- **Revenue/cost columns on `shift_log`** — would let the weekly parent report
  show the profit breakdown over a week rather than a payout total. Deliberately
  out of scope; `earned` alone keeps the report correct today.
- **Per-world economies** — if telemetry ever argues for them, `purchasedMeta`
  is the attribution data that change needs.
