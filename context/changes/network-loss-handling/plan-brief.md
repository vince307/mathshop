# Network-Loss Handling Mid-Shift (S-12) — Plan Brief

> Full plan: `context/changes/network-loss-handling/plan.md`
> Research: `context/changes/network-loss-handling/research.md`

## What & Why

FR-017: when the WiFi drops mid-shift, a 6-year-old shouldn't see a browser error or an infinite spinner — the shop "closes for a moment" with a warm Polish message, the interrupted shift is discarded by design, and one big button brings them back to their real, server-recorded progress. The deliberately narrow contract: detect, halt, message — no retry, no queue, no PWA.

## Starting Point

Half the contract already shipped inside S-04: the shift-end write fires exactly once and its failure path already discards + shows a gentle Polish message. What's missing is any connectivity detection (none exists), an offline-specific in-world overlay (offline and server errors share generic copy), and a timeout on the save call (a hung network spins forever). Tasks are generated client-side, so mid-play the only loss signal is the browser's `offline` event.

## Desired End State

WiFi drops mid-task → calm full-screen in-world overlay, instantly. The child taps the one big button; a real connectivity probe (never trusting `navigator.onLine`) confirms, and they land on `/app/start` with wallet/level exactly as last recorded. A genuine server error at save time keeps its own distinct copy.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Detection layering | `offline` event = instant trigger; fetch rejection = authoritative; `online` never trusted without a probe | navigator.onLine is inherently unreliable (captive portals) | Research |
| No queue/retry/PWA; discard pending | Preserved exactly as S-04 built it (`savedRef` fire-once) | PRD non-goal; also keeps the double-pay hazard moot | Research |
| Overlay scope | Shift surface only | FR-017's letter is mid-shift; in-world copy belongs in the shop context | Plan |
| Idle detection | No heartbeat | Offline event covers router drops instantly; zero function invocations/battery | Plan |
| Reconnect UX | Big try-again button + confirm-probe → /app/start | Child-paced; no auto-navigation startles; honors the probe rule | Plan |
| Testing depth | Unit-test pure classifier/probe; manual devtools for browser behavior | Repo is node-only vitest; the classifier is where regressions bite | Plan |
| Ledger/idempotency rework | Not doing | Research's recommendation was superseded by S-04's shipped no-retry design | Plan |

## Scope

**In scope:** `src/lib/connectivity.ts` (classifier + probe + timeout constant), `AbortSignal.timeout` on the shift-end fetch, `useConnectivity` hook, `OfflineOverlay` island, offline-vs-server failure copy split, `t.offline` Polish block, classifier unit tests.

**Out of scope:** offline queue/sync/PWA, heartbeat endpoint, global overlay, changes to SSR reads/upgrades/auth, idempotency rework, jsdom test infra.

## Architecture / Approach

One new pure module holds the semantics (network-shaped rejection vs server-shaped response; probe that gates navigation). The shift surface consumes it: an `offline` event or a network-shaped save failure renders the overlay *over* the still-mounted shift UI (a false blip destroys nothing — discard happens only by navigating away). The save call gains a ~10s timeout. `ShiftScreen`'s existing phase machine absorbs it all; the write path is untouched.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Connectivity foundations + hardened save | Pure classifier/probe + tests; hung save fails gracefully in ~10s | Timeout rejection shape (TimeoutError DOMException, not TypeError) |
| 2. In-world halt | Overlay + offline wiring + probe-gated reconnect + copy split | Overlay must pause, never unmount, the shift |

**Prerequisites:** none beyond the shipped shift loop; local Supabase only for the full-suite regression run.
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- The static-asset probe answers "CDN reachable," which stands in for "internet back" — adequate for v1's transport-level question.
- Captive-portal loss during idle play surfaces only at the save (accepted with the no-heartbeat decision).
- Research doc is 13 slices old; its codebase claims are superseded (noted in the plan), its detection architecture is not.

## Success Criteria (Summary)

- Mid-task WiFi drop shows the calm in-world halt instantly; nothing red, nothing punishing.
- The interrupted shift pays nothing and vanishes; try-again lands on the last server-recorded state only after a real probe succeeds.
- A hung save can no longer strand the child on "saving"; server errors keep their own distinct copy.
