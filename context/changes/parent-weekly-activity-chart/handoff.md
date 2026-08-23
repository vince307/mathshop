# Handoff — `parent-weekly-activity-chart` (F1)

> **Read first:** `context/runs/2026-08-22-autonomous-five/agent-contract.md` — the standing brief
> for this run. No human in the loop; decide, record under `## Autonomous decisions`, continue.

**Status:** `implemented` · **Next command:** `/10x-impl-review parent-weekly-activity-chart`
**Branch:** `feat/parent-weekly-activity-chart` — **stacked on `feat/dashboard-recent-activity` (F2)**,
not on `feat/ui-polish`. Read *Branching* below before merging anything.

---

## What shipped

Two additions to the PIN-gated parent weekly report (`/app/report`), per
`assets/matmaverse-missing-screens-v3-web/05-parent-weekly-report-web.png`:

1. a **Monday–Sunday activity bar chart** inside each child's card — the daily decomposition of the
   *Ukończone zadania* tile above it, drawn as the project's first hand-rolled `<svg>`;
2. a **first-try tile** (`"Zadania bez pomyłki"`) — the share of the week's tasks the child got right
   with no wrong taps, over `math + money` only.

Built entirely from data already stored. **No migration, no new query, no new dependency, no charting
library.** The mockup's "+84 zł" earnings tile did **not** ship, in any form — it belongs to F4.

## Commits (6, oldest first)

| SHA | Phase |
|---|---|
| `ec47dd1` | p1 — `created_at` projected; `weekDayKeys`; the seven-day fold; `WeeklyReport.daily` |
| `4029383` | p2 — `ACCURACY_COMPETENCIES` + `firstTryPercent` |
| `b32bba7` | p3 — ten Polish keys; the stale `pl.ts` comment rewritten; copy-review checklist extended |
| `b3c318c` | p4 — `WeeklyActivityChart.tsx` + its jsdom test + the wiring |
| `35171ee` | p5 — the third tile, `grid-cols-2 sm:grid-cols-3`, + its jsdom test |
| `0667d03` | p6 — `e2e/parent-weekly-report.spec.ts` (Risks E2E-1, E2E-2) + `e2e/helpers/parent-pin.ts` |

Plus an epilogue commit landing the final SHA write-back and `change.md → implemented`.

## Verification — observed, not remembered

Run on `0667d03` with the tree clean of this change's work:

```
npm run check        0 errors, 0 warnings, 9 hints
npm run lint         clean (no output)
npm run build        Complete!
npm test             44 files, 346 passed        (baseline on this branch was 318)
npx playwright test  17 passed                   (baseline 15 + Risks E2E-1, E2E-2)
```

`tests/report-isolation.test.ts` was also run on its own against the live local stack (3 passed), so
the widened `.select()` is exercised through real RLS, not only through a stub.

Two deliberate-break checks were run and reverted; **neither appears in any commit**:

- adding `decisions` to `ACCURACY_COMPETENCIES` turned the creep test red (`expected 67 to be 50`);
- making `WeeklyActivityChart` throw on hydration only turned **both** new e2e tests red.

## Files changed

**Production**
- `src/types.ts` — `WeeklyReportDay`; `WeeklyReport.daily` (always 7, Monday-first, zero-filled)
- `src/lib/services/reports.ts` — required `created_at` on `ShiftLogRow`;
  `.select("created_at, skills, upgrade_purchased")`; **imports F2's `warsawDayKey`**; new
  `weekDayKeys` inserted after `startOfWeek`; the daily fold inside `aggregateWeeklyReport`
- `src/data/skills.ts` — `ACCURACY_COMPETENCIES`, `firstTryPercent`
- `src/i18n/pl.ts` — ten new `t.report.*` keys; the stale comment rewritten
- `src/components/parent/WeeklyActivityChart.tsx` — **new**
- `src/components/parent/WeeklyReport.tsx` — the chart sub-section, the third tile, the widened grid

**Tests**
- `tests/reports.test.ts` (extended), `tests/skills.test.ts` (extended),
  `tests/weekly-activity-chart.test.tsx` (**new**), `tests/weekly-report-tiles.test.tsx` (**new**)
- `e2e/parent-weekly-report.spec.ts` (**new**), `e2e/helpers/parent-pin.ts` (**new**),
  `e2e/parent-surfaces.spec.ts` (its local PIN helper moved into the shared helper)

**Docs**
- `context/archive/2026-07-06-minimal-parent-weekly-report/follow-ups/copy-review.md` — the ten keys
  appended as unchecked items, with the two questions AD-1 and AD-9 hang on named for the reviewer
- `context/changes/parent-weekly-activity-chart/{plan.md, change.md, handoff.md}`

Deliberately **not** touched: `docs/reference/contract-surfaces.md` (already lists `created_at` and
`reports.ts`; editing it buys a same-line conflict with F2 for no information — plan review R9).

## Progress

**All 35 rows are `[x]`** — every automated row and every manual row. The manual rows were not ticked
on the strength of green unit tests: a temporary Playwright spec (provisioned account, a full seeded
week in `shift_log`, screenshots at 1280 px and 390 px) was written, read, and **deleted before the
Phase 6 commit**. `plan.md` → AD-12 records precisely what was observed for each row, and flags the
two (1.6, 3.5) that rest on inspection rather than on a browser.

Worth knowing: on the rendered page the tasks tile read **74** and the seven bars summed to
`8+10+14+12+16+6+8 = 74`. AD-9's decomposition invariant is verified on screen, not just in a unit test.

## Branching — read before merging

**`feat/parent-weekly-activity-chart` was cut from `feat/dashboard-recent-activity`, not from
`feat/ui-polish`.** This is a deliberate exception to the run's one-branch-per-feature-from-`ui-polish`
rule, and it was forced:

- the plan's hard prerequisite (Critical Implementation Details; review finding N9) is that
  `src/data/activity.ts` exist on the base branch, so F1 can **import** `warsawDayKey` rather than
  fork a second Warsaw implementation — the exact duplicate AD-5 exists to prevent;
- F2 is complete and reviewed but has **not** been merged to `feat/ui-polish`, and an unattended run
  has no one to merge it.

**Consequence:** this branch contains F2's six commits as well as F1's six. Merge F2 first, or merge
this branch as a superset. If F2 is ever abandoned, F1 must be rebased onto `feat/ui-polish` and
`src/data/activity.ts` moved with it — `warsawDayKey` must not be re-implemented.

The unit baseline on this branch was therefore **318**, not the run contract's 299.

## What the next reader must know

1. **F4's "Handed to F1" recipe is stale and F1 could not fix it** (`plan.md` → Known risks 7, and
   the correction table under *What We're NOT Doing*). F4
   (`context/changes/world-progression-stages/plan.md:458+`) expects a **2-tile** `grid-cols-2` grid
   and instructs `grid-cols-2` → `sm:grid-cols-3`. It will now find a **3-tile** grid already classed
   `grid-cols-2 sm:grid-cols-3`, so applying that line verbatim leaves a **3 + 1 orphan tile row**.
   It also string-matches `.select("skills, upgrade_purchased")`, which is now
   `.select("created_at, skills, upgrade_purchased")`, and cites the `pl.ts` comment at `:394-396`,
   which is at `:411-414` and which F1 has already rewritten once. **The F4 implementer must read
   F1's correction table before applying that recipe.**
2. **`ShiftLogRow` and `RecentActivityRow` now differ only by `id`.** Do **not** merge them — F2
   pre-registered that "helpful simplification" as its own risk R2.
3. **A child-side link to `/app/report` ships on every child screen** (`AppShell.astro:65`,
   `:120-130` → "Panel rodzica"). The PIN gate (`report.astro:22-29`) is the only thing between a
   child and the first-try tile, and it is soft: 4 digits, 15-minute TTL, one visible tap away.
   Nothing here changes as a result, but AD-1's reversal condition ("the parent report ever becoming
   reachable without the PIN gate") should be read as already half-true on the navigation axis.
4. **AD-1 is a scope override of a PRD-deferred tranche**, authorised by this run's feature brief
   rather than by a PRD edit. `prd-v3.md:172` and `roadmap.md:294` still read as parked; neither was
   edited unasked.
5. **`statTasks` and `statFirstTry` do not reconcile on screen** — same noun, different populations
   (the count includes purchases, the percentage does not). Routed to the open native-speaker copy
   review with the question stated, not solved by inventing a Polish label.
6. **Two `"Europe/Warsaw"` constants** remain (`reports.ts` `REPORT_TIME_ZONE`, `activity.ts`
   `ACTIVITY_TIME_ZONE`). A constant, not logic; collapsing it means deciding which module owns the
   zone — a third change, owned by neither feature.
7. The ten new Polish keys ship **unreviewed**, like their siblings, and are on the copy-review
   checklist. Two of them carry decisions: if `"Zadania bez pomyłki"` reads as a *grade*, the tile
   comes out (one `<li>` and one helper, kept that cheap on purpose).

## Environment traps (already paid for — do not rediscover)

- The command sandbox blocks `127.0.0.1:54321`; run the unit suite with the sandbox disabled or
  ~30 tests fail for unrelated reasons.
- A stray dev server on 4321/4322 makes four `gameplay-restore` Playwright runs fail spuriously.
  Check before blaming a diff.
- Local Supabase must be up (`npx supabase status`) for the e2e suite and for
  `tests/report-isolation.test.ts`.

## Next command

```
/10x-impl-review parent-weekly-activity-chart
```
