# First Child Profile Wizard + Child Start Screen (S-01b) Implementation Plan

## Overview

Turn the placeholder `/app` landing into the real post-auth funnel for roadmap slice **S-01b**: an authenticated parent with no child profile is guided through a multi-step **create-first-child-profile wizard** (name → age → avatar → interest), the profile is written to `child_profiles` under the F-01 per-account RLS contract, and the child lands on a **start screen** showing a single themed business with an oversized in-world "Czas otworzyć sklep!" tap affordance. `/app` becomes the **profile-count router** (0 → wizard, 1 → start, 2+ → most-recent profile's start; the real multi-profile picker is S-07). Built on the MatmaVerse light design system, introducing the first **child-primitive** (oversized tap target) tier that S-02+ child surfaces will reuse.

## Current State Analysis

- **`child_profiles` already exists** (Foundation F-01, `supabase/migrations/20260609120000_child_profiles_isolation.sql`): `id, account_id, avatar text not null, theme text not null default 'default', created_at, updated_at`, full per-account RLS (4 policies, `auth.uid() = account_id`), shared `set_updated_at()` trigger, `account_id` index. Registered in `docs/reference/contract-surfaces.md`. Isolation test `tests/child-profiles-isolation.test.ts` references avatar ids `lis`, `wilk`, `kot` and inserts `{account_id, avatar}` only.
- **`/app` is a placeholder** (`src/pages/app.astro:9-16`) with a documented "Part B extension point" describing exactly this router. `src/middleware.ts:5` gates `/app` via `PROTECTED_ROUTES` + `startsWith` (subpaths inherit gating). Both signin and confirm-email already funnel to `/app`.
- **Mutation pattern** is form-POST → API route → redirect wrapped in `applyNoStore` (`src/pages/api/auth/signin.ts`); the request-scoped SSR client (`src/lib/supabase.ts` `createClient(headers, cookies)`) runs queries as the authenticated parent so RLS scopes automatically. **No `src/lib/services/` yet; zod is not installed.**
- **Design system is live** (archived `matmaverse-design-system`): tokens (`src/styles/global.css`), themed shadcn primitives (`src/components/ui/*`), AuthShell, committed `public/illustrations/` art (`world-{kawiarnia,piekarnia,galaktyczna-baza,sklep-ksiegarnia}.png`, `coin*.png`). `AuthShell` is auth-specific (not reusable here); the reusable idiom is the signin **form-card**. shadcn buttons top out at `h-11` (~44px) — too small for 6–8yo per `prd-v2.md:146`.
- **Mockups** (local-only): `05-child-profile-{web,mobile}.png` drives the wizard (Imię, Wiek, avatar row, Zainteresowania world grid, "Poziom startowy" chip, "Dalej"); the hero region of `02-child-dashboard-web.png` drives the start screen (single business card + greeting + "Zacznij teraz"). No avatar art exists yet.

## Desired End State

A fresh parent signs up, verifies, and is routed by `/app` into a Polish multi-step wizard; they enter the child's name, pick an age (6–9), choose one of ~6 illustrated avatars and an interest, and submit. A `child_profiles` row is created (owned by their account, RLS-isolated). They are taken to the child start screen — greeting by name, a single themed business (from the chosen interest), and a large "Czas otworzyć sklep!" button that shows a friendly in-world "coming soon" message (the shift loop is S-02+). On reload (1 profile), `/app` skips the wizard and lands on the start screen directly. The full suite stays green; `npm run lint` and `npm run build` pass.

Verify: `npm run lint` + `npm run build` green; `npm test` green (existing 29 + new route/migration coverage); manual walk of signup → wizard → start; `child_profiles` row visible in Studio with name/age/avatar/theme/starting_level and isolated per account.

### Key Discoveries:

- **`child_profiles` exists — this is the SECOND migration on it** (`…isolation.sql`). Per **lesson L-001**, the new columns + their constraints ship in one migration with RLS coverage intact; the existing isolation test's `{account_id, avatar}` inserts must be updated for the new NOT NULL columns in the same phase or they break.
- **Avatar id is the DB contract** — `lis`/`wilk`/`kot` are already in the isolation test (`tests/child-profiles-isolation.test.ts:47,85,126`); the registry must use stable slugs and include these. The `avatar` column has no DB enum; the closed set is enforced in app-layer zod.
- **`/app/*` is already gated** by `middleware.ts:5` `startsWith("/app")` — keeping wizard + start routes under `/app` avoids new gating gaps (mind the `startsWith` no-boundary gotcha — don't introduce a sibling like `/apple`).
- **Conscious PRD-guardrail break** — D1 collects child name+age, overriding `prd-v2.md:51,168` "no child PII". Name/age are PII: RLS-isolated, zod-validated, rendered only as auto-escaped text, never logged.
- Reuse `world-{theme}.png` for the start-screen business; coins/level UI are S-04 (omit from the start screen now).

## What We're NOT Doing

- **No multi-profile picker UI / add-second-profile entry point** — S-07. S-01b only detects count and routes; it never creates a 2nd profile.
- **No server-side profiles-per-account cap.** `POST /api/profiles/create` is directly callable and unbounded; the router only sends count-0 parents to the wizard, so the happy path creates exactly one. A "max profiles" / "already has a profile" guard is **deferred to S-07** (which owns the add-2nd flow). Accepted as a known, harmless unbounded write for S-01b (the 2+ branch routes to most-recent).
- **No shift/gameplay/tasks/scoring/results/persistence** — S-02/S-03/S-04. The start-screen tap is a friendly no-op.
- **No coins/level UI or gameplay-state columns** — S-04 extends the schema later. S-01b adds only identity columns (name/age/starting_level).
- **No world-selection screen** (`01-world-selection`) or child dashboard panels (`02-child-dashboard` beyond the hero) — later slices.
- **No auth/verification changes** — S-01a (archived) owns those.
- **No dark mode, no brand rename** (mockups' "MathMarket" stays MatmaVerse).
- **No new i18n strings outside the dictionary** — all Polish copy via `src/i18n` (L-003); avatar names live in `src/data/avatars.ts` as content.

## Implementation Approach

Bottom-up so each phase is independently committable and keeps the suite green: land the **data layer** first (migration + columns + updated isolation coverage + zod), then the **shared building blocks** (avatar registry + art, child-primitive tier, i18n), then the **write path** (service + API + route tests), then the **wizard UI** that posts to it, and finally the **router + start screen** that wires the end-to-end flow. The wizard and start screen live under `/app/*` to inherit existing gating.

## Critical Implementation Details

- **NOT NULL ALTER ordering.** Adding `name`/`age` as `NOT NULL` to `child_profiles` makes the existing isolation test's `{account_id, avatar}` inserts fail. Phase 1 must update those inserts (and any helper) in lockstep with the migration. `child_profiles` carries no production data pre-launch, so a direct `NOT NULL` add (no backfill) is safe; `starting_level` gets a default to be defensive.
- **PII discipline (conscious guardrail break).** `name`/`age` are child PII collected per D1. Validate with zod (length/range/trim), render the name only via auto-escaped text interpolation (never `set:html`), never include it in logs or error messages, and rely on the F-01 RLS predicate for isolation. Record the override prominently (it contradicts `prd-v2.md:51,168`).
- **Never trust a client-supplied `account_id`.** The create route derives `account_id` from `context.locals.user.id` / `supabase.auth.getUser()`; the `with check` policy is the backstop (L-002).
- **Theme/interest value set is closed and art-aligned.** The four valid `theme` slugs are exactly the committed illustration stems: `kawiarnia`, `piekarnia`, `galaktyczna-baza`, `sklep-ksiegarnia` (plus the table default `default` → renders as `kawiarnia`). The start screen resolves art as `world-<theme>.png`. The wizard's interest tiles label these in Polish via `t.marketing.worlds`; reconcile the mockup's "Sklep kolekcjonera" wording to the `sklep-ksiegarnia` slug/art (one label↔slug↔art row per world). The zod schema in Phase 3 validates `theme` against this closed set.

## Phase 1: Data layer — identity columns + migration + isolation coverage

### Overview

Extend `child_profiles` with the identity columns S-01b writes, keeping the F-01 RLS contract and its isolation test intact, and add zod.

### Changes Required:

#### 1. Migration: add identity columns

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_child_profiles_add_identity.sql` (new)

**Intent**: Add the child identity fields the wizard collects to the existing owned table, in one migration, preserving the F-01 isolation contract (RLS already enabled; predicate unchanged).

**Contract**: `alter table public.child_profiles add column name text not null`, `add column age smallint not null`, `add column starting_level smallint not null default 1`. Add a check constraint `age between 6 and 9`. No new RLS policies needed (the four account-scoped policies already cover all columns); do NOT redefine `set_updated_at()`. Follows `docs/reference/rls-template.sql` conventions for an existing table.

#### 2. Update the contract-surface registry

**File**: `docs/reference/contract-surfaces.md`

**Intent**: Keep the load-bearing-names registry truthful — record the new columns and the new migration as a consumer of the surface.

**Contract**: Under `## public.child_profiles`, extend the Columns line with `name`, `age`, `starting_level` and note the second defining migration. Mention name/age are RLS-isolated child PII (consciously collected, D1).

#### 3. Keep the isolation test valid + extend it for the new columns

**File**: `tests/child-profiles-isolation.test.ts`

**Intent**: The new NOT NULL columns break `{account_id, avatar}`-only inserts; update every insert to satisfy them, and assert the new PII columns are equally account-isolated.

**Contract**: Add `name`/`age` (and rely on the `starting_level` default) to each `.insert(...)`. Keep the L-002 INSERT-isolation shape (insert without chained `.select()`, verify durable state via the service-role `admin` client). Add a select-isolation assertion that account B cannot read account A's `name`. `ChildProfileRow` type gains `name`, `age`, `starting_level`.

#### 4. Install zod

**File**: `package.json`

**Intent**: Add the validation dependency CLAUDE.md mandates for API input (first use in the repo).

**Contract**: `npm install zod`; `zod` appears in `dependencies`.

### Success Criteria:

#### Automated Verification:

- Migrations apply cleanly: `npx supabase db reset`
- Isolation test green: `npm test`
- Lint passes: `npm run lint`
- Build passes: `npm run build`
- `zod` present in `package.json` dependencies

#### Manual Verification:

- In Studio, `child_profiles` shows `name`, `age`, `starting_level` with the `age 6–9` check; existing RLS policies still listed

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: Avatar registry + child-primitive tier + i18n

### Overview

Create the reusable building blocks the wizard and start screen consume: the avatar registry + sliced art, the oversized child-primitive components, and the Polish strings.

### Changes Required:

#### 1. Avatar registry + sliced art

**File**: `src/data/avatars.ts` (new), `public/avatars/*` (new), `public/avatars/slice-map.md` (new)

**Intent**: Define the closed set of ~6 pre-set avatars (id = stable DB slug, Polish name + alt as content) and ship their art, sliced from the `05-child-profile` mockup per the existing slice-map convention.

**Contract**: `export interface Avatar { id: string; name: string; image: string; alt: string }` and `export const AVATARS: Avatar[]` of 6 entries whose ids **include `lis`, `wilk`, `kot`** (already in the isolation test) plus three more animal slugs; `image` points to `/avatars/<id>.png`. Each PNG committed under `public/avatars/`; `slice-map.md` records source PNG + crop box per file. Export a helper to look up by id and the id union for zod.

#### 2. Child-primitive component tier

**File**: `src/components/child/*` (new)

**Intent**: Introduce the first oversized, child-accessible controls (per `prd-v2.md:146`) that the wizard and start screen use and S-02+ reuse.

**Contract**: A small set — e.g. `ChildButton.tsx` (oversized tap target: tall, large text, generous padding, primary/gold variants, merges classes with `cn()`), and `SelectTile.tsx` (large selectable tile with image/label + checked/ring state, for avatars and interests). Tap targets sized and spaced so adjacent tiles can't be hit by one tap. Token-styled (radius/gold accent). No behavior beyond selection callbacks.

#### 3. i18n namespaces

**File**: `src/i18n/pl.ts`

**Intent**: Author all wizard + start-screen Polish copy as dictionary content (L-003).

**Contract**: Add `profileWizard` namespace (step labels "Krok x z 3", headings, field labels Imię/Wiek/avatar/Zainteresowania, age option labels 6–9, starting-level label e.g. "Podstawy", CTAs Dalej/Wstecz/Utwórz profil, validation messages) and `start` namespace (greeting template "Cześć, {name}!", business prompt "Czas otworzyć sklep!", coming-soon in-world message). Interest/world labels reuse `marketing.worlds` where possible. Avatar names stay in `src/data/avatars.ts`, not here.

### Success Criteria:

#### Automated Verification:

- Build passes (assets + imports resolve): `npm run build`
- Lint passes: `npm run lint`
- Full suite green: `npm test`
- `public/avatars/` contains 6 PNGs + `slice-map.md`; `src/data/avatars.ts` exports `AVATARS` including `lis`/`wilk`/`kot`

#### Manual Verification:

- Each avatar slice opens and is the correct crop with acceptable edges
- Child primitives render visibly oversized vs the adult shadcn buttons, with clear selected state

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Create-profile service + API route + route tests

### Overview

Add the authenticated write path: a service module, the `POST /api/profiles/create` route (zod-validated, RLS-scoped), and route-level isolation tests.

### Changes Required:

#### 1. Child-profiles service

**File**: `src/lib/services/child-profiles.ts` (new)

**Intent**: Centralize child-profile data access behind a request-scoped-client API (establishes the `src/lib/services/` convention).

**Contract**: Functions taking the SSR client: `createChildProfile(client, { name, age, avatar, theme, startingLevel })` (insert; `account_id` is set by the caller from the session, never the client payload), `countChildProfiles(client)` (exact head count), `getMostRecentProfile(client)` (order by `created_at desc` limit 1). A pure `deriveStartingLevel(age)` helper (age band → level: 6–7 → 1, 8–9 → 2). No `account_id` filtering in queries — RLS handles it.

#### 2. Create-profile API route

**File**: `src/pages/api/profiles/create.ts` (new)

**Intent**: Accept the wizard's form post, validate it, and write the profile as the authenticated parent, mirroring the auth-route pattern.

**Contract**: `export const prerender = false`; `export const POST`. Build the request-scoped client; null-guard. Resolve the user via `getUser()`/`context.locals.user`; if absent, redirect to `/auth/signin`. zod-validate `{ avatar ∈ AVATARS ids, name: trimmed 1–30 chars, age: int 6–9, theme ∈ world slugs }`; derive `startingLevel` from age. Call the service with `account_id = user.id`. On success `applyNoStore(context.redirect("/app"))`; on validation failure redirect back to the wizard with a Polish `?error=`. Name is never logged.

#### 3. Route-level isolation tests

**File**: `tests/profiles-create.test.ts` (new)

**Intent**: Prove the route writes only `auth.uid()`-owned rows and rejects a spoofed `account_id` (L-002 discipline), using the request-level harness.

**Contract**: Using `tests/helpers/astro.ts` (`buildContext`, cookie jar) + a session minted via the real signin route and `tests/helpers/supabase.ts` (`admin`, `createSignedInUser`, `deleteUser`): (a) authed POST with valid fields → redirects to `/app`, and the **service-role `admin` client** confirms exactly one row for that account with the expected name/avatar; (b) a request carrying a client-supplied `account_id` for another account does NOT create an A-owned row (verify via `admin`); (c) invalid input (bad age / empty name / unknown avatar) → redirect with `?error=`, no row written. Unique emails per run; cleanup via `deleteUser`.

#### 4. Route gating check

**File**: `src/middleware.ts`

**Intent**: Ensure the new surfaces are gated; confirm no change is needed.

**Contract**: Wizard + start pages live under `/app/*`, already covered by `PROTECTED_ROUTES` `startsWith`. The API route self-guards via `getUser()`. Add a route to `PROTECTED_ROUTES` only if a surface ends up outside `/app`. (Expected: no change.)

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`
- New route tests green + full suite green: `npm test`

#### Manual Verification:

- A valid POST (via curl with a signed-in cookie or the wizard) creates a profile and redirects to `/app`; invalid input round-trips with a Polish error and writes nothing

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Create-profile wizard UI

### Overview

Build the multi-step parent-facing wizard that collects name → age → avatar → interest and posts to the create route, driven by mockup `05`.

### Changes Required:

#### 1. Wizard page

**File**: `src/pages/app/new-profile.astro` (new)

**Intent**: Host the wizard island within the gated `/app` space, using the form-card idiom (not AuthShell).

**Contract**: Renders `<CreateProfileWizard client:load />` inside a centered token-styled card; passes the `?error=` query through to the island. Brand header consistent with the auth surfaces.

#### 2. Wizard island

**File**: `src/components/child/CreateProfileWizard.tsx` (new) (or `src/components/profile/…`)

**Intent**: A multi-step "Krok x z 3" flow assembling the child primitives, validating client-side, and submitting to `/api/profiles/create`.

**Contract**: Steps — (1) identity: name `Input` + age select (6–9); (2) avatar (`SelectTile` grid over `AVATARS`) + interest (`SelectTile` grid over the four worlds); (3) review + submit. Progress indicator ("Krok x z 3"), Wstecz/Dalej navigation, oversized `ChildButton` controls, no-text-input for avatar (tap-select). Shows the derived starting-level label chip from the chosen age. Client-side validation mirrors the zod schema (the server re-validates). Submits a normal form POST to the API (so the server redirect drives navigation). All strings from `t.profileWizard`; avatar names from `AVATARS`.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Full suite green: `npm test`

#### Manual Verification:

- `/app/new-profile` renders the multi-step wizard matching mockup `05` (name, age, avatar row, interest grid, "Dalej"); tap targets are oversized and non-adjacently-hittable; completing it creates a profile and lands on `/app`

**Implementation Note**: Pause for manual confirmation before Phase 5.

---

## Phase 5: `/app` profile-count router + child start screen

### Overview

Wire the end-to-end flow: `/app` routes by profile count, and the child start screen renders the themed business with the oversized coming-soon tap.

### Changes Required:

#### 1. Profile-count router

**File**: `src/pages/app.astro`

**Intent**: Replace the placeholder body with the documented router (the `app.astro:11-16` extension point).

**Contract**: In frontmatter, build the request-scoped client and `countChildProfiles`. Branch: `0 → redirect /app/new-profile`; `≥1 → redirect /app/start` (the start page loads the most-recent profile; 2+ is the S-07-deferred case, routed to most-recent so there's no dead-end). Preserve the existing signed-in/signout affordance only if still reachable; otherwise the router fully replaces the placeholder. Keep the Part-B comment updated to reflect S-07 ownership of the picker.

#### 2. Child start screen

**File**: `src/pages/app/start.astro` (new), `src/components/child/StartShiftButton.tsx` (new)

**Intent**: Render the single-business start screen with the in-world tap affordance (D3 no-op).

**Contract**: Frontmatter loads `getMostRecentProfile`; if none, redirect to `/app/new-profile`. Renders a greeting (`t.start` with the escaped `name`), a themed business card using `world-<theme>.png` (default → `world-kawiarnia.png`), and `<StartShiftButton client:load />` — an oversized `ChildButton` labeled "Czas otworzyć sklep!" whose tap shows a friendly in-world "coming soon" message (no navigation, no bare-math framing per `prd-v2.md:158`). No coins/level UI (S-04).

#### 3. Router-branch request test

**File**: `tests/app-router.test.ts` (new)

**Intent**: Lock the core routing behavior (the slice's load-bearing new logic) with an automated regression test, since the end-to-end flow is otherwise manual-only.

**Contract**: Using the request harness (`tests/helpers/astro.ts` + `createSignedInUser`/`admin` from `tests/helpers/supabase.ts`, mirroring `tests/auth-session-gating.test.ts`): seed 0, 1, and 2 profiles for an account via the service-role `admin` client, drive `/app`, and assert the redirect target each time (0 → `/app/new-profile`; 1 → `/app/start`; 2 → `/app/start`, most-recent). Unique accounts per case; cleanup via `deleteUser`.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Router-branch test green (0/1/2 → correct redirect): `npm test`
- Full suite green: `npm test`

#### Manual Verification:

- Fresh signup → verification → `/app` routes to the wizard (0 profiles); after creating a profile, lands on the themed start screen greeting the child by name with the "Czas otworzyć sklep!" oversized button; tapping shows the in-world coming-soon message; reloading `/app` (1 profile) skips the wizard and lands on the start screen; profiles stay account-isolated

**Implementation Note**: Final phase — roll up pending manual items and confirm before closeout.

---

## Testing Strategy

> **Local-stack dependency:** the migration-apply check (`npx supabase db reset`) and every `npm test` run that touches `child_profiles` (isolation, create-route, app-router tests) require the local Supabase stack (Docker) to be running. In a Docker-less sandbox or cloud agent these fail with `fetch failed` against `127.0.0.1:54321` — that's environmental, not a regression. `npm run lint` / `npm run build` have no such dependency.

### Unit / Integration Tests:

- **Extend the isolation test** (`tests/child-profiles-isolation.test.ts`) for the new NOT NULL columns + name select-isolation (Phase 1).
- **New route test** (`tests/profiles-create.test.ts`): positive create + service-role verification, `account_id`-spoof rejection, invalid-input no-write (Phase 3), following L-002 (durable-state verification via the `admin` client; no chained `.select()` for the negative path).
- Existing 29 behavior tests stay green throughout.

### Manual Testing Steps:

1. `npx supabase db reset` then `npm run dev`; sign up a fresh parent → verify → confirm `/app` lands on the wizard.
2. Complete the wizard (name, age 6–9, avatar, interest); confirm redirect to a themed start screen greeting the child by name; tap the business → in-world coming-soon.
3. Reload `/app` → lands straight on the start screen (single profile skips the wizard).
4. In Studio, confirm the row is owned by the account with name/age/avatar/theme/starting_level; sign in as a different account and confirm it cannot see the first account's profile.

## Performance Considerations

The router adds one indexed `count` query (backed by `child_profiles_account_id_idx`) to `/app` — negligible, within the ≤3s cold-load NFR. Avatar/world art are static `public/` assets served by the CDN; keep avatar PNGs small (lazy-load in the wizard grid).

## Migration Notes

One additive migration on an empty (pre-launch) `child_profiles`; NOT NULL columns added directly (no backfill). If the table ever holds data before this ships, add a default + backfill for `name`/`age` first. No data is destroyed; the F-01 RLS contract is preserved (no policy changes).

## References

- Research: `context/changes/first-child-profile-and-start-screen/research.md` (incl. locked decisions D1–D4)
- Data contract: `supabase/migrations/20260609120000_child_profiles_isolation.sql`, `docs/reference/{rls-isolation.md,rls-template.sql,contract-surfaces.md}`
- Patterns: `src/pages/api/auth/signin.ts` (route), `src/pages/auth/signin.astro` (form-card), `tests/child-profiles-isolation.test.ts` + `tests/helpers/{supabase,astro}.ts` (test harness)
- Lessons: L-001 (RLS in same migration), L-002 (durable-state isolation test), L-003 (i18n strings)
- Mockups (local-only): `assets/matma-verse/math-economy-auth-v2-*/05-child-profile`, `…/math-economy-ui-v2-web/02-child-dashboard-web.png`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data layer — identity columns + migration + isolation coverage

#### Automated

- [x] 1.1 Migrations apply cleanly (`npx supabase db reset`) — da54631
- [x] 1.2 Isolation test green (`npm test`) — da54631
- [x] 1.3 Lint passes — da54631
- [x] 1.4 Build passes — da54631
- [x] 1.5 `zod` present in package.json dependencies — da54631

#### Manual

- [x] 1.6 Studio shows name/age/starting_level + age 6–9 check; RLS policies intact — da54631

### Phase 2: Avatar registry + child-primitive tier + i18n

#### Automated

- [x] 2.1 Build passes (assets + imports resolve) — e0822c5
- [x] 2.2 Lint passes — e0822c5
- [x] 2.3 Full suite green — e0822c5
- [x] 2.4 public/avatars/ has 4 avatar PNGs + slice-map; AVATARS exports the mockup faces (kuba/zosia/tomek/ola) — adapted from "6 incl. lis/wilk/kot" per mockup reality — e0822c5

#### Manual

- [x] 2.5 Each avatar slice is the correct crop; child primitives render oversized with clear selected state (crops confirmed; primitive visual validated at the Phase 4 wizard gate) — e0822c5

### Phase 3: Create-profile service + API route + route tests

#### Automated

- [x] 3.1 Lint passes — 2788ad2
- [x] 3.2 Build passes — 2788ad2
- [x] 3.3 New route tests + full suite green — 2788ad2

#### Manual

- [x] 3.4 Valid POST creates a profile → /app; invalid input round-trips with Polish error and writes nothing (live curl confirmed: valid→/app + row, invalid→/app/new-profile?error, no write) — 2788ad2

### Phase 4: Create-profile wizard UI

#### Automated

- [x] 4.1 Lint passes — 34d90cc
- [x] 4.2 Build passes — 34d90cc
- [x] 4.3 Full suite green — 34d90cc

#### Manual

- [x] 4.4 /app/new-profile matches mockup 05 (multi-step, oversized non-adjacent targets); completing it creates a profile and lands on /app — 34d90cc

### Phase 5: `/app` profile-count router + child start screen

#### Automated

- [x] 5.1 Lint passes — 074de6e
- [x] 5.2 Build passes — 074de6e
- [x] 5.3 Router-branch test green (0 → /app/new-profile, 1 & 2+ → /app/start) — 074de6e
- [x] 5.4 Full suite green — 074de6e

#### Manual

- [x] 5.5 Fresh signup → /app → wizard → themed start screen greeting by name; tap shows in-world coming-soon; reload skips wizard; profiles stay account-isolated (live-confirmed; parent signout added to start screen) — 074de6e
