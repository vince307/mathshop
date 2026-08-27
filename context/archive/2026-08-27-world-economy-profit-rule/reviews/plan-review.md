<!-- PLAN-REVIEW-REPORT -->
# Plan Review: World Economy — Profit Rule Implementation Plan

- **Plan**: `context/changes/world-economy-profit-rule/plan.md`
- **Mode**: Deep (autonomous — no interactive triage; findings triaged in place per the run contract)
- **Date**: 2026-08-27
- **Verdict**: REVISE → **SOUND after fixes** (all CRITICAL and all obvious WARNINGs applied to `plan.md` in this step)
- **Findings**: 2 critical, 4 warnings, 2 observations

## Verdicts

| Dimension | Verdict (before fixes) | After fixes |
|-----------|------------------------|-------------|
| End-State Alignment | WARNING | PASS |
| Lean Execution | PASS | PASS |
| Architectural Fitness | PASS | PASS |
| Blind Spots | FAIL | PASS |
| Plan Completeness | WARNING | PASS |

## Grounding

16/16 paths ✓ · 10/10 symbols ✓ (`earningsForShift`, `shiftBonusTasks`/`MAX_BONUS_TASKS`,
`canBuy`/`BuyReason`, `TARGET_SUCCESS`, `shiftLengthRangeFor`, `MAX_SHIFT_TASKS`,
`earningsKnown`, `WORLD_SLOTS`, `lockedReason`, `nextUpgrade`) · brief↔plan ✓ ·
Progress↔Phase mechanical contract ✓ (1 `## Progress`, 6/6 phases matched, 39 rows,
no duplicate step numbers, no checkbox outside Progress) · contract-surfaces H2 sweep:
`public.child_profiles` and `public.shift_log` both named by the plan and both
accurately described.

**Suites were not run** — another agent may hold the tree (run contract). Every claim
below is verified statically against source on `matmaverse-v2` @ `91754ef`.

## Findings

### F1 — No-trap's strict inequality is unsatisfiable for `sign` by construction

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 4 → `#### 1. No-trap`
- **Detail**: The contract asserted `profit(I ∪ {u}) > profit(I)` for **every** unowned
  investment entry. Under **AD-1**, `sign` has `runningCost: 0`, `extraTasks: 0`
  (`src/data/upgrades.ts`, the `sign` record) and no margin — so its profit delta is
  **exactly 0**, not positive, at every one of the 5376 sweep points. The plan's own
  *Key Discoveries* only rules out the *negative* case ("`sign` is itself a no-trap
  violation" under a nonzero weight); zeroing the weight removes the loss and leaves
  the equality. The headline deliverable of the tranche would have failed on its first
  run, and the likely reaction under an unattended implement step is to weaken the
  invariant rather than the assertion — the one outcome the run contract forbids.
- **Fix applied**: split into two tiers — `>=` for every entry (the trap clause) and
  `>` for **earning** entries only (`extraTasks > 0` or a margin ≠ 1), with the
  unsatisfiability spelled out inline so nobody re-collapses it, and the failure
  message naming which tier failed.
- **Decision**: FIXED

### F2 — `extraTasks` unspecified on the two new catalogue entries

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 → `#### 1. Two entries and one rung`, the entry table
- **Detail**: `Upgrade.extraTasks` is a **required** field (`src/data/upgrades.ts`,
  `interface Upgrade`), and the plan's table omitted the column entirely. `shiftBonusTasks`
  clamps the sum at `MAX_BONUS_TASKS = 5`, which the five shipped capacity entries reach
  **exactly**. An implementer who writes `extraTasks: 1` on a margin entry pushes the sum
  to 6–7; the clamp swallows the overflow, and the child's last capacity purchase adds
  **zero tasks while still adding its `runningCost`** — a manufactured no-trap violation
  in the very catalogue the sweeps are meant to certify.
- **Fix applied**: `extraTasks` added to the table as an explicit **0** for both entries,
  with the clamp argument written out as the reason.
- **Decision**: FIXED

### F3 — No-dominance may have no solution over the plan's tunable set, and no escape was named

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; wide blast, unclear best path
- **Dimension**: Blind Spots
- **Location**: Phase 4 → `#### 2. No-dominance`, `#### 3. Tuning`
- **Detail**: `ROI*_capacity` is taken over the **cheapest buyable** capacity entry, and
  **AD-7** freezes those costs across a 5× spread (`shelf` 60 … `customers` 300). Worked
  at the plan's first-guess constants and `d = 0`: reference shift is 6 tasks / 5 clean →
  `shelf` ROI `= 6/60 = 0.10`, `precision` ROI `= 7/140 = 0.05` → ratio 0.5, below
  `DOMINANCE_FLOOR = 0.6`. Lowering `precision`'s cost to fix that state then breaks the
  reachable state where only `customers` (300) remains buyable in capacity, whose ROI is
  ~0.02 and which forces margin ROI *down*. Both constraints bind on the same two margin
  entries at every `d`. Feasibility is unproven and plausibly empty. The plan's handoff
  carried the fallback; `plan.md` itself did not, and `plan.md` is what the implementer reads.
- **Fix applied**: recorded in `## Open Risks & Assumptions` with an ordered escape —
  narrow the assertion's *scope* first (states where the branch choice is genuinely live),
  then lower `DOMINANCE_FLOOR` and record the number as a decision; never weaken the
  invariant to a tautology, never move a shipped `cost`; if neither works, report
  `RETHINK` on the floor rather than delete the sweep.
- **Decision**: FIXED (as a recorded risk with a bounded escape — the tuning itself is
  Phase 4's work and cannot be settled statically)

### F4 — A world can ship with an empty decoration set and nothing goes red

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots (cross-plan seam with W1)
- **Location**: Phase 5 → `#### 1. The decoration catalogue`, `#### 5. No-harm`
- **Detail**: Phase 5's sweeps quantify over **decoration subsets** and assert
  `shopRunningCost(DECORATION_IDS) === 0`. Nothing quantifies over **worlds**. F1 authors
  16 decorations for the four shipped worlds; W1 `six-worlds-catalogue` adds `pracownia`
  and `laboratorium` in the same stack, and W1's Phase 4 (which supplies their sets) is
  written as **droppable**. On a merged tree with W1's Phase 4 dropped, `nextPurchase`
  returns `null` for two of six worlds the moment their catalogue empties — the FR-013
  "next thing" card silently returns to the empty state D-11 exists to abolish, with a
  green suite. W1's own contracted deliberate break ("remove one new world's decoration
  set → F1's per-world sweep goes red") has nothing to bite on.
- **Fix applied**: Phase 5 now contracts a totality assertion in `tests/decorations.test.ts`
  — for every slug in `WORLD_SLUGS`, `decorationsForWorld(slug).length` equals the
  per-world count — with a new Success Criteria bullet and Progress row **5.5** (Manual
  rows renumbered 5.7/5.8). Stated explicitly that this is what makes W1's Phase 4
  non-droppable once F1 has landed.
- **Decision**: FIXED

### F5 — `canBuyDecoration`'s world rung has no reason code

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 5 → `#### 1. The decoration catalogue` (the `canBuyDecoration` signature)
- **Detail**: `canBuyDecoration` returns `BuyCheck`, whose `BuyReason` union is
  `"owned" | "locked" | "skill-locked" | "history-locked" | "insufficient" | "unknown"`
  plus Phase 3's `"branch-locked"` — none of which means *wrong world*, yet Phase 5's own
  test asserts "a decoration from another world is rejected". Falling back to `"locked"`
  routes through `UpgradeShop.lockedReason`, which renders it as *"unlock at business
  level {level}"* — a level number with nothing to do with the failure.
- **Fix applied**: `BuyReason` gains `"wrong-world"`, contracted alongside `"branch-locked"`.
- **Decision**: FIXED

### F6 — "Keep `earningsForShift` only if still needed" is exactly the divergence the phase exists to close

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 → `#### 5. The island stops computing its own payout`
- **Detail**: The plan left it to the implementer's judgement. Source shows the local
  `const earned = earningsForShift(taskCount, cleanCount)` is bound **inside** the
  completion `useEffect`, above the `fetch`, and read only after the response resolves —
  there is no optimistic pre-response render to preserve. A "keep it if you like" reading
  ships one number as revenue and the other as profit, and nothing fails.
- **Fix applied**: changed to an unconditional **drop the call and the import**, with the
  reason, and a rule for any future optimistic render (render `revenue`, label it as such).
- **Decision**: FIXED

### F7 — The margin constants are not the number anyone can tune

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 → `#### 2. The formula`; Phase 4 → `#### 3. Tuning`
- **Detail**: `round(EARN_PER_CLEAN * 1.5) = 5` is an effective multiplier of **1.67**, not
  1.5; `round(EARN_PER_TASK * 1.4) = 7` is 1.4 only by luck. Rounding the per-unit rate is
  the right call (whole złoty, legible to a child), but it means a Phase 4 tuner nudging
  1.5 → 1.55 changes nothing at all, and the constant in the file disagrees with the number
  on screen.
- **Fix applied**: recorded in `## Open Risks & Assumptions` — tune and document the
  **resulting rate** (5 → 7 zł per task, 3 → 5 zł per clean task), or express the field as
  the target rate outright.
- **Decision**: FIXED (recorded)

### F8 — Phase 3's `WORLD_SLOTS` change is described as "new keys only"

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Completeness
- **Location**: Phase 3 → `#### 3. Slot tables`
- **Detail**: F1 adds **ids inside three existing world keys** plus `DEFAULT_SLOTS`; W1
  adds **two new top-level keys**. Both are additive and the merge is still clean, so the
  guidance is right and only its wording is imprecise. Left as-is — rewording it risks
  reading as a licence to restructure.
- **Decision**: DISMISSED (accurate in substance)

## Claims re-verified against source (not inherited)

| plan claim | verdict |
|---|---|
| `ShiftScreen` types the complete response as `{ leveledUp; businessLevel }` and displays its own `earningsForShift` | **confirmed** — the `fetch("/api/shifts/complete")` `.then` block |
| `sign.runningCost = 0` preserves `e2e/gameplay-restore.spec.ts`'s exact payouts | **confirmed** |
| the five `earningsForShift` expectations in `tests/shifts-complete.test.ts` survive | **confirmed** — every seeded profile there has an empty `shop_state`, so `cost = 0` and `profit === revenue` |
| `MAX_SHIFT_TASKS = 17` never clamps `referenceShift` | **confirmed** — worst case `d = 1`: `round((9+12)/2) + 5 = 16` |
| `MAX_BONUS_TASKS = 5` is reached **exactly** by the five capacity entries | **confirmed** — this is what makes F2 dangerous |
| `computeWeeklyReport` flips `earningsKnown` false on `upgrade_purchased === null && earned == null` **permanently** | **confirmed** — AD-6 is correct and load-bearing |
| `tests/shop-art-slots.test.tsx` loops `UPGRADE_IDS` × every `WORLD_SLOTS` table; `tests/upgrades.test.ts` tolerates 8; `tests/stages.test.ts` forbids `requiredWorldLevel: 4` | **confirmed** (all three titles present) |
| `e2e/growth.spec.ts` *Risk E2E-F4-3* seeds `["sign","shelf"]` and asserts both `noNextUpgrade` **and** `upgradesLink` | **confirmed** — the CTA-outside-the-ternary comment is in the spec |
| `buyUpgrade` credits `+1 decisions` via `decisionsDelta` | **confirmed** — AD-6's rejection of a decoration credit is grounded |
| `TARGET_SUCCESS = 0.8` is the engine's convergence target; `shiftLengthRangeFor` is `{5,8,9}/{7,10,12}` | **confirmed** — AD-2 invents no number |

## Cross-plan findings (W1 `six-worlds-catalogue` — reported, not edited)

### CP-1 — W1's 3-per-world decoration fallback contradicts F1's AD-5

W1 Phase 4 → *"If F1's count is unset or inconsistent, use **3 per world** (Decision 3)."*
F1's **AD-5** settles it at **four**, priced 40/80/140/220, and W1's own §1 already says
"matching F1's per-world count and price curve for the existing four exactly". The
fallback is a dead branch that, if ever taken, breaks the equal-sink-capacity property
W1 itself names as the reason D-11 needs symmetry. Should read "four, per F1 AD-5".

### CP-2 — W1's Phase 4 deliberate break has nothing to bite on as F1 was originally written

W1 Phase 4 contracts: *"remove one new world's decoration set → F1's per-world sweep (or
its 'every world has a sink' assertion) goes red"*. F1's plan contracted **neither**.
Addressed on the F1 side by this review (F4 above) — but W1's planner should know the
assertion now exists, and that its Phase 4 is therefore **no longer droppable** once F1
has landed: dropping it leaves two of six worlds with an empty sink and F1's suite red.

### CP-3 — W1 quotes a test title F1 renames

W1 Phase 3's deliberate break names the case *"covers all six upgrade ids in every
table"* verbatim. F1 Phase 3 → `#### 3. Slot tables` explicitly renames that title to a
count-free phrasing (correctly — it goes stale at eight ids). W1 is cut from F1's branch,
so by the time W1 runs, the quoted title no longer exists. W1 should anchor on the
assertion's behaviour ("the case that loops `UPGRADE_IDS` against every table"), not the
literal string (L-006 applies to test titles too).

### CP-4 — W1 Phase 4 §3 hedges on where decorations render; F1 has settled it

W1: *"Only if F1's `ShopArt` change places decorations at `WORLD_SLOTS` coordinates
rather than in a separate row."* F1 Phase 5 → `#### 1` and `#### 4` settle it: **no `slot`
field**, decorations render through `ShopGlyph` in `ShopArt`'s **corner row**. W1's Phase 4
§3 is therefore a no-op and can be dropped, saving W1 two speculative slot tables.
