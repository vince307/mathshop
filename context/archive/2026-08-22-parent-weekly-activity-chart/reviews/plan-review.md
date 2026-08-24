<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Parent weekly activity chart + first-try tile

- **Plan**: `context/changes/parent-weekly-activity-chart/plan.md`
- **Mode**: Deep
- **Date**: 2026-08-23
- **Verdict**: **SOUND** (was REVISE before the fixes recorded below were applied)
- **Findings**: 2 critical · 4 warnings · 3 observations — all triaged, none left PENDING
- **Reviewer note**: this is the **second** pass. A deep review on 2026-08-22 produced findings
  R1–R14, applied them inline into `plan.md`, and was killed by an API limit before it could save a
  report. This pass (a) re-verifies every R-finding the plan claims to have applied, against the
  code, and (b) reconciles the plan with what has changed underneath it since — F2 partly landing
  and F4's hand-off recipe. New findings are numbered **N1–N9** to keep them distinct from R1–R14.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING → PASS after N2 fix |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING → PASS after N1 + N6 fixes |
| Plan Completeness | WARNING → PASS after N3 + N4 + N5 fixes |

## Grounding

`Grounding: 14/14 cited source paths ✓ · 31/34 cited line ranges ✓ (3 wrong — N5) · 12/12 symbols ✓
· brief↔plan ✓ · Progress↔Phase 6/6 phases, 27/27 criteria ✓`

Files read in full or in the cited region: `src/lib/services/reports.ts`, `src/data/activity.ts`,
`src/data/skills.ts`, `src/components/parent/WeeklyReport.tsx`, `src/components/app/AppShell.astro`,
`src/components/child/ParentControls.astro`, `src/pages/app/report.astro`, `src/i18n/pl.ts`,
`tests/reports.test.ts`, `playwright.config.ts`, `e2e/parent-surfaces.spec.ts`,
`docs/reference/contract-surfaces.md`, `context/archive/2026-07-06-minimal-parent-weekly-report/{frame,plan}.md`,
`context/foundation/{prd-v3,roadmap,lessons}.md`, `context/changes/dashboard-recent-activity/plan.md`,
`context/changes/world-progression-stages/plan.md`.

---

## Part 1 — Verification of the previously-applied findings R1–R14

Every one of R1–R14 **is** genuinely reflected in the plan text (none was recorded as applied
without being applied). Thirteen rest on premises that check out against the code. One (R1) is
applied and its central quotation is faithful, but a *supporting* factual claim inside the
paragraph it rewrote is false — that is N1 below.

| # | What it claimed / changed | Verdict | Evidence |
|---|---|---|---|
| **R1** | AD-1 rewritten to restore **both** halves of the prior parking decision (scope **and** guardrail), not just the guardrail half; copy-review told to decide two named questions | **CONFIRMED — with one correction (N1)** | `context/archive/2026-07-06-minimal-parent-weekly-report/frame.md:36` is the hypothesis-3 row and reads exactly as the plan quotes it: the full-dashboard list *including* "daily bar chart", the prd-v3 non-goal, the roadmap parked entry, the verdict "The mockup depicts that parked tranche, not S-09's bar", and the guardrail line **as a parenthetical aside** at the end of the row. The plan's two-objection table is a fair reading, not a convenient one. The archived plan's own "What We're NOT Doing" (`:30-31`) independently confirms both objections. **But** AD-1's audience paragraph makes a reachability claim that is false — see N1. |
| **R2** | `REPORT_TIME_ZONE` / `zoneOffsetMinutes` **stay module-private**; the first draft's "export them for F2" was wrong | **CONFIRMED** | Both are private (`reports.ts:50,55`). F2 declares its own `ACTIVITY_TIME_ZONE` (`activity.ts:18`) and its plan says verbatim what F1 quotes: *"would make `src/data/activity.ts` depend on a service module and break its dependency-free posture"* (`dashboard-recent-activity/plan.md:342-343`); the surrounding decision is at `:298-301`. Neither feature imports them. Exporting would indeed be two dead-API hunks. |
| **R3** | `grid-cols-2 sm:grid-cols-3`, not a bare `grid-cols-3`; the "~97 px" figure corrected to 62.7 px of text | **CONFIRMED** | Width chain verified: `AppShell.astro:180` is `<main class="mx-auto w-full max-w-6xl flex-1 px-4 …">` → 390 − 32 = 358; card is `p-6` + 1 px border each side (`WeeklyReport.tsx:136`) → 358 − 48 − 2 = **308 px**. `(308 − 24)/3 = 94.7`, minus the tile's own `p-4` → **62.7 px**. `sm:grid-cols-3` precedent confirmed at `Welcome.astro:96`. |
| **R4** | New helpers go after `aggregateWeeklyReport` / `startOfWeek`, **never at EOF** | **CONFIRMED** | F2's `listRecentActivity` occupies `reports.ts:147-160` (EOF); `RecentActivityRow` `:117-123`. Insertion anchors `:47` and `:92` are correct. |
| **R5** | Every `daily` assertion must pass `NOW` explicitly as the third arg | **CONFIRMED** | `aggregateWeeklyReport`'s new `now` defaults to `new Date()`, so a fixed `IN_FRAME_CREATED_AT` is only in-frame relative to a fixed `now`. A test omitting it would silently assert an all-zero `daily`. The reasoning is exactly right. |
| **R6** | `firstTryPercent` must normalise through `readSkillState` first, so `NaN`-freedom is a property of the *function*, not of one call site | **CONFIRMED** | `readSkillState` (`skills.ts:56-68`) routes every counter through `safeCount` (`:40-42`), which returns a non-negative integer for *any* input. So `num`/`den` are always finite; `den === 0 → null`; otherwise `Math.round` of a finite ratio. `NaN` is genuinely unreachable. Without the normalisation, `Math.max(0, Math.min(100, Math.round(NaN)))` is indeed `NaN` — the plan's stated failure mode is real. |
| **R7** | SVG type sizes pinned (11 / 10 / 9 user units, explicit `text-anchor`) | **CONFIRMED** | 308/320 = 0.9625, so 11/10/9 land at ≈ 10.6/9.6/8.7 CSS px as stated. Criterion 4.6 is a *manual* row and an unattended run does not execute it, so pinning was the right call. |
| **R8** | The "no literal Polish in markup" test phrasing replaced with an implementable one | **CONFIRMED** | The original phrasing was not implementable (a test cannot enumerate "Polish strings" in rendered markup). "Every string assertion reads its expected value from `t.report.*`" is checkable by reading the file. |
| **R9** | **Do not** edit `docs/reference/contract-surfaces.md` | **CONFIRMED** | `## public.shift_log` is at `:25`; `created_at` is already under **Columns** at `:31`; `src/lib/services/reports.ts` is already under **Consumed by** at `:38` — and F2 has *already* appended `listRecentActivity` to that same `:38` line. F1 changes neither schema nor consumer set. Editing would buy a same-line conflict for zero information. |
| **R10** | Phase 2 has no `#### Manual` subsection in Progress | **CONFIRMED** | Progress Phase 2 is `2.1`–`2.4`, automated only. Matches the phase body, which has no Manual Verification block. |
| **R11** | AD-9's "residue" paragraph — `statTasks` and `statFirstTry` do not reconcile on screen — plus the copy-review question | **CONFIRMED, including the arithmetic** | `tasksThisWeek` (`WeeklyReport.tsx:133`) sums all three competencies. `decisions.completed` is `+1` per purchase (`child-profiles.ts:243`), so it *does* equal `upgrades.length` — the plan's "purchases are already counted by two adjacent tiles" wrinkle is real. `20 · 62 % · 7` is a correct worked example. |
| **R12** | The `sr-only` `<ul>` needs its own `aria-label` because the heading above it is a `div` | **CONFIRMED** | `WeeklyReport.tsx:151` and `:172` are both `<div className="text-muted-foreground flex …">`, not heading elements. A list placed under them would otherwise be unnamed. |
| **R13** | No 390 px viewport is exercised in CI at all → add Risk E2E-2 | **CONFIRMED** | `playwright.config.ts:42-54`: `desktop` = Desktop Chrome (1280×720); `touch` = Galaxy Tab S4 **scoped by `testMatch: /gameplay-restore\.spec\.ts/`**. `/app/report` is only ever rendered at 1280 px. Phases 4.6 / 5.6 were the only guards and both are manual. |
| **R14** | Do **not** write a civil-date formatter — F2 already shipped `warsawDayKey` | **CONFIRMED** | `src/data/activity.ts:48-57` exports `warsawDayKey(instant: Date): string` (doc comment `:42-47`), `ACTIVITY_TIME_ZONE` at `:18`, `previousDayKey` at `:67-71` with the UTC-arithmetic idiom the plan tells `weekDayKeys` to mirror. `activity.ts` imports only `@/data/skills` (`:11`); `reports.ts` imports `@/data/skills` + `@/data/upgrades` — **no cycle**. This is the single most valuable finding in the R-set and it is correctly applied. |

### The three deep-dive checks the brief asked for, answered

- **AD-1 — can the tile reach a child's screen?** The gate holds: `report.astro:22-29` redirects to
  `/app/parent-pin` unless `verifyMarker` accepts the HMAC-signed `parent_verified` cookie, and the
  island is imported by that route and nowhere else. **But the plan's supporting claim about
  navigation is false — see N1.** The prior parked decision is represented fairly (R1 above).
- **AD-9 vs AD-2 — do the bars decompose the tile?** **Yes, verified through the code.** See N7.
- **AD-3 — would the `NaN` assertion catch it on every path?** **Not as written — see N6** (fixed).
- **AD-5 — one Warsaw implementation?** **Yes** (R14 above), and F1 should reuse F2's helper rather
  than export its own; the plan already says so. Sequencing hardened — see N9.
- **`created_at` knock-on edits?** **Complete.** `tests/reports.test.ts:13-15` is the `row()` helper
  and `:39` is the inline literal `{ skills: {…}, upgrade_purchased: null }` — the plan names both,
  not just the helper. `stubClient` (`:18-26`) carries only `select/eq/gte/order` with `order`
  thenable, so the plan's "add no chained method" constraint is correct. `npm run check` is called
  out explicitly (AD-6), and `tsconfig.json`'s `include: ["**/*"]` does typecheck `tests/`.
  `tests/shift-log-isolation.test.ts` does declare its own local `ShiftLogRow` and is unaffected.
  Current `tests/reports.test.ts` has 12 `it(` blocks; the phase adds 7, matching the "≥ 19" target.

---

## Findings

### N1 — AD-1's reachability claim is false: a child-side link to `/app/report` ships on every child screen

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: `## Autonomous decisions` → AD-1, "Answering (b) — the guardrail", point 1
- **Detail**: The plan asserted that `ParentControls.astro` is *"the only component that renders a
  child-side link to `/app/report`"* and is *"currently rendered on no page at all"*. Only the
  second half is true — nothing in `src/` imports `src/components/child/ParentControls.astro`. The
  first half is wrong: `src/components/app/AppShell.astro:65` spreads
  `{ key: "parent", href: "/app/report", label: t.nav.items.parent }` into `tabs` (the bottom bar)
  and `:120-130` renders the same link in the desktop sidebar. `AppShell` wraps
  `src/pages/app/start.astro`, `task.astro` and `upgrades.astro` — **every** child screen. The label
  is `"Panel rodzica"` (`pl.ts:137`). A child is one visible tap from the PIN gate on every page.
  The *conclusion* survives — `report.astro:22-29` still hard-redirects, so the tile cannot render
  without the marker — but the argument was resting on a stronger premise than the code supports,
  and this is exactly the "convenient version" the brief asked to be checked for.
- **Fix**: Correct the paragraph in place with a marked correction block, and add the navigation
  fact to `## Known risks` so it survives into implementation.
- **Decision**: **FIXED** — AD-1 point 1 now carries a `> Corrected during the second
  /10x-plan-review pass (finding N1)` block naming `AppShell.astro:65,120-130`; new `## Known risks`
  entry 6.

### N2 — F1 and F4 do not agree on the post-F1 shape of the tile grid

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: `## What We're NOT Doing` — the earnings-tile bullet
- **Detail**: F1's plan claimed F4 "can add it **additively**: a fourth tile in the same grid …
  nothing in this plan has to be undone". Reading F4's actual recipe
  (`context/changes/world-progression-stages/plan.md:458+`, "Handed to F1"), three of its six rows
  are stale against the post-F1 file:
  1. Row 5 says `WeeklyReport.tsx:139-148` is a **2-tile** grid and instructs `grid-cols-2` →
     `sm:grid-cols-3`. After F1 it is a **3-tile** grid *already* classed
     `grid-cols-2 sm:grid-cols-3`. Applying F4's line verbatim leaves **four tiles in a
     three-column grid — a 3 + 1 orphan row**. And the plan's own R3 arithmetic rules out
     four-up at `sm`: `(558 − 36)/4 = 130` px per tile minus `p-4` ⇒ ~98 px, worse than the
     62.7 px case R3 already rejected at three-up on a phone.
  2. Row 2 does a literal replacement of `.select("skills, upgrade_purchased")`, which after F1 is
     `.select("created_at, skills, upgrade_purchased")` — the string match will not hit.
  3. Row 6 cites the stale `pl.ts` comment at `:394-396` (wrong, see N4) and does not know F1
     Phase 3 has already rewritten that block once.
  Row 1 (`earned?` must be **optional** or `row()` stops compiling) and row 4 (`WeeklyReport` widens
  invisibly — verified, `src/types.ts:146`, no whole-object `toEqual` in `tests/`) remain correct.
- **Fix**: Replace the loose "additively" sentence with a four-row correction table stating what F4
  will actually find and what it must do instead; mirror it into `## Known risks`. F1 cannot edit
  F4's plan (different change folder), so this also travels in the handoff.
- **Decision**: **FIXED** — table added under `## What We're NOT Doing`; `## Known risks` entry 7;
  flagged in `handoff.md` for the F4 implementer.

### N3 — Duplicate E2E risk ID: two different risks are both called `E2E-2`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 6 §2 and Phase 6 §3; Progress row 6.3
- **Detail**: Phase 6 §2 defines *"Risk E2E-2 — `/app/report` does not scroll horizontally on a
  phone"* (a risk to **build**). Phase 6 §3 then defines *"Risk E2E-2 — a seeded week draws non-zero
  bars"* (a risk deliberately **not** built). Progress 6.3 says "Risk E2E-2 green", which now names
  two things. `/10x-e2e` drives risks by ID; handing it a plan with a colliding ID means it either
  builds the deferred risk or skips the required one.
- **Fix**: Rename §3's risk to `E2E-3`.
- **Decision**: **FIXED**.

### N4 — Every `src/i18n/pl.ts` line number in the plan is wrong

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Implementation Approach step 3; Phase 3 §1 and §2; Phase 3 Manual Verification;
  Progress 3.5; AD-11
- **Detail**: Verified against the file: `report: {` opens at `:395` and closes at `:425`; the
  stale comment ("*the mockup's correctness %, daily chart and earnings have no source yet, so they
  are not rendered rather than estimated*") is at **`:411-414`**; `statTasks` and `statUpgrades` are
  at **`:415-416`**. The plan cited `:394-397` in five places and `:378-408` in one. An implementer
  following `:394-397` lands in the middle of the *parent-PIN* copy block's tail and the `report: {`
  opener — a real chance of editing the wrong comment.
- **Fix**: Correct all six citations.
- **Decision**: **FIXED** — `:394-397` → `:411-414` (5×); `:378-408` → `:395-425` with
  `statTasks` at `:415-416` named.

### N5 — Four broken cross-document citations

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Current State Analysis; AD-1; AD-5; Known risks 6 (now 8); Phase 2 §1
- **Detail**:
  - `prd-v3.md:174` for the deferred "Richer parent report" tranche → it is at **`:172`** (cited 3×).
    The companion `prd-v3.md:161` for the *"No full parent dashboard"* non-goal **is** correct, as is
    `roadmap.md:294`.
  - AD-5 cites `context/archive/2026-07-06-minimal-parent-weekly-report/plan.md:216` for *"the prior
    change ruled a second parser out explicitly"*. `:216` is a Progress checkbox
    (`- [x] 1.7 Forced query error shows the per-child Polish error card`). The actual standing
    decision is at **`:24`** — *"the stack has no date library and shouldn't gain one for this"* —
    and `:42`.
  - `plan-brief.md:27` cited twice for "`Intl` only, as the prior change decided" → `:27` is the
    Desired End State paragraph. The substantive source is the archived plan `:24`.
  - `src/pages/app/start.astro:60-61` for the clamp-and-round idiom → the expression
    `Math.max(0, Math.min(100, Math.round(…)))` is at **`:80`** on the current F2 branch (F2's
    uncommitted start-screen edit moved it), and will move again. Cite the expression, not the line.
- **Fix**: Correct all four.
- **Decision**: **FIXED** — including a note on the `start.astro` citation telling the implementer
  to match on the expression rather than the number.

### N6 — AD-3's "`NaN` is asserted absent from the DOM" is scoped to one fixture

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 5 §2 (test contract) and Phase 5 Success Criteria
- **Detail**: The brief asked whether the assertion would catch `NaN` **on every path reaching the
  tile**. It would not, as written. Phase 4 has a blanket criterion 4.5 ("No `NaN` or `undefined`
  … for any fixture"); Phase 5 has no equivalent, and `expect(container.textContent).not.toMatch(/NaN/)`
  was attached only to the fresh-profile bullet. The fresh-profile fixture exercises the
  `firstTry === null` branch — the one branch that renders a literal `—` and structurally cannot
  produce `NaN`. The `firstTry !== null` branch (`copy.statFirstTryValue.replace("{percent}",
  String(firstTry))`, where `String(NaN)` is `"NaN"`) is exercised by the played-week and
  purchases-only fixtures and had **no** guard. That is precisely where a future regression —
  a caller bypassing `firstTryPercent`, or the `readSkillState` normalisation R6 added being
  dropped — would land.
- **Fix**: Assert on every fixture via a local `expectNoNaN(container)` helper, and add the blanket
  criterion to Phase 5 to mirror 4.5.
- **Decision**: **FIXED** — test contract bullet added; new Success Criterion; Progress renumbered
  (automated `5.1`–`5.6`, manual `5.7`–`5.8`), re-checked for Progress↔Phase consistency.

### N7 — AD-9's decomposition invariant holds through the code, not just on paper

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — no action needed; recorded because the claim is load-bearing
- **Dimension**: Architectural Fitness
- **Location**: AD-9 / AD-2 / Phase 1 §5
- **Detail**: The brief asked whether *"a parent adding up the bars gets a number that matches what
  is printed above them"*. Traced end to end: `practice` accumulates through `addSkillDelta`, whose
  per-field step is `base[c].completed + safeCount(d.completed)` (`skills.ts:82-84`); the proposed
  daily fold accumulates `readSkillState(row.skills)`, whose per-field step is the **same**
  `safeCount` on the same field (`skills.ts:62-64`). Identical per-row coercion on both sides, so
  `Σ daily[].completed === Σ_c practice[c].completed` for in-frame rows. The tile above the chart is
  `COMPETENCIES.reduce((sum, c) => sum + practice[c].completed, 0)` (`WeeklyReport.tsx:133`) over
  `COMPETENCIES = ["math", "money", "decisions"]` (`skills.ts:16`) — exactly the three the bars sum.
  **The bars do add to the printed tile.** The one divergence is a row inside the open-ended `.gte`
  window but outside the seven-day frame; AD-7 accepts it as unreachable (DB-generated `created_at`
  cannot be in the future) and Phase 1's test locks the behaviour explicitly. The DST fixture is
  also correct: Warsaw's fall-back is 2026-10-25, `startOfWeek` for that week is
  `2026-10-18T22:00:00.000Z` (CEST, UTC+2), and `2026-10-25T22:30:00Z` is 23:30 CET on Sunday
  the 25th → index 6. The asymmetry with AD-2 (the *ratio* excludes `decisions`) is therefore a
  deliberate, defensible choice and not a silent inconsistency.
- **Fix**: None required. Recorded in AD-9 as a verification block so the next reader does not
  re-derive it.
- **Decision**: **FIXED (documented)** — verification block added under AD-9.

### N8 — Two small copy/class inaccuracies in Phase 5

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Completeness
- **Location**: Phase 5 §1
- **Detail**: (a) The plan says the new tile "follows the existing recipe **exactly**" and then
  specifies `<li className="bg-accent/10 rounded-2xl p-4">`. The two existing tiles are
  `bg-primary/5` (`WeeklyReport.tsx:140`) and `bg-success/10` (`:144`) — `bg-accent/10` is a
  **third** tint, not the existing recipe. It is a valid class (`--accent` / `--color-accent` are
  defined at `src/styles/global.css:22,99`) and a third tint is a reasonable choice for a third
  tile, so this is a wording imprecision rather than a defect. (b) R3's argument quotes *"the
  existing `statUpgrades` label `\"Odblokowane\"`"*; the actual value is `"Odblokowane ulepszenia"`
  (`pl.ts:416`). The measurement reasoning still stands — `"Odblokowane"` is the longest
  *unbreakable* token and `overflow-wrap: normal` breaks at the space — but the quote misstates the
  string.
- **Fix**: None applied; both are cosmetic and correcting them risks churning a paragraph whose
  arithmetic is right.
- **Decision**: **ACCEPTED** (recorded, not fixed).

### N9 — The pre-merge fallback path in Phase 1 §3 is now dead and should not be offered as a choice

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Lean Execution
- **Location**: Critical Implementation Details — "Branch sequencing this creates"; Phase 1 §3
- **Detail**: The plan offered two paths — import `warsawDayKey` (if F2 has merged) or write a local
  `warsawCivilDate` (if not) — and called the first merely "Preferred". The run's sequencing is now
  settled: `feat/parent-weekly-activity-chart` is cut from `feat/ui-polish` **after** F2 lands
  there, so the second path cannot legitimately be taken. Leaving it as an equal-looking option
  invites an implementer to create precisely the duplicate AD-5 exists to prevent.
- **Fix**: Restate the sequencing as a hard prerequisite; demote the fallback to a named contingency.
- **Decision**: **FIXED**.

---

## What changed in `plan.md` during this pass

| Finding | Edit |
|---|---|
| N1 | AD-1 point 1: correction block naming `AppShell.astro:65,120-130`; new `## Known risks` entry 6 |
| N2 | `## What We're NOT Doing`: four-row correction table for F4's "Handed to F1" recipe; new `## Known risks` entry 7 (old entry 6 → 8) |
| N3 | Phase 6 §3: `Risk E2E-2` → `Risk E2E-3` |
| N4 | `pl.ts:394-397` → `:411-414` (5×); `:378-408` → `:395-425`, `statTasks` at `:415-416` |
| N5 | `prd-v3.md:174` → `:172` (3×); archived `plan.md:216` → `:24,42` with the quote; `plan-brief.md:27` → archived `plan.md:24` (2×); `start.astro:60-61` → `:80` + "match the expression, not the number" |
| N6 | Phase 5 §2 test bullet + new Success Criterion; Progress Phase 5 renumbered to `5.1`–`5.8` |
| N7 | AD-9: verification block recording the traced invariant |
| N9 | Critical Implementation Details: sequencing restated as a hard prerequisite |

Nothing else in the plan was touched. No production code was written. No branch was created or
switched. All edits are confined to `context/changes/parent-weekly-activity-chart/`.

## Autonomous decisions

This run has no human in the loop (`context/runs/2026-08-22-autonomous-five/agent-contract.md`,
hard rule 1). `/10x-plan-review` ends with an `AskUserQuestion` triage prompt; it was not asked.

- **Chose "Triage findings" over "Save report only."** Rejected saving-without-triage: the previous
  pass died precisely because it deferred the write, and a report full of `PENDING` decisions would
  hand `/10x-implement` a plan with a duplicate E2E risk ID and five wrong line numbers. All nine
  findings are triaged in this document. *What would change the answer:* a finding requiring a
  product judgement the maintainer owns — there was none; N1 and N2 are factual corrections, the
  rest are bookkeeping.
- **Fixed N1 by correcting the argument, not by reversing AD-1.** Rejected re-parking the tile: the
  false claim was a *supporting* one, and the load-bearing gate (`report.astro:22-29`) was verified
  to hold. Rejected treating it as a mere typo: the reachability fact makes AD-1's own reversal
  condition ("the parent report ever becoming reachable without the PIN gate") half-true on the
  navigation axis, which the maintainer should see. *What would change the answer:* if the nav entry
  ever deep-linked past the gate, or the marker TTL grew — then the tile should come out.
- **Fixed N2 inside F1's plan only.** Rejected editing
  `context/changes/world-progression-stages/plan.md`: this step is scoped to F1's folder and F4 has
  its own review lifecycle. The correction table plus the handoff flag is the reach available.
  *What would change the answer:* nothing within this step's scope; the F4 implementer must read it.
- **Did not run `npm test` / `npx playwright test`.** This step is documentation-only and the
  working tree carries another feature's uncommitted work (`src/pages/app/start.astro`, +22 lines,
  branch `feat/dashboard-recent-activity`). Running the suite would report on F2's in-progress
  state, not on anything this step changed. *What would change the answer:* if this step had touched
  `src/`, which it did not.
- **Rated the plan SOUND after fixes rather than REVISE.** The two CRITICALs were both document
  truth-defects with the code-level conclusions intact; nothing found requires re-planning a phase,
  changing a phase boundary, or revisiting an architectural decision. *What would change the
  answer:* if the F4 grid conflict (N2) had required F1 to change its own grid class — it does not;
  `grid-cols-2 sm:grid-cols-3` remains right for three tiles.
