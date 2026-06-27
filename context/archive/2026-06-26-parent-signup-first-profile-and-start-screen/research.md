---
date: 2026-06-26T14:01:15+0200
researcher: vince307
git_commit: 616e9612460fbf047af9ad545f1d120c1ff649a3
branch: main
repository: 10xDevs
topic: "S-01 onboarding — parent signup + full email verification + first child profile + start screen, grounded against current code"
tags: [research, codebase, auth, verification, supabase-ssr, rls, child-profiles, i18n, onboarding, avatars, roadmap-S-01]
status: complete
last_updated: 2026-06-26
last_updated_by: vince307
last_updated_note: "Added follow-up web research: transactional email provider for Supabase Auth custom SMTP (production verification email)"
---

# Research: S-01 — Parent signup → email verification → first child profile → start screen

**Date**: 2026-06-26T14:01:15+0200
**Researcher**: vince307
**Git Commit**: 616e9612460fbf047af9ad545f1d120c1ff649a3
**Branch**: main
**Repository**: 10xDevs

## Research Question

Ground roadmap slice **S-01** (`parent-signup-first-profile-and-start-screen`) against current code so `/10x-plan` can write a plan. S-01 = a first-time parent reaches the app, sees a **Polish** sign-up surface, **completes email verification**, picks one of ~6 pre-set avatars in a "create first child profile" flow, and the child lands on an in-world **start screen** (lemonade stand + "Czas otworzyć sklep!"). PRD refs: US-01, FR-001–FR-004, FR-013, FR-014. Prereq F-01 (done).

**Two scope decisions taken before research** (both user-owned):
1. **Build the FULL password + email-verification flow** (emailRedirectTo + `/auth/callback` code-exchange + production confirmation) — answers PRD Open Q#1 as *password*.
2. **Fix the existing English-error leak** in S-01 with a Polish error-mapping layer (FR-013 is a hard guardrail).

## Summary

S-01 cleanly decomposes into **three workstreams** plus cross-cutting routing — and carries **one hard infra blocker** the plan must resolve before "full verification" is real.

1. **Localization + auth-error fix (FR-013).** All current auth strings are hardcoded English; the server leaks the **raw English Supabase `error.message`** into `?error=` (`signin.ts:16`, `signup.ts:16`), rendered verbatim by `ServerError.tsx`. Fix: a typed Polish content dictionary (`src/i18n/pl.ts`), `<html lang="pl">`, and an error-mapping module (`src/lib/auth-errors.ts`) that maps Supabase `error.code` → Polish **at the route boundary** so no English ever reaches the URL or client.

2. **Full email verification (additive, but infra-blocked).** Today: `signUp({email,password})` has **no `emailRedirectTo`**, success → a **static** `confirm-email.astro` that establishes no session; there is **no `/auth/callback` code-exchange route** (grep-confirmed). The build is well-defined (add `emailRedirectTo`, create `src/pages/api/auth/callback.ts` with `prerender = false` calling `exchangeCodeForSession` — PKCE `?code=` is the `@supabase/ssr` default). **BLOCKER:** production email delivery is neither configured nor planned (no SMTP, `enable_confirmations = false`, English default templates, local-only redirect allow-list).

3. **First profile + start screen.** No app code writes `child_profiles` yet; the F-01 table + RLS already support the write with **no schema change**. Need: an avatar registry (`src/data/avatars.ts` + `public/avatars/`), an avatar-picker island (no text input), a create-profile API route (`prerender = false`, zod, `account_id` derived from session, insert under F-01 RLS), and a start-screen `.astro` + tap-to-start island.

**Cross-cutting routing:** post-auth landing must branch on child-profile count (0 → create-profile, 1 → start screen, 2+ → picker) in **one** landing route both signin and callback funnel through; new surfaces must be added to `PROTECTED_ROUTES`.

**Test path is well-paved:** S-01 inherits the request-level harness from the archived `testing-auth-critical-path` (`tests/helpers/`, cookbook §6.1/§6.3) and the F-01 isolation pattern.

**Scope flag:** the roadmap already calls S-01 the largest must-have slice and a split candidate. With full verification + i18n + error-mapping + avatars + start screen + routing, `/10x-plan` should weigh splitting (natural seam: **A** = auth/i18n/verification, **B** = profile + start screen).

## Detailed Findings

### Workstream 1 — Localization (FR-013) + the English-error leak

**Current state (all English, hardcoded):**
- `src/components/auth/SignUpForm.tsx:25-41`, `SignInForm.tsx:20-27` — client validation + labels + submit text all hardcoded English; hand-rolled English pluralization for the "N more characters" hint.
- `src/components/auth/ServerError.tsx:7-15` — renders `{message}` verbatim (whatever was in `?error=`).
- `src/pages/api/auth/signin.ts:16`, `signup.ts:16` — `redirect(.../?error=${encodeURIComponent(error.message)})` forwards Supabase's **raw English** message; plus a hardcoded English `"Supabase is not configured"`.
- `src/layouts/Layout.astro:14` — **`<html lang="en">`** (must become `pl`). But the same layout's banner already renders Polish from a data module (`src/lib/config-status.ts:15` — "Supabase nie jest skonfigurowany…") — **the precedent pattern to follow.**
- `Welcome.astro`, `dashboard.astro`, `confirm-email.astro`, `auth/*.astro` headings — all English.

**Recommended i18n pattern (grounded in this stack): a typed content dictionary module, NOT Astro i18n routing.**
- `src/i18n/pl.ts` exports a `const … as const` object; `src/i18n/index.ts` re-exports the active locale as `t` with `type Dictionary = typeof pl`.
- Rationale: Astro i18n *routing* solves locale-prefixed URLs (zero value for single-locale v1), not the SSR↔island string problem. A typed dictionary makes "new locale = content only" literal (add `en.ts`, flip one constant; TypeScript flags missing keys). Works identically in `.astro` frontmatter and React islands (plain ESM import, no provider/hydration mismatch). Zero new deps; mirrors the existing `config-status.ts` precedent.
- **Island gotchas:** import `t` *directly inside* the island rather than threading strings through props (Astro serializes island props to JSON — bloats hydration). Don't pass functions as props (define pluralization helpers — Polish plural rules via `Intl.PluralRules('pl')` — in the i18n module). `serverError` may stay a string prop, but it must already be a **mapped Polish string**.

**Error-mapping placement: map at the API-route boundary, not in `ServerError`.**
- Add `src/lib/auth-errors.ts` — pure `mapAuthError(error) → Polish string`, switching on `error.code`/`error.status` (Supabase `AuthApiError` exposes these), never echoing `error.message`. Call it in `signin.ts`/`signup.ts`/`callback.ts` *before* building the redirect, so `?error=` is already Polish and `ServerError.tsx` stays a dumb renderer.
- Map at minimum: invalid credentials, user-already-registered, email-not-confirmed, rate-limited, weak-password, `"Supabase is not configured"`, plus a default `"Coś poszło nie tak. Spróbuj ponownie."`. Keep the Polish strings in the dictionary (`t.auth.serverError.*`); `auth-errors.ts` is just code→key.

### Workstream 2 — Full email verification (the build + the blocker)

**What exists / what's missing:**
- `src/pages/api/auth/signup.ts:13` — `signUp({email,password})`, **no `options`, no `emailRedirectTo`**; success → `/auth/confirm-email`.
- `src/pages/auth/confirm-email.astro:4` — **static text**, branches on `import.meta.env.DEV`; consumes no token, establishes no session.
- **No `/auth/callback` route exists** — grep for `callback` / `exchangeCodeForSession` / `verifyOtp` over `src/` + `supabase/` returns nothing.
- `src/lib/supabase.ts:9-23` — modern `getAll`/`setAll` cookie client (what a callback's `exchangeCodeForSession` needs to persist the session cookie).

**The build (well-defined):**
1. Add `emailRedirectTo` to `signUp` (`signup.ts:13`) → `{ options: { emailRedirectTo: <origin>/api/auth/callback } }`, built from request origin / env, not a hardcoded host.
2. Create **`src/pages/api/auth/callback.ts`** — `GET`, **`export const prerender = false`**. Read `code` from `context.url.searchParams`, build the SSR client, call **`supabase.auth.exchangeCodeForSession(code)`** (writes the session cookie via `setAll`), then redirect into the post-auth router. Error branch → Polish-mapped `?error=`.
   - **Context7 (`/supabase/ssr`):** PKCE `?code=` + `exchangeCodeForSession(code)` is the `@supabase/ssr` default (the client is configured `flowType: "pkce"`). If Supabase email templates are set to the `token_hash` + `type` style instead, the route uses `verifyOtp({ type, token_hash })`. **Decide the template style** and match the route.
3. `confirm-email.astro` becomes the "check your email" interstitial only.

**Context7 finding worth carrying into the plan — modern `setAll` signature + cookie hardening:** `@supabase/ssr`'s `SetAllCookies` callback now receives a **second `headers` argument** (`Cache-Control: private, no-cache…`, `Expires: 0`, `Pragma: no-cache`) that **must** be applied to any response setting auth cookies, to stop a CDN/reverse-proxy from serving one user's session to another. The current `src/lib/supabase.ts:17-21` `setAll` **ignores** this (only `cookies.set(...)`). On Vercel's CDN this is a real correctness/security gap. The docs also recommend cookie hardening (`secure` in prod, `httpOnly`, `sameSite: "lax"`) which the current client doesn't set. **Touching `supabase.ts` is the auth spine — weigh carefully**, but verification responses especially must not be cacheable.

### Workstream 3 — First child profile + start screen

**Schema & RLS (no change needed).** `supabase/migrations/20260609120000_child_profiles_isolation.sql:51-101`:
```sql
create table public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references auth.users(id) on delete cascade,
  avatar text not null,
  theme text not null default 'default',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- INSERT policy (line 88):
create policy child_profiles_insert_own on public.child_profiles
  for insert to authenticated with check (auth.uid() = account_id);
```
- `avatar` is free `text` (no CHECK/enum) — the ~6-avatar set is enforced in the **app** (zod). `theme` defaults to `'default'` (omit it). `id` server-generated. Gameplay columns (coins/level/shop-state) are deferred to **S-04** — do not add now.
- SELECT policy `using (auth.uid() = account_id)` → a signed-in user's `count()` answers "how many profiles?" correctly (the routing branch).

**The write (first app write to the table — grep-confirmed nothing in `src/` writes it today):**
- New `src/lib/services/` module (does not exist) + new API route `src/pages/api/profiles/create.ts` (or similar), `POST` + **`export const prerender = false`**, zod-validate `avatar` against the closed avatar id set.
- **`account_id` is derived server-side from the session (`context.locals.user.id`), never client-supplied.** Insert through the **SSR authenticated client** (anon key → user JWT → `auth.uid()` fires the policy), never service-role. Shape: `.insert({ account_id: user.id, avatar }).select("id").single()`.
- RLS `with check` is the backstop; the app must not even offer an `account_id` field.

**Avatar registry (FR-001).** `src/data/avatars.ts` (+ art in `public/avatars/` served statically for cold-load):
```ts
interface Avatar { id: string; name: string; image: string; alt: string }
// id "lis" is already baked into tests/child-profiles-isolation.test.ts (lowercase slug, persisted)
```
- `id` is the DB contract (stable slug); `name`/`alt` are locale content (Polish; "Lis" = fox) — the name doubles as the profile name (FR-001). Picker renders large tappable `<button>`s with image + Polish caption, no text input; selection → posts `{ avatar: id }`.

**Start screen + tap-to-start.** New `src/pages/start.astro` (or repurpose `index.astro`, retiring `Welcome.astro`) as the shell; `src/components/start/StartShiftButton.tsx` island showing **"Czas otworzyć sklep!"** (FR-004) as a large tap target. The shift itself is S-02+, so v1 can navigate/no-op gracefully.

**NFRs:** keep interactive pieces as small islands (`client:load`), avatar art as static `public/` files (CDN-cacheable, ≤3s cold-load); pin Vercel region EU (`fra1`/`arn1`) per CLAUDE.md. shadcn `button.tsx` sizes top out ~36px (`icon: size-9`) — **too small for 6-year-olds**; define an oversized child-facing size variant with generous spacing (PRD `prd-v2.md:146`).

### Cross-cutting — post-auth routing + PROTECTED_ROUTES

- **Current:** `signin.ts:19` hardcodes `redirect("/")` → scaffold Welcome; `middleware.ts:4` gates only `["/dashboard"]`; nothing redirects an already-authenticated user away from `/auth/*`.
- **Needed:** a single landing route (rework `index.astro` or a dedicated `/app`) that reads `Astro.locals.user`, queries the profile count via the `child_profiles` service, and `Astro.redirect`s: **0 → create-profile, 1 → start screen, 2+ → profile-picker** (picker UI itself is S-07, but the branch must already handle ≥2). Both `signin.ts` and the new `callback.ts` funnel to this one place — don't duplicate the branch.
- Add to `PROTECTED_ROUTES`: the landing/`/app`, create-profile, start, and (future) picker routes. **Gotcha:** the gate is opt-in/fail-open (forgetting a route leaves it public) and `startsWith` has no boundary (`/dashboardXYZ` also gates) — pick non-overlapping prefixes. Consider an authenticated→landing redirect on `/auth/*`.

## Code References

- `src/pages/api/auth/signup.ts:13,16,19` — signUp without emailRedirectTo; raw-error redirect; success → confirm-email
- `src/pages/api/auth/signin.ts:16,19` — raw-error redirect; success → `/`
- `src/pages/api/auth/signout.ts:4-10` — POST-only, env-missing silent no-op, missing `prerender = false`
- `src/pages/auth/confirm-email.astro:4,31` — static, establishes no session
- `src/lib/supabase.ts:6-8,17-21` — null on missing env; `setAll` ignores the modern `headers` arg + no cookie hardening
- `src/middleware.ts:4,10-13,18-22` — PROTECTED_ROUTES=["/dashboard"]; getUser() (not try/catch'd); startsWith gate
- `src/components/auth/{SignUpForm,SignInForm,ServerError}.tsx` — English strings; raw `?error=` render point
- `src/layouts/Layout.astro:14` — `lang="en"`; `src/lib/config-status.ts:15` — existing Polish-in-data-module precedent
- `supabase/migrations/20260609120000_child_profiles_isolation.sql:51-101` — table + 4 RLS policies (INSERT `with check (auth.uid() = account_id)`)
- `supabase/config.toml:154,156,209,219-227` — site_url + additional_redirect_urls (local only); enable_confirmations=false; commented-out SMTP block
- `tests/helpers/{supabase,astro}.ts`, `tests/auth-routes.test.ts` — reusable harness + §6.3 route-test template
- `docs/reference/{rls-isolation.md,rls-template.sql,contract-surfaces.md}` — F-01 contract (child_profiles already registered)
- `context/foundation/lessons.md:5-19` — L-001 / L-002

## Architecture Insights

- **No new dependencies needed** for any workstream (i18n = a typed module; verification = supabase-js already present; profile = the existing SSR client).
- **The auth spine is the integration surface for two of three workstreams** (verification + error-mapping both touch the routes/`supabase.ts`), so they're naturally sequenced together — supporting the A/B split.
- **`account_id`-derived-from-session is the security invariant** for the profile write (mirrors L-001's `auth.uid() = account_id`); the client must never supply it.
- **Local verification is a different code path than prod** (`enable_confirmations=false` locally vs ON hosted) — the callback route is effectively untestable in the default local stack without flipping confirmations on + reading the link from inbucket (port 54324). The existing isolation/auth suites sidestep email with `admin.createUser({email_confirm:true})`; that does **not** exercise the callback.
- **Test harness reuse is high-leverage:** §6.3 (redirect-only route assertions + durable-session re-read, L-002) is the direct template for both the `/auth/callback` route and the profile-create route.

## Historical Context (from prior changes)

- `context/archive/2026-06-19-testing-auth-critical-path/` — built the request-level test harness S-01 reuses (helpers + cookbook §6.1/§6.3); pinned 3 known issues two of which S-01 touches (signout env-missing no-op + missing `prerender=false`; raw-English `?error=` leak). impl-review APPROVED (5 files/21 tests). **Doc-drift to avoid:** cookbook §6.3 / review F1 mention `deleteUserByEmail()`, but the shipped helper is `findUserIdByEmail()` + `deleteUser(id)` — follow the real exports.
- `context/archive/2026-06-09-per-account-isolation-contract/` (F-01) — created `child_profiles` + RLS; its plan-brief explicitly scopes "profile-creation UI/API/services" **OUT, to S-01**. S-01 is the first consumer.
- `context/foundation/lessons.md` L-001 (RLS in same migration — already satisfied; S-01 adds no table) and L-002 (assert durable state via service-role re-read, no chained `.select()` false-green; run the policy-break meta-check) — bind S-01's profile-write test.

## Related Research

- `context/archive/2026-06-19-testing-auth-critical-path/research.md` — the auth/middleware/route grounding this builds on
- `context/foundation/test-plan.md` §3 (S-01 retires the Risk #4 coverage debt: email-verification exchange, first-profile creation, start screen), §6.1/§6.3 (the recipes S-01 follows)
- `context/foundation/roadmap.md:80-98` (S-01 slice + the split-candidate flag), `:160-167` (S-07 picker, which the routing branch must anticipate)

## Open Questions (decisions for `/10x-plan`)

1. **★ Production email delivery — the hard blocker.** "Full verification" cannot ship in prod until: (a) a custom **SMTP provider** is chosen + wired in hosted Supabase (the `[auth.email.smtp]` block is commented out; built-in SMTP is rate-limited and not for production); (b) `enable_confirmations` flipped ON for prod **without breaking the existing green suite** (which depends on it being off + admin-confirmed users); (c) **Polish email templates** authored (default templates are English — an FR-013 violation on a parent-facing surface); (d) **prod/preview redirect URLs** added to the hosted project's allow-list (local `config.toml` has only `127.0.0.1:3000`). Decide: wire SMTP now, or keep local-confirmations + ship a "verification works locally, prod-email is a fast-follow" scope?
2. **Email link style** — PKCE `?code=` (default; `exchangeCodeForSession`) vs `token_hash`+`type` (`verifyOtp`). Drives the callback route shape + the email-template config.
3. **Split the slice?** Roadmap flags S-01 as the largest must-have slice. Recommended seam: **A** (i18n + `lang=pl` + error-mapping + full verification + callback) and **B** (avatar registry + picker + create-profile API/RLS + start screen + routing). `/10x-plan` to decide one plan vs two.
4. **`supabase.ts` hardening scope** — fix the `setAll` missing-`headers` (anti-CDN-cache) gap + cookie hardening now (touches the auth spine, affects all routes incl. existing tests) or as a separate change? At minimum, verification responses must be non-cacheable.
5. **In-scope known-issue fixes** — the English `?error=` leak is in scope (decided). Also fold in `signout.ts` `prerender=false` + env-missing no-op (cheap, same surface), or leave as logged issues?
6. **Avatar set + art** — confirm the ~6 avatar ids/Polish names and source the art; need real `public/avatars/*` assets. Blocks the picker UI.

## Design source of truth (binding)

`assets/matma-verse/` is the **canonical UI/UX design** for this project (recorded in `CLAUDE.md`): build S-01's surfaces to these mockups, not to improvised layouts (PRD governs behavior/copy; mockups govern look-and-feel). Directly relevant screens:
- `math-economy-auth-v2-{web,mobile}/02-parent-register-*` — the Polish sign-up surface (Workstream 1).
- `…/03-email-verification-*` — the verification interstitial / callback UX (Workstream 2).
- `…/05-child-profile-*` — the avatar picker, no-text-input (Workstream 3).
- `math-economy-ui-v2-{web,mobile}/02-child-dashboard-*` + `assets/shop-bg.jpg` — start-screen reference.
- Note the auth set also includes `04-password-reset-*` and `06-parent-pin-security-*` — surfaces beyond S-01's scope; do not pull them in unless the plan explicitly expands scope.

**Caveat:** `assets/` is gitignored (local-only) — these designs are not in the repo. The plan/implementation should read them from the maintainer's machine; a cloud/fresh-clone session won't have them and must request the mockups.

---

## Follow-up Research 2026-06-26T19:38:59+0200 — Transactional email provider for Supabase Auth custom SMTP

> External/infra web research (4 parallel agents, official provider + Supabase docs; facts **as of 2026-06-26**). Answers the plan's launch-prerequisite "choose + wire a prod SMTP provider." This decision should also be recorded in `context/foundation/infrastructure.md` (which currently has no email story).

### Question

Which transactional email provider should MatmaVerse wire into **Supabase Auth custom SMTP** for production email-verification emails, given: **<1k emails/mo**, **free tier strongly preferred**, **EU data residency + a signable DPA preferred** (Polish children's app, GDPR-sensitive, Vercel `fra1` + EU Supabase), and **no custom sending domain yet**.

### Why this is needed (Supabase context)

Supabase's **built-in** SMTP only delivers to **pre-authorized team addresses** and is rate-limited to **2 messages/hour** — explicitly "not for production." Any real signup/verification flow **requires custom SMTP**. Enabling custom SMTP raises the default to **30 messages/hour** (adjustable: Auth → Rate Limits). Supabase officially names six known-working providers: **Resend, AWS SES, Postmark, SendGrid, Brevo, ZeptoMail** (others work via standard SMTP). Source: [Supabase custom SMTP docs](https://supabase.com/docs/guides/auth/auth-smtp).

### The decisive constraint: "no domain yet"

This is the differentiator. **"Verified domain" ≠ "verified single sender."** Most providers let you verify a single *email address* and send from it, but deliverability suffers without DKIM/SPF, and several gate production behind a domain or an approval ticket:

| Provider | Send to **arbitrary** recipients with **zero DNS / no domain**? |
|---|---|
| **Brevo** | **Yes** — uniquely. Rewrites `From` → `@brevosend.com` (and Return-Path) until you authenticate a domain; delivers to anyone at 300/day free. |
| Mailgun | Sandbox domain sends to **≤5 authorized recipients** only; arbitrary recipients need a verified custom domain (no approval ticket). |
| Amazon SES | Sandbox: only **verified recipients**, 200/24h; arbitrary recipients require a **production-access support ticket** + (effectively) DKIM domain. |
| Postmark / SendGrid | Single-sender works but **manual account approval** (Postmark) / **KYC review** (SendGrid) before sending to real users; weaker deliverability. |
| Mailjet | Single verified sender works but unauthenticated/freemail senders deliver poorly (spam risk). |
| **Resend** | **No** — `onboarding@resend.dev` is test-only (to your own address). **Production requires a verified domain.** |
| **Scaleway TEM** | **No** — requires a verified sending domain before **any** send. |

### Provider comparison (as of 2026-06-26)

| Provider | Free tier | EU residency + DPA | No-domain start | Supabase SMTP | Notes |
|---|---|---|---|---|---|
| **Brevo** (FR) | **300/day** (~9k/mo), permanent | French controller, GDPR + signable DPA (not hard sovereignty) | **Yes** (`@brevosend.com` rewrite) | `smtp-relay.brevo.com:587`, user=login, pass=SMTP master key; **Supabase-listed** | Free-tier "Sent with Brevo" footer; regen SMTP creds gotcha |
| **Mailjet** (FR/Sinch) | **6k/mo** (200/day cap) | EU datacenters, **ISO 27701/27001 + SOC 2**, DPA — strongest certs | Partial (single sender, poor deliverability) | `in-v3.mailjet.com:587`, user=API key, pass=secret key | 200/day overflow deleted after 3 days (moot at <1k/mo); Swedish parent |
| **Scaleway TEM** (FR) | 300/**mo** | **Best sovereignty** — Paris-only sovereign cloud, transactional-only | **No (domain required)** | `smtp.tem.scaleway.com:587`, user=Project ID, pass=IAM key | `fr-par` only; €0.25/1k after free |
| **Amazon SES** | 3k/mo × 12mo (then ~$0.10/mo at this volume) | EU regions incl. **Frankfurt** (eu-central-1) SMTP; AWS DPA | No (sandbox + ticket) | `email-smtp.eu-central-1.amazonaws.com:587`, **dedicated SMTP creds (not API key)** | Cheapest steady-state; sandbox-exit support ticket is the friction |
| **Mailgun** | 100/day, 1 domain | **EU region** (Frankfurt) + signable DPA | Sandbox ≤5 recipients | `smtp.eu.mailgun.org:587` | Must pick EU region at signup; first paid jumps to $15/mo |
| **Resend** | **3k/mo + 100/day**, permanent | EU **sending** region (Ireland) but **account data US-stored** (SCCs+DPA) | **No** | `smtp.resend.com:465`, user=`resend`, pass=API key; cleanest DX | Best DX; **domain required for prod**; not EU-resident |
| **Postmark** | 100/mo (tight) | **US-hosted**, DPA+SCCs (no EU) | Single sender + manual approval | `smtp.postmarkapp.com:587` | **Best deliverability**; 100/mo→10k/mo ($15) pricing cliff |
| **SendGrid** | **No permanent free** (60-day trial) | EU residency needs a (paid) subuser | Single sender + KYC review | `smtp.sendgrid.net:587`, user=`apikey` | **Avoid** for this profile: paid after 60d, KYC suspension risk |
| **MailPace** (EU) | ~100/mo (request-only) | EU-hosted, transactional-only | — | standard SMTP | Niche; $10/mo entry |

(OVHcloud / Infomaniak = mailbox SMTP, not transactional — avoid; Tuta = no sending API.)

### Recommendation (ranked for THIS profile)

**1. Brevo — the pick, layered:**
- **Now (no domain, dev → first prod):** Brevo free tier. It is the **only** provider that satisfies all three constraints at once — free (300/day ≫ <1k/mo), EU/GDPR with a signable DPA, **and** sends to real users with **zero DNS** — plus it's officially Supabase-listed. Accept the temporary `@brevosend.com` From-rewrite and the free-tier footer.
- **Before a credible production launch:** acquire a sending domain (**needed for the product regardless** — also the app's own URL, and the rewrite/footer hurt parent trust + deliverability) and authenticate it on Brevo (SPF+DKIM, DMARC recommended) — this removes the rewrite + footer.

**2. Alternatives once a domain exists:**
- **Amazon SES (Frankfurt)** — cheapest steady-state (~$0.10/mo), clean EU + AWS DPA; worth switching to if cost matters, after doing the one-time sandbox-exit + DKIM work.
- **Mailjet** — if formal certifications (ISO 27701/27001, SOC 2) are the deciding factor; 6k/mo free, EU datacenters.

**Avoid for this profile:** **SendGrid** (no real free tier, KYC risk), **Resend/Scaleway** as the *first* step (both block production without a domain — Resend otherwise has the best DX, reconsider it once you own a domain), **Postmark** (US-hosted, tiny free tier).

### Wiring the winner (Brevo) into Supabase Auth

1. Brevo → **SMTP & API** → generate an SMTP key (regenerate the SMTP login + master password if the login shows your signup email — known gotcha).
2. Supabase Dashboard → **Authentication → Emails → SMTP Settings**: Sender email + Sender name; **Host** `smtp-relay.brevo.com`; **Port** `587` (STARTTLS); **Username** = Brevo login; **Password** = SMTP master key. Raise the 30/hour limit on **Auth → Rate Limits** if needed.
3. **Polish templates (FR-013):** Supabase has **no built-in localization** — author Polish copy directly in **Auth → Email Templates → "Confirm signup"** (and resend), keeping the Go-template variables intact. For our token_hash confirm route (see plan Phase 4), the link is `{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=signup`. Available vars: `{{ .ConfirmationURL }}`, `{{ .TokenHash }}`, `{{ .Token }}` (6-digit OTP), `{{ .SiteURL }}`, `{{ .Email }}`, `{{ .RedirectTo }}`, `{{ .Data }}`. (Per-locale emails later would need the Auth "Send Email" hook + an Edge Function — out of scope for v1's single locale.) Source: [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates).
4. Set `additional_redirect_urls` / the hosted project's **Redirect URLs** to include the prod + preview `/api/auth/confirm` and `/app` targets (the plan's launch prerequisite).

### Confidence & flags

- **High confidence:** Brevo 300/day free + EU + Supabase-listed + zero-DNS sending; Resend/Scaleway require a domain for prod; SES sandbox + dedicated-SMTP-creds; Supabase built-in 2/hr + custom 30/hr; Polish-templates-in-dashboard approach.
- **Re-verify at signup (pricing/limits drift):** exact entry-tier prices (Brevo ~$9, Mailjet ~$17, in EUR/with PL VAT); SendGrid EU-subuser availability on low tiers (least-verified); Brevo's *physical* EU-datacenter guarantee (confirmed: French controller + GDPR processor + DPA, not an explicit EU-only-hosting promise — Scaleway/Mailjet are stronger on hard sovereignty); each provider's DPA sub-processor list before signing.
- **Note:** none of the US-DX leaders (Resend/Postmark/SendGrid) offers *true* EU-only data residency on a free/low tier; the EU-native trio (Brevo/Mailjet/Scaleway) do — reinforcing Brevo as the EU-preferring pick.
