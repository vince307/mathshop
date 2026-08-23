<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Named shop growth stages + per-shift earnings

- **Plan**: `context/changes/world-progression-stages/plan.md`
- **Change**: `world-progression-stages` (feature **F4** of run `context/runs/2026-08-22-autonomous-five/`)
- **Scope**: Phases 1, 1b, 2, 3, 4a, 4b — **all phases, full-plan review**
- **Diff reviewed**: `feat/parent-weekly-activity-chart..feat/world-progression-stages`, 8 commits `aabb8b7` → `bdf9c6b`
  (this branch is **third in a stack** — F2 `dashboard-recent-activity` → F1 `parent-weekly-activity-chart` → F4;
  reviewing against `main` would misattribute two other features' work to this one)
- **Date**: 2026-08-23
- **Verdict**: **NEEDS ATTENTION** — *no finding blocks the merge.* Zero CRITICAL, zero FAIL.
  Three WARNINGs, each a one-to-three-line cosmetic or docs fix. **The branch is mergeable as-is.**
- **Findings**: 0 critical, 3 warnings, 7 observations
- **Reviewer**: autonomous step of `context/runs/2026-08-22-autonomous-five/` — no human in the loop
  (standing brief, Hard rule 1). Triage was performed by the reviewer, not asked; see `## Triage`.

## Verdicts

| Dimension | Verdict | Note |
|-----------|---------|------|
| Plan Adherence | **PASS** ✅ | Every "Changes Required" item exists with the contracted content. Nothing MISSING. One sub-item drift (F4 below, the `<lg` connector), cosmetic |
| Scope Discipline | **PASS** ✅ | Two additions beyond the plan's phases — the earnings tile and the `E2E_PORT` override — are both recorded as decisions (**D-10**, **D-11**) with rejected alternatives. `/app/worlds`, the `worlds` nav key and `ShopArt`'s API are untouched: **F5's territory is clean** |
| Safety & Quality | **WARNING** ⚠️ | 1 finding (F3 — deploy-ordering blindness). No security finding: no injection surface, no secret, no authz gap, no cross-account read. RLS verdict independently re-verified against the live database |
| Architecture | **PASS** ✅ | `src/data/stages.ts` pure (only `@/data/upgrades`); saturation at the presentation layer, formula uncapped; read-only page over state already loaded, no new API route, no new query |
| Pattern Consistency | **WARNING** ⚠️ | 2 findings (F1, F2) — both sibling divergences from `start.astro` / `ShiftResults.tsx`, both cosmetic |
| Success Criteria | **PASS** ✅ | Every automated claim re-run and reproduced; the one contracted deliberate-break re-executed and confirmed exactly |

► **Overall: NEEDS ATTENTION** (three cosmetic/docs warnings) — **but mergeable as-is.**
Merge order for the stack is **F2 → F1 → F4**.

## Verification re-run, not accepted

Every implementer claim was reproduced in this step. The command sandbox was disabled for anything
touching `127.0.0.1:54321` / Docker, and Playwright ran against **this checkout's own** dev server on
`E2E_PORT=4331`, never the shared `:4321` that belongs to another agent's worktree.

| Claim | Command | Result |
|---|---|---|
| `npm test` 382 / 45 files | `npm test` | ✅ **382 passed / 45 files** |
| lint clean | `npm run lint` | ✅ **exit 0**, no output |
| `check` 0/0/9 | `npm run check` | ✅ **0 errors / 0 warnings / 9 hints** (178 files) |
| Playwright 22 passed | `E2E_PORT=4331 npx playwright test` | ✅ **22 passed** (desktop + touch) |
| All Progress rows `[x]` | `grep -c '^- \[ \]' plan.md` | ✅ **0** |

### The migration, verified against the live database (not against the file)

A migration written but never applied is not implemented. `psql -p 54322` against the running local
stack:

- `information_schema.columns` → `earned | integer | is_nullable: YES | column_default: (none)` ✅
- `pg_constraint` on `public.shift_log` → `shift_log_earned_nonneg CHECK ((earned IS NULL) OR (earned >= 0))`,
  **named**, alongside only the pkey and the two FKs ✅
- `select count(*), count(earned) from public.shift_log` → **3 rows, 0 non-null** — pre-existing rows
  read `null`, **not `0`**, exactly as D-1 requires ✅
- `pg_policy` → **four** policies, unchanged: `shift_log_select_own` / `insert_own` / `update_own` /
  `delete_own`, every predicate `(auth.uid() = account_id)`, **none naming a column**. No new policy
  was added and none was needed; the migration header names all four and argues why (L-001) ✅

### The write path

`src/lib/services/child-profiles.ts` — the authoritative `child_profiles` UPDATE runs first and is
gated by `if (updateErr) return { error: updateErr };`; **only then** does `appendShiftLog` run
(`:194`). A logging failure therefore cannot cost a child their money. `appendShiftLog` (`:133-144`)
still discards its insert result — `await client.from("shift_log").insert({…})`, no destructuring, no
check — so it **still swallows**, exactly as required; nothing was newly propagated into shift
completion. ✅

### The suppression predicate — the defect the plan review caught

`src/lib/services/reports.ts:85` reads:

```ts
if (row.upgrade_purchased === null && row.earned == null) earningsKnown = false;
```

**Re-executed the implementer's deliberate break myself**: swapping in the naive unscoped
`if (row.earned == null) earningsKnown = false;` turns **exactly two** tests red, and they are the two
that distinguish the defect —

1. `tests/reports.test.ts` › *a window of ONLY purchase rows is KNOWN and zero* (`expected false to be true`)
2. `tests/reports.test.ts` › *a purchase row alongside real shift rows does not suppress the figure*

`381 → 380 passed, 2 failed`. Restored with `git checkout --`; `git status` clean. ✅

The purchases-only test asserts **`earningsKnown: true` and `earned: 0`** — the inverted form the plan
review mandated, not the version that would have locked the defect in. ✅
`grep` across `tests/` and `e2e/` finds **no assertion of `wallet == sum(earned)`** anywhere; the only
hit is a comment at `tests/shifts-complete.test.ts:245` explaining why it is deliberately not
asserted. ✅

### Copy truthfulness

`src/i18n/pl.ts:473` → `statEarned: "Zarobione w tym tygodniu"`. No `suma`, `bilans`, `łącznie`,
`razem` or `wszystkie zarobki` anywhere in the diff. The tile is the last of four in the report
card's stat grid and is never rendered adjacent to, or compared with, `wallet_balance`; the child's
own `/app/growth` screen deliberately computes no earnings total at all (`growth.astro:42-44`). The
lower-bound property is documented in four places that a future editor will actually hit: the
migration header, the column `COMMENT`, `src/types.ts`'s `earned` doc, and the rewritten `pl.ts`
comment. ✅

### D-10 — the scope addition

The grid is byte-for-byte the agreed form (`WeeklyReport.tsx:155`):

```tsx
cn("mt-5 grid gap-3", earningsKnown ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 sm:grid-cols-3")
```

`cn` imported from `@/lib/utils` (house rule). The tile is **fourth** (after `statTasks`,
`statFirstTry`, `statUpgrades`), suppressed — never zeroed — when `earningsKnown` is false, so neither
state leaves an orphan tile: 3 tiles keep F1's untouched `grid-cols-2 sm:grid-cols-3`, 4 tiles go
`2 × 2` up to `lg` then one row of four. The `pl.ts` comment is rewritten a **second** time and is now
factually accurate — F1's version asserted "`shift_log` has no earnings column", which this
migration makes false; the new text says the tile reads `shift_log.earned`, states the lower-bound
property and lists the forbidden wordings. ✅
Three RTL tests (`tests/weekly-report-tiles.test.tsx`) pin all three states: known/nonzero, known/zero
(renders `0 zł`), unknown (no label, no figure, other three tiles intact). ✅

### Saturation — traced, not accepted

`businessLevelForShifts` is **untouched**: still `1 + Math.floor(n / SHIFTS_PER_LEVEL)`, no `Math.min`,
no `MAX_LEVEL`. `recordShiftResult:196` still returns `leveledUp: businessLevel > current.business_level`
and `ShiftResults.tsx:63` still renders `{leveledUp && …}` unconditionally — the celebration keeps
firing past the terminal stage (D-2a). ✅

`stageForLevel` (`src/data/stages.ts:86-93`) is a full forward scan assigning `index = i` on every
satisfied threshold and returning `STAGES[index]`, so: `999` → index 3, `atMax: true`; `Infinity` →
index 3; `0` / `-5` / `NaN` → index 0 (NaN fails every comparison and falls through to the
initialiser); `1.5` → index 0. **Total, non-throwing, saturating.** ✅

The monotonicity test is real, not a comment: `tests/stages.test.ts:84-114` loops `n = 1..60` over
`stageIndexAfterShifts(n) = STAGES.indexOf(stageForLevel(businessLevelForShifts(n)).stage)` — through
the **real production formula**, not a stub — asserting non-decrease, `index(0) === 0`,
`new Set(0..60).size === STAGES.length` (every stage reachable), and `atMax ⟺ index === length - 1` at
every n. Plus a 150-shift case pinning that the level runs past the last `requiredLevel`. ✅

### ART-C

`git diff --name-only … -- public/` returns **nothing**: zero files added to `public/illustrations/`,
zero `slice-map.md` rows. Stage state is rendered with lucide `Check` / `Lock` plus `bg-success` /
`bg-primary` / `bg-muted` design tokens; the one hero is the child's own `ShopArt`. The deviation note
lives in **`src/data/stages.ts`'s module header** (`:17-31`) — so it survives archiving of the change
folder — and carries the concrete upgrade path (`art?: string` on `Stage`, crops under
`public/illustrations/`, flip `ShopArt`'s base `src`), plus the two deliberate copy deviations. ✅

### D-12 — the bottom-bar fit assertion

**Judged sound; the new assertion is genuinely load-bearing and the document one should stay.**

- The premise checks out in the source: `AppShell.astro:191` is
  `class="… fixed inset-x-0 bottom-0 … lg:hidden"`. A `position: fixed` element is out of document
  flow, so its own overflow cannot move `documentElement.scrollWidth` — the plan's contracted
  assertion was **decorative for this risk**, and the implementer's 96 px break proving it is a
  correct browser-semantics claim, not a rationalisation.
- `e2e/growth.spec.ts:104-106` measures `scrollWidth - clientWidth` on what
  `getByRole("navigation", { name: t.nav.primaryLabel })` resolves to. That is a **role-located**
  element, which `e2e/CLAUDE.md`'s "never use CSS selectors, XPath, or DOM structure for locating"
  rule permits: the rule governs *locating*, and this neither uses a selector nor extends the closed
  list of sanctioned exceptions. The precedent (`pageText()` in `parent-weekly-report.spec.ts`) is
  real. The preceding `await expect(primaryNav).toHaveCount(1)` also makes the measurement
  unambiguous *and* independently pins the `hidden`/`lg:hidden` toggle.
- **Keep the document assertion.** It is one line, it covers a different and separately-established
  risk (in-flow page overflow — the subject of commit `ee458ce`, "keep every surface within the
  viewport on a phone"), and the spec already comments that it is a document measurement rather than
  an element locator. Removing it would trade a real, cheap check for nothing.

### Scope discipline vs. F5 and F2

- `grep` over the whole source diff finds **no** `/app/worlds`, no `worlds` key in the `active` union,
  no `t.nav.items.worlds`, no `WORLD_SLOTS` edit. `ShopArt.tsx`'s diff is **comment-only** (`:17-24`)
  — props, `DEFAULT_SLOTS`, `WORLD_SLOTS` and the render are untouched, exactly the agreed
  ownership-without-restructuring of D-5. `AppShell.astro`'s entire diff is three hunks: the lucide
  import, the `active` union, and the one `items` entry. F5's ground is clean. ✅
- `docs/reference/contract-surfaces.md` **extends** F2's `## public.shift_log` section rather than
  overwriting it: the diff is exactly two lines — the **Defined in** and **Columns** bullets — while
  F2's **Consumed by** (`listRecentActivity`) and **Isolation test**
  (`recent-activity-isolation.test.ts`) bullets four lines below survive intact. ✅

## Findings

### F1 — `growth.astro`'s next-upgrade card shows its heading over an empty box once everything is owned

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/pages/app/growth.astro:122-123`
- **Detail**: The `<h2>{t.start.nextUpgradeHeading}</h2>` sits **outside** the `{next && (…)}` guard,
  with the "Zobacz ulepszenia" CTA after it. `nextUpgrade` returns `null` once every level-eligible
  upgrade is owned (`src/data/upgrades.ts`), a state a real child reaches. The screen then renders
  "Następne ulepszenie" over nothing. `src/pages/app/start.astro:195-214` guards the **whole card**
  with `{next && (…)}` for exactly this reason, and this same file already does the honest-empty
  thing correctly one section above (`t.growth.noUnlocks` at `:112`). The manual Progress check 3.7
  ran at `business_level = 9` with upgrades still unowned, so `next` was non-null and this state was
  never observed.
- **Fix**: Move the `<h2>` (and, if the CTA should not stand alone, the whole card) inside the
  `{next && (…)}` block — or add a `t.growth`-namespaced empty line for the `next === null` case,
  mirroring `noUnlocks`.
  - Strength: One-line move; matches the established sibling and this file's own honest-empty
    discipline.
  - Tradeoff: If the card is guarded whole, the "Zobacz ulepszenia" CTA disappears at full ownership —
    which is arguably right, since there is nothing left to buy.
  - Confidence: HIGH — `null` return verified in `src/data/upgrades.ts`; `start.astro`'s guard read
    directly.
  - Blind spot: None significant.

### F2 — The stage ordinal is not actually announced: `aria-label` on a bare `<span>`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/components/child/StageRail.astro:76`, `:83`, `:90`
- **Detail**: All three state markers carry `aria-label={t.growth.stageOrdinal…}` on a `<span>` with
  no `role`. ARIA does not map `aria-label` onto `role="generic"`, so assistive technology ignores it.
  The "done" and "locked" markers contain **only** an `aria-hidden` lucide icon, so they announce
  nothing at all. Both siblings in this codebase do it correctly — `ShiftResults.tsx:48` uses
  `role="img" aria-label={…}` and `SkillCards.astro:51` uses `role="progressbar" aria-label={…}`.
  This is a degradation, not a blackout: the adjacent `sr-only` state word ("Etap ukończony" /
  "w trakcie" / "zablokowany") and the stage name still carry the meaning. But `StageRail.astro`'s own
  comment (`:70-72`) and Progress row 3.5 both claim the ordinal *is* spoken, and it is not.
- **Fix**: Add `role="img"` to all three spans.
  - Strength: Three-word change; matches the two in-repo precedents; makes the file's own comment true.
  - Tradeoff: None — the "current" marker has visible text (`{stage.order}`), and `role="img"` +
    `aria-label` is the consistent choice there too.
  - Confidence: HIGH — precedents read directly; ARIA generic-role rule is unambiguous.
  - Blind spot: Not verified with a real screen reader; verified by spec and by sibling precedent.

### F3 — Deploy-ordering blindness: app-before-migration silently stops all `shift_log` writes

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/lib/services/child-profiles.ts:133-144` + `supabase/migrations/20260822120000_shift_log_add_earned.sql`
- **Detail**: `appendShiftLog` now names `earned` in its insert payload. If the application is
  deployed to an environment where this migration has **not** run, every insert fails with
  `column "earned" of relation "shift_log" does not exist` — and `appendShiftLog` discards the error
  by design. `shift_log` then stops recording **entirely** (shifts, purchases, the weekly report, the
  activity feed) with **zero signal anywhere**. The read path is the opposite: `getWeeklyReport` names
  `earned` in its `.select()` and does `if (error) throw error;`, so reads fail loudly.
  The swallow itself is correct and was explicitly kept in scope ("Not adding a server-side breadcrumb
  to the swallowed `appendShiftLog` error" is in the plan's *What We're NOT Doing*), and the run's
  local database has the migration applied — so this is **an operational sequencing note, not a code
  defect on this branch**. What is new is that a previously-harmless deploy order is now a silent
  total-blindness mode.
- **Fix ⭐ Recommended**: Docs only — add a `-- DEPLOY ORDER: apply this migration BEFORE the app that
  writes `earned`; `appendShiftLog` swallows its insert error, so a missing column silently stops ALL
  shift_log writes.` line to the migration header, and repeat it in the handoff's merge notes.
  - Strength: Zero code change, zero risk, keeps the deliberate swallow intact, and puts the warning
    in the file the operator is looking at when they run the migration.
  - Tradeoff: A comment does not enforce anything.
  - Confidence: HIGH — the failure mode is mechanical (Postgres rejects unknown columns; the result is
    discarded).
  - Blind spot: None significant.
- **Fix B**: Capture and log the insert error (`const { error } = await …; if (error) console.error(…)`)
  while keeping the `Promise<void>` return so nothing propagates into shift completion.
  - Strength: Ends the blindness for every failure mode, not just this one.
  - Tradeoff: The project has **no logging convention**, and the plan explicitly excluded this; it is a
    change to shift-completion failure semantics that belongs in its own change with its own review.
  - Confidence: MEDIUM — mechanically trivial, but the right shape (console vs. a real logger) is a
    project decision nobody has made.
  - Blind spot: Whether Vercel Function logs are actually monitored.

### F4 — The stage connector is desktop-only, contradicting a contracted manual bullet

- **Severity**: 📋 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `src/components/child/StageRail.astro:58`
- **Detail**: The connector is `class:list={["mt-8 hidden … lg:block", …]}` — invisible below `lg`.
  The plan's Phase-3 Manual Verification bullet required "a vertical card list below `lg` and a
  horizontal rail at `lg+`, **with the connector visible in both**". The inline comment at `:50-53`
  argues the vertical stack needs none because the cards already read top-to-bottom, which is a
  defensible call, but it was made in a code comment rather than recorded as a decision entry, and
  Progress row 3.5 records the 712 px check while staying silent about the connector. Purely
  cosmetic; the `index <= current.index ? "bg-success" : "bg-muted"` logic itself is correct.
- **Fix**: Either record the deviation as a decision entry in the plan, or add a vertical connector
  segment below `lg`.

### F5 — `earned` accumulates over the query window, not the seven-day frame

- **Severity**: 📋 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: `src/lib/services/reports.ts:79` vs `:88`
- **Detail**: `earned += row.earned ?? 0` runs **before** the frame filter (`if (bucket === undefined)
  continue;`), so `earned` follows `practice` semantics (every row in the open-ended `.gte` window)
  rather than `daily` semantics (rows inside `weekDayKeys(now)`). Not a production bug —
  `startOfWeek(now)` and `weekDayKeys(now)` derive from the same `now`, and the tile sits beside
  `tasksThisWeek`, which is computed from `practice` and is therefore consistent. It matters only for
  a test that passes a hand-built `now` that disagrees with its fixtures.
- **Fix**: Add a line to the existing `Σ daily === Σ practice` doc block naming `earned` as a
  practice-side quantity, so a future reader does not try to reconcile the tile against the chart.

### F6 — The migration takes two locks where the in-repo precedent takes one

- **Severity**: 📋 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `supabase/migrations/20260822120000_shift_log_add_earned.sql:41-49`
- **Detail**: Two separate `alter table` statements take two `ACCESS EXCLUSIVE` locks, and
  `add constraint … check` performs a validating scan of the table. Trivial at current volume (the
  column is all-`NULL` and the table has 3 rows), so this is a note, not a defect.
- **Fix**: Fold both into one statement —
  `alter table public.shift_log add column earned integer null, add constraint shift_log_earned_nonneg check (…);`
  — matching the multi-clause form already used in `20260630120000_child_profiles_add_gameplay_state.sql`.
  **Do not rewrite the applied migration in place** (it is already applied locally); take this only if
  a fresh `db reset` is on the table anyway.

### F7 — The savings bar renders twice on `/app/growth`, and Progress 3.7's "only one progress bar" is imprecise

- **Severity**: 📋 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `src/pages/app/growth.astro:70-71` and `:131-134`
- **Detail**: The page passes `progressPercent`/`progressLabel` to `AppShell` (which renders a savings
  bar plus `nextText` in the desktop sidebar, `AppShell.astro:92-99`) **and** renders its own savings
  bar plus `nextText` in the next-upgrade card. At `lg+` both appear, so the same figure and the same
  sentence render twice. This exactly mirrors `start.astro:106-107` + `:205-212`, so it is the
  established shape rather than new drift — but Progress row 3.7's claim "**only one** progress bar on
  the page (the savings bar)" is therefore true only in the specific terminal-stage state that was
  checked. Two secondary notes: `growth.astro:132`'s decorative bar omits the `aria-hidden="true"`
  that both established copies carry, and the duplicated `nextText` would make a bare
  `getByText(nextText)` ambiguous for any future spec.
- **Fix**: Add `aria-hidden="true"` to the bar at `:132`; if a future e2e touches the savings copy,
  scope the locator rather than relying on uniqueness.

### F8 — `world.name` appears three times in the accessibility tree on one screen

- **Severity**: 📋 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/pages/app/growth.astro:62`, `:83`, and `ShopArt`'s `alt`
- **Detail**: `subtitle={world.name}`, the hero `<p>{world.name}</p>`, and `ShopArt`'s
  `alt={world.name}` put the world name in the tree three times (`upgrades.astro` has two). No locator
  uses it today and no test breaks, but it is the same class of ambiguity the run's brief guards
  against, and this screen added the third copy.
- **Fix**: Pass `alt=""` to the hero art on this screen, since the name is adjacent visible text.

### F9 — `E2E_PORT` is infrastructure riding in a feature branch, and it mitigates rather than removes the hazard

- **Severity**: 📋 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: `playwright.config.ts:21-23, 62` and `e2e/global-setup.ts:4-5`
- **Detail**: **The change itself is correct.** `const PORT = process.env.E2E_PORT ?? "4321"`,
  `command: npm run dev -- --port ${PORT}`, and the same default in `global-setup.ts` — behaviour is
  byte-for-byte unchanged when the variable is unset, so CI (which sets nothing) is unaffected, and
  the two files stay in sync. It is also load-bearing for *this* review: without it, every number
  above could have been measured against another worktree's dev server. Recorded as **D-11** with
  rejected alternatives.
  Two honest caveats. (a) It is **not feature work** — it is a five-line test-harness fix that would
  land cleanly on its own and has no dependency on F4. (b) It **mitigates without removing** the
  hazard: `reuseExistingServer: !CI` still silently adopts a foreign server whenever `E2E_PORT` is
  unset, which is the default every future agent will hit. The comment warns; the config does not
  enforce.
- **Fix ⭐ Recommended**: Keep it in this branch. Splitting five lines that are already committed,
  reviewed and load-bearing for the branch's own e2e numbers costs more than it buys, and the stack
  (F2 → F1 → F4) would have to be re-ordered to land it first.
  - Strength: Zero rework; the fix is already proven by 22 green runs on port 4331 in this review.
  - Tradeoff: A future `git log` reader finds a harness change under a feature commit — mitigated by
    D-11 and by the in-file comments.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Fix B**: Call it out for separate landing (cherry-pick the two files onto `feat/ui-polish` and
  drop them from F4).
  - Strength: Cleaner history; the harness fix becomes available to F5's worktree immediately rather
    than after the whole stack merges.
  - Tradeoff: A cherry-pick across a three-deep stack, for a change that is already correct and
    inert-by-default.
  - Confidence: MEDIUM — depends on whether F5 is currently blocked by the `:4321` collision.
- **Follow-on (either way)**: consider `reuseExistingServer: false` when `E2E_PORT` is set, so the
  variable's whole purpose cannot be defeated by a stale server on the chosen port.

### F10 — `handoff.md` was one commit stale

- **Severity**: 📋 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `context/changes/world-progression-stages/handoff.md` (pre-rewrite)
- **Detail**: It reported "**7** commits" with head `f1b7b5a`; the branch carries **8**, head
  `bdf9c6b` (the e2e handoff doc landed after the handoff described itself). Harmless, but a
  zero-context reader would have been off by one.
- **Fix**: Corrected by this step's handoff rewrite.

## Triage

No human in the loop (standing brief, Hard rule 1), so findings were triaged by the reviewer rather
than asked.

**Nothing was fixed in source.** The permitted direct-fix path was scoped to CRITICAL findings, and
there are none. F1 and F2 are one-to-three-line fixes but they touch rendered UI and an accessibility
contract, which deserve their own commit and their own verification run rather than being folded into
a review commit.

| Finding | Decision | Where |
|---|---|---|
| F1 — empty next-upgrade card | **DEFERRED → follow-up** | `follow-ups/review-fixes.md` #1 |
| F2 — `role="img"` on stage markers | **DEFERRED → follow-up** | `follow-ups/review-fixes.md` #2 |
| F3 — deploy-ordering note | **DEFERRED → follow-up** (Fix A, docs only) | `follow-ups/review-fixes.md` #3 |
| F4 — `<lg` connector | **ACCEPTED** — reasoned in-file, cosmetic | recorded here + follow-up #4 (optional) |
| F5 — `earned` window semantics | **DEFERRED → follow-up** (doc line) | `follow-ups/review-fixes.md` #5 |
| F6 — two locks in the migration | **ACCEPTED** — do not rewrite an applied migration | recorded here |
| F7 — duplicate savings bar / `aria-hidden` | **DEFERRED → follow-up** (the `aria-hidden` half) | `follow-ups/review-fixes.md` #6 |
| F8 — `world.name` ×3 | **DEFERRED → follow-up** | `follow-ups/review-fixes.md` #7 |
| F9 — `E2E_PORT` placement | **ACCEPTED via Fix A** — keep in this branch | recorded here |
| F10 — stale handoff | **FIXED** — handoff rewritten this step | `handoff.md` |

**Merge guidance.** The branch is **mergeable as-is**; none of the seven deferred items blocks it.
Merge order for the stack is **F2 `dashboard-recent-activity` → F1 `parent-weekly-activity-chart` →
F4 `world-progression-stages`**. F1 carries its own eight-item `follow-ups/review-fixes.md` from its
own review; that is F1's business, not F4's.
