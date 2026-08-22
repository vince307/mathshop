# Handoff — `dashboard-recent-activity` (F2)

Standing brief for this whole run: `context/runs/2026-08-22-autonomous-five/agent-contract.md`.
**Read it first** — it binds every step (no human in the loop, always leave a handoff, report
back in ≤ 12 lines, and the project rules this run keeps tripping over).
Run log and feature list: `context/runs/2026-08-22-autonomous-five/run-log.md` (§ F2).

## State

**Plan written AND reviewed. Verdict: REVISE → SOUND after fixes, which are applied.**
The plan is cleared for implementation.

| Artifact | State |
|---|---|
| `change.md` | **`status: plan_reviewed`** |
| `research.md` | complete (untouched by this step) |
| `plan.md` | **edited by triage** — 4 phases, `## Autonomous decisions` D1–D9, new `## Known risks` R1–R4, `## Progress` (2 rows added) |
| `plan-brief.md` | unchanged — still the 2-minute orientation, but see "one stale line" below |
| `reviews/plan-review.md` | **new** — the full DEEP report + the triage audit trail |
| `handoff.md` | this file |

Still true: **no production code, no migration, no git branch.** Working tree is on
`feat/ui-polish`. The run cuts `feat/dashboard-recent-activity` at implementation time.
Files this step touched: `plan.md`, `reviews/plan-review.md` (new), `change.md`, this handoff.

## The verdict

**REVISE, not RETHINK.** The approach is right and survives review intact: read `shift_log`
newest-first with an app-side `profile_id` filter, map rows to entries in a pure module,
render a zero-JS `.astro` section inside grid block B, show no number the database does not
hold. All four phases, their ordering, and every decision D1–D9 stand. What was wrong was
detail, and the detail is fixed.

**Do not re-plan.** Go straight to implementation.

## What the review fixed in `plan.md` (7 findings)

| # | What was wrong | Now |
|---|---|---|
| **F1** ❌ CRITICAL | Success criteria demanded "17 Playwright runs". `npx playwright test --list` says **"Total: 15 tests in 6 files"** and this change adds assertions, not test cases — the criterion could never close, and `/10x-goal-implement` drives exactly those rows | All three sites read `15/15` with the evidence inline |
| **F2** ⚠️ | `npm run check` was never run, and it is the **only** gate that type-checks `.astro` — `.husky/pre-commit` runs `eslint --fix` alone. Phase 3 adds a component with a nullable typed array prop | Added to Phase 3 automated criteria + Progress `3.11`. Baseline measured green (0 errors, 0 warnings, 8 hints) |
| **F3** ⚠️ | D2 justified stacking below `lg` with "every other multi-column row on this dashboard already does" — **false**: `SkillCards` is `sm:grid-cols-3`, results tiles are `sm:grid-cols-4` | Rationale corrected with the real class strings; the class choice itself deferred → **R3** |
| **F4** ⚠️ | The isolation suite's cross-account case passed whether or not the `profile_id` filter existed (account B had no rows to leak) | B now seeds its own profile + row; case 1 asserts the row **`id`**, not just length |
| **F5** ⚠️ | D5's F1-compatibility claim was blanket. Two same-hunk collisions survive append-only editing | Both named concretely in D5 → **R1** |
| **F6** ⚠️ | Phase 2 SC put `git diff … appended lines only` under Manual; Progress had it under Automated as 2.6 | Moved to Automated; the two skills now agree |
| **F7** ⚠️ | Manual step 3 said "matches what the results screen reported" — the results screen renders no task count | Compare against the `Zadanie N z M` line seen during the shift |

Recorded but **not** acted on (observations): F8 house-style colon on `#### … Verification`
headings (breaks no tooling — verified against `progress-format.md`); F9 `templateRegex` is a
more explicit locator than the prefix-substring trick; F10 nothing validates
`docs/reference/contract-surfaces.md`.

## Unresolved risk the implementer must carry — new `## Known risks` in `plan.md`

**R1 — `src/lib/services/reports.ts` may conflict at EOF with F1.** F1
(`context/changes/parent-weekly-activity-chart/`) has **no `plan.md` yet** — only `change.md`
(`status: preparing`), `research.md`, `handoff.md` — so every compatibility claim is projected
from F1's *research*. F2 appends `RecentActivityRow` + `listRecentActivity` at EOF; F1's
research describes its day bucketing as a new pure fold that would most naturally go in the
same file. **If git conflicts at the tail of `reports.ts`, rebase and keep BOTH symbol sets —
never resolve ours/theirs on that hunk.** Same for `docs/reference/contract-surfaces.md:38`:
the Consumed-by line must end up naming both consumers. (Nothing validates that file, so a
mis-merge there is silent.)

**R2 — do not reuse `ShiftLogRow` after F1 lands.** Once F1 adds `created_at` the two
interfaces look nearly identical. The feed also needs `id`; keep them separate.

**R3 — the feed's column breakpoint is unverified at 712px.** `grid gap-3 lg:grid-cols-3`
makes the feed the only 1-across row on the dashboard in the `touch` project, between a
3-across and a 4-across sibling. Defensible (entry labels are long) but a deviation.
**Evaluate at manual criteria 3.6 / 3.7 / 4.4; Progress row 4.6 forces an explicit answer.**
Switching to `sm:grid-cols-3` — or back — is one token on one element.

**R4 — the feed may legitimately miss an event.** `appendShiftLog` swallows its error and
shares no transaction with the profile UPDATE. Never word or read the feed as a reconciliation
of `wallet_balance` / `completed_shift_count`.

## What the review confirmed (so nobody re-litigates it)

- **RLS on `shift_log` is account-scoped** — all four policies are `auth.uid() = account_id`
  (`…create_shift_log.sql:41-64`). The app-side `.eq("profile_id", …)` is the **only** thing
  separating siblings. `getWeeklyReport:110` is the precedent.
- **The isolation test genuinely goes red if the filter is dropped.** Traced: two profiles in
  one account, one row each → the unfiltered query returns 2 rows where the test demands
  exactly A1's one. `tests/shift-log-isolation.test.ts` and `tests/report-isolation.test.ts`
  both stay green through that same break, so the new suite is not redundant.
- **`Dzisiaj` IS a substring of `t.start.missionHeading`** (`src/i18n/pl.ts:203`, "Dzisiaj
  nauczysz się", rendered at `start.astro:164`). **Never assert `t.start.activityToday`.**
- **The empty-state copy does not contain `Ukończone zmiany`** (`t.start.statShifts`,
  `pl.ts:208`), and `Zmiana ukończona` contains it in neither direction. Both wordings are
  load-bearing — do not "tidy" either.
- **No collision the plan missed.** `aktywno*` and `Ostatni*` appear nowhere else in `pl.ts`;
  `grep -rn "t\.start\." e2e/` returns exactly the six locators the plan's audit table lists,
  at the line numbers it gives; the reverse direction (new strings breaking old locators) is
  clean too.
- **Every rendered value is stored.** `N zadań` is `math.completed + money.completed`, and
  `ShiftScreen.tsx:85-92` increments `completed` once per task posting only math/money — so
  it is the shift's exact task count, not an estimate. No money figure of any kind.
- **The mobile treatment is honestly labelled an extrapolation** (Overview, D2, brief), and
  the placement works: block B is `order-last`, so nesting inside it keeps the feed last on
  mobile; a fourth grid sibling would have rendered *before* it. Confirmed against
  `start.astro:90`/`:139`.
- **Phase granularity passes.** Stopping after any phase leaves a working app: 1 and 2 add
  unreferenced code, 3 ships the feature, 4 adds coverage.

## One stale line to ignore

`plan-brief.md`'s scope line still says "a one-line `contract-surfaces.md` update" and its D9
row predates the F4 strengthening. The brief was deliberately **not** rewritten — `plan.md` is
authoritative. Read `plan.md` § Phase 2 and § Known risks over the brief wherever they differ.

## Next command

```
/10x-implement dashboard-recent-activity phase 1
```

Read `plan-brief.md` for orientation, then `plan.md` in full — especially the new
`## Known risks` section. `reviews/plan-review.md` has the evidence behind every fix if a
decision looks arbitrary.

## Verification baseline (measured during this step, not assumed)

```bash
npm run lint          # clean
npm run check         # astro check — 163 files, 0 errors, 0 warnings, 8 hints  ← NEW GATE (F2)
npm test              # 299 tests; 30 fail ONLY when the local Supabase stack is down
npx playwright test   # 15/15 = 13 desktop + 2 touch. NOT 17 — the count does not change (F1)
```

`npx supabase start` must be up for the integration suites and e2e. Demo account:
`ui-polish-demo@example.test` / `test-password-123!`, parent PIN `2468`, profile "Ania".
