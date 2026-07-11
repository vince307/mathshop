---
change_id: account-deletion
title: Delete child profile + delete parent account (GDPR erasure)
status: implemented
created: 2026-07-11
updated: 2026-07-11
archived_at: null
---

## Notes

Tracked as **Linear MAT-17** / **GitHub #17**. Gap: no way to delete a child profile or the parent account. EU app collecting a parent email → account deletion is the GDPR right-to-erasure surface; the PRD privacy stance ("the only personal data collected is the parent's email") makes a clean deletion story a pre-launch must.

**Two halves, one data-lifecycle story (plan should phase them):**

1. **Child-profile deletion** (likely phase 1, TDD-friendly): parent-zone (PIN-gated — PIN + `pin_failure_throttle_rpc` shipped in S-09-era work) action deleting a `child_profiles` row. The L-001 contract already provides per-operation RLS DELETE policies and `on delete cascade` FKs — research must confirm cascade coverage across ALL owned tables (`child_profiles`, `shift_log`, `account_settings`) and what happens to the profile-picker / start-screen when the active profile disappears. Edge case to decide in plan: deleting the last remaining profile (app assumes ≥1 post-onboarding).
2. **Parent account deletion** (phase 2, carries the security decision): Supabase has no self-serve user-delete — requires the **admin API with the service-role key**, which production does NOT currently hold (Vercel env has anon key only; verified 2026-07-09). Needs: `SUPABASE_SERVICE_ROLE_KEY` added to Vercel env (Production-scoped only — infrastructure.md flags it as the most sensitive value), declared in `astro:env/server` schema, and a hardened server route that uses it for exactly this operation. Once the auth user is deleted, L-001 cascades erase all owned rows; sessions must be invalidated.

**Open product decisions for /10x-plan (maintainer):** hard delete immediately vs grace period; re-auth (password) and/or PIN before the destructive action; confirmation UX (type email? double confirm?); last-profile semantics; what the signed-out farewell state says (Polish, FR-013).

**Verification bar (lessons L-001/L-002 apply in force):** prove rows are durably GONE via service-role read-back after deletion (not just an OK response); prove account B cannot delete account A's profile/account (negative test, durable-state check); RLS DELETE policies already exist — the tests exercise them for real this time. All new user-visible strings via `t.*` (L-003).

**Likely out of scope (plan to confirm):** data export (GDPR portability) — separate change; admin/support tooling; un-delete.
