---
change_id: remember-me-on-login
title: Honest "remember me" on parent login — cookie persistence, not token lifetime
status: impl_reviewed
created: 2026-08-24
updated: 2026-08-24
archived_at: null
---

## Notes

Decide and record what a "remember me" control on the parent login can honestly
change about Supabase session lifetime, then either ship that behaviour with its UI
or close the entry as a documented non-goal rather than a placebo checkbox.

Backlog entry: **A3** in `context/foundation/backlog.md`.

---

## Inherited-claim audit (backlog A3 `[I]` tags, checked 2026-08-24 on `matmaverse-v2`)

| Backlog claim | Verdict | Evidence (symbols, not lines) |
|---|---|---|
| Mockup `assets/matmaverse-auth-v2-{web,mobile}/01-parent-login-*` | **TRUE — and the files are present on this machine** | `assets/matmaverse-auth-v2-web/01-parent-login-web.png` and `…-mobile/01-parent-login-mobile.png` both exist and were opened in this step. `assets/` is gitignored, so a fresh clone / CI / cloud agent will NOT have them. |
| The mockup shows a remember-me control | **TRUE (newly verified — the backlog only implied it)** | The web mockup draws an unchecked square checkbox labelled **"Zapamiętaj mnie"** on one row with a right-aligned **"Nie pamiętasz hasła?"** link, between the password field and the "Zaloguj się" button. |
| "The login form has no remember me control" | **TRUE** | `SignInForm` (`src/components/auth/SignInForm.tsx`) renders exactly two `FormField`s, `ServerError`, `SubmitButton` — no checkbox. `grep -rn "Zapamiętaj\|remember" src/ e2e/ tests/` returns nothing outside the backlog. |
| "The missing piece is a decision about Supabase session length, not markup" | **HALF TRUE — corrected** | A decision is needed, but **not about session length**: session length is not adjustable per login (see below). The decision that is actually available is about **cookie persistence**. Markup is also genuinely missing, and it is more than a checkbox — see the layout note. |
| "Without that decision this is a decorative checkbox" | **TRUE, and the precedent is real** | `context/archive/2026-08-22-parent-security-screen/plan-brief.md` (§ scope table: *"Change PIN only; drop all four toggles"*) and `research.md` (§ *"All four 'Bezpieczne ustawienia' toggles are decorative"*) confirm four toggles were dropped from the parent-PIN screen for exactly this reason. |

### Corrections that must reach the plan

1. **Per-login session length is not a knob that exists.** `signInWithPassword`'s
   options type in `@supabase/auth-js` (`SignInWithPasswordCredentials`) is
   `{ captchaToken?: string }` — nothing else. Access-token TTL (`jwt_expiry = 3600`)
   and refresh-token rotation (`enable_refresh_token_rotation = true`) are
   **project-wide** settings in `supabase/config.toml`; so are `[auth.sessions]`
   `timebox` / `inactivity_timeout` (present but commented out there). None of them
   can vary per sign-in. Any plan that says the checkbox changes refresh-token
   lifetime is wrong.
2. **What *is* controllable is the auth cookie's `maxAge`,** written by `setAll`
   inside `createClient` in `src/lib/supabase.ts`. Today that function spreads
   `AUTH_COOKIE_OPTIONS` (`httpOnly`, `sameSite`, `secure`) over the library's own
   options and never touches `maxAge` — so every login inherits
   `DEFAULT_COOKIE_OPTIONS.maxAge` from `@supabase/ssr` 0.10.3, which is
   `400 * 24 * 60 * 60` (**400 days**). **The current unchecked-by-default
   behaviour is already "remember me, for 400 days."** That inverts the framing:
   shipping this feature makes the *default* stricter, it does not make the app
   more permissive.
3. **The crux risk the backlog does not mention.** `src/middleware.ts` calls
   `createClient(...).auth.getUser()` on *every* request, and a token refresh
   re-runs `setAll`, which rewrites the auth cookies with the default options. A
   session cookie chosen at sign-in would therefore be **silently upgraded back to
   a 400-day persistent cookie on the first refresh** unless the choice is
   persisted somewhere `createClient` can read it. The repo already has the pattern
   for this: the reset marker cookie in `src/lib/services/password-reset.ts`
   (`RESET_MARKER_COOKIE`, consumed by `src/pages/api/auth/update-password.ts`) and
   the PIN-verified marker cleared in `src/pages/api/auth/signout.ts`.
4. **The layout is more than a checkbox.** The mockup's row pairs the checkbox with
   "Nie pamiętasz hasła?", which today lives **outside** the form — an `<a href="/auth/reset-password">` in `src/pages/auth/signin.astro`, centred below
   `<SignInForm>`. Matching the mockup means moving that link into `SignInForm` (or
   restructuring the page around it). Flag it for the ownership sweep: `SignInForm.tsx`
   and `signin.astro` are both touched.
5. **Naming is L-007-clean.** `"Zapamiętaj mnie"` is neither a substring nor a
   superstring of any value in `src/i18n/pl.ts` (checked both directions). Separately,
   `"Nie pamiętasz hasła?"` already appears **twice** as a value (`auth.reset.heading`
   and `auth.reset.signinLinkLabel`); moving the link must not put both on one page.

---

## Autonomous decisions

This run has no human in the loop, so the backlog's "open decision the planner must
make and record" is decided here.

### D1 — This ships; it does not close as a non-goal

- **Chosen:** ship a real control. There is an honest, verifiable behaviour behind
  it: the auth cookie's persistence.
- **Rejected:** closing A3 as a documented non-goal (the backlog's escape hatch).
  Rejected because the escape hatch was written on the assumption that only
  token lifetime was on the table, and that assumption is false (correction 1).
- **Why:** the checkbox maps 1:1 onto an observable, testable difference — whether
  `Set-Cookie` for `sb-*-auth-token` carries a `Max-Age`/`Expires` — so it is not a
  placebo.
- **What would change the answer:** if research finds the persistence choice cannot
  survive middleware refresh without a marker cookie the maintainer is unwilling to
  add, the control becomes unenforceable and A3 should close as a non-goal instead.

### D2 — Semantics: checked = persistent cookie; unchecked (default) = session cookie

- **Chosen:** *unchecked* (the default, matching the mockup's unchecked box) writes
  the auth cookies with **no `maxAge`/`expires`** — a session cookie that dies when
  the browser closes. *Checked* writes an explicit, chosen `maxAge` — propose
  **30 days**, not the library's 400.
- **Rejected:** (a) leaving the default at 400 days and letting the checkbox only
  extend it — there would be nothing left to extend; (b) varying `jwt_expiry` or
  `[auth.sessions]` per login — impossible (correction 1); (c) keeping 400 days for
  the checked state — an unchosen library default is not a security posture, and 400
  days on a shared family device is indefensible for a product whose whole parent
  surface is a PIN-gated child-safety area.
- **Why:** this is the only per-login knob that exists, and it is the one that
  matters on the target device — a shared family laptop or tablet. The access token
  still expires in an hour either way; the checkbox decides whether the browser
  keeps the refresh material after the window closes.
- **What would change the answer:** if the maintainer wants a hard cap on
  authenticated lifetime regardless of the box, that is `[auth.sessions] timebox` in
  `supabase/config.toml` — a project-wide setting, a separate change, and it should
  be recorded as such rather than folded in here. Also: if 30 days is judged too
  long, the number is a one-line change; the mechanism is unaffected.

### D3 — Behaviour change to the default is accepted, and must be stated

- **Chosen:** accept that existing signed-in parents move from a 400-day cookie to a
  session cookie the next time they sign in without ticking the box.
- **Rejected:** preserving today's behaviour as the unchecked default to avoid
  surprising anyone.
- **Why:** the product has no production users yet, and preserving the 400-day
  default would make the checkbox a no-op in its checked state — precisely the
  placebo the entry exists to avoid.
- **What would change the answer:** a production user base. Then this is a
  logged-out-everyone event and needs to be announced, not slipped in.

### D4 — Next step is `/10x-research`, not `/10x-plan`

- **Chosen:** research before planning.
- **Rejected:** going straight to `/10x-plan` on the strength of the audit above.
- **Why:** three load-bearing unknowns remain and each one can invalidate a plan
  phase: (a) exactly when `@supabase/ssr` 0.10.3 calls `setAll` (every request, or
  only on refresh/sign-in) — this decides whether a marker cookie is required or
  merely tidy; (b) what Playwright can assert about cookie persistence, given that
  `context.cookies()` reports `expires: -1` for session cookies but a browser
  restart is not free in this harness; (c) whether moving the reset link into
  `SignInForm` disturbs `tests/auth-routes.test.ts` or `e2e/password-reset.spec.ts`.
- **What would change the answer:** if research budget is tight, (a) alone is
  answerable by reading `node_modules/@supabase/ssr/dist/main/cookies.js` and the
  plan can proceed with the marker cookie assumed mandatory.

### D5 — The skill's "STOP and wait for the user" is overridden

- **Chosen:** proceed without a human, per the run's agent contract (hard rule 1).
- **Why:** `/10x-new` stops only to obtain a change-id and intent; both were supplied
  by the orchestrator.
- **What would change the answer:** nothing within this run.

---

## Mockup availability

`assets/` is gitignored. The two login mockups **were present and were opened during
this step** on the maintainer's machine, so the layout notes above are observation,
not extrapolation. Any later step running in CI, a fresh clone, or a cloud session
will not see them and must treat the layout as inherited description — the row order
recorded here (email → password → [checkbox | reset link] → submit → "lub" divider →
"Utwórz konto") is the binding summary for such a step.

---

## Second verification pass (2026-08-24, re-dispatched `/10x-new` step)

The pipeline that first wrote this file died mid-flight (see the run log), so this
step re-ran and **re-checked every claim above against the repo rather than
inheriting it** (agent contract, hard rule 5). Result: **the audit table and
corrections 1–5 are all confirmed true.** Evidence observed in this pass:

- `SignInForm` (`src/components/auth/SignInForm.tsx`) imports `FormField` once and
  renders exactly two of them — no checkbox anywhere.
- `createClient` in `src/lib/supabase.ts`: `setAll` does `cookies.set(name, value,
  { ...options, ...AUTH_COOKIE_OPTIONS })`, and `AUTH_COOKIE_OPTIONS` holds only
  `httpOnly` / `sameSite` / `secure`. No `maxAge`. (`clearAuthCookies` does set
  `maxAge: 0`, but only to expire.)
- `@supabase/ssr` is **0.10.3**; `DEFAULT_COOKIE_OPTIONS.maxAge` in
  `dist/main/utils/constants.js` is `400 * 24 * 60 * 60`.
- `SignInWithPasswordCredentials` in `@supabase/auth-js` `lib/types.d.ts` really is
  `PasswordCredentialsBase & { options?: { captchaToken?: string } }`.
- `supabase/config.toml`: `jwt_expiry = 3600`, `enable_refresh_token_rotation =
  true`, and the whole `[auth.sessions]` block (`timebox`, `inactivity_timeout`) is
  commented out.
- Both mockups exist locally and **the web PNG was opened again in this pass**: an
  unchecked square checkbox labelled **"Zapamiętaj mnie"** sits on one row with a
  right-aligned blue **"Nie pamiętasz hasła?"**, directly between the "Hasło" field
  and the "Zaloguj się" button. Row order confirmed: Email → Hasło → [checkbox |
  reset link] → Zaloguj się → "lub" → "Nie masz konta? Utwórz konto".
- `grep -rn "Zapamiętaj|remember|Remember" src/ e2e/ tests/` → **no hits**. L-007
  clean in both directions.
- `RESET_MARKER_COOKIE` is exported from `src/lib/services/password-reset.ts` and
  read by `src/pages/api/auth/update-password.ts` — the marker precedent is real.
- `src/pages/api/auth/signin.ts` `POST` does use bare `form.get("email") as string`
  with no zod, and `src/middleware.ts` `onRequest` does call
  `createClient(...).auth.getUser()` before the `PROTECTED_ROUTES` check.
- `npm test` → **429 passed / 51 files**, observed on `matmaverse-v2` in this pass.

### Correction 6 — NEW, and it kills the obvious implementation

`createServerClient`'s own `cookieOptions` **cannot** carry `maxAge`. In
`@supabase/ssr` 0.10.3 `dist/main/cookies.js`, both write paths build their options
as `{ ...DEFAULT_COOKIE_OPTIONS, ...cookieOptions, maxAge:
DEFAULT_COOKIE_OPTIONS.maxAge }` — the library re-asserts its own `maxAge` **after**
spreading the caller's, so any `maxAge` passed to `createServerClient` is silently
discarded. Anchor on the object literal named `setCookieOptions` (it occurs twice:
once inside the browser-client `setItem`, once in the server-storage writer).

Consequences the plan must absorb:

1. The **only** place the app can set the auth cookie's lifetime is its own `setAll`
   in `src/lib/supabase.ts` — where `AUTH_COOKIE_OPTIONS` is already spread last and
   therefore already wins over the library. That is the seam. A plan phase that
   configures `cookieOptions` instead will appear to work and change nothing.
2. This also **hardens correction 3 from a risk into a certainty**: the same
   `setCookieOptions` literal is what every storage write uses, refreshes included,
   so a session-cookie choice made at sign-in *will* be overwritten with 400 days on
   the first refresh unless `createClient` can read the choice on a later request.
   The marker cookie is therefore **mandatory, not merely tidy** — D4's research
   question (a) is answered here and does not need to be re-opened.

### D6 — Next step is `/10x-research`, reaffirmed (not `/10x-plan`)

- **Chosen:** keep D4's routing. Research next.
- **Rejected:** skipping to `/10x-plan` now that unknown (a) is answered by
  correction 6.
- **Why:** two of D4's three unknowns survive — (b) what Playwright can actually
  assert about cookie persistence without a browser restart, which decides whether
  this feature is e2e-verifiable at all or has to be pinned by unit tests against
  `setAll`; and (c) the blast radius of moving the reset link into `SignInForm`
  across `tests/auth-routes.test.ts` and `e2e/password-reset.spec.ts` (both exist;
  fifteen `tests/*` files and four `e2e/*` specs mention signin). Those are exactly
  the two that decide plan phases.
- **What would change the answer:** if the maintainer drops the mockup's layout
  requirement (leaving the reset link where it is, below the form), unknown (c)
  disappears and the remaining scope is small enough to plan directly.
