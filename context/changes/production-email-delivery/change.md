---
change_id: production-email-delivery
title: Production email delivery via Brevo SMTP + Polish auth templates
status: implementing
created: 2026-07-10
updated: 2026-07-10
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
