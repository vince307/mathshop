# Frame Brief: S-09 minimal-parent-weekly-report — build it, or close the gap?

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

S-09 (minimal-parent-weekly-report, FR-016) is still open on the roadmap
(status `proposed`, prerequisites S-06 + S-07 both done), yet S-07's phase 6
already shipped a PIN-gated report screen — `src/pages/app/report.astro`,
`src/components/parent/WeeklyReport.tsx`, `src/lib/services/reports.ts`
(commit `0c61253`) — showing per-child weekly practice and unlocked upgrades
tied to skills.

## Initial Framing (preserved)

- **User's stated cause or approach**: S-09 may already be satisfied by the shipped S-07 report screen.
- **User's proposed direction**: decide whether to close S-09 as satisfied, or scope only the residual gap against FR-016.
- **Pre-dispatch narrowing**: the bar for "satisfied" is FR-016 + the roadmap outcome **and** the parent-weekly-report mockup (visual fidelity counts); the user has only seen the commit/code — the screen's real behavior is unverified.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Service semantics vs FR-016** — the shipped `getWeeklyReport` might not deliver a real "weekly" window or the full practiced/unlocked/skills content.
2. **Isolation verification** — PRD §Constraints and the S-09 risk line name this read path as "the natural place to re-exercise the cross-account isolation negative check"; code comments claim RLS scoping but a test might not exist.
3. **Mockup fidelity** — the shipped minimal card list vs the canonical `05-parent-weekly-report` v3 mockup.
4. **Nothing remains** — S-09 is fully satisfied; only roadmap bookkeeping is left. ← initial framing

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| 1: Service falls short of FR-016 | Mostly falsified. Server-side ISO-week window (`reports.ts:50-54,64,70`) over DB-set `created_at`; practice from `shift_log.skills` via the write path's own fold (`reports.ts:37-47`); upgrades window-scoped via `upgrade_purchased`; read-only; non-shaming Polish copy with empty states (`pl.ts:320-333`). Residuals: swallowed query error renders as a false "empty week" (`reports.ts:66`); week boundary is **UTC** Monday, not Poland time (CET/CEST); `appendShiftLog` is best-effort so the report can undercount (deliberate, commented); copy is "Draft Polish — pending native-speaker review". | WEAK |
| 2: Isolation read-path test missing | Table-level RLS tests exist (`tests/shift-log-isolation.test.ts`, `tests/child-profiles-isolation.test.ts`) but **no test drives `getWeeklyReport` or `/app/report` with two accounts**; `grep getWeeklyReport tests/` is empty; S-07's Phase 6 verified "own children only" **manually** only; no written deferral. `contract-surfaces.md:37-38` points the report consumer at the table-level test. | STRONG |
| 3: Mockup fidelity gap is S-09 scope | The v3 mockup is a full dashboard (week picker, export, stat tiles incl. % correct, daily bar chart, skill progress deltas, recommended missions). prd-v3 non-goals: "No full parent dashboard — only the minimal weekly report ships"; roadmap Parked: "Richer parent report — trends + recommendations beyond the minimal S-09 view" is a future tranche. The mockup depicts that parked tranche, not S-09's bar. (Some of it — % correct tiles — would even violate the non-shaming guardrail as shipped copy.) | WEAK |
| 4: Nothing remains (initial framing) | The build largely exists and S-07 deferred nothing in writing — but the PRD's named isolation re-exercise is absent and the false-empty-report failure mode misinforms parents. "Close as satisfied" would leave a spec'd verification and a real correctness wart unowned. | WEAK |

## Narrowing Signals

- Both investigation agents independently converged on the missing read-path
  isolation test (one was not told the other's hypothesis) — the strongest
  single signal.
- S-07's archive (plan, brief, impl-review, follow-ups) contains **no
  deferral** of report scope to S-09; Phase 6 shipped FR-016 knowingly.
- The mockup lives in `math-economy-missing-screens-v3/`, the set matching the
  parked richer-report tranche; prd-v3 non-goals textually exclude the full
  dashboard from v1.

## Cross-System Convention

This project's convention for account-owned data (L-001/L-002) is: RLS +
an explicit cross-account isolation test that verifies durable state, per
surface. Every prior read/write surface (child_profiles, shift_log,
account_settings) got one. The report read path is the sole consumer surface
verified only manually — the leading hypothesis matches the convention gap
exactly.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: S-09 is not "build the weekly
> report" — it is "verify and harden the already-shipped report to FR-016's
> guarantees": an automated two-account isolation test driving the real read
> path, a non-silent failure state for the swallowed query error, a decision
> on the UTC-vs-Poland week boundary, and native-speaker sign-off on the
> draft copy.

The report itself shipped inside S-07 with no written deferral. What FR-016
still lacks is the *assurance* layer: the PRD-named isolation re-exercise
exists only at the table level, and a DB error currently renders as a
truthful-looking "nothing practiced this week". The full-dashboard mockup is
the parked richer-report tranche and should not be pulled into S-09.

## Confidence

**HIGH** — strong file:line evidence, independent agent convergence, matches
the project's L-001/L-002 convention, and the mockup tension resolves
textually against prd-v3 non-goals.

## What Changes for /10x-plan

Plan a small verification-and-hardening slice, not a feature build: (1)
read-path isolation test (two accounts → own-only/empty report, service-role
durable-state check per L-002), (2) surface the query-error state instead of
false-empty, (3) decide + pin the week-boundary timezone (likely
Europe/Warsaw), (4) queue native copy review. Then close S-09 on the
roadmap. Mockup fidelity items route to the parked richer-report tranche,
not this change.

## References

- Source files: `src/lib/services/reports.ts:50-71`, `src/pages/app/report.astro:25-36`, `src/components/parent/WeeklyReport.tsx`, `src/i18n/pl.ts:318-333`
- Spec: `context/foundation/prd-v3.md:117,133` (FR-016 + isolation constraint), `context/foundation/roadmap.md` §S-09
- Prior change: `context/archive/2026-07-01-skill-path-upgrade-gate/` (report shipped in Phase 6; no deferral)
- Mockups: `assets/math-economy-missing-screens-v3-{web,mobile}/05-parent-weekly-report-*.png` (parked tranche)
- Investigation tasks: #4 (H1 semantics), #5 (H2 isolation), #6 (H3 mockup)
