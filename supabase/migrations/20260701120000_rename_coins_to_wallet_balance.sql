-- =============================================================================
-- Migration: rename child_profiles.coins -> wallet_balance  (S-05)
-- =============================================================================
-- The shipped `coins` balance is reinterpreted as the single spendable wallet
-- (virtualBalance) the child saves to grow their shop; S-06 will spend against
-- it. This also disambiguates the persisted balance from the tappable in-task
-- 1-zł coins ("monety"), which are a different concept and are untouched.
--
-- Non-destructive: `rename column` preserves all data (and pre-launch there are
-- no production rows regardless). RLS is unaffected — the four F-01 account-scoped
-- policies are column-agnostic (auth.uid() = account_id), so NO policy changes are
-- needed (L-001) and the shared set_updated_at() trigger is untouched. The
-- non-negative guard is carried through the rename so the wallet can never go
-- negative once S-06 introduces spending. Rollback = the inverse rename.
-- =============================================================================

alter table public.child_profiles rename column coins to wallet_balance;

alter table public.child_profiles
  rename constraint child_profiles_coins_nonneg to child_profiles_wallet_balance_nonneg;

comment on column public.child_profiles.wallet_balance is
  'Spendable wallet balance (virtualBalance) earned across shifts (S-05). Non-negative; paid once at shift end; spent on upgrades from S-06.';
