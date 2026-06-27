# Illustration slice map

These illustrations are **raster crops** sliced from the flattened, local-only design
mockups (`assets/matma-verse/…`, gitignored per CLAUDE.md) into committed `public/`
assets so they ship to Vercel. Fixed-resolution PNGs — **swappable** if true vector /
source exports become available later. Reproduce a slice by re-cropping the source PNG
with the listed crop box `(x0, y0, x1, y1)` in source-pixel coordinates.

Source: `assets/matma-verse/math-economy-auth-v2-web/01-parent-login-web.png` (1536×1024)

| Output file | Crop box (x0, y0, x1, y1) | What it is |
| --- | --- | --- |
| `world-piekarnia.png` | (28, 616, 196, 814) | Bakery world-card illustration |
| `world-kawiarnia.png` | (206, 616, 374, 814) | Cafe world-card illustration |
| `world-galaktyczna-baza.png` | (380, 616, 548, 814) | Space-station world-card illustration |
| `world-sklep-ksiegarnia.png` | (556, 616, 720, 814) | Bookstore world-card illustration |
| `coin.png` | (658, 284, 740, 366) | Single gold "zł" coin |
| `coin-stack.png` | (1400, 888, 1536, 1024) | Gold "zł" coin stack (decorative) |

## Notes

- The small feature-bullet icons (shield / globe / chart) and the form-panel avatar-lock
  glyph are **not** sliced — they're generic and are rendered with lucide icons in the
  surface layouts (Phase 4–5), which is visually faithful and keeps the asset set lean.
- World cards include the rounded-illustration art only; their labels (Piekarnia,
  Kawiarnia, Galaktyczna baza, Sklep księgarnia) are rendered as text from `i18n`, not baked in.
