# Handoff — `six-worlds-catalogue` (feature F2)

Written by the **`/10x-implement` step**. The feature is **fully implemented on
`feat/six-worlds-catalogue`**: all seven phases done, all 47 Progress rows ticked,
three commits, working tree clean, nothing pushed. **The one thing the next agent
must not get wrong:** the merge order still binds — **F1 `feat/world-economy-profit-rule`
merges first, W1 second**. This branch was *cut from* F1, so F1's commits are already
its ancestors; merging W1 into `matmaverse-v2` before F1 would drag F1's whole change in
under W1's name.

## 1. State

| | |
| --- | --- |
| Branch | `feat/six-worlds-catalogue` |
| Cut from | `feat/world-economy-profit-rule` @ `a183a70` (unchanged during this step — re-checked at the end) |
| Position in stack | **2 of 2** — behind F1 `world-economy-profit-rule` |
| Commits | **3** — `8cec4c9..0302c70` (`git log feat/world-economy-profit-rule..feat/six-worlds-catalogue`) |
| Pushed? | **no** |
| `change.md` status | `implemented` |
| `## Progress` rows remaining | **0** (`grep -c '^- \[ \]' plan.md` = 0; 47 of 47 ticked, each carrying its phase commit's short SHA) |
| Working tree | clean after the epilogue commit; worktree at `.claude/worktrees/six-worlds-catalogue`, `E2E_PORT=4333` |

Commit map: `8cec4c9` = Phases 1+3+4 (one commit, because Phase 1 alone is a red tree),
`9cbbd62` = Phase 2, `0302c70` = Phases 5+6.

## 2. Artifacts

| path | what it is |
| --- | --- |
| `/Users/kamilp/Dev/10xDevs/.claude/worktrees/six-worlds-catalogue/src/data/worlds.ts` | **Edited.** Two `World` records appended (`pracownia`/*Pracownia*, `laboratorium`/*Laboratorium*); module header gains the second name↔slug↔art reconciliation. `WORLD_SLUGS`, `getWorld`, `worldForTheme` and both zod `.refine`s widened automatically — no signature changed |
| `…/tests/worlds-art.test.ts` | **New.** Four cases pinning `image === /illustrations/world-<slug>.webp`, file-existence on disk, slug uniqueness + URL-safety, and that `DEFAULT_WORLD` is in `WORLDS` |
| `…/src/components/child/ShopArt.tsx` | **Edited.** `WORLD_SLOTS` gains the `pracownia` and `laboratorium` keys, eight entries each. `DEFAULT_SLOTS`, the `ShopArt` function and F1's three tables untouched |
| `…/src/data/decorations.ts` | **Edited.** Two `setFor(...)` blocks appended to `DECORATIONS`. F1's four sets, the `Decoration` type, `DECORATION_PRICES` and every function untouched |
| `…/src/components/child/ShopGlyph.tsx` | **Edited.** Three keys appended to `SHOP_ICONS` (`scissors`, `spool`, `sticker`) plus their lucide imports — append-only, as that module's header sanctions. `ShopIconKey` is derived from the map's own keys, so no type edit was needed |
| `…/src/i18n/pl.ts` | **Edited, append-only.** Eight `decorations[...]` keys; one comment above `marketing.worlds`. `t.worlds` untouched |
| `…/src/components/child/WorldPicker.tsx` | **Edited.** `lg:grid-cols-3` on the `WORLDS.map` grid; the module header's "Only FOUR worlds exist" paragraph rewritten |
| `…/src/components/child/CreateProfileWizard.tsx` | **Edited.** Interest grid `sm:grid-cols-4` → `sm:grid-cols-3`, with a comment recording it as a no-orphan-row extrapolation |
| `…/e2e/worlds.spec.ts` | **New.** Risk W1-E2E-1, running in both projects |
| `…/playwright.config.ts` | **Edited.** `touch` `testMatch` alternation extended to `/(gameplay-restore\|growth\|worlds)\.spec\.ts/` |
| `…/context/changes/six-worlds-catalogue/plan.md` | **Edited** — `## Progress` only, all 47 rows ticked with SHAs |
| `…/context/changes/six-worlds-catalogue/change.md` | **Edited** — `status: plan_reviewed` → `implemented` |
| `…/context/changes/six-worlds-catalogue/handoff.md` | This file |

No migration was written. `docs/reference/contract-surfaces.md` was not touched — no
surface is renamed or reshaped, and its `child_profiles` section names no world count.

## 3. Verification

**Branch baseline, measured in Phase 0 on `feat/six-worlds-catalogue` before any edit**
(NOT the contract's `matmaverse-v2` @ `91754ef` numbers, which are the base branch's):
`npm test` **629 passed / 62 files**, `E2E_PORT=4333 npx playwright test` **26 passed**,
`npm run lint` exit 0, `npm run check` 0 errors / 0 warnings / 8 hints. Sandbox disabled
for every suite; local Supabase confirmed up on 127.0.0.1:54321.

| command | result |
| --- | --- |
| `npm test` | **633 passed / 63 files (baseline 629, +4)** — the four new `tests/worlds-art.test.ts` cases. Phases 2–6 add no unit tests by design |
| `npm run lint` | exit **0** |
| `npm run check` | exit **0** — 0 errors, 0 warnings, 8 hints, 212 files |
| `E2E_PORT=4333 npx playwright test` | **28 passed (baseline 26, +2)** — one desktop and one **touch** run of `e2e/worlds.spec.ts`, confirmed by name in the runner output. `+1` would have meant the `testMatch` edit was skipped |
| `UPGRADE_IDS` / decoration sinks (own) | `UPGRADE_IDS` reads **8** on this branch (`sign,shelf,register,slot,storage,customers,precision,margin`); `decorationsForWorld("pracownia")` and `…("laboratorium")` are both **4** |
| Badge placement (own, measured not eyeballed) | Every one of the 16 new `WORLD_SLOTS` entries samples **0% non-background ink** in its badge rect against its own plate. The probe was itself meta-checked: coordinates over the sewing machine, the mannequin, the bulb and the coin stack sample **57–100%**, so the measurement discriminates |
| Manual rows 1.6, 2.5, 2.6, 2.7, 3.6–3.8, 4.8, 4.9, 6.8, 6.9 | Verified from **real rendered screenshots** at 1280 / 900 / 712 / 700px against a seeded profile, not asserted from code. See "manual rows" below |

**Deliberate breaks — five run, each meta-checked (L-004):**

1. **Phase 1** — pointed `pracownia.image` at a non-existent stem. `tests/worlds-art.test.ts`
   went red on both the derivation and the on-disk-existence case; restored green.
   *Meta-check, and this one earned its keep:* re-running the **whole suite with that file
   excluded** left **629/629 green**. Nothing else in the repo reads `World.image`, so the
   redness is evidence for exactly the claim the test makes.
2. **Phase 3a** — deleted `pracownia.sign`. The id sweep went red naming `"pracownia" has
   no slot for upgrade "sign"`; restored.
3. **Phase 3b** — deleted the whole `laboratorium` table. The per-world case went red
   naming that slug; restored. *Meta-check:* `tests/shop-art-slots.test.tsx`'s own header
   records that dropping the `WORLD_SLOTS[world.slug]?.` **prefix** leaves all four data
   assertions green — so a prefix break would prove nothing about W1's contribution, which
   is *data*. These two are the breaks a real mistake produces (a missed id when
   `UPGRADE_IDS` grew, a table typo'd under the wrong key).
4. **Phase 4** — removed the `laboratorium` decoration set. Three cases in
   `tests/decorations.test.ts` went red, each naming `laboratorium` by slug; restored.
   *Meta-check (L-009, path not fact):* the red **names the world that was emptied**, not
   merely "something is red".
5. **Phase 5 — the contracted break was WRONG and this is the finding worth carrying.**
   The plan contracted `grid-cols-6` at the touch width to prove the overflow assertion.
   It does not: Tailwind's `grid-cols-6` is `repeat(6, minmax(0, 1fr))`, the tracks shrink,
   the grid never scrolls, and the **column-count** assertion carried the failure while the
   overflow number stayed **0**. The break that actually removes the protection gives the
   tracks a floor — `grid-cols-[repeat(6,minmax(9rem,1fr))]`, i.e. tiles that cannot shrink,
   which is also the plausible real regression. Under that edit the overflow expectation is
   the one that goes red, before the column assertion runs. Both the wrong break and the
   right one are **banked in `e2e/worlds.spec.ts`'s module header** so nobody re-learns it.

**Phase 6's L-009 path check:** the id sweep was run **unrepaired first** — `precision`
and `margin` stripped from the two new tables, i.e. the state a branch cut from
`matmaverse-v2` would have produced — and recorded **red** (`"pracownia" has no slot for
upgrade "precision"`; vitest stops at the first failing expectation, so it names one pair
rather than all four). A green there would have meant the branch point never carried F1's
catalogue and the branch itself was wrong. Restored, green.

**How the manual rows were closed.** A throwaway spec (written, run, deleted — never
committed) seeded profiles in both new worlds and screenshotted the real app. Confirmed by
eye: `/app/worlds` is **3×2 at 1280px** and **2×3 at 712px** with both new plates loading
and the CTA reachable; the wizard's interest step is **3×2 with no orphan row at 700px**;
the signed-out auth strip still shows **four** cards, unchanged; every upgrade badge on
both plates sits in a margin at two container sizes; with the catalogue exhausted and
decorations unowned, **Pracownia's shop offers all four decorations at 40/80/140/220 zł**
as lucide glyphs (sticker, spool, palette, scissors), **Laboratorium's are visibly
different** (star, flask, microscope, atom), and `/app/growth` names *"Świecące gwiazdki —
40 zł"* as the next thing. No row was ticked without being observed.

## 4. Next command

`/10x-impl-review six-worlds-catalogue`

## 5. Open

Each names a file and a **symbol** (L-006).

- **Merge order is a hard constraint, and this branch's shape makes it easy to get wrong.**
  `feat/six-worlds-catalogue` was **cut from** `feat/world-economy-profit-rule`, so F1's
  commits are ancestors of W1's. Merge **F1 first**. Merging W1 into `matmaverse-v2` first
  would land F1's entire change silently under W1's name.
- **The plan's Phase 5 deliberate break was wrong** — see Verification #5. Nothing is
  broken in the shipped code; the *contracted verification* could not prove what it claimed.
  Worth generalising into a lesson: **a break must remove the protection, not merely
  perturb the component** — Tailwind's `minmax(0,1fr)` tracks make the obvious
  "too many columns" break invisible to any overflow assertion.
- **`t.marketing.worlds` in `src/i18n/pl.ts` stays a hand-maintained duplicate of `WORLDS`**
  at four entries, now commented as a marketing sample (plan Decision 2). Nothing tests it
  and nothing syncs it. Clean follow-up: derive it from `WORLDS` and land it **together
  with** `AuthShell.astro`'s `grid-cols-4` → `grid-cols-3`, or the signed-out panel goes
  ragged 4+2 on desktop with no test to catch it.
- **World names are inline literals on `World`** in `src/data/worlds.ts`, not dictionary
  entries — a standing L-003 tension this change makes 50% larger. Deliberately not fixed
  (moving them restructures a file F1 appends to in the same stack). Follow-up: a `nameKey`
  on `World` resolving through the dictionary, landed alone. Note
  `public/illustrations/slice-map.md`'s claim that world labels are *"rendered as text from
  `i18n`"* is already false and is now falser.
- **`CreateProfileWizard`'s `sm:grid-cols-3` is chosen by rule, not by mockup.** The `05`
  auth-v2 mockup would settle it and is unreadable from the code lane (`assets/` is
  gitignored and absent from worktrees). The comment at the grid says so. It looks correct
  at 700px in the captured screenshot.
- **The `t.worlds` namespace collision is deferred, not resolved.** When per-world
  catalogue vocabulary is written it must not nest under `t.worlds` (the world-selection
  *screen* namespace); `t.worlds.bySlug[slug]` or a sibling namespace are the non-colliding
  homes. W1 wrote nothing there, so it inherits nothing.
- **`CreateProfileWizard` passes the world name as both `alt` and `label`** to `SelectTile`,
  doubling each wizard tile's accessible name. Pre-existing across all six worlds; it is why
  `e2e/onboarding.spec.ts` needs `.first()` and why no wizard-tile locator may use
  `{ exact: true }` on the bare name. `e2e/worlds.spec.ts` is unaffected — `WorldPicker`
  passes `alt=""` deliberately, which is what lets that spec use `{ exact: true }`.
- **`playwright.config.ts`'s `touch` `testMatch` is now a three-way alternation.** Every
  other writer — F1's `/10x-e2e` step included — **extends** it and never replaces it; on a
  merge conflict here, **keep both alternatives**. A lost alternative is silent: the spec
  still runs, desktop-only, at the one viewport that cannot carry its risk.
- **`public/illustrations/slice-map.md` was not edited.** Both new plates were already
  committed and registered by an earlier change (§ *"World cards, second batch (W1)"*); this
  step pulled nothing new out of `assets/`.

## 6. Autonomous decisions

Every `AskUserQuestion` the `/10x-implement` skill calls for — the mismatch prompt, the
manual-confirmation gate, the dirty-path question, the commit-message approval, the
between-phase prompt and the final-review offer — collapsed to *decide, then proceed*
(run hard rule 1). Only the decisions with real content are recorded here.

- **Phase 1 produced FOUR reds, not the two the plan predicted — treated as a correct
  prediction under-counted, not as "something else broke".** *Chosen:* proceed. All four
  live in the two files the plan named (`tests/decorations.test.ts` ×3,
  `tests/shop-art-slots.test.tsx` ×1), all four are caused by `WORLD_SLUGS` widening from
  four slugs to six, and all four closed exactly where the plan said they would (Phases 3
  and 4). *Rejected:* halting on the plan's literal *"Three reds, or a red anywhere else,
  means something else broke"*. The plan was written from F1's **plan**, which contracted
  one totality assertion; F1's **landed** `tests/decorations.test.ts` quantifies over
  `WORLD_SLUGS` in three cases (totality, the shared price curve, and *"only ever names the
  CURRENT world's decorations"*). *What would change the answer:* a red outside those two
  files, or one that survived Phase 3/4 — either would have been a genuine defect.
- **Phase 5 was executed here rather than deferred to a `/10x-e2e` step.** *Chosen:* run
  it. The touch-viewport reflow is the only browser-visible risk in the feature, the
  harness and port were already up, and the `playwright.config.ts` `testMatch` edit is
  W1-owned per `ownership.md` — leaving it would ship a reflow nothing measures.
  *Rejected:* leaving Phase 5 pending for the run's own e2e step. *What would change the
  answer:* the orchestrator dispatching a `/10x-e2e` step for W1 — it will now find the
  phase done and should verify rather than regenerate.
- **The Phase 5 deliberate break was replaced after it failed its own meta-check.**
  *Chosen:* find the break that actually removes the protection
  (`grid-cols-[repeat(6,minmax(9rem,1fr))]`), run it, and bank both breaks in the spec
  header. *Rejected:* recording the contracted `grid-cols-6` break as passed — it did go
  red, so the row could have been ticked dishonestly; the failure was the **column-count**
  assertion, and the overflow assertion the phase exists to prove stayed green (L-004
  exactly). Also rejected: rewriting the assertion to match the break. *What would change
  the answer:* nothing about the shipped code — this is a correction to the *verification*,
  and the plan's Phase 5 §1 assertion contract was right.
- **Badge coordinates were measured with a throwaway pixel probe instead of eyeballed.**
  *Chosen:* render each plate to a canvas, map each candidate badge rect into plate
  coordinates, and reject any placement with meaningful non-background ink. The probe was
  meta-checked against deliberate over-content placements (57–100% ink) before being
  trusted, then deleted — it is not committed. *Rejected:* shipping the plan's
  research-derived coordinates unverified (one of them, `pracownia.margin` at `bottom: 3%`,
  grazed the coin stack and was moved to `2%` as a result). *What would change the answer:*
  a mockup that draws upgrade badges on either plate — none does, which is why the module
  comments record the coordinates as an extrapolation.
- **The two new worlds get FOUR decorations each, at F1's shared 40/80/140/220 curve**
  (contract open decision #4). *Chosen:* inherit F1's landed `DECORATIONS_PER_WORLD` and
  `DECORATION_PRICES` rather than pick a number. *Rejected:* the plan's standalone fallback
  of 3 — it applies only if F1's landed registry contradicts its own AD-5, and it does not.
  *What would change the answer:* F1 re-pricing its sink; W1 follows F1 to the new number,
  because unequal sink capacity between worlds is the one way an effect-free decoration set
  could still create the between-world asymmetry D-11 exists to prevent.
- **W1 writes no per-world catalogue vocabulary** (contract open decision #3). *Chosen:*
  ship on the mandatory `upgradeCopy(id)` fallback, which already **is** current behaviour;
  zero of the 6 × 8 strings. Both features decided this independently (F1 AD-8, W1
  Decision 1), so the run settles the contract's decision #3 as *"ship on the fallback"*.
  *Rejected:* writing 48 strings of child-facing Polish with no mockup source against a
  catalogue F1 was changing in the same stack. *What would change the answer:* the
  maintainer supplying or approving the copy — it is a `pl.ts` change with no code change.
- **Three keys were appended to `SHOP_ICONS` (`scissors`, `spool`, `sticker`).** *Chosen:*
  append, as that module's header explicitly sanctions (*"CLOSED but APPEND-EXTENSIBLE …
  which is what lets `six-worlds-catalogue` give its two worlds visibly different decoration
  sets"*). E1's 16 icons carry no craft vocabulary, so restricting Pracownia to them would
  have made the two new sets read alike and failed the plan's own criterion 4.9. *Rejected:*
  reusing a wrong icon to avoid touching an F1-owned file. *What would change the answer:*
  F1 pinning the union with an exhaustive literal list — it does not; `ShopIconKey` is
  `keyof typeof SHOP_ICONS`, so appending widened it with no type edit.
- **The change folder was copied into the worktree and committed there.** *Chosen:* mirror
  F1's own precedent (`docs(world-economy): carry the F1 change folder onto the feature
  branch`) so the branch is self-describing. The main checkout's untracked copy was left
  alone and is refreshed from the worktree at the end of this step. *Rejected:* editing
  `plan.md` in the main checkout, which another agent holds. *What would change the answer:*
  an orchestrator that owns the change folders centrally — then the worktree copy would be
  read-only.
- **The scratch verification spec and the pixel probe were deleted, not committed.**
  *Chosen:* delete. Both are provisioning tools for this step's manual rows, not risks worth
  a permanent test — a screenshot spec with no assertions is a maintenance cost that fails
  for reasons unrelated to any product claim. *Rejected:* committing them as e2e specs
  (they would have run in CI and in every future `npx playwright test`). *What would change
  the answer:* wanting pixel regression on the shop scene — that needs a deterministic tool
  (`toMatchSnapshot`), which `e2e/CLAUDE.md` already names as the right shape for it.
