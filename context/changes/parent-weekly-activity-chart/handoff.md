# Handoff — `parent-weekly-activity-chart` (F1)

> **Read first:** `context/runs/2026-08-22-autonomous-five/agent-contract.md` — the standing brief
> for this run. No human in the loop; decide, record under `## Autonomous decisions`, continue.

**Status:** `plan_reviewed` · **Next command:** `/10x-implement parent-weekly-activity-chart`
**Blocked on:** F2 (`dashboard-recent-activity`) landing on `feat/ui-polish` — see *Branching*.

---

## What this change is

Two additions to the PIN-gated parent weekly report (`/app/report`), per
`assets/matmaverse-missing-screens-v3-web/05-parent-weekly-report-web.png`:

1. a **Monday–Sunday activity bar chart** inside each child's card — the daily decomposition of the
   "Ukończone zadania" tile already shown above it;
2. a **first-try tile** (`"Zadania bez pomyłki"`) — the share of the week's tasks the child got
   right with no wrong taps, over `math + money` only.

Both are built entirely from data already stored. **No migration, no new query, no new dependency,
no charting library.** The mockup's "+84 zł" earnings tile is explicitly out of scope — it is
blocked on a `shift_log.earned` column that F4 owns.

## State

| Artifact | State |
|---|---|
| `change.md` | `status: plan_reviewed`, updated 2026-08-23 |
| `research.md` | complete (2026-08-22) — ground truth, read before the plan |
| `plan-brief.md` | complete |
| `plan.md` | complete, **reviewed twice**, fixes applied inline |
| `reviews/plan-review.md` | **written this step** — verdict **SOUND**, 9 findings, all triaged |
| Branch | **none cut yet** |
| Code | **none written** |

## What this step did

The 2026-08-22 deep review produced findings **R1–R14**, applied them into `plan.md`, then was
killed by an API limit **before saving its report**. `reviews/` was empty and `change.md` still read
`planned`. This step closed that gap properly rather than rubber-stamping it: it re-verified all
fourteen R-findings against the code, reconciled the plan with what has changed underneath it, and
wrote the report.

### Previously-applied findings — verification verdicts

**All 14 were genuinely applied** (none recorded as applied without being applied). **13 of 14 rest
on premises that check out against the code.** Highlights of what was confirmed:

- **R14 / AD-5 — confirmed and the most valuable of the set.** `src/data/activity.ts:48-57` really
  does export `warsawDayKey`, shipped by F2 in `e40d650`, with `ACTIVITY_TIME_ZONE` (`:18`) and the
  `previousDayKey` UTC-arithmetic idiom (`:67-71`) the plan tells `weekDayKeys` to mirror. No import
  cycle (`activity.ts` imports only `@/data/skills`). **F1 must import it, not write its own.**
- **R2 — confirmed.** `REPORT_TIME_ZONE` / `zoneOffsetMinutes` stay private; F2's plan really does
  refuse to depend on a service module (`dashboard-recent-activity/plan.md:342-343`, quoted
  verbatim-accurately).
- **R3 — confirmed, arithmetic re-derived.** `AppShell.astro:180` is `px-4`; card `p-6` + border
  ⇒ 308 px inner at 390 px ⇒ 62.7 px of text at three-up. `sm:grid-cols-3` is the right call.
- **R4, R9, R13 — confirmed against the files.** F2's exports sit at `reports.ts:147-160` (EOF);
  `contract-surfaces.md` already lists `created_at` (`:31`) and `reports.ts` (`:38`); no 390 px
  viewport exists in CI (`playwright.config.ts:42-54`).
- **R6 — confirmed as a property of the function.** `readSkillState` → `safeCount` guarantees finite
  non-negative counters, so `NaN` is genuinely unreachable inside `firstTryPercent`.
- **`created_at` knock-on edits — complete.** Both breakage sites are named (the `row()` helper at
  `tests/reports.test.ts:13-15` **and** the inline literal at `:39`), and `npm run check` is called
  out explicitly in AD-6.

**The one corrected:** **R1 / AD-1.** Its quotation of the prior parking decision
(`context/archive/2026-07-06-minimal-parent-weekly-report/frame.md:36`) is faithful — both
objections restored, the guardrail line correctly identified as a parenthetical aside, the archived
plan's `:30-31` independently confirming it. But a *supporting* claim inside it is **false**: the
plan said `ParentControls.astro` is "the only component that renders a child-side link to
`/app/report`" and is "rendered on no page at all". Only the second half is true.
`src/components/app/AppShell.astro:65` (bottom bar) and `:120-130` (desktop sidebar) render a
**"Panel rodzica"** link on `start.astro`, `task.astro` and `upgrades.astro` — every child screen.
**The gate still holds** (`report.astro:22-29` hard-redirects without the HMAC marker), so the tile
still ships and AD-1's decision stands — but the soft gate is one visible tap away, not routeless.

### The three deep-dive answers the review was asked for

- **AD-9 vs AD-2 — do the bars add up to the tile above them? Yes, verified through the code.**
  `addSkillDelta`'s per-field step (`skills.ts:82-84`) and `readSkillState`'s (`:62-64`) apply the
  identical `safeCount` to the identical field, so `Σ daily[].completed === Σ_c practice[c].completed`;
  and the tile is `COMPETENCIES.reduce(…)` (`WeeklyReport.tsx:133`) over exactly
  `["math","money","decisions"]` (`skills.ts:16`). A parent adding the seven bars gets the printed
  number. The DST fixture in Phase 1 §5 is also correct. The AD-2 asymmetry (the *ratio* excludes
  `decisions`) is deliberate and defensible, not a silent inconsistency.
- **AD-3 — would the `NaN` assertion catch it on every path? No, as written.** It was attached only
  to the fresh-profile fixture, which exercises the `null` branch that structurally cannot produce
  `NaN`. The `firstTry !== null` branch had no guard. **Fixed** — asserted on every fixture plus a
  new Phase 5 success criterion.
- **AD-5 — one Warsaw implementation? Yes**, provided F1 imports `warsawDayKey`. The plan's
  "if F1 starts first, write a local copy" branch was demoted to a contingency (see *Branching*).

### New findings this step (N1–N9) and what changed in `plan.md`

| # | Sev | Finding | Resolution |
|---|---|---|---|
| N1 | CRITICAL | AD-1's reachability claim is false (`AppShell.astro:65,120-130`) | **FIXED** — correction block in AD-1; `## Known risks` 6 |
| N2 | CRITICAL | F1 and F4 disagree on the post-F1 tile grid | **FIXED** — correction table in "What We're NOT Doing"; `## Known risks` 7 |
| N3 | WARNING | Duplicate risk ID: two different risks both called `E2E-2` | **FIXED** — Phase 6 §3 → `E2E-3` |
| N4 | WARNING | Every `pl.ts` line number in the plan is wrong | **FIXED** — `:394-397` → `:411-414` (5×); `:378-408` → `:395-425` |
| N5 | WARNING | Four broken cross-doc citations | **FIXED** — `prd-v3:174` → `:172` (3×); archived `plan.md:216` → `:24,42`; `plan-brief.md:27` → archived `plan.md:24` (2×); `start.astro:60-61` → `:80` |
| N6 | WARNING | `NaN` assertion scoped to one fixture | **FIXED** — every fixture; new criterion; Progress → `5.1`–`5.8` |
| N7 | OBSERVATION | The AD-9 invariant holds through the code | **DOCUMENTED** in AD-9 |
| N8 | OBSERVATION | `bg-accent/10` isn't "the existing recipe"; `statUpgrades` misquoted | **ACCEPTED** — cosmetic, not fixed |
| N9 | OBSERVATION | The pre-merge fallback path is dead and shouldn't look like a choice | **FIXED** — sequencing is now a hard prerequisite |

Full detail, with evidence per finding, in `reviews/plan-review.md`.

---

## Branching — read this before cutting anything

**Cut `feat/parent-weekly-activity-chart` from `feat/ui-polish` only AFTER F2 has landed there.**
This is a **prerequisite**, not a preference (N9).

- F2 (`dashboard-recent-activity`) is in flight on `feat/dashboard-recent-activity` and has already
  committed `listRecentActivity` (`reports.ts:147-160`) and `warsawDayKey` (`activity.ts:48-57`) in
  `e40d650` / `909e4b9`, with more still uncommitted in that tree.
- `feat/ui-polish` does **not** yet have `src/data/activity.ts`. Cutting F1 before F2 merges forces
  the local-`warsawCivilDate` path — the exact duplicate AD-5 exists to prevent.
- **F1 lands second of three in `src/lib/services/reports.ts`: F2 → F1 → F4.** Keep every F1 edit
  **additive and away from EOF** (insert after `aggregateWeeklyReport` at `:47` or after
  `startOfWeek` at `:92`). Do not restructure, rename, reorder or reformat around existing code, and
  do not change the `stubClient` chain shape in `tests/reports.test.ts` — F2 left that file
  untouched by design and wrote its own thenable stub in `tests/recent-activity.test.ts`.
- After F1 adds `created_at`, `ShiftLogRow` and `RecentActivityRow` differ only by `id`.
  **Do not merge them** — F2 pre-registered that "helpful simplification" as its own risk R2.

## Unresolved risks carried forward

`plan.md` → `## Known risks` holds eight, each with its "becomes real if". The ones that need a
human eye:

1. **A child-side link to `/app/report` ships on every child screen (N1).** The PIN gate is the only
   thing between a child and the first-try tile — soft, 4 digits, 15-minute TTL, one tap away.
   AD-1's own reversal condition should be read as already half-true on the navigation axis.
   Nothing in this plan changes as a result; flagged for the maintainer.
2. **F4's "Handed to F1" recipe is stale and F1 could not fix it (N2).** F4
   (`context/changes/world-progression-stages/plan.md:458+`) expects a 2-tile `grid-cols-2` grid and
   instructs `grid-cols-2` → `sm:grid-cols-3`; after F1 it will find a **3-tile** grid already
   classed `grid-cols-2 sm:grid-cols-3`, so applying that line verbatim leaves a **3 + 1 orphan tile
   row**. It also string-matches `.select("skills, upgrade_purchased")`, which F1 changes, and cites
   the `pl.ts` comment at `:394-396`, which is really `:411-414` and which F1 Phase 3 rewrites
   first. The corrected deltas are tabulated in F1's "What We're NOT Doing". **Whoever implements F4
   must read that table** — this step was scoped to F1's folder and could not edit F4's plan.
3. **AD-1 is a scope override of a PRD-deferred tranche**, authorised by this run's feature brief
   rather than by a PRD edit. `prd-v3.md:172` and `roadmap.md:294` still read as parked. Neither was
   edited unasked.
4. **`statTasks` and `statFirstTry` do not reconcile on screen** — same noun, different populations
   (AD-9's residue). Routed to the open native-speaker copy review with the question stated
   (Phase 3 §3), not solved by inventing a Polish label.
5. **Two `"Europe/Warsaw"` constants** (`reports.ts:50`, `activity.ts:18`). A constant, not logic;
   collapsing it means deciding which module owns the zone — a third change, owned by neither.
6. **The three-tile row and the chart are the first phone-width surfaces this report has gained**,
   and their only automated guard is Phase 6's Risk E2E-2, written against a viewport CI has never
   exercised. If that risk is dropped, the only coverage is manual rows an unattended run skips.

## Verification baseline

`npm run lint` clean · `npm test` **299/299 — may only go up** (the plan expects ≈ 320) ·
`npx playwright test` **15/15** (+ 2 from Phase 6). Local Supabase must be up for the e2e and for
`tests/report-isolation.test.ts` (`npx supabase status`, API on `127.0.0.1:54321`). Demo account
`ui-polish-demo@example.test` / `test-password-123!`, PIN `2468`, profile "Ania".
Never bypass the pre-commit hook.

## Next command

```
/10x-implement parent-weekly-activity-chart
```

Six phases, each independently green and commit-sized: **1** service (`created_at` + seven-day
bucket) → **2** the `firstTryPercent` helper → **3** Polish copy → **4** the chart component →
**5** the tile → **6** hand Phase 6's two browser risks to `/10x-e2e`. Phases 1–3 ship no
user-visible change; 4–5 turn them on.

## Files this step touched

Documentation only — **no production code, no branch created or switched, nothing staged or
committed**. All inside `context/changes/parent-weekly-activity-chart/`:

- `reviews/plan-review.md` — created
- `plan.md` — edited (the eight fixes tabulated above)
- `change.md` — `status: plan_reviewed`, `updated: 2026-08-23`, plan-review step recorded
- `handoff.md` — this file, rewritten
