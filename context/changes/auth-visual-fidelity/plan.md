# Auth Visual Fidelity Implementation Plan

## Overview

The six auth/onboarding screens were built to the right **structure** but the wrong
**texture**. Every region of the mockups is present — brand row, hero, feature blocks,
world strip, cards, security footer — yet the illustrated art the designs lean on was
substituted with 20 px flat `lucide` glyphs, the feature blocks carry card chrome the
desktop designs do not have, the form fields use a different field model, and none of
the ambient background depth exists.

**This plan was revised on 2026-08-29, mid-flight, after Phases 1–2 had already landed.**
Phase 1 sourced its art from `assets/atomic-assets-v3/` and `assets/atomic-assets-v2/`.
That art is rejected. The maintainer has since produced a **per-screen extraction** —
`assets/matmaverse-auth-v2-web/` — with one `*-extracted/` folder per mockup plus a
shared atom set in `00-shared-auth-assets/`. That extraction is now the single source of
truth for graphic atoms, and the scope grew from one screen to all six.

The revision reopens Phase 1 (the atom set is swapped wholesale, its register corrected,
its test rewritten), keeps landed Phase 2 (the shared marketing components are structurally
right; only the paths they read change, and those live behind `src/data/marketing-art.ts`),
re-points Phases 3–4 at the new atoms, and appends one phase per remaining screen.

## Current State Analysis

**Phase 1 shipped six SVGs from the wrong pack.** `public/illustrations/{brand-symbol,
feature-safety,feature-worlds,feature-progress,parent-lock,decor-chart}.svg` came from
`assets/atomic-assets-v2/svg/` (commit `8850b18`). They are generic atomic-pack glyphs,
not the art in these six mockups. All six are retired by this revision. `slice-map.md`'s
section "Signed-out surface art (auth-visual-fidelity) — 2026-08-29" describes them and
must be corrected, not appended to — leaving it would make the register describe files
that no longer exist.

**Phase 2 is structurally sound and stays landed.** `BrandRow.astro`, `FeatureList.astro`
and `SecurityNote.astro` exist, both `AuthShell.astro` and `Welcome.astro` consume them,
and no surface hardcodes an art path — every path resolves through
`src/data/marketing-art.ts`. That indirection is what makes the atom swap cheap: repointing
the constants re-dresses both surfaces with no markup edit. Two sizing constants in those
components were tuned to the *old* art's viewBox fill and must be re-tuned in the same
breath (see Phase 1, item 6).

**The new extraction removes the constraint that forced `<img src>`.** The old plan
required every glyph to be an `<img>` because `shield-check.svg` and `lock-user.svg` both
declared `<linearGradient id="g">` and would collide in one document. **No SVG in
`00-shared-auth-assets/` declares any `id` at all** — verified across all 41 files. Better:
eleven of them are authored with `stroke="currentColor"` / `fill="currentColor"`
(`auth-email`, `auth-eye`, `auth-lock`, `auth-lock-filled`, `auth-user-plus`,
`checkbox-empty`). Those are UI icons that must take the surrounding text colour — as
`<img>` they would render black, because `currentColor` in a standalone SVG document has
no inherited colour to resolve against. So the set splits in two, and that split is the
central design decision of this revision (see "Critical Implementation Details").

**Screens 02–06 have thin breakdowns; screen 01's is the detailed one.** Only
`01-parent-login-extracted/docs/component-breakdown.md` carries layout, Polish copy,
breakpoints and a11y notes. The other five carry a component tree, an assets pointer and
"Screen Notes". For those five the binding sources are the flat `*-web.png` / `*-mobile.png`
mockups plus the shared atom manifest. Every one of them repeats the same rule: *"Build in
React/CSS: page grid, cards, shadows, borders, radii, all text and labels, form controls,
buttons, links, dividers, steppers, toggles and selected states."*

**Several PNG cutouts are keyed by removing near-white pixels, which knocks out white
content inside the illustration.** Composited on magenta, `hero-email-confirmation.png`
loses the white letter inside the envelope, `hero-reset-card-top.png` loses its white card,
`security-shield-card-icon.png` and `status-email-green.png` lose their interiors, and
`hero-parent-dashboard-desk.png` keeps a residual opaque background block. The holes are
invisible on a **white card** and visible on the pale-blue page background. This constrains
which cutouts are usable and where — and is the main reason this plan takes SVG wherever
the extraction offers both.

**The field model is a design-system concern, not a screen concern.** `FormField.tsx` backs
all four auth forms and mockups `01`, `02` and `04` use the identical field treatment (no
visible label, tall input, icon in the left gutter, eye toggle). Changing the shared
component is what the designs actually ask for.

**Fifteen e2e locators depend on field labels staying in the accessibility tree.**
`e2e/helpers/accounts.ts` (`signInViaUI`, used by nearly every spec),
`e2e/onboarding.spec.ts` and `e2e/password-reset.spec.ts` locate fields with
`page.getByLabel(t.auth.fields.*)`. `sr-only` preserves every one of them; `hidden` or
`aria-hidden` would break the suite wholesale.

**`e2e/parent-surfaces.spec.ts` pins the PIN field as one input.** It fills
`page.getByLabel(t.parentPin.pinLabel)` with a whole PIN string. Mockup `06` draws four
separate digit boxes. The product's PIN is 4–6 digits, the mockup's is exactly 4 — so the
mockup's control cannot represent the product's input. See "What We're NOT Doing".

**Two designed strings were never wired.** `t.auth.signin.noAccount` ("Nie masz konta?")
and `t.auth.signup.hasAccount` ("Masz już konto?") exist in `src/i18n/pl.ts` and are
referenced by nothing in `src/`. Both mockups' two-part secondary labels are what they
were written for.

## Desired End State

All six screens read as their mockups at 1536×1024 and at 390×844, dressed exclusively in
art taken from `assets/matmaverse-auth-v2-web/` and committed under
`public/illustrations/auth/` or inlined into `src/components/icons/`. No layout, card,
field, button, checkbox, stepper or toggle is built from an image. No code resolves a path
under `assets/`. Every committed file is registered in `public/illustrations/slice-map.md`
with its source path.

Verify by loading each route at both widths beside its `*-web.png` / `*-mobile.png`, and by
a green `npm run lint`, `npm run check`, `npm run test`, `npm run test:e2e`.

### Key Discoveries

- **No SVG in `00-shared-auth-assets/` declares an `id`** (verified across 41 files), so the gradient-id collision that forced `<img>`-only rendering in the old Phase 1 does not exist for the new set.
- **Six shared icons use `currentColor`** (`auth-email`, `auth-eye`, `auth-lock`, `auth-lock-filled`, `auth-user-plus`, `checkbox-empty`) — these must be inlined, not `<img>`'d, or they render black.
- **Five more are authored with a hardcoded stroke** (`auth-paper-plane` `#FFFFFF`, `auth-refresh` / `arrow-left` / `arrow-right` `#0B6EFF`, `chevron-right` `#1A8F2A`, `calendar-age` `#7EA2E8`). Inlining them and converting the literal to `currentColor` makes one icon family instead of two colour regimes.
- **`00-shared-auth-assets/` is the whole SVG supply.** `02`–`06`'s `svg/icons` and `svg/decor` directories are **empty**; those screens ship PNG cutouts only. Only `01-parent-login-extracted/svg/` has per-screen SVGs and they are byte-identical copies of the shared ones.
- **PNG cutouts are RGBA with real transparency, but keyed by near-white removal.** Clean: the feature glyphs, coins, brand mark, avatars, setting icons, `hero-pin-lock-shield.png`. Holed: `hero-email-confirmation.png`, `hero-reset-card-top.png`, `hero-reset-envelope-lock-large.png`, `security-shield-card-icon.png`, `status-email-green.png`, `next-child-profile-icon.png`, `level-starting-icon.png`, `top-security-shield.png`, `avatar-boy-selected.png`. Residual background: `hero-parent-dashboard-desk.png` (corner alpha 231, not 0).
- **`01-parent-login-extracted/css/design-tokens.css`** carries the palette (`--mm-color-primary: #126cf0`, `--mm-color-text: #08164f`, `--mm-color-green: #27b65b`, `--mm-color-yellow: #ffc43d`), radii (card 24 px, control 14 px), shadows and `--mm-login-card-width: 542px`. `src/styles/global.css` already samples the same palette in oklch; the two agree to within a hue step, so the theme is **mapped, not replaced** (see Phase 1, item 5).
- **`public/illustrations/coin.png` / `coin-stack.png` stay.** Four child-facing surfaces (`CoinBoard`, `HudChip`, `UpgradeShop`, `ShiftResults`) hardcode those paths. The auth decor moves to the extraction's SVG coins; the PNGs are untouched.
- **Unit baseline on this branch is 641 tests in 65 files** (measured 2026-08-29, `main`-parity). Deltas below are relative to that.
- **`e2e/growth.spec.ts` on `[touch]` fails on `main`** — pre-existing, not this change's. Green for this change reads "1 failed, 1 skipped, 30 passed".

## What We're NOT Doing

Every item here is a place the mockup and the product genuinely disagree. Each is a
decision, recorded so it does not get rediscovered as drift.

- **Not adding the cross-screen onboarding stepper** ("Krok 1/2/3 z 3" on mockups `02`, `05`, `06`). `/app/new-profile` already renders its **own** three-step stepper for a different three steps ("Dane dziecka / Avatar i świat / Podsumowanie"). Two steppers on one screen, both saying "Krok N z 3", is both a layout collision and an L-007 locator collision.
- **Not splitting the parent PIN into four digit boxes** (mockup `06`). The product's PIN is 4–6 digits; the mockup's control holds exactly 4. `e2e/parent-surfaces.spec.ts` fills the field as one string. The single field is restyled to the mockup's weight and tracking instead.
- **Not building mockup `06`'s "Bezpieczne ustawienia" list** (Brak reklam / Dostosowane do wieku / Raport tygodniowy / Kontrola poziomu trudności, each with a toggle). None of those four settings exists in the product. Rendering four always-on toggles would advertise controls that do nothing.
- **Not building the `05` / `06` left sidebar navigation.** Those are onboarding routes outside `AppShell`; adding a nav is a routing change, not a visual one.
- **Not adding mockup `02`'s terms-and-privacy checkbox.** There is no regulamin and no polityka prywatności page to link to.
- **Not changing the avatar set** (mockup `05` shows five faces; `src/data/avatars.ts` ships four). `avatar` ids are validated by zod on `/api/profiles/create`, stored in `child_profiles.avatar`, and `e2e/onboarding.spec.ts` locates `AVATARS[1].alt`. This is a data change, not a visual one.
- **Not reverting the world strip to the mockups' four cards**, nor swapping world art for the mockups' photo-real interiors. Six worlds in `grid-cols-3` is current and pinned by `e2e/marketing-worlds.spec.ts`.
- **Not renaming the brand to "MathMarket".** The wordmark stays `t.brand` ("MatmaVerse"); only the *symbol* is adopted.
- **Not adopting `nav-*.svg`, `world-*.svg`, `setting-*.svg` or `toggle-on.svg`** — the four groups above are the surfaces that would have consumed them.
- **Not adding Playwright visual-regression baselines.** Asset-existence tests plus Playwright-driven human comparison is the agreed bar.
- **Not touching `assets/`** — read-only, gitignored, never committed (`CLAUDE.md`).

## Implementation Approach

Nine phases. Phase 1 lands and pins every atom first, so every later phase references
paths and components that provably exist. Phase 2 is already landed and is not re-run.
Phases 3–4 finish screen `01` (field model, then card and composition) because they are the
widest blast radius — `FormField` backs four forms and fifteen e2e locators — and because
every later screen inherits them. Phases 5–9 are one per remaining screen, in mockup order,
each self-contained: a screen's phase touches its page, its i18n keys and nothing else.

Each screen phase ends with a Playwright comparison against both flat mockups at 1536×1024
and 390×844, with the screenshots written to the run's scratchpad.

## Critical Implementation Details

**The atom set splits into two groups, and the split is by colour authority, not by file
type.** An atom whose colours belong to the *design* is a committed file rendered as
`<img src>`; an atom whose colour belongs to the *context it sits in* is inlined as a React
component so `currentColor` resolves. Getting this backwards is what makes an email glyph
render black inside a blue tile.

- **Group A — illustrations, `public/illustrations/auth/*`, rendered `<img>`.** Fixed brand colours, decorative or illustrative, never recoloured by a consumer. Always `alt=""` + `aria-hidden="true"` unless it is the only thing naming its region.
- **Group B — UI icons, `src/components/icons/authIcons.tsx`, inlined.** Sized by `className`, coloured by the parent's `text-*`. Drop-in replacements for the `lucide` components they retire, same call shape.

**Group B must never gain an `id` or a gradient.** Inlining is only safe because these files
declare neither; SVG element ids are document-global and two inlined atoms sharing one would
silently cross-render. `tests/auth-art.test.ts` asserts this on the committed source, so the
day someone pastes in a gradient-bearing atom the guard fires instead of the page.

**Labels go `sr-only`, never `hidden`.** Fifteen e2e locators resolve fields through
`getByLabel`. `sr-only` clips the label visually while leaving it in the accessibility tree.
Any treatment that removes it from the tree takes the e2e suite down with it.

**Background decorations must not create horizontal overflow.** They are absolutely
positioned near the viewport edges; without `overflow-hidden` on each shell's outer
container an overhanging decoration makes the body scroll sideways at narrow desktop
widths. Every decoration is `aria-hidden="true"`, `pointer-events-none`, `hidden lg:block`,
and behind the content in stacking order.

**Holed cutouts go on white, never on the page background.** `hero-email.png` and
`hero-reset.png` have white interiors keyed out; they read correctly only on a `bg-card`
surface. Both are placed inside cards for exactly this reason, and the reason is recorded in
`slice-map.md` so a later move does not silently reintroduce the hole.

**New user-visible strings get an L-007 substring check before they land.** Several new
labels (trust-badge titles, panel headings) sit on screens that already render
`t.marketing.features[*].title`. A new string that contains — or is contained by — an
existing one makes an unrelated `getByText` ambiguous. Phase 5 ships the programmatic guard.

---

## Phase 1: The auth atom set, re-done from the per-screen extraction

### Overview

Retire the six atomic-pack SVGs, land the extraction's atoms in their two groups, correct the
provenance register, re-tune the two consumers whose sizing was fitted to the old art, and
rewrite the pinning test so it guards both groups.

### Changes Required:

#### 1. Retire the wrong art

**Files**: `public/illustrations/{brand-symbol,feature-safety,feature-worlds,feature-progress,parent-lock,decor-chart}.svg` (deleted)

**Intent**: These came from `assets/atomic-assets-v2/svg/` and are rejected. Deleting rather
than leaving them orphaned is what keeps `slice-map.md` honest.

**Contract**: All six removed. `public/illustrations/coin.png` and `coin-stack.png` are
**not** touched — `CoinBoard`, `HudChip`, `UpgradeShop` and `ShiftResults` hardcode them.

#### 2. Group A — committed illustrations

**File**: `public/illustrations/auth/` (new directory, 14 files)

**Intent**: Ship the extraction's fixed-colour art so it resolves on Vercel and in CI, where
`assets/` does not exist.

**Contract**: Copied byte-for-byte (SVG) or as-is (PNG) from
`assets/matmaverse-auth-v2-web/`. A subdirectory rather than the flat root because this is
one coherent set of fourteen and the root already holds four unrelated batches.

| Destination (`public/illustrations/auth/`) | Source (under `assets/matmaverse-auth-v2-web/`)              |
| ------------------------------------------ | ------------------------------------------------------------ |
| `brand-mark.svg`                            | `00-shared-auth-assets/svg/icons/brand-shop-basket-coin.svg`  |
| `feature-safety.svg`                        | `00-shared-auth-assets/svg/icons/feature-shield-check.svg`    |
| `feature-worlds.svg`                        | `00-shared-auth-assets/svg/icons/feature-globe.svg`           |
| `feature-progress.svg`                      | `00-shared-auth-assets/svg/icons/feature-child-progress.svg`  |
| `hero-parent-security.svg`                  | `00-shared-auth-assets/svg/icons/security-user-shield.svg`    |
| `badge-check.svg`                           | `00-shared-auth-assets/svg/icons/check-badge-blue.svg`        |
| `coin.svg`                                  | `00-shared-auth-assets/svg/icons/coin-zl.svg`                 |
| `coin-stack.svg`                            | `00-shared-auth-assets/svg/icons/coin-stack-zl.svg`           |
| `decor-chart.svg`                           | `00-shared-auth-assets/svg/decor/decor-chart-up.svg`          |
| `decor-receipt.svg`                         | `00-shared-auth-assets/svg/decor/decor-receipt-coins.svg`     |
| `decor-path.svg`                            | `00-shared-auth-assets/svg/decor/dotted-growth-path.svg`      |
| `hero-email.png`                            | `03-email-verification-extracted/png/cutouts/hero-email-confirmation.png` |
| `hero-reset.png`                            | `04-password-reset-extracted/png/cutouts/hero-reset-card-top.png` |
| `hero-pin.png`                              | `06-parent-pin-security-extracted/png/cutouts/hero-pin-lock-shield.png` |

#### 3. Group B — inline UI icons

**File**: `src/components/icons/authIcons.tsx` (new)

**Intent**: One icon family for every small glyph that must take its context's colour,
replacing the `lucide` components the auth surfaces use today. Inlining is what makes
`currentColor` resolve; an `<img>` of the same file renders black.

**Contract**: One named export per icon, each `({ className }: { className?: string })`
returning an `<svg>` with the source's exact `viewBox` and path data, `aria-hidden="true"`,
`focusable="false"`, and `className` applied to the root so `size-*` and `text-*` work — the
same call shape as the `lucide` icons they retire, so every swap is one-for-one.

Exports and sources (all under `00-shared-auth-assets/svg/icons/`):

| Export                | Source                | currentColor in source |
| --------------------- | --------------------- | ---------------------- |
| `AuthEmailIcon`       | `auth-email.svg`      | yes                    |
| `AuthLockIcon`        | `auth-lock.svg`       | yes                    |
| `AuthLockFilledIcon`  | `auth-lock-filled.svg`| yes                    |
| `AuthEyeIcon`         | `auth-eye.svg`        | yes                    |
| `AuthEyeOffIcon`      | `auth-eye.svg` + slash| derived — see below    |
| `AuthUserPlusIcon`    | `auth-user-plus.svg`  | yes                    |
| `AuthPaperPlaneIcon`  | `auth-paper-plane.svg`| no (`#FFFFFF`)         |
| `AuthRefreshIcon`     | `auth-refresh.svg`    | no (`#0B6EFF`)         |
| `AuthArrowLeftIcon`   | `arrow-left.svg`      | no (`#0B6EFF`)         |
| `AuthArrowRightIcon`  | `arrow-right.svg`     | no (`#0B6EFF`)         |
| `AuthChevronRightIcon`| `chevron-right.svg`   | no (`#1A8F2A`)         |
| `AuthCalendarIcon`    | `calendar-age.svg`    | no (`#7EA2E8`)         |
| `AuthShieldCheckIcon` | `feature-shield-check.svg` | no (`#39c66a`/`#fff`) |

**Two deliberate derivations, both recorded in the module's header:**

- The five hardcoded strokes become `currentColor`. Each source paints one literal colour that only suits the one place the mockup uses it; as `currentColor` the consumer sets it with a Tailwind `text-*` class and the mockup's colour is reproduced at the call site. This is how the `lucide` icons they replace already behaved.
- `AuthEyeOffIcon` has no source file — the extraction only draws the open eye, but `PasswordToggle` needs both states. It is `auth-eye.svg` plus one diagonal `<path>` at the source's own stroke weight, so the pair reads as one family. Mixing in a `lucide` `EyeOff` beside an extraction eye would not.

#### 4. The art manifest

**File**: `src/data/marketing-art.ts`

**Intent**: Keep the single module that owns every Group A path, so no surface hardcodes one
and so the atom swap is a one-file edit. Renamed constants would ripple into landed Phase 2
markup; the existing names are kept where the meaning survives.

**Contract**: `BRAND_SYMBOL` → `/illustrations/auth/brand-mark.svg`. `FEATURE_ICONS` → the
three `/illustrations/auth/feature-*.svg`, still index-aligned with `t.marketing.features`.
`PARENT_LOCK` → `/illustrations/auth/hero-parent-security.svg`. `DECOR_COIN` /
`DECOR_COIN_STACK` / `DECOR_CHART` repoint to the SVG coins and chart under `auth/`. New:
`DECOR_RECEIPT`, `DECOR_PATH`, `BADGE_CHECK`, `HERO_EMAIL`, `HERO_RESET`, `HERO_PIN`.
`MARKETING_ART` lists all of them. The module header's long "never inline the SVG" warning is
replaced: it described a hazard the new set does not have, and the real rule is now the
Group A / Group B split.

#### 5. Design tokens mapped onto the existing theme

**File**: `src/styles/global.css`

**Intent**: `01-parent-login-extracted/css/design-tokens.css` is the extraction's palette,
radii and shadows. Map it onto the theme so the values are reachable as Tailwind utilities —
do **not** scatter hex literals through components, and do **not** replace the oklch palette
that the whole app is already built on.

**Contract**: Compare token by token and change only where the extraction genuinely
disagrees with `:root`; record the comparison in a comment. Add what has no home yet: a
`--shadow-mm-card` (`0 24px 70px rgba(20,78,145,0.14)`) and `--shadow-mm-control`
(`0 12px 28px rgba(18,108,240,0.18)`) under `@theme inline` so the mockups' soft card lift
is one utility rather than a per-card guess, and `--mm-login-card-width: 542px` as the auth
card's max width. Existing `--radius: 0.875rem` (14 px) already equals the extraction's
control radius; the card radius (24 px) is the existing `rounded-3xl`. No component gets a
raw hex.

#### 6. Re-tune the two consumers fitted to the old art

**Files**: `src/components/marketing/BrandRow.astro`, `src/components/marketing/FeatureList.astro`

**Intent**: Both carry a sizing constant chosen for the *retired* art and a comment
explaining that choice. `FeatureList`'s header says the icons are `lg:size-20` because the
old SVGs "do not fill their 64-unit viewBox — the shield spans about 44 of it". The new
`feature-*.svg` fill theirs, so the same box now renders oversized.

**Contract**: `FeatureList`'s icon box comes back to the mockup's own scale (`size-11
sm:size-14 lg:size-16`), and the stale rationale comment is replaced by one sentence saying
the new atoms fill their viewBox. `BrandRow`'s symbol is a 96×80 viewBox, not a square, so
its `size-*` classes become explicit width classes with `h-auto` to stop the mark being
squashed. Both files' header comments lose the gradient-collision paragraph and gain a
pointer to the Group A / Group B split.

#### 7. Provenance register

**File**: `public/illustrations/slice-map.md`

**Intent**: Record where all 14 Group A files and all 13 Group B icons came from, and correct
— not append to — the section that describes the retired six.

**Contract**: The section "Signed-out surface art (auth-visual-fidelity) — 2026-08-29" is
**rewritten**, since every file it lists is deleted. Its replacement carries: the two tables
above (destination ↔ source); a note that the SVGs are byte-for-byte copies and the three
PNGs are as-is copies (no crop, no resize) of already-cut-out files; the Group A / Group B
split and why; the two Group B derivations; and the white-knock-out finding with the list of
holed cutouts and the "on white only" rule it implies. The paragraph explaining the
gradient-id hazard goes, and one line records that it was specific to the atomic pack and
does not apply to this extraction.

#### 8. Rewrite the pinning test

**File**: `tests/auth-art.test.ts`

**Intent**: The existing test pins Group A's shape. It must keep doing that, gain the
subdirectory, and grow a guard for Group B's one real hazard.

**Contract**: Keeps the three existing assertions (every path exists on disk; every path
serves from `/illustrations/`; one feature icon per `t.marketing.features` entry; no
duplicate feature icon), with the path regex widened to allow the single `auth/` segment.
Adds: **every committed Group A SVG is free of `id=` attributes and of `<linearGradient` /
`<radialGradient>`**, and **every icon exported from `src/components/icons/authIcons.tsx`
renders an `<svg>` carrying a `viewBox`, no `id`, and at least one `currentColor`** — read by
rendering each export, not by grepping the file, so a component that exports the wrong thing
fails too. This is the guard that makes the inlining decision safe to keep: it can go red,
and it goes red on exactly the mistake that would break it.

### Success Criteria:

#### Automated Verification:

- Art test passes: `npx vitest run tests/auth-art.test.ts`
- Full unit suite passes: `npm run test` — baseline 641 + ~4 new assertions in `tests/auth-art.test.ts`
- Linting passes: `npm run lint`
- Type/astro check passes: `npm run check`
- No source file references a retired atomic-pack path: `grep -rn "atomic-assets\|illustrations/brand-symbol\|illustrations/parent-lock\|illustrations/feature-" src tests e2e` returns nothing
- No source file resolves a path under `assets/`: `grep -rn "assets/matmaverse\|assets/atomic" src e2e | grep -v "^\S*:[0-9]*: *\(\*\|//\|{/\*\)"` returns nothing but comments

#### Manual:

- Each of the 14 Group A files, opened in a browser, reads as its mockup counterpart
- `slice-map.md` describes only files that exist, and no longer claims these glyphs are rendered with lucide or that they carry colliding gradient ids

---

## Phase 2: Shared marketing components — LANDED (`5793073`), not re-run

### Overview

`BrandRow.astro`, `FeatureList.astro` and `SecurityNote.astro` exist and are consumed by both
`AuthShell.astro` and `Welcome.astro`. The extraction of the duplicated markup is correct and
survives the revision unchanged — art paths are read from `src/data/marketing-art.ts`, so
Phase 1's atom swap re-dresses both surfaces with no markup edit here.

Two items that would otherwise belong to this phase are folded into **Phase 1 item 6**: the
`FeatureList` icon-box size and the `BrandRow` symbol aspect ratio, both tuned to the retired
art. `SecurityNote`'s `lucide` `Lock` is replaced with `AuthLockFilledIcon` in **Phase 4**,
where the sign-in card's icon family is settled in one pass.

Its Progress rows stay checked. No commit belongs to this phase in this revision.

---

## Phase 3: The mockup's field model

### Overview

Move `FormField` to the treatment mockups `01`, `02` and `04` share — accessible-but-invisible
label, tall input, extraction icon in the left gutter, placeholder carrying the field name —
across all four auth forms, without disturbing the fifteen `getByLabel` locators.

### Changes Required:

#### 1. The field

**File**: `src/components/auth/FormField.tsx`

**Intent**: Adopt the mockups' field treatment, keeping the label in the accessibility tree.

**Contract**: The `<Label>` keeps `htmlFor={id}` and gains `sr-only` (never `hidden` /
`aria-hidden` — see Critical Implementation Details). The input grows from `h-12` to `h-14`
and keeps `rounded-xl`. The leading icon is the mockups' blue outline glyph in the gutter at
`size-5 text-primary` — **not** a tinted tile: mockups `01`, `02` and `04` all draw a bare
blue icon on the field's own background, and the earlier plan's tile was a misreading. Left
padding widens to clear it. `endContent` stays right-aligned and vertically centred against
the taller field. `error` and `hint` slots and the prop signature are unchanged, so no call
site needs editing for this item.

#### 2. Extraction icons at every call site

**Files**: `src/components/auth/{SignInForm,SignUpForm,ResetPasswordForm,UpdatePasswordForm}.tsx`

**Intent**: The four forms pass `lucide` `Mail` / `Lock` into `FormField`. Swap for Group B.

**Contract**: `Mail` → `AuthEmailIcon`, `Lock` → `AuthLockIcon`, one-for-one, `className`
unchanged. The `lucide` imports for those two go away in all four files. Submit-button icons
are Phase 4 (`SignInForm`), Phase 5 (`SignUpForm`) and Phase 7 (the two password forms).

#### 3. The eye toggle

**File**: `src/components/auth/PasswordToggle.tsx`

**Intent**: Keep the control centred and its tap target intact against the taller field, and
put it in the extraction's icon family.

**Contract**: `Eye` / `EyeOff` → `AuthEyeIcon` / `AuthEyeOffIcon`. Positioning updated for
`h-14`. No behaviour change, no accessible-name change.

#### 4. Placeholders carry the field name

**File**: `src/i18n/pl.ts`

**Intent**: With the label visually gone, the placeholder is the only thing naming the field
for a sighted user — so it must be the field's name, as all three mockups show.

**Contract**: `emailPlaceholder` → "Email"; `passwordPlaceholderSignin` → "Hasło";
`passwordPlaceholderSignup` → "Hasło"; `confirmPlaceholder` → "Powtórz hasło". New
`passwordRule: "Minimum 6 znaków"` for the hint below. The `*Label` keys are untouched —
they are what every e2e locator resolves.

#### 5. The password rule moves to a persistent hint

**File**: `src/components/auth/SignUpForm.tsx`

**Intent**: `passwordPlaceholderSignup` ("Minimum 6 znaków") was the only up-front statement
of the length rule; renaming it to "Hasło" would leave the rule discoverable only *after* a
failed attempt. The existing `hint` slot — today conditional, shown only once a too-short
password has been typed — becomes the rule's permanent home.

**Contract**: `passwordHint` renders `t.auth.fields.passwordRule` whenever there is no error,
and keeps the existing countdown once the user starts typing a short password.

### Success Criteria:

#### Automated Verification:

- Unit suite passes, including `tests/signin-form.test.tsx`: `npm run test` — baseline + 0 (no new tests; the existing ones are the regression surface)
- Full e2e suite passes — the real gate, since `signInViaUI` runs in nearly every spec: `npm run test:e2e` (green = "1 failed, 1 skipped, 30 passed"; the failure is `growth.spec.ts` on `[touch]`, pre-existing on `main`)
- Linting passes: `npm run lint`
- Type/astro check passes: `npm run check`
- No `lucide` mail/lock/eye remains in the auth forms: `grep -rn "Mail\|Lock\|Eye" src/components/auth/*.tsx | grep lucide` returns nothing

#### Manual:

- All four auth screens render tall placeholder-only fields with the extraction's blue gutter icons
- "Minimum 6 znaków" is visible under the signup password field before typing anything
- Every field is reachable by tab and still announces its Polish label in the accessibility inspector
- The eye toggle sits centred in the taller field, both states read as one icon family, and it still shows/hides the password

---

## Phase 4: Screen 01 — the sign-in card and page composition

### Overview

Finish `/auth/signin`: illustrated card header, the designed two-part secondary button, hero
proportions, and the ambient background art — all from the new atoms.

### Changes Required:

#### 1. Card header art

**File**: `src/pages/auth/signin.astro`

**Intent**: Replace the `size-7` lucide `UserRound` in a tinted square with the parent-and-shield
illustration the mockup puts at the top of the card.

**Contract**: `<img src={PARENT_LOCK}>` (`hero-parent-security.svg`, a 96×64 viewBox) at the
mockup's scale with `h-auto` so the 3:2 mark is not squashed, `alt=""` `aria-hidden="true"`
(the `<h1>` beneath names the card). The `UserRound` import goes away.

#### 2. Keep exactly one "Zaloguj się" per viewport

**File**: `src/pages/auth/signin.astro`

**Intent**: The mockup's card carries only "Panel rodzica"; the accent line beside it already
says "Zaloguj się". But `AuthShell`'s hero is `hidden lg:block`, so below `lg` the card's
subline is the only thing naming the action.

**Contract**: The card's `<p>{t.auth.signin.heading}</p>` subline gains `lg:hidden`. Above
`lg` the accent line is the single occurrence; below `lg` the subline is — which also keeps
the string from resolving to two elements in any one viewport (L-007).

#### 3. The designed secondary button

**File**: `src/pages/auth/signin.astro`

**Intent**: Wire the two-part label the mockup specifies, using `t.auth.signin.noAccount` — a
string that has existed unused since it was written.

**Contract**: The `/auth/signup` anchor's label becomes `noAccount` in muted weight followed
by `signupLink` in `font-bold text-primary`, its icon becomes `AuthUserPlusIcon`, and the
outline variant is tinted blue (`border-primary text-primary`) rather than neutral. Its
accessible name is therefore "Nie masz konta? Utwórz konto" — the string item 7 pins.

#### 4. Submit button and security note

**Files**: `src/components/auth/SignInForm.tsx`, `src/components/marketing/SecurityNote.astro`

**Intent**: Finish the icon family on this screen. The mockup's submit button carries a white
filled padlock; the security strip carries a blue one.

**Contract**: `SignInForm`'s `LogIn` → `AuthLockFilledIcon`. `SecurityNote`'s `lucide` `Lock`
→ `AuthLockFilledIcon`; its header paragraph explaining why `Lock` stayed lucide is replaced,
since the extraction now supplies the atom that note said did not exist.

#### 5. Hero proportions

**File**: `src/components/auth/AuthShell.astro`

**Intent**: The mockup's card starts near the top of the page and is tall; ours is vertically
centred and shorter, which is why the screen reads smaller and looser than the design.

**Contract**: The two-column grid switches from `items-center` to top alignment, the hero
heading scales up one step at `lg`/`xl`, the tagline gets a `max-w-*` so it wraps to two
lines as in the mockup, and the form slot's `max-w-lg` becomes the extraction's
`--mm-login-card-width` (542 px). Grid column ratio unchanged.

#### 6. Background decoration

**File**: `src/components/auth/AuthShell.astro`

**Intent**: Restore the ambient depth — one coin is the only decoration today, and it is a
raster.

**Contract**: `DECOR_COIN` (SVG now), `DECOR_COIN_STACK` bottom-right, `DECOR_CHART`
top-right, `DECOR_RECEIPT` top-right behind the card, `DECOR_PATH` across the hero — all from
`src/data/marketing-art.ts`. Every decoration is `aria-hidden="true"`,
`pointer-events-none`, `hidden lg:block`, absolutely positioned and behind the content. The
shell's outer container gets `overflow-hidden` so none of them can make the body scroll
sideways.

#### 7. Pin the button label

**File**: `e2e/smoke.spec.ts`

**Intent**: The `noAccount` half of the label is exactly the kind of thing that was written
once and silently dropped; an assertion is what makes dropping it again fail.

**Contract**: The existing "anonymous /app redirects to signin" test, which already lands on
`/auth/signin`, gains one assertion that a link with the accessible name
`` `${t.auth.signin.noAccount} ${t.auth.signin.signupLink}` `` is visible.

### Success Criteria:

#### Automated Verification:

- Unit suite passes: `npm run test` — baseline + 0
- E2E suite passes, including the new smoke assertion: `npm run test:e2e`
- Linting passes: `npm run lint`
- Type/astro check passes: `npm run check`
- Playwright at 1024, 1280, 1536 and 1920 reports `document.documentElement.scrollWidth === clientWidth` on `/auth/signin`

#### Manual:

- `/auth/signin` at 1536×1024 beside `01-parent-login-web.png`: card art, button, hero scale and decorations all read as the design
- At 390×844 beside `01-parent-login-mobile.png`: no decorations, no world strip, carded features, "Zaloguj się" still named on the card
- Decorations sit behind the content and never intercept a click on the card or its controls
- Signing in with the seeded local account still works end to end

---

## Phase 5: Screen 02 — `/auth/signup`

### Overview

Dress the register screen to `02-parent-register-web.png`: its own marketing heading, the
extraction's icons on the card, the mockup's plain-text secondary line in place of the
outline button, and the trust-badge row both `02` and `03` close with.

### Changes Required:

#### 1. The screen's own marketing heading

**Files**: `src/pages/auth/signup.astro`, `src/i18n/pl.ts`

**Intent**: `AuthShell` is currently told "Panel rodzica" / "Utwórz konto" on this route. The
mockup's left panel reads "Utwórz konto rodzica" over "Zacznij bezpieczną naukę przez
praktykę" — a different heading and a different tagline from screen `01`'s.

**Contract**: New `t.marketing.signupHeading` ("Utwórz konto") and `t.marketing.signupAccent`
("rodzica") are **not** introduced — splitting a Polish noun phrase across two styled lines
would not survive translation. Instead `signup.astro` passes `heading={t.auth.signup.heading}`
(already "Utwórz konto"), `accent={t.marketing.parentPanel}` and a new
`t.marketing.signupTagline` ("Zacznij bezpieczną naukę przez praktykę") as `tagline`. No new
component prop is needed; `AuthShell` already takes all three.

#### 2. Card composition

**File**: `src/pages/auth/signup.astro`

**Intent**: The mockup's card opens straight into the fields — its heading lives in the left
panel. Ours opens with an icon tile, an `<h1>` and a subtitle, which is right below `lg`
(where `AuthShell`'s hero is hidden) and redundant above it.

**Contract**: The icon tile becomes `AuthUserPlusIcon` at the mockup's weight and the whole
header block gains `lg:hidden`, mirroring what Phase 4 item 2 did on sign-in and for the same
L-007 reason. The submit button's `lucide` icon becomes `AuthShieldCheckIcon` (mockup `02`
draws a white shield-check inside the blue button).

#### 3. The mockup's secondary line

**File**: `src/pages/auth/signup.astro`

**Intent**: Mockup `02` closes the card with a centred text line — "Masz już konto?
**Zaloguj się**" — not with an outline button. It is also where the dead
`t.auth.signup.hasAccount` string belongs.

**Contract**: The outline `<a>` becomes a centred `<p>` carrying `hasAccount` in muted weight
and a `/auth/signin` link in `font-bold text-primary` reading `signinLink`. The `LogIn`
import goes away. The link keeps the role `link` and gains the accessible name "Zaloguj się",
which is what any locator would reach for.

#### 4. Trust badges

**Files**: `src/components/marketing/TrustBadges.astro` (new), `src/i18n/pl.ts`

**Intent**: Mockups `02` and `03` both close with a row of three reassurance badges. Building
it once, driven by an `items` prop, is what stops the two screens from drifting — the same
argument that produced `FeatureList` in Phase 2.

**Contract**: Renders a responsive row (stacked below `sm`, three columns at `sm+`) of
`{ icon, title, body? }`, each a Group A `<img>` in a white circular tile beside its text.
Screen `02` passes `t.marketing.trustSignup` — "Chronimy Twoje dane" / "Oddzielne konto
rodzica i profilu dziecka" / "Zgodne z zasadami bezpiecznego uczenia się", title-only, per the
mockup. Screen `03` (Phase 6) passes `t.marketing.trustVerify`, which has bodies.

**The two sets are different on purpose.** Mockup `03`'s first badge is titled "Bezpieczna
nauka", which is *already* `t.marketing.features[0].title`. On `/auth/signup` the `AuthShell`
renders `FeatureList`, so reusing `03`'s set there would put the same accessible name on the
page twice and make an unrelated `getByText` ambiguous (L-007). `/auth/confirm-email` has no
`AuthShell` and no `FeatureList`, so `03`'s wording is safe there — which is also what its
mockup says.

#### 5. The substring guard

**File**: `tests/marketing-labels.test.ts` (new)

**Intent**: Item 4's collision was caught by reading the dictionary. The next one will not be.
`tests/nav-labels.test.ts` is the established model for this exact class of guard.

**Contract**: Asserts that no title in `t.marketing.trustSignup` is a substring or superstring
of any `t.marketing.features[*].title`, in both directions, and the same for
`t.marketing.trustVerify` against the labels rendered on `/auth/confirm-email`. Modelled on
`tests/nav-labels.test.ts`, node environment, dictionary-only — no rendering.

#### 6. Decoration

**File**: `src/pages/auth/signup.astro`

**Intent**: The mockup's right edge carries a coin stack and a growth chart, its top-left a
cloud.

**Contract**: Reuses `AuthShell`'s decoration layer from Phase 4 — no page-level decoration
is added, because the shell already owns this region for all four auth routes and a second
absolute layer on one page is how the two get out of step. Recorded here so the mockup's
backpack-and-shelf art is understood as *not implemented*, not as missed.

### Success Criteria:

#### Automated Verification:

- Unit suite passes: `npm run test` — baseline + ~2 (`tests/marketing-labels.test.ts`)
- New label guard passes on its own: `npx vitest run tests/marketing-labels.test.ts`
- E2E suite passes, including `e2e/onboarding.spec.ts`, which signs up through the UI: `npm run test:e2e`
- Linting passes: `npm run lint`
- Type/astro check passes: `npm run check`
- Playwright reports no horizontal overflow on `/auth/signup` at 1024, 1280, 1536, 1920

#### Manual:

- `/auth/signup` at 1536×1024 beside `02-parent-register-web.png` and at 390×844 beside `02-parent-register-mobile.png`
- "Masz już konto? Zaloguj się" renders as one centred line, and the link is reachable by tab
- The trust-badge row reads as the mockup's, and no badge title repeats a feature title on the page

---

## Phase 6: Screen 03 — `/auth/confirm-email`

### Overview

Dress the verification screen to `03-email-verification-web.png`: the shared brand row, the
envelope hero, the extraction's icons on both footer panels and both CTAs, and the trust-badge
row.

### Changes Required:

#### 1. Shared brand row

**File**: `src/pages/auth/confirm-email.astro`

**Intent**: This page hand-rolls the brand lockup with a `lucide` `ShoppingCart` in a blue
tile — the exact duplication Phase 2 retired on the other surfaces. It is the last auth route
still carrying it.

**Contract**: The hand-rolled block is replaced by `<BrandRow size="lg" />`. The
`ShoppingCart` import goes away.

#### 2. The envelope hero

**File**: `src/pages/auth/confirm-email.astro`

**Intent**: The mockup's left half is one large illustration; ours is a `size-16` lucide
`MailCheck` in a tinted circle.

**Contract**: `<img src={HERO_EMAIL}>` (`hero-email.png`, 430×400) filling the card's left
column, `alt=""` `aria-hidden="true"`. **It must stay inside the `bg-card` surface** — its
white interior is keyed out and would show through on the page background (Critical
Implementation Details). The `MailCheck` import goes away.

#### 3. Status pill and CTA icons

**File**: `src/pages/auth/confirm-email.astro`

**Intent**: The mockup puts a small green envelope pill above the heading and gives each CTA
an icon.

**Contract**: A `size-12` `bg-success/10 text-success` circle holding `AuthEmailIcon`, above
the `<h1>`, `aria-hidden`. The resend button's `RotateCw` → `AuthRefreshIcon`. The primary
`/auth/signin` link gains `AuthArrowRightIcon`. **Action order is unchanged** — the mockup's
primary is "Otwórz pocztę", an action this product does not have; ours are resend (outline)
then continue (primary), and resend is this page's actual job, so it stays first.

#### 4. Footer panel icons

**File**: `src/pages/auth/confirm-email.astro`

**Intent**: The two footer panels already match the mockup's structure and tints; only their
glyphs are `lucide`.

**Contract**: `UserRoundPlus` → `AuthUserPlusIcon`; `ShieldCheck` → `<img src={BADGE_CHECK}>`
in the existing white circle. The next-step panel gains a trailing `AuthChevronRightIcon`, as
the mockup draws it. Both `lucide` imports go away.

#### 5. Trust badges

**Files**: `src/pages/auth/confirm-email.astro`, `src/i18n/pl.ts`

**Intent**: The mockup closes the page with the same three-badge row as `02`, worded
differently and with bodies.

**Contract**: `<TrustBadges items={t.marketing.trustVerify} />` below the card. New
`t.marketing.trustVerify`: "Bezpieczna nauka" / "Twoje dane są chronione zgodnie z
najlepszymi standardami."; "Konto rodzica" / "Oddzielone od profilu dziecka i w pełni
kontrolowane przez Ciebie."; "Bez reklam" / "Skupiamy się na nauce, nie na reklamach." Safe
on this route because it renders no `FeatureList` (Phase 5 item 4); the Phase 5 guard covers
it.

#### 6. Decoration

**File**: `src/pages/auth/confirm-email.astro`

**Intent**: This route does not use `AuthShell`, so it has no decoration layer at all.

**Contract**: A page-level `aria-hidden` `pointer-events-none` `hidden lg:block` layer
carrying `DECOR_PATH` (top), `DECOR_CHART` (left) and `DECOR_RECEIPT` (right), with
`overflow-hidden` on the outer container. Same rules as `AuthShell`'s layer; not shared with
it, because the two pages' geometries differ and a shared component would be all props.

### Success Criteria:

#### Automated Verification:

- Unit suite passes: `npm run test` — baseline + 0
- E2E suite passes, including `e2e/onboarding.spec.ts`, which asserts this page's heading, trouble hint and continue link: `npm run test:e2e`
- Linting passes: `npm run lint`
- Type/astro check passes: `npm run check`
- No lucide remains on the route: `grep -n "lucide" src/pages/auth/confirm-email.astro` returns nothing
- Playwright reports no horizontal overflow at 1024, 1280, 1536, 1920

#### Manual:

- `/auth/confirm-email?email=…` at 1536×1024 beside `03-email-verification-web.png` and at 390×844 beside `03-email-verification-mobile.png`
- The envelope hero shows no pale rectangle or missing white letter against the card
- Both `?resent=1` and `?error=…` states still render their notices legibly inside the new layout

---

## Phase 7: Screen 04 — `/auth/reset-password` and `/auth/update-password`

### Overview

Dress the recovery pair to `04-password-reset-web.png`: its own marketing heading, the
envelope-and-lock card hero, the paper-plane submit, and the protected-access line under the
back link. `/auth/update-password` has no mockup and inherits the same card treatment, as it
already does today.

### Changes Required:

#### 1. The screen's own marketing heading

**Files**: `src/pages/auth/reset-password.astro`, `src/i18n/pl.ts`

**Intent**: The mockup's left panel reads "Bezpieczny dostęp do panelu rodzica" over two
supporting lines — not screen `01`'s "Panel rodzica / Nie pamiętasz hasła?".

**Contract**: New `t.marketing.resetHeading` ("Bezpieczny dostęp"), reusing
`t.marketing.parentPanel` as the accent ("Panel rodzica"), and `t.marketing.resetTagline`
("Pomożemy Ci szybko odzyskać dostęp do konta. Twoje dane i postępy dziecka są bezpieczne.").
Passed to `AuthShell` as `heading` / `accent` / `tagline`. L-007: "Bezpieczny dostęp" is
checked against the dictionary in both directions by the Phase 5 guard, extended here.

#### 2. Card hero

**Files**: `src/pages/auth/reset-password.astro`, `src/pages/auth/update-password.astro`

**Intent**: The mockup heads the card with an envelope-and-lock illustration; ours is a
`size-7` lucide `KeyRound` in a tinted square.

**Contract**: `<img src={HERO_RESET}>` (`hero-reset.png`, 183×166) at the mockup's scale,
`alt=""` `aria-hidden="true"`, **inside the `bg-card` surface** — its white card interior is
keyed out. Both routes get it, so the recovery flow's two steps look like one flow. The
`KeyRound` imports go away.

#### 3. Submit and back-link icons

**Files**: `src/components/auth/ResetPasswordForm.tsx`, `src/components/auth/UpdatePasswordForm.tsx`, `src/pages/auth/reset-password.astro`

**Intent**: The mockup's send button carries a paper plane and its back link a left arrow.

**Contract**: `ResetPasswordForm`'s submit icon becomes `AuthPaperPlaneIcon`;
`UpdatePasswordForm`'s becomes `AuthLockFilledIcon` (it saves a password, not sends a link).
The back link's `lucide` `ArrowLeft` → `AuthArrowLeftIcon`.

#### 4. The protected-access line

**Files**: `src/pages/auth/reset-password.astro`, `src/i18n/pl.ts`

**Intent**: The mockup closes the card with a small lock and "Chronimy dostęp do panelu
rodzica" — the card's own reassurance, distinct from the panel-wide `SecurityNote`.

**Contract**: New `t.auth.reset.protectHint`. Rendered under the back link as a centred
muted line with `AuthLockFilledIcon`. Checked against `t.marketing.security` for substring
collision before landing.

#### 5. Keep the `?sent=1` notice inside the new card

**File**: `src/pages/auth/reset-password.astro`

**Intent**: The notice replaces the form and must not lose the card's new hero or its
conditional wording, which is the route's privacy contract.

**Contract**: Structure unchanged — the hero and heading stay above whichever of
{form, notice} renders. The notice's ad-hoc green classes move onto the theme's `success`
tokens so it matches the rest of the redesign, with no wording change.

### Success Criteria:

#### Automated Verification:

- Unit suite passes: `npm run test` — baseline + 0
- E2E suite passes, including `e2e/password-reset.spec.ts`, which drives both routes: `npm run test:e2e`
- Linting passes: `npm run lint`
- Type/astro check passes: `npm run check`
- Extended label guard passes: `npx vitest run tests/marketing-labels.test.ts`
- Playwright reports no horizontal overflow on both routes at 1024, 1280, 1536, 1920

#### Manual:

- `/auth/reset-password` at 1536×1024 beside `04-password-reset-web.png` and at 390×844 beside `04-password-reset-mobile.png`
- `/auth/reset-password?sent=1` still shows the conditional notice, inside the new card
- `/auth/update-password` reached from a real recovery link looks like the same flow's second step
- The card hero shows no pale rectangle where its white card should be

---

## Phase 8: Screen 05 — `/app/new-profile`

### Overview

Dress the child-profile wizard to `05-child-profile-web.png`: the shared brand row (replacing
the last `ShoppingCart`), the extraction's field and stepper glyphs, the mockup's selected-tile
check badge, the illustrated level tile and privacy notice, and a decoration layer.

### Changes Required:

#### 1. Shared brand row

**File**: `src/pages/app/new-profile.astro`

**Intent**: This page hand-rolls a brand lockup with a `lucide` `ShoppingCart` in a blue tile.
It is one of the two remaining copies (the other is Phase 9's) and the maintainer asked
specifically that the brand row be consistent across all six screens.

**Contract**: Replaced by `<BrandRow size="lg" class="mb-6 justify-center" />`. The
`ShoppingCart` import goes away.

#### 2. Field glyphs

**File**: `src/components/child/CreateProfileWizard.tsx`

**Intent**: The mockup draws a person glyph in the name field's gutter and a calendar glyph
beside the age control.

**Contract**: The name `<Input>` gains a left gutter icon matching Phase 3's field treatment.
The extraction has no plain person outline — `auth-user-plus.svg` carries a plus this field
should not — so the name field keeps `lucide`'s `User`, and the module header records that as
the one place a `lucide` glyph is deliberate. The age group's `<Label>` gains
`AuthCalendarIcon`; the age control stays a row of buttons, not the mockup's select, because
that is an input-model change.

#### 3. Selected-tile check badge

**File**: `src/components/child/SelectTile.tsx`

**Intent**: The mockup marks the selected avatar and the selected world with a blue circular
check badge on the tile's corner. Our tiles signal selection with a border only.

**Contract**: When `selected`, the tile renders `<img src={BADGE_CHECK}>` absolutely
positioned at the corner, `aria-hidden="true"` — the state is already carried for assistive
tech by `aria-pressed`, so the badge is purely visual and must not be announced twice. The
tile's existing border and ring treatment stays; the badge is additive. `avatar-boy-selected.png`
from the extraction is **not** used: it bakes the ring and badge into the raster, which is
exactly what the extraction's own rule forbids.

#### 4. Stepper and review illustrations

**File**: `src/components/child/CreateProfileWizard.tsx`

**Intent**: Two of the mockup's illustrated moments have `lucide` stand-ins today.

**Contract**: The starting-level strip on step 3 becomes the mockup's tile — a
`<img src="/illustrations/auth/feature-progress.svg">` in a tinted rounded square beside the
level name and description — on `bg-primary/5`, matching the mockup. `t.profileWizard.note`
moves into a pale panel headed by `<img src="/illustrations/auth/feature-safety.svg">`, as the
mockup's "Profil dziecka jest widoczny tylko dla Ciebie" strip does. The stepper's `Check`
stays `lucide`: it is a 4 px white tick inside a CSS-drawn green disc, and the extraction's
`step-check.svg` is the whole disc, which the rule says to build in CSS.

#### 5. Decoration

**File**: `src/pages/app/new-profile.astro`

**Intent**: The mockup's page background carries coins bottom-left and a chart plus a
checklist right.

**Contract**: A page-level `aria-hidden` `pointer-events-none` `hidden lg:block` layer with
`DECOR_COIN_STACK` (bottom-left) and `DECOR_CHART` (right), `overflow-hidden` on the outer
container. The mockup's plant and checklist have no atom in the extraction's SVG set and are
not implemented.

### Success Criteria:

#### Automated Verification:

- Unit suite passes, including `tests/profiles-create.test.ts` and `tests/worlds-picker.test.tsx`: `npm run test` — baseline + 0
- E2E suite passes, including `e2e/onboarding.spec.ts`, which drives all three wizard steps and locates avatar and world tiles by accessible name: `npm run test:e2e`
- Linting passes: `npm run lint`
- Type/astro check passes: `npm run check`
- Playwright reports no horizontal overflow at 1024, 1280, 1536, 1920

#### Manual:

- `/app/new-profile` at 1536×1024 beside `05-child-profile-web.png` and at 390×844 beside `05-child-profile-mobile.png`
- The selected avatar and the selected world each show one check badge, and a screen reader announces the selection exactly once
- All three steps are reachable by keyboard and the step-2 grids still tab in order

---

## Phase 9: Screen 06 — `/app/parent-pin`

### Overview

Dress the PIN screen to `06-parent-pin-security-web.png`: the shared brand row, the lock-and-shield
card hero, the mockup's PIN field weight, the pale note panel, and a decoration layer — without
changing the PIN's input model.

### Changes Required:

#### 1. Shared brand row

**File**: `src/pages/app/parent-pin.astro`

**Intent**: The last hand-rolled `ShoppingCart` brand lockup in the app's signed-out and
onboarding surfaces.

**Contract**: Replaced by `<BrandRow size="lg" class="mb-6" />`. The `ShoppingCart` import
goes away. After this phase, `grep -rn "ShoppingCart" src` returns nothing.

#### 2. Card hero

**File**: `src/components/parent/ParentPinGate.tsx`

**Intent**: The mockup heads the card with a large padlock-and-shield illustration; ours is a
`size-7` lucide `KeyRound` in a tinted square.

**Contract**: `<img src={HERO_PIN}>` (`hero-pin.png`, 244×190) at the mockup's scale,
`alt=""` `aria-hidden="true"`. This cutout keys cleanly, so it is safe on either surface. The
`KeyRound` import goes away.

#### 3. PIN field weight

**File**: `src/components/parent/ParentPinGate.tsx`

**Intent**: The mockup draws four separate digit boxes. The product's PIN is 4–6 digits and
`e2e/parent-surfaces.spec.ts` fills the field as one string, so the control stays one input
(see "What We're NOT Doing") — but its *weight* can match.

**Contract**: The existing single input keeps its `text-center text-2xl font-bold
tracking-[0.5em]` treatment, restyled to the mockup's card radius and blue focus border, at
`h-16`. The label stays a real `<label>` carrying `t.parentPin.pinLabel` — it is what the e2e
locator resolves. A comment records why the mockup's four boxes are not built.

#### 4. Note panel and submit icon

**File**: `src/components/parent/ParentPinGate.tsx`

**Intent**: The mockup closes the card with a pale-blue panel headed by a filled padlock,
carrying the text `t.parentPin.note` already holds, and gives the submit button a shield.

**Contract**: `t.parentPin.note` moves into a `bg-primary/5` rounded panel with
`AuthLockFilledIcon` in a tinted tile at the left — the same shape as `SecurityNote`, but not
that component, because this one lives inside a card and takes its text from
`t.parentPin`. The submit button gains `AuthShieldCheckIcon`. `ShieldCheck` from `lucide`
goes away.

#### 5. Decoration

**File**: `src/pages/app/parent-pin.astro`

**Intent**: The mockup's top band carries a shield, a dotted path and a coin stack.

**Contract**: A page-level `aria-hidden` `pointer-events-none` `hidden lg:block` layer with
`DECOR_PATH` (top-centre), `DECOR_COIN_STACK` (top-right) and `DECOR_CHART` (right), plus
`overflow-hidden` on the outer container.

### Success Criteria:

#### Automated Verification:

- Unit suite passes, including `tests/parent-pin.test.ts` and `tests/change-pin-section.test.tsx`: `npm run test` — baseline + 0
- E2E suite passes, including `e2e/parent-surfaces.spec.ts`, which sets a PIN, enters a wrong one, and changes it: `npm run test:e2e`
- Linting passes: `npm run lint`
- Type/astro check passes: `npm run check`
- No `ShoppingCart` remains anywhere in `src`: `grep -rn "ShoppingCart" src` returns nothing
- Playwright reports no horizontal overflow at 1024, 1280, 1536, 1920

#### Manual:

- `/app/parent-pin` at 1536×1024 beside `06-parent-pin-security-web.png` and at 390×844 beside `06-parent-pin-security-mobile.png`, in both `set` and `enter` modes
- The PIN field is reachable by tab, announces "PIN (4–6 cyfr)", and a 6-digit PIN still fits inside it
- Setting a PIN and then entering it still lands on `/app/report`

---

## Testing Strategy

### Unit Tests

- `tests/auth-art.test.ts` (rewritten, Phase 1) — every Group A path exists on disk and serves from `/illustrations/`; no Group A SVG carries an `id` or a gradient; every Group B export renders an `<svg>` with a `viewBox`, no `id`, and `currentColor`; `FEATURE_ICONS` and `t.marketing.features` stay the same length with no duplicate icon.
- `tests/marketing-labels.test.ts` (new, Phase 5; extended Phase 7) — no new marketing or trust label is a substring or superstring of an existing one. Modelled on `tests/nav-labels.test.ts`.
- `tests/signin-form.test.tsx` (existing) — must stay green through Phase 3. It locates the checkbox by role + accessible name and the reset link by role, so `sr-only` should not touch it. If it goes red, the label left the accessibility tree.

### Integration Tests

- `npm run test:e2e` in full after **every** phase from 3 onward — `signInViaUI` runs in nearly every spec, so the suite as a whole is the field-model and card-composition regression test.
- `e2e/onboarding.spec.ts` after Phases 5, 6 and 8 — it is the only spec that signs up through the UI, reads the verification page, and drives all three wizard steps.
- `e2e/password-reset.spec.ts` after Phase 7; `e2e/parent-surfaces.spec.ts` after Phase 9.
- `e2e/smoke.spec.ts` after Phase 4 — pins the two-part secondary-button label.

### Visual Verification (mandatory, per screen phase)

Driven with the Playwright MCP tools against a running dev server, at **1536×1024** against
`assets/matmaverse-auth-v2-web/0N-*-web.png` and **390×844** against
`assets/matmaverse-auth-v2-mobile/0N-*-mobile.png`. For each screen, compare region by region
and check all of:

1. `document.documentElement.scrollWidth === clientWidth` at 1024, 1280, 1536 and 1920.
2. Every decoration is `aria-hidden="true"` and `pointer-events-none`, and
   `document.elementFromPoint` over the card's primary control returns the control.
3. Body and muted text clear WCAG AA against their actual backgrounds.
4. A full tab traversal reaches every interactive element in the form, in order, with a
   visible focus ring on each.
5. Every input resolves through `getByLabel` with its Polish label — a real `<label>`, not a
   placeholder standing in for one.

Screenshots go to the run's scratchpad; each phase's summary states, per region, whether it
matches the mockup and — where it does not — that the difference is a decision and why.

## Performance Considerations

Group A is eleven SVGs of 176–726 bytes each plus three PNGs (`hero-email.png` 430×400,
`hero-reset.png` 183×166, `hero-pin.png` 244×190). Group B adds no network requests at all —
inlined icons ship in the island bundle and replace `lucide` components of comparable size.
Net page weight is effectively unchanged on the four `AuthShell` routes and rises by one
mid-size PNG on each of `/auth/confirm-email`, `/auth/reset-password` and `/app/parent-pin`.
Decorations are `hidden lg:block`, so mobile never fetches them.

## Migration Notes

None. No schema, no stored data, no route or API contract changes. Every change is
presentational or in the i18n dictionary; rollback is a revert. `src/data/avatars.ts` and the
`avatar` / `theme` value spaces are deliberately untouched (see "What We're NOT Doing"), so no
stored profile is invalidated.

## References

- **Extraction index**: `assets/matmaverse-auth-v2-web/AUTH_ASSET_EXTRACTION_INDEX.md`
- **Per-screen specs**: `assets/matmaverse-auth-v2-web/0{1..6}-*-extracted/docs/component-breakdown.md`, with `crop-map.json` beside each for traceability
- **Shared atoms**: `assets/matmaverse-auth-v2-web/00-shared-auth-assets/` (`manifest.json`, `svg/icons`, `svg/decor`, `png/cutouts`)
- **Design tokens**: `assets/matmaverse-auth-v2-web/01-parent-login-extracted/css/design-tokens.css`
- **Flat mockups**: `assets/matmaverse-auth-v2-web/0{1..6}-*-web.png` (1536×1024), `assets/matmaverse-auth-v2-mobile/0{1..6}-*-mobile.png`
- **Provenance register**: `public/illustrations/slice-map.md`
- **Test models**: `tests/worlds-art.test.ts` (asset existence), `tests/nav-labels.test.ts` (label substring guard)
- **Product**: `context/foundation/prd-v2.md`; **rules**: `CLAUDE.md`, `e2e/CLAUDE.md`, `context/foundation/lessons.md` (L-003, L-005, L-006, L-007, L-009)
- **Prior surface work**: `context/archive/2026-06-27-matmaverse-design-system/`, `context/archive/2026-08-22-web-shell-and-mockup-parity/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: The auth atom set, re-done from the per-screen extraction

> Reset on 2026-08-29. The rows below were checked against commit `8850b18`, which shipped
> art from `assets/atomic-assets-v2/`. That art is retired by this revision, so the phase is
> re-run against `assets/matmaverse-auth-v2-web/`.

#### Automated

- [x] 1.1 Art test passes: `npx vitest run tests/auth-art.test.ts` — ecbcbc9
- [x] 1.2 Full unit suite passes: `npm run test` (baseline 641 + ~4) — ecbcbc9
- [x] 1.3 Linting passes: `npm run lint` — ecbcbc9
- [x] 1.4 Type/astro check passes: `npm run check` — ecbcbc9
- [x] 1.5 No source file references a retired atomic-pack path — ecbcbc9
- [x] 1.6 No source file resolves a path under `assets/` — ecbcbc9

#### Manual

- [ ] 1.7 Each of the 14 Group A files reads as its mockup counterpart
- [ ] 1.8 `slice-map.md` describes only files that exist, with no stale lucide or gradient-id claims

### Phase 2: Shared marketing components

> Landed as `5793073` and NOT re-run in this revision. The components are structurally
> correct; only the art paths they read change, and those live in `src/data/marketing-art.ts`
> (Phase 1). Sizing fitted to the retired art is re-tuned in Phase 1 item 6.

#### Automated

- [x] 2.1 Full unit suite passes: `npm run test` — 5793073
- [x] 2.2 E2E suite passes, including `e2e/marketing-worlds.spec.ts` on both surfaces: `npm run test:e2e` — 5793073
- [x] 2.3 Linting passes: `npm run lint` — 5793073
- [x] 2.4 Type/astro check passes: `npm run check` — 5793073
- [x] 2.5 No lucide feature icons remain in either surface — 5793073

#### Manual

- [x] 2.6 At 1536 wide, feature blocks are borderless with large illustrated icons — 5793073
- [x] 2.7 At 390 wide, the same blocks are carded — 5793073
- [x] 2.8 `/` shows the same brand row, feature blocks and security panel as `/auth/signin` — 5793073
- [x] 2.9 The security note renders as a panel, not a bare text line — 5793073

### Phase 3: The mockup's field model

#### Automated

- [x] 3.1 Unit suite passes, including `tests/signin-form.test.tsx`: `npm run test` — 39993c5
- [x] 3.2 Full e2e suite passes: `npm run test:e2e` — 39993c5
- [x] 3.3 Linting passes: `npm run lint` — 39993c5
- [x] 3.4 Type/astro check passes: `npm run check` — 39993c5
- [x] 3.5 No lucide mail/lock/eye remains in the auth forms — 39993c5

#### Manual

- [ ] 3.6 All four auth screens render tall placeholder-only fields with the extraction's gutter icons
- [ ] 3.7 "Minimum 6 znaków" is visible under the signup password field before typing
- [ ] 3.8 Every field is reachable by tab and still announces its Polish label
- [ ] 3.9 The eye toggle sits centred in the taller field, reads as one family, and still works

### Phase 4: Screen 01 — the sign-in card and page composition

#### Automated

- [x] 4.1 Unit suite passes: `npm run test` — fa17a22
- [x] 4.2 E2E suite passes, including the new smoke assertion: `npm run test:e2e` — fa17a22
- [x] 4.3 Linting passes: `npm run lint` — fa17a22
- [x] 4.4 Type/astro check passes: `npm run check` — fa17a22
- [x] 4.5 No horizontal overflow on `/auth/signin` at 1024, 1280, 1536, 1920 — fa17a22

#### Manual

- [ ] 4.6 `/auth/signin` at 1536×1024 matches `01-parent-login-web.png` region by region
- [ ] 4.7 At 390×844 it matches `01-parent-login-mobile.png`
- [ ] 4.8 Decorations sit behind content and never intercept a click
- [ ] 4.9 Signing in with the seeded local account still works end to end

### Phase 5: Screen 02 — `/auth/signup`

#### Automated

- [x] 5.1 Unit suite passes: `npm run test` (baseline + ~2)
- [x] 5.2 New label guard passes: `npx vitest run tests/marketing-labels.test.ts`
- [x] 5.3 E2E suite passes, including `e2e/onboarding.spec.ts`: `npm run test:e2e`
- [x] 5.4 Linting passes: `npm run lint`
- [x] 5.5 Type/astro check passes: `npm run check`
- [x] 5.6 No horizontal overflow on `/auth/signup` at 1024, 1280, 1536, 1920

#### Manual

- [ ] 5.7 `/auth/signup` at 1536×1024 matches `02-parent-register-web.png`
- [ ] 5.8 At 390×844 it matches `02-parent-register-mobile.png`
- [ ] 5.9 "Masz już konto? Zaloguj się" renders as one centred line and tabs correctly
- [ ] 5.10 The trust-badge row reads as the mockup's, with no badge title repeating a feature title

### Phase 6: Screen 03 — `/auth/confirm-email`

#### Automated

- [ ] 6.1 Unit suite passes: `npm run test`
- [ ] 6.2 E2E suite passes, including `e2e/onboarding.spec.ts`: `npm run test:e2e`
- [ ] 6.3 Linting passes: `npm run lint`
- [ ] 6.4 Type/astro check passes: `npm run check`
- [ ] 6.5 No lucide remains on the route
- [ ] 6.6 No horizontal overflow at 1024, 1280, 1536, 1920

#### Manual

- [ ] 6.7 `/auth/confirm-email?email=…` at 1536×1024 matches `03-email-verification-web.png`
- [ ] 6.8 At 390×844 it matches `03-email-verification-mobile.png`
- [ ] 6.9 The envelope hero shows no pale rectangle or missing white letter against the card
- [ ] 6.10 The `?resent=1` and `?error=…` states still render legibly

### Phase 7: Screen 04 — `/auth/reset-password` and `/auth/update-password`

#### Automated

- [ ] 7.1 Unit suite passes: `npm run test`
- [ ] 7.2 Extended label guard passes: `npx vitest run tests/marketing-labels.test.ts`
- [ ] 7.3 E2E suite passes, including `e2e/password-reset.spec.ts`: `npm run test:e2e`
- [ ] 7.4 Linting passes: `npm run lint`
- [ ] 7.5 Type/astro check passes: `npm run check`
- [ ] 7.6 No horizontal overflow on both routes at 1024, 1280, 1536, 1920

#### Manual

- [ ] 7.7 `/auth/reset-password` at 1536×1024 matches `04-password-reset-web.png`
- [ ] 7.8 At 390×844 it matches `04-password-reset-mobile.png`
- [ ] 7.9 `?sent=1` still shows the conditional notice inside the new card
- [ ] 7.10 `/auth/update-password` reads as the same flow's second step

### Phase 8: Screen 05 — `/app/new-profile`

#### Automated

- [ ] 8.1 Unit suite passes: `npm run test`
- [ ] 8.2 E2E suite passes, including `e2e/onboarding.spec.ts`: `npm run test:e2e`
- [ ] 8.3 Linting passes: `npm run lint`
- [ ] 8.4 Type/astro check passes: `npm run check`
- [ ] 8.5 No horizontal overflow at 1024, 1280, 1536, 1920

#### Manual

- [ ] 8.6 `/app/new-profile` at 1536×1024 matches `05-child-profile-web.png`
- [ ] 8.7 At 390×844 it matches `05-child-profile-mobile.png`
- [ ] 8.8 The selected avatar and world each show one check badge, announced exactly once
- [ ] 8.9 All three steps are reachable by keyboard and step 2's grids tab in order

### Phase 9: Screen 06 — `/app/parent-pin`

#### Automated

- [ ] 9.1 Unit suite passes: `npm run test`
- [ ] 9.2 E2E suite passes, including `e2e/parent-surfaces.spec.ts`: `npm run test:e2e`
- [ ] 9.3 Linting passes: `npm run lint`
- [ ] 9.4 Type/astro check passes: `npm run check`
- [ ] 9.5 No `ShoppingCart` remains anywhere in `src`
- [ ] 9.6 No horizontal overflow at 1024, 1280, 1536, 1920

#### Manual

- [ ] 9.7 `/app/parent-pin` at 1536×1024 matches `06-parent-pin-security-web.png` in both modes
- [ ] 9.8 At 390×844 it matches `06-parent-pin-security-mobile.png`
- [ ] 9.9 The PIN field tabs, announces "PIN (4–6 cyfr)", and holds a 6-digit PIN
- [ ] 9.10 Setting a PIN and then entering it still lands on `/app/report`
