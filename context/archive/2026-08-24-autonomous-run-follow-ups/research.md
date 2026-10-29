---
date: 2026-08-24T15:20:00+02:00
researcher: Claude (autonomous run 2026-08-24-followups-and-remember-me, F1 research step)
git_commit: 282d264
branch: matmaverse-v2
repository: 10xDevs (MathShop / MatmaVerse)
topic: "Closing the ten triaged follow-ups from the 2026-08-22 autonomous run"
tags: [research, codebase, follow-ups, a11y, test-coverage, nav, shift-log, e2e-helpers]
status: complete
last_updated: 2026-08-24
last_updated_by: Claude (F1 research step)
---

# Research: closing the ten triaged follow-ups (`autonomous-run-follow-ups`)

**Date**: 2026-08-24T15:20:00+02:00
**Researcher**: Claude — autonomous run `2026-08-24-followups-and-remember-me`, feature F1, `/10x-research` step
**Git Commit**: `282d264`
**Branch**: `matmaverse-v2` (main checkout; docs lane, no worktree, no branch cut)
**Repository**: 10xDevs

## Research Question

`change.md` (written by `/10x-new`, then re-verified) already establishes **what** the ten
items are and that all ten claims are true on disk. It explicitly leaves **how** open, and
AD-2 argued research was unnecessary. The orchestrator dispatched this step anyway. So this
research deliberately does **not** re-derive the ten-item table. It answers the questions a
planner would otherwise have to answer at the keyboard:

1. Does C1's nav-array extraction ripple beyond `AppShell.astro` + one new module — and is
   FU-3's problem even still open, given what the e2e suite already asserts?
2. For each item, what **in-repo precedent** dictates the shape of the fix, so the plan
   picks a pattern rather than inventing one?
3. For each test item, what assertion actually **bites** — i.e. what deliberate break would
   go red, and does that redness prove the contracted claim (L-004)?
4. What does `seedShiftWeek` have to look like against the real `shift_log` schema and the
   real weekly-report window?
5. Where does F1 collide with F2 `remember-me-on-login`, which is running concurrently?

## Summary

**The single most consequential finding: FU-3 (item 7) is already covered end-to-end, and
the expensive Fix A is unnecessary.** `e2e/growth.spec.ts` → *"every nav entry stays uniquely
reachable and the shell never scrolls sideways (Risk E2E-F4-2)"* iterates
`Object.values(t.nav.items)` and asserts each label resolves to **exactly one visible link**
at both the `desktop` (1280) and `touch` (712) viewports. Dropping an entry from `AppShell`'s
`items` leaves the dictionary key in place, so the loop still asks for that link and finds
zero — **red in both projects**. FU-3's premise ("dropping an entry keeps it green") is true
of `tests/nav-labels.test.ts` alone and false of the suite as a whole. That collapses AD-4's
Fix A vs Fix B question: **Fix B already exists**; the residual work is a comment in
`tests/nav-labels.test.ts` naming its actual contract (dictionary hygiene, not nav wiring)
and naming the e2e test that carries the other half. Extracting `items`/`tabs` into
`src/data/nav.ts` would restructure the most-shared component in the app to buy a second copy
of coverage that already exists in the layer that can actually observe the risk.

Beyond that, **eight of the remaining nine items have an exact in-repo precedent**, which
means the plan can name a pattern instead of designing one:

| # | Item | Precedent that dictates the fix |
|---|---|---|
| 1 | `growth.astro` heading over an empty card | **the same file, one section up**: `t.growth.unlocksHeading` renders `<h2>` unconditionally then `{unlocks.length > 0 ? <ul/> : <p>{t.growth.noUnlocks}</p>}` |
| 2 | `StageRail` `aria-label` on a `role=generic` span | `src/components/child/ShiftResults.tsx` — `<div role="img" aria-label={t.results.starsLabel…}>` |
| 3 | no rendered non-zero chart beside a non-zero tile | `tests/reports.test.ts` asserts the Σ invariant at the aggregator; nothing asserts it at the render |
| 4 | no `shift_log` seeder | `seedChildProfile` in `e2e/helpers/accounts.ts` + `appendShiftLog` in `src/lib/services/child-profiles.ts` |
| 5 | `worlds-picker` never asserts the `<form>` | `WorldPicker` is the `CreateProfileWizard` native-POST idiom; the form's `action` **is** the commit |
| 6 | `shop-art-slots` is data-only | `tests/weekly-report-tiles.test.tsx` (`// @vitest-environment jsdom` + Testing Library) |
| 8 | `world.ts` DB error is silent | `console.error("[auth/reset] resetPasswordForEmail failed", {…})` — the repo's only structured-log shape |
| 9 | `WorldPicker` list unlabeled below `lg` | `WeeklyActivityChart` — `<ul aria-label={copy.chartHeading}>` for exactly this reason |
| 10 | K1 undocumented | `docs/reference/contract-surfaces.md` `## Parent PIN routes` is append-per-section |

**Item 1 is not an edge case.** `nextUpgrade` returns `null` as soon as every
level-eligible upgrade is owned, and at `business_level = 1` that means owning just `sign`
(30 zł) and `shelf` (60 zł) — 90 zł of ordinary early play. The heading-over-nothing state
is on the normal path, hit repeatedly at every level boundary, and **permanent** at level 3
once all six are owned.

**Baseline re-measured in this step**, not inherited (agent-contract rule 5), on
`matmaverse-v2` @ `282d264` with the sandbox disabled and Supabase up: `npm test` **429
passed / 51 files**; `npx playwright test --list` **23 tests / 8 files**; `npm run lint`
clean (exit 0); `npm run check` **0 errors, 0 warnings, 9 hints (188 files)**.

## Detailed Findings

### Item 1 — `src/pages/app/growth.astro`, the next-upgrade `<section>`

- The `<section>` opens with `<h2>{t.start.nextUpgradeHeading}</h2>`, then `{next && (…)}`,
  then an **unconditional** `<a href="/app/upgrades">{t.growth.upgradesLink}</a>`. With
  `next === null` the card renders a heading and a button with nothing between them.
- **Reachability** (`nextUpgrade`, `src/data/upgrades.ts`): `UPGRADES` carries six ids with
  `requiredWorldLevel` 1, 1, 2, 2, 3, 3 (`sign` 30, `shelf` 60, `register` 100, `slot` 150,
  `storage` 210, `customers` 300). Owning both level-1 upgrades at level 1 → `null`. This is
  a routine early state, not a theoretical terminal one.
- **The unconditional `<a>` is deliberate and must survive.** `src/pages/app/start.astro`
  carries the same CTA with the comment *"The one entry to the shop surface — always
  present, so the child can spend even when every eligible upgrade is already owned."* Any
  fix that guards the whole `<section>` deletes that entry from `/app/growth`.
- **The file's own local precedent settles the shape.** The `t.growth.unlocksHeading`
  `<section>` immediately above renders its `<h2>` unconditionally and then ternaries into
  an honest empty-state `<p>{t.growth.noUnlocks}</p>` — with the comment *"Honest empty, not
  an invented promise"*. Item 1's fix is the same shape: keep the `<h2>`, replace
  `{next && (…)}` with `{next ? (…) : <p>…</p>}`, keep the `<a>`.
- That also agrees with the mockup reading recorded in `change.md` (header outside the inner
  panel) and needs **one new i18n key** under `growth:` — a sibling of `noUnlocks`.
- Knock-on: `savingPercent` is already `null` when `next` is `null`, so `AppShell`'s
  `progressPercent`/`progressLabel` are already suppressed. No shell change.
- **Precedent conflict to state explicitly:** `start.astro` guards heading-and-card together
  (its heading is a `<p>`, inside `{next && (`), while `growth.astro`'s sibling section keeps
  the heading and adds an empty state. The plan must say which precedent it is following and
  why; both are in-repo and they disagree.

### Item 2 — `src/components/child/StageRail.astro`, the three state markers

- All three branches (`done` / `current` / `locked`) render a `<span>` with
  `aria-label={t.growth.stageOrdinal.replace("{n}", …)}` and **no `role`**. `aria-label` on a
  `role=generic` element is not exposed by browsers, so the file's own comment — *"the
  ordinal badge carries a label"* — is false today.
- **Exact precedent:** `src/components/child/ShiftResults.tsx` renders
  `<div className="flex gap-1" role="img" aria-label={t.results.starsLabel.replace(…)}>`.
  `role="img"` + `aria-label` on a container of decorative glyphs is the established shape.
  (`SkillBars.tsx` / `SkillCards.astro` use `role="progressbar"` + `aria-label` for the same
  reason.) The `done` and `locked` branches hold `aria-hidden` lucide icons; the `current`
  branch holds the bare digit `{stage.order}`, whose children become presentational under
  `role="img"` — which is the desired outcome ("Etap 2", not "2").
- **L-007 check performed:** the label text is unchanged, so no new string enters the
  dictionary and no `getByText` locator moves. `getByText` reads DOM text, not the a11y tree,
  so `e2e/growth.spec.ts`'s stage-name and `t.growth.current` locators are untouched. The
  only new accessible names are `"Etap 1".."Etap 4"`, which collide with nothing —
  `t.growth.stagesHeading` is `"Etapy rozwoju"`, not a substring relation that any
  role-based locator can trip over.
- **Deliberate break for this item, and its meta-check (L-004):** removing `role="img"` is
  the break, but *no committed unit test would go red* — nothing asserts the a11y tree here.
  The plan must therefore ship the assertion **with** the fix (a jsdom render of `StageRail`
  is not possible — it is `.astro`), or state honestly that the guard is `npm run check` plus
  review. A recommended, executable alternative: assert via Playwright
  `getByRole("img", { name: fill(t.growth.stageOrdinal, { n: "1" }) })` in
  `e2e/growth.spec.ts`, which runs in both projects and is red before the fix.

### Item 3 — `tests/weekly-report-tiles.test.tsx`, the single `EMPTY_WEEK` fixture

- Nuance the source review understates: `tests/weekly-activity-chart.test.tsx` **does**
  render non-zero weeks (bars, gridlines, sr-only list, legend) — the *chart component* is
  well covered.
- What is genuinely untested is the **composition**: `WeeklyReport` renders `statTasks` from
  `practice` (`COMPETENCIES.reduce(… practice[c].completed)`) and the chart from `daily`, two
  independent fields of `WeeklyReportData`. `reports.ts` documents the binding invariant —
  *"`Σ daily[].completed === Σ practice[*].completed`… so a parent adding the seven bars gets
  the number printed above them"* — and `tests/reports.test.ts` asserts it **at the
  aggregator** (`"makes the bars a decomposition of the tasks tile"`). Nothing asserts it at
  the render, and because `child()` hard-codes `daily: EMPTY_WEEK`, `WeeklyReport` has never
  been rendered with a chart at all: every fixture takes `WeeklyActivityChart`'s
  `maxCount === 0` early return (`copy.chartEmpty`).
- **The assertion that bites:** a fixture whose `practiceDelta` and `daily` agree, then
  assert (a) `statTasks`' printed number, and (b) the sr-only `<ul name={copy.chartHeading}>`
  items sum to the same number. Requires making `daily` a parameter of the `child()` helper
  — an additive signature change, all existing call sites keep `EMPTY_WEEK` by default.
- **Deliberate break + meta-check:** swap `tasksThisWeek`'s source from `practice` to
  `upgrades.length` in `WeeklyReport` → the tile-vs-bars sum diverges → red. That break is
  plausible (it is the same "grab a nearby number" mistake the tile row invites) and it
  removes exactly the protection claimed. Merely deleting `<WeeklyActivityChart>` would also
  go red but proves less — it proves the chart renders, not that it decomposes the tile.

### Item 4 — `e2e/helpers/accounts.ts`, a `seedShiftWeek` seeder

Schema (`supabase/migrations/20260701150000_create_shift_log.sql` +
`20260822120000_shift_log_add_earned.sql`), i.e. exactly what the insert must carry:

| column | note for the seeder |
|---|---|
| `account_id` | `not null`, FK to `auth.users` — RLS predicate column. Must be the provisioning account's id, never derived client-side (L-002). |
| `profile_id` | `not null`, FK to `child_profiles`. |
| `created_at` | `default now()` — **must be set explicitly**, it is what places a row on a chart day. |
| `skills` | `jsonb not null`, shape `{ math\|money\|decisions: { firstTryCorrect, completed, misses } }`. |
| `upgrade_purchased` | `null` for a shift row; a non-null id makes it a purchase row. |
| `earned` | nullable, `check (earned is null or earned >= 0)`. **`null` on a shift row flips `earningsKnown` to `false` and suppresses the earnings tile** — so a seeder that omits it silently changes what the report renders. |

- **The week window is Europe/Warsaw, not UTC.** `startOfWeek` / `weekDayKeys`
  (`src/lib/services/reports.ts`) resolve Monday 00:00 Warsaw; `warsawDayKey`
  (`src/data/activity.ts`) buckets a row. A seeder that writes "today minus N days" in UTC
  will drift a bar across a day boundary near midnight and across a DST weekend. Compute the
  target instants from `weekDayKeys(new Date())` — do **not** add a second offset parser
  (`reports.ts` explicitly declares `zoneOffsetMinutes` the project's only one).
- **The write path to mirror** is `appendShiftLog` (`src/lib/services/child-profiles.ts`),
  which writes exactly these five columns with `upgrade_purchased ?? null` and
  `earned ?? null`.
- **L-002 applies only where isolation is being proven.** `seedShiftWeek` is provisioning
  through the service-role `admin` client (RLS-bypassing), like `seedChildProfile`, so a
  chained `.select("id")` read-back is fine there — `seedChildProfile` already does it. The
  L-002 prohibition is about asserting a *blocked write*, which this seeder never does.
- **Cleanup is free:** `shift_log.account_id` is `on delete cascade` from `auth.users`, so
  the existing `try/finally` + `deleteUser(account.id)` in every spec already removes seeded
  rows. No new teardown.
- **Consumer:** `e2e/parent-weekly-report.spec.ts`'s header explicitly records the gap —
  *"A seeded-week variant (non-zero bars) is deliberately NOT here: `e2e/helpers/` has no
  `shift_log` seeder."* If the plan adds the seeder without a consumer it ships dead code;
  that spec is the natural first caller.

### Item 5 — `tests/worlds-picker.test.tsx`, the unasserted `<form>`

- `src/components/child/WorldPicker.tsx` renders `<form method="POST"
  action="/api/profiles/world">` with `ChildButton type="submit"` labelled `t.worlds.confirm`
  (`"Start"`) / `t.worlds.submitting`. The file's own header calls the native POST *"the
  `CreateProfileWizard` idiom"* — a full page navigation, not a `fetch`.
- `hiddenInput(container, name)` roots at `container` and the file never mentions `form`,
  `action`, `method` or the submit control. Deleting the `<form>` wrapper leaves the inputs
  in the tree, so all seven tests stay green while the feature is inert.
- **The assertion that bites:** root the helper at
  `container.querySelector("form")` (throw if absent), and assert
  `form.getAttribute("action") === "/api/profiles/world"`, `method` is `post`
  (case-insensitively — jsdom normalises), and
  `screen.getByRole("button", { name: t.worlds.confirm })` is inside it.
- **L-007 check performed:** `t.worlds.confirm` is `"Start"`. The other buttons in this tree
  are the world tiles, whose accessible names are `WORLDS[].name`
  (`Kawiarnia` / `Piekarnia` / `Galaktyczna baza` / `Sklep księgarnia`) — no substring
  relation with `"Start"` in either direction. Testing Library's `name` option full-string
  matches, so this is unambiguous. Note the existing test that counts
  `getAllByRole("button").filter(b => b.hasAttribute("aria-pressed"))`: the submit button has
  no `aria-pressed`, so that count is unaffected.
- **Deliberate break + meta-check:** delete the `<form>` element (keeping its children) →
  the rooted helper throws and the action assertion fails → red. That is precisely the
  regression the file claims to protect ("the hidden `theme` input IS the commit"), so the
  redness is evidence for the contracted claim.

### Item 6 — `tests/shop-art-slots.test.ts`, data-only

- Confirmed executable exactly as `change.md` states: `WORLD_SLOTS.piekarnia.sign` is
  `{ left: "7%", top: "10%" }`, `DEFAULT_SLOTS.sign` is `{ left: "10%", top: "6%" }` — they
  differ on **both** axes, so a per-axis assertion cannot pass by coincidence.
- **A trap the plan must avoid.** `ShopArt`'s `placed` / `unplaced` partition uses
  `WORLD_SLOTS[world.slug]?.[u.id] ?? DEFAULT_SLOTS[u.id]`, and `DEFAULT_SLOTS` covers all
  six ids — so `unplaced` is **always empty** and dropping the `WORLD_SLOTS[world.slug]?.`
  prefix changes the partition not at all. The only observable difference is the badge's
  inline `style`. An assertion on "a badge is rendered", or on `unplaced`, certifies nothing
  (L-004). The assertion must read `style.left` / `style.top` off the placed `<span>`.
- **Mechanics:** the file is `.ts` with no jsdom pragma and vitest's global `environment` is
  `"node"` (`vitest.config.ts`). A render case therefore needs JSX + the pragma. Two shapes,
  and the plan should pick one explicitly:
  - **(a)** rename to `tests/shop-art-slots.test.tsx`, add `// @vitest-environment jsdom` at
    the top, keep the four data assertions (they are env-agnostic). One file, git shows a
    rename; matches `tests/weekly-report-tiles.test.tsx`'s shape.
  - **(b)** leave `shop-art-slots.test.ts` untouched and add a sibling
    `tests/shop-art-render.test.tsx`. Cleaner diff, one more file, and the two halves of one
    contract then live apart.
- Locating the badge: it is a `<span>` with an inline `style` and no role; its child `<img>`
  is `alt=""`. `container.querySelectorAll("span[style]")` is acceptable in a unit test —
  `e2e/CLAUDE.md`'s no-CSS-selectors rule governs `e2e/` only, and `tests/worlds-picker.test.tsx`
  already uses `querySelector`. The base image is reachable as
  `screen.getByAltText(world.name)`.

### Item 7 — `tests/nav-labels.test.ts` — **already covered where it counts**

- The unit suite reads `Object.values(t.nav.items)` and never imports `AppShell`. True, and
  by design: its three `it()` blocks are uniqueness, mutual substring collision, and
  collision with `LIVE_E2E_STRINGS`. It is a **dictionary-hygiene** suite (L-007's guard),
  and it does that job correctly.
- **`e2e/growth.spec.ts` carries the other half already.** Risk E2E-F4-2 loops the same
  `Object.values(t.nav.items)` and asserts `toHaveCount(1)` + `toBeVisible()` for
  `getByRole("link", { name: label, exact: true })`, then measures the nav's own
  `scrollWidth - clientWidth` and the document's. It runs in **both** projects
  (`desktop` 1280 and `touch` 712 — confirmed in `npx playwright test --list`). Remove an
  entry from `AppShell`'s `items` and the dictionary key survives, so the loop asks for a
  link that no longer exists → **count 0 → red, twice**.
- **C1's blocker is real but moot.** `items` / `tabs` are `const`s in `.astro` frontmatter,
  which has no value exports, so Fix A does require a new `.ts` module. But Fix A buys a
  duplicate of coverage that already exists in the only layer that can see the risk
  (a real browser at a real viewport). Restructuring the most-shared component in the app for
  that is a bad trade.
- **Residual work, and it is cheap:** the two files each know half a contract and neither
  says so. Add to `tests/nav-labels.test.ts`'s header that it guards the *dictionary* and
  that `e2e/growth.spec.ts` Risk E2E-F4-2 guards the *wiring*; add the reciprocal pointer in
  the spec. Note also that `growth.spec.ts` says *"Five entries"* in two comments while
  `t.nav.items` now has **six** keys (`dashboard`, `missions`, `shop`, `growth`, `worlds`,
  `parent`) — stale prose in the file that carries the guarantee.
- **The one genuine hole neither layer covers:** `href` correctness per entry. Only
  `t.nav.items.growth`'s href is proven (by the click in Risk E2E-F4-1); the other five are
  asserted to exist, not to point anywhere in particular. If the plan wants a real coverage
  *increase* out of item 7, that is where it is — and it is an e2e assertion, not a unit one.

### Item 8 — `src/pages/api/profiles/world.ts`, the silent DB-error branch

- `updateChildProfileTheme` (`src/lib/services/child-profiles.ts`) returns
  `{ error } | { failure: "not-found" } | { ok: true }`. The route's
  `if (!("ok" in result))` collapses a DB failure and a routine ownership bounce into one
  redirect. Discrimination is free and exact: `if ("error" in result)`.
- **Logging convention, verified by exhaustive grep** — `src/` contains exactly two logging
  calls: `console.error("[auth/reset] resetPasswordForEmail failed", {…})`
  (`src/pages/api/auth/reset.ts`) and `console.warn(…)` (`src/pages/api/auth/signup.ts`).
  The shape is a `[route] message` prefix plus a structured second argument. There is no
  logger module and one must not be invented (C3 in `change.md` correctly retracts the
  `account/delete.ts` precedent — that file logs nothing).
- **KR-1 must hold:** the redirect stays byte-identical (`applyNoStore(context.redirect(WORLDS))`)
  on every failure path, so the route is not an existence oracle. The change is additive
  logging only.
- **Do not log the profile id or the theme unfiltered** — `profileId` identifies a child
  row; the two existing call sites log operation-scoped context, not user identifiers.
- **Test surface:** `tests/profiles-world.test.ts` drives the real route against real
  Supabase. A DB-error branch is hard to force there without stubbing; the honest option is
  a `vi.spyOn(console, "error")` assertion around a forced service failure, or an explicit
  statement in the plan that this item ships without a new test and why. `change.md`'s
  success criteria must not imply a test delta this item cannot pay.

### Item 9 — `src/components/child/WorldPicker.tsx`, the unlabeled competency list

- `<p className="text-foreground hidden text-sm font-extrabold lg:block">{t.worlds.learnHeading}</p>`
  is `display:none` below `lg`; the `<ul>` beneath it has no accessible name, so at the
  `touch` viewport a screen reader gets three list items with no idea what the list is.
- **Exact precedent:** `WeeklyActivityChart` names its own list —
  `<ul className="sr-only" aria-label={copy.chartHeading}>` — with the recorded reason *"The
  list names itself, because the heading above it is a `div`."* Same fix here:
  `aria-label={t.worlds.learnHeading}` on the `<ul>`.
- **Why not `aria-labelledby`:** it would work (name computation does read `display:none`
  referents), but it needs a new `id` and depends on a subtlety a future editor can break by
  moving the `<p>`. `aria-label` matches the precedent and adds no coupling.
- **No new i18n key**, and no `getByText` movement: `aria-label` is not DOM text, so the
  existing `screen.getByText(t.worlds.learnHeading)` assertion in `tests/worlds-picker.test.tsx`
  still resolves to the `<p>` alone. The new assertion is
  `screen.getByRole("list", { name: t.worlds.learnHeading })`, which is red before the fix.
- Item 5 and item 9 land in the same test file and the same component — one commit.

### Item 10 — `docs/reference/contract-surfaces.md`, the K1 limitation

- The `## Parent PIN routes (RLS surface)` section documents gate order, the change gate,
  the `STATUS_FOR` vocabulary and the tests. It carries **no limitation bullet**.
- **Behaviour re-verified:** `register_pin_failure`
  (`supabase/migrations/20260702120000_pin_failure_throttle_rpc.sql`) only ever does
  `failed_attempts = s.failed_attempts + 1`, and sets `locked_until` when the post-increment
  count crosses `p_max`. Nothing decays the counter. In `src/lib/services/parent-pin.ts` the
  only resets are a **correct PIN** (`.update({ failed_attempts: 0, locked_until: null })`)
  and `setPin` (which writes `failed_attempts: 0, locked_until: null` unconditionally).
  `LOCKOUT_MS` is 60 000 — so the *lock* expires after a minute but the *counter* does not,
  and the next single wrong PIN re-locks immediately. That is the K1 limitation, stated
  precisely.
- **Second-order consequence worth recording alongside it:** because `setPin` clears the
  counter unconditionally, any path that reaches `setPin` while locked is a free lockout
  reset. The section already documents the mitigation (`verifyPin` sits ahead of `setPin` in
  the change gate) — the K1 bullet should cross-reference it rather than restate it.
- **Concurrency rule:** this file is append-per-section and, on a conflict in a *Consumed
  by* / *Tests* line, **both sides are kept — never `--ours`/`--theirs`**. Nothing in
  `tests/`, `e2e/`, `src/` or CI reads it, so a bad resolution fails silently and forever.

### Cross-feature contention with F2 `remember-me-on-login`

F2's `research.md` names the files it expects to touch. Overlap with F1:

| file | F1 | F2 | verdict |
|---|---|---|---|
| `docs/reference/contract-surfaces.md` | appends K1 to `## Parent PIN routes` | is likely to add a session/auth surface, and its research already reads `src/lib/services/parent-pin.ts` | **append-per-section**; safe if F2 does not edit the PIN section. Flag to the ownership sweep. |
| `src/i18n/pl.ts` | one new key under `growth:` (item 1) | one new key under `auth.signin:` | append-only, different sections — safe. **Grep both directions before adding** (L-007). |
| `e2e/helpers/accounts.ts` | adds `seedShiftWeek` | names the file; likely `signInViaUI` | different functions, same file — real merge contention. Assign in `ownership.md`. |
| `src/lib/services/parent-pin.ts` | **read only** (item 10 documents it) | reads it | no write from F1 — safe. |

F1 touches nothing else F2 names. No migration on either side, so the serialized
`supabase/migrations/` lane is not contended in this run.

## Code References

- `src/pages/app/growth.astro` — the `<section>` whose first child is `<h2>{t.start.nextUpgradeHeading}</h2>`; and the `t.growth.unlocksHeading` section above it, which is the empty-state precedent
- `src/pages/app/start.astro` — the `{next && (` block plus the unconditional `t.start.upgradesLink` `<a>` ("always present, so the child can spend…")
- `src/data/upgrades.ts` → `nextUpgrade` — returns `null` once every level-eligible upgrade is owned
- `src/components/child/StageRail.astro` — the three `aria-label={t.growth.stageOrdinal…}` `<span>`s
- `src/components/child/ShiftResults.tsx` — `<div role="img" aria-label={t.results.starsLabel…}>`, the role precedent
- `src/components/parent/WeeklyReport.tsx` → `ChildSection` — `tasksThisWeek` (the `statTasks` tile) and `<WeeklyActivityChart days={daily} />`
- `src/components/parent/WeeklyActivityChart.tsx` — the `maxCount === 0` early return, and `<ul className="sr-only" aria-label={copy.chartHeading}>`
- `src/lib/services/reports.ts` → `aggregateWeeklyReport`, `startOfWeek`, `weekDayKeys`, `zoneOffsetMinutes` ("the project's only UTC-offset parser — do not re-implement it")
- `src/lib/services/child-profiles.ts` → `updateChildProfileTheme`, `appendShiftLog`
- `src/pages/api/profiles/world.ts` → the `if (!("ok" in result))` branch
- `src/pages/api/auth/reset.ts` — `console.error("[auth/reset] …", {…})`, the logging shape
- `src/components/child/WorldPicker.tsx` — the `<form method="POST" action="/api/profiles/world">`, the `t.worlds.learnHeading` `<p>`, the competency `<ul>`, the `ChildButton type="submit"`
- `src/components/child/ShopArt.tsx` — `WORLD_SLOTS`, `DEFAULT_SLOTS`, the `placed`/`unplaced` partition and the badge `style={…}`
- `src/components/app/AppShell.astro` — the `items` / `tabs` frontmatter consts (not importable)
- `tests/nav-labels.test.ts` — `labels`, `LIVE_E2E_STRINGS`
- `e2e/growth.spec.ts` — *"every nav entry stays uniquely reachable and the shell never scrolls sideways (Risk E2E-F4-2)"*, and its stale "Five entries" comments
- `e2e/parent-weekly-report.spec.ts` — the header paragraph recording the missing `shift_log` seeder
- `e2e/helpers/accounts.ts` — `provisionAccount`, `seedChildProfile`, `signInViaUI`
- `tests/reports.test.ts` — *"makes the bars a decomposition of the tasks tile: Σ daily === Σ practice.completed"*
- `tests/weekly-report-tiles.test.tsx` — `EMPTY_WEEK`, the `child()` helper
- `tests/weekly-activity-chart.test.tsx` — the non-zero chart renders that already exist
- `tests/worlds-picker.test.tsx` — `hiddenInput(container, name)`
- `tests/shop-art-slots.test.ts` — the four data `it()` blocks
- `supabase/migrations/20260701150000_create_shift_log.sql`, `…20260822120000_shift_log_add_earned.sql`, `…20260702120000_pin_failure_throttle_rpc.sql`
- `docs/reference/contract-surfaces.md` — `## Parent PIN routes (RLS surface)`

## Architecture Insights

- **Empty states are a stated product value here, not a nicety.** Three separate surfaces
  (`t.growth.noUnlocks`, `t.report.chartEmpty`, `t.growth.maxStage`) each carry a comment
  explaining why an honest sentence beats a zeroed widget. Item 1 is the one place that rule
  is broken, which is why it reads as a bug rather than a polish item.
- **The repo's a11y doctrine is "one DOM tree, toggled with `display`, named explicitly".**
  `AppShell`'s two navs, `StageRail`'s single reflowing list, and `WeeklyActivityChart`'s
  `aria-hidden` SVG beside an `sr-only` real list are all the same decision. Items 2 and 9
  are two places where the naming half of that doctrine was not finished.
- **Coverage in this project is layered on purpose, and the layers are documented in file
  headers.** `reports.ts` proves arithmetic, jsdom proves shape, Playwright proves wiring and
  viewport. Several follow-ups read as gaps only because the reviewer looked at one layer;
  item 7 is exactly that. **Before adding a test, read the other layer's header** — the
  headers name what each layer deliberately does *not* assert.
- **`shift_log` is best-effort and its sums are lower bounds, permanently.** `appendShiftLog`
  swallows its insert error and shares no transaction with the profile UPDATE. Every consumer
  comment repeats this. Any new seeder or assertion must not present a `shift_log` figure as
  an audit of `wallet_balance`.

## Historical Context (from prior changes)

- `context/archive/2026-08-22-world-selection-screen/follow-ups/review-fixes.md` — FU-3
  (nav), FU-2 (`ShopArt`). Its sequencing notes ("land after F4 merges", "F4 owns
  `ShopArt.tsx`") are stale: all five source features are archived and `matmaverse-v2` is
  clean at `282d264` (C2 in `change.md`).
- `context/archive/2026-08-22-world-progression-stages/` — origin of `StageRail`, the
  `/app/growth` screen and `e2e/growth.spec.ts`. Its own plan-review found a contracted
  overflow assertion that could not catch the contracted risk (now L-004), which is why this
  document names a break *and* why the break is evidence for each item.
- `context/archive/2026-08-22-parent-weekly-activity-chart/` — origin of
  `WeeklyActivityChart`, the Σ invariant in `reports.ts`, and the recorded decision to skip a
  seeded-week e2e for want of a `shift_log` seeder (item 4's direct cause).
- `context/archive/2026-08-22-parent-security-screen/` — origin of the PIN throttle and K1.
- `context/changes/autonomous-run-follow-ups/change.md` — the ten-item table, corrections
  C1–C3, and AD-1…AD-5. **This document supersedes AD-4**: the Fix A / Fix B question is
  answered here, not left to the plan.

## Related Research

- `context/changes/remember-me-on-login/research.md` — F2's research, same run. Read for the
  contention table above; F2 owns the auth path.

## Open Questions

1. **Item 1's shape** — keep the `<h2>` + honest empty-state `<p>` (the `growth.astro`-local
   `noUnlocks` precedent, recommended), or guard heading-and-card together (the
   `start.astro` precedent). Both are in-repo and they disagree; the `<a>` stays either way.
   A product call the plan must make and record.
2. **Item 6's file shape** — rename `shop-art-slots.test.ts` → `.tsx` with a jsdom pragma, or
   add a sibling `shop-art-render.test.tsx`. Mechanical, but the plan should choose so the
   implementer does not.
3. **Item 8's test delta** — a DB-error branch is not reachable through
   `tests/profiles-world.test.ts` without stubbing. Either contract a `vi.spyOn(console, …)`
   test or declare the item test-free with the reason. Do not let the success criteria imply
   a delta this item cannot pay.
4. **Item 2's guard layer** — `StageRail` is `.astro` and cannot be rendered in jsdom, so the
   `role="img"` fix has no unit-test home. Contract the Playwright `getByRole("img", …)`
   assertion in `e2e/growth.spec.ts`, or accept `npm run check` + review and say so.
5. **Item 7's residual** — is documenting the two-layer split enough, or should the plan buy
   the one real gap (per-entry `href` correctness in the e2e loop)? The latter is a genuine
   coverage increase; the former is bookkeeping.
6. **`e2e/helpers/accounts.ts` ownership** — F1 and F2 both write it. The contention sweep's
   `ownership.md` decides and overrides this document.

## Autonomous decisions

No human is in the loop. `/10x-research` step 3 mandates `AskUserQuestion` to scope; step 4
mandates parallel `Task` sub-agents. Both were resolved here instead.

**AD-R1 — scope set from `change.md` + the backlog entry, not from a question.**
*Chosen:* research the **how**, per item — precedent, the assertion that bites, the
deliberate break and its meta-check — plus the two open cross-cutting questions (C1's
ripple, F2 contention). *Rejected:* re-deriving the ten-item verification table (already done
twice on disk; AD-2 is right that there is nothing left to find there), and a broad
architectural survey (the items name files and symbols; breadth would buy nothing).
**What would change the answer:** if plan-review finds a decision it cannot make from this
document, name the specific item and re-run research on that item alone.

**AD-R2 — no sub-agents; the research ran in this context.**
The `Task` tool is **not available** in this subagent (verified by `ToolSearch` for
`Task`/`Agent`/`Explore`: "No matching deferred tools found"). *Chosen:* run the seven
research areas myself in batched parallel `Bash`/`Read` calls. *Rejected:* reporting BLOCKED
— the skill's sub-agents are an efficiency mechanism, not a correctness one, and the source
run's failure mode was a research step that returned having written nothing. Nothing was left
"waiting"; every file cited here was opened in this step. **What would change the answer:**
a research scope too large for one context — then split by feature, not by sub-agent.

**AD-R3 — AD-4 is answered here rather than deferred to the plan.**
`change.md` deliberately left FU-3's Fix A vs Fix B to the planner. This step found the fact
that decides it: `e2e/growth.spec.ts` Risk E2E-F4-2 **already is Fix B**, running in both
Playwright projects. *Chosen:* recommend neither extraction nor a new e2e test, but a
documentation of the two-layer split plus the stale "Five entries" comment fix, with the
per-entry `href` gap offered as the only real coverage increase available. *Rejected:*
staying silent to preserve AD-4 — a plan that spends a phase extracting `src/data/nav.ts`
for duplicate coverage is exactly what research exists to prevent.
**What would change the answer:** if the plan wants `items`/`tabs` importable for a reason
other than this test (a second consumer, a route manifest), Fix A becomes worth its price on
those grounds — not on FU-3's.

**AD-R4 — no deliberate break was executed in this step.**
Every break named above is reasoned, not observed. *Why:* the agent contract confines
docs-lane steps to `context/changes/<change-id>/`; running a break means editing `src/` in
the main checkout, which is forbidden and would race F2. *Rejected:* running them anyway
(contract violation), and omitting break design entirely (it is what makes the plan's success
criteria checkable — L-004). Each break is written so the implementer can execute it verbatim
and is paired with why its redness is evidence for that specific claim.
**What would change the answer:** nothing at this step. The implement step runs them on its
own branch and records the observed result.

**AD-R5 — success criteria are stated as `baseline + delta`, and the baseline was
re-measured here.**
Observed in this step on `matmaverse-v2` @ `282d264`: `npm test` **429 / 51 files**,
`npx playwright test --list` **23 tests / 8 files**, `npm run lint` clean. These match the
run log and `change.md`, but they are observations, not inherited figures (rule 5). The plan
must re-measure on `feat/autonomous-run-follow-ups` before Phase 1 and never write an
absolute count (L-005). `npm run check` was also re-run here: **0 errors, 0 warnings, 9
hints (188 files)** — matching the intake pass, and observed rather than inherited.
**What would change the answer:** if the branch baseline differs from 429/23, the branch has
picked up work from elsewhere — stop and reconcile before planning a delta.
