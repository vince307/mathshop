-- =============================================================================
-- Migration: add skill_state to child_profiles  (S-07)
-- =============================================================================
-- Extends the Foundation F-01 owned table
-- (20260609120000_child_profiles_isolation.sql) with per-competency skill
-- progress. RLS is already ENABLED with four account-scoped per-operation
-- policies that cover ALL columns (auth.uid() = account_id), so NO policy change
-- is needed here (column-agnostic — L-001), and the shared set_updated_at()
-- trigger is REUSED (do NOT redefine it). Pre-launch: no production rows, so the
-- NOT NULL column is added directly with a safe default (no backfill).
--
-- `skill_state` holds `{ math|money|decisions: { firstTryCorrect, completed,
-- misses } }` — monotonic counters written server-side (recordShiftResult folds
-- the shift's math/money delta; buyUpgrade increments decisions). Existing rows
-- default to `{}` and are normalized in code (`readSkillState`, src/data/skills.ts,
-- fills a fully-zeroed shape for missing keys), so this is non-destructive.
-- Rollback: drop the column.
-- =============================================================================

alter table public.child_profiles
  add column skill_state jsonb not null default '{}'::jsonb;

comment on column public.child_profiles.skill_state is
  'Per-competency skill progress (S-07): { math|money|decisions: { firstTryCorrect, completed, misses } }. Monotonic, written server-side; pre-S-07 rows may be {}, normalized by readSkillState (src/data/skills.ts).';
