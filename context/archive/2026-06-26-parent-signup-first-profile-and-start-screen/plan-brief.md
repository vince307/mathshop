# S-01a — Parent Signup + Email Verification + Polish Auth Foundation — Plan Brief

> Full plan: `context/changes/parent-signup-first-profile-and-start-screen/plan.md`
> Research: `context/changes/parent-signup-first-profile-and-start-screen/research.md`

## What & Why

**Part A of roadmap slice S-01** (split during planning). Build the auth/verification/localization foundation: a first-time parent signs up, gets a real email-verification link, confirms it to establish a session, and lands authenticated in a 100% Polish UI — with the auth-cookie spine hardened and the English-error leak closed. This is the gate every later MatmaVerse slice sits behind.

## Starting Point

Password auth exists but: signup never sends a verification email (the confirm page is static and establishes no session), there's no code-exchange/confirm route, all copy is hardcoded English with the raw Supabase error leaking via `?error=`, and the SSR cookie client omits the anti-CDN-cache headers `@supabase/ssr` now requires. The F-01 `child_profiles` table + RLS and the `testing-auth-critical-path` test harness are in place.

## Desired End State

Sign up (Polish) → verification email (locally captured by inbucket) → click link → authenticated on a gated Polish `/app` landing. Errors are Polish, auth responses are non-cacheable, signout always clears the session, and the suite is green (new confirm-route + error-mapping tests; the old known-issue pins now assert the fixed behavior).

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Verification mechanism | Password + **full** email verification | Answers PRD Open Q#1 as password; build the real round-trip. | User |
| Confirm flow | `token_hash` + `verifyOtp` (`/api/auth/confirm`) | Self-contained (no PKCE cookie), SSR-recommended, and testable via `admin.generateLink`. | Plan |
| Prod email infra | Build code now; **defer** SMTP/templates/allow-list to a launch prerequisite. Provider decided: **Brevo** (EU, free, zero-DNS start) | Keeps the slice about app code; prod email isn't configured anywhere yet. | User + Research |
| English-error leak | Fix in this slice (Polish error-mapping at the route) | FR-013 is a hard guardrail; same auth surface. | User |
| Auth-spine hardening | Fold in (anti-cache headers + cookie hardening + signout fixes) | Verification responses must be non-cacheable; cheap, same files; retires pinned issues. | User |
| Slice size | **Split**: this = Part A (auth); Part B (profile+start) is a new change | Slice grew large; matches the research's A/B seam + roadmap split flag. | User |
| Brand name | **MatmaVerse** (supersedes MathShop/MathMarket) | Matches the design folder; one i18n constant now, docs sweep later. | User |
| Child-name field (Part B) | Product owner **overrides** the no-child-PII guardrail to collect it | Owner's call; recorded as a decision-of-record; PRD to be updated. | User |

## Scope

**In scope:** Polish i18n dictionary + `lang="pl"` + MatmaVerse brand; Polish error-mapping (closes the leak); `setAll` anti-cache headers + cookie hardening + signout fixes + `prerender=false` on auth routes; full verification (`emailRedirectTo` + `/api/auth/confirm` + `verifyOtp` + interstitial/resend); a gated Polish `/app` landing + authed→`/app` redirects.

**Out of scope:** the `child_profiles` migration, avatar registry, profile wizard (incl. child-name PII), create-profile API, start screen, and the profile-count router → **Part B**. Prod SMTP/Polish-templates/allow-list → **launch prerequisite**. Forgot-password/parent-PIN; the full brand docs sweep.

## Architecture / Approach

Five auth-foundation-first phases on the existing SSR + React-islands stack, no new deps. The `token_hash` confirm route writes the session cookie through the hardened SSR client; both signin and confirm funnel to one `/app` landing that Part B will turn into the profile-count router. Strings live in a typed `src/i18n/pl.ts` dictionary imported directly by `.astro` and islands (mirrors `config-status.ts`).

## Phases at a Glance

| Phase | Delivers | Key risk |
| --- | --- | --- |
| 1. Localization + brand | Polish dictionary, `lang=pl`, MatmaVerse; Polishized auth surfaces | Island prop/serialization gotchas |
| 2. Polish error-mapping | `auth-errors.ts`; English leak closed (flips a test pin) | Mapping on `code` not message; Supabase-version coupling |
| 3. Auth-spine hardening | anti-cache headers + cookie hardening + signout fixes | Touches the shared client — rerun the auth suite |
| 4. Full email verification | `/api/auth/confirm` (`verifyOtp`) + emailRedirectTo + interstitial/resend | Testing the confirm path locally (use `admin.generateLink`) |
| 5. Authenticated landing | gated Polish `/app`; signin/confirm land there; authed→`/app` | `startsWith` gate has no boundary — pick prefixes carefully |

**Prerequisites:** local Supabase + `.env.test`; mockups `01`/`02`/`03` on this machine.
**Estimated effort:** ~2 sessions across 5 phases.

## Open Risks & Assumptions

- **Production verification can't work until the launch prerequisites land** (SMTP provider, `enable_confirmations` ON in prod, Polish templates, prod redirect allow-list) — Part A builds + tests the code only.
- **PRD conflict of record:** collecting the child's name (Part B) overrides a privacy guardrail — the PRD must be updated so reviews don't flag it.
- Hardening `supabase.ts` touches every auth flow — the existing green suite is the regression backstop.

## Success Criteria (Summary)

- A parent can sign up → verify via the emailed link → reach an authenticated Polish `/app`.
- No English leaks anywhere user-visible; auth-cookie responses are non-cacheable; signout always clears the session.
- `npm test` + `npm run build` + `npm run lint` all green, including new confirm-route and error-mapping tests.
