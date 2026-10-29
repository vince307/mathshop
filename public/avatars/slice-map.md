# Avatar slice map

Child-avatar face crops sliced from the flattened, local-only design mockup
(`assets/matmaverse-auth-v2-mobile/`, gitignored per CLAUDE.md) into committed
`public/avatars/` assets so they ship to Vercel. Fixed-resolution PNGs —
**swappable** if true vector/source exports become available later. Reproduce a
slice by re-cropping the source PNG with the listed crop box `(x0, y0, x1, y1)`
in source-pixel coordinates, then applying the circular alpha mask described below.

Source: `assets/matmaverse-auth-v2-mobile/05-child-profile-mobile.png` (853×1844)

The mockup draws each avatar on a **white disc** of diameter 139 px, centred on
`y = 495`. Each slice is that disc: a 140×140 crop centred on the disc, with a
circular alpha mask of radius 69 px (1 px inside the disc edge, anti-aliased by
4× supersampling). The mask is what makes the avatar render correctly — the app
frames it in a `rounded-full` ring (`AvatarCircle`), so any page background left
in the corners, or the disc's own drop shadow, shows up as a grey halo.

| Output file | Disc centre (x, y) | Crop box (x0, y0, x1, y1) | What it is                            |
| ----------- | ------------------ | ------------------------- | ------------------------------------- |
| `kuba.png`  | (277.5, 495)       | (208, 425, 348, 565)      | Child avatar — dark hair, green shirt |
| `zosia.png` | (434, 495)         | (364, 425, 504, 565)      | Child avatar — light/blonde hair      |
| `tomek.png` | (590.5, 495)       | (520, 425, 660, 565)      | Child avatar — glasses                |
| `ola.png`   | (746, 495)         | (676, 425, 816, 565)      | Child avatar — dark hair (girl)       |

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
- **Re-sliced 2026-08-28.** The first batch was 118×118 opaque crops centred on
  `(267, 527)` — 10 px left of and 32 px below the real disc centre. Framed in a
  circle that cut the top of the head off and left a white sliver of the disc's
  bottom edge in the corner. The boxes above are measured from the disc, not
  eyeballed: the discs are the only near-pure-white (`min(r,g,b) ≥ 251`) runs in
  the row, so their bounding boxes fall straight out of that threshold.
- 140 px is the ceiling this source offers (the disc is 139 px). The largest
  render is `SelectTile`'s `sm:size-24` (96 CSS px), so it is ~1.5× there and 2×
  or better everywhere else. The **web** mockup of the same screen is not a
  higher-resolution alternative — its avatar row is smaller _and_ a different
  set of faces.
