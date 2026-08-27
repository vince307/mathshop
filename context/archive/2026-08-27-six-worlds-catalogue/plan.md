# `six-worlds-catalogue` — Implementation Plan

> Feature **F2** of autonomous run `2026-08-27-world-economy`. Backlog **W1**.
> Contract: `context/runs/2026-08-27-world-economy/agent-contract.md`
> Research: `context/changes/six-worlds-catalogue/research.md`
> Brief: `context/changes/six-worlds-catalogue/plan-brief.md`
> **Amended 2026-08-27 by the contention sweep** — `context/runs/2026-08-27-world-economy/ownership.md`
> is binding over anything below it that disagrees. Seven cross-plan defects were fixed
> in place here (CPD-1…CPD-4, CPD-6…CPD-8); each edit is marked
> `[contention sweep]`.

## Overview

Grow `WORLDS` from four to six by landing `pracownia` / **Pracownia** and
`laboratorium` / **Laboratorium** on art that is already committed, close the two
grid reflows that six tiles force, give both new plates their own `WORLD_SLOTS`
table, and — only if F1 `world-economy-profit-rule` has landed at this branch's cut
point — give each new world its own decoration set (D-11).

This is not a new decision. It is the **execution of D-3's own reversal condition**
(`context/archive/2026-08-22-world-selection-screen/plan.md` § D-3: *"ship the four
that exist… when worlds 5–6 land, `lg:grid-cols-3` restores the mockup's web layout
in one class"*, reversing *"the maintainer supplies art + names for worlds 5 and
6"* — supplied 2026-08-27).

## Current State Analysis

- `src/data/worlds.ts` exports `World`, `DEFAULT_WORLD` (`kawiarnia`),
  `DEFAULT_THEME`, `WORLDS` (four records), `WORLD_SLUGS`, `getWorld`,
  `worldForTheme`. Names are **inline literals on the records**, not i18n keys.
- **Nine of eleven `WORLDS` consumers are already six-proof** because they derive:
  `WorldPicker`, `CreateProfileWizard`, both profile routes' zod `.refine`,
  `worldForTheme`, `getWorld`, `WORLD_SLUGS`, `tests/data-lookups.test.ts`,
  `tests/worlds-picker.test.tsx` (asserts `WORLDS.length`, not `4`),
  `e2e/onboarding.spec.ts`. No test pins the literal count four.
- **No migration.** `child_profiles.theme` is `text not null default 'default'` in
  `supabase/migrations/20260609120000_child_profiles_isolation.sql`, with no `check
  (…)` clause in any of the twelve migration files. Validation is app-layer only, in
  the `theme` field of `src/pages/api/profiles/create.ts` and
  `src/pages/api/profiles/world.ts`, both `.refine`-ing against `WORLD_SLUGS`.
- **Art is committed:** `public/illustrations/world-pracownia.webp` and
  `world-laboratorium.webp`, both 896×718 with alpha, provenance recorded in
  `public/illustrations/slice-map.md` § *"World cards, second batch (W1)"*.
- **One guaranteed red:** `tests/shop-art-slots.test.tsx`, case *"gives every
  non-default world its own slot table"*, iterates `WORLD_SLUGS` and demands a
  `WORLD_SLOTS` entry for every non-`DEFAULT_THEME` slug. `WORLD_SLOTS` in
  `src/components/child/ShopArt.tsx` has exactly three keys today.
- **Two grids go ragged or stale at six:** `WorldPicker`'s tile grid
  (`grid-cols-2 …`, plus a module-header paragraph asserting *"Only FOUR worlds
  exist"*) and `CreateProfileWizard`'s interest grid
  (`grid-cols-2 sm:grid-cols-4 lg:grid-cols-2` → a 4+2 orphan row in the `sm`…`lg`
  band).
- **One hand-maintained duplicate:** `t.marketing.worlds` in `src/i18n/pl.ts` — four
  `{ name, image }` entries, not derived from `WORLDS`, rendered by
  `src/components/Welcome.astro` (`grid-cols-2`, six-proof) and
  `src/components/auth/AuthShell.astro` (`hidden grid-cols-4 … lg:grid`, **ragged at
  six**, desktop-only). No test or e2e spec references `t.marketing` at all.
- **`upgradeCopy(id)` in `src/i18n/index.ts` already IS the neutral copy fallback**
  (`t.upgrades[id] ?? { name: id, desc: "" }`), world-blind by construction.
- **Decorations do not exist yet.** No `Decoration` type, no
  `src/data/decorations.ts`, no `shop_state.decorations`, no buy route, and
  `Upgrade.art` is a **required** `string` so `ShopArt` cannot render an art-less
  entry. All of that structural work is **F1's**. At the time this plan was written
  F1 was at research stage with **no branch cut**.

## Desired End State

- `/app/worlds` shows six tiles: 3×2 at `lg+`, 2×3 below — matching
  `01-world-selection-web.png` and `01-world-selection-mobile.png` respectively.
- The create-profile wizard's interest step shows six tiles with **no orphan row**
  at any breakpoint.
- Picking Pracownia or Laboratorium POSTs the slug, stores it in
  `child_profiles.theme`, and `/app/start` renders `world-<slug>.webp` with every
  owned upgrade badge sitting in that plate's own margins.
- `npm test`, `npm run lint`, `npm run check` and `npx playwright test` are all
  green on this branch, with `tests/shop-art-slots.test.tsx` passing over **five**
  world tables.
- Every module comment that asserted the old four-world premise now tells the truth.

### Key Discoveries

- `tests/worlds-picker.test.tsx` · *"renders one selectable tile per WORLDS entry"*
  asserts `toHaveLength(WORLDS.length)` — it grows with the data, deliberately.
- `tests/shop-art-slots.test.tsx`'s module header records an L-004 meta-check
  already banked: **dropping the `WORLD_SLOTS[world.slug]?.` lookup prefix leaves
  all four data assertions green.** W1's deliberate break must therefore be a *data*
  break, not a prefix break.
- `SelectTile` renders `<img className="size-full object-cover">` in an
  `aspect-[4/3]` box. The plates are 896×718 ≈ 1.248 against a 1.333 box, so
  `object-cover` trims ≈3.2% top and bottom. For `world-pracownia.webp` that is
  **exactly** the transparent letterbox `contain` added; for `world-laboratorium.webp`
  it clips empty canvas. **Neither plate loses focal content** — no per-plate
  compensation needed.
- `t.worlds` in `src/i18n/pl.ts` is the world-selection **screen** namespace and its
  header says the competency trio is *"world-INDEPENDENT by design"*. The design
  spec's `t.worlds[slug].upgrades[id]` is shorthand for a future key path, not this
  record. Under the copy decision below, W1 never touches it.
- `src/data/stages.ts`'s `ART DEVIATION FROM THE MOCKUP` header is the repo's
  established template for shipping a feature whose art does not exist.

## What We're NOT Doing

- **No migration.** `child_profiles.theme` needs none, and W1 authors none. The run's
  migration lane belongs to F1.
- **No per-world catalogue vocabulary** — zero of the 6 × 8
  `t.worlds[slug].upgrades[id]` strings, and no copy-resolution code. See Decision 1.
- **No `src/data/decorations.ts` authored by W1**, no `Decoration` type, no
  `shop_state.decorations` key, no `src/pages/api/decorations/buy.ts`, no `ShopArt`
  art-less branch. All F1's. W1 appends *data* to F1's registry, or drops Phase 4.
- **No restructuring of `ShopArt`** — W1 owns the `WORLD_SLOTS` data literal only.
  `DEFAULT_SLOTS` and the `ShopArt` function are not W1's to touch.
- **No re-seed of `e2e/growth.spec.ts`** *Risk E2E-F4-3*. That regression is F1's,
  named here only so W1 does not re-seed it a second time.
- **No rewrite of `t.worlds.sameSkills` / `t.worlds.carryOver`.** Both stay honest at
  six precisely because nothing in the economy reads `theme` and a decoration has no
  economic effect.
- **No new nav entry.** `t.nav.items.worlds` ("Światy") and `/app/worlds` already
  ship; `e2e/growth.spec.ts` § *Risk E2E-F4-2* already asserts six nav entries fit at
  712px. The tab-arithmetic rule is inert here.
- **No growth of `t.marketing.worlds` to six.** See Decision 2.

## Implementation Approach

A baseline phase, four build phases, one e2e phase and one **mandatory** post-rebase
reconciliation phase (Phase 6), ordered so that **every phase before the conditional
one is independent of F1**. Phases 1–3 land the whole worlds half of W1 and can be
committed even if F1 never merges. Phase 4 is the only F1-coupled work and is
explicitly **droppable** — the same split the archived F4/F5 run used
(`context/archive/2026-08-22-world-selection-screen/plan-brief.md`: *"F4 owns it; F5
touches only the `WORLD_SLOTS` data literal, in a droppable phase"*).

**Branch:** `feat/six-worlds-catalogue`, cut from **`feat/world-economy-profit-rule`**.
Never cut in the main checkout; use `.claude/skills/10x-autonomous-run/scripts/worktree-bootstrap.sh`.

> **[contention sweep] The branch point is no longer conditional (CPD-4).**
> `ownership.md` puts F1 → W1 in one serial stack and the run contract's own git rule
> is *"cut from its predecessor when `ownership.md` puts it in a stack"*. So: cut from
> `feat/world-economy-profit-rule`, **Phase 4 is mandatory**, `UPGRADE_IDS` is **eight**,
> and Phase 6 collapses to a cheap confirmation. If that branch genuinely does not exist
> when W1 starts, that is a **BLOCKED** report to the orchestrator, not a fallback —
> because F1's `tests/decorations.test.ts` per-world totality assertion makes a dropped
> Phase 4 a **red suite**, not a silent omission (see Phase 4's gate).

**Baseline (L-005):** before Phase 1, run `npm test` and `npx playwright test` **on
this branch** and record the two numbers. Every criterion below is written as
`baseline + delta` against *those*, not against the contract's `matmaverse-v2` @
`91754ef` figures (548 vitest / 26 Playwright), which are the **base branch's** and
will be lower than F1's.

## Critical Implementation Details

- **`UPGRADE_IDS` is derived, and on this branch it is EIGHT.** *[contention sweep,
  CPD-4]* The branch is cut from `feat/world-economy-profit-rule`, whose Phase 3 adds
  `precision` and `margin`. The two new `WORLD_SLOTS` tables must carry one entry per id
  in `UPGRADE_IDS` **as measured in Phase 0** — do not hardcode either six or eight; read
  it. The test is self-describing (`"<slug>" has no slot for upgrade "<id>"`), so a wrong
  count cannot pass silently.

- **[contention sweep, CPD-2] Phase 1 turns TWO suites red, not one.** Adding two
  entries to `WORLDS` widens `WORLD_SLUGS`, and **two** F1-owned iterations read it:
  `tests/shop-art-slots.test.tsx` § *"gives every non-default world its own slot table"*
  (closed by Phase 3) and `tests/decorations.test.ts` § the per-world totality case F1
  ships in its Phase 5 §1 — *"for every slug in `WORLD_SLUGS`, `decorationsForWorld(slug).length`
  equals the per-world count"* (closed by **Phase 4**). Expect exactly those two, name
  them, and see Phase 1's criteria.
- **`WORLD_SLOTS`'s fallback is silent.** A missing table does not crash — it places
  the badge at a coordinate tuned for a different plate. That is why the two
  iterating assertions in `tests/shop-art-slots.test.tsx` must not be "simplified"
  into a fixed list.
- **Ordering — execute 0 → 1 → 3 → 4 → 2 → 5 → 6, not in numeric order.**
  *[contention sweep, CPD-3 — the grouping was `1 + 3` and that commits a red tree.]*
  Phase 1 makes two F1-owned iterations red (above); Phase 3 closes the
  `shop-art-slots` one and **Phase 4 closes the `decorations` one**. The run's rule is
  *commit on green*, so **Phases 1, 3 and 4 land as ONE commit**, taken after both reds
  have been observed and recorded — that pair of reds is the L-004 evidence this feature
  is entitled to observe. Phase 2 is then executed and committed on its own. It cannot go
  first — its `WorldPicker` header rewrite asserts *"six worlds now exist"*, which is only
  true once Phase 1 has landed — and it cannot be sandwiched inside the 1/3/4 group
  without staging surgery. The Progress numbering is unchanged; only the working order
  and the commit grouping are fixed here.
- **`src/i18n/pl.ts` is append-only, one entry per key** (concurrency contract). W1
  adds at most a comment in Phase 2 and decoration name keys in Phase 4. Never
  restructure it — F1 is editing the same file in the same stack.

---

## Phase 0: Baseline

### Overview

Measure, do not inherit. No file is edited in this phase.

### Changes Required:

None — this phase writes no code. It records two numbers and one fact that every
later phase is written against.

### Success Criteria:

#### Automated Verification:

- `npm test` and `E2E_PORT=<yours> npx playwright test` run **on this branch** before
  any edit; both counts recorded in the handoff as the branch baseline (L-005). Do
  **not** reuse the contract's `matmaverse-v2` @ `91754ef` figures — if this branch was
  cut from `feat/world-economy-profit-rule` they are the base branch's and are lower.
- Record whether `src/data/decorations.ts` exists on this branch, and the length of
  `UPGRADE_IDS` (`src/data/upgrades.ts`). Those two facts decide Phase 4's gate and
  Phase 3's per-table entry count, and Phase 6 re-checks both after the rebase.

#### Manual Verification:

- None.

## Phase 1: The two worlds enter `WORLDS`, with the slug↔stem↔art invariant pinned

### Overview

Two data records and one test that closes the only gap A3 rests on and nothing
currently guards.

### Changes Required:

#### 1. The world catalogue

**File**: `src/data/worlds.ts`

**Intent**: Append `pracownia` / *Pracownia* and `laboratorium` / *Laboratorium* to
`WORLDS`, following the four shipped records exactly. Append, never insert —
`e2e/onboarding.spec.ts` walks `WORLDS[0]` and `WORLD_SLUGS` order is asserted
against `WORLDS.map`.

**Contract**: two `World` records, `{ slug, name, image }`, with
`image === "/illustrations/world-<slug>.webp"`. `WORLD_SLUGS`, `getWorld`,
`worldForTheme` and both zod `.refine`s widen automatically; no signature changes.

#### 2. The header comment's name reconciliation

**File**: `src/data/worlds.ts` — the module header block

**Intent**: The header already records one name↔slug↔art reconciliation ("the `05`
mockup labels the 4th interest *Sklep kolekcjonera*…"). Extend it with the second:
the `01-world-selection` **web** mockup labels worlds five and six *Salon kreatywny*
and *Laboratorium wynalazków*, while the **mobile** mockup of the same set labels
world six plain *Laboratorium*. The committed names are Pracownia / Laboratorium
because slug, filename stem and the stored `theme` value must stay one string. Say
that in the header, so a reviewer reading the mockup does not read the difference as
drift.

**Contract**: prose only, in the existing header block. No exported symbol changes.

#### 3. A test for the invariant everything else assumes

**File**: `tests/worlds-art.test.ts` (new, node environment — the vitest default)

**Intent**: Every consumer, the two mockup-name reconciliations, and A3 itself rest
on *slug = filename stem = stored `theme` value*, and **nothing checks it**. A typo'd
stem ships a silent 404 in the shop scene, the picker tile and the preview rail, with
no test and no crash. Pin it.

**Contract**: for every entry of `WORLDS`, assert `image` equals
`` `/illustrations/world-${slug}.webp` `` **and** that the file exists on disk under
`public/`, resolved from `import.meta.url` (mirror `tests/connectivity.test.ts`,
which is the repo's only existing fs-reading test). Also assert slugs are unique and
carry no diacritics or uppercase — the property that keeps the URL and the DB value
identical.

### Success Criteria:

#### Automated Verification:

- `npm test` — branch baseline + the new `tests/worlds-art.test.ts` cases, with
  **exactly TWO cases expected red**, in two different files, until Phases 3 and 4 close
  them. *[contention sweep, CPD-2 — this criterion previously said "exactly one… two
  reds here means something else broke", which would have sent the implementer hunting a
  phantom bug.]* Both reds are caused by `WORLD_SLUGS` widening from four slugs to six,
  and both live in F1-owned files:
  1. `tests/shop-art-slots.test.tsx` § *"gives every non-default world its own slot
     table"* — iterates `WORLD_SLUGS`. **Closed by Phase 3.**
  2. `tests/decorations.test.ts` § the per-world totality case (F1 plan, Phase 5 §1 —
     *"for every slug in `WORLD_SLUGS`, `decorationsForWorld(slug).length` equals the
     per-world count"*; anchor on the symbol `decorationsForWorld`, not on a title).
     **Closed by Phase 4.**

  The `shop-art-slots` id-coverage case — *"covers all six upgrade ids in every table"*
  (F1's Phase 3 may have renamed it to a count-free phrasing; anchor on the
  `Object.entries(WORLD_SLOTS)` loop, not the title) — iterates the **tables**, not the
  slugs, so it stays **green** in Phase 1 and only Phase 3 exercises it. Record exactly
  these two red cases by name. **Three reds, or a red anywhere else, means something else
  broke.** If red #2 does **not** appear, F1's totality assertion did not ship as
  contracted — that is a finding for the impl-review of F1, and it means a dropped Phase 4
  would be silent after all (see Phase 4's gate).
- `npm run lint` — exit 0
- `npm run check` — 0 errors, 0 warnings (hint count may move)
- `tests/data-lookups.test.ts` and `tests/worlds-picker.test.tsx` stay green at six
  without edits — proof the derive-don't-hardcode discipline held
- Deliberate break (L-004): point one new record's `image` at a stem that does not
  exist (e.g. `world-pracownia-2.webp`) → `tests/worlds-art.test.ts` goes red on the
  existence assertion; restore and re-run green. **Meta-check to record:** this is
  the failure mode with no other guard — a wrong stem renders a broken `<img>` and
  nothing else in the suite reads `World.image`, so the redness is evidence for
  exactly the claim the test makes. A break that only edited the `name` field would
  prove nothing here.

#### Manual Verification:

- `/app/worlds` lists six tiles and both new plates load (no broken image)
- **L-007 two-direction substring sweep on the two new world NAMES, before the records
  are committed.** `World.name` is an accessible name in two grids (`WorldPicker` via
  `SelectTile`'s `label`, `CreateProfileWizard` via `alt` **and** `label`) and
  `e2e/onboarding.spec.ts` locates a tile by it. Grep `src/i18n/pl.ts` **and**
  `src/data/*.ts` for *Pracownia* and *Laboratorium* as a substring in both directions
  — no existing label may contain them and they may contain no existing label. Verified
  clean at plan time (`grep -ri 'pracowni\|laborator' src/` returns nothing), so this
  is a confirmation, not a search — but re-run it, because F1 appends decoration and
  margin labels to the same dictionary immediately before W1.

---

## Phase 2: The two grids reflow and the comments that lied are rewritten

### Overview

Three files, four small edits, zero new behaviour. This is D-3's reversal being
executed.

### Changes Required:

#### 1. The world-selection tile grid

**File**: `src/components/child/WorldPicker.tsx`

**Intent**: Add `lg:grid-cols-3` to the tile-grid `<div>` that wraps `WORLDS.map` —
the class the component's own header already names as the planned fix. `grid-cols-2`
at six **is already the mobile mockup exactly** (2×3); adding the `lg` column
produces the web mockup exactly (3×2).

**Contract**: the `<div>` holding `WORLDS.map` — today
`mx-auto grid max-w-2xl grid-cols-2 gap-3 sm:gap-4 lg:mx-0 lg:max-w-none`. Anchor on
the `WORLDS.map` call, not on a line number.

#### 2. `WorldPicker`'s module header

**File**: `src/components/child/WorldPicker.tsx` — the module header block

**Intent**: The header's final paragraph states a premise this change **falsifies** —
*"Only FOUR worlds exist in `WORLDS`; the mockup draws six. The two missing ones have
no slug and no committed art…"*. Rewrite it: six worlds now exist, the grid is 2×3
below `lg` and 3×2 above, and that is the mockups' two shapes. Leaving the old
sentences in place after shipping the worlds is a comment that lies.

**Contract**: prose only. Do not change the `alt=""` rationale or the `aria-label`
rationale in the same header — both are still load-bearing (`tests/worlds-picker.test.tsx`
depends on the first).

#### 3. The wizard's interest grid

**File**: `src/components/child/CreateProfileWizard.tsx`

**Intent**: The interest grid under `t.profileWizard.interestLabel` is
`grid-cols-2 sm:grid-cols-4 lg:grid-cols-2`, which at six tiles leaves a ragged
**4 + 2** row in the `sm`…`lg` band. Change `sm:grid-cols-4` → `sm:grid-cols-3`: 3×2
in that band, 2×3 below and above, no orphan row at any breakpoint.

**Contract**: the `<div>` holding `WORLDS.map` inside the interest step. Add a
one-line comment stating the class was chosen by the **no-orphan-row rule at six**,
and that the `05` auth-v2 mockup was **not** consulted (it is unreadable from the
code lane — `assets/` is gitignored and absent from worktrees). This is an
extrapolation and must say so.

#### 4. The marketing strip stays at four, on the record

**File**: `src/i18n/pl.ts` — the `marketing.worlds` array

**Intent**: `t.marketing.worlds` is a hand-maintained duplicate of `WORLDS` that
**nothing keeps in sync and no test touches**, rendered by `Welcome.astro`
(`grid-cols-2`, six-proof) and `AuthShell.astro` (`hidden grid-cols-4 … lg:grid`,
which goes ragged at six on desktop only). Leave it at four and add a comment saying
it is a signed-out **marketing sample, not a mirror of `WORLDS`**, and that growing
it requires `AuthShell.astro`'s `grid-cols-4` to change with it. Silently appending
two entries would ship a ragged auth panel that nothing would catch.

**Contract**: comment only, above the `worlds:` key. No key added, removed or
reordered — the file is append-only per the concurrency contract.

### Success Criteria:

#### Automated Verification:

- `npm test` — branch baseline + 0 (no new tests; `tests/worlds-picker.test.tsx`
  must remain green unedited)
- `npm run lint` — exit 0
- `npm run check` — 0 errors, 0 warnings
- `grep` proves no `WORLDS.map` grid still carries `sm:grid-cols-4`, and no module
  header still contains the string "Only FOUR worlds exist"

#### Manual Verification:

- `/app/worlds` at ≥1024px: 3 columns × 2 rows, preview rail unchanged
- `/app/worlds` at 712px (the `touch` project's width): 2 columns × 3 rows, confirm
  CTA reachable without horizontal scroll
- Create-profile wizard step 2 at ~700px: 3 × 2, no orphan row
- Signed-out `/` and an auth page: the marketing strip still shows four cards, laid
  out as before

---

## Phase 3: `WORLD_SLOTS` gains `pracownia` and `laboratorium`

### Overview

The one guaranteed regression, closed with two data tables tuned against the two
committed plates.

### Changes Required:

#### 1. Two new slot tables

**File**: `src/components/child/ShopArt.tsx` — the exported `WORLD_SLOTS` literal

**Intent**: Add one table per new slug, each covering **every id in `UPGRADE_IDS` as
it reads on this branch**, each entry setting exactly one of `left`/`right` and one
of `top`/`bottom` as a percent string in 0–100, with badges in the plate's margins
and never over a focal point. `kawiarnia` stays absent (it must keep falling through
to `DEFAULT_SLOTS`).

**Contract**: two keys appended to `WORLD_SLOTS`. `DEFAULT_SLOTS` and the `ShopArt`
function are not touched. Starting coordinates from `research.md` § 2 — derived from
the plates' own whitespace, **not from any mockup**:

```
pracownia:    sign L5%/T4% · shelf L3%/T34% · register R3%/T22%
              slot L45%/B3% · storage L3%/B12% · customers R4%/B6%
laboratorium: sign L4%/T6% · shelf L4%/T26% · register R3%/T12%
              slot L45%/B2% · storage L3%/B14% · customers R3%/B4%
```

**[contention sweep] F1's two margin entries (`precision`, `margin`) are in the tree at
this branch point, so both tables carry EIGHT ids, not six.** Place the two margin
entries in the clearest remaining margin: the **top-centre** band (pracownia `y≈4%`,
`x≈30–40%`; laboratorium `y≈4%`, `x≈30–45%`) and the **bottom-centre-left** floor. Read
`UPGRADE_IDS` rather than trusting this sentence — Phase 0 recorded the number.

#### 2. A per-plate comment for each table

**File**: `src/components/child/ShopArt.tsx`

**Intent**: The three shipped tables each carry a one-line note about that plate's
geometry ("Narrow centred building (x ≈ 14–85%)…"). Match the convention: pracownia
is a craft desk, content `x ∈ [12%, 90%]`, `y ∈ [8%, 90%]`, with a ≈3.2%
transparent letterbox band top and bottom from the `contain` fit; laboratorium is an
invention bench, content `x ∈ [7%, 90%]`, `y ∈ [8%, 93%]`, no letterband, largest
clear region the top-left quadrant. State that the coordinates are an extrapolation
from plate geometry, since no mockup draws upgrade badges on either plate.

**Contract**: comments only, inside the `WORLD_SLOTS` literal.

### Success Criteria:

#### Automated Verification:

- `tests/shop-art-slots.test.tsx` — all five cases green over **five** world tables
- `npm test` — branch baseline + Phase 1's new cases, **0 failures** (the Phase 1 red
  is now closed)
- `npm run lint` — exit 0
- `npm run check` — 0 errors, 0 warnings
- Deliberate break (L-004), two of them, both **data** breaks: (a) delete
  `pracownia.sign` → *"covers all six upgrade ids in every table"* goes red naming
  that exact slug+id; (b) delete the whole `laboratorium` table → *"gives every
  non-default world its own slot table"* goes red. Restore both, re-run green.
  **Meta-check to record:** the file's own header states that removing the
  `WORLD_SLOTS[world.slug]?.` lookup prefix leaves all four data assertions green —
  so a prefix break would prove nothing about W1's contribution, which is *data*.
  These two breaks are the ones a real mistake would produce (a table typo'd under
  the wrong key, or a missed id when `UPGRADE_IDS` grew), which is why their redness
  is evidence for the claim.

#### Manual Verification:

- `/app/start` in Pracownia with every upgrade owned: every badge sits in a margin,
  none over the sewing machine, the mannequin, the lamp or the coin stack
- `/app/growth` in Laboratorium with every upgrade owned: no badge over the bulb,
  the blueprint board, the orbit toy or the coin stack
- No badge is clipped by the `aspect-[4/3]` box at either the mobile or desktop width

---

## Phase 4: Each new world's decoration set — MANDATORY under the run's stack

### Overview

**[contention sweep, CPD-1/CPD-4 — this phase was "CONDITIONAL on F1, droppable".
It is neither, on this branch.]** `ownership.md` cuts this branch from
`feat/world-economy-profit-rule`, so `src/data/decorations.ts` exists and the gate is
satisfied by construction. More importantly, **dropping this phase now leaves the suite
RED, not silently wrong**: F1's Phase 5 §1 ships a per-world totality assertion in
`tests/decorations.test.ts` (*"for every slug in `WORLD_SLUGS`, `decorationsForWorld(slug).length`
equals the per-world count"*), which Phase 1 turned red and only this phase can close.
Run it. Its Progress rows have no `DROPPED` state.

Still true, and still the reason W1 only *appends*: W1 must **not** create the decoration
module, the `Decoration` type, the `shop_state.decorations` key, the buy route or the
`ShopArt` art-less branch. An effect-free list with no sink, no persistence and no
renderer is dead code, and sizing it would mean inventing the D-13 pacing model the
contract forbids W1 to invent (research § R5). If `src/data/decorations.ts` is somehow
absent, **report BLOCKED** — do not build it.

### Changes Required:

#### 1. Two worlds' entries in F1's decoration registry

**File**: `src/data/decorations.ts` (created by F1)

**Intent**: Append a decoration set for `pracownia` and one for `laboratorium`,
**matching F1's per-world count and price curve for the existing four exactly**.
Equal sink capacity across worlds is not cosmetic: unequal "something to spend on"
is the one way an effect-free decoration set could still create the between-world
asymmetry D-11 exists to prevent. Each entry is themed to its world (craft/sewing for
Pracownia, science/invention for Laboratorium) and carries **no `art`** — they render
through the lucide + design-token path F1 built, exactly as `src/data/stages.ts`
does.

**Contract**: append-per-world-key; do not edit F1's four existing sets, do not
change the `Decoration` type, the module header, or the price curve. Each new entry
sets whatever fields F1's `Decoration` requires plus a lucide icon reference,
following F1's four sets field-for-field.

> **[contention sweep, CPD-6] One carve-out from "do not change the type":
> `ShopIconKey` and `ShopGlyph`'s icon map are APPEND-ONLY, and W1 may append to both.**
> F1 declares `ShopIconKey` as a *closed* union (F1 plan, Phase 5 §1 and Phase 3 §2) and
> asserts total coverage of `ShopGlyph`'s map (F1 success criterion 5.4). Manual criterion
> 4.9 below requires Laboratorium's set to look *visibly different* from the others — which
> it cannot, if W1 is restricted to the icon keys F1's own 16 decorations happen to use.
> So: W1 **may add new members to `ShopIconKey` and matching entries to `ShopGlyph`'s map**,
> append-only, one entry per key, in `src/data/decorations.ts` / `src/components/child/ShopGlyph.tsx`.
> W1 may **not** restructure either, rename a key, or touch the lookup function. If F1
> landed the union in a form that cannot be appended to (e.g. inlined, or pinned by an
> exhaustive literal count), that is a finding for F1's surface — report it; do not
> reuse a wrong icon to dodge it. **F1's plan settles this: AD-5 contracts
FOUR decorations per world priced 40 / 80 / 140 / 220** — read the landed module and
match it, and expect four, not three. The `3 per world` fallback in Decision 3 applies
only if F1's landed registry contradicts its own AD-5; if it does, follow the code and
say so in the handoff. F1's `Decoration.id` is **world-prefixed** (`"kawiarnia-lampki"`
shape), so the two new sets are `pracownia-*` and `laboratorium-*`.

#### 2. Decoration names

**File**: `src/i18n/pl.ts` — F1's decoration copy namespace

**Intent**: One Polish name (and description, if F1's shape has one) per new
decoration. This is the **only** child-facing copy W1 writes, and it is unavoidable:
a decoration with no name cannot be offered. Keep the register of the existing
catalogue copy — short, concrete, no bare arithmetic.

**Contract**: append-only, one entry per key, under whatever namespace F1 created
(`t.decorations` or its equivalent). **Before adding each label, grep `src/i18n/pl.ts`
for it as a substring in BOTH directions** (L-007) — a new label that contains or is
contained by an existing one breaks unrelated `getByText` locators.

#### 3. Slot coordinates for the new decorations — **RESOLVED: not needed**

**[contention sweep, CPD-7]** This sub-phase was conditional on *"if F1 places
decorations at `WORLD_SLOTS` coordinates rather than in a separate row"*. F1's plan
settles it the other way, twice and explicitly: Phase 5 §1 — *"**No `slot` field**: the
first batch takes `ShopArt`'s documented corner-row fallback, which is exactly what lets
sets ship one entry at a time"* — and Phase 5 §4, which renders owned decorations
*"through `ShopGlyph` in the corner row"*. So **no decoration id ever appears in
`WORLD_SLOTS`**, and the two Phase 3 tables stay sized to `UPGRADE_IDS` alone.

**Contract**: no change to `src/components/child/ShopArt.tsx` in this phase. If the
landed F1 code contradicts its own plan and does key decorations by `WORLD_SLOTS`,
follow the code, add the entries under Phase 3's shape contract (one horizontal, one
vertical, percent in 0–100), and record the discrepancy in the handoff.

### Success Criteria:

#### Automated Verification:

- Every invariant sweep F1 shipped (no-trap, no-harm, no-dominance) passes over
  **all six** worlds, not four
- `npm test` — branch baseline + Phase 1 cases + whatever F1's sweeps add per world
- `npm run lint` — exit 0; `npm run check` — 0 errors, 0 warnings
- L-007 substring sweep over `src/i18n/pl.ts`: each new decoration label neither
  contains nor is contained by any existing label — run it, don't assume it
- Deliberate break (L-004): remove one new world's decoration set entirely → F1's
  per-world totality assertion in `tests/decorations.test.ts` (anchor on
  `decorationsForWorld`) goes red naming that slug. **Meta-check:** if removing a whole
  world's set leaves F1's suites green, the assertion does not quantify over
  `WORLD_SLUGS` and the phase has proved nothing — report that to F1's surface rather
  than papering over it. *[contention sweep: this break is the **same shape** as the red
  Phase 1 already observed, so on its own it re-proves a known fact. What makes it worth
  running is the **path** (L-009): confirm the red names the world you emptied, not
  merely that something is red.]*

#### Manual Verification:

- In Pracownia, with the whole catalogue owned, the shop screen still offers a next
  thing to buy — the decorations — and each renders as a lucide glyph on the app's
  tokens, not as a broken image
- The same in Laboratorium, with a visibly different set

---

## Phase 5: E2E — six tiles at the touch viewport (droppable, for `/10x-e2e`)

### Overview

One risk, and only one, genuinely needs a browser: **the six-tile grid's layout at
the `touch` project's 712px**, which no unit test can see. Everything else about this
feature is data and is covered by vitest.

### Changes Required:

#### 0. The `touch` project must be told about the new spec — WITHOUT THIS THE PHASE IS DECORATIVE

**File**: `playwright.config.ts` — the `touch` project's `testMatch`

**Intent**: The whole risk of this phase is **712px**, and the `touch` project is
`testMatch: /(gameplay-restore|growth)\.spec\.ts/` — deliberately scoped, not
suite-wide. A new `e2e/worlds.spec.ts` therefore runs in the **desktop** project only,
at 1280px, where six tiles in three columns trivially fit: the contracted assertion
would run at the one viewport that cannot carry the contracted risk (L-004, and L-009's
"verify the path, not the fact"). The config's own comment gives the instruction
verbatim: *"EXTEND the alternation when adding one (`|worlds`); never replace it."*

**Contract**: `testMatch: /(gameplay-restore|growth|worlds)\.spec\.ts/` — extend the
alternation, never replace it. If `/10x-e2e` instead puts the risk into an existing
spec, it must be one **already** matched by that regex; putting it anywhere else
without this edit ships a test that cannot fail for the reason it exists.

**[contention sweep, CPD-8] `playwright.config.ts` IS a contention point — just not with
F1's *plan*.** F1's plan ships no new E2E specs (its Phase 6 edits `e2e/growth.spec.ts`
only), so W1 owns this file for the implement lane. But the run's own `/10x-e2e` step for
F1 may add a spec and reach for the same `testMatch` alternation. `ownership.md` assigns
**W1 as the owner of `playwright.config.ts`**; every other writer — F1's e2e step
included — **extends the alternation and never replaces it**, and on a merge conflict
here **keep both alternatives**, never `--ours`/`--theirs`. A lost alternative is silent:
the spec still runs, desktop-only, at the one viewport that cannot carry its risk.

#### 1. Risk W1-E2E-1 — the world grid holds six tiles at 712px without overflow

**File**: `e2e/worlds.spec.ts` (new — no world-selection spec exists today; `ls e2e/`
lists `gameplay-restore`, `growth`, `onboarding`, `parent-surfaces`,
`parent-weekly-report`, `password-reset`, `seed`, `smoke`)

**Intent**: Assert that at the `touch` viewport the world-selection grid renders six
tiles, that none of their accessible names is ambiguous, and that the grid does not
overflow its container.

**Contract**: locate tiles by `getByRole("button", { name, exact: true })` — never
`getByText`, which matches substrings (L-007). Measure overflow on **the grid element
itself** (`scrollWidth` vs `clientWidth`), not on `document.documentElement`:
`document`-level measurement cannot see overflow inside a fixed or clipped ancestor,
and the app's bottom bar is `position: fixed` — the assertion must measure the
element that actually carries the risk (L-004). Also assert the confirm CTA is
visible without scrolling horizontally.

### Success Criteria:

#### Automated Verification:

- `E2E_PORT=<yours> npx playwright test` — branch baseline + **2** (one desktop run,
  one touch run), **0 failures**. `+1` is the tell that the `testMatch` edit above was
  skipped and the risk is being measured at 1280px only — treat `+1` as a failed phase,
  not a passed one. Confirm by name in the runner output that a **touch** run of the
  new spec appears.
- Deliberate break (L-004): force the grid to `grid-cols-6` at the touch width →
  the overflow assertion goes red; restore. **Meta-check:** confirm the redness comes
  from the grid's own `scrollWidth`, not from an incidental change in tile count — a
  break that also changes the count would let the count assertion carry the failure
  and leave the overflow assertion unproven.

#### Manual Verification:

- Nothing beyond Phase 2's manual pass — this phase exists to automate it

---

## Phase 6: Reconciliation after the rebase onto F1 — MANDATORY, never droppable

### Overview

Decision 6 lets this branch be cut from `matmaverse-v2` when
`feat/world-economy-profit-rule` does not yet exist. That fallback is safe for
*building* and **unsafe for merging**, because the merge order binds F1 first: the tree
W1 lands into has F1's catalogue and F1's decorations in it whether or not W1's branch
point did. Two of this plan's phases are written against facts measured at the branch
point that F1 changes underneath them, and **neither is self-healing**. This phase is
the reconciliation. It runs after the branch is rebased onto (or merged with) F1, and
it runs **even if Phases 4 and 5 were dropped**.

### Changes Required:

#### 1. Re-run Phase 3's id sweep against the merged `UPGRADE_IDS`

**File**: `src/components/child/ShopArt.tsx` — the two `WORLD_SLOTS` tables added in
Phase 3

**Intent**: Phase 3 sizes each new table to `UPGRADE_IDS` **as it read on this branch**.
If W1 was cut from `matmaverse-v2`, that is six; F1's Phase 3 grows the catalogue to
**eight** (`precision`, `margin`). The moment F1 is in the tree,
`tests/shop-art-slots.test.tsx`'s id sweep iterates `Object.entries(WORLD_SLOTS)` ×
`UPGRADE_IDS` and finds `pracownia` and `laboratorium` missing both new ids — **a
guaranteed red at merge that no phase before this one can see**, because on W1's own
branch the sweep was green.

**Contract**: after the rebase, re-read `UPGRADE_IDS` and add the missing ids to both
new tables, using Phase 3's own stated placements for a margin entry — pracownia
top-centre `y≈4%, x≈30–40%` and the bottom-centre-left floor; laboratorium top-centre
`y≈4%, x≈30–45%` and the bottom-centre-left floor. Same shape contract: exactly one of
`left`/`right`, one of `top`/`bottom`, percent in 0–100. Do not touch F1's three
tables or `DEFAULT_SLOTS`.

#### 2. Re-evaluate Phase 4's gate — a dropped Phase 4 is deferred, never cancelled

**File**: `src/data/decorations.ts` (F1's), `src/i18n/pl.ts`

**Intent**: Phase 4's gate is *"does `src/data/decorations.ts` exist?"*, asked at the
**branch point**. The binding question is whether it exists in the **merged** tree, and
under the run's merge order it does. If Phase 4 was dropped and nothing re-asks, the
shipped product has six worlds and **four** worlds' decorations: in Pracownia and
Laboratorium `decorationsForWorld(slug)` returns `[]`, `nextPurchase` falls to `null`
once the catalogue is exhausted, and `/app/growth` shows `t.growth.noNextUpgrade` — the
exact state D-11 exists to abolish — for a third of the worlds. **[contention sweep,
CPD-1] Correction: this would NOT be silent.** F1's Phase 5 §1 totality assertion in
`tests/decorations.test.ts` goes red the moment `WORLD_SLUGS` carries a slug with an
empty set, so a dropped Phase 4 fails the suite. That makes this sub-phase a
**confirmation** rather than the only guard — but it stays mandatory, because a red
discovered at integration is still a red W1 owns.

**Contract**: after the rebase, if `src/data/decorations.ts` exists, **run Phase 4 in
full** (Progress rows 4.2–4.9) and flip its rows from `DROPPED (F1 absent)` to done. If
it still does not exist — meaning F1 did not land at all — the two empty sets are a
**blocking handoff item for the integration step**, not a silent omission: say in the
handoff that Pracownia and Laboratorium ship with no decoration sink and name
`decorationsForWorld` in `src/data/decorations.ts` as the symbol that proves it.

#### 3. Re-anchor the Phase 3 criteria on symbols, not on F1's test titles

**File**: this plan's Phase 3 success criteria (documentation only)

**Intent**: F1's Phase 3 renames `tests/shop-art-slots.test.tsx`'s case *"covers all six
upgrade ids in every table"* to a count-free phrasing. Every reference in this plan to
that title is therefore of-the-moment (L-006).

**Contract**: anchor on the `Object.entries(WORLD_SLOTS)` loop and on the failure
message `"<slug>" has no slot for upgrade "<id>"`, which F1's rename does not change.

### Success Criteria:

#### Automated Verification:

- `npm test` on the **merged** tree — the post-rebase baseline + this branch's delta,
  **0 failures**. Re-measure the baseline after the rebase; it is not the branch
  baseline recorded in Phase 0 (L-005).
- `tests/shop-art-slots.test.tsx` green with **five** world tables each covering every
  id in the merged `UPGRADE_IDS` — assert the id count you actually observed, do not
  assume six or eight.
- If `src/data/decorations.ts` exists: `decorationsForWorld("pracownia")` and
  `decorationsForWorld("laboratorium")` are both **non-empty**, and F1's invariant
  sweeps pass over all six worlds.
- `npm run lint` exit 0; `npm run check` — 0 errors, 0 warnings.
- Deliberate break (L-004): delete one of the ids added in §1 from the `pracownia`
  table → the id sweep goes red naming `pracownia` and that id; restore.
  **Meta-check:** this is the *same* break Phase 3 already ran, so on its own it proves
  nothing new. What this phase must prove is the **path**, not the fact (L-009): before
  fixing §1, run the sweep on the merged tree **unrepaired** and record that it was red
  for exactly the two new worlds × the two new ids. If it was already green, the rebase
  did not bring F1's catalogue in and the rebase itself is what failed.

#### Manual Verification:

- `/app/start` in Pracownia and in Laboratorium with the **merged** catalogue fully
  owned: every badge, including the two margin entries, sits in a margin.
- With that catalogue exhausted, both new worlds still name a next thing to buy.

---

## Testing Strategy

### Unit Tests

- **New:** `tests/worlds-art.test.ts` — slug = stem = `image` path, file exists on
  disk, slugs unique and URL-safe. Closes the one invariant every consumer assumes
  and nothing checked.
- **Unchanged and load-bearing:** `tests/shop-art-slots.test.tsx` (goes red in Phase
  1, green in Phase 3), `tests/worlds-picker.test.tsx` and `tests/data-lookups.test.ts`
  (must stay green **unedited** — that is the evidence the derive-don't-hardcode
  discipline held).
- **Do not simplify** the two iterating assertions in `tests/shop-art-slots.test.tsx`
  into a fixed list. Their whole value is that they grow with the data.

### Integration / E2E

- One risk only: **W1-E2E-1** (Phase 5). `e2e/onboarding.spec.ts` already walks
  `WORLDS[0]` and is six-proof; it needs no edit and should be confirmed green, not
  rewritten.

### Manual Testing Steps

1. Create a child profile, pick **Pracownia** in the wizard; confirm the tile grid
   has no orphan row at ~700px.
2. `/app/worlds` at ≥1024px → 3×2; at 712px → 2×3. Switch to **Laboratorium**.
3. On `/app/start`, with every catalogue entry owned, check every badge sits in a
   margin on both new plates. Repeat on `/app/growth`.
4. Signed out: the marketing strip still shows four cards, unchanged.

## Performance Considerations

None. Two array entries, two object literals, one class per grid. The two plates are
83KB and 87KB — comparable to the four already shipped (42–72KB) — and are loaded
only when their world is selected or previewed.

## Migration Notes

**There is no migration.** `child_profiles.theme` is `text not null default 'default'`
with no CHECK constraint; adding a world widens a zod `.refine` set in code and
nothing else. Existing rows are unaffected, and a profile whose `theme` is later
removed still resolves through `worldForTheme`'s total fallback to `DEFAULT_WORLD`.

## Known risks

Each names a file and a symbol (L-006).

- **The Phase 3 coordinates are an extrapolation.** No mockup draws upgrade badges on
  either plate; they come from the plates' own whitespace. They satisfy the shape
  contract by construction but need Phase 3's manual eyeball pass, exactly as
  `context/archive/2026-08-22-world-selection-screen/plan.md` Phase 5 required.
- **`CreateProfileWizard`'s `sm:grid-cols-3` is chosen by rule, not by mockup.** The
  `05` auth-v2 mockup would settle it and is unreadable from the code lane.
- **`t.marketing.worlds` remains a hand-maintained duplicate of `WORLDS`** that
  nothing tests and nothing syncs. Left at four deliberately (Decision 2); deriving it
  from `WORLDS` and deleting the duplication is the clean follow-up, and it must land
  together with `AuthShell.astro`'s `grid-cols-4`.
- **The `t.worlds` namespace collision is deferred, not resolved.** When per-world
  catalogue vocabulary is eventually written, it cannot nest under `t.worlds`
  (the world-selection **screen** namespace, whose header says it is deliberately not
  keyed by slug). The non-colliding homes are `t.worlds.bySlug[slug]` or a sibling
  namespace. W1 writes nothing there, so it inherits nothing.
- **Phase 4 depends entirely on F1's shape**, which did not exist when this plan was
  written. If F1's `Decoration` turns out to be keyed differently than "per world
  slug", Phase 4's contract needs re-reading against F1's landed module before it is
  executed — not adapted by guessing.
- **The mockups' per-tile glyphs are not rendered** by `SelectTile` (image + label
  only). This is a **pre-existing** divergence across all four shipped worlds, not
  new drift from W1 — recorded so a reviewer does not read it as such.

_Added at plan review (2026-08-27), deep mode:_

- ~~**F1 contracts no "every world has a decoration sink" assertion.**~~
  **[contention sweep, CPD-1 — WITHDRAWN, the premise is false.]** This risk was written
  against F1's *No-harm* sub-phase alone (Phase 5 §5), which indeed only sweeps decoration
  subsets for zero economic effect. But F1's Phase 5 **§1** ships exactly the missing
  assertion, with the data, in `tests/decorations.test.ts`: *"for every slug in
  `WORLD_SLUGS`, `decorationsForWorld(slug).length` equals the per-world count"* — and
  F1's own success criterion 5.5 restates it (*"Every slug in `WORLD_SLUGS` has a full
  decoration set — no world can ship with an empty sink"*). F1's plan even names this as
  the seam: *"It is what makes W1's Phase 4 non-droppable once F1 has landed."*
  Consequences, all of them favourable and all of them acted on above: a world with no
  decorations is **not** silent, it is red; Phase 4 is mandatory (CPD-4); Phase 1 shows
  two reds, not one (CPD-2); and Phase 6 §2's re-ask becomes a confirmation rather than
  the only guard. Progress row 4.7's assumption was correct.
  **Residual risk, and it is the one worth watching:** the assertion is contracted, not
  yet written. If it is absent from the landed F1 branch, W1's Phase 1 will show one red
  instead of two — that is the tell, and it is a finding for F1's impl-review, not
  something W1 papers over.
- **World names are inline literals on the `World` records** in `src/data/worlds.ts`,
  not dictionary entries — a standing L-003 tension that W1 makes 50% larger by adding
  two more. Deliberately not fixed here (moving names into `src/i18n/pl.ts` restructures
  a file F1 is appending to in the same stack, which the concurrency contract forbids),
  but note `public/illustrations/slice-map.md`'s claim that world labels "are rendered
  as text from `i18n`" is **already false** and gets falser. Clean follow-up: a
  `nameKey` on `World` resolving through the dictionary, landed alone.
- **`CreateProfileWizard` passes the world name as BOTH `alt` and `label`** to
  `SelectTile`, so each wizard tile's accessible name is doubled ("Pracownia
  Pracownia") — `WorldPicker` deliberately passes `alt=""` to avoid exactly this and
  says so in its own comment. Pre-existing across all four shipped worlds and out of
  W1's scope, but it is why `e2e/onboarding.spec.ts` needs `.first()` and why any new
  wizard-tile locator must **not** use `{ exact: true }` on the bare name.
- **The `touch` Playwright project is scoped by `testMatch`, not suite-wide.** Any
  future viewport-shaped risk added to a new spec file needs the same
  `playwright.config.ts` alternation edit Phase 5 §0 now carries, or it silently runs
  desktop-only.

## References

- Research: `context/changes/six-worlds-catalogue/research.md`
- Identity + intake ledger: `context/changes/six-worlds-catalogue/change.md`
- Run contract: `context/runs/2026-08-27-world-economy/agent-contract.md`
- D-3 and its reversal condition: `context/archive/2026-08-22-world-selection-screen/plan.md` § D-3
- The F4/F5 ownership split this plan copies: `context/archive/2026-08-22-world-selection-screen/plan-brief.md`
- Art-absence precedent: `src/data/stages.ts` · the `ART DEVIATION FROM THE MOCKUP` header
- Sibling feature: `context/changes/world-economy-profit-rule/research.md`

## Autonomous decisions

Made in place of every `AskUserQuestion` the `/10x-plan` skill calls for — the
complexity confirmation, the deep probing round and the design-options round — per
the run's hard rule 1. Each carries what would change the answer.

### Decision 0 — Complexity assessed **MEDIUM**, not confirmed with the user

**Chosen:** MEDIUM (7–10 questions' worth of decisions), narrowed by the
upstream-artifacts scaling in the skill's Step 1.0: a research doc **and** a
change.md intake ledger were both present, which the skill's own table drops to 5–7
solution-design decisions. Seven are recorded here.

**Rejected:** LOW (it would have skipped the marketing-strip and decoration-count
calls, both of which can ship a visible defect); HIGH (nine of eleven consumers are
already six-proof — there is no architecture to design).

**Why:** the surface is two data edits, three class/comment edits and one data
literal. The complexity is entirely in *which* small calls to make, not in how to
build anything.

**What would change the answer:** F1 landing a `Decoration` shape that is not keyed
per world — Phase 4 would then need real design work and this becomes HIGH.

### Decision 1 — W1 writes **no** per-world catalogue vocabulary (contract decision 3)

**Chosen:** the two new worlds resolve every catalogue entry's copy through
`upgradeCopy(id)`, which **already is** the neutral fallback. Zero of the 6 × 8
strings, and no copy-resolution code.

**Rejected:** (a) writing the full 6 × 8 vocabulary — 48 strings of child-facing
Polish with no mockup source and no kid-testing, written against a catalogue F1 is
changing in the same stack; that is the "no invented data" line. (b) Building the
`t.worlds[slug].upgrades[id] ?? t.upgrades[id]` resolution path so it "exists" for
later — that is a signature change across **10 call sites in 5 files**, two of which
(`ShiftResults.tsx`, `RecentActivity.astro`) have **no world in scope** and would
need a new prop threaded in, all to ship a branch with zero consumers.

**Why:** the fallback is not a thing to be built; it is the current behaviour. The
awkward cases already ship — `galaktyczna-baza` renders "Lepsza kasa" today — so two
more worlds make the situation larger, not different in kind. Vocabulary is purely
additive on top of a mandatory fallback, which is precisely why the fallback was made
mandatory.

**What would change the answer:** the maintainer supplying or approving the copy; or
F1 building the resolution path for its own two margin entries — in which case W1
consumes it and still writes no strings. Either is a `pl.ts` change with no code
change.

### Decision 2 — `t.marketing.worlds` stays at **four**, with a comment

**Chosen:** leave the signed-out marketing strip at four entries and comment it as a
sample, not a mirror of `WORLDS`.

**Rejected:** (a) appending two entries — `AuthShell.astro`'s
`hidden grid-cols-4 … lg:grid` goes ragged 4+2, desktop-only, and **no test or e2e
spec references `t.marketing` at all**, so it would ship unnoticed. (b) Growing it to
six *and* changing `AuthShell` to `grid-cols-3` — three lines, but it changes a
signed-out marketing surface with no mockup, no test and no product ask, inside a
feature about the in-app catalogue. (c) Deriving it from `WORLDS` — the right
long-term answer, but it deletes the ability to curate the strip and still needs the
`AuthShell` reflow; it belongs in its own change.

**Why:** the smallest edit that cannot ship a ragged panel, and it converts an
undocumented duplicate into a documented one.

**What would change the answer:** the maintainer wanting the signed-out strip to
mirror the catalogue — then it is two entries **plus** `AuthShell.astro`'s
`grid-cols-4` → `grid-cols-3`, landed together and eyeballed at ≥1024px.

### Decision 3 — decoration count per world: **inherit F1's N; 3 only as a standalone fallback** (contract decision 4)

**Chosen:** W1's two worlds get exactly the count and price curve F1 establishes for
the existing four. W1 does not pick a number independently. **Since this plan was
reviewed, F1's plan has settled it: AD-5 contracts FOUR per world at 40 / 80 / 140 /
220, and F1's own AD-5 rationale already sizes the eventual art debt at "6 × 4 = 24" —
i.e. it budgets for W1's two worlds.** So the inherited number is **4**. The `3`
fallback survives only for the case where F1's landed registry contradicts its own
plan; W1 then follows the code, not either document, and records the discrepancy.

**Rejected:** (a) W1 choosing its own N — unequal sink capacity between worlds is the
one way an effect-free decoration set could still create the between-world asymmetry
D-11 exists to prevent. (b) W1 blocking on F1's number — the run has no human to
unblock it.

**Why:** F1 owns `src/data/decorations.ts` and the D-13 pacing model that sizes the
wallet's sink against the reference shift; that model, not W1, is what prices N. The
fallback of 3 is the smallest count that reads as a *set* rather than a pair while
still offering a choice, and with no art each entry costs one lucide icon plus one
name.

**What would change the answer:** F1's pacing model concluding the sink needs a
different size — W1 follows F1 to the new number rather than keeping 3.

### Decision 4 — Phase 4 is **conditional and droppable**; W1 never creates `src/data/decorations.ts`

**Chosen:** if F1 has not landed at W1's branch point, W1 ships worlds-only (Phases
1–3, 5) and records the decoration half as explicitly deferred.

**Rejected:** W1 creating the decoration module itself. Verified absent in source *at
plan time, on `matmaverse-v2`*: no `Decoration` type, no `shop_state.decorations`, no buy
path, and `Upgrade.art` was a required `string` so `ShopArt` could not render an art-less
entry at all. *[contention sweep: on the actual branch point all four of those facts are
already reversed by F1 — `Upgrade.art` becomes `art?: string` in F1's Phase 3 §2 and
`ShopGlyph` exists. The **conclusion** is unchanged and stronger: W1 appends to F1's
module because F1's module is there.]*

**Why:** a list with no sink, no persistence and no renderer is dead code, and sizing
it means inventing the D-13 pacing model the contract forbids W1 to invent. The
archived F4/F5 run set the precedent: the downstream feature touches only the data
literal, in a droppable phase.

**What would change the answer:** F1 landing (the expected case) — Phase 4 runs and
Decision 3 governs. **Note the drop is a deferral, not a cancellation:** Phase 6 §2
re-asks the gate against the *merged* tree, because the merge order puts F1 in the tree
regardless of where W1 branched.

**[contention sweep, CPD-4] SUPERSEDED in the concrete: the answer changed.** F1 landed
in the stack, `ownership.md` binds the branch point to `feat/world-economy-profit-rule`,
so Phase 4 **runs** and the conditional machinery above is dormant, not live. And the
last sentence of the original — *"ships two worlds with an empty decoration sink and
nothing red"* — is **wrong** (CPD-1): F1's `tests/decorations.test.ts` totality assertion
makes that state red. Keep the decision recorded for the counterfactual; do not execute
its fallback.

### Decision 5 — a **new test** (`tests/worlds-art.test.ts`) is in scope, though W1 could ship without it

**Chosen:** pin slug = filename stem = `image` path, and file existence on disk.

**Rejected:** shipping the two records with no new test, relying on
`tests/data-lookups.test.ts`'s existing iteration. That file never reads
`World.image`.

**Why:** A3 (keep *Pracownia* / *Laboratorium* rather than the mockups' longer names)
rests entirely on slug↔stem↔`theme` being one string, and the archived F5 plan
already recorded that **no test pins the slug** — *"the type system will not catch a
rename; the live rows will."* A typo'd stem is a silent 404 in three surfaces with no
crash and no red. This is the cheapest possible guard for the invariant this whole
feature stands on.

**What would change the answer:** a CI step that already validates every
`public/illustrations/` reference — there is none.

### Decision 6 — **branch from F1 if it exists, from `matmaverse-v2` if it does not**

**Chosen:** `feat/six-worlds-catalogue` cut from `feat/world-economy-profit-rule`
when that branch exists; otherwise from `matmaverse-v2`, with Phase 4 dropped.

**Rejected:** hard-blocking on F1's branch. At the time this plan was written F1 was
at research stage with **no branch cut**, and the run has no human to unblock a wait.

**Why:** Phases 1–3 and 5 have **zero** dependency on F1 — they are two `WORLDS`
records, two grid classes, two comment rewrites and one data literal. Only Phase 4
couples. Making the coupling one droppable phase means F1 slipping costs W1 one phase,
not the whole feature.

**What would change the answer:** the orchestrator re-serialising the run so F1's
merge is guaranteed before W1 starts — then the branch point is unconditional and
Phase 4 is mandatory. Note the merge order still binds either way: **F1 merges before
W1**, because both edit `src/i18n/pl.ts`.

**Correction applied at plan review.** The fallback is safe for *building* and unsafe
for *merging*, and the original wording named only Phase 4 as the cost. It is not: with
F1 in the merged tree, `UPGRADE_IDS` is **eight**, and the two `WORLD_SLOTS` tables
Phase 3 sized to six ids fail `tests/shop-art-slots.test.tsx`'s id sweep — a red that
is invisible on W1's own branch and guaranteed at merge. **Phase 6 is the price of this
decision and is not droppable.** The run contract's own stack rule ("cut from its
predecessor when `ownership.md` puts it in a stack") makes the F1 branch point the
expected case, so Phase 6 will usually be a cheap confirmation — but it must be asked,
not assumed.

### Decision 7 — exactly **one** e2e risk, and it measures the grid, not the document

**Chosen:** W1-E2E-1 only — six tiles at 712px, located by role with `exact: true`,
overflow measured on the grid element's own `scrollWidth`.

**Rejected:** (a) no e2e at all — the reflow is the one thing in this feature that
only a browser can see. (b) An e2e walk of picking each new world end-to-end —
`e2e/onboarding.spec.ts` already covers the mechanism and is six-proof; a second walk
would re-test the framework. (c) Measuring `document.documentElement.scrollWidth` —
L-004's `world-progression-stages` case is exactly this: a fixed-position bar
overflowed by 96px while the document measurement stayed clean, so the contracted
assertion could not catch the contracted risk.

**Why:** the browser-only residue of this feature is layout, and layout assertions
must measure the element that carries the risk.

**What would change the answer:** the `/10x-e2e` step finding that the world-selection
route has no spec file at all and that adding one costs more setup than the risk
warrants — then this drops to Phase 2's manual pass and the handoff says so.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step
> lands. Do not rename step titles.

### Phase 0: Baseline

#### Automated

- [x] 0.1 Record `npm test` and `npx playwright test` counts **on this branch** before any edit (L-005)
- [x] 0.2 Record whether `src/data/decorations.ts` exists — this decides Phase 4

### Phase 1: The two worlds enter `WORLDS`, with the slug↔stem↔art invariant pinned

#### Automated

- [x] 1.1 `npm test` — branch baseline + new `tests/worlds-art.test.ts` cases; `tests/shop-art-slots.test.tsx` expected red (record which cases) — 8cec4c9
- [x] 1.2 `npm run lint` exit 0 — 8cec4c9
- [x] 1.3 `npm run check` — 0 errors, 0 warnings — 8cec4c9
- [x] 1.4 `tests/data-lookups.test.ts` and `tests/worlds-picker.test.tsx` green **unedited** — 8cec4c9
- [x] 1.5 Deliberate break: wrong `image` stem → `tests/worlds-art.test.ts` red → restore green; meta-check recorded — 8cec4c9

#### Manual

- [x] 1.6 `/app/worlds` lists six tiles; both new plates load — 0302c70
- [x] 1.7 L-007 two-direction substring sweep on *Pracownia* and *Laboratorium* over `src/i18n/pl.ts` and `src/data/*.ts` — no collision either way (re-run after F1's dictionary appends, do not inherit the plan-time check) — 8cec4c9

### Phase 2: The two grids reflow and the comments that lied are rewritten

#### Automated

- [x] 2.1 `npm test` — branch baseline + 0; `tests/worlds-picker.test.tsx` green unedited — 9cbbd62
- [x] 2.2 `npm run lint` exit 0 — 9cbbd62
- [x] 2.3 `npm run check` — 0 errors, 0 warnings — 9cbbd62
- [x] 2.4 `grep`: no `WORLDS.map` grid carries `sm:grid-cols-4`; no header contains "Only FOUR worlds exist" — 9cbbd62

#### Manual

- [x] 2.5 `/app/worlds` 3×2 at ≥1024px, 2×3 at 712px, CTA reachable — 0302c70
- [x] 2.6 Wizard step 2 at ~700px: 3×2, no orphan row — 0302c70
- [x] 2.7 Signed-out marketing strip still four cards, layout unchanged — 0302c70

### Phase 3: `WORLD_SLOTS` gains `pracownia` and `laboratorium`

#### Automated

- [x] 3.1 `tests/shop-art-slots.test.tsx` — all five cases green over five tables — 8cec4c9
- [x] 3.2 `npm test` — branch baseline + Phase 1 cases, 0 failures — 8cec4c9
- [x] 3.3 `npm run lint` exit 0; `npm run check` 0 errors, 0 warnings — 8cec4c9
- [x] 3.4 Deliberate break (a): delete `pracownia.sign` → id-coverage case red → restore — 8cec4c9
- [x] 3.5 Deliberate break (b): delete the `laboratorium` table → per-world case red → restore; meta-check (prefix break proves nothing) recorded — 8cec4c9

#### Manual

- [x] 3.6 `/app/start` in Pracownia, all upgrades owned: no badge over a focal point — 8cec4c9
- [x] 3.7 `/app/growth` in Laboratorium, all upgrades owned: no badge over a focal point — 8cec4c9
- [x] 3.8 No badge clipped by the `aspect-[4/3]` box at either width — 8cec4c9

### Phase 4: Each new world's decoration set — CONDITIONAL on F1, droppable

> **[contention sweep, CPD-4] Heading kept verbatim so Progress rows stay greppable, but
> it is superseded: on this branch Phase 4 is MANDATORY and has no `DROPPED` state.**
> See the phase body above.

#### Automated

- [x] 4.1 Gate: `src/data/decorations.ts` exists (guaranteed by the F1 branch point) — if absent, report **BLOCKED**; there is no `DROPPED` state for this phase *[contention sweep, CPD-4]* — 8cec4c9
- [x] 4.2 Two world keys appended at F1's count and price curve; F1's four sets unedited — 8cec4c9
- [x] 4.3 F1's invariant sweeps (no-trap / no-harm / no-dominance) pass over **all six** worlds — 8cec4c9
- [x] 4.4 `npm test` — branch baseline + Phase 1 cases + F1's per-world sweeps — 8cec4c9
- [x] 4.5 `npm run lint` exit 0; `npm run check` 0 errors, 0 warnings — 8cec4c9
- [x] 4.6 L-007 substring sweep over `src/i18n/pl.ts` for every new decoration label, both directions — 8cec4c9
- [x] 4.7 Deliberate break: remove one world's decoration set → F1's per-world sweep red → restore; if it stays green, report that F1's sweeps do not quantify over worlds — 8cec4c9

#### Manual

- [x] 4.8 Pracownia with the catalogue exhausted still offers a next thing to buy; each renders as a lucide glyph, not a broken image — 0302c70
- [x] 4.9 Laboratorium shows a visibly different set — 0302c70

### Phase 5: E2E — six tiles at the touch viewport (droppable, for `/10x-e2e`)

#### Automated

- [x] 5.0 `playwright.config.ts` `touch` project `testMatch` EXTENDED to `/(gameplay-restore|growth|worlds)\.spec\.ts/` (alternation extended, never replaced) — 0302c70
- [x] 5.1 `E2E_PORT=<yours> npx playwright test` — branch baseline + **2** (desktop + touch runs of the new spec), 0 failures; `+1` means 5.0 was skipped — 0302c70
- [x] 5.2 Six tiles located by `getByRole(..., { exact: true })`; no ambiguous accessible name — 0302c70
- [x] 5.3 Overflow measured on the grid element's own `scrollWidth`, not `document.documentElement` (L-004) — 0302c70
- [x] 5.4 Deliberate break: force `grid-cols-6` at the touch width → overflow assertion red → restore; meta-check that the redness came from the overflow assertion, not the count assertion — 0302c70

### Phase 6: Reconciliation after the rebase onto F1 — MANDATORY, never droppable

#### Automated

- [x] 6.1 Post-rebase baseline re-measured (`npm test`, `npx playwright test`) — the Phase 0 numbers are stale after a rebase (L-005) — 0302c70
- [x] 6.2 Merged `UPGRADE_IDS` re-read; the unrepaired sweep run first and its red recorded (L-009 path check), then both new `WORLD_SLOTS` tables completed to cover every merged id — 0302c70
- [x] 6.3 `tests/shop-art-slots.test.tsx` green over five tables × the merged id set; anchored on the `Object.entries(WORLD_SLOTS)` loop, not on F1's renamed case title — 0302c70
- [x] 6.4 Phase 4 gate RE-ASKED against the merged tree; if `src/data/decorations.ts` now exists, rows 4.2–4.9 run and flip from `DROPPED (F1 absent)` — 0302c70
- [x] 6.5 `decorationsForWorld("pracownia")` and `decorationsForWorld("laboratorium")` both non-empty, or the empty sink is raised as a BLOCKING handoff item naming that symbol — 0302c70
- [x] 6.6 `npm test` 0 failures, `npm run lint` exit 0, `npm run check` 0 errors / 0 warnings — all on the merged tree — 0302c70
- [x] 6.7 Deliberate break: delete one merged id from the `pracownia` table → id sweep red naming slug+id → restore — 0302c70

#### Manual

- [x] 6.8 `/app/start` in Pracownia and Laboratorium with the merged catalogue fully owned: no badge over a focal point — 0302c70
- [x] 6.9 With that catalogue exhausted, both new worlds still name a next thing to buy — 0302c70
