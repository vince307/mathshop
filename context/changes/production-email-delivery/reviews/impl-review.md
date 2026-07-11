<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Production Email Delivery

- **Plan**: context/changes/production-email-delivery/plan.md
- **Scope**: Both phases (full plan)
- **Date**: 2026-07-11
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING (test fallback was plan-sanctioned) |
| Scope Discipline | PASS |
| Safety & Quality | WARNING (security posture clean) |
| Architecture | PASS |
| Pattern Consistency | PASS (2 observations) |
| Success Criteria | PASS (re-verified 2026-07-11: check/lint/build green, 204/204 fresh-DB) |

Verified: `[remotes.production]` matches the planned contract value-for-value; base config pure append (manual confirmations flip netted zero); template body byte-identical; zero i18n diff; corrective drift-pins commented; all NOT-doing guardrails held; no secrets in diff or git history (.env never committed, .gitignore covers it); TOML nesting proven by idempotent push; no contract retro-edits.

## Findings

### F1 — Push-safety gotchas live only in change.md, not the operator docs

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: README.md:128 (+ supabase/config.toml:434-435)
- **Detail**: A future `config push` from a shell without `BREVO_SMTP_USER`/`BREVO_SMTP_KEY` exported could push empty SMTP credentials and silently break production email; and the CLI auto-confirms when stdin is not a TTY, so the diff-review gate vanishes under scripts. Recorded only in change.md.
- **Fix**: One sentence in README's Production bullet: export both vars before ANY config push; run only from an interactive terminal (non-TTY stdin auto-confirms).
- **Decision**: FIXED — push-safety rules (export both vars; interactive-terminal-only, non-TTY auto-confirms) added to README production bullet

### F2 — change.md phase-2 record still says "Blocked on Brevo activation"

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/production-email-delivery/change.md:28-30
- **Detail**: The runbook record ends "Blocked … once Brevo activates" while the commits/issues show the proof passed — internally contradictory narrative for future readers.
- **Fix**: Append: "Resolved 2026-07-10: Brevo activated SMTP; production proof passed end-to-end; MAT-15/#15 closed."
- **Decision**: FIXED — resolution addendum appended (Brevo activated same day; proof passed; MAT-15/#15 closed)

### F3 — resendFailureMessage exported from a route file (no precedent)

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/auth/resend.ts:16
- **Detail**: Sibling routes export only prerender + handler; error→copy mapping conventionally lives in src/lib/auth-errors.ts. Docstring justifies the locality; moving it would keep the rate-limit signal set in one file.
- **Fix**: Move to auth-errors.ts, or accept as-is.
- **Decision**: FIXED — resendFailureMessage moved to src/lib/auth-errors.ts beside mapAuthError; route + test imports updated

### F4 — Route-level test exercises the pre-flight branch, not the mapper

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: tests/auth-routes.test.ts:148-161
- **Detail**: The missing-email test returns before resendFailureMessage runs; disclosed in the test comment; unit test + live manual throttle (gate 1.6) make combined coverage sound.
- **Fix**: Accept as-is (recommended).
- **Decision**: ACCEPTED — combined coverage (unit test + live manual throttle) is sound and honestly documented

### F5 — "Inbucket" naming vs the CLI's actual "Mailpit"

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Adherence
- **Location**: README.md:126, supabase/config.toml:99
- **Detail**: Config section is [inbucket] (CLI warns deprecated → [local_smtp]); the running service reports as Mailpit; docs say Inbucket. Cosmetic drift inherited from the plan.
- **Fix**: Accept, or mention Mailpit parenthetically in README.
- **Decision**: FIXED — README now says "local test inbox (Mailpit)"
