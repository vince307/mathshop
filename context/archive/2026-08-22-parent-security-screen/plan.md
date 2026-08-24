# Parent PIN change ("Zabezpieczenia") Implementation Plan

> Change: `parent-security-screen` (run `context/runs/2026-08-22-autonomous-five`, feature F3)
> Research: `context/changes/parent-security-screen/research.md` (898 lines — the ground truth for this plan)
> Brief: `context/changes/parent-security-screen/plan-brief.md`

---

## Scope collapse — read this first

**This change was scoped as "the full Zabezpieczenia screen: change PIN plus the protective options
from the auth-v2 mockup". Research killed everything except change PIN. The plan builds exactly one
new capability, and the maintainer should be able to overrule that from this paragraph alone.**

The evidence, all of it verified against files, not summaries:

1. **The mockup is not a settings screen.** `assets/matmaverse-auth-v2-{web,mobile}/06-parent-pin-security-*.png`
   draws **step 3 of a 3-step onboarding wizard** — a "Krok 3 z 3" stepper (Konto rodzica → Profil
   dziecka → Bezpieczeństwo), a left step rail, and a `← Wróć` / `Pomiń na razie` /
   `Zakończ konfigurację` footer. Its PIN half is *first-time set*, which `/app/parent-pin` already
   ships (`src/pages/app/parent-pin.astro:12-14` → `ParentPinGate` in `set` mode).

2. **The mockup's right-hand "Bezpieczne ustawienia" card is already shipped, correctly.** It exists
   today as the static "Bezpieczne środowisko" statements card on `/app/report`
   (`src/pages/app/report.astro:87-103`, strings at `src/i18n/pl.ts:400-407`) with the comment
   *"Product guarantees, not measurements — safe to state without data."* The four bullets are the
   honest form of the four toggles.

3. **All four toggles are decorative and cannot be made real:**
   - *"Brak reklam"* — PRD v3 **:158** says *"No monetization mechanic — ever. No ads, purchases,
     paywall, or premium tier. Identity, not a deferred feature."* A switch implies ads can be turned
     **on**. Non-goal. *(Re-verified 2026-08-22: the line is 158, not the 167 first cited.)*
   - *"Kontrola poziomu trudności"* — PRD v3 **:161** — *"No full parent dashboard. Only the minimal
     read-only weekly report ships; goal-setting, difficulty controls, time limits, and settings UI
     are out."* — names **difficulty controls** as an explicit non-goal, alongside "settings UI".
     Also drawn on web only, not mobile. *(Re-verified 2026-08-22: the line is 161, not the 170 first
     cited. The same line independently rules out a `/app/security` settings shell — see D3.)*
   - *"Dostosowane do wieku"* — unconditional. Derived from `child_profiles.age` (6–9) and the frozen
     `starting_level`. There is no "off" path and no column.
   - *"Raport tygodniowy" — "**Otrzymuj** podsumowanie…"* — promises scheduled e-mail delivery. The
     report is a **pull** surface at `/app/report`. No cron, no template, no send path exists. A
     persisted boolean nothing reads is a dead switch.
   - **The tell:** the web mockup draws **four** toggles, the mobile mockup draws **three**. A real
     setting cannot exist only at desktop width. *(Re-verified against both PNGs during the plan
     review, 2026-08-22: web = Brak reklam / Dostosowane do wieku / Raport tygodniowy / Kontrola
     poziomu trudności; mobile = the first three only. All four are drawn ON, none has an off state.
     Both mockups show `Wpisz 4 cyfry` + `Potwierdź PIN` and **no current-PIN field** — confirming
     this is the onboarding first-set screen, not a change form.)* Decorative reassurance can. The maintainer already
     made this exact call once, on "Zapamiętaj mnie"
     (`context/changes/web-shell-and-mockup-parity/handoff.md:134-138` — *"byłby to atrapowy checkbox"*).

4. **The agent contract forbids shipping controls that do nothing.** So the four toggles are dropped,
   and the already-shipped statements card is left **exactly as it is** — same wording, same styling.
   Renaming "Bezpieczne środowisko" to the mockup's "Bezpieczne ustawienia" would be churn: the
   current copy is not wrong, it is *more* honest (a statement, not a settings label).

**What was dropped:** four toggles, the onboarding wizard chrome (stepper / Wróć / Pomiń /
Zakończ / left rail), the lock-and-shield hero art (`public/illustrations/slice-map.md:38` records
the standing decision that shield/lock glyphs are rendered with `lucide`, not sliced), and a
dedicated `/app/security` route with a fifth nav tab.

**What remains:** changing the parent PIN. One capability, one form, one route contract change, no
migration, no new page, no nav change.

**To overrule:** if any toggle is meant to be a real, persisted setting, say which one. That reopens
the migration question (`ALTER TABLE public.account_settings ADD COLUMN …`, RLS settled in the same
file per L-001, `docs/reference/contract-surfaces.md:41-55` updated, `AccountSettingsRow` at
`src/lib/services/parent-pin.ts:25-30` hand-updated — there are **no generated Supabase types**, so
a new column produces zero compile errors anywhere) and needs a real consumer for the value, not
just storage.

---

## Overview

Let a parent change their PIN from inside the parent zone, re-proving the **current** PIN under the
existing brute-force throttle. Ships as a `ChangePinSection` island on the already-PIN-gated
`/app/report`, backed by an extended contract on the existing `POST /api/parent/pin/set` route. No
new page, no new endpoint, no nav entry, no migration.

## Current State Analysis

- **`POST /api/parent/pin/set` already is the change-PIN route.** `src/pages/api/parent/pin/set.ts:31-34`
  refuses to overwrite an existing PIN unless a valid `parent_verified` marker is present (403). The
  guard runs **before** the body is parsed, so 403 pre-empts 400. First-time set (no row) skips the
  guard entirely and is open to any authenticated session, by design.
- **That path has no UI today.** `parent-pin.astro:12-14` renders `enter` mode whenever a PIN exists,
  and `enter` posts to `/verify`. The reset-with-marker branch of `set.ts` is reachable only by a
  direct POST — it is tested (`tests/parent-pin-routes.test.ts:83`) but nothing in `src/` calls it.
- **The current bar for changing a PIN is therefore: a 15-minute-old cookie.** Inside that window a
  child on the parent's logged-in device (the threat model named verbatim at
  `src/pages/api/profiles/delete.ts:19-28`) can POST to `/api/parent/pin/set` and silently change it.
- **There is no forgot-PIN recovery flow.** Open since the S-07 impl-review, never built. So a
  changed PIN is a **permanent** lockout from the parent zone — and unlike account deletion (loud:
  signed out onto a farewell page) it is **silent**.
- **The precedent for this exact situation already exists, twice.** `src/pages/api/account/delete.ts:30-35`
  — *"marker + FRESH PIN under the atomic throttle — a possibly-15-min-old marker alone is not enough
  for the nuclear option"* — restated at `src/components/parent/DeleteAccountSection.tsx:17-18`.
- **`/app/report` is already the parent zone.** It carries the copy-pasted marker gate
  (`report.astro:22-29`), already hosts `DeleteAccountSection`, and `t.parentPin.note` (`pl.ts:357`)
  already promises *"Za PIN-em znajdziesz raport tygodniowy **i ustawienia konta**"* — a promise only
  half-kept today by the deletion danger zone.
- **`account_settings` needs nothing new**: `pin_hash`, `failed_attempts`, `locked_until` all exist;
  no `ALTER TABLE` has ever been applied to it.
- **Baselines:** `npm test` = **299** `it()` across 39 files; `npx playwright test` = 6 specs / 13
  `test()` blocks / **15 runs** (`desktop` + `touch`, the latter scoped to `gameplay-restore.spec.ts`).

## Desired End State

A signed-in parent who has passed the PIN gate sees a **"Zmiana PIN-u rodzica"** card on
`/app/report`, above the deletion danger zone. It has three fields — current PIN, new PIN, repeat new
PIN — and a submit button. On success an inline confirmation appears and the parent stays on the
report; the old PIN no longer opens the gate and the new one does. A wrong current PIN produces a
soft inline error **and burns a throttle attempt**; five wrong attempts lock the account for 60
seconds exactly as every other wrong-PIN path does. A stale marker redirects to `/app/parent-pin`.

Verify by: the e2e journey in Phase 3 (old PIN rejected at the gate, new PIN admitted), plus the
route tests in Phase 1 that read `failed_attempts` and `pin_hash` back through the service-role
client (L-002 — assert the durable state, not the API response).

### Key Discoveries

- `src/pages/api/parent/pin/set.ts:31-34` — the reset guard; the route already carries change-PIN
  semantics, so a second endpoint would fork a security-critical invariant across two files.
- `src/pages/api/account/delete.ts:41-64` — the guard sequence to copy: 503 → 401 → **403 marker** →
  400 zod → **`verifyPin` under the throttle** → the action. Note `delete.ts:62` runs the e-mail
  check *after* the PIN check, so a wrong PIN always burns an attempt and the second factor cannot be
  used as a free pre-flight oracle. This plan applies that ordering to the same-as-current check.
- `src/pages/api/parent/pin/verify.ts:17` — the `STATUS_FOR` vocabulary
  (`{ locked: 429, "no-pin": 400, wrong: 401, error: 500 }`), duplicated verbatim at
  `account/delete.ts:22`. A third copy in `set.ts` is the established pattern, not drift.
- `src/lib/services/parent-pin.ts:87-120` — `verifyPin` is the **only** exported path that reads
  `pin_hash`; `matchesPin`/`hashPin` are module-private. Its wrong branch calls the atomic
  `register_pin_failure` RPC (`supabase/migrations/20260702120000_pin_failure_throttle_rpc.sql:16-33`,
  `security invoker`, pinned by `where s.account_id = auth.uid()`).
- `src/components/parent/DeleteAccountSection.tsx:33-52` — the status→copy/navigation map to copy,
  including the F5 lesson: *a 401 is "wrong PIN" only when the route says `reason: "wrong"`*.
- `src/components/parent/ParentPinGate.tsx:25-36` — `reasonToMessage` has **no `"forbidden"` case**;
  a 403 there renders "Coś poszło nie tak." **Do not inherit this map.**
- `src/components/parent/WeeklyReport.tsx:120` already renders a `role="status"` on `/app/report`.
- `src/i18n/pl.ts:351-370` — `parentPin` block; `pinLabel`, `confirmLabel`, `pending`, and all of
  `errors.*` are reused by the new form.
- `tests/parent-pin-routes.test.ts:52` asserts first-time set is open with **only** a `pin` field.
  That test is load-bearing: it guards real onboarding.

## What We're NOT Doing

- **Not building any of the four "protective options" toggles**, in any form (see Scope collapse).
- **Not touching the shipped "Bezpieczne środowisko" statements card** — not renaming it to the
  mockup's "Bezpieczne ustawienia", not restyling it, not reordering its bullets. The current copy is
  not wrong; churn is not parity.
- **Not creating `/app/security`** and not adding a fifth bottom-nav tab.
- **Not adding a new API endpoint.**
- **Not writing a migration.** No column, no policy, no RPC change.
- **Not extracting a `requireParent(context)` helper** — see Autonomous decisions D6.
- **Not fixing the `failed_attempts`-never-resets defect** — see Autonomous decisions D7.
- **Not building forgot-PIN recovery** — see Autonomous decisions D8.
- **Not cropping artwork.** The card's icon is `lucide` (`KeyRound` / `ShieldCheck`), per the standing
  decision at `public/illustrations/slice-map.md:38`.
- **Not adding `getByTestId` hooks.** `e2e/CLAUDE.md` is binding: no testids exist in `src/` and
  needing one is a product finding to surface first.

## Implementation Approach

Extend the existing route rather than fork it; mount a section on the existing gated page rather than
build a shell around one form; reuse the deletion flow's shape rather than invent a second style for
"sensitive action behind a fresh PIN".

**What is copied from the deletion flow, specifically:**

| From | What is copied |
| --- | --- |
| `account/delete.ts:41-64` | the guard **sequence and its ordering**: 503 client → 401 session → 403 marker → 400 zod → `verifyPin` under the throttle → second factor → action |
| `account/delete.ts:62` | the ordering **lesson**: the non-PIN check runs *after* `verifyPin`, so a wrong PIN always burns an attempt |
| `account/delete.ts:22` / `verify.ts:17` | the `STATUS_FOR` map, verbatim |
| `account/delete.ts:11-15` | the schema comment style and the L-002 rule: **no account id is ever accepted from the client** |
| `DeleteAccountSection.tsx:27-52` | the `fetch` → status → Polish-copy mapping, incl. **403 → hard-nav `/app/parent-pin`** and the 401-without-`wrong` disambiguation |
| `DeleteAccountSection.tsx:55-57` | the section card shape: `<section>` + `h2` + intro `<p>` + control |
| `tests/delete-account-section.test.tsx` | the jsdom test harness: `vi.stubGlobal("fetch", …)`, the `window.location.href` setter spy, one `it()` per status |
| `tests/account-deletion.test.ts` | the L-002 durable read-back: assert `failed_attempts` / `pin_hash` via the **admin** client, not the response body |

**What is deliberately NOT copied:** `ConfirmDeleteDialog` (a typed-confirmation `AlertDialog` is for
irreversible destruction; changing a PIN is reversible by changing it again) and
`ParentPinGate.reasonToMessage` (no `"forbidden"` case).

## Critical Implementation Details

- **One `hasPin()` call, two consumers.** The route must hoist the existing
  `await hasPin(supabase)` into a single `const` used by *both* the marker guard and the
  `currentPin` requirement. Two separate calls could disagree (a row appearing between them) and the
  disagreement direction is "skip the currentPin check" — a bypass. This also means the plan inherits,
  but does not widen, the known fail-open at `parent-pin.ts:57-60` (`hasPin` swallows query errors
  and reads as "no PIN"). Noted as a follow-up, not fixed here.
- **`FormData.get()` returns `null`, not `undefined`.** `z.string().optional()` rejects `null`. The
  route must normalise: `form.get("currentPin") ?? undefined`. Getting this wrong turns every
  change-PIN request into a 400.
- **Ordering: `verifyPin(currentPin)` runs BEFORE the same-as-current comparison**, mirroring
  `delete.ts:62`. A wrong current PIN must always burn a throttle attempt; the comparison must never
  be reachable as a cheaper pre-flight.
- **i18n label substring constraint.** Playwright's `getByLabel` matches **substrings** by default,
  and the contract warns about this. The three field labels must be mutually non-substring:
  `"Obecny PIN"` / `"Nowy PIN (4–6 cyfr)"` / `"Powtórz nowy PIN"`. In particular do **not** name the
  new-PIN field just `"Nowy PIN"` — it is a case-insensitive substring of `"Powtórz nowy PIN"`.
- **`role="status"` is already present on `/app/report`** (`WeeklyReport.tsx:120`). The new section's
  message must therefore be reachable by a scoped locator: give the `<section>` an accessible name
  via `aria-labelledby` pointing at its `h2`, so it exposes `role="region"` and e2e can scope with
  `getByRole("region", { name: t.parentPin.changeHeading })`. Do **not** introduce a `role="alert"` on
  this page — `ParentPinGate` owns `getByRole("alert")` on the gate page and a second one here would
  make future locators ambiguous.
- **`setPin` is a throttle reset — so `verifyPin` must gate every path that reaches it.** `setPin`
  unconditionally writes `failed_attempts: 0, locked_until: null` (`parent-pin.ts:73`). Today a
  marker-only POST to `/api/parent/pin/set` therefore clears a live lockout as a side effect. The new
  guard order closes that (a live `locked_until` short-circuits inside `verifyPin`, before `setPin`),
  and Phase 1 route test 4b is what proves it. Never move `setPin` ahead of the change branch.
- **`getByRole("region", …)` resolves uniquely on `/app/report` — verified, and it depends on the
  accessible name.** A bare `<section>` exposes the `region` role **only when it has an accessible
  name**. `DeleteAccountSection.tsx:55` is a `<section>` with **no** `aria-labelledby`, `aria-label`
  or `id` — so it is *not* a region and cannot collide. Giving `ChangePinSection` its
  `aria-labelledby` → `h2` is therefore both the a11y fix and the thing that makes the e2e locator
  unambiguous; dropping it silently breaks Phase 3.
- **Grid row bookkeeping on `report.astro`.** The layout is a 3-column `lg` grid: report at
  `row-start-1`, deletion at `row-start-2`, aside at `lg:row-span-2 lg:row-start-1`. Inserting the new
  card at `row-start-2` pushes deletion to `row-start-3` and the aside must become `lg:row-span-3`.
- **Marker re-mint on success stays.** `set.ts:43` calls `setParentVerified` after a successful set.
  With a fresh current-PIN check this is exactly what `verify.ts:37` does after the same proof —
  keeping it avoids bouncing the parent out of the page they are standing on. Known limitation, stated
  here rather than inherited silently: the marker is a per-browser cookie, so changing the PIN does
  **not** invalidate a marker already held by another browser. Revoking those would need server-side
  session versioning, which does not exist.

---

## Phase 1: Route contract — conditional `currentPin` on `POST /api/parent/pin/set`

### Overview

Make overwriting an existing PIN require the **current** PIN, verified through `verifyPin` under the
existing atomic throttle. First-time set stays open and unchanged. Server-only phase — no UI yet, no
strings yet.

### Changes Required

#### 1. The route

**File**: `src/pages/api/parent/pin/set.ts`

**Intent**: Raise the bar for a PIN *change* from "a possibly-15-minute-old marker" to "marker **plus**
a freshly-proved current PIN", matching the house rule already set for account deletion. Leave
first-time set (no `account_settings` row) exactly as it is, because that path is real onboarding.

**Contract**:
- `export const prerender = false` — already present, keep it.
- Body stays `multipart/form-data`. Fields: `pin` (the **new** PIN, unchanged meaning) and a new
  optional `currentPin`. No account id is ever read from the body (L-002).
- Schema: both fields `z.string().regex(/^\d{4,6}$/)`, `currentPin` `.optional()`. Normalise
  `form.get("currentPin") ?? undefined` before parsing.
- Guard order, each a hard stop:
  1. `503` — no RLS client.
  2. `401` — no session user.
  3. `const isChange = await pinExists(supabase)` — **one call, reused below**, and it **fails closed**:
     a query error returns `null` and the route answers `503`. (See "The service helper" below — the
     existing `hasPin` reads a query error as "no PIN", which on this route would skip *both* the
     marker guard and the `currentPin` requirement.)
  4. `403 { reason: "forbidden" }` — `isChange` and `verifyMarker(marker, user.id)` is false.
     *(unchanged behaviour)*
  5. `400 { reason: "invalid" }` — zod fails. *(Body shape only; no `isChange` logic here.)*
  6. **The change branch — a single `if (isChange) { … }` block containing, in this order:**
     a. `const currentPin = parsed.data.currentPin;`
        `if (!currentPin) return json(400, { ok: false, reason: "invalid" });`
     b. `const pinResult = await verifyPin(supabase, currentPin);`
        `if (!pinResult.ok) return json(STATUS_FOR[pinResult.reason] ?? 400, { ok: false, reason: pinResult.reason });`
        — `STATUS_FOR` is a local record identical to `verify.ts:17`
        (`locked` 429 / `wrong` 401 / `no-pin` 400 / `error` 500). This is the *only* PIN comparison;
        the route must not compare hashes itself.
     c. `if (currentPin === parsed.data.pin) return json(400, { ok: false, reason: "same-as-current" });`
  7. `setPin` → `500` on failure; `setParentVerified` re-mint; `200 { ok: true }`.
- **STRUCTURAL REQUIREMENT (this is the security gate — do not restructure it).** The requirement
  check, the `verifyPin` call and the same-as-current comparison live inside **one** `if (isChange)`
  block, in that order, with `currentPin` narrowed by the early `return` at 6a. Reasons, all of them
  ways this gate has been bypassed elsewhere:
  - **Three separate `isChange` tests are three chances to get one wrong.** One block makes it
    structurally impossible to reach `setPin` on a change path without `verifyPin` having returned
    `ok`.
  - **No non-null assertion (`currentPin!`) and no `?? ""` fallback.** `parsed.data.currentPin` is
    `string | undefined`; TypeScript will not narrow it across a separate `if (isChange && !currentPin)`
    guard, so a flat implementation *forces* an assertion — and an assertion is exactly what silently
    survives a later edit that drops the guard. The early `return` at 6a is the narrowing.
  - **Never gate step 6b on the truthiness or presence of `currentPin`.** `if (isChange && currentPin)
    { verifyPin(…) }` is a full bypass: omit the field and the PIN check is skipped. The presence
    check must `return`, never `skip`.
  - **`null` is normalised away before zod, so a `=== null` test never fires.** `FormData.get()`
    returns `null` for a missing part; `?? undefined` converts it. Any absence check written against
    `null` is dead code and the gate is open. Check falsiness of the *parsed* value, as in 6a.
  - Rejected shapes, all of which must 400 at 6a or at zod: field omitted (`null` → `undefined` → 6a),
    empty string (zod regex), wrong type such as a file part (zod), non-digits or wrong length (zod).
- When `isChange` is false, a supplied `currentPin` is ignored (the whole block is skipped). Rejecting
  it would add a way to break onboarding for no benefit.
- Update the route's header comment to state the new bar and cite the `account/delete.ts` precedent.

#### 1b. The service helper — `pinExists` (fail-closed `hasPin`)

**File**: `src/lib/services/parent-pin.ts`

**Intent**: `hasPin` (`:57-60`) swallows the query error and returns `false`. On this route `false`
means "first-time set" — i.e. *skip the marker guard and skip the `currentPin` requirement*. Once a
real change-PIN form exists, that fail-open is the gate's weakest link, so the route must be able to
tell "no PIN" from "could not tell".

**Contract**: additive only, no behaviour change for any existing caller.

- Export `pinExists(client: SupabaseClient): Promise<boolean | null>` — the current `hasPin` body, but
  returning `null` when the select returns an `error`.
- Re-express `hasPin` as `(await pinExists(client)) === true`. Its contract is unchanged, so
  `src/pages/app/parent-pin.astro:13` (mode selection) keeps its exact current semantics and needs no
  edit. Do **not** change `hasPin`'s signature.
- `set.ts` calls `pinExists` and returns `503 { ok: false }` on `null`.

**Test gap, stated deliberately:** the suite runs against a real Supabase with no mocks, so the
`null` branch has no cheap test. It is a fail-closed defence-in-depth guard, not a tested behaviour —
verified by reading, listed under `## Known risks`.

#### 2. Route tests

**File**: `tests/parent-pin-routes.test.ts`

**Intent**: Pin the new contract, prove there is no throttle bypass, and prove first-time set is
untouched.

**Contract**: extend the existing `describe("POST /api/parent/pin/set")` block. The
`setCtx`/`pinContext` helpers currently send only `{ pin }`; add a variant that also sends
`currentPin`. Follow the file's existing idioms: `signedInJar(account)` for a real session, and
`jar.set(PARENT_VERIFIED_COOKIE, signMarker(a.id, Date.now() + 60_000))` to arm a marker. Durable
assertions read `account_settings` back through the service-role `admin` client from
`tests/helpers/supabase.ts` (L-002), never through the response body alone.

**Test 1 is an in-place UPDATE of an existing case, tests 2–7 are new** — 6 net-new `it()` blocks.
Do not add a second happy-path change test alongside the updated `:83`; that duplication is what the
old "+7 new" wording implied and it is wrong.

1. **(UPDATE `it("reset succeeds WITH a valid marker …")` at `:83`.)** Change with a valid marker +
   correct `currentPin` → 200; the new PIN verifies via `/api/parent/pin/verify` and the old one
   returns 401. Sending `currentPin` here is the intentional contract change — test 2 covers the old
   request shape and asserts it is now rejected.
2. **Change with a valid marker and NO `currentPin` → 400 `"invalid"`**, `pin_hash` unchanged **and
   `failed_attempts` unchanged** (admin read-back). *This is the anti-bypass assertion for the old
   request shape: the request must be rejected before any PIN comparison, so it must neither change
   the PIN nor burn an attempt.*
3. **Wrong `currentPin` → 401 `"wrong"`, `pin_hash` unchanged, and `failed_attempts` incremented by
   exactly 1** (admin read-back). *This is the throttle-participation proof.* Assert the delta against
   the value read immediately before the request, not against a hard-coded 0.
4. **Lockout, on a dedicated throwaway account** so it cannot leak into sibling tests. Two assertions,
   both required:
   a. Wrong `currentPin` repeatedly → the **5th** attempt returns 429 `"locked"` (`MAX_FAILED_ATTEMPTS`
      = 5, `parent-pin.ts:20`); `pin_hash` is still the original.
   b. **While `locked_until` is live, a change request carrying the CORRECT `currentPin` also returns
      429 `"locked"`; `pin_hash` is still the original AND `failed_attempts` is still ≥ 5 with
      `locked_until` still in the future.** *This is the assertion that proves the lock blocks the
      change itself, not merely wrong guesses — without it, "respects `locked_until`" is inherited
      from `verifyPin` but never verified on this route.*
      **It is also the throttle-reset-oracle assertion, and this is the sharper reason it must
      exist.** `setPin` unconditionally writes `failed_attempts: 0, locked_until: null`
      (`parent-pin.ts:73`). So *any* path that reaches `setPin` while locked is a free lockout reset.
      Today that path is live: a marker-only POST to `/api/parent/pin/set` clears the throttle
      outright. The new guard order closes it — `verifyPin` short-circuits on a live `locked_until`
      before `setPin` is reached — and 4b is what proves the closure rather than assuming it.
5. **Malformed new `pin` + wrong `currentPin` → 400 `"invalid"` and `failed_attempts` NOT
   incremented** — zod precedes `verifyPin`, so a malformed request never burns an attempt.
6. **`currentPin === pin` → 400 `"same-as-current"`**, and `failed_attempts` is 0 (the correct
   current PIN reset it), proving the comparison runs *after* `verifyPin`.
7. **No marker + existing PIN + correct `currentPin` → still 403 `"forbidden"`**, `pin_hash`
   unchanged **and `failed_attempts` unchanged** — the marker guard is not weakened by the new factor,
   both are required, and a markerless caller cannot burn the parent's throttle.

**Every "was not changed / was not incremented" assertion reads `account_settings` back through the
service-role `admin` client (L-002).** A test that asserts only the HTTP status proves nothing about a
bypass: a route that returns 400 and *then* writes the PIN would pass it.

Leave `it("first-time set is open …")` at `:52`, `it("rejects a non-numeric / wrong-length PIN …")` at
`:63`, `it("reset guard: … without a valid marker is 403")` at `:75` and `it("401 when unauthenticated …")`
at `:93` **untouched — they must stay green unmodified**. `:52` is the load-bearing onboarding guard,
and `describe("POST /api/parent/pin/verify")`'s `beforeAll` (`:104`) also seeds its PIN through the
first-time-set path, so it too must stay green with no edit.

#### 3. Contract registry

**File**: `docs/reference/contract-surfaces.md`

**Intent**: The registry documents gate orders for security-critical routes (see the
`POST /api/account/delete` entry at `:61`). The PIN routes have no entry; the change-PIN contract is
exactly the kind of load-bearing ordering it exists to record.

**Contract**: add a short **"Parent PIN routes (RLS surface)"** section after the
`public.account_settings` section, naming `POST /api/parent/pin/set` and `POST /api/parent/pin/verify`
with their gate orders, the first-set-open vs change-requires-marker+currentPin split, and the
`STATUS_FOR` vocabulary. No column or policy text changes — nothing about the table moved.

### Success Criteria

#### Automated Verification

- Lint clean: `npm run lint`
- Unit suite green and grown: `npm test` — at least 305 `it()` (299 baseline + **6 net-new** blocks,
  tests 2–7; test 1 is an in-place update of the existing `:83` case, not an addition. If test 4 is
  split into two `it()` blocks the count is 306 — the criterion is a floor, not an equality)
- `tests/parent-pin-routes.test.ts` passes, including the untouched first-time-set case at `:52`
- `tests/parent-pin.test.ts` and `tests/account-settings-isolation.test.ts` pass unmodified — the
  former is the regression check that re-expressing `hasPin` over `pinExists` (§1b) changed nothing
- E2E baseline still green: `npx playwright test` — 15/15 (the gate spec drives first-time set only,
  which is unchanged)
- `src/pages/api/parent/pin/set.ts` still exports `prerender = false`

#### Manual Verification

- Deliberate-break check: temporarily change the route to skip `verifyPin` when `currentPin` is
  supplied; confirm route tests 1, 3 and 4 go red. Revert.
- Reading the route top-to-bottom, the guard order matches `account/delete.ts:41-64` step for step.

**Implementation Note**: After this phase and all automated verification passes, pause for manual
confirmation before proceeding.

---

## Phase 2: `ChangePinSection` island + Polish strings, mounted on `/app/report`

### Overview

The user-visible half: new dictionary keys, a React island reusing the deletion flow's error-mapping
shape, and its mount on the already-gated report page.

### Changes Required

#### 1. Dictionary

**File**: `src/i18n/pl.ts`

**Intent**: All new copy through the dictionary (L-003). Keys go **inside the existing `parentPin`
block** (`:351-370`) so the reused labels and errors sit next to the new ones, matching the file's
shallow-nesting habit (sub-objects only for `errors` maps).

**Contract**: exact keys to add.

Under `parentPin`:

| Key | Value |
| --- | --- |
| `changeHeading` | `"Zmiana PIN-u rodzica"` |
| `changeIntro` | `"Podaj obecny PIN, żeby ustawić nowy."` |
| `currentPinLabel` | `"Obecny PIN"` |
| `newPinLabel` | `"Nowy PIN (4–6 cyfr)"` |
| `newPinConfirmLabel` | `"Powtórz nowy PIN"` |
| `changeSubmit` | `"Zmień PIN"` |
| `changeSuccess` | `"PIN został zmieniony."` |

Under `parentPin.errors`:

| Key | Value |
| --- | --- |
| `sameAsCurrent` | `"Nowy PIN musi się różnić od obecnego."` |

Reused unchanged: `parentPin.pending`, `parentPin.errors.{invalid,mismatch,wrong,locked,generic}`,
and `deletion.sessionExpired`.

Precede the added keys with a 3–6 line `//` comment naming the slice (change-PIN on the report page),
the guardrail (current PIN re-proved under the throttle; no forgot-PIN recovery exists), and the
standing `Draft Polish — pending native-speaker review.` line, matching `pl.ts:372-377` / `410-415`.

**Constraint (load-bearing, see Critical Implementation Details):** the three field labels must remain
mutually non-substring, and none may be a substring of `t.deletion.accountPinLabel` (`"PIN rodzica"`)
— that one holds today.

**Known collision, verified, and the rule that contains it:** `t.parentPin.pinLabel` is
`"PIN (4–6 cyfr)"`, which **is** a case-insensitive substring of the proposed
`newPinLabel = "Nowy PIN (4–6 cyfr)"`. Playwright's `getByLabel` matches substrings, so
`getByLabel(t.parentPin.pinLabel)` would match the new-PIN field.

This is safe **only** because the two never render on the same page: `pinLabel` belongs to
`ParentPinGate` on `/app/parent-pin`, and the three existing uses
(`e2e/parent-surfaces.spec.ts:27, :58, :63`) are all on the gate page. The containment rule, which the
implementer must not break:

- **Never use `getByLabel(t.parentPin.pinLabel)` in an `/app/report` context**, in Playwright or in a
  jsdom test that renders both components. Use `t.parentPin.newPinLabel` (or `{ exact: true }`).
- If a future change puts a `pinLabel` field on the report page, `newPinLabel` must be renamed first
  (e.g. `"Nowy PIN (od 4 do 6 cyfr)"`), not disambiguated with `exact:` at every call site.

#### 2. The island

**File**: `src/components/parent/ChangePinSection.tsx` (new)

**Intent**: A section card on the report page with three PIN fields that POSTs to
`/api/parent/pin/set` and translates each response status into the right Polish message — the same
job `DeleteAccountSection` does, without the destructive dialog.

**Contract**:
- Default export, no props. `client:load` island (`.tsx`, no Next.js directives).
- Markup: `<section>` with `aria-labelledby` → its `<h2>` id (so it exposes `role="region"` named
  `t.parentPin.changeHeading`), intro `<p>`, three labelled `type="password" inputMode="numeric"`
  inputs (`autoComplete="off"`, digits-only `onChange` filter as `ParentPinGate.tsx:92` does), a
  submit `Button`, and one message `<p role="status">`. Card styling mirrors
  `DeleteAccountSection.tsx:55` minus `border-destructive/30` — this is not a danger zone. Classes
  merged with `cn()` where composed.
- Client pre-flight before any fetch, mirroring `ParentPinGate.tsx:41-48`: new PIN failing
  `/^\d{4,6}$/` → `errors.invalid`; new PIN ≠ repeat → `errors.mismatch`. The same-as-current rule is
  **server-only** (single source of truth, and the parent has already typed the current PIN).
- Request: `FormData` with `pin` = new PIN and `currentPin` = current PIN. `fetch("/api/parent/pin/set", { method: "POST", body })`.
- Response map — copied from `DeleteAccountSection.tsx:33-52`:

| Status / reason | Result |
| --- | --- |
| 200 | clear all three fields, show `t.parentPin.changeSuccess`, stay on the page |
| 403 | `window.location.href = "/app/parent-pin"`, message `t.deletion.sessionExpired` |
| 429 | `t.parentPin.errors.locked` |
| 401 + `reason: "wrong"` | `t.parentPin.errors.wrong` |
| 401 without `reason: "wrong"` | `t.deletion.sessionExpired` (the F5 lesson — never a misleading wrong-PIN message on a dead session) |
| 400 + `reason: "same-as-current"` | `t.parentPin.errors.sameAsCurrent` |
| 400 + `reason: "invalid"` | `t.parentPin.errors.invalid` |
| anything else / thrown | `t.parentPin.errors.generic` |

- Button disabled while pending; label swaps to `t.parentPin.pending`. Do not import
  `ParentPinGate.reasonToMessage`.

#### 3. Mount

**File**: `src/pages/app/report.astro`

**Intent**: Place the card in the parent zone, above the deletion danger zone.

**Contract**: import and render `<ChangePinSection client:load />` in a wrapper `<div>` inserted after
the `WeeklyReport` block and before the deletion block. Grid bookkeeping: new wrapper takes
`lg:col-span-2 lg:col-start-1 lg:row-start-2`; the deletion wrapper moves to `lg:row-start-3`; the
`<aside>` moves from `lg:row-span-2` to `lg:row-span-3`. The deletion block keeps `order-last` so it
stays last on a phone. Add a one-line placement comment in the file's existing style. No frontmatter
change — the marker gate at `:22-29` already protects this page, and `PROTECTED_ROUTES` needs no edit.

#### 4. Component test

**File**: `tests/change-pin-section.test.tsx` (new)

**Intent**: Lock the client-side status→copy/navigation map, which is where a wrong branch produces a
misleading security message.

**Contract**: jsdom (`// @vitest-environment jsdom`), modelled line-for-line on
`tests/delete-account-section.test.tsx` — `vi.stubGlobal("fetch", …)`, the `window.location.href`
setter spy at `:32-48`, `@testing-library/react`. Locate fields with `getByLabelText(t.parentPin.*)`
and the message with `getByRole("status")`.

`it()` blocks: 200 → success copy + fields cleared + **no navigation**; 403 → navigates to
`/app/parent-pin`; 429 → lockout copy; 401 with `reason:"wrong"` → wrong-PIN copy; 401 without a
reason → session-expired copy; 400 `same-as-current` → the new copy; client pre-flight — mismatched
repeat shows `errors.mismatch` and **never calls fetch**.

### Success Criteria

#### Automated Verification

- Lint clean: `npm run lint`
- Unit suite green and grown: `npm test` — at least 312 `it()` (Phase 1 total + 7)
- `tests/change-pin-section.test.tsx` passes
- No inline user-visible literal in the new `.tsx` — grep the new file for quoted Polish text (L-003)
- E2E baseline still green: `npx playwright test` — 15/15 (no existing locator broken by the new
  labels/heading)

#### Manual Verification

- On a phone-width viewport (712px, the `touch` project's width) the report page reads:
  weekly report → change PIN → rail → danger zone; nothing overflows the viewport.
- Exactly one `h1` on `/app/report` ("Raport tygodniowy"); the new card's heading is an `h2`.
- The already-shipped "Bezpieczne środowisko" card is byte-identical to before this change.
- Changing the PIN in a real browser shows the success line and does not navigate away.

**Implementation Note**: After this phase and all automated verification passes, pause for manual
confirmation before proceeding.

---

## Phase 3: E2E journey — the PIN actually changes

### Overview

One browser test proving the durable business outcome across real navigations and the real signed
cookie: after a change, the old PIN is rejected at the gate and the new one is accepted.

### Changes Required

#### 1. The spec

**File**: `e2e/parent-surfaces.spec.ts`

**Intent**: This is the flow that genuinely needs a browser. Only this layer exercises the per-page
marker gate through real navigations (the middleware does **not** check the PIN), a real form
submission from a hydrated island, and the durable end state at the gate.

**Contract**: one new `test()` in the existing file, reusing the module-local
`setPinAndLandOnReport` helper at `:21`. Journey:

1. `provisionAccount("e2e-pinchange")`, `signInViaUI`, `setPinAndLandOnReport(page, "2468")`,
   `waitForIslands(page)`.
2. Scope to `page.getByRole("region", { name: t.parentPin.changeHeading })`.
3. Fill `getByLabel(t.parentPin.currentPinLabel)` = `"2468"`,
   `getByLabel(t.parentPin.newPinLabel)` = `"1357"`,
   `getByLabel(t.parentPin.newPinConfirmLabel)` = `"1357"`; click
   `getByRole("button", { name: t.parentPin.changeSubmit })`.
4. Expect the region's `getByRole("status")` to have text `t.parentPin.changeSuccess`.
5. `context.clearCookies({ name: "parent_verified" })` — the sanctioned exception documented in
   `e2e/CLAUDE.md`; the only way to simulate marker expiry without a 15-minute sleep. Do not poke any
   other cookie by name.
6. `goto("/app/report")` → redirected to the gate in **enter** mode.
7. Old PIN `"2468"` → `getByRole("alert")` has `t.parentPin.errors.wrong`. *(1 failed attempt — well
   under the 5-attempt lockout.)*
8. New PIN `"1357"` → lands on `/app/report`, heading `t.report.heading` visible.
9. `try/finally` with `deleteUser(account.id)`, matching the file's provisioning convention.

All matched strings come from the dictionary via `e2e/helpers/i18n.ts`. `getByRole`/`getByLabel` only
— no testids, no CSS/XPath. Never `page.waitForTimeout()`.

Also extend the spec file's provenance header (`:6-19`) with the new risk, in the existing style.

**Deliberately NOT e2e'd** — so the `/10x-e2e` step does not invent them:
- **The lockout / throttle.** Requires a forced 60-second sleep; the file's header already records
  that decision at `:16`. Covered by Phase 1 route tests.
- **The 403 stale-marker redirect from the change form.** Reaching it means clearing the cookie
  *without* navigating, then submitting — fiddly, and the mapping is already locked by the Phase 2
  jsdom test.
- **Same-as-current and malformed-PIN validation.** Pure contract, covered in Phases 1–2.

### Success Criteria

#### Automated Verification

- `npx playwright test` green with **16 runs** (15 baseline + 1; the new test runs in `desktop` only,
  since the `touch` project's `testMatch` is scoped to `gameplay-restore.spec.ts`)
- The two existing tests in `e2e/parent-surfaces.spec.ts` pass unmodified
- Lint clean: `npm run lint`
- Unit suite unchanged and green: `npm test`

#### Manual Verification

- The new test is stable across three consecutive runs (no flake from island hydration timing).
- The local Supabase stack has no leaked `e2e-pinchange-*` users after the run.

---

## Testing Strategy

### Unit tests (Vitest, real Supabase — no mocks)

- **Route contract** (`tests/parent-pin-routes.test.ts`): the seven cases in Phase 1. The
  throttle-participation case (wrong `currentPin` → `failed_attempts + 1`) and the ordering case
  (malformed body → no increment) are the two that make a bypass detectable.
- **Durable state, not responses** (L-002): every "the PIN did not change" assertion reads `pin_hash`
  back through the service-role `admin` client from `tests/helpers/supabase.ts`. The admin client is
  used **only** to read back and to provision/tear down — never to act as a user under test.
- **Island mapping** (`tests/change-pin-section.test.tsx`): the seven cases in Phase 2.
- **Untouched and must stay green**: `tests/parent-pin.test.ts`,
  `tests/account-settings-isolation.test.ts`, `tests/account-deletion.test.ts`,
  `tests/password-reset-marker.test.ts`.

### Integration / E2E

- One journey (Phase 3): change → old PIN rejected → new PIN admitted.

### Manual testing steps

1. `npx supabase start`; sign in as `ui-polish-demo@example.test`, PIN `2468`.
2. Open `/app/report`; confirm the change-PIN card sits above the danger zone and the safety card is
   unchanged.
3. Wrong current PIN → soft inline error; repeat 5× → lockout copy; wait 60 s; confirm the correct PIN
   works again. *(This is where the pre-existing `failed_attempts`-never-resets defect will be visible
   — the next wrong PIN re-locks instantly. Expected; see D7.)*
4. New PIN equal to current → "Nowy PIN musi się różnić od obecnego."
5. Successful change → success line, no navigation; sign out and back in, verify the new PIN gates.
6. Resize to 712px and re-check layout and reading order.

## Performance Considerations

`verifyPin` adds one `scryptSync` (Node default cost) per change-PIN request, on a form a parent
submits at most a handful of times ever. Same cost the gate already pays on every PIN entry. No
concern.

## Migration Notes

**None.** No schema change, no data backfill, no RLS change. The four existing `account_settings`
policies and the `register_pin_failure` RPC are used exactly as they are.

If a future change overrules the toggle verdicts and persists a setting, L-001 applies: the column and
its RLS treatment ship in the **same** migration file (`YYYYMMDDHHmmss_description.sql`), with an
explicit header note that the four existing column-agnostic policies already cover the new column,
plus an assertion added to `tests/account-settings-isolation.test.ts`,
`docs/reference/contract-surfaces.md:41-55` updated, and `AccountSettingsRow`
(`src/lib/services/parent-pin.ts:25-30`) hand-updated — **there are no generated Supabase types, so a
new column produces zero compile errors.**

## Autonomous decisions

This run has no human in the loop (`context/runs/2026-08-22-autonomous-five/agent-contract.md`, hard
rule 1). The `/10x-plan` skill's complexity confirmation and its 3–5 clarifying questions were
**decided, not asked**. Each decision below records what was chosen, what was rejected, why, and what
would reverse it.

### D1 — Scope: build change-PIN only; drop all four toggles

**Chosen.** Ship one new capability. Rejected: transcribing the mockup's four switches, and the
middle option of persisting them as booleans "for later".
**Why:** two of the four are explicit PRD v3 non-goals (`:167`, `:170`); one is unconditional with no
column and no "off" path; one ("Otrzymuj podsumowanie") implies scheduled e-mail delivery that does
not exist. The web mockup draws four and the mobile mockup three — a real setting cannot exist only at
desktop width. The agent contract forbids shipping controls that do nothing, and the honest form of
all four already ships as the "Bezpieczne środowisko" statements card.
**Reverses if:** the maintainer names a specific toggle as a real setting *and* a consumer for its
value. Storage alone is not enough — a persisted boolean nothing reads is the same dead switch.

### D2 — Leave the shipped "Bezpieczne środowisko" card completely alone

**Chosen.** No rename to the mockup's "Bezpieczne ustawienia", no restyle, no reorder.
**Why:** the explicit instruction is that churn is not parity, and the current copy is not wrong — a
statements card is *more* honest than a settings label for content that is not settable.
**Reverses if:** a native-speaker copy review finds one of the four bullets factually wrong. That
would be a copy fix, not a mockup-parity rename.

### D3 — Placement: a section on `/app/report`, not a new `/app/security` route

**Chosen.** `ChangePinSection` island on the existing report page. Rejected: a dedicated route with a
fifth bottom-nav tab.
**Why:** a settings shell whose only occupant is one form is a bigger change than the form. The
report page is already marker-gated (`report.astro:22-29`), already the parent zone, already hosts
`DeleteAccountSection`. A new route would need the four-line gate copy-pasted into its frontmatter
(forgetting it = a silently open parent screen), a fifth tab in a `justify-around` 4-tab bottom bar,
a widened `active` union at `AppShell.astro:38`, and a new `t.nav.items` string. And
`t.parentPin.note` (`pl.ts:357`) already promises *"raport tygodniowy i ustawienia konta"* — this
keeps a promise the product already made.
**Reverses if:** a second parent setting appears. Two forms justify a shell; one does not. At that
point extract `requireParent()` first (D6).

### D4 — Security: re-ask for the current PIN. **This is the open decision, closed.**

**Chosen.** A PIN change requires the marker **and** the current PIN, verified fresh under the
throttle. Rejected: marker-only (the current behaviour).
**Why — I tried to defeat the research's argument and could not:**
- The threat model is named in the codebase itself (`profiles/delete.ts:19-28`): *"a child on the
  parent's logged-in device"*. Inside the 15-minute window that child needs no PIN at all today.
- **There is no forgot-PIN recovery flow** (open since the S-07 impl-review, never built). So a
  hostile or accidental PIN change is a **permanent** lockout from the parent zone — and unlike
  account deletion, which is loud (signed out onto a farewell page), it is **silent**. The parent
  finds out the next time they try to get in, with no idea what happened. On the "irreversible +
  undetectable" axis this scores worse than the action the project already decided needs a fresh PIN.
- The precedent is directly on point and written down twice in this codebase
  (`account/delete.ts:33-35`, `DeleteAccountSection.tsx:17-18`). Choosing the weaker bar here would
  be the project quietly contradicting a decision it documented.
- The strongest counter — *the parent typed this PIN under 15 minutes ago, so the field is pure
  friction* — fails on cost/benefit: it is one extra field on a form the parent deliberately opened,
  set against a silent unrecoverable lockout. And it is only "friction they already paid" if the
  person at the keyboard is the parent, which is exactly what the marker cannot establish.
- Bonus: this **closes a live hole**. Today `/api/parent/pin/set` accepts a marker-only PIN change.
- **The mockup itself agrees.** Re-verified against the PNG during the plan review: the web mockup's
  own footnote inside the PIN card reads *"PIN będzie wymagany przy zmianie ważnych ustawień oraz w
  panelu rodzica."* The design states the PIN is required **when changing important settings**, which
  is exactly what D4 implements. Note also that neither mockup draws a *current*-PIN field at all —
  both show `Wpisz 4 cyfry` + `Potwierdź PIN`, i.e. first-time set. The mockup is not a change form.
**Reverses if:** forgot-PIN recovery ships. Once a locked-out parent can recover, the blast radius
drops from permanent to inconvenient and the third field becomes hard to justify.

### D5 — Extend `POST /api/parent/pin/set`; do not add an endpoint

**Chosen.** One route, one conditional factor. Rejected: a new `POST /api/parent/pin/change`.
**Why:** `set.ts:31-34` already carries the change-PIN semantics — its 403-on-overwrite guard *is*
the "you may not silently replace an existing PIN" invariant. A second endpoint would either
duplicate that guard (two files to keep in sync on the app's most security-sensitive rule) or leave
`set.ts` as a weaker parallel path that still permits a marker-only change — i.e. the new endpoint
would be a suggestion, not a gate. Strengthening the existing guard in place means there is exactly
one way to write `pin_hash`. The cost is one optional field and a conditional; the research
independently concluded no new endpoint is required.
**Reverses if:** the change-PIN flow ever needs a genuinely different response shape or side effects
(e.g. revoking other sessions) that would make `set.ts` a two-personality route.

### D6 — `requireParent(context)` extraction: **out of scope for this change**

**Chosen.** Do not extract. Record as a follow-up.
**Why:** the refactor's motivating risk is "a fifth forgotten paste of the gate" — and this change
adds **zero** new parent-gated surfaces. The island lands on `/app/report`, which is already gated;
the route it calls already has the gate. The fifth paste never materialises here, so extracting now
would touch four security-critical call sites (`report.astro:28-29`, `account/delete.ts:51-52`,
`profiles/delete.ts:38-39`, `pin/set.ts:32-33`) inside a diff whose whole point is a narrow,
reviewable change to the PIN bar. Mixing a cross-cutting refactor of the gate into that diff makes
the security review harder at exactly the moment it matters most. If it were in scope it would be a
Phase 0 refactor with its own tests, not a drive-by.
**Reverses if:** D3 is overruled and a new `/app/*` parent page is added. The fifth paste then exists,
and the extraction becomes a Phase 0 with its own tests **before** the page is written.

### D7 — `failed_attempts` never resets on lock expiry: note, do not fix

**Chosen.** Document as a follow-up; route through the throttle exactly as-is.
**Why:** `register_pin_failure` has no reset path and lock expiry does not clear the counter, so after
5 failures the 60-second lock lapses with the counter still ≥5 and the next wrong PIN re-locks
instantly — one guess per minute, forever. It is real, it is pre-existing, and this change makes it
easier to reach. But fixing it means changing the RPC (a migration) in the same commit that adds a new
*caller* of that RPC. A throttle test failure would then be ambiguous: new caller or new SQL? This
change deliberately routes through the throttle unchanged so its tests prove one thing.
**Reverses if:** the Phase 3 e2e or manual testing shows a parent can hit the sticky lockout in normal
use. Then it is promoted to its own change ahead of this one.

### D8 — Forgot-PIN recovery: raise it, do not inherit it

**Chosen.** Out of scope, recorded explicitly in the handoff as the highest-value follow-up.
**Why:** it is the reason D4 had to go the strict way. Building it here would mean an e-mail-based
recovery flow — a second re-auth channel, new tokens, new templates — a larger change than this one.
Naming it is the honest move; silently depending on its absence is not.
**Reverses if:** the maintainer wants recovery bundled. That is a separate change and should be
planned as one; if it lands first, revisit D4.

### D9 — The new PIN must differ from the current one

**Chosen.** Server-side rejection with `400 { reason: "same-as-current" }`, checked **after**
`verifyPin`. Rejected: silently accepting a no-op "change".
**Why:** accepting it would report success while changing nothing *and* re-mint the trust marker — a
no-op with a security-relevant side effect, and confusing feedback. Placing the check after
`verifyPin` copies `delete.ts:62`'s documented ordering lesson: the second factor must never be usable
as a cheaper pre-flight that skips burning a throttle attempt.
**Reverses if:** the extra error state proves noisy in use. Deleting the check and its one string
touches nothing else.

### D10 — Keep the marker re-mint on success; do not clear it

**Chosen.** `setParentVerified` after a successful change stays (existing `set.ts:43` behaviour).
Rejected: clearing the marker, which would need a new `clearParentVerified` helper mirroring
`password-reset.ts:89`.
**Why:** with D4 in place the parent proved the current PIN seconds ago — exactly the proof
`verify.ts:37` re-mints on. Clearing would bounce the parent off the page they are standing on for no
security gain. Stated limitation rather than silent inheritance: the marker is a per-browser cookie,
so a change does not invalidate a marker held in another browser; revoking those needs server-side
session versioning, which does not exist.
**Reverses if:** a "sign other sessions out" requirement appears — at which point cookie clearing is
the wrong mechanism anyway.

### D11 — Phase count and what needs a browser

**Chosen.** Three phases: server contract → island + strings + mount → one e2e. Rejected: a
strings-only phase (nothing to test, and it would leave an unused component mid-branch) and a
four-phase split with the island landing unmounted.
**Why:** each phase is independently committable and independently green. Phase 1 is the security
core and is provable entirely in Vitest. Phase 3 is the only genuinely browser-shaped risk: the
per-page marker gate across real navigations, a hydrated island's real form submission, and the
durable outcome at the gate — none of which the route tests can see. Throttle/lockout stays out of
the browser (forced sleep, per `e2e/parent-surfaces.spec.ts:16`).
**Reverses if:** Phase 1 grows beyond the seven route tests — then the doc update splits out.

### D12 — Implementation step: the skill's interactive gates were decided, not asked

**Chosen.** `/10x-implement`'s manual-confirmation gate, dirty-path prompt, commit-message approval
and next-phase prompt were all resolved by the implementer. Rejected: stopping to ask, which the run's
agent contract (hard rule 1) forbids.
**Why:** no human is in the loop. Concretely: manual criterion **1.7 was actually executed** (see D14),
1.8 was executed as a top-to-bottom read against `account/delete.ts:41-64`, and staging was done with
explicit paths only — the working tree carries four other features' `context/changes/` folders plus
`context/runs/`, so `git add -A` would have swept them in.
**Reverses if:** a human is present; then 1.7/1.8 and the browser-only manual criteria go back to the
human gate.

### D13 — Route test 4 ships as ONE `it()` carrying both the 4a and 4b assertions

**Chosen.** A single lockout test on a dedicated throwaway account, asserting (a) the 5th wrong
`currentPin` is 429 and (b) a live lock refuses the *correct* current PIN with `pin_hash`,
`failed_attempts` and `locked_until` all intact. Rejected: two `it()` blocks.
**Why:** the plan allows either ("the criterion is a floor, not an equality"), and 4b must run **inside
the same live 60-second lock window** that 4a creates. Two blocks would either re-seed five failures
(doubling the scrypt cost) or share state across `it()` boundaries with a wall-clock race — the exact
flake the review's own blind-spot note on 4b warns about. Net-new count is therefore exactly 6 → 305.
**Reverses if:** 4b ever needs to fail independently of 4a for diagnosis.

### D14 — The deliberate-break check was run twice, in both bypass shapes

**Chosen.** Before committing Phase 1, the gate was broken deliberately in the two shapes the review
named, and the suite watched go red each time, then restored and watched go green.
1. **Truthiness-gated verification** — `if (currentPin) { verifyPin(…) }` with the presence check
   removed (F1's exact "natural implementation"). Red: *"a marker WITHOUT currentPin no longer changes
   the PIN"* — the anti-bypass test — plus *"same-as-current"* as a cascade.
2. **`verifyPin` skipped** on the change path, presence check retained (criterion 1.7's wording).
   Red: *"a wrong currentPin … burns exactly one throttle attempt"* and *"the throttle locks the change
   path …"*.
Restored → 16/16 in the file, 305/305 overall.
**Why:** a security test that cannot fail certifies nothing, and F1's structure has no test of its own.
**Reverses if:** nothing — this is evidence, not a preference.

### D15 — The browser-only manual criteria were executed, not waived

**Chosen.** 2.6 (712px reading order / no overflow) and 2.9 (a real-browser change shows the success
line without navigating) were verified in a real browser rather than reasoned about from the markup.
Rejected: leaving them unticked with "unattended run cannot check visuals".

- **2.9** falls out of the Phase 3 e2e itself: it asserts the region's `role="status"` reads
  `t.parentPin.changeSuccess` **and** that the URL is still `/app/report` afterwards.
- **2.6** was checked with a throwaway spec (`e2e/_tmp712.spec.ts`, deleted after the run, never
  committed) at a 712px viewport. Measured top offsets: report `20` → change PIN `195` → rail `432` →
  danger zone `787`, i.e. exactly the order the plan specifies, with `document.documentElement`
  `scrollWidth === clientWidth === 712` (no horizontal overflow).

**Why:** these two rows are the only Phase 2 criteria that a static read cannot honestly settle, and a
temporary spec makes them observations instead of assertions. 2.7 and 2.8 *were* settled statically
(one `h1` from `AppShell`, the safety-card block byte-identical in `git diff` — only the `<aside>`'s
`lg:row-span-2` → `lg:row-span-3` changed, which is the grid bookkeeping the plan itself mandates).
**Reverses if:** nothing — but note both rows carry the **Phase 3** SHA, since the browser evidence
only became available once the e2e existed.

### Known issues inherited, not widened

> Superseded and expanded by `## Known risks` below (added by the plan review). Read that section;
> the two bullets here are kept for the decision trail.

- **`hasPin` fails open** (`parent-pin.ts:57-60`): it swallows query errors and reads as "no PIN",
  which would skip *both* the marker guard and the new `currentPin` requirement. Pre-existing
  (`set.ts:31` already depends on it). This plan hoists it to a **single** call so the two guards can
  never disagree, but does not change its error semantics. Hardening it would change
  `parent-pin.astro`'s mode selection too — a separate change.
- **The `parent_verified` marker has no domain-separation prefix** (`signMarker` signs the bare
  `accountId.expiresAt`, unlike `password-reset.ts:28-51` which prefixes `pwreset:`). Unchanged here;
  any *future* marker must carry its own prefix.

## Known risks

Added by the deep plan review (2026-08-22, `reviews/plan-review.md`). These are WARNINGs whose fix is
either out of scope or not contained enough to apply inside this change. The implementer carries them
knowingly; none of them blocks implementation.

### K1 — The sticky `failed_attempts` counter turns a mistyped current PIN into a permanent 1-guess-per-minute lockout

`register_pin_failure` has no decay and nothing resets `failed_attempts` except a **correct** PIN
(`parent-pin.ts:101-104`) or `setPin` (`:73`). Verified: those are the only two writers in the repo.
So once an account crosses 5 failures, the 60 s lock lapses with the counter still ≥ 5 and the next
wrong PIN re-arms a full cooldown — for ever, until a correct PIN is entered.

This change **creates a new way for a parent to reach that state**: a three-field form where the
current PIN is typed from memory. Combined with the absent forgot-PIN recovery (K2), a parent who
mistypes five times is in exactly the permanent-lockout scenario D4 exists to prevent — only now
reached by accident rather than by a hostile child.

**Why it is not fixed here:** D7's reasoning stands — fixing it means changing the same RPC this
change newly calls, which makes a throttle test failure ambiguous.

**But D7's reversal trigger will not fire in an unattended run.** D7 says it reverses "if the Phase 3
e2e or manual testing shows a parent can hit the sticky lockout in normal use", and the only place
that would surface is *Manual testing step 3*, which an unattended run does not execute. So: treat K1
as **confirmed by reading, not pending discovery**. It should become the next change after this one,
alongside or ahead of K2 — not something the implementer waits to observe.

### K2 — No forgot-PIN recovery exists

Open since the S-07 impl-review. It is the reason D4 went the strict way, and the reason K1 has no
escape hatch. Out of scope (it needs an e-mail re-auth channel, tokens and templates); recorded as the
highest-value follow-up. If it ships, revisit D4.

### K3 — `hasPin` fails open; mitigated on this route only

`hasPin` (`parent-pin.ts:57-60`) reads a query error as "no PIN", which on `set.ts` means *skip the
marker guard and skip the `currentPin` requirement*. Phase 1 §1b closes it **for this route** with an
additive fail-closed `pinExists`, but `hasPin` itself keeps its semantics for
`src/pages/app/parent-pin.astro:13` (a fail-open there renders the gate in `set` mode, which the
hardened route now rejects with 400/403 — annoying, not unsafe). The `null` branch has no test: the
suite runs against a real Supabase with no mocks, so the error path cannot be induced cheaply.
Verified by reading, not by test.

### K4 — A PIN change does not revoke a `parent_verified` marker held in another browser

The marker is a per-browser signed cookie with a 15-minute TTL; there is no server-side session
versioning to revoke against. So for up to 15 minutes after a change, a second browser that already
holds a marker still has parent-zone access — though it can no longer change the PIN again, because
that now needs the (new) current PIN. Accepted; revoking would need a mechanism that does not exist.

### K5 — `parent_verified` has no domain-separation prefix

`signMarker` signs the bare `accountId.expiresAt`, unlike `password-reset.ts:28-51` which prefixes
`pwreset:`. Unchanged here. Any *future* marker signed with `PARENT_SESSION_SECRET` must carry its own
prefix, or the two become cross-forgeable.

### K6 — `getByLabel` substring collision between `t.parentPin.pinLabel` and `newPinLabel`

Contained by a rule rather than a rename — see the Phase 2 dictionary constraint. Safe only while the
two labels never render on the same page.

## References

- Research: `context/changes/parent-security-screen/research.md`
- Agent contract: `context/runs/2026-08-22-autonomous-five/agent-contract.md`
- The precedent being copied: `src/pages/api/account/delete.ts:41-64`,
  `src/components/parent/DeleteAccountSection.tsx:27-52`
- The guard being extended: `src/pages/api/parent/pin/set.ts:18-34`
- The throttle: `src/lib/services/parent-pin.ts:87-120`,
  `supabase/migrations/20260702120000_pin_failure_throttle_rpc.sql:16-33`
- Prior decision on fresh-PIN re-auth: `context/archive/2026-07-11-account-deletion/plan-brief.md:22`
- E2E rules: `e2e/CLAUDE.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Route contract — conditional `currentPin` on `POST /api/parent/pin/set`

#### Automated

- [x] 1.1 Lint clean: `npm run lint` — 3d43c3c
- [x] 1.2 Unit suite green and grown: `npm test` — at least 305 `it()` — 3d43c3c
- [x] 1.3 `tests/parent-pin-routes.test.ts` passes, including the untouched first-time-set case — 3d43c3c
- [x] 1.4 `tests/parent-pin.test.ts` and `tests/account-settings-isolation.test.ts` pass unmodified (also the `hasPin`/`pinExists` regression check) — 3d43c3c
- [x] 1.5 E2E baseline still green: `npx playwright test` — 15/15 — 3d43c3c
- [x] 1.6 `src/pages/api/parent/pin/set.ts` still exports `prerender = false` — 3d43c3c

#### Manual

- [x] 1.7 Deliberate-break check: skipping `verifyPin` turns route tests 1, 3, 4 red; revert — 3d43c3c
- [x] 1.8 Guard order matches `account/delete.ts:41-64` step for step on a top-to-bottom read — 3d43c3c

### Phase 2: `ChangePinSection` island + Polish strings, mounted on `/app/report`

#### Automated

- [x] 2.1 Lint clean: `npm run lint` — f5417e8
- [x] 2.2 Unit suite green and grown: `npm test` — at least 312 `it()` — f5417e8
- [x] 2.3 `tests/change-pin-section.test.tsx` passes — f5417e8
- [x] 2.4 No inline user-visible literal in the new `.tsx` (L-003 grep) — f5417e8
- [x] 2.5 E2E baseline still green: `npx playwright test` — 15/15 — f5417e8

#### Manual

- [x] 2.6 At 712px the report reads report → change PIN → rail → danger zone, nothing overflows — ae5fa42
- [x] 2.7 Exactly one `h1` on `/app/report`; the new card's heading is an `h2` — f5417e8
- [x] 2.8 The "Bezpieczne środowisko" card is byte-identical to before this change — f5417e8
- [x] 2.9 A real-browser PIN change shows the success line and does not navigate away — ae5fa42

### Phase 3: E2E journey — the PIN actually changes

#### Automated

- [x] 3.1 `npx playwright test` green with 16 runs — ae5fa42
- [x] 3.2 The two existing tests in `e2e/parent-surfaces.spec.ts` pass unmodified — ae5fa42
- [x] 3.3 Lint clean: `npm run lint` — ae5fa42
- [x] 3.4 Unit suite unchanged and green: `npm test` — ae5fa42

#### Manual

- [x] 3.5 The new test is stable across three consecutive runs — ae5fa42
- [x] 3.6 No leaked `e2e-pinchange-*` users in the local stack after the run — ae5fa42
