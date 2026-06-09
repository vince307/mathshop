-- =============================================================================
-- Migration: child_profiles + per-account data isolation  (Foundation F-01)
-- =============================================================================
-- CANONICAL RLS ISOLATION TEMPLATE — copy this shape for every owned table.
--
-- Contract (see docs/reference/rls-isolation.md):
--   1. A table holding account-owned data ships its RLS in THIS SAME migration
--      file — never a follow-up migration.
--   2. Owner column is `account_id uuid not null references auth.users(id)
--      on delete cascade` (deleting a parent erases their child data; no
--      independent PII lives here).
--   3. RLS is ENABLED and there are FOUR per-operation policies — one each for
--      SELECT / INSERT / UPDATE / DELETE — all granted `to authenticated`, all
--      predicated on `auth.uid() = account_id`:
--        * INSERT uses WITH CHECK (not USING) so a parent cannot insert a row
--          owned by another account.
--        * UPDATE uses BOTH USING and WITH CHECK so a visible row cannot be
--          reassigned to another account_id.
--   4. `anon` receives nothing — Postgres default-deny applies once RLS is on.
--      Do not grant to anon.
--   5. `updated_at` is kept truthful by the shared set_updated_at() trigger
--      (created once here; later migrations REUSE it, they do not redefine it).
--   6. A cross-account isolation test (tests/child-profiles-isolation.test.ts)
--      proves one account can never read or write another account's rows.
--
-- Getting these policies wrong is a SILENT DATA LEAK, not a crash. See CLAUDE.md
-- §Architecture (per-account data isolation) and PRD FR-012 / FR-015.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Shared trigger function: stamp updated_at = now() on every UPDATE.
-- Created once for the whole project; later owned-table migrations attach a
-- trigger that EXECUTEs this function rather than redefining it.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Table: public.child_profiles
-- Minimal identity only — gameplay state (coins, level, shift count, shop
-- state) is added later by S-04 under this same isolation contract.
-- ---------------------------------------------------------------------------
create table public.child_profiles (
  id          uuid        primary key default gen_random_uuid(),
  account_id  uuid        not null references auth.users (id) on delete cascade,
  avatar      text        not null,
  theme       text        not null default 'default',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.child_profiles is
  'Child play-profiles owned by a parent account (auth.users). RLS-isolated per account; carries no child PII (avatar is a pre-set identifier, not a real name).';

-- RLS predicate + per-account lookup path.
create index child_profiles_account_id_idx
  on public.child_profiles (account_id);

-- Keep updated_at honest.
create trigger child_profiles_set_updated_at
  before update on public.child_profiles
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security: enable, then four per-operation policies.
-- ---------------------------------------------------------------------------
alter table public.child_profiles enable row level security;

create policy child_profiles_select_own
  on public.child_profiles
  for select
  to authenticated
  using (auth.uid() = account_id);

create policy child_profiles_insert_own
  on public.child_profiles
  for insert
  to authenticated
  with check (auth.uid() = account_id);

create policy child_profiles_update_own
  on public.child_profiles
  for update
  to authenticated
  using (auth.uid() = account_id)
  with check (auth.uid() = account_id);

create policy child_profiles_delete_own
  on public.child_profiles
  for delete
  to authenticated
  using (auth.uid() = account_id);
