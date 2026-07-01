---
change_id: upgrade-choice-and-growth
title: Child chooses an upgrade that visibly + functionally grows the shop (north star)
status: implemented
created: 2026-07-01
updated: 2026-07-01
archived_at: null
---

## Notes

Roadmap **north star S-06** (`context/foundation/roadmap.md`). PRD: `context/foundation/prd-v3.md` US-01, FR-010, FR-011, FR-012, FR-013, FR-014. Prereqs: **S-05** (`spendable-funds-wallet`, archived — the `wallet_balance` this spends) + **S-04** (shift loop). Absorbs the paused/archived `visible-shop-growth` (its `research.md` mapped the `shop_state` + render/persist/RLS path).

**Outcome:** the child earns funds, opens a dedicated **/app/upgrades** screen, and **chooses** an affordable upgrade (a framed math/decision moment, cost + world-level gated). Buying debits the wallet server-side, the shop grows **visibly** (owned-upgrade art) AND **functionally** (owned upgrades lengthen the shift → more practice + earning), and the choice persists. The start + upgrades surfaces show the grown shop and what's next.

**Key decisions (from planning):**
- Functional effect = **capacity**: owned upgrades add tasks to the shift (a busier shop), capped; earnings scale via the existing `earningsForShift(taskCount,…)`. No multiplier.
- Catalog = a single shared list of **5–8** upgrades (increasing cost + `requiredWorldLevel`), tunable constants; per-world catalogs are the multi-world tranche.
- Gates in S-06 = **cost + world level only**; skill-progress gating is **S-07**.
- `shop_state` shape = **`{ purchased: string[] }`**; derive art layers, effects, progression from the catalog by id.
- Purchase surface = a **dedicated `/app/upgrades` screen** (browse/choose/buy anytime), linked from the start screen; results screen nudges to it when something's affordable.
- Art = **copy the needed v3 progression PNG/SVG from `assets/atomic-assets-v3-progression/` into `public/illustrations/`** so they're committed + version-controlled (assets/ is gitignored).
- Testing = pure-fn tests + a buy-endpoint integration test (mirrors `shifts-complete.test.ts`).
