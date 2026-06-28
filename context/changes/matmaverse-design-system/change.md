---
change_id: matmaverse-design-system
title: "MatmaVerse design system — light theme + auth-surface restyle"
status: implemented
created: 2026-06-27
updated: 2026-06-28
archived_at: null
---

## Notes

Brainstormed design spec: `docs/superpowers/specs/2026-06-27-matmaverse-design-system-design.md` (committed `e9d76f5`). Read it before planning — it carries the locked decisions.

Establishes the canonical MatmaVerse **light** visual language once, so Part B (S-01b) child surfaces are built on it rather than restyled twice. Sequenced AFTER S-01a (`parent-signup-first-profile-and-start-screen`, archived) and BEFORE Part B.

Locked decisions: light theme tokens (palette sampled from `assets/matma-verse/.../01-parent-login`: primary `#2473F3`, bg `#F3F8FE`, ink `#2D374C`, gold accent `#F3BE5D`) → `global.css` + Tailwind `@theme` + retheme shadcn; adopt + theme shadcn primitives (Button/Card/Input/Label/Checkbox); Nunito self-hosted via Fontsource; pixel-faithful restyle of the 5 existing surfaces (signin/signup/confirm-email/`/app`) to the auth-v2 mockups; slice illustrations from the mockup PNGs into committed `public/illustrations/`. Foundation-first (Approach A). Pure visual — no routing/behavior/copy change. Child-primitive library + other ui-v2 screens are OUT (Part B).
