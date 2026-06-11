# Per-Account Data Isolation Contract (F-01) — Plan Brief

> Full plan: `context/changes/per-account-isolation-contract/plan.md`

## What & Why

Ship the project's first Supabase migration as a **reusable data-isolation contract**:
`child_profiles` with row-level security and four per-operation policies in one file, plus an
automated test proving one parent can never read or write another parent's rows. This is
`CLAUDE.md`'s named highest-risk invariant — a wrong policy is a *silent data leak, not a
crash* — so it's built as a discrete foundation that locks the pattern before any user-facing
slice writes a profile (roadmap F-01; PRD §Access Control, FR-012, FR-015).

## Starting Point

`supabase/migrations/` is empty — this is migration #1. Auth already enforces RLS correctly:
`src/lib/supabase.ts` uses the anon key via `@supabase/ssr`, so the user's JWT reaches Postgres
and `auth.uid()` policies take effect on app queries. No test runner is wired (CLAUDE.md flags
this), but the `supabase` CLI is installed for a local stack. CI runs only lint + build.

## Desired End State

A fresh `npx supabase db reset` creates `child_profiles` with RLS on and four named policies.
`npm run test` runs a Vitest integration suite that passes only if account B cannot
SELECT/UPDATE/DELETE/INSERT-on-behalf account A's rows (and A sees its own). CI starts Supabase
and gates merge on that suite. The reusable RLS template and a load-bearing name registry are
documented for the next migration author.

## Key Decisions Made

| Decision                  | Choice                                              | Why (1 sentence)                                                              | Source |
| ------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------- | ------ |
| Isolation test harness    | Vitest + `@supabase/supabase-js` integration test   | Exercises the real client path apps use; wires the runner CLAUDE.md wants     | Plan   |
| Schema breadth            | Minimal identity only (no gameplay state)           | Keeps F-01 about the contract; S-04 adds state under the same RLS contract    | Plan   |
| Owner column              | `account_id → auth.users(id)`, `ON DELETE CASCADE`  | Domain-accurate name; deleting a parent erases child data (no independent PII)| Plan   |
| RLS structure             | Four per-operation policies, `to authenticated`     | Matches CLAUDE.md's per-operation/per-role mandate; auditable                 | Plan   |
| Test coverage             | All four cross-account ops + positive control       | Catches a WITH-CHECK / on-behalf gap that SELECT-only would miss              | Plan   |
| CI                        | Add Supabase to CI, gate merge on the test          | The leak guard runs on every PR, not just locally                             | Plan   |
| Template home             | Standalone `docs/reference/` RLS guide + template   | Single canonical artifact, linked to the live migration example              | Plan   |
| Name registry             | Create + seed `docs/reference/contract-surfaces.md` | Registers the first load-bearing names at the moment they're minted           | Plan   |

## Scope

**In scope:** first migration (`child_profiles` + RLS + 4 policies, one file); Vitest harness +
cross-account isolation test; CI gate; RLS template + guide; contract-surfaces registry.

**Out of scope:** gameplay state columns (S-04); profile-creation UI / API / services (S-01);
`supabase gen types` / `src/types.ts`; seed data; auth-mechanism change; changes to the existing
Supabase client or middleware.

## Architecture / Approach

Bottom-up and independently verifiable: **(1)** schema + policies — the contract, authored as a
self-documenting migration; **(2)** a Vitest test that provisions accounts A & B (service-role to
create, anon clients signed-in as each to exercise) and asserts isolation per policy; **(3)** CI
starts the stack and runs the test as a merge gate; **(4)** docs that let the next author copy the
pattern. Every policy predicate is `auth.uid() = account_id`; `anon` gets nothing by default-deny.

## Phases at a Glance

| Phase                          | What it delivers                                  | Key risk                                                        |
| ------------------------------ | ------------------------------------------------- | -------------------------------------------------------------- |
| 1. Schema + RLS migration      | `child_profiles` + RLS + four policies, one file  | INSERT policy needs `WITH CHECK` or on-behalf inserts leak     |
| 2. Test harness + isolation    | Vitest wired + cross-account suite (5 assertions) | Must act as signed-in users, not service-role, or RLS bypassed |
| 3. CI gate                     | Supabase-in-CI runs the test, blocks merge        | First DB-in-CI wiring; stack start time                        |
| 4. Contract docs + registry    | RLS template + guide + name registry              | Docs drifting from the live migration                          |

**Prerequisites:** Docker for the local Supabase stack; `npx supabase start` working.
**Estimated effort:** ~1–2 sessions across 4 phases (most effort in Phases 1–2).

## Open Risks & Assumptions

- Assumes CI can run `npx supabase start` on `ubuntu-latest` within acceptable time (~1–2 min).
- Assumes the local anon + service-role keys are stable enough to read via `supabase status` in
  both local `.env.test` and CI.
- `ON DELETE CASCADE` is intentional and irreversible per delete; acceptable because child data
  carries no independent PII and is meaningless without the parent account.

## Success Criteria (Summary)

- A reviewer can confirm, via a passing automated test, that account B cannot read or write
  account A's profiles across all four operations.
- Removing any single policy from the migration turns the test red (the test genuinely guards
  the contract, not just the happy path).
- A future author can write a second compliant owned-table migration from the template + guide
  alone.
