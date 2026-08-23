# Contract Surfaces

Registry of load-bearing names — tables, columns, policies, shared functions, and the paths that depend on them. When a change renames or reshapes a surface listed here, treat it as **breaking** and provide a migration story for every consumer.

Each H2 below is a surface name. New account-owned tables must add an entry here as part of their migration (see [`rls-isolation.md`](./rls-isolation.md)).

> Convention established by Foundation F-01 (`per-account-isolation-contract`).

## public.child_profiles

The first account-owned table. Child play-profiles owned by a parent account. Carries consciously-collected child PII (`name`, `age` — a deliberate S-01b override of the PRD no-PII guardrail), RLS-isolated per account; see the Columns note below.

- **Defined in:** `supabase/migrations/20260609120000_child_profiles_isolation.sql`; identity columns added in `supabase/migrations/20260628120000_child_profiles_add_identity.sql` (S-01b); gameplay-state columns added in `supabase/migrations/20260630120000_child_profiles_add_gameplay_state.sql` (S-04); `coins` renamed to `wallet_balance` in `supabase/migrations/20260701120000_rename_coins_to_wallet_balance.sql` (S-05); `skill_state` jsonb added in `supabase/migrations/20260701140000_child_profiles_add_skill_state.sql` (S-07).
- **Owner column:** `account_id uuid not null references auth.users(id) on delete cascade` — RLS predicate `auth.uid() = account_id`.
- **Columns:** `id`, `account_id`, `avatar`, `theme`, `name`, `age`, `starting_level`, `wallet_balance`, `completed_shift_count`, `business_level`, `shop_state`, `skill_state`, `created_at`, `updated_at`. `name` + `age` are **consciously-collected child PII** (S-01b override of the PRD no-PII guardrail) — RLS-isolated by the policies below, app-validated/escaped, never logged; `age` is check-constrained `6–9`. Gameplay state (S-04/S-05): `wallet_balance` (the spendable wallet/Portfel, renamed from `coins` in S-05; check `>= 0`)/`completed_shift_count` (check `>= 0`), `business_level` (check `>= 1`, **mutable progression — distinct from the frozen `starting_level` difficulty band**), `shop_state` jsonb (reserved for S-05) — `{ purchased: string[] }`, plus an optional `purchasedMeta` (`{ [upgradeId]: { world, at } }`, F5): **write-only in v1**, written by `buyUpgrade`, read by nothing and safely ignorable by every reader (`readPurchased` is untouched). It exists because `/app/worlds` makes `theme` mutable, so a purchase recorded without a world could never afterwards be attributed to one. `skill_state` jsonb (S-07): per-competency progress `{ math|money|decisions: { firstTryCorrect, completed, misses } }`, monotonic, normalized by `readSkillState` (`src/data/skills.ts`). All covered by the existing four policies (column-agnostic); written server-side via `recordShiftResult` / `buyUpgrade` / `POST /api/shifts/complete`. `theme` is **no longer write-once** (F5): it is mutated server-side via `updateChildProfileTheme` — see the world-change surface below.
- **RLS:** enabled; four per-operation policies, all `to authenticated`:
  - `child_profiles_select_own` — `for select using (auth.uid() = account_id)`
  - `child_profiles_insert_own` — `for insert with check (auth.uid() = account_id)`
  - `child_profiles_update_own` — `for update using (...) with check (...)`
  - `child_profiles_delete_own` — `for delete using (auth.uid() = account_id)`
- **`updated_at` trigger:** `child_profiles_set_updated_at` (`before update`, reuses `set_updated_at()`).
- **Isolation test:** `tests/child-profiles-isolation.test.ts` (run by CI as a merge gate).
- **Deletion surface (MAT-17):** see the [Child-profile deletion](#child-profile-deletion-rls-surface) surface below (`POST /api/profiles/delete` → `deleteChildProfile` via `child_profiles_delete_own`; `shift_log` cascades).
- **World-change surface (F5):** `POST /api/profiles/world` → `updateChildProfileTheme` via `child_profiles_update_own`; the closed slug set is enforced in zod at the route (`WORLD_SLUGS`), there is **no DB CHECK** on `theme`. Ownership is proven twice (the `resolveActiveProfile` read gate and the UPDATE policy itself) and never from client input. Isolation test: `tests/profiles-world.test.ts`.

## public.shift_log

Per-profile, per-shift history log (S-07) backing the parent weekly report (FR-016). One row per completed shift, plus one per upgrade purchase. Written server-side (`recordShiftResult` / `buyUpgrade`), `account_id` taken from the RLS-verified profile row (never client input, L-002).

- **Defined in:** `supabase/migrations/20260701150000_create_shift_log.sql` (S-07); `earned` added by `supabase/migrations/20260822120000_shift_log_add_earned.sql` (F4).
- **Owner column:** `account_id uuid not null references auth.users(id) on delete cascade` — RLS predicate `auth.uid() = account_id`.
- **Columns:** `id`, `account_id`, `profile_id` (`references child_profiles(id) on delete cascade`), `created_at`, `skills` jsonb (the per-competency delta this event exercised), `upgrade_purchased` text null (set only on a purchase event), `earned` integer null (F4 — the server-computed payout for a shift; **null means unknown**: a purchase event, or a pre-migration row, since there was no backfill. `sum(earned)` is therefore a lower bound, because `appendShiftLog` is best-effort and swallows its insert error). No `updated_at` (append-mostly; rows aren't mutated in normal flow).
- **Indexes:** `shift_log_account_id_idx` (`account_id`), `shift_log_profile_created_idx` (`profile_id, created_at` — the weekly-report query path).
- **RLS:** enabled; four per-operation policies, all `to authenticated`:
  - `shift_log_select_own` — `for select using (auth.uid() = account_id)`
  - `shift_log_insert_own` — `for insert with check (auth.uid() = account_id)`
  - `shift_log_update_own` — `for update using (...) with check (...)`
  - `shift_log_delete_own` — `for delete using (auth.uid() = account_id)`
- **Consumed by:** `src/lib/services/reports.ts` (`getWeeklyReport` / `aggregateWeeklyReport`, `listRecentActivity` — the child dashboard activity feed), `src/lib/services/child-profiles.ts` (writers).
- **Isolation test:** `tests/shift-log-isolation.test.ts` (table-level RLS), `tests/report-isolation.test.ts` (S-09 — the weekly-report read path itself: `getWeeklyReport` + profile listing, two signed-in accounts), `tests/recent-activity-isolation.test.ts` (F2 — **intra-account**: RLS here is account-scoped, so `listRecentActivity`'s app-side `.eq("profile_id", …)` is the only thing separating two children of the same parent; two profiles on one account, one row each).

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
- **Env dependency:** `PARENT_SESSION_SECRET` (astro.config.mjs `env.schema`) — HMAC key for the signed `parent_verified` session marker. Set on Vercel Production scope (added 2026-07-11 with MAT-17; Preview fails closed — no marker minting, so the report + deletion actions are unreachable there).
- **Isolation test:** `tests/account-settings-isolation.test.ts`.

## Parent PIN routes (RLS surface)

The two write/read paths over `public.account_settings.pin_hash` (S-07 / FR-016). Both take the PIN from a `multipart/form-data` body and the account from the session — no account id is ever accepted from the client (L-002). `verifyPin` (`src/lib/services/parent-pin.ts`) is the **only** exported reader of `pin_hash`; neither route compares a hash itself.

- **`POST /api/parent/pin/verify`** (`src/pages/api/parent/pin/verify.ts`). Gate order: 503 (no RLS client) → 401 (no session user) → 400 (zod) → `verifyPin` under the atomic `register_pin_failure` throttle → mint the signed `parent_verified` marker → 200.
- **`POST /api/parent/pin/set`** (`src/pages/api/parent/pin/set.ts`) — set **or** change. Gate order: 503 (no RLS client) → 401 (no session user) → 503 (`pinExists` could not tell) → **403** (existing PIN and no valid `parent_verified` marker) → 400 (zod) → **the change gate** → `setPin` → re-mint the marker → 200.
  - **First set vs change.** With no `account_settings` row the route is **open** to any authenticated session (this is real onboarding — `parent-pin.astro` renders `set` mode there). With a row present it is a **change**, which requires the marker **and** `currentPin` re-proved through `verifyPin` — a possibly-15-minute-old marker alone is not enough, matching the bar `POST /api/account/delete` sets (see below). `hasPin` fails open by contract, so the route uses the fail-closed `pinExists` instead.
  - **The change gate is one `if (isChange)` block**, in this order: (1) `currentPin` present, else 400 `invalid` — an early `return`, never a skipped verification; (2) `verifyPin`; (3) `currentPin === pin` → 400 `same-as-current`, deliberately *after* (2) so the cheap comparison cannot be a pre-flight that skips burning a throttle attempt. Do not split it into separate `isChange` tests and never gate (2) on `currentPin` being truthy — that shape is a full bypass. `setPin` unconditionally clears `failed_attempts`/`locked_until`, so any path reaching it while locked would be a free lockout reset; keeping `verifyPin` ahead of it is what prevents that.
- **`STATUS_FOR` vocabulary** (duplicated verbatim in `verify.ts`, `set.ts` and `account/delete.ts` so islands share one copy map): `locked` → 429, `wrong` → 401, `no-pin` → 400, `error` → 500. A 401 means "wrong PIN" **only** when the body carries `reason: "wrong"`.
- **Tests:** `tests/parent-pin-routes.test.ts` (both gate orders, the change contract, throttle participation and the live-lock rejection of a correct PIN), `tests/parent-pin.test.ts` (service layer), `tests/account-settings-isolation.test.ts` (table RLS).

## Account deletion (service-role surface)

Whole-account erasure (MAT-17) — the project's **first and only production service-role surface**. The GDPR right-to-erasure path: deleting the parent's `auth.users` row cascades every owned table (see the three surfaces above, all `on delete cascade`) plus `auth.sessions`.

- **Route:** `POST /api/account/delete` (`src/pages/api/account/delete.ts`). Gate order (all-or-nothing, each a hard stop): 503 (no RLS or admin client) → 401 (no session user) → 403 (invalid `parent_verified` marker) → 400 (zod) → PIN re-check via `verifyPin` (429 locked / 401 wrong / 400 no-pin — the atomic `register_pin_failure` throttle applies) → 400 (typed e-mail ≠ session e-mail) → `admin.auth.admin.deleteUser(user.id)` → best-effort `signOut()` + `clearAuthCookies` + delete `active_profile`/`parent_verified` → 200. The deletion target is **always** `user.id` from the session (`getUser()`), never client input (L-002).
- **Admin client:** `createAdminClient()` (`src/lib/supabase-admin.ts`) — plain `@supabase/supabase-js` client with the **service-role** key, `{ autoRefreshToken: false, persistSession: false }`, no cookie adapter. Used for **exactly one operation** (`deleteUser`); never to read/write app tables (that bypasses RLS, the project's highest-risk invariant). Fails closed: missing key → `null` → route 503.
- **Env dependency:** `SUPABASE_SERVICE_ROLE_KEY` (astro.config.mjs `env.schema`, `optional`). The most sensitive value in the project — Vercel **Production scope ONLY** (never Preview/Development; `infrastructure.md`), never the browser. `astro:env/server` import fails in client bundles, so islands cannot import the factory.
- **Tests:** `tests/account-deletion.test.ts` (full-cascade erasure across all three tables + auth user via admin read-back; wrong-PIN throttle; missing marker; e-mail mismatch; bystander isolation; absent-key 503).

## Child-profile deletion (RLS surface)

Single-profile deletion (MAT-17) — rides the existing `child_profiles_delete_own` policy; the profile's `shift_log` rows cascade via `profile_id`.

- **Route:** `POST /api/profiles/delete` (`src/pages/api/profiles/delete.ts`), `parent_verified`-marker-gated → `deleteChildProfile` (`src/lib/services/child-profiles.ts`) on the request-scoped **RLS** client (a non-owner's delete matches 0 rows → 404). Never uses the admin client.
- **Tests:** `tests/profile-deletion.test.ts` (positive delete + `shift_log` cascade + sibling/`account_settings` survival + cross-account 404 + marker 403 paths).

## set_updated_at()

Shared trigger function that stamps `new.updated_at = now()` on every UPDATE.

- **Defined in:** `supabase/migrations/20260609120000_child_profiles_isolation.sql`
- **Reuse, don't redefine.** Later owned-table migrations attach their own `before update` trigger that `execute function public.set_updated_at()` — they must not `create or replace` it again.
