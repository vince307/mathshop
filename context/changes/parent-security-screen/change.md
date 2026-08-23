---
change_id: parent-security-screen
title: Zabezpieczenia screen behind the parent gate — change PIN and protective options
status: implementing
created: 2026-08-22
updated: 2026-08-23
archived_at: null
---

## Notes

build the full Zabezpieczenia screen behind the parent gate - change the parent PIN plus the protective options from the auth-v2 mockup - on top of the existing account_settings table and pin endpoints

## Autonomous decisions

Run: `context/runs/2026-08-22-autonomous-five` (feature F3). No human in the loop,
so the skill's interactive next-step prompt was decided rather than asked.

- **Chose `/10x-research parent-security-screen` as the next step** over the skill's
  default `/10x-plan`. The change touches the app's security spine — PIN verification,
  the 15-minute `parent_verified` marker, and the failed-attempt lockout throttle — all
  of which already exist in `src/lib/services/parent-pin.ts`, `src/pages/api/parent/pin/`,
  and two migrations. A planner working from the mockup alone would guess at how those
  behave; that guess is the exact class of mistake that turns into a silent auth hole.
- **Rejected `/10x-frame`**: the framing is not in doubt. The screen is specified by a
  binding mockup and the backing table/endpoints already exist, so there is no
  symptom-vs-cause conflation to challenge.
- **What would change the answer:** if research finds the protective toggles need no
  storage at all and the screen reduces to a form over the existing `set` endpoint,
  planning could have started directly.
