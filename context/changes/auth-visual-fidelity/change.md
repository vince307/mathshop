---
change_id: auth-visual-fidelity
title: Bring all six auth/onboarding screens up to mockup fidelity from the per-screen auth-v2 extraction
status: implementing
created: 2026-08-29
updated: 2026-08-29
archived_at: null
---

## Notes

Align the six auth/onboarding screens with the `matmaverse-auth-v2` mockups, dressed
exclusively in art from the maintainer's **per-screen extraction**
(`assets/matmaverse-auth-v2-web/`):

| Mockup                   | Route                                        |
| ------------------------ | -------------------------------------------- |
| 01 parent login          | `/auth/signin`                                |
| 02 parent register       | `/auth/signup`                                |
| 03 email verification    | `/auth/confirm-email`                         |
| 04 password reset        | `/auth/reset-password`, `/auth/update-password` |
| 05 child profile         | `/app/new-profile`                            |
| 06 parent PIN            | `/app/parent-pin`                             |

Illustrated atoms instead of flat 20 px lucide glyphs, the mockups' field model, illustrated
card headers, borderless desktop feature blocks, a security panel, trust badges, background
decorations, and one shared brand row on all six screens. Presentation only — no logic, no
schema, no route or API contract changes.

## Scope revision — 2026-08-29 (mid-flight)

**The change started as one screen and grew to six, and its art source was replaced.**

Phases 1–2 landed (`8850b18`, `5793073`) against `assets/atomic-assets-v3/` and
`assets/atomic-assets-v2/`. That art does not meet the maintainer's requirements and is
retired. The binding source is now the per-screen extraction the maintainer produced:
`assets/matmaverse-auth-v2-web/` — `AUTH_ASSET_EXTRACTION_INDEX.md`, one
`0N-*-extracted/docs/component-breakdown.md` per screen, and a 41-file shared atom set in
`00-shared-auth-assets/`.

`plan.md` was rewritten accordingly: **Phase 1 is reset and re-run** (its Progress rows were
un-checked — the phase is not "done" when it shipped the wrong files), Phase 2 stays landed
(the components are structurally right; only the paths behind
`src/data/marketing-art.ts` change), Phases 3–4 are re-pointed at the new atoms, and Phases
5–9 are new, one per remaining screen. Nine phases total.

## Implementation notes (in-flight)

Facts discovered while running the change that are not derivable from `plan.md`:

- **`e2e/growth.spec.ts` (`[touch]`) fails on `main`, not because of this change.**
  30 s timeout on the nav→`/app/growth` step. Reproduced on a clean HEAD by stashing this
  change's work, so it is pre-existing and unrecorded elsewhere. Do not chase it from inside
  this change; `npm run test:e2e` reads "1 failed, 1 skipped, 30 passed" and that failure is
  the one. (The skip is `marketing-worlds.spec.ts` on `[touch]` — correct, the auth world
  strip is `hidden` below `lg` by design.)
- **Unit baseline on this branch is 641 tests in 65 files**, measured 2026-08-29 before the
  revision's Phase 1. Plan success criteria are written as baseline + delta (L-005).
- **`context/runs/2026-08-27-world-economy/` is untracked and unrelated.** It was dirty
  before this change started. Keep it out of every phase commit.
- **The sandbox blocks localhost.** `npm run test`, `npm run test:e2e` and any `curl` at
  `:4321` need the sandbox override; `lint` and `check` do not.
- **No SVG in the new extraction declares an `id`**, and eleven of them are authored with
  `currentColor`. This retires the constraint that forced every glyph to be an `<img>` in the
  first Phase 1 (the atomic pack's `<linearGradient id="g">` collisions) and is why the atom
  set now splits into committed illustrations (`<img>`) and inlined UI icons.
- **Several PNG cutouts are keyed by removing near-white pixels**, which punches holes in
  white content *inside* the illustration (`hero-email-confirmation.png`,
  `hero-reset-card-top.png`, `security-shield-card-icon.png`, `status-email-green.png`,
  `next-child-profile-icon.png`, `level-starting-icon.png`, `top-security-shield.png`,
  `avatar-boy-selected.png`); `hero-parent-dashboard-desk.png` keeps a residual opaque
  background. The holes are invisible on a white card and visible on the pale page
  background — which is why every holed cutout this plan adopts is placed inside a card.
- **Phase 2 deviated once, deliberately, and that deviation is now reversed.** `FeatureList`'s
  icon box was `lg:size-20` because the retired SVGs did not fill their 64-unit viewBox. The
  extraction's do, so Phase 1 item 6 brings the box back to the mockup's scale.
