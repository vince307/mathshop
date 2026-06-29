# Counting Task in Business Context (S-02) — Plan Brief

> Full plan: `context/changes/counting-task-in-business-context/plan.md`
> Research: `context/changes/counting-task-in-business-context/research.md`

## What & Why

Build MathShop's first real gameplay surface: a single **counting task** in shop narrative — the child counts the coins in the till before opening ("Policz monety w kasie") by tapping each coin, then submits. This is roadmap slice **S-02**; beyond shipping one task, its job is to establish the reusable `task spec → render → answer → feedback` contract that S-03 (change-making) and S-04 (full shift) inherit. It proves the product's core rule — math is a purposeful shop moment, never a bare equation.

## Starting Point

The start screen exists (`/app/start`) with a deliberate stub: `StartShiftButton.tsx`'s tap is a no-op "coming soon" card, explicitly "until the shift loop lands (S-02+)." There is no task model, tappable-coin widget, retry/hint logic, or gameplay state column anywhere — this slice builds the loop from scratch, plugging into that one seam. Child primitives (`ChildButton`, `SelectTile`), the gold `--accent` coin token, `coin.png`, the `pl.ts` i18n dictionary, and `/app` middleware gating are all already in place.

## Desired End State

A logged-in child taps the business, lands on a new `/app/task` page showing a till of coins themed to their shop, counts them by tapping (tap again to un-count a mistake), and presses "Sprawdź". Correct → subtle success acknowledgment → back to the start screen. Wrong → gentle in-world retry with taps preserved; after the 2nd miss, the coin pile is briefly highlighted as a hint. Nothing is persisted; the count adapts to the child's level.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Answer input model | Tap-to-count (no multiple-choice) | The tapping *is* the one-to-one-correspondence lesson; honors PRD "tappable objects, not numerical inputs". | Research |
| Scenario breadth | One scenario (`count_till`), reusable contract | Smallest vertical slice; generator + full taxonomy deferred to S-04. | Research |
| Mounting | Dedicated `/app/task.astro` page | Inherits `/app` gating, clean SSR-loads / island-interacts split, natural home for the S-04 shift loop. | Research |
| Persistence | None (stateless) | Coins/level/results are S-04 by design; no migration/RLS/API. | Research |
| `CountingTask` type location | New `src/types.ts` | Per CLAUDE.md convention (file currently missing); type is shared across S-02/S-03/S-04. | Research |
| Success feedback | Subtle `role="status"` + animation, no payout | Big celebration + coin payout are shift-end (S-04, FR-008/FR-010). | Research |
| Mis-tap correction | Toggle on/off (tap again un-counts) | Forgiving for 6-year-olds; reinforces one-to-one both ways. | Plan |
| Count source | Procedural from `profile.starting_level` within grade band | Honors FR-007 adaptivity and exercises the generator S-04 reuses. | Plan |
| Post-success flow | Acknowledge → back to `/app/start` | Clean complete slice; no faked payout, no throwaway "play again" loop. | Plan |
| Testing depth | Vitest unit tests on pure logic; island manual-verified | High-risk generation/correctness covered cheaply; no new test-harness deps. | Plan |

## Scope

**In scope:** `CountingTask` type; `count_till` generator (level → count within band) + correctness/retry logic; Polish `pl.ts` task namespace; `/app/task` SSR page; `CountingTask` tap-to-count React island (toggle taps, tally, "Sprawdź", soft retry, coin-pile hint, success → back to start); rewire the start-screen tap; vitest unit tests.

**Out of scope:** Persistence (migration/RLS/API/coins/score); coin payout & shift-end celebration; other scenarios (shelf/delivery/order) & the procedural shift mixer; change-making (S-03); multiple-choice path; DOM/interaction test harness; audio; shift loop / results screen / "play again".

## Architecture / Approach

Phase 1 is pure TypeScript: a `CountingTask` type (`src/types.ts`), a generator + correctness helpers (`src/data/counting-tasks.ts`) with an injectable randomness boundary for deterministic tests, and Polish content (`pl.ts`) — all vitest-covered, no React. Phase 2 is the surface: a thin `/app/task.astro` loader (mirroring `start.astro`) loads the profile, generates the task, resolves the themed world, and mounts a `CountingTask` island that runs the whole tap/tally/submit/retry/hint/success interaction client-side (no per-tap network) and navigates back to `/app/start` on success; the start-screen tap is rewired from no-op to `/app/task`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Counting-task domain | Type + generator + correctness + i18n, unit-tested | Generator band/tier logic must be correct and deterministic-testable |
| 2. Task UI + entry wiring | `/app/task` page + tap-to-count island + start-screen rewire | Tap-target spacing & smooth animation for 6-year-olds; gentle-feedback guardrail |

**Prerequisites:** S-01 done (start screen, `/app` router, `child_profiles` with `starting_level`) — all in place. No new dependencies.
**Estimated effort:** ~2 sessions across 2 phases.

## Open Risks & Assumptions

- Polish copy (prompt/question/success/retry/hint) is draft — needs native-speaker review before shipping.
- "Subtle animation" calibration vs fanfare-fatigue is non-blocking; ship a reasonable default and tune via kid-testing.
- The tap-to-count interaction is verified manually (no DOM test); regressions in the island won't be caught by CI.
- Minor: CLAUDE.md wrongly says `assets/matma-verse/` mockups are absent (they're present locally) — worth correcting, can be handled separately.

## Success Criteria (Summary)

- A child taps the business, counts coins by tapping on `/app/task`, and a correct "Sprawdź" returns them to the start screen with a subtle acknowledgment.
- Wrong counts are gentle (retry + coin-pile hint, never punishing); mis-taps are self-correctable by toggling.
- `npm run check`, `npm run lint`, `npm run build`, and `npm test` all pass; nothing is persisted.
