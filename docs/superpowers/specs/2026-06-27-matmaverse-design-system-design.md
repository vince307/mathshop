# MatmaVerse Design System — Design Spec

- **Date**: 2026-06-27
- **Status**: approved (brainstorming) — ready for planning
- **Sequenced**: AFTER S-01a (`parent-signup-first-profile-and-start-screen`, archived), BEFORE Part B (S-01b)
- **Why now**: S-01a deliberately shipped on the starter "cosmic" dark theme (localization/behavior only). This change establishes the real MatmaVerse visual language once, so Part B's child surfaces are built on it rather than restyled twice.
- **Design source of truth**: `assets/matma-verse/math-economy-{auth,ui}-v2-{web,mobile}/` (local-only PNG mockups, per CLAUDE.md). Auth set: `01-parent-login`, `02-parent-register`, `03-email-verification` (also `04-password-reset`, `05-child-profile`, `06-parent-pin` — OUT of scope here).

## Goal

Replace the hand-rolled dark "cosmic" glassmorphism on the existing auth/`/app` surfaces with the canonical MatmaVerse **light** design language — a token system + themed shadcn primitives + sliced illustration assets — and restyle the five existing surfaces pixel-faithfully to the `auth-v2` mockups. Pure visual change: no routing, behavior, or copy changes.

## Decisions (locked during brainstorming)

| Decision | Choice |
|---|---|
| Scope | Tokens + restyle EXISTING surfaces (signin / signup / confirm-email / `/app` + shared auth components). Child primitives deferred to Part B. |
| Brand | **MatmaVerse** stays (`t.brand`). Mockups' "MathMarket" wordmark treated as outdated; a code/docs rename pass is a separate follow-up. |
| Component strategy | Adopt + theme shadcn "new-york" primitives; refactor custom auth components to compose them. |
| Fidelity | Pixel-faithful, including illustrations. |
| Art assets | Slice illustrations from the flattened mockup PNGs into committed raster files. |
| Sequencing | Foundation-first, then screen-by-screen (Approach A). |
| Dark mode | Light-only for v1; `.dark` token block kept (so shadcn doesn't break) but untested. |

## 1. Design tokens (foundation)

Replace the default grayscale shadcn tokens and remove the `bg-cosmic` dark theme. Define the MatmaVerse light palette as oklch CSS variables in `src/styles/global.css :root`, surfaced through Tailwind's `@theme` so every utility + shadcn component inherits them.

Palette (sampled from `01-parent-login-web.png`; express as oklch in `global.css`):

| Token | Value (hex source) | Role |
|---|---|---|
| `--primary` | `#2473F3` | brand blue — buttons, links, active states |
| `--primary-foreground` | `#FFFFFF` | text on primary |
| `--background` | `#F3F8FE` | pale-blue page background |
| `--card` | `#FFFFFF` | card/surface |
| `--foreground` | `#2D374C` | dark-slate ink (headings/body) |
| `--accent` | `#F3BE5D` | gold/coin — rewards, currency, highlights |
| `--muted`, `--border`, `--ring` | derived | soft blue-grays from the above |

- **Radius**: `--radius` `0.625rem` → `~0.875rem` (mockup cards are rounder).
- **Typography**: adopt **Nunito** (friendly rounded sans, full Polish glyphs) self-hosted via `@fontsource-variable/nunito` (self-hosted, not Google-CDN → GDPR-clean for the EU audience). System sans fallback. Wire into the Tailwind theme + `Layout.astro`.
- `Layout.astro` drops `bg-cosmic`, applies the light base + font.

## 2. Component layer (themed shadcn primitives)

- `npx shadcn@latest add button card input label checkbox` → land in `src/components/ui/`, auto-inheriting the tokens.
- Refactor the existing custom auth components (`FormField`, `PasswordToggle`, `SubmitButton`, `ServerError`) to **compose** the shadcn primitives instead of hand-rolled markup.
- Button default size is generous (groundwork for PRD oversized tap targets, `prd-v2.md:146`), but the full **child-primitive library stays out** (Part B).
- Merge classes with `cn()` per CLAUDE.md.

## 3. Illustration asset pipeline

- Slice world-card art, coins, characters, and the hero illustration out of the flattened mockup PNGs into committed raster files under **`public/illustrations/`** (NOT the gitignored `assets/`, so they ship to Vercel).
- Keep a documented slice map (source PNG + crop box) alongside the output.
- **Caveat**: raster, fixed-resolution, possible soft edges — swappable later if true vector/source exports become available.

## 4. Per-screen restyle (pixel-faithful)

Dependency order; each step committable and suite-green:

1. **signin** — reference screen. Full two-column layout: left marketing panel (hero, three feature bullets, four sliced world cards, decorative coins) + right form card → mockup `01`.
2. **signup** → mockup `02`.
3. **confirm-email** → mockup `03`.
4. **`/app`** — no dedicated auth mockup (Part-A placeholder); light-theme consistency pass on-brand, **not** the full child-dashboard build (Part B).

## 5. Scope guardrails (NOT doing)

- No child-primitive component library (Part B).
- No child-dashboard / world-selection / other `ui-v2` screens.
- No password-reset (`04`) / child-profile-picker (`05`) / parent-PIN (`06`) screens (Part B or out of S-01).
- No behavior / copy / routing changes — pure visual; all strings stay sourced from `i18n`.
- No brand rename in code/docs (separate follow-up); brand stays MatmaVerse.

## 6. Testing / verification

- The 29 existing request-level tests are behavior-only and **must stay green** (no routing/auth touched).
- Visual correctness verified **manually against the mockups**, per screen.
- `npm run lint` + `npm run build` green. No new test runner.

## Open items for planning

- Exact oklch conversions of the sampled hex values + the derived muted/border ramp.
- Precise slice coordinates per illustration (determined during implementation against the PNGs).
- Whether `signin`'s two-column layout needs a responsive single-column fallback (mobile mockups exist: `…-auth-v2-mobile/`).
