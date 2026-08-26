---
project: "MathShop — P2 curriculum (skill taxonomy + new task types)"
context_type: brownfield
scope: tranche          # a tranche INSIDE prd-v3, not a successor to it
supersedes: null
governing_prd: context/foundation/prd-v3.md
created: 2026-08-26
updated: 2026-08-26
checkpoint:
  current_phase: 1
  phases_completed: []
  gray_areas_resolved:
    - topic: "artifact destination"
      decision: "Tranche notes at this scoped path; shape-notes.md and prd-v3.md stay untouched as the governing product shape. Output is a P2 design spec (sibling of the P1+P3 spec), then /10x-new -> /10x-plan. Not a prd-v4."
    - topic: "sequencing vs telemetry"
      decision: "PARKED 2026-08-26 by the maintainer, at Phase 1. P2 waits for real telemetry. The Socrates challenge raised in Phase 1 - that the low-ceiling argument is arithmetic on constants, never observed on a child - was accepted as blocking. Investigating what 'collect data first' required then surfaced the real blocker: production runs `main`, and the telemetry code is on an unpushed branch. See '## Why this is parked' below."
    - topic: "scope boundary vs backlog B3"
      decision: "P2 and B3 (skill-path-screen) are shaped TOGETHER: they are blocked on the same missing artefact - a catalogue of modules. P2 defines the catalogue, B3 renders it. Implementation may still be split into two changes."
  frs_drafted: 0
  quality_check_status: parked
product_type: web-app
target_scale:
  users: large
  qps: low
  data_volume: medium
timeline_budget:
  delivery_weeks: null
  hard_deadline: null
  after_hours_only: true
---

# P2 — Curriculum (skill taxonomy + new task types) — Shape Notes

> Tranche shaping for **P2**, the deferred third part of the adaptive task engine
> decomposition. The P1+P3 spec is
> `docs/superpowers/specs/2026-08-24-adaptive-task-engine-design.md`; P1, P3, P4
> and P5 shipped and are archived under `context/archive/2026-08-25-adaptive-task-engine/`
> and `context/archive/2026-08-26-adaptive-seed-vs-ceiling/`.
>
> Shaped together with backlog entry **B3 `skill-path-screen`** — see the scope
> decision in the checkpoint above.

## Current System

**[V] Verified on `matmaverse-v2`, 2026-08-26.** Every claim below was read out of
the working tree, not inherited. Nothing here is `[I]`.

### What exists

- **Product:** MathShop — Polish-language web app teaching math to children (6–9)
  by framing every operation as running a small shop. Astro 6 SSR + React 19
  islands + Tailwind 4 + shadcn/ui, Supabase (Postgres + auth + RLS), Vercel `fra1`.
- **Users today:** a parent (account holder, PIN-gated surfaces) and their child
  profiles (up to several per account, per-account isolated by RLS).

### The taxonomy, as it stands

| Concept | Value today | Source |
| --- | --- | --- |
| Competencies | `["math", "money", "decisions"]` — a **closed set** | `src/data/skills.ts:16` |
| Earned from tasks | `math`, `money` only (`PlayCompetency`) | `src/data/skills.ts` |
| `decisions` | accrues at **purchase**, never from a task | `src/lib/services/child-profiles.ts` |
| Task types | `"counting"` \| `"change_making"` — **two** | `src/data/tasks.ts` |
| Task → competency | `competencyForTaskType` — total over `TaskType`, compiler-checked | `src/data/skills.ts:26` |
| Level ladder | `SKILL_THRESHOLDS = [3, 8, 15, 25, 40]` first-try counts | `src/data/skills.ts:36` |
| Difficulty scale | `d ∈ [0,1]` per competency, `ADAPTIVE_COMPETENCIES = ["math","money"]` | `src/data/adaptive.ts:34` |
| Seeds / ceilings | `LEVEL_SEED = {1:0, 2:0.2, 3:0.6}`, `ceilingForLevel = {1:0.5, 2:0.5, 3:1.0}` | `src/data/adaptive.ts` |
| Upgrade gates | `requiredSkill{competency, level}`, `requiredTaskHistory{competency, count}` | `src/data/upgrades.ts:35,40` |
| Telemetry | `task_attempt` table + `shift_log`; both currently **0 rows** | `src/data/attempts.ts` |

### The two structural facts P2 must confront

1. **`COMPETENCIES` is a closed set that is persisted.** `readSkillState` normalizes
   `child_profiles.skill_state` (jsonb) into exactly these three keys. Widening the
   set is a data change, not a constant change.
2. **The S-07 upgrade gates are expressed in terms of that set.** Two upgrades are
   gated today (a register on `money` level 1; more customers on 8 completed `math`
   tasks). Re-partitioning `math`/`money` into finer competencies **moves those gates
   under existing profiles** — a child mid-progression could find a bought-adjacent
   upgrade re-locked. The P1+P3 spec flags exactly this in its `## Follow-on` and
   calls it out so it is "not discovered late". It needs a migration **and** a
   mapping decision.

### Must preserve — pinned by tests, not by convention

- `d = 0.5` reproduces old tier 2 exactly, and `d = 1.0` old tier 3
  (`TIER_ANCHOR` is the calibration of `acrossTiers`). 548 tests currently green.
- **FR-007**: grades 1–2 never count above 20. `ceilingForLevel(1|2) = 0.5` *is*
  that boundary — `countRangeFor(0.5).max === 20` — not a tunable.
- `ceilingForLevel(2) < TWO_STAGE_THRESHOLD`, asserted in `tests/adaptive.test.ts`.
- The tier-1 e2e earnings/star envelope: `e2e/helpers/accounts.ts` seeds age 6–7 →
  level 1, and `LEVEL_SEED[1] = 0` is pinned by its own test.
- Monotonicity of `skill_state`: no counter may ever decrease (PRD guardrail).

## Why this is parked

**Parked at Phase 1 on 2026-08-26, deliberately.** The decision — *"collect data
first, P2 after telemetry"* — was the maintainer's answer to the Socrates challenge
opened in Phase 1: every claim that the difficulty ceiling is too low is arithmetic
over constants (23 counting bands, 31 amount pairs, ceiling = count to 25 / spend
≤ 15), and none of it has been observed on a child. `task_attempt` and `shift_log`
hold **0 rows**. Designing a competency taxonomy and a gate migration on that basis
is exactly what the P1+P3 spec argued against in its `## Ordering rationale`.

### What "collect data first" turned out to require — the blocking finding

**[V] 2026-08-26.** Investigating why the telemetry was empty produced a bigger
answer than expected. It is not a bug in the write path. It is that **none of the
code that writes telemetry is in production.**

- `matmaverse-v2` is **103 commits ahead of `main`** and has **never been pushed**
  — there is no `origin/matmaverse-v2`.
- Production deploys from `main`.
- `npx supabase migration list --linked` against the hosted project (`mathshop`,
  `hozkukbsfdcrbszgdxbg`, `aws-1-eu-central-1`) shows the remote schema stops at
  `20260702120000`. `main`'s migration directory also stops at `20260702120000`.
  The two match exactly — which is what makes "production tracks `main`" a verified
  fact here rather than an inference.
- Three migrations are therefore absent from production:
  `20260822120000_shift_log_add_earned`, `20260825120000_create_task_attempt`,
  `20260825130000_child_profiles_add_difficulty_state`.

**Nothing in production is broken.** Old code against old schema is self-consistent:
`main` never writes `earned`, never inserts a `task_attempt`, never reads
`difficulty_state`. The mismatch is entirely between prod and this branch.

### The trap that would have hidden it

Both telemetry writers are **best-effort and swallow their error by design**:

- `appendShiftLog` — "its error is swallowed" (`src/lib/services/child-profiles.ts:155`)
- `appendTaskAttempts` — `await client.from("task_attempt").insert(...)`, return
  value never inspected (`src/lib/services/child-profiles.ts:198`)

That posture is correct for its stated purpose (losing telemetry must never fail a
child's shift). But it means that **if this branch had been deployed without its
migrations, every telemetry write would have failed in total silence** — and the
"wait a few weeks and collect data" plan would have produced zero rows with zero
signal. Applying the migrations *before* the deploy is not a nicety here; it is the
difference between collecting data and believing you are collecting data.

### Structural gap worth fixing separately

`.github/workflows/ci.yml` applies migrations only to a **fresh local database**
for the test gate (`npx supabase db reset`, lines 47–48 and 89–90). **No workflow
step pushes migrations to the hosted project.** Production schema changes are
therefore a manual `supabase db push` that nothing verifies and nothing reminds
anyone about — the same gap that produced this three-migration drift will produce
the next one.

### Resume condition

Resume this shaping when `task_attempt` holds enough real rows to answer, on
evidence rather than arithmetic: where the ceiling actually binds, which scenarios
children stall on, and whether `math`/`money` is the right partition at all. The
`## Current System` section above stays valid until then — it is all `[V]`.

## Vision & Problem Statement

> _Not captured — Phase 1 parked before this section. Deliberately empty rather
> than invented._

## User & Persona

> _Not captured — Phase 1 parked before this section. Deliberately empty rather
> than invented._
