---
change_id: web-shell-and-mockup-parity
title: Web app shell + responsive parity with the matmaverse mockups
status: in-progress
created: 2026-08-22
updated: 2026-08-22
---

## Notes

Opened from a walkthrough of the running app against `assets/matmaverse-*`
(local-only mockups, both `-web` and `-mobile` sets). The finding was
structural, not cosmetic: every signed-in surface rendered as one centred
`max-w-md` column at all widths, while the web mockups are a full application —
persistent sidebar, HUD, main grid, right rail — and the mobile mockups are the
same content under a bottom tab bar. The gap was therefore "no shell", not
"wrong paddings".

### What shipped

- `src/components/app/AppShell.astro` — the shared chrome: sidebar on `lg+`,
  fixed bottom tab bar below it, one responsive `h1`, wallet/level HUD. Both
  navs are rendered once and toggled with `display:none`, so exactly one copy of
  each accessible name is in the a11y tree at any viewport (keeps the e2e
  locators unambiguous, and the `touch` project runs at 712 px).
- Dashboard, mission, upgrade shop and the parent report re-laid onto the shell
  (hero, skill cards, result tiles, mission/next-upgrade rails).
- Auth split view, e-mail verification, profile wizard, PIN gate, profile picker
  and the shift-result panel brought up to the mockups' scale; the signed-out
  landing rebuilt from
  `t.marketing.*` instead of the starter's developer pitch (unused
  `Topbar.astro` deleted with it).

### Deliberate omissions (honest data)

The mockups show metrics the product does not record: daily-activity charts,
correctness %, sales counts, customer satisfaction, earnings-per-week, XP.
Those tiles are **not rendered** rather than estimated. Every number on screen
comes from `child_profiles` / the week's `shift_log` aggregate.

### Not built (designed, but no feature behind them)

`01-world-selection`, `04-pricing-inventory`, `05-skill-path`,
`01-world-progression`, `04-product-unlocked` (as a standalone screen),
achievements/"Nagrody" and settings. These are product work, not UI polish —
the sidebar deliberately links only to routes that exist, so there is no dead
nav.

### Follow-ups

- "Zapamiętaj mnie" on sign-in (mockup `01`) needs a session-lifetime decision
  before it can be more than a decorative checkbox.
- `/app/task` logs a React hydration mismatch: the shift is generated with
  `Math.random()` on the server and again on the client. Pre-existing, not
  introduced here; fix by generating the shift client-side (or seeding it).

## Verification

`npm run lint`, `npm test` (299), `npx playwright test` (15, desktop + touch)
all green; screens walked at 390 / 768 / 1440 with no horizontal overflow.
