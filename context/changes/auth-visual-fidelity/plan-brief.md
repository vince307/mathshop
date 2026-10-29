# Auth Visual Fidelity — Plan Brief

> Full plan: `context/changes/auth-visual-fidelity/plan.md`

## What & Why

`/auth/signin` has the right structure but the wrong texture. Every region of mockup
`01-parent-login-web` exists on the page, yet the illustrated 3D art the design leans on was
substituted with 20px flat `lucide` glyphs, the desktop feature blocks carry card chrome the
design does not have, the fields use a different field model, and the ambient background depth
is absent. The result reads as the mockup's wireframe rather than the mockup. This change closes
that gap on the auth surfaces and on the landing page that shares their vocabulary.

## Starting Point

`AuthShell.astro` (shared by all four auth pages) and `Welcome.astro` (the `/` landing) each
hand-roll the same brand row, three feature cards and security footer — copy is shared through
`t.marketing`, markup is duplicated. `FormField.tsx` backs all four auth forms with a
label-above-input model. `public/illustrations/slice-map.md` records that the flat lucide glyphs
were a **deliberate** choice ("visually faithful and keeps the asset set lean"). Two designed
strings, `t.auth.signin.noAccount` and `t.auth.signup.hasAccount`, have existed since they were
written and are referenced by nothing.

## Desired End State

`/auth/signin` at desktop width reads as the mockup: illustrated feature blocks on the bare
background, an illustrated login card with tall placeholder-only fields, a blue-bordered
"Nie masz konta? **Utwórz konto**" button, a security panel, and ambient coins and chart art
behind the content. `/` carries the same brand row, feature blocks and security panel from the
same components. The other three auth screens inherit the new field model. Below `lg` every
surface keeps the mobile mockup's carded feature treatment.

## Key Decisions Made

| Decision                       | Choice                                            | Why (1 sentence)                                                                                          |
| ------------------------------ | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Art source                     | Copy SVGs as-is from `atomic-assets-v2`           | Vector, self-contained, no slicing or alpha-keying — the same move the upgrade icons already made (S-06).  |
| Field-change blast radius      | Change shared `FormField` globally                | Mockup `02` uses the identical field model, so two parallel field styles would make signin and signup look like different products. |
| Landing page                   | Extract shared marketing components               | Retires the existing `AuthShell`/`Welcome` duplication instead of paying its cost a second time.           |
| Field labels                   | `sr-only`, placeholder carries the name           | Faithful to the mockup while keeping all fifteen `getByLabel` e2e locators working.                        |
| Login-card illustration        | `lock-user.svg` at large scale                    | The mockup's leafy person-and-shield scene is not in the atomic pack, and slicing it would break the vector-only decision. |
| Background decoration          | Coins + chart, no dashed arrow                    | 80% of the mockup's depth from assets already in the repo; the arrow is a curve fitted to one layout.      |
| Feature copy                   | Web mockup wording                                | Web and mobile mockups disagree; the web set is what these surfaces are built to.                          |
| Verification                   | Asset-existence tests + green suite, no VR shots  | Catches the failure classes that already happened here (dead string, missing file) without adding a brittle new test category. |

## Scope

**In scope:** six committed SVGs plus a typed art manifest and provenance record; shared
`BrandRow` / `FeatureList` / `SecurityNote` components used by `AuthShell` and `Welcome`; the
mockup field model in `FormField` (all four auth forms); the sign-in card's illustration, hero
proportions, two-part secondary button and background decoration; feature copy aligned to the web
mockup; one new asset test and one new e2e assertion.

**Out of scope:** rebuilding `/auth/signup` to mockup `02`'s 3-step wizard; reverting the world
strip to four cards or swapping world art; renaming the brand to "MathMarket"; the mockup's
dashed arrow decoration; Playwright visual-regression baselines; any change under `assets/`.

## Architecture / Approach

Art lands and is pinned first, so later phases reference paths that provably exist. A single
`src/data/marketing-art.ts` owns every art path and keeps the feature icons index-aligned with
`t.marketing.features` by construction — the same "second list drifted" bug class that once let
the auth panel advertise four worlds while the app shipped six. Three new components under
`src/components/marketing/` are consumed by both signed-out surfaces. `FormField` changes once
and four screens follow. The sign-in card and page-level decoration come last, composing
everything already in place.

## Phases at a Glance

| Phase                            | What it delivers                                                          | Key risk                                                                 |
| -------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1. Committed art and its register | Six SVGs in `public/`, art manifest, slice-map entry, asset test          | The retired slice-map note must actually be rewritten, not just appended to |
| 2. Shared marketing components    | `BrandRow` / `FeatureList` / `SecurityNote` consumed by both surfaces     | Extraction silently drops the world strip from one surface               |
| 3. The mockup's field model       | Tall placeholder-only fields with icon tiles across all four auth screens | A label that leaves the accessibility tree takes the whole e2e suite down |
| 4. Sign-in card and composition   | Card illustration, two-part button, hero proportions, decorations         | Decorations overflowing into horizontal page scroll                      |

**Prerequisites:** `assets/` present locally (maintainer's machine only — Phase 1 cannot run in
CI, a fresh clone, or a worktree); local Supabase stack up for the e2e gates in Phases 2–4.
**Estimated effort:** ~2–3 sessions across 4 phases.

## Open Risks & Assumptions

- **Phase 1 is machine-bound.** `assets/` is gitignored and absent everywhere but the maintainer's checkout. Phases 2–4 are safe anywhere once Phase 1's files are committed.
- **The atomic SVGs are flat vectors, not 3D renders.** They match the mockup's palette and shapes but will read slightly flatter; the chart icon's bars are blue where the mockup's are gold. Accepted as the cost of staying vector.
- **`sr-only` labels lose the field name once a value is typed** — the known cost of placeholder-as-label. Mitigated for the one case where it carried a rule (signup's 6-character minimum) by moving that to a persistent hint.
- **The web and mobile mockups disagree on two feature descriptions.** Web wins; recorded in the plan so the difference is not later rediscovered as drift.
- **This reverses a documented decision.** If the earlier "keep the asset set lean" reasoning still holds for someone, Phase 1 is the place to stop.

## Success Criteria (Summary)

- A parent opening `/auth/signin` sees the designed screen — illustrated, layered, with the security panel and the "Nie masz konta?" prompt — not its wireframe.
- `/` and `/auth/signin` are visibly the same product, and share the components that make them so.
- Nothing regresses: full unit and e2e suites green, every field still reachable and announced by name.
