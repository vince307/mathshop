# RLS Isolation Contract

MathShop requires **per-account data isolation** — one parent's data must never be visible to, or writable by, another (PRD FR-012 / FR-015; `CLAUDE.md` §Architecture). This is the project's highest-risk correctness invariant: a wrong policy is a **silent data leak, not a crash**. Foundation F-01 established the contract below; every later migration that adds an account-owned table must follow it.

- **Worked example:** [`supabase/migrations/20260609120000_child_profiles_isolation.sql`](../../supabase/migrations/20260609120000_child_profiles_isolation.sql)
- **Copyable skeleton:** [`rls-template.sql`](./rls-template.sql)
- **Name registry:** [`contract-surfaces.md`](./contract-surfaces.md)
- **Reference test:** [`tests/child-profiles-isolation.test.ts`](../../tests/child-profiles-isolation.test.ts)

## The rules

1. **RLS ships in the same migration as the table.** Never add the table in one migration and its policies in a follow-up — the gap is a window where data is unprotected.
2. **Owner column is `account_id uuid not null references auth.users(id) on delete cascade`.** The cascade means deleting a parent erases their child data (right-to-erasure friendly; no independent PII lives in child rows).
3. **RLS is enabled and there are four per-operation policies**, one each for SELECT / INSERT / UPDATE / DELETE, all granted `to authenticated`, all predicated on `auth.uid() = account_id`:
   - **INSERT** uses `with check` (not `using`) so a parent cannot insert a row owned by another account.
   - **UPDATE** uses **both** `using` (which existing rows are visible) and `with check` (the row cannot be reassigned to another `account_id`).
4. **`anon` gets nothing.** Postgres default-deny applies once RLS is on; do not grant to `anon`.
5. **`updated_at` is maintained by the shared `set_updated_at()` trigger.** The function is created once (in the F-01 migration); later migrations attach a `before update` trigger that _reuses_ it rather than redefining it.
6. **Every owned table ships a cross-account isolation test** that exercises all four operations across two accounts (see below) and is run by CI as a merge gate (`.github/workflows/ci.yml`).
7. **Register the surfaces** (table, owner column, policy names, test path) in [`contract-surfaces.md`](./contract-surfaces.md) so downstream changes can see them.

## Writing the isolation test

The test acts as **signed-in users**, never the service-role client — otherwise `auth.uid()` is null and RLS is bypassed, so the test passes vacuously. The service-role (admin) client is used only to provision and tear down the two test users.

It must assert all four operations cross-account, plus a positive control:

- **Positive control** — account A inserts and reads back its own row.
- **SELECT isolation** — account B reads zero of A's rows.
- **UPDATE isolation** — B's update of A's row affects 0 rows; A's row is unchanged.
- **DELETE isolation** — B's delete of A's row affects 0 rows; A's row remains.
- **INSERT-on-behalf isolation** — B's attempt to insert a row with `account_id = A` is rejected.

> **Gotcha (learned the hard way):** do **not** chain `.select()` onto the INSERT-on-behalf attempt. The SELECT policy would hide the row from B regardless of the INSERT `with check`, producing a client-visible error even when the `with check` is broken — so the assertion would pass against a broken policy. Insert **without** a read-back, and verify with the service-role client that **no on-behalf row was actually written**. That is what truly proves the INSERT policy.

Validate the test genuinely guards the contract by temporarily weakening one policy (e.g. INSERT `with check (true)`), running `npm run test`, and confirming the corresponding assertion goes red — then restore it.
