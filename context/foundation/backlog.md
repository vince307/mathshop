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

**Empty.** E1 and W1 — the two world-economy entries — shipped on 2026-08-27 and
moved to `## Shipped` below. Nothing here is startable today, and that is a real
state, not an oversight: `/10x-autonomous-run --top N` correctly finds nothing.

**What it would take to refill this section.** The three `## Needs shaping` entries
each need FRs first, and they are blocked on one thing between them: **B2** needs a
product entity *and* a new task type, which is **P2**; **B3** needs a catalogue of
modules, which is also **P2**; **B5** is blocked on B2. P2 is parked on telemetry
from real children. So the single unblocking move is not code — it is a supervised
kid-testing session against the local build, which fills `task_attempt` and lets
`report.sql` answer from evidence instead of arithmetic. The concrete resume
condition is under `## Parked pending telemetry`.

The nearest startable work is the follow-ups E1 and W1 left open — enumerated in
their `## Shipped` entries below. Real work, but a small change each, not a tranche
and not a run.

---

## Parked pending telemetry

*Not Ready.* `/10x-autonomous-run` must not pick this up. It was previously an
`###` nested under `## Ready`, which was harmless only while that section was
empty; promoted to `##` on 2026-08-27 so the run's `--top N` file-order scan
cannot reach it.

**P2 — curriculum (skill taxonomy + new task types).** Shaping was opened on
2026-08-26 and **parked at Phase 1 by the maintainer**: *"collect data first, P2
after telemetry."* `task_attempt` holds 0 rows, so a competency taxonomy and an
S-07 gate migration would be designed on arithmetic rather than evidence. Notes,
the verified `## Current System`, and the resume condition are in
`context/foundation/shape-notes-p2-curriculum.md`. Shaped to absorb backlog **B3
`skill-path-screen`**, which is blocked on the same missing catalogue of modules.

**Status 2026-08-26: parked, and the tooling to un-park it is built and waiting.**

`scripts/telemetry-harness/` drives the real app in a real browser and fills
`task_attempt`. Its first run produced 784 rows across 6 personas in 8.8 minutes
and settled two things:

- **The pipe is proven end-to-end.** Client → server validation → RLS → row →
  `difficulty_state` advancing between AND within shifts. That chain had unit
  tests only; it had never carried a row from a browser.
- **`report.sql` is the readout `task_attempt` never had** (one writer, zero
  readers before it). The same six queries will answer the same questions the
  moment the rows come from a child instead of a script.

**What is still missing is the only thing that matters: children.** The harness's
`first_try` and `misses` come from a hand-written constant (`child-model.ts`), and
`duration_ms` measures Playwright's click latency (89–663 ms), not hesitation —
and time-on-task is one of the two signals P2 most needs. Harness rows must never
justify a taxonomy, a threshold, or a gate migration; the README says so at length.

**Resume condition — concrete.** A supervised kid-testing session against the local
build is enough; it needs no deploy. Play fills the same tables, and
`report.sql` §1/§2/§4 (grouped by cohort — do not pool) then reports evidence
instead of a round trip. Until then P2 stays here.

**One engine finding banked from the run** (conditional on the harness's accuracy
curve, but the mechanism is read from source): with the fold rule's deliberate 4:1
asymmetry — `+0.01` per clean answer, `−0.04` per miss (`ADAPT_RATE`,
`TARGET_SUCCESS`, `src/data/adaptive.ts:263`) — plus the warm-up and post-miss
guards, **no cohort reached the `d = 0.5` ceiling in 20 shifts**; the strongest
ended at ~0.29. The spike's "16 shifts to the ceiling" assumed flawless play. This
does not invalidate `adaptive-seed-vs-ceiling` (seed == ceiling for levels 2–3 was
a real structural defect and remains one); it tempers the urgency behind it.

---

## Shipped

### E1 — `world-economy-profit-rule` — 2026-08-27
**The economy gained a decision.** A shift now pays
`profit = max(0, revenue − cost)`, where `cost = shopRunningCost(investment ⊆
purchased)`. The wallet is credited profit and is **never debited** — which is
exactly what clears FR-008, and why a `wallet -= rent` design was rejected rather
than escalated to a PRD change. The catalogue closed at **eight** entries (1 unlock
+ 5 capacity + 2 margin) and stops there; a second, non-catalogue list of **24
decorations, four per world at 40/80/140/220 zł** became the wallet's renewing sink
(D-11), living in the optional `shop_state.decorations` sibling and never in
`purchased`, so a decoration can never reach `shopRunningCost` or `canBuy`.

Branch `feat/world-economy-profit-rule`, 6 commits, 33 code files, +3183/−70,
**no migration**, `MERGE: CLEAR` (0 critical, 3 warnings). Landed on `matmaverse-v2`
via `run/2026-08-27-world-economy`, merge commit `c333f36`. Run journal:
`context/runs/2026-08-27-world-economy/` (untracked, by policy). Archive:
`context/archive/2026-08-27-world-economy-profit-rule/`.

**The headline deliverable was not the code.** Three invariants are machine facts in
`tests/economy-invariants.test.ts` — no-trap, no-harm, and D-12's no-dominance over
**reachable** states only — alongside D-13's pacing model
(`scripts/telemetry-harness/pacing.ts`), which derives the reference shift instead of
leaving it implicit and prices every entry in **tasks solved**.

**Two decisions taken autonomously, both with reversal conditions recorded.**
Decorations render with **no art**: `Decoration.art?: string` unset in the first
batch, lucide glyphs plus design tokens through `ShopArt`'s corner-row fallback, and
the art upgrade path recorded in the module header — the `src/data/stages.ts`
precedent, chosen over committing a placeholder asset. Four decorations per world
rather than two or eight, because the recurring level-boundary empty state needs
something buyable in each ~3-shift band while the eventual art debt is
`worlds × count`.

**Left open:** four follow-ups in
`context/archive/2026-08-27-world-economy-profit-rule/follow-ups/review-fixes.md`.
Sharpest is
**RF-1** — the dominance sweep judges a branch by its **best** entry, so raising
`precision.cost` to 400 leaves all six invariant cases green. The instrument meant to
guard D-12 has a hole in it. Also five human-checklist items that need the app
running, and a native-speaker pass on 24 decoration names authored unattended.

### W1 — `six-worlds-catalogue` — 2026-08-27
Closed the PRD-v3-assumes-six / code-has-four gap. **Pracownia** and **Laboratorium**
joined `WORLDS`, both world grids reflow at six, two new `WORLD_SLOTS` tables landed,
and each world now carries **its own decoration set** — the first thing that makes
six worlds mechanically worth having. It grants no world an economic advantage,
because a decoration has zero economic effect by construction, so D-3's rejection of
per-world economies is untouched.

Branch `feat/six-worlds-catalogue` (cut from `feat/world-economy-profit-rule`, so the
two were one serial stack), 5 commits, 10 code files, +265/−7, **no migration**,
`MERGE: CLEAR` (0 critical, 3 warnings). Landed via `run/2026-08-27-world-economy`,
merge commit `d27bfb3`. Archive:
`context/archive/2026-08-27-six-worlds-catalogue/`.

**The open decision went the cheap way.** W1 ships on the neutral copy fallback
(`t.worlds[slug].upgrades[id] ?? t.upgrades[id]`) rather than writing 6 × 8 per-world
catalogue strings. *Reversal:* write a world's vocabulary when its framing actually
reads wrong to a child — the fallback exists so this is a choice, and the strings can
be added one world at a time instead of as a batch of 48.

**Left open — and this one is USER-VISIBLE.** `t.marketing.worlds`
(`src/i18n/pl.ts:118`) is a hand-maintained duplicate of `WORLDS` that nothing syncs
and no test covers, rendered in **two** places: `AuthShell.astro:79` and
`Welcome.astro:83`. **The signed-out product still advertises four worlds while the
app ships six.** Both art files are already committed, so the fix is two dictionary
entries — but do it together with `AuthShell`'s `grid-cols-4`, or the desktop strip
goes ragged 4+2. Six further follow-ups in
`context/archive/2026-08-27-six-worlds-catalogue/follow-ups/review-fixes.md`; the
next sharpest
is **W1-F3**, whose badge-placement evidence for the two new `WORLD_SLOTS` tables is
not reproducible because the probe was deleted.

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
**[V] 2026-08-27 — B2 was deliberately NOT absorbed into the world-economy
tranche.** It needs a new task type as well as a product entity, and
`src/types.ts:113–120` puts `set-price` / `manage-stock` and the `inventory` /
`profit` competencies out of scope "until those task types exist" — which is P2,
parked. B2 waits on P2, not on E1 or W1.

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
