# Handoff — `dashboard-recent-activity` (F2)

Standing brief for this whole run: `context/runs/2026-08-22-autonomous-five/agent-contract.md`.
**Read it first** — it binds every step (no human in the loop, always leave a handoff, report
back in ≤ 12 lines, and the project rules this run keeps tripping over).

## State

**IMPLEMENTED AND REVIEWED.** All four phases shipped; every `## Progress` row is `[x]` with a
commit SHA. `change.md` is now `status: impl_reviewed`.

**Verdict: APPROVED — the branch is mergeable as-is. No follow-up commit is required.**
0 critical findings, 1 warning (a stale line in the plan's own Progress table — doc only),
6 observations. Full report: `reviews/impl-review.md`. Non-blocking tidies:
`follow-ups/review-fixes.md`.

Branch **`feat/dashboard-recent-activity`**, cut from `feat/ui-polish`, 5 commits. **Not pushed,
no PR** (per the contract — the maintainer reviews locally).

| Phase | Commit | What landed |
|---|---|---|
| 1 — Pure core + Polish copy | **`e40d650`** | `src/data/activity.ts`, `tasksDone()`, 8 dictionary keys, 11 unit tests |
| 2 — Profile-scoped query | **`909e4b9`** | `listRecentActivity` + `RecentActivityRow`, unit suite, isolation suite, contract-surfaces |
| 3 — The section | **`21e07cc`** | `RecentActivity.astro`, `start.astro` wiring, D10/D11 |
| 4 — E2E coverage | **`c83bb9a`** | assertions in `seed.spec.ts` + `gameplay-restore.spec.ts` |
| epilogue | **`7a5d093`** | Phase-4 SHA write-back, `change.md` status flip |

## ⚠️ Read this before you touch the working tree

A concurrent agent switched the shared tree to **`feat/parent-security-screen`** during the
review, which deleted this change folder from disk. The review artifacts were therefore written
back as **untracked files** at their canonical paths:

```
context/changes/dashboard-recent-activity/change.md            (updated → impl_reviewed)
context/changes/dashboard-recent-activity/handoff.md           (this file)
context/changes/dashboard-recent-activity/reviews/impl-review.md   (new)
context/changes/dashboard-recent-activity/follow-ups/review-fixes.md (new)
```

`change.md` and `handoff.md` are **tracked** on `feat/dashboard-recent-activity`, so a plain
`git checkout feat/dashboard-recent-activity` will refuse ("untracked working tree files would
be overwritten"). Recovery — the untracked copies are the ones you want to keep:

```bash
mv context/changes/dashboard-recent-activity /tmp/dra-review
git checkout feat/dashboard-recent-activity
cp -R /tmp/dra-review/. context/changes/dashboard-recent-activity/
git add context/changes/dashboard-recent-activity && git commit -m "docs(change): implementation review"
```

`plan.md`, `research.md`, `plan-brief.md` and `reviews/plan-review.md` were **not** rewritten —
they come back intact from the branch.

## What the review confirmed (the six things it was asked to check)

1. **The `profile_id` filter.** `git grep 'from("shift_log")'` finds exactly three sites: the
   insert, the pre-existing `getWeeklyReport` (already filtered), and the new
   `listRecentActivity` — which carries `.eq("profile_id", profileId)`. **One query path, filter
   present.** The isolation suite goes red **four ways** if it is dropped (case 1 returns 2 rows
   instead of 1 and fails the row-id identity assertion; case 4 returns account B's own row
   instead of `[]`), and the unit suite independently asserts the `eq` arguments.
2. **Plan adherence + D10.** Every phase matches its contract. `RecentActivity.astro:60` is
   `grid gap-3 sm:grid-cols-3`, i.e. D10 as decided. **Progress row 4.4's "stacked feed" wording
   is a stale doc line, not a behaviour mismatch** — `sm` is 640px, so 712px is 3-across by
   design; the row's real assertion (one copy of the heading) is unaffected. Recorded as F1.
3. **Truthfulness.** No `zł` and no derived money anywhere — `grep -niE "zł|cost|earn"` over the
   component and the data module hits only prose explaining why there is none. `N zadań` is
   `math.completed + money.completed` off that row's own stored jsonb, and shift tasks map only
   to those two competencies, so the number is a stored aggregate, never a re-derivation.
4. **A11y / locators.** No new `h1`; the heading is unique; `Dzisiaj` is rendered but never
   asserted (both specs say so inline); the empty line contains no `Ukończone zmiany`; the
   blacklist audit is clean in both directions; no `data-testid`. The three render states use
   pure booleans, so the `{0 && …}` literal-zero leak cannot occur.
5. **Error containment.** `start.astro:53-62` wraps the query **and** the mapping in one
   try/catch that sets `null` without rethrowing — a thrown service error degrades to the
   section's honest error line while the rest of the dashboard renders. Same shape as
   `report.astro:35-42`.
6. **Patterns + scope.** `cn()` arrives through `childCard()` (no `.astro` file in this repo
   calls `cn()` directly — `class:list` is the idiom); all copy via `pl.ts`; service logic in
   `src/lib/services/`; SSR frontmatter, zero client JS. `reports.ts` is **45 insertions, 0
   deletions** at EOF. `src/types.ts` and `tests/reports.test.ts` are absent from the diff.
   Nothing from another feature was touched.

## What the review could NOT do

`npm test` / `npx playwright test` / `npm run check` were **not re-run** — the tree was on
another feature's branch and running them there would have mis-attributed the result. Static
criteria were verified from git objects; the implementer's counts re-derive exactly (318 = 299
+ the 19 new `it()` blocks in the diff; Playwright stays 15 because the diff adds **no**
`test()` block; `astro check` 168 files = 163 + 5 new files). The three deliberate-break results
were traced by reading rather than reproduced. **Before merge, run the four commands on a tree
checked out at this branch** (see `follow-ups/review-fixes.md` §3).

## Risks carried forward

- **R1 (live).** `docs/reference/contract-surfaces.md` `## public.shift_log` — the Consumed-by
  and Isolation-test lines are rewritten in place and the parallel weekly-chart feature edits the
  same block. On conflict **keep both symbol sets, never `--ours`/`--theirs`**; nothing validates
  that file, so a bad resolution fails silently. `reports.ts` is append-only and rebases cleanly,
  but re-read `getWeeklyReport` afterwards.
- **R2 (unchanged).** Do not collapse `RecentActivityRow` onto `ShiftLogRow` — the feed needs `id`.
- **R3 — CLOSED** by D10, and the code was verified to match it.
- **R4 (by design).** `appendShiftLog` is best-effort and un-transactional, so the feed can
  legitimately miss an event. Never read it as a wallet or shift-count reconciliation.

## Demo-data caveat — judged harmless

`ui-polish-demo@example.test` profile "Ania" holds three rows from D11's manual pass (a purchase
today, a shift back-dated to yesterday, a shift back-dated to 19.08), `completed_shift_count` 8,
wallet 144 zł, one owned upgrade. **`git grep -rn "ui-polish-demo"` over the whole branch hits
only three `context/` documents — no spec, no helper, no source** — and every e2e spec provisions
and tears down its own account, so nothing automated depends on it. The only downstream effect is
on manual passes: the weekly-chart feature will see three rows over three distinct days for Ania
(useful, if anything), and will find two shift rows that do **not** reconcile with
`completed_shift_count` 8 — that is R4's documented best-effort behaviour, not a bug to chase.

## Next command

**None for this feature — it is done.** No `/10x-e2e` run is warranted: the plan named no
browser-level risk that is still open. Its only browser risk was R3 (the column breakpoint),
which D10 closed at implementation time, and Phase 4 already landed the browser coverage the plan
asked for — the empty state in `e2e/seed.spec.ts` and the populated feed in
`e2e/gameplay-restore.spec.ts`, which runs in both the desktop and the 712px `touch` project.
Adding a spec now would duplicate existing coverage.

Remaining work is bookkeeping only, all of it optional and none of it blocking:

1. Commit the untracked review artifacts onto the branch (recovery block above).
2. Apply the one doc fix in `follow-ups/review-fixes.md` §1 (stale Progress row 4.4).
3. Re-run the four verification commands on this branch before merge.
4. Then `/10x-archive dashboard-recent-activity` whenever the maintainer has merged.
