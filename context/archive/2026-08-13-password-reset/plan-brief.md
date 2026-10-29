# Password Reset (Recovery) — Plan Brief

> Full plan: `context/changes/password-reset/plan.md`
> Design + decisions: `context/changes/password-reset/change.md`
> Research: `context/changes/password-reset/research.md`

## What & Why

A parent who forgets their password currently has no way back into their account — and the account holds every child profile, wallet balance, and skill record they've built up. There is no reset request page, no set-new-password page, and no recovery email. This plan builds the whole loop and proves it in production.

## Starting Point

Three auth pages exist (`signin`, `signup`, `confirm-email`) and nothing else. The gap was deliberate: the July email-delivery change scoped password reset out but left the door open — `/api/auth/confirm` already whitelists `type=recovery` and already carries the open-redirect hardening. The parent-PIN gate (`parent-pin.ts`) supplies a proven HMAC-marker pattern to copy, and Brevo SMTP is already wired and proven for Polish transactional mail.

## Desired End State

A parent clicks "Nie pamiętasz hasła?", gets a Polish email within a minute, follows the link, sets a new password, and is signed in at `/app`. Their old password stops working and any session on another device is revoked. Someone who never had an account sees the identical screens and receives nothing — the flow never reveals whether an address is registered.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Gate on the set-new-password page | Short-lived signed marker, not a bare session | This app already refuses to trust a bare session for sensitive actions — a bare-session password change would be less protected than viewing a weekly report | Design |
| Marker signature space | Domain-separated (`pwreset:` prefix) | Otherwise a `parent_verified` PIN marker is replayable as a reset marker under the shared secret | Design |
| Other devices after reset | `signOut({ scope: "others" })` | A reset prompted by suspected compromise must kill the intruder's session, not just add a password | Design |
| Emailed link target | Existing `/api/auth/confirm` | `recovery` is already whitelisted and already hardened against open redirects | Research |
| `next` in the template | Literal path, not `{{ .RedirectTo }}` | `safeNext` rejects absolute URLs; copying the signup template verbatim would silently land the parent on `/app` with no way to set a password | Research |
| Reset page while signed in | Allowed, not bounced | Delivers "change my password while signed in" for free, with no extra surface to build | Plan |
| After a successful change | Straight to `/app` | The parent already holds a session; it mirrors the signup confirm hop | Plan |
| `secure_password_change` | Left `false` | Guards the change API but not page reachability, and would add a reauthentication branch to a flow premised on being unable to authenticate | Research |
| Password-changed notification | Out of scope | Keeps the slice to one template and one production proof | Plan |

## Scope

**In scope:** request page (mockup `04`) · send route · Polish `recovery.html` · marker service + confirm-route extension · set-new-password page and route · other-device revocation · three new Polish error mappings · unit/integration/e2e coverage · production config push and proof.

**Out of scope:** password-changed notification email · in-app change-password form · `secure_password_change` · changes to `safeNext` or `confirmation.html` · sending domain / SPF / DKIM · MFA handling · any database migration.

## Architecture / Approach

Request page → `/api/auth/reset` → `resetPasswordForEmail` → Polish email → **existing** `/api/auth/confirm?type=recovery` → `verifyOtp` mints the session *and* the reset marker → `/auth/update-password` (requires session **and** marker) → `/api/auth/update-password` validates, updates, revokes other devices, clears the marker → `/app`. The only genuinely new machinery is the marker service; everything else composes existing, tested parts.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Marker spine + confirm extension | The gate, proven to refuse before anything depends on it | A gate that fails open is silent — mitigated by a deliberate-break check |
| 2. Request half | Screen, send route, Polish email, local config | The `next` trap: a copied template lands parents on `/app` and looks like success |
| 3. Set-new-password half | The page, its POST, revocation, e2e journey | `signOut({scope:"others"})` must not disturb the current session |
| 4. Production ops | Config push + real production reset | A non-TTY push auto-confirms; an unset `BREVO_*` var silently blanks prod SMTP |

**Prerequisites:** local Supabase stack on the **pinned** CLI (`./node_modules/.bin/supabase` — `supabase@latest` leaves `service_role` without table grants), Docker running, `BREVO_SMTP_USER` / `BREVO_SMTP_KEY` available for Phase 4, an interactive terminal for the push.
**Estimated effort:** ~2-3 sessions across four phases; Phase 4 is maintainer-driven and short.

## Open Risks & Assumptions

- The revoked access token still authenticates to PostgREST until its JWT expires (up to an hour, `jwt_expiry = 3600`). App routes bounce it immediately because middleware calls `getUser()` per request, and RLS still scopes it to the same parent — so this is retained access, not escalation. The spec must not overclaim "the intruder's session dies".
- The marker is set in one route and read in another; the PIN gate already does this in production, so risk is low but Phase 3 verifies rather than assumes.
- Recovery now shares the production email quota (`email_sent = 30`/hour) with signup confirmations.
- `otp_expiry = 3600` is longer than the 15-minute marker, so the marker always governs — a slow parent keeps a valid session but must request a fresh link.

## Success Criteria (Summary)

- A parent who has forgotten their password can get back into their account unaided, in Polish, on production.
- The flow reveals nothing about which addresses have accounts.
- After a reset, the old password is dead and other devices are signed out.
