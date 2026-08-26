---
title: Feature backlog
status: living
created: 2026-08-23
consumed_by: /10x-autonomous-run
---

# Feature backlog

**The single input to an autonomous run.** `/10x-autonomous-run` takes entry ids
(`/10x-autonomous-run B3 A3 H1`) or `--top N` and starts there.

It lives in `context/foundation/` deliberately, and it is **tracked**: a backlog
carried inside a change folder is buried by `/10x-archive` (which is what happened
to the previous one, in `web-shell-and-mockup-parity/handoff.md` §4–§5), and one
carried inside `.claude/` is invisible to a fresh clone, to CI, and to a cloud
agent — `.gitignore:37`. This file is the single tracked copy; nothing under
`.claude/` holds backlog content any more.

## How to read an entry

Every claim is tagged:

- **[V]** verified against this repo, with the date. Trust it.
- **[I]** inherited from an earlier document and **not** re-verified. **Do not
  trust it.** The run's intake step must check it before planning — in the source
  run three inherited claims were wrong (the level formula lived in a different
  file and was uncapped; the art directory had a different name; the earnings value
  was already computed and thrown away), and one route was already protected when
  the brief said it was not.

`Ready` means: an outsider could take this entry to `/10x-new` today. `Needs
shaping` means product content or a PRD decision is missing and planning would
invent it. `Parked` means a deliberate non-goal.

---

## Ready

*Empty.* **Nothing in this file can go to `/10x-autonomous-run` today.** The entries
under `## Needs shaping` need `/10x-shape` → `/10x-prd` first, and the run skill
refuses those by design: planning them would invent the product content that is
deliberately missing. Refill this section before the next run.

### Parked pending telemetry

**P2 — curriculum (skill taxonomy + new task types).** Shaping was opened on
2026-08-26 and **parked at Phase 1 by the maintainer**: *"collect data first, P2
after telemetry."* `task_attempt` holds 0 rows, so a competency taxonomy and an
S-07 gate migration would be designed on arithmetic rather than evidence. Notes,
the verified `## Current System`, and the resume condition are in
`context/foundation/shape-notes-p2-curriculum.md`. Shaped to absorb backlog **B3
`skill-path-screen`**, which is blocked on the same missing catalogue of modules.

**The open question this parking creates** (2026-08-26, unresolved): telemetry only
accumulates where children actually play. Development is local-only by decision and
the local database is empty (0 rows in `auth.users`, `child_profiles`, `shift_log`,
`task_attempt`, verified 2026-08-26). An adult clicking through shifts locally, or an
e2e fixture, produces rows but **not evidence about six-to-nine-year-olds**, which is
the only thing P2's tuning question is about. So "wait for telemetry" currently
resolves to "wait for real children", which resolves to "wait for a deploy" — and no
deploy is planned. Decide the data source before resuming P2, or P2 waits indefinitely.

---

## Shipped

### H1 — `autonomous-run-follow-ups` — 2026-08-24
Ten triaged follow-ups from the 2026-08-22 run. Branch `feat/autonomous-run-follow-ups`,
10 commits, no migration, `MERGE: CLEAR`. Landed on `matmaverse-v2` via
`run/2026-08-24-followups-and-remember-me`. Archive:
`context/archive/2026-08-24-autonomous-run-follow-ups/`.
**Left open:** 4 `#### Manual` Progress rows needing a screen reader and human eyes
(1.7, 1.8, 2.5, 6.6) — deferred by design, not failures.

### A3 — `remember-me-on-login` — 2026-08-24
Closed as a **real feature, not a placebo**: the checkbox sets the auth cookie's
`maxAge` (browser-session when unchecked, 30 days when checked), and the policy is
registered in `docs/reference/contract-surfaces.md`. Branch
`feat/remember-me-on-login`, 5 commits, no migration, `MERGE: CLEAR`. Archive:
`context/archive/2026-08-24-remember-me-on-login/`.
**RF-1 — closed 2026-08-26** by `rf1-session-cookie-on-email-links`. The decision:
**keep the browser-session cookie** on the email-link paths and pin it with tests
(`tests/remember-me-cookie.test.ts` 8–11, both directions). Two claims in the
original wording were wrong and are corrected in that change's `change.md`: it is
not a sign-out (the parent stays signed in, the session just does not survive a
browser restart), and `signup` is not affected in production at all (`signUp`
returns `session: null` when confirmations are on).

---

## Needs shaping

These are real product tranches, not UI debt. Each needs FRs before it can be
sliced — send them through `/10x-shape` → `/10x-prd`, not straight into a run.

### B2 — `pricing-and-inventory`
**Mockup:** `assets/matmaverse-ui-v2-{web,mobile}/04-pricing-inventory-*` **[I]**.
**Migration:** yes. **[I]** *There is no concept of a product in the codebase* —
`shop_state` holds only `{ purchased: string[] }`, and task types are `counting`
and `change_making` (`src/data/tasks.ts`). Needs a product model (price / demand /
stock), a state migration, a new task type in the generator and in scoring
(`src/data/shift.ts`, `/api/shifts/complete`), a demand curve as a pure testable
function, and the educational explanation screen. PRD v3 lists it under deferred
tranches. **The largest entry in this backlog.**

### B3 — `skill-path-screen`
**Mockup:** `assets/matmaverse-ui-v2-{web,mobile}/05-skill-path-*` **[I]**.
**Migration:** probably not **[I]** — `skill_state` per competency and
`SKILL_THRESHOLDS` (`src/data/skills.ts`) already exist and are already rendered as
cards and bars. **What is missing is a catalogue of modules** — what a module is,
which age band it belongs to, what unlocks it. That is product content, not code.
Without it the screen is three progress bars pretending to be a map. Shape first.

### B5 — `product-unlocked-screen`
**Mockup:** `assets/matmaverse-missing-screens-v3-*/04-product-unlocked-*` **[I]**.
**[I]** The post-purchase "Odblokowane!" card inside `UpgradeShop` already covers
the *moment*; what the mockup shows is a *product*, which does not exist as an
entity. **Blocked on B2** and not meaningful before it.

### W1 — `six-worlds-catalogue`
**[V]** (2026-08-23, via the last run's research) `/app/worlds` ships and a world
switch is functionally lossless. **[I]** The PRD assumes **six** worlds;
`src/data/worlds.ts` has **four**. The gap is art plus per-world copy, not
mechanics. Needs the two missing worlds specified before planning.

---

## Parked — deliberate non-goals

Per PRD v3 §Non-Goals. Listed so a run never picks them up by accident, and so a
reader knows they were considered.

- **Rewards / achievements** and a **settings screen** — "No full parent dashboard.
  Goal-setting, difficulty controls, time limits, and settings UI are out." The
  `06-parent-goals-web` mockup belongs to this category.
- **Notification bell** (drawn in the `ui-v2` mockups) — there is no notification
  system; deliberately skipped.
- **Monetization, casino mechanics, real trading, anonymous play, offline/PWA.**
- **Onboarding step-counter unification** — registration's "Krok 1 z 3" chip was
  deliberately not added because the profile wizard has its own 1–3 stepper and two
  counters side by side would confuse. Revisit only as one coherent counter.
- **Sidebar progress bar "you can afford it" state** — currently shows 100% when
  the child can afford the next upgrade. Legible, but a distinct state was
  considered. Cosmetic; not worth a run.

---

## Deployment readiness — read before the first deploy

**Not a backlog entry and not a defect.** Development is local-only by decision;
nothing has been pushed to production yet and that is the intended state. This
section exists so the facts below are on the record *before* someone deploys, not
discovered during it.

**[V] 2026-08-26.** `matmaverse-v2` is **103 commits ahead of `main`** and has never
been pushed (there is no `origin/matmaverse-v2`). The hosted project (`mathshop`,
`hozkukbsfdcrbszgdxbg`, `aws-1-eu-central-1`) still runs the `main` lineage: its
schema stops at `20260702120000`, exactly where `main`'s migration directory stops.
Old code against old schema is self-consistent — **nothing is broken**. Three
migrations are simply not there yet:

| migration | adds |
| --- | --- |
| `20260822120000_shift_log_add_earned` | `shift_log.earned` |
| `20260825120000_create_task_attempt` | the telemetry table + its L-001 RLS contract |
| `20260825130000_child_profiles_add_difficulty_state` | `child_profiles.difficulty_state` |

**Migrations go first, and that is not a preference.** All three are additive (one
new table, two new columns) and backward-compatible with the code currently on
`main`, so they can be applied ahead of any deploy. They *must* be, because both
telemetry writers swallow their errors by design — `appendShiftLog` explicitly, and
`appendTaskAttempts` by never inspecting the returned `{ error }`
(`src/lib/services/child-profiles.ts:155,198`). Deploying the code against a schema
that lacks these objects would make **every telemetry write fail in total silence**:
zero rows, zero signal, and a "we're collecting data now" belief that is false.
`infrastructure.md` §Rollback adds the other half — migrations do not roll back with
a deploy, so never couple an irreversible DB change to a deploy you might revert.

**No automation covers this.** `.github/workflows/ci.yml` applies migrations only to
a fresh **local** database for the test gate (`npx supabase db reset`, lines 47–48
and 89–90). No workflow step pushes migrations to the hosted project — production
schema changes are a manual `supabase db push` that nothing verifies and nothing
reminds anyone about. Worth closing before the deploy cadence picks up.

**Verify, don't assume:** `npx supabase migration list --linked` prints local vs
remote side by side and is read-only.

## Maintainer notes

- ~~**The `## Backlog Handoff` table in `roadmap.md` is stale.**~~ **Fixed
  2026-08-26.** All 14 roadmap items (F-01, S-01…S-13) were verified `done` with an
  archive folder each, and the table was deleted rather than reconciled — it
  duplicated `## At a glance` row for row and its only unique column was the stale
  one. `roadmap.md` now points here as the single input to `/10x-plan` and
  `/10x-autonomous-run`. The present-tense "ready now" notes in `## Streams` were
  marked historical at the same time.
- **`assets/` is gitignored**, so every `[I]` mockup reference above is unverifiable
  in CI or a fresh clone. An entry whose mockup cannot be opened must be planned as
  an explicit extrapolation, or deferred.
- Adding an entry: give it an id, a value/cost line, a migration answer, tagged
  claims, and the open decision a planner would otherwise invent.
