# Frame Brief: Dev toolbar occlusion in the touch E2E project

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

**There is no live observation.** The change was opened from a change-id alone —
`e2e-dev-toolbar-intercepts-touch-nav` — with empty `## Notes` and no `research.md`.
The id asserts a *cause* ("the dev toolbar intercepts touch nav"), not an effect.

Asked to separate the two, the maintainer answered "not sure" to all three
pre-dispatch questions: no red test, no known scope, no knowledge of whether a dev
server was already running. This is recorded as fact, not as a gap to be papered
over — it is what makes the reframe below necessary rather than optional.

The named cause was **already diagnosed and fixed** in `f0587ad` (2026-08-23),
"fix(e2e): keep Astro's dev toolbar out of the mobile bottom nav". So the id
describes a closed incident, and the real question is what — if anything — that
incident left open.

## Initial Framing (preserved)

- **User's stated cause or approach**: the dev toolbar overlay intercepts pointer
  events on the mobile bottom nav during the Playwright `touch` project.
- **User's proposed direction**: not stated. `change.md` Notes are empty.
- **Pre-dispatch narrowing**: "Nie jestem pewien" / "Nie jestem pewien" / "Nie wiem,
  nie sprawdzałem" — the maintainer explicitly did not separate symptom from cause,
  and wrote the id from memory of the old incident. **This is the single most
  informative answer in the frame**: it rules out "a test is failing right now" and
  makes the investigation a question about residual exposure, not about a bug.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Completeness of the disable mechanism** — the guard exists but can silently
   fail to apply, so the toolbar is live during a run that looks correctly configured.
2. **Island-props echo** — a second, distinct toolbar manifestation (props echoed as
   matchable text) worked around ad-hoc in one spec and never addressed systematically.
3. **Detection** — nothing goes red when the guard regresses; touch coverage is a
   hand-maintained allowlist that shrinks green.  ← *leading*
4. **Nav fragility at 712px** — the toolbar was the trigger, and the real fault is a
   bottom bar with zero layout slack that the next tab breaks for real users.

The initial framing lands on **none** of these — it names the 2023-era mechanism
(`ASTRO-DEV-TOOLBAR` returned by `elementFromPoint`), which is fixed and airtight.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| **D1: the disable mechanism is incomplete** | `playwright.config.ts:74` `reuseExistingServer: !process.env.CI`. Playwright's runner returns *before* `launchProcess`, so the `env` block carrying `ASTRO_DEV_TOOLBAR_DISABLED` (`playwright.config.ts:88`) is never applied on the reuse path; availability is an HTTP probe of the URL, so any `npm run dev` on the port satisfies it. `package.json`'s `dev` script does not set the flag. Astro's flag itself is sound — with it applied, the toolbar script is never served, so no element exists. CI is structurally immune (`CI=true` → no reuse), so this can never turn a PR red. The identical fix was accepted and never landed: `context/archive/2026-08-22-world-progression-stages/follow-ups/review-fixes.md` proposes "`reuseExistingServer: false` whenever `E2E_PORT` is set"; `playwright.config.ts:74` still reads `!process.env.CI`. | **STRONG** |
| **D2: island-props echo is the unfixed half** | Mechanism confirmed and correctly attributed: props reach the DOM as an *attribute* (`astro/dist/runtime/server/render/component.js:324`), invisible to `getByText`; only the toolbar's xray app (`dev-toolbar/apps/xray.js:110-117`) turns them into a text node, unprompted, in an open shadow root Playwright pierces. But the blast radius is **one line**. An audit of all 14 non-`exact` `getByText` calls against the props of all 13 islands found **zero** further exposed sites: `serverError` is the only user-visible sentence crossing an island boundary as a prop, and `e2e/password-reset.spec.ts:73` is the only inexact assertion on one. Not "never systematically fixed" — systematically inapplicable. | **WEAK** |
| **D3: the problem is detection, not the toolbar** | Two independent holes. **(a) Selection**: `playwright.config.ts:67` is a hand-maintained allowlist of four names; 6 of 10 specs never run at a touch viewport; removing one alternative during the 2026-08-27 run gave **27 passed, exit 0** — the only signal was a hand-computed count. That follow-up was written down as "it remains an open action" (`context/runs/2026-08-27-world-economy/run-log.md:361`) and `concurrency.md` still has no section on it. Nothing in `.github/workflows/`, `package.json`, or `tests/` asserts project membership. **(b) Assertion**: `e2e/growth.spec.ts:181-186` asserts `toHaveCount(1)` + `toBeVisible()` + `href` — and `toBeVisible()` performs **no hit-test**, while `f0587ad` records that the broken link "still reported visible and uniquely located". Those are exactly the three properties the bug preserved. | **STRONG** |
| **D4: real nav fragility independent of the toolbar** | Mechanism disproved. `AppShell.astro:203` uses `flex-1 min-w-0` + `truncate`, so `712 = 6 × 116 + 16` is a **tautology of flex-1**, not a measurement of fit — it holds at any width and any tab count. Measured: a 7th tab at 360px yields 49px tabs and still zero overflow; `e2e/parent-weekly-report.spec.ts:112-131` already exercises a six-tab bar at 390×844 and passes. No cliff, no accumulating debt. **But** the same read shows `e2e/growth.spec.ts:192`'s `scrollWidth - clientWidth <= 0` **can never fail** under `flex-1` + `truncate` — a vacuous fit test, reached independently of D3. | **WEAK** (mechanism), with a STRONG incidental corroboration of D3 |

## Narrowing Signals

- **Three "not sure" answers.** No live failure exists. Any plan that starts by
  "fixing the interception" would be fixing something already fixed.
- **D1 and D2 converged on `reuseExistingServer` without knowing each other's
  results.** Two agents, two different lenses (config completeness vs. text-locator
  contamination), same single live thread — the guard is bypassable locally, and when
  it is, *both* toolbar manifestations return at once with no signal.
- **D3 and D4 converged on `e2e/growth.spec.ts` without knowing each other's
  results.** D3 found `toBeVisible()` does no hit-test; D4 found the `scrollWidth`
  assertion is vacuous under `flex-1`. Two independent routes to: the test credited
  across three handoffs with covering this class covers a *different property* than
  the one that broke.
- **The knowledge that should prevent recurrence is not in version control.**
  `context/foundation/lessons.md` carries only L-001, L-002, L-003, L-008; L-004–L-007
  and L-009 live in `.claude/skills/10x-autonomous-run/references/lessons-addendum.md`,
  excluded by `.gitignore:37`. The `testMatch` rule exists only as a code comment
  (`playwright.config.ts:57-65`) and as prose in run folders, one of them untracked.

## Cross-System Convention

This repo already has a name for this exact shape. **L-004**: "the contracted
assertion could not catch the contracted risk" — established when a
`documentElement.scrollWidth` assertion was contracted to catch bottom-bar overflow
on a `position: fixed` bar it could not measure. **L-009**: "a check that can pass
without the thing it checks is decorative — verify the path, not the fact."

The convention is therefore well established and the findings sit squarely inside it.
What is *not* conventional is that both lessons live outside git, and that the test
written in the aftermath of the toolbar incident reproduces L-004's failure mode.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: the protection against dev-toolbar
> occlusion is entirely unverified — the guard can silently fail to apply, and the
> test credited with covering the class asserts properties the failure preserved — so
> in both directions the suite goes green while protecting nothing.

The initial framing was **not** wrong about the mechanism; it was wrong about the
tense. Interception is fixed and Astro's flag is airtight, so there is nothing to fix
*there*. What the incident left behind is a two-line config guard with zero test
coverage, bypassable by any dev server already on the port, plus a spec that three
separate handoffs credit with guarding the class it cannot observe. Closing this means
the guard's regression becomes visible; leaving it means the next nav growth
rediscovers the same confusing signature — a click timing out on an element that
reports itself visible and uniquely located — most likely inside an autonomous-run
worktree, where nobody is watching.

## Confidence

**HIGH** — two hypotheses returned STRONG on independently verified evidence; the two
WEAK verdicts each independently corroborated the leading one rather than competing
with it; three load-bearing citations (`playwright.config.ts:74`, the unlanded
follow-up, `lessons.md`'s L-numbers) were re-verified directly rather than taken from
agent report; and the finding matches two lessons the repo has already written.

## What Changes for /10x-plan

Plan **verification of the guard**, not a fix to the toolbar. Concretely, the plan's
subject is: making the toolbar's absence an asserted precondition rather than a hoped-for
side effect of how the server happened to start; making `touch` project membership
fail loudly when it shrinks; and making the nav guard hit-test rather than merely
locate. The already-accepted-but-unlanded `reuseExistingServer` follow-up is in scope
and should be credited to its original review rather than re-derived.

**Out of scope, but real and worth a separate change** (found by D4, independent of
everything above): at 360–390px the bottom bar truncates half its labels — a child
sees "Rozwój ś…", "Panel ro…", "Mój sk…" — and `AppShell.astro:66-67`'s comment
claims a no-truncation property that holds only at 712px. Nothing tests label
legibility or tap-target size at phone widths. This is a product finding, not a
harness one; do not let it absorb this change.

## References

- Guard: `astro.config.mjs:21`, `playwright.config.ts:74`, `playwright.config.ts:88`
- Original incident: commit `f0587ad` (2026-08-23)
- Credited-but-blind guard: `e2e/growth.spec.ts:181-186`, `:192`
- Touch selection: `playwright.config.ts:57-67`
- Island-props workaround: `e2e/password-reset.spec.ts:71-73`
- Unlanded follow-up: `context/archive/2026-08-22-world-progression-stages/follow-ups/review-fixes.md`
  (and its `reviews/impl-review.md:350-354`)
- Unclosed action: `context/runs/2026-08-27-world-economy/run-log.md:353-361`
- Lessons: `context/foundation/lessons.md` (L-001/002/003/008 only);
  L-004, L-007, L-009 in `.claude/skills/10x-autonomous-run/references/lessons-addendum.md` (untracked)
- Nav layout: `src/components/app/AppShell.astro:59-72`, `:192-212`
- Investigation: four parallel hypothesis agents (D1–D4), 2026-08-29
