# Handoff — `world-progression-stages` (feature F4)

Rewritten by the `/10x-implement` step of the autonomous run
`context/runs/2026-08-22-autonomous-five/`. **The feature is implemented.** You are the next agent and
you have zero context: read this, then the standing brief
(`context/runs/2026-08-22-autonomous-five/agent-contract.md`).

**Next command: `/10x-impl-review world-progression-stages`.**

---

## 1. State

| Item | Value |
| --- | --- |
| Branch | **`feat/world-progression-stages`**, cut from `feat/parent-weekly-activity-chart` (F1) |
| Merge order | **F2 → F1 → F4.** F4 is third in the stack; both predecessors are already in its base |
| Commits | 5, one per completed phase — see §3 |
| Pushed? | **No.** No PR. The maintainer reviews locally |
| Migration | `supabase/migrations/20260822120000_shift_log_add_earned.sql` — **applied to the local stack and verified in the live DB** |
| Working tree | Clean apart from two folders that are not F4's (`context/changes/world-selection-screen/`, `context/runs/`) |
| Phases done | 1, **1b (added)**, 2, 3, 4a. **4b is outstanding** — handed to `/10x-e2e` |

## 2. Measured baselines (measure them yourself; do not trust a number in a document)

`U₀ = 346` unit tests / 44 files and `E₀ = 17` Playwright tests, both measured on this branch **before
any F4 code**. The run brief's "299/15" is the pre-F2 floor and is stale.

| After | `npm test` | `npx playwright test` | `npm run lint` | `npm run check` |
| --- | --- | --- | --- | --- |
| baseline | 346 / 44 files | 17 | clean | 0 err / 0 warn / 9 pre-existing hints |
| Phase 1 | 348 (`U₀+2`) | 17 (unchanged) | clean | 0 / 0 |
| Phase 1b | 357 (`U₀+11`) | — | clean | 0 / 0 |
| Phase 2 | 379 (`U₀+33`) | — | clean | 0 / 0 |
| Phase 3 | 381 (`U₀+35`) | 17 (unchanged) | clean | 0 / 0 |
| **Phase 4a (final)** | **382 / 45 files (`U₀+36`)** | **17 (`E₀`, undisturbed)** | **clean** | **0 / 0** |

All observed, not remembered. Lint counts warnings as failures here — the baseline had zero.

## 3. What shipped, commit by commit

| SHA | Phase | What |
| --- | --- | --- |
| `aabb8b7` | 1 | The `shift_log.earned` migration, the write path, the contract registry, 2 tests, and the `E2E_PORT` fix |
| `22b4df5` | **1b** | The parent weekly earnings tile (was "Handed to F1") + 9 tests |
| `b5a756f` | 2 | `src/data/stages.ts`, `t.stages`, `stageCopy`, and the ladder tests (+22) |
| `656b800` | 3 | `/app/growth`, `StageRail.astro`, `t.growth`, the `active` union, the `ShopArt` seam comment |
| `3f955d7` | 4a | The "Rozwój świata" nav entry + the label-collision test |

## 4. The migration — applied, not merely written

`supabase/migrations/20260822120000_shift_log_add_earned.sql`, applied with `npx supabase migration up`
and then verified directly against the running Postgres:

- `information_schema.columns` → `earned | integer | is_nullable = YES`
- `pg_constraint` → `shift_log_earned_nonneg CHECK ((earned IS NULL) OR (earned >= 0))` — **named**, per
  the `child_profiles_*_nonneg` precedent, so a later migration or the rollback can reference it
- the 3 pre-existing `shift_log` rows all read `null` (`count(earned) = 0`) — **null, not 0**

**Nullable, no backfill, and no new RLS policy.** The header states why in prose: all four `shift_log`
policies are `auth.uid() = account_id` with **no column reference**, so they already cover `earned` on
all four operations; the project has **no column-level grant** anywhere; and two in-repo precedents did
exactly this and said so. Rollback line is in the header.

## 5. The defect the plan review caught — implemented in its corrected form, and proved

A purchase row's `earned` is `null` **forever, by design**. The naive predicate ("any row in the window
is null") would therefore hide the earnings tile in **every week the child buys a single upgrade** —
permanently, not transitionally. Shipped predicate, in `aggregateWeeklyReport`:

```ts
if (row.upgrade_purchased === null && row.earned == null) earningsKnown = false;
```

**Proved, not asserted:** replacing it with the naive `row.earned == null` turns **exactly 2** tests red
— the purchases-only case and the purchase-alongside-shifts case. The purchases-only test is the
**inverted** one the review demanded: `earningsKnown: true, earned: 0`. Suppression is reserved for
*unknown*; an empty or purchases-only week renders `0 zł`, exactly as `statTasks` already does.

Copy rules honoured: the label is **"Zarobione w tym tygodniu"** — never `suma`/`bilans`/`łącznie`, never
placed next to or reconciled against the wallet. **No test asserts `wallet == sum(earned)`**; the two
DB-level assertions are per-row (`earned === 5*taskCount + 3*cleanCount = 29` for a shift; `null` for a
purchase). A deliberate-break check confirmed the shift test genuinely exercises the write path.

## 6. Decisions taken this step (full text under the plan's `## Autonomous decisions`)

- **D-10 — F4 ships the earnings tile itself.** The plan handed it to F1 on the premise that F1 had not
  started; by implementation time F1 was implemented, reviewed and **merged into F4's base**, so the
  recipe had no owner and the migration would have shipped a write-only column. Applied in its
  **post-F1** form: the tile is the **fourth**, the grid is
  `cn("mt-5 grid gap-3", earningsKnown ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 sm:grid-cols-3")`
  so neither state leaves a 3+1 orphan, and the `pl.ts` comment F1 rewrote to claim "`shift_log` has no
  earnings column" is rewritten a **second** time, because the migration makes that claim false.
- **D-11 — `E2E_PORT`.** `playwright.config.ts` hardcoded `:4321` with `reuseExistingServer`, and a dev
  server from **another agent's git worktree** was listening there — so `npx playwright test` was about
  to exercise *that tree* and report it as this branch's baseline. Both `playwright.config.ts` and
  `e2e/global-setup.ts` now read `process.env.E2E_PORT ?? "4321"`; default behaviour is unchanged. Every
  e2e number above was measured with `E2E_PORT=4327` against a dev server started from this checkout.
- **Two L-003 greps initially failed on doc comments**, not on rendered copy (a comment quoting a stage
  name; another quoting a rendered ordinal). Both were rephrased to name the *key* instead, so the
  greps keep meaning something rather than being waived.
- The plan's other decisions were implemented as written: uncapped formula with saturation in
  `stageForLevel` (D-2), **ART-C with zero new assets** — no file added to `public/illustrations/`, no
  `slice-map.md` row (D-3), route `/app/growth` with `active="growth"` leaving `/app/worlds` to F5 (D-4),
  and `ShopArt` changed by **doc comment only** (D-5).

## 7. Browser verification actually performed (Phase 3 + 4a manual rows)

On a **self-provisioned throwaway account** (`f4-growth-check@example.test`, profile "Zosia") against an
isolated dev server on **4327** — the shared stack was not mutated, and **the account and its profile
were deleted afterwards** (verified: 0 rows remain).

- **1440px:** four stages side by side (259px each), exactly **one** `h1`, each stage name in the DOM
  exactly once, "Aktualnie" once, `scrollWidth == clientWidth`. Computed styles confirm three distinct
  states — done `bg-success`+Check, current `bg-primary`+ordinal+ring+chip, locked `bg-muted`+Lock.
- **712px:** the same four items stack vertically (identical `x`, increasing `y`), one `h1`, no overflow.
- **Terminal stage (`business_level = 9`, restored after):** stage 4 current, **exactly 4** nodes — no
  phantom fifth — `t.growth.maxStage` visible, `t.growth.noUnlocks` shown honestly, **one** progress bar
  on the page (the savings bar; no unfillable next-stage bar), and the shell badge still reads "Poziom
  sklepu 9". The formula is uncapped; saturation is presentational, exactly as D-2 requires.
- **Hero** renders the child's own `/illustrations/world-kawiarnia.webp` with the owned upgrade
  composited — not stock stage art.
- **Nav:** `aria-current="page"` on `/app/growth` only; **one** copy of "Rozwój świata" in the
  accessibility tree (2 in the DOM, 1 under a `display: none` ancestor).

### 7a. D-6 settled empirically — **read this if you are F5**

A throwaway sixth tab labelled "Światy" was injected into the live bottom bar at 712px and removed
immediately (nothing committed). Result: **6 tabs, ONE row, 116px each** — exactly the predicted
`(712 − 16) / 6` — **zero truncated**, no wrap, no horizontal overflow on the bar or the document. At 5
tabs each gets 139px. **F5's sixth entry needs no accommodation.** You do not have to repeat this.

## 8. What is NOT done

**Phase 4b — the browser specs — is outstanding and is deliberately not `/10x-implement` work.** Run
`/10x-e2e world-progression-stages`. Its brief is Phase 4 §2 of the plan:

- `e2e/smoke.spec.ts` — anonymous `/app/growth` redirects to signin (**already confirmed by hand**:
  `GET /app/growth` returns `302 → /auth/signin`), desktop project only. +1
- `e2e/growth.spec.ts` (new) — (1) the nav entry reaches the screen and all four stage names are visible
  with `t.growth.current` present exactly once; (2) the bottom bar holds every entry at the touch
  viewport, located by **full** accessible names, with no horizontal overflow. +2 × 2 projects
- `playwright.config.ts:52` — `testMatch: /gameplay-restore\.spec\.ts/` → `/(gameplay-restore|growth)\.spec\.ts/`.
  **F5 should extend the alternation, not replace it.**

Progress row **4.3** is the only unchecked automated row and is annotated with exactly this.

## 9. Traps already paid for — do not rediscover

- The command sandbox blocks `127.0.0.1:54321` **and the Docker socket**. Run `npm test`, `npx playwright
  test` and every `supabase` / `psql` command with the sandbox disabled, or ~30 tests fail for unrelated
  reasons and `supabase status` reports a false negative.
- **A dev server on 4321 may belong to another agent's worktree.** Check
  `lsof -p <pid> -a -d cwd -Fn` before trusting a Playwright run; use `E2E_PORT=<free port>` (D-11).
- Lint treats warnings as failures here. `class={helper(...)}` in an `.astro` file trips
  `astro/prefer-class-list-directive` — use `class:list={[...]}`.
- `ShopArt` is a **named** export (`import { ShopArt }`), not a default.

## 10. Rules that still bind the reviewer

- All copy through `src/i18n/pl.ts` (L-003); `src/data/*` stays pure.
- One copy of each accessible name; navs toggled with `display`, never `opacity`; one responsive `h1`.
- New column ⇒ RLS reviewed **in the same migration** — verdict here is "no change needed", recorded
  with evidence in the migration header.
- `npm run lint` clean; never `--no-verify`; **do not push, do not open a PR.**

**Next command: `/10x-impl-review world-progression-stages`.**
