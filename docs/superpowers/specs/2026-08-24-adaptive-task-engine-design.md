# Adaptive Task Engine — P1 + P3

**Status:** design approved, ready for `/10x-new` → `/10x-plan`
**Date:** 2026-08-24
**Scope:** per-task telemetry (P1) + continuous adaptive difficulty (P3)

---

## Problem

MathShop already randomises task *numbers* — `generateCountingTask` draws
`targetCount` from a tier band, `generateChangeMakingTask` draws price and
change. A child does not see the same numbers twice.

Two things are genuinely missing.

**Difficulty does not adapt.** It derives from
`tierForLevel(startingLevel)` — the child's age, frozen into the profile at
creation. It does not move within a shift, and it does not move between
shifts. The signal to drive it already exists (`skill_state.firstTryCorrect`,
`shift_log`) but never reaches the generators.

**Adaptation is architecturally impossible today.** `generateShift` builds
every task up front, on the server. `ShiftScreen` documents why:

> The shift's tasks, generated ONCE on the server. Generating them here would
> draw different random tasks during SSR and again at hydration — React would
> discard the server tree (a hydration mismatch) and the child would see one
> task flash into another.

The constraint is real but narrower than it looks: a hydration mismatch can
only occur on the *first* render. Tasks 2…N are produced after the child
interacts, long past hydration. Lazy generation is safe as long as task 1
still comes from the server.

**There is no per-task measurement.** `shift_log` stores a per-shift
aggregate. Nothing records which scenario ran, at what parameters, how many
attempts it took, or how long it lasted. Without that, a difficulty model has
nothing to consume, thresholds cannot be tuned, and the feature's
effectiveness cannot be demonstrated.

## Scope

This spec covers P1 (telemetry) and P3 (adaptive engine) from the agreed
four-part decomposition:

| Part | Subject | Status |
| ---- | ------- | ------ |
| P1 | Per-task telemetry | **this spec** |
| P3 | Continuous difficulty + in-shift adaptation | **this spec** |
| P2 | Skill taxonomy + new task types (curriculum) | later, its own spec |
| P4 | Narrative variety + offline LLM generation | later, its own spec |

P1 and P3 ship together because they are tightly coupled — the engine consumes
exactly what the telemetry records — and because P1 alone delivers nothing
visible to the child.

**Ordering rationale.** P3 is deliberately sequenced before P2, against
intuition. P3 builds on the two existing task types, is cheap, and immediately
tests the hypothesis that adaptation improves the experience. It also produces
the data (via P1) that tells us where the difficulty ceiling actually is.
Building P2 first would mean designing a large taxonomy and a gate migration
on instinct, with no measurement. The accepted cost is that P3 on two task
types has a low ceiling — one reached in weeks, not days.

## Non-goals

- Parent-facing difficulty controls. `context/foundation/backlog.md` lists
  these under parked non-goals per PRD v3 §Non-Goals. The engine is fully
  automatic; the parent sees its effects only through the weekly report.
- New task types or new competencies — that is P2.
- LLM involvement of any kind — that is P4, and offline only.
- Persisting mid-shift state. FR-016 stands.

---

## Design

### 1. Difficulty model

Replace the three hard tiers with a scalar `d ∈ [0, 1]`, held **per
competency** (`math`, `money`) in `child_profiles.skill_state`.

Per-competency rather than global: a child can be strong at counting and weak
at giving change. Today `tierForLevel` yields one tier for everything.

`tierForLevel(startingLevel)` is retained as the **seed value for a fresh
profile** — age remains the best first approximation — but stops being the
source of truth once play begins.

Generator parameters (`COUNT_RANGE`, `CHANGE_CAP`, `PAID_MAX`, `SHIFT_LENGTH`)
become functions of `d`, interpolating between today's tier-1 and tier-3
extremes so current behaviour is preserved at the endpoints. Each keeps a band
around the `d` point — without it, a child at fixed `d` would receive the same
number repeatedly.

Absolute safe bounds are enforced independently of `d`, so no combination of
difficulty and seed can produce an unrenderable or age-inappropriate task
(the existing `TRAY_CAP` plays this role for tray size and is retained).

**Backward compatibility:** a profile whose `skill_state` has no `difficulty`
key derives it from `starting_level` during normalisation in `readSkillState`
— the same defensive coercion pattern as `safeCount`. **No data migration.**

### 2. Adaptation rule

After each scored task, for that task's competency:

```
d += ADAPT_RATE * (observed − TARGET_SUCCESS)
```

where `observed` is 1 if the child answered correctly on the first try and 0
otherwise, and `TARGET_SUCCESS ≈ 0.8`.

This converges on a ~80% first-try success rate and is **asymmetric by
construction**: a miss moves `d` down four times as far as a success moves it
up. That is the desired behaviour with a child — back off quickly, tighten
cautiously.

Four guards sit on top:

1. **Warm-up.** The first task of a shift does not modify `d`. The child needs
   to settle in before being measured.
2. **Post-miss cooldown.** `d` never increases on the task immediately
   following a missed one, even if that task was clean. Without this the
   engine oscillates.
3. **Per-shift drift clamp.** `|d_end − d_shift_start| ≤ MAX_SHIFT_DRIFT`. One
   bad session cannot sink a profile; one lucky streak cannot launch it.
4. **Ending on a win.** The last task of a shift is generated at
   `d − FINAL_TASK_RELIEF` (a named constant, not a tier step — the scale is
   continuous), clamped at 0. It still scores and still records telemetry; only
   its generation difficulty is lowered. Cheap to implement, high emotional
   payoff.

**`misses` is deliberately excluded from the rule.** A task missed five times
is a stronger signal than one missed once, and it is tempting to weight it.
That weighting would be a guess. `misses` is recorded in telemetry and the
rule can be tuned on real data later. This is precisely why P1 ships first.

**Task-type selection.** `pickType` is a fixed 50/50 split today. It gains a
bias toward the weaker competency, hard-capped at roughly 65/35 — a child must
never receive only the thing they are worst at. The existing guarantee that a
shift of length ≥ 2 contains at least one of each type is preserved.

All constants above follow the codebase convention: named, documented as
first-guess, tunable after kid-testing.

### 3. Data flow

The server (`task.astro`) builds a **shift plan** — length, `seed`, and
starting `d` per competency — and renders **task 1**. `ShiftScreen` receives
the plan in place of a ready-made `tasks` array.

The client generates tasks 2…N lazily, through a seeded `pick`. This works
without changing generator signatures: `generateCountingTask` and
`generateChangeMakingTask` already accept an injectable
`pick(min, max)` for deterministic tests. The testability seam the codebase
already has is exactly the seam this design needs. The PRNG is mulberry32
(~5 lines).

Because generation is deterministic and local, there are no per-task
round-trips, no added latency, no hydration mismatch (task 1 is still
server-rendered), and gameplay continues uninterrupted through a network drop.

Pure logic lives in `src/data/adaptive.ts` — no React, no Supabase, no i18n,
matching `skills.ts` and `shift.ts`. Orchestration lives in
`src/components/hooks/useShiftEngine.ts` per the hooks convention.

**The single-write invariant is preserved.** The `/api/shifts/complete`
payload grows to carry an `attempts` array; no per-task POST is added. S-12's
offline handling depends on the shift-end POST being the only server write,
and that stays true.

**The server recomputes difficulty** from `attempts` plus the stored `d`,
rather than accepting a client-supplied value.

### 4. Anti-tampering

Lazy client generation means the client knows and reports its own difficulty.
This is an accepted, bounded cost:

- Earnings are already recomputed server-side from `taskCount` / `cleanCount`;
  difficulty feeds no currency.
- There is no leaderboard, no competitive surface, and no cross-child
  comparison (a PRD guardrail).
- Recomputing `d` server-side means the only available lie is "I answered
  everything correctly", which *raises* difficulty. The cheat harms only its
  author.

Route validation extends the existing anti-inflation posture:
`attempts.length === taskCount`, the count of `first_try` entries equals
`cleanCount`, each attempt's `competency` matches its `task_type`, and the
array is capped at `MAX_SHIFT_TASKS`.

### 5. Telemetry schema

New table `task_attempt`:

| Column | Type | Note |
| ------ | ---- | ---- |
| `id` | uuid | primary key |
| `account_id` | uuid | → `auth.users`, on delete cascade; RLS owner |
| `profile_id` | uuid | → `child_profiles`, on delete cascade |
| `shift_log_id` | uuid null | → `shift_log`, on delete cascade |
| `created_at` | timestamptz | default `now()` |
| `task_type` | text | `counting` \| `change_making` |
| `scenario` | text | `count_till` \| `give_change` \| `stock_and_change` |
| `competency` | text | `math` \| `money` |
| `difficulty` | real | `d` at generation time |
| `params` | jsonb | `targetCount` / `price` / `change` / `paid` … |
| `first_try` | boolean | |
| `misses` | int | |
| `duration_ms` | int null | |

Ships the full L-001 contract **in the same migration**: RLS enabled plus four
per-operation policies (`to authenticated`, predicated on
`auth.uid() = account_id`), exactly as `shift_log` does. `account_id` is taken
from the RLS-verified profile row, never from client input (L-002). A wrong or
missing policy here is a silent data leak, not a crash.

Indexes on `(account_id)` for the RLS predicate path and
`(profile_id, created_at)` for the analysis path.

Rows are written server-side, batched at shift end, in the same call as
`recordShiftResult`.

Rollback: `drop table public.task_attempt`.

### 6. Error handling

- **Offline mid-shift (S-12):** improves. With no per-task fetch, a dropped
  connection no longer threatens task delivery. The existing overlay behaviour
  is unchanged.
- **Shift save fails:** `attempts` are lost along with the shift result,
  exactly as `skills` is today. No local persistence is added — FR-016 states
  mid-shift state is never persisted.
- **Corrupt or missing `skill_state`:** normalises to the age-derived default
  `d`, following the `safeCount` / `readSkillState` pattern already in
  `skills.ts`.

### 7. Testing

- **Convergence:** synthetic outcome streams drive `d` toward the configured
  target success rate.
- **Guards:** the warm-up task does not move `d`; the drift clamp holds; `d`
  never rises on a post-miss task; the final task is generated at
  `d − FINAL_TASK_RELIEF`.
- **Determinism:** identical seed plus identical outcomes yields an identical
  task sequence.
- **Range invariant (property-style):** for any `d ∈ [0,1]` and any seed,
  generated tasks stay inside the absolute safe bounds — never "count to 200".
- **Isolation:** a `task_attempt` cross-account negative test modelled on
  `tests/shift-log-isolation.test.ts`.
- **Reconciliation:** `/api/shifts/complete` rejects mismatched `attempts`.
- **Regression:** the existing shift E2E passes unchanged.

---

## Files affected

| Path | Change |
| ---- | ------ |
| `supabase/migrations/<ts>_create_task_attempt.sql` | new — table + RLS + 4 policies + indexes |
| `src/data/adaptive.ts` | new — `d` model, adaptation rule, guards, seeded PRNG |
| `src/components/hooks/useShiftEngine.ts` | new — lazy per-task generation + outcome accumulation |
| `src/data/counting-tasks.ts` | `COUNT_RANGE` → function of `d`; `tierForLevel` retained as seed only |
| `src/data/change-making-tasks.ts` | `CHANGE_CAP` / `PAID_MAX` → functions of `d` |
| `src/data/shift.ts` | `generateShift` → shift *plan*; `SHIFT_LENGTH` → function of `d` |
| `src/data/tasks.ts` | `pickType` gains capped weak-competency bias |
| `src/data/skills.ts` | `skill_state` carries per-competency `d`; `readSkillState` defaults it |
| `src/components/child/ShiftScreen.tsx` | consumes a plan instead of a `tasks` array |
| `src/pages/app/task.astro` | builds the plan, renders task 1 |
| `src/pages/api/shifts/complete.ts` | `attempts` in payload + zod validation + reconciliation |
| `src/lib/services/child-profiles.ts` | `recordShiftResult` writes attempts, recomputes `d` |

## Open tuning parameters

Named constants, first-guess values, to be settled after kid-testing on P1
data — not blockers for implementation:

- `TARGET_SUCCESS` (~0.8) — the master control on how hard the whole game feels
- `ADAPT_RATE` — adaptation speed
- `FINAL_TASK_RELIEF` — how much easier the shift's closing task is
- `MAX_SHIFT_DRIFT` — per-shift movement ceiling
- Weak-competency bias cap (~65/35)
- The `d` → parameter interpolation curves and their band widths

## Follow-on

P2 (curriculum) inherits the `d` scale and the telemetry table, and must
additionally resolve how the widened taxonomy maps onto the existing closed
`COMPETENCIES` set and the S-07 upgrade gates — extending that set moves the
gates under existing profiles, which needs a migration and a mapping decision.
That is out of scope here and called out so it is not discovered late.
