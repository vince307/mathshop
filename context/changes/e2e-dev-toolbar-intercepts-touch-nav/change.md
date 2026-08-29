---
change_id: e2e-dev-toolbar-intercepts-touch-nav
title: E2e dev toolbar intercepts touch nav
status: implemented
created: 2026-08-29
updated: 2026-08-29
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

## Phase 2 baseline — `touch` membership BEFORE the refactor

Captured on `0581a0c` with `npx playwright test --project=touch --list`. Phase 2
extracts this list into a shared const; the refactor must reproduce this set exactly.

```
[touch] › gameplay-restore.spec.ts:36:1  gameplay: start → tasks … → upgrade purchase (Risk #6)
[touch] › gameplay-restore.spec.ts:88:1  restore: a fresh browser context … (Risk #2)
[touch] › growth.spec.ts:77:1            the nav entry reaches the growth screen … (Risk E2E-F4-1)
[touch] › growth.spec.ts:126:1           the next-upgrade card stays a finished thought … (Risk E2E-F4-3)
[touch] › growth.spec.ts:166:1           every nav entry stays uniquely reachable … (Risk E2E-F4-2)
[touch] › marketing-worlds.spec.ts:36:1  the landing page advertises every world … (Risk W1-E2E-2)
[touch] › marketing-worlds.spec.ts:47:1  the auth marketing panel advertises every world … (Risk W1-E2E-2)
[touch] › worlds.spec.ts:51:1            every world tile fits the grid at this viewport … (Risk W1-E2E-1)
Total: 8 tests in 4 files
```

## Phase 1 meta-check record (L-004)

The frame predicted the guard *could* silently fail to apply. On this machine it
already had: the dev server running on `:4321` at implementation time was serving the
toolbar, so before this change `npx playwright test` would have reused it and run the
whole touch project against a live overlay. The break below was therefore observed,
not staged.

**Break A — unflagged server on the default port.**

- *Broken:* nothing. A pre-existing `npm run dev` on `:4321`, confirmed by `curl` to
  serve both injection markers (`dev-toolbar/entrypoint.js`, `__astro_dev_toolbar__`).
- *Red:* `npx playwright test` aborted in global setup, before any spec, naming both
  markers and both remedies.
- *Why that redness is evidence:* the probe reports the two strings Astro's dev
  pipeline emits **only** inside the `devToolbar.enabled` branch
  (`astro/dist/core/app/dev/pipeline.js:70-87`), and it reached them over the same
  `BASE_URL` the specs use. So the redness proves the toolbar was live *on the server
  under test* — not that some config value was unset, which is precisely the
  distinction `webServer.env` could not make on the reuse path.
- *Positive control (L-009):* the probe first requires `/@vite/client`, added
  unconditionally to every dev-rendered page by the same code path. Without it a 404,
  a redirect, or an `astro preview` server would satisfy "no toolbar markers" while
  proving nothing. The check verifies the path, not the fact.

**Break B — explicit port must refuse a stray server.**

- *Broken:* `E2E_PORT=4321` with that same stray server still listening.
- *Red:* Playwright refused with "http://localhost:4321 is already used…" instead of
  adopting it.
- *Why that redness is evidence:* the refusal comes from `reuseExistingServer` being
  false, which is the landed follow-up. Under the previous `!process.env.CI` the same
  command would have reused the stray toolbar-serving server silently. This is the
  worktree half; Break A covers the default-port half the follow-up does not reach.

**Break C — the premise itself, and the frame's central claim, proven in a browser.**

Breaks A and B prove the probe detects a toolbar. They do not prove a toolbar still
*breaks* anything — that rested on `f0587ad`'s account and on reasoning about
`toBeVisible()`. So the toolbar check was temporarily commented out and
`e2e/growth.spec.ts --project=touch` was run against the live toolbar-serving server
on `:4321` (reuse path, default port). Result:

- **Risk E2E-F4-1** (`:77`, does a REAL `.click()` on the growth nav entry) —
  **failed, 30 s timeout**, page snapshot still on `/app/start`. Sign-in had
  succeeded and the other two tests passed in 1.5 s against the same server, so the
  click is the only thing that hung.
- **Risk E2E-F4-2** (`:166`, the guard three handoffs credited with covering this
  class — `toHaveCount(1)` + `toBeVisible()` + `href`) — **passed in 1.5 s.**
- The failing test's own a11y snapshot shows the entry fully present and
  unambiguous: `link "Rozwój świata"`, `/url: /app/growth`, `cursor=pointer`.

*Why that is evidence:* the two tests ran against the same server, in the same
project, at the same viewport, in the same run. One that clicks fails; one that only
locates passes. That is the frame's claim — "the contracted assertion could not catch
the contracted risk" (L-004) — reproduced rather than argued, and it is the empirical
justification for Phase 3's trial-click. It also pre-validates step 3.5.

Probe restored immediately afterwards and re-verified as firing (`global-setup.ts:108`).

**Observation, not a blocker:** the first full-suite run showed two failures in
`[touch] gameplay-restore.spec.ts` (results heading timeout); the same spec passes in
isolation and the next full run was 31 passed / 1 skipped. Both runs used identical
cold-server conditions, so the variance is pre-existing suite flakiness under parallel
load — masked in CI by `retries: 2`, exposed locally by `retries: 0`. Unrelated to the
toolbar guard; worth its own change.

## Phase 2 meta-check record (L-004)

The refactor is behaviour-preserving by construction, so the interesting question is
not "does the list still work" but "does the new guard actually observe the thing it
claims to guard". Both breaks below were executed, not staged.

**Refactor fidelity first.** `npx playwright test --project=touch --list` after the
change is byte-identical to the baseline recorded above — same 8 tests, same 4 files,
same order. The list moved into `e2e/touch-specs.ts`; nothing about which specs run
changed.

**Break A — a name removed from the shared list.**

- *Broken:* `worlds` deleted from `TOUCH_SPECS` in `e2e/touch-specs.ts` — the exact
  edit that went unnoticed on 2026-08-27.
- *Red:* `tests/e2e-touch-project.test.ts > matches the expected set exactly` failed,
  with a diff naming the missing entry (`- "worlds"`).
- *Why that redness is evidence:* the same break was run through **both** signals in
  the same working tree. Playwright reported `Total: 7 tests in 3 files`, **exit 0** —
  the 2026-08-27 failure mode reproduced exactly, green while covering less. The unit
  guard went red on the identical tree. So the redness is not "a test failed
  somewhere"; it is the specific demonstration that the new guard sees a shrinkage the
  E2E runner structurally cannot report, which is the entire claim of this phase.
- *Why the duplication is the mechanism:* the guard compares `TOUCH_SPECS` against a
  second literal in the test file. Had it imported the list twice, Break A would have
  been **green** — both sides would have shrunk together. The redness is therefore
  evidence about the duplication, not just about the assertion.

**Break B — the anchoring, tested at each end separately.**

- *Broken, B1:* the `(?:^|/)` prefix anchor removed from the built regex.
- *Red:* `e2e/foo-growth.spec.ts should NOT be in the touch project: expected true to
  be false`.
- *Broken, B2:* the `$` end anchor removed.
- *Red:* `e2e/growth.spec.ts.bak should NOT be in the touch project`.
- *Why that redness is evidence:* each anchor was broken independently and each
  produced a **different** failing path. That rules out a single over-broad assertion
  standing in for both, and it reproduces the historical accident directly — an
  unanchored match is precisely how `marketing-worlds.spec.ts` joined this project by
  name coincidence. Over-matching is the worse failure (L-008), so it is asserted
  against rather than assumed.
- *Positive control (L-009):* the same test first asserts every listed spec path
  **does** match. Without it, a regex that matched nothing would satisfy all five
  rejection assertions and prove nothing — the check would verify the outcome, not the
  path. Both halves live in one test so neither can be deleted as redundant.

Tree restored after each break and re-verified: `touch-specs.ts` byte-identical to
pre-break, guard 3 passed, `--list` back to 8 tests in 4 files.

**Not covered, deliberately:** the guard proves a name cannot silently *leave* the
list. It cannot prove the list is *complete* — 6 of 10 specs still never run at a touch
viewport, which the plan scopes out ("Not expanding `touch` coverage"). Making the
current list loud is what landed; growing it remains a separate decision.

## Phase 3 meta-check record (L-004)

Two layers, proven independently — which is the only way defence in depth is
demonstrated rather than asserted.

**Break A — the decisive one: the spec catches the original incident on its own.**

- *Broken:* the Phase 1 probe neutralised (`assertDevToolbarDisabled()` commented
  out) **and** the toolbar re-enabled (`ASTRO_DEV_TOOLBAR_DISABLED: "false"` in
  `webServer.env`), on an explicit `E2E_PORT` so Playwright launched its own
  toolbar-serving server rather than adopting a stray one.
- *Red:* Risk E2E-F4-2 failed at the trial click, 10 s, on the `Mój sklep` tab.
  Call log: `element is visible, enabled and stable` → `scrolling into view if
  needed` → `<astro-dev-toolbar></astro-dev-toolbar> intercepts pointer events`,
  retried to timeout.
- *Why that redness is evidence:* the call log contains the old assertions'
  verdict and the new one's, in order, on the same element in the same
  millisecond. Visible ✓, enabled ✓, stable ✓ — the exact three properties
  `toHaveCount(1)` + `toBeVisible()` + `href` were checking, all satisfied — and
  then a hit-test that fails, naming the occluding element. That is not "a test
  failed"; it is the precise demonstration that the receives-events check sees
  what the previous three could not. Under the old assertions this test passed in
  1.5 s against a toolbar-serving server (Phase 1, Break C).
- *Independence from Phase 1:* the probe was OFF for this run. Phase 1's Break A
  proved the probe stops the suite; this proves the spec would have caught it had
  the probe not existed. Neither result implies the other.
- *Incidental confirmation:* the occluded tab here is `Mój sklep`, where Phase 1's
  Break C hit `Rozwój świata` — the same overlay, a different victim, because
  which tab a fixed bottom-centre overlay covers depends on the tab count. That is
  the "silently breaks a different test each time the nav grows" claim in
  `playwright.config.ts`, observed twice at two tab positions.
- Probe and flag restored from HEAD immediately afterwards; `git diff --quiet`
  clean on both files.

**Break B — the truncation assertion, and a plan correction it forced.**

The plan specified measuring truncation as `scrollWidth > clientWidth` on the
element carrying `text-overflow: ellipsis`. Written that way it is **incapable of
failing**, and the deliberate break is what surfaced it:

- *Broken, B1:* a synthetic 7th tab, as step 3.7 prescribes. *Green.* Escalated to
  8, 9, 10 tabs — still green, every label reporting overflow **exactly 0**.
- *Broken, B2:* a 315 px label (`t.nav.items.growth` temporarily lengthened) inside
  a 116 px tab. *Still green*, still reporting 0.
- *Diagnosis:* the anchor is `flex-col items-center`, so in the cross axis the
  `truncate` span sizes to its own CONTENT — `scrollWidth === clientWidth` by
  construction, at any label length. Measured geometry at 6 tabs: span 315 px,
  anchor 116 px, reported overflow 0.
- *Why that greenness is evidence:* B2 is a positive control on the measurement
  itself, not on the element. The Phase-3 draft already asserted that a clipping
  element EXISTS (six of them at touch, none at desktop) and that control passed —
  so the apparatus looked live while the number it produced was pinned at zero.
  A check can be decorative one level below where you last looked (L-009).
- *Correction:* the label is compared against the TAB's content box, which is what
  actually constrains it. Falsifiable in both directions, and it degrades
  monotonically instead of sitting at zero — worst-label (`Rozwój świata`)
  headroom: **6 tabs −33 px, 7 −16 px, 8 −4 px, 9 +6 px (RED)**; long label
  **+207 px (RED)**.
- *Step 3.7 is corrected, not satisfied as written.* A 7th tab breaks nothing —
  under either assertion. The nav's real headroom at 712 px is **two** more tabs;
  the **9th** is the one that clips. The plan's prediction was wrong, and the
  number above replaces it.

**Product finding (reported, not fixed — this plan changes no product code).**
`truncate` on the bottom-bar label span is **inert**: a label too long for its tab
overflows and overlaps its neighbours rather than ellipsising, at any viewport.
`AppShell.astro:66-67`'s "no truncation" is true at 712 px but for the wrong
reason — truncation is impossible there, not avoided. This also does not explain
the frame's observed "Rozwój ś…" / "Panel ro…" at 360–390 px, which deserves
re-checking in the separate change that already owns the phone-width finding.

**What the corrected assertion still does not cover.** It measures the label
against its tab; it does not measure whether the TABS fit the nav. At 9–10 tabs
the anchors stopped shrinking (77 px each, ~773 px of tabs in a 696 px row) and
`horizontalOverflow(page)` stayed green because the bar is `position: fixed`. So
a nav that outgrows its row is currently caught only via the label, and only once
a label is the thing that overflows. Not in scope here; worth its own risk.
