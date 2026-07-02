-- ---------------------------------------------------------------------------
-- Atomic parent-PIN failure throttle (S-07 review finding F3).
--
-- The original verifyPin() incremented account_settings.failed_attempts with a
-- JS read-modify-write (SELECT then UPDATE). Under concurrent verify requests
-- every request read the same pre-increment count, so a parallel burst could get
-- many guesses through before any lockout landed — defeating the 5-attempt cap on
-- a 4–6 digit PIN. This function folds the increment + lockout decision into ONE
-- row-locked UPDATE, so the counter is exact under concurrency and the lockout
-- fires deterministically once the threshold is crossed.
--
-- security invoker (default) → runs under the CALLER's RLS; the WHERE clause pins
-- it to auth.uid() = account_id, so a parent can only ever throttle their OWN row
-- (never client-supplied — L-002). RETURNING reflects the post-UPDATE values.
-- ---------------------------------------------------------------------------
create or replace function public.register_pin_failure(p_max integer, p_lockout_seconds integer)
returns table (failed_attempts integer, locked_until timestamptz)
language sql
security invoker
set search_path = ''
as $$
  update public.account_settings s
  set failed_attempts = s.failed_attempts + 1,
      locked_until = case
        when s.failed_attempts + 1 >= p_max then now() + (p_lockout_seconds * interval '1 second')
        else s.locked_until
      end,
      updated_at = now()
  where s.account_id = auth.uid()
  returning s.failed_attempts, s.locked_until;
$$;

grant execute on function public.register_pin_failure(integer, integer) to authenticated;
