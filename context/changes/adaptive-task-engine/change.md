---
change_id: adaptive-task-engine
title: Adaptive task engine — per-task telemetry and continuous difficulty
status: plan_reviewed
created: 2026-08-25
updated: 2026-08-25
archived_at: null
---

## Notes

Covers **P1 (per-task telemetry) + P3 (continuous adaptive difficulty)** from a
four-part decomposition agreed during brainstorming. P2 (curriculum / new task
types) and P4 (offline LLM narrative generation) get their own change folders
later.

**Design spec is already written and committed** — treat it as the source of
truth for this change, not something to re-derive:

- `docs/superpowers/specs/2026-08-24-adaptive-task-engine-design.md` (commit `dab65f8`)

Decisions already settled in that spec (do not re-litigate in planning):

- Continuous difficulty scalar `d` per competency replaces the three hard tiers;
  `tierForLevel` survives only as the seed for a fresh profile.
- Adaptation rule: `d += ADAPT_RATE * (observed − TARGET_SUCCESS)`, target ~0.8.
  `misses` stays out of the rule on purpose — telemetry first, tune later.
- Lazy client-side task generation from a server-supplied seed. Task 1 stays
  server-rendered so `ShiftScreen`'s documented hydration constraint holds.
- No per-task POST — the single shift-end write invariant that S-12's offline
  handling depends on is preserved; `/api/shifts/complete` grows an `attempts`
  array instead.
- New `task_attempt` table shipping the full L-001 RLS contract in-migration.
- Difficulty is recomputed server-side from reported attempts, never trusted
  from the client.

Explicitly rejected: any LLM in the gameplay loop (latency, math correctness,
child-safety, RODO, testability). AI is confined to P4, offline.

Known accepted cost: P3 on the two existing task types has a low difficulty
ceiling. That is deliberate — we want to hit it with telemetry in hand rather
than design P2's taxonomy and the S-07 gate migration on instinct.
