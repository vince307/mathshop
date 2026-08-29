---
change_id: e2e-dev-toolbar-intercepts-touch-nav
title: E2e dev toolbar intercepts touch nav
status: implementing
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
