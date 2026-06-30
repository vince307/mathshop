-- =============================================================================
-- Migration: add gameplay-state fields to child_profiles  (S-04)
-- =============================================================================
-- Extends the Foundation F-01 owned table
-- (20260609120000_child_profiles_isolation.sql) with the first persisted
-- gameplay state. RLS is already ENABLED with four account-scoped per-operation
-- policies that cover ALL columns (auth.uid() = account_id), so NO policy
-- changes are needed here, and the shared set_updated_at() trigger is REUSED
-- (do NOT redefine it). Pre-launch: no production rows, so the NOT NULL columns
-- are added directly with safe defaults (no backfill).
--
-- `business_level` is DISTINCT from `starting_level`: starting_level is the
-- frozen creation-time difficulty band (age 6–7 → 1, 8–9 → 2) that governs task
-- generation; business_level is the live, mutable progression counter (starts at
-- 1, advances as the child completes shifts). Conflating them would corrupt the
-- difficulty derivation. `shop_state` is reserved for S-05 shop customization.
-- =============================================================================

alter table public.child_profiles
  add column coins                 integer  not null default 0,
  add column completed_shift_count integer  not null default 0,
  add column business_level        smallint not null default 1,
  add column shop_state            jsonb    not null default '{}'::jsonb;

-- Non-negative / minimum guards at the DB (defence in depth alongside zod).
alter table public.child_profiles
  add constraint child_profiles_coins_nonneg                 check (coins >= 0),
  add constraint child_profiles_completed_shift_count_nonneg check (completed_shift_count >= 0),
  add constraint child_profiles_business_level_min           check (business_level >= 1);

comment on column public.child_profiles.coins is
  'Persisted coin balance earned across shifts (S-04). Non-negative; paid once at shift end.';
comment on column public.child_profiles.completed_shift_count is
  'Count of completed shifts (S-04). Non-negative; drives business_level.';
comment on column public.child_profiles.business_level is
  'Live business progression level, starts at 1 (S-04). Distinct from starting_level (the frozen difficulty band).';
comment on column public.child_profiles.shop_state is
  'Reserved for S-05 shop customization state. Defaults to empty object.';
