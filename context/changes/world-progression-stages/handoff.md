# Handoff — `world-progression-stages` (feature F4)

Rewritten by the `/10x-plan-review` step of the autonomous run
`context/runs/2026-08-22-autonomous-five/`. You are the next agent and you have zero context.
Read this file, then read the standing brief.

**Standing brief (binding, read it in full):**
`context/runs/2026-08-22-autonomous-five/agent-contract.md`
Run log / status table: `context/runs/2026-08-22-autonomous-five/run-log.md`

---

## 1. State

| Item | Value |
| --- | --- |
| Change folder | `context/changes/world-progression-stages/` |
| `change.md` | **`status: plan_reviewed`** (bumped this step), `updated: 2026-08-23` |
| `research.md` | written — ground truth, ~1150 lines |
| `plan.md` | **REVIEWED and AMENDED this step.** 4 phases, all questions closed. This is your input |
| `plan-brief.md` | the 2-minute version — **note: written pre-review, so its hand-off summary is superseded by `plan.md`** |
| **`reviews/plan-review.md`** | **NEW — the full review. Verdict: REVISE → SOUND after fixes** |
| Git branch | **not created** — no branch, no migration, no production code exists |
| **Next command** | **`/10x-implement world-progression-stages`** (Phases 1–3; Phase 4 splits — see §7) |

This step changed exactly three files, all inside the change folder: `plan.md` (amended in place),
`reviews/plan-review.md` (new), `change.md` (status + date), plus this handoff. **No source file, no
migration, no sibling change folder was touched.** Nothing was committed, staged, or branched.

---

## 2. The review verdict

**REVISE → SOUND after fixes.** 1 critical, 7 warnings, 2 observations. **All eight actionable
findings were fixed directly in `plan.md`**; the two observations are recorded in the plan's new
`## Known risks`. Nothing is left PENDING — do not re-run the review.

Dimension verdicts after fixes: End-State Alignment **PASS**, Lean Execution **PASS**, Architectural
Fitness **PASS**, Blind Spots **PASS**, Plan Completeness **PASS**.

The four load-bearing decisions were attacked and **survived**: D-1 (nullable, no backfill), D-2
(saturate at `stageForLevel`, never cap the formula), D-3 (ART-C, zero new assets), D-9 (no RLS
change). Evidence per claim is in the review's **Grounding** table — including a first-hand read of
all four `shift_log` policies, the `truncate`/accessible-name question, and the ordering proof that
the write-path change cannot desync a shift from its earnings.

---

## 3. What was fixed in `plan.md` (read these before implementing)

| # | What | Where in `plan.md` |
| --- | --- | --- |
| **F1 CRITICAL** | The earnings-tile suppression rule hid the tile **forever** in any week containing a purchase (purchase rows are `earned: null` by design). Predicate now scoped to **shift rows** — `r.upgrade_purchased === null && r.earned == null`. Self-healing claim corrected; the suggested F1 test **inverted** (it previously would have locked the defect in) | D-1a block quote; **Handed to F1** rows 3/5, rule 1, suggested tests |
| **F2** | The **Handed to F1** recipe assumed F1 did not exist. F1 is `status: planned` with a full six-phase plan that edits every region the recipe names. Rows 2/5/6 corrected for the post-F1 file (with pre-F1 fallbacks), and the **four-tile layout decision** was made | D-7; **Handed to F1** header + rows + tile-grid note |
| **F3** | Landing order **F2 → F1 → F4** recorded, plus the `contract-surfaces.md` adjacency F2 is already editing | Critical Implementation Details (new table) |
| **F4** | Every absolute test count (`15/15`, `≥ 299`, `≥ 313`, `expected 20`) replaced with `U₀ + delta` / `E₀ + delta` against a floor **you measure on your own branch** | Current State Analysis; all four Success Criteria; Progress rows 1.3, 1.6, 2.2, 3.2, 3.4, 4.2, 4.3 |
| **F5** | "Anchor on symbols, not line numbers", with the numbers already known to have rotted since F2 landed | Critical Implementation Details |
| **F6** | Phase 4's e2e specs are a **hand-off to `/10x-e2e`**, not inline implement work | Phase 4 Overview |
| **F7** | The migration's CHECK is now **named** `shift_log_earned_nonneg`, matching the `child_profiles_*_nonneg` precedent | Phase 1 §1 |
| **F8** | `src/data/stages.ts`'s header must carry the art deviation + ART-A upgrade path + the two copy deviations, so they survive the plan's archival | Phase 2 §1 |

**Deferred, recorded only** (plan → `## Known risks`): the two `t.growth` strings that duplicate
existing Polish verbatim (`"Zobacz ulepszenia"` = `results.upgradesNudgeLink:363`, `"Wskazówka"` =
`task.hintTitle:246` — no same-page ambiguity); D-6 measuring "Panel rodzica" but not "Rozwój
świata"; `change.md`'s title still saying "with per-stage art"; and the note that the new CHECK is an
unreachable-but-real new way for `appendShiftLog` to lose a row.

---

## 4. The single thing most likely to be lost

**A purchase row's `earned` is `null` forever, and that must not be read as "unknown".**

`recordShiftResult` logs without `upgradePurchased`; `buyUpgrade` always logs with it
(`child-profiles.ts:187` vs `:257-262`), so the two row kinds never overlap. The tile's gate is
therefore *"a **shift** row with no recorded payout"* — only a pre-migration row can be one:

```ts
const hasUnknownEarnings = rows.some((r) => r.upgrade_purchased === null && r.earned == null);
```

Suppression is reserved for **unknown**, never for **zero**: an empty or purchases-only week renders
`0 zł`, exactly as `statTasks` already renders `0`. This heals by the first Monday after the
migration — not "within seven days", which was only true under a predicate that also never fires on
purchases.

The other three copy rules from D-1a still bind: F4 itself ships **no** earnings figure; the label is
`"Zarobione w tym tygodniu"` (never `suma`/`bilans`/`łącznie`/`razem`, never placed next to the
wallet); and **no test may assert `wallet_balance == sum(earned)`** — `appendShiftLog` swallows its
insert error, so that equality is flaky by construction.

---

## 5. Landing order and the working tree — read before you branch

**Cut `feat/world-progression-stages` from `feat/ui-polish`** — *not* from whatever branch happens to
be checked out. At the time of writing the tree is on **`feat/dashboard-recent-activity`** with
another agent's uncommitted work in it (`src/lib/services/reports.ts`,
`docs/reference/contract-surfaces.md`, `context/changes/dashboard-recent-activity/plan.md`, plus two
untracked test files). Do not branch from there, do not commit, do not stash it.

**F4 lands after F2 and F1.**

| | Feature | State | Why it matters to you |
| --- | --- | --- | --- |
| 1st | **F2** `dashboard-recent-activity` | landing now — pure core committed (`e40d650`), `listRecentActivity` + a `contract-surfaces.md` edit still uncommitted | Raises the unit-test floor; moved every line number in `pl.ts` / `i18n/index.ts` / `start.astro` by 10–20; edits the **same `## public.shift_log` section** F4 Phase 1 §3 edits, four lines away |
| 2nd | **F1** `parent-weekly-activity-chart` | `status: planned`, six-phase plan | Restructures `reports.ts` and the `WeeklyReport.tsx` tile grid — i.e. everything the **Handed to F1** recipe touches. F4's own phases touch none of those files |
| 3rd | **F4** this change | plan reviewed | — |
| — | **F5** `world-selection-screen` | `status: planned` | Independent regions: `/app/worlds`, `"worlds"` union token, `t.nav.items.worlds = "Światy"`, `ShopArt` `WORLD_SLOTS` only. See plan D-4/D-5/D-6 |

**Verified clean-merge regions for F4's phases** (append-only, different regions from F2):
`src/i18n/pl.ts` (new top-level `stages` + `growth` keys, plus `nav.items.growth`),
`src/i18n/index.ts` (`stageCopy` appended after `upgradeCopy` — now at **`:52`**, not the plan's old
`:29-35`), `tests/i18n-helpers.test.ts` (a new `describe`). **Re-read each file before editing; never
paste over it.**

---

## 6. Measure the floor before Phase 1

The plan no longer contains a single absolute test count. Run these on your branch and write the two
numbers into the plan's Current State Analysis:

```bash
npx vitest run --reporter=dot   # → U₀   (299 on 2026-08-22, before F2's tests)
npx playwright test             # → E₀   (15 on 2026-08-22: 13 specs + gameplay-restore's 2 in `touch`)
```

Then: Phase 1 ⇒ `U₀ + 2`, `E₀` unchanged · Phase 2 ⇒ `U₀ + ~14` · Phase 3 ⇒ `U₀ + ~14`, `E₀`
unchanged · Phase 4 ⇒ `E₀ + 5`. The rule is "may only go up", never "must equal".

---

## 7. The four phases, and where Phase 4 splits

| # | Delivers | Tool |
| --- | --- | --- |
| 1 | `shift_log.earned` migration (named check `shift_log_earned_nonneg`, no backfill) + the `appendShiftLog`/`recordShiftResult` fix + `contract-surfaces.md` + 2 tests | `/10x-implement` |
| 2 | `src/data/stages.ts` (+ the art-deviation header) + `t.stages` + `stageCopy` + the ladder tests | `/10x-implement` |
| 3 | `/app/growth` page + `StageRail.astro` + `t.growth` + the `active` union widening + the `ShopArt` doc comment | `/10x-implement`, then the manual browser check |
| 4a | Nav entry in `AppShell` `items` + `t.nav.items.growth` | `/10x-implement` |
| 4b | `e2e/growth.spec.ts` + the smoke redirect + `playwright.config.ts` widening | **`/10x-e2e world-progression-stages`** |

Phase 3 builds the screen; Phase 4 adds the link — a screen may exist without a link, never the
reverse. Phase 1 and Phase 3 each end in a manual confirmation pause (see their Implementation Notes).

**Phase 1 also appends a three-line pointer** to
`context/changes/parent-weekly-activity-chart/handoff.md` naming `shift_log.earned`, the plan's
**Handed to F1** section, and the shift-scoped suppress-on-null rule. A pointer, not a paste — F1 is
being edited concurrently.

---

## 8. Rules that still bind implementation

- All copy through `src/i18n/pl.ts` (L-003); `src/data/*` stays pure (no React/Astro/Supabase).
- `cn()` from `@/lib/utils`; business logic in `src/lib/services/`; zod for API input.
- One copy of each accessible name; navs toggled with `display`, never `opacity`; one responsive `h1`.
- New table or column ⇒ RLS reviewed in the same migration. **Verdict here: no policy change needed**
  — all four `shift_log` policies are `auth.uid() = account_id` with no column reference — but the
  migration header must say so and name them (L-001's spirit).
- `npm run lint` clean; never bypass the pre-commit hook; **do not push, do not open a PR.**
- Conventional Commits, one commit per completed phase, only on green.

**Next command: `/10x-implement world-progression-stages`.**
