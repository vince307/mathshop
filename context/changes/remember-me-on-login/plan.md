# Honest "remember me" on parent login — Implementation Plan

## Overview

Ship the mockup's **"Zapamiętaj mnie"** control on the parent login as a real,
verifiable behaviour: the checkbox decides the **persistence of the Supabase auth
cookie**, and nothing else. Ticked ⇒ the `sb-…-auth-token` cookie carries an explicit
30-day `Max-Age`. Unticked (the default) ⇒ it carries no `Max-Age` at all and dies with
the browser session.

The choice is persisted in an unsigned `remember_me` marker cookie, because
`@supabase/ssr` re-writes the auth cookie on **every token refresh** — a choice held only
in the sign-in request is silently reverted about an hour later.

**Scope correction (plan review).** "Nothing else" is about *policy*, not about *reach*.
`setAll` is the write path for **every** auth-cookie write in the app, and only one of the
four sessions-establishing routes carries a checkbox. See *Blast radius beyond sign-in* under
Current State Analysis — that consequence is accepted and deliberate, not overlooked.

## Current State Analysis

- **`createClient` / `setAll` (`src/lib/supabase.ts`) is the single seam.** `setAll` does
  `cookies.set(name, value, { ...options, ...AUTH_COOKIE_OPTIONS })`.
  `AUTH_COOKIE_OPTIONS` carries only `httpOnly` / `sameSite` / `secure`, so the library's
  own `maxAge` survives untouched — today **every** login gets a 400-day cookie nobody
  chose (`DEFAULT_COOKIE_OPTIONS.maxAge = 400 * 24 * 60 * 60` in
  `node_modules/@supabase/ssr/dist/main/utils/constants.js`).
- **`createServerClient`'s `cookieOptions` is not a seam.** In `@supabase/ssr` 0.10.3 both
  write paths build an object literal named `setCookieOptions` as
  `{ ...DEFAULT_COOKIE_OPTIONS, ...cookieOptions, maxAge: DEFAULT_COOKIE_OPTIONS.maxAge }`
  — the library re-asserts its own `maxAge` **after** the caller's. Anything passed there
  is silently discarded. (Anchor on the identifier `setCookieOptions` in
  `node_modules/@supabase/ssr/dist/main/cookies.js`; it occurs twice.)
- **Per-login session *length* is not a knob that exists.**
  `SignInWithPasswordCredentials` accepts only `{ captchaToken? }`; `jwt_expiry = 3600`,
  `enable_refresh_token_rotation` and the (commented-out) `[auth.sessions]` block in
  `supabase/config.toml` are project-wide. Cookie persistence is the only per-login knob.
- **The rewrite fires on refresh, not on every request** (measured by the research step's
  live spike): `signInWithPassword` → 1 write at 400 days; `getUser()` with a valid token
  → **0 writes**; `refreshSession()` → 1 write at 400 days again.
- **`SignInForm` (`src/components/auth/SignInForm.tsx`)** renders two `FormField`s,
  `ServerError`, `SubmitButton` — no checkbox. The reset link lives *outside* the form, in
  `src/pages/auth/signin.astro`, centred below `<SignInForm>`.
- **`src/components/ui/checkbox.tsx` exists and is used nowhere in `src/`.** It is Radix:
  `Root` renders `<button role="checkbox">` and posts a form value only through a hidden
  `BubbleInput` that is rendered **only when a `name` prop is supplied**.
- **`createCookieJar` (`tests/helpers/astro.ts`) stores the real `options` object of every
  cookie write** (`StoredCookie.options`) and no test has ever asserted on it. This feature
  is that capability's first customer.
- **Blast radius beyond sign-in (found during plan review; in no prior document).** `setAll`
  is not sign-in's write path — it is *every* auth-cookie write path. Four routes establish a
  session through it, and only `POST /api/auth/signin` has a checkbox:
  `POST /api/auth/signup` (a session when auto-confirm is on), `GET /api/auth/confirm`
  (`verifyOtp` — both the email-verification and the password-recovery entry points), and
  `POST /api/auth/update-password`. None of them writes a `remember_me` marker, so under this
  change each yields a **browser-session** auth cookie where today it yields 400 days.
  Concretely: a parent who verifies their email, or who completes a password reset, is signed
  in only until the browser closes and has no way to opt in on that request. **Accepted, and
  deliberately so** — it is the same stricter default the checkbox ships, and the recovery is
  one sign-in with the box ticked. It is recorded here because it is a real behaviour change
  with no phase and no test of its own, and because the honest alternative (defaulting those
  routes to `REMEMBER_ME_MAX_AGE_SECONDS`) would make "remember me" mean *less* than the
  paths that never ask. *What would change the answer:* a maintainer who judges the
  post-verification sign-out unacceptable calls `setRememberChoice(cookies, true)` in
  `GET /api/auth/confirm` before `verifyOtp` — one line, no mechanism change. **Do not** try
  to special-case this inside `setAll`; the seam cannot tell which route it is serving.
  (Not applicable: PKCE. This project confirms with `token_hash` + `verifyOtp`, never
  `exchangeCodeForSession`, so no `-code-verifier` cookie is ever written through `setAll`.)

## Desired End State

The parent login shows an unchecked "Zapamiętaj mnie" checkbox sharing a row with a
right-aligned "Nie pamiętasz hasła?" link, exactly as the mockup draws it. Signing in
without ticking it produces a browser-session auth cookie; ticking it produces a 30-day
one that **still carries 30 days after the token refreshes**. Signing out expires the
cookie and clears the marker. Verified by unit tests that assert the real options object
the real routes produced, plus a component test proving the rendered form actually posts
the field.

### Key Discoveries

- **`maxAge: undefined` is the mechanism, not omission.** A spread cannot delete a key and
  the library's 400-day value is already in `options`, so the naive "just don't set
  `maxAge`" does nothing. `AstroCookies.set` does `Object.assign(serializeOptions, options)`
  and hands it to `serialize()` from `cookie` 1.1.1, whose guard is
  `if (cookie.maxAge !== undefined)` (verified in `node_modules/cookie/dist/index.js`) —
  so an explicit `undefined` **removes** the attribute.
- **NEW, found while planning — removals travel through the same `setAll`.**
  `applyServerStorage` builds `removeCookieOptions` as `{ ...DEFAULT_COOKIE_OPTIONS,
  ...cookieOptions, maxAge: 0 }` and sends removals through `setAll` with `value: ""`. An
  unguarded lifetime override therefore turns **sign-out** into an empty-valued *session*
  cookie instead of an expired one — and `tests/auth-session-gating.test.ts` stays green
  through it, because the jar's `toCookieHeader()` filters empty values. See Phase 1's
  removal guard and its test.
- **Read the marker with `cookies.get()`, never from the `Cookie:` header.** `getAll` reads
  only `requestHeaders`, where the marker does not exist yet on the sign-in request that
  sets it. `AstroCookies.get` checks its outgoing map first (and correctly returns
  `undefined` for a key deleted earlier in the same request — verified in
  `node_modules/astro/dist/core/cookies/cookies.js`, the `isSetValue` branch).
- **This marker must not be signed.** `RESET_MARKER_COOKIE` and `PARENT_VERIFIED_COOKIE`
  are HMAC-signed because forging them *grants a privilege*. Forging remember-me lengthens
  only the attacker's own cookie on their own browser. Copy the option shape of
  `setActiveProfileCookie` (`src/lib/services/active-profile.ts`), not the crypto.
- **The default becomes stricter, not looser.** Today every login is an unchosen 400-day
  "remember me". Shipping a checkbox labelled "remember me" *shortens* the default.
- **L-007 verified programmatically during planning:** `"Zapamiętaj mnie"` is neither a
  substring nor a superstring of any value in `src/i18n/pl.ts`. `"Nie pamiętasz hasła?"`
  is already **two** values (`auth.reset.heading`, `auth.reset.signinLinkLabel`); the moved
  link must keep using `signinLinkLabel` and the two must never render on one page.

## What We're NOT Doing

- **No new e2e spec.** Cookie persistence is not honestly browser-verifiable here: a
  session cookie is distinguished only by surviving a browser restart, which Playwright
  cannot do; `storageState` serialises session cookies too (and is banned project-wide);
  and reading `sb-…-auth-token` by name would require extending the **closed** cookie-poking
  exception list in `e2e/CLAUDE.md`. The existing suite is re-run as a regression check.
- **No zod on `src/pages/api/auth/signin.ts`.** Pre-existing `CLAUDE.md` violation;
  `tests/auth-routes.test.ts` has a test whose *name* pins the absence of validation, so
  the fix is not a drive-by. Filed, not fixed here.
- **No `[auth.sessions] timebox` / `inactivity_timeout` / `jwt_expiry` change.** Those are
  project-wide server policy and a separate decision.
- **No migration, no new table, no new column.** Nothing account-owned is stored, so L-001
  does not apply to this change.
- **No changes to `e2e/helpers/accounts.ts`** — `signInViaUI` fills by `getByLabel` and
  submits by `getByRole("button")`, both untouched by adding a row above the button. F1
  owns edits to that file this run.
- **No sliding marker window.** The marker's 30 days are fixed at sign-in and do not
  extend on refresh (see Autonomous decision AD-4).
- **No remember-me on the child or parent-PIN surfaces.** The PIN marker's 15-minute TTL is
  a deliberate, separate security posture.

## Implementation Approach

Three phases, each independently green and committable:

1. **Behaviour first, no UI.** The marker service, the `setAll` seam, the marker write in
   the signin route and its clear in the signout route. The route already receives a
   form body, so the whole behaviour is drivable and testable through the real routes with
   no rendered markup at all. Seven unit tests plus three deliberate breaks land here.
2. **UI second.** i18n key, the checkbox row in `SignInForm`, the reset link moved into it,
   the page cleaned up. One component test — the only layer that can prove the *rendered*
   form posts the field, which Phase 1's route tests cannot see.
3. **Register the contract surface and regress everything**, including the full Playwright
   run that proves `signInViaUI` still works after the form changed.

## Critical Implementation Details

**Ordering inside `POST /api/auth/signin`.** The marker must be written **after** the
null-client guard and **before** `signInWithPassword` — that call is what triggers
`setAll`, and `setAll` reads the marker through `cookies.get()`. Writing it after the
sign-in makes the first sign-in write the wrong lifetime and then *self-heal* on the next
refresh; writing it before the null-client guard leaves a stray marker on the
env-missing error redirect.

**The marker write is unconditional.** Both branches run on every sign-in: ticked ⇒ set,
unticked ⇒ delete. Without the delete branch, a parent who ticked the box once keeps a
30-day cookie forever, because the stale marker re-lengthens every later sign-in.

---

## Phase 1: Cookie-lifetime seam and the remember-me marker

### Overview

Make the auth cookie's lifetime a function of a persisted choice, wire the choice into the
signin and signout routes, and pin all of it — including the refresh path and the sign-out
removal path — with unit tests against the real routes and the real local Supabase.

### Changes Required

#### 1. Remember-me marker service

**File**: `src/lib/services/remember-me.ts` (new)

**Intent**: Own the remember-me choice end to end — the cookie name, the one chosen
lifetime, and the read/write/clear helpers — so `supabase.ts` and both auth routes share a
single definition. Deliberately unsigned, unlike its two marker siblings; the module doc
must say why, because a reviewer who sees "marker cookie" will otherwise reach for
`signMarker` by analogy.

**Contract**:

- `export const REMEMBER_ME_COOKIE = "remember_me"`
- `export const REMEMBER_ME_MAX_AGE_SECONDS = 30 * 24 * 60 * 60` — an explicitly chosen
  30 days, against the library's unchosen 400.
- `export function setRememberChoice(cookies: AstroCookies, remember: boolean): void` —
  when `true`, writes `"1"` with `{ httpOnly: true, sameSite: "lax", secure:
  import.meta.env.PROD, path: "/", maxAge: REMEMBER_ME_MAX_AGE_SECONDS }` (the option shape
  of `setActiveProfileCookie`, plus the `maxAge` that one deliberately omits); when
  `false`, `cookies.delete(REMEMBER_ME_COOKIE, { path: "/" })`.
- `export function authCookieMaxAge(cookies: AstroCookies): number | undefined` — returns
  `REMEMBER_ME_MAX_AGE_SECONDS` when `cookies.get(REMEMBER_ME_COOKIE)?.value === "1"`,
  otherwise `undefined`.

The reader returns a `number | undefined`, not a boolean, on purpose: `undefined` **is**
the mechanism that removes the attribute, and a boolean return invites the caller to write
`maxAge: remember ? N : 0` — which expires the auth cookie instantly and logs everyone out.

#### 2. The lifetime seam

**File**: `src/lib/supabase.ts` — `createClient`'s `setAll`

**Intent**: Apply the chosen lifetime to every auth-cookie *write*, and leave every
*removal* exactly as the caller built it.

**Contract**: `setAll` sets `maxAge` explicitly after the two existing spreads. A write
whose incoming `options.maxAge === 0` is a removal (`removeCookieOptions` in the library's
`applyServerStorage`; the same idiom `clearAuthCookies` uses) and passes through untouched.
Everything else gets `authCookieMaxAge(cookies)`.

`maxAge` must **not** be added to `AUTH_COOKIE_OPTIONS`: that object is also spread by
`clearAuthCookies`, where it would override the deliberate `maxAge: 0` and break sign-out
on the env-missing path too.

Snippet warranted — the removal guard and the explicit `undefined` are both counterintuitive:

```ts
setAll(cookiesToSet) {
  cookiesToSet.forEach(({ name, value, options }) => {
    // Removals (sign-out, chunk cleanup) arrive here as value:"" + maxAge:0.
    // Overriding their lifetime would blank the cookie instead of expiring it.
    const isRemoval = options?.maxAge === 0;
    cookies.set(name, value, {
      ...options,
      ...AUTH_COOKIE_OPTIONS,
      ...(isRemoval ? {} : { maxAge: authCookieMaxAge(cookies) }),
    });
  });
}
```

#### 3. Write the choice at sign-in

**File**: `src/pages/api/auth/signin.ts` — `POST`

**Intent**: Record the parent's choice before the sign-in call that writes the auth cookie.

**Contract**: read the checkbox as `form.has("remember")` — HTML omits unchecked
checkboxes entirely, so presence is the signal and no value comparison can drift if the
control's `value` ever changes. Call `setRememberChoice(context.cookies, remember)`
unconditionally, positioned after the `if (!supabase)` guard and before
`await supabase.auth.signInWithPassword(...)`. Add a comment naming the ordering
requirement. No zod (see *What We're NOT Doing*); `form.has` needs none.

A failed sign-in leaves the marker written but no session — inert, and overwritten or
deleted by the next attempt. Accepted, no cleanup branch.

#### 4. Clear the choice at sign-out

**File**: `src/pages/api/auth/signout.ts` — `POST`

**Intent**: A sign-out must not leave the next parent on this browser inheriting the
previous one's persistence choice.

**Contract**: `context.cookies.delete(REMEMBER_ME_COOKIE, { path: "/" })` alongside the
existing `ACTIVE_PROFILE_COOKIE` and `PARENT_VERIFIED_COOKIE` deletes, with the same
"per-session state" comment block extended by one clause.

#### 5. Route-level tests

**File**: `tests/remember-me-cookie.test.ts` (new) — modelled on
`tests/password-reset-marker.test.ts` for naming and on `tests/auth-routes.test.ts` for the
real-route + real-Supabase pattern (`createSignedInUser` / `deleteUser` / `PASSWORD`,
`buildContext` + `createCookieJar`).

**Intent**: Assert the **real options object** the **real routes** produced. The refresh
tests are the load-bearing ones: `getUser()` writes nothing while the token is valid, so a
broken implementation is indistinguishable from a correct one for a full hour.

**Contract** — seven tests:

| # | Test | What it pins |
|---|---|---|
| 1 | signin **without** `remember` → the `sb-…-auth-token` write has `maxAge === undefined`, and no `remember_me` entry exists in the jar | the new, stricter default |
| 2 | signin **with** `remember` → that write has `maxAge === REMEMBER_ME_MAX_AGE_SECONDS` | the ticked branch, and the same-request `cookies.get()` read path (§B.3) |
| 3 | the `remember_me` write itself carries `maxAge === REMEMBER_ME_MAX_AGE_SECONDS` | the marker must outlive the browser session, or every remembered session silently reverts on the next launch |
| 4 | **(load-bearing)** signin with `remember` → build a client from the jar → `auth.refreshSession()` → the new auth-token write **still** has `maxAge === REMEMBER_ME_MAX_AGE_SECONDS` | the refresh path; the only check that sees a request-scoped implementation |
| 5 | signin without `remember` → `refreshSession()` → the re-write still has `maxAge === undefined` | that the library's 400-day default can never leak back in |
| 6 | a jar pre-seeded with `remember_me=1`, signin **without** `remember` → the marker is gone from the jar and the auth-token write has `maxAge === undefined` | the delete branch — the stale-marker bug |
| 7 | signout with a real client → the auth-token write has `maxAge === 0` and `value === ""` | the removal guard; nothing else in the repo catches its loss |

Locate the auth cookie in the jar by the existing `^sb-.+-auth-token(\.\d+)?$` shape — never
by a hard-coded project ref. **Decided during plan review:** `AUTH_COOKIE_RE` in
`src/lib/supabase.ts` is currently a module-private `const`; **add `export` to it** and import
it in the test rather than re-declaring the pattern. A second copy of this regex is exactly
the drift the Phase 3 contract-surface entry exists to prevent. Adding the keyword is a
one-token edit to a file F2 already owns (AD-9), and `clearAuthCookies` — its only current
consumer — is untouched. For tests 4 and 5, build
the client from the jar the way `userFromJar` in `tests/auth-routes.test.ts` does (replay
`toCookieHeader()` into a fresh `Headers`, pass the jar as `AstroCookies`). Refresh-token
rotation is on, so each test mints its own session and refreshes once.

**Honest limit to record in the test file's doc comment:** the jar captures options, it
does not serialise or expire cookies. Test 3 therefore proves the marker is *written* as
persistent, not that a browser keeps it; and tests 1/5 prove the option is `undefined`, not
that the `Set-Cookie` header lacks `Max-Age`. The header-level step is `serialize()`'s
`if (cookie.maxAge !== undefined)` guard in `cookie` 1.1.1, verified by reading it (see
AD-5 for why it is not asserted in a test).

### Success Criteria

#### Automated Verification

- `npm run lint` — clean
- `npm run check` — clean
- `npm test` — **baseline + 7** (measure the baseline on this branch before starting; it
  was 429 / 51 files on `matmaverse-v2` @ `282d264`)
- Deliberate break B: delete the `isRemoval` guard in `setAll` → **test 7 red, tests 1–6
  green**; restore
- Deliberate break C: make `setRememberChoice`'s `false` branch a no-op → **test 6 red, all
  others green**; restore
- Deliberate break D: make `setAll` take the choice from a `remember` argument threaded
  through `createClient` from the signin route instead of reading the cookie → **test 4
  red, tests 1, 2, 3, 5, 6, 7 green**; restore

#### Manual Verification

- Sign in with `remember` posted (curl or devtools), then inspect the response
  `Set-Cookie`: `sb-…-auth-token` carries `Max-Age=2592000`; without it, no `Max-Age`
- Sign out and confirm the auth cookie's `Set-Cookie` still carries `Max-Age=0` (i.e. the
  browser drops it) and that `remember_me` is expired too

**Break meta-checks (L-004) — record all three in the handoff:**

- **B** is the break with *no other coverage in the repo*: `tests/auth-session-gating.test.ts`'s
  sign-out test stays green through it, because the jar's `toCookieHeader()` filters
  empty-valued cookies. Test 7 going red *alone* is the evidence that the guard is
  load-bearing rather than defensive decoration.
- **C** reddens only test 6, which is the only test that exercises the previously-remembered
  path. If any other test also goes red, test 6 is not isolating what it claims to.
- **D** is the realistic wrong implementation — thread `remember` down the call chain
  instead of persisting it — and test 4 is the only check that observes it. **The research
  doc's §C.3 predicted the *unchecked* refresh case would be the red one; that is wrong
  under this design and must not be inherited.** Absence-of-marker is the default branch, so
  the unchecked case is refresh-stable by construction; it is the *remembered* session that
  silently downgrades. Test 5 is still worth keeping (it pins that 400 days never returns),
  but it is not the load-bearing one.
- **Known uncovered break:** writing the marker as a *session* cookie leaves every test
  green, because the jar does not model expiry. Test 3's options assertion is the closest
  available proxy and is deliberately an options assertion, not a behavioural one.

**Implementation Note**: after automated verification passes, the manual checks above are
recorded as pending in `## Progress` and the run proceeds — no human is in the loop
(agent contract, hard rule 1).

---

## Phase 2: The checkbox row in the sign-in form

### Overview

Add the mockup's control and move the reset link onto its row, then prove the *rendered*
form actually posts the field — the fact Phase 1's route tests structurally cannot see.

### Mockup (observed first-hand during planning)

`assets/` is gitignored, so a worktree, a fresh clone or CI will not have the file. The
web mockup `assets/matmaverse-auth-v2-web/01-parent-login-web.png` **was opened during this
planning step** and shows, inside the white card: heading block → "Email" field → "Hasło"
field → **one row: an unchecked square checkbox with "Zapamiętaj mnie" on the left, a blue
"Nie pamiętasz hasła?" on the right** → the full-width blue "Zaloguj się" button → a "lub"
divider → the outlined "Nie masz konta? **Utwórz konto**" button. The reset link is
**blue/primary-coloured**, not muted as it is today. If `assets/` is present in the
implementation worktree, open the PNG again; if it is absent, this paragraph is the binding
description and the layout is inherited observation, not extrapolation.

### Changes Required

#### 1. Dictionary key

**File**: `src/i18n/pl.ts`

**Intent**: The label, in Polish, through the dictionary (L-003).

**Contract**: append `rememberLabel: "Zapamiętaj mnie"` inside the existing `auth.signin`
object. **Append-only, one entry** (concurrency contract) — do not restructure the object.
Re-run the both-directions substring check before committing; it was clean at planning
time.

#### 2. The checkbox row

**File**: `src/components/auth/SignInForm.tsx`

**Intent**: Render the mockup's row between the password field and the submit button, and
make it post `remember` when ticked.

**Contract**: a `flex items-center justify-between` row placed after the password
`FormField` and before `<ServerError>` (which stays directly above `<SubmitButton>`).

- Left: `<Checkbox id="remember" name="remember" />` from `@/components/ui/checkbox` plus
  `<Label htmlFor="remember">{t.auth.signin.rememberLabel}</Label>`. **Uncontrolled** — no
  React state, no `validate()` participation; the native form posts it.
- Right: `<a href="/auth/reset-password">{t.auth.reset.signinLinkLabel}</a>`, styled
  `text-primary text-sm font-medium hover:underline` to match the mockup's blue link.
- Classes merged with `cn()` from `@/lib/utils`.

**Trap (research §D.2, mechanism corrected during plan review)**: Radix's `Root` renders
`<button role="checkbox">` and posts a value only through its hidden `CheckboxBubbleInput`.
**Correction:** that input is *not* gated on `name`. In `@radix-ui/react-checkbox` 1.3.5
(reached through the `radix-ui` umbrella package this repo imports) the Root renders it as
`isFormControl && <CheckboxBubbleInput/>`, where `isFormControl` is
`control ? !!form || !!control.closest("form") : true` — i.e. always true inside a `<form>`.
So the hidden `<input type="checkbox" aria-hidden name={name} value={value ?? "on"}>` is
always present; omitting `name` merely leaves it **nameless**, and a nameless control is
dropped by `FormData`. The consequence research warned about is unchanged — omit `name` and
the entire feature is a silent no-op that every Phase-1 test still passes — but the failure
looks like a *missing attribute*, not a missing element. Anchor on the identifier
`CheckboxBubbleInput` in `node_modules/@radix-ui/react-checkbox/dist/index.mjs`. `<button>` is a labelable element, so `Label htmlFor="remember"` is what
gives `getByLabel` / `getByRole("checkbox", { name })` a handle — keep the `id`/`htmlFor`
pair. Radix sets `type="button"` on the Root, so it will not submit the form.

#### 3. Remove the now-duplicated link from the page

**File**: `src/pages/auth/signin.astro`

**Intent**: The link moved into the form; leaving both renders it twice.

**Contract**: delete the standalone `<a href="/auth/reset-password">` block (the one
carrying `t.auth.reset.signinLinkLabel`, between `<SignInForm>` and the "lub" divider).
The `<div class="mt-6"><SignInForm … client:load /></div>`, the divider and the signup
button are unchanged. **L-007**: `t.auth.reset.signinLinkLabel` and `t.auth.reset.heading`
are the *same string* — after this change the sign-in page must render it exactly once, and
the reset page keeps using `heading`.

#### 4. Component test

**File**: `tests/signin-form.test.tsx` (new, first line `// @vitest-environment jsdom`) —
modelled on `tests/change-pin-section.test.tsx`.

**Intent**: Prove the rendered form posts `remember` when ticked and omits it when not.
Phase 1's tests hand the field straight to the route handler and cannot see the UI at all,
so this is the only coverage for the `name`-prop trap.

**Contract**: three tests.

1. Render `<SignInForm />`, click the control located by
   `screen.getByRole("checkbox", { name: t.auth.signin.rememberLabel })`, then build
   `new FormData(container.querySelector("form")!)` and assert `has("remember")` is true.
2. Render without clicking; assert `has("remember")` is false.
3. Assert the reset link renders **exactly once** in the form, with
   `href="/auth/reset-password"` and the text `t.auth.reset.signinLinkLabel` — use
   `getAllBy…` and assert length 1, so a duplicate would fail rather than throw an opaque
   "multiple elements" error.

Locate by role + accessible name, not `getByText` (L-007).

### Success Criteria

#### Automated Verification

- `npm run lint` — clean
- `npm run check` — clean (the only thing that type-checks `.astro`)
- `npm test` — **baseline + 3** on top of Phase 1's total
- Deliberate break E: drop `name="remember"` from `<Checkbox>` → **component test 1 red,
  every Phase-1 route test green**; restore
- `grep -c "reset.signinLinkLabel" src/pages/auth/signin.astro src/components/auth/SignInForm.tsx`
  → `0` and `1` respectively

#### Manual Verification

- The row matches the mockup at desktop and at 712px (the `touch` project's width): checkbox
  + label left, link right, no wrap, no overflow
- Keyboard: Tab reaches the checkbox, Space toggles it, Tab continues to the link then the
  submit button
- Clicking the label toggles the checkbox

**Break meta-check (L-004):** break E is the *only* break in this plan that reddens the
component layer while leaving all seven route tests green. That asymmetry is exactly the
silent no-op research §D.2 warned about, and it is the whole justification for adding a
component test to a feature whose behaviour is server-side.

---

## Phase 3: Register the contract surface and regress

### Overview

Write down the invariant that makes this feature possible — a future refactor that reorders
the spread in `setAll` would silently restore 400-day cookies and nothing would fail — then
run every suite, including Playwright, to prove the login form still works after the move.

### Changes Required

#### 1. Contract-surface entry

**File**: `docs/reference/contract-surfaces.md`

**Intent**: Register the auth-cookie lifetime as a named surface so a reorder or a
"cleanup" of `AUTH_COOKIE_OPTIONS` reads as breaking.

**Contract**: a **new H2 section**, `## Auth cookie lifetime (session-policy surface)`,
appended after the existing sections. It records: `setAll` in `src/lib/supabase.ts` as the
only seam and *last-spread-wins* as the reason it works; that `createServerClient`'s
`cookieOptions` is **not** a seam (the `setCookieOptions` literal re-asserts
`DEFAULT_COOKIE_OPTIONS.maxAge`); the removal guard and what breaks without it; the
`remember_me` marker (unsigned, and why — contrast with `password_reset` /
`parent_verified`); consumers (`src/pages/api/auth/signin.ts`,
`src/pages/api/auth/signout.ts`, `src/lib/services/remember-me.ts`); and the tests
(`tests/remember-me-cookie.test.ts`, `tests/signin-form.test.tsx`).

**Concurrency**: append a *new* section only. Do **not** edit
`## Parent PIN routes (RLS surface)` — F1 (`autonomous-run-follow-ups`) appends there this
run. On any merge conflict in this file keep **both** sides, never `--ours`/`--theirs`;
nothing in `src/`, `tests/`, `e2e/` or CI reads this document, so a bad resolution fails
silently and permanently.

#### 2. Full regression

**Intent**: Prove nothing else moved — in particular that `signInViaUI`
(`e2e/helpers/accounts.ts`), through which every authenticated spec funnels, still fills
and submits the changed form under the hydration gate.

**Contract**: no code change. Run all four suites with the sandbox disabled (the local
Supabase API on `127.0.0.1:54321` is blocked by the command sandbox) and the stack up.

### Success Criteria

#### Automated Verification

- `npm run lint` — clean
- `npm run check` — clean
- `npm test` — **baseline + 10** total for the change
- `E2E_PORT=<yours> npx playwright test` — **baseline + 0** (this change adds no spec).
  **Measure the e2e baseline on this branch before Phase 1** with `npx playwright test
  --list`; do not take a number from a document. *(Arithmetic resolved in place by the
  contention sweep, 2026-08-24, from a fact F1's plan carries and this one only guessed at:*
  `playwright.config.ts`'s `touch` project sets `testMatch: /(gameplay-restore|growth)\.spec\.ts/`,
  so exactly two of the eight spec files run twice. 19 `test()` calls + 4 touch re-runs
  (`gameplay-restore` 2 + `growth` 2) = **23 runs**. The agent contract's "23 e2e specs" is a
  *run* count, not a file or `test()` count — it was the per-project multiplier, as suspected.)
  That reconciliation does **not** license writing 23 into a criterion: F1
  `autonomous-run-follow-ups` is concurrently adding +2 runs to `growth.spec.ts` (one test ×
  both projects) and +1 to `parent-weekly-report.spec.ts` (desktop-only), so the number moves
  the moment F1 integrates — which is exactly why L-005 forbids the absolute count.
- `git status --porcelain` — clean apart from intended files

#### Manual Verification

- `docs/reference/contract-surfaces.md` renders with the new section and no other section
  altered (`git diff` shows a pure append)

---

## Testing Strategy

### Unit tests

- `tests/remember-me-cookie.test.ts` — seven route-level tests against real routes and real
  local Supabase (table in Phase 1). The two refresh tests are the load-bearing ones.
- `tests/signin-form.test.tsx` — three jsdom component tests; the only proof the rendered
  form posts the field.

### Integration / e2e

None added, by decision. The existing 8 specs are the regression check: they all sign in
through `signInViaUI`, so a broken form fails them loudly.

### Manual testing steps

1. `npm run dev`, open `/auth/signin`, confirm the row matches the mockup at desktop and at
   712px.
2. Sign in **without** ticking; in devtools → Application → Cookies, `sb-…-auth-token` shows
   `Session` in the Expires column.
3. Sign out, sign in **with** the box ticked; the same cookie shows a date ~30 days out, and
   a `remember_me` cookie appears with the same expiry.
4. Sign out; both cookies disappear.
5. Tick the box, sign in, sign out, then sign in **without** ticking — the auth cookie must
   be `Session` again (the stale-marker path).

## Performance Considerations

One extra `cookies.get()` per auth-cookie write. Auth cookies are written on sign-in,
sign-out and token refresh only — never on a plain `getUser()` — so this is a handful of
map lookups per hour per session. Nothing measurable.

## Migration Notes

No schema migration. There **is** a behaviour migration, on two fronts:

1. Existing signed-in parents keep their current 400-day cookie until they next sign in, and
   from then on get a session cookie unless they tick the box.
2. **The three non-signin session-establishing routes** — `POST /api/auth/signup`,
   `GET /api/auth/confirm` (`verifyOtp`, i.e. email verification *and* password recovery) and
   `POST /api/auth/update-password` — go from 400 days to a browser-session cookie, with no
   control offered on those requests. See *Blast radius beyond sign-in* in Current State
   Analysis for the accepted rationale and the one-line reversal.

Accepted — the product has no production users yet. With a production user base this would be
a communicated change, not a silent one.

## References

- Research: `context/changes/remember-me-on-login/research.md`
- Identity + inherited-claim audit, corrections 1–6, decisions D1–D6:
  `context/changes/remember-me-on-login/change.md`
- Session-cookie precedent: `setActiveProfileCookie` in `src/lib/services/active-profile.ts`
- Marker precedent (signed — deliberately not copied here): `RESET_MARKER_COOKIE` in
  `src/lib/services/password-reset.ts`
- Real-route test pattern: `userFromJar` in `tests/auth-routes.test.ts`; `mintSession` in
  `tests/auth-session-gating.test.ts`
- Component test pattern: `tests/change-pin-section.test.tsx`
- Decorative-control precedent this feature had to escape:
  `context/archive/2026-08-22-parent-security-screen/plan-brief.md`

## Autonomous decisions

No human is in the loop (run agent contract, hard rule 1). Every `AskUserQuestion` the
`/10x-plan` skill prescribes — the complexity confirmation, the probing rounds, the
design-options round and the phase-structure approval — was decided here instead.

**AD-1 — Complexity assessed MEDIUM; questioning collapsed to zero rounds.**
*Chosen:* treat this as MEDIUM (multi-file, real design decisions, a live refresh-path
risk) but ask nothing, because `change.md` and `research.md` are both present — the skill's
own scaling table puts "task + frame + research" at 1–2 solution-design questions, and both
of those would have been AD-2 and AD-4 below. *Rejected:* HIGH (no schema change, no
cross-account surface, one seam function) and LOW (the refresh path and the removal path are
each a silent-failure class). *What would change the answer:* if the maintainer wants the
checkbox to also drive a server-side `[auth.sessions]` policy, this becomes HIGH and needs
its own research.

**AD-2 — Semantics and the 30-day figure kept as `change.md` D2 proposed.**
*Chosen:* unticked ⇒ session cookie; ticked ⇒ 30 days. *Rejected:* keeping the library's
400 days for the ticked state (an unchosen default is not a security posture, and 400 days
on a shared family device is indefensible for a product whose parent surface is PIN-gated);
and 7 days (re-authenticating weekly on a family tablet makes the control feel broken).
*What would change the answer:* the number is `REMEMBER_ME_MAX_AGE_SECONDS`, a one-line
change; the mechanism is unaffected. A maintainer who wants a hard cap regardless of the box
wants `[auth.sessions] timebox`, which is a different change.

**AD-3 — Radix `Checkbox` over a native `<input type="checkbox">`.**
*Chosen:* use the existing `src/components/ui/checkbox.tsx`, giving it `id` + `name`.
*Rejected:* a hand-styled native input. The shadcn component is already vendored, matches
the mockup's rounded box and the design system's focus ring, and the project convention is
to add shadcn components rather than hand-roll controls. The cost is the `name`-prop trap,
which is why break E and the component test exist. *What would change the answer:* if the
Radix `CheckboxBubbleInput` turns out not to submit under Astro's `client:load` island, switch
to a native input — the component test in Phase 2 is what would surface that, before any of it
ships. Plan review narrowed the residual risk: the hidden input is rendered whenever the
control sits inside a `<form>` (`isFormControl`), **not** when `name` is supplied, so the only
live unknown is whether Radix's native-setter sync fires under the island — not whether the
element exists. Plan review also verified the *locator* rather than assuming it:
`dom-accessibility-api` 0.5.16's `isLabelableElement` includes `button`, and `getLabels`
reads `element.labels`, which jsdom 29 implements on `HTMLButtonElement` — so
`getByRole("checkbox", { name })` resolves through `<Label htmlFor="remember">`.

**AD-10 — Plan review's three findings were triaged and applied here, with no human asked.**
*Chosen:* fix all three in place rather than defer them. (a) The Radix `name`-gates-the-input
claim was **factually wrong** for 1.3.5 and is corrected in Phase 2 §2 — the conclusion and
break E survive, the stated mechanism did not. (b) `AUTH_COOKIE_RE`'s "export or re-declare"
was collapsed to *export*, because a second copy of the regex is the exact drift Phase 3
exists to prevent. (c) The blast radius beyond sign-in — three other routes silently move from
400 days to a session cookie — was **absent from every prior document** and is now recorded
with its rationale and its one-line reversal. *Rejected:* filing (c) as a follow-up; a scope
claim the plan makes in its own Overview ("and nothing else") cannot be left standing while
the change quietly alters four flows. *What would change the answer:* if the maintainer
decides the post-verification sign-out is unacceptable, (c) becomes a fourth phase rather than
a paragraph — `setRememberChoice(cookies, true)` in `GET /api/auth/confirm` plus a test.

**AD-4 — The marker does not slide; its 30 days are fixed at sign-in.**
*Chosen:* the marker and the auth cookie both get 30 days at sign-in, and only the auth
cookie is re-extended by refreshes. *Rejected:* re-asserting the marker from inside `setAll`
on every refresh — that makes the seam write a second, unrelated cookie as a side effect, and
`setAll` is on every request path that refreshes. *Consequence, stated plainly:* a parent who
uses the app continuously for more than 30 days will, once, find themselves signed out after
closing the browser, and must tick the box again. *What would change the answer:* if that
one-off is judged unacceptable, the cheapest fix is to give the marker a longer `maxAge` than
the auth cookie (e.g. 400 days) so it never expires first — one constant, no new writes.

**AD-5 — Coverage stops at the options object; no `cookie` import in a test.**
*Chosen:* assert the `options` the jar captured, and record in the test file's doc comment
that the header-level step (`serialize()`'s `if (cookie.maxAge !== undefined)` guard) was
verified by reading `node_modules/cookie/dist/index.js` at version 1.1.1, not asserted.
*Rejected:* importing `serialize` from `cookie` into the test to assert the literal
`Set-Cookie` string — `cookie` is a transitive dependency of Astro and is imported nowhere in
this project's own code, so the test would depend on a package the manifest does not declare.
*What would change the answer:* adding `cookie` as an explicit devDependency (it is already in
the lockfile) makes a header-level assertion a two-line addition, and it would close the one
gap AD-6 names.

**AD-6 — Research's deliberate-break design (§C.3) is corrected, not inherited.**
*Chosen:* the load-bearing refresh test is the **ticked** case (test 4), and the primary break
is threading the choice through a call argument instead of a cookie (break D). *Rejected:*
research's §C.3, which named the *unticked* refresh case as the one that must go red under a
broken marker read. Under this design the absence of a marker **is** the default branch, so
the unticked case is refresh-stable by construction and would stay green through exactly the
bug it was meant to catch — the L-004 failure mode, one layer up. *What would change the
answer:* an implementation that stores an explicit `"0"` marker for the unticked case instead
of deleting it would restore research's asymmetry — but it also reintroduces the stale-marker
class, so it was not chosen.

**AD-7 — No e2e spec, following research R3; the existing suite is the regression gate.**
*Chosen:* Phase 3 re-runs Playwright unchanged. *Rejected:* a spec reading
`sb-…-auth-token` from `page.context().cookies()` and asserting `expires === -1` — it would
work mechanically but requires extending `e2e/CLAUDE.md`'s **closed** cookie-poking exception
list and asserts an implementation detail the user never sees. *What would change the answer:*
the maintainer extending that list (it is theirs to extend) buys one spec for the unticked
case; the ticked case still needs a browser restart, which the harness cannot do.

**AD-8 — Phase structure fixed at three; no approval round.**
*Chosen:* behaviour → UI → surface+regress. *Rejected:* two phases (folding Phase 3 into
Phase 2) — the full Playwright run is the only check on `signInViaUI` after the form moved,
and burying it inside a UI phase makes it easy to skip; and four phases (splitting the marker
service from the seam) — they are a single ~20-line unit with one shared test file, and
splitting them produces a phase with no observable behaviour. *What would change the answer:*
**nothing — the contingency this decision named has been resolved against it.** *(Contention
sweep, 2026-08-24, fixed in place.)* `ownership.md` landed and assigns
`docs/reference/contract-surfaces.md` **per section, not per file**: F1 owns
`## Parent PIN routes (RLS surface)` (line 58 today, ending before `## Account deletion` at
line 69) and F2 owns its new `## Auth cookie lifetime (session-policy surface)`, appended
after `## set_updated_at()` — the file's last section, ending at line 90. The two hunks are
~22 lines apart and three-way-merge cleanly. **Phase 3 keeps its code change and must not
fold into Phase 2**: collapsing it would also bury the full Playwright run, which is the only
gate on `signInViaUI` after the sign-in form moved.

**AD-9 — Ownership self-declared; `ownership.md` does not exist.**
*Chosen:* proceed, and declare F2's footprint for the sweep: `src/lib/supabase.ts`
(`createClient`/`setAll` — the sensitive one, every route builds its client through it),
`src/pages/api/auth/signin.ts`, `src/pages/api/auth/signout.ts`,
`src/components/auth/SignInForm.tsx`, `src/pages/auth/signin.astro`, one append under
`auth.signin` in `src/i18n/pl.ts`, the new `src/lib/services/remember-me.ts`, two new test
files, and a **new section** in `docs/reference/contract-surfaces.md`. F1's handoff flags two
plausible collisions: this plan takes the append-a-new-section route in `contract-surfaces.md`
(F1 edits inside the PIN section, so the two do not overlap) and touches
`e2e/helpers/accounts.ts` **not at all**. *What would change the answer:*
`context/runs/2026-08-24-followups-and-remember-me/ownership.md` appearing — it is binding on
sight and overrides this paragraph.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Cookie-lifetime seam and the remember-me marker

#### Automated

- [x] 1.1 `npm run lint` — clean
- [x] 1.2 `npm run check` — clean
- [x] 1.3 `npm test` — baseline + 7 (measured on this branch: 429 → **436**, 51 → 52 files)
- [x] 1.4 Deliberate break B (remove the `isRemoval` guard) — test 7 red, tests 1–6 green, restored
- [x] 1.5 Deliberate break C (`setRememberChoice` false-branch no-op) — test 6 red, others green, restored
- [x] 1.6 Deliberate break D (thread `remember` as an argument instead of reading the cookie) — test 4 red, others green, restored

#### Manual

- [x] 1.7 `Set-Cookie` inspection: `Max-Age=2592000` with `remember`, absent without it — **performed**, against a real `npm run dev` server + curl
- [x] 1.8 Sign-out still sends `Max-Age=0` for the auth cookie, and expires `remember_me` — **performed**, same real-server run

### Phase 2: The checkbox row in the sign-in form

#### Automated

- [x] 2.1 `npm run lint` — clean
- [x] 2.2 `npm run check` — clean
- [x] 2.3 `npm test` — baseline + 3 on top of Phase 1 (436 → **439**, 52 → 53 files)
- [x] 2.4 Deliberate break E (drop `name="remember"`) — component test 1 red, all route tests green, restored
- [x] 2.5 `signinLinkLabel` occurs 0× in `signin.astro`, 1× in `SignInForm.tsx`

#### Manual

- [x] 2.6 Row matches the mockup at desktop and at 712px, no wrap or overflow — **performed** in a real browser at 1440/712/375px via `getBoundingClientRect` geometry (single-line row, link right-aligned, no sideways scroll at any width)
- [x] 2.7 Keyboard: Tab to checkbox, Space toggles, Tab to link, Tab to submit — **performed**; order is password → show-password toggle → checkbox → link → submit, and Space toggles without submitting the form
- [x] 2.8 Clicking the label toggles the checkbox — **performed**; checked → unchecked and the `remember` field leaves the FormData

### Phase 3: Register the contract surface and regress

#### Automated

- [ ] 3.1 `npm run lint` — clean
- [ ] 3.2 `npm run check` — clean
- [ ] 3.3 `npm test` — baseline + 10 total
- [ ] 3.4 `E2E_PORT=<yours> npx playwright test` — e2e baseline + 0
- [ ] 3.5 `git status --porcelain` clean apart from intended files

#### Manual

- [ ] 3.6 `git diff docs/reference/contract-surfaces.md` is a pure append; no existing section altered
