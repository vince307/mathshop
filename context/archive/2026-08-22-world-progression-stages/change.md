---
change_id: world-progression-stages
title: Named shop growth stages with per-stage art, plus per-shift earnings in shift_log
status: archived
created: 2026-08-22
updated: 2026-08-24
archived_at: 2026-08-24T12:52:58Z
---

## Notes

give the shop named growth stages with per-stage art instead of a bare business_level number, and record per-shift earnings in shift_log so the child and the parent can both see what was earned

## Autonomous decisions

Run: `context/runs/2026-08-22-autonomous-five` (feature F4). No human in the loop,
so the skill's interactive next-step prompt was decided rather than asked.

- **Chose `/10x-research world-progression-stages` as the next step** over the skill's
  default `/10x-plan`. This change adds a **migration** (an earnings column on
  `shift_log`) and edits the shift-completion write path — `recordShiftResult` in
  `src/lib/services/child-profiles.ts`, which already computes `earned` via
  `earningsForShift` but throws it away instead of logging it. It also has to reconcile
  a stage catalogue with `businessLevelForShifts` in `src/data/shift.ts` and with the
  milestone path already rendered in `src/pages/app/start.astro`. A planner without
  that grounding would either duplicate the level formula or mis-handle RLS on the new
  column; both are expensive to unwind after the migration is written.
- **Rejected `/10x-frame`**: the framing is settled. The stages screen is specified by a
  binding mockup (`assets/matmaverse-missing-screens-v3-web/01-world-progression-web.png`)
  and the earnings column is a known, named gap deferred out of feature F1 — there is no
  symptom-vs-cause conflation to challenge.
- **Also decided (recorded here so research does not re-litigate it):** the two halves of
  this change — the stage catalogue/screen and the `shift_log` earnings column — stay in
  ONE change. The backlog entry (`web-shell-and-mockup-parity/handoff.md` §4 B4) pairs
  them deliberately: "ile zarobiłem w tym tygodniu" is what the stage screen and the
  parent report both want. A planner may sequence them into separate phases; it must not
  silently drop either.
- **What would change the answer:** if research shows the stage catalogue is a pure
  presentation layer over the existing `business_level` and the earnings column needs no
  backfill decision, the plan could collapse to a single small phase.

## Autonomous decisions (planning step, 2026-08-22)

- **The title's "with per-stage art" is now inaccurate — deliberately, and the title is left alone.**
  Planning established that per-stage world artwork exists for **zero** of the four worlds
  (`world-progression-cafe.png` is a single composite hero, not swappable stage images), so the plan
  ships stage *states* with lucide icons + design tokens and no per-stage illustration (plan §D-3).
  The change id is referenced by the run log, both sibling handoffs and the plan itself; renaming the
  identity mid-run costs more than the inaccuracy. Reverses when per-world stage art is produced —
  the plan records ART-A as the upgrade path.
