# Production Email Delivery (Brevo SMTP + Polish Templates) Implementation Plan

## Overview

Make production signup verification emails deliverable on https://mathshop.vercel.app: encode the hosted Supabase project's auth configuration declaratively in `supabase/config.toml` (a `[remotes.production]` override block synced via `supabase config push`), wire Brevo custom SMTP with the secret injected via `env()`, and add a small resend-endpoint UX rider so real production throttles surface as the existing Polish "too many attempts" message instead of a generic failure. Closes Linear MAT-15 / GitHub #15.

## Current State Analysis

From `research.md` (2026-07-10, all file:line-verified):

- **The verification code path is complete and shipped** (S-01a): signup with `emailRedirectTo = ${origin}/app` (`src/pages/api/auth/signup.ts:22-27`), token-hash confirm route with OTP-type whitelist + open-redirect hardening (`src/pages/api/auth/confirm.ts:12,31-36,62-67`), resend endpoint (`src/pages/api/auth/resend.ts`), Polish interstitial, and contract tests that mint tokens via the admin API (email-independent).
- **A Polish confirmation template already exists in-repo** (`supabase/templates/confirmation.html`), wired via `[auth.email.template.confirmation]` (`config.toml:245-247`), emitting the exact link shape the route and tests hardcode. Its header comment ("local-only; prod in dashboard") predates the config-push discovery and is now stale.
- **Delivery config is the only gap**: no `[auth.email.smtp]` (commented SendGrid placeholder at `config.toml:227-235`), local `site_url`/redirect URLs only, `enable_confirmations = false` locally (deliberate — the 202-test suite depends on it), `email_sent = 2`/hr.
- **The CLI can push all of it**: `supabase config push` syncs auth config — including templates by `content_path` and SMTP — to the linked project (`hozkukbsfdcrbszgdxbg`, Frankfurt), with `[remotes.production]` per-project overrides deep-merged by `project_id` and `env(VAR)` secret substitution. Verified against CLI ≥ v2.109 (`npx -y supabase@latest`); the repo's plain `npx supabase` resolves an older version — push operations must pin `@latest`.
- **Live hazard**: the hosted Site URL + redirect allow-list were fixed manually on 2026-07-10 (MAT-14). A push whose TOML doesn't reproduce those values would revert that fix — the push diff is the safety gate.
- **Resend UX gap**: `resend.ts:23,34` collapses every failure (including `over_email_send_rate_limit`) into the generic `resendError` string, while `src/lib/auth-errors.ts:21-22,32-33` already maps rate-limit codes/429 to `t.auth.serverError.rateLimited` ("Zbyt wiele prób. Spróbuj ponownie za chwilę.").

## Desired End State

A parent who signs up on https://mathshop.vercel.app with any email address receives a Polish "Potwierdź swój adres e-mail w MatmaVerse" email within a minute, sent through Brevo; clicking the link confirms the account and lands them in `/app`. The hosted project's auth config (site URL, redirect allow-list, confirmations ON, SMTP, 30/hr rate limit, template) is fully described by committed TOML and reproducible with one `supabase config push`. A throttled resend shows "Zbyt wiele prób…" instead of the generic failure. Verify: local Inbucket round-trip (phase 1 gate) and a production signup to a non-team address (phase 2 gate).

### Key Discoveries:

- `[remotes.production]` blocks deep-merge over base config per `project_id` — local values stay untouched; prod divergence is committed and reviewable (research §3).
- `env(VAR)` substitution keeps the Brevo SMTP master key out of the repo; it's read from the pusher's environment at push time (pattern already shown in the commented SMTP block, `config.toml:232`).
- The single `confirmation.html` becomes the template for both local and prod — drift between environments becomes impossible (research §Architecture Insights).
- Rate-limit mapping + Polish copy already exist (`auth-errors.ts:21-22`, `pl.ts:57`) — the rider reuses them, no new i18n keys (L-003-clean).

## What We're NOT Doing

- **No password-reset feature** — the recovery flow (request page, email, set-new-password UI) is unimplemented and out of scope; the confirm route already accepts `type=recovery` for when that slice happens.
- **No sending domain / SPF / DKIM / DMARC** — explicitly deferred (recorded in `infrastructure.md`); the `@brevosend.com` From-rewrite and free-tier footer are accepted for now.
- **No preview-deployment allow-listing** — production URLs only (decided; previews are Vercel-SSO-protected anyway).
- **No provider re-evaluation** — Brevo was decided in the archived 9-provider study; SES swap is a recorded later option.
- **No zod on auth routes** — that's a deferred cross-cutting follow-up from S-01a; don't add it piecemeal to `resend.ts`.
- **No template redesign** — the existing Polish copy ships as-is; only its stale header comment changes.
- **No plan-tier changes** (Vercel/Supabase Pro) — that's MAT-16.

## Implementation Approach

Phase 1 is pure repo work, fully verifiable locally: the `[remotes.production]` block (written to match the MAT-14 dashboard values), the resend rider, and doc/comment truth-ups — gated by the standard suite plus a real local email round-trip through Inbucket. Phase 2 is the ops runbook: provision Brevo, export the key, `config push` with the diff reviewed against MAT-14 before confirming, then prove the production loop end-to-end. Secrets never touch the repo.

## Critical Implementation Details

- **Push-diff safety gate**: `supabase config push` prints the remote diff and asks for confirmation. The diff must be read before confirming — expected changes are SMTP (new), rate limit (2→30), confirmations (revealed state → true), template (new), and site_url/redirect URLs that should show **no change** if the TOML matches MAT-14. Any unexpected deletion (e.g. a redirect URL the maintainer added but the TOML lacks) means abort, fix the TOML, re-push.
- **CLI version**: all push/link operations use `npx -y supabase@latest` (config push semantics verified on ≥ v2.109; plain `npx supabase` resolves v2.98).
- **`env(BREVO_SMTP_KEY)` and local commands**: the reference lives inside `[remotes.production.auth.email.smtp]`, which merges only when operating against that project_id — but verify `supabase start`/`db reset` still work locally *without* the variable exported (the fresh-DB suite gate covers this). If the parser complains locally, fall back to exporting an empty var in the runbook note.
- **Resend rider selectivity**: map *only* rate-limit signals (`over_email_send_rate_limit`, `over_request_rate_limit`, HTTP 429) to `t.auth.serverError.rateLimited`; every other failure keeps the generic `resendError`. Don't route through full `mapAuthError` — its other mappings are signin-flavored and wrong for the interstitial context.
- **Local round-trip toggle**: the manual gate requires temporarily flipping `enable_confirmations = true` in the base `[auth.email]` locally + `supabase stop && supabase start` (config reload); flip back afterward — committed value stays `false` (the suite depends on it).

## Phase 1: Declarative prod auth config + resend rider

### Overview

Commit everything reviewable: the production config block, the resend rate-limit UX rider, and truth-ups of the two stale doc surfaces this change touches.

### Changes Required:

#### 1. `[remotes.production]` block

**File**: `supabase/config.toml`

**Intent**: Declare the hosted project's auth config as a committed override so `config push` governs it: production site URL + redirect allow-list (reproducing the MAT-14 dashboard fix exactly), confirmations ON, Brevo SMTP with env-substituted secret, raised email rate limit.

**Contract**: A new block at the end of the file (base config untouched — local behavior identical):

```toml
[remotes.production]
project_id = "hozkukbsfdcrbszgdxbg"

[remotes.production.auth]
site_url = "https://mathshop.vercel.app"
additional_redirect_urls = [
  "https://mathshop.vercel.app/app",
  "https://mathshop.vercel.app/api/auth/confirm",
]

[remotes.production.auth.email]
enable_confirmations = true

[remotes.production.auth.email.smtp]
enabled = true
host = "smtp-relay.brevo.com"
port = 587
user = "env(BREVO_SMTP_USER)"
pass = "env(BREVO_SMTP_KEY)"
admin_email = "vince307@gmail.com"
sender_name = "MatmaVerse"

[remotes.production.auth.rate_limit]
email_sent = 30
```

(`user` also via `env()`: Brevo SMTP logins are account-derived and worth keeping out of the repo alongside the key; the runbook exports both. Snippet included because the exact block shape is the contract phase 2 pushes.)

#### 2. Resend rate-limit rider

**File**: `src/pages/api/auth/resend.ts`

**Intent**: When Supabase reports email rate-limiting (real in production at 30/hr and under `max_frequency`), redirect back with the existing `t.auth.serverError.rateLimited` copy instead of the generic `resendError`; all other failures unchanged.

**Contract**: The error branch distinguishes rate-limit signals — error `code` in `{over_email_send_rate_limit, over_request_rate_limit}` or HTTP status 429 (same signal set as `src/lib/auth-errors.ts:21-22,32-33`) — and selects the message accordingly. Route stays redirect-only, keeps `applyNoStore`, no new i18n keys.

#### 3. Rider test coverage

**File**: `tests/auth-routes.test.ts` (or a sibling following its request-level pattern)

**Intent**: Prove the resend endpoint's two error messages route correctly. Local `max_frequency = "1s"` means two immediate resends for the same email deterministically throttle the second — assert its redirect carries the `rateLimited` copy; a missing-email request keeps carrying `resendError`.

**Contract**: Same black-box route-contract style as the existing signup/signin tests (assert `Location` + decoded `error` param). If the double-resend throttle proves flaky in CI-like runs, test the extracted mapping logic directly instead and note it.

#### 4. Doc truth-ups

**File**: `supabase/templates/confirmation.html` (header comment), `README.md:123-131`

**Intent**: The template header claims it "only serves the local stack; production templates are authored in the hosted dashboard" — now false (config push syncs this file to prod). README's "Email confirmation in local development" section still gives starter-era advice to toggle confirmation in the hosted dashboard — replace with the config.toml reality (local: confirmations off, Inbucket at :54324; prod: governed by `[remotes.production]` + config push).

**Contract**: Comment/prose only; template body and link shape byte-identical (tests pin it).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- Full suite passes against a fresh DB (`npx supabase db reset` + `npx vitest run`) — includes the new resend-rider test and proves local stack still starts with the `[remotes.production]` block present and `BREVO_*` vars unset

#### Manual Verification:

- Local email round-trip: flip `enable_confirmations = true` locally, restart stack, sign up via the UI, read the Polish email in Inbucket (`localhost:54324`), click the link → confirmed session lands on `/app`; flip back
- Throttled resend (two rapid clicks) shows "Zbyt wiele prób…" in the interstitial; other failures still show the generic message
- `git diff` of config.toml shows only the new block (base config untouched)

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: Brevo provisioning + config push + production proof

### Overview

The ops runbook: provision Brevo (manual, secrets stay out of the repo), push the committed config to the hosted project with the diff reviewed, and prove the production loop. No repo changes except closing bookkeeping.

### Changes Required:

#### 1. Brevo provisioning (manual, dashboard)

**File**: none (runbook step)

**Intent**: Create the Brevo account (login = vince307@gmail.com), open SMTP & API settings, generate the SMTP master key. Apply the recorded gotcha: regenerate the SMTP login/key if the login exposes the signup email in a form you don't want committed — then export both locally: `export BREVO_SMTP_USER=…` and `export BREVO_SMTP_KEY=…`.

**Contract**: The two env vars exist in the shell that runs the push; nothing written to the repo or `.env`.

#### 2. Config push with diff review

**File**: none (runbook step)

**Intent**: `npx -y supabase@latest config push` against the linked project. **Read the printed diff before confirming**: expected = SMTP added, `email_sent` 2→30, `enable_confirmations` → true, confirmation template added; site_url/redirect URLs should show no change vs the MAT-14 dashboard values — any unexpected removal means abort, reconcile the TOML, re-push.

**Contract**: Push completes; hosted dashboard shows SMTP enabled (Brevo host), template subject "Potwierdź swój adres e-mail w MatmaVerse", confirmations ON. If the rate limit didn't sync (research open question), set it manually: Auth → Rate Limits → 30/hr, and note that in the runbook record.

#### 3. Production end-to-end proof + bookkeeping

**File**: none (runbook step); Linear MAT-15 / GitHub #15 on success

**Intent**: The definition of done from `change.md`: sign up on https://mathshop.vercel.app with a **non-team** address (a second inbox you control that is not the Supabase account email), receive the Polish email via Brevo (From shows the `@brevosend.com` rewrite — expected), click the link, land confirmed in `/app`. Then close MAT-15 and GitHub #15 with the outcome.

**Contract**: Email arrives within ~1 minute; link targets `https://mathshop.vercel.app/api/auth/confirm?token_hash=…&type=signup&next=…`; session established. Failure of any step reopens the phase, not the plan.

### Success Criteria:

#### Manual Verification:

- Brevo account live; SMTP master key exported; secrets absent from repo (`git grep` for the key/user returns nothing)
- `config push` diff matched expectations (MAT-14 values preserved) and applied cleanly
- Hosted rate limit is 30/hr (via push or dashboard fallback)
- Production signup with a non-team address: Polish email received, link confirms, `/app` reached
- MAT-15 marked Done in Linear; GitHub #15 closed with outcome comment

**Implementation Note**: Final phase — after verification, review via `/10x-impl-review`, then archive via `/10x-archive`.

---

## Testing Strategy

### Unit/Integration Tests:

- One new test for the resend rider (deterministic throttle via local `max_frequency = "1s"`, fallback to mapping-level test if flaky).
- Everything else rides the existing 200+ suite against a fresh DB — the proof that the config block and doc edits change no behavior locally.

### Manual Testing Steps:

1. Phase 1: local Inbucket round-trip (confirmations temporarily on) + throttled-resend copy check.
2. Phase 2: push-diff review; production signup to a non-team inbox; link click-through; resend throttle sanity on prod if convenient.

## Performance Considerations

None — configuration only; the rider is a branch in an existing redirect path.

## Migration Notes

No DB changes. Rollback: `git revert` restores the TOML; a re-push restores prior hosted config (SMTP can also be toggled off in the dashboard in an emergency). The push itself is the "migration" — its diff review is the safety mechanism.

## References

- Research: `context/changes/production-email-delivery/research.md` (authoritative; CLI capability + hazards)
- Change brief: `context/changes/production-email-delivery/change.md` (Linear MAT-15 / GitHub #15)
- Provider decision: `context/foundation/infrastructure.md` §Email Delivery + archived 9-provider study (`context/archive/2026-06-26-parent-signup-first-profile-and-start-screen/research.md:182-247`)
- Confirm-link contract: `supabase/templates/confirmation.html:11`, `tests/auth-confirm.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Declarative prod auth config + resend rider

#### Automated

- [x] 1.1 Type checking passes: `npm run check` — 713bef2
- [x] 1.2 Linting passes: `npm run lint` — 713bef2
- [x] 1.3 Build succeeds: `npm run build` — 713bef2
- [x] 1.4 Full suite passes against a fresh DB (`supabase db reset` + `vitest run`), incl. new resend-rider test, with `BREVO_*` unset — 713bef2

#### Manual

- [x] 1.5 Local Inbucket email round-trip (confirmations on → signup → Polish email → link → /app → flip back) — 713bef2
- [x] 1.6 Throttled resend shows "Zbyt wiele prób…"; other failures keep generic copy — 713bef2
- [x] 1.7 config.toml diff = new block only — 713bef2

### Phase 2: Brevo provisioning + config push + production proof

#### Manual

- [x] 2.1 Brevo account + SMTP key provisioned; env vars exported; no secrets in repo
- [x] 2.2 `config push` diff reviewed (MAT-14 values preserved) and applied
- [x] 2.3 Hosted rate limit = 30/hr (push or dashboard fallback)
- [x] 2.4 Production signup to non-team address: Polish email → confirm link → /app
- [x] 2.5 MAT-15 Done + GitHub #15 closed with outcome
