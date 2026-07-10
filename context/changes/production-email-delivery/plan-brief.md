# Production Email Delivery — Plan Brief

> Full plan: `context/changes/production-email-delivery/plan.md`
> Research: `context/changes/production-email-delivery/research.md`

## What & Why

Production signups on https://mathshop.vercel.app currently can't complete: Supabase's built-in mailer only delivers to team addresses (2/hour, explicitly non-production), so no real parent ever receives the verification email. This change wires Brevo custom SMTP and the Polish confirmation template to the hosted project, unblocking the last launch-critical email gap (Linear MAT-15 / GitHub #15).

## Starting Point

The verification *code* is done (S-01a): confirm/resend routes, hardened redirects, contract tests, and a Polish template already committed and wired for local use. The app is live (deployed 2026-07-09); the hosted Site URL/redirect fix landed manually yesterday (MAT-14). Only delivery configuration is missing.

## Desired End State

Any parent signs up in production, receives "Potwierdź swój adres e-mail w MatmaVerse" within a minute via Brevo, clicks the link, and lands confirmed in `/app`. The hosted auth config is fully described by committed TOML — reproducible with one `supabase config push`. A throttled resend shows the proper "Zbyt wiele prób…" message.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Provider | Brevo (SMTP, free 300/day) | Only provider that's free + EU/DPA + sends without a domain (9-provider study) | Research |
| Config mechanism | `[remotes.production]` + `supabase config push` | Templates/SMTP/URLs become committed, reviewable TOML — no hand-mirrored dashboard state | Research |
| Secrets | `env(BREVO_SMTP_USER/KEY)` at push time | Master key never enters the repo; two exports are the only manual secret handling | Research |
| Resend rate-limit rider | Include (~5-line change + test) | Real 30/hr throttles shouldn't read as "something broke"; reuses existing mapper + copy | Plan |
| Sender identity | "MatmaVerse" + vince307@gmail.com | Matches the brand parents see; Brevo From-rewrites to @brevosend.com until a domain exists anyway | Plan |
| Allow-list scope | Production URLs only | Previews are Vercel-SSO-blocked; smallest surface, matches MAT-14 | Plan |

## Scope

**In scope:** `[remotes.production]` config block · Brevo SMTP wiring · resend rate-limit UX rider + test · stale doc/comment truth-ups · Brevo provisioning runbook · config push with diff review · production end-to-end proof.

**Out of scope:** password reset (unimplemented feature) · sending domain / SPF / DKIM (deferred) · provider re-evaluation · zod on auth routes (deferred cross-cutting) · plan-tier upgrades (MAT-16) · template redesign.

## Architecture / Approach

Everything reviewable lands in Phase 1 (repo): the production override block reproducing the MAT-14 values, the rider, doc fixes — gated by the full suite plus a real local email round-trip through Inbucket. Phase 2 is the ops runbook: provision Brevo, export the two env vars, `config push` **reading the diff before confirming** (the safety gate against clobbering the manual MAT-14 fix), then prove the loop with a production signup to a non-team inbox.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Declarative config + rider | Committed prod auth config; correct throttle UX; local round-trip proven | `env()` refs breaking local stack (covered by fresh-DB suite gate) |
| 2. Provision + push + proof | Working production email; MAT-15/#15 closed | Push diff clobbering MAT-14 dashboard values — mitigated by mandatory diff review |

**Prerequisites:** Supabase project unpaused; Brevo signup possible with vince307@gmail.com; access to a non-team test inbox.
**Estimated effort:** ~1 session (Phase 1 ~1–2 h incl. round-trip; Phase 2 ~30 min ops).

## Open Risks & Assumptions

- Hosted `enable_confirmations` current state unknown (push diff reveals it); if already ON, production signups are silently stuck today — raises urgency, changes nothing in the plan.
- `[auth.rate_limit]` may not sync via push — dashboard fallback documented.
- Brevo free-tier posture (300/day, From-rewrite) re-verified as of 2026-06-26; pricing drift possible.

## Success Criteria (Summary)

- A non-team address receives the Polish verification email from a production signup and the link lands a confirmed session in `/app`.
- Hosted auth config matches committed TOML (push idempotent; MAT-14 values preserved).
- Throttled resends read as "try again shortly", not as failure.
