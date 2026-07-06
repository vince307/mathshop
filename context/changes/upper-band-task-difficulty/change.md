---
change_id: upper-band-task-difficulty
title: Upper band task difficulty
status: impl_reviewed
created: 2026-07-02
updated: 2026-07-06
archived_at: null
---

## Notes

### Scope decision (2026-07-02): Path B — numbers + two-stage change-making

S-08 widens task difficulty for the 6–9 upper cohort via **both** levers, not just numbers:

1. **Number-band widening** — give the upper cohort its own harder difficulty (age 9 is
   currently collapsed with age 8 into tier 2, capped at 20). Difficulty-shape sub-decision
   (add a 3rd tier vs. re-band the existing two) is left to `/10x-plan`.
2. **Occasional two-stage give-change scenario** — a new `ChangeMakingScenario` that reuses
   the single-denomination CoinBoard (NOT multi-denomination — that's `prd-v3` "later tranche",
   deferred). Delivers a genuinely harder interaction, satisfying FR-009's "occasional
   multi-step change-making" clause.

Rejected: **A** (numbers only — drops FR-009's multi-step clause) and **C** (multi-denomination
2/5-zł coins — S-03 explicitly deferred; overshoots grades 1–2; a later tranche).

**Consequences / guardrails for the plan:**
- This makes S-08 a **medium** slice, not the roadmap's "low risk" rating — the two-stage
  scenario is a new interaction (island stage orchestration + per-stage correctness), not just
  a generator constant bump. Re-scope expectations accordingly.
- Difficulty must widen the **frozen `starting_level`/tier** path, NEVER mutable `business_level`
  (conflating them corrupts difficulty derivation — S-04 guardrail).
- **No migration needed** (`starting_level` is an unconstrained `smallint`; `age` CHECK already 6–9).
- Prerequisite cleanup: de-hardcode `ChangeMakingTask.tsx:22` (`t.task.give_change` →
  `t.task[task.scenario]`) before adding the 2nd change scenario.
- New scenario copy goes in `src/i18n/pl.ts` (L-003), never inline.
- `CLAUDE.md` still says "ages 6–8 in v1" — stale; `prd-v3.md` supersedes with 6–9. One-line fix.

Open for `/10x-plan`: difficulty-shape (3rd tier vs re-band), the exact two-stage design (what
the two stages are + "occasional" frequency), and the number-range curve (roadmap unknown,
owner: user/kid-testing — propose first-guess, mark tunable).
