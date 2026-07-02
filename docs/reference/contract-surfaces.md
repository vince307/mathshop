# Contract Surfaces

Registry of load-bearing names — tables, columns, policies, shared functions, and the paths that depend on them. When a change renames or reshapes a surface listed here, treat it as **breaking** and provide a migration story for every consumer.

Each H2 below is a surface name. New account-owned tables must add an entry here as part of their migration (see [`rls-isolation.md`](./rls-isolation.md)).

> Convention established by Foundation F-01 (`per-account-isolation-contract`).

## public.child_profiles

The first account-owned table. Child play-profiles owned by a parent account. Carries consciously-collected child PII (`name`, `age` — a deliberate S-01b override of the PRD no-PII guardrail), RLS-isolated per account; see the Columns note below.

- **Defined in:** `supabase/migrations/20260609120000_child_profiles_isolation.sql`; identity columns added in `supabase/migrations/20260628120000_child_profiles_add_identity.sql` (S-01b); gameplay-state columns added in `supabase/migrations/20260630120000_child_profiles_add_gameplay_state.sql` (S-04); `coins` renamed to `wallet_balance` in `supabase/migrations/20260701120000_rename_coins_to_wallet_balance.sql` (S-05); `skill_state` jsonb added in `supabase/migrations/20260701140000_child_profiles_add_skill_state.sql` (S-07).
- **Owner column:** `account_id uuid not null references auth.users(id) on delete cascade` — RLS predicate `auth.uid() = account_id`.
- **Columns:** `id`, `account_id`, `avatar`, `theme`, `name`, `age`, `starting_level`, `wallet_balance`, `completed_shift_count`, `business_level`, `shop_state`, `skill_state`, `created_at`, `updated_at`. `name` + `age` are **consciously-collected child PII** (S-01b override of the PRD no-PII guardrail) — RLS-isolated by the policies below, app-validated/escaped, never logged; `age` is check-constrained `6–9`. Gameplay state (S-04/S-05): `wallet_balance` (the spendable wallet/Portfel, renamed from `coins` in S-05; check `>= 0`)/`completed_shift_count` (check `>= 0`), `business_level` (check `>= 1`, **mutable progression — distinct from the frozen `starting_level` difficulty band**), `shop_state` jsonb (reserved for S-05). `skill_state` jsonb (S-07): per-competency progress `{ math|money|decisions: { firstTryCorrect, completed, misses } }`, monotonic, normalized by `readSkillState` (`src/data/skills.ts`). All covered by the existing four policies (column-agnostic); written server-side via `recordShiftResult` / `buyUpgrade` / `POST /api/shifts/complete`.
- **RLS:** enabled; four per-operation policies, all `to authenticated`:
  - `child_profiles_select_own` — `for select using (auth.uid() = account_id)`
  - `child_profiles_insert_own` — `for insert with check (auth.uid() = account_id)`
  - `child_profiles_update_own` — `for update using (...) with check (...)`
  - `child_profiles_delete_own` — `for delete using (auth.uid() = account_id)`
- **`updated_at` trigger:** `child_profiles_set_updated_at` (`before update`, reuses `set_updated_at()`).
- **Isolation test:** `tests/child-profiles-isolation.test.ts` (run by CI as a merge gate).

## public.shift_log

Per-profile, per-shift history log (S-07) backing the parent weekly report (FR-016). One row per completed shift, plus one per upgrade purchase. Written server-side (`recordShiftResult` / `buyUpgrade`), `account_id` taken from the RLS-verified profile row (never client input, L-002).

- **Defined in:** `supabase/migrations/20260701150000_create_shift_log.sql` (S-07).
- **Owner column:** `account_id uuid not null references auth.users(id) on delete cascade` — RLS predicate `auth.uid() = account_id`.
- **Columns:** `id`, `account_id`, `profile_id` (`references child_profiles(id) on delete cascade`), `created_at`, `skills` jsonb (the per-competency delta this event exercised), `upgrade_purchased` text null (set only on a purchase event). No `updated_at` (append-mostly; rows aren't mutated in normal flow).
- **Indexes:** `shift_log_account_id_idx` (`account_id`), `shift_log_profile_created_idx` (`profile_id, created_at` — the weekly-report query path).
- **RLS:** enabled; four per-operation policies, all `to authenticated`:
  - `shift_log_select_own` — `for select using (auth.uid() = account_id)`
  - `shift_log_insert_own` — `for insert with check (auth.uid() = account_id)`
  - `shift_log_update_own` — `for update using (...) with check (...)`
  - `shift_log_delete_own` — `for delete using (auth.uid() = account_id)`
- **Consumed by:** `src/lib/services/reports.ts` (`getWeeklyReport` / `aggregateWeeklyReport`), `src/lib/services/child-profiles.ts` (writers).
- **Isolation test:** `tests/shift-log-isolation.test.ts`.

## public.account_settings

Per-account parent settings (S-07) holding the scrypt-hashed parent PIN (FR-016 gate) and a verify throttle. One row per account (`account_id` is the PK). Written server-side (`src/lib/services/parent-pin.ts`); the PIN is **never stored in plaintext** and never logged.

- **Defined in:** `supabase/migrations/20260701160000_create_account_settings.sql` (S-07).
- **Owner column:** `account_id uuid primary key references auth.users(id) on delete cascade` — RLS predicate `auth.uid() = account_id`.
- **Columns:** `account_id` (PK), `pin_hash` text (scrypt `salt:hash` hex), `failed_attempts` integer (check `>= 0`), `locked_until` timestamptz null, `created_at`, `updated_at`.
- **`updated_at` trigger:** `account_settings_set_updated_at` (`before update`, reuses `set_updated_at()`).
- **RLS:** enabled; four per-operation policies, all `to authenticated`:
  - `account_settings_select_own` — `for select using (auth.uid() = account_id)`
  - `account_settings_insert_own` — `for insert with check (auth.uid() = account_id)`
  - `account_settings_update_own` — `for update using (...) with check (...)`
  - `account_settings_delete_own` — `for delete using (auth.uid() = account_id)`
- **Env dependency:** `PARENT_SESSION_SECRET` (astro.config.mjs `env.schema`) — HMAC key for the signed `parent_verified` session marker. Set on Vercel (Production + Preview).
- **Isolation test:** `tests/account-settings-isolation.test.ts`.

## set_updated_at()

Shared trigger function that stamps `new.updated_at = now()` on every UPDATE.

- **Defined in:** `supabase/migrations/20260609120000_child_profiles_isolation.sql`
- **Reuse, don't redefine.** Later owned-table migrations attach their own `before update` trigger that `execute function public.set_updated_at()` — they must not `create or replace` it again.
