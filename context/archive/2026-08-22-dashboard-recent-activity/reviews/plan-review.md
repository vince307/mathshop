<!-- PLAN-REVIEW-REPORT -->
# Plan Review: "Ostatnia aktywność" Feed on the Child Dashboard

- **Plan**: `context/changes/dashboard-recent-activity/plan.md`
- **Mode**: Deep
- **Date**: 2026-08-22
- **Verdict**: REVISE → **SOUND after the fixes recorded below**
- **Findings**: 1 critical, 6 warnings, 3 observations

> Run context: `context/runs/2026-08-22-autonomous-five/agent-contract.md`. Hard rule 1
> forbids `AskUserQuestion`, so the skill's interactive triage was **decided, not asked** —
> every finding below carries a `Decision:` that this review step took autonomously, with the
> exact plan edit it produced. Nothing is left `PENDING`.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING (1 finding) |
| Blind Spots | WARNING (3 findings) |
| Plan Completeness | WARNING (3 findings) |

## Grounding

`Grounding: 13/13 paths ✓, 7/7 symbols ✓, brief↔plan ✓, Progress↔Phase ✓ (one subsection
mismatch, F6)`

Paths opened and confirmed: `supabase/migrations/20260701150000_create_shift_log.sql`,
`src/lib/services/reports.ts`, `src/pages/app/start.astro`, `src/i18n/pl.ts`,
`src/i18n/index.ts`, `src/data/skills.ts`, `src/components/child/SkillCards.astro`,
`src/components/child/childCard.ts`, `e2e/seed.spec.ts`, `e2e/gameplay-restore.spec.ts`,
`e2e/helpers/i18n.ts`, `tests/report-isolation.test.ts`,
`docs/reference/contract-surfaces.md`. The four files the plan creates
(`src/data/activity.ts`, `src/components/child/RecentActivity.astro`,
`tests/recent-activity.test.ts`, `tests/recent-activity-isolation.test.ts`) correctly do not
exist yet. Symbols confirmed: `readSkillState`, `upgradeCopy`, `charsNeeded`, `polishPlural`,
`childCard`, `getWeeklyReport`, `shift_log_profile_created_idx`.

Baselines measured during this review, not taken on trust:

| Command | Result |
|---|---|
| `npx vitest run` | **299 tests** (181 passed, 88 skipped, 30 failed — all 30 are `AuthRetryableFetchError: fetch failed` from `tests/helpers/supabase.ts:46`; the local Supabase stack was down). Plan's "baseline 299" ✓ |
| `npx playwright test --list` | **"Total: 15 tests in 6 files"** — 13 `desktop` + 2 `touch`. Plan's "17 runs" ✗ (F1) |
| `npm run check` | **`Result (163 files): 0 errors, 0 warnings, 8 hints`** — green, so it is safe to add as a gate (F2) |
| `.husky/pre-commit` | `npx lint-staged` → `*.{ts,tsx,astro}: eslint --fix`, `*.{json,css,md}: prettier --write`. **No vitest, no `astro check`** (F2) |

---

## The four things the review was specifically asked to verify

### 1. The `profile_id` filter and whether the isolation test is real — **CONFIRMED, with one gap (F4)**

`shift_log` RLS is account-scoped, exactly as the plan says. All four policies in
`supabase/migrations/20260701150000_create_shift_log.sql:41-64` are predicated on
`auth.uid() = account_id`; nothing anywhere predicates on `profile_id`. The existing read
`getWeeklyReport` (`src/lib/services/reports.ts:110`) carries its own `.eq("profile_id", …)`,
which is the precedent and the only sibling separation that exists.

**The primary isolation case genuinely fails if the filter is dropped.** Traced: with two
profiles on one account and one row each, `listRecentActivity(A.client, profileA1)` minus
`.eq("profile_id", …)` becomes `select … order(created_at desc) limit 3` restricted only by
RLS to account A — which returns **2** rows where the test demands exactly A1's one. Red. The
existing `tests/shift-log-isolation.test.ts` and `tests/report-isolation.test.ts` both stay
green through that same break, so the new suite is not redundant.

**The gap:** the plan's *third* case (cross-account, `listRecentActivity(B.client, profileA1)`
→ `[]`) passes whether or not the filter exists, because account B is seeded with no
`shift_log` rows at all. It still exercises the SELECT policy — a broken policy would surface
A1's row — so it is not vacuous, but it certifies nothing about the app-side filter while
looking like it might. Fixed under F4.

### 2. `reports.ts` contention with F1 — **COMPATIBLE AS FAR AS IT CAN BE KNOWN; two named residuals (F5)**

**F1 has no `plan.md`.** `context/changes/parent-weekly-activity-chart/` holds only
`change.md` (`status: preparing`), `research.md` and `handoff.md`. Every compatibility
statement in F2's D5 is therefore projected from F1's *research*, which is the best available
evidence but is not a commitment.

Verified true: F2's file list touches **neither `tests/reports.test.ts` nor `src/types.ts`**
(both named in "What We're NOT Doing" and absent from all four phases). `ACTIVITY_TIME_ZONE`
in a new `src/data/activity.ts` cannot collide with F1 exporting `REPORT_TIME_ZONE` from
`reports.ts`. Blast-radius sweep on `reports.ts` finds exactly three importers —
`src/pages/app/report.astro:11`, `tests/reports.test.ts:3`, `tests/report-isolation.test.ts:3`
— none of which F2 touches. (`tests/shift-log-isolation.test.ts:21` declares its *own* local
`ShiftLogRow`; it does not import the service one.)

Two concrete residuals, now recorded as R1 in the plan's `## Known risks`:

- **File `src/lib/services/reports.ts`, symbols `RecentActivityRow` / `listRecentActivity`,
  position EOF.** F2 appends after line 115. F1's research finding 2 describes the chart's day
  bucketing as "a second fold over the array already in hand" — a new pure function that would
  most naturally *also* be appended to this file next to `aggregateWeeklyReport`. Two appends
  at EOF conflict **in the same git hunk**. F2's claim "append-only rebases cleanly against the
  edits F1 makes above it" is true only for F1's edits above the append point (`ShiftLogRow`
  `:13-16`, `.select()` `:109`, exporting `REPORT_TIME_ZONE`/`zoneOffsetMinutes` `:50`/`:55`).
- **File `docs/reference/contract-surfaces.md`, section `## public.shift_log`, line 38.** F2
  appends a name to the **Consumed by** line and to the **Isolation test** line (`:39`). F1
  changes what `getWeeklyReport` selects, so it plausibly edits the **Columns** line (`:34`)
  *and the same Consumed-by line*. Same-line conflict. (Note: nothing validates this file —
  `grep -rn "contract-surfaces" tests/ e2e/ src/ scripts/ .github/` → 0 hits, F10.)

### 3. The substring traps — **BOTH CLAIMS CONFIRMED; no collision missed**

- **`Dzisiaj` is a substring of `t.start.missionHeading`** — `src/i18n/pl.ts:203`,
  `missionHeading: "Dzisiaj nauczysz się"`, rendered on the same page at
  `src/pages/app/start.astro:164`. The plan's ban on asserting `t.start.activityToday` is
  correct and necessary.
- **The empty-state copy does not contain `Ukończone zmiany`.** `t.start.statShifts` is
  `"Ukończone zmiany"` (`pl.ts:208`); `activityEmpty` is `"Jeszcze nic tu nie ma. Twoje zmiany
  i ulepszenia pojawią się w tym miejscu."` — contains `zmiany`, not the phrase. And
  `Zmiana ukończona` (the shift label) contains neither direction of `Ukończone zmiany`. Both
  wordings are load-bearing exactly as the plan states.

Independent sweep for collisions the plan might have missed — none found:

| Check | Result |
|---|---|
| Existing `/app/start` locators | `grep -rn "t\.start\." e2e/` returns **exactly the six** the plan's audit table lists, at the line numbers it gives ✓ |
| `Ostatnia aktywność` | zero other occurrences of `aktywno*` **or** `Ostatni*` in all of `src/i18n/pl.ts` — the heading is unique ✓ |
| `Ulepszenie: {name}` vs `t.start.nextUpgradeHeading` ("Następne ulepszenie") | case-insensitively `ulepszenie` *is* inside the heading, but the asserted string is the **filled** `Ulepszenie: Szyld`, which is not; and after buying `sign` the next-upgrade card advances to `Półka`, so `Szyld` is unique on the page ✓ (plan states this) |
| `t.start.statUpgrades` ("Ulepszenia") | not contained in any new string ✓ |
| `t.skills.heading` ("Twoje umiejętności") / `t.start.resultsHeading` | no overlap with any new string ✓ |
| Reverse direction — does any new string break an existing locator? | `Portfel`, `Rozbuduj sklep`, `Czas otworzyć sklep!`, `Cześć,` appear in none of the eight new values ✓ |

`e2e/helpers/i18n.ts` re-exports the **same object** as `src/i18n/pl.ts` (`export { t }`), so
the audit above transfers to the specs verbatim.

### 4. The mobile extrapolation — **HONEST, and the placement works; one rationale is false (F3)**

The plan does not claim mockup authority. It says so in three places: the Overview ("absent
from the mobile mockup, so its phone treatment is an explicit extrapolation"), D2 ("**This is
an extrapolation, not a mockup**… Stated plainly so the maintainer can overrule it cheaply"),
and the brief's decision table. That is the right posture and it survives review.

The placement genuinely works at 390px. `start.astro:90` is `grid items-start gap-6
lg:grid-cols-3` — a single column below `lg`; block B (`:139`) is `order-last flex flex-col
gap-6 lg:order-none lg:col-span-2 lg:col-start-1 lg:row-start-2`. Nesting the section inside
block B inherits `order-last`, so mobile order stays hero → rail → skills/results/feed. The
plan's rejection of the naive fourth grid sibling is **correct**: with hero/rail at `order: 0`
and block B at `order-last`, a fourth sibling would render *before* block B on mobile.
`grid gap-3 lg:grid-cols-3` is one column at 390px, and `childCard("2xl", …)` is a valid call
(`childCard.ts:10` accepts only `"2xl" | "3xl"`).

What is **not** honest is one sentence of D2's supporting rationale — see F3.

### 5. Truthfulness of every rendered value — **CLEAN, nothing crept in**

Every value a row renders traces to a stored column:

| Rendered | Source | Verdict |
|---|---|---|
| `Zmiana ukończona` / `Ulepszenie: {name}` | `upgrade_purchased !== null` (the only sound discriminator; a purchase row's `skills` also carries `decisions`) | stored ✓ |
| `{name}` | `upgradeCopy(upgrade_purchased)` — dictionary lookup with a guarded raw-id fallback (`src/i18n/index.ts:34-36`) | stored ✓ |
| `N zadań` | `skills.math.completed + skills.money.completed` via `readSkillState` | stored ✓ **and exact** — `ShiftScreen.tsx:85-92` increments `completed` once per task and posts only `math`/`money` (`:98`), and `src/pages/api/shifts/complete.ts:56` refines `math.completed + money.completed <= taskCount`. So the label is the shift's real task count, not an estimate |
| `Dzisiaj` / `Wczoraj` / `DD.MM` | `created_at`, bucketed on the Warsaw calendar day | stored ✓ |

No money figure on either kind (D1), no re-derived `EARN_PER_*` earnings, no catalogue `cost`,
no stars, no miss counts, no level, no wallet. The one thing that is *derived* — the Warsaw
day bucket — is a formatting of a stored timestamp, not a re-priced fact. Nothing else crept
in.

### 6. Phase granularity — **PASS**

Each phase is independently committable and none leaves the app broken:

| Stop after | State of the app |
|---|---|
| Phase 1 | New pure module + a helper + 8 dictionary keys, all unreferenced. Nothing renders. Green. |
| Phase 2 | One exported, unreferenced query function + two suites. Nothing renders. Green. |
| Phase 3 | Feature live and complete for a user. Only e2e coverage is missing. Green. |
| Phase 4 | Done. |

Success criteria are runnable and evaluable **after** the fixes for F1 (a criterion that could
never be satisfied) and F7 (a manual step that could not be evaluated).

---

## Findings

### F1 — Playwright success criterion states "17 runs"; the real count is 15 and cannot change

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Desired End State (`:68`); Phase 3 Success Criteria (`:700`); Phase 4 Success Criteria (`:766`)
- **Detail**: `npx playwright test --list` reports **"Total: 15 tests in 6 files"** (13 `desktop` + 2 `touch`; `playwright.config.ts` scopes the `touch` project to `testMatch: /gameplay-restore\.spec\.ts/`). Phase 4 explicitly adds *assertions inside two existing `test()` blocks* and states "No new spec file" — so the run count stays 15. Three places demand "17". Under this run's unattended execution model, an automated success criterion that can never be satisfied is not a typo; it is a step that never closes, and `/10x-goal-implement` drives exactly these rows.
- **Fix**: Replace every "17" with the measured 15/15 and say why the count does not move.
- **Decision**: **FIXED**. All three sites rewritten to `**15/15**` with the `--list` evidence inline and the note "this change adds assertions, not test cases". Progress rows 3.3 / 4.1 needed no change — their titles never named a count.

### F2 — `npm run check` is never run, and it is the only thing that type-checks `.astro`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 Success Criteria
- **Detail**: Phase 3 introduces `RecentActivity.astro` with a nullable typed array prop (`entries: ActivityEntry[] | null`) imported from a brand-new module, plus new frontmatter in `start.astro`. Nothing in the plan's gate stack type-checks that. `.husky/pre-commit` runs `npx lint-staged` → `eslint --fix` on `*.{ts,tsx,astro}` only; eslint does not type-check `.astro` frontmatter or props, `vitest` never loads the component, and `npm run lint` is not `npm run check`. The project *has* the script (`"check": "astro check"`) and it is **green at baseline** — measured during this review: `Result (163 files): 0 errors, 0 warnings, 8 hints` — so adding it as a gate costs nothing and cannot import pre-existing red.
- **Fix**: Add `npm run check` to Phase 3's Automated Verification and to Progress.
- **Decision**: **FIXED**. Added as a Phase 3 automated criterion (with the baseline result quoted so a future run can tell a regression from inherited noise) and as Progress row `3.11`. Index 3.11 rather than renumbering, per the never-renumber rule in `.claude/skills/10x-plan/references/progress-format.md`.

### F3 — D2's supporting rationale cites a breakpoint precedent that does not exist

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Autonomous decision D2; Phase 3 component contract (`grid gap-3 lg:grid-cols-3`)
- **Detail**: D2 justified stacking below `lg` partly with "Stacking is also what every other multi-column row on this dashboard already does." That is **false**. Both sibling rows inside the very same column go multi-column at `sm` (640px): `SkillCards.astro` is `<ul class="grid gap-4 sm:grid-cols-3">` and the results tiles at `start.astro:145` are `<ul class="grid grid-cols-2 gap-4 sm:grid-cols-4">`. With `lg:grid-cols-3` the feed becomes the **only** 1-across row on the page at the `touch` project's 712px viewport, sandwiched between a 3-across row and a 4-across row. The choice may still be right — entry labels ("Zmiana ukończona · 5 zadań") are far longer than a stat tile's, and three of them across ~660px minus a 40px badge each is tight — but it is a deviation from the page's own breakpoint, not a continuation of it, and the decision was made on a wrong premise.
- **Fix A ⭐ Recommended**: Correct the rationale, keep `lg:grid-cols-3`, and defer the class choice to the moment it can be seen.
  - Strength: The class is one token on one element and the plan already schedules three manual viewport checks (3.6 / 3.7 / 4.4) where the answer is visible rather than argued. Deciding it now would substitute one guess for another.
  - Tradeoff: The 712px look ships unverified until manual verification runs.
  - Confidence: HIGH — the DOM effect is fully traced above and is purely visual; nothing functional depends on it.
  - Blind spot: Actual rendered width of the label at 712px/3-up is unmeasured (no running app during this review).
- **Fix B**: Change to `sm:grid-cols-3` now, matching `SkillCards` exactly.
  - Strength: Page-consistent at every breakpoint; gives the `touch` project a non-degenerate reflow to exercise.
  - Tradeoff: Substitutes the reviewer's untested guess for the planner's untested guess, on a design call the mockup declines to make.
  - Confidence: MEDIUM — consistent, but the label length problem is real and unmeasured.
  - Blind spot: Same as A.
- **Decision**: **FIXED via Fix A (partial) + DEFERRED to `## Known risks` R3.** The false sentence is replaced in D2 with the measured correction (both siblings' actual class strings, and the statement that `lg:` is a deliberate deviation). The class itself is left as `lg:grid-cols-3` and recorded as risk **R3** with the one-token reversal spelled out, plus a new Progress row `4.6` that forces the 712px evaluation to be an explicit decision instead of a silent pass.

### F4 — one case of the isolation suite passes whether or not the bug exists

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 → "Intra-account isolation suite", case 3
- **Detail**: Case 3 asserts `listRecentActivity(B.client, profileA1)` returns `[]`. As specified, account B is seeded with **no `shift_log` rows**, so `[]` comes back whether or not `.eq("profile_id", …)` is present — the filter could be deleted and this case would stay green. It does still exercise the SELECT policy (a broken policy would surface A1's row), so it is not worthless, but it reads as a filter guard while guarding nothing. Separately, case 1 as worded ("returns exactly A1's row") invites a bare `toHaveLength(1)`, which two same-shaped rows could satisfy by accident. Neither weakens the *primary* guard — cases 1–2 with two profiles in one account are genuinely red on a dropped filter, traced above — but a test that certifies nothing while looking like proof is exactly the failure mode this feature cannot afford, given RLS cannot see this bug at all.
- **Fix**: Seed one profile and one `shift_log` row on account B too, and assert case 1 by row `id`.
- **Decision**: **FIXED**. Phase 2's suite contract now seeds B's own profile + row, tells the implementer to capture every inserted row `id` (Phase 2's `.select()` already projects `id`), and requires case 1 to assert **the id**, not only the length. A paragraph explains why B needs a row — so a future reader does not "simplify" it back out — and restates that cases 1–2 remain the primary guard.

### F5 — the F1 compatibility claim rests on F1's research; F1's plan does not exist yet

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Autonomous decision D5
- **Detail**: See "The four things the review was specifically asked to verify" §2 above for the full trace. In short: `context/changes/parent-weekly-activity-chart/` contains no `plan.md`, so D5 reasons from F1's research. Everything checkable checks out — `tests/reports.test.ts` and `src/types.ts` are genuinely untouched, and the three real importers of `reports.ts` are all outside F2's diff — but two same-hunk / same-line collisions survive the append-only strategy: the **EOF of `src/lib/services/reports.ts`** (if F1 also appends its bucketing function) and **line 38 of `docs/reference/contract-surfaces.md`** (the shared Consumed-by line). D5's blanket "an append-only diff at the tail rebases cleanly" is true only of F1's edits *above* the append point.
- **Fix**: Name both collision points concretely in D5 and record the merge instruction where the implementer will hit it.
- **Decision**: **FIXED + recorded.** D5 now states plainly that F1 has no plan yet, and names both residuals with file, symbol, line and mechanism. `## Known risks` **R1** carries the operational instruction: on a conflict at the tail of `reports.ts`, rebase and keep **both** symbol sets — never resolve with ours/theirs — and re-read `getWeeklyReport` afterwards; the Consumed-by line must end up naming both consumers. **R2** repeats the "do not reuse `ShiftLogRow`" warning at the point of temptation.

### F6 — Phase 2's Success Criteria and its Progress rows disagree on Automated vs Manual

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 Success Criteria / Progress `### Phase 2`
- **Detail**: `git diff src/lib/services/reports.ts` shows only appended lines was listed under `#### Manual Verification` in the phase block but under `#### Automated` in Progress as row `2.6`. The subsection split is a mechanical contract, not decoration: `/10x-goal-implement` drives `#### Automated` rows only and leaves `#### Manual` as the human checklist, so the same step would be treated differently by the two sibling skills. The rest of the Progress↔Phase contract is clean — one `## Progress` after `## References`, one `### Phase N:` per `## Phase N:` with matching names, `- [ ] N.M` rows throughout, and **zero** checkbox lines anywhere in the phase blocks.
- **Fix**: The step is a runnable command — move the phase-block bullet into Automated so it matches Progress.
- **Decision**: **FIXED**. Bullet moved to Phase 2's `#### Automated Verification`, with an inline note that Progress row 2.6 is the match. Manual now holds one row (2.7), as Progress already had.

### F7 — a manual verification step cannot be evaluated as written

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Testing Strategy → Manual Testing Steps, step 3
- **Detail**: "…confirm the shift's task count matches what the results screen reported." The results screen reports no task count. `t.results` (`src/i18n/pl.ts`) carries `progress: "Zadanie {current} z {total}"` — shown *during* the shift, not after — plus `heading`, `earnedLabel`, `savingsHint`, `starsLabel`, the four star lines, `levelUp`, `backToStart`, `saveError`, and the upgrades nudge. There is no post-shift task-count readout anywhere. A verifier would either invent a comparison or silently pass the step.
- **Fix**: Point at the readout that actually exists.
- **Decision**: **FIXED**. Reworded to compare against the `{total}` in the `Zadanie N z M` progress line seen during the shift, with a parenthetical noting the results screen renders no task count so nobody re-introduces the bad wording.

### F8 — Success Criteria headings omit the house trailing colon

- **Severity**: 📋 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Detail**: This plan writes `#### Automated Verification` / `#### Manual Verification`; every other plan in `context/changes/*/plan.md` and `context/archive/*/plan.md` writes them with a trailing colon. Checked whether this breaks tooling: it does not. The mechanical contract in `.claude/skills/10x-plan/references/progress-format.md` covers only `## Progress`, `### Phase N: <name>`, `#### Automated`, `#### Manual` and `- [ ] N.M`, and `/10x-implement` / `/10x-goal-implement` parse nothing else. This plan satisfies all of it. Cosmetic house-style drift only.
- **Decision**: **RECORDED, not acted on** (OBSERVATION policy for this run). Editing headings on a plan about to be implemented buys nothing and risks a needless diff.

### F9 — `templateRegex` already exists and is a more explicit locator than the prefix trick

- **Severity**: 📋 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Detail**: Phase 4 asserts the counted shift label by matching the shorter `t.start.activityShift`, relying on `activityShiftTasks` containing it as a prefix — an invariant recorded only in prose, which a future copy tweak could quietly break. `e2e/helpers/i18n.ts` already exports `templateRegex(template)`, which turns `"Zmiana ukończona · {tasks}"` into `/Zmiana ukończona · .+?/` and states the intent structurally. The plan's approach is correct as written (the prefix relationship is real, and the plan explicitly forbids rewording either key without redoing the audit), so this is an alternative, not a defect.
- **Decision**: **RECORDED, not acted on.**

### F10 — nothing validates `docs/reference/contract-surfaces.md`

- **Severity**: 📋 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Detail**: `grep -rn "contract-surfaces" tests/ e2e/ src/ scripts/ .github/` → zero hits. The file is hand-maintained prose; the Phase 2 registry edit has no automated check and cannot break any suite. Worth knowing when weighing the F5 merge risk on line 38 — a mis-merge there is silent.
- **Decision**: **RECORDED, not acted on.**

---

## Triage summary

```
═══════════════════════════════════════════════════════════
  TRIAGE COMPLETE  (autonomous — agent-contract hard rule 1)
═══════════════════════════════════════════════════════════

  Fixed in plan.md:   F1, F2, F4, F5, F6, F7        (6)
  Fixed + deferred:   F3 (rationale fixed; class choice → Known risks R3)
  Recorded only:      F8, F9, F10                   (3)

  ► Verdict after fixes: REVISE → SOUND
═══════════════════════════════════════════════════════════
```

### Everything that changed in `plan.md`

| # | Section | Change |
|---|---|---|
| F1 | Desired End State, Phase 3 SC, Phase 4 SC | "17 runs" → measured `15/15` (13 desktop + 2 touch) with `--list` evidence and the reason the count cannot move |
| F2 | Phase 3 SC + Progress | New criterion `npm run check` (`astro check`) with the green baseline quoted; new Progress row `3.11` |
| F3 | D2 | False "every other multi-column row already stacks" replaced by the measured correction (`SkillCards` `sm:grid-cols-3`, results tiles `sm:grid-cols-4`), and the `lg:` choice named as a deliberate deviation pointing at R3 |
| F4 | Phase 2 → isolation suite | Account B seeded with its own profile + row; case 1 must assert the row **`id`**; a paragraph explaining why, and that cases 1–2 stay the primary guard |
| F5 | D5 | States F1 has no `plan.md`; names both residual collisions (EOF of `reports.ts`; `contract-surfaces.md:38`) with mechanism |
| F6 | Phase 2 SC | `git diff … appended lines only` moved from Manual to Automated to match Progress row 2.6 |
| F7 | Manual Testing Steps §3 | Compare against the `Zadanie N z M` progress line, not a nonexistent results-screen readout |
| — | New `## Known risks` (before `## References`) | **R1** F1 merge instruction · **R2** do not reuse `ShiftLogRow` · **R3** the 712px breakpoint deviation, with the one-token reversal · **R4** the best-effort write means the feed may legitimately miss an event |
| — | Progress | `+ 3.11` (astro check), `+ 4.6` (evaluate R3 at 712px) |

Nothing else in the plan was touched. All four phases, their ordering, every autonomous
decision D1–D9, and the whole approach stand as written.

## What the implementer must carry

1. **R3 is a live design question, not a settled one.** The 712px column count is deferred to
   manual verification on purpose. Progress row 4.6 exists so it gets an answer.
2. **R1 is a merge hazard with a wrong default.** If git conflicts at the tail of
   `reports.ts`, both sides' symbols must survive.
3. **The `profile_id` filter is the whole security story.** RLS cannot see its absence. The
   deliberate-break check (Progress 2.4) is not ceremony.
4. **Never assert `t.start.activityToday`.** Confirmed at `src/i18n/pl.ts:203`.
