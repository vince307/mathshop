# "Ostatnia aktywność" Feed on the Child Dashboard — Implementation Plan

> Change: `dashboard-recent-activity` (F2 of the 2026-08-22 autonomous run)
> Research (ground truth): `context/changes/dashboard-recent-activity/research.md`
> Standing brief: `context/runs/2026-08-22-autonomous-five/agent-contract.md`
> Brief (read first): `context/changes/dashboard-recent-activity/plan-brief.md`

## Overview

Add an **"Ostatnia aktywność"** section to the child dashboard (`/app/start`): a newest-first
list of what the child actually did — completed shifts and upgrade purchases — read from the
rows `shift_log` already stores. No migration, no API route, no React island, no new
dependency. The section is drawn in the web mockup
(`assets/matmaverse-ui-v2-web/02-child-dashboard-web.png`, bottom of the main column) and is
**absent from the mobile mockup**, so its phone treatment is an explicit extrapolation
recorded below.

## Current State Analysis

Everything load-bearing is established in `research.md`; this is the short form.

- **`shift_log` has five columns** (`supabase/migrations/20260701150000_create_shift_log.sql:22-34`):
  `id`, `account_id`, `profile_id`, `created_at`, `skills jsonb not null`,
  `upgrade_purchased text null`. `upgrade_purchased` is the **only** discriminator; `skills`
  is `not null` on both kinds (a purchase row carries the fixed
  `{ decisions: { firstTryCorrect: 1, completed: 1, misses: 0 } }`), so the jsonb keys are a
  hint and never a discriminator.
- **There is no earnings/money/amount column.** The mockup's `+12 zł` / `-50 zł` has no
  backing store. Earnings are re-derivable from `EARN_PER_TASK` / `EARN_PER_CLEAN`
  (`src/data/shift.ts:33-35, 84-86`), but those constants are documented as tunable, so a
  re-derived amount silently re-prices history (research §5.2).
- **RLS on `shift_log` is account-scoped, not profile-scoped**
  (`…create_shift_log.sql:38-64`): a signed-in parent can read every child's rows on the
  account. Any per-child query **must** carry its own `.eq("profile_id", …)`.
- **Nothing in `src/lib/services/` returns raw `shift_log` rows.** The only read is
  `getWeeklyReport` (`src/lib/services/reports.ts:102-115`) — ascending, no `.limit()`,
  selects neither `id` nor `created_at`, returns an aggregate.
- **The write is best-effort and un-transactional.** `appendShiftLog`
  (`src/lib/services/child-profiles.ts:120-137`) swallows its error; the profile UPDATE has
  already committed. The feed can legitimately be missing an event that happened.
- **The dashboard is SSR-frontmatter-fetched with exactly one prop-less island**
  (`src/pages/app/start.astro:28-70`, `StartShiftButton client:load` at `:168`). The
  `/app/task` hydration lesson generalises: any non-determinism — `new Date()`, a relative
  time string — must be resolved in the frontmatter.
- **Layout** (`start.astro:90`): one grid, three children. Block B (`:139`) is
  `order-last … lg:order-none lg:col-span-2 lg:col-start-1 lg:row-start-2` and holds
  `SkillCards` + the results tiles.
- **No date machinery exists** beyond `reports.ts`'s three private/one exported Warsaw
  helpers (`:50-92`). No date library, no `Intl.RelativeTimeFormat`, no `toLocale*` anywhere.
- **Nothing exists for lists/feeds in `src/components/ui/`.** The child-surface primitive is
  the class-builder `childCard()` (`src/components/child/childCard.ts:10`); the structural
  precedent is `SkillCards.astro:28-30` (`<section>` + `<h2 class="text-foreground text-lg font-bold lg:text-xl">` + `<ul>`).

## Desired End State

On `/app/start`, below "Twój sklep — wyniki" in the main column, a section headed
**"Ostatnia aktywność"** lists up to three of the child's most recent events, newest first:

- a completed shift → **`Zmiana ukończona · 5 zadań`** (green circular badge with a check),
- an upgrade purchase → **`Ulepszenie: Szyld`** (blue circular badge with an up-arrow),

each with a second, muted line reading `Dzisiaj`, `Wczoraj`, or a `DD.MM` Warsaw date. Three
across at `lg`+ (as drawn), stacked one-per-row below `lg`. A profile with no rows sees the
heading plus one muted empty line; a query failure sees the heading plus a distinct error
line, and the rest of the dashboard renders normally.

**Verify by:** `npm run lint` clean, `npm test` ≥ 299 + the new suites, `npx playwright test`
**15/15, unchanged** (13 desktop + 2 touch — this change adds assertions to existing
tests, not new test cases), and a manual pass of `/app/start` at 390px
and 1280px on a profile that has completed a shift and bought an upgrade.

### Key Discoveries

- `upgrade_purchased !== null` is the discriminator; branch on it, never on `skills` keys
  (research §2.4).
- The `(profile_id, created_at)` index (`…create_shift_log.sql:118`) already covers a
  newest-first per-profile feed query exactly — **no new index**.
- `upgradeCopy(id)` (`src/i18n/index.ts:34-36`) already resolves a catalog id to Polish copy
  with a guarded fallback to the raw id. Do not write a third resolver.
- `charsNeeded` (`src/i18n/index.ts:11-27`) is the project's precedent for Polish plural
  forms: an `Intl.PluralRules("pl")` + `Record<Intl.LDMLPluralRule, string>` table.
- `getByText` matches **substrings**; the parity change already broke
  `getByText('Portfel')` once. The blacklist and the collision audit are in
  "Critical Implementation Details" below.
- All six upgrade SVGs already exist in `public/illustrations/` — **no new art crop, no
  `slice-map.md` entry.** Feed icons are lucide, per the contract's artwork rule.

## What We're NOT Doing

- **No money figure on any row** — not re-derived shift earnings, not the catalog upgrade
  cost. See Autonomous decision **D1**.
- **No `Zobacz wszystkie ›` link** — no destination route exists (D3).
- **No `Sprzedaż: Cappuccino` row** — products do not exist as an entity; `shop_state` holds
  only `{ purchased: string[] }`. Two entry kinds, not three (D4).
- **No migration, no RLS change, no new index, no API route, no React island, no new npm
  dependency, no `data-testid`.**
- **No `src/types.ts` change** and **no edit to `tests/reports.test.ts`** — both are files F1
  may be touching concurrently (D5).
- **No restructure, rename or reformat of anything already in `src/lib/services/reports.ts`.**
  `listRecentActivity` and its row interface are appended; the existing 115 lines are not
  reflowed (D5).
- **No "N dni temu" / relative time** anywhere (D6).
- No history/"all activity" screen, no pagination, no filtering, no per-competency split on
  a shift row.

## Implementation Approach

Four small, independently committable phases, ordered so each one is green on its own:

1. **Pure core + copy** — a dependency-free `src/data/activity.ts` (Warsaw day bucketing +
   row→entry mapping), the `tasksDone(n)` Polish plural helper, and the eight new dictionary
   keys. Fully unit-tested with no browser and no DB.
2. **The scoped query** — `listRecentActivity` appended to `reports.ts`, plus a unit suite
   (error contract, its own chain stub) and an integration suite that fails if the
   `.eq("profile_id", …)` filter is dropped.
3. **The section** — `RecentActivity.astro` rendered from `start.astro`'s frontmatter inside
   block B, with the try/catch error posture.
4. **E2E** — empty state asserted in `seed.spec.ts`, populated feed asserted in
   `gameplay-restore.spec.ts` (which runs in **both** projects, so it covers the 712px
   reflow too).

## Critical Implementation Details

**Warsaw "yesterday" must not be computed by subtracting 24 hours.** Europe/Warsaw has a
25-hour day each October; on that day, `now − 86_400_000` at a late hour lands back on the
*same* calendar day (Sunday 23:59 CET → 22:59 UTC → −24h → 22:59 UTC Saturday → 00:59 CEST
**Sunday**). Derive today's Warsaw calendar key first, then step the *key* back one day with
plain UTC calendar arithmetic — no timezone involved in the step:

```ts
// key is "YYYY-MM-DD" in Europe/Warsaw civil time
function previousDayKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1)); // pure calendar step, DST-free
  return `${prev.getUTCFullYear()}-${pad2(prev.getUTCMonth() + 1)}-${pad2(prev.getUTCDate())}`;
}
```

Build the Warsaw key itself from `Intl.DateTimeFormat` **`formatToParts`** (assembling
`year`/`month`/`day` yourself) rather than trusting a locale's `format()` string shape.
This whole approach sidesteps `reports.ts`'s private `zoneOffsetMinutes` DST arithmetic
rather than duplicating it — comparing civil-date strings needs no offset maths at all.

**Substring-collision audit (mandatory — this has broken a test in this project before).**
Existing `/app/start` locators and their strings:

| file:line | locator | string |
|---|---|---|
| `e2e/seed.spec.ts:28` | `getByRole("heading", …)` | `Cześć, {name}!` |
| `e2e/seed.spec.ts:29` | **`getByText`** | **`Portfel`** |
| `e2e/onboarding.spec.ts:84` | `getByRole("heading", …)` | `Cześć, {name}!` |
| `e2e/gameplay-restore.spec.ts:31` | `getByRole("button", …)` | `Czas otworzyć sklep!` |
| `e2e/gameplay-restore.spec.ts:55` | `getByRole("link", …)` | `Rozbuduj sklep` |
| `e2e/gameplay-restore.spec.ts:105, :126` | `getByRole("heading", …)` | `Cześć, {name}!` |

Every chosen label was checked against `portfel` / `rozbuduj sklep` / `czas otworzyć sklep!` /
`cześć,` in both directions and collides with none. Two near-misses that shaped the wording,
both of which the implementer must preserve:

- **`Ukończone zmiany`** (`t.start.statShifts`, the results tile on the same page) — an
  empty-state sentence containing that exact phrase would double-match a
  `getByText(t.start.statShifts)`. The empty string is worded `"…Twoje zmiany i ulepszenia…"`
  (no `Ukończone`) and the shift label is `Zmiana ukończona` (different word order) for
  exactly this reason. Do not "tidy" either into `Ukończone zmiany`.
- **`Dzisiaj`** is a substring of `t.start.missionHeading` (`"Dzisiaj nauczysz się"`), already
  on this page, and the feed itself can render it twice. **Never assert
  `getByText(t.start.activityToday)`** — it is a guaranteed strict-mode failure. It is safe to
  *render*; only asserting it is forbidden.

**Ordering has no tie-breaker and does not need one.** `created_at` defaults to `now()`, which
is transaction-start time; the two writers run in separate HTTP round-trips, so two rows can
never share a timestamp. A single `.order("created_at", { ascending: false })` keeps the
`(profile_id, created_at)` index covering the query exactly.

## Autonomous decisions

This step ran inside `context/runs/2026-08-22-autonomous-five/` (hard rule 1: never call
`AskUserQuestion`). The `/10x-plan` skill's complexity confirmation and every clarifying
round were **decided, not asked**. Complexity was self-assessed **MEDIUM** (four files of new
code, one shared file, one design gap, a concurrency constraint, no schema change). Below,
each of the research doc's eight open questions is closed, with what would reverse it.

### D1 — Entry labels carry no money figure (research Q1)

**Decided:** a shift row reads `Zmiana ukończona · {N} zadań`, where `N =
skills.math.completed + skills.money.completed` read through `readSkillState`; when `N === 0`
it degrades to the bare `Zmiana ukończona`. A purchase row reads `Ulepszenie: {name}` via
`upgradeCopy(id)`. **Neither kind shows a `zł` amount.** The mockup's right-hand coloured
amount slot is dropped; the shift's task count is appended to line 1 so no card has a visibly
empty column.

**Rejected — re-deriving shift earnings** from `EARN_PER_TASK`/`EARN_PER_CLEAN`. Research §5.2
is right and I could not defeat it: those constants are documented tunable first guesses, so a
re-derived `+12 zł` would silently re-price every historical row the moment they change, and a
displayed amount that was never the amount credited is invented data with extra steps.

**Rejected — money on purchase rows only** (`getUpgrade(id).cost`), which research graded
"defensible". Two reasons. First, `cost` is the *current* catalog price, not the price
actually paid — a tuned cost re-prices history in exactly the same way earn-rates do, only
more slowly; it is the same defect, weaker. Second, it creates an asymmetry — a `zł` figure on
one row kind and a blank on the other — which to a 6–9-year-old reads as a bug, not as a
distinction. Symmetry is worth more here than a half-truthful number.

**What reverses it:** F4 (`context/changes/world-progression-stages/`) adding a persisted
earnings column to `shift_log`. At that point both kinds carry a real stored integer and the
mockup's coloured amount ships truthfully — a purely additive change to
`toActivityEntry` + the card's right slot.

### D2 — Below `lg` the section stacks; it is not gated away (research Q2)

**Decided:** the entry `<ul>` is `grid gap-3 lg:grid-cols-3` — **one card per row below
`lg`, three across at `lg`+** (the mockup's layout). The section renders at every viewport;
nothing is `lg:`-hidden.

**This is an extrapolation, not a mockup.** `assets/matmaverse-ui-v2-mobile/02-child-dashboard-mobile.png`
draws no "Ostatnia aktywność" section at all (research §6.2). Stated plainly so the maintainer
can overrule it cheaply: the entire mobile treatment is one Tailwind class string on one
element, and reverting to desktop-only is a one-line `hidden lg:block` on the wrapper.

**Rejected — `lg:`-gating the section to desktop.** It would be the page's first
viewport-dependent *content*, it puts zero copies of the heading in the `touch` project's
a11y tree (Galaxy Tab S4, 712px — below `lg`), and it would make every e2e assertion about
this feature project-specific.

**Correction applied at plan review (F3):** an earlier draft of this decision claimed
"stacking is also what every other multi-column row on this dashboard already does". That is
**false**. Both sibling rows in the same column go multi-column at `sm` (640px), not `lg`
(1024px): `SkillCards.astro` uses `grid gap-4 sm:grid-cols-3` and the results tiles at
`start.astro:145` use `grid grid-cols-2 gap-4 sm:grid-cols-4`. With `lg:grid-cols-3` the feed
is the only 1-across row on the page at the `touch` project's 712px. `lg:` is still a
defensible choice (the entry labels are far longer than a stat tile's), but it is a
deliberate deviation from the page's own breakpoint, not a continuation of it — see
`## Known risks` R3.

**Placement:** the section is **nested inside block B** (`start.astro:139`, the
`order-last … lg:col-span-2 lg:row-start-2` flex column), appended after the results
`<section>`. It inherits block B's `order-last` so it stays last on mobile, and simply
extends that column downward at `lg` — which is exactly where the mockup draws it, under
"Twój sklep — wyniki". **Rejected** the naive fourth grid sibling with
`lg:col-span-2 lg:col-start-1 lg:row-start-3`: correct at `lg`, but on mobile it renders
*before* block B (which is `order-last`), i.e. hero → rail → feed → skills/results.

**Reversed by:** a mobile mockup arriving that draws the section differently.

### D3 — `Zobacz wszystkie ›` is omitted (research Q3)

**Decided:** the heading row is the `<h2>` alone, matching `t.skills.heading` and
`t.start.resultsHeading`, neither of which carries a trailing link. No route lists all
activity, and the run's *no dead navigation* rule ships a nav entry with its screen, never
before it. The header row reads correctly without it — the two sibling section headings on
the same page are already bare `<h2>`s, so its absence is consistent rather than conspicuous.

**Reversed by:** an activity-history route shipping. The link is then one `<a>` in the
section header plus one dictionary key.

### D4 — Two entry kinds, the sale row is simply not rendered (research Q4)

**Decided confirmed:** `Sprzedaż: Cappuccino` is not rendered and nothing is substituted for
it. Products do not exist as an entity — `shop_state` is `{ purchased: string[] }` and named
products are backlog item B2 in `context/changes/web-shell-and-mockup-parity/handoff.md:166-174`.
The feed therefore has two kinds. `limit` stays **3** (the mockup's count), so a child who
has done three shifts fills all three slots; the mockup's mix of kinds was illustrative, not
a quota.

**Rejected** substituting a third card kind (e.g. a level-up) to preserve the drawn variety —
that is invented data by another route.

**Reversed by:** B2 shipping named products with a per-sale log row.

### D5 — F1 contention: additive only, and a private day helper (research Q5)

**F1 (`context/changes/parent-weekly-activity-chart/`) is being planned in parallel and its
handoff names `src/lib/services/reports.ts` as the file to extend.** That is the one file both
features touch. F1's research (completed after this plan's research, and read while writing
this section) makes the overlap concrete rather than speculative — F1 will:

- **add `created_at` to `ShiftLogRow` and to `getWeeklyReport`'s `.select()`** (its finding 2)
  — edits to existing lines *above* where `listRecentActivity` is appended;
- **export `REPORT_TIME_ZONE` and `zoneOffsetMinutes`**, which are module-private today (its
  finding 5) — again, edits above;
- **edit `tests/reports.test.ts`** at `:13-15`, `:39`, and the `stubClient` at `:18-26` (its
  finding 8).

That third point converts D8 from a preference into a necessity.

**Decided:**

1. **`reports.ts` gets exactly two new top-level symbols, appended at the end of the file:**
   the `RecentActivityRow` interface and the `listRecentActivity` function. **Nothing existing
   is moved, renamed, reordered, reformatted, or re-exported** — in particular this change does
   *not* export `REPORT_TIME_ZONE` / `zoneOffsetMinutes` (F1 does that) and does not touch
   `ShiftLogRow`, `startOfWeek`, `getWeeklyReport` or `aggregateWeeklyReport`. The implementer
   should expect to **rebase onto F1 rather than resolve a conflict blindly**; an append-only
   diff at the tail of the file rebases cleanly against the edits F1 makes above it.
   **Do not "simplify" by reusing `ShiftLogRow`** once F1 has added `created_at` to it: the
   feed also needs `id`, and sharing the interface couples two independently-evolving queries
   for the sake of one field.
2. **The day bucketing does NOT live in `reports.ts` and does not export or reuse its Warsaw
   helpers.** It lives in a new, dependency-free `src/data/activity.ts` and compares
   Warsaw *civil-date strings*, which needs no UTC-offset arithmetic at all — so nothing is
   duplicated except the literal `"Europe/Warsaw"`, a constant rather than logic.
3. **`tests/reports.test.ts` is not edited** (see D8), and **`src/types.ts` is not edited** —
   `RecentActivityRow` is a DB-row shape and belongs beside its query per the two-tier
   convention (research §4.3), and the presentational entry type lives in `src/data/activity.ts`.
   Both files are plausible F1 targets; keeping out of them removes two more conflict surfaces.
4. `docs/reference/contract-surfaces.md` needs a one-line "Consumed by" / "Isolation test"
   update on the `public.shift_log` surface. F1 may edit the same block — keep the edit to
   appending names inside the existing lines.

**Verified at plan review (F5) — and two residual collision points this decision does not
remove.** `context/changes/parent-weekly-activity-chart/` contains `change.md`
(`status: preparing`), `research.md` and `handoff.md` — **there is no `plan.md` yet**. Every
statement above about what F1 will do is therefore projected from F1's *research*, not from a
written plan, and may shift. Two concrete places where "append-only rebases cleanly" is not
guaranteed, both recorded in `## Known risks` R1/R2:

- **`src/lib/services/reports.ts`, end of file.** F2 appends `RecentActivityRow` +
  `listRecentActivity` after the current line 115. F1's research finding 2 describes the
  chart's day bucketing as "a second fold over the array already in hand" — a new pure
  function that would most naturally be appended to this same file, next to
  `aggregateWeeklyReport`. If both features append at EOF, git conflicts **in the same hunk**;
  the claim only holds against F1's edits *above* the append point (`ShiftLogRow` at `:13-16`,
  the `.select()` at `:109`, exporting `REPORT_TIME_ZONE` / `zoneOffsetMinutes` at `:50`/`:55`).
- **`docs/reference/contract-surfaces.md`, `## public.shift_log`.** F2 appends to the
  **Consumed by** line (`:38`) and the **Isolation test** line (`:39`). F1 changes what
  `getWeeklyReport` selects, so it plausibly edits the **Columns** line (`:34`) *and the same
  Consumed by line*. Same-line conflict.

Everything else checks out: F2's file list touches neither `tests/reports.test.ts` nor
`src/types.ts`, and `ACTIVITY_TIME_ZONE` living in a new `src/data/activity.ts` cannot collide
with F1 exporting `REPORT_TIME_ZONE` from `reports.ts`.

**Rejected — waiting for F1 to land.** The two features are independent at every level except
one file, and serialising them costs a whole step for a conflict that append-only editing
avoids. **Rejected — extracting the Warsaw helpers into a shared module now**: that is exactly
the restructuring of `reports.ts` that would collide with F1 head-on.

**Reversed by:** F1 landing first and exporting `REPORT_TIME_ZONE` — which its research says it
will. At that point `src/data/activity.ts` can import the constant instead of declaring its
own, a one-line follow-up. Note this is a *constant* dedupe only: `zoneOffsetMinutes` stays
unused here, because civil-date-string comparison needs no offset maths. Not a blocker either
way, and deliberately **not** done in this change — importing from `reports.ts` would make
`src/data/activity.ts` depend on a service module and break its dependency-free posture.

### D6 — Day words, and what happens past yesterday (research §6.1, brief requirement)

**Decided:** `Dzisiaj` / `Wczoraj` as drawn, computed against the **Europe/Warsaw calendar
day**, not a millisecond delta (23:30 yesterday and 00:30 today are one hour apart and are
different days). **Anything older renders as a numeric Warsaw date, `DD.MM`** (e.g. `19.08`).

Reasoning: with `limit = 3` an older row is uncommon but a returning child after a break must
not see a vague or wrong label, and a bare card with no time reads as broken. `DD.MM` is
short, unambiguous, needs no plural forms, and is assembled from the same civil-date key the
bucketing already computes — so it adds no new machinery.

**Rejected — `Intl.RelativeTimeFormat("pl")` / "2 dni temu".** The mockup never shows relative
time on this screen; relative strings are non-deterministic at render and are the exact hazard
the `/app/task` hydration fix was about; and Polish day plurals would need their own form
table for no gain.

**Every one of these strings is computed in `start.astro`'s frontmatter** (via the pure helper),
never in an island, and is therefore fixed at render time and will not tick. That is correct
and intended.

**Reversed by:** a design decision to show clock-level recency, which would require revisiting
the SSR/caching story first.

### D7 — Empty is empty, errors are visible, and the dashboard never fails on the feed (research Q6, Q7)

**Decided, three parts:**

1. **Limit is 3**, from the mockup.
2. **`listRecentActivity` throws on a query error**, copying `getWeeklyReport`'s documented
   posture (`reports.ts:97-100`) so a DB failure can never masquerade as "nothing happened
   yet". **Rejected** swallow-to-empty: on this surface, "you have not played yet" and "we
   could not load it" must look different to the child.
3. **`start.astro` wraps the call in try/catch.** On success it passes the entries; on error it
   passes `null` and the section renders `t.start.activityError` under its heading. **The rest
   of the dashboard renders normally either way** — the feed can never take the page down.
   This is the same shape as `src/pages/app/report.astro:35-42` (catch per child, honest error
   card), scoped to a section instead of a page.

**On the best-effort write path** (`appendShiftLog` swallows its error, no transaction with the
profile UPDATE): the feed may legitimately be missing an event that happened. The consequence
is deliberately **nothing** — the feed shows fewer or older entries and says nothing about
totals. It must never be presented as a reconciliation of `wallet_balance` or
`completed_shift_count`, and the copy is written so it cannot be read that way (no counts of
"all" anything, empty state phrased forward-looking). The implementer must carry this as a
comment on `listRecentActivity` so a future reader does not try to reconcile the two stores.

**Empty state:** the heading still renders, with one muted line — mirroring
`report.noPractice` / `upgradeShop.emptyAffordable`. This also keeps the section's a11y tree
stable for a brand-new profile, which is what `seed.spec.ts` and `onboarding.spec.ts` land on.

**Reversed by:** nothing likely; if the error line proves noisy in practice the fallback is to
render the empty state on error, which is a one-line change and a strictly worse contract.

### D8 — A new test file with its own stub; `tests/reports.test.ts` is untouched (research Q8)

**Decided:** the unit tests for `listRecentActivity` live in a **new** `tests/recent-activity.test.ts`
with its own **thenable** chain stub (every chain method returns the chain; a `then` on the
chain resolves the result), so the terminal call can be `.limit()`, `.order()`, or anything
else without the stub caring.

**Rejected — generalising the existing `stubClient` in `tests/reports.test.ts:17-26`.** Its
terminal `await` lands on `.order`, so a `.limit()` query needs it changed — and F1's research
states outright that F1 edits that stub and the `ShiftLogRow` fixtures around it. A
shared-stub refactor is precisely the merge conflict D5 exists to avoid, and it would put the
12 existing report tests at risk for the sake of deduplicating six lines.

**Reversed by:** F1 landing its generalised stub first — then this file can import it and drop
its local copy, as cleanup.

### D9 — The isolation test that would catch a missing `profile_id` filter (brief requirement)

**Decided:** a new integration suite `tests/recent-activity-isolation.test.ts` seeds **two
child profiles inside ONE account** and asserts `listRecentActivity(client, profileA)` returns
only profile A's row.

This is the load-bearing shape: RLS is account-scoped, so **both rows are legitimately
readable by that one client** and no policy can catch the bug. Delete the
`.eq("profile_id", …)` line and this test fails; delete it and every existing isolation suite
still passes. A cross-account probe (account B reading A's profile id → empty array) is added
as a second case so the account boundary stays pinned through this surface too, following
`tests/report-isolation.test.ts:42-66` (seed through the account's own client, positive
control + non-owner probe; `admin` only provisions).

**Rejected** relying on `tests/shift-log-isolation.test.ts` — it is table-level RLS and is
blind to this bug by construction.

---

## Phase 1: Pure core + Polish copy

### Overview

Everything the feed needs that touches neither the database nor the DOM: Warsaw day bucketing,
row→entry mapping, the Polish plural helper, and the dictionary keys. Fully unit-tested,
browser-free, DB-free. Commits and stands alone.

### Changes Required

#### 1. The pure activity core

**File**: `src/data/activity.ts` (new)

**Intent**: Turn a raw `shift_log` row plus a `now` instant into everything the UI needs to
draw one card, with zero i18n/React/Supabase imports — mirroring the dependency-free posture
of `src/data/shift.ts` / `src/data/skills.ts` so it is unit-testable without a browser.

**Contract**:
- `ACTIVITY_TIME_ZONE = "Europe/Warsaw"` — the civil-time anchor (same audience zone
  `REPORT_TIME_ZONE` names; deliberately a separate constant, see D5).
- `warsawDayKey(instant: Date): string` → `"YYYY-MM-DD"`, assembled from
  `Intl.DateTimeFormat(…, { timeZone: ACTIVITY_TIME_ZONE, year, month, day }).formatToParts`.
- `type ActivityDayBucket = "today" | "yesterday" | "older"`.
- `type ActivityKind = "shift" | "purchase"`.
- `interface ActivityEntry { kind: ActivityKind; upgradeId: string | null; taskCount: number; bucket: ActivityDayBucket; dayMonth: string }` —
  `dayMonth` is `"DD.MM"`, meaningful only when `bucket === "older"`.
- `toActivityEntry(row: { created_at: string; skills: unknown; upgrade_purchased: string | null }, now: Date): ActivityEntry` —
  `kind` from `upgrade_purchased !== null` **only** (never from the `skills` keys);
  `taskCount` from `readSkillState(row.skills)` as `math.completed + money.completed`
  (0 for a purchase row, which is never displayed).
- **Yesterday is a calendar step on the key, not a −24h subtraction** — see "Critical
  Implementation Details" for the reason and the shape.

#### 2. The Polish plural helper for task counts

**File**: `src/i18n/index.ts`

**Intent**: Give the shift label a grammatical task count ("1 zadanie" / "2 zadania" /
"5 zadań") the same way the sign-up hint already does, so the component carries no literal
copy (L-003) and the form selection is unit-testable.

**Contract**: `export function tasksDone(n: number): string` → `"5 zadań"`. Implemented on the
exact `charsNeeded` pattern (`:11-27`): a module-level
`Record<Intl.LDMLPluralRule, string>` (`one: "zadanie"`, `two`/`few`: `"zadania"`,
`zero`/`many`: `"zadań"`, `other`: `"zadania"`) selected by the existing `polishPlural`
instance. Reuse that instance; do not construct a second `Intl.PluralRules`.

#### 3. Dictionary keys

**File**: `src/i18n/pl.ts`

**Intent**: All eight user-visible strings for the section, as their own commented sub-block
appended inside `start: { … }` after `safetyBody` (`:213`), matching the block's existing
`…Heading` / flat-camelCase / `{placeholder}` conventions.

**Contract** — exactly these keys and values:

| key | value |
|---|---|
| `activityHeading` | `Ostatnia aktywność` |
| `activityShift` | `Zmiana ukończona` |
| `activityShiftTasks` | `Zmiana ukończona · {tasks}` |
| `activityUpgrade` | `Ulepszenie: {name}` |
| `activityToday` | `Dzisiaj` |
| `activityYesterday` | `Wczoraj` |
| `activityEmpty` | `Jeszcze nic tu nie ma. Twoje zmiany i ulepszenia pojawią się w tym miejscu.` |
| `activityError` | `Nie udało się wczytać ostatniej aktywności.` |

`activityShiftTasks` deliberately **contains** `activityShift` as a prefix so one e2e locator
matches both the counted and the degenerate form. Do not reword either without redoing the
collision audit above. The sub-block comment should record, in one line, that no `zł` amount
is shown because `shift_log` stores no earnings (D1) — the block above it already carries the
project's twin reminder at `:207-209`.

#### 4. Unit tests

**File**: `tests/activity.test.ts` (new)

**Intent**: Pin the pure core's two hazards — the discriminator and the DST-correct day
bucketing — so a regression is a red test, not a wrong label in production.

**Contract**: covers, at minimum —
- a shift row (`upgrade_purchased: null`, `skills` with math+money) → `kind: "shift"`, correct
  `taskCount`;
- a purchase row carrying the fixed `{ decisions: … }` payload → `kind: "purchase"`,
  `upgradeId` set (**this is the test that fails if someone branches on the jsonb keys**);
- a row with garbage/missing `skills` → `taskCount: 0`, no throw (via `readSkillState`);
- `bucket: "today"` for an instant on the same Warsaw calendar day but a different UTC day
  (e.g. 23:30 Warsaw);
- `bucket: "yesterday"` across a Warsaw midnight that is *not* 24 h earlier;
- **the DST fall-back regression**: `now` late on the 25-hour October Sunday, with a row from
  the true previous day, still buckets `"yesterday"` — a naive `now − 86_400_000`
  implementation fails this case;
- `bucket: "older"` → `dayMonth` formatted `DD.MM` with a zero-padded single-digit day/month.

**File**: `tests/i18n-helpers.test.ts` (extend)

**Intent**: Cover `tasksDone`'s form selection alongside the existing `charsNeeded` suite.

**Contract**: one new `describe` asserting `1 → "1 zadanie"`, `2`/`4 → "zadania"`,
`5`/`12 → "zadań"`, `22 → "zadania"` (the x2–x4-above-20 case the existing suite already
treats as load-bearing), and `0 → "0 zadań"`.

### Success Criteria

#### Automated Verification

- Linting passes: `npm run lint`
- Unit tests pass and the count has grown: `npm test` (baseline 299 — this phase only adds)
- `tests/activity.test.ts` covers the DST fall-back case and passes
- No import of `@/i18n`, React, or `@supabase/*` appears in `src/data/activity.ts`

#### Manual Verification

- The eight new Polish strings read naturally to a Polish speaker and are age-appropriate for
  a 6–9-year-old
- No new string contains, case-insensitively, `portfel`, `rozbuduj sklep`,
  `czas otworzyć sklep!`, `cześć,`, or `ukończone zmiany`

---

## Phase 2: The profile-scoped query

### Overview

One additive read function on `reports.ts`, plus the two suites that pin its error contract and
its per-profile scoping. Nothing renders yet.

### Changes Required

#### 1. `listRecentActivity`

**File**: `src/lib/services/reports.ts`

**Intent**: The only read of raw `shift_log` rows in the codebase — newest-first, limited, and
scoped to one child. Appended at the end of the file; nothing above it is touched (D5).

**Contract**:

```ts
/** One `shift_log` row as the activity feed consumes it (id + timestamp + payload). */
export interface RecentActivityRow {
  id: string;
  created_at: string;
  skills: unknown;
  upgrade_purchased: string | null;
}

export async function listRecentActivity(
  client: SupabaseClient,
  profileId: string,
  limit = 3,
): Promise<RecentActivityRow[]>;
```

- `.select("id, created_at, skills, upgrade_purchased")` — explicit column list, the house
  style for this table.
- **`.eq("profile_id", profileId)` is mandatory and load-bearing**: RLS on `shift_log` is
  account-scoped, so without it a parent's other children's events appear in this child's
  feed. Treat its absence as a cross-profile data leak inside one account. `tests/recent-activity-isolation.test.ts`
  is the guard.
- `.order("created_at", { ascending: false }).limit(limit)`. No secondary sort — see "Critical
  Implementation Details".
- **A query error throws** (`if (error) throw error;`), matching `getWeeklyReport:113`.
- Doc comment must state (a) the RLS/`profile_id` reasoning, (b) that the writer
  (`appendShiftLog`) is best-effort and un-transactional, so the feed may legitimately be
  missing an event and must never be read as a wallet or shift-count reconciliation.

#### 2. Unit suite

**File**: `tests/recent-activity.test.ts` (new)

**Intent**: Pin the error contract and the query shape without a DB, using a stub local to this
file so `tests/reports.test.ts` stays untouched (D8).

**Contract**: a **thenable** chain stub — every method (`select`/`eq`/`order`/`limit`) returns
the chain, and the chain carries a `then` that resolves the seeded `{ data, error }`, so the
terminal call may be any of them. Cases: a seeded error **rejects** (never resolves to `[]`);
a successful query returns the rows verbatim; the recorded call arguments show
`ascending: false`, the default `limit` of 3, and — asserted explicitly — an `eq` on
`profile_id` with the id passed in.

#### 3. Intra-account isolation suite

**File**: `tests/recent-activity-isolation.test.ts` (new)

**Intent**: The regression guard for D9 — catch a dropped `profile_id` filter, which no RLS
policy and no existing suite can see.

**Contract**: modelled on `tests/report-isolation.test.ts:42-66` — `createSignedInUser` for
accounts A and B, `admin` used only to provision and tear down. Seed **two** profiles on
account A and one `shift_log` row each, through A's own client, **and one profile + one
`shift_log` row on account B**, through B's own client. Capture every inserted row's `id`
(the insert can chain `.select("id").single()`; Phase 2's query projects `id` too). Cases:
1. positive control — `listRecentActivity(A.client, profileA1)` returns **exactly one row, and
   its `id` is A1's row id**. Assert on the id, not only on `toHaveLength(1)` — two
   same-shaped rows must not be able to satisfy this;
2. **the leak guard** — that result contains **no** row belonging to A2, even though A's client
   can legitimately read both;
3. cross-account — `listRecentActivity(B.client, profileA1)` returns `[]`, never A's data.

**Why account B needs its own row (plan-review F4).** Without it, case 3 returns `[]` whether
or not `.eq("profile_id", …)` is present, because B simply has nothing to read — it would
still exercise the SELECT policy, but it would certify nothing about the app-side filter.
With a B-owned row seeded, dropping the filter makes case 3 return B's row instead of `[]`,
so case 3 fails too. The **primary** guard remains cases 1–2: with two profiles in one
account, dropping `.eq("profile_id", …)` returns 2 rows where the test demands exactly A1's
one — verified at plan review as genuinely red on a dropped filter, which is the whole point
of the suite.

Requires the local Supabase stack and `.env.test`.

#### 4. Contract-surface registry

**File**: `docs/reference/contract-surfaces.md`

**Intent**: Keep the `public.shift_log` entry accurate — a second consumer and a third
isolation test now exist.

**Contract**: append `listRecentActivity` to the surface's "Consumed by" line and
`tests/recent-activity-isolation.test.ts` to its "Isolation test" line. Append inside the
existing lines only — F1 may be editing the same block.

### Success Criteria

#### Automated Verification

- Linting passes: `npm run lint`
- Unit tests pass: `npm test`
- `tests/recent-activity-isolation.test.ts` passes against the local stack
  (`npx supabase status` → API on 127.0.0.1:54321)
- **Deliberate-break check**: temporarily removing `.eq("profile_id", …)` makes
  `tests/recent-activity-isolation.test.ts` fail; restore it and it passes
- **Deliberate-break check**: temporarily changing `throw error` to `return []` makes
  `tests/recent-activity.test.ts` fail
- `git diff src/lib/services/reports.ts` shows **only appended lines** — no moved, renamed,
  reformatted or re-exported existing symbol (runnable, so it sits under Automated; Progress
  row 2.6 matches)

#### Manual Verification

- `tests/reports.test.ts` and `src/types.ts` appear nowhere in the phase's diff

---

## Phase 3: The section on the dashboard

### Overview

The `.astro` section component and its wiring into `start.astro`'s frontmatter and block B.
Ships zero JS.

### Changes Required

#### 1. The section component

**File**: `src/components/child/RecentActivity.astro` (new)

**Intent**: Render the heading plus up to three entry cards — or the empty line, or the error
line — from already-resolved data. Presentation only: it performs no fetch, no `new Date()`,
no derivation. A plain `.astro` component (not `.tsx`) so it ships no JavaScript, matching
`SkillCards.astro`.

**Contract**:
- Props: `entries: ActivityEntry[] | null` (`null` = the query failed) and optional `class`.
- Structure copies `SkillCards.astro:28-30`: `<section class="flex flex-col gap-4">` +
  `<h2 class="text-foreground text-lg font-bold lg:text-xl">{t.start.activityHeading}</h2>` +
  `<ul class="grid gap-3 lg:grid-cols-3">`; each entry is an `<li class:list={[childCard("2xl", "…p-4")]}>`.
  Use `childCard()`, never shadcn `<Card>`.
- Per card, mirroring the mockup: a solid circular icon badge (`size-10`), then a min-width-0
  two-line text block — bold label, then a muted day line. **No right-hand amount column** (D1).
- Icons are lucide, imported in the frontmatter, `className` (never `class`), sized with
  `size-*`, no `client:*` directive. Key them off `kind` with the map-driven pattern at
  `SkillCards.astro:21-25, :35`: shift → `Check` on `bg-success text-success-foreground`
  (same treatment as the milestone path at `start.astro:119`); purchase → `ArrowUp` on
  `bg-primary text-primary-foreground`.
- Labels: shift → `t.start.activityShiftTasks` with `{tasks}` = `tasksDone(taskCount)`, or the
  bare `t.start.activityShift` when `taskCount === 0`; purchase →
  `t.start.activityUpgrade` with `{name}` = `upgradeCopy(upgradeId).name`. Use the existing
  `upgradeCopy` helper — it already falls back to the raw id for a stale catalog id rather than
  throwing mid-render. **Do not** render `getUpgrade(id)?.art` here; the badge is a lucide
  glyph, so there is no `undefined`-art hazard and no new asset.
- Day line: `t.start.activityToday` / `t.start.activityYesterday` / the entry's `dayMonth`.
- `null` entries → one muted `<p>{t.start.activityError}</p>` under the heading;
  `[]` → one muted `<p>{t.start.activityEmpty}</p>`. The heading renders in all three states.
- Entry text must wrap, not overflow: the text block gets `min-w-0` and the label wraps
  (`break-words` where needed) so a long upgrade name cannot push the card past 390px.

#### 2. Wiring

**File**: `src/pages/app/start.astro`

**Intent**: Resolve the feed in the frontmatter — the only place non-determinism is allowed on
this page — and render the section at the bottom of block B.

**Contract**:
- Frontmatter, after the existing `skillState` line (`:44`): call
  `listRecentActivity(supabase, profile.id)` inside a `try/catch`, map each row through
  `toActivityEntry(row, now)` with a single `const now = new Date()` captured once so all
  entries bucket against the same instant, and set `activityEntries` to the mapped array on
  success or `null` on error. Guard the no-profile / no-client branch (the page already renders
  `EmptyStateCard` there). A `catch` must not rethrow — the rest of the dashboard renders
  regardless (D7).
- Markup: `<RecentActivity entries={activityEntries} />` appended **inside** block B's
  `flex flex-col gap-6` container (`:139-154`), after the results `<section>` (`:153`). Do
  **not** add a fourth grid sibling — see D2.

### Success Criteria

#### Automated Verification

- Linting passes: `npm run lint`
- Unit tests still pass: `npm test`
- Existing Playwright suite still passes: `npx playwright test` (**15/15** — `npx playwright
  test --list` reports "Total: 15 tests in 6 files"; this change adds no test cases)
- **Type check passes: `npm run check`** (`astro check`). This is the ONLY gate that
  type-checks `.astro` frontmatter and props — the pre-commit hook runs `eslint --fix` alone
  (`.husky/pre-commit` → `npx lint-staged`), and eslint does not type-check `.astro`. Baseline
  verified green on 2026-08-22: `Result (163 files): 0 errors, 0 warnings, 8 hints`.
- `grep -n "client:" src/components/child/RecentActivity.astro` returns nothing — the section
  ships no JS
- `grep -nE '"[A-ZŁŚĆŻŹÓĘĄŃ]' src/components/child/RecentActivity.astro` surfaces no
  hard-coded Polish literal (all copy resolves through `t`)

#### Manual Verification

- `/app/start` at **390px**: the three cards are stacked one per row, no horizontal overflow,
  a long upgrade name wraps rather than pushing the card wide
- `/app/start` at **1280px**: three cards across, sitting under "Twój sklep — wyniki" in the
  main column, matching `assets/matmaverse-ui-v2-web/02-child-dashboard-web.png`
- A fresh profile shows the heading plus the empty line, and nothing looks broken
- After completing a shift and buying an upgrade, the purchase appears **above** the shift,
  both reading `Dzisiaj`
- No hydration warning in the browser console (the day words are SSR-fixed)

---

## Phase 4: E2E coverage

### Overview

Two assertions on existing specs — one for the empty feed on a fresh account, one for the
populated feed after a real shift and a real purchase. No new spec file; both live where the
journey already is.

### Changes Required

#### 1. Empty-state assertion

**File**: `e2e/seed.spec.ts`

**Intent**: A brand-new profile lands on `/app/start` and sees the section's heading and its
empty line — proving the section renders (and does not throw) with zero rows.

**Contract**: after the existing wallet assertion (`:29`), assert
`getByRole("heading", { name: t.start.activityHeading })` and
`getByText(t.start.activityEmpty)` are visible. Strings resolve through
`e2e/helpers/i18n.ts` per `e2e/CLAUDE.md`; no new helper, no `data-testid`.

#### 2. Populated-feed assertion

**File**: `e2e/gameplay-restore.spec.ts`

**Intent**: After the real gameplay loop (shift completed via taps → `/api/shifts/complete` →
upgrade bought), the feed reflects the durable rows both writers produced — the strongest
available proof that the discriminator, ordering, and per-profile scoping work end to end.
This spec runs in **both** projects, so the assertion also covers the 712px stacked reflow.

**Contract**: at the end of the first test (after the `ownedTag` assertion, `:67-69`),
navigate back to `/app/start` and assert both entries are visible:
`getByText(t.start.activityShift)` — which substring-matches the counted label
`Zmiana ukończona · N zadań`, so the test needs no knowledge of the nondeterministic task
count — and `getByText(fill(t.start.activityUpgrade, { name: t.upgrades.sign.name }))`.

**Do not assert `getByText(t.start.activityToday)`** — `Dzisiaj` is a substring of
`t.start.missionHeading` already on the page and appears on both cards; it is a guaranteed
strict-mode failure. Both chosen strings are unique on the page (after buying `Szyld` the
"Następne ulepszenie" card advances to `Półka`), so no `getByRole("listitem")` scoping is
needed.

### Success Criteria

#### Automated Verification

- Full Playwright suite passes in both projects: `npx playwright test` (**15/15, 0 failures** —
  the count does not change; Phase 4 adds assertions inside two existing tests)
- Unit tests still pass: `npm test`
- Linting passes: `npm run lint`

#### Manual Verification

- The `touch` project run (712px) shows the stacked feed in its trace/screenshot, with one
  copy of the heading in the accessibility tree
- Re-running the suite twice in a row is green both times (no timing or ordering flake from
  the day-word rendering)

---

## Testing Strategy

### Unit Tests (no browser, no DB)

- `tests/activity.test.ts` — the discriminator (including the purchase row's `decisions`
  payload, which is the trap), `taskCount` from `readSkillState` including garbage input,
  today/yesterday across a Warsaw midnight, the **DST fall-back** case that a naive −24 h
  implementation fails, and `DD.MM` formatting with zero padding.
- `tests/i18n-helpers.test.ts` — `tasksDone` Polish plural form selection (1 / 2 / 4 / 5 / 12 /
  22 / 0).
- `tests/recent-activity.test.ts` — the throw-on-error contract and the query shape
  (`ascending: false`, `limit` default 3, `eq` on `profile_id`) against a local thenable stub.

### Integration Tests (local Supabase)

- `tests/recent-activity-isolation.test.ts` — **two profiles inside one account**: the feed for
  A1 must not contain A2's row (the `profile_id` guard, invisible to RLS), plus a cross-account
  probe returning `[]`.

### Manual Testing Steps

1. `npx supabase start`, `npm run dev`, sign in as `ui-polish-demo@example.test` /
   `test-password-123!`, profile "Ania".
2. On a profile with no history, confirm `/app/start` shows the heading and the empty line.
3. Complete one shift, then buy an upgrade; return to `/app/start` and confirm the purchase is
   the top card, the shift second, both reading `Dzisiaj`, and the shift's task count matches
   what the `Zadanie N z M` progress line showed during the shift (the results screen itself
   renders no task count — `t.results` carries `progress` / `earnedLabel` / `starsLabel` only).
4. Resize to 390px: cards stack, nothing overflows horizontally, long names wrap.
5. Resize to 1280px: three across, under the results tiles, matching the web mockup.
6. Backdate a row in Studio (`http://localhost:54323`) to two days ago and confirm it renders
   `DD.MM`, and to yesterday and confirm it renders `Wczoraj`.
7. Confirm the browser console shows no hydration mismatch.

## Performance Considerations

The query is covered end-to-end by the existing `shift_log_profile_created_idx`
(`profile_id, created_at`) with `limit 3` — an index-only range scan, no new index. It adds
exactly one round-trip to an SSR page that already makes one, and the section ships zero
client JavaScript. No caching, no memoization needed.

## Migration Notes

None. No schema change, no RLS change, no data backfill. Existing `shift_log` rows render
correctly as-is; rows whose `upgrade_purchased` names an upgrade later removed from the catalog
degrade to the raw id via `upgradeCopy`'s guarded fallback rather than throwing.

## Known risks

Carried forward from plan review (`reviews/plan-review.md`, 2026-08-22). These were triaged
as WARNING findings whose fix is a judgement call rather than a mechanical edit — meet them at
the moment named, do not resolve them speculatively up front.

**R1 — `src/lib/services/reports.ts` may conflict at EOF with F1 (Phase 2).** F1's `plan.md`
does not exist yet; its research implies a new pure bucketing function that would most
naturally be appended to the same file. If F2 lands second and git reports a conflict at the
tail of `reports.ts`, **rebase — keep both symbol sets, in F1-then-F2 order — do not accept
"ours"/"theirs" on that hunk**, and re-read `getWeeklyReport` afterwards to confirm nothing
above the append point was reverted. Same rule for `docs/reference/contract-surfaces.md`
`## public.shift_log`: the Consumed-by line must end up naming **both** consumers.

**R2 — do not "simplify" onto `ShiftLogRow` after F1 lands (Phase 2).** Once F1 adds
`created_at` to `ShiftLogRow` the two interfaces look nearly identical. They are not: the feed
also needs `id`, and sharing the interface couples two independently-evolving queries. Keep
`RecentActivityRow` separate.

**R3 — the feed's column breakpoint is a deliberate deviation, unverified at 712px (Phase 3).**
`grid gap-3 lg:grid-cols-3` makes the feed the only 1-across row on the dashboard at the
`touch` project's 712px viewport: `SkillCards.astro` is `sm:grid-cols-3` and the results tiles
are `sm:grid-cols-4`, so both siblings are already multi-column there. The `lg:` choice is
defensible — entry labels are much longer than a stat tile's — but it is a deviation, not a
continuation, and the mobile mockup gives no ruling (the section is not drawn there at all).
**Evaluate it at manual criteria 3.6 / 3.7 / 4.4 and change it then if it reads wrong.**
Switching to `sm:grid-cols-3` (matching `SkillCards`, directly above it in the same column) is
a one-token edit on one element; so is reverting. Do not decide it before you can see it.

**R4 — the feed may legitimately be missing an event (Phase 2 / Phase 3).** `appendShiftLog`
(`src/lib/services/child-profiles.ts:120-137`) swallows its error and does not share a
transaction with the profile UPDATE. The feed must never be read — or worded — as a
reconciliation of `wallet_balance` or `completed_shift_count`. This is D7's accepted
consequence, restated here so it is met at implementation time rather than rediscovered.

## References

- Research: `context/changes/dashboard-recent-activity/research.md`
- Prior handoff: `context/changes/dashboard-recent-activity/handoff.md`
- Standing brief: `context/runs/2026-08-22-autonomous-five/agent-contract.md`
- Parallel feature sharing `reports.ts`: `context/changes/parent-weekly-activity-chart/`
- Binding mockup: `assets/matmaverse-ui-v2-web/02-child-dashboard-web.png` (gitignored,
  local only)
- Mockup that omits the section: `assets/matmaverse-ui-v2-mobile/02-child-dashboard-mobile.png`
- Structural precedent: `src/components/child/SkillCards.astro:28-30`
- Error-posture precedent: `src/lib/services/reports.ts:97-113`, `src/pages/app/report.astro:35-42`
- Isolation-test precedent: `tests/report-isolation.test.ts:42-66`
- Plural-helper precedent: `src/i18n/index.ts:11-27`
- Inherited UI rules: `context/changes/web-shell-and-mockup-parity/handoff.md` §3

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Pure core + Polish copy

#### Automated

- [x] 1.1 Linting passes: `npm run lint`
- [x] 1.2 Unit tests pass and the count has grown: `npm test` (baseline 299)
- [x] 1.3 `tests/activity.test.ts` covers the DST fall-back case and passes
- [x] 1.4 No i18n / React / Supabase import in `src/data/activity.ts`

#### Manual

- [x] 1.5 The eight new Polish strings read naturally and are age-appropriate
- [x] 1.6 No new string contains `portfel` / `rozbuduj sklep` / `czas otworzyć sklep!` / `cześć,` / `ukończone zmiany`

### Phase 2: The profile-scoped query

#### Automated

- [ ] 2.1 Linting passes: `npm run lint`
- [ ] 2.2 Unit tests pass: `npm test`
- [ ] 2.3 `tests/recent-activity-isolation.test.ts` passes against the local stack
- [ ] 2.4 Deliberate-break: removing `.eq("profile_id", …)` fails the isolation suite
- [ ] 2.5 Deliberate-break: replacing `throw error` with `return []` fails the unit suite
- [ ] 2.6 `git diff src/lib/services/reports.ts` shows appended lines only

#### Manual

- [ ] 2.7 `tests/reports.test.ts` and `src/types.ts` appear nowhere in the phase diff

### Phase 3: The section on the dashboard

#### Automated

- [ ] 3.1 Linting passes: `npm run lint`
- [ ] 3.2 Unit tests still pass: `npm test`
- [ ] 3.3 Existing Playwright suite still passes: `npx playwright test`
- [ ] 3.4 `RecentActivity.astro` contains no `client:` directive
- [ ] 3.5 `RecentActivity.astro` contains no hard-coded Polish literal
- [ ] 3.11 Type check passes: `npm run check` (`astro check` — the only `.astro` type gate)

#### Manual

- [ ] 3.6 `/app/start` at 390px: cards stacked, no horizontal overflow, long names wrap
- [ ] 3.7 `/app/start` at 1280px: three across, under the results tiles, matches the web mockup
- [ ] 3.8 A fresh profile shows the heading plus the empty line
- [ ] 3.9 Purchase above shift after a real shift + purchase, both reading `Dzisiaj`
- [ ] 3.10 No hydration warning in the browser console

### Phase 4: E2E coverage

#### Automated

- [ ] 4.1 Full Playwright suite passes in both projects: `npx playwright test`
- [ ] 4.2 Unit tests still pass: `npm test`
- [ ] 4.3 Linting passes: `npm run lint`

#### Manual

- [ ] 4.4 The `touch` (712px) run shows the stacked feed with one copy of the heading
- [ ] 4.6 Known risk R3 evaluated at 712px: the feed's `lg:grid-cols-3` breakpoint reads acceptably beside the `sm:`-breakpoint siblings, or is changed then
- [ ] 4.5 Two consecutive suite runs are green (no flake)
