# Per-Account Data Isolation Contract (F-01) Implementation Plan

## Overview

Establish the per-account data-isolation contract that every later MathShop migration
will copy. This change ships the project's **first** Supabase migration — the
`child_profiles` table with row-level security and four per-operation, per-role policies
**in the same file** — then proves the isolation holds with an automated Vitest
integration test that asserts one parent (`account A`) can never read or write another
parent's (`account B`) rows. The test is gated in CI, and the reusable RLS pattern plus
the load-bearing name registry are documented so future migration authors inherit the
contract rather than reinventing (or breaking) it.

This is `CLAUDE.md`'s named highest-risk correctness invariant: a wrong policy is a
**silent data leak, not a crash**. Sequencing it as a discrete foundation makes the
pattern visible before any user-facing slice writes a profile.

## Current State Analysis

- **No migrations exist.** `supabase/config.toml` is configured (Postgres `major_version = 17`,
  `[db.seed]` enabled) but `supabase/migrations/` is empty. This is migration #1.
- **Auth plumbing already supports RLS.** `src/lib/supabase.ts:9` builds an
  `@supabase/ssr` server client with cookie sessions using the **anon** `SUPABASE_KEY`.
  The authenticated user's JWT therefore reaches Postgres, so `auth.uid()`-based RLS is
  actually enforced on app queries. `src/middleware.ts:11` resolves `auth.getUser()` into
  `context.locals.user`. No client change is required for RLS to take effect.
- **No test runner is wired.** `package.json` has no `test` script and no Vitest. CLAUDE.md
  explicitly flags "add one before relying on `npm test`." The `supabase` CLI (`^2.23.4`)
  is a devDependency, so a local stack is available via `npx supabase start`.
- **No `docs/reference/contract-surfaces.md`, no `context/foundation/lessons.md`.** Both are
  referenced by the project's lesson paths but do not exist yet.
- **Data model (PRD §Access Control / FR-012 / FR-015):** an account is a row in
  `auth.users`; each account holds 1+ child profiles; a profile carries pre-set avatar,
  theme, and (later) gameplay state. **No child PII** — parent email is the only PII.
- **CI** (`.github/workflows/ci.yml`) runs only `npm run lint` + `npm run build` on push/PR
  to `main`, with no database. Node 22, `npm ci`, `npx astro sync`.

### Key Discoveries:

- RLS works on the existing client path because `SUPABASE_KEY` is the anon key and
  `@supabase/ssr` forwards the user JWT (`src/lib/supabase.ts:9`). No service-role key is
  used in request handling — good, that would bypass RLS.
- The Vitest isolation test cannot reuse the SSR cookie client (it's built around Astro
  `Headers`/`AstroCookies`). It must use `@supabase/supabase-js` directly: a service-role
  admin client to **provision** users, and a per-user anon client signed in as A or B to
  **exercise** RLS as that user.
- `supabase/config.toml` already enables `[db.seed]` from `./seed.sql`, but the isolation
  test provisions its own users programmatically and must not depend on seed fixtures.

## Desired End State

After this plan:

1. `supabase/migrations/<ts>_child_profiles_isolation.sql` exists and, when applied to a
   fresh DB (`npx supabase db reset`), creates `child_profiles` with RLS enabled and four
   per-operation policies scoped to `auth.uid() = account_id`.
2. `npm run test` runs a Vitest integration suite against the local stack that **passes**
   only if account B cannot SELECT, UPDATE, DELETE, or INSERT-on-behalf-of account A, and
   account A can read its own row.
3. CI starts Supabase and runs `npm run test`; a policy regression blocks merge.
4. `docs/reference/rls-template.sql` + a prose guide document the copyable pattern, and
   `docs/reference/contract-surfaces.md` registers the F-01 names.

**Verification:** `npx supabase db reset` applies cleanly; `npm run test` passes locally
with the stack up and fails if any one of the four policies is removed from the migration.

## What We're NOT Doing

- **No gameplay state columns** (coins, business level, completed-shift count, shop state).
  `child_profiles` ships **minimal identity only**; state is S-04's job under this same
  contract.
- **No profile-creation UI, no API routes, no `src/lib/services/`.** F-01 is the data +
  contract layer; S-01 builds the first write path.
- **No `src/types.ts` generation** (e.g. `supabase gen types`). Deferred to the first slice
  that consumes the table in app code (S-01).
- **No seed data** for profiles. The isolation test self-provisions its users.
- **No magic-link / auth mechanism change.** Out of scope (roadmap Open Q#1).
- **No changes to `src/lib/supabase.ts` or `src/middleware.ts`.** The existing client path
  already enforces RLS.

## Implementation Approach

Build bottom-up: schema + policies first (the contract), then the test that proves it,
then the CI gate that protects it, then the docs that propagate it. Each phase is
independently verifiable. The migration is authored to be **self-documenting** — its header
comment is the canonical example the prose guide points at, so the live code and the
template never drift.

The owner column is `account_id uuid not null references auth.users(id) on delete cascade`,
and every policy predicate is `auth.uid() = account_id`. Four separate policies
(SELECT/INSERT/UPDATE/DELETE), all `to authenticated`; `anon` receives nothing via
Postgres default-deny once RLS is enabled.

## Critical Implementation Details

- **INSERT needs `WITH CHECK`, not `USING`.** The INSERT policy must use
  `with check (auth.uid() = account_id)` so a parent cannot insert a row owned by another
  account. A `USING`-only INSERT policy silently allows on-behalf-of inserts — exactly the
  hole the all-four-operations test exists to catch. UPDATE should carry **both** `using`
  (which existing rows are visible to update) and `with check` (the row can't be reassigned
  to another `account_id`).
- **`auth.uid()` returns NULL for the `anon`/service roles.** The isolation test must act as
  a signed-in user (anon client after `signInWithPassword`), not via the service-role client,
  or RLS is bypassed and the test passes vacuously. The service-role client is used **only**
  to create/delete the two test users.
- **RLS is default-deny once enabled but grants still matter.** Supabase grants table
  privileges to `authenticated` by default; enabling RLS + the four policies is sufficient.
  Do not `grant` to `anon`.

## Phase 1: Schema + RLS migration

### Overview

Author the first migration: `child_profiles` (minimal identity), enable RLS, and define the
four per-operation per-role policies in the same file, with a template header comment.

### Changes Required:

#### 1. First Supabase migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_child_profiles_isolation.sql` (new)

**Intent**: Create the `child_profiles` table owned by a parent account and lock it down so a
row is only ever visible/mutable by its owning account. This file is the canonical example
every future owned-table migration copies.

**Contract**:
- Table `public.child_profiles`:
  - `id uuid primary key default gen_random_uuid()`
  - `account_id uuid not null references auth.users(id) on delete cascade`
  - `avatar text not null` (one of the ~6 pre-set avatar identifiers; PRD FR-001)
  - `theme text not null default 'default'` (per-profile theme carried for v2; PRD §Non-Goals)
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
  - index on `account_id` (RLS predicate + lookup path)
- A `set_updated_at()` trigger function + `before update` trigger on `child_profiles` that
  sets `new.updated_at = now()`, so `updated_at` is truthful (not a second `created_at`). The
  trigger function is shared — create it once here; the template (Phase 4) notes later
  migrations reuse the existing function rather than redefining it. (Supabase's `moddatetime`
  extension is an acceptable equivalent.)
- `alter table public.child_profiles enable row level security;`
- Four policies, all `to authenticated`, predicate `auth.uid() = account_id`:
  - `child_profiles_select_own` — `for select using (...)`
  - `child_profiles_insert_own` — `for insert with check (...)`
  - `child_profiles_update_own` — `for update using (...) with check (...)`
  - `child_profiles_delete_own` — `for delete using (...)`
- A header comment block stating the contract rules (RLS enabled same-file, per-operation,
  per-role `authenticated`, `account_id = auth.uid()`, `on delete cascade`) so the file is
  self-documenting and copyable.

This is the one file in the plan that ships as concrete SQL — name it precisely; later phases
and docs reference these exact policy names.

### Success Criteria:

#### Automated Verification:

- Migration applies to a fresh DB: `npx supabase db reset` exits 0
- RLS is enabled on the table: query `pg_class.relrowsecurity` is true for `child_profiles`
- Exactly four policies exist: `select count(*) from pg_policies where tablename='child_profiles'` returns 4
- Lint/format clean on any touched non-SQL files: `npm run lint`

#### Manual Verification:

- In Supabase Studio, the table shows RLS on and four named policies
- Migration header reads as a usable copy template for the next owned table

**Implementation Note**: After Phase 1's automated checks pass, pause for manual confirmation
before Phase 2.

---

## Phase 2: Test harness + cross-account isolation test

### Overview

Wire Vitest as the project's test runner and add the integration test that proves the
contract by exercising all four operations across two accounts.

### Changes Required:

#### 1. Vitest dependency + script

**File**: `package.json`

**Intent**: Add Vitest as the test runner and a `test` script, satisfying CLAUDE.md's "add a
runner before relying on `npm test`."

**Contract**: `vitest` (+ `dotenv` if needed for `.env.test`) added to `devDependencies`;
`"test": "vitest run"` added to `scripts`. lint-staged untouched.

#### 2. Vitest config

**File**: `vitest.config.ts` (new)

**Intent**: Configure a Node-environment integration test project pointed at the local
Supabase stack, loading test env vars.

**Contract**: Node test environment; includes `tests/**/*.test.ts`; no jsdom. Reads
`SUPABASE_URL` (local API), anon key, and service-role key from the environment / `.env.test`.

#### 3. Test environment wiring

**File**: `.env.test.example` (new) + `README.md` (Local environment / testing note)

**Intent**: Document the three values the test needs and where they come from, without
committing secrets. The local anon + service-role keys are emitted by `npx supabase start` /
`npx supabase status`.

**Contract**: `.env.test.example` lists `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` with placeholder values and a comment pointing at
`supabase status`. Document the explicit mapping from `npx supabase status -o env` output to
these names: `API_URL → SUPABASE_URL`, `ANON_KEY → SUPABASE_ANON_KEY`,
`SERVICE_ROLE_KEY → SUPABASE_SERVICE_ROLE_KEY`. README gains a short "Running the isolation
test" subsection (`npx supabase start` → copy/map keys → `npm run test`). `.env.test` is
gitignored. **Note:** the local-stack anon/service-role keys are fixed *public demo* JWTs (the
same on every machine, signed with Supabase's default local JWT secret) — they are **not**
secrets, so CI reads them straight from `supabase status` and needs **no** GitHub secrets for
the test. Do not reuse these keys for any deployed environment.

#### 4. Cross-account isolation test

**File**: `tests/child-profiles-isolation.test.ts` (new)

**Intent**: Provision two distinct accounts and assert the RLS contract end-to-end through
the real `@supabase/supabase-js` client path.

**Contract**: Using a service-role admin client, create users A and B
(`auth.admin.createUser`, email-confirmed) in `beforeAll` and delete them in `afterAll`. Two
anon clients sign in as A and B (`signInWithPassword`). Assertions:
- **Positive control:** A inserts a profile (owns it) and SELECTs it back → 1 row.
- **SELECT isolation:** B SELECTs `child_profiles` → 0 rows (cannot see A's row).
- **UPDATE isolation:** B updates A's row by id → 0 rows affected (or error), and A's row is
  unchanged when re-read by A.
- **DELETE isolation:** B deletes A's row by id → 0 rows affected, A's row still present.
- **INSERT-on-behalf isolation:** B inserts a row with `account_id = A.id` → rejected by the
  `with check` predicate (error / RLS violation).

The test must act as signed-in users for all assertions (never the service-role client), so
RLS is genuinely exercised. Each assertion maps 1:1 to one of the four policies.

### Success Criteria:

#### Automated Verification:

- Test runner present: `npm run test` is a valid script and Vitest resolves
- With the local stack up and DB reset, `npm run test` passes (all five assertions)
- Negative meta-check: removing any one of the four policies from the migration and
      re-running `npx supabase db reset && npm run test` makes the test fail
- `npm run lint` passes on the new TS files

#### Manual Verification:

- A fresh contributor can follow the README testing steps and run the suite from a clean
      `npx supabase start`
- Test output names which operation failed when a policy is missing (assertions are
      individually legible)

**Implementation Note**: After Phase 2's automated checks pass (including the policy-removal
meta-check), pause for manual confirmation before Phase 3.

---

## Phase 3: CI gate

### Overview

Run the isolation test on every PR by starting Supabase in CI and gating merge on it.

### Changes Required:

#### 1. CI workflow

**File**: `.github/workflows/ci.yml`

**Intent**: Extend the existing `ci` job so the database-backed isolation test runs after
lint/build, with the local Supabase stack started in the runner. A failure blocks merge.

**Contract**: After `npm ci` / `npx astro sync`, add steps to start Supabase with the
unneeded services excluded — `npx supabase start -x studio,storage,imgproxy,realtime,inbucket,
edge-runtime,logflare,vector,supavisor,pooler` (keep db + auth/gotrue + rest/postgrest, which
the isolation test exercises) — export the stack's URL + anon + service-role keys into the
test env (from `npx supabase status -o env`, mapping its `API_URL`/`ANON_KEY`/
`SERVICE_ROLE_KEY` to the names the test reads — see F4), apply migrations (`npx supabase db
reset` if not already applied by start), and run `npm run test`. Keep the existing `lint` +
`build` steps. The job remains blocking (no `continue-on-error`). Verify the exclude list
against `npx supabase start --help` for the installed CLI version before committing.

### Success Criteria:

#### Automated Verification:

- CI workflow YAML is valid and the job parses (push a branch; Actions run starts)
- CI run executes `npm run test` and reports the isolation suite result
- A PR with a deliberately weakened policy (local spike, not merged) shows CI red

#### Manual Verification:

- CI wall-clock increase is acceptable (stack start + test ≈ 2–4 min cold, less with Docker layer cache)
- Required-check configuration (or branch protection) treats the test as merge-blocking

**Implementation Note**: After Phase 3's automated checks pass, pause for manual confirmation
before Phase 4.

---

## Phase 4: Contract docs + name registry

### Overview

Document the reusable pattern and register the load-bearing names so future migrations
inherit the contract.

### Changes Required:

#### 1. RLS template + guide

**File**: `docs/reference/rls-template.sql` (new) + `docs/reference/rls-isolation.md` (new)

**Intent**: Give future migration authors a copyable SQL skeleton and a short prose guide
explaining the contract rules, pointing at the live Phase 1 migration as the worked example.

**Contract**: `rls-template.sql` is a commented skeleton (owner column shape, `enable row
level security`, the four `to authenticated` per-operation policies with `using`/`with check`
placement, and a `before update` `set_updated_at` trigger with a note to reuse the shared
function rather than redefine it). `rls-isolation.md` states the rules (RLS in the same
migration as the table; per-operation, per-role; `account_id = auth.uid()`; `on delete
cascade`; maintain `updated_at` via the shared trigger; every owned table gets an isolation
test), and links the example migration + the Phase 2 test.

#### 2. Contract-surfaces registry

**File**: `docs/reference/contract-surfaces.md` (new)

**Intent**: Create the load-bearing names registry referenced by the project's lesson paths,
seeded with F-01's surfaces so later changes append rather than re-mint.

**Contract**: A table/list registering: table `public.child_profiles`; owner column
`account_id`; the four policy names (`child_profiles_{select,insert,update,delete}_own`); the
test path `tests/child-profiles-isolation.test.ts`; and the template path
`docs/reference/rls-template.sql`. Short note that new owned tables must register here.

#### 3. Lessons capture (optional, low-cost)

**File**: `context/foundation/lessons.md` (new)

**Intent**: Record the RLS isolation rule as a recurring lesson so plan/implement steps treat
it as a prior. (Equivalent to running `/10x-lesson`; include only if not separately captured.)

**Contract**: One lesson entry: "Every owned table ships RLS in the same migration, with
per-operation `to authenticated` policies on `auth.uid() = account_id`, plus a cross-account
isolation test." Links `docs/reference/rls-isolation.md`.

### Success Criteria:

#### Automated Verification:

- New docs exist: `ls docs/reference/rls-template.sql docs/reference/rls-isolation.md docs/reference/contract-surfaces.md`
- Prettier clean on Markdown: `npm run format` leaves docs unchanged (or `npx prettier --check`)
- Registry policy names exactly match the migration (grep the four names in both files)

#### Manual Verification:

- A reader can produce a second compliant owned-table migration from the template + guide
      without reading this plan
- `contract-surfaces.md` accurately lists every F-01 load-bearing name

**Implementation Note**: Final phase — after automated checks pass, confirm the docs read as a
usable contract for the next author.

---

## Testing Strategy

### Unit Tests:

- None. The contract is enforced at the database boundary; a unit test of app code would not
  exercise RLS. Verification is integration-level by necessity.

### Integration Tests:

- `tests/child-profiles-isolation.test.ts` — the cross-account suite (Phase 2) is the
  project's first and the canonical isolation test. Five assertions, one per policy plus a
  positive control.

### Manual Testing Steps:

1. `npx supabase start` then `npx supabase db reset` — confirm the migration applies.
2. Copy `SUPABASE_URL` + anon + service-role keys from `npx supabase status` into `.env.test`.
3. `npm run test` — confirm green.
4. Temporarily delete `child_profiles_insert_own` from the migration, `npx supabase db reset`,
   re-run `npm run test` — confirm the INSERT-on-behalf assertion goes red. Restore the policy.

## Performance Considerations

Negligible at this scale. The `account_id` index supports the RLS predicate. CI gains ~1–2 min
from starting the stack — accepted as the cost of continuously guarding the top invariant.

## Migration Notes

This is migration #1; there is no existing data to migrate. `on delete cascade` means deleting
a parent (`auth.users` row) removes their child profiles — the desired right-to-erasure
behavior given child data is meaningless without the parent and carries no independent PII.

## References

- Roadmap item: `context/foundation/roadmap.md` → F-01 (§Foundations)
- PRD: `context/foundation/prd-v2.md` §Access Control, FR-012, FR-015, §Success Criteria guardrail
- Existing client path that enforces RLS: `src/lib/supabase.ts:9`, `src/middleware.ts:11`
- CI to extend: `.github/workflows/ci.yml`
- Project invariant: `CLAUDE.md` §Architecture (per-account data isolation)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema + RLS migration

#### Automated

- [x] 1.1 Migration applies to a fresh DB: `npx supabase db reset` exits 0
- [x] 1.2 RLS enabled on `child_profiles` (`pg_class.relrowsecurity` true)
- [x] 1.3 Exactly four policies exist (`pg_policies` count = 4)
- [x] 1.4 `npm run lint` passes

#### Manual

- [x] 1.5 Studio shows RLS on + four named policies
- [x] 1.6 Migration header reads as a usable copy template

### Phase 2: Test harness + cross-account isolation test

#### Automated

- [ ] 2.1 `npm run test` is a valid script and Vitest resolves
- [ ] 2.2 With stack up + DB reset, `npm run test` passes (all five assertions)
- [ ] 2.3 Removing any one policy makes the test fail (reset + re-run)
- [ ] 2.4 `npm run lint` passes on new TS files

#### Manual

- [ ] 2.5 Fresh contributor can run the suite from README steps
- [ ] 2.6 Test output names the failing operation when a policy is missing

### Phase 3: CI gate

#### Automated

- [ ] 3.1 CI workflow YAML valid; job parses and starts
- [ ] 3.2 CI run executes `npm run test` and reports the isolation result
- [ ] 3.3 A weakened-policy spike shows CI red

#### Manual

- [ ] 3.4 CI wall-clock increase acceptable (~2–4 min cold)
- [ ] 3.5 Test configured as merge-blocking (branch protection / required check)

### Phase 4: Contract docs + name registry

#### Automated

- [ ] 4.1 New docs exist (template, guide, registry)
- [ ] 4.2 Markdown is Prettier-clean
- [ ] 4.3 Registry policy names exactly match the migration

#### Manual

- [ ] 4.4 A reader can produce a second compliant migration from template + guide
- [ ] 4.5 `contract-surfaces.md` lists every F-01 load-bearing name
