<!-- PLAN-REVIEW-REPORT -->
# Plan Review: `six-worlds-catalogue` — Implementation Plan

- **Plan**: `context/changes/six-worlds-catalogue/plan.md`
- **Mode**: Deep
- **Date**: 2026-08-27
- **Verdict**: REVISE (all findings applied in-step — the plan on disk is the revised one)
- **Findings**: 3 critical · 4 warnings · 4 observations
- **Triage**: autonomous (run `2026-08-27-world-economy`, hard rule 1 — no interactive loop). CRITICAL → fixed in `plan.md`; WARNING → fixed where obvious; OBSERVATION → recorded under `## Known risks`.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | FAIL |
| Plan Completeness | FAIL |

## Grounding

15/15 paths ✓ · 12/12 symbols ✓ · brief↔plan ✓ · `docs/reference/contract-surfaces.md` § *public.child_profiles* / *World-change surface (F5)* read — the plan's "no migration, no DB CHECK on `theme`, closed set enforced in zod at the route (`WORLD_SLUGS`)" is accurate; nothing in W1 changes a documented surface, so no contract-surfaces edit is owed.

Verified independently: `WORLDS` has 4 records with inline names; `WORLD_SLOTS` has exactly 3 keys; all six plates are 896×718; `grep -ri 'pracowni|laborator' src/` returns nothing (no L-007 collision today); `e2e/onboarding.spec.ts` uses `WORLDS[0].name` and is six-proof; `seedChildProfile`'s `shopState` option type is `{ purchased: string[] }`.

## Findings

### F1 — Phase 5's E2E can never run at the viewport that carries its risk

- **Severity**: CRITICAL
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 5 — *Risk W1-E2E-1*
- **Detail**: The whole risk of Phase 5 is the six-tile grid at **712px**. `playwright.config.ts`'s `touch` project is `testMatch: /(gameplay-restore|growth)\.spec\.ts/` — "deliberately scoped to the specs whose risk is viewport-shaped", per its own comment, which even names the fix: *"EXTEND the alternation when adding one (`|worlds`); never replace it."* A new `e2e/worlds.spec.ts` therefore runs in the **desktop** project only, at 1280px, where six tiles in three columns trivially fit. The contracted assertion would run at the one viewport that cannot carry the contracted risk — L-004's `world-progression-stages` failure exactly, and L-009's "verify the path, not the fact". The plan's own criterion ("+1, or +2 if the spec runs in both projects") shows the planner did not know which; it is knowable, and today it is +1.
- **Fix**: Add Phase 5 §0 — extend the `touch` project's alternation to `/(gameplay-restore|growth|worlds)\.spec\.ts/`; change the criterion to **+2**, with `+1` declared a *failed* phase; add Progress row 5.0.
- **Decision**: FIXED

### F2 — The `matmaverse-v2` branch fallback ships a guaranteed merge-time red, and a permanently dropped Phase 4

- **Severity**: CRITICAL
- **Impact**: HIGH — architectural stakes; think carefully before deciding
- **Dimension**: End-State Alignment
- **Location**: Implementation Approach § Branch · Decision 6 · Phase 3 · Phase 4
- **Detail**: Two independent failures, one cause — **the plan asks its gating questions at the branch point, but the binding tree is the merged one**, and the merge order (F1 → W1) puts F1 in that tree regardless of where W1 branched.
  1. Phase 3 sizes each new `WORLD_SLOTS` table to `UPGRADE_IDS` *"as it reads on this branch"* — six if F1 slipped. F1's Phase 3 grows the catalogue to eight (`precision`, `margin`). `tests/shop-art-slots.test.tsx` iterates `Object.entries(WORLD_SLOTS)` × `UPGRADE_IDS`, so at merge `pracownia` and `laboratorium` are missing both new ids. That red is **invisible on W1's own branch** (where the sweep is green) and guaranteed at merge. The plan names the count dependency and never names this consequence.
  2. Phase 4's gate is *"does `src/data/decorations.ts` exist?"* asked at the branch point; a drop is recorded and never re-asked. If it is dropped, the shipped product has six worlds and four worlds' decorations — `decorationsForWorld("pracownia")` returns `[]`, `nextPurchase` falls to `null` once the catalogue is exhausted, and `/app/growth` renders `t.growth.noNextUpgrade` in a third of the worlds. That is precisely the state D-11 exists to abolish, and **nothing goes red**: F1's plan contracts no "every world has a sink" assertion (see crossPlan).
- **Fix**: Add **Phase 6 — Reconciliation after the rebase onto F1**, mandatory and never droppable: re-measure the post-rebase baseline; re-read the merged `UPGRADE_IDS` and complete both new tables; re-ask Phase 4's gate against the merged tree and run rows 4.2–4.9 if it now passes; raise an empty sink as a *blocking* handoff item naming `decorationsForWorld`; re-anchor Phase 3's criteria on the `Object.entries(WORLD_SLOTS)` loop rather than F1's soon-renamed case title (L-006). Its L-009 path-check runs the sweep **unrepaired** first and records the red, so the phase proves the rebase actually happened.
- **Decision**: FIXED

### F3 — Progress↔Phase mechanical contract violated on every phase

- **Severity**: CRITICAL
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: `## Progress`
- **Detail**: All five `### Phase N:` subsections carried abbreviated titles that did not match their `## Phase N:` bodies, and `### Phase 0: Baseline` had no body block at all. The sibling F1 plan matches its headings exactly, so this is not house style. `/10x-implement` parses this section.
- **Fix**: Progress subsection titles made byte-identical to the body headings; a `## Phase 0: Baseline` body block added (it carries the L-005 branch-baseline measurement and the two facts Phases 3/4/6 gate on); Progress row 1.7 added for the new Phase 1 manual bullet. Verified: exactly one `## Progress`, no `- [ ]` outside it, 47 pending rows.
- **Decision**: FIXED

### F4 — Phase 1 predicts two red cases; only one can go red

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 § Success Criteria
- **Detail**: The plan says the expected red is "exactly the two iterating ones". Only *"gives every non-default world its own slot table"* iterates `WORLD_SLUGS` and goes red when `WORLDS` grows. *"covers all six upgrade ids in every table"* iterates `Object.entries(WORLD_SLOTS)`, which does not grow until Phase 3 — it stays green. An implementer who sees one red would waste time hunting the second.
- **Fix**: Criterion rewritten to name the single red case, explain why the other stays green, and declare two reds a signal that something else broke.
- **Decision**: FIXED

### F5 — Decision 3's "3 per world" fallback is stale; F1 has settled on four

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase 4 §1 · Decision 3
- **Detail**: The plan was written before F1's plan existed. F1's **AD-5** contracts **four decorations per world at 40 / 80 / 140 / 220**, and its own rationale sizes the eventual art debt at *"6 × 4 = 24"* — i.e. F1 already budgets for W1's two worlds. F1's `Decoration.id` is world-prefixed. The inherited number is 4, not 3.
- **Fix**: Phase 4 §1 and Decision 3 now name AD-5's four entries and price curve and the `pracownia-*` / `laboratorium-*` id shape; the `3` fallback survives only for the case where F1's landed registry contradicts its own plan, in which case W1 follows the code and records the discrepancy.
- **Decision**: FIXED

### F6 — The commit order for Phases 1–3 is unresolved

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Critical Implementation Details
- **Detail**: The plan required Phases 1 and 3 to land as one commit after observing the red, and separately said "Phase 2 commits independently" — without saying when. Phase 2 cannot go first (its `WorldPicker` header rewrite asserts "six worlds now exist", false until Phase 1 lands) and cannot sit between 1 and 3 without either committing a red tree or staging surgery.
- **Fix**: Execution order fixed explicitly as **0 → 1 → 3 → 2 → 4 → 5 → 6**, with the reasoning; Progress numbering unchanged.
- **Decision**: FIXED

### F7 — No L-007 substring sweep contracted for the two new world names

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 §1
- **Detail**: Phase 4 contracts an L-007 sweep for decoration labels but nothing does for *Pracownia* / *Laboratorium*, which become accessible names in two grids and are located by `e2e/onboarding.spec.ts`. Verified clean at review time, but F1 appends margin and decoration labels to the same dictionary immediately before W1 — so the plan-time check cannot be inherited.
- **Fix**: Added as a Phase 1 verification bullet plus Progress row 1.7, with the plan-time result recorded so it reads as a confirmation, not a search.
- **Decision**: FIXED

### F8 — World names are inline literals, not dictionary entries (L-003)

- **Severity**: OBSERVATION
- **Dimension**: Architectural Fitness
- **Location**: `src/data/worlds.ts` — the `WORLDS` records
- **Detail**: `World.name` is an inline Polish literal on each record. W1 makes the standing L-003 tension 50% larger. `public/illustrations/slice-map.md`'s claim that world labels "are rendered as text from `i18n`" is already false. Not fixable here — moving names into `src/i18n/pl.ts` restructures a file F1 is appending to in the same stack, which the concurrency contract forbids.
- **Fix**: Recorded under `## Known risks` with the clean follow-up (a `nameKey` on `World`, landed alone).
- **Decision**: RECORDED

### F9 — `CreateProfileWizard` doubles each tile's accessible name

- **Severity**: OBSERVATION
- **Dimension**: Blind Spots
- **Location**: `src/components/child/CreateProfileWizard.tsx` — the `WORLDS.map` interest grid
- **Detail**: `SelectTile` receives `alt={w.name}` **and** `label={w.name}`, so the accessible name is "Pracownia Pracownia". `WorldPicker` passes `alt=""` deliberately and documents why. Pre-existing across all four shipped worlds; it is why `e2e/onboarding.spec.ts` needs `.first()`, and it means a wizard-tile locator must not use `{ exact: true }` on the bare name.
- **Fix**: Recorded under `## Known risks`.
- **Decision**: RECORDED

### F10 — Case-count and title references that will rot

- **Severity**: OBSERVATION
- **Dimension**: Plan Completeness
- **Location**: Phase 3 § Success Criteria
- **Detail**: "all five cases green over five world tables" is an absolute case count (L-005's spirit), and the plan cites `tests/shop-art-slots.test.tsx`'s case titles verbatim while F1's Phase 3 renames one of them (L-006).
- **Fix**: Phase 6 §3 re-anchors on the `Object.entries(WORLD_SLOTS)` loop and the failure message `"<slug>" has no slot for upgrade "<id>"`, which F1's rename does not touch.
- **Decision**: RECORDED

### F11 — The `touch` project's scoping is a standing trap, not a one-off

- **Severity**: OBSERVATION
- **Dimension**: Architectural Fitness
- **Location**: `playwright.config.ts` — the `touch` project
- **Detail**: Every future viewport-shaped risk placed in a new spec file needs the same alternation edit or it silently runs desktop-only.
- **Fix**: Recorded under `## Known risks`.
- **Decision**: RECORDED
