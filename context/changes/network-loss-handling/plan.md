# Network-Loss Handling Mid-Shift (S-12) Implementation Plan

## Overview

Deliver roadmap **S-12** / **FR-017** (prd-v3; the research doc's "FR-016"/"S-08" refer to the same requirement pre-renumbering): if the browser loses connectivity mid-shift, the app halts the shift with a warm Polish in-world message, discards pending progress, and — once connectivity is confirmed back — returns the child to the last state the server recorded. No queue, no retry, no PWA (explicit non-goal). No database migration.

## Current State Analysis

The 2026-06-14 research (`research.md`) mapped the design space before S-04 existed; verified against today's code:

- **Half the contract already shipped in S-04.** `ShiftScreen.tsx:89-106` POSTs the shift result exactly once (`savedRef` guard — no retry by construction); its `.catch` → `"error"` phase already implements *discard + gentle Polish message + back-to-start* (`t.results.saveError`). The research's double-pay hazard does not apply as built: the write is a plain `fetch` to our own route (no supabase-js client retry), and nothing retries it.
- **What's missing:** connectivity detection (grep for `onLine`/`offline`/`AbortSignal` across `src/` is empty); an offline-specific in-world message (today "internet gone" and "server hiccup" share the same generic copy); a timeout on the completion fetch (a hung request leaves the child on `"saving"` forever); and mid-shift detection — tasks are generated client-side, so **no network calls happen during play**; only the `offline` event can surface loss before shift-end.
- **Research decisions still binding:** `offline` event = cheap pessimistic trigger; a fetch that *rejects* (`TypeError`/abort) = authoritative offline signal, while `response.ok === false` = server reached (NOT offline); never trust `navigator.onLine === true` / the `online` event without a successful confirm probe.
- **Gaps the research flagged that have since closed:** the i18n layer exists (`t.*`, L-003); the write path exists. Still true: no dialog/modal primitive in `src/components/ui/` — the overlay is a hand-rolled `fixed inset-0` island per house style.
- **Guardrails (binding):** no red, no buzzer, no "game over" — the halt reads as a gentle in-world pause; oversized tap targets; Polish copy from the dictionary.

## Desired End State

A child playing a shift when the WiFi drops sees, at the moment the `offline` event fires (or when the shift-end save fails/times out on a dead network), a calm full-screen in-world overlay — "Internet zniknął! Spróbuj za chwilę." — with one oversized button. Tapping it probes connectivity; on success the child lands on `/app/start` with state exactly as the server last recorded (the interrupted shift is gone, wallet/level untouched); on failure the overlay stays calm. A genuine *server* error at save time keeps today's distinct `saveError` copy. Verify: classifier unit tests green; `check`/`lint`/`build` green; full suite green against a fresh DB; manual devtools-offline walkthrough matches FR-017.

### Key Discoveries:

- `ShiftScreen`'s phase machine (`Phase = "playing" | "saving" | "results" | "error"`, `ShiftScreen.tsx:24`) is the natural seam — the halt is one more phase, not a new architecture.
- The completion call is our own API route via `fetch` (`:89`), so `AbortSignal.timeout()` on that call is the whole timeout story — no supabase-js client options involved (those apply to SSR reads, out of scope).
- The failure classifier is fully pure: `fetch` rejection (`TypeError`, `AbortError`/`TimeoutError`) ⇒ offline; a resolved response with `!res.ok` ⇒ server error. Unit-testable without any browser.
- A confirm probe needs a target that (a) doesn't spin up a function and (b) bypasses caches: a `HEAD`/`GET` of a static asset with `cache: "no-store"` rides the CDN and answers "is the internet back" at transport level — sufficient for the never-trust-`online` rule.

## What We're NOT Doing

- **No offline queue / retry / background sync / PWA** — explicit prd-v3 non-goal; the interrupted shift is discarded by design (the S-04 `savedRef` fire-once semantics are preserved untouched).
- **No idempotency/ledger rework of the shift-end write** — the research's `shift_id` recommendation was superseded by S-04's shipped design (server-recomputed UPDATE, no client retry); nothing in this slice retries writes, so the hazard stays moot. Revisit only if a retry path is ever added.
- **No global overlay** — scoped to the shift surface (decided in planning); other pages keep browser-default offline behavior.
- **No heartbeat / health endpoint** — the `offline` event covers idle loss for the common cases; captive-portal edge surfaces at the shift-end POST (decided in planning).
- **No detection changes to SSR reads, upgrades buy path, or auth** — mid-shift is the FR's scope.
- **No jsdom / component-test infra** — pure parts unit-tested; browser behavior verified manually (decided in planning).

## Implementation Approach

Two shippable phases. **Phase 1** builds the pure foundations test-first — the failure classifier and probe helper in a new `src/lib/connectivity.ts` — and hardens the existing shift-end fetch with a timeout, failing a hung save into the existing gentle error path (no new UX). **Phase 2** lands the visible FR-017 behavior: an `useConnectivity` hook (offline-event wiring) scoped to the shift surface, the in-world halt overlay with the confirm-probe button, and the offline-vs-server split of shift-end failure copy.

## Critical Implementation Details

- **The overlay pauses, never unmounts, the shift.** Rendering the halt overlay *over* the playing UI (not replacing the phase) means a false-positive `offline` blip doesn't destroy shift state; the discard only happens when the child taps through to `/app/start`. The `offline` listener must not touch `savedRef`/`results`.
- **Timeout classification:** `AbortSignal.timeout()` rejects with a `TimeoutError` `DOMException` (name-based check, not `instanceof TypeError`) — the classifier must treat abort/timeout AND `TypeError` as network-shaped, and everything resolved as server-shaped.
- **The probe gates navigation, not the listener.** Per the research rule, the `online` event / `navigator.onLine` never lifts the halt; only a successful probe (fired by the child's tap) does, and it navigates to `/app/start` rather than resuming the dead shift.

## Phase 1: Connectivity foundations + hardened shift-end write

### Overview

Pure, test-first groundwork: the network-vs-server failure classifier and the confirm-probe helper, plus a timeout on the shift-end fetch so a hung request fails into the existing gentle error path instead of spinning forever. No new UX.

### Changes Required:

#### 1. Connectivity module

**File**: `src/lib/connectivity.ts` (new)

**Intent**: One client-safe home for the detection semantics the research pinned, reusable by later slices.

**Contract**: `isNetworkFailure(err: unknown): boolean` — true for `fetch` rejection shapes (`TypeError`, `DOMException` named `AbortError`/`TimeoutError`), false otherwise (pure, unit-tested). `SHIFT_SAVE_TIMEOUT_MS` exported tunable (~10s). `probeConnectivity(fetchImpl?)` — resolves boolean; `GET`/`HEAD` of a static asset (e.g. `/favicon.svg`) with `cache: "no-store"` and its own short timeout; injectable fetch for tests; never throws.

#### 2. Shift-end fetch timeout + classified failure

**File**: `src/components/child/ShiftScreen.tsx`

**Intent**: A dead or hung network at save time must fail fast and be distinguishable from a server error (Phase 2 renders them differently; Phase 1 routes both to the existing `"error"` phase).

**Contract**: The completion `fetch` gains `signal: AbortSignal.timeout(SHIFT_SAVE_TIMEOUT_MS)`. The `.catch` records the classification (`isNetworkFailure`) alongside setting the failure phase — in Phase 1 both classifications still render today's `saveError` fallback (no visible change beyond hung-request rescue). `savedRef`/discard semantics untouched.

#### 3. Classifier unit tests

**File**: `tests/connectivity.test.ts` (new)

**Intent**: Pin the research's classification rule where regressions would bite.

**Contract**: `isNetworkFailure` — true: `TypeError`, `DOMException("", "AbortError")`, `DOMException("", "TimeoutError")`; false: plain `Error`, HTTP-shaped objects, undefined. `probeConnectivity` — resolves true on injected ok-fetch, false on rejecting fetch and on `!res.ok`; never rejects.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npx vitest run tests/connectivity.test.ts`
- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- Full suite passes against a fresh DB (`npx supabase db reset` + `npx vitest run`)

#### Manual Verification:

- With devtools offline at shift end, the save fails into the gentle error screen within ~10s (no infinite "saving")
- Normal shift completion unchanged

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: The in-world halt — overlay, offline wiring & reconnect

### Overview

The visible FR-017 behavior: offline-event detection scoped to the shift surface, the calm in-world overlay with a confirm-probe button, and offline-vs-server failure copy at save time.

### Changes Required:

#### 1. Polish copy

**File**: `src/i18n/pl.ts`

**Intent**: The in-world halt strings (L-003), warm and non-technical.

**Contract**: New `t.offline` block — headline ("Internet zniknął! Spróbuj za chwilę." per FR-017), a soft in-world subtitle (shop closed for a moment), the try-again button label, and a still-offline gentle note shown when a probe fails. Draft Polish, pending native review.

#### 2. Connectivity hook

**File**: `src/components/hooks/useConnectivity.ts` (new)

**Intent**: Event wiring per the research's layering — `offline` event trips the halt instantly; nothing auto-lifts it.

**Contract**: Returns `{ offline: boolean, markOffline(): void }` (or equivalent): `offline` flips true on the window `offline` event or when `markOffline` is called (shift-end network failure); it is **never** flipped false by the `online` event — only consumers navigating away reset it. Listener cleanup on unmount.

#### 3. Halt overlay island

**File**: `src/components/child/OfflineOverlay.tsx` (new)

**Intent**: The gentle in-world pause: full-screen, non-red, oversized single action.

**Contract**: `fixed inset-0 z-50` overlay (backdrop blur, `bg-background`-family palette) rendered over the shift UI without unmounting it; headline + subtitle from `t.offline`; one `ChildButton` — on tap runs `probeConnectivity()`: success → `window.location.href = "/app/start"` (last server-recorded state; discard by navigation); failure → show the still-offline note and stay calm (button re-tappable, transient disabled state while probing). `role="status"`, no sound, no animation harsher than a fade.

#### 4. Wire the shift surface

**File**: `src/components/child/ShiftScreen.tsx`

**Intent**: The halt appears mid-play the moment the network drops, and the shift-end failure copy splits offline vs server.

**Contract**: `useConnectivity` in `ShiftScreen`; when `offline` and the phase is `"playing"`/`"saving"`, render `OfflineOverlay` above the current UI (state preserved underneath — see Critical Implementation Details). Shift-end `.catch`/`!res.ok` handling: network-shaped failures call `markOffline` (overlay takes over); server-shaped keep the existing `"error"` phase with `t.results.saveError`. `savedRef` and the fire-once semantics untouched.

### Success Criteria:

#### Automated Verification:

- Tests pass: `npx vitest run tests/connectivity.test.ts`
- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- Full suite passes against a fresh DB (`npx supabase db reset` + `npx vitest run`)
- No inline user-visible literals in the new/edited surfaces (L-003)

#### Manual Verification:

- Devtools offline mid-task → overlay appears immediately; underlying shift UI stays mounted; no red/harsh visuals
- Try-again while still offline → calm still-offline note, no navigation; after re-enabling network → tap lands on `/app/start` with wallet/level at last server-recorded values (interrupted shift gone)
- Offline exactly at shift end → overlay (not the server-error copy); with network on but the API failing (e.g. stopped Supabase) → the distinct `saveError` copy
- Copy is Polish, warm, in-world; oversized tap target

**Implementation Note**: Final phase — after verification, S-12 is complete (archive via `/10x-archive`).

---

## Testing Strategy

### Unit Tests (`tests/connectivity.test.ts`):

- `isNetworkFailure`: TypeError / AbortError / TimeoutError → true; plain Error, HTTP-shaped, undefined → false.
- `probeConnectivity`: injected fetch ok → true; rejecting fetch → false; `!res.ok` → false; never rejects.

### Integration Tests:

- Full suite against a fresh DB at each phase end (no server-side changes expected; guards regressions).

### Manual Testing Steps:

1. Play mid-shift, devtools → offline: overlay appears instantly; toggle back online, tap try-again → `/app/start`, state at last shift-end.
2. Complete a shift with devtools offline at the save moment: overlay (offline copy), not `saveError`; wallet unchanged after reconnect (discarded shift paid nothing).
3. Stop Supabase with network up, complete a shift: `saveError` copy (server-shaped), back-to-start works.
4. Hung network (devtools throttling → offline mid-request): save fails within ~10s, no infinite spinner.
5. False blip: go offline then online without tapping: overlay stays (never auto-lifts) until the child taps and the probe confirms.

## Performance Considerations

None material: one event listener on the shift surface, one static-asset probe per try-again tap, no polling, no new endpoints.

## Migration Notes

**No migration.** All changes are client-side; the write path and its semantics are untouched.

## References

- Research: `context/changes/network-loss-handling/research.md` (2026-06-14 — detection architecture still binding; codebase facts superseded as noted in Current State Analysis)
- Spec: `context/foundation/prd-v3.md` FR-017 (preserved; carried from prd-v2 FR-016); roadmap §S-12
- Shift surface: `src/components/child/ShiftScreen.tsx:24,62-106,119-133`
- Guardrails: prd-v3 tone/NFR sections (no red, no urgency, oversized targets); L-003 (i18n)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Connectivity foundations + hardened shift-end write

#### Automated

- [x] 1.1 Unit tests pass: `npx vitest run tests/connectivity.test.ts` — b304381
- [x] 1.2 Type checking passes: `npm run check` — b304381
- [x] 1.3 Linting passes: `npm run lint` — b304381
- [x] 1.4 Build succeeds: `npm run build` — b304381
- [x] 1.5 Full suite passes against a fresh DB (`supabase db reset` + `vitest run`) — b304381

#### Manual

- [x] 1.6 Devtools-offline at shift end fails into the gentle error screen within ~10s (no infinite "saving") — b304381
- [x] 1.7 Normal shift completion unchanged — b304381

### Phase 2: The in-world halt — overlay, offline wiring & reconnect

#### Automated

- [x] 2.1 Tests pass: `npx vitest run tests/connectivity.test.ts`
- [x] 2.2 Type checking passes: `npm run check`
- [x] 2.3 Linting passes: `npm run lint`
- [x] 2.4 Build succeeds: `npm run build`
- [x] 2.5 Full suite passes against a fresh DB (`supabase db reset` + `vitest run`)
- [x] 2.6 No inline user-visible literals (L-003)

#### Manual

- [x] 2.7 Offline mid-task → instant calm overlay; shift UI stays mounted; no red
- [x] 2.8 Try-again offline → still-offline note; after reconnect → /app/start at last recorded state
- [x] 2.9 Offline at save → offline copy; server failure with network up → saveError copy
- [x] 2.10 Overlay never auto-lifts on the online event; only a confirmed probe navigates
- [x] 2.11 Copy Polish, warm, in-world; oversized tap target
