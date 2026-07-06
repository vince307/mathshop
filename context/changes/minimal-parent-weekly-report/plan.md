# Minimal Parent Weekly Report (S-09) — Verify & Harden Implementation Plan

## Overview

Close roadmap **S-09** (FR-016) by hardening the weekly report that **already shipped in S-07** — not by building a report. Three gaps remain between the shipped code and FR-016's guarantees: (1) the week boundary is Monday 00:00 **UTC** while the audience lives in Poland, (2) a failed `shift_log` query silently renders as a truthful-looking "empty week", and (3) the PRD-named cross-account isolation check exists only at the table level, never driving the actual read path. Plus one process item: the report copy is draft Polish pending native review.

## Current State Analysis

From `frame.md` (hypothesis investigation, all file:line-verified):

- **The report is built and live**: `src/pages/app/report.astro` (PIN-gated SSR route) → `src/lib/services/reports.ts` (`getWeeklyReport` + pure `aggregateWeeklyReport`) → `src/components/parent/WeeklyReport.tsx` (per-child cards: practiced competencies + unlocked upgrades tied to skills). Copy in `t.report.*` is educational and non-shaming with all empty states covered. S-07's archive contains **no deferral** of report scope to S-09.
- **Week window**: `startOfWeek` (`reports.ts:50-54`) computes Monday 00:00 UTC, used as `gte("created_at", …)`. Poland is CET/CEST (UTC+1/+2), so play between 00:00–02:00 Monday local time is attributed to the previous week. `now` is already injectable; `startOfWeek` is private and untested.
- **Swallowed errors**: `getWeeklyReport` destructures only `{ data }` (`reports.ts:66`) and folds `data ?? []` — a DB error is indistinguishable from a genuinely empty week. The route `Promise.all`s per-profile reports (`report.astro:29-39`) with no error handling.
- **Isolation**: RLS on `shift_log`/`child_profiles` is table-level tested (`tests/shift-log-isolation.test.ts`, `tests/child-profiles-isolation.test.ts`), but `grep getWeeklyReport tests/` is empty — no test drives the read path with two accounts. `docs/reference/contract-surfaces.md:37-38` points the report consumer at the table-level test only. S-07 Phase 6 verified "own children only" manually.
- **Test infra ready**: `tests/helpers/supabase.ts` provides `createSignedInUser`/`deleteUser`/`admin` (provisioning only); `tests/reports.test.ts` covers the pure aggregator.

## Desired End State

A parent in Poland sees "this week" mean **Monday 00:00 Europe/Warsaw**; a failed report query shows an honest per-child Polish "couldn't load" card instead of a fake empty week; an automated two-account test proves the read path returns own-data-only (empty for a non-owner probing another profile id) and the contract registry points at it. Verify: unit tests pin the Warsaw boundary incl. DST edges; the isolation test is green against a fresh DB; `npm run check`/`lint`/`build` green; native-speaker review of `t.report.*` is queued (manual). S-09 then closes on the roadmap via `/10x-archive`.

### Key Discoveries:

- `now` is already an injectable parameter of `getWeeklyReport` (`reports.ts:64`) — the Warsaw boundary and its tests need no signature change.
- Node's `Intl.DateTimeFormat` with `timeZone: "Europe/Warsaw"` gives DST-correct wall-clock parts without adding a dependency — the stack has no date library and shouldn't gain one for this.
- The per-child card structure of `WeeklyReport.tsx` (`ChildSection`) makes a per-child error state natural: a nullable `report` on `ChildReport` and one new `t.report.loadError` string.
- The isolation-test pattern is fully established (L-001/L-002): positive control first, then the negative check, service-role client only for provisioning/teardown.

## What We're NOT Doing

- **No mockup-fidelity work.** The `05-parent-weekly-report` v3 mockup depicts the **parked "richer parent report" tranche** (week picker, export, stat tiles, daily chart, recommended missions); prd-v3 non-goals exclude the full parent dashboard from v1. Fidelity items route there, not here (frame.md, hypothesis 3).
- **No new report content or data.** No % correct (would flirt with the non-shaming guardrail), no historical weeks, no trends.
- **No fix for the best-effort `appendShiftLog` undercount** — a deliberate, commented S-07 tradeoff (`child-profiles.ts:87-93`); revisiting it is out of scope.
- **No retroactive re-attribution of existing rows** — the boundary change only alters how future report queries window `created_at`; stored data is untouched (no migration).
- **No route-level (SSR page) test harness.** The read path under test is the service (`getWeeklyReport`) with real signed-in clients; the PIN gate already has its own tests.

## Implementation Approach

Two small phases, each shippable. **Phase 1** fixes correctness in the service + UI: make `startOfWeek` Warsaw-anchored and exported (unit-testable, DST edges pinned), make `getWeeklyReport` throw on query error, and render a per-child Polish error card. **Phase 2** adds the assurance layer FR-016 names: a two-account isolation test that drives `getWeeklyReport` itself, plus the contract-registry pointer, and queues the native copy review. Both phases are TDD-friendly (pure boundary function; thrown-error contract; the isolation test *is* the deliverable).

## Critical Implementation Details

- **DST-safe Warsaw Monday without a library.** Compute the Warsaw wall-clock date of `now` via `Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", … })` parts, walk back to Monday in wall-clock space, then resolve that wall-clock midnight to a UTC instant using the zone's offset at that moment (offset derivable from the same Intl parts, e.g. via `timeZoneName: "longOffset"`). Two subtle cases must be unit-tested: the spring-forward and fall-back weekends, and a `now` late Sunday UTC that is already Monday in Warsaw.
- **Error contract ordering.** `getWeeklyReport` starts throwing in the same phase that the route catches — landing the throw without the catch would turn a silent-empty into a 500. Phase 1 lands both sides together with the component's error card.

## Phase 1: Correctness hardening — Warsaw week + honest failure

### Overview

Fix the two correctness gaps in the shipped report: the week boundary becomes Monday 00:00 Europe/Warsaw (exported, DST-tested), and a failed query surfaces as a per-child Polish error card instead of a false empty week.

### Changes Required:

#### 1. Warsaw-anchored, exported week boundary

**File**: `src/lib/services/reports.ts`

**Intent**: Make the report window match the Polish parent's calendar week and make the boundary unit-testable.

**Contract**: `startOfWeek(now: Date): string` becomes **exported** and returns the UTC ISO instant of the most recent Monday 00:00 **Europe/Warsaw** wall-clock time (per Critical Implementation Details). `getWeeklyReport`'s signature and the `gte("created_at", …)` usage are unchanged. Update the module/function comments to state the Warsaw semantics.

#### 2. Surface query errors

**File**: `src/lib/services/reports.ts`

**Intent**: A DB failure must be distinguishable from an empty week.

**Contract**: `getWeeklyReport` destructures `{ data, error }` and **throws** the error when present; the `data ?? []` fold remains for the success path. `aggregateWeeklyReport` unchanged.

#### 3. Per-child error handling in the route

**File**: `src/pages/app/report.astro`

**Intent**: Catch each child's failed report so one failure doesn't hide the others or 500 the page.

**Contract**: The per-profile mapping wraps `getWeeklyReport` in try/catch; `ChildReport.report` becomes `WeeklyReport | null` (null = load failed). No change to auth/PIN gating.

#### 4. Error card in the island + copy

**File**: `src/components/parent/WeeklyReport.tsx`, `src/i18n/pl.ts`

**Intent**: Render an honest, warm Polish "couldn't load this child's report" state (L-003 — copy in the dictionary).

**Contract**: `ChildSection` renders a `t.report.loadError` card (child identity still shown) when `report` is null; practice/upgrade sections render only for a non-null report. New `loadError` string in the `t.report` block. No other visual changes.

#### 5. Unit tests for the boundary + error contract

**File**: `tests/reports.test.ts`

**Intent**: Pin the Warsaw week semantics (incl. DST edges) and the thrown-error contract with the established deterministic style.

**Contract**: `startOfWeek` cases — a mid-week `now`; a Sunday-late-UTC `now` that is already Monday in Warsaw; spring-forward and fall-back weekends; result is always an ISO instant equal to Warsaw Monday midnight. Error contract covered at whichever seam is cleanest without a DB (e.g., a stubbed client asserting `getWeeklyReport` rejects when the query returns an error). Existing aggregator tests unchanged.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npx vitest run tests/reports.test.ts`
- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- Full suite passes against a fresh DB: `npx supabase db reset` then `npx vitest run`

#### Manual Verification:

- Report renders normally for a child with current-week play (Warsaw window)
- With Supabase stopped (or a forced query error), the report page shows the per-child Polish error card — not an empty week, not a 500
- No inline literals in the edited surfaces (L-003)

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: Read-path isolation test + registry + copy review

### Overview

Add the assurance FR-016 explicitly names: an automated two-account test driving `getWeeklyReport`, register it in the contract registry, and queue the native-speaker copy review.

### Changes Required:

#### 1. Two-account read-path isolation test

**File**: `tests/report-isolation.test.ts` (new)

**Intent**: Prove the actual read path returns own-data-only, per the PRD constraint ("the natural place to re-exercise the cross-account isolation negative check") and L-001/L-002.

**Contract**: Using `tests/helpers/supabase.ts`: provision accounts A and B; seed a child profile + ≥1 current-week `shift_log` row for A (service-role client for provisioning only); **positive control** — `getWeeklyReport(A.client, profileA)` reflects the seeded practice; **negative** — `getWeeklyReport(B.client, profileA)` resolves to the zeroed/empty report (RLS hides rows; per `reports.ts:57-59` a non-owner sees empty, not an error); B also cannot list A's profiles (`listChildProfiles(B.client)` excludes profileA). Teardown deletes both users.

#### 2. Register the read-path test

**File**: `docs/reference/contract-surfaces.md`

**Intent**: The registry currently points the report consumer at the table-level test only; add the read-path test so the isolation story is discoverable.

**Contract**: Under the `public.shift_log` section's consumer/isolation lines, add `tests/report-isolation.test.ts` as the read-path isolation coverage. Prose-only edit.

#### 3. Queue the native copy review

**File**: `context/changes/minimal-parent-weekly-report/follow-ups/copy-review.md` (new)

**Intent**: `t.report.*` (and the new `loadError`) are draft Polish "pending native-speaker review" — record the queue so closing S-09 doesn't lose it.

**Contract**: A short checklist file listing the `t.report.*` keys (incl. `loadError`) for native review; owner: user. No code change.

### Success Criteria:

#### Automated Verification:

- Isolation test passes against a fresh DB: `npx supabase db reset` then `npx vitest run tests/report-isolation.test.ts`
- Meta-check (L-002 spirit): temporarily weakening the `shift_log` SELECT policy makes the negative case fail (verified during development, not committed)
- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Full suite passes: `npx vitest run`

#### Manual Verification:

- Exercise the live report screen once end-to-end (play a shift, open `/app/report`, verify the practiced counts and any unlock appear under the Warsaw week)
- Native copy review queued (follow-up file exists; review itself happens outside this change)

**Implementation Note**: Final phase — after verification, S-09 closes via `/10x-archive` (roadmap flip is automatic).

---

## Testing Strategy

### Unit Tests (`tests/reports.test.ts`):

- Warsaw `startOfWeek`: mid-week, Sunday-late-UTC/Monday-in-Warsaw, spring-forward and fall-back weekends.
- `getWeeklyReport` rejects on query error (stubbed client); success path unchanged.
- Existing `aggregateWeeklyReport` suite stays green.

### Integration Tests (local Supabase stack):

- `tests/report-isolation.test.ts`: positive control + cross-account negative on the real read path; profile listing scoped; teardown clean.
- Full suite against a fresh DB at each phase.

### Manual Testing Steps:

1. Play a shift on a child profile, open `/app/report` behind the PIN gate, confirm the practice counts + unlocked upgrade appear (current Warsaw week).
2. Force a query failure (stop Supabase or break the URL locally): the child's card shows the Polish load-error state; page renders, no 500.
3. Confirm copy reads warm/educational; `loadError` included in the queued native review.

## Performance Considerations

None material: one `Intl.DateTimeFormat` computation per report request; the query and rendering are unchanged.

## Migration Notes

**No migration.** The boundary change affects only how queries window `created_at` going forward; a report viewed right after deploy may attribute the Sunday 22:00–24:00 UTC sliver differently than before — cosmetic and self-resolving within a week.

## References

- Frame: `context/changes/minimal-parent-weekly-report/frame.md` (authoritative problem statement)
- Spec: `context/foundation/prd-v3.md:117,133` (FR-016 + isolation constraint); `context/foundation/roadmap.md` §S-09
- Shipped report: `src/lib/services/reports.ts`, `src/pages/app/report.astro`, `src/components/parent/WeeklyReport.tsx`, `src/i18n/pl.ts:318-333`
- Test patterns: `tests/helpers/supabase.ts`, `tests/shift-log-isolation.test.ts`, `tests/reports.test.ts`
- Lessons: L-001/L-002 (isolation testing), L-003 (i18n)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Correctness hardening — Warsaw week + honest failure

#### Automated

- [x] 1.1 Unit tests pass: `npx vitest run tests/reports.test.ts` — ecfbf5d
- [x] 1.2 Type checking passes: `npm run check` — ecfbf5d
- [x] 1.3 Linting passes: `npm run lint` — ecfbf5d
- [x] 1.4 Build succeeds: `npm run build` — ecfbf5d
- [x] 1.5 Full suite passes against a fresh DB (`supabase db reset` + `vitest run`) — ecfbf5d

#### Manual

- [x] 1.6 Report renders normally for a child with current-week play (Warsaw window) — ecfbf5d
- [x] 1.7 Forced query error shows the per-child Polish error card (no empty week, no 500) — ecfbf5d
- [x] 1.8 No inline literals in edited surfaces (L-003) — ecfbf5d

### Phase 2: Read-path isolation test + registry + copy review

#### Automated

- [x] 2.1 Isolation test passes against a fresh DB (`supabase db reset` + `vitest run tests/report-isolation.test.ts`)
- [x] 2.2 Type checking passes: `npm run check`
- [x] 2.3 Linting passes: `npm run lint`
- [x] 2.4 Full suite passes: `npx vitest run`

#### Manual

- [x] 2.5 Live report exercised end-to-end (shift → `/app/report` → counts/unlocks under Warsaw week)
- [x] 2.6 Native copy review queued (follow-up file exists)
