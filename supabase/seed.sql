-- Local development seed — a ready-to-use parent account, its child profiles,
-- and a week of gameplay history. Loaded automatically by `supabase db reset`
-- (and by the first `supabase start` on a fresh Docker volume) via the
-- `[db.seed]` block in `config.toml`; re-runnable by hand with `npm run db:seed`.
--
-- LOCAL ONLY. Never run against a hosted project: it writes a known password
-- straight into `auth.users`. Everything it creates hangs off one account id, so
-- deleting that user (first statement below) resets the whole seed.
--
--   e-mail: rodzic@mathshop.test
--   hasło:  haslo123
--   PIN rodzica: 1234
--
-- pgcrypto lives in the `extensions` schema on the Supabase stack; putting it on
-- the search_path keeps `crypt`/`gen_salt` resolvable wherever it is installed.
-- Every table below is schema-qualified regardless.
set search_path = extensions, public;

-- ── Parent account ────────────────────────────────────────────────────────────
-- Fixed ids so the seed is idempotent and referenceable from a psql session.
-- The delete cascades: auth.identities, child_profiles, shift_log,
-- task_attempt and account_settings all reference auth.users on delete cascade.
delete from auth.users where id = '11111111-1111-4111-8111-111111111111';

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated', 'authenticated',
  'rodzic@mathshop.test',
  crypt('haslo123', gen_salt('bf')),
  -- Pre-confirmed, so the account works even if `enable_confirmations` is
  -- flipped to true locally to test the e-mail round-trip (see README).
  now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  now(), now(),
  '', '', '', ''
);

-- GoTrue expects an `email` identity alongside the user row; without it the
-- account exists but several auth flows (identity linking, recovery) misbehave.
insert into auth.identities (
  id, user_id, provider_id, provider, identity_data,
  last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'email',
  jsonb_build_object(
    'sub', '11111111-1111-4111-8111-111111111111',
    'email', 'rodzic@mathshop.test',
    'email_verified', true,
    'phone_verified', false
  ),
  now(), now(), now()
);

-- ── Child profiles ────────────────────────────────────────────────────────────
-- Two deliberately different states: a fresh profile (the day-one experience)
-- and one mid-progression (unlocked upgrades, a levelled-up business, skill
-- history), so the parent report and the shop have something to render.
-- `avatar` values come from src/data/avatars.ts, `theme` from src/data/worlds.ts.
insert into public.child_profiles (
  id, account_id, name, age, starting_level, avatar, theme,
  wallet_balance, completed_shift_count, business_level,
  shop_state, skill_state, difficulty_state
) values
  (
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    'Ola', 7, 1, 'ola', 'kawiarnia',
    0, 0, 1,
    '{"purchased": []}'::jsonb, '{}'::jsonb, '{}'::jsonb
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    '11111111-1111-4111-8111-111111111111',
    -- 6 completed shifts → business_level 3 (businessLevelForShifts, src/data/shift.ts).
    'Kuba', 9, 3, 'kuba', 'galaktyczna-baza',
    120, 6, 3,
    '{"purchased": ["sign", "shelf"]}'::jsonb,
    '{"math": {"firstTryCorrect": 12, "completed": 18, "misses": 6},
      "money": {"firstTryCorrect": 7, "completed": 11, "misses": 4},
      "decisions": {"firstTryCorrect": 2, "completed": 2, "misses": 0}}'::jsonb,
    '{"math": 0.6, "money": 0.4}'::jsonb
  );

-- ── Shift history (parent weekly report + activity feed) ──────────────────────
-- Spread across the last six days so the report's seven-day chart is not a
-- single bar. `skills` carries the per-shift delta the shift-complete route
-- writes; `earned` its payout (null on the purchase row, which is not a shift).
insert into public.shift_log (account_id, profile_id, created_at, skills, upgrade_purchased, earned)
values
  ('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', now() - interval '5 days',
   '{"math": {"firstTryCorrect": 2, "completed": 3, "misses": 1}}'::jsonb, null, 18),
  ('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', now() - interval '4 days',
   '{"math": {"firstTryCorrect": 3, "completed": 3, "misses": 0},
     "money": {"firstTryCorrect": 1, "completed": 2, "misses": 1}}'::jsonb, null, 22),
  ('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', now() - interval '3 days',
   '{"decisions": {"firstTryCorrect": 1, "completed": 1, "misses": 0}}'::jsonb, 'sign', null),
  ('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', now() - interval '2 days',
   '{"math": {"firstTryCorrect": 3, "completed": 4, "misses": 2},
     "money": {"firstTryCorrect": 2, "completed": 3, "misses": 1}}'::jsonb, null, 25),
  ('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', now() - interval '1 day',
   '{"math": {"firstTryCorrect": 4, "completed": 5, "misses": 2},
     "money": {"firstTryCorrect": 3, "completed": 4, "misses": 1}}'::jsonb, null, 30),
  ('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', now() - interval '3 hours',
   '{"decisions": {"firstTryCorrect": 1, "completed": 1, "misses": 0}}'::jsonb, 'shelf', null);

-- ── Parent PIN (gate on the report + account deletion) ────────────────────────
-- PIN 1234, in the `salt:hash` scrypt format hashPin() writes
-- (src/lib/services/parent-pin.ts: scrypt, keylen 64, hex). The salt is fixed
-- here only so this file stays a plain constant — the app still salts randomly.
insert into public.account_settings (account_id, pin_hash)
values (
  '11111111-1111-4111-8111-111111111111',
  '5eed5eed5eed5eed5eed5eed5eed5eed:3124757d2246729e1abf9931ae7e8c0784a077a461e2ca7c86ef4c39eab808a840de643a9c37e26633ac34dc1f62ca9e34d12c7d3dac41d7bf45d4e824b9070e'
);
