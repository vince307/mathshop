# World Economy — worlds, catalogue, profit rule

**Status:** design approved, ready for `/10x-new` → `/10x-plan`
**Date:** 2026-08-27 (revised the same day — see *Revision*)
**Scope:** the four-layer world/catalogue/economy tranche (W1 + the economy it depends on)
**Shaping notes:** `context/foundation/shape-notes-world-economy.md` (decisions D-1 … D-13)
**Governing PRD:** `context/foundation/prd-v3.md` — unchanged by this tranche

**Revision — 2026-08-27.** D-1…D-10 were benchmarked against the professional
game-economy literature (Adams & Dormans, *Game Mechanics: Advanced Game Design*;
Daniel Cook, *Value chains*; room8studio; Unity's economy guides; Alex Wiserax,
*I Designed Economies for $150M Games*). **The benchmark
confirmed the structure** — every mechanism here has a standard name, and the
no-trap invariant is above the industry norm rather than below it — and found
three things it did not cover. **D-11, D-12 and D-13** answer them, and this
document now carries them: a decoration sink outside the catalogue (§2, §4, §5),
a no-dominance invariant (§4), and a pacing model that also supplies the reference
shift (§9). One earlier rejection is reversed: D-4's "no purely decorative entry"
no longer holds — see §2.

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
the next one easier. The economy accelerates and never resolves — and then, at the
other end, it resolves *too hard*: the catalogue is finite, so once it is empty the
wallet has no drain at all. Verified arithmetic (D-11): the catalogue totals **850
zł** **[V]** `src/data/upgrades.ts`, a shift returns **40–56 zł** early and
**112–136 zł** at full capacity **[V]** `shift.ts:45–47,289`, `adaptive.ts:236–238`,
so it empties in the band **~7–25 shifts**. After that FR-013 has no next upgrade to
name, the results-screen progress card goes `null` **[V]** `ShiftScreen.tsx:131–132`,
and — because the shop carries across worlds **[V]** `pl.ts:204–205` — all six worlds
go economically empty at once.

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
  lands on 8 and stops. Decorations (§2) are **not** catalogue entries — FR-012
  defines an upgrade as visible **and** functional, and a decoration is visible
  only, so FR-010's bound does not reach it.
- **No real-time or wall-clock pacing.** The pacing model (§9) is a function of
  shifts and tasks, never of elapsed time. Reasoning about elapsed time is the
  doorway to the timer mechanics PRD v3 bans.

---

## Design

### 1. The profit rule

A shift has a cost of doing business, subtracted from that shift's revenue before
anything reaches the wallet.

```
revenue = (EARN_PER_TASK  × quantityMargin) × taskCount
        + (EARN_PER_CLEAN × accuracyMargin) × cleanCount
cost    = shopRunningCost(investment ⊆ purchased)      // investment only — D-11
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

#### 2a. Decorations — a second list, outside the catalogue

The eight entries above are the whole *catalogue*, and it does not grow. But a
finite catalogue leaves the wallet with no drain once it is empty (§Problem), so
the design carries a **second, separate list**: per-world decorations.

| | Catalogue entry | Decoration |
| --- | --- | --- |
| economic effect | capacity / margin / unlock | **none, by construction** |
| enters `shopRunningCost` | yes (it is `investment`) | **no** |
| gate | world level, skill, task history, branch | **price only** |
| scope | global — carries across worlds | **per world** |
| persisted in | `shop_state.purchased` | `shop_state.decorations` |
| bounded by FR-010 | yes (5–8) | **no** — see §6 |

Three properties do the work:

- **Zero economic effect** is what makes a decoration legal under §4. D-4
  originally banned the purely decorative entry, and D-6 appeared to force that
  ban: an entry with no effect raises `cost` and returns nothing, so it violates
  no-trap by construction. That derivation only holds while `shopRunningCost` is
  keyed on *all* of `purchased`. Keying it on the **investment** subset — the
  investment / non-investment split the economy literature treats as standard —
  removes the trap and makes the decorative entry legal again. **D-11 reverses
  D-4's rejection on that basis.**
- **Per-world** is what makes the sink *renew*. A finite global decoration list
  would only move the empty-wallet wall from ~shift 25 to ~shift 60. Renewal on
  world change is also the first mechanism that makes six worlds worth having —
  and it grants no world an economic advantage, because a decoration has no
  economic effect, so §5's rejection of per-world economies is untouched.
- **Price is the only gate.** Every other gate in the game is merit-based (§3) or
  time-based (§7). This list is deliberately the one place where the answer to
  *"what can I do with this money"* is always "something"; a skill gate here would
  re-create the empty wallet for exactly the child who earns slowest.

**Decorations must never enter `purchased`.** If they did they would feed
`shopRunningCost` and `canBuy`'s rung order and re-create the trap by the back
door. Hence a separate key rather than a flag on the catalogue.

**No new UI system is needed.** `ShopArt` already composites percent-positioned
overlays keyed by id, with per-world slot overrides for `piekarnia`,
`galaktyczna-baza` and `sklep-ksiegarnia` (`kawiarnia` deliberately on
`DEFAULT_SLOTS`), and the documented rule that *"an upgrade with no slot falls
back to the corner row"*. **[V]** `src/components/child/ShopArt.tsx`. A decoration
is one art file plus an optional slot, and the corner-row fallback lets the sets
ship one entry at a time.

This split is not an invention of this design: the economy literature carries it
as standard (room8studio's *investment / non-investment* resources; Wiserax's
*critical / non-critical*, whose non-critical category is named as *"cosmetic items
or decorative elements"*). Wiserax also reports the failure it prevents from a
shipped title — in *Dreamdale*, *"players quickly accumulated the main currency…
but spent almost none of it… the spend points were not attractive enough"*, fixed
by adding things to spend on.

**Known cost, stated rather than discovered during planning: no decoration art
exists.** All three manifests (`atomic-assets-v1`, `-v2`, `-v3`) were searched for
`decor`, `plant`, `poster`, `lamp`, `banner`, `flower`, `sticker`, `cosmetic` —
**zero** asset hits; the single `decor` match is the word *"decorative"* in v3's
`usePngFor` guidance. **[V]** 2026-08-27. This is `6 × N` new assets that cannot
be pulled out of `assets/`, on top of the two art debts §5 already records.

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

### 4. The running cost, and the three economic invariants

```
cost = shopRunningCost(investment)     // a bigger shop is more expensive to run
                                       // investment ⊆ purchased — decorations excluded
```

Keyed on **what you own that earns**, not on business level and not a flat
constant, and not on the whole of `purchased`. This is
the only shape where **the brake is paid by whoever compounds**: capacity and the
quantity margin multiply each other (`taskCount` is itself raised by capacity),
and `MAX_BONUS_TASKS` clamps only one of the two factors. A cost that rises with
ownership damps that runaway with the same mechanism that creates it, and no
second cap has to be invented.

The price of that shape is a hard invariant, which is part of the design and not
a testing detail:

> **No-trap invariant (investment).** For every unowned investment entry `u`,
> buying `u` must **strictly increase** steady-state profit:
> `∀ u ∉ investment : profit(investment ∪ {u}) > profit(investment)`
>
> **No-harm invariant (non-investment).** Owning a decoration leaves profit
> **unchanged**: `∀ d : profit(investment) is invariant under owning d`.

The second clause is what makes the investment split safe. It is the
machine-checkable form of *"a decoration can never cost you anything but its
price"*, and it is why a decoration cannot re-enter the trap through
`shopRunningCost`.

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

#### The no-dominance invariant

No-trap says no purchase is *worse*. Nothing so far says no **branch** is
*strictly better* — and *dominant strategy* is the balance failure the economy
literature names first: if one branch is always the better buy, the choice
evaporates and the child is executing, not deciding. §2's capacity-vs-margin
tension is the point of this entire tranche, so it must be verified rather than
assumed.

For a state `(I, d)` — investment subset `I`, difficulty `d` — the marginal
return of a buyable entry is its profit gain per złoty of price:

```
ROI(u | I, d) = [ profit(I ∪ {u}, d) − profit(I, d) ] / cost(u)
ROI*_B(I, d)  = max over buyable u in branch B          // B ∈ { capacity, margin }
```

> **No-dominance invariant.** For every **reachable** state `(I, d)` in which both
> branches have at least one buyable entry:
> `min(ROI*_cap, ROI*_mar) ≥ DOMINANCE_FLOOR × max(ROI*_cap, ROI*_mar)`,
> with `DOMINANCE_FLOOR` a named tunable — first guess **0.6**.

Three properties of that shape, each deliberate:

1. **It is one-sided on purpose.** The literature names two balance failures: the
   dominant option, and its mirror — the meaningless one, *"if all choices are
   equal, the choice, ultimately, doesn't matter."* That argues for a two-sided
   band, and it is **declined here**. The meaningless-choice example is a set of
   *identical* options; these branches differ in **kind** — capacity buys *more
   practice*, a margin *re-prices practice already done* — which a child sees in
   the shop and feels in the shift length at any ROI ratio. More decisively,
   capacity is the branch that produces *more mathematics*, so ROI parity is
   **desirable** rather than a defect: a ceiling would fail the sweep exactly at
   parity and force the fix in the wrong direction — inflating margins or
   weakening the branch that teaches. The floor exists only to stop one side being
   strictly the wrong answer.
2. **It sweeps reachable states only.** No-trap sweeps all ≤2⁸ subsets, which is
   conservative and correct for it. No-dominance must not: the gates in §3 and §7
   make many subsets unoccupiable, and failing on a state no child can reach is a
   false alarm. Reachability is cheap — every gate is monotone and `canBuy`'s rung
   order is fixed **[V]** `src/data/upgrades.ts` — so it is a breadth-first walk of
   the subset lattice. **The reachability filter is part of the deliverable**, not
   an implementation detail for a planner to invent.
3. **It shares the reference shift with no-trap**, and §9's pacing model supplies
   it.

### 5. A world is a skin over one shared mechanical spine

A world supplies **identity** — its name, its art, its own vocabulary for every
catalogue entry, **and its own decoration set** (§2a) — and nothing mechanical.
Same ids, same costs, same effects, same gates, in every world. A `register` bought in the galactic base is
the same purchase as a `register` bought in the bakery; only the word and the
picture change.

```ts
World = { slug, name, image, art?: Record<UpgradeId, string>, decorations: DecorationId[] }
// copy: t.worlds[slug].upgrades[id] ?? t.upgrades[id]
```

The decoration set is the one thing a world owns outright rather than skins. It
is still not *mechanical*: a decoration has no economic effect, so no world earns
better than another and the rejection below stands.

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

**W1 is priced by this.** The claim this document inherited — *"the gap is art
plus per-world copy"* — is stale on its art half: **[V]** 2026-08-27, `WORLDS`
holds **4** entries (`src/data/worlds.ts`) while **all six** `world-*.webp` files
are committed under `public/illustrations/` and recorded in `slice-map.md`. **W1's
world art is done**, and `backlog.md` § `## Ready` already records that. What
remains is **6 worlds × ≤8 entries** of catalogue vocabulary (bounded by FR-010,
shippable incrementally because of the fallback) **plus 6 × N decoration sets** —
and the decoration *art* is the half that starts from zero (§2a).

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

**FR-010 / FR-012 and the decoration list.** FR-012 (`prd-v3.md:108`) defines a
purchase's effect as a **visible** change *plus* a **functional** unlock. A
decoration is visible only, so it is **not an upgrade in v3's own terms**, and
FR-010's 5–8 bound — which governs "the upgrade catalog" — does not reach it. The
catalogue still lands on eight and stops; decorations are a second list beside it.
`prd-v3.md:62` already names *"new shelf/sign/**decoration**"* as a legitimate
visible change, so the vocabulary is v3's own. **D-2's `prd-v4` trigger stays
unfired: no FR is edited.**

**FR-013 is what the decoration list actually protects.** *"The start/results
surface shows the **next** meaningful upgrade and the concrete amount still
needed"* has no content once the catalogue is empty, and the results-screen
progress card degrades to `null` **[V]** `ShiftScreen.tsx:131–132`,
`ShiftResults.tsx:15`. With a renewing sink there is always a next thing to save
toward, so FR-013 keeps its meaning past the catalogue's end.

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

**No migration.** `shop_state.purchased` stays a flat global list of ids and gains
an **optional sibling** `decorations?: string[]` in the same jsonb — exactly the
precedent `purchasedMeta?` set, so every legacy `{}` and `{ purchased: [] }` row
stays valid **[V]** `src/types.ts:98–112`. The new effect fields live in the
catalogue, which is code. `purchasedMeta` stays write-only.

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
  runningCost: number;     // over the INVESTMENT subset only — decorations never reach here
}
export function shopEffects(purchased: string[]): ShopEffects
// `purchased` holds catalogue ids only; decorations live in `shop_state.decorations`
// and are read by the art layer, never by this module. That separation IS the
// no-harm invariant (§4) — enforced by module boundary, not only by test.

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

- **No-trap invariant (investment)** — property sweep over all ≤2⁸ investment
  subsets × a grid of `d ∈ [0,1]`. The headline deliverable; same family as
  `tests/adaptive.test.ts` and `tests/stages.test.ts`.
- **No-harm invariant (non-investment)** — owning any decoration leaves `profit`
  bit-identical, and no decoration id ever reaches `shopRunningCost`.
- **No-dominance invariant** — over **reachable** states only (BFS over the subset
  lattice under the §3/§7 gates), neither branch's best marginal profit-per-złoty
  exceeds the other's by more than `DOMINANCE_FLOOR`. Without it, §2's tension may
  simply not exist and nothing would say so.
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
- **Decoration purchase** — server-authoritative like an upgrade buy: the route
  recomputes affordability from the trusted row, a decoration cannot be bought
  twice, and a decoration id from another world is rejected.
- **Regression** — the shift E2E and `tests/upgrades-buy.test.ts` pass with
  updated expectations only.

#### The pacing model

All three sources benchmarked in the shaping session agree on one prescription:
**model the economy before building it**. This design deferred every number to
kid-testing, and that already costs something verifiably: `prd-v3.md:62` states a
loop signal — *"a typical child chooses and buys at least one upgrade of their own
within their first ~3 shifts"* — while `sign` costs **30 zł** against a first-shift
return of **40–56 zł** **[V]**. The first purchase lands on shift **1**, not ~3.
**The shipped catalogue already misses its own PRD pacing signal**, and nothing
computed it.

The deliverable:

- **A pure simulation of `N` shifts per cohort**, importing `src/data/*` so a price
  change re-runs it. Never a spreadsheet beside the repo — that drifts the moment a
  constant moves.
- **The child model already exists** — **[V]** `scripts/telemetry-harness/child-model.ts`
  defines `ChildModel { pBaseline, dropAtCeiling }`, a deterministic mulberry32 RNG
  and three swept cohorts (`p090`, `p075`, `p055`). Consume it; write no second
  assumption file. Its header's caveat binds the output too: this says how the
  **economy** responds to a class of player, not what a real child does.
- **Prices expressed in tasks solved**, not in time. The canon's default unit is
  play time; here the better unit is the one the product is about — *the only thing
  money can buy is more mathematics*, so the natural price unit is mathematics.
  Every catalogue entry and every decoration gains a derived "cost in tasks" figure.
- **A test asserting `prd-v3.md:62`'s pacing signal**, instead of leaving it
  unmeasured.
- **The reference shift** for the no-trap and no-dominance sweeps — which closes
  the open decision below by derivation rather than by a planner's silent choice.

**This will generate work**, and that is the accepted cost: it will almost
certainly show the shipped prices are mistuned. It also **narrows a standing repo
convention**. `src/data/upgrades.ts` and `src/data/stages.ts` both say costs are
*"first-guess defaults, adjust after kid-testing"*. That stays true for what only
children can answer — above all whether the accuracy margin reads as *reward for
precision* or as *punishment for being a beginner*. It stops being true for what
arithmetic can settle. Kid-testing gets one shot; it should not be spent on whether
the catalogue empties at shift 9 or shift 40.

---

## Files affected

| Path | Change |
| ---- | ------ |
| `src/data/upgrades.ts` | `Upgrade` gains `quantityMargin?` / `accuracyMargin?` / `requiredUpgrade?`; two new entries; `sign` becomes the branch gate; `shopEffects()` + `shopRunningCost()` over the **investment** subset; `canBuy` gains the `branch-locked` rung |
| `src/data/decorations.ts` | **new** — the per-world decoration lists: id, cost, art, optional slot. No effect fields by construction |
| `src/types.ts` | `ShopState` gains `decorations?: string[]` (optional, same jsonb — the `purchasedMeta?` precedent) |
| `src/data/shift.ts` | `profitForShift()`; `earningsForShift` retained as revenue or replaced |
| `src/data/worlds.ts` | `World` gains an optional per-world art override and its `decorations` set |
| `src/i18n/pl.ts` | per-world upgrade vocabulary with fallback; two new entries; decoration names; three result-screen strings (przychód / koszt / zysk) |
| `src/lib/services/child-profiles.ts` | `recordShiftResult` reads `shop_state`, writes profit; `ShiftResult` carries revenue/cost/profit |
| `src/pages/api/shifts/complete.ts` | response carries the three numbers |
| `src/components/child/ShiftScreen.tsx` | celebration shows three numbers. **[V]** it already receives `purchased` (`ShiftScreen.tsx:41,72`), so the island needs no new prop |
| `src/pages/app/task.astro` | **no change expected** — already reads `readPurchased(profile.shop_state)` and passes it (`task.astro:29,84`) |
| `src/components/child/UpgradeShop.tsx` | renders margin effects, the branch-locked state, and the world's decoration list beside the catalogue |
| `src/components/child/ShopArt.tsx` | decoration overlays reuse the existing slot map; unslotted decorations take the documented corner-row fallback. **[V]** no new compositing system needed |
| `scripts/` or `tests/` | the pacing model (§9), importing `src/data/*` and `scripts/telemetry-harness/child-model.ts` |
| `tests/` | new invariant suites (no-trap, no-harm, no-dominance); the pacing assertions; updated expectations in `shift`, `shifts-complete`, `upgrades`, `upgrades-buy` |

No migration. No new table, route, or RLS policy. The decoration purchase reuses
the existing buy route's authority model — recompute from the trusted row, never
trust a client amount.

## Open tuning parameters

Named constants, first-guess values — not blockers for implementation. This is the
repo's standing convention for economy constants, **narrowed by §9's pacing model**:
what arithmetic can settle is settled before kid-testing, and kid-testing keeps only
the questions children alone can answer. The reference shift is **no longer** on this
list — §9's model derives it.

- `shopRunningCost`'s curve shape and per-entry weights — **checked against the
  compounding case (capacity × quantity-margin), not the base case**
- The two margin multipliers and the two entry costs
- Which competency each margin gates on, and its threshold. Proposed, not
  decided: accuracy margin ← `money` (change-making is where precision with
  money lives, the pattern `register` already uses); quantity margin ← `math`
  (counting volume, the pattern `customers` already uses)
- `sign`'s cost, if 30 zł stops being right once it gates a branch — note
  `prd-v3.md:62`'s loop signal, "a first purchase within ~3 shifts"
- How many decorations per world, and their price curve — whether the price rises
  within a world (an intra-world sink) or stays flat, with the cross-world renewal
  carrying the whole job
- Decoration slot positions per world, or the corner-row fallback for the first batch
- `DOMINANCE_FLOOR` — first guess **0.6**; a *policy* number (how much asymmetry
  still counts as a choice), which the pacing model measures against but does not
  itself decide

## Follow-on

- **W1 `six-worlds-catalogue`** — 6 × ≤8 vocabulary entries **plus 6 × N decoration
  sets**. A sibling of this tranche, not a prerequisite: the copy fallback lets
  worlds be named incrementally and the corner-row fallback lets decorations ship
  one at a time. **Its world art is already done** **[V]** — `WORLDS` holds 4
  entries but all six `world-*.webp` are committed and recorded in `slice-map.md`.
  Three art debts remain to price in: decoration art (**zero** assets exist,
  §2a), per-world *upgrade* art (the six `upgrade-*.svg` are world-neutral), and
  per-stage world art for **zero** worlds **[V]** `src/data/stages.ts:17–31`, which
  documents the upgrade path. None blocks anything here.
- **B2 `pricing-and-inventory`** — unblocked by neither this tranche nor W1. It
  needs P2's task types first.
- **Revenue/cost columns on `shift_log`** — would let the weekly parent report
  show the profit breakdown over a week rather than a payout total. Deliberately
  out of scope; `earned` alone keeps the report correct today.
- **Per-world economies** — if telemetry ever argues for them, `purchasedMeta`
  is the attribution data that change needs. Note that §2a's decoration sets are
  *not* a step toward this: they carry no economic effect, so they differentiate
  worlds without ranking them.
