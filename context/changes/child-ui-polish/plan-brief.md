# Child UI Polish (S-13) — Plan Brief

> Full plan: `context/changes/child-ui-polish/plan.md`
> Research: `context/changes/child-ui-polish/research.md`

## What & Why

The roadmap's final slice: bring the six built child surfaces to spirit-faithful mockup fidelity and extract the long-deferred child-primitive library. The token layer is already mockup-correct, so this is not a retheme — it's one systemic color-role fix, a primitive extraction with an exact worklist, per-screen structural gaps, and adopting production-candidate art that already exists.

## Starting Point

Research found the child components fully token-clean but visually diverging from the mockups in one systemic way (gold CTAs where the design grammar says blue = action, gold = money only) and several structural ways (no purchase celebration at all, flat placeholder upgrade art in list rows, shop growth as badge chips, missing mission progress strip / receipt panel / hint card / results celebration). The atomic-v2/v3 asset packs cover most art gaps unconsumed.

## Desired End State

A child moving through picker → start → shift → results → shop sees one coherent design language: blue actions, gold money, white soft cards, pastel icon discs, bright hero world art, a shop that visibly grows, and a warm unlock moment — with every behavior, data path, and existing string byte-identical.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Fidelity bar | Spirit-faithful | Pixel-match would require building parked features (sidebar, missions, XP) | Research |
| Surfaces | Six (roadmap four + picker + offline overlay) | The two newer child surfaces were explicitly deferred here | Research |
| CTA grammar | Blue = action everywhere; gold = money/stars only | The mockups' core visual grammar; single highest-leverage change | Plan |
| Unlock moment | Inline animated success card | Closes most of the product-unlocked gap with presentational state only | Plan |
| World art | Swap to bright v2 alpha illustrations + WebP optimization | Tone gap is an asset swap; optimization guards the ≤3s cold-load NFR | Plan |
| Shop growth | Composited upgrade slots + business_level milestone path | Makes the shop itself grow with existing assets/data; chips-restyle as fallback | Plan |
| Cut line | Phase 4 (growth-in-scene + micro-touches) is cuttable | Protects the highest-visibility gaps; fallback is shipped behavior | Plan |
| CLAUDE.md pointer | Fixed in Phase 3 | The slice is the design-truth consumer | Plan |
| New copy | Additive presentational keys only | "No copy change" = existing strings frozen (L-003) | Plan |

## Scope

**In scope:** primitive library (ChildCard, ParentControls, AvatarCircle, HudChip, StoryHeader, FeedbackCard, CheckBadge, EmptyStateCard); CTA color flip; mission progress strip, receipt panel, amber hint card; results celebration; art-forward upgrade tiles + state affordances + benefit lines; unlock card; world-art swap; start hero; growth-in-scene + milestone path; picker/overlay touches; CLAUDE.md fix.

**Out of scope:** all parked mockup chrome; behavior/data/copy changes; per-level art variants or new commissioned art; parent surfaces; wizard restyle; dark mode; screenshot/E2E tooling; new dependencies.

## Architecture / Approach

Four phases ordered by the cut-line. Phase 1 is a pure behavior-preserving refactor (primitives + color grammar) whose green full-suite is the no-regression proof — everything after builds on primitives, not inline copies. Phase 2 polishes the highest-frequency surfaces (task, results). Phase 3 rebuilds the economy presentation and adopts the bright art. Phase 4 holds the declared-cuttable extras. Every structural addition is driven by data that already exists.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Primitives + CTA grammar | The library + blue/gold color roles, zero behavior change | Refactor breaking forms/aria/keys — mitigated by explicit invariants + full suite |
| 2. Task flow + results | Progress strip, receipt panel, hint card, celebration panel | Guardrail drift (tone, no-red) — bounded by mockup checklists |
| 3. Economy + art | Upgrade tiles, unlock card, bright world art, start hero, docs fix | Page weight from new art — WebP conversion + load check |
| 4. Growth-in-scene (cuttable) | Composited shop slots, milestone path, picker/overlay touches | Slot compositing quality per world — chips-restyle fallback declared |

**Prerequisites:** local `assets/` (mockups + atomic packs — this machine has them); local Supabase for the suite gates.
**Estimated effort:** ~2–3 sessions across 4 phases; Phase 4 detachable.

## Open Risks & Assumptions

- Compositing upgrade art onto photo-style scenes may look poor for some worlds — the fallback (restyled chips) is pre-agreed.
- Asset conversion (WebP sizing) is manual tooling this one time; not a build-system change.
- No visual regression tooling exists — manual gates carry all visual QA; the suite only proves behavior.

## Success Criteria (Summary)

- Every child surface reads as the mockup design language (per-screen spirit checklists), with the full test suite green after every phase — proving nothing but pixels changed.
- The primitive library eliminates the duplication census (no orphaned inline copies).
- The roadmap's last slice closes; the app looks like the product the mockups promised.
