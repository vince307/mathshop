<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Named shop growth stages + per-shift earnings

- **Plan**: `context/changes/world-progression-stages/plan.md`
- **Mode**: Deep
- **Date**: 2026-08-23
- **Verdict**: **REVISE** → **SOUND after fixes** (all findings triaged and applied in this step)
- **Findings**: 1 critical, 7 warnings, 2 observations
- **Reviewer**: autonomous step of `context/runs/2026-08-22-autonomous-five/` — no human in the loop,
  so every finding was triaged by the reviewer per the standing brief (Hard rule 1). CRITICAL and
  WARNING findings were fixed directly in `plan.md`; OBSERVATIONs were recorded under the plan's new
  `## Known risks`.

## Verdicts

| Dimension | Verdict | Note |
|-----------|---------|------|
| End-State Alignment | **FAIL → PASS** | F1's suppression predicate defeated the feature's own payoff |
| Lean Execution | **PASS** | Four phases, each independently committable; no premature abstraction found. `unlocksForStage` deriving from `UPGRADES` instead of a second hand-maintained list is the right call |
| Architectural Fitness | **PASS** | Every pattern claim verified against the code it cites (`skillProgress`, `upgrades.ts` house style, `upgradeCopy`, `upgrades.astro` frontmatter, `AppShell` nav) |
| Blind Spots | **WARNING → PASS** | Landing order and cross-feature contention were only half-seen |
| Plan Completeness | **WARNING → PASS** | Absolute test counts, stale line anchors, and an E2E workflow bypass |

## Grounding

`Grounding: 14/14 paths ✓, 21/21 symbols ✓, brief↔plan ✓, Progress↔Phase ✓ (one `## Progress`, 4/4 phase headings matched, no stray checkboxes)`

Line-number accuracy of the plan's own citations: **~85%** — every *symbol* reference resolved, but
the numbers for `src/i18n/index.ts`, `src/i18n/pl.ts` and `src/pages/app/start.astro` had already
drifted 10–20 lines because F2 landed after the plan was written. See F5.

**Independently verified and found sound** (no finding raised):

| Claim | Evidence |
|---|---|
| RLS needs no change (D-9) | Read all four policies in `20260701150000_create_shift_log.sql:38-63`: `select`/`insert`/`update`/`delete`, all `to authenticated`, all `auth.uid() = account_id`, **none names a column**. `grep -rniE "grant\|revoke" supabase/migrations/` finds one `grant execute` and no column grant. D-9 is accurate as written |
| Migration is safe on a live table | Additive, nullable, no default, no backfill, no index → no table rewrite. The one adjustment made is naming the check constraint (F7) |
| `recordShiftResult` → `appendShiftLog` cannot desync | The profile UPDATE commits at `child-profiles.ts:175-184` **before** `appendShiftLog` runs at `:187`; the insert error is swallowed as today. Passing an extra optional key changes no ordering and no failure semantics. The new CHECK is unreachable: `5t + 3c` over zod-bounded non-negative ints (`complete.ts:41-42, 52`) is always a non-negative `int4`. Recorded in `## Known risks` for completeness |
| `stageForLevel` is total and saturating | The D-2 spec covers `0 / -5 / NaN / 1.5 / Infinity` and `999`; `skillProgress` (`src/data/skills.ts:96-110`) is a real precedent for the `atMax` shape. `unlocksForStage` is well-defined: `requiredWorldLevel` is a **required** field with values `1,1,2,2,3,3`, so stage 4 correctly yields `[]` |
| `t.results.levelUp` keeps firing past the last stage | `ShiftResults.tsx:63` is `{leveledUp && …}`; `leveledUp` is `businessLevel > current.business_level` (`child-profiles.ts:189`) over an uncapped `1 + floor(n/3)`. D-2a holds |
| The 6-tab bottom bar holds | Measured against the real component: `flex items-stretch justify-around … px-2` at `AppShell.astro:187`, tabs `min-w-0 flex-1 px-1 text-[0.7rem]`, `size-6 shrink-0` icon, `<span class="truncate">`. 6 tabs → 208 px intrinsic minimum; at 712 px each gets 116 px. `truncate` is `text-overflow: ellipsis`, which does **not** alter the accessible name — `getByRole(name)` keeps resolving. Current tab count is 4 (`items` = dashboard/missions/shop at `:59-63`, plus the pinned `parent` at `:65`), so F4 → 5 and F5 → 6, as D-6 says |
| Route boundary vs F5 | `context/changes/world-selection-screen/plan.md` owns `/app/worlds` + `active="worlds"` + `t.nav.items.worlds = "Światy"` + icon `Globe`; F4 takes `/app/growth` + `"growth"` + "Rozwój świata" + `TrendingUp`. No overlap. Both widen the one-line union at `AppShell.astro:38`. Re-grepped `pl.ts` on 2026-08-23: **no** existing string contains "Rozwój", "Aktualnie" or "Etap", so D-4's substring check survives F2's new copy |
| `PROTECTED_ROUTES` needs no edit | `["/app"]` matched with `startsWith` gates `/app/growth` with zero middleware change |

## Findings

### F1 — The earnings-tile suppression rule suppresses the tile forever, not transitionally

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: End-State Alignment
- **Location**: D-1a (transitional rule) + **Handed to F1** rows 3/5 and rule 1 + suggested tests
- **Detail**: The plan makes **every purchase row `earned: null` by design** (D-1; `buyUpgrade` at
  `child-profiles.ts:257-262` is deliberately left unchanged) and then defines the display gate as
  *"suppress the tile while **any row** in the displayed window has `earned is null`"* — recipe row 3
  spells it out as `hasUnknownEarnings = true if any row in the window has earned == null`. Together
  those two rules mean **any week in which the child buys a single upgrade hides the earnings tile**,
  permanently and by construction. Buying upgrades is the core loop the feature exists to reward, so
  the failure fires on exactly the weeks the tile is most wanted.
  The plan's claim that it *"self-heals within seven days of the migration"* is therefore false, and
  its own suggested test — *"a window of only purchase rows (all `null`) sets `earningsKnown: false`"*
  — would have **locked the defect in** as intended behaviour.
- **Fix A ⭐ Recommended (applied)**: Scope the predicate to shift rows —
  `rows.some((r) => r.upgrade_purchased === null && r.earned == null)`.
  - Strength: Preserves D-1's whole point (`null` = "not a shift", distinguishable from "earned
    nothing"); costs nothing (`upgrade_purchased` is already in the `.select()`); needs no migration,
    write-path or test change in F4 itself; and the two row kinds provably never overlap
    (`recordShiftResult` calls `appendShiftLog` without `upgradePurchased`, `buyUpgrade` always with
    it). Self-healing becomes genuinely true — a pre-migration *shift* row can only fall in the
    current Mon–Sun window during the migration week.
  - Tradeoff: An empty or purchases-only week now renders `0 zł` instead of nothing. Judged correct,
    not a lie: `statTasks` already renders `0` for the same week, and the claim is scoped to "the
    shifts we recorded this week".
  - Confidence: HIGH — verified against the two call sites and the existing `.select()` list.
  - Blind spot: None significant.
- **Fix B (rejected)**: Record `earned: 0` on purchase rows.
  - Strength: A single uniform predicate; `earned` becomes non-null for every post-migration row.
  - Tradeoff: Contradicts D-1's central argument (a recorded `0` is indistinguishable from a
    zero-earning shift — the exact fabrication B-2 was rejected for), requires editing `buyUpgrade`,
    and invalidates F4's own Phase 1 test asserting a purchase row's `earned` is `null`.
  - Confidence: HIGH that it works; HIGH that it costs more than Fix A.
  - Blind spot: None significant.
- **Decision**: **FIXED via Fix A** — D-1a now carries the scoped predicate as a block quote with the
  corrected self-healing claim; rule 1 of the hand-off restated; recipe row 3 rewritten; and the
  suggested test **inverted** (purchases-only → `earningsKnown: true`, `earned: 0`) with a note saying
  why the previous version was wrong.

### F2 — The hand-off recipe is written against a premise that was already stale

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: D-7 + **Handed to F1** (rows 2, 5, 6)
- **Detail**: D-7 asserts *"F1 has not landed — holds only `change.md` (`status: new`) and
  `handoff.md`… no research, no plan, no branch, no code."* Verified false:
  `context/changes/parent-weekly-activity-chart/` holds `change.md` (**`status: planned`**),
  `research.md` (47 KB), `plan-brief.md`, a **complete six-phase `plan.md`** (69 KB) and an empty
  `reviews/`. F1's plan edits **every region the recipe names**, so three rows were wrong:
  - **Row 2**: F1 Phase 1 §2 changes the `.select()` to `"created_at, skills, upgrade_purchased"`.
    The recipe's find-string (`"skills, upgrade_purchased"`) will not match post-F1; the correct
    post-F1 edit is `"created_at, skills, upgrade_purchased, earned"`.
  - **Row 5**: F1 Phase 5 already changes the `<ul>` (verified at `WeeklyReport.tsx:139`,
    `grid grid-cols-2 gap-3`) to `grid-cols-2 sm:grid-cols-3` and inserts a `statFirstTry` tile. F4's
    tile is therefore the **fourth in a three-column grid**, leaving an orphan on a second row at
    every width ≥ `sm` — **a layout decision neither plan made**.
  - **Row 6**: the line numbers are wrong. `statTasks`/`statUpgrades` are at `src/i18n/pl.ts:415-416`,
    not `~:396` (`:396` is `title: "Panel rodzica"`), and the stale comment is at `:411-414`, not
    `:394-396`. F1's plan cites `:394-397` for the same comment and is **also** wrong. Worse: F1
    Phase 3 §2 rewrites that comment to assert *"`shift_log` has no earnings column"* — which F4's
    migration makes false, so F4 must rewrite it a **second** time.
- **Fix (applied)**: Rewrite D-7's premise honestly; re-head the recipe with "anchor on symbols, not
  line numbers"; correct rows 2, 5 and 6 with the post-F1 edit **and** the pre-F1 fallback; and add a
  **tile-grid note** making the layout decision:
  `cn("mt-5 grid gap-3", earningsKnown ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 sm:grid-cols-3")`
  with `statEarned` appended last.
  - Strength: Balanced in **both** states (3 tiles → F1's layout untouched; 4 tiles → 2×2 up to `lg`,
    then one row of four). Measured on the real page: the island sits in the `lg:col-span-2` column of
    `report.astro:56`'s `lg:grid-cols-3` inside `max-w-6xl px-4 lg:px-8` with a `p-6` card → ≈ 661 px
    inner at `lg`, so four `gap-3` columns give ≈ 156 px per tile and ≈ 124 px of text after `p-4`.
  - Tradeoff: One conditional class instead of a constant; `sm:grid-cols-4` was rejected because at
    640 px it yields ≈ 98 px of text width, near the 62.7 px case F1's own review flagged.
  - Confidence: HIGH on the arithmetic and the F1 collision; MEDIUM on the exact breakpoint choice —
    a maintainer may prefer `sm:grid-cols-4`, which is a one-token change.
  - Blind spot: F1's plan is itself unreviewed in this region; if F1's own review moves the tile grid
    again, row 5 needs re-checking.
- **Decision**: **FIXED**

### F3 — Three-way contention on `src/lib/services/reports.ts`, and no plan sees the whole picture

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: §8b of the handoff / Critical Implementation Details
- **Detail**: Three features write the same file in one run and each sees only its neighbours:
  **F2** has `listRecentActivity` in the working tree at `reports.ts:117-160` (its pure core landed in
  `e40d650`; the service function and a `docs/reference/contract-surfaces.md` edit are still
  uncommitted); **F1** plans to land second and restructures `ShiftLogRow`, the `.select()` and
  `aggregateWeeklyReport`'s signature, explicitly preferring F2 to merge first; **F4**'s recipe
  assumed the pre-F1, pre-F2 file. Separately — and unnoticed by F4 — **F2 edits the exact
  `## public.shift_log` section of `contract-surfaces.md` that F4 Phase 1 §3 edits**, four lines
  apart (F2 rewrites *Consumed by* / *Isolation test*; F4 edits *Defined in* / *Columns*).
- **Fix (applied)**: A landing-order table (**F2 → F1 → F4**) plus a contention list in Critical
  Implementation Details, stating that F4's own four phases touch **none** of `reports.ts`,
  `WeeklyReport.tsx` or `src/types.ts` — the contention lives entirely in the hand-off recipe — and
  naming the `contract-surfaces.md` adjacency as a re-read-before-editing region.
  - Strength: The implementer rebases with the full picture instead of discovering it in a conflict.
  - Tradeoff: None; documentation only.
  - Confidence: HIGH — verified from `git log`, `git status` and both sibling plans.
  - Blind spot: F5's landing slot is unmodelled; D-4/D-5/D-6 already cover its regions.
- **Decision**: **FIXED**

### F4 — Success criteria hardcode absolute test counts against a moving baseline

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Desired End State + all four phases' Success Criteria + Progress rows 1.3, 1.6, 2.2,
  3.2, 3.4, 4.2, 4.3
- **Detail**: `npx playwright test` **"is green at 15/15"** appears as a criterion in Phases 1 and 3,
  and Phase 4 predicts **"expected: 20"**. `15` was correct at plan time (verified: 13 `test()` blocks
  across six specs, plus `gameplay-restore`'s 2 counted again in the `touch` project) but **F1's
  Phase 6 adds e2e specs**, at which point `15/15` is unsatisfiable — a green suite fails the
  criterion. The unit floors (`≥ 299`, `≥ 301`, `≥ 313`) fail the other way: once F2's two new test
  files raise the floor past them they stop verifying anything. This exact class of unsatisfiable
  criterion was already caught in another feature's review this run.
- **Fix (applied)**: Define `U₀` / `E₀` as floors **measured on the branch before Phase 1**, with the
  commands to measure them, and restate every criterion and Progress row as `U₀ + delta` / `E₀ + delta`
  (`+2`, `+~14`, `+5`, or "unchanged"). Added an explicit rule that no criterion in this plan may
  hardcode an absolute count.
- **Decision**: **FIXED**

### F5 — Line-number anchors throughout the plan have already rotted

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Key Discoveries, Phase 2 §2, Phase 3, References
- **Detail**: Verified drift caused by F2 landing after the plan was written:
  `upgradeCopy` is at `src/i18n/index.ts:52` (plan says `:29-35` — that range is now F2's
  `taskForms`); the `upgrades` copy record is at `src/i18n/pl.ts:285` (plan says `:266-275`);
  `start.astro`'s milestone path renders around `:129` and its savings computation is at `:71-80`
  (plan says `:111-133` and `:56-62`); `readLogRows` is at `tests/shifts-complete.test.ts:90-97`
  (plan says `:89-97`). **Every symbol name is correct** — only the numbers rot, and they will rot
  again when F1 lands.
- **Fix (applied)**: An "anchor on a symbol or a quoted string, not a line number" rule in Critical
  Implementation Details, listing the specific numbers already known to have moved.
- **Decision**: **FIXED**

### F6 — Phase 4 writes E2E specs inline, bypassing the skill the project binds them to

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 4 §2 (`e2e/growth.spec.ts`, `e2e/smoke.spec.ts`, `playwright.config.ts`)
- **Detail**: `CLAUDE.md` says *"**E2E tests:** use the `/10x-e2e` skill; the binding rules live in
  `@e2e/CLAUDE.md`"*, and `e2e/CLAUDE.md:45` calls that skill *"the single source of truth for the
  workflow"*. F4's Phase 4 specifies the spec contents as inline `/10x-implement` work. The sibling
  F1 plan routes its browser phase correctly (Phase 6, "hand-off to `/10x-e2e`"), so F4 is the
  outlier. The spec *contracts* themselves are good — full-accessible-name locators, both projects,
  no `getByText` fragment, an overflow assertion — they are just being landed by the wrong tool.
- **Fix (applied)**: Reframe Phase 4's overview: land the nav entry + copy under `/10x-implement`,
  then run `/10x-e2e world-progression-stages` for the spec, the smoke test and the
  `playwright.config.ts` widening; the written contracts become that skill's brief.
  - Strength: Restores the project's stated workflow at zero cost to the plan's substance.
  - Tradeoff: Phase 4 becomes two invocations instead of one.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: **FIXED**

### F7 — The migration's CHECK constraint is unnamed, unlike every precedent

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 §1 (the migration)
- **Detail**: The plan writes the guard as an inline `check (earned is null or earned >= 0)` while
  citing `child_profiles_*_nonneg` as the precedent — but that precedent
  (`20260630120000_child_profiles_add_gameplay_state.sql:26-29`) uses a **separate `alter table … add
  constraint <name> check (…)`** statement for every guard. An anonymous inline check gets a
  Postgres-generated name that no later migration and no rollback line can reference.
- **Fix (applied)**: `add constraint shift_log_earned_nonneg check (earned is null or earned >= 0)`
  in a second `alter table` statement, matching the precedent.
- **Decision**: **FIXED**

### F8 — The art deviation's only durable home is a document that gets archived

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: D-3 + Phase 2 §1 (`src/data/stages.ts` header) + Phase 3 §5 (`ShopArt` doc comment)
- **Detail**: D-3 is a well-argued deviation with a concrete ART-A upgrade path, but it lives in
  `plan.md`, which moves to `context/archive/` when the change closes. In code, the plan records only
  the **render** seam (two lines in `ShopArt.tsx`'s doc comment). The **catalogue** seam — where an
  `art?: string` field would go, and why stage 3/4's copy deviates from the mockup — has no home, so
  a later maintainer is most likely to "fix" the mockup deviation back or re-litigate the art
  decision. `public/illustrations/slice-map.md` is not the right place: it is a crop table, and F4
  ships zero crops.
- **Fix (applied)**: Phase 2 §1 now requires three lines in `src/data/stages.ts`'s header naming the
  zero-per-stage-art fact, the ART-A upgrade path (`art?: string` → crops + slice-map rows →
  `stage.art ?? world.image`), and the two deliberate copy deviations.
- **Decision**: **FIXED**

### F9 — Two `t.growth` strings duplicate existing Polish verbatim

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 3 §3 (the `growth` copy table)
- **Detail**: `t.growth.upgradesLink = "Zobacz ulepszenia"` is byte-identical to
  `results.upgradesNudgeLink` (`pl.ts:363`), and `t.growth.tipHeading = "Wskazówka"` to
  `task.hintTitle` (`:246`). Neither creates an accessibility-tree ambiguity — `results.*` renders in
  the shift-results island on `/app/task` and `task.hintTitle` on the mission screen, so neither ever
  coexists with `/app/growth` — and per-namespace duplication is the existing house pattern. But D-4's
  substring check only tested the **nav label**, so the duplication is unrecorded.
- **Fix**: Record it; a future cross-surface e2e must use a page-scoped locator rather than a bare
  `getByText`.
- **Decision**: **RECORDED** in the plan's `## Known risks`

### F10 — Two small unrecorded inaccuracies

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: D-6 + `change.md` title
- **Detail**: (a) D-6's width arithmetic measures "Panel rodzica" as the longest label but never
  measures **"Rozwój świata"**, the label the change actually adds — same 13 characters, marginally
  wider. Headroom at 712 px (≈ 108 px available vs ≈ 80–85 px needed) means the verdict is unchanged,
  and Phase 4's browser check measures the real thing. (b) `change.md`'s title still reads *"with
  per-stage art"*, which D-3 makes false — already acknowledged as a deliberate autonomous decision
  in `change.md` itself.
- **Fix**: Record both; neither warrants an edit.
- **Decision**: **RECORDED** in the plan's `## Known risks`

## Triage summary

```
Fixed (in plan.md):  F1 (Fix A), F2, F3, F4, F5, F6, F7, F8   (8)
Recorded only:       F9, F10                                   (2)
Skipped / Accepted / Dismissed: none

► Verdict after fixes: REVISE → SOUND
```

## Autonomous decisions

This step ran with no human in the loop (standing brief, Hard rule 1). `AskUserQuestion` was never
called; the skill's Step 6 "how would you like to proceed?" prompt and its whole Step 7 triage loop
collapsed to "decide, then save".

- **Chose "Triage findings" over "Save report only"**, and applied all eight actionable findings to
  `plan.md` in the same step. Rejected: saving a PENDING report — the next agent is an implementer,
  not a reviewer, and an unfixed CRITICAL in a document flagged `plan_reviewed` is worse than no
  review. What would change the answer: a RETHINK verdict, in which case the plan is left alone by
  standing instruction.
- **Fixed F1 with the shift-scoped predicate (Fix A) rather than `earned: 0` on purchases (Fix B).**
  Fix B would have required editing `buyUpgrade`, invalidated F4's own "purchase row is `null`" test,
  and re-opened D-1's central argument that a recorded `0` is a fabricated number. Reverses if the
  maintainer decides purchase rows should carry `0` for reporting convenience — that is a data-model
  call, not a display call.
- **Chose `grid-cols-2 lg:grid-cols-4` over `sm:grid-cols-4` for the four-tile state**, on measured
  widths (≈ 124 px of text at `lg` vs ≈ 98 px at exactly 640 px, against the ≈ 62.7 px case F1's own
  review already called a legibility defect). Reverses on a maintainer's aesthetic preference — it is
  a one-token change.
- **Did not rewrite the plan's D-1 no-backfill decision, D-2 saturation decision, D-3 art decision or
  D-9 RLS verdict.** Each was attacked and each survived; the evidence is in the Grounding table.
- **Did not run `npm test` / `npx playwright test`.** Another agent is mid-implementation on
  `feat/dashboard-recent-activity` with uncommitted work in the tree; a review step running the suite
  would measure that agent's in-flight state, not F4's baseline. This is exactly why F4 finding above
  replaces absolute counts with a floor the implementer measures on their own branch.
