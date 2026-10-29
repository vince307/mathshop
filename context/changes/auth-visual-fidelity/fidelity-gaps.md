# Fidelity gaps — maintainer's visual pass, 2026-09-04

**Verdict: the six screens do NOT yet read as the `matmaverse-auth-v2` mockups.** The
maintainer reviewed the landed change (`b6b34ed`) and rejected the current state:
"to nadal nie wygląda tak jak na mockupie, a wszystkie elementy są wycięte i gotowe
do użycia." This file is the handoff for the session that closes the gap. It was
produced by screenshotting every screen live at 1536×1024 against the dev server
(seeded account `rodzic@mathshop.test` / `haslo123`, PIN `1234`) and comparing each
against its `assets/matmaverse-auth-v2-web/0N-*-web.png` mockup. The audit
screenshots are kept in `.playwright-mcp/fidelity-audit-2026-09-04/` (gitignored —
regenerate if absent).

**Standing constraints still apply**: mockups are binding (CLAUDE.md), assets must be
copied into `public/` and registered in `public/illustrations/slice-map.md`, no code
path may resolve `assets/`, no inlined SVG may declare an `id`
(`tests/auth-art.test.ts`), all strings Polish. The product name stays **MatmaVerse**
(deliberate rebrand — never copy "MathMarket" from the mockups).

**This supersedes two "accepted deviations" in `change.md`.** The shared-AuthShell
marketing panel on screens 02/04 and the "presentation only, no per-screen panels"
stance were recorded as deliberate. The maintainer's verdict overrides them: build to
the mockups. Where a deviation below is still genuinely open (product behaviour, not
looks), it is listed under **Open decisions**.

---

## Root causes, cross-screen (fix these first — they explain most of the distance)

### RC1 — Flat SVG icons shipped where the mockup is soft-3D rendered art

The single biggest visual gap. The extraction provides BOTH a flat `svg/icons/` set
and the mockup's actual soft-3D **PNG cutouts** (`png/cutouts/`). The change committed
the flat SVGs (`public/illustrations/auth/*.svg`) for the brand mark, the three
feature icons, and the sign-in card hero — so every screen reads "flat vector" where
the mockup reads "rendered 3D". The PNG cutouts are sitting ready:

| Committed today (flat) | Mockup look, ready to use |
| --- | --- |
| `public/illustrations/auth/brand-mark.svg` | `00-shared-auth-assets/png/cutouts/brand-mark.png` (storefront + basket + zł coin) |
| `feature-safety.svg` (flat green shield) | `01-parent-login-extracted/png/cutouts/feature-safe-learning.png` (3D shield) |
| `feature-worlds.svg` (flat globe) | `01-…/png/cutouts/feature-worlds.png` (3D globe) |
| `feature-progress.svg` (flat bars) | `01-…/png/cutouts/feature-child-progress.png` (3D bars + arrow) |
| `hero-parent-security.svg` | `01-…/png/cutouts/login-hero-parent-security.png` (person + shield **with laurel leaves**) |
| `coin.svg`, `coin-stack.svg`, `decor-chart.svg`, `decor-receipt.svg` (outline style) | `00-shared…/png/cutouts/decor-floating-coin.png`, `decor-coin-stack.png`, per-screen `decor-*` PNGs (soft 3D) |

Swap the committed art to the PNG cutouts (keep the SVGs only where a glyph is UI
chrome, e.g. field gutter icons, eye toggle). Update `slice-map.md` rows accordingly.
Known caveat from `change.md`: several PNG cutouts have near-white keying holes —
place them on white cards or give them a card/circle backdrop.

### RC2 — Everything is smaller and airier than the mockup; pages scroll

Every mockup is a **single-viewport composition at ~1536×1024** — card, panel,
decorations and the security strip all visible at once. The live screens scroll
(signin ~1.1×, signup 1183 px tall) because the left panel's world grid is oversized
and the card is undersized. Concrete deltas measured on screen 01:

- Form fields: mockup ≈ 64–70 px tall; live `h-14` (56 px).
- Primary button: mockup ≈ 64–72 px tall, large radius; live ≈ 44 px (`h-11`-ish).
- Card hero: mockup ≈ 260 px wide with side leaves; live noticeably smaller, no leaves
  (leaves are part of `login-hero-parent-security.png` — RC1 fixes this too).
- Card headings: mockup display-size (~40 px); live ~30 px.
- World tiles: mockup = ONE row of four compact tiles, image full-bleed to the tile
  edge, white label bar with a small colored glyph before the name; live = 2×3 grid of
  large padded tiles, image floating in whitespace, label without glyph. Six worlds is
  correct product-wise (six-worlds-catalogue) — render them as one row of six compact
  full-bleed tiles (or 3+3 at the mockup's tile size), not the current oversized grid.
- Net effect to aim for: the whole left panel + security strip fits 1024 px height.

### RC3 — Screens 02 and 04 wear screen 01's marketing panel instead of their own

`AuthShell` renders one shared panel (3 features + world grid) on all four auth
routes. Mockups 02 and 04 have **no world grid at all** and completely different left
panels (details per screen below). The sharing was a recorded deviation; it is now
overridden. Suggested shape: keep `AuthShell` as the layout frame (brand row, h1
handling, card slot) but give it a `panel` slot/variant so each screen provides its
own left-panel content; screens 01 and 03 keep what they have.

### RC4 — Background decorations are missing or wrong-styled on every screen

Mockups scatter soft-3D decorations (coin stacks, receipts, shields, plants, books,
backpack, clouds, sparkles, dotted paths). Live pages have at most 2–3 faint
**outline** decorations (top-right "coins" is a wireframe, not the mockup's gold
stack). Every decoration exists as a cutout — per-screen `decor-*.png` lists below.
Keep them `aria-hidden`, behind content, never intercepting clicks (Manual 4.8 rule).

---

## Per-screen gap lists

### 01 — `/auth/signin` vs `01-parent-login-web.png`

Covered mostly by RC1/RC2/RC4. Screen-specific items:

- Card hero: use `login-hero-parent-security.png` (has the laurel leaves), sized like
  the mockup (~¼ of card height).
- World tile labels: mockup shows a small glyph before each name (wheat, cup, planet,
  star). Live labels are bare text.
- Bottom-right gold coin stack + bottom chart (`decor-bottom-chart.png`,
  `decor-coin-stack.png`) and top-right receipt+coins (`decor-top-right-security.png`,
  shared `decor-coin-stack.png`) missing in mockup style.
- Security strip must be visible within 1024 px height (RC2).
- BrandRow: verify the bicolor lockup — mockup splits the name into blue + green
  ("Math"/"Market"); live "MatmaVerse" reads single-color. Map to "Matma"/"Verse".
- Files: `src/components/auth/AuthShell.astro`, `src/components/marketing/*`,
  `src/components/auth/SignInForm.tsx`, `FormField.tsx`, `SubmitButton.tsx`,
  `src/data/marketing-art.ts`.

### 02 — `/auth/signup` vs `02-parent-register-web.png`

- **Left panel is wrong wholesale (RC3).** Mockup: heading "Utwórz konto rodzica" (one
  line, no world grid), tagline, a pale-blue **callout box** ("Konto rodzica zarządza
  bezpieczeństwem, celami i postępami." with 3D green shield icon =
  `feature-parent-account-shield.png`), then three feature rows with 3D icons:
  `feature-learning-goals-target.png` ("Ustal cele nauki"),
  `feature-safe-environment-lock.png` ("Bezpieczne środowisko"),
  `feature-progress-report-chart.png` ("Śledź postępy"), then the laptop-desk hero
  `hero-parent-dashboard-desk.png` (known residual background — sits at panel bottom
  against the pale ground; check it, may need a soft mask or placement on a light
  patch).
- **Card: mockup has a "Krok 1 z 3" stepper row at the top** (1 filled, 2–3 hollow,
  connecting track). Live card has no stepper. This is the onboarding stepper
  (Konto rodzica → Profil dziecka → Bezpieczeństwo) that recurs on screens 05/06.
- Card fields/button sizing per RC2; button carries a shield glyph (already there) but
  at mockup scale.
- Right-side decorations: shelf/backpack (`decor-right-backpack.png`), coin stack
  (`decor-right-coin-stack.png`), growth chart (`decor-top-growth-chart.png`), cloud
  (`decor-cloud.png`), big zł coin bottom-right (`decor-big-zl-coin.png`). All absent.
- Trust badges exist but sit below the fold — with RC2 fixes they belong in-viewport.
- Files: `src/pages/auth/signup.astro`, `AuthShell.astro`, `SignUpForm.tsx`,
  `TrustBadges.astro`.
- Open decisions (below): "Imię" field, terms checkbox.

### 03 — `/auth/confirm-email` vs `03-email-verification-web.png`

Closest screen already. Remaining:

- **Brand row is centered; mockup has it top-left** (same as every other screen).
- **Hero lacks the pale circular backdrop** behind the envelope (keyed out of the
  cutout). Add a CSS disc (`bg-primary/10 rounded-full`) behind
  `hero-email.png` — also hides the keying holes. Scale the hero up (~40% larger).
- **Buttons: mockup's primary is "Otwórz pocztę" (envelope glyph), secondary outline
  "Wyślij ponownie".** Live has outline "Wyślij link ponownie" + primary
  "Zaloguj się →" — order and actions differ. See Open decisions for the mailto
  question; visually the primary/secondary hierarchy should match the mockup.
- Heading "Potwierdź e-mail" at display size (RC2).
- Missing decorations: `decor-right-shield.png`, `decor-left-envelope.png`,
  `decor-right-document.png`, `decor-left-plant.png`, `decor-right-books-plant.png`,
  `decor-right-coin-stack.png` (soft-3D, replacing the current wireframe corner art).
- Files: `src/pages/auth/confirm-email.astro`.

### 04 — `/auth/reset-password` (+ `/auth/update-password`) vs `04-password-reset-web.png`

- **Left panel is wrong wholesale (RC3).** Mockup: two-line heading "Bezpieczny dostęp
  do panelu rodzica" (no "Panel rodzica" accent line), tagline, a large center hero —
  envelope with shield-lock letter + coins + paper plane
  (`hero-reset-envelope-lock-large.png` — already committed as `hero-reset.png`, but
  it lives in the CARD today; the mockup puts it in the LEFT PANEL), and **three white
  feature cards** at the panel's bottom: `feature-safe-account-shield.png`
  ("Bezpieczne konto"), `feature-child-data-lock.png` ("Dane dziecka są chronione"),
  `feature-no-ads.png` ("Bez reklam i presji"). No world grid.
- **Card hero: mockup shows a smaller envelope in a pale circle with sparkles and a
  green check-shield** (that is `hero-reset-card-top.png` — rejected during impl for
  being cropped through its subject; the committed substitute now serves the card).
  With the big hero moving to the left panel, the card needs its circle-backdrop
  treatment: committed `hero-reset.png` inside a CSS disc + `decor-paper-plane.png` +
  sparkles reads close enough; or re-crop a cleaner card hero from the mockup.
- Watermark decorations: `decor-center-shield-bg.png`, `decor-top-envelope.png`,
  `decor-left-plant-bg.png`, `decor-left-coins.png`, `decor-right-coin-stack.png`,
  `decor-top-right-chart.png`.
- Card sizing per RC2; "Wyślij link" button with paper-plane glyph is right, needs
  mockup scale. Bottom security line ("Chronimy dostęp…") already present.
- Files: `src/pages/auth/reset-password.astro`, `update-password.astro`,
  `AuthShell.astro`, `ResetPasswordForm.tsx`.

### 05 — `/app/new-profile` vs `05-child-profile-web.png` — structural

Live is a bare centered card with a 3-step wizard (Dane dziecka → Avatar i świat →
Podsumowanie). The mockup is a different composition:

- **Page chrome**: brand top-left; top-right a "Nowy profil — Krok 2 z 3" chip (avatar
  `top-profile-avatar.png` + progress bar) and a wallet chip ("126 zł"); a **left
  sidebar** of app nav (Start, Zadania, Mój sklep, Postępy, Nagrody, Światy, Panel
  rodzica) drawn in a disabled/preview state.
- **One screen, two columns inside the card** — left: "Dodaj profil dziecka", name
  field, age select ("Wybierz wiek" dropdown), avatar row (5 circles, selected ring +
  check badge), privacy notice strip (`notice-shield-icon.png`); right:
  "Zainteresowania" 2×2 world tiles (full-bleed images, selected ring + corner check),
  "Poziom startowy" info card (`level-starting-icon.png`, "6–9 lat / Podstawy
  matematyki i ekonomii"); footer: reassurance line ("Wszystkie światy uczą tych
  samych podstaw") + one "Dalej →" button.
- The onboarding stepper across the top of the card reads **Konto rodzica ✓ /
  Profil dziecka (2) / Zabezpieczenia** — not the wizard-internal labels live uses.
- Avatars: live has 4, mockup 5 (extraction has 5: `avatar-boy-selected.png`,
  `avatar-girl-bow.png`, `avatar-boy-black-hair.png`, `avatar-girl-blonde.png`,
  `avatar-boy-glasses.png`). Add the fifth.
- Decorations: `decor-left-coins.png`, `decor-left-star-shield.png`,
  `decor-right-chart.png`, `decor-right-checklist.png`, `decor-right-plant.png`.
- Files: `src/pages/app/new-profile.astro`,
  `src/components/child/CreateProfileWizard.tsx` (this becomes a one-screen form —
  substantial rework; the collapse from 3 steps to 1 removes the "Podsumowanie" step).
- Open decisions: sidebar realness, wallet chip, age dropdown vs pills.

### 06 — `/app/parent-pin` vs `06-parent-pin-security-web.png` — structural, biggest gap

Live is one small card with a single free-text PIN input. The mockup is a full
onboarding screen ("Krok 3 z 3"):

- **Left sidebar**: step list (1 Utwórz konto ✓ / 2 Profil dziecka ✓ /
  3 Bezpieczeństwo, active) + "Bezpieczna nauka" card with the house illustration
  (`sidebar-safe-learning-house.png`).
- **Top**: centered "Krok 3 z 3" stepper card; right decorations
  `top-security-shield.png` (keying holes — needs card/appropriate backdrop),
  `top-coins-chart.png`, `decor-dotted-path.png`.
- **Heading**: "Zabezpiecz panel rodzica" + "PIN chroni cele, raporty i ustawienia
  dziecka".
- **PIN card (left column)**: hero `hero-pin-lock-shield.png` in a pale disc;
  "Wpisz 4 cyfry" — **four individual digit boxes**; "Potwierdź PIN" — four more;
  info strip "PIN będzie wymagany…". Live's single `<input>` + "Powtórz PIN" input
  must become segmented digit inputs (product accepts 4–6 digits — see Open
  decisions).
- **"Bezpieczne ustawienia" panel (right column)**: four rows with 3D icons + green
  toggles: Brak reklam (`setting-no-ads-icon.png`), Dostosowane do wieku
  (`setting-age-icon.png`), Raport tygodniowy (`setting-weekly-report-icon.png`),
  Kontrola poziomu trudności (`setting-difficulty-icon.png`). **No such settings
  exist in the product** — see Open decisions.
- **Footer**: "← Wróć" (ghost), "Pomiń na razie" (outline), "Zakończ konfigurację"
  (primary, shield glyph). Live has only the submit. "Pomiń" is a product behaviour
  question (below).
- The mockup shows only SET mode. Keep the current enter-mode card for returning
  parents, restyled to match (hero disc, sizing); the mockup composition applies to
  set mode.
- Files: `src/pages/app/parent-pin.astro`,
  `src/components/parent/ParentPinGate.tsx`.

---

## Open decisions for the maintainer (ask before building, or take the noted default)

1. **Signup "Imię" field and terms checkbox** (mockup has both; product stores no
   parent name and has no regulamin page — dropped deliberately last time). Default:
   still drop, keep the card visually balanced per mockup spacing.
2. **Screen 03 "Otwórz pocztę"** — a real `mailto:`/webmail link is unreliable.
   Default: keep the button, `href="mailto:"` — or make "Wyślij ponownie" secondary
   and "Zaloguj się" primary but styled/ordered as the mockup (primary on top).
   Decide which action owns the primary slot.
3. **Screen 05/06 sidebars** — mockup draws app-nav (05) and a step list (06). The
   route runs pre-profile-pick, outside `AppShell`. Default: render them as static,
   non-navigating preview chrome (aria-hidden nav), matching the mockup's look
   without inventing routes.
4. **Screen 06 settings toggles** — no backing preferences exist (FR-wise "Brak
   reklam" is a guarantee, not a setting). Default: render the panel with toggles ON
   and disabled/decorative, copy as-is; do NOT invent a settings table. Flag to PRD
   if it should become real.
5. **PIN length** — mockup shows exactly 4 digit boxes; product accepts 4–6.
   Default: 4 boxes that extend to 6 as the user types (or 6 boxes with 4 required);
   do not regress the 4–6 contract (`e2e` covers 6-digit PIN — Manual 9.9).
6. **Wizard collapse (05)** — 3 steps → 1 screen deletes "Podsumowanie". Default:
   follow the mockup; the summary's content (name/avatar/world recap) dies with it.
7. **Onboarding stepper truthfulness** — mockup's "Krok 1 z 3 / 2 z 3 / 3 z 3" spans
   signup → profile → PIN, but a user can reach these routes outside that flow
   (e.g. `/app/new-profile` for a second child). Default: show the stepper as the
   mockup draws it on each screen regardless of entry path.

---

## What already matches — do not regress

- Trust badges row (screens 02/03), security note strip, "lub" divider pattern.
- The field model: tall placeholder-only fields with gutter icons, `sr-only` labels
  **with the `aria-describedby` + `toHaveAccessibleName` guards** (impl-review fix).
- World/avatar art on the wizard's step 2 (extraction art, correct style).
- Screen 03's next-step / security footer panels.
- WCAG fixes: `--primary-foreground: oklch(1 0 0)`, `bg-card` on outline buttons over
  cards, the security strip's `text-foreground/85`. Any restyling must keep ≥4.5:1 —
  re-run the canvas-based contrast probe (`.playwright-mcp/verify.mjs`, has a
  positive control; regenerate from the change notes if gone).
- One `<h1>` per route at every width (AuthShell hero heading, `sr-only lg:not-sr-only`).
- `AuthShieldCheckIcon`'s evenodd tick (legible on blue); no `id` in any inlined SVG.

## Verification recipe for the closing session

1. Dev server on `:4321` (it may already run; the e2e global-setup rejects a
   toolbar-serving stray server — `ASTRO_DEV_TOOLBAR_DISABLED` guard).
2. Screenshot each route at **1536×1024** and **390×844**, compare side-by-side with
   `assets/matmaverse-auth-v2-{web,mobile}/0N-*.png`. The acceptance bar is the
   plan's Manual rows (4.6–9.8), which this audit effectively FAILED for desktop:
   region-by-region parity, not vibes.
3. `npm run test` (unit baseline 641+ in 65+ files), `npm run lint`, `npm run check`,
   `npm run test:e2e` (green = "1 skipped, 31 passed"; the skip is
   `marketing-worlds.spec.ts [touch]`, by design). Sandbox blocks localhost — tests
   need the override.
4. Every new asset: copy from `assets/matmaverse-auth-v2-web/` into
   `public/illustrations/auth/`, register in `slice-map.md` with source + crop box.
   Mobile mockups were NOT audited here — after desktop parity, run the same pass
   against `assets/matmaverse-auth-v2-mobile/`.

## Suggested process

This is big enough to plan: `/10x-plan` against this file (the research is done —
this document + `change.md`'s implementation notes are the research). RC1 (art swap)
and RC2 (sizing) are low-risk and could land as early phases; RC3 (per-screen
panels) next; screens 05/06 (structural) last, each as its own phase. Screens 05/06
touch React components with e2e coverage (`e2e/smoke.spec.ts`,
`e2e/password-reset.spec.ts`, profile/PIN flows) — run the suite per phase.
