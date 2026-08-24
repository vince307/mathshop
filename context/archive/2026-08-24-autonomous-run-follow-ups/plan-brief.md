# Closing the ten triaged follow-ups — Plan Brief

> Full plan: `context/changes/autonomous-run-follow-ups/plan.md`
> Research: `context/changes/autonomous-run-follow-ups/research.md`
> Identity + the ten-item verification table: `context/changes/autonomous-run-follow-ups/change.md`

## What & Why

Pay off the 2026-08-22 autonomous run's verification debt: ten already-triaged, already-
re-verified follow-up items drawn from four archived changes' `follow-ups/review-fixes.md`
files. Two are real user-facing defects, five are tests that do not bite what their own file
header claims to protect, one is a silent server-side failure branch, one is a missing e2e
seeder, and one is a durable-doc omission.

## Starting Point

`matmaverse-v2` @ `282d264`, clean. All ten claims hold on disk (re-opened during planning,
not inherited). `/app/growth` renders "Następne ulepszenie" over an empty card whenever a
child owns every level-eligible upgrade — reachable after 90 zł of ordinary play, not an edge
case. `StageRail`'s three ordinal `aria-label`s hang on `role=generic` and are never
announced. `tests/worlds-picker.test.tsx`, `tests/shop-art-slots.test.ts` and
`tests/weekly-report-tiles.test.tsx` each stay green under the exact regression they exist to
catch. `POST /api/profiles/world` collapses a DB outage into a routine redirect. `e2e/helpers/`
has no `shift_log` seeder. `docs/reference/contract-surfaces.md` does not record K1.

## Desired End State

A child who owns everything available reads an honest sentence and still reaches the shop; a
screen reader announces "Etap 1".."Etap 4"; each hardened test goes red under a break that is
both plausible and specific to its claim; a DB failure in the world route leaves a trace while
the redirect stays byte-identical; e2e can seed a real week and prove a non-zero report;
and the PIN throttle's non-decaying counter is written down where the next reader will find it.

## Key Decisions Made

| Decision | Choice | Why | Source |
|---|---|---|---|
| Item 1's shape | Keep `<h2>`, add empty-state `<p>`, keep the CTA | The same file's `noUnlocks` section is the precedent; `start.astro`'s shape would delete `/app/growth`'s only shop entrance | Plan (D1) |
| Item 7 / FU-3 | No `src/data/nav.ts` extraction; document the split + buy `href` coverage | `e2e/growth.spec.ts` Risk E2E-F4-2 is **already** Fix B in both projects — Fix A buys a duplicate for a restructure of the most-shared component | Research → Plan (D6) |
| Item 6's file shape | Rename to `.tsx` + jsdom pragma | One contract, one file; matches `weekly-report-tiles.test.tsx` | Plan (D2) |
| Item 8's test delta | **Zero new tests**, stated openly | The DB-error branch is unreachable without mocking `@/lib/supabase`, which would fork a deliberately real-Supabase suite | Plan (D3) |
| Item 2's guard | Playwright `getByRole("img", …)` folded into an existing test | A type-checker cannot see an a11y tree, so `npm run check` would certify nothing (L-004) | Plan (D4) |
| Item 1's guard | One new e2e test (seed `sign`+`shelf` at level 1) | The empty state is reachable from `seedChildProfile` alone, so the one genuine user-facing bug need not ship review-only | Plan (D5) |
| `e2e/helpers/accounts.ts` | Append `seedShiftWeek`, restructure nothing | Contended with the concurrent F2; `ownership.md` does not exist yet and is binding if it appears | Research → Plan (D7) |
| Adjacent items | Fold in 2 of 3 one-liners; refuse the `world.name` dedup | The refused one needs a product call and moves text e2e locates | Plan (D8) |
| Commit granularity | One commit per phase, each scoped to one source feature | `git log --grep <feature>` still recovers the audit trail AD-1 wanted, without a fat four-concern commit | Plan (D9) |

## Scope

**In scope:** all ten H1 items; two one-line adjacent fixes (`growth.astro`'s savings-bar
`aria-hidden`, `WeeklyActivityChart`'s dead React import); the `href` coverage increase for
item 7; browser guards for both `.astro` fixes.

**Out of scope:** extracting `src/data/nav.ts`; deduplicating `world.name` in `growth.astro`'s
a11y tree; inventing a logger module; any Supabase migration; the remaining ~18 non-blocking
items in the archived review files.

## Architecture / Approach

No new modules and no new abstractions. Seven phases, each a single commit on green, ordered
so the two user-visible defects land first, cheap test-hardening in the middle, the
timezone-sensitive e2e seeder second-to-last, and the pure doc edit last. Every behavioural
change ships its guard in the same phase, and every phase names a deliberate break **plus why
that break's redness is evidence for that phase's specific claim** (L-004).

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 0. Branch baseline | `feat/autonomous-run-follow-ups` + measured baseline | Copying 429/23 forward instead of measuring (L-005) |
| 1. `/app/growth` | Honest empty state, announced stage ordinals, `aria-hidden` bar | The empty-state layout is an extrapolation — the mockup depicts no empty state, and `assets/` is gitignored |
| 2. `WorldPicker` | Form target bound in tests; competency list named | `getByRole("list", { name })` must not disturb the existing `aria-pressed` button count |
| 3. `ShopArt` | Render case proving the per-world slot lookup | `unplaced` is always empty — an assertion on the partition certifies nothing |
| 4. Nav | Two-layer split documented; per-entry `href` asserted | Hardcoding the href map in the spec is deliberate, not an oversight |
| 5. `profiles/world` | DB-error branch logged; KR-1 preserved | The redirect must stay byte-identical or the route becomes an existence oracle |
| 6. Weekly report | Render-level decomposition test; `seedShiftWeek` + first consumer | Europe/Warsaw week arithmetic — UTC day math drifts bars across midnight and DST |
| 7. Contract surfaces | K1 recorded | Nothing reads this file, so a bad merge resolution fails silently forever |

**Prerequisites:** local Supabase up (`npx supabase status`, API on `127.0.0.1:54321`) with the
command sandbox disabled for suite runs; a worktree from
`.claude/skills/10x-autonomous-run/scripts/worktree-bootstrap.sh` with its assigned `E2E_PORT`;
the main checkout never changes branch.
**Estimated effort:** ~1–2 sessions across 7 small phases; Phase 6 is roughly half the work.

## Open Risks & Assumptions

- **`ownership.md` does not exist yet.** If the contention sweep writes it, it is binding and
  overrides D7 on `e2e/helpers/accounts.ts`.
- **The `/app/growth` mockup cannot be re-checked off this machine** (`assets/` is gitignored),
  so Phase 1's `next === null` layout is an explicit extrapolation.
- **Phase 6's seeder break is date-dependent** — the UTC-arithmetic hazard may not be
  demonstrable on the day the run happens. The plan requires recording that honestly rather
  than claiming a green.
- **Item 8 ships with no automated proof that its log line fires.** That is stated in the
  phase's criteria, not hidden behind a suite total.

## Success Criteria (Summary)

- `npm run lint`, `npm test`, `npm run check` and the full Playwright suite green on the
  feature branch, with every delta expressed as `branch baseline + N` and the baseline measured
  in Phase 0 (never 429/23 copied forward).
- Every deliberate break observed red and restored, each paired with why its redness is
  evidence for that specific claim.
- Seven commits, each scoped to the archived review that raised its items, none pushed.
