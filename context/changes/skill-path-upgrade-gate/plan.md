# Skill-Path Upgrade Gate + Parent Weekly Report Implementation Plan

## Overview

Deliver roadmap **S-07**: world growth gated on learning. Track a per-competency **skill-progress** signal (math / money / decisions) derived from task attempts (now including miss counts), persist it monotonically, and use **skill progress + completed task history** as additional upgrade requirements alongside S-06's cost + world-level gates (PRD FR-010, FR-015). Then build a **parent-PIN-gated weekly report** (FR-016) over a new per-shift history log, tying each unlocked upgrade to the skills it exercised. The gate half (Phases 1–3) is the load-bearing core; the report half (Phases 4–6) adds two new RLS-isolated tables and the first parent-facing surface.

## Current State Analysis

S-06 (archived) shipped the earn→choose→grow loop and **deliberately deferred all skill machinery to S-07**, leaving clean seams:

- **The skill signal exists in memory but is discarded.** `ShiftScreen.tsx:44,49` holds `tasks[i].type` (`counting`|`change_making`) and `results[i].firstTry` index-for-index, but `advance` (`:54-57`) never joins them; the shift collapses to `taskCount`/`cleanCount` (`:66-67`) before the POST (`:71-75`). The finest signal — exact `misses` — is collapsed to a boolean at `useCoinTask.ts:53` (`TaskOutcome = { firstTry }`, `:6-9`).
- **The gate is built to extend.** `canBuy` (`src/data/upgrades.ts:122-128`) returns a reason union (`unknown|owned|locked|insufficient`) and takes a trusted `BuyContext` (`:109-113`); display and authority share it (`:117-121`). Adding optional `Upgrade` fields + reasons doesn't restructure call sites; `buy.ts:45-49` already forwards arbitrary reasons as `400 { reason }`.
- **`child_profiles` is the only table.** Its four RLS policies are column-agnostic (`…isolation.sql:78-101`), so a new *column* needs no policy change (proven by `shop_state`, `…shop_state_default.sql:14`). A new *table* triggers the full L-001 contract (four policies in-migration + isolation test + `docs/reference/contract-surfaces.md` entry; skeleton `docs/reference/rls-template.sql`).
- **No parent surface, no history, no PIN exist.** Every `/app/*` route is a child surface (`middleware.ts:5` gates `/app`; `locals.user` is the acting parent). `child-profiles.ts` has only `getMostRecentProfile` (`:72-75`, `limit(1)`), no list-all. `child_profiles` stores only *current* aggregates — no timestamped history anywhere. `"Panel rodzica"`/`"raporty"` (`pl.ts:69,82`) are marketing copy wired to nothing. A parent-PIN mockup exists (`assets/matma-verse/math-economy-auth-v2-*`, local-only) but nothing is built.
- **Server-authoritative pattern to mirror:** `recordShiftResult` (`child-profiles.ts:92-120`) reads by `id` under RLS, recomputes via pure fns, writes one UPDATE, never trusts `account_id` (L-002).

### Key Discoveries:

- Task type → competency mapping is implied by the code: `counting` → math, `change_making` → money; the choose-upgrade purchase event is the **decisions** competency (accrues in `buyUpgrade`, not a shift).
- The client already reports `taskCount`/`cleanCount` (server recomputes earnings from them, capped at `MAX_SHIFT_TASKS`). Per-competency skill deltas inherit this **same trust posture** — client-reported, server-capped, server-accumulated monotonically. This is consistent with the shipped wallet path, not a regression (see Open Risks).
- `TaskType = Task["type"]` is already exported (`src/data/tasks.ts:12`) — the natural competency key.
- Isolation-test template: `tests/child-profiles-isolation.test.ts:115-135` (column UPDATE-isolation); `tests/shifts-complete.test.ts` (route persistence + L-002 spoof); `tests/upgrades-buy.test.ts` (gate reasons).

## Desired End State

A child playing shifts builds visible per-competency skill (math/money) and, by choosing upgrades, decisions skill. A couple of catalog upgrades now require a skill level or a task-history threshold; locked ones show the single concrete missing requirement in plain Polish (skill or task history), and the upgrades screen shows simple progress bars. Spending never lowers any skill. A parent enters a PIN and opens a weekly report for their own children only, showing what was practiced this week and which upgrade each week's play unlocked, tied to the skills it exercised. Verify: play shifts → skill levels rise monotonically + persist; a skill/history-locked upgrade can't be bought until earned; account B can neither read nor write A's skills, history, or PIN; the report renders per-child weekly aggregates behind the PIN.

## What We're NOT Doing

- **No new task types** (set-price, manage-stock) or the `inventory`/`profit` competencies they'd feed — out of scope until those tasks exist.
- **No child-vs-parent identity model.** The PIN is a soft gate over the session; there is still one auth identity (the parent account). No per-child login.
- **No per-task-attempt history rows** — the log is per-shift aggregate (sufficient for the weekly report).
- **No ratio/mastery-decay progress function** — skill progress is monotonic count→level only (guardrail: spending/attempts never regress skill).
- **No retro-locking of owned upgrades** — `canBuy` short-circuits on `owned` before any skill/history rung, so existing purchases stay owned.
- **No parent report beyond weekly** (no historical charts, no cross-child comparison, no export) — read-only weekly summary only.
- **No gating of every upgrade** — skill/history gates apply to ~2 catalog entries; the rest stay cost+world-level.

## Implementation Approach

Bottom-up, learning-signal first, then the gate, then the parent read surface. (1) Establish the skill-progress model as pure fns + a `skill_state` jsonb column, capturing the per-competency signal the shift already knows and folding it server-side into monotonic state. (2) Extend the upgrade gate to read that state (plus the decisions competency accrued at purchase) as new requirements. (3) Surface skill to the child. (4–6) Add a per-shift history log (new RLS table), a parent-PIN gate (new RLS table), and the weekly report screen over them. Every currency- and competence-moving path stays server-authoritative; the client only reports capped play deltas and names which upgrade to buy.

## Critical Implementation Details

- **Monotonicity is a hard invariant.** Skill state only ever increases. `recordShiftResult` and `buyUpgrade` must *add* the (capped) delta to the stored value, never overwrite from a client-supplied absolute. This is what satisfies "spending never regresses skill progress" (PRD guardrail).
- **`skill_state` normalization.** Existing rows default to `'{}'`. A pure `readSkillState(skill_state)` normalizer must return a full zeroed per-competency shape for missing keys, so gate + report code is robust whether a row predates or postdates the column.
- **Two write points, both server-authoritative.** math/money skills accrue in `recordShiftResult` (from the shift's per-competency delta); the decisions competency accrues in `buyUpgrade` (+1 per purchase, fully server-side). Both fold into the *same single UPDATE* their function already issues.
- **PIN gate is route-level, not middleware.** Gating in `middleware.ts` would gate all of `/app`. The report route (and its data) check a parent-verified session marker themselves and redirect to the PIN page when absent.

---

## Phase 1: Skill-progress model + persistence + shift write path

### Overview

Establish the shared skill-progress core (competencies, monotonic count→level thresholds, task-type→competency map) as pure fns, add the `skill_state` column, capture the per-competency signal the shift already has (now with miss counts), and fold it server-side into monotonic state — the trusted foundation both the gate and the report consume.

### Changes Required:

#### 1. Skill-progress pure module

**File**: `src/data/skills.ts` (new)

**Intent**: The single shared source of truth for competencies, the progress function, and the level ladder — imported by the client (display), the shift-complete route (authority), and the buy route (decisions competency + gate), mirroring `shift.ts`/`upgrades.ts` "agree by construction". Dependency-free (no i18n/React/Supabase).

**Contract**: `Competency = "math" | "money" | "decisions"`. `competencyForTaskType(type): Competency` (counting→math, change_making→money). `SKILL_THRESHOLDS` (a named monotonic ladder, first-guess, tunable) + `skillLevel(firstTryCorrect): number` (count of thresholds passed). `readSkillState(skillState): SkillState` (normalizes missing → fully-zeroed per-competency shape). `addSkillDelta(current, delta): SkillState` (per-competency additive merge — monotonic; clamps each field ≥ current). `skillLevelsFor(state): Record<Competency, number>`. Per-competency record shape `{ firstTryCorrect, completed, misses }`.

#### 2. SkillState type + widened TaskOutcome

**File**: `src/types.ts`, `src/components/hooks/useCoinTask.ts`

**Intent**: Add the persisted `SkillState` type and widen the per-task outcome to carry the exact miss count (currently collapsed to a boolean), so the shift can build a richer per-competency signal.

**Contract**: `SkillState = Record<Competency, { firstTryCorrect: number; completed: number; misses: number }>` in `types.ts` (or a keyed object typed against `Competency`). `TaskOutcome` gains `misses: number`; `useCoinTask` emits `onComplete({ firstTry: misses === 0, misses })` (`useCoinTask.ts:53`).

#### 3. shop→skill column migration

**File**: `supabase/migrations/20260701140000_child_profiles_add_skill_state.sql` (new)

**Intent**: Add the `skill_state jsonb` column holding per-competency counters. Non-destructive; existing rows default empty and are normalized by `readSkillState`.

**Contract**: `alter table public.child_profiles add column skill_state jsonb not null default '{}'::jsonb` + column comment. No RLS/trigger change (column-agnostic policies — L-001); note this in the header. Update `docs/reference/contract-surfaces.md` Columns list.

#### 4. Capture per-competency shift summary + thread to the server

**File**: `src/components/child/ShiftScreen.tsx`, `src/pages/api/shifts/complete.ts`, `src/lib/services/child-profiles.ts`

**Intent**: Pair each task's `type` with its outcome in the accumulator, build a per-competency shift delta (`{ math, money }` with firstTryCorrect/completed/misses), send it in the shift-complete POST, validate it, and fold it into `skill_state` monotonically inside the same UPDATE `recordShiftResult` already issues. `ChildProfile` gains `skill_state`.

**Contract**: `ShiftScreen` accumulates `{ task: Task; outcome: TaskOutcome }` (or a parallel per-competency tally) and posts a `skills` JSON field. `complete.ts` zod schema gains `skills` — a per-competency object of non-negative ints, each capped at `MAX_SHIFT_TASKS`, **plus a reconciliation `refine` against the already-sent aggregates: `Σ completed ≤ taskCount` and `Σ firstTryCorrect ≤ cleanCount`** (reject mismatches — the deltas must fit inside the shift the client also reported, closing the trivial-inflation gap; only the math/money shift competencies count toward these sums, not decisions). `recordShiftResult` signature gains the parsed delta; it computes `skill_state: addSkillDelta(readSkillState(current.skill_state), delta)` and writes it in the existing single UPDATE (`child-profiles.ts:109-116`). `ChildProfile.skill_state: SkillState`.

#### 5. Unit tests

**File**: `tests/skills.test.ts` (new)

**Intent**: Lock the pure skill fns.

**Contract**: `competencyForTaskType` mapping; `skillLevel` at each threshold boundary; `readSkillState` normalizes `'{}'`/missing/partial; `addSkillDelta` is additive + monotonic (never decreases a field); `skillLevelsFor` derivation.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npx vitest run tests/skills.test.ts`
- Migration + shift-skill persistence pass against a fresh DB: `npx supabase db reset` then `npx vitest run tests/shifts-complete.test.ts` (extended with a skill-progress persistence case + L-002 spoof)
- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Playing a shift with counting + change-making tasks advances the matching per-competency counters (checked in Studio/test output); a perfect shift raises `firstTryCorrect`, a shift with retries raises `misses`.
- Replaying shifts only ever increases skill counters — never decreases.

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: Gate extension — decisions competency, skill + task-history requirements

### Overview

Make skill load-bearing: accrue the decisions competency at purchase, add optional skill + task-history requirements to the catalog, extend `canBuy` with new rungs, and read the trusted skill state into the gate — without breaking any S-06 cost+level gate.

### Changes Required:

#### 1. Catalog + gate extension

**File**: `src/data/upgrades.ts`

**Intent**: Add optional skill/task-history requirements to `Upgrade`, extend the gate context + reason union, and insert new rungs in the correct ladder position so existing entries pass through unchanged. Gate ~2 catalog upgrades sparingly.

**Contract**: `Upgrade` gains optional `requiredSkill?: { competency: Competency; level: number }` and `requiredTaskHistory?: { competency: Competency; count: number }`. `BuyContext` gains `skillState: SkillState`. `BuyCheck`/`BuyFailure` reason unions gain `"skill-locked"` and `"history-locked"`. `canBuy` ladder becomes `unknown → owned → locked(world) → skill-locked → history-locked → insufficient(funds)`; entries without the optional fields skip the new rungs. Concretely gate `register` with `requiredSkill { money, 1 }` and `customers` with `requiredTaskHistory { math, 8 }` (first-guess, tunable). `nextUpgrade` unaffected (still cost/level eligibility). No change to `UPGRADE_IDS`/zod.

#### 2. Read skill into the buy path + accrue decisions

**File**: `src/lib/services/child-profiles.ts`

**Intent**: Populate `BuyContext.skillState` from the trusted row, and on a successful purchase increment the decisions competency in the same UPDATE that debits the wallet and appends the upgrade.

**Contract**: `buyUpgrade` reads `readSkillState(current.skill_state)` into the `canBuy` context (alongside wallet/level/purchased); on success the UPDATE also writes `skill_state: addSkillDelta(current, { decisions: { firstTryCorrect: 1, completed: 1, misses: 0 } })`. New `BuyFailure` values map through the existing return shape; `buy.ts` needs no change (already forwards `reason`).

#### 3. Thread skillState into BuyContext consumers (display)

**File**: `src/components/child/UpgradeShop.tsx`, `src/pages/app/upgrades.astro`

**Intent**: Because `BuyContext` now requires `skillState`, every consumer that builds the ctx must pass it in the SAME phase the field becomes required — otherwise Phase 2's `npm run check`/`build` fail. The upgrades screen must evaluate the gate against the child's real skill (so a skill-gated upgrade shows correctly), even though the skill *bars* land in Phase 3.

**Contract**: `upgrades.astro` passes `readSkillState(profile.skill_state)` into the island; `UpgradeShop`'s `ctx` (`UpgradeShop.tsx:40`) gains `skillState`. No new UI yet (the visible bars + skill/history locked-reason copy are Phase 3) — this change is purely threading the trusted value so `canBuy` is correct and the build stays green.

#### 4. Gate tests

**File**: `tests/upgrades.test.ts`, `tests/upgrades-buy.test.ts`

**Intent**: Lock the new gate logic (pure + route) and the decisions accrual.

**Contract**: `upgrades.test.ts` — add `skillState` to the existing `canBuy` ctx objects (they break otherwise), and assert `canBuy` returns `skill-locked`/`history-locked` at the right boundaries and precedence (owned still short-circuits first; a met requirement passes through). `upgrades-buy.test.ts` — a skill-locked and a history-locked buy each return `400 { reason }` with wallet + state unchanged; a purchase increments the decisions competency (durable state via admin client); an owned upgrade is never retro-locked.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npx vitest run tests/upgrades.test.ts tests/skills.test.ts`
- Gate/buy integration passes against a fresh DB: `npx supabase db reset` then `npx vitest run tests/upgrades-buy.test.ts`
- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- A skill/history-gated upgrade cannot be bought until the requirement is earned; once earned, it buys normally.
- Buying an upgrade raises the decisions competency; spending never lowers any skill.

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Child-facing skill surfacing

### Overview

Make skill visible to the child: simple per-competency progress on the upgrades screen, and the single concrete missing requirement (skill or task history) on locked upgrades — warm, factual, no urgency.

### Changes Required:

#### 1. Locked-reason + next-requirement copy

**File**: `src/components/child/UpgradeShop.tsx`, `src/i18n/pl.ts`

**Intent**: Extend the `lockedReason` seam to render the new gate reasons in plain Polish, and add skill/task-history requirement strings to the dictionary (L-003).

**Contract**: `lockedReason` (`UpgradeShop.tsx:69-76`) gains `skill-locked`/`history-locked` branches producing `t.upgradeShop.lockedBySkill` / `lockedByHistory` (new keys with `{competency}`/`{level}`/`{count}` tokens); competency display names live under a new `t.skills.<competency>` block. Reasons come from the shared `canBuy` — no display-only gate logic.

#### 2. Skill-progress display

**File**: `src/components/child/UpgradeShop.tsx` (+ a small `SkillBars` presentational component if factored out), `src/pages/app/upgrades.astro`

**Intent**: Show simple per-competency progress (level + progress toward next) on the upgrades screen, derived from the profile's `skill_state`, so the child sees learning reflected.

**Contract**: The island already receives `skillState` (threaded in Phase 2 §3); this phase renders per-competency bars via `skillLevelsFor` + the thresholds (pure fns), every label via `t.skills.*`. Oversized, non-manipulative (guardrail).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- Tests still pass: `npx vitest run tests/upgrades.test.ts tests/skills.test.ts tests/upgrades-buy.test.ts`
- No inline user-visible literals introduced (L-003 grep of the edited surfaces)

#### Manual Verification:

- The upgrades screen shows correct per-competency skill bars for a seeded profile.
- A skill/history-locked upgrade shows the one concrete missing requirement in Polish; no scarcity/urgency copy.
- Bars advance after playing shifts / buying upgrades.

**Implementation Note**: Pause for manual confirmation before Phase 4. Gate half (S-07 core) complete.

---

## Phase 4: Per-shift history log + logging + weekly aggregation

### Overview

Give the parent report a data source: a new owned+RLS `shift_log` table (full L-001), a per-shift row written at shift completion and on purchase, an all-profiles read fn, and a weekly aggregation service.

### Changes Required:

#### 1. shift_log table migration

**File**: `supabase/migrations/20260701150000_create_shift_log.sql` (new)

**Intent**: A per-profile, per-shift history table owned by the account, with RLS in the same migration (L-001).

**Contract**: `shift_log (id uuid pk, account_id uuid not null references auth.users(id) on delete cascade, profile_id uuid not null references child_profiles(id) on delete cascade, created_at timestamptz not null default now(), skills jsonb not null, upgrade_purchased text null)`. Four `to authenticated` per-op policies predicated on `auth.uid() = account_id` (SELECT/INSERT/UPDATE/DELETE; INSERT `with check`, UPDATE both), copied from `docs/reference/rls-template.sql`. Index on `(profile_id, created_at)`. Register in `docs/reference/contract-surfaces.md`.

#### 2. Write history rows

**File**: `src/lib/services/child-profiles.ts`

**Intent**: Record one `shift_log` row per completed shift (per-competency deltas) and stamp the purchased upgrade onto the relevant row/event, setting `account_id` from the session — never the client (L-002).

**Contract**: `recordShiftResult` inserts a `shift_log` row (`account_id` from the authenticated user, `profile_id`, the shift's `skills` delta). `buyUpgrade` records the purchase in the log (e.g. a row with `upgrade_purchased`, or updates the latest). `account_id` derived from `supabase.auth.getUser()` at the route/service boundary, never from input.

#### 3. All-profiles read + weekly aggregation

**File**: `src/lib/services/child-profiles.ts`, `src/lib/services/reports.ts` (new)

**Intent**: Add an RLS-scoped list-all-profiles fn and a weekly aggregation that rolls `shift_log` into a per-child summary tying unlocked upgrades to the skills they exercised.

**Contract**: `listChildProfiles(client): Promise<ChildProfile[]>` — `getMostRecentProfile` without `limit(1)`. `getWeeklyReport(client, profileId): Promise<WeeklyReport>` in `reports.ts` — reads the profile's `shift_log` rows within the current week (RLS-scoped), aggregates per-competency practice + lists upgrades purchased with the skills each exercised. **Skill tie:** for a gated upgrade, tie to its `requiredSkill`/`requiredTaskHistory` competencies; for a cost-only upgrade (no requirement), tie to the competencies actually practiced that week (fallback label "general practice") — so no upgrade shows a blank skills tie. `WeeklyReport` type in `types.ts`.

#### 4. Isolation + persistence tests

**File**: `tests/shift-log-isolation.test.ts` (new), extend `tests/shifts-complete.test.ts`

**Intent**: Prove the new table's cross-account isolation (L-001/L-002) and that a shift writes a durable log row.

**Contract**: `shift-log-isolation.test.ts` mirrors `tests/child-profiles-isolation.test.ts` — positive control + SELECT/INSERT/UPDATE/DELETE isolation; INSERT-on-behalf verified via service-role existence check (L-002, no chained `.select()`). `shifts-complete.test.ts` gains: a completed shift writes exactly one `shift_log` row with the right deltas; account B's shift never writes to A.

### Success Criteria:

#### Automated Verification:

- Isolation + persistence pass against a fresh DB: `npx supabase db reset` then `npx vitest run tests/shift-log-isolation.test.ts tests/shifts-complete.test.ts`
- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- Policy-removal meta-check: temporarily weakening a `shift_log` policy turns the isolation test red (documented, reverted).

#### Manual Verification:

- Completing shifts creates per-shift log rows for the right profile (Studio).
- The weekly aggregation returns a sensible per-child summary tying purchased upgrades to skills.

**Implementation Note**: Pause for manual confirmation before Phase 5.

---

## Phase 5: Parent-PIN gate

### Overview

Add the first parent-only gate: a new owned+RLS `account_settings` table holding a hashed PIN, set/verify API routes, a gate page, and a short-lived parent-verified session marker the report route checks.

### Changes Required:

#### 1. account_settings table migration

**File**: `supabase/migrations/20260701160000_create_account_settings.sql` (new)

**Intent**: Per-account parent settings holding the PIN hash, with RLS in the same migration (L-001).

**Contract**: `account_settings (account_id uuid primary key references auth.users(id) on delete cascade, pin_hash text not null, failed_attempts integer not null default 0 check (failed_attempts >= 0), locked_until timestamptz null, created_at timestamptz not null default now(), updated_at timestamptz not null default now())` + shared `set_updated_at` trigger. The `failed_attempts`/`locked_until` columns back the verify throttle (§2). Four `to authenticated` per-op policies on `auth.uid() = account_id`. Register in `docs/reference/contract-surfaces.md`.

#### 2. PIN set/verify service + routes

**File**: `src/lib/services/parent-pin.ts` (new), `src/pages/api/parent/pin/set.ts` (new), `src/pages/api/parent/pin/verify.ts` (new), `astro.config.mjs`

**Intent**: Hash + store the PIN and verify it server-side, then set a short-lived signed session marker on success. `prerender = false`; no trust-bearing input beyond the PIN; `account_id` from the session.

**Contract**: `parent-pin.ts` — `setPin(client, pin)` (hash via Node `crypto` scrypt/pbkdf2 with per-account salt; upsert into `account_settings` by id under RLS), `verifyPin(client, pin): boolean`, `hasPin(client): boolean`, plus `signMarker(payload)`/`verifyMarker(cookie)` helpers. Routes: `POST /api/parent/pin/set` and `POST /api/parent/pin/verify`, zod-validated (PIN = 4–6 digits), `applyNoStore` headers, JSON responses. **New env secret**: add `PARENT_SESSION_SECRET` to `astro.config.mjs`'s `env.schema` (`access: "secret"`, `context: "server"`), read via `astro:env/server` (never `import.meta.env`) — the HMAC key for the marker. On successful verify, set a signed, short-TTL, `httpOnly` `parent_verified` cookie (HMAC of account_id + expiry), and reset `failed_attempts`. **Throttle:** `verifyPin` reads `account_settings`; if `locked_until` is in the future it rejects without checking the PIN; a wrong PIN increments `failed_attempts` and, past a named threshold, sets a short `locked_until` cooldown (bounds brute-force of the 4–6 digit PIN). PIN + secret never logged. (Document the new Vercel env var in the migration/deploy notes.)

#### 3. PIN gate page

**File**: `src/pages/app/parent-pin.astro` (new), `src/components/parent/ParentPinGate.tsx` (new), `src/i18n/pl.ts`

**Intent**: A gate screen that prompts the parent to **set** a PIN (first time, when `hasPin` is false) or **enter** it, posting to the routes above; on success it redirects to the report. Follows the `math-economy-auth-v2` parent-PIN mockup (ask maintainer if the asset is absent).

**Contract**: SSR page under `/app` (auth-gated already); island posts to the set/verify routes and on success navigates to `/app/report`. New `t.parentPin.*` i18n block (L-003). Numeric, oversized inputs.

### Success Criteria:

#### Automated Verification:

- Isolation + PIN round-trip pass against a fresh DB: `npx supabase db reset` then `npx vitest run tests/account-settings-isolation.test.ts tests/parent-pin.test.ts` (both new)
- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- PIN is stored hashed (never plaintext) — asserted in the round-trip test.

#### Manual Verification:

- First visit prompts to set a PIN; subsequent visits require entering it; a wrong PIN is rejected.
- The `parent_verified` marker expires (short TTL) so the gate re-prompts later.
- Account B cannot read or set account A's PIN.

**Implementation Note**: Pause for manual confirmation before Phase 6.

---

## Phase 6: Parent weekly report screen

### Overview

The parent-facing payoff: a PIN-gated `/app/report` route rendering, per child, what was practiced this week and which upgrade each week's play unlocked — tied to the skills it exercised, read-only and non-shaming.

### Changes Required:

#### 1. Report route (SSR shell, PIN-gated)

**File**: `src/pages/app/report.astro` (new)

**Intent**: Check the `parent_verified` marker (redirect to `/app/parent-pin` when absent), load all the parent's profiles and each one's weekly report, and render the report island.

**Contract**: Route-level gate reads the signed `parent_verified` cookie; on miss → `Astro.redirect("/app/parent-pin")`. Loads `listChildProfiles` + `getWeeklyReport` per profile (RLS-scoped — only the parent's own). Passes the aggregates into the island. `prerender = false` semantics via SSR.

#### 2. Report island + copy

**File**: `src/components/parent/WeeklyReport.tsx` (new), `src/i18n/pl.ts`

**Intent**: Render each child's weekly practice per competency and the upgrades unlocked with the skills they exercised — educational, plain-language, read-only, never comparative/shaming (FR-016 guardrail).

**Contract**: Consumes the `WeeklyReport` aggregates; renders per-child sections (practice per competency + unlocked upgrades → skills). New `t.report.*` i18n block (L-003). No child-comparison, no urgency.

#### 3. Report entry point

**File**: `src/pages/app/start.astro` (or the parent sign-out area)

**Intent**: A discreet parent-facing link to the report (behind the PIN), distinct from child controls.

**Contract**: A small "Panel rodzica"/report link near the existing sign-out control; string via `t.*`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- Full suite passes: `npx vitest run` (against a fresh `npx supabase db reset`)
- No inline user-visible literals in the new report/PIN surfaces (L-003 grep)

#### Manual Verification:

- `/app/report` redirects to the PIN gate when unverified; after PIN entry it renders.
- The report shows each of the parent's own children's weekly practice + unlocked upgrades tied to skills; no other account's data ever appears.
- Copy is Polish, educational, non-shaming, no comparison/urgency.
- End-to-end: play shifts (skills rise) → buy a now-unlocked upgrade → open the report → the week's practice + the unlock appear, tied to the right skills.

**Implementation Note**: Final phase — after automated + manual verification, S-07 is complete.

---

## Testing Strategy

### Unit Tests (`tests/skills.test.ts`, `tests/upgrades.test.ts`):

- `competencyForTaskType`, `skillLevel` boundaries, `readSkillState` normalization, `addSkillDelta` additive-monotonic, `skillLevelsFor`.
- `canBuy` new reasons (`skill-locked`/`history-locked`) at boundaries + ladder precedence (owned first; met requirement passes).

### Integration Tests (local Supabase stack):

- `tests/shifts-complete.test.ts` — a shift folds per-competency deltas into `skill_state` monotonically; an inflated `skills` delta that exceeds `taskCount`/`cleanCount` is rejected (`400`, no skill change); writes one `shift_log` row; L-002 spoof (B can't advance/log A).
- `tests/upgrades-buy.test.ts` — skill-locked + history-locked buys rejected (durable state unchanged); purchase accrues decisions; owned never retro-locked.
- `tests/shift-log-isolation.test.ts`, `tests/account-settings-isolation.test.ts` — full L-001 cross-account isolation + policy-removal meta-check.
- `tests/parent-pin.test.ts` — set/verify round-trip, PIN stored hashed, wrong PIN rejected, repeated wrong PINs trip the lockout (verify rejected while `locked_until` is in the future), cross-account PIN isolation.

### Manual Testing Steps:

1. Play counting + change-making shifts; confirm math/money skills rise (Studio) and never fall on replay.
2. Try a skill/history-locked upgrade — shows the one missing requirement; earn it; buy succeeds; decisions skill rises.
3. Confirm upgrades-screen skill bars advance; no scarcity copy anywhere.
4. Open `/app/report` — redirected to PIN; set/enter PIN; report renders own children only.
5. Verify the week's practice + the unlocked upgrade appear tied to the right skills.
6. Confirm account B sees none of A's skills/history/PIN/report.

## Performance Considerations

The gate reads `skill_state` from the single profile row already loaded (`select("*")`) — no new query for display or buy. Skill folding is one in-memory merge inside the existing single UPDATE. The report reads the RLS-scoped `shift_log` for the current week per profile, indexed on `(profile_id, created_at)`; small volumes (a handful of shifts/week). One extra INSERT per shift (the log row).

## Migration Notes

Three non-destructive migrations: `skill_state` column (default `'{}'`, normalized by `readSkillState`, no backfill), `shift_log` table (new, empty), `account_settings` table (new, empty). Existing profiles start at zero skill — owned upgrades stay owned (`canBuy` short-circuits on `owned`), and no S-06 gate changes. `shift_log`/`account_settings` ship RLS in-migration (L-001). Rollback = drop the column/tables. The wallet non-negative constraint and S-06 gates are untouched.

## References

- Research: `context/changes/skill-path-upgrade-gate/research.md`
- Roadmap: `context/foundation/roadmap.md` → S-07 (`skill-path-upgrade-gate`)
- PRD: `context/foundation/prd-v3.md` FR-010, FR-015, FR-016, US-01; guardrails (monotonicity, system-determined, single missing requirement, non-shaming report)
- Server-authoritative + gate seams: archived `context/archive/2026-07-01-upgrade-choice-and-growth/` (S-06)
- Lessons: `context/foundation/lessons.md` L-001 (new tables → RLS in-migration + isolation test), L-002 (no client `account_id`; verify durable state), L-003 (i18n)
- RLS: `docs/reference/rls-template.sql`, `docs/reference/rls-isolation.md`, `docs/reference/contract-surfaces.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Skill-progress model + persistence + shift write path

#### Automated

- [x] 1.1 Unit tests pass: `npx vitest run tests/skills.test.ts` — ce21728
- [x] 1.2 Migration + shift-skill persistence pass against a fresh DB (`supabase db reset` + `vitest run tests/shifts-complete.test.ts`) — ce21728
- [x] 1.3 Type checking passes: `npm run check` — ce21728
- [x] 1.4 Linting passes: `npm run lint` — ce21728
- [x] 1.5 Build succeeds: `npm run build` — ce21728

#### Manual

- [x] 1.6 Playing a shift advances the matching per-competency counters (firstTryCorrect up on a clean shift; misses up on retries) — ce21728
- [x] 1.7 Replaying shifts only ever increases skill counters — never decreases — ce21728

### Phase 2: Gate extension — decisions competency, skill + task-history requirements

#### Automated

- [x] 2.1 Unit tests pass: `npx vitest run tests/upgrades.test.ts tests/skills.test.ts`
- [x] 2.2 Gate/buy integration passes against a fresh DB (`supabase db reset` + `vitest run tests/upgrades-buy.test.ts`)
- [x] 2.3 Type checking passes: `npm run check`
- [x] 2.4 Linting passes: `npm run lint`
- [x] 2.5 Build succeeds: `npm run build`

#### Manual

- [x] 2.6 A skill/history-gated upgrade can't be bought until earned; once earned, it buys normally
- [x] 2.7 Buying raises the decisions competency; spending never lowers any skill

### Phase 3: Child-facing skill surfacing

#### Automated

- [ ] 3.1 Type checking passes: `npm run check`
- [ ] 3.2 Linting passes: `npm run lint`
- [ ] 3.3 Build succeeds: `npm run build`
- [ ] 3.4 Tests still pass: `npx vitest run tests/upgrades.test.ts tests/skills.test.ts tests/upgrades-buy.test.ts`
- [ ] 3.5 No inline user-visible literals introduced (L-003 grep)

#### Manual

- [ ] 3.6 Upgrades screen shows correct per-competency skill bars for a seeded profile
- [ ] 3.7 A skill/history-locked upgrade shows the one concrete missing requirement in Polish; no scarcity copy
- [ ] 3.8 Bars advance after playing shifts / buying upgrades

### Phase 4: Per-shift history log + logging + weekly aggregation

#### Automated

- [ ] 4.1 Isolation + persistence pass against a fresh DB (`supabase db reset` + `vitest run tests/shift-log-isolation.test.ts tests/shifts-complete.test.ts`)
- [ ] 4.2 Type checking passes: `npm run check`
- [ ] 4.3 Linting passes: `npm run lint`
- [ ] 4.4 Build succeeds: `npm run build`
- [ ] 4.5 Policy-removal meta-check turns the `shift_log` isolation test red (documented, reverted)

#### Manual

- [ ] 4.6 Completing shifts creates per-shift log rows for the right profile (Studio)
- [ ] 4.7 Weekly aggregation returns a sensible per-child summary tying upgrades to skills

### Phase 5: Parent-PIN gate

#### Automated

- [ ] 5.1 Isolation + PIN round-trip pass against a fresh DB (`supabase db reset` + `vitest run tests/account-settings-isolation.test.ts tests/parent-pin.test.ts`)
- [ ] 5.2 Type checking passes: `npm run check`
- [ ] 5.3 Linting passes: `npm run lint`
- [ ] 5.4 Build succeeds: `npm run build`
- [ ] 5.5 PIN stored hashed (never plaintext) — asserted in the round-trip test

#### Manual

- [ ] 5.6 First visit prompts to set a PIN; later visits require entering it; wrong PIN rejected
- [ ] 5.7 The parent_verified marker expires (short TTL) so the gate re-prompts
- [ ] 5.8 Account B cannot read or set account A's PIN

### Phase 6: Parent weekly report screen

#### Automated

- [ ] 6.1 Type checking passes: `npm run check`
- [ ] 6.2 Linting passes: `npm run lint`
- [ ] 6.3 Build succeeds: `npm run build`
- [ ] 6.4 Full suite passes against a fresh DB (`supabase db reset` + `vitest run`)
- [ ] 6.5 No inline user-visible literals in the new report/PIN surfaces (L-003 grep)

#### Manual

- [ ] 6.6 `/app/report` redirects to the PIN gate when unverified; renders after PIN entry
- [ ] 6.7 Report shows each of the parent's own children's weekly practice + unlocked upgrades tied to skills; no other account's data appears
- [ ] 6.8 Copy is Polish, educational, non-shaming, no comparison/urgency
- [ ] 6.9 End-to-end: shifts raise skills → buy a now-unlocked upgrade → report shows the week's practice + the unlock tied to the right skills
