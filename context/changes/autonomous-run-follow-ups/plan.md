# Closing the ten triaged follow-ups — Implementation Plan

## Overview

Ten already-triaged, already-verified follow-up items from the 2026-08-22 autonomous run's
five `follow-ups/review-fixes.md` files. Two are real user-facing accessibility/UX defects
(`growth.astro` renders a heading over an empty card; `StageRail`'s ordinal labels are never
announced), five are tests that do not bite the thing their file claims to protect, one is a
silent server-side failure branch, one is a missing e2e seeder, and one is a durable-doc
omission. Closing them pays off the last run's verification debt in one branch.

The upstream artifacts are complete and this plan does not re-derive them:
`change.md` establishes **what** (ten items, all ten claims re-verified true on disk, plus
corrections C1–C3), `research.md` establishes **how** (the in-repo precedent per item, the
assertion that bites, the deliberate break and why its redness is evidence). This plan makes
the six decisions `research.md` left open and turns them into seven commit-sized phases.

## Current State Analysis

Everything below was re-opened on disk during this planning step on `matmaverse-v2`
@ `282d264` — not inherited from `research.md` (agent-contract rule 5).

- **`src/pages/app/growth.astro`** — the next-upgrade `<section>` opens with
  `<h2>{t.start.nextUpgradeHeading}</h2>`, then `{next && (…)}`, then an **unconditional**
  `<a href="/app/upgrades">{t.growth.upgradesLink}</a>`. With `next === null` a heading sits
  over a button with nothing between them. The `<section>` immediately above it
  (`t.growth.unlocksHeading`) does the right thing: unconditional `<h2>`, then
  `{unlocks.length > 0 ? <ul/> : <p>{t.growth.noUnlocks}</p>}` under the comment *"Honest
  empty, not an invented promise"*. The decorative savings bar inside the next-upgrade card
  (`<div class="bg-muted mt-2 h-2 …">`) lacks the `aria-hidden="true"` both other copies carry.
- **`nextUpgrade`** (`src/data/upgrades.ts`) filters on
  `!isOwned(u.id, purchased) && u.requiredWorldLevel <= businessLevel`. The six upgrades carry
  `requiredWorldLevel` 1, 1, 2, 2, 3, 3. Owning `sign` (30 zł) + `shelf` (60 zł) at
  `business_level = 1` returns `null` — **90 zł of ordinary early play**, not a terminal
  edge case, and it recurs at every level boundary.
- **`src/components/child/StageRail.astro`** — three `<span>`s (`done` / `current` / `locked`)
  each carry `aria-label={t.growth.stageOrdinal.replace("{n}", …)}` and **no `role`**.
  `aria-label` on `role=generic` is not exposed, so the file's own comment is false.
  `src/components/child/ShiftResults.tsx` is the in-repo shape: `role="img"` + `aria-label`
  on a container of decorative glyphs.
- **`tests/worlds-picker.test.tsx`** — `hiddenInput(container, name)` roots at `container`;
  the file never names `form`, `action`, `method` or the submit control. Deleting
  `WorldPicker`'s `<form method="POST" action="/api/profiles/world">` wrapper leaves all
  seven tests green while the feature is inert.
- **`src/components/child/WorldPicker.tsx`** — `<p className="… hidden … lg:block">{t.worlds.learnHeading}</p>`
  is `display:none` below `lg`; the `<ul>` beneath has no accessible name.
- **`tests/shop-art-slots.test.ts`** — four data-only `it()` blocks over `WORLD_SLOTS`, no
  render, no jsdom pragma. `ShopArt`'s `placed`/`unplaced` partition uses
  `WORLD_SLOTS[world.slug]?.[u.id] ?? DEFAULT_SLOTS[u.id]`, and `DEFAULT_SLOTS` covers all six
  ids — so `unplaced` is **always empty** and dropping the `WORLD_SLOTS[world.slug]?.` prefix
  moves nothing except the badge's inline `style`.
- **`tests/nav-labels.test.ts`** — `const labels = Object.values(t.nav.items)`; never imports
  `AppShell`. **But `e2e/growth.spec.ts` Risk E2E-F4-2 already loops the same values and
  asserts `toHaveCount(1)` + `toBeVisible()` per label in both Playwright projects** — so
  dropping an entry from `AppShell`'s `items` already goes red twice. Two comments in that
  spec still say *"Five entries"* while `t.nav.items` has **six** keys.
- **`src/pages/api/profiles/world.ts`** — `if (!("ok" in result))` collapses a DB failure and
  a routine ownership bounce into one silent redirect. `updateChildProfileTheme` returns
  `{ error } | { failure: "not-found" } | { ok: true }`, so `"error" in result` discriminates
  exactly. `src/` contains exactly two logging calls, both `[route] message` + structured
  object (`src/pages/api/auth/reset.ts`, `src/pages/api/auth/signup.ts`).
- **`tests/weekly-report-tiles.test.tsx`** — `child()` hard-codes `daily: EMPTY_WEEK`, so
  `WeeklyReport` has never been rendered with a non-zero chart; every fixture takes
  `WeeklyActivityChart`'s `maxCount === 0` early return. `tests/reports.test.ts` asserts the
  Σ invariant at the aggregator only.
- **`e2e/helpers/accounts.ts`** — exports `provisionAccount`, `seedChildProfile`,
  `signInViaUI` (plus re-exports). Nothing touches `shift_log`.
  `e2e/parent-weekly-report.spec.ts`'s header records the gap explicitly.
- **`docs/reference/contract-surfaces.md` → `## Parent PIN routes (RLS surface)`** — documents
  gate order, the change gate and `STATUS_FOR`; carries no limitation bullet.
  `register_pin_failure` only ever increments `failed_attempts`; the only resets are a correct
  PIN and `setPin` (both in `src/lib/services/parent-pin.ts`). `LOCKOUT_MS` is 60 000, so the
  *lock* expires after a minute but the *counter* does not — one wrong PIN re-locks instantly.
- **`src/components/parent/WeeklyActivityChart.tsx`** — `import React from "react";` is still
  dead (`tsconfig.json` sets `"jsx": "react-jsx"`).

### Correction C4 (new, established by this plan)

`change.md`'s source table lists five archived changes, but the ten items draw from **four**:
`world-progression-stages` (#1, #2 → items 1, 2), `world-selection-screen` (FU-1…FU-5 →
items 5, 6, 7, 8, 9), `parent-weekly-activity-chart` (#1, #2 → items 3, 4) and
`parent-security-screen` (FU-1 → item 10). `dashboard-recent-activity`'s non-blocking section
holds only doc/process notes and contributes **none** of the ten. This matters because AD-1
scopes commits by source feature — there is no `dashboard-recent-activity` commit to write.

## Desired End State

- `/app/growth` never renders "Następne ulepszenie" over an empty card. A child who owns
  every level-eligible upgrade reads an honest sentence and still sees the shop CTA.
- `StageRail`'s three state markers announce "Etap 1".."Etap 4", proven by a browser-level
  `getByRole("img", …)` assertion in both Playwright projects.
- `tests/worlds-picker.test.tsx` goes red if the `<form>` wrapper, its `action`, its `method`
  or its submit control is removed. `tests/shop-art-slots` goes red if the per-world slot
  lookup is dropped. `tests/weekly-report-tiles` goes red if `statTasks` stops decomposing
  into the chart's bars.
- `e2e/helpers/accounts.ts` exports `seedShiftWeek`, and `e2e/parent-weekly-report.spec.ts`
  uses it to prove a non-zero week renders.
- A DB failure in `POST /api/profiles/world` leaves a server-side trace, with the redirect
  byte-identical (KR-1 preserved).
- `tests/nav-labels.test.ts` and `e2e/growth.spec.ts` each state which half of the nav
  contract they own, the spec's stale "Five entries" prose is corrected, and every nav
  entry's `href` is asserted, not just `growth`'s.
- `docs/reference/contract-surfaces.md` records K1.

**How to verify:** `npm run lint`, `npm test`, `npm run check` and the full Playwright run all
green on `feat/autonomous-run-follow-ups`, with every deliberate break in each phase observed
red and restored.

### Key Discoveries

- **FU-3's premise is false at the suite level.** `e2e/growth.spec.ts` Risk E2E-F4-2 is
  already "Fix B". The expensive Fix A (extracting `items`/`tabs` into `src/data/nav.ts`) buys
  a duplicate of coverage that already exists in the only layer that can observe the risk.
- **Item 1's empty state is reachable from `seedChildProfile` alone** —
  `{ businessLevel: 1, shopState: { purchased: ["sign", "shelf"] } }` drives `nextUpgrade` to
  `null`. The bug therefore has a real browser-level guard available, not just review.
- **`unplaced` is always empty** in `ShopArt`, so any item-6 assertion on the partition or on
  "a badge rendered" certifies nothing (L-004). It must read `style.left` / `style.top`.
  `WORLD_SLOTS.piekarnia.sign` = `{ left: "7%", top: "10%" }` vs `DEFAULT_SLOTS.sign` =
  `{ left: "10%", top: "6%" }` — they differ on **both** axes.
- **The report week is Europe/Warsaw.** `weekDayKeys` / `startOfWeek`
  (`src/lib/services/reports.ts`) resolve Monday 00:00 Warsaw and `zoneOffsetMinutes` is
  declared the project's only offset parser. A seeder doing UTC day arithmetic drifts a bar
  across midnight and across a DST weekend.
- **`earned` is load-bearing for the seeder.** Omitting it on a shift row flips
  `earningsKnown` to `false` and silently suppresses the earnings tile.
- **Cleanup is free** — `shift_log.account_id` is `on delete cascade` from `auth.users`, so
  every spec's existing `try/finally` + `deleteUser` already removes seeded rows.

## What We're NOT Doing

- **Not extracting `src/data/nav.ts`.** C1's blocker is real (`.astro` frontmatter has no
  value exports) but moot — see D6.
- **Not deduplicating `world.name` in `growth.astro`'s accessibility tree** (adjacent item 3
  in `change.md` AD-3). It is not a one-line fix, it requires a product call about which of
  the three copies is the canonical name, and it moves text `e2e/growth.spec.ts` locates.
  It stays in the archive, recorded.
- **Not adding a `logger` module.** The repo has two logging calls and one shape; item 8
  follows it.
- **Not touching `src/lib/services/parent-pin.ts` or its migrations.** Item 10 is a
  documentation change; the K1 behaviour is intentional and unchanged.
- **Not changing `POST /api/profiles/world`'s redirect targets or status codes.** Additive
  logging only — the route must stay a non-oracle (KR-1).
- **No Supabase migration.** Nothing in the ten needs schema. If one turns out to, that item
  leaves this change (`change.md` AD-1's stated reversal).
- **Not adopting the remaining ~18 non-blocking items** in the five archived files.

## Implementation Approach

A no-commit Phase 0 (branch + baseline), then seven phases, each self-contained and each
landing as exactly one commit on green. Phase
boundaries follow **source feature + file cohesion**, so `git log --grep` recovers which
review raised which item (the value `change.md` AD-1 was protecting). Ordering puts the two
user-visible defects first, the cheap test-hardening in the middle, the timezone-sensitive
e2e seeder second-to-last, and the pure documentation edit last — so an interruption at any
point leaves the branch with the highest-value work already committed.

Every phase that changes behaviour ships its guard **in the same phase**, and every phase
names a deliberate break plus why that break's redness is evidence for that phase's specific
claim (L-004).

## Critical Implementation Details

- **`e2e/helpers/accounts.ts` is NOT contended — F1 is its sole owner this run.**
  *(Corrected in place by the contention sweep, 2026-08-24.)* This plan asserted contention
  with F2 `remember-me-on-login`. F2's plan states **"No changes to `e2e/helpers/accounts.ts`"**
  under *What We're NOT Doing*, and its AD-9 repeats that it touches the file "not at all";
  F2's `research.md` only ever **reads** `signInViaUI` (it re-verifies the helper still works
  after the sign-in form changes) — a read dependency, which this plan misread as a write
  collision. `ownership.md` assigns the file to F1 with no co-writer. Keep the append-only
  discipline anyway (`seedShiftWeek` appended after `signInViaUI` at end of file, no existing
  export edited): it costs nothing, and it is what keeps F2's read dependency intact — every
  authenticated F2 regression funnels through `signInViaUI`'s `getByLabel` field locators and
  its `getByRole("button", { name: t.auth.signin.submit })` submit locator.
- **`src/i18n/pl.ts` is append-only, one entry per key.** Phase 1 adds exactly one key. The
  L-007 substring check in both directions was already run for the chosen string against all
  314 multi-word dictionary phrases: **zero collisions**.
- **`docs/reference/contract-surfaces.md` is append-per-section and on a conflict in a
  *Consumed by* / *Tests* line, both sides are kept — never `--ours` / `--theirs`.** Nothing
  in `tests/`, `e2e/`, `src/` or CI reads it, so a bad resolution fails silently and forever.
- **The command sandbox blocks `127.0.0.1:54321`.** Run `npm test` and Playwright with the
  sandbox disabled and `npx supabase status` confirming the API is up, or ~30 tests fail for
  reasons unrelated to this change.
- **`assets/` is gitignored.** The `/app/growth` mockup was opened on the maintainer's machine
  during intake and shows the header outside the inner panel — consistent with D1 — but it
  **depicts no empty state**, so Phase 1's `next === null` layout is an explicit extrapolation
  and unverifiable on a fresh clone or in CI.

---

## Phase 0: Branch baseline

No commit. This phase exists so every `baseline + N` below is anchored to a number measured
on **this** branch rather than copied from the run log (L-005).

### Changes Required:

None — no file is touched.

**Contract**: cut `feat/autonomous-run-follow-ups` from `matmaverse-v2` through
`.claude/skills/10x-autonomous-run/scripts/worktree-bootstrap.sh` (never `git checkout` in
the main tree; the script also assigns `E2E_PORT`). Then, with the sandbox disabled and
`npx supabase status` reporting the API up on `127.0.0.1:54321`, record four numbers in the
handoff: `npm test` (tests / files), `npx playwright test --list` (tests / files, and the
per-project split — `desktop` matches every spec, `touch` only
`/(gameplay-restore|growth)\.spec\.ts/`), `npm run lint`, `npm run check`.

**Not stacked — cut from `matmaverse-v2`.** *(Resolved in place by the contention sweep,
2026-08-24.)* `context/runs/2026-08-24-followups-and-remember-me/ownership.md` now exists and
puts F1 and F2 `remember-me-on-login` in **separate, concurrent stacks**, both cut from
`matmaverse-v2`. They share no symbol and no file region: their two `src/i18n/pl.ts` appends
sit ~325 lines apart (`auth.signin` ≈ line 17 vs `growth` ≈ line 345) and their two
`docs/reference/contract-surfaces.md` appends land in different sections. So the baseline is
`matmaverse-v2`'s — but still **measure it on this branch**, never inherit it (L-005). Do not
go looking for a `feat/remember-me-on-login` predecessor to branch from; there is none.

### Success Criteria:

#### Automated Verification:

- The four baseline figures are written down before any Phase 1 edit, and no absolute count
  from `run-log.md` or `handoff.md` is carried forward into a criterion.

---

## Phase 1: `/app/growth` — honest empty state and announced stage ordinals

Source: `world-progression-stages` review-fixes #1, #2 and #6. Items 1, 2 + one adjacent.
Commit subject scope: `fix(world-progression-stages)`.

### Overview

Stop rendering a heading over an empty card, make the three stage markers actually announce
their ordinal, and give the decorative savings bar the `aria-hidden` its two siblings carry.

### Changes Required:

#### 1. New dictionary entry

**File**: `src/i18n/pl.ts`

**Intent**: One honest empty-state sentence for the next-upgrade card, a sibling of the
existing `growth.noUnlocks`.

**Contract**: Append `noNextUpgrade` inside the `growth:` section, immediately after
`noUnlocks`. Value: `"Masz już wszystkie ulepszenia dostępne na tym etapie."` — accurate,
because `nextUpgrade` returns `null` precisely when every *level-eligible* upgrade is owned,
not when every upgrade is. Append-only, one key; do not restructure the section.

#### 2. The next-upgrade section

**File**: `src/pages/app/growth.astro`

**Intent**: Follow the same file's own `t.growth.unlocksHeading` precedent — keep the `<h2>`,
replace the `{next && (…)}` guard with a ternary whose else-branch is an honest sentence, and
leave the unconditional `<a href="/app/upgrades">{t.growth.upgradesLink}</a>` exactly where it
is. Separately, add `aria-hidden="true"` to the decorative savings-bar wrapper.

**Contract**: The `<section>` whose first child is `<h2>{t.start.nextUpgradeHeading}</h2>`
becomes `<h2>` → `{next ? (…existing card…) : <p …>{t.growth.noNextUpgrade}</p>}` → the
unchanged `<a>`. Style the `<p>` exactly as the `noUnlocks` one
(`text-muted-foreground mt-4 text-sm font-semibold`). The `<div class="bg-muted mt-2 h-2 …">`
inside the `{savingPercent !== null && (` guard gains `aria-hidden="true"`. No change to
`savingPercent`, to `AppShell`'s `progressPercent` / `progressLabel`, or to the CTA's href or
classes.

#### 3. Stage-marker roles

**File**: `src/components/child/StageRail.astro`

**Intent**: Make the existing `aria-label` reachable. `aria-label` on `role=generic` is not
exposed by browsers, which is why the file's own comment is currently false.

**Contract**: Add `role="img"` to each of the three `<span>`s that already carry
`aria-label={t.growth.stageOrdinal.replace("{n}", String(stage.order))}` (the `done`,
`current` and `locked` branches). Precedent: `src/components/child/ShiftResults.tsx`'s
`<div role="img" aria-label={t.results.starsLabel…}>`. No text changes, no new dictionary key,
no class changes. Under `role="img"` the `current` branch's bare `{stage.order}` digit becomes
presentational — that is the intended outcome ("Etap 2", not "2"). Update the file's comment
above the markers so it describes what the code now does.

#### 4. Browser guards for both fixes

**File**: `e2e/growth.spec.ts`

**Intent**: Both fixes are in `.astro`, which cannot be rendered in jsdom, so their only
possible unit-level guard is `npm run check` — which certifies nothing about the a11y tree
(L-004). Both get a real assertion at the layer that can observe them.

**Contract**: (a) Fold a
`getByRole("img", { name: t.growth.stageOrdinal.replace("{n}", "1"), exact: true })`
expectation (`toHaveCount(1)`) into the **existing** test *"the nav entry reaches the growth screen and the rail
shows every stage (Risk E2E-F4-1)"* — no new test, a stronger existing one.
(b) Add **one** new test for the empty state: `provisionAccount` →
`seedChildProfile(account.id, { businessLevel: 1, shopState: { purchased: ["sign", "shelf"] } })`
→ `signInViaUI` → `goto("/app/growth")` → assert `t.growth.noNextUpgrade` is visible **and**
the `t.growth.upgradesLink` anchor is still visible. Teardown mirrors the file's existing
`try/finally` + `deleteUser`. That seed drives `nextUpgrade` to `null` because both
`requiredWorldLevel: 1` upgrades are owned.

### Success Criteria:

#### Automated Verification:

- `npm run lint` clean
- `npm run check` — 0 errors, 0 warnings (hint count may move; errors and warnings may not)
- `npm test` — branch baseline + 0 (no unit test changes in this phase; the baseline is
  measured on `feat/autonomous-run-follow-ups` before Phase 1, per L-005)
- `E2E_PORT=<yours> npx playwright test e2e/growth.spec.ts` — branch e2e baseline **+ 1 test
  per project** (one new test × `desktop` + `touch`)
- Deliberate break A: remove `role="img"` from the three `StageRail` spans → the folded
  `getByRole("img", …)` expectation fails in both projects → restore. *Why this is evidence:*
  the assertion resolves through the accessibility tree, which is exactly the surface the
  missing role removed; a `getByText` assertion would have stayed green, which is why the
  guard is role-based.
- Deliberate break B: revert the ternary to `{next && (…)}` → the new empty-state test fails
  on the missing `t.growth.noNextUpgrade` while the CTA assertion still passes → restore.
  *Why this is evidence:* it isolates the empty state from the CTA, so the test proves the
  sentence appeared, not merely that the section rendered.

#### Manual Verification:

- With a profile owning `sign` + `shelf` at level 1, `/app/growth`'s next-upgrade card reads
  as a finished thought, not a truncated one, and the shop CTA is still reachable.
- VoiceOver/NVDA on the stage rail announces "Etap 1".."Etap 4" rather than bare digits.

---

## Phase 2: `WorldPicker` — bind the form target and name the competency list

Source: `world-selection-screen` FU-1 and FU-5. Items 5 and 9. Same component, same test file,
one commit. Commit subject scope: `fix(world-selection-screen)`.

### Overview

The test file's own header says "the hidden `theme` input IS the commit", but nothing asserts
the `<form>` that carries it; and the competency list loses its only label below `lg`.

### Changes Required:

#### 1. Name the competency list

**File**: `src/components/child/WorldPicker.tsx`

**Intent**: The `<p>{t.worlds.learnHeading}</p>` above the list is `hidden … lg:block`, so at
the `touch` viewport a screen reader gets three list items with no idea what they are.

**Contract**: Add `aria-label={t.worlds.learnHeading}` to the `<ul>` that follows that `<p>`.
Precedent: `WeeklyActivityChart`'s `<ul className="sr-only" aria-label={copy.chartHeading}>`
("The list names itself, because the heading above it is a `div`"). No new dictionary key.
Not `aria-labelledby` — it would work, but it needs a new `id` and couples the name to the
`<p>`'s position, which a future edit can silently break.

#### 2. Assert the form and the list name

**File**: `tests/worlds-picker.test.tsx`

**Intent**: Make the suite go red when the `<form>` wrapper — the thing that makes the picker
commit at all — is removed, and when the list loses its name.

**Contract**: Re-root `hiddenInput(container, name)` at `container.querySelector("form")`,
throwing a clear error if absent. Add assertions that the form's `action` is
`/api/profiles/world`, its `method` is `post` case-insensitively (jsdom normalises), and that
`screen.getByRole("button", { name: t.worlds.confirm })` is contained within it. Add
`screen.getByRole("list", { name: t.worlds.learnHeading })`. Keep all seven existing `it()`
blocks and add these as **two new `it()` blocks** — one for the form binding, one for the
list name — which is what the `+ 2` in the criteria below counts; folding them into an
existing block would make the delta unmeasurable. Note the existing test that counts `getAllByRole("button")` filtered on
`aria-pressed`: the submit button has none, so that count is unaffected.

### Success Criteria:

#### Automated Verification:

- `npm run lint` clean; `npm run check` 0 errors / 0 warnings
- `npm test` — branch baseline + 2 (one form-binding test, one list-name test); exact delta
  measured, never a total copied from another branch (L-005)
- Deliberate break A: delete the `<form>` element from `WorldPicker` while keeping its
  children → the re-rooted helper throws and the `action` assertion fails → restore.
  *Why this is evidence:* the inputs survive that edit, which is precisely why the old suite
  stayed green; failing on the form itself is the regression the file claims to protect.
- Deliberate break B: remove `aria-label` from the `<ul>` → `getByRole("list", { name })`
  finds nothing → restore. *Why this is evidence:* `getByText(t.worlds.learnHeading)` still
  resolves to the `<p>`, so only a role+name query can see the loss — which is the same thing
  a screen reader below `lg` sees.

#### Manual Verification:

- At 712 px, a screen reader announces the competency list with its heading text.

---

## Phase 3: `ShopArt` — make the slot test exercise the per-world lookup

Source: `world-selection-screen` FU-2. Item 6. Commit subject scope: `fix(world-selection-screen)`.

### Overview

The suite is data-only, so deleting `ShopArt`'s `WORLD_SLOTS[world.slug]?.` prefix leaves it
green. The trap: `DEFAULT_SLOTS` covers all six upgrade ids, so `unplaced` is always empty and
the partition does not move — only the badge's inline `style` does.

### Changes Required:

#### 1. Add a render case beside the data assertions

**File**: `tests/shop-art-slots.test.ts` → renamed to `tests/shop-art-slots.test.tsx`

**Intent**: Prove the per-world override actually reaches the DOM, keeping one contract in one
file.

**Contract**: Rename the file to `.tsx` and add `// @vitest-environment jsdom` as the first
line (vitest's global `environment` is `"node"`, per `vitest.config.ts`). Keep the four
existing data `it()` blocks unchanged — they are environment-agnostic. Add one render case:
mount `ShopArt` for the `piekarnia` world with `sign` owned, locate the placed badge, and
assert its inline `style.left === "7%"` **and** `style.top === "10%"`. `DEFAULT_SLOTS.sign` is
`{ left: "10%", top: "6%" }`, so the two differ on both axes and the assertion cannot pass by
coincidence. The badge is a `<span>` with an inline `style` and no role; locating it via
`container.querySelectorAll("span[style]")` is acceptable here — `e2e/CLAUDE.md`'s
no-CSS-selectors rule governs `e2e/` only, and `tests/worlds-picker.test.tsx` already uses
`querySelector`. The base image is reachable as `screen.getByAltText(world.name)`.
Do **not** assert on `unplaced` or on "a badge is rendered": both are invariant under the
break and would certify nothing.

### Success Criteria:

#### Automated Verification:

- `npm run lint` clean; `npm run check` 0 errors / 0 warnings
- `npm test` — branch baseline + 1
- Deliberate break: delete the `WORLD_SLOTS[world.slug]?.` prefix from `ShopArt`'s badge
  `style={…}` expression → the new render case fails on `left` (and on `top`) → restore.
  *Why this is evidence:* the same break leaves the partition, the badge count and all four
  data assertions untouched, so redness here can only come from the style the lookup produces
  — the one observable the lookup controls.

#### Manual Verification:

- None. Pure test coverage; the rendered UI is unchanged.

---

## Phase 4: Nav — document the two-layer split and assert every entry's href

Source: `world-selection-screen` FU-3. Item 7. Commit subject scope: `fix(world-selection-screen)`.

### Overview

FU-3's premise ("dropping an entry from `AppShell`'s `items` keeps the suite green") is true
of `tests/nav-labels.test.ts` alone and **false of the suite as a whole**: `e2e/growth.spec.ts`
Risk E2E-F4-2 already catches it in both projects. The residual work is that each file knows
half a contract and neither says so — plus one genuine coverage hole.

### Changes Required:

#### 1. Name the unit suite's actual contract

**File**: `tests/nav-labels.test.ts`

**Intent**: Say plainly that this suite guards the **dictionary** (L-007 hygiene: uniqueness,
mutual substring collision, collision with `LIVE_E2E_STRINGS`), not the nav **wiring**, and
point at the file that guards the other half.

**Contract**: Header-comment edit only, naming `e2e/growth.spec.ts` Risk E2E-F4-2 as the
wiring guard. No assertion changes, no import of `AppShell` (impossible — `items`/`tabs` are
`.astro` frontmatter consts with no value export).

#### 2. Reciprocal pointer, corrected prose, and per-entry href assertions

**File**: `e2e/growth.spec.ts`

**Intent**: Record the reciprocal half of the contract, correct two stale comments, and close
the one hole neither layer covers — only `t.nav.items.growth`'s `href` is proven today; the
other five entries are asserted to exist, not to point anywhere.

**Contract**: There are **three** stale mentions, not two — the file's provenance header also
says *"the touch run is also the fifth tab's fit check: five entries must sit in one row"*,
alongside Risk E2E-F4-2's *"Five entries…"* and *"The five entries fit…"*. Correct all three
to **six** (`t.nav.items` has `dashboard`, `missions`, `shop`, `growth`, `worlds`, `parent`;
`AppShell`'s `items` array holds five and the sidebar renders the sixth, `parent`, as its own
pinned link, while `tabs` spreads all six — say that, since it is the reason the count reads
as five in the component and six in the tree). Add the pointer to `tests/nav-labels.test.ts`.
Add a spec-local
`label → href` map — `dashboard: /app/start`, `missions: /app/task`, `shop: /app/upgrades`,
`growth: /app/growth`, `worlds: /app/worlds`, `parent: /app/report` — and extend the existing
loop with `await expect(entry).toHaveAttribute("href", expected)`. The map is hardcoded in the
spec **on purpose**: the spec states the expected wiring independently of the component, which
is the whole point of the guard, and importing from `.astro` is impossible anyway. No new
`test()` block — the assertion joins the existing loop, so the Playwright test count does not
move.

### Success Criteria:

#### Automated Verification:

- `npm run lint` clean; `npm test` — branch baseline + 0 (no unit assertions added)
- `E2E_PORT=<yours> npx playwright test e2e/growth.spec.ts` — test count unchanged from
  Phase 1's post-state; all green
- Deliberate break: change one entry's `href` in `AppShell.astro`'s `items` (e.g. `worlds` →
  `/app/start`) → Risk E2E-F4-2 fails on the `href` assertion in both projects → restore.
  *Why this is evidence:* before this phase that same break was **completely invisible** —
  the label still resolved to exactly one visible link. Redness here proves the loop now
  checks destination, not just presence.
- Meta-check to record: removing an entry from `items` entirely was **already** red before
  this phase (count 0). That is why no extraction into `src/data/nav.ts` is being bought.

#### Manual Verification:

- None. Comments and test assertions only.

---

## Phase 5: `POST /api/profiles/world` — log the DB-error branch

Source: `world-selection-screen` FU-4. Item 8. Commit subject scope: `fix(world-selection-screen)`.

### Overview

A database failure and a routine ownership bounce currently produce the same silent redirect,
so a real outage leaves no trace anywhere.

### Changes Required:

#### 1. Discriminate and log

**File**: `src/pages/api/profiles/world.ts`

**Intent**: Separate the DB failure from the ownership bounce and leave a server-side trace,
without changing anything a client can observe.

**Contract**: Replace `if (!("ok" in result))` with an `"error" in result` branch that logs
before redirecting, plus the existing catch-all bounce. `updateChildProfileTheme`
(`src/lib/services/child-profiles.ts`) returns
`{ error } | { failure: "not-found" } | { ok: true }`, so `"error" in result` is exact.
Log shape follows the repo's only convention, verified by exhaustive grep of `src/`:
`console.error("[profiles/world] <what failed>", { … })` — the same shape as
`console.error("[auth/reset] resetPasswordForEmail failed", { … })`. **Do not** invent a
logger module (C3 in `change.md` retracts the `account/delete.ts` precedent — that file logs
nothing). **Do not** log `profileId` or the theme unfiltered: `profileId` identifies a child
row, and the two existing call sites log operation-scoped context, not user identifiers.
Every failure path keeps returning `applyNoStore(context.redirect(WORLDS))` byte-identically —
the route must not become an existence oracle (KR-1).

### Success Criteria:

#### Automated Verification:

- `npm run lint` clean; `npm run check` 0 errors / 0 warnings
- `npm test` — branch baseline + 0. **This item ships without a new test, deliberately.**
  `tests/profiles-world.test.ts` drives the real route against real Supabase; the DB-error
  branch is not reachable there without mocking `@/lib/supabase`, which would fork the file's
  testing style and weaken the real-route guarantee it exists to provide (D3). The existing
  suite's continued green **is** the guard that matters here — it proves KR-1 held.
- Deliberate break: **invert the new discriminant** — write `if (!("error" in result))` so a
  successful update falls into the bounce → `tests/profiles-world.test.ts`'s *"changes the
  caller's own profile theme and redirects to /app/start"* fails on both `Location` and the
  `readTheme(profileA)` read-back → restore. *Why this is evidence:* this refactor's only
  possible regression is **misclassifying the result** — getting the negation of the new
  `"error" in result` test backwards — and that test is the only assertion in the file that
  distinguishes the ok path from the bounce. It does not prove the log line fires; nothing
  automated does, which is why the manual step below exists and why no test delta is claimed.
- **Rejected break, recorded so nobody re-derives it (L-004).** "Change the `"error" in
  result` branch's redirect target to something other than `WORLDS`" **stays green** and
  therefore proves nothing. That branch is unreachable in this suite — which is D3's own
  premise: `updateChildProfileTheme` is driven against real Supabase and never returns
  `{ error }` there, and the ownership bounce the suite *does* exercise comes from
  `resolveActiveProfile` returning `null` **before** the call. A break inside an unreachable
  branch is the textbook decorative break.

#### Manual Verification:

- Temporarily force `updateChildProfileTheme` to return `{ error }`, submit the world form,
  and confirm `[profiles/world] …` appears in the server log while the browser still lands on
  `/app/worlds` with no error param and no changed status.

---

## Phase 6: Weekly report — decomposition at render level, and a `shift_log` seeder

Source: `parent-weekly-activity-chart` review-fixes #1, #2 and #8. Items 3, 4 + one adjacent.
Commit subject scope: `fix(parent-weekly-activity-chart)`.

### Overview

`WeeklyReport` has never been rendered with a non-zero chart, so the invariant that binds the
`statTasks` tile to the bars beneath it is asserted only at the aggregator. And `e2e/helpers/`
still has no `shift_log` seeder, which is why `e2e/parent-weekly-report.spec.ts` has no
seeded-week variant — a gap its own header records.

### Changes Required:

#### 1. Make `daily` a parameter of the fixture helper

**File**: `tests/weekly-report-tiles.test.tsx`

**Intent**: `child()` hard-codes `daily: EMPTY_WEEK`, so every fixture takes
`WeeklyActivityChart`'s `maxCount === 0` early return and the composition has never been
exercised.

**Contract**: Add an optional `daily` parameter to `child()` defaulting to `EMPTY_WEEK` — an
additive signature change; all existing call sites keep their current behaviour. Add one test
whose `practiceDelta` and `daily` agree, asserting (a) the number printed in the `statTasks`
tile and (b) that the sr-only `<ul aria-label={copy.chartHeading}>` items sum to the same
number. `reports.ts` states the invariant: *"Σ daily[].completed === Σ practice[*].completed …
so a parent adding the seven bars gets the number printed above them"*.

#### 2. Drop the dead React import

**File**: `src/components/parent/WeeklyActivityChart.tsx`

**Intent**: `tsconfig.json` sets `"jsx": "react-jsx"`, so `import React from "react";` on line
1 has been dead since the file was written.

**Contract**: Delete the import. No other change.

#### 3. A `shift_log` seeder

**File**: `e2e/helpers/accounts.ts`

**Intent**: Give e2e a way to place real rows on real chart days, so a non-zero weekly report
can be asserted in a browser.

**Contract**: **Append** `seedShiftWeek` after `signInViaUI` at end of file — touch no
existing export (F2 contention, D7). Signature takes the account id, the profile id and a
per-weekday completion count; it inserts through the existing service-role `admin` client,
mirroring `appendShiftLog` (`src/lib/services/child-profiles.ts`) column for column:
`account_id`, `profile_id`, `skills` (the `{ math|money|decisions: { firstTryCorrect,
completed, misses } }` jsonb shape), `upgrade_purchased: null`, and **`earned` explicitly set
— never omitted**, because `null` on a shift row flips `earningsKnown` to `false` and silently
suppresses the earnings tile.

**`created_at` must be set explicitly, and derived from `weekDayKeys(new Date())`**
(`src/lib/services/reports.ts`) — never from "today minus N days" in UTC, which drifts a bar
across a day boundary near midnight and across a DST weekend. `appendShiftLog` itself does
**not** set the column (it takes the DB default), so this is the one place the seeder departs
from mirroring it.

**The exact recipe, because `weekDayKeys` alone cannot produce a timestamp.** It returns
seven Europe/Warsaw civil-date **strings** (`"YYYY-MM-DD"`, Monday first), not instants, and
`zoneOffsetMinutes` — the doc-comment's "project's only offset parser" — is a module-**private**
`function` in `reports.ts` with no `export`, so it is not reachable from `e2e/` and must not be
copied. Convert instead:

```ts
const keys = weekDayKeys(new Date());       // Mon…Sun, Europe/Warsaw civil dates
const createdAt = `${keys[weekday]}T12:00:00Z`;
```

Noon UTC is 13:00 (CET) or 14:00 (CEST) in Warsaw, so it always lands on the intended civil
day under both offsets — `warsawDayKey(new Date(createdAt))` returns the key it was built
from — and it is comfortably after `startOfWeek`'s Monday boundary (22:00Z/23:00Z the
previous Sunday), which the report query filters on with `.gte("created_at", …)`. No offset
arithmetic, no second parser.

**Import path:** `e2e/` has no `@/` alias — `e2e/helpers/i18n.ts` reaches the app with
`../../src/i18n`. Import `weekDayKeys` the same way: `../../src/lib/services/reports`.

A chained `.select("id")` read-back is fine here — this seeder provisions through an
RLS-bypassing client exactly as `seedChildProfile` does; L-002's prohibition is about
asserting a *blocked* write, which this never does. No new teardown:
`shift_log.account_id` is `on delete cascade` from `auth.users`, so every spec's existing
`deleteUser` already removes the rows.

#### 4. First consumer

**File**: `e2e/parent-weekly-report.spec.ts`

**Intent**: A seeder with no caller is dead code. This spec's header explicitly records the
gap it fills.

**Contract**: Add one test that seeds a known non-zero week and asserts the chart renders bars
(not `copy.chartEmpty`) and that the `statTasks` tile shows the seeded total. Update the
header paragraph that currently says a seeded-week variant is "deliberately NOT here".

**The setup is not just `provisionAccount` — `/app/report` is behind the parent-PIN gate.**
Mirror the file's existing *"empty-week report hydrates"* test **exactly**:
`provisionAccount` → `seedChildProfile` → `seedShiftWeek` → `signInViaUI` →
`setPinAndLandOnReport(page, "2468")` (`./helpers/parent-pin`) → `waitForIslands(page)`
(`./helpers/hydration`) → assertions → `finally { deleteUser(account.id) }`. A test written
without `setPinAndLandOnReport` never reaches the report at all; without `waitForIslands` it
races the `client:load` island. Seed the shift rows **before** `signInViaUI` so the server
render already has them.

Per `e2e/CLAUDE.md`, **name the test after the risk it protects** and add that risk to the
file's provenance header, in the shape the two existing tests use (`… (Risk E2E-3)`).

### Success Criteria:

#### Automated Verification:

- `npm run lint` clean; `npm run check` 0 errors / 0 warnings
- `npm test` — branch baseline + 1
- `E2E_PORT=<yours> npx playwright test` — branch e2e baseline **+ 1 run total, `desktop`
  only**. `playwright.config.ts`'s `touch` project carries
  `testMatch: /(gameplay-restore|growth)\.spec\.ts/`, so `e2e/parent-weekly-report.spec.ts`
  is a desktop-only file — this is **+1**, not +1-per-project like Phase 1's `growth.spec.ts`
  addition. Full suite green (this phase is the one most likely to disturb neighbours, so the
  **whole** Playwright suite runs here, not just the touched spec)
- Deliberate break: in `WeeklyReport`'s `ChildSection`, change `tasksThisWeek`'s source from
  `practice` to `upgrades.length` → the new render test's tile-vs-bars sum diverges → red →
  restore. *Why this is evidence:* it is a plausible mistake (the tile row invites grabbing a
  nearby number) and it removes exactly the protection claimed. Merely deleting
  `<WeeklyActivityChart>` would also go red but would prove only that the chart renders, not
  that it decomposes the tile.
- Deliberate break (seeder): run the new e2e test with `created_at` computed by UTC day
  arithmetic instead of `weekDayKeys` and confirm it is capable of placing a bar on the wrong
  day; restore. If it cannot be made to fail on the day the run happens to fall on, record
  that honestly rather than claiming a green — the hazard is date-dependent by nature.

#### Manual Verification:

- `/app/report` for a seeded account shows bars whose heights match the seeded counts, with
  the earnings tile present (not suppressed).

---

## Phase 7: Record K1 in the durable doc

Source: `parent-security-screen` FU-1. Item 10. Commit subject scope: `fix(parent-security-screen)`.

### Overview

The PIN throttle's `failed_attempts` counter never decays, so the 60-second lock expires but
the next single wrong PIN re-locks immediately. That is intentional, and undocumented.

### Changes Required:

#### 1. A limitation bullet

**File**: `docs/reference/contract-surfaces.md`, `## Parent PIN routes (RLS surface)`

**Intent**: Record K1 precisely, in the section that already documents the gate order.

**Contract**: Append one bullet stating: `register_pin_failure`
(`supabase/migrations/20260702120000_pin_failure_throttle_rpc.sql`) only ever increments
`failed_attempts`; nothing decays it; the only resets are a correct PIN and `setPin`, both in
`src/lib/services/parent-pin.ts`; `LOCKOUT_MS` is 60 000, so the **lock** expires after a
minute while the **counter** does not, and one subsequent wrong PIN re-locks immediately.
Cross-reference — do not restate — the section's existing note that `setPin` clears the
counter unconditionally and that keeping `verifyPin` ahead of it in the change gate is what
prevents a free lockout reset. Append-per-section; on any merge conflict in a *Consumed by* /
*Tests* line, **keep both sides**.

### Success Criteria:

#### Automated Verification:

- `npm run lint` clean; `npm test` — branch baseline + 0; `npm run check` unchanged
- Full `E2E_PORT=<yours> npx playwright test` green — this is the branch's final phase, so
  the whole stack is re-run here regardless of the phase's own footprint

#### Manual Verification:

- A reader of `## Parent PIN routes` can answer "does waiting out the lock reset my attempt
  budget?" from the document alone. (Answer: no.)

---

## Testing Strategy

### Unit Tests

- Form-target binding and list naming in `tests/worlds-picker.test.tsx` (Phase 2).
- Per-world slot lookup reaching the DOM in `tests/shop-art-slots.test.tsx` (Phase 3).
- Tile↔chart decomposition at render level in `tests/weekly-report-tiles.test.tsx` (Phase 6).
- No new unit test for Phases 1, 4, 5 or 7 — and each says why in its own criteria rather
  than pricing a delta it cannot pay.

### Integration / Browser Tests

- Stage-ordinal a11y and the next-upgrade empty state in `e2e/growth.spec.ts` (Phase 1).
- Per-entry `href` correctness folded into Risk E2E-F4-2 (Phase 4).
- A seeded non-zero week in `e2e/parent-weekly-report.spec.ts` (Phase 6).

### Manual Testing Steps

1. Own `sign` + `shelf` at business level 1, open `/app/growth`, read the next-upgrade card.
2. Run a screen reader over the stage rail and the world picker's competency list at 712 px.
3. Force `updateChildProfileTheme` to fail and confirm the log line plus the unchanged redirect.
4. Open `/app/report` for a seeded account and compare bar heights against the seeded counts.

## Performance Considerations

None. No query, index, bundle or render-path change. The only runtime addition is one
`console.error` on an already-failing path.

## Migration Notes

**No Supabase migration.** The serialized `supabase/migrations/` lane is uncontended by this
change and by F2. If any item turns out to need schema, it leaves this change and gets its own
(`change.md` AD-1's reversal condition).

## References

- Change identity + the ten-item verification table: `context/changes/autonomous-run-follow-ups/change.md`
- Per-item precedent, biting assertions and break design: `context/changes/autonomous-run-follow-ups/research.md`
- Concurrent feature — **no shared file region**; it *reads* `signInViaUI` but never writes
  `e2e/helpers/accounts.ts` (sweep-corrected 2026-08-24): `context/changes/remember-me-on-login/plan.md`
- Binding ownership + stack order for this run: `context/runs/2026-08-24-followups-and-remember-me/ownership.md`
- Empty-state precedent: `src/pages/app/growth.astro`, the `t.growth.unlocksHeading` `<section>`
- `role="img"` precedent: `src/components/child/ShiftResults.tsx`
- List-naming precedent: `src/components/parent/WeeklyActivityChart.tsx`, the `sr-only` `<ul>`
- Logging shape: `src/pages/api/auth/reset.ts`
- jsdom test shape: `tests/weekly-report-tiles.test.tsx`
- Week arithmetic: `src/lib/services/reports.ts` → `startOfWeek`, `weekDayKeys`, `zoneOffsetMinutes`
- Insert shape to mirror: `src/lib/services/child-profiles.ts` → `appendShiftLog`

## Autonomous decisions

This run has no human in the loop. `/10x-plan` mandates `AskUserQuestion` three times — a
complexity confirmation, a deep probing round, and a design-options round. All three are made
here, each with the condition that reverses it.

**D0 — Complexity assessed MEDIUM; the questioning rounds collapsed to these decisions.**
Ten small items across nine files and four layers (`.astro`, `.tsx`, unit tests, Playwright,
docs), with `research.md` already supplying precedent and break design per item. Under the
skill's own scaling table, *task + research* at MEDIUM is 5–7 questions; six substantive
decisions are recorded below, which is that budget spent rather than skipped.
*Rejected:* LOW (ten items, three of them touching shared/contended files, is not a one-file
tweak) and HIGH (nothing here is architectural; there is no unknown left to find).
**What would change the answer:** if Phase 6's seeder turns out to need a second timezone
helper or a schema change, that phase alone is HIGH and should be re-planned on its own.

**D1 — Item 1: keep the `<h2>`, add an honest empty-state `<p>`, keep the CTA.**
Two in-repo precedents disagree. *Chosen:* the `growth.astro`-local one — the
`t.growth.unlocksHeading` section keeps its heading and ternaries into
`<p>{t.growth.noUnlocks}</p>`. *Rejected:* `start.astro`'s shape (guard heading and card
together), because `growth.astro`'s CTA sits **outside** the guard and `start.astro`'s own
comment explains why it must — *"always present, so the child can spend even when every
eligible upgrade is already owned"*. Guarding the whole `<section>` would delete `/app/growth`'s
only entrance to the shop. The mockup
(`assets/matmaverse-missing-screens-v3-web/01-world-progression-web.png`, read at intake)
draws the header outside the inner panel, which is consistent with this shape — but it depicts
no empty state, so **the `next === null` layout is an explicit extrapolation**, and `assets/`
is gitignored so nobody on a fresh clone or in CI can re-check it.
**What would change the answer:** a product decision that `/app/growth` should not be a second
entrance to the shop. Then guard the whole section and take the `start.astro` shape.

**D2 — Item 6: rename `shop-art-slots.test.ts` → `.tsx` with a jsdom pragma, rather than add
a sibling file.** *Chosen:* one file holds one contract, matching
`tests/weekly-report-tiles.test.tsx`'s shape; git records it as a rename. *Rejected:* a
sibling `tests/shop-art-render.test.tsx` — a cleaner diff, but it splits the two halves of one
contract across two files, which is the shape that produced item 7 (a reviewer seeing one
layer and calling it a gap). *Cost accepted:* the four existing data assertions move from the
`node` environment to `jsdom`; they are environment-agnostic and the cost is milliseconds.
**What would change the answer:** if the jsdom pragma measurably slows the unit suite or the
rename obscures `git blame` during review, split into the sibling file — the assertions are
identical either way.

**D3 — Item 8 ships with zero new tests, stated openly.** *Chosen:* discriminate and log, and
let `tests/profiles-world.test.ts`'s existing green stand as the KR-1 guard. *Rejected:*
mocking `@/lib/supabase` to force the DB-error branch — that file deliberately drives the real
route against real Supabase, and introducing a module mock forks its testing style and
weakens the exact guarantee it exists to provide. *Also rejected:* a `vi.spyOn(console,
"error")` test that cannot reach the branch without that mock. The success criteria therefore
claim `baseline + 0` for this phase rather than implying a delta the item cannot pay.
**What would change the answer:** if any other route in `src/pages/api/` grows a
service-failure unit test with an established stubbing pattern, adopt that pattern here and
add the assertion.

**D4 — Item 2 is guarded in Playwright, not by `npm run check`.** *Chosen:* fold a
`getByRole("img", …)` expectation into the **existing** Risk E2E-F4-1 test, so the Playwright
count does not move and an existing test gets stronger. *Rejected:* accepting "`npm run check`
plus review" as the guard — a type-checker cannot see an accessibility tree, so that guard
certifies nothing (L-004). *Also rejected:* a new dedicated test — it would duplicate the
sign-in and seed cost of a test that is already on `/app/growth`.
**What would change the answer:** if Risk E2E-F4-1 is ever split or retired, the assertion
needs its own home rather than being dropped with its host.

**D5 — Item 1 also gets a browser guard, which `research.md` did not contract.** The empty
state is reachable from `seedChildProfile({ businessLevel: 1, shopState: { purchased:
["sign","shelf"] } })`, so the defect is testable rather than review-only. *Chosen:* one new
e2e test asserting both the sentence and the surviving CTA. *Rejected:* shipping the fix
unguarded — this is the one item that is a genuine user-facing bug, and it is the item most
likely to be silently reverted by a future edit to that section.
**What would change the answer:** nothing found so far; if the seed shape stops driving
`nextUpgrade` to `null` (a catalogue change), re-derive the seed rather than dropping the test.

**D6 — Item 7 buys per-entry `href` coverage and does not extract `src/data/nav.ts`.**
*Chosen:* document the two-layer split, fix the stale "Five entries" prose, and extend Risk
E2E-F4-2's existing loop with an `href` assertion — the one hole neither layer covers today.
*Rejected:* Fix A (`change.md` AD-4, C1) — extracting `items`/`tabs` into a `.ts` module
restructures the most-shared component in the app to buy a duplicate of coverage that already
exists in the only layer that can observe the risk. This confirms `research.md`'s AD-R3 after
re-verifying Risk E2E-F4-2 on disk.
**What would change the answer:** a second consumer of `items`/`tabs` (a route manifest, a
sitemap, a second shell). Then Fix A is worth its price on those grounds — not on FU-3's.

**D7 — `e2e/helpers/accounts.ts` is appended to, never restructured. Sweep-resolved: F1 owns
it outright.** *(Updated in place by the contention sweep, 2026-08-24 — the **premise** was
wrong, the decision survives.)* At planning time `ownership.md` did not exist and this plan
assumed F2 `remember-me-on-login` also wrote the file. It does not: F2's *What We're NOT
Doing* says "No changes to `e2e/helpers/accounts.ts`", its AD-9 repeats it, and F2's research
only reads `signInViaUI`. *Chosen (unchanged):* `seedShiftWeek` is appended after
`signInViaUI` at end of file and no existing export is edited — but the reason is now F2's
**read** dependency, not a merge risk: every authenticated F2 regression funnels through that
helper, so its locators must not move. *Rejected:* reorganising the file into per-concern
modules — sole ownership does not make a restructure free while a concurrent feature reads it.
**What would change the answer:** nothing this run. F1 is the sole writer; there is no
rebase-onto-F2 branch to take.

**D8 — Two of `change.md` AD-3's three adjacent items are folded in; the third is refused.**
*Chosen:* `growth.astro`'s missing savings-bar `aria-hidden="true"` (Phase 1 — same section as
item 1, one line, both sibling copies already carry it) and `WeeklyActivityChart`'s dead
`import React` (Phase 6 — one line, same source feature as items 3/4). *Rejected:* the
`world.name`-three-times a11y duplication — not a one-line fix, it needs a product call about
which copy is canonical, and it moves text `e2e/growth.spec.ts` locates. It stays recorded in
the archive. AD-3 permits folding in only with an explicit statement and a moved count; both
folded items are called out in their phases' Changes Required.
**What would change the answer:** if the maintainer wants scope held at exactly ten, drop both
one-line edits — neither has a test delta, so nothing else in the plan moves.

**D9 — One commit per phase, each phase scoped to one source feature; a source feature may
produce more than one commit.** `change.md` AD-1 asked for "one commit per source feature",
which would force four `world-selection-screen` phases (2–5) into one fat commit mixing a
component, a test rename, an e2e spec and an API route. *Chosen:* keep the phases granular —
`git log --grep world-selection-screen` still recovers all four, which is the audit trail AD-1
was protecting, and each commit stays independently revertible and independently verified.
*Rejected:* one commit per source feature (unverifiable phase boundaries) and one squashed
commit (erases which review raised which item).
**What would change the answer:** if the maintainer wants exactly four commits, squash by
scope with an interactive rebase before review — the phase boundaries make that mechanical.

**D10 — Correction C4 recorded rather than silently ignored.** `change.md` lists
`dashboard-recent-activity` among the five sources, but none of the ten items comes from it
(its non-blocking section is doc/process notes only). Stated so nobody looks for a fifth
commit that does not exist.
**What would change the answer:** if an eleventh item is adopted from that file, it gets its
own phase and its own commit scope.

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 0: Branch baseline

#### Automated

- [x] 0.1 Cut `feat/autonomous-run-follow-ups` from `matmaverse-v2` via `.claude/skills/10x-autonomous-run/scripts/worktree-bootstrap.sh` (never `git checkout` in the main tree)
- [x] 0.2 Measure the branch baseline before Phase 1 and record it in the handoff: `npm test`, `npx playwright test --list`, `npm run lint`, `npm run check` (L-005 — every delta below is measured against this, never against 429/23)

### Phase 1: `/app/growth` — honest empty state and announced stage ordinals

#### Automated

- [x] 1.1 `npm run lint` clean — 915bd85
- [x] 1.2 `npm run check` — 0 errors, 0 warnings — 915bd85
- [x] 1.3 `npm test` — branch baseline + 0 — 915bd85
- [x] 1.4 `E2E_PORT=<yours> npx playwright test e2e/growth.spec.ts` — branch e2e baseline + 1 test per project — 915bd85
- [x] 1.5 Deliberate break A: remove `role="img"` from `StageRail`'s three markers → `getByRole("img", …)` red in both projects → restore — 915bd85
- [x] 1.6 Deliberate break B: revert to `{next && (…)}` → empty-state test red on the missing sentence, CTA assertion still green → restore — 915bd85

#### Manual

- [ ] 1.7 Next-upgrade card reads as a finished thought with `sign` + `shelf` owned at level 1, CTA still reachable
- [ ] 1.8 Screen reader announces "Etap 1".."Etap 4" on the stage rail

### Phase 2: `WorldPicker` — bind the form target and name the competency list

#### Automated

- [x] 2.1 `npm run lint` clean; `npm run check` 0 errors / 0 warnings — 589c638
- [x] 2.2 `npm test` — branch baseline + 2 — 589c638
- [x] 2.3 Deliberate break A: delete the `<form>` element keeping its children → rooted helper throws, `action` assertion red → restore — 589c638
- [x] 2.4 Deliberate break B: remove the `<ul>`'s `aria-label` → `getByRole("list", { name })` red → restore — 589c638

#### Manual

- [ ] 2.5 At 712 px a screen reader announces the competency list with its heading text

### Phase 3: `ShopArt` — make the slot test exercise the per-world lookup

#### Automated

- [x] 3.1 `npm run lint` clean; `npm run check` 0 errors / 0 warnings — 0cf5fb5
- [x] 3.2 `npm test` — branch baseline + 1 — 0cf5fb5
- [x] 3.3 Deliberate break: drop the `WORLD_SLOTS[world.slug]?.` prefix from the badge `style` → render case red on `left`/`top` → restore — 0cf5fb5

### Phase 4: Nav — document the two-layer split and assert every entry's href

#### Automated

- [x] 4.1 `npm run lint` clean; `npm test` — branch baseline + 0 — 256bd10
- [x] 4.2 `E2E_PORT=<yours> npx playwright test e2e/growth.spec.ts` — count unchanged from Phase 1's post-state, all green — 256bd10
- [x] 4.3 Deliberate break: change one entry's `href` in `AppShell.astro`'s `items` → Risk E2E-F4-2 red in both projects → restore — 256bd10
- [x] 4.4 Meta-check recorded: removing an entry from `items` was already red before this phase (count 0) — the reason Fix A is not bought — 256bd10

### Phase 5: `POST /api/profiles/world` — log the DB-error branch

#### Automated

- [x] 5.1 `npm run lint` clean; `npm run check` 0 errors / 0 warnings
- [x] 5.2 `npm test` — branch baseline + 0 (no new test, by D3; the existing suite's green is the KR-1 guard)
- [x] 5.3 Deliberate break: invert the discriminant to `if (!("error" in result))` → `tests/profiles-world.test.ts`'s own-profile test red on `Location` + read-back → restore
- [x] 5.4 Record the rejected break (moving the unreachable `"error"` branch's redirect stays green — a decorative break, L-004)

#### Manual

- [x] 5.5 Forced service failure logs `[profiles/world] …` while the browser still lands on `/app/worlds` unchanged

### Phase 6: Weekly report — decomposition at render level, and a `shift_log` seeder

#### Automated

- [ ] 6.1 `npm run lint` clean; `npm run check` 0 errors / 0 warnings
- [ ] 6.2 `npm test` — branch baseline + 1
- [ ] 6.3 `E2E_PORT=<yours> npx playwright test` — full suite, branch e2e baseline + 1 run TOTAL (`desktop` only — `touch` matches only `gameplay-restore|growth`), all green
- [ ] 6.4 Deliberate break: repoint `tasksThisWeek` at `upgrades.length` → tile-vs-bars sum diverges → red → restore
- [ ] 6.5 Seeder break: `created_at` by UTC day arithmetic instead of `weekDayKeys` → record whether it can be made to fail on the run's own date, honestly

#### Manual

- [ ] 6.6 `/app/report` bar heights match the seeded counts and the earnings tile is present

### Phase 7: Record K1 in the durable doc

#### Automated

- [ ] 7.1 `npm run lint` clean; `npm test` — branch baseline + 0; `npm run check` unchanged
- [ ] 7.2 Full `E2E_PORT=<yours> npx playwright test` green — final phase, whole stack re-run

#### Manual

- [ ] 7.3 `## Parent PIN routes` answers "does waiting out the lock reset my attempt budget?" from the document alone
