# Multi-Profile Picker (S-11) Implementation Plan

## Overview

Deliver roadmap **S-11** / the second half of **FR-002**: accounts with 2+ child profiles get a **profile-picker on launch** (single-profile accounts keep skipping it), the picked child becomes the **active profile** for the child-facing pages via an HttpOnly session cookie, and a parent can finally **add a second child** (picker tile + parent-panel link) under a soft cap. No database migration.

## Current State Analysis

Verified by two research passes (archive + code trace):

- **The router choke point exists and names this slice.** `src/pages/app.astro:15-16` branches via `resolveLandingPath` (`src/lib/services/child-profiles.ts:71-73`): 0 → `/app/new-profile`, 1+ → `/app/start`; the docstring and `tests/app-router.test.ts:46-56` explicitly defer the ≥2 picker branch to this change.
- **No active-profile mechanism exists** — no cookie, param, or session field. Three SSR pages each hard-load the newest profile via `getMostRecentProfile` (`start.astro:22`, `task.astro:19-20`, `upgrades.astro:20`), so a 2-child account always plays as the newest child. The write APIs are already `profileId`-parameterized and RLS-verified (`recordShiftResult` `child-profiles.ts:132`, `buyUpgrade` `:190`) — only SSR reads hardcode "most recent". `report.astro` is already multi-profile aware (lists all).
- **The picker's building blocks are shipped**: `listChildProfiles` (`child-profiles.ts:82-85`, isolation-tested via `tests/report-isolation.test.ts:68`), `SelectTile` with `shape="circle"` avatar mode (`SelectTile.tsx:20-49` — the wizard's avatar row is essentially a picker already), and the start screen's avatar+name greeting pattern (`start.astro:24-26,73-85`).
- **Adding a 2nd profile already works, blind.** `/api/profiles/create` has no count check and `/app/new-profile` doesn't check count — direct URL navigation creates an Nth profile today; there is simply no UI entry point (the only links are 0-profile fallbacks). No cap exists in PRD or DB; **avatars are not unique per account**, so a picker must show names, not avatars alone.
- **Deferral history is consistent** (S-01 research/plan, four archives): build the count-router first, picker UI + 2nd-profile entry + selection mechanism later. Older docs call this slice "S-07" — same thing, renumbered S-11.

## Desired End State

A parent with two children signs in: the launch router lands on `/app/pick-profile`, showing one oversized avatar+name tile per child (RLS-scoped — only their own). Tapping a child sets the active-profile cookie and lands on that child's start screen; start/task/upgrades all follow the selection. A fresh browser session shows the picker again (FR-002 "on launch"); a "change player" entry on the start screen allows mid-session handoff. Single-profile accounts never see the picker. The picker's "+ add profile" tile (and a parent-panel link) leads to the existing wizard; the create route refuses profiles beyond a soft cap of 6. Verify: router unit tests cover 0/1/2+ × selection; integration tests prove a forged/stale cookie falls back safely and account B can never select or see A's profiles; `check`/`lint`/`build` and the full suite green against a fresh DB.

### Key Discoveries:

- `resolveLandingPath` is called only by `app.astro` (+ tests) — a signature widening is contained (`child-profiles.ts:71`).
- The select action can mirror `create.ts`'s pattern exactly: zod-validated native form POST, ownership verified by an RLS-scoped `.eq("id", …)` read, redirect on success (`api/profiles/create.ts:19-63`).
- The `parent_verified` cookie machinery (`parent-pin.ts`) shows the house style for a signed/validated cookie; the active-profile cookie is simpler (the value is re-verified against RLS on every read, so no signature is needed — a forged id yields zero rows).
- `SCATTER`-style layout isn't needed: with ≤6 profiles the picker is a single column/grid of `SelectTile`-sized cards.

## What We're NOT Doing

- **No picker mockup fidelity work** — no dedicated mockup exists (checked all asset sets); the screen follows shipped child-surface primitives. Visual polish is S-13.
- **No PIN gate on adding profiles** — the wizard stays un-gated as shipped in S-01; the cap bounds abuse (decided in planning).
- **No profile deletion/editing** — out of FR-002's scope; junk profiles are bounded by the cap, cleanup is a future slice.
- **No DB migration** — the cap is route-level (no count trigger); the cookie is transient; no schema change.
- **No persistent "remember last child" across launches** — FR-002 semantics chosen: picker on every fresh session (session cookie).
- **No avatar-uniqueness enforcement** — two children may share an avatar; the picker disambiguates by name.
- **No change to the report page** (already multi-profile) or to the write APIs (already profileId-parameterized).

## Implementation Approach

Two phases, each shippable. **Phase 1** lands the coherent behavioral unit in one stroke — selection service + cookie, picker page + select route, router branch, and the three page swaps — because a picker that sets a cookie nothing reads (or pages that read a cookie nothing sets) is a broken intermediate. Single-profile accounts' behavior is provably unchanged (their pages resolve exactly as today). **Phase 2** adds the entry points (picker add-tile, parent-panel link, start-screen switch) and the soft cap, completing the S-11 outcome.

## Critical Implementation Details

- **The cookie is a pointer, not a credential.** `active_profile` stores only a profile id; every consumer re-resolves it through the caller's RLS-scoped client (`.eq("id", cookieId)`), so a forged or stale id yields zero rows → fallback, never cross-account data. No signing needed (unlike `parent_verified`, which gates authority; this only selects among rows the account can already read).
- **Fallback ladder must terminate.** Page resolution: valid cookie → that profile; else exactly 1 profile → it (single-profile accounts never bounce through the picker); else redirect `/app`, whose router sends 2+ to the picker and 0 to the wizard. The picker page itself must NOT redirect through this ladder (it lists, it doesn't resolve) or a stale cookie could loop.
- **Router needs the selection signal.** After picking, `/app` must land on `/app/start`, not re-show the picker — `resolveLandingPath` takes whether a *valid* selection exists (validated before the call, not trusted from the raw cookie).
- **Session cookie semantics** = no `maxAge`/`expires` (browser-session lifetime), `httpOnly`, `sameSite: "lax"`, `path: "/"` — matches FR-002's picker-on-launch reading chosen in planning.

## Phase 1: Scoped picker + active-profile selection

### Overview

Introduce the active-profile cookie and RLS-backed resolution, the `/app/pick-profile` page and select action, the router's ≥2 branch, and switch the three child pages from "most recent" to "selected" — one coherent, shippable unit. Single-profile accounts behave exactly as today.

### Changes Required:

#### 1. Active-profile service + cookie helpers

**File**: `src/lib/services/child-profiles.ts` (or a small sibling `active-profile.ts` if it reads cleaner)

**Intent**: One source of truth for reading/writing the selection and resolving it safely against RLS.

**Contract**: Exported cookie-name constant (e.g. `ACTIVE_PROFILE_COOKIE`). `resolveActiveProfile(client, cookies): Promise<ChildProfile | null>` — reads the cookie, fetches by id through the RLS-scoped client, returns the row or null (missing/forged/stale/other-account ids all resolve to null). A setter used by the select route applies the session-cookie attributes from Critical Implementation Details. `resolveLandingPath` widens to `(count: number, hasSelection: boolean)`: `0 → /app/new-profile`; `1 → /app/start`; `≥2 → hasSelection ? /app/start : /app/pick-profile`. Update the S-07-era docstrings.

#### 2. Launch router branch

**File**: `src/pages/app.astro`

**Intent**: Land 2+ accounts without a valid selection on the picker; everyone else exactly as today.

**Contract**: Resolve the active profile (service §1) before calling `resolveLandingPath(count, activeProfile !== null)`; redirect to its result. Stale/forged cookies simply resolve to no selection.

#### 3. Picker page

**File**: `src/pages/app/pick-profile.astro` (+ a small `.tsx` island only if selection needs client state — a plain form-per-tile page should suffice)

**Intent**: FR-002's picker: one oversized tile per child (avatar image + name — names required since avatars can repeat), RLS-scoped to the account.

**Contract**: SSR page under the existing auth middleware. Loads `listChildProfiles`; renders one native form POST per profile to the select route (§4) styled to `SelectTile`/`ChildButton` tap-target standards; 0 profiles → redirect `/app`; 1 profile → redirect `/app/start` (defensive — router normally prevents this); copy from a new `t.picker` block (L-003). Does not read the active-profile cookie (no resolution ladder — see Critical Implementation Details).

#### 4. Select action

**File**: `src/pages/api/profiles/select.ts`

**Intent**: Set the selection server-side after proving ownership.

**Contract**: `POST`, `prerender = false`, zod-validated `profileId` (uuid). Ownership check = RLS-scoped fetch by id; found → set the session cookie, redirect `/app/start`; not found → redirect `/app/pick-profile` (no error leak about foreign ids). Mirrors `create.ts`'s native-form + redirect pattern.

#### 5. Thread the selection through the child pages

**File**: `src/pages/app/start.astro`, `src/pages/app/task.astro`, `src/pages/app/upgrades.astro`

**Intent**: The pages follow the picked child instead of silently showing the newest one.

**Contract**: Each replaces `getMostRecentProfile` with the fallback ladder: `resolveActiveProfile` → else if exactly 1 profile, that profile (today's behavior) → else redirect `/app`. The 0-profile inline CTA cards on start/upgrades stay as-is. No change to what the pages render once a profile is in hand.

#### 6. Polish copy

**File**: `src/i18n/pl.ts`

**Intent**: Picker copy (L-003), warm and child-first.

**Contract**: New `t.picker` block — heading (e.g. "Kto dziś prowadzi sklep?"), per-tile accessible label, and (Phase 2 will extend it with the add-tile/switch strings). Draft Polish, pending native review.

#### 7. Router + selection tests

**File**: `tests/app-router.test.ts`, `tests/active-profile.test.ts` (new)

**Intent**: Pin the widened router and the cookie's safety properties with the established patterns.

**Contract**: `app-router.test.ts` — `resolveLandingPath` matrix: 0/1 unchanged; `(2, false) → /app/pick-profile`; `(2, true) → /app/start` (replaces the "picker is S-07" expectation). `active-profile.test.ts` (integration, helpers/supabase): account A with two profiles — valid cookie id resolves to that profile; a **forged id belonging to account B resolves to null** (isolation re-exercised at the selection seam); a random/stale uuid resolves to null; the select route's ownership check refuses B's profile id for A. Deterministic via provisioned accounts; teardown per helper conventions.

### Success Criteria:

#### Automated Verification:

- Unit + integration tests pass: `npx vitest run tests/app-router.test.ts tests/active-profile.test.ts`
- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- Full suite passes against a fresh DB (`npx supabase db reset` + `npx vitest run`)

#### Manual Verification:

- A 2-child account lands on the picker at launch; tapping a child lands on that child's start screen; task + shop follow the same child
- A fresh browser session shows the picker again; a single-profile account never sees it
- Tiles are oversized and comfortably tappable; names disambiguate same-avatar children
- No inline literals in the new/edited surfaces (L-003)

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: Add-a-child, switching & cap

### Overview

Complete the S-11 outcome: the one-tap add-a-second-child entry (picker tile + parent-panel link), the start-screen "change player" entry for mid-session handoff, and the soft profile cap.

### Changes Required:

#### 1. Soft cap in the create route

**File**: `src/pages/api/profiles/create.ts`

**Intent**: Bound junk-profile accumulation now that a child-reachable add entry exists.

**Contract**: Exported tunable `MAX_PROFILES_PER_ACCOUNT = 6`. Before insert, count the account's profiles (RLS-scoped); at/over the cap → redirect to `/app/new-profile?error=…` with a new zod-style error key (existing error-bounce pattern). Route-level only — no migration.

#### 2. Add-profile tile on the picker

**File**: `src/pages/app/pick-profile.astro`, `src/i18n/pl.ts`

**Intent**: The roadmap's one-tap "add another child" where profiles already live.

**Contract**: A "+ Dodaj profil" tile after the child tiles linking `/app/new-profile`, hidden when the account is at `MAX_PROFILES_PER_ACCOUNT`. Copy in `t.picker`.

#### 3. Parent-panel link

**File**: `src/pages/app/report.astro` (or its surrounding panel chrome), `src/i18n/pl.ts`

**Intent**: Parents also find "add a child" in their own PIN-gated panel.

**Contract**: A link to `/app/new-profile` alongside the report (respecting the cap — hidden at max). Copy via `t.report` or `t.picker`, no inline literals.

#### 4. Start-screen switch entry

**File**: `src/pages/app/start.astro`, `src/i18n/pl.ts`

**Intent**: Mid-session sibling handoff without killing the browser session.

**Contract**: When the account has 2+ profiles, a small "Zmień gracza"-style link near the greeting navigates to `/app/pick-profile`. Hidden for single-profile accounts. The picker overwrites the cookie on the next selection (no clearing step needed).

#### 5. Wizard second-profile sanity

**File**: `src/pages/app/new-profile.astro`

**Intent**: The wizard is now legitimately reachable with existing profiles; make sure nothing in it assumes first-profile-ever.

**Contract**: Verify (and adjust only if needed) that the page renders correctly for an account with existing profiles and that post-create redirect to `/app` behaves: the new child has no selection cookie conflict (create may either clear/overwrite the cookie to the new profile or leave the router to re-pick — pick whichever needs less code, but state it in the implementation).

#### 6. Cap + entry tests

**File**: `tests/profiles-create.test.ts`

**Intent**: Lock the cap and the legit second-profile path.

**Contract**: A second profile for the same account creates fine (route-level); at `MAX_PROFILES_PER_ACCOUNT` the route refuses with the error redirect and (L-002) a service-role check confirms no row was written past the cap.

### Success Criteria:

#### Automated Verification:

- Tests pass: `npx vitest run tests/profiles-create.test.ts tests/app-router.test.ts tests/active-profile.test.ts`
- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- Full suite passes against a fresh DB (`npx supabase db reset` + `npx vitest run`)

#### Manual Verification:

- From the picker, "+ Dodaj profil" walks through the wizard; the new child appears on the picker; the flow lands on the new child's start screen
- The add tile disappears at 6 profiles; the create route refuses a 7th
- The parent panel shows the add link; the start screen shows "change player" only for 2+ accounts and it returns to the picker
- Ages 6–9 play flows unchanged for the selected child; copy is Polish, warm, no inline literals (L-003)

**Implementation Note**: Final phase — after verification, S-11 is complete (archive via `/10x-archive`).

---

## Testing Strategy

### Unit Tests:

- `resolveLandingPath` matrix over count × hasSelection (0, 1, 2+ × true/false).

### Integration Tests (local Supabase stack):

- `tests/active-profile.test.ts`: valid/forged/stale cookie resolution; select-route ownership refusal for another account's profile id — the isolation contract re-exercised at the new seam (L-001/L-002 conventions, existing helpers).
- `tests/profiles-create.test.ts`: second profile allowed; cap refusal with durable-state check.
- Full suite against a fresh DB at each phase end.

### Manual Testing Steps:

1. Two-child account: launch → picker → pick child A → start/task/shop all follow A; new browser session → picker again.
2. Single-child account: launch → straight to start; no picker, no switch link.
3. Same avatar on both children: picker tiles distinguishable by name.
4. Add flow from picker tile and from parent panel; cap at 6 hides the tile and the route refuses.
5. Mid-session switch via the start-screen entry; the other child's wallet/shop/skills appear (per-profile isolation intact).

## Performance Considerations

One extra RLS-scoped select per child-page request (cookie resolution) — same query class the pages already run; no new indexes needed (`child_profiles` pk lookup).

## Migration Notes

**No migration.** The cookie is transient; the cap is route-level; existing accounts see the picker automatically at their next launch if they already have 2+ profiles (created via direct URL) — that's the intended FR-002 behavior, not a regression.

## References

- Roadmap: `context/foundation/roadmap.md` §S-11; PRD: `context/foundation/prd-v3.md:143` (FR-002)
- Deferral history: `context/archive/2026-06-26-parent-signup-first-profile-and-start-screen/research.md:41,112`, `context/archive/2026-06-28-first-child-profile-and-start-screen/plan.md:5,31,269`
- Router seam: `src/pages/app.astro:15-16`, `src/lib/services/child-profiles.ts:60-85`
- Patterns: `src/pages/api/profiles/create.ts` (form POST + redirect), `src/lib/services/parent-pin.ts` (cookie house style), `src/components/child/SelectTile.tsx`
- Tests to extend: `tests/app-router.test.ts:31-56`, `tests/profiles-create.test.ts`, helpers in `tests/helpers/supabase.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Scoped picker + active-profile selection

#### Automated

- [x] 1.1 Unit + integration tests pass: `npx vitest run tests/app-router.test.ts tests/active-profile.test.ts` — af1fb26
- [x] 1.2 Type checking passes: `npm run check` — af1fb26
- [x] 1.3 Linting passes: `npm run lint` — af1fb26
- [x] 1.4 Build succeeds: `npm run build` — af1fb26
- [x] 1.5 Full suite passes against a fresh DB (`supabase db reset` + `vitest run`) — af1fb26

#### Manual

- [x] 1.6 2-child account: picker on launch; picked child followed by start/task/shop — af1fb26
- [x] 1.7 Fresh session shows picker again; single-profile account never sees it — af1fb26
- [x] 1.8 Tiles oversized + tappable; names disambiguate same-avatar children — af1fb26
- [x] 1.9 No inline literals in new/edited surfaces (L-003) — af1fb26

### Phase 2: Add-a-child, switching & cap

#### Automated

- [x] 2.1 Tests pass: `npx vitest run tests/profiles-create.test.ts tests/app-router.test.ts tests/active-profile.test.ts`
- [x] 2.2 Type checking passes: `npm run check`
- [x] 2.3 Linting passes: `npm run lint`
- [x] 2.4 Build succeeds: `npm run build`
- [x] 2.5 Full suite passes against a fresh DB (`supabase db reset` + `vitest run`)

#### Manual

- [x] 2.6 Add flow works from picker tile and parent panel; new child lands selected
- [x] 2.7 Cap at 6: tile hidden, route refuses a 7th
- [x] 2.8 Start-screen switch entry only for 2+ accounts; returns to picker
- [x] 2.9 Copy Polish/warm; no inline literals (L-003)
