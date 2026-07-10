---
date: 2026-07-10T11:26:22+02:00
researcher: Claude (Fable 5)
git_commit: 921b84d4244efe34445e91146f08e2070f7a69db
branch: main
repository: mathshop
topic: "Production email delivery: Brevo custom SMTP + Polish auth templates (MAT-15 / GH #15)"
tags: [research, codebase, supabase-auth, email, smtp, config-toml, i18n]
status: complete
last_updated: 2026-07-10
last_updated_by: Claude (Fable 5)
---

# Research: Production email delivery (Brevo SMTP + Polish auth templates)

**Date**: 2026-07-10T11:26:22+02:00
**Researcher**: Claude (Fable 5)
**Git Commit**: 921b84d4244efe34445e91146f08e2070f7a69db
**Branch**: main
**Repository**: mathshop

## Research Question

What must change — in the repo and in hosted-project configuration — so that a production signup on https://mathshop.vercel.app delivers a Polish verification email to any (non-team) address, per the change brief in `change.md` (Linear MAT-15 / GitHub #15)? Specifically: the current auth-email code path, the current `supabase/config.toml` state, what the Supabase CLI can push to the hosted project, and the decisions already made in the archived S-01a change.

## Summary

**The application code is already done.** S-01a (archived `2026-06-26-parent-signup-first-profile-and-start-screen/`) shipped the complete verification code path — token-hash confirm route with OTP-type whitelist and open-redirect hardening, resend endpoint, Polish interstitial, and contract tests that mint real tokens via the admin API. **A Polish confirmation template already exists in the repo** (`supabase/templates/confirmation.html`) and is wired into `config.toml` for local use. What's missing is purely delivery-side configuration, and — the pivotal discovery — **nearly all of it can be declarative**: the Supabase CLI supports a `[remotes.production]` config.toml block (deep-merged per `project_id`) and `supabase config push`, which syncs auth config **including email templates by `content_path` and SMTP settings with `env(...)` secret substitution** to the hosted project. The expected "mirror templates into the dashboard by hand" step largely disappears.

The change therefore reduces to: (1) a `[remotes.production]` block encoding prod site URL, redirect allow-list, `enable_confirmations = true`, the Brevo SMTP block (`pass = "env(...)"`), and the raised rate limit; (2) minor template/comment touch-ups; (3) a short ops runbook: create the Brevo account + SMTP key (manual, secret never committed), export the key locally, run `supabase config push`, verify the diff before confirming; (4) an end-to-end production signup to a non-team address as the definition of done.

**One live hazard**: the maintainer manually fixed the hosted Site URL + redirect allow-list yesterday (MAT-14, closed 2026-07-10). A `config push` whose `[remotes.production]` block doesn't reproduce those values exactly would **revert that fix**. The push diff must be reviewed against the MAT-14 values before confirming.

## Detailed Findings

### 1. Auth email code path (all shipped, S-01a)

- **Signup** (`src/pages/api/auth/signup.ts:22-27`): plain form POST; `supabase.auth.signUp({ email, password, options: { emailRedirectTo: \`${origin}/app\` } })` with `origin` derived from the request URL at runtime — no env var or hardcoded base URL anywhere in app code. Success always redirects to the verification interstitial `/auth/confirm-email?email=…` (`signup.ts:34`); no auto-session inspection.
- **Confirm route** (`src/pages/api/auth/confirm.ts`): GET; expects `token_hash` + `type` (+ optional `next`). `type` whitelisted at `confirm.ts:12` (`signup, email, recovery, invite, magiclink, email_change`). `verifyOtp({ type, token_hash })` at `confirm.ts:62`; success → redirect `safeNext(next)` default `/app` (`confirm.ts:67`). `safeNext` (`confirm.ts:31-36`) rejects `//`, `/\`, and ASCII control chars (open-redirect hardening from the S-01a impl review, F1 FIXED). Failures → `/auth/signin?error=<Polish>` via `mapAuthError`; `otp_expired`/`otp_disabled` → `linkInvalid` (`src/lib/auth-errors.ts:24-25`, copy at `src/i18n/pl.ts:59-60`).
- **Resend** (`src/pages/api/auth/resend.ts:26-31`): `supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: \`${origin}/app\` } })`; success → `?resent=1`. **All failures — including rate-limit — collapse to one generic Polish string** `t.confirmEmail.checkEmail.resendError` (`resend.ts:23,34`); it does not use `mapAuthError`, so `over_email_send_rate_limit` (mapped for other routes at `auth-errors.ts:21-22` → "Zbyt wiele prób…") is not distinguished here. Optional UX rider for this change.
- **Interstitial** (`src/pages/auth/confirm-email.astro`): `isAutoConfirmed = import.meta.env.DEV && !email` branch for the local confirmations-off stack (`confirm-email.astro:14`); otherwise "check your email" panel + resend form. Polish copy at `src/i18n/pl.ts:364-381`.
- **Password reset: absent.** No forgot/reset routes, pages, or i18n keys exist; the confirm route would already accept `type=recovery` links but nothing sends them and there is no set-new-password page. The `password-reset` mockups are unimplemented. **Out of scope for this change** (it's a feature, not delivery wiring).
- **Contract the email template must honor** (hardcoded in route + tests): `{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next={{ .RedirectTo }}` — the local template emits exactly this (`supabase/templates/confirmation.html:11`). A switch to the default `{{ .ConfirmationURL }}` (PKCE `?code=`) would require rewriting the confirm route to `exchangeCodeForSession` and the tests — **do not**; the token-hash choice was deliberate (SSR-recommended, admin-testable; `plan.md:28` of the archived change).

### 2. Current `supabase/config.toml` state (line refs)

- `site_url = "http://localhost:4321"` (`config.toml:156`); `additional_redirect_urls` = localhost `/app` + `/api/auth/confirm` + two starter-leftover `127.0.0.1:3000` entries (`config.toml:159-164`).
- `enable_confirmations = false` locally (`config.toml:217`) — **deliberate**: the 202-test suite depends on it; tests bypass email via `admin.createUser({ email_confirm: true })` (`tests/helpers/supabase.ts:46-49`) and `admin.generateLink({ type: "signup" })` (`tests/auth-confirm.test.ts:36-41`, works with confirmations off).
- `[auth.rate_limit] email_sent = 2` (`config.toml:190`) — comment notes raising it requires `auth.email.smtp` enabled.
- `[auth.email.smtp]` — **commented out** (`config.toml:227-235`), placeholder shows SendGrid with `pass = "env(SENDGRID_API_KEY)"` — proof the `env()` substitution pattern is the intended secret mechanism.
- `[auth.email.template.confirmation]` — **active** (`config.toml:245-247`): subject "Potwierdź swój adres e-mail w MatmaVerse", `content_path = "./supabase/templates/confirmation.html"`. No other template blocks (recovery/invite/magic_link/email_change all absent/commented).
- Local test inbox is **Inbucket** (not Mailpit in this CLI version), web UI at port **54324** (`config.toml:99-107`).
- Discrepancy noted in passing: `[db.seed]` references `./seed.sql` which doesn't exist (harmless; out of scope).

### 3. Supabase CLI capability (verified against CLI v2.109 + current docs)

- `supabase config push` exists: "Pushes local config.toml to the linked project" (verified via `--help`). It syncs api/db/auth/storage/experimental config via the Management API — **auth sync includes email templates** (`subject` + `content_path`, file contents uploaded) **and notifications**, per the CLI source (`config push` auth.sync).
- **`[remotes.<name>]` per-project overrides**: a block like `[remotes.production]` with `project_id = "<ref>"` deep-merges over the base config when pushing to that ref (duplicate project_ids rejected; `db.seed.enabled` forced false in remotes unless set). Nested overrides work at any depth, e.g. `[remotes.production.auth] site_url = …`. This is the mechanism that lets local values stay untouched while prod diverges.
- `env(VAR)` substitution is supported in config values (documented in the additional_redirect_urls example and the commented SMTP block) — the Brevo SMTP master key is read from the pusher's environment at push time, never committed.
- The linked project is already `hozkukbsfdcrbszgdxbg` (Frankfurt; linked 2026-07-09 during deployment).

### 4. Historical decisions that bind this change (archived S-01a + infra doc)

- **Provider decision (do not re-litigate)**: Brevo — the only provider satisfying free + EU/DPA + zero-DNS-sending at once. Host `smtp-relay.brevo.com`, port `587` STARTTLS, username = Brevo login, password = SMTP master key. From-rewrite → `@brevosend.com` + free-tier footer until a domain is authenticated. Gotcha: regenerate the SMTP login+key if the login shows the signup email. (9-provider study: archived `research.md:182-247`; decision mirrored at `infrastructure.md:87-100`.)
- **Built-in mailer**: team-addresses only, 2/hour, non-production. Custom SMTP raises default to 30/hour (adjustable in Auth → Rate Limits, or `[auth.rate_limit] email_sent` via config push).
- **Launch-prerequisite wording** (archived `plan.md:357-364`): wire Brevo SMTP; set `enable_confirmations` ON for prod; author Polish templates (confirmation/resend) — default templates are English, an FR-013 violation; add prod + preview `/api/auth/confirm` + `/app` to Site URL + Redirect URLs.
- **PRD ground**: prd-v2 FR-014 (email account + verification, must-have), FR-013 (Polish-only v1, locale swap = content change not code change); prd-v3 preserves as FR-001. Privacy guardrail: parent email is the only PII — relevant to Brevo's GDPR/DPA posture (already vetted).
- **Anti-cache lesson**: any new auth route must apply `applyNoStore` response-level (S-01a plan-review F1). No new routes are expected here, but binding if one appears.
- **Deferred follow-ups that touch this area**: zod across all auth routes as one cross-cutting change (don't add piecemeal); MatmaVerse-vs-MathShop naming sweep (email subject already says MatmaVerse); sending domain + SPF/DKIM/DMARC, then optional SES swap (recorded in `infrastructure.md`).

### 5. State of the world since the archive (this week's deployment session)

- App live at https://mathshop.vercel.app (Vercel `fra1`, prod deploy 2026-07-09); hosted DB has all 9 migrations.
- **MAT-14 fixed manually in the dashboard 2026-07-10** (user-confirmed): hosted Site URL → `https://mathshop.vercel.app`, redirect allow-list → `/api/auth/confirm` + `/app`. The exact values entered are not repo-verifiable — **the `config push` diff must be checked against them so the push confirms rather than clobbers** (see Open Questions).
- Hosted `enable_confirmations` state is unknown from the repo (hosted default is ON; the push diff will reveal it).
- Supabase free tier auto-pauses when idle (MAT-16) — irrelevant to this change's design but relevant to testing days.

## Code References

- `src/pages/api/auth/signup.ts:22-27` — signUp with `emailRedirectTo = ${origin}/app`
- `src/pages/api/auth/confirm.ts:12,31-36,62-67` — OTP-type whitelist, `safeNext` hardening, verifyOtp + redirect
- `src/pages/api/auth/resend.ts:23-34` — resend + generic error collapse (optional rate-limit UX rider)
- `src/pages/auth/confirm-email.astro:14` — dev auto-confirmed branch
- `src/lib/auth-errors.ts:21-25,32-33` — rate-limit + link-invalid Polish mapping
- `src/i18n/pl.ts:59-60,364-381` — linkInvalid + confirmEmail copy
- `supabase/config.toml:156,159-164,190,217,227-235,245-247` — site_url, redirect URLs, rate limit, commented SMTP, active Polish template block
- `supabase/templates/confirmation.html:11` — the exact confirm-link shape (its header comment says "local-only / prod in dashboard" — **now stale**, config push changes that)
- `tests/auth-confirm.test.ts:36-41,57,76,100,112` — token minting + hardcoded link-shape contract
- `tests/helpers/supabase.ts:46-49` — `email_confirm: true` bypass keeping the suite email-independent

## Architecture Insights

- **The link contract is the spine**: template → confirm route → tests all hardcode `token_hash`/`type=signup`/`next`. The production template must be byte-compatible; since config push uploads the same `confirmation.html`, local and prod cannot drift — a stronger guarantee than dashboard-authored templates.
- **`{{ .SiteURL }}` is the only place the production origin is configured** (app code derives origins from requests). Prod correctness therefore lives entirely in hosted auth config — exactly what `[remotes.production]` + config push governs.
- **The declarative path collapses the planned "ops runbook" to two manual atoms**: create the Brevo account/SMTP key, and export that key at push time. Everything else (SMTP host/port/user, sender identity, templates, rate limit, confirmations flag, URLs) is code-reviewable TOML.
- **Local testing story**: flip `enable_confirmations = true` locally (temporarily or via a documented toggle), sign up, read the Polish email in Inbucket at `localhost:54324`, click through to `/api/auth/confirm`. The vitest suite stays green either way because it never touches email.

## Historical Context (from prior changes)

- `context/archive/2026-06-26-parent-signup-first-profile-and-start-screen/research.md:182-247` — 9-provider email study; Brevo decision + dashboard steps + re-verify flags (pricing/EU-hosting claims, stale ~2 weeks at time of writing)
- `context/archive/2026-06-26-parent-signup-first-profile-and-start-screen/plan.md:28,36,48-49,357-364` — token_hash-over-PKCE rationale; launch-prerequisites wording; anti-cache lesson
- `context/archive/2026-06-26-parent-signup-first-profile-and-start-screen/reviews/impl-review.md:23-36` — open-redirect hardening (F1)
- `context/archive/2026-06-26-parent-signup-first-profile-and-start-screen/follow-ups/review-fixes.md:5-17` — zod-across-auth-routes deferred follow-up
- `context/foundation/infrastructure.md:87-113` — §Email Delivery (binding provider decision) + risk-register row
- `context/foundation/test-plan.md:63,193` — Risk #4 (email-verification exchange) scope and retirement

## Related Research

- `context/archive/2026-06-26-parent-signup-first-profile-and-start-screen/research.md` (S-01a auth research incl. the email follow-up study)
- `context/changes/production-email-delivery/change.md` (change brief; Linear MAT-15 / GitHub #15)

## Open Questions

1. **Exact MAT-14 dashboard values**: what precisely did the maintainer enter for Site URL and Redirect URLs on 2026-07-10? The `[remotes.production]` block must encode the same set (plus anything missing, e.g. preview-domain URLs if preview signups should work — probably skip, previews are SSO-protected). Resolution path: run `supabase config push` once with the drafted block and **read the diff before confirming** — it shows current remote values.
2. **Hosted `enable_confirmations` current state**: default ON, but unverified. If it is ON already, production signups are currently *broken-by-silence* (mail can't deliver to strangers) rather than unverified-but-working — strengthens urgency. The push diff reveals it.
3. **Brevo sender identity**: sender email/name values for the SMTP block (`admin_email`/`sender_name`). Until a domain is authenticated, Brevo rewrites From to `@brevosend.com` regardless; pick something stable (e.g. the maintainer's Brevo login email + "MatmaVerse") and record it.
4. **Does `config push` sync `[auth.rate_limit]`?** The auth sync covers templates/notifications/SMTP; rate limits are part of auth config and should sync, but verify in the push diff; fall back to the dashboard (Auth → Rate Limits) if the field is absent from the diff.
5. **Resend rate-limit UX rider**: differentiate `over_email_send_rate_limit` in `resend.ts` (map to `t.auth.serverError.rateLimited`) now that real throttles (30/hr) will exist in production — small, optional, in-scope-adjacent. Plan should decide in or out.
6. **CLI version pin**: `config push` semantics verified against supabase CLI ≥ v2.109 (`npx -y supabase@latest`); the repo-invoked version in scripts is older (v2.98 via plain `npx supabase`). The runbook should pin `supabase@latest` (or bump the dev dependency) for push operations.
