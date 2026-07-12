---
date: 2026-07-12T10:54:53+02:00
researcher: Claude (Fable 5)
git_commit: 9365f93fb200adb659e848602a617ae18af241c0
branch: main
repository: 10xDevs (MathShop / MatmaVerse)
topic: "Ground rollout Phase 5 of test-plan.md: E2E browser layer (Playwright) — risks #2, #4, #6 + parent surfaces + bootstrap"
tags: [research, codebase, e2e, playwright, onboarding, gameplay, parent-pin, account-deletion, supabase]
status: complete
last_updated: 2026-07-12
last_updated_by: Claude (Fable 5)
---

# Research: E2E browser layer (Playwright) — grounding for test-plan Phase 5

**Date**: 2026-07-12T10:54:53+02:00
**Git Commit**: `9365f93` **Branch**: main

## Research Question

Ground rollout Phase 5 of `context/foundation/test-plan.md` (change `testing-e2e-playwright`): verify risks #2, #4, #6 plus the parent PIN-gate / account-deletion danger-zone surface in browser terms; ground the real user journeys in code (pages, islands, accessibility locator surface), locate existing coverage to avoid duplication, identify what only the e2e layer can prove, and ground the Playwright bootstrap surface (dev server, env, local Supabase, helper reuse, runner separation).

## Summary

All four target journeys are grounded and e2e-viable with role/label-first locators — **no `data-testid` exists anywhere in `src/` and none is hard-required**, though a few soft spots exist (wallet pill, per-card "Kup" buttons). Verdicts on the risk response guidance:

1. **#4 onboarding — guidance verified, with one local-Supabase correction.** Local `enable_confirmations = false` (`supabase/config.toml:217`) means UI signup auto-confirms; the true email-verification leg needs either admin `generateLink` → `/api/auth/confirm?token_hash=…` (pattern already proven in `tests/auth-confirm.test.ts:36-41`) or a config flip + Inbucket at `:54324`. The confirm route is `token_hash`+`verifyOtp`, **not** PKCE `?code=`.
2. **#2 restore — guidance verified, with a Playwright-semantics trap.** Durable state is SSR-rendered on `/app/start` from `child_profiles` only; `active_profile` is a **session-lifetime cookie** (picker-on-launch by design). Playwright `storageState` persists session cookies too, so "fresh context + storageState" would falsely retain the selection — the fresh-context test must re-sign-in through the UI (or strip `active_profile`).
3. **#6 gameplay — guidance verified, two load-bearing facts.** (a) The shift generator is **unseeded `Math.random()`** with no injection point reachable from e2e — tests must derive answers from the DOM (counting: tap every coin; change-making: parse `paid − price` from the story text). (b) Every task completion rides a hard **1400 ms beat** (`useCoinTask.ts:55-63`) and shifts are 5–12 tasks — the loop must wait on "Zadanie N z M" progress text, never sleeps.
4. **Parent surfaces — guidance verified.** PIN gate is per-page/per-route (middleware does NOT check it); the marker is a signed 15-min cookie; account deletion stacks typed-email + fresh-PIN on top and is fully cascade-isolated to the throwaway account (safe for destructive e2e).
5. **Bootstrap** — `npm run dev` on `:4321` is the runnable shape (the Vercel adapter likely breaks `astro preview` — verify once); `.env.test` + dotenv wiring exists; `tests/helpers/supabase.ts` is importable from Playwright as-is; put specs in top-level `e2e/*.spec.ts` to stay invisible to vitest.

**Stale test-plan note (backport candidate):** §6.6 "known issues pinned by tests" is partially outdated — the English `?error=` leak and the signout no-op are **FIXED** (Polish `mapAuthError` layer in `src/lib/auth-errors.ts`; `signout.ts` clears cookies even unconfigured). The middleware `startsWith` over-match is still open and deliberately pinned.

## Detailed Findings

### Risk #4 — Onboarding journey (signup → verification → first profile → start)

**The full happy-path chain (production semantics):**
`GET /auth/signup` → POST `/api/auth/signup` → 302 `/auth/confirm-email?email=…` → (email link) `GET /api/auth/confirm?token_hash=…&type=signup&next=/app` → 302 `/app` → 302 `/app/new-profile` (0 profiles) → 3-step wizard → POST `/api/profiles/create` → 302 `/app` → 302 `/app/start`.

- Middleware: `PROTECTED_ROUTES = ["/app"]` matched by `startsWith` (`src/middleware.ts:5,42`); authed users are bounced off `/auth/signin|signup` (exact match, `middleware.ts:10,38-39`); every `/auth*`, `/api/auth*`, `/app*` response carries `Cache-Control: no-store` (`middleware.ts:18-24,49`).
- Signup route: `supabase.auth.signUp({ …, emailRedirectTo: ${origin}/app })` (`src/pages/api/auth/signup.ts:23-27`); success **always** 302s to `/auth/confirm-email?email=…` (`signup.ts:34`); errors → `?error=<Polish via mapAuthError>`. **No server-side zod on auth routes** (pinned: empty fields → Supabase-mapped error redirect, not 400 — `tests/auth-routes.test.ts:111`).
- Confirm route: `token_hash` + `type` → `verifyOtp` (`src/pages/api/auth/confirm.ts:62`), open-redirect-hardened `next` (`confirm.ts:31-36`), success writes session cookies and 302s `/app`. Link shape pinned in `supabase/templates/confirmation.html:15`. **Do not write e2e expecting PKCE `?code=`.**
- `/app` router: `resolveLandingPath` — 0 profiles → `/app/new-profile`, 2+ without valid selection → `/app/pick-profile`, else `/app/start` (`src/pages/app.astro:17-18`, `src/lib/services/child-profiles.ts:87-91`).
- Wizard: `CreateProfileWizard client:load` POSTs natively to `/api/profiles/create`, which zod-validates, enforces the 6-profile cap, inserts, sets `active_profile` and 302s `/app` (`src/pages/api/profiles/create.ts:25-79`).
- **Local wrinkle (verify live before pinning):** with confirmations off, the signup POST itself likely establishes a session (auto-confirm), so after landing on the interstitial the browser can already reach `/app`; the interstitial still shows "check your email" because `?email=` is present (`confirm-email.astro:14`).

**Email-verification options for e2e** (in preference order):
1. `admin.auth.admin.generateLink({ type: "signup", email, password })` → navigate to `/api/auth/confirm?token_hash=<hashed_token>&type=signup` — works even with confirmations off; proven in `tests/auth-confirm.test.ts:13-14,36-41`.
2. `admin.createUser({ email_confirm: true })` (`tests/helpers/supabase.ts:44-60`) — skips verification, then sign in via UI.
3. Flip `enable_confirmations = true` locally + scrape Inbucket web/API at `:54324` — the archive's manual path (`context/archive/2026-07-10-production-email-delivery/research.md:96`); Inbucket REST API shape unverified.

**What only browser e2e proves here:** island hydration of the `noValidate` forms (client validation, pending states, password toggle — zero component tests exist for these forms); the full 302 chain in one real cookie jar; real httpOnly cookie semantics; the wizard's multi-step DOM state machine (hidden inputs, Back/Next state, bounce-to-failing-step); the middleware bounce for an authed user hitting `/auth/signup`.

### Risk #2 — Cross-context restore (user-visible half)

- Durable state lives **only** in the `child_profiles` row: `wallet_balance`, `completed_shift_count`, `business_level`, `shop_state`, `skill_state` (`src/lib/services/child-profiles.ts:34-39`). Mid-shift state is never persisted (FR-016; `task.astro:14-15`).
- Every child page re-derives state SSR-side via `resolvePageProfile` (`src/lib/services/active-profile.ts:56-65`); `/app*` responses are `no-store`, so restored state is never a cache artifact.
- `active_profile` cookie: httpOnly, sameSite=lax, **session-lifetime (no maxAge)** — deliberate "picker on launch" for 2+-profile accounts (`active-profile.ts:13,33-41`). Set only by `POST /api/profiles/select` after RLS ownership proof.
- **Playwright trap:** `storageState` persists session cookies, so reusing it fakes a *continuing* session, not a browser restart. True fresh-context semantics = new context + UI re-signin (then: 1 profile → straight to `/app/start`; 2+ → picker).
- Durable-state display surface (all SSR, no hydration wait): wallet pill (sr-only "Portfel" + bare amount span — **no role**, `HudChip.tsx:10-18`); level text "Poziom sklepu {n}" (`pl.ts:173`); owned upgrades under "Twój sklep już ma" with "Masz to" tags (`UpgradeShop.tsx:221-239`); picker tiles `aria-label="Graj jako {name}"` (`pick-profile.astro:42`).
- Earnings are exactly computable: `5*taskCount + 3*cleanCount` (`src/data/shift.ts:33-35`), level = `1 + floor(completedShifts/3)` (`shift.ts:99-101`) — an e2e that tracks its own misses can assert the exact wallet delta after restore.

### Risk #6 — Gameplay loop (mission → tasks → shift end → results)

Route chain: `/app/start` (SSR + single `StartShiftButton client:load` island doing `window.location.href = "/app/task"`) → `/app/task` (entire shift is one `ShiftScreen client:load` island, `task.astro:31-38`) → in-island results (no navigation) → button/link back to `/app/start` / `/app/upgrades`. There is **no mission-select screen** — one themed business per profile; "mission" = start shift.

- `ShiftScreen` generates tasks once client-side (`useMemo` → `generateShift`, `ShiftScreen.tsx:52-55`); phases `playing → saving → results | error`. Shift end fires exactly once (savedRef guard) → `fetch POST /api/shifts/complete` with `AbortSignal.timeout(10_000)`; server recomputes earnings (`src/pages/api/shifts/complete.ts:66-97`); network-shaped failure → `OfflineOverlay`.
- **Timing:** 1400 ms hard `setTimeout` per correct answer (`useCoinTask.ts:55-63`; two-stage tasks = two beats); 10 s save timeout; 5 s offline probe. No audio anywhere; animations are non-blocking Tailwind CSS. Coins + "Sprawdź" are disabled during the `correct` beat.
- **Nondeterminism:** shift length 5–12 (+bonus from purchased upgrades); task types mixed; **no seed** — `Math.random()` throughout (`src/data/tasks.ts:16`, `counting-tasks.ts:34`, `change-making-tasks.ts:36,41`, `shift.ts:41,69`), pickers injectable only as function params (unit-test surface, unreachable from e2e). The e2e loop must be: *while progress text "Zadanie N z M" visible → identify task type by question text → derive answer from DOM → solve*.
- **DOM answer derivation (fully possible):** counting ("Ile monet jest w kasie?"): tap **every** coin (`coinCount === target`, `CountingTask.tsx:23-26`). Change-making ("Ile reszty mu wydasz?"): parse the two integers from "Klient zapłacił {paid} zł za zakup za {price} zł." → tap `paid − price` coins (tray has 1–3 extra coins, so tap-all correctly fails). Two-stage tier-3 ("Krok {n} z 2"): stage 1 = price, stage 2 = paid − price. **Tier note:** `starting_level` 1 profiles never see two-stage tasks (`change-making-tasks.ts:64`) — seed level-1 profiles to keep the loop simple where the two-stage path isn't the target.
- Upgrades: `UpgradeShop` island buys via `fetch POST /api/upgrades/buy`, applies returned state locally (no reload), shows dismissible "Odblokowane!" celebration (`UpgradeShop.tsx:64-145`).

### Parent surfaces — PIN gate + account-deletion danger zone

- **Gate mechanism:** middleware only auth-gates `/app*` — **PIN gating is per-surface**: `report.astro:26-27` redirects to `/app/parent-pin` when the `parent_verified` marker is absent/expired/tampered; destructive API routes re-check server-side (`api/profiles/delete.ts:38-39`, `api/account/delete.ts:51-52`, `api/parent/pin/set.ts:31-34`). Marker = HMAC-signed cookie, **TTL 15 min** (`src/lib/services/parent-pin.ts:17,148-174`); fails closed without `PARENT_SESSION_SECRET`.
- **PIN flows:** `/app/parent-pin` SSR-branches set-vs-enter via `hasPin()` (`parent-pin.astro:11-13`); `ParentPinGate.tsx` POSTs to `/api/parent/pin/{set,verify}`; success → `window.location.href = "/app/report"`. First-time set mints the marker immediately. Lockout: 5 wrong attempts → 60 s lock (429), during which even the correct PIN is rejected (`parent-pin.ts:20-22,96-98`); counter is per-account (dies with a throwaway account), no IP throttle. Wrong-PIN error renders as `role="alert"`.
- **Danger zone:** `/app/report` bottom section (`DeleteAccountSection.tsx:54-97`) → radix `AlertDialog` (`role="alertdialog"`, named by title "Usunąć całe konto?") → arming = typed account **email** must match (case-insensitive, trimmed) AND fresh **PIN** (shares the lockout counter); confirm button `disabled` until armed (`ConfirmDeleteDialog.tsx:54,125`). 200 → `window.location.href = "/?deleted=1"` farewell banner (`index.astro:13-20`, `role="status"`). Dialog errors are `role="status"` (not alert). Escape closes unless busy.
- **Blast radius (destructive e2e is safe):** `admin.auth.admin.deleteUser(session-derived id)` + `ON DELETE CASCADE` erases `child_profiles → shift_log`, `account_settings`, `auth.sessions` — nothing shared survives, neighbor accounts proven untouched (`tests/account-deletion.test.ts:84,152`; `context/archive/2026-07-11-account-deletion/research.md:28-50`). Per-child profile delete also lives on the report page (per-card "Usuń profil" → same dialog armed with the child's name).
- **Env prerequisites:** `PARENT_SESSION_SECRET` unset → whole parent zone fails closed; `SUPABASE_SERVICE_ROLE_KEY` unset → account delete 503.
- Known unbuilt edges (by design, don't test as bugs): no forgot-PIN recovery; PIN is a soft gate (no parent-vs-child identity).

### Playwright bootstrap surface

- **Web server:** `npm run dev` → `http://localhost:4321` (no port override in `astro.config.mjs`; corroborated by `site_url` in `supabase/config.toml:156`). `astro preview` is expected to fail under `@astrojs/vercel` v10 (unverified — check once); do not plan around it. Node 22.14.0 (`.nvmrc`).
- **Env:** app reads `SUPABASE_URL`/`SUPABASE_KEY`(+`PARENT_SESSION_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`) via `astro:env/server` schema (`astro.config.mjs:21-36`, all optional → boots without them but fails at runtime). `.env.test` exists (template `.env.test.example`: `SUPABASE_URL=http://127.0.0.1:54321`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PARENT_SESSION_SECRET`); vitest loads it via `dotenv` at config time (`vitest.config.ts:2,8`). **Naming mismatch:** app wants `SUPABASE_KEY`, `.env.test` has `SUPABASE_ANON_KEY` (bridged for vitest by `tests/helpers/stubs/astro-env-server.ts`) — Playwright's `webServer.env` must map `SUPABASE_KEY` explicitly (or rely on `.env`).
- **Local Supabase:** API `:54321`, DB `:54322`, Studio `:54323`, email capture (`[inbucket]`, Mailpit-backed in this CLI version) `:54324`. `site_url` already points at `:4321`; `additional_redirect_urls` already whitelists `/app` and `/api/auth/confirm`. Rate limits: `sign_in_sign_ups = 30`/5 min/IP (heavy parallel UI signups could trip it — admin provisioning bypasses), `email_sent = 2`/hr locally.
- **Helper reuse:** `tests/helpers/supabase.ts` is plain `@supabase/supabase-js` + `node:crypto` — **importable from Playwright** (needs `process.env` populated; throws at import if missing). Exports: `createSignedInUser(prefix)` (admin-creates confirmed user + signed-in client), `deleteUser(id)`, `findUserIdByEmail`, `admin`, `PASSWORD`. No profile/shift seeding helpers exist — suites seed inline via each account's client; e2e seeds via `admin`/client or through the UI. Do **not** import `tests/helpers/stubs/*` or the astro request harness.
- **Runner separation:** vitest includes `tests/**/*.test.{ts,tsx}` only → top-level `e2e/` with `*.spec.ts` + Playwright `testDir: "./e2e"` gives zero overlap in both directions. Vitest runs serially against the shared local DB (`fileParallelism: false`) — the same shared-DB caution applies to Playwright worker count.
- **CI (`.github/workflows/ci.yml`):** single job — npm ci → astro sync/check → lint → build → `supabase start` (excluding realtime, storage, **mailpit**, studio, …) → `db reset` → export status env → vitest. A Playwright job adds: `npx playwright install --with-deps chromium`, the same supabase steps (without excluding mailpit if email specs exist), app env for the webServer, browser caching.
- **Playwright presence: none.** No deps, no config, no `e2e/` dir, no `.mcp.json` — the `10x-e2e` skill references `mcp__playwright__*` tools; a Playwright MCP is **not currently wired** and would need to be added for that skill's browser-driving steps.

## Locator inventory (role/label-first; no data-testid exists in src/)

All accessible names come from `src/i18n/pl.ts` (`t.*`) — locators must resolve strings from the dictionary, never hardcode Polish (L-003 applies to tests too). Brand is **"MatmaVerse"** (`pl.ts:11`), not "MathShop".

| Surface | Interaction | Locator | i18n key → Polish |
|---|---|---|---|
| Signup/signin | email / password / confirm | `getByLabel` | `auth.fields.emailLabel` "Adres e-mail" / `passwordLabel` "Hasło" / `confirmLabel` "Powtórz hasło" |
| Signup/signin | submit | `getByRole('button')` | `auth.signup.submit` "Utwórz konto" / `auth.signin.submit` "Zaloguj się" (pending: "Tworzenie konta…") |
| Confirm-email | resend | `getByRole('button')` | `confirmEmail.*` — h1 "Potwierdź e-mail", "Wyślij link ponownie" |
| Wizard | name input | `getByLabel` | `profileWizard.nameLabel` "Imię dziecka" (id `child-name`) |
| Wizard | age / avatar / world tiles | `getByRole('button', {name, pressed})` | age "7 lat"; avatar name composite of img alt + label (e.g. /Kuba/); nav "Dalej"/"Wstecz"/"Utwórz profil" |
| Picker | profile tile | `getByRole('button')` | `picker.tileLabel` "Graj jako {name}" |
| Start | start shift | `getByRole('button')` | `start.open` "Czas otworzyć sklep!" (JS navigation, not a link) |
| Start | h1 / level / upgrades link | heading / `getByText` / `getByRole('link')` | "Cześć, {name}!" / "Poziom sklepu {n}" / `start.upgradesLink` "Rozbuduj sklep" |
| Task | coin | `getByRole('button')` + `aria-pressed` | `task.coinLabel` "Moneta {n}" |
| Task | check / retry / progress | button "Sprawdź" / `role="status"` "Spróbuj jeszcze raz!" / text "Zadanie {n} z {m}" | `task.check`, `task.retry`, `results.progress` |
| Results | heading / back / stars | h1 "Koniec zmiany!" / button "Wróć do sklepu" / `role="img"` "Gwiazdki: {n} z 3" | `results.*` |
| Upgrades | buy / owned / celebration | button "Kup" (ambiguous — scope by card text) / "Masz to" / `role="status"` "Odblokowane!" + "Super!" | `upgradeShop.*` |
| PIN gate | pin input / submit / error | `getByLabel` "PIN (4–6 cyfr)" (password ⇒ **no textbox role**) / "Ustaw PIN"·"Otwórz panel" / `role="alert"` | `parentPin.*` |
| Report | h1 / per-child card / profile delete | "Raport tygodniowy" / h2 = child name / button "Usuń profil" (ambiguous with 2+ children — scope by card) | `report.*`, `deletion.profileAction` |
| Danger zone | trigger / dialog / arming / PIN / confirm | h2 "Usunięcie konta"; button "Usuń konto"; `role="alertdialog"` "Usunąć całe konto?"; `getByLabel` "Aby potwierdzić, przepisz: {email}" + "PIN rodzica"; button "Usuń konto na zawsze"; cancel "Anuluj"; dialog errors `role="status"` | `deletion.*` |
| Farewell | banner | `role="status"` | `deletion.accountDeleted` "Konto zostało usunięte…" (on `/?deleted=1`) |
| Offline | overlay | `role="status"`, h2 "Internet zniknął!…", button "Spróbuj ponownie" | `offline.*` |

**Soft spots (text-locator or scoping workarounds; none hard-block):** wallet pill has no role (sr-only "Portfel" + bare amount span); "Kup"/"Usuń profil" buttons are identical across cards (scope via card text); hint card is a plain div (locate by "Wskazówka"); auth/wizard error `<p>`s have no `role=alert`/live region; report subsection headers are styled divs, not headings; multiple `role="status"` elements can coexist (use text, not role, to disambiguate).

## What ONLY the e2e layer must prove (deduplication contract)

Existing coverage is broad at route/unit/component level (`auth-routes`, `auth-session-gating`, `auth-confirm`, `profiles-create`, `app-router`, `active-profile`, `shifts-complete`, `cross-device-restore` (server half), `task-guardrail` (jsdom), `shift` (math), `upgrades-buy`, `parent-pin{,-routes}`, `confirm-delete-dialog`/`delete-account-section` (jsdom), `account-deletion`, `reports`/`report-isolation`). The e2e layer's exclusive value:

1. **Journey glue**: full multi-page 302 chains in one real cookie jar (onboarding; PIN→report→danger-zone→farewell→re-gate).
2. **Island hydration**: `client:load` forms/games actually mount and behave (client validation UX, pending states, wizard step machine, ShiftScreen phase machine) — zero coverage today.
3. **Real browser cookie semantics**: httpOnly persistence across navigations; session-lifetime `active_profile` → picker-on-launch; 15-min `parent_verified` persistence across navigation and re-gating when cleared.
4. **Real interaction physics**: disabled buttons actually unclickable; dialog focus trap/Escape; tap → 1.4 s beat → auto-advance across a nondeterministic shift; real `fetch` to `/api/shifts/complete` riding real cookies.
5. **Fresh-context restore**: new context + UI re-signin sees SSR-rendered wallet/level/upgrades matching what a prior context earned (exact delta assertable).
6. Optionally, **the email round-trip itself** (config flip + Inbucket) — the only leg no test currently exercises end-to-end.

## Architecture Insights

- Auth/API routes are redirect-only (never JSON) except gameplay endpoints (`shifts/complete`, `upgrades/buy`, `parent/pin/*`, `account/delete`, `profiles/delete`) which return JSON to island `fetch`es.
- Islands navigate via `window.location.href` (StartShiftButton, ParentPinGate, DeleteAccountSection, ShiftResults) — hard navigations, not SPA transitions; `waitForURL` is the right wait.
- The system is deliberately fail-closed everywhere (missing env → 503/redirect; marker/secret missing → parent zone unreachable) — e2e failures on a misconfigured `.env` will look like product bugs; assert env preconditions in a setup project.
- Known pinned quirk still open: middleware `startsWith` over-match (`/appXYZ` gates too) — pinned in `tests/auth-session-gating.test.ts:129-134`; don't burn e2e budget on it.

## Historical Context (from prior changes)

- `context/archive/2026-07-10-production-email-delivery/research.md` — verification link contract (`token_hash`, Polish template, Inbucket at :54324), Brevo SMTP for prod (`enable_confirmations = true` prod-only).
- `context/archive/2026-07-11-account-deletion/` — deletion design intent, cascade proof, impl review APPROVED with all findings fixed (F5 401-mapping, F6 trim symmetry now in source); soft-gate caveat is why deletion stacks fresh-PIN.
- `context/archive/2026-06-19-testing-auth-critical-path/` — the vitest harness this phase reuses (provisioning helpers) and the §6.6 pinned-issues list, **now partially stale** (see Summary).

## Related Research

- `context/foundation/test-plan.md` §2 (risks), §4 (stack — e2e row to be updated by this phase), §6 (cookbook — this phase adds an e2e pattern section).

## Open Questions

1. **`astro preview` under `@astrojs/vercel` v10** — asserted incompatible from adapter design, not executed. Verify once (`npm run build && npm run preview`); if it works, a built-shape webServer becomes an option. Plan default: `npm run dev`.
2. **Local signup auto-confirm session cookies** — inferred that the signup POST writes session cookies when confirmations are off; verify live before pinning interstitial-era authentication in a spec.
3. **Inbucket/Mailpit HTTP API shape** at `:54324` — only needed if the plan includes the real email round-trip spec; unverified externally.
4. **Fresh-context semantics for Risk #2** — decide in planning: UI re-signin (recommended; true restart semantics) vs storageState with `active_profile` stripped (faster, but weaker claim).
5. **Playwright MCP** — not wired in `.mcp.json` (file absent); the `/10x-e2e` skill's browser-driving steps expect it. Bootstrap sub-phase should add it (or the skill runs generate/review only, with `npx playwright test` for verify).

## Follow-up Research 2026-07-12 (Phase 1 verify-first probes)

- **Open Question 1 RESOLVED**: `astro preview` errors under `@astrojs/vercel` v10 — "[preview] The @astrojs/vercel adapter does not support the preview command." (probed after `npm run build`, which succeeds). `npm run dev` is the only local runnable shape; the Playwright `webServer` choice stands.
- **Open Question 2 RESOLVED**: with local `enable_confirmations = false`, the signup POST **does** establish a session — the 302 to `/auth/confirm-email?email=…` carries `Set-Cookie: sb-127-auth-token` (+ `-code-verifier`). The browser is already authenticated on the interstitial locally; the onboarding spec must not assert an anonymous state there. (Probe also confirmed Astro's CSRF `checkOrigin` 403s POSTs without a same-origin `Origin` header — irrelevant to real-browser specs, relevant to any curl-style probing.)
- Incidental: `supabase status` labels the email-capture UI **Mailpit** at `:54324` (config key remains `[inbucket]`).
