# Spendable Funds Wallet (Portfel) — Plan Brief

> Full plan: `context/changes/spendable-funds-wallet/plan.md`
> Research baseline: `context/changes/visible-shop-growth/research.md` (render/persist/RLS path; still valid)

## What & Why

Reinterpret the shipped, accumulating `coins` balance as the single spendable **wallet** (`virtualBalance`) — surfaced to the child as their **"Portfel"**, money they've saved to grow their shop. It's the lead-tranche precursor (roadmap S-05, PRD-v3 FR-007/FR-008) to the north-star S-06, which spends against this wallet. Framing the balance as owned savings (not a score that will "drop") is the shaping-decided mitigation for "spending feels like losing progress".

## Starting Point

The shipped `child_profiles.coins` balance already accumulates, persists per profile under RLS, is paid once at shift end (server-authoritative via `recordShiftResult`), and displays on start + results. "coins" is overloaded, though — it also names the tappable in-task 1-zł coins. There is no unit-test runner in the project yet.

## Desired End State

A returning child sees their saved money as a "Portfel" on the start screen and their per-shift earnings landing in it on the results screen, with light "saving toward your shop" copy. Under the hood it's a `wallet_balance` column, the earning is a renamed pure fn covered by unit tests, and the money model is a clean seam S-06 spends against. Task coins are untouched.

## Key Decisions Made

| Decision                    | Choice                                              | Why (1 sentence)                                                             | Source |
| --------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------- | ------ |
| DB model                    | Rename column `coins` → `wallet_balance` (non-destructive) | One currency; disambiguates from task coins; clean seam for S-06 spending.   | Plan   |
| Vocabulary                  | Introduce "Portfel" for the balance; task coins stay "monety" | Reinforces spend≠loss (owned savings); resolves the "coins" overload.        | Plan   |
| Visible scope this slice    | Reframe + light "saving toward your shop" copy      | Honest user-visible delta without vaporware (no fake store until S-06).      | Plan   |
| Testing                     | Wire minimal Vitest runner; cover pure economy fns  | Money math is about to grow spend logic (S-06) — tests pay off immediately.  | Plan   |
| Currency model              | Reuse the one balance; stars stay separate          | Shaping decided one spendable currency, not two.                            | Frame/PRD |

## Scope

**In scope:** DB column rename + non-negative constraint carry-through; rename types/service/earning-fn/route/island; Vitest + pure-fn tests; "Portfel" UI + savings copy on start & results; i18n.

**Out of scope:** spend logic / upgrade catalog / choose-upgrade UI (S-06); shop art / visible growth (S-06); tappable task-coin concept; stars, business level, shift composition, scoring amounts; new art assets.

## Architecture / Approach

Rename the money model end-to-end while keeping amounts identical, guarded by tests written *before* the rename so it's provably behavior-preserving. Server-authoritative earning (`recordShiftResult`, single RLS-scoped UPDATE by `id`, no client-supplied amount) and the dual-import "agree by construction" purity of `src/data/shift.ts` are preserved unchanged. UI reframing reuses existing coin imagery — no dependency on the local-only mockup art (that gates S-06, not this slice).

## Phases at a Glance

| Phase                          | What it delivers                                             | Key risk                                             |
| ------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------- |
| 1. Test-runner foundation      | Vitest wired + pure economy fns locked by tests             | First test tooling in the repo — config/alias setup  |
| 2. Money-model rename          | `coins` → `wallet_balance` end-to-end; tests stay green     | Missing a reference; migration rename correctness     |
| 3. Wallet UI + Portfel framing | "Portfel" + savings copy on start & results                 | Copy tone (must stay encouraging, no scarcity)        |

**Prerequisites:** S-04 (`full-shift-with-results`) done — the persisted balance, `recordShiftResult`, and results screen already exist.
**Estimated effort:** small — ~1-2 sessions across 3 phases; mostly a rename + reframe + first-test-runner setup.

## Open Risks & Assumptions

- Renaming the DB column touches ~10 references; the Phase-2 grep gate + Phase-1 tests catch a missed one.
- The wallet's user-visible delta is modest on its own — its real payoff is unlocking S-06. Accepted (the roadmap deliberately split it for plannability under the capacity blocker).
- Wallet copy must never drift into urgency/scarcity language (product guardrail); enforced by the Phase-3 manual check.

## Success Criteria (Summary)

- The child sees their saved money as a persistent "Portfel" on start, and per-shift earnings landing in it on results.
- The balance persists across reload and sign-out/sign-in, and increases by the same amount as before the rename.
- `npm test` (new) passes; task coins still read "monety"; no scarcity/urgency wording.
