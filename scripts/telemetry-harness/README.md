# Telemetry harness

Generates `task_attempt` rows by driving the real app in a real browser, so the
adaptive engine can be observed instead of only reasoned about.

```bash
npx supabase start                        # local stack must be up
npx playwright test --config=scripts/telemetry-harness/harness.config.ts
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f scripts/telemetry-harness/report.sql
```

`HARNESS_SHIFTS=5` shortens a run (default 20 shifts × 6 personas).

## What this proves

**The pipe works end-to-end.** Before this harness the whole P1→P5 chain had unit
tests and had never once carried a row from a real browser session. A non-empty
§0 in `report.sql` means: the client assembled the attempts array, the server
validated it against `competencyForTaskType`, RLS accepted the insert, the row
persisted, and `child_profiles.difficulty_state` advanced between shifts. That is
evidence, and it is the part worth trusting.

**How the engine responds to a class of player.** The harness sweeps three
cohorts whose accuracy is a stated function of difficulty (`child-model.ts`), so
the recorded `difficulty` trajectories show what the adaptation rule does to a
strong, an on-target, and a struggling player. The finding is about the engine.

## What this does NOT prove

**Nothing about children.** `first_try` and `misses` come from `MISS_MODEL` in
`child-model.ts` — numbers chosen by hand, never measured on a child. Feeding
them in and reading them back out is a round trip, not a discovery. §4 of the
report ("p(first try | d)") will faithfully reproduce the input curve; with
synthetic data that is a pipe check, and only with real children is it a finding.

This is the exact trap the P2 shaping was parked to avoid — see
`context/foundation/shape-notes-p2-curriculum.md`. Rows from this harness must
never be used to justify a competency taxonomy, a threshold, or a gate migration.

**`duration_ms` is meaningless here.** It measures Playwright's click latency
(observed: 89–663 ms), not a child's hesitation. Ignore the `secs_mean` column in
§3 for synthetic rows. Time-on-task is one of the two signals P2 most needs, and
it is precisely the one this harness cannot fake.

**Level 1 only.** `solve.ts` handles `count_till` and `give_change`. Two-stage
`stock_and_change` appears at `startingLevel ≥ 3` (age ≥ 9) and would throw. The
ceiling behaviour of the level-3 band is therefore _not_ covered — extending the
solver is the first thing to do if that band matters.

## Why a script and not LLM agents

An agent role-playing a six-year-old would decide its own error rate, so the
assumption driving `first_try` would live implicitly in a model's weights and
could not be stated, swept, or challenged. Here it is one exported constant a
reviewer can disagree with, and the sweep reports the engine's response across a
range rather than at one unexamined point. It is also cheap enough to run 120
shifts instead of 5.

Exploratory agent play is still worth doing — for UX dead-ends and odd states,
which is a different question from telemetry.

## Rules this harness deliberately breaks

It is **not** an e2e test and must never be run as one. It lives outside `e2e/`
with its own config so `npm run test:e2e` cannot pick it up, because:

- **It never deletes its accounts.** `task_attempt.account_id` is
  `on delete cascade` from `auth.users`, so the teardown every e2e spec is
  required to perform would destroy exactly what this produces. Purge explicitly
  with the query at the bottom of `report.sql`.
- **It is deliberately random.** `e2e/CLAUDE.md` requires deterministic specs;
  the whole point here is a stochastic player. The RNG is seeded per persona
  (`rng()` in `child-model.ts`) so a re-run replays the same misses.
- **`retries: 0`, non-negotiable.** A retry would replay a persona's shifts into
  the same account and silently double-count its rows.

It follows the rest of the rules — i18n-sourced locators, role-based selectors,
state waits and never `waitForTimeout`.

## Keeping synthetic rows separable

`task_attempt` has no synthetic-marker column. Separation is by **profile name**:
every harness profile is `syn-<cohort>-a<age>`, and every query in `report.sql`
filters on `name like 'syn-%'`. If real kid-testing data ever lands in the same
database, that prefix is the only thing keeping the two apart — do not rename
personas without updating the report, and do not drop the filter to "see
everything".
