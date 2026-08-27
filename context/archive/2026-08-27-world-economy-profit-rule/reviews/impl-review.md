<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: World Economy — Profit Rule

- **Plan**: `context/changes/world-economy-profit-rule/plan.md`
- **Scope**: Phases 1–6 of 6 (all `## Progress` rows ticked; `grep -c '^- \[ \]' plan.md` = 0)
- **Branch**: `feat/world-economy-profit-rule` @ `576f755`, cut from `matmaverse-v2` @ `91754ef`
- **Reviewed in**: `.claude/worktrees/world-economy-profit-rule`, `E2E_PORT=4330`
- **Date**: 2026-08-27
- **Verdict**: APPROVED
- **Findings**: 0 critical · 3 warnings · 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## What this review re-ran itself (nothing inherited)

Contract rule 5: a green I was told about is not a green I observed. Every number
below was measured in this step, sandbox disabled, local Supabase up on
`127.0.0.1:54321`.

| command | result (observed here) | baseline | delta |
|---|---|---|---|
| `npm test` on `matmaverse-v2` (main checkout, `aa2a662` — docs-only ahead of `91754ef`) | **548 passed / 57 files** | — | this **is** the baseline, re-measured, not inherited |
| `npm test` on `feat/world-economy-profit-rule` | **629 passed / 62 files** | 548 / 57 | **+81 tests, +5 files** |
| `npm run check` | exit 0 — **0 errors, 0 warnings, 8 hints, 211 files** | 202 files | +9 files |
| `npm run lint` | exit 0, clean | exit 0 | — |
| `E2E_PORT=4330 npx playwright test` | **26 passed / 26** | 26 | **+0** |

**The arithmetic reconciles.** 548 + 81 = 629 ✓. The plan's per-phase deltas sum
to the same total: 12 + 11 + 16 + 6 + 33 + 3 = **81** ✓ (548 → 560 → 571 → 587 →
593 → 626 → 629). 57 + 5 = 62 files ✓. No count in the handoff had to be rounded
to make the story work.

### Deliberate breaks re-executed by this review (four, not one)

Each names what was broken, what went red, and **why that redness is evidence for
that specific claim** (L-004). All restored; `git status --porcelain` empty after each.

1. **`recordShiftResult`: `const earned = profit` → `const earned = revenue`.**
   Red on exactly two cases in `tests/shifts-complete.test.ts` — *"returns revenue,
   cost and profit, all recomputed from the row's own shop_state"* (`expected 48 to
   be 44`) and *"credits the wallet with PROFIT, not revenue"* (`expected 42 to be
   36`). `tests/economy-invariants.test.ts` stayed **green** under it.
   *Evidence for:* the profit rule's central claim, at the durable-state level
   (`wallet_balance` read back), and it independently **confirms the implementer's
   second-order finding**: FR-008 monotonicity certifies nothing about profit vs
   revenue, because both only grow the wallet. This is the pre-D-11 behaviour, i.e.
   what a revert or careless merge reintroduces — not an implausible edit.

2. **`customers.runningCost` 2 → 40.** Red with the message the implementer
   recorded, verbatim: *TRAP: buying "customers" at d=0 owning [] drops profit
   45 → 13*. *Evidence for:* the no-trap sweep bites on real mistuning — the app
   still runs, nothing else fails, a child simply gets poorer for buying something,
   and only this sweep sees it.

3. **`e2e/growth.spec.ts` seed: `.slice(1)` on the seeded decoration list.** Both
   Playwright projects red on exactly
   `getByText('Masz już wszystkie ulepszenia dostępne na tym etapie.', { exact: true })`.
   *Evidence for:* the re-seeded Risk E2E-F4-3 genuinely reaches the empty state
   rather than passing for an unrelated reason — the precise staleness that made
   the original seed rot.

4. **Deleted `piekarnia`'s whole decoration set from `DECORATIONS`.** Four cases
   red in `tests/decorations.test.ts` including *"gives every world in WORLD_SLUGS
   a full decoration set"*; `tests/pacing.test.ts` stayed **green**.
   *Evidence for:* the W1 seam (CPD-2) is real and load-bearing, **and** it
   independently confirms the implementer's own second-order finding that the
   never-idle pacing assertion cannot see a drained world (the simulator moves on),
   so the two guards are complementary rather than redundant.

### Migration checked against the LIVE database, not just the file

`git diff --name-only 91754ef..HEAD -- supabase/` is **empty** — no migration
shipped, as the plan's `## Migration Notes` claims. Verified that the claim is
*sound* against the running stack rather than taken on trust:

- `child_profiles.shop_state` is `jsonb NOT NULL DEFAULT '{"purchased": []}'::jsonb`.
- The only CHECK constraints on `public.child_profiles` are `age 6–9`,
  `completed_shift_count >= 0`, `business_level >= 1`, `wallet_balance >= 0`.
  **Nothing constrains `shop_state`'s shape**, so the optional `decorations?:
  string[]` sibling needs no migration and every legacy `{}` / `{ purchased: [] }`
  row stays valid.
- No new RLS surface: the decoration buy rides the four existing
  `child_profiles_*_own` policies. L-001 is not engaged because no table or owner
  column was added; L-002 is honoured — `tests/decorations-buy.test.ts` §
  *"L-002 spoof: account B cannot buy on account A's profile"* asserts the 404
  **and** re-reads A's durable row through the service-role `admin` client.

### Predecessor findings spot-checked for reality (13-of-14 prior)

The plan review's seven FIXED findings were checked in **code**, not in prose:
F1 (two-tiered no-trap partition — present, and the header explains why a single
strict clause is unsatisfiable), F2 (`extraTasks: 0` on both margins, with the
clamp reasoning inline), F4 (per-world totality assertion — I broke it, see #4
above), F5 (`wrong-world` is its own `BuyReason`), F6 (the island's local
`earningsForShift` call **and** its import are gone; the response type carries
`revenue`/`cost`/`profit`), F7 (the rate-not-multiplier comment is on both entries).
**F3's fix produced the one real divergence — verified below, and it holds.**

**AD-11 verified by re-running the tuning claim.** Setting `margin.cost` back to
the 180 first guess turns clause 3 red: *"margin" costs more than "precision" but
returns more per zloty at d=0.25 — expected 0.0722 to be ≤ 0.0643*. The stated
reason for the one constant that moved is therefore **true, not a rationalisation**.

**AD-10 (`DOMINANCE_FLOOR` 0.35, scoped) is not a fitted tautology.** Clause 1's
measured worst ratio is 0.50 against a 0.35 floor; clause 2 measures 34% / 66%
against a 25% floor. Both carry real headroom — a floor fitted to the data would
sit at 0.50 and 0.34. I confirmed both clauses bite: pricing the whole margin
branch out (`precision` 900, `margin` 1200) turns clauses 1, 2 **and** 3 red
(*DOMINANCE at the opening choice … ratio 0.078*; *margin is the better buy in
only 36/1953 live states*). The residual gap is finding F1 below.

## Findings

### F1 — The dominance sweep cannot see a single mispriced entry inside a branch

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `tests/economy-invariants.test.ts` → `bestRoi`, and the three cases
  in `describe("no-dominance — neither branch is strictly the better buy")`
- **Detail**: `bestRoi(state, branch, d)` returns the **maximum** ROI over the
  branch's buyable entries, so a branch is judged by its best member. I raised
  `precision.cost` from 140 to 400 — a 2.9× hike that makes the accuracy margin a
  bad buy in every reachable state — and **all six invariant cases stayed green**,
  because `margin` (220) still supplied the branch maximum. Clause 3 does not
  catch it either: at 400 `precision` is the *dearer* entry and its lower ROI is
  exactly what clause 3 requires. So the catalogue can ship an entry no child
  should ever buy with nothing red anywhere. This is the L-004 second-order
  question applied to the tranche's headline deliverable — the implementer's own
  meta-check (temporarily raising `DOMINANCE_FLOOR` to 0.95) proves the assertion
  *computes*, not that it *bites on this class of mistake*. Today's shipped
  constants pass on merit, so nothing that ships is wrong; the coverage is.
- **Fix**: Add a fourth clause quantified over each **entry** rather than each
  branch maximum — for every buyable entry `u` in a live state, `ROI(u) >=
  ENTRY_FLOOR × bestRoi(branchOf(u))` — and derive `ENTRY_FLOOR` from the measured
  worst with headroom, the way `DOMINANCE_FLOOR` was.
  - Strength: closes the exact gap the break above exposed, in the file that
    already owns the sweep, with no product change.
  - Tradeoff: the capacity branch's shipped 5× intra-branch price spread (AD-7,
    frozen) may make a tight `ENTRY_FLOOR` unsatisfiable there too — likely scoped
    to the margin branch, or reported as a second measured residual.
  - Confidence: MED — the mechanism is proven by the break; the satisfiable floor
    is not yet measured.
  - Blind spot: I have not swept for the largest `ENTRY_FLOOR` that passes.
- **Decision**: FOLLOW-UP (`follow-ups/review-fixes.md`)

### F2 — `t.results.costLabel` is a superstring of `t.upgradeShop.costLabel` (L-007)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/i18n/pl.ts` → `t.results.costLabel` (`"Koszt sklepu: {cost} zł"`)
  vs the pre-existing `t.upgradeShop.costLabel` (`"{cost} zł"`)
- **Detail**: I ran the two-direction substring sweep the contract mandates over
  all 408 dictionary strings against all 28 new labels. Exactly one substantive
  collision: the new results label **contains** the existing shop price label, so
  a spec doing `getByText(fill(t.upgradeShop.costLabel, { cost: 40 }))` on a page
  that also rendered the breakdown would match twice. (The only other hit is the
  em-dash in `t.parentReport.statFirstTryNone`, which is noise.) No shipped screen
  renders both, so nothing is broken today. Plan Progress row **3.5** records this
  grep as "CLEAN" — accurately, but it covered only Phase 3's three strings; the
  Phase 2 breakdown labels were never swept. That is the gap, not the copy.
- **Fix**: Rename the results row to a phrase that is not a superstring — e.g.
  `"Koszt: {cost} zł"` is *worse* (still a superstring); prefer dropping the unit,
  `"Koszt sklepu: {cost}"`, or locating it in specs with
  `getByRole(..., { exact: true })` and recording the constraint beside the key.
- **Decision**: FOLLOW-UP (`follow-ups/review-fixes.md`)

### F3 — The decoration tile renders "insufficient funds" for every rejection reason

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/components/child/UpgradeShop.tsx` → the decorations `<section>`
  keyed on `t.upgradeShop.decorationsHeading`, its `check.ok ? … : …` branch
- **Detail**: The non-ok branch unconditionally renders
  `fill(t.upgradeShop.lockedByFunds, { amount: d.cost - wallet })`, discarding
  `check.reason`. It is correct **by construction** today — the list is
  `decorationsForWorld(world.slug)` filtered to unowned, so `insufficient` is the
  only reachable reason — but nothing pins that, and `canBuyDecoration` can also
  return `owned`, `wrong-world` and `unknown`. If the list source ever widens, the
  child is shown *"Brakuje -40 zł"*. The sibling `lockedReason` for upgrades in the
  same component switches on the reason and is the house pattern.
- **Fix**: Add a `decorationLockedReason(d)` mirroring `lockedReason`, or an
  explicit `check.reason === "insufficient"` guard with a comment naming why the
  other reasons are unreachable from this list.
- **Decision**: FOLLOW-UP (`follow-ups/review-fixes.md`)

### O1 — `ShopIconKey` lives in `ShopGlyph.tsx`, not in `decorations.ts` as both the plan and `ownership.md` wrote

- **Severity**: 📋 OBSERVATION
- **Dimension**: Plan Adherence
- **Location**: `src/components/child/ShopGlyph.tsx` → `SHOP_ICONS`, `ShopIconKey`;
  `src/data/decorations.ts` → its type-only import
- **Detail**: The plan's Phase 5 §1 contract block and `ownership.md` §1a both list
  `ShopIconKey` among the symbols **`src/data/decorations.ts`** authors. It is
  instead declared in `ShopGlyph.tsx` as `keyof typeof SHOP_ICONS`, and
  `decorations.ts` imports it type-only. The relocation is *correct* — it is what
  CPD-6 actually requires, since deriving the union from the map's own keys is what
  lets W1 widen it by appending — and `decorations.ts` does **not** re-export it.
  Recorded so W1 imports from the right module.
- **Decision**: RECORDED (cross-plan note carried to `## 5. Open`)

### O2 — Two `src/data/` modules now type-import from a component module

- **Severity**: 📋 OBSERVATION
- **Dimension**: Architecture
- **Location**: `src/data/upgrades.ts` and `src/data/decorations.ts`, both
  `import type { ShopIconKey } from "@/components/child/ShopGlyph"`
- **Detail**: This inverts the usual `components → data` direction. Both imports are
  **type-only**, so they erase at compile time and create no module edge; both
  carry a comment saying so and telling a later reader not to "fix" it into a value
  import. `npm run check` is clean and the data modules stay runtime-dependency-free
  as their headers claim. Noted because the inversion is unusual, not because it is
  wrong — the alternative (a third module owning the union) buys nothing while the
  map and the union must stay in lockstep.
- **Decision**: RECORDED

### O3 — `buyDecoration` inherits `buyUpgrade`'s read-then-write race

- **Severity**: 📋 OBSERVATION
- **Dimension**: Safety & Quality
- **Location**: `src/lib/services/child-profiles.ts` → `buyDecoration`
- **Detail**: Affordability is recomputed from the trusted row and then written in a
  separate UPDATE, so two concurrent buys could both pass `canBuyDecoration`. This
  is the shipped `buyUpgrade` pattern verbatim, not something this change
  introduced, and the live database backstops it: `child_profiles_wallet_balance_nonneg`
  (`CHECK (wallet_balance >= 0)`, confirmed against the running stack) turns the
  losing write into a 500 rather than a negative wallet. Fixing it belongs to both
  spend paths at once, not to this branch.
- **Decision**: RECORDED

### O4 — An orphaned comment in `src/i18n/pl.ts`

- **Severity**: 📋 OBSERVATION
- **Dimension**: Pattern Consistency
- **Location**: `src/i18n/pl.ts`, the `// Upgrade catalog names (S-06)…` comment
  block now sitting immediately above the new `decorations:` namespace
- **Detail**: The new `decorations` block was appended between that comment and the
  `upgrades:` object it describes, so the comment now heads the wrong namespace.
  Append-only discipline was otherwise respected (one entry per key, no
  restructuring), which is what keeps the file safe for W1's appends.
- **Decision**: RECORDED

### O5 — Six Manual `## Progress` rows are ticked on automated stand-ins

- **Severity**: 📋 OBSERVATION
- **Dimension**: Success Criteria
- **Location**: `plan.md` `## Progress` rows 2.5, 3.7, 3.8, 5.7, 5.8, 6.6
- **Detail**: Each is ticked with a named automated stand-in rather than a browser
  session, and each says so in its own row and defers the *visual* half to the
  handoff's human checklist. That is honest bookkeeping, not rubber-stamping — I
  verified two of the named stand-ins by breaking them (5.5's per-world totality
  and 6.5's E2E seed both went red as claimed). The outstanding judgement is
  legibility and layout only, which no suite can settle and which no browser
  automation would settle either. Carried, not blocked.
- **Decision**: RECORDED

## Cross-plan defects spotted in W1 (`six-worlds-catalogue`)

Reported, not edited — the contract forbids writing into another feature's folder.

1. **W1's plan §CPD-6 says F1 "declares `ShopIconKey` as a *closed* union".** F1
   ships it as `keyof typeof SHOP_ICONS` in `src/components/child/ShopGlyph.tsx`,
   and `src/data/decorations.ts` does **not** re-export it. W1 must import
   `ShopIconKey` from `@/components/child/ShopGlyph`; appending to `SHOP_ICONS`
   widens the union with **no type edit at all**, so W1's planned "add new members
   to `ShopIconKey`" step is now a single map append. Twelve spare keys (`atom`,
   `bell`, `flask`, `gift`, `microscope`, `moon`, `palette`, `party`, `sparkles`,
   `star`, `sun`, `tree`) are already mapped and unused for exactly this.
2. **W1's Phase 1 turns two F1-owned cases red, not one, and I confirmed the second
   one exists.** Widening `WORLD_SLUGS` to six will fail
   `tests/shop-art-slots.test.tsx` (closed by W1's Phase 3) **and**
   `tests/decorations.test.ts` § *"gives every world in `WORLD_SLUGS` a full
   decoration set"* — which my break #4 above showed also drags three sibling cases
   red (`"prices every world's set on the same rising curve"`, `"only ever names the
   CURRENT world's decorations"`, `"switching worlds renews the sink"`). W1 should
   expect **four** red cases from `decorations.test.ts`, not one. Seeing fewer means
   something weakened F1's assertion, which is a finding against W1.
3. **W1 must not re-seed `e2e/growth.spec.ts`.** F1's repair anchors on
   `decorationsForWorld(SEED_WORLD)` with `SEED_WORLD = "kawiarnia"`, so W1's two
   new worlds change nothing there and a second re-seed would be a regression.

MERGE: CLEAR — every success criterion met and re-measured on this branch (629/548 +81, 26/26 Playwright, lint and check clean), four deliberate breaks re-executed red-then-restored, the no-migration claim verified against the live database, and no CRITICAL finding.
