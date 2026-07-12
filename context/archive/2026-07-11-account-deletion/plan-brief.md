# Account Deletion — Plan Brief

> Full plan: `context/changes/account-deletion/plan.md`
> Research: `context/changes/account-deletion/research.md`

## What & Why

Parents currently have no way to delete a child profile or their account. MathShop is an EU app whose child rows carry real PII (name + age), so account deletion is the GDPR right-to-erasure surface — a pre-launch must (Linear MAT-17 / GitHub #17). Profile deletion is also the "cleanup is a future slice" explicitly promised by the archived multi-profile-picker plan.

## Starting Point

The database was *designed* for this: every FK cascades from `auth.users` (a documented F-01 right-to-erasure decision), all tables have DELETE policies, and test teardowns already prove `deleteUser` + cascade works. The parent-PIN gate (marker + scrypt + throttle) exists; profile routing already degrades gracefully when a profile vanishes. What's missing: any deletion path in `src/`, any production service-role usage, any confirmation dialog, and any *positive* deletion tests.

## Desired End State

On the PIN-gated report page: "Usuń profil" per child (typed child-name confirmation; shift history cascades, cap slot freed, graceful landing even at 0 profiles) and a danger-zone "Usuń konto" (typed email + fresh PIN; one admin `deleteUser` erases everything, signs out, Polish farewell). Cross-account deletion impossible — proven by durable-state tests.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Account-delete re-auth | Marker + **fresh PIN entry** | Closes the 15-min stale-marker window with existing machinery; soft-gate residual accepted | Plan |
| Delete mode | **Hard delete** | True erasure in one proven operation; soft-delete keeps PII and needs purge infra | Plan |
| Last profile | **Deletable** | Erasure semantics honest; 0-profile state already degrades to the wizard | Plan |
| Confirmation UX | **Typed confirmation** (child name / account email) | Strongest guard for a no-undo action; forces conscious target selection | Plan |
| UI placement | **Report page** (danger zone) | Reuses the only PIN-gated page; smallest PRD-non-goal delta | Plan |
| Privilege model | RLS client authenticates; admin client does exactly one `deleteUser(session id)` | The two-plane discipline research identified as the failure mode to guard | Research |
| Gate pattern | `verifyMarker` re-checked in every new route | Binding lesson from the PIN impl-review (destructive actions never open to any authed session) | Research |

## Scope

**In scope:** `deleteChildProfile` service + `/api/profiles/delete` · admin-client factory + `SUPABASE_SERVICE_ROLE_KEY` env schema · `/api/account/delete` (marker + fresh PIN + typed email) · first confirmation-dialog component · report-page actions + danger zone · Polish `deletion:` copy · positive-delete + full-erasure tests (L-002 read-backs) · Vercel secrets (incl. fixing the missing `PARENT_SESSION_SECRET` prod gap) · production proof.

**Out of scope:** soft delete/undo · data export · forgot-PIN recovery · profile editing · a settings page · password re-verification · schema changes · audit log.

## Architecture / Approach

Phase 1 uses only existing privileges (RLS delete; cascade does the rest) — service → route → dialog → tests. Phase 2 adds the second privilege plane behind strict ordering (503→401→403→400→PIN-throttle→email-check→one admin call→signout-style cleanup). Phase 3 is ops: two Production-scoped Vercel secrets, deploy, throwaway-account proof on prod.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Profile deletion e2e | Working PIN-gated profile delete + first positive-delete tests | Dialog is the repo's first — UX pattern set here |
| 2. Account deletion e2e | Service-role plane + full-erasure route/UI/tests | Privilege-plane mixing (mitigated by strict route ordering) |
| 3. Ops + prod proof | Secrets, deploy, prod verification, MAT-17/#17 closed | Prod PIN gate was never live (`PARENT_SESSION_SECRET` missing) — first real exercise |

**Prerequisites:** local Supabase stack; Vercel + Supabase dashboard access for phase 3 secrets (maintainer-run).
**Estimated effort:** ~2 sessions (phase 1 ≈ one session; phases 2+3 ≈ one).

## Open Risks & Assumptions

- The PIN remains a soft gate (no child-vs-parent identity) — fresh-PIN re-auth narrows but doesn't eliminate it; accepted.
- PRD lists parent settings-UI as a non-goal; MAT-17 is the maintainer's deliberate override — recorded here as the PRD delta.
- Phase 3 enables the prod PIN gate for the first time; if `PARENT_SESSION_SECRET` handling surprises in prod, the report page (existing feature) is affected too — verify early in the phase.

## Success Criteria (Summary)

- A parent can delete a chosen child's profile (typed confirmation) and the child's data is durably gone; the app degrades gracefully at any remaining-profile count.
- A parent can delete their entire account (typed email + fresh PIN) and every trace — auth user, profiles, history, settings — is durably erased, verified in production.
- Cross-account deletion attempts remain impossible, proven by durable-state tests.
