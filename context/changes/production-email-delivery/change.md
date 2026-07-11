---
change_id: production-email-delivery
title: Production email delivery via Brevo SMTP + Polish auth templates
status: impl_reviewed
created: 2026-07-10
updated: 2026-07-11
archived_at: null
---

## Notes

Tracked as **Linear MAT-15** / **GitHub #15**. Launch blocker: without custom SMTP, Supabase's built-in mailer delivers only to team addresses at 2 msgs/hour (explicitly non-production), so no real parent can complete email verification on https://mathshop.vercel.app.

**Provider decision is already made** — `context/foundation/infrastructure.md` §Email Delivery (researched 2026-06-26, 9-provider comparison): **Brevo** custom SMTP. Free 300/day, EU + signable DPA, Supabase-listed, and uniquely sends to real recipients with zero DNS (rewrites From → `@brevosend.com` until a sending domain is authenticated). SMTP: host `smtp-relay.brevo.com`, port `587` (STARTTLS), username = Brevo login, password = SMTP master key. Do not re-litigate the provider choice.

**Binding constraints:**
- Templates must be **Polish** (PRD FR-013; Supabase has no built-in localization) and authored as content, not code (L-003 spirit).
- Confirm-link contract: `{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=signup` — the shape the existing confirm route expects (verify in research).
- Secrets (Brevo SMTP master key) never enter the repo — dashboard-only, documented as a runbook/manual gate.

**Expected hybrid split** (from the approach discussion, 2026-07-10):
- Repo work: Polish template files + `supabase/config.toml` `[auth.email.template.*]` wiring so local signups render them (previewable in Mailpit at `localhost:54324`); config.toml redirect-URLs parity with the MAT-14 dashboard fix (Site URL + `/api/auth/confirm` + `/app` allow-list, done 2026-07-10); any confirm-route adjustment research surfaces.
- Ops runbook (manual-gated): Brevo account + SMTP key → dashboard SMTP settings → mirror templates to dashboard (or `supabase config push` if the CLI supports syncing auth config — verify) → raise auth email rate limit (custom SMTP default 30/hour).

**Out of scope now, follow-up later:** sending-domain acquisition + SPF/DKIM/DMARC (removes the From-rewrite and Brevo footer); optional steady-state swap to Amazon SES (eu-central-1). Both recorded in infrastructure.md.

**Done means:** a stranger's (non-team) email address receives a Polish verification email from a production signup, and the link confirms + lands them in the app.

## Phase 2 state (2026-07-10)

Blocked on **Brevo SMTP account activation** (external): direct SMTP test returns `502 5.7.0 Your SMTP account is not yet activated` — Brevo's anti-spam gate for new accounts; maintainer asked to complete Brevo onboarding / request activation via in-app chat or contact@sendinblue.com. Everything else verified: SMTP credentials authenticate (generated `@smtp-brevo.com` login — NOT the account email; that was a first-attempt failure worth remembering), hosted auth config pushed and **idempotent** (`config push` → "Remote Auth config is up to date"), MAT-14 URLs preserved, rate limit 30/hr live, and the base-config leakage caught in the first push diff (max_frequency 1s, otp_length 6, MFA flags) is pinned back to prod values in `[remotes.production]`. Two ops gotchas recorded: the CLI **auto-confirms config push when stdin is not a TTY** (a piped "n" does NOT prevent application), and a fresh `npx supabase@latest` binary can hang on a **macOS keychain authorization dialog**. Signup attempts during diagnosis may have left a handful of unconfirmed `vince307+prodtest*@gmail.com` users in the hosted auth table — harmless; delete via dashboard if noticed. Once Brevo activates: re-run the production signup proof (fresh +suffix address), then 2.4/2.5 close.

**Resolved 2026-07-10:** Brevo activated SMTP the same day; the production proof passed end-to-end (signup with a fresh +suffix address → Polish email via Brevo → confirm link → signed-in at /app, maintainer-confirmed). MAT-15 marked Done, GitHub #15 closed. The blocked state above is preserved as runbook history only.
