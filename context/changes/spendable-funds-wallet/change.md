---
change_id: spendable-funds-wallet
title: Spendable funds wallet — reinterpret coins as the Portfel that upgrades will spend against
status: impl_reviewed
created: 2026-07-01
updated: 2026-07-01
archived_at: null
---

## Notes

Roadmap slice **S-05** (`context/foundation/roadmap.md`), lead tranche of the MathMarket economy re-baseline. PRD: `context/foundation/prd-v3.md` FR-007, FR-008 (advances US-01). Prereq **S-04** (`full-shift-with-results`) done. Unlocks the north star **S-06** (`upgrade-choice-and-growth`) — the wallet is what S-06 spends against.

**Outcome:** the shipped accumulating `coins` balance is reinterpreted as the single spendable **wallet** (`virtualBalance`), surfaced to the child as their **"Portfel"** — money they've saved to grow their shop. One currency (stars stay a separate quality signal). No spend logic in this slice; that's S-06. The tappable in-task 1-zł coins (`useCoinTask`/`CoinBoard`) are a different concept and are untouched.

**Key decisions (from planning):**
- DB: non-destructive `alter table rename column coins → wallet_balance` (one currency; disambiguates from task coins).
- Vocabulary: introduce **"Portfel"** for the balance; task coins stay "monety".
- Scope: reframe + light "saving toward your shop" copy — no fake store / no vaporware upgrade button.
- Testing: wire a minimal **Vitest** runner (first in the project) and cover the pure economy fns before the rename.

Related: paused `context/changes/visible-shop-growth/` — its `research.md` mapped the exact render/persist/RLS path and remains the research baseline; its visible-growth outcome is now absorbed into S-06.
