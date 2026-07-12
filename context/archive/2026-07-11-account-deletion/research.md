---
date: 2026-07-11T11:56:56+02:00
researcher: Claude (Fable 5)
git_commit: 3c891f38ea8438fee20502a6385a06863fd64331
branch: main
repository: mathshop
topic: "Account deletion: delete child profile + delete parent account (GDPR erasure) — MAT-17 / GH #17"
tags: [research, codebase, rls, cascade, parent-pin, service-role, gdpr, supabase-auth]
status: complete
last_updated: 2026-07-11
last_updated_by: Claude (Fable 5)
---

# Research: Account deletion (child profile + parent account, GDPR erasure)

**Date**: 2026-07-11T11:56:56+02:00
**Researcher**: Claude (Fable 5)
**Git Commit**: 3c891f38ea8438fee20502a6385a06863fd64331
**Branch**: main
**Repository**: mathshop

## Research Question

What exists, what's missing, and what constrains implementing (1) child-profile deletion and (2) parent-account deletion, per `change.md` (Linear MAT-17 / GitHub #17)? Specifically: cascade/RLS readiness, parent-zone gating mechanics, service-role architecture, session behavior on deletion, and binding decisions from the PRD and archived changes.

## Summary

**The database layer is completely deletion-ready — zero blockers.** All FKs in all nine migrations are `ON DELETE CASCADE`; every table carries the L-001 four-policy set including a working `DELETE … using (auth.uid() = account_id)` policy; no triggers/views fight deletion. The cascade was a *deliberate, documented right-to-erasure design decision* from F-01. Profile deletion is even pre-named as "a future slice" in the archived multi-profile-picker plan — this change is that slice.

**Profile deletion (phase 1) is a plain RLS operation** — `delete from child_profiles where id = ?` on the request-scoped client; `shift_log` cascades via `profile_id`; the app's profile-resolution paths already degrade gracefully to picker/wizard/empty-state when a profile vanishes (including the 0-profile state). **Account deletion (phase 2) requires the service-role admin API** (`auth.admin.deleteUser`) — the first service-role usage in `src/` ever; the env schema, Vercel Production-scoped secret, and an admin-client factory must be added, and the route must verify identity through the RLS client *before* any admin call. Deleting the auth user cascades everything (including `auth.sessions` — refresh tokens die instantly; middleware already handles stale cookies with a clean redirect, but never clears them, so the route must do signout-style cleanup itself).

**The security gate already exists and its lessons are binding**: the parent-PIN `parent_verified` HMAC marker (15-min TTL) gates the report page and PIN-reset, and the archived impl-review's "destructive action must not be open to any authed session" lesson applies verbatim. Known caveats: the PIN is a soft gate (no child-vs-parent identity), `PARENT_SESSION_SECRET` unset would allow marker forgery (fail-closed code exists but prod env must be verified), and forgot-PIN recovery was never designed.

**One product-level tension to record**: the PRD lists parent "settings UI" as an MVP non-goal; a deletion surface expands past the stated parent surfaces. The maintainer has effectively overridden this by commissioning MAT-17 — the plan should record that as a PRD delta, strengthened by the fact that child rows now carry real PII (name + age, a deliberate S-01b override), so erasure removes actual personal data.

## Detailed Findings

### 1. Database: cascade graph, RLS, and the erasure contract

Three application tables, one FK topology (all `ON DELETE CASCADE`, zero RESTRICT anywhere):

```
DELETE auth.users row                        DELETE child_profiles row
  ├→ child_profiles (account_id)               └→ shift_log (profile_id)
  │    └→ shift_log (profile_id)             Survives: account_settings (PIN),
  ├→ shift_log (account_id)                    sibling profiles, auth.users
  ├→ account_settings (account_id)
  └→ auth.sessions (auth schema)             ⇒ profile delete = 1 RLS statement
  ⇒ FULL erasure, nothing survives
```

- FK sources: `child_profiles.account_id` (`20260609120000:53`), `shift_log.account_id`+`.profile_id` (`20260701150000:23-24`), `account_settings.account_id` PK=FK (`20260701160000:22`).
- DELETE policies exist on all three tables: `child_profiles_delete_own` (`20260609120000:97-101`), `shift_log_delete_own` (`20260701150000:59-63`, flat `account_id` predicate — no join needed), `account_settings_delete_own` (`20260701160000:62-66`).
- FK-driven cascades bypass RLS (FK machinery), so a parent deleting their own profile cascades shift_log regardless of the caller's policies.
- No counter triggers: `wallet_balance`/`completed_shift_count`/`business_level`/`skill_state` are app-maintained columns *on* the profile row — they die with it; nothing recomputes from shift_log.
- The cascade rationale is an accepted, binding design record: "deleting a parent erases their child data (right-to-erasure friendly)" (`docs/reference/rls-isolation.md:13`; archived F-01 `plan-brief.md:35,76` — "intentional and irreversible per delete").
- **PII stakes rose since F-01**: `name` + `age` on child_profiles are "consciously-collected child PII (a deliberate S-01b override of the PRD no-PII guardrail)" (`docs/reference/contract-surfaces.md:11`) — erasure now removes real personal data, not just game state.

### 2. Test coverage: negative-only today

Every table has a DELETE *isolation* test (cross-account delete affects 0 rows): `tests/child-profiles-isolation.test.ts:137-154`, `tests/shift-log-isolation.test.ts:107-123`, `tests/account-settings-isolation.test.ts:86-102`. **No test asserts a same-account DELETE succeeds**, that profile deletion cascades shift_log, or that `deleteUser` cascades all three tables (teardown assumes it, never asserts counts). The binding invariant to preserve: test-plan Risk #1 — cross-account DELETE stays blocked on every table (`test-plan.md:60`). Phase-1 TDD has a clear target: positive-delete + cascade-count + isolation-preserved tests, with L-002 discipline (service-role read-back proves rows durably gone).

### 3. Parent-zone gate mechanics (phase 1's UI home + the destructive-action gate)

- The parent zone is exactly two routes: `/app/parent-pin` (gate) and `/app/report` (only PIN-protected surface). Page-level gate pattern: `report.astro:25-26` — `if (!user || !verifyMarker(marker, user.id)) redirect("/app/parent-pin")`. API-level gate pattern: `api/parent/pin/set.ts:31-34` — overwrite requires valid marker, else 403.
- Marker: `parent_verified` HMAC-SHA256 cookie (`accountId.expiresAt.sig`), `PARENT_SESSION_SECRET`-signed, **15-min TTL**, constant-time verify (`src/lib/services/parent-pin.ts:134-174`). PIN: 4–6 digits, scrypt `salt:hash`, 5-attempt/60s atomic throttle via `register_pin_failure()` RPC (security invoker, self-pinned to `auth.uid()`).
- **Middleware does NOT check the PIN** — any new deletion route/page must re-check `verifyMarker` itself (the archived PIN impl-review's binding lesson: a destructive mutation must not be open to any authed session — a child on the parent's device is the threat model).
- Binding caveats: PIN is a *soft* gate (`plan-brief.md:61` of skill-path-upgrade-gate); `PARENT_SESSION_SECRET` is `optional:true` — code fails closed, but if unset in prod, markers can't be minted at all (and an earlier `?? ""` variant was flagged as a forge risk — verify prod env has it set); forgot-PIN recovery does not exist.
- Natural UI home: per-child "delete profile" action on each `WeeklyReport` ChildSection card; "delete account" at the bottom of `report.astro` or a new sibling page behind the same marker check. **No confirmation-dialog pattern exists anywhere yet** (`src/components/ui/` has no dialog; no `window.confirm`) — this feature introduces the first one (`npx shadcn@latest add alert-dialog` per convention); only precedent is the `destructive` button variant.

### 4. Profile lifecycle: what happens when a profile disappears

- Active profile = httpOnly session cookie `active_profile` holding a UUID pointer; every page resolves it *inside the RLS-owned list* (`src/lib/services/active-profile.ts:56-65`), so a deleted profile's stale cookie is simply ignored — **silent redirect** to picker (2+ profiles), sole-profile start (1), or wizard/empty-state (0). `/app` router: 0 → `/app/new-profile`, no valid selection with 2+ → `/app/pick-profile` (`child-profiles.ts:87-91`).
- **The 0-profile state is already handled**: start/upgrades render `EmptyStateCard` (calm CTA into the wizard); the picker redirects rather than rendering with <2 profiles. Nothing enforces ≥1 profile — it's emergent (no delete path exists). So "allow deleting the last profile" is viable with zero extra routing work; the plan just decides the product answer.
- Cap interplay: `MAX_PROFILES_PER_ACCOUNT = 6` (route-level soft cap, documented TOCTOU); deletion frees slots and the hidden add-tiles reappear automatically (visibility is computed per-render).
- Post-deletion cleanup pattern: `signout.ts:9-24` — `supabase.auth.signOut()` (revokes refresh tokens) + delete `active_profile` + `parent_verified` cookies + no-store redirect. Account deletion must replicate all three; profile deletion should clear/reset `active_profile` if it pointed at the deleted row (or rely on the silent-degrade — plan's call).

### 5. Service-role architecture (phase 2's new ground)

- **No service-role usage exists in `src/` today** — only tests. The proven admin pattern: `tests/helpers/supabase.ts:33-35` — plain `@supabase/supabase-js` `createClient(url, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })`; `admin.auth.admin.deleteUser(id)` at `:63-65` with cascade note. Test discipline worth importing: service-role only for the admin operation, never to act as the user (RLS bypass).
- Env wiring: add `SUPABASE_SERVICE_ROLE_KEY` as a fourth `envField.string({ context: "server", access: "secret", optional: true })` in `astro.config.mjs:21-30` (mirroring `PARENT_SESSION_SECRET`'s comment + fail-closed consumer); new factory in `src/lib/` returning null when unset (503 path), imported from `astro:env/server` — never `process.env`/`import.meta.env`. **Vercel: Production scope ONLY** — `infrastructure.md:82` singles the service key out ("the most sensitive value — keep it Production-scoped only"); rotation is human-gated (`:84`). Ops step: `vercel env add SUPABASE_SERVICE_ROLE_KEY production`.
- Endpoint template = the two strictest existing routes combined: `api/parent/pin/set.ts` (JSON + `applyNoStore` + zod + 401/403 marker gate) and `api/upgrades/buy.ts` (RLS-first ownership: client sends only ids; the route reads the row *as the user under RLS* so non-owners get not-found before anything trust-bearing happens). **Critical invariant: identity/ownership is established via the RLS client and `getUser()` BEFORE any `auth.admin` call; the admin client's only job is the one `deleteUser(user.id)` — id from the session, never from the request body.**
- Status vocabulary in use: 503 no-client / 401 no-user / 403 no-marker / 400 zod / 404 RLS-not-found / 429 lockout / 500 service error.

### 6. GoTrue deletion semantics (verified against current Supabase docs)

- `auth.admin.deleteUser` requires the service-role key, server-only (docs explicitly warn never to expose it client-side).
- `auth.sessions.user_id` → `auth.users(id) ON DELETE CASCADE` — deletion kills session + refresh-token rows immediately. The already-issued JWT is stateless, but this app calls `supabase.auth.getUser()` per request in middleware (`middleware.ts:26-36`), which validates against the auth server → **deleted users are locked out on their next request**; middleware destructures `user` and ignores `error`, so a stale cookie yields `locals.user = null` and a clean 303 to signin — no 500. Middleware never clears cookies; the deletion route does its own signout-style cleanup.
- `shouldSoftDelete` (boolean, default false) exists on the SDK — sets `deleted_at` and disables the account while preserving rows, if the plan wants a grace-period variant. Note: soft-delete does NOT satisfy erasure by itself and keeps PII — if chosen, it needs a hard-delete follow-up job (likely overkill for this app; plan decides).

### 7. Product/PRD posture

- **Deletion is net-new scope**: no FR requires it; zero GDPR/RODO/erasure mentions in either PRD. Not in Non-Goals either — simply absent.
- **Tension to record**: parent "settings UI" is an explicit MVP non-goal (`prd-v3.md:161`: surfaces = sign-up, login, picker, sign-out + minimal report). A deletion surface extends this; MAT-17 is the maintainer's product decision to do so — the plan should note it as a deliberate PRD delta (and the child-PII override strengthens the GDPR case for it).
- Pre-named future slice: "No profile deletion/editing — out of FR-002's scope; … cleanup is a future slice" (`context/archive/2026-07-06-multi-profile-picker/plan.md:32`).
- Polish-only copy via `t.*` (L-003); deletion copy would fit a new top-level section beside `parentPin:`/`report:` in `src/i18n/pl.ts` (existing sections: parentPin 301-318, report 326-341).

## Code References

- `supabase/migrations/20260609120000_child_profiles_isolation.sql:53,97-101` — account FK cascade + DELETE policy
- `supabase/migrations/20260701150000_create_shift_log.sql:23-24,59-63` — dual cascade FKs + flat DELETE policy
- `supabase/migrations/20260701160000_create_account_settings.sql:22-25,62-66` — PIN row, PK=FK cascade, DELETE policy
- `src/lib/services/parent-pin.ts:87-174` — verifyPin, marker sign/verify/set (15-min TTL)
- `src/pages/api/parent/pin/set.ts:31-34` — the 403 marker gate to copy for destructive actions
- `src/pages/api/upgrades/buy.ts:10-14,29-48` — RLS-first ownership template
- `src/lib/services/active-profile.ts:33-41,56-65` — active_profile cookie + owned-list resolution (silent degrade)
- `src/lib/services/child-profiles.ts:55,87-91,191-215` — profile cap, landing-path routing, ownership-read pattern
- `src/pages/api/auth/signout.ts:9-24` — post-deletion cleanup template (signOut + both cookies + no-store)
- `src/middleware.ts:5,26-46` — locals.user resolution; clean redirect for deleted users; no cookie clearing
- `astro.config.mjs:21-30` — env schema; where SUPABASE_SERVICE_ROLE_KEY goes
- `tests/helpers/supabase.ts:33-35,63-65` — the admin-client + deleteUser pattern to productionize
- `tests/{child-profiles,shift-log,account-settings}-isolation.test.ts` — DELETE-isolation tests (negative-only today)
- `docs/reference/contract-surfaces.md:5,11` — mandatory registry; child-PII record
- `docs/reference/rls-isolation.md:13,31` — erasure-friendly cascade rule; DELETE-isolation test requirement

## Architecture Insights

- **The feature is mostly assembly, not construction**: cascade + DELETE policies + PIN gate + graceful 0-profile routing + admin-client pattern all exist; the new ground is (a) the first production service-role usage, (b) the first confirmation-dialog UI, (c) positive-delete test coverage.
- **Two privilege planes, strictly ordered**: RLS client establishes *who* and *owns-what*; admin client performs exactly one operation with an id derived from the session. Mixing these (admin reads, or request-body ids into admin calls) is the failure mode to guard in review.
- **Deletion is irreversible by design** — no undo exists and the archived F-01 decision accepts that; the confirmation UX carries the entire safety burden. The soft-gate PIN caveat argues for stacking re-auth (fresh PIN entry, not just a possibly-15-min-old marker) for account deletion specifically.

## Historical Context (from prior changes)

- `context/archive/2026-06-09-per-account-isolation-contract/plan-brief.md:35,76` — cascade = deliberate right-to-erasure design, "irreversible per delete"
- `context/archive/2026-07-06-multi-profile-picker/plan.md:32,148` — profile deletion deferred as "future slice"; MAX_PROFILES_PER_ACCOUNT=6 soft cap (TOCTOU accepted)
- `context/archive/2026-07-01-skill-path-upgrade-gate/plan.md:294-302` + `reviews/impl-review.md:23-47,59-71` — PIN spec (4–6 digits, scrypt, throttle RPC) and the binding lessons: destructive actions marker-gated; empty-secret forge risk; throttle TOCTOU fix
- `context/archive/2026-07-07-cross-device-economy-restore/plan.md:32,91` — signout cookie hygiene; "No PIN/GDPR/session-revocation rework" left as unbuilt scope
- `context/foundation/test-plan.md:60` — Risk #1 cross-account DELETE isolation invariant

## Related Research

- `context/changes/account-deletion/change.md` — change brief (Linear MAT-17 / GitHub #17)
- `context/archive/2026-07-10-production-email-delivery/research.md` — env/Vercel wiring patterns reused here

## Open Questions

(For `/10x-plan`'s AskUserQuestion rounds — none block planning.)

1. **Re-auth strength for account deletion**: valid 15-min marker (pin/set.ts parity) vs **fresh PIN entry immediately before** (recommended given the soft-gate caveat) vs password re-entry. Profile deletion probably rides the marker.
2. **Hard vs soft delete for the account**: hard `deleteUser` (recommended — true erasure, cascade proven) vs `shouldSoftDelete` grace period (keeps PII; needs a purge job; likely overkill).
3. **Last-profile deletion**: allow (0-profile state already degrades gracefully to the wizard) vs block with "delete the account instead" copy.
4. **Confirmation UX**: dialog with typed confirmation (child-name for profile, email for account?) vs double-tap confirm; introduces the repo's first alert-dialog component.
5. **UI placement**: actions on the report page (smallest surface) vs a new `/app/settings` parent page (cleaner long-term, bigger PRD delta).
6. **PRD delta recording**: where to note the settings-UI non-goal override (plan "What We're NOT Doing" note vs a PRD addendum).
7. **Ops**: who adds `SUPABASE_SERVICE_ROLE_KEY` to Vercel (Production scope only) and verifies `PARENT_SESSION_SECRET` is actually set in prod (marker minting depends on it — check during phase 2's manual gate).
