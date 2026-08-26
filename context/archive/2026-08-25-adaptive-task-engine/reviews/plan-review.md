<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Adaptive Task Engine (P1 + P3)

- **Plan**: `context/changes/adaptive-task-engine/plan.md`
- **Mode**: Deep
- **Date**: 2026-08-25
- **Verdict**: REVISE (all findings triaged and applied)
- **Findings**: 2 critical, 5 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | FAIL → resolved (F1) |
| Lean Execution | WARNING → accepted as-is (F8) |
| Architectural Fitness | WARNING → resolved (F4) |
| Blind Spots | FAIL → resolved (F3, F7) |
| Plan Completeness | FAIL → resolved (F2, F5, F6, F9) |

Note on the verdict: the rubric maps three FAIL dimensions to RETHINK. REVISE was
chosen deliberately — the approach survived review intact; only the specification
had gaps, and every fix was an addition to the plan rather than a change of
architecture.

## Grounding

13/13 paths ✓, symbols ✓, brief↔plan ✓, Progress 44/44 rows ✓ (47/47 after fixes)

## Findings

### F1 — Nothing governed which *kind* of task a child may receive

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes
- **Dimension**: End-State Alignment
- **Location**: Phase 3 (generators) + Phase 5 (adaptation)
- **Detail**: The two-stage gate is `difficultyTier === 3` (`src/data/change-making-tasks.ts:64`) — a hard equality, structurally unreachable below level 3. Converting to a continuous `d` turns it into a crossable threshold. The plan never used the word "threshold", never said what replaces the gate, and never stated the invariant `ceilingForLevel(1|2) < twoStageThreshold`. All four guards the plan specified (warm-up, cooldown, drift clamp, ceiling) bound *magnitude*; none bounds *scenario-kind admission*. Three consequences: a six-year-old receives a multi-step task that S-03 deferred as overshooting grades 1–2, and no success criterion catches it because they all concern number bands; `tests/shift.test.ts:93-101` fails **flakily**, not deterministically; every gameplay e2e dies because `e2e/helpers/solve-shift.ts:41-45` throws on stage 1's unmatched question string.
- **Fix A ⭐ Recommended**: Explicit `TWO_STAGE_THRESHOLD` in `adaptive.ts` carrying the invariant `ceilingForLevel(2) < TWO_STAGE_THRESHOLD`, plus a test over `d` replacing the two tier-veto tests.
  - Strength: Turns intent into a checkable property.
  - Tradeoff: Forces choosing a threshold value in Phase 3.
  - Confidence: HIGH — the gate has exactly one reader.
  - Blind spot: `STOCK_AND_CHANGE_RATE` has zero direct tests; it is exercised only statistically by `tests/shift.test.ts:72-91`, whose comment hardcodes `0.7^60`.
- **Fix B**: Keep the gate on the old tier, independent of `d`.
  - Strength: Zero regression risk.
  - Tradeoff: Keeps `tierForLevel` alive as a second, parallel source of truth about difficulty — the exact dualism this change exists to remove.
- **Decision**: FIXED via Fix A

### F2 — `difficultyTier` had no destination

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM
- **Dimension**: Plan Completeness
- **Location**: Phase 2 ↔ Phase 3
- **Detail**: `src/types.ts:36` and `:75` declare `difficultyTier: 1|2|3` as a **required** field. Phase 2 depended on it; Phase 3 removed its only producer by demoting `tierForLevel` to seeding. `src/types.ts` appeared in no phase. Blast radius: 9 assertion sites + 3 fixture literals, and the field is JSON-serialized into the SSR island props (`task.astro:51-53`), so a type change is a hydration-payload change.
- **Fix**: `Task` carries `difficulty: number`; `difficultyTier` removed. `src/types.ts` and the affected tests added to Phase 3; Phase 2's contract corrected so it no longer depends on a field Phase 3 deletes.
- **Decision**: FIXED

### F3 — `MAX_SHIFT_TASKS` could not be computed as promised

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM
- **Dimension**: Blind Spots
- **Location**: Phase 3, change #4
- **Detail**: `src/data/shift.ts:30` is `SHIFT_LENGTH[3].max + MAX_BONUS_TASKS` = 17. When `SHIFT_LENGTH` stops being a `Record<1|2|3,…>`, the `[3]` index ceases to exist. The plan said the value "must retain its current value" without saying how. Failure direction that reaches a user: if it ever falls below the longest generated shift, `complete.ts:82` returns 400 and the **entire** shift-end write is lost — wallet, `completed_shift_count`, `business_level`, `skill_state`, the `shift_log` row and the telemetry array — irrecoverably, since mid-shift state is never persisted (FR-016). `MAX_SHIFT_MISSES` is derived from it at 10× and gates `misses` → `skill_state` → upgrades. `tests/shifts-complete.test.ts:159-166` is self-referential and would track any new value silently.
- **Fix**: Explicit constant `17` with a comment binding it to the length function's maximum plus `MAX_BONUS_TASKS`, plus a test that no reachable `d` generates a longer shift.
- **Decision**: FIXED

### F4 — Phase 3 added a column without registering it

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Architectural Fitness
- **Location**: Phase 3, change #2
- **Detail**: Four of four prior column-adding migrations updated `docs/reference/contract-surfaces.md` in the same commit — the **Defined in** and **Columns** bullets of `## public.child_profiles`. An unbroken convention with no automated check. The plan states this exact hazard in Phase 1 about `task_attempt` ("an omission fails silently and permanently") and then commits the omission one phase later on `child_profiles`.
- **Fix**: Registration item added to Phase 3, with a manual verification criterion and a Progress row.
- **Decision**: FIXED

### F5 — Five consumers outside the plan's file list

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM
- **Dimension**: Plan Completeness
- **Location**: Phases 3–5
- **Detail**: `src/types.ts` (see F2); `tests/tasks.test.ts` (covers the `generateTask` dispatcher whose signature changes); `e2e/helpers/accounts.ts` (seeder never writes `starting_level`, relies on the column default); the `ChildProfile` interface (`src/lib/services/child-profiles.ts:27-33`), which the profile travels through via `resolvePageProfile`; `src/data/upgrades.ts:44` (`MAX_BONUS_TASKS`, the second operand in F3).
- **Fix**: All added to the relevant phases. The e2e seeder needs no change — `difficulty_state = '{}'` normalises to the level-1 seed, which is exactly the tier-1 envelope the assertions require — but this is now stated as a verified property rather than left as an accident.
- **Decision**: FIXED

### F6 — "age-derived" and `starting_level` are not the same thing

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Plan Completeness
- **Location**: plan:345, :611 vs :329, :359
- **Detail**: The plan used both phrasings interchangeably. E2E's `seedChildProfile` never writes `starting_level` — it relies on the column default of 1 and bypasses `deriveStartingLevel` entirely, so the comment at `accounts.ts:36` describes a mechanism that is not there.
- **Fix**: Unified on `starting_level` throughout; age is not an input to the engine.
- **Decision**: FIXED

### F7 — The `difficulty` column carried two different meanings

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM
- **Dimension**: Blind Spots
- **Location**: Phase 2 ↔ Phase 3
- **Detail**: Phase 2 wrote a normalised tier; Phase 3 onward writes real `d`. Nothing distinguished the two, in the very table whose purpose is tuning on data.
- **Fix**: `difficulty` is nullable and left null in Phase 2, populated from Phase 3 on. Difficulty is constant per profile in Phase 2 anyway, so nothing is lost.
- **Decision**: FIXED

### F8 — Weak-competency type bias is separable from the goal

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Lean Execution
- **Location**: Phase 5, change #2
- **Detail**: Desired End State speaks of `d` per competency, not of a bias in type selection. Removing it would not violate the goal. It is the only element of Phase 5 not required by the stated end state, and it carries a frustration risk raised during brainstorming.
- **Decision**: SKIPPED — kept in Phase 5; the decision was taken at design time and scope is unchanged.

### F9 — Backticks in the Phase 1 heading

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Completeness
- **Detail**: `## Phase 1: \`task_attempt\` table…` did not match `### Phase 1: task_attempt table…` in Progress; the Progress contract requires matching names.
- **Fix**: Backticks removed from the body heading.
- **Decision**: FIXED
