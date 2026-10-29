# Follow-ups — `six-worlds-catalogue` implementation review

Raised by `/10x-impl-review` on 2026-08-27 against `feat/six-worlds-catalogue` @ `0a056f4`.
**None of these blocks the merge** (0 CRITICAL findings; `MERGE: CLEAR`). Each names a
file and a **symbol**, never a line number (L-006).

## F1 — Derive `marketing.worlds` from `WORLDS`, together with `AuthShell`'s column count

- **Where**: `src/i18n/pl.ts` → `pl.marketing.worlds`; `src/components/auth/AuthShell.astro`
  → the `hidden grid-cols-4 … lg:grid` strip that renders it.
- **What**: the signed-out marketing strip still lists four worlds (including `Kawiarnia`,
  which is `DEFAULT_WORLD`) while `WORLDS` carries six. Nothing syncs them and nothing
  tests `marketing.*`, so the drift is invisible to the suite.
- **Do**: derive the list from `WORLDS` **and** change `grid-cols-4` → `grid-cols-3` in the
  same change. Landing either half alone gives a ragged 4+2 desktop row that no test catches.
- **Why not now**: `ownership.md` assigns neither file to W1 this run, and W1's plan
  Decision 2 chose the safe half deliberately.

## F2 — Move world names into the dictionary, and fix the `slice-map.md` sentence that already claims they are

- **Where**: `src/data/worlds.ts` → the `name` field on each `World` in `WORLDS`;
  `public/illustrations/slice-map.md` § *Notes*.
- **What**: six user-visible Polish labels live as inline literals on a data record
  (standing L-003 tension, 50% larger after this change), while `slice-map.md` asserts
  world labels *"are rendered as text from `i18n`, not baked in"* — false today.
- **Do**: add a `nameKey` to `World` that resolves through `src/i18n/pl.ts`, landed **alone**
  after the stack merges (it restructures a file two branches append to); correct the
  `slice-map.md` Notes sentence in the same change.
- **Why not now**: `ownership.md` §1a explicitly forbids W1 from moving world names into
  the dictionary this run.

## F3 — Give the badge-placement rows durable evidence, or stop implying they have it

- **Where**: `src/components/child/ShopArt.tsx` → the `pracownia` and `laboratorium` keys
  of `WORLD_SLOTS`; `context/changes/six-worlds-catalogue/plan.md` Progress rows 3.6–3.8, 6.8.
- **What**: those rows were closed with a throwaway pixel probe that was deliberately not
  committed, so the 0%-ink measurement cannot be re-run. What is checkable held:
  `tests/shop-art-slots.test.tsx`'s four data assertions cover both new tables.
- **Do**: either commit a deterministic visual check (`toMatchSnapshot`, the shape
  `e2e/CLAUDE.md` already names), or drop the implied measurement and record the
  coordinates as reviewed-by-eye in the module comment.
- **Severity note**: aesthetic only — a badge over a focal point is ugly, never wrong.

## F4 — Look at the wizard's interest step at `lg` before the next auth-screen change

- **Where**: `src/components/child/CreateProfileWizard.tsx` → the `WORLDS.map` grid under
  `t.profileWizard.interestLabel`.
- **What**: `lg:grid-cols-2` was left untouched, so at desktop the step now renders three
  rows where it rendered two. Manual row 2.6 observed the `sm` band (3×2), not the tallest
  configuration. Nothing is clipped — the grid is in normal flow — and
  `e2e/onboarding.spec.ts` cannot see it because Playwright scrolls tiles into view.
- **Do**: when the `05` auth-v2 mockup is next readable, settle both `sm:grid-cols-3` and
  `lg:grid-cols-2` against it; the code comment already flags the first as an extrapolation.

## F5 — Lesson candidate: a deliberate break must remove the protection, not perturb the component

- **Where**: `context/changes/six-worlds-catalogue/plan.md` Progress row 5.4, corrected in
  `e2e/worlds.spec.ts`'s module header.
- **What**: the plan contracted `grid-cols-6` to prove an overflow assertion. Re-executed
  in review: it fails the **column-count** assertion with overflow still 0, because
  Tailwind's `grid-cols-6` is `repeat(6, minmax(0, 1fr))` and those tracks shrink.
  `grid-cols-[repeat(6,minmax(9rem,1fr))]` is the break that actually turns the overflow
  expectation red.
- **Do**: run `/10x-lesson` on it. This is the **second** plan-contracted assertion/break
  mismatch in this project (`world-progression-stages` hit the same shape with
  `document.documentElement.scrollWidth` against a `position: fixed` bar), which is what
  makes it a class rather than an incident.

## F6 — Cross-plan: count Phase-1 reds from landed code, not from the sibling's plan

- **Where**: `context/runs/2026-08-27-world-economy/ownership.md` § CPD-2; the landed
  `tests/decorations.test.ts` cases *"gives every world in WORLD_SLUGS a full decoration
  set"*, *"prices every world's set on the same rising curve"*, *"only ever names the
  CURRENT world's decorations"*.
- **What**: the contention sweep predicted exactly two reds and set the failure condition
  at three; the true count is four, because F1's landed test file quantifies over
  `WORLD_SLUGS` in three cases, not the one its plan contracted. The implementer proceeded
  correctly and recorded why. Independently reproduced in review.
- **Do**: nothing on this branch. For the next sweep: verify cross-plan claims against the
  sibling's **landed code** when the sibling has already landed — the same staleness class
  `ownership.md` §6 rule 2 warns about, applied to the sweep itself.
