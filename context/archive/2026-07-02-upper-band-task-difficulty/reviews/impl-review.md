<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Upper-Band Task Difficulty (6–9)

- **Plan**: context/changes/upper-band-task-difficulty/plan.md
- **Scope**: Full plan (Phases 1–3)
- **Date**: 2026-07-06
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Wizard shows tier-1 label for age-9 profiles

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/child/CreateProfileWizard.tsx:86 + src/i18n/pl.ts:144
- **Detail**: `deriveStartingLevel(9)` now returns 3, but the wizard chip maps `level === 2 ? levelNames["2"] : levelNames["1"]` and `levelNames` has only "1"/"2". Age 9 displays "Podstawy" (tier-1 label); persisted `starting_level: 3` is correct. Plan gap — the plan never listed this surface.
- **Fix**: Add `levelNames["3"]` to pl.ts and index by the derived level as a `Record<1|2|3, string>`.
- **Decision**: FIXED — levelNames gains "3": "Podstawy ekstra"; wizard indexes via `level >= 3 ? "3" : level === 2 ? "2" : "1"` (clamps like tierForLevel).

### F2 — Latent success-timer re-arm in stage-2 inline onComplete

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/child/ChangeMakingTask.tsx:95 + src/components/hooks/useCoinTask.ts:55
- **Detail**: useCoinTask's completion effect depends on `onComplete`; stage 2 passes a fresh inline arrow each render, so a parent re-render after the 1400 ms timer fires (instance still mounted) would re-arm it and fire twice. Currently unreachable (ShiftScreen's advance swaps `key` and unmounts) — verified fires exactly once today.
- **Fix**: Wrap stage-2's handler in `useCallback([stageOne, onComplete])` (or a fired-once ref in useCoinTask).
- **Decision**: FIXED — stage-2 handler hoisted into `completeStageTwo` useCallback with a null guard; effect no longer re-arms on unrelated re-renders.

### F3 — Stage-1 arrangement derived in the view layer

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/child/ChangeMakingTask.tsx:69
- **Detail**: Generators own `arrangement` by convention; the island re-derives stage-1 layout inline (`stockCount <= SCATTER_MAX`), duplicating the rule in the view. Behavior identical.
- **Fix**: Add a generator-set `stockArrangement` field beside `stockCount` and read it in the island.
- **Decision**: FIXED — `stockArrangement?` added to the task shape, set by the generator, read by the island (SCATTER_MAX import dropped from the view), asserted in the invariant test.

### F4 — Stale starting_level column comment in an old migration

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260628120000_child_profiles_add_identity.sql:36
- **Detail**: Comment still says "8–9 → 2". No functional impact (no CHECK on starting_level); existing age-9 profiles keeping frozen level 2 is documented, intended behavior.
- **Fix**: Update the comment when the next migration touches child_profiles.
- **Decision**: SKIPPED — deferred; queued in follow-ups/review-fixes.md to ride along with the next child_profiles migration.

### F5 — Shift-inclusion test is statistical, not picker-injected

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: tests/shift.test.ts:72
- **Detail**: The tier-3 inclusion test runs 60 default-RNG shifts (flake bound ≈ 0.7^60 ≈ 5e-10, documented) — forced by the plan's "generateShift dispatcher unchanged" constraint.
- **Fix**: Accept as-is (documented).
- **Decision**: ACCEPTED — flake bound ~5×10⁻¹⁰ is documented in the test; injecting the gate would widen generateShift's signature against the plan's constraint.
