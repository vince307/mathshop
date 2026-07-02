-- =============================================================================
-- Migration: create shift_log  (S-07)  — new account-owned table, RLS in-migration
-- =============================================================================
-- A per-profile, per-shift history log that backs the parent weekly report
-- (FR-016). Each row records what a single shift (or a purchase event) exercised:
-- the per-competency `skills` delta and, for a purchase, the `upgrade_purchased`
-- id. This is the FIRST new owned table since Foundation F-01, so it ships the
-- full L-001 contract IN THIS MIGRATION: owner column `account_id` referencing
-- auth.users, RLS enabled, and FOUR per-operation policies (all `to authenticated`,
-- all predicated on auth.uid() = account_id). A wrong/missing policy here is a
-- SILENT DATA LEAK, not a crash — see docs/reference/rls-isolation.md and the
-- isolation test tests/shift-log-isolation.test.ts.
--
-- Append-mostly: rows are written server-side (recordShiftResult / buyUpgrade),
-- account_id taken from the RLS-verified profile row, never from client input
-- (L-002). No updated_at column (rows aren't mutated in normal flow), but the
-- UPDATE policy is still defined per the L-001 four-policy contract.
-- Rollback: drop table public.shift_log.
-- =============================================================================

create table public.shift_log (
  id                uuid        primary key default gen_random_uuid(),
  account_id        uuid        not null references auth.users (id) on delete cascade,
  profile_id        uuid        not null references public.child_profiles (id) on delete cascade,
  created_at        timestamptz not null default now(),
  -- Per-competency delta this event exercised: { math|money|decisions: { firstTryCorrect, completed, misses } }.
  skills            jsonb       not null,
  -- Set only on a purchase event (the upgrade id); null for a plain shift row.
  upgrade_purchased text        null
);

-- RLS predicate lookup path + the weekly-report query path (per profile, by date).
create index shift_log_account_id_idx on public.shift_log (account_id);
create index shift_log_profile_created_idx on public.shift_log (profile_id, created_at);

alter table public.shift_log enable row level security;

create policy shift_log_select_own
  on public.shift_log
  for select
  to authenticated
  using (auth.uid() = account_id);

-- INSERT uses WITH CHECK (not USING) — blocks inserting a row owned by someone else.
create policy shift_log_insert_own
  on public.shift_log
  for insert
  to authenticated
  with check (auth.uid() = account_id);

-- UPDATE uses BOTH USING (which rows are visible) and WITH CHECK (can't reassign owner).
create policy shift_log_update_own
  on public.shift_log
  for update
  to authenticated
  using (auth.uid() = account_id)
  with check (auth.uid() = account_id);

create policy shift_log_delete_own
  on public.shift_log
  for delete
  to authenticated
  using (auth.uid() = account_id);

comment on table public.shift_log is
  'Per-profile, per-shift history log (S-07) backing the parent weekly report (FR-016). Owned by account_id (RLS); rows written server-side with account_id from the RLS-verified profile row.';
