# Auth Visual Fidelity — Closing Pass — Plan Brief

> Full plan: `context/changes/auth-visual-fidelity/plan.md`
> Specification (research is done): `context/changes/auth-visual-fidelity/fidelity-gaps.md`
> Implementation notes and traps: `context/changes/auth-visual-fidelity/change.md`
> The landed first plan: `context/changes/auth-visual-fidelity/plan-2026-08-29-initial.md`

## What & Why

The six auth/onboarding screens shipped with the right regions and the wrong texture, and
the maintainer's visual pass on 2026-09-04 rejected them: *"to nadal nie wygląda tak jak na
mockupie, a wszystkie elementy są wycięte i gotowe do użycia."* This plan closes that gap
against the four systemic causes the audit isolated (flat SVGs where the mockups render
soft-3D art; everything under-scaled so single-viewport designs scroll; screens 02 and 04
wearing screen 01's panel; missing or outline-styled decoration) plus the two screens whose
composition was never built — the child profile and the parent PIN.

## Starting Point

Nine phases landed through `b6b34ed`. The structure is sound and one file
(`src/data/marketing-art.ts`) owns every art path, which is what makes the art swap cheap.
What ships today: 56 px fields where the mockup draws 76, a 44 px primary button where it
draws 72, a 1152 px container inside a 1536 px design, a 2×3 world grid that pushes the
security strip below the fold, one shared marketing panel on all four auth routes, three
outline decorations, a three-step profile wizard and a single-input PIN card.

## Desired End State

At 1536×1024 each of the six routes is a screenshot of its mockup, region for region —
rendered art, mockup-scale controls, its own left panel, its own scattered decoration, no
scroll. `/app/new-profile` is one screen with app chrome; `/app/parent-pin` is the full
onboarding page with segmented digit boxes and a static settings panel. Then the same pass
at 390×844 against the mobile mockups.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Art source | The extraction's `png/cutouts/`, copied byte-for-byte | The mockups render 3D; the flat `svg/icons/` set is what makes every screen read as a wireframe | Gaps (RC1) |
| Group B icons | Unchanged, still inlined SVG | A gutter glyph and an eye toggle are UI chrome whose colour belongs to the context, not illustration | Plan |
| Six worlds, four mockup tiles | One row of six compact full-bleed tiles | Two rows of mockup-sized tiles need 472 px and push the security strip past 1024; showing four would regress `e2e/marketing-worlds.spec.ts` | Plan |
| Geometry | Measured off the mockups with PIL, not estimated | Card 571×768 at (899,138), fields 76 px, primary button 72 px — the plan carries the numbers so "parity" is checkable | Plan |
| Per-screen panels | `AuthShell` gets a `panel` slot with today's content as fallback | Screens 01/03 change nothing; 02 and 04 supply their own, which is what their mockups draw | Gaps (RC3) |
| Onboarding stepper | One shared component on 02, 05 and 06 | The collision that blocked it (the wizard's own three-step stepper) disappears when Phase 5 collapses the wizard | Gaps (open decision 7) |
| Screen 05 wizard | Collapses to one screen; "Podsumowanie" dies with it | The mockup is one screen; open decision 6's default | Gaps |
| Screen 05 age control | Native `<select>` | The mockup draws a dropdown, and `t.profileWizard.agePlaceholder` ("Wybierz wiek") was written for exactly it | Plan |
| Screen 05 wallet chip | **Not built** | No wallet exists before a profile does; "126 zł" would be a false statement about the product, not a visual detail | Plan |
| Fifth avatar | Cut from the mockup with the selection chrome painted out | The extraction's `avatar-boy-selected.png` carries a baked ring, a check badge and keying holes | Plan |
| Screen 06 PIN | Four digit boxes that grow to six as the user types | Matches the mockup at rest without regressing the product's 4–6 contract; open decision 5's default | Gaps |
| Screen 06 settings | Static, non-focusable rows with decorative toggles | No backing preferences exist; a disabled real control promises a setting the product does not have | Gaps (open decision 4) |
| Sidebars on 05/06 | Static, non-navigating preview chrome, `aria-hidden` | Both routes run outside `AppShell`; open decision 3's default | Gaps |
| "Pomiń na razie" | Links to `/app/start` | Skipping means simply not setting a PIN yet — a real state, since the gate only guards `/app/report` | Plan |
| Product name | MatmaVerse, with the mockup's bicolour treatment | The mockups say "MathMarket"; only the two-tone lockup is adopted | CLAUDE.md |

## Scope

**In scope:** ~45 PNG/SVG cutouts committed and registered; the art registry and its test;
the brand lockup; field/button/card/container geometry; the world strip; a panel slot plus
`SignupPanel` and `ResetPanel`; a shared `OnboardingStepper`; per-screen decoration sets on
all six routes; `/app/new-profile` rebuilt as one screen with a fifth avatar; `/app/parent-pin`
rebuilt with segmented PIN entry, a settings panel and a footer; the e2e specs those two
screens own; a no-scroll guard at 1536×1024; the mobile pass.

**Out of scope:** the product name; signup's "Imię" field and terms checkbox; real settings
behind screen 06's toggles; invented routes for the preview sidebars; `AppShell.astro`'s own
brand lockup; `WorldPicker` and every child-facing screen; visual-regression baselines; any
change under `assets/`.

## Architecture / Approach

Art lands and is registered first, so every later phase references paths that provably
exist. Then the cheap global levers (scale), then the per-screen panels, then decoration,
then the two structural rebuilds, then mobile. Phases 1–4 are presentation-only and cannot
break a test that is not about looks. Phases 5 and 6 are the only ones that touch behaviour,
and each carries its own e2e rewrite — by the time they run, the shared vocabulary they
should be built from already exists.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Art (RC1) | ~45 cutouts committed and registered, registry repointed, 3D brand lockup | A keyed cutout placed on the page background shows its holes |
| 2. Scale (RC2) | Mockup geometry everywhere; a no-scroll guard at 1536×1024 | Resizing `FormField` near the `sr-only` label that fifteen e2e locators depend on |
| 3. Panels (RC3) | `panel` slot + `SignupPanel`, `ResetPanel`, shared `OnboardingStepper` | The `<h1>` must stay outside the `hidden lg:block` block or it names nothing below `lg` |
| 4. Decoration (RC4) | Per-screen soft-3D decoration on all four auth routes | A decoration that overflows brings back the scrollbar or swallows a click |
| 5. Screen 05 | One-screen profile form, app chrome, fifth avatar | `e2e/onboarding.spec.ts` drives the wizard being deleted |
| 6. Screen 06 | Full onboarding page, segmented PIN, settings panel, footer | `getByLabel(...).fill()` cannot drive a segmented control; the six-digit case must survive |
| 7. Mobile | The same pass at 390×844 across all six | Screens 05/06 have no mobile treatment yet at all |

**Prerequisites:** `assets/` present — the maintainer's machine only, so **work in the main
checkout, never a worktree**; local Supabase up for the e2e gates; the sandbox override for
anything touching localhost.
**Estimated effort:** ~4–6 sessions across 7 phases; phases 5 and 6 are each about as large
as phases 1–4 combined.

## Open Risks & Assumptions

- **Two cutouts fight their own keying.** `hero-parent-dashboard-desk.png` keeps a residual
  opaque background and `top-security-shield.png` is holed; both sit on the page background
  in their mockups. Each has a documented fallback (re-cut, or a backdrop), and either way
  it lands in `slice-map.md`.
- **Six worlds in one row is an extrapolation from a four-tile mockup.** Labels at ~118 px
  may need two lines; the alternative arrangements either scroll or under-report the app.
- **The fifth avatar is the second edited asset in this change.** The mockup draws it wearing
  its selection chrome; the edit is recorded with its crop box.
- **Two mockups disagree on one string** — the third onboarding step is "Zabezpieczenia" on
  05 and "Bezpieczeństwo" on 06. One wins ("Bezpieczeństwo"); recorded, not rediscovered.
- **The e2e baseline moves** from "1 skipped, 31 passed" to "1 skipped, 32 passed" at Phase 2.
- Screen 03's "Otwórz pocztę" question (open decision 2) is answered visually only: the
  mockup's primary/secondary hierarchy is matched, the resend keeps the page's real job.

## Success Criteria (Summary)

- A parent opening any of the six routes at 1536×1024 sees the mockup — rendered art,
  mockup-scale controls, the right panel, ambient depth — with no scrolling, and the same at
  390×844.
- Nothing regresses: full unit and e2e suites green, every field still reachable and
  announced by name, one `<h1>` per route at every width, contrast ≥4.5:1 measured, no
  inlined SVG carrying an `id`.
- Every asset that ships is committed under `public/` and registered in `slice-map.md`, and
  no code path resolves anything under `assets/`.
