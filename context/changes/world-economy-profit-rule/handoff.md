# Handoff — `world-economy-profit-rule` (feature F1)

`/10x-implement` wrote this (retry 2/2 re-verified and re-placed it). **All six plan
phases are implemented, verified and committed on `feat/world-economy-profit-rule`;
all 39 `## Progress` rows are ticked and nothing is pushed.** The one thing the next
agent must not get wrong: **`DOMINANCE_FLOOR` is 0.35 applied only at the opening
choice, not the plan's 0.6 over every live state — because 0.6-everywhere is provably
unsatisfiable, and the reason is a finding, not a fudge** (see §5 and §6, AD-10).
Merge order still binds: **F1 before W1 `six-worlds-catalogue`**, and W1 branches from
**this** branch, not from `matmaverse-v2`.

## 1. State

| field | value |
| --- | --- |
| Branch | `feat/world-economy-profit-rule` |
| Cut from | `matmaverse-v2` @ `91754ef` |
| Worktree | `.claude/worktrees/world-economy-profit-rule` (E2E_PORT **4330**) |
| Position in stack | **F1, first of 2** — `six-worlds-catalogue` (W1) branches from here and merges after |
| Commits | **7**, `502c798..HEAD` — six code phases plus one docs commit carrying `context/changes/world-economy-profit-rule/` onto the branch |
| Pushed? | **no**. No PR. |
| `change.md` status | `implemented` |
| `## Progress` rows remaining | **0** (`grep -c '^- \[ \]' plan.md` = 0; 39 of 39 ticked, each with its commit sha) |
| Working tree | **clean** in the worktree, after the docs commit. In the main checkout the change folder is committed on `matmaverse-v2`; the two paths that are **not mine** (`context/changes/six-worlds-catalogue/`, `context/runs/2026-08-27-world-economy/`) are left untracked for their owning steps. |

## 2. Artifacts

| path | what it is |
| --- | --- |
| `/Users/kamilp/Dev/10xDevs/.claude/worktrees/world-economy-profit-rule/scripts/telemetry-harness/pacing.ts` | **new** — the D-13 pacing model. `referenceShift`, `costInTasks`, `shiftPayout` (the module's single payout call site), `simulatePurchases` (greedy buyer over the real `planShift`/`createShiftSource`/`foldShiftOutcomes`/`canBuy`, **models the world change**), `report`/`formatTimeline` |
| `…/src/data/upgrades.ts` | `ShopEffects`, `shopEffects`, `shopRunningCost`; `Upgrade` gains `runningCost` (required), `quantityMargin?`, `accuracyMargin?`, `icon?`, `requiredUpgrade?`, and `art` becomes optional; the `precision` + `margin` entries; `canBuy`'s `branch-locked` rung; `BuyReason` gains `branch-locked` and `wrong-world`; the ART DEVIATION header |
| `…/src/data/shift.ts` | **new `profitForShift`**; `earningsForShift` retained and re-documented as *revenue*; type-only `ShopEffects` import |
| `…/src/data/decorations.ts` | **new** — `Decoration`, `DECORATIONS` (16 = 4 worlds × 4), `DECORATION_IDS`, `DECORATION_PRICES`, `getDecoration`, `decorationsForWorld`, `readDecorations`, `canBuyDecoration`, `nextPurchase`, the ART DEVIATION header |
| `…/src/components/child/ShopGlyph.tsx` | **new** — `SHOP_ICONS` (append-extensible), `ShopIconKey = keyof typeof SHOP_ICONS`, `ShopGlyph`. Serves all five art render sites |
| `…/src/lib/services/child-profiles.ts` | `recordShiftResult` credits `profit` (`const earned = profit;`); `ShiftResult` gains `revenue`/`cost`/`profit`; **new `buyDecoration`** |
| `…/src/pages/api/decorations/buy.ts` | **new** route (`prerender = false`, zod `z.enum(DECORATION_IDS)`) |
| `…/src/pages/api/shifts/complete.ts` | 200 body gains `revenue`/`cost`/`profit` |
| `…/src/components/child/{ShiftScreen,ShiftResults,ShopArt,UpgradeShop}.tsx` | island stops computing its own payout; the przychód·koszt·zysk breakdown; decorations in `ShopArt`'s corner row; the decoration section in the shop |
| `…/src/pages/app/{start,growth,upgrades,task}.astro` | `nextUpgrade` → `nextPurchase`; `decorations` threaded; `ShopGlyph` |
| `…/src/types.ts` | `ShopState.decorations?: string[]` (append-only) |
| `…/src/i18n/{pl.ts,index.ts}` | `t.results.{breakdownHeading,revenueLabel,costLabel,profitLabel}`, `t.upgrades.{precision,margin}`, `t.upgradeShop.{lockedByBranch,decorationsHeading,decorationsHint,emptyDecorations}`, `t.decorations` × 16; new `decorationCopy` + `purchaseName` helpers |
| `…/tests/{pacing,economy-invariants,decorations,decorations-buy}.test.ts`, `…/tests/shop-glyph.test.tsx` | **new** — 5 files |
| `…/tests/{shift,shifts-complete,upgrades,shift-screen,shop-art-slots}.test.*` | extended |
| `…/e2e/growth.spec.ts`, `…/e2e/helpers/accounts.ts` | Risk E2E-F4-3 re-seeded (anchored on `decorationsForWorld`, not a literal id list); `seedChildProfile`'s `shopState` widened with optional `decorations` |
| `…/docs/reference/contract-surfaces.md` | § `public.child_profiles` documents `shop_state.decorations`; § `public.shift_log` records that `earned` carries profit and that a decoration writes no row |
| `…/scripts/telemetry-harness/README.md` | the price-in-tasks table, the content-run table, three findings, the caveat |
| `…/context/changes/world-economy-profit-rule/{change.md,plan-brief.md,research.md,plan.md,handoff.md,reviews/plan-review.md}` | **placed on the branch by this retry** — the change folder now lives in the worktree, not only in the main checkout |
| `/Users/kamilp/Dev/10xDevs/context/changes/world-economy-profit-rule/` | the same six files, committed on `matmaverse-v2` in the main checkout with identical content |

**No migration. No new asset. `public/illustrations/slice-map.md` untouched** —
nothing was pulled out of `assets/` (which is absent from the worktree anyway).

## 3. Verification

Baseline is `matmaverse-v2` @ `91754ef`, which is exactly the commit this branch was
cut from, so the run contract's baseline **is** this branch's baseline: lint exit 0 ·
check 0 errors / **202 files** · **548 passed / 57 files** · **26 Playwright**.

All four rows below were **re-run in this retry**, on the final tree, sandbox
disabled, local Supabase up (API on `127.0.0.1:54321`).

| command | result (observed in this step) |
| --- | --- |
| `npm run check` | **exit 0 — 0 errors, 0 warnings, 8 hints, 211 files** (baseline 202 files, **+9**) |
| `npm run lint` | **exit 0**, clean |
| `npm test` | **629 passed / 629, 62 files** — baseline 548 / 57, **+81 tests, +5 files** |
| `E2E_PORT=4330 npx playwright test` | **26 passed / 26** — baseline 26, **+0** |
| per-phase test counts (as committed) | 548 → 560 (+12) → 571 (+11) → 587 (+16) → 593 (+6) → 626 (+33) → 629 (+3) |

**Bootstrap canary re-run in this retry (L-009):** `require.resolve('astro')` and
`require.resolve('vitest')` from inside the worktree both resolve **under the
worktree's own `node_modules/`**, not the parent repo's — checked by comparing the
absolute path, not by asking "did it find something?". `.env.test` is present, which
is what keeps the unit suite at 62 files instead of silently dropping ~150 tests.

**A bootstrap gap worth knowing:** in a fresh worktree `npm run lint` fails with
**57 `no-unsafe-*` errors** until `astro sync` has generated `.astro/` types — `npm
run check` does that as a side effect. Run `check` before `lint` on a fresh tree, or
the failure looks like a code defect. The bootstrap script's canaries pass either
way, so this is silent.

**Deliberate break re-run in this retry, on the feature's central claim.** Broken:
`recordShiftResult` in `src/lib/services/child-profiles.ts`, `const earned = profit;`
→ `const earned = revenue;`. **Went red:** two cases in `tests/shifts-complete.test.ts`,
including § *"credits the wallet with PROFIT, not revenue — the cost never reaches the
wallet twice"* (`expected 42 to be 36`). Restored; the file re-ran **25 passed** and
`git status` is clean. **Meta-check (L-004):** this is not an implausible edit — it is
literally the pre-D-11 behaviour, i.e. what a revert or a careless merge reintroduces,
so the redness is evidence about the real regression path. Two second-order facts
confirm the break proves what it appears to: `tests/economy-invariants.test.ts` stayed
**green** under it (the FR-008 monotonicity sweep cannot see the difference between
revenue and profit, since both only grow the wallet — so monotonicity certifies nothing
about the profit rule and the route-level case is load-bearing), and the assertion that
bit is a *durable-state* read-back of `wallet_balance`, not an API response shape.

**The nine deliberate breaks run during the original six phases** are recorded in the
plan's `## Progress` evidence and in the phase commit bodies. Per contract rule 5 I did
not inherit them as observed greens; the one above is the one I re-ran myself. The most
consequential of the nine, restated because it changed what shipped: deleting a whole
world's decoration set does **not** turn the never-idle pacing assertion red — the
simulator treats a drained world and an empty one identically and moves on — so that
case is caught only by `tests/decorations.test.ts` § *"gives every world in
`WORLD_SLUGS` a full decoration set"*. The two guards are complementary; this is
exactly the seam W1 lands on.

**A real bug the original run introduced and the shipped tests caught:** an edit to
`canBuy` dropped the `requiredWorldLevel` rung while inserting the branch rung.
`tests/upgrades.test.ts` and `tests/upgrades-buy.test.ts` went red on three cases
immediately. Fixed before commit; no phase shipped with it.

## 4. Next command

`/10x-impl-review world-economy-profit-rule`

## 5. Open

- **`DOMINANCE_FLOOR` is 0.35 at the opening choice, not the plan's 0.6 everywhere —
  and the plan's `RETHINK` escape was exercised.** `tests/economy-invariants.test.ts`
  § `DOMINANCE_FLOOR`. Swept over the whole reachable space, a 0.6 floor on every live
  state is **provably unsatisfiable** over the tunables, and the cause is not the branch
  design: the five capacity entries all buy the same `+1` task at prices spanning 5×
  (`shelf` 60 → `customers` 300), so their ROI per zloty spans 5× **inside one branch**,
  and AD-7 freezes those costs. A margin priced within 0.6 of `shelf` is >3× better than
  `customers`; priced within 0.6 of `customers` it falls under `shelf`. Raising the
  margins' `runningCost` far enough to close the gap makes them no-trap violations on a
  low-clean shift. **The residual is reported, not asserted away** — finding 3 in
  `scripts/telemetry-harness/README.md`. The fix, if the maintainer wants one, is to
  flatten the capacity price curve, which means overturning AD-7.
- **The first purchase lands on shift 1, not shift ~3**, for all three cohorts.
  `prd-v3.md` FR-013's pacing bound is satisfied by shift 1, so AD-7 reports rather than
  fixes it. **A human decision neither the plan nor implementation made:** whether "a
  first purchase with no saving decision before it" violates the *intent*. Reversing it
  means raising `sign` to ~60–70 and re-running every affordability assertion in
  `e2e/gameplay-restore.spec.ts`.
- **`t.growth.noNextUpgrade` is now slightly imprecise** — it says *ulepszenia* but
  fires when a world's decorations are exhausted too. Kept verbatim because
  `e2e/growth.spec.ts` asserts it and renaming risks an L-007 substring collision. For
  the native-speaker copy review, together with the 16 new `t.decorations` names and
  `t.upgradeShop.decorationsHint`, all authored unattended.
- **Human checklist — five things only a person at a browser can confirm.** None is
  a ticked-but-unverified row: each has an automated stand-in named in the plan's
  Progress rows, but the *visual* judgement is outstanding. (1) plan **2.5** — play a
  shift owning two capacity upgrades and confirm the results `zysk` equals the
  `/app/start` wallet delta; (2) **3.7** — `/app/upgrades` at level 3 without `sign`:
  both margins under "Wkrótce" with the branch reason; (3) **3.8** — the two margin
  tiles and the 16 decoration tiles render *legible* lucide glyphs at the same visual
  weight as the illustrated ones; (4) **5.7** — with the catalogue exhausted,
  `/app/growth` and `/app/start` name a current-world decoration; (5) **5.8** —
  switching worlds presents a fresh set with owned upgrades untouched.
- **Contention with W1, all sides additive.** `src/i18n/pl.ts` (append-only; F1 created
  `t.decorations`, W1 appends 8 ids into it); `WORLD_SLOTS` in
  `src/components/child/ShopArt.tsx` (F1 added `precision`/`margin` inside the three
  shipped world keys and `DEFAULT_SLOTS`; W1 adds two new top-level keys); `SHOP_ICONS`
  in `src/components/child/ShopGlyph.tsx` (**W1 may append** — `ShopIconKey` is derived
  from the map's keys, and eight spare keys are already mapped and unused for exactly
  this); `DECORATIONS` in `src/data/decorations.ts` (W1 appends 8 entries at the same
  40/80/140/220 curve); `docs/reference/contract-surfaces.md` — **on conflict keep both
  sides.**
- **The W1 seam is live and loud, as designed.** W1's Phase 1 widens `WORLD_SLUGS` to
  six and will turn **two** F1-owned cases red: `tests/shop-art-slots.test.tsx` § *"gives
  every non-default world its own slot table"* / *"covers every upgrade id in every
  table"*, closed by W1's Phase 3; and `tests/decorations.test.ts` § *"gives every world
  in `WORLD_SLUGS` a full decoration set"*, closed only by W1's Phase 4. Exactly one red
  instead of two is a finding against F1.
- **`t.growth.upgradesLink` must keep existing.** `/app/growth` is the only entrance to
  the shop, and the decoration shop lives inside `/app/upgrades`. No nav entry was added;
  `t.nav.items` stays at six.
- **No mockup exists** for a decoration, for the three-number results breakdown, or for
  the shop's decoration section, and `assets/` is absent from the worktree. All three
  layouts are **explicit extrapolations** from `ShopArt`'s corner-row language and the
  shop's existing tile grid — impl-review must not read them as mockup-derived.
- **Integration note for whoever merges.** The change folder is now committed on **both**
  `feat/world-economy-profit-rule` and `matmaverse-v2`, with byte-identical content, so
  the merge sees an identical add/add and resolves without a conflict. Had it stayed
  untracked in the main checkout, `git merge` would have refused with *"untracked working
  tree files would be overwritten"*.

## 6. Autonomous decisions

The plan's **AD-1…AD-9** all stand as written and were implemented unchanged. The
implementation step made **AD-10…AD-15**; this retry made **AD-16**.

- **AD-10 — no-dominance ships as three scoped clauses at `DOMINANCE_FLOOR = 0.35`,
  rather than one clause at 0.6 over every live state.** *Chosen:* (1) neither branch
  dominates **at the moment the choice opens** (`sign` owned, neither branch started) —
  measured worst ratio 0.50 against a 0.35 floor; (2) each branch is the better buy in
  ≥25% of live states — measured 34% / 66%; (3) within a branch, a dearer entry is never
  better value per zloty. *Rejected:* keeping 0.6 everywhere (unsatisfiable — proof in
  §5); lowering the floor to the measured worst of 0.082 and keeping the original scope
  (a 12× spread is dominance by any reading, so that floor certifies nothing); deleting
  the sweep (the plan forbids it). *Why:* all three clauses fail loudly on real
  mistuning and **none was fitted to the data** — clause 3 found a genuine defect before
  it shipped. *What would change the answer:* overturning AD-7 and flattening the
  capacity price curve — then a single per-state floor becomes satisfiable and should
  replace clauses 1–2.
- **AD-11 — `margin.cost` moved 180 → 220; nothing else was tuned.** *Chosen:* the one
  constant change of the whole tranche. At 180, `margin` was dearer than `precision`
  **and** better value per zloty, because a quantity margin pays on every task while an
  accuracy margin pays only on clean ones — 1.25× the gross at the engine's own
  `TARGET_SUCCESS`. *Rejected:* lowering `margin`'s multiplier (makes the branch limp and
  hurts clause 2); raising its `runningCost` (pushes it toward a no-trap violation on a
  low-clean shift); 210, the first passing value (it ties `storage`, which makes
  `nextPurchase`'s cheapest-first rule pick arbitrarily **across branches**). *What would
  change the answer:* a pacing re-run showing `margin` unreachable, or `EARN_PER_TASK` /
  `EARN_PER_CLEAN` moving.
- **AD-12 — the profit breakdown renders only when `cost > 0`, not just its cost row.**
  *Chosen:* hide the whole *przychód · koszt · zysk* block at zero cost. *Rejected:* the
  plan's letter (hide only the cost row) — at cost 0 that leaves two identical figures
  beside the payout the child already sees, and a heading over a non-subtraction. *Why:*
  it appears the shift after the first earning upgrade is bought — exactly when the child
  made the decision it explains — and it keeps the shipped `e2e/gameplay-restore.spec.ts`
  screens textually unchanged. *What would change the answer:* a decision that the
  breakdown should teach *before* there is anything to subtract; then render it always
  and word the zero case explicitly.
- **AD-13 — the pacing simulator models the world change.** *Chosen:* walk `WORLD_SLUGS`
  in order, moving on when a world's sink is drained. *Rejected:* pinning the simulation
  to one world (as originally written) — it showed the wallet going dead at shift 22,
  which the product does not do, and made the plan's contracted "the wallet is never
  idle" assertion unstatable. *Why:* `/app/worlds` invites the move and `t.worlds`
  promises it is lossless, so the single-world simulation modelled a product that does
  not exist. *What would change the answer:* evidence that children do not switch worlds
  when a sink empties — then the honest model is one world, and the sink needs to be
  deeper per world.
- **AD-14 — "the wallet is never idle" is scoped to *affordable* idleness.** *Chosen:*
  assert that zero-buyable only ever coincides with a wallet below the cheapest remaining
  thing, and that "nothing left at all" only occurs once everything is owned. *Rejected:*
  the plan's literal "at every shift after the first purchase there is at least one
  buyable thing" — false and undesirable, since a child saving for a 220 zł decoration
  has nothing buyable and that is the saving behaviour FR-013 wants. *What would change
  the answer:* nothing product-side; the scoped form is strictly stronger where it
  matters and honest where it does not.
- **AD-15 — the plan's Phase 6 §1 regression repair was committed WITH Phase 5.**
  *Chosen:* one commit. *Rejected:* a separate Phase 6 commit for it. *Why:* Phase 5 is
  what breaks that E2E, so committing Phase 5 alone would have put a red commit on the
  branch, violating the run's *commit only on green* rule. Phase 6's own commit carries
  the pacing re-run and the documentation. *What would change the answer:* nothing — this
  is the only ordering that keeps every commit green.
- **AD-16 (this retry) — the change folder is committed on the feature branch, and an
  identical copy is committed on `matmaverse-v2` in the main checkout.** *Chosen:* a
  seventh, docs-only commit on `feat/world-economy-profit-rule` carrying
  `context/changes/world-economy-profit-rule/`, plus the same six files committed on
  `matmaverse-v2` in the main checkout (`git add` scoped to that one path — the
  neighbouring `context/changes/six-worlds-catalogue/` and
  `context/runs/2026-08-27-world-economy/` belong to other steps and were **left
  untracked**, per the contract's "your change folder is yours, another feature's is
  not"). *Why:* the previous attempt left the folder untracked in the main checkout only,
  so the verifier's greps for `plan.md` and `handoff.md` **inside the worktree** found
  nothing and the step failed despite the code being complete and green; and an untracked
  copy in the main checkout would additionally have made `git merge` of this branch abort
  with *"untracked working tree files would be overwritten"*. Committing identical
  content on both sides makes the merge an identical add/add. *Rejected:* committing only
  in the worktree (leaves the main checkout's untracked copy blocking the merge);
  deleting the main checkout's copy (destroys the working input other steps read);
  committing the whole `context/` untracked set (would commit two other features' work,
  which the concurrency contract forbids). *What would change the answer:* an
  orchestrator convention that `context/changes/` stays untracked until the integrate
  step commits it in one sweep — then the worktree commit alone is right and the main
  checkout should be left entirely alone.
