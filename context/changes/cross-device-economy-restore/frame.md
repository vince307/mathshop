# Frame Brief: S-10 cross-device-economy-restore — build it, or prove it?

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

S-10 sits open on the roadmap (status `proposed`, prerequisite S-06 long done)
with the outcome "a parent who grew a shop under profile A on one device signs
in on another and sees the same funds, purchased upgrades, grown shop, and
skill progress — exactly as left; a second account on the same device never
sees account A's data" (FR-001/FR-005/FR-012) — while every piece of state it
names already lives server-side in RLS-scoped rows, loaded fresh per request
by every page.

## Initial Framing (preserved)

- **User's stated cause or approach**: like S-09, S-10 may already be true by construction — a verification-shaped slice, not a build.
- **User's proposed direction**: decide what (if anything) to build vs. scope the verification residual.
- **Pre-dispatch narrowing**: evidence bar = automated two-session tests **plus** one manual two-device walkthrough; the "second account on the same device" clause **includes browser-level residue** (cookies, cached pages, back-button), not just RLS; the cross-device path has **never been exercised** — correctness is assumed from architecture.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Client-side state divergence** — durable client storage or module caches that would make device 2 differ from server truth.
2. **Shared-device residue** — what logout actually clears; cache headers; back/forward-cache exposure of A's rendered data.
3. **Coverage gap at the data layer** — what existing tests already prove vs. what S-10's outcome adds (two-session same-account equivalence; economy columns cross-account).
4. **Nothing remains** — pure verification + roadmap bookkeeping. ← initial framing

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| 1: Client-state divergence exists | Zero hits for localStorage/sessionStorage/indexedDB/caches across `src/`; no service worker; no module-level mutable caches; islands hold request-scoped state seeded from SSR props and apply the **server's** returned values on mutation (`UpgradeShop.tsx:46-47,72-74`); every page loads fresh per request. No mechanism for durable divergence. | NONE |
| 2: Shared-device residue | Signout clears auth cookies + `active_profile` but **not** `parent_verified` (`signout.ts` vs `parent-pin.ts:167`) — account-bound HMAC makes it harmless cross-account, but the *same* account re-signing-in within 15 min re-enters `/app/report` without the PIN. And **no `pageshow`/bfcache guard exists** (grep zero): Safari can restore A's last-rendered `/app/report`/`/app/start` from memory after logout despite `no-store` (Chrome/Firefox are covered by accident via cookie-change eviction). `no-store` header coverage itself is complete (`middleware.ts:18-24` + per-route `applyNoStore`). | STRONG (two small gaps) |
| 3: Coverage gap at the data layer | Cross-account economy isolation IS covered (incl. `wallet_balance` specifically, `child-profiles-isolation.test.ts:115-135`; shift_log; settings; report/selector seams). But **no test performs the two-client restore**: every durability read uses the RLS-bypassing `admin` client (`shifts-complete.test.ts:65`, `upgrades-buy.test.ts:111-113`) — proving the write persisted, never that a **fresh session of the same account** reads it back through RLS. `test-plan.md` Risk #2 explicitly demands "durably readable on a fresh fetch in a new session" — unimplemented. | STRONG |
| 4: Nothing remains (initial framing) | The *restore mechanism* is indeed fully built — but the stated bar (two-session automated evidence + browser-residue hygiene) is unmet, so "bookkeeping only" understates the residual. | WEAK |

## Narrowing Signals

- Both agents converged independently: the residue agent concluded unprompted
  that "what remains is a thin shared-device-hygiene slice, not an
  economy-persistence slice."
- The S-04 archive explicitly deferred cross-device specifics; `test-plan.md`
  Risk #2 names the fresh-session read as the intended (unbuilt) proof, and
  its "must challenge" line — *"client returned 200 ⇒ row committed"* — is
  exactly what the admin-client reads fail to challenge.
- The user has never exercised the path; nothing contradicts the architecture,
  but nothing has tested it either.

## Cross-System Convention

This project's convention (L-001/L-002) is that every correctness claim gets
an automated proof at the seam where it would break, verified against durable
state — and the recent S-09/S-11 reviews specifically hunted "false-green"
shapes. Admin-client durability reads are precisely that shape for S-10's
claim: the missing two-session test matches the convention; "trust the
architecture" does not.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: S-10 is not "build cross-device
> restore" — the restore is already true by construction; what's missing is
> the **proof** (a two-session restore-equivalence test reading economy state
> through RLS as a fresh session of the same account, plus one manual
> two-device walkthrough) and **two small shared-device hygiene fixes** the
> same-device clause demands: signout clearing the `parent_verified` marker,
> and a `pageshow`/bfcache guard so a back-button after logout can't replay
> A's rendered pages on browsers that ignore `no-store`.

The initial framing was directionally correct (verification-shaped, like
S-09) but incomplete: the stated evidence bar surfaces one false-green test
gap and two real hygiene defects, so the slice is verify-and-harden, not
close-as-satisfied.

## Confidence

**HIGH** — both hypotheses carry file:line evidence, the agents converged
independently, prior artifacts (S-04 deferral, test-plan Risk #2) predicted
exactly this residual, and the inverse checks (no storage APIs, full no-store
coverage, admin-only durability reads) all confirmed.

## What Changes for /10x-plan

Plan a small verify-and-harden slice: (1) two-session restore-equivalence
test — write economy state as session 1 (shift + purchase), mint a fresh
session 2 of the same account, assert identical wallet/shop/skills/level read
through RLS (and the cross-account negative alongside, per the roadmap's
risk note); (2) signout clears `parent_verified`; (3) a small `pageshow`
(`event.persisted`) reload guard for `/app` pages; (4) the manual two-device
walkthrough. Then S-10 closes on the roadmap.

## References

- Source files: `src/pages/api/auth/signout.ts`, `src/lib/services/parent-pin.ts:134-167`, `src/middleware.ts:18-24`, `src/lib/http.ts:12-24`, `tests/shifts-complete.test.ts:65`, `tests/upgrades-buy.test.ts:111-113`, `tests/child-profiles-isolation.test.ts:115-135`
- Spec: `context/foundation/roadmap.md` §S-10; `context/foundation/prd-v3.md` FR-001/FR-005/FR-012; `context/foundation/test-plan.md` Risk #2
- Prior: `context/archive/2026-06-29-full-shift-with-results/plan.md` (cross-device deferral)
- Investigation tasks: #16 (H1+H2 residue sweep), #17 (H3 coverage inventory)
