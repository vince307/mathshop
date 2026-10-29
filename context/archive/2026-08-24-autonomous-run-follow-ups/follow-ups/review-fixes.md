# Review fixes — `autonomous-run-follow-ups`

Non-blocking items raised by `/10x-impl-review` on 2026-08-24. **None of these blocks the
merge** (`MERGE: CLEAR`); the branch is mergeable as it stands. Every item names a file and a
**symbol**, never a line number (L-006).

## FU-R1 — scope Risk E2E-3's total to its tile instead of counting `"9"` page-wide

- **File / symbol:** `e2e/parent-weekly-report.spec.ts` → the test
  `a seeded non-zero week renders live bars whose total matches the tasks tile (Risk E2E-3)`,
  specifically its `page.getByText("9", { exact: true })` expectation.
- **What is wrong:** the plan contracted "the `statTasks` tile shows the seeded total"; what
  shipped asserts that exactly one element **anywhere on `/app/report`** reads `"9"`, and never
  joins that element to the tile. The review re-ran the plan's own break (repointing
  `WeeklyReport`'s `tasksThisWeek` at `upgrades.length`) and the assertion **did** go red, so
  this is not a false green — it is weaker than contracted and brittle: any future copy that
  renders a bare `"9"` on that page breaks a test in a feature nobody touched.
- **Fix:** mirror the sibling unit assertion in `tests/weekly-report-tiles.test.tsx` — locate
  `t.report.statTasks`, read its immediately preceding element, and assert *that* element's
  text is the seeded total. Cheap; no new helper.
- **What would change the priority:** if a second numeric tile is ever added to `/app/report`,
  this stops being a latent flake and starts being an active one.

## FU-R2 — state the `{ exact: true }` exemption in `LIVE_E2E_STRINGS`' doc-comment

- **File / symbol:** `tests/nav-labels.test.ts` → the `LIVE_E2E_STRINGS` const and its
  doc-comment.
- **What is wrong:** the comment says the const holds "strings live e2e `getByText` locators
  assert on pages that render `AppShell`", and this change added such a locator
  (`t.growth.noNextUpgrade`, on `/app/growth`) without registering it. That is correct — the new
  locator passes `{ exact: true }`, while both registered strings use non-exact `getByText`,
  which is the substring hazard the registry actually guards — but the exemption is unwritten,
  so the registry now looks stale to the next reader.
- **Fix:** one clause: only **non-exact** locators need registering; `{ exact: true }` locators
  cannot be broken by a substring collision.

## Carried forward from the implement step (not raised by this review, still open)

- **`src/pages/api/profiles/world.ts` → the `"error" in result` branch** ships with no automated
  proof its `console.error` fires (plan **D3**, accepted deliberately). The review re-executed
  the phase's automated break and confirmed the *discriminant* is guarded by
  `tests/profiles-world.test.ts`; the log call itself is not.
- **`e2e/helpers/accounts.ts` → `seedShiftWeek`** indexes `keys[weekday]` unguarded; an input
  array longer than seven yields an opaque Postgres parse error rather than a helper-side
  message. Ergonomics only — it throws either way.
- **`docs/reference/contract-surfaces.md` → `## public.shift_log`'s *Consumed by* line** does
  not yet mention `seedShiftWeek`, the first test-side writer that sets `shift_log.created_at`
  explicitly (plan observation **O1**). Left alone this run because the file is contended;
  worth a one-line append after F2 integrates.
- **The four `#### Manual` Progress rows** (`1.7`, `1.8`, `2.5`, `6.6`) need a human with a
  screen reader and eyes on `/app/growth` and `/app/report`. See the handoff's §5 checklist.
