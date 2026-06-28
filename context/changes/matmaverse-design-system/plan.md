# MatmaVerse Design System — Implementation Plan

## Overview

Replace the starter "cosmic" dark glassmorphism with the canonical MatmaVerse **light** design language and apply it to the existing auth surfaces. This change establishes the design system **once** — a light oklch token set, themed shadcn primitives, and illustration assets sliced from the canonical mockups — then pixel-faithfully restyles signin / signup / confirm-email and gives `/app` a light-consistency pass. It is a **pure visual change**: no routing, auth behavior, or copy changes. Sequenced after S-01a (archived) and before Part B (S-01b), so Part B's child surfaces are built on the real design rather than restyled twice.

## Current State Analysis

(Grounded in this session's exploration; design source `assets/matma-verse/` is local-only per CLAUDE.md.)

- **Two disconnected styling systems.** The shadcn "new-york" tokens in `src/styles/global.css :root` are the **default grayscale** (`oklch(… 0 0)`, no hue) and are *not* consumed by the pages. The actual auth/app surfaces use a hand-rolled dark theme: a `bg-cosmic` gradient utility (defined in `global.css`) plus glass cards (`bg-white/10`, `backdrop-blur-xl`) and blue→purple gradient text. The mockups match neither — they are **light** (pale-blue bg, white cards, solid blue primary, gold-coin accents).
- **`bg-cosmic` reach:** used by the 4 auth surfaces (`signin`, `signup`, `confirm-email`, `app`) **and** by `Welcome.astro` (the unauthenticated `/` scaffold). Defined in `global.css` — removing it breaks `/`. Glass/gradient styling also lives in `Topbar.astro`, `Banner.astro`, and `FormField.tsx`.
- **Primitives:** `src/components/ui/button.tsx` already exists (default-themed); no Card/Input/Label/Checkbox installed. The auth forms use custom React components (`FormField`, `PasswordToggle`, `SubmitButton`, `ServerError`) with hand-rolled markup, not shadcn primitives.
- **Typography:** no web font wired; default system stack. No `@fontsource`/Nunito dependency.
- **Palette (sampled from `01-parent-login-web.png`):** primary blue `#2473F3`, page bg `#F3F8FE`, card `#FFFFFF`, ink `#2D374C`, gold/coin accent `#F3BE5D`.
- **Behavior baseline:** 29 request-level tests (auth routing, gating, confirm, error mapping) are green and behavior-only — none assert visual markup, so a pure restyle must keep them green untouched.

## Desired End State

The app presents a single coherent **light MatmaVerse** look. The auth surfaces (`/auth/signin`, `/auth/signup`, `/auth/confirm-email`) match the `auth-v2` web mockups — two-column marketing-panel + form-card on desktop, stacking to a single column on mobile, with illustration art rendered from committed assets. `/app` and the unauthenticated `/` scaffold sit on the same light base (no dark `bg-cosmic` anywhere). shadcn primitives (Button/Card/Input/Label/Checkbox) are themed from the token set and composed by the auth components. The full test suite stays green; `npm run build` and `npm run lint` pass.

Verify: `npm run lint` + `npm run build` green; `npm test` green (29 tests, unchanged); manual visual diff of each auth surface against its mockup; no `bg-cosmic` remains in `src/`.

### Key Discoveries:

- **`button.tsx` already exists** (`src/components/ui/button.tsx`) — Phase 3 rethemes it via tokens rather than re-adding it.
- **Removing `bg-cosmic` is a cross-cutting break** — `Welcome.astro` depends on it, so the `/` scaffold must be light-neutralized in the **same phase** as the token swap (Phase 1), not deferred.
- **Tokens drive everything** — once `:root` carries the MatmaVerse palette and `@theme` maps it, shadcn primitives and Tailwind utilities inherit it; this is why the foundation lands before any screen consumes it.
- **Mobile mockups exist** (`…-auth-v2-mobile/`) — the two-column layout has a defined single-column stack to build to, not improvise.
- Design spec with locked decisions: `docs/superpowers/specs/2026-06-27-matmaverse-design-system-design.md`.

## What We're NOT Doing

- **No child-primitive component library** (oversized buttons/cards/tap-target primitives) — Part B.
- **No `ui-v2` screens** — child-dashboard, world-selection, change-mission, pricing-inventory, skill-path, parent-goals are all Part B / later.
- **No auth screens beyond the three that exist** — password-reset (`04`), child-profile-picker (`05`), parent-PIN (`06`) are Part B / out of S-01.
- **No pixel-faithful restyle of `/`** — it is light-neutralized only (no `/` mockup exists); no marketing treatment.
- **No behavior / copy / routing / i18n-string changes** — pure visual; every user-visible string stays sourced from the existing `i18n` dictionary.
- **No brand rename in code/docs** — brand stays `MatmaVerse`; the mockups' "MathMarket" wordmark is treated as outdated (separate follow-up).
- **No dark-mode support** — v1 is light-only; the `.dark` block is kept (so shadcn doesn't break) but untested.

## Implementation Approach

Foundation-first (Approach A): land the token system + light base + font (Phase 1), commit the sliced illustration assets (Phase 2), theme the shadcn primitives and refactor the auth components onto them (Phase 3), build the reusable two-column auth shell on signin as the reference screen (Phase 4), then propagate the shell to the remaining surfaces (Phase 5). Each phase is independently committable, keeps the 29-test suite green, and leaves the app in a coherent visual state.

## Critical Implementation Details

- **Token swap and `/`-neutralize are one atomic phase.** `bg-cosmic` is defined in `global.css` and consumed by `Welcome.astro`; deleting the utility while leaving `Welcome` referencing it breaks the build/render. Phase 1 must remove `bg-cosmic`, repoint the auth surfaces' page-background wrappers to the light base, AND light-neutralize `Welcome/Topbar/Banner` together.
- **Illustration assets must live in `public/` (or `src/assets/`), never `assets/`.** `assets/` is gitignored (CLAUDE.md) and would not reach CI/Vercel; the sliced PNGs go to `public/illustrations/` so they ship.
- **The mockups are local-only.** Implementation reads `assets/matma-verse/…` directly (present on the maintainer's machine). A cloud/CI agent will not have them — note in the phase if work is attempted without the assets present.

## Phase 1: Design tokens + light base + typography

### Overview

Establish the MatmaVerse light token system and font, swap the global base off `bg-cosmic`, and light-neutralize the `/` scaffold so the whole app renders coherently on the new base.

### Changes Required:

#### 1. Light token palette + theme wiring

**File**: `src/styles/global.css`

**Intent**: Replace the grayscale shadcn token values in `:root` with the MatmaVerse light palette and bump the radius, so every shadcn primitive and Tailwind utility inherits the brand look.

**Contract**: `:root` tokens expressed as oklch — `--primary` (blue `#2473F3`), `--primary-foreground` (white), `--background` (`#F3F8FE`), `--card`/`--popover` (white), `--foreground` (ink `#2D374C`), `--accent` (gold `#F3BE5D`) and a soft blue-gray `--muted`/`--border`/`--input`/`--ring` ramp derived from those; `--radius` raised from `0.625rem` to `~0.875rem`. The existing `@theme inline` block already maps these variables to Tailwind color tokens — keep that mapping. Convert hex → oklch (the file already uses oklch).

#### 2. Remove the dark cosmic utility + set the light base

**File**: `src/styles/global.css`, `src/layouts/Layout.astro`

**Intent**: Drop the `bg-cosmic` gradient utility and ensure the document base is the light theme.

**Contract**: Delete the `@utility bg-cosmic { … }` block; `body` already `@apply bg-background text-foreground` (now light). `Layout.astro` sets `<html>`/`<body>` to the light base and applies the brand font class. No `lang`/behavior change (still `lang="pl"`).

#### 3. Self-hosted Nunito font

**File**: `package.json`, `src/layouts/Layout.astro`, `src/styles/global.css`

**Intent**: Adopt Nunito (friendly rounded sans, full Polish glyphs) self-hosted via Fontsource (no Google-CDN request — GDPR-clean for the EU audience), wired as the default UI font.

**Contract**: Add dependency `@fontsource-variable/nunito`; import it in `Layout.astro` frontmatter (or a global entry); set `--font-sans` / the Tailwind font token to Nunito with a system fallback so `font-sans` utilities and the `body` pick it up.

#### 4. Light-neutralize the `/` scaffold

**File**: `src/components/Welcome.astro`, `src/components/Topbar.astro`, `src/components/Banner.astro`

**Intent**: Move the unauthenticated `/` scaffold onto the light base so removing `bg-cosmic` doesn't break it and the app is visually consistent — without a pixel-faithful redesign (no `/` mockup).

**Contract**: Replace `bg-cosmic` / glass (`bg-white/10`, `backdrop-blur`, blue→purple gradient text) usages with light token-based equivalents (`bg-background`, `bg-card`, `text-foreground`, `text-primary`). Structure/content unchanged. `Topbar` already links to `/app` (from S-01a). English scaffold copy stays as-is (out of scope).

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Full suite still green: `npm test`
- No `bg-cosmic` remains in `src/`: `! grep -rq "bg-cosmic" src/`

#### Manual Verification:

- `/`, `/auth/signin`, `/auth/signup`, `/auth/confirm-email`, `/app` all render on the light base with Nunito; no dark cosmic background or unreadable contrast anywhere

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: Illustration asset pipeline

### Overview

Extract the illustration art from the flattened mockup PNGs into committed, shippable image files with a documented slice map.

### Changes Required:

#### 1. Slice illustrations into committed assets

**File**: `public/illustrations/*` (new), `public/illustrations/slice-map.md` (new)

**Intent**: Crop the world-card art (Piekarnia/Kawiarnia/Galaktyczna baza/Sklep księgarnia), decorative coins, characters, and the hero illustration out of the `auth-v2-web` mockup PNGs into individual raster files the app can render, committed so they reach Vercel.

**Contract**: Output PNGs under `public/illustrations/` with stable, descriptive names (e.g. `world-piekarnia.png`, `coin.png`, `hero-login.png`). `slice-map.md` records, per output file, the source mockup PNG + crop box (x,y,w,h) so slices are reproducible. Raster, fixed-resolution — a caveat note in `slice-map.md` records that vector/source exports can replace these later. Source PNGs live in `assets/matma-verse/` (local-only); slicing is done on the maintainer's machine.

### Success Criteria:

#### Automated Verification:

- Build passes (assets resolve): `npm run build`
- Lint passes: `npm run lint`
- `public/illustrations/` contains the sliced files and `slice-map.md`: `ls public/illustrations/`

#### Manual Verification:

- Each sliced image opens and is the correct crop (world cards, coins, hero) with acceptable edge quality

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: shadcn primitives + auth-component refactor

### Overview

Install and theme the shadcn primitives the auth forms need, and refactor the custom auth components to compose them — building the reusable themed layer.

### Changes Required:

#### 1. Add + theme shadcn primitives

**File**: `src/components/ui/{card,input,label,checkbox}.tsx` (new), `src/components/ui/button.tsx` (retheme)

**Intent**: Bring in the primitives the auth surfaces use, themed from the Phase-1 tokens. `button.tsx` already exists — adjust its variants/sizes to the MatmaVerse look (generous default size as groundwork for PRD tap targets) rather than re-adding it.

**Contract**: `npx shadcn@latest add card input label checkbox` lands them in `src/components/ui/`. They consume the token CSS variables automatically. Button keeps its variant API; primary = blue, secondary/outline per mockup. Merge classes with `cn()`.

#### 2. Refactor auth components onto the primitives

**File**: `src/components/auth/{FormField,PasswordToggle,SubmitButton,ServerError}.tsx`

**Intent**: Replace hand-rolled markup/glass styling in the shared auth components with compositions of the shadcn primitives, so every auth surface inherits the themed look from one place.

**Contract**: `FormField` composes `Label` + `Input` (+ icon/`endContent` slots it already supports); `SubmitButton` wraps `Button`; `ServerError` becomes a token-styled alert (no glass); `PasswordToggle` restyled to tokens. Public props/behavior of each component unchanged (the forms keep importing them the same way). All strings still from `i18n`.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Full suite green: `npm test`

#### Manual Verification:

- The signin/signup forms render with themed inputs/labels/buttons (no glass), fields + password toggle + submit + server-error all function as before

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: signin reference restyle

### Overview

Build the reusable two-column auth layout on `signin` as the reference screen — the marketing panel (with sliced illustrations) beside the form card — pixel-faithful to mockup `01`, responsive to a single column on mobile.

### Changes Required:

#### 1. Reusable auth shell

**File**: `src/components/auth/AuthShell.astro` (new) (or `.tsx` if interactivity needed — default Astro)

**Intent**: A layout component holding the two-column structure: a left marketing panel (hero heading, three feature bullets, the four world cards, decorative coins) and a right slot for the form card. Built once here, reused by Phase 5.

**Contract**: Accepts the form (and optionally page-specific marketing copy) via slot/props; renders the marketing panel from `i18n` strings + `public/illustrations/` art; two-column on `md+`, single-column stack below the breakpoint (marketing panel collapses/relocates per the mobile mockup). Token-styled (`bg-card`, `text-foreground`, `text-primary`, gold accents). No behavior.

#### 2. Restyle signin to the shell

**File**: `src/pages/auth/signin.astro`

**Intent**: Render the existing `SignInForm` inside `AuthShell`, matching mockup `01`.

**Contract**: `signin.astro` wraps `<SignInForm client:load>` (unchanged) in `AuthShell`; drops the old glass card wrapper. The `?error=` pass-through to `SignInForm serverError` is preserved. Heading/links still from `i18n`.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Full suite green: `npm test`

#### Manual Verification:

- `/auth/signin` matches mockup `01` on desktop (two-column, illustrations, form card) and stacks cleanly to a single column on a narrow viewport; signin still works end-to-end

**Implementation Note**: Pause for manual confirmation before Phase 5.

---

## Phase 5: Propagate to signup + confirm-email + /app

### Overview

Apply the Phase-4 shell + themed primitives to the remaining surfaces.

### Changes Required:

#### 1. signup

**File**: `src/pages/auth/signup.astro`

**Intent**: Render `SignUpForm` inside `AuthShell`, matching mockup `02`.

**Contract**: Same shell pattern as signin; `?error=` pass-through preserved; copy from `i18n`.

#### 2. confirm-email interstitial

**File**: `src/pages/auth/confirm-email.astro`

**Intent**: Restyle the check-your-email interstitial (and its resend form / states) to the light theme per mockup `03`.

**Contract**: Token-styled centered card (mockup `03` is not the two-column marketing layout); keep the existing email/resent/error query handling, the resend `<form action="/api/auth/resend">`, and the `isAutoConfirmed` branch — visual-only change, all strings from `i18n`.

#### 3. `/app` light-consistency pass

**File**: `src/pages/app.astro`

**Intent**: Bring the placeholder authenticated landing onto the light theme + primitives (no dedicated mockup; not the child dashboard — that's Part B).

**Contract**: Token-styled card + themed `Button` for signout; preserves `Astro.locals.user` rendering and the Part-B extension-point comment.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Full suite green: `npm test`
- No `bg-cosmic` anywhere in `src/`: `! grep -rq "bg-cosmic" src/`

#### Manual Verification:

- `/auth/signup` matches mockup `02` (incl. mobile stack); `/auth/confirm-email` matches mockup `03` with working resend; `/app` is on-brand light; the whole app is visually coherent end-to-end

**Implementation Note**: Final phase — roll up pending manual items and confirm before closeout.

---

## Testing Strategy

### Unit / Integration Tests:

- **No new tests** — this is a pure visual change and the existing 29 request-level tests assert behavior (routing, gating, confirm, error mapping), not markup. The bar is that they stay green untouched through every phase (a restyle that breaks them means behavior leaked in).

### Manual Testing Steps:

1. `npm run dev`; visit `/`, `/auth/signin`, `/auth/signup`, `/auth/confirm-email`, `/app` — all light, Nunito, coherent.
2. Diff each auth surface against its mockup (`01`/`02`/`03`) on desktop; shrink the viewport and confirm the single-column stack.
3. Exercise behavior unchanged: sign in (→ `/app`), bad-creds error renders in the themed alert, signup → interstitial, resend works.

## Performance Considerations

Self-hosted Nunito (variable font) adds one font asset — subset/variable keeps it small; self-hosting avoids a third-party request and suits the ≤3s cold-load NFR. Sliced PNGs are static `public/` assets served by the CDN. No SSR cost change.

## Migration Notes

None — no schema/data/route changes. Purely presentational; `config.toml` and migrations untouched.

## References

- Design spec (locked decisions): `docs/superpowers/specs/2026-06-27-matmaverse-design-system-design.md`
- Design source of truth (local-only): `assets/matma-verse/math-economy-{auth,ui}-v2-{web,mobile}/`
- Prior change: `context/archive/2026-06-26-parent-signup-first-profile-and-start-screen/`
- shadcn "new-york" config: `components.json`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Design tokens + light base + typography

#### Automated

- [x] 1.1 Lint passes — 2a846cc
- [x] 1.2 Build passes — 2a846cc
- [x] 1.3 Full suite still green — 2a846cc
- [x] 1.4 No `bg-cosmic` remains in src/ — 2a846cc

#### Manual

- [x] 1.5 All surfaces render on the light base with Nunito; no dark cosmic / contrast issues — 2a846cc

### Phase 2: Illustration asset pipeline

#### Automated

- [x] 2.1 Build passes (assets resolve) — ca3b7d8
- [x] 2.2 Lint passes — ca3b7d8
- [x] 2.3 public/illustrations/ contains sliced files + slice-map.md — ca3b7d8

#### Manual

- [x] 2.4 Each sliced image is the correct crop with acceptable edge quality — ca3b7d8

### Phase 3: shadcn primitives + auth-component refactor

#### Automated

- [x] 3.1 Lint passes — c31ecb9
- [x] 3.2 Build passes — c31ecb9
- [x] 3.3 Full suite green — c31ecb9

#### Manual

- [x] 3.4 Signin/signup forms render with themed primitives (no glass); fields/toggle/submit/server-error all function — c31ecb9

### Phase 4: signin reference restyle

#### Automated

- [x] 4.1 Lint passes
- [x] 4.2 Build passes
- [x] 4.3 Full suite green

#### Manual

- [ ] 4.5 /auth/signin matches mockup 01 desktop + stacks single-column on mobile; signin works end-to-end

### Phase 5: Propagate to signup + confirm-email + /app

#### Automated

- [ ] 5.1 Lint passes
- [ ] 5.2 Build passes
- [ ] 5.3 Full suite green
- [ ] 5.4 No `bg-cosmic` anywhere in src/

#### Manual

- [ ] 5.5 signup (02) + confirm-email (03, resend works) + /app on-brand; app visually coherent end-to-end
