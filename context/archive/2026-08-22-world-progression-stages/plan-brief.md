# Named shop growth stages + per-shift earnings — Plan Brief

> Full plan: `context/changes/world-progression-stages/plan.md`
> Research: `context/changes/world-progression-stages/research.md`
> Standing brief: `context/runs/2026-08-22-autonomous-five/agent-contract.md`

## What & Why

Give the shop **named growth stages** instead of a bare `business_level` integer — *Mały stolik →
Stoisko → Sklep z ofertą → Popyt i zysk* — on a dedicated screen at `/app/growth`, and **record what
each shift paid** in `shift_log.earned`. Today the only progression a child sees is a number and a
decorative, `aria-hidden` 5-node path; and the payout is computed on every shift and thrown away one
line before it could be logged.

## Starting Point

`businessLevelForShifts(n) = 1 + floor(n/3)` (`src/data/shift.ts:99-101`) has one caller and one
writer, is **uncapped**, and has no name, stage or lookup table anywhere. Nothing in the game unlocks
above business level 3 (`upgrades.ts`), so a four-stage catalogue matches the real content depth.
`recordShiftResult` computes `earned` at `child-profiles.ts:170` and drops it at `:187`. Baseline:
lint clean, 299 unit tests / 39 files, 15 e2e.

## Desired End State

A child reaches "Rozwój świata" from the sidebar or bottom bar and lands on `/app/growth`: a
done/current/locked stage rail (vertical cards below `lg`, horizontal rail above), their own shop as
the hero, what the current stage unlocks, and the next upgrade with a savings bar. Every completed
shift writes its server-computed payout to `shift_log.earned`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| `earned` backfill | **Nullable, no backfill** (B-1) | Reconstruction from `skills` is only a lower bound (`complete.ts:56-57` validates with `<=`, not `=`), so a backfilled number would be invented data | Research → Plan D-1 |
| What any earnings total may claim | **F4 ships no earnings figure**; F1's tile reads *"Zarobione w tym tygodniu"*, never `suma`/`bilans`, never compared to the wallet; **no test asserts `wallet == sum(earned)`** | `appendShiftLog` swallows its insert error, so the sum is a permanent lower bound | Research → Plan D-1a |
| Uncapped levels vs 4 stages | **Never cap the formula**; saturate in a total `stageForLevel`, locked by a monotonicity test | Capping makes `leveledUp` permanently `false` and kills the level-up celebration forever | Research → Plan D-2 |
| Copy past the last stage | `t.results.levelUp` **keeps firing**; the growth screen carries the honest "top stage" caption | The level genuinely rose; gating would silence a positive signal forever for an abstraction the child never sees | Plan D-2a |
| Artwork | **ART-C, zero new assets** — lucide `Check`/`Lock` + design tokens; hero is the child's own `world-*.webp` via `ShopArt` | Per-stage art exists for **zero** of four worlds; the one café asset is a single composite, not swappable stage images | Research → Plan D-3 |
| Route | **`/app/growth`**, `active="growth"`, label "Rozwój świata" | `/app/worlds` and the `worlds` union key belong to F5, planned in parallel | Plan D-4 |
| `ShopArt.tsx` (F4-owned) | **No structural change** — doc-comment seam note only; growth screen is a third call site | The base scene and upgrade layer are already orthogonal, so the seam costs nothing to open when art exists | Plan D-5 |
| 6-tab bottom bar | **Holds; no accommodation** — 208px minimum vs 712px viewport, and `truncate` never changes the accessible name; backed by an e2e assertion in both projects | Arithmetic proof plus a real browser check, so F5's sixth tab is pre-cleared | Plan D-6 |
| Scope split | **F4 ships the column; the tile goes to F1**, with a 6-row recipe written out verbatim | F1 is editing that same tile grid right now and the tile is F1's mockup | Research → Plan D-7 |
| RLS on the new column | **No new policy** — recorded verdict with three lines of evidence, not an open question | The four `shift_log` policies are `auth.uid() = account_id` with no column reference; two in-repo precedents did the same | Research → Plan D-9 |

## Scope

**In scope:** the `earned` migration + write path + contract registry; a pure `src/data/stages.ts`
catalogue with a saturating resolver; `/app/growth` with a stage rail; the sidebar/bottom-bar entry;
unit tests per phase and browser tests for the screen and the nav.

**Out of scope:** capping the level formula; any backfill; the parent earnings tile (handed to F1);
per-stage artwork; a server-side breadcrumb for the swallowed `appendShiftLog` error; removing the
existing dashboard milestone path; any new API route; `/app/worlds` and anything else F5 owns; and
the five uncomputable mockup panels (XP bar, daily profit, daily customers, satisfaction, goal
counters) — each with a per-panel verdict in the plan.

## Architecture / Approach

`src/data/stages.ts` (pure, dependency-free) holds `STAGES` keyed on `business_level` via
`requiredLevel`, so stages and `SHIFTS_PER_LEVEL` cannot drift; `stageForLevel(level)` is total and
saturating, mirroring `skillProgress`'s `atMax`. `unlocksForStage` derives what a stage unlocks by
filtering `UPGRADES` on `requiredWorldLevel` — one source of truth. Copy lives in `t.stages[id]` with a
guarded `stageCopy` accessor (the `upgradeCopy` pattern, L-003). `growth.astro` copies
`upgrades.astro`'s frontmatter ladder and renders `StageRail.astro` — one DOM tree, cards below `lg`,
rail above. On the write side, `appendShiftLog` gains one optional key and `recordShiftResult` passes
the `earned` already in scope.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Migration + write path | `shift_log.earned`, the call-site fix, registry + tests | Irreversible; four existing tests insert without `earned` — nullable is what keeps them green |
| 2. Stage catalogue + copy | `src/data/stages.ts`, `t.stages`, `stageCopy`, the ladder tests | The monotonicity/saturation test is the only thing stopping stage/level drift |
| 3. `/app/growth` screen | Page + `StageRail.astro` + `t.growth`; route unlinked | Terminal-stage rendering (no phantom node, no unfillable bar); one `h1`; no overflow at 712px |
| 4. Nav entry + browser tests | Sidebar/bottom-bar entry, `e2e/growth.spec.ts`, smoke redirect | Bottom bar at 5 (soon 6) entries; accessible-name collisions are substring-based |

**Prerequisites:** branch `feat/world-progression-stages` cut from `feat/ui-polish`; local Supabase
stack up (`npx supabase start`) for the DB-backed suites; the mockups are local-only (`assets/` is
gitignored) but the plan already carries the layout description.
**Estimated effort:** ~2–3 sessions across 4 phases; Phase 1 is small and self-contained, Phase 3 is
the bulk.

## Open Risks & Assumptions

- **Assumes existing `shift_log` rows are worth preserving as "unknown".** If the maintainer says they
  are disposable pre-launch data, D-1 flips to `not null default 0` — the single input that reverses it.
- **F5 lands concurrently** on the same `AppShell` `active` union, `items` array and `ShopArt.tsx`.
  Additions are independent lines and merge cleanly, but the plan's D-5 boundary note says rebase and
  re-apply by hand rather than resolving blindly.
- **F1 must actually pick up the tile.** If F1 is cancelled, the recipe in the plan's "Handed to F1"
  section becomes a self-contained follow-up; nothing in F4 needs revisiting.
- **The mockup deviations are deliberate and logged** (no per-stage art, world-neutral stage 3 and 4
  wording, "Rozwój sklepu" instead of a per-world genitive heading) so art can be supplied later
  without re-litigating the design.
- **The 6-tab proof is arithmetic** until Phase 4's browser check runs; the fallback ladder (shorten
  the new label → `overflow-x-auto` → a "Więcej" overflow entry) is written down.

## Success Criteria (Summary)

- A child sees where their shop stands by **name**, with the stages ahead and what the current one
  unlocked — and a child at level 50 sees a coherent terminal state, not a broken rail.
- Every completed shift's payout is recorded; a purchase records `null`; nothing pre-migration is
  invented.
- Lint clean; unit tests grow from 299 to ~313 and stay green; e2e grows from 15 to 20 and stays green,
  including the 712px touch project.
