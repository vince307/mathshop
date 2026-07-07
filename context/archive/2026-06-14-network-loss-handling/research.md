---
date: 2026-06-14T00:00:00Z
researcher: vince307
git_commit: f23d493
branch: main
repository: 10xDevs
topic: "Network-loss handling mid-shift — options for detection, state, UX, and persistence"
tags: [research, codebase, network-loss, FR-016, S-08, offline, pwa, supabase, resilience]
status: complete
last_updated: 2026-06-14
last_updated_by: vince307
external_research_rerun: 2026-06-14
---

# Research: Network-loss handling mid-shift — what options do we have?

**Date**: 2026-06-14
**Researcher**: vince307
**Git Commit**: f23d493
**Branch**: main
**Repository**: 10xDevs

## Research Question

> network-loss-handling — let's investigate this topic and see what kind of options we have here in order to take care of this kind of situation in our app.

Scope chosen by the user: **full offline/PWA dive** (v1 contract + v2 forward look), across **all four aspects**: detection mechanism, in-shift state & persistence, UX / in-world messaging, and Supabase write resilience.

## Summary

**Network loss is already a pinned, must-have requirement, not an open design space.** It is `FR-016` in the PRD and roadmap slice **S-08 (`network-loss-handling`)**. The contract is deliberately narrow: **detect loss → halt the shift → show one Polish in-world message ("Internet zniknął! Spróbuj za chwilę.") → discard pending mid-shift progress → on reconnect, resume from the last shift-end the server recorded.** v1 explicitly does **not** queue or sync mid-shift work — offline/PWA is an explicit PRD non-goal (`prd-v2.md:182`).

Three facts shape every option below:

1. **Nothing it depends on exists yet.** There is no shift loop, no gameplay state schema, no shift-end write path, no connectivity detection, no i18n layer, and no modal primitive. S-08 is blocked on **S-04** (`full-shift-with-results`), which builds the shift loop + the first durable write. This research is therefore *forward-looking* — it maps options to build into S-04/S-08, not code to change.
2. **The durable/ephemeral line is already clean.** Only the shift-end aggregate (coins, level, shop state, completed-shift count) is durable; everything in-progress is intentionally ephemeral. This makes the v1 "halt and lose pending state" behaviour trivially correct — there is nothing to reconcile.
3. **The one real correctness hazard is the shift-end write, not the detection.** `coins = coins + payout` is a non-idempotent read-modify-write; a succeeded-but-unacked write under flaky network can double-pay if retried naively. This is the thing that needs a real decision (idempotency key / `shift_id`), and it lands in S-04, not S-08.

**Recommended v1 detection posture** (options, not a mandate): treat `navigator.onLine`/`offline` event as a cheap *pessimistic* trigger, and a **fetch/Supabase failure (TypeError, not `response.ok===false`) as the authoritative signal**, with a timeout wrapping Supabase calls. No new dependency required for v1.

---

## Re-run delta — external research refreshed 2026-06-14

Re-ran the exa.ai external sweep (connectivity detection, supabase-js resilience, PWA/SSR, Background Sync, idempotency). Two findings **invalidate or sharpen** claims in the original write-up; the rest confirm it. Changes are folded into the sections below and flagged inline with **[updated 2026-06-14]**.

1. **supabase-js now ships built-in auto-retries _and_ a native timeout — the "no retry, no timeout" premise is stale.** As of **`supabase-js` v2.102.0**, PostgREST queries (`.from()`, `.rpc()`) retry transient errors by default (exponential backoff + jitter; retryable set: HTTP 408/409/503/504 + network failures). Separately, a native **`db: { timeout: ms }`** client option and per-query **`.abortSignal(AbortSignal.timeout(ms))`** now exist (PRs supabase/supabase-js #2072 retries, #2078 timeout). This removes the need to hand-roll a custom-`fetch` `AbortController` wrapper for the *timeout* half of Area 1.
2. **The auto-retry default _intensifies_ the double-pay hazard (Area 3), it doesn't relieve it.** The Supabase docs state POST (PostgREST's verb) is retried; PR #2072's rationale says only GET/HEAD/OPTIONS are, to avoid duplication on non-idempotent methods. **This contradiction must be pinned before S-04 builds the shift-end write** — if a non-idempotent `coins = coins + payout` write (RPC POST or PATCH) is auto-retried by the client, the "succeeded-but-unacked" double-pay can now happen *by default*, with no app code asking for it. Either disable retries on the write path or make the write idempotent (see Area 3 / Open Question 1). **Verify against the exact installed `supabase-js`/`postgrest-js` version at S-04 time** — this surface is changing month-to-month.

Everything else (navigator.onLine unreliability, fetch-failure-as-truth, PWA SSR caveats, Background Sync absent on Safari/iPadOS, idempotency-key pattern) was **confirmed and strengthened** by current sources — see the new **External Sources** section at the end.

---

## The requirement (what is actually mandated)

- **FR-016** (`context/foundation/prd-v2.md:141`): *"If the browser loses network connectivity mid-shift, the app halts the shift gracefully and shows a Polish in-world message (e.g., 'Internet zniknął! Spróbuj za chwilę.'). Pending shift state is lost; on reconnect, the child resumes from the last shift-end the application recorded. v1 does not attempt to queue or sync mid-shift work — offline resilience is deferred to v2."*
- **US-02 acceptance criterion** (`prd-v2.md:82`): same behaviour, framed from the child's seat.
- **Roadmap S-08** (`context/foundation/roadmap.md:170-181`): change-id `network-loss-handling`, prereq **S-04**, parallel with S-05/S-06, status `proposed`. Risk note: *"the slice is intentionally narrow: detect, halt, in-world message, no retry, no queue."*
- **Explicit non-goal** (`prd-v2.md:182`): *"No offline / PWA shell in v1… PWA conversion + offline play sit in v2 backlog and are explicitly out of v1 scope."*
- **Guardrails that constrain the UX** (`prd-v2.md:50`): mistakes/interruptions never feel punishing — no red flash, no buzzer, no "game over". The halt must read as a gentle in-world pause, not a technical error.

---

## Detailed Findings

### Area 1 — Detection mechanism

**Current state: there is zero connectivity detection in the codebase.** A grep for `navigator.onLine`, `online`/`offline` events, `AbortController`, `timeout`, and `retry` across `src/` returns no matches. Supabase calls today have no timeout, no retry, and no error-classification wrapper (`src/lib/supabase.ts:1-25`). Auth forms are traditional HTML POSTs with no `fetch`, so there is no client-side network-error path to model from (`src/components/auth/SignInForm.tsx`, `SignUpForm.tsx`).

**Options compared:**

| Mechanism | What it actually detects | False signals | Cost | Fit for v1 (FR-016) |
|---|---|---|---|---|
| `navigator.onLine` + `offline`/`online` events | OS network-*interface* present/absent | **False-positive on captive portal, dead router, VPN, virtual adapters** (reports online when internet is dead); rare false-negative | Free, event-driven | **Cheap hint only** — use the `offline` event as an instant "definitely down"; never trust a `true`/`online` reading |
| `fetch` failure (own API / Supabase) + `AbortController` timeout | Server genuinely unreachable (transport level) | Almost none, **if** you split reject (`TypeError`) from `response.ok===false` | Rides existing per-task requests = free | **Authoritative signal — primary for v1** |
| Active heartbeat to a tiny `/api/health` | Reachability during idle think-time too | Same as fetch (clean) | **Vercel Function invocations + tablet battery/radio** | Optional — only if the message must appear *during* idle gaps |
| supabase-js error inspection | Network vs HTTP/Postgrest error on data calls | Low — empty `error.code` + `"fetch failed"` ⇒ network; populated `code`/`status` ⇒ server reached | Free (rides data calls) | **Use as the classifier** on every Supabase call |
| Supabase Realtime `subscribe` status callback | Websocket connection state (`CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED`) | Low | Extra websocket + new surface | **Skip in v1** (`has_realtime=false` in `tech-stack.md`) |

**Key semantics to get right:**
- `navigator.onLine` is, per MDN, *"inherently unreliable"* — it only knows whether a network interface exists, not whether our server is reachable. Captive portals and dead upstreams report `true`. So it is useful as a fast pessimistic trigger (when `offline` fires, you are truly offline) but cannot confirm recovery.
- The authoritative rule: a `fetch()` that **rejects** with `TypeError` ("Failed to fetch") means transport failure → treat as offline. A `fetch()` that **resolves** with `response.ok === false` (4xx/5xx) means the server *was reached* → that is a server error, **not** offline, and must not show the "you're offline" message.
- **[updated 2026-06-14]** supabase-js historically shipped no retry and no default timeout, but **this changed**: as of **v2.102.0** PostgREST calls auto-retry transient errors by default, and there are now three ways to bound a hung call — (a) native client option `createClient(url, key, { db: { timeout: 8000 } })`, (b) per-query `.abortSignal(AbortSignal.timeout(8000))`, (c) the still-supported custom-`fetch` hook `createClient(url, key, { global: { fetch } })` for a global wrapper. Prefer (a)/(b) for v1; reserve (c) for cross-cutting concerns (e.g. error classification on every call). A ≈8–10s bound is still the right order of magnitude on a kid's tablet so a hung connection trips the offline state instead of spinning forever. **Caveat:** the built-in retry can *delay* surfacing the offline state (backoff stacks before the final rejection) — for the snappy in-world halt FR-016 wants, consider disabling retry on the detection path or keeping the timeout tight.
- On a Supabase network failure, the error has an **empty `code`** and a message like `"TypeError: fetch failed"`; a real PostgREST error has a populated `code` (e.g. `PGRST116`) and HTTP `status`. That difference is the classifier.

**Recommended v1 approach (layered, no new dependency):**
1. `offline` event ⇒ instant pessimistic trigger into the halt state.
2. fetch/Supabase failure on a per-task call ⇒ authoritative trigger; classify network vs server error.
3. Bound every Supabase call with a timeout — **[updated 2026-06-14]** use the native `db.timeout` client option or per-query `.abortSignal(AbortSignal.timeout())` rather than a hand-rolled custom-`fetch` `AbortController`; and decide retry posture explicitly on the write path (built-in retries are now on by default — see Area 3).
4. Don't trust `online`/`onLine===true` to lift the halt — confirm with a successful lightweight request first.
5. Heartbeat is **optional**, only if the product wants the message during idle think-time; otherwise omit and save Vercel invocations. If added: trivial `/api/health` (no DB), 20–30s interval, paused when `document.hidden`.
6. Centralize in a hook (`src/components/hooks/useConnectivity.ts`) + a service wrapper (`src/lib/services/`), consistent with the project's bare-React-state convention.

### Area 2 — In-shift state & persistence (the durable/ephemeral line)

**The line is already clean and PRD-backed.** Only the committed shift-end aggregate is durable; everything in-progress is intentionally ephemeral — which is exactly what makes "halt and lose pending state" correct with no reconciliation.

| Shift state piece | Side of the line | Authority |
|---|---|---|
| `coins` (account balance) | **Durable** — updated only at shift end | FR-010 `prd-v2.md:121`, FR-012 `:127` |
| business `level` | **Durable** | FR-012 `:127` |
| visible `shop_state` (shelves/sign/decor) | **Durable** | FR-011 `:124`, FR-012 `:127`, FR-015 `:139` |
| `completed_shift_count` | **Durable** | FR-012 `:127` |
| current task index / position in shift | **Ephemeral** — lost on disconnect by design | FR-016 `:141` |
| partial answers this shift | **Ephemeral** | FR-016 `:141` |
| accumulated would-be coins (running tally) | **Ephemeral** — never written until the single shift-end payout | FR-010 `:121` + FR-016 `:141` |
| per-task wrong-attempt counts | **Ephemeral** — collapse into shift-end stars | FR-009 `:116`, FR-011 `:124` |
| stars (0–3) | Results-screen display; **not** in the FR-012 durable list | FR-011 `:124` vs FR-012 `:127` |

**Cross-device resume is just a row reload.** FR-015 (`prd-v2.md:139`) "restore progress exactly as left" = a plain RLS-scoped `SELECT` of the durable child-profile row. Because in-progress state never leaves the device and is never durable, there is no offline reconciliation in v1.

**The persistence layer does not exist yet.** Today there is exactly one account-owned table, `child_profiles`, and it holds **identity only** (`id, account_id, avatar, theme, created_at, updated_at`) — see `supabase/migrations/20260609120000_child_profiles_isolation.sql:51-58`. The gameplay-state columns (`coins`, `level`, `shop_state`, `completed_shift_count`) **do not exist** — both the migration header and `docs/reference/contract-surfaces.md:15` state they are *"added later by S-04 under the same isolation contract."* The schema-vs-sibling-table choice is still open (`roadmap.md:130`).

### Area 3 — Supabase write resilience (the real hazard)

The single durable write that matters is a one-row `UPDATE` to the child-profile row at shift end. Reasoning about it under flaky network:

- **Atomicity is fine.** A single-row `UPDATE ... SET coins = coins + :payout, level = :l, shop_state = :s, completed_shift_count = completed_shift_count + 1 WHERE id = :id` is atomic in Postgres — all columns commit or none. **No partial-column risk** as long as the change is one statement, not split across multiple requests.
- **Idempotency is the hazard. [updated 2026-06-14 — now more acute]** `coins = coins + payout` is read-modify-write and **not idempotent**. If the network drops *after* Postgres commits but *before* the client sees the 200, a retry double-pays. FR-016's "halt, lose pending state, resume from last recorded shift-end" makes a *failed* write safe (just replay the shift) but a *succeeded-but-unacked* write dangerous if retried. **What changed:** supabase-js ≥ v2.102.0 retries by default, so the dangerous retry can now be issued *by the client library*, not just by hand-rolled app logic — making an explicit retry/idempotency decision on the write path non-optional, not a nice-to-have.
- **Options (undecided, belongs in S-04):**
  1. **Event-log / ledger, not in-place increment (the cleanest fix).** Per current idempotency guidance, replace `balance = balance + payout` with an append of one immutable row per shift to a `shift_results` ledger (unique constraint on `(account_id, shift_id)`), and derive `coins` as the sum (materialized or via trigger). An absolute-state write keyed on `shift_id` is naturally idempotent — a replay collides on the unique key and no-ops. This sidesteps the read-modify-write race entirely.
  2. **Idempotency key / `shift_id`** generated client-side at shift start, recorded server-side. The robust shape (from current sources): `INSERT ... ON CONFLICT DO NOTHING` to atomically claim the key in the *same transaction* as the side effect — the unique constraint is the mutual-exclusion primitive, not app logic. A full implementation models the row as a state machine (`IN_PROGRESS → COMPLETED/FAILED`) with a stale-after escape hatch, but that is heavier than v1 needs; the ledger upsert in option 1 captures the same safety more cheaply for a single-write payout.
  3. **Postgres RPC / `SECURITY DEFINER` function** wrapping the dedupe + write in one server round-trip (pairs well with option 1's ledger).
  4. **Fire-once, retries-disabled-on-write** (simplest, aligns with FR-016's "no queue/sync" spirit — a failed write just discards the shift). **[updated]** With built-in client retries now on by default, "fire-once" is no longer the *absence* of retry — it must explicitly opt out (disable retry / use a non-retried path) for the write call, or the residual succeeded-but-unacked double-pay becomes a default-on risk.
- **No prior art.** `context/changes/**` and `context/archive/**` contain nothing on persistence writes — the archived F-01 change is contract-layer only (*"F-01 has no write path… S-01 builds the first write path"*). Idempotency has never been designed.

**RLS contract any new state table must follow** (L-001, `lessons.md:5-11`; `docs/reference/rls-isolation.md:10-21`): owner column `account_id uuid not null references auth.users(id) on delete cascade`; four per-op policies (SELECT `using`, INSERT `with check`, UPDATE both, DELETE `using`), all `to authenticated`, predicate `auth.uid() = account_id`, **in the same migration**; ship a cross-account isolation test; register in `contract-surfaces.md`. Queued/replayed writes (if v2 ever adds them) must still pass these policies, and an idempotency key must never let one account's replay touch another's rows.

### Area 4 — UX / in-world messaging & localization

**Reusable patterns that exist:**
- React islands mount via `client:load` with server data passed as props (`src/pages/auth/signin.astro:16`). A full-screen halt overlay would mount the same way — either globally in `src/layouts/Layout.astro` or on the shift page.
- Soft alert styling precedent in `src/components/auth/ServerError.tsx:1-16` (lucide `CircleAlert`, `cn()` for class merging, semi-transparent palette). But it is **red** — the halt overlay must avoid red per the guardrail.
- Loading/spinner pattern via `useFormStatus()` + Tailwind `animate-spin` (`src/components/auth/SubmitButton.tsx`). `tw-animate-css` is available for gentle fade/pulse.
- `cn()` helper (`src/lib/utils.ts:1-6`) and full-screen layout idiom (`fixed inset-0`, `flex items-center justify-center`, `backdrop-blur`) already used on auth pages.

**Two real gaps to close before/within S-08:**
1. **No modal/overlay primitive.** `src/components/ui/` has only `button.tsx` and `LibBadge.astro` — no Dialog/Alert/Modal. The halt overlay is either a hand-rolled `fixed inset-0 z-50` island or `npx shadcn add dialog`/`alert-dialog`.
2. **No i18n layer — and current code violates FR-013.** All auth strings are **hardcoded English** inline across `src/components/auth/*.tsx`. The *only* Polish string in the codebase is the config message extracted to `src/lib/config-status.ts:15-17`. FR-013 (`prd-v2.md:132`) requires future locales be addable via **content changes, not code**. Building the halt message inline would repeat the anti-pattern. The cheap fix that satisfies FR-013 without a full i18n library: a Polish-default strings module (e.g. `src/lib/i18n.ts` / `strings.ts`) — `network.offline: "Internet zniknął! Spróbuj za chwilę."` — that S-08 establishes and later slices reuse.

**Tone constraints (binding):** Polish, in-world (the shop is "closed for a moment", not "Error: connection lost"), soft non-red palette, large tap targets for 6–8yo, smooth/no-jarring animation, no sound (`prd-v2.md:50`, NFRs `:145-148`).

---

## Code References

- `context/foundation/prd-v2.md:141` — FR-016, the network-loss contract
- `context/foundation/prd-v2.md:82` — US-02 acceptance criterion (child's view)
- `context/foundation/prd-v2.md:121,124,127,139` — FR-010/011/012/015 (durable state + payout boundary)
- `context/foundation/prd-v2.md:132` — FR-013 (content-swappable localization)
- `context/foundation/prd-v2.md:50,145-148` — guardrails + NFRs (tone, immediacy)
- `context/foundation/prd-v2.md:182` — explicit no-offline/PWA non-goal
- `context/foundation/roadmap.md:170-181` — S-08 slice (prereq S-04, "detect, halt, message, no retry, no queue")
- `context/foundation/roadmap.md:118-131` — S-04 (shift loop + first durable write; schema choice open at `:130`)
- `context/foundation/lessons.md:5-19` — L-001 (RLS-in-same-migration), L-002 (don't trust chained `.select()` for INSERT-isolation tests)
- `supabase/migrations/20260609120000_child_profiles_isolation.sql:51-58` — current `child_profiles` (identity only)
- `docs/reference/contract-surfaces.md:15` — "gameplay state added later by S-04"
- `docs/reference/rls-isolation.md:10-21`, `docs/reference/rls-template.sql` — RLS contract + skeleton
- `src/lib/supabase.ts:1-25` — per-request client factory; no retry/timeout/error wrapper
- `src/middleware.ts:1-26` — `getUser()` with no try/catch; Supabase-unreachable propagates as 500
- `src/pages/api/auth/{signin,signup,signout}.ts` — redirect-based error flow, no try/catch, no JSON error shape
- `src/components/auth/ServerError.tsx:1-16` — soft alert pattern (red; lucide; `cn()`)
- `src/components/auth/SubmitButton.tsx` — `useFormStatus()` + `animate-spin` spinner
- `src/components/ui/` — only `button.tsx`, `LibBadge.astro` (no Dialog/Alert)
- `src/lib/config-status.ts:15-17` — the only Polish string in the codebase today
- `src/lib/utils.ts:1-6` — `cn()` helper
- **Does NOT exist:** `src/types.ts`, `src/components/hooks/`, `src/lib/services/`, any gameplay API route, any i18n layer

## Architecture Insights

- **S-08 is the cheapest slice in the project but sits on the most expensive prerequisite.** The detect-halt-message logic is small; its correctness depends entirely on S-04 having built the shift loop and a *safely-retryable* shift-end write. The idempotency decision should be made in S-04, with S-08 only consuming it.
- **The durable/ephemeral split is a load-bearing design choice, not an accident.** By making the running coin tally ephemeral and paying out once at shift end (FR-010), the PRD removed the need for any mid-shift sync — which is precisely why offline can be a v2 non-goal without hurting v1 correctness. Any future attempt to persist mid-shift progress would re-introduce the reconciliation and idempotency problems this design avoids.
- **`navigator.onLine` is a hint, fetch-failure is the truth.** The robust pattern for a kid's tablet (captive portals, flaky WiFi) is the cheap-pessimistic-trigger + authoritative-confirm layering, not either signal alone.
- **Two adjacent debts surface here and should be paid as foundations, not S-08-locals:** the i18n string module (FR-013) and a Supabase error/timeout wrapper. Both will be reused by every gameplay slice; building them inside S-08 only would scatter them.

## v2 Forward Look — full offline / PWA options (explicitly requested; out of v1 scope)

For when offline resilience becomes real (PRD v2 backlog, `prd-v2.md:182`). Confirmed none of these are in `package.json` today.

- **PWA in Astro — `@vite-pwa/astro`** (Context7: `/vite-pwa/vite-plugin-pwa`; docs `/websites/vite-pwa-org_netlify_app`; repo `github.com/vite-pwa/astro`). Workbox-backed SW (manifest, precache, runtime caching, auto-update). Two modes: `generateSW` (zero-config) and `injectManifest` (author `src/sw.ts` — needed for custom logic like background sync).
  - **SSR caveat (load-bearing for `output:"server"`):** server-rendered routes **cannot be precached** — only static assets and `prerender=true` routes. SSR routes rely on **runtime caching** (`NetworkFirst` + `navigateFallback` to an offline page). First-ever offline visit to an SSR route shows the fallback, not real content. On the Vercel adapter the SW is a client artifact; validate the build emits it and **excludes `prerender=false` API routes** from precache globs.
  - **[updated 2026-06-14] Concrete pattern + Vercel gotcha:** the canonical SSR config (vite-pwa/astro `pwa-simple-assets-ssr` example) is `navigateFallback: '/'`, `navigateFallbackAllowlist: [/^\/$/]`, a `NetworkFirst` `runtimeCaching` entry matching `request.mode === 'navigate'` for non-root paths (`cacheName: 'offline-ssr-pages-cache'`, statuses `[200]`), and all SSR pages + `/api/` routes added to **`navigateFallbackDenylist`** so the SW never intercepts them. **Vercel-specific trap (vite-pwa/astro #54):** with the Vercel adapter, non-root pages can all fall through to the `/404` navigation fallback because Astro doesn't expose `/404` as a precacheable URL in hybrid/SSR mode — the fix is to point `navigateFallback` at the root `/` (which must be `prerender=true`), not at a `/404` page. Budget real debugging time here; this is a known rough edge, not a config typo.
- **Service-worker strategies:** precache app-shell + a Polish in-world offline page; `NetworkFirst` for SSR navigations; `StaleWhileRevalidate` for semi-static GETs; `NetworkOnly` for mutations (never cache writes).
- **Offline write queue / background sync:** **Background Sync API is Chromium-only — not Safari/iPadOS**, a realistic kid-tablet target, so it cannot be relied on. `workbox-background-sync` degrades to replay-on-next-SW-startup but has known flakiness in vite-plugin-pwa (issues #434, #739). The portable path is a **hand-rolled "outbox"**: persist queued mutations to IndexedDB, flush on `online` + on app start. **Idempotency keys become mandatory** when replaying — and replays must still pass per-account RLS.
- **Local persistence:** IndexedDB via `idb` or Dexie for structured/queued state; localStorage only for a tiny flag (synchronous, blocks main thread).
- **TanStack Query (one-paragraph tradeoff):** gives `networkMode`, retry-with-backoff, a paused-mutation queue, and cache persistence for free — the pragmatic path **if** adopting it as the data layer. But it's a real dependency and mental-model shift from bare React state, it's **not** a service worker (does nothing while the tab is closed, doesn't cache the SSR shell — you'd still pair it with `@vite-pwa/astro`), and it is **overkill for v1 FR-016**. Its value only appears once v2 actually wants offline mutation queuing.

## Historical Context (from prior changes)

- `context/archive/2026-06-09-per-account-isolation-contract/` (F-01) — established the RLS isolation contract every state table must follow; explicitly *contract-layer only*, "no write path"; documented L-001/L-002. S-08's eventual shift-end write inherits this contract via S-04.
- No prior change has touched persistence writes, idempotency, or connectivity — S-04/S-08 are greenfield on all three.

## Open Questions

1. **Idempotency design for the shift-end write** — `shift_id` ledger (recommended) vs RPC vs fire-once-with-retries-disabled. **Owner: S-04 planning** (must be decided there, since S-04 builds the write; S-08 only consumes it). **[updated 2026-06-14] Now also a retry-posture decision:** because supabase-js ≥ v2.102.0 auto-retries by default and the docs/PR disagree on whether POST (PostgREST's verb) is retried, S-04 must (a) pin the exact installed `supabase-js`/`postgrest-js` version, (b) confirm whether the chosen write verb is auto-retried, and (c) either make the write idempotent or explicitly disable retry on that call. Treat "the library won't retry my write" as an assumption to verify, not a given.
2. **Schema shape for gameplay state** — extend `child_profiles` vs sibling `profile_state` table (`roadmap.md:130`). Affects what the shift-end write and the resume `SELECT` look like. **Owner: S-04.**
3. **Heartbeat or not** — does the in-world "internet gone" message need to appear during idle think-time (child paused mid-task), or only when the child next acts? If yes → add a throttled `/api/health` poll; if no → ride natural per-task requests for free. **Owner: S-08 planning / product.**
4. **i18n module now or later** — establish `src/lib/i18n.ts` (Polish-default strings) as a foundation before S-08, or inline the one message and refactor later? FR-013 argues for the foundation. **Owner: user / a small foundation change.**
5. **Where the overlay mounts** — global in `Layout.astro` vs scoped to the shift page. Global catches loss anywhere; scoped keeps the blast radius to gameplay. **Owner: S-08 planning.**

## S-04 Plan Recommendation — shift-end write path (lift into `full-shift-with-results` plan.md)

S-08 research surfaced a decision S-04 owns: how the single shift-end write behaves under flaky network. This is the concrete recommendation. **Scope note:** this governs only the *write contract*; the shift loop, scoring, and results screen are separate S-04 work.

### Decision: persist each shift as one immutable ledger row, derive `coins` — do **not** in-place increment

Add a `shift_results` ledger table (one row per completed shift), and make the durable `coins` balance a **derived sum** of payouts, not a mutable counter. The shift-end "write" becomes an `INSERT ... ON CONFLICT (account_id, shift_id) DO NOTHING` keyed on a client-generated `shift_id`.

**Why this over the two alternatives:**

- **vs. in-place `coins = coins + payout`** — that write is read-modify-write and non-idempotent. With supabase-js ≥ v2.102.0 retrying by default and the docs/PR disagreeing on whether the write verb is retried (see Re-run delta), a succeeded-but-unacked retry can double-pay *with no app code asking for it*. An absolute-state ledger insert keyed on `shift_id` is idempotent by construction — a replay collides on the unique key and no-ops. This makes the retry-posture question moot instead of fragile.
- **vs. fire-once / retries-disabled** — viable and FR-016-aligned, but it leaves the succeeded-but-unacked edge as residual risk and forces an explicit, version-pinned "disable retry on this call" that must be re-verified every supabase-js bump. The ledger removes the risk class rather than narrowing it; the marginal cost (one table, a sum) is small and pays off again the moment v2 considers any offline queue.

We do **not** need the full `IN_PROGRESS → COMPLETED/FAILED` idempotency state machine from the external sources — that solves concurrent in-flight duplicates of a multi-step side effect. A single-statement payout insert keyed on `shift_id` gets the same safety far more cheaply.

### Shape (sketch — refine in plan.md, validate via Context7/Supabase docs at build time)

```sql
-- one immutable row per completed shift
create table shift_results (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references auth.users(id) on delete cascade,
  profile_id  uuid not null references child_profiles(id) on delete cascade,
  shift_id    uuid not null,              -- client-generated at shift START
  coins_paid  integer not null check (coins_paid >= 0),
  stars       smallint not null check (stars between 0 and 3),
  created_at  timestamptz not null default now(),
  unique (account_id, shift_id)           -- the idempotency primitive
);
```

- **`shift_id` is generated client-side when the shift begins**, held in ephemeral state, and sent with the payout. A reconnect/replay of the *same* shift reuses it → insert no-ops. A *new* shift after the FR-016 halt gets a fresh id → it's correctly a different payout.
- **Durable `coins`** = `sum(coins_paid)` for the profile. Options: a `coins` column on `child_profiles` maintained by an `after insert` trigger on `shift_results`, or a view/materialized sum. Trigger keeps the FR-012 read a plain single-row `SELECT` (matches the resume-is-a-row-reload finding in Area 2). **Decide in plan.md**; the trigger path is recommended for read simplicity.
- This **resolves roadmap S-04's open schema question** (`roadmap.md:130`, extend `child_profiles` vs sibling table) in favor of *both*: identity + derived balance on `child_profiles`, event history in the `shift_results` sibling.

### RLS contract (binding — L-001, same migration)

`shift_results` is account-owned, so it must ship the full isolation contract **in the same migration** (`docs/reference/rls-isolation.md:10-21`, `rls-template.sql`): owner col `account_id uuid not null references auth.users(id) on delete cascade`; four per-op policies (SELECT `using`, INSERT `with check`, UPDATE both, DELETE `using`), all `to authenticated`, predicate `auth.uid() = account_id`; a cross-account isolation test (heed L-002 — don't trust a chained `.select()` to prove INSERT isolation); register the surface in `docs/reference/contract-surfaces.md`. The `shift_id` dedup must never let one account's replay touch another's rows — the `(account_id, shift_id)` composite key plus the `with check` predicate enforce this together.

### Retry posture (explicit, even with the ledger)

The ledger makes a retried payment *safe*, but still set posture deliberately: keep the write a single statement (atomic), bound it with `db.timeout` / `.abortSignal(AbortSignal.timeout())` (Area 1), and **pin the installed `supabase-js`/`postgrest-js` version and confirm the insert verb's auto-retry behavior at build time** — so the safety argument rests on a verified fact, not an assumption. With the ledger in place, leaving built-in retries *on* is acceptable (replays no-op); document that choice in plan.md.

### Acceptance checks S-04 should add

1. Replaying the same `shift_id` (simulated unacked-then-retry) results in **exactly one** row and **one** payout — coins unchanged on the second call.
2. Two profiles under two accounts cannot read or insert into each other's `shift_results` (cross-account isolation test, L-001/L-002).
3. After an FR-016 mid-shift halt, the next shift uses a *new* `shift_id` and pays out independently; the abandoned shift left no `shift_results` row.
4. `coins` read after N shifts equals `sum(coins_paid)` — derivation is consistent.

### Fallback if S-04 scope is too large

If `/10x-plan` splits S-04 ("shift loop + persistence" then "results screen" per `roadmap.md` risk note), the ledger + RLS + idempotency belongs in the **persistence** half — it is the load-bearing correctness piece and must not be deferred into S-08. S-08 only *consumes* a safely-replayable write; it must never introduce one.

## Related Research

- None yet under `context/changes/**/research.md`. This is the first research artifact for `network-loss-handling`.

## External Sources (exa.ai re-run, 2026-06-14)

**Connectivity detection**
- MDN — `Navigator.onLine` ("inherently unreliable… only provide hints when the user may seem offline"): https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine
- "Why we stopped trusting navigator.online" (Chrome 144 macOS false-negatives via stale `SCNetworkReachability`; TanStack Query now starts `online:true` and only listens to events): https://medium.com/@adnansait74/why-we-stopped-trusting-navigator-online-fc77e3bb22e5
- makandra — fetch-favicon `isOnline()` with `AbortController` timeout (the cheap-pessimistic-trigger + authoritative-confirm pattern): https://makandracards.com/makandra/513033-javascript-testing-whether-the-browser-is-online-or-offline
- `sindresorhus/is-online` (active-check approach + abort signal): https://github.com/sindresorhus/is-online

**Supabase resilience [the material updates]**
- Supabase Docs — "How to do automatic retries with supabase-js" (built-in retries from **v2.102.0**, exponential backoff + jitter; `fetch-retry` for non-PostgREST): https://supabase.com/docs/guides/api/automatic-retries-in-supabase-js
- PR supabase/supabase-js #2072 — adds auto-retries; rationale "Only GET/HEAD/OPTIONS … POST/PATCH/DELETE could cause data duplication" (note the conflict with the docs page): https://github.com/supabase/supabase-js/pull/2072
- PR supabase/supabase-js #2078 + commit 7ec2df9 — native `db.timeout` option (AbortController-wrapped fetch): https://github.com/supabase/supabase-js/pull/2078
- postgrest-js #363 — `.abortSignal(AbortSignal.timeout(ms))` per-query timeout: https://github.com/supabase/postgrest-js/issues/363

**PWA / SSR (v2 forward look)**
- DeepWiki — "PWA with Server-Side Rendering | vite-pwa/astro" (NetworkFirst SSR config table): https://deepwiki.com/vite-pwa/astro/5.4-pwa-with-server-side-rendering
- vite-pwa/astro example `pwa-simple-assets-ssr/astro.config.mjs` (canonical SSR runtimeCaching + handlerDidError): https://github.com/vite-pwa/astro/blob/663a58ca/examples/pwa-simple-assets-ssr/astro.config.mjs
- vite-pwa/astro #54 — **Vercel** non-root pages fall through to `/404` fallback in hybrid/SSR; point `navigateFallback` at `/`: https://github.com/vite-pwa/astro/issues/54

**Background Sync (v2 forward look)**
- TestMu/LambdaTest — browser support (Chrome 49+/Edge/Opera/Samsung; **no Firefox, no Safari macOS/iPadOS/iOS in any version incl. Safari 26 / iOS 26.5**; ~76% global); iPad fallback = manual replay on `visibilitychange`: https://www.testmuai.com/learning-hub/background-sync-browser-support/
- Chrome for Developers — `workbox-background-sync` (IndexedDB Queue; on unsupported browsers retries on SW startup, needs the controlling page running): https://developer.chrome.com/docs/workbox/modules/workbox-background-sync
- MDN — Background Synchronization API (not Baseline; secure-context only): https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API

**Idempotency (the real hazard, Area 3)**
- "Idempotency is a Protocol, Not a Key" (UNIQUE index as the mutual-exclusion primitive; INSERT→work→UPDATE three-phase; transactional outbox): https://www.tiarebalbi.com/en/blog/idempotency-is-a-protocol-not-a-key
- FlowVerify — concurrent in-flight requests need PENDING state + `INSERT ... ON CONFLICT DO NOTHING` + `SELECT FOR UPDATE`: https://www.flowverify.co/blog/idempotency-keys-concurrent-pattern
- BackendBytes — "store the transaction with a unique ID and compute balance from the log" instead of `balance = balance + 100` (the event-log fix): https://backendbytes.com/articles/idempotency-patterns-distributed-systems/
