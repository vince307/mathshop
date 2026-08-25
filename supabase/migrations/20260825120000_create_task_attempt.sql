-- =============================================================================
-- Migration: create task_attempt  (adaptive-task-engine P1) — new account-owned
-- table, RLS in-migration
-- =============================================================================
-- Per-task telemetry backing the adaptive difficulty engine. Where `shift_log`
-- records one aggregate row per completed shift, this records one row per TASK:
-- which scenario ran, at what parameters, whether it was answered first try, how
-- many misses it took, and how long it lasted. Without this grain the difficulty
-- model has nothing to consume, its constants cannot be tuned on evidence, and
-- its effectiveness cannot be demonstrated. S-07 explicitly listed "no
-- per-task-attempt history rows" as a non-goal; this change lifts that.
--
-- This is a NEW owned table, so it ships the full L-001 contract IN THIS
-- MIGRATION: owner column `account_id` referencing auth.users, RLS enabled, and
-- FOUR per-operation policies (all `to authenticated`, all predicated on
-- auth.uid() = account_id). A wrong/missing policy here is a SILENT DATA LEAK,
-- not a crash — see docs/reference/rls-isolation.md and the isolation test
-- tests/task-attempt-isolation.test.ts.
--
-- Append-only: rows are written server-side, batched at shift end in the same
-- call as `recordShiftResult`, with `account_id` taken from the RLS-verified
-- profile row and never from client input (L-002). No `updated_at` column (rows
-- are never mutated), but the UPDATE policy is still defined per the L-001
-- four-policy contract — exactly as `shift_log` does.
--
-- Deliberately NO `shift_log_id` foreign key. `appendShiftLog` returns void and
-- swallows its insert error by design; making attempts depend on the log row's
-- id would force that best-effort contract to become mandatory and add an
-- ordering dependency. Attempts correlate to their shift by
-- (`profile_id`, `created_at`) plus `shift_index`, which is also the signal the
-- analysis actually needs (warm-up and closing-task behaviour are positional).
--
-- Rollback: drop table public.task_attempt.
-- =============================================================================

create table public.task_attempt (
  id          uuid        primary key default gen_random_uuid(),
  account_id  uuid        not null references auth.users (id) on delete cascade,
  profile_id  uuid        not null references public.child_profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  -- 0-based position of this task within its shift. Positional, not chronological:
  -- the adaptation guards (warm-up on index 0, the eased closing task on index
  -- n-1) are only analysable against it.
  shift_index integer     not null,
  -- 'counting' | 'change_making' — mirrors Task["type"].
  task_type   text        not null,
  -- 'count_till' | 'give_change' | 'stock_and_change'.
  scenario    text        not null,
  -- 'math' | 'money' — which competency this task exercised.
  competency  text        not null,
  -- The continuous difficulty `d` the task was generated at. NULL until the
  -- continuous scale exists (P3): writing a normalised tier here beforehand would
  -- put two incomparable quantities in one column of the very table whose purpose
  -- is tuning. Difficulty is constant per profile before P3, so nothing is lost.
  difficulty  real        null,
  -- The generated numbers for this task: { targetCount } for counting;
  -- { paid, price, change, availableCount, stockCount? } for change-making.
  params      jsonb       not null,
  first_try   boolean     not null,
  misses      integer     not null,
  -- Time on task in ms, measured to the moment the answer was accepted — it
  -- EXCLUDES the fixed 1400 ms celebration beat. NULL when not measured.
  duration_ms integer     null,

  constraint task_attempt_shift_index_non_negative check (shift_index >= 0),
  constraint task_attempt_misses_non_negative      check (misses >= 0),
  constraint task_attempt_duration_non_negative    check (duration_ms is null or duration_ms >= 0),
  constraint task_attempt_difficulty_unit_range    check (difficulty is null or (difficulty >= 0 and difficulty <= 1))
);

-- RLS predicate lookup path + the per-profile analysis query path (by date).
create index task_attempt_account_id_idx on public.task_attempt (account_id);
create index task_attempt_profile_created_idx on public.task_attempt (profile_id, created_at);

alter table public.task_attempt enable row level security;

create policy task_attempt_select_own
  on public.task_attempt
  for select
  to authenticated
  using (auth.uid() = account_id);

-- INSERT uses WITH CHECK (not USING) — blocks inserting a row owned by someone else.
create policy task_attempt_insert_own
  on public.task_attempt
  for insert
  to authenticated
  with check (auth.uid() = account_id);

-- UPDATE uses BOTH USING (which rows are visible) and WITH CHECK (can't reassign owner).
create policy task_attempt_update_own
  on public.task_attempt
  for update
  to authenticated
  using (auth.uid() = account_id)
  with check (auth.uid() = account_id);

create policy task_attempt_delete_own
  on public.task_attempt
  for delete
  to authenticated
  using (auth.uid() = account_id);

comment on table public.task_attempt is
  'Per-task telemetry (adaptive-task-engine P1) backing the adaptive difficulty engine. One row per task in a shift; owned by account_id (RLS); rows written server-side, batched at shift end, with account_id from the RLS-verified profile row.';
