<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: E2E Browser Layer (Playwright)

- **Plan**: context/changes/testing-e2e-playwright/plan.md
- **Scope**: Full plan (5 phases)
- **Date**: 2026-07-14
- **Verdict**: NEEDS ATTENTION → all findings FIXED in triage (2026-07-14)
- **Findings**: 0 critical, 3 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS (22 matches; 3 minor documented drifts) |
| Scope Discipline | WARNING (benign extras; 2 documented only in commit bodies) |
| Safety & Quality | WARNING (3 findings, none critical) |
| Architecture | PASS |
| Pattern Consistency | PASS (1 edge note) |
| Success Criteria | PASS (all Progress rows verified; CI green both jobs on d6c93d8) |

## Findings

### F1 — CI failure diagnostics are unreachable

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: .github/workflows/ci.yml:101-107 + playwright.config.ts
- **Detail**: No reporter configured → CI default is `dot`, `playwright-report/` never generated, artifact step silently uploads nothing; the on-first-retry traces land in `test-results/`, which isn't uploaded.
- **Fix**: Add CI html reporter (`open: "never"`) to playwright.config.ts and upload `test-results/` in the artifact step.
- **Decision**: FIXED — reporter config + test-results/ upload

### F2 — Thin sign-in rate-limit headroom under retries

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/config.toml:198 vs suite sign-in volume (14/clean run)
- **Detail**: 30 grants/5 min/IP; retries×flake can approach ~42; a third back-to-back local full run trips it; new specs erode margin.
- **Fix A ⭐ Recommended**: Raise `sign_in_sign_ups` in the local config (e.g. 100)
  - Strength: throwaway stack; removes the cliff; prod overrides live separately in [remotes].
  - Tradeoff: local no longer mirrors prod rate-limit behavior (nothing relies on it).
  - Confidence: HIGH. Blind spot: none significant.
- **Fix B**: Document the sign-in budget in e2e/CLAUDE.md only
  - Strength: zero config drift. Tradeoff: CI retry-storm unfixed. Confidence: MEDIUM.
- **Decision**: FIXED via Fix A — local limit 100 + explicit prod pin of 30 in [remotes.production]

### F3 — reuseExistingServer can pair a `.env` dev server with `.env.test` data

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: playwright.config.ts:52
- **Detail**: A developer's already-running `npm run dev` (from `.env`) is reused while helpers provision against `.env.test` — split-brain; if `.env` pointed at a remote project, the onboarding spec would sign up real users there with no working cleanup.
- **Fix A ⭐ Recommended**: Assert the reused server's Supabase backend matches `.env.test` at startup (globalSetup probe, fail loudly)
  - Strength: keeps fast reuse; converts split-brain into an explained error.
  - Tradeoff: a few setup lines; probe mechanism to pick. Confidence: MED. Blind spot: exact probe unverified.
- **Fix B**: `reuseExistingServer: false`
  - Strength: eliminates the class; CI already behaves so. Tradeoff: local boot cost + port conflicts. Confidence: HIGH.
- **Decision**: FIXED via Fix A — e2e/global-setup.ts backend-identity probe

### F4 — Restore-test contexts leak on mid-test failure

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: e2e/gameplay-restore.spec.ts:82-119
- **Detail**: contextA/B/C.close() inline, not in finally; a throw mid-test leaks the context for the worker's lifetime (compounds under retries).
- **Fix**: Close the contexts in the finally block.
- **Decision**: FIXED — contexts tracked and closed in finally

### F5 — Phase 3 letter-drift not recorded in the plan

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: plan.md Phase 3 vs e2e/gameplay-restore.spec.ts
- **Detail**: Gameplay merged the all-clean intent with the wrong-answer edge (no 3-star/8n assertion in that test); restore pins exact wallet via upgrades gap-copy instead of the wallet pill; the plan's "surface the wallet-pill a11y gap as a product finding" branch was never recorded. Coverage ≥ plan; deviations documented only in spec comments.
- **Fix**: Short addendum note in plan.md Phase 3.
- **Decision**: FIXED — addendum appended to plan.md Phase 3

### F6 — Sanctioned-exception gap in the rules file

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: e2e/CLAUDE.md; e2e/parent-surfaces.spec.ts:51; e2e/onboarding.spec.ts:67
- **Detail**: `clearCookies({name:"parent_verified"})` and the positional `.first()` world-tile locator aren't covered by the rules file's exception list — future generated specs may treat them as precedent.
- **Fix**: Add both as named, justified exceptions in e2e/CLAUDE.md (optionally filter-scope the world-tile locator).
- **Decision**: FIXED — closed exception list in e2e/CLAUDE.md

### F7 — Small hygiene batch

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline / Safety & Quality
- **Location**: README.md; .mcp.json:5; tests/helpers/supabase.ts:63-65
- **Detail**: `npx playwright install chromium` one-time setup missing from README (plan said README/script); `@playwright/mcp@latest` unpinned; `deleteUser` swallows all errors (not just not-found).
- **Fix**: README setup line + pin the MCP version + log non-404 teardown errors.
- **Decision**: FIXED — README e2e section, @playwright/mcp pinned 0.0.78, deleteUser logs non-404 errors
