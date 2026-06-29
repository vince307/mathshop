# Counting Task in Business Context (S-02) Implementation Plan

## Overview

Build the first real gameplay surface in MathShop: a single **counting task** wrapped in shop narrative — "Policz monety w kasie, zanim otworzysz sklep." The child taps coins in the till (each tap toggles a counted state and increments a running tally), presses "Sprawdź", and on a correct count sees a subtle success acknowledgment before returning to the start screen. Wrong counts produce a gentle in-world retry; after 1–2 misses a scaffolding hint briefly highlights the coin pile.

This is roadmap slice **S-02** (`context/foundation/roadmap.md:94-105`), the next must-have slice in the wedge path (`F-01 → S-01 → (S-02 ∥ S-03) → S-04`). Beyond shipping one task, its architectural job is to establish the **reusable task contract** — `task spec → rendered shop moment → answer collection → feedback` — that S-03 (change-making) and S-04 (the full shift) inherit.

## Current State Analysis

The gameplay loop is **greenfield**; the start screen exists with a deliberate stub seam:

- `src/components/child/StartShiftButton.tsx:6-33` — a `client:load` island whose `onClick` (lines 20-22) is a no-op that toggles a `role="status"` "coming soon" card (`t.start.comingSoonTitle`/`t.start.comingSoon`). Its docstring literally says "a no-op until the shift loop lands (S-02+)." **This is the entry point S-02 rewires.**
- `src/pages/app/start.astro` — SSR loads `getMostRecentProfile(supabase)` (line 19), resolves `worldForTheme(profile.theme)` (line 21) + `getAvatar` (line 22), renders the business card (lines 60-63), mounts the island (line 67). This is the pattern the new task page mirrors.
- `src/pages/app.astro:1-17` — profile-count router; `/app/*` is gated by `src/middleware.ts:5` (`PROTECTED_ROUTES = ["/app"]`, `startsWith` match). A new `/app/task` page inherits gating with no middleware change.
- `supabase/migrations/20260609120000_child_profiles_isolation.sql:48-49` — explicit note: gameplay state (coins, level, shift count, shop state) is added by **S-04**. There is no `coins`/`level` column; `child_profiles` carries `id, account_id, avatar, theme, created_at, updated_at` + (from `20260628120000_…add_identity.sql:22-29`) `name, age, starting_level smallint not null default 1`.
- `src/components/child/ChildButton.tsx` (oversized 64px tap target, variants `primary|gold|outline`) and `SelectTile.tsx` (large tap-select tile, selection = `ring-4` + check badge via `aria-pressed`, never baked into art, non-adjacently hittable) are the child-primitive tier S-02 reuses.
- `src/i18n/pl.ts` — single `export const pl = {...} as const`; `start` namespace at `:162-169`. `src/i18n/index.ts:25-27` exposes `charsNeeded(n)` (an `Intl.PluralRules("pl")` helper) — the pattern to mirror for "N monet/moneta/monety".
- `src/styles/global.css :root` — design tokens; **`--accent` gold `#F3BE5D` is the coin color**. `tw-animate-css` is imported (`global.css:2`) so `animate-*` utilities are available; nothing animates yet beyond hover/focus.
- `public/illustrations/coin.png` is committed and available.
- Test runner is **vitest** (`npm test` → `vitest run`); `tests/` holds `app-router.test.ts`, `profiles-create.test.ts`, `child-profiles-isolation.test.ts`, `tests/helpers`, etc. **No Playwright, no `@testing-library/react`.**
- No `src/types.ts` exists yet (despite the CLAUDE.md convention); domain types live inline in `src/lib/services/` and `src/data/*.ts`.

Full grounding: `context/changes/counting-task-in-business-context/research.md` (incl. the six resolved decisions).

## Desired End State

A logged-in child on `/app/start` taps the business and lands on `/app/task`, where they see a till of coins themed to their business, count them by tapping (correcting mis-taps by tapping again), press "Sprawdź", and:

- on a correct count → a subtle success acknowledgment (`role="status"`), then automatic return to `/app/start`;
- on a wrong count → a gentle in-world "spróbuj jeszcze raz" with their taps preserved for adjustment; after the 2nd miss, the coin pile is briefly highlighted as a hint.

Nothing is persisted (no coins/score/migration). The count is procedurally generated from the child's `starting_level` within the grades 1–2 band. All copy is Polish, sourced from `pl.ts`. The counting-task generator + correctness logic are covered by vitest unit tests.

**Verification:** `npm run lint`, `npm run check`, `npm run build`, and `npm test` all pass; manual play-through on `/app/task` confirms the tap/tally/retry/hint/success flow and the return to start.

### Key Discoveries:

- Entry seam is a single no-op: `src/components/child/StartShiftButton.tsx:20-22`.
- `/app/*` is already gated — no middleware change (`src/middleware.ts:5`); mind the `startsWith` no-boundary gotcha (don't name a sibling like `/apple`).
- Coin visual = `--accent` token (`src/styles/global.css`) + `public/illustrations/coin.png`; selection/highlight idiom = `SelectTile`'s `ring-4` + `aria-pressed`.
- Profile carries `starting_level` (`supabase/migrations/20260628120000_child_profiles_add_identity.sql:24`) — the generator's level input already exists.
- L-003 (no inline literals, CI-enforced via lint + `astro check`) applies unconditionally; L-001/L-002 (RLS) do **not** — this slice persists nothing.

## What We're NOT Doing

- **No persistence** — no migration, no RLS surface, no API route, no coins/level/score/shift-count column or write. (S-04.)
- **No coin payout or big celebration per task** — payout + shift-end celebration are S-04 (FR-008/FR-010).
- **No procedural generator beyond the `count_till` scenario** — the type and generator are built reusable, but only `count_till` ships content. The other scenarios (shelf/delivery/order) and the full shift mixer are S-04.
- **No change-making task** — that's S-03 (parallel slice, same contract).
- **No multiple-choice answer path** — tap-to-count only (resolved decision 1).
- **No DOM/interaction test harness** — `@testing-library/react` is not added; the island is manually verified (resolved decision; testing depth = pure logic).
- **No audio** — v2 (PRD Non-Goals).
- **No shift loop / "play again" / results screen** — after one task the child returns to `/app/start`.

## Implementation Approach

Two phases, vertical-slice. **Phase 1** builds the pure, testable domain core: a `CountingTask` type in the project's first `src/types.ts`, a generator that turns `(scenario, level)` into a concrete task instance, the correctness + retry-threshold logic, and the Polish content — all unit-tested under vitest with zero React. **Phase 2** builds the surface: a thin `/app/task.astro` SSR loader (mirroring `start.astro`) that loads the profile, generates the task, and mounts a `CountingTask` React island that renders the tappable till, runs the tap/tally/submit/retry/hint/success interaction client-side, and navigates back to `/app/start` on success — then rewires the start-screen tap to point at `/app/task`.

The contract is designed so Phase 1's `CountingTask` shape and the island's `task spec → answer → feedback` flow generalize: S-03 adds a `change_making` task type to the same union; S-04 generates a sequence of mixed tasks and wraps the island in a shift loop.

## Critical Implementation Details

- **No per-tap network round-trip** (PRD NFR `prd-v2.md:148`, infra latency notes): all tap/tally/retry state is client-side React state in the island. The page round-trips only on the initial SSR load and the final `/app/start` navigation. Nothing is POSTed.
- **Tap-target spacing** (PRD NFR `prd-v2.md:146`): coins must be spaced so a tap landing between two never registers on either — reuse `SelectTile`'s non-adjacent spacing approach; recommend ≥48px targets with generous gaps, grouped into rows of 5 for counts >10 (subitizing aid).
- **`/app/task` route naming**: middleware matches `startsWith("/app")`, so the route is gated automatically — but do not introduce a sibling top-level path that collides with the prefix.
- **Generation must be deterministic-testable**: the count selection uses a seedable/injectable randomness boundary (e.g. accept an optional RNG/`pickCount` arg) so vitest can assert band-clamping and tier ranges without flake. The page calls it with the real RNG.

## Phase 1: Counting-task domain (types, generator, correctness, i18n, tests)

### Overview

Establish the reusable counting-task contract as pure TypeScript with no UI: the task type, the generator, the answer-correctness + retry logic, and the Polish content — covered by vitest.

### Changes Required:

#### 1. Shared task type

**File**: `src/types.ts` (new — the project's first shared-types module, per CLAUDE.md convention)

**Intent**: Define the `CountingTask` instance shape that the generator produces and the island consumes, designed as a discriminated union member (`type: "counting"`) so S-03/S-04 extend it. Keep it minimal for the `count_till` scenario but include the fields the contract needs.

**Contract**: Export `interface CountingTask` with at least: `type: "counting"`; `scenario: "count_till"` (string-literal union, room to grow); `objectType: "coin"`; `targetCount: number` (1–20, band-clamped — the true number of coins shown and the correct answer); `arrangement: "scatter" | "rows_of_5"`; `difficultyTier: 1 | 2`; and the i18n key fields `promptKey`, `questionKey`, `successKey`, `hintKey` (string keys resolved against `pl.ts`, not literal copy). Also export a `RETRY_HINT_THRESHOLD` constant (= 2) so the island and tests share one source. No coin-reward field (FR-010).

#### 2. Counting-task generator + correctness logic

**File**: `src/data/counting-tasks.ts` (new — art-paired/domain content module, consistent with `src/data/worlds.ts`/`avatars.ts`)

**Intent**: Turn a child's level into a concrete `count_till` task instance, and provide the correctness + tier-mapping helpers the island and tests use. The randomness boundary is injectable for deterministic testing.

**Contract**:
- `tierForLevel(startingLevel: number): 1 | 2` — maps `starting_level` to a difficulty tier (tier 1 for the lower grade-1 levels, tier 2 for grade-2). Document the threshold inline.
- `COUNT_RANGE: Record<1 | 2, { min: number; max: number }>` — tier 1 `{3,10}`, tier 2 `{6,20}` (grades 1–2 band; never exceeds 20).
- `generateCountingTask(startingLevel: number, pickCount?: (min, max) => number): CountingTask` — derives the tier, picks `targetCount` within the tier range (default `pickCount` uses `Math.random`; tests inject a deterministic one), sets `arrangement` (`scatter` if ≤5 else `rows_of_5`), and fills the `*Key` fields for `count_till`. Always clamps to the band.
- `isCorrect(task: CountingTask, tally: number): boolean` — `tally === task.targetCount`.

#### 3. Polish content for the counting task

**File**: `src/i18n/pl.ts` (extend) and `src/i18n/index.ts` (if a plural helper is needed)

**Intent**: Add a new top-level `task` namespace (sibling of `start`) holding the `count_till` narrative prompt, question, success copy, gentle-retry copy, and hint copy — all Polish, no inline literals anywhere (L-003). Reuse/extend the `charsNeeded`-style `Intl.PluralRules` pattern if a "N monet/moneta/monety" string is rendered.

**Contract**: New `pl.task` object with keys referenced by `CountingTask.*Key` (e.g. `task.count_till.prompt` = "Policz monety w kasie, zanim otworzysz sklep.", `task.count_till.question` = "Ile monet jest w kasie?", `task.count_till.success`, `task.retry` = gentle "Spróbuj jeszcze raz", `task.hint` = "Dotknij każdą monetę po kolei i licz.", plus the "Sprawdź" CTA label). Polish copy is draft pending native-speaker review (flagged in research). Pluralized coin counts, if shown, go through the `Intl.PluralRules("pl")` helper.

#### 4. Unit tests for the domain core

**File**: `tests/counting-tasks.test.ts` (new — mirrors the existing vitest style in `tests/`)

**Intent**: Lock the high-risk procedural-generation and correctness logic.

**Contract**: Cover — `tierForLevel` mapping at the boundary levels; `generateCountingTask` produces `targetCount` within the tier band for both tiers (inject a deterministic `pickCount`, and assert clamping at min/max); `arrangement` flips at the ≤5 boundary; `isCorrect` is true only on exact match; `RETRY_HINT_THRESHOLD === 2`. No DOM/React.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run check`
- Linting passes (incl. no-inline-literal rule): `npm run lint`
- Unit tests pass: `npm test`
- Build passes: `npm run build`

#### Manual Verification:

- `src/types.ts` exists and exports `CountingTask` + `RETRY_HINT_THRESHOLD`; no other module redefines the type inline.
- Every new user-visible string lives in `pl.ts` (grep the new files for quoted human-readable text — none).
- Polish copy reads naturally for a 6–8-year-old (pending native-speaker confirmation).

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation before starting Phase 2.

---

## Phase 2: Task UI + entry wiring (page, island, start-screen rewire)

### Overview

Render the counting task on a new gated `/app/task` page and rewire the start-screen tap to navigate there, completing the end-to-end flow.

### Changes Required:

#### 1. Task page (SSR loader)

**File**: `src/pages/app/task.astro` (new — mirrors `src/pages/app/start.astro`)

**Intent**: Load the active child profile server-side, generate the counting task from the profile's `starting_level`, resolve the themed world (so the till matches the child's business), and mount the counting island. Defensive fallback (null client / no profile) follows the start-screen pattern (redirect to `/auth/signin` or `/app`).

**Contract**: Frontmatter: build the request-scoped client (`createClient(Astro.request.headers, Astro.cookies)`), `getMostRecentProfile(supabase)`, `worldForTheme(profile.theme)`, `generateCountingTask(profile.starting_level)`. Render the page chrome (Layout, the subtle parent-signout escape hatch as on `start.astro:28-39`) and mount `<CountingTask client:load task={task} world={world} />`. Gating is inherited from middleware — no `PROTECTED_ROUTES` change. The generated `task` is passed as a prop (the one sanctioned prop-passing case: server-computed data the island can't recompute).

#### 2. Counting-task island

**File**: `src/components/child/CountingTask.tsx` (new — child-primitive tier)

**Intent**: Render the tappable till and run the entire tap → tally → submit → feedback interaction client-side, reusing `ChildButton`/`SelectTile` idioms, the `--accent` coin token, `coin.png`, and the `role="status"` feedback pattern. On success, navigate back to `/app/start`.

**Contract**:
- Props: `{ task: CountingTask; world: World }`. Imports `t` directly from `@/i18n` (no string props).
- Renders `task.targetCount` coin tiles in the layout dictated by `task.arrangement` (scatter ≤5; rows of 5 otherwise), each an oversized, non-adjacently-spaced tap target with a per-coin **toggle** counted state (`aria-pressed`, `ring-4` + check when counted) — tapping a counted coin un-counts it and decrements the tally (resolved decision 1).
- Shows a running tally (`naliczono: N`) and the "Sprawdź" CTA (`ChildButton variant="gold"`).
- On "Sprawdź": compute `isCorrect(task, tally)`. Correct → show `role="status"` success card (`task.successKey`) with a subtle `animate-*` acknowledgment, then `window.location.href = "/app/start"` after a short beat. Wrong → show gentle `role="status"` retry copy (`task.retryKey`), **preserve the child's current taps** for adjustment, increment a miss counter; when misses reach `RETRY_HINT_THRESHOLD`, briefly highlight the coin pile (a `ring`/pulse on the till group) and surface `task.hintKey`. Never a red flash/buzzer/dead-end (Guardrails `prd-v2.md:50`).
- No network calls; no coin/score state.

#### 3. Rewire the start-screen entry

**File**: `src/components/child/StartShiftButton.tsx` (modify) — and/or `src/pages/app/start.astro` mount

**Intent**: Replace the no-op "coming soon" behavior so tapping the business navigates to `/app/task`.

**Contract**: The gold `ChildButton` tap navigates to `/app/task` (e.g. an anchor styled via `buttonVariants`, matching `start.astro:73`'s link pattern, or a click handler that sets `window.location.href`). Remove the `comingSoon*` toggle path; the `comingSoonTitle`/`comingSoon` keys in `pl.ts` become unused — delete them to satisfy the no-dead-copy intent of L-003. Keep the island's `min-h-16`/`variant="gold"` affordance and `t.start.open` label.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Unit tests pass: `npm test`
- Build passes: `npm run build`

#### Manual Verification:

- From `/app/start`, tapping the business navigates to `/app/task` (and an unauthenticated hit on `/app/task` redirects to sign-in — gating inherited).
- Coins render themed to the profile's business; count matches `targetCount`; coins are individually tappable and spaced so taps don't cross-register.
- Tapping toggles counted state both ways; the tally tracks taps correctly.
- A correct "Sprawdź" shows the success acknowledgment and returns to `/app/start`; a wrong one shows gentle retry with taps preserved; the 2nd miss surfaces the coin-pile hint. No red flash, buzzer, or dead-end.
- No coins/score persisted; reloading `/app/start` shows unchanged profile state.
- Animation is smooth with no visible per-tap lag on a mid-range tablet.

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation that the full play-through works before considering the slice done.

---

## Testing Strategy

### Unit Tests (vitest):

- `tierForLevel` boundary mapping; `generateCountingTask` band-clamping + tier ranges (deterministic `pickCount` injection); `arrangement` threshold; `isCorrect` exact-match; `RETRY_HINT_THRESHOLD` value.

### Integration / Route:

- Not added as automated tests this slice (testing depth = pure logic, resolved decision). Route gating for `/app/task` is exercised manually and is already covered structurally by the existing middleware/`app-router` test pattern.

### Manual Testing Steps:

1. Sign in, reach `/app/start`, tap the business → lands on `/app/task` with themed coins.
2. Count by tapping; tap a coin twice to confirm toggle-off decrements the tally.
3. Submit a wrong count → gentle retry, taps preserved; submit wrong again → coin-pile hint appears.
4. Submit the correct count → success acknowledgment → returns to `/app/start`.
5. Reload `/app/start` → no score/coin change persisted.
6. Hit `/app/task` while signed out → redirected to sign-in.

## Performance Considerations

All interaction is client-side React state — no per-tap round-trip (PRD NFR `prd-v2.md:148`). Coin images use `loading="lazy"` per the `SelectTile` pattern; the only committed coin asset is `public/illustrations/coin.png`. Keep the success animation within `tw-animate-css` utilities (no heavy libraries) to preserve the smooth-on-mid-range-tablet budget.

## Migration Notes

None — this slice persists nothing and ships no migration. (Gameplay state is S-04.)

## References

- Related research: `context/changes/counting-task-in-business-context/research.md` (six resolved decisions + grounding)
- Roadmap slice: `context/foundation/roadmap.md:94-105` (S-02)
- PRD: `context/foundation/prd-v2.md` §Business Logic (150-158), US-02 AC (77-82), FR-006/007/008/009/010, NFRs (145-148)
- Entry seam: `src/components/child/StartShiftButton.tsx:6-33`
- Page pattern: `src/pages/app/start.astro`
- Primitives: `src/components/child/{ChildButton,SelectTile}.tsx`
- i18n: `src/i18n/pl.ts:162-169`, `src/i18n/index.ts:25-27`
- Tokens/assets: `src/styles/global.css` (`--accent`), `public/illustrations/coin.png`
- Lessons: `context/foundation/lessons.md` (L-003 applies; L-001/L-002 N/A)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Counting-task domain (types, generator, correctness, i18n, tests)

#### Automated

- [x] 1.1 Type checking passes: `npm run check`
- [x] 1.2 Linting passes (incl. no-inline-literal rule): `npm run lint`
- [x] 1.3 Unit tests pass: `npm test`
- [x] 1.4 Build passes: `npm run build`

#### Manual

- [x] 1.5 `src/types.ts` exports `CountingTask` + `RETRY_HINT_THRESHOLD`; type not redefined inline elsewhere
- [x] 1.6 Every new user-visible string lives in `pl.ts` (grep new files — no inline literals)
- [x] 1.7 Polish copy reads naturally for a 6–8-year-old (pending native-speaker confirmation)

### Phase 2: Task UI + entry wiring (page, island, start-screen rewire)

#### Automated

- [ ] 2.1 Type checking passes: `npm run check`
- [ ] 2.2 Linting passes: `npm run lint`
- [ ] 2.3 Unit tests pass: `npm test`
- [ ] 2.4 Build passes: `npm run build`

#### Manual

- [ ] 2.5 Tapping the business on `/app/start` navigates to `/app/task`; signed-out hit on `/app/task` redirects to sign-in
- [ ] 2.6 Coins render themed to the profile's business; count matches `targetCount`; tap targets don't cross-register
- [ ] 2.7 Tapping toggles counted state both ways; tally tracks taps
- [ ] 2.8 Correct submit → success acknowledgment → returns to `/app/start`; wrong submit → gentle retry with taps preserved; 2nd miss → coin-pile hint; no red flash/buzzer/dead-end
- [ ] 2.9 No coins/score persisted; reloading `/app/start` shows unchanged state
- [ ] 2.10 Animation smooth with no visible per-tap lag on a mid-range tablet
