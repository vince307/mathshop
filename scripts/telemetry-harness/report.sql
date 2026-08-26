-- =============================================================================
-- Telemetry readout — the questions P2 is parked on.
-- =============================================================================
-- `task_attempt` has exactly one writer and, before this file, zero readers.
-- These queries are the readout: they turn rows into the shapes the curriculum
-- decision actually needs.
--
-- Run:  psql "$LOCAL_DB" -f scripts/telemetry-harness/report.sql
--       (LOCAL_DB = postgresql://postgres:postgres@127.0.0.1:54322/postgres)
--
-- SCOPE: every query is restricted to synthetic profiles (`name like 'syn-%'`).
-- That is what keeps harness output separable from real play in the same
-- database. Drop the filter deliberately, never by accident.
-- =============================================================================

\echo '\n=== 0. PIPE CHECK — did anything land at all? ==============================='
-- The end-to-end proof. Non-zero rows here mean: the client built the attempts
-- array, the server validated it, RLS accepted the insert, and the row persisted.
-- None of that was ever exercised from a real browser before this harness.
select
  count(*)                                          as attempts,
  count(distinct p.id)                              as profiles,
  count(*) filter (where a.difficulty is null)      as difficulty_null,
  count(*) filter (where a.duration_ms is null)     as duration_null,
  min(a.created_at)::timestamp(0)                   as first_row,
  max(a.created_at)::timestamp(0)                   as last_row
from public.task_attempt a
join public.child_profiles p on p.id = a.profile_id
where p.name like 'syn-%';

\echo '\n=== 1. DIFFICULTY TRAJECTORY — does the engine actually move d? ============'
-- The single most important check. If d does not separate by cohort, the
-- adaptive rule is not responding to accuracy and every P2 question is premature.
select
  p.name                                            as cohort,
  a.competency,
  count(*)                                          as attempts,
  round(min(a.difficulty)::numeric, 3)              as d_min,
  round(avg(a.difficulty)::numeric, 3)              as d_mean,
  round(max(a.difficulty)::numeric, 3)              as d_max,
  round(avg(a.first_try::int)::numeric * 100, 1)    as first_try_pct
from public.task_attempt a
join public.child_profiles p on p.id = a.profile_id
where p.name like 'syn-%'
group by p.name, a.competency
order by p.name, a.competency;

\echo '\n=== 2. CEILING PRESSURE — how much play happens pinned at the top? ========='
-- Level 1-2 ceiling is d = 0.5 and IS the FR-007 boundary (count <= 20), not a
-- tunable. A cohort spending most of its attempts at the ceiling has run out of
-- game — that is the concrete form of "the scale is too short".
select
  p.name                                            as cohort,
  count(*)                                          as attempts,
  count(*) filter (where a.difficulty >= 0.499)     as at_ceiling,
  round(100.0 * count(*) filter (where a.difficulty >= 0.499) / nullif(count(*), 0), 1) as at_ceiling_pct,
  count(*) filter (where a.difficulty <= 0.001)     as at_floor
from public.task_attempt a
join public.child_profiles p on p.id = a.profile_id
where p.name like 'syn-%'
group by p.name
order by p.name;

\echo '\n=== 3. SCENARIO DIFFICULTY — where do they actually stall? ================='
-- Per-scenario first-try rate and miss load. This is the shape that tells you
-- whether a new task type is needed, and which existing one is mis-calibrated.
select
  a.scenario,
  a.competency,
  count(*)                                          as attempts,
  round(avg(a.first_try::int)::numeric * 100, 1)    as first_try_pct,
  round(avg(a.misses)::numeric, 2)                  as misses_mean,
  round(avg(a.duration_ms)::numeric / 1000, 1)      as secs_mean
from public.task_attempt a
join public.child_profiles p on p.id = a.profile_id
where p.name like 'syn-%'
group by a.scenario, a.competency
order by first_try_pct;

\echo '\n=== 4. DIFFICULTY RESPONSE CURVE — p(first try | d) ========================'
-- The function the whole engine is tuned against, measured instead of assumed.
-- With harness data this reproduces the INPUT model (see child-model.ts) and is
-- therefore only a pipe check. With real children it is the actual finding.
select
  width_bucket(a.difficulty, 0, 1, 10)              as d_bucket,
  round((width_bucket(a.difficulty, 0, 1, 10) - 1) * 0.1, 1) as d_from,
  count(*)                                          as attempts,
  round(avg(a.first_try::int)::numeric * 100, 1)    as first_try_pct
from public.task_attempt a
join public.child_profiles p on p.id = a.profile_id
where p.name like 'syn-%' and a.difficulty is not null
group by d_bucket
order by d_bucket;

\echo '\n=== 5. POSITION IN SHIFT — do warm-up and closing guards show up? =========='
-- P3 eases task 0 (warm-up) and task n-1 (closing). If those guards work, the
-- first-try rate at those positions should sit above the middle of the shift.
select
  a.shift_index,
  count(*)                                          as attempts,
  round(avg(a.difficulty)::numeric, 3)              as d_mean,
  round(avg(a.first_try::int)::numeric * 100, 1)    as first_try_pct
from public.task_attempt a
join public.child_profiles p on p.id = a.profile_id
where p.name like 'syn-%'
group by a.shift_index
order by a.shift_index;

\echo '\n=== 6. MATH vs MONEY — is the two-competency partition doing work? ========='
-- If the two competencies never diverge within a profile, splitting them buys
-- nothing and P2 should not inherit the split uncritically.
select
  p.name                                            as cohort,
  round((p.difficulty_state ->> 'math')::numeric, 3)  as d_math,
  round((p.difficulty_state ->> 'money')::numeric, 3) as d_money,
  round(abs((p.difficulty_state ->> 'math')::numeric - (p.difficulty_state ->> 'money')::numeric), 3) as gap
from public.child_profiles p
where p.name like 'syn-%'
order by p.name;

-- =============================================================================
-- PURGE — remove every synthetic account and its cascade. Run deliberately.
-- `task_attempt.account_id` is `on delete cascade` from auth.users, so deleting
-- the users removes the attempts, the profiles, and the shift_log rows with them.
-- =============================================================================
-- delete from auth.users u
--  where exists (select 1 from public.child_profiles p
--                 where p.account_id = u.id and p.name like 'syn-%');
