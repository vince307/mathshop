# "Ostatnia aktywność" Feed on the Child Dashboard — Plan Brief

> Full plan: `context/changes/dashboard-recent-activity/plan.md`
> Research: `context/changes/dashboard-recent-activity/research.md`
> Standing brief: `context/runs/2026-08-22-autonomous-five/agent-contract.md`

## What & Why

Add an **"Ostatnia aktywność"** section to the child dashboard (`/app/start`) — a newest-first
list of what the child actually did, showing completed shifts and upgrade purchases. Both
kinds are already rows in `shift_log`; the child currently has no way to see their own recent
history, and the web mockup draws this section at the bottom of the main column. Feature F2 of
five in the 2026-08-22 autonomous run.

## Starting Point

`shift_log` has five columns and exactly one insert site (`appendShiftLog`, best-effort and
un-transactional). `upgrade_purchased !== null` is the only sound discriminator — a purchase
row also carries a `skills` payload, so the jsonb keys are a hint, never a discriminator. No
service returns raw rows today: the single read, `getWeeklyReport`, is ascending, unlimited,
and returns an aggregate. RLS on the table is **account-scoped**, so a per-child query must
add its own `profile_id` filter. The dashboard is SSR-frontmatter-fetched with one prop-less
island, and no date-formatting machinery exists in the codebase beyond `reports.ts`'s private
Warsaw week helpers.

## Desired End State

Below "Twój sklep — wyniki", a section headed "Ostatnia aktywność" shows up to three cards:
`Zmiana ukończona · 5 zadań` with a green check badge, `Ulepszenie: Szyld` with a blue
up-arrow badge, each with a muted `Dzisiaj` / `Wczoraj` / `DD.MM` line. Three across at `lg`+
as drawn; stacked one per row on a phone. A profile with no history sees the heading and one
muted empty line; a query failure sees a distinct error line and the rest of the dashboard
still renders.

## Key Decisions Made

All eight of the research doc's open questions were closed here, autonomously (no human in the
loop). Full reasoning and reversal conditions are in the plan's `## Autonomous decisions`.

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| D1 · Money on a row | **None on either kind** | `shift_log` stores no earnings, re-deriving from tunable `EARN_PER_*` silently re-prices history, and the catalog `cost` is the current price rather than the price paid. | Plan |
| D2 · Mobile treatment | **Stack vertically, never `lg:`-gate** — an explicit extrapolation, the mobile mockup omits the section entirely | Gating would put zero copies of the heading in the 712px `touch` project's a11y tree and be the page's first viewport-dependent content. | Plan |
| D2b · Placement | **Nested inside grid block B**, not a fourth sibling | Block B is `order-last`; a fourth sibling would render *before* skills/results on mobile. | Research §3.3 → Plan |
| D3 · `Zobacz wszystkie ›` | **Omitted** | No route lists all activity; the run's no-dead-navigation rule ships a nav entry with its screen. | Plan |
| D4 · `Sprzedaż: Cappuccino` | **Not rendered, nothing substituted** | Products do not exist as an entity (`shop_state` is `{ purchased: string[] }`); backlog B2. | Plan |
| D5 · F1 contention | **`reports.ts` gets two appended symbols and nothing else**; day helper lives in a new `src/data/activity.ts` | F1 edits `ShiftLogRow`, the `.select()`, and exports the Warsaw helpers — append-only rebases cleanly against all of it. | F1 research → Plan |
| D6 · Timestamps | `Dzisiaj` / `Wczoraj` on the **Warsaw calendar day**; older → `DD.MM` | The mockup draws day words, not relative time; relative strings are the exact non-determinism the `/app/task` hydration fix was about. | Mockup → Plan |
| D7 · Errors & empty | Service **throws**; `start.astro` catches and renders a distinct error line | "You haven't played yet" and "we couldn't load it" must look different, and the feed can never take the page down. | Research §4.4 → Plan |
| D8 · Test stub | **New test file with its own thenable stub**; `tests/reports.test.ts` untouched | F1's research states it edits that exact stub. | F1 research → Plan |
| D9 · Isolation test | **Two profiles inside ONE account** | RLS cannot catch a dropped `profile_id` filter — both rows are legitimately readable by the same client. | Plan |

## Scope

**In scope:** a pure `src/data/activity.ts` (Warsaw day bucketing + row→entry mapping); a
`tasksDone(n)` Polish plural helper; eight `pl.ts` keys; `listRecentActivity` appended to
`reports.ts`; a `RecentActivity.astro` section wired into `start.astro`; three unit suites, one
integration isolation suite, two e2e assertions; a one-line `contract-surfaces.md` update.

**Out of scope:** any money figure; the `Zobacz wszystkie` link; the sale row; a migration, RLS
change, new index, API route, React island, npm dependency, or `data-testid`; edits to
`src/types.ts` or `tests/reports.test.ts`; any restructuring of existing `reports.ts` code; a
history screen, pagination, or relative time.

## Architecture / Approach

```
shift_log ──(.eq profile_id, order created_at desc, limit 3)──> listRecentActivity   [reports.ts, appended]
                                                                       │  throws on error
                              start.astro frontmatter (try/catch, one `now`)
                                                                       │
                              toActivityEntry(row, now)   [src/data/activity.ts, pure, dep-free]
                                                                       │  ActivityEntry[] | null
                              <RecentActivity entries={…} />  [.astro, zero JS, childCard + lucide + t]
```

Everything non-deterministic — the `now` instant, the day words — is resolved once in the
frontmatter, never in an island. The section ships no JavaScript.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Pure core + copy | `src/data/activity.ts`, `tasksDone`, 8 dictionary keys, unit tests | Warsaw "yesterday" via a naive −24 h subtraction is wrong on the 25-hour October day — pinned by a named test |
| 2. Profile-scoped query | `listRecentActivity` + `RecentActivityRow`, unit suite, intra-account isolation suite | A dropped `.eq("profile_id", …)` is a silent within-account leak no RLS policy can catch |
| 3. The section | `RecentActivity.astro` + `start.astro` wiring | Placement: a fourth grid sibling renders in the wrong mobile order; the mobile layout is an extrapolation |
| 4. E2E | Empty state in `seed.spec.ts`, populated feed in `gameplay-restore.spec.ts` | `getByText` substring collisions — `Dzisiaj` must never be asserted |

**Prerequisites:** local Supabase stack up (`npx supabase start`) for phases 2 and 4; the
gitignored `assets/matmaverse-ui-v2-web/02-child-dashboard-web.png` for the phase-3 visual
check; a branch `feat/dashboard-recent-activity` cut from `feat/ui-polish`.
**Estimated effort:** ~1 session, four commits.

## Open Risks & Assumptions

- **The mobile layout is an extrapolation, not a mockup.** The mobile mockup draws no such
  section. Stated plainly so the maintainer can overrule it — it is one Tailwind class string
  on one element.
- **`src/lib/services/reports.ts` is edited by F1 in parallel.** This plan is append-only in
  that file and avoids `tests/reports.test.ts` and `src/types.ts` entirely; the implementer
  should **rebase onto F1 rather than resolve a conflict blindly**.
- **The feed can legitimately be incomplete** — `appendShiftLog` swallows its error and does
  not share a transaction with the profile UPDATE. Accepted deliberately: the copy never
  presents the feed as a reconciliation of the wallet or the shift count.
- Assumes `created_at` ties are impossible (separate transactions, so separate `now()`), hence
  no secondary sort key.

## Success Criteria (Summary)

- A child who has completed a shift and bought an upgrade sees both events, newest first, with
  correct day words — at 390px and at 1280px.
- Every number and name on a card comes from a stored column; no `zł` amount is invented.
- Deleting the `.eq("profile_id", …)` filter turns a test red, and `npm test` /
  `npm run lint` / `npx playwright test` are all green with the unit count above 299.
