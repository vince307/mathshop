# Follow-ups from the implementation review — `world-selection-screen` (F5)

Source: `context/changes/world-selection-screen/reviews/impl-review.md` (2026-08-23).
Triaged autonomously (run contract: no human in the loop). **None of these blocks the merge**
— the shipped behaviour is correct and verified; every item below hardens a test or an
observability/a11y edge. No CRITICAL finding was found, so nothing was fixed in `src/` by the
review step.

## Blocking? No.

`feat/world-selection-screen` is mergeable as it stands: 322/322 unit, lint clean, `check`
0/0, Playwright 15/15, isolation meta-checked in both directions, KR-7 unchanged, mockups
verified. Take these as a follow-up commit (or fold into the `/10x-e2e` step), not as a gate.

---

## FU-1 (F1) — bind the form target in `tests/worlds-picker.test.tsx`

- **File**: `tests/worlds-picker.test.tsx`
- **Symbols**: the `hiddenInput()` helper (`:35-39`) and a new assertion in the first test.
- **Required change**: locate the `<form>` (`container.querySelector("form")`), assert its
  `action` is `/api/profiles/world` and its `method` is `post`, and re-root `hiddenInput()` at
  that form element instead of `container`. Add one assertion that the submit control renders
  `t.worlds.confirm`.
- **Why**: today, changing the action, switching to `method="GET"`, or deleting the `<form>`
  wrapper leaves all seven tests green while the screen silently commits nothing.

## FU-2 (F2) — make `tests/shop-art-slots.test.ts` exercise the lookup

- **File**: `tests/shop-art-slots.test.ts` (add a case; keep the four data assertions)
- **Symbols**: `ShopArt` (`src/components/child/ShopArt.tsx:70`), `WORLD_SLOTS`, `DEFAULT_SLOTS`.
- **Required change**: add a `// @vitest-environment jsdom` render of
  `<ShopArt world={getWorld("piekarnia")} purchased={["sign"]} />` and assert the badge's inline
  style equals `WORLD_SLOTS.piekarnia.sign` and **not** `DEFAULT_SLOTS.sign`.
- **Why**: deleting the `WORLD_SLOTS[world.slug]?.` prefix at `ShopArt.tsx:72,73,80` keeps all
  four current tests green — the per-world override the whole phase exists for is untested.
- **Note**: F4 owns `ShopArt.tsx`. This adds a test only; it must not restructure the component.

## FU-3 (F3) — make `tests/nav-labels.test.ts` guard the nav, not just the dictionary

- **File**: `tests/nav-labels.test.ts`, `src/components/app/AppShell.astro:59-65`
- **Symbols**: `items`, `tabs`, `LIVE_E2E_STRINGS`.
- **Required change** (Fix A, recommended): lift/export the `items`/`tabs` arrays so the test
  derives its labels from the real nav rather than from `t.nav.items`, making a dropped or
  renamed entry fail. Alternative (Fix B): leave the unit test as an i18n guard and cover the
  one-copy-per-a11y-tree and `aria-current` rules in the `/10x-e2e` touch-viewport spec the
  plan already schedules.
- **Sequencing**: `AppShell.astro` is also edited by F4 — land this **after** F4 merges.
- **Why**: dropping the `worlds` entry, pointing its `href` at a nonexistent route, or swapping
  the `hidden`/`lg:hidden` toggle for `opacity` all keep the suite green today.

## FU-4 (F5) — log the DB-error branch in the world endpoint

- **File**: `src/pages/api/profiles/world.ts:61-63`
- **Symbol**: the `if (!("ok" in result))` branch.
- **Required change**: keep the byte-identical redirect (KR-1 / oracle avoidance is
  deliberate), but branch on `"error" in result` to emit a server-side log. `delete.ts:46-47`
  is the precedent for discriminating the two service outcomes.
- **Why**: a persistent DB failure is currently indistinguishable from a routine ownership
  bounce and leaves no trace in production.

## FU-5 (F6) — keep `learnHeading` in the a11y tree below `lg`

- **File**: `src/components/child/WorldPicker.tsx:89-90`
- **Symbol**: the `t.worlds.learnHeading` `<p>` and the competency `<ul>`.
- **Required change**: `sr-only lg:not-sr-only` on the heading, or an `aria-label` on the `<ul>`.
- **Why**: `hidden lg:block` removes it from the accessibility tree, not just the viewport, so
  below `lg` the competency list is unlabeled. (The mobile mockup is right to hide it visually
  — this is about the screen reader, not the pixels.)

## FU-6 (F8) — design note: attribution belongs in `shift_log`, not the jsonb blob

- **File**: `src/lib/services/child-profiles.ts:291`; future migration.
- **Required change**: none now. When per-world purchases (option B) are actually taken,
  prefer a `shift_log.world` column over `shop_state.purchasedMeta` — same attribution,
  append-only, outside `buyUpgrade`'s read-modify-write window. `purchasedMeta.at` already
  duplicates the `shift_log` row's `created_at`; only `world` is new. D-10 anticipated sharing
  F4's `shift_log` migration for exactly this.

## FU-7 (F9) — align `CreateProfileWizard`'s world tiles with the new a11y posture

- **File**: `src/components/child/CreateProfileWizard.tsx:255-256`; `e2e/onboarding.spec.ts:74`
- **Symbol**: the `SelectTile` call in the world step.
- **Required change**: pass `alt=""` (the visible label already carries the accessible name),
  then drop the `.first()` workaround in the e2e locator.
- **Why**: the wizard's `alt={w.name}` + `label={w.name}` produces the doubled accessible name
  "Kawiarnia Kawiarnia". `WorldPicker` fixed this for the new screen; the wizard is now the
  inconsistent one. Out of F5's scope — do not sneak it into this branch.
