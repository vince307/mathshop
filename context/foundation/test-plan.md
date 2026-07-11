# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-07-12 (Phases 2–4 complete; component layer installed)

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the team
   is worried about X, and the failure would surface somewhere in <area>"
   carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents _what
   could fail_ and _why we believe it's likely_ — drawn from documents,
   interview, and codebase _signal_ (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/`, `supabase/`, `tests/`
(excluding docs, fixtures, archive, build output).

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the _evidence that surfaced
this risk_ — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| #   | Risk (failure scenario)                                                                                                                                      | Impact | Likelihood | Source (evidence — not anchor)                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | A schema change quietly breaks per-account RLS isolation → one parent's child profiles/progress become readable or writable by another, with no loud failure | High   | High       | PRD §Access Control, FR-012/FR-015; lessons.md L-001/L-002; interview Q3; hot-spot dir `supabase/migrations` (2 commits/30d) |
| 2   | Shift-end write fails silently or is not durable → a completed shift's coins/level/shop-state are lost on reopen (or a retried write double-pays)            | High   | High       | PRD FR-010/FR-012; interview Q1; `context/changes/network-loss-handling/research.md`                                         |
| 3   | Auth/session regression → a valid parent is logged out, or a stale/anonymous session reaches a protected play surface (gate fails open)                      | High   | High       | CLAUDE.md §Architecture (middleware / `PROTECTED_ROUTES`); interview Q2; hot-spot dir `src/components/auth` (6 commits/30d)  |
| 4   | Onboarding critical path (sign-up → verification → first-profile creation → start screen) breaks; zero coverage on the universal entry point                 | High   | Medium     | PRD US-01, FR-001/FR-014; interview Q4; roadmap S-01                                                                         |
| 5   | Authorization / IDOR — an authenticated parent A reaches account B's profile or shift resource via a forged id (logged-in ≠ owns-this-resource)              | High   | Medium     | PRD §Access Control, FR-015; abuse lens (auth + user input); roadmap S-07 (multi-row per account)                            |
| 6   | Soft-failure guardrail regresses → a wrong answer triggers harsh feedback (red flash / buzzer / "game over" / coin loss)                                     | High   | Medium     | PRD §Guardrails ("violating this regresses the whole product premise"); FR-008/FR-009; US-02 AC                              |
| 7   | Procedural task generation escapes the grade 1–2 band → impossible or negative-change tasks handed to a 6-year-old                                           | Medium | Medium     | PRD FR-006/FR-007; §Success Criteria secondary ("3 stars within 5 shifts")                                                   |

**Impact × Likelihood rubric.** High / Medium / Low on both axes; ordering,
not false precision. Protect High × High (#1, #2, #3) first. High-impact ×
low-likelihood infrastructure events (e.g. a Supabase regional outage) belong
to observability/alerting, not a test — see §7.

### Risk Response Guidance

| Risk | What would prove protection                                                                                                                                                                                         | Must challenge                                                                                                                                                   | Context `/10x-research` must ground                                                                                                 | Likely cheapest layer                                                                       | Anti-pattern to avoid                                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| #1   | Account B cannot SELECT / UPDATE / DELETE / INSERT-on-behalf account A's rows on **every** account-owned table, including new ones (shift state, extra profiles)                                                    | "RLS enabled = isolated"; "the SELECT test passing means INSERT is safe"                                                                                         | which tables are account-owned, owner column, all four per-op policies present, the service-role provisioning pattern               | integration (real Postgres RLS via a Supabase test instance)                                | chaining `.select()` on the INSERT-on-behalf attempt (L-002 false green); acting as the service-role client (RLS bypassed)               |
| #2   | A completed shift's state is durably readable on a fresh fetch in a new session; a replayed/duplicated shift-end does not double-pay                                                                                | "client returned 200 ⇒ row committed"; "supabase-js will not retry my write" (auto-retry lands at v2.102.0; project is on ^2.99.1 today)                         | the shift-end write shape (UPDATE vs ledger/RPC), the idempotency key, where `coins` is derived                                     | integration (write → independent re-fetch round-trip) + unit (payout idempotency on replay) | asserting on the client response object instead of a re-read of durable state; happy-path-only with no replay/failure case               |
| #3   | An anonymous request to a protected route redirects to login; an authenticated parent reaches the gated surface; sign-out invalidates the session so the gate re-triggers                                           | "login works ⇒ gating works" (the anon / stale-session path is the one that fails open)                                                                          | middleware resolution of `context.locals.user`, the `PROTECTED_ROUTES` list, the `@supabase/ssr` cookie/session lifecycle under SSR | integration on middleware + auth API routes (request-level)                                 | over-mocking the Supabase client so the test asserts the mock, not the gate; reaching for e2e where request-level integration catches it |
| #4   | Full sign-up → verify → first-profile → start-screen flow completes; error branches (duplicate email, unverified, invalid avatar) surface in Polish with no crash and no English leak                               | "the form renders ⇒ the flow works"; "verification is Supabase's problem" (our redirect/branch logic owns the transitions)                                       | the signup/signin API route contracts, redirect targets, where the first-profile insert happens, the zod schemas                    | integration on the API routes + the profile-creation service                                | snapshot test of the form; happy-path-only that skips the error branches that actually break                                             |
| #5   | A's session presenting B's resource id is denied at the app layer with no state change — not relying on RLS as an accident                                                                                          | "logged in ⇒ authorized for this resource" (ownership ≠ authentication); "RLS will catch it" (the endpoint may use a service-role client or mis-scope the query) | which endpoints read/write profile/shift data, whether they use the user-scoped client, how the resource id is supplied             | integration negative test (A's session + B's id → denied + durable no-op)                   | testing only with the owner's id (never exercises the cross-owner path); asserting the error message instead of the durable no-op        |
| #6   | A wrong answer keeps accumulated coins, shows a soft retry (no red flash / buzzer / game-over), and surfaces the scaffolding hint after 1–2 consecutive misses; the task still completes on eventual correct answer | "feedback exists ⇒ it's soft"; "a wrong answer ends the task"                                                                                                    | the task feedback component state machine, the wrong-attempt counter, what the hint renders                                         | component / interaction test (React Testing Library)                                        | asserting CSS classes or animation snapshots instead of the behavioral invariant (coins unchanged, no game-over, hint appears)           |
| #7   | Generated tasks stay within grade 1–2; change-making never yields negative change; counting counts are representable/tappable                                                                                       | "random within range" without asserting the post-conditions (a valid operand range can still produce an impossible change-making setup)                          | the generator's parameters per level, the band definition, the invariants of a valid task                                           | unit (bounds / property tests over many seeds)                                              | the oracle problem — asserting the generator's output equals the generator's own formula (tautological)                                  |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| #   | Phase name                                   | Goal (one line)                                                                                              | Risks covered | Test types                                                                                             | Status      | Change folder                               |
| --- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------ | ----------- | ------------------------------------------- |
| 1   | Auth critical-path + session gating          | Prove the universal entry works and the gate never fails open; establish the test harness later phases reuse | #3, #4        | integration (auth routes + middleware); harness bootstrap (vitest config, Supabase test-client helper) | researched  | context/changes/testing-auth-critical-path/ |
| 2   | Isolation contract + authorization hardening | Lock the #1 correctness invariant into a reusable per-table pattern before the schema grows                  | #1, #5        | integration (RLS cross-account, IDOR negative) + L-002 meta-check                                      | complete    | in feature changes — see §6.6                                           |
| 3   | Shift persistence + scoring/generation       | Prove "come back and your progress is there" holds, and that scoring/generation are correct                  | #2, #7        | integration (persistence round-trip + replay idempotency) + unit (scoring, payout, band bounds)        | complete    | in feature changes — see §6.6                                           |
| 4   | Gameplay guardrail behavior                  | Prove the soft-failure premise cannot silently regress                                                       | #6            | component / interaction (task feedback)                                                                | complete    | coverage sweep 2026-07-12 — §6.6                                           |

**Status vocabulary** (fixed — parser literals): `not started` → `change opened` → `researched` → `planned` → `implementing` → `complete`.

Phase ordering rationale: Phase 1 first because the entry flow is what every
user hits, has zero coverage today, runs against code that already exists, and
its harness setup is reused by every later phase. Phase 2 next because per-account
isolation is the project's highest-stakes invariant and must be locked **before**
S-04 (shift state) and S-07 (multi-profile) reshape the schema. Phases 3 and 4
are gated on gameplay code that does not exist yet (S-02/S-03/S-04), so they
ship alongside those slices.

## 4. Stack

| Layer                   | Tool                      | Version                                                  | Notes                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------- | ------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| unit + integration      | Vitest                    | ^4.1.8                                                   | Configured pre-Phase-1 (`vitest.config.ts`: node env, `.env.test`, serial files, 30s timeouts). Phase 1 (`testing-auth-critical-path`) added the `@/*` alias, the `tests/helpers/` Supabase + Astro request harness (cookie jar, `APIContext`/middleware builders), and `astro:middleware` / `astro:env/server` stubs so the real middleware + routes import under node-env Vitest. |
| RLS / DB integration    | Supabase JS client        | `@supabase/supabase-js` ^2.99.1, `@supabase/ssr` ^0.10.3 | Real-Postgres integration via local Supabase + a service-role provisioning client. Reference: `tests/child-profiles-isolation.test.ts`. Note: built-in auto-retry lands at supabase-js v2.102.0 — not active on ^2.99.1.                                                                                                                                                            |
| component / interaction | React Testing Library     | `@testing-library/react` ^16.3.2, `jsdom` ^29.1.1        | Installed by Phase 4 (2026-07-12) with `@testing-library/user-event` + `jest-dom`. No global config: component test files opt into the DOM env with a `// @vitest-environment jsdom` first-line pragma (node stays the default); vitest `include` now covers `.tsx`. Reference: `tests/task-guardrail.test.tsx`.                                                                    |
| coverage                | @vitest/coverage-v8       | ^4.1.10                                                  | `npx vitest run --coverage --coverage.include="src/**"`. Baseline 2026-07-12: `src/data` 96% / `src/lib(+services)` 88–98% stmts; the component layer was the 0% area Phase 4 addressed.                                                                                                                                                                                            |
| API mocking             | none yet                  | —                                                        | Auth/profile integration tests hit a real local Supabase rather than mocking the edge; revisit if external HTTP boundaries appear.                                                                                                                                                                                                                                                  |
| e2e                     | none                      | —                                                        | No Playwright/Cypress installed. Not planned for v1 — request-level integration covers the critical paths (#3, #4) more cheaply. Re-evaluate if a full deployed-shape failure mode appears.                                                                                                                                                                                         |

**Stack grounding tools (current session):**

- Docs: Context7 — available; can ground current Vitest 4 config, `@supabase/ssr` SSR session handling, and React Testing Library setup; checked: 2026-06-19
- Search: Exa.ai — available; used earlier this session to ground supabase-js retry/timeout behavior for Risk #2; checked: 2026-06-19
- Runtime/browser: no Playwright MCP exposed in this session — candidate e2e/visual layer if ever needed, not usable now; checked: 2026-06-19
- Provider/platform: Linear MCP + `gh` CLI available; no dedicated Supabase MCP confirmed; Vercel deploy is via GitHub auto-deploy; checked: 2026-06-19

## 5. Quality Gates

| Gate                                | Where                         | Required?                                     | Catches                                                 |
| ----------------------------------- | ----------------------------- | --------------------------------------------- | ------------------------------------------------------- |
| lint + typecheck                    | local (husky pre-commit) + CI | required                                      | syntactic / type drift                                  |
| RLS cross-account isolation test    | CI on PR (merge gate)         | required (already wired for `child_profiles`) | silent per-account data leak                            |
| unit + integration                  | local + CI                    | required after §3 Phase 1                     | logic regressions on auth/session, persistence, scoring |
| authorization / IDOR negative tests | CI on PR                      | required after §3 Phase 2                     | ownership-check bypass at the app layer                 |
| component / interaction (guardrail) | CI on PR                      | required after §3 Phase 4                     | harsh-feedback regression on wrong answers              |
| pre-prod smoke                      | between merge + prod (Vercel) | optional                                      | environment-specific SSR/runtime failures               |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once the
relevant rollout phase ships; before that, it reads "TBD — see §3 Phase <N>."

### 6.1 Adding an integration test for an auth/session path

Pattern established by `testing-auth-critical-path` (see `tests/auth-session-gating.test.ts`).
Drive the **real** middleware against a **real** local Supabase session — never mock the
Supabase client (that asserts the mock, not the gate; §2 Risk #3 anti-pattern).

1. Provision a confirmed user with `createSignedInUser()` from `tests/helpers/supabase.ts`.
2. **Mint a session through the real signin route**, not by hand-formatting cookies: POST to
   `signin`'s handler with a `tests/helpers/astro.ts` `buildContext({ method: "POST", formData,
cookies: jar })`; the `@supabase/ssr` `setAll` path writes the session cookies into your
   `createCookieJar()`.
3. Replay them into the request under test: `buildContext({ url: "/dashboard", cookies: jar })`
   serializes the jar into the `Cookie:` header, then `runMiddleware(onRequest, context)`.
4. Assert the gate: anon → `Location: /auth/signin`; authenticated → `reachedNext(response)`.
   For the authenticated case also assert a **durable** session (`context.locals.user?.id` or a
   `getUser()` re-read), not merely the absence of a redirect (L-002).
5. Sign-out re-trigger: POST the real signout route with the jar, then replay the now-cleared
   cookies — the gate must redirect again.
6. Guard the **intended** protected set so a forgotten route can't fail open; meta-check it by
   temporarily adding a route to `PROTECTED_ROUTES` and confirming the guard goes red.
7. Env-missing / unconfigured cases need a file-scoped `vi.mock("astro:env/server", () => ({
SUPABASE_URL: undefined, SUPABASE_KEY: undefined }))`, so keep them in a **separate file**
   (`tests/auth-env-missing.test.ts`) — that mock would poison real-session tests in the same file.

### 6.2 Adding a cross-account isolation test for a new owned table

- Partially established by F-01. Reference: `tests/child-profiles-isolation.test.ts`; contract in `docs/reference/rls-isolation.md`; skeleton in `docs/reference/rls-template.sql`. §3 Phase 2 will generalize this into a reusable per-table recipe and add the app-layer IDOR negative pattern (Risk #5).

### 6.3 Adding a test for a new API endpoint

Pattern established by `testing-auth-critical-path` (see `tests/auth-routes.test.ts`). These
Astro routes are **redirect-only** (never JSON), so assert on the `Location` header.

1. Build the request with `buildContext({ url, method: "POST", formData })` from
   `tests/helpers/astro.ts`; the handler reads `context.request.formData()`.
2. Call the route's exported `POST(context)` directly and assert the redirect target per branch:
   success target, error branch (`?error=…`), and the unconfigured branch (`createClient`
   returns null → `Supabase is not configured`).
3. When a route establishes a session, assert it **durably** (re-read via `getUser()` over the
   captured cookies), not just the redirect (L-002).
4. Pin current behavior the route does _not_ yet guard (e.g. no server-side zod validation:
   empty fields → an error redirect, not a 500) so a future hardening change is a conscious one.
5. Provision via `tests/helpers/supabase.ts`; clean up signup-created users with
   `deleteUserByEmail()` (the route returns only a redirect, never the new id).

Extended in §3 Phase 2 (test plan) for ownership/authorization (IDOR) assertions on endpoints
that read/write account-owned resources.

### 6.4 Adding a persistence / scoring test

Patterns live in `tests/shifts-complete.test.ts` (route persistence: server-side
earnings recomputation, L-002 spoof negatives, monotonic skill fold, exactly-one
`shift_log` row) and `tests/cross-device-restore.test.ts` (durable re-read from a
FRESH session — the "come back and it's there" proof). Unit bounds for scoring /
payout / grade-band generation: `tests/{shift,skills,tasks,counting-tasks,change-making-tasks}.test.ts`.
**Known pinned behavior:** a duplicate shift-end POST pays twice — there is no
idempotency key by design; the pin (shifts-complete, "PINS current behavior")
makes adding one a conscious hardening change (watch the supabase-js ≥2.102
auto-retry horizon from §2 Risk #2).

### 6.5 Adding a gameplay component-behavior test

Pattern established by `tests/task-guardrail.test.tsx` (Phase 4, 2026-07-12):

1. First line of the file: `// @vitest-environment jsdom` — component tests opt
   into the DOM env per-file; the suite default stays `node` (no config fork).
2. RTL without globals: `afterEach(cleanup)` manually (vitest `globals` is off).
3. Assert the BEHAVIORAL invariants, never CSS/animation (§7): wrong answer →
   polite `role="status"` retry (assert `role="alert"` never appears), child's
   tapped-coin state preserved, board + check button stay enabled, hint card
   only after `RETRY_HINT_THRESHOLD` misses, eventual success completes.
4. Completion rides a 1.4s beat: `vi.useFakeTimers()` + `act(() => vi.advanceTimersByTime(1400))`;
   always restore real timers in `finally`. Use `fireEvent` (not user-event —
   its delay handling fights fake timers).
5. Resolve accessible names from `t.*` (e.g. `t.task.coinLabel`) — no hardcoded
   Polish in queries beyond what the test itself injects as props.

### 6.6 Per-rollout-phase notes

(Optional. After each phase lands, `/10x-implement` appends a 2–3 line note here capturing anything surprising the phase taught.)

**Phases 2 & 3 — delivered inside feature changes (recorded 2026-07-12):** the
isolation contract generalized itself through feature work rather than a
dedicated rollout folder — F-01's per-table pattern was reproduced for
`shift_log` + `account_settings` in their shipping migrations' changes, and the
IDOR negatives live in the route suites (`upgrades-buy`, `shifts-complete`,
`profile-deletion`, `account-deletion` — each asserts the durable no-op, not the
error message). Phase 3's substance shipped with S-04/S-05/S-10
(`shifts-complete`, `cross-device-restore`, the data-layer unit suites); the
2026-07-12 sweep added the missing replay-behavior pin (§6.4). Statuses in §3
flipped accordingly; no separate change folders exist for these phases.

**Phase 4 — Gameplay guardrail behavior (coverage sweep, 2026-07-12):** installed
the §4 component layer (jsdom + RTL via per-file env pragma; vitest `include`
extended to `.tsx`) and landed `tests/task-guardrail.test.tsx` — Risk #6's
invariants on the real `TaskScreen`/`useCoinTask`/`ChangeMakingTask` two-stage
flow. Coverage baseline measured with `@vitest/coverage-v8` (added): `src/data`
96%, `src/lib(+services)` 88–98%; i18n helper gap closed (`i18n-helpers.test.ts`).

**Phase 1 — Auth critical-path + session gating (`testing-auth-critical-path`):**

- The harness was further along than §4 claimed (config + CI merge gate already existed); the
  real Phase-1 delta was request-level Astro scaffolding. `vi.mock` of the two Astro virtual
  modules (`astro:middleware`, `astro:env/server`) lets the real middleware/routes run under
  node-env Vitest with **no production change** — but the env mock is file-scoped, so
  env-missing cases live in their own file.
- An unrelated untracked `assets/` dir (mockups + minified vendor JS) was crashing `eslint .`
  (heap OOM / "Invalid string length" in the formatter); fixed by gitignoring `assets/`.
- **Coverage debt (Risk #4, deferred):** email-verification code exchange, first-profile
  creation, and the start screen are unbuilt — their onboarding tests land with slices
  **S-01/S-02**, not here. Phase 1 covers only the built signup/signin route contracts.
- **Known issues pinned by tests** (current behavior asserted; fixes are separate changes):
  1. `src/pages/api/auth/signout.ts` is missing `export const prerender = false`, and is a
     **silent no-op when Supabase is unconfigured** (redirects to `/` without clearing cookies)
     — `tests/auth-env-missing.test.ts`.
  2. The middleware `startsWith` gate has no boundary, so `/dashboardXYZ` also gates —
     `tests/auth-session-gating.test.ts`.
  3. The raw (English) Supabase `error.message` leaks through `?error=` (FR-013) with no
     Polish-mapping layer — `tests/auth-routes.test.ts`.

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Respect these
unless the underlying assumption changes.

- **Snapshot / visual tests of shop art and animations** — they break constantly and catch nothing real; the soft-failure _behavior_ is asserted at the component level (Risk #6) without snapshotting visuals. Re-evaluate only if a rendering regression causes a real incident. (Source: Phase 2 interview Q5.)
- **Supabase / framework internals** — testing the library, not our code. We assert our wiring (gating, isolation, persistence), not Supabase's auth or PostgREST behavior.
- **Per-Polish-string assertions** — no test per phrase. A coarse no-English-leak check at the user-visible surface is enough; phrase-level wording is content, not logic (FR-013).
- **High-impact × low-likelihood infrastructure events** (e.g. a Supabase regional outage) — these belong to observability/alerting, not a test.
- **Secret/PII leakage** (considered under the abuse lens) — constrained by design (only parent email is PII; secrets resolve via `astro:env`, never `import.meta.env`). A cheap CI grep that no service key appears in the client bundle is a candidate add inside §3 Phase 2, not a standalone risk.

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-07-12
- Stack versions last verified: 2026-07-12
- AI-native tool references last verified: 2026-06-19

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
