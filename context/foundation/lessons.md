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

## L-004: Meta-check the deliberate break — verify it proves what it appears to

**Rule:** After running a deliberate break (breaking what a test protects and watching it go red), ask a second question: **does this break prove what it seems to?** If the break leaves the suite green, the break is the wrong one — find the break that actually removes the protection. If the break is one nobody would ever plausibly introduce, the test may still certify nothing. Record what you broke, what went red, and why that redness is evidence for that specific claim.

**Why:** A test whose only failure mode is an implausible edit is a decorative test wearing a quality certificate. Surfaced in `world-selection-screen`: deleting the `resolveActiveProfile` gate left **6/6 isolation tests green**, because RLS blocks that path on its own — so that break proved nothing about the gate. Only swapping in a service-role (RLS-bypassing) client turned the foreign-`profileId` test red, which is what demonstrates the test bites on a real loss of scoping. Without the second-order check the run would have shipped an untested gate behind six passing tests. The same shape appeared in `world-progression-stages`: the plan contracted a `document.documentElement.scrollWidth` assertion for bottom-bar overflow, and because the bar is `position: fixed` the bar overflowed by 96px while the document measurement stayed perfectly clean — **the contracted assertion could not catch the contracted risk**, and only running the break revealed it.

**How to apply:** For every break, name (a) what you broke, (b) what went red, and (c) _why that redness is evidence for this specific claim_. When a boundary has more than one layer of protection (RLS **and** an application gate), break the layer under test specifically and bypass the other — defence in depth is only demonstrated by testing the layers independently. When a plan hands you an assertion, verify it measures the element that actually carries the risk before accepting it as coverage. Related: L-002, the same failure at the policy level; L-009, the case where the break stays green.

**Most recent instance:** `e2e-dev-toolbar-intercepts-touch-nav` (2026-08-29), which is this lesson applied to a whole change. Its Phase 3 broke the two protective layers separately — the global-setup probe was neutralised so that re-enabling Astro's dev toolbar tested the _spec_ rather than the probe — and the resulting call log is the evidence: `element is visible, enabled and stable` (the three assertions that were there before, all green) immediately followed by `<astro-dev-toolbar> intercepts pointer events`. Same change, Phase 2: a break was run through both signals at once, Playwright reporting `exit 0` with fewer tests while the new unit guard went red on the identical tree.

## L-008: Strip data that looks like code before the review model sees it

**Rule:** The AI review gate reads a unified diff and nothing else. Any file whose _content_ is itself a diff — an eval fixture, a captured patch, review evidence — must be removed by the pre-filter in `packages/code-reviewer/noise.ts` before the model is called. When you commit a new class of file that carries code-shaped content as data, ask the test: _would this file's content be misread as change if the reviewer only saw the diff?_ If yes, it belongs in `isNoise`, alongside lockfiles and `context/**`.

**Why:** A diff-only reviewer has no way to tell input data from the change under review — the fixture and the PR look identical on the wire. This has now blocked merges twice on this repo, each time forcing a documented admin bypass. On PR #24 both models were fooled through their _strongest_ lens: Haiku raised criterion-6 blockers demanding env-var sync for variables that existed only inside the fixture files (conceding in its own summary that they were "intentional test cases" and blocking anyway), while Sonnet raised a criterion-5 blocker on an HMAC fail-open embedded in a fixture, reasoning that "the fixture embeds real production code paths that ship with this PR." Two models, two different lenses, same false positive — which is the evidence that this class cannot be fixed with prompt wording or a better model. It is a pre-filter problem. A gate that is routinely bypassed stops being a gate, and each bypass also teaches the team that red means "probably wrong again".

**How to apply:** Add the class to `isNoise` in `packages/code-reviewer/noise.ts` (kept separate from `review.ts` precisely so it is importable and testable — `review.ts` runs `main()` at module top level). Then update **both** prose strings in `review.ts` that enumerate the stripped classes — the system prompt's "pre-filtered" rule and the nothing-to-review message — or the model is told an incomplete list and the confusion returns in a weaker form. Prove it offline in `tests/review-noise.test.ts`: assert the new class strips **and** that a near-miss survives (`foo.diff.ts` is code, `foo.diff` is data), because over-stripping is the worse failure — a gate that silently passes everything is indistinguishable from one that works. Established by `review-fixture-noise-strip`; end-to-end evidence in that change's `evidence/replay-5dee0cb.md`.

**What you give up:** stripping is not free — the stripped file is now reviewed by nobody. That is the right trade when the content is inert, but the eval fixtures are _not_ inert: `promptfooconfig.yaml` feeds them verbatim as the prompt to a model, and `generate-fixtures.mjs` is one-shot ("fixtures outlive their git sources"), so they are the source of truth and nothing checks them against their source commits. A fixture carrying prompt-injection text would land unreviewed. Accepted because this is dev tooling with no production path, evals run manually, and fork PRs are skipped by the gate — but **review a new or edited fixture by hand**, and revisit this if fixtures ever feed anything that runs.

## L-009: A check that can pass without the thing it checks is decorative — verify the _path_, not the _fact_

**Rule:** When a check asks "does X work here?", make it prove _where_ — compare what was resolved against the thing that is supposed to own it. A check that merely asks "did it find something?" will happily certify the wrong thing. Ask "did it find _this_ one?" The same applies to a measurement: before trusting a number, confirm it is capable of coming out wrong.

**Why:** `worktree-bootstrap.sh` canaried a fresh worktree by asking whether `astro` resolved from inside it. It always did — **including on a completely empty `node_modules`** — because Node's resolver walks _up_ the directory tree, and worktrees live under `$ROOT/.claude/worktrees/`, so resolution silently succeeded against the parent repo's install. The same upward walk fooled the older `vitest list` count canary: main and worktree both collected 444 tests with nothing installed locally. Two runs shipped on a bootstrap check that validated nothing about the thing it was written to validate. It was found only by deliberately breaking it (L-004) and noticing it stayed green.

**How to apply:** Assert the resolved absolute path sits under the directory that should own it:

```sh
RESOLVED="$(cd "$WT" && node -e "console.log(require.resolve('astro'))")"
case "$RESOLVED" in "$WT_ABS"/node_modules/*) ;; *) exit 1 ;; esac
```

Generalises well past module resolution: `$PATH` lookups, config discovery, `.env` loading and git config all search upward or fall back to a global. For assertions, pair every "the bad thing is absent" check with a positive control proving the apparatus is live — a regex that matched nothing would satisfy every rejection test you can write.

**Most recent instance:** `e2e-dev-toolbar-intercepts-touch-nav` (2026-08-29), where it bit one level below where anyone had looked. The nav-truncation assertion had a positive control confirming the clipping element _existed_ — six of them — and that control passed. The number measured on it was nonetheless pinned at zero by construction (`flex-col items-center` sizes the label to its own content), so a **315px label inside a 116px tab reported 0 overflow and the test passed**. The apparatus was live and the measurement was still decorative. Fixed by measuring the label against the tab's content box, and confirmed falsifiable in both directions before landing.
