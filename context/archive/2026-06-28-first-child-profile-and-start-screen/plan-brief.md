# First Child Profile Wizard + Child Start Screen (S-01b) — Plan Brief

> Full plan: `context/changes/first-child-profile-and-start-screen/plan.md`
> Research: `context/changes/first-child-profile-and-start-screen/research.md`

## What & Why

Roadmap slice **S-01b** completes the parent-onboarding funnel: after an authenticated parent has no child profile, `/app` routes them into a create-first-child-profile wizard (name + age + avatar + interest); the profile is written under the F-01 per-account RLS contract; the child lands on a start screen with a single themed business and an in-world "open the shop" tap. This is the first child-facing surface and the first write to `child_profiles` — built on the just-shipped MatmaVerse design system so Part B surfaces aren't restyled later.

## Starting Point

`child_profiles` already exists (Foundation F-01) with full RLS and an isolation test, but only `avatar`/`theme` columns. `/app` is a placeholder with a documented "Part B extension point". The mutation pattern (form-POST → API route → redirect) and the request-scoped Supabase client are established by the auth routes; `src/lib/services/` and zod don't exist yet. The design system (tokens, themed primitives, AuthShell, world illustrations) is live; child-sized controls were deferred to here.

## Desired End State

A fresh parent signs up, verifies, and is guided through a Polish multi-step wizard; on submit a `child_profiles` row is created (RLS-isolated) and the child reaches a start screen greeting them by name with a large "Czas otworzyć sklep!" button (a friendly no-op until the shift loop in S-02+). On reload, the single profile skips the wizard and lands straight on the start screen.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Child data collected | Name + age + avatar + interest | Matches canonical `05` mockup + recorded product-owner override; **consciously breaks** the PRD "no child PII" guardrail | Research (D1) |
| Interest persistence | Store pick in existing `theme` column | Themes the start-screen business now without a new column; real world-selection is S-07 | Research (D2) |
| Start-screen tap | In-world "coming soon" no-op | Affordance + copy are real; the shift loop is S-02–S-04 | Research (D3) |
| Child controls | New `src/components/child/` oversized-primitive tier | S-02+ child surfaces reuse it; shadcn `lg` (~44px) is too small per `prd-v2.md:146` | Research (D4) |
| Wizard structure | Multi-step "Krok x z 3" | Mirrors the mockup's stepped progress | Plan |
| Age range + level | Ages 6–9, age→band `starting_level` | Matches the mockup chip; bands stored for S-04 to consume | Plan |
| 2+ profiles branch | Route to most-recent profile's start | No dead-end; real picker is S-07 (S-01b can't create a 2nd) | Plan |
| Validation / PII | zod (first use) + escape name | Satisfies CLAUDE.md's zod mandate; centralizes PII validation | Plan |
| Avatars | Slice ~6 from mockup `05` into `public/avatars/` | Faithful to mockup; ids are stable DB slugs (`lis`/`wilk`/`kot` already in tests) | Plan |

## Scope

**In scope:** identity-column migration (name/age/starting_level) under L-001; avatar registry + sliced art; child-primitive tier; create-profile service + `POST /api/profiles/create` (zod, RLS); multi-step wizard; `/app` profile-count router; themed child start screen with coming-soon tap; updated isolation test + new route tests.

**Out of scope:** multi-profile picker / 2nd-profile creation (S-07); shifts/tasks/scoring/results/persistence (S-02–S-04); coins/level UI + gameplay-state columns (S-04); world-selection + dashboard panels; auth/verification changes (S-01a); dark mode; brand rename.

## Architecture / Approach

Bottom-up vertical: **data** (migration + columns + updated isolation coverage + zod) → **building blocks** (avatar registry + art, `src/components/child/*`, i18n) → **write path** (service + API route + route tests) → **wizard UI** (posts to the route) → **router + start screen** (end-to-end wiring). Wizard and start live under `/app/*` to inherit existing middleware gating; the request-scoped client makes RLS scope every read/write automatically; `account_id` is always derived server-side from the session.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data layer | name/age/starting_level migration + updated isolation test + zod | NOT NULL ALTER breaks existing test inserts (must update in lockstep) |
| 2. Registry + primitives + i18n | avatar registry + sliced art, child controls, Polish strings | avatar ids must stay stable DB slugs; oversized tap-target correctness |
| 3. Service + API + tests | `POST /api/profiles/create` + route isolation tests | trusting a client `account_id`; PII handling/logging |
| 4. Wizard UI | multi-step create-profile wizard | mockup fidelity + child-accessible tap targets |
| 5. Router + start screen | `/app` count branch + themed start screen | end-to-end funnel correctness; no bare-math framing |

**Prerequisites:** F-01 RLS contract (done); MatmaVerse design system (done); local Supabase running for tests.
**Estimated effort:** ~4–5 sessions across 5 phases.

## Open Risks & Assumptions

- **PII guardrail consciously broken** (D1): collecting child name/age contradicts `prd-v2.md:51,168`. Mitigated by RLS isolation + zod + escape + no-logging; flagged in the plan and contract-surfaces.
- Avatar art is sliced from local-only mockups; committed `public/avatars/` ships to CI/Vercel, but a cloud agent without `assets/` can't re-slice.
- `starting_level` bands are stored before the S-04 gameplay that consumes them — assumed-stable mapping (6–7 → 1, 8–9 → 2).

## Success Criteria (Summary)

- A new parent goes signup → verification → wizard → themed start screen greeting the child by name, end to end.
- A created profile is RLS-isolated (one account's profile never visible to another), proven by the updated isolation test + new route tests.
- `npm run lint`, `npm run build`, and `npm test` all green throughout; single-profile accounts skip the wizard on reload.
