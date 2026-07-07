# Cross-Device Economy Restore (S-10) — Verify & Harden Implementation Plan

## Overview

Close roadmap **S-10** (FR-001/FR-005/FR-012) by **proving** the cross-device restore that is already true by construction — and hardening the two shared-device residue gaps the frame surfaced. Per `frame.md`: the restore mechanism needs zero code (all state server-side, RLS-scoped, loaded per request, zero client persistence); what's missing is the two-session proof through the RLS layer, plus signout leaving the `parent_verified` marker alive and the absent bfcache guard. No database migration.

## Current State Analysis

From `frame.md` (hypothesis investigation, file:line-verified):

- **Client-state divergence: NONE.** Zero storage APIs anywhere in `src/`; no service worker; no module-level caches; islands hold request-scoped state seeded from SSR props and apply the *server's* returned values on mutation (`UpgradeShop.tsx:46-47,72-74`). Device 2 cannot durably diverge from the DB.
- **The false-green test gap.** Cross-account economy isolation is well covered (incl. `wallet_balance`, `child-profiles-isolation.test.ts:115-135`), but every *durability* read in the suite uses the RLS-bypassing `admin` client (`shifts-complete.test.ts:65`, `upgrades-buy.test.ts:111-113`) — proving writes persist, never that a **fresh session of the same account reads them back through RLS**. `test-plan.md` Risk #2 explicitly demands "durably readable on a fresh fetch in a new session" — unimplemented.
- **Shared-device residue (two gaps).** Signout clears auth cookies + `active_profile` but not `parent_verified` (`signout.ts` vs `parent-pin.ts:167`) — account-bound HMAC makes it harmless cross-account, but the *same* account re-signing-in within the 15-min TTL re-enters `/app/report` without the PIN. And no `pageshow`/bfcache handling exists: Safari can restore A's last-rendered `/app/report`/`/app/start` from memory after logout despite `no-store` (Chrome/Firefox are covered only by accident via cookie-change eviction).
- **Cache headers are complete** (`middleware.ts:18-24` + per-route `applyNoStore`); session gating is tested (`auth-session-gating.test.ts`); test infrastructure is ready (`helpers/supabase.ts` mints sessions; `helpers/astro.ts` drives real routes with a cookie jar).

## Desired End State

An automated test proves S-10's sentence end-to-end: economy state written through the real production routes by one session is read back **identically** by a second, fresh session of the same account through RLS — and a fresh session of another account sees none of it. Signout leaves no `parent_verified` marker; a bfcache-restored page reloads itself through the server. One manual two-device walkthrough (plus the logout/back-button check) confirms the feel. Verify: new tests green against a fresh DB; `check`/`lint`/`build` green; full suite green; S-10 then closes on the roadmap via `/10x-archive`.

### Key Discoveries:

- A "second device" is, to the server, exactly a second `signInWithPassword` session — `createSignedInUser` already builds one; a second client for the *same* email is a two-line variant.
- The write path is fully drivable in tests: `mintSession` (jar) → `POST /api/shifts/complete` and `/api/upgrades/buy` via `buildContext` — the exact production chain (zod, session derivation, server recompute).
- The S-11 review already established the signout-clears-cookie pattern (`active_profile`); `parent_verified` follows it identically, and the jar makes it assertable.
- `Layout.astro` is the single wrapper every page renders through — one inline `pageshow` script covers every account surface.

## What We're NOT Doing

- **No restore-mechanism code** — nothing about how state is stored or loaded changes; the frame proved there is nothing to build there.
- **No Clear-Site-Data header** — patchy Safari support misses exactly the browser that needs it (decided in planning; the `pageshow` guard is the portable fix).
- **No realtime/live sync across simultaneously-open devices** — an already-open tab going stale after a mutation elsewhere is normal SSR-snapshot behavior, out of FR scope.
- **No PIN/GDPR/session-revocation rework** — only the signout cookie clearing; the marker's HMAC/TTL design is untouched.
- **No E2E/browser test harness** — the bfcache guard is verified manually (devtools/Safari), consistent with the repo's node-only Vitest setup.

## Implementation Approach

Two small phases. **Phase 1** lands the load-bearing proof: a two-session restore-equivalence test driving the real routes in and a fresh RLS session out, with the cross-account negative alongside (the roadmap names that negative as the slice's highest-impact gate). **Phase 2** lands the two hygiene fixes with their assertions (signout marker clearing is jar-testable; the bfcache guard is manual) and the manual walkthrough that satisfies the slice's stated evidence bar.

## Critical Implementation Details

- **Second-session minting must not reuse the first client.** The point is independence: a brand-new `createClient` + `signInWithPassword` for the same email (fresh token set), never a shared client or jar — otherwise the test quietly degrades into a same-session read.
- **The `pageshow` guard keys on `event.persisted`.** Only bfcache restores reload (`if (event.persisted) location.reload()`); normal navigations are untouched. Inline `<script>` in `Layout.astro` so it ships on every page without a bundle round-trip; a bfcache restore of a mid-shift page is safe to reload — leaving the shift already discards mid-shift state by design (FR-017).

## Phase 1: The cross-device proof

### Overview

The two-session restore-equivalence test that closes the admin-client false-green: real routes in, fresh RLS session out, cross-account negative alongside.

### Changes Required:

#### 1. Two-session restore-equivalence test

**File**: `tests/cross-device-restore.test.ts` (new)

**Intent**: Prove S-10's outcome at the seam `test-plan.md` Risk #2 names: state written by one session is readable, identical, by a fresh session of the same account through RLS — and invisible to a fresh session of another account.

**Contract**: Provision account A (+ profile) and account B. **Session 1** (`mintSession` jar): drive the real `POST /api/shifts/complete` (valid task/clean counts + skills delta) and `POST /api/upgrades/buy` (seed wallet sufficient for the cheapest upgrade via the shift payout or admin provisioning). **Session 2**: a brand-new signed-in client for the *same* email (fresh `createClient` + `signInWithPassword`); read the profile through it (RLS-scoped select) and assert `wallet_balance`, `shop_state.purchased`, `skill_state`, `business_level`, `completed_shift_count` all equal what session 1's route responses imply. **Cross-account negative**: a fresh session of account B reads zero of A's rows (profiles list empty of A's ids). During development, run the L-002 meta-check (temporarily weaken the SELECT policy → the equality read must fail) — verified, not committed. Teardown per helper conventions.

### Success Criteria:

#### Automated Verification:

- New test passes against a fresh DB: `npx supabase db reset` then `npx vitest run tests/cross-device-restore.test.ts`
- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Full suite passes: `npx vitest run`

#### Manual Verification:

- (none this phase — the manual walkthrough lands with Phase 2)

**Implementation Note**: Pause for confirmation before Phase 2.

---

## Phase 2: Shared-device hygiene + walkthrough

### Overview

Close the two residue gaps with assertions where automatable, and run the slice's manual evidence bar.

### Changes Required:

#### 1. Signout clears the parent_verified marker

**File**: `src/pages/api/auth/signout.ts`

**Intent**: Signing out must revoke parent verification — same "fresh account, fresh state" hygiene as the S-11 `active_profile` clearing, and it closes the 15-minute same-account PIN re-entry window.

**Contract**: `context.cookies.delete(PARENT_VERIFIED_COOKIE, { path: "/" })` alongside the existing `active_profile` deletion. No change to marker generation/verification.

#### 2. Signout-hygiene test

**File**: `tests/parent-pin.test.ts` (extend; or the auth gating suite if it reads cleaner)

**Intent**: Pin the revocation so a future signout refactor can't silently resurrect the residue.

**Contract**: Drive the real PIN-verify route to set the marker into a jar, then the real signout route with that jar; assert the jar's `parent_verified` entry is cleared (deleted/empty) alongside the auth cookies. Route-level, using the existing harness.

#### 3. bfcache reload guard

**File**: `src/layouts/Layout.astro`

**Intent**: A back/forward-cache restore must never replay a stale account frame (Safari ignores `no-store` for bfcache) — reload through the server instead, which re-renders current state or bounces to signin.

**Contract**: Minimal inline `<script>`: on `pageshow`, if `event.persisted`, `window.location.reload()`. No framework involvement, no i18n (no user-visible text), ships on every page.

#### 4. Manual walkthrough (the slice's evidence bar)

**File**: none (verification)

**Intent**: The one real two-device pass the evidence bar demands, plus the residue checks.

**Contract**: (a) Grow state on device 1 (shift + purchase), sign in on device 2 → identical wallet/shop/skills; (b) logout on a shared browser, log in as another account → no trace of A (picker/start/report all B's); (c) after logout, press Back (ideally Safari) → the page reloads to signin, not A's cached frame; (d) same-account signout → signin within 15 min → `/app/report` asks for the PIN again.

### Success Criteria:

#### Automated Verification:

- Tests pass: `npx vitest run tests/parent-pin.test.ts tests/cross-device-restore.test.ts`
- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- Full suite passes against a fresh DB (`npx supabase db reset` + `npx vitest run`)

#### Manual Verification:

- Two-device walkthrough: state grown on device 1 appears identically on device 2
- Shared-device account swap shows zero residue of the previous account
- Post-logout Back button reloads to signin (no stale frame), incl. Safari if available
- Signout → re-signin requires the PIN again for `/app/report`

**Implementation Note**: Final phase — after verification, S-10 closes via `/10x-archive`.

---

## Testing Strategy

### Integration Tests (local Supabase stack):

- `tests/cross-device-restore.test.ts`: route-driven writes → fresh-session RLS read equality; cross-account negative; teardown clean.
- `tests/parent-pin.test.ts` extension: signout revokes the marker (jar-asserted).
- Full suite against a fresh DB at each phase end.

### Manual Testing Steps:

1. Device 1: play a shift, buy an upgrade. Device 2: sign in → wallet/shop/skills identical.
2. Shared browser: A logs out, B logs in → B's picker/start/report only.
3. A logs out; press Back → reload to signin (test in Safari if available — the browser the guard exists for).
4. A signs out and back in within 15 min → report asks for the PIN.

## Performance Considerations

None: one inline event listener per page; a reload only on bfcache restores.

## Migration Notes

**No migration.** All changes are tests, one cookie deletion, and one inline script.

## References

- Frame: `context/changes/cross-device-economy-restore/frame.md` (authoritative problem statement)
- Spec: `context/foundation/roadmap.md` §S-10; `context/foundation/prd-v3.md` FR-001/FR-005/FR-012; `context/foundation/test-plan.md` Risk #2
- Seams: `tests/helpers/supabase.ts`, `tests/helpers/astro.ts`, `src/pages/api/auth/signout.ts`, `src/lib/services/parent-pin.ts:134-167`, `src/layouts/Layout.astro`
- False-green evidence: `tests/shifts-complete.test.ts:65`, `tests/upgrades-buy.test.ts:111-113`
- Lessons: L-001/L-002 (isolation + durable-state verification)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: The cross-device proof

#### Automated

- [x] 1.1 New test passes against a fresh DB (`supabase db reset` + `vitest run tests/cross-device-restore.test.ts`)
- [x] 1.2 Type checking passes: `npm run check`
- [x] 1.3 Linting passes: `npm run lint`
- [x] 1.4 Full suite passes: `npx vitest run`

### Phase 2: Shared-device hygiene + walkthrough

#### Automated

- [ ] 2.1 Tests pass: `npx vitest run tests/parent-pin.test.ts tests/cross-device-restore.test.ts`
- [ ] 2.2 Type checking passes: `npm run check`
- [ ] 2.3 Linting passes: `npm run lint`
- [ ] 2.4 Build succeeds: `npm run build`
- [ ] 2.5 Full suite passes against a fresh DB (`supabase db reset` + `vitest run`)

#### Manual

- [ ] 2.6 Two-device walkthrough: device-1 state identical on device 2
- [ ] 2.7 Shared-device account swap: zero residue of the previous account
- [ ] 2.8 Post-logout Back button reloads to signin (Safari if available)
- [ ] 2.9 Signout → re-signin requires the PIN again for /app/report
