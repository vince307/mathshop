---
change_id: visible-shop-growth
title: Visible shop change when a completed shift crosses a level threshold
status: archived
created: 2026-06-30
updated: 2026-07-11
archived_at: 2026-07-11T09:45:00Z
---

## Status: SUPERSEDED — closed 2026-07-11 without implementation

This change was **never implemented under this ID**. The 2026-07-01 product re-baseline (PRD v3) replaced its passive-decorative-growth scope with the earned upgrade economy, delivered as **S-06 `upgrade-choice-and-growth`** (`context/archive/2026-07-01-upgrade-choice-and-growth/`) and completed visually by **S-13 `child-ui-polish`** growth-in-scene compositing + milestone path (`context/archive/2026-07-07-child-ui-polish/`). The roadmap records the supersession at S-06's Change ID line. The `research.md` below remains valid for its render-path/RLS/persistence findings. GitHub #8 and Linear MAT-11 were closed with the same note on 2026-07-09. Archived as a historical record, not as completed work.

## Status: PAUSED (2026-07-01)

Paused pending a product **re-baseline**. The `assets/` v2 doc set ("MathMarket / Math Economy" — `app-docs-v2-llm-handoff/`, `atomic-assets-v3-progression/`, `math-economy-missing-screens-v3-*/`) reframes shop growth from *passive decorative level art* (this change's current scope) to the **visible tip of an upgrade economy**: the child earns `virtualBalance`, *chooses* an upgrade (itself a math/decision mission), and the world grows because they decided. Per maintainer decision (2026-07-01), the PRD + roadmap are being re-baselined toward that fuller vision; S-05 will be re-planned against the new roadmap rather than the old passive-growth spec. Existing `research.md` below stays valid for the *render path / RLS / persistence* facts but its passive-growth framing is superseded.

## Notes

Roadmap slice **S-05** (`context/foundation/roadmap.md`). Prereq **S-04** done (full-shift-with-results, archived `context/archive/2026-06-29-full-shift-with-results/`).

**Outcome:** When a completed shift crosses a level threshold, the child sees a visible change to the shop (new shelf, new sign element, or new decoration) on the results screen and on the next start-screen visit. The level number is tracked internally but the UI shows the literal shop *growth*, not an abstract integer.

PRD refs: US-02 AC ("a visible shop change when a level threshold was crossed"), FR-011 (visible shop-change clause).

Ground already laid by S-04:
- `business_level` (smallint, default 1) + `shop_state jsonb` columns persist on `child_profiles` (`shop_state` was explicitly reserved for S-05). `businessLevelForShifts(completedShiftCount) = 1 + floor(count / SHIFTS_PER_LEVEL=3)` in `src/data/shift.ts`.
- Shift-end already computes `leveledUp` server-side (`recordShiftResult`) and the route returns it; `ShiftResults.tsx` shows a "level up!" *text* (`t.results.levelUp`) but **no shop art** — that text is the S-05 hook.
- Start screen HUD (S-04) shows `business_level` as a level chip; this slice should make the *shop image itself* reflect the level.

Open design questions to resolve in research/plan:
- What visual axis grows? (shelf/sign/decoration overlay vs. swapped base art per level.) Mockups may live in `assets/matma-verse/` (local-only — ask maintainer).
- Is the visible change driven by `business_level` alone, or does `shop_state` jsonb store which decorations are unlocked?
- Results-screen reveal animation for the level-up moment (FR-008 celebration tie-in).

Likely worth `/10x-research` first (asset pipeline + where shop art is rendered on both results and start screens), then `/10x-plan`.
