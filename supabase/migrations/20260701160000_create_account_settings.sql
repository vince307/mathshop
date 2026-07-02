-- =============================================================================
-- Migration: create account_settings  (S-07)  — new account-owned table, RLS in-migration
-- =============================================================================
-- Per-account parent settings holding the hashed parent PIN (FR-016 gate) plus a
-- brute-force throttle (`failed_attempts` / `locked_until`). One row per account
-- (account_id is the PK). Ships the full L-001 contract IN THIS MIGRATION: owner
-- column `account_id` referencing auth.users, RLS enabled, and FOUR per-operation
-- policies (all `to authenticated`, all predicated on auth.uid() = account_id).
-- The shared set_updated_at() trigger is REUSED (do NOT redefine it).
--
-- The PIN is stored ONLY as a scrypt hash ("salt:hash" hex) written server-side
-- (src/lib/services/parent-pin.ts) — never plaintext, never logged. A wrong/missing
-- policy here is a SILENT DATA LEAK, not a crash — see docs/reference/rls-isolation.md
-- and the isolation test tests/account-settings-isolation.test.ts.
--
-- Deploy note: also set the PARENT_SESSION_SECRET env var on Vercel (Production +
-- Preview) — the HMAC key for the parent-verified session marker (astro.config.mjs).
-- Rollback: drop table public.account_settings.
-- =============================================================================

create table public.account_settings (
  account_id      uuid        primary key references auth.users (id) on delete cascade,
  pin_hash        text        not null,
  failed_attempts integer     not null default 0 check (failed_attempts >= 0),
  locked_until    timestamptz null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.account_settings is
  'Per-account parent settings (S-07): scrypt-hashed parent PIN (FR-016) + verify throttle. One row per account (account_id PK, RLS-isolated). Written server-side; PIN never stored plaintext.';

-- Keep updated_at honest (reuses the shared function — do NOT redefine it).
create trigger account_settings_set_updated_at
  before update on public.account_settings
  for each row
  execute function public.set_updated_at();

alter table public.account_settings enable row level security;

create policy account_settings_select_own
  on public.account_settings
  for select
  to authenticated
  using (auth.uid() = account_id);

-- INSERT uses WITH CHECK (not USING) — blocks inserting a row owned by someone else.
create policy account_settings_insert_own
  on public.account_settings
  for insert
  to authenticated
  with check (auth.uid() = account_id);

-- UPDATE uses BOTH USING and WITH CHECK (can't reassign owner).
create policy account_settings_update_own
  on public.account_settings
  for update
  to authenticated
  using (auth.uid() = account_id)
  with check (auth.uid() = account_id);

create policy account_settings_delete_own
  on public.account_settings
  for delete
  to authenticated
  using (auth.uid() = account_id);
