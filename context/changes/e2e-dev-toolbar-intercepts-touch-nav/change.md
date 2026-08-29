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
