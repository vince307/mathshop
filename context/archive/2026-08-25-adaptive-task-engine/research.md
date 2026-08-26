---
date: 2026-08-25T09:05:24Z
researcher: vince307
git_commit: dab65f837196a997cd6200627d26066ffa73c5f9
branch: matmaverse-v2
repository: mathshop
topic: "Adaptive task engine (P1 telemetry + P3 continuous difficulty) — codebase grounding for planning"
tags: [research, codebase, task-generation, shift, skills, rls, telemetry, e2e]
status: complete
last_updated: 2026-08-25
last_updated_by: vince307
---

# Research: Adaptive task engine — codebase grounding

**Date**: 2026-08-25T09:05:24Z
**Researcher**: vince307
**Git Commit**: `dab65f8`
**Branch**: `matmaverse-v2`
**Repository**: mathshop

## Research Question

The design spec `docs/superpowers/specs/2026-08-24-adaptive-task-engine-design.md`
(commit `dab65f8`) is approved. It settles *what* to build. This research grounds
*how*: exact call sites, the persistence contract, the RLS/test obligations, and
which prior decisions this change would disturb.

## Summary

The spec's core architectural bet is **confirmed and now has provenance**:
server-side shift generation is not a design decision, it is a bugfix from
2026-08-22 (commit `64f9f94`) that reacted to a hydration mismatch. S-04 shipped
tasks *client*-generated, and S-12 explicitly depended on that. Lazy client
generation is therefore a return to the original architecture, not a departure.

Four hard invariants must survive and all four are compatible with the spec:
single shift-end write (S-04/S-12), server-recomputed earnings (S-04),
`starting_level` frozen vs `business_level` mutable (S-04, "conflating them
corrupts difficulty derivation"), and monotonic `skill_state` (S-07).

**Seven findings correct or constrain the approved spec.** Three are material
enough to change the design; they are listed first and marked ⚠.

## ⚠ Corrections to the approved spec

### ⚠ C1 — `difficulty` cannot live inside `skill_state`

The spec (§1, §"Files affected") puts a per-competency `d` in
`child_profiles.skill_state` and defaults it inside `readSkillState`. This
silently loses data.

`readSkillState` (`src/data/skills.ts:56-68`) and `addSkillDelta`
(`src/data/skills.ts:76-88`) both **construct fresh objects** keyed only by
`COMPETENCIES`, with exactly `{firstTryCorrect, completed, misses}`. They do not
spread the input. A `difficulty` key written into the jsonb would be destroyed on
the next shift completion (`src/lib/services/child-profiles.ts:217`) or upgrade
purchase (`:301`) — the column would hold it, the next whole-object overwrite
would drop it, and nothing would error.

Two further reasons it does not belong there:

- `CompetencyProgress` is documented as monotonic (`src/types.ts:122`), and S-07
  made monotonicity a hard invariant — "spending never regresses skill progress".
  `d` decreases on a miss by design. Putting it in that type contradicts the
  type's own contract.
- `readSkillState(null)` is used as a **zeroed-delta accumulator**, not as state,
  at `src/components/child/ShiftScreen.tsx:86` and
  `src/lib/services/reports.ts:70`. Neither caller has a `starting_level` to pass
  to a defaulting parameter.

**Implication:** `d` needs its own column (or its own jsonb), and the S-07
monotonicity guardrail is preserved precisely *by* keeping it out of
`skill_state`. Note `src/pages/api/shifts/complete.ts:24-28` uses a plain
`z.object`, which **strips** unknown keys rather than rejecting — so a leaked `d`
would fail silently.

### ⚠ C2 — adaptation must be bounded above by the age band, not just clamped to [0,1]

The spec treats `d ∈ [0,1]` as a free scale with a floor at 0. But the tier-1/2
number bands are **pedagogically justified, not tunable**:

- "grade 1 → ~10; grade 2 → ~20. **Never exceed ~20 in v1**"
  (`context/archive/2026-06-29-counting-task-in-business-context/research.md:120`)
- "deliberate *pedagogical band* limits (grades 1–2, FR-007), not layout limits"
  (`context/archive/2026-07-02-upper-band-task-difficulty/research.md:121`)
- `SCATTER_MAX = 5` is subitizing, also pedagogical.

A 6-year-old on a hot streak must not be adapted up to counting 25 objects. The
engine therefore needs an **age-derived ceiling on `d`**, not only a floor —
adaptation moves *within* the child's band, it does not promote them out of it.
The spec as written has no such ceiling.

(Tier-3 values `{10,25}` / `CHANGE_CAP 15` / `PAID_MAX 30`, `STOCK_AND_CHANGE_RATE
0.3`, `SHIFT_LENGTH`, `SKILL_THRESHOLDS` and the upgrade gate values *are* all
documented first-guess and tunable. `TRAY_CAP = 20` is layout-hard.)

### ⚠ C3 — shift length must stay fixed at plan time

Five sites need the total from task 1, and the e2e helper needs it too:

- `src/components/child/ShiftScreen.tsx:184` — "Zadanie {current} z {total}" (`src/i18n/pl.ts:418`)
- `:186-195` — segmented bar renders one span per task, including future ones
- `:74` — shift-end detection is `results.length < tasks.length`
- `:87-92` — positional join `delta[competencyForTaskType(tasks[i].type)]`
- `:156-169` — `tasks[index] === undefined` is the "saving" signal
- `e2e/helpers/solve-shift.ts:51-58` parses the total out of the progress text and
  loops on it; `:60` uses the exact `"Zadanie N z M"` string as its **state wait**,
  because `e2e/CLAUDE.md:26-28` bans `page.waitForTimeout()`.

A mid-shift length change hangs both `e2e/gameplay-restore.spec.ts` tests
(`:44`, `:108`) in both Playwright projects — four executions.

**Implication (not a blocker, a refinement):** length is computed once at plan
time from the starting `d`; only per-task difficulty adapts within the shift.
Generated tasks must be retained in order for the positional competency join.

## Detailed Findings

### Task generation call graph

Every generator has **exactly one production call site**:

- `generateShift` — `src/pages/app/task.astro:36`, as
  `generateShift(profile.starting_level, shiftBonusTasks(purchased))`, result
  passed to the island at `:53`.
- `generateTask` — `src/data/shift.ts:80`.
- `generateCountingTask` / `generateChangeMakingTask` — both `src/data/tasks.ts:24`.
- `generateStockAndChangeTask` — `src/data/change-making-tasks.ts:65`.
- `shiftLength` — `src/data/shift.ts:71`.
- `tierForLevel` — four sites: `src/data/shift.ts:54`,
  `src/data/counting-tasks.ts:46`, `src/data/change-making-tasks.ts:63` and `:105`.

**C4 — the picker injection chain is broken at `src/data/tasks.ts:24`.** It calls
`generateCountingTask(startingLevel)` with no picker, so the default
`Math.random` picker applies. `generateShift` can inject `pickType` but has no way
to inject the numeric `pick` used inside the leaf generators. The spec's claim
that generator signatures need not change (§3) is therefore wrong: `generateTask`
must forward `pick` (and `pickTwoStage`).

**Six `Math.random()` sites, all in `src/data/`:** `shift.ts:41` (`defaultPick`,
also feeding the Fisher–Yates shuffle at `:77`), `shift.ts:69` (inline
`pickType`), `tasks.ts:16` (`defaultPickType` — dead in practice, since
`shift.ts:80` always passes an explicit type), `counting-tasks.ts:34`,
`change-making-tasks.ts:36`, `change-making-tasks.ts:41` (`defaultPickTwoStage`).

**There is no seeded RNG in the repo.** Determinism today comes exclusively from
dependency injection of picker functions. Existing injection seams:
`shift.ts:68,69`, `tasks.ts:23`, `counting-tasks.ts:44`,
`change-making-tasks.ts:60,61,103`.

**C5 — `duration_ms` is not free.** `TaskOutcome`
(`src/components/hooks/useCoinTask.ts:11-14`) carries only
`{firstTry, misses}`. Nothing in the repo measures per-task time. The spec's
`duration_ms` column requires adding timing to `useCoinTask`; note the fixed
1400 ms celebration beat at `:59` would be included unless excluded deliberately.
`misses` is per-mount cumulative (`:49`, incremented at `:76`, never reset);
`firstTry` is derived as `misses === 0` (`:58`). The two-stage task aggregates
both stages into one outcome (`src/components/child/ChangeMakingTask.tsx:30-42`).

**C6 — the hydration prohibition is documented in three places:**
`src/pages/app/task.astro:31-35`, `src/components/child/ShiftScreen.tsx:20-25`,
and `src/components/child/RecentActivity.astro:14` ("the /app/task hydration
lesson"). All three need updating.

Nothing else depends on the task array: no prefetch, no list animation, no
carousel. `key={index}` at `ShiftScreen.tsx:203,205` is the mechanism that resets
`useCoinTask` between tasks — it keys on array index, not task identity.

### Persistence and the write path

`recordShiftResult` (`src/lib/services/child-profiles.ts:193-197`) is **four
non-transactional round trips**: RLS-scoped read (`:201`), derive (`:206-209`),
one UPDATE of four columns (`:211-219`), then `appendShiftLog` (`:223`).

- `account_id` comes from the RLS-verified row (`:223`), never the caller — L-002.
- **C7 — `appendShiftLog` (`:162-173`) returns `void` and swallows its insert
  error.** The spec's `task_attempt.shift_log_id` FK requires changing it to
  `.insert(...).select("id").single()`, which changes that best-effort posture and
  creates an ordering dependency.
- **C8 — there is no multi-table atomicity anywhere in the repo.** Concurrent
  shift completions both read the same `completed_shift_count` and the second
  clobbers the first. The only atomicity precedent is `register_pin_failure`
  (`supabase/migrations/20260702120000_pin_failure_throttle_rpc.sql:16-31`), a
  `security invoker` SQL function created **because a JS read-modify-write lost
  increments under concurrency**. Batching attempt rows adds a third non-atomic
  write; recomputing `d` server-side adds another lost-update surface.

`shift_log` writers: `appendShiftLog` only, called from `recordShiftResult`
(`:223`) and `buyUpgrade` (`:307-312`); plus the test-side `seedShiftWeek`
(`e2e/helpers/accounts.ts:106-138`, admin client, the only writer that sets
`created_at`).

`reports.ts` is **unaffected** — both queries use explicit column projections
(`:184-200`, `:232-244`), never `select("*")`, so a new column or sibling table is
invisible. Both throw on error rather than rendering a false empty week.

**C9 — tests that go red on an added per-competency key** (`toEqual` is exact):
`tests/shifts-complete.test.ts:194,195,196,202,203`,
`tests/cross-device-restore.test.ts:119`,
`tests/upgrades-buy.test.ts:254,262,266`. Every UI consumer is safe — all iterate
the closed `COMPETENCIES` array and index named fields; no `Object.keys` over
skill state anywhere.

### RLS contract and test obligations

`docs/reference/rls-isolation.md:12-20` lists seven binding rules. The copyable
skeleton is `docs/reference/rls-template.sql`; the nearest shape precedent for
`task_attempt` (surrogate id + `profile_id` FK, append-only, no `updated_at`) is
`supabase/migrations/20260701150000_create_shift_log.sql:21-63`. `shift_log` is
also the precedent for **omitting `updated_at` while still defining the UPDATE
policy** — the four-policy contract is absolute.

Migration naming is `YYYYMMDDHHmmss_description.sql` with round `HH0000` slots;
newest on disk is `20260822120000`.

**The isolation test pattern** (`tests/shift-log-isolation.test.ts`): two accounts
via `createSignedInUser` (`tests/helpers/supabase.ts:44-60`), module-level `admin`
service-role client (`:33-35`) used *only* to provision and to confirm durable
state, five `it()`s mapping 1:1 to the policies. The INSERT-isolation assertion
(`:128-152`) avoids the L-002 false green by (a) chaining **no** `.select()`,
(b) supplying every other column with a legal value so only `with check` can
reject, and (c) verifying with two `admin` reads that no on-behalf row exists.

**C10 — `contract-surfaces.md` has no automated check.** Registration is human
discipline; the `4f8271b` commit body records why that matters: "Nothing in
`src/`, `tests/`, `e2e/` or CI reads this file, so an omission here fails silently
and permanently." Entry format: H2 `## public.<table>`, prose paragraph, then bold
bullets *Defined in / Owner column / Columns / Indexes / RLS* (four nested policy
sub-bullets quoting the clause verbatim) */ Consumed by / Isolation test*.

**Test runner:** Vitest 4, one `npm run test` for everything (no unit/integration
split), `fileParallelism: false`, 30 s timeouts, 22 suites require a live local
Supabase. CI runs `supabase start` + `db reset` + `npm run test` as the merge gate.

**C11 — there is no `fast-check` or any property-testing dependency.**
"Property-style" in this repo means a hand-rolled shared invariant helper called
inside a sweep loop — `assertInvariants` (`tests/change-making-tasks.test.ts:19-32`),
`assertStockAndChangeInvariants` (`:108-126`). The spec's "range invariant
(property-style)" test must follow that convention rather than add a dep.

Lint: `no-console: warn`, `tseslint.configs.strictTypeChecked` with
`projectService`, which is what forces the
`.overrideTypes<Row[], { merge: false }>()` idiom in DB tests.

### E2E — the tightest constraint

**C12 — `e2e/helpers/solve-shift.ts` bakes in the tier-1 generation envelope.**
It is a DOM-derivation solve loop (the generator is unseeded, so the answer is
read from what is rendered) that **throws on any third task shape** (`:41-45`) and
supports only level-1 profiles. Downstream assertions hardcode the envelope:

- `gameplay-restore.spec.ts:48` — "one dirty task in a 5–7 task shift → clean rate
  in [0.8, 0.86] → always 2 stars"
- `:52` — "the 30 zł Szyld is affordable after any shift (min 37 zł)"
- `:120-124` — "with sign owned and 40–56 zł earned, the next upgrade is the 60 zł shelf"
- `solve-shift.ts:75` independently recomputes `earned = 5 * taskCount + 3 * cleanCount`

**Implication:** a fresh level-1 profile's starting `d` must reproduce **exactly**
today's tier-1 band, or four e2e executions break (the `touch` project's
`testMatch` is `/(gameplay-restore|growth)\.spec\.ts/`).

**C13 — there are no `data-testid`s in `src/` at all.** E2E locates purely by
accessible name from the i18n dictionary, and `e2e/CLAUDE.md:7-9` treats needing
one as "a product finding to surface first" — not a free move.

## Code References

- `src/pages/app/task.astro:36` — the single production `generateShift` call
- `src/data/tasks.ts:24` — the broken link in the picker injection chain
- `src/data/skills.ts:56-68`, `:76-88` — fresh-object construction that would drop `difficulty`
- `src/types.ts:122` — `CompetencyProgress` documented monotonic
- `src/lib/services/child-profiles.ts:162-173` — `appendShiftLog`, void + swallowed error
- `src/lib/services/child-profiles.ts:193-197` — `recordShiftResult` signature
- `src/components/hooks/useCoinTask.ts:11-14` — `TaskOutcome`, no timing field
- `src/components/child/ShiftScreen.tsx:74`, `:87-92`, `:184`, `:186-195` — the four full-list dependencies
- `src/pages/api/shifts/complete.ts:24-57` — zod schema and the three reconciliation refines
- `supabase/migrations/20260701150000_create_shift_log.sql:21-63` — the RLS pattern to copy
- `supabase/migrations/20260702120000_pin_failure_throttle_rpc.sql:16-31` — the only atomicity precedent
- `tests/shift-log-isolation.test.ts:128-152` — the L-002-safe INSERT assertion
- `e2e/helpers/solve-shift.ts:41-45`, `:51-58`, `:75` — the e2e envelope

## Architecture Insights

**Server-side generation was never a design decision.** S-04 shipped tasks
client-generated (`context/archive/2026-06-29-full-shift-with-results/research.md:90`,
`plan.md:182`); S-12 depended on it ("tasks are generated client-side, so no
network calls happen during play" —
`context/archive/2026-06-14-network-loss-handling/plan.md:12`). Server generation
arrived on 2026-08-22 in commit `64f9f94`, *"fix(task): draw the shift on the
server so hydration matches"*, recorded under a struck-through **bug** entry in
`context/archive/2026-08-22-web-shell-and-mockup-parity/change.md:54-57`, not a
decisions table. The surviving prohibition lives only as code comments.

**What is genuinely hard, and survives:**

- Single shift-end write (S-04 `plan.md:56`, S-12 `plan.md:31`). S-12's research
  forbids persisting **mid-shift** — not batching per-task records into the
  existing shift-end write. The spec threads exactly that needle.
- Server-recomputed earnings; the client never sends an amount (S-04 `plan.md:53`).
- `starting_level` frozen vs `business_level` mutable — "conflating them corrupts
  difficulty derivation" (S-04 `plan.md:54`, re-asserted S-08 `plan.md:14`).
  Adding `d` as a *third* quantity respects this; overloading either column would not.
- Monotonic `skill_state` (S-07 `plan.md:44`). Preserved precisely by keeping `d`
  out of it — see C1.
- S-07 reconciliation refines (`plan.md:89`), which the spec's
  `attempts.length === taskCount` rules tighten rather than replace.

**The low-ceiling concern is confirmed by the archive's own reasoning.** S-08
concluded that *"bigger numbers alone make tasks longer, not harder"* — CoinBoard
is single-denomination, the tally is a count not a sum, and correctness is one
`===` (`context/archive/2026-07-02-upper-band-task-difficulty/research.md:30`,
restated `:122`). That is why S-08 added a two-stage *scenario* rather than a
third band of numbers. It is the same ceiling P3 will hit, and the strongest
available argument for P2.

## Historical Context (from prior changes)

- `context/archive/2026-07-02-upper-band-task-difficulty/research.md:68` —
  "**difficulty is set once at profile creation and never adapts in-play.** If the
  plan wants difficulty to rise as the child progresses, that mapping does not
  exist and would be net-new." This change is that net-new mapping.
- `context/archive/2026-07-01-skill-path-upgrade-gate/plan.md:32-33` — listed
  "**No per-task-attempt history rows**" and "no ratio/mastery-decay progress
  function" as explicit non-goals. P1 lifts the first; the second stays lifted only
  for `d`, not for `skill_state`.
- `context/archive/2026-06-14-network-loss-handling/research.md:107` — classifies
  per-task wrong-attempt counts as "**Ephemeral** — collapse into shift-end stars".
  P1 changes that classification deliberately.
- `context/archive/2026-06-14-network-loss-handling/research.md:172` — "the
  durable/ephemeral split is a load-bearing design choice… any future attempt to
  persist **mid-shift** progress would re-introduce the reconciliation and
  idempotency problems this design avoids."
- Parent-facing difficulty controls are a parked non-goal (`prd-v3.md:161`,
  `roadmap.md:284`, `backlog.md:117-119`). **Automatic adaptation is not parked** —
  FR-004/FR-006 already require adaptive-length shifts (`prd-v3.md:123`).
- `context/foundation/backlog.md:80-88` — **B2 `pricing-and-inventory`** is P2's
  collision point and "the largest entry in this backlog"; it explicitly names "a
  new task type in the generator and in scoring".
- `context/foundation/backlog.md:134-137` — the roadmap's "Backlog Handoff" table
  is **stale** (still marks archived slices ready for `/10x-plan`). Do not trust it.

## Related Research

- `docs/superpowers/specs/2026-08-24-adaptive-task-engine-design.md` — the approved design
- `context/archive/2026-07-02-upper-band-task-difficulty/research.md` — the tier system and its ceiling
- `context/archive/2026-07-01-skill-path-upgrade-gate/plan.md` — competency taxonomy and monotonicity
- `context/archive/2026-06-14-network-loss-handling/research.md` — the durable/ephemeral split

## Measured baseline

Re-measured 2026-08-24 on `matmaverse-v2`: `npm test` 429 passed / 51 files;
`npx playwright test --list` 23 tests / 8 files; lint clean; `npm run check`
0 errors, 0 warnings, 9 hints. Latest migration: `20260822120000_shift_log_add_earned.sql`.

## Open Questions

1. **Where does `d` live?** C1 rules out `skill_state`. A dedicated
   `child_profiles.difficulty_state jsonb` column is the obvious candidate (it
   needs no RLS work — policies are column-agnostic), but a planner should confirm
   against the alternative of two scalar columns.
2. **How is the age-derived ceiling (C2) expressed?** Per-competency ceiling
   derived from `starting_level`, or a single band the whole profile sits in?
3. **Is `shift_log_id` on `task_attempt` worth C7's cost?** Dropping the FK keeps
   `appendShiftLog` best-effort; keeping it means the attempts write depends on the
   log insert succeeding.
4. **Does the concurrency hazard (C8) need addressing now?** `recordShiftResult`
   already has a lost-update window that predates this change; server-side `d`
   recomputation widens it. The `register_pin_failure` RPC is the template if so.
5. **`duration_ms` (C5)** — ship it in P1 (requires touching `useCoinTask`), or
   defer the column and land it with P2?
