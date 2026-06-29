# Change-Making Task in Business Context (S-03) Implementation Plan

## Overview

Add a **change-making task** to MathShop as a second task type alongside S-02's counting task. The child sees an in-world story ("Klient zapłacił 5 zł za sok kosztujący 3 zł — ile reszty wydasz?") and **gives change by tapping 1-zł coins onto the counter** until the coins given equal `paid − price`. Same soft-retry + scaffolding-hint + subtle-success pattern as S-02. Correct change returns the child to the start screen.

This is roadmap slice **S-03** (`context/foundation/roadmap.md:107-117`), the parallel sibling of S-02. Its job is to **validate that the S-02 task contract generalizes**: change-making joins the discriminated `Task` union, reuses the coin-tap-and-feedback mechanic, and `/app/task` becomes polymorphic (serves either type) — the shape S-04's mixed shift will build on. Stateless; persistence is S-04.

## Current State Analysis

S-02 shipped a single-type counting task. The relevant live code (all current as of commit `caf55c2`):

- `src/types.ts` — `CountingTask` is **already a discriminated union member** (`type: "counting"`), `CountingScenario = "count_till"`, `RETRY_HINT_THRESHOLD = 2`. Designed for S-03/S-04 to extend.
- `src/data/counting-tasks.ts` — `COUNT_RANGE` (tier1 `{3,10}` / tier2 `{6,20}`), `tierForLevel(level): 1|2`, `generateCountingTask(level, pickCount?)` (band-clamped, injectable RNG), `isCorrect(task, tally)`, `SCATTER_MAX = 5` (scatter ≤5, else `rows_of_5`).
- `src/components/child/CountingTask.tsx` — the tap-to-count island: per-coin toggle (`aria-pressed` + ring/check), running tally, "Sprawdź", gentle retry, coin-pile hint after `RETRY_HINT_THRESHOLD` misses, `role="status"` success → `useEffect` redirect to `/app/start` with `clearTimeout` cleanup, positional `aria-label` ("Moneta {n}"), 64px (`size-16`) coin tap targets. **This is the mechanic S-03 must reuse, not duplicate.**
- `src/pages/app/task.astro` — gated SSR loader: `getMostRecentProfile` → `worldForTheme` → `generateCountingTask(profile.starting_level)` → mounts `<CountingTask client:load task={task} world={world} />`. Defensive redirects (null client → `/auth/signin`, no profile → `/app`).
- `src/i18n/pl.ts` — `task` namespace: shared `check`/`tally`/`retry`/`coinLabel` + scenario-keyed `count_till.{prompt,question,success,hint}`. Island resolves copy via `t.task[scenario]`.
- `tests/counting-tasks.test.ts` — pure vitest coverage of the counting generator + correctness (deterministic injected picker).
- `src/components/hooks/` is the established home for extracted React hooks (CLAUDE.md convention); currently empty/sparse.

Lessons in force: **L-003** (no inline literals — all copy via `src/i18n`, CI-enforced). **L-001/L-002** (RLS) do not apply — this slice persists nothing.

Full S-02 grounding: `context/archive/2026-06-29-counting-task-in-business-context/research.md`.

## Desired End State

A logged-in child taps the business on `/app/start` and lands on `/app/task`, which now serves **either** a counting task **or** a change-making task (randomly). For a change-making task they see the customer's story (amount paid, item price) and a tray of 1-zł coins; they tap coins onto the counter until the number given equals the change, then press "Sprawdź". Correct → subtle success → back to `/app/start`. Wrong → gentle retry with taps preserved; after 2 misses, a count-up hint highlights the price→paid gap. The counting task continues to work exactly as before. Nothing is persisted.

**Verification:** `npm run check` / `npm run lint` / `npm test` / `npm run build` all pass; manual play-through confirms both task types render and play correctly (counting unchanged; change-making give-change + retry + count-up hint + success).

### Key Discoveries:

- `CountingTask` is already union-shaped (`src/types.ts`) — add `ChangeMakingTask` as a sibling, not a parallel system.
- The coin-tap mechanic is **identical** across types: render N toggleable coins, track a tally, correct when `tally === target`. Only the *target*, the *header narrative*, and the *hint* differ (counting: target = number shown; change: target = `paid − price`). This is what makes one shared core viable.
- `tierForLevel` + the level→tier idea are reusable from `src/data/counting-tasks.ts:26` (exported).
- The PRD's "tappable objects, not numerical inputs" rule is scoped to *counting* (`prd-v2.md:78`); change-making giving-change-with-coins honors the same spirit and is the §Business Logic in-world resolution ("change is given").

## What We're NOT Doing

- **No persistence** — no migration/RLS/API/coins/score (S-04). L-001/L-002 N/A.
- **No multiple-choice answer** — tap-to-give-coins only (resolved decision).
- **No multi-denomination coins** — 1-zł coins only in v1; composing 2/5-zł change is deferred (overshoots grades 1–2).
- **No coin payout / shift-end celebration** — per-task success is a subtle `role="status"` card only (FR-008/FR-010).
- **No shift loop / results screen / "play again"** — after one task the child returns to `/app/start` (S-04 owns the shift).
- **No new scenarios beyond `give_change`** — one change-making scenario, mirroring S-02's single `count_till`.
- **No change to the start-screen entry** — the tap already routes to `/app/task`.
- **No DOM/interaction test harness** — islands manually verified (mirrors S-02 testing depth).
- **No behavior change to the counting task** — Phase 2 refactors its internals into a shared core but its play must stay identical (regression guard).

## Implementation Approach

Two phases, mirroring S-02. **Phase 1** is pure logic: extend `src/types.ts` to a `Task` discriminated union, add a change-making generator (rolls `price`/`change` within the grade band with the change kept small, `availableCount ≥ change` so tapping-all isn't auto-correct), add a random `generateTask(level)` dispatcher the page will call, author the Polish `give_change` copy, and unit-test all of it with an injectable RNG. **Phase 2** generalizes the UI: extract S-02's tap-coins-and-feedback mechanic into a reusable core (a `useCoinTask` hook + a shared `CoinBoard` + a shared `TaskScreen` chrome), refactor `CountingTask` into a thin adapter over it, add a `ChangeMakingTask` adapter (story header + count-up hint), and make `/app/task` mount the right island by `task.type`.

The shared core is the heart: counting and change-making differ only in `target`, the header, and the hint — everything else (toggle coins, tally, "Sprawdź", retry, success→nav) is one implementation both types drive.

## Critical Implementation Details

- **The counting task must not change behavior.** Phase 2 extracts its mechanic into `TaskScreen`/`useCoinTask`; `CountingTask` becomes an adapter that produces identical output. Its S-02 manual flow is the regression check.
- **`availableCount ≥ change`, tray not huge.** The change-making coin tray must offer *more* coins than the change (so the child stops at the right number rather than tapping everything), but capped so the tray stays tappable in `max-w-md` — keep `availableCount` within roughly `change + 1..3` and never exceeding ~20.
- **No per-tap network round-trip** (`prd-v2.md:148`) — all interaction is client-side; the page round-trips only on initial SSR load and the final `/app/start` nav.
- **Generation stays deterministic-testable** — both the change-making generator and the `generateTask` type-dispatcher take injectable randomness (a `pickCount`/`pickType` arg) so tests assert band/cap/type behavior without flake.

## Phase 1: Domain & contract generalization

### Overview

Extend the type system to a `Task` union, add the change-making generator + correctness + a random task dispatcher, author the Polish copy, and cover it all with vitest.

### Changes Required:

#### 1. Task type union

**File**: `src/types.ts` (extend)

**Intent**: Add `ChangeMakingTask` as a second discriminated-union member and a `Task` union so consumers can hold "either task". Mirror `CountingTask`'s scenario-as-i18n-key convention.

**Contract**: Add `export type ChangeMakingScenario = "give_change"`; `export interface ChangeMakingTask { type: "change_making"; scenario: ChangeMakingScenario; objectType: "coin"; paid: number; price: number; change: number; /* = paid − price */ availableCount: number; /* coins in the tray to give from, ≥ change */ arrangement: "scatter" | "rows_of_5"; difficultyTier: 1 | 2; }`; and `export type Task = CountingTask | ChangeMakingTask`. `RETRY_HINT_THRESHOLD` stays shared.

#### 2. Change-making generator + correctness

**File**: `src/data/change-making-tasks.ts` (new)

**Intent**: Turn a child's level into a `give_change` task with the change kept small and age-appropriate, and provide the correctness helper. Injectable RNG for tests. Reuse `tierForLevel` from `./counting-tasks`.

**Contract**:
- `CHANGE_CAP: Record<1|2, number>` — max change per tier (tier1 `5`, tier2 `10`).
- `PAID_MAX: Record<1|2, number>` — band ceiling for `paid` (tier1 `10`, tier2 `20`; reuse/align with `COUNT_RANGE` maxes).
- `generateChangeMakingTask(startingLevel: number, pick?: (min, max) => number): ChangeMakingTask` — derive tier; roll `change ∈ [1, CHANGE_CAP[tier]]`; roll `price ∈ [1, PAID_MAX[tier] − change]`; `paid = price + change`; `availableCount = change + pick(1, 3)` (capped ≤ ~20); `arrangement` by `SCATTER_MAX`. All clamped so `paid` never exceeds the band.
- `isChangeCorrect(task: ChangeMakingTask, given: number): boolean` — `given === task.change`.

#### 3. Random task dispatcher

**File**: `src/data/tasks.ts` (new)

**Intent**: One entry point the page calls to get "a task" — randomly counting or change-making — so `/app/task` serves both and S-04 can extend the mix. Injectable type-picker for tests.

**Contract**: `export { type Task } from "@/types"`; `generateTask(startingLevel: number, pickType?: () => "counting" | "change_making", ...rng): Task` — pick a type (default ~50/50 via `Math.random`), delegate to `generateCountingTask` or `generateChangeMakingTask`. Keep the per-generator RNG injectable too (or accept that tests target the sub-generators directly and only assert dispatch on `pickType`).

#### 4. Polish copy for change-making

**File**: `src/i18n/pl.ts` (extend the `task` namespace)

**Intent**: Add the `give_change` scenario copy as a sibling of `count_till`, keyed so the adapter resolves it via `t.task[scenario]`. The story interpolates `{paid}`/`{price}`. No inline literals (L-003). Polish copy is draft pending native-speaker review.

**Contract**: `task.give_change = { story: "Klient zapłacił {paid} zł za zakup za {price} zł.", question: "Ile reszty wydasz?", success: "Brawo! Wydałeś poprawną resztę.", hint: "Policz od ceny do zapłaconej kwoty." }` (drafts). Reuse shared `task.check`/`task.tally`/`task.retry`/`task.coinLabel`. `{paid}`/`{price}` interpolated via `.replace()` at the call site (the established pattern).

#### 5. Unit tests

**File**: `tests/change-making-tasks.test.ts` (new); optionally extend a `tests/tasks.test.ts` for the dispatcher

**Intent**: Lock the change-making generation invariants and the dispatcher.

**Contract**: Cover — `change ∈ [1, CHANGE_CAP[tier]]` both tiers (injected picker); `change === paid − price`; `price ≥ 1`; `paid ≤ PAID_MAX[tier]`; `availableCount ≥ change` and `≤ ~20`; `arrangement` flips at `SCATTER_MAX`; `isChangeCorrect` exact-match only. Dispatcher: with an injected `pickType`, `generateTask` returns the requested `type`, and both types are reachable. Pure — no DOM.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run check`
- Linting passes (incl. no-inline-literal rule): `npm run lint`
- Unit tests pass: `npm test`
- Build passes: `npm run build`

#### Manual Verification:

- `src/types.ts` exports `ChangeMakingTask` + `Task`; `CountingTask` untouched.
- `generateChangeMakingTask` output spot-checked: `change = paid − price`, change within the tier cap, `availableCount > change`.
- All new copy lives in `pl.ts` (grep new files — no inline literals).
- Polish copy reads naturally for a 6–8-year-old (pending native-speaker confirmation).

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation before Phase 2.

---

## Phase 2: UI — shared core + change-making island + polymorphic page

### Overview

Extract S-02's coin-tap mechanic into a reusable core, refactor counting onto it, add the change-making island, and make `/app/task` render the right task by type.

### Changes Required:

#### 1. Shared task-interaction hook

**File**: `src/components/hooks/useCoinTask.ts` (new — CLAUDE.md hooks home)

**Intent**: Own the tap/tally/retry/success state that both task types share, extracted from `CountingTask.tsx` unchanged in behavior.

**Contract**: `useCoinTask({ coinCount, target }: { coinCount: number; target: number })` → `{ counted: boolean[]; tally: number; status: "idle"|"wrong"|"correct"; misses: number; showHint: boolean; toggle: (i: number) => void; check: () => void }`. `toggle` flips a coin (no-op once correct, clears the wrong message); `check` sets `correct` when `tally === target` else `wrong` + `misses++`; `showHint = status !== "correct" && misses >= RETRY_HINT_THRESHOLD`; a `useEffect` keyed on `status === "correct"` navigates to `/app/start` after ~1.4s with `clearTimeout` cleanup (the F1 fix pattern).

#### 2. Shared coin board (presentation)

**File**: `src/components/child/CoinBoard.tsx` (new)

**Intent**: The tappable-coin grid, extracted from `CountingTask.tsx` verbatim in look/behavior.

**Contract**: `CoinBoard({ counted, toggle, arrangement, disabled, showHintRing }: …)` — renders `counted.length` coin buttons (64px `size-16`, `gap-4`, `grid grid-cols-5` for `rows_of_5` else `flex flex-wrap`), per-coin `aria-pressed` + ring/check, positional `aria-label` (`t.task.coinLabel` → "Moneta {n}"), `coin.png`, optional hint-pulse ring on the container. No bare-math, no red/buzzer.

#### 3. Shared task screen (chrome)

**File**: `src/components/child/TaskScreen.tsx` (new)

**Intent**: The common screen frame both types render — header slot + `CoinBoard` + tally + "Sprawdź" + retry/hint/success — driven by `useCoinTask`. This is the generalization of today's `CountingTask.tsx`.

**Contract**: `TaskScreen({ world, coinCount, target, arrangement, header, hint, successCopy }: …)` where `header` and `hint` are type-specific `ReactNode`s. Renders the `world.name` chip + `header`, `<CoinBoard>` wired to the hook, the `task.tally` line (`aria-live`), the gold "Sprawdź" `ChildButton` calling `check`, the `role="status"` retry card (`task.retry`) with the supplied `hint` shown when `showHint`, and the `role="status"` success card (`successCopy`) with the subtle `animate-in` acknowledgment.

#### 4. Counting adapter (refactor)

**File**: `src/components/child/CountingTask.tsx` (refactor)

**Intent**: Reduce to a thin adapter over `TaskScreen` — **no behavior change**. Counting's target equals the number of coins shown.

**Contract**: `CountingTask({ task, world }: { task: CountingTask; world: World })` → `<TaskScreen world={world} coinCount={task.targetCount} target={task.targetCount} arrangement={task.arrangement} header={prompt+question from t.task[task.scenario]} hint={pile-highlight node} successCopy={t.task[task.scenario].success} />`. Output must match the current island.

#### 5. Change-making adapter (new)

**File**: `src/components/child/ChangeMakingTask.tsx` (new)

**Intent**: Adapter for the change-making task — story header (paid/price) + count-up hint; target is the change, tray is `availableCount` coins.

**Contract**: `ChangeMakingTask({ task, world }: { task: ChangeMakingTask; world: World })` → `<TaskScreen world={world} coinCount={task.availableCount} target={task.change} arrangement={task.arrangement} header={story (t.task.give_change.story with {paid}/{price}) + question} hint={count-up gap node — highlight the price→paid span with t.task.give_change.hint} successCopy={t.task.give_change.success} />`.

#### 6. Polymorphic task page

**File**: `src/pages/app/task.astro` (modify)

**Intent**: Generate via the dispatcher and mount the island matching the task type.

**Contract**: Replace `generateCountingTask(profile.starting_level)` with `generateTask(profile.starting_level)`; render `{task.type === "counting" ? <CountingTask client:load task={task} world={world} /> : <ChangeMakingTask client:load task={task} world={world} />}`. SSR loader, gating, and defensive redirects unchanged.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Unit tests pass: `npm test`
- Build passes: `npm run build`

#### Manual Verification:

- **Counting regression**: a counting task still renders and plays exactly as in S-02 (tap, tally, retry, pile hint, success → `/app/start`).
- **Change-making**: a change-making task shows the customer story (paid + price) and a coin tray; tapping coins builds the tally; "Sprawdź" with `tally === change` succeeds → `/app/start`.
- Wrong change → gentle retry with taps preserved; after the 2nd miss the count-up hint highlights the price→paid gap. No red flash/buzzer/dead-end.
- Over several `/app/task` visits, **both** task types appear (random dispatch).
- No coins/score persisted; reloading `/app/start` shows unchanged state.
- Animation smooth; coin tap targets don't cross-register.

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation that both task types play correctly before considering the slice done.

---

## Testing Strategy

### Unit Tests (vitest):

- Change-making generator invariants (change cap, `change = paid − price`, `paid` band ceiling, `availableCount ≥ change`, arrangement threshold); `isChangeCorrect` exact-match; `generateTask` dispatch by injected `pickType`.

### Integration / Route:

- Not added (testing depth = pure logic, mirroring S-02). `/app/task` gating + render are manually verified.

### Manual Testing Steps:

1. Sign in, tap the business → `/app/task`. Refresh a few times to observe both task types appearing.
2. On a **counting** task: confirm it plays identically to S-02 (regression).
3. On a **change-making** task: read the story (paid/price), tap coins to give the change, "Sprawdź" → success → `/app/start`.
4. Give wrong change → gentle retry, taps preserved; wrong again → count-up hint highlights price→paid.
5. Reload `/app/start` → no score/coin change persisted.

## Performance Considerations

All interaction client-side; no per-tap round-trip (`prd-v2.md:148`). Coin images `loading="lazy"` (existing `CoinBoard` pattern). Keep success animation within `tw-animate-css` utilities.

## Migration Notes

None — stateless slice, no migration. (Gameplay state is S-04.)

## References

- S-02 research (contract baseline): `context/archive/2026-06-29-counting-task-in-business-context/research.md`
- S-02 plan (the pattern this mirrors): `context/archive/2026-06-29-counting-task-in-business-context/plan.md`
- Roadmap slice: `context/foundation/roadmap.md:107-117` (S-03)
- PRD: `prd-v2.md` §Business Logic (150-158), US-02 AC (77-82), FR-006/007/008/009/010
- Live S-02 code reused: `src/types.ts`, `src/data/counting-tasks.ts`, `src/components/child/CountingTask.tsx`, `src/pages/app/task.astro`, `src/i18n/pl.ts:171-185`
- Lessons: `context/foundation/lessons.md` (L-003 applies; L-001/L-002 N/A)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Domain & contract generalization

#### Automated

- [x] 1.1 Type checking passes: `npm run check` — 44b1608
- [x] 1.2 Linting passes (incl. no-inline-literal rule): `npm run lint` — 44b1608
- [x] 1.3 Unit tests pass: `npm test` — 44b1608
- [x] 1.4 Build passes: `npm run build` — 44b1608

#### Manual

- [x] 1.5 `src/types.ts` exports `ChangeMakingTask` + `Task`; `CountingTask` untouched — 44b1608
- [x] 1.6 `generateChangeMakingTask` spot-check: `change = paid − price`, change within tier cap, `availableCount > change` — 44b1608
- [x] 1.7 All new copy lives in `pl.ts` (grep new files — no inline literals) — 44b1608
- [x] 1.8 Polish copy reads naturally for a 6–8-year-old (pending native-speaker confirmation) — 44b1608

### Phase 2: UI — shared core + change-making island + polymorphic page

#### Automated

- [x] 2.1 Type checking passes: `npm run check`
- [x] 2.2 Linting passes: `npm run lint`
- [x] 2.3 Unit tests pass: `npm test`
- [x] 2.4 Build passes: `npm run build`

#### Manual

- [x] 2.5 Counting regression: a counting task plays exactly as in S-02 (tap, tally, retry, pile hint, success → `/app/start`)
- [x] 2.6 Change-making: story (paid + price) + coin tray render; tapping builds the tally; correct change → success → `/app/start`
- [x] 2.7 Wrong change → gentle retry with taps preserved; 2nd miss → count-up hint highlights price→paid; no red flash/buzzer/dead-end
- [x] 2.8 Over several `/app/task` visits, both task types appear (random dispatch)
- [x] 2.9 No coins/score persisted; reloading `/app/start` shows unchanged state
- [x] 2.10 Animation smooth; coin tap targets don't cross-register
