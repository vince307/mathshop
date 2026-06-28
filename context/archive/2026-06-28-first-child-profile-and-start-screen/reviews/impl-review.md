<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: First Child Profile Wizard + Child Start Screen (S-01b)

- **Plan**: context/changes/first-child-profile-and-start-screen/plan.md
- **Scope**: Full plan (Phases 1–5)
- **Date**: 2026-06-28
- **Verdict**: APPROVED (after triage)
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | WARNING |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Two independent sub-agents cleared the highest-risk path: the create-profile write derives `account_id` only from the network-validated `getUser()` session (the zod schema doesn't even accept `account_id`; the spoof test proves a client-supplied value is dropped), child-name PII is rendered only as auto-escaped text (never `set:html`, enforced by an error-level lint rule), never logged, never placed in a URL/redirect. The migration's new columns correctly inherit the four existing RLS policies. No drift across all 22 surfaces; both approved deviations (4 mockup avatars, parent signout) present. Success criteria: lint ✓, build ✓, migration applies ✓, 35/35 tests ✓.

## Findings

### F1 — env-missing routes every parent into the wizard

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (reliability)
- **Location**: src/pages/app.astro:11-13
- **Detail**: When `createClient` returned null (env missing), `count` defaulted to 0, routing every parent into `/app/new-profile` instead of signalling unavailability. (Mostly defensive — middleware already redirects env-missing `/app` to signin.)
- **Fix**: When `supabase` is null, redirect to `/auth/signin` (which renders the missing-config banner), matching the auth routes.
- **Decision**: FIXED — `if (!supabase) return Astro.redirect("/auth/signin")` added.

### F2 — .astro type-checked lint disabled with no astro check in CI

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture (type-safety net)
- **Location**: eslint.config.js + .github/workflows/ci.yml
- **Detail**: The approved ESLint change disabled type-aware rules for all `.astro` files; verified `astro check`/tsc ran nowhere (CI = lint+build+test; `astro build` doesn't type-check `.astro`), so `.astro` frontmatter type errors shipped unguarded.
- **Fix**: Installed `@astrojs/check`, added a `check` (`astro check`) npm script + a CI step (after `astro sync`). Made it green: excluded gitignored `assets/` from tsconfig (4 pre-existing vendor-cruft errors) and added explicit `AstroCookies` casts to two pre-existing test helpers (`auth-confirm`, `auth-routes`). `astro check` now reports 0 errors.
- **Decision**: FIXED (Fix A).

### F3 — Stale "carries no child PII" line in contract-surfaces.md

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: docs/reference/contract-surfaces.md:11
- **Detail**: The one-line summary still read "carries no child PII", contradicting line 15's D1 override note.
- **Fix**: Updated the summary to record the consciously-collected, RLS-isolated `name`/`age` PII.
- **Decision**: FIXED.

## Triage summary

- **Fixed**: F1 (env-missing redirect), F2 (astro check wired into CI + made green), F3 (contract-surfaces summary)
- Post-triage verification: `astro check` 0 errors, lint clean, build green, 35/35 tests pass.
- Verdict after fixes: **APPROVED** — clean to archive.
