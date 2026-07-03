---
date: 2026-07-02T21:47:59+02:00
researcher: vince307
git_commit: 7c2f630639efbc26ee1cd35fd541191adddb0968
branch: main
repository: 10xDevs
topic: "Widening procedural task difficulty to the 6–9 age band (S-08 / FR-009)"
tags: [research, codebase, task-generation, difficulty-tiers, change-making, age-band]
status: complete
last_updated: 2026-07-02
last_updated_by: vince307
---

# Research: Widening procedural task difficulty to the 6–9 age band (S-08 / FR-009)

**Date**: 2026-07-02T21:47:59+02:00
**Researcher**: vince307
**Git Commit**: 7c2f630639efbc26ee1cd35fd541191adddb0968
**Branch**: main
**Repository**: 10xDevs

## Research Question

Roadmap slice **S-08 (`upper-band-task-difficulty`)**: widen procedurally-generated task numbers to the 6–9 band — "larger numbers and occasional multi-step change-making" — within the no-bare-equation rule (FR-009). What is the current difficulty model, what is the blast radius of widening it, how large can concrete numbers go before the coin rendering breaks down, what does "multi-step change-making" concretely require, and what tests/persistence/product constraints bind the plan?

## Summary

- **The difficulty system has a single chokepoint.** Everything keys off `tierForLevel(startingLevel): 1 | 2` (`src/data/counting-tasks.ts:26`), a binary tier. Four `Record<1 | 2, …>` range tables (counting range, change cap, paid max, shift length) and a `difficultyTier: 1 | 2` field on both task types hang off it. `difficultyTier` is **transient** (never persisted) → **no data migration is needed for tier changes**.
- **The 6–9 age gate already exists; the difficulty split does not.** Age 9 is fully reachable — the wizard offers `[6,7,8,9]`, zod validates `min(6).max(9)`, and the DB has `check (age between 6 and 9)`. But `deriveStartingLevel` collapses ages **8 and 9 into the same tier 2** (`age >= 8 ? 2 : 1`). So widening "to the 6–9 band" is **not** widening the age gate — it's **giving the upper cohort its own harder difficulty**.
- **Bigger numbers alone make tasks *longer*, not *harder*.** CoinBoard is single-denomination (identical `coin.png`), the tally is a **count not a sum** (`useCoinTask.ts:52`), and correctness is one `===`. Raising the number ceiling just adds more coin taps. The genuine upper-band deepeners are (a) **occasional multi-step change-making** and (b) **the budgeting choose-upgrade decision**, which the PRD explicitly calls "the primary new math surface for the upper cohort" — and which already shipped in S-06/S-07.
- **No migration required; the change is code + tests + i18n.** The only DB touchpoints are already 6–9-ready. Optional defence-in-depth: add a `starting_level` CHECK (none exists today).
- **A real product tension to reconcile in the plan:** `CLAUDE.md` still says "ages 6–8 in v1" (pointing at the older `prd-v2.md`), but the post-pivot `prd-v3.md:50` **widens the served band to 6–9** and FR-009 (`prd-v3.md:103`) is `[modified]` accordingly. `prd-v3` + roadmap are the source of truth; `CLAUDE.md` is stale on this point.

## Detailed Findings

### 1. The difficulty-tier model & its blast radius

`tierForLevel` is the **sole** level→tier funnel; all three generators call it.

| Element | Location | Current value | Add a 3rd tier | Raise tier-2 ceiling |
|---|---|---|---|---|
| `CountingTask.difficultyTier` | `src/types.ts:36` | `1 \| 2` | widen to `1\|2\|3` | no change |
| `ChangeMakingTask.difficultyTier` | `src/types.ts:65` | `1 \| 2` | widen to `1\|2\|3` | no change |
| `COUNT_RANGE` | `src/data/counting-tasks.ts:13` | `{1:{3,10}, 2:{6,20}}` | add key `3` + widen type | edit `2.max` |
| `tierForLevel` | `src/data/counting-tasks.ts:26` | `>=2 ? 2 : 1` | widen return + add `>=3` branch | no change |
| `CHANGE_CAP` | `src/data/change-making-tasks.ts:15` | `{1:5, 2:10}` | add key `3` | edit `2` |
| `PAID_MAX` | `src/data/change-making-tasks.ts:18` | `{1:10, 2:20}` | add key `3` | edit `2` |
| `SHIFT_LENGTH` | `src/data/shift.ts:14` | `{1:{5,7}, 2:{8,10}}` | add key `3` | edit `2` |

- Adding a tier = **7 edits** (above) + `deriveStartingLevel` re-banding + 4 test files (§5). Raising tier-2 ceilings = value-only edits, no type change.
- **Not difficulty (leave alone):** the `0|1|2|3` at `shift.ts:84`, `ShiftScreen.tsx:28`, `ShiftResults.tsx:8` are **star ratings**.
- Blast radius is contained to `src/data/*` + `src/types.ts` + tests. **No SSR loader, service, migration, or `business_level` path is touched.**

### 2. Age → starting_level → tier data flow (end to end)

1. **Collected** — `src/components/child/CreateProfileWizard.tsx:21` `const AGES = [6, 7, 8, 9]` (9 offered), emitted as a hidden field (`:103`).
2. **Server-validated** — `src/pages/api/profiles/create.ts:21` `age: z.coerce.number().int().min(6).max(9)`.
3. **Derived** — `create.ts:57` `deriveStartingLevel(age)` → `src/data/leveling.ts:7-8` `age >= 8 ? 2 : 1`.
4. **Persisted** — `src/lib/services/child-profiles.ts:55` → `starting_level smallint not null default 1` (`supabase/migrations/20260628120000_child_profiles_add_identity.sql:25`).
5. **Read into generators** — `src/pages/app/task.astro:43` `startingLevel={profile.starting_level}` → `ShiftScreen.tsx:46` `generateShift(startingLevel, …)`.

`deriveStartingLevel` is defined once and re-exported via `child-profiles.ts:7`, imported by both `create.ts` (server) and `CreateProfileWizard.tsx` (wizard display chip) — **one edit propagates to server + client**.

### 3. Difficulty keys off FROZEN `starting_level`, never mutable `business_level` — confirmed

- Every generator input traces to `profile.starting_level` (frozen at creation). `business_level` is used **only** for upgrade-shop unlock gating (`upgrades.ts:147,162`, `UpgradeShop.tsx`, `start.astro`, `child-profiles.ts:139,199`) and never reaches `tierForLevel`/`generateTask`/`generateShift`.
- Documented as intentionally distinct (`child-profiles.ts:34-35`; S-04 archive `research.md:63,167`). **Conflating them "corrupts difficulty derivation"** — a hard guardrail for the plan.
- Consequence: **difficulty is set once at profile creation and never adapts in-play.** If the plan wants difficulty to *rise as the child progresses*, that mapping does not exist and would be net-new (out of scope for "extend the generators").

### 4. Concrete-rendering ceiling & multi-step change design

**CoinBoard** (`src/components/child/CoinBoard.tsx`) is the single shared grid for both task types:
- `rows_of_5` = `grid grid-cols-5` (fixed 5 columns); `scatter` = flex-wrap that also wraps at ~5. `SCATTER_MAX=5` flips between them.
- Each coin is a fixed `size-16` (64px) tap target; N grows the board **vertically only** — width never breaks.
- Renders `/illustrations/coin.png` — **single-denomination by construction**; no coin carries a value.

**Practical ceiling:** ~20 coins (4 rows) is comfortable; ~25–30 still renders but starts scrolling on mobile and becomes a tap-counting slog. **So the number band can rise modestly (≤~25–30) with zero rendering changes — but that only makes tasks longer, not harder.**

**Scenario → copy indirection** (scenario string literals double as i18n keys `t.task[scenario]`):
- Counting island already resolves generically (`CountingTask.tsx:20` `t.task[task.scenario]`). **Extensible.**
- **Asymmetry / prerequisite fix:** the change island **hardcodes** `t.task.give_change` (`ChangeMakingTask.tsx:22`), ignoring `task.scenario`. Any 2nd change scenario must first switch this to `t.task[task.scenario]`.

**What "multi-step change-making" can mean** (judged against the count-based, single-denomination model):
- **(a) Larger change → more taps** — SMALL (raise `CHANGE_CAP`/`PAID_MAX`/`TRAY_CAP`). Not conceptually harder, just longer.
- **(b) Multiple denominations (2/5-zł coins)** — LARGEST rewrite: per-coin value on CoinBoard, count→**value** tally in `useCoinTask.ts:52`, value-aware correctness, new coin assets. **S-03 explicitly deferred this** (`context/archive/2026-06-29-change-making-task-in-business-context/plan.md:42`) as overshooting grades 1–2.
- **(c) Two-stage give-change** (e.g. count price into the register, then give change) — MODERATE, **best fit for "occasional multi-step"**: reuses the single-denomination CoinBoard, so it avoids the value-tally rewrite. Lift is orchestration — a stage array on the task + per-stage advance in `TaskScreen`/`useCoinTask`, and per-stage correctness instead of one `isChangeCorrect`.

### 5. Tests that pin current behavior (must update)

- `tests/counting-tasks.test.ts` — `tierForLevel` boundary map incl. **`tierForLevel(5) === 2` clamp** (`:20`); tier-1/2 band sweeps; **the load-bearing `targetCount ≤ 20` ceiling** (`:53-55`); arrangement flip at `SCATTER_MAX`.
- `tests/change-making-tasks.test.ts` — `assertInvariants(task, tier: 1|2)` helper (`:11-24`) with **hardcoded `availableCount ≤ 20`** (`:22`); tier-2 ceiling `change===10, paid===20` (`:45-50`).
- `tests/shift.test.ts` — `SHIFT_LENGTH` bands (`:24-32`); **`every task in generateShift(2) is tier 2`** (`:58-62`); `MAX_SHIFT_TASKS` clamp.
- `tests/profiles-create.test.ts` (real Supabase route) — **age 7 → starting_level 1** (`:68`), **age 9 → starting_level 2** (`:99`); rejects `age:"99"` (`:104`). Re-banding age→level breaks `:99`.
- `tests/shifts-complete.test.ts` — persists `business_level`, not `starting_level`; only affected if `MAX_SHIFT_TASKS` grows via a new tier-3 `SHIFT_LENGTH`.
- **Determinism pattern (uniform):** last-arg injectable picker `(min,max)=>number` / `()=>TaskType`; default RNG only checked for "stays in band." Preserve this signature for any new tier-3 ranges / multi-step logic.

### 6. Persistence — no migration required

- `starting_level smallint not null default 1` has **no CHECK constraint** (grep-confirmed) → a value of `3` is already DB-permitted. Widening is **purely code-level**.
- `age` already has `check (age between 6 and 9)` and the zod mirror is `min(6).max(9)` — the full band is already storable/valid.
- **Optional** work only: (a) add a `starting_level` CHECK for defence-in-depth, or (b) a new per-task difficulty field (not needed — tier is transient). Neither is required.

## Code References

- `src/data/counting-tasks.ts:13,19,26,44-54` — `COUNT_RANGE`, `SCATTER_MAX`, `tierForLevel` (the chokepoint), generation + clamp.
- `src/data/change-making-tasks.ts:15,18,24,42-63` — `CHANGE_CAP`, `PAID_MAX`, `TRAY_CAP`, single-denomination generation.
- `src/data/shift.ts:14,25,49,60-76` — `SHIFT_LENGTH`, `MAX_SHIFT_TASKS`, `shiftLength`, `generateShift`.
- `src/data/leveling.ts:7-8` — `deriveStartingLevel` age→level (the age-band mapping to widen).
- `src/types.ts:36,65` — `difficultyTier: 1 | 2` unions.
- `src/components/child/CoinBoard.tsx:20-51` — the shared coin grid (grid-cols-5, fixed 64px taps).
- `src/components/child/ChangeMakingTask.tsx:22` — **hardcoded `t.task.give_change`** (de-hardcode before a 2nd change scenario).
- `src/components/hooks/useCoinTask.ts:52` — count-based tally (`filter(Boolean).length`, not a value sum).
- `src/components/child/CreateProfileWizard.tsx:21` — `AGES = [6,7,8,9]`.
- `src/pages/api/profiles/create.ts:21,57` — age zod `min(6).max(9)` + `deriveStartingLevel`.
- `supabase/migrations/20260628120000_child_profiles_add_identity.sql:24-29` — `age`/`starting_level` columns + `age between 6 and 9` CHECK.
- `src/i18n/pl.ts:180-199` — `t.task.count_till` / `t.task.give_change` scenario copy blocks.

## Architecture Insights

- **Single chokepoint + transient tier = small, contained blast radius.** The generators are the only place difficulty lives; nothing downstream (DB, services, SSR) encodes it. This is why the roadmap rates S-08 "low risk; extends existing generators."
- **The renderer is not the limiter — the generator constants are.** `grid-cols-5` already scales vertically to arbitrary N; the `≤20` ceilings are deliberate *pedagogical band* limits (grades 1–2, FR-007), not layout limits.
- **"Harder" ≠ "bigger" under the concrete-coins constraint.** Because the coin model is count-based and single-denomination, larger numbers only lengthen tasks. Genuine upper-band challenge comes from a *new interaction* (two-stage change) or from the *budgeting decision surface* (already shipped), not from raising a max.
- **Frozen-vs-mutable separation is load-bearing.** `starting_level` (difficulty) and `business_level` (progression) are deliberately orthogonal; the plan must widen the former and never touch the latter.

## Historical Context (from prior changes)

- **The ≤20 cap is a deliberate v1 decision, not incidental** — S-02 research (`context/archive/2026-06-29-counting-task-in-business-context/research.md:119-120`, `plan.md:93`): "grade 1 → ~10; grade 2 → ~20; never exceed ~20 in v1… grades 1–2 / ages 6–8 only."
- **S-03 explicitly deferred multi-denomination change** — `context/archive/2026-06-29-change-making-task-in-business-context/plan.md:42`: "No multi-denomination coins — 1-zł coins only in v1; composing 2/5-zł change is deferred (overshoots grades 1–2)." **S-08 is where FR-009's "occasional multi-step change-making" deferral is picked up.**
- **S-04 kept difficulty (`starting_level`) orthogonal to progression (`business_level`)** — `context/archive/2026-06-29-full-shift-with-results/research.md:63,167`. (Note: "S-08" in that archive refers to the *old* roadmap slot; the roadmap was renumbered — current S-08 is this change.)
- **PRD widening & scope guard** — `context/foundation/prd-v3.md:50`: re-baseline widens 6–8 → 6–9, "the extra cohort is reached through harder change-making and the new budgeting decisions rather than a new task type (full grade-3 formal content is a later tranche)." FR-009 (`prd-v3.md:103`, `[modified]`) + roadmap S-08 (`roadmap.md:176-187`) confirm: larger numbers + occasional multi-step change-making, **no new task type, no formal grade-3 content**.

## Related Research

- `context/archive/2026-06-29-counting-task-in-business-context/research.md` — original counting-band rationale.
- `context/archive/2026-06-29-change-making-task-in-business-context/{plan-brief,plan}.md` — the deferred multi-denomination decision.
- `context/archive/2026-06-29-full-shift-with-results/research.md` — starting_level vs business_level separation.

## Open Questions

These are **design decisions for planning** (and the roadmap's flagged "number-range curve" unknown, owner: user via kid-testing):

1. **Difficulty-model shape** — add a **3rd tier** (give age 9, or 8–9, a distinct harder band) vs. **raise tier-2 ceilings** in place? Adding a tier is the cleaner expression of "a harder upper cohort" but touches types + 4 test files; raising ceilings is minimal but collapses 8 and 9 and fights the "≤20" invariant. Recommendation leans **add a 3rd tier + re-band `deriveStartingLevel` (age 9 → 3)**, but see Q3.
2. **Number-range curve** — concrete min/max per tier for counting (`COUNT_RANGE`), change (`CHANGE_CAP`/`PAID_MAX`), and shift length. Bounded above by the ~25–30-coin rendering comfort ceiling. *Owner flagged as user/kid-testing — the plan should propose first-guess numbers and mark them tunable.*
3. **Is multi-step change-making in this slice, or deferred?** It is the heaviest piece and the only part that makes tasks *conceptually* harder. Options: (c) two-stage give-change (moderate, reuses CoinBoard — recommended if in scope), (b) multi-denomination (largest, arguably a later tranche), or **defer multi-step entirely** and let the already-shipped **budgeting choose-upgrade decision** be the upper-cohort math surface (which is what `prd-v3.md:50` says is "primary"). This is the biggest scope fork for the plan.
4. **Band granularity** — three tiers (6–7 / 8 / 9) or keep two but re-drawn (6–7 / 8–9)? Determines whether age 8 and 9 differ.
5. **Prerequisite cleanup** — de-hardcode `ChangeMakingTask.tsx:22` (`t.task.give_change` → `t.task[task.scenario]`) is required before any 2nd change scenario; worth doing regardless.
6. **Optional persistence hardening** — add a `starting_level` CHECK constraint (absent today) so a widened range is enforced at the DB, not just in code? Not required, defence-in-depth only.
7. **`CLAUDE.md` staleness** — it still says "ages 6–8 in v1" and points at `prd-v2.md`; `prd-v3.md` supersedes. Worth a one-line correction as part of this slice.
