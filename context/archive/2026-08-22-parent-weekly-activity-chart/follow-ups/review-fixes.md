# Follow-ups from the implementation review — `parent-weekly-activity-chart`

Source: `context/changes/parent-weekly-activity-chart/reviews/impl-review.md` (2026-08-23).

**None of these blocks the merge.** The review found **no CRITICAL finding**; all six suites are green
as observed by the reviewer (`check` 0 errors · `lint` clean · `build` Complete · `npm test` 346 ·
`npx playwright test` 17). No source file was edited by the review step. Each item below names the
file, the symbol and the required change so it can be picked up cold.

| # | Finding | File | Symbol | Priority |
|---|---|---|---|---|
| 1 | F1 | `tests/weekly-report-tiles.test.tsx` | new test case | do first — cheapest, closes the headline gap |
| 2 | F2 | `e2e/helpers/accounts.ts`, `e2e/parent-weekly-report.spec.ts` | `seedShiftWeek` | next, or fold into F4 |
| 3 | F3 | `e2e/CLAUDE.md`, `e2e/helpers/` | sanctioned-exceptions list | rule hygiene |
| 4 | F4 | `WeeklyActivityChart.tsx`, `WeeklyReport.tsx`, `pl.ts` | `<ul>` role/name, `chartDayValue` | accessibility |
| 5 | F5 | `WeeklyActivityChart.tsx` | `barStep` / `WEEK_LENGTH` | hardening |
| 6 | F6 | `src/lib/services/reports.ts` | `getWeeklyReport` | low, pre-existing |
| 7 | F7 | `src/data/activity.ts` | `stepDayKey` | opportunistic |
| 8 | F8 | `src/components/parent/WeeklyActivityChart.tsx` | line 1 | trivial |

---

## 1 — F1: assert the decomposition at render level (WARNING)

**File**: `tests/weekly-report-tiles.test.tsx`
**Symbol**: a new `it(...)` case; reuse the `week()` helper shape from `tests/weekly-activity-chart.test.tsx`

**Why**: AD-9's invariant — the seven bars add up to the *Ukończone zadania* tile — is proven at the
service boundary (`tests/reports.test.ts` → *"makes the bars a decomposition of the tasks tile"*) and
was proven once on a rendered page, but that page came from a temporary Playwright spec **deleted
before the Phase 6 commit**. Every fixture in `weekly-report-tiles.test.tsx` passes `EMPTY_WEEK`
(seven zeros) as `daily`, so no committed test renders a non-zero chart beside a non-zero tile.

**Required change**: build one `ChildReport` whose `practice` and whose `daily` describe the same
week (e.g. `math 8/13` + `money 5/…` with `daily` counts summing to the same total across all three
competencies), render `<WeeklyReport>`, then read the seven counts out of the chart's `sr-only` list
(`getByRole("list", { name: copy.chartHeading })`) and assert their sum equals the integer rendered in
the `statTasks` tile. ~12 lines. The test must fail if the two are made to disagree — verify by
breaking it once.

## 2 — F2: rebuild the `shift_log` seeder and land Risk E2E-3 (WARNING)

**Files**: `e2e/helpers/accounts.ts` (new helper), `e2e/parent-weekly-report.spec.ts` (new test)
**Symbol**: `seedShiftWeek(profileId: string, counts: number[]): Promise<void>`

**Why**: Phase 6 §3 (`plan.md:733`) defers Risk E2E-3 on the stated ground that *"`e2e/helpers/` has
no `shift_log` seeder"*. AD-12 then records that the implementer wrote one inside a temporary spec,
used it to seed `[8, 10, 14, 12, 16, 6, 8]`, screenshotted the result — and deleted it. The blocker
the plan named was removed and then thrown away; it exists in no commit and cannot be recovered.

**Required change**: add an admin-client (service-role) helper that inserts one `shift_log` row per
day of the current Warsaw week for a given profile, alongside the existing `seedChildProfile`. Then
add Risk E2E-3 to `e2e/parent-weekly-report.spec.ts`: seed a known week, land behind the PIN gate,
and assert the `statTasks` tile reads the seeded total **and** the seven `sr-only` list counts sum to
the same number. That single test closes both F1's residue and rows 4.7 / 4.8's seeded-week half.

**Alternative accepted by the plan**: leave it to F4 (`world-progression-stages`), which must touch
`shift_log` writes anyway — AD-10's reversal condition already anticipates exactly this. If that path
is taken, F4's plan should be told so explicitly, because it does not currently know it is expected
to fund an e2e seeder.

## 3 — F3: sanction the two `page.evaluate` measurements, or drop one (WARNING)

**Files**: `e2e/CLAUDE.md` (the closed list at `:10-19`), `e2e/parent-weekly-report.spec.ts:26,74`,
`e2e/helpers/`
**Symbol**: the `pageText` arrow at `:26`; the `overflow` measurement at `:74`

**Why**: `e2e/CLAUDE.md:10-19` says the DOM-access exceptions are a *"closed list — do not extend it
by analogy"*. The plan's Phase 6 §2 extends it by analogy (*"a measurement is not an element
locator"*) — the same argument that exception 1 (`waitForIslands`) still needed an explicit entry to
make. These are the first `page.evaluate` DOM reads in a spec rather than a helper.

**Required change**: either (a) move both measurements into `e2e/helpers/` beside `waitForIslands` and
add a fourth numbered entry to `e2e/CLAUDE.md`'s sanctioned list naming them — a page-text scan for
`NaN` and a horizontal-overflow measurement — or (b) replace the `NaN` scan with the pure locator form
`await expect(page.getByText(/NaN/)).toHaveCount(0)` and sanction only the overflow measurement, which
has no locator equivalent. **Note `e2e/CLAUDE.md` is outside this change's file set**, which is why the
review did not edit it; the change belongs to whoever owns the e2e rules.

## 4 — F4: harden the chart's accessible name and give the counts a unit (WARNING)

**Files**: `src/components/parent/WeeklyActivityChart.tsx:128-136`,
`src/components/parent/WeeklyReport.tsx:177-180`, `src/i18n/pl.ts:433`
**Symbols**: the `sr-only <ul>`; the chart heading `div`; `t.report.chartDayValue`

**Why**: the seven values genuinely reach a screen reader — this is a real DOM list, not a token
`aria-label`, and AD-8's choice was right. But the list's *name* comes from `aria-label` on a `<ul>`,
and Tailwind v4 preflight sets `list-style: none` on every `ul`, the long-standing trigger for
Safari/VoiceOver dropping list semantics — and with the role gone, the author-supplied name goes with
it. Separately, `"{day}: {count}"` renders `"Poniedziałek: 8"`, which never says *8 of what*.

**Required change**:
1. Add `role="list"` to the `sr-only <ul>` — explicit role survives `list-style: none`.
2. Give the heading `div` in `WeeklyReport.tsx:177` an `id` (e.g. `chart-heading-${profileId}`, since
   the card repeats per child) and replace the list's `aria-label` with `aria-labelledby` pointing at
   it. Better supported than `aria-label` on a container, ties the visible and accessible names
   together, and adds nothing to the page's heading tree — so the existing `getByRole("heading")` e2e
   locators stay intact, which is why the rejected `<h3>` is still the wrong answer.
3. Change `chartDayValue` to carry a unit via `tasksDone()` (`src/i18n/index.ts:43`), which already
   handles Polish plurals: `"8 zadań"` / `"1 zadanie"`. This is a copy change — route it through the
   open native-speaker review in
   `context/archive/2026-07-06-minimal-parent-weekly-report/follow-ups/copy-review.md` rather than
   deciding the wording unilaterally.

Update `tests/weekly-activity-chart.test.tsx`'s `getByRole("list", { name: … })` assertion to match,
and keep it asserting on a name — the assertion is what stops the name being dropped entirely.

## 5 — F5: one source of truth for "which of seven" (OBSERVATION)

**File**: `src/components/parent/WeeklyActivityChart.tsx:63, 96, 113, 121, 132`
**Symbol**: `barStep`, and the `day.weekday` index lookups

**Required change**: `barStep` derives from `days.length` while every x-position and both dictionary
lookups index by `day.weekday`. Pick one: either introduce `const WEEK_LENGTH = 7`, derive geometry
from it, and assert/narrow `days.length === 7`, or index consistently by array position. No current
defect — the service contract guarantees seven Monday-first entries — but a relaxed contract would put
bars off-plot and emit `"undefined: 3"` into the `sr-only` list, which the existing
`not.toMatch(/undefined/)` assertion would not catch because it only runs on well-formed fixtures.

## 6 — F6: the week query has no row ceiling (OBSERVATION, pre-existing)

**File**: `src/lib/services/reports.ts:167-173`
**Symbol**: `getWeeklyReport`'s query chain

**Required change**: `supabase/config.toml:18` sets `max_rows = 1000`; PostgREST truncates there
**silently**, and since the query orders ascending, the rows dropped are the newest. Add an explicit
`.limit(1000)` and treat a full page as a signal (log it, or surface the same honest error card the
file's own comment demands), or aggregate server-side. Unreachable at v1 volumes; raised because this
change turns the symptom from "a slightly low count" into "a chart whose last bars are visibly short".
**Not the same question as AD-7** (an upper `.lt` bound), which was decided correctly. Touch with care:
`reports.ts` is a live contention point between F1, F2 and F4.

## 7 — F7: export a shared `stepDayKey` (OBSERVATION)

**Files**: `src/data/activity.ts:59-71` (`previousDayKey`, `pad2`), `src/lib/services/reports.ts:134-152`
(`weekDayKeys`)

**Required change**: **AD-5 is fully honoured — this is not a second timezone implementation**, and
`weekDayKeys` correctly uses `warsawDayKey` plus pure calendar stepping. But it copies
`previousDayKey`'s `Date.UTC(y, m-1, d ± n)` idiom and redeclares a local `pad2` that `activity.ts`
already has. Both were module-private, so the copy was forced. Export
`stepDayKey(key: string, offset: number): string` from `src/data/activity.ts` and let both call sites
use it. Opportunistic — a cross-branch edit right now costs more than it saves; do it when one of
those files is open for another reason.

## 8 — F8: delete the dead React import (OBSERVATION)

**File**: `src/components/parent/WeeklyActivityChart.tsx:1`

**Required change**: delete `import React from "react";`. `tsconfig.json` sets `"jsx": "react-jsx"`,
so it is dead, and it is the one new `ts(6133)` hint this change adds to `npm run check`.
`SkillBars.tsx` and most of `src/components/` omit it. One line.
