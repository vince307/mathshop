<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: "Ostatnia aktywność" Feed on the Child Dashboard

- **Plan**: `context/changes/dashboard-recent-activity/plan.md`
- **Scope**: Full plan — Phases 1–4 of 4 (all `## Progress` rows `[x]`)
- **Branch**: `feat/dashboard-recent-activity` (5 commits off `feat/ui-polish`)
- **Date**: 2026-08-23
- **Verdict**: **APPROVED** — mergeable as-is; no CRITICAL finding, no blocking follow-up
- **Findings**: 0 critical, 1 warning, 6 observations

> Run context: `context/runs/2026-08-22-autonomous-five/agent-contract.md`. Hard rule 1
> forbids `AskUserQuestion`, so the skill's save prompt and its per-finding triage were
> **decided, not asked**. Every finding below carries a `Decision:`; nothing is `PENDING`.

## Autonomous decisions taken by this review step

- **Reviewed from git objects, not from the working tree, and reviewed it myself rather
  than fanning out to sub-agents.** The shared tree was on `feat/ui-polish` when this step
  opened and had been switched to **`feat/parent-security-screen`** by a concurrent agent
  before the review finished — `context/changes/dashboard-recent-activity/` no longer
  existed on disk. The skill's two parallel sub-agents read files by path; they would have
  read another feature's source and reported it as this one's. Every claim below is
  therefore grounded in `git diff feat/ui-polish..feat/dashboard-recent-activity` and
  `git show feat/dashboard-recent-activity:<path>`. *What would change the answer:* a
  dedicated worktree for this branch, which the step's constraints did not allow.
- **The suites were NOT re-run.** Running them would have exercised
  `feat/parent-security-screen` and reported the result as this feature's — the one thing
  the step brief explicitly forbids. The implementer's numbers were instead
  **re-derived statically**; see "Success criteria" below. Recorded as F2.
- **Artifacts written as untracked files at their canonical paths** (the folder was
  recreated). No commit, no stage, no branch switch — see the handoff for the two-line
  recovery if `git checkout feat/dashboard-recent-activity` refuses.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING (1 finding) |

**► Overall: APPROVED.** The branch needs no follow-up commit to be mergeable. The single
warning is a stale line in the plan's own Progress table, not a defect in shipped code.

---

## The six things this review was asked to verify

### 1. The `profile_id` filter — **CONFIRMED on every query path, and the guard is real**

`git grep 'from("shift_log")'` on the branch returns exactly three sites:
`child-profiles.ts:131` (the `appendShiftLog` **insert**), `reports.ts:108`
(`getWeeklyReport`, pre-existing, already carries its own `.eq("profile_id", …)`), and
`reports.ts:153` — the new `listRecentActivity`, which reads:

```ts
.from("shift_log")
.select("id, created_at, skills, upgrade_purchased")
.eq("profile_id", profileId)
.order("created_at", { ascending: false })
.limit(limit);
```

The diff introduces **no second read path** — no API route, no island fetch, no direct
client query in `.astro` — so there is exactly one place the filter could go missing, and
it is present. RLS on `shift_log` is account-scoped (all four policies
`auth.uid() = account_id`), so this line is the only sibling separation that exists; the
doc comment says so in those words.

**The isolation suite genuinely covers it.** `tests/recent-activity-isolation.test.ts`
seeds two profiles on account A (one `shift_log` row each, inserted through **A's own
client**, admin only provisions/tears down — L-001/L-002 respected) plus a profile and a
row on account B. Traced against a hypothetically filter-less implementation:

| Case | With filter | Filter dropped |
|---|---|---|
| 1. `listRecentActivity(A, profileA1)` → `toHaveLength(1)` **and `rows[0].id === rowA1`** | green | **red** — 2 rows |
| 2. result must not contain `rowA2` | green | **red** |
| 3. `listRecentActivity(A, profileA2)` → `[rowA2]` | green | **red** |
| 4. `listRecentActivity(B, profileA1)` → `[]` | green | **red** — returns B's own row |

Case 1 asserts the **identity**, not just the count, so two same-shaped rows cannot satisfy
it — the plan-review's F4 fix (seeding account B a row of its own so case 4 is not vacuous)
did land. The unit suite independently pins the call shape:
`expect(calls.find(c => c.method === "eq")?.args).toEqual(["profile_id", "profile-a"])`.
Two independent guards, one of them against a real database.

### 2. Plan adherence, including D10 — **MATCH on every phase; row 4.4's wording is stale, the code is right**

Every contract in Phases 1–4 landed as specified: the eight dictionary keys verbatim; the
`tasksDone` form table exactly as tabulated (and reusing the existing `polishPlural`
instance, not a second `Intl.PluralRules`); `ACTIVITY_TIME_ZONE` / `warsawDayKey` /
`toActivityEntry` with the DST-proof `previousDayKey` calendar step; `RecentActivityRow`
kept separate from `ShiftLogRow` (R2 respected); the component's structure, badge tones,
`min-w-0` + `break-words`, three render states; the frontmatter wiring inside block B after
the results `<section>`; both e2e assertions.

**D10 is implemented.** `RecentActivity.astro:60` is `grid gap-3 sm:grid-cols-3`. Tailwind's
`sm` is 640px, so at the `touch` project's 712px the feed is **3-across**, matching
`SkillCards` (`sm:grid-cols-3`) and the results tiles (`sm:grid-cols-4`) directly above it,
and at 390px it is still one card per row.

**Progress row 4.4 is therefore a stale doc line, not a behaviour mismatch.** Its text still
reads "shows the stacked feed" at 712px. D10 is the later, explicit, reasoned decision and
the code matches it; the row's substantive content (one copy of the heading in the a11y
tree, correct render in the touch project) is unaffected by the column count. Recorded as
**F1**, doc-only, non-blocking.

### 3. Truthfulness — **CONFIRMED: nothing rendered that the database does not hold**

- **No `zł`, no derived money.** `grep -niE "zł|cost|earn"` over `RecentActivity.astro` and
  `src/data/activity.ts` hits **only prose in the doc comments explaining why there is
  none**. No `EARN_PER_TASK`, no catalogue `cost`, no right-hand amount column — D1 honoured
  at both the data layer and the component.
- **`N zadań` is the shift's real task count.** It is `readSkillState(row.skills).math.completed
  + …money.completed` read off *that row's own* stored jsonb. Shift tasks map only to those
  two competencies (`competencyForTaskType`: counting → math, change-making → money;
  `decisions` accrues at purchase, and `/api/shifts/complete`'s zod schema accepts only
  `{ math, money }` and refines `math.completed + money.completed <= taskCount`). So the
  rendered number is a stored aggregate, never a re-derivation. A purchase row's fixed
  `{ decisions: … }` payload yields 0, and 0 is never displayed (the label degrades to the
  bare `Zmiana ukończona`).
- **Day words come from the row's own `created_at`**, bucketed against one `now` captured
  once in the frontmatter, so all three cards agree and nothing ticks after render.
- **Kind is discriminated on `upgrade_purchased !== null` only** — never on the `skills`
  keys — with a unit test named for exactly that trap.

### 4. Accessibility and locator hygiene — **CLEAN**

- The section adds an `<h2>`; no `h1` anywhere in the diff. `start.astro`'s only `h1` is the
  shell's greeting, untouched.
- `"Ostatnia aktywność"` appears once in `pl.ts` and is rendered by one component on one
  page — no duplicated accessible name.
- **`Dzisiaj` is rendered but never asserted.** Both new specs carry an inline comment saying
  why; `git grep activityToday -- e2e/` returns only those comments. The `t.start.missionHeading`
  collision cannot bite.
- **The empty state contains no `Ukończone zmiany`.** `activityEmpty` is
  `"Jeszcze nic tu nie ma. Twoje zmiany i ulepszenia pojawią się w tym miejscu."` — `zmiany`,
  never the `statShifts` phrase, in either direction. The shift label keeps the reversed word
  order `Zmiana ukończona` for the same reason.
- Re-ran the collision audit over all eight new strings against `portfel` /
  `rozbuduj sklep` / `czas otworzyć sklep!` / `cześć,` / `ukończone zmiany`: **no hit in
  either direction**. Swept the reverse case too — the six pre-existing `/app/start`
  locators listed in the plan, plus `gameplay-restore`'s second test — none of them
  substring-matches any new string.
- No `data-testid` anywhere in the diff.
- The three render states are guarded with pure booleans (`entries !== null && entries.length === 0 && …`),
  so the classic `{0 && <p/>}` leak that would print a literal `0` cannot occur.

### 5. Error containment — **CONFIRMED: the feed cannot take the dashboard down**

`start.astro:53-62` wraps **both** the query and the `toActivityEntry` mapping in one
`try`/`catch`, guarded by `if (supabase && profile)`, and the `catch` sets
`activityEntries = null` without rethrowing. `listRecentActivity` throwing therefore
degrades to a section that renders its heading plus one muted `t.start.activityError` line,
while the hero, skills, results tiles and rail render normally — never a 500, and never a DB
failure masquerading as "you have not played yet" (the empty and error states are distinct
strings on distinct branches). This is the same posture as `report.astro:35-42`, which
catches per child with an equally silent `catch`. The no-profile branch renders
`EmptyStateCard` and never reaches the component at all.

### 6. Pattern compliance — **PASS on every house rule**

| Rule | Finding |
|---|---|
| `cn()` for class merging | Honoured *through* the house primitive: `childCard()` is a `cn()` builder (`childCard.ts:1`), and `class:list` is the established `.astro` idiom — `git grep -l "cn(" -- '*.astro'` returns **zero** files repo-wide, while `SkillCards.astro` uses the exact `class:list={[...]}` shape this component copies. |
| i18n via `src/i18n/pl.ts`, no literals in components | `grep -nE '"[A-ZŁŚĆŻŹÓĘĄŃ]'` over `RecentActivity.astro` returns nothing; every string resolves through `t`. Placeholder filling uses `.replace("{name}", …)`, the pattern used at 20+ call sites in `src/`. |
| Service logic in `src/lib/services/` | `listRecentActivity` lives in `reports.ts` beside `getWeeklyReport`; the component fetches nothing. |
| SSR frontmatter, not island-side fetching | The component is `.astro`, has no `client:` directive, ships zero JS, calls no `new Date()`, and derives nothing — the whole point of the parity work's hydration fix. |
| Pure `src/data/` module | `src/data/activity.ts` imports exactly one thing: `@/data/skills`. No i18n, no React, no Supabase. |
| Test conventions | The isolation suite mirrors `tests/report-isolation.test.ts` line for line, including `avatar: "lis"` and `.overrideTypes<…, { merge: false }>()`, both established precedents in that file. |
| Append-only edit to a contended file | `git diff -- src/lib/services/reports.ts` is `@@ -113,3 +113,48 @@` with **45 insertions, 0 deletions**, all at EOF. Nothing above the append point moved, was renamed, or was reformatted. Criterion 2.6 verified directly. |
| `prerender = false` / RLS-in-migration | N/A — no API route, no migration, no schema change in the diff. |

---

## Scope discipline

Nineteen files in the diff; six are this change's own `context/changes/` documents. Of the
thirteen code/doc files, **every one is named in the plan's Changes Required**. Nothing
belonging to another feature was touched: `src/types.ts` and `tests/reports.test.ts` — the
two files D5 fenced off for F1 — are **absent from the diff** (criterion 2.7 verified), and
no file from `parent-weekly-activity-chart`, `parent-security-screen`,
`world-progression-stages` or `world-selection-screen` appears.

`docs/reference/contract-surfaces.md` **is** in the diff, and that is planned (Phase 2,
change 4), not creep: two lines under `## public.shift_log` gain `listRecentActivity` and
`tests/recent-activity-isolation.test.ts`. It is also the file the concurrently-planned
weekly-chart feature will edit, so the R1 merge rule stands — see **F6**.

## Success criteria

Static criteria were re-verified from git objects in this step:

| Criterion | Result |
|---|---|
| 1.4 no i18n/React/Supabase import in `activity.ts` | ✓ one import: `@/data/skills` |
| 1.6 no blacklisted substring in the eight new strings | ✓ no hit, both directions |
| 2.6 `reports.ts` diff is appended lines only | ✓ 45 insertions, 0 deletions, at EOF |
| 2.7 `tests/reports.test.ts` / `src/types.ts` absent from the diff | ✓ absent |
| 3.4 no `client:` directive in `RecentActivity.astro` | ✓ none |
| 3.5 no hard-coded Polish literal in the component | ✓ none |
| 4.1 Playwright count unchanged at 15 | ✓ the e2e diff adds **no** `test(` block — only assertions inside two existing tests |

Suite-execution criteria (1.1–1.3, 2.1–2.5, 3.1–3.3, 3.11, 4.2–4.3) could **not** be
re-executed here — see F2 — but they re-derive consistently: the claimed `npm test` 318 is
exactly 299 + the **19** new `it()` blocks the diff contains (10 in `activity.test.ts`, 1 in
`i18n-helpers.test.ts`, 4 in `recent-activity.test.ts`, 4 in the isolation suite), and the
claimed `astro check` "168 files" is exactly the baseline 163 + the 5 new files. Manual rows
1.5, 3.6–3.10, 4.4–4.6 are corroborated by the artefacts a browser pass produces (D10's
per-viewport findings, the `upgradeCopy` fallback observation nobody would invent) rather
than rubber-stamped — except row 4.4's wording, which is F1.

---

## Findings

### F1 — Progress row 4.4 still describes the pre-D10 layout

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `context/changes/dashboard-recent-activity/plan.md:1032` (Progress row 4.4);
  behaviour at `src/components/child/RecentActivity.astro:60`
- **Detail**: Row 4.4 is checked `[x]` and reads "The `touch` (712px) run shows the **stacked
  feed** with one copy of the heading". D10 changed the grid to `sm:grid-cols-3` (640px), so
  at 712px the feed is **3-across**; stacking now happens below 640px only. The shipped code
  matches D10, which is the later and explicitly reasoned decision, and the row's load-bearing
  half (one copy of the heading in the a11y tree) is untouched by the column count. So this is
  a stale sentence in the verification record, not a defect — but a `[x]` row whose text is
  false is exactly what makes a future reader distrust the table.
- **Fix**: In `plan.md`, leave row 4.4's title unedited (the Progress convention forbids
  renaming step titles) and add one line immediately beneath the Phase 4 `#### Manual` block:
  `> Note (D10): the feed is 3-across at 712px since the grid moved to sm:grid-cols-3; the stacking this row describes now happens below 640px. The row's assertion (one copy of the heading) is unaffected.`
- **Decision**: **RECORDED as a non-blocking follow-up** — written to
  `follow-ups/review-fixes.md`. Not applied here: another agent is mid-work in the shared
  tree and this step may not commit, so an uncommitted edit to a branch-tracked plan file
  would be lost or would conflict on checkout.

### F2 — The suites were not re-executed in this step

- **Severity**: 👁 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: N/A (process)
- **Detail**: The shared working tree is checked out on `feat/parent-security-screen`, so
  `npm test`, `npx playwright test` and `npm run check` would have exercised a different
  feature's code. They were deliberately not run rather than run and mis-attributed. The
  implementer's three deliberate-break results (drop `.eq("profile_id", …)` → 4 red; `throw
  error` → `return []` → 1 red; naive `−86_400_000` → the October case red) likewise could not
  be reproduced; each was instead traced by reading, and each analysis holds. Every *static*
  criterion in the table above **was** verified in this step from git objects.
- **Fix**: Before merge, on a tree checked out at `feat/dashboard-recent-activity` with the
  local stack up: `npm run lint && npm test && npm run check && npx playwright test`.
- **Decision**: **ACCEPTED** — the constraint is structural to this run, and the numbers
  re-derive exactly (318 = 299 + 19 new `it()`s; 15 unchanged; 168 = 163 + 5 files).

### F3 — `DD.MM` carries no year

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence (accepted deviation)
- **Location**: `src/data/activity.ts:88-91` (`dayMonthFromKey`)
- **Detail**: A row from a previous year renders identically to one from this year
  (`19.08`). D6 chose `DD.MM` deliberately — short, plural-free, and reusing the civil-date
  key already computed — and with `limit = 3` an entry that old is only reachable by a child
  returning after a year away.
- **Fix**: none needed; if it ever matters, append `.YY` inside `dayMonthFromKey` — one line,
  one test.
- **Decision**: **SKIPPED** — matches D6 as written.

### F4 — A fresh `Intl.DateTimeFormat` is constructed on every `warsawDayKey` call

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (performance)
- **Location**: `src/data/activity.ts:63-72`, called twice per row from `toActivityEntry`
- **Detail**: Six formatter constructions per dashboard render at `limit = 3`. `Intl`
  constructors are among the more expensive standard-library calls, but this is an SSR page
  already making two round-trips, and the count is bounded by the limit. The `todayKey` is
  also recomputed per row rather than once per list.
- **Fix**: hoist a module-level `const WARSAW_FORMAT = new Intl.DateTimeFormat(…)` and reuse
  it. Purely mechanical; no behaviour change.
- **Decision**: **SKIPPED** — measurable only in a synthetic loop at this scale.

### F5 — The feed's `catch` logs nothing

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/pages/app/start.astro:59-61`
- **Detail**: `catch { activityEntries = null; }` swallows the error silently, so a persistent
  query failure is visible to the child (the honest error line) but invisible in server logs.
  This is **exactly** the shape of the precedent it copies (`report.astro:38-41`, also a bare
  `catch { report = null; }`), so it is consistent rather than novel — the project has no
  server-logging convention for this class of failure.
- **Fix**: none in this change's scope; if server-side observability is wanted, it should
  land as one convention across both call sites, not asymmetrically here.
- **Decision**: **SKIPPED** — precedent-consistent.

### F6 — `contract-surfaces.md` and `reports.ts` remain on a collision course with the parallel features

- **Severity**: 👁 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: `docs/reference/contract-surfaces.md:38-39`; `src/lib/services/reports.ts` EOF
- **Detail**: Both edits are planned (Phase 2), and the `reports.ts` one is append-only so it
  rebases cleanly under anything inserted above it. The two `contract-surfaces.md` lines are
  **rewritten in place**, and the concurrently-planned weekly-chart feature edits the same
  `## public.shift_log` block — a same-line conflict, as R1 predicted. Nothing validates this
  file (`grep -rn "contract-surfaces" tests/ e2e/ src/` → 0 hits), so a bad resolution fails
  silently.
- **Fix**: on conflict, **keep both symbol sets** — never `--ours` / `--theirs`. The
  Consumed-by line must end up naming `getWeeklyReport` / `aggregateWeeklyReport`,
  `listRecentActivity`, **and** whatever the chart adds; the Isolation-test line must keep all
  three suites. After rebasing `reports.ts`, re-read `getWeeklyReport` to confirm nothing above
  the append point was reverted.
- **Decision**: **ACCEPTED, carried forward** — restated in the handoff as live risk R1.

### F7 — The demo profile "Ania" now holds mutated, back-dated `shift_log` rows

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (test-data hygiene)
- **Location**: local database only — `ui-polish-demo@example.test`, profile "Ania"
- **Detail**: D11's manual pass left three rows (a purchase dated today, a shift back-dated to
  yesterday, a shift back-dated to 19.08), `completed_shift_count` 8, wallet 144 zł, one owned
  upgrade. **Nothing automated depends on it**: `git grep -rn "ui-polish-demo"` over the whole
  branch hits only three `context/` documents — no spec, no helper, no source file — and every
  e2e spec provisions and tears down its own account (`provisionAccount` / `seedChildProfile`
  / `deleteUser`). The only downstream effect is on *manual* passes: the weekly-chart feature
  verifying against Ania will see three rows spread over three distinct days (useful, in fact),
  and will find that two shift rows do **not** reconcile with `completed_shift_count` 8. That
  gap is the documented best-effort-writer behaviour (R4), not a defect to chase.
- **Fix**: none. Reset the demo account with `tests/helpers/supabase.ts` if a pristine profile
  is ever wanted.
- **Decision**: **ACCEPTED** — recorded here and in the handoff so nobody re-investigates it.

### F8 — `getByText(t.start.activityShift)` assumes exactly one shift row in the feed

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency (e2e robustness)
- **Location**: `e2e/gameplay-restore.spec.ts:79`
- **Detail**: The assertion substring-matches `Zmiana ukończona · N zadań`, which is the right
  call for a nondeterministic task count. It is unambiguous **today** because the journey
  completes exactly one shift before reading `/app/start`. If that spec ever gains a second
  shift before the assertion, the feed shows two shift cards and `getByText` trips Playwright's
  strict mode with two matches — a confusing failure far from its cause.
- **Fix**: if a second shift is ever added to that journey, scope it —
  `page.getByRole("listitem").filter({ hasText: t.start.activityShift }).first()`.
- **Decision**: **SKIPPED** — correct as written; noted for whoever extends that spec.

---

## Triage summary

```
═══════════════════════════════════════════════════════════
  TRIAGE COMPLETE  (decided autonomously — hard rule 1)
═══════════════════════════════════════════════════════════

  Recorded as follow-up:  F1                (1)  — doc-only, NON-BLOCKING
  Accepted:               F2, F6, F7        (3)
  Skipped:                F3, F4, F5, F8    (4)
  Fixed in code:          none              (0)  — no CRITICAL finding

  Branch is MERGEABLE AS-IS. No follow-up commit is required.
═══════════════════════════════════════════════════════════
```

No source file was edited by this review step: there was no CRITICAL finding to fix, and the
shared tree is on another feature's branch.
