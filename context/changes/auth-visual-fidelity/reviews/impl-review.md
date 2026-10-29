<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Auth Visual Fidelity

- **Plan**: `context/changes/auth-visual-fidelity/plan.md`
- **Scope**: Phases 1–9 (all), commits `ecbcbc9..735380f` on base `a2c9329`
- **Date**: 2026-08-30
- **Verdict**: NEEDS ATTENTION (at review time; all findings since triaged and fixed)
- **Findings**: 0 critical, 6 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

Plan Adherence is WARNING rather than the rubric's FAIL-on-MISSING: one enumerated
contract item of roughly forty-five was not executed (F3), and a visually equivalent
substitute was already in place.

## What the review verified independently

- **Contrast.** Recomputed oklch→sRGB from scratch: `--primary` = `rgb(46,111,239)`;
  old `--primary-foreground` = **4.383:1**, pure white = **4.529:1**. `--color-success-strong`
  on `bg-success/10`-over-white = **5.66:1**; plain `--success` there = **2.93:1**.
  `.dark` overrides `--primary-foreground` separately and is unaffected; nothing in the
  repo ever sets `.dark`. All thirteen consumers pair the token with `bg-primary`, so
  every surface — child surfaces included — strictly improves. Follow-up confirmed:
  `muted-foreground` on `bg-muted` = **4.34:1**.
- **`hero-reset.png`.** Recipe re-run against the real source: **0 differing bytes of
  424,512**, provided step 3 is `sharp().trim()` at default tolerance (a literal
  alpha-bbox trim yields 402×265 — row `y=5` carries alpha-19 pixels). The erased
  rectangle was rendered on magenta and inspected: it holds only the text fragments
  "…o do konta." and "…eczne.", no illustration. Nearest graphic is at ~(120,70),
  outside the box.
- **Group B provenance.** All thirteen icons diffed against
  `00-shared-auth-assets/svg/icons/`. Every "verbatim" claim is verbatim; all five
  `currentColor` swaps are path-for-path identical with only the stroke literal changed.
  `AuthEyeOffIcon` is a legitimate derivation. No silent design change.
- **Gates.** 1.5 and 1.6 are true as worded (the eleven surviving `assets/` mentions are
  all comments; no code resolves such a path). 9.5 was not — see F4.
- **The inherited `sr-only` claim.** Confirmed and extended; see F5.

## Findings

### F1 — /auth/signup renders zero headings at desktop

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/pages/auth/signup.astro` — the card header block
- **Detail**: Phase 5 wrapped the card header in `lg:hidden`, and that block holds the
  page's only `<h1>`. `AuthShell`'s hero renders `heading`/`accent` as `<p>`, as do
  `FeatureList`, `TrustBadges` and `BrandRow`. Measured live at 1536×1024: one `<h1>`,
  `display:none`, zero visible headings. Before the change the `<h1>` was unconditional.
- **Fix A ⭐ (applied)**: Promote `AuthShell`'s hero `heading` to `<h1>`, placed outside
  the `hidden lg:block` wrapper and clipped with `sr-only lg:not-sr-only`; demote the
  cards' headings to `<h2>` on all four routes.
- **Decision**: FIXED via Fix A. Verified: exactly one `<h1>` per route at 390 and 1536
  (`1×1` clipped box at 390, `598×72` painted at 1536), no horizontal overflow at either
  width, `getByRole("heading", …)` locators in `e2e/password-reset.spec.ts` unaffected
  (they do not pin a level).

### F2 — The shield-check's tick is invisible at 100% of its call sites

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/components/icons/authIcons.tsx` — `AuthShieldCheckIcon`
- **Detail**: Body `fill="currentColor"`, tick `stroke="#fff"`. Both call sites
  (`SignUpForm`'s `SubmitButton`, `ParentPinGate`'s submit) are
  `bg-primary text-primary-foreground`, so both resolve to white. Measured on the live
  page: body `oklch(1 0 0)`, tick `rgb(255,255,255)` — **1.00:1**. The button rendered a
  featureless white shield. The `--primary-foreground` fix closed the last sliver of
  difference; the glyph was never legible.
- **Fix A ⭐ (applied)**: One path with `fill-rule="evenodd"`, so the tick is real
  transparency and follows `currentColor` on any background. A `<mask>` was unavailable —
  it needs an `id`, which the module's invariant and `tests/auth-art.test.ts` forbid.
- **Decision**: FIXED via Fix A. Verified by screenshot: the tick renders.
  `AuthLockFilledIcon` has the identical construction on the sign-in and
  update-password buttons and was deliberately left alone — a padlock still reads
  without its keyhole.

### F3 — Phase 8 item 3 was never executed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `src/components/child/SelectTile.tsx`
- **Detail**: The plan contracts `<img src={BADGE_CHECK}>` at the corner of a selected
  tile. The file is absent from the diff entirely; it still renders `CheckBadge` from
  `child-ui-polish` (`6457849`). Nothing recorded the substitution.
- **Decision**: DOCUMENTED (not repaired). `CheckBadge` is the product's existing
  selected-state primitive and the visual result is the mockup's blue circular tick
  either way; `BADGE_CHECK` is not orphaned (it is the `<img>` in `/auth/confirm-email`'s
  footer panels). Recorded in `change.md`.

### F4 — Progress row 9.5 is checked and is literally false

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `plan.md` — Progress, Phase 9, row 9.5
- **Detail**: The row read "No `ShoppingCart` remains anywhere in `src`" and was `[x]`
  with a SHA while two uses remained (`AppShell.astro`, `WorldPicker.tsx`). Both are
  correct and out of scope; the gate was mis-specified, not relaxed — but the artifact
  certified more than was verified (L-009's shape).
- **Decision**: FIXED — rewritten to what was actually verified, with the re-scoping
  and both surviving uses recorded inline.

### F5 — The false sentence didn't die, it moved into the test's comment

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `e2e/smoke.spec.ts` — the `toHaveAccessibleName` comment;
  `plan.md` § Critical Implementation Details; `src/components/auth/FormField.tsx` header
- **Detail**: Verified in Chromium against the live `/auth/signin`:

  ```
  as shipped (sr-only)       getByLabel: 1   accessible name: PASS
  label display:none         getByLabel: 1   accessible name: PASS
  label deleted              getByLabel: 0   accessible name: FAIL
  ```

  The name also survives `visibility:hidden` and `aria-hidden` on the label, and
  survives with the placeholder removed — Chromium resolves the `<label for>`
  association regardless of the label's presentation. So `plan.md`'s original claim was
  false in both halves, as suspected. But the replacement claim was false too:
  `smoke.spec.ts` asserted the check "goes red on exactly that edit" (`sr-only`→`hidden`).
  It stays green. Separately, the assertion covered 1 of the 4 routes `FormField` backs.
- **Fix A ⭐ (applied)**: Correct all three prose sites to name the edit actually guarded
  (label deletion), and extend the assertion to `/auth/signup` (`e2e/onboarding.spec.ts`)
  and the recovery pair (`e2e/password-reset.spec.ts`).
- **Decision**: FIXED via Fix A. Lesson candidate: the correction reintroduced the same
  class of error one level up.

### F6 — `AUTH_ICONS.length === 13` fires on the safe change and is silent on the dangerous one

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `tests/auth-art.test.ts` — "registers every icon the module means to guard"
- **Detail**: `rendered` is derived from `AUTH_ICONS`, so its length is a property of the
  map. An export that never reaches the map leaves the length at 13 and the suite green —
  the exact hazard the comment above it names. It also contradicts the convention
  `src/components/child/ShopGlyph.tsx` states verbatim for `SHOP_ICONS`.
- **Decision**: FIXED — replaced with a set comparison between `Object.keys(AUTH_ICONS)`
  and the module's exports matching `/^Auth.*Icon$/`.

### F7 — Placeholder is the only sighted label, and there is no `aria-describedby`

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/components/auth/FormField.tsx` — `FormField`
- **Detail**: `aria-invalid` was set without `aria-describedby`, so assistive tech
  announced THAT a field was wrong and never WHY — survivable while the label was
  visible, not once it went `sr-only`. The larger placeholder-as-label cost is the
  mockups' call and stands.
- **Decision**: FIXED (`aria-describedby` wired to the error and hint nodes) + the
  trade-off recorded in `change.md`.

### F8 — The L-007 guard checked `title` and never `body`

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `tests/marketing-labels.test.ts`
- **Detail**: `TrustBadges` renders `title` and `body` both as plain `<p>`, but every
  assertion mapped `.title`. `t.marketing.trustVerify[0].body` was already a strict
  prefix of `t.marketing.security` — latent only because `/auth/confirm-email` renders
  `TrustBadges` without `SecurityNote`, which is the informality the suite exists to
  replace.
- **Decision**: FIXED — `badgeStrings()` now covers `title` + `body` everywhere, a new
  case checks every set against the panel-wide security line regardless of where the set
  is used today, and the colliding body was reworded.
  **Note:** the first version of that new case also folded in `featureTitles` and went
  red on `trustVerify[0].title` === `features[0].title` — a *recorded* decision (mockup
  `03` reuses "Bezpieczna nauka" on purpose). Scoped back to the portable risk, with the
  exception and its reasoning written into the file rather than silently dropped.

### F9 — `hero-reset.png`: source substituted, and the recipe's trim step was under-specified

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `public/illustrations/slice-map.md`, `change.md`
- **Detail**: Phase 7 item 2 contracts `hero-reset.png, 183×166` from
  `hero-reset-card-top.png`; what shipped is 402×264 from
  `hero-reset-envelope-lock-large.png`, edited. The reasons are excellent and documented
  in `slice-map.md`, but it is the one break in "copied byte-for-byte" and it was missing
  from `change.md`'s deviation list. Separately, step 3 said "trim to the alpha bounding
  box", which yields 402×265; the shipped file requires `sharp().trim()`.
- **Decision**: FIXED — step 3 now names the tool and tolerance and records the 265 vs
  264 difference; the source substitution is listed in `change.md`.

### F10 — `--shadow-mm-control` is defined and consumed by nothing

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: `src/styles/global.css` — `@theme inline`
- **Detail**: `shadow-mm-card` is on all five auth cards; its sibling has zero consumers.
  The other two additions are live (`--container-auth-card` one consumer,
  `--color-success-strong` two).
- **Decision**: FIXED — token removed, and the extraction's token-comparison table now
  records it as "not adopted — no consuming surface".

## Follow-ups confirmed, deliberately not fixed here

- `src/components/app/AppShell.astro` still hand-rolls its own brand lockup and should
  adopt `BrandRow` — signed-in chrome with its own nav and e2e coverage.
- `muted-foreground` on `bg-muted` = 4.34:1 in the base theme (verified).
- `AuthLockFilledIcon`'s `#fff` keyhole has F2's construction on the primary buttons.
- All 34 Manual visual rows across Phases 1 and 3–9 remain unrun; the automated gates
  cannot substitute for them, and F1 and F2 are what that pass exists to catch.

## Correction to `change.md`'s environment notes

`e2e/growth.spec.ts` on `[touch]` does not fail. It was the Astro dev toolbar, the
subject of the sibling change `e2e-dev-toolbar-intercepts-touch-nav`. A green run reads
"1 skipped, 31 passed". Recorded in `change.md`.

## Verification after triage (2026-08-30)

| Gate | Result |
|------|--------|
| `npm run lint` | exit 0, 0 errors |
| `npm run check` | exit 0, 0 errors |
| `npm run test` | exit 0 — **654 passed / 66 files** (baseline 641, +13) |
| `npm run test:e2e` | exit 0 — **31 passed, 1 skipped** |

Browser-verified on the live app: exactly one `<h1>` per `AuthShell` route at 390 and
1536 (clipped to a 1×1 box at 390, painted 598×72 at 1536), no horizontal overflow at
either width, and the shield's tick renders on the `bg-primary` submit button.

## Triage summary

- **Fixed**: F1 (Fix A), F2 (Fix A), F4, F5 (Fix A), F6, F7, F8, F9, F10 — 9
- **Documented rather than repaired**: F3 — 1
- **Skipped**: none

MERGE: BLOCKED — every automated gate is green and all ten findings are resolved, but the 34 Manual visual rows across Phases 1 and 3–9 are still unrun, and F1 and F2 were exactly the class of defect that pass exists to catch.
