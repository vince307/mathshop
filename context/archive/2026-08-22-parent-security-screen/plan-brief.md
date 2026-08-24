# Parent PIN change ("Zabezpieczenia") — Plan Brief

> Full plan: `context/changes/parent-security-screen/plan.md`
> Research: `context/changes/parent-security-screen/research.md`

## What & Why

Let a parent change their PIN from inside the parent zone, re-proving the **current** PIN under the
existing brute-force throttle. Today `/api/parent/pin/set` will overwrite an existing PIN on nothing
but a 15-minute-old cookie — so a child on the parent's logged-in device can silently change it, and
because **no forgot-PIN recovery exists**, that lockout is permanent and silent.

**The scope collapsed.** F3 was framed as "the full Zabezpieczenia screen: change PIN plus the
mockup's protective options". Research established that the mockup (`06-parent-pin-security`) is
**onboarding step 3, not a settings screen**; that its "Bezpieczne ustawienia" card is **already
shipped** as the static "Bezpieczne środowisko" statements card on `/app/report`; and that all four
toggles are decorative — two are explicit PRD v3 non-goals (`:167` no ads ever, `:170` difficulty
controls out), one is unconditional with no column, one promises scheduled e-mail that does not
exist. The tell: the web mockup draws four toggles, mobile draws three. **One new capability is
planned: changing the PIN.** Full evidence and the overrule path are at the top of the plan.

## Starting Point

`POST /api/parent/pin/set` already *is* the change-PIN route — `set.ts:31-34` refuses to overwrite an
existing PIN without a valid `parent_verified` marker (403), while first-time set stays open. That
reset path has **no UI**: `parent-pin.astro` renders `enter` mode whenever a PIN exists, so it is
reachable only by a direct POST. `/app/report` is already marker-gated and already hosts
`DeleteAccountSection`. `account_settings` already carries `pin_hash`, `failed_attempts`,
`locked_until`. Baselines: 299 Vitest `it()`, 15 Playwright runs.

## Desired End State

A parent past the PIN gate sees a "Zmiana PIN-u rodzica" card on `/app/report`, above the deletion
danger zone: current PIN, new PIN, repeat. On success an inline confirmation appears and they stay on
the report; the old PIN no longer opens the gate. A wrong current PIN gives a soft inline error **and
burns a throttle attempt**; five lock the account for 60 s exactly like every other wrong-PIN path.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Scope | Change PIN only; drop all four toggles | Two are PRD non-goals, one unconditional, one needs e-mail delivery that doesn't exist; contract forbids dead controls | Research → Plan |
| Shipped safety card | Leave byte-identical | Current copy isn't wrong; renaming to the mockup's label is churn, not parity | Plan |
| Placement | `ChangePinSection` island on `/app/report` | Zero routing work; page is already gated; a settings shell for one form is bigger than the form | Research → Plan |
| **Re-auth bar** | **Marker + fresh current PIN** | No forgot-PIN recovery ⇒ a silent PIN change is a permanent lockout, worse than deletion; `account/delete.ts:33-35` set this house rule twice | Research (recommended) → Plan (closed) |
| Endpoint | Extend `set.ts`; no new route | Its 403-on-overwrite guard *is* the invariant; a second endpoint forks it or leaves a weaker parallel path | Research → Plan |
| Throttle | Route through `verifyPin` unchanged | Only exported path that reads `pin_hash`; brings the atomic `register_pin_failure` RPC with it. Tests assert `failed_attempts + 1` via admin read-back | Plan |
| New ≠ current PIN | Reject `400 same-as-current`, **after** `verifyPin` | A no-op "success" that re-mints the trust marker is misleading; ordering copies `delete.ts:62` so the check can't be a free pre-flight | Plan |
| Marker on success | Keep the re-mint | Parent proved the PIN seconds ago; clearing would eject them from the page they're on | Plan |
| `requireParent()` extraction | Out of scope | This change adds **zero** new gated surfaces, so the "fifth forgotten paste" risk never materialises; a cross-cutting refactor would blur a security review | Plan |
| Sticky `failed_attempts` | Note, don't fix | Fixing needs a migration to the same RPC this change newly calls — a failure would be ambiguous | Plan |
| Migration | None | Change PIN uses existing columns only | Research → Plan |

## Scope

**In scope:** conditional `currentPin` on `POST /api/parent/pin/set`; `ChangePinSection` island; its
mount on `/app/report`; new `parentPin.change*` dictionary keys; route + component + e2e tests; a
`contract-surfaces.md` entry for the PIN routes.

**Out of scope:** the four toggles; onboarding wizard chrome; a `/app/security` route and fifth nav
tab; any migration; `requireParent()` extraction; the `failed_attempts`-never-resets fix; forgot-PIN
recovery; renaming the shipped safety card; any new artwork.

## Architecture / Approach

Extend, don't fork. `set.ts` hoists its existing `hasPin()` into one `const isChange` used by both the
marker guard and the new `currentPin` requirement, then follows the deletion route's guard order
verbatim: **503 → 401 → 403 marker → 400 zod → `verifyPin(currentPin)` under the throttle → 400
same-as-current → `setPin` → re-mint marker → 200**, with failures mapped through the same `STATUS_FOR`
vocabulary (`429/401/400/500`). The island copies `DeleteAccountSection`'s status→copy map — including
403 → hard-nav `/app/parent-pin` and the "401 is wrong-PIN only when the route says so" lesson — but
not its `AlertDialog` (a PIN change is reversible) and not `ParentPinGate.reasonToMessage` (no
`"forbidden"` case).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Route contract | `currentPin` required when a PIN exists, verified under the throttle; 7 route tests; `contract-surfaces.md` entry | A throttle bypass. Mitigated by asserting `failed_attempts + 1` and unchanged `pin_hash` via the admin client (L-002) |
| 2. Island + strings + mount | `ChangePinSection.tsx`, `parentPin.change*` keys, mounted above the danger zone; 7 jsdom tests | Locator collisions — `role="status"` already exists on the page (`WeeklyReport:120`) and `getByLabel` matches substrings. Mitigated by a named `role="region"` and non-substring labels |
| 3. E2E journey | One browser test: change → old PIN rejected at the gate → new PIN admitted | Hydration flake; grid/layout regression at 712px |

**Prerequisites:** local Supabase up (`npx supabase start`), `PARENT_SESSION_SECRET` set, `.env.test`
present. Branch `feat/parent-security-screen` cut from `feat/ui-polish`.
**Estimated effort:** ~1–2 sessions across 3 phases; Phase 1 carries most of the thinking.

## Open Risks & Assumptions

- **Assumes the maintainer accepts the scope collapse.** If any toggle is meant to be real, Phase 2
  changes shape and a migration reappears. The overrule path is spelled out at the top of the plan.
- **`hasPin` fails open** (`parent-pin.ts:57-60`) — a query error reads as "no PIN" and would skip both
  guards. Pre-existing; this plan hoists it to a single call so the guards can't disagree, but does not
  change its error semantics.
- **The sticky `failed_attempts` counter** will be visible during manual testing: after a lockout
  lapses, the next wrong PIN re-locks instantly. Expected, documented, deferred.
- **Forgot-PIN recovery still does not exist.** It is the reason the strict re-auth bar was chosen; if
  it ships, revisit that decision.
- **Changing the PIN does not invalidate a marker held in another browser** (per-cookie, no server-side
  session versioning). Stated, not fixed.

## Success Criteria (Summary)

- A parent can change their PIN from `/app/report` without leaving the page; the old PIN stops working
  and the new one admits — proved end-to-end in a browser.
- A wrong current PIN is throttled exactly like any other wrong PIN, proved by a durable read of
  `failed_attempts` — and no request shape reaches `setPin` without the current PIN.
- 299 → ≥312 Vitest tests, 15 → 16 Playwright runs, lint clean; no migration, no nav change, and the
  shipped safety card untouched.
