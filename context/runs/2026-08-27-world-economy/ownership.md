# Shared-resource ownership — run `2026-08-27-world-economy`

Written by the **contention sweep** on 2026-08-27, after both plans existed and
**before any implementation started**, by one agent that read both at once. Binding on
every implementer, on every review step, and on conflict resolution at integration.

Features in scope:

| id | change-id | plan |
|---|---|---|
| **F1** | `world-economy-profit-rule` | `context/changes/world-economy-profit-rule/plan.md` |
| **F2** | `six-worlds-catalogue` | `context/changes/six-worlds-catalogue/plan.md` |

Base branch: `matmaverse-v2` @ `91754ef`.

**Headline:** the orchestrator pre-declared F1 → F2 as a *preference* edge (a
`src/i18n/pl.ts` file collision). Reading both plans together, **it is a prerequisite** —
F2's Phase 4 appends to a module, a type and an i18n namespace that F1 introduces, and
F1 ships an assertion over `WORLD_SLUGS` that F2's Phase 1 turns red and only F2's Phase 4
can close. That is the "something stronger" the run log allowed the sweep to find, and it
converts three of F2's conditionals into unconditional work. See §3.

---

## 1. Contended resources

Two conventions bind everywhere below, from the concurrency contract:

- **Append-only files are appended to, never restructured** — one entry per key.
- **On a merge conflict in a registry, keep BOTH symbol sets.** Never `--ours`,
  never `--theirs`. Nothing validates these files, so a bad resolution fails silently
  and permanently.

### 1a. Genuinely contended — both features write here

| Resource | Features | **Owner** | Rule for everyone else |
|---|---|---|---|
| `src/i18n/pl.ts` | F1, F2 | **F1** | **Append only, one key per entry.** F1 lands first and creates the namespaces: `t.results.{revenueLabel,costLabel,profitLabel,breakdownHeading}`, `t.upgrades.{precision,margin}`, `t.upgradeShop.{lockedByBranch,decorationsHeading,decorationsHint}`, `t.decorations[id]` × 16. F2 then appends **only**: `t.decorations[id]` × 8 (`pracownia-*`, `laboratorium-*`) and one comment above `marketing.worlds`. F2 must **not** move `t.marketing.worlds`, must **not** touch `t.worlds` (screen namespace — see §1d), and must **not** move world names into the dictionary this run. **Both must grep the dictionary in BOTH directions before each new label (L-007)** — see §5. |
| `src/components/child/ShopArt.tsx` | F1, F2 | **F1** | F1 owns the **component**: `ShopArtProps` (gains `decorations: string[]`), the render function, `DEFAULT_SLOTS`, the module header, and the three shipped `WORLD_SLOTS` tables (`piekarnia`, `galaktyczna-baza`, `sklep-ksiegarnia`) into which it adds `precision` and `margin`. F2 owns **two new keys in the `WORLD_SLOTS` literal only** — `pracownia`, `laboratorium` — and adds nothing else, restructures nothing, and does not touch `DEFAULT_SLOTS` or the function. `kawiarnia` stays absent in both directions (it must keep falling through to `DEFAULT_SLOTS`; `tests/shop-art-slots.test.tsx` § *"omits the default world"* pins it). **No decoration id ever enters `WORLD_SLOTS`** — decorations render in `ShopArt`'s corner row (F1 Phase 5 §1/§4), which is what retires F2's Phase 4 §3 (CPD-7). |
| `src/data/decorations.ts` | F1, F2 | **F1** | F1 authors the module: the `Decoration` interface, `ShopIconKey`, `DECORATIONS` (16 entries = 4 worlds × 4), `DECORATION_IDS`, `getDecoration`, `decorationsForWorld`, `readDecorations`, `canBuyDecoration`, `nextPurchase`, and the `ART DEVIATION` header. F2 **appends two world keys' worth of entries** (8, matching F1's count of 4/world and price curve 40/80/140/220) and nothing else — no type change, no header edit, no price-curve change, no edit to F1's four sets. **One carve-out (CPD-6): `ShopIconKey` and `ShopGlyph`'s icon map are append-only and F2 MAY append to both**, because F2's manual criterion 4.9 requires a visibly different set per world. F1 must therefore land the union as `keyof typeof SHOP_ICONS`, not as a hand-written closed literal (fixed in F1's plan). |
| `tests/shop-art-slots.test.tsx` | F1, F2 | **F1** | F1 renames the case *"covers all six upgrade ids in every table"* to a count-free phrasing and rewrites the module header's stale *"`DEFAULT_SLOTS` covers all six ids"* sentence. F1 adds **no new assertion** — the shape assertion it contracted already exists (CPD-5). F2 **edits this file not at all**; it anchors on the `Object.entries(WORLD_SLOTS)` loop and the failure string `"<slug>" has no slot for upgrade "<id>"`, never on a title (L-006). Its four data assertions and one render case are load-bearing and must not be "simplified" into fixed lists by either feature. |
| `tests/decorations.test.ts` | F1, F2 | **F1** | F1 authors it, including the per-world totality assertion (*for every slug in `WORLD_SLUGS`, `decorationsForWorld(slug).length` equals the per-world count*). F2 **does not edit it** — F2 makes it green by supplying data, which is the entire point of the seam. If F2 finds itself editing this file, F2 is doing F1's work. |
| `playwright.config.ts` (the `touch` project's `testMatch`) | F2, and F1's `/10x-e2e` step | **F2** | F2's Phase 5 §0 extends the alternation to `/(gameplay-restore\|growth\|worlds)\.spec\.ts/`. **Every other writer EXTENDS the alternation and never replaces it**; on conflict, **keep both alternatives**. F1's *plan* ships no new spec, but the run's `/10x-e2e` step for F1 may — this is a forward contention point, recorded because a lost alternative is silent: the spec still runs, desktop-only, at the one viewport that cannot carry its risk (CPD-8). |

### 1b. Single-owner — one feature writes, the other is forbidden

| Resource | **Owner** | Note |
|---|---|---|
| `src/data/upgrades.ts` | **F1** | `ShopEffects`, `shopEffects`, `shopRunningCost`, `runningCost`/`quantityMargin`/`accuracyMargin`/`requiredUpgrade` fields, the `precision` + `margin` entries, `canBuy`'s `branch-locked` rung, the `ART DEVIATION` header. F2 reads `UPGRADE_IDS` and writes nothing. |
| `src/data/shift.ts` | **F1** | `profitForShift`. The `shift.ts` ⇸ `upgrades.ts` seam stays closed except for the **type-only** `ShopEffects` import. |
| `src/data/worlds.ts` | **F2** | The two `World` records and the header's name↔slug↔art reconciliation. F1 reads `WORLD_SLUGS` and writes nothing. |
| `src/lib/services/child-profiles.ts` | **F1** | `recordShiftResult` (wallet `+= profit`) and the new `buyDecoration`. **F2 must not touch `src/lib/services/` at all this run.** In the source run four features collided on one service file; here the collision is pre-empted by making the lane single-owner. |
| `src/lib/services/reports.ts` | **nobody** | F1 *reads* `computeWeeklyReport`'s `earningsKnown` predicate to justify AD-6 (a decoration writes no `shift_log` row). Neither feature edits it. Any implementer who finds they need to: stop and report. |
| `src/types.ts` | **F1** | `ShopState` gains `decorations?: string[]`. **Append-only.** F2 does not touch it. |
| `src/pages/api/shifts/complete.ts` | **F1** | Response gains `revenue`/`cost`/`profit`. `export const prerender = false` stays. |
| `src/pages/api/decorations/buy.ts` (new) | **F1** | New route: `prerender = false`, zod `z.enum(DECORATION_IDS)`, `json()` + `applyNoStore`. F2's eight new ids widen the enum automatically — F2 does not touch the route. |
| `src/components/child/ShopGlyph.tsx` (new) | **F1** | See the `ShopIconKey` carve-out in §1a. |
| `src/components/child/{ShiftScreen,ShiftResults,UpgradeShop}.tsx` | **F1** | F2 touches none of them. |
| `src/components/child/{WorldPicker,CreateProfileWizard}.tsx` | **F2** | Grid reflows + the two header rewrites. F1 touches neither. |
| `e2e/growth.spec.ts` | **F1** | The known *Risk E2E-F4-3* regression repair (re-seed, never delete the assertion). **F2 must not re-seed it a second time** — its own plan already disclaims this. |
| `e2e/worlds.spec.ts` (new) | **F2** | Risk W1-E2E-1. |
| `tests/worlds-art.test.ts` (new) | **F2** | The slug = stem = `theme` invariant. |
| `tests/{pacing,economy-invariants}.test.ts` (new), `scripts/telemetry-harness/pacing.ts` (new) | **F1** | |
| `public/illustrations/slice-map.md` | **nobody writes this run** | F2's world-card rows are already committed on the base. **Neither feature commits new art** — F1's margins and all decorations ship art-less through `ShopGlyph` (F1 AD-3, and the `src/data/stages.ts` precedent). If any implementer pulls an asset out of `assets/`, they own a `slice-map.md` row and must say so in the handoff. Note `assets/` is **absent from both worktrees** (gitignored), so every layout in both plans is an explicit extrapolation. |

### 1c. Routes and nav

| | |
|---|---|
| **New routes under `src/pages/app/`** | **None, in either feature.** |
| **Existing `src/pages/app/` routes edited** | `upgrades.astro`, `start.astro`, `growth.astro` — **all three owned by F1** (the three "next thing" surfaces switch from `nextUpgrade` to `nextPurchase`, and the `<img src={…art}>` sites become `ShopGlyph`). **F2 edits no route**; its Phase 2 changes `WorldPicker.tsx` and `CreateProfileWizard.tsx`, not `worlds.astro`. **Zero route contention.** |
| **New API routes** | `src/pages/api/decorations/buy.ts` — **F1**, and it must `export const prerender = false`. |
| **Nav entries** | **Neither feature adds one.** `t.nav.items` stays at **six** keys. See §5 for the measurement. **No dead navigation** either way: F1's decoration shop lives inside the existing `/app/upgrades`, reached from `/app/growth`'s CTA — which is exactly why F1's Phase 6 must preserve `t.growth.upgradesLink` when it re-seeds the empty-shop E2E. |

### 1d. Documentation

| Section | Features | **Owner** | Rule for everyone else |
|---|---|---|---|
| `docs/reference/contract-surfaces.md` § `public.child_profiles` → **Columns** paragraph | F1 only | **F1** | Adds the `decorations?: string[]` sibling beside `purchasedMeta?`. |
| `docs/reference/contract-surfaces.md` § `public.shift_log` | F1 only | **F1** | Records that `earned` now carries **profit**, and that a decoration purchase writes **no row**. |
| `docs/reference/contract-surfaces.md` § `public.child_profiles` → **World-change surface (F5)** | — | **nobody** | **Checked, and it is genuinely not contended.** It says *"the closed slug set is enforced in zod at the route (`WORLD_SLUGS`), there is **no DB CHECK** on `theme`"* — it names no count, so F2 growing `WORLDS` from four to six leaves it true. F2 correctly writes nothing here. This is the exact section-level collision that surfaced by accident in the source run; it was looked for and it is absent. |
| `scripts/telemetry-harness/README.md` | F1 only | **F1** | The price-in-tasks table and the harness caveat. |
| `src/i18n/pl.ts` § the `t.worlds` namespace | — | **nobody** | The world-selection **screen** namespace, whose own header says the competency trio is *"world-INDEPENDENT by design"*. The design spec's `t.worlds[slug].upgrades[id]` is shorthand for a **future** key path, not this record. **Both features decided independently to write no per-world catalogue vocabulary** (F1 AD-8, F2 Decision 1) — those two decisions agree, and this run therefore settles the contract's open decision #3 as *"ship on the mandatory fallback"*. When vocabulary is eventually written it must **not** nest under `t.worlds`; `t.worlds.bySlug[slug]` or a sibling namespace are the non-colliding homes. |

### 1e. Migrations

| | |
|---|---|
| `supabase/migrations/` | **No migration this run. Migration author: NONE.** |

Both plans reach the same conclusion independently and for different reasons, and both
are correct against the schema:

- **F1** — `shop_state` is jsonb; `decorations?: string[]` is an optional sibling on the
  precedent `purchasedMeta?` already set. Every legacy `{}` and `{ purchased: [] }` row
  stays valid, so there is nothing to migrate and nothing to backfill. `shift_log.earned`
  keeps its documented contract (*"the amount added to the wallet"*) and simply starts
  carrying profit; every pre-existing row is a shift whose cost was zero.
- **F2** — `child_profiles.theme` is `text not null default 'default'` with **no CHECK
  constraint** in any of the twelve migration files (verified: `supabase/migrations/`
  ends at `20260825130000_child_profiles_add_difficulty_state.sql`). Adding a world
  widens a zod `.refine` in code and nothing else.

**The rule, since the lane is serialized:** if any implementer concludes a migration is
needed, that is a **STOP and report to the orchestrator**, not a file they write. Two
features writing schema in one batch cannot be ordered safely after the fact. And per
L-001, if a migration is ever authorised here it carries **granular per-operation,
per-role RLS policies in the same file** — no new table or column ships without them.

### 1f. Not contended, recorded so nobody goes looking

`src/middleware.ts`, `src/lib/supabase.ts`, `astro.config.mjs`, `tsconfig.json`,
`src/components/ui/**` (no new shadcn component in either plan), and every migration file.
Neither feature touches any of these. F1's Phase 1 *depends* on `tsconfig.json`'s
`include: ["**/*"]` for the `tests/ → scripts/` import but must not edit it; if
`npm run check` fails there, the contracted escape is to move the simulator to
`tests/helpers/pacing.ts`.

---

## 2. Stack order — binding

```
matmaverse-v2 @ 91754ef
  └─ feat/world-economy-profit-rule      (F1) ← merges first
       └─ feat/six-worlds-catalogue      (F2) ← cut from F1, merges second
```

**One stack. No concurrent code lane this run.** Two features, one chain — F2's branch
is cut from `feat/world-economy-profit-rule`, not from `matmaverse-v2`. This is not
caution: the two features share four write surfaces (§1a) and F2 consumes three symbols
F1 introduces. There is no pair here that shares no resource, so there is no second stack
to open.

### The edge

> **`feat/six-worlds-catalogue` after `feat/world-economy-profit-rule` — PREREQUISITE.**

The orchestrator pre-declared this edge as a **preference** ("both edit `src/i18n/pl.ts`;
concurrent worktrees would collide"). That reason is real but it is not the strongest one.
Reading both plans together, three prerequisite couplings appear that neither plan could
see alone:

1. **F2 imports symbols F1 introduces.** F2's Phase 4 appends `Decoration` records to
   `DECORATIONS` in `src/data/decorations.ts`, using F1's `Decoration` interface and F1's
   `ShopIconKey`. Neither exists on `matmaverse-v2`. F2's own Decision 4 verified their
   absence and correctly refuses to author them.
2. **F1 ships an assertion that F2's data is required to satisfy.** F1's Phase 5 §1 puts a
   per-world totality assertion in `tests/decorations.test.ts` — *for every slug in
   `WORLD_SLUGS`, `decorationsForWorld(slug).length` equals the per-world count*. F2's
   Phase 1 widens `WORLD_SLUGS` to six and turns it **red**; only F2's Phase 4 closes it.
   F1's plan names this seam explicitly: *"It is what makes W1's Phase 4 non-droppable
   once F1 has landed."*
3. **`UPGRADE_IDS` is eight, not six, at F2's branch point.** F2's Phase 3 sizes two new
   `WORLD_SLOTS` tables to `UPGRADE_IDS`; F1's Phase 3 grows it from six to eight. Cut
   from `matmaverse-v2`, F2 would ship two six-id tables that are green on its own branch
   and **guaranteed red at merge** — F2's own Phase 6 exists solely to catch that, and
   this edge is what makes Phase 6 a cheap confirmation instead of real repair work.

The `src/i18n/pl.ts` and `src/components/child/ShopArt.tsx` collisions remain true and
now ride along as **preferences** on the same edge — cheaper rebase, one append order,
and F1 naming the eight catalogue entries once rather than six and then two more.

**Consequences, binding on F2 and already fixed into its plan:** the branch point is
unconditional; Phase 4 is **mandatory** (no `DROPPED` state); Phase 1 expects **two** red
cases; Phases 1 + 3 + 4 commit as **one** green commit; Phase 6 is a confirmation and
still not droppable. If `feat/world-economy-profit-rule` does not exist when F2 starts,
F2 reports **BLOCKED** — it does not fall back to `matmaverse-v2`.

### Merge and integration

- Merge order is **F1, then F2**, onto an integration branch — and merging is a
  **verification step**, not a delivery step. Run the full suite on the merged result.
- Registry conflicts (`src/i18n/pl.ts`, `WORLD_SLOTS`, `ShopIconKey`,
  `contract-surfaces.md`, `playwright.config.ts`'s alternation) resolve by **keeping both
  symbol sets**.
- Re-measure baselines on the merged tree. F2's Phase 0 baseline is F1's branch count,
  not the contract's `548 / 26` (L-005).

---

## 3. Cross-plan defects

Eight defects, each visible only to a reader holding both plans at once. **All eight were
fixed in place, in the offending plan, by this sweep**, marked `[contention sweep]` with
the CPD id, and both plans carry an amendment banner pointing here.

### CPD-1 — F2 asserts F1 ships no per-world sink assertion. F1 ships exactly that. — **FIXED in F2**

F2's `## Known risks` (added at its plan review) and its Phase 6 §2 both state: *"F1
contracts no 'every world has a decoration sink' assertion"*, and reason from there that
a world with an empty decoration set would be **silent at every layer** — `nextPurchase`
returning `null`, `/app/growth` rendering `t.growth.noNextUpgrade`, suite green.

The premise is false. F2's reviewer read F1's Phase 5 **§5** (*No-harm*), which indeed only
sweeps decoration subsets for zero economic effect. F1's Phase 5 **§1** ships the assertion,
with the data: *"Ship the totality assertion with the data, in `tests/decorations.test.ts`:
for every slug in `WORLD_SLUGS`, `decorationsForWorld(slug).length` equals the per-world
count."* F1's success criterion 5.5 restates it, and F1's Phase 5 §1 spells out the
consequence for F2 by name.

This is the highest-value finding of the sweep, because it inverts a silent failure into a
loud one and cascades into CPD-2, CPD-3 and CPD-4.

**Fixed:** F2's Known Risk is struck through and rewritten as withdrawn-with-reason, with
the residual risk kept (*the assertion is contracted, not yet written — if F2's Phase 1
shows one red instead of two, that is the tell, and it is a finding for F1's impl-review*).
F2's Phase 6 §2 gains the correction inline.

### CPD-2 — F2's Phase 1 forbids the second red it is guaranteed to produce. — **FIXED in F2**

F2's Phase 1 success criteria read: *"**exactly one** case of `tests/shop-art-slots.test.tsx`
expected red … Record one red case, not two; **two reds here means something else broke**."*

With F1 in the tree, widening `WORLD_SLUGS` from four slugs to six turns **two**
F1-owned iterations red: the `shop-art-slots` per-world-table case (closed by F2's Phase 3)
**and** the `tests/decorations.test.ts` totality case from CPD-1 (closed by F2's Phase 4).
An implementer following the criterion as written would have burned a cycle hunting a
phantom bug, or — worse — "fixed" it by weakening F1's assertion.

**Fixed:** F2's Phase 1 criterion now names both expected reds by file and by symbol,
routes each to the phase that closes it, sets the failure condition at *three* reds, and
turns "only one red appears" into an explicit finding against F1 rather than a pass.
A matching note was added to F2's `## Critical Implementation Details`.

### CPD-3 — F2's commit grouping commits a red tree. — **FIXED in F2**

F2's ordering note fixes the working order as `0 → 1 → 3 → 2 → 4 → 5` and lands
**Phases 1 and 3 as one commit**, because Phase 1's red is closed by Phase 3. That was
sound under the one-red assumption. Under CPD-2 it is not: after Phases 1 + 3 the
`decorations` totality case is **still red**, so that commit violates the run's
*commit only on green* rule.

**Fixed:** the working order is now `0 → 1 → 3 → 4 → 2 → 5 → 6` and the green-commit
group is **1 + 3 + 4**.

### CPD-4 — F2's Phase 4 is marked droppable and its branch point conditional; neither survives the stack. — **FIXED in F2**

F2's Decision 6 allows a cut from `matmaverse-v2` with Phase 4 dropped, and Phase 4 is
titled *"CONDITIONAL on F1, droppable"* with a Progress row that writes
`DROPPED (F1 absent)`. Written when F1 was at research stage with no branch cut — reasonable
then, wrong now: §2 binds the F1 branch point, and CPD-1 means a dropped Phase 4 leaves the
**suite red**, not silently incomplete. F2 also hedges `UPGRADE_IDS` as *"six if F1 slipped,
eight if F1 landed"* in three places.

**Fixed:** the branch-point paragraph is rewritten as unconditional with a **BLOCKED**
escape instead of a fallback; Phase 4's title becomes *"MANDATORY under the run's stack"*
and its overview explains why dropping it is now red; Progress row 4.1 loses its `DROPPED`
state; Phase 3 §1 and `## Critical Implementation Details` state eight (while still telling
the implementer to *read* `UPGRADE_IDS`, per Phase 0, rather than trust the sentence);
Decision 4 and Decision 6 are annotated as superseded-in-the-concrete, with the
counterfactual kept on the record.

### CPD-5 — F1 contracts writing an assertion that already exists. — **FIXED in F1**

F1's Phase 3 §3 ends: *"Each must set **exactly one** of `left`/`right` and **one** of
`top`/`bottom`, as a percent in 0–100 — **a fourth assertion in the same file**."*

That assertion is already the fourth of the file's four data assertions:
`tests/shop-art-slots.test.tsx` § *"sets exactly one of left/right and one of top/bottom,
as percents in 0–100"*. Only a reader of F2 has this in hand — F2's Key Discoveries quote
the file's own module header on *"all four data assertions"*, and F2's Phase 3 §1 restates
the same shape contract as an existing constraint rather than a new one. The existing case
iterates `Object.entries(WORLD_SLOTS)` × `Object.entries(table)`, so it already covers
`precision` and `margin` the moment they are added, and will cover F2's two new tables with
no edit at all. Writing it again is duplicate coverage in a file both features depend on.

**Fixed:** F1's Phase 3 §3 now says do **not** write it, quotes the existing case, and
redirects the effort to a real gap in the same file — the module header's stale
*"`DEFAULT_SLOTS` covers all six ids, so `unplaced` is ALWAYS empty"* sentence, which
survives this tranche only because F1 adds both new ids to `DEFAULT_SLOTS`, and which
should get the same count-free rewrite as the case title.

### CPD-6 — F2 is forbidden from the type edit its own success criterion requires. — **FIXED in both**

F1 declares `ShopIconKey` a **closed** icon map so the art fallback cannot drift across
the five render surfaces, and asserts total coverage of it (F1 criterion 5.4). F2's Phase 4
§1 is bound to *"do not change the `Decoration` type"*. But F2's manual criterion 4.9
requires Laboratorium's decoration set to be **visibly different** from the others — which
is impossible if F2 may only reuse the icon keys F1's own 16 decorations happen to use.
F2 would have had to either ship indistinguishable sets or silently break its contract.

**Fixed, on both sides.** F2's Phase 4 §1 gains an explicit carve-out: `ShopIconKey` and
`ShopGlyph`'s map are **append-only and F2 may append to both**, one entry per key, with no
restructuring and no touching of the lookup. F1's Phase 3 §2 gains the matching obligation:
derive `ShopIconKey` as `keyof typeof SHOP_ICONS` so one map entry widens the union with no
type edit, and do not pin the map with an exhaustive literal count or fixed-length tuple —
criterion 5.4 must quantify over `DECORATIONS`/`UPGRADES`, never over a hardcoded key list.
Recorded as an append-only registry in §1a.

### CPD-7 — F2 carries a conditional sub-phase F1 has already decided against. — **FIXED in F2**

F2's Phase 4 §3 is *"Slot coordinates for the new decorations, **if** F1 places them in the
scene… at `WORLD_SLOTS` coordinates rather than in a separate row."* F1 settles it the other
way twice and explicitly: Phase 5 §1 — *"**No `slot` field**: the first batch takes
`ShopArt`'s documented corner-row fallback, which is exactly what lets sets ship one entry
at a time"* — and Phase 5 §4, which renders owned decorations *"through `ShopGlyph` in the
corner row"*. The sub-phase is dead work, and left live it invites an implementer to add
decoration ids to `WORLD_SLOTS`, where `tests/shop-art-slots.test.tsx`'s id sweep does not
expect them.

**Fixed:** F2's Phase 4 §3 is retitled **RESOLVED: not needed**, quotes both F1 passages,
and contracts *no change to `ShopArt.tsx` in this phase* — with a follow-the-code escape if
the landed F1 contradicts its own plan.

### CPD-8 — F2 declares `playwright.config.ts` uncontended on a true premise with a false scope. — **FIXED in F2**

F2's Phase 5 §0 concludes: *"`playwright.config.ts` is not touched by F1 (its plan ships
**no new E2E specs**), so this is not a contention point."* The premise checks out — F1's
Phase 6 edits `e2e/growth.spec.ts` only, and F1's *What We're NOT Doing* says *"No new E2E
specs… new browser coverage belongs to the run's `/10x-e2e` step."* But that last clause is
the problem: the run's `/10x-e2e` step for F1 is a **later step of this same run** and may
add a spec that needs the same `touch` alternation. A replaced alternation is silent — the
spec still runs, desktop-only, at the exact viewport that cannot carry its risk. This is
L-009's shape ("verify the path, not the fact") applied to a config file.

**Fixed:** F2's Phase 5 §0 now says the file **is** a contention point, just not with F1's
*plan*; §1a assigns F2 as owner and binds every other writer — F1's e2e step included — to
extend-never-replace, keeping both alternatives on conflict.

### Checked and clean — no defect found

Recorded so the next reader does not re-derive them:

- **`docs/reference/contract-surfaces.md`.** The source run's accidental collision was
  here, so it was checked section by section. F1 writes two sections; F2 writes none, and
  F2's abstention is *correct* — the § `World-change surface (F5)` paragraph names no world
  count, so six worlds leaves it true.
- **The per-world vocabulary decision.** F1's AD-8 and F2's Decision 1 were made
  independently and **agree** (ship on the mandatory `t.worlds[slug].upgrades[id] ??
  t.upgrades[id]` fallback; write zero of the 48 strings). The contract's open decision #3
  is therefore settled consistently across both plans, and each carries the same reversal
  condition. No reconciliation needed.
- **The decoration count.** F1's AD-5 sets four per world at 40/80/140/220 and already
  budgets *"6 × 4 = 24"* — i.e. it sized the art debt including F2's two worlds. F2's
  Decision 3 inherits N from F1 and names 4. Consistent; the contract's open decision #4
  is settled at **four**.
- **`e2e/growth.spec.ts`'s seed.** F1 re-seeds it with the four decorations of the
  **seeded** world. F2 adds decorations only to `pracownia` and `laboratorium`, neither of
  which is the seeded world. No interference.
- **The wallet-debit invariant.** F1's AD-4 argues the decoration buy is a *second
  sanctioned spend path* beside `buyUpgrade`, and restates for impl-review: *reject a
  wallet debit on the **shift** path, not on the buy path*. This is consistent with the
  contract's reject-on invariant, which names the shift path (`wallet -= rent`). Reviewers
  must not reject `buyDecoration`'s debit on FR-008 grounds.
- **The nav bar.** See §5 — no defect, and the arithmetic is inert this run.

---

## 4. The migration lane

> **Migration author for run `2026-08-27-world-economy`: NONE.**

No feature writes a migration. The full reasoning, per feature, is in §1e. The rule for
implementers: a concluded need for a migration is a **STOP and report**, never a file you
write — and if one is ever authorised, it carries granular per-operation, per-role RLS
policies in the same file (L-001), with isolation tests that do not lean on a chained
`.select()` read-back (L-002).

---

## 5. Nav-bar arithmetic and the L-007 sweep

### Tabs at 712px — the bar holds, and neither feature touches it

**Neither F1 nor F2 adds a nav entry**, so the tab-count question the source run's merge
surfaced is **inert this run** — but it was measured rather than assumed, because that is
exactly the check the source run skipped.

- `t.nav.items` has **six** keys today and **six** after both features:
  `dashboard` (Pulpit) · `missions` (Misje) · `shop` (Mój sklep) · `growth` (Rozwój świata) ·
  `worlds` (Światy) · `parent` (Panel rodzica).
- F1 adds no route under `src/pages/app/` — its decoration shop lives inside the existing
  `/app/upgrades`, reached from `/app/growth`'s CTA. F2 adds no route either and says so
  explicitly (*"No new nav entry. `t.nav.items.worlds` ('Światy') and `/app/worlds` already
  ship"*).
- **The bar is already proven at six.** `e2e/growth.spec.ts` § *"every nav entry stays
  uniquely reachable and the shell never scrolls sideways (Risk E2E-F4-2)"* iterates
  `Object.entries(t.nav.items)` and measures `scrollWidth` vs `clientWidth` **on the
  `getByRole("navigation", { name: t.nav.primaryLabel })` element itself** — not on
  `document.documentElement`, which cannot see overflow inside the `position: fixed`
  bottom bar. It runs in the `touch` project at **712px** and is green in the run baseline
  (26/26). Six tabs across 712px is ≈118px of gross width each, which is the shipped,
  measured state — the source run's 116px squeeze was the *seventh* tab.
- **Because the assertion is data-driven, it grows on its own.** Any future feature adding
  a seventh key gets a red from an existing test rather than a silent squeeze. Nobody in
  this run needs to add a tab-count assertion.
- **The standing rule still binds both features:** chrome toggles with `hidden` /
  `lg:hidden` (`display`), never `opacity` — both navs are in the DOM at every viewport, so
  `opacity` would leave two copies of every accessible name in the tree. And `hidden` loses
  to a class that sets its own `display` (e.g. `inline-flex` from `buttonVariants`) — put
  the breakpoint on the wrapper. F2's Phase 2 touches two grids; neither is nav chrome.

### L-007 — the two-direction substring sweep

Run **before** each label is committed, in **both** directions: no new label may contain an
existing one, and no existing label may contain a new one.

**Nav labels, checked programmatically now:** all six pairwise containments across
`t.nav.items` — **clean**. ("Rozwój świata" and "Światy" coexist safely; neither contains
the other. The dictionary's own comment records why `growth` is deliberately *not*
"Rozwój sklepu".)

**F2's two world names, checked now:** `grep -rni 'pracowni\|laborator' src/ e2e/ tests/`
returns **nothing** — clean in both directions at sweep time. This is load-bearing:
`World.name` is an accessible name in two grids (`WorldPicker` via `SelectTile`'s `label`,
`CreateProfileWizard` via `alt` **and** `label`) and `e2e/onboarding.spec.ts` locates a tile
by it. **F2 must re-run this check on its own branch**, not inherit it — F1 appends
~25 new labels to the same dictionary immediately beforehand.

**Still to be checked, by the owner, at the moment the label is written:**

| Feature | Labels needing the sweep | Known nearby strings to check against |
|---|---|---|
| F1 | `t.results.{revenueLabel,costLabel,profitLabel,breakdownHeading}` | `t.stages.popyt` = *"Popyt i zysk"*, `t.stages.oferta.desc` = *"…większe zyski!"*, `t.parent…` = *"Zarządzaj produktami, cenami i zyskami."*, and `t.results.earnedLabel` (*"Do portfela: +{earned}"*), which **must keep its exact text** — `e2e/gameplay-restore.spec.ts` matches it. |
| F1 | `t.upgrades.precision`, `t.upgrades.margin` (`{ name, desc }`) | `t.upgrades.register` = *"Lepsza kasa"* and the other five entries; the whole `t.stages` block. |
| F1 | `t.upgradeShop.{lockedByBranch,decorationsHeading,decorationsHint}` | `t.upgradeShop.{decisionPrompt,nextProgress}` — both asserted by `e2e/gameplay-restore.spec.ts`. |
| F1 | `t.decorations[id]` × 16 | each other, and the eight catalogue names. |
| F2 | `t.decorations[id]` × 8 (`pracownia-*`, `laboratorium-*`) | F1's 16, on F2's own branch. |

**Do not touch** `t.growth.noNextUpgrade` (*"Masz już wszystkie ulepszenia dostępne na tym
etapie."*). F1 records that it is now slightly imprecise — it fires when decorations are
exhausted too, and a decoration is not an *ulepszenie* — and keeps it **verbatim on
purpose**: it is asserted by `e2e/growth.spec.ts` and rewording it risks a substring
collision for no product gain. That call is correct and is binding on both features;
revisit it with the native-speaker copy review, not in this run.

**Prefer `getByRole(..., { name, exact: true })`** over `getByText` for anything a test
locates — with one documented exception both features must respect:
`CreateProfileWizard` passes the world name as **both** `alt` and `label` to `SelectTile`,
so each wizard tile's accessible name is doubled (*"Pracownia Pracownia"*). That is
pre-existing across all four shipped worlds, it is why `e2e/onboarding.spec.ts` needs
`.first()`, and it is why any new **wizard-tile** locator must **not** use
`{ exact: true }` on the bare name. `WorldPicker` passes `alt=""` deliberately to avoid
exactly this, and its `/app/worlds` tiles are safe for `{ exact: true }` — which is what
F2's Phase 5 spec relies on.

---

## 6. Rules that outlive this run

Candidates for `.claude/skills/10x-autonomous-run/references/lessons-addendum.md`, so the
next run starts from them:

1. **A downstream feature's "conditional / droppable" phase must be re-decided by the
   sweep, not by the implementer.** F2's Phase 4 was written as droppable against a world
   in which F1 might not exist. Once the stack binds the branch point, "conditional" is
   stale documentation that reads as live permission. Four of the eight defects here
   (CPD-2, CPD-3, CPD-4, CPD-7) are one plan's conditionals that the other plan had
   already resolved. **The sweep's job is to collapse every cross-plan conditional into a
   decision.**
2. **A plan's `## Known risks` can go stale between plan-review and the sweep, and a stale
   risk is worse than a missing one.** CPD-1 was a *review-added* risk asserting a gap in a
   sibling plan that the sibling had already closed — it would have licensed exactly the
   silent failure it warned about. **Every cross-plan claim in a `## Known risks` section
   must be re-verified against the sibling's current text.**
3. **When one feature declares a registry "closed", check whether a sibling is required to
   extend it.** CPD-6: a closed `ShopIconKey` protecting against drift directly contradicted
   a sibling's own success criterion. The resolution — closed but *append-extensible*,
   derived as `keyof typeof MAP` — generalises to every registry a run shares.
4. **"Feature X does not touch file Y" must be scoped to X's whole run, not X's plan.**
   CPD-8: F1's *plan* ships no E2E spec, but F1's *e2e step* may. Config files edited by a
   later step of the same run are contention points the sweep must assign.
5. **`playwright.config.ts`'s project `testMatch` is an alternation, and it is
   extend-never-replace.** A replaced alternative is silent: the spec still runs, at the
   wrong viewport. Same class as `contract-surfaces.md` — nothing validates it.
6. **Count the nav tabs even when nobody adds one.** It costs one `grep` and it is the
   check the source run's merge wished it had. Here the answer was "six, unchanged, and
   already proven by a data-driven E2E" — which is worth writing down precisely because it
   means no one needs to look again.
