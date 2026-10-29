<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Verifying the dev-toolbar guard

- **Plan**: `context/changes/e2e-dev-toolbar-intercepts-touch-nav/plan.md`
- **Scope**: Phases 1–4 of 4 (full plan)
- **Date**: 2026-08-29
- **Verdict**: APPROVED
- **Findings**: 0 critical, 3 warnings, 3 observations — all six fixed during triage

## Verdicts

| Dimension           | Verdict      |
| ------------------- | ------------ |
| Plan Adherence      | WARNING (F1) |
| Scope Discipline    | PASS         |
| Safety & Quality    | WARNING (F2) |
| Architecture        | PASS         |
| Pattern Consistency | WARNING (F3) |
| Success Criteria    | PASS         |

No warning changed shipped behaviour — the diff contains zero product code — so the
rubric lands on APPROVED rather than NEEDS ATTENTION.

## Success criteria, re-run at review time

| Check                                                | Result                                                   |
| ---------------------------------------------------- | -------------------------------------------------------- |
| `npm run lint`                                       | exit 0                                                   |
| `npm run check`                                      | 0 errors, 0 warnings, 8 pre-existing hints               |
| `npm run test`                                       | 65 files, 640 passed (641 after F1's fix)                |
| `npx playwright test e2e/growth.spec.ts`             | 6 passed, both projects                                  |
| `npx playwright test` (full)                         | 31 passed, exit 0                                        |
| `npx playwright test --project=touch --list`         | 8 tests in 4 files — identical to the `0581a0c` baseline |
| `npx prettier --check context/foundation/lessons.md` | clean                                                    |

`gameplay-restore.spec.ts` passed on this run; the pre-existing parallel-load flake
did not reproduce.

## Findings

### F1 — The membership guard did not guard the config that consumes it

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: `tests/e2e-touch-project.test.ts:35`, `playwright.config.ts:73`
- **Detail**: The plan's Desired End State — "dropping a spec from the `touch` project
  turns the unit suite red" — held only for the `e2e/touch-specs.ts` path. Nothing
  asserted that `playwright.config.ts` still _uses_ `touchTestMatch()`, so editing
  `testMatch:` back to a hand-written literal left `TOUCH_SPECS` pristine, all three
  new unit tests green, and the touch project silently shrunk. That is the 2026-08-27
  failure mode, still reachable via one line in the file the list used to live in.
  Phase 2 §3 contracted exactly three assertions and all three landed, so this is a
  gap in the plan, not implementation drift.
- **Fix**: Added a fourth assertion reading `playwright.config.ts` as text
  (`readFileSync` — never imported, preserving the `loadEnv` constraint the plan calls
  out) and matching `/testMatch:\s*touchTestMatch\(\)/`.
- **Meta-check (L-004)**: `testMatch` was replaced with a literal `(growth|worlds)`
  regex, `TOUCH_SPECS` left untouched. Result: **1 failed, 3 passed** — the three
  original assertions all stayed green and only the new one went red, which is the
  evidence that it covers a door the others structurally could not see.
  `playwright.config.ts` restored and confirmed byte-identical.
- **Decision**: FIXED

### F2 — Toolbar-marker comment claimed a loudness the probe does not have

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `e2e/global-setup.ts:13-15`
- **Detail**: The comment claimed an upstream rename "makes this probe fail LOUDLY
  (marker missing → positive control below trips)". It does not. `DEV_MODE_MARKER`
  (`/@vite/client`) is a different string on a different branch and never trips on a
  toolbar-marker rename; the probe fires on `found.length > 0`, so renaming one marker
  is survivable and renaming both is a silent hole. The parenthetical contradicted its
  own opening clause. The plan handed down the "fail loudly rather than silently"
  wording (Phase 1 §2) and the implementation reproduced it faithfully.
- **Fix A ⭐ (applied)**: Comment corrected to state the real behaviour — one marker
  renamed is survivable, both is a silent hole, accepted because both come from the one
  `devToolbar.enabled` branch — with an explicit instruction not to restate it as
  loudness.
- **Fix B (not taken)**: A unit test asserting both marker strings still exist in
  `astro/dist/core/app/dev/pipeline.js`, making the rename genuinely loud. Rejected as
  scope beyond the review: it couples a test to `node_modules` internals and goes red on
  Astro upgrades. Worth revisiting if the probe ever silently lapses.
- **Decision**: FIXED via Fix A

### F3 — Subtree walk was a new pattern against a deliberately closed list

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `e2e/CLAUDE.md:11-21`, `e2e/growth.spec.ts:236`
- **Detail**: The "measurement, not element location" classification is honest on
  substance — the discriminator is computed style, not structure, so reparenting the
  span cannot break it. But the cited precedents (`horizontalOverflow`, the old
  `primaryNav.evaluate`) never _find_ anything; they measure the element already
  located. The new code locates an unnamed descendant by subtree traversal and then
  measures it, which is a step beyond the precedent. `e2e/CLAUDE.md` says "closed list
  — do not extend it by analogy", and the judgment lived only in the spec that benefits
  from it, inviting the next author to cite it as precedent.
- **Fix**: Recorded as sanctioned exception 4 in `e2e/CLAUDE.md`, with the line drawn
  explicitly — measurement from a role-located element is allowed, structural selection
  stays banned, and `querySelectorAll` is not a licence to locate.
- **Decision**: FIXED

### F4 — The `clippers` control did not cover the failure that created it

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `e2e/growth.spec.ts:257`
- **Detail**: The control fires for the right reasons and is two-sided (6 at touch, 0
  at desktop; the desktop zero is structural — `AppShell.astro:117` renders the sidebar
  label as a bare text node with nothing clipping it). But it proves the _walk found a
  clipping element_, not that the _number computed from it can be non-zero_ — the same
  shape as the control that already fooled this change once. The only protection
  against recurrence was the prose record in `change.md`.
- **Fix**: `toBeLessThanOrEqual(0)` tightened to `toBeLessThan(0)`. The vacuous form
  reported exactly 0 for every label at every tab count, so `<= 0` would welcome it back
  green while `< 0` turns it red. All six labels clear their tabs by a real margin today
  (worst: `Rozwój świata`, −33 px at six tabs).
- **Decision**: FIXED

### F5 — Labels were measured without waiting for the webfont

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `e2e/growth.spec.ts:236`
- **Detail**: Answering the handoff's flake question: **not flake-prone today.** The
  decisive fact the plan does not record is that the font is
  `@fontsource-variable/nunito`, imported at `Layout.astro:2` and bundled by Vite —
  self-hosted, npm-pinned, byte-identical in CI, never fetched over the network. The
  usual cross-machine variance (webfont fails, system font substitutes) does not apply;
  same font file and shaping means drift of ±1–2 px against 33 px of headroom. The
  residual vector was timing, not machines: nothing waited for the face to swap in, and
  a measurement taken before it does uses fallback metrics (system-ui → DejaVu Sans on
  Linux CI, ~10–15% wider). At 33 px headroom that cannot flip the assertion; at the
  hypothetical 8-tab −4 px it could — but that is a tab count nobody has shipped, and at
  −4 px the label genuinely almost does not fit, which is a product signal rather than
  noise. Also noted: `scrollWidth` is an integer while `inner` is a float, so the
  comparison carries ~1 px of rounding bias — irrelevant except in that same near-zero
  regime.
- **Fix**: `await page.evaluate(() => document.fonts.ready)` before the loop.
- **Decision**: FIXED

### F6 — `lessons.md` and the untracked addendum had diverged

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `context/foundation/lessons.md:29,52`
- **Detail**: Phase 4 lost no meaning — both lessons _gained_ material. L-004's
  Rule/Why/How-to-apply mapping is faithful, with "record both the break and the
  reasoning" sharpened to "what you broke, what went red, and why that redness is
  evidence for that specific claim", plus the defence-in-depth clause and an L-009
  cross-reference. L-009 was restructured into the house shape and gained the
  measurement generalisation ("before trusting a number, confirm it is capable of
  coming out wrong") and the positive-control guidance. The consequence, chosen
  knowingly by the plan: two L-009s existed, and the **narrower** one was the copy
  `/10x-autonomous-run` loads, so future autonomous runs would get the
  path-resolution rule without the measurement generalisation this change paid for.
- **Fix**: Addendum L-004 and L-009 synced to the tracked text, each with a pointer
  naming `context/foundation/lessons.md` as canonical. L-005/L-006/L-007 untouched;
  all L-numbers verified unique and unrenumbered.
- **Decision**: FIXED

## Confirmed, no finding

- **`click({ trial: true, timeout: 10_000 })`** — defensible, with measurement behind
  it. Risk E2E-F4-2 runs in **847 ms** at touch under the normal 4-worker config; the
  six trial clicks are free. 10 s is ~1000× observed and sits well inside the default
  30 s test timeout (nothing overrides it — `timeout: 120_000` is `webServer`'s), so it
  delivers what the comment claims: a fast failure naming the intercepting element
  instead of a bare 30 s timeout. The bar is `position: fixed`, so scroll-into-view is a
  no-op.
- **The deliberate duplication** in `tests/e2e-touch-project.test.ts` — comment is
  accurate and load-bearing. Importing `TOUCH_SPECS` on both sides would make the
  equality assertion self-comparing and Phase 2's Break A would have gone green. The
  comment says exactly that, in the imperative, at the constant. The file also matches
  `tests/nav-labels.test.ts` closely — same header shape, same division-of-labour
  paragraph.
- **Phase 3's approved deviation** — verified independently. `AppShell.astro:203` is
  `flex min-w-0 flex-1 flex-col items-center`; `items-center` sizes the span to
  max-content in the cross axis so it overflows the anchor rather than being clamped by
  it, making `scrollWidth === clientWidth` structural exactly as recorded. Measuring
  against `el.clientWidth − paddingLeft − paddingRight` is the correct content box
  (`clientWidth` includes padding, excludes border).
- **L-008 prettier edits in Phase 4** — four `*em*` → `_em_` conversions and one blank
  line, rendering-identical in CommonMark, required for criterion 4.2 to pass.
  Correctly bundled with the phase that introduced the requirement, not scope creep.
- **The three findings deliberately not acted on** (inert `truncate`, nav outgrowing its
  row, step 3.7's wrong prediction) — agreed. All are product or out-of-scope, and all
  are written down well enough for someone without the transcript.

## Post-triage verification

All gates re-run after the six fixes: `npm run lint` exit 0, `npm run check` 0
errors/0 warnings, `npx prettier --check` clean on both edited docs, `npm run test`
**641 passed** (up from 640 — F1's new assertion),
`npx playwright test e2e/growth.spec.ts` **6 passed** in both projects.

MERGE: CLEAR — every success criterion re-verified green, no CRITICAL finding, and all six findings fixed and re-verified.
