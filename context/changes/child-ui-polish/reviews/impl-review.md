<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Child UI Polish (S-13)

- **Plan**: context/changes/child-ui-polish/plan.md
- **Scope**: All 4 phases (full plan)
- **Date**: 2026-07-08
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING (benign riders) |
| Safety & Quality | PASS (2 observations) |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Success criteria re-verified on review day: `npm run check` (0 errors), `npm run lint` (clean), `npm run build` (complete), 202/202 tests in 24 files against a fresh `supabase db reset` DB. Copy freeze verified purely additive (5 new keys in `src/i18n/pl.ts`, zero edits/deletes). Refactor-safety invariants (forms, aria/roles/sr-only, keyed remounts, `type="button"` default, z-50 ceiling) all confirmed intact. `childCard.ts` class-builder in place of the planned `ChildCard` component is a documented improvement (avoids splitting native forms across component boundaries), not drift.

## Findings

### F1 — Art swap incomplete: old world PNGs still shipped and live on auth pages

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/i18n/pl.ts:86-89 → src/components/auth/AuthShell.astro:81
- **Detail**: App surfaces use the new bright .webp art, but the four old dark `world-*.png` files are still tracked in `public/illustrations/` and still rendered by the auth/marketing panel via `t.marketing.worlds`. Plan said old art must not remain referenced and source PNGs must not ship. Branding is inconsistent between auth pages and the app, and the PNGs are a latent delete-trap.
- **Fix A ⭐ Recommended**: Point `marketing.worlds` at the .webp files and delete the four PNGs.
  - Strength: Completes the plan's own contract; image paths are not user-visible copy (L-003 doesn't apply).
  - Tradeoff: Touches an out-of-S-13-scope auth surface.
  - Confidence: HIGH — same four illustrations, same rendering slot.
  - Blind spot: Bright art not yet visually QA'd in AuthShell's small marketing cards.
- **Fix B**: Keep the PNGs and record the auth panel as explicitly out of scope in a plan addendum.
  - Strength: Strict scope discipline.
  - Tradeoff: Inconsistency and delete-trap persist with no owning roadmap item.
  - Confidence: MEDIUM.
  - Blind spot: None significant.
- **Decision**: FIXED (Fix A) — marketing.worlds paths swapped to .webp; four old PNGs deleted

### F2 — Stale ".png always resolves" doc comment in worlds.ts

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/data/worlds.ts:5-6
- **Detail**: Header comment still says slugs resolve as `world-<slug>.png`; the code now resolves `.webp`. A contributor adding a fifth world per the comment gets a silent 404.
- **Fix**: Update the comment to `.webp`.
- **Decision**: FIXED — comment updated to .webp

### F3 — Doubled role="status" live regions on wrong-answer-with-hint

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/child/TaskScreen.tsx:64-80
- **Detail**: The old single `role="status"` card became two sibling live regions (FeedbackCard retry + amber hint card); screen readers announce twice simultaneously.
- **Fix**: Drop `role="status"` from the hint card, or wrap both in one live region.
- **Decision**: FIXED — role="status" removed from the hint card (retry card still announces)

### F4 — One world illustration is 2× the weight of its siblings

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: public/illustrations/world-sklep-ksiegarnia.webp
- **Detail**: 98 KB vs 42–61 KB siblings at identical 896×718; eager-loaded above the fold on /app/start for that theme.
- **Fix**: Re-export at slightly lower WebP quality.
- **Decision**: FIXED — recompressed 98 KB → 72 KB (q62/effort 6, same 896×718; art is denser than siblings, lower quality risked artifacts)

### F5 — Unchecked-cast i18n lookup duplicated into a second file

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/child/ShiftResults.tsx:18-20
- **Detail**: `upgradeName` duplicates UpgradeShop's `t.upgrades[id as keyof …]` pattern, which throws if a catalog id lacks an i18n entry (all 6 current ids present). Pre-existing pattern, now in two files.
- **Fix**: Extract one guarded resolver into `src/data/upgrades.ts`.
- **Decision**: FIXED — shared guarded upgradeCopy() resolver added to src/i18n/index.ts; both call sites switched

### F6 — Minor visual-spec drifts (all defensible spirit calls)

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: ShiftScreen.tsx:177-187, start.astro:106-142, ShopArt.tsx:41
- **Detail**: Progress-strip segments carry no numbers; start CTAs stayed outside the hero card; ShopArt object-cover → object-contain; lucide icons instead of v3 progress-node symbols; milestone path aria-hidden with no label key.
- **Fix**: Accept as-is (recommended) or note in a plan addendum.
- **Decision**: ACCEPTED — deliberate spirit-faithful calls, recorded here

### F7 — Benign unplanned riders: WeeklyReport + global.css tokens

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/components/parent/WeeklyReport.tsx, src/styles/global.css:24-27
- **Detail**: WeeklyReport's avatar swapped to the AvatarCircle primitive (census site, emitted classes identical, zero visual change); global.css gained `--success` tokens required by the planned celebration panel, "Dostępne" pill, and done-nodes.
- **Fix**: None needed — noted for the record.
- **Decision**: ACCEPTED — benign riders required by planned work
