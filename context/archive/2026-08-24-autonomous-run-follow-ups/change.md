---
change_id: autonomous-run-follow-ups
title: Close the ten triaged follow-ups from the 2026-08-22 autonomous run
status: archived
created: 2026-08-24
updated: 2026-08-24
archived_at: 2026-08-24
---

## Notes

Close the ten already-triaged follow-up items from the previous run's five
`follow-ups/review-fixes.md` files, each of which names a concrete file and symbol, so
the last run's verification debt is paid off.

Backlog entry: **H1** in `context/foundation/backlog.md`. Sources (all now archived):

| # | Source change | File it lives in |
|---|---------------|------------------|
| — | `dashboard-recent-activity` | `context/archive/2026-08-22-dashboard-recent-activity/follow-ups/review-fixes.md` |
| — | `parent-security-screen` | `context/archive/2026-08-22-parent-security-screen/follow-ups/review-fixes.md` |
| — | `parent-weekly-activity-chart` | `context/archive/2026-08-22-parent-weekly-activity-chart/follow-ups/review-fixes.md` |
| — | `world-progression-stages` | `context/archive/2026-08-22-world-progression-stages/follow-ups/review-fixes.md` |
| — | `world-selection-screen` | `context/archive/2026-08-22-world-selection-screen/follow-ups/review-fixes.md` |

---

### The ten items — every claim re-verified against this repo on 2026-08-24

Read the backlog's `[I]` warning as binding: what follows **replaces** H1's claims. Each
row was opened on disk on branch `matmaverse-v2` at `282d264`. Anchors are symbols, never
line numbers (L-006).

| # | File | Symbol / anchor | Claim | Verified? |
|---|------|-----------------|-------|-----------|
| 1 | `src/pages/app/growth.astro` | the `<section>` whose first child is `<h2>{t.start.nextUpgradeHeading}</h2>` | the `<h2>` sits **outside** the `{next && (…)}` guard that follows it, so a child owning every level-eligible upgrade sees "Następne ulepszenie" over an empty card | **TRUE** — the `<h2>` is the sibling immediately preceding `{next && (` |
| 2 | `src/components/child/StageRail.astro` | the three state-marker `<span>`s carrying `aria-label={t.growth.stageOrdinal.replace("{n}", …)}` (`done` / `current` / `locked`) | none of the three carries a `role`, so the label hangs on `role=generic` and is never announced; the file's own comment above them claims it is | **TRUE** — all three have `aria-label`, none has `role=` |
| 3 | `tests/weekly-report-tiles.test.tsx` | the single `daily:` fixture, `EMPTY_WEEK` | no committed test renders a non-zero chart beside a non-zero `statTasks` tile — `EMPTY_WEEK` (seven zeros) is the only `daily` any fixture passes | **TRUE** — exactly one `daily:` occurrence in the file, and it is `EMPTY_WEEK` |
| 4 | `e2e/helpers/accounts.ts` | a new `seedShiftWeek(profileId, counts)` beside `seedChildProfile` | no `shift_log` seeder exists; the one written during the last run was deleted before commit | **TRUE** — the file exports `admin`, `deleteUser`, `findUserIdByEmail`, `PASSWORD`, `provisionAccount`, `seedChildProfile`, `signInViaUI`, and nothing touching `shift_log` |
| 5 | `tests/worlds-picker.test.tsx` | the `hiddenInput(container, name)` helper | the helper roots at `container`, not at the `<form>`, and nothing asserts the form's `action` / `method` or the submit control's label — deleting the `<form>` wrapper leaves all seven tests green | **TRUE** — `container.querySelector('input[name=…]')`, no `form` reference anywhere in the file |
| 6 | `tests/shop-art-slots.test.ts` | add a render case; keep the four existing data assertions | the suite is data-only (four `it()` blocks over `WORLD_SLOTS`), so deleting the `WORLD_SLOTS[world.slug]?.` prefix inside `ShopArt` keeps it green | **TRUE** — no render, no jsdom pragma; the lookup lives in `ShopArt`'s `placed`/`unplaced` partition and its `style={…}` prop |
| 7 | `tests/nav-labels.test.ts` | `labels`, sourced from `t.nav.items`; `LIVE_E2E_STRINGS` | the suite guards the **dictionary**, not the nav — dropping an entry from `AppShell`'s `items` keeps it green | **TRUE** — `const labels = Object.values(t.nav.items)`; the file never imports `AppShell` |
| 8 | `src/pages/api/profiles/world.ts` | the `if (!("ok" in result))` branch | the DB-error branch is indistinguishable from a routine ownership bounce and leaves no server-side trace | **TRUE** — the branch redirects to `/app/worlds` with no logging |
| 9 | `src/components/child/WorldPicker.tsx` | the `t.worlds.learnHeading` `<p>` and the competency `<ul>` that follows it | `hidden … lg:block` removes the heading from the accessibility tree below `lg`, leaving the list unlabeled | **TRUE** — `className="text-foreground hidden text-sm font-extrabold lg:block"`, and the `<ul>` beneath has no `aria-label` |
| 10 | `docs/reference/contract-surfaces.md` | the `## Parent PIN routes (RLS surface)` section | K1 — the non-decaying `failed_attempts` counter — is not recorded in the durable doc | **TRUE** — the section exists; it documents gate order and `STATUS_FOR` but carries no limitation bullet. The underlying behaviour also verified: `register_pin_failure` (`supabase/migrations/20260702120000_pin_failure_throttle_rpc.sql`) only ever does `failed_attempts = s.failed_attempts + 1`; the only resets are a correct PIN and `setPin`, both in `src/lib/services/parent-pin.ts` |

**Ten for ten: every H1 claim held.** That is worth stating plainly, because the source run's
intake found three inherited claims false. This one found none — but it did find three
inherited **instructions** that cannot be followed as written. They are below.

---

### Corrections — inherited instructions that are wrong, stale, or misdirected

**C1 — FU-3's "lift/export the `items`/`tabs` arrays" is not possible as written.**
`world-selection-screen`'s FU-3 tells the implementer to export `items` and `tabs` from
`src/components/app/AppShell.astro` so `tests/nav-labels.test.ts` can import them. They are
`const`s in **Astro component frontmatter**, which Vitest cannot import — an `.astro` module
has no value exports. Fix A therefore requires **extracting the arrays into a plain `.ts`
module** (e.g. `src/data/nav.ts`) that `AppShell.astro` imports, which is a restructure of the
most-shared component in the app, not a test-only edit. The plan must price Fix A at that
cost, or take FU-3's Fix B (leave the unit test as an i18n guard, cover the real nav in the
`touch` Playwright project). This step does **not** pick between them — that is the plan's
call, and it is now an informed one.

**C2 — the two sequencing constraints in the source documents are stale.** FU-3 says "land
this **after** F4 merges" and FU-2 says "F4 owns `ShopArt.tsx`". All five source features are
merged and archived under `context/archive/2026-08-22-*`; `matmaverse-v2` is clean at
`282d264`. **No ownership or ordering constraint from the last run survives.** Do not
reproduce them in the plan.

**C3 — FU-4's cited logging precedent is the wrong file.** It names
`src/pages/api/account/delete.ts` "the precedent for discriminating the two service
outcomes". `delete.ts` around that point is the marker / `formData` gate and **contains no
logging at all**. The repo's actual logging convention is a `[route] message` prefix with a
structured second argument, and it has exactly two instances:
`console.error("[auth/reset] resetPasswordForEmail failed", {…})` in
`src/pages/api/auth/reset.ts` and `console.warn(…)` in `src/pages/api/auth/signup.ts`. Model
item 8 on those. The discrimination itself is free: `updateChildProfileTheme`
(`src/lib/services/child-profiles.ts`) returns `{ error } | { failure: "not-found" } | { ok: true }`,
so `"error" in result` is exact. Keep the redirect byte-identical — the route is deliberately
not an existence oracle (KR-1).

---

### Two verified facts the plan will need

- **`tests/shop-art-slots.test.ts`'s new assertion genuinely bites.** `WORLD_SLOTS.piekarnia.sign`
  is `{ left: "7%", top: "10%" }` and `DEFAULT_SLOTS.sign` is `{ left: "10%", top: "6%" }`
  (both in `src/components/child/ShopArt.tsx`). They differ on both axes, and `piekarnia` is a
  real slug (`src/data/worlds.ts`) with `sign` a real upgrade id (`src/data/upgrades.ts`). The
  FU-2 recipe is executable exactly as written.
- **The `/app/growth` mockup does not answer item 1's open question.**
  `assets/matmaverse-missing-screens-v3-web/01-world-progression-web.png` **exists on this
  machine** and was opened. It draws the "Następne ulepszenie" card with its "Zobacz
  ulepszenia" CTA *inside* the same card — but it depicts only the populated state, never the
  every-upgrade-owned one. So whether the CTA should survive `next === null` is a product
  decision the mockup cannot settle; `src/pages/app/start.astro` guards its whole card, which
  is the in-repo precedent. **Caveat:** `assets/` is gitignored, so a fresh clone, CI, or a
  cloud agent cannot re-open that PNG — any layout claim derived from it is unverifiable
  elsewhere and must be marked as such.
  **Nuance added on re-verification (the PNG was opened a second time, independently).** In the
  mockup "Następne ulepszenie" is a *section header with a puzzle icon, sitting outside the inner
  white panel* that holds the upgrade art, name, price, savings bar and the "Zobacz ulepszenia"
  CTA. That is the same structural relationship the code has today (`<h2>` outside `{next && (`),
  which means the mockup is **evidence against** simply deleting the `<h2>`, and **evidence for**
  either guarding the whole `<section>` (the `start.astro` precedent) or keeping the header and
  giving the panel an explicit empty-state body. It still shows no empty state, so it does not
  choose between those two. Any layout the plan proposes for `next === null` is an
  **explicit extrapolation** — the mockup does not depict it.

---

### Adjacent, verified, deliberately outside H1's ten

Recorded so the plan can fold them in cheaply if it wants, and so nobody re-derives them:

- `src/components/parent/WeeklyActivityChart.tsx` — `import React from "react";` on line 1 is
  still present and still dead (`tsconfig.json` sets `"jsx": "react-jsx"`). One line.
- `src/pages/app/growth.astro` — the `<div class="bg-muted mt-2 h-2 …">` savings bar inside the
  next-upgrade card still lacks `aria-hidden="true"`, which both other copies of that bar carry
  (`src/pages/app/start.astro`, `src/components/app/AppShell.astro`). Same file as item 1.
- `src/pages/app/growth.astro` — `world.name` is in the accessibility tree three times
  (`subtitle={world.name}` on the header, the hero `<p>{world.name}</p>`, and `ShopArt`'s
  `alt`). Same file as item 1.

The five source files hold roughly 28 non-blocking items in total; H1 selects ten. The
remainder stay where they are, in the archive, and are not lost.

---

### Baseline measured on this branch (L-005)

Observed on `matmaverse-v2` @ `282d264`, 2026-08-24, with the local Supabase stack up:

| Command | Result |
|---------|--------|
| `npm test` | **429 passed / 51 files** |
| `npx playwright test --list` | **23 tests / 8 files** |
| `npm run lint` | clean |
| `npm run check` | **0 errors, 0 warnings, 9 hints** (188 files) |

Success criteria in the plan must be written as `baseline + delta` against these numbers and
**re-measured on the feature branch**, never copied forward as absolutes.

**Every number above was re-measured from scratch during the re-verification pass** (the intake
step was re-dispatched after the orchestrating workflow died mid-flight; see AD-5). They are
observations, not inherited figures. The `npm run check` row is new — the first pass skipped it
on the grounds that nothing executable had changed, which is true but leaves the plan without a
`check` baseline to compare its own run against; it is recorded here so the implement step can.

---

## Autonomous decisions

This run has no human in the loop. `/10x-new` ends by telling the agent to stop and offer the
user a next command; instead the decisions are made here and recorded with their reversal
conditions.

**AD-1 — One change folder, one branch, but one commit per source feature.**
H1's stated open decision was "one change or per-feature follow-up commits". Chosen: a single
change folder (`autonomous-run-follow-ups`) on a single branch `feat/autonomous-run-follow-ups`
cut from `matmaverse-v2`, with the work **committed one commit per source feature**, subject-scoped
(`fix(world-selection-screen): …`, `fix(parent-weekly-activity-chart): …`, …).
*Rejected:* five separate change folders — five plan + plan-review + impl-review cycles for ten
edits, where the ceremony costs more than the work and no item is large enough to justify it.
*Also rejected:* one squashed commit — it erases which review raised which item, which is the
entire value the per-feature option was protecting.
*Why this splits the difference:* the audit trail the maintainer wants lives in commit subjects,
which `git log --grep` reaches, and the review cost is paid once.
**What would change the answer:** if any item turns out to need a Supabase migration or a schema
change, pull that item into its own change — `supabase/migrations/` is a serialized lane and must
not ride along inside a follow-ups branch. Nothing in the verified ten needs one today.

**AD-2 — Next step is `/10x-plan`, not `/10x-research`.**
Every one of the ten items names a file and a symbol, and this step opened all ten on disk and
confirmed them. There is no unknown left for research to find.
*Rejected:* `/10x-research` — it would spend a full agent re-deriving the table above.
*Also rejected:* `/10x-frame` — framing is not in doubt; these are findings already triaged as
non-blocking by five implementation reviews, not a bug paired with a self-diagnosed fix.
**What would change the answer:** if the planner finds that C1's nav extraction ripples beyond
`AppShell.astro` plus one new `.ts` module (for instance if other components or e2e specs read
those arrays), research that single item rather than planning it blind.

**AD-3 — Scope held at H1's ten; three adjacent items recorded, not adopted.**
The brief says close the ten. The three adjacent items above are verified, trivial, and land in
files two of the ten already open — but expanding scope inside an intake step is how a
follow-ups change becomes a second feature.
*Rejected:* adopting them silently into the ten (scope creep with no record) and dropping them
entirely (they would be re-derived by whoever next opens `growth.astro`).
**What would change the answer:** the plan may fold any of the three in, as long as it says so
under its own decisions and the count in its success criteria moves with them.

**AD-4 — FU-3's Fix A vs Fix B is left to the plan.**
This step establishes only that Fix A costs an extraction into a new `.ts` module (C1), not that
it is wrong. Choosing between a restructure of the shared shell and a Playwright-side guard is a
design call that belongs in `plan.md` with the alternatives written out.
**What would change the answer:** nothing at this step — but if the plan does not choose
explicitly, plan-review should send it back rather than let the implementer decide at the keyboard.

**AD-5 — the re-dispatched intake re-verified the predecessor's work rather than re-writing it.**
This intake step ran twice: the orchestrating workflow died at a session boundary while F1's
`/10x-new` was in flight, and the step was re-dispatched with `change.md` and `handoff.md`
already on disk. `/10x-new`'s own uniqueness check would refuse to proceed (`context/changes/
autonomous-run-follow-ups/` exists), so following the skill literally means stopping with an
error. Chosen: treat the folder as a predecessor's work and apply the agent contract's rule 5
("verify, do not inherit") — re-open all ten items, all three corrections, both facts and all
three adjacent items on disk, and re-run the suites, then correct what is wrong in place.
*Rejected:* deleting the folder and starting clean — it would discard a correct, expensive
artifact and re-derive it identically. *Also rejected:* declaring the step already complete on
the strength of the existing handoff — that is exactly the inherited green rule 5 forbids.
**What the re-verification found:** ten of ten items still true; C1, C2 and C3 all still true;
both plan-facing facts true; all three adjacent items true. Three corrections were applied:
the commit was `282d264`, not `08add5f` (that is its parent — the difference is only
`e2e/CLAUDE.md`, so no claim moved); a `npm run check` baseline was added; and the mockup bullet
gained the structural nuance above, which changes which of item 1's two fixes the mockup
supports. **What would change the answer:** if a future re-dispatch finds the predecessor's
claims diverging from disk, the folder is stale rather than merely interrupted, and the intake
should be redone rather than patched.
