---
date: 2026-08-13T19:54:17+0200
researcher: vince307
git_commit: 52cd6f3ee2674b3dcb8ff04fea79d3bcbcd42e63
branch: main
repository: 10xDevs
topic: "Password reset slice — recovery flow wiring, marker gate, session revocation semantics"
tags: [research, codebase, auth, password-reset, supabase, email]
status: complete
last_updated: 2026-08-13
last_updated_by: vince307
---

# Research: Password reset (recovery) slice

**Date**: 2026-08-13T19:54:17+0200
**Researcher**: vince307
**Git Commit**: 52cd6f3ee2674b3dcb8ff04fea79d3bcbcd42e63
**Branch**: main
**Repository**: 10xDevs

## Research Question

Ground the approved design (see `change.md`) before planning, and settle its three open questions:

1. Does `signOut({ scope: "others" })` work through the SSR client, and does the current session survive it?
2. Does `[auth.email.template.recovery]` need its own `subject` key?
3. How does `otp_expiry` (3600) interact with the 15-minute marker TTL?

## Summary

The design survives research intact, but three things change and one security claim needs softening.

**Settled empirically** (probes run against the local stack at this commit, then deleted):

- `signOut({ scope: "others" })` behaves exactly as the design assumed: the other device is rejected **immediately** and the acting device survives. GoTrue answers the revoked token with `403 session_not_found`. Because `src/middleware.ts:32` calls `getUser()` on **every** request, in-app lockout of the other device is immediate — no waiting for JWT expiry.
- **But** the revoked access token still authenticates to PostgREST (`200`, not `401`) until its `exp` — `jwt_expiry = 3600`, so up to an hour. RLS still scopes it to that same parent, so this is not an escalation; it means an intruder holding a stolen access token keeps *data-API* read access to that account for up to an hour after the reset, even though every *app* route bounces them at once. The spec must not claim the intruder's access "dies with the reset" without this qualifier.
- `updateUser` with an unchanged password returns the error code **`same_password`** — a case the design did not cover and a parent will hit ("I'll just set it back to what I thought it was"). Needs Polish copy.
- After the update, the old password is rejected (`invalid_credentials`) and the new one is accepted — so the durable assertions the design proposes for tests are the right ones and do hold.

**Changes to the design:**

1. `[auth.email.template.recovery]` **does** take its own `subject`, exactly like `[auth.email.template.confirmation]` (`config.toml:247-249`). Question 2 answered: subject + content_path, both required.
2. `mapAuthError` needs three new codes beyond what exists today: `same_password`, `session_expired`, `session_not_found`. (`weak_password` and `invalid_credentials` are already mapped — `src/lib/auth-errors.ts:16-20`.)
3. `otp_expiry = 3600` vs the 15-minute marker: the marker is the **shorter** of the two, so it always governs. A parent who opens the link and dawdles past 15 minutes still holds a valid *session* but a dead *marker* — so they must land on "poproś o nowy link" rather than a generic failure. The recovery token itself is single-use and consumed by the confirm hop, so "request a new link" is genuinely the only recovery. Question 3 answered.

## Detailed Findings

### The confirm route already does most of the work

`src/pages/api/auth/confirm.ts:12` whitelists `recovery` in `EMAIL_OTP_TYPES` — no change needed to accept the link. The route also carries the open-redirect hardening (`safeNext`, `confirm.ts:31-36`: rejects `//`, `/\`, and ASCII control chars) and is covered by `tests/auth-confirm.test.ts`. The only extension needed is minting the marker when `type === "recovery"`.

The official Supabase recovery template shape is
`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/account/update-password`
— identical in structure to what `supabase/templates/confirmation.html:15` already does, with our route at `/api/auth/confirm`. So `recovery.html` is a near-copy of the existing template with `type=recovery`.

### Marker pattern to copy

`src/lib/services/parent-pin.ts` is the model:

- `PARENT_VERIFIED_COOKIE = "parent_verified"` (`:15`), `MARKER_TTL_MS = 15 * 60_000` (`:17`)
- payload `${accountId}.${exp}` signed with HMAC-SHA256 (`:138`)
- `verifyMarker` checks account match, expiry, and signature in constant time, and fails closed when the secret is missing (`:148-159`)

The design's **domain separation** (`pwreset:${accountId}:${exp}`) is a genuine requirement, not ceremony: both markers would otherwise share one secret *and* one signature space, making a `parent_verified` cookie replayable as a reset marker.

### Middleware interaction

`src/middleware.ts:10` — `AUTH_FORM_PAGES = ["/auth/signin", "/auth/signup"]` bounces authenticated users to `/app`. The recovery hop lands on `/auth/update-password` **with a session**, so that path must never join the list. `needsNoStore` (`:18-24`) already covers everything under `/auth` and `/api/auth`, so the new routes inherit the no-store headers automatically.

### Password rules already line up

`config.toml:183` sets `minimum_password_length = 6`; `password_requirements = ""` (`:186`). Signup's client-side validation already enforces 6 (`t.auth.validation.passwordTooShort`, `src/i18n/pl.ts:43`), so the update-password form can reuse the existing validation strings verbatim — no new rules, no drift.

### `secure_password_change` is the road not taken

`config.toml:221` — `secure_password_change = false`, documented in-file as *"users need to reauthenticate or have logged in recently to change their password"*. Flipping it true is the platform-level alternative to the app-level marker. It is **not** a substitute here: it protects the change API but does nothing about which *page* is reachable, and it would add a reauthentication branch to a flow whose whole premise is that the parent cannot authenticate. Recommendation: leave it `false` and keep the marker. Worth recording so the next reader does not re-litigate it.

Note also `[auth.email.notification.password_changed]` (`config.toml:252-255`, commented out) — Supabase can email the parent when their password changes. That is a cheap security signal and a natural follow-up, but it is a second template + another prod push; out of scope for this slice.

### Test harness is ready

`tests/auth-confirm.test.ts:38` already mints real tokens without an inbox via `admin.auth.admin.generateLink({ type: "signup", ... })`; the same call takes `type: "recovery"`. `e2e/helpers/accounts.ts` provides `provisionAccount`, `signInViaUI`, `deleteUser`, `PASSWORD` — everything the e2e journey needs. `signInViaUI(page, email, password)` already accepts a password override (`:70`), which the "sign in with the NEW password" assertion depends on.

## Code References

- `src/pages/api/auth/confirm.ts:12` — `EMAIL_OTP_TYPES` already whitelists `recovery`
- `src/pages/api/auth/confirm.ts:31-36` — `safeNext` open-redirect guard
- `src/lib/services/parent-pin.ts:15-17,138-159` — marker cookie, TTL, HMAC sign/verify to model
- `src/middleware.ts:10,18-24` — `AUTH_FORM_PAGES` trap; `needsNoStore` coverage
- `src/lib/auth-errors.ts:16-20,29-30` — code→Polish map; switches on `error.code`, never the message
- `src/i18n/pl.ts:43` — `passwordTooShort` (6 chars) matching `minimum_password_length`
- `supabase/config.toml:183,186,221,227,247-249` — password rules, `secure_password_change`, `otp_expiry`, template shape
- `supabase/templates/confirmation.html:15` — link shape to mirror in `recovery.html`
- `tests/auth-confirm.test.ts:38` — inbox-free token minting via `generateLink`
- `e2e/helpers/accounts.ts:70` — `signInViaUI` with password override

## Architecture Insights

- **Fail closed is the house style.** The PIN marker, the deletion route (503 without the service key), the keep-alive route (401 without the secret), and the null-Supabase branch all refuse rather than degrade. The reset marker must follow: no secret → refuse.
- **Errors are mapped by `code`, never by message** (`auth-errors.ts:7`), because Supabase's English strings are not a stable contract. New codes go in the map, not in route bodies.
- **Templates are content, not code** (L-003 spirit): the Polish email lives in `supabase/templates/`, wired by `content_path`, so local and production cannot drift.
- **The link shape is a cross-file contract** — template, confirm route, and tests all encode it. `recovery.html` joins that contract.

## Historical Context (from prior changes)

- `context/archive/2026-07-10-production-email-delivery/research.md:42` — "Password reset: absent. No forgot/reset routes, pages, or i18n keys exist; the confirm route would already accept `type=recovery` links but nothing sends them." Explicitly deferred; this slice is the follow-through.
- `context/archive/2026-07-10-production-email-delivery/plan.md:31` — same deferral, noting the confirm route was left ready "for when that slice happens".
- `context/archive/2026-07-10-production-email-delivery/change.md:31` — two ops gotchas that apply verbatim to this slice's push: the CLI **auto-confirms `config push` when stdin is not a TTY**, and both `BREVO_*` vars must be exported or the push silently blanks production SMTP.
- `context/archive/2026-06-27-matmaverse-design-system/plan.md:36` — `04-password-reset` was scoped out of the design-system change, so the mockup has never been implemented.
- `context/foundation/lessons.md` — L-002 (assert durable state, not just the API response) governs the update-password tests: check the password actually changed by signing in, not merely that the route returned 302. L-003 governs all new copy.

## Related Research

- `context/archive/2026-07-10-production-email-delivery/research.md` — Brevo SMTP, `[remotes.production]`, config-push mechanics
- `context/archive/2026-06-26-parent-signup-first-profile-and-start-screen/research.md` — the original auth-spine build (confirm route, token_hash pattern, 9-provider email study)

## Open Questions

- **Does the marker survive Vercel's edge/function boundary unchanged?** The PIN marker is already set and read across SSR routes in production, so this is expected to be fine — but the reset flow sets the cookie in one route (`/api/auth/confirm`) and reads it in another (`/auth/update-password` + its POST), which the PIN flow also does. Low risk; called out so the plan verifies rather than assumes.
- **Should `/auth/reset-password` bounce an already-authenticated parent?** Left open in `change.md`; the plan must decide. Bouncing is defensible but forecloses "change my password while signed in".
- **Production `otp_length = 8` vs local `6`** (`config.toml:434`): the recovery OTP inherits this. Irrelevant to the link flow (we use `token_hash`, not a typed code), but worth a glance if a numeric-code path is ever added.
