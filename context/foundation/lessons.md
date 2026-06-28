# Lessons

Recurring rules and pitfalls surfaced during implementation and review. Treat each as a prior when planning, implementing, and reviewing.

## L-001: Every account-owned table ships RLS in the same migration

**Rule:** When you add a Supabase table holding account-owned data, enable row-level security and define four per-operation policies (SELECT / INSERT / UPDATE / DELETE), all `to authenticated`, all predicated on `auth.uid() = account_id`, **in the same migration file**. Owner column is `account_id uuid not null references auth.users(id) on delete cascade`. Ship a cross-account isolation test and register the surfaces in `docs/reference/contract-surfaces.md`.

**Why:** Per-account isolation is the project's highest-risk correctness invariant (PRD FR-012 / FR-015; `CLAUDE.md`). A wrong or missing policy is a _silent data leak, not a crash_ — nothing fails loudly, so only an explicit isolation test catches it. Splitting table creation and policies across migrations opens an unprotected window.

**How to apply:** Copy `docs/reference/rls-template.sql`; follow `docs/reference/rls-isolation.md`; model the test on `tests/child-profiles-isolation.test.ts`. INSERT uses `with check` (not `using`); UPDATE uses both. Established by Foundation F-01 (`per-account-isolation-contract`).

## L-002: Test the row didn't persist — don't trust a chained `.select()` for INSERT-isolation

**Rule:** When testing that a user **cannot insert a row owned by someone else**, do the insert **without** a chained `.select()` read-back, and verify with a service-role (RLS-bypassing) client that **no such row was actually written**. Asserting only on a client-visible error is not enough.

**Why:** Chaining `.select()` onto the insert makes PostgREST try to return the new row, which the **SELECT** policy hides from the acting user — producing an error regardless of whether the INSERT `with check` is correct. So the assertion passes even against a broken INSERT policy (a false green). Caught during F-01 by the policy-removal meta-check: weakening INSERT `with check` to `true` left the suite green until the readback was removed and replaced with an admin-side existence check.

**How to apply:** For INSERT-isolation, assert (a) the acting user's insert returns an RLS error, and (b) a service-role query finds zero on-behalf rows. More generally: when verifying a write was blocked, check the durable state, not just the API response. Always run a meta-check — temporarily break a policy and confirm the test goes red.

## L-003: All user-visible strings come from the i18n dictionary — no inline literals

**Rule:** Every user-facing string in `.astro` templates and React islands must be sourced from `src/i18n` (`t.*`) — including scaffold/chrome surfaces like `Topbar.astro` and `Welcome.astro`. No hardcoded literals in markup. v1 is Polish-only (PRD FR-013) and a future locale must be addable by swapping the dictionary, not editing components.

**Why:** Inline literals (e.g. Topbar's "Sign in" / "Sign out" / "App", Welcome's "a cosmic developer experience") silently break the single-source-of-truth localization contract and visually clash with the localized product. They pass review because they're pre-existing scaffold, then leak into shipped UI. Surfaced during the matmaverse-design-system review: the new auth surfaces are fully i18n'd, but sibling scaffold files still carry English literals.

**How to apply:** When touching or adding any component that renders text, route every string through `t` in `src/i18n/pl.ts`. Grep new/edited `.astro`/`.tsx` for quoted human-readable text before commit. Localize chrome too — don't leave English literals. Applies to all `.astro`/`.tsx` files that render user-visible text.
