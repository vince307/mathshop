# Upper-Band Task Difficulty (6–9) — Plan Brief

> Full plan: `context/changes/upper-band-task-difficulty/plan.md`
> Research: `context/changes/upper-band-task-difficulty/research.md`

## What & Why

Roadmap **S-08 / FR-009**: give the 6–9 upper cohort appropriately harder tasks. Today ages 8 and 9 share the same difficulty (tier 2, numbers capped at 20), so a 9-year-old gets no harder work than an 8-year-old. This adds a **tier 3** for age 9 (bigger numbers, longer shifts) and an **occasional two-stage "stock then sell" give-change task** (count the price into the register, then give the change) — a genuinely multi-step challenge, not just larger numbers — all within the no-bare-equation, no-punishment rules.

## Starting Point

Difficulty is a small, pure system with one chokepoint: `tierForLevel(startingLevel): 1 | 2` funnels into four `Record<1|2>` range tables; `difficultyTier` is transient (never persisted). Age 9 already reaches the app (`age` CHECK is 6–9) but `deriveStartingLevel` collapses 8 and 9 into tier 2. The change island renders one board / one target and hardcodes `t.task.give_change`.

## Desired End State

A newly-created age-9 profile plays a shift with visibly larger numbers over a slightly longer shift than an age-8 profile, and **occasionally** hits a two-stage task — stage 1 counts the item's price into the register, stage 2 gives the customer their change — each stage with its own tap-coins board, retry, and scaffolding hint. Ages 6–8 are unchanged. The two-stage task counts as one shift task on the money competency.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Multi-step scope | Path B: numbers **+** two-stage change | Fully satisfies FR-009's "occasional multi-step"; bigger numbers alone are only longer, not harder | Plan (scope talk) |
| Difficulty model | Add **tier 3**: 6–7→1, 8→2, 9→3 | Cleanest way to give age 9 its own band; keeps 6–8 unchanged | Plan |
| Two-stage design | "Stock then sell": count price → give change | Two concrete steps in one shop story, reusing CoinBoard for both | Plan |
| Frequency | Tier 3 only, **occasional** (~0.3) | Targets the cohort that needs it; younger kids stay single-step | Plan |
| Stage failure | Per-stage retry + hint (mirror current) | Consistent with the shipped no-punishment model | Plan |
| Number band | Modest: count ≤~25, change ≤15, paid ≤30 | Harder than tier 2 but within coin-render comfort; two-stage carries the real jump | Plan |
| Multi-denomination coins | Rejected (later tranche) | S-03 deferred it; overshoots grades 1–2; needs a count→value rewrite | Research |
| Migration | None | `starting_level` accepts 3; `age` CHECK already 6–9; `difficultyTier` transient | Research |

## Scope

**In scope:** tier-3 range tables + `tierForLevel` + `deriveStartingLevel` re-band; a new `stock_and_change` `ChangeMakingScenario` (generator, task shape, per-stage correctness, island, i18n); occasional tier-3 emission; test updates; a one-line `CLAUDE.md` age-band fix.

**Out of scope:** multi-denomination coins; any new *task type*; formal grade-3 content; DB migration; in-play difficulty progression (`business_level` stays out of the generators); per-stage competency split; re-banding ages 6–8.

## Architecture / Approach

Bottom-up, shippable at every phase. Widen the difficulty model first (pure data + age mapping), then build the two-stage scenario's pure pieces *without* wiring it into the live shift, then land the island + i18n + scoring + the emission gate together. A two-stage task is still `type: "change_making"`; the island composes two `TaskScreen`/`useCoinTask` passes and aggregates them into one `TaskOutcome`, so `ShiftScreen`, the skills model, and the shift-complete reconciliation are untouched.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Tier-3 difficulty | Age 9 gets bigger numbers + longer shifts; tests re-pointed; CLAUDE.md fix | Missing one `Record<1\|2>` site or a pinned test assertion → type/test failure |
| 2. Two-stage pure pieces | Scenario type, task shape, standalone generator, invariants — not yet in play | Accidentally wiring emission into the mixer → an unrenderable task ships early |
| 3. Island + i18n + turn-on | Two-stage renders (per-stage retry/hint), scores as one task, tier-3 occasional emission | Stage aggregation wrong → a two-stage task mis-scores accuracy/misses |

**Prerequisites:** none (S-04 done; no migration). One in-code prerequisite: de-hardcode `ChangeMakingTask.tsx:22` (behavior-preserving), done in Phase 2.
**Estimated effort:** ~2–3 sessions across 3 phases (Phase 3 is the bulk — the new interaction).

## Open Risks & Assumptions

- **Number/frequency values are first-guess, tunable via kid-testing** (the roadmap's flagged unknown, owner: user). The plan ships sensible defaults (count ≤25, change ≤15, paid ≤30, ~0.3 two-stage frequency) that are trivially adjustable constants.
- **Two-stage per-stage coin counts** are deliberately kept smaller than the tier-3 single-stage ceiling so neither board overwhelms; if kid-testing wants bigger, that's a constant bump.
- Assumes the two-stage task should accrue wholly to the **money** competency (stage-1 counting does not separately feed math) — keeps the S-07 skills model untouched.

## Success Criteria (Summary)

- Age-9 profiles draw tier-3 numbers + longer shifts; ages 6–8 play exactly as before.
- A tier-3 shift occasionally produces a two-stage task that never appears for ages 6–8; each stage retries independently; the task is "clean" only if both stages were first-try, and it counts as one shift task on the money competency.
- `npm run check` / `lint` / `build` green and the full suite passes against a fresh DB — with no migration.
