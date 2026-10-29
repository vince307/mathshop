---
date: 2026-08-24T13:12:12Z
researcher: Claude (autonomous run 2026-08-24-followups-and-remember-me, step F2/research)
git_commit: 282d2641acdcb34d28311d03f1e0fb889f2c91d8
branch: matmaverse-v2
repository: 10xDevs
topic: "Honest 'remember me' on parent login — what is controllable, and how is it verified?"
tags: [research, codebase, auth, cookies, supabase-ssr, session-policy, remember-me]
status: complete
last_updated: 2026-08-24
last_updated_by: Claude (F2 research step)
---

# Research: Honest "remember me" on parent login

**Date**: 2026-08-24T13:12:12Z
**Researcher**: Claude (autonomous run `2026-08-24-followups-and-remember-me`, feature F2)
**Git Commit**: `282d2641acdcb34d28311d03f1e0fb889f2c91d8`
**Branch**: `matmaverse-v2`
**Repository**: `10xDevs`

## Research Question

Backlog **A3**: what can a "remember me" control on the parent login honestly change
about session lifetime, and is the result verifiable? `/10x-new` closed unknown (a)
(the marker cookie is mandatory) and left two that decide plan phases:

- **(b)** What can Playwright actually assert about cookie persistence, given that a
  browser restart is not available in this harness? Is this feature e2e-verifiable at
  all, or must coverage be unit tests against `setAll`?
- **(c)** What is the blast radius of moving the "Nie pamiętasz hasła?" link into
  `SignInForm` to match the mockup's checkbox row?

## Summary

**The feature is real, the seam is exactly one function, and it is verifiable — but
not where you would expect.**

1. **The mechanism is confirmed end to end.** The only place the app can set the auth
   cookie's lifetime is its own `setAll` in `createClient` (`src/lib/supabase.ts`),
   and the override works because `AUTH_COOKIE_OPTIONS` is spread *last*. Setting
   `maxAge: undefined` there genuinely removes `Max-Age` from the header — traced
   through `AstroCookies.set` → `serialize()` from the `cookie` package, whose guard
   is `if (cookie.maxAge !== undefined)`. This is not an assumption; both hops were
   read.

2. **Unknown (b) — answered: NO, this is not honestly e2e-verifiable, and unit tests
   are not a consolation prize, they are the better layer.** Two independent reasons
   (§C). But `tests/helpers/astro.ts`'s `createCookieJar` **captures the options
   object of every cookie write**, so a Vitest test can assert the exact `maxAge` the
   real signin route produced, and — the test that actually matters — that a
   *refresh* does not silently restore 400 days. That is a stronger, more targeted
   proof than any browser test could give.

3. **Unknown (c) — answered: the blast radius is essentially zero.** `t.auth.reset.signinLinkLabel`
   is rendered in exactly **one** place (`src/pages/auth/signin.astro`) and **no test
   in `tests/` or `e2e/` locates it**. `e2e/password-reset.spec.ts` reaches the reset
   screen with `page.goto("/auth/reset-password")`, never by clicking the link. Moving
   it into `SignInForm` breaks nothing.

4. **A live spike replaced the last assumption with a measurement, and corrected a
   prior claim** (§B.1). Against the real local stack: sign-in writes the auth cookie
   with `maxAge: 34560000` (400 days); a later `getUser()` with a valid token writes
   **nothing**; `refreshSession()` writes 400 days again. So the cookie is **not**
   rewritten on every request as `change.md`'s correction 3 assumed — it is rewritten
   on actual refresh, roughly an hour in. That makes the marker cookie more important,
   because a broken implementation looks correct for the first hour.

5. **Two traps the plan must absorb** that no prior document names: the marker must be
   read with `cookies.get()` (**not** the `Cookie:` header) or it is invisible on the
   sign-in request that sets it (§B.3); and `src/components/ui/checkbox.tsx` already
   exists but is **unused anywhere in `src/`** — it is Radix, whose `Root` renders a
   `<button role="checkbox">`, so it only posts a form value via its hidden
   `BubbleInput`, which requires a `name` prop and submits the literal `"on"` (§D.2).

**Recommendation:** ship it. The scope is one new cookie helper, ~6 lines in
`setAll`, a checkbox + moved link in `SignInForm`, a marker write in the signin route,
a marker clear in the signout route, and three i18n keys.

## Detailed Findings

### A. The cookie-lifetime seam — confirmed, with the exact override mechanism

**`createClient` in `src/lib/supabase.ts`** builds the server client and passes a
`setAll` that is the last writer:

```ts
setAll(cookiesToSet) {
  cookiesToSet.forEach(({ name, value, options }) => {
    cookies.set(name, value, { ...options, ...AUTH_COOKIE_OPTIONS });
  });
}
```

`AUTH_COOKIE_OPTIONS` today holds only `httpOnly`, `sameSite`, `secure` — no
`maxAge` — so the library's `options.maxAge` survives untouched.

**Why `cookieOptions` on `createServerClient` cannot be used** (confirms `/10x-new`'s
correction 6, re-verified here). In `@supabase/ssr` **0.10.3**, both write paths build
an object literal named `setCookieOptions`:

```js
const setCookieOptions = {
  ...DEFAULT_COOKIE_OPTIONS,
  ...cookieOptions,
  maxAge: DEFAULT_COOKIE_OPTIONS.maxAge,   // <- re-asserted AFTER the caller's
};
```

It occurs twice in `node_modules/@supabase/ssr/dist/main/cookies.js` — once in the
browser-client `setItem` path, once in the exported `applyServerStorage`. Anchor on
the identifier `setCookieOptions`, not on a line. `DEFAULT_COOKIE_OPTIONS.maxAge` in
`dist/main/utils/constants.js` is `400 * 24 * 60 * 60` — **400 days**, and the file
comments cite Chrome's cookie-lifetime cap, i.e. it is a deliberate library maximum,
not a considered product choice for this app.

**The override provably works — both hops read, not assumed:**

- `AstroCookies.set` (`node_modules/astro/dist/core/cookies/cookies.js`) does
  `Object.assign(serializeOptions, options)` and hands the result to `serialize()`
  imported `from "cookie"`.
- `serialize()` in `node_modules/cookie/dist/index.js` guards with
  `if (cookie.maxAge !== undefined)` before appending `"; Max-Age=" + cookie.maxAge`.

So adding `maxAge: undefined` to the spread **removes** the attribute rather than
serialising `Max-Age=undefined`. This matters because a spread cannot delete a key —
the naive "just don't set maxAge" reading of the seam does nothing at all, since the
library's 400-day value is already in `options`. `DEFAULT_COOKIE_OPTIONS` carries no
`expires`, so `maxAge` is the only attribute in play.

### B. The marker cookie — mandatory, and the read path is a trap

**B.1 — Why it is mandatory — now EXECUTED, not merely reasoned.** A live spike was
run against the local Supabase stack (a throwaway account, a real `createServerClient`
with a recording `setAll`, deleted afterwards; the script was temporary and is not in
the repo). Result:

| step | `setAll` writes observed |
|---|---|
| `signInWithPassword` | **1 write**, `maxAge: 34560000` (= 400 days) |
| `getUser()` on a later request, token still valid | **0 writes** |
| `refreshSession()` | **1 write**, `maxAge: 34560000` (400 days again) |

Three things this settles, two of them corrections to earlier assumptions:

1. **The 400-day default is real in practice**, not just a constant — confirmed on the
   wire.
2. **CORRECTION to `change.md`'s correction 3.** The rewrite does **not** happen on
   every request. `getUser()` with a still-valid token wrote nothing. The rewrite fires
   only on an **actual refresh**. This makes the marker cookie *more* important, not
   less: with `jwt_expiry = 3600`, a session-cookie choice looks perfectly correct for
   the first hour and then silently reverts to 400 days. No manual test, and no short
   e2e run, would ever catch it — only test 3 in §C.2 would.
3. **Open question about the test trigger is answered: `refreshSession()` does drive
   `setAll`** under `skipAutoInitialize: true`. Test 3 has a working, deterministic
   trigger.

**Mechanism (source-level, consistent with the above).** `createServerClient`
registers `client.auth.onAuthStateChange` and calls `applyServerStorage` on
`SIGNED_IN`, **`TOKEN_REFRESHED`**, `USER_UPDATED`, `PASSWORD_RECOVERY`, `SIGNED_OUT`
and `MFA_CHALLENGE_VERIFIED` whenever `setItems`/`removedItems` is non-empty.
`applyServerStorage` is the second home of the `setCookieOptions` literal above. So
every refresh re-writes the auth cookie through the app's `setAll`. A choice made only
at sign-in is therefore overwritten on the first refresh unless `setAll` can re-read
the choice on a later, unrelated request. `src/middleware.ts` `onRequest` calls
`createClient(...).auth.getUser()` on **every** request; `autoRefreshToken: false` is
set for server clients, so the refresh happens inside the `getUser()`/`_useSession`
path rather than on a timer — which is why the middleware is the thing that eventually
triggers it, once the hour is up.

**B.2 — Precedent for a deliberate session cookie already exists in this repo.**
`setActiveProfile` in `src/lib/services/active-profile.ts` writes its cookie with
`httpOnly`/`sameSite`/`secure`/`path` and a comment reading *"No maxAge/expires:
browser-session lifetime — FR-002's picker-on-launch."* That is the exact shape the
unchecked branch needs, and it means the project has already accepted session-scoped
cookies as a design tool. `e2e/CLAUDE.md` independently confirms the semantics matter:
it bans `storageState` precisely because *"the session-lifetime `active_profile` cookie
makes persisted state lie about fresh-browser semantics"*.

**B.3 — The trap: read the marker with `cookies.get()`, never the `Cookie:` header.**
`createClient`'s `getAll` reads only `requestHeaders.get("Cookie")`. On the sign-in
request itself the marker does not exist in that header — it is being set in the same
response. But `AstroCookies.get` checks its `#outgoing` map **first** and returns a
value set earlier in the same request. So the plan must (a) write the marker *before*
calling `signInWithPassword`, and (b) have `setAll` read it via `cookies.get(...)`.
Reading it from `requestHeaders` would make the very first sign-in write the wrong
lifetime, and the bug would then heal itself on the next request — the worst possible
failure signature. The test harness's `createCookieJar.get()` reads from its own store
and so models this faithfully.

**B.4 — This marker does not need signing, unlike its two siblings.**
`RESET_MARKER_COOKIE` (`src/lib/services/password-reset.ts`) and
`PARENT_VERIFIED_COOKIE` (`src/lib/services/parent-pin.ts`) are HMAC-signed with
`PARENT_SESSION_SECRET` because forging them **grants a privilege** (setting a password;
skipping the PIN gate). A forged remember-me marker grants nothing — it only lengthens
the attacker's *own* cookie on their *own* browser. Copy the option shape of those two
helpers, not their crypto. Worth stating explicitly in the plan, because a reviewer
who sees "marker cookie" will reach for `signMarker` by analogy.

### C. Unknown (b) — verifiability

**C.1 — Why e2e cannot honestly prove this. Two independent blockers:**

1. **No browser restart, and no substitute.** A session cookie is distinguished from a
   persistent one only by surviving a browser restart. Playwright gives a fresh
   `BrowserContext` per test, which shares no cookies at all, so "new context" tests
   nothing. The usual escape — `storageState()` — is worse than unavailable: it
   serialises session cookies *too*, so it cannot distinguish the two states either.
   And `e2e/CLAUDE.md` bans it project-wide for an unrelated but pointed reason.
2. **The available assertion is banned by the project's own rules.** Playwright reports
   `expires: -1` for session cookies via `page.context().cookies()`, so the state *is*
   readable. But `e2e/CLAUDE.md` carries a **closed list** of sanctioned
   cookie-poking exceptions — item 2 permits `clearCookies({ name: "parent_verified" })`
   and adds *"Do not poke other cookies by name."* Reading `sb-…-auth-token` by name
   would require extending a list the file explicitly forbids extending by analogy. The
   same file also requires asserting *"the business outcome (what the user durably
   sees), not implementation details"* — a `Max-Age` attribute is the definition of an
   implementation detail.

**Conclusion:** the honest answer is that browser-level coverage of the *behaviour* is
unavailable. Any e2e added here should cover only the *UI* fact — the control renders,
is unchecked by default, and the form still submits — and even that is largely
redundant with a component test. Recommend **no new e2e spec**, and instead
re-verifying that the existing `signInViaUI` (`e2e/helpers/accounts.ts`) still works
unchanged, since every authenticated spec funnels through it.

**C.2 — Why unit coverage is genuinely strong here, not a fallback.** The decisive
capability: `createCookieJar` in `tests/helpers/astro.ts` stores
`{ name, value, options }` on every `set` and exposes `getAll(): StoredCookie[]`. The
`options` object is the *real* one the real route produced. Combined with
`buildContext` (which builds a real `Request` and replays the jar into a `Cookie:`
header) and `runMiddleware`, a test can drive the **real** signin route against the
**real** local Supabase and then inspect exactly what was written.

The pattern is already established: `mintSession` in `tests/auth-session-gating.test.ts`
does the drive-the-real-route half, and `userFromJar` in `tests/auth-routes.test.ts`
does the durable-re-read half (an explicit L-002 citation in its own comment). Neither
file has ever asserted on `options` — the capability is there and unused.

**Three tests the plan should contract**, the third being the one that carries the risk:

| # | Test | Why it bites |
|---|---|---|
| 1 | signin **without** `remember` → the `sb-…-auth-token` write has `maxAge === undefined` | pins the new default |
| 2 | signin **with** `remember=on` → that write has the chosen `maxAge` | pins the checked branch |
| 3 | after (1), force a refresh, then assert the re-write **still** has `maxAge === undefined` | pins §B.1 — the regression that would otherwise ship silently |

For test 3 the refresh must be forced deterministically (`jwt_expiry = 3600` in
`supabase/config.toml` makes waiting impossible): build a client from the jar and call
`auth.refreshSession()`, which emits `TOKEN_REFRESHED` and drives `applyServerStorage`
→ the app's `setAll` → the jar. **This was executed in the §B.1 spike and works** —
`refreshSession()` produced exactly one `setAll` write carrying the 400-day `maxAge`.
The trigger is confirmed; no spike phase is needed in the plan.

Note that test 3 is not optional politeness. The §B.1 spike showed `getUser()` writes
nothing while the token is valid, so a broken implementation is indistinguishable from
a correct one for a full hour after sign-in. Test 3 is the *only* proposed check that
observes the reverting write at all.

**C.3 — The deliberate break for test 3 (L-004).** Break = make `setAll` ignore the
marker (read the choice from `requestHeaders` instead of `cookies`, or drop the read
entirely). Test 3 must go red while tests 1 and 2 **stay green** — that asymmetry is
the evidence, because it shows test 3 is proving refresh-persistence specifically and
not just re-proving the sign-in write. A break that reddens all three proves only that
the seam exists, which tests 1–2 already cover.

### D. Unknown (c) — UI blast radius, and the checkbox

**D.1 — Moving the reset link is safe.** Full reference sweep for the label and route:

- `t.auth.reset.signinLinkLabel` is **rendered in exactly one place**: the `<a href="/auth/reset-password">` in `src/pages/auth/signin.astro`, centred below `<SignInForm>`.
- **No test anywhere locates that link.** `e2e/password-reset.spec.ts` opens the screen
  with `page.goto("/auth/reset-password")`. Every other hit on `/auth/reset-password`
  in `tests/` is a redirect-target assertion (`tests/auth-reset-request.test.ts`,
  `tests/auth-update-password.test.ts`), unaffected by where a link lives.
- `signInViaUI` (`e2e/helpers/accounts.ts`) fills by `getByLabel` and submits by
  `getByRole("button", { name: t.auth.signin.submit })` — untouched by adding a
  checkbox above the button.

**D.2 — `Checkbox` exists but has never been used.** `src/components/ui/checkbox.tsx`
is present (shadcn/Radix, `radix-ui` package) and `grep -rn "Checkbox" src/` returns
**no usage outside its own definition**. Consequences the plan must absorb:

- `CheckboxPrimitive.Root` renders a `<button role="checkbox">`, **not** an
  `<input type="checkbox">`. It posts a form value only through Radix's hidden
  `BubbleInput` (`type: "checkbox"`), which is rendered only when the control
  `isFormControl` **and a `name` is supplied**. Its default submitted value is the
  literal `"on"` (`value = "on"` in `@radix-ui/react-checkbox/dist/index.js`). A
  `<Checkbox />` without `name` submits nothing and the feature silently no-ops.
- It is not a `FormField` (`src/components/auth/FormField.tsx` is input-shaped:
  `Label` + `Input` + icon + error). The checkbox row needs its own small markup with
  a `Label htmlFor` for `getByLabel`/`getByRole(name)` to work.
- Being first use, it also has no established styling precedent in this codebase —
  one more reason the mockup matters.

**D.3 — Mockup.** `assets/` is gitignored. `/10x-new` opened
`assets/matmaverse-auth-v2-web/01-parent-login-web.png` **twice** on the maintainer's
machine and recorded: an unchecked square checkbox **"Zapamiętaj mnie"** sharing a row
with a right-aligned **"Nie pamiętasz hasła?"**, between "Hasło" and "Zaloguj się".
This research step **did not re-open the PNG**; the layout above is inherited from
`change.md` § *Mockup availability*, which marks it as observation. A code-lane
worktree will not have the file at all.

### E. i18n and L-007

- `"Zapamiętaj mnie"` is neither substring nor superstring of any existing value in
  `src/i18n/pl.ts` (`grep -rn "Zapamiętaj\|remember" src/ e2e/ tests/` → no hits).
  Clean in both directions.
- **The live L-007 hazard is the reset link, not the new label.** `"Nie pamiętasz
  hasła?"` already exists **twice** as a value: `auth.reset.heading` (the reset page's
  `<h1>`) and `auth.reset.signinLinkLabel` (the link being moved). They are on
  different pages today and must stay that way — the moved link must reuse
  `signinLinkLabel`, never `heading`.
- New keys append under `auth.signin` (append-only file, per the concurrency contract).
  Suggested: `rememberLabel`. A hint/description key is optional and, if added, must be
  checked against the same substring rule.

## Code References

- `src/lib/supabase.ts` — `createClient`, its `setAll`, and `AUTH_COOKIE_OPTIONS`. **The single seam.** `clearAuthCookies` shows the `maxAge: 0` expiry idiom.
- `src/middleware.ts` — `onRequest`; calls `createClient(...).auth.getUser()` on every request. The refresh driver.
- `src/pages/api/auth/signin.ts` — `POST`; reads `form.get("email") as string` (no zod). Where the marker must be written, **before** `signInWithPassword`.
- `src/pages/api/auth/signout.ts` — `POST`; already deletes `ACTIVE_PROFILE_COOKIE` and `PARENT_VERIFIED_COOKIE`. The remember marker joins that list.
- `src/lib/services/active-profile.ts` — `setActiveProfile`, `ACTIVE_PROFILE_COOKIE`. **The session-cookie precedent to copy.**
- `src/lib/services/password-reset.ts` — `RESET_MARKER_COOKIE`, `setResetMarker`, `clearResetMarker`. Option-shape precedent (signing is *not* needed here — §B.4).
- `src/components/auth/SignInForm.tsx` — two `FormField`s, `ServerError`, `SubmitButton`. Where the checkbox row goes.
- `src/pages/auth/signin.astro` — the `<a href="/auth/reset-password">` to move.
- `src/components/ui/checkbox.tsx` — `Checkbox`; exists, unused, Radix-based.
- `tests/helpers/astro.ts` — `createCookieJar` (captures `options`), `buildContext`, `runMiddleware`, `reachedNext`. **The verification capability.**
- `tests/auth-session-gating.test.ts` — `mintSession`; the real-route-drive pattern.
- `tests/auth-routes.test.ts` — `userFromJar`; the durable-re-read pattern (L-002).
- `e2e/helpers/accounts.ts` — `signInViaUI`; every authenticated spec funnels through it.
- `e2e/CLAUDE.md` — the closed cookie-poking exception list and the `storageState` ban.
- `node_modules/@supabase/ssr/dist/main/cookies.js` — the `setCookieOptions` literal (×2) and `applyServerStorage`.
- `node_modules/@supabase/ssr/dist/main/createServerClient.js` — the `onAuthStateChange` → `applyServerStorage` wiring; `autoRefreshToken: false`.
- `supabase/config.toml` — `jwt_expiry = 3600`, `enable_refresh_token_rotation = true`, `[auth.sessions]` commented out. **No migration needed for this feature.**

## Architecture Insights

- **Last-spread-wins is load-bearing and undocumented as a contract.** The comment on
  `AUTH_COOKIE_OPTIONS` says *"Spread after the library's own options so these win"* —
  that sentence is the whole reason this feature is implementable. It deserves
  promoting to `docs/reference/contract-surfaces.md` as a named surface, because a
  future refactor that reorders the spread would silently restore 400-day cookies and
  nothing would fail.
- **Cookie lifetime is the app's only per-login knob, by construction.** Everything
  else (`jwt_expiry`, refresh rotation, `[auth.sessions]`) is project-wide config, and
  `SignInWithPasswordCredentials` accepts only `captchaToken`. This is a genuine
  constraint of the platform, not a gap in the codebase.
- **Marker cookies are an established pattern with three instances and two tiers** —
  signed (privilege-granting: reset, PIN) and unsigned (state-carrying:
  active-profile). Remember-me is the second unsigned one. Naming the two tiers
  explicitly would stop future changes from over-applying HMAC by analogy.
- **The test harness was built for exactly this and nobody has used it yet.** Capturing
  cookie `options` was designed in (`StoredCookie.options`) but no test asserts on it.
  This feature is its first real customer.
- **Shipping this makes the product's default posture stricter.** Today every login is
  implicitly a 400-day "remember me" nobody chose. The visible effect of a checkbox
  labelled "remember me" is therefore to *shorten* the default — worth one sentence in
  the plan so a reviewer is not confused by an apparently permissive feature that
  tightens security.

## Historical Context (from prior changes)

- `context/archive/2026-08-22-parent-security-screen/plan-brief.md` (§ scope table:
  *"Change PIN only; drop all four toggles"*) and its `research.md` (§ *"All four
  'Bezpieczne ustawienia' toggles are decorative"*) — the precedent that a control with
  no honest backing gets dropped. This research exists to establish that remember-me is
  **not** in that category.
- `context/changes/password-reset/change.md` — recorded the decision to model the
  set-new-password screen on the sign-in card where no mockup exists; the source of the
  `RESET_MARKER_COOKIE` pattern.
- `context/archive/2026-07-12-testing-e2e-playwright/` — the origin of `e2e/CLAUDE.md`'s
  rules, including the `storageState` ban whose stated reason (§Risk #2, the
  session-lifetime `active_profile` cookie) is directly on point for §C.1.

## Related Research

- `context/changes/remember-me-on-login/change.md` — `/10x-new`'s inherited-claim audit,
  corrections 1–6, and decisions D1–D6. This document answers D4/D6's surviving
  unknowns (b) and (c) and does not re-litigate corrections 1–6, which were re-verified
  twice already.
- `context/archive/2026-08-22-parent-security-screen/research.md` — decorative-control
  precedent.

## Open Questions

1. ~~**Does `auth.refreshSession()` fire `onAuthStateChange` under
   `skipAutoInitialize: true`?**~~ **RESOLVED — yes.** Executed in the §B.1 spike;
   test 3's trigger works and no plan phase is at risk. The same spike also corrected
   the "rewrites on every request" assumption (§B.1, item 2).
2. **What `maxAge` for the checked state?** `/10x-new`'s D2 proposes 30 days as an
   explicitly chosen value against the library's unchosen 400. A one-line change; the
   mechanism is unaffected. Left to the plan/maintainer.
3. **Register the last-spread-wins invariant in `docs/reference/contract-surfaces.md`?**
   Recommended (see Architecture Insights). Contended file — the ownership sweep must
   know both F1 and F2 may append. Non-blocking.
4. **Fix the missing zod validation in `src/pages/api/auth/signin.ts` `POST` while it is
   open?** Pre-existing `CLAUDE.md` violation, not caused here. Note that
   `tests/auth-routes.test.ts` has a test *named* `"no server-side validation: empty
   fields produce an error redirect, not a crash"` which pins the current behaviour —
   adding zod would require updating it. Recommend **declining** in this change and
   filing it; it is a separate decision with its own test consequences.

## Autonomous decisions

Per the run's agent contract (hard rule 1), this step made the following calls instead
of asking. Each names what would change the answer.

**R1 — Scoped the research myself; `AskUserQuestion` not called.**
*Chosen:* depth = targeted, scope = D4/D6's two surviving unknowns (b) and (c) plus the
mechanism verification needed to make them actionable. *Rejected:* (i) a broad
"how does auth work" survey — `change.md` already contains a twice-verified audit and
re-deriving it burns budget for nothing; (ii) a narrow (b)-and-(c)-only pass — it would
have missed the `cookies.get()` read-path trap (§B.3) and the Radix `name`-prop trap
(§D.2), both of which silently no-op the feature. *What would change the answer:* if
the maintainer drops the mockup's layout requirement, (c) becomes moot and §D.1
collapses to a footnote.

**R2 — Ran the research directly instead of spawning parallel sub-agents.**
The skill prescribes 2–4 parallel `Task` sub-agents. **No `Task` tool is available in
this subagent context** (checked via `ToolSearch`; only `ListAgents`/`SendMessage`
exist, which address peers, not children). *Chosen:* execute the four research areas
myself as batched parallel `Bash` sweeps. *Rejected:* messaging a peer agent — peers
are other features' steps, not delegates, and dispatching work to them would violate
the run's write-ownership rules. *Consequence:* no fan-out cost, and every finding was
read first-hand rather than summarised. *What would change the answer:* nothing within
this run — it is a capability limit, not a judgement.

**R3 — Answered (b) as "not e2e-verifiable" rather than proposing a cookie-poking spec.**
*Chosen:* recommend no new e2e spec; put the coverage in Vitest where the jar exposes
the real options object. *Rejected:* a spec reading `sb-…-auth-token` from
`page.context().cookies()` and asserting `expires === -1`. It would work
mechanically, but `e2e/CLAUDE.md` carries a **closed** exception list for poking cookies
by name plus an explicit "assert the business outcome, not implementation details"
rule — so this would require breaking a written project rule to test an attribute the
user never sees. *What would change the answer:* if the maintainer chooses to extend
that closed list (it is their rule to extend), one spec asserting `expires: -1` for the
unchecked case becomes available — though §C.1's first blocker means it still could not
prove the *persistent* case survives a restart.

**R4 — Recommend declining the zod fix in `src/pages/api/auth/signin.ts` here.**
*Chosen:* file it, do not fix it in this change. *Rejected:* fixing it while the file is
open (the cheap-moment argument from `change.md`). Rejected because a test exists whose
*name* asserts the absence of validation (`tests/auth-routes.test.ts`), so the fix is
not a drive-by — it changes a pinned contract and widens this change's review surface
for an unrelated reason. *What would change the answer:* if plan-review judges the
combined diff still small, folding it in is defensible — but it must then also update
that test's name and body, not just its assertion.

**R5 — Ran a live spike against the local Supabase stack from the docs lane.**
*Chosen:* execute a throwaway Node script (temp dir, outside the repo, deleted after;
throwaway account created and deleted via the admin API) to measure the real `setAll`
write pattern, rather than shipping "reasoned from library source" as the plan's
foundation. *Rejected:* leaving it as an open question for the plan to spike — the
whole point of research is to stop the planner from guessing, and this particular guess
turned out to be **wrong** (`change.md` correction 3 assumed a rewrite on every
request; there is none while the token is valid). *Scope check:* the docs-lane rule
restricts **writes** to `context/changes/remember-me-on-login/`; no repo file was
created or modified — `git status --porcelain` shows only the three pre-existing
untracked `context/` folders. *What would change the answer:* if the local stack had
been unavailable, this would have stayed an open question flagged for a plan-phase
spike.
