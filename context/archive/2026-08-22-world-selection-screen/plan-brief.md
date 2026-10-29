# World-selection screen (`/app/worlds`) — Plan Brief

> Full plan: `context/changes/world-selection-screen/plan.md`
> Research: `context/changes/world-selection-screen/research.md`
> Standing brief: `context/runs/2026-08-22-autonomous-five/agent-contract.md`

## What & Why

A child picks their learning world once, in the create-profile wizard, and can never change
it — while `src/i18n/pl.ts:169` already tells the parent *"Świat możesz zmienić później."*
This change ships the screen that makes the promise true: `/app/worlds`, built to the
`matmaverse-ui-v2` mockups, where a child changes their world and reads that **every world
teaches the same competencies** — a change of costume, not of curriculum.

## Starting Point

`child_profiles.theme` is write-once. It is read in exactly three render-time places, all
through `worldForTheme()`, and **nothing is denormalized from it** — so flipping it today is
functionally lossless: every screen renders, every image resolves, wallet/level/skills/
purchases stay correct. `ShopArt.tsx:26`'s `WORLD_SLOTS` is an empty object literal: the
per-world seam exists, unused, and overrides coordinates only. `/app/worlds` is already gated
by `PROTECTED_ROUTES = ["/app"]` + `startsWith`.

## Desired End State

A child reaches **Światy** from the sidebar or bottom bar, sees the four worlds as cards with
their current one pre-selected, taps another, presses **Start**, and lands on `/app/start`
showing the new world — wallet, level, skills and every purchased upgrade intact. The choice
survives a reload and a new device, and one parent can never change another parent's child's
world.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Purchased upgrades on switch | **Keep global** (A) + coordinates re-skin (D) + record world per purchase (E) | The flip is lossless and no upgrade is café-specific (`Upgrade` has no world field; `canBuy`/`nextUpgrade` never read `theme`) | Research → Plan |
| Reset on switch (option C) | **Rejected outright** | `prd-v3.md:92` is a functional requirement that the grown shop and purchase "persist **for that profile**" — a reset violates it directly (`:180` is Open Question #5, an unproven mitigation, and cannot carry the rejection) | Research → Plan |
| Per-world purchases (option B) | **Deferred to its own change** | Right end-state, wrong slice: 12 read sites, the write, and two rewritten test suites — the multi-world tranche's data work | Research → Plan |
| What the child sees after a switch | **Honest copy, no new mechanic** | Mid-ladder children keep their exact ladder; only completionists arrive finished, and `t.upgradeShop.allOwned` already covers that | Plan |
| 6 worlds vs 4 | **Ship 4**; gap is content work | No-invented-data forbids placeholder worlds; worlds 5–6 have no slug and no art | Plan |
| Grid at 4 worlds | `grid-cols-2` every breakpoint | 2×2 is deliberate; 3+1 reads as a bug. `lg:grid-cols-3` restores the mockup when 5–6 land | Plan |
| Rename `Sklep księgarnia` | **No** | The art is a bookshop; `worlds.ts:9-10` records the reconciliation as deliberate | Plan |
| Endpoint shape | `POST /api/profiles/world`, mirroring `select.ts` | Form POST + redirect is the repo idiom when a page navigation follows; `.refine` over `WORLD_SLUGS`, not `z.enum` | Research → Plan |
| Middleware | **No edit** | `/app/worlds` is already gated by `startsWith("/app")` | Research |
| Migration | **None** | `theme` exists, `child_profiles_update_own` already permits the write, `shop_state` is jsonb with column-agnostic RLS | Research |
| `ShopArt` ownership | **F4 owns it**; F5 touches only the `WORLD_SLOTS` data literal, in a droppable phase | F4 is re-composing the scene for named stages; the mis-tuning F5 would fix is pre-existing | Plan |

## Scope

**In scope:** `POST /api/profiles/world` + its service function; `/app/worlds` page; the
`WorldPicker` island (reusing `SelectTile` unchanged); the fifth `AppShell` nav entry;
a write-only `shop_state.purchasedMeta` field; per-world overlay coordinates (droppable).

**Out of scope:** per-world purchases, per-world upgrade catalogues, per-world art or copy,
worlds 5–6, renaming world 4, any migration, any middleware edit, any `ShopArt`
restructuring, the landing page's duplicated `marketing.worlds` list, a parent-PIN gate.

## Architecture / Approach

`worlds.astro` resolves the active profile exactly as `upgrades.astro` does, wraps
`AppShell`, and mounts `WorldPicker client:load`. The island holds one piece of state — the
selected slug — and submits a **native same-origin form POST** (hidden `profileId` + `theme`)
to `/api/profiles/world`. The route validates with zod over formData, proves ownership by
re-resolving the id through the caller's RLS-scoped client (`select.ts:41-44`), calls
`updateChildProfileTheme` (single-statement `.eq("id",…).select("id")`, `deleteChildProfile`'s
idiom), and redirects to `/app/start`. Failures redirect with **no error param** — no
existence oracle.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Service + endpoint | The theme write path, no UI | Per-account isolation — the project's highest-risk requirement |
| 2. The screen | i18n block, `WorldPicker`, `worlds.astro` | Mockup parity at both breakpoints with 4 tiles in a 6-tile design |
| 3. Navigation | Fifth `AppShell` entry + label | 5-tab bottom bar at 712px; nav-label substring collisions |
| 4. Record purchase world | `shop_state.purchasedMeta` | Must not perturb the 11 existing flat-shape assertions |
| 5. Overlay coordinates | `WORLD_SLOTS` filled — **droppable** | Collides with F4, which owns `ShopArt` |

**Prerequisites:** local Supabase stack up (`npx supabase start`) for the route-level suites;
the gitignored `assets/matmaverse-ui-v2-{web,mobile}/01-world-selection-*.png` mockups open
before laying out Phase 2. Baseline to preserve: lint clean, 299 unit, 15 Playwright.
**Estimated effort:** ~2 sessions across 5 small phases; Phase 5 optional.

## Open Risks & Assumptions

- **The completionist child arrives at a finished shop.** Accepted and stated in copy, not
  hidden. F4's stage ladder (`business_level` is uncapped) is the cheap answer if it needs
  one; option B is the expensive one.
- **F4 collision on `ShopArt.tsx`.** Managed by making Phase 5 droppable and by touching
  data only. The implementer rebases on F4 rather than resolving blindly.
- **Five bottom tabs at 360px** will truncate "Panel rodzica". Accepted; verified manually,
  and the new label is the one to shorten if it reads badly — never the entry to drop.
- Worlds 5–6 remain unshipped, so the screen renders four tiles in a design drawn for six.

## Success Criteria (Summary)

- A child changes world from a screen that looks like the mockup, and the new world is still
  there after a reload and on another device.
- Every upgrade the child bought is still owned and still drawn in the new world's scene.
- One parent can never change another parent's child's world — proven by a test that reads
  durable state through the service-role client.
