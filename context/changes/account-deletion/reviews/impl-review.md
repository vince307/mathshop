<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Account Deletion

- **Plan**: context/changes/account-deletion/plan.md
- **Scope**: All 3 phases (full plan)
- **Date**: 2026-07-12
- **Verdict**: APPROVED
- **Findings**: 0 critical, 3 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING (one planned test never landed) |
| Scope Discipline | PASS |
| Safety & Quality | PASS (adversarial pass found no exploit) |
| Architecture | PASS |
| Pattern Consistency | WARNING (registry/docs accuracy) |
| Success Criteria | PASS (216/216 fresh-DB; check/lint/build clean, re-verified 2026-07-12) |

Security summary: the adversarial pass constructed no working exploit. Deletion target is provably the session's own id (never request input); CSRF closed (Astro default checkOrigin active + sameSite lax cookies); marker replay/fixation rejected (account-bound HMAC, constant-time); PIN throttle atomic and unraceable on the new route; admin client import-traced to one call site (deleteUser only). Gate orders match the plan line-by-line; pl.ts purely additive; migrations untouched; no plan retro-edits.

## Findings

### F1 — Planned absent-key 503 test never written

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: tests/account-deletion.test.ts
- **Detail**: The plan's phase-2 test contract required a test for `createAdminClient` returning null → route 503 (env-mock pattern of auth-env-missing.test.ts). The factory was built mockable for it (docstring says so) but the test is absent — the only account-delete branch with zero coverage.
- **Fix**: Add the absent-key 503 test using the `vi.mock("astro:env/server", …)` pattern.
- **Decision**: FIXED — absent-key 503 test added as tests/account-delete-env-missing.test.ts (file-scoped vi.mock)

### F2 — Service-role surface missing from the contract registry

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: docs/reference/contract-surfaces.md
- **Detail**: Phase 1's profile-delete surface got a registry note; phase 2's `POST /api/account/delete` + `supabase-admin.ts` factory + `SUPABASE_SERVICE_ROLE_KEY` env dependency did not. The repo's first and only production service-role surface is undocumented in the file whose purpose is exactly that.
- **Fix**: Add an account-deletion surface entry (route, admin factory, service-role key, Production-scope rule).
- **Decision**: FIXED — account-deletion service-role surface + child-profile-deletion surface entries added to contract-surfaces.md

### F3 — Stale "Production + Preview" claim for PARENT_SESSION_SECRET

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: astro.config.mjs:26, docs/reference/contract-surfaces.md (account_settings Env dependency)
- **Detail**: Both claim the secret is set on "Vercel (Production + Preview)"; phase 3 set it Production-only. Functionally safe (Preview fails closed) but misdocuments where the secret lives.
- **Fix**: Correct both to Production-only, noting Preview fails closed.
- **Decision**: FIXED — astro.config.mjs + contract-surfaces corrected to Production-only (Preview fails closed)

### F4 — Happy-path test omits the account_settings-survives assertion

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Adherence
- **Location**: tests/profile-deletion.test.ts:90-106
- **Detail**: Plan contract (b) said sibling + account_settings survive a profile delete; only the sibling is asserted.
- **Fix**: Add one `account_settings` count assertion to the happy-path test.
- **Decision**: FIXED — account_settings-survives assertion added to the profile-delete happy path

### F5 — Lost-response retry shows "wrong PIN" after a successful deletion

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: src/components/parent/DeleteAccountSection.tsx:41
- **Detail**: If the success response is lost and the parent retries, the dead session yields 401, which the island maps to wrong-PIN copy. Rare and harmless (account already gone) but misleading.
- **Fix**: Map 401 → wrongPin only when the payload reason is "wrong"; otherwise the session-expired/generic message.
- **Decision**: FIXED — 401 maps to wrongPin only when reason is "wrong"; else sessionExpired (DeleteAccountSection)

### F6 — Typed-confirmation trim asymmetry

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: src/components/parent/ConfirmDeleteDialog.tsx:54
- **Detail**: `typed.trim() === expectedText` — a stored name with trailing whitespace could never arm the button (fails safe, but surprising).
- **Fix**: Compare against `expectedText.trim()`.
- **Decision**: FIXED — dialog arms on expectedText.trim() (both sides normalized)
