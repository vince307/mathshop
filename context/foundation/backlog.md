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

Two entries, from the world-economy shaping session closed 2026-08-27. Design:
`docs/superpowers/specs/2026-08-27-world-economy-design.md`. Decisions and
rejected alternatives: `context/foundation/shape-notes-world-economy.md` (D-1 …
D-10).

**Run them as one stack, E1 first.** Not because W1 depends on E1's mechanics —
the copy fallback (D-3) deliberately decouples them — but because **both edit
`src/i18n/pl.ts`**, and concurrent worktrees would collide there. E1 first also
means W1 names eight catalogue entries once instead of six and then two more.

### E1 — `world-economy-profit-rule`

**Value / cost.** Turns a one-term economy with one purchasable effect into a
profit rule with a decision in it — the thing PRD v3 FR-011 is built around and
the shipped catalogue cannot express. Cost is concentrated in two pure modules
(`src/data/upgrades.ts`, `src/data/shift.ts`) plus their two callers; the biggest
single item is not code but the invariant sweep. **No new table, route, or RLS
policy.**

**Migration:** **no.** **[V]** 2026-08-27 — `shop_state.purchased` stays a flat
global id list (`src/types.ts:98–107`); the new effect fields live in the
catalogue, which is code. `shift_log.earned` keeps its contract ("the amount
added to the wallet") and needs no backfill: it starts recording profit, and
every existing row is a shift whose cost was zero.

The design, in one block:

```
revenue = (EARN_PER_TASK × quantityMargin) × taskCount
        + (EARN_PER_CLEAN × accuracyMargin) × cleanCount
cost    = shopRunningCost(purchased)
profit  = max(0, revenue − cost)      // wallet += profit — NEVER a debit
```

Catalogue lands at **8 entries and stops**: 1 unlock (`sign`, re-cast as the gate
to the margin branch) + 5 capacity (unchanged) + 2 margin (new).

**Verified claims** — all **[V]** 2026-08-27, read from source:

- `earningsForShift(taskCount, cleanCount)` has **two** terms already, not one:
  `EARN_PER_TASK = 5` (quantity) and `EARN_PER_CLEAN = 3` (accuracy, paid only
  for miss-free tasks) — `src/data/shift.ts:44–47, 288–290`.
- The five capacity entries carry `extraTasks: 1` each and `MAX_BONUS_TASKS = 5`,
  so they sum to **exactly** the cap — `src/data/upgrades.ts`. A sixth capacity
  entry would be an effect-less purchase.
- FR-010 bounds the catalogue at **5–8 entries** (`prd-v3.md:106`); 6 exist, so
  there are exactly two free slots.
- `canBuy`'s rung order is fixed and documented, with the property that *"an
  owned upgrade is NEVER retro-locked by a later rung"*, pinned at
  `tests/upgrades.test.ts:115`. The new `requiredUpgrade` rung must inherit it.
- `ShiftScreen` **already receives `purchased`** (`ShiftScreen.tsx:41,72`;
  `task.astro:29,84`) — the island needs no new prop and `task.astro` likely
  needs no change at all.
- `src/data/shift.ts` does **not** import `src/data/upgrades.ts`, and
  `MAX_SHIFT_TASKS`'s header explains why a derived cap was rejected there.
  Spec §8 keeps it that way via a value-object seam; reversing it silently would
  undo recorded reasoning.
- FR-008 (`prd-v3.md:102`) forbids reducing funds outside a purchase. The design
  clears it **only** because cost applies to a shift's revenue, never to the
  wallet, and `profit ≥ 0`. `wallet -= rent` breaks FR-008; `wallet += max(0,
  revenue − cost)` does not. **Reject a wallet debit on FR-008 grounds.**
- Existing test surface to update: `earningsForShift` is asserted in
  `tests/shift.test.ts:170–179` and at five places in
  `tests/shifts-complete.test.ts`.

**Inherited, re-check before planning:** nothing. Every claim above was read from
source during shaping.

**Open decision the planner must NOT invent — the reference shift.** The headline
deliverable is a property sweep of the no-trap invariant
`∀ u ∉ purchased : profit(purchased ∪ {u}) > profit(purchased)`, over all ≤2⁸
`purchased` subsets × a grid of `d ∈ [0,1]`. But `profit` is not a single number:
shift length depends on `d` (`src/data/shift.ts:56–86`), so "steady-state profit"
is undefined until a **reference shift** is pinned — which tasks, at what
accuracy assumption. Pick it deliberately and record it; a planner choosing one
silently makes the invariant mean whatever that choice made it mean. The obvious
candidate (expected shift at `d`, fixed accuracy) is a candidate, not a decision.

**Also open, but tuning** — the repo convention is "first-guess defaults, adjust
after kid-testing", so these do not block: `shopRunningCost`'s curve shape and
weights (**check it against the compounding case, capacity × quantity-margin, not
the base case**), the two margin values and entry costs, which competency each
margin gates on, and whether `earningsForShift` is retained as `revenue` or
replaced outright.

### W1 — `six-worlds-catalogue`

**Value / cost.** Closes the PRD-v3-assumes-six / code-has-four gap. **The cost
dropped twice.** It was filed as "art plus per-world copy", implying an art task
nobody could start; shaping found the source art already existed locally, and it
has since been converted and committed. What is left is code: two entries in
`WORLDS`, two i18n names, and whatever vocabulary the open decision below
settles.

**Migration:** **no.** **[V]** 2026-08-27 — `child_profiles.theme` is
`text not null default 'default'` with **no CHECK constraint**
(`supabase/migrations/20260609120000_child_profiles_isolation.sql:55`).
Validation is app-layer only, against `WORLD_SLUGS` derived from `WORLDS`
(`src/data/worlds.ts`), so adding worlds only widens a zod enum.

**Verified claims** — **[V]** 2026-08-27:

- `assets/atomic-assets-v2/png/worlds/` holds **six** world-card illustrations.
  Four are shipped; the two that are not are `creative-studio-world.png` and
  `invention-lab-world.png`, both tagged `"role": "world-card-illustration"` in
  `assets/atomic-assets-v2/manifest.json`, themes *"creative studio"* and
  *"invention lab"*.
- `public/illustrations/` now holds **six** `world-*.webp`, all 896×718 with alpha.
  The earlier four were crops of a mockup sheet; the two W1 ones are whole
  illustrations, resized. Provenance for both batches is in
  `public/illustrations/slice-map.md`.
- Adding a world touches `src/data/worlds.ts`, `src/i18n/pl.ts`,
  `WorldPicker.tsx` and `CreateProfileWizard.tsx` — all of which already iterate
  `WORLDS` rather than hardcoding four.
- Under D-3 a world also supplies its own **vocabulary** for catalogue entries,
  resolved as `t.worlds[slug].upgrades[id] ?? t.upgrades[id]`. **The fallback is
  mandatory**, and it is what makes vocabulary optional per world — so W1 can
  ship the two worlds without writing 6 × 8 strings, and grow into them.

**~~MANUAL PRECONDITION~~ — resolved 2026-08-27, before the run.** The art and
the names were the two things `/10x-autonomous-run` could not produce for itself:
`assets/` is gitignored (`.gitignore:37`) and therefore absent from the worktrees
the run builds, and the names are product content. Both are now settled and
committed, so **W1 needs no manual step at run time**:

| Slug | Name | Art (committed) | Source |
| ---- | ---- | --------------- | ------ |
| `pracownia` | Pracownia | `public/illustrations/world-pracownia.webp` | `creative-studio-world.png` |
| `laboratorium` | Laboratorium | `public/illustrations/world-laboratorium.webp` | `invention-lab-world.png` |

Single-word names follow the `kawiarnia` / `piekarnia` precedent, and carry no
diacritics, so slug and filename stem need no transliteration. **These three
values — slug, filename stem, and `child_profiles.theme` value — must stay
identical.** Renaming after profiles exist is a data change, not a copy change;
see the precedent recorded in `src/data/worlds.ts`, where the `05` mockup labels
the fourth world "Sklep kolekcjonera" while the committed art and slug are
`sklep-ksiegarnia`, reconciled to a single name↔slug↔art.

**The one open decision left:** whether W1 also writes per-world catalogue vocabulary
(6 × 8 strings) or ships on the neutral fallback and adds vocabulary later. The
fallback exists precisely so this is a choice; make it explicitly, because a
planner will otherwise assume one.

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
