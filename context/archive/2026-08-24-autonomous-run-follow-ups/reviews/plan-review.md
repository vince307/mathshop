<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Closing the ten triaged follow-ups

- **Plan**: `context/changes/autonomous-run-follow-ups/plan.md`
- **Mode**: Deep
- **Date**: 2026-08-24
- **Verdict**: REVISE (all findings applied in-plan by this step → SOUND)
- **Findings**: 5 critical, 4 warnings, 2 observations

Autonomous run: no interactive triage. Per the run's agent contract, CRITICAL and obvious
WARNING findings were **fixed directly in `plan.md`** by this review step; observations are
recorded only.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | FAIL (C1, C2, C4) |
| Plan Completeness | WARNING (C3, C5, W1–W4) |

## Grounding

17/18 plan-named paths ✓ (`AppShell.astro` lives at `src/components/app/`, not
`src/layouts/`; the plan never states a path for it, so no finding). 20/20 symbols ✓
(`nextUpgrade`'s `requiredWorldLevel <= businessLevel` filter and the 1/1/2/2/3/3 catalogue;
`sign` 30 zł + `shelf` 60 zł are the only two level-1 upgrades; the three role-less
`aria-label` spans in `StageRail.astro`; `WorldPicker`'s `<form method="POST"
action="/api/profiles/world">`, its `hidden lg:block` `<p>` and unlabeled `<ul>`; the seven
`it()` blocks in `tests/worlds-picker.test.tsx`; `WORLD_SLOTS.piekarnia.sign`
`{left:"7%",top:"10%"}` vs `DEFAULT_SLOTS.sign` `{left:"10%",top:"6%"}`; `unplaced` always
empty; `if (!("ok" in result))` in `profiles/world.ts` and
`updateChildProfileTheme`'s three-way return; `child()`'s hard-coded `daily: EMPTY_WEEK` and
`WeeklyActivityChart`'s `maxCount === 0` early return plus its dead `import React`;
`e2e/helpers/accounts.ts`'s four exports and `SeedProfileOptions.businessLevel`/`shopState`;
`appendShiftLog`'s five columns; `LOCKOUT_MS = 60_000` and the two `failed_attempts` resets;
`## Parent PIN routes` carrying no limitation bullet). Brief↔plan ✓.

**Independently re-verified, and true:** the plan's L-007 claim. The new string
`"Masz już wszystkie ulepszenia dostępne na tym etapie."` was checked in both directions
against every ≥4-char literal in `src/i18n/pl.ts` — zero collisions, and the key does not
already exist. `vitest.config.ts`'s `include` is `tests/**/*.test.{ts,tsx}`, so Phase 3's
`.ts → .tsx` rename cannot silently drop the file.

## Findings

### C1 — Phase 5's deliberate break stays green and proves nothing

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 5 → Success Criteria → Deliberate break
- **Detail**: The plan contracted "change the `"error" in result` branch's redirect target to
  anything other than `WORLDS` → `tests/profiles-world.test.ts`'s ownership-bounce assertions
  fail". They cannot. That branch is unreachable in that suite — which is the plan's **own**
  premise in D3 (the file drives the real route against real Supabase, so
  `updateChildProfileTheme` never returns `{ error }`), and the ownership bounce the suite
  does exercise comes from `resolveActiveProfile` returning `null` **before** the call. This
  is L-004's exact failure mode: a break inside an unreachable branch certifies nothing.
- **Fix applied**: replaced with inverting the discriminant (`if (!("error" in result))`), so
  a *successful* update falls into the bounce and the file's own-profile test goes red on
  both `Location` and the `readTheme(profileA)` read-back — the only assertion in the file
  that separates the ok path from the bounce, and misclassification is this refactor's only
  possible regression. The rejected break is recorded in the plan so nobody re-derives it.
- **Decision**: FIXED

### C2 — Phase 6's seeder recipe names an API that cannot produce a timestamp

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 6 → Changes Required §3 (`seedShiftWeek`)
- **Detail**: The contract said `created_at` "must be computed from `weekDayKeys(new Date())`
  … `zoneOffsetMinutes` is the project's only offset parser and must not be re-implemented".
  `weekDayKeys` returns seven Europe/Warsaw civil-date **strings**, not instants, and
  `zoneOffsetMinutes` is a module-**private** `function` in `src/lib/services/reports.ts`
  with no `export` — unreachable from `e2e/`. The instruction is therefore unactionable, and
  the implementer's likely escape is the UTC day arithmetic the same paragraph forbids.
  Compounding it: `e2e/` has no `@/` alias (`e2e/helpers/i18n.ts` reaches the app as
  `../../src/i18n`).
- **Fix applied**: spelled the recipe out — `` `${weekDayKeys(new Date())[weekday]}T12:00:00Z` ``.
  Noon UTC is 13:00 (CET) / 14:00 (CEST) Warsaw, so it lands on the intended civil day under
  both offsets and sits safely after `startOfWeek`'s Monday boundary (22:00Z/23:00Z the prior
  Sunday), which the report filters with `.gte("created_at", …)`. No offset parser, no second
  copy. Import path stated as `../../src/lib/services/reports`. Also noted that
  `appendShiftLog` does **not** set the column, so this is the one place the seeder departs
  from mirroring it.
- **Decision**: FIXED

### C3 — Phase 6's e2e delta is wrong: that spec is desktop-only

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 6 → Automated Verification; Progress 6.3
- **Detail**: The criterion said "branch e2e baseline + 1 test per project". `playwright.config.ts`'s
  `touch` project carries `testMatch: /(gameplay-restore|growth)\.spec\.ts/`, so
  `e2e/parent-weekly-report.spec.ts` runs in `desktop` **only**. The true delta is +1 total.
  An implementer measuring +1 against a criterion demanding +2 either hunts a non-existent
  failure or "fixes" it by forcing the spec into `touch`. (Phase 1's "+1 per project" for
  `e2e/growth.spec.ts` is correct — that file *is* in the `touch` match.)
- **Fix applied**: criterion and Progress row 6.3 now read "+1 run TOTAL (`desktop` only)",
  with the `testMatch` reason inline.
- **Decision**: FIXED

### C4 — Phase 6's new e2e test skips the parent-PIN gate

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 6 → Changes Required §4 (first consumer)
- **Detail**: The contract said only "reuse the file's existing `provisionAccount` /
  `try/finally` / `deleteUser` shape". `/app/report` sits behind the parent-PIN gate: both
  existing tests in `e2e/parent-weekly-report.spec.ts` call
  `setPinAndLandOnReport(page, "2468")` from `./helpers/parent-pin` and then
  `waitForIslands(page)`. A test built to the contract as written never reaches the report,
  and the failure looks like the seeder.
- **Fix applied**: the full setup chain is now spelled out (seed **before** `signInViaUI`,
  then `setPinAndLandOnReport`, then `waitForIslands`), plus `e2e/CLAUDE.md`'s binding rule
  that the test is named after its risk and the risk added to the provenance header.
- **Decision**: FIXED

### C5 — `### Phase 0` in Progress had no `## Phase 0` block in the plan body

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: `## Progress` ↔ plan body
- **Detail**: `references/progress-format.md` makes it a mechanical contract: one
  `### Phase N: <name>` per `## Phase N:` in the body. Progress carried a `Phase 0: Branch
  baseline` with no body block, while Implementation Approach said "Seven phases". Phase 0 is
  the one phase the predecessor handoff calls "not optional", and it had no contract at all.
- **Fix applied**: added a `## Phase 0: Branch baseline` body block (no commit; worktree
  bootstrap, the four figures to measure, the per-project `--list` split, and L-005's
  stacked-branch clause — if the sweep stacks this on `feat/remember-me-on-login`, the
  baseline is *that* branch's). Implementation Approach reworded.
- **Decision**: FIXED

### W1 — Phase 4 undercounts the stale nav prose

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 → Changes Required §2
- **Detail**: The plan named "two stale *Five entries* comments". There are three — the file's
  provenance header also says "the touch run is also the fifth tab's fit check: five entries
  must sit in one row". Leaving it makes the phase's own deliverable half-done.
- **Fix applied**: all three corrected, plus a note that `AppShell`'s `items` genuinely holds
  five (the sidebar renders `parent` as its own pinned link; `tabs` spreads all six) — which
  is why the count reads five in the component and six in the accessibility tree.
- **Decision**: FIXED

### W2 — `getByRole("img", { name })` without `exact: true`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 → Changes Required §4(a)
- **Detail**: Playwright's accessible-name matching is substring + case-insensitive by
  default. "Etap 1" is not currently a substring of any other name on `/app/growth` (checked:
  "Etap zablokowany", "Etap ukończony", "Etap w trakcie", "Etapy rozwoju"), so the assertion
  works today — but L-007 is precisely about the label that has not been added yet.
- **Fix applied**: `exact: true` plus `toHaveCount(1)`.
- **Decision**: FIXED

### W3 — Phase 2 prices `+ 2` without saying two `it()` blocks land

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 → Changes Required §2 vs Success Criteria
- **Detail**: The contract said "add assertions"; the criterion said `baseline + 2`. Folded
  into existing blocks, the delta is 0 and the criterion is unsatisfiable.
- **Fix applied**: contract now requires two new `it()` blocks and names what each counts.
- **Decision**: FIXED

### W4 — Phase 6's new e2e test was not required to name its risk

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 6 → Changes Required §4
- **Detail**: `e2e/CLAUDE.md`: "Name every test after the risk it protects, and note the risk
  in the file's provenance header." Both existing tests in the file follow it (`Risk E2E-1`,
  `Risk E2E-2`); the plan did not ask for it.
- **Fix applied**: folded into the same edit as C4.
- **Decision**: FIXED

### O1 — `## public.shift_log` gains a non-production writer, unrecorded

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Architectural Fitness
- **Location**: Phase 7 / `docs/reference/contract-surfaces.md`
- **Detail**: `seedShiftWeek` becomes the first test-side writer of `shift_log`, and it is the
  only writer that sets `created_at` explicitly. The section's *Consumed by* line names only
  `reports.ts` and `child-profiles.ts`. Not required — that line tracks `src/` consumers — but
  a future reader debugging a drifted bar would find the seeder faster for one clause.
- **Decision**: RECORDED (not applied — Phase 7's contract is deliberately one bullet, and
  this file is contended with F2 this run)

### O2 — D7's contention is already settled by the neighbouring plan

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: End-State Alignment
- **Location**: Plan → D7; handoff § 5
- **Detail**: `context/changes/remember-me-on-login/plan.md` → *What We're NOT Doing* states:
  "**No changes to `e2e/helpers/accounts.ts`** — … F1 owns edits to that file this run." The
  contention D7 hedges against does not exist in F2's plan as written. `ownership.md` still
  does not exist and remains binding if the sweep writes it, so D7's reversal condition
  stands — but the risk is materially lower than the plan's own framing suggests.
- **Decision**: RECORDED
