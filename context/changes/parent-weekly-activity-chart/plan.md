# Parent weekly activity chart + first-try tile — Implementation Plan

> Change: `parent-weekly-activity-chart` (run F1, `context/runs/2026-08-22-autonomous-five/`)
> Research (ground truth, read first): `context/changes/parent-weekly-activity-chart/research.md`
> Brief: `context/changes/parent-weekly-activity-chart/plan-brief.md`

## Overview

Add two things to the PIN-gated parent weekly report (`/app/report`), per
`assets/matmaverse-missing-screens-v3-web/05-parent-weekly-report-web.png`:

1. A **Monday–Sunday activity bar chart** inside each child's report card — the daily
   decomposition of the "Ukończone zadania" tile already shown above it.
2. A **first-try tile** — the share of this week's tasks the child got right with no wrong
   taps, computed over `math + money` only.

Both are built **entirely from data already stored**. No migration, no new query, no new
dependency, no charting library. The mockup's third KPI ("+84 zł zdobyte w tym tygodniu") is
**not** in scope — see "What We're NOT Doing".

## Current State Analysis

Established by `research.md`; not re-derived here.

- `aggregateWeeklyReport` (`src/lib/services/reports.ts:37-47`) already folds the week's
  `shift_log.skills` deltas into `practice[competency] = { firstTryCorrect, completed, misses }`.
  **The percentage tile therefore needs no new data and no `skill_state` read** — `skill_state`
  is lifetime-cumulative and cannot yield a weekly figure (research → "Discrepancy A").
- The week query (`reports.ts:107-112`) filters and orders on `created_at` but **never projects
  it** (`.select("skills, upgrade_purchased")`), so no per-row day key reaches memory. Widening
  the projection is the whole of the data work; bucketing is a second fold over the array already
  in hand — zero extra round trips, and `shift_log_profile_created_idx (profile_id, created_at)`
  already covers the access path.
- `startOfWeek(now)` (`reports.ts:75-92`) is exported and DST-correct. `REPORT_TIME_ZONE`
  (`:50`) and `zoneOffsetMinutes` (`:55`) are **module-private**. There is **no `endOfWeek`** and
  the query has no upper bound.
- `shift_log` RLS is **account-scoped, not profile-scoped**
  (`supabase/migrations/20260701150000_create_shift_log.sql:38-63`, every policy
  `auth.uid() = account_id`). The `.eq("profile_id", profileId)` at `reports.ts:110` is the
  **only** thing separating siblings inside one account.
- Every upgrade purchase writes `decisions: { firstTryCorrect: 1, completed: 1, misses: 0 }`
  (`src/lib/services/child-profiles.ts:243`) — a term that is 100% by construction.
- `0 / 0` → `NaN` → renders literally as `NaN%`. There is no guard today. The in-repo precedent
  is `src/data/shift.ts:90` (`if (taskCount <= 0) return 0;`).
- **There is zero hand-rolled `<svg>` in `src/`** and no charting library in `package.json`. The
  house bar pattern is div-based with explicit ARIA (`src/components/child/SkillBars.tsx:28-37`).
  `sr-only` has exactly one precedent: `src/components/child/HudChip.tsx:15`.
- **No weekday names exist anywhere in the repo.** They are net-new i18n content.
- The tile grid in `src/components/parent/WeeklyReport.tsx:139` is hard-coded `grid-cols-2`.
- Test surface: a **new top-level field on `WeeklyReport` breaks zero assertions** (no whole-object
  `toEqual` exists). A **required `created_at` on `ShiftLogRow` does** break
  `tests/reports.test.ts:13-15` and `:39`, and fails `npm run check`. A **new chained filter
  method** breaks `stubClient` (`tests/reports.test.ts:18-26`, only `select/eq/gte/order`, only
  `order` thenable).
- A prior change **deliberately parked the whole of this mockup's dashboard content — the daily bar
  chart included, not only the percentage tile** — on **scope** grounds: prd-v3's true non-goal
  "No full parent dashboard" (`context/foundation/prd-v3.md:161`) plus the deferred tranche
  "Richer parent report" (`:172`, `context/foundation/roadmap.md:294`). The non-shaming-guardrail
  objection to a "% correct" tile is a **parenthetical aside** in the same sentence, not the
  load-bearing reason (`context/archive/2026-07-06-minimal-parent-weekly-report/frame.md:36`).
  See "Autonomous decisions" → AD-1.

## Desired End State

Opening `/app/report` behind the parent PIN, for each child card:

- A **"Aktywność w tym tygodniu"** sub-section showing seven bars (Pon…Nd, Monday-first,
  Europe/Warsaw), each labelled with its count, with horizontal gridlines and a legend — and a
  screen-reader-readable list of the same seven day/count pairs.
- A third summary tile, **"Zadania bez pomyłki"**, showing e.g. `62%`, or `—` when the child has
  not completed a `math`/`money` task this week. **`NaN%` is unreachable.**
- A week with no activity at all shows the chart section heading plus one calm Polish line
  instead of an empty axis.
- Nothing else on the page changes. The existing `<h1>` "Raport tygodniowy" locator, the PIN gate,
  and the deletion chain are untouched.

Verification: `npm run check` · `npm run lint` · `npm run build` clean; `npm test` ≥ 299 (baseline
may only go up); `npx playwright test` 15/15 plus whatever Phase 6 adds.

### Key Discoveries

- `src/lib/services/reports.ts:107-112` — one word (`created_at` in `.select()`) unlocks the chart.
- `src/lib/services/reports.ts:50,55` — the Warsaw primitives to build **on**, never to duplicate.
  They stay module-private (review R2); the two new helpers sit beside them.
- `src/components/parent/WeeklyReport.tsx:139-148` — the tile recipe and the `grid-cols-2` to widen.
- `src/components/parent/WeeklyReport.tsx:150-169` — the sub-section recipe the chart must match
  (`<div className="mt-5">` + a `text-muted-foreground flex items-center gap-2 text-sm font-semibold`
  heading row + a `lucide-react` icon at `size-4`).
- `src/data/skills.ts:16` `COMPETENCIES`; `:56-88` `readSkillState` / `addSkillDelta` — the pure,
  dependency-free module where the ratio belongs.
- `tests/task-guardrail.test.tsx:1` — the `// @vitest-environment jsdom` pragma pattern for
  component tests.

## What We're NOT Doing

- **The "+84 zł zdobyte w tym tygodniu" tile does not ship.** Not as a placeholder, not as a zero,
  not as an estimate. `recordShiftResult` computes `earned` (`child-profiles.ts:170`), folds it into
  `wallet_balance`, returns it, then **discards it** — `appendShiftLog` inserts a fixed four-column
  set with nowhere to put it (`:126-137`, `:187`). The tile is blocked on a **column**, not on a
  calculation. It belongs to **F4 `world-progression-stages`**, which owns that migration. (F4 uses
  `earned integer null` with no backfill — `world-progression-stages/plan.md` D-1; a bare `not null`
  would break `appendShiftLog` and three test files, research → Constraints §1.)

  **What F4's "Handed to F1" recipe will actually find, once F1 has landed (review N2).** F4's
  recipe (`world-progression-stages/plan.md:458+`) was written against the *pre-F1* file and is
  stale in three places. It is **not** simply "additive"; the corrections are:

  | F4 recipe says | After F1 it is actually | What F4 must do |
  |---|---|---|
  | `WeeklyReport.tsx:139-148` is a **2-tile** grid; change `grid-cols-2` → `sm:grid-cols-3` | a **3-tile** grid already classed `grid-cols-2 sm:grid-cols-3` | the earnings tile is the **fourth**. `sm:grid-cols-3` would render 3 + 1 orphan. F4 re-classes to `grid-cols-2 lg:grid-cols-4` (two-up on a phone, four-up only where there is room — at 640 px four tiles give ≈ 32 px of text width, which fails the same arithmetic that ruled out a bare `grid-cols-3`, review R3) |
  | replace the literal `.select("skills, upgrade_purchased")` | `.select("created_at, skills, upgrade_purchased")` | append `, earned` to whatever the string then is; do not string-match the old value |
  | `ShiftLogRow` (`:13-16`) gains `earned?: number \| null` — **optional**, or `row()` stops compiling | `ShiftLogRow` has a **required** `created_at` and `row()` supplies it from `IN_FRAME_CREATED_AT` | `earned` still optional — F4's reason is unchanged and correct |
  | the stale `pl.ts` comment is at `:394-396` | it is at `:411-414`, and **F1 Phase 3 has already rewritten it** to say only the earnings tile remains deferred | F4 rewrites that same block again to drop the deferral sentence |

  Nothing in F1 has to be *undone* — but F4's grid class and its `.select()` string do have to be
  re-derived rather than applied verbatim. Recorded under `## Known risks`; the handoff flags it so
  the F4 implementer sees it.
- **No migration, no RLS work.** L-001 does not fire. Everything needed is already stored.
- **No charting library.** No `recharts` / `chart.js` / `d3` / `victory` / `visx` / `nivo` /
  `apexcharts`, and no date library — `Intl` only, as the prior change decided
  (`context/archive/2026-07-06-minimal-parent-weekly-report/plan.md:24`).
- **No week-over-week deltas** (`+4 więcej niż tydzień temu`, `+6%`), no `Zapasy` competency, no
  week-range picker, no child selector, no "Eksportuj raport", no "Świetny wynik!" verdict line. The
  mockup draws all of these; none has a data source, and the verdict line is a judgement (AD-1).
- **No `.lte` / `.lt` upper bound on the query** and no `endOfWeek` export. Adding a chained filter
  would break `stubClient` and collide with F2's rebase for no reachable benefit (see AD-7).
- **No `data-testid`.** `e2e/CLAUDE.md:7-9` makes needing one a product finding to surface first.
- **No changes to what `statTasks` counts.** Its semantics (all three competencies) stay as shipped.
- **No edit to `docs/reference/contract-surfaces.md`** (review R9). Its `## public.shift_log` section
  already lists `created_at` under **Columns** (`:31`) and `src/lib/services/reports.ts` under
  **Consumed by** (`:38`); F1 changes neither the schema nor the consumer set, only which columns one
  existing consumer projects. Leave it alone — F2 appends to that same `:38` line, and a helpful
  edit here buys a same-line conflict for no information gain.

## Implementation Approach

Six commit-sized phases, each independently green:

1. **Service** — project `created_at`, add two Warsaw day-frame helpers beside the existing private
   primitives, bucket the week into a fixed seven-day frame, put `daily` on `WeeklyReport`.
   Pure-function work, unit-tested without a DB.
2. **Ratio** — a pure `firstTryPercent` helper in `src/data/skills.ts`, over `math + money` only,
   returning `null` (never `NaN`, never a misleading `0`) when the denominator is zero.
3. **i18n** — every new Polish string, plus rewriting the now-stale comment at `pl.ts:411-414`.
4. **Chart component** — the project's first `<svg>`, plus its jsdom test.
5. **Tile** — the third summary tile and the widened grid, plus its jsdom test.
6. **Browser** — the one risk that genuinely needs a real browser, handed to `/10x-e2e`.

Phases 1–3 ship no user-visible change; 4–5 turn them on. That ordering means a broken phase can be
committed and reverted without ever putting a half-rendered card in front of a parent.

## Critical Implementation Details

**Same `now` for the window and the frame.** `getWeeklyReport` must pass the *same* `now` instant to
`startOfWeek(now)` and to `aggregateWeeklyReport(..., now)`. If the query window and the bucket frame
are computed from two different instants, a request straddling Sunday→Monday midnight silently drops
rows from the chart while still counting them in `practice`.

**Bucket by Warsaw civil date string, not by offset arithmetic.** Formatting each row's `created_at`
into a `YYYY-MM-DD` Warsaw civil date with `Intl.DateTimeFormat` and matching it against seven
pre-computed frame dates is DST-proof by construction and touches no offset maths at all. Deriving a
day index from millisecond deltas is the version that breaks on the last Sunday in October.

**That formatter already exists — do not write a second one (review R14).** While this plan was in
review, F2 landed `src/data/activity.ts` (commit `e40d650`), which exports
`warsawDayKey(instant: Date): string` — the `YYYY-MM-DD` Europe/Warsaw civil date, assembled from
`Intl.DateTimeFormat("en-CA", …).formatToParts`, in a pure dependency-free module
(`src/data/activity.ts:42-57`), alongside `ACTIVITY_TIME_ZONE` (`:18`) and a `previousDayKey`
calendar-stepper (`:59-71`) whose UTC-arithmetic idiom `weekDayKeys` should mirror. That is exactly
the helper Phase 1 was going to add. `reports.ts` already imports from `@/data/skills` and
`@/data/upgrades`, and `activity.ts` imports only `@/data/skills`, so there is no cycle.

**Branch sequencing this creates — now a hard prerequisite, not a preference (review N9).** F2's
work is on `feat/dashboard-recent-activity`; the run contract cuts feature branches from
`feat/ui-polish`, where `src/data/activity.ts` does not yet exist. **`feat/parent-weekly-activity-chart`
is cut from `feat/ui-polish` only AFTER F2 has landed there.** F1 has not begun, so the wait costs
nothing, the duplicate never exists, and the import path in Phase 1 §3 is the only path an
implementer can take. The pre-merge fallback (a local `warsawCivilDate` plus a mandatory dedupe at
merge) is retained in Phase 1 §3 **only** as a contingency if that sequencing is overruled; do not
choose it while the prerequisite can be met.

**F2 contention on `src/lib/services/reports.ts` — now live, not hypothetical.** F2 has appended
`RecentActivityRow` and `listRecentActivity` **at the EOF of this same file** (`reports.ts:117-160`).
F1 therefore lands **second**. Keep every edit here **additive** and **away from EOF**: extend
`aggregateWeeklyReport`, widen the `.select()` string, insert new helpers immediately after
`aggregateWeeklyReport` (`:47`) or after `startOfWeek` (`:92`). **Do not** restructure, rename,
reorder, or reformat around existing code, and do not touch the `stubClient` chain shape (F2 left
`tests/reports.test.ts` untouched by design and wrote its own thenable stub in
`tests/recent-activity.test.ts` — keep it that way). Note also that after F1 adds `created_at`,
`ShiftLogRow` (`:13-16`) and `RecentActivityRow` (`:118-123`) differ only by `id`; **do not** merge
them — F2 pre-registered that "helpful simplification" as its own risk R2.

## Phase 1: Project `created_at` and bucket the week into seven days

### Overview

Give the aggregate a time dimension. One column added to the projection, one field added to the
report shape, two Warsaw primitives made public, and a pure day-bucketing fold.

### Changes Required

#### 1. The report shape

**File**: `src/types.ts`

**Intent**: Add a serializable per-day series to `WeeklyReport` so the chart is prepared server-side
and crosses the SSR→island boundary as plain JSON (`report.astro:59` is `client:load`; a `Date`
object would not survive).

**Contract**: New exported `interface WeeklyReportDay { date: string; weekday: number; completed: number }`
— `date` is a Warsaw civil date `YYYY-MM-DD`, `weekday` is `0` = Monday … `6` = Sunday, `completed`
is the day's summed `completed` across all three competencies. `WeeklyReport` gains
`daily: WeeklyReportDay[]`, **always exactly seven entries, Monday-first, zero-filled**. Document the
"always 7, zeros included" invariant in the doc comment — the chart depends on it and never
null-checks. Adding a top-level field to `WeeklyReport` breaks zero existing assertions
(research §8).

#### 2. The row shape and the query

**File**: `src/lib/services/reports.ts`

**Intent**: Project the column the chart needs and keep the sibling-isolation filter that RLS does not
provide.

**Contract**: `ShiftLogRow` gains a required `created_at: string`. The `.select()` becomes
`"created_at, skills, upgrade_purchased"`. **`.eq("profile_id", profileId)`, `.gte(...)` and
`.order(...)` are unchanged and no chained method is added** — this keeps `stubClient` valid and
keeps sibling profiles separated (RLS is account-scoped only). `getWeeklyReport` threads its `now`
into `aggregateWeeklyReport`.

#### 3. The Warsaw primitives

**File**: `src/lib/services/reports.ts`

**Intent**: Add the day-frame helpers **on top of** the single existing Warsaw implementation, so no
second offset parser is opened — a duplicate offset parser is a bug waiting for a DST weekend.

**Contract**: `REPORT_TIME_ZONE` and `zoneOffsetMinutes` **stay module-private**. Neither F1 nor F2
imports them (review R2: F2 deliberately builds its own zone constant + civil-date formatter in
`src/data/activity.ts` and refuses to depend on a service module — `dashboard-recent-activity/plan.md:298-301,342-344`),
so promoting them to `export` would add two dead-API hunks to the file F1 and F2 both edit. A later
change that genuinely needs them promotes them then.

**The civil-date formatter is imported, not written (review R14).** `src/data/activity.ts:48`
already exports `warsawDayKey(instant: Date): string` — the same `YYYY-MM-DD` Europe/Warsaw civil
date this phase needs, in a pure dependency-free module, shipped by F2 in commit `e40d650`.

- **If F1's base branch has `src/data/activity.ts`** (i.e. F2 has merged — the preferred sequencing):
  `reports.ts` adds `import { warsawDayKey } from "@/data/activity";` and **adds no civil-date helper
  of its own**. This is the only path that satisfies AD-5 as written.
- **If F1 must start before F2 merges:** add a local `warsawCivilDate(instant: Date): string` with
  identical behaviour, and record a **mandatory dedupe at merge** — delete it, import `warsawDayKey`
  — in the handoff. Do not let the duplicate survive the merge.

One new export either way, **inserted immediately after `startOfWeek` (`reports.ts:92`) — never at
EOF**, which is where F2 has already appended `listRecentActivity` (review R4):

- `weekDayKeys(now: Date): string[]` — exactly seven `YYYY-MM-DD` strings, Monday-first, derived by
  formatting `new Date(startOfWeek(now))` through the civil-date helper and adding 0–6 **calendar**
  days to those civil components. Mirror the UTC-arithmetic idiom of `previousDayKey`
  (`src/data/activity.ts:67-71`) rather than inventing a third one — no offset maths, because the
  day frame is a calendar question, not an instant question.

A note in `zoneOffsetMinutes`' doc comment that it is the project's only UTC-offset parser and must
not be re-implemented elsewhere.

#### 4. The fold

**File**: `src/lib/services/reports.ts`

**Intent**: Bucket the rows already in hand into the seven-day frame, in the same pass discipline as
the existing practice fold. Any new pure helper this needs goes **immediately after
`aggregateWeeklyReport` (`reports.ts:47`), never at EOF** — F2 appends its own exports at EOF and a
naive rebase would land both in one hunk (review R4).

**Contract**: `aggregateWeeklyReport(profileId, rows, now: Date = new Date())` — a **third,
optional** parameter, so no existing call site or test changes signature. It builds the frame from
`weekDayKeys(now)`, zero-fills seven buckets, and for each row adds
`math.completed + money.completed + decisions.completed` (normalised through `readSkillState`, so a
malformed `skills` jsonb contributes 0 rather than throwing) to the bucket whose key equals
`warsawDayKey(new Date(row.created_at))` (or the local `warsawCivilDate` on the pre-merge path —
Phase 1 §3). **A row whose civil date is not in the frame is skipped
for `daily` and still counted in `practice`** — behaviour of `practice` is unchanged (see AD-7).

#### 5. Tests

**File**: `tests/reports.test.ts`

**Intent**: Update the two places a required `created_at` breaks, and lock the new behaviour.

**Contract**: two paired module constants are added first — `const NOW = new Date("<fixed instant>")`
and `const IN_FRAME_CREATED_AT` (an ISO instant inside `weekDayKeys(NOW)`). `row()` (`:13-15`) takes
an optional `createdAt` defaulting to `IN_FRAME_CREATED_AT`; the inline object literal at `:39` gains
`created_at`. **Every assertion about `daily` passes `NOW` explicitly as the third argument** —
`aggregateWeeklyReport`'s `now` defaults to `new Date()`, so a fixed `createdAt` is *only* in frame
relative to a fixed `now`; a test that omits it silently asserts against an all-zero `daily`
(review R5). `stubClient` is **not** restructured (F2 rebase). New cases:

- seven buckets always, Monday-first, zero-filled, for an empty week;
- rows land in the right Warsaw day (a Sunday-23:30-UTC instant that is already Monday in Warsaw
  goes to the *next* week's frame, i.e. is skipped, not bucketed into Sunday);
- the fall-back DST week (Monday `2026-10-19`, i.e. `startOfWeek` → `2026-10-18T22:00:00.000Z`)
  buckets a `2026-10-25T22:30:00Z` row into index 6 (Sunday), proving the civil-date path survives
  the transition;
- **invariant**: for rows all inside the frame, `Σ daily[].completed === Σ practice[*].completed`
  (the bars are exactly a decomposition of the "Ukończone zadania" tile above them);
- an out-of-frame row is counted in `practice` but not in `daily`;
- `getWeeklyReport` still rejects on a query error (existing contract, must stay green);
- **isolation**: `getWeeklyReport` still calls `.eq("profile_id", …)` with the requested id — assert
  it by recording the chain calls in `stubClient` (add a recorder alongside, do not change the
  existing chain shape), so a future refactor that drops the filter goes red instead of leaking
  siblings.

### Success Criteria

#### Automated Verification

- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`
- Unit tests pass and the count went up, not down: `npm test` (≥ 299, `tests/reports.test.ts` ≥ 19)
- `tests/report-isolation.test.ts` still passes against the live local stack (`npx supabase status` up)

#### Manual Verification

- `/app/report` renders exactly as before — this phase is invisible to the parent

---

## Phase 2: The first-try ratio, with `decisions` structurally excluded

### Overview

One pure function, in the dependency-free module the client already imports. This is where the two
traps live: the `decisions` inflation and the `NaN%`.

### Changes Required

#### 1. The helper

**File**: `src/data/skills.ts`

**Intent**: Compute "share of this week's tasks nailed with no wrong taps" honestly, over the
competencies that can actually be got wrong.

**Contract**: Two new exports.

- `ACCURACY_COMPETENCIES: readonly Competency[] = ["math", "money"]` — a named constant, with a
  comment stating **why** `decisions` is absent: every purchase writes
  `{ firstTryCorrect: 1, completed: 1 }` (`child-profiles.ts:243`), so it is 100% by construction and
  including it makes the number rise with shopping instead of with learning.
- `firstTryPercent(state: SkillState): number | null` — **normalises its argument through
  `readSkillState(state)` first** (the house idiom, exactly as `skillLevelsFor` does at
  `skills.ts:113-119`), then sums `firstTryCorrect` and `completed` over `ACCURACY_COMPETENCIES`
  only; **returns `null` when the denominator is 0** (never `NaN`, never a misleading `0`);
  otherwise `Math.max(0, Math.min(100, Math.round((100 * num) / den)))` — the clamp-and-round idiom
  already used at `src/pages/app/start.astro:80` (the savings-percent clamp; the line moves with F2's
  start-screen edit, so match on the expression, not the number).
  The normalisation is what makes AD-3's "`NaN` is unreachable" a property of the **function**
  rather than of its single current call site: without it, a non-finite numerator survives the
  clamp (`Math.max(0, Math.min(100, Math.round(NaN)))` is `NaN`) and any future caller passing a
  raw jsonb-shaped object cast to `SkillState` reintroduces `NaN%` (review R6).

Placed here rather than in `reports.ts` for two reasons: `src/data/skills.ts` is the pure,
dependency-free home of `COMPETENCIES` and the skill maths and is already imported by client
islands, and keeping it out of `reports.ts` shrinks the F2 conflict surface.

#### 2. Tests

**File**: `tests/skills.test.ts`

**Contract**: New `describe("firstTryPercent")`:

- **the creep test** — a state with `decisions: { firstTryCorrect: 5, completed: 5 }` and
  `math: { firstTryCorrect: 5, completed: 10 }` is **50, not 67**. Fails loudly if `decisions` is
  ever folded back in;
- a purchases-only week (`decisions` non-zero, `math`/`money` zero) is **`null`**, not `100`;
- an all-zero state is **`null`**, not `NaN` and not `0`. Assert `Number.isNaN` is false explicitly;
- **a denormalised state** — an object cast to `SkillState` whose counters are `undefined` / `NaN` /
  negative — still returns `null` or a finite 0–100 integer, never `NaN` (locks the `readSkillState`
  normalisation above, review R6);
- `math + money` are summed together, not averaged (3/4 math + 1/4 money → 50);
- rounds to the nearest integer and stays within 0–100.

### Success Criteria

#### Automated Verification

- Unit tests pass: `npm test` (`tests/skills.test.ts` gains ≥ 5)
- The creep test fails when `decisions` is added to `ACCURACY_COMPETENCIES` — verify by breaking it
  on purpose once, confirming red, then reverting
- Type checking passes: `npm run check`
- Linting passes: `npm run lint`

Nothing in this phase is user-visible, so it has no manual criteria (and no `#### Manual`
subsection in `## Progress` — review R10).

---

## Phase 3: Polish copy

### Overview

Every new string, in `src/i18n/pl.ts`, inside the existing `report: {` block — plus the rewrite of
the comment that this change makes false.

### Changes Required

#### 1. New keys

**File**: `src/i18n/pl.ts` (inside `report: {`, currently `:395-425`, alongside `statTasks` at `:415-416`)

**Intent**: L-003 — no literal copy in components, Polish always. The day names are net-new content;
nothing in the repo has weekday strings today.

**Contract**: exact keys and values.

| Key | Value | Note |
|---|---|---|
| `chartHeading` | `"Aktywność w tym tygodniu"` | Mockup wording, verbatim. Does **not** contain "Raport tygodniowy" — the three e2e heading locators stay safe. |
| `chartLegend` | `"Zadania ukończone w danym dniu"` | Word order deliberately differs from `statTasks` ("Ukończone zadania") so neither is a substring of the other — `getByText` matches substrings. |
| `chartEmpty` | `"Brak aktywności w tym tygodniu."` | Shown instead of an all-zero axis. |
| `chartDayValue` | `"{day}: {count}"` | Interpolated with `String.replace`, the house idiom (`WeeklyReport.tsx:163`). |
| `chartDaysShort` | `["Pon", "Wt", "Śr", "Cz", "Pt", "So", "Nd"]` | Visible x-axis labels. **Monday-first, order matches `daily`.** `Cz` (not `Czw`) is the mockup's abbreviation. |
| `chartDaysLong` | `["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"]` | Screen-reader copy; "Śr" alone is poor SR output. |
| `statFirstTry` | `"Zadania bez pomyłki"` | The tile label. Names an achievement, not a failure rate (AD-1). |
| `statFirstTryValue` | `"{percent}%"` | Keeps even the `%` glyph out of the component. |
| `statFirstTryNone` | `"—"` | The zero-denominator value (AD-3). |
| `statFirstTryNoData` | `"Brak danych z tego tygodnia"` | `sr-only` companion to the em-dash, so a screen reader hears a reason, not a punctuation mark. |

A comment above the day arrays stating that both are **Monday-first and index-aligned with
`WeeklyReport.daily`**, so a future edit cannot silently rotate one of them.

#### 2. The stale comment

**File**: `src/i18n/pl.ts:411-414`

**Intent**: The comment currently says the correctness %, daily chart and earnings "have no source
yet, so they are not rendered rather than estimated". Two thirds of that becomes false the moment
this change ships; leaving it would actively mislead the next reader.

**Contract**: Rewrite it to say the chart and the first-try share are now computed from the week's
aggregated `shift_log`, that the first-try share is deliberately **`math + money` only**, and that
**only** the earnings tile remains deferred — to F4, because `shift_log` has no earnings column.

#### 3. Copy review follow-up

**File**: `context/archive/2026-07-06-minimal-parent-weekly-report/follow-ups/copy-review.md`

**Intent**: That native-speaker review checklist is open and unchecked and covers every `t.report.*`
key. New keys join it rather than shipping unreviewed and unlisted.

**Contract**: Append the ten new keys as unchecked items. Content-only append; no restructuring of
the archived document. Two questions are named explicitly for the reviewer rather than left implicit
(review R1, R11): **(1)** does `"Zadania bez pomyłki"` read as an achievement or as a grade — the
guardrail condition AD-1 hangs the tile on; **(2)** do `statTasks` ("Ukończone zadania") and
`statFirstTry` sitting side by side invite a parent to reconcile a percentage against a count that
uses a different population (AD-9)?

### Success Criteria

#### Automated Verification

- Type checking passes (the `Dictionary` type is `typeof pl`, so a malformed literal fails here):
  `npm run check`
- Linting passes: `npm run lint`
- Unit tests still pass: `npm test`
- `grep -n "chartDaysShort\|chartDaysLong" src/i18n/pl.ts` shows both arrays with seven entries each

#### Manual Verification

- The rewritten comment at `pl.ts:411-414` is true of the shipped screen, not of the parked plan

---

## Phase 4: The activity chart (the project's first `<svg>`)

### Overview

A new island-side component rendering seven bars, gridlines, value labels and day labels from
`report.daily`, with a screen-reader path that does not depend on SVG accessibility support.

### Changes Required

#### 1. The component

**File**: `src/components/parent/WeeklyActivityChart.tsx` (new)

**Intent**: Draw the mockup's chart from data that already exists, at any viewport, readable by a
screen reader, with no dependency added.

**Contract**: `export default function WeeklyActivityChart({ days }: { days: WeeklyReportDay[] })`,
consuming the seven-entry invariant from Phase 1.

- **Empty week** (`every(d => d.completed === 0)`): render `copy.chartEmpty` as a
  `text-muted-foreground mt-2 text-sm` paragraph — the same voice as `noPractice` — and **no SVG at
  all**. An axis of zeros is noise, and this is the state a brand-new parent actually sees.
- **Scale**: `step = max(1, ceil(maxCount / 4))`, `yMax = 4 * step`, gridlines/ticks at
  `0, step, 2·step, 3·step, 4·step` — which reproduces the mockup's `0,4,8,12,16` for a max of 16, and
  keeps a single count of `1` at a quarter height rather than letting one task fill the card.
- **Geometry**: fixed `viewBox="0 0 320 180"`, `className="h-auto w-full max-w-md"`,
  `preserveAspectRatio="xMidYMid meet"` — **no breakpoint, no `lg:` branch, no hidden state** (AD-4).
  Plot area x `26 → 314`, baseline y `150`, top y `12` (headroom for value labels), day labels at
  y ≈ 166. Bar step = plot width / 7, bar width = 55 % of step, centred.
- **Type sizes are pinned, not left to the implementer** (review R7 — criterion 4.6 "labels legible
  at 390 px" turns entirely on them, and at 390 px the card's inner width is 308 px, so the whole
  drawing renders at ≈ 0.96 × its user units): day labels `font-size="11"`, per-bar value labels
  `font-size="10"`, y-axis tick labels `font-size="9"`, all with `text-anchor` set explicitly
  (`middle` for day and value labels, `end` for ticks). These are SVG user units — at 390 px they
  land at ≈ 10.6 / 9.6 / 8.7 CSS px, and the 26-unit left gutter holds a two-digit tick at 9.
- **A zero day draws no rect** — its day label and its `0` value label are still drawn. A stub
  rectangle would read as a small non-zero value; honesty beats symmetry.
- **Colour**: never hard-coded. Wrap the bars in `<g className="text-primary">` and use
  `fill="currentColor"`; gridlines in a `text-border` group with `stroke="currentColor"`; tick and
  day labels in `text-muted-foreground`, value labels in `text-foreground`. This follows the
  semantic-token discipline of `SkillBars.tsx` without depending on Tailwind `fill-*` utilities.
- **Accessibility**: the `<svg>` is `aria-hidden="true" focusable="false"`, and immediately after it
  a `sr-only` `<ul aria-label={copy.chartHeading}>` (the heading above it is a `div`, not a heading
  element, so the list needs its own name — review R12) with one `<li>` per day reading
  `copy.chartDayValue.replace("{day}", copy.chartDaysLong[i]).replace("{count}", String(d.completed))`.
  Rationale: SVG accessible-name support is uneven across screen readers, whereas a real DOM list is
  navigable, unambiguous, and directly assertable in jsdom. `sr-only` precedent:
  `src/components/child/HudChip.tsx:15`.
- **Legend**: a small `bg-primary` swatch plus `copy.chartLegend`, matching the mockup.
- All copy through `t.report.*` (L-003). Classes merged with `cn()` from `@/lib/utils` wherever they
  are conditional.

#### 2. Wiring

**File**: `src/components/parent/WeeklyReport.tsx`

**Intent**: Place the chart where the mockup places it — directly under the KPI row, above the
skills breakdown — inside each child's card, because our product renders one card per child rather
than the mockup's single-child selector.

**Contract**: A new `<div className="mt-5">` between the tile `<ul>` (`:139-148`) and the
"Ćwiczone umiejętności" block (`:150`), using the existing sub-section recipe: heading row
`text-muted-foreground flex items-center gap-2 text-sm font-semibold` with a `lucide-react`
`CalendarDays` icon at `size-4` (`BarChart3` is already taken by `practiceHeading` two sections
down), `copy.chartHeading` as its text, then `<WeeklyActivityChart days={child.report.daily} />`.
Deliberately **not** a semantic heading element — the sibling sections are `div`s, and adding an
`h3` would change the page's heading tree under existing `getByRole("heading")` locators.

#### 3. Test

**File**: `tests/weekly-activity-chart.test.tsx` (new, `// @vitest-environment jsdom` first line,
`@testing-library/react` — the pattern at `tests/task-guardrail.test.tsx:1-6`)

**Contract**:

- seven day labels render, in Monday-first order — assert with **`{ exact: true }`**, because
  `getByText` matches substrings and `"Pon"`/`"Wt"`/`"Śr"`/`"Cz"`/`"So"` are each prefixes of their
  long forms rendered in the same subtree;
- the `sr-only` list has seven entries with full Polish day names and the right counts;
- a zero day still contributes a label and a `0`, and renders no bar `<rect>`;
- a **single** non-zero day renders exactly one bar and does not blow up the scale (assert the
  gridline count is still five);
- an all-zero week renders `chartEmpty` and **no `<svg>`**;
- **L-003 by construction**: every string assertion in this file reads its expected value from
  `t.report.*` — the test file contains **no hard-coded Polish literal**. (The earlier phrasing,
  "the markup contains no literal Polish string absent from `t.report`", is not implementable: a
  test cannot enumerate "Polish strings" in rendered markup. Review R8.)

### Success Criteria

#### Automated Verification

- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`
- Unit tests pass: `npm test` (new file ≥ 6 tests)
- No `NaN` or `undefined` appears in rendered output for any fixture — assert explicitly

#### Manual Verification

- On a 390 px viewport the chart fits inside the card with no horizontal page scroll, and the day
  labels are legible
- On a 1280 px desktop the chart matches the mockup's shape (bars, gridlines, value labels, legend)
  and does not scale to a comic size
- The chart renders correctly in both the fresh-profile (empty) and played-week states

---

## Phase 5: The first-try tile

### Overview

The third summary tile, the widened grid, and the zero-denominator path.

### Changes Required

#### 1. The tile

**File**: `src/components/parent/WeeklyReport.tsx`

**Intent**: Show the honest first-try share, framed as an achievement rather than an error rate
(AD-1), with `NaN%` unreachable by construction (AD-3).

**Contract**: Inside `ChildSection`, `const firstTry = firstTryPercent(practice)` (Phase 2). The
`<ul>` at `:139` changes from `grid-cols-2` to **`grid-cols-2 sm:grid-cols-3`** — three tiles in one
row from `sm` (640 px) up, two-up below it, so the third tile wraps onto a second row on a phone.

**Why not a bare `grid-cols-3` (review R3).** The measured chain at a 390 px viewport is
`390 → main px-4 → 358 → card border + p-6 → 308` px of card inner width. A three-column
`gap-3` grid gives `(308 − 24) / 3 = 94.7` px per tile and, after the tile's own `p-4`,
**62.7 px of text width** — not the "~97 px" this plan previously claimed, which omitted the tile
padding. At `text-xs` semibold the *existing* `statUpgrades` label "Odblokowane" measures ≈ 77 px
and does not break (default `overflow-wrap: normal`), and a `text-2xl` `100%` value measures ≈ 65 px;
both spill their content box into the padding and sit edge-to-edge. Tailwind's `minmax(0, 1fr)`
keeps that from forcing a horizontal page scroll, so this is a legibility defect rather than a
layout break — but criterion 5.6 is a *manual* row and an unattended run does not execute manual
rows, so the guard has to be in the class list. At `sm` and above the same arithmetic gives
`(558 − 24) / 3 = 178` px per tile and 146 px of text, which is comfortable. `sm:grid-cols-3` is
house idiom (`src/components/Welcome.astro:96`) and is a responsive *grid* class, not the
`hidden`/`lg:hidden` duplication the run contract forbids — the accessibility tree is unchanged.
The mobile mockup does put four KPIs in one phone row, but with one-word labels
("misji", "poprawnych", "zdobyte", "ulepszenie") this product does not use.

Tile order: `statTasks` → `statFirstTry` → `statUpgrades` (the mockup's order with
the deferred earnings tile removed). New tile follows the existing recipe exactly
(`<li className="bg-accent/10 rounded-2xl p-4">`, value `text-foreground text-2xl font-extrabold`,
label `text-muted-foreground mt-0.5 text-xs font-semibold`).

- `firstTry !== null` → value is `copy.statFirstTryValue.replace("{percent}", String(firstTry))`.
- `firstTry === null` → value is `copy.statFirstTryNone` (`—`), plus a
  `<span className="sr-only">{copy.statFirstTryNoData}</span>` so a screen reader hears a reason.

**No colour coding, no threshold, no verdict line.** The mockup's green "Świetny wynik!" sub-line is
deliberately dropped — it is a judgement, and a judgement is exactly what the prior change objected
to (AD-1).

#### 2. Test

**File**: `tests/weekly-report-tiles.test.tsx` (new, jsdom pragma)

**Contract**:

- a played week renders the expected integer percent with a `%` sign;
- a fresh profile (all-zero practice) renders `—` and **never the substring `NaN`** — assert
  `expect(container.textContent).not.toMatch(/NaN/)`;
- **that same `not.toMatch(/NaN/)` assertion runs on *every* fixture in this file, not only the
  fresh-profile one (review N6).** AD-3 claims "`NaN%` is unreachable"; an assertion attached to the
  zero-denominator case alone only proves the `null` branch. The played-week and purchases-only
  fixtures exercise the `firstTry !== null` branch, which is where a future regression (a caller
  bypassing `firstTryPercent`, or the `readSkillState` normalisation being dropped) would surface.
  Factor it into a local `expectNoNaN(container)` helper called from each test;
- a purchases-only week renders `—`, not `100%` (the guardrail against `decisions` reaching the UI
  through a different path than Phase 2's helper);
- all three tiles render, and the existing two labels are unchanged (regression guard on
  `statTasks` / `statUpgrades`);
- the `report: null` load-error card is unaffected (no tiles, no chart, still `role="status"`).

### Success Criteria

#### Automated Verification

- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`
- Unit tests pass: `npm test` (new file ≥ 4 tests; suite total ≥ 315)
- No `NaN` appears in rendered output for **any** fixture in `tests/weekly-report-tiles.test.tsx`
  — assert explicitly on each, not only the fresh-profile one (review N6)
- `npx playwright test` still 15/15 — the existing `getByRole("heading", { name: t.report.heading })`
  locators in `e2e/parent-surfaces.spec.ts:32,48,66` must not become ambiguous

#### Manual Verification

- Three tiles read cleanly at 390 px (two-up, third wrapped) without overflowing or truncating
  mid-word, and in one row at 640 px and above
- A brand-new profile shows `—`, and the card as a whole does not read as a failure report

---

## Phase 6: Browser-level verification (hand-off to `/10x-e2e`)

### Overview

Exactly one risk here genuinely needs a real browser. Everything else in this change is pure
functions and DOM rendering, already covered by Phases 1–5 in Vitest — running it through Playwright
would be slower, flakier and prove less.

**Why this one needs a browser.** The report is a `client:load` island
(`report.astro:59`). Both new pieces enlarge that island. The `<h1>` "Raport tygodniowy" is rendered
by `AppShell.astro:152` on the **server**, so a component that throws during hydration leaves the
heading visible and every existing assertion green — research §8 is explicit that **no current e2e
test would catch a broken new tile**. Only a real browser proves the island still hydrates.

### Changes Required

#### 1. The risk to cover

**File**: `e2e/parent-surfaces.spec.ts` (extend) or a sibling spec — `/10x-e2e`'s call

**Intent**: Prove the enlarged island hydrates and renders correctly in the state a brand-new parent
actually reaches.

**Contract**: **Risk E2E-1 — empty-week report hydrates.** Provision a throwaway account
(`provisionAccount`), seed one child profile (`seedChildProfile`), set the PIN and land on
`/app/report` (the existing local helper `setPinAndLandOnReport`), `waitForIslands(page)`, then
assert: `t.report.chartHeading` is visible; `t.report.chartEmpty` is visible; the first-try tile
shows `t.report.statFirstTryNone`; the page text contains no `NaN`; and the existing
`t.report.heading` locator still resolves to exactly one element. `desktop` project. Locators use
`{ exact: true }` — `getByText` matches substrings and several new strings share prefixes.

#### 2. The second risk to cover

**File**: same spec

**Intent**: Put an **automated** guard under the one hard project rule this change stresses — "keep
every surface within the viewport on a phone" (run contract; commit `ee458ce`). Review R13 found
that there is no `overflow-x` guard in `src/styles/`, no `scrollWidth` assertion anywhere in `e2e/`,
and **no 390 px viewport is exercised in CI at all**: `playwright.config.ts` defines `desktop`
(1280×720) and `touch` (Galaxy Tab S4, 712 px) and `testMatch`-scopes `touch` to
`gameplay-restore.spec.ts`, so `/app/report` is only ever rendered at 1280 px. Phase 4's 4.6 and
Phase 5's 5.6 are the only guards today and both are **manual** rows, which an unattended run does
not execute.

**Contract**: **Risk E2E-2 — `/app/report` does not scroll horizontally on a phone.** Same setup as
E2E-1, but `await page.setViewportSize({ width: 390, height: 844 })` before landing on the report,
then assert `document.documentElement.scrollWidth <= window.innerWidth + 1` via `page.evaluate`, and
that `t.report.chartHeading` and the first-try tile are both visible at that width. A viewport call
plus a `page.evaluate` measurement is not an element locator, so the `e2e/CLAUDE.md` "no CSS
selectors / no DOM structure for locating elements" rule is untouched; no `data-testid` is added.
`desktop` project (the viewport is set in-test).

#### 3. Explicitly out of scope for this change

**Contract**: **Risk E2E-3 — a seeded week draws non-zero bars — is deliberately NOT built here.**
`e2e/helpers/` has **no `shift_log` seeder** (`seedChildProfile` cannot write shift rows), so
covering it means either building an admin-side seeder or driving a full gameplay run through
`solve-shift.ts` — minutes of wall-clock per assertion. The same coverage costs seconds in the
Phase 4 jsdom test, which already exercises the non-zero, single-day and zero-day shapes. Revisit
when F4 lands, since F4 must touch `shift_log` writes anyway and a seeder becomes cheap then.

### Success Criteria

#### Automated Verification

- `npx playwright test` green — 15 baseline + the two new tests, on both `desktop` and (if the spec
  is placed where `touch` picks it up) `touch`
- No existing spec became flaky or ambiguous: the three `t.report.heading` assertions still resolve
- Risk E2E-2 goes green: `/app/report` at 390 px has `scrollWidth <= innerWidth`

#### Manual Verification

- The new spec fails when `WeeklyActivityChart` is deliberately made to throw — verify once, then
  revert. A test that cannot go red proves nothing about hydration.

---

## Testing Strategy

### Unit tests

| Where | What it locks |
|---|---|
| `tests/reports.test.ts` | Seven-bucket frame, Monday-first, zero-filled; Warsaw civil-date bucketing across the fall-back weekend; `Σ daily === Σ practice.completed`; out-of-frame rows excluded from `daily` only; the `.eq("profile_id")` sibling filter survives; the existing error contract and four DST `startOfWeek` assertions stay green |
| `tests/skills.test.ts` | `decisions` cannot inflate the ratio (the creep test); `0/0` → `null`, never `NaN`, never `0`; rounding and clamping |
| `tests/weekly-activity-chart.test.tsx` | Seven labels in order; sr-only list with long day names; zero-day draws no rect; single-day scale; empty week renders copy, not an axis |
| `tests/weekly-report-tiles.test.tsx` | `—` for a fresh profile; no `NaN` in the DOM; purchases-only week is not `100%`; existing tiles unchanged |

Baseline is **299 and may only go up**. Expected landing point ≈ 320.

### Integration tests

`tests/report-isolation.test.ts` (live local Supabase) must stay green unchanged — it seeds a
current-week row through account A's own RLS-scoped client and asserts `report.practice.math`.
It exercises the widened `.select()` for free.

### Manual testing steps

1. `npx supabase status` (API on `127.0.0.1:54321`), `npm run dev`.
2. Sign in as `ui-polish-demo@example.test` / `test-password-123!`, PIN `2468`, land on `/app/report`.
3. Confirm profile "Ania" shows three tiles and either bars or the empty-week line.
4. Play one shift as Ania, return to `/app/report`, confirm today's bar rose and the tiles moved.
5. Buy one upgrade, return, confirm the first-try percentage **did not rise** (the `decisions`
   exclusion, visible end to end).
6. Resize to 390 px: no horizontal page scroll anywhere on the page; chart and tiles legible.
7. Create a second child profile and confirm its card shows `—` and the empty-week line — sibling
   data must not appear in it.

## Performance Considerations

None material. The chart reuses the array `getWeeklyReport` already has in memory — no extra query,
no extra round trip, and `shift_log_profile_created_idx (profile_id, created_at)` already covers the
access path. The added payload is seven small objects per child. The one cost worth naming is
`Intl.DateTimeFormat` construction per row in the civil-date helper — the shipped `warsawDayKey`
(`src/data/activity.ts:48-57`) constructs one per call, which at a handful of rows per child per
week is immaterial; do **not** fork it into a "faster" copy to hoist the formatter (that is the
duplicate R14 forbids). If it ever matters, hoist it inside `activity.ts` for both consumers.

## Migration Notes

None. No schema change, no data backfill, no RLS change — L-001 does not fire. The change is
purely additive to existing reads and is safe to revert by reverting the commits.

## Autonomous decisions

This run has **no human in the loop** (`context/runs/2026-08-22-autonomous-five/agent-contract.md`,
hard rule 1). `/10x-plan` wants a complexity confirmation and 3–5 `AskUserQuestion` rounds; neither
was asked. Complexity was self-assessed **MEDIUM** (multi-file feature, one genuine product
judgement, no schema change) and every open question from `research.md` is closed below with its
reasoning and its reversal condition.

### AD-1 — The parked-tranche precedent: an explicit scope override, plus a copy correction

> **Rewritten during `/10x-plan-review` (finding R1).** The first draft of this decision quoted only
> the guardrail half of the prior record and defended only the tile. Both halves are restored below,
> and the chart — parked by the same sentence — is defended too.

**The prior decision, in full.** `context/archive/2026-07-06-minimal-parent-weekly-report/frame.md:36`
evaluated the hypothesis "mockup fidelity gap is S-09 scope" and rejected it, on **scope** grounds:
the v3 mockup *"is a full dashboard (week picker, export, stat tiles incl. % correct, **daily bar
chart**, skill progress deltas, recommended missions)"*, prd-v3's true non-goals say *"No full parent
dashboard — only the minimal read-only weekly report ships"* (`context/foundation/prd-v3.md:161`),
and the deferred-tranche list plus the roadmap park *"Richer parent report — trends and
recommendations beyond the minimal weekly view"* (`prd-v3.md:172`, `roadmap.md:294`). Verdict:
*"The mockup depicts that parked tranche, not S-09's bar."* Only then, as a parenthetical:
*"(Some of it — % correct tiles — would even violate the non-shaming guardrail as shipped copy.)"*
The frame's closing instruction was *"Mockup fidelity items route to the parked richer-report
tranche, not this change."*

**So there are two objections, not one, and they do not cover the same ground:**

| | Objection | Applies to | Answered by |
|---|---|---|---|
| **(a)** | **Scope** — this is deferred-tranche content, excluded from the lead tranche | the chart **and** the tile | the run brief (below) |
| **(b)** | **Guardrail** — a "% correct" tile reads as a grade | the tile only | the copy correction (below) |

**Answering (a) — scope.** This is a maintainer-authorised un-parking, not a planner's unilateral
call. The run brief for this feature reads: *"Weekly activity bar chart (Mon–Sun) and a
first-try-correct percentage tile in the parent report"*, with the mockup named and the earnings tile
explicitly excluded (`context/runs/2026-08-22-autonomous-five/run-log.md:34-41`). A deferred tranche
is deferred until someone schedules it; this run schedules exactly two of its items and no more. The
prd-v3 non-goal itself enumerates what "full parent dashboard" means — *"goal-setting, difficulty
controls, time limits, and settings UI"* — none of which this change adds; what ships is two more
read-only figures on the existing read-only report, over data already stored. Everything else the
frame listed as parked (week picker, export, week-over-week deltas, skill-progress deltas,
recommended missions, `Zapasy`) **stays parked** — see "What We're NOT Doing".
*Reversal:* the maintainer says the tranche stays closed, in which case both features come out
together; they are one component, one `<li>` and one helper.

**Answering (b) — the guardrail.** Two things distinguish what ships from what was objected to.

1. **Audience.** This number lives on `/app/report`, behind the parent PIN gate — verified by
   reading the gate, not by assuming it: `report.astro:22-29` redirects to `/app/parent-pin` unless
   `verifyMarker` accepts the HMAC-signed `parent_verified` cookie, and the report island is
   imported by that route and nowhere else (`report.astro:5,7`). **The gate is the only thing
   holding, and it holds.**

   > **Corrected during the second `/10x-plan-review` pass (finding N1).** The first version of this
   > paragraph also claimed that `ParentControls.astro` was *"the only component that renders a
   > child-side link to `/app/report`"* and was *"currently rendered on no page at all"*. Only the
   > second half is true: nothing imports `src/components/child/ParentControls.astro`. But it is
   > **not** the only such link. `AppShell.astro:65` spreads
   > `{ key: "parent", href: "/app/report", label: t.nav.items.parent }` into `tabs` (the bottom
   > bar) and `:120-130` renders the same link in the desktop sidebar, and `AppShell` wraps
   > `start.astro`, `task.astro` and `upgrades.astro` — every child screen. So a child sees a
   > **"Panel rodzica"** entry (`pl.ts:137`) on every page and is one tap from the PIN gate. That
   > does not change what renders — `report.astro` still redirects — but it makes the softness
   > below concrete rather than theoretical, and it is recorded under `## Known risks`.

   It is a **soft** gate in the code's own words (`report.astro:16-21`): a child who knows the
   four-digit PIN passes it, and `MARKER_TTL_MS` is 15 minutes, so a report left open on a shared
   screen is readable. It is a parent-only surface by design and by routing, not by physical
   impossibility.
   The guardrail as written in the PRD and as implemented throughout the app protects the *child's*
   experience of failure: retry-until-right, no game-over, no visible miss counts, only practised
   competencies shown. A parent-only aggregate is a different object.
   **How far that distinction goes:** not infinitely. A parent who reads "62 %" as a grade can relay
   shame to the child, which is a real second-order harm the audience argument does not dissolve. So
   the distinction licenses shipping *a* number — it does not license shipping *the mockup's* number.
2. **The mockup's copy is the part that was actually objectionable, and it is also factually wrong.**
   `"92% poprawnych odpowiedzi"` claims a metric the product does not have: every task ends by
   succeeding (retry-until-right, FR-009), so "% of correct answers" is literally always 100 %. What
   the product stores is `firstTryCorrect` — tasks nailed with zero wrong taps — which is an
   *achievement count*, not an error rate.

**Decision: the tile ships**, as `"Zadania bez pomyłki"` — naming what is measured — with three
guardrail conditions baked into this plan: **no verdict line** (the mockup's green
"Świetny wynik!" is dropped), **no colour coding or thresholds** (no red/amber/green), and **no
comparison** — no week-over-week delta, no cross-child ranking. A number a parent can read is
allowed; a product that grades the child is not.

**Rejected**: (a) shipping the mockup verbatim — it asserts something untrue and is the copy the
prior change objected to; (b) leaving the tile parked — the objection was to a specific framing, and
"what did my child actually get right first time" is legitimate, useful information for the parent
the report exists to serve; (c) hiding it behind a toggle — invented UI, no mockup, no mandate.

**What would reverse this:** any of — the maintainer or the open native-speaker copy review reads
`"Zadania bez pomyłki"` as a grade; a request to surface this number on any child-visible screen;
a later change adding thresholds, colour coding, or cross-child comparison to it; or the parent
report ever becoming reachable without the PIN gate. Any one of those and the tile comes out — it is
one `<li>` and one helper, deliberately kept that cheap to remove.

### AD-2 — The ratio is `math + money` only, and a test enforces it

Every upgrade purchase writes `decisions: { firstTryCorrect: 1, completed: 1 }`
(`child-profiles.ts:243`), so `decisions` is 100 % by construction; including it makes the number rise
with **shopping**. `ACCURACY_COMPETENCIES = ["math", "money"]` is a named constant with the reason in
a comment, and Phase 2 ships a test where `math 5/10` + `decisions 5/5` must read **50, not 67** — it
goes red the moment `decisions` creeps back in. **Rejected**: computing over all of `COMPETENCIES`
for symmetry with `tasksThisWeek`. *Reversal:* only if `decisions` ever acquires a real failure mode
(a wrong purchase decision that can be got wrong), at which point the constant is the single edit.

**The deliberate asymmetry, stated plainly:** the *bars* count all three competencies while the
*ratio* excludes `decisions`. That is not an oversight. A rate where one term is 100 % by
construction is distorted by that term; a volume count is not, and the "Ukończone zadania" tile
directly above the chart already counts all three. Making the bars disagree with the tile above them
would look like a bug. Recorded here because it is exactly what a reviewer will flag.

### AD-3 — `0/0` renders `—`, never `NaN%`, never `0%`

`firstTryPercent` returns `null` for a zero denominator and the tile renders `copy.statFirstTryNone`
(`—`) plus an `sr-only` `"Brak danych z tego tygodnia"`. **Rejected**: `0%` — wrong *and* shaming, it
reads as "your child got nothing right"; **rejected**: omitting the tile — it matches the component's
"only practised competencies" habit but makes the grid conditional and leaves the parent wondering
where a tile went, when the empty-week line two sections below already explains the state. Covered by
two tests, one of which asserts the string `NaN` never appears in the rendered DOM.
*Reversal:* if a copy review reads `—` as a broken UI, switch to omitting the tile — a one-line
conditional and a `grid-cols-3`/`grid-cols-2` swap.

### AD-4 — Mobile: the chart reflows, and this is an extrapolation

**The mobile mockup (`05-parent-weekly-report-mobile.png`) contains no chart at all** — the phone
layout jumps from the KPI card to "Rozwój kawiarni". The design pack's own README says *"Use mobile
as responsive companion, **not a separate app concept**"*
(`assets/matmaverse-missing-screens-v3-prompts/README.md`), which reads as "the phone PNG is
abridged", not "hide the chart on phones". The run contract independently forbids the
`hidden`/`lg:hidden` duplication patterns that a phone-specific variant would invite, and the `touch`
Playwright project runs at 712 px — below `lg`.

**Decision: one chart at every width, no breakpoint at all.** A fixed `viewBox="0 0 320 180"` scaled
with `h-auto w-full max-w-md` is intrinsically fluid: at 390 px the card's inner width is ≈ 310 px, a
scale of ≈ 0.97, so labels render at roughly their nominal size; the `max-w-md` cap stops the text
ballooning on a wide desktop card. No `lg:` branch, no second component, no duplicated label in the
accessibility tree.

**This is marked plainly as extrapolation, not mockup-derived.** The maintainer can overrule it
cheaply in either direction: hiding on phones is one wrapper class, and a phone-specific variant is a
new component — neither requires touching Phases 1–3. *Reversal:* the maintainer supplies a phone
mockup that draws the chart differently, or 390 px testing shows the labels are genuinely unreadable.

### AD-5 — One Warsaw implementation, and it is the one that already exists

> **Rewritten during `/10x-plan-review` (findings R2 + R14).** The first draft got the principle
> right and the mechanics wrong: it proposed exporting two primitives nobody would import, and
> writing a civil-date helper that had just landed in the repo.

**No second offset parser.** `zoneOffsetMinutes` (`reports.ts:55`) stays the project's only
UTC-offset arithmetic. Day bucketing compares Warsaw **civil-date strings**, which needs no offset
maths at all, so nothing is duplicated. The prior change ruled a second parser out explicitly
(S-09; `.../plan.md:24,42` — *"the stack has no date library and shouldn't gain one for this"*) and this plan holds that line — verified: no phase computes an offset.

**No second civil-date formatter either.** `src/data/activity.ts:48` already exports
`warsawDayKey` (F2, commit `e40d650`). Phase 1 **imports** it; it does not write `warsawCivilDate`.
The only case in which a local copy exists is F1 starting before F2 merges, and Phase 1 makes the
dedupe at merge mandatory rather than optional.

**`REPORT_TIME_ZONE` and `zoneOffsetMinutes` stay module-private.** The first draft exported both
"because F2 will want them". It will not: F2 declares its own `ACTIVITY_TIME_ZONE`
(`src/data/activity.ts:18`) and states outright that importing from `reports.ts` *"would make
`src/data/activity.ts` depend on a service module and break its dependency-free posture"*
(`dashboard-recent-activity/plan.md:342-344`). F1's own path calls neither. Exporting them would add
two dead-API hunks to the file both features edit.

**What this leaves un-deduped, honestly:** the literal `"Europe/Warsaw"` now appears twice —
`REPORT_TIME_ZONE` (`reports.ts:50`) and `ACTIVITY_TIME_ZONE` (`activity.ts:18`). That is a constant,
not logic, and neither plan owns the merge; it is recorded under `## Known risks` rather than fixed
here, because collapsing it means deciding which module owns the zone and that is a third change.

**Rejected**: adding a date library — no date dependency exists and that is a standing decision
(`context/archive/2026-07-06-minimal-parent-weekly-report/plan.md:24`). *Reversal:* if the report ever becomes multi-timezone, the zone becomes a
parameter and both call sites follow.

### AD-6 — `created_at` on `ShiftLogRow` is required, and the breakage is planned, not discovered

Adding a required `created_at` breaks `tests/reports.test.ts:13-15` (the `row()` helper), the inline
literal at `:39`, and `npm run check` (`tsconfig.json` has `include: ["**/*"]`, so `astro check`
typechecks `tests/`). Phase 1 updates all three **as part of the phase**, not as a surprise. Chosen
over an optional `created_at?`, which would push a null-check into the fold and let a future caller
silently produce an all-zero chart. `tests/shift-log-isolation.test.ts` declares its **own** local
`ShiftLogRow` interface and is unaffected.

### AD-7 — No upper bound is added to the query

The week window stays open-ended `.gte(startOfWeek(now))`. Adding `.lt(...)` would be more correct in
principle but adds a chained method that `stubClient` (`tests/reports.test.ts:18-26`) does not carry
and that F2's parallel edit would have to rebase around, in exchange for guarding a state that cannot
occur (rows cannot be created in the future). Instead: an out-of-frame row is **excluded from `daily`
and still counted in `practice`** — existing behaviour unchanged — and a defensive test locks that.
*Reversal:* if a real next-week row is ever observed in a report, close the window with `.lt` and add
`lt: () => chain` to the stub in the same commit.

### AD-8 — SVG confirmed, with the accessibility path in the DOM rather than in the SVG

The run brief mandates a hand-rolled SVG, and the codebase does not force that hand — it has two
established div-based bar patterns with proper ARIA and **zero** `<svg>` in `src/`. SVG is kept
because the mockup's gridlines, per-bar value labels and axis ticks are what it is genuinely good at;
this change therefore *chooses* the project's first SVG convention rather than matching one. The
accessibility answer deliberately does **not** rely on SVG semantics: the `<svg>` is
`aria-hidden="true"` and a `sr-only` `<ul>` carries day-name/count pairs. Screen-reader support for
SVG `<title>`/`role="img"` is uneven; a real DOM list is navigable, unambiguous, and directly
assertable in jsdom. *Reversal:* if the SVG proves awkward to maintain, the same `days` prop drives a
flex/div bar chart with no change above the component boundary.

### AD-9 — Bars count the same quantity as the tile above them

> **Independently verified during the second `/10x-plan-review` pass (finding N7).** The invariant
> holds through the code, not only on paper: `aggregateWeeklyReport` accumulates `practice` via
> `addSkillDelta`, whose per-field step is `base[c].completed + safeCount(d.completed)`
> (`skills.ts:82-84`), and the Phase 1 daily fold accumulates `readSkillState(row.skills)`, whose
> per-field step is the *same* `safeCount` on the *same* field (`skills.ts:62-64`). Identical
> per-row coercion on both sides ⇒ `Σ daily[].completed === Σ_c practice[c].completed`. And the
> tile above the bars is `COMPETENCIES.reduce((sum, c) => sum + practice[c].completed, 0)`
> (`WeeklyReport.tsx:133`) over `COMPETENCIES = ["math", "money", "decisions"]` (`skills.ts:16`) —
> exactly the three the bars sum. **A parent who adds up the seven bars gets the number printed
> above them.** The single divergence is a row inside the open-ended `.gte` window but outside the
> seven-day frame, which AD-7 accepts as unreachable and Phase 1's test locks explicitly.

Each bar is that day's summed `completed` across all three competencies — so the seven bars are
exactly a decomposition of the existing "Ukończone zadania" tile, an invariant Phase 1 asserts.
**Rejected**: counting `shift_log` rows (would need a row-kind discriminator and would count a
five-task shift as 1); **rejected**: `math + money` only (would silently disagree with the tile
directly above it, which reads as a bug). The legend is worded
`"Zadania ukończone w danym dniu"` rather than the mockup's *"Liczba ukończonych misji"* because the
bars count tasks, not missions, and because a legend byte-identical to `statTasks` would create a
third ambiguous `getByText` pair on this page (`statUpgrades` / `upgradesHeading` are already
identical — research §8). *Reversal:* if the product later decides purchases are not "zadania",
change the tile and the bars **together in one change** so they never disagree.

**The residue this leaves on screen (review R11).** The asymmetry is defensible in the maths and
still leaves one thing a parent can trip over: `statTasks` and `statFirstTry` sit side by side, both
carry the word *zadania*, and their populations differ. With 13 math/money tasks (8 first-try) and 7
purchases, the row reads `20 · 62 % · 7` — and `62 % × 20` reconciles to no number on the card.
(Note the pre-existing wrinkle underneath: `statTasks` counts `decisions.completed`, which *is*
`upgrades.length`, so purchases are already counted by two adjacent tiles.) This is a **copy**
problem, not a data problem, and this plan does not invent a Polish label to solve it — the ten new
keys go to the open native-speaker review (Phase 3 §3), which is now told to decide this specific
question. Candidate if it needs solving: name the population in the label, e.g.
`"Liczenie i pieniądze bez pomyłki"` (reusing `t.skills.math` / `t.skills.money` vocabulary), which
costs one dictionary value and no code. Also recorded under `## Known risks`.

### AD-10 — E2E scope: one risk, in the empty state

Only the hydration risk needs a browser (Phase 6 states why). The seeded-data chart test is
deliberately deferred: `e2e/helpers/` has no `shift_log` seeder, so it costs a new admin helper or a
full `solve-shift.ts` run, while the jsdom tests cover the same shapes in seconds. *Reversal:* build
it when F4 touches `shift_log` writes and a seeder becomes nearly free.

### AD-11 — Documentation debt this change must not leave behind

The comment at `src/i18n/pl.ts:411-414` becomes false the moment this ships and is rewritten in
Phase 3 rather than left contradicting the shipped screen. The ten new keys are appended to the open
copy-review checklist. `context/foundation/roadmap.md:294` parks *"Richer parent report — trends +
recommendations"*; this change partially un-parks it, which the handoff notes for the maintainer
rather than editing the roadmap unasked.

### AD-12 — Implementation-step decisions (`/10x-implement`, 2026-08-23)

`/10x-implement` gates every phase on an `AskUserQuestion` (manual-verification confirmation, dirty-path
handling, commit-message approval, next-phase choice). None was asked — agent contract hard rule 1.

- **Branch cut from `feat/dashboard-recent-activity`, not `feat/ui-polish`.** The plan's hard
  prerequisite (Critical Implementation Details → "Branch sequencing", N9) is that
  `src/data/activity.ts` must exist on the base branch. F2 is complete and reviewed on its own branch
  but has **not** been merged to `feat/ui-polish`, so the choice was: wait (impossible — no human to
  merge), fork `warsawDayKey` (the exact duplicate AD-5 exists to prevent), or **stack F1 on F2**.
  Stacking was chosen; it satisfies AD-5 exactly, and the merge order F2 → F1 was already the plan's
  assumption. *Consequence for the maintainer:* `feat/parent-weekly-activity-chart` contains F2's six
  commits and must be merged after (or together with) F2. *Reversal:* if F2 is abandoned, F1 must be
  rebased onto `feat/ui-polish` and `warsawDayKey` moved with it — not re-implemented.
  The unit baseline is therefore **318** (F2's 299 + 19), not 299; measured on the branch before the
  first edit.
- **Manual Progress rows are left unchecked unless actually observed.** `/10x-implement` forbids
  ticking a manual row without human confirmation, and an unattended run has none. Rows verified by
  driving a real browser are ticked and say so; the rest stay `- [ ]` so the next reader sees honestly
  what has and has not been looked at. Rejected: ticking them on the strength of passing automated
  checks — that is the failure mode the run contract calls "a claimed green".
- **`AskUserQuestion` gates collapsed to their recommended option.** Dirty-path handling → "stage only
  the planned set" (the tree carries three other features' untracked `context/changes/` folders and
  `context/runs/`, none of which belong to F1); commit message → approve as proposed; next phase →
  continue. Each is the skill's own Recommended branch.

## Known risks

Recorded by `/10x-plan-review` (2026-08-22, findings R1–R14; re-verified and extended 2026-08-23,
findings N1–N9 — see `reviews/plan-review.md`). These are accepted, not fixed — each names what
would make it real and who owns it.

1. **Two `"Europe/Warsaw"` constants** — `REPORT_TIME_ZONE` (`reports.ts:50`) and
   `ACTIVITY_TIME_ZONE` (`src/data/activity.ts:18`). A constant, not logic, so the DST-bug class is
   not reopened; but if the zone ever changes, two edits are needed. Collapsing it means deciding
   which module owns the zone — a third change, owned by neither F1 nor F2. *Becomes real if:* a
   locale/timezone parameterisation lands. (AD-5)
2. **`statTasks` and `statFirstTry` do not reconcile on screen** — same noun, different populations
   (AD-9's "residue" paragraph). Routed to the open native-speaker copy review with the question
   stated (Phase 3 §3). *Becomes real if:* the review, the maintainer, or a parent reads the
   percentage as a share of the adjacent count.
3. **`ShiftLogRow` and `RecentActivityRow` will differ only by `id`** once F1 lands `created_at`
   (`reports.ts:13-16` vs `:118-123`). A later "simplification" that merges them couples two
   independent queries. F2 pre-registered this as its R2; F1 inherits it. *Becomes real if:* anyone
   refactors `reports.ts` for tidiness rather than for a behaviour change.
4. **F1 lands second into a file F2 is actively editing.** Every F1 edit is additive and away from
   EOF, and `tests/reports.test.ts` is F1-exclusive, so the expected conflicts are loud, not silent
   — but a rebase resolved by reformatting would be a real regression. *Becomes real if:* the
   implementer resolves a conflict by restructuring rather than by re-applying.
5. **The three-tile row and the chart are the first phone-width surfaces this report has gained**,
   and the automated guard for them is one new e2e check (Phase 6, Risk E2E-2) written against a
   viewport CI has never exercised. *Becomes real if:* that risk is dropped, at which point the
   only coverage is manual rows an unattended run does not execute.
6. **A child-side link to `/app/report` ships on every child screen (N1).** `AppShell.astro:65`
   (bottom bar) and `:120-130` (desktop sidebar) render a **"Panel rodzica"** entry on
   `start.astro`, `task.astro` and `upgrades.astro`. The PIN gate at `report.astro:22-29` is
   therefore the *only* thing between a child and the first-try tile — a soft, 4-digit,
   15-minute-TTL gate one tap away, not a surface a child has no route to. AD-1's guardrail argument
   already accounted for the gate's softness; it did **not** account for the link. Nothing in this
   plan changes as a result — the tile still cannot render without the marker — but the reversal
   conditions in AD-1 ("the parent report ever becoming reachable without the PIN gate") should be
   read as already half-true on the *navigation* axis. *Becomes real if:* the PIN gate is weakened,
   the marker TTL is lengthened, or the nav entry is ever made to deep-link past the gate.
   *Owner:* whoever next touches `AppShell` nav or `parent-pin`.
7. **F4's "Handed to F1" recipe is stale against the post-F1 file (N2).** F4 expects a 2-tile
   `grid-cols-2` grid and a `.select("skills, upgrade_purchased")`; after F1 it finds a 3-tile
   `grid-cols-2 sm:grid-cols-3` grid and `.select("created_at, skills, upgrade_purchased")`, and the
   `pl.ts` comment F4 plans to fix has already been rewritten once. The corrected deltas are
   tabulated in "What We're NOT Doing". F1 cannot edit F4's plan (different change folder), so this
   travels in the handoff. *Becomes real if:* the F4 implementer applies the recipe verbatim —
   the `sm:grid-cols-3` line would leave a 3 + 1 orphan tile row.
8. **AD-1 is a scope override of a PRD-deferred tranche.** It is authorised by this run's own
   feature brief, not by a PRD edit; `prd-v3.md:172` and `roadmap.md:294` still read as parked. The
   handoff flags this for the maintainer rather than editing either document unasked (AD-11).

## References

- Research (ground truth): `context/changes/parent-weekly-activity-chart/research.md`
- Run contract: `context/runs/2026-08-22-autonomous-five/agent-contract.md`
- Prior parking decision: `context/archive/2026-07-06-minimal-parent-weekly-report/frame.md:36`,
  `.../plan.md:30-31`
- Deferred earnings column owner: `context/changes/world-progression-stages/` (F4)
- Parallel edit to the same service: `context/changes/dashboard-recent-activity/` (F2)
- Tile + sub-section recipe: `src/components/parent/WeeklyReport.tsx:139-169`
- ARIA bar precedent: `src/components/child/SkillBars.tsx:28-37`; `sr-only`:
  `src/components/child/HudChip.tsx:15`
- jsdom component-test pattern: `tests/task-guardrail.test.tsx:1-6`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Project `created_at` and bucket the week into seven days

#### Automated

- [x] 1.1 Type checking passes: `npm run check`
- [x] 1.2 Linting passes: `npm run lint`
- [x] 1.3 Build passes: `npm run build`
- [x] 1.4 Unit tests pass and the count went up: `npm test` (≥ 299, `tests/reports.test.ts` ≥ 19)
- [x] 1.5 `tests/report-isolation.test.ts` passes against the live local stack

#### Manual

- [ ] 1.6 `/app/report` renders exactly as before — this phase is invisible to the parent

### Phase 2: The first-try ratio, with `decisions` structurally excluded

#### Automated

- [ ] 2.1 Unit tests pass: `npm test` (`tests/skills.test.ts` gains ≥ 5)
- [ ] 2.2 The creep test goes red when `decisions` is added to `ACCURACY_COMPETENCIES` (break, confirm, revert)
- [ ] 2.3 Type checking passes: `npm run check`
- [ ] 2.4 Linting passes: `npm run lint`

### Phase 3: Polish copy

#### Automated

- [ ] 3.1 Type checking passes: `npm run check`
- [ ] 3.2 Linting passes: `npm run lint`
- [ ] 3.3 Unit tests still pass: `npm test`
- [ ] 3.4 `chartDaysShort` and `chartDaysLong` both present with seven entries each

#### Manual

- [ ] 3.5 The rewritten comment at `pl.ts:411-414` is true of the shipped screen

### Phase 4: The activity chart (the project's first `<svg>`)

#### Automated

- [ ] 4.1 Type checking passes: `npm run check`
- [ ] 4.2 Linting passes: `npm run lint`
- [ ] 4.3 Build passes: `npm run build`
- [ ] 4.4 Unit tests pass: `npm test` (new chart test file ≥ 6 tests)
- [ ] 4.5 No `NaN` or `undefined` in rendered output for any fixture

#### Manual

- [ ] 4.6 390 px: chart fits inside the card, no horizontal page scroll, labels legible
- [ ] 4.7 1280 px: chart matches the mockup's shape and does not scale to a comic size
- [ ] 4.8 Correct in both the fresh-profile (empty) and played-week states

### Phase 5: The first-try tile

#### Automated

- [ ] 5.1 Type checking passes: `npm run check`
- [ ] 5.2 Linting passes: `npm run lint`
- [ ] 5.3 Build passes: `npm run build`
- [ ] 5.4 Unit tests pass: `npm test` (new tile test file ≥ 4 tests; suite total ≥ 315)
- [ ] 5.5 No `NaN` in rendered output for **every** fixture in `tests/weekly-report-tiles.test.tsx`
- [ ] 5.6 `npx playwright test` still 15/15 — existing heading locators unambiguous

#### Manual

- [ ] 5.7 Three tiles read cleanly at 390 px without truncating mid-word
- [ ] 5.8 A brand-new profile shows `—` and the card does not read as a failure report

### Phase 6: Browser-level verification (hand-off to `/10x-e2e`)

#### Automated

- [ ] 6.1 `npx playwright test` green — 15 baseline plus Risk E2E-1
- [ ] 6.2 No existing spec became flaky or ambiguous (the three `t.report.heading` assertions)
- [ ] 6.3 Risk E2E-2 green: `/app/report` at 390 px has `scrollWidth <= innerWidth`

#### Manual

- [ ] 6.4 The new spec goes red when `WeeklyActivityChart` is deliberately made to throw (break, confirm, revert)
