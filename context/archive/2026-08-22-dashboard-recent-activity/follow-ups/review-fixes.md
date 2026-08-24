# Follow-ups from the implementation review — `dashboard-recent-activity`

Source: `context/changes/dashboard-recent-activity/reviews/impl-review.md` (2026-08-23).
Standing brief: `context/runs/2026-08-22-autonomous-five/agent-contract.md`.

## Blocking (must land before merge)

**None.** The review found **0 CRITICAL findings**. The `profile_id` filter is present on the
only query path and is guarded by a suite that goes red four ways without it; no invented data
reaches the feed; the dashboard cannot 500 on a feed failure; no locator or accessible-name
collision was introduced; nothing outside the plan's file list was touched. **The branch is
mergeable as it stands** — this file exists for the one doc-level tidy below, which no reviewer
should treat as a gate.

## Non-blocking

### 1. Progress row 4.4 still describes the pre-D10 layout (F1 — doc only)

- **File**: `context/changes/dashboard-recent-activity/plan.md`
- **Symbol / anchor**: the `### Phase 4: E2E coverage` → `#### Manual` block (row 4.4, ~line 1032)
- **Why**: row 4.4 is `[x]` and reads "shows the **stacked feed**" at 712px. D10 moved the grid
  to `sm:grid-cols-3` (`src/components/child/RecentActivity.astro:60`), and Tailwind's `sm` is
  640px, so at 712px the feed is **3-across**. The shipped code is correct — D10 is the later,
  explicitly reasoned decision, verified at 390 / 712 / 1280px — and the row's load-bearing
  assertion (one copy of the heading in the accessibility tree) is unaffected by the column
  count. Only the sentence is stale.
- **Change required**: do **not** rewrite the row's title — the Progress convention at the top
  of that section says "Do not rename step titles". Instead insert one line immediately after
  the last row of the Phase 4 `#### Manual` block:

  ```markdown
  > Note (D10): the feed is 3-across at 712px since the grid moved to `sm:grid-cols-3`; the
  > stacking this row describes now happens below 640px. The row's assertion — one copy of the
  > heading in the a11y tree — is unaffected by the column count.
  ```

- **Not applied by the review step because**: a concurrent agent held the shared working tree on
  `feat/parent-security-screen`, and this step was forbidden to commit or switch branches. An
  uncommitted edit to a branch-tracked plan file would have been lost or would have blocked the
  next checkout.
- **Verification**: none needed — no code, no test, no build touched.

### 2. Merge-time rule for the two contended files (F6 — not a fix, a resolution rule)

- **Files**: `docs/reference/contract-surfaces.md` (`## public.shift_log`, the **Consumed by**
  and **Isolation test** lines) and `src/lib/services/reports.ts` (EOF).
- **Rule**: on conflict, **keep both symbol sets — never accept `--ours` / `--theirs`.** The
  Consumed-by line must end up naming `getWeeklyReport` / `aggregateWeeklyReport`,
  `listRecentActivity`, *and* whatever the parallel weekly-chart feature adds; the Isolation-test
  line must retain all three suites. After rebasing `reports.ts`, re-read `getWeeklyReport` to
  confirm nothing above the append point was reverted. Nothing validates `contract-surfaces.md`
  (0 references in `tests/`, `e2e/`, `src/`, CI), so a bad resolution fails silently.
- **Also**: do not collapse `RecentActivityRow` onto `ShiftLogRow` when the chart feature adds
  `created_at` to the latter (R2) — the feed additionally needs `id`.

### 3. Re-run the suites on this branch before merge (F2)

The review could not execute them: the shared tree was on another feature's branch, and running
them there would have reported a different feature's result as this one's. Every *static*
criterion was verified from git objects instead, and the implementer's counts re-derive exactly
(318 = 299 + the 19 new `it()` blocks in the diff; Playwright stays 15 because the diff adds no
`test()` block; `astro check` 168 files = 163 + 5 new files). On a tree checked out at
`feat/dashboard-recent-activity`, with the local Supabase stack up and ports 4321/4322 free:

```bash
npm run lint && npm test && npm run check && npx playwright test
```
