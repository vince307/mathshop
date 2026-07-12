# E2E Browser Layer (Playwright) — Implementation Plan

> Test-plan rollout Phase 5 (`context/foundation/test-plan.md` §3). Phases 2–4 of this plan are browser-level test phases — drive them with `/10x-e2e`; Phases 1 and 5 are infrastructure — drive them with `/10x-implement`.

## Overview

Bootstrap a Playwright e2e layer (nothing is installed today) and prove the four browser-only user journeys against `npm run dev` (:4321) + local Supabase: onboarding (Risk #4), fresh-context restore (Risk #2), the child gameplay loop (Risk #6), and the parent PIN-gate / account-deletion danger zone. The layer's exclusive value — established in research — is journey glue, island hydration, real cookie semantics, and real interaction physics; everything else is already covered at route/unit/component level and must not be duplicated.

## Current State Analysis

- No Playwright anywhere: no deps, no config, no `e2e/` dir, no `.mcp.json` (research §Bootstrap).
- Vitest suite is broad and serial (`tests/**/*.test.{ts,tsx}`, `fileParallelism: false`, real local Supabase, `.env.test` via dotenv at `vitest.config.ts:2,8`).
- `tests/helpers/supabase.ts` is plain `@supabase/supabase-js` + `node:crypto` — importable from Playwright as-is (throws at import if env vars missing).
- App is fail-closed: missing `SUPABASE_KEY` / `PARENT_SESSION_SECRET` / `SUPABASE_SERVICE_ROLE_KEY` degrade features to 503/redirects — a misconfigured webServer env will masquerade as product bugs.
- CI has one job (lint → build → supabase start → vitest) in `.github/workflows/ci.yml`.
- Full locator inventory, timing traps, and journey chains: `context/changes/testing-e2e-playwright/research.md` (read it before writing any spec).

## Desired End State

`npx playwright test` (and a new CI job) runs a green suite in `e2e/` covering all four journeys in two Chromium projects (desktop + touch viewport), fully parallel with per-test throwaway accounts, zero `waitForTimeout` calls, all locators role/label-first with strings resolved from `src/i18n/pl.ts`. `test-plan.md` §4 e2e row and §6 cookbook reflect the new layer.

### Key Discoveries (from research.md — the grounding for every phase):

- Confirm route is `token_hash` + `verifyOtp`, NOT PKCE; local `enable_confirmations = false`; admin `generateLink` → navigate to confirm URL is the proven verification path (`tests/auth-confirm.test.ts:36-41`).
- `active_profile` cookie is session-lifetime by design (picker-on-launch); Playwright `storageState` would falsely persist it → fresh-context tests must re-sign-in through the UI.
- Shift generator is unseeded `Math.random()`; answers are DOM-derivable: counting = tap every coin; change-making = `paid − price` parsed from the story text; `starting_level` 1 profiles never see two-stage tasks.
- Hard 1400 ms beat per correct answer (`useCoinTask.ts:55-63`); shifts are 5–12 tasks; earnings exactly `5*taskCount + 3*cleanCount`.
- PIN gating is per-page/per-route (middleware only auth-gates); marker = signed 15-min `parent_verified` cookie; deletion cascade is fully isolated to the account.
- Islands navigate via `window.location.href` — hard navigations; `waitForURL` is the right wait.
- Rate limit: `sign_in_sign_ups = 30`/5 min/IP — UI signup/signin sparingly; admin provisioning bypasses it.

## What We're NOT Doing

- No WebKit/Firefox projects (engine matrix deferred; poor cost×signal for first rollout).
- No real email round-trip spec (Inbucket scraping + `enable_confirmations` flip) — generateLink covers the confirm-route half; template delivery stays out of scope.
- No PIN-lockout e2e (5 attempts + 60 s cooldown violates no-sleep; covered at route level).
- No visual/snapshot testing (test-plan §7 exclusion).
- No re-assertion of route contracts, RLS isolation, guardrail feedback styling, or scoring math — all covered by the existing suite.
- No Vercel-preview/production runs — local dev + local Supabase only (production would stall on real email confirmation).
- No product-code changes for testability (no seed injection, no data-testids) — the DOM-derivation strategy makes them unnecessary; if a spec truly cannot locate something, that's a finding to surface, not a license to patch product code silently.

## Implementation Approach

Bootstrap first (config, fixtures, MCP, smoke) so every journey phase reuses one provisioning/signin surface; then one `/10x-e2e`-driven phase per journey ordered by dependency (onboarding proves the entry, gameplay+restore builds on a seeded profile, parent surfaces ends with the destructive spec); CI + docs last, once the suite is stable enough to gate merges.

## Critical Implementation Details

- **Env propagation**: `playwright.config.ts` must load `.env.test` via dotenv (same pattern as `vitest.config.ts:2,8`) — worker processes inherit the runner's env. The **webServer child** needs the app-side names: map `SUPABASE_KEY: process.env.SUPABASE_ANON_KEY` explicitly in `webServer.env` (the app reads `SUPABASE_KEY`; `.env.test` carries `SUPABASE_ANON_KEY`), plus `SUPABASE_URL`, `PARENT_SESSION_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (without the last one, the deletion spec's endpoint 503s).
- **Wait discipline**: the 1.4 s task beat and the in-island results swap mean the gameplay loop waits on *state text* ("Zadanie N z M" progress changing, or the results h1 "Koniec zmiany!") — Playwright's auto-waiting `expect(...).toBeVisible()` handles the beat; `page.waitForTimeout` is banned repo-wide in e2e.
- **Locator strings**: import `t` from `src/i18n/pl.ts` in specs (the `@/*` alias needs a matching `paths` entry or relative import from `e2e/`) — interpolated keys (e.g. `results.progress` "Zadanie {current} z {total}") become regexes. Never hardcode Polish beyond what a helper interpolates from `t`.
- **UI-signup budget**: only the onboarding spec signs up through the UI; all other specs provision via `admin.createUser` and sign in via UI only when the journey itself needs a real browser session (which is: always for fresh-context tests, once per test otherwise).

---

## Phase 1: Playwright bootstrap + harness smoke

### Overview

Install Playwright, wire config (webServer, env, two Chromium projects, parallelism), build the `e2e/` helper surface on top of `tests/helpers/supabase.ts`, wire the Playwright MCP for `/10x-e2e`, and prove the harness with a smoke spec. Resolves both research Open Questions as recorded facts.

### Changes Required:

#### 1. Dependencies + scripts

**File**: `package.json`

**Intent**: Add `@playwright/test` (devDependency) and scripts `test:e2e` (`playwright test`) and `test:e2e:ui` (`playwright test --ui`). Keep `npm test` = vitest untouched.

**Contract**: `npx playwright install chromium` documented as a one-time setup step (README or script), not auto-run on install.

#### 2. Playwright config

**File**: `playwright.config.ts` (new)

**Intent**: Single config: `testDir: "./e2e"`, dotenv-load `.env.test`, `webServer` starting `npm run dev` at `http://localhost:4321` (`reuseExistingServer: !process.env.CI`), `fullyParallel: true` with workers capped at 4, retries 2 on CI / 0 locally, `trace: "on-first-retry"`, `locale: "pl-PL"`, `baseURL`.

**Contract**: Two projects, both Chromium-engine: `desktop` (default viewport) and `touch` (tablet-class viewport with `hasTouch: true`, Chromium device preset or custom — NOT an iPad preset, those pin WebKit). The `touch` project runs only the gameplay spec (`testMatch` scoped) per the 2×-runtime decision. `webServer.env` carries the explicit `SUPABASE_KEY` ← `SUPABASE_ANON_KEY` mapping plus `SUPABASE_URL`, `PARENT_SESSION_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (see Critical Implementation Details).

#### 3. E2E helper surface

**File**: `e2e/helpers/accounts.ts` (new)

**Intent**: Thin layer over `tests/helpers/supabase.ts` re-exporting provisioning (`admin`, `PASSWORD`, `deleteUser`, `findUserIdByEmail`) and adding e2e-specific helpers: `provisionAccount(prefix)` (admin-created confirmed user, no UI), `seedChildProfile(accountId, {name, startingLevel: 1, walletBalance?, shopState?})` (admin insert — level 1 keeps two-stage tasks out of gameplay loops), and `signInViaUI(page, email)` (fills the signin form with `t` strings, waits for `/app*`).

**Contract**: Each spec provisions its own account in the test (unique prefix + UUID emails, as the vitest helpers already do) and cleans up in a `finally`/`afterEach` via `deleteUser` — test independence + parallel safety. Never import `tests/helpers/stubs/*` or `tests/helpers/astro.ts`.

#### 4. i18n locator access

**File**: `e2e/helpers/i18n.ts` (new)

**Intent**: Re-export `t` from `src/i18n/pl.ts` and provide tiny interpolation/regex utilities for templated strings (e.g. `progressRegex()` from `t.results.progress`, `tileLabel(name)` from `t.picker.tileLabel`). All spec locators resolve through this module (L-003 extended to tests).

**Contract**: Import path must work from `e2e/` under Playwright's transpiler (relative `../../src/i18n/pl` or a tsconfig path — implementer picks what `npx playwright test` resolves without extra build steps).

#### 5. Playwright MCP wiring

**File**: `.mcp.json` (new, project root)

**Intent**: Register the official Playwright MCP server (`npx @playwright/mcp@latest`) so `/10x-e2e`'s snapshot-driven generate→review→verify workflow has browser tools in future sessions.

**Contract**: Project-scoped `.mcp.json` `mcpServers` entry; no secrets in it.

#### 6. Artifacts hygiene

**File**: `.gitignore`

**Intent**: Ignore `playwright-report/`, `test-results/`, `blob-report/`.

**Contract**: Appended entries; nothing else touched.

#### 7. Harness smoke spec

**File**: `e2e/smoke.spec.ts` (new)

**Intent**: Prove the whole harness before any journey exists. Behavior asserted: (a) home page renders with the MatmaVerse brand; (b) anonymous `/app` redirects to `/auth/signin` through a real browser (middleware + no-store); (c) a provisioned account signs in via UI and reaches `/app` (helpers + webServer + Supabase all wired). Regression caught: broken bootstrap (env mapping, webServer, helper imports). Research source: research.md §Bootstrap. Edge: missing-env failure mode is a *setup* assertion — fail fast with a clear message if `.env.test` vars are absent, so harness misconfig never reads as a product bug. Anti-pattern avoided: no product logic asserted here — this spec is allowed to be shallow.

#### 8. Resolve research Open Questions (verify-first, record results)

**File**: `context/changes/testing-e2e-playwright/plan.md` (this file — annotate) + `research.md` follow-up note

**Intent**: (a) Run `npm run build && npm run preview` once; record whether the Vercel adapter breaks preview (expected) — the config's `npm run dev` choice stands either way, this just pins the fact. (b) During smoke development, observe whether the local signup POST establishes session cookies (auto-confirm side effect) and record it — Phase 2's spec must work regardless, but the fact determines whether the interstitial step asserts an authenticated or anonymous state.

**Contract**: Two one-line findings appended to research.md under "Follow-up"; no assumptions left in specs.

### Success Criteria:

#### Automated Verification:

- `npx playwright test e2e/smoke.spec.ts` passes locally (both projects where applicable)
- `npm run test` (vitest) still passes and does not pick up `e2e/**` (`*.spec.ts` invisible to `tests/**/*.test.*` include)
- `npm run lint` and `npx astro check` pass with the new TS files

#### Manual Verification:

- `npx playwright test --ui` opens and runs the smoke spec (developer ergonomics sanity)
- Playwright MCP server starts from `.mcp.json` in a fresh Claude Code session
- Open-question findings (preview viability, signup auto-confirm) recorded in research.md

**Implementation Note**: After this phase passes, pause for manual confirmation before Phase 2.

---

## Phase 2: Onboarding journey spec (Risk #4)

> Drive with `/10x-e2e`. Read research.md §Risk #4 and the locator inventory first.

### Overview

One spec file proving the universal entry: the full multi-page 302 chain in one real cookie jar, with hydrated forms and the wizard state machine.

### Changes Required:

#### 1. Onboarding journey

**File**: `e2e/onboarding.spec.ts` (new)

**Intent**: Main journey test — `/auth/signup` → fill email/password/confirm (`getByLabel` from `t.auth.fields.*`) → submit (`t.auth.signup.submit`) → land on `/auth/confirm-email?email=…` interstitial → obtain `hashed_token` via `admin.generateLink({type:"signup"})` → `page.goto("/api/auth/confirm?token_hash=…&type=signup")` → land `/app` → auto-route to `/app/new-profile` (0 profiles) → complete the 3-step wizard (name via `getByLabel`, age/avatar/world tiles via `getByRole('button', {pressed})`, `Dalej`/`Utwórz profil`) → land `/app/start` with h1 `Cześć, {name}!`.

**Contract**: Behavior asserted: redirect glue + hydration + wizard machine as ONE chain. Regression caught: any broken hop (signup redirect, confirm route session, `/app` router, wizard POST, active-profile cookie). Research source: research.md §Risk #4 happy-path chain. Anti-patterns avoided: no direct POST-contract assertions (that's `tests/auth-routes.test.ts`); oracle = i18n dictionary + PRD flow, never the implementation.

#### 2. Edge branches (same file)

**Intent**: Two focused tests. (a) *Client validation*: hydrated signup form with empty/short/mismatched inputs blocks submit and shows the Polish inline errors (`t.auth.validation.*`) while staying on `/auth/signup` — the hydration seam nothing else covers. (b) *Authed bounce*: a signed-in user navigating to `/auth/signup` is bounced to `/app` (exact-match middleware nuance through real navigation).

**Contract**: Edge/error/boundary duty of this phase. Do NOT add server-error branch tests (duplicate email etc.) — those redirect contracts are route-covered; only the in-browser validation UX is new signal.

### Success Criteria:

#### Automated Verification:

- `npx playwright test e2e/onboarding.spec.ts` green, parallel-safe (unique emails), zero `waitForTimeout`
- Full suite still green: `npx playwright test`
- Grep guard: no hardcoded Polish string literals in the spec beyond `t`-interpolations

#### Manual Verification:

- Watch the trace/UI run once: wizard steps visibly advance; the confirm-link hop lands authenticated
- Confirm the spec fails meaningfully when a hop is broken (e.g. temporarily point the confirm URL at a bad token — expect the Polish error redirect assertion to fire)

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Gameplay loop + fresh-context restore spec (Risks #6, #2)

> Drive with `/10x-e2e`. Runs in BOTH projects (desktop + touch). Read research.md §Risk #6/§Risk #2 first.

### Overview

One spec file with a shared solve-shift helper: prove the tap-through gameplay journey and the exact cross-context restore of earned state.

### Changes Required:

#### 1. Solve-shift helper

**File**: `e2e/helpers/solve-shift.ts` (new)

**Intent**: The DOM-derivation loop: while progress text (regex from `t.results.progress`) is visible — identify task type by question text (`t.task` scenario strings), derive the answer (counting: tap every `Moneta *` coin; change-making: parse the two integers from the story text, tap `paid − price` coins), press `Sprawdź`, wait for the next progress state or the results h1. Returns `{taskCount, misses}` so callers can compute the exact expected earnings (`5*n + 3*clean`).

**Contract**: No sleeps — the 1.4 s beat is absorbed by waiting on the next state text. Must tolerate 5–12 tasks and both task types; seeded profiles are `startingLevel: 1` so two-stage tasks never appear (research: `change-making-tasks.ts:64`).

#### 2. Gameplay loop test

**File**: `e2e/gameplay-restore.spec.ts` (new)

**Intent**: Provision account + seed level-1 profile (wallet 0) → UI signin → `/app/start` → tap `Czas otworzyć sklep!` → solve the full shift → results screen asserts h1 `Koniec zmiany!`, exact earnings text (`Do portfela: +{8n}` when all first-try), stars `3 z 3` → `Wróć do sklepu` → `/app/start`. Then enter `Rozbuduj sklep`, buy the cheapest affordable upgrade (scope the ambiguous `Kup` by card text), assert the `Odblokowane!` celebration and the `Masz to` owned tag without reload.

**Contract**: Behavior asserted: island hydration + real taps/beats + in-island phase swap + real `fetch` on real cookies + upgrade purchase state. Regression caught: non-mounting islands, broken shift-save wiring, dead upgrade flow. Research source: research.md §Risk #6. Edge: one deliberate wrong answer mid-shift — assert the journey *continues* (retry status appears, then correct answer advances) and the final earnings reflect the lost clean bonus — journey-level only; the guardrail invariants stay in `tests/task-guardrail.test.tsx` (anti-pattern avoided: no feedback-styling re-assertions).

#### 3. Fresh-context restore test (same file)

**Intent**: Provision account + seed profile → context A: UI signin, solve one shift (record expected wallet), close context → context B (brand-new, no storageState): UI re-signin → `/app/start` SSR renders the earned wallet/level state; then seed a second profile via admin and open context C: re-signin lands on the picker (`Kto dziś prowadzi sklep?` — session-lifetime `active_profile` boundary), tile `Graj jako {name}` → `/app/start`.

**Contract**: Behavior asserted: durable state is user-visible after a true context restart; picker-on-launch semantics. Regression caught: UI restore path divergence from the API layer (`cross-device-restore.test.ts` covers only the server half). Research source: research.md §Risk #2. Anti-patterns avoided: no storageState reuse (falsely persists `active_profile`); assert re-read SSR UI, never network responses. Wallet display is the known locator soft spot — assert via the visible amount text near the sr-only `Portfel` label; if too brittle in practice, assert level + owned-upgrade + picker instead and surface the wallet-pill a11y gap as a product finding.

### Success Criteria:

#### Automated Verification:

- `npx playwright test e2e/gameplay-restore.spec.ts` green in BOTH projects (`--project=desktop --project=touch`)
- Zero `waitForTimeout`; suite runtime for this file < ~4 min locally (beats included)
- Full suite green in parallel (`npx playwright test`)

#### Manual Verification:

- Watch one touch-project trace: coin taps register as touch, beats feel absorbed by state waits (no flaky advance)
- Deliberately corrupt the expected-earnings formula once — the exact-delta assertion must go red (oracle sanity)

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Parent surfaces spec (PIN gate + danger zone)

> Drive with `/10x-e2e`. Destructive: each test provisions and destroys its own throwaway account. Read research.md §Parent surfaces first.

### Changes Required:

#### 1. PIN gate journey

**File**: `e2e/parent-surfaces.spec.ts` (new)

**Intent**: Provision account (no PIN) → UI signin → `goto /app/report` → redirected to `/app/parent-pin` in SET mode (h1 `Ustaw PIN rodzica`) → set PIN (`getByLabel` — password inputs have no textbox role) → auto-land on `/app/report` (`Raport tygodniowy`) → navigate to `/app/start` and back → still admitted (15-min marker persists across navigation) → clear the `parent_verified` cookie → `/app/report` re-gates in ENTER mode (`Podaj PIN rodzica`) → wrong PIN → `role="alert"` `Nieprawidłowy PIN.` → correct PIN → report.

**Contract**: Behavior asserted: per-page gate + marker cookie lifecycle through real navigations. Regression caught: gate failing open, marker not persisting, mode branch (set/enter) breaking. Research source: research.md §Parent surfaces. Edge: the wrong-PIN alert. Anti-pattern avoided: no lockout test (60 s cooldown = forced sleep; route-covered); no marker-crypto re-assertions (`tests/parent-pin.test.ts`).

#### 2. Account-deletion journey (full delete)

**Intent** (same file): Provision throwaway account → signin → set PIN → report → danger zone (h2 `Usunięcie konta`) → `Usuń konto` opens the `alertdialog` `Usunąć całe konto?` → boundary: confirm button (`Usuń konto na zawsze`) stays disabled with wrong typed text; arms only when typed email matches + PIN filled → confirm → land `/?deleted=1` with `role="status"` farewell → `goto /app` → redirected to `/auth/signin` (session durably gone).

**Contract**: Behavior asserted: the destructive chain's browser-only glue (dialog arming physics, hard navigation, cookie clearing, re-gate). Regression caught: a disabled-state or arming regression letting deletion fire un-armed, or the post-delete session lingering. Research source: research.md §Parent surfaces (cascade isolation proven; safe per decision). Edge: wrong-typed-text stays disabled. Anti-patterns avoided: assert the durable outcome (re-gate to signin), not the success copy alone; cleanup handles the already-deleted account gracefully (deleteUser on a gone id must not fail the test).

### Success Criteria:

#### Automated Verification:

- `npx playwright test e2e/parent-surfaces.spec.ts` green, parallel-safe, zero `waitForTimeout`
- Full suite green: `npx playwright test`
- Post-run DB check (helper assertion in-spec): the deleted account's rows are gone (`findUserIdByEmail` → null)

#### Manual Verification:

- Watch the trace once: dialog focus lands correctly, disabled button is visually and functionally inert, Escape closes when not busy
- Confirm no non-throwaway account can be touched: specs never read credentials from `.env` beyond the local stack

**Implementation Note**: Pause for manual confirmation before Phase 5.

---

## Phase 5: CI job + test-plan docs

### Changes Required:

#### 1. CI workflow

**File**: `.github/workflows/ci.yml`

**Intent**: New `e2e` job (blocking, per decision): checkout → Node 22.14 → `npm ci` → cache + `npx playwright install --with-deps chromium` → `supabase start` (copy the existing job's steps; keep the same service exclusions — Mailpit stays excluded since no email spec exists) → `supabase db reset` → export status env to the test names + app names → `npx playwright test` (webServer starts `npm run dev` inside the job) → upload `playwright-report/` artifact on failure.

**Contract**: Runs alongside the existing job (not `needs`-chained) so wall-clock stays bounded; retries=2 + trace-on-first-retry already in config mitigate flake.

#### 2. Test-plan documentation

**File**: `context/foundation/test-plan.md`

**Intent**: Update §4 e2e row (Playwright version, `e2e/` dir, two Chromium projects, webServer dev :4321, "not planned for v1" removed); add §5 gate row (e2e journeys, CI on PR, required after §3 Phase 5); add §6.7 cookbook "Adding an e2e journey spec" (provision-per-test, i18n locators via `e2e/helpers/i18n.ts`, solve-shift reuse, wait-on-state rule, destructive = throwaway only); append the §6.6 phase note. Also backport the stale §6.6 Phase-1 known-issues list (English error leak and signout no-op are FIXED — research finding; `startsWith` over-match still open).

**Contract**: §3 Phase 5 row status flips to `complete` only when Progress below is fully checked (orchestrator convention).

### Success Criteria:

#### Automated Verification:

- CI green on a PR containing the full suite (both jobs)
- `npm run lint` passes on the workflow-adjacent TS changes

#### Manual Verification:

- CI runtime for the e2e job acceptable (< ~8 min); flake rate observed over the first PRs is near-zero
- test-plan.md §4/§5/§6 read coherently for a newcomer (smoke test: "how do I add an e2e test?" answerable from §6.7 alone)

---

## Testing Strategy

- **Unit/integration**: unchanged (vitest). The e2e layer adds journeys only; any logic gap found while writing specs routes to `/10x-tdd`, not into e2e.
- **E2E structure**: 4 spec files + 3 helpers; every test provisions its own account (UUID emails) and cleans up; parallel-safe by construction.
- **Manual steps**: one trace-watch per journey phase (listed per phase above); MCP session check in Phase 1.

## Performance Considerations

Gameplay beats put a floor on runtime (~7–17 s of beats per shift × 3 solves × 2 projects) — the worker cap (4) and scoping the touch project to the gameplay spec keep the suite in the minutes range. If CI runtime grows past ~8 min, first lever: run the touch project on a schedule instead of per-PR (conscious change, not silent).

## Migration Notes

None — additive layer. Rollback = delete `e2e/`, `playwright.config.ts`, the CI job, and the devDependency.

## References

- Research (read first, always): `context/changes/testing-e2e-playwright/research.md`
- Provisioning pattern: `tests/helpers/supabase.ts:44-65`
- Confirm-link pattern: `tests/auth-confirm.test.ts:13-41`
- Rollout row: `context/foundation/test-plan.md` §3 Phase 5

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Playwright bootstrap + harness smoke

#### Automated

- [x] 1.1 `npx playwright test e2e/smoke.spec.ts` passes locally — 1190b10
- [x] 1.2 `npm run test` (vitest) still passes and ignores `e2e/**` — 1190b10
- [x] 1.3 `npm run lint` + `npx astro check` pass with new TS files — 1190b10

#### Manual

- [x] 1.4 `npx playwright test --ui` runs the smoke spec — 1190b10
- [x] 1.5 Playwright MCP starts from `.mcp.json` in a fresh session — 1190b10
- [x] 1.6 Open-question findings (preview viability, signup auto-confirm) recorded in research.md — 1190b10

### Phase 2: Onboarding journey spec (Risk #4)

#### Automated

- [x] 2.1 `e2e/onboarding.spec.ts` green, parallel-safe, zero waitForTimeout
- [x] 2.2 Full suite green
- [x] 2.3 No hardcoded Polish beyond `t`-interpolations (grep guard)

#### Manual

- [x] 2.4 Trace-watch: wizard advances; confirm-link hop lands authenticated
- [x] 2.5 Broken-hop red-test sanity (bad token → Polish error assertion fires)

### Phase 3: Gameplay loop + fresh-context restore spec (Risks #6, #2)

#### Automated

- [ ] 3.1 `e2e/gameplay-restore.spec.ts` green in desktop AND touch projects
- [ ] 3.2 Zero waitForTimeout; file runtime < ~4 min locally
- [ ] 3.3 Full suite green in parallel

#### Manual

- [ ] 3.4 Touch-project trace-watch: taps register, no flaky advance
- [ ] 3.5 Earnings-oracle red-test (corrupted formula → exact-delta assertion fails)

### Phase 4: Parent surfaces spec (PIN gate + danger zone)

#### Automated

- [ ] 4.1 `e2e/parent-surfaces.spec.ts` green, parallel-safe, zero waitForTimeout
- [ ] 4.2 Full suite green
- [ ] 4.3 In-spec durable check: deleted account gone (`findUserIdByEmail` → null)

#### Manual

- [ ] 4.4 Trace-watch: dialog focus/disabled/Escape behavior correct
- [ ] 4.5 Throwaway-only confirmed (no external credentials reachable from specs)

### Phase 5: CI job + test-plan docs

#### Automated

- [ ] 5.1 CI green on a PR with both jobs (existing + e2e)
- [ ] 5.2 `npm run lint` passes

#### Manual

- [ ] 5.3 e2e CI job runtime < ~8 min, flake near-zero over first PRs
- [ ] 5.4 test-plan.md §4/§5/§6 updated + §6.6 stale known-issues backport; newcomer smoke test passes
