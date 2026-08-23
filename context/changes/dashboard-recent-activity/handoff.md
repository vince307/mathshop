# Handoff — `dashboard-recent-activity` (F2)

Standing brief for this whole run: `context/runs/2026-08-22-autonomous-five/agent-contract.md`.
**Read it first** — it binds every step (no human in the loop, always leave a handoff, report
back in ≤ 12 lines, and the project rules this run keeps tripping over).

## State

**IMPLEMENTED. All four phases shipped; every `## Progress` row is `[x]` with a commit SHA.**
`change.md` is `status: implemented`. Nothing is left pending.

Branch **`feat/dashboard-recent-activity`**, cut from `feat/ui-polish`. **Not pushed, no PR**
(per the contract — the maintainer reviews locally).

| Phase | Commit | What landed |
|---|---|---|
| 1 — Pure core + Polish copy | **`e40d650`** | `src/data/activity.ts`, `tasksDone()`, 8 dictionary keys, 11 unit tests |
| 2 — Profile-scoped query | **`909e4b9`** | `listRecentActivity` + `RecentActivityRow`, unit suite, isolation suite, contract-surfaces |
| 3 — The section | **`21e07cc`** | `RecentActivity.astro`, `start.astro` wiring, D10/D11 |
| 4 — E2E coverage | **`c83bb9a`** | assertions in `seed.spec.ts` + `gameplay-restore.spec.ts` |

An epilogue commit lands the Phase-4 SHA write-back and the `change.md` status flip.

## Files changed

**New:** `src/data/activity.ts`, `src/components/child/RecentActivity.astro`,
`tests/activity.test.ts`, `tests/recent-activity.test.ts`,
`tests/recent-activity-isolation.test.ts`.
**Edited:** `src/i18n/index.ts`, `src/i18n/pl.ts`, `src/lib/services/reports.ts` (append-only),
`src/pages/app/start.astro`, `docs/reference/contract-surfaces.md`, `e2e/seed.spec.ts`,
`e2e/gameplay-restore.spec.ts`, `tests/i18n-helpers.test.ts`.
**No migration, no RLS change, no new index, no API route, no React island, no new dependency,
no new artwork.**

## Verification actually observed (not assumed)

```
npm run lint          clean (eslint, no output)
npm test              318 passed (318) / 42 files   ← baseline 299, +19 new
npm run check         Result (168 files): 0 errors, 0 warnings, 8 hints
npx playwright test   15 passed (15)  — run TWICE consecutively, green both times
```

`npx playwright test` count is **unchanged at 15** by design — Phase 4 adds assertions inside
two existing tests, not new test cases.

**Environment note that cost time and will cost the next agent time too:** the integration
suites and e2e need `127.0.0.1:54321`, which the command sandbox blocks — every `npm test` /
`playwright` / `supabase status` invocation must run with the sandbox disabled or 30 tests fail
with `AuthRetryableFetchError: fetch failed`. Separately, a **stray dev server holding port
4321/4322 makes 4 `gameplay-restore` runs fail**; they pass in isolation and pass in the full
suite once the ports are freed (`lsof -ti:4321,4322 | xargs kill -9`). Neither is a defect in
this change — both were reproduced and cleared.

### The isolation test is real — verified by deliberate breakage, twice

```
remove .eq("profile_id", …)     → 4 failed (4)   ← ALL cases red, incl. cross-account
restore                         → 8 passed (8)
replace `throw error` → `return []` → 1 failed   ← the error-contract case
restore                         → 8 passed (8)
```

The naive DST implementation was broken on purpose too: swapping the calendar-key step for
`now − 86_400_000` turns the October fall-back case red (`expected 'older' to be 'yesterday'`).
None of these three tests can pass a broken implementation.

## Manual verification — performed by the agent, in a real browser (D11)

Signed in as `ui-polish-demo@example.test`, drove a **real 6-task shift** through the actual
tap loop plus a real `Szyld` purchase (reusing the `solveShift` e2e helper from a throwaway
spec, deleted immediately), then read `/app/start` at 390 / 712 / 1280px.

- **Empty state** — a profile with zero rows shows the heading + the empty line. ✓
- **Populated, correct order** — `Ulepszenie: Szyld` (today) sits **above**
  `Zmiana ukończona · 6 zadań`, both `Dzisiaj`. The `6` is the count the shift actually ran. ✓
- **Day labels** — back-dating rows with the service-role client (so the DB genuinely holds the
  timestamps) produced `Wczoraj` and `19.08`. Singular form renders `1 zadanie`. ✓
- **390px** — one card per row, no horizontal overflow; the longest catalogue name,
  `Ulepszenie: Miejsce na produkt`, fits on one line. ✓
- **712px / 1280px** — three across, exactly **one** copy of the heading in the a11y tree. ✓
- **Console** — only the React DevTools info line. No hydration warning. ✓
- **Unplanned bonus finding** — an `upgrade_purchased` id absent from the catalogue renders as
  the raw id via `upgradeCopy`'s guarded fallback rather than throwing mid-render.
- **No `zł` anywhere in the feed**, at any viewport, on either row kind.

## Decisions taken during implementation

Both are written into `plan.md` under `## Autonomous decisions`.

- **D10 — R3 resolved: `sm:grid-cols-3`, not `lg:grid-cols-3`.** The plan deferred this class
  deliberately ("do not decide it before you can see it"). Seen at 712px, `lg:` made the feed
  the only 1-across row on the page, between a 3-across `SkillCards` and 4-across results
  tiles — full-width cards carrying a ~200px label, the heaviest block for the least
  information. `sm:` puts it on the page's own breakpoint. Re-verified after the change at all
  three widths; 390px is untouched (`sm` is 640px). **Progress row 4.4 says "stacked feed" at
  712px — after D10 the feed is 3-across there instead. The row's real content (one copy of the
  heading, correct render) holds; the stacking now happens below 640px.**
- **D11 — manual verification was executed, not asked.** Hard rule 1 puts no human in the loop,
  so `/10x-implement`'s manual-confirmation gate, its dirty-path prompt, its commit-message
  prompt and its next-phase prompt were all decided autonomously.

## Risks carried forward

- **R1 (unchanged, still live).** F1 (`context/changes/parent-weekly-activity-chart/`) has
  **not landed** and still had no `plan.md` when this shipped. F2's `reports.ts` diff is
  **45 insertions, 0 deletions** at the tail, so it rebases cleanly under F1's edits above it —
  but if git conflicts at EOF, **keep both symbol sets, never resolve ours/theirs**. Same for
  `docs/reference/contract-surfaces.md` `## public.shift_log`: the Consumed-by line must end up
  naming both consumers.
- **R2 (unchanged).** Do not collapse `RecentActivityRow` onto `ShiftLogRow` once F1 adds
  `created_at` — the feed also needs `id`.
- **R3 — CLOSED** by D10.
- **R4 (unchanged, by design).** `appendShiftLog` is best-effort and un-transactional, so the
  feed can legitimately miss an event. It is documented as such on `listRecentActivity` and in
  `RecentActivity.astro`, and must never be read as a wallet or shift-count reconciliation.

## Demo-data caveat

The `ui-polish-demo@example.test` profile "Ania" was mutated during manual verification: it now
holds three `shift_log` rows (one purchase dated today with `upgrade_purchased: "slot"`, one
shift back-dated to yesterday, one shift back-dated to 19.08), `completed_shift_count` 8,
wallet 144 zł, one owned upgrade. Harmless, but do not read it as pristine seed data. E2E specs
provision their own accounts and are unaffected.

## Next command

```
/10x-impl-review dashboard-recent-activity
```

Review the whole plan (no phase number). The highest-value things to re-check: that the
`reports.ts` addition really is append-only, that the isolation suite still goes red when the
`profile_id` filter is dropped, and that D10's breakpoint change is the right call against the
web mockup.
