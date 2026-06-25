# Auth Critical-Path + Session Gating Tests — Implementation Plan

## Overview

Implement **Phase 1 of the test plan** (`context/foundation/test-plan.md` §3): integration
tests that prove the auth **gate never fails open** (Risk #3) and that the **built**
signup/signin **route contracts** hold (Risk #4 — built leg only), plus the **request-level
test harness** every later rollout phase reuses.

All gate/route tests run against a **real local Supabase** session — never a mocked Supabase
client — because the gate's security lives in `supabase.auth.getUser()` (a real GoTrue
round-trip); mocking the client would assert the mock, not the gate (the §2 anti-pattern for
Risk #3). The two Astro virtual imports that block importing the real modules into Vitest
(`astro:middleware`, `astro:env/server`) are resolved with thin `vi.mock` shims — **no
production code changes**.

## Current State Analysis

What exists (verified against `git_commit f23d493`):

- **`vitest.config.ts`** is configured (node env, `.env.test` via dotenv, serial files, 30s
  timeouts) but has **no `resolve.alias`** — so `@/*` (used by every route/middleware import)
  does **not** resolve under Vitest. (`vitest.config.ts:9-18`, `tsconfig.json:9-11`)
- **CI already runs `vitest run` as a merge gate** against a real local Supabase
  (`.github/workflows/ci.yml`), with `enable_confirmations = false` (`supabase/config.toml`)
  so admin-confirmed users work without an email round-trip. The expensive infra is proven.
- **`tests/child-profiles-isolation.test.ts`** is the reference DB/RLS pattern. Its
  provisioning helpers (`admin` service-role client, `createSignedInUser()`, `TestAccount`,
  password constant, env-var reads) are **inlined** — a second test must duplicate or extract
  them.
- **`src/middleware.ts`** — resolves `context.locals.user` via `getUser()` (not
  `getSession()`); gates `PROTECTED_ROUTES = ["/dashboard"]` with `startsWith`; anon hit →
  `redirect("/auth/signin")`; `getUser()` is **not** in try/catch.
- **`src/lib/supabase.ts`** — `createClient` returns **`null`** when either secret is unset
  (the only fail-closed branch); uses `getAll`/`setAll` cookie interface; reads
  `SUPABASE_URL`/`SUPABASE_KEY` from `astro:env/server`.
- **`src/pages/api/auth/{signin,signup,signout}.ts`** — redirect-only contracts (never return
  JSON); read `formData()` with blind `as string`; **no zod / no server validation**; errors
  redirect with the **raw** `error.message` in `?error=`. signin success → `/`; signup
  success → `/auth/confirm-email`; signout is POST-only, clears cookies implicitly, and is a
  **silent no-op when env is missing** (redirects to `/` with cookies intact). `signout.ts`
  is **missing `export const prerender = false`**.

What's missing (the true Phase-1 harness delta):

1. `@/*` alias into Vitest. 2. An `APIContext` builder (fake `request`/`cookies`/`locals`/
`redirect`/`url`/`next`). 3. A `Request`-with-cookies builder for middleware. 4. A middleware
runner. 5. An extracted Supabase test-client/session helper. 6. Handling for the
`astro:middleware` / `astro:env/server` virtual imports.

What does **not** exist (Risk #4 coverage debt, out of scope — see "What We're NOT Doing"):
email-verification code exchange, first-profile creation, the MathShop start screen.

## Desired End State

`npm run test` (locally and in CI) runs the existing isolation suite **plus** new suites for
session gating and auth-route contracts, all green against local Supabase. A second engineer
can write a new auth/session integration test by following `tests/helpers/` and cookbook
§6.1/§6.3 without re-deriving the harness. The test-plan §4 stale claim is corrected and the
three latent issues are pinned by tests and recorded as known issues.

Verify: `npm run test` green; `tests/helpers/` exists and is imported by both the refactored
isolation test and the new suites; test-plan §4/§6.1/§6.3 updated.

### Key Discoveries:

- The gate's real signal is `supabase.auth.getUser()` (`src/middleware.ts:12`) — a real
  GoTrue round-trip. Mocking the client tests the mock (§2 anti-pattern for #3).
- `createClient` returns `null` when secrets are unset (`src/lib/supabase.ts:6-8`) — the
  env-missing path is deterministically reachable, so the fail-closed-on-null and the
  signout-no-op behaviors are testable without special setup.
- The gate is **fail-open by default** (opt-in `PROTECTED_ROUTES`); `startsWith` has no
  boundary so `/dashboardXYZ` also gates (`src/middleware.ts:18`). The highest-value #3
  assertion is a **guard on the intended protected set** so a future play surface isn't
  silently public.
- Minting the session via the **real signin route** (capturing the cookies `@supabase/ssr`
  writes through `setAll`) avoids hand-formatting the `sb-<ref>-auth-token` cookie and keeps
  the session path 100% real — and lets the gate re-trigger test reuse the **real signout
  route** to clear it. This honors L-002 (assert durable session, not just the 302).
- `.env.test` provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; the
  app's generic `SUPABASE_KEY` maps to the **anon** key in tests.

## What We're NOT Doing

- **Not** building email verification, first-profile creation, or the start screen — they
  don't exist; their tests are coverage debt tied to slices S-01/S-02 (recorded in Phase 4).
- **Not** fixing the three latent issues in production code — Phase 1 **pins current
  behavior** with tests + known-issue notes (`signout.ts prerender`, `startsWith` boundary,
  raw-error English leak). Fixes are separate changes.
- **Not** adding zod / server validation — tests assert *current* no-validation behavior.
- **Not** a testability/DI refactor of middleware or routes — `vi.mock` of the two virtual
  ids keeps production code untouched.
- **Not** adding Playwright/e2e, React Testing Library, or a DOM env — request-level
  integration covers #3/#4 more cheaply (test-plan §4).
- **Not** per-Polish-string assertions — the English-leak test is a single coarse assertion
  (test-plan §7), not per-phrase.

## Implementation Approach

Build the harness first (Phase 1), then the two test suites that consume it (Phases 2–3),
then correct the docs (Phase 4). The harness mints sessions by **driving the real auth route
handlers** and capturing the cookies `@supabase/ssr` writes; those captured cookies are
replayed as a `Cookie:` header into a middleware request, so `getUser()` validates a genuine
local session. The only mocks are the two pure virtual modules.

## Critical Implementation Details

- **Virtual-import shims must be hoisted.** `vi.mock("astro:middleware", ...)` and
  `vi.mock("astro:env/server", ...)` must be registered before the real `src/middleware.ts` /
  route modules are imported (Vitest hoists `vi.mock`; use a shared setup or top-of-file
  mocks, and dynamic `import()` of the modules under test if ordering needs to be explicit).
  `astro:env/server` must map `SUPABASE_KEY → process.env.SUPABASE_ANON_KEY` and `SUPABASE_URL
  → process.env.SUPABASE_URL`; to exercise the null-client / env-missing branch, a test
  overrides the mock to return `undefined`.
- **Cookie round-trip is the crux.** `@supabase/ssr`'s `getAll` reads the request's `Cookie`
  header; `setAll` writes to `cookies.set`. The fake cookies jar must (a) record `set`/
  `delete` writes and (b) expose a serializer to `Cookie:` header form so the session minted
  by the signin route can be replayed into the middleware request. Session cookies may be
  **chunked** (`.0`/`.1`) — the jar must round-trip all entries, not just the first.
- **Serial execution required.** Tests provision/delete real users; `fileParallelism: false`
  is already set — keep new suites compatible (unique emails via `randomUUID`, teardown via
  `admin.auth.admin.deleteUser` relying on `ON DELETE CASCADE`).

## Phase 1: Request-level test harness

### Overview

Make the real Astro modules importable and exercisable under Vitest, and extract shared
provisioning so later phases don't duplicate it.

### Changes Required:

#### 1. Vitest path alias

**File**: `vitest.config.ts`

**Intent**: Mirror the `@/*` → `./src/*` alias so route/middleware imports of `@/lib/...`
resolve under Vitest.

**Contract**: Add a `resolve.alias` mapping `@` → the `src` dir (or wire
`vite-tsconfig-paths`). Must not disturb the existing `loadEnv({ path: ".env.test" })` or
`test` block.

#### 2. Extract Supabase provisioning helper

**File**: `tests/helpers/supabase.ts` (new), `tests/child-profiles-isolation.test.ts` (refactor)

**Intent**: Lift the inlined provisioning pattern into one shared module and prove it via the
existing green test before new tests depend on it.

**Contract**: Export `admin` (service-role client), `createSignedInUser(): Promise<TestAccount>`,
the `TestAccount` type, and the env-var validation. Refactor `child-profiles-isolation.test.ts`
to import them; behavior unchanged. The env-missing `throw` and `PASSWORD` constant move into
the helper.

#### 3. Astro request/context harness

**File**: `tests/helpers/astro.ts` (new)

**Intent**: Provide the request-level scaffolding: an `APIContext` builder, a fake cookies jar
with header serialization, and a middleware runner.

**Contract**: Export (a) `createCookieJar()` → object with `get/set/delete/getAll` plus
`toCookieHeader()`; (b) `buildContext({ url, method, formData|body, cookies, locals })` →
an object shaped enough for the route/middleware handlers (`request` with `headers`+`formData`,
`cookies`, `url` as `URL`, `locals`, `redirect(path, status?)` returning a `Response` with
`Location`, and `next()` returning a sentinel `Response`); (c) `runMiddleware(onRequest,
context)` → the handler's returned `Response`. `redirect` defaults to 302.

#### 4. Virtual-import shims

**File**: `tests/helpers/astro-virtual.ts` (new) and/or per-suite `vi.mock` calls

**Intent**: Make `astro:middleware` and `astro:env/server` resolvable in node-env Vitest with
no production change.

**Contract**: `astro:middleware` → `{ defineMiddleware: (fn) => fn }` (identity, so `onRequest`
is the raw async function). `astro:env/server` → `{ SUPABASE_URL: process.env.SUPABASE_URL,
SUPABASE_KEY: process.env.SUPABASE_ANON_KEY }`. Document how a test overrides the env mock to
return `undefined` for the null-client branch.

#### 5. Harness smoke test

**File**: `tests/harness-smoke.test.ts` (new)

**Intent**: Prove the real middleware module imports and runs under Vitest before the gate
tests rely on it.

**Contract**: Import the real `src/middleware.ts` `onRequest` through the shims and assert a
trivial public request (e.g. `/`) reaches `next()` (no throw, no virtual-import error).

### Success Criteria:

#### Automated Verification:

- Existing isolation suite still green after refactor: `npm run test`
- Harness smoke test passes (real `src/middleware.ts` imports + runs): `npm run test`
- Lint + typecheck pass: `npm run lint`
- `@/lib/...` resolves under Vitest (no "cannot find module" for the alias)

#### Manual Verification:

- `tests/helpers/` reads as a reusable module a second engineer could follow without the
  isolation test open

**Implementation Note**: After automated verification passes, pause for manual confirmation
before Phase 2.

---

## Phase 2: Risk #3 — session gating integration tests

### Overview

Prove the gate: anon redirects, authenticated passes, sign-out re-triggers the gate, the
intended protected set is guarded, and the env-missing path behaves as observed.

### Changes Required:

#### 1. Session-gating suite

**File**: `tests/auth-session-gating.test.ts` (new)

**Intent**: Exercise the real `src/middleware.ts` against real local Supabase sessions minted
via the real auth routes.

**Contract**: Cover —
- **Anon → redirect**: no session cookie + request `/dashboard` → 302 `Location:
  /auth/signin`.
- **Authenticated → pass**: provision a confirmed user; drive the real signin route to mint
  session cookies into the jar; replay them on a `/dashboard` request → `next()` reached (no
  redirect). Assert a **durable session** exists (e.g. `getUser()` via the replayed cookies
  returns the user — L-002), not merely the absence of a 302.
- **Sign-out re-triggers gate**: drive the real signout route with the session cookies; replay
  the resulting (cleared) cookies on `/dashboard` → 302 `/auth/signin`.
- **Protected-set guard**: assert the intended `PROTECTED_ROUTES` set gates (anon `/dashboard`
  → redirect) **and** a representative non-protected path (e.g. `/`, a future play surface
  prefix) passes — so a forgotten addition is caught (the fail-open scenario).
- **`startsWith` boundary pin** (known issue): anon `/dashboardXYZ` also redirects; comment
  notes the prefix over-match.
- **Env-missing / null client** (known issue): with the `astro:env/server` mock returning
  `undefined`, `createClient` is `null`, `locals.user` is `null`, and an anon `/dashboard`
  request still redirects (fail-closed on null client).

#### 2. Signout env-missing no-op pin

**File**: `tests/auth-session-gating.test.ts` (same suite) or `tests/auth-routes.test.ts`
(Phase 3) — place with the gate suite

**Intent**: Document the silent no-op sign-out as current behavior.

**Contract**: With env mocked `undefined`, POST the real signout route with session cookies
present → redirects to `/` and the jar shows **no cookie-clearing** (cookies intact).
Comment marks it a known issue.

### Success Criteria:

#### Automated Verification:

- Anon → `/auth/signin`; authenticated → pass; sign-out → gate re-triggers: `npm run test`
- Protected-set guard + `startsWith` boundary pin pass: `npm run test`
- Null-client and signout-no-op pins pass: `npm run test`
- Durable-session assertion (getUser re-read) passes — not just redirect absence
- Lint + typecheck pass: `npm run lint`

#### Manual Verification:

- The protected-set guard would fail if a new protected route were added to the app but not
  to the test's intended set (spot-check by temporarily adding one)
- Known-issue comments (`startsWith`, signout no-op) are clear enough to act on later

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Risk #4 — auth route contract integration tests

### Overview

Prove the built leg of onboarding: signup/signin redirect targets, error branches, the
unconfigured branch, and current no-validation behavior — with the English-leak pinned.

### Changes Required:

#### 1. Auth-route contract suite

**File**: `tests/auth-routes.test.ts` (new)

**Intent**: Exercise the real `signup`/`signin` route handlers against local Supabase.

**Contract**: Cover —
- **signin success → `/`** and a **durable session** is established (the jar holds session
  cookies; `getUser()` via them returns the user — L-002).
- **signin bad credentials** → 302 `/auth/signin?error=<message>`.
- **signup success** (fresh unique email) → 302 `/auth/confirm-email`.
- **signup duplicate/error** → 302 `/auth/signup?error=<message>`.
- **Unconfigured branch** (env mock `undefined`) → signin → `/auth/signin?error=Supabase is
  not configured`; signup → `/auth/signup?error=Supabase is not configured`.
- **Current no-validation behavior**: missing/empty email or password produces a Supabase
  error redirect (no crash, no 500) — pins that there is no server-side zod today.

#### 2. English-leak pin

**File**: `tests/auth-routes.test.ts` (same suite)

**Intent**: Make the FR-013 leak visible as a single coarse assertion (not per-phrase, per §7).

**Contract**: Assert that a bad-credentials signin redirect carries the **raw** Supabase
message verbatim in `?error=` (e.g. decodes to the English "Invalid login credentials"),
documenting that no Polish-mapping layer exists. Comment marks it a known issue and references
§7 (coarse no-English-leak check belongs to a later mapping change).

### Success Criteria:

#### Automated Verification:

- signin success → `/` with durable session; bad creds → `?error=`: `npm run test`
- signup success → `/auth/confirm-email`; duplicate → `?error=`: `npm run test`
- Unconfigured branch (both routes) → `Supabase is not configured`: `npm run test`
- No-validation behavior pinned (missing fields → error redirect, no crash)
- English-leak pin passes (raw message present in `?error=`)
- Lint + typecheck pass: `npm run lint`

#### Manual Verification:

- The suite reads as the canonical "how to test an auth route" example for cookbook §6.3
- English-leak known-issue note is actionable for the future mapping change

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Test-plan correction + cookbook

### Overview

Correct the stale test-plan claims and fill the cookbook entries this phase establishes;
record coverage debt and the known issues.

### Changes Required:

#### 1. Correct §4 Stack

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the false "no config file yet" line with the real Phase-1 delta.

**Contract**: §4 Vitest row → note `vitest.config.ts` exists and was configured pre-Phase-1;
Phase 1 added the `@/*` alias, the `tests/helpers/` Supabase + Astro request harness, and the
virtual-import shims.

#### 2. Fill cookbook §6.1 and §6.3

**File**: `context/foundation/test-plan.md`

**Intent**: Turn the TBDs into the established patterns.

**Contract**: §6.1 (auth/session integration) → describe minting a session via the real signin
route, replaying captured cookies into a middleware request, asserting the anon→redirect gate
and the durable session (L-002), pointing at `tests/auth-session-gating.test.ts` +
`tests/helpers/astro.ts`. §6.3 (new API endpoint) → describe the route-contract pattern
(formData context, redirect-target + error-branch assertions, env-missing branch), pointing at
`tests/auth-routes.test.ts`. Optionally add a 2–3 line §6.6 note.

#### 3. Record coverage debt + known issues

**File**: `context/foundation/test-plan.md` (and/or `context/foundation/lessons.md`)

**Intent**: Make the deferred work and pinned latent issues discoverable.

**Contract**: Note the Risk #4 coverage debt (email-verification exchange, first-profile
creation, start screen → land with slices S-01/S-02). Record the three known issues pinned by
tests: `signout.ts` missing `prerender = false`, `startsWith` gate over-match, raw-error
English leak.

### Success Criteria:

#### Automated Verification:

- Markdown lint/format passes (if wired): `npm run format`
- Full suite still green: `npm run test`

#### Manual Verification:

- §4 no longer claims "no config file yet"; §6.1/§6.3 read as followable recipes
- Coverage debt + the three known issues are recorded where a future contributor will find
  them

**Implementation Note**: Final phase — roll up any pending manual items and confirm before
closeout.

---

## Testing Strategy

### Unit Tests:

- None new — Phase 1 is integration-level (the harness itself is exercised by the smoke test
  and the suites that consume it).

### Integration Tests:

- Session gating (Risk #3) against real local Supabase via the real middleware + auth routes.
- Auth-route contracts (Risk #4 built leg) against real local Supabase.

### Manual Testing Steps:

1. Run `npm run test` locally with the local Supabase stack up — all suites green.
2. Temporarily add a protected route to the app without updating the test's intended set —
   confirm the protected-set guard fails (proves the fail-open catch works).
3. Read `tests/helpers/` + cookbook §6.1/§6.3 cold — confirm a new auth test is writable from
   them alone.

## Performance Considerations

Real-user provisioning makes these suites slower than pure unit tests; `fileParallelism:
false` and 30s timeouts are already set. Keep per-test provisioning minimal (reuse a
signed-in user within a suite where assertions are independent of each other).

## Migration Notes

None — additive test code, one Vitest config alias, and doc edits. Refactoring the isolation
test is behavior-preserving and guarded by re-running it.

## References

- Related research: `context/changes/testing-auth-critical-path/research.md`
- Test plan: `context/foundation/test-plan.md` §2 (Risk #3/#4), §3 (Phase 1), §4, §6.1/§6.3, §7
- Lessons: `context/foundation/lessons.md` (L-002 durable-state assertion)
- Reference test: `tests/child-profiles-isolation.test.ts`
- Code under test: `src/middleware.ts`, `src/lib/supabase.ts`,
  `src/pages/api/auth/{signin,signup,signout}.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Request-level test harness

#### Automated

- [x] 1.1 Existing isolation suite still green after refactor — 8792a84
- [x] 1.2 Harness smoke test passes (real src/middleware.ts imports + runs) — 8792a84
- [x] 1.3 Lint + typecheck pass — 8792a84
- [x] 1.4 `@/lib/...` resolves under Vitest — 8792a84

#### Manual

- [x] 1.5 tests/helpers/ reads as a reusable module a second engineer could follow — 8792a84

### Phase 2: Risk #3 — session gating integration tests

#### Automated

- [x] 2.1 Anon → /auth/signin; authenticated → pass; sign-out → gate re-triggers
- [x] 2.2 Protected-set guard + startsWith boundary pin pass
- [x] 2.3 Null-client and signout-no-op pins pass
- [x] 2.4 Durable-session assertion (getUser re-read) passes — not just redirect absence
- [x] 2.5 Lint + typecheck pass

#### Manual

- [x] 2.6 Protected-set guard would fail if a new protected route were added but not to the test set
- [x] 2.7 Known-issue comments (startsWith, signout no-op) are clear enough to act on later

### Phase 3: Risk #4 — auth route contract integration tests

#### Automated

- [ ] 3.1 signin success → / with durable session; bad creds → ?error=
- [ ] 3.2 signup success → /auth/confirm-email; duplicate → ?error=
- [ ] 3.3 Unconfigured branch (both routes) → "Supabase is not configured"
- [ ] 3.4 No-validation behavior pinned (missing fields → error redirect, no crash)
- [ ] 3.5 English-leak pin passes (raw message present in ?error=)
- [ ] 3.6 Lint + typecheck pass

#### Manual

- [ ] 3.7 Suite reads as the canonical auth-route example for cookbook §6.3
- [ ] 3.8 English-leak known-issue note is actionable for the future mapping change

### Phase 4: Test-plan correction + cookbook

#### Automated

- [ ] 4.1 Markdown lint/format passes (if wired)
- [ ] 4.2 Full suite still green

#### Manual

- [ ] 4.3 §4 no longer claims "no config file yet"; §6.1/§6.3 read as followable recipes
- [ ] 4.4 Coverage debt + the three known issues are recorded discoverably
