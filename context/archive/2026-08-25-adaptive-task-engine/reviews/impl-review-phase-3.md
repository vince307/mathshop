<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Adaptive task engine — Phase 3

- **Plan**: `context/changes/adaptive-task-engine/plan.md`
- **Scope**: Phase 3 of 5 — Continuous difficulty model (`d04d17a`)
- **Date**: 2026-08-25
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | WARNING |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Success criteria — re-run during review, not taken on trust

| Check | Result |
|---|---|
| `npm run check` | 0 errors, 0 warnings (195 files) |
| `npm run lint` | clean |
| `npm run test` | 489 passed / 55 files |
| `npx playwright test` | 26 passed / 8 files |
| Manual 3.12–3.14 | confirmed by maintainer |

Calibration was verified independently of the test suite: `acrossTiers` at
`d = 0 / 0.5 / 1` yields `SHIFT_LENGTH {5,7}/{8,10}/{9,12}`,
`COUNT_RANGE {3,10}/{6,20}/{10,25}`, `CHANGE_CAP 5/10/15`, `PAID_MAX 10/20/30` —
the legacy tables exactly. `MAX_BONUS_TASKS` is 5 and the length curve peaks at
12, so the `MAX_SHIFT_TASKS = 17` literal is both correct and tight.
`ceilingForLevel(2) = 0.5 < TWO_STAGE_THRESHOLD = 0.75` holds.

Two properties checked and clean: every `child_profiles` read uses `select("*")`
(`active-profile.ts:28`, `child-profiles.ts:102,233,293`), so the new column
genuinely arrives — an explicit column list would have made `readDifficultyState`
seed forever and silently killed P5 persistence. And no stale references to
`difficultyTier` / `SHIFT_LENGTH` / `COUNT_RANGE` / `CHANGE_CAP` / `PAID_MAX`
survive outside historical comments.

L-001 is satisfied by correct reasoning rather than by new policies: the migration
header argues column-agnosticism explicitly instead of leaving it implied, which is
the right form for a column-add on an already-protected table.

## Findings

### F1 — clampToBand hardening skipped shiftLength

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/data/shift.ts:69`
- **Detail**: Both leaf generators moved to `clampToBand`, which floors non-finite
  input to `min`. `shiftLength` kept `Math.min(max, Math.max(min, Math.round(...)))`.
  Verified by probe: a `NaN` picker gave `shiftLength → NaN` and
  `generateShift → 0 tasks`, while `-999` correctly floored to 5. The rogue-picker
  sweep at `tests/adaptive.test.ts:443` covered the two leaf generators but not
  `shiftLength`, which is why the asymmetry survived a green suite. Not reachable
  from current callers — `generateShift` is the only one, and both `defaultPick`
  and `createSeededRandom.pick` are finite by construction.
- **Fix**: Use `clampToBand` in `shiftLength`; extend the rogue-picker sweep to
  cover `shiftLength` / `generateShift`.
  - Confidence: HIGH — deliberate-break check confirms the new assertion goes red
    on the naive clamp ("expected NaN to be greater than or equal to 5") and green
    on the fix.
- **Decision**: FIXED

### F4 — generateShift's shuffle indexed the array with the raw picker output

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — one-line fix, same class as F1
- **Dimension**: Safety & Quality
- **Location**: `src/data/shift.ts:99`
- **Detail**: Found by the F1 sweep, not present in the original report. The
  Fisher–Yates shuffle used `const j = pick(0, i)` as a direct array index. An
  out-of-range pick assigns past the end, extending `types` with holes — a picker
  returning 999 produced a **1000-element shift of mostly `undefined`**. Worse in
  kind than F1: `MAX_SHIFT_TASKS` is enforced inside `shiftLength`, so this path
  routes around the cap entirely, which is exactly the failure the plan warns about
  (`complete.ts` 400s on a length it cannot parse, and with no mid-shift
  persistence the child loses the whole write). The existing ceiling test at
  `tests/adaptive.test.ts:329` never probed it because its picker,
  `(_min, max) => max`, is well-behaved. Same reachability as F1: not live today.
- **Fix**: `const j = clampToBand(pick(0, i), 0, i);`
- **Decision**: FIXED

### F2 — Levels 2–3 seed exactly at their ceiling

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: `src/data/adaptive.ts:77-96`
- **Detail**: `seedDifficultyFor(2) = ceilingForLevel(2) = 0.5` and
  `seedDifficultyFor(3) = ceilingForLevel(3) = 1`, so `d` can only move down for
  those cohorts — upward adaptation is live for level-1 profiles only. Open Risks
  stated only the weaker "starting_level is load-bearing" form. The practical bite
  is on verification: Phase 5's manual row 5.8 named no level, and run on a
  level-2/3 profile it would correctly observe nothing growing and read as a broken
  engine. Accepted design decision — it follows from the FR-007 pedagogical bound,
  not from a tuning choice.
- **Fix**: Sharpen the Open Risks bullet; pin row 5.8 and its Phase 5 Manual
  Verification bullet to a level-1 profile.
- **Decision**: FIXED (documentation)

### F3 — Three files outside Phase 3's Changes Required

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: `src/data/attempts.ts:66`, `src/data/skills.ts:25`,
  `src/pages/api/shifts/complete.ts:39`
- **Detail**: Phase 3 lists seven files; the commit touched three more.
  `attempts.ts` (null → real `d`) is the only behaviour change — Phase 5 does not
  claim that work, so nothing was pulled forward or orphaned. `skills.ts` is a
  load-bearing type narrowing (`PlayCompetency`). `complete.ts` is comment-only.
  All three were pre-announced by the implementer and named in the commit body.
- **Fix**: Append an "Absorbed during implementation" addendum to Phase 3's Changes
  Required, so future reviews reading the plan as ground truth see what shipped.
- **Decision**: FIXED (documentation)

## Note on change.md status

`status` is deliberately left at `implementing`, not flipped to `impl_reviewed`:
this is a mid-plan phase review with phases 4–5 still pending, and
`/10x-implement` only restores `implementing` from `{planned, plan_reviewed}`, so
flipping here would strand the change in a reviewed state it has not reached.

MERGE: CLEAR — every success criterion met, all four suites green after the fixes, no CRITICAL finding.
