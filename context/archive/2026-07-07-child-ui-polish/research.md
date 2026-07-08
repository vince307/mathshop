---
date: 2026-07-07T21:50:02+02:00
researcher: vince307
git_commit: de5ee45
branch: main
repository: 10xDevs
topic: "S-13 child-ui-polish — built child surfaces vs canonical mockups: gaps, primitives, assets, constraints"
tags: [research, codebase, child-ui-polish, S-13, design-system, mockups, primitives, atomic-assets]
status: complete
last_updated: 2026-07-07
last_updated_by: vince307
---

# Research: S-13 child-ui-polish — what does "mockup fidelity" require, and what should the primitive library absorb?

**Date**: 2026-07-07T21:50:02+02:00
**Researcher**: vince307
**Git Commit**: de5ee45
**Branch**: main
**Repository**: 10xDevs

## Research Question

> S-13 brings the built child surfaces to canonical mockup fidelity plus a reusable child-primitive library that absorbs the ad-hoc primitives. What exactly is built, what do the mockups demand, what assets exist, and what constraints bind a pure-visual change?

**Scope decisions made during research (owner: user):**
- **Fidelity bar: spirit-faithful** — match palette, layout structure, card/tile language, and art for features that exist; ignore mockup chrome belonging to parked tranches (sidebar nav, daily missions, competency bars, world stats, XP).
- **Surfaces in scope: six** — start, task/shift (counting + change-making incl. two-stage), results, upgrades shop, profile picker (S-11), offline overlay (S-12). Parent surfaces out.

## Summary

The token layer is **already done and correct** — the design-system slice encoded the mockup palette as oklch tokens (`global.css:8`: primary `#2473F3`, bg `#F3F8FE`, ink `#2D374C`, gold `#F3BE5D`; `--radius 0.875rem`), and the child components are fully token-clean (zero hardcoded colors in `src/components/child/`). So S-13 is not a retheme; it is (1) **one systemic color-role fix**, (2) **per-screen structural gaps**, (3) **an art swap** the atomic asset packs already largely provide, and (4) **the deferred primitive library**, whose absorption targets rank cleanly by duplication.

The systemic finding: **mockups use blue for action and gold strictly for money/stars; the built app uses gold as the primary CTA everywhere** (`ChildButton variant="gold"` at every main action). Flipping CTA color-roles is the highest-leverage single change on every screen.

The biggest per-screen gaps: no purchase celebration exists at all (the product-unlocked mockup maps to nothing); upgrade art is flat placeholder SVG vs warm 3D renders; shop growth reads as badge chips instead of in-scene change; the mission screen lacks the progress strip / receipt-style amounts / amber hint card; results lacks the green celebration treatment. Crucially, **atomic-assets v2 + v3-progression are production-candidate packs** (alpha PNGs incl. `mission-result-receipt`, `product-muffin-unlock`, `world-progression-cafe`; 22 SVG icons + 6 ui-symbols incl. `coin-chip`, `progress-node-*`, `requirement-chip`, `unlock-badge`) that the app has barely consumed — most art gaps are asset-wiring, not new design work.

## Detailed Findings

### 1. Built-surface anatomy (what exists)

Shared skeleton on every `/app` page: `Layout` → `bg-background flex min-h-screen flex-col items-center px-4 py-10 sm:py-16` → `max-w-md` column (`start.astro:48`, `task.astro:28`, `upgrades.astro:31`, `pick-profile.astro:26`). Max-width census: 12× `max-w-md`, 2× `max-w-sm`, 1× `max-w-2xl` (wizard).

- **start.astro** — parent-controls bar (`:53-70`), greeting row with avatar ring (`:76-99`), wallet pill + level badge HUD (`:102-111`), shop card `rounded-3xl` wrapping `ShopArt` (`:115-118`), `StartShiftButton`, nudge text, upgrades link.
- **ShiftScreen.tsx** — 4-phase machine (`:27`), progress text (`:167-169`), keyed task remounts (`:171,:173`), error/saving states, `OfflineOverlay` rendered *over* playing/saving (`:156,:166`).
- **TaskScreen.tsx** — header slot + `CoinBoard` + `aria-live` tally (`:51-53`) + gold check button + two `role="status"` feedback cards (`:60-76`, near-identical shells).
- **CoinBoard.tsx** — `rounded-3xl` board (`:25`), `size-16` coin buttons with `aria-pressed` + ring/check (`:31-52`), FR-009 hint pulse (`:27`).
- **ShiftResults.tsx** — star row `role="img"` (`:28-38`), earnings card (`:41-49`), level-up line, nudge link, gold back button.
- **UpgradeShop.tsx** — header + duplicate wallet pill (`:108-112`), duplicate ShopArt card (`:116-118`), `SkillBars`, three availability sections (affordable/locked/owned rows, `:138-204`).
- **pick-profile.astro** — `rounded-3xl border-2` profile tiles (form POST buttons, `:41`), dashed add tile (`:62`); *no parent-controls bar*.
- **OfflineOverlay.tsx** — `fixed inset-0 z-50` blurred backdrop, bare `WifiOff` icon, gold try-again (`:31-49`).

Imagery: `coin.png` (CoinBoard, AuthShell), `coin-stack.png` (start/UpgradeShop/ShiftResults), 6 flat `upgrade-*.svg`, 4 dark `world-*.png`, 4 avatar crops.

### 2. Mockup gap analysis (spirit-faithful, per screen)

**Cross-cutting: color-role semantics.** Blue `#2473F3` = action (buttons, active/selected states); gold = money and stars *only*. Built uses `ChildButton variant="gold"` for every primary CTA (`StartShiftButton.tsx:13`, `TaskScreen.tsx:55`, `ShiftResults.tsx:63`, `OfflineOverlay.tsx:41`, `UpgradeShop.tsx:152`). Mockups never show a gold button.

| Screen (mockup → built) | Already matches | Spirit gaps worth fixing | Parked chrome to ignore |
|---|---|---|---|
| **Dashboard → start** (`02-child-dashboard-web.png`) | Avatar+greeting, wallet pill, level pill, rounded-3xl world card, factual nudge | Hero treatment (world name as hero title + tagline over/beside art, in-card CTA vs small caption below); bright warm world art (current renders are dark/moody); star icon in level chip; icon-in-pastel-disc motif absent; blue CTA | Sidebar, bell, recommended-mission card, skill bars, world stats, activity feed, safe-learning card |
| **Change mission → task** (`03-change-mission-web.png`) | World chip + story + question header; progress text; hint highlights story; big check button; coin art language | Progress strip (fill bar + numbered step dots from `index/tasks.length`); receipt-style order panel (amounts as big colored numerals, dashed divider); dedicated amber "Wskazówka" lightbulb card when `showHint`; blue full-width check button. Do **not** adopt multiple-choice answers — coin board is the deliberate mechanic | Sidebar profile/XP, competency panel, per-task reward preview (earnings are per-shift in v1) |
| **Mission result → results** (`03-mission-result-web.png`) | Celebration copy, gold star row, earnings card, level-up line, nudge | Green check-circle badge + pale-green tinted success panel (confetti-lite); earnings+stars as two labeled cells; illustrated money language (`mission-result-receipt` asset exists); next-upgrade art+progress-bar card (data exists via `nextUpgrade`); action row = blue primary + outline secondary vs underline link + gold button | Sidebar, skill bars, world-goal panel, shop scene card, achievements |
| **Upgrades → UpgradeShop** (`02-upgrades-web.png`) | Availability grouping ↔ mockup's three sections; single Polish locked-reason; wallet pill; grayscale locked art; gold cost | Art-forward vertical tile cards vs horizontal rows; 3D-render upgrade art vs flat SVG (**largest single art gap**); state affordances (green "Dostępne" pill, lock icon, chip-styled requirements — `lockedReason` data already carries counts); one-line child-readable benefit per card; coin-icon price badge; blue buy button | Sidebar, detail rail, przed/po comparison, rail CTA, Wskazówka |
| **Product unlocked → (nothing)** (`04-product-unlocked-web.png`) | — | **No purchase celebration exists at all** — `buy()` silently reshuffles sections (`UpgradeShop.tsx:59-80`). Spirit fix: green-tinted success card/moment with large upgrade art + warm one-liner + continue action; presentational state only | Pricing/inventory chips, "Dodaj do oferty" (no offer concept), checklists, rails |
| **World progression → ShopArt** (`01-world-progression-web.png`) | One-shop-that-grows concept; shared render on start+upgrades | Growth should read **in the scene** (composited upgrade art or per-level variants) vs 36px badge chips (`ShopArt.tsx:22-32`); optional lightweight milestone path from `business_level` (`progress-node-*` ui-symbols exist); hero-scale bright art | Stats row, perk tiles, goal checklist |

**Distilled spirit rules** (for the two mockup-less surfaces): white cards radius 16–24px, 1px light border, soft shadow; pastel tinted icon discs; dashed = add/locked; success green `~#22A45D` on `~#E9F7EF` tint; amber hint cream `~#FFF7E5`; blue selected-outline. **Picker** is already largely conformant (tiles, avatar ring, dashed add) — needs the blue selected/hover outline + plus-in-blue-disc. **OfflineOverlay** — put content in a white rounded-3xl card, icon in muted tinted disc, **blue** try-again (gold misreads as money).

### 3. Primitive census — absorption targets ranked by duplication

| Target | Occurrences | Evidence |
|---|---|---|
| **Card shell** (`bg-card border-border rounded-3xl/2xl border shadow-sm`) | ~9 child-side inline instances | start.astro:115, UpgradeShop:116/142/177/196, CoinBoard:25, pick-profile:41/62, TaskScreen:63/72, ShiftResults:41, start:136, upgrades:57 |
| **Parent-controls bar** | ×3 byte-identical | start.astro:53-70, task.astro:30-40, upgrades.astro:33-43 |
| **Avatar circle** | ×4 (sizes 12/14/16) | start:81, pick-profile:47, CreateProfileWizard:248, WeeklyReport:65 |
| **Wallet pill / HUD chip family** | ×2 identical + level badge sibling | start:103-107 ≡ UpgradeShop:108-112; start:108-110 |
| **StoryHeader vs CountingTask header** | CountingTask re-implements the strict subset inline | ChangeMakingTask.tsx:16-46 vs CountingTask.tsx:29-35 |
| **Feedback/status card** | ×2 + shape-matches earnings card | TaskScreen:60-68/69-76, ShiftResults:41 |
| **Check badge** | ×2 near-identical | CoinBoard:47-51, SelectTile:39-42 |
| **Empty/fallback CTA card** | ×2 byte-identical | start.astro:136-141 ≡ upgrades.astro:57-62 |
| **ShopArt's rounded-3xl frame** | ×2 (frame duplicated at call sites) | start:115-118, UpgradeShop:116-118 |

Existing real primitives to build on: `ChildButton` (8 consumers — the anchor), `SelectTile`, `ShopArt`, `SkillBars`. `ui/card.tsx` and `ui/checkbox.tsx` are unused; `LibBadge.astro` is scaffold leftover with hardcoded colors.

### 4. Design tokens & assets

- **Tokens** (`src/styles/global.css`): oklch light palette sampled from mockups (`:6-41`), bridged via `@theme inline` (`:77-114`); `--radius 0.875rem` (child surfaces mostly bypass via literal `rounded-2xl/3xl`); Nunito Variable (`Layout.astro:2`, `--font-sans`); `.dark` block exists but untargeted (light-only v1). Child components are **token-clean**; the only hardcoded colors live in auth/scaffold files (ServerError red-50, confirm-email green, Banner hex, LibBadge).
- **Animation vocabulary** (entire): `animate-in fade-in [zoom-in-95|zoom-in]` (TaskScreen, OfflineOverlay, ShiftResults), `animate-pulse` (CoinBoard hint), `animate-spin` (auth submit). tw-animate-css only — keep within this budget (NFR: smooth on mid-range tablets).
- **Atomic asset packs**: v1 = draft only (RGB crops, "temporary usable, not final" — `ASSET_AUDIT_2026-06-29.md:19`). **v2 = production-candidate**: 6 standalone alpha world illustrations (bright, matching mockup tone — the current dark `world-*.png` may be swappable) + 6 illustration sets + 26 SVG icons. **v3-progression = production-candidate for exactly S-13's gap screens**: `world-progression-cafe`, `mission-result-receipt`, `product-muffin-unlock`, `parent-report-progress` PNGs + 22 icons + 6 ui-symbols (`coin-chip`, `progress-node-{active,done,locked}`, `requirement-chip`, `unlock-badge`), with explicit per-component SVG-vs-PNG-vs-code guidance (`manifest.json:100-125`). App consumption today: 6 upgrade SVGs, 4 world PNGs, coin PNGs, 4 avatars — most of v2/v3 is unconsumed. Optimization caveat: v2/v3 PNGs are unoptimized; generate WebP/AVIF at adoption (`v2 README:60-62`).

### 5. Constraint surface for a pure-visual change

- **Behavior/copy freeze**: no behavior or copy change (S-13 outcome; L-003 — every visible string stays `t.*` verbatim; copy doubles as future locator surface).
- **Must-preserve a11y/semantics**: coin `aria-pressed`/`aria-label`/`disabled` (CoinBoard:37-39), tally `aria-live` (TaskScreen:51), `role="status"` feedback/saving/error/overlay, star-row `role="img"` (ShiftResults:28), `SkillBars` progressbar attrs (:30-34), picker tile `aria-label`, `sr-only` wallet labels, native form POSTs (picker tiles, signout, wizard hidden inputs).
- **Logic-adjacent hazards**: ShiftScreen's early-return phase structure + `key={index}` remounts are the state-reset mechanism; two-stage `key="stage-1"/"stage-2"` + stable `completeStageTwo`; OfflineOverlay must stay *over* the mounted shift and above any new stacking contexts (`z-50`); `ChildButton` defaults `type="button"` (wizard relies on it); ShopArt's eager base image vs lazy badges split; UpgradeShop's server-authoritative post-buy state.
- **Binding NFRs/guardrails**: ≥64px-class tap targets with non-adjacent spacing (prd-v2:146; coins are a reviewed 56px+gap-4 trade-off); animation smoothness on mid-range tablets (:145); cold-load ≤3s (:147) — watch PNG weight; no red / no urgency / no casino mechanics (prd-v3:75); early-reader icon reliance (prd-v3:50-51); light-only.
- **No component/E2E test harness exists** — polish can't break vitest suites (they're service-level), but the a11y/copy surface above is the de-facto contract.

## Code References

- `src/styles/global.css:6-41,77-114` — token layer (already mockup-faithful)
- `src/components/child/ChildButton.tsx:13-30` — the primitive anchor; gold-as-CTA problem
- `src/components/child/CoinBoard.tsx:25-52`, `TaskScreen.tsx:40-76` — task surface shells
- `src/components/child/ShiftScreen.tsx:27,122-176` — phase machine + keyed remounts (hazard)
- `src/components/child/UpgradeShop.tsx:59-80,104-210` — buy flow (no celebration), catalog rows
- `src/components/child/ShopArt.tsx:17-36` — badge-chip growth (vs in-scene)
- `src/pages/app/start.astro:53-141`, `pick-profile.astro:26-70`, `OfflineOverlay.tsx:31-49`
- `assets/math-economy-ui-v2-web/`, `assets/math-economy-missing-screens-v3-web/` — canonical mockups (local-only)
- `assets/atomic-assets-v{2,3-progression}/manifest.json` — production-candidate art + usage guidance

## Architecture Insights

- The design-system slice did the *token* half of fidelity; S-13 is its explicitly deferred "Part B" (child-primitive library + child screens) — plan.md:34-35 of that archive.
- Fidelity work decomposes into four independent layers: (1) color-role fix (blue action / gold money), (2) primitive extraction (absorb, don't fork — the census gives the exact worklist), (3) per-screen structural gaps, (4) art adoption from v2/v3 packs. Layers 1-2 are cheap and de-risk 3-4.
- The mockups' parked chrome is substantial on every screen — the spirit-faithful bar is what makes S-13 tractable.

## Historical Context (from prior changes)

- `context/archive/2026-06-27-matmaverse-design-system/plan.md:15,34-40,65-82,119-123` — token values, slice-map illustration sourcing, explicit deferral of the child-primitive library; impl-review F4 → L-003.
- `context/archive/2026-07-06-multi-profile-picker/plan.md:30` — "picker mockup fidelity … Visual polish is S-13."
- `context/archive/2026-06-27-.../S-02 plan.md:157-230` — ChildButton/SelectTile/CoinBoard sizing decisions + the 56px coin trade-off (S-02 impl-review).
- `assets/app-docs-v2-llm-handoff/04_SCREENS_AND_DESIGN_MAPPING.md` — canonical screen↔design mapping (ui-v2 = web-first MVP; mobile adapts from web).

## Related Research

- `context/archive/2026-06-14-network-loss-handling/research.md` — overlay/i18n groundwork notes (superseded facts, useful UX-tone constraints).

## Open Questions

1. **CTA color-role flip** — changing every primary CTA from gold to blue is visual-only but product-visible everywhere; confirm at planning (recommendation: yes, it's the mockups' core grammar).
2. **Product-unlocked moment** — inline success card vs full-screen celebration; adds presentational state to `UpgradeShop` (still "no behavior change"? — the buy flow's data path is untouched; confirm the reading).
3. **World-art swap** — are the v2 bright standalone world illustrations acceptable replacements for the current dark `world-*.png` (visual QA needed per world), and do we generate WebP/AVIF at adoption?
4. **Shop-growth-in-scene** — composited slots vs per-level art variants vs keep-chips-but-restyle; effort varies widely, decide scope at planning.
5. **CLAUDE.md stale pointer** (`assets/matma-verse/` → the real `math-economy-*` sets) — fold the one-line doc fix into this change?
