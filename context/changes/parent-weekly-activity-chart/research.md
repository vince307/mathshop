---
date: 2026-08-22T20:16:23Z
researcher: Claude (autonomous run 2026-08-22-autonomous-five, step F1/research)
git_commit: 22ddebd9e20bad4ed23613cbfa2fcbd69cd8c7b5
branch: feat/ui-polish
repository: 10xDevs
topic: "What exactly does the parent weekly report aggregate today, and what is the shortest correct path to add (a) a Monday–Sunday activity bar chart and (b) a first-try-correct percentage tile, using only data already stored?"
tags: [research, codebase, parent-report, reports-service, shift-log, skill-state, svg-chart, i18n]
status: complete
last_updated: 2026-08-22
last_updated_by: Claude (autonomous run)
---

# Research: parent weekly report — activity chart + first-try-correct tile

**Date**: 2026-08-22 20:16 UTC
**Researcher**: Claude (autonomous run `2026-08-22-autonomous-five`, step F1 research)
**Git Commit**: `22ddebd9e20bad4ed23613cbfa2fcbd69cd8c7b5`
**Branch**: `feat/ui-polish`
**Repository**: 10xDevs (MatmaVerse / MathShop)

## Research Question

What exactly does the parent weekly report aggregate today, and what is the shortest
correct path to add (a) a Monday–Sunday activity bar chart and (b) a first-try-correct
percentage tile, using only data already stored?

## Autonomous decisions

This run executes with no human in the loop (`context/runs/2026-08-22-autonomous-five/agent-contract.md`,
hard rule 1). The skill opens by asking for a research question and later wants
`AskUserQuestion` for scope. Neither was asked; both were decided here.

- **Research question**: supplied verbatim above by the orchestrating step, not elicited.
- **Depth: detailed architectural dive, not a quick overview.** Rejected "quick overview"
  because this document feeds `/10x-plan` directly with no human review in between — a
  planner that has to re-derive week boundaries or guess the data source would produce a
  wrong plan silently. *What would change the answer:* if a human were reviewing the plan
  before implementation, an overview would suffice.
- **Focus: architecture/patterns AND integration points.** Rejected "history & evolution"
  as the primary lens, but ran it as a fifth parallel sweep anyway because the mockup's
  tiles were *explicitly parked once before* (see Historical Context) — and that turned up
  the single most important finding in this document (the non-shaming guardrail tension).
- **Method**: five parallel sub-agents (pipeline trace, data shape, test surface,
  historical context, SVG/i18n). The SVG/i18n agent stalled and was **not** used; that
  dimension was gathered directly in the main context instead. Both mockup PNGs were read
  first-hand in the main context rather than delegated, because the contract makes them
  binding.

## Summary

**The shortest correct path is small and it is already 80% built.**

1. **The percentage tile needs no new data at all.** `aggregateWeeklyReport` already folds
   the week's `shift_log.skills` deltas into `practice[competency] = { firstTryCorrect,
   completed, misses }` (`src/lib/services/reports.ts:37-47`). The tile is a ratio over a
   value the shipped `WeeklyReport` object already returns. **F1's own handoff states this
   wrongly** — it says the counters come from `skill_state`. `skill_state` is
   lifetime-cumulative and monotonic by design, so it *cannot* produce a weekly figure.
   The correct source is the weekly `practice` aggregate. See "Discrepancy A".
2. **The chart needs exactly one new column in an existing `select`.** `created_at` is
   filtered and ordered on but never projected (`reports.ts:107-112`), so no per-row day
   information reaches memory. Adding `created_at` to the `.select()` and to `ShiftLogRow`
   makes per-day bucketing a second fold over the array already in hand — **no new query,
   no second round trip, no migration, and the existing `(profile_id, created_at)` index is
   untouched**.
3. **Three real traps**, none of them obvious:
   - Summing `firstTryCorrect / completed` across **all three** competencies inflates the
     percentage, because every upgrade purchase writes `decisions: { firstTryCorrect: 1,
     completed: 1 }` — a term that is 100% by construction. Compute over `math + money`.
   - `0 / 0` → `NaN` → renders literally as `NaN%`. A brand-new profile hits this on every
     load. There is no existing guard.
   - There is **no week-END boundary anywhere in the codebase**. `startOfWeek` exists and is
     exported; the query is open-ended (`.gte` with no `.lte`). A 7-bucket chart must derive
     the day frame itself.
4. **A prior change deliberately parked exactly these two tiles**, and flagged the
   percentage as a possible guardrail violation. F1 is un-parking them. The plan must record
   that as a deliberate override, not walk past it. See "Discrepancy C".

## Detailed Findings

### 1. `src/lib/services/reports.ts` — what it computes today

115 lines. Four exports, nothing else.

```ts
// src/lib/services/reports.ts:13-16
export interface ShiftLogRow {
  skills: unknown;
  upgrade_purchased: string | null;
}
```

```ts
// src/lib/services/reports.ts:37
export function aggregateWeeklyReport(profileId: string, rows: ShiftLogRow[]): WeeklyReport

// src/lib/services/reports.ts:75
export function startOfWeek(now: Date): string          // returns a UTC ISO string

// src/lib/services/reports.ts:102-106
export async function getWeeklyReport(
  client: SupabaseClient,
  profileId: string,
  now: Date = new Date(),
): Promise<WeeklyReport>
```

Private: `upgradeSkillTie` (`:23`), `zoneOffsetMinutes` (`:55`),
`const REPORT_TIME_ZONE = "Europe/Warsaw"` (`:50`), `WEEKDAY_FROM_MONDAY` (`:52`).

#### Europe/Warsaw handling

Native `Intl.DateTimeFormat` only — **no date library, and adding one is out of bounds**
(the precedent is explicit: `context/archive/2026-07-06-minimal-parent-weekly-report/plan-brief.md:27`,
"Timezone implementation | `Intl.DateTimeFormat`, no new dependency | Stack has no date library").

Two passes:
1. `zoneOffsetMinutes` (`:55-65`) formats with `timeZoneName: "longOffset"` and regex-parses
   `/GMT([+-])(\d{2}):(\d{2})/` into signed minutes; bare `"GMT"` → `0`.
2. `startOfWeek` (`:75-92`) formats `now` into a Warsaw wall-clock record, walks back to
   Monday in wall-clock space using UTC-noon arithmetic, then resolves the offset twice so
   a `now`/target-Monday pair straddling a DST transition still lands correctly:

```ts
const mondayNoon = new Date(Date.UTC(+wall.year, +wall.month - 1, +wall.day - WEEKDAY_FROM_MONDAY[wall.weekday], 12));
const midnightUtcGuess = Date.UTC(mondayNoon.getUTCFullYear(), mondayNoon.getUTCMonth(), mondayNoon.getUTCDate());
const firstPass = new Date(midnightUtcGuess - zoneOffsetMinutes(new Date(midnightUtcGuess)) * 60_000);
return new Date(midnightUtcGuess - zoneOffsetMinutes(firstPass) * 60_000).toISOString();
```

**Where week boundaries come from — and what is missing:** the Monday boundary is derived
here and is exported. **There is no `endOfWeek` and no upper bound anywhere.** The query
uses only `.gte(created_at, startOfWeek(now))`, i.e. "from Monday 00:00 Warsaw onward,
open-ended into the future". A 7-bucket Mon–Sun chart therefore has to construct its own day
frame. `zoneOffsetMinutes` and `REPORT_TIME_ZONE` are the only reusable Warsaw primitives and
**both are module-private** — a per-day grouper either exports them or re-derives Warsaw civil
dates with its own `Intl.DateTimeFormat` call. Re-deriving is the thing the prior change
explicitly warned against.

#### The exact shape it returns

Declared in `src/types.ts`, **not locally**:

```ts
// src/types.ts:146-150
export interface WeeklyReport {
  profileId: string;
  practice: SkillState;
  upgrades: WeeklyReportUpgrade[];
}

// src/types.ts:135-139
export interface WeeklyReportUpgrade {
  upgradeId: string;
  competencies: Competency[];
  generalPractice: boolean;
}

// src/types.ts:113-126
export interface CompetencyProgress { firstTryCorrect: number; completed: number; misses: number; }
export type SkillState = Record<Competency, CompetencyProgress>;
// src/types.ts:105
export type Competency = "math" | "money" | "decisions";
```

The shape is **flat and total-only — there is no time dimension anywhere**. A per-day series
means extending `WeeklyReport` in `src/types.ts:146`.

#### The query

```ts
// src/lib/services/reports.ts:107-114
const { data, error } = await client
  .from("shift_log")
  .select("skills, upgrade_purchased")
  .eq("profile_id", profileId)
  .gte("created_at", startOfWeek(now))
  .order("created_at", { ascending: true });
if (error) throw error;
return aggregateWeeklyReport(profileId, data);
```

Single table, no join, no `.limit()`. Errors **throw** — they are never folded into an empty
week (`:113`), a contract locked by `tests/reports.test.ts:32-42`.

> **RLS scope note (binding).** `shift_log` RLS is **account-scoped, not profile-scoped** —
> every policy is `using (auth.uid() = account_id)`
> (`supabase/migrations/20260701150000_create_shift_log.sql:38-63`). RLS alone would return
> **every profile's rows inside one account**. The `.eq("profile_id", profileId)` at
> `reports.ts:110` is the only thing separating siblings. **Any new or modified query must
> carry that filter itself** — dropping it is a silent within-account cross-profile leak,
> not a crash.

#### Can per-day grouping be derived without a new/changed query?

**No — but the blocker is the projection, not the data lifetime.**

- `.select("skills, upgrade_purchased")` omits `created_at`. PostgREST returns only projected
  columns, so every element of `data` is `{ skills, upgrade_purchased }` — exactly what
  `ShiftLogRow` declares. Server-side `.order()` does not add the column to the payload.
  There is no grouping key in memory. Ordering alone cannot substitute: rows carry no date.
- Lifetime is fine. `data` is passed whole to `aggregateWeeklyReport(profileId, data)`
  (`:114`), which iterates `for (const row of rows)` (`:40`). A second fold into per-day
  buckets costs **zero extra round trips**.

**Minimal change:** `.select("created_at, skills, upgrade_purchased")` plus
`created_at: string` on `ShiftLogRow`. That is it.

### 2. How the shape reaches the UI

**`src/pages/app/report.astro`** (107 lines). PIN-gated: `createClient` → `getUser` →
`verifyMarker(PARENT_VERIFIED_COOKIE)`, any failure redirects `/app/parent-pin` (`:22-29`).
Profiles come from `listChildProfiles(supabase)` (`:31`) — RLS-scoped, no id from the URL.
One report per child, in parallel:

```ts
// src/pages/app/report.astro:32-51 (abridged)
const reports: ChildReport[] = await Promise.all(
  profiles.map(async (profile) => {
    let report: ChildReport["report"] = null;
    try { report = await getWeeklyReport(supabase, profile.id); } catch { report = null; }
    return { profileId: profile.id, name: profile.name, avatarImage: ..., avatarAlt: ..., report };
  }),
);
```

Two consequences for the plan:
- **`now` is never passed** — `getWeeklyReport` defaults to `new Date()` server-side.
- Hydration is `<WeeklyReport client:load reports={reports} />` (`:59`). The whole object
  crosses the SSR→client serialization boundary, so **any new per-day field must be
  JSON-serializable** — plain numbers and strings. `Date` objects would not survive.

**`src/components/parent/WeeklyReport.tsx`** (236 lines). Props:

```ts
// src/components/parent/WeeklyReport.tsx:15-25
export interface ChildReport {
  profileId: string; name: string; avatarImage: string | null; avatarAlt: string;
  report: WeeklyReportData | null;
}
interface Props { reports: ChildReport[]; }
```

The tile pattern a new tile must match (`:139-148`):

```tsx
<ul className="mt-5 grid grid-cols-2 gap-3">
  <li className="bg-primary/5 rounded-2xl p-4">
    <p className="text-foreground text-2xl font-extrabold">{tasksThisWeek}</p>
    <p className="text-muted-foreground mt-0.5 text-xs font-semibold">{copy.statTasks}</p>
  </li>
  <li className="bg-success/10 rounded-2xl p-4">…</li>
</ul>
```

Recipe: `<li className="<tint> rounded-2xl p-4">` + value `text-foreground text-2xl
font-extrabold` + label `text-muted-foreground mt-0.5 text-xs font-semibold`. **The grid is
hard-coded `grid-cols-2`** — a third tile requires changing it. Card wrapper is
`<section className="bg-card border-border rounded-3xl border p-6 shadow-sm">` (`:136`);
sub-sections use `<div className="mt-5">` with a heading row
`text-muted-foreground flex items-center gap-2 text-sm font-semibold` and a `lucide-react`
icon at `size-4` (`BarChart3` at `:152`, `Sparkles` at `:173`).

Existing per-competency rows (`:131`, `:158-167`) render **only practiced competencies** —
`COMPETENCIES.filter(c => practice[c].completed > 0)` — deliberately, so there is nothing to
shame for the rest. Interpolation is `String.replace("{count}", …)`; there is no formatter helper.

`tasksThisWeek` (`:133`) is `COMPETENCIES.reduce((sum, c) => sum + practice[c].completed, 0)` —
note this **already includes `decisions`** in a "tasks this week" count.

### 3. What a `shift_log` row actually contains

**Only one migration ever touches `shift_log`.** Grepping every `.sql` in
`supabase/migrations/` for `shift_log` returns hits solely inside
`20260701150000_create_shift_log.sql`. The `CREATE TABLE` is the final effective schema.

```sql
-- supabase/migrations/20260701150000_create_shift_log.sql:21-30
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
```

Indexes (`:33-34`): `shift_log_account_id_idx (account_id)` and
`shift_log_profile_created_idx (profile_id, created_at)` — **the per-day query path is already
indexed**. RLS at `:36-63`: enabled, four per-operation policies, all `to authenticated`, all
`auth.uid() = account_id` (account-scoped — see the note in §1).

**There is no earnings/money column, confirmed.** The only monetary state in the whole schema
is `child_profiles.wallet_balance` (a running *balance*, renamed from `coins` in
`20260701120000_rename_coins_to_wallet_balance.sql:17`), not a per-shift record.

`shift_log` holds **two row kinds**: shift rows (`skills` delta, `upgrade_purchased` null) and
purchase rows (`skills = { decisions: {…} }`, `upgrade_purchased` set). A day-bucket count of
"missions completed" should decide which kinds it counts — the mockup's legend says
*"Liczba ukończonych misji"*, which argues for shift rows only, or for summing
`math + money` completions per day rather than counting rows.

### 4. `firstTryCorrect` / `completed` — where they live and how they are written

`skill_state` is a **jsonb column on `child_profiles`**, not a table:

```sql
-- supabase/migrations/20260701140000_child_profiles_add_skill_state.sql:20-21
alter table public.child_profiles
  add column skill_state jsonb not null default '{}'::jsonb;
```

Declared at `src/types.ts:113-126` (quoted in §1). The doc comment at `src/types.ts:108-111`
is the authoritative semantics: *"`firstTryCorrect` (tasks nailed with zero misses) drives the
level ladder; `completed` (all attempts that succeeded) drives task-history gates; `misses` is
retained for the parent report. All three are monotonic."*

Key space is a closed, ordered 3-set: `COMPETENCIES = ["math", "money", "decisions"]`
(`src/data/skills.ts:16`). `competencyForTaskType` (`src/data/skills.ts:23-25`) maps
`counting → math`, everything else → `money`, and **can never return `decisions`**.

#### Write trace

Client tally — `src/components/child/ShiftScreen.tsx:86-95`:
```ts
bucket.completed += 1;
bucket.firstTryCorrect += r.firstTry ? 1 : 0;
bucket.misses += r.misses;
```
`r.firstTry` originates at `src/components/hooks/useCoinTask.ts:58` —
`onComplete({ firstTry: misses === 0, misses })`, i.e. zero wrong `check` presses on that task.

**`completed` is incremented for every task unconditionally** — a task can only end by
succeeding (retry-until-right, FR-009). So `completed` ≡ *tasks played*, never "passed out of
attempted". That is what makes the ratio meaningful at all.

Route `src/pages/api/shifts/complete.ts:24-57` accepts only `math` and `money` from the client
and caps them:
```ts
.refine((v) => v.skills.math.completed + v.skills.money.completed <= v.taskCount)
.refine((v) => v.skills.math.firstTryCorrect + v.skills.money.firstTryCorrect <= v.cleanCount)
```

The write is `src/lib/services/child-profiles.ts:157-190`, folding via
`addSkillDelta` (`src/data/skills.ts:76-88`, monotonic, `safeCount`-coerced), then mirroring
the same delta into `shift_log` via `appendShiftLog`.

The **second** write path is purchases — `src/lib/services/child-profiles.ts:243-262`:
```ts
const decisionsDelta: SkillDelta = { decisions: { firstTryCorrect: 1, completed: 1, misses: 0 } };
```
**Every upgrade purchase writes a perfect `decisions` row.** `decisions` is 100% first-try by
construction; there is no failure mode for it.

#### Is `Σ firstTryCorrect / Σ completed` a defensible "% correct first time"?

**Over `math + money`: yes.** It is exactly `cleanCount / taskCount`, the same accuracy signal
the codebase already trusts in `starsForShift` (`src/data/shift.ts:88-96`).

**Over all three: no.** Including `decisions` injects a term where numerator == denominator
always. A child with 10/20 tasks first-try and 5 purchases reads **60%, not 50%** — the number
drifts upward with shopping, not with learning. Compute over `["math", "money"]`.

**Denominator zero.** A brand-new profile has `skill_state = '{}'`, normalized by
`readSkillState` to all-zeros (`src/data/skills.ts:56-68`). `0 / 0` → `NaN`;
`Math.round(NaN * 100)` → `NaN`; it renders literally as **`NaN%`**. There is no existing
guard. The in-repo precedent for the guard is `src/data/shift.ts:90`: `if (taskCount <= 0) return 0;`.

**How a brand-new profile should render.** Returning `0%` is *wrong-and-shaming* — it reads as
"your child got nothing right". The honest options are to omit the tile entirely (matching the
component's own existing habit of rendering only practiced competencies, `WeeklyReport.tsx:131`)
or to render an em-dash placeholder with the existing `noPractice` voice. This is an **open
question for the planner**, not settled here — but "render `0%`" should be rejected.

Existing percentage code, all progress bars, none an accuracy rate:
`src/components/child/SkillBars.tsx:19`, `src/components/child/SkillCards.astro:34,58`,
`src/pages/app/start.astro:60-61` (the clamping idiom worth copying:
`Math.max(0, Math.min(100, Math.round(...)))`), `src/components/child/ShiftResults.tsx:79`.

### 5. The mockup, as drawn

Both PNGs were opened directly with the Read tool.

#### Web — `assets/matmaverse-missing-screens-v3-web/05-parent-weekly-report-web.png`

Sidebar (`MathMarket / Panel rodzica`) + main column. Top row: **four KPI tiles** in one row —
`18 / misji ukończonych / +4 więcej niż tydzień temu`; `92% / poprawnych odpowiedzi /
Świetny wynik!`; `+84 zł / zdobyte w tym tygodniu / Średnio 12 zł dziennie`; `1 / ulepszenie
odblokowane / Mała półka`. Each has a circular icon at the left (clipboard, green check, gold
coin, purple star), the big value in bold, the label beneath, and a small green sub-line.

**The chart card**, left column, directly under the KPI row:
- Heading: **"Aktywność w tym tygodniu"**, card-internal, dark navy, bold, left-aligned.
- **Vertical bars** (columns rising from a baseline), medium blue, rounded-ish, evenly spaced
  with clear gaps — roughly bar width ≈ gap width. Seven bars, one per day.
- **Y axis on the left**: ticks `0, 4, 8, 12, 16` with faint horizontal gridlines running the
  full card width behind the bars.
- **Value label above every bar**, small dark text: `8, 10, 14, 12, 16, 6, 8`. Every day has a
  bar; none is zero in the mockup, so the empty-day treatment is **not drawn** (open question).
- **X labels below the baseline**: `Pon`, `Wt`, `Śr`, `Cz`, `Pt`, `So`, `Nd` — note the
  mockup's Thursday abbreviation is **`Cz`**, not the more common `Czw`.
- **Legend below the axis**: a small blue square swatch + **"Liczba ukończonych misji"**.

Below the chart, a second left-column card **"Postępy w umiejętnościach"**: four rows
(Matematyka 82% +6%, Pieniądze 76% +7%, Decyzje 73% +5%, Zapasy 61% +8%), each an icon +
label + green progress bar + percentage + green delta. **`Zapasy` is a fourth competency the
product does not have**, and the `+6%` week-over-week deltas are not stored either — both are
out of scope for F1 under the no-invented-data rule.

Right of the chart: "Rozwój kawiarni" (world progression — that is F4's screen, not F1's).
Far-right rail: "Bezpieczne środowisko", "PIN rodzica", "Podsumowanie tygodnia".
Header carries a child selector, a week-range picker (`20–26 maja 2024`) and "Eksportuj
raport" — none of which exist in the product.

#### Mobile — `assets/matmaverse-missing-screens-v3-mobile/05-parent-weekly-report-mobile.png`

**The mobile mockup contains no chart at all.** This is the single most consequential mockup
finding. The phone layout is: header → child selector + week picker → a **single card holding
the four KPIs as four narrow columns in one row** (`18 misji`, `92% poprawnych`, `+84 zł
zdobyte`, `1 ulepszenie`, each with its icon above/left and a green sub-line beneath the whole
row) → "Rozwój kawiarni" → "Powiązane umiejętności" → "Polecane dalej" → "Bezpieczna nauka" +
PIN → bottom nav. The "Aktywność w tym tygodniu" card is **absent**.

So **the chart's phone reflow is undrawn**. The mockup pack's own README states the design
intent, which is the tiebreaker:

> Keep MVP web-first. Use mobile as responsive companion, **not a separate app concept**.
> — `assets/matmaverse-missing-screens-v3-prompts/README.md`

That reads as "the mobile PNG is an abridged companion", not "hide the chart on phones".
Recommended reading: **reflow the chart responsively; do not hide it behind `lg:`**. Flagged as
an open question because it is a genuine design call the mockup does not make.

Also note the mobile KPI copy is **shortened** (`18 misji` vs `18 / misji ukończonych`), which
is a second, independent responsive decision the planner must make for any new tile.

### 6. Charting and SVG precedent — there is none

Confirmed against `package.json` at the current commit: **`recharts`, `chart.js`, `d3`,
`victory`, `visx`, `nivo`, `apexcharts` are all absent** — a grep for all seven across
`package.json` returns nothing. The only rendering-adjacent dependency is `lucide-react@^1.14.0`.
F1 adds none of them (handoff constraint 2).

**Stronger finding: `grep -rn '<svg' src/` returns zero hits.** There is no hand-rolled SVG
anywhere in the codebase. Every icon is a `lucide-react` component. A bar chart would be the
**first** SVG in `src/` — so there is no house SVG convention to follow, and the planner is
choosing one, not matching one.

The nearest behavioural precedent is div-based, and it is the pattern to imitate for
accessibility and tokens — `src/components/child/SkillBars.tsx:28-37`:

```tsx
<div
  className="bg-secondary/50 h-4 w-full overflow-hidden rounded-full"
  role="progressbar"
  aria-label={t.skills[competency]}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuenow={percent}
>
  <div className="bg-accent h-full rounded-full transition-all" style={{ width: `${percent}%` }} />
</div>
```

`src/components/child/SkillCards.astro:48-58` is the same pattern in Astro with `bg-success`
and a visible `{percent}%` label. Both: semantic colour tokens (`bg-secondary`, `bg-accent`,
`bg-success`, `bg-primary/5`), `transition-all`, explicit ARIA, inline `style` only for the
one dynamic dimension. **A div/flex bar chart is a legitimate option** here and would match the
codebase exactly; SVG buys precise axis gridlines and value labels at the cost of being novel.
The handoff has already chosen SVG — worth noting the codebase does not force that hand.

`cn()` is `src/lib/utils.ts` (`twMerge(clsx(inputs))`).

### 7. i18n surface

`src/i18n/pl.ts` — 506 lines, a single `export const pl = { … } as const` (`:10`), nested by
screen/surface, heavily commented with the *reason* each key exists. `src/i18n/index.ts`
exports `type Dictionary = typeof pl` and `export const t: Dictionary = pl`, plus two helpers:
`charsNeeded(n)` (uses `Intl.PluralRules("pl")` — the precedent for correct Polish plurals) and
`upgradeCopy(id)` (id→copy with a non-throwing fallback). Components import `t` directly inside
islands rather than threading it through props.

The parent-report section is `report: {` at **`src/i18n/pl.ts:378`**, closing at `:408`. Its
header comment (`:372-377`) and, critically, the comment at **`:394-397`**:

```
// Per-child summary tiles (missing-screens-v3 `05-parent-weekly-report`).
// Both counts are read straight off the week's aggregated shift log — the
// mockup's correctness %, daily chart and earnings have no source yet, so
// they are not rendered rather than estimated.
statTasks: "Ukończone zadania",
statUpgrades: "Odblokowane ulepszenia",
```

**That comment is a direct record of the deferral F1 is now partially reversing, and it becomes
stale the moment F1 ships.** It must be rewritten to say the chart and the correctness % now
have a source, and that *only* earnings remain deferred (to F4).

**New keys belong inside `report: {` (`:378-408`)**, alongside `statTasks`/`statUpgrades`:
- (a) chart heading — e.g. `chartHeading`, plus a `chartLegend` for the mockup's
  "Liczba ukończonych misji" swatch label, and an `aria-label`/description key for the SVG.
- (b) **day abbreviations** — a new 7-element array or record. `grep` for `pon|wt|śr|czw|pt|
  sob|nd|Poniedzia|wtorek|…` across `src/` returns **nothing: no weekday names exist anywhere
  in the repo today.** They are net-new content. The mockup's set is `Pon, Wt, Śr, Cz, Pt, So,
  Nd`. Note that the array must be ordered Monday-first to match `startOfWeek`, and it needs a
  full-name companion for the accessible label (a bare "Śr" is poor screen-reader copy).
- (c) percentage tile — a `statAccuracy`-style label. The mockup's Polish is
  **"poprawnych odpowiedzi"** ("correct answers"), which is *not* the same claim as "first
  try". The stored metric is first-try mastery; the copy must say so honestly. See
  Discrepancy C.

All existing report copy is marked *"Draft Polish — pending native-speaker review"*, and there
is an open unchecked review at
`context/archive/2026-07-06-minimal-parent-weekly-report/follow-ups/copy-review.md` — new F1
keys should be appended to it.

### 8. Test surface

**Framework:** Vitest 4.1.8, `npm test` → `vitest run`. `vitest.config.ts`: `environment: "node"`,
`include: ["tests/**/*.test.{ts,tsx}"]`, `fileParallelism: false`, `@` → `./src`. All unit tests
live in `tests/`; there are none under `src/`.

#### `tests/reports.test.ts` — 12 tests, pure, no DB (verified: 12 passed, 118 ms)

The Supabase fake is a hand-rolled chain stub, and it is **brittle in a way that matters**
(`tests/reports.test.ts:18-26`):

```ts
const chain = {
  select: () => chain,
  eq: () => chain,
  gte: () => chain,
  order: () => Promise.resolve(result),
};
```

Only `select/eq/gte/order` exist and **only `order()` is thenable**. If the plan adds `.lte()`,
`.limit()`, `.in()`, or a second `.from(...)` query, the stub returns `undefined` and the error
-contract tests blow up. A second query would also be served the *same* result object.

Row helper (`:13-15`) — **adding a required `created_at` to `ShiftLogRow` breaks this and the
inline literal at `:39`, and fails `npm run check`** (`tsconfig.json` has `include: ["**/*"]`,
so `astro check` typechecks `tests/`):

```ts
function row(skills: unknown, upgrade?: string): ShiftLogRow {
  return { skills, upgrade_purchased: upgrade ?? null };
}
```

**Time is not frozen** — no `vi.setSystemTime` anywhere in the report suites. Determinism comes
from dependency injection: `startOfWeek(now)` and `getWeeklyReport(client, id, now)` take an
explicit instant. Four exact DST assertions (`:54, :59, :65, :71`), e.g.
`startOfWeek(new Date("2026-07-08T12:00:00Z")) === "2026-07-05T22:00:00.000Z"` and the
spring-forward case `"2026-03-22T23:00:00.000Z"`. **Any new day-bucketing helper should follow
the same injected-`now` discipline so it is testable without fake timers.**

**The decisive result for the planner: no test does `toEqual` on the whole `WeeklyReport`
object.** `tests/reports.test.ts:77-81` picks it apart field by field
(`report.profileId` / `report.practice` / `report.upgrades`). So **adding a new top-level field
to `WeeklyReport` breaks zero existing assertions.**

What *is* deep-equality locked:

| Change | Breaks |
|---|---|
| New top-level field on `WeeklyReport` | **Nothing** |
| New field on `WeeklyReportUpgrade` | `tests/reports.test.ts:94, 99, 104, 109` |
| New field on `CompetencyProgress` | `tests/reports.test.ts:88, 89`; `tests/report-isolation.test.ts:55`; `tests/skills.test.ts:45-58`; ~8 in `tests/shifts-complete.test.ts:194-238` |
| Required field on `ShiftLogRow` | `tests/reports.test.ts:13-15` + `:39`; fails `npm run check` |
| New chained filter / second query | `stubClient` `tests/reports.test.ts:18-26` |
| Changing `startOfWeek` | `tests/reports.test.ts:54, 59, 65, 71` |

`tests/report-isolation.test.ts` — 3 tests, **requires the live local Supabase stack**; seeds a
current-week row through account A's own RLS-scoped client and relies on `created_at default
now()`. `:55` `expect(report.practice.math).toEqual(SKILLS.math)` is shape-sensitive.

#### E2E

**Exactly one spec touches `/app/report`: `e2e/parent-surfaces.spec.ts`** (2 tests, `desktop`
project only). There is **no page object model** — one local helper,
`setPinAndLandOnReport(page, pin)` (`:21-33`). Shared helpers in `e2e/helpers/`:
`accounts.ts` (`provisionAccount` admin-creates a confirmed user with a UUID e-mail,
`signInViaUI` drives the real form, `seedChildProfile` inserts via service role),
`hydration.ts` (`waitForIslands`), `i18n.ts` (`t`, `fill`, `templateRegex`), `solve-shift.ts`.
No `storageState`, deliberately.

All three report assertions are the same locator —
`page.getByRole("heading", { name: t.report.heading })` (`:32`, `:48`, `:66`) — and `name`
matching is **case-insensitive substring** because `exact` is not passed. `t.report.heading` is
`"Raport tygodniowy"`, rendered as the single `<h1>` in `AppShell.astro:152`.
**A new heading whose text contains "Raport tygodniowy" causes a strict-mode violation and
fails all three.** A heading with a different string is safe.

Two more traps:
- `t.report.statUpgrades` ("Odblokowane ulepszenia") is **byte-identical** to
  `t.report.upgradesHeading` (`pl.ts:385` and `:399`) — two matches already on every card. Any
  new `getByText` there needs `exact` + scoping.
- `WeeklyReport.tsx:120` already uses `role="status"`. A new tile with `role="status"` /
  `aria-live` would make an unscoped `getByRole("status")` on that page ambiguous.

**Nothing covers report *content*.** Both existing tests only prove the PIN gate — the `<h1>` is
server-rendered in `AppShell`, so a tile that throws during hydration would leave it visible and
**no existing e2e test would catch a broken new tile**. And `seedChildProfile` **cannot seed
`shift_log` rows** — there is no weekly-practice seeding helper anywhere in `e2e/helpers/`. A
real e2e test of the chart needs a new admin-side seeder or a full gameplay run via
`solve-shift.ts`.

**`data-testid` convention: there is none in `src/`.** `e2e/CLAUDE.md:7-9` states that needing
one is "a product finding to surface first".

**No snapshot tests exist** anywhere (no `.snap`, no `__snapshots__`). **`WeeklyReport.tsx` has
no component test.** The three existing React component tests
(`tests/confirm-delete-dialog.test.tsx`, `tests/delete-account-section.test.tsx`,
`tests/task-guardrail.test.tsx`) opt into jsdom with a first-line
`// @vitest-environment jsdom` pragma plus `@testing-library/react` — **that pragma is the
pattern to copy** if the plan adds a component test for the chart, which is the cheapest way to
cover the `NaN%` and empty-week cases.

**Baselines** (verified): Playwright **15 tests in 6 files** = 13 `[desktop]` + 2 `[touch]`
(`touch` is `testMatch: /gameplay-restore\.spec\.ts/` only, Galaxy Tab S4, 712×1138; `desktop`
is 1280×720). Vitest ~296–299 across 39 files; `reports.test.ts` = 12, `report-isolation.test.ts` = 3.
Gates: `npm run check`, `npm run lint`, `npm run build`, `npm test`, `npx playwright test`.

## Code References

- `src/lib/services/reports.ts:13-16` — `ShiftLogRow`; the interface to widen with `created_at`
- `src/lib/services/reports.ts:37-47` — `aggregateWeeklyReport`; already computes the weekly `practice` the % tile needs
- `src/lib/services/reports.ts:50-65` — `REPORT_TIME_ZONE` + `zoneOffsetMinutes`, both **private**; a day-grouper needs them
- `src/lib/services/reports.ts:75-92` — `startOfWeek`, exported; **no `endOfWeek` exists**
- `src/lib/services/reports.ts:107-114` — the single query; `.select()` omits `created_at`, `.eq("profile_id")` is the only sibling separation
- `src/types.ts:105-150` — `Competency`, `CompetencyProgress`, `SkillState`, `WeeklyReportUpgrade`, `WeeklyReport`
- `src/pages/app/report.astro:22-29` — PIN gate; `:32-51` per-child `Promise.all`, `now` never passed; `:59` `client:load`
- `src/components/parent/WeeklyReport.tsx:131-148` — `practiced` filter, `tasksThisWeek`, and the two-tile `grid-cols-2` recipe
- `src/components/child/SkillBars.tsx:28-37` — the house progress-bar/ARIA pattern (no SVG exists to copy)
- `src/data/skills.ts:16` `COMPETENCIES`; `:23-25` `competencyForTaskType` (never returns `decisions`); `:56-88` `readSkillState` / `addSkillDelta`
- `src/data/shift.ts:84` `earningsForShift`; `:90` the `if (taskCount <= 0) return 0;` zero-guard precedent
- `src/lib/services/child-profiles.ts:126-137` — `appendShiftLog`, the fixed 4-column insert
- `src/lib/services/child-profiles.ts:170-187` — `earned` computed then discarded (see Constraints)
- `src/lib/services/child-profiles.ts:243-262` — purchases write `decisions: { firstTryCorrect: 1, completed: 1 }`
- `supabase/migrations/20260701150000_create_shift_log.sql:21-34` — schema + the `(profile_id, created_at)` index; `:36-63` account-scoped RLS
- `supabase/migrations/20260701140000_child_profiles_add_skill_state.sql:20-21` — `skill_state jsonb not null default '{}'`
- `src/i18n/pl.ts:378-408` — the `report:` section; `:394-397` the comment that goes stale
- `tests/reports.test.ts:13-15` `row()`, `:18-26` `stubClient`, `:54-71` DST assertions, `:77-81` the field-by-field (non-breaking) shape check
- `e2e/parent-surfaces.spec.ts:32,48,66` — the three substring-matching heading assertions

## Architecture Insights

- **Injected `now`, never a frozen clock.** `startOfWeek(now)` / `getWeeklyReport(…, now)` take
  the instant as a parameter, which is why the DST tests need no fake timers. Any new
  day-bucketing helper should keep that discipline — it is the project's testability contract
  for time.
- **`Intl` over a date library, as a standing decision.** No date dependency exists and the
  prior change recorded that as deliberate. A day-grouper must reuse `REPORT_TIME_ZONE` /
  `zoneOffsetMinutes` (exporting them) rather than open a second timezone implementation.
- **Two-layer isolation.** RLS is account-scoped; profile separation is application code. Every
  `shift_log` query owns its own `profile_id` filter. This is the pattern to preserve, and the
  one place a careless refactor leaks data.
- **The report renders volume, never a rate — on purpose.** `WeeklyReport.tsx:30-32` documents
  the surface as *"NEVER comparative or shaming … no miss/failure counts"*, and the component
  renders only practiced competencies. A percentage is the first rate on this screen.
- **`shift_log` is per-event, not per-attempt** (S-07 scope wall), and is written best-effort:
  `appendShiftLog` swallows its error so a log failure cannot fail an already-persisted shift.
  The weekly aggregate can therefore be *slightly* under-complete versus `skill_state`.
- **No generated Supabase `Database` types exist.** Clients are untyped and results are cast via
  `.overrideTypes({ merge: false })` — an assertion, not a structural check. A new DB column
  produces zero TypeScript errors, so type-checking will not catch a schema/query mismatch.

## Constraints carried in (already decided — recorded, not reopened)

1. **The "+84 zł zdobyte w tym tygodniu" tile must NOT ship in F1**, and must not be a
   placeholder or a zero. Precisely why: **the earnings figure is already computed at write
   time and then thrown away.** `recordShiftResult` derives it —
   `const earned = earningsForShift(shift.taskCount, shift.cleanCount);`
   (`src/lib/services/child-profiles.ts:170`) — folds it into `wallet_balance` (`:178`),
   returns it to the client (`src/pages/api/shifts/complete.ts:93`), and then calls
   `appendShiftLog(client, { accountId, profileId, skills })` (`:187`), which inserts a fixed
   four-column set that has nowhere to put it (`:131-136`). **The deferred tile is blocked on a
   column, not on a calculation** — which is exactly why estimating it would be inventing data
   rather than doing arithmetic. It goes to F4 (`world-progression-stages`), which owns the
   migration.

   **Would adding that column later disturb anything found here?** No, provided it is nullable
   or has a default:
   - No generated DB types exist → zero TypeScript errors from a new column.
   - The only production read is `reports.ts:109`, which selects explicitly → unaffected.
   - `select('*')` on `shift_log` appears only in `tests/shift-log-isolation.test.ts:71,82`,
     which assert only length/`id`/`account_id` → safe.
   - **The one blocker:** `appendShiftLog` inserts a fixed 4-column set, and three test files
     insert `shift_log` rows directly (`tests/account-deletion.test.ts:46`,
     `tests/profile-deletion.test.ts:53`, `tests/report-isolation.test.ts:43`). A `not null`
     column **with no default** breaks all four call sites. Use `not null default 0` or nullable.
   - Two semantics to settle in F4, not F1: purchase rows are a *spend*, not an earning (decide
     "0 on purchase rows" vs a signed delta); and the pinned non-idempotency
     (`tests/shifts-complete.test.ts:241-257` — a replayed POST pays twice and writes a second
     row) means any earnings sum inherits that double-count.
   - Earnings must **not** be accepted from the client; the server-side value at
     `child-profiles.ts:170` is the one to thread through.
2. **No migration in F1.** Everything the two features need is already stored. Corollary: no new
   RLS work, and L-001 does not fire.

## Historical Context (from prior changes)

The binding chain: `prd-v3 FR-016` → **S-07** built the report + `shift_log` (no earnings
column, deliberately) → **S-09** hardened it (Europe/Warsaw week, honest errors, isolation test)
and **explicitly parked the mockup's chart and % tiles** → **web-shell-and-mockup-parity**
applied the no-invented-data rule across the app → **F1** un-parks the chart + % tile, earnings
still deferred to F4.

- `context/archive/2026-07-01-skill-path-upgrade-gate/plan.md:235` — the `shift_log` schema, set
  by S-07 and unchanged since. `:32-35` records the scope walls a new plan must argue against:
  *"No per-task-attempt history rows … No parent report beyond weekly (no historical charts, no
  cross-child comparison, no export)"*. `:352` — the report is *"educational, plain-language,
  read-only, never comparative/shaming (FR-016 guardrail)"*.
- `context/archive/2026-07-06-minimal-parent-weekly-report/frame.md:36` — **the most binding
  prior line for F1**: *"The v3 mockup is a full dashboard … The mockup depicts that parked
  tranche, not S-09's bar. (Some of it — % correct tiles — would even violate the non-shaming
  guardrail as shipped copy.)"* `:34` also records that the week boundary was UTC before S-09.
- `context/archive/2026-07-06-minimal-parent-weekly-report/plan.md:30-31` — *"No mockup-fidelity
  work … No % correct (would flirt with the non-shaming guardrail), no historical weeks, no
  trends."* `:216` — the DST-safe Warsaw implementation to reuse, not re-derive.
- `context/archive/2026-07-06-minimal-parent-weekly-report/plan-brief.md:27` — no date library.
- `context/archive/2026-07-06-minimal-parent-weekly-report/follow-ups/copy-review.md` — an
  **open, unchecked** native-speaker review of every `t.report.*` key; F1's new copy joins it.
- `context/changes/web-shell-and-mockup-parity/handoff.md:67-71` — where "no invented data" was
  written down, naming *"wykresy dzienne, % poprawności, … zarobek tygodniowy, XP"* as the
  removed metrics. `:109-116` is F1's original spec, including *"SVG własne — Recharts nie jest
  w zależnościach"* and the earnings deferral. `:200-201` names F4 as the owner of the earnings
  column. `:78-82` records a concrete substring-locator failure already suffered
  (*"W portfelu" vs `getByText('Portfel')`*).
- `context/runs/2026-08-22-autonomous-five/run-log.md` — F4 `world-progression-stages` is
  explicitly scoped to add the earnings column and *"Closes F1's deferred tile."* Baseline: 299
  unit, 15 e2e, branch `feat/ui-polish`.
- `context/foundation/roadmap.md:294` parks *"Richer parent report — trends + recommendations
  beyond the minimal S-09 view"*; `:284` *"No full parent dashboard"*. **No roadmap entry exists
  for F1–F5** — the roadmap does not yet know this run is happening, and F1 formally un-parks
  line 294.
- `context/foundation/test-plan.md` — **no entry mentions the weekly report**. Nearest hook is
  §6.4 (`:177-181`), where `tests/shifts-complete.test.ts` asserts *"exactly-one `shift_log`
  row"* — that is where F4's earnings column lands.
- `context/foundation/lessons.md` — L-001 (RLS same migration; binds F4, not F1), L-002, L-003
  (i18n, binds F1). **"No invented data" is not a lesson** — it lives only in the run contract
  and the web-shell handoff. Candidate for `/10x-lesson`.

## Three discrepancies the plan must resolve

**A. F1's own handoff names the wrong data source for the percentage.**
`context/changes/parent-weekly-activity-chart/handoff.md:20-21` says the percentage comes from
counters *"held in `skill_state`"*. `skill_state` is **lifetime-cumulative and monotonic** by
design (S-07: *"Skill state only ever increases"*), so it cannot produce a weekly figure. The
correct source — and the one the original spec named — is `shift_log.skills`, already folded
into `WeeklyReport.practice` by `reports.ts:37-47`. **Good news: the weekly % tile needs no new
aggregation and no `skill_state` read at all.**

**B. The chart needs a field the query does not select.** `created_at` is filtered and ordered
on but never projected. One-word fix in the `.select()`, plus the `ShiftLogRow` widening (which
breaks `tests/reports.test.ts:13-15` and `:39` — expected, cheap).

**C. Unresolved guardrail tension — the plan must make a recorded decision.** S-09's frame said
a "% correct" tile *"would even violate the non-shaming guardrail as shipped copy"*
(`frame.md:36`) and its plan listed "No % correct" as out of scope (`plan.md:31`). F1's handoff
does not acknowledge this prior call. The component's own doc comment
(`WeeklyReport.tsx:30-32`) says *"no miss/failure counts"* — and a "% correct" is a failure rate
wearing a friendly hat. The plan should **not** silently override a prior guardrail decision. The
likely resolution: frame the tile as **first-try mastery in warm Polish**, honestly describing
what is measured (tasks nailed with no wrong taps) rather than borrowing the mockup's
"poprawnych odpowiedzi", which claims something the product does not measure — every task is
eventually answered correctly, so "% of correct answers" would literally always be 100%.

## Open Questions

1. **The guardrail override (C above).** Does the % tile ship at all, and under what copy? This
   is a product decision the mockup cannot settle, because the mockup's own wording describes a
   metric the product does not have.
2. **Zero-denominator rendering.** A brand-new profile has `0/0`. Omit the tile (matching the
   component's existing "only practiced competencies" habit), or render an em-dash? `0%` should
   be rejected as wrong-and-shaming. Not settled here.
3. **Mobile reflow of the chart.** The mobile mockup **does not draw it**. The pack README's
   *"mobile as responsive companion, not a separate app concept"* argues for reflowing rather
   than hiding, and the run contract forbids `lg:`-only duplication patterns — but this is a
   real design call the mockup declines to make. Note the `touch` Playwright project runs at
   712px, below `lg`.
4. **Empty-day treatment.** Every day in the mockup has a non-zero bar, so a zero day is
   undrawn. A zero-height bar, a faint stub, or a baseline tick? Accessibility argues for the
   day label and an accessible "0" being present regardless.
5. **What the bars count.** `shift_log` holds shift rows *and* purchase rows. The mockup's
   legend says "Liczba ukończonych misji". Count shift rows only, count all rows, or sum
   `math + money` completions per day? These differ.
6. **SVG vs div-based.** The handoff mandates SVG, and the codebase has **zero** SVG in `src/`
   while having two established div-based bar patterns with proper ARIA. Worth one line in the
   plan confirming SVG is still wanted given there is no house convention to match; if yes, the
   plan is also choosing the first SVG accessibility pattern for the project.
7. **E2E coverage.** There is no `shift_log` seeding helper in `e2e/helpers/`, and no existing
   test asserts report content. Does F1 add a seeder, cover the tile with a jsdom component test
   (cheapest — the `// @vitest-environment jsdom` pragma pattern), or both?
8. **The stale i18n comment** at `src/i18n/pl.ts:394-397` must be rewritten as part of F1, not
   left contradicting the shipped screen.
