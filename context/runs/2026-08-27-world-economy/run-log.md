# Autonomous run — world economy: profit rule + six worlds, 2026-08-27

Backlog source: `context/foundation/backlog.md`, entries **E1**, **W1**.
Standing brief for every step: `agent-contract.md` (same folder).
Process definition: `.claude/skills/10x-autonomous-run/references/process.md`.
Design: `docs/superpowers/specs/2026-08-27-world-economy-design.md` (D-11…D-13).
Rationale / rejected alternatives: `context/foundation/shape-notes-world-economy.md` (D-1…D-13).

**Written by the orchestrator only.** Subagents write their own change folders;
they never edit this file.

## Baseline — measured, not assumed

| | value |
|---|---|
| Base branch | `matmaverse-v2` at `91754ef` |
| `npm test` | 548 passed / 548, 57 / 57 files |
| `npx playwright test` | 26 passed / 26 |
| `npm run lint` / `npm run check` | exit 0 / exit 0 — 0 errors, 0 warnings, 8 hints, 202 files |
| Rule-file validation (step 0) | PASS — 6 rule files, 83 paths checked, 0 missing |

Measured by the maintainer on the base branch with the command sandbox disabled,
and re-confirmed by the orchestrator for the cheap checks (clean tree, no stale
worktrees, Supabase REST 200 on `127.0.0.1:54321`, nothing listening on 4321/4322,
rule-file validation PASS).

## Features

**F1 — E1 `world-economy-profit-rule`.** Turns a one-term economy with one
purchasable effect into a profit rule with a real decision in it:
`profit = max(0, revenue − cost)`, where cost is `shopRunningCost(investment)` over
the *investment* subset only, and the wallet is **never** debited. The catalogue
lands at **8 entries and stops** (1 unlock + 5 capacity + 2 margin), and a
**second, non-catalogue list of per-world decorations** (D-11) becomes the wallet's
sink, renewing per world. No mockup binds it — it is data and pure modules
(`src/data/upgrades.ts`, `src/data/shift.ts`) plus two callers. **No migration**:
`shop_state.purchased` gains the optional sibling `decorations?: string[]` in the
same jsonb. The headline deliverable is not the code but the **three invariants** —
no-trap, no-harm, no-dominance (D-12, over *reachable* states only, and naming that
reachability filter is part of the deliverable) — plus the **D-13 pacing model**,
a pure simulation importing `src/data/*` and consuming
`scripts/telemetry-harness/child-model.ts`, which also derives the reference shift.
Open decisions the planner must record, not invent: how many decorations per world
in the first batch. Settled and **not** open: decorations render with **no art**
via the `src/data/stages.ts` precedent (`art?: string` unset, lucide + design
tokens, upgrade path in the module header).

**F2 — W1 `six-worlds-catalogue`.** Closes the PRD-v3-assumes-six / code-has-four
gap. Cost has dropped twice: the world-card art is already converted and committed
(`public/illustrations/world-pracownia.webp`, `world-laboratorium.webp`, both
896×718, provenance in `slice-map.md`), and the names are settled — `pracownia` /
Pracownia and `laboratorium` / Laboratorium. **Slug, filename stem and
`child_profiles.theme` value must stay identical.** What is left is code: two
`WORLDS` entries, two i18n names, each world's **own decoration set** (D-11 — the
first thing that makes six worlds mechanically worth having, and it grants no world
an economic advantage because a decoration has zero economic effect by
construction), and whatever vocabulary the open decision settles. **No migration**:
`child_profiles.theme` is `text not null default 'default'` with no CHECK
constraint, so adding worlds only widens a zod enum. Open decision the planner must
record, not invent: whether W1 writes per-world catalogue vocabulary (6 × 8 strings)
or ships on the mandatory `t.worlds[slug].upgrades[id] ?? t.upgrades[id]` fallback.

## Status

| Feature | new | research | plan | plan-review | implement | impl-review | e2e | branch |
|---|---|---|---|---|---|---|---|---|
| F1 `world-economy-profit-rule` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | `feat/world-economy-profit-rule` |
| F2 `six-worlds-catalogue` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | `feat/six-worlds-catalogue` |

Legend: — pending · ▶ running · ✓ done · ! needs attention · ✗ dropped from the run

## Stack order and ownership

> Filled by the **contention sweep** once every plan exists, and binding from then
> on. Full detail in `ownership.md`.

**Settled by the sweep: one serial stack, `world-economy-profit-rule` → `six-worlds-catalogue`.**
Nothing was dropped; both features are planned and both run. There is **no
independent stack this run** — that is a finding, not caution: F1 and F2 share four
write surfaces (`src/i18n/pl.ts`, `src/components/child/ShopArt.tsx`,
`src/data/decorations.ts`, `tests/shop-art-slots.test.tsx`), so no pair of features
shares no resource and there is nothing to run concurrently.

The orchestrator pre-declared this edge as a **PREFERENCE** (a `pl.ts` file
collision plus naming the catalogue once). The sweep **upgrades it to a
PREREQUISITE** on three couplings neither plan could see alone:

1. **F2 depends on symbols only F1 creates.** F2's Phase 4 appends `Decoration`
   records to `DECORATIONS` in `src/data/decorations.ts`, using the `Decoration`
   interface and `ShopIconKey` that F1 introduces. Neither symbol exists on
   `matmaverse-v2`, and F2's own Decision 4 verified their absence.
2. **F2 turns an F1 assertion red and is the only thing that can close it.** F1's
   Phase 5 §1 ships a per-world totality assertion in `tests/decorations.test.ts`
   (for every slug in `WORLD_SLUGS`, `decorationsForWorld(slug).length` equals the
   per-world count). F2's Phase 1 widens `WORLD_SLUGS` to six, turning it RED; only
   F2's Phase 4 closes it.
3. **`UPGRADE_IDS` is eight, not six, at F2's branch point.** F1's Phase 3 adds
   `precision` and `margin`; F2's Phase 3 sizes two new `WORLD_SLOTS` tables to
   `UPGRADE_IDS`. Cut from `matmaverse-v2` those tables would be green on F2's
   branch and guaranteed red at merge.

The original preference **rides along on the same edge** — a cheaper rebase, not a
separate edge: both features append to `src/i18n/pl.ts` and both write into the
`WORLD_SLOTS` literal in `ShopArt.tsx`, and F1-first still means the eight catalogue
entries are named once rather than six and then two more. It remains true; it is
simply not the strongest reason.

**Consequence now fixed into F2's plan:** the branch point is **unconditional** —
F2 is cut from `feat/world-economy-profit-rule`. If that branch is absent, F2
reports **BLOCKED** rather than falling back to `matmaverse-v2`, because (per CPD-1)
a dropped Phase 4 leaves the suite RED.

### Ownership of contended resources

Full detail in `ownership.md`; the binding assignments are:

| Resource | Writers | Owner | Rule |
|---|---|---|---|
| `src/i18n/pl.ts` | F1 + F2 | **F1** | Append only, one key per entry. F1 creates `t.results.{revenueLabel,costLabel,profitLabel,breakdownHeading}`, `t.upgrades.{precision,margin}`, `t.upgradeShop.{lockedByBranch,decorationsHeading,decorationsHint}`, `t.decorations[id]`×16. F2 then appends **only** `t.decorations[id]`×8 plus one comment above `marketing.worlds`. F2 must not move `t.marketing.worlds`, must not touch `t.worlds`, must not move world names into the dictionary. Two-direction L-007 grep before every label, re-run on F2's own branch (F1 appends ~25 labels immediately before). |
| `src/components/child/ShopArt.tsx` | F1 + F2 | **F1** | F1 owns the component: `ShopArtProps` (gains `decorations: string[]`), the render function, `DEFAULT_SLOTS`, the module header, and the three shipped `WORLD_SLOTS` tables into which it adds `precision`+`margin`. F2 owns **two new keys in the `WORLD_SLOTS` literal only** (`pracownia`, `laboratorium`) — no restructuring, no `DEFAULT_SLOTS`, no function edit. `kawiarnia` stays absent both ways. No decoration id ever enters `WORLD_SLOTS`. |
| `src/data/decorations.ts` | F1 + F2 | **F1** | F1 authors `Decoration`, `ShopIconKey`, `DECORATIONS` (16 = 4 worlds × 4), `DECORATION_IDS`, `getDecoration`, `decorationsForWorld`, `readDecorations`, `canBuyDecoration`, `nextPurchase`, the ART DEVIATION header. F2 appends 8 entries (2 worlds × 4 at 40/80/140/220) and nothing else. **One carve-out:** `ShopIconKey` and `ShopGlyph`'s icon map are append-only and F2 **may** append to both. |
| `tests/shop-art-slots.test.tsx` | F1 + F2 | **F1** | F1 renames the count-bearing case title and rewrites the module header's stale "DEFAULT_SLOTS covers all six ids"; F1 adds **no** new assertion (CPD-5). F2 does not edit it at all — it anchors on the `Object.entries(WORLD_SLOTS)` loop and the failure string, never a title (L-006). Its four data assertions and one render case must not be simplified into fixed lists by either feature. |
| `tests/decorations.test.ts` | F1 + F2 | **F1** | F1 authors it, including the per-world totality assertion. F2 does **not** edit it — F2 makes it green by supplying data. An implementer who finds themself editing this file is doing F1's work. |
| `playwright.config.ts` (the touch project's `testMatch` alternation) | F2 + F1's later `/10x-e2e` step | **F2** | Extend the alternation to `/(gameplay-restore\|growth\|worlds)\.spec\.ts/`; every other writer **extends and never replaces**, and on conflict keeps **both** alternatives. A lost alternative is silent — the spec still runs, desktop-only, at the one viewport that cannot carry its risk. |
| `src/lib/services/child-profiles.ts` | F1 only | **F1** | `recordShiftResult` (wallet += profit) and the new `buyDecoration`. F2 must not touch `src/lib/services/` at all this run — the source run's four-way collision on one service file is pre-empted by making the lane single-owner. |
| `src/lib/services/reports.ts` | neither | **nobody** | F1 only *reads* `computeWeeklyReport`'s `earningsKnown` predicate to justify AD-6 (a decoration writes no `shift_log` row). Any implementer who concludes they must edit it: stop and report. |
| `src/types.ts` | F1 only | **F1** | `ShopState` gains `decorations?: string[]`; append-only. F2 does not touch it. |
| `src/data/upgrades.ts` | F1 only | **F1** | `ShopEffects`/`shopEffects`/`shopRunningCost`, the `runningCost`+`margin`+`requiredUpgrade` fields, `precision`+`margin` entries, `canBuy`'s branch-locked rung, ART DEVIATION header. F2 reads `UPGRADE_IDS` and writes nothing. |
| `src/data/worlds.ts` | F2 only | **F2** | The two `World` records and the header's name↔slug↔art reconciliation. F1 reads `WORLD_SLUGS` and writes nothing. |
| `src/data/shift.ts` | F1 only | **F1** | `profitForShift`; the `shift.ts` ⇸ `upgrades.ts` seam stays closed except for the **type-only** `ShopEffects` import. |
| `src/components/child/{ShiftScreen,ShiftResults,UpgradeShop}.tsx` + the new `ShopGlyph.tsx` | F1 only | **F1** | F2 touches none of them. |
| `src/components/child/{WorldPicker,CreateProfileWizard}.tsx` | F2 only | **F2** | Grid reflows plus the two header rewrites. F1 touches neither. |
| Routes under `src/pages/app/` | F1 only | **F1** | **No new route in either feature.** F1 edits the three existing ones — `upgrades.astro`, `start.astro`, `growth.astro` (the three "next thing" surfaces switch `nextUpgrade` → `nextPurchase`; the `<img src={…art}>` sites become `ShopGlyph`). F2 edits **no** route — its Phase 2 changes `WorldPicker.tsx` and `CreateProfileWizard.tsx`, not `worlds.astro`. Zero route contention. |
| `src/pages/api/decorations/buy.ts` (new) | F1 only | **F1** | Must `export const prerender = false`; zod `z.enum(DECORATION_IDS)`; `json()` + `applyNoStore`. F2's 8 new ids widen the enum automatically — F2 does not touch the route. |
| Nav entries | neither | **nobody** | Neither feature adds a nav entry. `t.nav.items` stays at **six** keys: Pulpit, Misje, Mój sklep, Rozwój świata, Światy, Panel rodzica. See the nav arithmetic below. |
| `e2e/growth.spec.ts` | F1 only | **F1** | The known Risk E2E-F4-3 re-seed (never delete the assertion; preserve `t.growth.upgradesLink`). F2 must not re-seed it a second time. |
| `docs/reference/contract-surfaces.md` § `public.child_profiles` Columns + § `public.shift_log` | F1 only | **F1** | `decorations?` sibling; `earned` now carries profit, and a decoration purchase writes no row. Checked **section by section**, because this is where the source run's accidental collision was: § "World-change surface (F5)" names no world count, so F2 growing `WORLDS` to six leaves it true — F2's abstention is **correct, not an oversight**. Genuinely uncontended this run. |
| `src/i18n/pl.ts` § the `t.worlds` namespace | neither | **nobody** | A world-selection **screen** namespace, deliberately not keyed by slug. F1's AD-8 and F2's Decision 1 independently **agree** to write zero of the 6×8 per-world catalogue strings and to ship on the mandatory `t.worlds[slug].upgrades[id] ?? t.upgrades[id]` fallback — settling the contract's open decision #3 consistently. Future vocabulary must not nest here; `t.worlds.bySlug[slug]` or a sibling namespace are the non-colliding homes. |
| `public/illustrations/slice-map.md` | neither writes | **nobody** | F2's world-card rows are already committed on the base; **neither** feature commits new art (F1's margins and all decorations ship art-less through `ShopGlyph`, per AD-3 and the `src/data/stages.ts` precedent). `assets/` is absent from both worktrees, so every layout in both plans is an explicit extrapolation. |

**Nav arithmetic at 712px — the bar holds, measured not assumed.** Six tabs before
and after both features. `e2e/growth.spec.ts` § Risk E2E-F4-2 iterates
`Object.entries(t.nav.items)` and measures `scrollWidth` vs `clientWidth` on the
`getByRole('navigation', {name: t.nav.primaryLabel})` element **itself** — not
`document.documentElement`, which cannot see overflow inside the `position:fixed`
bottom bar. It runs in the touch project at 712px and is green in the baseline
(26/26). Six tabs across 712px is ≈118px gross each — the shipped, measured state;
the source run's 116px squeeze was the **seventh** tab. Because the assertion is
data-driven it grows on its own, so nobody in this run needs to add a tab-count
assertion. The standing rule still binds: toggle chrome with `hidden`/`lg:hidden`
(display), never `opacity`; `hidden` loses to a class setting its own display
(`inline-flex` from `buttonVariants`) — put the breakpoint on the wrapper.

**L-007 two-direction grep — run now, clean.** All six pairwise containments across
`t.nav.items` were checked programmatically: no collision ("Rozwój świata" and
"Światy" coexist safely; neither contains the other). For F2's world names,
`grep -rni 'pracowni\|laborator' src/ e2e/ tests/` returns **nothing** — clean in
both directions at sweep time. This is load-bearing because `World.name` is an
accessible name in two grids and `e2e/onboarding.spec.ts` locates a tile by it. **F2
must re-run the grep on its own branch, not inherit this result** — F1 appends ~25
labels to the same dictionary immediately before. Still to check at write time: F1's
`results`/`upgrades`/`upgradeShop`/`decorations` labels against `t.stages` ("Popyt i
zysk", "…większe zyski!"), `t.upgrades.register` ("Lepsza kasa"), and
`t.results.earnedLabel` + `t.upgradeShop.{decisionPrompt,nextProgress}`, which
`e2e/gameplay-restore.spec.ts` asserts verbatim. Do **not** touch
`t.growth.noNextUpgrade` — F1 correctly keeps it verbatim despite it being slightly
imprecise. Prefer `getByRole(name, {exact:true})`, **except** wizard tiles:
`CreateProfileWizard` passes the world name as both `alt` **and** label, so each
tile's accessible name is doubled ("Pracownia Pracownia") — pre-existing, the reason
`onboarding.spec.ts` needs `.first()`, and the reason no new wizard-tile locator may
use `{exact:true}` on the bare name. `WorldPicker` passes `alt=''` deliberately, so
`/app/worlds` tiles **are** safe for `{exact:true}` — which is what F2's Phase 5 spec
relies on.

### Cross-plan defects found and fixed

All eight were **fixed in place** in the plans; no plan was left carrying a known
defect into implementation.

- **CPD-1 — fixed in F2** (`plan.md`, ## Known risks + Phase 6 §2). F2's
  review-added risk asserted that "F1 contracts no every-world-has-a-sink
  assertion", and reasoned that an empty decoration set would be **silent** at every
  layer (`nextPurchase` → `null`, `/app/growth` renders `t.growth.noNextUpgrade`,
  suite green). The premise is false: F2's reviewer read F1's Phase 5 §5 (No-harm,
  which only sweeps subsets for zero economic effect); F1's Phase 5 §1 ships the
  assertion **with the data** in `tests/decorations.test.ts`, and F1's criterion 5.5
  restates it. Highest-value finding of the sweep — it inverts a silent failure into
  a loud one, and cascades into CPD-2/3/4. Fix: the risk is struck through and
  rewritten as withdrawn-with-reason, keeping the residual risk (if F2's Phase 1
  shows one red instead of two, the assertion did not ship — a finding for F1's
  impl-review, not something F2 papers over).
- **CPD-2 — fixed in F2** (Phase 1 Success Criteria + ## Critical Implementation
  Details). F2's Phase 1 said "exactly **one** case expected red … two reds here
  means something else broke." With F1 in the tree, widening `WORLD_SLUGS` 4→6 turns
  **two** F1-owned iterations red: `shop-art-slots`' per-world-table case (closed by
  F2 Phase 3) **and** `tests/decorations.test.ts`' totality case (closed by F2 Phase
  4). An implementer following the old criterion would have burned a cycle hunting a
  phantom bug — or "fixed" it by weakening F1's assertion. Fix: both expected reds
  are named by file and symbol, each routed to the phase that closes it; the failure
  condition moves to **three** reds; and "only one red appears" becomes an explicit
  finding against F1 rather than a pass.
- **CPD-3 — fixed in F2** (## Critical Implementation Details, the ordering note).
  F2 fixed the working order 0→1→3→2→4→5 and landed Phases 1+3 as **one commit** —
  sound under the one-red assumption, but under CPD-2 the decorations totality case
  is **still red** after 1+3, so that commit violates the run's commit-only-on-green
  rule. Fix: working order is now 0→1→3→4→2→5→6, and the green-commit group is
  1+3+4.
- **CPD-4 — fixed in F2** (Implementation Approach branch paragraph, Phase 4
  title+overview, Progress row 4.1, Phase 3 §1, Critical Implementation Details,
  Decisions 4 and 6, plus a superseded-marker on the Progress Phase 4 heading). F2's
  Decision 6 allowed a cut from `matmaverse-v2` with Phase 4 dropped; Phase 4 was
  titled "CONDITIONAL on F1, droppable" with a DROPPED Progress state; and
  `UPGRADE_IDS` was hedged "six if F1 slipped, eight if F1 landed" in three places.
  Reasonable when written (F1 was at research stage with no branch cut), wrong now:
  the stack binds the F1 branch point, and per CPD-1 a dropped Phase 4 leaves the
  suite RED. Fix: the branch paragraph is unconditional with a **BLOCKED** escape
  instead of a fallback; Phase 4 is retitled **MANDATORY** with the reasoning; row
  4.1 loses its DROPPED state; eight is stated everywhere while still telling the
  implementer to **read** `UPGRADE_IDS` in Phase 0 rather than trust the sentence;
  Decisions 4 and 6 are annotated as superseded-in-the-concrete, with the
  counterfactual kept on record.
- **CPD-5 — fixed in F1** (`plan.md`, Phase 3 §3). F1 contracted "a fourth assertion
  in the same file" for the slot-shape rule — but that assertion already **is** the
  fourth of the file's four data assertions:
  `tests/shop-art-slots.test.tsx` § "sets exactly one of left/right and one of
  top/bottom, as percents in 0–100" (verified in source at the
  `Object.entries(WORLD_SLOTS)` × `Object.entries(table)` loop). Only a reader of F2
  has this in hand — F2's Key Discoveries quote the file's own module header on "all
  four data assertions". The existing case already covers `precision`+`margin` the
  moment they are added, and covers F2's two new tables with no edit. Fix: F1 now
  says **do not write it**, quotes the existing case, and redirects the effort to a
  real gap in the same file — the module header's stale "DEFAULT_SLOTS covers all six
  ids, so `unplaced` is ALWAYS empty", which survives this tranche only because F1
  adds both new ids to `DEFAULT_SLOTS`.
- **CPD-6 — fixed in BOTH plans** (F2 Phase 4 §1; F1 Phase 3 §2). F1 declares
  `ShopIconKey` a **closed** icon map so the art fallback cannot drift across five
  render surfaces, and asserts total coverage (criterion 5.4). F2's Phase 4 §1 is
  bound to "do not change the `Decoration` type" — yet F2's manual criterion 4.9
  requires Laboratorium's set to be **visibly different**, impossible if F2 may only
  reuse the keys F1's own 16 decorations happen to use. F2 would have had to ship
  indistinguishable sets or silently break its contract. Fix on both sides: F2 gains
  an explicit carve-out (`ShopIconKey` and `ShopGlyph`'s map are append-only, one
  entry per key, no restructuring, no touching the lookup); F1 gains the matching
  obligation — derive `ShopIconKey` as `keyof typeof SHOP_ICONS` so one map entry
  widens the union with no type edit, and do **not** pin the map with an exhaustive
  literal count or fixed-length tuple (criterion 5.4 must quantify over
  `DECORATIONS`/`UPGRADES`, never a hardcoded key list).
- **CPD-7 — fixed in F2** (Phase 4 §3). F2 carried "Slot coordinates for the new
  decorations, **if** F1 places them in the scene at `WORLD_SLOTS` coordinates rather
  than in a separate row." F1 settles it the other way twice and explicitly: Phase 5
  §1 ("No slot field: the first batch takes ShopArt's documented corner-row
  fallback") and Phase 5 §4 ("through `ShopGlyph` in the corner row"). Dead work —
  and left live, it invites an implementer to add decoration ids to `WORLD_SLOTS`,
  where `shop-art-slots`' id sweep does not expect them. Fix: retitled "RESOLVED: not
  needed", both F1 passages quoted, contracting **no** change to `ShopArt.tsx` in
  that phase, with a follow-the-code escape if landed F1 contradicts its own plan.
- **CPD-8 — fixed in F2** (Phase 5 §0). F2 concluded "`playwright.config.ts` is not
  touched by F1 (its plan ships no new E2E specs), so this is not a contention
  point." The premise checks out, but the scope is wrong: F1's own
  What-We're-NOT-Doing defers new browser coverage to "the run's `/10x-e2e` step" — a
  **later step of this same run**, which may add a spec needing the same touch
  alternation. A replaced alternation is silent (the spec still runs, desktop-only,
  at the exact viewport that cannot carry its risk) — L-009's shape applied to a
  config file. Fix: F2 now says the file **is** a contention point, just not with
  F1's plan; `ownership.md` assigns F2 as owner and binds every other writer, F1's
  e2e step included, to extend-never-replace and to keep both alternatives on
  conflict.

**Checked and clean — no defect, recorded so the next reader does not re-derive it.**
(a) `docs/reference/contract-surfaces.md` — the source run's accidental collision was
here, so it was checked section by section; F1 writes two sections, F2 writes none,
and F2's abstention is **correct** because § "World-change surface (F5)" names no
world count. (b) The per-world vocabulary decision — F1's AD-8 and F2's Decision 1
were made independently and **agree** (ship on the mandatory fallback, write zero of
the 48 strings), settling the contract's open decision #3 consistently, with matching
reversal conditions. (c) The decoration count — F1's AD-5 sets four per world at
40/80/140/220 and already budgets "6 × 4 = 24", i.e. it sized the art debt including
F2's two worlds; F2's Decision 3 inherits N=4. Contract open decision #4 is settled at
**four**. (d) `e2e/growth.spec.ts`' seed — F1 re-seeds with the four decorations of
the **seeded** world; F2 adds decorations only to `pracownia` and `laboratorium`,
neither of which is seeded. No interference. (e) The wallet-debit invariant — F1's
AD-4 is consistent with the contract's reject-on rule, which names the **shift** path
(`wallet -= rent`); reviewers must **not** reject `buyDecoration`'s debit on FR-008
grounds.

**Migration author: none.** Neither feature ships a Supabase migration this run —
F1's `decorations?: string[]` is a sibling inside the existing `shop_state` jsonb,
and F2's two worlds only widen a zod enum over `child_profiles.theme`, which is
`text not null default 'default'` with no CHECK constraint.

## Run log

- **2026-08-27** — Run opened. Preflight green: tree clean at `91754ef`, no stale
  worktrees, Supabase REST 200, nothing listening on 4321/4322/4330/4331,
  `validate-rule-files.sh` PASS (83 paths, 0 missing), `lessons.md` and
  `lessons-addendum.md` both present. Baseline recorded above. Contract filled with
  zero remaining `<<< >>>` slots and extended with a run-specific binding section
  carrying D-11…D-13, the four must-not-invent decisions, the four reject-on
  invariants, and the known `growth.spec.ts` regression.
- **2026-08-27** — **Docs lane finished: 2 of 2 features planned, 0 dropped.** Both
  F1 `world-economy-profit-rule` and F2 `six-worlds-catalogue` completed new →
  research → plan → plan-review, and both plans are approved. The contention sweep
  then ran across the two finished plans and filled "Stack order and ownership"
  above: **one serial stack, F1 → F2**, with the orchestrator's pre-declared
  *preference* edge **upgraded to a prerequisite** on three couplings neither plan
  could see alone (F2 consumes `Decoration`/`ShopIconKey` that only F1 creates; F2
  turns F1's per-world totality assertion red and is the only thing that closes it;
  `UPGRADE_IDS` is eight at F2's branch point, not six). There is **no independent
  stack** — the two features share four write surfaces, so nothing can run
  concurrently in the code lane. The sweep found **eight cross-plan defects
  (CPD-1…CPD-8)** and fixed every one in place in the plans — six in F2, one in F1,
  one in both — the largest being CPD-1, which inverts a would-be silent
  empty-decoration-set failure into a loud one. Five further areas were checked and
  found clean, and are recorded above so the next reader does not re-derive them.
  **No migration author:** neither feature ships a Supabase migration. The code lane
  is now clear to start with F1.
- **2026-08-27** — **Code lane finished: 2 of 2 features built, 0 blocked, 0 halted,
  0 dropped.** Both features ran the full chain through implement → impl-review →
  e2e and both came back **APPROVED with 0 critical findings and 3 warnings each**.
  F1 `world-economy-profit-rule` on `feat/world-economy-profit-rule` off
  `matmaverse-v2`; F2 `six-worlds-catalogue` on `feat/six-worlds-catalogue` cut, as
  the sweep bound it, off `feat/world-economy-profit-rule`. Both reported merge
  status **CLEAR**. Nothing was blocked behind anything, because nothing was
  blocked at all.
- **2026-08-27** — **Integration done on `run/2026-08-27-world-economy` @ `455de2b`**
  (cut from `matmaverse-v2` @ `ba1c1a7`). Both features merged, nothing excluded, no
  Supabase migration in either — exactly as `ownership.md` §1e predicted. **Zero
  conflicts**, and the log records *why* that is weak evidence rather than a clean
  bill of health: F2's branch was cut from F1's, so F1's commits are its ancestors
  and the merged tree is byte-identical to F2's branch (`git diff --stat
  feat/six-worlds-catalogue d27bfb3` is empty). The four genuinely-contended
  registries were therefore verified **by inspection** rather than trusted to the
  merge. All five commands green on the merged tree, and green again after the one
  edit made at integration. **No merge-only defects found** — structurally, there
  was no merge-only surface for one to hide in. Not pushed, no PR, `main` untouched
  at `4cc2c1d`; handoff at `context/runs/2026-08-27-world-economy/handoff.md`.

## Environment traps hit in this run

- **The command sandbox blocks `127.0.0.1:54321`.** A plain `curl` against the
  Supabase REST endpoint returns HTTP `000`, which reads like "Supabase is down"
  and is not. Re-run with the sandbox disabled — this is already documented in the
  agent contract's verification section, and it cost one confused round trip here.
- `lsof -i :4321` reports **CLOSED** Chrome sockets to `rwhois` (which *is* port
  4321). Those are not a dev server; read the state column, not the row count.
- **Hit again at integration, and it is the one that would have cost the most.** The
  full suite on the integration branch had to be run in the **main checkout with the
  sandbox disabled**, with Supabase confirmed up *first* — the same
  `127.0.0.1:54321` block as above. Already documented in
  `.claude/skills/10x-autonomous-run/references/concurrency.md` §6 and in the agent
  contract, so **nothing was moved there this run**; it is recorded here only as
  confirmation that the existing rule is load-bearing and was needed twice.
- **A green Playwright run does not mean your specs ran.** Deliberately removing
  `worlds` from the touch project's `testMatch` alternation in `playwright.config.ts`
  produced **27 passed, exit 0** — fully green, nothing failed. The *only* signal was
  the count, 27 against the expected 28. This is the extend-never-replace rule of
  `ownership.md` shown failing silently, and it is why the test-count arithmetic in
  this run's verification is the instrument and not ceremony. **This one is not yet
  in `concurrency.md`** — §4 covers `E2E_PORT` pointing a suite at the wrong server,
  not a lost `testMatch` alternative silently shrinking it. Worth adding there as a
  recurring trap; the orchestrator did **not** add it, so it remains an open action.

## Decisions the orchestrator made

> Cross-feature calls no single agent could see. Each with a reversal condition.

- **One stack, not two lanes.** E1 and W1 share `src/i18n/pl.ts`, so they run
  serially in the code lane rather than concurrently, and E1 goes first.
  *Reversal:* if the contention sweep finds the two features' `pl.ts` edits are
  genuinely disjoint sections **and** a merge driver keeps both symbol sets, the
  stack could split into parallel lanes and save one implement cycle. Not worth the
  risk here — a shared registry is exactly the case where the process says *keep
  both symbol sets, never `--ours`/`--theirs`*.
- **The maintainer's measured baseline is taken as authoritative** rather than
  re-measured by the orchestrator. It was measured on this exact SHA with the
  sandbox disabled, and re-running the full suite would cost several minutes to
  confirm a number the human just produced. *Reversal:* any agent whose branch
  disagrees with these numbers re-measures on its own branch and reports the
  discrepancy — which is the standing L-005 rule anyway.
- **AD-1 — one edit made on the integration branch** (commit `455de2b`): F1's
  follow-up RF-4. F1's append left the `// Upgrade catalog names (S-06)` header
  orphaned above the new `decorations:` namespace in `src/i18n/pl.ts`, and F1's
  handoff scheduled the repair for "after W1 merges" because `pl.ts` was the run's
  hottest append-only surface. The integration branch is the first tree where both
  features are present. **Comment-only** — no key added, moved, renamed or removed —
  and all five commands were re-run green afterwards. *Reversal:* `git revert 455de2b`.
- **AD-2 — the stale `t.marketing.worlds` list was deliberately NOT fixed**, despite
  being the most user-visible inconsistency the branch ships. Reasons: it is not a
  merge-only defect (it is equally stale on either feature branch), `ownership.md`
  §1a put it outside both features' write surface, and growing a four-card strip to
  six is a copy **and** layout decision against a mockup that cannot be read
  (`assets/` is gitignored and absent from the worktrees). *Reversal:* F2's open
  follow-up F2 — put a `nameKey` on `World` and derive the strip, retiring the
  duplicate instead of re-syncing it. Carried into the open items below as
  **NEEDS YOUR HAND #1**.
- **AD-4 — the zero-conflict merge is reported as WEAK evidence, not strong.**
  "Merged cleanly, suite green, no cross-feature defects" would have been literally
  accurate and would have invited over-valuing what was really a re-run of a
  verification F2 had already performed, since F2's branch was cut from F1's.
  *Reversal:* if a future run splits into genuine parallel lanes, integration
  recovers its power as an independent check and the same sentence means something.

---

# RUN COMPLETE — 2 features started, 2 built, 0 blocked, 0 dropped, 0 halted

| Feature | Branch | Own commits | Migration | Merge verdict |
|---|---|---|---|---|
| F1 `world-economy-profit-rule` (E1) | `feat/world-economy-profit-rule` (off `matmaverse-v2`) | 6 commits, 33 code files, +3183/−70 | none | **APPROVED** — merge CLEAR, 0 critical / 3 warnings. Merge commit `c333f36` |
| F2 `six-worlds-catalogue` (W1) | `feat/six-worlds-catalogue` (off `feat/world-economy-profit-rule`) | 5 commits, 10 code files, +265/−7 | none | **APPROVED** — merge CLEAR, 0 critical / 3 warnings. Merge commit `d27bfb3` |

Every feature this run started is accounted for above. **Blocked: none. Dropped in
the docs lane: none. Halted in the code lane: none** — so nothing was left waiting
behind anything.

Merge order — **not optional**: F1 `world-economy-profit-rule` then F2
`six-worlds-catalogue`, the serial stack the contention sweep bound. **Excluded:
nothing.** No Supabase migration in either feature, as `ownership.md` §1e predicted.

**Integration branch:** `run/2026-08-27-world-economy` @ `455de2b`, cut from
`matmaverse-v2` @ `ba1c1a7`. **Not pushed, no PR, `main` untouched at `4cc2c1d`.**
`context/runs/2026-08-27-world-economy/` was never `git add`ed and remains untracked
— which is what let it survive the branch switches. Handoff:
`context/runs/2026-08-27-world-economy/handoff.md`.

## Conflicts — zero, and why that proves less than it looks

Git never asked for a resolution, so `--ours` / `--theirs` were never typed. The
structural reason is recorded because it **weakens the evidence**, not merely the
workload: `feat/six-worlds-catalogue` was cut **from** `feat/world-economy-profit-rule`,
so F1's commits are ancestors of F2's and `git diff --stat feat/six-worlds-catalogue
d27bfb3` is **empty** — the merged tree is byte-identical to F2's branch. The three
docs-only commits `matmaverse-v2` picked up after `91754ef` were already present on
the feature branch with identical content, so even the add/add resolved silently.

The four genuinely-contended registries were each verified **by inspection** rather
than trusted to the clean merge:

- `src/i18n/pl.ts` — `t.decorations` = 24 keys (F1's 16 + F2's 8); `t.nav.items` still 6.
- `src/components/child/ShopArt.tsx` — `WORLD_SLOTS` carries F1's `piekarnia` /
  `galaktyczna-baza` / `sklep-ksiegarnia` **and** F2's `pracownia` / `laboratorium`;
  `kawiarnia` still absent and still falling through to `DEFAULT_SLOTS`, which
  carries all 8 ids.
- `src/components/child/ShopGlyph.tsx` — `SHOP_ICONS` is the union; `ShopIconKey` is
  derived as `keyof typeof SHOP_ICONS`, so F2's append widened it with no type edit
  (CPD-6 held).
- `src/data/decorations.ts` — 24 entries, 6 worlds × 4, shared price curve, zero id
  overlap with `UPGRADE_IDS`.

Two more surfaces, checked: `playwright.config.ts`'s touch `testMatch` kept **all
three** alternatives — `/(gameplay-restore|growth|worlds)\.spec\.ts/`. And
`docs/reference/contract-surfaces.md` carries both of F1's sections (the
`decorations` sibling on `child_profiles`; earned-carries-profit and
decoration-writes-no-row on `shift_log`); F2 correctly wrote nothing, so no
resolution was needed. `src/types.ts` — `ShopState.decorations?: string[]` present,
appended.

## Verification on the integration branch

Run in the **main checkout** on `run/2026-08-27-world-economy` with the **sandbox
disabled** (it blocks `127.0.0.1:54321`), Supabase confirmed up first.

| Command | Result |
|---|---|
| `npm run lint` | exit 0 |
| `npm run check` | exit 0 — 0 errors, 0 warnings, 8 hints, 213 files |
| `npm test` | **633 passed / 633**, 63 / 63 files, exit 0 |
| `npm run build` | exit 0 |
| `npx playwright test` | **28 passed / 28**, exit 0 |

All five re-run and green again **after** commit `455de2b`.

**Arithmetic.** Baseline is the contract's, measured on `matmaverse-v2` @ `91754ef`;
`ba1c1a7` adds only `context/` and changes docs, so it carries over.

| Metric | Baseline | F1 | F2 | Expected | Observed |
|---|---|---|---|---|---|
| vitest tests | 548 | +81 | +4 | 633 | **633** ✓ |
| vitest files | 57 | +5 | +1 | 63 | **63** ✓ |
| Playwright | 26 | +0 | +2 | 28 | **28** ✓ |
| `check` files | 202 | +9 | +2 | 213 | **213** ✓ |

**Line-level.** Pure merge `d27bfb3` vs `ba1c1a7`, code-only (`':!context'`) = 39
files, +3448/−77, against F1's 33 files +3183/−70 and F2's 10 files +265/−7:
3183+265 = 3448 ✓, 70+7 = 77 ✓, 33+10 − 4 overlapping files = 39 ✓. The four
overlaps are exactly the four contended registries.

**Deliberate break**, run at integration against the one registry a bad resolution
would corrupt silently: removing `worlds` from the touch alternation made
`npx playwright test` report **27 passed, EXIT 0** — fully green, nothing failed. The
only signal was the count. Restored, and `e2e/worlds.spec.ts` re-confirmed to run
under **both** `[desktop]` and `[touch]`, full run back to 28. That break is why the
count arithmetic above is the instrument and not ceremony.

## Merge-only defects: none found — and do not over-read the green

The reason is structural, not luck. Because F2's branch was cut from F1's, the merged
tree is byte-identical to F2's branch; F2's own verification was already effectively
an integration verification, and **there was no merge-only surface for a cross-feature
defect to hide in**. The source run's merge-only bug (six nav tabs squeezing a link
under the dev toolbar) had a genuine two-lane merge to appear in; this run had one
serial stack.

That exact failure class was nevertheless **checked rather than assumed**: nav tabs
are still **six** (`t.nav.items` unchanged by both features), and
`e2e/growth.spec.ts`'s data-driven `scrollWidth` assertion (Risk E2E-F4-2) passed in
the touch project at 712px.

- **L-007 two-direction substring sweep re-run programmatically on the MERGED
  dictionary** — all 35 labels this run introduced against every string in `pl.ts`,
  both directions. Exactly **one** containment, and it is the one F1 already logged as
  RF-2: `t.results.costLabel` (`Koszt sklepu: {cost} zł`) is a superstring of
  `t.upgradeShop.costLabel` (`{cost} zł`). Verified inert — rendered by
  `ShiftResults.tsx` and `UpgradeShop.tsx`, which never appear in one tree, and the
  only test locating either (`tests/shift-screen.test.tsx:260`) matches the full
  filled string. No new hit.
- **The known F1 regression repair holds.** `e2e/growth.spec.ts:126` (Risk E2E-F4-3)
  is re-seeded against `decorationsForWorld(SEED_WORLD)` with `SEED_WORLD='kawiarnia'`,
  so F2's two new worlds cannot touch it, and both properties the test defends are
  intact (`t.growth.noNextUpgrade` **and** the surviving shop CTA). The seed is
  world-agnostic by construction, so the next decoration batch cannot silently stale it.
- **Other invariants spot-checked green:** `export const prerender = false` present on
  `src/pages/api/decorations/buy.ts`; no decoration id in `WORLD_SLOTS`; no
  decoration/upgrade id overlap; `purchased` vs `decorations` separation intact.

## Open — what is left for a human

**NEEDS YOUR HAND #1 — `t.marketing.worlds` is stale at four against six, and it is
USER-VISIBLE.** `src/i18n/pl.ts:118` is a hand-maintained duplicate of `WORLDS` that
nothing syncs or tests, rendered in **two** places (not the one F2's handoff named):
`AuthShell.astro:79` (`hidden grid-cols-4 … lg:grid`, auth split view) **and**
`Welcome.astro:83` (`grid-cols-2`, signed-out landing, all viewports). The signed-out
product advertises four worlds while the app ships six. Both art files are **already
committed** (`public/illustrations/world-{pracownia,laboratorium}.webp`), so the fix
is two dictionary entries plus a column-count decision — do the list and AuthShell's
`grid-cols-4` in **one** change or the desktop strip goes ragged 4+2, unnoticed.
`Welcome.astro`'s `grid-cols-2` absorbs six as three rows with no class change.

Also open:

- **Eleven human-checklist items** across the two features (five F1, six F2), all
  visual judgement no assertion settles — enumerated in
  `context/changes/*/handoff.md` §5. F1's five need the app running: results `zysk`
  vs the `/app/start` wallet delta; both margins under "Wkrótce" with the branch
  reason at level 3 without `sign`; whether lucide glyphs read at the same weight as
  illustrated art; the exhausted-catalogue next-thing card naming a current-world
  decoration; a world switch renewing the sink with upgrades intact.
- **Copy needs a native-speaker pass** — all 24 `t.decorations` names, F1's four
  `t.results` labels, `t.upgrades.{precision,margin}`,
  `t.upgradeShop.decorationsHint`, all authored unattended. Also queued:
  `t.growth.noNextUpgrade` is now slightly imprecise (it says "ulepszenia" but fires
  when decorations are exhausted too) and was kept **verbatim on purpose**, because
  `e2e/growth.spec.ts` asserts it with `{ exact: true }`.
- **Every new layout is an EXPLICIT EXTRAPOLATION.** No mockup exists for a
  decoration, the three-number results breakdown, the shop's decoration section, or a
  six-tile world grid, and `assets/` is absent from both worktrees. Neither the e2e
  step nor this integration step read any of them as mockup-derived.
- **Ten open follow-ups, none critical** —
  `context/changes/world-economy-profit-rule/follow-ups/review-fixes.md` (RF-1…RF-4)
  and `context/changes/six-worlds-catalogue/follow-ups/review-fixes.md` (F1…F6).
  Sharpest two: **RF-1**, the dominance sweep in `tests/economy-invariants.test.ts`
  judges a branch by its **best** entry, so raising `precision.cost` to 400 leaves all
  six invariant cases green; and **W1-F3**, the badge-placement evidence for the two
  new `WORLD_SLOTS` tables is not reproducible (the probe was deleted).
- **Housekeeping:** nothing pushed, no PR opened, `main` untouched at `4cc2c1d`. Two
  feature worktrees still on disk and idle
  (`.claude/worktrees/{world-economy-profit-rule,six-worlds-catalogue}`).
  `context/runs/2026-08-27-world-economy/` remains untracked.
