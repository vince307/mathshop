<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Honest "remember me" on parent login

- **Plan**: `context/changes/remember-me-on-login/plan.md`
- **Mode**: Deep (autonomous — no interactive triage; findings triaged in place per the run's agent contract)
- **Date**: 2026-08-24
- **Verdict**: SOUND (after fixes; REVISE before them)
- **Findings**: 0 critical, 3 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING → PASS after F1 |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING → PASS after F1 |
| Plan Completeness | WARNING → PASS after F2/F3 |

## Grounding

13/13 claimed paths exist (`src/lib/supabase.ts`, both auth routes, `SignInForm.tsx`,
`signin.astro`, `checkbox.tsx`, `active-profile.ts`, `contract-surfaces.md`, four test files,
`tests/helpers/astro.ts`); `src/lib/services/remember-me.ts` is correctly the one new file.
Symbols verified first-hand, not inherited: `AUTH_COOKIE_OPTIONS` / `AUTH_COOKIE_RE` /
`setAll` / `clearAuthCookies`; `DEFAULT_COOKIE_OPTIONS` = `{path, sameSite, httpOnly, maxAge:
400d}` with **no `expires`** (so `maxAge: undefined` really does yield a session cookie);
`setCookieOptions` / `removeCookieOptions` in `@supabase/ssr` 0.10.3 `cookies.js`;
`AstroCookies.get`'s `isSetValue` branch and `Object.assign(serializeOptions, options)` in
`set`; `cookie` 1.1.1's `if (cookie.maxAge !== undefined)`; `createCookieJar`'s
`toCookieHeader()` empty-value filter; `it("no server-side validation: …")` in
`tests/auth-routes.test.ts`; `setActiveProfileCookie`'s option shape. Progress↔Phase contract
mechanical check: one `## Progress` at the bottom, 3 phases matched 1:1, 22 rows matching 22
success-criteria bullets exactly, no stray `- [ ]` in phase bodies. L-005 respected throughout
(no absolute count in any criterion). L-007 re-run independently over all 395 dictionary
values: `"Zapamiętaj mnie"` has 0 superstrings and 0 substrings. Brief↔plan consistent.

## Findings

### F1 — Blast radius beyond sign-in: three other routes silently lose their cookie lifetime

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots / End-State Alignment
- **Location**: Overview ("and nothing else"), Current State Analysis, Migration Notes
- **Detail**: `setAll` is the write path for *every* auth-cookie write, not sign-in's. Four
  routes establish a session through it and only `POST /api/auth/signin` carries a checkbox:
  `POST /api/auth/signup`, `GET /api/auth/confirm` (`verifyOtp` — email verification **and**
  password recovery) and `POST /api/auth/update-password`. None writes a `remember_me` marker,
  so each moves from a 400-day cookie to a browser-session one with no control offered. A
  parent completing a password reset is now signed out when the browser closes. The plan's
  Migration Notes covered only "existing signed-in parents", and its Overview claimed the
  checkbox changes "nothing else".
- **Fix ⭐ (applied)**: Record the reach explicitly — a *Blast radius beyond sign-in* bullet in
  Current State Analysis with the accepted rationale and a one-line reversal
  (`setRememberChoice(cookies, true)` in `GET /api/auth/confirm`), a scope correction in the
  Overview, and a second numbered front in Migration Notes. No mechanism change: the stricter
  default is the intended posture, but it must be a stated decision rather than a side effect.
  - Blind spot closed while checking: PKCE. This project confirms with `token_hash` +
    `verifyOtp` and never calls `exchangeCodeForSession`, so no `-code-verifier` cookie is
    written through `setAll` — the sharpest version of this finding does not apply.
- **Decision**: FIXED (in plan)

### F2 — The Radix `name`-gates-the-hidden-input claim is factually wrong

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 → *2. The checkbox row* → **Trap (research §D.2)**; AD-3
- **Detail**: The plan states the hidden `BubbleInput` "is rendered **only when a `name` prop
  is supplied**". In `@radix-ui/react-checkbox` 1.3.5 (reached via the `radix-ui` umbrella this
  repo imports) the Root renders `isFormControl && <CheckboxBubbleInput/>`, where
  `isFormControl` is `control ? !!form || !!control.closest("form") : true`. `name` is only
  forwarded onto the always-rendered input. The plan's *conclusion* survives — a nameless
  control is dropped by `FormData`, so omitting `name` is still a silent no-op and break E
  still reddens component test 1 alone — but an implementer debugging break E would hunt for a
  missing element instead of a missing attribute.
- **Fix (applied)**: Correct the mechanism in Phase 2 and in AD-3, anchored on the identifier
  `CheckboxBubbleInput`, and note that the residual AD-3 risk is now only whether Radix's
  native-setter sync fires under the `client:load` island.
- **Decision**: FIXED (in plan)

### F3 — "export or re-declare `AUTH_COOKIE_RE`" leaves the implementer a coin-flip

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness / Architectural Fitness
- **Location**: Phase 1 → *5. Route-level tests*
- **Detail**: `AUTH_COOKIE_RE` is a module-private `const` in `src/lib/supabase.ts`. Offering
  "export or re-declare" invites a second copy of the one pattern whose drift the Phase 3
  contract-surface entry is written to prevent.
- **Fix (applied)**: Decide it — add `export` and import it in the test. One-token edit to a
  file F2 already owns; `clearAuthCookies`, its only consumer, is untouched.
- **Decision**: FIXED (in plan)

### F4 — Test 6 proves `get()` returns undefined, not that the browser is told to drop the marker

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Blind Spots
- **Location**: Phase 1 → test 6; *Known uncovered break*
- **Detail**: `createCookieJar.delete` removes the entry outright; real `AstroCookies.delete`
  keeps it with `expires: new Date(0)` so a deletion `Set-Cookie` is emitted. Both yield
  `get() === undefined`, so test 6's assertion is sound for the branch it targets — but the
  marker's *wire* behaviour (both its deletion header and, per the plan's own honest note, its
  persistence) is asserted nowhere. Manual step 1.8 is the only coverage.
- **Fix**: None applied. Recorded; the closing move is AD-5's (`cookie` as an explicit
  devDependency, then assert the serialized header) and it closes this and the plan's stated
  uncovered break together.
- **Decision**: ACCEPTED (recorded in handoff `## 5. Open`)

### F5 — Signup's cookie lifetime is a behaviour change with no manual step

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Blind Spots
- **Location**: Phase 1 → Manual Verification
- **Detail**: Subsumed by F1's record, but worth a line: the manual checks walk sign-in and
  sign-out only. Neither the signup path nor the confirm/recovery path is inspected, and those
  are the flows F1 shows change silently.
- **Fix**: None applied — Phase 1's manual list is already 2 rows the run cannot execute
  (no human in the loop), and adding unexecutable rows inflates the Progress section without
  adding verification. Recorded instead.
- **Decision**: SKIPPED (recorded in handoff `## 5. Open`)

## Cross-plan finding (F1 `autonomous-run-follow-ups`)

### X1 — `### Phase 0: Branch baseline` in Progress has no `## Phase 0` in the plan body

- **Severity**: ❌ CRITICAL (in *that* plan, under this skill's mechanical Progress↔Phase contract)
- **Location**: `context/changes/autonomous-run-follow-ups/plan.md` → `## Progress`
- **Detail**: The Progress section opens with `### Phase 0: Branch baseline` (rows 0.1, 0.2),
  but the plan body's phases start at `## Phase 1` — there is no `## Phase 0` heading and no
  matching Success Criteria bullets. `/10x-implement` matches `### Phase N` in Progress to
  `## Phase N` in the body; an orphan subsection is the failure mode this skill calls out as
  CRITICAL. The rows themselves are good practice (they are the L-005 baseline measurement) —
  the fix is to give them a real `## Phase 0: Branch baseline` block in the body, not to delete
  them.
- **Not edited** — neighbour's file; this is the contention sweep's to apply.

Other cross-checks against F1's plan came back **clean**, and are recorded so the sweep does
not re-derive them: its `label → href` map matches `AppShell.astro`'s `items`/`tabs` exactly
(`dashboard:/app/start`, `missions:/app/task`, `shop:/app/upgrades`, `growth:/app/growth`,
`worlds:/app/worlds`, `parent:/app/report`); `shift_log` really does carry an insertable
`created_at timestamptz not null default now()` and `appendShiftLog` inserts exactly the five
columns its Phase 6 contract names; `e2e/helpers/accounts.ts` really does have the service-role
`admin` client it plans to seed through. The two plans' shared-file claims hold in both
directions: F1 appends `seedShiftWeek` at end of file and F2 touches `e2e/helpers/accounts.ts`
not at all; F1 edits `## Parent PIN routes (RLS surface)` and F2 appends a brand-new H2. F2's
form change is safe for F1's new specs — `signInViaUI` submits via
`getByRole("button", { name: t.auth.signin.submit })` and the Radix control exposes
`role="checkbox"`, so it cannot become an ambiguous match, and `waitForIslands` counts
`astro-island` elements, which the new control does not add to.
