# Upper-Band Task Difficulty (6–9) Implementation Plan

## Overview

Deliver roadmap **S-08**: give the 6–9 upper cohort appropriately harder tasks (FR-009) via two levers. (1) A new **difficulty tier 3** — age 9 gets its own harder band (bigger numbers, longer shifts) instead of sharing tier 2 with age 8. (2) An **occasional two-stage "stock then sell" give-change scenario** — the child first counts the item's price into the register, then gives the customer their change — surfaced only to the upper tier, so the added challenge is a genuinely multi-step interaction rather than just larger numbers. Everything stays within the no-bare-equation rule (coins, never `a+b=?`) and the shipped no-punishment retry model. No database migration.

## Current State Analysis

The difficulty system is small, pure, and has a single chokepoint — confirmed by `research.md`:

- **`tierForLevel(startingLevel): 1 | 2`** (`src/data/counting-tasks.ts:26`) is the *sole* level→tier funnel; all three generators call it. Four `Record<1 | 2, …>` range tables hang off it: `COUNT_RANGE` (`counting-tasks.ts:13`), `CHANGE_CAP`/`PAID_MAX` (`change-making-tasks.ts:15,18`), `SHIFT_LENGTH` (`shift.ts:14`). Both task types carry `difficultyTier: 1 | 2` (`types.ts:36,65`).
- **`difficultyTier` is transient** — written only into the in-memory task object, never persisted (no DB column, no `shift_log`, no `skill_state`). So a tier change needs **no migration**.
- **Age 9 already reaches the app but gets no harder tasks.** The wizard offers `[6,7,8,9]` (`CreateProfileWizard.tsx:21`), zod validates `min(6).max(9)` (`create.ts:21`), the DB has `check (age between 6 and 9)` — but `deriveStartingLevel` collapses **8 and 9 into tier 2** (`leveling.ts:8`, `age >= 8 ? 2 : 1`). `starting_level` is an unconstrained `smallint` (accepts 3 with no schema change).
- **Difficulty keys off the FROZEN `starting_level`, never mutable `business_level`** (`task.astro:43` → `ShiftScreen.tsx:46` → `generateShift(startingLevel)`). This separation is a hard guardrail (S-04) — conflating them corrupts difficulty derivation.
- **The change island renders one board, one target, one `===` check.** `useCoinTask` (`useCoinTask.ts:39-47`) takes a single `coinCount`/`target` and emits `{ firstTry, misses }` on success (retry + scaffolding hint after `RETRY_HINT_THRESHOLD` misses baked in). `ChangeMakingTask.tsx:22` **hardcodes `t.task.give_change`**, ignoring `task.scenario` — this must be de-hardcoded before a second change scenario can render. `TaskScreen` wraps `useCoinTask` + `CoinBoard`.
- **CoinBoard scales vertically at a fixed 5 columns** (`CoinBoard.tsx`); ~20 coins is comfortable, ~25–30 starts to scroll/tire. Numbers are capped by generator *constants*, not the renderer.

### Key Discoveries:

- Blast radius is contained to `src/data/*` + `src/types.ts` + a small island + tests. No SSR loader, service, migration, or `business_level` path is touched.
- Scenario string literals double as i18n keys via `t.task[scenario]` (`CountingTask.tsx:20` already uses this generically; the change island does not — the de-hardcode gap).
- Bigger numbers alone make tasks *longer, not harder* — the two-stage scenario is what actually deepens the upper-cohort challenge; the number widening is the secondary, mechanically-cheap lever.
- The determinism contract for every generator test is a last-arg **injectable picker** `(min,max)=>number` (and `()=>TaskType`/scenario). New tier-3 ranges and the two-stage generator must preserve this so tests stay flake-free.

## Desired End State

A newly-created age-9 profile plays a shift whose counting/change numbers are visibly larger than an age-8 profile's, over a slightly longer shift, and **occasionally** hits a two-stage task: "the loaf costs 12 zł — count 12 into the register" (stage 1), then "the customer paid 20 — give the change" (stage 2), each stage with its own tap-coins board, retry, and scaffolding hint. Ages 6–8 are unchanged. The two-stage task counts as one task in the shift and accrues to the money competency. Verify: create age-9 vs age-8 profiles → age-9 tasks draw from tier-3 ranges; a tier-3 shift occasionally produces a two-stage task that never appears for ages 6–8; each stage retries independently and the task is "clean" only if both stages were first-try; `npm run check`/`lint`/`build` green and the full suite passes against a fresh DB.

## What We're NOT Doing

- **No multi-denomination coins** (2/5-zł). The two-stage scenario reuses the single-denomination CoinBoard; composing denominations is `prd-v3` "later tranche" (S-03 explicitly deferred it).
- **No new *task type*** — the two-stage scenario is a new `ChangeMakingScenario`, still `type: "change_making"`. No change to the `Task` union, the dispatcher's type branching, or `competencyForTaskType`.
- **No formal grade-3 content / bare equations.** Tier-3 numbers stay modest (count ≤~25, change ≤15, paid ≤30) and concrete; the difficulty is structural (two-stage), not a formal-arithmetic surface.
- **No database migration.** `starting_level` already accepts 3; the `age` band is already 6–9. (Optional defence-in-depth `starting_level` CHECK is explicitly out of scope.)
- **No in-play difficulty progression.** Difficulty stays derived once from age at profile creation (`starting_level`); `business_level` is never wired into the generators.
- **No per-stage competency split.** The whole two-stage task accrues to the money competency; stage 1's counting act does not separately feed math — keeps the S-07 skills model untouched.
- **No re-banding of ages 6–8.** Chosen mapping keeps 6–7→tier 1, 8→tier 2 exactly as shipped; only age 9 moves (to the new tier 3).

## Implementation Approach

Bottom-up and shippable-at-every-phase, mirroring the codebase's pure-logic-first convention. **Phase 1** widens the difficulty model to three tiers — a self-contained improvement that ships harder numbers + longer shifts for age 9 with no new interaction. **Phase 2** builds the two-stage scenario's pure pieces (scenario type, task shape, standalone generator, correctness/invariant tests) *without* wiring it into the live shift mixer, so runtime behavior is unchanged and there is never a moment where the shift emits a task the UI can't render. **Phase 3** is the single "on switch": it renders the two-stage interaction (two `TaskScreen` passes with per-stage retry+hint), adds the Polish copy, aggregates both stages into one shift/skill outcome, and flips the tier-3 generator to *occasionally* emit the scenario.

## Critical Implementation Details

- **Phase ordering prevents a broken intermediate.** The two-stage scenario's live emission (the tier-3 generator gate) lands in Phase 3 *together with* the island that renders it — never in Phase 2. Phase 2's generator function exists and is unit-tested but is not reachable from `generateShift`, so a mid-Phase-2 build serves the exact same tasks as today.
- **Two-stage numbers are kept smaller than the tier-3 single-stage ceiling.** Each stage's coin count must stay within comfortable render (~≤15–18 coins), so the two-stage generator draws a modest price and change (e.g. price ≤~15, change ≤~10) rather than the tier-3 maxima — the difficulty is the two-step structure, not a huge single count.
- **Per-stage outcomes aggregate into one `TaskOutcome`.** The island runs stage 1, then stage 2, then calls `onComplete` **once** with `{ firstTry: stage1.firstTry && stage2.firstTry, misses: stage1.misses + stage2.misses }`. `ShiftScreen` therefore treats a two-stage task as a single task (one entry in `taskCount`/`cleanCount`, one money-competency `completed`), so the S-07 reconciliation refine (`Σ completed ≤ taskCount`) still holds unchanged.

---

## Phase 1: Tier-3 upper-band difficulty

### Overview

Introduce difficulty tier 3 so age 9 gets its own harder band: widen the `difficultyTier` union, add a tier-3 row to the four range tables (modest numbers), re-band `deriveStartingLevel`, fix the `MAX_SHIFT_TASKS` derivation, and update the generator/leveling/profile tests. Correct the stale `CLAUDE.md` age-band line. Fully shippable on its own — no new interaction.

### Changes Required:

#### 1. Widen the difficulty-tier type

**File**: `src/types.ts`

**Intent**: Allow a third difficulty tier on both task types so the range tables and `tierForLevel` can express an upper-cohort band.

**Contract**: `CountingTask.difficultyTier` (`:36`) and `ChangeMakingTask.difficultyTier` (`:65`) become `1 | 2 | 3`. No other field changes in this phase.

#### 2. Tier-3 counting range + tier funnel

**File**: `src/data/counting-tasks.ts`

**Intent**: Give tier 3 a larger (but still concrete) counting range and teach the single level→tier funnel about tier 3.

**Contract**: `COUNT_RANGE` becomes `Record<1 | 2 | 3, {min,max}>` with a `3: { min: 10, max: 25 }` row (first-guess, tunable). `tierForLevel` returns `1 | 2 | 3` with an added `>= 3 ? 3` branch (so `startingLevel` 3 → tier 3, ≥3 clamps to 3). Update the "never exceeds 20" comment (`:11-12`) to state the tier-3 ceiling. `SCATTER_MAX` unchanged.

#### 3. Tier-3 change-making caps

**File**: `src/data/change-making-tasks.ts`

**Intent**: Raise the change/paid ceilings for tier 3 while keeping the tray tappable.

**Contract**: `CHANGE_CAP` → add `3: 15`; `PAID_MAX` → add `3: 30` (both `Record<1 | 2 | 3, number>`; first-guess, tunable). Confirm `availableCount` stays ≤ `TRAY_CAP` (20): max change 15 + `EXTRA_TRAY_MAX` 3 = 18 ≤ 20, so no `TRAY_CAP` change needed. Single-stage tier-3 generation is otherwise unchanged (still `tierForLevel`-driven).

#### 4. Tier-3 shift length + `MAX_SHIFT_TASKS` derivation

**File**: `src/data/shift.ts`

**Intent**: Longer shifts for the upper cohort, and keep the server-side task cap correct now that tier 3 is the longest base shift.

**Contract**: `SHIFT_LENGTH` → add `3: { min: 9, max: 12 }` (`Record<1 | 2 | 3, …>`; first-guess, tunable). `MAX_SHIFT_TASKS` (`:25`) changes its base term from `SHIFT_LENGTH[2].max` to `SHIFT_LENGTH[3].max` so the cap reflects the new longest shift (the shift-complete route imports this constant, so its cap updates automatically). `shiftLength`/`generateShift` are unchanged (they route through `tierForLevel`).

#### 5. Age → tier-3 re-band

**File**: `src/data/leveling.ts`

**Intent**: Map age 9 to the new tier while leaving 6–8 exactly as shipped.

**Contract**: `deriveStartingLevel` becomes `age >= 9 ? 3 : age >= 8 ? 2 : 1`. Update the module comment ("6–7 → 1, 8 → 2, 9 → 3"). Single source of truth — re-exported via `child-profiles.ts:7`, consumed by both `create.ts` (server) and the wizard display chip.

#### 6. Correct the stale age-band line in CLAUDE.md

**File**: `CLAUDE.md`

**Intent**: The project doc still says "ages 6–8 in v1" and points at `prd-v2.md`; `prd-v3.md` supersedes with 6–9.

**Contract**: Update the one-line age-band description in the Project section to 6–9, consistent with `prd-v3.md` / FR-009. Prose-only, no behavior.

#### 7. Update generator, leveling, and profile tests

**File**: `tests/counting-tasks.test.ts`, `tests/change-making-tasks.test.ts`, `tests/shift.test.ts`, `tests/profiles-create.test.ts`

**Intent**: Re-point the assertions that pin the old two-tier bands and age mapping, and add tier-3 coverage, preserving the injectable-picker determinism pattern.

**Contract**:
- `counting-tasks.test.ts` — the `tierForLevel` clamp case (`:20`, currently `tierForLevel(5) === 2`) becomes `=== 3`; the "never exceeds 20" ceiling case (`:53-55`) becomes tier-specific (tier 2 ≤ 20, **tier 3 ≤ 25**); add a tier-3 band sweep over `COUNT_RANGE[3]`.
- `change-making-tasks.test.ts` — `assertInvariants` tier param becomes `1 | 2 | 3`; add a tier-3 sweep + ceiling (`change === CHANGE_CAP[3]`, `paid === PAID_MAX[3]`); the hardcoded `availableCount ≤ 20` (`:22`) still holds.
- `shift.test.ts` — add tier-3 `SHIFT_LENGTH` band assertions; update the `MAX_SHIFT_TASKS` derivation expectation to `SHIFT_LENGTH[3].max + MAX_BONUS_TASKS`; the "every task in `generateShift(3)` is tier 3" analogue of `:58-62`.
- `profiles-create.test.ts` — **age 9 → `starting_level` 3** (was 2, `:99`); ages 6–8 assertions unchanged; the `age:"99"` reject case (`:104`) unaffected.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npx vitest run tests/counting-tasks.test.ts tests/change-making-tasks.test.ts tests/shift.test.ts`
- Profile age→level persistence passes against a fresh DB: `npx supabase db reset` then `npx vitest run tests/profiles-create.test.ts`
- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- A newly-created **age-9** profile's shift shows visibly larger counting/change numbers and a longer shift than an **age-8** profile.
- Ages 6, 7, 8 play exactly as before (no visible change).
- Numbers stay concrete and tappable (no scrolling pain at the tier-3 ceiling).

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: Two-stage scenario — data model + generator + correctness (pure, not yet in play)

### Overview

Build the "stock then sell" scenario's pure pieces: de-hardcode the change island's copy lookup (behavior-preserving), add the new `ChangeMakingScenario` and the task shape for a two-stage task, a standalone generator, and invariant tests. The live shift mixer does **not** emit the scenario yet — runtime behavior is identical to Phase 1, so the build/app stay green with no unrenderable task ever produced.

### Changes Required:

#### 1. De-hardcode the change island's scenario copy (behavior-preserving prerequisite)

**File**: `src/components/child/ChangeMakingTask.tsx`

**Intent**: Resolve copy by scenario (like the counting island) so a second change scenario can render; for the existing `give_change` this is a no-op.

**Contract**: Replace `const copy = t.task.give_change` (`:22`) with a scenario-keyed lookup `t.task[task.scenario]`. For `give_change` the resolved copy is identical — no visible change. (The two-stage rendering itself is Phase 3.)

#### 2. New scenario + two-stage task shape

**File**: `src/types.ts`

**Intent**: Add the scenario discriminant and the extra field the two-stage task needs (a stage-1 tray to count the price from), leaving single-stage `give_change` tasks unchanged.

**Contract**: `ChangeMakingScenario` (`:44`) gains a member, e.g. `"stock_and_change"`. `ChangeMakingTask` gains an optional stage-1 descriptor — the coins available to count the price into the register — e.g. `stockCount?: number` (present only for the two-stage scenario; stage-1 target is the existing `price`, stage-2 target the existing `change`). The scenario field discriminates single vs two-stage; existing fields (`paid`/`price`/`change`/`availableCount`) are reused.

#### 3. Two-stage generator (standalone, not wired into the mixer)

**File**: `src/data/change-making-tasks.ts`

**Intent**: A pure generator that produces a valid two-stage task with modest per-stage numbers, unit-testable in isolation and not yet reachable from `generateShift`.

**Contract**: New `generateStockAndChangeTask(startingLevel, pick)` returning a `ChangeMakingTask` with `scenario: "stock_and_change"`, a stage-1 `price` and `stockCount` (tray `> price`, so the child must stop at the right number), stage-2 `change`/`availableCount` per the existing `give_change` invariants, and `paid = price + change`. Per-stage coin counts kept modest (e.g. `price ≤ ~15`, `change ≤ ~10`) so neither stage overwhelms the board — independent of the tier-3 single-stage ceiling. Preserves the injectable-picker signature. `generateChangeMakingTask` and the shift mixer are **untouched** in this phase (still only `give_change`).

#### 4. Correctness / invariant unit tests

**File**: `tests/change-making-tasks.test.ts`

**Intent**: Lock the two-stage generator's invariants with the deterministic picker pattern.

**Contract**: Assert `generateStockAndChangeTask` produces `scenario === "stock_and_change"`, `stockCount > price`, `availableCount > change`, `paid === price + change`, both stages within their modest caps, and correct `arrangement` flips. Reuse/extend the `assertInvariants` helper where sensible. Existing single-stage tests remain green.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npx vitest run tests/change-making-tasks.test.ts tests/counting-tasks.test.ts tests/shift.test.ts`
- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- No runtime surface change: the full suite still passes against a fresh DB (`npx supabase db reset` then `npx vitest run`) — the mixer emits the same tasks as Phase 1.

#### Manual Verification:

- Playing shifts at every age behaves exactly as after Phase 1 (the two-stage scenario is not yet reachable in play).

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Two-stage scenario — island, i18n, scoring & turn-on

### Overview

Make the two-stage scenario real: render it as two sequential tap-coins stages (each with its own board, retry, and scaffolding hint), add the Polish copy, aggregate both stages into a single shift/skill outcome, and flip the tier-3 generator to *occasionally* emit the scenario. This is the single phase where a tier-3 shift can produce a two-stage task, landing the island and the emission gate together.

### Changes Required:

#### 1. Two-stage scenario copy

**File**: `src/i18n/pl.ts`

**Intent**: Polish copy for both stages (L-003 — no inline literals), keyed by the new scenario.

**Contract**: New `t.task.stock_and_change` block with stage-1 (count the price into the register) and stage-2 (give the change) prompt/question/success/hint strings, plus any "stage 1 of 2 / 2 of 2" progress label. Interpolation tokens for `{price}`/`{paid}`/`{change}` as needed. Draft Polish, pending native-speaker review (matches the existing `t.task.*` convention).

#### 2. Two-stage rendering + stage orchestration

**File**: `src/components/child/ChangeMakingTask.tsx` (and a small stage wrapper if factored out)

**Intent**: When the task is the two-stage scenario, run stage 1 (count `price` from `stockCount`), then on completion advance to stage 2 (give `change` from `availableCount`), reusing `TaskScreen`/`useCoinTask` per stage so per-stage retry + scaffolding hint come for free; aggregate the two stages into a single `onComplete`.

**Contract**: Branch on `task.scenario`: `give_change` renders the existing single `TaskScreen`; `stock_and_change` renders stage 1 then stage 2, each a `TaskScreen` (stage 1: `coinCount = stockCount`, `target = price`; stage 2: `coinCount = availableCount`, `target = change`) with stage-appropriate copy from §1. The wrapper holds the current stage and each stage's `TaskOutcome`, and calls the task's `onComplete` **once** with `{ firstTry: s1.firstTry && s2.firstTry, misses: s1.misses + s2.misses }`. No change to `useCoinTask`, `TaskScreen`, or `CoinBoard` internals.

#### 3. Turn on occasional tier-3 emission

**File**: `src/data/change-making-tasks.ts` (+ `src/data/shift.ts` / `src/data/tasks.ts` if the scenario gate lives in the dispatch path)

**Intent**: Make the live change-making generator *occasionally* produce the two-stage scenario, but only for tier 3, leaving tiers 1–2 always single-stage.

**Contract**: `generateChangeMakingTask` gains an injectable scenario picker; when `tierForLevel(startingLevel) === 3`, with a modest probability (first-guess ~0.3, tunable) it delegates to `generateStockAndChangeTask`, else produces `give_change`. Tiers 1–2 always produce `give_change`. Default picker uses `Math.random`; injectable for deterministic tests. `generateShift` still guarantees the counting/change type mix (a two-stage task is still `type: "change_making"`), so no dispatcher/type change.

#### 4. Emission + integration tests

**File**: `tests/change-making-tasks.test.ts`, `tests/shift.test.ts`

**Intent**: Lock the tier-gated occasional emission and confirm a two-stage task integrates as one shift task.

**Contract**: With a scenario picker forced on, `generateChangeMakingTask(tier-3 level)` yields `stock_and_change`; with it forced off, `give_change`; tiers 1–2 **never** yield `stock_and_change` regardless of the picker. A `generateShift` at tier 3 can include a two-stage task and it is still `type: "change_making"` (counts as one task). Determinism via injected pickers.

### Success Criteria:

#### Automated Verification:

- Unit/integration tests pass: `npx vitest run tests/change-making-tasks.test.ts tests/shift.test.ts tests/counting-tasks.test.ts`
- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- Full suite passes against a fresh DB: `npx supabase db reset` then `npx vitest run`
- No inline user-visible literals in the edited surfaces (L-003 grep of `ChangeMakingTask.tsx` + the new i18n usage)

#### Manual Verification:

- An **age-9** profile occasionally gets a two-stage task: stage 1 counts the price into the register, stage 2 gives the change; each stage has its own board, retry, and hint (after 2 wrong).
- The two-stage task is "clean" (contributes a first-try/perfect star) only when **both** stages were first-try; a miss in either stage reduces accuracy but never hard-fails the task.
- Ages 6–8 **never** see a two-stage task.
- The two-stage task counts as a single task in the shift results and raises the money skill by one completed task; wallet/skill accounting reconciles (no rejected shift).
- Copy is Polish, warm, no scarcity/urgency; the shop narrative reads naturally across both stages.

**Implementation Note**: Final phase — after automated + manual verification, S-08 is complete.

---

## Testing Strategy

### Unit Tests (`tests/counting-tasks.test.ts`, `tests/change-making-tasks.test.ts`, `tests/shift.test.ts`):

- Tier-3 bands: `COUNT_RANGE[3]`, `CHANGE_CAP[3]`/`PAID_MAX[3]`, `SHIFT_LENGTH[3]` sweeps + ceilings; `tierForLevel` maps `≥3 → 3`.
- Two-stage generator invariants: `stockCount > price`, `availableCount > change`, `paid = price + change`, modest per-stage caps.
- Occasional tier-3 emission: forced-on → two-stage, forced-off → `give_change`, tiers 1–2 never two-stage.
- All via the established injectable-picker determinism pattern.

### Integration Tests (local Supabase stack):

- `tests/profiles-create.test.ts` — age 9 → `starting_level` 3; ages 6–8 unchanged; invalid age still rejected.
- Full suite (`npx vitest run` against `npx supabase db reset`) green at each phase — confirming no migration/regression and that a two-stage task reconciles as one shift task in the shift-complete path.

### Manual Testing Steps:

1. Create age-6, age-8, and age-9 profiles; play a shift on each. Confirm age-9 draws larger numbers + longer shifts; 6–8 unchanged.
2. On the age-9 profile, replay shifts until a two-stage task appears; verify stage 1 (count price) → stage 2 (give change), each with independent retry + hint.
3. Miss a stage deliberately: confirm the task still completes, accuracy drops, no hard fail; confirm "clean" requires both stages first-try.
4. Confirm ages 6–8 never surface a two-stage task.
5. Confirm the two-stage task counts as one task in results and the shift saves (skill/wallet reconcile).

## Performance Considerations

No new queries or persistence — all changes are in pure generators, one island, and i18n. A two-stage task renders two sequential boards (each ≤~18 coins) but is still one shift task. `MAX_SHIFT_TASKS` rises modestly with the tier-3 shift length; the shift-complete route's cap tracks it via the shared constant.

## Migration Notes

**No migration.** `starting_level` is an unconstrained `smallint` (accepts 3); the `age` CHECK is already `between 6 and 9`. Existing profiles keep their stored `starting_level` (6–8 unaffected); only *newly-created* age-9 profiles derive tier 3. Rollback = revert the code (no schema to undo). `difficultyTier` remains transient.

## References

- Research: `context/changes/upper-band-task-difficulty/research.md`
- Scope decision (Path B): `context/changes/upper-band-task-difficulty/change.md` (Notes)
- Roadmap: `context/foundation/roadmap.md` → S-08 (`upper-band-task-difficulty`)
- PRD: `context/foundation/prd-v3.md` FR-009 (widened 6–9 band; larger / occasional multi-step change-making; no formal grade-3), §50 re-baseline
- Generators/tiers: `src/data/counting-tasks.ts`, `src/data/change-making-tasks.ts`, `src/data/shift.ts`, `src/data/leveling.ts`
- Deferred multi-denomination (out of scope): `context/archive/2026-06-29-change-making-task-in-business-context/plan.md`
- Lessons: `context/foundation/lessons.md` L-003 (i18n — new scenario copy in the dictionary)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Tier-3 upper-band difficulty

#### Automated

- [x] 1.1 Unit tests pass: `npx vitest run tests/counting-tasks.test.ts tests/change-making-tasks.test.ts tests/shift.test.ts` — e465e49
- [x] 1.2 Profile age→level persistence passes against a fresh DB (`supabase db reset` + `vitest run tests/profiles-create.test.ts`) — e465e49
- [x] 1.3 Type checking passes: `npm run check` — e465e49
- [x] 1.4 Linting passes: `npm run lint` — e465e49
- [x] 1.5 Build succeeds: `npm run build` — e465e49

#### Manual

- [x] 1.6 Age-9 profile shows larger numbers + longer shift than age-8; ages 6–8 unchanged — e465e49
- [x] 1.7 Numbers stay concrete and tappable at the tier-3 ceiling (no scroll pain) — e465e49

### Phase 2: Two-stage scenario — data model + generator + correctness

#### Automated

- [x] 2.1 Unit tests pass: `npx vitest run tests/change-making-tasks.test.ts tests/counting-tasks.test.ts tests/shift.test.ts` — ff42adb
- [x] 2.2 Type checking passes: `npm run check` — ff42adb
- [x] 2.3 Linting passes: `npm run lint` — ff42adb
- [x] 2.4 Build succeeds: `npm run build` — ff42adb
- [x] 2.5 No runtime surface change: full suite passes against a fresh DB (`supabase db reset` + `vitest run`) — ff42adb

#### Manual

- [x] 2.6 Playing shifts at every age behaves exactly as after Phase 1 (two-stage not yet reachable) — ff42adb

### Phase 3: Two-stage scenario — island, i18n, scoring & turn-on

#### Automated

- [x] 3.1 Unit/integration tests pass: `npx vitest run tests/change-making-tasks.test.ts tests/shift.test.ts tests/counting-tasks.test.ts` — 290d384
- [x] 3.2 Type checking passes: `npm run check` — 290d384
- [x] 3.3 Linting passes: `npm run lint` — 290d384
- [x] 3.4 Build succeeds: `npm run build` — 290d384
- [x] 3.5 Full suite passes against a fresh DB (`supabase db reset` + `vitest run`) — 290d384
- [x] 3.6 No inline user-visible literals in the edited surfaces (L-003 grep) — 290d384

#### Manual

- [x] 3.7 Age-9 profile occasionally gets a two-stage task: count price → give change, each with its own board/retry/hint — 290d384
- [x] 3.8 Two-stage task is "clean" only when both stages first-try; a stage miss drops accuracy but never hard-fails — 290d384
- [x] 3.9 Ages 6–8 never see a two-stage task — 290d384
- [x] 3.10 Two-stage task counts as one shift task and raises money skill by one; shift saves (reconciles) — 290d384
- [x] 3.11 Copy is Polish, warm, natural across both stages; no scarcity/urgency — 290d384
