<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Auth Visual Fidelity — Closing Pass

- **Plan**: `context/changes/auth-visual-fidelity/plan.md` (the second plan; the first is
  `plan-2026-08-29-initial.md` and is not under review)
- **Mode**: Deep
- **Date**: 2026-09-04
- **Verdict**: REVISE → **SOUND** after triage (all nine findings fixed in the plan)
- **Findings**: 2 critical, 6 warnings, 1 observation

## Verdicts

| Dimension | Verdict (as reviewed) | After fixes |
|-----------|-----------------------|-------------|
| End-State Alignment | FAIL | PASS |
| Lean Execution | PASS | PASS |
| Architectural Fitness | PASS | PASS |
| Blind Spots | FAIL | PASS |
| Plan Completeness | WARNING | PASS |

Worth recording: the plan was unusually strong on the dimensions that normally fail. No
phase was removable, nothing proliferated a pattern the codebase already solves, the
geometry was measured rather than estimated, and the Progress section parsed cleanly on the
first pass. Both criticals were arithmetic/factual slips inside otherwise well-specified
phases, not approach problems.

## Grounding

19/19 paths ✓, 12/12 symbols ✓, brief↔plan ✓. Progress format ✓ (exactly one `## Progress`,
seven phase blocks matched, no checkbox bullets outside it). Contract surfaces: no surface
in `docs/reference/contract-surfaces.md` is named or reshaped by this plan — the fifth
avatar (Phase 5) touches `public.child_profiles.avatar`, whose column is a bare `text` and
whose documented contract does not enumerate the id set, so nothing there needs updating.

## Findings

### F1 — `/auth/confirm-email` does not use `AuthShell`, and RC2 never reaches it

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: End-State Alignment
- **Location**: Phase 2 items 2 & 5; Phase 3 Overview + item 1; row 3.9
- **Detail**: The plan stated `AuthShell` served "all four auth routes" and that the panel
  slot meant "screens 01 and 03 change nothing". `src/pages/auth/confirm-email.astro`'s own
  header says it is "The only auth route that does NOT use `AuthShell`". Consequence: Phase
  2 put every container/column lever inside the shell, and item 5's per-screen card widths
  listed 01/02/04 only — screen 03 would have kept `max-w-4xl` (896 px) against the plan's
  own measured card of 1075, with row 3.9 then freezing it as "pixel-unchanged". The
  no-scroll guard cannot catch this: it forbids overflow, not under-scale.
  (Phase 4's and Phase 7's "four routes" phrasings were *accurate* — the shell genuinely
  serves signin, signup, reset-password and update-password.)
- **Fix ⭐ Recommended**: New Phase 2 item 6 for `confirm-email.astro` (wrapper to the
  measured 1075 px box, hero to `w-[430px]`, footer panels and `TrustBadges` scaled with
  it); screen 03 added to item 5's width list with a note that its card heading stays the
  `<h1>`; Phase 3 Overview and item 1 corrected; rows 2.6 and 3.9 restated.
  - Strength: Closes RC2 on the one screen the plan had measured and then never used.
  - Tradeoff: Phase 2 grows by one item; 03 cannot ride the shell's grid change.
  - Confidence: HIGH — verified in the file.
  - Blind spot: Whether 03's `sm:grid-cols-2` still reads correctly at 1075 px is unchecked.
- **Decision**: FIXED

### F2 — The container arithmetic contradicts the measured geometry it serves

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase 2 item 2 — The shell's geometry
- **Detail**: `max-w-[1440px]` + `lg:px-10` under Tailwind preflight's border-box yields
  1440 − 80 = **1360 px** of content. The measured mockup needs 777 + 82 + 571 = **1430**.
  The left column would land at 707 px — 70 px (9%) short, the exact squeeze RC2 exists to
  remove — dropping the six world tiles from ~118 px to ~104 and making Manual row 2.6
  (±8 px on the region table) unsatisfiable by construction.
- **Fix**: `max-w-[1510px]` with `lg:px-10` (1510 − 80 = 1430; centred in 1536 it
  reproduces the mockup's own 40 px gutters), with the arithmetic written into the contract
  so it cannot silently drift again. The grid template now reads
  `[minmax(0,1fr)_var(--container-auth-card)]` instead of re-typing 571.
  - Strength: Pure arithmetic from numbers already in the plan.
  - Tradeoff: None — no other consumer of that container.
  - Confidence: HIGH.
  - Blind spot: Whether 1430 px of content still lands the security strip inside 1024 px
    vertically is a separate question this does not answer.
- **Decision**: FIXED

### F3 — The no-scroll guard skips the two screens most likely to scroll

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 item 7; Phase 5 and Phase 6 success criteria
- **Detail**: "No scrolling at 1536×1024" is the plan's headline acceptance criterion for
  all six routes, but the guard visited only the four public auth routes. Screens 05 and 06
  — the two grown from a small card into full-page compositions — are behind auth, had no
  automated guard, and no Manual scroll row either. Phase 7 row 7.3 checks *horizontal*
  scroll only, at 390. Vertical overflow on 05/06 at 1536 was checked by nothing.
- **Fix A ⭐ Recommended**: Extract the assertion into a shared
  `expectFitsAt1536(page)` in `e2e/helpers/viewport.ts`; `smoke.spec.ts` walks the four
  public routes through it (the +1 test), and Phases 5 and 6 call it from *inside* existing
  tests (`e2e/onboarding.spec.ts` and `setPinAndLandOnReport`), so the suite count stays at
  "1 skipped, 32 passed". New criteria and Progress rows 5.7 and 6.6 added; Manual rows in
  both phases renumbered.
  - Strength: The auth helpers already exist; covers the two screens where a regression is
    most likely and least visible.
  - Tradeoff: The rest of each host test then runs at 1536 rather than 1280.
  - Confidence: HIGH.
  - Blind spot: The set-mode fixture for `/app/parent-pin` needs an account with no PIN,
    which `setPinAndLandOnReport` itself consumes — sequencing needs care.
- **Fix B**: Manual "does not scroll" rows on Phases 5 and 6 only.
  - Strength: Zero test cost. Tradeoff: nothing watches the regression later.
  - Confidence: MEDIUM.
- **Decision**: FIXED via Fix A

### F4 — Phase 6 changes two strings `e2e/helpers/parent-pin.ts` pins, and said so nowhere

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 6 items 2, 5 and 6
- **Detail**: Item 2 contracts the heading "Zabezpiecz panel rodzica" and item 5 the submit
  "Zakończ konfigurację"; `setPinAndLandOnReport` asserts
  `getByRole("heading", { name: t.parentPin.setHeading })` and clicks
  `getByRole("button", { name: t.parentPin.setSubmit })`. Item 6's stated intent covered
  only `getByLabel(...).fill()` on the segmented control. Both new strings were written as
  bare literals with no i18n key contracted (L-003), and
  `e2e/parent-weekly-report.spec.ts` — a second consumer of the helper — was unnamed.
- **Fix**: Items 2 and 5 now say these are *value changes* to `t.parentPin.setHeading` and
  `t.parentPin.setSubmit` (plus a new `setSubtitle`), so nothing is typed into the `.astro`
  and the locators follow the dictionary; item 6's intent widened to all three moving
  parts, with `parent-weekly-report.spec.ts` listed as the transitive consumer and the
  Playwright run named as the proof rather than the assumption.
  - Strength: Turns a mid-phase surprise into a listed edit and keeps L-003.
  - Tradeoff: None.
  - Confidence: HIGH — read from the helper and the spec.
- **Decision**: FIXED

### F5 — Enter mode's PIN control was left undecided, and four spec calls depend on it

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 6 items 2, 3 and 6
- **Detail**: Item 2 said enter mode "keeps a single centred card, restyled to the same
  vocabulary"; item 3's segmented-control contract described the two set-mode fields only.
  `e2e/parent-surfaces.spec.ts` drives enter mode four times with
  `getByLabel(t.parentPin.pinLabel).fill(...)`, and whether those survive turned entirely
  on an answer the plan did not give. Separately, `aria-label="Cyfra N"` is duplicated
  across the two set-mode groups, making `fillPin`'s `scope` load-bearing while its value
  was never specified.
- **Fix**: Enter mode uses the same segmented control with a single group — one input model
  in the product, and a returning parent meets the widget they set the PIN with. `fillPin`
  resolves `scope.getByRole("group", { name: legend })`, and item 6 now states it replaces
  **six** call sites, with `ChangePinSection`'s three labels explicitly excluded.
  - Strength: Removes the last guess in the phase and makes Manual row 6.10 checkable.
  - Tradeoff: The returning-parent path is rewritten, not merely restyled.
  - Confidence: HIGH.
- **Decision**: FIXED

### F6 — Phase 6 added ~10 strings to `t.parentPin` with no L-007 collision check

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 6 items 4, 5; Phase 6 success criteria
- **Detail**: `src/i18n/pl.ts` carries a standing warning on this exact namespace — "The
  three labels must stay mutually non-substring: Playwright's getByLabel matches
  substrings." Phase 3 correctly routed its new panel copy through
  `tests/marketing-labels.test.ts`; Phase 6 poured four settings titles and bodies, three
  footer actions, a changed heading, a subtitle and "Cyfra N" into the namespace that
  actually has substring-matching locators pointed at it, and looked at none of them.
- **Fix**: New Phase 6 item 4b adds the collision guard to
  `tests/marketing-labels.test.ts`, asserting both directions against `pinLabel`,
  `confirmLabel`, `currentPinLabel`, `newPinLabel`, `newPinConfirmLabel`, `setSubmit` and
  `enterSubmit`; criterion 6.1 names it.
- **Decision**: FIXED

### F7 — `t.onboarding.steps` was consumed but never contracted

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 items 4 and 5
- **Detail**: Item 5 sourced the stepper's labels from `t.onboarding.steps` and settled the
  "Zabezpieczenia" vs "Bezpieczeństwo" reconciliation there. `grep -n "onboarding"
  src/i18n/pl.ts` returns nothing, and item 4 — where every other new string in the phase
  is contracted — did not list it.
- **Fix**: Item 4 now contracts a new `t.onboarding` namespace with the three step labels,
  the third being "Bezpieczeństwo", so screens 05 and 06 consume a string rather than
  re-deciding it.
- **Decision**: FIXED

### F8 — Phase 7 was the only phase with no file paths and no measured geometry

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 7 — The mobile pass at 390×844
- **Detail**: Every desktop phase names files and works against a PIL-measured region
  table; Phase 7 said `**Files**: the six routes and the components they share` and gave
  behaviours instead of geometry, while carrying the unresolved mobile-hero decision and
  serving as the sole acceptance for half the change's end state. Row 7.4 ("region for
  region") had no region table to match against.
- **Fix A ⭐ Recommended**: New Phase 7 item 0 — a measurement pass producing a per-screen
  region table in the same shape as the desktop one — plus a real file list on item 1.
  **Writing this fix surfaced a trap the plan did not have**: the mobile mockups are
  `853×1844` (and `862×1825` for screen 06), i.e. 390×844 rendered at roughly **2.19×**,
  where the desktop mockups are 1:1 with CSS pixels. Measuring one and applying it directly
  would have built the entire phone layout at over twice mockup scale. The divisor is now
  in the plan with the raw dimensions beside it, and rows 7.4 and its Manual bullet say
  "±8 **CSS** px".
  - Strength: Restores the plan's own acceptance mechanism to the half of the work lacking
    it, and closes a scale error that had no other detector.
  - Tradeoff: A measurement pass has to run before Phase 7 can start.
  - Confidence: HIGH — dimensions read off the files.
  - Blind spot: Closed while applying — all six mobile mockups exist, screens 05 and 06
    included, so nothing in the phase is blocked on a missing asset.
- **Fix B**: Split Phase 7 into per-screen items without measuring. (Not taken.)
- **Decision**: FIXED via Fix A

### F9 — Two of five line-number anchors had already drifted (L-006)

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Key Discoveries; Phase 3 item 4; Phase 5 items 2 and 6
- **Detail**: `marketing-art.ts:41` (`FEATURE_ICONS` is at `:43`) and `AuthShell.astro:88`
  (the `<h1>` is at `:89`) were already wrong before implementation started. Each was
  paired with its symbol, so L-006 was satisfied in form — but the lesson demonstrated
  itself again.
- **Fix**: All five anchors rewritten as symbol-first with the number marked
  of-the-moment; `grep -n '\.ts:[0-9]\|\.tsx:[0-9]\|\.astro:[0-9]'` over the plan now
  returns nothing.
- **Decision**: FIXED

## Post-triage state

All nine findings applied to `plan.md`. Re-verified after the edits:

- Exactly one `## Progress` heading; no `- [ ]` bullet outside it.
- Phase 2 items renumbered 1–7 (6 = screen 03 geometry, 7 = the no-scroll guard); Phase 6
  gained item 4b; Phase 7 gained item 0. Every cross-reference in the prose points at the
  right number.
- Phase 5 Progress renumbered to 5.1–5.7 automated / 5.8–5.12 manual; Phase 6 to 6.1–6.6
  automated / 6.7–6.11 manual.
- The e2e count claim stays "1 skipped, 32 passed" from Phase 2 onward: the guard adds one
  test, and the two authenticated checks are assertions inside existing tests.
