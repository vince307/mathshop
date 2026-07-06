# Minimal Parent Weekly Report (S-09) — Plan Brief

> Full plan: `context/changes/minimal-parent-weekly-report/plan.md`
> Frame brief: `context/changes/minimal-parent-weekly-report/frame.md`

## What & Why

S-09 is not "build the weekly report" — it is "verify and harden the already-shipped report to FR-016's guarantees": an automated two-account isolation test driving the real read path, a non-silent failure state for the swallowed query error, a decision on the UTC-vs-Poland week boundary, and native-speaker sign-off on the draft copy. (Reframed problem statement, lifted verbatim from the frame.)

## Starting Point

S-07's phase 6 shipped the complete PIN-gated report (`report.astro` → `getWeeklyReport` → `WeeklyReport.tsx`) with non-shaming Polish copy and RLS scoping — the frame's investigation found the service substantially delivers FR-016, with no written deferral. What's missing is assurance, not features.

## Desired End State

"This week" means Monday 00:00 Europe/Warsaw; a failed query shows an honest per-child Polish "couldn't load" card instead of a fake empty week; a two-account test proves the read path returns own-data-only and is registered in `contract-surfaces.md`; the copy review is queued. S-09 then closes on the roadmap.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| What S-09 actually is | Verify + harden, not build | The report shipped in S-07 with no deferral; only assurance gaps remain | Frame |
| Mockup fidelity | Out — parked tranche | prd-v3 non-goals exclude the full parent dashboard; the v3 mockup depicts the parked "richer report" | Frame |
| Week boundary | Monday 00:00 Europe/Warsaw | Matches the Polish parent's mental model; UTC misattributes late-Sunday play | Plan |
| Error surfacing | Per-child error card | Page stays useful; failure is honest and localized to the affected child | Plan |
| Isolation test seam | Service-level (`getWeeklyReport`) with two signed-in clients | The PRD names the read path; helpers + L-001/L-002 pattern already exist | Plan |
| Timezone implementation | `Intl.DateTimeFormat`, no new dependency | Stack has no date library; Intl gives DST-correct Warsaw parts natively | Plan |

## Scope

**In scope:** Warsaw-anchored exported `startOfWeek` + DST unit tests; `getWeeklyReport` throws on query error; per-child error card + `t.report.loadError`; two-account read-path isolation test; contract-registry pointer; queued native copy review.

**Out of scope:** mockup-fidelity/dashboard features (parked tranche); new report content (% correct, history, trends); the deliberate best-effort `appendShiftLog` undercount; data migration; route-level SSR test harness.

## Architecture / Approach

Service-first, two shippable phases: fix the boundary + error contract in `reports.ts` and land the catch/render side in the same phase (throw without catch would 500 the page); then add the isolation test on the established helper pattern and register it. No schema, no new dependencies, no new routes.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Correctness hardening | Warsaw week window (DST-tested) + honest per-child failure state | DST edge cases in the hand-rolled Intl conversion |
| 2. Read-path isolation + registry | Two-account test on `getWeeklyReport`, registry pointer, copy-review queue | Seeding current-week rows deterministically vs the new Warsaw window |

**Prerequisites:** local Supabase stack (Docker) for integration phases; nothing else.
**Estimated effort:** ~1 session, 2 phases — small hardening slice.

## Open Risks & Assumptions

- Assumes `Intl.DateTimeFormat` timezone data is reliable in the Vercel Node runtime (it is in Node ≥ 14; worth one glance at the build target).
- The boundary change shifts the Sunday 22:00–24:00 UTC sliver between weeks once at deploy — cosmetic, self-resolving.
- Native copy review is queued, not performed, inside this change.

## Success Criteria (Summary)

- A Polish parent's "this week" matches their calendar week, verified by DST-edge unit tests.
- A DB failure can never masquerade as "nothing practiced this week."
- An automated test proves a second account reads only an empty report through the real read path — the FR-016 constraint, finally exercised where the PRD asked for it.
