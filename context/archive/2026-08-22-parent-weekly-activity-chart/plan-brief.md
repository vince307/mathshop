# Parent weekly activity chart + first-try tile — Plan Brief

> Full plan: `context/changes/parent-weekly-activity-chart/plan.md`
> Research: `context/changes/parent-weekly-activity-chart/research.md`
> Run contract: `context/runs/2026-08-22-autonomous-five/agent-contract.md`

## What & Why

Add the missing-screens-v3 mockup's **Mon–Sun activity bar chart** and a **first-try
percentage tile** to the PIN-gated parent weekly report at `/app/report`. Both are built
from data the product already stores — no migration, no new query, no dependency. The
parent currently sees only two flat totals; the chart shows *when* the week happened and
the tile shows *how much landed first try*.

## Starting Point

`aggregateWeeklyReport` (`src/lib/services/reports.ts:37-47`) already folds the week's
`shift_log.skills` into per-competency `{firstTryCorrect, completed, misses}` — so the
percentage needs **no new data at all**. The week query filters and orders on `created_at`
but never projects it (`:107-112`), so no day key reaches memory — that one omission is the
whole of the chart's data work. `startOfWeek` is exported and DST-correct; `REPORT_TIME_ZONE`
and `zoneOffsetMinutes` are private. There is **zero `<svg>` in `src/`**, no charting library,
and no weekday names anywhere in the repo.

## Desired End State

Each child's card on `/app/report` gains a seven-bar "Aktywność w tym tygodniu" section —
gridlines, per-bar value labels, `Pon…Nd` axis, legend, and a screen-reader list of the same
day/count pairs — plus a third tile, "Zadania bez pomyłki", reading e.g. `62%`, or `—` for a
child with no completed tasks this week. A brand-new profile sees a calm Polish line instead
of an empty axis. `NaN%` is unreachable. Nothing else on the page changes.

## Key Decisions Made

| Decision | Choice | Why | Source |
|---|---|---|---|
| The parked-tile precedent | Override deliberately — ship the tile, drop the mockup's copy | A prior change parked it as a possible non-shaming violation. It lives behind the parent PIN, not on a child screen; and the objection was to *"% poprawnych odpowiedzi"*, which is factually always 100 % here. Ships as first-try mastery, with no verdict line, no colour coding, no comparison | Plan (AD-1) |
| Which competencies count | `math + money` only | Every purchase writes `decisions {1,1}` — 100 % by construction, so including it makes the number rise with shopping. Enforced by a test that goes red if it creeps back | Research + Plan (AD-2) |
| `0/0` rendering | `—` plus an `sr-only` reason | `0%` is wrong *and* shaming; `NaN%` is a bug. Omitting the tile makes the grid conditional for no gain | Plan (AD-3) |
| Mobile | One chart at every width, no breakpoint — **extrapolation, not mockup-derived** | The mobile mockup draws no chart; the pack README says "responsive companion, not a separate app concept". A fixed `viewBox` scaled by `w-full max-w-md` is fluid without a `lg:` branch | Plan (AD-4) |
| Timezone | Export `REPORT_TIME_ZONE` / `zoneOffsetMinutes`; bucket by Warsaw **civil date string** | A second offset implementation is a bug waiting for a DST weekend. Civil-date matching is DST-proof and needs no offset maths | Research + Plan (AD-5) |
| Query window | Keep it open-ended — no `.lte`/`.lt` | A new chained method breaks `stubClient` and collides with F2's rebase, to guard a state that cannot occur | Plan (AD-7) |
| Chart technology | Hand-rolled SVG, but `aria-hidden` with an `sr-only` list beside it | This is the project's first SVG, so it *chooses* the convention. SVG accessible-name support is uneven; a DOM list is navigable and jsdom-assertable | Plan (AD-8) |
| What the bars count | All three competencies — a decomposition of the "Ukończone zadania" tile above them | Bars that disagree with the tile directly above look like a bug. The asymmetry with the ratio is deliberate and justified in AD-2 | Plan (AD-9) |
| Earnings tile | Not shipped, not estimated | `earned` is computed then discarded — `shift_log` has no column. Blocked on a migration owned by F4, which can add it additively | Research (carried) |

## Scope

**In scope:** `created_at` in the projection and on `ShiftLogRow`; a seven-day `daily` series
on `WeeklyReport`; exported Warsaw primitives; a pure `firstTryPercent` over `math + money`;
ten new `t.report.*` keys including both day-name arrays; a new `WeeklyActivityChart` SVG
component; a third summary tile; four test files touched or added; one e2e risk.

**Out of scope:** the "+84 zł" earnings tile (F4); any migration or RLS change; week-over-week
deltas; the mockup's `Zapasy` competency, week picker, child selector and export button; a
charting or date library; `data-testid`; changing what `statTasks` counts.

## Architecture / Approach

`getWeeklyReport` widens one `.select()` string and threads its `now` into
`aggregateWeeklyReport`, which does a second fold over the array it already has — bucketing
each row by its Warsaw civil date into a fixed seven-day frame derived from `startOfWeek`. The
result rides the existing SSR→island boundary as plain JSON. The ratio is a separate pure
helper in `src/data/skills.ts` (dependency-free, already client-imported), deliberately kept
out of `reports.ts` to shrink the F2 conflict surface. Two React pieces consume them:
a new `WeeklyActivityChart` and one more `<li>` in the existing tile grid.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Service + day frame | `created_at` projected, `daily[7]` on `WeeklyReport`, Warsaw primitives exported | Required `created_at` breaks `tests/reports.test.ts` and `npm run check` — planned for, not discovered. Must keep `.eq("profile_id")` |
| 2. First-try ratio | `firstTryPercent` over `math + money`, `null` on `0/0` | `decisions` silently creeping back in — a dedicated red-on-creep test |
| 3. Polish copy | Ten `t.report.*` keys; the stale `pl.ts:394-397` comment rewritten | Substring collisions: `getByText` matches substrings and `Pon`/`Wt`/`Śr`/`Cz`/`So` prefix their long forms |
| 4. Chart component | The project's first `<svg>` + jsdom test | No house SVG convention to match; must degrade to a copy line on an empty week and not overstate a single-day week |
| 5. First-try tile | Third tile, `grid-cols-3`, `—` path | Must not make the three existing `t.report.heading` e2e locators ambiguous |
| 6. Browser check | One `/10x-e2e` risk: the enlarged island still hydrates | The `<h1>` is server-rendered, so a hydration crash is currently invisible to every existing test |

**Prerequisites:** branch `feat/<change-id>` cut from `feat/ui-polish`; local Supabase up for the
integration and e2e suites. **Sequencing:** F2 `dashboard-recent-activity` edits the same
`src/lib/services/reports.ts` in parallel — all edits here are additive and the second lander
rebases rather than reformats.

**Estimated effort:** ~2 sessions across 6 commit-sized phases.

## Open Risks & Assumptions

- **The guardrail override is a judgement call, recorded as one.** If the maintainer or the open
  native-speaker copy review reads "Zadania bez pomyłki" as a grade, the tile comes out — it is
  one `<li>` and one helper, deliberately kept that cheap to remove.
- **The mobile chart layout is an extrapolation.** The mockup declines to draw it. Overruling costs
  one wrapper class in either direction and touches nothing in Phases 1–3.
- **F2 contention on `reports.ts`** is real and known; the plan names it so the implementer rebases
  instead of resolving blindly.
- **Assumed:** `shift_log` rows cannot carry a future `created_at`, so the open-ended query window
  cannot produce out-of-frame rows in practice. A defensive test covers it anyway.

## Success Criteria (Summary)

- A parent opening `/app/report` sees, per child, when the week's work happened and how much of it
  landed first try — with no number on screen that the product does not actually store.
- A brand-new profile sees `—` and a calm empty-week line: never `NaN%`, never `0%`, never a card
  that reads as a failure report.
- `npm run check` / `lint` / `build` clean; `npm test` ≥ 299 and rising (≈ 320 expected);
  `npx playwright test` green with one new hydration test.
