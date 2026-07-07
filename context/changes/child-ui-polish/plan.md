# Child UI Polish (S-13) Implementation Plan

## Overview

Close roadmap **S-13**, the final slice: bring six child surfaces (start, task/shift, results, upgrades, picker, offline overlay) to **spirit-faithful** mockup fidelity and extract the long-deferred **child-primitive library** that absorbs the ad-hoc primitives. Pure visual/UX — no behavior change; existing copy frozen (new presentational strings additive via `t.*`, per planning decision). No database migration, no route changes.

## Current State Analysis

From `research.md` (fresh, file:line-verified; scope decisions — spirit-faithful bar, six surfaces — made there by the user):

- **The token layer is already mockup-faithful** (`global.css:6-41,77-114`: primary `#2473F3`, gold `#F3BE5D`, bg `#F3F8FE`, `--radius 0.875rem`, Nunito) and the child components are token-clean. S-13 is not a retheme.
- **Systemic color-role inversion**: mockups use blue = action, gold = money/stars only; the app uses `ChildButton variant="gold"` as the primary CTA everywhere (`StartShiftButton.tsx:13`, `TaskScreen.tsx:55`, `ShiftResults.tsx:63`, `OfflineOverlay.tsx:41`, `UpgradeShop.tsx:152`).
- **Primitive duplication is precisely ranked**: card shell ~9× inline, parent-controls bar 3× byte-identical, avatar circle 4×, wallet pill 2× identical, `CountingTask` header = strict subset of `StoryHeader`, feedback card 2×, check badge 2×, empty-CTA card 2×. `ChildButton` (8 consumers) is the anchor; `SelectTile`, `ShopArt`, `SkillBars` are real primitives already.
- **Per-screen spirit gaps** (research §2 table): no purchase celebration exists; upgrade art is flat placeholder SVG in horizontal rows vs art-forward 3D tile cards; shop growth = badge chips vs in-scene change; mission screen lacks progress strip / receipt panel / amber hint card; results lacks the green celebration treatment; start lacks hero treatment; picker/overlay need minor spirit touches.
- **Assets exist**: atomic-v2 (bright standalone alpha world illustrations, 26 icons) and v3-progression (`mission-result-receipt`, `product-muffin-unlock`, `world-progression-cafe` PNGs; `coin-chip`, `progress-node-*`, `requirement-chip`, `unlock-badge` symbols) are production-candidates, barely consumed. Unoptimized — convert at adoption.
- **Constraint surface mapped** (research §5): keyed remounts (`ShiftScreen:171,173`; two-stage keys), overlay `z-50`, all aria/roles/`sr-only`, native form POSTs (picker tiles, signout, wizard), `ChildButton` `type="button"` default, ShopArt eager/lazy split, server-authoritative buy state, L-003 copy freeze, tap-target ≥64px-class floor, tw-animate-css-only animation budget, light-only, cold-load ≤3s.

## Desired End State

Every child surface reads as the mockups' design language: blue action buttons with gold reserved for money and stars; white soft-shadow cards with pastel icon discs; a mission screen with a progress strip, receipt-style amounts, and an amber hint card; a celebratory results panel; an art-forward upgrade catalog with honest state affordances and a warm unlock moment; bright hero world art with the shop visibly growing; picker and offline overlay matching the same grammar. Under the hood, the repeated inline patterns live in `src/components/child/` primitives that the surfaces consume. Verify: `check`/`lint`/`build` green, full suite green against a fresh DB after every phase (the no-behavior-change proof), L-003 grep clean, and per-screen visual QA against the mockups at each manual gate.

### Key Discoveries:

- The four work layers are independent — color grammar and primitive extraction (cheap, de-risking) can land before any structural or art work (research §Architecture Insights).
- Every structural addition is driven by data that already exists: progress strip from `index/tasks.length`, requirement chips from `lockedReason` inputs, next-upgrade progress from `nextUpgrade`, milestone path from `business_level`.
- The v2 world illustrations are the bright, standalone versions of exactly the four shipped worlds — the tone gap is an asset swap, not new art.
- No component/E2E harness exists; the vitest suite is service-level, so it proves behavior preservation but not visuals — manual gates carry the visual QA.

## What We're NOT Doing

- **No parked-chrome reproduction**: sidebar nav, daily missions, competency percent bars, world stats, XP, per-task rewards, multiple-choice answers, pricing/inventory chips, "Dodaj do oferty", notification bells — all explicitly ignored per the spirit-faithful bar.
- **No behavior or data-path changes**: phase machines, keyed remounts, buy/save flows, forms, routes, services untouched in function.
- **No existing-copy edits** (L-003 freeze); new strings are additive presentational keys only.
- **No per-level world art variants** (decided: composited slots instead) and **no new commissioned art** — v2/v3 packs only.
- **No parent-surface polish** (report, PIN) and **no wizard restyle** beyond what shared primitives give it for free.
- **No dark mode, no screenshot/E2E tooling, no new dependencies** (animation stays within tw-animate-css).

## Implementation Approach

Four phases ordered by the planning cut-line (must-haves first, cuttable extras last). **Phase 1** is a behavior-preserving refactor: extract the primitive library from the duplication census and flip the CTA color grammar — the full suite green plus type/lint is the regression proof, and every later phase then builds *on* the primitives instead of against inline copies. **Phase 2** closes the task-flow and results gaps (highest child-visibility). **Phase 3** rebuilds the economy surface presentation and adopts the bright art (plus the CLAUDE.md pointer fix, landing with the phase that consumes the assets). **Phase 4** holds the declared-cuttable extras: growth-in-scene, milestone path, picker/overlay micro-touches.

## Critical Implementation Details

- **Refactor-safety invariants (Phase 1 especially)**: primitives must preserve, verbatim, the aria/role/`sr-only` attributes, the native `<form>` structure they wrap (picker tiles POST, signout forms, wizard hidden inputs), `ChildButton`'s `type="button"` default, and the keyed-remount structure in `ShiftScreen`/two-stage tasks. Extracting the card shell must never split a form across component boundaries.
- **Color-role flip mechanics**: keep the `gold` variant (money-adjacent uses may remain where the mockups show gold chips), but the *primary CTA role* becomes blue — prefer flipping call sites to `variant="primary"` (blue) over silently redefining `gold`, so the diff shows intent per surface.
- **Overlay stacking**: any new decorative stacking contexts (hero art, unlock card, confetti-lite) must stay below `z-50` (`OfflineOverlay`).
- **Art pipeline**: v2/v3 PNGs are unoptimized — generate WebP (with PNG fallback via `<picture>` or pre-sized WebP-only if weight allows) at adoption; keep ShopArt's eager-base/lazy-badges loading split; watch the cold-load ≤3s NFR.
- **Animation budget**: tw-animate-css utilities only; celebration effects (unlock card, results panel) must stay in that vocabulary — no keyframe libraries.

## Phase 1: Child-primitive library + CTA color grammar

### Overview

Extract the duplication-ranked primitives into `src/components/child/` and flip the button color roles. Behavior-preserving: the visual delta is CTA colors only; everything else must render identically.

### Changes Required:

#### 1. Primitive extraction

**File**: `src/components/child/` (new: e.g. `ChildCard.tsx`, `ParentControls.astro`, `AvatarCircle.tsx`, `HudChip.tsx`, `FeedbackCard.tsx`, `CheckBadge.tsx`, `EmptyStateCard.astro`; moved/shared: `StoryHeader`)

**Intent**: One home per repeated pattern, absorbing (not forking) the census: card shell (~9×), parent-controls bar (3×), avatar circle (4×), wallet pill + level badge (HudChip family), feedback/status card (2×), check badge (2×), empty-state CTA card (2×), and `StoryHeader` promoted out of `ChangeMakingTask` with `CountingTask` consuming it (its header is the strict subset).

**Contract**: Each primitive reproduces the current markup/classes exactly (radius/padding/size via small props where instances differ); all listed call sites in research §3 switch to the primitive; no orphaned inline copies remain (grep for the old class strings). Astro-vs-React split follows usage (ParentControls/EmptyState are .astro-consumed; the rest React). Refactor-safety invariants per Critical Implementation Details.

#### 2. CTA color grammar

**File**: `src/components/child/ChildButton.tsx` + call sites (`StartShiftButton`, `TaskScreen`, `ShiftResults`, `OfflineOverlay`, `UpgradeShop`, `ShiftScreen` error state, `CreateProfileWizard`)

**Intent**: Blue = action, gold = money/stars only (the mockups' core grammar; planning decision).

**Contract**: Primary CTAs render solid blue (`primary` variant); `gold` remains defined but no main action uses it. Wallet/cost/star elements keep gold. Visual-only — no prop/behavior changes beyond variant values.

#### 3. Scaffold cleanup rider

**File**: `src/components/ui/LibBadge.astro`, `src/components/ui/{card,checkbox}.tsx`

**Intent**: The primitive library makes the unused/off-token scaffold pieces obvious; remove or leave with intent recorded.

**Contract**: Delete unused `LibBadge.astro` (hardcoded colors, scaffold leftover) if nothing references it; leave `card/checkbox` (stock shadcn) untouched.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- Full suite passes against a fresh DB (`npx supabase db reset` + `npx vitest run`) — the behavior-preservation proof
- No orphaned inline copies of extracted patterns (grep for the census class strings in pages/islands)

#### Manual Verification:

- Every surface renders visually identical to before except CTA colors (side-by-side spot-check)
- All CTAs are blue; gold appears only on money/star elements
- Signout, picker tiles, wizard, coin board, feedback cards all still function (forms/aria intact)

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: Task flow + results polish

### Overview

Close the mission-screen and results gaps — the child's highest-frequency surfaces.

### Changes Required:

#### 1. Mission progress strip

**File**: `src/components/child/ShiftScreen.tsx` (+ a small presentational component if it reads cleaner)

**Intent**: Replace the muted "Zadanie x z y" text line with the mockup's progress strip: fill bar + numbered step dots, current step emphasized.

**Contract**: Driven purely by `index`/`tasks.length`; keeps the existing progress copy (visible or `sr-only`); no phase-machine changes.

#### 2. Receipt-style order panel

**File**: `src/components/child/ChangeMakingTask.tsx` (`StoryHeader` evolution), `src/components/child/CountingTask.tsx`

**Intent**: Present the transaction like the mockup's receipt: amounts as oversized color-emphasized numerals (paid/price), dashed divider, question as the headline — instead of plain interpolated sentences.

**Contract**: Same i18n strings and interpolation values; the *numbers* get visual emphasis (extraction from the existing `{paid}`/`{price}` values, not new copy); hint-highlight behavior preserved; two-stage stage-labels keep working.

#### 3. Amber hint card

**File**: `src/components/child/TaskScreen.tsx`, `src/i18n/pl.ts`

**Intent**: When `showHint` fires, the hint renders as the mockup's dedicated cream/amber "Wskazówka" card with a lightbulb icon, instead of muted text inside the retry card.

**Contract**: Same trigger (`showHint`), same hint copy; new additive key only for the card's "Wskazówka" title if not already present; retry card keeps its `role="status"`; no red, calm tone.

#### 4. Results celebration treatment

**File**: `src/components/child/ShiftResults.tsx`, `src/i18n/pl.ts` (additive keys only if needed)

**Intent**: The mockup's celebration: green check-circle badge on a pale-green tinted panel (confetti-lite within the animation budget), earnings + stars as two labeled cells, a next-upgrade art+progress card (from `nextUpgrade` data, shown when one exists), and a proper action row (blue primary back/next, outline upgrades link).

**Contract**: Star-row `role="img"` + aria label preserved; earnings values/derivations unchanged; `canUpgrade`/nudge logic unchanged (presentation only); v3 `mission-result-receipt` art optional garnish if weight allows.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- Full suite passes against a fresh DB (`supabase db reset` + `vitest run`)
- No inline user-visible literals in edited surfaces (L-003 grep)

#### Manual Verification:

- Mission screen vs `03-change-mission-web.png`: progress strip, receipt panel, amber hint card read as the mockup's spirit; coin mechanic unchanged
- Results vs `03-mission-result-web.png`: celebration panel, labeled cells, next-upgrade card, action row
- Retry/hint/success flows behave exactly as before; no red anywhere; animations smooth

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Economy surfaces + art adoption

### Overview

Rebuild the upgrade catalog presentation, add the unlock moment, adopt the bright world art, give start its hero treatment, and fix the stale docs pointer.

### Changes Required:

#### 1. Art-forward upgrade catalog

**File**: `src/components/child/UpgradeShop.tsx`, `src/i18n/pl.ts` (additive benefit-line keys), `src/data/upgrades.ts` (only if a benefit key name belongs on the catalog entry)

**Intent**: Vertical tile cards (large centered art, name, one-line child-readable benefit, coin-icon price badge, state affordance) replacing horizontal rows; state affordances per mockup: green "Dostępne" pill, lock icon + level, requirement chips styled from the existing `lockedReason` data, gray locked button.

**Contract**: The affordable/locked/owned partition, buy flow, and server-authoritative state are untouched; list semantics (`ul`/`li`) preserved; benefit lines = new additive `t.upgrades.*.desc`-style keys (some `desc` keys already exist — reuse where present); requirement chips render existing reason data, no new logic.

#### 2. Inline unlock success card

**File**: `src/components/child/UpgradeShop.tsx`, `src/i18n/pl.ts`

**Intent**: The purchase moment (decided: inline card): after a successful buy, an animated green-tinted card with the upgrade's art and a warm one-liner appears before the item settles into the owned section.

**Contract**: Presentational state keyed off the existing buy response — no data-path change; dismiss/auto-settle within tw-animate-css; new additive copy keys; stays below `z-50`.

#### 3. Bright world art + optimization

**File**: `public/illustrations/world-*.{png→webp}`, `src/data/worlds.ts` (paths), a small asset-conversion step (documented in the phase, not a build-system change)

**Intent**: Swap the dark renders for atomic-v2's bright standalone world illustrations (the four shipped worlds), optimized (WebP, sized for the card) to respect the cold-load NFR.

**Contract**: Same aspect handling in `ShopArt` (`aspect-[4/3]` or adjusted to the new art's natural crop); eager/lazy split preserved; per-world visual QA at the gate; source PNGs not shipped.

#### 4. Start-screen hero treatment

**File**: `src/pages/app/start.astro` (+ primitives from Phase 1)

**Intent**: The dashboard mockup's spirit: world name as hero-scale title with tagline over/beside the art, in-card CTA arrangement, star icon in the level chip, pastel icon-disc motif on the HUD.

**Contract**: Same data, same links/CTAs (StartShiftButton stays the primary action); greeting/avatar/switch-link/parent-controls all preserved (now via primitives); no parked modules added.

#### 5. CLAUDE.md pointer fix

**File**: `CLAUDE.md`

**Intent**: Correct the stale `assets/matma-verse/` canonical-designs pointer to the real sets (`math-economy-ui-v2-*`, `math-economy-auth-v2-*`, `math-economy-missing-screens-v3-*`, `atomic-assets-*`) with the mapping doc referenced.

**Contract**: Prose-only edit to the "Design source of truth" section; the local-only caveat stays.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- Full suite passes against a fresh DB (`supabase db reset` + `vitest run`)
- No inline literals (L-003 grep); no orphaned old art references

#### Manual Verification:

- Upgrades vs `02-upgrades-web.png`: tile cards, affordances, benefit lines, price badges; buy flow works incl. locked/insufficient paths
- Unlock moment vs `04-product-unlocked-web.png` spirit: warm, green, non-blocking
- World art bright and crisp on start + upgrades per world; page weight sane (cold-load feel)
- Start hero vs `02-child-dashboard-web.png` spirit; CLAUDE.md reads correctly

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Growth-in-scene + micro-touches (declared cuttable)

### Overview

The planning cut-line's extras: the shop visibly grows, plus picker/overlay spirit touches. If effort runs long, this phase ships partially or falls back to restyled chips.

### Changes Required:

#### 1. Composited upgrade slots in the shop scene

**File**: `src/components/child/ShopArt.tsx`

**Intent**: Owned-upgrade art composited into the scene at per-world positioned slots (replacing the badge-chip row) so the shop itself looks bigger as upgrades land.

**Contract**: Positioning data lives with the component/world data (per-world slot map); falls back gracefully when art/slot missing; eager/lazy split preserved; fallback plan = restyle the existing chips to spirit if compositing proves poor against the art.

#### 2. Business-level milestone path

**File**: `src/pages/app/start.astro` or `ShopArt` surround (+ v3 `progress-node-*` symbols)

**Intent**: A lightweight level path (done/active/locked nodes) from `business_level` — the world-progression mockup's faithful, unparked element.

**Contract**: Read-only from existing profile data; no new copy beyond an additive label key; calm, no urgency.

#### 3. Picker + offline overlay spirit touches

**File**: `src/pages/app/pick-profile.astro`, `src/components/child/OfflineOverlay.tsx`

**Intent**: Picker: blue selected/hover outline per mockup selected-card language; plus icon in a pastel blue disc. Overlay: content in a white rounded card on the backdrop, icon in a muted tinted disc (button already blue from Phase 1).

**Contract**: Forms/aria/probe behavior untouched; `z-50` preserved.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- Full suite passes against a fresh DB (`supabase db reset` + `vitest run`)

#### Manual Verification:

- Shop scene visibly changes as upgrades are owned (per world); milestone path reflects business_level
- Picker and offline overlay read as the same design language; offline flow still works end-to-end
- Full six-surface walkthrough vs mockups: coherent, calm, blue/gold grammar consistent

**Implementation Note**: Final phase — after verification, S-13 completes the roadmap (archive via `/10x-archive`).

---

## Testing Strategy

### Unit/Integration Tests:

- No new tests expected (pure visual); the existing 200+ suite against a fresh DB at every phase end is the behavior-preservation gate.
- If any primitive extraction forces a test-visible change (it shouldn't), that's a red flag to re-examine, not a test to update.

### Manual Testing Steps:

1. Phase-by-phase side-by-side vs the six mockups (spirit checklist per screen from research §2).
2. Full play loop after each phase: picker → start → shift (counting, change, two-stage, hint, retry) → results → upgrades → buy → unlock → back.
3. NFR spot-checks: tap targets on a touch device, animation smoothness, page weight after art swap, devtools-offline overlay.
4. a11y sweep: tab order, aria states, `prefers-reduced-motion` sanity (animations are decorative).

## Performance Considerations

The art swap is the only weight-relevant change: convert v2/v3 PNGs to sized WebP at adoption, keep ShopArt's eager/lazy split, and eyeball cold-load after Phase 3 (NFR ≤3s). Animations remain CSS-only.

## Migration Notes

None — assets are additive/replacing files in `public/`; no data or schema involved. Rollback = revert commits.

## References

- Research: `context/changes/child-ui-polish/research.md` (gap tables, primitive census, constraints — authoritative)
- Mockups: `assets/math-economy-ui-v2-web/{02-child-dashboard,03-change-mission}-web.png`, `assets/math-economy-missing-screens-v3-web/{01-world-progression,02-upgrades,03-mission-result,04-product-unlocked}-web.png`
- Assets: `assets/atomic-assets-v2/`, `assets/atomic-assets-v3-progression/` (manifests carry usage guidance)
- Precedent: `context/archive/2026-06-27-matmaverse-design-system/` (token layer, slice-map sourcing, deferral of this library)
- Lessons: L-003 (copy freeze / i18n)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Child-primitive library + CTA color grammar

#### Automated

- [x] 1.1 Type checking passes: `npm run check` — 6457849
- [x] 1.2 Linting passes: `npm run lint` — 6457849
- [x] 1.3 Build succeeds: `npm run build` — 6457849
- [x] 1.4 Full suite passes against a fresh DB (`supabase db reset` + `vitest run`) — 6457849
- [x] 1.5 No orphaned inline copies of extracted patterns (census grep) — 6457849

#### Manual

- [x] 1.6 Surfaces visually identical except CTA colors (side-by-side spot-check) — 6457849
- [x] 1.7 Blue CTAs everywhere; gold only on money/stars — 6457849
- [x] 1.8 Signout/picker/wizard/coin-board/feedback flows intact (forms + aria) — 6457849

### Phase 2: Task flow + results polish

#### Automated

- [x] 2.1 Type checking passes: `npm run check`
- [x] 2.2 Linting passes: `npm run lint`
- [x] 2.3 Build succeeds: `npm run build`
- [x] 2.4 Full suite passes against a fresh DB (`supabase db reset` + `vitest run`)
- [x] 2.5 No inline literals in edited surfaces (L-003 grep)

#### Manual

- [x] 2.6 Mission screen matches change-mission spirit (strip, receipt panel, amber hint); coin mechanic unchanged
- [x] 2.7 Results matches mission-result spirit (celebration panel, cells, next-upgrade card, action row)
- [x] 2.8 Retry/hint/success flows unchanged; no red; animations smooth

### Phase 3: Economy surfaces + art adoption

#### Automated

- [ ] 3.1 Type checking passes: `npm run check`
- [ ] 3.2 Linting passes: `npm run lint`
- [ ] 3.3 Build succeeds: `npm run build`
- [ ] 3.4 Full suite passes against a fresh DB (`supabase db reset` + `vitest run`)
- [ ] 3.5 No inline literals (L-003 grep); no orphaned old-art references

#### Manual

- [ ] 3.6 Upgrades matches upgrades-mockup spirit (tiles, affordances, benefits, badges); buy paths work
- [ ] 3.7 Unlock moment warm/green/non-blocking per product-unlocked spirit
- [ ] 3.8 Bright world art crisp on start + upgrades; page weight sane
- [ ] 3.9 Start hero matches dashboard spirit; CLAUDE.md pointer corrected

### Phase 4: Growth-in-scene + micro-touches

#### Automated

- [ ] 4.1 Type checking passes: `npm run check`
- [ ] 4.2 Linting passes: `npm run lint`
- [ ] 4.3 Build succeeds: `npm run build`
- [ ] 4.4 Full suite passes against a fresh DB (`supabase db reset` + `vitest run`)

#### Manual

- [ ] 4.5 Shop scene visibly grows with owned upgrades; milestone path reflects business_level
- [ ] 4.6 Picker + overlay match the design language; offline flow works end-to-end
- [ ] 4.7 Full six-surface walkthrough coherent (blue/gold grammar, calm tone)
