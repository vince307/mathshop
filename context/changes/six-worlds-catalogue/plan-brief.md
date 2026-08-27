# `six-worlds-catalogue` — Plan Brief

> Full plan: `context/changes/six-worlds-catalogue/plan.md`
> Research: `context/changes/six-worlds-catalogue/research.md`
> Run: `context/runs/2026-08-27-world-economy/` — feature **F2**, backlog **W1**

## What & Why

PRD v3 assumes six worlds; the code ships four. This closes that gap by landing
`pracownia` / **Pracownia** and `laboratorium` / **Laboratorium** on art that is
already committed, reflowing the two tile grids that six entries force, and giving
each new plate its own `WORLD_SLOTS` table. It is not a new decision — it is the
**execution of D-3's own stated reversal condition** (*"the maintainer supplies art +
names for worlds 5 and 6"*, supplied 2026-08-27).

## Starting Point

`WORLDS` in `src/data/worlds.ts` holds four records with inline names. **Nine of its
eleven consumers are already six-proof** because the F5 change deliberately built
them to derive — `WorldPicker` and `CreateProfileWizard` map the array, both profile
routes `.refine` against `WORLD_SLUGS`, and `tests/worlds-picker.test.tsx` asserts
`WORLDS.length` rather than `4`. Both plates are committed
(`public/illustrations/world-{pracownia,laboratorium}.webp`, 896×718, provenance in
`slice-map.md`). Exactly one test goes red on the growth:
`tests/shop-art-slots.test.tsx` demands a `WORLD_SLOTS` table per non-default slug,
and there are three today.

## Desired End State

`/app/worlds` shows six tiles — 3×2 at `lg+`, 2×3 below, matching the two
`01-world-selection` mockups. A child can pick either new world, it stores in
`child_profiles.theme` with **no migration**, and `/app/start` renders that plate with
every owned upgrade badge sitting in its own margins rather than at coordinates tuned
for a different scene. Every module comment that asserted the old four-world premise
now tells the truth.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Per-world catalogue vocabulary (contract decision 3) | **None** — ship on the existing `upgradeCopy(id)` fallback | It already *is* the neutral fallback; adopting per-world copy is a signature change across 10 call sites in 5 files, two with no world in scope, on top of 48 unsourced child-facing strings | Research → Plan |
| Decoration count per world (contract decision 4) | **Inherit F1's N**; 3 only as a standalone fallback | F1 owns the D-13 pacing model that prices the sink; unequal sink capacity is the one asymmetry D-11 exists to prevent | Research → Plan |
| `t.marketing.worlds` | **Stays at four**, with a comment | Growing it silently ships a ragged `grid-cols-4` auth panel that no test or e2e spec would catch | Plan |
| Wizard interest grid | `sm:grid-cols-4` → `sm:grid-cols-3` | No-orphan-row rule at six; the `05` mockup is unreadable from the code lane, and the plan says so | Plan |
| `WORLD_SLOTS` ownership | F1 backfills the three existing tables; **W1 writes two complete new ones** | The stack is serial, so W1 sees final `UPGRADE_IDS`; neither feature edits the other's rows | Research |
| Decorations if F1 slips | **Drop Phase 4** — never create `src/data/decorations.ts` | No type, no persistence key, no buy path, no renderer: it would be dead code, and sizing it means inventing the pacing model | Research → Plan |
| New test | `tests/worlds-art.test.ts` — slug = stem = `image`, file exists | Nothing pins the invariant A3 rests on; a typo'd stem is a silent 404 across three surfaces | Plan |

## Scope

**In scope:** two `WORLDS` records · a slug↔stem↔art test · `lg:grid-cols-3` on
`WorldPicker` and `sm:grid-cols-3` on `CreateProfileWizard` · rewriting the two module
comments that now lie · two `WORLD_SLOTS` tables · (conditional) two worlds' entries in
F1's decoration registry plus their Polish names · one e2e layout risk.

**Out of scope:** any migration · per-world catalogue vocabulary · creating the
decoration module, type, persistence key, buy route or `ShopArt`'s art-less branch
(all F1's) · restructuring `ShopArt` · re-seeding `e2e/growth.spec.ts` § *Risk
E2E-F4-3* (F1's) · growing `t.marketing.worlds` · a new nav entry.

## Architecture / Approach

Everything but one phase is a **data edit plus three class/comment edits**, which is
the payoff for F5 having built every consumer to derive from `WORLDS`. The only
F1-coupled work — decorations — is isolated into a single **droppable** phase, the
same split the archived F4/F5 run used. `UPGRADE_IDS` is derived, so the two new slot
tables carry six ids or eight depending on whether F1 landed; the test is
self-describing, so the count cannot be got wrong silently.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 0. Baseline | `npm test` / Playwright counts **on this branch**; does `decorations.ts` exist? | Inheriting the base branch's numbers instead of measuring (L-005) |
| 1. The two worlds | `WORLDS` at six + `tests/worlds-art.test.ts` | Leaves `shop-art-slots` red until Phase 3 — deliberate, so don't commit alone |
| 2. Grids + comments | `lg:grid-cols-3`, `sm:grid-cols-3`, three comment rewrites | The wizard class is chosen by rule, not by a mockup the code lane can read |
| 3. `WORLD_SLOTS` | Two new tables, tuned per plate | Coordinates are extrapolated from plate whitespace — needs the manual eyeball pass |
| 4. Decorations | Two worlds' entries in F1's registry + their names | **Conditional.** Drops entirely if F1 has not landed |
| 5. E2E (W1-E2E-1) | Six tiles at 712px without overflow | The assertion must measure the grid, not the document (L-004) |

**Prerequisites:** a worktree from `.claude/skills/10x-autonomous-run/scripts/worktree-bootstrap.sh`;
branch cut from `feat/world-economy-profit-rule` if it exists, else `matmaverse-v2`
with Phase 4 dropped. **Merge order binds: F1 before W1** — both edit
`src/i18n/pl.ts`. Local Supabase up, sandbox disabled for the suites.
**Estimated effort:** one session; ~2 hours if Phase 4 runs, ~1 if it drops.

## Open Risks & Assumptions

- The Phase 3 slot coordinates are an **extrapolation** — no mockup draws upgrade
  badges on either plate. Phase 3's manual pass is what validates them.
- **F1 had no branch cut when this plan was written.** Phase 4's contract is written
  against a module that does not exist yet; re-read it against F1's landed
  `src/data/decorations.ts` before executing, rather than adapting by guessing.
- `t.marketing.worlds` stays an undocumented-no-longer duplicate of `WORLDS` that
  nothing syncs. Deriving it and deleting the duplication is the clean follow-up, and
  it must land with `AuthShell.astro`'s `grid-cols-4`.
- The `t.worlds` namespace collision is **deferred, not resolved** — future per-world
  vocabulary cannot nest under the world-selection screen's namespace.

## Success Criteria (Summary)

- A child can pick Pracownia or Laboratorium and see their own shop scene, with every
  owned upgrade badge in that plate's margins.
- Six tiles lay out cleanly at every breakpoint, with no orphan row and no horizontal
  overflow at 712px.
- `npm test`, `npm run lint`, `npm run check` and `npx playwright test` are green on
  this branch, reported as **baseline + delta measured on this branch** — never an
  absolute count.
