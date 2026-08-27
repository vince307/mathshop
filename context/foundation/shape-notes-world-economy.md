---
project: "MathShop — world expansion + purchase catalogue + virtual economy"
context_type: brownfield
scope: tranche
governing_prd: context/foundation/prd-v3.md
created: 2026-08-26
updated: 2026-08-27
status: shaping-complete — design approved decision-by-decision; next artifact is the tranche spec
skill: 10x-shape (scoped to this file — see D-2)
consumed_by: docs/superpowers/specs/ -> backlog.md ## Ready -> /10x-autonomous-run
---

# World expansion + purchase catalogue + virtual economy — brainstorm notes

**Shaping is complete.** Opened 2026-08-26, closed 2026-08-27.

The framing below (verified baseline, PRD constraints, the four-layer
decomposition, D-1) came out of one `superpowers:brainstorming` session. **D-2
moved this work onto the 10x chain**, and the `/10x-shape` discovery loop then ran
to the end, scoped to this file: D-3 through D-10 close every question the `##
Open` section raised. Each was put to the user as a decision and answered by them;
none was inferred.

**Next artifact:** `docs/superpowers/specs/2026-08-27-world-economy-design.md`,
sibling of `2026-08-24-adaptive-task-engine-design.md`. It transcribes D-3–D-10;
it does not re-open them. Then `## Ready` entries in
`context/foundation/backlog.md`, then `/10x-autonomous-run`.

Read `## The design in one place` for the result; the D-numbered sections carry
the reasoning and the rejected alternatives.

## Current system — [V] verified 2026-08-26

### A world is a picture

`src/data/worlds.ts`: `World = { slug, name, image }`. That is the whole model.
A world resolves which illustration the start screen renders and nothing else —
it does not touch tasks, the upgrade catalogue, or the economy. `slug` is stored
in `child_profiles.theme`; the DB default `'default'` falls back to `kawiarnia`.

Four exist — `kawiarnia`, `piekarnia`, `galaktyczna-baza`, `sklep-ksiegarnia`.
PRD v3 assumes **six** (backlog W1). The gap is art plus per-world copy —
**priced by D-3 and D-10** as 6 worlds × ≤8 catalogue entries of vocabulary, with
a mandatory fallback so an unnamed world still renders.

### Six things to buy, one shared catalogue, one effect

`src/data/upgrades.ts` — `sign` (30 zł), `shelf` (60), `register` (100),
`slot` (150), `storage` (210), `customers` (300). The file states plainly that a
single shared catalogue is v1 and that **per-world catalogues are the multi-world
tranche**.

The only functional effect is `extraTasks` (capacity), capped by
`MAX_BONUS_TASKS = 5`. `sign` is `extraTasks: 0` — purely visual. Gates today:
`requiredWorldLevel` on all, plus `requiredSkill { money, 1 }` on `register` and
`requiredTaskHistory { math, 8 }` on `customers` — **2 of 6**.

### The economy is one equation

```
earningsForShift = EARN_PER_TASK (5) * taskCount + EARN_PER_CLEAN (3) * cleanCount
SHIFTS_PER_LEVEL = 3     // business_level advances on a shift counter, nothing else
```

So the entire loop today is: buy capacity → longer shift → more money → buy more
capacity.

### The elegance that is at stake

Because capacity is the only purchasable effect, **the only thing money can buy
is more mathematics**. Spending literally *is* the reward for practising, and
there is no shortcut around it. Every catalogue expansion either preserves that
property or breaks it. That was the first question put to the user.

## Binding constraints — PRD v3 §Non-Goals

- **"No monetization mechanic — ever. No ads, purchases, paywall, or premium
  tier. Identity, not a deferred feature."** "Virtual monetization" in this
  brainstorm means the in-game funds economy (FR-007/FR-008, already shipped).
  Real money is out, permanently, and re-opening it is a PRD decision — not a
  feature to design.
- **No casino mechanics** — no lootboxes, random/chance unlocks, timers, streak
  pressure, urgency or scarcity messaging, rankings, child-vs-child comparison.
  This rules out most conventional economy levers (limited offers, sales, FOMO).
- **Spending never regresses competence** — only the spendable balance moves.
- **Growth must reinforce the math** — "every upgrade is tied to a concrete skill
  or task history; a mechanic that doesn't strengthen 'the math had a point' is
  simplified or deferred."

## Decomposition — four nested layers, not four parallel tasks

1. **What a world IS, mechanically.** Today: a picture. Can stay cosmetic (then
   "six worlds" is art + copy, cheap) or start differentiating catalogue/economy
   (expensive). A separate axis from 2–4.
2. **The purchase catalogue** — how many entries, and what *kinds* of effect.
3. **The profit rule** — how an effect turns into earnings. One term today.
4. **The economy as a whole** — what the currency is for, what absorbs it, where
   the tension in choosing comes from.

**4 governs 3, 3 governs 2.** Layer 1 is orthogonal and can be priced separately.

## Decisions taken

### D-1 (2026-08-26) — multipliers are allowed, every one skill-gated

The user chose **option B with the clamp**: a purchasable may raise earnings per
task (better price, regular customer, brand) **without** adding practice — but

- **a multiplier never replaces practice, it only re-prices it**, and
- **every multiplier carries a skill gate**, the way `register` already carries
  `requiredSkill { money, level 1 }`.

Rationale: a rich catalogue becomes possible immediately instead of waiting on
P2 (parked pending telemetry), and a real decision tension appears — capacity vs
margin. The gate is what keeps it inside the PRD: "better margin" reads as a
reward *for* fluency with money, not a way around it.

Rejected: option A (every effect must add practice), because the new *kinds* of
practice it needs are exactly P2, which is parked.

### D-2 (2026-08-26) — the 10x chain, targeting an autonomous run

Process decision. This work is developed with the **10x skills**, not
`superpowers:brainstorming`, and it is aimed at `/10x-autonomous-run`:

```
/10x-shape  (scoped to THIS file, not the canonical shape-notes.md)
   → tranche spec in docs/superpowers/specs/
   → ## Ready entries in context/foundation/backlog.md
   → /10x-autonomous-run
```

**Why a tranche spec and not a `prd-v4`.** This is the path the adaptive task
engine took — a feature with a new table, an RLS contract and a new difficulty
model shipped as `docs/superpowers/specs/2026-08-24-adaptive-task-engine-design.md`
→ `/10x-new` → `/10x-plan`, with no new PRD. `prd-v3.md` stays the governing
document and takes no churn. A full `/10x-prd` → `prd-v4` re-baseline was
considered and rejected as heavier than this tranche needs; revisit only if the
earnings-rule change turns out to invalidate v3's economy FRs outright.

**Why scoped and not canonical.** `/10x-shape` gates on
`context/foundation/shape-notes.md`, which holds the completed v3 re-baseline
session (phase 8, accepted) and is the source of `prd-v3.md`. Writing here keeps
it untouched. The cost is that `/10x-prd` will not auto-route to this file — which
is fine, because D-2 does not route to `/10x-prd` at all.

### D-3 (2026-08-27) — a world is a skin over one shared mechanical spine

Layer 1 locked to **skin-deep differentiation**. A world supplies *identity* —
its name, its art, and its own vocabulary for every catalogue entry — and
nothing mechanical. One shared catalogue: the same ids, the same costs, the same
effects, the same gates, in every world. A `register` bought in the galactic base
is the same purchase as a `register` bought in the bakery; only the word and the
picture change.

**What this settles, verified against the code:**

- `shop_state.purchased` stays a flat global list. **No migration.** **[V]**
  `src/types.ts:98–107`.
- `src/i18n/pl.ts:204–205` — *"Każdy świat uczy tych samych umiejętności"* /
  *"Twój sklep i kupione ulepszenia przenoszą się do nowego świata"* — stays
  **literally true** and is not rewritten. **[V]** Rendered by
  `WorldPicker.tsx:76,78`.
- `purchasedMeta` stays write-only, exactly as `src/types.ts` describes it. It is
  now the **escape hatch** if per-world economies are ever revisited — not
  something this tranche builds. **[V]** written at `child-profiles.ts:352`.
- The D-1 catalogue (capacity vs margin) is designed **once** and is identical
  everywhere. Layer 1 therefore stops being a blocker on layers 2–4: they can be
  designed without knowing how many worlds exist.

**What it costs, and the coupling the backlog does not record:**

The catalogue keeps carrying no literal copy (L-003) — but resolution moves from
`t.upgrades[id]` to a per-world lookup that **falls back to `t.upgrades[id]`**.
That fallback is load-bearing: a world that has not yet been given its own
vocabulary still renders, with world-neutral names. Without it, every new
catalogue entry would block on six translations before it could ship.

Consequence for **backlog W1**: it stays a copy/art task, **not** an economy
task — but it is larger than the backlog's **[I]** claim of "art plus per-world
copy". The copy cost is `worlds × catalogue entries`, so **W1 is coupled to layer
2's catalogue size**, and the two must be sequenced (catalogue first, or W1 ships
against the current six entries and grows later via the fallback).

Two pieces of art debt are in scope for whoever picks this up, both **[V]**:
per-world *upgrade* art does not exist (the six `upgrade-*.svg` are world-neutral,
`src/data/upgrades.ts`), and per-stage world art exists for **zero** of the
worlds (`src/data/stages.ts:17–31`, which documents the upgrade path). Neither
blocks D-3 — the `art?` override is optional by construction — but neither should
be discovered during planning.

**Shape:**

```ts
World = { slug, name, image, art?: Record<UpgradeId, string> }
// copy: t.worlds[slug].upgrades[id] ?? t.upgrades[id]   ← fallback is mandatory
// upgrades.ts: unchanged. shop_state: unchanged. No migration.
```

Rejected: **cosmetic** (a world stays a bare picture), because then six worlds add
nothing a child can feel and the choice is a wallpaper choice. Rejected:
**economic differentiation** (per-world catalogues / prices), because an
economically better world is a mechanically better world — which is exactly what
`WorldPicker` promises does not happen — and switching worlds would start to read
as a restart, brushing against the PRD's ban on pressure mechanics. The
`purchasedMeta` attribution data keeps that door open if telemetry ever argues
for it.

### D-4 (2026-08-27) — four effect types, and no purely decorative entry

Layer 2's vocabulary is locked. A catalogue entry may have exactly these effects:

| Effect | Status | Touches |
|---|---|---|
| **capacity** (`extraTasks`) | exists, kept | shift length → both earnings terms |
| **accuracy margin** | new | `EARN_PER_CLEAN` (3 zł, paid per miss-free task) |
| **quantity margin** | new | `EARN_PER_TASK` (5 zł, paid per completed task) |
| **unlock** | new | catalogue visibility — no earnings effect |

**Rejected: the purely decorative entry** (an entry with zero economic effect).
Every entry must do something. Three consequences follow, and none of them is
optional to resolve.

**1. The profit rule now compounds, and layer 3 must clamp it.** With both
margins selected *alongside* capacity:

```
earnings = (EARN_PER_TASK  × quantityMargin) × taskCount
         + (EARN_PER_CLEAN × accuracyMargin) × cleanCount
```

`taskCount` is itself raised by capacity. So **capacity × quantity-margin is
multiplicative** — a child who buys along both branches grows faster than either
branch alone, and `MAX_BONUS_TASKS = 5` clamps only one of the two factors. **[V]**
`src/data/shift.ts:22–47`. This is not a tuning detail: without a second clamp the
economy runs away, and it is now the *first* question of layer 3 rather than an
afterthought. It is also the mechanical form of D-1's "capacity vs margin"
tension — the tension only exists if neither branch strictly dominates.

**2. `sign` becomes an anomaly that must be resolved.** **[V]**
`src/data/upgrades.ts` — `sign` costs 30 zł with `extraTasks: 0`: the only purely
visual entry, and the *cheapest* one, therefore the first purchase most children
make. D-4 says every entry has an effect, so `sign` must either gain one, be
re-cast (re-casting it as an **unlock** reads naturally — a shop sign that opens
the "marka" branch), or be removed. It cannot be left as it is. Note the coupling
to D-3: `sign` is also the most world-flavoured entry in the catalogue, so
whatever happens to it, it happens six times in copy.

**3. "What absorbs funds late-game" just lost its easiest answer.** Decoration was
the one lever that soaks currency *without* touching the profit rule. All four
surviving effect types **increase earning power**, so every purchase makes the
next purchase easier — that is a runaway, not a sink. Layer 4 must now answer the
sink question from a strictly smaller set of levers, with casino mechanics and
scarcity messaging already banned by the PRD. This is now the hardest open
question in the tranche.

**Unresolved, carried forward:**

- **Accuracy margin and the child who makes mistakes.** The accuracy term pays
  only for miss-free tasks, so a margin on it returns less to exactly the child
  who is still learning. Whether that reads as "reward for precision" or as
  "punishment for being a beginner" is a kid-testing question, not an armchair
  one. Flag it in the spec; do not tune it blind.
- **Unlock branches must be non-exclusive** — *proposed constraint, not yet
  decided.* If buying A permanently forecloses B, a purchase becomes a wrong
  choice a child cannot undo, and the PRD bans pressure mechanics. The cheap form
  that stays inside the rules: a branch gates **visibility and order**, never
  availability. Confirm before the spec is written.

### D-5 (2026-08-27) — the sink is a running cost: profit = revenue − cost

Layer 4 is answered. A shift has a **cost of doing business**, subtracted from
that shift's revenue before anything reaches the wallet:

```
revenue = (EARN_PER_TASK  × quantityMargin) × taskCount
        + (EARN_PER_CLEAN × accuracyMargin) × cleanCount
cost    = SHIFT_COST(businessLevel)          // rises as the shop grows
profit  = max(0, revenue − cost)
wallet += profit
```

Chosen over a terminating economy (finite catalogue, rising tiers) and over
world/stage-as-purchase. It is the only available lever that adds a **second
arithmetic operation** — subtraction — to the economy, and it is literally the
"profit rule" this tranche is named after. The results screen stops showing one
number and starts showing three: *przychód · koszt · zysk*. That display **is**
the lesson, and it is the entrepreneurship framing PRD v3 demands rather than a
decoration on top of it.

**Two guardrails, both load-bearing rather than stylistic:**

1. **The cost accrues per shift, never over wall-clock time.** A cost that ticks
   while the child is away is a timer, and timers are banned by PRD v3
   §Non-Goals. There is no scheduled job, no "since last login" arithmetic.
2. **`profit` is clamped at zero.** A shift is never net-negative.

#### It clears FR-008 — but only because of those guardrails **[V]**

`prd-v3.md:102`, FR-008 `[new]`: *"Funds accumulate across shifts and are **never
reduced except by a deliberate upgrade purchase**; the balance is shown as a
wallet, framed so that spending reads as acquiring a permanent upgrade, not
losing coins."*

The cost applies to a **shift's revenue**, not to the **wallet balance**. With
`profit ≥ 0`, the wallet is monotonically non-decreasing outside a purchase, so
FR-008 holds by the letter and by its intent. **This dictates the
implementation**: the cost must never be modelled as a wallet debit. `wallet -=
rent` breaks FR-008; `wallet += max(0, revenue − cost)` does not. A reviewer who
sees a debit should reject it on FR-008 grounds, not on taste.

The same reading answers **prd-v3.md:180, risk 5** — *"the risk that a 6-year-old
reads a dropping balance as losing progress"*. Under D-5 the balance never drops
outside a purchase; only the per-shift breakdown shows a subtraction, and it
shows it on money the child has not yet banked.

**Therefore D-2's `prd-v4` trigger is NOT fired.** D-2 said to revisit the PRD
"only if the earnings-rule change turns out to invalidate v3's economy FRs
outright". It does not. `prd-v3.md` stays governing and takes no churn.

#### Two things the notes had not recorded **[V]**

- **FR-010 bounds the catalogue at 5–8 entries** (`prd-v3.md:106` — *"a small
  upgrade catalog (5–8 upgrades)"*). There are **6** today. Layer 2 therefore has
  room for at most **two more entries**, not an open-ended expansion — and that
  bound, multiplied by D-3's per-world vocabulary, is what actually prices W1:
  6 worlds × ≤8 entries.
- **FR-010 says "the world defines a small upgrade catalog"** — wording that
  reads as per-world catalogues, which D-3 declined. The reconciliation, recorded
  here so nobody re-litigates it later: under D-3 *"the world defines"* is
  satisfied by **identity** (each world names and pictures the catalogue as its
  own), while the mechanical spine stays shared. Nothing in FR-010's stated
  requirements — cost, world level, skill progress, task history, "no random
  unlocks" — is per-world.
- **The margins go one step beyond FR-012's letter.** `prd-v3.md:108` enumerates
  a purchase's functional effect as *"new product, task type, or capacity"*.
  D-4's `capacity` and `unlock` sit inside that list; the two **margins do not**.
  This is an extension, not a contradiction — FR-012 constrains what a purchase
  *does*, and a margin is a new kind of functional effect rather than an absence
  of one. Flagged deliberately: it is the single place this tranche exceeds v3's
  enumeration, and the spec should say so out loud.

#### Consequences to carry into the spec

- **`SHIFT_COST(businessLevel)` is also the runaway clamp D-4 §1 asked for.**
  A cost that rises with the shop is a brake on compounding that needs no second
  mechanism. Layer 3's job shrinks from "invent a clamp" to "choose the curve" —
  and the curve must be checked against the compounding case (capacity ×
  quantity-margin), not against the base case.
- **`earningsForShift` is imported by both sides** — the client celebration and
  the authoritative `/api/shifts/complete` write — *"so both sides agree by
  construction"* **[V]** `src/data/shift.ts:1–6`. The new term lands in one pure,
  tested function and both surfaces follow. No migration.
- **Telemetry recorded before this change is gross, not net.** The harness's 784
  rows (backlog, 2026-08-26) were produced under the current rule. Whether
  anything stored is now ambiguous between revenue and profit must be checked
  when the spec is written — this matters to P2's un-parking baseline.
- **The results screen gains two numbers**, so it is a UI change with a mockup
  implication (`assets/matmaverse-missing-screens-v3-*/03-mission-result-*`), and
  three new Polish strings. `assets/` is local-only.

### D-6 (2026-08-27) — cost is a function of what you own, under a no-trap invariant

```
cost = SHIFT_COST(purchased)      // a bigger shop is more expensive to run
```

Chosen over `f(businessLevel)` and over a flat constant. It is the only shape
where **the brake is paid by whoever compounds**: a child buying along both the
capacity and the margin branch raises their own cost, so D-4 §1's runaway is
damped by the same mechanism that creates it, with no second cap invented. It is
also the honest entrepreneurial reading — a larger business costs more to run.

The price is a hard invariant, which is now part of the design and not a test
detail:

> **No-trap invariant.** For every unowned entry `u`, buying `u` must **strictly
> increase** steady-state profit:
> `∀ u ∉ purchased : profit(purchased ∪ {u}) > profit(purchased)`

Without it, `f(purchased)` can produce an upgrade that costs more to run than it
earns — a purchase that makes the child's situation worse. That is worse than an
unbraked economy: an unbraked economy is merely too easy, a trap purchase
punishes a child for engaging with the one decision the whole product is built
around (FR-011/FR-012), and it cannot be undone.

#### The invariant needs a canonical evaluation point

`profit` is not a single number — it depends on the shift, and shift length
depends on per-competency difficulty `d`. **[V]** `src/data/shift.ts:56–80`
(`lengthDifficulty`, `shiftLength(difficulty, bonus)`). So the invariant is
meaningless until "steady-state profit" is pinned to a reference shift. The spec
must define it; the obvious candidate is the expected shift at difficulty `d`
with a fixed accuracy assumption, and it must then hold **for all `d ∈ [0,1]`**,
not at one convenient point.

#### It is exhaustively checkable — cheaper than it looks

FR-010 bounds the catalogue at **5–8 entries** (`prd-v3.md:106`), so `purchased`
has at most **2⁸ = 256** states. A full sweep of every subset × a grid over
`d ∈ [0,1]` is small enough to run as an ordinary property test — no sampling, no
flakiness. This is the same technique already used in the repo: **[V]**
`src/data/shift.ts:22–32` describes "the sweep in `tests/adaptive.test.ts`" that
fails if the length curve outgrows `MAX_SHIFT_TASKS`, and `src/data/stages.ts:15`
locks stage monotonicity/reachability in `tests/stages.test.ts`. The no-trap
invariant belongs in exactly that family, and any backlog entry carrying D-6 must
name it as a deliverable rather than leaving it to a planner.

#### This closes D-4 §2 by derivation, not by opinion

Under D-6, an entry with **no effect** raises `cost` and returns nothing — it
*violates the no-trap invariant by construction*. So `sign` (30 zł,
`extraTasks: 0`, **[V]** `src/data/upgrades.ts`) can no longer stay as it is, and
this is now forced rather than a matter of taste. It must acquire an effect. It
is still open **which** effect — see Open.

#### What D-6 does not do

`f(purchased)` does not brake `business_level`, which still advances on a bare
shift counter (`SHIFTS_PER_LEVEL = 3`, **[V]** `src/data/shift.ts:48`). A child
who buys nothing pays no cost and still levels. Whether that is a hole or the
correct floor is the remaining open question about `SHIFTS_PER_LEVEL`.

### D-7 (2026-08-27) — `sign` becomes the unlock that opens the "marka" branch

`sign` earns nothing by itself; it opens access to the margin entries. Chosen
over giving it a margin, giving it capacity, and deleting it.

The reasoning that decided it: `sign` is the **cheapest** entry (30 zł), so
essentially every child buys it and buys it first. A universal effect is not a
decision — a universal margin is just a different value of `EARN_PER_TASK`. A
universal **gateway**, on the other hand, makes the first 30 zł a choice of
*direction*, so D-1's capacity-vs-margin tension starts at the first purchase
rather than the second. It also satisfies FR-012 (`prd-v3.md:108`) with both
halves literally: a sign is a **visible** change and now carries a **functional**
unlock. And it aligns with D-3 — the sign is the most world-flavoured entry in
the catalogue, so it is the right thing to be the world's own gesture.

It also satisfies D-4's proposed non-exclusivity constraint by construction:
buying `sign` opens the margin branch without foreclosing capacity.

#### The catalogue budget — derived, needs confirming before the spec

FR-010 caps the catalogue at **5–8 entries** (`prd-v3.md:106`) and there are **6**
today, so there are exactly **two free slots**. Two verified facts make the
composition almost forced:

- **[V]** `src/data/upgrades.ts` — five entries (`shelf`, `register`, `slot`,
  `storage`, `customers`) each carry `extraTasks: 1`.
- **[V]** `src/data/upgrades.ts` — `MAX_BONUS_TASKS = 5`.

So the five capacity entries sum to **exactly** the cap: owning all of them wastes
nothing, and adding a sixth capacity entry would create a purchase with no
effect — the D-6 trap, re-entering by the back door. Capacity is therefore
**full**. The two free slots must be the two margin entries, which is exactly what
D-4 introduced:

```
8 = 1 unlock (sign)  +  5 capacity (existing)  +  2 margin (new: accuracy, quantity)
```

Both margin entries sit behind `sign`, which is the "marka" branch. This is the
only composition that fits FR-010, keeps capacity at its cap without waste, and
gives each of D-4's four effect types a home. **Derived here, not chosen by the
user — confirm before writing the spec.**

Consequence worth stating plainly: the catalogue does **not** grow in entry count.
It grows in *kinds*. Anyone reading backlog W1's "the gap is art plus per-world
copy" should now read it as **6 worlds × 8 entries of vocabulary**, and no more
than 8.

### D-8 (2026-08-27) — each margin is gated by the thing it pays for

D-1 required a skill gate on every margin. The keying:

| Entry | Gate | Mechanism |
|---|---|---|
| accuracy margin | first-try-correct level | `requiredSkill { competency, level }` |
| quantity margin | completed task count | `requiredTaskHistory { competency, count }` |

Precision opens the bonus for precision; practised volume opens the per-task
bonus. The gate and the reward describe the same ability, so the branch is legible
to a child and — via FR-016's weekly parent report — to a parent.

**No new gating machinery.** Both mechanisms already exist and `canBuy` already
evaluates them, in a fixed order: unknown id → owned → world level → skill →
task history → affordability, with the explicit property that *"an owned upgrade
is NEVER retro-locked by a later rung"*. **[V]** `src/data/upgrades.ts` (`canBuy`).
`skillLevel` counts passed thresholds `[3, 8, 15, 25, 40]` over `firstTryCorrect`
**[V]** `src/data/skills.ts:34–39`.

**Both measures are monotone** — `firstTryCorrect` and `completed` only ever
increase. An entry that becomes reachable stays reachable. This is why per-competency
difficulty `d` was rejected as a gate: `d` moves **down** as well as up
(`src/data/adaptive.ts`), so a `d`-gate would withdraw an unbought upgrade from a
child who had a worse day — visible yesterday, gone today. `canBuy`'s retro-lock
protection covers *owned* entries only. That is a punishment for struggling, and
PRD v3 bans pressure mechanics.

**This deepens FR-015.** `prd-v3.md:115` makes skill progress *load-bearing*
because upgrade requirements reference it. Today **2 of 6** entries carry an S-07
gate (`register`, `customers`) **[V]** `src/data/upgrades.ts`. Under D-7's
composition it becomes **4 of 8** — half the catalogue — without inventing a
mechanism.

**Left to the spec (repo convention: "first-guess defaults, adjust after
kid-testing"):** which competency each margin keys to, and the threshold numbers.
The natural mapping, proposed not decided: accuracy margin ← `money` (change-making
is where precision with money lives, and it is the pattern `register` already
uses), quantity margin ← `math` (counting volume, the pattern `customers`
already uses).

### D-9 (2026-08-27) — `SHIFTS_PER_LEVEL = 3` stays; it is the floor, not a gap

No change. **[V]** `src/data/shift.ts:303–305` — `businessLevelForShifts(n) =
1 + floor(n / SHIFTS_PER_LEVEL)`, uncapped, and `requiredWorldLevel` sits on
every catalogue entry.

The notes opened this question as a suspected weakness: level advances on a bare
shift counter while everything else is earned. After D-5–D-8 that inverts. The
gates now are:

| Gate | Nature |
|---|---|
| `SHIFT_COST(purchased)` (D-6) | earned |
| `requiredSkill` (D-8) | earned |
| `requiredTaskHistory` (D-8) | earned |
| `requiredWorldLevel` | **time** — the only one |

`requiredWorldLevel` is therefore the **only guarantee that a slower child
eventually sees the whole catalogue**. Making it earned too would close every
gate in the game behind merit at once, and a child who earns less would never
open the rest of the catalogue — permanently stuck, which is the punishment shape
the PRD rules out. Rejected for that reason: keying level on cumulative profit,
and the shifts-OR-profit hybrid (which hands a third consecutive advantage to the
child who already compounds, working against D-6's brake).

The uncapped formula also already has a documented reason to stay uncapped:
**[V]** `src/data/stages.ts:10–13` — capping it "would make `recordShiftResult`'s
`leveledUp` flag permanently false and silence the level-up celebration forever";
saturation happens in `stageForLevel` at the presentation layer instead.

Cost of this decision: zero work.

### D-10 (2026-08-27) — the two derived constraints, confirmed

Both were derived rather than chosen, and were put back to the user explicitly.
Both confirmed; they enter the spec as settled.

1. **Unlocks are non-exclusive.** Buying A never permanently forecloses B. A
   branch governs **visibility and order**, never availability. Anything else
   makes a purchase an un-undoable wrong choice, which is pressure by another
   name (PRD v3 §Non-Goals). Note that D-7 already satisfies this: `sign` opens
   the margin branch without closing capacity.
2. **The catalogue budget is `8 = 1 unlock + 5 capacity + 2 margin`.** The only
   composition that fits FR-010's 5–8 bound while capacity's five entries sum to
   exactly `MAX_BONUS_TASKS = 5`. **The catalogue does not grow in entry count —
   it grows in kinds of effect.**

Consequence for **backlog W1**, which should be corrected there: its **[I]** claim
that "the gap is art plus per-world copy" now has a number. It is **6 worlds × 8
entries** of vocabulary, bounded above by FR-010, with a mandatory fallback to
`t.upgrades[id]` (D-3) so a world without its own vocabulary still renders.

### What `/10x-autonomous-run` requires — [V] read from the skill, 2026-08-26

The run's intake is `context/foundation/backlog.md` § `## Ready`, and it
**refuses anything under `## Needs shaping` or `## Parked`** — "a run would invent
the product content that is deliberately missing". So the whole job of this
brainstorm, mechanically, is to turn its output into entries that clear the
backlog's own bar: *"an outsider could take this entry to `/10x-new` today"*,
each carrying an id, a value/cost line, a migration answer, `[V]`/`[I]`-tagged
claims, and the open decision a planner would otherwise invent.

Preflight the run also demands (Step 0–1): a clean tree, no stale worktrees, a
green baseline (`lint`, `check`, `test`, `playwright`) measured on the base
branch, Supabase up, no stray dev server, and
`.claude/skills/10x-autonomous-run/scripts/validate-rule-files.sh` green — last
run 2026-08-26: **PASS, 77 paths, 0 missing**.

## Open — closed 2026-08-27

**Every question this section opened has been answered.** Kept as an audit trail
of what was asked and where the answer lives.

| Question | Answer |
|---|---|
| Layer 1 — cosmetic or differentiating? | **D-3** — skin-deep: shared spine, per-world identity |
| Layer 2 — what effect types exist? | **D-4** — capacity, accuracy margin, quantity margin, unlock; no decorative entry |
| Layer 4 — what absorbs funds? | **D-5** — a per-shift running cost; `profit = max(0, revenue − cost)` |
| Layer 3 — what shape is the clamp? | **D-6** — `SHIFT_COST(purchased)`, under a no-trap invariant |
| What effect does `sign` get? | **D-7** — an unlock opening the "marka" branch |
| What is a margin gate keyed to? | **D-8** — each margin gated by what it pays for; `d` rejected |
| Does `SHIFTS_PER_LEVEL = 3` survive? | **D-9** — yes, unchanged; it is the access floor |
| Non-exclusive unlocks? Catalogue budget? | **D-10** — both confirmed |

**B2 `pricing-and-inventory` is NOT absorbed** (established under D-4). **[V]**
`src/types.ts:113–120` puts `set-price` / `manage-stock` and the `inventory` /
`profit` competencies out of scope until those task types exist; new task types
are P2, which is parked. B2 stays a separate tranche and B5 stays blocked on it.

## The design in one place

```
revenue = (EARN_PER_TASK  × quantityMargin) × taskCount      // D-4
        + (EARN_PER_CLEAN × accuracyMargin) × cleanCount     // D-4
cost    = SHIFT_COST(purchased)                              // D-5, D-6
profit  = max(0, revenue − cost)                             // D-5
wallet += profit                                             // never a debit — FR-008
```

Catalogue — **8 entries, and no more** (FR-010, D-10):

| # | Kind | Entries | Gate |
|---|---|---|---|
| 1 | unlock | `sign` (30 zł) | world level only |
| 5 | capacity | `shelf`, `register`, `slot`, `storage`, `customers` | world level; 2 carry S-07 gates today |
| 2 | margin | accuracy, quantity — **new**, behind `sign` | `requiredSkill` / `requiredTaskHistory` (D-8) |

A world supplies name, art and vocabulary for all 8; mechanics are shared, and
copy falls back to `t.upgrades[id]` (D-3).

**No migration.** `shop_state.purchased` stays a flat global list; the new terms
live in `src/data/shift.ts` and `src/data/upgrades.ts`, both pure and imported by
client and server alike.

**Invariants for the spec to carry as deliverables:**

- **No-trap:** `∀ u ∉ purchased : profit(purchased ∪ {u}) > profit(purchased)`,
  swept over every subset (≤2⁸) × a grid of `d ∈ [0,1]`. Same family as the
  sweeps already in `tests/adaptive.test.ts` and `tests/stages.test.ts`.
- **Wallet monotonicity:** the wallet never decreases outside a deliberate
  purchase (FR-008). The cost is never a debit.
- **No re-locking:** every gate is monotone, so a reachable entry stays reachable.
- **Non-exclusive branches:** visibility and order, never availability.

## Quality cross-check — 2026-08-27

Run against `/10x-shape`'s brownfield bar, adapted: this is a **scoped tranche**
whose handoff is a spec in `docs/superpowers/specs/`, not `/10x-prd` (D-2).

| Element | Status |
|---|---|
| Access control | **present — no change.** No new table, no new route, no RLS surface. `shop_state` is existing jsonb on `child_profiles`; per-account isolation is untouched. |
| Business logic (one sentence) | **present.** *A shift's profit is its revenue minus the cost of running the shop, and every purchasable effect is gated by the ability it pays for.* |
| Project artifacts | present — this file. |
| Timeline-cost acknowledged | **absent — deliberately.** The tranche is aimed at `/10x-autonomous-run` (D-2), which is unattended, so an after-hours week estimate is not the governing frame. Recorded as a known gap rather than a silent one. |
| Non-Goals | **present.** PRD v3 §Non-Goals inherited verbatim, plus the rejections recorded inside D-3 through D-9 (per-world economies, decorative entries, a terminating economy, world-as-purchase, `d`-keyed gates, profit-keyed levels). |
| Preserved behaviour | **present and load-bearing.** FR-008 wallet monotonicity; `pl.ts:204–205` world-carry-over copy stays literally true; `canBuy`'s no-retro-lock property; `MAX_SHIFT_TASKS = 17`; no migration. |

Status: **accepted with one recorded gap** (timeline).

## Related, and deliberately not merged in

- **P2 (curriculum / new task types) is parked** pending real telemetry —
  `context/foundation/shape-notes-p2-curriculum.md`. D-1 was chosen partly to
  avoid depending on it.
- **Backlog B2 `pricing-and-inventory`** overlaps layers 2–3 heavily and is
  marked "the largest entry in this backlog"; it introduces a *product* entity,
  which does not exist in the codebase. Check it before designing layer 2 —
  `context/foundation/backlog.md`.
- **Backlog B5 `product-unlocked-screen`** is blocked on B2.
- **Backlog W1 `six-worlds-catalogue`** is layer 1.
