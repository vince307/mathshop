# Avatar slice map

Child-avatar face crops sliced from the flattened, local-only design mockup
(`assets/matma-verse/…`, gitignored per CLAUDE.md) into committed `public/avatars/`
assets so they ship to Vercel. Fixed-resolution PNGs — **swappable** if true
vector/source exports become available later. Reproduce a slice by re-cropping the
source PNG with the listed crop box (`x, y, w, h` in source-pixel coordinates).

Source: `assets/matma-verse/math-economy-auth-v2-mobile/05-child-profile-mobile.png` (853×1844)

| Output file | Crop box (x, y, w, h) | What it is |
| --- | --- | --- |
| `kuba.png`  | (208, 468, 118, 118) | Child avatar — dark hair, green shirt |
| `zosia.png` | (372, 468, 118, 118) | Child avatar — light/blonde hair |
| `tomek.png` | (536, 468, 118, 118) | Child avatar — glasses |
| `ola.png`   | (700, 468, 118, 118) | Child avatar — dark hair (girl) |

## Notes

- The mockup's avatar row has **5 faces**, but the first (leftmost) is rendered in
  the **selected** state (blue ring + check badge baked into the flattened PNG), so
  it can't be cleanly extracted as a neutral avatar — it is **omitted**. The 4
  committed avatars are the unselected faces. More avatars can be added later from
  clean source art; the registry (`src/data/avatars.ts`) is the closed set the
  create-profile route validates against.
- `id` (filename stem) is a stable lowercase slug — the value stored in
  `child_profiles.avatar`. The Polish display `name`/`alt` are locale content in
  `src/data/avatars.ts`, not baked into the art.
- The selection ring + check badge are rendered as **UI state** by the wizard's
  `SelectTile`, never part of the avatar image.
