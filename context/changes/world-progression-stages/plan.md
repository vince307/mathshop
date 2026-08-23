# Named shop growth stages + per-shift earnings — Implementation Plan

Change id: `world-progression-stages` (feature **F4** of run `context/runs/2026-08-22-autonomous-five/`)
Research (ground truth, read it): `context/changes/world-progression-stages/research.md`
Standing brief: `context/runs/2026-08-22-autonomous-five/agent-contract.md`

## Overview

Two halves, both in scope:

**(a) Named growth stages.** Replace the bare `business_level` integer and the decorative,
`aria-hidden` 5-node milestone path with a real catalogue of named stages — *Mały stolik →
Stoisko → Sklep z ofertą → Popyt i zysk* — rendered as a done / current / locked rail on a
dedicated screen at **`/app/growth`**, with its own sidebar + bottom-bar entry ("Rozwój świata").

**(b) A per-shift `earned` column on `shift_log`.** `recordShiftResult` already computes the
payout via `earningsForShift` and throws it away because `appendShiftLog` takes four columns.
Persisting it is what makes "ile zarobiłem w tym tygodniu" a real number. F4 ships the column
and the write path; the parent-facing tile is handed to feature F1 with a written recipe
(see **Handed to F1**).

## Current State Analysis

- **Growth today is one integer with one writer.** `businessLevelForShifts(n) = 1 + Math.floor(n / 3)`
  (`src/data/shift.ts:99-101`) is called from exactly one production line
  (`src/lib/services/child-profiles.ts:172`) and written at `:180`. There is no level name, no stage,
  no lookup table anywhere in the codebase.
- **The level is uncapped and must stay that way.** No `Math.min`, no `MAX_LEVEL`; the only DB
  constraint is the floor `business_level >= 1`
  (`20260630120000_child_profiles_add_gameplay_state.sql:29`). `recordShiftResult:189` returns
  `leveledUp: businessLevel > current.business_level` — a cap makes that permanently `false`.
- **Nothing in the game unlocks above business level 3.** The highest `requiredWorldLevel` in
  `src/data/upgrades.ts` is `3`. A four-stage catalogue matches the game's real content depth.
- **The only progression visualisation that exists** is the 5-node milestone path at
  `src/pages/app/start.astro:111-133` — `aria-hidden="true"`, no i18n key, a sliding integer window
  with no semantics.
- **`earned` is dropped on one line.** Computed at `child-profiles.ts:170`, spent at `:178`,
  returned at `:189`; the `appendShiftLog` call at `:187` passes only
  `{ accountId, profileId, skills }`.
- **`appendShiftLog` has no error handling at all** (`:120-137`) — the insert result is never read,
  so a shift can pay the wallet and lose its log row silently. `sum(shift_log.earned)` is therefore
  a permanent **lower bound**, by design.
- **`shift_log` RLS is column-agnostic.** All four policies
  (`20260701150000_create_shift_log.sql:38-63`) predicate only on `auth.uid() = account_id`; no
  column list, no column reference. `grep -rniE "grant|revoke" supabase/migrations/` finds no
  column-level grant anywhere in the project.
- **`PROTECTED_ROUTES = ["/app"]`, matched with `startsWith`** (`src/middleware.ts:5, :42`). Anything
  under `/app` is auth-gated with zero middleware changes.
- **Per-stage world artwork exists for zero worlds.** `world-progression-cafe.png` is a single
  1536×1024 composite of three stages side by side with a baked-in connector path — a hero
  illustration *about* progression, not swappable stage images. Three of four worlds have nothing.
- **Baseline to preserve:** `npm run lint` clean, `npm test` **299 tests / 39 files**,
  `npx playwright test` **15/15** — *both measured 2026-08-22, before F2's tests existed.*
- **MEASURED ON THIS BRANCH (2026-08-23, `feat/world-progression-stages` cut from
  `feat/parent-weekly-activity-chart`, i.e. with F2 *and* F1 landed):**
  **`U₀ = 346` tests / 44 files** and **`E₀ = 17`** (15 + F1's two `parent-weekly-report` specs).
  `npm run lint` clean, `npm run check` 0 errors / 0 warnings / 9 pre-existing hints.

> **The baseline is a moving floor, not a constant** (plan review). F2 is landing
> `tests/recent-activity.test.ts` + `tests/recent-activity-isolation.test.ts` + new `i18n-helpers`
> cases, and F1's Phase 6 adds e2e specs. **Before Phase 1, measure the floor on your own branch and
> write it into this line:**
>
> ```bash
> npx vitest run --reporter=dot          # → U₀  (unit floor)
> npx playwright test                    # → E₀  (e2e floor; 15 at plan time)
> ```
>
> Every success criterion below is expressed as **`U₀ + delta`** / **`E₀ + delta`**. No criterion in
> this plan may hardcode an absolute test count — an absolute number is unsatisfiable the moment a
> sibling feature lands, and it silently stops verifying anything once the floor rises past it.

## Desired End State

A signed-in child can reach **`/app/growth`** from the sidebar ("Rozwój świata", desktop) or the
bottom tab bar (below `lg`). The screen shows:

- an `h1` "Rozwój sklepu" with the world name as subtitle, the shell's wallet pill and level badge;
- a **stage rail** — a vertical card list below `lg`, a horizontal rail at `lg+` — with all four
  stages, each rendered done / current / locked, the current one ringed and chipped "Aktualnie";
- a hero showing the child's *own* shop (`ShopArt` = `world-<slug>.webp` + owned upgrade icons);
- "Co odblokowuje ten etap" — the upgrades whose `requiredWorldLevel` equals the current stage's
  `requiredLevel`, from `UPGRADES` (or an honest empty line at the terminal stage);
- the "Następne ulepszenie" card (name, art, cost, savings progress) reusing `nextUpgrade` /
  `canBuy`, with a "Zobacz ulepszenia" CTA to `/app/upgrades`;
- at the terminal stage: no phantom fifth locked node, no next-stage bar, and the caption
  *"To najwyższy etap — Twój sklep działa pełną parą."*

And every completed shift writes its server-computed payout into `shift_log.earned`.

**Verification:** `npm run lint` clean; `npm test` green at ≥ `U₀ + 2` (Phase 1) rising to `U₀ + ~14`;
`npx playwright test` green at ≥ `E₀ + 5`; `/app/growth` redirects an anonymous visitor to `/auth/signin`; a `select earned from
shift_log` after a completed shift returns `5*taskCount + 3*cleanCount`; a purchase row's `earned`
is `null`.

### Key Discoveries

- `src/data/skills.ts:96-110` (`skillProgress` → `{ level, fraction, atMax }`) is the exact
  precedent for a total, saturating ladder resolver. Copy its shape for `stageForLevel`.
- `src/data/upgrades.ts:15-41, 107-113` is the catalogue house style: exported `interface`, then
  `export const X: readonly T[] = [...] as const`, a `X_IDS` tuple, a `Map`-backed `getX`. No
  `satisfies` anywhere in `src/data/`.
- `src/i18n/pl.ts:266-275` + `src/i18n/index.ts:29-35` (`upgrades` record + guarded `upgradeCopy`)
  is the copy pattern to mirror (L-003). **Do not** copy `profileWizard.levelNames`
  (`pl.ts:167`) — a hard-coded 3-entry map with a manual saturating index at
  `CreateProfileWizard.tsx:90`, a cautionary example of this change's exact problem.
- `src/pages/app/upgrades.astro:22-32` is the frontmatter template (`createClient` may be `null`;
  `resolvePageProfile` ladder; `EmptyStateCard` branch; `heading` + `subtitle={world.name}`).
- `src/components/app/AppShell.astro:38` (`active` union) and `:59-63` (`items`, spread into `tabs`
  at `:65`) are the two nav insertion points — one object appears in both navs.
- `src/components/child/childCard.ts` is the shared card-chrome helper used by every child surface.
- `tests/shifts-complete.test.ts:89-97` (`readLogRows` with an explicit
  `.select("skills, upgrade_purchased")`) is where `earned` persistence gets asserted.
- `tests/reports.test.ts:13-15`'s `row()` helper is typed `ShiftLogRow` — any `earned` field added
  to that interface must be **optional** or it becomes a type error.
- `playwright.config.ts:42-54`: the `touch` project (712×1138) is scoped by
  `testMatch: /gameplay-restore\.spec\.ts/` to that one spec. A new screen gets no
  touch-viewport coverage unless its spec is added to that regex.

## What We're NOT Doing

- **Not capping `businessLevelForShifts`.** It stays `1 + floor(n/3)`, unbounded. Saturation happens
  in `stageForLevel`, at the presentation layer.
- **Not gating `t.results.levelUp` on a stage change** (see Autonomous decisions D-2).
- **Not touching `/app/worlds`** — that route and the `worlds` key in the `AppShell` `active` union
  belong to feature F5 (`context/changes/world-selection-screen/`).
- **Not restructuring `ShopArt.tsx`.** F4 owns the file and deliberately leaves its API unchanged
  (see D-5 and the F5 boundary note).
- **Not shipping the parent earnings tile.** The column ships here; the tile is handed to F1 with a
  written recipe.
- **Not backfilling `shift_log.earned`.** Pre-migration rows stay `null`.
- **Not rendering any XP bar, daily profit, daily customer count, satisfaction percentage, or
  "Następne kroki" goal counters** — none of them have a data source (see the per-panel table).
- **Not adding an "Moje osiągnięcia" button or a notification bell** — no achievements or
  notifications system exists, and a nav entry ships with its screen.
- **Not adding a server-side breadcrumb to the swallowed `appendShiftLog` error.** That is a change
  to shift-completion failure semantics and the codebase has no logging convention; out of scope.
- **Not removing the existing milestone path from `start.astro`.** It is decorative and
  `aria-hidden`; removing it is a dashboard change with its own e2e surface. Left for a follow-up.
- **Not adding any new API route.** The screen is a read-only view over the `ChildProfile` the page
  already loads.

## Implementation Approach

Four small phases, each independently committable, ordered so the risky, irreversible piece
(the migration) lands first and alone:

1. **Migration + write path + registry** — server only, no UI. Column, one call-site change, docs.
2. **Stage catalogue + copy** — pure `src/data/` + `src/i18n/`, no UI. All the ladder tests land here.
3. **The `/app/growth` screen** — page + rail component + copy. Reachable by URL, not yet linked.
4. **Nav entry + browser tests** — the link ships *with* the screen already built, per the
   no-dead-navigation rule.

---

## Autonomous decisions

This run has **no human in the loop** (standing brief, Hard rule 1). `AskUserQuestion` was never
called; the skill's complexity gate and every question round were decided here instead. Each entry
records the choice, what was rejected, why, and what would reverse it.

### D-0 — Complexity and questioning

**HIGH complexity, self-assessed** (migration + new screen + shared nav + two concurrent-feature
collisions), and **zero questions asked**. The skill's own scaling table puts "task + research" at
8–11 questions; all of them were answered from `research.md`, which closes every one with a
concrete recommendation and its evidence. Rejected: asking anyway — it would have violated the
standing brief and re-litigated work the research step already paid for.
**Reverses if:** the maintainer disputes any decision below; each carries its own reversal condition.

### D-1 — `earned` column: nullable, no backfill (research option **B-1**) ✅

`earned integer null` with `check (earned is null or earned >= 0)`. No `UPDATE` statement, no
reconstruction from `shift_log.skills`.

**Why the research's recommendation is not defeated.** I looked for a defeater and found none.
Reconstruction from `skills` yields only a **lower bound**: `src/pages/api/shifts/complete.ts:56-57`
validates the skill delta with `<=`, not `=`, so a reconstructed
`5*Σcompleted + 3*ΣfirstTryCorrect` can be strictly less than what `earningsForShift(taskCount,
cleanCount)` actually paid. `EARN_PER_TASK`/`EARN_PER_CLEAN` are documented as tunable, so a
backfill freezes today's constants onto rows written under different ones. And purchase rows would
reconstruct to `0`, conflating "earned nothing" with "not a shift". A reconstructed number is
plausible, not recorded — invented data by this run's standard.

Rejected: **B-2** (`not null default 0`) — every historical shift becomes a *recorded zero-earning
shift*, a fabricated number a parent-facing total would silently include, permanent and
indistinguishable from truth. **B-3/B-4** (reconstruct) — see above.

**Reverses if:** the maintainer states existing `shift_log` rows are disposable pre-launch data
(the language *"Pre-launch: no production rows, so the NOT NULL column is added directly with a safe
default (no backfill)"* appears verbatim in both prior ADD COLUMN migrations). That is a
deployment-state call, not a technical one, and it is the single input that flips this to B-2.

### D-1a — The copy consequence: exactly what any earnings total may claim

`sum(shift_log.earned)` is a **lower bound on what was earned, permanently and by construction** —
`appendShiftLog` (`child-profiles.ts:120-137`) never reads its insert result, so a shift can pay the
wallet and lose its log row with nothing noticing; and pre-migration rows are `null`. Three binding
consequences:

1. **F4 itself ships no earnings figure at all.** The growth screen shows no cumulative or weekly
   zł total. `wallet_balance` (authoritative, already in the HUD) is the only money on that screen.
   This keeps the lower-bound problem entirely inside F1's tile.
2. **The wording, when F1 ships it, is `"Zarobione w tym tygodniu"`** — a description of *logged
   activity in a window*. It may **not** be labelled `suma`, `bilans`, `łącznie`, `razem`, or
   `wszystkie zarobki`; it may **not** be placed adjacent to, compared with, or presented as
   reconciling against the wallet balance. It claims: *"this is what the shifts we recorded this
   week added up to."* It does not claim: *"this is everything the child earned."*
3. **No test may assert `wallet_balance == sum(earned)`.** Such a test is flaky by construction.
   The only earnings assertions permitted are per-row: a single completed shift's row equals
   `5*taskCount + 3*cleanCount`.

Plus the transitional rule for F1: **suppress the tile entirely while any *shift* row in the
displayed window has `earned is null`** — do not render `0`, do not render a placeholder.

> **The predicate is scoped to shift rows, and that scoping is load-bearing** (plan review, F1).
> A purchase row is `earned: null` **by design and forever** (D-1: `buyUpgrade` never passes
> `earned`, and `null` is what makes "not a shift" distinguishable from "earned nothing"). A
> predicate of the naive form *"any row in the window has `earned == null`"* therefore suppresses the
> tile in **every week in which the child buys a single upgrade** — permanently, not transitionally.
> The correct predicate is:
>
> ```ts
> const hasUnknownEarnings = rows.some((r) => r.upgrade_purchased === null && r.earned == null);
> ```
>
> i.e. *an unknown is a **shift** row with no recorded payout* — which only a pre-migration row can
> be. `upgrade_purchased` is already in the query's column list, so this costs nothing. The two row
> kinds never overlap: `recordShiftResult` calls `appendShiftLog` without `upgradePurchased`
> (`child-profiles.ts:187`) and `buyUpgrade` always with it (`:257-262`).
>
> **Corrected self-healing claim.** The window is the current Mon–Sun week, so a pre-migration shift
> row can only fall inside it during the week the migration runs. From the first Monday after the
> migration the tile renders unconditionally. **"Self-heals by the start of the first full week after
> the migration"** — the old wording ("within seven days") was true only under a predicate that also
> never fires on purchases.
>
> **A week with no shift rows renders `0`, and that is honest**, not a lie: `statTasks` already
> renders `0` for the same week, and the claim is "this is what the shifts we recorded this week
> added up to" — of which there were none. Suppression is reserved for *unknown*, never for *zero*.

Strictly honest, and consistent with how F1 was already told to handle the tile's absence.

**Reverses if:** `appendShiftLog` is given real error handling and the shift becomes transactional
with its log row — then `sum(earned)` becomes exact for post-migration rows and the wording could
tighten. That is a separate change.

### D-2 — Uncapped levels: saturate at `stageForLevel`, never cap the formula ✅

`businessLevelForShifts` is untouched. `STAGES` entries carry `requiredLevel: 1|2|3|4`;
`stageForLevel(level)` is total and non-throwing and returns the **highest stage whose
`requiredLevel` is met**, saturating at the last one — exactly `skillProgress`'s `atMax` shape
(`src/data/skills.ts:103-110`).

Rejected: capping the formula — `recordShiftResult:189` returns
`leveledUp: businessLevel > current.business_level`, so a cap makes `leveledUp` permanently `false`
and kills "Twój sklep rośnie!" forever; the level also feeds `canBuy`'s gate, so capping is a
gameplay change disguised as a display change. Rejected: keying stages off
`completed_shift_count` — a second ladder that drifts from `SHIFTS_PER_LEVEL`. Rejected: a DB
thresholds table — no precedent; every catalogue in `src/data/` is static.

**The monotonicity test that locks it** (Phase 2, `tests/stages.test.ts`, spelled out so it cannot be
weakened into a comment):

```
const idx = (n) => STAGES.indexOf(stageForLevel(businessLevelForShifts(n)).stage);
for n in 0..60:
  idx(n) >= idx(n-1)                                    // monotonic non-decreasing
  stageForLevel(businessLevelForShifts(n)).atMax === (idx(n) === STAGES.length - 1)
idx(0) === 0                                            // a fresh profile starts at stage 1
new Set(range(0,60).map(idx)).size === STAGES.length    // every stage is reachable by the formula
stageForLevel(999).stage === STAGES.at(-1) && .atMax    // saturates, never overruns
STAGES.map(s => s.requiredLevel) is strictly increasing and starts at 1
stageForLevel(0 | -5 | NaN | 1.5 | Infinity) === STAGES[0] and never throws
```

**What a child at level 50 sees.** Shell badge: "Poziom sklepu 50". Growth screen: all four stages
rendered, stage 4 "Popyt i zysk" marked current (blue ring + "Aktualnie" chip), **no fifth locked
node**, **no next-stage progress bar**, and the caption *"To najwyższy etap — Twój sklep działa
pełną parą."* The dashboard stat tile still shows `50`. Every third shift still fires
`t.results.levelUp` ("Twój sklep rośnie!") — see D-2a.

**Reverses if:** a fifth stage is added; then only `STAGES` and `pl.ts` change, and the test above
re-verifies reachability automatically.

### D-2a — `t.results.levelUp` keeps firing past the terminal stage ✅

**Decision: do not gate the celebration on a stage change.** The level genuinely did rise;
`leveledUp` is a server-computed fact about `business_level`, and `ShiftResults.tsx:63` renders a
level-agnostic phrase. Gating it would thread stage state through the API response and the island for
a copy nuance, and would make the celebration stop *forever* — the same permanent-silence failure
mode that makes capping wrong. The honest counter-statement lives on the growth screen instead:
`t.growth.maxStage` tells the child, in one line, that they have reached the top stage.

Rejected: adding `stageChanged` to the `/api/shifts/complete` response and gating on it — more
surface, and it removes a positive signal from a 6–9-year-old for an abstraction they never see.

**Reverses if:** kid-testing shows the celebration reads as a lie once the rail stops moving. The fix
is then a one-line gate in `ShiftResults.tsx` over a new `stageChanged` boolean in the API response —
a presentation change, no data-model impact.

### D-3 — Artwork: **ART-C**, in its zero-new-asset variant ✅ (deliberate mockup deviation)

**No per-stage illustration ships.** Stage state is rendered with the **lucide `Check` / `Lock`
icons and the app's own design tokens** (`bg-success` / `bg-primary` / `bg-muted`) — the exact visual
language the existing milestone path already uses at `start.astro:111-133`. The screen's single hero
is the profile's own shop via `ShopArt` (`world-<slug>.webp` + owned upgrade icons). The connector
line is built in code, per the asset pack's own README rule.

**This is a deliberate deviation from the binding mockup, forced by missing assets.** Recorded here
so a maintainer can supply art later without re-litigating the design:

> The web mockup shows a colour thumbnail per stage and the mobile mockup shows a small stage
> thumbnail in each card. **Per-stage world artwork exists for zero of the four worlds.**
> `assets/atomic-assets-v3/png/illustrations/world-progression-cafe.png` is a single 1536×1024
> composite of three stages side by side with a baked-in connector path — a hero illustration *about*
> progression, not three swappable images — and it is café-only, while the app ships `kawiarnia`,
> `piekarnia`, `galaktyczna-baza` and `sklep-ksiegarnia`. F4 keeps the mockup's **structure** exactly
> (numbered node rail, done/current/locked states, name + one-line description, current-stage
> emphasis, connector) and declines only the per-stage thumbnails.
>
> **The upgrade path** is `research.md` option ART-A: four crops per world into
> `public/illustrations/stage-<world>-<stageId>.webp`, an optional `art` field on the `Stage`
> interface, and `ShopArt`'s base `src` at `:42` becoming `stage.art ?? world.image`. No code written
> here depends on the absence of stage art.

Rejected: **ART-A now** (crop 4 thumbnails from the web mockup) — the art is café furniture and would
be shown to a child in the bakery, the space base and the bookshop. Rendering the wrong world's shop
is the visual equivalent of the invented-metric problem this run already fixed once. Rejected:
**ART-B** (crop 3 podiums out of the café composite) — three of four stages, still café-only.
Rejected: **ART-D** (café-only stages) — three worlds get a broken screen.

Rejected within ART-C: **copying `progress-node-{done,active,locked}.svg`** into `public/`. They carry
hardcoded hex fills (`#39c66a`, `#1f7aec`, `#73839a`) that ignore the app's theme tokens, and the
pack's `quality-manifest.json` marks the SVG icons a `production-candidate-draft` whose "stroke
widths and color tokens" may still change. lucide + tokens is theme-correct, already in the codebase,
and needs no `slice-map.md` row.

**Consequence: F4 adds zero files to `public/illustrations/` and zero rows to
`public/illustrations/slice-map.md`.** If any future phase of this change does ship a crop, it goes to
`public/illustrations/` and gets a `slice-map.md` row naming the source file and the crop box
`(x0, y0, x1, y1)` — because `assets/` is gitignored and invisible to CI and Vercel.

**Reverses if:** per-world per-stage art is produced. Then add `art?: string` to `Stage`, ship the
crops + slice-map rows, and flip `ShopArt:42` to `stage.art ?? world.image`.

**Two further mockup deviations, same cause, recorded together:**

- **Stage 3's mockup name is "Kawiarnia z ofertą" — shipped as "Sklep z ofertą"** (id `oferta`).
  A café-specific stage *name* is the same defect as café-specific stage art: it would tell a child
  in the bakery that their shop is now a café. World-neutral naming keeps one catalogue correct in
  all four worlds. Reverses if per-world stage catalogues are introduced.
- **Stage 4's mockup description "Odblokuj misje z popytem" — shipped as "Twój sklep działa pełną
  parą."** Demand missions do not exist; promising an unlock that is not implemented is worse than
  flavour text. Reverses when a demand-mission type ships.
- **The page heading is "Rozwój sklepu", not the mockup's "Rozwój kawiarni".** Polish genitive
  declension differs per world (*kawiarnia → kawiarni*, *galaktyczna baza → galaktycznej bazy*), and
  `src/data/worlds.ts` stores nominative names only. `upgrades.astro` already solves this exact
  problem with `heading={t.upgradeShop.title}` + `subtitle={world.name}`; F4 copies it. The
  **sidebar label stays the mockup's "Rozwój świata"** verbatim.

### D-4 — Route `/app/growth`, `active` key `growth` — F5 collision avoided ✅

`/app/worlds` and the `worlds` key in the `AppShell` `active` union belong to **F5**
(`context/changes/world-selection-screen/`), planned in parallel. F4 takes **`/app/growth`** with
`active="growth"` and the label `t.nav.items.growth = "Rozwój świata"`. Rejected: `/app/progress`
— "postępy" reads as skill progress, which is a different (existing) surface; and the mobile mockup's
own tab bar uses "Postępy" for something else. Rejected: a section of `start.astro` — the mockup shows
a dedicated screen with its own active sidebar entry, and folding it in would either duplicate the
shell heading or break the one-`h1`-per-page rule.

**Accessible-name check (done, pre-registered for re-verification in Phase 4):** "Rozwój świata"
matches nothing under `t.nav.items.*` (`Pulpit`, `Misje`, `Mój sklep`, `Panel rodzica`),
`t.start.*` (notably `upgradesLink = "Rozbuduj sklep"`), `t.report.*` or `t.picker.*`, in either
direction — `getByRole` name matching is substring-based, so containment matters both ways. The new
CTA is deliberately `t.growth.upgradesLink = "Zobacz ulepszenia"` rather than reusing
`t.start.upgradesLink`, so `e2e/gameplay-restore.spec.ts:55` cannot become ambiguous.

**Reverses if:** F5 lands first and takes a name that collides; then rename `t.nav.items.growth`
only — the route and the `active` key are independent of the label.

### D-5 — `ShopArt.tsx`: F4 is the owner and deliberately changes nothing structural ✅

F4 owns `src/components/**/ShopArt.tsx`. F5 has been told to keep its changes there to `WORLD_SLOTS`
coordinates only. **F4's decision: no API change, no restructure.** The growth screen becomes
`ShopArt`'s **third call site** (`start.astro:107`, `UpgradeShop.tsx:234`, now `growth.astro`) with
the existing `{ world, purchased }` props. The only edit is **two lines added to the component's
doc-comment** naming the base-`src` expression at `:42` as the documented per-stage-art seam and
pointing at `src/data/stages.ts`.

Rejected: adding a `stage` prop now — speculative generality with no art to back it; the base scene
and the upgrade layer are already orthogonal (the upgrade layer never reads `world.image`; the base
never reads `purchased`), so the seam costs nothing to open later.

**Boundary note for the implementer — read before rebasing.** F4 touches only the top doc-comment;
F5 touches only `WORLD_SLOTS` at `:26`. These are different regions and git merges them cleanly. If a
conflict does appear in `ShopArt.tsx`, **rebase F4 onto F5 and re-apply the doc-comment by hand — do
not resolve blindly**, and do not accept any incoming change to the props interface, `DEFAULT_SLOTS`,
or the base `<img>` at `:42` without checking it against this decision.

### D-6 — Bottom bar at 6 tabs: proven to hold; assertion added ✅

The bar reaches **5 tabs with F4 and 6 if F5 also lands one**, at the `touch` project's 712px
viewport where "Panel rodzica" already truncates on narrow phones. **Checked, and it holds:**

- The bar is `flex items-stretch justify-around px-2 pt-2` (`AppShell.astro:186-190`) → 16px of
  horizontal padding. Each tab is `min-w-0 flex-1 flex-col items-center gap-1 px-1 py-1.5
  text-[0.7rem]` with a `size-6 shrink-0` icon (24px) and a `<span class="truncate">` label.
- `min-w-0` + `truncate` means the label never contributes intrinsic width. A tab's minimum is
  `24px (icon) + 8px (px-1) = 32px`. Six tabs = **192px + 16px = 208px minimum**. There is no
  horizontal overflow at any viewport ≥ 208px — 504px of slack at 712px, 112px at 320px.
- At **712px** each of 6 tabs gets `(712 − 16) / 6 = 116px`, ~108px for the label. "Panel rodzica"
  at `0.7rem` bold ≈ 80–85px → **fits without truncating**. Truncation only begins around 360px.
- **Truncation is `text-overflow: ellipsis`, which does not change the accessible name.**
  `getByRole("link", { name })` keeps resolving at every viewport, at 5 or 6 tabs.

**Therefore: no accommodation is planned, and no existing tab is renamed.** Rejected: adopting the
mobile mockup's shortened five-label bar (Pulpit · Misje · Sklep · Postępy · Więcej) — renaming
existing tabs is a cross-feature change that would break F5's and F2's locators, and the arithmetic
above says it is unnecessary.

**But the proof is arithmetic, so Phase 4 backs it with a real browser.** `e2e/growth.spec.ts` runs in
**both** Playwright projects and asserts all bottom-bar links are visible with their full accessible
names at 712px. This protects F5's sixth tab too. Phase 4 widens `playwright.config.ts:52`
`testMatch: /gameplay-restore\.spec\.ts/` → `/(gameplay-restore|growth)\.spec\.ts/`; **F5 should
extend the same alternation rather than replacing it.**

**Reverses if:** the browser check shows wrapping or overflow at 712px, or a seventh entry is
proposed. The planned accommodation, in order of preference: (1) shorten only the *new* label; (2)
`overflow-x-auto` on the bar; (3) collapse to a "Więcej" overflow entry — a shared-component change
that needs its own change folder.

### D-7 — Scope split: F4 ships the column; the tile goes to **F1** ✅

**F1 is planned, not absent** (corrected by the plan review — the sentence here previously said F1
"holds only `change.md` (`status: new`)… no research, no plan", which was already stale when written).
As of 2026-08-23 `context/changes/parent-weekly-activity-chart/` holds `change.md`
(**`status: planned`**), `research.md`, `plan-brief.md`, a **complete six-phase `plan.md`** and an
empty `reviews/`. F1 is *ahead* of F4 and its plan edits **every region F4's hand-off recipe names**:
Phase 1 §2 changes `ShiftLogRow` and the `.select()`, Phase 1 §4 adds a third parameter to
`aggregateWeeklyReport`, Phase 3 rewrites the stale `pl.ts` comment, and Phase 5 rewrites the tile
grid. Two concurrent features editing the same grid is an avoidable conflict, and the tile is F1's
mockup. **The recipe below is therefore written against the post-F1 file, with the pre-F1 fallback
noted per row.**

Rejected: F4 ships the tile too — the conflict above, plus it would put parent-facing money copy
inside a change whose review surface is a child screen and a migration.

**Reverses if:** F1 is cancelled or deferred past this run. The recipe below is then a self-contained
follow-up change; nothing in F4 needs revisiting.

The hand-off is written out concretely in **Handed to F1** below, and Phase 1 appends a pointer to
F1's handoff so the work cannot get lost.

### D-8 — Per-panel verdict on the mockup (the no-invented-data discipline)

Every panel in the binding mockups, with an explicit ships / reduced / omitted verdict:

| Mockup panel | Verdict | Source or reason |
| --- | --- | --- |
| Stage rail: 4 named stages, done/current/locked, connector | **Ships** | `STAGES` + `business_level` |
| Per-stage thumbnails | **Omitted** | No per-stage art for any world — D-3 |
| Stage one-line descriptions (mobile) | **Ships** | `t.stages.<id>.desc`; used at both breakpoints |
| Page heading "Rozwój kawiarni" | **Ships reduced** | "Rozwój sklepu" + `subtitle={world.name}` — D-3 |
| Hero illustration of the shop | **Ships** | `ShopArt` — the child's own world + owned upgrades |
| Coin pill "126 zł" | **Ships** | `AppShell` `WalletPill`, free |
| Metric strip item "Aktualny poziom 3" | **Ships** | `t.start.levelLabel` + `business_level` |
| Metric strip "Zysk dzienny +28 zł" | **Omitted** | No per-day earnings model; the new column is per-shift, not per-day-of-operation, and pre-migration rows are `null` |
| Metric strip "Klienci dziennie 11" | **Omitted** | Customers are not modelled (the `customers` upgrade grants `extraTasks`, not a customer count) |
| Metric strip "Zadowolenie 92%" | **Omitted** | Satisfaction is not modelled |
| Header XP bar "120 / 200 XP" | **Omitted** | No XP concept exists anywhere in the app |
| "Odblokowane w tym poziomie" / "Co odblokujesz?" | **Ships reduced** | `UPGRADES.filter(u => u.requiredWorldLevel === stage.requiredLevel)` + `upgradeCopy(id)`. The mockup's effect strings ("+15% do zysku", "Wyższa marża") are **not** rendered — they are unmodelled numbers; the catalogue's own `desc` is used instead |
| "Następne ulepszenie" card + cost + "40 / 80 zł" bar + requirements | **Ships** | `nextUpgrade` / `canBuy` / `wallet_balance` — pure reuse of what `start.astro:43-62` already computes |
| "Zobacz ulepszenia" CTA | **Ships** | Links to `/app/upgrades`, which exists |
| "Następne kroki" checklist + counters (0/1, 11/15, 126/150) | **Omitted** | No goals/quests system; "Zarób 150 zł" needs cumulative earnings, which even the new column only provides from the migration forward |
| "Wskazówka" tip card | **Ships** | A static Polish statement of how the mechanic works, not a measurement — the `t.start.safetyBody` precedent |
| "Moje osiągnięcia" button, notification bell + badge | **Omitted** | No achievements or notifications system; no dead navigation |

**Reverses if:** any of these systems is built. Each omission is a filter on data availability, not a
design objection.

### D-10 — F4 ships the earnings tile itself, because F1 already landed ✅ *(added at implementation time)*

D-7 handed the parent weekly earnings tile to F1 to avoid two concurrent features editing one grid.
By the time F4 was implemented that premise was gone: **F1 is implemented, reviewed and merged**, and
`feat/world-progression-stages` is cut from `feat/parent-weekly-activity-chart`. The recipe therefore
had no remaining owner, and leaving it unimplemented would have shipped a migration whose only reader
does not exist — the column would be written and never read.

**Decision: F4 implements the recipe, in its post-F1 form.** The conflict D-7 was avoiding is
structurally impossible now (the grid is in F4's own base), and the three post-F1 corrections the plan
review identified are applied exactly: the tile is the **fourth**, the grid is conditional
(`grid-cols-2 lg:grid-cols-4` with the tile, F1's `grid-cols-2 sm:grid-cols-3` without it, so neither
state leaves an orphan), and the `pl.ts` comment — which F1 rewrote to claim "`shift_log` has no
earnings column" — is rewritten a **second** time, because F4's migration makes that claim false.

Rejected: **leaving it for a follow-up change** — it would ship a write-only column and leave the
plan's own end state ("what makes 'ile zarobiłem w tym tygodniu' a real number") undelivered, while
the recipe is ~20 lines that F4's own migration is the prerequisite for. Rejected: **re-opening F1's
change folder** — F1 is closed and reviewed; a new tile belongs to the change that created the column.

**Reverses if:** the maintainer wants the tile reviewed under F1's change id instead. The code is
identical either way; only the commit's change-id prefix would move.

### D-11 — `E2E_PORT`: the e2e suite no longer silently tests another checkout ✅ *(added at implementation time)*

`playwright.config.ts` hardcoded `http://localhost:4321` and sets `reuseExistingServer: !CI`. A dev
server was running on 4321 from **another agent's git worktree**, so `npx playwright test` in this
checkout was about to exercise *that tree's* code and report it as this branch's baseline — a green
that means nothing. `e2e/global-setup.ts` hardcoded the same URL.

**Decision: make the port overridable** — `const PORT = process.env.E2E_PORT ?? "4321"` in both files,
and `command: \`npm run dev -- --port ${PORT}\``. Default behaviour is byte-for-byte unchanged; the
baseline and every subsequent run in this step used `E2E_PORT=4327`.

Rejected: **killing the other agent's dev server** — it is not this step's to kill. Rejected:
**running against 4321 anyway** — the numbers would have been fiction. Rejected: **an uncommitted local
edit** — it would either be lost or committed by accident, and the next agent would rediscover the trap.

**Reverses if:** the project adopts a different e2e harness. Note for F5: this is a two-line change in
a region neither F5 nor F1 touches.

### D-9 — Migration RLS verdict: recorded, not re-opened

**No new policy, no policy edit.** The four `shift_log` policies are column-agnostic, so a new column
needs nothing extra. This is a recorded verdict with evidence, not an open question:

1. All four policies (`20260701150000_create_shift_log.sql:38-63`) are `auth.uid() = account_id` —
   SELECT `using`, INSERT `with check`, UPDATE `using` + `with check`, DELETE `using`. None names a
   column list or references `skills` / `upgrade_purchased`. A predicate that mentions no columns
   cannot be changed by adding one.
2. Postgres RLS is row-level. The only column-granular control is `GRANT (column)`, and
   `grep -rniE "grant|revoke" supabase/migrations/` finds **no column-level grant anywhere in the
   project** — the sole `grant` is `grant execute on function public.register_pin_failure(...) to
   authenticated` (`20260702120000_pin_failure_throttle_rpc.sql:33`). Table privileges come from
   Supabase's table-level defaults, which a new column inherits.
3. Two in-repo precedents did exactly this and said so —
   `20260630120000_child_profiles_add_gameplay_state.sql:9-12` and
   `20260701140000_child_profiles_add_skill_state.sql:5-8` (*"…cover ALL columns … so NO policy
   change is needed here (column-agnostic — L-001)"*).

L-001's spirit is "prove you thought about it in the file", so the migration still carries a header
comment naming the four covering policies and stating why none was added.
**Reverses if:** a future migration introduces column-level grants on `shift_log` — then every
additive column needs a grant review.

---

## Handed to F1 — the parent weekly earnings tile

**Owner: `context/changes/parent-weekly-activity-chart/` (feature F1).** F4 ships
`shift_log.earned`; F1 ships the tile. This recipe is complete — an F1 implementer needs nothing from
F4 beyond a landed Phase 1.

**Prerequisites:** F4 Phase 1 merged (the column exists and post-migration shifts populate it), **and
F1's own Phase 1 + Phase 3 + Phase 5 merged** — this recipe is an increment on top of them.

**Anchor on symbols, never on the line numbers below.** Every number here was re-measured on
2026-08-23 against `feat/dashboard-recent-activity` with F2's `listRecentActivity` in the tree, and
**each one moves again when F1 Phase 1 lands** (it inserts `weekDayKeys` after `startOfWeek` and a
bucketing helper after `aggregateWeeklyReport`). Locate each edit by the symbol or the quoted string,
then apply it. Numbers are orientation, not addresses.

**~18 lines across 4 files, zero call-site churn. `src/pages/app/report.astro` needs no edit.**

| # | Anchor (symbol / string) | Change | ~Lines |
| --- | --- | --- | --- |
| 1 | `src/lib/services/reports.ts` → `export interface ShiftLogRow` (today `:13-16`) | add `earned?: number \| null;` — **must be optional**, or `tests/reports.test.ts`'s `row()` helper (today `:13-15`) stops compiling. F1 Phase 1 §2 makes `created_at` **required** in the same interface; `earned` stays optional regardless | +1 |
| 2 | same file → `getWeeklyReport`, the `.select(...)` string (today `:109`) | **post-F1** (F1 Phase 1 §2 has already changed it to `"created_at, skills, upgrade_purchased"`): → `.select("created_at, skills, upgrade_purchased, earned")`. **Pre-F1 fallback:** `"skills, upgrade_purchased"` → `+ ", earned"`. It is an **explicit column list**, so the column is invisible until added here. Do not use the old find-string post-F1 — it will not match | 1 modified |
| 3 | same file → `export function aggregateWeeklyReport` (today `:37-47`) | in the existing `for (const row of rows)` loop, accumulate `earned += row.earned ?? 0` **and** `hasUnknownEarnings ||= row.upgrade_purchased === null && row.earned == null`; return both. **The `upgrade_purchased === null` half is mandatory — see D-1a.** Post-F1 the signature is `(profileId, rows, now = new Date())` and the same loop also buckets `daily`; add to that loop, do not open a second pass | +4 |
| 4 | `src/types.ts` → `interface WeeklyReport` (today `:146-150`) | add `earned: number;` and `earningsKnown: boolean;`. Consumed by property access only (`WeeklyReport.tsx` partial-destructures `child.report`) and there is no exact-object assertion anywhere in `tests/`, so widening it is invisible. Post-F1 the same interface already carries `daily: WeeklyReportDay[]` | +2 |
| 5 | `src/components/parent/WeeklyReport.tsx` → the `<ul className="mt-5 grid grid-cols-2 gap-3">` inside `ChildSection` (today `:139`) | **This tile is the FOURTH, not the third.** F1 Phase 5 has already changed this `<ul>` to `grid-cols-2 sm:grid-cols-3` and inserted a `statFirstTry` tile, giving `statTasks → statFirstTry → statUpgrades`. Append `statEarned` **last** and make the column count conditional so no state leaves an orphan tile: `className={cn("mt-5 grid gap-3", earningsKnown ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 sm:grid-cols-3")}` (`cn` from `@/lib/utils` — house rule). Rationale in **the tile-grid note** below | +7 |
| 6 | `src/i18n/pl.ts` → the `statTasks` / `statUpgrades` pair inside `report:` (today **`:415-416`**, *not* `~:396` — `:396` is `title: "Panel rodzica"`) | add `statEarned: "Zarobione w tym tygodniu"` beside them, and **rewrite the comment immediately above them (today `:411-414`, *not* `:394-396`)**. That comment currently says the mockup's "correctness %, daily chart and earnings have no source yet". F1 Phase 3 §2 rewrites it to say only earnings remain deferred **"because `shift_log` has no earnings column"** — which F4's migration makes false, so **F4's tile must rewrite it a second time**: the column exists, the tile renders when `earningsKnown`, and the figure is a lower bound on logged shifts. (F1's own plan cites `:394-397` for this comment; that number is wrong too — verify against the file, not against either plan) | +1 |

**The tile-grid note (the layout decision F1's plan and this recipe both left unmade).** With F1's
`statFirstTry` tile shipped, a `sm:grid-cols-3` grid holding four tiles leaves a single orphan on a
second row at every width ≥ `sm`. The conditional class above avoids that in **both** states —
3 tiles → F1's `grid-cols-2 sm:grid-cols-3` untouched; 4 tiles → `2 × 2` up to `lg`, then one row of
four. Measured widths on the report page (`main` `max-w-6xl px-4 lg:px-8`, the island in the
`lg:col-span-2` column of a `lg:grid-cols-3` grid, card `p-6`): at `lg` the card's inner width is
≈ 661 px, so four `gap-3` columns give ≈ 156 px per tile and ≈ 124 px of text width after the tile's
own `p-4` — comfortable for `"Zarobione w tym tygodniu"` wrapping to two lines. Below `lg` the 2-up
layout gives ≥ 270 px per tile. `sm:grid-cols-4` was rejected: at exactly 640 px it yields ≈ 98 px of
text width, close to the 62.7 px case F1's own review already flagged as a legibility defect. This is
a responsive **grid** class, not the `hidden`/`lg:hidden` duplication the run contract forbids — the
accessibility tree is unchanged.

**The three binding rules that come with it** (from D-1a — they are the reason F4 did not just ship
the tile itself):

1. **Suppress, don't lie — but only for *unknown*, never for *zero*.** When `earningsKnown` is
   `false` — **a shift row** in the week's window has `earned is null` — render **no tile at all**.
   Not `0 zł`, not a placeholder, not "—". A **purchase** row is `null` forever by design and must
   **not** set the flag (D-1a): a predicate that ignores `upgrade_purchased` hides the tile in every
   week the child buys anything. Self-heals by the start of the first full week after the migration.
2. **Wording is fixed:** `"Zarobione w tym tygodniu"`. Not `suma`, `bilans`, `łącznie`, `razem`, or
   `wszystkie zarobki`. Do not place it adjacent to, or compare it with, the wallet balance. The
   number is a lower bound: `appendShiftLog` swallows its insert error, so a paid shift can lose its
   log row silently.
3. **No test may assert `wallet_balance == sum(earned)`.** It would be flaky by construction. Assert
   the aggregate against the rows the test itself inserted, nothing else.

**Suggested F1 tests** (all pure-function, `tests/reports.test.ts`, no DB):

- `aggregateWeeklyReport` sums `earned` across shift rows and treats a `null` as `0` in the sum;
- a window containing one **shift** row with `earned: null` (`upgrade_purchased: null`) sets
  `earningsKnown: false`;
- **a window of only purchase rows sets `earningsKnown: true` and `earned: 0`** — a purchase row is
  not an unknown shift. *(This inverts the assertion this section previously suggested. The old
  version would have locked in the defect the plan review caught: it asserted `false`, which is
  exactly the behaviour that hides the tile forever in any week containing a purchase.)*
- an empty window sets `earningsKnown: true` and `earned: 0` — the tile renders `0 zł`, matching
  `statTasks`, which already renders `0` for the same week.

---

## Critical Implementation Details

**Landing order across the run: F2 → F1 → F4. Rebase with eyes open** (added by the plan review — no
single plan in this run saw the whole picture).

| Feature | State on 2026-08-23 | What it does to F4's ground |
| --- | --- | --- |
| **F2** `dashboard-recent-activity` | **Landing now.** `src/data/activity.ts` + the `pl.ts` / `i18n/index.ts` copy are committed (`e40d650`); `listRecentActivity` sits **uncommitted** at `reports.ts:117-160`, and `docs/reference/contract-surfaces.md` has an **uncommitted** edit to the `## public.shift_log` section | Every line number in this plan measured before F2 is now low by 10–20 lines in `pl.ts`, `i18n/index.ts` and `start.astro`. F2 also edits the exact `contract-surfaces.md` section F4 Phase 1 edits |
| **F1** `parent-weekly-activity-chart` | `status: planned`, six-phase plan, not started | Restructures `aggregateWeeklyReport`, `ShiftLogRow`, the `.select()`, the `pl.ts` `report` comment and the `WeeklyReport.tsx` tile grid — i.e. every anchor in **Handed to F1** |
| **F5** `world-selection-screen` | `status: planned` | `/app/worlds`, `active="worlds"`, `t.nav.items.worlds = "Światy"`, `ShopArt` `WORLD_SLOTS` only — see D-4/D-5/D-6 |

**F4's own four phases touch none of `reports.ts`, `WeeklyReport.tsx` or `src/types.ts`** — the
contention is entirely inside the **Handed to F1** recipe, which is why that recipe (not the phases)
carries the post-F1 corrections. F4's *phases* contend with F2 only, on three append-only regions
(`src/i18n/pl.ts`, `src/i18n/index.ts`, `tests/i18n-helpers.test.ts`) plus one adjacent-line region
(`docs/reference/contract-surfaces.md` → `## public.shift_log`: F2 rewrites the **Consumed by** and
**Isolation test** bullets, F4 edits the **Defined in** and **Columns** bullets four lines above —
re-read the section before editing; do not paste over F2's bullets).

**Anchor every edit on a symbol or a quoted string, not on a line number.** The numbers in this plan
were measured on 2026-08-22 and re-verified on 2026-08-23; the ones already known to have drifted:
`upgradeCopy` is at `src/i18n/index.ts:52` (plan text says `:29-35`); the `upgrades` copy record is at
`src/i18n/pl.ts:285` (plan text says `:266-275`); `start.astro`'s milestone path renders around `:129`
(plan text says `:111-133`) and its savings computation is at `:71-80` (plan text says `:56-62`);
`readLogRows` is at `tests/shifts-complete.test.ts:90-97`. The **symbol names in every reference are
correct** — only the numbers rot.

**Ordering.** Phase 1's migration must land before anything reads `earned`. Phase 3 widens the
`AppShell` `active` union (needed for `growth.astro` to typecheck) but does **not** add the nav item;
Phase 4 adds the item. After Phase 3 the route exists and is auth-gated but is unlinked — that is the
correct direction of the no-dead-navigation rule (a screen may exist without a link; a link may never
exist without a screen).

**Migration timestamp.** The newest existing migration is `20260702120000_pin_failure_throttle_rpc.sql`.
Use `20260822120000_shift_log_add_earned.sql`.

**`src/data/` purity.** `src/data/stages.ts` may import only types and sibling `src/data/*` modules —
no React, no Astro, no Supabase. It imports `src/data/upgrades.ts` (for `unlocksForStage`), which is
itself pure. This is what lets the same module serve a server-rendered page and, later, an island.

**Stage rail structure.** Build **one** component whose base is the mobile card list (it carries
strictly more information — name *and* description) and which switches to a horizontal rail at `lg`
with utility classes. One accessibility tree, matching the `AppShell` doctrine of "rendered once,
toggled with `display`". Do **not** render a mobile copy and a desktop copy. The connector line is
built in code (the asset pack's README says so explicitly), never exported as an image.

**Terminal-stage rendering.** When `atMax`, the rail must not render a phantom locked node after the
last stage and must not render a next-stage progress bar that can never fill. Render
`t.growth.maxStage` instead.

---

## Phase 1: `shift_log.earned` — migration, write path, registry

### Overview

Persist the already-computed per-shift payout. Server-only; no UI, no user-visible change. This is
the irreversible piece, so it lands alone.

### Changes Required

#### 1. The migration

**File**: `supabase/migrations/20260822120000_shift_log_add_earned.sql` (new)

**Intent**: Add a nullable, non-negative integer column recording what a shift paid, so the weekly
window has a real number instead of a reconstruction. No backfill (D-1).

**Contract**: `alter table public.shift_log add column earned integer null;` plus a **named**
constraint — `add constraint shift_log_earned_nonneg check (earned is null or earned >= 0)` — in a
second `alter table` statement, exactly as the `child_profiles_*_nonneg` precedents do
(`20260630120000:26-29`): the precedent names every check, and an anonymous inline check gets a
Postgres-generated name that nothing can reference in a later migration or in the rollback line.
Then a `comment on column`, and a header comment in the house style of
`20260701140000_child_profiles_add_skill_state.sql`. The header must state, in prose: (a) the four
covering `shift_log` policies are account-scoped and column-agnostic, so **no policy change is needed
(L-001)**; (b) the column is **nullable with no backfill** because reconstruction from
`shift_log.skills` yields only a lower bound (`complete.ts:56-57` validates with `<=`, not `=`) and
`null` is the only honest value for a pre-migration row and for a purchase row; (c) a
`-- Rollback: alter table public.shift_log drop column earned;` line. Type is `integer` — all currency
in this app is integer zł; never `numeric`, never `money`. **No index** — `earned` is projected and
aggregated, never a predicate, and the weekly query already rides `shift_log_profile_created_idx`.

#### 2. The write path

**File**: `src/lib/services/child-profiles.ts`

**Intent**: Stop discarding `earned`. It is computed at `:170`, spent at `:178`, returned at `:189`,
and dropped at `:187`.

**Contract**: three edits, ~4 lines, all in this file:

- `:129` — widen `appendShiftLog`'s `entry` parameter with `earned?: number`. **Optional**, so the
  purchase path is unaffected and no other caller changes.
- `:131-136` — add `earned: entry.earned ?? null` to the insert object.
- `:187` — `await appendShiftLog(client, { accountId: current.account_id, profileId, skills: shift.skills, earned });`
  The local `earned` is declared 17 lines above, in the same block, unshadowed.
- `:257-262` (`buyUpgrade`, the sibling caller) — **leave unchanged**. A purchase is not a shift; the
  omitted key makes the row `earned: null`, which correctly reads as "not a shift" (D-1).

Also update `appendShiftLog`'s doc comment to note that `earned` is the server-computed payout and is
`null` for purchase events. **Do not** add error handling — see "What We're NOT Doing".

**No type regeneration.** There is no generated `database.types.ts` in the repo, no
`supabase gen types` script, and `createServerClient` is called without a `<Database>` generic
(`src/lib/supabase.ts:25`). **No API, route or client edit** — `/api/shifts/complete` already returns
`earned` (`:93`) and its zod schema deliberately has no `earned` field (the client never supplies an
amount).

#### 3. The contract registry

**File**: `docs/reference/contract-surfaces.md` (the `## public.shift_log` **Columns:** bullet, ~`:31`)

**Intent**: Keep the registry that enumerates `shift_log`'s columns accurate — an L-001 obligation.

**Contract**: add `earned integer null (the server-computed payout for a shift; null for a purchase
event and for pre-migration rows — no backfill)` to the Columns bullet, and add the new migration
filename beside the "Defined in" line.

#### 4. Tests

**File**: `tests/shifts-complete.test.ts`

**Intent**: Assert the payout actually persists — this is the only place with real sessions plus
service-role read-back.

**Contract**: extend `readLogRows`'s explicit select (`:89-97`) to
`.select("skills, upgrade_purchased, earned")` and widen its `overrideTypes` shape with
`earned: number | null`. Extend the existing test at `:223` to assert
`rows[0].earned === 5 * taskCount + 3 * cleanCount` for its `taskCount: 4, cleanCount: 3` fixture
(= `29`). **Do not** assert against `wallet_balance` (D-1a rule 3).

**File**: `tests/upgrades-buy.test.ts`

**Intent**: Pin that a purchase row records `null`, not `0` — the distinction D-1 rests on.

**Contract**: one new test reading the purchase's `shift_log` row via the admin client and asserting
`earned` is `null` while `upgrade_purchased` is the bought id.

**File**: `tests/shift-log-isolation.test.ts`

**Intent**: Keep the isolation contract covering the whole row.

**Contract**: add `earned: number | null` to the local `interface ShiftLogRow` (`:21-28`). The insert
at `:55` stays as-is — it must keep proving that a nullable column with no default does not break an
insert that omits it.

**Untouched and expected to pass:** `tests/report-isolation.test.ts:43`,
`tests/account-deletion.test.ts:46`, `tests/profile-deletion.test.ts:53` all insert `shift_log` rows
without `earned`. A nullable column keeps them green; this is the constraint that rules out
`not null` with no default.

### Success Criteria

#### Automated Verification

- Local Supabase stack is up and the migration applies cleanly: `npx supabase db reset` (or
  `npx supabase migration up`) with no error
- `npm run lint` is clean
- `npm test` is green and the total is **≥ `U₀ + 2`** (this phase adds exactly two tests)
- The new `tests/shifts-complete.test.ts` assertion proves `earned` equals `5*taskCount + 3*cleanCount`
- The new `tests/upgrades-buy.test.ts` assertion proves a purchase row's `earned` is `null`
- `npx playwright test` is green and the total is **≥ `E₀`, unchanged** (this phase changes no UI)

#### Manual Verification

- In Supabase Studio (`http://localhost:54323`), `shift_log` shows the `earned` column, and a row
  inserted before the migration (or by one of the four insert-without-earned tests) reads `null` —
  not `0`
- The migration header names the four covering policies and states why none was added

**Implementation Note**: After completing this phase and all automated verification passes, pause for
manual confirmation before proceeding. Also append a pointer to
`context/changes/parent-weekly-activity-chart/handoff.md` — three lines naming
`shift_log.earned`, this plan's **Handed to F1** section, and the suppress-on-null rule. Keep it to a
pointer; F1 is being edited concurrently, so a small append is the conflict-tolerant shape.

---

## Phase 2: The stage catalogue and its copy

### Overview

Pure data and copy. No UI. Every ladder invariant is locked here, before anything renders.

### Changes Required

#### 1. The catalogue

**File**: `src/data/stages.ts` (new)

**Intent**: Give `business_level` a name. Four named stages keyed on `business_level` so they cannot
drift from `SHIFTS_PER_LEVEL`, with a total, saturating resolver.

**Contract**: house style copied from `src/data/upgrades.ts:15-41, 107-113` — an exported `interface
Stage { id: string; requiredLevel: number; order: number }`, then
`export const STAGES: readonly Stage[] = [...] as const;` (annotate-then-`as const`; there is no
`satisfies` anywhere in `src/data/`), a `STAGE_IDS` tuple built as
`STAGES.map(s => s.id) as [string, ...string[]]`, and a `Map`-backed `getStage(id): Stage | undefined`.
**No `nameKey` field** — `Upgrade.nameKey` (`upgrades.ts:20`) is dead (`upgradeCopy` keys off `id`);
do not imitate it. No Polish literals in this file (L-003).

The four entries:

| order | id | `requiredLevel` | Reached after | Name (in `pl.ts`) |
| --- | --- | --- | --- | --- |
| 1 | `stolik` | 1 | 0 shifts | Mały stolik |
| 2 | `stoisko` | 2 | 3 shifts | Stoisko |
| 3 | `oferta` | 3 | 6 shifts | Sklep z ofertą |
| 4 | `popyt` | 4 | 9 shifts — **terminal** | Popyt i zysk |

Plus two exported functions:

- `stageForLevel(level: number): StageProgress` where
  `interface StageProgress { stage: Stage; index: number; atMax: boolean }` — mirroring
  `skillProgress`'s `{ level, fraction, atMax }` shape (`src/data/skills.ts:96-110`). Returns the
  highest stage whose `requiredLevel <= level`, **total and non-throwing**: a level below the first
  threshold, `NaN`, a non-integer or a negative resolves to `STAGES[0]`; a level at or above the last
  threshold resolves to the last stage with `atMax: true`. This is what makes level 50 render (D-2).
- `unlocksForStage(stage: Stage): readonly Upgrade[]` — `UPGRADES.filter(u => u.requiredWorldLevel ===
  stage.requiredLevel)`, so what a stage unlocks has **one** source of truth (the upgrade catalogue),
  never a second hand-maintained list. Returns `[]` for `popyt`, since nothing gates on level 4.

The file's header doc comment must name the slice (F4), state the module is dependency-free and
client-safe (mirroring `upgrades.ts`), mark the thresholds "first-guess — adjust after kid-testing",
and state explicitly that **thresholds are expressed in the `business_level` domain so
`SHIFTS_PER_LEVEL` remains the single tuning knob**, with a pointer to the monotonicity test.

**It must also carry the art deviation in three lines** (plan review — D-3 otherwise lives only in a
plan document that gets archived, and the `ShopArt` doc comment records the *render* seam, not the
*catalogue* seam): per-stage world artwork exists for **zero** of the four worlds, so `Stage` has no
`art` field today; the upgrade path is to add `art?: string` here, ship
`public/illustrations/stage-<world>-<stageId>.webp` crops with `slice-map.md` rows, and flip
`ShopArt`'s base `src` to `stage.art ?? world.image`. Same three lines note that stage 3's and stage
4's names/descriptions deviate from the mockup deliberately (world-neutral naming; no demand
missions), so a future editor does not "fix" them back.

#### 2. The copy

**File**: `src/i18n/pl.ts`

**Intent**: All stage copy lives here, keyed by stage id — the `upgrades` pattern (L-003).

**Contract**: a new `stages` record beside `upgrades` (`:266-275`), with the same comment shape
("Keyed by stage id (`t.stages[id]`), so the catalogue (`src/data/stages.ts`) carries no literal copy
(L-003). Draft Polish — pending native-speaker review."):

```
stages: {
  stolik:  { name: "Mały stolik",    desc: "Pierwsze kroki w Twoim sklepie." },
  stoisko: { name: "Stoisko",        desc: "Pierwsze produkty i klienci." },
  oferta:  { name: "Sklep z ofertą", desc: "Więcej produktów i większe zyski!" },
  popyt:   { name: "Popyt i zysk",   desc: "Twój sklep działa pełną parą." },
}
```

(Stage 3's and stage 4's wording deviate from the mockup — see D-3.)

**File**: `src/i18n/index.ts`

**Intent**: A guarded accessor so a stale or unknown stage id can never throw mid-render.

**Contract**: `stageCopy(id: string): { name: string; desc: string }`, an exact sibling of
`upgradeCopy` (`:29-35`) — falls back to `{ name: id, desc: "" }`.

#### 3. Tests

**File**: `tests/stages.test.ts` (new)

**Intent**: Lock the ladder mechanically. A comment saying "keep these in sync" is not a mechanism.

**Contract**: the full assertion set from **D-2**, verbatim — monotonicity of
`stageForLevel(businessLevelForShifts(n)).index` over `n` in `0..60`; `index(0) === 0`; every stage
reachable by the formula; `atMax` true exactly at the last index; `stageForLevel(999)` saturates on
the last stage with `atMax`; `requiredLevel`s strictly increasing and starting at 1; and
`stageForLevel` total for `0`, `-5`, `NaN`, `1.5`, `Infinity`. Plus `unlocksForStage` returns only
upgrades whose `requiredWorldLevel` equals the stage's `requiredLevel`, and returns `[]` for `popyt`.

**File**: `tests/data-lookups.test.ts`

**Intent**: Join `worldForTheme` / `getAvatar` in the "stale stored id → renderable default, never
crash" contract this file exists to lock.

**Contract**: a new `describe` mirroring the existing ones — `getStage` resolves every real id and
returns `undefined` for a ghost id; `STAGE_IDS` mirrors `STAGES.map(s => s.id)` and is non-empty.

**File**: `tests/i18n-helpers.test.ts`

**Intent**: Mirror the `upgradeCopy` pair exactly.

**Contract**: a new `describe` — every id in `STAGES` resolves to a non-empty `name` and `desc` via
`stageCopy`, and `stageCopy("ghost-stage")` returns `{ name: "ghost-stage", desc: "" }` without
throwing.

### Success Criteria

#### Automated Verification

- `npm run lint` is clean (including `astro check` / type checking)
- `npm test` is green and the total is **≥ `U₀ + ~14`** (roughly a dozen new cases across three
  files, on top of Phase 1's two)
- `tests/stages.test.ts` passes with no `.skip` and no `.only`
- `grep -n "Mały stolik\|Stoisko\|Sklep z ofertą\|Popyt i zysk" src/data/stages.ts` returns nothing
  (L-003: the catalogue carries no literal copy)
- `grep -nE "from \"(react|astro|@supabase)" src/data/stages.ts` returns nothing (`src/data/` purity)

#### Manual Verification

- None required — this phase renders nothing. (A browser test here would have nothing to look at.)

**Implementation Note**: no manual pause needed; proceed to Phase 3 once automated verification is green.

---

## Phase 3: The `/app/growth` screen

### Overview

The screen itself: page, stage rail, copy. Reachable by URL and auth-gated; **not yet linked** from
the nav — that is Phase 4.

### Changes Required

#### 1. The page

**File**: `src/pages/app/growth.astro` (new)

**Intent**: A read-only view of the child's growth over state the profile already carries. No new
query, no new API route, no `prerender` opt-out (`output: "server"`).

**Contract**: frontmatter copied from `src/pages/app/upgrades.astro:22-32` verbatim in shape — the
`createClient` null-check, the `resolvePageProfile` ladder, the `if (!resolved.profile &&
resolved.profileCount >= 2) return Astro.redirect("/app")` guard, `worldForTheme`, `readPurchased`,
`getAvatar` — then `stageForLevel(profile.business_level)`, `unlocksForStage(...)` and
`nextUpgrade({ businessLevel, purchased })`. Body shape:
`profile && world ? <AppShell …>…</AppShell> : <EmptyStateCard />`.

`AppShell` props: `heading={t.growth.title}`, `subtitle={world.name}`, `active="growth"`,
`profile={{ name, avatarImage, level: profile.business_level, wallet: profile.wallet_balance }}`,
and `progressPercent` / `progressLabel` reused from the savings-toward-next-upgrade computation at
`start.astro:56-62` (the one bar the data supports). `profile.name` is PII — text interpolation
only, never `set:html`. Do **not** compute an `earned` total here (D-1a).

Cards, in the mockup's order, using `childCard()` from `@/components/child/childCard`: hero
(`ShopArt` + world name + `t.growth.intro`) → stage rail → "Co odblokowuje ten etap" → "Następne
ulepszenie" + CTA → "Wskazówka".

#### 2. The stage rail

**File**: `src/components/child/StageRail.astro` (new)

**Intent**: The done / current / locked rail — the heart of the screen. Astro, not React: it is
static presentation over server-resolved props, and the project's convention is React only where
interactivity is needed.

**Contract**: props `{ stages: readonly Stage[]; current: StageProgress }`. **One** DOM tree — a
vertical card list as the base (name + description + state marker per card, per the mobile mockup)
that becomes a horizontal rail at `lg` via utility classes. Never a mobile copy plus a desktop copy;
this mirrors the `AppShell` doctrine and keeps one accessible name per stage.

Per-stage state, using lucide + design tokens (D-3), matching the existing milestone path's visual
language at `start.astro:111-133`:

| State | Node | Card |
| --- | --- | --- |
| done (`index < current.index`) | `Check` in a `bg-success text-success-foreground` circle | plain |
| current (`index === current.index`) | the ordinal in a `bg-primary text-primary-foreground ring-primary/25 ring-4` circle | `ring-primary` ring + a `t.growth.current` ("Aktualnie") chip |
| locked (`index > current.index`) | `Lock` in a `bg-muted text-muted-foreground` circle | muted text |

The connector between nodes is built in code — a `bg-success` segment up to the current node, `bg-muted`
after it — never an image.

**Accessibility, unlike the decorative milestone path this replaces:** the rail is **not**
`aria-hidden`. Each stage carries a visible name and description plus an `sr-only` state word
(`t.growth.stateDone` / `stateCurrent` / `stateLocked`) so a screen reader learns the state that
colour alone conveys. The ordinal badge gets `t.growth.stageOrdinal` ("Etap {n}") as its accessible
label.

**Terminal stage:** when `current.atMax`, render **no** node after the last stage and **no**
next-stage progress bar; render `t.growth.maxStage` under the rail instead (D-2).

#### 3. Copy

**File**: `src/i18n/pl.ts`

**Intent**: Every user-visible string on the new screen (L-003).

**Contract**: a new `growth` namespace, with a comment naming the mockup
(`missing-screens-v3 01-world-progression`) and stating which mockup panels are deliberately not
rendered and why — the same discipline as the existing `report` comment at `:394-396`. Exact keys:

| Key | Polish |
| --- | --- |
| `growth.title` | `Rozwój sklepu` |
| `growth.intro` | `Rozwijaj swój sklep, odblokowuj nowe możliwości i zarabiaj więcej!` |
| `growth.stagesHeading` | `Etapy rozwoju` |
| `growth.stageOrdinal` | `Etap {n}` |
| `growth.current` | `Aktualnie` |
| `growth.stateDone` | `Etap ukończony` |
| `growth.stateCurrent` | `Etap w trakcie` |
| `growth.stateLocked` | `Etap zablokowany` |
| `growth.maxStage` | `To najwyższy etap — Twój sklep działa pełną parą.` |
| `growth.unlocksHeading` | `Co odblokowuje ten etap` |
| `growth.noUnlocks` | `Ten etap nie odblokowuje nowych ulepszeń.` |
| `growth.upgradesLink` | `Zobacz ulepszenia` |
| `growth.tipHeading` | `Wskazówka` |
| `growth.tip` | `Każda ukończona zmiana przybliża Twój sklep do kolejnego etapu.` |

**Reused, not duplicated:** `t.start.levelLabel` ("Poziom sklepu {level}"),
`t.start.nextUpgradeHeading` ("Następne ulepszenie"), `t.upgradeShop.nextProgress`,
`t.start.amountZl`, `t.upgrades[id]` via `upgradeCopy`. `t.nav.items.growth` lands in Phase 4.

#### 4. The `active` union

**File**: `src/components/app/AppShell.astro:38`

**Intent**: `astro check` fails on `active="growth"` until the union admits it.

**Contract**: widen `"dashboard" | "missions" | "shop" | "parent"` with `| "growth"`. **Nothing else
in this file changes in this phase** — the `items` array is Phase 4. F5 widens the same union with
`"worlds"`; the two additions are independent tokens on one line and merge cleanly.

#### 5. `ShopArt` — doc comment only

**File**: `src/components/child/ShopArt.tsx`

**Intent**: Record F4's ownership decision in the code, so the per-stage-art seam is documented for
whoever supplies the art (D-3, D-5).

**Contract**: two lines added to the component's leading doc comment naming the base-`src` expression
at `:42` as the per-stage-art insertion point (`stage.art ?? world.image`) and pointing at
`src/data/stages.ts`. **No change to the props interface, `DEFAULT_SLOTS`, `WORLD_SLOTS`, or the
render.** See the F5 boundary note in D-5 before rebasing.

#### 6. Tests

**File**: `tests/i18n-helpers.test.ts` (or a small `tests/growth-copy.test.ts`)

**Intent**: The screen is Astro-rendered, so there is no component unit test; assert the copy contract
instead.

**Contract**: every key the page and rail reference exists on `t.growth` and is non-empty; and
`t.growth.stageOrdinal` contains the `{n}` placeholder (the same shape
`tests/i18n-helpers.test.ts` already uses for guarded copy).

### Success Criteria

#### Automated Verification

- `npm run lint` is clean, including `astro check` (this is what proves the `active` union widening
  and every prop type)
- `npm test` is green and the total is **≥ `U₀ + ~14`** (Phase 3 adds copy-contract cases only)
- `grep -rn "Rozwój\|Etap\|Aktualnie" src/pages/app/growth.astro src/components/child/StageRail.astro`
  returns nothing (L-003: no literal Polish in components)
- `npx playwright test` is green and the total is **≥ `E₀`, unchanged** (the screen is not linked
  yet, so nothing existing changes)

#### Manual Verification

- **Browser check, both viewports** — this is the phase that warrants one. With the dev server up and
  the demo account signed in (`ui-polish-demo@example.test` / `test-password-123!`, profile "Ania"),
  visit `/app/growth` at desktop width and at 712px:
  - the rail shows four stages, the current one ringed and chipped "Aktualnie", earlier ones with a
    green check, later ones with a padlock
  - it is a vertical card list below `lg` and a horizontal rail at `lg+`, with the connector visible
    in both
  - the hero shows the child's own world art with owned upgrade icons composited on it
  - nothing overflows horizontally at 712px; the page has exactly one `h1`
  - the "Zobacz ulepszenia" CTA reaches `/app/upgrades`
- **Terminal-stage check** — temporarily set the demo profile's `business_level` to `9` in Studio and
  reload: stage 4 is current, there is **no** fifth node and **no** next-stage bar, and
  `t.growth.maxStage` is visible. Restore the value afterwards.
- No sidebar or bottom-bar entry for the screen appears yet (that is Phase 4)

**Implementation Note**: pause for manual confirmation after this phase — it is the first phase with
a visible surface, and the two browser checks above are the ones that catch a layout regression before
the nav entry makes the screen reachable to a child.

---

## Phase 4: Navigation entry and browser tests

### Overview

Ship the link now that the screen exists, and back D-6's arithmetic with a real browser at 712px.

**The two browser specs below are a hand-off to `/10x-e2e`, not inline `/10x-implement` work**
(plan review). `CLAUDE.md` binds E2E work to that skill and `e2e/CLAUDE.md:45` calls it "the single
source of truth for the workflow"; F1's plan routes its own browser phase the same way. Land the nav
entry + copy under `/10x-implement`, verify the existing suite still passes, then run
`/10x-e2e world-progression-stages` for the spec, the smoke test and the `playwright.config.ts`
widening. The contracts below are the brief that skill receives — they are written as risks to cover,
not as code to paste.

### Changes Required

#### 1. The nav entry

**File**: `src/components/app/AppShell.astro:59-63`

**Intent**: One object in `items` puts the entry in the desktop sidebar **and** the mobile bottom bar
(`tabs` at `:65` is a spread of `items` plus the pinned parent entry).

**Contract**: `{ key: "growth", href: "/app/growth", label: t.nav.items.growth, icon: TrendingUp }`,
inserted after `shop` to match the mockup's sidebar order (Pulpit · Misje · Mój sklep · Rozwój
świata). `TrendingUp` from `lucide-react` matches the pack's `world-progress.svg` ascending-path glyph
and needs no crop — generic icons come from lucide (standing brief). Add it to the existing
`lucide-react` import at `:1`.

**File**: `src/i18n/pl.ts:133-138`

**Contract**: `growth: "Rozwój świata"` under `nav.items`, after `shop`. Verified against every
existing accessible name in D-4 — no substring collision in either direction.

#### 2. Browser tests

**File**: `e2e/smoke.spec.ts`

**Intent**: The gating regression — the new route must bounce an anonymous visitor.

**Contract**: one test copied from the `anonymous /app redirects to signin` template at `:16-20`,
targeting `/app/growth`. Runs in the `desktop` project only. (+1 test)

**File**: `e2e/growth.spec.ts` (new)

**Intent**: Prove the screen is reachable from the nav and that the bottom bar survives its extra
entry at the touch viewport — the D-6 accommodation check, which protects F5's sixth tab too.

**Contract**: two tests over a provisioned account with one child profile (reuse the helpers in
`e2e/helpers/accounts.ts`, and `e2e/helpers/i18n.ts` for copy):

1. *nav entry reaches the growth screen* — from `/app/start`, click
   `getByRole("link", { name: t.nav.items.growth })`, land on `/app/growth`, assert
   `getByRole("heading", { name: t.growth.title })` and that all four `t.stages.*.name` values are
   visible with `t.growth.current` present exactly once.
2. *the bottom bar holds every entry* — at the touch viewport, assert each of the five tab links
   (`t.nav.items.dashboard|missions|shop|growth|parent`) is visible and resolvable by its **full**
   accessible name, and that `document.documentElement.scrollWidth <= clientWidth` (no horizontal
   overflow). Locators must use the full string, never a `getByText("Rozwój")` fragment — name
   matching is substring-based and "Rozwój świata" / "Rozwój sklepu" share a prefix.

(+2 tests in `desktop`, +2 in `touch` = +4.)

**File**: `playwright.config.ts:52`

**Intent**: Give the new spec touch-viewport coverage — the `touch` project is scoped to one spec today.

**Contract**: `testMatch: /gameplay-restore\.spec\.ts/` → `testMatch: /(gameplay-restore|growth)\.spec\.ts/`.
**Note for F5:** extend the alternation (`|worlds`), do not replace it.

### Success Criteria

#### Automated Verification

- `npm run lint` is clean, including `astro check`
- `npm test` is green and the total is **≥ `U₀ + ~14`** (this phase adds no unit tests)
- `npx playwright test` is green and the total is **≥ `E₀ + 5`** (1 desktop smoke + 2 growth tests ×
  2 projects). `E₀` was 15 at plan time — 13 specs plus `gameplay-restore`'s 2 counted twice
- `npx playwright test --project=touch` is green — proves the 712px bottom bar at 5 entries
- `e2e/gameplay-restore.spec.ts` still passes in both projects (the accessible-name regression check:
  `getByRole("link", { name: t.start.upgradesLink })` at `:55` must stay unambiguous)

#### Manual Verification

- **Browser check at 712px with a sixth tab simulated** — temporarily add a throwaway sixth entry to
  `items`, reload at 712px, and confirm the bar does not wrap or overflow and every label is still
  readable. Remove the throwaway entry before committing. This is the direct check of D-6's
  arithmetic on F5's behalf; record the result in the handoff so F5 does not have to repeat it.
- The sidebar entry is highlighted (`aria-current="page"`) on `/app/growth` and not elsewhere
- The bottom bar shows the entry below `lg` and the sidebar shows it at `lg+`, with **one** copy of
  "Rozwój świata" in the accessibility tree at every viewport

**Implementation Note**: this is the last phase; after it passes, the feature is complete. Do not push
and do not open a PR — the maintainer reviews locally.

---

## Testing Strategy

### Unit tests

- **The ladder** (`tests/stages.test.ts`) — monotonicity of
  `stageForLevel(businessLevelForShifts(n))`, saturation at the terminal stage, reachability of every
  stage by the formula, totality for `0` / negative / `NaN` / non-integer / `Infinity`. This is the
  anti-drift mechanism; it is not replaceable by a comment.
- **Resolver fallbacks** (`tests/data-lookups.test.ts`) — `getStage` on a ghost id, `STAGE_IDS`
  mirrors `STAGES`.
- **Copy** (`tests/i18n-helpers.test.ts`) — `stageCopy` for every catalogue id and for a ghost id;
  every `t.growth.*` key non-empty.
- **Unlocks** — `unlocksForStage` returns exactly the upgrades gated at that level, `[]` at `popyt`.
- **The write path** (`tests/shifts-complete.test.ts`, `tests/upgrades-buy.test.ts`) — a shift's row
  records `5*taskCount + 3*cleanCount`; a purchase row records `null`.
- **Isolation** (`tests/shift-log-isolation.test.ts`) — the four-operation contract now covers the
  whole row including `earned`; the insert that omits `earned` still succeeds.

**Forbidden assertion (D-1a):** no test may assert `wallet_balance == sum(shift_log.earned)`.
`appendShiftLog` swallows its insert error, so that equality is flaky by construction.

### Integration / browser tests

Phases warranting a browser test: **Phase 3** (manual, both viewports plus the terminal-stage check —
the first visible surface) and **Phase 4** (automated, `e2e/growth.spec.ts` in both projects, plus the
manual six-tab simulation). Phases 1 and 2 warrant none: Phase 1 is server-only with no UI delta, and
Phase 2 renders nothing.

- `anonymous /app/growth redirects to signin` — `e2e/smoke.spec.ts`, the `:16-20` template.
- `nav entry reaches the growth screen` and `the bottom bar holds every entry` —
  `e2e/growth.spec.ts`, run in both `desktop` and `touch`.

### Manual testing steps

1. `npx supabase start`, `npm run dev`, sign in as `ui-polish-demo@example.test` /
   `test-password-123!`, PIN `2468`, profile "Ania".
2. Complete a shift; in Studio confirm the new `shift_log` row's `earned` equals
   `5*taskCount + 3*cleanCount` and that a purchase row's `earned` is `null`.
3. Visit `/app/growth` at desktop width and at 712px — check the rail, the hero, the one `h1`, and no
   horizontal overflow.
4. Set `business_level` to `9` in Studio, reload, and confirm the terminal-stage rendering (no fifth
   node, no next-stage bar, `t.growth.maxStage` visible). Restore afterwards.
5. Add a throwaway sixth nav entry, reload at 712px, confirm the bar holds, remove it.

## Performance Considerations

None material. The screen adds no query — it renders `ChildProfile` fields the page already loads.
`stageForLevel` and `unlocksForStage` are O(4) and O(6) over static arrays. The migration adds no
index because `earned` is projected and aggregated, never a predicate, and the weekly query already
rides `shift_log_profile_created_idx`.

One latent ceiling worth knowing but **not** fixing here: `business_level` is `smallint`, so Postgres
hard-errors at 32767 (≈98,301 shifts), surfacing as a 500 from
`src/pages/api/shifts/complete.ts:89`. Pre-existing; out of scope.

## Migration Notes

- **Single migration**, `20260822120000_shift_log_add_earned.sql`, additive and nullable, applied
  before any reader exists.
- **No backfill** (D-1). Pre-migration rows read `null` — "we don't know", not "earned nothing".
- **No RLS change** (D-9), with the reasoning recorded in the migration header.
- **Rollback** is `alter table public.shift_log drop column earned;`. Safe at any point: no reader
  outside `child-profiles.ts` exists until F1 ships its tile, and the write-path key is optional.
- **Forward compatibility for F1:** the transitional window in which a weekly aggregate can mix real
  and `null` **shift** rows ends at the first Monday after the migration (the report window is the
  current Mon–Sun week), and F1 suppresses the tile for its duration rather than rendering a
  silently-undercounted number. **Purchase rows are `null` permanently and are excluded from that
  predicate** — see D-1a; a predicate that ignores `upgrade_purchased` never stops suppressing.

## Known risks

Recorded by the plan review (`reviews/plan-review.md`, 2026-08-23) — accepted, not fixed. None
blocks implementation; each is a thing to notice rather than a thing to do.

- **Two `t.growth` strings duplicate existing Polish verbatim.** `t.growth.upgradesLink =
  "Zobacz ulepszenia"` is identical to `results.upgradesNudgeLink` (`pl.ts:363`), and
  `t.growth.tipHeading = "Wskazówka"` is identical to `task.hintTitle` (`:246`). Neither collides in
  the accessibility tree — `results.*` renders inside the shift-results island on `/app/task` and
  `task.hintTitle` on the mission screen, so neither ever coexists with `/app/growth` — and
  per-namespace copy is the house pattern (`start` and `upgradeShop` already duplicate strings). But
  D-4's collision check only tested the **nav label**; if a future e2e ever visits both surfaces in
  one flow, its locator must be page-scoped, not a bare `getByText`. Re-verified 2026-08-23: nothing
  in `pl.ts` contains "Rozwój", "Aktualnie" or "Etap", so the nav-label check itself still holds
  after F2's copy landed.
- **D-6's longest-label arithmetic used "Panel rodzica" and did not test the new label.** "Rozwój
  świata" is the same 13 characters and marginally wider (two diacritics, `w`+`ś` vs `l`+`d`); F5's
  "Światy" is shorter. The ~80–85 px estimate against ~108 px of available label width at 712 px has
  enough headroom that this does not change the verdict, and Phase 4's browser check measures the
  real thing. Left as-is.
- **`change.md`'s title still says "with per-stage art"**, which D-3 makes false. Already recorded as
  a deliberate autonomous decision in `change.md` (renaming the identity mid-run costs more than the
  inaccuracy). Reverses when per-world stage art is produced.
- **The `earned` CHECK adds a new — but unreachable — way for `appendShiftLog` to lose a row
  silently.** Verified: `earningsForShift(t, c) = 5t + 3c` over zod-bounded non-negative integers
  (`complete.ts:41-42, 52`, `taskCount ≤ MAX_SHIFT_TASKS`, `cleanCount ≤ taskCount`) is always a
  non-negative integer well inside `int4`, so `shift_log_earned_nonneg` cannot reject a legitimate
  insert. Ordering is also unchanged: the authoritative profile UPDATE commits *before*
  `appendShiftLog` runs (`child-profiles.ts:175-187`), so the reverse failure — earnings logged for a
  shift that did not persist — remains impossible. What is newly true is that a lost log row now also
  loses money data, which is exactly the lower-bound property D-1a already binds the copy to.

## References

- Research: `context/changes/world-progression-stages/research.md`
- Standing brief: `context/runs/2026-08-22-autonomous-five/agent-contract.md`
- Migration template: `supabase/migrations/20260701140000_child_profiles_add_skill_state.sql`
- Table + policies: `supabase/migrations/20260701150000_create_shift_log.sql:21-30, 38-63`
- Ladder precedent: `src/data/skills.ts:96-110` (`skillProgress`, `atMax`)
- Catalogue house style: `src/data/upgrades.ts:15-41, 107-113`
- Copy pattern: `src/i18n/pl.ts:266-275`, `src/i18n/index.ts:29-35`
- Page template: `src/pages/app/upgrades.astro:22-32`
- Shell nav: `src/components/app/AppShell.astro:38, 59-65, 186-203`
- Milestone path being superseded: `src/pages/app/start.astro:46-51, 111-133`
- Write path: `src/lib/services/child-profiles.ts:120-137, 157-190, 257-262`
- Registry to update: `docs/reference/contract-surfaces.md` (`## public.shift_log`)
- Concurrent features: `context/changes/world-selection-screen/` (F5 — `/app/worlds`, `ShopArt`
  coordinates), `context/changes/parent-weekly-activity-chart/` (F1 — the earnings tile)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: `shift_log.earned` — migration, write path, registry

#### Automated

- [x] 1.1 Migration applies cleanly against the local stack — `npx supabase migration up` OK; `earned integer` nullable + `shift_log_earned_nonneg` confirmed via `pg_constraint`
- [x] 1.2 `npm run lint` clean
- [x] 1.3 `npm test` green — **348 / 44 files** (= `U₀ + 2`, `U₀ = 346`)
- [x] 1.4 `shifts-complete` asserts `earned === 5*taskCount + 3*cleanCount` (= 29). Deliberate-break check done: dropping the `earned` argument from the `appendShiftLog` call turns the test red
- [x] 1.5 `upgrades-buy` asserts a purchase row's `earned` is `null`
- [x] 1.6 `npx playwright test` green — **17 passed**, i.e. `E₀` unchanged

#### Manual

- [x] 1.7 Verified against the live DB instead of Studio (equivalent, and scriptable): `information_schema.columns` shows `earned integer` nullable, and the 3 pre-existing `shift_log` rows all read `null` (`count(earned) = 0`)
- [x] 1.8 Migration header names all four covering policies and states why none was added (column-agnostic, no column-level grants in the project, two in-repo precedents)
- [x] 1.9 Pointer appended to `context/changes/parent-weekly-activity-chart/handoff.md` — noting that F1 had already landed, so **F4 ships the tile itself** (Phase 1b)

### Phase 1b: The parent weekly earnings tile (was **Handed to F1**)

> **Scope addition, decided autonomously — see `## Autonomous decisions` D-10.** The plan handed this
> work to F1 on the premise that F1 had not started. By implementation time F1 was **implemented,
> reviewed and merged into F4's base**, so the recipe had no remaining owner. F4 ships it, applying
> the **post-F1** corrections in the recipe (fourth tile, conditional grid, second rewrite of the
> `pl.ts` comment) rather than the pre-F1 originals.

#### Automated

- [x] 1b.1 `ShiftLogRow.earned` is **optional**; `getWeeklyReport`'s explicit select names `earned`
- [x] 1b.2 `aggregateWeeklyReport` returns `earned` + `earningsKnown`, the predicate scoped to shift rows
- [x] 1b.3 `WeeklyReport.tsx` renders `statEarned` **fourth**, grid `cn("mt-5 grid gap-3", earningsKnown ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 sm:grid-cols-3")`
- [x] 1b.4 The stale `pl.ts` comment rewritten a second time — the column now exists; the lower-bound + wording rules recorded there
- [x] 1b.5 `npm run lint` clean, `npm run check` 0 errors
- [x] 1b.6 `npm test` green — **357 / 44 files** (= `U₀ + 11`)
- [x] 1b.7 **Defect-distinguishing check performed**: replacing the predicate with the naive unscoped `rows.some(r => r.earned == null)` turns exactly **2** tests red (purchases-only, and purchase-alongside-shift). No test asserts `wallet == sum(earned)`

### Phase 2: The stage catalogue and its copy

#### Automated

- [x] 2.1 `npm run lint` clean; `npm run check` 0 errors / 0 warnings
- [x] 2.2 `npm test` green — **379 / 45 files** (= `U₀ + 33`; +22 this phase)
- [x] 2.3 `tests/stages.test.ts` passes — 16 cases, no `.skip`, no `.only`
- [x] 2.4 No Polish literal in `src/data/stages.ts` — the grep initially caught a *doc comment* quoting the deviating stage name, which was rephrased to reference the id (`oferta`) instead, so the gate keeps meaning something
- [x] 2.5 No react/astro/supabase import in `src/data/stages.ts` — only `@/data/upgrades`, itself pure

### Phase 3: The `/app/growth` screen

#### Automated

- [x] 3.1 `npm run lint` clean (0 errors, 0 warnings); `npm run check` 0 errors / 0 warnings
- [x] 3.2 `npm test` green — **381 / 45 files** (= `U₀ + 35`)
- [x] 3.3 No literal Polish in `growth.astro` / `StageRail.astro` — the grep initially caught one *doc comment* quoting a rendered ordinal, rephrased to name the key instead
- [x] 3.4 `npx playwright test` green — **17 passed**, `E₀` unchanged (re-run at the end of Phase 4)

#### Manual

- [x] 3.5 Browser-verified on a **self-provisioned** account (`f4-growth-check@example.test`, profile "Zosia", `business_level = 2`) against an isolated dev server on **4327** — the shared 4321 server belongs to another agent's worktree (D-11). At 1440px: four stages side by side (x = 337/596/856/1115, 259px each), exactly **one** `h1` ("Rozwój sklepu"), each stage name in the DOM exactly once, "Aktualnie" exactly once, `scrollWidth == clientWidth`. At **712px**: the same four items stack vertically (identical x = 41, increasing y), still one `h1`, still no horizontal overflow. Computed styles confirm three visually distinct states — done `bg-success` + Check, current `bg-primary` + ordinal + `border-primary` ring + chip, locked `bg-muted` + Lock. `sr-only` states read done / current / locked / locked, and the ordinal badges carry `aria-label` "Etap 1..4"
- [x] 3.6 Hero renders the child's **own** world art (`/illustrations/world-kawiarnia.webp`) via `ShopArt`, with the owned `sign` upgrade composited — not a stock stage image
- [x] 3.7 Terminal-stage check at `business_level = 9` (on the throwaway profile, restored afterwards): stage 4 current, rail holds **exactly 4** nodes (no phantom fifth), `sr-only` reads done/done/done/current, `t.growth.maxStage` visible, `t.growth.noUnlocks` shown honestly, **only one** progress bar on the page (the savings bar — no unfillable next-stage bar), and the shell badge still reads "Poziom sklepu 9" — the formula is uncapped, saturation is presentational
- [x] 3.8 The "Zobacz ulepszenia" CTA resolves to `/app/upgrades`; "Rozwój świata" is **absent** from the page at this phase — the screen exists unlinked, which is the correct direction of the no-dead-navigation rule

### Phase 4: Navigation entry and browser tests

#### Automated

- [x] 4.1 `npm run lint` clean (0 errors, 0 warnings); `npm run check` 0 errors / 0 warnings
- [x] 4.2 `npm test` green — **382 / 45 files** (= `U₀ + 36`)
- [ ] 4.3 `npx playwright test` green, total ≥ `E₀ + 5` — **NOT DONE (Phase 4b, handed to `/10x-e2e`).** The existing suite is green and undisturbed at **17 = `E₀`**; the +5 arrives with `e2e/growth.spec.ts`, the smoke redirect and the `playwright.config.ts` widening
- [x] 4.4 `npx playwright test --project=touch` green — both `gameplay-restore` specs pass at 712px with the fifth tab present
- [x] 4.5 `e2e/gameplay-restore.spec.ts` passes in **both** projects — the `t.start.upgradesLink` locator stayed unambiguous, which is what the deliberately-distinct `t.growth.upgradesLink` was for

#### Manual

- [x] 4.6 **Six-tab simulation done at 712px — D-6's arithmetic confirmed empirically, and this is the answer F5 needs so it does not have to repeat it.** A throwaway sixth tab labelled "Światy" was injected into the live bottom bar and removed immediately (nothing committed). Result: **6 tabs, ONE row, 116px each** — exactly the predicted `(712 − 16) / 6 = 116` — **zero truncated** (`scrollWidth === clientWidth` on every label span), no wrap, and no horizontal overflow on either the bar or the document. At 5 tabs each gets 139px. **No accommodation is needed for F5's sixth entry.**
- [x] 4.7 `aria-current="page"` resolves to `/app/growth` on the growth screen and to `/app/start` on the dashboard, where the growth links carry no `aria-current`
- [x] 4.8 Exactly **one** copy in the accessibility tree. The link is in the DOM twice (sidebar + bottom bar, the shell's existing shape) but the inactive one sits under a `display: none` ancestor, so an ancestor-walk finds `inDom: 2, inA11yTree: 1` at 712px — `getByRole` stays unambiguous
