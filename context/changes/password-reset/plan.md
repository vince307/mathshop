# Password Reset (Recovery) Implementation Plan

## Overview

Give a parent who has forgotten their password a way back into their account: a Polish "Nie pamiętasz hasła?" request screen, a recovery email delivered through Brevo, and a set-new-password screen gated by a short-lived signed marker — finishing with other-device revocation and a real production proof. Today the app has no recovery path at all, so a forgotten password is a permanently lost account and every child profile in it.

## Current State Analysis

`src/pages/auth/` contains exactly three pages — `signin`, `signup`, `confirm-email`. There is no reset request page, no set-new-password page, no `/api/auth/reset*` route, and no `auth.reset` i18n namespace. The gap was recorded as deliberate in `context/archive/2026-07-10-production-email-delivery/research.md:42` and left ready rather than built: **`/api/auth/confirm` already whitelists `type=recovery`** (`src/pages/api/auth/confirm.ts:12`) and already carries the open-redirect hardening every emailed link needs (`confirm.ts:31-36`).

What exists and will be reused rather than rebuilt:

- **Marker pattern** — `src/lib/services/parent-pin.ts:15-17,138-159`: an HMAC-SHA256 cookie of shape `${accountId}.${exp}.${sig}`, verified for account match, expiry, and signature in constant time, failing closed when `PARENT_SESSION_SECRET` is absent.
- **Error mapping** — `src/lib/auth-errors.ts:16-30` switches on the stable `error.code`, never the English message.
- **Email template contract** — `supabase/templates/confirmation.html:15` pins the `token_hash` link shape that the confirm route and `tests/auth-confirm.test.ts` both encode.
- **Auth form vocabulary** — `AuthShell.astro`, `FormField`, `PasswordToggle`, `SubmitButton`, `ServerError`, and signup's validation strings, which already match `minimum_password_length = 6` (`config.toml:183`).
- **Inbox-free token minting** — `admin.auth.admin.generateLink({ type })` (`tests/auth-confirm.test.ts:38`), which accepts `recovery`.

## Desired End State

A parent who cannot sign in clicks "Nie pamiętasz hasła?", enters their address, and receives a Polish email from MatmaVerse within a minute. The link lands them on a set-new-password screen; after submitting they are signed in at `/app` with a new password, their old password no longer works, and any session on another device has been revoked. A parent who never had an account sees exactly the same screens and receives nothing — the flow reveals no account's existence. Verified by: the automated suites below, a local Mailpit round-trip, and one real reset on https://mathshop.vercel.app.

### Key Discoveries:

- `type=recovery` is already accepted by the confirm route (`src/pages/api/auth/confirm.ts:12`) — the emailed link needs no new route.
- `safeNext` rejects absolute URLs and falls back to `/app` (`confirm.ts:31-36`). `confirmation.html:15` passes `next={{ .RedirectTo }}`, which renders as an **absolute** URL — so the signup flow's `next` is silently discarded today and works only because the fallback happens to equal its intended target. Recovery cannot rely on that accident: `recovery.html` must pass a literal path (`next=/auth/update-password`), which is also what Supabase's own documented recovery template does.
- `updateUser` with an unchanged password returns **`same_password`** — verified against the local stack; a parent resetting to the password they thought they had will hit it.
- `signOut({ scope: "others" })` revokes the other device immediately for app routes — GoTrue answers its token `403 session_not_found`, and `src/middleware.ts:32` calls `getUser()` on every request. The revoked token still authenticates to **PostgREST** (`200`, not `401`) until its JWT expires (`jwt_expiry = 3600`); RLS still scopes it to the same parent, so this is retained access, not escalation.
- `/auth/update-password` must never be added to `AUTH_FORM_PAGES` (`src/middleware.ts:10`) — the recovery hop lands there *with* a session, so bouncing authenticated users would break the flow at its last step.
- `[auth.email.template.recovery]` takes `subject` + `content_path`, same shape as the confirmation template (`config.toml:247-249`).

## What We're NOT Doing

- **No password-changed notification email** — `[auth.email.notification.password_changed]` (`config.toml:252-255`) stays commented out; a separate follow-up change.
- **No in-app "change password" form** for a signed-in parent. Allowing `/auth/reset-password` while authenticated covers that path through email instead.
- **No `secure_password_change = true`** — it guards the change API but not page reachability, and would bolt a reauthentication branch onto a flow whose premise is that the parent cannot authenticate. Decision recorded in `research.md`; do not re-litigate.
- **No change to `safeNext` or to `confirmation.html`.** The signup template's discarded `next` is noted above as a latent fragility, not fixed here.
- **No sending-domain / SPF / DKIM work** — still deferred; Brevo's `@brevosend.com` From-rewrite is accepted.
- **No MFA/AAL handling** — the app enrolls no factors.
- **No new database tables or migrations.** This slice adds no schema, so L-001 does not apply.

## Implementation Approach

Build the security spine first and prove it refuses before any page can depend on it, then the two user-visible halves in the order a parent meets them, then the production push. Each phase is independently verifiable, and the marker gate gets a deliberate-break check because a gate that silently fails open is the failure mode that matters.

## Critical Implementation Details

**The `next` parameter is a trap.** `safeNext` accepts only same-origin paths, so `recovery.html` must emit a literal `next=/auth/update-password`, not `{{ .RedirectTo }}`. If the template is written by copying `confirmation.html` verbatim, the parent lands on `/app` with a valid session and no way to set a password — a failure that looks like success.

**Ordering inside the confirm route.** `verifyOtp` must succeed before the marker is minted, and the marker needs the account id from its response — so the marker is set from `data.user.id`, after the session cookies are written by `setAll` and before the redirect.

**Domain separation is load-bearing.** The reset marker signs `pwreset:${accountId}:${exp}`. Signing the same `${accountId}.${exp}` payload as `parent_verified` would make a PIN marker replayable as a reset marker under the shared `PARENT_SESSION_SECRET`.

**`signOut({ scope: "others" })` must not disturb the current session.** The parent has to remain signed in through the redirect to `/app`. Phase 3's tests assert the surviving session, not just the revoked one.

---

## Phase 1: Marker spine + confirm-route extension

### Overview

Add the reset marker service and make the confirm route mint it on `type=recovery`. No user-visible surface yet — this phase exists so the gate is proven to refuse before anything depends on it.

### Changes Required:

#### 1. Reset marker service

**File**: `src/lib/services/password-reset.ts` (new)

**Intent**: Mint, verify, and clear the short-lived signed cookie that authorizes setting a new password, modeled on the parent-PIN marker but in a disjoint signature space.

**Contract**: Exports `RESET_MARKER_COOKIE = "password_reset"`, `RESET_MARKER_TTL_MS` (15 minutes), `setResetMarker(cookies, accountId)`, `verifyResetMarker(cookie, accountId): boolean`, `clearResetMarker(cookies)`. Cookie value is `${accountId}.${exp}.${sig}`; the signed payload is the domain-separated string `pwreset:${accountId}:${exp}`. httpOnly, `sameSite: "lax"`, `path: "/"`, `secure` in production. Missing `PARENT_SESSION_SECRET` → `verifyResetMarker` returns `false` (fails closed), mirroring `parent-pin.ts:148-151`.

#### 2. Confirm route mints the marker

**File**: `src/pages/api/auth/confirm.ts`

**Intent**: On a successful `recovery` verification, authorize the set-new-password step by minting the marker for the verified account; every other OTP type is unaffected.

**Contract**: `verifyOtp` result is destructured for `data` as well as `error`; when `type === "recovery"` and the call succeeded, `setResetMarker(context.cookies, data.user.id)` runs before the existing redirect. No change to `safeNext`, to the redirect target, or to any other type's behavior.

### Success Criteria:

#### Automated Verification:

- Marker unit tests pass: `npx vitest run tests/password-reset-marker.test.ts`
- Confirm-route recovery test passes: `npx vitest run tests/auth-confirm.test.ts`
- Full suite stays green: `npx vitest run`
- Lint clean: `npm run lint`
- Type check clean: `npx astro check`

#### Manual Verification:

- Deliberate break: weaken `verifyResetMarker` to `return true` and confirm the Phase 3 refusal tests would fail (run after Phase 3 lands, recorded here as the gate's meta-check)
- A `parent_verified` cookie value pasted into the `password_reset` cookie is rejected

---

## Phase 2: Request half — page, route, Polish email

### Overview

The parent-facing entry point: the screen from mockup `04`, the send route, the Polish recovery template, and local config wiring. Ends with a real email in Mailpit.

### Changes Required:

#### 1. Request page and form island

**File**: `src/pages/auth/reset-password.astro` (new), `src/components/auth/ResetPasswordForm.tsx` (new)

**Intent**: Render the "Nie pamiętasz hasła?" card per mockup `04` and collect an address, reusing the existing auth vocabulary so the screen cannot drift from signin/signup.

**Contract**: Page uses `Layout` + `AuthShell` + card, mirroring `src/pages/auth/signin.astro:12-41`; reads `?sent=1` and `?error=` from the URL. The island is a `method="POST"` form to `/api/auth/reset` with `noValidate` and client-side email validation reusing `t.auth.validation.emailRequired` / `emailInvalid`, following `SignInForm.tsx:19-31`. Success state renders the enumeration-safe notice; it must render identically regardless of whether the address exists.

#### 2. Send route

**File**: `src/pages/api/auth/reset.ts` (new)

**Intent**: Trigger the recovery email and return the parent to the request page with an enumeration-safe notice.

**Contract**: `export const prerender = false`; `POST` reads `email` from form data, calls `supabase.auth.resetPasswordForEmail(email)`, and redirects to `/auth/reset-password?sent=1` — the same target whether or not the address has an account. Rate-limit and transport failures map through `resendFailureMessage` (`src/lib/auth-errors.ts:46-48`) to `?error=`. Response passes through `applyNoStore`, like its sibling auth routes.

#### 3. Polish recovery email

**File**: `supabase/templates/recovery.html` (new)

**Intent**: The Polish email a parent receives, pointing at the existing confirm route.

**Contract**: Link is `{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/update-password` — note the **literal path**, per the `safeNext` trap above. Header comment mirrors `confirmation.html:1-11` explaining that the file serves local and production via `content_path`.

#### 4. Local config wiring

**File**: `supabase/config.toml`

**Intent**: Register the Polish template so local (and later production) send it.

**Contract**: New `[auth.email.template.recovery]` block with `subject` (Polish, e.g. "Zmiana hasła w MatmaVerse") and `content_path = "./supabase/templates/recovery.html"`, placed next to the existing confirmation block at `:247-249`.

#### 5. Entry point and copy

**File**: `src/pages/auth/signin.astro`, `src/i18n/pl.ts`

**Intent**: Give the signin screen a route into recovery, and add the namespace all new copy draws from (L-003).

**Contract**: Signin gains a "Nie pamiętasz hasła?" link to `/auth/reset-password`. `pl.ts` gains `auth.reset` with `title`, `heading`, `description`, `submit`, `pending`, `sentNotice` (the enumeration-safe wording), `backToSignin`.

### Success Criteria:

#### Automated Verification:

- Request-route tests pass: `npx vitest run tests/auth-reset-request.test.ts` — asserts an existing and an unknown address produce byte-identical redirects
- Full suite green: `npx vitest run`
- Lint + types clean: `npm run lint` && `npx astro check`

#### Manual Verification:

- With `enable_confirmations` untouched, request a reset locally and read the mail in Mailpit (http://localhost:54324): subject and body are Polish, and the link contains `type=recovery&next=/auth/update-password`
- The rendered page matches mockup `04-password-reset-web.png` in structure (card, heading, single email field, primary button, back link)
- Clicking the emailed link lands on `/auth/update-password` — **not** `/app` (the `safeNext` trap did not fire)

---

## Phase 3: Set-new-password half

### Overview

The screen the emailed link lands on, its POST, the new error mappings, and the end-to-end journey test.

### Changes Required:

#### 1. Set-new-password page and island

**File**: `src/pages/auth/update-password.astro` (new), `src/components/auth/UpdatePasswordForm.tsx` (new)

**Intent**: Let a parent holding a valid marker choose a new password, refusing everyone else.

**Contract**: Page requires **both** `Astro.locals.user` and `verifyResetMarker(cookie, user.id)`; on failure it redirects — expired/absent marker with a live session to `/auth/reset-password?error=…` ("poproś o nowy link"), no session to `/auth/signin`. Layout derives from the signin card. The island posts to `/api/auth/update-password` with two fields (new password, repeat) using `FormField` + `PasswordToggle` + `SubmitButton`, reusing `t.auth.validation.passwordTooShort` / `passwordMismatch` so the 6-character rule matches `minimum_password_length`.

#### 2. Update route

**File**: `src/pages/api/auth/update-password.ts` (new)

**Intent**: Apply the new password, revoke other devices, and consume the marker so the authorization is single-use.

**Contract**: `export const prerender = false`; `POST` re-checks session **and** marker (never trusting the page's check), validates with zod (min 6, fields equal), then `updateUser({ password })` → `signOut({ scope: "others" })` → `clearResetMarker` → redirect `/app`. The current session must survive the sign-out. Failures map through `mapAuthError` back to `/auth/update-password?error=`.

#### 3. New error mappings

**File**: `src/lib/auth-errors.ts`, `src/i18n/pl.ts`

**Intent**: Give the three recovery-specific failure codes Polish messages instead of the generic fallback.

**Contract**: `messageByCode` gains `same_password`, `session_expired`, `session_not_found`; `pl.ts` gains `auth.serverError.samePassword` ("Nowe hasło musi różnić się od obecnego.") and `auth.serverError.sessionExpired` (link expired → request a new one), plus the `auth.updatePassword` namespace (`title`, `heading`, `description`, `submit`, `pending`, `newPasswordLabel`, `repeatLabel`).

### Success Criteria:

#### Automated Verification:

- Update-route tests pass: `npx vitest run tests/auth-update-password.test.ts` — no marker → refused **and** the old password still signs in (L-002 durable check); valid marker → new password signs in and old one is rejected; a second device's session is revoked; unchanged password surfaces the `same_password` copy
- E2E journey passes: `npx playwright test e2e/password-reset.spec.ts` — request → `generateLink({ type: "recovery" })` → confirm hop → set password → land in `/app` → sign out → sign in with the new password
- Full suites green: `npx vitest run` && `npx playwright test`
- Lint + types clean: `npm run lint` && `npx astro check`

#### Manual Verification:

- Deliberate break: force `verifyResetMarker` to `true` and confirm the "no marker → refused" test goes red; force `signOut` scope to `local` and confirm the revocation test goes red
- Walk the whole loop by hand against Mailpit, including the 15-minute-expiry path (temporarily shorten `RESET_MARKER_TTL_MS`) and confirm the Polish "poproś o nowy link" message appears
- The parent remains signed in after the update — landing on `/app`, not bounced to `/auth/signin`

---

## Phase 4: Production ops

### Overview

Carry the same behavior to the hosted project and prove it with a real reset. Driven interactively by the maintainer — the push needs a TTY and the Brevo credentials.

### Changes Required:

#### 1. Production config

**File**: `supabase/config.toml`

**Intent**: Ensure the production project sends the same Polish template.

**Contract**: The `[auth.email.template.recovery]` block is environment-agnostic (synced by `content_path`), so no `[remotes.production]` duplicate is needed; add `https://mathshop.vercel.app/auth/update-password` to `[remotes.production.auth].additional_redirect_urls` and the localhost equivalent to the base `additional_redirect_urls` for symmetry with `/api/auth/confirm`.

#### 2. Push and prove

**File**: — (ops, no repo change)

**Intent**: Apply the config to the hosted project and confirm a real parent can recover.

**Contract**: Export `BREVO_SMTP_USER` and `BREVO_SMTP_KEY` (both — an unset var silently blanks production SMTP), run `npx -y supabase@latest config push` **from an interactive terminal**, and read the diff before confirming: the recovery template and the new redirect URL are the expected additions; SMTP, rate limits, `otp_length = 8`, and MFA flags must show **no** change. Then reset a real password on `https://mathshop.vercel.app` using a `vince307+resetproof@gmail.com` address.

### Success Criteria:

#### Automated Verification:

- Config parses and the local stack still starts with the new block: `npx supabase db reset`
- Full suites green after the config change: `npx vitest run` && `npx playwright test`

#### Manual Verification:

- The `config push` diff showed only the recovery template + redirect URL as additions, and was confirmed interactively
- A production reset on a `+suffix` address delivers a Polish email within a minute, the link sets a new password, and the parent lands signed in at `/app`
- The old password no longer works in production
- A second browser signed into that account is signed out

---

## Testing Strategy

### Unit Tests:

- Marker sign/verify round-trip; wrong account; expired; tampered signature; **cross-purpose replay** (a `parent_verified`-shaped value must not verify as a reset marker); missing secret → refuse.
- Error mapping for `same_password`, `session_expired`, `session_not_found`.

### Integration Tests:

- Request route: identical redirect for an existing vs unknown address (the enumeration contract), and rate-limit failures rendering the Polish "Zbyt wiele prób…" copy.
- Confirm route: a real `recovery` token (`generateLink`) mints both the session and the marker.
- Update route: refusal without a marker plus a durable check that the password did **not** change (L-002 — never trust the response alone); success path proving old-password rejection, new-password acceptance, and other-session revocation.

### Manual Testing Steps:

1. Request a reset for a known local account; read the Polish mail in Mailpit and follow the link.
2. Set a new password; confirm landing at `/app` while still signed in.
3. Sign in from a second browser first, then repeat the reset; confirm the second browser is bounced to signin on its next navigation.
4. Request a reset for an address with no account; confirm the screen and timing are indistinguishable from case 1 and that no mail arrives.
5. Let the marker expire before submitting; confirm the Polish "poproś o nowy link" path.

## Performance Considerations

None meaningful — two form posts and one email per recovery. The only shared budget is Supabase's email quota (`email_sent = 30`/hour in production), which recovery now shares with signup confirmations; the 1-minute `max_frequency` per address already bounds abuse.

## Migration Notes

No database changes, so no migration and no RLS surface (L-001 does not apply). The only stateful addition is a cookie. Rollback is deleting the new files and reverting the confirm-route hunk plus the config block; nothing persists that would outlive it.

## References

- Design + decisions: `context/changes/password-reset/change.md`
- Research (incl. probe results): `context/changes/password-reset/research.md`
- Marker to model: `src/lib/services/parent-pin.ts:15-17,138-159`
- Link-shape contract: `supabase/templates/confirmation.html:15`, `src/pages/api/auth/confirm.ts:12,31-36`
- Inbox-free token minting: `tests/auth-confirm.test.ts:38`
- Ops gotchas (TTY push, `BREVO_*`): `context/archive/2026-07-10-production-email-delivery/change.md:31`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Marker spine + confirm-route extension

#### Automated

- [x] 1.1 Marker unit tests pass — 38453ef
- [x] 1.2 Confirm-route recovery test passes — 38453ef
- [x] 1.3 Full vitest suite green — 38453ef
- [x] 1.4 Lint clean — 38453ef
- [x] 1.5 Type check clean — 38453ef

#### Manual

- [ ] 1.6 Deliberate break of `verifyResetMarker` turns Phase 3 refusal tests red — deferred to phase 3 (needs those tests to exist)
- [x] 1.7 A `parent_verified` cookie value is rejected as a reset marker — 38453ef (automated: cross-purpose replay case, both directions)

### Phase 2: Request half — page, route, Polish email

#### Automated

- [x] 2.1 Request-route tests pass (identical redirect, existing vs unknown address)
- [x] 2.2 Full vitest suite green
- [x] 2.3 Lint + types clean

#### Manual

- [ ] 2.4 Mailpit shows a Polish email with `type=recovery&next=/auth/update-password`
- [ ] 2.5 Rendered page matches mockup `04-password-reset-web.png` in structure
- [ ] 2.6 Emailed link lands on `/auth/update-password`, not `/app`

### Phase 3: Set-new-password half

#### Automated

- [ ] 3.1 Update-route tests pass (refusal + durable no-change; success; revocation; `same_password`)
- [ ] 3.2 E2E recovery journey passes
- [ ] 3.3 Full vitest + playwright suites green
- [ ] 3.4 Lint + types clean

#### Manual

- [ ] 3.5 Deliberate breaks (marker always-true; `signOut` scope local) turn the right tests red
- [ ] 3.6 Manual Mailpit walkthrough incl. the marker-expiry path
- [ ] 3.7 Parent remains signed in and lands on `/app` after the update

### Phase 4: Production ops

#### Automated

- [ ] 4.1 Local stack still starts with the new config block
- [ ] 4.2 Full suites green after the config change

#### Manual

- [ ] 4.3 `config push` diff reviewed interactively — only the expected additions
- [ ] 4.4 Production reset on a `+suffix` address delivers Polish mail and signs the parent in
- [ ] 4.5 Old production password rejected after the reset
- [ ] 4.6 Second signed-in browser is signed out
