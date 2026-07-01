-- =============================================================================
-- Migration: give child_profiles.shop_state a concrete default shape  (S-06)
-- =============================================================================
-- S-06 (upgrade-choice-and-growth) uses the reserved `shop_state` column to hold
-- `{ purchased: string[] }` — the ids of upgrades the child has bought. This sets
-- the column default to `{"purchased": []}` so NEW rows start with the explicit
-- shape. Existing pre-launch rows keep `{}` and are normalized in code
-- (`readPurchased` treats a missing `purchased` key as []), so no backfill is
-- needed and this is non-destructive. RLS is unaffected — the four F-01
-- account-scoped policies are column-agnostic (L-001); no policy/trigger change.
-- Rollback: reset the default to `'{}'::jsonb`.
-- =============================================================================

alter table public.child_profiles alter column shop_state set default '{"purchased": []}'::jsonb;

comment on column public.child_profiles.shop_state is
  'Shop customization state (S-06): { purchased: string[] } — ids of bought upgrades (src/data/upgrades.ts). Pre-S-06 rows may be {}, normalized in code.';
