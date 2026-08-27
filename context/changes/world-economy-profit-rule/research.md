---
date: 2026-08-27T16:44:22+02:00
researcher: Claude (autonomous run `2026-08-27-world-economy`, step `/10x-research`)
git_commit: 91754efe5bfea9fb26ccc5e54a117faa6bc9fb51
branch: matmaverse-v2
repository: mathshop (10xDevs)
topic: "E1 world-economy-profit-rule — what the profit rule, the 8-entry catalogue and per-world decorations actually touch"
tags: [research, codebase, economy, upgrades, shift, decorations, invariants, pacing-model]
status: complete
last_updated: 2026-08-27
last_updated_by: Claude (/10x-research)
---

# Research: `world-economy-profit-rule` (feature F1)

**Date**: 2026-08-27T16:44:22+02:00
**Researcher**: Claude — autonomous run `2026-08-27-world-economy`, step `/10x-research`
**Git Commit**: `91754efe5bfea9fb26ccc5e54a117faa6bc9fb51`
**Branch**: `matmaverse-v2`
**Repository**: `mathshop`

## Research Question

What does E1 actually touch, and what does the design spec leave underspecified or
contradictory, such that a plan written straight from
`docs/superpowers/specs/2026-08-27-world-economy-design.md` + backlog E1 would be
wrong? Scope self-set (see `## Autonomous decisions` #1).

## Summary

The spec is unusually complete: the module seam (`shopEffects` / `profitForShift`),
the persistence shape (`shop_state.decorations?`), the FR-008 argument, and the
three invariants are all settled and should be implemented as written. Research did
**not** find the plan blocked on missing information. It found **nine things the spec
and the backlog do not say**, four of which will turn a suite red or a reviewer
wrong if a plan inherits their phrasing:

1. **`sign` is a trap under the invariant as literally quantified.** `sign` is an
   `investment` entry with `extraTasks: 0` and no margin. If it enters
   `shopRunningCost`, buying it raises `cost` and adds nothing to `revenue`, so
   `profit(I ∪ {sign}) < profit(I)` — a direct no-trap violation, from the very
   entry the spec re-casts as the branch gate. §1 below.
2. **Two suites go red from the catalogue growing, and the backlog names only one
   of them.** The known one is `e2e/growth.spec.ts` (*Risk E2E-F4-3*). The unnamed
   one is `tests/shop-art-slots.test.tsx`, which asserts every `WORLD_SLOTS` table
   covers **every id in `UPGRADE_IDS`** — two new ids × three world tables. A third,
   `tests/stages.test.ts`, constrains where the new entries may be gated. §5.
3. **The "reject a wallet debit on FR-008 grounds" instruction is too wide.** A
   decoration purchase *is* a wallet debit, and FR-012's own wording — the wording
   the spec uses to keep decorations outside FR-010's 5–8 bound — says a decoration
   is **not an upgrade**, which is FR-008's only exception. The instruction must be
   narrowed to *the shift path* or a reviewer will correctly reject the decoration
   buy. §6.
4. **A decoration `shift_log` row can permanently break the parent report.**
   `computeWeeklyReport` flips `earningsKnown` false for any row with
   `upgrade_purchased === null && earned == null` — exactly the shape a naive
   decoration-purchase log row has — and that comment's own words are "permanently,
   not transitionally". §7.

Plus: art for the two new **catalogue** entries exists in `assets/` and is on-convention
(§8 — the backlog's "zero art" claim is about decorations only, and is confirmed);
no-trap holds **in expectation, not per shift** (§2); and the client/server `earned`
divergence `change.md` flagged bites first through a **test mock**, not through the UI (§3).

## Detailed Findings

### 1. `shopRunningCost` must be keyed on *earning* ownership, not on catalogue membership

`src/data/upgrades.ts` — `UPGRADES` holds `sign` with `extraTasks: 0` and (post-tranche)
no margin field. The spec's own gloss in §4 is *"Keyed on **what you own that earns**"*,
but its formal statement is `cost = shopRunningCost(investment ⊆ purchased)` with
`investment` defined as "the catalogue", and the no-trap invariant is quantified
`∀ u ∉ investment`. `sign ∈ investment`, so the sweep will evaluate `profit(I ∪ {sign})`
and find it strictly lower.

Three resolutions, none of which the spec picks:

- **(a) weight `sign` at 0** in `shopRunningCost` — the reading the spec's own prose
  supports, and it keeps the invariant quantified over the whole catalogue (strongest
  test). `sign` then costs 30 zł once and never again, which is exactly what "a
  gateway, not an effect" means.
- **(b) give `sign` a small margin** — contradicts §2's "no earnings effect" and
  re-makes it a universal effect, which §2 rejects by name.
- **(c) quantify no-trap over earning entries only** — weakens the headline
  deliverable to dodge one entry.

The same arithmetic applies to any future zero-effect catalogue entry, so (a) is the
shape that generalises. **This is not a tuning parameter — it decides whether the
headline test can pass at all**, and it belongs in the plan, not in implementation.

### 2. No-trap holds in expectation; per-shift it does not, and the clamp does not save it

`revenue = (EARN_PER_TASK × quantityMargin) × taskCount + (EARN_PER_CLEAN × accuracyMargin) × cleanCount`.
On a shift with `cleanCount = 0`, the accuracy margin contributes **zero** revenue while
still raising `cost`. `profit = max(0, revenue − cost)` clamps at zero — it does not
clamp at *the pre-purchase profit*. So a child who buys the accuracy margin and then
has a bad shift earns strictly less than they would have without it.

This is why §4 insists the invariant is pinned to a **reference shift**, and why §9's
pacing model is a deliverable rather than a nicety. It is also a real product risk that
neither document states: the accuracy margin is the entry most likely to read as
*punishment for being a beginner* (the spec names that worry, but attributes it to
copy/kid-testing, not to arithmetic). **Belongs in the plan's `## Known risks`**, and the
no-harm/no-trap suites should state explicitly which shift they evaluate at, so a
reader is not misled into thinking the property is per-shift.

### 3. The client/server `earned` divergence bites through a test mock first

Confirmed from source:

- `src/pages/api/shifts/complete.ts` — its `POST` returns `{ ok, earned, businessLevel, leveledUp }`.
- `src/components/child/ShiftScreen.tsx` — the completion `useEffect` computes
  `const earned = earningsForShift(taskCount, cleanCount)` locally, types the response
  as `{ leveledUp: boolean; businessLevel: number }` (the `earned` field is discarded),
  and feeds its own `earned` into `canUpgrade`, `nextInfo.wallet` and the `Outcome`.
- `src/lib/services/child-profiles.ts` — `recordShiftResult` reads the profile with
  `.select("*")`, so `current.shop_state` is in hand where `earningsForShift` is called.
  **No signature change is needed on the authority path** (spec §5's claim holds).

The fix — read `data.earned` — is one line, but it is guarded by
`tests/shift-screen.test.tsx`, whose `fetchMock` resolves
`{ leveledUp: false, businessLevel: 1 }` with **no `earned`**. Reading `data.earned`
against that mock yields `undefined`, and the results copy interpolates
`String(undefined)` rather than throwing — i.e. it fails *quietly*, in a
`.tsx` test that is not obviously about the economy. The mock must gain `earned`
in the same phase as the read.

`ShiftResults` (`nextInfo`, `earned`) is the third surface: it will need `revenue` /
`cost` / `profit` rather than one `earned`, per spec §1's *przychód · koszt · zysk*.

### 4. Where `art` is assumed and what an art-less entry breaks

`Upgrade.art` is **required** (`art: string`). Every render site does `<img src={…}>`:

| file | symbol / place | what it renders |
| --- | --- | --- |
| `src/components/child/ShopArt.tsx` | `ShopArt` — `placed` map and the `unplaced` corner row | `<img src={u.art}>`, twice |
| `src/components/child/UpgradeShop.tsx` | the unlock card, the affordable tile, the locked tile, the owned row | `<img src={u.art}>`, four times |
| `src/pages/app/growth.astro` | the `unlocks` list and the next-upgrade card | `<img src={upgrade.art}>` / `<img src={next.art}>` |
| `src/pages/app/start.astro` | the next-upgrade rail card | `<img src={next.art}>` |
| `src/components/child/ShiftResults.tsx` | the `nextInfo` progress card | `<img src={nextInfo.art}>` |

So the settled `Decoration { art?: string }` decision is not confined to `ShopArt`:
**a lucide + design-token fallback has to exist at every site that can name a
decoration**, and D-11's whole premise (decorations restore FR-013's "next thing"
once the catalogue empties) means all five *can* name one. `src/data/stages.ts`'s
`ART DEVIATION` header is the precedent to copy verbatim, including recording the
upgrade path in the new module's header.

`ShopArt` additionally needs a **decorations source list and a new prop**, threaded
from both call sites (`src/pages/app/upgrades.astro` → `UpgradeShop` → `ShopArt`, and
`src/pages/app/start.astro` + `src/pages/app/growth.astro` which render `ShopArt`
directly). Today `ShopArt`'s only inputs are `{ world, purchased }`.

### 5. Three test suites constrain the catalogue's growth — the backlog names one

- **`tests/shop-art-slots.test.tsx`** — *"covers all six upgrade ids in every table"*
  loops `UPGRADE_IDS` against every entry of `WORLD_SLOTS`. Adding two catalogue
  entries makes it red for `piekarnia`, `galaktyczna-baza` and `sklep-ksiegarnia`
  unless each table gains a slot for both new ids, each setting **exactly one** of
  left/right and **one** of top/bottom as a percent in 0–100 (a fourth assertion in
  the same file). `DEFAULT_SLOTS` is not asserted directly but is what keeps
  `unplaced` empty — the file's own header says so. **This regression is not in
  backlog E1 and not in the spec.** It is also the file W1's handoff warns about for
  the two new *worlds*, so E1 and W1 both edit it — a contention point for
  `ownership.md`.
- **`tests/stages.test.ts`** — *"returns an honest empty list for the terminal
  stage"* asserts `unlocksForStage(STAGES[3])` is `[]`, and `STAGES` gates
  `stolik/stoisko/oferta/popyt` at levels 1/2/3/4. **Neither margin entry may carry
  `requiredWorldLevel: 4`** without deliberately rewriting that test. Levels 1–3 are
  free. The sibling *"partitions the catalogue without loss"* test passes either way.
- **`tests/upgrades.test.ts`** — *"has 5–8 upgrades with unique ids and increasing
  order"* accommodates 8 (FR-010's bound is already encoded here); the new entries
  need `order: 7, 8` or an interleaved order that stays sorted. *"total extraTasks
  never exceeds…"* asserts `>= MAX_BONUS_TASKS`, unaffected.
- **`e2e/growth.spec.ts`** — *Risk E2E-F4-3*, the known one. Its seed
  `{ purchased: ["sign","shelf"] }` at `businessLevel: 1` must grow to cover every
  level-1 catalogue entry **and** the world's decorations. Note `seedChildProfile`
  (`e2e/helpers/accounts.ts`) writes `shop_state` verbatim from `options.shopState`,
  so seeding `{ purchased: [...], decorations: [...] }` needs no helper change.

### 6. FR-008 and the decoration debit — the reviewer instruction is too wide

The agent contract and the spec both say: *"Reject a wallet debit on FR-008 grounds."*
That is correct **for the shift path** and wrong as stated for the shop path, because:

- `prd-v3.md:102` (FR-008) — funds *"are never reduced except by a deliberate
  **upgrade** purchase"*.
- `prd-v3.md:108` (FR-012) — an upgrade is a visible change **plus** a functional
  unlock. Spec §6 leans on exactly this to place decorations outside FR-010's bound:
  *"a decoration is visible only, so it is **not an upgrade in v3's own terms**"*.

Taken together, a decoration purchase reduces the wallet and is not an upgrade
purchase, so it falls outside FR-008's only exception. The spec never notices the
symmetry. The available readings:

- **Spirit reading (recommended)** — FR-008's exception is about *deliberate spending
  that acquires something permanent*, and `prd-v3.md:62` names *"new shelf/sign/**decoration**"*
  as a legitimate visible change, so v3's own vocabulary already contemplates buying a
  decoration. No FR edit; D-2's `prd-v4` trigger stays unfired.
- **Letter reading** — FR-008 must be edited, which fires the `prd-v4` trigger the
  whole tranche is designed to avoid.

Whichever the plan picks, the **reviewer instruction must be restated** as: *reject a
wallet debit on the **shift** path; the decoration buy is the second sanctioned spend
path beside `buyUpgrade`.* Left as-is, an impl-review step will reject a correct
implementation.

### 7. The decoration purchase's `shift_log` row is a live trap

`src/lib/services/reports.ts` — `computeWeeklyReport` sets
`if (row.upgrade_purchased === null && row.earned == null) earningsKnown = false`,
and the comment beside it explains the predicate was written precisely so a *purchase*
row (which is `earned: null` forever) does not suppress the earnings tile "permanently,
not transitionally".

A decoration purchase logged through `appendShiftLog` has three possible shapes and two
are wrong:

- `{ upgrade_purchased: null, earned: null }` → flips `earningsKnown` false for that
  week, **suppressing the parent report's earnings tile**. Silent.
- `{ upgrade_purchased: <decorationId> }` → survives (`upgradeSkillTie` calls
  `getUpgrade`, gets `undefined`, and falls through to `practiced` competencies), but
  the weekly report then lists a decoration among *"upgrades bought this week"*.
- **no log row at all** → the report simply does not mention decorations. Safest, and
  consistent with the tranche's "decorations are outside the catalogue" line.

Related: `buyUpgrade` grants `+1 decisions` per purchase. **Whether a decoration buy
grants `decisions` is an open product question** — `decisions` is surfaced in
`SkillBars` and the parent weekly report, and gates nothing, so granting it makes
decoration-spam a way to inflate a competency the parent sees. Recommended: no
`decisions` credit for a decoration; record it.

### 8. Art: the two *catalogue* entries have candidates; decorations genuinely have none

`assets/` **is present in this checkout** (the run is on the maintainer's machine),
so this was verified rather than assumed:

- **Decorations — confirmed zero.** `find assets/ -iname` over
  `decor|plant|poster|lamp|banner|flower|sticker|cosmetic|ozdob` returns **no files**.
  The backlog's claim holds; the settled `art?: string` + lucide decision is the right
  answer and needs no revisiting.
- **The two margin entries — candidates exist, on-convention.** All six committed
  `public/illustrations/upgrade-*.svg` are **verbatim copies** (no crop, no resize) of
  `assets/atomic-assets-v3/svg/icons/*.svg`, each recorded in
  `public/illustrations/slice-map.md`. Unclaimed icons in that same pack include
  `world-progress.svg`, `requirement-check.svg`, `before-after.svg`, `budget-plan.svg`,
  `xp-star.svg`; the v1/v2 packs additionally hold `chart-up.svg`, `target.svg`,
  `price-tag.svg`, `badge-star.svg`, `trophy.svg`.
  Natural mapping: **quantity margin → `world-progress.svg` or `chart-up.svg`**;
  **accuracy margin → `requirement-check.svg` or `target.svg`**.

**Logistics the plan must state:** the implementation runs in a git worktree under
`.claude/worktrees/`, where `assets/` does not exist (it is gitignored, so it is not
checked out there). It is still reachable on this machine by absolute path
(`/Users/kamilp/Dev/10xDevs/assets/...`). So either (a) the implementer copies the two
SVGs from the absolute path into its own `public/illustrations/` and adds a
`slice-map.md` row — cheap, on-convention, but **machine-dependent**, or (b) the two
margin entries take the same `art?: string` + lucide fallback the decorations take —
zero new assets, one consistent code path, and no machine dependency. Research
recommends **(a)** so the shop grid does not mix six illustrations with two glyphs;
**(b)** is the correct fallback if the copy step fails for any reason. The fallback
branch has to be built for decorations regardless, so (b) costs nothing extra.

### 9. Smaller things a plan should not rediscover

- **`earningsForShift` should be retained as `revenue`**, not replaced (spec §8 leaves
  it open). `tests/shift.test.ts` has *"never pays zero — the floor is base * tasks"*,
  which is **false of `profit`** and true of revenue; and
  `tests/shifts-complete.test.ts` expresses five expectations through
  `earningsForShift(...)`. Retaining it keeps both suites meaningful and keeps the
  diff to added expectations rather than rewritten ones.
- **`readPurchased` has no sibling.** A `readDecorations(shopState)` is needed with
  the same `?? []` posture — `shop_state` is typed non-optional but `{}` rows are legal
  forever.
- **The inner-spread trap.** `buyUpgrade`'s comment on `purchasedMeta` is explicit:
  naming a key beside `...current.shop_state` **shadows** the outer spread. A
  decoration write must name `decorations` and therefore must not drop `purchased` or
  `purchasedMeta`. `tests/upgrades-buy.test.ts` already pins the analogous property
  (*"leaves `purchased` untouched across two buys, and keeps BOTH meta entries"*) —
  the decoration test should mirror it.
- **The new route** is `src/pages/api/decorations/buy.ts` and needs
  `export const prerender = false`, a zod `z.enum(DECORATION_IDS)` closed set, and the
  `json()` + `applyNoStore` shape `src/pages/api/upgrades/buy.ts` uses. No new table,
  no migration, no RLS policy — the existing four `child_profiles` policies are
  column-agnostic (`docs/reference/contract-surfaces.md` § `public.child_profiles`).
  That surface's Columns paragraph documents `shop_state`'s shape and **must gain the
  `decorations?` sibling**; per the concurrency contract, conflicts there keep both sides.
- **The pacing model's home.** `vitest.config.ts` includes only
  `tests/**/*.test.{ts,tsx}`, and `playwright.config.ts` has `testDir: "./e2e"` — so
  `scripts/telemetry-harness/harness.spec.ts` is run by neither. A pure pacing
  simulation importing `src/data/*` + `scripts/telemetry-harness/child-model.ts`
  belongs in `tests/` (where it runs on every `npm test`) with the report-shaped
  output, if any, under `scripts/`.
- **`DOMINANCE_FLOOR` reachability.** `canBuy`'s rung order is fixed and every gate is
  monotone (`requiredWorldLevel`, `requiredSkill.level`, `requiredTaskHistory.count`),
  which is what makes the BFS over the subset lattice cheap. `businessLevelForShifts`
  is uncapped, so reachability must be walked over `(subset, businessLevel, skillState)`,
  not over subsets alone.

## Code References

- `src/data/upgrades.ts` — `UPGRADES`, `MAX_BONUS_TASKS`, `canBuy`, `BuyReason`,
  `nextUpgrade`, `shiftBonusTasks`, `readPurchased`, `UPGRADE_IDS`
- `src/data/shift.ts` — `EARN_PER_TASK`, `EARN_PER_CLEAN`, `SHIFTS_PER_LEVEL`,
  `MAX_SHIFT_TASKS`, `earningsForShift`, `starsForShift`, `businessLevelForShifts`
- `src/data/stages.ts` — module header `ART DEVIATION FROM THE MOCKUP`; `STAGES`,
  `unlocksForStage`
- `src/data/worlds.ts` — `World`, `WORLDS`, `WORLD_SLUGS`, `worldForTheme`
- `src/types.ts` — `ShopState` (`purchased`, `purchasedMeta?`)
- `src/lib/services/child-profiles.ts` — `recordShiftResult`, `buyUpgrade`,
  `appendShiftLog`, `ShiftResult`
- `src/lib/services/reports.ts` — `upgradeSkillTie`, `computeWeeklyReport`
  (`earningsKnown` predicate)
- `src/pages/api/shifts/complete.ts` — `POST`, `completeSchema`
- `src/pages/api/upgrades/buy.ts` — `POST`, `buySchema`
- `src/components/child/ShiftScreen.tsx` — the completion `useEffect`, `Outcome`
- `src/components/child/ShiftResults.tsx` — `ShiftResultsProps.nextInfo`
- `src/components/child/UpgradeShop.tsx` — `lockedReason`, `buy`
- `src/components/child/ShopArt.tsx` — `DEFAULT_SLOTS`, `WORLD_SLOTS`, `ShopArt`
- `src/pages/app/{start,growth,upgrades,task}.astro` — the four `readPurchased` callers
- `src/i18n/pl.ts` — `upgrades`, `upgradeShop`, `results`, `growth`, `worlds`;
  `src/i18n/index.ts` — `upgradeCopy`, `stageCopy`
- `tests/shop-art-slots.test.tsx`, `tests/stages.test.ts`, `tests/upgrades.test.ts`,
  `tests/shift.test.ts`, `tests/shifts-complete.test.ts`, `tests/upgrades-buy.test.ts`,
  `tests/shift-screen.test.tsx`, `tests/nav-labels.test.ts`, `tests/adaptive.test.ts`
  (`D_SWEEP` — the sweep convention to copy)
- `e2e/growth.spec.ts` — *Risk E2E-F4-3*; `e2e/helpers/accounts.ts` — `seedChildProfile`
- `scripts/telemetry-harness/child-model.ts` — `ChildModel`, `MISS_MODEL`, `rng`,
  `pFirstTry`, `missesThisTask`
- `docs/reference/contract-surfaces.md` — § `public.child_profiles`, § `public.shift_log`
- `public/illustrations/slice-map.md` — the upgrade-SVG provenance table

## Architecture Insights

- **The pure-data layer is the whole safety argument.** `src/data/shift.ts` and
  `src/data/upgrades.ts` are dependency-free and imported by both the island and the
  authoritative route, and both module headers say so in the same words: *"so both
  sides agree by construction"*. The profit rule must land there and nowhere else —
  and the current `ShiftScreen` divergence (§3) is the one place that property has
  already quietly lapsed.
- **`shift.ts` does not import `upgrades.ts`.** The spec's `ShopEffects` value object
  is what preserves that, and `MAX_SHIFT_TASKS`'s header records why a derived cap was
  rejected. Do not close that seam.
- **Silent fallbacks are the recurring failure mode here.** `ShopArt`'s slot lookup,
  `readPurchased`'s `?? []`, `upgradeCopy`'s id fallback, `upgradeSkillTie`'s
  `getUpgrade` miss and `earningsKnown`'s predicate all degrade rather than throw.
  Every one of them will accept a decoration id without complaint and produce a subtly
  wrong screen. That is why `tests/shop-art-slots.test.tsx` exists, and it is the model
  for what the decoration work needs.
- **Append-only shared files.** `src/i18n/pl.ts` and `src/types.ts` take one appended
  entry per key; the run's contract makes that binding because W1 edits the same
  dictionary right after E1.

## Historical Context (from prior changes)

- `context/archive/2026-07-01-upgrade-choice-and-growth/plan.md` — the original
  catalogue + `canBuy` rung order and its no-retro-lock property.
- `context/archive/2026-07-01-spendable-funds-wallet/plan.md` — the `coins` →
  `wallet_balance` rename and the "spending reads as acquiring, not losing" framing
  that FR-008 encodes.
- `context/archive/2026-06-30-visible-shop-growth/` — `ShopArt`'s slot composition.
- `context/archive/2026-08-22-world-progression-stages/` — `stages.ts`, its
  `ART DEVIATION` header (the precedent E1 is told to follow), and `e2e/growth.spec.ts`.
- `context/archive/2026-08-25-adaptive-task-engine/` — `d`, `foldShiftOutcomes`, and
  the `D_SWEEP` property-sweep convention the invariant suites should copy.
- `context/changes/six-worlds-catalogue/handoff.md` — W1's intake; it independently
  found `tests/shop-art-slots.test.tsx` as its own regression (two new **worlds**),
  which makes that file a two-feature contention point.

## Related Research

- `context/changes/world-economy-profit-rule/change.md` — `/10x-new`'s verification
  ledger (six corrections to backlog E1). Superseded in part by this document:
  its corrections 1–6 all hold; §1, §5, §6, §7 and §8 here are new.
- `context/changes/six-worlds-catalogue/change.md` — W1's intake ledger.

## Open Questions

1. **`shopRunningCost`'s treatment of `sign`** (§1) — a plan-level decision, not a
   tuning constant.
2. **FR-008 vs. the decoration debit** (§6) — needs an explicit reading recorded so
   impl-review does not reject a correct implementation.
3. **Whether a decoration purchase writes a `shift_log` row at all**, and whether it
   grants `+1 decisions` (§7).
4. **How many decorations per world in the first batch**, and their price curve — one
   of the two decisions the run brief marks genuinely open. Deferred to the plan (see
   `## Autonomous decisions` #3).
5. **Whether the two margin entries take committed SVGs or the lucide fallback** (§8).
6. **`DOMINANCE_FLOOR = 0.6`** — a policy number the pacing model measures against but
   does not decide. Unchanged; not a research question.

## Autonomous decisions

**1. Scope set to "the economy seam and everything the catalogue's growth breaks",
depth "deep", focus "integration points + test surface".**
*Chosen:* trace the four modules the spec names, then every consumer of
`UPGRADES` / `UPGRADE_IDS` / `readPurchased` / `art`, then the suites that assert on
them. *Rejected:* (a) a surface-level overview — the spec is already a design
document, so an overview would restate it and add nothing; (b) re-deriving the
economy design — D-1…D-13 are settled and the contract forbids re-litigating them;
(c) researching the pacing model's statistics — that is a deliverable to be built,
not a codebase fact to be found. *Why:* `change.md` established that half the
backlog's symbols do not exist yet, so the useful question was not "how does the
economy work" but "what does adding these symbols break". Four of the nine findings
are red-suite regressions, which is the evidence the scoping was right.
*What would change the answer:* if a later step finds the plan blocked on *product*
questions rather than integration ones, the missing research is a `/10x-frame` pass
on D-11, not a second codebase sweep.

**2. Sub-agents were not used — this research was done in a single context.**
*Chosen:* read the ~25 relevant files directly. *Rejected:* the skill's parallel
`Task`-agent decomposition. *Why:* **no agent-spawning tool is available in this
environment** — `ToolSearch` for task/subagent/spawn returns only `TaskStop`,
`SendMessage`, `RemoteTrigger`, `CronCreate` and `PushNotification`. The skill's
step 5 ("wait for ALL sub-agents") is therefore vacuous here, and the run brief's
warning about a research step dying while "waiting for the last agent" is precisely
the failure this avoids. *What would change the answer:* if a `Task` tool becomes
available and the surface grows past what one context can hold, fan out — but note
that the highest-value findings here (§1, §6, §7) came from holding the spec, the
PRD and three source files in the same head, which a fan-out makes harder, not easier.

**3. The two genuinely-open tuning decisions were again NOT made here.**
*Chosen:* decorations-per-world and W1's vocabulary question stay open into the plan.
*Rejected:* picking a number now. *Why:* both are outputs of D-13's pacing model
(how much sink the wallet needs is a function of the purchase timeline the model
produces), and the contract forbids inventing exactly this class of number. Research
that guessed would hand the planner a fake constraint. *What would change the answer:*
the plan step must decide them — if it also defers, the implementer decides and
records, because the contract says they cannot survive past implementation.

**4. `assets/` was read, and the finding is recorded as machine-dependent.**
*Chosen:* inventory the asset packs and name specific candidate files (§8). *Rejected:*
declaring the art absent and stopping (it is not absent for the *catalogue* entries),
and copying the files into `public/` myself (a docs-lane step may write only inside
`context/changes/<change-id>/`). *Why:* CLAUDE.md grants standing permission to read
`assets/`, and the implementation worktree cannot reach it as a relative path — so
recording the exact source paths here is the only way the information survives into
the lane that needs it. *What would change the answer:* if the implementer's absolute-path
copy fails (different machine, moved directory), take the `art?: string` + lucide
fallback for the two margin entries — the branch exists for decorations anyway.

**5. No suite was run in this step.** *Why:* docs-lane; one file written, under
`context/changes/world-economy-profit-rule/`, and no source touched, so no suite
could move. The contract's baseline (lint 0, check 0 errors, 548/548 vitest across 57
files, 26/26 Playwright at `91754ef`) is recorded as **inherited and unobserved by
this step**. *What would change the answer:* the first step that touches `src/`,
`tests/` or `e2e/` re-measures on its own branch before claiming any delta (L-005).

**6. The skill's closing "present findings and ask for follow-ups" was not honoured.**
*Why:* run rule 1 — no human in the loop. The next command is recorded in the
handoff's §4 instead.
