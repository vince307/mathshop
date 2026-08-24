<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Parent weekly activity chart + first-try tile

- **Plan**: `context/changes/parent-weekly-activity-chart/plan.md`
- **Scope**: all six phases (35/35 Progress rows `[x]`)
- **Branch**: `feat/parent-weekly-activity-chart`, **stacked on `feat/dashboard-recent-activity` (F2)** —
  reviewed as `git diff feat/dashboard-recent-activity..feat/parent-weekly-activity-chart`
  (7 commits, `ec47dd1` → `e8827d6`)
- **Date**: 2026-08-23
- **Verdict**: **NEEDS ATTENTION** — no CRITICAL finding, nothing blocks the merge; four WARNINGs are
  recommended follow-ups, not gates
- **Findings**: 0 critical · 4 warnings · 4 observations

## Autonomous decisions

This run has no human in the loop (`context/runs/2026-08-22-autonomous-five/agent-contract.md`,
hard rule 1). The skill ends with an `AskUserQuestion` triage prompt; it was not asked.

- **Decided "Triage findings" over "Save report only."** Every finding below carries a
  `Decision:` other than `PENDING`. No finding was CRITICAL, so the standing authorisation to fix a
  small, unambiguous CRITICAL directly in source was **not exercised — no source file was edited by
  this review step.** Rejected: applying the four WARNING fixes anyway. Each touches a file another
  in-flight feature (F4) will edit, and none is a correctness defect; changing shipped source on a
  review step, unattended, to satisfy a judgement call is the failure mode the review exists to
  catch. They are recorded in `follow-ups/review-fixes.md` with file, symbol and required change.
  *What would change the answer:* a finding that made the screen wrong, leaked data, or failed a
  suite — then it is fixed here, in its own Conventional Commit.

## Verification — run by the reviewer, not accepted from the handoff

Every number below was observed on `e8827d6` in this working tree, with the local Supabase stack up.

| Check | Implementer claimed | Reviewer observed | |
|---|---|---|---|
| `npm run check` | 0 errors, 0 warnings, 9 hints | **0 errors, 0 warnings, 9 hints** (173 files) | ✅ |
| `npm run lint` | clean | **clean**, exit 0 | ✅ |
| `npm run build` | Complete! | **Complete!** (server built in 4.89 s) | ✅ |
| `npm test` | 346 passed / 318 baseline | **44 files, 346 passed** | ✅ |
| `npx playwright test` | 17 passed / 15 baseline | **17 passed** (both new specs green) | ✅ |

The **318 baseline** could not be re-measured without switching branches (forbidden in this tree), so
it was checked arithmetically instead: the diff adds 11 tests to `tests/reports.test.ts`, 6 to
`tests/skills.test.ts`, 6 in `tests/weekly-activity-chart.test.tsx` and 5 in
`tests/weekly-report-tiles.test.tsx` = **28**, and 346 − 28 = 318. The claim reconciles exactly.

`git diff --stat` against F2 shows **20 files, 3671 insertions** — of which 2781 are this change's own
`context/changes/` documents. The production surface is 6 files.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING (3 findings) |
| Success Criteria | WARNING (2 findings) |

## The five checks this review was commissioned to make

**AD-9 — the bars genuinely decompose the tile. VERIFIED, with one gap.**
The invariant test is real and would go red on divergence:
`tests/reports.test.ts` → *"makes the bars a decomposition of the tasks tile: Σ daily === Σ
practice.completed"* builds three rows across three different Warsaw days (one of them a `decisions`
purchase), then computes `barsTotal` from `report.daily` and `tileTotal` with the **same expression
the component uses** (`COMPETENCIES.reduce((sum, c) => sum + practice[c].completed, 0)`), asserts they
are equal **and** pins the value at 6. Drop `decisions` from the daily fold and it reads 5 vs 6 — red.
The invariant also holds structurally, which is the stronger evidence: `addSkillDelta`
(`src/data/skills.ts:76-88`) and `readSkillState` (`:56-67`) apply the *identical* `safeCount` coercion
to the *identical* field, including on `null` and on a non-object payload, so the two sides cannot
drift apart for any input. The gap is F1 below: no *committed* test renders a non-zero chart beside a
non-zero tile, so the "74 on the tile, seven bars summing to 74" evidence is not reproducible.

**AD-2 — `math + money` only, and the creep test bites. VERIFIED.**
`ACCURACY_COMPETENCIES = ["math", "money"]` (`src/data/skills.ts:104`) with the reason in a comment.
`tests/skills.test.ts` → *"ignores decisions so shopping cannot inflate the number"* asserts
`math 5/10 + decisions 5/5 === 50`. Re-adding `decisions` yields `10/15 → 67`: red, and the sibling
test *"returns null, not 100, for a week of purchases and no tasks"* goes red too. Two independent
tripwires, not one.

**AD-3 — `0/0` renders `—`, never `NaN%`. VERIFIED, and the assertion was not weakened.**
`firstTryPercent` returns `null` before any division (`if (completed === 0) return null`), and
normalises through `readSkillState` first so a denormalised state cast to `SkillState` still cannot
produce `NaN` — `tests/skills.test.ts` proves that with a fixture carrying `undefined`, `NaN` and
negative counters. `expectNoNaN()` runs on **all five** fixtures in `tests/weekly-report-tiles.test.tsx`,
including the played-week one where `String(firstTry)` is the branch that could actually emit `NaN`.
The markup fix is right: the `sr-only` reason is now a **sibling** of the value `<p>`
(`WeeklyReport.tsx:150`), so the value's own text is exactly `—`. The e2e assertion that forced it is
committed and unweakened: `getByText(t.report.statFirstTryNone, { exact: true })` — Playwright reads
`textContent`, so nesting the span again would fail it. Worth stating plainly: the jsdom assertion
would **not** have caught this (testing-library's `getNodeText` reads only direct text children), so
the credit belongs to the browser layer, and removing that e2e assertion would remove the only guard.

**AD-5 — one Warsaw implementation. VERIFIED, and this is the strongest part of the change.**
`reports.ts:3` imports `warsawDayKey` from `@/data/activity` (F2) and calls it at `:64`. A grep of
`src/` for `Europe/Warsaw`, `zoneOffsetMinutes` and `getTimezoneOffset` finds **no new offset
arithmetic anywhere in the diff**: `zoneOffsetMinutes` remains the single, module-private UTC-offset
parser, now carrying a "do not re-implement it" comment pointing at `warsawDayKey`. The new
`weekDayKeys` steps the *civil-date key* via `Date.UTC(y, m-1, d + offset)` — a pure calendar
operation with no timezone in it — and is tested across the 25-hour fall-back weekend
(`weekDayKeys(2026-10-25)` and a 22:30 UTC row that must land on Sunday the 25th). The DST-weekend
bug class this check exists to find is genuinely absent. Residual: see F7.

**AD-1 — the tile ships behind the parent gate, and no copy reintroduces the false argument. VERIFIED.**
`src/pages/app/report.astro` still redirects to `/app/parent-pin` without the signed marker, and the
island is imported by that route only. Every occurrence of the "child-side link" claim in the diff is
the **corrected** version (`plan.md:853`, `:1143`, `handoff.md:126`, `change.md:76`, and finding N1 in
`reviews/plan-review.md`), each naming `AppShell.astro:65` and `:120-130` as rendering "Panel rodzica"
on every child screen. Confirmed against the file: `AppShell.astro:65` spreads the parent tab into
`tabs`, and `:120-130` renders the sidebar link. No source comment repeats the false argument.

**The earnings tile is absent. VERIFIED.**
`grep -rni "earned|zł zdobyte|84 zł|statEarn" src/components/parent/ src/i18n/pl.ts` returns only
`t.results.earnedLabel` / `starsLabel` (the child results screen, pre-existing) and the `pl.ts`
comment. No placeholder, no zero, no estimate, and `package.json` is untouched — **no charting
library**. The rewritten comment (`pl.ts:411-418`) is accurate about what remains deferred: it names
the earnings tile as the only still-deferred *tile*, which is true — the mockup's other absent
elements (week picker, export, `+4 więcej niż tydzień temu`, `Świetny wynik!`, `Zapasy`, recommended
missions) are not tiles and are listed in the plan's "What We're NOT Doing", not in this comment's
scope ("Per-child summary tiles"). Checked against the mockup itself
(`assets/matmaverse-missing-screens-v3-web/05-parent-weekly-report-web.png`): four tiles there, three
here, and the chart's shape — heading *Aktywność w tym tygodniu*, ticks `0 4 8 12 16`, a value label
over each bar, `Pon…Nd` beneath, a swatched legend — is reproduced faithfully. The legend wording
deviates deliberately and is documented (AD-9).

## Findings

### F1 — No committed test asserts the decomposition *on screen*; the evidence for it was deleted

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `tests/weekly-report-tiles.test.tsx:22-26`
- **Detail**: AD-9 is the invariant the plan calls the one that matters most to a reader of the
  screen, and the implementer's evidence for it end-to-end is *"the tile read 74 and the seven bars
  summed to 74"* — observed in a temporary Playwright spec that was **deleted before the Phase 6
  commit**. In the repo as it stands, the invariant is proven only at the service boundary
  (`aggregateWeeklyReport`). Every fixture in `tests/weekly-report-tiles.test.tsx` passes
  `EMPTY_WEEK` — seven zeros — as `daily`, so **no committed test ever renders a non-zero chart
  beside a non-zero tile.** The risk of an actual divergence is low (both figures derive from the same
  `child.report` object and the chart component only reads what it is handed), but the headline claim
  of the feature currently rests on a screenshot nobody can reproduce.
- **Fix**: Add one case to `tests/weekly-report-tiles.test.tsx`: a `ChildReport` whose `practice`
  and whose `daily` describe the same week, then assert that the sum of the counts in the chart's
  `sr-only` list equals the number rendered in the `statTasks` tile. ~12 lines, no new fixture
  machinery — the `week()` helper in `tests/weekly-activity-chart.test.tsx` is already the shape needed.
- **Decision**: RECORDED AS FOLLOW-UP (`follow-ups/review-fixes.md`)

### F2 — The deleted spec took the `shift_log` seeder with it — the exact asset that made Risk E2E-3 expensive

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria / Plan Adherence
- **Location**: `context/changes/parent-weekly-activity-chart/plan.md:733` (Phase 6 §3); AD-12
- **Detail**: Phase 6 §3 defers Risk E2E-3 (*a seeded week draws non-zero bars*) on one stated ground:
  *"`e2e/helpers/` has **no `shift_log` seeder**, so covering it means either building an admin-side
  seeder or driving a full gameplay run."* AD-12 then records that the manual rows were driven by a
  temporary spec that **did** insert a full seeded week into `shift_log` — i.e. the implementer built
  the seeder, used it once, and deleted it. That is the one artefact that would have made E2E-3 cheap,
  and its deletion is why rows 4.7 (1280 px mockup fidelity) and the seeded-week half of 4.8 have no
  reproducible evidence. Rows 4.6, 5.8 and 6.4 are fine — they are genuinely covered by the committed
  `e2e/parent-weekly-report.spec.ts`. Rows **1.6 and 3.5 are honestly flagged as inspection-based and
  are correctly so**: 1.6 asserts a phase was invisible (true by construction — no component read
  `daily` at `ec47dd1`), and 3.5 is a documentation read, which is the right instrument for a comment.
  The verdict asked for on AD-12's evidence quality: **the honesty is exemplary and the method was
  sound; the disposal was the mistake.** A throwaway spec that proved a headline invariant should have
  been promoted to `e2e/helpers/` as a seeder, not deleted.
- **Fix A ⭐ Recommended**: Rebuild the `shift_log` insert as `seedShiftWeek(profileId, counts)` in
  `e2e/helpers/accounts.ts` and land Risk E2E-3 with it, asserting the on-screen decomposition in a
  real browser.
  - Strength: Closes F1 and F2 with one artefact, and the plan already says the seeder is the blocker.
  - Tradeoff: A new admin helper and one more spec; F4 was expected to fund this.
  - Confidence: MEDIUM — the code existed once and passed, but it is not in any commit to recover.
  - Blind spot: Whether the deleted spec's insert honoured the `shift_log` NOT NULL set is unknown.
- **Fix B**: Accept as-is and let F4 build the seeder when it touches `shift_log` writes, as
  AD-10's reversal condition already anticipates.
  - Strength: Zero cost now; matches the plan's own sequencing.
  - Tradeoff: Ships a feature whose headline invariant has no browser-level guard.
  - Confidence: HIGH — this is exactly what the plan decided.
  - Blind spot: F4's scope could change and never fund it.
- **Decision**: RECORDED AS FOLLOW-UP (Fix A preferred; not blocking)

### F3 — Two `page.evaluate` DOM reads added to a spec without amending e2e/CLAUDE.md's closed list

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `e2e/parent-weekly-report.spec.ts:26`, `:74`
- **Detail**: `e2e/CLAUDE.md:10-19` sanctions three DOM-access exceptions and says outright
  *"closed list — do not extend it by analogy."* The plan's Phase 6 §2 argues the new
  `page.evaluate` reads are fine because *"a `page.evaluate` measurement is not an element
  locator"* — which is an analogy, and is the very argument the existing list already had to
  overrule: exception 1 sanctions `waitForIslands()` **even though** that helper's own comment
  makes the identical "infrastructure wait, not an element locator" case. So the precedent is that
  such a read needs an entry, not a rationale. These are also the first `page.evaluate` calls in a
  *spec* rather than a helper (`document.body.innerText`, and
  `documentElement.scrollWidth - window.innerWidth`). No harm to locator stability, and the
  overflow measurement is genuinely valuable — this is a rule-compliance finding, not a defect.
- **Fix**: Move both measurements into `e2e/helpers/` beside `waitForIslands` and add a fourth
  numbered entry to the sanctioned list in `e2e/CLAUDE.md` naming them. (`e2e/CLAUDE.md` is outside
  this change's file set, which is why it was not edited here.)
- **Decision**: RECORDED AS FOLLOW-UP

### F4 — The chart's accessible name is its weak link; the seven values themselves are sound

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency (accessibility)
- **Location**: `src/components/parent/WeeklyActivityChart.tsx:128-136`; `src/i18n/pl.ts:433`
- **Detail**: Judged honestly, and the two halves differ. **This is not a token `aria-label`** — the
  `<svg>` is correctly `aria-hidden="true" focusable="false"` and a real `sr-only <ul>` carries seven
  `<li>` text nodes (`"Poniedziałek: 8"`), which a screen-reader user reaches in browse mode and can
  navigate item by item. A parent using AT genuinely gets all seven values. AD-8's reasoning — that a
  DOM list beats SVG `<title>`/`role="img"` semantics — is correct and well executed. Two real
  weaknesses remain. (1) The list's name comes from `aria-label` on the `<ul>`; Tailwind v4 preflight
  applies `list-style: none` to every `ul`, which is the long-standing trigger for Safari/VoiceOver
  dropping list semantics — and with the role gone, so is the name-from-author. `getByRole("list",
  { name })` passing in jsdom proves the accessible-name computation, not that any AT announces it.
  (2) `chartDayValue` is `"{day}: {count}"` — **"Poniedziałek: 8" never says 8 of what.** The visible
  heading `div` sits immediately before the list, so context is not wholly lost, which is why this is
  a WARNING and not worse.
- **Fix**: Add `role="list"` to the `<ul>` (survives `list-style: none`), give the heading `div` in
  `WeeklyReport.tsx:177` an `id` and point the list at it with `aria-labelledby` (better supported
  than `aria-label` on a container, ties visible and accessible names together, and — unlike the
  rejected `<h3>` — adds nothing to the page's heading tree, so the existing `getByRole("heading")`
  e2e locators are untouched), and give `chartDayValue` a unit using `tasksDone()` from
  `src/i18n/index.ts:43`, which already handles Polish plurals (`"8 zadań"` / `"1 zadanie"`). The
  copy change routes through the open native-speaker review.
- **Decision**: RECORDED AS FOLLOW-UP

### F5 — Chart geometry mixes `days.length` with `day.weekday`

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: `src/components/parent/WeeklyActivityChart.tsx:63, 96, 113, 121, 132`
- **Detail**: `barStep` derives from `days.length`, while every x-position and both dictionary
  lookups index by `day.weekday` — two sources for the same "which of seven". They agree only because
  `WeeklyReport.daily` is contractually seven Monday-first entries (`src/types.ts:163-166`). Relax
  that and bars render off-plot and `chartDaysLong[day.weekday]` yields `undefined`, producing
  `"undefined: 3"` in the `sr-only` list — the `not.toMatch(/undefined/)` assertion only ever runs
  against well-formed fixtures, so it would not catch it. No current defect: the service always emits
  the frame.
- **Fix**: Derive geometry from a `WEEK_LENGTH = 7` constant, or index consistently by array position.
- **Decision**: RECORDED AS FOLLOW-UP (hardening only)

### F6 — The week query is unbounded against `max_rows = 1000`, and truncation now shows as a wrong chart

- **Severity**: 📝 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/lib/services/reports.ts:167-173`; `supabase/config.toml:18`
- **Detail**: PostgREST truncates at `max_rows = 1000` **without an error**, and because the query is
  `.order("created_at", { ascending: true })` the rows dropped are the *newest*. Pre-existing, and
  unreachable at v1 volumes — but the change alters its symptom: it used to be a slightly low count,
  and is now a chart whose last bars are visibly short. The file's own comment makes *"a DB failure
  must never masquerade as nothing practiced"* an explicit design goal, which silent truncation
  quietly violates. Note this is **not** AD-7's question (an upper `.lt` bound), which was correctly
  decided; it is a row-count ceiling.
- **Fix**: Add an explicit `.limit(1000)` and treat a full page as a signal, or aggregate server-side.
  Deliberately not fixed here — it is a pre-existing property, and `reports.ts` is a live contention
  point with F2 and F4.
- **Decision**: RECORDED AS FOLLOW-UP (low priority)

### F7 — `weekDayKeys` re-implements `previousDayKey`'s key-stepping idiom, `pad2` included

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: `src/lib/services/reports.ts:134-152` vs `src/data/activity.ts:59-71`
- **Detail**: Stated precisely so it is not confused with AD-5's real subject: **this is not a second
  timezone implementation** and AD-5 is fully honoured. But `weekDayKeys` copies `previousDayKey`'s
  `Date.UTC(y, m-1, d ± n)` + `getUTC*` + zero-pad idiom, and declares a local `pad2` inline —
  `activity.ts` has one already. Both are module-private in `activity.ts`, so F1 could not import
  them; the copy was forced, not chosen. Two copies of a three-line calendar step is cheap, but a
  third would not be.
- **Fix**: Export `stepDayKey(key, offset)` from `src/data/activity.ts` and let both call sites use
  it. Owned by whoever next touches either file; a shared edit across two features' branches now
  costs more than it saves.
- **Decision**: RECORDED AS FOLLOW-UP

### F8 — New dead `import React` adds a type-check hint and diverges from the majority style

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/components/parent/WeeklyActivityChart.tsx:1`
- **Detail**: `tsconfig.json` sets `"jsx": "react-jsx"`, so the default import is dead. `npm run check`
  reports it as `ts(6133) 'React' is declared but its value is never read` — one of the 9 hints, and
  the only one this change added. `SkillBars.tsx` and most of `src/components/` omit it; the sibling
  `ParentPinGate.tsx` and `WeeklyReport.tsx` carry it, so this is a minority-but-not-unprecedented
  pattern. Lint is clean either way.
- **Fix**: Delete line 1 of `WeeklyActivityChart.tsx`.
- **Decision**: RECORDED AS FOLLOW-UP

## What was checked and produced no finding

- **Scope discipline — clean.** The changed-file set is exactly the plan's set. No migration, no RLS
  work, no new dependency (`package.json` and the lockfile are untouched), no week-over-week deltas,
  no verdict line, no colour coding, no week picker, no export, no `Zapasy`, no `data-testid`, no edit
  to `docs/reference/contract-surfaces.md` (correct — review R9). The one edit not spelled out in the
  plan is extracting `setPinAndLandOnReport` from `e2e/parent-surfaces.spec.ts` into
  `e2e/helpers/parent-pin.ts`; the plan's Phase 6 §1 says to reuse *"the existing local helper"*, and
  extraction is the non-forking way to do that. Benign, and the whole Playwright suite is green.
- **Safety — clean.** `getWeeklyReport` keeps `.eq("profile_id", profileId)` — which the new test
  *"filters the query to the requested profile (sibling isolation, not RLS)"* now locks explicitly, a
  genuinely valuable addition, since `shift_log` RLS is account-scoped and that filter is the only
  thing separating siblings inside one account. `if (error) throw error` intact. No
  `dangerouslySetInnerHTML` / `set:html`; the only new interpolations are `String.replace` over
  dictionary constants with `String(number)` replacements — no user-controlled replacement string.
  Loops are O(rows) and O(7); the per-child fan-out in `report.astro` is capped at
  `MAX_PROFILES_PER_ACCOUNT = 6`. `tests/report-isolation.test.ts` ran green against the live stack as
  part of the 44-file suite.
- **i18n (L-003) — clean.** All ten keys sit inside the existing `report:` block with the file's
  comment style; array values have precedent (`safetyPoints`). No user-visible literal is hard-coded
  in either component — the only raw text inside the SVG is numeric output in an `aria-hidden`
  subtree. Both new test files read every expected string from `t.report.*` rather than pinning their
  own Polish, which is the right instinct: a test with its own copy would go green against a component
  that stopped using the dictionary.
- **`cn()` — not required.** Every `className` in the new code is a single static literal, exactly as
  in `SkillBars.tsx` / `HudChip.tsx`. The rule targets merged or concatenated class strings.
- **Colour tokens — clean.** Bars, gridlines and labels inherit `currentColor` from
  `text-primary` / `text-border` / `text-muted-foreground`, so both themes follow. No hard-coded hex.
- **No dead navigation, no duplicated accessible name.** No nav entry added; the three-tile row is one
  responsive `grid-cols-2 sm:grid-cols-3`, not a `hidden`/`lg:hidden` pair, so the accessibility tree
  is identical at every width — and Risk E2E-1 asserts `getByRole("heading", { name: t.report.heading
  })` still resolves to exactly one element.
- **Deliberate-break evidence.** Both break checks AD-12 reports (adding `decisions` to
  `ACCURACY_COMPETENCIES`; making the chart throw on hydration) appear in **no commit** — confirmed
  against the diff. The reverts were clean.
