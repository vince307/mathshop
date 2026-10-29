-- =============================================================================
-- Migration: add earned to shift_log  (F4 — world-progression-stages)
-- =============================================================================
-- Records what a single shift actually paid. `recordShiftResult` already computes
-- the payout server-side via `earningsForShift` (5*taskCount + 3*cleanCount) and
-- throws it away, because `appendShiftLog` only ever wrote four columns. Persisting
-- it is what turns "ile zarobiłem w tym tygodniu" into a real number instead of a
-- reconstruction.
--
-- RLS: NO POLICY CHANGE IS NEEDED HERE, and that is a verified verdict rather than
-- an omission (L-001). The four policies created in
-- 20260701150000_create_shift_log.sql — `shift_log_select_own`,
-- `shift_log_insert_own`, `shift_log_update_own`, `shift_log_delete_own`, all
-- `to authenticated` — are predicated solely on `auth.uid() = account_id`. None of
-- them names a column list or references a column, so they are column-agnostic and
-- already cover `earned` on all four operations. Postgres RLS is row-level; the only
-- column-granular control is `GRANT (column)`, and this project has no column-level
-- grant in any migration (the sole `grant` is `grant execute on function
-- public.register_pin_failure(...)`), so `earned` inherits the table-level
-- privileges like every other column. Same reasoning, same wording, as the two
-- precedents: 20260630120000_child_profiles_add_gameplay_state.sql and
-- 20260701140000_child_profiles_add_skill_state.sql.
--
-- NULLABLE, WITH NO BACKFILL — deliberately, and this is the load-bearing choice:
--   * A pre-migration row's payout is genuinely unknown. It cannot be reconstructed
--     from `shift_log.skills`: src/pages/api/shifts/complete.ts validates the skill
--     delta with `<=`, not `=`, so `5*completed + 3*firstTryCorrect` is only a LOWER
--     BOUND on what was paid; and EARN_PER_TASK/EARN_PER_CLEAN are tunable, so a
--     backfill would freeze today's constants onto rows written under others.
--   * `null` is also the permanent, correct value for a PURCHASE row (`buyUpgrade`
--     never passes `earned`). It is what keeps "not a shift" distinguishable from
--     "earned nothing" — a recorded 0 would be indistinguishable from a real
--     zero-earning shift, i.e. fabricated data.
--   Consequence for readers: `sum(earned)` is a lower bound on what was earned,
--   permanently, and any parent-facing copy must be worded accordingly.
--
-- No index: `earned` is projected and aggregated, never a predicate, and the weekly
-- query already rides `shift_log_profile_created_idx`.
-- Rollback: alter table public.shift_log drop column earned;
-- =============================================================================

alter table public.shift_log
  add column earned integer null;

-- Non-negative guard at the DB (defence in depth alongside zod), NAMED so a later
-- migration or rollback can reference it — matching the `child_profiles_*_nonneg`
-- precedent. `null` stays legal: it means "unknown / not a shift", not "zero".
alter table public.shift_log
  add constraint shift_log_earned_nonneg check (earned is null or earned >= 0);

comment on column public.shift_log.earned is
  'Server-computed wallet payout for this shift, in zl (F4). NULL means unknown: a purchase event (never a shift payout) or a pre-migration row (no backfill — reconstruction from `skills` yields only a lower bound). sum(earned) is therefore a lower bound on earnings, since appendShiftLog is best-effort.';
