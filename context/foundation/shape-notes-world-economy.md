---
project: "MathShop — world expansion + purchase catalogue + virtual economy"
context_type: brownfield
scope: tranche
governing_prd: context/foundation/prd-v3.md
created: 2026-08-26
updated: 2026-08-26
status: brainstorming-in-progress
skill: superpowers:brainstorming (architectural path)
---

# World expansion + purchase catalogue + virtual economy — brainstorm notes

**Live brainstorm, not a finished design.** Opened 2026-08-26. The architectural
path of `superpowers:brainstorming` is being followed; this file exists so the
work survives a session boundary. The finished design belongs in
`docs/superpowers/specs/YYYY-MM-DD-world-economy-design.md`, and only after the
user has approved it section by section.

## Current system — [V] verified 2026-08-26

### A world is a picture

`src/data/worlds.ts`: `World = { slug, name, image }`. That is the whole model.
A world resolves which illustration the start screen renders and nothing else —
it does not touch tasks, the upgrade catalogue, or the economy. `slug` is stored
in `child_profiles.theme`; the DB default `'default'` falls back to `kawiarnia`.

Four exist — `kawiarnia`, `piekarnia`, `galaktyczna-baza`, `sklep-ksiegarnia`.
PRD v3 assumes **six** (backlog W1). The gap is art plus per-world copy.

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

## Open — next in the brainstorm

Nothing below has been decided. These are the questions the next session should
work through, one at a time, per the brainstorming skill:

- **Layer 1 first**: does a world stay cosmetic, or does it differentiate? This
  is the cheapest question with the largest cost consequence, and it decides
  whether backlog W1 is an art task or an economy task.
- What effect *types* exist beyond `extraTasks` and margin, if any.
- What the skill gate on a multiplier is actually keyed to — skill level, task
  history, or per-competency difficulty `d` (which now exists, post-P3/P5).
- What absorbs funds late-game, given no casino mechanics and no scarcity
  messaging are available as levers.
- Whether `SHIFTS_PER_LEVEL = 3` (a bare shift counter) survives contact with a
  richer economy, or whether business level should key on something earned.

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
