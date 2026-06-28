-- =============================================================================
-- Migration: add child identity fields to child_profiles  (S-01b)
-- =============================================================================
-- Extends the Foundation F-01 owned table
-- (20260609120000_child_profiles_isolation.sql) with the identity fields the
-- create-first-profile wizard collects. RLS is already ENABLED with four
-- account-scoped per-operation policies that cover ALL columns, so no policy
-- changes are needed here, and the shared set_updated_at() trigger is REUSED
-- (do NOT redefine it).
--
-- ⚠ PII NOTE — deliberate guardrail override. `name` (child first name) and
-- `age` are child PII, collected per a product-owner decision that overrides the
-- PRD "no PII tied to children / no real names" guardrail (prd-v2.md:51,168).
-- They are isolated by the existing account-scoped RLS policies, validated +
-- HTML-escaped in the app layer (zod), and never logged.
--
-- child_profiles holds no production data pre-launch, so the NOT NULL columns
-- are added directly (no backfill). If data ever exists first, add a default +
-- backfill, then enforce NOT NULL.
-- =============================================================================

alter table public.child_profiles
  add column name           text     not null,
  add column age            smallint not null,
  add column starting_level smallint not null default 1;

-- v1 audience is ages 6–9 (PRD ~6–8; mockup chip "6–9 lat"). Guard at the DB.
alter table public.child_profiles
  add constraint child_profiles_age_range check (age between 6 and 9);

comment on column public.child_profiles.name is
  'Child first name. Consciously-collected PII (overrides PRD no-PII guardrail); RLS-isolated, app-validated/escaped, never logged.';
comment on column public.child_profiles.age is
  'Child age 6–9 (check-constrained). Used to derive starting_level.';
comment on column public.child_profiles.starting_level is
  'Derived starting difficulty band (age 6–7 → 1, 8–9 → 2). Gameplay leveling is S-04.';
