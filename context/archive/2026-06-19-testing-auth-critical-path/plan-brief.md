# Auth Critical-Path + Session Gating Tests — Plan Brief

> Full plan: `context/changes/testing-auth-critical-path/plan.md`
> Research: `context/changes/testing-auth-critical-path/research.md`

## What & Why

Implement **Phase 1 of the test plan**: integration tests proving the auth **gate never fails
open** (Risk #3) and that the **built** signup/signin **route contracts** hold (Risk #4), plus
the **request-level test harness** every later rollout phase reuses. The entry flow is what
every user hits and has zero coverage today; the gate failing open (a stale/anonymous session
reaching a protected surface) is a high-impact, high-likelihood failure.

## Starting Point

`vitest.config.ts` exists and CI already runs `vitest run` against a real local Supabase as a
merge gate — so the expensive infra is proven. What's missing is **request-level Astro
scaffolding**: a `@/*` alias into Vitest, an `APIContext`/`Request`-with-cookies builder, a
middleware runner, and an extracted Supabase provisioning helper (currently inlined in
`tests/child-profiles-isolation.test.ts`). The middleware and auth routes already exist and are
untested.

## Desired End State

`npm run test` runs the existing isolation suite plus new session-gating and auth-route suites,
all green against local Supabase, all driven by a **real** session (never a mocked Supabase
client). A second engineer can write a new auth/session test from `tests/helpers/` and cookbook
§6.1/§6.3 alone. Test-plan §4's stale claim is corrected; three latent issues are pinned by
tests and recorded as known issues.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Risk #3 methodology | Real local Supabase session | `getUser()` is a real GoTrue round-trip — mocking the client asserts the mock, not the gate (§2 anti-pattern). | Research |
| Risk #4 scope | Built leg only (route contracts) | Email-verify/profile/start-screen don't exist; test only code that ships today, log the rest as debt. | Research |
| Virtual imports | `vi.mock` the two ids (no prod change) | Shim `astro:middleware`/`astro:env/server` so real modules import — no testability refactor risking the live gate. | Plan |
| Helper extraction | `tests/helpers/` + refactor isolation test | One source of truth; the existing green test proves the helper before new tests depend on it. | Plan |
| Latent issues | Pin all three as behavior tests | User opted to make the `startsWith` over-match, signout no-op, and English leak visible now. | Plan |

## Scope

**In scope:**
- Request-level harness: Vitest `@/*` alias, `tests/helpers/` (Supabase + Astro request),
  virtual-import shims, smoke test.
- Risk #3 session-gating suite (anon redirect, authed pass, sign-out re-trigger, protected-set
  guard, null-client + boundary pins).
- Risk #4 auth-route contract suite (redirect targets, error/unconfigured branches,
  no-validation behavior, English-leak pin).
- Test-plan §4/§6.1/§6.3 correction; coverage-debt + known-issue records.

**Out of scope:**
- Building email verification, first-profile creation, or the start screen (slices S-01/S-02).
- Fixing the three latent issues in production code (pinned, not fixed).
- zod/server validation; Playwright/e2e; React Testing Library/DOM env; per-Polish-string
  assertions.

## Architecture / Approach

The harness mints a session by **driving the real signin route** and capturing the cookies
`@supabase/ssr` writes via `setAll`; those cookies are replayed as a `Cookie:` header into a
middleware request, so `getUser()` validates a genuine local session. The real **signout
route** clears them for the gate-re-trigger test. The only mocks are the two pure virtual
modules (`astro:middleware` → identity, `astro:env/server` → process.env). This keeps the
gating logic under test 100% real and changes no production code.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Request-level harness | `@/*` alias, `tests/helpers/`, virtual shims, smoke test | Cookie round-trip (chunked `sb-…` cookies) must serialize correctly |
| 2. Risk #3 session gating | Anon/authed/sign-out gate tests + protected-set guard + pins | Hoisting `vi.mock` before real-module import |
| 3. Risk #4 route contracts | signup/signin redirect + error + unconfigured + leak pin | Asserting durable session (L-002), not just the 302 |
| 4. Doc correction | Fix §4, fill §6.1/§6.3, record debt + known issues | Low — doc-only |

**Prerequisites:** Local Supabase stack up (`npx supabase start` + `db reset`); `.env.test`
populated.
**Estimated effort:** ~2 sessions across 4 phases (harness is the bulk of phase 1).

## Open Risks & Assumptions

- Importing the real `src/middleware.ts` / route modules under `environment: "node"` works
  with the two `vi.mock` shims (research's recommended path; the smoke test in Phase 1 proves
  it before later phases depend on it).
- Session cookies may be chunked (`.0`/`.1`) — the cookie jar must round-trip all entries.
- **Executor:** this plan writes tests against *existing* production code, so run it with
  **`/10x-implement`**, not `/10x-tdd` (the TDD skill would redirect every phase because the
  code already exists).

## Success Criteria (Summary)

- `npm run test` green locally + in CI: isolation + session-gating + auth-route suites.
- The gate's anon/stale path is proven to redirect, and a forgotten protected route would be
  caught by the protected-set guard.
- A new auth/session test is writable from `tests/helpers/` + cookbook §6.1/§6.3 alone.
