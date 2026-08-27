# World Economy — Profit Rule — Plan Brief

> Full plan: `context/changes/world-economy-profit-rule/plan.md`
> Research: `context/changes/world-economy-profit-rule/research.md`
> Design spec: `docs/superpowers/specs/2026-08-27-world-economy-design.md` (D-1…D-13)

## What & Why

MathShop's economy is one equation with one purchasable effect, so every purchase is
the same purchase at a different price and there is no decision in it — the thing PRD
v3's FR-011 is built around. This plan turns it into a **profit rule**
(`profit = max(0, revenue − cost)`, cost applied to a shift's revenue and never to the
wallet), closes the catalogue at **eight** entries across two branches worth choosing
between, and adds **per-world decorations** as a sink so the wallet still has a drain
after the catalogue empties (which happens in ~7–25 shifts today).

## Starting Point

`earningsForShift` is `5 × tasks + 3 × clean`. Six upgrades exist; five add
`extraTasks: 1` and sum to exactly `MAX_BONUS_TASKS`, and `sign` does nothing.
`shopRunningCost`, `shopEffects`, `profitForShift`, the margin fields, `requiredUpgrade`
and `Decoration` are all symbols to be **written**, not called. `ShiftScreen` already
throws away the server's authoritative payout and shows its own — harmless today,
wrong the moment revenue and profit diverge.

## Desired End State

The results screen shows **przychód · koszt · zysk**; the wallet receives profit
computed once, server-side, from the trusted `shop_state`. Eight catalogue entries,
two branches gated behind `sign`, four decorations per world that cost money and change
nothing but the picture. Three property sweeps prove no purchase is a trap, no
decoration costs anything but its price, and neither branch is strictly the better buy.
A pure pacing simulation re-runs on every `npm test`.

## Key Decisions Made

| Decision | Choice | Why | Source |
|---|---|---|---|
| Cost keyed on what | Per-entry `runningCost` weight; `sign` weighs **0** | Otherwise `sign` is itself a no-trap violation; also preserves two exact-payout E2E tests | Plan (AD-1) |
| Reference shift | `referenceShift(d, bonus)` = midpoint of `shiftLengthRangeFor(d)` at `TARGET_SUCCESS = 0.8` | Both inputs already exist and are load-bearing — nothing invented | Plan (AD-2) |
| Margin-entry art | `art?` unset + lucide fallback; no SVG copied out of `assets/` | The copy step is machine-dependent; the fallback must exist for decorations anyway | Plan (AD-3) |
| FR-008 vs decoration debit | Spirit reading — no FR edit, `prd-v4` trigger stays unfired | `prd-v3.md:62` already names "decoration" as a legitimate visible change | Plan (AD-4) |
| Decorations per world | **4**, priced 40 / 80 / 140 / 220 | Covers each ~3-shift level band; 24 eventual art assets, not 48 | Plan (AD-5) |
| Decoration `shift_log` | **No row**, no `+1 decisions` | An `earned: null` row permanently suppresses the parent report's earnings tile | Plan (AD-6) |
| Shipped entry prices | **Unchanged** | Re-pricing risks every affordability assertion in `e2e/gameplay-restore.spec.ts` | Plan (AD-7) |
| W1 vocabulary | Ship on the mandatory fallback; E1 lands no resolver | The fallback exists precisely so this is a choice; per-world copy is W1's surface | Plan (AD-8) |
| Catalogue split | 1 unlock + 5 capacity + 2 margin, and it stops | Capacity is exactly full; a 6th capacity entry would be an effect-less purchase | Spec |
| Persistence | `shop_state.decorations?` sibling — **no migration** | The `purchasedMeta?` precedent; every legacy `{}` row stays valid | Spec |

## Scope

**In scope:** the profit rule end-to-end (data → service → route → island → results UI);
two margin entries + the `branch-locked` rung; art-optional rendering at all five
surfaces; per-world decorations with their own buy route; three invariant sweeps; the
D-13 pacing model; repair of the one E2E the tranche knowingly breaks.

**Out of scope:** migrations, new tables/RLS, wallet debits on the shift path, changes
to the six shipped entries' prices, per-world catalogue vocabulary, decoration art
files, new task types or competencies, new E2E specs, revenue/cost columns on
`shift_log`.

## Architecture / Approach

Everything lands in the **pure data layer first** — `src/data/upgrades.ts` and
`src/data/shift.ts` are dependency-free and imported by both the island and the
authoritative route, so a rule that lives there cannot disagree with itself. The seam
between them stays a plain value object (`ShopEffects`); `shift.ts` must not start
importing `upgrades.ts`. Decorations get their own module importing `upgrades.ts`
one-way — that direction *is* the no-harm invariant, enforced by module boundary rather
than only by test. One `ShopGlyph` component holds the closed lucide map so the
art-less fallback cannot drift across the five render sites.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Pacing model | `referenceShift`, cost-in-tasks, purchase timeline, pacing assertions | `tests/ → scripts/` import may not type-check |
| 2. Profit rule | revenue·cost·profit from data layer to results UI | `shift-screen` `fetchMock` fails **silently** if not fixed in the same phase |
| 3. Catalogue to eight | two margins, branch gate, art-optional rendering, slot tables | `shop-art-slots` goes red until 8 slots × 4 tables land |
| 4. Invariant sweeps | no-trap, no-dominance, reachability BFS, constant tuning | First-guess constants may not satisfy no-dominance — tune constants, never the invariant |
| 5. Decorations | data, persistence, buy route, UI, next-thing fallback, no-harm | The inner-spread trap silently drops `purchased`/`purchasedMeta` |
| 6. Repair + records | `e2e/growth.spec.ts` re-seed, pacing re-run, contract surfaces | Deleting the `noNextUpgrade` assertion instead of re-seeding |

**Prerequisites:** a worktree bootstrapped by
`.claude/skills/10x-autonomous-run/scripts/worktree-bootstrap.sh` on branch
`feat/world-economy-profit-rule` cut from `matmaverse-v2`; the local Supabase stack up
(`npx supabase status`, API on 127.0.0.1:54321) with **the command sandbox disabled**
for suite runs; the assigned `E2E_PORT`.
**Estimated effort:** ~6 phases, largest are 2 and 5.

## Open Risks & Assumptions

- **No-trap holds in expectation, not per shift** — a zero-clean shift after buying the
  accuracy margin earns strictly less; `max(0, …)` clamps at zero, not at the
  pre-purchase profit. The sweeps state their reference shift so nobody is misled.
- **`WORLD_SLOTS` and `src/i18n/pl.ts` are contention points with W1.** Every change
  here is additive; W1 must append, not restructure.
- **No mockup exists** for a decoration or for the three-number results breakdown, and
  `assets/` is absent from the worktree — both layouts are **explicit extrapolations**
  from existing components, not mockup-derived.
- `t.growth.noNextUpgrade`'s wording becomes slightly imprecise once it can fire on
  exhausted decorations; kept verbatim because an E2E asserts it and L-007 makes
  renaming risky.

## Success Criteria (Summary)

- A child sees three numbers at shift end and the `zysk` is exactly what the wallet
  gains — a second arithmetic operation, taught by the screen rather than labelled on it.
- Buying anything in the shop always makes you better off, and no branch is the
  obviously right answer — both proved by a sweep, not by argument.
- There is always something worth saving for, in every world, at every level.
