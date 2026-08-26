---
change_id: adaptive-task-engine
title: Adaptive task engine — per-task telemetry and continuous difficulty
status: implemented
created: 2026-08-25
updated: 2026-08-26
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

## Correction — the baseline figures in plan.md are stale

`plan.md` cites **429 tests / 51 files** (Phase 1 Success Criteria) and
**23 e2e / 8 files** (plan-brief Prerequisites). Both were inherited from
`context/archive/2026-08-24-autonomous-run-follow-ups/change.md:138` and were
already out of date when the plan was written.

Measured on `matmaverse-v2` at P1/P2 implementation time:

| | Before this change | After P1 | After P2 | After P4 |
| --- | --- | --- | --- | --- |
| `npm run test` | 443 / 53 files | 448 / 54 | 454 / 54 | **506 / 57** |
| `npx playwright test` | 26 / 8 files | 26 / 8 | 26 / 8 | **26 / 8** |

P1 added exactly one test file (5 isolation assertions); P2 added 6 tests to
existing files and no e2e. P4 added two files — `tests/shift-source.test.ts` (12)
and `tests/shift-screen.test.tsx` (5) — and no e2e, so P3 alone left the suite at
489 / 55. Phase 5 should compare against **506 / 57** and **26 / 8**, not the
numbers written in the plan. The plan's phase blocks are left untouched
deliberately — implementation treats them as read-only.
