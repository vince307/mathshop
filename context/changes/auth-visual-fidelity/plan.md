# Auth Visual Fidelity Implementation Plan

## Overview

`/auth/signin` was built to the right **structure** but the wrong **texture**. Every
region of mockup `01-parent-login-web` is present — brand row, hero, three feature
blocks, world strip, login card, security footer — yet the illustrated 3D art the
design leans on was substituted with 20px flat `lucide` glyphs, the feature blocks
carry card chrome the desktop design does not have, the form fields use a different
field model, and none of the ambient background depth exists.

This change closes that gap on the auth surfaces and on the landing page that shares
their vocabulary: committed art out of `assets/atomic-assets-v2/`, a shared set of
marketing components so `AuthShell` and `Welcome` cannot drift apart again, the
mockup's field model applied at the `FormField` level, and the sign-in card rebuilt
to the design.

## Current State Analysis

**The flat icons were a deliberate decision, not an oversight.** `public/illustrations/slice-map.md`
records, under Notes: *"The small feature-bullet icons (shield / globe / chart) and the
form-panel avatar-lock glyph are **not** sliced — they're generic and are rendered with
lucide icons in the surface layouts (Phase 4–5), which is visually faithful and keeps the
asset set lean."* This plan reverses that call, so it must retire that claim in the same
breath — otherwise the repo carries two contradictory statements about the same pixels.

What makes the reversal cheap is a third option that note did not consider: the art does
not have to be **sliced** from a flattened mockup at all. `assets/atomic-assets-v2/svg/`
already ships standalone, self-contained, gradient-filled SVGs for exactly these glyphs.
Copying them as-is is the same move the upgrade icons made (slice-map "Upgrade icons (S-06)").

**The marketing vocabulary lives in two places.** `src/components/auth/AuthShell.astro`
and `src/components/Welcome.astro` each hand-roll the brand row, the three feature cards
and the security footer. Copy is shared through `t.marketing`, so text stays in step, but
the markup is duplicated — which is how the two surfaces could already have drifted
visually without anything noticing.

**The field model is a design-system concern, not a screen concern.** `FormField.tsx` backs
all four auth forms, and mockup `02-parent-register-web` uses the identical field treatment
(no visible label, tall input, icon in a rounded blue tile, eye toggle). Changing the shared
component is what the design actually asks for.

**Fifteen e2e locators depend on the field label staying in the accessibility tree.**
`e2e/helpers/accounts.ts:82-83` (`signInViaUI`, used by nearly every spec),
`e2e/onboarding.spec.ts:27-29,101-103`, `e2e/password-reset.spec.ts:31,53-54,68` all locate
fields with `page.getByLabel(t.auth.fields.*)`. `sr-only` preserves every one of them;
`hidden` or `aria-hidden` would break the suite wholesale.

**Two designed strings were never wired.** `t.auth.signin.noAccount` ("Nie masz konta?") and
`t.auth.signup.hasAccount` ("Masz już konto?") exist in `src/i18n/pl.ts:19,28` and are
referenced by nothing in `src/`. The mockup's two-part secondary-button label is what they
were written for.

## Desired End State

`/auth/signin` at 1536×1024 reads as the mockup: illustrated feature blocks sitting directly
on the background, an illustrated login card with tall placeholder-only fields, a blue-bordered
"Nie masz konta? **Utwórz konto**" button, a security panel, and ambient coins/chart art behind
the content. `/` carries the same brand row, feature blocks and security panel from the same
components. `/auth/signup`, `/auth/reset-password` and `/auth/update-password` inherit the new
field model. Below `lg` every surface keeps the mobile mockup's carded feature treatment.

Verify by loading `/auth/signin` and `/` at 1536 and 390 wide against
`assets/matmaverse-auth-v2-{web,mobile}/01-parent-login-*.png`, and by a green
`npm run test` + `npm run test:e2e`.

### Key Discoveries:

- The lucide substitution is documented as intentional in `public/illustrations/slice-map.md` (Notes) — this plan must supersede that bullet.
- `assets/atomic-assets-v2/svg/icons/{shield-check,globe-worlds,chart-up,lock-user,progress-bars}.svg` and `svg/brand/mathmarket-symbol.svg` are standalone gradient SVGs, copyable as-is (precedent: slice-map "Upgrade icons (S-06)").
- `shield-check.svg` and `lock-user.svg` **both** declare `<linearGradient id="g">`; `mathmarket-symbol.svg` declares `blue`/`green`/`gold`. See "Critical Implementation Details".
- `AuthShell.astro:41-101` and `Welcome.astro:22-119` duplicate the brand row, feature cards and security footer.
- `FormField.tsx` is shared by all four auth forms; mockup `02` uses the same field model, so the change belongs in the component.
- `e2e/helpers/accounts.ts:82`, `e2e/onboarding.spec.ts:27`, `e2e/password-reset.spec.ts:31` locate fields via `getByLabel` — labels must remain in the a11y tree.
- `t.auth.signin.noAccount` / `t.auth.signup.hasAccount` (`src/i18n/pl.ts:19,28`) are dead strings the mockup's button label needs.
- The mobile mockup keeps card chrome on the feature blocks; only the **web** mockup drops it. The treatment is breakpoint-dependent, not absolute.
- The web and mobile mockups **disagree** on two feature descriptions (web: "Śledź rozwój, umiejętności i osiągnięcia w czasie."; mobile: "Śledź rozwój, cele i osiągnięcia w czasie rzeczywistym."). Decision: follow the **web** mockup, since that is the layout these surfaces are built to. Recorded here so the mobile variant is not later rediscovered as drift.
- `WORLDS` is six and the strip is `grid-cols-3`, pinned by `e2e/marketing-worlds.spec.ts` and explained at `AuthShell.astro:22-27`. The mockup's four-in-a-row is stale and stays unimplemented.
- `tests/worlds-art.test.ts` is the model for asset-existence testing: reads `public/` off disk under vitest's default node environment.

## What We're NOT Doing

- **Not** rebuilding `/auth/signup` to mockup `02` — that is a 3-step wizard with its own marketing panel and a name field the app does not collect. Signup here only inherits the shared `FormField` and marketing components.
- **Not** reverting the world strip to the mockup's four cards, nor swapping the world art for the mockup's photo-real interiors. Six worlds in `grid-cols-3` is current and tested.
- **Not** renaming the brand to "MathMarket". The wordmark stays `t.brand` ("MatmaVerse"); only the *symbol* is adopted from `mathmarket-symbol.svg`.
- **Not** implementing the mockup's dashed curved arrow. It is a hand-drawn curve fitted to one set of coordinates and would break at every breakpoint.
- **Not** adding Playwright visual-regression baselines. The repo has no such tests and they would introduce a new maintenance category; asset-existence tests plus human comparison is the agreed bar.
- **Not** touching `assets/` — read-only, gitignored, never committed (`CLAUDE.md`).

## Implementation Approach

Four phases, each leaving the app coherent on its own. Art lands and is pinned first, so
later phases reference paths that provably exist. The shared marketing components come next,
which is also where the existing `AuthShell`/`Welcome` duplication is retired. The field model
is third and is the widest blast radius (four screens, fifteen e2e locators), so it gets its
own phase and its own full-suite gate. The sign-in card and page-level decoration come last,
when everything it composes is already in place.

## Critical Implementation Details

**The SVGs must be referenced as `<img src>`, never inlined.** `shield-check.svg` and
`lock-user.svg` each define `<linearGradient id="g">`, and `mathmarket-symbol.svg` defines
`blue` / `green` / `gold`. SVG element ids are document-global: inline two of these into one
page and the later definition silently wins for both, rendering one glyph with the other's
gradient. As `<img>` each file is its own document and the ids cannot collide. The cost is
that they cannot be recolored by `currentColor` — acceptable, since these are illustrations
with fixed brand colors, not UI icons.

**Labels go `sr-only`, never `hidden`.** Fifteen e2e locators resolve fields through
`getByLabel`. `sr-only` clips the label visually while leaving it in the accessibility tree,
so Playwright and screen readers both still find it. Any treatment that removes it from the
tree takes the e2e suite down with it.

**Background decorations must not create horizontal overflow.** They are absolutely positioned
near the viewport edges; without `overflow-hidden` on the shell's outer container a decoration
that overhangs will make the page body scroll sideways on narrow desktop widths. All of them
are `aria-hidden="true"`, `pointer-events-none`, and `hidden lg:block`.

---

## Phase 1: Committed art and its register

### Overview

Copy the six SVGs out of the gitignored atomic pack into `public/illustrations/`, give them a
single typed manifest so no surface hardcodes a path, record the provenance, and pin the whole
set with a test that fails when a path and a file disagree.

### Changes Required:

#### 1. The art files

**File**: `public/illustrations/` (six new files)

**Intent**: Ship the mockup's illustrated glyphs so they resolve on Vercel and in CI, where
`assets/` does not exist.

**Contract**: Copied byte-for-byte, no re-encoding, from `assets/atomic-assets-v2/`:

| Destination                                | Source                             |
| ------------------------------------------ | ---------------------------------- |
| `public/illustrations/brand-symbol.svg`     | `svg/brand/mathmarket-symbol.svg`  |
| `public/illustrations/feature-safety.svg`   | `svg/icons/shield-check.svg`       |
| `public/illustrations/feature-worlds.svg`   | `svg/icons/globe-worlds.svg`       |
| `public/illustrations/feature-progress.svg` | `svg/icons/chart-up.svg`           |
| `public/illustrations/parent-lock.svg`      | `svg/icons/lock-user.svg`          |
| `public/illustrations/decor-chart.svg`      | `svg/icons/progress-bars.svg`      |

#### 2. The art manifest

**File**: `src/data/marketing-art.ts` (new)

**Intent**: One module owning every marketing art path, so the feature icons are index-aligned
with `t.marketing.features` by construction rather than by a second hand-maintained list — the
exact failure mode that let the auth panel advertise four worlds while the app shipped six.

**Contract**: Exports `FEATURE_ICONS: readonly string[]` (index-aligned with
`t.marketing.features`) plus `BRAND_SYMBOL`, `PARENT_LOCK`, `DECOR_CHART`, `DECOR_COIN`,
`DECOR_COIN_STACK` string constants. Values are absolute `/illustrations/…` URL paths.
`DECOR_COIN` / `DECOR_COIN_STACK` point at the already-committed `coin.png` / `coin-stack.png`.

#### 3. Provenance register

**File**: `public/illustrations/slice-map.md`

**Intent**: Record where the six files came from, and retire the now-false claim that these
glyphs are rendered with lucide.

**Contract**: A new section in the style of "Upgrade icons (S-06)" — a table of destination ↔
source, stating the files are copied as-is rather than cropped. The Notes bullet beginning
*"The small feature-bullet icons (shield / globe / chart) and the form-panel avatar-lock glyph
are **not** sliced…"* is rewritten to say they are now committed SVGs from the atomic pack, with
one line on why the earlier call was reversed.

#### 4. Asset test

**File**: `tests/auth-art.test.ts` (new)

**Intent**: Make a path that points at a missing file, or a feature list that outgrows its icon
list, fail loudly instead of rendering an empty box.

**Contract**: Modeled on `tests/worlds-art.test.ts` (node environment, reads `public/` off disk).
Asserts every exported path in `src/data/marketing-art.ts` exists on disk, and that
`FEATURE_ICONS.length === t.marketing.features.length`.

### Success Criteria:

#### Automated Verification:

- New art test passes: `npx vitest run tests/auth-art.test.ts`
- Full unit suite still passes: `npm run test`
- Linting passes: `npm run lint`
- Type/astro check passes: `npm run check`

#### Manual Verification:

- Each of the six SVGs, opened in a browser, reads as its mockup counterpart (green check-shield, blue globe, rising chart, blue padlock-with-figure, shop-front symbol, bar chart)
- `slice-map.md` no longer claims these glyphs are rendered with lucide

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding.

---

## Phase 2: Shared marketing components

### Overview

Extract the brand row, feature blocks and security note into components consumed by both
`AuthShell.astro` and `Welcome.astro`, dressing them in the new art on the way, and align the
feature copy with the web mockup.

### Changes Required:

#### 1. Brand row

**File**: `src/components/marketing/BrandRow.astro` (new)

**Intent**: One brand lockup for every signed-out surface — mockup symbol as `<img>`, `t.brand`
wordmark, `t.marketing.brandTagline` beneath — replacing the flat `ShoppingCart` tile duplicated
in two files.

**Contract**: Props for alignment (centered below `lg`, left-aligned at `lg+`, matching the
existing behavior) and a size variant, since `Welcome`'s header row is more compact than
`AuthShell`'s. Symbol via `<img src={BRAND_SYMBOL}>` with empty `alt` (the wordmark beside it
carries the name).

#### 2. Feature blocks

**File**: `src/components/marketing/FeatureList.astro` (new)

**Intent**: The three value props with their illustrated icons, carded on mobile and borderless
on desktop as the two mockups respectively show.

**Contract**: Maps `t.marketing.features` zipped with `FEATURE_ICONS` from
`src/data/marketing-art.ts`. Icons are `<img>`, roughly `size-14` — an order of magnitude larger
than the current `size-5` lucide glyph, which is the change that carries most of the visual
delta. Card chrome (`bg-card border shadow-sm`) applies below `lg` and is dropped at `lg+`; text
is centered at every width, per the web mockup.

#### 3. Security note

**File**: `src/components/marketing/SecurityNote.astro` (new)

**Intent**: Replace the bare icon-plus-text line with the mockup's pale-blue rounded panel.

**Contract**: Full-width `bg-primary/5` rounded panel, padlock glyph in a tinted tile at the
left, `t.marketing.security` beside it.

#### 4. Consume in both surfaces

**Files**: `src/components/auth/AuthShell.astro`, `src/components/Welcome.astro`

**Intent**: Delete the duplicated markup in favor of the three components; the two surfaces stop
being able to drift.

**Contract**: The now-unused `ShieldCheck` / `Globe` / `TrendingUp` / `ShoppingCart` imports and
the local `featureIcons` arrays go away in both files. The **world strip stays where it is** and
is deliberately not extracted — `AuthShell` renders it `hidden lg:grid grid-cols-3` while
`Welcome` renders it `grid-cols-2` at all widths, and `AuthShell.astro:22-27` documents that its
column count is a function of `WORLDS.length`. Add a one-line comment in each recording that the
divergence is intentional.

#### 5. Feature copy

**File**: `src/i18n/pl.ts`

**Intent**: Align `t.marketing.features` with the web mockup (L-003: strings are content, edited
here, never in markup).

**Contract**: Title 2 becomes plural — "Świat zainteresowań" → "Światy zainteresowań". The three
descriptions take the web mockup's wording: "Oddzielone konta rodzica i dziecka. Bez reklam." /
"Wybierz świat dopasowany do pasji Twojego dziecka." / "Śledź rozwój, umiejętności i osiągnięcia
w czasie." Add a comment noting the mobile mockup words two of these differently and that web won.

### Success Criteria:

#### Automated Verification:

- Full unit suite passes: `npm run test`
- E2E suite passes, including `e2e/marketing-worlds.spec.ts` on both surfaces: `npm run test:e2e`
- Linting passes: `npm run lint`
- Type/astro check passes: `npm run check`
- No lucide feature icons remain in either surface: `grep -n "ShieldCheck\|TrendingUp\|ShoppingCart" src/components/auth/AuthShell.astro src/components/Welcome.astro` returns nothing

#### Manual Verification:

- At 1536 wide, `/auth/signin`'s feature blocks are borderless with large illustrated icons, matching the web mockup
- At 390 wide, the same blocks are carded, matching the mobile mockup
- `/` shows the same brand row, feature blocks and security panel as `/auth/signin`
- The security note renders as a panel, not a bare text line

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding.

---

## Phase 3: The mockup's field model

### Overview

Move `FormField` to the design's field treatment — accessible-but-invisible label, tall input,
icon in a tinted tile, placeholder carrying the field name — across all four auth forms, without
disturbing the fifteen `getByLabel` locators that depend on it.

### Changes Required:

#### 1. The field

**File**: `src/components/auth/FormField.tsx`

**Intent**: Adopt the field treatment both `01` and `02` mockups use, keeping the label in the
accessibility tree.

**Contract**: The `<Label>` keeps `htmlFor={id}` and gains `sr-only` (never `hidden` /
`aria-hidden` — see Critical Implementation Details). The input grows from `h-12` to roughly
`h-14` and keeps `rounded-xl`. The leading icon moves from a bare `size-4` glyph into a tinted
rounded tile (`bg-primary/10 text-primary`, ~`size-9`), with the input's left padding widened to
clear it. `endContent` (the eye toggle) stays right-aligned and vertically centered against the
taller field. The `error` and `hint` slots are unchanged. Props are unchanged, so no call site
needs editing for this item.

#### 2. Placeholders carry the field name

**File**: `src/i18n/pl.ts`

**Intent**: With the label visually gone, the placeholder is the only thing naming the field for
a sighted user — so it must be the field's name, as both mockups show.

**Contract**: `emailPlaceholder` → "Email"; `passwordPlaceholderSignin` → "Hasło";
`passwordPlaceholderSignup` → "Hasło"; `confirmPlaceholder` → "Powtórz hasło". Add a new
`passwordRule: "Minimum 6 znaków"` key for the hint that replaces it (next item). The `*Label`
keys are untouched — they are what every e2e locator resolves.

#### 3. The password rule moves to a persistent hint

**File**: `src/components/auth/SignUpForm.tsx`

**Intent**: `passwordPlaceholderSignup` ("Minimum 6 znaków") was the only up-front statement of
the length rule; renaming it to "Hasło" would leave the rule discoverable only *after* a failed
attempt. The existing `hint` slot, currently conditional (`SignUpForm.tsx:58-60` — shown only
once a too-short password has been typed), becomes the rule's permanent home.

**Contract**: `passwordHint` renders `t.auth.fields.passwordRule` whenever there is no error,
and keeps the existing "N characters to go" countdown behavior once the user has started typing
a short password. Net effect: the rule is visible before typing, and the countdown still appears
during typing.

#### 4. Toggle alignment

**File**: `src/components/auth/PasswordToggle.tsx`

**Intent**: Keep the eye control centered and its tap target intact against the taller field.

**Contract**: Positioning only; no behavior or accessible-name change.

### Success Criteria:

#### Automated Verification:

- Unit suite passes, including `tests/signin-form.test.tsx`: `npm run test`
- Full e2e suite passes — this is the real gate, since `signInViaUI` runs in nearly every spec: `npm run test:e2e`
- Linting passes: `npm run lint`
- Type/astro check passes: `npm run check`

#### Manual Verification:

- All four auth screens (`/auth/signin`, `/auth/signup`, `/auth/reset-password`, `/auth/update-password`) render tall placeholder-only fields with tinted icon tiles
- "Minimum 6 znaków" is visible under the signup password field before typing anything
- Tabbing through a form reaches every field; a screen reader (or the browser's accessibility inspector) still announces "Adres e-mail" / "Hasło" for the inputs
- The eye toggle sits centered in the taller field and still shows/hides the password

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding.

---

## Phase 4: The sign-in card and page composition

### Overview

Finish the screen: illustrated card header, the designed two-part secondary button, mockup hero
proportions, and the ambient background art.

### Changes Required:

#### 1. Card header art

**File**: `src/pages/auth/signin.astro`

**Intent**: Replace the `size-7` lucide `UserRound` in a tinted square with the large illustrated
padlock glyph the mockup puts at the top of the card.

**Contract**: `<img src={PARENT_LOCK}>` at roughly `size-24`, empty `alt` (the `<h1>` beneath
names the card). The `UserRound` import goes away.

#### 2. Keep exactly one "Zaloguj się" per viewport

**File**: `src/pages/auth/signin.astro`

**Intent**: The mockup's card carries only "Panel rodzica"; the accent line beside it already
says "Zaloguj się". But `AuthShell`'s hero is `hidden lg:block`, so below `lg` the card's subline
is the only thing naming the action.

**Contract**: The card's `<p>{t.auth.signin.heading}</p>` subline gains `lg:hidden`. Above `lg`
the accent line is the single occurrence; below `lg` the subline is. This also keeps the string
from resolving to two elements in any one viewport, which is what L-007 guards against.

#### 3. The designed secondary button

**File**: `src/pages/auth/signin.astro`

**Intent**: Wire the two-part label the mockup specifies, using `t.auth.signin.noAccount` — a
string that has existed unused since it was written.

**Contract**: The `/auth/signup` anchor's label becomes `noAccount` in muted weight followed by
`signupLink` in `font-bold text-primary`, and the outline variant is tinted blue
(`border-primary text-primary`) rather than the default neutral. Its accessible name is
therefore "Nie masz konta? Utwórz konto" — the string Phase 4's e2e assertion pins.

#### 4. Hero proportions

**File**: `src/components/auth/AuthShell.astro`

**Intent**: The mockup's card starts near the top of the page and is tall; ours is vertically
centered and shorter, which is why the current screen reads as smaller and looser than the design.

**Contract**: The two-column grid switches from `items-center` to top alignment, the hero heading
scales up one step at `lg`/`xl`, and the tagline gets a `max-w-*` so it wraps to two lines as in
the mockup. Grid column ratio is unchanged.

#### 5. Background decoration

**File**: `src/components/auth/AuthShell.astro`

**Intent**: Restore the ambient depth — the single existing coin is the only decoration today.

**Contract**: Adds `DECOR_COIN_STACK` (bottom-right) and `DECOR_CHART` (top-right, low opacity)
alongside the existing `DECOR_COIN`, all from `src/data/marketing-art.ts`. Every decoration is
`aria-hidden="true"`, `pointer-events-none`, `hidden lg:block`, and absolutely positioned. The
shell's outer container gets `overflow-hidden` so no decoration can make the body scroll
sideways. The mockup's dashed arrow is not implemented (see "What We're NOT Doing").

#### 6. Pin the button label

**File**: `e2e/smoke.spec.ts`

**Intent**: The `noAccount` half of the label is exactly the kind of thing that was already
written once and silently dropped; an assertion is what makes dropping it again fail.

**Contract**: The existing "anonymous /app redirects to signin" test, which already lands on
`/auth/signin`, gains one assertion that a link with the accessible name
`` `${t.auth.signin.noAccount} ${t.auth.signin.signupLink}` `` is visible.

### Success Criteria:

#### Automated Verification:

- Unit suite passes: `npm run test`
- E2E suite passes, including the new smoke assertion: `npm run test:e2e`
- Linting passes: `npm run lint`
- Type/astro check passes: `npm run check`

#### Manual Verification:

- `/auth/signin` at 1536×1024 compared side by side with `assets/matmaverse-auth-v2-web/01-parent-login-web.png`: card art, button, hero scale and decorations all read as the design
- No horizontal scrollbar appears on the body at 1024, 1280, 1536 or 1920 wide
- At 390 wide the screen matches `assets/matmaverse-auth-v2-mobile/01-parent-login-mobile.png`: no decorations, no world strip, carded features, "Zaloguj się" still named on the card
- Decorations sit behind the content and never intercept a click on the card or its controls
- Signing in with the seeded local account still works end to end

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human.

---

## Testing Strategy

### Unit Tests:

- `tests/auth-art.test.ts` (new) — every exported marketing art path exists on disk; `FEATURE_ICONS` and `t.marketing.features` are the same length.
- `tests/signin-form.test.tsx` (existing) — must stay green through the Phase 3 field change; it locates the checkbox by role + accessible name and the reset link by role, so the `sr-only` label change should not touch it. If it goes red, the label left the accessibility tree.

### Integration Tests:

- `npm run test:e2e` in full after Phase 3 — `signInViaUI` (`e2e/helpers/accounts.ts:82`) runs in nearly every spec, so the suite as a whole is the field-model regression test.
- `e2e/marketing-worlds.spec.ts` after Phase 2 — proves the extracted components did not drop the world strip from either surface.
- `e2e/smoke.spec.ts` after Phase 4 — pins the two-part secondary-button label.

### Manual Testing Steps:

1. `npm run dev`, open `/auth/signin` at 1536×1024 beside `assets/matmaverse-auth-v2-web/01-parent-login-web.png` and walk region by region: brand, hero, features, worlds, card, security panel, decorations.
2. Resize to 390 wide and compare against `assets/matmaverse-auth-v2-mobile/01-parent-login-mobile.png` — features carded, no strip, no decorations.
3. Open `/` and confirm brand row, features and security panel are visually identical to the auth panel's.
4. Visit `/auth/signup`, `/auth/reset-password`, `/auth/update-password` and confirm the new field model applied cleanly and no label text is visually orphaned.
5. Sign in with the seeded local account (`npm run db:seed`) and confirm the flow still lands in `/app`.
6. Inspect the login card in the browser's accessibility tree — both inputs must expose their Polish label names.

## Performance Considerations

The six SVGs are 342–1500 bytes each and replace rendered lucide components; net page weight is
effectively unchanged. Decorations reuse `coin.png` / `coin-stack.png`, already served on this
route. `<img>` for the glyphs means six extra requests on a cold load, all trivially small and
cacheable — worth trading against the gradient-id collision that inlining would cause.

## Migration Notes

None. No schema, no stored data, no route or API contract changes. Every change is presentational
or in the i18n dictionary; rollback is a revert.

## References

- Design source: `assets/matmaverse-auth-v2-web/01-parent-login-web.png`, `assets/matmaverse-auth-v2-mobile/01-parent-login-mobile.png`, `assets/matmaverse-auth-v2-web/02-parent-register-web.png`
- Art source: `assets/atomic-assets-v2/svg/`
- Provenance register: `public/illustrations/slice-map.md`
- Asset-test model: `tests/worlds-art.test.ts`
- Prior surface work: `context/archive/2026-06-27-matmaverse-design-system/`, `context/archive/2026-08-22-web-shell-and-mockup-parity/`
- Standing rules: `CLAUDE.md` ("Design source of truth"), `context/foundation/lessons.md` L-003

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Committed art and its register

#### Automated

- [x] 1.1 New art test passes: `npx vitest run tests/auth-art.test.ts` — 8850b18
- [x] 1.2 Full unit suite still passes: `npm run test` — 8850b18
- [x] 1.3 Linting passes: `npm run lint` — 8850b18
- [x] 1.4 Type/astro check passes: `npm run check` — 8850b18

#### Manual

- [x] 1.5 Each of the six SVGs reads as its mockup counterpart — 8850b18
- [x] 1.6 `slice-map.md` no longer claims these glyphs are rendered with lucide — 8850b18

### Phase 2: Shared marketing components

#### Automated

- [x] 2.1 Full unit suite passes: `npm run test`
- [x] 2.2 E2E suite passes, including `e2e/marketing-worlds.spec.ts` on both surfaces: `npm run test:e2e`
- [x] 2.3 Linting passes: `npm run lint`
- [x] 2.4 Type/astro check passes: `npm run check`
- [x] 2.5 No lucide feature icons remain in either surface

#### Manual

- [x] 2.6 At 1536 wide, feature blocks are borderless with large illustrated icons
- [x] 2.7 At 390 wide, the same blocks are carded
- [x] 2.8 `/` shows the same brand row, feature blocks and security panel as `/auth/signin`
- [x] 2.9 The security note renders as a panel, not a bare text line

### Phase 3: The mockup's field model

#### Automated

- [ ] 3.1 Unit suite passes, including `tests/signin-form.test.tsx`: `npm run test`
- [ ] 3.2 Full e2e suite passes: `npm run test:e2e`
- [ ] 3.3 Linting passes: `npm run lint`
- [ ] 3.4 Type/astro check passes: `npm run check`

#### Manual

- [ ] 3.5 All four auth screens render tall placeholder-only fields with tinted icon tiles
- [ ] 3.6 "Minimum 6 znaków" is visible under the signup password field before typing
- [ ] 3.7 Every field is reachable by tab and still announces its Polish label
- [ ] 3.8 The eye toggle sits centered in the taller field and still works

### Phase 4: The sign-in card and page composition

#### Automated

- [ ] 4.1 Unit suite passes: `npm run test`
- [ ] 4.2 E2E suite passes, including the new smoke assertion: `npm run test:e2e`
- [ ] 4.3 Linting passes: `npm run lint`
- [ ] 4.4 Type/astro check passes: `npm run check`

#### Manual

- [ ] 4.5 `/auth/signin` at 1536×1024 matches the web mockup region by region
- [ ] 4.6 No horizontal scrollbar at 1024, 1280, 1536 or 1920 wide
- [ ] 4.7 At 390 wide the screen matches the mobile mockup
- [ ] 4.8 Decorations sit behind content and never intercept a click
- [ ] 4.9 Signing in with the seeded local account still works end to end
