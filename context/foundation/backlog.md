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

### H1 — `autonomous-run-follow-ups`
**Value/cost:** high / low. Ten concrete items, each naming file + symbol, already
triaged as non-blocking by five implementation reviews. **No migration.**
**Source:** `context/changes/*/follow-ups/review-fixes.md` (five files).
**Status:** ready. This is the cheapest entry in the backlog and closes the
verification debt of the last run.

The three worth doing first, all **[V]** (each names a file and a symbol in its
source document):
- `src/pages/app/growth.astro` — the `<h2>` holding `t.start.nextUpgradeHeading`
  sits **outside** the `{next && …}` guard, so a child who owns every
  level-eligible upgrade sees a heading over an empty box.
- `src/components/child/StageRail.astro` — the stage-ordinal `aria-label` hangs on
  a `role=generic` span and is therefore **never announced**, while the file's own
  comment and a ticked Progress row both claim it is. Needs `role="img"`.
- `tests/weekly-report-tiles.test.tsx` — no committed test renders a non-zero chart
  beside a non-zero tile (every fixture passes seven zeros), so the invariant the
  chart exists to satisfy is unproven at render level. ~12 lines.

Also in scope: rebuild the `shift_log` e2e seeder that was written and then deleted
(`e2e/helpers/accounts.ts`), bind the form target in `tests/worlds-picker.test.tsx`,
make `tests/shop-art-slots.test.ts` exercise the per-world lookup, make
`tests/nav-labels.test.ts` guard the real nav rather than the dictionary, log the
DB-error branch in `src/pages/api/profiles/world.ts`, keep `learnHeading` in the
a11y tree below `lg`, and record K1 (the non-decaying `failed_attempts` counter) in
`docs/reference/contract-surfaces.md`.

**Open decision for the planner:** whether this ships as one change or as
per-feature follow-up commits. One change is cheaper; per-feature keeps the audit
trail attached to the feature. Decide and record.

---

### A3 — `remember-me-on-login`
**Value/cost:** medium / low. **Migration:** no.
**Mockup:** `assets/matmaverse-auth-v2-{web,mobile}/01-parent-login-*` **[I]**.
**Status:** ready, but it is a **session-policy decision before it is UI**.

**[I]** The login form has no "remember me" control; the missing piece is a
decision about Supabase session length, not markup. Without that decision this is a
decorative checkbox — which the project's own rules forbid (the four protective
toggles in the parent-PIN mockup were dropped from the last run for exactly this
reason).

**Open decision the planner must make and record:** what "remember me" changes
concretely (refresh-token lifetime? cookie `maxAge`? both?), what the unchecked
default is, and what the security posture is on a shared family device. If the
answer is "nothing we can honestly implement", the entry closes as a documented
non-goal rather than shipping a placebo.

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

## Maintainer notes

- **The `## Backlog Handoff` table in `roadmap.md` is stale.** It still marks S-05,
  S-08, S-11 and S-12 as "ready for `/10x-plan`", while the roadmap's own *At a
  glance* table marks all of S-01…S-13 **done** and every one of them has an
  archive folder. Reconcile or delete that table — agents read it.
- **`assets/` is gitignored**, so every `[I]` mockup reference above is unverifiable
  in CI or a fresh clone. An entry whose mockup cannot be opened must be planned as
  an explicit extrapolation, or deferred.
- Adding an entry: give it an id, a value/cost line, a migration answer, tagged
  claims, and the open decision a planner would otherwise invent.
