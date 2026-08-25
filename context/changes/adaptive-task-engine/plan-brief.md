# Adaptive Task Engine (P1 + P3) — Plan Brief

> Full plan: `context/changes/adaptive-task-engine/plan.md`
> Research: `context/changes/adaptive-task-engine/research.md`
> Approved design: `docs/superpowers/specs/2026-08-24-adaptive-task-engine-design.md`

## What & Why

Replace the three frozen difficulty tiers with a continuous, per-competency
difficulty scalar that adapts to how the child is actually doing — within a shift
and across shifts — and add per-task telemetry so the model's constants can be
tuned on evidence rather than guessed. Today difficulty is derived from the
child's age, frozen at profile creation, and never moves.

## Starting Point

`tierForLevel(startingLevel)` maps a frozen age to one of three parameter bands.
`generateShift` builds every task up front on the server, so in-shift reaction is
architecturally impossible. `shift_log` records a per-shift aggregate — nothing
records which scenario ran, at what parameters, how many attempts, or how long.

Server-side generation turns out not to be a design decision: S-04 shipped tasks
client-generated and S-12 depended on it. Server generation arrived 2026-08-22 in
`64f9f94` as a hydration-mismatch bugfix. This plan returns to the original
architecture with the mismatch properly avoided.

## Desired End State

A child's numbers grow when they are doing well and shrink when they are
struggling, separately for counting and for giving change, never leaving the band
their age justifies. Every attempt is recorded with its parameters, outcome and
duration. A shift still ends on a win.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Where `d` lives | New `child_profiles.difficulty_state` jsonb | `readSkillState`/`addSkillDelta` build fresh objects, so a key in `skill_state` would be silently dropped; also keeps S-07's monotonicity guardrail intact | Research → Plan |
| Difficulty bounds | Per-competency ceiling from `starting_level` | Tier-1/2 bands are pedagogically justified ("never exceed ~20 in v1"), not a difficulty knob — adaptation moves *within* a band, never out of it | Research → Plan |
| `task_attempt` ↔ `shift_log` | No FK; `shift_index` column instead | Keeps `appendShiftLog` best-effort and void, avoids an ordering dependency, and `shift_index` is the signal the analysis actually needs | Plan |
| Lost-update window | Left as-is, documented | Predates this change; closing it means rewriting the authoritative write path in SQL | Plan |
| `duration_ms` | Ships in P1 | Most informative signal after `firstTry`; deferring leaves a permanent gap in exactly the early data we need for tuning | Plan |
| Existing profiles' starting `d` | From `starting_level` only, history ignored | One deterministic rule; no child experiences a difficulty jump on ship day | Plan |
| Two-stage admission | Explicit `TWO_STAGE_THRESHOLD` with the invariant `ceilingForLevel(2) < threshold` | Today's `difficultyTier === 3` makes multi-step tasks structurally unreachable for young children; a continuous scale turns that into a crossable threshold | Plan review |
| `difficultyTier` | Removed; `Task` carries `difficulty: number` | Phase 3 removes its only producer, and it is a required field in `src/types.ts` | Plan review |
| `MAX_SHIFT_TASKS` | Explicit constant 17 + a reachability test | `SHIFT_LENGTH[3]` ceases to exist; if the ceiling ever falls below a generated shift, the child loses the entire shift-end write | Plan review |
| Phase-2 `difficulty` | Left null until Phase 3 | Two incomparable quantities in one column would poison the table whose whole purpose is tuning | Plan review |
| Task generation | Lazy on client from a server seed; task 1 server-rendered | Hydration mismatch only affects the first render; zero round-trips preserves S-12's offline behaviour | Design spec |
| Adaptation rule | `d += ADAPT_RATE * (observed − TARGET_SUCCESS)`, target ~0.8 | Self-stabilises at ~80% success and is asymmetric by construction — a miss costs 4× what a hit gains | Design spec |
| `misses` in the rule | Excluded; telemetry only | Weighting it would be a guess; P1 exists precisely to settle it on data | Design spec |

## Scope

**In scope:** `task_attempt` table with the full L-001 RLS contract; per-task
timing; the `attempts` array on the existing shift-end POST; continuous `d` per
competency with an age-derived ceiling; generators as functions of `d`; lazy
seeded client generation; in-shift adaptation; server-side `d` recompute.

**Out of scope:** new task types or competencies (P2); any LLM (P4); parent-facing
difficulty controls (parked non-goal); mid-shift persistence (FR-016); fixing the
pre-existing lost-update window; multi-denomination coins; changes to the earnings
or stars formulas.

## Architecture / Approach

`d ∈ [0,1]` per competency, stored in its own jsonb column and clamped to
`[0, ceilingForLevel(starting_level)]`. The server builds a shift **plan**
(fixed length, seed, starting `d`) and renders task 1; the client generates tasks
2…N lazily through the generators' existing injectable `pick` seam, now fed by a
mulberry32 PRNG. After each scored task the rule moves `d`, guarded by warm-up,
a post-miss cooldown, a per-shift drift clamp, and a closing task drawn one notch
easier. The single shift-end POST carries an `attempts` array; the server
recomputes and persists `d` from it rather than trusting the client.

Shift **length** is fixed at plan time — five `ShiftScreen` sites and the e2e
solve loop need the total from task 1.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. `task_attempt` + RLS | Telemetry table, isolation test, registry entry | A wrong policy is a silent data leak, not a crash |
| 2. Telemetry write path | Timing + `attempts` on the existing POST, recording today's tasks | Reconciliation rules must tighten without breaking the existing looser refines |
| 3. Continuous difficulty | `adaptive.ts`, `difficulty_state`, generators as functions of `d` | Calibration drift moves the e2e envelope and flips earnings/star assertions; the two-stage threshold must sit above the level-2 ceiling |
| 4. Lazy client generation | Generation moves client-side, `d` constant | Hydration mismatch returning; the positional competency join breaking |
| 5. Adaptation on | In-shift adaptation + server recompute | A child adapted past their pedagogical band |

**Prerequisites:** local Supabase running (`npx supabase start` + `db reset`),
`.env.test` filled. Baseline to preserve: 429 tests / 51 files, 23 e2e / 8 files.

**Estimated effort:** ~5 sessions, one per phase.

## Open Risks & Assumptions

- **P3's ceiling is low, by design.** S-08 already concluded that "bigger numbers
  alone make tasks longer, not harder". Adaptation on two task types will exhaust
  its useful range — accepted, so we hit that ceiling holding telemetry.
- **The age ceiling makes `starting_level` more load-bearing.** A child who
  genuinely outgrows their band cannot be promoted, since `starting_level` is
  frozen by an S-04 guardrail. Band promotion is a product decision, deferred.
- **Three non-atomic writes.** A failed telemetry insert leaves a shift without
  attempts — accepted, following `appendShiftLog`'s best-effort posture, because
  telemetry must never fail a child's shift.
- **Plan-review findings are folded in.** A deep review found that nothing in the
  original plan governed which *kind* of task a child may receive — only how big
  the numbers get — so a level-1 child on a streak could have crossed into the
  two-stage scenario, breaking the pedagogy, the unit tests (flakily) and every
  gameplay e2e. That is now an explicit invariant with its own test.
- **Every constant is a first guess.** `TARGET_SUCCESS`, `ADAPT_RATE`,
  `MAX_SHIFT_DRIFT`, `FINAL_TASK_RELIEF` and the interpolation curves all need
  kid-testing.

## Success Criteria (Summary)

- A child answering well sees larger numbers within the same shift; a child
  struggling sees smaller ones — and neither ever leaves the band their age
  justifies.
- Difficulty carries across shifts, and every shift still ends on a win.
- `task_attempt` holds one accurate row per task, readable only by its owning
  account, with enough detail to tune every constant in the model.
