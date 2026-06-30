# Full Shift with Results (S-04 — north star) Implementation Plan

## Overview

S-04 is the validation milestone: the child taps the business, completes a **5–10 task shift** mixing S-02 counting and S-03 change-making, sees a **results celebration** (total coins earned + stars 0–3), and the result **persists** — reopening the app restores coins and progress exactly as left. This is MathShop's **first gameplay persistence**, so it ships under the F-01 per-account RLS contract (the project's highest-risk correctness invariant). Scope: **coins + stars only** — business level is tracked internally; visible shop-art growth is S-05.

Roadmap slice **S-04** (`context/foundation/roadmap.md:119-132`), prereqs S-02 + S-03 (both done). Grounding: `context/changes/full-shift-with-results/research.md`.

## Current State Analysis

The task contract is built and stateless; persistence is greenfield:

- **Task contract (reuse):** `Task = CountingTask | ChangeMakingTask` (`src/types.ts`); `generateTask(startingLevel, pickType?)` (`src/data/tasks.ts:23`); shared `useCoinTask` (`src/components/hooks/useCoinTask.ts`) + `CoinBoard` + `TaskScreen` + the two adapters; `/app/task.astro` mounts one task by type.
- **The redirect seam:** `useCoinTask.ts:31-39` is the *only* place navigation is hardcoded — `window.setTimeout(() => window.location.href = "/app/start", 1400)` after `status === "correct"`. The hook already tracks `misses` (`:25,52`) — the raw material for accuracy.
- **Persistence: none.** `child_profiles` carries `id, account_id, avatar, theme, name, age, starting_level, created_at, updated_at` only (`20260628120000_child_profiles_add_identity.sql:22-25`; `ChildProfile` at `src/lib/services/child-profiles.ts:22-32`). The F-01 migration flags gameplay state as S-04's job (`20260609120000_child_profiles_isolation.sql:48-49`).
- **F-01 RLS contract:** four column-agnostic policies predicated on `auth.uid() = account_id` (`...isolation.sql:78-101`); shared `set_updated_at()` trigger already attached to `child_profiles`; isolation test at `tests/child-profiles-isolation.test.ts`; route+zod+L-002 pattern at `src/pages/api/profiles/create.ts` + `tests/profiles-create.test.ts`.
- **Start screen:** `src/pages/app/start.astro:16` comment "no coins/level UI (those are S-04)"; coins/level surface in the greeting block (`:43-57`). `getMostRecentProfile` does `select("*")` (`child-profiles.ts:62-64`) so new columns return automatically.

Lessons in force (S-04 persists): **L-001** (four-policy RLS same migration), **L-002** (verify durable state via service-role, never chained `.select()`), **L-003** (no inline i18n literals).

## Desired End State

A logged-in child taps the business → `/app/task` runs a shift of 5–10 tasks (length adapts to `starting_level`) mixing counting and change-making, auto-advancing on each task's success beat. When the shift ends, the same island shows a celebration: total coins earned (server-authoritative) and 0–3 stars by accuracy, with a "level up!" text if a threshold was crossed (no shop art). The result is persisted to `child_profiles` (coins added, completed-shift count incremented, business level updated). A "back to shop" CTA returns to `/app/start`, which now shows the running coin balance + level. Reopening on the same browser (or after re-login) restores the persisted state. Counting and change-making tasks still play identically to S-02/S-03 within the shift.

**Verification:** `npm run check` / `npm run lint` / `npm run build` / `npm test` pass (incl. the new `shift.test.ts`, the hardened isolation test, and the new route test — the last two need the local Supabase stack); manual play-through confirms a full shift → results → persistence → cross-session restore.

### Key Discoveries:

- Extending `child_profiles` needs **zero new RLS policies** (column-agnostic policies; proven by the S-01b identity migration `...add_identity.sql:6-9`). The existing isolation test stays authoritative.
- The shift loop is a near-free generalization: one `onComplete` param on `useCoinTask` (default = today's redirect) + a per-task React `key`.
- `business_level` (mutable progression) must stay **distinct** from `starting_level` (frozen age-derived difficulty band, `leveling.ts:7-9`).
- Network-loss / FR-016 is **S-08** (`network-loss-handling`, depends on S-04) — out of scope here.

## What We're NOT Doing

- **No visible shop-art growth** — business level is tracked + persisted but surfaced only as a small "level up!" text. New shelf/sign/decoration is **S-05**.
- **No network-loss / mid-shift resilience** — that's **S-08**. S-04 only provides the shift loop + the single shift-end write S-08 will later guard. Mid-shift state is never persisted; a failed shift-end persist falls back gently (see Phase 2) but robust handling is S-08.
- **No new RLS table** — gameplay state is columns on `child_profiles`, not a new table or a per-shift ledger (no analytics/history table in v1).
- **No per-task coin payout** — coins paid once at shift end (FR-010).
- **No multi-profile / cross-device specifics** — S-06/S-07 own those; S-04 persists per-profile state that they build on.
- **No change to S-02/S-03 task behavior** — the adapters render identically inside the shift (the `onComplete` generalization defaults to current behavior for standalone use).
- **No second visual theme / audio / streaks** — out of v1.

## Implementation Approach

Three phases, backend-first. **Phase 1** lays the foundation with no UI: a pure `src/data/shift.ts` (length, generation, and the coin/star/level math as named constants) with unit tests, plus the persistence layer — a migration adding four columns under the existing F-01 policies, an extended `ChildProfile`, a `recordShiftResult` service, and a `POST /api/shifts/complete` route that **recomputes coins server-side** from the reported accuracy (tamper-resistant), with the isolation test hardened and a new route test. **Phase 2** builds the playable shift: generalize `useCoinTask` with an optional `onComplete` (forwarded through `TaskScreen`/adapters, leaving S-02/S-03 unchanged), add the `ShiftScreen` orchestrator (per-task `key`, auto-advance, accuracy accumulation) and the in-island results celebration that awaits the persist call and falls back gently on failure, and repoint `/app/task` at it. **Phase 3** surfaces the persisted coins + level on the start screen, completing the visible cross-session loop.

The coin/star formula lives in `shift.ts` and is imported by **both** the client (instant celebration display) and the server route (authoritative persistence) — same pure function, so the numbers always agree.

## Critical Implementation Details

- **The route returns JSON, not a redirect.** Unlike `profiles/create.ts` (a form-POST → redirect), the shift-end call is a `fetch()` from the still-mounted `ShiftScreen` island (results are an in-island phase, not a new page). So `/api/shifts/complete` responds with a small JSON body + `no-store` headers; the island awaits it and branches to the results phase (success) or a gentle fallback (failure). This is a deliberate, documented deviation from the redirect pattern.
- **Server-authoritative coins.** The client POSTs `{ profileId, taskCount, cleanCount }` — never a coin amount. The route imports `coinsForShift` from `shift.ts` and computes the payout itself, so a tampered client can't inflate the balance. The route reaches the row by `id` and lets the `child_profiles_update_own` RLS `using` clause gate ownership — **never** filter by a client-supplied `account_id`, never put `account_id` in the zod schema (L-002).
- **`business_level` ≠ `starting_level`.** `starting_level` stays frozen (drives task difficulty via `tierForLevel`). `business_level` is the new mutable progression column the server bumps. Conflating them corrupts difficulty derivation.
- **Per-task `key` resets hook state.** In `ShiftScreen`, render the task adapter with `key={index}` so advancing unmounts the old `TaskScreen`/`useCoinTask` and mounts a fresh one — no internal reset logic; the hook stays untouched beyond the `onComplete` param.
- **No per-tap network round-trip** persists during a shift (FR-016) — the only server write is the single shift-end POST.

## Phase 1: Persistence + scoring foundation

### Overview

Pure shift/scoring math + the persistence layer (migration, service, route, tests) — all backend, fully automated-verifiable, no UI.

### Changes Required:

#### 1. Pure shift + scoring module

**File**: `src/data/shift.ts` (new — pure, client-safe, mirrors `src/data/counting-tasks.ts`)

**Intent**: One module for shift length, shift generation, and the coin/star/level math, as named tunable constants. Imported by the client (display) and the server route (persistence).

**Contract**: Export named constants + pure fns with injectable randomness:
- `shiftLength(startingLevel: number, pick?): number` — tier 1 → ~6 (band 5–7), tier 2 → ~9 (band 8–10), via `tierForLevel`.
- `generateShift(startingLevel: number, pick?, pickType?): Task[]` — loops `generateTask(startingLevel)` `shiftLength` times; shuffles the type sequence so it's not all-counting-then-all-change; consider forcing ≥1 of each type.
- `COIN_PER_TASK = 5`, `COIN_PER_CLEAN = 3`; `coinsForShift(taskCount, cleanCount): number` = `COIN_PER_TASK*taskCount + COIN_PER_CLEAN*cleanCount` (floor never zero).
- `STAR_THRESHOLDS` + `starsForShift(taskCount, cleanCount): 0|1|2|3` on clean-task rate (100→3, ≥70→2, ≥40→1, else 0).
- `SHIFTS_PER_LEVEL = 3`; `businessLevelForShifts(completedShiftCount): number` = `1 + floor(completedShiftCount / SHIFTS_PER_LEVEL)`.

#### 2. Unit tests for the math

**File**: `tests/shift.test.ts` (new — vitest, pure)

**Contract**: `shiftLength` band per tier (injected pick); `generateShift` produces the right count and a mixed set; `coinsForShift` formula + worked examples + non-zero floor; `starsForShift` at the 40/70/100% boundaries; `businessLevelForShifts` increments every 3.

#### 3. Gameplay-state migration

**File**: `supabase/migrations/20260630HHmmss_child_profiles_add_gameplay_state.sql` (new)

**Intent**: Add the first persisted gameplay state to `child_profiles` under the existing F-01 policies — no policy changes, reuse the shared trigger.

**Contract**: `alter table public.child_profiles add column coins integer not null default 0, completed_shift_count integer not null default 0, business_level smallint not null default 1, shop_state jsonb not null default '{}'::jsonb;` plus check constraints (`coins >= 0`, `completed_shift_count >= 0`, `business_level >= 1`). Column comments noting `business_level` ≠ `starting_level` and `shop_state` reserved for S-05. **No `create or replace function set_updated_at()`, no new trigger, no new policy** (header comment must state why, mirroring `...add_identity.sql:1-20`).

#### 4. Extend the profile service

**File**: `src/lib/services/child-profiles.ts` (extend)

**Intent**: Add the new fields to `ChildProfile` and a service that persists a shift result, computing coins server-side and gating ownership via RLS.

**Contract**: `ChildProfile` (`:22-32`) += `coins: number; completed_shift_count: number; business_level: number; shop_state: Record<string, unknown>`. New `recordShiftResult(client, profileId, { taskCount, cleanCount }): Promise<{ error: … } | { coinsEarned, businessLevel, leveledUp }>` — read current `coins, completed_shift_count` AS the parent (RLS-scoped) by `id`; compute `coinsEarned = coinsForShift(taskCount, cleanCount)`, `newCount = completed_shift_count + 1`, `newLevel = businessLevelForShifts(newCount)`; UPDATE `coins = coins + coinsEarned, completed_shift_count = newCount, business_level = newLevel` by `id` (no `account_id` filter — RLS gates it). Return `leveledUp = newLevel > business_level`.

#### 5. Shift-completion API route

**File**: `src/pages/api/shifts/complete.ts` (new — mirrors `profiles/create.ts` shape, JSON response)

**Intent**: The single shift-end write. Server-authoritative coins; session-derived ownership; JSON response (island `fetch`, not a redirect).

**Contract**: `export const prerender = false`. `supabase.auth.getUser()` → 401 JSON if no user. zod `safeParse` of `{ profileId: uuid, taskCount: int 1..12, cleanCount: int 0..taskCount }` (refine `cleanCount <= taskCount`); **no `account_id` field** (L-002). Call `recordShiftResult`; on error → 4xx/5xx JSON; on success → 200 JSON `{ ok: true, coinsEarned, businessLevel, leveledUp }`. Apply `no-store` headers to the response.

#### 6. Harden the isolation test

**File**: `tests/child-profiles-isolation.test.ts` (extend)

**Intent**: Prove the new write surface (coins) is RLS-isolated.

**Contract**: Add the four new fields to `ChildProfileRow` (`:26-36`). In the UPDATE-isolation test (`:90-109`), additionally assert B's attempt to bump A's `coins` affects 0 rows and A's `coins` is unchanged. (No new isolation test file — same row, same policies.)

#### 7. Route test

**File**: `tests/shifts-complete.test.ts` (new — mirrors `tests/profiles-create.test.ts`)

**Intent**: Prove the route persists correctly and never writes another account's row (the silent-data-leak guard for the write path).

**Contract**: Mint a session (drive the real signin route per `profiles-create.test.ts:17-28`); POST a completed shift; verify via the service-role `admin` client that `coins`/`completed_shift_count`/`business_level` match the formula. **L-002 spoof test:** account B POSTs with `profileId` owned by A; assert via `admin` that A's row is unchanged. Invalid-input test: bad `taskCount`/`cleanCount` writes nothing.

#### 8. Register the surface

**File**: `docs/reference/contract-surfaces.md` (edit)

**Contract**: Update the `## public.child_profiles` Columns line (`:15`) to append `coins`, `completed_shift_count`, `business_level`, `shop_state` (+ the `business_level` ≠ `starting_level` note + check constraints); add the new migration to **Defined in** (`:13`). No new H2.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`
- Pure shift/scoring unit tests pass: `npx vitest run tests/shift.test.ts`
- Migration applies cleanly: `npx supabase db reset` (local stack)
- Isolation + route tests pass against the local stack: `npm test` (incl. hardened `child-profiles-isolation` + new `shifts-complete`)

#### Manual Verification:

- L-002 meta-check: temporarily weaken the `child_profiles_update_own` policy (or the route's RLS gate) and confirm the spoof assertion in `shifts-complete.test.ts` goes red; restore.
- `contract-surfaces.md` reflects the four new columns; no new RLS policy was added (grep the migration).
- `business_level` and `starting_level` are separate columns.

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation before Phase 2.

---

## Phase 2: Shift loop + results

### Overview

Generalize the shared core to support a multi-task shift, build the `ShiftScreen` orchestrator + in-island results celebration, and repoint `/app/task` at it.

### Changes Required:

#### 1. Generalize the interaction hook

**File**: `src/components/hooks/useCoinTask.ts` (extend)

**Intent**: Let a task complete via callback instead of always redirecting, and surface first-try accuracy. Default preserves today's behavior.

**Contract**: Add `onComplete?: (outcome: { firstTry: boolean }) => void` defaulting to `() => { window.location.href = "/app/start"; }`. The success effect (`:31-39`) fires `window.setTimeout(() => onComplete({ firstTry: misses === 0 }), 1400)`. Standalone callers pass nothing → identical redirect, arg ignored. (Wrap `onComplete` in the dependency array; document that parents should memoize it.)

#### 2. Forward `onComplete` through the chrome + adapters

**File**: `src/components/child/TaskScreen.tsx`, `CountingTask.tsx`, `ChangeMakingTask.tsx` (extend)

**Intent**: Thread the optional `onComplete` from adapter → `TaskScreen` → `useCoinTask`. No behavior change when omitted.

**Contract**: Add optional `onComplete?: (outcome: { firstTry: boolean }) => void` to each component's props; `TaskScreen` passes it into `useCoinTask`. CountingTask/ChangeMakingTask forward it. Everything else unchanged — S-02/S-03 standalone rendering is byte-identical.

#### 3. Shift orchestrator island

**File**: `src/components/child/ShiftScreen.tsx` (new — the genuinely new piece)

**Intent**: Run a generated sequence of tasks, accumulate accuracy, then show results and persist once.

**Contract**: Props `{ startingLevel: number; world: World; profileId: string; currentCoins: number; currentCompletedShiftCount: number }`. State: `{ tasks: Task[]; index: number; results: { firstTry: boolean }[]; phase: "playing" | "saving" | "results" | "error" }`; `tasks` generated once via `generateShift(startingLevel)` (lazy init). Render the current task via the existing adapters dispatched by `task.type`, with `key={index}` and a memoized `onComplete` that pushes the outcome and advances `index` (or → `saving` when exhausted). On `saving`: compute `taskCount`/`cleanCount` (= `results.filter(r => r.firstTry).length`), `fetch` POST `/api/shifts/complete` `{ profileId, taskCount, cleanCount }`; on 200 → `results`; on failure → `error`. Auto-advance uses the existing 1400ms success beat (no extra tap). Compute display coins/stars via `coinsForShift`/`starsForShift` (same fns the server uses).

#### 4. Results celebration view

**File**: `src/components/child/ShiftResults.tsx` (new)

**Intent**: The big shift-end celebration (FR-008) — coins + stars, warm at every level, return to start.

**Contract**: Props `{ coinsEarned: number; stars: 0|1|2|3; leveledUp: boolean }`. Renders an in-world heading, a 3-star row (earned = gold `--accent`, subtle `tw-animate-css` pop), the coin payout (`coin-stack.png` + number), an optional "level up!" text when `leveledUp` (**no shop art**), and a gold `ChildButton` → `/app/start`. 0 stars is celebratory, never "game over" (no red/buzzer). The `error` phase shows a gentle in-world message + a return-to-start CTA.

#### 5. Results + error copy

**File**: `src/i18n/pl.ts` (extend)

**Intent**: New `results:` namespace (per L-003), draft Polish pending native review.

**Contract**: `t.results.{ heading, coinsLabel ("{coins}" with `Intl.PluralRules` for moneta/monety/monet via the `charsNeeded` pattern), starsLabel, star.{three,two,one,zero}, levelUp, backToStart, saveError }`.

#### 6. Repoint the task page at the shift

**File**: `src/pages/app/task.astro` (modify)

**Intent**: Mount `ShiftScreen` instead of a single task; pass the SSR-loaded profile state it needs.

**Contract**: Keep the SSR scaffold (client + `getMostRecentProfile` + `/app` fallback + `worldForTheme`). Replace `generateTask(...)` + the single-task `task.type` branch with `<ShiftScreen client:load startingLevel={profile.starting_level} world={world} profileId={profile.id} currentCoins={profile.coins} currentCompletedShiftCount={profile.completed_shift_count} />`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`
- Unit tests pass: `npm test` (no regressions in `shift`/`counting`/`change-making`/`tasks`)

#### Manual Verification:

- Tapping the business runs a shift of the expected length for the profile's level (≈6 for level 1, ≈9 for level 2), mixing counting + change-making, auto-advancing on each success.
- Counting and change-making tasks play identically to S-02/S-03 within the shift (toggle, tally, retry, hint, success).
- At shift end the results screen shows coins earned + the correct stars; a clean shift shows 3 stars; a sloppy shift shows fewer but is still warm (no red/buzzer/game-over).
- The result persists: after "back to shop" and reopening `/app/task` (or `/app/start`), the profile reflects the new coins/level (cross-session).
- On a simulated persist failure (e.g. offline), the child sees a gentle in-world message and returns to start (no crash) — robust handling is S-08.

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation before Phase 3.

---

## Phase 3: Start-screen coin/level HUD

### Overview

Surface the persisted coins + business level on the start screen, completing the visible cross-session loop.

### Changes Required:

#### 1. Coins/level HUD

**File**: `src/pages/app/start.astro` (modify)

**Intent**: Show the running coin balance + business level in the greeting/header area — resolving the "no coins/level UI (those are S-04)" comment (`:16`).

**Contract**: In the greeting block (`:43-57`), render `profile.coins` (gold `--accent`, `coin.png`) and `profile.business_level` (a small level chip/label). `profile` already carries the fields (loaded via `getMostRecentProfile`'s `select("*")`); no service change. Build toward the child-dashboard mockup placement if the maintainer shares it (`assets/matma-verse/` is local-only).

#### 2. HUD copy

**File**: `src/i18n/pl.ts` (extend)

**Contract**: Add start-screen HUD labels (e.g. `t.start.coinsLabel`, `t.start.levelLabel`) — Polish, draft pending native review.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`
- Unit tests pass: `npm test`

#### Manual Verification:

- The start screen shows the current coin balance + business level for the active profile.
- After completing a shift, returning to the start screen shows the updated coins (and level if it changed).
- A fresh profile (0 shifts) shows 0 coins / level 1 cleanly (no broken HUD).

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation that the full cross-session loop works before considering the slice done.

---

## Testing Strategy

### Unit Tests (vitest, pure):

- `tests/shift.test.ts` — `shiftLength` bands, `generateShift` count + mix, `coinsForShift` formula + floor, `starsForShift` thresholds, `businessLevelForShifts` increments.

### Integration Tests (vitest + local Supabase stack):

- `tests/child-profiles-isolation.test.ts` (hardened) — coins write is RLS-isolated cross-account.
- `tests/shifts-complete.test.ts` (new) — route persists correctly; L-002 spoof (B can't write A); invalid input writes nothing. Run the policy-weakening meta-check.

### Manual Testing Steps:

1. Sign in, tap the business → a shift of level-appropriate length runs, mixing both task types, auto-advancing.
2. Complete it cleanly → 3 stars + coins; complete one sloppily → fewer stars, still warm, coins still paid.
3. "Back to shop" → start screen shows updated coins + level.
4. Reopen `/app/task` / re-login → persisted coins/level intact (cross-session).
5. Simulate offline at shift end → gentle in-world message, return to start, no crash.

## Performance Considerations

All in-shift interaction is client-side; the only server write is one shift-end POST (FR-016). The results celebration awaits a single fast API call (EU region, NFR "immediate"); show a brief "saving" beat. Coin images `loading="lazy"`; animations within `tw-animate-css`.

## Migration Notes

One additive migration (`child_profiles` + four columns with safe defaults; no backfill — pre-launch, no production rows). Reuses the shared `set_updated_at()` trigger. No new RLS policy (existing four cover the columns). Run `npx supabase db reset` locally; CI runs the isolation + route tests as the merge gate.

## References

- Research: `context/changes/full-shift-with-results/research.md`
- Roadmap: `context/foundation/roadmap.md:119-132` (S-04)
- PRD: `prd-v2.md` §Success Criteria, §Business Logic, FR-006/008/010/011/012
- F-01 contract: `supabase/migrations/20260609120000_child_profiles_isolation.sql`, `docs/reference/{rls-isolation.md,contract-surfaces.md}`, `tests/child-profiles-isolation.test.ts`
- Route+test pattern: `src/pages/api/profiles/create.ts`, `tests/profiles-create.test.ts`
- Task contract reused: `src/components/hooks/useCoinTask.ts:31-39`, `src/components/child/TaskScreen.tsx`, `src/data/tasks.ts`, `src/pages/app/task.astro`
- Lessons: `context/foundation/lessons.md` (L-001, L-002, L-003 — all in force)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Persistence + scoring foundation

#### Automated

- [x] 1.1 Type checking passes: `npm run check` — 32657b5
- [x] 1.2 Linting passes: `npm run lint` — 32657b5
- [x] 1.3 Build passes: `npm run build` — 32657b5
- [x] 1.4 Pure shift/scoring unit tests pass: `npx vitest run tests/shift.test.ts` — 32657b5
- [x] 1.5 Migration applies cleanly: `npx supabase db reset` — 32657b5
- [x] 1.6 Isolation + route tests pass: `npm test` (hardened isolation + new `shifts-complete`) — 32657b5

#### Manual

- [x] 1.7 L-002 meta-check: weakening the update policy / RLS gate turns the spoof test red, then restored — 32657b5
- [x] 1.8 `contract-surfaces.md` updated; migration adds no new RLS policy (grep) — 32657b5
- [x] 1.9 `business_level` and `starting_level` are separate columns — 32657b5

### Phase 2: Shift loop + results

#### Automated

- [x] 2.1 Type checking passes: `npm run check` — 9169939
- [x] 2.2 Linting passes: `npm run lint` — 9169939
- [x] 2.3 Build passes: `npm run build` — 9169939
- [x] 2.4 Unit tests pass: `npm test` (no regressions) — 9169939

#### Manual

- [x] 2.5 Shift runs level-appropriate length (≈6 lvl1 / ≈9 lvl2), mixes both task types, auto-advances — 9169939
- [x] 2.6 Counting + change-making play identically to S-02/S-03 within the shift — 9169939
- [x] 2.7 Results show coins + correct stars; clean shift = 3 stars; sloppy = fewer but warm (no red/buzzer) — 9169939
- [x] 2.8 Result persists across "back to shop" + reopen / re-login (cross-session) — 9169939
- [x] 2.9 Simulated persist failure → gentle in-world message → return to start, no crash — 9169939

### Phase 3: Start-screen coin/level HUD

#### Automated

- [x] 3.1 Type checking passes: `npm run check`
- [x] 3.2 Linting passes: `npm run lint`
- [x] 3.3 Build passes: `npm run build`
- [x] 3.4 Unit tests pass: `npm test`

#### Manual

- [x] 3.5 Start screen shows current coins + business level for the active profile
- [x] 3.6 After a shift, the start-screen HUD reflects updated coins (and level if changed)
- [x] 3.7 A fresh profile (0 shifts) shows 0 coins / level 1 cleanly
