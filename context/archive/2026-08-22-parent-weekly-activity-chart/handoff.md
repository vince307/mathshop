# Handoff — `parent-weekly-activity-chart` (F1)

> **Read first:** `context/runs/2026-08-22-autonomous-five/agent-contract.md` — the standing brief
> for this run. No human in the loop; decide, record under `## Autonomous decisions`, continue.

**Status:** `impl_reviewed` · **Next command:** none — **the feature is done.**
**Branch:** `feat/parent-weekly-activity-chart` — **stacked on `feat/dashboard-recent-activity` (F2)**.
**F2 MUST MERGE FIRST**, or this branch merges as a superset of it. See *Branching* below.

---

## The review, in one paragraph

`/10x-impl-review` ran on all six phases against
`git diff feat/dashboard-recent-activity..feat/parent-weekly-activity-chart` (7 commits,
`ec47dd1` → `e8827d6`). Verdict **NEEDS ATTENTION: 0 critical, 4 warnings, 4 observations.**
**Nothing blocks the merge** — the branch is mergeable as-is once F2 lands. No source file was edited
by the review step; there was no CRITICAL finding to fix. All eight findings are recorded in
`follow-ups/review-fixes.md` with file, symbol and required change, ordered by what to do first.
Full report: `reviews/impl-review.md`.

| Dimension | Verdict |
|---|---|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING (F3, F4, F8) |
| Success Criteria | WARNING (F1, F2) |

## Verification — re-run by the reviewer, not accepted from the implementer

| Check | Claimed | Observed on `e8827d6` |
|---|---|---|
| `npm run check` | 0 errors, 0 warnings, 9 hints | **0 / 0 / 9** (173 files) ✅ |
| `npm run lint` | clean | **clean**, exit 0 ✅ |
| `npm run build` | Complete! | **Complete!** ✅ |
| `npm test` | 346 / baseline 318 | **44 files, 346 passed** ✅ |
| `npx playwright test` | 17 / baseline 15 | **17 passed**, both new specs green ✅ |

The 318 baseline could not be re-measured (switching branches is forbidden in this tree) but
reconciles arithmetically: the diff adds 11 + 6 + 6 + 5 = **28** tests, and 346 − 28 = 318.
Every implementer claim held up. Local Supabase was up, so `tests/report-isolation.test.ts` ran for
real inside the 44 files.

## What the review confirmed (the five commissioned checks)

1. **AD-9 — the bars really do decompose the tile.** The invariant test is real and goes red on
   divergence, and the invariant also holds *structurally*: `addSkillDelta` and `readSkillState`
   apply the identical `safeCount` to the identical field, so the two sides cannot drift for any
   input, including `null` and non-object payloads. **Gap (F1):** no *committed* test renders a
   non-zero chart beside a non-zero tile — the "74 on the tile, seven bars summing to 74" evidence
   lived in a spec that was deleted.
2. **AD-2 — `math + money` only.** Two independent tripwires go red if `decisions` creeps back in.
3. **AD-3 — `0/0` renders `—`, never `NaN%`.** The fix is right (the `sr-only` reason is a sibling of
   the value `<p>`) and the assertion was **not** weakened. Note: the jsdom assertion would not have
   caught the original bug — testing-library reads only direct text children — so the committed
   Playwright `{ exact: true }` assertion is the *only* guard. Do not remove it.
4. **AD-5 — one Warsaw implementation.** `reports.ts` imports F2's `warsawDayKey`; a grep of `src/`
   finds **no new offset arithmetic anywhere in the diff**. `weekDayKeys` steps civil-date *keys*, is
   tested across the 25-hour fall-back weekend, and `zoneOffsetMinutes` stays the single private
   offset parser with a "do not re-implement" comment. This was the highest-value check and it is clean.
5. **AD-1 — gated, and the corrected argument.** The tile ships behind the PIN gate; every reference
   to the child-side link in the diff is the corrected version naming `AppShell.astro:65,120-130`.
   No source comment repeats the false claim.

**Earnings tile: absent** in every form. `package.json` untouched — no charting library, no date
library. Checked against the real mockup
(`assets/matmaverse-missing-screens-v3-web/05-parent-weekly-report-web.png`): four tiles there, three
here, and the chart's shape is faithful (heading, `0 4 8 12 16` ticks, per-bar value labels,
`Pon…Nd`, swatched legend). The `pl.ts` comment is accurate about what remains deferred.

**Accessibility, judged honestly.** This is **not** a token `aria-label`: the `<svg>` is
`aria-hidden` and a real `sr-only <ul>` carries seven `<li>` day/count pairs, so a parent using a
screen reader genuinely gets all seven values. Two real weaknesses (F4): the list's *name* rests on
`aria-label` on a `<ul>`, and Tailwind preflight's `list-style: none` is the classic
Safari/VoiceOver trigger for dropping list semantics along with that name; and `"Poniedziałek: 8"`
never says *8 of what*.

## The findings (all in `follow-ups/review-fixes.md`)

**Warnings — recommended, not blocking**

- **F1** `tests/weekly-report-tiles.test.tsx` — every fixture passes seven zeros as `daily`, so the
  on-screen decomposition is untested. ~12 lines to close.
- **F2** The deleted temporary spec **built the `shift_log` seeder** whose absence was Phase 6 §3's
  stated reason for deferring Risk E2E-3 — and it was thrown away instead of promoted to
  `e2e/helpers/`. **Verdict on AD-12's evidence quality: the honesty is exemplary and the method was
  sound; the disposal was the mistake.** Rows 1.6 and 3.5 are correctly flagged as inspection-based
  and inspection is the right instrument for both. Rows 4.6 / 5.8 / 6.4 *are* covered by committed
  e2e; rows 4.7 and the seeded-week half of 4.8 are not, and now cannot be reproduced.
- **F3** `e2e/parent-weekly-report.spec.ts:26,74` add two `page.evaluate` DOM reads without amending
  `e2e/CLAUDE.md`'s explicitly **closed** exception list. The plan's "a measurement is not a locator"
  is exactly the analogy that list forbids.
- **F4** Chart accessible name + missing unit on the `sr-only` counts (above).

**Observations** — F5 chart geometry mixes `days.length` with `day.weekday`; F6 the week query has no
`.limit()` against `max_rows = 1000` (pre-existing, but truncation now shows as a visibly wrong
chart); F7 `weekDayKeys` copies `previousDayKey`'s calendar-step idiom (**not** a timezone duplicate —
AD-5 is honoured); F8 a dead `import React` adds the one new `ts(6133)` hint.

## Branching — read before merging

**`feat/parent-weekly-activity-chart` was cut from `feat/dashboard-recent-activity`, not from
`feat/ui-polish`** — a deliberate exception forced by the plan's hard prerequisite that
`src/data/activity.ts` exist on the base branch so F1 can *import* `warsawDayKey` (AD-5 / review N9).
This branch therefore contains **F2's six commits as well as F1's seven**.

- **Merge F2 first**, or merge this branch as a superset of it.
- If F2 is ever abandoned, F1 must be **rebased onto `feat/ui-polish` with `src/data/activity.ts`
  moved with it** — `warsawDayKey` must not be re-implemented.
- The unit baseline on this branch is **318**, not the run contract's 299.

## What the next reader must know

1. **F4's "Handed to F1" recipe is stale and F1 could not fix it** (`plan.md` → Known risks 7).
   F4 (`context/changes/world-progression-stages/plan.md:458+`) expects a **2-tile** `grid-cols-2`
   grid and says to apply `grid-cols-2` → `sm:grid-cols-3`. It will find a **3-tile** grid already
   classed `grid-cols-2 sm:grid-cols-3`, so applying that line verbatim leaves a **3 + 1 orphan tile
   row**. It also string-matches `.select("skills, upgrade_purchased")`, now
   `.select("created_at, skills, upgrade_purchased")`, and cites the `pl.ts` comment at `:394-396`,
   which is at `:411-418` and which F1 already rewrote. **The F4 implementer must read F1's
   correction table before applying that recipe.** If F4 also takes follow-up 2, it inherits the e2e
   seeder — say so explicitly, because F4's plan does not currently know it is expected to fund one.
2. **`ShiftLogRow` and `RecentActivityRow` now differ only by `id`.** Do **not** merge them — F2
   pre-registered that "helpful simplification" as its own risk R2.
3. **A child-side link to `/app/report` ships on every child screen** (`AppShell.astro:65`,
   `:120-130`). The PIN gate (`report.astro:22-29`) is the only thing between a child and the
   first-try tile, and it is soft: 4 digits, 15-minute TTL, one tap away. AD-1's reversal condition
   should be read as already half-true on the navigation axis.
4. **AD-1 is a scope override of a PRD-deferred tranche**, authorised by this run's feature brief, not
   by a PRD edit. `prd-v3.md:172` and `roadmap.md:294` still read as parked; neither was edited unasked.
5. **`statTasks` and `statFirstTry` do not reconcile on screen** — same noun, different populations.
   Routed to the open native-speaker copy review with the question stated.
6. **Two `"Europe/Warsaw"` constants** remain (`reports.ts` `REPORT_TIME_ZONE`, `activity.ts`
   `ACTIVITY_TIME_ZONE`). A constant, not logic; collapsing it is a third change.
7. The ten new Polish keys ship **unreviewed** and are on the copy-review checklist
   (`context/archive/2026-07-06-minimal-parent-weekly-report/follow-ups/copy-review.md`). Follow-up 4
   adds a wording question to that same list rather than deciding it unilaterally.

## Environment traps (already paid for — do not rediscover)

- The command sandbox blocks `127.0.0.1:54321`; run `npm test` and `npx playwright test` with the
  sandbox disabled or ~30 tests fail for unrelated reasons.
- A stray dev server on 4321/4322 makes four `gameplay-restore` Playwright runs fail spuriously.
- Local Supabase must be up (`npx supabase status`) for the e2e suite and for
  `tests/report-isolation.test.ts`.

## Next command

**None — the feature is done.** `/10x-e2e parent-weekly-activity-chart` is **not** warranted: the
browser layer already went 15 → 17 and covers both risks the plan reserved for it (island hydration
and the 390 px overflow guard), and the one browser-level risk still undriven — a *seeded* week
drawing non-zero bars (Risk E2E-3) — is blocked on an `e2e/helpers/` `shift_log` seeder that does not
exist, which is precisely what follow-up 2 asks for. Running `/10x-e2e` before that helper exists
would re-derive the same "no seeder" conclusion the plan already reached.

Remaining work is the eight items in `follow-ups/review-fixes.md`. Follow-up 1 (~12 lines of test) is
the cheapest and closes the only real gap in the feature's headline invariant; take it first if
anything is taken at all. Otherwise: merge F2, then merge this.

---

## Pointer from F4 `world-progression-stages` (appended 2026-08-23)

- `shift_log.earned` now exists (`supabase/migrations/20260822120000_shift_log_add_earned.sql`) —
  nullable, no backfill. F4 also **shipped the parent weekly earnings tile itself** (the "Handed to
  F1" recipe in `context/changes/world-progression-stages/plan.md`), because F1 had already landed by
  the time F4 was implemented.
- The tile's gate is scoped to **shift** rows: `r.upgrade_purchased === null && r.earned == null`.
  A purchase row is `earned: null` forever by design; an unscoped predicate would hide the tile in
  every week the child buys anything. See F4's plan, D-1a.
