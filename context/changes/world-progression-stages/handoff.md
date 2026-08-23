# Handoff — `world-progression-stages` (feature F4)

Rewritten by the `/10x-e2e` step of the autonomous run `context/runs/2026-08-22-autonomous-five/`.
**The feature is implemented AND browser-covered. Every Progress row in the plan is now `[x]`.**
You are the next agent and you have zero context: read this, then the standing brief
(`context/runs/2026-08-22-autonomous-five/agent-contract.md`).

**Next command: `/10x-impl-review world-progression-stages`.**

---

## 1. State

| Item | Value |
| --- | --- |
| Branch | **`feat/world-progression-stages`**, cut from `feat/parent-weekly-activity-chart` (F1) |
| Merge order | **F2 → F1 → F4.** F4 is third in the stack; both predecessors are already in its base |
| Commits | **7** — `aabb8b7` → **`f1b7b5a`** (see §3) |
| Head | **`f1b7b5a`** — `test(world-progression-stages): browser coverage for the growth screen (p4b)` |
| Pushed? | **No.** No PR. The maintainer reviews locally |
| Migration | `supabase/migrations/20260822120000_shift_log_add_earned.sql` — applied to the local stack and verified in the live DB |
| Working tree | Clean apart from two folders that are not F4's (`context/changes/world-selection-screen/`, `context/runs/`) |
| Phases | **1, 1b, 2, 3, 4a, 4b — all done.** `grep -c '^- \[ \]' plan.md` → **0** |

## 2. Verification observed at the close of Phase 4b (run, not remembered)

| Command | Result |
| --- | --- |
| `npm run lint` | **clean** (warnings are failures here) |
| `npm run check` | **0 errors / 0 warnings / 9 pre-existing hints** (178 files) |
| `npm test` | **382 passed / 45 files** — `U₀ + 36`, unchanged by this step (it adds no unit tests) |
| `E2E_PORT=4327 npx playwright test` | **22 passed** — `E₀ + 5`, exactly the plan's Phase 4 target |

`U₀ = 346` / `E₀ = 17` are the floors measured on this branch before any F4 code. The run brief's
"299 / 15" is the pre-F2 floor and is stale. **Measure the floor yourself — it has moved repeatedly.**

Two environment facts that cost the previous steps real time:

- The command sandbox blocks `127.0.0.1:54321` and the Docker socket. Run `npm test`, `npx playwright
  test` and any `supabase` / `psql` command with the sandbox **disabled**, or ~30 tests fail for
  reasons that have nothing to do with your change and `supabase status` lies.
- **A dev server on `:4321` may belong to another agent's git worktree**, and `reuseExistingServer`
  will happily point your suite at *that tree*. Use `E2E_PORT=<free port>` (D-11); every number above
  was measured on **4327** against a dev server Playwright started from this checkout.

## 3. What shipped, commit by commit

| SHA | Phase | What |
| --- | --- | --- |
| `aabb8b7` | 1 | The `shift_log.earned` migration, the write path, the contract registry, 2 tests, the `E2E_PORT` fix |
| `22b4df5` | 1b | The parent weekly earnings tile (was "Handed to F1") + 9 tests |
| `b5a756f` | 2 | `src/data/stages.ts`, `t.stages`, `stageCopy`, the ladder tests (+22) |
| `656b800` | 3 | `/app/growth`, `StageRail.astro`, `t.growth`, the `active` union, the `ShopArt` seam comment |
| `3f955d7` | 4a | The "Rozwój świata" nav entry + the label-collision test |
| `eae5c2b` | — | The implementation handoff (docs) |
| **`f1b7b5a`** | **4b** | **The browser specs, the smoke redirect, the `testMatch` widening, Progress 4.3 + D-12..D-14** |

## 4. What Phase 4b's specs actually cover

Three files changed, +5 Playwright runs.

**`e2e/smoke.spec.ts`** — one added test, `desktop` only:

- *anonymous `/app/growth` redirects to signin.* `PROTECTED_ROUTES` gates on a
  `startsWith("/app")` prefix, so the newest route is auth-gated by construction — this pins that
  "by construction" for the route most likely to be moved out from under the prefix.

**`e2e/growth.spec.ts`** (new) — two tests, run in **both** projects (1280 px and 712 px):

1. *the nav entry reaches the growth screen and the rail shows every stage.* Clicks the real anchor
   `getByRole("link", { name: t.nav.items.growth, exact: true })` from `/app/start`, waits for
   `/app/growth`, then asserts: the `h1` is `t.growth.title`; each of the four stage names is present
   **exactly once** and visible; `t.growth.current` ("Aktualnie") appears **exactly once**; the chip
   sits on the **first** stage for a fresh profile (so it tracks `business_level` rather than being
   pinned to a fixed node); and the entry carries `aria-current="page"`.
2. *every nav entry stays uniquely reachable and the shell never scrolls sideways.* On `/app/growth`,
   each of the five `t.nav.items.*` labels resolves to **exactly one** link in the accessibility tree
   by its **full** name, and is visible. Then the primary nav's own box is measured
   (`scrollWidth - clientWidth <= 0`), and the document's too.

**`playwright.config.ts`** — `testMatch: /gameplay-restore\.spec\.ts/` →
`/(gameplay-restore|growth)\.spec\.ts/`. **F5: extend the alternation (`|worlds`), do not replace it.**

## 5. The specs were proved, not assumed — five deliberate breaks

Each break was applied to production code, the suite run, then reverted with `git checkout`. Nothing
broken was committed (`git status` verified clean before staging).

| Break | Result |
| --- | --- |
| Growth nav `href` → `/app/start` | Test 1 **red in both projects** (reachability is genuinely asserted) |
| Bottom bar `lg:hidden` → `lg:opacity-0` | **Both desktop tests red** — duplicate accessible names, exactly the doctrine the toggle upholds |
| Tabs `min-w-0 flex-1` → `w-40 shrink-0` | Nav-box overflow assertion red at **96 px** |
| The "Aktualnie" chip on every non-done stage | count `1` vs **`4`** |
| Stage names rendered as descriptions | count `1` vs **`0`** |

**One honest finding, recorded as D-12.** The plan's contracted assertion —
`document.documentElement.scrollWidth <= clientWidth` — did **not** catch the overflow break: the
bottom bar is `position: fixed`, so it can overflow its own box by 96 px while leaving the document
measurement untouched. The document assertion is kept (page-level overflow is a real, separately
established risk) but it is **not** the one carrying this risk. The spec therefore also measures the
element `getByRole("navigation", { name: t.nav.primaryLabel })` resolves to — a measurement on a
**role-located** element, the precedent being `pageText()` in `parent-weekly-report.spec.ts`, so the
"no CSS selectors" rule is intact.

## 6. Decisions taken this step (full text under the plan's `## Autonomous decisions`)

- **D-12 — the fit is asserted on the nav's own box**, not only the document. See §5.
- **D-13 — no viewport branching.** The spec runs at both viewports, so neither test may look at
  `test.info().project.name`. Both assertions were written to be true *and meaningful* at 1280 px
  (sidebar + pinned parent link) and 712 px (five-tab bottom bar). Rejected: a touch-only second spec,
  and `if (project === "touch")` branches that make one green run mean two different things.
- **D-14 — stage names come from `t.stages`, not `src/data/stages.ts`.** The catalogue imports
  `@/data/upgrades` through the tsconfig path alias and no existing spec exercises alias resolution
  inside a Playwright worker; `helpers/i18n.ts`'s relative `../../src/i18n` is the proven path. The
  catalogue↔dictionary agreement is already unit-tested, so nothing is left unprotected.

Earlier decisions D-0..D-11 are unchanged and still recorded in the plan.

## 7. Traps already paid for — do not rediscover

- The sandbox / `:4321` worktree traps — see §2.
- **`getByText` matches substrings, case-insensitively.** Every stage name and nav label was grepped
  against `src/i18n/pl.ts` before use; the four stage names are unique strings there, and the specs
  use `exact: true` throughout. `t.nav.items.growth` ("Rozwój świata") and `t.growth.title`
  ("Rozwój sklepu") share a prefix **by design** — never locate either by a fragment.
- The six-tab question is **closed**: 6 tabs at 712 px hold in **one row, 116 px each, zero
  truncation, no overflow** (Phase 4.6, verified live). F5 needs no accommodation and must not
  re-litigate it.
- Lint treats warnings as failures. `class={helper(...)}` in an `.astro` file trips
  `astro/prefer-class-list-directive` — use `class:list={[...]}`.
- `ShopArt` is a **named** export.

## 8. Rules that still bind the reviewer

- All copy through `src/i18n/pl.ts` (L-003); `src/data/*` stays pure; e2e locator strings resolve
  through `e2e/helpers/i18n.ts`.
- One copy of each accessible name; navs toggled with `display`, never `opacity`; one responsive `h1`.
- New column ⇒ RLS reviewed **in the same migration** — the verdict here is "no change needed",
  recorded with evidence in the migration header.
- `npm run lint` clean; never `--no-verify`; **do not push, do not open a PR.**

**Next command: `/10x-impl-review world-progression-stages`.**
