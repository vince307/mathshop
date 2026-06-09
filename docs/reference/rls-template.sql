-- =============================================================================
-- RLS ISOLATION TEMPLATE — copy this skeleton for every account-owned table.
-- =============================================================================
-- This is the canonical pattern established by Foundation F-01. The worked
-- example is supabase/migrations/20260609120000_child_profiles_isolation.sql.
-- The rules are documented in docs/reference/rls-isolation.md. Every owned
-- table MUST register its surfaces in docs/reference/contract-surfaces.md and
-- ship a cross-account isolation test (see tests/child-profiles-isolation.test.ts).
--
-- Replace <table> with your table name. Keep the owner column named account_id.
-- Getting these policies wrong is a SILENT DATA LEAK, not a crash.
-- =============================================================================

-- The shared updated_at trigger function already exists (created by the F-01
-- migration). REUSE it — do NOT redefine set_updated_at() in later migrations.
-- (Shown here only so a standalone copy of this template is self-contained;
-- delete this block when the function is already present in the database.)
-- create or replace function public.set_updated_at()
-- returns trigger language plpgsql as $$
-- begin new.updated_at = now(); return new; end; $$;

create table public.<table> (
  id          uuid        primary key default gen_random_uuid(),
  account_id  uuid        not null references auth.users (id) on delete cascade,
  -- ... table-specific columns ...
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- RLS predicate + per-account lookup path.
create index <table>_account_id_idx on public.<table> (account_id);

-- Keep updated_at honest (reuses the shared function).
create trigger <table>_set_updated_at
  before update on public.<table>
  for each row
  execute function public.set_updated_at();

-- Enable RLS, then FOUR per-operation policies, all `to authenticated`.
alter table public.<table> enable row level security;

create policy <table>_select_own
  on public.<table>
  for select
  to authenticated
  using (auth.uid() = account_id);

-- INSERT uses WITH CHECK (not USING) — blocks inserting a row owned by someone else.
create policy <table>_insert_own
  on public.<table>
  for insert
  to authenticated
  with check (auth.uid() = account_id);

-- UPDATE uses BOTH USING (which rows are visible) and WITH CHECK (can't reassign owner).
create policy <table>_update_own
  on public.<table>
  for update
  to authenticated
  using (auth.uid() = account_id)
  with check (auth.uid() = account_id);

create policy <table>_delete_own
  on public.<table>
  for delete
  to authenticated
  using (auth.uid() = account_id);
