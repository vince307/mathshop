---
date: 2026-08-22T18:29:19Z
researcher: Claude (autonomous run 2026-08-22-autonomous-five, F4 research step)
git_commit: 22ddebd9e20bad4ed23613cbfa2fcbd69cd8c7b5
branch: feat/ui-polish
repository: 10xDevs
topic: "How the shop's growth works today, what named stages would replace, and the smallest safe migration that records per-shift earnings"
tags: [research, codebase, world-progression-stages, shift-log, business-level, migration, rls, shop-art, artwork]
status: complete
last_updated: 2026-08-22
last_updated_by: Claude (F4 research step)
---

# Research: world-progression-stages (F4)

**Date**: 2026-08-22T18:29:19Z
**Researcher**: Claude — autonomous run `context/runs/2026-08-22-autonomous-five/`, F4 research step
**Git Commit**: `22ddebd9e20bad4ed23613cbfa2fcbd69cd8c7b5`
**Branch**: `feat/ui-polish`
**Repository**: `10xDevs`

## Research Question

How does the shop's growth actually work today, what would named stages replace, and what is the
smallest safe migration that records per-shift earnings without disturbing shift completion?

---

## Autonomous decisions

Per the standing brief (`context/runs/2026-08-22-autonomous-five/agent-contract.md` §Hard rules 1),
`AskUserQuestion` was never called. The skill's two interactive gates were decided instead:

- **The research question was supplied, not asked.** It is the question printed above, taken from the
  orchestrator's brief. Rejected alternative: a narrower "how do I add a stage catalogue" question —
  rejected because the migration half of this change (an earnings column on `shift_log`) touches the
  write path that pays the child, and a research doc that skipped it would hand the planner a
  migration with no backfill analysis.
- **Scope was set to `deep`** across seven areas (level machinery, `ShopArt`, the earnings write path,
  the migration shape, the stage catalogue as content, the artwork, routing/nav + the test surface).
  Rejected: a "quick overview" pass — rejected because this change writes a Supabase migration and
  edits `recordShiftResult`; a mistake in either is a silent correctness bug in the app's core loop,
  and unwinding a landed migration is far more expensive than one extra research pass.
- **Six parallel sub-agents** were spawned (the skill suggests 2–4) — one per research area, because
  the areas are disjoint file sets and a serialized sweep would not have finished inside the context
  budget. All six were waited for before synthesis.
- **What would change these answers:** if the maintainer decides stages are a pure re-skin of the
  existing decorative milestone path (no new route, no new art), the whole feature collapses to
  `src/pages/app/start.astro` plus a data file, and only §4 (the migration) still needs this depth.

Two further decisions that belong to this document rather than the plan are recorded inline and
flagged **RECOMMENDATION**: the backfill choice (§4.4) and the artwork strategy (§6.4).

---

## Summary

**Nine findings, in the order a planner needs them.**

1. **Growth today is one integer with one writer.** `businessLevelForShifts(n) = 1 + floor(n/3)`
   (`src/data/shift.ts:99-101`) is called from exactly **one** production line —
   `src/lib/services/child-profiles.ts:172` — and written to `child_profiles.business_level` at
   `:180`. Everything else reads the column off a `select("*")`. There is no level name, no stage,
   no lookup table anywhere in the codebase.

2. **The level is uncapped, and it must stay that way.** Verified by exhaustive grep: no
   `Math.min`, no `MAX_LEVEL`, no DB check beyond the floor `business_level >= 1`
   (`supabase/migrations/20260630120000_child_profiles_add_gameplay_state.sql:29`). The start page's
   own comment says so (`src/pages/app/start.astro:46-47`). A finite stage list therefore **cannot**
   be implemented by capping the formula — it must saturate at the presentation layer.

3. **Nothing in the game unlocks above business level 3.** The highest `requiredWorldLevel` in
   `src/data/upgrades.ts` is `3` (`storage`, `customers`). Levels 4+ already unlock nothing; the
   only thing that happens is the number goes up and `t.results.levelUp` ("Twój sklep rośnie!")
   fires. So a 4-stage catalogue is not an artificial ceiling — it matches the game's real content
   depth, and the "stages run out" case is already the status quo dressed differently.

4. **`ShopArt` and stages do not conflict — they are orthogonal by construction.** The base scene is
   a single expression, `world.image` at `src/components/child/ShopArt.tsx:42`; the upgrade layer
   reads only `UPGRADES` + `purchased` + `world.slug` and never touches the base. A stage image can
   replace the base with upgrade icons still compositing on top, and the percent slot coordinates
   keep working as long as stage art keeps the same framing.

5. **The earnings value already exists and is dropped on one line.** `recordShiftResult` computes
   `const earned = earningsForShift(...)` at `src/lib/services/child-profiles.ts:170`, spends it at
   `:178` and returns it at `:189` — but the `appendShiftLog` call at **`:187`** passes only
   `{ accountId, profileId, skills }`. Threading it through costs **~4 lines in one file**. No
   generated Supabase types exist, so nothing needs regenerating.

6. **RLS verdict, stated plainly: the four `shift_log` policies are column-agnostic and a new column
   needs nothing extra.** Evidence in §4.2. Two in-repo precedents did exactly this and documented it.

7. **The backfill is the real decision, and reconstruction is only a lower bound.** `shift_log.skills`
   *looks* like it can rebuild `taskCount`/`cleanCount`, but the route validates the skill delta with
   `<=`, not `=` (`src/pages/api/shifts/complete.ts:56-57`), so a reconstructed `earned` is a
   plausible number, not the paid one. **RECOMMENDATION: nullable, no backfill** (§4.4).

8. **Per-stage artwork exists for zero worlds — not "only for café".** `world-progression-cafe.png`
   is a *single 1536×1024 composite* showing three stages side by side with a baked-in connector
   path; it is a hero illustration *about* progression, not three swappable stage images. The
   theme-neutral state SVGs (`progress-node-*`, `stage-*`) do work for all four worlds. §6.

9. **F1's parent report can take the earnings tile purely additively — but F1 has not landed.**
   `WeeklyReport` is an open interface consumed by property access; ~15 lines across 4 files, zero
   test churn. F1 (`context/changes/parent-weekly-activity-chart/`) is `status: new` with no
   research, no plan, no code. §8.

---

## Detailed Findings

### 1. The level machinery — what a stage catalogue would replace

#### 1.1 The formula and its single writer

`src/data/shift.ts:36-37, 98-101`:

```ts
/** Completed shifts needed to advance one business level. */
export const SHIFTS_PER_LEVEL = 3;
...
/** Business level from completed-shift count: levels up every `SHIFTS_PER_LEVEL` shifts. */
export function businessLevelForShifts(completedShiftCount: number): number {
  return 1 + Math.floor(completedShiftCount / SHIFTS_PER_LEVEL);
}
```

- **Only production import:** `src/lib/services/child-profiles.ts:3`, called at `:172`.
- **`SHIFTS_PER_LEVEL` has no production importer at all** — only `shift.ts` itself and
  `tests/shift.test.ts:7`.
- **Only write:** `src/lib/services/child-profiles.ts:180`, inside the one `child_profiles` UPDATE in
  `recordShiftResult`. `buyUpgrade` reads it (`:232`) and never writes it. `createChildProfile` does
  not set it — the DB default `1` applies.
- **DB:** `supabase/migrations/20260630120000_child_profiles_add_gameplay_state.sql:22` —
  `business_level smallint not null default 1`, with `check (business_level >= 1)` at `:29`.

#### 1.2 Every read / display of the level, with file:line

| Surface | File:line | Copy / i18n key | What it renders |
| --- | --- | --- | --- |
| Shell level badge (start, task, upgrades) | `src/components/app/AppShell.astro:159` | `t.start.levelLabel` → `src/i18n/pl.ts:196` `"Poziom sklepu {level}"` | "Poziom sklepu 4" + star. Wrapped in `hidden sm:block` — invisible below `sm`. |
| Dashboard stat tile | `src/pages/app/start.astro:65` (value), `:142-153` (markup) | `t.start.statLevel` → `pl.ts:207` `"Poziom sklepu"` | Label + bare integer |
| **Dashboard milestone path** | `src/pages/app/start.astro:46-51` (window), `:111-133` (markup) | **none — no i18n key at all** | 5 nodes: `Check` icon (done) / raw `{lvl}` integer (current) / `Lock` icon (locked). Entire block is `aria-hidden="true"`. |
| Upgrade lock chip | `src/components/child/UpgradeShop.tsx:90-95`, rendered `:194-197` | `t.upgradeShop.lockedByLevel` → `pl.ts:314` `"Dostępne od poziomu sklepu {level}"` | The *required* level, not the current one |
| Level-up celebration | `src/components/child/ShiftResults.tsx:63` | `t.results.levelUp` → `pl.ts:340` `"Twój sklep rośnie!"` | **Level-agnostic** — never names the level reached |
| API pass-through | `src/pages/api/shifts/complete.ts:91-96` | — | `{ ok, earned, businessLevel, leveledUp }` |
| Island pass-through | `src/components/child/ShiftScreen.tsx:108, 111` | — | Reads `businessLevel`, feeds `nextUpgrade`, never renders it |
| Astro page props | `start.astro:43,49,65,84`; `upgrades.astro:44,52`; `task.astro:47` | — | `level: profile.business_level` into `AppShell` / islands |

The milestone-path window, verbatim (`src/pages/app/start.astro:46-51`):

```ts
// Milestone path (S-13): a 5-node window around the current business_level
// (levels are uncapped — 1 + shifts/3), read-only from profile data. Decorative;
// the level badge in the shell header already announces the level.
const level = profile?.business_level ?? 1;
const milestoneStart = Math.max(1, level - 2);
const milestones = [0, 1, 2, 3, 4].map((i) => milestoneStart + i);
```

**Surfaces that do NOT show the level:** the parent report (`report.astro`, `WeeklyReport.tsx`,
`reports.ts` — grep for `level` returns nothing), the profile picker, the wizard, and `ShopArt`
(which grows from `purchased`, not from the level).

#### 1.3 What a named-stage catalogue would replace

Concretely, three things and no more:

1. **The decorative 5-node milestone path** (`start.astro:111-133`) — the only "progression"
   visualisation that exists. It is `aria-hidden`, carries no copy, and its window is a sliding
   integer range with no semantics. A stage rail replaces it 1:1 and is the natural home for the
   done/active/locked language the mockup uses.
2. **The bare integer in the stat tile** (`start.astro:65`) — could become "Kawiarnia z ofertą"
   with the level as a subtitle, or stay as-is with the stage shown on the new screen.
3. **Nothing else.** The shell badge, the upgrade lock chips and the `leveledUp` return value are all
   load-bearing for the buy gate and must keep working on the raw integer.

#### 1.4 THE CENTRAL DESIGN TENSION — uncapped levels vs a finite stage list

This is the decision the plan lives or dies on, so it is stated in full.

**The facts.**
- `businessLevelForShifts` is unbounded: `1 + floor(n/3)`, monotonic in `completed_shift_count`,
  with no clamp in code and only a *floor* constraint in the DB. Verified by exhaustive grep for
  `Math.min` / `MAX_LEVEL` / `levelCap` across `src/`, `supabase/`, `tests/`, `e2e/` — every
  `Math.min`/`Math.max` hit clamps something else (shift length, bonus tasks, savings percent, wizard
  step, skill `atMax`, profile count, PIN attempts).
- The mockup shows **exactly four** stages: *Mały stolik → Stoisko → Kawiarnia z ofertą → Popyt i zysk*.
- The upgrade catalogue's highest gate is `requiredWorldLevel: 3`. **Levels 4, 5, 50 unlock nothing.**
- One latent DB ceiling: `business_level` is `smallint`, so Postgres hard-errors at 32767
  (≈98,301 shifts). Nothing anticipates it; it would surface as `json(500, { ok: false })` from
  `src/pages/api/shifts/complete.ts:89`. Not worth fixing in this change — worth knowing it exists.

**Why capping the formula is the wrong answer.** `recordShiftResult:189` returns
`leveledUp: businessLevel > current.business_level`. Cap the formula and `leveledUp` becomes
permanently `false` after the cap, killing the "Twój sklep rośnie!" celebration forever. The level
also feeds `canBuy`'s gate; capping is a gameplay change disguised as a display change. **Do not cap
`businessLevelForShifts`.**

**What must keep working when stages run out but shifts keep coming:**
- `businessLevelForShifts` keeps climbing; `business_level` keeps being written; `leveledUp` keeps
  firing; the shell badge keeps showing "Poziom sklepu 17".
- The stage resolver **saturates**: `stageForLevel(17)` returns the last stage. The precedent for
  this exact shape is `skillProgress` in `src/data/skills.ts:103-110`, which returns
  `{ level, fraction: 1, atMax: true }` at the top of the ladder — copy it.
- The progression screen must render the last stage as *current* with **no phantom locked node
  after it**, and must not render a "next stage" progress bar that can never fill.
- **Open copy question the planner must settle:** past the last stage, every third shift still fires
  `t.results.levelUp` ("Twój sklep rośnie!") while the picture no longer changes. Either accept it
  (the level genuinely did rise), or gate the celebration on a *stage* change. Silence here means a
  child at stage 4 is told their shop is growing while nothing grows.

**Keying options.**

| Option | Shape | Verdict |
| --- | --- | --- |
| **A — threshold on `business_level`** | `STAGES` entries carry `requiredLevel: 1\|2\|3\|4`; `stageForLevel(level)` picks the highest met, saturating | **RECOMMENDED.** Reuses the single existing formula, mirrors `requiredWorldLevel` in `upgrades.ts` exactly, and the level is already in scope on every page that would render a stage. |
| **B — threshold on `completed_shift_count`** | `requiredShifts: 0\|3\|6\|9` | Rejected: creates a *second* ladder that can silently drift from `SHIFTS_PER_LEVEL`. This is precisely the drift the brief warns about. |
| **C — a DB thresholds table** | New table + RLS | Rejected: no precedent (every catalogue in `src/data/` is static), and it would drag an RLS contract into a change that otherwise needs none for content. |

**Anti-drift measure (do not leave this to a comment):** add a unit test asserting that for a range of
`completedShiftCount`, `stageForLevel(businessLevelForShifts(n))` is monotonic non-decreasing and that
every stage's `requiredLevel` is reachable by the formula. A comment saying "keep these in sync" is
not a mechanism; a test is.

---

### 2. `ShopArt` — how the scene is composed, and how stages would combine

`src/components/child/ShopArt.tsx` is 66 lines. Props (`:5-8`):

```tsx
interface ShopArtProps {
  world: World;
  purchased: string[];
}
```

Composition (`:36-66`), the load-bearing parts:

```tsx
const owned = UPGRADES.filter((u) => isOwned(u.id, purchased));
const placed = owned.filter((u) => WORLD_SLOTS[world.slug]?.[u.id] ?? DEFAULT_SLOTS[u.id]);
const unplaced = owned.filter((u) => !(WORLD_SLOTS[world.slug]?.[u.id] ?? DEFAULT_SLOTS[u.id]));
return (
  <div className="relative">
    <img src={world.image} alt={world.name} className="aspect-[4/3] w-full object-contain p-2" />
    {placed.map((u) => ( <span style={...slot} className="... absolute ..."><img src={u.art} alt="" /></span> ))}
    {unplaced.length > 0 && ( <div className="absolute bottom-2 left-2 ...">...</div> )}
  </div>
);
```

- **Base scene:** exactly one expression, `world.image` at `:42`, fed by
  `worldForTheme(profile.theme)` (`src/data/worlds.ts:41-43`). Nothing else in the component reads it.
- **Upgrade layer:** six percent-positioned slots in `DEFAULT_SLOTS` (`:24-25`) — `sign` top-left,
  `shelf` mid-left, `register` mid-right, `slot` bottom-centre, `storage` bottom-left, `customers`
  bottom-right. `WORLD_SLOTS` (`:26`) is the per-world override hook and is **empty today**. Any
  owned upgrade with no slot falls into a wrapped corner row — with today's catalogue that row is
  always empty (all six ids have slots).
- **z-order:** no `z-index` anywhere; the base `<img>` paints first and bubbles paint over it by DOM
  order.
- **A11y:** base `alt={world.name}` (Polish literal from `worlds.ts`, an accepted exception); upgrade
  icons are `alt=""`, so a screen reader learns nothing about what is owned.
- **Responsive:** `w-full` + `aspect-[4/3]` makes percent slots scale; the bubble chrome
  (`size-10`/`size-7`) is fixed at every breakpoint.
- **Call sites (2):** `src/pages/app/start.astro:107` (static, no hydration) and
  `src/components/child/UpgradeShop.tsx:234`.

#### Do stages and upgrades stack, or conflict? — **They stack. They are orthogonal.**

The upgrade layer never reads `world.image`; the base never reads `purchased`. Swapping the base
`src` changes nothing about compositing. Three integration shapes:

| Shape | What changes | Cost | Risk |
| --- | --- | --- | --- |
| **S-1: stages coexist, `ShopArt` untouched** | The new progression screen renders its own stage rail; `ShopArt` keeps `world.image` + upgrade icons on the dashboard | Zero to `ShopArt` | None. **RECOMMENDED given the art situation (§6).** |
| **S-2: stage art replaces the base** | `ShopArtProps` gains `stage` (or `businessLevel` + an internal `stageForLevel`); `:42` becomes `src={stage.art ?? world.image}`; `alt` must name the stage | ~4 lines + a prop at 2 call sites (both already have the level: `start.astro:48`, `UpgradeShop`'s `businessLevel` prop) | Requires per-stage art **per world**, which does not exist (§6). If stage art re-frames the shopfront, `WORLD_SLOTS` needs a second axis (`[slug][stageId][upgradeId]`) or a parallel `STAGE_SLOTS`. |
| **S-3: café-only override** | S-2, but only `kawiarnia` has stage art | Same as S-2 | Three of four worlds visibly degrade. Rejected. |

Whatever is chosen, a stage resolver must be **total and non-throwing**, mirroring `worldForTheme`
— `tests/data-lookups.test.ts` exists specifically to lock "stale stored id → renderable default,
never crash".

**One trap flagged by the sweep:** `nameKey` on `Upgrade` (`src/data/upgrades.ts:20`, set on all six
entries) is **dead** — `upgradeCopy(id)` keys off `id`, and `grep -rn "nameKey" src/ tests/` finds
only the declaration. Do not imitate it in the stage catalogue.

---

### 3. The earnings write path

#### 3.1 Current signatures, verbatim

`src/lib/services/child-profiles.ts:120-137` — `appendShiftLog`:

```ts
/**
 * Append one `shift_log` row (S-07) — the history the parent report reads. Best
 * effort: a log failure must NOT fail an already-persisted shift/purchase (the
 * authoritative profile UPDATE has committed by the time this runs), so its error
 * is swallowed. `account_id` comes from the RLS-verified profile row, never from
 * client input (L-002); the INSERT `with check` policy is the backstop.
 */
async function appendShiftLog(
  client: SupabaseClient,
  entry: { accountId: string; profileId: string; skills: SkillDelta; upgradePurchased?: string },
): Promise<void> {
  await client.from("shift_log").insert({
    account_id: entry.accountId,
    profile_id: entry.profileId,
    skills: entry.skills,
    upgrade_purchased: entry.upgradePurchased ?? null,
  });
}
```

`src/lib/services/child-profiles.ts:139-143, 157-190` — `ShiftResult` + `recordShiftResult`
(the middle elided; the full body is quoted in §1 of the sub-agent sweep and unchanged here):

```ts
export interface ShiftResult {
  earned: number;
  businessLevel: number;
  leveledUp: boolean;
}
...
export async function recordShiftResult(
  client: SupabaseClient,
  profileId: string,
  shift: { taskCount: number; cleanCount: number; skills: SkillDelta },
): Promise<ShiftResult | { error: PostgrestError | Error }> {
```

`src/data/shift.ts:83-86` — `earningsForShift`:

```ts
/** Wallet earnings paid once at shift end (FR-007): base per task + perfect-task bonus. Floor is never zero. */
export function earningsForShift(taskCount: number, cleanCount: number): number {
  return EARN_PER_TASK * taskCount + EARN_PER_CLEAN * cleanCount;
}
```

with `EARN_PER_TASK = 5` (`:33`) and `EARN_PER_CLEAN = 3` (`:35`).

#### 3.2 Exactly where `earned` is dropped

`src/lib/services/child-profiles.ts:184-189`:

```ts
184    if (updateErr) return { error: updateErr };
185
186    // History row for the weekly report — account_id from the RLS-verified row (L-002).
187    await appendShiftLog(client, { accountId: current.account_id, profileId, skills: shift.skills });
188
189    return { earned, businessLevel, leveledUp: businessLevel > current.business_level };
```

`earned` is declared at `:170`, seventeen lines above, in the same block, unshadowed. **Line 187 is
the drop.** `taskCount`, `cleanCount`, `businessLevel` and `newCount` are equally in scope there if
the migration ever wants more than the amount.

#### 3.3 Cost at the call site

**One file, ~4 lines**, all in `src/lib/services/child-profiles.ts`:

1. `:129` — widen the `entry` type with `earned?: number` (optional, so the purchase path is unaffected).
2. `:131-136` — add one key to the insert object.
3. `:187` — add `earned` to the call (value already in scope).
4. `:257-262` (`buyUpgrade`, the other `appendShiftLog` caller) — decide what a purchase row carries.
   A purchase is not a shift; under a nullable column, **omit it** so the row stays `null` (see §4.4).

**Zero type-file edits.** There is **no generated `database.types.ts`** anywhere in the repo, no
`supabase gen types` script in `package.json`, and `createServerClient` is called without a
`<Database>` generic (`src/lib/supabase.ts:25`). Row shapes are hand-written and local:
`src/lib/services/reports.ts:13-16` (read path), `tests/shift-log-isolation.test.ts:21-28`,
`tests/shifts-complete.test.ts:95` (an inline `.overrideTypes<>()`).

**Zero API/route/client edits.** `src/pages/api/shifts/complete.ts` already returns `earned`
(`:93`); it never accepts an amount from the client by design. The island
(`ShiftScreen.tsx:108`) reads only `{ leveledUp, businessLevel }` and recomputes `earned`
client-side at `:80` for the celebration.

#### 3.4 Does best-effort logging change the reliability story? — **Yes, materially. Say so in the copy.**

`appendShiftLog` has **no error handling in code at all**: it is module-private, returns
`Promise<void>`, and never destructures the `insert()` result. supabase-js *resolves* (does not
reject) on a Postgres error, so the `{ error }` is discarded by simply not being read. No try/catch,
no logging, no metric. The only "handling" is the doc comment.

That is correct for its original purpose — a history row for a report must not fail an
already-committed shift. But it changes what the new number means:

- **The wallet is authoritative; the log is not.** `wallet_balance` is updated in the committed
  `child_profiles` UPDATE at `:175-183`, *before* the log write. A shift can pay the child and lose
  its log row, and nothing anywhere notices.
- Therefore `sum(shift_log.earned)` is a **lower bound** on what was actually earned, permanently and
  by design. It can drift below the wallet and never above it.
- **Consequence for the plan:** (a) the parent tile's copy must read as an activity summary
  ("Zarobione w tym tygodniu"), not as an accounting reconciliation, and must never be presented as
  agreeing with the wallet; (b) **do not write an invariant test asserting
  `wallet_balance == sum(earned)`** — it would be flaky by construction; (c) if the planner wants
  reliability instead, that is a *separate* change to shift-completion failure semantics and is out
  of scope here — do not smuggle it in.
- A cheap, non-behavioural improvement worth considering: surface the swallowed error as a
  server-side breadcrumb so a silent log gap is at least observable. Note the codebase has no
  logging convention today, so this is a genuine (small) design decision, not a freebie.

#### 3.5 Related: `shift_log` RLS is account-scoped, not profile-scoped

Surfaced by F2's research and confirmed here: the four policies predicate on
`auth.uid() = account_id` only. **Any query aggregating earnings must filter `profile_id` itself** or
it leaks across sibling profiles inside one account. `getWeeklyReport` already does
(`src/lib/services/reports.ts:110`). Any new query the stage screen adds must too.

---

### 4. The migration shape

#### 4.1 The existing table

`supabase/migrations/20260701150000_create_shift_log.sql:21-30`:

```sql
create table public.shift_log (
  id                uuid        primary key default gen_random_uuid(),
  account_id        uuid        not null references auth.users (id) on delete cascade,
  profile_id        uuid        not null references public.child_profiles (id) on delete cascade,
  created_at        timestamptz not null default now(),
  skills            jsonb       not null,
  upgrade_purchased text        null
);
```

Indexes: `shift_log_account_id_idx (account_id)`, `shift_log_profile_created_idx (profile_id, created_at)`.

#### 4.2 RLS verdict — **the four policies are column-agnostic; a new column needs nothing extra.**

Stated plainly, with evidence, no hedging:

1. **The policy predicates name only the owner column.** All four (`:38-63`) are
   `auth.uid() = account_id` — SELECT `using`, INSERT `with check`, UPDATE `using` + `with check`,
   DELETE `using`. None references `skills`, `upgrade_purchased`, or any column list. Adding a column
   cannot change a predicate that does not mention columns.
2. **Postgres RLS is row-level, full stop.** Policies gate *rows*. The only column-granular access
   control Postgres offers is `GRANT (column)` privileges — and
   `grep -rniE "grant|revoke" supabase/migrations/` finds **no column-level grant anywhere in the
   project**; the sole `grant` is `grant execute on function public.register_pin_failure(...) to authenticated`
   (`20260702120000_pin_failure_throttle_rpc.sql:33`). Table privileges therefore come from Supabase's
   table-level defaults, which a new column inherits automatically.
3. **Two in-repo precedents did exactly this and documented the reasoning.**
   `20260630120000_child_profiles_add_gameplay_state.sql:9-12` and
   `20260701140000_child_profiles_add_skill_state.sql:5-8`, the latter verbatim:
   > "RLS is already ENABLED with four account-scoped per-operation policies that cover ALL columns
   > (auth.uid() = account_id), so NO policy change is needed here (column-agnostic — L-001)"

**What the migration must still do** (obligations, not policies):
- Carry an explicit header comment naming the four covering policies and stating why none was added —
  matching the two precedents above. L-001's spirit is "prove you thought about it in the file".
- Update `docs/reference/contract-surfaces.md:31`, which enumerates `shift_log`'s columns and is the
  registry the contract requires.
- Optionally extend `tests/shift-log-isolation.test.ts`'s local `interface ShiftLogRow` (`:21-28`) to
  include the column. Not required — the test uses `select("*")` through an untyped client, so nothing
  breaks — but it keeps the isolation contract covering the whole row.

#### 4.3 Column type, nullability, default

House style for an additive column is settled (`20260701140000_child_profiles_add_skill_state.sql`):
one `alter table ... add column`, a DB-level guard where sensible, a `comment on column`, and a
`-- Rollback:` line in the header.

- **Type: `integer`.** `earningsForShift` returns `EARN_PER_TASK * taskCount + EARN_PER_CLEAN * cleanCount`
  — integers throughout; there is no fractional currency anywhere in the app (`wallet_balance` is
  `integer`, per `20260630120000:22` and the `coins → wallet_balance` rename migration). Never
  `numeric`, never `money`.
- **Guard:** `check (earned is null or earned >= 0)` under a nullable column, or
  `check (earned >= 0)` under `not null` — matching the `child_profiles_*_nonneg` precedents at
  `20260630120000:27-29` (defence in depth alongside zod).
- **Name:** `earned`. It matches the in-code identifier (`ShiftResult.earned`, the API response field)
  so no mental translation is needed at the boundary.
- **Nullability: see §4.4 — this is the decision, not a detail.**
- **Index:** none needed. The weekly query already rides `shift_log_profile_created_idx`; `earned` is
  a projected/aggregated value, never a predicate.
- **Hard constraint from the test suite:** four existing tests insert `shift_log` rows without an
  `earned` value — `tests/report-isolation.test.ts:43`, `tests/shift-log-isolation.test.ts:55`,
  `tests/account-deletion.test.ts:46`, `tests/profile-deletion.test.ts:53`. A `not null` column
  **with no default** breaks all four. Both nullable and `not null default 0` satisfy them.

#### 4.4 Backfill options for historical rows — **RECOMMENDATION: nullable, no backfill**

**First, the recoverability question the handoff asked, answered precisely.**

`shift_log.skills` holds a per-competency delta `{ math|money|decisions: { firstTryCorrect, completed, misses } }`.
Arithmetically, `taskCount ≈ Σ completed` over `math`+`money` and `cleanCount ≈ Σ firstTryCorrect`, so
one could write:

```sql
-- NOT recommended; shown to be argued against
update public.shift_log set earned = 5 * (math.completed + money.completed)
                                   + 3 * (math.firstTryCorrect + money.firstTryCorrect)
where upgrade_purchased is null;
```

**But it is a lower bound, not the paid amount.** `src/pages/api/shifts/complete.ts:56-57` validates
the delta with `<=`, not `=`:

```ts
  .refine((v) => v.skills.math.completed + v.skills.money.completed <= v.taskCount)
  .refine((v) => v.skills.math.firstTryCorrect + v.skills.money.firstTryCorrect <= v.cleanCount);
```

The *shipped* client sends matching values, but the contract does not require it, so a reconstruction
can be strictly less than what `earningsForShift(taskCount, cleanCount)` actually paid. Two further
leaks: `EARN_PER_TASK` / `EARN_PER_CLEAN` are documented as "first-guess … adjust after kid-testing",
so a backfill run today freezes today's constants onto rows written under whatever constants applied
then; and purchase rows (`upgrade_purchased is not null`) carry only a `decisions` delta and would
reconstruct to `0`, which is *true* (a purchase earned nothing) but conflates "no earnings" with
"not a shift". **Under the run's no-invented-data rule, a reconstructed `earned` is a plausible number,
not a recorded one.**

| Option | Shape | Consequence |
| --- | --- | --- |
| **B-1 — nullable, no backfill** ✅ | `earned integer null` + `check (earned is null or earned >= 0)` | Honest: pre-migration rows say "we don't know". Purchase rows stay `null`, which correctly reads as "not a shift". All four existing insert-without-earned tests pass untouched. Readers need `?? 0` or a null-aware aggregate — one line in one fold. |
| **B-2 — `not null default 0`, no backfill** | `earned integer not null default 0` | Convenient (no null handling; the reader can `sum()` blindly). But every historical shift becomes a **recorded zero-earning shift** — a fabricated number that a parent-facing weekly total would silently include. This is exactly the class of number the run's no-invented-data rule already removed from this app once. |
| **B-3 — `not null default 0` + reconstruct from `skills`** | B-2 plus the SQL above | Looks rigorous, is not: lower-bound-only (see above), freezes tunable constants, and produces numbers no one can later distinguish from recorded ones. Worst failure mode — an invented number that *looks* authoritative. |
| **B-4 — nullable + reconstruct** | B-1 plus the SQL | Combines B-1's null handling with B-3's invented values. No upside. |

**RECOMMENDATION: B-1 — `earned integer null`, no backfill.**

Reasoning:
1. The number's only consumer is a **weekly** window (`startOfWeek`, `src/lib/services/reports.ts:75-92`)
   plus the child's own current-growth screen. Within seven days of the migration every row in any
   displayed window carries a real value, so B-1's null window is transient and small — while B-2's
   fabricated zeros are permanent and indistinguishable from truth forever.
2. `null` is the only value that tells the truth about a purchase row. Under B-2 a purchase row claims
   "a shift happened and earned 0 zł".
3. The convenience argument for B-2 (tests insert without the column) is satisfied equally by B-1.
4. It matches how the codebase already treats unknown persisted state elsewhere — `readSkillState`
   /`readPurchased` normalize *missing* data at read time rather than fabricating it at write time.

**The residual honesty problem B-1 does not solve, which the planner must still answer:** during the
first week after the migration, a weekly window can contain both real and `null` rows, and `?? 0`
would under-report without saying so. Two acceptable resolutions:
- **(i) Suppress, don't lie** — if any row in the window has `earned is null`, do not render the tile
  at all. Strictly honest, costs one extra boolean in the aggregate, and self-heals within a week.
  Consistent with how F1 was told to handle the tile's absence ("do not leave a placeholder or a zero").
- **(ii) Sum with `?? 0` and accept a one-week undercount.** Simpler, but it renders a number that is
  quietly wrong for up to seven days.

**Recommend (i).** Whichever is chosen, it belongs in the tile's owner (F1 or the follow-up), not in
the migration — see §8.

**What would change the B-1 recommendation:** if the maintainer states that pre-launch rows have no
value at all and the local DB will be reset before any real user exists (the precedent language
"Pre-launch: no production rows, so the NOT NULL column is added directly with a safe default (no
backfill)" appears verbatim in both prior ADD COLUMN migrations), then `not null default 0` becomes
defensible — the fabricated zeros would only ever describe rows nobody will see. That is a
maintainer call about the deployment state, not a technical one, and it is the single input that
flips this.

---

### 5. The stage catalogue as content

#### 5.1 What a stage needs

From the mockups (§7): `id`, a display **name**, a **short Polish line** (mobile shows one per stage;
web shows names only), a **threshold**, **art**, and an implicit **order**.

#### 5.2 House style — imitate `upgrades.ts` for structure, `skills.ts` for the ladder, `pl.ts` for copy

`src/data/upgrades.ts:15-41` is the model row type; `:46-76` the entries; `:107-113` the lookups:

```ts
/** Valid upgrade ids — the closed set for app-layer (zod) validation. */
export const UPGRADE_IDS = UPGRADES.map((u) => u.id) as [string, ...string[]];

const BY_ID = new Map(UPGRADES.map((u) => [u.id, u] as const));

export function getUpgrade(id: string): Upgrade | undefined {
  return BY_ID.get(id);
}
```

Conventions the new catalogue must follow, all verified across `src/data/`:

- **Typing:** an exported `interface`, then `export const STAGES: readonly Stage[] = [ ... ] as const;`.
  There is **no `satisfies` anywhere in `src/data/`** — annotate-then-`as const` is the house pattern
  (`upgrades.ts:46`, `worlds.ts:26`, `avatars.ts:26`, `skills.ts:16,31`).
- **Ids:** plain `id: string` on the interface; the closed set is materialized at runtime as a
  zod-ready tuple (`STAGE_IDS = STAGES.map(s => s.id) as [string, ...string[]]`), mirroring
  `UPGRADE_IDS` / `WORLD_SLUGS` / avatar ids. No string-literal union, no branded type.
- **Art:** an absolute `public/`-rooted path string on the row —
  `art: "/illustrations/stage-....webp"`, documented as "Committed art path (served raw from `public/`)".
  No imports, no `astro:assets`.
- **Purity:** `src/data/*` imports only types and sibling `src/data/*` — no React, Astro or Supabase.
  The header comment must say so; that purity is what lets the same module serve the island and the
  server.
- **Total resolvers:** every "resolve a persisted value" path has a non-throwing fallback
  (`worldForTheme` → `DEFAULT_WORLD`; `readPurchased` → `[]`). `stageForLevel(level)` must be total
  and saturating.
- **Threshold ladder:** copy `src/data/skills.ts:31-37` + `:96-110` — a monotonic threshold array, a
  derive-the-rung function, and a `{ level, fraction, atMax }` progress shape if the screen wants a
  "how far to the next stage" bar.
- **Doc comment:** every `src/data/` file opens with a block naming the slice, the FR it implements,
  and marking tunables "first-guess … adjust after kid-testing". Match it.

#### 5.3 Copy goes in `src/i18n/pl.ts`, keyed by stage id — not in the data file

There is a real fork in house style here and the planner must pick the right side.
`worlds.ts:14` and `avatars.ts` hold Polish `name`/`alt` **in the data file** (avatars justifies it:
the strings "pair with a specific image asset"). `upgrades.ts` does **not** — it carries no literal
Polish and cites L-003 inline at `:20`.

**Follow `upgrades.ts`.** It is the newer pattern, it is the one `tests/i18n-helpers.test.ts` locks,
and L-003 is an accepted lesson. The exact shape to copy, `src/i18n/pl.ts:266-275`:

```ts
  // Upgrade catalog names (S-06). Keyed by upgrade id (`t.upgrades[id]`), so the
  // catalog (src/data/upgrades.ts) carries no literal copy (L-003). Draft Polish —
  // pending native-speaker review.
  upgrades: {
    sign: { name: "Szyld", desc: "Nowy szyld przyciąga wzrok." },
    ...
  },
```

with its guarded accessor, `src/i18n/index.ts:29-35`:

```ts
export function upgradeCopy(id: string): { name: string; desc: string } {
  return (t.upgrades as Record<string, { name: string; desc: string }>)[id] ?? { name: id, desc: "" };
}
```

So: a `stages: { <id>: { name, desc } }` record in `pl.ts`, a `stageCopy(id)` sibling in
`src/i18n/index.ts` with the same raw-id fallback, and one new `describe` in
`tests/i18n-helpers.test.ts` mirroring the existing "every real catalog id resolves to non-empty
copy / a ghost id never throws" pair.

(A weaker precedent exists for a *numeric*-keyed record: `profileWizard.levelNames`
`{ "1": "Podstawy", "2": "Podstawy plus", "3": "Podstawy ekstra" }` at `pl.ts:167`, consumed with a
manual saturating index at `CreateProfileWizard.tsx:90` — `level >= 3 ? "3" : ...`. It is the only
existing level→name mapping in the app and it is structurally unable to grow. **Do not copy it**;
it is a cautionary example of exactly the saturation problem §1.4 describes, hard-coded.)

#### 5.4 How thresholds relate to `businessLevelForShifts` — and how to stop them drifting

Recommended mapping, matching the mockup's four stages against the game's real content depth
(no upgrade gate exceeds level 3):

| Stage | id (suggested) | Name (mockup) | `requiredLevel` | Reached after |
| --- | --- | --- | --- | --- |
| 1 | `stolik` | Mały stolik | 1 | 0 shifts (start) |
| 2 | `stoisko` | Stoisko | 2 | 3 shifts |
| 3 | `kawiarnia` | Kawiarnia z ofertą | 3 | 6 shifts |
| 4 | `popyt` | Popyt i zysk | 4 | 9 shifts — **terminal** |

Anti-drift mechanics, in order of strength:
1. **Express thresholds in the level domain**, not the shift domain, so `SHIFTS_PER_LEVEL` remains
   the single tuning knob. Change `SHIFTS_PER_LEVEL` and the stages re-space automatically.
2. **Add the monotonicity test** described in §1.4 — the mechanism, not a comment.
3. **Assert the terminal stage saturates**: `stageForLevel(999)` returns the last stage and
   `atMax === true`.
4. Keep the stage `requiredLevel` values aligned with `requiredWorldLevel` in `upgrades.ts` so the
   mockup's "Odblokowane w tym poziomie" panel can be built from the upgrade catalogue by filtering
   `requiredWorldLevel === stage.requiredLevel` — no second source of truth for what a stage unlocks.

---

### 6. The artwork

#### 6.1 Directory-name correction — confirmed, and one inherited claim is now itself stale

- `assets/atomic-assets-v3/` **exists**; `assets/atomic-assets-v3-progression/` does **not**. Its
  `README.md` is titled "Atomic assets v3 - progression", which is where the confusion came from.
- **The handoff's claim that `public/illustrations/slice-map.md` cites the stale path is no longer
  true.** Commit `64e3373` ("docs(assets): point the asset paths at directories that exist") already
  fixed it; the file's only two `atomic-assets` mentions (lines 23, 27) are the correct
  `assets/atomic-assets-v3/svg/icons/`. **There is nothing to clean up there.** The stale
  `-progression` name survives in seven doc locations, only one of them live:
  `context/foundation/shape-notes.md:33` and `:275` (the rest are under `context/archive/`).
- A *different* staleness in slice-map.md is real and worth a line: its crop table still lists
  `world-*.png` outputs with crop boxes from the login mockup, but the repo now ships `world-*.webp`
  at 896×718 derived from `atomic-assets-v2/png/worlds/` (commits `3fd4714`, `e777572`). Those four
  rows document a provenance that no longer reproduces any shipped file. Only `coin.png` /
  `coin-stack.png` in that table are still accurate.

#### 6.2 What exists, exactly

`assets/atomic-assets-v3/png/illustrations/` (7 files, alpha cutouts):
`world-progression-cafe.png` **1536×1024**, `cafe-dashboard-hero.png`, `mission-result-receipt.png`,
`parent-report-progress.png`, `pricing-inventory.png`, `product-muffin-unlock.png`,
`upgrade-shelf.png` (all 1402×1122 except the muffin at 1448×1086).

`assets/atomic-assets-v3/svg/ui-symbols/` (6): **`progress-node-done.svg`** (green `#39c66a` circle +
white check), **`progress-node-active.svg`** (pale halo + blue `#1f7aec` core),
**`progress-node-locked.svg`** (grey circle + `#73839a` padlock) — all `viewBox="0 0 40 40"`,
`role="img" aria-hidden="true"`, hardcoded hex fills. Plus `coin-chip`, `requirement-chip`, `unlock-badge`.

`assets/atomic-assets-v3/svg/icons/` also carries a **larger-scale alternative** of the same three
states — `stage-done.svg`, `stage-active.svg`, `stage-locked.svg` at `viewBox="0 0 64 64"` with more
detail — plus `world-progress.svg` (a 3-node ascending path glyph, a natural nav icon).

Manifest entry for the one progression illustration, verbatim:

```json
{
  "id": "world-progression-cafe",
  "path": "png/illustrations/world-progression-cafe.png",
  "sourceKey": "png/source-key/world-progression-cafe-key.png",
  "role": "world progression hero",
  "recommendedUse": "world progression screen, stage path hero, empty state"
}
```

The progress-node SVGs appear in `manifest.json` only as bare path strings under `svg.uiSymbols` —
**no per-asset usage or dimension metadata**. `quality-manifest.json` sets the pack verdict to
`production-candidate-draft`, marks `png/source-key/*` as `doNotShip`, notes PNGs should be converted
to WebP/AVIF at integration, and warns that "SVG icons are clean UI drafts; final production polish
may still adjust stroke widths and color tokens."

The README's rules matter for this screen specifically: **use SVG for stage states, requirement states
and badges; use PNG for rich hero illustrations; and build cards, buttons, progress bars and
connector lines in code, never as images** ("those elements need to remain responsive and themeable").

#### 6.3 The world-coverage problem — worse than "only café"

The app has four worlds (`src/data/worlds.ts`): `kawiarnia` (default), `piekarnia`,
`galaktyczna-baza`, `sklep-ksiegarnia`.

| World | v3 progression art | v2 world card | v2 world icon | ships today in `public/` |
| --- | --- | --- | --- | --- |
| `kawiarnia` | `world-progression-cafe.png` (composite) | `cafe-world.png` | `world-cafe.svg` | `world-kawiarnia.webp` |
| `piekarnia` | **none** | `bakery-world.png` | `world-bakery.svg` | `world-piekarnia.webp` |
| `galaktyczna-baza` | **none** | `space-base-world.png` | `world-space.svg` | `world-galaktyczna-baza.webp` |
| `sklep-ksiegarnia` | **none** | `collector-shop-world.png` | `world-collector.svg` | `world-sklep-ksiegarnia.webp` |

**And the café's one asset is not per-stage art.** Opened and inspected: `world-progression-cafe.png`
is a single 1536×1024 alpha PNG depicting all three growth stages *side by side in one scene* — a bare
table+chair on a podium with a floating green check, a small market stall, and a full shop façade —
plus a growth arrow, coin stacks, and a **baked-in connector path with green/yellow/blue stage pucks**
along the bottom. It is a hero illustration *about* progression, not three swappable images. The
podiums have clear horizontal gaps so cropping into three is feasible, but that is new asset work,
it yields three of four stages, and the baked-in connector duplicates the path the README explicitly
says to build in code.

**So: per-stage world artwork exists for zero worlds.** What *is* world-agnostic and immediately
usable for all four: the `progress-node-{done,active,locked}` / `stage-{done,active,locked}` SVGs and
`world-progress.svg`. This is not a detail — shipping stages that only look right in `kawiarnia`
would degrade three of four worlds, and `kawiarnia` is merely the *default*, not the only choice.

`public/illustrations/` today (13 flat files): four `world-*.webp` @ 896×718, six `upgrade-*.svg`,
`coin.png` (82×82), `coin-stack.png` (136×136), `slice-map.md`. **No progress nodes, no stage art,
no `world-progression-cafe` ship today** — everything the new screen needs must be copied/cropped in
and registered, because `assets/` is gitignored and invisible to CI and Vercel.

#### 6.4 Artwork options — **RECOMMENDATION: ART-C for v1**

| Option | What ships | Cost | Consequence |
| --- | --- | --- | --- |
| **ART-A** — crop 4 stage thumbnails from `assets/matmaverse-missing-screens-v3-web/01-world-progression-web.png` (1586×992) | Four small WebP crops + 4 slice-map rows | Low; precedented (the crop table exists for exactly this) | Highest mockup fidelity — **but the art is café furniture**, shown to a child in the bakery, space base and bookshop. Uniform and wrong for 3 of 4 worlds. |
| **ART-B** — crop 3 podiums out of `world-progression-cafe.png` | Three alpha crops | Low | Cleaner source, but only 3 of 4 stages, still café-only, and the baked-in connector must be cropped out. |
| **ART-C** ✅ — no per-stage illustration. Stage rows use the theme-neutral `progress-node-{done,active,locked}.svg` (or the existing lucide `Check`/`Lock`, already used by the milestone path) + stage name + one-line Polish; the screen's single hero is the profile's own `world-<slug>.webp` | 3 SVG copies + 3 slice-map rows, or **zero** new assets if lucide is used | Lowest | Correct in all four worlds, honest, ships immediately. **Deviates from the mockup's per-stage thumbnails — log the deviation explicitly.** |
| **ART-D** — ship stages only for `kawiarnia` | — | — | Rejected outright: three worlds get a broken screen. |

**RECOMMENDATION: ART-C**, with ART-A recorded as the upgrade path for when per-world stage art
exists. Rationale: the mockups are binding for *layout and structure*, and ART-C keeps the mockup's
structure exactly (numbered node rail, done/active/locked states, name + line, current-stage
emphasis) while declining to render café furniture as if it were the child's bakery. Rendering the
wrong world's shop to a child is the visual equivalent of the invented-metric problem this run has
already fixed once.

**Registration obligation either way** (standing brief): any new crop lands in `public/illustrations/`
and gets a row in `public/illustrations/slice-map.md`. The two formats, verbatim from that file:

```
Source: `assets/matmaverse-auth-v2-web/01-parent-login-web.png` (1536×1024)

| Output file | Crop box (x0, y0, x1, y1) | What it is |
| --- | --- | --- |
| `world-piekarnia.png` | (28, 616, 196, 814) | Bakery world-card illustration |
```

```
| Output file | Source (`assets/atomic-assets-v3/svg/icons/`) | Upgrade |
| --- | --- | --- |
| `upgrade-sign.svg` | `upgrade-spark.svg` | Szyld (sign / decoration) |
```

Crop table = output filename / crop box `(x0,y0,x1,y1)` in source pixels / description, with the
source file + dimensions stated once above the table. Copy table = output filename / source filename
relative to a stated source dir / what it represents. Generic icons come from `lucide` — never cropped.

---

### 7. The mockups

Both PNGs were opened with the Read tool. Web is 1586×992; mobile 853×1844.

#### 7.1 Web — `assets/matmaverse-missing-screens-v3-web/01-world-progression-web.png`

- **Sidebar** (persistent app shell): Pulpit · Misje · Mój sklep · **Rozwój świata** (active, blue
  pill, bar-chart icon) · Umiejętności · Decyzje · Nagrody · Raporty · Ustawienia, with "Panel rodzica"
  pinned at the bottom. The active entry names this screen: **"Rozwój świata"**.
- **Header:** avatar + "Kawiarnia Ani" + "Poziom 3" + an **XP bar "120 / 200 XP"**; right side a coin
  pill "126 zł", a "Moje osiągnięcia" button and a bell with a badge.
- **Main card:** heading **"Rozwój kawiarni"**, subtitle *"Rozwijaj swoją kawiarnię, odblokowuj nowe
  możliwości i zarabiaj więcej!"* with an info icon.
- **The stage rail (the heart of the screen):** four stages laid out **horizontally**. Each is a
  numbered circle badge above a stage thumbnail with the name beneath:
  - **1 — Mały stolik**: green badge, colour art (table + chair)
  - **2 — Stoisko**: green badge, colour art (awning stall)
  - **3 — Kawiarnia z ofertą**: **blue badge, boxed in a blue-ringed card** = current
  - **4 — Popyt i zysk**: grey badge, **greyscale art with a padlock overlay** = locked
  Beneath the row runs a **connector line** with its own node markers: green ✓ circles under 1 and 2,
  a blue diamond under 3, a grey padlock under 4; the line segment is green up to the current node
  and dashed grey after it.
- **Right of the rail:** a large colour hero illustration of the shop at its current stage.
- **Metric strip** under the rail, four items: "Aktualny poziom 3" · "Zysk dzienny +28 zł" ·
  "Klienci dziennie 11" · "Zadowolenie 92%".
- **Bottom-left card:** "Odblokowane w tym poziomie" — three round icon tiles (Nowe wypieki +15% do
  zysku / Więcej napojów Więcej klientów / Lepsze ceny Wyższa marża) and a "Zobacz wszystkie korzyści ›" link.
- **Bottom-centre card:** "Następne kroki" — three checklist rows with progress counters
  ("Wykonaj 1 misję z reszty 0/1", "Obsłuż 15 klientów 11/15", "Zarób 150 zł 126/150") and a
  "Zobacz wszystkie cele ›" link.
- **Right rail:** "Następne ulepszenie" card (Mała półka, art, cost 80 zł with a 40/80 zł bar,
  "Wymagania: Poziom 3 ✓ / 1 misja z reszty ✓", "Zobacz ulepszenia" CTA) and a "Wskazówka" tip card.

#### 7.2 Mobile — `assets/matmaverse-missing-screens-v3-mobile/01-world-progression-mobile.png`

- **Top bar:** back arrow + small shop glyph + **"Rozwój kawiarni"** + coin pill "126 zł".
- **Profile card:** avatar, "Kawiarnia Ani", a "Poziom 3" chip, the XP bar "120 / 200 XP", and the
  hero illustration bleeding off the right edge.
- **The rail reflows to a vertical timeline** headed **"Etapy rozwoju"**: a left gutter of numbered
  circles joined by a vertical connector (green between completed nodes, grey below the current one),
  each row a card containing a small stage thumbnail, the **name**, a **one-line Polish description**,
  and a right-hand state marker:
  - 1 Mały stolik — *"Pierwsze kroki w kawiarni."* — green ✓
  - 2 Stoisko — *"Pierwsze produkty i klienci."* — green ✓
  - 3 Kawiarnia z ofertą — *"Więcej produktów i większe zyski!"* — blue-ringed card + an **"Aktualnie"** chip
  - 4 Popyt i zysk — *"Odblokuj misje z popytem."* — greyscale thumbnail with a padlock, plus a padlock marker
- Then the "Następne ulepszenie" card (full-width CTA "Zobacz ulepszenia") and a **"Co odblokujesz?"**
  card with three items (Drugi produkt / Misje z zapasów / Planowanie).
- **Bottom tab bar:** Pulpit · Misje · Sklep · Postępy · Więcej.

#### 7.3 How it reflows, and what it means for the build

The web rail is horizontal with **name only**; the mobile rail is a vertical card list that **adds a
one-line description per stage**. The cleanest single implementation is the mobile card list as the
base (it carries strictly more information), switched to a horizontal rail at `lg` — one component,
one accessibility tree, matching the AppShell doctrine of "rendered once, toggled with `display`".
Note the README's rule: **the connector line is built in code, not exported as an image.**

#### 7.4 Mockup elements that are NOT computable — do not render them

Under the run's no-invented-data rule, applied to what `child_profiles` / `shift_log` actually store:

| Mockup element | Backed by data? |
| --- | --- |
| "Poziom 3", stage names/states, coin balance "126 zł" | ✅ `business_level`, the stage catalogue, `wallet_balance` |
| "Następne ulepszenie" + cost + requirements ✓/✗ | ✅ `nextUpgrade` / `canBuy` already compute exactly this |
| "40 / 80 zł" progress toward the next upgrade | ✅ `wallet_balance` vs catalogue cost — `t.upgradeShop.nextProgress` already renders this shape |
| "Odblokowane w tym poziomie" / "Co odblokujesz?" | ✅ derivable by filtering `UPGRADES` on `requiredWorldLevel` |
| **"120 / 200 XP"** | ❌ **no XP concept exists anywhere in the app** |
| **"Zysk dzienny +28 zł"** | ❌ no per-day earnings — and not fixable by this change either (the new column is per-shift, not per-day-of-shop-operation) |
| **"Klienci dziennie 11"** | ❌ customers are not modelled |
| **"Zadowolenie 92%"** | ❌ satisfaction is not modelled |
| **"Następne kroki" counters** (0/1, 11/15, 126/150) | ❌ no goals/quests system; "Zarób 150 zł" would need cumulative earnings, which even the new column only provides from the migration forward |

That is five of the mockup's panels. The plan must say, per panel, whether it ships, ships in a
reduced form, or is omitted — the same discipline F1 was held to. This is the second-largest scoping
risk in the change after the artwork.

---

### 8. Routing, navigation and the app shell

#### 8.1 `PROTECTED_ROUTES` — **CONFIRMED, verbatim**

`src/middleware.ts:5` and `:42`:

```ts
const PROTECTED_ROUTES = ["/app"];
...
if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
  if (!context.locals.user) {
    return applyNoStore(context.redirect("/auth/signin"));
  }
}
```

A prefix list of one, matched with `startsWith`. **Any new page under `/app/...` is auth-gated with
zero middleware changes.** Two caveats: it is a raw *string* prefix, not a path-segment prefix (a
hypothetical `/application` route would also be gated — harmless today); and `/api/*` is **not** in
the list, so any new API route must authenticate itself, as `shifts/complete.ts` does.

The middleware also sets `context.locals.user`, bounces authed users off `/auth/signin|signup`
(exact match), and applies no-store headers. It does **not** do PIN gating (that is per-page, e.g.
`src/pages/app/report.astro:22-29`) and does **not** do profile-selection gating (that is
`src/pages/app.astro` plus a per-page fallback ladder).

#### 8.2 New route or a section of an existing screen? — **A new route.**

The web mockup shows a dedicated full screen with its **own active sidebar entry ("Rozwój świata")**,
its own heading, and four content cards. It cannot be a section of `start.astro` without either
duplicating the shell heading or breaking the "one `h1` per page" rule. Existing pages under
`src/pages/app/`: `start`, `task`, `upgrades`, `report`, `new-profile`, `pick-profile`, `parent-pin`.

**Route-name warning — F5 is concurrently claiming `/app/worlds`.** Feature F5
(`context/changes/world-selection-screen/`) is planning a world *selection* screen at `/app/worlds`
with a `worlds` key in the shell's `active` union. F4's screen is world *progression*. **Do not use
`/app/worlds`.** `/app/growth` or `/app/progress` with the mockup's label "Rozwój świata" keeps them
distinct.

#### 8.3 What the app shell needs — four edits, none of them the middleware

`src/components/app/AppShell.astro:59-65` is the single insertion point:

```ts
const items = [
  { key: "dashboard", href: "/app/start", label: t.nav.items.dashboard, icon: Home },
  { key: "missions", href: "/app/task", label: t.nav.items.missions, icon: Target },
  { key: "shop", href: "/app/upgrades", label: t.nav.items.shop, icon: Store },
] as const;

const tabs = [...items, { key: "parent", href: "/app/report", label: t.nav.items.parent, icon: ShieldCheck }] as const;
```

`items` drives the desktop sidebar; `tabs` (a spread of `items` plus the pinned parent entry) drives
the mobile bottom bar. **One object added to `items` appears in both.**

1. `src/pages/app/<name>.astro` — new file (see §8.4).
2. `src/components/app/AppShell.astro:38` — widen the `active` union
   `"dashboard" | "missions" | "shop" | "parent"` with the new key, or `astro check` fails on the
   new page's `active="..."`.
3. `src/components/app/AppShell.astro:59-63` — one entry in `items` (lucide icon; `world-progress.svg`
   in the asset pack suggests a bar-chart/ascending glyph — `TrendingUp` or `BarChart3` from lucide
   matches the mockup's sidebar icon and needs no crop).
4. `src/i18n/pl.ts:133-138` — a key under `nav.items` (current values: `dashboard: "Pulpit"`,
   `missions: "Misje"`, `shop: "Mój sklep"`, `parent: "Panel rodzica"`).

Active state is a **prop, not URL-derived** — compared as `active === key` at `:104`, `:107`, `:121`,
`:194`, `:198`. Both navs are always in the DOM and toggled with `display` only (`hidden` /`lg:flex`
at `:70`; `flex` /`lg:hidden` at `:186`), deliberately, per the docstring at `:16-19` — one copy of
each accessible name in the a11y tree.

**Two navigation risks:**
- **Bottom-bar crowding.** Tabs use `justify-around` with `flex-1 min-w-0` + `truncate`. Today there
  are four; "Panel rodzica" already truncates on narrow phones. F4 makes five. **If F5 also lands a
  tab, that is six** at the `touch` project's 712px viewport. The mockup's own mobile bar solves this
  by collapsing to five short labels (Pulpit · Misje · Sklep · Postępy · Więcej) — worth copying, but
  renaming existing tabs is a cross-feature change, so raise it rather than doing it silently.
- **Accessible-name collision.** E2E specs locate links page-wide and unscoped, e.g.
  `e2e/gameplay-restore.spec.ts:55` → `page.getByRole("link", { name: t.start.upgradesLink })`
  ("Rozbuduj sklep"). `getByText`/`getByRole` name matching is substring-based, so a new nav label
  that contains or is contained by an existing link name breaks unrelated specs with a strict-mode
  violation. "Rozwój świata" collides with nothing in `t.start.*` / `t.report.*` / `t.picker.*` today
  — verify before finalising.

**No existing test asserts on nav item counts.** Grepped `e2e/*.spec.ts` for `nav`, `toHaveCount`,
`aria-current`, `Nawigacja`, and each nav label: the only `nav` hits are the word "navigation" inside
comments. No unit test references `AppShell` either.

#### 8.4 The server-side data-load pattern to copy

`src/pages/app/upgrades.astro:22-32` is the right template (it degrades instead of hard-redirecting):

```astro
const supabase = createClient(Astro.request.headers, Astro.cookies);
const resolved = supabase ? await resolvePageProfile(supabase, Astro.cookies) : { profile: null, profileCount: 0 };
if (!resolved.profile && resolved.profileCount >= 2) return Astro.redirect("/app");
const profile = resolved.profile;

const world = profile ? worldForTheme(profile.theme) : null;
const purchased = profile ? readPurchased(profile.shop_state) : [];
const skillState = readSkillState(profile?.skill_state);
const avatar = profile ? getAvatar(profile.avatar) : null;
```

with the body shape `profile && world ? <AppShell ...>...</AppShell> : <EmptyStateCard />`.
The stricter variant (`task.astro:21-25`) hard-redirects when the page is meaningless without a
profile. Invariants a new page must respect: `createClient` can return `null` (missing env) — always
handle it; never trust the `active_profile` cookie (it is re-matched inside the RLS-scoped owned list
at `active-profile.ts:62`); all queries go through the request-scoped RLS client, never a manual
`account_id` filter (L-002); `output: "server"` so no `prerender` opt-out is needed on pages;
`profile.name` is PII — text interpolation only, never `set:html`.

**Everything the progression screen needs is already on `ChildProfile`** — `business_level`,
`completed_shift_count`, `wallet_balance`, `shop_state`, `skill_state`, `theme`. It is a read-only
view over existing state: **no new API route, no new query, no `prerender` concern.**

---

### 9. The test surface

Baseline confirmed by running `npx vitest run --reporter=dot`: **299 tests across 39 test files**
(30 currently failing purely because the local Supabase stack was down — `AuthRetryableFetchError`
in `tests/helpers/supabase.ts:46`; 88 self-skip when the stack is absent). Playwright: 15 e2e.

| File | Covers | Impact of this change |
| --- | --- | --- |
| `tests/shift.test.ts` | `shiftLength`, `generateShift`, `earningsForShift`, `starsForShift`, `businessLevelForShifts` (`:130-136` asserts 0→1, 2→1, 3→2, 6→3) | The natural home for `stageForLevel` tests, or a new `tests/stages.test.ts` beside it |
| `tests/shifts-complete.test.ts` (10 tests) | The whole write path through `POST /api/shifts/complete` with real sessions + service-role verification. `:223` "writes exactly one shift_log row per completed shift with the right deltas" (reads back via `.select("skills, upgrade_purchased")` at `:89-97`); `:259` the L-002 cross-account assertion | **The place to assert `earned` actually persists.** Extend the read-back select. |
| `tests/shift-log-isolation.test.ts` (5 tests) | The four-operation RLS contract | Passes untouched (uses `select("*")` through an untyped client; inserts only `account_id, profile_id, skills` at `:55`). Optional: add the column to its local `interface ShiftLogRow` (`:21-28`) so the contract covers the whole row |
| `tests/reports.test.ts` (12 tests) | `aggregateWeeklyReport` + `startOfWeek` (both DST weekends) | Every assertion is property-scoped; there is **no** `expect(report).toEqual({...})` anywhere in `tests/`. Adding a field breaks nothing. One detail: the local `row()` helper (`:13-15`) is typed `ShiftLogRow`, so making `earned` **required** on that interface is a type error — declare it `earned?: number \| null` |
| `tests/report-isolation.test.ts`, `tests/account-deletion.test.ts`, `tests/profile-deletion.test.ts` | Insert `shift_log` rows directly (`:43`, `:46`, `:53`) without `earned` | Fine under nullable or `not null default 0`; **broken by `not null` with no default** |
| `tests/upgrades.test.ts`, `tests/data-lookups.test.ts`, `tests/i18n-helpers.test.ts` | Catalogue derivations, resolver fallbacks, "every catalogue id resolves to non-empty copy / a ghost id never throws" | The three files a new stage catalogue must extend |
| `tests/upgrades-buy.test.ts` | The sibling `appendShiftLog` caller | Touch only if the purchase path's `earned` value changes |
| `e2e/gameplay-restore.spec.ts` (2 tests, runs in **both** projects) | The only spec that completes a shift. Asserts the exact payout in Polish copy via `t.results.earnedLabel` (`:47`), 2 stars (`:49`), wallet-scoped upgrade progress (`:59`, `:111`) | Unaffected by a log column (it asserts wallet/UI, not `shift_log`). **But note `e2e/helpers/solve-shift.ts:75` hardcodes `earned: 5 * taskCount + 3 * cleanCount`** — a duplicate of the formula that must move in lockstep if the constants ever change |
| `e2e/parent-surfaces.spec.ts` | `/app/report` — asserts only `t.report.heading` visibility, never tile content | A new tile breaks nothing |
| `e2e/smoke.spec.ts:16-20` | `anonymous /app redirects to signin` | The template for a new `anonymous /app/<new-route> redirects to signin` regression test |

**Playwright projects, corrected:** `playwright.config.ts:42-54` defines **two** — `desktop`
(Desktop Chrome, all specs) and `touch` (`devices["Galaxy Tab S4"]`, viewport **712×1138**), and
`touch` is scoped by `testMatch: /gameplay-restore\.spec\.ts/` to that **one spec only**. So the
712px breakpoint is exercised by the gameplay spec, not by the whole suite — a new screen gets no
touch-viewport coverage unless a spec is added to that project.

---

## Code References

- `src/data/shift.ts:36-37, 83-86, 98-101` — `SHIFTS_PER_LEVEL`, `earningsForShift`, `businessLevelForShifts`
- `src/lib/services/child-profiles.ts:120-137` — `appendShiftLog` (best-effort, errors never read)
- `src/lib/services/child-profiles.ts:157-190` — `recordShiftResult`; `earned` computed `:170`, **dropped `:187`**
- `src/lib/services/child-profiles.ts:257-262` — the purchase-path `appendShiftLog` call
- `src/pages/api/shifts/complete.ts:8, 38-57, 84-96` — `prerender = false`, zod schema (`<=` refinements), response
- `src/lib/services/reports.ts:13-16, 37, 75-92, 107-114` — `ShiftLogRow`, `aggregateWeeklyReport`, `startOfWeek`, the select
- `src/components/child/ShopArt.tsx:5-8, 24-26, 36-66` — props, slot maps, composition
- `src/data/upgrades.ts:15-41, 46-76, 107-113, 137-165` — catalogue house style, `canBuy`, `nextUpgrade`
- `src/data/skills.ts:31-37, 96-110` — the threshold-ladder + `atMax` precedent
- `src/data/worlds.ts:12-43` — the 4 worlds, `worldForTheme` total resolver
- `src/pages/app/start.astro:46-51, 111-133, 63-70, 142-153` — milestone path + stat tiles
- `src/components/app/AppShell.astro:16-19, 38, 59-65, 70, 103-114, 186-203` — shell doctrine, `active` union, nav arrays, display toggling
- `src/middleware.ts:5, 42` — `PROTECTED_ROUTES` + `startsWith`
- `src/i18n/pl.ts:125-139, 196, 207, 266-275, 314, 340, 377-407` — nav, level copy, the keyed-record pattern, report namespace
- `src/i18n/index.ts:29-35` — `upgradeCopy` guarded accessor
- `supabase/migrations/20260701150000_create_shift_log.sql:21-30, 38-63` — table + the four policies
- `supabase/migrations/20260630120000_child_profiles_add_gameplay_state.sql:9-16, 22, 29` — `business_level`, the column-agnostic-RLS precedent
- `supabase/migrations/20260701140000_child_profiles_add_skill_state.sql:5-8` — the ADD COLUMN template
- `docs/reference/contract-surfaces.md:25-39` — the `shift_log` registry entry to update
- `public/illustrations/slice-map.md` — the crop/copy registration formats

## Architecture Insights

- **Three different "levels" coexist and must never be conflated.** `starting_level` (age-derived,
  frozen, `{1,2,3}`, governs task difficulty — `src/data/leveling.ts`), `business_level` (shift-derived,
  mutable, unbounded, governs upgrade unlocks), and per-competency **skill level** (`0..5`, capped,
  `src/data/skills.ts`). The codebase guards this in three places in near-identical language, including
  the migration header: *"Conflating them would corrupt the difficulty derivation."* A stage catalogue
  attaches to `business_level` and nothing else.
- **Purity as a correctness device.** Every `src/data/` module is dependency-free so the same code
  runs on the client (display) and the server (authority) — "both sides agree by construction". A
  stage catalogue belongs there, not in a component and not in a service.
- **Total resolvers over throwing lookups.** `worldForTheme`, `readPurchased`, `readSkillState`,
  `upgradeCopy` all degrade to a renderable default. `tests/data-lookups.test.ts` exists to lock that
  contract. `stageForLevel` must join them.
- **Server-authoritative money.** The client never supplies an amount; `earningsForShift` is recomputed
  server-side from reported accuracy, and the zod schema deliberately has no `earned` field. The new
  column must be written from the server-computed value, never from a request body.
- **Best-effort history vs authoritative state.** The profile UPDATE is the source of truth; the
  `shift_log` row is a derived, droppable record. Any number sourced from the log inherits that
  weaker guarantee — and the parent-facing copy must not imply otherwise.

## Historical Context (from prior changes)

- `context/changes/web-shell-and-mockup-parity/handoff.md:190-201` — backlog entry **B4**, the source
  of this change: *"katalog etapów (nazwa + grafika + próg), kadry z `assets/atomic-assets-v3/` do
  `public/` + wpis w `slice-map.md`"*, and the pairing rationale: *"tu naturalnie dochodzi kolumna z
  zarobkiem w `shift_log` (patrz A1) — «ile zarobiłem w tym tygodniu» przyda się i dziecku, i rodzicowi."*
- Same file, `:115-116` — the original deferral: *"«+84 zł zdobyte w tym tygodniu» z makiety **nie
  jest** wyliczalne — `shift_log` nie zapisuje zarobku. To wymaga kolumny (patrz B4)."*
- `src/i18n/pl.ts:394-396` — the deferral is recorded in **shipped code**: *"the mockup's correctness %,
  daily chart and earnings have no source yet, so they are not rendered rather than estimated."*
- `context/foundation/lessons.md` — **L-001** (RLS in the same migration; the four-policy contract),
  **L-002** (test the row didn't persist; never trust a chained `.select()` for INSERT isolation),
  **L-003** (all user-visible strings through `src/i18n/pl.ts`). All three bind this change.
- `context/runs/2026-08-22-autonomous-five/run-log.md` — F2's research surfaced that `shift_log` RLS is
  **account-scoped, not profile-scoped**; F5's surfaced that `PROTECTED_ROUTES` already covers `/app`.
  Both are reconfirmed here independently.

## Related Research

- `context/changes/parent-weekly-activity-chart/handoff.md` (F1) — the deferred earnings tile, verbatim
  at `:25-31`. F1 has **no** `research.md`/`plan.md`.
- `context/changes/world-selection-screen/handoff.md` (F5) — claims `/app/worlds` and widens the same
  `AppShell` `active` union. **Route-name and nav-crowding collision with this change.**
- `context/changes/dashboard-recent-activity/` (F2) — the other `shift_log` reader in flight.
- `context/archive/2026-06-30-visible-shop-growth/`, `context/archive/2026-07-01-upgrade-choice-and-growth/` —
  where `ShopArt`'s "growth in scene" mechanic and the upgrade catalogue were designed.

---

## The F1 question, answered

**Can F1's parent report pick up the earnings tile purely additively once this column exists, or must
F4 change the report itself?**

**Purely additively — and F4 need not touch the report at all.**

- **F1 has not landed.** `context/changes/parent-weekly-activity-chart/` contains only `change.md`
  (`status: new`) and `handoff.md`, both untracked; there is no research, no plan, no branch, no code.
  The weekly report that exists in the tree is the earlier S-07/FR-016 feature polished by the
  committed `web-shell-and-mockup-parity` UI pass. So the framing "retro-fit into F1's report" is moot:
  F1 is still ahead of this change, not behind it.
- **The data contract is open.** `WeeklyReport` (`src/types.ts:146-150`) is consumed by property access
  only — `WeeklyReport.tsx:128` does a *partial* destructure `const { practice, upgrades } = child.report;`,
  `report.astro` never names the fields, and there is no exact-object assertion anywhere in `tests/`
  (grepped `toEqual`/`toStrictEqual`/`toMatchObject`/snapshots). Widening the interface is invisible.
- **The tile has a slot already.** `WeeklyReport.tsx:139-148` is a 2-tile grid; `tasksThisWeek` at
  `:133` is derived in-component from `practice` — the precedent for deriving a tile from the aggregate.

**Recipe, ~15 lines across 4 files, zero call-site churn:**

| File | Change | ~Lines |
| --- | --- | --- |
| `src/types.ts` (`WeeklyReport`) | add `earned: number;` | +1 |
| `src/lib/services/reports.ts` (`ShiftLogRow`) | add `earned?: number \| null;` — **optional**, so `tests/reports.test.ts`'s `row()` helper still compiles | +1 |
| same (`aggregateWeeklyReport:37-47`) | accumulator in the existing row loop + one key in the returned object | +3 |
| same (`getWeeklyReport:109`) | `.select("skills, upgrade_purchased, earned")` — it uses an **explicit column list**, so the new column is invisible until added here | 1 modified |
| `src/components/parent/WeeklyReport.tsx:139-148` | a third `<li>` tile (`grid-cols-2` → `sm:grid-cols-3`) | +6 |
| `src/i18n/pl.ts:~396` | `statEarned` key + update the now-stale comment at `:394-396` | +1 |

`src/pages/app/report.astro` needs **no** edit.

**RECOMMENDATION on ownership: F4 ships the column only; the tile goes to F1 or a follow-up.**
F1 is planning edits to `WeeklyReport.tsx`'s tile area *right now* in this same run; two concurrent
features editing the same grid is an avoidable conflict, and the tile is F1's mockup, not F4's. But
per the handoff's standing requirement, **the plan must state this explicitly**, carry the six-line
recipe above verbatim so it cannot get lost, and record the honesty rule from §4.4 (suppress the tile
while the week's window contains `null` rows, rather than rendering a silently-undercounted number).

---

## Open Questions

1. **Copy past the last stage.** Does `t.results.levelUp` ("Twój sklep rośnie!") keep firing every
   third shift once stage 4 is reached, or does the celebration gate on a stage change? (§1.4)
2. **Which of the mockup's five uncomputable panels are dropped vs reduced** — XP bar, daily profit,
   daily customers, satisfaction, "Następne kroki" counters. (§7.4)
3. **Artwork:** ART-C (recommended) vs ART-A. If ART-A, is café-flavoured stage art in the bakery an
   accepted deviation? (§6.4)
4. **Backfill:** B-1 (recommended) vs `not null default 0` — hinges solely on whether the maintainer
   treats existing `shift_log` rows as disposable pre-launch data. (§4.4)
5. **Route name and nav crowding** given F5's concurrent `/app/worlds` and the five-or-six-tab bottom
   bar at 712px. (§8.2, §8.3)
6. **Should the swallowed `appendShiftLog` error get a server-side breadcrumb?** Not required, but the
   number is now parent-facing and the codebase has no logging convention to fall back on. (§3.4)
