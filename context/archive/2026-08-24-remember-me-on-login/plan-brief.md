# Honest "remember me" on parent login — Plan Brief

> Full plan: `context/changes/remember-me-on-login/plan.md`
> Research: `context/changes/remember-me-on-login/research.md`
> Identity + audit: `context/changes/remember-me-on-login/change.md`

## What & Why

Backlog **A3** asks what a "remember me" control on the parent login can *honestly*
change, so it does not become the fifth decorative toggle in this codebase. The answer:
per-login session *length* is not a knob that exists (Supabase's `signInWithPassword`
accepts only `captchaToken`; `jwt_expiry` and `[auth.sessions]` are project-wide), but
**cookie persistence is** — and it maps 1:1 onto an observable, testable difference. So we
ship it.

## Starting Point

The mockup draws the control; the app has none. `SignInForm` renders two fields and a
button, and the "Nie pamiętasz hasła?" link sits *outside* the form, centred below it. More
importantly, `setAll` in `src/lib/supabase.ts` never touches `maxAge`, so every login today
silently inherits `@supabase/ssr`'s 400-day default — an unchosen "remember me" nobody
ticked.

## Desired End State

The login card matches the mockup: an unchecked "Zapamiętaj mnie" checkbox sharing a row
with a right-aligned reset link. Unticked (the default) gives a browser-session cookie that
dies when the window closes; ticked gives an explicit 30 days that **survives the hourly
token refresh**. Signing out expires both cookies.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Ship or close as non-goal | Ship | Cookie persistence is a real, testable knob — the escape hatch assumed only token lifetime was on the table | Change |
| Semantics | Unticked = session cookie, ticked = 30 days | The only per-login knob that exists, and the one that matters on a shared family device | Change (D2) |
| Persisting the choice | Unsigned `remember_me` marker cookie | The auth cookie is re-written on every refresh; a choice held only in the sign-in request reverts ~1h later | Research |
| Signing the marker | No HMAC | Forging it lengthens only the attacker's own cookie — unlike the reset/PIN markers, it grants no privilege | Research |
| Verification layer | Vitest against the real routes; no new e2e | A session cookie is distinguished only by a browser restart, which Playwright cannot do, and poking `sb-…-auth-token` by name is banned by `e2e/CLAUDE.md` | Research (R3) |
| The load-bearing test | The **ticked** case surviving a refresh | Corrects research §C.3, which named the unticked case — absence-of-marker is the default branch and is refresh-stable by construction | Plan (AD-6) |
| Sign-out safety | Guard removals in `setAll` | Removals travel through the same `setAll` with `maxAge: 0`; an unguarded override blanks the cookie instead of expiring it, and the existing suite stays green through it | Plan |
| Checkbox component | The vendored Radix `Checkbox`, with `name` | Matches the design system; the `name`-prop trap is covered by a component test and a deliberate break | Plan (AD-3) |
| zod on the signin route | Declined | A test's *name* pins the current absence of validation, so it is not a drive-by | Research (R4) |

## Scope

**In scope:** a `remember-me` marker service; the `maxAge` seam in `setAll`; marker write at
sign-in and clear at sign-out; the checkbox row and the moved reset link; one i18n key; two
new test files; one new contract-surface section.

**Out of scope:** any migration or schema change; zod on the signin route; `[auth.sessions]`
/ `jwt_expiry` changes; a new e2e spec; edits to `e2e/helpers/accounts.ts`; a sliding marker
window; remember-me on child or PIN surfaces.

## Architecture / Approach

One seam, one marker, two routes:

```
POST /api/auth/signin
  form.has("remember") ──► setRememberChoice(cookies, remember)   [BEFORE signInWithPassword]
                                     │  writes/deletes  remember_me (30d, httpOnly)
                                     ▼
  signInWithPassword() ──► @supabase/ssr ──► createClient's setAll(…)
                                                 │ reads authCookieMaxAge(cookies)
                                                 ▼
                                   sb-…-auth-token  Max-Age=30d  |  (no Max-Age)

later: token refresh ──► same setAll ──► re-reads the marker ──► same lifetime
POST /api/auth/signout ──► signOut() removal passes through untouched (maxAge 0)
                        └─► delete remember_me
```

The marker exists because `setAll` runs again on every refresh with no memory of the
sign-in request. The removal guard exists because sign-out's cookie deletion travels through
that same function.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Seam + marker | The whole behaviour, no UI: service, `setAll`, both routes, 7 route tests, 3 deliberate breaks | Overriding the lifetime on *removals* silently downgrades sign-out from expiry to blanking — and nothing existing catches it |
| 2. Checkbox row | i18n key, the row in `SignInForm`, the link moved off the page, 3 component tests | Radix `Checkbox` without `name` posts nothing; every route test still passes |
| 3. Surface + regress | New `contract-surfaces.md` section; full lint/check/unit/Playwright sweep | `signInViaUI` funnels every authenticated spec through this form — a hydration or locator regression here fails the whole e2e suite |

**Prerequisites:** local Supabase up (`npx supabase status`, API on `127.0.0.1:54321`) and
suites run with the command sandbox disabled; a worktree with an assigned `E2E_PORT`;
`assets/matmaverse-auth-v2-web/01-parent-login-web.png` if present (it was opened during
planning and its layout is recorded in the plan for worktrees that lack it).
**Estimated effort:** ~1 session; roughly 60 lines of source, 200 of tests.

## Open Risks & Assumptions

- **The marker's 30 days do not slide** (AD-4): a parent using the app continuously for 30+
  days will be signed out once on browser close and must re-tick. Cheapest fix if rejected:
  give the marker a longer `maxAge` than the auth cookie.
- **Coverage stops at the options object** (AD-5): the jar captures options but does not
  serialise or expire cookies, so "no `Max-Age` attribute" is verified by reading
  `cookie` 1.1.1's `if (cookie.maxAge !== undefined)` guard, not asserted in a test. One
  known-uncovered break: writing the marker itself as a session cookie leaves every test
  green.
- **Assumption to be re-verified at implementation:** that Radix's hidden `BubbleInput`
  submits under Astro's `client:load` island. Phase 2's component test is what surfaces it
  if not, before anything ships.
- **`ownership.md` does not exist**; the plan self-declares F2's footprint (AD-9) and is
  overridden on sight if the sweep writes one.
- **Behaviour migration, no data migration:** existing signed-in parents drop from a 400-day
  cookie to a session cookie the next time they sign in without ticking. Accepted — no
  production users yet.

## Success Criteria (Summary)

- A parent who leaves the box unticked and closes the browser is asked to sign in again; a
  parent who ticks it is not, for 30 days — including after the token has refreshed.
- Signing out ends the session on that browser and forgets the choice.
- The login card matches the mockup, and every existing authenticated e2e spec still signs
  in through it unchanged.
