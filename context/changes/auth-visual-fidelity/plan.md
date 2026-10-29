# Auth Visual Fidelity — Closing Pass Implementation Plan

> **This is the SECOND plan for this change.** The first one
> (`plan-2026-08-29-initial.md`, nine phases, all landed through `b6b34ed`) built the
> right regions with the wrong texture. The maintainer's visual pass on 2026-09-04
> rejected the result and produced `fidelity-gaps.md`, which is the specification this
> plan executes. Read that file first; this plan does not restate its audit.

## Overview

Six auth/onboarding screens are structurally complete and visually wrong. The gap is not
a list of small misses — it is four systemic causes (`fidelity-gaps.md` RC1–RC4) plus two
screens whose composition was never built at all:

- **RC1** — the flat `svg/icons/` set shipped where the mockups render soft-3D
  `png/cutouts/` art. Every screen reads "vector wireframe" instead of "rendered".
- **RC2** — everything is smaller and airier than the design, so pages that are
  single-viewport compositions at 1536×1024 scroll.
- **RC3** — screens 02 and 04 wear screen 01's marketing panel; their mockups have
  completely different left panels and no world grid at all.
- **RC4** — background decoration is missing or drawn in outline style where the mockups
  scatter soft-3D coins, receipts, plants, backpacks and shields.
- **Screen 05** is a three-step wizard where the mockup is one screen with app chrome.
- **Screen 06** is one small card where the mockup is a full onboarding page.

The art for all of it is already cut and sitting in `assets/matmaverse-auth-v2-web/`. This
plan copies it in, resizes the composition to the mockups' own measured geometry, gives
02 and 04 their own panels, dresses every page, and rebuilds 05 and 06. It ends with the
same pass at 390×844 against the mobile mockups.

## Current State Analysis

**The art registry is one file and that is what makes RC1 cheap.** No surface hardcodes an
art path: everything resolves through `src/data/marketing-art.ts` (`BRAND_SYMBOL`,
`PARENT_LOCK`, `FEATURE_ICONS`, `BADGE_CHECK`, `HERO_*`, `DECOR_*`). Repointing those
constants re-dresses `AuthShell`, `Welcome`, `FeatureList`, `TrustBadges`,
`CreateProfileWizard` and `ParentPinGate` without touching their markup.

**The atom set splits by colour authority, and the split stays.** Group A (illustrations,
fixed design colours) is committed under `public/illustrations/auth/` and rendered
`<img src>`. Group B (`src/components/icons/authIcons.tsx`) is inlined because it is
authored with `currentColor`. RC1 moves Group A from SVG to PNG; **Group B does not
change** — a field gutter glyph and an eye toggle are UI chrome, not illustration.
`tests/auth-art.test.ts` guards both halves and must keep passing (no `id`, no gradient,
`currentColor` on every inlined icon).

**Measured mockup geometry (screen 01, `01-parent-login-web.png`, 1536×1024).** These are
the numbers RC2 is missing, read off the mockup with PIL rather than estimated:

| Region                    | Mockup box (x0,y0)–(x1,y1) | Size      |
| ------------------------- | -------------------------- | --------- |
| Left column               | 40,40 – 817,975            | 777 × 935 |
| Brand row                 | 40,44 – ~390,115           | h ≈ 71    |
| `<h1>` "Panel rodzica"    | y 181–237 (cap height)     | ≈ 72 px type |
| Accent "Zaloguj się"      | y 281–348                  | ≈ 48 px type |
| Tagline (2 lines)         | y 390–440                  | ≈ 20 px type |
| Feature icon row          | y 449–524                  | icon ≈ 72–76 |
| Feature titles            | y 543–558                  | ≈ 16 px type |
| World tiles (4 in mockup) | y 650–876, tile 176 × 226  | image 176 × 168, label bar 58 |
| Security strip            | y 915–975                  | h ≈ 60    |
| **Card**                  | **899,138 – 1469,905**     | **571 × 768**, radius ≈ 32, padding 40 |
| Card title                | y 185–225                  | ≈ 40 px type |
| Card hero                 | y 245–355, w ≈ 300         |           |
| Email field               | y 392–468                  | **h ≈ 76** |
| Password field            | y 494–571                  | h ≈ 76, gap 26 |
| Remember / forgot row     | y ≈ 600–630                |           |
| Primary button            | y 663–735                  | **h ≈ 72** |
| "lub" divider             | y ≈ 770                    |           |
| Outline button            | y 803–872                  | h ≈ 70    |

Live today: fields 56 px (`h-14`), primary button ≈ 44, card 542 px wide inside a
`max-w-6xl` (1152 px) container that leaves ~190 px of dead margin on each side, world
tiles in a 2×3 grid 226 px tall each, and the security strip below the fold.

**Card boxes for the other screens**, measured the same way:

| Screen | Card box                | Notes                                               |
| ------ | ----------------------- | --------------------------------------------------- |
| 02     | 732,55 – 1397,839       | 666 × 784; trust badges y 877–916                    |
| 03     | 246,160 – 1321,~700     | 1075 wide, two-panel                                 |
| 04     | 864,128 – 1479,907      | 615 × 779                                            |
| 05     | 263,123 – 1361,962      | 1098 × 839; sidebar x 0–225; chips y ≈ 20–105        |
| 06     | PIN 353,300 – 868,843 · settings ~897,300 – 1503,843 · footer 353,871 – 1495,963 · stepper card ~417,31 – 905,175 · sidebar card 32,~640 – 265,~960 | |

**The e2e suite pins three things this plan must move deliberately, not accidentally:**

- `e2e/onboarding.spec.ts` drives the **three-step wizard** — clicks "Dalej" twice, asserts
  `t.profileWizard.reviewIntro`, clicks `t.profileWizard.create`. Phase 5 collapses that
  flow; the spec is rewritten in the same phase or the phase is not done.
- `e2e/helpers/parent-pin.ts` and `e2e/parent-surfaces.spec.ts` fill the PIN with
  `getByLabel(t.parentPin.pinLabel).fill(pin)` on a **single input**, sometimes with six
  digits. Phase 6 makes it segmented; the helper is rewritten with it.
- Fifteen `getByLabel` + `toHaveAccessibleName` assertions guard `FormField`'s `sr-only`
  label. Resizing the field must not touch the label.

**Six worlds, four tiles.** Mockup 01 draws four world tiles at 176 px; `WORLDS` has six
and `e2e/marketing-worlds.spec.ts` exists precisely so the panel cannot advertise fewer
worlds than the app ships. Two rows of mockup-sized tiles would need 472 px of height and
push the security strip past 1024. One row of six at ~118 px is the only arrangement that
is both truthful and single-viewport.

## Desired End State

At 1536×1024, each of `/auth/signin`, `/auth/signup`, `/auth/confirm-email`,
`/auth/reset-password`, `/app/new-profile`, `/app/parent-pin` is a screenshot of its
mockup, region for region, within the tolerances in each phase's Manual rows: soft-3D art,
mockup-scale fields and buttons, its own left panel, its own scattered decorations, no
vertical scroll. Then the same at 390×844 against `assets/matmaverse-auth-v2-mobile/`.

Verify by screenshotting each route at both sizes and comparing side-by-side with the
mockup, plus the automated gates in every phase.

### Key Discoveries

- `src/data/marketing-art.ts` — `FEATURE_ICONS` (today around `:43`; anchor on the
  symbol, not the number — L-006) is index-aligned with
  `t.marketing.features` and pinned by `tests/auth-art.test.ts`; the swap is three string
  edits, not a component change.
- `src/components/auth/AuthShell.astro` — the `<h1>` (today around `:89`) deliberately sits OUTSIDE the
  `hidden lg:block` wrapper (`sr-only lg:not-sr-only`) because a heading in a
  `display:none` subtree names nothing. Any panel refactor must keep it there.
- `src/components/child/SelectTile.tsx` is shared with `WorldPicker.tsx` (a child-facing
  screen out of scope) — screen 05's tile treatment must arrive as a variant, not a
  rewrite.
- `src/pages/api/profiles/create.ts` — `createSchema` (today around `:28`) validates `avatar` against `AVATAR_IDS`, derived
  from `src/data/avatars.ts`; the DB column is a bare `text`. Adding a fifth avatar is
  purely additive.
- `public/avatars/slice-map.md` records why the mockup's fifth avatar was skipped: it is
  drawn wearing its selection ring and check badge. The extraction's
  `avatar-boy-selected.png` has the same chrome plus keying holes.
- Playwright's `desktop` project is `devices["Desktop Chrome"]` — 1280×720. Any 1536×1024
  assertion needs its own `test.use({ viewport })`.
- `fidelity-gaps.md` is currently **untracked**. Phase 1 commits it; the audit is part of
  the change record.

## What We're NOT Doing

- Not renaming the product. Mockups say "MathMarket"; the product is **MatmaVerse**. Only
  the bicolour treatment of the wordmark is adopted, not the name.
- Not adding the signup "Imię" field or the terms checkbox (open decision 1, default kept):
  the product stores no parent name and there is no regulamin page to link to.
- Not building the screen 06 settings toggles as real preferences (open decision 4): they
  render as a static, non-interactive panel.
- Not inventing routes for the screens 05/06 sidebars (open decision 3): static preview
  chrome, not navigation.
- Not touching `AppShell.astro`'s hand-rolled brand lockup (signed-in chrome, its own e2e
  coverage) — still the follow-up `change.md` records.
- Not adding Playwright visual-regression baselines. Parity is verified by the human pass
  the Manual rows describe.
- Not touching `ChangePinSection.tsx` on the report page, `WorldPicker.tsx`, or any
  child-facing screen.
- Not re-cutting art that already reads correctly (`hero-email.png`, `hero-pin.png`,
  `hero-reset.png`, the four committed avatars, the world images).

## Implementation Approach

Art lands and is registered first, so every later phase references paths that provably
exist — the ordering the initial plan established and that worked. Then the cheap global
levers (scale), then the per-screen panels, then per-screen decoration, then the two
structural rebuilds, then mobile. Phases 1–4 are presentation-only and cannot break a
test that is not about looks; phases 5 and 6 change React components under e2e coverage
and each carries its own spec rewrite. Every phase ends green on the full suite.

Screens 05 and 06 are last on purpose: they are the only phases that can regress
behaviour, and by the time they run, the shared vocabulary they should be built from
(field metrics, stepper, panel chrome, decoration contract) already exists.

## Critical Implementation Details

**Keying holes decide where a cutout may be placed.** Several PNGs are keyed by removing
near-white pixels, which punches holes through white content *inside* the illustration:
`hero-email-confirmation`, `hero-reset-card-top`, `security-shield-card-icon`,
`status-email-green`, `next-child-profile-icon`, `level-starting-icon`,
`top-security-shield`, `avatar-boy-selected`. On a white card the hole is invisible; on
the pale page background it reads as a pale rectangle. Rule for this plan: **a holed
cutout goes on `bg-card`, or inside an explicit disc/backdrop, or not at all.**
`hero-parent-dashboard-desk.png` is the inverse — it keeps a residual opaque background,
so it needs either a light patch behind it or a re-cut from the mockup.

**A deliberate break that works by changing a utility class can race Tailwind v4.** Any
verification that flips a class must confirm the computed style in the browser before
running the test, or it proves nothing (`change.md`, Phase 3's false green).

**`*/` inside an Astro frontmatter comment closes it early** and the parse error surfaces
~60 lines later. Write extraction globs without the slash after the star.

**No inlined SVG may declare an `id`.** SVG ids are document-global; two inlined atoms
sharing one cross-render silently. `tests/auth-art.test.ts` enforces it — do not work
around it with a `<mask>`.

**Contrast is measured, not eyeballed.** Re-run the canvas-based probe
(`.playwright-mcp/verify.mjs`, gitignored — regenerate from `change.md`'s description if
absent, and keep its positive control). A regex over `getComputedStyle().color` returns
`oklch(...)` in this theme and fabricates every ratio it prints.

---

## Phase 1: The soft-3D art lands, the flat set retires (RC1)

### Overview

Copy every PNG cutout screens 01–04 need out of the extraction into
`public/illustrations/auth/`, repoint `src/data/marketing-art.ts`, rewrite the
`slice-map.md` section, extend the art test, and give the brand row its 3D symbol and
bicolour wordmark. No layout changes — this phase swaps texture only, so the screens get
visibly better and measurably no taller.

### Changes Required:

#### 1. Committed art

**Files**: new files under `public/illustrations/auth/`

**Intent**: bring the mockups' rendered art into the repo. `assets/` is gitignored, so no
code may resolve a path under it (`CLAUDE.md`); every file is copied **byte-for-byte**,
no crop and no re-encode, unless a row below says otherwise.

**Contract**: output name ← source under `assets/matmaverse-auth-v2-web/`.

Shared and screen 01:

| Output                        | Source                                                        | px      |
| ----------------------------- | ------------------------------------------------------------- | ------- |
| `brand-mark.png`              | `00-shared-auth-assets/png/cutouts/brand-mark.png`             | 96×78   |
| `feature-safety.png`          | `01-parent-login-extracted/png/cutouts/feature-safe-learning.png` | 100×95 |
| `feature-worlds.png`          | `01-…/png/cutouts/feature-worlds.png`                          | 98×98   |
| `feature-progress.png`        | `01-…/png/cutouts/feature-child-progress.png`                  | 92×96   |
| `hero-parent-security.png`    | `01-…/png/cutouts/login-hero-parent-security.png`              | 320×140 |
| `decor-coin.png`              | `00-shared…/png/cutouts/decor-floating-coin.png`               | 88×88   |
| `decor-coin-stack.png`        | `00-shared…/png/cutouts/decor-coin-stack.png`                  | 125×110 |
| `decor-dotted-arrow.png`      | `00-shared…/png/cutouts/decor-dotted-arrow.png`                | 345×79  |
| `decor-signin-chart.png`      | `01-…/png/cutouts/decor-bottom-chart.png`                      | 121×84  |
| `decor-signin-security.png`   | `01-…/png/cutouts/decor-top-right-security.png`                | 220×145 |

Screen 02:

| Output                       | Source (`02-parent-register-extracted/png/cutouts/`) | px      |
| ---------------------------- | ----------------------------------------------------- | ------- |
| `callout-shield.png`         | `feature-parent-account-shield.png`                    | 82×85   |
| `feature-goals.png`          | `feature-learning-goals-target.png`                    | 109×84  |
| `feature-environment.png`    | `feature-safe-environment-lock.png`                    | 92×86   |
| `feature-reports.png`        | `feature-progress-report-chart.png`                    | 104×85  |
| `hero-signup-desk.png`       | `hero-parent-dashboard-desk.png`                       | 555×287 |
| `decor-signup-backpack.png`  | `decor-right-backpack.png`                             | 158×195 |
| `decor-signup-coins.png`     | `decor-right-coin-stack.png`                           | 142×125 |
| `decor-signup-chart.png`     | `decor-top-growth-chart.png`                           | 155×170 |
| `decor-signup-cloud.png`     | `decor-cloud.png`                                      | 131×17  |
| `decor-signup-zl.png`        | `decor-big-zl-coin.png`                                | 135×135 |

Screen 03:

| Output                      | Source (`03-email-verification-extracted/png/cutouts/`) | px      |
| --------------------------- | -------------------------------------------------------- | ------- |
| `decor-verify-shield.png`   | `decor-right-shield.png`                                  | 135×163 |
| `decor-verify-envelope.png` | `decor-left-envelope.png`                                 | 135×114 |
| `decor-verify-document.png` | `decor-right-document.png`                                | 155×160 |
| `decor-verify-plant.png`    | `decor-left-plant.png`                                    | 155×301 |
| `decor-verify-books.png`    | `decor-right-books-plant.png`                             | 254×210 |
| `decor-verify-coins.png`    | `decor-right-coin-stack.png`                              | 155×137 |
| `decor-verify-chart.png`    | `decor-left-chart.png`                                    | 133×165 |
| `decor-verify-path.png`     | `decor-top-dotted-path.png`                               | 390×85  |

Screen 04:

| Output                        | Source (`04-password-reset-extracted/png/cutouts/`) | px      |
| ----------------------------- | ----------------------------------------------------- | ------- |
| `feature-reset-account.png`   | `feature-safe-account-shield.png`                      | 93×100  |
| `feature-reset-data.png`      | `feature-child-data-lock.png`                          | 84×98   |
| `feature-reset-noads.png`     | `feature-no-ads.png`                                   | 90×96   |
| `decor-reset-plane.png`       | `decor-paper-plane.png`                                | 93×83   |
| `decor-reset-shield-bg.png`   | `decor-center-shield-bg.png`                           | 137×155 |
| `decor-reset-envelope.png`    | `decor-top-envelope.png`                               | 40×49   |
| `decor-reset-plant.png`       | `decor-left-plant-bg.png`                              | 165×210 |
| `decor-reset-coins.png`       | `decor-left-coins.png`                                 | 145×102 |
| `decor-reset-coin-stack.png`  | `decor-right-coin-stack.png`                           | 156×175 |
| `decor-reset-chart.png`       | `decor-top-right-chart.png`                            | 147×100 |

World-strip glyphs (SVG, byte-for-byte, from `00-shared-auth-assets/svg/icons/`):
`world-glyph-bakery.svg` ← `world-bakery.svg`, `world-glyph-cafe.svg` ← `world-cafe.svg`,
`world-glyph-galaxy.svg` ← `world-galaxy.svg`, `world-glyph-collector.svg` ←
`world-collector.svg`.

**Retire in this phase** (nothing references them after item 2):
`brand-mark.svg`, `feature-safety.svg`, `feature-worlds.svg`, `feature-progress.svg`,
`hero-parent-security.svg`. The outline decor SVGs (`coin.svg`, `coin-stack.svg`,
`decor-chart.svg`, `decor-receipt.svg`, `decor-path.svg`) stay until Phase 6 — screens
05 and 06 still render them until their own phases land.

#### 2. The art registry

**File**: `src/data/marketing-art.ts`

**Intent**: repoint every Group A constant at the PNG cutouts and give the decoration
layer per-screen groups instead of five loose constants, so Phase 4 has something to
consume and no page invents its own paths.

**Contract**: `BRAND_SYMBOL`, `PARENT_LOCK`, `FEATURE_ICONS` keep their names and change
extension. Add `DECOR_SIGNIN`, `DECOR_SIGNUP`, `DECOR_VERIFY`, `DECOR_RESET` as readonly
records of named paths (e.g. `DECOR_SIGNIN.coinStack`), plus `SIGNUP_PANEL_ART` and
`RESET_PANEL_ART` for the Phase 3 panels. `MARKETING_ART` — the set the test walks — must
list every new path. Add:

```ts
/** Small glyph before a world's name in the auth world strip, keyed by slug. */
export const WORLD_GLYPHS: Readonly<Record<string, string>>;
```

Four of six worlds have an extraction glyph (`kawiarnia`, `piekarnia`,
`galaktyczna-baza`, `sklep-ksiegarnia`). `pracownia` and `laboratorium` have none and get
a `lucide` fallback at the call site — the sanctioned deviation `src/data/stages.ts` and
`ShopGlyph.tsx` already established. Keyed by slug, never index-parallel.

#### 3. Provenance register

**File**: `public/illustrations/slice-map.md`

**Intent**: the auth section currently describes a 14-file SVG-first set that this phase
replaces. Rewrite it, do not append — a register that describes deleted files is worse
than none.

**Contract**: keep the "splits by colour authority" explanation (it is still true and now
also explains why Group B stayed SVG while Group A went PNG); replace the file table with
the tables above; keep the `hero-reset.png` edit note; add a line recording that the flat
`svg/icons/` illustrations were retired because they read as vector where the mockup
renders 3D (RC1).

#### 4. Art contract test

**File**: `tests/auth-art.test.ts`

**Intent**: extend the existing guards to the new surface area without weakening them.

**Contract**: every path in `MARKETING_ART` exists on disk and matches the
`/illustrations/(auth/)?…` pattern (already asserted — the pattern already permits `png`);
add: every `WORLDS` slug resolves through `WORLD_GLYPHS` to a file that exists, or is
absent from the record entirely (the documented fallback case) — no slug may point at a
missing file. The Group A "no id / no gradient" walk keeps running over whatever SVGs
remain.

#### 5. Brand lockup

**Files**: `src/components/marketing/BrandRow.astro`, `src/i18n/pl.ts`

**Intent**: the mockup's wordmark is two-coloured ("Math" blue + "Market" green) and the
symbol is rendered 3D; live is one flat colour and a flat symbol.

**Contract**: add `t.brandParts = { first: "Matma", second: "Verse" }` and assert
`first + second === t.brand` in `tests/marketing-labels.test.ts`. `BrandRow` renders two
adjacent `<span>`s with **no whitespace between them**, `text-primary` and
`text-success-strong`, so the element's text content stays the unbroken "MatmaVerse".
`brand-mark.png` is 96×78 — keep the `w-* h-auto` sizing, never a square `size-*`.
`text-success-strong` on the page background must be re-measured with the contrast probe.

#### 6. Feature icon box

**File**: `src/components/marketing/FeatureList.astro`

**Intent**: the mockup's feature icons are 72–76 px; the box is `lg:size-16` (64).

**Contract**: `lg:size-18`. Below `lg` the carded treatment and its smaller sizes stay —
that is the mobile mockup, not a compromise.

### Success Criteria:

#### Automated Verification:

- Unit suite passes: `npm run test` — baseline 641 tests / 65 files plus the new
  `WORLD_GLYPHS` and `brandParts` assertions
- Lint passes: `npm run lint`
- Type/astro check passes: `npm run check`
- E2E suite green: `npm run test:e2e` → "1 skipped, 31 passed" (sandbox override required)
- No code path resolves under `assets/`: `grep -rn "assets/matmaverse" src/ public/*.* --include=*.ts --include=*.tsx --include=*.astro` returns only comments
- Every retired SVG is gone: `ls public/illustrations/auth/*.svg` lists only
  `badge-check.svg` and the five decor SVGs Phase 6 retires, plus the four world glyphs

#### Manual Verification:

- At 1536×1024 `/auth/signin` shows three soft-3D feature icons, a 3D brand mark and the
  parent-and-shield hero **with its laurel leaves** — no flat vector remains on the screen
- The wordmark reads "Matma" blue + "Verse" green, one word, no gap
- No cutout shows a pale rectangular keying hole on any of the four auth routes
- The contrast probe reports ≥4.5:1 for the green half of the wordmark and every label it
  covered before

---

## Phase 2: Scale and density — the composition fits 1536×1024 (RC2)

### Overview

Resize the shared vocabulary to the measured mockup: container width, column ratio, field
and button heights, card width and padding, heading sizes, and the world strip from a
2×3 grid of large tiles to one row of six compact full-bleed tiles. This is the phase that
stops the pages scrolling.

### Changes Required:

#### 1. Layout tokens

**File**: `src/styles/global.css`

**Intent**: the card is 571 px in the mockup, not 542.

**Contract**: `--container-auth-card: 571px`. Screens 02 and 04 have wider cards (666 and
615) — those are per-page `max-w-*` values, not new tokens.

#### 2. The shell's geometry

**File**: `src/components/auth/AuthShell.astro`

**Intent**: the composition is squeezed into `max-w-6xl` (1152 px) and centred, so the
mockup's 1408 px of content is rendered at 82% scale with dead margins.

**Contract**:
- Outer container `max-w-[1510px]`, page padding `lg:px-10`. **The arithmetic has to
  close, so it is written out:** Tailwind's preflight is `box-sizing: border-box`, so
  `max-w` bounds the border box and the padding comes out of it. The measured mockup needs
  777 (left column) + 82 (gap) + 571 (card) = **1430 px of content**; 1510 − 80 = 1430, and
  1510 centred in 1536 reproduces the mockup's own 40 px page gutters (content 40 → 1470).
  A 1440 px container would leave 1360 and squeeze the left column to 707 — a 9% shrink,
  which is the exact defect RC2 exists to remove, and it would drop the world tiles from
  ~118 px to ~104.
- Grid `lg:grid-cols-[minmax(0,1fr)_var(--container-auth-card)]` with `lg:gap-[82px]`,
  still `items-start` — the card width comes from the item 1 token, never a second literal.
- World strip becomes ONE row: `lg:grid-cols-6`, `gap-3`, tile is
  `overflow-hidden rounded-2xl` with the image **full-bleed** (`aspect-square w-full
  object-cover`, no padding) and a white label bar carrying `WORLD_GLYPHS[slug]` (or the
  lucide fallback) before the name at `text-xs leading-tight`, two lines allowed, fixed
  `min-h`. Six tiles across 777 px ⇒ ~118 px each.
- Feature row and security strip spacing tuned to land the strip inside 1024 px.

#### 3. The field model at mockup scale

**File**: `src/components/auth/FormField.tsx`

**Intent**: 56 px fields where the mockup draws 76.

**Contract**: input `h-19` (76 px), `rounded-2xl`, gutter glyph and padding scaled with it
(`pl-14`, glyph `size-6`). **The `sr-only` label, `aria-describedby` and the error/hint ids
are untouched** — fifteen `getByLabel` locators and five `toHaveAccessibleName` assertions
depend on them.

#### 4. Buttons at mockup scale

**Files**: `src/components/auth/SubmitButton.tsx`, `src/pages/auth/signin.astro`,
`signup.astro`, `reset-password.astro`, `update-password.astro`, `confirm-email.astro`

**Intent**: the primary action is 72 px tall with a large radius in every mockup; the
outline secondary is 70.

**Contract**: primary `h-18 rounded-2xl text-lg font-bold`; outline/secondary
`h-[70px] rounded-2xl`, keeping `bg-card` on cards (the WCAG fix — do not revert to the
variant's `bg-background`).

#### 5. Card chrome

**Files**: the five auth pages

**Intent**: cards are under-padded (32) and under-rounded (24) and their headings are
30 px where the mockup draws 40.

**Contract**: `rounded-[32px]`, `p-10` at `lg`, card heading `text-[40px]` (still `<h2>` on
the four `AuthShell` routes, whose hero keeps the only `<h1>`; screen 03's card heading
**stays the `<h1>`** — that route has no hero), sign-in hero `w-[300px]`, per-screen card
widths: 01 → `max-w-auth-card` (571), 02 → `lg:max-w-[666px]`, 03 → see item 6,
04 → `lg:max-w-[615px]`.

#### 6. Screen 03's own geometry

**File**: `src/pages/auth/confirm-email.astro`

**Intent**: `/auth/confirm-email` is the ONE auth route that does not use `AuthShell` — its
own file header says so, and its mockup is a single wide centred card rather than a
two-column split. Every geometry lever in items 2 and 4 therefore misses it, and item 5
reaches only its radius, padding and heading. Left alone it would exit this phase as the
one screen RC2 never touched: `max-w-4xl` (896 px) against a measured card of **1075**.

**Contract**: outer wrapper `max-w-[1075px]` (the measured box 246,160 – 1321,~700), the
two-panel grid unchanged in structure, hero `w-[430px]` at `lg` (it is drawn at ~430 in the
mockup, `w-72` today), the two footer panels and `TrustBadges` scaled with the wider card.
It keeps its own decoration layer under the same five rules — Phase 4 already names this
file. Below `sm` nothing changes; the stack is the mobile mockup.

#### 7. A no-scroll guard

**Files**: `e2e/helpers/viewport.ts` (new), `e2e/smoke.spec.ts`

**Intent**: "the page must not scroll at 1536×1024" is the acceptance criterion this whole
plan turns on, and nothing checks it. It is cheap to check and it is exactly the
regression that will come back.

**Contract**: a shared helper

```ts
/** Assert the current page is a single-viewport composition at the design size. */
export async function expectFitsAt1536(page: Page): Promise<void>;
```

which calls `page.setViewportSize({ width: 1536, height: 1024 })`, settles, and asserts
`document.documentElement.scrollHeight <= 1032` (1024 + 8 px tolerance) and
`scrollWidth <= 1536`. It lives in a helper — not inline in one spec — because the two
routes that most need it are behind auth and are checked from **other** specs in Phases 5
and 6, where an account already exists.

`e2e/smoke.spec.ts` gets ONE desktop-only test that walks the four public auth routes
through it. Green e2e now reads **"1 skipped, 32 passed"**; Phases 5 and 6 add assertions
inside existing tests, not new ones, so the count does not move again.

Setting the viewport inside the test rather than `test.use({ viewport })` at file scope is
deliberate: `test.use` at the top of `smoke.spec.ts` would re-size every test in the file,
and inside a `describe` it cannot be reused from the authenticated specs at all.

### Success Criteria:

#### Automated Verification:

- Unit suite passes: `npm run test`
- Lint passes: `npm run lint`
- Type/astro check passes: `npm run check`
- E2E suite green: `npm run test:e2e` → "1 skipped, 32 passed"
- The new no-scroll test fails when reverted (confirm the computed style in the browser
  first — a Tailwind-class break can race v4's on-demand CSS)

#### Manual Verification:

- `/auth/signin` at 1536×1024 matches the region table in "Current State Analysis" within
  ±8 px for: card box, both fields, primary button, world strip, security strip — and
  `/auth/confirm-email`'s card matches its own measured box (1075 wide) within ±8 px
- All six worlds are visible in one row, images full-bleed, each label carrying a glyph
- No route scrolls vertically or horizontally at 1536×1024
- The contrast probe still reports ≥4.5:1 everywhere it did before

---

## Phase 3: Screens 02 and 04 get their own left panels (RC3)

### Overview

`AuthShell` renders one shared marketing panel on all four routes it serves (signin,
signup, reset-password, update-password — `/auth/confirm-email` is not one of them).
Mockups 02 and 04 have completely different panels and no world grid. Give the shell a
panel slot with the current content as fallback, and build the two panels.

### Changes Required:

#### 1. The shell takes a panel

**File**: `src/components/auth/AuthShell.astro`

**Intent**: keep the shell as the layout frame (brand row, `<h1>` handling, card slot,
decoration layer) and let a screen supply its own panel body.

**Contract**: add `<slot name="panel">` wrapping the features + world strip + security
strip, with today's content as the slot's **fallback**, so screen 01 changes nothing.
(Screen 03 is untouched for a different reason: `/auth/confirm-email` does not use
`AuthShell` at all — it lays down its own layout and decoration layer. The shell serves
exactly four routes: signin, signup, reset-password, update-password.) Make `accent`
optional — mockups 02 and 04 draw a single heading with no blue accent line. The `<h1>` stays outside the `hidden lg:block` block with
`sr-only lg:not-sr-only`.

#### 2. The signup panel

**File**: `src/components/marketing/SignupPanel.astro` (new)

**Intent**: mockup 02's panel — a pale-blue callout box and three feature rows under the
heading, with the laptop-desk hero at the bottom.

**Contract**: callout = `bg-primary/5 rounded-2xl` with `callout-shield.png` at ~72 px and
`t.marketing.signup.callout`; three rows, each a ~72 px 3D icon (`feature-goals`,
`feature-environment`, `feature-reports`) beside a bold title and a two-line description;
`hero-signup-desk.png` at the panel bottom, ~470 px wide, bleeding left. That cutout keeps
a residual opaque background — check it at 1536×1024, and if a seam shows, re-cut from
`02-parent-register-web.png` and record the crop box in `slice-map.md`.

#### 3. The reset panel

**File**: `src/components/marketing/ResetPanel.astro` (new)

**Intent**: mockup 04's panel — the big envelope hero in the middle of the panel (today it
sits in the card) and three white feature cards at the bottom.

**Contract**: `hero-reset.png` (the committed 402×264 edit) centred at ~430 px; three
`bg-card rounded-2xl` cards, each a ~72 px icon above a bold title and a two-line body
(`feature-reset-account`, `feature-reset-data`, `feature-reset-noads`). No world grid.
The card keeps a smaller copy of the same hero **inside a `bg-primary/10 rounded-full`
disc** — the disc is both the mockup's treatment and what hides the cutout's keying holes.

#### 4. Panel copy

**File**: `src/i18n/pl.ts`

**Intent**: the panels' strings are new and must be Polish, locale-swappable, and free of
substring collisions (L-007).

**Contract**: add `t.marketing.signup.{callout, features[3]}` and
`t.marketing.reset.cards[3]` with the mockups' wording. Add a **new `t.onboarding`
namespace** — it does not exist today (`grep -n "onboarding" src/i18n/pl.ts` returns
nothing) — carrying `steps: [ "Konto rodzica", "Profil dziecka", "Bezpieczeństwo" ]`, which
is what item 5's stepper renders on screens 02, 05 and 06. The third label is the
reconciliation item 5 settles; it is written here once, so 05 and 06 consume a string
rather than re-deciding it. Change
`t.marketing.resetHeading` to the mockup's full two-line "Bezpieczny dostęp do panelu
rodzica" and add a signup panel heading "Utwórz konto rodzica". **`t.auth.reset.heading`
("Nie pamiętasz hasła?") does not change** — `e2e/password-reset.spec.ts` pins it in its
reset-link assertion (today around `:101`).
`tests/marketing-labels.test.ts` gets the new strings in its collision check.

#### 5. The onboarding stepper

**File**: `src/components/onboarding/OnboardingStepper.tsx` (new)

**Intent**: mockups 02, 05 and 06 all draw the same three-step stepper (Konto rodzica →
Profil dziecka → Bezpieczeństwo). Screen 02's was skipped last time because the wizard on
05 had its own competing three-step stepper; Phase 5 removes that one, so the collision
dissolves and open decision 7's default applies — draw it as the mockup does, on every
entry path.

**Contract**: a React component rendered without a client directive (static HTML from
Astro and from React alike): `current: 1 | 2 | 3`, discs with a connecting track, done
steps green with a tick, current blue, future `bg-muted text-foreground` (the
`text-muted-foreground` pairing measures 4.34:1 — under AA). Labels from
`t.onboarding.steps`; the third is **"Bezpieczeństwo"** — mockups 05 and 06 disagree
("Zabezpieczenia" vs "Bezpieczeństwo") and one string has to win; 06 is the screen that
owns the step and its sidebar says "Bezpieczeństwo". Record the reconciliation in the
component header. Rendered on `/auth/signup` (step 1) in this phase.

#### 6. Pages wire their panels

**Files**: `src/pages/auth/signup.astro`, `src/pages/auth/reset-password.astro`,
`src/pages/auth/update-password.astro`

**Intent**: pass the new panels and headings.

**Contract**: signup passes `SignupPanel` + `heading="Utwórz konto rodzica"` and no
`accent`; reset passes `ResetPanel` + the two-line heading and no `accent`;
`update-password` reuses the reset panel (no mockup of its own — the recovery flow's two
steps must read as one flow). Signup's card gains the stepper row at its top.

### Success Criteria:

#### Automated Verification:

- Unit suite passes: `npm run test` — plus the new label-collision assertions
- Lint passes: `npm run lint`
- Type/astro check passes: `npm run check`
- E2E suite green: `npm run test:e2e` → "1 skipped, 32 passed"
- Exactly one `<h1>` per route at 1536 and at 390 (assert in the existing smoke coverage)

#### Manual Verification:

- `/auth/signup` at 1536×1024 shows the callout box, three feature rows and the desk hero
  — and **no world grid** — matching `02-parent-register-web.png` region for region
- `/auth/reset-password` shows the big envelope hero in the LEFT panel and three white
  feature cards below it; the card's hero sits in a pale disc with no visible hole
- The "Krok 1 z 3" stepper is at the top of the signup card, its track and discs matching
  the mockup
- `/auth/signin` is pixel-unchanged from Phase 2, and so is `/auth/confirm-email` —
  including the wider card Phase 2 item 6 gave it (this phase touches neither)

---

## Phase 4: Background decoration, per screen (RC4)

### Overview

Replace the three outline SVGs shared by every page with the mockups' own soft-3D
decoration sets, one per screen.

### Changes Required:

#### 1. The decoration contract stays, its content changes

**Files**: `src/components/auth/AuthShell.astro`, `src/pages/auth/confirm-email.astro`,
plus a per-screen decoration slot

**Intent**: `AuthShell` lays down one decoration layer shared by four routes, but the
mockups scatter different objects on each. Give the layer a slot with screen 01's set as
fallback, the same shape Phase 3 gave the panel.

**Contract**: every decoration keeps all five rules — `aria-hidden="true"`, `alt=""`,
`pointer-events-none`, `hidden lg:block`, `z-0` against the content's `z-10` (never
`-z-10`, which hides the layer behind the container's own painted background) — inside a
container with `overflow-hidden`. Nothing may overlap a control's hit area.

#### 2. Per-screen sets

**Intent**: place each screen's cutouts where its mockup draws them.

**Contract** (positions are the mockups', to be matched within ~±16 px):

- **01 `/auth/signin`**: `decor-dotted-arrow` top-centre-left (x ≈ 490–830, y ≈ 95–175);
  `decor-signin-chart` behind it (x ≈ 740–840, y ≈ 150–245); `decor-coin` floating
  (x ≈ 665–730, y ≈ 290–355); `decor-signin-security` top-right (x ≈ 1290–1490, y ≈ 20–140);
  `decor-coin-stack` bottom-right (x ≈ 1390–1500, y ≈ 900–1000); a second
  `decor-signin-chart` bottom-centre (x ≈ 960–1100, y ≈ 930–1010).
- **02 `/auth/signup`**: `decor-signup-cloud` top-centre-left; `decor-signup-chart` and
  `decor-signup-backpack` on the right shelf; `decor-signup-coins` right-middle;
  `decor-signup-zl` bottom-right.
- **03 `/auth/confirm-email`**: `decor-verify-path` top-centre; `decor-verify-envelope`
  and `decor-verify-chart` left; `decor-verify-plant` bottom-left;
  `decor-verify-shield`, `decor-verify-document`, `decor-verify-coins` and
  `decor-verify-books` right. These replace the current wireframe corner art entirely.
- **04 `/auth/reset-password`** (+ `update-password`): `decor-reset-shield-bg` behind the
  panel hero as a watermark; `decor-reset-envelope` top-left; `decor-reset-plant` and
  `decor-reset-coins` bottom-left; `decor-reset-chart` top-right;
  `decor-reset-coin-stack` bottom-right; `decor-reset-plane` beside the card hero.

### Success Criteria:

#### Automated Verification:

- Unit suite passes: `npm run test`
- Lint passes: `npm run lint`; type/astro check passes: `npm run check`
- E2E suite green: `npm run test:e2e` → "1 skipped, 32 passed"
- The no-scroll test from Phase 2 still passes on all four routes (decoration is the
  classic cause of a stray scrollbar)

#### Manual Verification:

- Each of the four routes matches its mockup's decoration placement at 1536×1024
- No decoration intercepts a click: every field, button and link on all four routes is
  reachable and focusable
- No decoration shows a keying hole against the page background
- Below `lg` no decoration renders at all

---

## Phase 5: Screen 05 — `/app/new-profile` as one screen with onboarding chrome

### Overview

The three-step wizard becomes the mockup's single screen: page chrome (brand, step chip,
preview sidebar), one card with the onboarding stepper and two columns, and a footer with
one forward action. Structural — it rewrites a React component under e2e coverage and its
spec moves with it.

### Changes Required:

#### 1. Screen 05 art

**Files**: `public/illustrations/auth/`, `public/avatars/`, `public/illustrations/slice-map.md`

**Contract**: copy from `05-child-profile-extracted/png/cutouts/`:
`notice-shield-icon.png` (40×35), `level-starting-icon.png` (80×74, **holed** — card only),
`top-profile-avatar.png` (89×85), `decor-profile-coins.png` ← `decor-left-coins.png`
(150×120), `decor-profile-star-shield.png` ← `decor-left-star-shield.png` (30×33),
`decor-profile-chart.png` ← `decor-right-chart.png` (129×143),
`decor-profile-checklist.png` ← `decor-right-checklist.png` (129×130),
`decor-profile-plant.png` ← `decor-right-plant.png` (186×195). Register all rows.

#### 2. The fifth avatar

**Files**: `public/avatars/<id>.png` (new), `src/data/avatars.ts`,
`public/avatars/slice-map.md`

**Intent**: the mockup's avatar row has five faces; the product ships four because the
fifth is drawn wearing its selection ring and check badge, and the extraction's
`avatar-boy-selected.png` has the same chrome plus keying holes.

**Contract**: cut the fifth face from `05-child-profile-web.png` using the recipe
`public/avatars/slice-map.md` already documents (139 px white disc, 140×140 crop centred
on the face, mask to the disc), painting out the overlapping check badge; record it as the
**second edited asset** in this change, with its crop box, beside the `hero-reset.png`
note. Append it to `AVATARS` — never insert: `AVATAR_IDS` and stored `child_profiles.avatar`
values must stay stable. Purely additive; `createSchema` in `src/pages/api/profiles/create.ts` picks it up
from the derived list.

#### 3. Page chrome

**File**: `src/pages/app/new-profile.astro`

**Intent**: the mockup frames the card with app chrome the route does not have.

**Contract**: brand row top-left (`size="sm"`); top-right a "Nowy profil / Krok 2 z 3" chip
with `top-profile-avatar.png` and a progress bar; a left preview sidebar of app nav (Start,
Zadania, Mój sklep, Postępy, Nagrody, Światy, Panel rodzica) rendered **static and
non-navigating** with `aria-hidden="true"` on the nav (open decision 3's default) using the
extraction's `nav-*.svg` glyphs inlined as Group B icons; the screen 05 decoration set under
the Phase 4 contract. **The mockup's "126 zł" wallet chip is NOT built** — no wallet exists
before a profile does, and a fabricated balance is a false statement about the product, not
a visual detail. Record the omission in the page header.

#### 4. The wizard collapses to a form

**File**: `src/components/child/CreateProfileWizard.tsx` → `CreateProfileForm.tsx`

**Intent**: three steps become one screen (open decision 6's default: follow the mockup);
"Podsumowanie" and its recap disappear with it.

**Contract**: one `<form>`, unchanged POST to `/api/profiles/create` with the same four
fields — no route, schema or validation change. `OnboardingStepper current={2}` at the top.
Two columns split by a vertical rule:
- left — `<h1>` `t.profileWizard.title`, subtitle, "Imię dziecka" field, "Wiek" as a
  **native `<select>`** with the calendar glyph and chevron (`t.profileWizard.agePlaceholder`
  "Wybierz wiek" already exists, written for exactly this control), the five avatars as
  ~76 px circles, and the privacy notice strip with `notice-shield-icon.png`;
- right — "Zainteresowania" as world tiles at the mockup's ~200×175, and the "Poziom
  startowy" info card with `level-starting-icon.png` (holed — it is on `bg-card`, which is
  where it must stay).
Footer above a top border: the reassurance line with a shield glyph, and one primary
`t.profileWizard.next` ("Dalej →") as the submit. Validation stays client-side UX over a
server that re-validates; errors render per field as today.

Retire the `t.profileWizard` keys the collapse orphans (`steps`, `back`, `reviewIntro`,
`create`, `creating`, `stepProgress` if unused) — `npm run check` plus a grep is the guard.

#### 5. Tile variant

**File**: `src/components/child/SelectTile.tsx`

**Intent**: mockup 05 draws the label INSIDE the tile on a white bar with the image
full-bleed; today's tile puts the label below and pads the image. `WorldPicker.tsx` shares
this component and is out of scope.

**Contract**: add a variant (e.g. `labelPlacement: "below" | "inside"`, default `"below"`)
so `WorldPicker` is untouched. Selected state keeps `CheckBadge` — the impl-review already
recorded it as the better outcome than the extraction's badge, and it is the mockup's blue
circular tick either way.

#### 6. The spec moves with the screen

**File**: `e2e/onboarding.spec.ts`

**Intent**: the spec drives two "Dalej" clicks and a review step that no longer exist.

**Contract**: one-screen flow — fill the name, `selectOption` the age, click the avatar by
its `alt`, click the world by name, click "Dalej", land on `/app/start`. Keep the
`getByRole("heading", { name: t.profileWizard.title })` assertion (`e2e/smoke.spec.ts`'s
zero-profiles case uses it too — today around `:89`, anchor on the string). Do not weaken
the assertions to make the rewrite easy: the spec must still fail if the POST stops
carrying any of the four fields.

**Also**: call `expectFitsAt1536(page)` (Phase 2 item 7) once the form is on screen, before
filling it. This is the only automated check that `/app/new-profile` — which this phase
grows from a three-step card into a 1098×839 composition with sidebar, chip and footer — is
still a single-viewport screen. It is an assertion inside the existing test, not a new
test, so the suite count stays at "1 skipped, 32 passed".

### Success Criteria:

#### Automated Verification:

- Unit suite passes: `npm run test` — including any avatar-registry assertions
- Lint passes: `npm run lint`; type/astro check passes: `npm run check`
- E2E suite green: `npm run test:e2e` → "1 skipped, 32 passed"
- No orphaned i18n: `grep -rn "profileWizard\." src e2e` shows a consumer for every
  surviving key
- A profile created through the new form appears with the right name, age, avatar and
  world (the spec asserts the start screen's greeting)
- `/app/new-profile` fits 1536×1024 without scrolling (`expectFitsAt1536` in the rewritten
  `e2e/onboarding.spec.ts`), and that assertion fails when the composition is made taller

#### Manual Verification:

- `/app/new-profile` at 1536×1024 matches `05-child-profile-web.png` region for region:
  card 1098×839 at (263,123), sidebar, step chip, stepper, two columns, footer
- Five avatars, the fifth carrying no baked selection chrome and no keying hole
- The age select opens and commits a value; keyboard-only completion of the whole form
  works
- The preview sidebar is not focusable and is not announced
- Contrast probe ≥4.5:1 on the stepper, the notice strip and the level card

---

## Phase 6: Screen 06 — `/app/parent-pin` as the full onboarding screen

### Overview

The biggest structural gap: one small card becomes the mockup's page — sidebar with the
step list and the "Bezpieczna nauka" card, a top stepper card, a segmented PIN card, a
static "Bezpieczne ustawienia" panel and a three-action footer.

### Changes Required:

#### 1. Screen 06 art

**Files**: `public/illustrations/auth/`, `public/illustrations/slice-map.md`

**Contract**: copy from `06-parent-pin-security-extracted/png/cutouts/`:
`sidebar-safe-learning-house.png` (235×123), `setting-no-ads-icon.png`,
`setting-age-icon.png`, `setting-weekly-report-icon.png`,
`setting-difficulty-icon.png` (75×~71 each), `decor-pin-path.png` ←
`decor-dotted-path.png` (185×105), `decor-pin-coins-chart.png` ← `top-coins-chart.png`
(226×95), `decor-pin-shield.png` ← `top-security-shield.png` (145×135, **holed** — give it
a soft backdrop or drop it if the holes read at 1536×1024; record whichever). `hero-pin.png`
is already committed and keys cleanly.

**Also retire here**, now that nothing renders them: `coin.svg`, `coin-stack.svg`,
`decor-chart.svg`, `decor-receipt.svg`, `decor-path.svg`, and their `DECOR_*` constants.

#### 2. Page composition

**File**: `src/pages/app/parent-pin.astro`

**Contract**: a left sidebar (brand row, a three-item step list — 1 Utwórz konto ✓ /
2 Profil dziecka ✓ / 3 Bezpieczeństwo active — and the "Bezpieczna nauka" card with
`sidebar-safe-learning-house.png`), a centred stepper card with
`OnboardingStepper current={3}`, the heading "Zabezpiecz panel rodzica" with its subtitle,
the two-column area, the footer bar, and the decoration set under the Phase 4 contract.

**This heading is an i18n change, not a literal, and it is load-bearing for the suite.**
`t.parentPin.setHeading` changes value from "Ustaw PIN rodzica" to "Zabezpiecz panel
rodzica", and a new `t.parentPin.setSubtitle` carries the mockup's second line — no string
is typed into the `.astro` (L-003). `e2e/helpers/parent-pin.ts` asserts
`getByRole("heading", { name: t.parentPin.setHeading })`, so it resolves through the
dictionary and follows the change for free; item 6 covers what does not.
The step list is static preview chrome (open decision 3): `aria-hidden` on the list, no
links. **This composition is SET mode only** — the mockup draws no enter mode. In enter
mode the route keeps a single centred card, restyled to the same vocabulary (hero in a
disc, mockup-scale controls), which is what a returning parent sees. **Enter mode uses the
same segmented PIN control as set mode**, with one group instead of two — one input model
in the product, not two, and a returning parent should not meet a different widget from the
one they set the PIN with. That decision is what makes item 6's spec rewrite reach the four
enter-mode call sites in `e2e/parent-surfaces.spec.ts`, not just the set-mode ones.

#### 3. The PIN card

**File**: `src/components/parent/ParentPinGate.tsx`

**Intent**: one free-text input becomes the mockup's digit boxes, without regressing the
product's 4–6 digit contract (open decision 5's default).

**Contract**: `hero-pin.png` in a `bg-primary/10 rounded-full` disc; "Wpisz 4 cyfry" over a
segmented control of **four boxes that grow to six as the user types**; "Potwierdź PIN"
over a second identical control; the info strip below. Each box is an `<input
inputMode="numeric" maxLength={1}>` with auto-advance, backspace-to-previous and paste
spreading across boxes; the group is a `<fieldset>` whose `<legend class="sr-only">` is
`t.parentPin.pinLabel` / `confirmLabel`, each box carrying its own `aria-label` ("Cyfra N").
**The legend is the only thing that disambiguates a box**: "Cyfra 1" is rendered twice on
the set-mode screen, so a bare `getByLabel("Cyfra 1")` is ambiguous by construction. Every
locator goes through the group — `page.getByRole("group", { name: <legend> })` — which is
what item 6's `fillPin(scope, …)` signature exists to enforce. Enter mode renders exactly
this control with a single group (item 2).
Submission still posts the joined string to the same server-authoritative routes and the
same `/^\d{4,6}$/` client guard runs before it. **The PIN never touches the URL.**

#### 4. The settings panel

**File**: same component (or a sibling under `src/components/parent/`)

**Intent**: mockup 06's four toggles describe guarantees, not settings — no backing
preferences exist (open decision 4's default).

**Contract**: a `role="list"` of four rows, each with its 3D icon, title and body from
`t.parentPin.settings[]`, and a **decorative** toggle: an `aria-hidden` span styled as an
"on" switch. No `<button>`, no `<input>`, nothing focusable — a disabled real control
would promise a setting the product does not have. Add a note flagging it to the PRD if it
should ever become real.

#### 4b. The label-collision guard for the new copy

**File**: `tests/marketing-labels.test.ts`

**Intent**: this phase pours roughly a dozen new strings into `t.parentPin` — four settings
titles and four bodies (item 4), three footer actions (item 5), a changed `setHeading`, a
new `setSubtitle`, and "Cyfra N". That namespace carries a standing warning in
`src/i18n/pl.ts` for exactly this reason: "The three labels must stay mutually
non-substring: Playwright's getByLabel matches substrings" (L-007). Nothing else in the
phase looks.

**Contract**: extend the existing collision check to `t.parentPin` — assert that no new
string is a substring or a superstring of `pinLabel`, `confirmLabel`, `currentPinLabel`,
`newPinLabel`, `newPinConfirmLabel`, `setSubmit` or `enterSubmit`, in **both** directions.
Phase 3 already routes its panel copy through this file; this is the same guard applied to
the namespace that actually has substring-matching locators pointed at it.

#### 5. The footer

**Contract**: three actions — "← Wróć" (ghost, back to `/app/new-profile`), "Pomiń na
razie" (outline, → `/app/start`: skipping means simply not setting a PIN yet, which is a
real and safe state since the gate only guards `/app/report`), and "Zakończ konfigurację"
(primary, shield glyph) as the form's submit. Copy into `t.parentPin` — the back and skip
actions as new keys, and the primary as a **changed value for `t.parentPin.setSubmit`**
("Ustaw PIN" → "Zakończ konfigurację") rather than a sixth button label, because
`e2e/helpers/parent-pin.ts` clicks `getByRole("button", { name: t.parentPin.setSubmit })`
and that is the same button. `enterSubmit` ("Otwórz panel") is untouched — enter mode keeps
its own single action.

#### 6. The specs move with the screen

**Files**: `e2e/helpers/parent-pin.ts`, `e2e/parent-surfaces.spec.ts`
(`e2e/parent-weekly-report.spec.ts` also imports `setPinAndLandOnReport` and inherits the
rewrite — it is listed so the blast radius is on the page, not so it is edited)

**Intent**: three separate things move at once, and only the first is obvious.
`getByLabel(pinLabel).fill(pin)` cannot drive a segmented control. But item 2 also changes
`t.parentPin.setHeading`'s value and item 5 changes `t.parentPin.setSubmit`'s, and
`setPinAndLandOnReport` both asserts on the heading and clicks the submit. Those two
resolve through `t`, so they follow the dictionary rather than breaking — **verify that
rather than assuming it**: the helper must still land on `/app/report`, and the
Playwright run is the proof.

**Contract**: a shared `fillPin(scope, legend, pin)` helper that resolves
`scope.getByRole("group", { name: legend })`, focuses its first box and types the digits,
used by both files. It replaces **six** call sites, not two: the two set-mode fills in the
helper and the four enter-mode `getByLabel(t.parentPin.pinLabel).fill(...)` calls in
`e2e/parent-surfaces.spec.ts` (wrong-PIN, correct-PIN, and both halves of the change-PIN
flow), because item 2 puts the same segmented control in enter mode.
`t.parentPin.currentPinLabel` / `newPinLabel` / `newPinConfirmLabel` on the report page's
`ChangePinSection` are NOT segmented and keep their `getByLabel` calls — that component is
out of scope. **Keep the six-digit case** — one of the existing
tests sets a six-digit PIN and it is the reason the grow-to-six behaviour exists. Keep the
wrong-PIN and change-PIN assertions unchanged in meaning.

**Also**: `setPinAndLandOnReport` calls `expectFitsAt1536(page)` (Phase 2 item 7) while the
set-mode gate is on screen, before it fills anything — the only automated check that
`/app/parent-pin`, which this phase grows from one small card into a five-region page, is
still a single-viewport screen. An assertion inside the existing helper, not a new test, so
the suite count stays at "1 skipped, 32 passed".

### Success Criteria:

#### Automated Verification:

- Unit suite passes: `npm run test` — `tests/parent-pin*.test.ts` unchanged and green (they
  exercise `src/lib/services/parent-pin`, not the component, so this phase cannot move
  them), and `tests/marketing-labels.test.ts` covers every new `t.parentPin` string in both
  substring directions
- Lint passes: `npm run lint`; type/astro check passes: `npm run check`
- E2E suite green: `npm run test:e2e` → "1 skipped, 32 passed", including the six-digit PIN
  path and the wrong-PIN throttle
- No decor SVG remains: `ls public/illustrations/auth/*.svg` lists only `badge-check.svg`
  and the four world glyphs
- `/app/parent-pin` in set mode fits 1536×1024 without scrolling (`expectFitsAt1536` in
  `e2e/helpers/parent-pin.ts`), and that assertion fails when the page is made taller

#### Manual Verification:

- `/app/parent-pin` in set mode at 1536×1024 matches `06-parent-pin-security-web.png`:
  sidebar, stepper card, PIN card (353,300–868,843), settings panel, footer bar
- Typing four digits fills four boxes; a fifth digit grows the control; backspace walks
  back; pasting "123456" spreads across six
- Keyboard-only: tab reaches both PIN groups, the three footer actions, and nothing inside
  the settings panel
- Enter mode (returning parent) still works and looks like the same product
- Contrast probe ≥4.5:1 on the settings rows, the step list and the footer buttons

---

## Phase 7: The mobile pass at 390×844

### Overview

Every phase so far was verified at 1536×1024. Screens 05 and 06 are new compositions with
no mobile treatment at all, and phases 2–4 moved sizes that the phone layout inherits. This
phase runs the same region-by-region pass against `assets/matmaverse-auth-v2-mobile/`.

### Changes Required:

#### 0. Measure the mobile mockups first — they are NOT 1:1 with CSS pixels

**Files**: none (a measurement pass, recorded in this section)

**Intent**: every desktop phase works against a PIL-measured region table, and that is why
its Manual rows can say "within ±8 px" instead of "looks right". This phase had no such
table, which left row 7.4 ("matches region for region") with nothing to match against.

**The trap that makes this mandatory.** The desktop mockups are 1536×1024 — the same
numbers as the viewport, so a measured pixel IS a CSS pixel. The mobile set is not:

| File | Actual px | CSS px at 390×844 |
| --- | --- | --- |
| `01-parent-login-mobile.png` … `05-child-profile-mobile.png` | **853 × 1844** | ÷ ~2.187 |
| `06-parent-pin-security-mobile.png` | **862 × 1825** | ÷ ~2.19 → ≈ 394 × 833 |

853 / 390 = 2.187 and 1844 / 844 = 2.185: these are 390×844 renders at roughly **2.19×**
device pixels. Measure one and apply it directly and the phone layout comes out at more
than twice mockup scale. Divide every measurement by the per-file factor before it enters a
class name, and record the factor beside the table.

**Contract**: before touching a component, produce a region table per screen in the same
shape as the desktop one in "Current State Analysis" — card box, field height, primary
button height, and the vertical order of the regions — in **CSS pixels**, and paste it into
this section. All six mobile mockups exist, screens 05 and 06 included, so nothing here is
blocked on a missing asset.

#### 1. Per-screen phone layout

**Files**: `src/components/auth/AuthShell.astro`, `src/components/auth/FormField.tsx`,
`src/components/auth/SubmitButton.tsx`, `src/components/marketing/{SignupPanel,ResetPanel,
FeatureList,TrustBadges,BrandRow}.astro`, `src/components/onboarding/OnboardingStepper.tsx`,
`src/components/child/{CreateProfileForm,SelectTile}.tsx`,
`src/components/parent/ParentPinGate.tsx`, and the six routes under `src/pages/auth/` and
`src/pages/app/`

**Contract**: below `lg` no decoration renders (already the contract); the preview sidebars
and the desktop-only chrome on 05/06 are hidden; 05's two columns stack; 06's PIN and
settings cards stack and the footer's three actions wrap; cards drop to `p-6` and
`rounded-3xl`; fields and buttons keep a comfortable touch height. Exactly one `<h1>` per
route at 390 (L-007) — including the known screen 01 case where `AuthShell`'s hero is
hidden below `lg` and the card's heading carries the words.

#### 2. The mobile hero question, settled

**Intent**: `change.md` flagged screen 01's mobile hero as unresolved because the fix would
have to be applied to all four `AuthShell` routes at once and mockups 02/04's phone layouts
had not been checked. This phase checks them.

**Contract**: decide per the mobile mockups whether the hero heading moves above the card
below `lg`; whichever way, apply it to all four routes together and keep exactly one `<h1>`
per viewport.

### Success Criteria:

#### Automated Verification:

- Unit suite passes: `npm run test`; lint and check pass
- E2E suite green including the `[touch]` project: `npm run test:e2e` → "1 skipped, 32
  passed" (the skip is `marketing-worlds.spec.ts [touch]`, by design)
- No horizontal scroll at 390 on any of the six routes

#### Manual Verification:

- Each of the six routes at 390×844 matches its `0N-*-mobile.png` within ±8 **CSS** px of
  the item 0 region table (the mockups are ~2.19× renders — compare against the divided
  numbers, never the raw ones)
- No desktop-only chrome (sidebars, step chip, decoration) leaks into the phone layout
- Every control is a comfortable tap target and nothing overlaps

---

## Testing Strategy

### Unit tests

- `tests/auth-art.test.ts` — every registered path exists, is served from
  `/illustrations/`, carries no id/gradient (SVGs), and every world slug resolves to a
  glyph that exists or to the documented fallback.
- `tests/marketing-labels.test.ts` — the new panel and settings strings do not collide by
  substring with anything already on the same page (L-007), and `brandParts` concatenates
  to `t.brand`.
- Existing `tests/parent-pin*.test.ts` and profile tests must pass untouched — phases 5
  and 6 change presentation, not the server contract.

### E2E

- The Phase 2 no-scroll test at 1536×1024 across the four public auth routes.
- The rewritten `e2e/onboarding.spec.ts` one-screen profile flow.
- The rewritten PIN fill helper, exercised through the existing set / wrong / change flows,
  including the six-digit case.

### Manual

The acceptance bar is region-by-region parity, not vibes. Per phase:

1. Dev server on `:4321` (the e2e global setup rejects a toolbar-serving stray server —
   `ASTRO_DEV_TOOLBAR_DISABLED`).
2. Sign in as `rodzic@mathshop.test` / `haslo123`, PIN `1234`.
3. Screenshot each affected route at 1536×1024 (and, in Phase 7, 390×844) and compare
   side-by-side with `assets/matmaverse-auth-v2-{web,mobile}/0N-*.png`.
4. Re-run `.playwright-mcp/verify.mjs` and confirm its positive control before trusting a
   ratio.

The sandbox blocks localhost: `npm run test`, `npm run test:e2e` and any `curl` at `:4321`
need the override. `lint` and `check` do not.

## Migration Notes

One data change in the whole plan: a fifth entry appended to `AVATARS` (Phase 5). It is
additive, the column is a bare `text`, validation derives from the array, and existing
rows keep their values. Nothing else touches the schema, the API contracts or the routes.

## References

- Specification: `context/changes/auth-visual-fidelity/fidelity-gaps.md`
- Implementation notes and traps: `context/changes/auth-visual-fidelity/change.md`
- The landed first plan: `context/changes/auth-visual-fidelity/plan-2026-08-29-initial.md`
- Audit screenshots: `.playwright-mcp/fidelity-audit-2026-09-04/` (gitignored)
- Mockups: `assets/matmaverse-auth-v2-{web,mobile}/` (local only)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: The soft-3D art lands, the flat set retires (RC1)

#### Automated

- [ ] 1.1 Unit suite passes: `npm run test`
- [ ] 1.2 Lint passes: `npm run lint`
- [ ] 1.3 Type/astro check passes: `npm run check`
- [ ] 1.4 E2E suite green: `npm run test:e2e` → "1 skipped, 31 passed"
- [ ] 1.5 No code path resolves under `assets/`
- [ ] 1.6 Retired SVGs are gone from `public/illustrations/auth/`

#### Manual

- [ ] 1.7 `/auth/signin` shows soft-3D feature icons, brand mark and the laurel-leaf hero
- [ ] 1.8 The wordmark reads "Matma" blue + "Verse" green as one word
- [ ] 1.9 No keying-hole rectangle on any of the four auth routes
- [ ] 1.10 Contrast probe ≥4.5:1 on the green wordmark half and every prior label

### Phase 2: Scale and density — the composition fits 1536×1024 (RC2)

#### Automated

- [ ] 2.1 Unit suite passes: `npm run test`
- [ ] 2.2 Lint passes: `npm run lint`
- [ ] 2.3 Type/astro check passes: `npm run check`
- [ ] 2.4 E2E suite green: `npm run test:e2e` → "1 skipped, 32 passed"
- [ ] 2.5 The no-scroll test fails when reverted (computed style confirmed first)

#### Manual

- [ ] 2.6 `/auth/signin` and `/auth/confirm-email` match their region boxes within ±8 px
- [ ] 2.7 Six worlds in one row, images full-bleed, each label carrying a glyph
- [ ] 2.8 No route scrolls vertically or horizontally at 1536×1024
- [ ] 2.9 Contrast probe still ≥4.5:1 everywhere it was before

### Phase 3: Screens 02 and 04 get their own left panels (RC3)

#### Automated

- [ ] 3.1 Unit suite passes: `npm run test`
- [ ] 3.2 Lint passes: `npm run lint`
- [ ] 3.3 Type/astro check passes: `npm run check`
- [ ] 3.4 E2E suite green: `npm run test:e2e` → "1 skipped, 32 passed"
- [ ] 3.5 Exactly one `<h1>` per route at 1536 and at 390

#### Manual

- [ ] 3.6 `/auth/signup` matches mockup 02's panel — callout, three rows, desk hero, no world grid
- [ ] 3.7 `/auth/reset-password` puts the big hero in the panel and three white cards below
- [ ] 3.8 The "Krok 1 z 3" stepper heads the signup card
- [ ] 3.9 `/auth/signin` and `/auth/confirm-email` unchanged from Phase 2 (03 keeps its
      Phase 2 item 6 width)

### Phase 4: Background decoration, per screen (RC4)

#### Automated

- [ ] 4.1 Unit suite passes: `npm run test`
- [ ] 4.2 Lint passes: `npm run lint`
- [ ] 4.3 Type/astro check passes: `npm run check`
- [ ] 4.4 E2E suite green: `npm run test:e2e` → "1 skipped, 32 passed"
- [ ] 4.5 The Phase 2 no-scroll test still passes on all four routes

#### Manual

- [ ] 4.6 Each of the four routes matches its mockup's decoration placement
- [ ] 4.7 No decoration intercepts a click; every control is reachable and focusable
- [ ] 4.8 No decoration shows a keying hole against the page background
- [ ] 4.9 No decoration renders below `lg`

### Phase 5: Screen 05 — `/app/new-profile` as one screen with onboarding chrome

#### Automated

- [ ] 5.1 Unit suite passes: `npm run test`
- [ ] 5.2 Lint passes: `npm run lint`
- [ ] 5.3 Type/astro check passes: `npm run check`
- [ ] 5.4 E2E suite green: `npm run test:e2e` → "1 skipped, 32 passed"
- [ ] 5.5 No orphaned `t.profileWizard.*` key remains
- [ ] 5.6 A profile created through the new form lands with the right name, age, avatar, world
- [ ] 5.7 `/app/new-profile` fits 1536×1024 without scrolling (`expectFitsAt1536`), and the assertion fails when the composition is made taller

#### Manual

- [ ] 5.8 `/app/new-profile` matches mockup 05 region for region
- [ ] 5.9 Five avatars, the fifth free of baked selection chrome and keying holes
- [ ] 5.10 The age select commits a value; keyboard-only completion works
- [ ] 5.11 The preview sidebar is neither focusable nor announced
- [ ] 5.12 Contrast probe ≥4.5:1 on stepper, notice strip and level card

### Phase 6: Screen 06 — `/app/parent-pin` as the full onboarding screen

#### Automated

- [ ] 6.1 Unit suite passes: `npm run test` — including the new `t.parentPin` collision assertions
- [ ] 6.2 Lint passes: `npm run lint`
- [ ] 6.3 Type/astro check passes: `npm run check`
- [ ] 6.4 E2E suite green including the six-digit PIN and the wrong-PIN throttle
- [ ] 6.5 No decor SVG remains in `public/illustrations/auth/`
- [ ] 6.6 `/app/parent-pin` in set mode fits 1536×1024 without scrolling (`expectFitsAt1536`), and the assertion fails when the page is made taller

#### Manual

- [ ] 6.7 `/app/parent-pin` in set mode matches mockup 06 region for region
- [ ] 6.8 Digit boxes: type, grow to six, backspace, paste
- [ ] 6.9 Keyboard-only reaches both PIN groups and the three footer actions, and nothing in the settings panel
- [ ] 6.10 Enter mode still works and reads as the same product
- [ ] 6.11 Contrast probe ≥4.5:1 on settings rows, step list and footer buttons

### Phase 7: The mobile pass at 390×844

#### Automated

- [ ] 7.1 Unit suite passes: `npm run test`; lint and check pass
- [ ] 7.2 E2E suite green including `[touch]`: "1 skipped, 32 passed"
- [ ] 7.3 No horizontal scroll at 390 on any of the six routes

#### Manual

- [ ] 7.4 Each of the six routes matches its `0N-*-mobile.png` within ±8 CSS px of the item 0 region table
- [ ] 7.5 No desktop-only chrome leaks into the phone layout
- [ ] 7.6 Every control is a comfortable tap target and nothing overlaps
