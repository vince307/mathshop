# Multi-Profile Picker (S-11) — Plan Brief

> Full plan: `context/changes/multi-profile-picker/plan.md`

## What & Why

FR-002's second half is unshipped: accounts with 2+ child profiles are supposed to get a profile-picker on launch, but today every child page silently plays as the newest profile, and there's no way to add a second child except typing the URL. S-11 ships the picker, an active-profile selection mechanism, and the add-a-child entry — the last "ready" parallel slice on the roadmap.

## Starting Point

The seams were deliberately prepared across four earlier slices: `app.astro` already routes on profile count (2+ currently falls back to most-recent, with a comment naming this slice), `listChildProfiles` exists and is isolation-tested, `SelectTile` is a near-drop-in picker card, and the create route happily inserts an Nth profile — there's just no UI entry, no selection state, and no cap.

## Desired End State

A parent with two kids signs in → picker with one oversized avatar+name tile per child → tapping sets an HttpOnly session cookie → start/task/shop follow that child. New browser session → picker again. Single-profile accounts never see it. "+ Dodaj profil" on the picker (and a parent-panel link) leads to the existing wizard, capped at 6 profiles.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Selection mechanism | HttpOnly session cookie, re-validated against RLS per request | A pointer, not a credential — forged/stale ids resolve to zero rows; matches house cookie patterns |
| Launch semantics | Picker on every fresh session (session cookie) | Literal FR-002 "on launch"; siblings sharing a tablet each pick at sit-down |
| Mid-session switching | "Change player" entry on start screen (2+ only) | Tablet handoff without killing the session |
| Add-child entry | Picker tile + PIN-gated parent-panel link | One-tap where profiles live; parents also find it in their panel |
| Profile cap | Soft cap 6, route-level only | Bounds child-reachable junk creation without a migration; tunable |
| PIN gate on adding | None — wizard stays un-gated as shipped | Consistent with S-01; the cap bounds abuse |
| Testing depth | Unit + route-level integration (no E2E) | Matches project depth; forged-cookie case re-exercises the isolation contract at the new seam |

## Scope

**In scope:** `/app/pick-profile` page + `/api/profiles/select` action; `resolveActiveProfile` service + cookie; `resolveLandingPath` ≥2 branch; start/task/upgrades threading; picker add-tile + parent-panel link + start-screen switch; cap in create route; Polish copy; router/selection/cap tests.

**Out of scope:** picker mockup fidelity (none exists — S-13 polishes), PIN-gating the wizard, profile deletion/editing, persistent last-child memory, avatar uniqueness, report-page changes, any migration.

## Architecture / Approach

The cookie stores only a profile id; every consumer re-resolves it through the caller's RLS-scoped client, so isolation never depends on the cookie's honesty. Fallback ladder on child pages: valid cookie → that profile; exactly-1 profile → it (today's behavior, so single-profile accounts are provably unchanged); else back through the `/app` router (2+ → picker, 0 → wizard). Phase 1 lands the whole selection loop at once (picker ↔ cookie ↔ pages — splitting it would ship a picker nothing reads); Phase 2 adds entries + cap.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Scoped picker + selection | Picker on launch, cookie threading through start/task/shop | Fallback-ladder loops (stale cookie must terminate at the router, not cycle) |
| 2. Add-a-child, switching & cap | Add tile + panel link + switch entry + cap of 6 | Wizard's first-profile assumptions when reached with existing profiles |

**Prerequisites:** local Supabase stack for integration tests; nothing else — parallel-safe with the S-12 lane (touches profile surfaces, not Layout/supabase client; `pl.ts` appends only).
**Estimated effort:** ~1–2 sessions across 2 phases.

## Open Risks & Assumptions

- The picker has no canonical mockup — built from shipped primitives; S-13 may restyle it.
- Existing multi-profile accounts (created via direct URL) will start seeing the picker — intended FR-002 behavior, but a visible change.
- Cap value 6 is a first guess; tunable constant.

## Success Criteria (Summary)

- A 2-child account picks on launch and every child surface follows the pick; a 1-child account's flow is byte-for-byte unchanged.
- A forged or stale cookie can never surface another account's child — proven by an integration test at the selection seam.
- A parent adds a second child in one tap from the picker; the route refuses a 7th profile.
