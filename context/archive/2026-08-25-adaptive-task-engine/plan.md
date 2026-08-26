# Adaptive Task Engine (P1 + P3) Implementation Plan

## Overview

Replace the three frozen difficulty tiers with a continuous, per-competency
difficulty scalar `d` that adapts to how the child is actually doing, and add
per-task telemetry so `d`'s constants can be tuned on real data rather than
guessed.

The work is sequenced so that **phases 1–4 change nothing the child sees**.
Telemetry lands and proves itself against today's behaviour; the difficulty model
is calibrated to reproduce today's distributions; the client rendering loop is
rearchitected while still producing identical tasks. Only phase 5 turns
adaptation on.

## Current State Analysis

Difficulty derives from `tierForLevel(startingLevel)` — the child's age, frozen
into the profile at creation (`src/data/counting-tasks.ts:28-30`). It does not
move within a shift or between shifts. `generateShift` builds every task up front
on the server (`src/pages/app/task.astro:36`), so in-shift reaction is
architecturally impossible today.

`shift_log` records a per-shift aggregate. Nothing records which scenario ran, at
what parameters, how many attempts it took, or how long it lasted — so no
difficulty model has anything to consume.

Server-side generation is **not** a design decision. S-04 shipped tasks
client-generated; S-12 depended on it. Server generation arrived 2026-08-22 in
commit `64f9f94` as a hydration-mismatch bugfix, recorded under a struck-through
bug entry in `context/archive/2026-08-22-web-shell-and-mockup-parity/change.md:54-57`.
The prohibition survives only as code comments in three files.

### Key Discoveries

- **`d` cannot live in `skill_state`.** `readSkillState`
  (`src/data/skills.ts:56-68`) and `addSkillDelta` (`:76-88`) construct fresh
  objects keyed only by `COMPETENCIES` with exactly three fields; a `difficulty`
  key would be silently dropped on the next write
  (`src/lib/services/child-profiles.ts:217`, `:301`). `CompetencyProgress` is also
  documented monotonic (`src/types.ts:122`) and `d` is not.
- **The picker injection chain is broken at `src/data/tasks.ts:24`** — it calls
  the leaf generators with no picker, so `generateShift` cannot inject the numeric
  `pick`. Generator signatures must change.
- **Shift length must stay fixed at plan time.** Five `ShiftScreen` sites need the
  total from task 1 (`:74`, `:87-92`, `:184`, `:186-195`, `:156-169`), and
  `e2e/helpers/solve-shift.ts:51-58` parses it from the progress text and loops on
  it — `:60` uses the exact `"Zadanie N z M"` string as its state wait, because
  `e2e/CLAUDE.md:26-28` bans `page.waitForTimeout()`.
- **E2E bakes in the tier-1 envelope.** `solve-shift.ts:41-45` throws on any third
  task shape; `gameplay-restore.spec.ts:48,:52,:120-124` hardcode "5–7 task shift →
  always 2 stars", "30 zł sign affordable after any shift (min 37 zł)", and "40–56
  zł earned → next upgrade is the 60 zł shelf". `solve-shift.ts:75` independently
  recomputes `earned = 5 * taskCount + 3 * cleanCount`.
- **The tier-1/2 number bands are pedagogically justified, not tunable** — "never
  exceed ~20 in v1"
  (`context/archive/2026-06-29-counting-task-in-business-context/research.md:120`);
  `SCATTER_MAX = 5` is subitizing. Tier-3 values, `STOCK_AND_CHANGE_RATE`,
  `SHIFT_LENGTH` and `SKILL_THRESHOLDS` *are* documented first-guess and tunable.
- **`TaskOutcome` carries no timing** (`src/components/hooks/useCoinTask.ts:11-14`)
  and nothing in the repo measures per-task time.
- **There is no seeded RNG and no property-testing dependency.** Determinism comes
  from injected pickers; "property-style" means a hand-rolled invariant helper
  called inside a sweep loop (`tests/change-making-tasks.test.ts:19-32`).
- **`recordShiftResult` is four non-transactional round trips** with a
  pre-existing lost-update window. The only atomicity precedent is
  `register_pin_failure` (`supabase/migrations/20260702120000_pin_failure_throttle_rpc.sql:16-31`).

## Desired End State

A child's task difficulty moves with their demonstrated performance, per
competency, bounded by their age band. Every task attempt is recorded with its
parameters, outcome and duration, so the model's constants can be tuned on
evidence.

Verify by: a fresh level-1 profile's first shift is indistinguishable from
today's; a profile driven through a streak of clean answers receives measurably
larger numbers within the same shift, never exceeding its band ceiling; a profile
driven through misses receives smaller ones; `task_attempt` holds one row per task
with correct parameters; a second account can neither read nor write those rows.

## What We're NOT Doing

- **No new task types and no new competencies.** That is P2
  (`context/foundation/backlog.md:80-88`, B2 `pricing-and-inventory`).
- **No LLM anywhere.** That is P4, offline only.
- **No parent-facing difficulty controls** — parked non-goal (`prd-v3.md:161`).
- **No mid-shift persistence.** FR-016 stands; the single shift-end write survives.
- **No fix for the `recordShiftResult` lost-update window.** It predates this
  change. Recorded in Open Risks.
- **No change to `skill_state` semantics.** It stays monotonic and stays the
  source for upgrade gates.
- **No multi-denomination coins, no change to `TRAY_CAP`, no change to the
  earnings or stars formulas.**

## Implementation Approach

`d ∈ [0, 1]` per competency (`math`, `money`), stored in a new
`child_profiles.difficulty_state` jsonb column — mirroring the `skill_state`
precedent (jsonb + normalizer + no data migration) and deliberately *not* inside
`skill_state`, which is what preserves S-07's monotonicity guardrail.

Adaptation is `d += ADAPT_RATE * (observed − TARGET_SUCCESS)` with `observed ∈
{0,1}` from `firstTry` and `TARGET_SUCCESS ≈ 0.8`, clamped to
`[0, ceilingForLevel(starting_level)]`. Four guards: warm-up (first task does not
move `d`), post-miss cooldown, per-shift drift clamp, and a closing task generated
at `d − FINAL_TASK_RELIEF`.

Tasks 2…N generate lazily on the client from a server-supplied seed (mulberry32),
threaded through the generators' existing injectable `pick` seam. Task 1 stays
server-rendered, which is what keeps the hydration constraint satisfied. Shift
length is fixed at plan time. The single shift-end POST grows an `attempts` array;
no per-task write is added.

The server recomputes `d` from the reported attempts rather than trusting a
client-supplied value, so the only available lie inflates the child's own
difficulty.

## Critical Implementation Details

**Calibration is the load-bearing constraint, not a nicety.** The `d`→parameter
interpolation must be calibrated so that `seedDifficultyFor(startingLevel = 1)`
reproduces today's tier-1 distributions exactly: `SHIFT_LENGTH {5,7}`,
`COUNT_RANGE {3,10}`, `CHANGE_CAP 5`, `PAID_MAX 10`. Four e2e executions
(`gameplay-restore` × desktop + touch) assert on that envelope, and their
assertions are about earnings and star counts, so a drift of one task in shift
length silently changes which upgrade is affordable and flips the test.

**Ordering within phase 2.** The attempts array is built in `ShiftScreen` from the
positional join it already performs at `:87-92` — `results[i]` paired with
`tasks[i]`. That join must survive the phase-4 rearchitecture; generated tasks
have to be retained in order, not discarded after render.

**Timing excludes the celebration beat.** `useCoinTask` fires `onComplete` after a
fixed 1400 ms `setTimeout` (`:55-63`). Duration must be captured at the moment
`check()` succeeds, not at `onComplete`, or every attempt records 1400 ms of
animation.

---

## Phase 1: task_attempt table and RLS contract

### Overview

Ship the telemetry table with the full L-001 contract in a single migration.
Purely additive — nothing reads or writes it yet.

### Changes Required

#### 1. Migration

**File**: `supabase/migrations/20260825120000_create_task_attempt.sql`

**Intent**: Create the per-task telemetry table with row-level security in the
same migration, per L-001. A wrong or missing policy here is a silent data leak,
not a crash.

**Contract**: Columns `id uuid pk`, `account_id uuid not null references
auth.users(id) on delete cascade`, `profile_id uuid not null references
public.child_profiles(id) on delete cascade`, `created_at timestamptz not null
default now()`, `shift_index int not null` (0-based position within its shift),
`task_type text not null`, `scenario text not null`, `competency text not null`,
`difficulty real null` (populated from Phase 3 on — see Phase 2), `params jsonb
not null`, `first_try boolean not null`,
`misses int not null`, `duration_ms int null`.

No `shift_log_id` FK and no `updated_at` — the table is append-only, so it follows
`shift_log`'s shape (`supabase/migrations/20260701150000_create_shift_log.sql:21-63`),
which omits `updated_at` and its trigger **but still defines all four policies**.
Indexes: `task_attempt_account_id_idx (account_id)` and
`task_attempt_profile_created_idx (profile_id, created_at)`. RLS enabled plus four
per-operation policies, all `to authenticated`, all predicated on `auth.uid() =
account_id`; INSERT uses `with check` only, UPDATE uses both. Rollback: `drop table
public.task_attempt`.

#### 2. Isolation test

**File**: `tests/task-attempt-isolation.test.ts`

**Intent**: Prove a second account can neither read, update, delete, nor insert on
behalf of the first. This is the merge gate CI runs.

**Contract**: Model on `tests/shift-log-isolation.test.ts` — two accounts from
`createSignedInUser`, module-level `admin` used only to provision and to confirm
durable state, five `it()`s mapping 1:1 to the policies. The INSERT-on-behalf
assertion must chain **no** `.select()` (L-002), must supply every other column
with a legal value so only `with check` can reject, and must verify with a
service-role read that no on-behalf row exists.

#### 3. Contract registration

**File**: `docs/reference/contract-surfaces.md`

**Intent**: Register the new surface. There is no automated check on this file —
an omission fails silently and permanently.

**Contract**: New H2 `## public.task_attempt` following the established entry
shape: prose paragraph, then bold bullets *Defined in / Owner column / Columns /
Indexes / RLS* (four nested policy sub-bullets quoting each clause) */ Consumed by
/ Isolation test*. Omit the `updated_at` trigger bullet, as the `shift_log` entry does.

### Success Criteria

#### Automated Verification

- Migration applies cleanly: `npx supabase db reset`
- Isolation test passes: `npm run test -- task-attempt-isolation`
- Full suite still green (baseline 429 passed / 51 files): `npm run test`
- Type checking passes: `npm run check`
- Linting passes: `npm run lint`

#### Manual Verification

- Policy meta-check: temporarily weaken the INSERT policy to `with check (true)`,
  confirm the isolation test goes **red**, restore it, confirm green. A test that
  cannot fail is not a gate.
- `contract-surfaces.md` entry reviewed against the migration for drift.

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: Telemetry write path

### Overview

Record today's tasks. No difficulty behaviour changes — this phase proves the
telemetry pipeline against known-good, fixed-tier generation.

### Changes Required

#### 1. Per-task timing

**File**: `src/components/hooks/useCoinTask.ts`

**Intent**: Measure how long the child spent on a task, excluding the celebration
animation.

**Contract**: `TaskOutcome` gains `durationMs: number`. The clock starts when the
task mounts and stops at the moment `check()` succeeds — **not** in the
`onComplete` callback, which fires after a fixed 1400 ms `setTimeout` (`:55-63`).
`ChangeMakingTask`'s two-stage aggregation (`src/components/child/ChangeMakingTask.tsx:30-42`)
sums both stages' durations alongside its existing `firstTry`/`misses` merge.

#### 2. Attempts in the shift payload

**File**: `src/components/child/ShiftScreen.tsx`

**Intent**: Build a per-task attempt record from the positional join already
performed for the competency delta, and send it with the single shift-end POST.

**Contract**: One attempt entry per completed task, carrying `shift_index`,
`task_type`, `scenario`, `competency`, `difficulty`, `params`, `first_try`,
`misses`, `duration_ms`. `params` carries the generated numbers for that task type
(`targetCount` for counting; `paid`/`price`/`change`/`availableCount`, plus
`stockCount` when present, for change-making). Sent as a JSON string in the
existing `FormData`, alongside — not instead of — the current `skills` payload.
`difficulty` is left **null** in this phase. The continuous scale does not exist
until Phase 3, and writing a normalised tier here would put two incomparable
quantities in one column of the very table whose purpose is tuning. Difficulty is
constant per profile in this phase anyway, so nothing is lost.

#### 3. Route validation

**File**: `src/pages/api/shifts/complete.ts`

**Intent**: Validate and reconcile the attempts array, tightening the existing
anti-inflation posture rather than replacing it.

**Contract**: New `attemptSchema` and an `attempts` field parsed with the same
`z.preprocess` JSON-string pattern as `skills`. Array capped at
`MAX_SHIFT_TASKS`. New `.refine()` rules: `attempts.length === taskCount`; the
count of `first_try === true` equals `cleanCount`; each attempt's `competency`
matches `competencyForTaskType(task_type)`; `shift_index` values form `0..n-1`
without gaps or duplicates. Note the existing refines use `<=` deliberately; these
new ones are exact because the attempts array is a complete record, not an
aggregate.

#### 4. Persistence

**File**: `src/lib/services/child-profiles.ts`

**Intent**: Write the attempt rows as part of the existing shift-completion call.

**Contract**: `recordShiftResult`'s `shift` parameter gains an `attempts` array.
Rows are inserted in one batched `.insert([...])` after the profile UPDATE, with
`account_id` and `profile_id` taken from the RLS-verified row read at `:201` —
never from client input (L-002). Follows `appendShiftLog`'s best-effort posture:
a failed telemetry insert must not fail the shift. This is a third non-atomic
write; see Open Risks.

### Success Criteria

#### Automated Verification

- Route tests cover each new refine, including rejection cases: `npm run test -- shifts-complete`
- `useCoinTask` timing tested with fake timers, asserting the 1400 ms beat is
  excluded: `npm run test -- task-guardrail`
- Full suite green: `npm run test`
- E2E unchanged and green: `npx playwright test`
- Type checking and linting pass: `npm run check && npm run lint`

#### Manual Verification

- Complete a shift in the running app; confirm in Supabase Studio that
  `task_attempt` holds exactly one row per task, with `params` matching what was
  rendered, `duration_ms` in a plausible range (not ~1400 ms per task), and
  `difficulty` null.
- Confirm the child-facing experience is byte-for-byte unchanged.

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Continuous difficulty model

### Overview

Introduce `d` and make the generators functions of it, calibrated to reproduce
today's distributions. Still server-generated, still no in-shift adaptation.

### Changes Required

#### 1. The pure model

**File**: `src/data/adaptive.ts` (new)

**Intent**: The single source of truth for the difficulty scale, its bounds, the
adaptation rule and the seeded RNG. Pure and dependency-free — no React, no
Supabase, no i18n — mirroring `src/data/skills.ts`.

**Contract**: Exports the `[0,1]` scale; `seedDifficultyFor(startingLevel)` giving
a fresh profile's starting `d` per competency; `ceilingForLevel(startingLevel)`
giving the `starting_level`-derived upper bound; the interpolators mapping `d` to each
generator's parameters; `nextDifficulty(d, outcome, context)` implementing
`d += ADAPT_RATE * (observed − TARGET_SUCCESS)` with the warm-up, post-miss
cooldown and drift-clamp guards; and a mulberry32 PRNG exposed as a
`pick(min, max)` matching the generators' existing injectable picker signature.
It also owns `TWO_STAGE_THRESHOLD` — the `d` at or above which the
`stock_and_change` scenario becomes admissible — carrying the invariant
`ceilingForLevel(2) < TWO_STAGE_THRESHOLD`. This is the **scenario-admission**
bound, and it is separate from every other guard here: warm-up, cooldown, the
drift clamp and `ceilingForLevel` all bound the *magnitude* of the numbers, and
none of them can keep a multi-step task away from a six-year-old.
All tunables are named constants documented as first-guess. `TARGET_SUCCESS`,
`ADAPT_RATE`, `MAX_SHIFT_DRIFT` and `FINAL_TASK_RELIEF` live here.

#### 2. Difficulty state column

**File**: `supabase/migrations/20260825130000_child_profiles_add_difficulty_state.sql`

**Intent**: Persist `d` per competency, outside `skill_state`.

**Contract**: `difficulty_state jsonb not null default '{}'` on
`child_profiles`. No RLS work — the existing four policies are column-agnostic.
Existing rows default to `{}` and normalise to their `starting_level`-derived seed on read, so
there is **no data migration**. Rollback: `alter table ... drop column difficulty_state`.

#### 3. Difficulty state normalizer

**File**: `src/data/adaptive.ts`

**Intent**: Read persisted difficulty defensively, exactly as `readSkillState`
does for skills.

**Contract**: `readDifficultyState(state: unknown, startingLevel: number)` returns
a fully-populated per-competency shape, coercing missing, malformed or
out-of-range values to the `starting_level`-derived seed and clamping into
`[0, ceilingForLevel(startingLevel)]`. It takes `startingLevel` explicitly —
unlike `readSkillState`, it is never used as a zeroed accumulator, so the extra
parameter costs nothing.

#### 4. Generators become functions of `d`

**Files**: `src/data/counting-tasks.ts`, `src/data/change-making-tasks.ts`,
`src/data/shift.ts`, `src/data/tasks.ts`

**Intent**: Drive parameter bands from `d` instead of a tier lookup, and repair
the broken picker injection chain.

**Contract**: `COUNT_RANGE`, `CHANGE_CAP`, `PAID_MAX` and `SHIFT_LENGTH` become
functions of `d` rather than `Record<1|2|3, …>` lookups, each keeping a band
around the `d` point so a fixed `d` still varies. `generateTask` gains forwarded
`pick` and `pickTwoStage` parameters — this is the fix for
`src/data/tasks.ts:24`, which today calls the leaf generators with no picker.
`tierForLevel` survives, used only by `seedDifficultyFor`. Absolute safe bounds
(`TRAY_CAP`, `SCATTER_MAX`) remain enforced independently of `d`.

The two-stage gate at `src/data/change-making-tasks.ts:64` changes from
`difficultyTier === 3 && pickTwoStage()` to `d >= TWO_STAGE_THRESHOLD &&
pickTwoStage()`. Today's `=== 3` makes the scenario *structurally* unreachable
below level 3; a threshold makes it reachable by drift, so the
`ceilingForLevel(2) < TWO_STAGE_THRESHOLD` invariant is what restores the
guarantee. The two existing tests that assert this by relying on a tier veto —
`tests/change-making-tasks.test.ts:178-185` and `tests/shift.test.ts:93-101` —
lose their premise and must be replaced by a test over `d` (see Success Criteria).
`tests/shift.test.ts:72-91`, which reasons statistically from `0.7^60` about
tier-3 two-stage frequency, needs its arithmetic restated in terms of `d`.

`MAX_SHIFT_TASKS` (`src/data/shift.ts:30`) is currently
`SHIFT_LENGTH[3].max + MAX_BONUS_TASKS` = 17. `SHIFT_LENGTH[3]` ceases to exist,
so it becomes an explicit `17` with a comment binding it to the maximum of the
length function plus `MAX_BONUS_TASKS` (`src/data/upgrades.ts:44`). It **must not
fall** below the longest reachable shift: `src/pages/api/shifts/complete.ts:82`
returns 400 on any parse failure, and because mid-shift state is never persisted
(FR-016) the child would play a full shift and lose the entire write — wallet,
`completed_shift_count`, `business_level`, `skill_state`, the `shift_log` row and
the whole telemetry array — seeing only the gentle error path. Note
`MAX_SHIFT_MISSES` (`complete.ts:20`) is derived from it at 10×, and gates
`misses`, which feeds `skill_state`, which gates upgrades.

`tests/tasks.test.ts` covers the `generateTask` dispatcher whose signature changes
here, and must be updated with it.

#### 5. Wire the seed through

**File**: `src/pages/app/task.astro`

**Intent**: Generate from the profile's stored `d` rather than its `starting_level`.

**Contract**: Reads `difficulty_state`, normalises it, and passes the resulting
per-competency `d` into shift generation. **Shift length is derived from
`max(d.math, d.money)`** and computed once here — it is fixed for the whole shift.
The profile arrives via `resolvePageProfile` (`src/lib/services/active-profile.ts`),
so the `ChildProfile` interface (`src/lib/services/child-profiles.ts:27-33`) must
declare the new field.

No change is needed in `e2e/helpers/accounts.ts`: `seedChildProfile` never writes
`starting_level` and relies on the column default of 1, so a seeded profile gets
`difficulty_state = '{}'` and normalises to the level-1 seed — which is exactly the
tier-1 envelope the e2e assertions require. Stated here so it is a verified
property rather than an accident.

#### 6. Task type: `difficulty` replaces `difficultyTier`

**File**: `src/types.ts`

**Intent**: Retire the discrete tier field, whose only producer this phase removes.

**Contract**: `CountingTask` and `ChangeMakingTask` (`src/types.ts:36`, `:75`)
carry `difficulty: number` in place of the required `difficultyTier: 1 | 2 | 3`.
The field is transient — never persisted, never in an API payload — but it **is**
JSON-serialized into the `ShiftScreen` island props by Astro
(`src/pages/app/task.astro:51-53`), so this is a hydration-payload change.
Nine assertion sites and three fixture literals move with it:
`tests/counting-tasks.test.ts:36,43,49,57,96`,
`tests/change-making-tasks.test.ts:23,112,198`,
`tests/shift.test.ts:65,68,87`, `tests/task-guardrail.test.tsx:159`.

#### 7. Register the new column

**File**: `docs/reference/contract-surfaces.md`

**Intent**: Record `difficulty_state` on the existing `## public.child_profiles`
surface. Four of four prior column-adding migrations did this in the same commit;
there is no automated check, so an omission fails silently and permanently.

**Contract**: Append the migration to the **Defined in** bullet's
semicolon-separated chain, and insert `difficulty_state` into the **Columns**
list in physical order before `created_at`, followed by a sentence naming its
shape, its normalizer, its writers, and the fact that the existing four policies
cover it (column-agnostic) — following the `skill_state` entry verbatim in form.

#### 8. Absorbed during implementation (addendum)

Three files outside the list above changed in the Phase 3 commit. Recorded here
so the plan keeps matching what shipped:

**File**: `src/data/attempts.ts` — `attemptDifficulty()` becomes
`attemptDifficulty(task)`, recording the real `d` instead of `null`. The only
behaviour change of the three. The P1 migration comment and the P2 code both named
P3 as the moment, and no later phase claimed the work, so it was unassigned rather
than pulled forward. Rows written in P1/P2 keep their `null`, which is why the
column and the return type stay nullable: **null means "not measured", not "zero"**,
and zero is a real difficulty.

**File**: `src/data/skills.ts` — `competencyForTaskType`'s return type narrows from
`Competency` to `PlayCompetency`. Load-bearing, not cosmetic: it is what lets
callers index `DifficultyState` with the result directly, making "never returns
`decisions`" a fact the compiler checks rather than a comment.

**File**: `src/pages/api/shifts/complete.ts` — comment-only, describing the now-real
meaning of the nullable `difficulty` field. No behaviour change.

### Success Criteria

#### Automated Verification

- Calibration test: `seedDifficultyFor(1)` reproduces today's tier-1 bands
  (`SHIFT_LENGTH {5,7}`, `COUNT_RANGE {3,10}`, `CHANGE_CAP 5`, `PAID_MAX 10`)
- Ceiling test: for any outcome stream, `d` never exceeds `ceilingForLevel`
- **Two-stage admission test**: for every `d ≤ ceilingForLevel(2)` and every seed,
  the generated scenario is never `stock_and_change` — replacing
  `tests/change-making-tasks.test.ts:178-185` and `tests/shift.test.ts:93-101`,
  whose tier-veto premise this phase removes
- **Shift-length ceiling test**: no reachable `d` generates a shift longer than
  `MAX_SHIFT_TASKS`
- Convergence test: synthetic streams drive `d` toward `TARGET_SUCCESS`
- Guard tests: warm-up does not move `d`; `d` never rises on a post-miss task;
  the drift clamp holds
- Determinism test: same seed + same outcomes → identical task sequence
- Range invariant: sweep `d` across `[0,1]` × several seeds, assert every
  generated task satisfies the shared invariant helper — following the hand-rolled
  `assertInvariants` convention (`tests/change-making-tasks.test.ts:19-32`), **not**
  by adding a property-testing dependency
- Existing generator suites updated and green: `npm run test`
- E2E green — the envelope must not have moved: `npx playwright test`
- Type checking and linting pass: `npm run check && npm run lint`

#### Manual Verification

- Start shifts on a fresh level-1 profile several times; confirm task counts and
  number ranges feel identical to before the change.
- Confirm an existing profile with history is unaffected on first load.
- `contract-surfaces.md`'s `## public.child_profiles` entry reviewed against the
  migration for drift.

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Lazy client generation, difficulty held constant

### Overview

Move generation of tasks 2…N to the client, deterministically from a seed. `d` is
held constant within the shift, so output remains identical to Phase 3. This
isolates the rendering and hydration risk from the adaptation logic that follows.

### Changes Required

#### 1. The shift plan

**File**: `src/pages/app/task.astro`

**Intent**: Send a plan plus the first task, instead of a fully-materialised array.

**Contract**: Produces `{ length, seed, difficulty }` and the server-rendered
task 1. `length` is fixed here and never changes mid-shift — five `ShiftScreen`
sites and `e2e/helpers/solve-shift.ts` depend on the total being known from task 1.

#### 2. The engine hook

**File**: `src/components/hooks/useShiftEngine.ts` (new)

**Intent**: Produce task N on demand and retain the generated tasks in order.

**Contract**: Takes the plan, returns the current task plus an `advance(outcome)`
callback. Task 1 comes from the server prop verbatim — generating it on the client
would reintroduce the hydration mismatch. Tasks 2…N are drawn from the seeded
`pick`. **Generated tasks are retained in order**, because `ShiftScreen`'s
competency attribution is a positional join between `results[i]` and `tasks[i]`.

#### 3. Orchestrator

**File**: `src/components/child/ShiftScreen.tsx`

**Intent**: Consume the plan through the hook while preserving every behaviour that
depends on knowing the total up front.

**Contract**: The progress counter (`:184`), the segmented bar (`:186-195`),
shift-end detection (`:74`), the competency join (`:87-92`) and the "saving"
transient (`:156-169`) all keep working off the fixed plan length. The
`key={index}` reset semantics for `useCoinTask` (`:203`, `:205`) are preserved.

#### 4. Update the hydration comments

**Files**: `src/pages/app/task.astro:31-35`,
`src/components/child/ShiftScreen.tsx:20-25`,
`src/components/child/RecentActivity.astro:14`

**Intent**: The prohibition these comments state is no longer accurate. Replace it
with the actual rule so the next reader does not re-derive the wrong lesson.

**Contract**: State that task 1 must remain server-rendered and that subsequent
tasks generate post-hydration from a seed — and why that is safe.

### Success Criteria

#### Automated Verification

- Sequence-equivalence test: for a given seed and difficulty, the lazily-generated
  sequence equals what eager generation produced in Phase 3
- No hydration warnings in the component suite: `npm run test -- task-guardrail`
- Full suite green: `npm run test`
- E2E green in **both** projects — this is where `solve-shift.ts` would break:
  `npx playwright test`
- Type checking and linting pass: `npm run check && npm run lint`

#### Manual Verification

- Play a full shift in the browser with the console open; confirm **no React
  hydration-mismatch error** on `/app/task`, and no task visibly flashing into
  another on load.
- Kill the network mid-shift; confirm play continues to the end and the offline
  halt still appears only at save time (S-12 behaviour preserved).

**Implementation Note**: Pause for manual confirmation before Phase 5.

---

## Phase 5: Turn on adaptation

### Overview

Apply the adaptation rule during the shift and persist the recomputed `d`. This is
the only phase that changes what the child experiences.

### Changes Required

#### 1. In-shift adaptation

**File**: `src/components/hooks/useShiftEngine.ts`

**Intent**: Move `d` after each scored task and generate the next task from the
updated value.

**Contract**: Applies `nextDifficulty` per completed task against that task's
competency, honouring warm-up, post-miss cooldown, the drift clamp and the
`ceilingForLevel` bound. The shift's final task is generated at
`d − FINAL_TASK_RELIEF`, clamped at 0; it still scores and still records
telemetry — only its generation difficulty is lowered. Shift length is **not**
recomputed.

#### 2. Task-type selection

**File**: `src/data/tasks.ts`

**Intent**: Bias practice toward the weaker competency without letting a child
receive only the thing they are worst at.

**Contract**: The 50/50 `pickType` gains a bias derived from the two competencies'
`d` values, hard-capped at roughly 65/35. `generateShift`'s existing guarantee
that a shift of length ≥ 2 contains at least one of each type is preserved.

#### 3. Server-side recompute

**File**: `src/lib/services/child-profiles.ts`

**Intent**: Derive the persisted `d` from the reported attempts rather than
trusting a client-supplied value.

**Contract**: `recordShiftResult` folds the attempts array through the same
`nextDifficulty` the client used, starting from the stored `difficulty_state`, and
writes the result in the **existing** profile UPDATE — no additional round trip.
The client never sends a difficulty value for persistence. Because the update
reads then writes, it inherits the pre-existing lost-update window; see Open Risks.

### Success Criteria

#### Automated Verification

- Server-recompute test: given a stored `d` and an attempts array, the persisted
  value matches what the client-side rule produced
- Tamper test: a client-supplied difficulty value in the payload is ignored
- Ceiling test at the route level: no attempts array can drive persisted `d` above
  `ceilingForLevel`
- Type-bias test: the weak-competency bias stays inside its cap and the
  both-types guarantee holds
- Full suite green: `npm run test`
- E2E green in both projects: `npx playwright test`
- Type checking and linting pass: `npm run check && npm run lint`

#### Manual Verification

- Play a shift answering everything correctly; confirm numbers grow within the
  shift and the closing task is visibly easier.
- Play a shift missing deliberately; confirm numbers shrink and never rise
  immediately after a miss.
- Confirm a level-1 profile never exceeds its band ceiling even on a perfect
  streak — this is the pedagogical guardrail, and it is the one failure mode that
  would be wrong rather than merely suboptimal.
- Complete two shifts in a row; confirm the second starts where the first ended.
- Re-measure the baseline: `npm run test` and `npx playwright test --list`.

---

## Testing Strategy

### Unit Tests

- The adaptation rule: convergence, the four guards, the ceiling, clamping
- Calibration: seed values reproduce today's bands
- Determinism: seed + outcomes → identical sequence
- Range invariants across `d` × seed sweeps, via a shared invariant helper
- `readDifficultyState` edge cases: `{}`, missing keys, out-of-range, garbage

### Integration Tests

- `/api/shifts/complete` reconciliation: each new refine, with rejection cases
- Server-side `d` recompute and the tamper case
- `task_attempt` cross-account isolation, including the L-002 INSERT pattern

### Manual Testing Steps

1. Fresh level-1 profile → shift feels identical to today (phases 3–4)
2. Perfect streak **on a level-1 profile** → numbers grow, never past the band
   ceiling. Level must be 1: levels 2–3 seed at their ceiling and cannot rise.
3. Deliberate misses → numbers shrink, no rise immediately after a miss
4. Two consecutive shifts → difficulty carries over
5. Network killed mid-shift → play continues, offline halt only at save
6. Browser console on `/app/task` → no hydration-mismatch error

## Performance Considerations

Lazy generation removes no network calls (there were none during play) but adds
none either — the round-trip-free property S-12 relies on is preserved. The
telemetry write adds one batched insert of ≤ `MAX_SHIFT_TASKS` rows per completed
shift, at shift end only. `task_attempt` grows at roughly one row per task; the
`(profile_id, created_at)` index serves the analysis path.

## Migration Notes

Two additive migrations, neither requiring a data migration. Existing profiles
receive `difficulty_state = '{}'` and normalise on read to their `starting_level`-derived seed
— **history in `skill_state` is deliberately ignored**, so no existing child
experiences a difficulty jump on the day this ships, and the engine re-converges
within two or three shifts. Both migrations are independently reversible by
dropping the table and the column respectively.

## References

- Research: `context/changes/adaptive-task-engine/research.md`
- Approved design: `docs/superpowers/specs/2026-08-24-adaptive-task-engine-design.md`
- RLS pattern to copy: `supabase/migrations/20260701150000_create_shift_log.sql:21-63`
- Isolation test pattern: `tests/shift-log-isolation.test.ts:128-152`
- Contract rules: `docs/reference/rls-isolation.md:12-20`
- E2E constraints: `e2e/helpers/solve-shift.ts`, `e2e/CLAUDE.md`

## Open Risks & Assumptions

- **Pre-existing lost-update window.** `recordShiftResult` is a
  read-modify-write across four non-transactional round trips
  (`src/lib/services/child-profiles.ts:193-223`). Two concurrent completions on the
  same profile already clobber `completed_shift_count`; server-side `d` recompute
  joins that window, costing one shift's difficulty drift. Deliberately not fixed
  here — the window predates this change and the only repo precedent for closing it
  (`register_pin_failure`) would mean rewriting the authoritative write path in
  SQL. Revisit if cross-device concurrent play ever becomes real.
- **Third non-atomic write.** A failed `task_attempt` insert leaves a completed
  shift with no telemetry. Accepted, following `appendShiftLog`'s documented
  best-effort posture — telemetry must never fail a child's shift.
- **The difficulty ceiling makes `starting_level` more load-bearing.** With the
  band bounded by age and `starting_level` frozen by an S-04 guardrail, a child who
  genuinely outgrows their band cannot be promoted. Acceptable for P1+P3; band
  promotion is a product decision, not an engine detail.
- **Levels 2 and 3 seed AT their ceiling, so adaptation there is one-way.**
  `seedDifficultyFor(2) = ceilingForLevel(2) = 0.5` and
  `seedDifficultyFor(3) = ceilingForLevel(3) = 1`, because the grades 1–2 band
  ("never above ~20", FR-007) is exactly tier 2's parameter set. Those cohorts can
  therefore only move DOWN; upward adaptation is observable on level-1 profiles
  only. This follows from the pedagogical bound, not from a tuning choice, and is
  accepted — but it means **any manual check of "difficulty rises" must be run on a
  level-1 profile**, or it will correctly observe nothing and read as a broken
  engine. Surfaced by the Phase 3 implementation review.
- **P3's ceiling is low, by design.** S-08 already concluded that "bigger numbers
  alone make tasks longer, not harder"
  (`context/archive/2026-07-02-upper-band-task-difficulty/research.md:30`). Adaptation
  on two task types will exhaust its useful range. That is the accepted cost of
  sequencing P3 before P2 — we want to hit that ceiling with telemetry in hand.
- **All constants are first-guess.** `TARGET_SUCCESS`, `ADAPT_RATE`,
  `MAX_SHIFT_DRIFT`, `FINAL_TASK_RELIEF` and the interpolation curves need
  kid-testing. `misses` is deliberately excluded from the rule pending P1 data.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: task_attempt table and RLS contract

#### Automated

- [x] 1.1 Migration applies cleanly — ef631d2
- [x] 1.2 Isolation test passes — ef631d2
- [x] 1.3 Full suite still green — ef631d2
- [x] 1.4 Type checking passes — ef631d2
- [x] 1.5 Linting passes — ef631d2

#### Manual

- [x] 1.6 Policy meta-check: weakened policy turns the test red, restore turns it green — ef631d2
- [x] 1.7 contract-surfaces.md entry reviewed against the migration — ef631d2

### Phase 2: Telemetry write path

#### Automated

- [x] 2.1 Route tests cover each new refine including rejection cases — eab14ed
- [x] 2.2 useCoinTask timing tested, 1400 ms beat excluded — eab14ed
- [x] 2.3 Full suite green — eab14ed
- [x] 2.4 E2E unchanged and green — eab14ed
- [x] 2.5 Type checking and linting pass — eab14ed

#### Manual

- [x] 2.6 task_attempt holds one correct row per task, duration_ms plausible, difficulty null — eab14ed
- [x] 2.7 Child-facing experience unchanged — eab14ed

### Phase 3: Continuous difficulty model

#### Automated

- [x] 3.1 Calibration test: seed reproduces today's tier-1 bands — d04d17a
- [x] 3.2 Ceiling test: d never exceeds ceilingForLevel — d04d17a
- [x] 3.3 Two-stage admission test: never below ceilingForLevel(2) — d04d17a
- [x] 3.4 Shift-length ceiling test: no reachable d exceeds MAX_SHIFT_TASKS — d04d17a
- [x] 3.5 Convergence test toward TARGET_SUCCESS — d04d17a
- [x] 3.6 Guard tests: warm-up, post-miss cooldown, drift clamp — d04d17a
- [x] 3.7 Determinism test — d04d17a
- [x] 3.8 Range invariant sweep via shared invariant helper — d04d17a
- [x] 3.9 Existing generator suites updated and green — d04d17a
- [x] 3.10 E2E green — envelope unmoved — d04d17a
- [x] 3.11 Type checking and linting pass — d04d17a

#### Manual

- [x] 3.12 Fresh level-1 shifts feel identical to before — d04d17a
- [x] 3.13 Existing profile with history unaffected on first load — d04d17a
- [x] 3.14 contract-surfaces.md child_profiles entry reviewed against the migration — d04d17a

### Phase 4: Lazy client generation, difficulty held constant

#### Automated

- [x] 4.1 Sequence-equivalence test vs Phase 3 eager generation — f248a04
- [x] 4.2 No hydration warnings in the component suite — f248a04
- [x] 4.3 Full suite green — f248a04
- [x] 4.4 E2E green in both projects — f248a04
- [x] 4.5 Type checking and linting pass — f248a04

#### Manual

- [x] 4.6 No hydration-mismatch error in the browser console; no task flash — f248a04
- [x] 4.7 Network killed mid-shift: play continues, offline halt only at save — f248a04

### Phase 5: Turn on adaptation

#### Automated

- [x] 5.1 Server-recompute matches the client-side rule — 981c5b2
- [x] 5.2 Client-supplied difficulty is ignored — 981c5b2
- [x] 5.3 Route-level ceiling test — 981c5b2
- [x] 5.4 Type-bias cap and both-types guarantee hold — 981c5b2
- [x] 5.5 Full suite green — 981c5b2
- [x] 5.6 E2E green in both projects — 981c5b2
- [x] 5.7 Type checking and linting pass — 981c5b2

#### Manual

- [x] 5.8 Perfect streak on a LEVEL-1 profile: numbers grow, closing task visibly easier — 981c5b2
- [x] 5.9 Deliberate misses: numbers shrink, no rise immediately after a miss — 981c5b2
- [x] 5.10 Level-1 profile never exceeds its band ceiling on a perfect streak — 981c5b2
- [x] 5.11 Difficulty carries across two consecutive shifts — 981c5b2
- [x] 5.12 Baseline re-measured — 981c5b2
