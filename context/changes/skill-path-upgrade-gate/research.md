---
date: 2026-07-01T21:42:59+0200
researcher: vince307
git_commit: 02266c7e1fdca4f91f7277f8169c591b9d46e420
branch: main
repository: 10xDevs
topic: "S-07 skill-path-upgrade-gate: per-competency skill progress derived from task attempts, wired into the upgrade gate + a parent weekly report"
tags: [research, codebase, skill-progress, upgrade-gate, task-history, parent-report, rls]
status: complete
last_updated: 2026-07-01
last_updated_by: vince307
---

# Research: S-07 skill-path-upgrade-gate

**Date**: 2026-07-01T21:42:59+0200
**Researcher**: vince307
**Git Commit**: 02266c7e1fdca4f91f7277f8169c591b9d46e420
**Branch**: main
**Repository**: 10xDevs

## Research Question

For roadmap slice **S-07** (`skill-path-upgrade-gate`): how would we add a per-competency **skill-progress** signal *derived from task attempts*, use it (plus **completed task history**) as additional upgrade requirements alongside S-06's cost + world-level gates, and build the PRD's **parent weekly report** (FR-016) read surface — all under the project's per-account isolation and server-authority contracts? Scope confirmed with the user: **gate + parent report**, going deep on attempt-signal derivation, persistence/isolation, gate/catalog extension, and competency taxonomy.

## Summary

The mechanics are well-seated for S-07, with one large cost driver.

1. **The skill signal already exists in memory but is thrown away.** In `ShiftScreen.tsx` the task `type` (`counting` | `change_making`) and each task's `firstTry` outcome both live at accumulation time, index-for-index — but they are never joined; the shift collapses to two scalars (`taskCount`, `cleanCount`) before the POST. A per-competency breakdown is *derivable* with no new task instrumentation — just stop discarding it (thread `type` through the accumulator → POST body → zod schema → a new persisted column). The finest signal (exact `misses` per attempt) dies earlier in `useCoinTask` and can't be recovered downstream.

2. **The upgrade gate is built to extend.** `canBuy` already returns a reason union and takes a trusted context bag; S-07 adds **optional** `requiredSkill?` / `requiredTaskHistory?` fields to `Upgrade`, extends `BuyContext` + the reason union with `skill-locked` / `history-locked`, and inserts new rungs into the ladder (after `locked`, before `insufficient`). Because the fields are optional, every S-06 catalog entry + test stays green. Display and authority already share the same pure `canBuy`, so a skill requirement shown to the child is computed by the same function the buy route trusts.

3. **Persistence has a fork with a real cost delta.** The **gate** needs only a small per-competency aggregate + a task-type completion tally — cheapest as a **new `skill_state jsonb` column on `child_profiles`**, which rides the existing column-agnostic RLS with *no* new policy, no isolation-test file, no backfill (exactly how `shop_state` was introduced). But the **parent weekly report** ("what was practiced *this week*") needs **timestamped history** — and `child_profiles` stores only current aggregates, no history anywhere. That forces a **new owned+RLS table** (a shift/attempt log), which triggers the full L-001 contract (four policies in-migration + a cross-account isolation test + a contract-surfaces entry). This table is the biggest single planning decision and cost in S-07.

4. **No parent surface exists at all.** Every `/app/*` route is a child surface; there is no parent dashboard, no parent-PIN, no report route, no list-all-profiles service fn (only `getMostRecentProfile`). "Panel rodzica" / "raporty" are marketing copy wired to nothing. The report is genuinely net-new: a new gated route + a `listChildProfiles` fn (drop the `limit(1)`) + the history table above + the isolation negative check the PRD explicitly wants re-exercised here.

5. **Taxonomy (grounded, first cut): three competencies** — **math/number-sense** (counting), **money/change** (change-making = `paid − price`), **decisions** (the choose-upgrade purchase event itself). "doc 08" is an external doc, not in the repo; this set is read off the PRD/shape-notes and matches exactly what ships. Two hard product constraints on the progress function: **system-determined (never client-trusted)** and **monotonic under spending** (spending never regresses skill progress).

## Detailed Findings

### 1. The attempt signal — where it lives and where it dies

Two task types share one discriminated union `Task = CountingTask | ChangeMakingTask` keyed by `type` (`src/types.ts:28-37`, `:51-66`). `TaskType = Task["type"]` (`"counting" | "change_making"`) is already an exported named type (`src/data/tasks.ts:12`) — the natural competency key. `difficultyTier` is a *static* band from `starting_level` via `tierForLevel` (`src/data/counting-tasks.ts:26-28`), not a performance signal. There is **no existing "skill"/"competency" concept** — the only hit is a comment in `src/data/upgrades.ts:9` noting skill gating does *not* exist yet.

Layer-by-layer signal survival:

| Layer | Signal present | Discarded here |
|---|---|---|
| Hook `useCoinTask.ts` | exact `misses` per attempt; **no `type` known** | `misses` → `firstTry` boolean at emit (`useCoinTask.ts:53`, `TaskOutcome` = `{ firstTry }` `:6-9`); type never available to the hook |
| `TaskScreen.tsx` | passes numbers + outcome through | nothing new; no type |
| Accumulator `ShiftScreen.tsx` | **`tasks[i].type` AND `results[i].firstTry` both in memory** | never joined; `results: TaskOutcome[]` (`:49`), `advance` appends outcome only (`:54-57`); collapses to global `taskCount`/`cleanCount` (`:66-67`) |
| POST body `ShiftScreen.tsx:71-75` | — | sends only `profileId`, `taskCount`, `cleanCount`; **type omitted** |
| Endpoint `complete.ts:16-22` | — | zod accepts only the 3 scalars |
| Service/DB `child-profiles.ts:92-120` | — | writes `wallet_balance`/`completed_shift_count`/`business_level` only; **no per-skill column** |

**Consequence:** the last layer where a per-competency signal can be reconstructed from existing data is the **client accumulator** (`ShiftScreen.tsx`). S-07 must pair `type` with each outcome there and carry a per-competency accuracy summary through the POST → zod → service → a new column. No change to task generation or the interaction hook is required for a `firstTry`-granularity signal; capturing `misses`-granularity would require widening `TaskOutcome` at `useCoinTask.ts:53`.

**Nuance — the "decisions" competency accrues elsewhere.** Counting/money signals come from the shift; the *decisions* competency is exercised by the **choose-upgrade purchase event** (`POST /api/upgrades/buy`), not a task. So skill updates land at **two** trusted server points: `recordShiftResult` (counting/money) and `buyUpgrade` (decisions).

### 2. Persistence + isolation — the fork

**`child_profiles` is the only table.** Columns + constraints (from `supabase/migrations/`): `wallet_balance integer not null default 0` (`nonneg` CHECK), `completed_shift_count integer not null default 0` (`>=0`), `business_level smallint not null default 1` (`>=1`), `shop_state jsonb not null default '{"purchased": []}'` , plus identity/`starting_level`. The shared `set_updated_at()` trigger is defined once (`…isolation.sql:35-44`) and reused, never redefined.

**RLS is column-agnostic.** All four policies are predicated solely on `auth.uid() = account_id` (`…isolation.sql:78-101`), so **adding a column to `child_profiles` needs no policy or trigger change** — every column-adding migration says so verbatim (`…add_gameplay_state.sql:6-8`, `…rename_coins…:11-13`, `…shop_state_default.sql:9-10`). Adding a **new table** invokes L-001 in full: four `to authenticated` per-op policies in the *same* migration, owner `account_id … references auth.users(id) on delete cascade`, a cross-account isolation test, and a `docs/reference/contract-surfaces.md` entry (`context/foundation/lessons.md:5-11`; skeleton `docs/reference/rls-template.sql`).

**The fork:**
- **Skill-progress aggregate + task-type completion tally (gate inputs)** → cheapest as a **new `skill_state jsonb` column** (e.g. `{ counting: n, change_making: n, decisions: n }` + completion counts). One non-breaking `alter table add column`, no RLS work, no backfill (normalize missing keys in a pure reader like `readPurchased` does). *Do not overload `shop_state`* — it is semantically "shop customization" (`src/types.ts:76`); a dedicated column is cleaner. (Note S-06 impl-review F2 already hardened `buyUpgrade` to merge `shop_state` keys, so colocating there wouldn't corrupt — but semantic separation still argues for its own column.)
- **Timestamped history (parent weekly report)** → `child_profiles` holds only *current* aggregates; there is **no history anywhere**. A "what was practiced this week" report needs a **new owned+RLS table** (a per-shift or per-attempt log with `created_at`), which is the L-001-heavy path. This is unavoidable given the gate+report scope.

**Server-authoritative write path (the pattern to mirror).** Every service fn takes the request-scoped SSR client so RLS scopes it to the acting parent; the row is reached by `id`, read, mutated in memory, written by `id`, never trusting a client `account_id` (`src/lib/services/child-profiles.ts:8-14`). `recordShiftResult` (`:92-120`) reads by id → recomputes via pure fns (`earningsForShift`, `businessLevelForShifts`) → one UPDATE. **S-07 skill derivation folds in here**: add a pure fn in `src/data/shift.ts` (mirroring `earningsForShift`) that maps the shift's per-competency results into the new `skill_state`, written in the *same* UPDATE at `:109-116`. The `decisions` competency updates analogously inside `buyUpgrade` (`:142-176`). The route (`complete.ts:16-22`) must widen its zod schema to carry the per-competency accuracy (currently aggregate-only).

### 3. The upgrade-gate extension

`src/data/upgrades.ts`: `Upgrade` = `{ id, nameKey, cost, requiredWorldLevel, extraTasks, art, order }` (`:15-29`); `UPGRADES` = 6 entries (`:34-89`); `canBuy` reason ladder is load-bearing (`:122-128`): `unknown → owned → locked(world) → insufficient(funds)`. `BuyContext` = `{ walletBalance, businessLevel, purchased }` (`:109-113`), built from the trusted row in `buyUpgrade` (`child-profiles.ts:159-163`). `UPGRADE_IDS = UPGRADES.map(u => u.id)` feeds `buy.ts:17` `z.enum(UPGRADE_IDS)`.

**Extension shape (non-breaking):**
- Add **optional** `requiredSkill?: { competency: string; level: number }` and `requiredTaskHistory?: { … }` to `Upgrade` — optionality keeps the 6 existing entries + the catalog-invariants test (`tests/upgrades.test.ts:100-112`) valid.
- Extend `BuyContext` with `skillState` + `completedTaskCounts` (threaded from the new column exactly as `purchased` is today).
- Extend the `BuyCheck` reason union (`:115`) and `BuyFailure` (`child-profiles.ts:123`) with `"skill-locked"` / `"history-locked"`.
- Insert new rungs into `canBuy`: `unknown → owned → locked(world) → skill-locked → history-locked → insufficient(funds)`. Entries without the optional fields skip straight through, so all S-06 `canBuy` tests (`:37-61`) pass unchanged.
- **No route change needed:** `buy.ts:45-49` already maps any non-`not-found` failure to `400 { reason }`, so new reasons surface automatically; `UPGRADE_IDS`/zod is untouched (fields, not ids).

### 4. Surfacing (child) + the parent weekly report

**Child skill/next-requirement copy — the seam is `lockedReason`.** `UpgradeShop.tsx:69-76` switches only on `locked`/`insufficient` today; a new branch maps `skill-locked`/`history-locked` to a new i18n key. The affordable/locked/owned buckets (`:40-44`) and the next-upgrade nudge (`:96-99`, plus `start.astro:34-41,102`) are all driven by the shared pure `canBuy`/`nextUpgrade` — so **display and the buy route agree by construction** (`src/data/upgrades.ts:117-121`). i18n pattern: flat `{token}` keys in the `upgradeShop` block (`src/i18n/pl.ts:216-234`), e.g. add `lockedBySkill` / `lockedByHistory`; upgrade *names* stay keyed by id in the `upgrades` block (`:204-211`). The `results` block's `upgradesNudge` (`:254-257`) is the template for any "keep practicing X" encouragement (factual, no urgency — L-003 + FR-013).

**Parent weekly report — everything is net-new.** `middleware.ts:5` gates only `/app`; `locals.user` is the acting parent, but **no parent-facing surface exists** (no dashboard, report, settings, or parent-PIN — `"Panel rodzica"`/`"raporty"` at `pl.ts:69,82` are marketing only). The report needs:
- a **new gated route** (under `/app` or a new parent prefix) + its child components + i18n block;
- a **`listChildProfiles(client)`** service fn — RLS already scopes `select("*")` to the parent's own children, so this is just `getMostRecentProfile` (`child-profiles.ts:72-75`) **without** `limit(1)`; the docstring at `:64-66` already flags multi-profile as S-07;
- the **history table** from §2 as its data source (aggregated per week, read-only, ties each unlocked upgrade to the skills it exercised — FR-016);
- the **cross-account isolation negative check** the PRD names this the "natural place" to re-exercise (`prd-v3.md:133,152`) — a parent must never read another account's child data.

### 5. Competency taxonomy + skill-progress vs task-history

**"doc 08" is external (not in the repo).** Taxonomy read off the docs, three consistent framings converge on a v1 set that matches what ships:

| Competency | Signal source | Grounding |
|---|---|---|
| math / number-sense | `counting` task attempts (`count_till`) | `types.ts:21,28`; `counting-tasks.ts` |
| money / change | `change_making` attempts (`give_change` = `paid − price`) | `types.ts:44,59`; `change-making-tasks.ts` |
| decisions | the choose-upgrade purchase event | US-01/FR-011 "framed in-world math/decision moment" (`prd-v3.md:85,107`) |

`inventory`/`profit` (`shape-notes.md:66,267`) map to unshipped set-price/manage-stock tasks — out of S-07 scope; the PRD says the lead tranche "needs only the subset the upgrade gates reference" (`prd-v3.md:179`, `shape-notes.md:267`).

**Skill progress vs completed task history are two distinct gate inputs** (FR-010 tuple = "cost + world level + skill progress + completed task history", `prd-v3.md:106`):
- **Skill progress** — a *derived, per-competency, continuous, monotonic* aggregate ("how much practiced competency X"); needs a progress function; surfaced simply (FR-015).
- **Completed task history** — a *discrete categorical* record ("has the child done a give-change task at all / N times"); a threshold gate.
Both likely read the same underlying attempt data but are surfaced/gated differently. US-01 lists them as distinct locked labels: "funds / world level / skill / task history" (`prd-v3.md:91`).

**First-guess progress function (grounded):** per competency, a monotonic counter or capped success ratio over the mapped task type, kept minimal — "derive from existing mission-attempt data, surface lightly" (`shape-notes.md:173-174`). Hard constraints: **system-determined, never client-supplied** (`prd-v3.md:134`) and **monotonic under spending** (`prd-v3.md:76,93,108`).

## Code References

- `src/types.ts:28-37,51-66` — `Task` union; `type` discriminant = the competency key. `:76` — `ShopState` is "shop customization" (argues for a separate skill column).
- `src/data/tasks.ts:12` — `TaskType` exported; `:15-25` — ~50/50 dispatcher.
- `src/components/hooks/useCoinTask.ts:6-9,53` — `TaskOutcome = { firstTry }`; `misses` collapsed to boolean (finest signal lost here).
- `src/components/child/ShiftScreen.tsx:44,49,54-57,66-75` — accumulator where `type` + `firstTry` coexist but are never joined; POST body sends 3 scalars.
- `src/pages/api/shifts/complete.ts:16-22` — zod schema (aggregate only) to widen for per-competency accuracy.
- `src/lib/services/child-profiles.ts:8-14,72-75,92-120,142-176,159-163` — SSR-client/RLS contract; `getMostRecentProfile` (add a no-`limit` sibling); `recordShiftResult` (skill write hook point); `buyUpgrade` (decisions competency + gate read).
- `src/data/upgrades.ts:15-29,109-128` — `Upgrade` type, `BuyContext`, `canBuy` ladder to extend.
- `src/components/child/UpgradeShop.tsx:40-44,69-76,96-99` — bucket split; `lockedReason` seam; next nudge.
- `src/pages/app/start.astro:34-41,102` — server-side next-upgrade nudge.
- `src/i18n/pl.ts:204-211,216-234,254-257` — `upgrades`/`upgradeShop`/`results` copy homes.
- `src/middleware.ts:5,26-46` — `PROTECTED_ROUTES = ["/app"]`; `locals.user` = acting parent.
- `supabase/migrations/20260609120000_child_profiles_isolation.sql:35-44,78-101` — shared trigger; four column-agnostic RLS policies.
- `supabase/migrations/20260701130000_child_profiles_shop_state_default.sql:14` — the cheap `alter column … set default` precedent.
- `tests/child-profiles-isolation.test.ts:115-135` — gameplay-column UPDATE-isolation template; `tests/shifts-complete.test.ts`, `tests/upgrades-buy.test.ts`, `tests/upgrades.test.ts` — persistence/gate test mirrors.
- `docs/reference/rls-template.sql`, `docs/reference/rls-isolation.md`, `docs/reference/contract-surfaces.md` — new-table L-001 requirements.

## Architecture Insights

- **"Agree by construction" is the load-bearing pattern.** Pure client-safe modules (`src/data/shift.ts`, `src/data/upgrades.ts`) are imported by both the island (display) and the route (authority). S-07's skill gate + skill derivation must live as pure fns in these modules, or display and authority will drift. This also means the skill signal must be *server-recomputable* from trusted play data — the client can send raw per-competency accuracy, but the server owns the progress function.
- **Column-agnostic RLS makes gameplay-state additions nearly free — until you need history.** A jsonb column is a one-line non-breaking migration with zero RLS cost. The moment S-07 needs a *history* table for the parent report, cost jumps to the full L-001 contract. The gate could ship jsonb-only; the report is what forces the table.
- **Two trusted write points, not one.** Counting/money skills accrue at shift completion (`recordShiftResult`); the decisions competency accrues at purchase (`buyUpgrade`). The design must update skill state in both, both server-authoritative.
- **Monotonicity is a hard invariant.** Skill progress must never decrease — spending debits only the wallet. This constrains the progress function to accumulation, not any spend-linked recompute.

## Historical Context (from prior changes)

- `context/archive/2026-07-01-upgrade-choice-and-growth/{plan.md,plan-brief.md,change.md,reviews/impl-review.md}` — S-06 **explicitly deferred skill gating to S-07** (`change.md:19`, `plan.md:28`, `plan-brief.md:24`) and built `canBuy`'s reason union + context bag to extend. Impl-review **F2** proactively hardened `buyUpgrade` to merge `shop_state` keys — a seam left open for future per-profile state. No `research.md` in this archive (S-06 reused the paused change's research).
- `context/changes/visible-shop-growth/research.md` — **most relevant prior research**: maps the `shop_state`/render/persist/RLS path, establishes "column-agnostic RLS makes gameplay-state additions cheap" and the pure-fn agree-by-construction pattern S-07 should follow.
- `context/archive/2026-07-01-spendable-funds-wallet/` — S-05 shipped `wallet_balance` (the funds gate). `context/archive/2026-06-29-full-shift-with-results/research.md` — S-04 established `business_level`/`shop_state` + the single-UPDATE `recordShiftResult` pattern the skill write extends.
- `context/archive/2026-06-29-counting-task-in-business-context/research.md:128` — flags mockup "skill bars" as later scope (this slice). Change-making archive defines the money/subtraction signal.
- `context/foundation/shape-notes.md:95,173-174,212,267` — proposes `skill_progress` (per competency, derived from mission attempts) as **its own** table/column plus a `mission_attempt` log; names the v1 competency subset.

## Related Research

- `context/changes/visible-shop-growth/research.md` — shop_state / render / persist / RLS path (directly reusable).
- `context/archive/2026-06-29-full-shift-with-results/research.md` — persistence + scoring + `recordShiftResult`.
- No prior `research.md` covers skill tracking or the parent report — this is the first.

## Open Questions (for /10x-plan)

1. **Split or single slice?** The PRD risk register (`prd-v3.md:177`) already flags the natural split: (a) skill-path-as-gate (jsonb column, cheap), then (b) parent weekly report (history table + L-001 + new surface). Gate+report as one change is sizeable — is a two-phase plan (or two changes) warranted? *(Recommend surfacing this first in planning; the gate is low-risk, the report is the cost.)*
2. **History granularity.** Does the report need per-*task* rows (append-only log) or per-*shift* aggregates? Per-shift is far cheaper and likely sufficient for "what was practiced this week"; per-task enables finer reports later. This decides the history table's shape (and whether skill progress even needs the log, or can stay a running aggregate on `child_profiles`).
3. **Progress function specifics.** Counter vs capped ratio; thresholds at which each catalog upgrade's `requiredSkill`/`requiredTaskHistory` unlocks (needs a first-guess ladder, kid-testable). Which of the 6 S-06 upgrades gain skill/history gates vs staying cost+level only?
4. **Signal granularity.** `firstTry` (free today from the accumulator) vs `misses` count (requires widening `TaskOutcome` at `useCoinTask.ts:53`). Is first-try correctness enough for the progress function?
5. **Report route placement + parent gate.** Under `/app` (child prefix) or a new parent-mode prefix? Is any parent-PIN/parent-mode gate in scope, or is the account session sufficient (no child-vs-parent identity exists today)?
6. **Migration for existing profiles.** New `skill_state` column defaults empty; existing profiles start at zero skill progress. Confirm no upgrade a child *already owns* becomes retroactively "locked" in display (owned short-circuits `canBuy` first, so this is safe — worth a test).
