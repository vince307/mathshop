# Verifying the dev-toolbar guard — Plan Brief

> Full plan: `context/changes/e2e-dev-toolbar-intercepts-touch-nav/plan.md`
> Frame brief: `context/changes/e2e-dev-toolbar-intercepts-touch-nav/frame.md`

## What & Why

The protection against dev-toolbar occlusion is entirely unverified — the guard can
silently fail to apply, and the test credited with covering the class asserts properties
the failure preserved — so in both directions the suite goes green while protecting
nothing.

This plan verifies the guard. It does **not** fix the interception: that was fixed in
`f0587ad` and Astro's flag is airtight. The change-id names a closed incident; the work
is what the incident left open.

## Starting Point

`playwright.config.ts:88` sets `ASTRO_DEV_TOOLBAR_DISABLED` inside `webServer.env`, but
`:74` is `reuseExistingServer: !process.env.CI` — and the reuse path never launches the
process, so the flag never applies. Any `npm run dev` on the port satisfies Playwright's
HTTP availability probe. CI is structurally immune, so this can never turn a PR red.
Meanwhile `e2e/growth.spec.ts:181-186` asserts count + `toBeVisible()` + `href` — the
exact three properties the occlusion bug preserved — and `:193`'s fit check cannot fail
under `flex-1` + `truncate`. Touch-project membership is a hand-maintained allowlist
that, when it shrank during the 2026-08-27 run, produced 27 passed / exit 0.

## Desired End State

Running E2E against a server with a live toolbar fails immediately, before any spec,
naming the cause and the fix. Dropping a spec from the `touch` project turns the unit
suite red instead of quietly running fewer tests. The nav guard fails when a tab cannot
actually receive a click, or when its label is clipped — the two ways nav growth breaks
a child's navigation.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| What to fix | Verify the guard, not the toolbar | Interception is fixed and Astro's flag is sound; the gap is that nothing asserts it applied. | Frame |
| Server reuse | Probe **and** land the accepted follow-up | The follow-up alone leaves the default-port case exposed; the probe alone leaves `E2E_PORT`'s purpose defeatable. | Plan |
| Probe mechanism | HTML injection markers over HTTP | Astro's dev pipeline emits two exact strings when the toolbar is on — browser-free, runs once, matches the existing backend-identity probe. | Plan |
| Membership guard | Shared const + duplicated expected set in a `tests/` guard | Removing a spec now takes two deliberate edits and goes red in the fast unit suite. | Plan |
| Hit-test | `click({ trial: true })` | Runs the receives-events check the bug defeated, without navigating. | Plan |
| Vacuous fit check | Replace with a label-truncation measurement | Falsifiable, passes today at 712px, red when nav growth clips a label. | Plan |
| Lessons | Land L-004 and L-009 in git | This change is a direct instance of both, and they currently live in a gitignored file. | Frame |

## Scope

**In scope:** the `E2E_PORT` reuse follow-up; a toolbar-absence precondition probe; an
importable touch-spec list plus a unit guard on it; a real hit-test and a falsifiable
fit check in `growth.spec.ts`; L-004 and L-009 into `context/foundation/lessons.md`.

**Out of scope:** fixing the interception (already fixed); expanding touch coverage
beyond the current four specs; the phone-width label truncation at 360–390px (a product
finding deserving its own change); setting the toolbar flag in `npm run dev`; any
product-code change, including test ids on `AppShell`.

## Architecture / Approach

Two independent layers of protection, each proven separately. **Layer 1** —
`e2e/global-setup.ts` refuses to start when the server under test serves a toolbar, and
`playwright.config.ts` stops reusing a server when a port was deliberately chosen.
**Layer 2** — `e2e/growth.spec.ts` asserts each nav tab can actually receive a click, so
occlusion from *any* cause is caught even if layer 1 is bypassed. A third, orthogonal
guard in `tests/` keeps the touch project from silently shrinking out from under both.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Assert the guard applied | Toolbar-absence probe + `E2E_PORT` reuse fix | Probe couples to two Astro-internal strings; an upstream rename makes it fail loudly (acceptable, must be commented) |
| 2. Make touch membership loud | Shared spec list + unit guard | The deliberately duplicated expected set reads as redundant and gets "simplified" away later |
| 3. Make the nav guard bite | Trial-click hit-test + truncation check | The truncation assertion could be red on arrival, contradicting `AppShell`'s documented 712px property |
| 4. Land the lessons | L-004 + L-009 into tracked `lessons.md` | Touches a shared foundation file; needs its own commit |

**Prerequisites:** local Supabase stack up (`npx supabase start`), `.env.test` populated,
Playwright chromium installed. No new dependencies.
**Estimated effort:** ~1–2 sessions; phases 1, 2 and 4 are small, phase 3 carries most of
the verification work.

## Open Risks & Assumptions

- **Assumed:** six tabs at 712px do not truncate, as `AppShell.astro:66-67` claims. If the
  new assertion is red on arrival, the plan says stop and report — a guard edited until
  it passes is the decorative check this change exists to remove.
- **Phases 1 and 3 interlock during verification.** Once the probe ships it fails before
  any spec, so proving phase 3's spec catches the toolbar on its own requires temporarily
  neutralising the probe. The plan calls this out; skipping it would leave layer 2
  unproven while looking verified.
- **CI cannot exercise the reuse path** (`CI=true` → no reuse), so phase 1's most
  important break is manual and local only. The probe's flag-regression coverage does run
  in CI.
- The probe reads two Astro internals. Pinned to `astro@^6.3.1`; an upstream rename
  surfaces as a loud probe failure, not a silent regression.

## Success Criteria (Summary)

- An unflagged dev server on the port makes the E2E run fail immediately with an
  actionable message, instead of a confusing tab-click timeout or a false green.
- Removing a spec from the `touch` project turns `npm run test` red, where the same
  removal previously produced a fully green Playwright run.
- With the toolbar re-enabled and the probe bypassed, `growth.spec.ts` goes red at the
  tab the toolbar covers — the spec now catches the original incident on its own.
