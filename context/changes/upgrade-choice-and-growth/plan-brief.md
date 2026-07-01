# Upgrade Choice & Visible+Functional Shop Growth — Plan Brief

> Full plan: `context/changes/upgrade-choice-and-growth/plan.md`
> Render/persist baseline: `context/changes/visible-shop-growth/research.md` (paused change; still valid)

## What & Why

The roadmap **north star (S-06)**: turn the wallet into a decision. A child spends earned funds on a **chosen** upgrade, and the shop grows **visibly** (art) and **functionally** (owned upgrades lengthen the shift, so a bigger shop earns more). This is the bet — that *deciding how to grow the business* is what makes the math feel purposeful. PRD-v3 US-01, FR-010–FR-014.

## Starting Point

S-05 shipped the *earning* half: `wallet_balance` accumulates server-side, framed as the child's "Portfel". The reserved `shop_state jsonb` column exists but is unused; the single world renders one static PNG with no upgrade art. The server-authoritative `recordShiftResult` + `/api/shifts/complete` pattern and the `shift.ts` pure-fn purity are the templates to reuse.

## Desired End State

A child with funds opens a dedicated **/app/upgrades** screen, sees the catalog (affordable / locked / owned), and **buys** one in a framed decision. The wallet drops by the cost server-side, the shop art on the start + upgrades screens reflects it, and subsequent shifts run a little longer (more practice + earning). Spending never lowers level. The purchase is fully validated server-side and persists.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Functional effect | Capacity — owned upgrades add tasks to the shift (capped); earnings scale via existing `earningsForShift` | Delivers FR-012's "functional" using only shipped mechanics; no multiplier inflation | Plan |
| Catalog size | Single shared catalog of 5–8 upgrades (cost + world-level ladder), tunable constants | Enough runway + progression; per-world catalogs are the multi-world tranche | Plan |
| Requirement gates | Cost + `requiredWorldLevel` only | Skill-progress gating is S-07 | PRD/Roadmap |
| `shop_state` shape | `{ purchased: string[] }`; derive art/effects/progression from the catalog | Minimal durable state, catalog is single source of truth | Plan |
| Purchase surface | Dedicated `/app/upgrades` screen, linked from start; results nudges to it | Browse/buy anytime; matches the "choose" beat without cluttering start | Plan |
| Art | Copy the needed v3 progression PNG/SVG from local `assets/` into committed `public/illustrations/` | `assets/` is gitignored; art must be in the repo to reach CI/Vercel | Plan |
| Testing | Pure-fn tests + buy-endpoint integration test (mirrors `shifts-complete.test.ts`) | Locks the currency-moving paths (debit, overspend, isolation) | Plan |

## Scope

**In scope:** upgrade catalog + committed art + `shop_state` shape + pure fns; server-authoritative buy endpoint + integration test; dedicated /app/upgrades screen (choose/buy + next-upgrade progress); visible growth on start + upgrades; capacity effect (longer shifts) + raised shift-completion cap.

**Out of scope:** skill/mission gates (S-07); new task types / products / pricing / inventory (later tranche); multi-world / per-world catalogs / world-selection (pillar 2); parent report (S-09); earnings multiplier; refunds/respec.

## Architecture / Approach

Bottom-up, money-integrity first. A pure `upgrades.ts` (catalog + `canBuy`/`nextUpgrade`/`shiftBonusTasks`/`readPurchased`) is the shared source of truth imported by both the screen (display) and the buy endpoint (authority) — agree-by-construction, like `shift.ts`. The buy is one read + one RLS-scoped UPDATE by `id` (no client `account_id`, L-002); the wallet non-negative constraint backstops overspend. The capacity effect adds bonus tasks to `generateShift`; because `earningsForShift` already scales with task count, a longer shift earns more with no new formula (but the `/api/shifts/complete` `taskCount` cap must rise).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Catalog + art + shape + pure fns | The shared source of truth, committed art, `{ purchased }` shape, tested | Catalog/cost tuning; sourcing the right v3 assets |
| 2. Buy endpoint | Server-authoritative purchase + integration test | Money integrity — overspend, double-buy, cross-account isolation |
| 3. /app/upgrades screen | Choose/buy UI + next-upgrade progress + entry points | New route/island; keeping copy non-manipulative |
| 4. Visible growth + effect wiring | Shop art from owned upgrades; longer shifts + raised cap | The `taskCount` cap interaction (long shift must not 400) |

**Prerequisites:** S-05 (`wallet_balance`, archived) + S-04 (shift loop). Local Supabase stack for the integration test.
**Estimated effort:** large — ~3–4 sessions across 4 phases; the north star and the biggest slice of the economy tranche.

## Open Risks & Assumptions

- **Balance tuning** (costs, `requiredWorldLevel`, `extraTasks`, `MAX_BONUS_TASKS`) is first-guess; needs kid-testing iteration.
- **Art fidelity** — the copied v3 assets are cafe-flavored and generic; per-world upgrade art is a later polish.
- **Shift-length cap** must be raised in lockstep with the capacity effect or long shifts 400 (called out in the plan).
- **"Spend feels like loss"** mitigation (owned-upgrades-as-permanent-win framing) carries over from S-05; validate with children.

## Success Criteria (Summary)

- A child buys a chosen, affordable upgrade; the wallet debits server-side and the shop visibly grows; it persists.
- Unaffordable / locked / already-owned upgrades can't be bought; account B can't buy on account A (tested).
- Owned upgrades lengthen shifts (more practice + earning) up to a cap; spending never lowers level; all copy is encouraging Polish with no scarcity.
