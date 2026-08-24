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
## L-008: Strip data that looks like code before the review model sees it

**Rule:** The AI review gate reads a unified diff and nothing else. Any file whose *content* is itself a diff — an eval fixture, a captured patch, review evidence — must be removed by the pre-filter in `packages/code-reviewer/noise.ts` before the model is called. When you commit a new class of file that carries code-shaped content as data, ask the test: *would this file's content be misread as change if the reviewer only saw the diff?* If yes, it belongs in `isNoise`, alongside lockfiles and `context/**`.

**Why:** A diff-only reviewer has no way to tell input data from the change under review — the fixture and the PR look identical on the wire. This has now blocked merges twice on this repo, each time forcing a documented admin bypass. On PR #24 both models were fooled through their *strongest* lens: Haiku raised criterion-6 blockers demanding env-var sync for variables that existed only inside the fixture files (conceding in its own summary that they were "intentional test cases" and blocking anyway), while Sonnet raised a criterion-5 blocker on an HMAC fail-open embedded in a fixture, reasoning that "the fixture embeds real production code paths that ship with this PR." Two models, two different lenses, same false positive — which is the evidence that this class cannot be fixed with prompt wording or a better model. It is a pre-filter problem. A gate that is routinely bypassed stops being a gate, and each bypass also teaches the team that red means "probably wrong again".

**How to apply:** Add the class to `isNoise` in `packages/code-reviewer/noise.ts` (kept separate from `review.ts` precisely so it is importable and testable — `review.ts` runs `main()` at module top level). Then update **both** prose strings in `review.ts` that enumerate the stripped classes — the system prompt's "pre-filtered" rule and the nothing-to-review message — or the model is told an incomplete list and the confusion returns in a weaker form. Prove it offline in `tests/review-noise.test.ts`: assert the new class strips **and** that a near-miss survives (`foo.diff.ts` is code, `foo.diff` is data), because over-stripping is the worse failure — a gate that silently passes everything is indistinguishable from one that works. Established by `review-fixture-noise-strip`; end-to-end evidence in that change's `evidence/replay-5dee0cb.md`.
