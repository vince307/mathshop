# Full Shift with Results (S-04 — north star) — Plan Brief

> Full plan: `context/changes/full-shift-with-results/plan.md`
> Research: `context/changes/full-shift-with-results/research.md`

## What & Why

S-04 is the **validation milestone**: the child completes a 5–10 task shift (mixing S-02 counting + S-03 change-making), sees a results celebration (total coins + stars 0–3), and the result **persists** so reopening restores progress exactly as left. This is MathShop's **first gameplay persistence**, so it ships under the F-01 per-account RLS contract — the project's highest-risk correctness invariant. Delivering it proves the core product hypothesis end-to-end.

## Starting Point

The task contract is built and stateless: `Task` union + `generateTask` + shared `useCoinTask`/`CoinBoard`/`TaskScreen` + two adapters, with `/app/task` running one task per load. `child_profiles` carries identity only — no coins/level/shift columns. The success-redirect is hardcoded in one place (`useCoinTask`'s effect), and the start screen has a "no coins/level UI — those are S-04" placeholder. The F-01 RLS contract, the route+zod+L-002 pattern, and the isolation-test pattern are all established.

## Desired End State

Tapping the business runs a shift of level-appropriate length, auto-advancing on each task's success beat. At shift end the same island celebrates coins + stars (with a "level up!" text if a threshold crossed — no shop art), persists the result to `child_profiles`, and returns to a start screen that now shows the running coin balance + level. Reopening restores it. Counting and change-making still play identically to S-02/S-03 within the shift.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Persistence shape | Extend `child_profiles` (4 columns) | Column-agnostic F-01 policies cover new columns → zero new policies, existing isolation test authoritative. | Research |
| `business_level` vs `starting_level` | Keep distinct columns | `starting_level` is frozen difficulty; `business_level` is mutable progression — merging corrupts difficulty. | Research |
| Shift-loop seam | `onComplete` param + per-task `key` | One optional param (default = today's redirect) leaves S-02/S-03 byte-unchanged. | Research |
| Results delivery | Client phase in `ShiftScreen` | Fewer pages, immediate celebration; start screen re-reads persisted state anyway. | Plan |
| Coin authority | Server recomputes from `{taskCount, cleanCount}` | Tamper-resistant; one pure formula shared by client display + server persistence. | Plan |
| Persist-failure UX | Await persist; gentle fallback to start on fail | Happy path persists reliably; failure is gentle, not punishing; robust handling is S-08. | Plan |
| `business_level` storage | Store the column | S-05 reads it directly; survives a formula change. | Plan |
| Scoring constants | 5/task + 3/clean coins; 100/70/40% stars; level every 3 shifts; 6/9 lengths | Legible defaults, named + tunable after kid-testing. | Research |
| Scope boundary | Coins + stars only | Visible shop growth is S-05; network-loss is S-08. | Research |

## Scope

**In scope:** Pure `shift.ts` (length/generation/coin/star/level math); migration (4 columns under F-01); `ChildProfile` + `recordShiftResult` service; server-authoritative `POST /api/shifts/complete` (JSON); hardened isolation test + new route test + `contract-surfaces` edit; `onComplete` generalization; `ShiftScreen` orchestrator + in-island results celebration; repoint `/app/task`; start-screen coin/level HUD.

**Out of scope:** Visible shop-art growth (S-05); network-loss / mid-shift resilience (S-08); a new RLS table or per-shift ledger; per-task coin payout; cross-device/multi-profile specifics (S-06/S-07); any S-02/S-03 task behavior change; second theme / audio / streaks.

## Architecture / Approach

Backend-first. Phase 1 is pure + persistence: `shift.ts` (math, unit-tested) and the persistence layer — a four-column additive migration (no new policies), `recordShiftResult`, and a JSON `/api/shifts/complete` route that recomputes coins server-side, with the isolation test hardened and a new route test (L-002 spoof). Phase 2 builds the playable shift: generalize `useCoinTask` with `onComplete` (forwarded through `TaskScreen`/adapters), add the `ShiftScreen` orchestrator (per-task `key`, auto-advance, accuracy accumulation) and the in-island results celebration (await persist, gentle fallback), and repoint `/app/task`. Phase 3 surfaces persisted coins + level on the start screen. The coin/star formula in `shift.ts` is shared by client display and server persistence, so numbers always agree.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Persistence + scoring foundation | `shift.ts` + migration + service + route + tests | The silent-data-leak RLS surface — must add zero policies and keep the isolation test authoritative |
| 2. Shift loop + results | `onComplete` generalization, `ShiftScreen`, results celebration, repoint `/app/task` | Generalizing the shared core without regressing S-02/S-03; accuracy plumbing |
| 3. Start-screen HUD | Coins + level on `/app/start` | Small — clean rendering for a fresh (0-shift) profile |

**Prerequisites:** S-02 + S-03 done (task contract); local Supabase stack for the integration tests. No new dependencies.
**Estimated effort:** ~3–4 sessions across 3 phases (largest slice so far).

## Open Risks & Assumptions

- The RLS surface is the highest-risk part — extending `child_profiles` (no new policies) keeps it minimal, but the route's write path must gate ownership via RLS (reach by `id`, never trust a client `account_id`); the L-002 spoof test is the guard.
- The route returns JSON (not the usual redirect) because results are an in-island phase — a deliberate, documented deviation from `profiles/create.ts`.
- Polish `results:` + HUD copy is draft pending native-speaker review.
- Scoring constants are first-guess defaults; tune after kid-testing (named constants make this one-line).
- Persist-failure handling is intentionally minimal (gentle fallback); robust network handling is S-08.

## Success Criteria (Summary)

- A child completes a full shift, sees coins + stars, and the progress persists across sessions (the PRD's primary success criterion).
- Counting + change-making play unchanged within the shift; a clean shift earns 3 stars; a sloppy one is still warm.
- `check`/`lint`/`build`/`test` pass (incl. the hardened isolation test + new route test); no new RLS policy; the L-002 spoof is red when the policy is weakened.
