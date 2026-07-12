# E2E Browser Layer (Playwright) — Plan Brief

> Full plan: `context/changes/testing-e2e-playwright/plan.md`
> Research: `context/changes/testing-e2e-playwright/research.md`

## What & Why

Add the first browser-level test layer to MathShop: Playwright e2e specs proving the four user journeys that no existing test can see — onboarding (Risk #4), fresh-context restore of earned progress (Risk #2), the child gameplay loop (Risk #6), and the parent PIN gate + account-deletion danger zone. This is rollout Phase 5 of `context/foundation/test-plan.md`, opened via scoped refresh after the original four phases completed.

## Starting Point

A broad, serial vitest suite (route/unit/component, real local Supabase) covers contracts and invariants — but zero coverage exists for journey glue, island hydration, real cookie semantics, or real interaction physics. No Playwright is installed; no e2e dir, config, or MCP exists.

## Desired End State

`npx playwright test` and a blocking CI job run a green 4-journey suite in `e2e/` across two Chromium projects (desktop + touch viewport), fully parallel on per-test throwaway accounts, with role/label-first locators resolved from `src/i18n/pl.ts` and zero `waitForTimeout`. The test plan's §4/§6 document the new layer and how to extend it.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Email-verification leg | Admin `generateLink` → real browser hits the confirm URL | Exercises the real `token_hash`/`verifyOtp` route + cookies with zero config changes; pattern proven in `tests/auth-confirm.test.ts` | Research + Plan |
| Browser matrix | Chromium desktop + Chromium touch viewport (gameplay only) | Kids play on touch devices (mobile mockups are canonical); same binary keeps infra cost near zero | Plan |
| CI | Blocking job in this phase | E2E outside CI decays within weeks; existing workflow already has the Supabase steps | Plan |
| Playwright MCP | Wire `.mcp.json` in bootstrap | `/10x-e2e` (driving Phases 2–4) expects browser tools for its generate→review→verify loop | Plan |
| Account deletion spec | Full real delete on throwaway accounts | Cascade isolation proven at route level; the browser-only payoff (farewell, cookie clearing, re-gate) is the point | Research + Plan |
| Parallelism | `fullyParallel`, per-test accounts, workers ≤ 4 | Accounts fully isolate state; serial would be 5–10 min for no isolation gain | Research + Plan |
| Fresh-context semantics | UI re-signin, never `storageState` | `storageState` falsely persists the session-lifetime `active_profile` cookie | Research |
| Gameplay determinism | Derive answers from the DOM (no seed, no product changes) | Generator is unseeded `Math.random()`; counting = tap all, change = `paid − price` from story text | Research |

## Scope

**In scope:** Playwright bootstrap (config, helpers over `tests/helpers/supabase.ts`, i18n locator module, `.mcp.json`, smoke spec), 3 journey spec files, CI job, test-plan §4/§5/§6 updates (incl. backporting the stale §6.6 known-issues list).

**Out of scope:** WebKit/Firefox; real email round-trip (Inbucket); PIN-lockout e2e (60 s sleep); visual/snapshot tests; any duplication of route/RLS/guardrail coverage; product-code changes for testability; runs against Vercel/production.

## Architecture / Approach

`playwright.config.ts` boots `npm run dev` on :4321 with explicit env mapping (`SUPABASE_KEY` ← `SUPABASE_ANON_KEY` from `.env.test`) against the local Supabase stack. Specs live in top-level `e2e/*.spec.ts` — invisible to vitest's `tests/**/*.test.*` include. Every test provisions its own admin-created account (UUID email) and cleans up; only the onboarding spec signs up through the UI (IP rate-limit budget). All waits are state-text waits — the 1.4 s gameplay beat and hard `window.location.href` navigations are absorbed by `toBeVisible`/`waitForURL`, never sleeps.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Bootstrap + smoke (`/10x-implement`) | Config, helpers, MCP, green smoke spec; open questions resolved | Env mapping subtleties (webServer child vs test process) |
| 2. Onboarding spec (`/10x-e2e`) | Full signup→confirm→wizard→start chain + validation/bounce edges | Wizard locator composites (avatar tiles) |
| 3. Gameplay + restore spec (`/10x-e2e`) | Solve-shift loop, exact earnings delta, fresh-context restore, picker-on-launch | Wallet-pill locator soft spot; beat-driven flake |
| 4. Parent surfaces spec (`/10x-e2e`) | PIN lifecycle + full destructive deletion journey | Destructive discipline (throwaway-only, graceful cleanup) |
| 5. CI + docs (`/10x-implement`) | Blocking e2e job; test-plan §4/§5/§6 updated | CI runtime/flake budget |

**Prerequisites:** Docker + `npx supabase start`; `.env.test` populated; `npx playwright install chromium` once.
**Estimated effort:** ~4–5 sessions (one per phase; Phase 3 is the longest).

## Open Risks & Assumptions

- `astro preview` assumed broken under the Vercel adapter (verify-first step in Phase 1; `npm run dev` is the plan either way).
- Local signup auto-confirm may pre-authenticate the interstitial (verify-first; the onboarding spec must not depend on either outcome).
- Wallet display has no accessible role — if text-locating proves brittle, the spec falls back to level/upgrades/picker assertions and surfaces the a11y gap as a product finding.
- CI flake budget: retries=2 + trace-on-first-retry assumed sufficient; if not, the touch project moves to scheduled runs (conscious change).

## Success Criteria (Summary)

- All four journeys pass locally and in a blocking CI job, in parallel, on both viewport projects where scoped.
- A regression in any journey hop (redirect glue, hydration, cookie lifecycle, dialog arming) turns a spec red with a readable trace.
- A newcomer can add a fifth journey spec from test-plan §6.7 alone.
