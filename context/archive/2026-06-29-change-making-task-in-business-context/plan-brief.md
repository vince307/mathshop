# Change-Making Task in Business Context (S-03) — Plan Brief

> Full plan: `context/changes/change-making-task-in-business-context/plan.md`
> Builds on S-02 (archived): `context/archive/2026-06-29-counting-task-in-business-context/`

## What & Why

Add a **change-making task** as MathShop's second task type. The child reads a shop story ("Klient zapłacił 5 zł za sok kosztujący 3 zł — ile reszty wydasz?") and **gives change by tapping 1-zł coins onto the counter** until the coins given equal `paid − price`. This is roadmap slice **S-03**, the parallel sibling of S-02; its real job is to prove the S-02 task contract generalizes — change-making joins the discriminated `Task` union and reuses the coin-tap-and-feedback mechanic, the shape S-04's mixed shift will build on.

## Starting Point

S-02 shipped a single-type counting task: `CountingTask` is already a discriminated union member (`type: "counting"`), `/app/task` always generates counting, and `CountingTask.tsx` owns the tap-coins → tally → "Sprawdź" → retry/hint/success mechanic. The coin interaction is identical across task types — only the *target*, the *header*, and the *hint* differ — which is what lets one shared core serve both.

## Desired End State

`/app/task` now serves **either** a counting or a change-making task (randomly). For change-making, the child sees the customer story (paid + price) and a coin tray, taps coins to give the change, and a correct "Sprawdź" returns them to `/app/start` with a subtle acknowledgment. Wrong change → gentle retry with taps preserved; after 2 misses, a count-up hint highlights the price→paid gap. The counting task still plays exactly as before. Nothing is persisted.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Give-change interaction | Tap-to-assemble, 1-zł coins | Reuses S-02's coin mechanic; "giving change" is the in-world resolution; no bare-number answer. | Plan |
| Denominations | 1-zł only | Multi-denomination composition overshoots grades 1–2; defer. | Plan |
| Surfacing | `/app/task` picks type randomly | Both types reachable via the real user path; a concrete step toward S-04's mixed shift. | Plan |
| Number range | Procedural from level, change kept small (≤5 t1 / ≤10 t2) | Honors FR-007 adaptivity while keeping the coin count tappable. | Plan |
| Scaffolding hint | Show the count-up gap (price→paid) | Teaches the change-making strategy, not just the answer (FR-009). | Plan |
| Contract shape | `Task` discriminated union + shared `useCoinTask`/`CoinBoard`/`TaskScreen` | Validates the S-02 contract generalizes; no duplicate task system. | Plan |
| Persistence | None (stateless) | Coins/level/results are S-04 by design. | Plan |
| Testing depth | Unit-test pure logic; islands manual-verified | Mirrors S-02; no new test-harness deps. | Plan |

## Scope

**In scope:** `ChangeMakingTask` + `Task` union; change-making generator (change = paid−price, kept small, `availableCount ≥ change`) + correctness; random `generateTask` dispatcher; Polish `give_change` copy; extract shared `useCoinTask` hook + `CoinBoard` + `TaskScreen` from S-02's island; refactor `CountingTask` to an adapter; add `ChangeMakingTask` adapter; polymorphic `/app/task`; vitest unit tests.

**Out of scope:** Persistence; multiple-choice; multi-denomination coins; per-task payout; shift loop / results / "play again"; extra scenarios; start-screen entry change; DOM tests; any counting *behavior* change.

## Architecture / Approach

Phase 1 (pure TS): `Task = CountingTask | ChangeMakingTask` in `src/types.ts`; `generateChangeMakingTask` + `isChangeCorrect` in `src/data/change-making-tasks.ts`; a random `generateTask(level)` dispatcher in `src/data/tasks.ts`; `give_change` copy in `pl.ts`; vitest. Phase 2 (UI): extract the shared mechanic into `useCoinTask` (hook) + `CoinBoard` (presentation) + `TaskScreen` (chrome), refactor `CountingTask` onto it (no behavior change), add a `ChangeMakingTask` adapter (story header + count-up hint), and have `/app/task` mount the island matching `task.type`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Domain & contract generalization | `Task` union + change-making generator + dispatcher + i18n, unit-tested | Generator math invariants (change=paid−price, band caps) must be right & deterministic |
| 2. UI: shared core + island + polymorphic page | `useCoinTask`/`CoinBoard`/`TaskScreen`, refactored counting, change-making island, type-routed page | Refactoring S-02's verified island without regressing its play |

**Prerequisites:** S-01 + S-02 done (the contract, page, and primitives exist). No new dependencies.
**Estimated effort:** ~2 sessions across 2 phases.

## Open Risks & Assumptions

- Phase 2 refactors S-02's verified counting island into a shared core — counting must keep playing identically (the regression surface).
- Polish `give_change` copy is draft — needs native-speaker review before shipping.
- Change-making interaction is manually verified (no DOM test) — island regressions won't be caught by CI.
- "Give change with 1-zł coins" tests producing the right *count*; the subtraction itself is mental — the count-up hint is the scaffold for the strategy.

## Success Criteria (Summary)

- `/app/task` serves both task types; a child can give correct change by tapping coins and return to the start screen.
- Counting still plays exactly as in S-02 (no regression).
- Wrong change is gentle (retry + count-up hint, never punishing); `check`/`lint`/`test`/`build` all pass; nothing persisted.
