-- =============================================================================
-- Migration: add difficulty_state to child_profiles  (adaptive-task-engine P3)
-- =============================================================================
-- Extends the Foundation F-01 owned table
-- (20260609120000_child_profiles_isolation.sql) with the continuous per-competency
-- difficulty scalar `d`. RLS is already ENABLED with four account-scoped
-- per-operation policies that cover ALL columns (auth.uid() = account_id), so NO
-- policy change is needed here (column-agnostic — L-001), and the shared
-- set_updated_at() trigger is REUSED (do NOT redefine it).
--
-- `difficulty_state` holds `{ math|money: number }` with each value on the `[0,1]`
-- scale defined by src/data/adaptive.ts, where 0 / 0.5 / 1 reproduce today's
-- tier-1 / tier-2 / tier-3 generator parameters exactly. Written server-side and
-- recomputed from the reported attempts, never trusted from the client.
--
-- Deliberately NOT inside `skill_state`. That column is documented MONOTONIC and
-- gates upgrades (S-07); `d` is not monotonic, and `readSkillState`
-- (src/data/skills.ts) reconstructs every row from a fixed three-field shape, so a
-- `difficulty` key placed there would be silently dropped on the next write.
--
-- NO DATA MIGRATION and no backfill: existing rows default to `{}` and normalise
-- on read via `readDifficultyState` (src/data/adaptive.ts) to their
-- `starting_level`-derived seed. History in `skill_state` is deliberately IGNORED,
-- so no existing child experiences a difficulty jump on the day this ships; the
-- engine re-converges within two or three shifts.
--
-- Rollback: alter table public.child_profiles drop column difficulty_state.
-- =============================================================================

alter table public.child_profiles
  add column difficulty_state jsonb not null default '{}'::jsonb;

comment on column public.child_profiles.difficulty_state is
  'Continuous per-competency difficulty (adaptive-task-engine P3): { math|money: number } on the [0,1] scale (0/0.5/1 = the legacy tier 1/2/3 parameters). Not monotonic — deliberately outside skill_state. Written server-side; pre-P3 rows may be {}, normalized by readDifficultyState (src/data/adaptive.ts) to the starting_level-derived seed.';
