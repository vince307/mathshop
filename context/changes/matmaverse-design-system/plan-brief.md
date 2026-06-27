# MatmaVerse Design System — Plan Brief

> Full plan: `context/changes/matmaverse-design-system/plan.md`
> Design spec: `docs/superpowers/specs/2026-06-27-matmaverse-design-system-design.md`

## What & Why

Replace the starter "cosmic" dark glassmorphism with the canonical MatmaVerse **light** design language and apply it to the existing auth surfaces. Done now (before Part B) so the design system is established once — the child surfaces get built on the real design instead of restyled twice.

## Starting Point

Today there are two disconnected styling systems: the shadcn tokens in `global.css` are unused default grayscale, while the auth/app pages use a hand-rolled dark `bg-cosmic` + glass look. The canonical mockups (`assets/matma-verse/`, local-only) match neither — they're light, blue-primary, rounded, illustration-rich. `button.tsx` exists; no other shadcn primitives are installed; no web font is wired.

## Desired End State

The whole app renders one coherent **light** MatmaVerse look. `/auth/signin`, `/auth/signup`, `/auth/confirm-email` match the `auth-v2` mockups — two-column marketing+form on desktop, single-column on mobile, illustrations rendered from committed assets. `/app` and the `/` scaffold sit on the same light base; no `bg-cosmic` anywhere. shadcn primitives are themed from the token set. All 29 behavior tests stay green.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Scope | Tokens + restyle existing surfaces | Establish the system once; child primitives deferred to Part B | Spec |
| Brand | MatmaVerse (keep code) | Mockups' "MathMarket" treated as outdated; rename is a separate follow-up | Spec |
| Components | Adopt + theme shadcn primitives | Reusable layer Part B inherits; matches CLAUDE.md | Spec |
| Fidelity | Pixel-faithful incl. illustrations | Build to the mockup, per CLAUDE.md design-source rule | Spec |
| Art assets | Slice from mockup PNGs → `public/illustrations/` | No source exports available; `public/` so they ship to Vercel | Spec |
| Sequencing | Foundation-first (tokens → assets → primitives → screens) | Extract the token system once before screens consume it | Spec |
| `/` scaffold | Light-neutralize (no mockup) | Removing `bg-cosmic` breaks `/`; avoid a jarring dark `/` | Plan |
| Responsive | Single-column stack on mobile | Mobile mockups exist to build to | Plan |
| Dark mode | Light-only v1 (`.dark` kept, untested) | Kids' app; light-only is simpler | Spec |

## Scope

**In scope:** light token set + `@theme` wiring; remove `bg-cosmic`; Nunito (self-hosted); theme shadcn Button/Card/Input/Label/Checkbox; refactor the shared auth components; slice illustration assets; pixel-faithful restyle of signin/signup/confirm-email; light-pass on `/app` and the `/` scaffold.

**Out of scope:** child-primitive library, all `ui-v2`/child screens, password-reset/profile-picker/parent-PIN screens, any behavior/copy/routing/i18n change, brand rename in code/docs, dark-mode support.

## Architecture / Approach

Tokens in `global.css :root` (oklch) → Tailwind `@theme` → inherited by every shadcn primitive + utility. A reusable `AuthShell` (built on signin) holds the two-column marketing+form layout that signup reuses; confirm-email and `/app` are simpler token-styled surfaces. Illustrations are static `public/` PNGs sliced from the mockups.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Tokens + light base + Nunito | Light theme; `bg-cosmic` gone; `/` neutralized | Removing `bg-cosmic` is cross-cutting — must neutralize `/` same phase |
| 2. Illustration asset pipeline | Sliced art in `public/illustrations/` + slice map | Raster crops from flattened PNGs; edge quality |
| 3. shadcn primitives + auth refactor | Themed Button/Card/Input/Label/Checkbox; auth components composed on them | Keep component props/behavior stable so tests stay green |
| 4. signin reference restyle | Reusable two-column `AuthShell`; signin → mockup 01 | Responsive stack fidelity vs the mobile mockup |
| 5. Propagate | signup (02) + confirm-email (03) + `/app` light | Preserve resend + error pass-throughs while restyling |

**Prerequisites:** S-01a archived (done); mockups present locally in `assets/matma-verse/` (local-only — a cloud/CI agent won't have them).
**Estimated effort:** ~2–3 sessions across 5 phases.

## Open Risks & Assumptions

- Mockups are local-only — a fresh clone / cloud agent can't see them; implementation must happen where `assets/matma-verse/` exists.
- Sliced raster illustrations are fixed-resolution; acceptable for v1, swappable if vector/source exports appear.
- oklch conversions of the sampled hex values are approximate — fine-tuned by eye against the mockups during Phase 1.

## Success Criteria (Summary)

- Auth surfaces visually match their `auth-v2` mockups (desktop + mobile stack); whole app is coherent light MatmaVerse.
- No `bg-cosmic` remains; `lint` + `build` + the 29-test suite all green throughout.
- Pure visual: zero behavior/routing/copy regressions.
