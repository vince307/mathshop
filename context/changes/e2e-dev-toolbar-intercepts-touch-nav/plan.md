# Verifying the dev-toolbar guard — Implementation Plan

## Overview

The protection against Astro's dev toolbar occluding the mobile bottom nav is
entirely unverified. The guard can silently fail to apply, and the spec credited
with covering the class asserts properties the failure preserved — so in both
directions the suite goes green while protecting nothing.

This plan does **not** fix the interception. That was diagnosed and fixed in
`f0587ad` (2026-08-23) and Astro's flag is airtight: with
`devToolbar.enabled === false`, the toolbar script is never served, so no element
exists to intercept anything. What the incident left behind is a two-line config
guard with zero coverage and a spec that three handoffs credit with guarding a class
it cannot observe. This plan closes both.

## Current State Analysis

**The guard itself is correct and unreachable on the common path.**
`astro.config.mjs:21` reads `devToolbar: { enabled: process.env.ASTRO_DEV_TOOLBAR_DISABLED !== "true" }`,
and `playwright.config.ts:88` sets that variable — but only inside the `webServer.env`
block. `playwright.config.ts:74` is `reuseExistingServer: !process.env.CI`, and on the
reuse path Playwright returns before `launchProcess`, so the `env` block is never
applied. Availability is an HTTP probe of the URL, so **any** `npm run dev` already on
the port satisfies it, and `package.json`'s `dev` script does not set the flag. CI is
structurally immune (`CI=true` → no reuse), which is precisely why this can never turn
a PR red.

**The same fix was accepted once and never landed.**
`context/archive/2026-08-22-world-progression-stages/follow-ups/review-fixes.md:115-116`
proposes `reuseExistingServer: false` whenever `E2E_PORT` is set. It is still unlanded.
Note its scope: it closes the worktree/side-by-side case, **not** the common
`npm run test:e2e` on default `:4321` with a stray dev server. Necessary, not sufficient
— which is why the probe below carries the rest of the load.

**Toolbar presence is detectable over plain HTTP.**
`node_modules/astro/dist/core/app/dev/pipeline.js:70-87` gates injection on
`manifest.devToolbar.enabled`; when on it emits a `<script type="module"
src="/@id/astro/runtime/client/dev-toolbar/entrypoint.js">` **and** an inline
`window.__astro_dev_toolbar__ = {…}`. Both vanish when disabled. No browser, no
viewport, no island hydration needed to observe this — a `fetch` of any dev-rendered
page is sufficient and exact.

**Touch membership is a hand-maintained allowlist with no guard.**
`playwright.config.ts:57-67` carries an anchored regex alternation of four names.
Nothing in `tests/`, `package.json`, or `.github/workflows/ci.yml` asserts its
contents. The 2026-08-27 run proved the failure mode empirically: removing `worlds`
from the alternation produced **27 passed, exit 0** — fully green, the only signal a
hand-computed count. That was written down as an open action
(`context/runs/2026-08-27-world-economy/run-log.md:353-361`) and never closed.

**The credited guard cannot see the class it is credited with.**
`e2e/growth.spec.ts:181-186` asserts `toHaveCount(1)` + `toBeVisible()` + `href` on each
nav entry. Playwright's `toBeVisible()` performs **no hit-test** — and `f0587ad` records
that the occluded link "still reported visible and uniquely located". Those are exactly
the three properties the bug preserved. Separately, `:193`
(`primaryNav.scrollWidth - clientWidth <= 0`) cannot fail under `AppShell.astro:203`'s
`flex-1 min-w-0` + `truncate`: flex children shrink to fit by construction, so the
measurement is a tautology rather than a fit test.

**The knowledge that prevents recurrence is outside version control.**
`context/foundation/lessons.md` carries L-001, L-002, L-003, L-008 only. L-004
("the contracted assertion could not catch the contracted risk" — whose second worked
example *is* this spec's `scrollWidth` assertion) and L-009 ("a check that can pass
without the thing it checks is decorative") live in
`.claude/skills/10x-autonomous-run/references/lessons-addendum.md`, excluded by
`.gitignore:37` (`.claude/`).

## Desired End State

Running the E2E suite against a server whose toolbar is live **fails immediately**,
before any spec, with a message naming the cause and the fix. Dropping a spec from the
`touch` project **turns the unit suite red** instead of quietly running fewer tests.
And the nav guard fails when a tab cannot actually receive a click, or when a tab's
label is clipped — the two ways nav growth breaks a child's navigation.

Verified by: re-enabling the toolbar makes the harness red at two independent layers
(the probe, and the nav hit-test with the probe bypassed); removing a `touch` spec name
makes `npm run test` red; and the full suite is green with none of those breaks in place.

### Key Discoveries:

- The reuse path skips `webServer.env` entirely — `playwright.config.ts:74` vs `:88`.
- Toolbar injection is two exact HTML markers, gated at `astro/dist/core/app/dev/pipeline.js:70-87`.
- `e2e/global-setup.ts:16-38` is the established "fail loudly before any spec" pattern, with an error-message style to match.
- `tests/nav-labels.test.ts` is the precedent for a pure, browser-free config-hygiene guard — and it already documents owning "half a contract", naming `growth.spec.ts` as the other half.
- Playwright's `click({ trial: true })` runs the full actionability stack — visible, stable, enabled, **receives events** — and skips the action. The receives-events check is the hit-test the bug defeated.
- `growth.spec.ts:73-75` (`horizontalOverflow`) and `:191-193` establish `evaluate`-based *measurement* as a category distinct from element *location*, which `e2e/CLAUDE.md` is what actually restricts.
- The `touch` regex anchoring (`(?:^|\/)` … `$`) is load-bearing: it was previously an unanchored substring match, and `marketing-worlds.spec.ts` joined the project by accident.

## What We're NOT Doing

- **Not fixing the interception.** It is fixed; Astro's flag is sound.
- **Not expanding `touch` coverage.** 6 of 10 specs still never run at a touch viewport. Making the current list *loud* is in scope; growing it is a separate decision.
- **Not touching the phone-width truncation finding.** At 360–390px the bottom bar truncates half its labels ("Rozwój ś…", "Panel ro…"), and `AppShell.astro:66-67`'s comment claims a no-truncation property that holds only at 712px. That is a **product** finding and deserves its own change. Nothing here runs below 712px.
- **Not setting the toolbar flag in `npm run dev`.** Ordinary development keeps its toolbar.
- **Not adding `data-testid` to `AppShell`.** No product code changes in this plan.
- **Not landing L-007.** Unrelated to this change; importing it means landing a lesson nobody is re-verifying against live code right now.

## Implementation Approach

Four phases, each independently committable, ordered so the loud failures land before
the assertions that depend on knowing the server is clean.

Phase 1 makes the guard's *application* observable. Phase 2 makes the touch project's
*membership* observable. Phase 3 makes the nav's *clickability* observable. Phase 4
lands the two lessons this change is an instance of. Phases 1 and 3 interlock during
verification (see Critical Implementation Details).

Every phase carries a **deliberate-break meta-check** — break what the new guard
protects, confirm it goes red, and name why that redness is evidence for that specific
claim. This is repo convention (L-002, L-004) and it is the only thing that
distinguishes this work from the decorative checks it replaces.

## Critical Implementation Details

**Phase 1 and Phase 3's meta-checks interlock, and the order matters.** Phase 3's
decisive proof is re-enabling the toolbar and confirming the nav trial-click goes red —
that is what demonstrates the spec now catches the original incident. But once Phase 1
ships, the global-setup probe fails *before any spec runs*, so the naive version of that
meta-check proves only that Phase 1 works. To run Phase 3's meta-check, temporarily
neutralise the probe (comment out the throw), confirm the trial click is red, then
restore it. Record both facts separately in the handoff: the probe caught it, **and**
the spec would have caught it had the probe not existed. Defence in depth is only
demonstrated by testing the layers independently — this is L-004 applied to this plan's
own verification.

**The truncation assertion may be red on arrival, and that is a finding, not a
calibration problem.** `AppShell.astro:66-67` documents six tabs at 712px as fitting
"at 116px each, with no truncation". If the new assertion is red at 712px, the
component's own documented property is false and the correct response is to **stop and
report** — not to loosen the threshold. A guard edited until it passes is exactly the
decorative check this change exists to remove. (Expected: green. `t.nav.items` labels
at `text-[0.7rem] font-bold` inside a ~116px tab should clear it, but this is a
prediction to verify, not an assumption to build on.)

**`tests/` must stay browser-free and import-cheap.** `vitest.config.ts` sets
`environment: "node"` and `fileParallelism: false`. The Phase 2 guard must not import
`playwright.config.ts` — that module runs `loadEnv` and throws on missing env at import
time, dragging harness setup into the pure unit suite. Import the extracted const only.

## Phase 1: Assert the guard applied

### Overview

Make the toolbar's absence an asserted precondition of every E2E run, and close the
`E2E_PORT` reuse hole that was accepted for landing once already.

### Changes Required:

#### 1. Server-reuse policy

**File**: `playwright.config.ts`

**Intent**: Land the follow-up accepted in the `world-progression-stages` review — a
dev server left running by another checkout must never be silently reused when the
caller has deliberately chosen a port. Credit the original review in the comment rather
than presenting this as newly derived.

**Contract**: `webServer.reuseExistingServer` becomes false whenever `E2E_PORT` is set,
and retains the existing `!process.env.CI` behaviour otherwise. The existing comment at
`:70-73` already explains the "would test THAT tree, not this one" rationale — extend it
with the citation to
`context/archive/2026-08-22-world-progression-stages/follow-ups/review-fixes.md:115-116`,
and note explicitly that this does **not** cover the default-port case, which the
global-setup probe does.

#### 2. Toolbar-absence precondition probe

**File**: `e2e/global-setup.ts`

**Intent**: Prove, before any spec runs, that the server under test is serving pages
with the dev toolbar disabled — converting a silent occlusion bug into a loud,
actionable startup failure. This is the half of the protection that survives a reused
server on the default port, and the only half that would catch Astro renaming or moving
the flag.

**Contract**: A new exported-by-default step, running alongside the existing
backend-identity probe in the same `globalSetup` function. GET `/` (public marketing
route, no auth, server-rendered in dev) at the same `BASE_URL` the file already
computes at `:5`. Fail if the response body contains either injection marker:
`/@id/astro/runtime/client/dev-toolbar/entrypoint.js` or `__astro_dev_toolbar__`.

The thrown error must match the existing probe's style at `:30-34` — state what was
observed, why it matters, and what to do — naming both remedies: stop the stray dev
server, or restart it with `ASTRO_DEV_TOOLBAR_DISABLED=true`.

Comment must record: (a) that these two strings are Astro internals from
`astro/dist/core/app/dev/pipeline.js:70-87`, so an upstream rename makes this probe fail
loudly rather than silently — an acceptable and deliberate maintenance point; (b) *why*
this exists at all, i.e. that `webServer.env` does not apply on the reuse path, which is
the non-obvious fact the whole probe rests on.

Order the two probes so the toolbar check runs first: it is a cheap GET, and a server
with a live toolbar is misconfigured regardless of which Supabase stack it points at.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Type checking passes: `npm run check`
- Unit suite still green: `npm run test`
- Full E2E suite green against a correctly-flagged server: `npx playwright test`

#### Manual Verification:

- Deliberate break: with `npm run dev` running unflagged on `:4321`, `npx playwright test` fails during global setup with the toolbar message — not with a spec failure, and not green.
- Deliberate break, second layer: with `E2E_PORT` set and a stray server on that port, Playwright starts its own server rather than reusing the stray one.
- Meta-check reasoning recorded: name what was broken, what went red, and why that redness is evidence the toolbar specifically was detected (L-004).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Make touch membership loud

### Overview

Give the `touch` project's spec list a single importable source of truth, and a
browser-free guard that goes red when it shrinks — closing the open action from the
2026-08-27 run.

### Changes Required:

#### 1. Extract the touch spec list

**File**: `e2e/touch-specs.ts` (new)

**Intent**: The list of specs that must run at a touch viewport becomes a real exported
value rather than a literal buried in a regex, so a test can assert on it. Nothing else
changes about which specs run.

**Contract**: Exports the spec base names (`gameplay-restore`, `growth`, `worlds`,
`marketing-worlds`) as a readonly array, plus a builder that produces the anchored
`testMatch` regex from it. The anchoring is load-bearing and must be preserved exactly —
`(?:^|/)` pinning the filename to a path segment and `$` pinning the end. Carry the
`playwright.config.ts:57-65` comment's history with it: this used to be an unanchored
substring match, and `marketing-worlds.spec.ts` joined the project purely because its
name ends in `worlds.spec.ts`.

Zero dependencies — no `@playwright/test` import, no env access — so the unit suite can
import it freely.

#### 2. Consume the list from the config

**File**: `playwright.config.ts`

**Intent**: The `touch` project builds its `testMatch` from the shared list instead of
carrying its own literal.

**Contract**: `projects[touch].testMatch` is the builder's output. Behaviour is
unchanged — verify with `npx playwright test --project=touch --list` before and after,
which must report the identical set. Keep the existing "EXTEND the alternation, never
replace it" guidance, updated to point at the new module and at the guard test.

#### 3. Membership guard

**File**: `tests/e2e-touch-project.test.ts` (new)

**Intent**: Turn a silently-shrinking allowlist into a red unit test. Modeled on
`tests/nav-labels.test.ts` — pure, no Supabase, no DOM, no browser.

**Contract**: Three assertions.

1. The shared list equals an expected set **duplicated verbatim in this file**. The
   duplication is the mechanism, not an oversight: removing a spec from the touch project
   now requires two deliberate edits in two files, and the comment must say so
   explicitly or a future reader will "simplify" it away by importing the list twice.
2. Every name in the list resolves to an existing `e2e/<name>.spec.ts` on disk — so a
   rename that orphans an entry is red rather than silently reducing coverage.
3. The built regex still **rejects a near-miss**: a synthetic path like
   `e2e/foo-growth.spec.ts` must not match, proving the anchoring survives. This mirrors
   L-008's convention that over-matching is the worse failure and must be proven against
   directly.

Header comment cites `context/runs/2026-08-27-world-economy/run-log.md:353-361` — the
27-passed/exit-0 incident — as the reason this file exists, and states the division of
labour: this guards *membership*, `growth.spec.ts` guards *behaviour at the viewport*.

### Success Criteria:

#### Automated Verification:

- New guard passes: `npm run test`
- Lint passes: `npm run lint`
- Type checking passes: `npm run check`
- Touch project membership is byte-identical to before the refactor: `npx playwright test --project=touch --list`

#### Manual Verification:

- Deliberate break: remove one name from `e2e/touch-specs.ts` → `npm run test` goes red naming the missing spec, where the same removal previously produced a green Playwright run.
- Deliberate break, anchoring: un-anchor the built regex → the near-miss assertion goes red.
- Meta-check reasoning recorded (L-004): both breaks named, with why each redness is evidence for its specific claim.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Make the nav guard bite

### Overview

Replace two assertions that cannot fail with two that can: a real hit-test in place of
`toBeVisible()`, and a falsifiable label measurement in place of the tautological
overflow check.

### Changes Required:

#### 1. Hit-test every nav entry

**File**: `e2e/growth.spec.ts` (Risk E2E-F4-2, the loop at `:181-186`)

**Intent**: Assert each nav entry can genuinely receive a click, not merely that it
exists and reports itself visible. `toBeVisible()` performs no hit-test, and the
original toolbar bug preserved visibility, uniqueness and `href` simultaneously — every
property this loop currently checks.

**Contract**: Each entry additionally gets a trial click, which runs Playwright's
actionability stack (visible, stable, enabled, receives-events) without navigating. Keep
the existing count/visible/href assertions — they cover repointing, which the hit-test
does not.

The comment must state why plain `toBeVisible()` was insufficient, citing `f0587ad`'s
"still reported visible and uniquely located", because the value of `trial: true` is not
apparent from its name and a future reader will otherwise delete it as redundant.

#### 2. Replace the vacuous fit assertion

**File**: `e2e/growth.spec.ts:188-193`

**Intent**: The current `primaryNav.scrollWidth - clientWidth <= 0` cannot fail: under
`AppShell.astro:203`'s `flex-1 min-w-0`, tabs shrink to fit by construction at any width
and any tab count. Replace it with the property that actually breaks when the nav grows
— a clipped label.

**Contract**: For each nav entry, measure whether its label is truncated and assert it
is not. Truncation is `scrollWidth > clientWidth` on the element carrying
`text-overflow: ellipsis` + `overflow: hidden` + `white-space: nowrap`, reached by
`evaluate` from the role-located link.

This is a **measurement**, not element location — the same category `growth.spec.ts:73-75`
and `:191-193` already establish and label in this file, and it is measurement that
`e2e/CLAUDE.md`'s no-DOM-structure rule leaves open. The comment must make that
classification explicit so it is not misread as a new sanctioned exception.

Keep `horizontalOverflow(page)` at `:196` — a document-level measurement that is not
subject to the flex tautology.

Update the file's provenance header (`:26-32`), which currently describes the touch run
as a "fit check: SIX tabs must sit in one row without pushing the document sideways".
That description is what three handoffs credited; it must now say what the assertions
actually verify — clickability and label legibility.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Type checking passes: `npm run check`
- Spec green in both projects: `npx playwright test e2e/growth.spec.ts`
- Full E2E suite green: `npx playwright test`

#### Manual Verification:

- **The decisive meta-check**: with the Phase 1 probe temporarily neutralised and the toolbar re-enabled, Risk E2E-F4-2 goes red at the trial click on the covered tab — proving the spec now catches the original incident on its own, independently of the probe. Probe restored afterwards.
- Truncation assertion is green at 712px as `AppShell.astro:66-67` claims. **If red, stop and report** — that contradicts the component's documented property and is a finding, not a threshold to loosen.
- Deliberate break: a synthetic 7th tab in `AppShell` turns the truncation assertion red, where the old `scrollWidth` assertion stayed green. Reverted afterwards.
- Meta-check reasoning recorded (L-004): both layers proven independently, each with why its redness is evidence for that specific claim.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Land the lessons

### Overview

Move the two lessons this change is a direct instance of into version control, so they
become priors that future planning and review actually load.

### Changes Required:

#### 1. Track L-004 and L-009

**File**: `context/foundation/lessons.md`

**Intent**: L-004 and L-009 currently live only in
`.claude/skills/10x-autonomous-run/references/lessons-addendum.md`, untracked via
`.gitignore:37`. Both are load-bearing here — L-004's second worked example *is* this
spec's `scrollWidth` assertion, and L-009 names exactly the failure mode this whole
change removes.

**Contract**: Append both sections, preserving their existing L-numbers (the file
already skips numbers — it carries L-001, L-002, L-003, L-008 — so the gaps are
established and must not be renumbered). Keep the addendum's
**Rule / Why / How to apply** structure to match the file's existing entries. Add a
back-reference from each to this change as its most recent instance.

Leave the addendum file as-is; it is untracked and out of this repo's history either
way. L-005, L-006, L-007 stay there.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Formatting clean: `npx prettier --check context/foundation/lessons.md`

#### Manual Verification:

- L-numbers in `lessons.md` are unique and unrenumbered; L-004 and L-009 read coherently without the addendum's surrounding context.
- Committed separately from the harness changes, so the doc move stays reviewable on its own.

---

## Testing Strategy

### Unit Tests:

- `tests/e2e-touch-project.test.ts` — list matches the duplicated expected set; every named spec exists on disk; the anchored regex rejects a near-miss.

### Integration Tests:

- `e2e/global-setup.ts` — toolbar-absence precondition, run once before every E2E invocation in both projects.
- `e2e/growth.spec.ts` Risk E2E-F4-2 — nav entries are hit-testable and their labels unclipped, at 712px and 1280px.

### Manual Testing Steps:

1. Start `npm run dev` unflagged on `:4321`, run `npx playwright test` → fails in global setup naming the toolbar. Stop it, re-run → green.
2. Remove one name from `e2e/touch-specs.ts`, run `npm run test` → red. Restore.
3. Un-anchor the built regex → near-miss assertion red. Restore.
4. Neutralise the Phase 1 probe, re-enable the toolbar, run `npx playwright test e2e/growth.spec.ts --project=touch` → red at the trial click. Restore both.
5. Add a synthetic 7th tab to `AppShell`, run the same spec → truncation assertion red. Revert.
6. Full suite green with all breaks reverted: `npm run test && npx playwright test`.

## Performance Considerations

The probe adds one HTTP GET per suite invocation — negligible against the existing
backend-identity probe, which already provisions and deletes a real user. The trial
clicks add six actionability checks per run of Risk E2E-F4-2 (×2 projects) with no
navigation, so no page reload cost. The `E2E_PORT` reuse change costs one dev-server
cold boot, but only in the worktree/side-by-side case that flag exists for; the default
`:4321` local loop keeps reuse and stays as fast as it is today.

## Migration Notes

None — harness-only, no schema, no product code, no data. Each phase reverts cleanly by
reverting its commit. The one workflow change to communicate: a developer running
`npm run dev` without `ASTRO_DEV_TOOLBAR_DISABLED=true` and then running E2E now gets a
hard stop with instructions, where previously they got a confusing spec timeout or, worse,
a green run.

## References

- Frame brief: `context/changes/e2e-dev-toolbar-intercepts-touch-nav/frame.md`
- Guard: `astro.config.mjs:21`, `playwright.config.ts:74`, `playwright.config.ts:88`
- Original incident: commit `f0587ad` (2026-08-23)
- Toolbar injection: `node_modules/astro/dist/core/app/dev/pipeline.js:70-87`
- Credited-but-blind guard: `e2e/growth.spec.ts:181-186`, `:192-193`
- Touch selection: `playwright.config.ts:57-67`
- Existing precondition-probe pattern: `e2e/global-setup.ts:16-38`
- Pure config-guard precedent: `tests/nav-labels.test.ts`
- Unlanded follow-up: `context/archive/2026-08-22-world-progression-stages/follow-ups/review-fixes.md:115-116`
- Unclosed action: `context/runs/2026-08-27-world-economy/run-log.md:353-361`
- Nav layout: `src/components/app/AppShell.astro:59-72`, `:192-212`
- E2E rules: `e2e/CLAUDE.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Assert the guard applied

#### Automated

- [x] 1.1 Lint passes: `npm run lint`
- [x] 1.2 Type checking passes: `npm run check`
- [x] 1.3 Unit suite still green: `npm run test`
- [x] 1.4 Full E2E suite green against a correctly-flagged server: `npx playwright test`

#### Manual

- [x] 1.5 Deliberate break: unflagged dev server on :4321 fails global setup with the toolbar message
- [x] 1.6 Deliberate break, second layer: E2E_PORT set with a stray server on that port starts a fresh server
- [x] 1.7 Meta-check reasoning recorded (L-004)

### Phase 2: Make touch membership loud

#### Automated

- [ ] 2.1 New guard passes: `npm run test`
- [ ] 2.2 Lint passes: `npm run lint`
- [ ] 2.3 Type checking passes: `npm run check`
- [ ] 2.4 Touch membership byte-identical to before the refactor: `npx playwright test --project=touch --list`

#### Manual

- [ ] 2.5 Deliberate break: removing a name from `e2e/touch-specs.ts` turns `npm run test` red
- [ ] 2.6 Deliberate break, anchoring: un-anchoring the regex turns the near-miss assertion red
- [ ] 2.7 Meta-check reasoning recorded (L-004)

### Phase 3: Make the nav guard bite

#### Automated

- [ ] 3.1 Lint passes: `npm run lint`
- [ ] 3.2 Type checking passes: `npm run check`
- [ ] 3.3 Spec green in both projects: `npx playwright test e2e/growth.spec.ts`
- [ ] 3.4 Full E2E suite green: `npx playwright test`

#### Manual

- [ ] 3.5 Decisive meta-check: probe neutralised + toolbar re-enabled turns the trial click red
- [ ] 3.6 Truncation assertion green at 712px (if red, stop and report — do not loosen)
- [ ] 3.7 Deliberate break: a synthetic 7th tab turns the truncation assertion red
- [ ] 3.8 Meta-check reasoning recorded (L-004)

### Phase 4: Land the lessons

#### Automated

- [ ] 4.1 Lint passes: `npm run lint`
- [ ] 4.2 Formatting clean: `npx prettier --check context/foundation/lessons.md`

#### Manual

- [ ] 4.3 L-numbers unique and unrenumbered; both lessons read coherently standalone
- [ ] 4.4 Committed separately from the harness changes
