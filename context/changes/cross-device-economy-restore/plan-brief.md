# Cross-Device Economy Restore (S-10) — Plan Brief

> Full plan: `context/changes/cross-device-economy-restore/plan.md`
> Frame brief: `context/changes/cross-device-economy-restore/frame.md`

## What & Why

S-10 is not "build cross-device restore" — the restore is already true by construction; what's missing is the **proof** (a two-session restore-equivalence test reading economy state through RLS as a fresh session of the same account, plus one manual two-device walkthrough) and **two small shared-device hygiene fixes**: signout clearing the `parent_verified` marker, and a bfcache guard so a back-button after logout can't replay A's rendered pages. (Reframed problem statement, lifted from the frame.)

## Starting Point

All economy state is server-side, RLS-scoped, loaded per request; the frame found zero client persistence and full cache-header coverage. But every durability test reads via the RLS-bypassing admin client (a false-green for S-10's claim), signout leaves the PIN marker alive for its 15-min TTL, and nothing handles back/forward-cache restores (Safari ignores `no-store` there).

## Desired End State

An automated test proves the S-10 sentence end-to-end: session 1 writes through the real routes; a brand-new session of the same account reads identical wallet/shop/skills/level through RLS; another account's fresh session sees nothing. Signout revokes parent verification; a bfcache restore reloads through the server. One two-device walkthrough confirms the feel — then S-10 closes.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| What S-10 actually is | Verify + harden, not build | Restore is true by construction; the evidence bar surfaced a test gap + two residue defects | Frame |
| Evidence bar | Automated two-session tests + one manual walkthrough | User's stated bar in framing | Frame |
| Same-device clause | Includes browser residue, not just RLS | User's stated reading in framing | Frame |
| Test seam | Real routes in, fresh RLS session out | Closes the admin-client false-green at the exact seam test-plan Risk #2 names | Plan |
| bfcache fix | Global `pageshow`/`event.persisted` reload in Layout.astro | One place, portable incl. Safari; Clear-Site-Data misses exactly the browser that needs it | Plan |
| PIN-marker fix | Delete cookie in signout (S-11 pattern) | One line + a jar-asserted route test | Plan |

## Scope

**In scope:** `tests/cross-device-restore.test.ts` (two-session equality + cross-account negative + dev-time L-002 meta-check); signout clears `parent_verified` + route test; inline `pageshow` guard in `Layout.astro`; manual two-device/back-button/PIN walkthrough.

**Out of scope:** any restore-mechanism code, realtime sync of simultaneously-open tabs, Clear-Site-Data, PIN/session-revocation rework, E2E browser harness.

## Architecture / Approach

No production data-flow changes. The test mints two genuinely independent sessions for one account (fresh client + `signInWithPassword` each), drives the real write routes with the first, and asserts RLS-layer read equality with the second. The two hygiene fixes are a one-line cookie deletion and a three-line inline script.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. The cross-device proof | Two-session restore-equivalence test + cross-account negative | Accidental session sharing would quietly weaken the test to a same-session read |
| 2. Hygiene + walkthrough | PIN-marker revocation (tested), bfcache guard, manual evidence bar | bfcache behavior is browser-specific — Safari check is manual only |

**Prerequisites:** local Supabase stack; ideally a second device/browser (and Safari) for the walkthrough.
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- The bfcache guard's effect on Safari can only be verified manually; the script itself is trivially inert elsewhere.
- Assumes wallet seeding for the buy step is derivable from the shift payout (or admin provisioning) — test-internal detail.

## Success Criteria (Summary)

- A fresh session of the same account provably reads the exact state a prior session wrote — through RLS, not the admin client.
- A shared family tablet shows zero residue across account swaps: no PIN re-entry window, no stale back-button frames.
- The roadmap's last correctness slice closes, leaving only S-13 polish.
