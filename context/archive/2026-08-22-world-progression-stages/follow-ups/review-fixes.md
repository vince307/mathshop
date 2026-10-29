# Follow-ups from the implementation review — `world-progression-stages` (F4)

Source: `context/changes/world-progression-stages/reviews/impl-review.md` (2026-08-23).
Branch: `feat/world-progression-stages` (third in the stack; merge order **F2 → F1 → F4**).

> **None of these blocks the merge.** The review found **zero CRITICAL findings** and the branch is
> mergeable as-is: migration verified against the live database, write-path ordering correct,
> suppression predicate correct and proved by a re-executed deliberate break, all 382 unit tests and
> 22 Playwright runs green, lint clean, `check` 0/0/9. Every item below is cosmetic, an accessibility
> polish, or a documentation line. Take them in one small commit whenever convenient — they do not
> need their own change folder.

Ordered by value. Items 1–3 are the ones worth doing.

---

## 1. `growth.astro` — the next-upgrade heading renders over an empty box (review F1)

- **File**: `src/pages/app/growth.astro`
- **Symbol / anchor**: the `<section>` holding `{t.start.nextUpgradeHeading}` — today around `:120-147`;
  anchor on the string, not the number.
- **Problem**: `<h2>{t.start.nextUpgradeHeading}</h2>` sits **outside** the `{next && (…)}` guard.
  `nextUpgrade` returns `null` once every level-eligible upgrade is owned, so the child sees
  "Następne ulepszenie" over nothing — while the section directly above it does the honest-empty thing
  correctly (`t.growth.noUnlocks`).
- **Required change**: Move the `<h2>` inside the `{next && (…)}` block. Decide explicitly whether the
  "Zobacz ulepszenia" CTA should survive `next === null` — if not, guard the whole `<section>` the way
  `src/pages/app/start.astro` does (its whole next-upgrade card is inside `{next && (…)}`); if yes,
  leave the `<a>` outside and only guard the heading + body.
- **Verify**: a profile with every level-eligible upgrade owned renders no orphan heading. Cheapest as
  a seeded manual check on `/app/growth`; no new test is required.

## 2. `StageRail.astro` — the stage ordinal is never announced (review F2)

- **File**: `src/components/child/StageRail.astro`
- **Symbol / anchor**: the three state-marker `<span>`s carrying
  `aria-label={t.growth.stageOrdinal.replace("{n}", String(stage.order))}` — today `:76`, `:83`, `:90`.
- **Problem**: `aria-label` is not mapped onto `role="generic"`, so AT ignores it. The "done" and
  "locked" markers contain only an `aria-hidden` lucide icon and therefore announce **nothing**. The
  file's own comment and Progress row 3.5 both claim the ordinal is spoken; it is not.
- **Required change**: Add `role="img"` to all three spans (including the "current" one, which has
  visible text — consistency beats a special case). Precedents: `src/components/child/ShiftResults.tsx`
  (`role="img" aria-label={…}`) and `src/components/child/SkillCards.astro` (`role="progressbar"
  aria-label={…}`).
- **Verify**: `npm run lint` + `npx playwright test` stay green (the growth spec locates stages by
  text, not by the marker, so nothing should move). The `sr-only` state words already carry the state,
  so this is additive.

## 3. Migration + handoff — record the deploy-ordering hazard (review F3)

- **Files**: `supabase/migrations/20260822120000_shift_log_add_earned.sql` (header comment only — do
  **not** touch the applied DDL) and this change's `handoff.md` merge notes.
- **Problem**: `appendShiftLog` now names `earned` in its insert and still swallows its error by
  design. Deploying the app to an environment where the migration has not run makes **every**
  `shift_log` insert fail — shifts, purchases, weekly report, activity feed — with zero signal
  anywhere. Reads fail loudly (`getWeeklyReport` throws); writes fail silently.
- **Required change**: Add a `-- DEPLOY ORDER:` line to the migration header stating that the
  migration must be applied **before** the app that writes `earned`, and why (the swallow). Repeat it
  wherever the deploy checklist lives.
- **Explicitly NOT in scope**: adding logging to `appendShiftLog`. The plan's *What We're NOT Doing*
  excludes it, the project has no logging convention, and it changes shift-completion failure
  semantics — that belongs in its own change.

## 4. *(optional)* `StageRail.astro` — the connector is desktop-only (review F4)

- **File**: `src/components/child/StageRail.astro`, the connector `<span>` — today `:56-62`.
- **Problem**: `class:list={["mt-8 hidden … lg:block", …]}` hides the connector below `lg`. The plan's
  Phase-3 manual bullet contracted it "visible in both". The inline comment argues the vertical stack
  needs none, which is defensible — but it was decided in a code comment rather than recorded.
- **Required change**: pick one — either add a short vertical connector segment for the `<lg` stack,
  or promote the inline comment into a decision entry in `plan.md`'s `## Autonomous decisions` so the
  deviation is recorded where deviations are recorded. **Cosmetic; skipping is fine.**

## 5. `reports.ts` — document that `earned` is a practice-side quantity (review F5)

- **File**: `src/lib/services/reports.ts`, the doc block above `aggregateWeeklyReport` that already
  explains `Σ daily[].completed === Σ practice[*].completed`.
- **Problem**: `earned += row.earned ?? 0` runs before the seven-day frame filter, so `earned` sums
  every row in the `.gte` window (practice semantics), not only rows inside `weekDayKeys(now)` (daily
  semantics). Not a production bug — both derive from the same `now`, and the tile sits beside
  `tasksThisWeek`, which is also practice-derived — but a future reader may try to reconcile the tile
  against the chart.
- **Required change**: one sentence in that doc block naming `earned` as a practice-side quantity.

## 6. `growth.astro` — the decorative savings bar is missing `aria-hidden` (review F7)

- **File**: `src/pages/app/growth.astro`, the `<div class="bg-muted mt-2 h-2 …">` savings bar inside
  the next-upgrade card — today `:131-134`.
- **Problem**: both established copies of this bar carry `aria-hidden="true"` (`src/pages/app/start.astro`
  and `src/components/app/AppShell.astro`); this one does not.
- **Required change**: add `aria-hidden="true"` to the outer bar `<div>`.
- **Related note, no change required**: at `lg+` this page renders the savings bar **and** `nextText`
  twice (sidebar via `progressPercent`/`progressLabel`, plus this card) — the same shape `start.astro`
  already has. Any future e2e touching that copy must scope its locator rather than rely on
  uniqueness.

## 7. `growth.astro` — `world.name` three times in the accessibility tree (review F8)

- **File**: `src/pages/app/growth.astro` — `subtitle={world.name}` (`:62`), the hero
  `<p>{world.name}</p>` (`:83`), and `ShopArt`'s `alt={world.name}`.
- **Problem**: three copies of one name on one screen (`upgrades.astro` has two). No locator uses it
  today, but it is the ambiguity class the run's brief guards against.
- **Required change**: pass `alt=""` to the hero art on this screen — the name is adjacent visible
  text, so nothing is lost.

---

## Recorded and deliberately NOT actioned

- **The two `alter table` statements in the migration** (review F6). Folding them into one statement
  would be marginally better, but the migration is already applied locally — **do not rewrite an
  applied migration in place.** Only worth doing if a fresh `supabase db reset` is happening anyway.
- **`E2E_PORT`'s placement in a feature branch** (review F9). Accepted: the change is correct,
  default-preserving, already committed, and load-bearing for this branch's own e2e numbers. A
  worthwhile *separate* improvement is `reuseExistingServer: false` whenever `E2E_PORT` is set, so the
  variable's purpose cannot be defeated by a stale server on the chosen port.
