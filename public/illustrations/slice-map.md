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

## Notes

- The small feature-bullet icons (shield / globe / chart) and the form-panel avatar-lock
  glyph are **not** sliced — they're generic and are rendered with lucide icons in the
  surface layouts (Phase 4–5), which is visually faithful and keeps the asset set lean.
- World cards include the rounded-illustration art only; their labels (Piekarnia,
  Kawiarnia, Galaktyczna baza, Sklep księgarnia, Pracownia, Laboratorium) are rendered
  as text from `i18n`, not baked in.
- The two W1 files are **larger** than the earlier four (≈84–88 KB against 42–72 KB).
  That is the subject matter, not the encoder: a lab bench and a craft desk carry far
  more small detail than a café stand. Both are still single hero illustrations at
  896 px, and quality was not raised above the batch default.
