# Handoff — `world-progression-stages` (feature F4)

Rewritten by the **`/10x-impl-review`** step of the autonomous run
`context/runs/2026-08-22-autonomous-five/`.
**The feature is implemented, browser-covered, and now implementation-reviewed.**
You are the next agent and you have zero context: read this, then the standing brief
(`context/runs/2026-08-22-autonomous-five/agent-contract.md`).

**Verdict: NEEDS ATTENTION on paper — 0 critical, 3 warnings, 7 observations — but the branch is
MERGEABLE AS-IS. Nothing found blocks the merge.**

**Merge order for the stack: F2 `dashboard-recent-activity` → F1 `parent-weekly-activity-chart` →
F4 `world-progression-stages`.**

**Next command:** nothing is required before merge. If more is wanted here, the options are
`/10x-implement` over `follow-ups/review-fixes.md` items 1–3 (~15 lines total), or `/10x-archive
world-progression-stages` once the stack lands.

---

## 1. State

| Item | Value |
| --- | --- |
| Branch | **`feat/world-progression-stages`**, cut from `feat/parent-weekly-activity-chart` (F1) |
| Position in stack | **Third.** Both predecessors are already in its base — always diff against `feat/parent-weekly-activity-chart`, **never** against `main`, or you will attribute two other features' work to this one |
| Commits | **9** — `aabb8b7` → the review-artifacts commit added by this step (the previous handoff said 7/`f1b7b5a`; it was one stale, then this step added one more) |
| Pushed? | **No.** No PR. The maintainer reviews locally |
| `change.md` status | **`impl_reviewed`** |
| Phases | 1, 1b, 2, 3, 4a, 4b — all done. `grep -c '^- \[ \]' plan.md` → **0** |
| Working tree | Clean apart from two untracked folders that are not F4's (`context/changes/world-selection-screen/`, `context/runs/`) |

## 2. Artifacts written by this step

| File | What |
| --- | --- |
| `context/changes/world-progression-stages/reviews/impl-review.md` | The full report — verdicts, the re-run verification table, and F1…F10 with fixes and triage decisions |
| `context/changes/world-progression-stages/follow-ups/review-fixes.md` | The 7 deferred items, each with **file, symbol/anchor, and the required change**. Items 1–3 are the ones worth doing |
| `context/changes/world-progression-stages/change.md` | `status: implemented` → **`impl_reviewed`** |
| `context/changes/world-progression-stages/handoff.md` | This file |

**No source file was touched by the review.** The permitted direct-fix path was scoped to CRITICAL
findings and there are none; F1/F2 touch rendered UI and an accessibility contract, so they get their
own commit and their own verification run rather than being folded into a review commit.

## 3. Verification re-run in this step (measured, not accepted from the implementer)

Every implementer claim was reproduced. Sandbox **disabled** for anything touching
`127.0.0.1:54321` / Docker; Playwright ran against **this checkout's own** dev server on
`E2E_PORT=4331`, never the shared `:4321` that belongs to another agent's worktree.

| Command | Result |
| --- | --- |
| `npm test` | ✅ **382 passed / 45 files** |
| `npm run lint` | ✅ exit 0, clean |
| `npm run check` | ✅ **0 errors / 0 warnings / 9 pre-existing hints** (178 files) |
| `E2E_PORT=4331 npx playwright test` | ✅ **22 passed** (desktop + touch) |

**The migration was verified against the live database**, not just read: `earned integer`, nullable,
no default; `shift_log_earned_nonneg CHECK ((earned IS NULL) OR (earned >= 0))` present and **named**;
the **four** `shift_log` policies unchanged and all `(auth.uid() = account_id)` with no column list —
no new policy added and none needed; the 3 pre-existing rows read **`null`, not `0`**.

**The contracted deliberate break was re-executed.** Swapping the scoped suppression predicate for the
naive `rows.some(r => r.earned == null)` turns **exactly two** tests red — the purchases-only case and
the purchase-alongside-shift case in `tests/reports.test.ts` — then restored clean. The purchases-only
test asserts `earningsKnown: true, earned: 0`, and **no test anywhere asserts `wallet == sum(earned)`**.

## 4. What the review confirmed sound (do not re-litigate)

- **The write path.** The `child_profiles` UPDATE commits and is error-gated **before**
  `appendShiftLog` runs, so a logging failure cannot cost a child their money. `appendShiftLog` still
  swallows its insert error — nothing was newly propagated into shift completion.
- **The suppression predicate** is the scoped form `row.upgrade_purchased === null && row.earned == null`.
- **Copy truthfulness.** `"Zarobione w tym tygodniu"`; no `suma`/`bilans`/`łącznie`/`razem`; never
  placed beside or reconciled against the wallet; the lower-bound property is documented in the
  migration header, the column `COMMENT`, `src/types.ts` and the rewritten `pl.ts` comment.
- **D-10.** The grid is the agreed `cn("mt-5 grid gap-3", earningsKnown ? "grid-cols-2 lg:grid-cols-4"
  : "grid-cols-2 sm:grid-cols-3")`, tile fourth, suppressed-not-zeroed, and the `pl.ts` comment is now
  factually accurate (F1's version claimed `shift_log` has no earnings column — this migration made
  that false).
- **Saturation.** `businessLevelForShifts` untouched and uncapped; `stageForLevel` total and
  saturating (traced: `999`/`Infinity` → last stage; `0`/`-5`/`NaN`/`1.5` → first, never throws);
  `leveledUp` still fires past the terminal stage; the monotonicity test runs the **real** formula
  over `n = 0..60` and asserts reachability of every stage.
- **ART-C.** Zero files in `public/illustrations/`, zero slice-map rows; the deviation note lives in
  `src/data/stages.ts`'s module header so it survives archiving.
- **D-12.** Judged sound. The bottom bar really is `position: fixed`, so the document measurement
  genuinely cannot see its overflow; the added measurement is on a **role-located** element and does
  not breach `e2e/CLAUDE.md`'s locator rule. **Keep the document assertion** — it covers a different,
  separately-established risk for one line.
- **Scope vs. F5.** No `/app/worlds`, no `worlds` key, no `t.nav.items.worlds`, no `WORLD_SLOTS` edit.
  `ShopArt.tsx`'s diff is **comment-only**. `AppShell.astro` changed in exactly three places (lucide
  import, `active` union, one `items` entry).
- **`docs/reference/contract-surfaces.md`** extends F2's `## public.shift_log` section — two lines,
  **Defined in** and **Columns** — leaving F2's **Consumed by** and **Isolation test** bullets intact.

## 5. Findings, and where they are recorded

Full text with fixes: `reviews/impl-review.md`. Actionable items: `follow-ups/review-fixes.md`.

**Warnings (none blocking):**

1. **F1 — `src/pages/app/growth.astro`**: the `<h2>{t.start.nextUpgradeHeading}</h2>` sits **outside**
   the `{next && (…)}` guard, so once every level-eligible upgrade is owned the child sees "Następne
   ulepszenie" over an empty box. `start.astro` guards the whole card. Follow-up #1.
2. **F2 — `src/components/child/StageRail.astro`**: `aria-label` on three bare `<span>`s
   (`role="generic"`) is ignored by AT, so the stage ordinal is **never announced** — the file's own
   comment and Progress 3.5 claim otherwise. Fix: `role="img"`, matching `ShiftResults.tsx` and
   `SkillCards.astro`. Follow-up #2.
3. **F3 — deploy ordering**: `appendShiftLog` now names `earned` and still swallows its error, so
   deploying the app before the migration silently stops **all** `shift_log` writes with zero signal.
   Docs-only fix (a `-- DEPLOY ORDER:` line). Follow-up #3. Adding logging is explicitly out of scope.

**Observations:** the `<lg` connector is hidden (contracted "visible in both", decided in a code
comment); `earned` sums the query window rather than the seven-day frame (harmless, practice
semantics); the migration takes two locks where the precedent takes one (**do not rewrite an applied
migration**); the savings bar + `nextText` render twice at `lg` and the bar lacks `aria-hidden` (both
mirror `start.astro`); `world.name` appears three times in the a11y tree; `E2E_PORT` placement;
the previous handoff's commit count was stale (fixed here).

**`E2E_PORT` verdict.** The change is **correct and default-preserving** (`process.env.E2E_PORT ?? "4321"`
in both `playwright.config.ts` and `e2e/global-setup.ts`, plus `npm run dev -- --port ${PORT}`), CI is
unaffected, and it was load-bearing for this review's own numbers. It is infrastructure rather than
feature work, but **keeping it in this branch is the accepted call** — splitting five already-committed,
already-proven lines out of a three-deep stack costs more than it buys. Worth a separate improvement
later: `reuseExistingServer: false` whenever `E2E_PORT` is set, so a stale server on the chosen port
cannot defeat the variable's purpose.

## 6. Traps that cost previous steps real time — do not rediscover

- **The sandbox blocks `127.0.0.1:54321` and the Docker socket.** Run `npm test`, `npx playwright
  test` and every `supabase` / `psql` command with the sandbox **disabled**, or ~30 tests fail for
  reasons unrelated to your change and `supabase status` lies. Local Postgres is on **54322**
  (`psql -h 127.0.0.1 -p 54322 -U postgres -d postgres`, password `postgres`).
- **A dev server on `:4321` may belong to another agent's worktree**, and `reuseExistingServer` will
  silently point your suite at *that tree*. Always `E2E_PORT=<free port>`; this step used **4331**.
- **The test floor is a moving target.** `U₀ = 346` / `E₀ = 17` on this branch before F4's code; the
  run brief's "299 / 15" is the pre-F2 floor and is stale. Measure it yourself.
- **`getByText` matches substrings, case-insensitively.** `t.nav.items.growth` ("Rozwój świata") and
  `t.growth.title` ("Rozwój sklepu") share a prefix **by design** — never locate either by a fragment;
  the specs use `exact: true` throughout.
- **The six-tab question is closed.** 6 tabs at 712 px hold in one row, 116 px each, zero truncation,
  no overflow (Phase 4.6, verified live). **F5 needs no accommodation and must not re-litigate it.**
- **F5: extend the alternation, do not replace it.** `playwright.config.ts` now reads
  `testMatch: /(gameplay-restore|growth)\.spec\.ts/` — add `|worlds`.
- Lint treats warnings as failures. `class={helper(...)}` in an `.astro` file trips
  `astro/prefer-class-list-directive` — use `class:list={[...]}`. `ShopArt` is a **named** export.

## 7. Rules that still bind

- All copy through `src/i18n/pl.ts` (L-003); `src/data/*` stays pure; e2e locator strings resolve
  through `e2e/helpers/i18n.ts`.
- One copy of each accessible name; navs toggled with `display`, never `opacity`; one responsive `h1`.
- New column ⇒ RLS reviewed **in the same migration** — the verdict here is "no change needed",
  recorded with evidence in the migration header and independently re-verified against the live DB.
- `npm run lint` clean; never `--no-verify`; **do not push, do not open a PR.**
