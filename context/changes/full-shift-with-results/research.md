---
date: 2026-06-29T23:38:37+0200
researcher: vince307
git_commit: 2d0ee7ec434d85344422409431e1cfceaa76c607
branch: main
repository: mathshop
topic: "Full shift end-to-end with results + first gameplay persistence (roadmap slice S-04, the north star)"
tags: [research, codebase, s-04, shift-loop, persistence, rls, scoring, results-screen]
status: complete
last_updated: 2026-06-29
last_updated_by: vince307
---

# Research: Full shift with results (S-04 — the north star)

**Date**: 2026-06-29T23:38:37+0200
**Researcher**: vince307
**Git Commit**: 2d0ee7e
**Branch**: main
**Repository**: mathshop

## Research Question

How to build roadmap slice **S-04 (`full-shift-with-results`)** — the validation milestone: the child completes a 5–10 task shift mixing S-02 counting and S-03 change-making, sees a results screen (coins + stars), and state persists across sessions. This is the **first gameplay persistence**, so it brings the F-01 RLS contract back into play. Scope confirmed with the product owner: **S-04 = coins + stars only** (business level tracked internally, no visible shop-art change — that's S-05); research **persistence-led but covering all four areas** (persistence/RLS, shift loop, scoring, results screen).

## Summary

S-04 is **mostly composition of what S-02/S-03 already built, plus one genuinely new high-risk layer: persistence.** Four findings shape it:

1. **Persistence → extend `child_profiles`, not a new table.** Add four columns (`coins`, `completed_shift_count`, `business_level`, `shop_state`). The four F-01 RLS policies are **column-agnostic** (`auth.uid() = account_id`), so they already cover new columns — exactly as the S-01b identity migration proved (it added 3 columns with *no policy changes*). This means **zero new policies, the existing isolation test stays authoritative** (plus one optional coins assertion), and **one `contract-surfaces.md` edit**. A separate table would only be justified by an append-only per-shift *ledger* (analytics/streaks) — out of S-04 scope. Keep `business_level` (mutable progression) **distinct** from `starting_level` (frozen age-derived difficulty band) — merging them corrupts difficulty derivation.

2. **Shift loop → minimal generalization of the shared core.** The success-redirect is hardcoded in **one place** (`useCoinTask`'s `useEffect`, `useCoinTask.ts:31-39`). Adding an optional `onComplete` callback (defaulting to today's `/app/start` redirect) and forwarding it through `TaskScreen`/`CountingTask`/`ChangeMakingTask` leaves S-02/S-03 **byte-for-byte unchanged**. A new `ShiftScreen` island holds the task list + cursor + accuracy, gives each task a React `key` (so hook state resets per task — no reset logic needed), and **auto-advances on the existing 1400ms success beat**. Surface `{ firstTry }` (i.e. `misses === 0`) from the hook so the shift can compute accuracy.

3. **Scoring → simple legible defaults (the roadmap's "ship a default, iterate").** Coins `= 5/task + 3/clean-task` (rewards length + accuracy, floor never zero — no-punishment guardrail). Stars by **clean-task rate** (100% → 3★, ≥70% → 2★, ≥40% → 1★, else 0 — still finishes, warm copy). `business_level = 1 + floor(completed_shifts / 3)` (levels every 3 shifts; deterministic, decoupled from coins, guarantees progress). Shift length by `starting_level`: tier 1 → ~6 tasks, tier 2 → ~9 (FR-006's 5–7 / 8–10 bands).

4. **Results → big celebration, then persist, then back to start.** The results view shows coins + stars (FR-008's "bigger celebration at shift end" lives here, vs the subtle per-task ack). **No shop art** (S-05). Persistence happens once at shift end via a `POST /api/shifts/complete` route mirroring `profiles/create.ts`. The start screen then surfaces the running coin balance (resolving its own "no coins/level UI — those are S-04" comment).

**Scope guards confirmed:** network-loss / FR-016 is **S-08** (`network-loss-handling`, already scaffolded, depends on S-04) — S-04 must NOT handle it, only provide the shift loop + shift-end write S-08 will later guard. Mid-shift state is never persisted (FR-016); resume is from last shift-END only.

## Detailed Findings

### Area 1 — Persistence & RLS (the high-risk new layer)

**Recommendation: ADD COLUMNS to `child_profiles`** (option a), not a new table.

- The four policies in `20260609120000_child_profiles_isolation.sql:78-101` predicate purely on `auth.uid() = account_id` — **column-agnostic**, so they cover any new column. Proof: `20260628120000_child_profiles_add_identity.sql:6-9` added `name`/`age`/`starting_level` and states "RLS is already ENABLED … policies that cover ALL columns, so no policy changes are needed here."
- Gameplay state is **1:1 with a profile** and shares the `account_id` boundary — no cardinality demands a separate table. The F-01 migration anticipated this (`...isolation.sql:48-49`: "gameplay state (coins, level, shift count, shop state) is added later by S-04 under this same isolation contract"); echoed in `contract-surfaces.md:15`.

**Migration skeleton** (new `supabase/migrations/2026…_child_profiles_add_gameplay_state.sql`):
```sql
alter table public.child_profiles
  add column coins                 integer  not null default 0,
  add column completed_shift_count integer  not null default 0,
  add column business_level        smallint not null default 1,
  add column shop_state            jsonb    not null default '{}'::jsonb;   -- reserved for S-05
alter table public.child_profiles
  add constraint child_profiles_coins_nonneg                 check (coins >= 0),
  add constraint child_profiles_completed_shift_count_nonneg check (completed_shift_count >= 0),
  add constraint child_profiles_business_level_min           check (business_level >= 1);
```
- **No `set_updated_at()` redefine, no new trigger** — `child_profiles_set_updated_at` (`...isolation.sql:68-71`) already fires on every UPDATE, so coin writes stamp `updated_at` automatically.
- Defaults make it safe with no backfill (pre-launch, no production rows — mirrors `...add_identity.sql:17-19`).
- **`business_level` ≠ `starting_level`**: `starting_level` is the frozen creation-time difficulty band (`leveling.ts:7-9`, 6–7→1 / 8–9→2) feeding `tierForLevel`; `business_level` is the live progression counter (FR-011's "level tracked internally", the thing S-05 maps to shop art). Keep both.

**Isolation test impact: no new test required.** Same row, same four policies → `tests/child-profiles-isolation.test.ts` already proves isolation for the new columns. **Optional low-cost hardening:** extend the UPDATE-isolation test (`child-profiles-isolation.test.ts:90-109`) to assert B's bump of A's `coins` affects 0 rows and A's `coins` is unchanged, and add the new fields to the `ChildProfileRow` interface (`:26-36`). (A *new table* would instead mandate a full new isolation test with the L-002 no-chained-`.select()` INSERT-on-behalf assertion.)

**`contract-surfaces.md` edit:** update the Columns line of the existing `## public.child_profiles` entry (`:15`) — append the four columns + the `business_level` vs `starting_level` note + check constraints; add the new migration to **Defined in** (`:13`). No new H2; no change to `## set_updated_at()`.

**Write path** (mirrors `profiles/create.ts`):
- Service `recordShiftResult(client, profileId, {coinsEarned, businessLevel})` in `src/lib/services/child-profiles.ts` — read current totals AS the parent (RLS-scoped), then UPDATE by `id` (the `child_profiles_update_own` `using` clause gates ownership; a non-owner update silently affects 0 rows). **Never filter by a client-supplied `account_id`; never put `account_id` in the zod schema** (L-002).
- Route `src/pages/api/shifts/complete.ts` — `export const prerender = false`, `supabase.auth.getUser()` (no user → `/auth/signin`), zod `safeParse` of form fields, `applyNoStore(context.redirect(...))` on every exit. Extend the `ChildProfile` interface (`child-profiles.ts:22-32`) with the four fields.
- Route test `tests/shifts-complete.test.ts` mirroring `profiles-create.test.ts` — drive the real route with a minted session; **the key L-002 test:** account B drives the route with a `profileId` owned by A, assert via the service-role `admin` client that A's `coins`/`completed_shift_count` are unchanged.

**Read path:** `getMostRecentProfile` already does `select("*")` (`child-profiles.ts:62-64`) → new columns return automatically once the interface is extended. Surface them on the start screen at `start.astro:43-57` (the greeting/HUD area the `:16` comment flags as deferred to S-04).

**Silent-data-leak flags:** (1) reach the row by `id`, let RLS gate ownership — never trust a client `account_id`; (2) never write the new columns with the service-role/admin client in app code (RLS bypass) — admin is tests-only; (3) `applyNoStore` on every redirect from the new route (cached redirect on an authed session = cross-account leak); (4) if you ever add a `shifts` ledger table instead, its 4 policies + isolation test ship in the *same* migration.

### Area 2 — Shift loop & shared-core generalization

**The one shared-core change:** add an optional `onComplete` to `useCoinTask` defaulting to the current redirect:
```ts
onComplete = () => { window.location.href = "/app/start"; }
// the effect (useCoinTask.ts:31-39) fires window.setTimeout(onComplete, 1400)
```
Forward an optional `onComplete` prop through `TaskScreen.tsx:7-18,27` and the two adapters. **Standalone callers pass nothing → S-02/S-03 unchanged.** Surface accuracy by extending the callback to `onComplete?(outcome: { firstTry: boolean })` — the hook already tracks `misses` (`useCoinTask.ts:25,52`); emit `misses === 0` at success.

**Per-task `key`:** in the shift, render `<CountingTask key={index} … />` / `<ChangeMakingTask key={index} … />` so advancing unmounts the old `TaskScreen`/hook and mounts a fresh one — **no internal reset logic needed**, the hook stays untouched beyond the `onComplete` param.

**New `ShiftScreen` island** (`src/components/child/ShiftScreen.tsx`) — the orchestrator:
- `ShiftState { tasks: Task[]; index: number; results: { firstTry: boolean }[]; phase: "playing" | "results" }`; tasks generated once (lazy `useState`/`useMemo`).
- Dispatches the current task to the existing adapters by `task.type` (same branch shape as `task.astro:43-49` today).
- `onComplete` advances the cursor; when exhausted → `phase: "results"`.
- **Auto-advance** on the existing 1400ms success beat (no extra "tap to continue") — matches NFR "advancing to the next task feels immediate" (`prd-v2.md:148`). Per-task retry/hint/success keep working unchanged inside each freshly-keyed `TaskScreen`.

**Page shape:** **replace the content of `/app/task`** (don't add a route). `StartShiftButton.tsx:15` already targets `/app/task`; it's already gated (`middleware.ts:5`). Keep the SSR scaffold (profile load + `/app` fallback + world); generate the shift **inside the island** (pass `{ startingLevel, world, profileId }`) so the list stays client-side (it's discarded on a blip anyway — FR-016). Replace the single-task mount with `<ShiftScreen client:load … />`.

**Mid-shift not persisted (FR-016):** the shift runs entirely client-side; POST only once at shift end. Do NOT make the SSR loader persist or resume mid-shift — resume is from last shift-END only (`prd-v2.md:82,141`). Network-loss handling itself is **S-08**, not S-04.

### Area 3 — Scoring (defaults to ship, then iterate)

Put all of this in a new pure module `src/data/shift.ts` (client-safe, injectable RNG — mirrors `leveling.ts`/`counting-tasks.ts`) with named constants for one-line tuning.

**Coins (FR-010 — paid once at shift end, reflects accuracy + length):**
```
payout = 5 * tasksCompleted + 3 * cleanTasks   // cleanTasks = tasks with 0 misses
```
Floor is `5 * tasks` (never zero — no-punishment guardrail, `prd-v2.md:50`). Two-digit, ÷5-legible numbers (matches mockup "126 zł"). Examples: 5-task perfect = 40; 5-task sloppy(1 clean) = 28; 9-task perfect = 72.

**Stars 0–3 by clean-task rate** = `cleanTasks / tasksCompleted` (length-normalized so a 9-task shift isn't punished vs a 5-task one):
| Stars | Clean-task rate |
|---|---|
| 3 | 100% (perfect — the Success-Criteria target, `prd-v2.md:46`) |
| 2 | ≥ 70% |
| 1 | ≥ 40% |
| 0 | < 40% (still finishes; warm "you opened the shop!" copy, never "game over") |

3★ = a fully clean shift, hittable within 5 shifts for a typical child (tier-1 short shifts use small counts 3–10 / change ≤5) — the PRD's calibration signal.

**Business level (the roadmap's open question):**
```
business_level = 1 + floor(completed_shifts / 3)   // level up every 3 completed shifts
```
Shift-count threshold (not coins): deterministic, decoupled from the tunable coin formula, guarantees steady progress regardless of accuracy (on-pedagogy with no-punishment). Persist `completed_shift_count` (needed anyway); `business_level` can be stored or derived — **store it** so S-05 reads it directly. Surface as a small "level up!" text only when it increments — **no shop art** (S-05).

**Shift length adaptivity (FR-006)** off `starting_level`:
| `starting_level` | length | mix |
|---|---|---|
| 1 (ages 6–7) | ~6 (5–7) | counting-leaning (~⅔ counting) |
| 2 (ages 8–9) | ~9 (8–10) | ~½/½ |
Loop `generateTask(starting_level)`; shuffle the type sequence so it's not all-counting-then-all-change. Consider forcing ≥1 of each type via the injectable `pickType`.

### Area 4 — Results screen

**Must show (GROUNDED):** total coins earned this shift + stars 0–3 (US-02 AC `prd-v2.md:80`, FR-011 `:124`); the **big celebration** (FR-008 `:113` — fanfare belongs here, not per-task); warm even at 0 stars (no red/buzzer/game-over, `:50`); then return to `/app/start` with persisted state (`:81`). **No shop art in S-04** (S-05).

**Two viable shapes (decide in planning):**
- **(A) Results as a client phase inside `ShiftScreen`** — when tasks exhaust, render results inline (coins/stars already known client-side), POST to persist, CTA → `/app/start`. Fewer pages, immediate celebration, no extra SSR round-trip. *(Lean.)*
- **(B) A new `/app/results.astro` SSR page** — the island POSTs then navigates to `/app/results`, which re-reads the just-persisted state and renders it. More faithful to "persist → read back" but adds a page + round-trip.

**Coins authority (decide in planning):** prefer the **server recomputes coins** from `{ taskCount, cleanCount }` sent by the client (import the pure `coinsForShift` into the route) → tamper-resistant; vs the client sending `coinsEarned` (cap it in zod). Coins are in-world only (no monetization), so stakes are low, but server-authoritative is cleaner.

**New `pl.ts` `results:` namespace** (sibling of `task`, per L-003): `heading`, `coinsLabel` ("Zarobiłeś {coins} monet!" — use the `Intl.PluralRules("pl")` `charsNeeded` pattern at `index.ts:14-27` for moneta/monety/monet), `starsLabel`, per-star copy (3→"Idealna zmiana!", 0→warm), `levelUp` ("Twój sklep rośnie!" — text only), `backToStart`. Draft Polish, pending native-speaker review.

## Code References

- `supabase/migrations/20260609120000_child_profiles_isolation.sql:48-49,68-101` — F-01 RLS template + the "gameplay state is S-04" flag + reused trigger
- `supabase/migrations/20260628120000_child_profiles_add_identity.sql:6-9,22-25` — precedent for extending `child_profiles` with no policy changes
- `docs/reference/{rls-isolation.md,rls-template.sql,contract-surfaces.md}` — the contract, skeleton, registry
- `tests/child-profiles-isolation.test.ts:26-36,90-109,130-152` — isolation test (interface to extend; UPDATE-isolation to harden; L-002 INSERT-on-behalf)
- `src/lib/services/child-profiles.ts:22-32,34-43,62-65` — `ChildProfile` interface, `createChildProfile`, `getMostRecentProfile` (read path)
- `src/pages/api/profiles/create.ts:10,19-24,32-37,39-63` — route template (prerender, zod, session-derived account_id, applyNoStore)
- `tests/profiles-create.test.ts:17-28,57-100` — route test pattern + the spoof/L-002 test
- `src/components/hooks/useCoinTask.ts:25,31-39,52` — the redirect seam + the `misses` counter (accuracy raw material)
- `src/components/child/TaskScreen.tsx:7-18,27` — where to forward `onComplete`
- `src/components/child/{CountingTask,ChangeMakingTask}.tsx` — adapters to forward `onComplete`
- `src/data/tasks.ts:15,23` — `generateTask` + `defaultPickType` (shift composes these)
- `src/data/counting-tasks.ts:26` — `tierForLevel` (drives shift length)
- `src/pages/app/task.astro:18-25,43-49` — the SSR scaffold to keep + the mount tail to replace
- `src/pages/app/start.astro:16,43-57` — where coins/level surface (the "S-04" comment)
- `src/data/leveling.ts:7-9` — `deriveStartingLevel` (starting_level is the band, not progression)
- `src/styles/global.css:22` — `--accent` gold coin token; `public/illustrations/coin-stack.png` (unused, for the payout visual)

## Architecture Insights

- **The contract's third reuse is nearly free on the client.** S-02 built the task island; S-03 generalized it into `useCoinTask`/`CoinBoard`/`TaskScreen` + a `Task` union + `generateTask`; S-04 needs only `onComplete` + per-task `key` to compose them into a shift. The genuinely new client code is the `ShiftScreen` orchestrator, the results view, and the pure `shift.ts` math.
- **Persistence is the real weight — and the project's highest-risk invariant.** S-04 is "the second test of whether the isolation pattern propagates" (roadmap S-04 Risk). Extending `child_profiles` keeps that risk minimal (no new policies, existing test authoritative), which is why it's strongly preferred over a new table.
- **Two level concepts must stay orthogonal.** `starting_level` (difficulty band, frozen) vs `business_level` (progression, mutable). This is the single most important data-model decision in the slice.
- **Plannable split (roadmap-flagged):** "shift loop + persistence" then "results screen" — but the user-visible outcome is one capability (a complete shift), so `/10x-plan` should weigh the split against vertical-first. A natural phase boundary: (1) persistence migration + service + route + isolation hardening; (2) shift loop + `onComplete` generalization; (3) scoring + results + start-screen HUD.

## Historical Context (from prior changes)

- `context/archive/2026-06-29-counting-task-in-business-context/research.md:84,94` — the persistence recipe was pre-written **for S-04** (L-001 same-migration four-policy; L-002 isolation via service-role; coins once at shift end FR-010); S-02 established the `Task` contract S-04 inherits.
- `context/archive/2026-06-29-change-making-task-in-business-context/plan.md:7,237` — "Persistence: None (stateless) — Coins/level/results are S-04 by design"; generalized the contract into `useCoinTask`/`CoinBoard`/`TaskScreen` + polymorphic `/app/task`.
- `context/archive/2026-06-28-first-child-profile-and-start-screen/` — D1 PII override (name/age on `child_profiles` as RLS-isolated PII); `starting_level` stored "for S-04 to consume"; coins/level UI + gameplay columns explicitly deferred to S-04.
- `context/foundation/lessons.md` — **L-001** (four-policy RLS same migration), **L-002** (verify durable state via service-role, not chained `.select()`), **L-003** (no inline i18n literals). All three in force (S-04 persists).
- `context/changes/network-loss-handling/` — **S-08**, `status: preparing`, depends on S-04. FR-016 / mid-shift network-loss is **its** slice, not S-04's. S-04 only provides the shift loop + shift-end write S-08 guards.

## Related Research

- `context/archive/2026-06-29-counting-task-in-business-context/research.md` — the task contract baseline + the S-04 persistence recipe.
- `context/changes/network-loss-handling/research.md` — S-08's FR-016 research (the downstream guard on S-04's shift-end write).

## Open Questions (resolve in /10x-plan)

1. **Results screen: client phase (A) vs `/app/results` SSR page (B).** Lean A (fewer pages, immediate celebration; the start screen already re-reads persisted state on next visit).
2. **Coin authority: server recomputes from `{taskCount, cleanCount}` vs client sends `coinsEarned` (zod-capped).** Lean server-recompute (tamper-resistant; pure formula is client-safe and importable into the route).
3. **`business_level`: stored vs derived from `completed_shift_count`.** Lean stored (S-05 reads it directly).
4. **Exact coin/star/length constants** — ship the proposed defaults (5/3 coins; 100/70/40% stars; level every 3 shifts; 6/9 task lengths) as named constants; tune after kid-testing. Non-blocking.
5. **Phase split** — whether to plan S-04 as one slice or split (persistence → shift loop → results). Decide at plan time; vertical-first leans toward one slice with internal phases.
6. **Polish copy** — all new `results:` copy is draft pending native-speaker review (carry-forward from S-02/S-03).
