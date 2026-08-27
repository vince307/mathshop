# Follow-ups — `world-economy-profit-rule` (F1)

Non-blocking. Raised by `/10x-impl-review` on 2026-08-27 against
`feat/world-economy-profit-rule` @ `576f755`. **None of these changes what the
shipped product does today** — that is why the branch merges clear. Every item
names a file and a **symbol**, never a line number (L-006).

## RF-1 — Add a per-entry clause to the dominance sweep (from finding F1)

- **File / symbol**: `tests/economy-invariants.test.ts` → `bestRoi`, and the
  `describe("no-dominance — neither branch is strictly the better buy")` block.
- **What is wrong**: `bestRoi` returns the branch **maximum**, so a branch is
  judged by its best member. Reproduced in review: raising `precision.cost` from
  140 to 400 leaves **all six invariant cases green**, because `margin` (220)
  still supplies the branch maximum — and clause 3 cannot catch it either, since
  at 400 `precision` is the dearer entry and its lower ROI is exactly what
  clause 3 demands. A catalogue entry nobody should ever buy can ship with
  nothing red.
- **Fix**: a fourth clause quantified over each **buyable entry** in a live state:
  `ROI(u) >= ENTRY_FLOOR × bestRoi(state, branchOf(u), d)`. Derive `ENTRY_FLOOR`
  from the measured worst with headroom, exactly as `DOMINANCE_FLOOR` was — do not
  fit it to the data.
- **Watch for**: the capacity branch's shipped 5× intra-branch price spread
  (`shelf` 60 … `customers` 300) is frozen by AD-7, so a tight floor may be
  unsatisfiable there. Scoping the clause to the margin branch, or reporting the
  capacity residual the way `DOMINANCE_FLOOR`'s header already reports the
  cross-branch one, are both acceptable — **weakening it to a tautology is not.**
- **Why it does not block**: today's shipped constants pass on merit; the gap is in
  coverage, not in what ships. Verified by re-running AD-11's own tuning claim
  (`margin.cost` back to 180 turns clause 3 red as recorded).

## RF-2 — `t.results.costLabel` is a superstring of `t.upgradeShop.costLabel` (from finding F2)

- **File / symbol**: `src/i18n/pl.ts` → `t.results.costLabel`
  (`"Koszt sklepu: {cost} zł"`) against the pre-existing `t.upgradeShop.costLabel`
  (`"{cost} zł"`).
- **What is wrong**: the L-007 two-direction sweep over all 408 dictionary strings
  finds exactly one substantive collision, and it is this one. A spec locating the
  shop price with `getByText(fill(t.upgradeShop.costLabel, { cost: 40 }))` on a
  page that also rendered the breakdown would match twice. No shipped screen
  renders both, so nothing is broken now.
- **Also record**: plan Progress row **3.5** logs this grep as "CLEAN". That is
  accurate for the three Phase 3 strings it covered; the Phase 2 breakdown labels
  (`breakdownHeading`, `revenueLabel`, `costLabel`, `profitLabel`) were never
  swept. The lesson is to run the sweep in the phase that adds the string.
- **Fix**: either drop the unit from the results row (`"Koszt sklepu: {cost}"`), or
  keep the copy and pin the constraint in a comment beside the key plus
  `getByRole(..., { exact: true })` in any spec that locates either label. Note
  `"Koszt: {cost} zł"` is **not** a fix — it is still a superstring.
- **Do not** touch `t.growth.noNextUpgrade`; `e2e/growth.spec.ts` asserts it with
  `{ exact: true }` and the handoff already flags its imprecision for the
  native-speaker copy review.

## RF-3 — The decoration tile shows "insufficient funds" for every rejection (from finding F3)

- **File / symbol**: `src/components/child/UpgradeShop.tsx` → the decorations
  `<section>` keyed on `t.upgradeShop.decorationsHeading`, its `check.ok ? … : …`
  branch; compare the sibling `lockedReason` in the same component.
- **What is wrong**: the non-ok branch discards `check.reason` and always renders
  `fill(t.upgradeShop.lockedByFunds, { amount: d.cost - wallet })`.
  `canBuyDecoration` can also return `owned`, `wrong-world` and `unknown`; those
  are unreachable from this pre-filtered list today, but nothing pins that, and if
  the source ever widens the child is shown *"Brakuje -40 zł"*.
- **Fix**: a `decorationLockedReason(d)` mirroring `lockedReason`, or an explicit
  `check.reason === "insufficient"` guard with a comment naming why the other
  reasons cannot arrive from `decorationsForWorld(world.slug)` filtered to unowned.

## RF-4 — Doc hygiene in `src/i18n/pl.ts`

- **File / symbol**: the `// Upgrade catalog names (S-06)…` comment block, now
  sitting immediately above the new `decorations:` namespace instead of above the
  `upgrades:` object it describes.
- **Fix**: move the comment back down onto `upgrades:` and give `decorations:` its
  own header. Purely cosmetic; **do this after W1 merges**, since `src/i18n/pl.ts`
  is the run's hottest append-only file and moving lines in it is exactly what the
  concurrency contract asks both features not to do mid-run.

## Carried, not actionable here

- **`buyDecoration` inherits `buyUpgrade`'s read-then-write race**
  (`src/lib/services/child-profiles.ts` → `buyDecoration`). Pre-existing pattern,
  backstopped by the live `child_profiles_wallet_balance_nonneg` check constraint.
  Fixing it belongs to both spend paths in one change, not to this branch.
- **The handoff's five-item human checklist** (results `zysk` vs wallet delta,
  the branch-locked margins under "Wkrótce", glyph legibility, the exhausted-
  catalogue next-thing card, the world switch). Each has a named automated
  stand-in; the outstanding half is visual judgement a person must make.
