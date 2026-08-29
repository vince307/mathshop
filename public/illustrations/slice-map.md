# Illustration slice map

These illustrations are **raster crops** sliced from the flattened, local-only design
mockups (`assets/matmaverse-*/`, gitignored per CLAUDE.md) into committed `public/`
assets so they ship to Vercel. Fixed-resolution PNGs — **swappable** if true vector /
source exports become available later. Reproduce a slice by re-cropping the source PNG
with the listed crop box `(x0, y0, x1, y1)` in source-pixel coordinates.

Source: `assets/matmaverse-auth-v2-web/01-parent-login-web.png` (1536×1024)

| Output file                  | Crop box (x0, y0, x1, y1)                  | What it is                            |
| ---------------------------- | ------------------------------------------ | ------------------------------------- |
| `world-piekarnia.png`        | (28, 616, 196, 814)                        | Bakery world-card illustration        |
| `world-kawiarnia.png`        | (206, 616, 374, 814)                       | Cafe world-card illustration          |
| `world-galaktyczna-baza.png` | (380, 616, 548, 814)                       | Space-station world-card illustration |
| `world-sklep-ksiegarnia.png` | (556, 616, 720, 814)                       | Bookstore world-card illustration     |
| `coin.png`                   | (650, 276, 748, 374) → keyed, see below    | Single gold "zł" coin                 |
| `coin-stack.png`             | (1392, 880, 1536, 1024) → keyed, see below | Gold "zł" coin stack (decorative)     |

### The two coins are alpha-keyed, not plain crops

Re-sliced **2026-08-28**. The first pass cropped the coins straight out of the
flattened mockup, so each shipped with the login page's opaque `#f6f9fe`
background baked in. Every surface that draws a coin on a card (`CoinBoard`'s
tappable coins, the `WalletPill` HUD chip, `AuthShell`'s decorative coin) showed
it as a pale grey-blue halo — the `rounded-full` on the coin `<img>` in `CoinBoard`
only turned the square halo into a circular one.

Both are now RGBA. Take the generous crop box above, then derive alpha from the
gold-vs-background chroma — `alpha = clamp((R − B − 12) × 255 / 28)` — and trim to
the resulting bounding box plus 2 px. Keying on `R − B` rather than on distance
from the background colour is what removes the coin's **drop shadow** too: the
shadow is neutral-to-blue like the page, while every part of the coin, highlights
included, is strongly red-over-blue. Verified against dark, white and magenta
backdrops — no fringe, no residual halo.

Do not re-add `rounded-full` / `object-cover` to a coin `<img>`: the art is a
tilted disc with transparent corners, and clipping it to a circle shaves its rim.

## World cards, second batch (W1) — 2026-08-27

The four world cards above are **crops of a mockup sheet**; these two are **whole
standalone illustrations**, resized rather than cropped, taken from the local-only
atomic asset pack `assets/atomic-assets-v2/png/worlds/` (gitignored). Both carry
`"role": "world-card-illustration"` in that pack's `manifest.json`, which is what
identifies them as the missing two of the PRD's six worlds.

Committed here because `assets/` is gitignored and therefore absent from a fresh
clone, from CI, and from the git worktrees `/10x-autonomous-run` builds — code that
needs this art cannot reach the source.

| Output file               | Source (`assets/atomic-assets-v2/png/worlds/`) | World        | Resize                |
| ------------------------- | ---------------------------------------------- | ------------ | --------------------- |
| `world-pracownia.webp`    | `creative-studio-world.png` (1448×1086)        | Pracownia    | `contain` — see below |
| `world-laboratorium.webp` | `invention-lab-world.png` (1402×1122)          | Laboratorium | `cover`               |

Reproduce with `sharp`: resize to **896×718** (the exact size of all four earlier
world cards), transparent background preserved, `.webp({ quality: 82, alphaQuality: 100 })`.

**Why the two fits differ.** `invention-lab-world.png` is 1402×1122 ≈ 1.2495, which
matches the 896×718 ≈ 1.2479 target to within a rounding error, so `cover` trims a
sub-pixel edge and nothing else. `creative-studio-world.png` is 1448×1086 ≈ 1.3333 —
a genuinely different aspect ratio, the only one of the six that is. `cover` would
crop its sides (losing the fabric shelf on the left and the mannequin on the right);
`fill` would stretch it. `contain` letterboxes onto the transparent canvas, which
costs nothing visually because the source has no background.

## Upgrade icons (S-06)

Copied **as-is** (not cropped) from the local-only progression asset pack
`assets/atomic-assets-v3/svg/icons/` (gitignored) into committed
`public/illustrations/` so the upgrade catalog art ships to Vercel. SVG — scalable,
theme-neutral, swappable for per-world art later.

| Output file             | Source (`assets/atomic-assets-v3/svg/icons/`) | Upgrade                           |
| ----------------------- | --------------------------------------------- | --------------------------------- |
| `upgrade-sign.svg`      | `upgrade-spark.svg`                           | Szyld (sign / decoration)         |
| `upgrade-shelf.svg`     | `shelf-upgrade.svg`                           | Półka (shelf)                     |
| `upgrade-register.svg`  | `cash-register-upgrade.svg`                   | Lepsza kasa (register)            |
| `upgrade-slot.svg`      | `plus-product-slot.svg`                       | Miejsce na produkt (product slot) |
| `upgrade-storage.svg`   | `inventory-box.svg`                           | Magazynek (storage)               |
| `upgrade-customers.svg` | `customer-happy.svg`                          | Więcej klientów (customers)       |

## Auth/onboarding art (auth-visual-fidelity) — 2026-08-29

Copied out of the local-only, gitignored per-screen extraction
`assets/matmaverse-auth-v2-web/` into committed `public/illustrations/auth/`, so the six
auth/onboarding screens ship their art to Vercel and to CI, where `assets/` does not exist.

**This section replaced an earlier one, it did not extend it.** The first pass at this
change (commit `8850b18`) shipped six SVGs from `assets/atomic-assets-v2/svg/` —
`brand-symbol.svg`, `feature-safety.svg`, `feature-worlds.svg`, `feature-progress.svg`,
`parent-lock.svg`, `decor-chart.svg`, all at the root of `public/illustrations/`. That art
did not meet the design's requirements and **all six files are deleted**; describing them
here would make this register point at files that no longer exist. Its warning about
colliding `<linearGradient id="g">` declarations went with them: that hazard was specific
to the atomic pack, and **no file in this extraction declares an `id` at all** (verified
across all 41). `tests/auth-art.test.ts` keeps it that way.

### The set splits by colour authority, not by file type

- **Group A — illustrations.** Colours belong to the design; a consumer never recolours
  them. Committed as files below, rendered `<img src>`, paths owned by
  `src/data/marketing-art.ts`.
- **Group B — UI icons.** Colour belongs to the context the icon sits in (a field gutter,
  a blue button, a muted footer line). Authored with `currentColor`, so they are
  **inlined** as React components in `src/components/icons/authIcons.tsx` — through an
  `<img>` each would render black, because `currentColor` in a standalone SVG document has
  nothing to inherit from.

### Group A — `public/illustrations/auth/` (14 files)

SVGs are byte-for-byte copies. `hero-email.png` and `hero-pin.png` are as-is copies of
files the extraction had already cut out — no crop, no resize, no re-encoding by us.
`hero-reset.png` is the one exception and is documented below.

| Output file                 | Source (under `assets/matmaverse-auth-v2-web/`)                            | What it is                                    |
| --------------------------- | -------------------------------------------------------------------------- | --------------------------------------------- |
| `brand-mark.svg`            | `00-shared-auth-assets/svg/icons/brand-shop-basket-coin.svg`                 | Shop front with a basket and a `zł` coin       |
| `feature-safety.svg`        | `00-shared-auth-assets/svg/icons/feature-shield-check.svg`                   | "Bezpieczna nauka" — green check-shield        |
| `feature-worlds.svg`        | `00-shared-auth-assets/svg/icons/feature-globe.svg`                          | "Światy zainteresowań" — blue globe            |
| `feature-progress.svg`      | `00-shared-auth-assets/svg/icons/feature-child-progress.svg`                 | "Postępy dziecka" — rising bars                |
| `hero-parent-security.svg`  | `00-shared-auth-assets/svg/icons/security-user-shield.svg`                   | Sign-in card header — parent beside a shield   |
| `badge-check.svg`           | `00-shared-auth-assets/svg/icons/check-badge-blue.svg`                       | Blue circular tick — selected tiles, badges    |
| `coin.svg`                  | `00-shared-auth-assets/svg/icons/coin-zl.svg`                                | Single `zł` coin, decorative                   |
| `coin-stack.svg`            | `00-shared-auth-assets/svg/icons/coin-stack-zl.svg`                          | `zł` coin stack, decorative                    |
| `decor-chart.svg`           | `00-shared-auth-assets/svg/decor/decor-chart-up.svg`                         | Pale rising bar chart, decorative              |
| `decor-receipt.svg`         | `00-shared-auth-assets/svg/decor/decor-receipt-coins.svg`                    | Pale receipt and coins, decorative             |
| `decor-path.svg`            | `00-shared-auth-assets/svg/decor/dotted-growth-path.svg`                     | Pale dotted arc with an arrow, decorative      |
| `hero-email.png`            | `03-email-verification-extracted/png/cutouts/hero-email-confirmation.png`    | 430×400 — open envelope with a green tick      |
| `hero-reset.png`            | `04-password-reset-extracted/png/cutouts/hero-reset-envelope-lock-large.png` | 402×264 — envelope, padlock shield, coins, plane — **edited, see below** |
| `hero-pin.png`              | `06-parent-pin-security-extracted/png/cutouts/hero-pin-lock-shield.png`      | 244×190 — padlock beside a green check-shield  |

### `hero-reset.png` is the ONLY edited file, and the edit removes mockup text

Both of screen 04's heroes were unusable as shipped, which is worth recording
because the failures are of two different kinds:

- `hero-reset-card-top.png` (183×166) is cropped **through its own subject** — the
  envelope's bottom is gone and the green shield is sliced in half vertically. No
  edit recovers that; it is simply not the illustration.
- `hero-reset-envelope-lock-large.png` (411×270) is the complete composition
  (envelope, padlock shield, `zł` coins, paper plane and its dotted trail) but
  carries **stray body copy from the mockup baked into the top-left** — the tails
  of "…o do konta." and "…eczne." from the paragraph the crop box overran.
  Shipping visible Polish text fragments out of a design file is a defect, not a
  cosmetic one.

The large one is used, with the text erased. Reproduce exactly:

1. Read `hero-reset-envelope-lock-large.png` as RGBA (411×270).
2. Set `alpha = 0` over the rectangle `x ∈ [0, 108), y ∈ [0, 62)`. That rectangle
   contains only the stray text: the shield starts at `y ≈ 28, x ≈ 155` and the
   coin stack at `y ≈ 180`, so nothing drawn is inside it. **Erasing beats
   cropping here** — any crop that clears the text also clips either the shield's
   top or the coins.
3. Zero any `alpha < 8` dust so the trim finds real bounds, then trim to the
   alpha bounding box. Result: **402×264**.

Like `hero-email.png`, its white interior is keyed out, so it belongs on a card.

### The PNG cutouts are keyed by near-white removal — two of these have holes

Composited on magenta, several of the extraction's cutouts turn out to have had their white
*interior* content removed along with the white background: `hero-email-confirmation.png`
loses the letter inside the envelope, `hero-reset-card-top.png` loses its white card, and
the same is true of `security-shield-card-icon.png`, `status-email-green.png`,
`next-child-profile-icon.png`, `level-starting-icon.png`, `top-security-shield.png` and
`avatar-boy-selected.png`. `hero-parent-dashboard-desk.png` has the opposite problem — a
residual opaque background block (corner alpha 231, not 0).

**The hole is invisible on a `bg-card` surface and shows as a pale rectangle on the page
background.** So `hero-email.png` and `hero-reset.png` are placed **inside cards, and only
inside cards** — `src/data/marketing-art.ts` repeats the rule where a future move would
read it. `hero-pin.png` keys cleanly and is safe anywhere. The holed cutouts not listed in
the table above were rejected for this reason and replaced with SVG atoms, which is also
the extraction index's own preference ("Prefer SVG as inline React components").

### Group B — `src/components/icons/authIcons.tsx` (13 inlined icons)

Transcribed path-for-path from `assets/matmaverse-auth-v2-web/00-shared-auth-assets/svg/icons/`.
No file, so nothing lands in `public/` — the copy INTO the repo is the component source,
which is what `CLAUDE.md`'s "commit the asset, never the reference" asks for.

| Export                 | Source file                 | Derivation                                     |
| ---------------------- | --------------------------- | ---------------------------------------------- |
| `AuthEmailIcon`        | `auth-email.svg`            | verbatim (`currentColor` in source)             |
| `AuthLockIcon`         | `auth-lock.svg`             | verbatim (`currentColor` in source)             |
| `AuthLockFilledIcon`   | `auth-lock-filled.svg`      | verbatim (`currentColor` in source)             |
| `AuthEyeIcon`          | `auth-eye.svg`              | verbatim (`currentColor` in source)             |
| `AuthEyeOffIcon`       | `auth-eye.svg`              | **derived** — plus one diagonal slash           |
| `AuthUserPlusIcon`     | `auth-user-plus.svg`        | verbatim (`currentColor` in source)             |
| `AuthPaperPlaneIcon`   | `auth-paper-plane.svg`      | `#FFFFFF` stroke → `currentColor`               |
| `AuthRefreshIcon`      | `auth-refresh.svg`          | `#0B6EFF` stroke → `currentColor`               |
| `AuthArrowLeftIcon`    | `arrow-left.svg`            | `#0B6EFF` stroke → `currentColor`               |
| `AuthArrowRightIcon`   | `arrow-right.svg`           | `#FFFFFF` stroke → `currentColor`               |
| `AuthChevronRightIcon` | `chevron-right.svg`         | `#1A8F2A` stroke → `currentColor`               |
| `AuthCalendarIcon`     | `calendar-age.svg`          | `#7EA2E8` stroke → `currentColor`               |
| `AuthShieldCheckIcon`  | `feature-shield-check.svg`  | `#39c66a` fill → `currentColor`; tick stays `#fff` |

**Why two derivations.** Each hardcoded literal suits exactly the one place its mockup uses
it; as `currentColor` the consumer sets the mockup's colour with a Tailwind class, which is
one icon family instead of six colour regimes — and is how the `lucide` icons they retire
already behaved. `AuthEyeOffIcon` has no source at all: the extraction draws only the open
eye, but `PasswordToggle` needs both states, and a `lucide` `EyeOff` beside an extraction
eye would not read as one family.

Group A paths are owned by `src/data/marketing-art.ts` and pinned by `tests/auth-art.test.ts`
(every path resolves to a committed file; one feature icon per `t.marketing.features` entry;
no Group A SVG carries an `id` or a gradient). The same test renders every Group B export
and asserts it is `id`-free and `currentColor`-driven. No surface hardcodes a string from
either table.

### Not adopted

`nav-*.svg`, `world-*.svg`, `setting-*.svg`, `toggle-on.svg`, `step-check.svg`,
`checkbox-empty.svg` and the per-screen decor cutouts have no consuming surface in this
product — the sidebar, the settings list, the four-box PIN and the mockups' four-world strip
are all things this change deliberately does not build. See the change's
`plan.md` § "What We're NOT Doing".

## Notes

- World cards include the rounded-illustration art only; their labels (Piekarnia,
  Kawiarnia, Galaktyczna baza, Sklep księgarnia, Pracownia, Laboratorium) are rendered
  as text from `i18n`, not baked in.
- The two W1 files are **larger** than the earlier four (≈84–88 KB against 42–72 KB).
  That is the subject matter, not the encoder: a lab bench and a craft desk carry far
  more small detail than a café stand. Both are still single hero illustrations at
  896 px, and quality was not raised above the batch default.
