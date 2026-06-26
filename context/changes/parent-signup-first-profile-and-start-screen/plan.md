# S-01a — Parent Signup + Email Verification + Polish Auth Foundation — Implementation Plan

## Overview

This is **Part A of roadmap slice S-01** (the slice was split during planning — see "What We're NOT Doing"). It builds the **auth, verification, and localization foundation**: a first-time parent signs up, receives a real email-verification link, confirms it to establish a session, and lands authenticated inside a **100% Polish** UI. Along the way it closes the raw-English error leak (FR-013), hardens the auth-cookie spine for Vercel's CDN, and retires the auth known-issues pinned by `testing-auth-critical-path`.

**Part B (S-01b)** — the `child_profiles` schema migration, avatar registry, the rich profile-creation wizard (including the parent-approved child-name field), the create-profile API, and the start screen — is a **separate change** opened after this lands.

## Current State Analysis

(Grounded in `context/changes/parent-signup-first-profile-and-start-screen/research.md`; commit `616e961`.)

- **Auth routes** (`src/pages/api/auth/{signin,signup,signout}.ts`) — password-based, redirect-only, **no zod**, and they leak the **raw English** Supabase `error.message` into `?error=` (`signin.ts:16`, `signup.ts:16`). `signup` has **no `emailRedirectTo`**; success → a **static** `confirm-email.astro` that establishes no session. **None export `prerender = false`** (latent, CLAUDE.md-required). `signout` is a **silent no-op when env is missing** (cookies survive).
- **No verification machinery** — grep confirms no `/auth/callback` or `/auth/confirm` route, no `exchangeCodeForSession`/`verifyOtp` anywhere.
- **`src/lib/supabase.ts`** — modern `getAll`/`setAll` SSR client, but `setAll` **ignores the second `headers` argument** `@supabase/ssr` now passes (anti-CDN-cache: `Cache-Control: private,no-cache…`), and sets **no cookie hardening** (`secure`/`httpOnly`/`sameSite`). On Vercel's CDN an auth-cookie response that gets cached can serve one user's session to another.
- **Localization** — everything user-visible is **hardcoded English**; `Layout.astro:14` is `<html lang="en">`. The existing `src/lib/config-status.ts:15` already holds Polish in a typed data module — **the precedent to follow**.
- **Test harness** — the request-level harness from `testing-auth-critical-path` is available (`tests/helpers/{supabase,astro}.ts`, cookbook §6.1/§6.3). Existing suites (`auth-routes`, `auth-session-gating`, `auth-env-missing`, `child-profiles-isolation`) are the green baseline; several pin the very known-issues this plan fixes (English leak, signout no-op) and **must be updated to assert the fixed behavior**.
- **`supabase/config.toml`** — `enable_confirmations = false` (`:209`), `site_url`/`additional_redirect_urls` local-only (`:154,156`), `[inbucket]` enabled (`:99`), `[auth.email.template.*]` + `[auth.email.smtp]` commented out.

## Desired End State

A first-time parent can: open the app → see a Polish sign-up → submit email + password → receive a verification email (locally captured by inbucket) → click the link → land **authenticated** on a gated Polish landing page. Bad input and auth errors surface **in Polish** with no English leak. Auth-cookie responses carry anti-cache headers and hardened cookies. The full test suite is green, including new tests for the confirm route, Polish error mapping, and the hardened signout; the previously-pinned known-issue tests now assert the fixed behavior.

Verify: `npm test` green (incl. new confirm-route + error-mapping tests); `npm run build` green; `npm run lint` exit 0; manual run shows the Polish signup → inbucket link → confirmed session → Polish landing.

### Key Discoveries:

- **Use the `token_hash` + `verifyOtp` confirm pattern, not PKCE `?code=` + `exchangeCodeForSession`.** The `token_hash` flow (a `/api/auth/confirm` route + a custom email template linking to it) is self-contained — it needs no PKCE `code_verifier` cookie correlated to the signUp call — which makes it both the SSR-recommended server pattern and **directly testable** via `admin.generateLink` (which returns `hashed_token`). PKCE would require capturing the signUp client's code_verifier cookie to exchange the code, which the request-level harness can do but is brittle. (Context7 `/supabase/ssr`: PKCE `?code=` is the default; `verifyOtp({type,token_hash})` is the explicit server-confirm alternative.)
- **`@supabase/ssr` `setAll(cookies, headers)`** — the library passes anti-cache headers that MUST be applied to auth-cookie responses (`ssr/src/types.ts`). The current client drops them.
- `child-profiles-isolation.test.ts` proves the F-01 RLS write shape; **no schema/RLS work happens in Part A** (that's Part B).
- L-002: assert **durable** session state (a real `getUser()` re-read over the resulting cookies), not just a redirect Location.

## What We're NOT Doing

- **Part B (separate change):** `child_profiles` schema migration (child name / age / starting-level columns), avatar registry + art, the profile-creation wizard, the create-profile API, the start screen, and the 0/1/2+ **profile-count routing branch**. Part A ships a **placeholder** authenticated landing (`/app`) that Part B turns into the count router.
- **Production email infrastructure (tracked launch prerequisite, NOT built here):** choosing/wiring a prod SMTP provider, flipping `enable_confirmations` ON in the hosted project, authoring the **Polish** email templates, and adding prod/preview redirect URLs to the hosted allow-list. Part A builds + tests the verification *code*; prod email delivery is a launch blocker recorded below.
- **Forgot-password, parent-PIN, remember-me** (mockups `04`/`06`, login extras) — out of S-01 entirely.
- **The full brand-rename docs sweep** (MathShop → MatmaVerse across `context/foundation/*` + CLAUDE.md) — Part A uses `MatmaVerse` in the UI via one i18n constant; the docs sweep is a follow-up.
- **No new dependencies.**

## Implementation Approach

Five phases, auth-foundation-first: localize the surface, close the error leak, harden the cookie spine, then build verification on top of the hardened spine, then land the authenticated user somewhere Polish. Each phase is independently committable and keeps the suite green; phases 2–3 flip existing known-issue test pins from "bug pinned" to "fixed."

## Critical Implementation Details

- **Verification confirm route + email template.** Build `src/pages/api/auth/confirm.ts` (`GET`, `prerender = false`) that reads `token_hash` + `type` from the query, calls `supabase.auth.verifyOtp({ type, token_hash })` (which writes the session cookie via `setAll`), and redirects to the landing on success or to a Polish-mapped `?error=` on failure. Point the **confirmation email template** at `{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=signup`. Set `emailRedirectTo` on `signUp` to the landing so `{{ .RedirectTo }}` is available post-confirm.
- **Local testability — spike the approach first [Plan-review F2].** Keep `enable_confirmations = false` for the local/CI stack (the existing suite depends on it). The intended confirm-route test mints a real `token_hash` via `admin.auth.admin.generateLink({ type: "signup", email, password })` and calls the route with `?token_hash=…&type=…` — no email round-trip, no global config change. **This interplay is unverified — run a ~15-min spike at the start of Phase 4** to confirm `generateLink` + `verifyOtp` actually establishes a session against the local stack, and to pin the correct `type` enum (`signup` vs `email`) so it matches what `generateLink`/the template emits. **Fallback if the spike fails:** a dedicated test file that sets `enable_confirmations = true` for just that suite (rest of the suite stays `false`), or the PKCE `?code=` + cookie-capture route. **Manual e2e (4.5)** requires temporarily setting `enable_confirmations = true` locally — with it `false`, signUp auto-confirms and no email is sent to inbucket.
- **Anti-cache headers go on the Response, not in `setAll`.** `setAll` only has the cookie jar (no Response handle — it runs during `getUser()`/`verifyOtp()` before a Response exists), so the `@supabase/ssr` `headers` arg cannot be applied there. Set the anti-CDN-cache headers at the response level via a shared helper — middleware on the `next()` Response, auth/confirm routes on their redirect Response. Cookie hardening (`secure`/`httpOnly`/`sameSite`) *does* belong in `setAll` (cookie options). [Plan-review F1]
- **Ordering:** harden the cookie spine (Phase 3) **before** wiring verification (Phase 4) — the confirm route sets cookies and must inherit the anti-cache headers.

## Phase 1: Localization foundation + brand

### Overview

Stand up the FR-013 content layer and Polishize the existing auth surfaces — content only, no behavior change.

### Changes Required:

#### 1. Polish content dictionary

**File**: `src/i18n/pl.ts` (new), `src/i18n/index.ts` (new)

**Intent**: A single typed Polish dictionary, re-exported as `t`, satisfying "new locale = content only" (FR-013). Mirrors the `config-status.ts` precedent.

**Contract**: `pl.ts` exports a `const … as const` object grouping `auth` (labels, validation, submit, server-error messages), `confirmEmail`, `landing`, and a `brand: "MatmaVerse"` constant. `index.ts` exports `type Dictionary = typeof pl` and `export const t: Dictionary = pl`. Include an `Intl.PluralRules("pl")` helper for the password-length hint. Imported directly inside React islands (not threaded through props).

#### 2. Polishize layout + auth surfaces

**File**: `src/layouts/Layout.astro`, `src/pages/auth/{signin,signup,confirm-email}.astro`, `src/components/auth/{SignInForm,SignUpForm,ServerError,FormField,PasswordToggle,SubmitButton}.tsx`

**Intent**: Replace hardcoded English with `t.*`; set the document language to Polish; use the `MatmaVerse` brand constant. Build to the mockups `01-parent-login` / `02-parent-register` for layout/look (PRD governs copy).

**Contract**: `Layout.astro` → `<html lang="pl">` and Polish `<title>`/brand. Every visible string + `aria-label` + placeholder sourced from `t`. No control-flow change. (`SignUpForm`'s extra fields beyond email/password are Part B — keep the current email+password form, just Polishized.)

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Full existing suite still green: `npm test`
- No `lang="en"` remains in `src/layouts/Layout.astro`

#### Manual Verification:

- Signin/signup/confirm-email pages render entirely in Polish; brand reads "MatmaVerse"; layout matches mockups `01`/`02`

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: Polish error-mapping (close the English leak)

### Overview

Map Supabase auth errors to Polish at the route boundary so no English ever reaches the URL or the client.

### Changes Required:

#### 1. Auth error mapper

**File**: `src/lib/auth-errors.ts` (new)

**Intent**: Pure `mapAuthError(error) → Polish string`, switching on `error.code`/`error.status` (never echoing `error.message`), pulling strings from `t.auth.serverError.*`.

**Contract**: Handles at least: invalid credentials, user-already-registered, email-not-confirmed, rate-limited, weak-password, the unconfigured-Supabase case, and a default `"Coś poszło nie tak. Spróbuj ponownie."`. Returns the Polish string; the `?error=` value is then already localized.

#### 2. Wire into the auth routes

**File**: `src/pages/api/auth/signin.ts`, `src/pages/api/auth/signup.ts`

**Intent**: Replace `encodeURIComponent(error.message)` and the hardcoded `"Supabase is not configured"` with `mapAuthError(...)` output. `ServerError.tsx` stays a dumb renderer.

**Contract**: Error redirects carry a Polish `?error=`. The unconfigured branch also returns Polish.

#### 3. Update the English-leak test pin

**File**: `tests/auth-routes.test.ts`

**Intent**: The pin that asserted the raw English `"Invalid login credentials"` leaks must now assert the **Polish** mapped message (the leak is fixed).

**Contract**: Flip the known-issue assertion to expect the Polish string; keep the redirect-target assertions.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Full suite green incl. the updated error-mapping assertions: `npm test`
- Bad-credentials signin `?error=` decodes to a Polish string (no English): asserted in `tests/auth-routes.test.ts`

#### Manual Verification:

- Triggering a bad signin / duplicate signup shows Polish error copy end-to-end

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Auth-spine hardening

### Overview

Make auth-cookie responses safe on Vercel's CDN and retire the signout known-issues.

### Changes Required:

#### 1. Cookie hardening (in the SSR client) + anti-CDN-cache headers (at the response level)

**File**: `src/lib/supabase.ts` (cookie hardening) **and** `src/middleware.ts` + `src/pages/api/auth/{signin,signup,signout}.ts` (+ the Phase 4 confirm route) + a small shared helper (e.g. `src/lib/http.ts`)

**Intent**: Two distinct fixes. (a) Harden the auth cookies — `secure` in prod, `httpOnly`, `sameSite: "lax"`. (b) Make any response that sets/clears auth cookies non-cacheable on Vercel's CDN.

**Contract**:
- (a) lives in `supabase.ts` `setAll` via `cookies.set(name, value, options)` options — no `createClient` signature change.
- (b) does **NOT** live in `setAll`: that callback only receives the cookie jar and runs during `getUser()`/`verifyOtp()` **before a Response exists**, so the `@supabase/ssr` `headers` arg can't be applied there. Instead apply the anti-cache headers at the **response level** via a shared helper — `Cache-Control: private, no-cache, no-store, must-revalidate, max-age=0` (+ `Expires: 0`, `Pragma: no-cache`): middleware sets them on the `next()` Response for auth/protected paths; each auth + confirm route sets them on its redirect Response. Verified by a harness test asserting the headers on an auth response.

#### 2. Fix signout

**File**: `src/pages/api/auth/signout.ts`

**Intent**: Add `export const prerender = false`; clear the session cookies even when `createClient` returns null (env missing), so signout is never a silent no-op.

**Contract**: Signout always clears auth cookies before redirecting to `/`, configured or not.

#### 3. Add `prerender = false` to the remaining auth routes

**File**: `src/pages/api/auth/{signin,signup}.ts`

**Intent**: Satisfy the CLAUDE.md invariant (every `src/pages/api/` route).

**Contract**: Both export `prerender = false`. No behavior change.

#### 4. Flip the pinned known-issue tests to "fixed"

**File**: `tests/auth-env-missing.test.ts` (and any signout pin)

**Intent**: The signout env-missing no-op test asserted cookies survive; it must now assert cookies are **cleared** even when unconfigured.

**Contract**: Update the assertion to the fixed behavior; keep the redirect target.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Full suite green, incl. the flipped signout assertion: `npm test`
- Build passes: `npm run build`
- Auth-cookie responses include the anti-cache headers (asserted in a harness test)

#### Manual Verification:

- Sign out clears the session (re-hitting a gated route redirects to signin); no stale-session survives

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Full email verification

### Overview

Build the real verification round-trip on the hardened spine using the `token_hash` + `verifyOtp` confirm pattern.

### Changes Required:

#### 1. Email-verification confirm route

**File**: `src/pages/api/auth/confirm.ts` (new)

**Intent**: Establish a session from a verification link. `GET`, `prerender = false`.

**Contract**: Read `token_hash` + `type` from `context.url.searchParams`; build the SSR client; `await supabase.auth.verifyOtp({ type, token_hash })`. On success redirect to the **`next`** query param (default `/app` if absent, validated as a same-origin path); on error redirect to a Polish-mapped `?error=`. Cookies are written via the hardened `setAll`. [Plan-review F3: one redirect source]

#### 2. Set `emailRedirectTo` on signup + template wiring

**File**: `src/pages/api/auth/signup.ts`, `supabase/config.toml`

**Intent**: Point the confirmation email at the confirm route and set the post-confirm redirect target.

**Contract**: `signUp({ email, password, options: { emailRedirectTo: <origin>/app } })` (origin from request, not hardcoded) — `emailRedirectTo` is the **single source** of the post-confirm target; it populates `{{ .RedirectTo }}`. In `config.toml`, set `[auth.email.template.confirmation]` content (local) to link to `{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next={{ .RedirectTo }}` (the confirm route reads `next` — F3), and add `/app` + the confirm path to `additional_redirect_urls`. (Polish prod templates + prod allow-list = launch prerequisite, see References.)

#### 3. confirm-email interstitial + resend

**File**: `src/pages/auth/confirm-email.astro`, `src/components/auth/` (resend action)

**Intent**: Turn the static page into the "check your email" interstitial with a working **resend** (mockup `03`), in Polish.

**Contract**: Shows Polish "we sent a link" copy + a resend control that re-triggers `signUp`/`resend`. Establishes no session itself (the confirm route does).

#### 4. Confirm-route tests

**File**: `tests/auth-confirm.test.ts` (new)

**Intent**: Exercise the real `verifyOtp` path without an email round-trip.

**Contract**: Provision a user via `admin.generateLink({ type: "signup", … })` to obtain `hashed_token`; call the confirm route with `?token_hash=…&type=signup`; assert a **durable session** (a `getUser()` re-read over the resulting cookies returns the user — L-002) + redirect to `/app`. Add a failure case (bad/expired token_hash → Polish `?error=`). Follow cookbook §6.3.

### Success Criteria:

#### Automated Verification:

- Lint + build pass: `npm run lint`, `npm run build`
- Confirm route establishes a durable session from a generated token_hash and redirects to `/app`: `tests/auth-confirm.test.ts`
- Bad token_hash → Polish `?error=`: `tests/auth-confirm.test.ts`
- Full suite green: `npm test`

#### Manual Verification:

- Local end-to-end: sign up → inbucket (`:54324`) shows the Polish-ish link → clicking it lands an authenticated session on `/app`; resend works

**Implementation Note**: Pause for manual confirmation before Phase 5.

---

## Phase 5: Authenticated landing + routing scaffolding

### Overview

Give the verified/signed-in parent a gated Polish destination, and stop authenticated users from seeing the auth forms — structured so Part B can swap in the profile-count router.

### Changes Required:

#### 1. Authenticated landing page

**File**: `src/pages/app.astro` (new) [the `/app` route]

**Intent**: A gated, Polish, minimal "you're signed in" landing — the single funnel point for signin + confirm. Part B replaces its body with the 0/1/2+ profile-count router.

**Contract**: Reads `Astro.locals.user`; renders Polish placeholder content (+ a signout control). A clearly-marked extension point notes Part B will branch on `child_profiles` count here.

#### 2. Repoint post-auth redirects

**File**: `src/pages/api/auth/signin.ts` (and the confirm route from Phase 4)

**Intent**: Land authenticated users on `/app` instead of the English scaffold `/`.

**Contract**: signin success → `/app`; confirm success → `/app`.

#### 3. Gate `/app` + redirect authed users away from `/auth/*`

**File**: `src/middleware.ts`

**Intent**: Add `/app` to `PROTECTED_ROUTES`; redirect already-authenticated requests to `/auth/signin` and `/auth/signup` to `/app`.

**Contract**: `PROTECTED_ROUTES` includes `/app` (mind the `startsWith` no-boundary gotcha — keep prefixes non-overlapping). An authenticated GET to `/auth/signin`/`/auth/signup` → redirect `/app`.

#### 4. Routing tests

**File**: `tests/auth-session-gating.test.ts` (extend) or new `tests/auth-landing.test.ts`

**Intent**: Pin the new gating + redirects.

**Contract**: anon `/app` → `/auth/signin`; authenticated `/app` → reaches it; authenticated `/auth/signin` → `/app`. Reuse the harness (mint a session via signin, replay cookies).

#### 5. Remove the scaffold dashboard

**File**: `src/pages/dashboard.astro` (delete), `src/middleware.ts`, `tests/auth-session-gating.test.ts`

**Intent**: PRD Non-Goals forbids a parent dashboard, and `/app` is now the real gated surface — remove the dead scaffold page. [Plan-review F4]

**Contract**: Delete `dashboard.astro`; remove `/dashboard` from `PROTECTED_ROUTES` (leaving `/app`); repoint the gating tests that use `/dashboard` as the protected-route-under-test (incl. the `startsWith` over-match pin) to `/app`. Covered by the existing Phase-5 "full suite green" + "/app gating" criteria — no new Progress rows.

### Success Criteria:

#### Automated Verification:

- Lint + build pass: `npm run lint`, `npm run build`
- `/app` gating + the authed→`/app` redirects assert green: the routing test
- signin/confirm now land on `/app`: asserted
- Full suite green: `npm test`

#### Manual Verification:

- After verifying/sign-in the parent reaches a Polish `/app`; visiting `/auth/signin` while logged in bounces to `/app`

**Implementation Note**: Final phase — roll up pending manual items and confirm before closeout.

---

## Testing Strategy

### Unit Tests:

- `mapAuthError` — code/status → Polish string, with a default fallback (no English).

### Integration Tests (reuse `tests/helpers/`, cookbook §6.1/§6.3):

- Confirm route: generated `token_hash` → durable session + `/app` redirect; bad token_hash → Polish error.
- Error-mapping: bad-creds / duplicate / unconfigured → Polish `?error=` (updates the existing pin).
- Hardening: signout clears cookies even when unconfigured (flips the pin); auth-cookie responses carry anti-cache headers.
- Routing: `/app` gating + authed→`/app` redirects.

### Manual Testing Steps:

1. `npm run dev` + local Supabase; sign up → check inbucket (`http://localhost:54324`) for the link → confirm → land authenticated on `/app`.
2. Trigger bad signin / duplicate signup → Polish errors, no English.
3. Sign out → re-hit `/app` → redirected to signin (no stale session).

## Performance Considerations

Keep auth pages SSR + small islands (`client:load`) for the ≤3s cold-load NFR; EU Vercel region per CLAUDE.md. The anti-cache headers are correctness, not a perf regression (they only mark auth responses non-cacheable).

## Migration Notes

**None in Part A** — no schema/RLS change (that's Part B). `config.toml` gains local template/redirect entries only.

## References

- Research: `context/changes/parent-signup-first-profile-and-start-screen/research.md`
- Design source of truth: `assets/matma-verse/math-economy-auth-v2-{web,mobile}/{01-parent-login,02-parent-register,03-email-verification}` (local-only, per CLAUDE.md)
- Test harness + recipes: `tests/helpers/{supabase,astro}.ts`; `context/foundation/test-plan.md` §6.1/§6.3
- Prior: `context/archive/2026-06-19-testing-auth-critical-path/` (harness + the known-issues this fixes)
- Context7 `/supabase/ssr` — `verifyOtp` confirm pattern; `setAll(cookies, headers)` anti-cache contract

### Launch prerequisites (NOT built here — must land before production verification works)

Provider decided: **Brevo** (EU/GDPR + signable DPA, free 300/day, officially Supabase-listed, sends with zero DNS via a temporary `@brevosend.com` From-rewrite). Full comparison: `research.md` → "Follow-up Research"; recorded in `context/foundation/infrastructure.md` → §Email Delivery.

- Wire **Brevo** as hosted-Supabase custom SMTP (`smtp-relay.brevo.com:587`, user = Brevo login, pass = SMTP master key); set `enable_confirmations` ON for prod. (Brevo can send for dev/test immediately; a domain is not required to start.)
- Acquire + authenticate a **sending domain** (SPF + DKIM, DMARC recommended) before a credible launch — removes the `@brevosend.com` rewrite + free-tier footer (trust + deliverability). Optional cheaper steady-state swap afterward: **Amazon SES Frankfurt** (~$0.10/mo).
- Author **Polish** email templates (confirmation/resend) in the dashboard — default templates are English (FR-013); the confirm link is `{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=signup`.
- Add prod + preview URLs (incl. `/api/auth/confirm`, `/app`) to the hosted project's Site URL + Redirect URLs allow-list.

### Follow-ups

- **Part B (S-01b):** open via `/10x-new` — schema migration + avatar registry + profile wizard (incl. the parent-approved child-name field, handled as RLS-isolated, zod-validated, HTML-escaped PII) + create-profile API + start screen + the `/app` profile-count router.
- **Decision of record (PRD override):** the product owner chose to collect the child's first name, **overriding the PRD privacy guardrail** "No PII tied to children / no real names." Update `prd-v2.md` to reflect this so spec and code agree (otherwise reviews will flag it). Captured here and in Part B.
- **Brand rename:** MathShop → **MatmaVerse** across `context/foundation/*` + `CLAUDE.md`.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Localization foundation + brand

#### Automated

- [ ] 1.1 Lint passes
- [ ] 1.2 Build passes
- [ ] 1.3 Full existing suite still green
- [ ] 1.4 No `lang="en"` remains in Layout.astro

#### Manual

- [ ] 1.5 Auth pages render Polish; brand "MatmaVerse"; layout matches mockups 01/02

### Phase 2: Polish error-mapping (close the English leak)

#### Automated

- [ ] 2.1 Lint passes
- [ ] 2.2 Full suite green incl. updated error-mapping assertions
- [ ] 2.3 Bad-creds signin ?error= decodes to Polish (no English)

#### Manual

- [ ] 2.4 Bad signin / duplicate signup show Polish error copy end-to-end

### Phase 3: Auth-spine hardening

#### Automated

- [ ] 3.1 Lint passes
- [ ] 3.2 Full suite green incl. flipped signout assertion
- [ ] 3.3 Build passes
- [ ] 3.4 Auth-cookie responses include anti-cache headers (harness test)

#### Manual

- [ ] 3.5 Sign out clears the session; no stale-session survives

### Phase 4: Full email verification

#### Automated

- [ ] 4.1 Lint + build pass
- [ ] 4.2 Confirm route establishes a durable session from a generated token_hash → /app
- [ ] 4.3 Bad token_hash → Polish ?error=
- [ ] 4.4 Full suite green

#### Manual

- [ ] 4.5 Local end-to-end: signup → inbucket link → confirmed session on /app; resend works

### Phase 5: Authenticated landing + routing scaffolding

#### Automated

- [ ] 5.1 Lint + build pass
- [ ] 5.2 /app gating + authed→/app redirects assert green
- [ ] 5.3 signin/confirm land on /app
- [ ] 5.4 Full suite green

#### Manual

- [ ] 5.5 After verify/sign-in the parent reaches a Polish /app; authed visit to /auth/signin bounces to /app
