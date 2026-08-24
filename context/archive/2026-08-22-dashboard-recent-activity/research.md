---
date: 2026-08-22T20:16:58+02:00
researcher: vince307
git_commit: 22ddebd9e20bad4ed23613cbfa2fcbd69cd8c7b5
branch: feat/ui-polish
repository: 10xDevs
topic: "What a shift_log row records for a shift vs an upgrade purchase, and the shortest correct way to render a truthful 'Ostatnia aktywność' feed on the child dashboard"
tags: [research, codebase, shift_log, child-dashboard, reports, i18n, e2e]
status: complete
last_updated: 2026-08-22
last_updated_by: vince307
---

# Research: `shift_log` event shape and a truthful "Ostatnia aktywność" feed

**Date**: 2026-08-22T20:16:58+02:00
**Researcher**: vince307
**Git Commit**: `22ddebd9e20bad4ed23613cbfa2fcbd69cd8c7b5`
**Branch**: `feat/ui-polish`
**Repository**: 10xDevs

## Research Question

What does a `shift_log` row record for a shift versus an upgrade purchase, and what is the
shortest correct way to render a truthful "Ostatnia aktywność" event feed on the child
dashboard?

## Autonomous decisions

This step ran inside the autonomous run `context/runs/2026-08-22-autonomous-five/`
(standing brief: `agent-contract.md`, hard rule 1: never call `AskUserQuestion`). The
`/10x-research` skill opens by asking the user for a research question and later wants to
clarify scope with `AskUserQuestion`. Both were **decided, not asked**:

- **Research question** — as stated above, supplied by the orchestrating step. Rejected
  narrowing it to "just read the migration": the run's *no invented data* rule makes the
  write path, not the schema, the thing that decides what a feed may claim, and the
  migration alone cannot show that a purchase row also carries a `skills` payload
  (it does — see §2.3).
- **Scope: detailed, feeding a plan directly.** Rejected "quick overview" — the next step
  is `/10x-plan`, and a planner that has to re-derive the row shape will guess a metric.
- **Focus: data shape + integration points + existing dashboard structure**, plus two
  areas the orchestrator called out explicitly: the binding mockups, and the test/i18n
  surface a new label could break. Rejected a history focus (`context/archive/**`) as a
  primary axis — this table is 7 weeks old and has never been altered, so there is no
  evolution to trace; archive material is used only as corroboration.
- **Four parallel sub-agents** (schema+write paths / dashboard page structure / service
  and query surface / tests and i18n), all read-only, all waited for before synthesis.
  The mockup PNGs were read **by this agent directly**, not delegated — they are binding
  and a second-hand description of a design is not evidence.
- **What would change the answer:** if `shift_log` had turned out to carry no purchase
  rows, this would have become a schema question (migration + RLS) and the change should
  have routed back through `/10x-frame`. It does carry them (§2.3), so it does not.

## Summary

**A `shift_log` row has exactly five columns and there is exactly one migration that has
ever touched the table.** Effective schema (`supabase/migrations/20260701150000_create_shift_log.sql:22-34`):
`id`, `account_id`, `profile_id`, `created_at`, `skills jsonb not null`,
`upgrade_purchased text null`. **`upgrade_purchased` is the only nullable column**, and
it is a sound discriminator: the shift path never sets it, the purchase path always does.
Verified against the migration *and* both write paths *and* an existing test assertion.

**But `skills` is not a discriminator, and this is the trap the previous step's note did
not cover.** `skills` is `not null` on every row, so a purchase row also carries a payload:
the constant `{ decisions: { firstTryCorrect: 1, completed: 1, misses: 0 } }`
(`src/lib/services/child-profiles.ts:243`). Shift rows carry `math` + `money` and never
`decisions`; purchase rows carry `decisions` and never `math`/`money`. Discriminate on
`upgrade_purchased`, never on the jsonb keys.

**There is exactly one insert site** — the private, best-effort `appendShiftLog`
(`child-profiles.ts:120-137`) — with two call sites: `recordShiftResult` (`:187`) and
`buyUpgrade` (`:256-262`). Neither runs in a transaction with the `child_profiles` UPDATE,
and the log error is deliberately swallowed, so **the feed can legitimately be missing an
event that happened**. It must never be presented as a reconciliation of the wallet.

**The shortest correct implementation** is: one new `listRecentActivity(client, profileId, limit)`
in `src/lib/services/reports.ts` (§4.2), called from `src/pages/app/start.astro`'s
frontmatter (never from an island — §3.2), rendered by a new `.astro` section component
placed in the free `lg:row-start-3` slot of the existing grid (§3.3), with copy in a new
sub-block of `t.start` (§7.1). No migration, no API route, no React island, no new
dependency.

**The single hardest constraint is truthfulness of the label.** The mockup puts a money
delta on every row (`+12 zł`, `+6 zł`, `-50 zł`). `shift_log` stores **no earnings
column** — confirmed. §5 enumerates what a row *can* truthfully say and grades three
candidate labels; §8 leaves the final wording as an explicit planner decision.

**A finding that changes the layout brief: the mobile mockup has no "Ostatnia aktywność"
section at all** (§6.2). The feature exists only in the web mockup. That is a design gap
the planner must close deliberately, not silently.

## Detailed Findings

### 1. The table

#### 1.1 One migration, never altered

`grep -ln "shift_log" supabase/migrations/*.sql` returns exactly one file. There is no
later `alter table`, no added column, no added index, no policy change. **The migration as
written is the effective schema.**

`supabase/migrations/20260701150000_create_shift_log.sql:22-34`:

```sql
create table public.shift_log (
  id                uuid        primary key default gen_random_uuid(),
  account_id        uuid        not null references auth.users (id) on delete cascade,
  profile_id        uuid        not null references public.child_profiles (id) on delete cascade,
  created_at        timestamptz not null default now(),
  -- Per-competency delta this event exercised: { math|money|decisions: { firstTryCorrect, completed, misses } }.
  skills            jsonb       not null,
  -- Set only on a purchase event (the upgrade id); null for a plain shift row.
  upgrade_purchased text        null
);

create index shift_log_account_id_idx on public.shift_log (account_id);
create index shift_log_profile_created_idx on public.shift_log (profile_id, created_at);
```

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | **not null** | `gen_random_uuid()` | PK |
| `account_id` | uuid | **not null** | — | FK `auth.users(id)` on delete cascade; RLS predicate column; indexed |
| `profile_id` | uuid | **not null** | — | FK `child_profiles(id)` on delete cascade; indexed as `(profile_id, created_at)` |
| `created_at` | timestamptz | **not null** | `now()` | the only time signal on the row |
| `skills` | jsonb | **not null** | — (every insert must supply it) | no check constraint; shape unenforced at DB level |
| `upgrade_purchased` | text | **NULLABLE** | — | no FK, no enum — free text at the DB level |

No `updated_at` (deliberate; migration line 15 — rows are not mutated in normal flow).
The `(profile_id, created_at)` index already covers a newest-first per-profile feed query
exactly; no new index is needed.

#### 1.2 RLS — account-scoped, **not** profile-scoped

RLS is enabled (`:36`) with four per-operation policies, all `to authenticated`, all
predicated on `auth.uid() = account_id` (`:38-64`): `shift_log_select_own` (using),
`shift_log_insert_own` (`with check`), `shift_log_update_own` (both), `shift_log_delete_own`
(using). This matches lesson **L-001** and the registered contract in
`docs/reference/contract-surfaces.md:25-39`.

**The load-bearing consequence for this feature:** SELECT is scoped **by account only**.
A signed-in parent can read the `shift_log` rows of *every* child on the account with no
extra filter. A per-child feed **must** add `.eq("profile_id", …)` in application code —
RLS will not do it. The one existing precedent does exactly that (`reports.ts:110`).

Isolation is already covered by tests and needs no new policy work:
`tests/shift-log-isolation.test.ts` (table-level RLS, 5 tests) and
`tests/report-isolation.test.ts` (the read path through the service, 3 tests).

### 2. What is written, and when

#### 2.1 One insert site, best-effort

`grep -rn 'from("shift_log")' src/` returns exactly two hits: one insert, one select.
The insert is `src/lib/services/child-profiles.ts:120-137`:

```ts
/**
 * Append one `shift_log` row (S-07) — the history the parent report reads. Best
 * effort: a log failure must NOT fail an already-persisted shift/purchase (the
 * authoritative profile UPDATE has committed by the time this runs), so its error
 * is swallowed. ...
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

`id` and `created_at` are never supplied — both come from DB defaults. The returned error
is never inspected.

#### 2.2 Call site A — shift completion

`src/lib/services/child-profiles.ts:186-187`:

```ts
  // History row for the weekly report — account_id from the RLS-verified row (L-002).
  await appendShiftLog(client, { accountId: current.account_id, profileId, skills: shift.skills });
```

`account_id` comes off the RLS-verified `child_profiles` row (`:165`), never from client
input. `upgrade_purchased` is **not passed** → the `?? null` at `:135` writes an explicit
`null`. Reached from `POST /api/shifts/complete` (`src/pages/api/shifts/complete.ts:84-88`).

#### 2.3 Call site B — upgrade purchase

`src/lib/services/child-profiles.ts:256-262`:

```ts
  // Purchase event in the history log — ties this upgrade to the week (report).
  await appendShiftLog(client, {
    accountId: current.account_id,
    profileId,
    skills: decisionsDelta,
    upgradePurchased: upgrade.id,
  });
```

with, at `:240-243`:

```ts
  // Choosing an upgrade IS the decisions competency (+1 per purchase, fully
  // server-side). Folded monotonically into the same UPDATE that debits the
  // wallet — spending never lowers a skill (PRD guardrail).
  const decisionsDelta: SkillDelta = { decisions: { firstTryCorrect: 1, completed: 1, misses: 0 } };
```

Reached from `POST /api/upgrades/buy` (`src/pages/api/upgrades/buy.ts:43`), where
`upgradeId` is `z.enum(UPGRADE_IDS)` (`buy.ts:17`) and is re-resolved through
`getUpgrade(upgradeId)` (`child-profiles.ts:217`) before any DB work — so the stored value
is always a real catalog id at write time.

#### 2.4 The discriminator — verified, with the caveat the previous step missed

The claim carried into this change ("`upgrade_purchased` is non-null only on purchase
rows") is **confirmed on all three surfaces**:

- migration — `upgrade_purchased text null`, no default, comment "Set only on a purchase event".
- shift path — omits the field → explicit `null`.
- purchase path — always sets `upgrade.id`.
- pinned by test — `tests/shifts-complete.test.ts:235`:
  `expect(rows[0].upgrade_purchased).toBeNull(); // a plain shift, not a purchase`.

**Caveat the planner must carry:** `skills` is `not null` on every row, so a purchase row
is *not* an empty row with an upgrade id — it carries the fixed decisions delta above.
The two payloads happen to be disjoint by key (shift: `math`+`money`, no `decisions`;
purchase: `decisions` only), but **nothing at the DB level enforces that**, so the jsonb
keys are a hint, never a discriminator. One row is never both kinds: no code path writes
math/money skills together with an `upgrade_purchased`.

A second consequence, worth recording because it is a live inaccuracy elsewhere: the
weekly report's fold (`reports.ts:41`) sums *all* rows into one practice total, so its
"decisions" competency is literally a purchase counter. A feed that says "N zadań" must
compute it from shift rows only.

#### 2.5 Consistency properties the feed must respect

1. **No transaction.** Both paths do a `child_profiles` UPDATE first, then a separate
   INSERT over HTTP (`child-profiles.ts:175-187` and `:246-262`). The log write is
   fire-and-forget by design. The feed can undercount relative to the profile's
   `completed_shift_count` / `wallet_balance`. Never present it as a wallet reconciliation.
2. **Nothing recomputes profile counters from `shift_log`** — the two stores are
   independent (corroborated in `context/archive/2026-07-11-account-deletion/research.md:55`).
3. **No idempotency key on shift completion** — a replayed POST writes a second row and
   pays twice; consciously pinned by `tests/shifts-complete.test.ts:241-257`. Two identical
   adjacent feed entries are therefore *correct* behavior, not a bug to defend against.
4. Rows cascade away on profile deletion (`on delete cascade`; `tests/profile-deletion.test.ts`).

#### 2.6 The `skills` payload, exactly

**Shift row** — built in the island (`src/components/child/ShiftScreen.tsx:83-98`, which
explicitly strips `decisions`: `JSON.stringify({ math: delta.math, money: delta.money })`),
then re-validated server-side by `skillsSchema` (`src/pages/api/shifts/complete.ts:32-36`,
two keys only; zod strips unknowns) and cross-checked against the reported shift
(`complete.ts:56-57`: `math.completed + money.completed <= taskCount`,
`math.firstTryCorrect + money.firstTryCorrect <= cleanCount`). Stored shape:

```json
{ "math":  { "firstTryCorrect": 0, "completed": 0, "misses": 0 },
  "money": { "firstTryCorrect": 0, "completed": 0, "misses": 0 } }
```

Sub-field semantics are documented on `CompetencyProgress` (`src/types.ts:107-118`):
`firstTryCorrect` = nailed with zero misses (drives the level ladder), `completed` = all
successful attempts, `misses` = retained for the parent report. There is no `delta`
sub-field — the whole object *is* the delta for one event.

**Purchase row** — always exactly `{ "decisions": { "firstTryCorrect": 1, "completed": 1, "misses": 0 } }`,
identical regardless of which upgrade was bought.

**Read it with `readSkillState()`** (`src/data/skills.ts:56-68`), which normalizes any
stored jsonb to a zeroed three-competency shape and coerces garbage to 0 — that is what
`reports.ts:38-41` and the tests do. Do not trust the raw jsonb.

#### 2.7 Upgrade id → display

`upgrade_purchased` stores a lowercase id slug. Catalog: `src/data/upgrades.ts:46-105`,
six entries, each with `id`, `nameKey`, `cost`, `art`, `order`, gating fields:

| id | Polish name | cost | art |
|---|---|---|---|
| `sign` | Szyld | 30 | `/illustrations/upgrade-sign.svg` |
| `shelf` | Półka | 60 | `/illustrations/upgrade-shelf.svg` |
| `register` | Lepsza kasa | 100 | `/illustrations/upgrade-register.svg` |
| `slot` | Miejsce na produkt | 150 | `/illustrations/upgrade-slot.svg` |
| `storage` | Magazynek | 210 | `/illustrations/upgrade-storage.svg` |
| `customers` | Więcej klientów | 300 | `/illustrations/upgrade-customers.svg` |

All six SVGs are present in `public/illustrations/` — **no new art crop is needed for the
purchase rows**, which removes the `slice-map.md` obligation from the contract's artwork
rule for this feature.

Names live in i18n (`src/i18n/pl.ts:265-275`), keyed by id, because the catalog carries no
literal copy (L-003). **Use the existing helper `upgradeCopy(id)`** (`src/i18n/index.ts:29-36`)
— it returns `{ name, desc }` and falls back to `{ name: id, desc: "" }` for an unknown id.
Do not write a third one; a local duplicate already exists at
`src/components/parent/WeeklyReport.tsx:221-230`. For the icon use `getUpgrade(id)?.art`
(`src/data/upgrades.ts:112-114`) and **guard the `undefined`** — both existing consumers
tolerate stale ids deliberately, and a prior impl review flagged the one place that didn't
(`context/archive/2026-07-01-skill-path-upgrade-gate/reviews/impl-review.md:93`).

Polish competency labels, if a shift row wants them: `src/i18n/pl.ts:280-294` —
`math: "Liczenie"`, `money: "Pieniądze"`, `decisions: "Decyzje"`.

### 3. The dashboard as it stands

#### 3.1 Data flow — SSR frontmatter, no island fetching

`src/pages/app/start.astro` (224 lines). All data is resolved in the frontmatter on the
request-scoped SSR client and passed down:

- `:28-31` — `createClient(Astro.request.headers, Astro.cookies)` then
  `resolvePageProfile(supabase, Astro.cookies)`; redirects to `/app` when there is no
  profile but ≥ 2 exist.
- `:33-35` — `worldForTheme`, `getAvatar`, greeting via `t.start.greeting.replace("{name}", …)`.
- `:42-44` — `readPurchased`, `nextUpgrade`, `readSkillState`.
- `:49-70` — milestone window, saving percent, the four `stats` tiles.

`child_profiles` is read **once, indirectly**, via `resolvePageProfile` →
`listChildProfiles` (`child-profiles.ts:95`, `select("*")` ordered by `created_at desc`).
The page holds a full `ChildProfile` (`child-profiles.ts:26-42`): `id`, `account_id`,
`name`, `age`, `avatar`, `theme`, `starting_level`, `wallet_balance`,
`completed_shift_count`, `business_level`, `shop_state`, `skill_state`, `created_at`,
`updated_at`, plus `resolved.profileCount`.

#### 3.2 Islands — one, and it is prop-less

| component | directive | props |
|---|---|---|
| `ShopArt` (`src/components/child/ShopArt.tsx`) | **none** — static SSR, ships no JS | `world`, `purchased` |
| `StartShiftButton` (`.../StartShiftButton.tsx`) | **`client:load`** (`start.astro:168`) | none |
| lucide icons | none | — |

So the dashboard hydrates exactly one stateless, prop-less button. This is the pattern the
`/app/task` hydration fix established — see `src/pages/app/task.astro:31-36`, where the
shift is drawn once in the frontmatter *because* drawing it in the island rolled different
tasks during SSR and hydration and React discarded the server tree.

**Binding rule for this feature:** query the rows, resolve the timestamps, and format
every string in `start.astro`'s frontmatter. Anything non-deterministic — `new Date()`,
a relative-time string, `Math.random`, `toLocaleString` — must be resolved server-side.
The section needs no interactivity, so it should be a plain **`.astro`** component (like
`SkillCards.astro`) and ship zero JS. That also sidesteps the dev-toolbar island-props
echo that `e2e/password-reset.spec.ts:71-73` documents.

#### 3.3 Layout — where the section fits

`AppShell.astro` (221 lines) exposes exactly **one, default slot** (`:181`) inside
`<main class="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 lg:px-8 lg:pb-12">`. It is
presentation-only (`:21-22` — it never fetches or derives). Props are `heading`,
`subtitle`, `active`, `profile`, `showAvatar`, `progressPercent`, `progressLabel`.
Sidebar (`hidden … lg:flex`, `:70`) and bottom bar (`lg:hidden`, `:186`) are rendered once
and toggled with `display` only — the comment at `:15-19` states the reason: one copy of
each accessible name at every viewport.

The page content is a single grid, `start.astro:90`:

```html
<div class="grid items-start gap-6 lg:grid-cols-3">
```

with three children:

| # | line | classes | role |
|---|---|---|---|
| A | 92 | `flex flex-col gap-6 lg:col-span-2 lg:col-start-1 lg:row-start-1` | hero (world card + milestone path) |
| B | 139 | `order-last flex flex-col gap-6 lg:order-none lg:col-span-2 lg:col-start-1 lg:row-start-2` | `SkillCards` + the four results tiles |
| C | 157 | `flex flex-col gap-6 lg:col-start-3 lg:row-span-2 lg:row-start-1` | right rail (mission, next upgrade, shop link, switch profile, safety note) |

- **At `lg`+**: col 1–2 row 1 = hero, col 1–2 row 2 = skills/results, col 3 rows 1–2 = rail.
  **Row 3 of the left column is free**, and the rail's `row-span-2` keeps col 3 row 3 empty.
  A new child with `lg:col-span-2 lg:col-start-1 lg:row-start-3` slots in below the results
  without moving anything — which is exactly where the mockup draws it (§6.1).
- **Below `lg`**: the grid collapses to one implicit column and children flow by `order`.
  Everything is `order-0` except B, which is `order-last` — deliberate (`:137-138`: the
  mission CTA must sit directly under the hero as in the mobile mockup). Mobile order today
  is therefore **hero → rail → skills/results**.
- **Gotcha:** a new grid child appended DOM-last with no `order-*` renders on mobile as
  hero → rail → **new section** → skills/results. To keep it last on mobile the lowest-risk
  slot is **nesting it inside block B's `flex flex-col gap-6` container** — it inherits both
  the `order-last`/`lg:order-none` mobile ordering and the `lg:col-span-2 lg:row-start-2`
  placement and simply extends that column downward. (Planner picks; both work, only the
  naive third-sibling version is wrong.)

#### 3.4 Primitives available

`src/components/ui/` contains only `alert-dialog`, `button`, `checkbox`, `input`, `label`,
`card`. **There is no `separator`, `badge`, `avatar`, `list`, or `scroll-area`, and nothing
generic for a feed row.** The child surfaces deliberately do **not** use shadcn `<Card>`;
the reusable primitive is the class-builder `childCard()`
(`src/components/child/childCard.ts:10`), chosen so it composes into any element in `.astro`
or `.tsx` without restructuring markup. Use `class:list={[childCard("2xl", "p-4")]}`.

The structural precedent to copy is `SkillCards.astro:28-30` — a `<section class="flex flex-col gap-4">`
with an `<h2 class="text-foreground text-lg font-bold lg:text-xl">` and a `<ul>` — identical
to the results heading at `start.astro:144`.

Icons: lucide, imported in the `.astro` frontmatter, always `className` (never `class`),
always sized with Tailwind `size-*`, no `client:*` directive. `start.astro:3` already imports
`Check, Lock, ShieldCheck, Target`. The map-driven aliasing pattern for keying an icon off a
type is `SkillCards.astro:35` (`const { icon: Icon, tint } = META[competency];`).

### 4. The query

#### 4.1 Nothing today returns raw rows

`src/lib/services/reports.ts` (115 lines) exports `ShiftLogRow` (`:13-16` — only
`skills` + `upgrade_purchased`), `aggregateWeeklyReport` (`:37-47`, pure),
`startOfWeek` (`:75-92`) and `getWeeklyReport` (`:102-115`). The only DB touch is
`:107-113`:

```ts
  const { data, error } = await client
    .from("shift_log")
    .select("skills, upgrade_purchased")
    .eq("profile_id", profileId)
    .gte("created_at", startOfWeek(now))
    .order("created_at", { ascending: true });
  if (error) throw error;
  return aggregateWeeklyReport(profileId, data);
```

It selects neither `id` nor `created_at`, orders **ascending** (oldest-first — the opposite
of a feed), has **no `.limit()`**, and returns an aggregate. **No function anywhere in
`src/lib/services/` returns raw recent `shift_log` rows.** The other four services are
`active-profile.ts` (active-profile cookie + fallback ladder), `child-profiles.ts` (all
`child_profiles` access + both `shift_log` writers), `parent-pin.ts`, `password-reset.ts`.

#### 4.2 The smallest new query that fits the conventions

Belongs in `reports.ts` (the `shift_log` **read** module; `child-profiles.ts` owns the write
side). Shape suggested by `getWeeklyReport` + `listChildProfiles`:

```ts
export async function listRecentActivity(
  client: SupabaseClient,
  profileId: string,
  limit = 3,
): Promise<ActivityRow[]> {
  const { data, error } = await client
    .from("shift_log")
    .select("id, created_at, skills, upgrade_purchased")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as ActivityRow[];
}
```

Conventions honored: client is argument 1, never constructed; `list*` prefix for a plural
raw-row read (matching `listChildProfiles`); explicit column list, never `select("*")` on
this table. The `(profile_id, created_at)` index covers it as-is.

**Ordering/limiting/scoping answers:** newest-first (`ascending: false`), an explicit
`.limit(n)` (the mockup shows 3 — §6.1), and the query is **per-profile scoped by the
explicit `.eq("profile_id", …)` on top of account-level RLS** (§1.2). The `profileId` is
never client input — it comes from `resolvePageProfile` → `listChildProfiles`, and
`active-profile.ts:8-10` records why that is safe: a forged/stale/foreign id yields zero
rows → fallback, never another account's child. A non-owner probing a foreign id therefore
sees an **empty feed**, not an error and not another family's data.

#### 4.3 Types

There is **no generated `database.types.ts`** — `src/db/` does not exist and no `Database`
generic is ever applied; row shapes are hand-written interfaces cast at the call site.
Two tiers, and the planner should place the new type accordingly:

- **DB-row shapes live beside the query**, snake_case preserved: `ShiftLogRow`
  (`reports.ts:13`), `ChildProfile` (`child-profiles.ts:26`), `AccountSettingsRow`
  (`parent-pin.ts:25`).
- **Domain/UI types live in `src/types.ts`**, camelCase, plain PascalCase names
  (`WeeklyReport:146-150`, `ShopState:92-94`, `CompetencyProgress:113-117`). Its header
  (`:1-6`) is a hard constraint: dependency-free — no i18n, React or Supabase imports —
  so it can be consumed from pure logic, `.astro` frontmatter and islands alike.

So: the raw row type next to the query in `reports.ts`; a presentational view-model (if the
plan derives one) in `src/types.ts` next to `WeeklyReport`. Precedent supports both existing.
No `DTO`/`Row` suffix convention beyond the above.

#### 4.4 Error handling

Three deliberate patterns coexist. The one to copy is `getWeeklyReport`'s **throw**
(`reports.ts:113`), documented at `:97-100`: a query error must not fold into an empty
report, "so a DB failure can never masquerade as 'nothing practiced this week' (S-09)".
The caller catches per child and renders an honest error card
(`src/pages/app/report.astro:35-42`). The other two — a `Result` union for writes
(`DeleteProfileResult`, `BuyUpgradeResult`), and swallow-to-empty for reads where empty is
a legitimate answer (`listChildProfiles:94-97`) — do not fit a feed, because "nothing
happened yet" and "the query failed" must look different.

#### 4.5 Client provenance

Every service takes the SSR request-scoped client as an argument and none constructs one.
`src/lib/supabase.ts:21-25` builds it with `createServerClient` from cookies — the **anon
key acting as the signed-in parent**, so RLS applies. The dashboard already creates it at
`start.astro:28`. The service-role client (`src/lib/supabase-admin.ts:19-21`) is used in
exactly one place, `src/pages/api/account/delete.ts:43`, and never for reads — the new
query must not touch it.

### 5. What a feed entry can truthfully say

`shift_log` has **no earnings, money, amount, coins or wallet column** — confirmed against
the migration; the row has five columns and no numeric column at all outside the jsonb.
This matches the notes already on disk (`context/changes/parent-weekly-activity-chart/handoff.md:26`,
`context/changes/web-shell-and-mockup-parity/handoff.md:116`) and the run log's F4 entry.

#### 5.1 Every field genuinely available

| Field | Source | Available on |
|---|---|---|
| Event timestamp | `created_at` (timestamptz, server-set) | both |
| Event kind | `upgrade_purchased === null` | both |
| Which child | `profile_id` | both |
| Upgrade bought (name, art, cost) | `upgrade_purchased` → `upgradeCopy(id)` + `getUpgrade(id)` | purchase only |
| Tasks completed in the shift | `skills.math.completed + skills.money.completed` | shift only |
| First-try-correct count | `skills.math.firstTryCorrect + skills.money.firstTryCorrect` | shift only |
| Misses | `skills.{math,money}.misses` | shift only |
| Per-competency split ("Liczenie" / "Pieniądze") | which of `skills.math` / `skills.money` has `completed > 0` | shift only |
| Stars for the shift | derived: `starsForShift(taskCount, cleanCount)` (`src/data/shift.ts:89-96`) | shift only, derived |

Not on the row and not derivable: business level at the time, world, wallet balance
before/after, shift duration, which task texts were served, "sales", "customer satisfaction".

#### 5.2 The three candidate labels, graded

1. **Money delta per row (as the mockup draws it) — do not ship for shifts.**
   Shift earnings *are* arithmetically re-derivable: `src/data/shift.ts:84-86` is
   `EARN_PER_TASK * taskCount + EARN_PER_CLEAN * cleanCount` with `EARN_PER_TASK = 5`
   (`shift.ts:33`) and `EARN_PER_CLEAN = 3` (`shift.ts:35`), and both sums are stored. But
   those constants are explicitly documented as tunable first-guess defaults pending
   kid-testing (`src/data/upgrades.ts:5-6`, same posture in `shift.ts`). Re-deriving means
   **every historical row silently re-prices when a constant changes** — a displayed
   "+12 zł" that was never the amount credited. That is the *no invented data* rule with
   extra steps. The honest options are to show no money on shift rows, or to wait for F4's
   earnings column.
2. **Upgrade cost on purchase rows — defensible.** `getUpgrade(id).cost` is a catalog
   constant, not a re-derivation of history, and prices are stable in a way earn-rates are
   not. "Ulepszenie: Szyld · −30 zł" is truthful *today* with the same (much weaker)
   tunability caveat. Note the asymmetry it creates: money on purchase rows, none on shift
   rows. The planner should decide deliberately rather than let it happen.
3. **Counts and competencies — unambiguously truthful, and the cheapest.** A shift row can
   say "Ukończona zmiana · 5 zadań" or "… 4 z 5 za pierwszym razem" from stored integers
   with no derivation. Both come straight out of `skills` via `readSkillState`.

Guardrail worth carrying: the parent report deliberately hides miss/failure counts
(`src/components/parent/WeeklyReport.tsx:32`). A **child-facing** feed showing "3 pomyłki"
would break that product posture — surface first-try successes, not failures.

### 6. The mockups (binding — read directly at `22ddebd`)

#### 6.1 Web — `assets/matmaverse-ui-v2-web/02-child-dashboard-web.png` (1586×992)

The section is the **last block of the main (left) column**, below "Twoja kawiarnia —
wyniki" and spanning the full width of that column. It does **not** enter the right rail
(which at that height carries the "Bezpieczna nauka" panel). This maps exactly onto the
free `lg:col-span-2 lg:col-start-1 lg:row-start-3` slot identified in §3.3.

- **Header row**: `Ostatnia aktywność` as a left-aligned section heading, visually matched
  to "Twoje umiejętności" and "Twoja kawiarnia — wyniki"; on the far right of the same row,
  a blue link `Zobacz wszystkie ›` (chevron).
- **Entries: three, laid out as a horizontal 3-column grid of equal cards** — not a vertical
  list. Each card is white, rounded (~2xl), 1px border, light shadow, generous horizontal
  padding.
- **Entry structure**, left to right: a **solid circular icon badge** (~40px) — green circle
  with a white check for the mission row, orange circle with a white shopping cart for the
  sale row, blue circle with a white up-arrow for the upgrade row; then a two-line text
  block — line 1 is the bold-ish dark label, line 2 is a smaller muted timestamp; then, right
  aligned, a coloured amount.
- **The three drawn entries**: `Misja: Policz resztę` / `Dzisiaj` / `+12 zł` (green);
  `Sprzedaż: Cappuccino` / `Dzisiaj` / `+6 zł` (green); `Ulepszenie:  Ekspres` / `Wczoraj` /
  `-50 zł` (red).
- **Timestamps are day-granularity words — `Dzisiaj` / `Wczoraj` — not "2 godziny temu".**
  The mockup never shows an hour-level relative time anywhere on this screen.
- Three product facts the mockup asserts that the codebase cannot: the money deltas (§5.2),
  the `Sprzedaż: Cappuccino` row (products do not exist as an entity — `shop_state` holds
  only `{ purchased: string[] }`; this is backlog item B2 in
  `context/changes/web-shell-and-mockup-parity/handoff.md:166-174`), and the destination of
  `Zobacz wszystkie` (no such route exists — the *no dead navigation* rule applies).

#### 6.2 Mobile — `assets/matmaverse-ui-v2-mobile/02-child-dashboard-mobile.png` (853×1844)

**There is no "Ostatnia aktywność" section on the mobile mockup.** The screen runs:
greeting + wallet chip → world card with level/progress → today's mission card with
"Start misji" → three competency cards → a two-up row of "Zysk dzisiaj" and "Następne
ulepszenie" → bottom tab bar. The feed simply is not drawn.

So the mockups give no binding answer for how the section reflows below `lg`. That is an
**open design decision** (§8, Q2), not a detail to improvise: the honest readings are
(a) stack the three cards vertically under the results block — consistent with how every
other multi-column dashboard row already reflows — or (b) treat it as a desktop-only
affordance, which would be the first `lg:`-gated *content* on the page and sits awkwardly
with the "one copy of each name in the a11y tree" rule (it would be zero copies on `touch`,
which is legal but makes any e2e assertion project-specific).

### 7. Copy, time formatting, and the test surface

#### 7.1 Where the Polish strings go

`src/i18n/` holds exactly two files: `pl.ts` (506 lines, one nested `export const pl = {…} as const`)
and `index.ts` (36 lines, `export const t: Dictionary = pl` plus two helpers). Keys are
organised **by screen/surface**. The dashboard block is `src/i18n/pl.ts:186-214`, and it
already carries the project's own reminder of the rule this feature must obey:

```ts
    // Dashboard sections (ui-v2 `02-child-dashboard`). Every tile below reports a
    // value the profile actually stores — no invented metrics (the mockup's
    // sales/satisfaction tiles have no data source yet, so they are not rendered).
```

New keys belong **inside `start: { … }`, appended after `safetyBody` (`pl.ts:213`)**, as
their own commented sub-block. Sibling conventions: flat camelCase leaves, section headings
suffixed `…Heading` (`missionHeading`, `nextUpgradeHeading`, `resultsHeading`), templates
carrying `{placeholder}` interpolated manually with `.replace()` (there is no `t()`
function). An empty-state key is precedented (`report.noPractice`, `upgradeShop.emptyAffordable`).
Components import `{ t } from "@/i18n"` and read `t.start.x` directly in both `.astro` and
`.tsx` — it is never threaded through props.

Note `tests/i18n-helpers.test.ts` does **not** snapshot the dictionary, so adding keys
breaks no unit test.

#### 7.2 Relative time — nothing exists today

Grepped across `src/`, `tests/`, `e2e/`, `scripts/`:

- **No date library in `package.json`** — no `dayjs`, `date-fns`, `luxon`, `moment`, `@formatjs/*`.
- **`Intl.RelativeTimeFormat` appears nowhere**, with `pl` or otherwise.
- **No `toLocaleDateString` / `toLocaleTimeString` / `toLocaleString` anywhere.**
- **No "temu" string anywhere.**
- The only date machinery is in `reports.ts`: `REPORT_TIME_ZONE = "Europe/Warsaw"` (`:50`),
  `zoneOffsetMinutes()` (`:55-65`, `Intl.DateTimeFormat("en-US", { timeZoneName: "longOffset" })`
  regex-parsed, DST-correct, zero deps) and `startOfWeek()` (`:75-92`, two-pass DST
  resolution). **All three are module-private** — only `startOfWeek` is exported, and
  nothing outside `tests/reports.test.ts` imports it.
- The only `pl`-locale `Intl` usage in the app is `new Intl.PluralRules("pl")` in
  `src/i18n/index.ts:22`, backing `charsNeeded(n)` (`:11-27`) — the established precedent
  for Polish plural forms: a `Record<Intl.LDMLPluralRule, string>` table selected by
  `PluralRules`.

Two consequences. First, "Dzisiaj"/"Wczoraj" (what the mockup actually draws — §6.1) needs
a **Europe/Warsaw calendar-day comparison**, not a millisecond delta: 23:30 yesterday and
00:30 today are 1 hour apart but are different days. `REPORT_TIME_ZONE` and
`zoneOffsetMinutes` would need exporting from `reports.ts` (or the day-boundary helper
extracting alongside `startOfWeek`) — do not duplicate the DST logic. Second, if the plan
*does* want "2 godziny temu", `Intl.RelativeTimeFormat("pl")` produces it natively and is
the smaller change; the hand-rolled path would need its own godzina/godziny/godzin table on
the `charsNeeded` pattern. Either way the string must be computed in the frontmatter
(§3.2), which also means it is fixed at render time and will not tick.

#### 7.3 Unit tests

Runner is vitest (`vitest.config.ts`: node env, `include: ["tests/**/*.test.{ts,tsx}"]`,
`fileParallelism: false`, `@` → `./src`, stubs for `astro:env/server` / `astro:middleware`).
**No unit test renders `/app/start` or any Astro page** — the dashboard is covered by e2e only.

Relevant suites: `tests/reports.test.ts` (12 tests — the error contract, `startOfWeek` DST
boundaries, pure aggregation), `tests/report-isolation.test.ts` (3, real local Supabase),
`tests/shift-log-isolation.test.ts` (5, the four policies), `tests/shifts-complete.test.ts`
(10, route-level), `tests/cross-device-restore.test.ts` (2 — the closest thing to a
"dashboard data" test; it asserts `resolvePageProfile` output).

**The one concrete snag to plan for**: `tests/reports.test.ts:17-26` fakes Supabase with a
hand-rolled fluent-chain stub whose terminal `await` lands on `.order(…)`:

```ts
function stubClient(result: { data: ShiftLogRow[] | null; error: { message: string } | null }): SupabaseClient {
  const chain = { select: () => chain, eq: () => chain, gte: () => chain, order: () => Promise.resolve(result) };
  return { from: () => chain } as unknown as SupabaseClient;
}
```

A `listRecentActivity` ending in `.limit(n)` **will not work against this stub** — it needs
`order: () => chain, limit: () => Promise.resolve(result)`, i.e. the stub generalized (every
method returns a thenable `chain`) or a second local stub added. There is no shared
query-chain mock in `tests/helpers/`. Integration fixtures come from
`tests/helpers/supabase.ts`: `createSignedInUser(prefix)` (`:44-60`) returns an anon client
already signed in; `admin` (`:33-35`) is provisioning-only and explicitly "never to act as a
user under test". The pattern to copy for a read-path test is `report-isolation.test.ts:42-66`
— seed through the account's own client, positive control plus a non-owner probe.

#### 7.4 E2E — the locator collision surface

Specs: `e2e/seed.spec.ts`, `smoke.spec.ts`, `onboarding.spec.ts`, `gameplay-restore.spec.ts`,
`parent-surfaces.spec.ts`, `password-reset.spec.ts` (15 `test()` blocks → 17 executed runs).
Projects (`playwright.config.ts`): **`desktop`** = Desktop Chrome, 1280×720, runs everything;
**`touch`** = Galaxy Tab S4, **712×1138**, `isMobile`, scoped by
`testMatch: /gameplay-restore\.spec\.ts/`. Global `locale: "pl-PL"`, `baseURL` :4321.

Specs that land on `/app/start`: `seed.spec.ts`, `onboarding.spec.ts` (test 1),
`gameplay-restore.spec.ts` (both tests, in **both** projects).

**The complete set of existing dashboard locators** — six expressions, four distinct strings:

| file:line | locator | string |
|---|---|---|
| `e2e/seed.spec.ts:28` | `getByRole("heading", { name: fill(t.start.greeting, { name: childName }) })` | `Cześć, {name}!` |
| `e2e/seed.spec.ts:29` | `getByText(t.start.walletLabel)` | **`Portfel`** |
| `e2e/onboarding.spec.ts:84` | `getByRole("heading", { name: fill(t.start.greeting, …) })` | `Cześć, {name}!` |
| `e2e/gameplay-restore.spec.ts:31` | `getByRole("button", { name: t.start.open })` | `Czas otworzyć sklep!` |
| `e2e/gameplay-restore.spec.ts:55` | `getByRole("link", { name: t.start.upgradesLink })` | `Rozbuduj sklep` |
| `e2e/gameplay-restore.spec.ts:105, :126` | `getByRole("heading", { name: fill(t.start.greeting, { name: "Pola" }) })` | `Cześć, {name}!` |

Playwright matches `getByText` and `getByRole({name})` **case-insensitively, whitespace-
normalized, as substrings**, and every one of these is wrapped in `toBeVisible()` — which is
strict mode, so **two matches is a failure**. A new Polish label on `/app/start` must not
contain, case-insensitively:

1. **`portfel`** — highest risk, and the historically confirmed one: the parity change broke
   `getByText('Portfel')` with a new "W portfelu" label and renamed the tile to "Oszczędności"
   (`context/changes/web-shell-and-mockup-parity/handoff.md:80-82`; today `t.start.statWallet: "Oszczędności"`
   while `t.start.walletLabel: "Portfel"` survives as the sr-only HUD label). Anything like
   "Do portfela", "w portfelu", "Portfel dziecka" in a feed entry re-breaks `seed.spec.ts:29`.
2. **`rozbuduj sklep`** — link role. A feed entry rendered as an `<a>` whose text contains
   this phrase collides with `gameplay-restore.spec.ts:55`.
3. **`czas otworzyć sklep!`** — button role.
4. **`cześć,`** — heading role only, so a new `<h2>`/`<h3>` is safe unless it embeds the greeting.

Two page-specific traps: `getByRole` filters a11y-hidden copies but **`getByText` does not**,
and `AppShell` renders every nav label twice (desktop `<aside>` + mobile `<nav>`, toggled with
`hidden`) — so a new string asserted by text that also appears in the nav double-matches;
prefer role-based locators. And `gameplay-restore.spec.ts` runs in both projects, so a
viewport-dependent rendering of the feed changes what is in the a11y tree per project.

`e2e/CLAUDE.md` binds: `getByRole`/`getByLabel`/`getByText` are primary; **`getByTestId` is a
fallback only** and the file states none exist in `src/` today — *"if you need one, that's a
product finding to surface first"*, so adding `data-testid` is a decision to record, not a free
move (confirmed: `grep -rn "data-testid" src/` returns zero hits; the only non-test data
attribute on the dashboard is `data-wallet-amount`, `HudChip.tsx:19`, read by the wallet
live-update listener at `AppShell.astro:213-221`). Also binding: no CSS/XPath/structure
locators, every matched string must come from the dictionary via `e2e/helpers/i18n.ts`
(`t`, `fill`, `templateRegex`), no `page.waitForTimeout()`, self-provisioned accounts with
`try/finally` cleanup, model new specs on `e2e/seed.spec.ts`.

## Code References

- `supabase/migrations/20260701150000_create_shift_log.sql:22-34` — the entire effective schema
- `supabase/migrations/20260701150000_create_shift_log.sql:36-64` — RLS enable + four policies
- `src/lib/services/child-profiles.ts:120-137` — `appendShiftLog`, the only insert
- `src/lib/services/child-profiles.ts:186-187` — shift-completion call (no `upgrade_purchased`)
- `src/lib/services/child-profiles.ts:240-243, 256-262` — purchase call (fixed decisions delta + `upgrade.id`)
- `src/lib/services/reports.ts:13-16, 102-115` — `ShiftLogRow`, `getWeeklyReport` (the only read)
- `src/lib/services/reports.ts:50-92` — `REPORT_TIME_ZONE`, `zoneOffsetMinutes`, `startOfWeek` (2 of 3 private)
- `src/pages/app/start.astro:28-31, 90, 92, 139, 144, 157` — SSR fetch, grid container, the three columns, the `<h2>` convention
- `src/components/app/AppShell.astro:15-19, 181` — the one-copy-per-name rule; the single default slot
- `src/components/child/childCard.ts:10` — the card primitive to use instead of shadcn `<Card>`
- `src/components/child/SkillCards.astro:28-30` — heading + list section precedent
- `src/data/upgrades.ts:46-105, 112-114` — catalog and `getUpgrade`
- `src/i18n/index.ts:11-27, 29-36` — `charsNeeded` (Polish plural precedent), `upgradeCopy`
- `src/i18n/pl.ts:186-214` — the `start` block, with the no-invented-metrics comment
- `src/data/shift.ts:33-35, 84-86, 89-96` — earn constants, `earningsForShift`, `starsForShift`
- `src/types.ts:1-6, 107-118, 146-150` — the dependency-free rule, `CompetencyProgress`, `WeeklyReport`
- `tests/reports.test.ts:17-26` — the chain stub that terminates on `.order` (blocks a `.limit()` query)
- `tests/shifts-complete.test.ts:235` — the assertion pinning `upgrade_purchased` null on shift rows
- `e2e/seed.spec.ts:28-29`, `e2e/gameplay-restore.spec.ts:31, 55` — the dashboard locators at risk
- `docs/reference/contract-surfaces.md:25-39` — the registered `shift_log` contract (keep in sync)

## Architecture Insights

- **Read-side and write-side of `shift_log` are deliberately split across two services**:
  `child-profiles.ts` writes, `reports.ts` reads. A new feed query belongs in `reports.ts`
  even though the feature is a child screen, not a parent report.
- **Truthfulness is enforced by convention, not by types.** The dictionary itself carries
  the reminder (`pl.ts:186-214`), and the aggressive part of it — that a *derivable* number
  can still be untruthful when its constants are tunable — is not written down anywhere.
  This research adds it (§5.2); it is a candidate `/10x-lesson` if the planner adopts it.
- **The hydration lesson from `/app/task` generalises to a rule about non-determinism**, not
  just randomness: `new Date()` in an island is the same class of bug as `Math.random()`.
  A relative timestamp is precisely the hazard the previous fix was about.
- **Astro pages are untested at unit level by design**; the entire dashboard contract lives
  in four e2e strings. That makes the substring-collision surface unusually small and
  unusually fragile at the same time.
- **`select("*")` is used on `child_profiles` but never on `shift_log`** — the explicit
  column list is the house style for the log table, worth preserving.

## Historical Context (from prior changes)

- `context/changes/web-shell-and-mockup-parity/handoff.md` §3 — the five binding rules this
  change inherits (no invented data, no dead navigation, one copy of each name, `hidden` vs
  `display`-setting classes, i18n only). §5 lists this very feature as a quick win, and §4.B4
  is where the earnings column is queued.
- `context/changes/web-shell-and-mockup-parity/handoff.md:80-82` — the `getByText('Portfel')`
  vs "W portfelu" breakage, and the "Oszczędności" rename that fixed it.
- `context/changes/parent-weekly-activity-chart/handoff.md:26` — the parallel F1 change
  reached the same conclusion about earnings not being stored. **F1 is researching
  concurrently and will very likely extend `reports.ts`** — see Q5.
- `context/archive/2026-07-01-skill-path-upgrade-gate/reviews/impl-review.md:93` — the review
  finding that established "guard `getUpgrade()` returning undefined for a stale id".
- `context/archive/2026-07-11-account-deletion/research.md:55` — confirms nothing recomputes
  profile counters from `shift_log`.
- `context/foundation/lessons.md` — L-001 (RLS in the same migration; not triggered here,
  no schema change), L-002 (verify durable state, not the API response — shapes how an
  isolation test for the new query should be written), L-003 (no inline literals).

## Related Research

- `context/changes/parent-weekly-activity-chart/` — F1, same table, aggregate side.
- `context/archive/2026-07-11-account-deletion/research.md` — `shift_log` cascade behaviour.

## Open Questions

These are decisions the **planner** must close; research has narrowed each to a choice with
consequences, not left them open-ended.

1. **What does a shift entry display where the mockup draws `+12 zł`?** §5.2 argues against
   re-deriving earnings from `EARN_PER_TASK`/`EARN_PER_CLEAN` and for a stored-integer label
   ("Ukończona zmiana · N zadań"). The planner must pick and record it, including whether
   purchase rows alone carry a money figure (the catalog cost), which is defensible but
   creates a visual asymmetry.
2. **What happens to the section below `lg`?** The mobile mockup does not draw it at all
   (§6.2). Stack vertically, or gate it to `lg:`? A `lg:`-gated block would be the page's
   first viewport-dependent *content* and interacts with the one-copy-per-name rule and the
   `touch` project.
3. **`Zobacz wszystkie ›` has no destination.** No "all activity" route exists. Under the
   no-dead-navigation rule the link should be omitted — confirm, and confirm the heading row
   still looks right without it.
4. **`Sprzedaż: Cappuccino` cannot ship.** Products do not exist as an entity (B2 backlog).
   The feed therefore has two entry kinds, not three. Confirm the mockup's middle card is
   simply not rendered rather than substituted.
5. **Coordination with F1.** `parent-weekly-activity-chart` is in research concurrently and
   will extend the same file (`src/lib/services/reports.ts`) and very likely the same private
   timezone helpers. Decide whether F2 exports `REPORT_TIME_ZONE`/day-boundary logic, waits
   for F1, or keeps its day comparison local — and record it, because both changes cut
   branches from `feat/ui-polish`.
6. **How many entries, and what does an empty feed say?** The mockup shows exactly three
   (§6.1). A brand-new profile has zero rows; `report.noPractice` / `upgradeShop.emptyAffordable`
   are the precedents for an empty-state string.
7. **Does the query error surface, or fall back to empty?** §4.4 argues for the
   `getWeeklyReport` throw + caller-catch posture so a DB failure cannot look like "nothing
   happened yet". Confirm the dashboard is willing to render an error state — today
   `start.astro` has no per-section error branch, only the whole-page `EmptyStateCard`.
8. **Does `tests/reports.test.ts`'s chain stub get generalized or duplicated?** (§7.3) —
   a `.limit()` terminal breaks it either way.
