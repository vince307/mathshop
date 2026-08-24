<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Closing the ten triaged follow-ups

- **Plan**: `context/changes/autonomous-run-follow-ups/plan.md`
- **Scope**: Phases 0–7 (all seven implemented phases), full plan
- **Date**: 2026-08-24
- **Branch reviewed**: `feat/autonomous-run-follow-ups` in `.claude/worktrees/autonomous-run-follow-ups`, `E2E_PORT=4330`
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Verification performed in this step — nothing inherited

**Both baselines were re-measured by this review**, in a throwaway detached worktree at
`282d264` (`git worktree add --detach /tmp/claude/f1-baseline 282d264`), not read from the
implementer's handoff.

| command | baseline @ `282d264` (measured here) | branch (measured here) | delta |
|---|---|---|---|
| `npm test` | **429 passed / 51 files** | **433 passed / 51 files** | **+4** |
| `npx playwright test` | **23 runs / 8 files** (`--list`) | **26 passed / 8 files** | **+3** |
| `npm run lint` | clean | clean | — |
| `npm run check` | 0 errors / 0 warnings / **9 hints** | 0 errors / 0 warnings / **8 hints** | −1 hint |

**The arithmetic reconciles exactly, from the diff rather than from the claim.**
`git diff 282d264..HEAD -- tests/ e2e/ | grep -E '^\+\s*(it|test)\('` returns **six** added
blocks: four `it()` (`worlds-picker` ×2, `shop-art-slots` ×1, `weekly-report-tiles` ×1) →
429 + 4 = 433 ✅; two `test()`, of which `growth.spec.ts`'s runs in **both** Playwright
projects (`playwright.config.ts`'s `touch` `testMatch: /(gameplay-restore|growth)\.spec\.ts/`)
and `parent-weekly-report.spec.ts`'s is desktop-only → 2 + 1 = 3 → 23 + 3 = 26 ✅.
The −1 hint is the dead `import React` dropped from `WeeklyActivityChart.tsx` ✅.

### Deliberate breaks re-executed by this review (not accepted on report)

Five of the implementer's breaks were re-run from scratch on this branch and every one
reproduced, on the assertion claimed:

| break | observed here | meta-check (L-004) |
|---|---|---|
| Remove `role="img"` from `StageRail`'s three markers | Risk E2E-F4-1 red in **both** projects, `toHaveCount` "unexpected value 0" | The other five `growth.spec.ts` runs stayed green — the redness isolates the a11y tree, not the page |
| Delete `WorldPicker`'s `<form>`, keep every child | 3 red / 6 passed in `tests/worlds-picker.test.tsx` | **The pre-phase test file was replayed against the same broken component: 7/7 green.** FU-1's defect reproduced and confirmed genuinely closed |
| Repoint `WeeklyReport`'s `tasksThisWeek` at `upgrades.length` | red at `tests/weekly-report-tiles.test.tsx` on the **tile-vs-bars comparison line**, not the `toBe(9)` anchor | The other 12 tests in the two files stayed green — the pre-existing fixtures were blind, as claimed |
| Drop `WORLD_SLOTS[world.slug]?.` from `ShopArt`'s badge `style` | `tests/shop-art-slots.test.tsx` render case red | The four data `it()` blocks stayed green |
| Invert the discriminant to `if (!("error" in result))`, log body neutralised | `tests/profiles-world.test.ts` red on `Location` — `"/app/worlds"` received, `"/app/start"` expected | Confirms AD-I5: written literally the break reddens via a `TypeError`; neutralised, it lands on the contracted redirect |

### Live-database check (no migration was written)

`git diff --stat 282d264..HEAD -- supabase/` is **empty** — the serialized migrations lane is
untouched, as `ownership.md` §4 requires. Phase 7's K1 bullet asserts *database* behaviour,
so it was checked against the **running** database rather than the migration file:
`select prosrc from pg_proc where proname='register_pin_failure'` returns
`set failed_attempts = s.failed_attempts + 1, locked_until = case when s.failed_attempts + 1
>= p_max then now() + … end` — increment-only, never decayed, and re-locking on the very next
failure once the threshold is passed. The "only two resets" claim also holds:
`src/lib/services/parent-pin.ts` writes `failed_attempts: 0` in exactly two places (`setPin`
and the correct-PIN path), and `LOCKOUT_MS` is `60_000`. **K1 as documented is true.**

### Ownership and lesson checks re-run here

- **`src/components/app/AppShell.astro` and `src/components/child/ShopArt.tsx` are absent from
  `git diff --stat 282d264..HEAD`** — the net-zero requirement `ownership.md` places on F1 is
  satisfied, verified against git objects rather than the handoff's assertion.
- **L-007, both directions, re-run on this branch:** `growth.noNextUpgrade` checked against all
  **342** distinct ≥4-char double-quoted values in `src/i18n/pl.ts` — zero values are a
  substring of it, zero contain it, and it appears exactly once.
- **Logging convention (Pattern Consistency):** `src/pages/api/profiles/world.ts` matches
  `src/pages/api/auth/reset.ts` byte-for-byte in shape, down to the
  `// eslint-disable-next-line no-console` that `eslint.config.js`'s `"no-console": "warn"`
  requires. No logger module invented (C3 honoured); no `profileId` or theme logged.
- **`## Progress` contract:** `grep -c '^- \[ \]' plan.md` → **4**, all under `#### Manual`.

## Findings

### F1 — Risk E2E-3's tile assertion is page-wide, not tile-scoped

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `e2e/parent-weekly-report.spec.ts`, the test `a seeded non-zero week renders live bars whose total matches the tasks tile (Risk E2E-3)` — the `page.getByText("9", { exact: true })` expectation
- **Detail**: The plan's Phase 6 contract says the test "asserts … that the `statTasks` tile
  shows the seeded total". What shipped asserts that **exactly one element anywhere on
  `/app/report`** has the exact text `"9"`. It is never tied to the tile: `t.report.statTasks`
  is asserted visible in a *separate* expectation, and nothing joins the two. This review
  confirmed the assertion does bite the plan's own break (repointing `tasksThisWeek` at
  `upgrades.length` reddens it with "unexpected value 0"), so it is **not** a false green —
  but it is weaker than contracted, and it is the L-007 fragility class in numeric form: any
  future copy or tile that renders a bare `"9"` on that page breaks a test in a feature nobody
  touched. The sibling unit test in `tests/weekly-report-tiles.test.tsx` already does this
  correctly, reading the `<p>` immediately preceding `copy.statTasks`.
- **Fix**: Scope the figure to its tile the way the unit test does — locate
  `t.report.statTasks`, read its preceding sibling, and assert that element's text is the
  seeded total — instead of counting `"9"` across the page.
- **Decision**: DEFERRED — recorded in `follow-ups/review-fixes.md` (WARNING, non-blocking)

### F2 — CROSS-PLAN: F2's plan pins `contract-surfaces.md` section boundaries by line number, and F1 has already moved them

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence (of the neighbouring feature)
- **Location**: `context/changes/remember-me-on-login/plan.md`, the ownership paragraph describing `docs/reference/contract-surfaces.md` (the sentence naming `## Parent PIN routes (RLS surface)` and `## set_updated_at()`)
- **Detail**: That paragraph anchors on line numbers — "`## Parent PIN routes (RLS surface)`
  (line 58 today, ending before `## Account deletion` at line 69) … appended after
  `## set_updated_at()` — the file's last section, ending at line 90". Measured on this branch,
  F1's Phase 7 append has already shifted them: `## Account deletion` is now at **70** and the
  file is **91** lines. Every number after F1's bullet is off by one the moment F1 merges. This
  is L-006 with a live trigger rather than a hypothetical one. Severity is held at WARNING and
  not raised because the same paragraph *also* describes the target semantically ("the file's
  last section, appended after `## set_updated_at()`"), so an implementer reading the prose
  still lands correctly; only the numeric hints rot.
- **Fix**: F2's next step re-anchors that paragraph on the two H2 headings alone, dropping the
  three line numbers (or marks them explicitly as of-the-moment). **Reported, not edited** —
  the agent contract forbids F1 from writing a neighbouring feature's change folder.
- **Decision**: REPORTED to F2 (cross-plan; F1 may not edit it)

### F3 — Manual Progress row 5.5 is ticked for a route-layer check, but its criterion names the browser

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `context/changes/autonomous-run-follow-ups/plan.md`, Progress row `5.5` under Phase 5's `#### Manual`; the behaviour it covers is the `"error" in result` branch of `POST` in `src/pages/api/profiles/world.ts`
- **Detail**: Row 5.5 reads "Forced service failure logs `[profiles/world] …` while the
  **browser** still lands on `/app/worlds` unchanged" and is ticked with SHA `ee0a886`. The
  handoff §5 discloses honestly that the check was performed **at the route layer**, by forcing
  `updateChildProfileTheme` to return `{ error }` and reading the emitted log plus the
  `Location` header — not through a browser. The substance the row protects was demonstrated at
  the layer that carries it, and nothing automated guards the log line (plan D3, accepted
  openly, `baseline + 0` claimed rather than a delta implied). Flagged only because the tick, on
  its own, claims more than was done; the handoff is the thing that makes it honest.
- **Decision**: RECORDED — no action; the disclosure in the handoff is the mitigation

### F4 — `seedShiftWeek` does not guard `keys[weekday]`

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `e2e/helpers/accounts.ts`, `seedShiftWeek` — the `created_at: \`${keys[weekday]}T12:00:00Z\`` expression
- **Detail**: `weekDayKeys` returns exactly seven keys. A caller passing a
  `completedPerWeekday` array longer than seven indexes past the end and builds the literal
  string `"undefinedT12:00:00Z"`, which surfaces as an opaque Postgres timestamp-parse error
  from the `admin.insert` rather than as a clear helper-side message. The failure is loud (the
  helper rethrows), so this is ergonomics, not correctness. The noon-UTC recipe itself is sound
  and was re-checked: `src/lib/services/reports.ts` filters with an open-ended
  `.gte("created_at", startOfWeek(now))` and no upper bound, so rows on later days of the
  current week — a real case, since the run date is a Monday — are still counted.
- **Decision**: RECORDED

### F5 — `LIVE_E2E_STRINGS` was not extended, and the reason is not written down

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `tests/nav-labels.test.ts`, the `LIVE_E2E_STRINGS` const
- **Detail**: That const is documented as "Strings live e2e `getByText` locators assert on pages
  that render `AppShell`", and Phase 1 adds exactly such a locator —
  `page.getByText(t.growth.noNextUpgrade, { exact: true })` on `/app/growth`. It was not
  registered. This is **defensible and was checked**: both registered strings
  (`t.start.walletLabel`, `t.upgradeShop.ownedTag`) are located with **non-exact** `getByText`,
  which is the substring hazard the registry exists to catch, while every locator this change
  adds passes `{ exact: true }` and therefore cannot be broken by a nav label that contains or
  is contained by the string. The gap is that the exemption is nowhere stated, so the next
  reader of a registry that the same phase just expanded a comment block on may reasonably
  conclude it rotted.
- **Fix**: One clause in that const's doc-comment: only **non-exact** locators need registering.
- **Decision**: DEFERRED — recorded in `follow-ups/review-fixes.md`
