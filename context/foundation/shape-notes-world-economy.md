---
project: "MathShop — world expansion + purchase catalogue + virtual economy"
context_type: brownfield
scope: tranche
governing_prd: context/foundation/prd-v3.md
created: 2026-08-26
updated: 2026-08-27
status: shaping-complete — D-1…D-10 closed 2026-08-27, reopened the same day for a game-economy literature benchmark and closed again at D-13; spec + backlog E1/W1 propagated 2026-08-27
skill: 10x-shape (scoped to this file — see D-2)
consumed_by: docs/superpowers/specs/ -> backlog.md ## Ready -> /10x-autonomous-run
---

# World expansion + purchase catalogue + virtual economy — brainstorm notes

**Shaping is complete for D-1…D-10, and was deliberately reopened on 2026-08-27**
for a benchmark against the professional game-economy literature. That benchmark
confirmed the structure and found three gaps it did not cover; **D-11** answers
the first. Opened 2026-08-26, closed 2026-08-27, reopened 2026-08-27.

The framing below (verified baseline, PRD constraints, the four-layer
decomposition, D-1) came out of one `superpowers:brainstorming` session. **D-2
moved this work onto the 10x chain**, and the `/10x-shape` discovery loop then ran
to the end, scoped to this file: D-3 through D-10 close every question the `##
Open` section raised. Each was put to the user as a decision and answered by them;
none was inferred.

**Next artifact:** `docs/superpowers/specs/2026-08-27-world-economy-design.md`,
sibling of `2026-08-24-adaptive-task-engine-design.md`. It transcribes D-3–D-10;
it does not re-open them. **It predates D-11 and does not yet carry it** — the
exact propagation is tabulated at the end of D-11. Then `## Ready` entries in
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

> **Superseded in part, 2026-08-27.** The "art" half of that gap is closed: all
> six `world-*.webp` files are committed under `public/illustrations/` and
> recorded in `slice-map.md`. **[V]** W1 is a data + copy task. See D-11.

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

> **Narrowed by D-11 (2026-08-27).** The domain is now the **investment** subset:
> `shopRunningCost(investment ⊆ purchased)`. Everything below still holds — D-11
> narrows what `cost` is a function of, and adds the no-harm clause that keeps
> zero-effect entries out of the invariant.

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

### D-11 (2026-08-27) — the running cost is keyed on *investment* purchases; decorations are the wallet's renewable sink

**Why this section exists after "shaping is complete".** D-1…D-10 were
deliberately benchmarked against the professional game-economy literature
(Adams & Dormans, *Game Mechanics: Advanced Game Design*, 2012 — the source of
the Machinations model; Daniel Cook, *Value chains*; room8studio's five steps;
Unity's economy guides; Alex Wiserax, *I Designed Economies for $150M Games*,
2024 — a practitioner handbook drawing on Schreiber & Romero's *Game Balance*). **The benchmark confirmed the structure.** Every
mechanism this session invented from scratch has a standard name: `revenue` is a
**source/faucet**, `shopRunningCost` is an **upkeep sink**, a purchase is a
**converter**, `wallet` is a **stock**, capacity × quantity-margin is a
**positive feedback loop**, and D-6's ownership-keyed cost is the textbook
**negative feedback loop** — matched to that positive loop in speed and
durability, which is the stable configuration. The no-trap invariant has no
standard name: formalising "no dominated purchase" as an exhaustively-swept
invariant is *above* the industry norm rather than below it. Roughly 80% of that
literature is unusable here, because it is written for hard currency, energy
timers and F2P monetisation — all struck out by PRD v3 §Non-Goals.

Three gaps survived the benchmark. This decision answers the first; **D-12** and
**D-13** answer the other two.

#### The gap — the wallet has no drain once the catalogue is exhausted

Cook's rule: *every stock needs both a faucet and a drain, or it becomes a dead
resource.* Under D-7/D-10 the catalogue is **finite and closed at eight**, so
after the last purchase the wallet has **zero** drains and grows forever.
Verified from the shipped constants, 2026-08-27:

- catalogue total = **850 zł** **[V]** `src/data/upgrades.ts` (30+60+100+150+210+300)
- `max(requiredWorldLevel) = 3` **[V]** ibid., and `businessLevelForShifts(n) = 1 + ⌊n/3⌋`
  **[V]** `src/data/shift.ts:302–304` → level 3 lands on shift **6**. The only
  time gate is spent long before affordability is; **affordability is the real
  pacing gate**, and nothing measures it.
- revenue = `8n` for a miss-free shift **[V]** `shift.ts:45–47, 289`; `n ∈ [5,7]`
  at `d = 0`, `n ∈ [14,17]` at `d = 1` with full capacity **[V]**
  `adaptive.ts:236–238`, `shift.ts:85` → **40–56 zł/shift** rising to
  **112–136 zł/shift**

The catalogue therefore empties in the band **~7–25 shifts** — longer once D-5's
cost applies, but the same order of magnitude. After that:

- nothing in the app decreases `wallet_balance` except `buyUpgrade` **[V]** (full
  read of every `wallet` site in `src/`)
- **FR-013 has no content** — *"show the NEXT meaningful upgrade and the concrete
  amount still needed"* has no next
- the results-screen progress card disappears: `nextInfo` is `null` when no
  eligible unowned entry exists **[V]** `ShiftScreen.tsx:131–132`,
  `ShiftResults.tsx:15`
- under D-3 all **six** worlds go economically empty at once, because the shop
  carries across worlds **[V]** `pl.ts:204–205`

and the loop reverts to *do maths, watch a number rise* — the exact loop D-1
through D-10 exist to escape. D-5 rejected "a terminating economy" as an option;
**the design terminates anyway and simply does not say so.**

#### The decision — two halves, both chosen by the maintainer

1. **The running cost is keyed on *investment* purchases only** —
   `shopRunningCost(investment ⊆ purchased)`. This is room8studio's
   investment / non-investment split, which D-6 collapsed by keying the cost on
   the whole of `purchased`. Restoring it makes a zero-effect entry legal again:
   it costs money once, adds no upkeep, adds no earning power, and therefore
   cannot trap anyone.
2. **Decorations are per-world and live outside the eight.** Each world carries
   its own decoration set, so the sink **renews when the child changes world**. A
   finite global set would only move the wall from ~shift 25 to ~shift 60.

**Corroborated by two independent practitioner sources, read 2026-08-27.**
room8studio splits *investment* from *non-investment* resources; Wiserax splits
*critical* from *non-critical* and names the non-critical category explicitly as
*"cosmetic items or decorative elements"*. Neither was consulted when D-6 collapsed
the distinction, and both converge on restoring it. Wiserax also reports the exact
failure this decision prevents, from a shipped commercial title: in *Dreamdale*,
*"players quickly accumulated the main currency… but spent almost none of it. An
analysis of the resource flow chart showed that the spend points were not
attractive enough. We added new upgrades and special events requiring resource
expenditures, and the problem was solved."* That is this gap, diagnosed and fixed
the same way, in production.

Rejected: **a global decoration list** — cheaper art (`N` assets rather than
`6 × N`) but the drain stays finite, the gap returns later, and six worlds stay
wallpaper. Rejected: **a repeatable no-new-art drain** (re-painting the shop on a
rising price) — a genuinely unbounded sink, but for a six-year-old it is burning
money for nothing, and it is the hardest of the three to defend against *"growth
must reinforce the math"*. Rejected: **shipping the cost split alone and
deferring decorations to a later backlog entry** — keeps E1 small, but leaves the
dead-wallet endgame in the shipped product until that entry lands.

#### What it settles, verified against the code

- **D-3 stops being wallpaper.** This is the first mechanism that makes six
  worlds worth having, and it does so **without** giving any world an economic
  advantage — a decoration has zero economic effect by construction. D-3's
  rejection of per-world economies therefore stands untouched, and
  `pl.ts:204–205` stays literally true: the *shop* and its *upgrades* still carry
  over; the decoration **set** is what is world-local.
- **No new UI system.** `ShopArt` already composites percent-positioned overlays
  keyed by id, with per-world slot overrides for `piekarnia`,
  `galaktyczna-baza` and `sklep-ksiegarnia` (`kawiarnia` deliberately left on
  `DEFAULT_SLOTS`), and the documented rule *"an upgrade with no slot falls back
  to the corner row"*. **[V]** `src/components/child/ShopArt.tsx`. A decoration is
  **one art file plus an optional slot**, and the corner-row fallback lets them
  ship one at a time.
- **No migration.** `ShopState` gains `decorations?: string[]` — optional, inside
  the existing jsonb, exactly the precedent `purchasedMeta?` set. **[V]**
  `src/types.ts:98–112`. Every legacy `{}` and `{ purchased: [] }` row stays valid.
- **`prd-v3.md` is not edited and D-2's `prd-v4` trigger stays unfired.** FR-012
  (`prd-v3.md:108`) defines an upgrade as a **visible** change *plus* a
  **functional** unlock. A visible-only decoration is therefore **not an upgrade
  in v3's own terms**, so FR-010's 5–8 bound does not reach it. The catalogue
  still lands on eight and stops — **D-10 survives as written** — and decorations
  are a second, separate list. `prd-v3.md:62` already names *"new
  shelf/sign/**decoration**"* as a legitimate visible change.

#### Derived here, not chosen — **confirmed by the maintainer 2026-08-27**

1. **The no-trap invariant needs a second clause.** As written it demands
   `profit(purchased ∪ {u}) > profit(purchased)` *strictly*. A decoration gives
   equality, so it violates the invariant as stated. The invariant splits:

   > **No-trap (investment).** `∀ u ∉ investment : profit(investment ∪ {u}) > profit(investment)`
   > **No-harm (non-investment).** `∀ d : profit` is **unchanged** by owning `d`.

   The second clause is what makes the split safe — it is the machine-checkable
   form of *"a decoration can never cost you anything but its price"*. The sweep
   is unchanged in shape (still ≤2⁸ investment subsets × a grid of `d ∈ [0,1]`)
   and gains one cheap test that decorations never enter `shopRunningCost`.

2. **Decorations must not enter `purchased`.** If they did, they would feed
   `shopRunningCost` and `canBuy`'s rung order and re-create the trap by the back
   door. Hence a separate `decorations` key rather than a flag on the catalogue.

3. **A decoration's only gate is its price.** Every other gate in the game is
   merit-based (D-8) or time-based (D-9). The decoration list is deliberately the
   one place where the answer to *"what can I do with this money"* is always
   "something"; a skill gate here would re-create the empty-wallet endgame for
   exactly the child who earns slowest.

#### Open, as tuning (repo convention: first-guess defaults, adjust after kid-testing)

- How many decorations per world, and their price curve.
- Whether the price rises within a world (an intra-world sink) or stays flat,
  with the cross-world renewal carrying the whole job.
- Slot positions per world, or the corner-row fallback for the first batch.

#### The cost, stated rather than discovered during planning

**No decoration art exists.** All three manifests — `atomic-assets-v1`, `-v2`,
`-v3` — were searched for `decor`, `plant`, `poster`, `lamp`, `banner`, `flower`,
`sticker`, `cosmetic`: **zero** asset hits. The single `decor` match is the word
*"decorative"* inside v3's `usePngFor` guidance. **[V]** 2026-08-27. This is
`6 × N` new assets that **cannot** be pulled out of `assets/`, on top of the two
art debts D-3 already recorded. The corner-row fallback is what keeps it
shippable incrementally rather than as one blocking art batch.

#### What this rewrites — the propagation, stated before the edits are made

| Artifact | Section | Change |
|---|---|---|
| spec | §2 catalogue table | eight entries unchanged; add the decoration list as a second, non-catalogue list |
| spec | §4 running cost | `shopRunningCost(investment)`; the invariant splits into no-trap + no-harm |
| spec | §5 worlds | a world now supplies name, art, vocabulary **and its decoration set** |
| spec | §6 constraint compliance | the FR-012 reading that keeps decorations outside FR-010's bound |
| spec | §8 module boundaries | `shopEffects()` takes the investment subset; `ShopState.decorations` |
| spec | §9 testing | the no-harm clause; decorations never enter `shopRunningCost` |
| spec | Files affected | `src/types.ts`, `src/data/decorations.ts` (new), `ShopArt.tsx`, `UpgradeShop.tsx` |
| backlog | E1 | the `profit` block gains the investment subset; "8 entries and stops" stays true but needs the decoration list named beside it |
| backlog | W1 | decoration sets per world join the vocabulary count |

**A stale claim to correct in two places — but not in the backlog.** **[V]**
2026-08-27: `WORLDS` holds **4** entries (`src/data/worlds.ts`) while **all six**
`world-*.webp` files are already committed under `public/illustrations/`, recorded
in `slice-map.md`. **W1's world art is done**, and `## Ready` W1 already says so
("the cost dropped twice… what is left is code"). The stale *"the gap is art plus
per-world copy"* survives in **this file's `## Current system`** (a dated
2026-08-26 snapshot, now annotated) and in **spec §5**, which inherited it. Both
corrected; the backlog needed no correction on this point.

### D-12 (2026-08-27) — no-dominance is a second invariant, swept alongside no-trap

The literature benchmark's second gap (F-2). *Dominant strategy* is the balance
failure the canon names first: if one branch is always the better buy, the
"choice" evaporates and the player is executing, not deciding.

**The design has no protection against it.** The no-trap invariant (D-6) says no
purchase is *worse*. Nothing anywhere says no branch is *strictly better*. D-1
exists entirely to create a capacity-vs-margin tension, and spec §9 lists seven
test items, none of which checks that the tension exists. Chosen by the
maintainer as a deliverable; it opens no earlier decision.

#### The definition — derived here, **confirmed by the maintainer 2026-08-27**

For a state `(I, d)` — investment subset `I`, difficulty `d` — the marginal
return of a buyable entry `u` is its profit gain per złoty of price:

```
ROI(u | I, d) = [ profit(I ∪ {u}, d) − profit(I, d) ] / cost(u)
ROI*_B(I, d)  = max over buyable u in branch B          // B ∈ { capacity, margin }
```

> **No-dominance invariant.** For every **reachable** state `(I, d)` in which both
> branches have at least one buyable entry:
> `min(ROI*_cap, ROI*_mar) ≥ DOMINANCE_FLOOR × max(ROI*_cap, ROI*_mar)`
> with `DOMINANCE_FLOOR` a named tunable — **first guess 0.6**.

Three things about that shape, each deliberate:

1. **It does not demand equality.** Equal ROI would make the choice *arbitrary*,
   which is a different failure from dominance and no better. The branches differ
   in **kind** — capacity buys *more practice*, a margin *re-prices existing
   practice* — and that qualitative difference is what makes the decision
   meaningful. The floor exists only to stop one side from being strictly the
   wrong answer.
2. **It sweeps reachable states only.** No-trap sweeps all ≤2⁸ subsets, which is
   conservative and correct for it. No-dominance must not: the gates (D-8, D-9)
   make many subsets unoccupiable, and failing on a state no child can reach would
   be a false alarm. Reachability is cheap — every gate is monotone (D-8) and
   `canBuy`'s rung order is fixed **[V]** `src/data/upgrades.ts`, so it is a
   breadth-first walk of the subset lattice. **Naming the reachability filter is
   part of the deliverable**, not an implementation detail a planner should invent.
3. **It shares the reference shift with no-trap.** Both invariants are undefined
   until "steady-state profit" is pinned to a reference shift — the open decision
   `## Ready` E1 explicitly forbids a planner from inventing. **D-13 supplies it.**

#### Why the floor is one-sided — challenged 2026-08-27, confirmed

The literature names **two** balance failures, not one. Wiserax gives both: the
dominant option (a card reading *"Cost: 0 Mana. You win the game"*) and its mirror,
the meaningless option — a multiple-choice question whose three answers are
identical, with the conclusion *"if all choices are equal, the choice, ultimately,
doesn't matter."* Balance, he argues, is the golden mean between them, which
suggests a **two-sided band**: the branches must differ, but not too much.

**The invariant stays one-sided anyway**, for two reasons the card-game analogy
cannot see:

1. **The branches differ in kind, not only in number.** Wiserax's example is three
   *identical* answers — options indistinguishable in every respect. Capacity buys
   **more practice**; a margin **re-prices practice already done**. A child sees
   the difference in the shop and feels it in the shift length, whatever the ROI
   ratio happens to be.
2. **There is a pedagogical asymmetry the analogy has no place for.** Capacity is
   the branch that produces *more mathematics* — the product's entire purpose. ROI
   parity between the branches is therefore **desirable**, not a defect: a child
   who prefers longer shifts must not be paying for that preference. A ceiling
   would fail the sweep precisely at parity and force the fix in the wrong
   direction — inflating margins, or weakening the branch that teaches.

Rejected: **an absolute floor on each branch's ROI** (e.g. "every branch must
return at least X zł per złoty"), because it is a statement about tuning rather
than about the existence of a choice, and it would pass happily while one branch
returned ten times the other. Rejected: **checking dominance only at the empty
state**, because the interesting dominance appears late — capacity saturates at
`MAX_BONUS_TASKS` while a margin does not, so the branches' relative return moves
as `I` grows, which is exactly what the sweep is for.

### D-13 (2026-08-27) — the pacing model, priced in tasks solved

The benchmark's third gap (F-3), and the one all three sources agree on: **model
the economy before building it**. room8studio decomposes per second / hour / day /
week; Unity says spreadsheet then simulate; Machinations says run the diagram. The
design as it stands defers **every** number to kid-testing.

**It already costs something, verifiably.** `prd-v3.md:62` states a loop signal —
*"a typical child chooses and buys at least one upgrade of their own within their
first ~3 shifts"*. `sign` costs **30 zł** and a first shift returns **40–56 zł**
**[V]** (see D-11's arithmetic). The first purchase therefore lands on shift
**1**, not ~3 — **the shipped catalogue already misses its own PRD pacing signal,
in the "too fast" direction**, and nobody noticed because nothing computes it.
`shopRunningCost` and the two margins will move it again.

**Corroborated 2026-08-27.** Wiserax states the same prescription as a first
principle — *"your task is to translate all in-game values into units of time"* —
with the same worked shape (a 1,000-gold sword against 100 gold/hour is a ten-hour
sword), and the same decomposition room8studio gives: first session minute by
minute, first day hour by hour. Three independent sources, one prescription, and
this design had none of it.

#### The unit is tasks solved, not time

The canon's default is to express every price in units of play *time*. Here the
better unit is the one the product is about: **expected tasks solved to afford
it**. It follows the product's own thesis — *the only thing money can buy is more
mathematics* — so the natural price unit is mathematics. Every catalogue entry and
every decoration gains a derived "cost in tasks" figure in the design doc.

#### The child model already exists — **[V]** 2026-08-27

`scripts/telemetry-harness/child-model.ts` defines `ChildModel { pBaseline,
dropAtCeiling }`, a deterministic mulberry32 RNG, and three swept cohorts
(`p090`, `p075`, `p055`) chosen to straddle the engine's first-try target. The
pacing model consumes it directly; **no new assumption file is written**, and the
existing one is already caveated in its own header as *"a stated input… nothing in
this file is evidence"*.

The same caveat binds the output: the pacing model says how the **economy**
responds to a class of player, not what a real child does.

#### What it delivers

- A pure simulation of `N` shifts per cohort → the purchase timeline: which entry
  is bought on which shift, when each branch opens, when the catalogue is
  exhausted, how long the decoration sink (D-11) then absorbs the surplus.
- A test asserting the PRD's own pacing signal (`prd-v3.md:62`, first purchase
  within ~3 shifts) instead of leaving it unmeasured.
- The **reference shift** for D-6's no-trap and D-12's no-dominance sweeps —
  which closes `## Ready` E1's *"open decision the planner must NOT invent"* with
  a derivation rather than a planner's silent choice.
- The "cost in tasks" column for the catalogue and the decoration sets.

#### The cost, stated plainly

**This will generate work.** It will almost certainly show the shipped prices are
mistuned — the `sign` figure above is one instance already visible by hand — so
E1 grows by a catalogue retune it would not otherwise have carried.

It also **narrows a standing repo convention.** `src/data/upgrades.ts` and
`src/data/stages.ts` both say costs are *"first-guess defaults, adjust after
kid-testing"*. That stays true for what only children can answer — above all
D-4's carried-forward question, whether the accuracy margin reads as *reward for
precision* or as *punishment for being a beginner*. It stops being true for what
arithmetic can settle. **Kid-testing gets one shot; it should not be spent on
whether the catalogue empties at shift 9 or shift 40.**

Rejected: **a spreadsheet kept beside the repo**, because it drifts from the
constants the moment either changes; the model must import `src/data/*` so a
price change re-runs it. Rejected: **modelling wall-clock pacing** (sessions per
week, minutes per session), because it is unmeasured, it is not what the economy
is a function of, and reasoning about elapsed time is the doorway to the timer
mechanics PRD v3 bans.

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

## Open — closed 2026-08-27, extended by the literature benchmark the same day

**Every question this section opened has been answered.** Kept as an audit trail
of what was asked and where the answer lives. The last three rows were **not**
raised by the four-layer decomposition — they came out of benchmarking D-1…D-10
against the professional game-economy literature, and are the only things that
benchmark found the design did not cover.

| Question | Answer |
|---|---|
| Layer 1 — cosmetic or differentiating? | **D-3** — skin-deep: shared spine, per-world identity |
| Layer 2 — what effect types exist? | **D-4** — capacity, accuracy margin, quantity margin, unlock; no decorative entry |
| Layer 4 — what absorbs funds? | **D-5** — a per-shift running cost; `profit = max(0, revenue − cost)` |
| Layer 3 — what shape is the clamp? | **D-6** — `SHIFT_COST(purchased)`, under a no-trap invariant; narrowed to the investment subset by **D-11** |
| What effect does `sign` get? | **D-7** — an unlock opening the "marka" branch |
| What is a margin gate keyed to? | **D-8** — each margin gated by what it pays for; `d` rejected |
| Does `SHIFTS_PER_LEVEL = 3` survive? | **D-9** — yes, unchanged; it is the access floor |
| Non-exclusive unlocks? Catalogue budget? | **D-10** — both confirmed |
| What drains the wallet once the catalogue is empty? | **D-11** — investment/non-investment split; per-world decorations renew the sink |
| What stops one branch from strictly dominating? | **D-12** — a no-dominance invariant swept over reachable states |
| Who picks the economy's numbers, and against what? | **D-13** — a pacing model priced in tasks solved; it also supplies the reference shift |

**B2 `pricing-and-inventory` is NOT absorbed** (established under D-4). **[V]**
`src/types.ts:113–120` puts `set-price` / `manage-stock` and the `inventory` /
`profit` competencies out of scope until those task types exist; new task types
are P2, which is parked. B2 stays a separate tranche and B5 stays blocked on it.

## The design in one place

```
revenue = (EARN_PER_TASK  × quantityMargin) × taskCount      // D-4
        + (EARN_PER_CLEAN × accuracyMargin) × cleanCount     // D-4
cost    = shopRunningCost(investment ⊆ purchased)             // D-5, D-6, D-11
profit  = max(0, revenue − cost)                             // D-5
wallet += profit                                             // never a debit — FR-008
```

Catalogue — **8 entries, and no more** (FR-010, D-10):

| # | Kind | Entries | Gate |
|---|---|---|---|
| 1 | unlock | `sign` (30 zł) | world level only |
| 5 | capacity | `shelf`, `register`, `slot`, `storage`, `customers` | world level; 2 carry S-07 gates today |
| 2 | margin | accuracy, quantity — **new**, behind `sign` | `requiredSkill` / `requiredTaskHistory` (D-8) |

Plus a **second, non-catalogue list: per-world decorations** (D-11). Zero economic
effect by construction, so they are outside `investment` and outside FR-010's 5–8
bound — an upgrade is defined by FR-012 as visible **and** functional, and a
decoration is visible only. They are the wallet's sink, and it **renews per
world**, which is the first thing that makes six worlds worth having.

A world supplies name, art, vocabulary for all 8 **and its own decoration set**;
mechanics are shared, and copy falls back to `t.upgrades[id]` (D-3).

**No migration.** `shop_state.purchased` stays a flat global list and gains an
optional sibling `decorations?: string[]` in the same jsonb (the `purchasedMeta?`
precedent); the new terms live in `src/data/shift.ts` and `src/data/upgrades.ts`,
both pure and imported by client and server alike.

**Invariants for the spec to carry as deliverables:**

- **No-trap (investment):** `∀ u ∉ investment : profit(investment ∪ {u}) > profit(investment)`,
  swept over every subset (≤2⁸) × a grid of `d ∈ [0,1]`. Same family as the
  sweeps already in `tests/adaptive.test.ts` and `tests/stages.test.ts`.
- **No-harm (non-investment):** owning a decoration leaves `profit` **unchanged**
  — the machine-checkable form of "a decoration can never cost you anything but
  its price" (D-11).
- **No-dominance:** at every *reachable* state where both branches are buyable,
  neither branch's best marginal profit-per-złoty exceeds the other's by more than
  `DOMINANCE_FLOOR` (D-12). Without it, D-1's whole tension may not exist.
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
| Non-Goals | **present.** PRD v3 §Non-Goals inherited verbatim, plus the rejections recorded inside D-3 through D-13 (per-world economies, a terminating economy, world-as-purchase, `d`-keyed gates, profit-keyed levels, a global decoration list, a wall-clock pacing model). **One rejection was reversed:** D-4's "no purely decorative entry" is overturned by D-11 — decorative entries are legal again, outside the catalogue and outside the cost basis. |
| Preserved behaviour | **present and load-bearing.** FR-008 wallet monotonicity; `pl.ts:204–205` world-carry-over copy stays literally true; `canBuy`'s no-retro-lock property; `MAX_SHIFT_TASKS = 17`; no migration. |

Status: **accepted with one recorded gap** (timeline). Re-run is not required for
D-11…D-13: none of them adds a table, route or RLS surface, and the business-logic
sentence still holds — with *"and the wallet always has somewhere to go"* now
appended by D-11.

## Related, and deliberately not merged in

- **P2 (curriculum / new task types) is parked** pending real telemetry —
  `context/foundation/shape-notes-p2-curriculum.md`. D-1 was chosen partly to
  avoid depending on it.
- **Backlog B2 `pricing-and-inventory`** overlaps layers 2–3 heavily and is
  marked "the largest entry in this backlog"; it introduces a *product* entity,
  which does not exist in the codebase. Check it before designing layer 2 —
  `context/foundation/backlog.md`.
- **Backlog B5 `product-unlocked-screen`** is blocked on B2.
- **Backlog W1 `six-worlds-catalogue`** is layer 1. Its art is already committed
  (**[V]** D-11); D-11 adds per-world decoration sets to its copy/art scope.
