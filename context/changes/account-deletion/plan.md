# Account Deletion (Child Profile + Parent Account, GDPR Erasure) Implementation Plan

## Overview

Give parents two irreversible, PIN-gated deletion capabilities on the report page: delete a single child profile (RLS delete; shift history cascades) and delete the whole parent account (service-role `auth.admin.deleteUser`; everything cascades — true GDPR erasure). Both use typed-confirmation dialogs; account deletion additionally demands fresh PIN entry. Closes Linear MAT-17 / GitHub #17. This is the "cleanup is a future slice" promised by the archived multi-profile-picker plan, and a deliberate expansion of the PRD's parent-surface non-goal (recorded below).

## Current State Analysis

From `research.md` (2026-07-11, file:line-verified):

- **DB layer is deletion-ready, zero blockers**: every FK is `ON DELETE CASCADE` (deliberate F-01 right-to-erasure decision); all three tables have `*_delete_own` policies on `auth.uid() = account_id`; no deletion-hostile triggers. Cascade graph: auth user → everything (incl. `auth.sessions`); profile → its `shift_log` rows only.
- **No deletion path exists anywhere in `src/`**; no service-role usage in `src/` (tests only: `tests/helpers/supabase.ts:33-35,63-65` — the admin-client pattern to productionize). No confirmation-dialog component exists (first one lands here).
- **Gate machinery exists**: `parent_verified` HMAC marker (15-min TTL) + scrypt PIN with atomic 5-attempt/60s throttle (`src/lib/services/parent-pin.ts`); binding lesson from the PIN impl-review: destructive mutations must be marker-gated (`api/parent/pin/set.ts:31-34` is the template).
- **Profile lifecycle degrades gracefully**: stale `active_profile` cookie is ignored (resolution happens inside the RLS-owned list, `active-profile.ts:56-65`); 0-profile state routes to the wizard and renders `EmptyStateCard` — deleting the last profile needs no routing work.
- **Route templates**: `buy.ts` (RLS-ownership-first, nothing trust-bearing from the client), `pin/verify.ts`/`set.ts` (JSON + zod + `applyNoStore` + status vocabulary 503/401/403/400/404/429/500), `signout.ts:9-24` (cleanup trio: `signOut()` + delete `active_profile` + `parent_verified`).
- **Test gap**: DELETE coverage is negative-only (cross-account blocked); nothing proves a same-account delete succeeds and cascades.
- **Prod gap discovered**: `PARENT_SESSION_SECRET` is not in the Vercel env (only `SUPABASE_URL`/`SUPABASE_KEY`, verified 2026-07-09) — markers can't be minted in production today; this feature's gate depends on it. Phase 3 fixes it.
- Child rows carry real PII (`name`, `age` — deliberate S-01b override recorded in `contract-surfaces.md:11`), strengthening the erasure case.

## Desired End State

On `/app/report` (behind the existing PIN gate), each child card has a "Usuń profil" action opening a dialog that requires typing the child's name; confirming deletes the profile and its shift history, frees a cap slot, and the app degrades gracefully (picker/sole-profile/wizard). Below the cards, a visually distinct danger zone offers "Usuń konto" — a dialog requiring the account email typed **and** the parent PIN entered fresh; confirming erases the auth user and every owned row, signs the browser out, and lands on `/` with a Polish farewell notice. Cross-account deletion remains impossible, proven by tests that check durable state via service-role read-back (L-002).

### Key Discoveries:

- `deleteUser` + cascade is already proven end-to-end by every test teardown (`tests/helpers/supabase.ts:63-65`) — phase 2 productionizes a working mechanism, not a hypothesis.
- The admin client must be plain `@supabase/supabase-js` `createClient` with `{ autoRefreshToken: false, persistSession: false }` — never `createServerClient` (no cookie contact).
- Middleware handles deleted-user stale cookies with a clean 303 (destructures `user`, ignores `error` — `middleware.ts:26-46`) but never clears cookies; the deletion route must do its own signout-style cleanup.
- `MAX_PROFILES_PER_ACCOUNT = 6` add-tile visibility is computed per-render — deletion frees slots with no extra work.
- FK cascades bypass RLS (FK machinery), so the profile delete needs only the one `child_profiles` DELETE under RLS.

## What We're NOT Doing

- **No soft delete / undo / grace period** (decided: hard delete). The F-01 record already accepts "irreversible per delete"; the typed confirmation carries the safety.
- **No data export (GDPR portability)** — separate future change.
- **No forgot-PIN recovery flow** — pre-existing gap, out of scope (noted: a parent who forgot the PIN cannot delete via UI; support path = Supabase dashboard).
- **No profile *editing*** (rename/re-avatar) — deletion only.
- **No new `/app/settings` page** (decided: report-page placement) and no other settings-UI expansion beyond these two actions.
- **No password re-verification** for account deletion (decided: fresh PIN is the bar; `signInWithPassword`'s token side effects avoided).
- **No DB migration** — schema untouched; no new tables, so no new RLS/contract-surfaces *table* entries (the reference docs get a surface note only).
- **No admin/support tooling, no audit log.**

## Implementation Approach

Phase 1 ships profile deletion end-to-end using only existing privileges (RLS client) — the TDD-friendly half with the clearest contracts. Phase 2 introduces the service-role plane behind a strict two-client discipline (RLS client establishes identity; admin client performs exactly one `deleteUser(user.id)` with the id from the session, never the request) and reuses phase 1's dialog. Phase 3 is the ops runbook: Vercel secrets (Production-scoped service key + the missing `PARENT_SESSION_SECRET`), deploy, production proof with a throwaway account. PRD delta (settings-UI non-goal override) is recorded here, per the maintainer's MAT-17 decision.

## Critical Implementation Details

- **Two privilege planes, strictly ordered (phase 2)**: 503 no-client → 401 no-user (RLS `getUser()`) → 403 no-marker (`verifyMarker`) → 400 zod → 401/423-style wrong-PIN (reuse `verifyPin`'s throttle + its 429 lockout vocabulary from `pin/verify.ts`) → typed-email mismatch 400 → only then `admin.auth.admin.deleteUser(user.id)`. The admin client never reads, never takes request-body ids.
- **Cleanup ordering (phase 2)**: delete the auth user first, then best-effort `supabase.auth.signOut()` (may error — the user is gone; ignore), then `clearAuthCookies` + delete `active_profile` + `parent_verified`, then JSON `{ ok: true }`; the island redirects to `/?deleted=1` (interstitial copy on the landing page is additive-key only). Cookies must be cleared even though middleware would redirect anyway — stale `sb-*` cookies otherwise linger for the browser session.
- **Profile-delete cookie touch (phase 1)**: after a successful delete, if the `active_profile` cookie equals the deleted id, delete the cookie in the same response — the silent-degrade would handle it, but leaving a known-dead pointer is avoidable hygiene.
- **Marker semantics on report actions**: the report page already redirects without a valid marker, but the API routes must re-verify the marker themselves (middleware doesn't; a fetch from a stale tab must 403, not act).
- **Testing `astro:env/server` routes**: existing route tests already exercise routes that import from `astro:env/server` under vitest — follow whatever mechanism `tests/auth-routes.test.ts`/`auth-env-missing.test.ts` use (env mapping/mocking); the admin factory must be mockable the same way for the "key absent → 503" branch.
- **Typed confirmation is client-side UX, server-side contract**: the profile route takes the profile id only (ownership via RLS read-then-delete or delete-with-count); the account route takes `pin` + `email` — the server re-checks `email === user.email` (cheap defense-in-depth; the real gates are marker + PIN).

## Phase 1: Child-profile deletion end-to-end

### Overview

The full profile-deletion slice: service function, marker-gated API route, the repo's first confirmation dialog, report-card actions, Polish copy, and the positive-deletion test coverage that today doesn't exist. TDD-friendly: contracts first (tests red), then service/route (green), then UI.

### Changes Required:

#### 1. Service function

**File**: `src/lib/services/child-profiles.ts`

**Intent**: `deleteChildProfile(supabase, profileId)` — delete one owned profile under RLS; distinguish "deleted" from "not-found" (non-owned rows are invisible under RLS, so a cross-account attempt reads as not-found, matching `buyUpgrade`'s vocabulary).

**Contract**: Takes the request-scoped RLS client first (service convention); returns a discriminated result (`ok` / `not-found` / `error`). Uses delete-with-returned-count (or select-then-delete like `buyUpgrade:191-215`) so 0 affected rows → `not-found`. No admin client anywhere in this phase.

#### 2. API route

**File**: `src/pages/api/profiles/delete.ts` (new)

**Intent**: Marker-gated JSON POST performing the profile delete; the destructive-action gate lesson applied.

**Contract**: `prerender = false`; zod `{ profileId: uuid }`; status vocabulary per existing routes — 503 (no client), 401 (no user), 403 (no/invalid `verifyMarker`), 400 (zod), 404 (`not-found` from service), 500 (service error), 200 `{ ok: true }`. All responses through `applyNoStore`. On success, if the `active_profile` cookie matches the deleted id, delete the cookie. Modeled on `pin/set.ts` (gate) + `buy.ts` (ownership + JSON shape).

#### 3. Confirmation dialog primitive

**File**: `src/components/ui/alert-dialog.tsx` (via `npx shadcn@latest add alert-dialog`), `src/components/parent/ConfirmDeleteDialog.tsx` (new)

**Intent**: The repo's first destructive-confirmation dialog: consequences text, a typed-confirmation input (button disabled until the expected string matches), destructive-variant confirm button, busy/error states. Built once, parameterized for both phases (phase 2 adds a PIN field via a slot/prop).

**Contract**: Props: title/description/consequence copy keys, `expectedText` (child name / account email), optional extra field slot (phase 2's PIN input), `onConfirm` async callback returning an error message or null. All copy via `t.*` — no literals (L-003). Tap targets and calm tone per the app's child-adjacent design language; the dialog is parent-facing, so standard sizing is fine.

#### 4. Report-page wiring

**File**: `src/components/parent/WeeklyReport.tsx`, `src/pages/app/report.astro`, `src/i18n/pl.ts`

**Intent**: Per-child "Usuń profil" action on each ChildSection card opening the dialog (typed child-name); on success, refresh the report state (remove the card; if profiles hit 0, the existing "add child" affordance is the natural next step). New top-level `deletion:` i18n section (beside `parentPin:`) carrying all Polish copy for both phases, drafted with the "pending native-speaker review" note convention.

**Contract**: WeeklyReport stays an island; the action POSTs to `/api/profiles/delete` and handles 403 by redirecting to `/app/parent-pin` (stale marker path). No changes to report data fetching; card removal is local state + revalidation on next load. All new strings additive keys.

#### 5. Tests — the positive-deletion coverage

**File**: `tests/profile-deletion.test.ts` (new; request-level pattern of `tests/auth-routes.test.ts` + helpers)

**Intent**: Close the research-identified gap: prove deletion works, cascades, and stays isolated — with L-002 durable-state discipline.

**Contract**: (a) owner deletes own profile via the route → 200, profile row gone AND its `shift_log` rows gone (counts asserted via the service-role `admin` client read-back); (b) sibling profile + `account_settings` survive; (c) cross-account attempt via the route → 404 and the row durably remains (admin read-back); (d) no/invalid marker → 403 and row remains; (e) deleting the last profile succeeds (0-profile state is legal). Seed shift_log rows for the cascade assertion. Unique ids/emails per run (existing helper conventions).

#### 6. Docs registry note

**File**: `docs/reference/contract-surfaces.md`

**Intent**: Record the new deletion surfaces (routes + the positive-delete test file) under the existing table entries, per the registry's "surfaces" mandate — no table changes, so no new sections.

**Contract**: Prose additions only.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- Full suite passes against a fresh DB (`npx supabase db reset` + `npx vitest run`) including the new profile-deletion tests
- L-003 grep: no inline user-visible literals in new/edited components

#### Manual Verification:

- Full flow locally: set PIN → report → delete a child (typed name) → card gone; shift history gone (Studio check); cap slot freed (add tile reappears)
- Delete the last profile → app lands on the wizard/empty-state gracefully; stale `active_profile` cookie cleared
- Stale/no marker → the delete action bounces to the PIN gate; wrong typed name keeps the button disabled
- Dialog reads calmly in Polish; destructive styling on the confirm button only

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: Parent-account deletion end-to-end

### Overview

The service-role half: env schema + admin-client factory (first production service-role usage), the hardened `/api/account/delete` route (marker + fresh PIN + typed email), danger-zone UI reusing the phase-1 dialog, and full-cascade erasure tests.

### Changes Required:

#### 1. Env schema + admin-client factory

**File**: `astro.config.mjs`, `src/lib/supabase-admin.ts` (new)

**Intent**: Declare `SUPABASE_SERVICE_ROLE_KEY` (fourth `envField`, mirroring `PARENT_SESSION_SECRET`'s optional-with-comment pattern) and provide `createAdminClient()` — plain `@supabase/supabase-js` client with `{ autoRefreshToken: false, persistSession: false }`, returning null when the key or URL is unset (503 path). Doc comment states the discipline: this client exists for account deletion only; never use it to act as a user (RLS bypass).

**Contract**: Reads via `astro:env/server` only. No cookie adapter. Exported factory (not a module-level singleton) so tests can exercise the absent-key branch.

#### 2. Account-deletion route

**File**: `src/pages/api/account/delete.ts` (new)

**Intent**: The nuclear option, gated as decided: valid marker AND fresh PIN AND typed email, then exactly one admin operation with the session-derived id.

**Contract**: `prerender = false`; zod `{ pin: 4-6 digits, email: string }`. Order: 503 (no RLS client or no admin client) → 401 (no user) → 403 (no/invalid marker) → 400 (zod) → PIN check via the existing `verifyPin` (inherits scrypt + atomic throttle; map wrong-pin/locked to the same statuses `pin/verify.ts` uses, incl. 429 lockout) → 400 email mismatch (`email !== user.email`) → `admin.auth.admin.deleteUser(user.id)` → cleanup (best-effort `signOut()`, `clearAuthCookies`, delete `active_profile` + `parent_verified`) → 200 `{ ok: true }`. `applyNoStore` on everything. The request body never supplies an account id.

#### 3. Danger-zone UI

**File**: `src/pages/app/report.astro`, `src/components/parent/DeleteAccountSection.tsx` (new), `src/i18n/pl.ts`

**Intent**: A visually separated danger zone at the bottom of the report: consequences copy (all children's data, irreversible), the dialog from phase 1 extended with a PIN input, typed-email confirmation. On success, redirect to `/?deleted=1`; the landing page shows a one-line Polish farewell notice (additive key, only when the param is present).

**Contract**: Island POSTs to `/api/account/delete`; distinct error states for wrong PIN (with lockout copy reusing `parentPin` error map where sensible), email mismatch, and generic failure. `deletion:` i18n section from phase 1 carries the keys.

#### 4. Tests — full-cascade erasure

**File**: `tests/account-deletion.test.ts` (new)

**Intent**: Prove the whole point: one route call erases the account and every owned row, and none of the gates can be skipped.

**Contract**: Setup mints a user with PIN set (via the pin/set route or `hashPin` + direct insert with admin), profiles + shift_log rows seeded, marker signed with `signMarker` (test env has `PARENT_SESSION_SECRET`). Assert: (a) happy path → 200; auth user gone (`admin.auth.admin.getUserById` → null/error), zero rows in all three tables for that account (admin read-back — L-002); (b) wrong PIN → error status, user + rows remain, `failed_attempts` incremented (throttle live); (c) missing marker → 403, everything remains; (d) email mismatch → 400, everything remains; (e) a second account is untouched throughout (cross-account invariant). Absent-key branch: factory returns null → route 503 (env-mock pattern of `auth-env-missing.test.ts`).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- Full suite passes against a fresh DB (`npx supabase db reset` + `npx vitest run`) including the new account-deletion tests
- L-003 grep clean on new/edited files

#### Manual Verification:

- Full local flow: set PIN → report → danger zone → dialog demands typed email + PIN → wrong PIN shows throttle-aware error → correct everything → signed out on `/` with farewell notice; Studio shows auth user and all rows gone
- Stale marker → 403 path bounces to PIN gate; browser back after deletion → clean redirect to signin (no 500, no stale session)
- Second local account's data untouched (spot-check)

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Ops + production proof

### Overview

Wire the production secrets (human-gated), deploy, prove the flows against production with a throwaway account, close the trackers. No repo changes expected beyond bookkeeping.

### Changes Required:

#### 1. Vercel env (manual, maintainer-gated)

**File**: none (runbook step)

**Intent**: Add the two missing production secrets: `SUPABASE_SERVICE_ROLE_KEY` (from Supabase dashboard → Settings → API; **Production scope ONLY** per `infrastructure.md:82`) and `PARENT_SESSION_SECRET` (generate a strong random value, e.g. `openssl rand -hex 32`; Production scope; note that this first enables the PIN gate in prod at all — pre-existing gap). Neither value enters the repo or the chat; `vercel env add <NAME> production` run interactively.

**Contract**: `vercel env ls` shows both names Production-scoped; values never echoed.

#### 2. Deploy + production verification

**File**: none (runbook step); Linear MAT-17 / GitHub #17 on success

**Intent**: Deploy current main (preview → promote per the human-gate convention), then with a throwaway account (fresh +suffix email): sign up, confirm email, create 2 profiles, play a shift, set PIN, delete one profile (verify report + Studio), then delete the account (verify signed-out landing, auth user gone in the dashboard, zero rows in all three tables). Close MAT-17 and #17 with the outcome.

**Contract**: All checks pass against https://mathshop.vercel.app; the throwaway account's erasure doubles as production cleanup.

### Success Criteria:

#### Manual Verification:

- Both secrets present in Vercel (Production scope only); no secret values in repo/chat/transcript
- Production deploy green; PIN gate works in prod (marker minting live — previously impossible)
- Production profile deletion verified (report + dashboard)
- Production account deletion verified (signed out, auth user + all rows gone)
- MAT-17 Done + GitHub #17 closed with outcome

**Implementation Note**: Final phase — after verification, review via `/10x-impl-review`, then archive via `/10x-archive`.

---

## Testing Strategy

### Unit/Integration Tests:

- Two new request-level test files (profile-deletion, account-deletion) with L-002 durable-state assertions via the admin client; the existing 204-test suite guards everything else.
- Existing negative DELETE-isolation tests remain untouched and must stay green (test-plan Risk #1 invariant).

### Manual Testing Steps:

1. Phase 1: local profile-delete flow incl. last-profile, cap-slot, stale-marker, and typed-name-mismatch paths.
2. Phase 2: local account-delete flow incl. wrong-PIN throttle, email mismatch, post-deletion navigation.
3. Phase 3: full production proof with a throwaway account.

## Performance Considerations

None material — deletions are single-row (+ cascade) operations on tiny tables; the admin client is constructed per-request in one route.

## Migration Notes

No schema changes. Rollback = revert commits (UI/routes disappear; no data shape changed). Deletions themselves are irreversible by design — that is the feature.

## References

- Research: `context/changes/account-deletion/research.md` (authoritative: cascade graph, gate mechanics, templates, GoTrue semantics)
- Change brief: `context/changes/account-deletion/change.md` (Linear MAT-17 / GitHub #17)
- Gate template: `src/pages/api/parent/pin/set.ts:31-34`; ownership template: `src/pages/api/upgrades/buy.ts`; cleanup template: `src/pages/api/auth/signout.ts:9-24`
- Admin pattern: `tests/helpers/supabase.ts:33-35,63-65`
- Binding rules: `docs/reference/rls-isolation.md`, `context/foundation/lessons.md` (L-001/L-002/L-003), `context/foundation/test-plan.md:60`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Child-profile deletion end-to-end

#### Automated

- [x] 1.1 Type checking passes: `npm run check` — 26dd33e
- [x] 1.2 Linting passes: `npm run lint` — 26dd33e
- [x] 1.3 Build succeeds: `npm run build` — 26dd33e
- [x] 1.4 Full suite passes against a fresh DB incl. new profile-deletion tests — 26dd33e
- [x] 1.5 L-003 grep clean on new/edited components — 26dd33e

#### Manual

- [x] 1.6 Local flow: PIN → report → typed-name delete → card + shift history gone; cap slot freed — 26dd33e
- [x] 1.7 Last-profile delete degrades to wizard/empty-state; active_profile cookie cleared — 26dd33e
- [x] 1.8 Stale/no marker bounces to PIN gate; wrong typed name keeps button disabled — 26dd33e
- [x] 1.9 Dialog calm/Polish; destructive styling on confirm only — 26dd33e

### Phase 2: Parent-account deletion end-to-end

#### Automated

- [x] 2.1 Type checking passes: `npm run check`
- [x] 2.2 Linting passes: `npm run lint`
- [x] 2.3 Build succeeds: `npm run build`
- [x] 2.4 Full suite passes against a fresh DB incl. new account-deletion tests
- [x] 2.5 L-003 grep clean on new/edited files

#### Manual

- [x] 2.6 Local flow: danger zone → typed email + fresh PIN → signed out with farewell; Studio shows full erasure
- [x] 2.7 Wrong PIN throttled; stale marker 403s; back-button post-deletion is clean
- [x] 2.8 Second local account untouched

### Phase 3: Ops + production proof

#### Manual

- [ ] 3.1 SUPABASE_SERVICE_ROLE_KEY + PARENT_SESSION_SECRET in Vercel (Production scope only); no secrets leaked
- [ ] 3.2 Production deploy green; PIN gate works in prod
- [ ] 3.3 Production profile deletion verified
- [ ] 3.4 Production account deletion verified (auth user + all rows gone)
- [ ] 3.5 MAT-17 Done + GitHub #17 closed with outcome
