<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Add the Pracownia and Laboratorium worlds, each with its own decoration set

- **Plan**: `context/changes/six-worlds-catalogue/plan.md`
- **Scope**: Phases 0–6 of 6 (all 47 `## Progress` rows ticked, 0 remaining)
- **Date**: 2026-08-27
- **Branch**: `feat/six-worlds-catalogue` @ `0a056f4`, cut from `feat/world-economy-profit-rule` @ `a183a70`
- **Reviewed in**: `.claude/worktrees/six-worlds-catalogue`, `E2E_PORT=4333`, sandbox disabled
- **Verdict**: APPROVED
- **Findings**: 0 critical, 3 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING (2 findings) |
| Success Criteria | WARNING (1 finding — evidence quality only; every automated criterion re-measured green) |

## Verification re-run in this step — nothing inherited

Baselines were **measured by this reviewer on the predecessor branch**, not taken from
the handoff. Both worktrees were confirmed to resolve their own `node_modules`
(L-009: `require.resolve('astro')` resolves under the worktree's own path, not the
parent repo's).

| command | result observed here |
|---|---|
| `npm test` on `feat/world-economy-profit-rule` @ `a183a70` (the baseline) | **629 passed / 62 files** |
| `npm test` on `feat/six-worlds-catalogue` | **633 passed / 63 files** — baseline 629, **+4** |
| arithmetic | the only new test file is `tests/worlds-art.test.ts`, which holds exactly **4** `it` cases. 629 + 4 = 633, 62 + 1 = 63. Reconciles exactly; no other test file was edited (`git diff --name-only` over `tests/` shows one added file and zero modified) |
| `npx playwright test` on `feat/world-economy-profit-rule` (the baseline) | **26 passed** |
| `E2E_PORT=4333 npx playwright test` on `feat/six-worlds-catalogue` | **28 passed** — baseline 26, **+2**, and both runs of `e2e/worlds.spec.ts` are named in the runner output under `[desktop]` **and** `[touch]`. `+1` would have meant the `playwright.config.ts` alternation edit was skipped; it was not |
| `npm run lint` | exit **0** |
| `npm run check` | exit **0** — 0 errors, 0 warnings, 8 hints |
| working tree after every break was restored | `git status --porcelain` **empty** |

**Live-database check (not a file read).** The plan and `ownership.md` claim no
migration is needed because `child_profiles.theme` carries no CHECK constraint. Verified
against the running local Postgres: `theme` is `text not null default 'default'::text`,
and `pg_constraint` over `public.child_profiles` returns only `pkey`, the `account_id`
FK, and the `age` / `completed_shift_count` / `business_level` / `wallet_balance` range
checks — **no constraint on `theme`**. Widening `WORLD_SLUGS` from four slugs to six is
therefore an app-layer zod change and nothing else. The four per-operation RLS policies
on `child_profiles` are present and untouched by this branch (L-001 satisfied by absence
of schema change, not by assertion).

### Deliberate breaks re-executed by this reviewer (L-004)

The handoff reports five. Three were re-run here, chosen for the three claims that
carry the most weight. All three reproduce.

1. **Removed the `laboratorium` decoration set** from `src/data/decorations.ts`.
   `tests/decorations.test.ts` went **3 failed / 19 passed**, and every message names the
   world by slug — *"world `laboratorium` has no full decoration sink: expected +0 to be
   4"*, *"…is priced off the shared curve"*, *"…was offered a foreign decoration"*.
   *Meta-check:* the break removes exactly the **data** W1 contributes and the redness
   names the emptied world, so it is evidence for the specific claim that F1's sweeps
   quantify over `WORLD_SLUGS` and that W1's Phase 4 is what closes them. Restored → 22/22.
2. **Stripped `precision` and `margin` from `WORLD_SLOTS.pracownia`** — the exact state a
   branch cut from `matmaverse-v2` instead of from F1 would have produced (the plan's
   L-009 path check). `tests/shop-art-slots.test.tsx` § *"covers every upgrade id in every
   table"* went red with *"`pracownia` has no slot for upgrade `precision`"*. A green here
   would have proved the branch point never carried F1's eight-entry catalogue. Restored → 5/5.
3. **The Phase 5 E2E break, both versions** — this is the handoff's headline correction and
   it is **real, not a story**. Forcing `grid-cols-6` on `WorldPicker`'s grid at the touch
   viewport failed the **column-count** assertion (`e2e/worlds.spec.ts`, the
   `expected ${expectedColumns} columns at ${viewport.width}px` expectation) while the
   overflow number stayed **0** — i.e. the break the plan contracted does **not** exercise
   the assertion the phase exists to prove. Replacing it with
   `grid-cols-[repeat(6,minmax(9rem,1fr))]` (tracks with a floor, the plausible real
   regression) failed the **overflow** expectation instead — *"the world grid scrolls
   sideways at this viewport"*. Both breaks were run in the `touch` project and restored;
   `e2e/worlds.spec.ts` then passed 2/2. The correction is banked in that spec's module
   header, which is the right place for it.

### Applied claims spot-checked rather than trusted

- **L-007 two-direction substring sweep, re-run programmatically here** over the loaded
  dictionary plus `WORLDS` — **422 strings**, every new label (the 8 `t.decorations`
  entries and both world names) checked against every other string in **both**
  directions, plus exact-duplicate detection. **Zero collisions.** Progress rows 1.7 and
  4.6 are real.
- **Icon distinctness (manual row 4.9)** verified from data, not from a screenshot: the 24
  decoration icon keys across six worlds contain **no duplicate** (`uniq -d` returns
  nothing). Pracownia is `sticker`/`spool`/`palette`/`scissors`, Laboratorium is
  `star`/`flask`/`microscope`/`atom` — visibly different sets, and different from all of
  E1's. `ShopIconKey` is `keyof typeof SHOP_ICONS`, so the three appended keys widened the
  union with no type edit — the CPD-6 carve-out was honoured exactly as written.
- **Committed art**: `public/illustrations/world-pracownia.webp` and
  `world-laboratorium.webp` are tracked in git (`git ls-files`), and
  `public/illustrations/slice-map.md` already carries both rows with source stems and fit
  mode. No code resolves a path under `assets/` (`assets/` is confirmed **absent** from
  this worktree, so every layout decision here is a declared extrapolation).
- **Ownership compliance**, file by file against `ownership.md`: W1 wrote only
  `src/data/worlds.ts`, the two new `WORLD_SLOTS` keys in `ShopArt.tsx`, appended entries
  in `decorations.ts`, three appended `SHOP_ICONS` keys, appended `pl.ts` keys plus one
  comment, `WorldPicker.tsx`, `CreateProfileWizard.tsx`, `playwright.config.ts`'s
  alternation (extended, not replaced), and two new test files. It touched **no**
  `src/lib/services/` file, **no** route, **no** `src/types.ts`, **no** migration, and
  did not re-seed `e2e/growth.spec.ts`. `docs/reference/contract-surfaces.md` was
  correctly left alone — its *World-change surface (F5)* paragraph names no world count,
  so six leaves it true.

## Findings

### F1 — `t.marketing.worlds` is a hand-maintained duplicate of `WORLDS`, now stale at 4 against 6

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/i18n/pl.ts` → `pl.marketing.worlds`; consumed by `src/components/auth/AuthShell.astro` (the `hidden grid-cols-4 … lg:grid` strip)
- **Detail**: The signed-out marketing strip lists four worlds — including `Kawiarnia`,
  which is `DEFAULT_WORLD` — while the app now ships six. Nothing syncs the two lists and
  no unit test or spec reads `marketing.*`, so the drift is invisible to the suite. This
  is plan Decision 2 and it is defensible (growing the list to six without changing
  `AuthShell.astro`'s `grid-cols-4` would render a ragged 4+2 on desktop, unnoticed), and
  the branch added the comment that records the coupling. It is flagged because the
  divergence is now permanent debt, not because the branch regressed anything — the
  signed-out page renders exactly as it did before.
- **Fix**: Derive `marketing.worlds` from `WORLDS` and land it **together with**
  `AuthShell.astro`'s `grid-cols-4` → `grid-cols-3` in one change, so the list and its
  column count move at the same time.
- **Decision**: FOLLOW-UP (`follow-ups/review-fixes.md`)

### F2 — World names are inline literals on `World`, and `slice-map.md` documents the opposite

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: `src/data/worlds.ts` → `WORLDS` (the `name` field on each `World` record);
  `public/illustrations/slice-map.md` § *Notes*
- **Detail**: `World.name` carries user-visible Polish (`"Pracownia"`, `"Laboratorium"`)
  that never passes through `src/i18n/pl.ts` — the standing L-003 tension, which this
  branch makes 50% larger. Worse, `slice-map.md`'s Notes assert that world labels *"are
  rendered as text from `i18n`, not baked in"*, and that sentence is simply false; it now
  names all six worlds while describing a mechanism none of them use. The branch is
  **not at fault** for the code half: `ownership.md` §1a explicitly forbids W1 from
  moving world names into the dictionary this run. The documentation half is a
  free correction nobody made.
- **Fix**: Add a `nameKey` to `World` resolving through the dictionary, landed alone after
  the stack merges; correct the `slice-map.md` Notes sentence in the same change.
- **Decision**: FOLLOW-UP (`follow-ups/review-fixes.md`)

### F3 — The badge-placement evidence for `WORLD_SLOTS.pracownia` / `.laboratorium` is not reproducible

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `src/components/child/ShopArt.tsx` → the `pracownia` and `laboratorium`
  keys of `WORLD_SLOTS`
- **Detail**: Progress rows 3.6–3.8 and 6.8 ("no badge over a focal point") were closed
  with a throwaway pixel probe that was deliberately **not committed**, so the 0%-ink
  measurement cannot be re-run by a reviewer or by CI. What *is* checkable held up:
  `tests/shop-art-slots.test.tsx`'s four data assertions cover both new tables (one
  horizontal + one vertical percent per entry, all eight ids present, iterating
  `Object.entries(WORLD_SLOTS)`), and the sixteen new coordinates sit in the same numeric
  family as F1's three shipped tables. The uncheckable part is purely aesthetic — a badge
  over a focal point is ugly, never wrong — so this does not gate the merge. Deleting the
  probe was the right call for a screenshot tool with no assertions; the gap is that no
  cheaper durable substitute replaced it.
- **Fix**: Either commit the ink probe as a deterministic `toMatchSnapshot` visual check
  (the shape `e2e/CLAUDE.md` already names for this), or accept the coordinates as
  reviewed-by-eye and say so in the module comment. Do not leave the row reading as if a
  measurement backs it when the measurement no longer exists.
- **Decision**: FOLLOW-UP (`follow-ups/review-fixes.md`)

### F4 — `CreateProfileWizard`'s interest grid is 50% taller at `lg`, and nothing measures the wizard's reflow

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: `src/components/child/CreateProfileWizard.tsx` → the `WORLDS.map` grid
  under `t.profileWizard.interestLabel`
- **Detail**: `sm:grid-cols-4` → `sm:grid-cols-3` fixes the `sm`…`lg` band cleanly (3×2,
  no orphan row), but the untouched `lg:grid-cols-2` now renders **three** rows where it
  rendered two, making step 2 of the wizard meaningfully taller on desktop. Manual row 2.6
  was checked at ~700px, which is the `sm` band — the tallest configuration was not the
  one observed. The grid sits in ordinary document flow with no fixed-height ancestor, so
  the page simply scrolls; and `e2e/onboarding.spec.ts` cannot see it either way, because
  Playwright scrolls a tile into view before clicking. Recorded, not escalated: nothing is
  clipped and nothing is unreachable.
- **Decision**: RECORDED

### F5 — The plan's contracted Phase 5 break could not prove the assertion it was written for

- **Severity**: 📝 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: `context/changes/six-worlds-catalogue/plan.md` → Progress row 5.4;
  corrected in `e2e/worlds.spec.ts`'s module header
- **Detail**: Row 5.4 contracts *"force `grid-cols-6` at the touch width → overflow
  assertion red"*. Re-executed here: it goes red at the **column-count** assertion with
  the overflow number still 0, because Tailwind's `grid-cols-6` is
  `repeat(6, minmax(0, 1fr))` and those tracks shrink to nothing. The implementer found
  this, replaced the break with `grid-cols-[repeat(6,minmax(9rem,1fr))]` (which does turn
  the overflow expectation red), and banked both in the spec header. **This is exactly
  L-004 working**, and it is the second time in this project that a *plan-contracted*
  assertion/break pair failed to line up — `world-progression-stages` hit the same shape
  with `document.documentElement.scrollWidth` against a `position: fixed` bar. Nothing in
  the shipped code is wrong; the plan's verification recipe was.
- **Fix**: Worth promoting to a lesson: *a deliberate break must remove the protection,
  not merely perturb the component* — and specifically, `minmax(0,1fr)` tracks make the
  obvious "too many columns" break invisible to any overflow assertion.
- **Decision**: RECORDED (lesson candidate, listed in `follow-ups/review-fixes.md`)

### F6 — Cross-plan: F1's landed `tests/decorations.test.ts` quantifies over `WORLD_SLUGS` in three cases, not one — `ownership.md`'s CPD-2 under-counted

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `context/runs/2026-08-27-world-economy/ownership.md` § CPD-2;
  `context/changes/six-worlds-catalogue/plan.md` → Phase 1 success criteria;
  the landed `tests/decorations.test.ts` cases *"gives every world in WORLD_SLUGS a full
  decoration set"*, *"prices every world's set on the same rising curve"*, *"only ever
  names the CURRENT world's decorations"*
- **Detail**: The contention sweep predicted Phase 1 would show **exactly two** reds and
  set the failure condition at three. The branch observed **four** and proceeded, which
  was the right call and is recorded in the handoff's Autonomous decisions. Independently
  confirmed here: emptying one world's decoration set alone produces **three** reds in
  `tests/decorations.test.ts`, all naming the world by slug — so with `shop-art-slots`'s
  id sweep the true Phase 1 count is four. The sweep read F1's *plan* (one totality
  assertion) rather than F1's *landed* test file, which is the same staleness class
  `ownership.md` §6 rule 2 warns about, turned on the sweep itself. No action on this
  branch; recorded so the next sweep counts reds from landed code, not from a sibling plan.
- **Decision**: RECORDED (cross-plan)

MERGE: CLEAR — every plan success criterion re-measured green on this branch (vitest 633, baseline 629, +4; Playwright 28, baseline 26, +2, both projects), three deliberate breaks independently reproduced and restored, no-migration confirmed against the live database, and zero CRITICAL findings.
