# World-selection screen (`/app/worlds`) — Implementation Plan

> Change id: `world-selection-screen` (feature **F5** of the autonomous run
> `context/runs/2026-08-22-autonomous-five/`)
> Research (ground truth, read it): `context/changes/world-selection-screen/research.md`
> Standing brief: `context/runs/2026-08-22-autonomous-five/agent-contract.md`

## Overview

Ship a dedicated child surface at `/app/worlds` that lets a child change their learning
world after the create-profile wizard, paired with the mockup's explanatory panel telling
child and parent that **every world teaches the same competencies** — switching is a change
of costume, not of curriculum.

Today `child_profiles.theme` is written once by the wizard and never again, while
`src/i18n/pl.ts:169` already promises the parent *"Świat możesz zmienić później."* This
change makes an already-shipped promise true. It adds one route, one page, one island, one
nav entry, and one write-only data field. **No migration.**

---

## Autonomous decisions

This step ran under the run's agent contract: **no human in the loop**, `AskUserQuestion`
never called. The `/10x-plan` skill's complexity confirmation and its 3–5 clarifying
questions (task + research tier) were answered by this agent from `research.md`, the PRD,
the mockups' description in research §6, and the code. Complexity was self-assessed
**MEDIUM** (one new route + one new page + one island + one nav entry + one data field; no
schema change; one genuine product decision). Every decision below carries its reasoning
and its reversal condition.

### D-1 — Purchased upgrades survive a world switch (**A + D + E**) — the headline decision

**Decided: keep `shop_state.purchased` global (option A), re-skin coordinates only
(option D, deferred to a droppable final phase), and start recording the world alongside
each future purchase (option E). Option C (reset on switch) is rejected outright.**

The research recommended exactly this and I could not defeat it. The evidence:

- A theme flip is **functionally lossless today** (research §2.4). `theme` is read in three
  render-time places only (`start.astro:33`, `task.astro:27`, `upgrades.astro:28`), all via
  `worldForTheme()`. Nothing is denormalized from it. All four slugs have committed
  `.webp` art. No `${world.slug}` appears in any `src=` anywhere in the repo.
- **No upgrade is café-specific.** The six are generic retail vocabulary (Szyld, Półka,
  Lepsza kasa, Miejsce na produkt, Magazynek, Więcej klientów). The *structural* proof is
  stronger than the prose one and is what to rely on: the `Upgrade` interface
  (`src/data/upgrades.ts:16-41`) **has no world field at all**, and `canBuy` (`:145`) /
  `nextUpgrade` (`:161`) read only `{ walletBalance, businessLevel, purchased, skillState }`
  — `theme` appears nowhere in the module. The art is theme-neutral by design per
  `public/illustrations/slice-map.md:25` (*"SVG — scalable, theme-neutral, swappable for
  per-world art later"*); `upgrades.ts:8-9` makes the adjacent point that v1 ships **one
  shared catalogue** and per-world catalogues are the multi-world tranche. (Plan-review
  correction: the earlier draft attributed the "theme-neutral SVG" wording to
  `upgrades.ts:8-9`, which says the catalogue thing, not the art thing. Both claims are true;
  only the pointer was wrong.) There is no "coffee machine in a flower shop" to solve.
- **The data to split purchases per world was never captured.** The only write
  (`child-profiles.ts:250`) appends a bare id with no world and no timestamp;
  `shift_log.upgrade_purchased` timestamps but records no world either. So option B is not
  a re-reading of existing data — it is new data plus a legacy-row normalizer.
- **`prd-v3.md:92` is the binding line that rejects option C** (plan-review correction):
  *"Buying an upgrade debits funds and applies both a visible change and a functional
  unlock; **on return the grown shop and purchase persist for that profile**."* That is a
  functional requirement, and it scopes persistence to the **profile**, not the world.
  Resetting purchases on a switch violates it directly. Reinforced by the hard guardrail at
  `prd-v3.md:76` (*"spending never reduces their level, world level, or recorded skill
  progress"*).
- **`prd-v3.md:180` supports this but is NOT a requirement** — read it before leaning on it:
  it is **Open Question #5**, and it says the "wallet + owned-upgrades as the permanent win"
  framing *"is the chosen mitigation … **it should be validated with real children and
  iterated**"*. So it is the chosen-but-unproven mitigation, reinforced by `prd-v3.md:102`
  and `shape-notes.md:152-154`. Taking furniture away on a switch destroys precisely that
  mitigation — but the **rejection of option C rests on `:92`, not on `:180`**.
- The one line pointing the other way is FR-010 (`prd-v3.md:106`, *"The world defines a small
  upgrade catalog"*), which the shipped code has already declined to implement (one global
  catalogue).

**Rejected: option B (purchases per world).** It is the right end-state — the gitignored
design handoff puts `unlockedUpgrades` on a per-world `WorldState` and `virtualBalance`
global — but it front-loads the multi-world tranche's data work into a screen-shaped change:
12 read sites change signature, the write changes shape, `UPGRADE_IDS` validation in
`buy.ts` changes meaning, the "N ulepszeń" stat changes meaning, and two suites must be
rewritten (`tests/upgrades-buy.test.ts`, 11 assertions on the flat shape, and
`tests/cross-device-restore.test.ts:117`). It also forces a decision about money already
spent that `prd-v3.md:76` constrains but does not settle. That is its own change, sequenced
after F5.

**Reversal condition.** B moves ahead of A if either (a) F5's scope grows to six worlds with
per-world upgrade catalogues, or (b) the maintainer judges "the completed shop arrives
already complete" (D-2) to be a launch blocker rather than a known limitation. If B is ever
taken, option E's `purchasedMeta` (Phase 4) is the attribution data it will want, and it
must ship with a legacy-row reading — *"the flat list belongs to whatever `theme` says
today"* — which is sound only because `theme` has never been mutable until this change.
**Phase 4 is therefore the phase that closes the window on that reading**: from the moment
`/app/worlds` ships, `theme` is mutable, and any purchase made after it without a recorded
world is permanently unattributable.

### D-2 — What the child actually sees after a switch, and what F5 ships for it

The research's sharpest point is that after a switch the new world can open fully furnished
and unbuyable: `canBuy` returns `owned` for everything (`upgrades.ts:146`), `nextUpgrade`
returns `null` (`:163`), the dashboard nudge disappears (`start.astro:173`) and the shop
rail falls to `t.upgradeShop.allOwned` (`UpgradeShop.tsx:242`). This plan does not paper
over it — but it does scope it precisely, because the research states it more absolutely
than the code does.

**Precision correction (plan review, traced in code).** Two states are easy to conflate:

- The *"nothing left to buy"* rail (`t.upgradeShop.allOwned`) is gated on
  `ownedList.length === UPGRADES.length` — **strictly all six** (`UpgradeShop.tsx:242`).
- The *absent dashboard nudge* is **not** exclusive to the completionist: `nextUpgrade`
  returns `null` whenever no **level-eligible** unowned upgrade exists
  (`upgrades.ts:162-163`), so a child at `business_level` 1 who owns the level-1 upgrades
  already sees no nudge and no saving bar (`start.astro:60-61,173`) — **today, with no
  world switch involved**.

Neither is created or worsened by a theme flip: both are functions of
`{wallet_balance, business_level, shop_state.purchased, skill_state}`, none of which is
written by, derived from, or co-varies with `theme`. The switch is provably a no-op for the
whole upgrade loop, so `t.worlds.carryOver` remains an honest promise. The scoping below
stands:

- **A child who has not bought everything keeps their exact ladder.** Owning 2 of 6 upgrades
  and switching world leaves 4 still to buy, at the same prices, with the same **nudge state**
  and the same progress bar (whatever that state was before the switch — see the precision
  note above; a level-gated child had no nudge before and has none after). Nothing about the
  loop changes. This is the common case.
- **Only the completionist arrives at a finished shop.** A child who owns all six sees the
  same "nothing left to buy" state they already saw in their old world *before* switching.
  The switch does not create that state; it carries it across. The app already has honest
  copy for it (`t.upgradeShop.allOwned` — *"Masz już wszystkie ulepszenia. Brawo!"*) and
  `start.astro:173` already renders no nudge when `next` is null. **No new dead-end is
  introduced.**

**F5 ships honest copy, not a new mechanic.** The `/app/worlds` screen states plainly, before
the child commits, what carries over: `t.worlds.carryOver` — *"Twój sklep i kupione
ulepszenia przenoszą się do nowego świata."* That turns "my shop is already finished here"
from a surprise into a stated property of the switch, which is the only thing F5 can
honestly promise given D-1.

**Explicitly deferred, with a note:** giving the completionist child a fresh goal ladder in
the new world. Two routes to it, both out of scope here: option B (per-world purchases,
its own change), or **F4 (`world-progression-stages`)**, whose named stage ladder is driven
by `business_level` — uncapped, `1 + floor(shifts/3)` — and therefore continues past
"all upgrades owned". F4 is the cheaper answer and it is already in flight.
**Reversal condition:** if playtesting shows children switch worlds specifically to reset
their shop, ship B.

### D-3 — Ship 4 worlds, not 6. The gap is content work.

The mockup draws six (3×2 web, 2×3 mobile); `src/data/worlds.ts` ships four. *Salon
kreatywny* and *Laboratorium wynalazków* have no slug, no name in code, and no committed
art. The run's **no-invented-data** rule forbids rendering placeholder worlds that do not
exist, and inventing two slugs without art would break `world-<slug>.webp` resolution.

**Decision: ship the four that exist. Do not block.** Adding worlds 5–6 is content work
(art crops into `public/illustrations/`, registered in `slice-map.md`, plus two `WORLDS`
entries) and needs no code change to this screen.

**The grid must look deliberate at four, at both breakpoints.** Decision: **`grid-cols-2` at
every breakpoint** — a 2×2 block, centred, with the grid column capped so tiles do not
balloon on wide screens. This is exactly the mockup's mobile layout, and 2×2 is the honest
reflow of a 3×2 grid holding four items (3+1 would read as a bug). When worlds 5–6 land,
`lg:grid-cols-3` restores the mockup's web layout in one class.
**Reversal condition:** the maintainer supplies art + names for worlds 5 and 6.

**Related: do NOT rename `Sklep księgarnia` → *Sklep kolekcjonera*.** The mockup uses the
latter, but `worlds.ts:9-10` records the reconciliation as deliberate, the committed art
(`world-sklep-ksiegarnia.webp`) is a bookshop, and renaming the label without new art
creates a name↔art mismatch that is worse than the current divergence. The **slug** must not
change under any circumstance — it is stored in live rows and the committed art resolves
from it (`world-<slug>.webp`). (Plan-review correction: `tests/data-lookups.test.ts:31-33`
asserts only that `WORLD_SLUGS` **mirrors** `WORLDS`; **no test pins the literal string
`sklep-ksiegarnia`**, so the type system will not catch a rename — the live rows will.) **Reversal condition:** collector-shop art arrives.

### D-4 — The existing copy promise, and what else needs aligning

`src/i18n/pl.ts:169` (`profileWizard.note`) already tells the parent *"Świat możesz zmienić
później. Skupiamy się na nauce przez praktykę i decyzje."* **This change is what makes that
sentence true.** Decision: **do not edit it** — it needs no change, it needed a feature.

A full sweep of `src/i18n/pl.ts` for world-related copy found four hits and **nothing else
needs aligning**: `:104` (`marketing.features[].title` — "Świat zainteresowań", a landing
feature card, still accurate), `:156` (`profileWizard.steps.profile` — "Avatar i świat",
still accurate), `:169` (the promise, now true), `:180`
(`profileWizard.validation.interestRequired` — "Wybierz świat", wizard-local). **No copy
anywhere states or implies the world is permanent.**

### D-5 — The endpoint mirrors `select.ts`, not a second idiom

`POST /api/profiles/world`, modelled on `src/pages/api/profiles/select.ts` (the closest
template: a form POST followed by a full page navigation). Concretely: `export const
prerender = false`; client via `createClient(request.headers, cookies)` **inside** the route
(no route in this repo uses `context.locals`); zod over **formData**; the new theme validated
by **`.refine` over `WORLD_SLUGS`, not `z.enum`** — `create.ts:29` documents why
(`WORLD_SLUGS` is `[string, ...string[]]`, not a literal union, so `z.enum` would need slug
literal types); ownership proven by re-resolving the id through the caller's RLS-scoped
client (`resolveActiveProfile`), exactly as `select.ts:41-44` does; every response wrapped
in `applyNoStore`; failures redirect with **no error param** so the route is not an existence
oracle (`select.ts:9`).

**Rejected: resolving the target profile from the `active_profile` cookie alone (no
`profileId` field).** It looks safer but is worse: `resolvePageProfile`'s fallback ladder
would silently write to the account's *sole* profile when a forged/stale cookie fails to
resolve — a surprising mutation on a bad pointer. `select.ts` and `delete.ts` both take an
explicit `profileId` and resolve it; a write route should not invent a third posture.

**Rejected: a JSON `fetch` endpoint returning status codes** (the `delete.ts` / `buy.ts`
idiom). The repo's rule of thumb is form-POST + redirect when a full page navigation
follows, `json()` when a mounted island stays put. A world switch navigates to `/app/start`.

**Per-account isolation is this project's highest-risk requirement** (CLAUDE.md: getting it
wrong is a silent data leak, not a crash). The test that fails if the scoping is dropped is
specified in Phase 1 — see **`rejects a foreign profileId and leaves the other account's row
untouched`**, which verifies durable state through the **service-role `admin` client**
(bypassing RLS) per lesson **L-002**, never through a read-back on the same session.

### D-6 — Navigation ships with the screen; no middleware edit

The no-dead-navigation rule cuts both ways: a nav entry never ships before its screen, and a
child surface that only the URL bar can reach is not shipped. Both the sidebar and the bottom
tab bar get the entry, from **one** `items` array in `src/components/app/AppShell.astro:59-63`
(both navs render once and toggle with `hidden` / `lg:hidden`, per its docblock at `:12-19`
— never conditionally rendered, so exactly one copy of each accessible name is in the a11y
tree). Label: `t.nav.items.worlds` = **"Światy"**, icon: `Globe` from `lucide-react`.

**Substring-collision check (this class of break has bitten this project before —
`context/changes/web-shell-and-mockup-parity/handoff.md:80-82`).** `getByText` matches
substrings. "Światy" is not a substring of, and does not contain, any existing nav label
("Pulpit", "Misje", "Mój sklep", "Panel rodzica") nor any string asserted by a live e2e
locator on a page that renders `AppShell` — checked: `seed.spec.ts:29` ("Portfel"),
`gameplay-restore.spec.ts:113` ("Masz to"), `:111` (`nextProgress`), `:105`
(`start.greeting`). **Phase 3 adds a unit test that keeps this true** (`tests/nav-labels.test.ts`).

Note also, correcting research §7: the new heading **"Wybierz swój świat" does *not* contain
`pl.ts:180`'s "Wybierz świat"** as a substring ("swój" sits between the words), so there is
no collision there in either direction.

**`PROTECTED_ROUTES = ["/app"]` (`src/middleware.ts:5`) is matched with `startsWith` at
`:42`, so `/app/worlds` is already gated. Do NOT edit the middleware.** The middleware does
not do parent-PIN or active-profile resolution — both are per-page — and `/app/worlds` is a
**child** surface, so it must **not** carry the parent-PIN gate.

**F4 also adds a nav entry — the bar reaches 6 tabs, and F4 has already cleared it.**
`context/changes/world-progression-stages/plan.md` D-6 does the arithmetic: minimum tab width
is `24px (icon) + 8px (px-1) = 32px`, so six tabs need **192px + 16px = 208px** against a
712px viewport, and at 712px each of six tabs gets **116px**. `truncate` never changes the
accessible name, so `getByRole("link", { name })` keeps resolving at 5 or 6 tabs. F4's label
is `t.nav.items.growth = "Rozwój świata"`; **"Światy" is neither a substring of nor contains
it**, so Phase 3's uniqueness/substring guard stays green when F4 lands.
**F5 and F4 collide on three files beyond `ShopArt` (D-11): the `active` union at
`AppShell.astro:38`, the `items` array at `:59-63`, and `nav.items` at `pl.ts:133-138`.** All
three are additive one-liners — resolve by keeping **both** entries, never by renaming an
existing tab (that would break the other feature's locators). Whoever lands second rebases.

**Accepted risk: the bottom bar grows a tab.** With F5 alone it is 5 tabs; **but the run's
implementation queue is `F2 → F3 → F1 → F4 → F5` (run-log §*Implementation queue*), so F4
lands first and the real bar at F5's landing is 6 tabs.** Re-verified against the component,
not F4's prose: the bar is `px-2` (16px) and each tab is `flex min-w-0 flex-1 … px-1` with a
`size-6 shrink-0` icon (`AppShell.astro:186-201`), so the per-tab floor is 24 + 8 = **32px**
and six tabs need 6×32 + 16 = **208px** — F4's number is correct. At 712px each of six tabs
gets (712−16)/6 = **116px**; at 360px, ~57px, and "Panel rodzica" truncates hard.
`truncate` never changes the accessible name, so `getByRole("link", { name })` holds at 5 or
6. Decision: accept and **verify at 360px and 712px** (Phase 3 manual criteria). **Reversal condition:** if it reads
as cramped on a phone, shorten the *new* label before touching existing ones — never drop
the entry from `tabs`, which would make the screen unreachable on touch (dead nav for
mobile users).

### D-7 — One CTA label, one subtitle, at every breakpoint

The mockup labels the commit button **"Start"** on web and **"Dalej"** on mobile, and uses
two different sub-lines. A breakpoint-dependent label is exactly the duplicate-accessible-name
hazard the contract forbids (one copy of each name; one responsive `h1`, never a pair).
**Decision: one key each.** CTA = `t.worlds.confirm` = **"Start"** (the web mockup's word;
"Dalej" reads as *next step in a wizard*, and this is a terminal action). Subtitle =
**"Co chcesz dziś prowadzić?"** (the mobile mockup's line — child-directed, and the web line
*"Ucz się matematyki przez decyzje"* duplicates the shell tagline *"Ucz się i zarabiaj"*).
**Reversal condition:** trivially — swap the two string constants.

### D-8 — `SelectTile` is reused as-is; the check badge sits bottom-right, not top-right

`src/components/child/SelectTile.tsx` is a generic controlled primitive whose docblock
already says `shape="card"` is for world tiles, and it already renders the mockup's marker
pair (ring + `CheckBadge`). Its badge is positioned `right-1 bottom-1`; the mockup draws it
top-right. **Decision: reuse as-is.** Forking or parameterising a shared primitive (also used
by the wizard's avatar picker) for one corner is not worth the churn, and the wizard's world
picker — the screen this one is a sibling of — already looks this way.
**Reversal condition:** if the maintainer wants pixel parity, add an optional
`badgePosition` prop rather than forking the component.

### D-9 — Zero-profile / multi-profile posture: mirror `upgrades.astro`

`/app/worlds` copies the `start.astro` / `upgrades.astro` posture verbatim: resolve via
`resolvePageProfile`; **2+ profiles without a selection → `Astro.redirect("/app")`** (the
router sends them to the picker); **0 profiles → render `<EmptyStateCard />`**. Rejected:
`task.astro`'s stricter redirect-on-both, because `/app/worlds` is a browsable surface like
the shop, not a mid-flow screen.

### D-10 — No migration. Verdict recorded.

`theme` already exists as `text not null default 'default'` with no CHECK
(`20260609120000_child_profiles_isolation.sql:55`), and `child_profiles_update_own`
(`:90-95`, `using` + `with check` on `auth.uid() = account_id`) already permits the write.
`shop_state` is jsonb with no shape constraint and the four RLS policies are
column-agnostic, so **option E's `purchasedMeta` sibling key needs no DDL either**.
**This change ships zero migration files.** If a future step somehow concludes otherwise,
RLS policies ship **in the same migration** (CLAUDE.md, lesson L-001) — and note F4 is
already opening `shift_log` for an earnings column, so a `shift_log.world` column, if ever
wanted, shares F4's migration rather than adding a second.

### D-12 — Implementation-step decisions (`/10x-implement`, 2026-08-23)

Recorded by the implementation step under the run's agent contract (no human in the loop;
`AskUserQuestion` never called). The skill's manual-confirmation gate, its dirty-path prompt,
its commit-message approval and its next-phase prompt all collapse to "decide and record".

- **Branch cut from `feat/ui-polish`, not from a stacked feature branch.** F5 touches no file
  in `src/lib/services/reports.ts`, around which F1/F2/F4 are stacked, so it stands alone.
  Verified: `git log --oneline -1` on the base read `64e3373 docs(assets): point the asset
  paths at directories that exist`.
- **The measured baseline is 299 unit tests, not the higher counts other branches report.**
  F1–F4 have NOT landed on this branch, so the queue-dependent expectations the plan-review
  wrote in (6 bottom-bar tabs, a 12th test in `tests/upgrades-buy.test.ts`, an F4-modified
  `ShopArt.tsx`) do **not** hold here. Each is resolved below in favour of what is actually on
  disk, which is exactly what the moving-baseline wording F1/F2 introduced asks for.
  - **Phase 3 ships a 5-tab bottom bar** (`Pulpit · Misje · Mój sklep · Światy · Panel
    rodzica`), the "5 tabs only if F4 has not landed" arm of criterion 3.7. The arithmetic is
    strictly slacker than the 6-tab case the review re-derived (208px minimum), so the
    accepted risk KR-3 is *smaller* here, not larger.
  - **Phase 4 counts 11 pre-existing tests** in `tests/upgrades-buy.test.ts` — the "count at
    phase start" the criterion mandates. F4's twelfth is not here to count.
  - **Phase 5 RUNS.** D-11's corrected trigger asks whether F4's landed diff restructured
    `ShopArt.tsx` or changed the base `src` at `:42`. No F4 diff exists on this branch: the
    component is byte-identical to `feat/ui-polish`, `WORLD_SLOTS` is still the empty literal,
    and the coordinates are tuned against exactly the `world-<slug>.webp` plates that ship.
  - **Playwright baseline measured, not pinned:** `npx playwright test --list` → *"Total: 15
    tests in 6 files"* at the start of this step. That is the number to hold, per F1.
- **Env files were copied into the worktree.** `.env` / `.env.test` are gitignored, so a fresh
  worktree has neither and the unit suite collapses to 168 tests with `PARENT_SESSION_SECRET
  is not configured`. Copied from the main checkout; `npx astro sync` was likewise needed
  before `npm run lint` was clean (55 spurious `no-unsafe-argument` errors without `.astro/`).
  Neither is a code change and neither is committed.
- **The isolation test was meta-checked, not just observed green** (L-002's own instruction).
  Breaking the route two ways: (a) removing the `resolveActiveProfile` gate left all 6 green —
  correct, and the direct confirmation of the review's "impossible twice over" claim, since
  RLS alone still blocks; (b) additionally swapping the caller's RLS-scoped client for a
  service-role client turned **`rejects a foreign profileId …` red**. The test bites on a real
  loss of scoping. Both breaks were reverted before the phase commit.
- **KR-7 left exactly as recorded** — neither closed nor widened. The route takes an explicit
  `profileId` and resolves it through the caller's client, matching `select.ts` / `delete.ts`;
  no active-profile equality check was added.

### D-11 — F4 owns `ShopArt.tsx`. F5 touches it only in a droppable final phase.

Feature **F4 (`context/changes/world-progression-stages/`)** is being researched in parallel
and is rebuilding how the shop scene composes for named growth stages; its own handoff
(§3) names `ShopArt.tsx` as the file it must decide the relationship with. **F4 owns
`ShopArt`.** F5 therefore:

- does **not** restructure the component — no new props, no changed signature, no changed
  render tree;
- touches exactly one thing: the **empty `WORLD_SLOTS` object literal at
  `ShopArt.tsx:26`**, filling it with coordinates (option D). This is data, not structure;
- isolates that into **Phase 5, which is explicitly droppable**.

**Plan-review correction — the skip trigger was wrong, and as written would drop Phase 5
unconditionally.** F5 is **last** in the run's implementation queue (`F2 → F3 → F1 → F4 → F5`),
so "if F4 has landed, skip" means "always skip" — and "hand the coordinates to F4" is then
impossible, because F4 is already committed. Read against F4's actual plan, the collision is
much smaller than D-11 assumed: F4's D-5 states it "**deliberately changes nothing
structural**" in `ShopArt`, and its only listed edit to the file is "**`ShopArt` — doc comment
only**"; the stage-art swap (`ShopArt:42` → `stage.art ?? world.image`) is explicitly deferred
and unwritten. **So the trigger is:**

- **Run Phase 5** if F4's landed diff to `ShopArt.tsx` is the doc comment (the expected case) —
  a doc-comment change cannot conflict with the `WORLD_SLOTS` literal, and coordinates tuned
  against today's `world-<slug>.webp` plates stay correct.
- **Skip Phase 5** only if F4's landed diff actually restructured the component or changed the
  base image `src` at `:42` — then the plates the coordinates were tuned against no longer
  exist, and the work belongs to whoever owns the new composition.

Either way F5 does **not** restructure the component and does **not** resolve a `ShopArt`
conflict blindly — it rebases.

**F5 does not need to restructure `ShopArt` at all** — the world switch requires zero changes
to it (the flip is lossless, §2.4). Phase 5 is a quality win, not a requirement. Also worth
recording: the mis-tuned coordinates on the three non-café plates are a **pre-existing**
condition — children who *created* a profile in `piekarnia` see them today — so F5 makes the
issue more reachable but does not create it. That is the second reason Phase 5 is droppable.
**Whoever implements: rebase on F4 rather than resolving a `ShopArt` conflict blindly.**

---

## Current State Analysis

- **`theme` is write-once.** Set by the create-profile wizard
  (`src/pages/api/profiles/create.ts`), never updated. There is no PATCH, no admin route, and
  no theme-change route anywhere in the repo.
- **`theme` is read in exactly three places**, all render-time, all via `worldForTheme()`:
  `src/pages/app/start.astro:33`, `src/pages/app/task.astro:27`,
  `src/pages/app/upgrades.astro:28`. Nothing is denormalized from it.
- **The world model is three fields.** `src/data/worlds.ts:12-16` — `{ slug, name, image }`.
  No palette, no per-world copy, no per-world products. Four worlds; `WORLD_SLUGS` at `:34`
  is the closed set for zod.
- **One global upgrade catalogue** (`src/data/upgrades.ts:8-9`), six theme-neutral upgrades,
  no world key on `Upgrade`.
- **`ShopArt.tsx:26`'s `WORLD_SLOTS` is an empty object literal** — the per-world seam
  exists, is unused, and overrides *coordinates only*, never the image.
- **`/app/worlds` is already gated** by `PROTECTED_ROUTES = ["/app"]` +
  `startsWith` (`src/middleware.ts:5,42`).
- **`AppShell` has four nav entries**; the union at `:38` is
  `"dashboard" | "missions" | "shop" | "parent"`, `items` at `:59-63`, `tabs = [...items,
  parent]` at `:65`. All four call sites pass a literal; widening the union needs no call-site
  edit.
- **The wizard's world picker is reusable in one piece only**: `SelectTile`
  (`src/components/child/SelectTile.tsx`). `CreateProfileWizard.tsx` is a 3-step flow bound to
  `/api/profiles/create` and is not.
- **Test baseline at the run's opening: 299 unit, 15 Playwright — both are moving numbers,
  since F1–F4 land before F5.** No test in the repo exercises `purchased`
  against a non-café world — every seed hard-codes `theme: "kawiarnia"`. There is **no test on
  `ShopArt`**.

## Desired End State

A signed-in child with an active profile can reach **Światy** from the sidebar (`lg+`) or the
bottom tab bar (below `lg`), see the four worlds as cards with their current world
pre-selected, tap another, watch the right rail's preview and the "W tym świecie nauczysz
się:" panel update, read that every world teaches the same competencies and that their shop
and upgrades come with them, press **Start**, and land on `/app/start` showing the new
world — with their wallet, level, skills and every purchased upgrade intact. The choice
**survives a reload and a new device** because it is a column on their profile row, and one
parent can never change another parent's child's world.

**Verification:** `npm run lint` clean; `npm test` green and no smaller than the count measured
at the start of the phase; `npx playwright test`
green; and the browser walk-through in *Browser-test candidates* below.

### Key Discoveries

- A theme flip is functionally lossless — `research.md` §2.4, traced end to end.
- `src/i18n/pl.ts:169` already promises this feature to the parent.
- `src/pages/api/profiles/select.ts:41-44` is the ownership idiom to copy verbatim.
- `src/lib/services/child-profiles.ts:111-121` (`deleteChildProfile`) is the
  single-statement `.eq("id", …).select("id")` update idiom and the
  `{ ok } | { failure } | { error }` result vocabulary to mirror.
- `src/pages/api/profiles/create.ts:29` documents why `theme` uses `.refine` over
  `WORLD_SLUGS` rather than `z.enum`.
- `src/components/app/AppShell.astro:12-19` states the binding both-navs-always-render rule.
- `tests/profiles-create.test.ts` is the route-level isolation template (real routes, real
  local Supabase session, durable state read through the service-role `admin` client).
- `src/lib/services/child-profiles.ts:250` — the only `shop_state` write; it spreads
  `...current.shop_state`, so a sibling key survives every purchase for free.

## What We're NOT Doing

- **Not** scoping purchases per world (option B) — D-1.
- **Not** resetting purchases on switch (option C) — rejected against `prd-v3.md:180`.
- **Not** adding worlds 5 and 6, and **not** renaming `Sklep księgarnia` — D-3.
- **Not** writing a migration — D-10.
- **Not** editing `src/middleware.ts` — `/app/worlds` is already gated — D-6.
- **Not** editing `src/i18n/pl.ts:169` — D-4.
- **Not** restructuring `ShopArt.tsx`; F4 owns it — D-11.
- **Not** adding per-world upgrade art, per-world copy, per-world catalogues, or a per-world
  `t.upgrades[world][id]` i18n dimension.
- **Not** touching `marketing.worlds` (`pl.ts:112-117`), the duplicated landing-page world
  list. It is decorative and out of scope.
- **Not** adding a parent-PIN gate to `/app/worlds` — it is a child surface.

## Implementation Approach

Five commit-sized phases, back to front:

1. **Service + endpoint** — the write path and its isolation tests, with no UI at all.
2. **The screen** — i18n block, the `WorldPicker` island, `src/pages/app/worlds.astro`.
3. **Navigation** — the fifth `AppShell` entry, plus a substring-collision guard test.
4. **Record the purchase world** (option E) — one field, one line in the write, two tests.
5. **`WORLD_SLOTS` coordinates** (option D) — **droppable**, F4-owned file.

Phases 4 and 5 are independent of 1–3 and of each other; 2 depends on 1; 3 depends on 2.

## Critical Implementation Details

**Phase ordering around the `AppShell` union.** Phase 2 renders `/app/worlds` inside
`AppShell` and must pass `active="worlds"`, which is a type error until the union at
`AppShell.astro:38` is widened. **Phase 2 widens the union; Phase 3 adds the `items` entry
and the label.** Between the two commits the page renders with nothing highlighted — correct
and type-safe, and it keeps "the screen" and "the nav" as separate reviewable commits.

**Phases 2 and 3 must land in the same session — do not stop a run between them.** Phase 2
alone leaves `/app/worlds` reachable only from the URL bar, which D-6 itself calls *"not
shipped"*. They are two commits, not two sittings. (Phase 1 alone is safe to stop on: it adds
an endpoint nothing links to. Its failure redirects point at `/app/worlds`, which does not
exist until Phase 2 — a 404 reachable only by hand-crafting a bad POST, and self-healing the
moment Phase 2 lands. Do not "fix" it by pointing Phase 1 somewhere else.)

**The island submits as a native form POST, not `fetch`.** Mirror
`CreateProfileWizard.tsx:98-108`: a same-origin `<form method="POST" action="…">` with
always-mounted hidden inputs carrying `profileId` and `theme`, so the browser performs the
navigation and the endpoint's redirect lands the child on `/app/start`. No JSON body is
parsed anywhere in this repo.

**Do not read `profile.shop_state.purchased` directly.** `ChildProfile.shop_state` is typed
non-optional (`child-profiles.ts:40`) but `{}` rows are legal forever; only
`readPurchased()` (`upgrades.ts:116-119`) is safe. This bites Phase 4.

## Phase 1: Theme write path — service + endpoint

### Overview

Add the only missing capability: an authenticated parent can change one of **their own**
child profiles' `theme` to a slug in the closed set. No UI.

### Changes Required:

#### 1. Service function

**File**: `src/lib/services/child-profiles.ts`

**Intent**: Add `updateChildProfileTheme` — the single-statement, RLS-scoped theme update. A
non-owner's update matches zero rows and reads as `not-found`, never touching another
account's row.

**Contract**: `updateChildProfileTheme(client: SupabaseClient, profileId: string, theme:
string): Promise<UpdateThemeResult>` where `UpdateThemeResult = { ok: true } | { failure:
"not-found" } | { error: PostgrestError }` — the same vocabulary as `DeleteProfileResult`
(`:99`). Implement with `.update({ theme }).eq("id", profileId).select("id")` and treat a
zero-length `data` as `not-found`, mirroring `deleteChildProfile` (`:114-118`). Do **not**
filter on `account_id` by hand — the service contract (`:9-15`) is that queries run as the
authenticated parent and RLS is the boundary.

#### 2. The endpoint

**File**: `src/pages/api/profiles/world.ts` (new)

**Intent**: `POST /api/profiles/world` — the form target for the world-selection screen.
Copies `select.ts` end to end: same gate order, same no-error-leak redirect, same ownership
proof.

**Contract**: `export const prerender = false;` and `export const POST: APIRoute`.
Gate order and outcomes:

| Condition | Result |
| --- | --- |
| `createClient(...)` returns `null` | `redirect("/auth/signin")` |
| no `auth.getUser()` user | `redirect("/auth/signin")` |
| zod parse of formData fails | `redirect("/app/worlds")`, **no error param** |
| `resolveActiveProfile(supabase, profileId)` → `null` | `redirect("/app/worlds")`, **no error param** |
| service returns `failure`/`error` | `redirect("/app/worlds")`, **no error param** |
| success | `redirect("/app/start")` |

Every response wrapped in `applyNoStore` (`src/lib/http.ts`). Schema:
`z.object({ profileId: z.uuid(), theme: z.string().refine((v) => (WORLD_SLUGS as readonly
string[]).includes(v)) })` parsed from `form.get(...)` — `.refine`, **not** `z.enum`
(`create.ts:21-24` carries the rationale comment — *"closed-set membership via refine
(robust across zod versions)"* — and `:29` is the `theme` field itself; the deeper reason is
that `WORLD_SLUGS` is typed `[string, ...string[]]` (`worlds.ts:34`, widened by
`WORLDS: readonly World[]`), so `z.enum` would preserve **no** literal narrowing here — unlike
`UPGRADE_IDS`, which `buy.ts:17` does use with `z.enum`. Pick per closed set, not per idiom).
`z.uuid()` is the shipped zod idiom (`select.ts:13`). Note there is **no DB CHECK on
`child_profiles.theme`** — this refine is the only thing standing between a client string and
the column, and `worldForTheme` is total (`worlds.ts:41-43`), so a bad slug would render
silently as `kawiarnia` rather than fail loudly. The success redirect targets `/app/start` so the child sees
the new world immediately, matching `select.ts:47`. The active-profile cookie is **not**
touched: the switch changes a profile's world, not which profile is active.

#### 3. Register the new RLS write surface

**File**: `docs/reference/contract-surfaces.md`

**Intent**: The repo convention (lesson **L-001**, and the file's own preamble) is that a new
account-owned write path is registered here. There is direct precedent: the
`## Child-profile deletion (RLS surface)` H2 exists solely for `POST /api/profiles/delete`.
The registry is live and actively maintained — F2 amended the `shift_log` entry this week.

**Contract**: under `## public.child_profiles`, extend the **Columns** line so `theme` is no
longer implicitly write-once (it is now mutated server-side via `updateChildProfileTheme`),
and add a bullet mirroring the deletion one:
*"**World-change surface (F5):** `POST /api/profiles/world` → `updateChildProfileTheme` via
`child_profiles_update_own`; the closed slug set is enforced in zod at the route
(`WORLD_SLUGS`), there is no DB CHECK. Isolation test: `tests/profiles-world.test.ts`."*
No new H2 is needed — this rides an existing table and an existing policy.

### Success Criteria:

#### Automated Verification:

- New suite passes: `npx vitest run tests/profiles-world.test.ts`
- Full unit suite green and no fewer tests than the count measured at the start of this phase
  (299 at the run's opening, but F1–F4 land first — measure, do not pin): `npm test`
- Lint + type-check clean: `npm run lint`
- `tests/profiles-world.test.ts` contains a test named `rejects a foreign profileId and leaves the other account's row untouched` that reads durable state via the service-role `admin` client
- `grep -q "export const prerender = false" src/pages/api/profiles/world.ts`
- `grep -q "profiles/world" docs/reference/contract-surfaces.md`

#### Manual Verification:

- No migration file was added (`git status` shows nothing under `supabase/migrations/`)

**Tests to write** — `tests/profiles-world.test.ts`, modelled on `tests/profiles-create.test.ts`
(real signin route → real cookie jar → real route, three accounts, `admin` for assertions):

1. **changes the caller's own profile theme and redirects to `/app/start`** — seed A's profile
   with `theme: "kawiarnia"`, POST `theme: "piekarnia"`, assert `Location === "/app/start"`
   and the `admin` read shows `piekarnia`.
2. **`rejects a foreign profileId and leaves the other account's row untouched`** — A signs
   in, POSTs B's `profileId` with `theme: "piekarnia"`; assert `Location === "/app/worlds"`
   with **no `?error=`**, that B's row read through `admin` is still `kawiarnia`, **and that
   A's own profile is also unchanged** (proving the route did not fall back to the caller's
   sole profile). *This is the test that fails if the scoping is dropped — per-account
   isolation is this project's highest-risk requirement (CLAUDE.md), and per **L-002** it
   asserts durable state through the RLS-bypassing `admin` client, not a read-back.*
3. **does not leak existence** — a syntactically valid but nonexistent uuid produces the
   **byte-identical** redirect as case 2.
4. **rejects a theme outside `WORLD_SLUGS`** — `theme: "nope"` → `/app/worlds`, row unchanged.
   Pins the same closed-set contract as `tests/profiles-create.test.ts:106-107`.
5. **rejects a malformed profileId** — a non-uuid → `/app/worlds`, no write.
6. **redirects an unauthenticated caller to `/auth/signin`** and writes nothing.

---

## Phase 2: The `/app/worlds` screen

### Overview

Build the screen to the binding mockups —
`assets/matmaverse-ui-v2-web/01-world-selection-web.png` and
`assets/matmaverse-ui-v2-mobile/01-world-selection-mobile.png` (local only; `assets/` is
gitignored — **open the PNGs before laying this out**, per the standing brief). Layout is
described in `research.md` §6.

### Changes Required:

#### 1. Copy

**File**: `src/i18n/pl.ts`

**Intent**: Add the screen's copy block. All strings Polish, all through i18n — no literal in
any component (lesson **L-003**).

**Contract**: a new top-level `worlds` block, placed after `profileWizard`, with **exactly**
these keys:

| Key | Value |
| --- | --- |
| `worlds.heading` | `"Wybierz swój świat"` |
| `worlds.subtitle` | `"Co chcesz dziś prowadzić?"` |
| `worlds.sameSkills` | `"Każdy świat uczy tych samych umiejętności"` |
| `worlds.carryOver` | `"Twój sklep i kupione ulepszenia przenoszą się do nowego świata."` |
| `worlds.learnHeading` | `"W tym świecie nauczysz się:"` |
| `worlds.learn.math.title` | `"Matematyka"` |
| `worlds.learn.math.body` | `"Dodawaj, odejmuj, licz resztę i pracuj z cenami."` |
| `worlds.learn.trade.title` | `"Handel"` |
| `worlds.learn.trade.body` | `"Zarządzaj produktami, cenami i zyskami."` |
| `worlds.learn.decisions.title` | `"Decyzje"` |
| `worlds.learn.decisions.body` | `"Planuj inwestycje i rozwijaj swój biznes."` |
| `worlds.confirm` | `"Start"` |
| `worlds.submitting` | `"Zmieniam…"` |

(`nav.items.worlds` is Phase 3.) The three `learn` bodies are the mockup's own strings. The
competency trio is **world-independent by design** — that is the screen's whole message
(D-2) — so it is not keyed by slug.

#### 2. The island

**File**: `src/components/child/WorldPicker.tsx` (new)

**Intent**: The interactive half — card grid with selection state, the preview rail that
follows the selection, and the commit form. Mounted `client:load`.

**Contract**: `WorldPicker({ profileId: string; currentTheme: string })`. Holds one piece of
state (`selected`, initialised to `worldForTheme(currentTheme).slug` so the current world is
pre-selected). Renders `WORLDS.map(...)` through **`SelectTile`** with `shape="card"`,
`selected`, `onSelect`, `image`, `alt={w.name}`, `label={w.name}` — reused unchanged (D-8).
Grid is `grid-cols-2` at every breakpoint with a capped max width (D-3). Below the grid, the
centred `worlds.sameSkills` line with a lucide `ShieldCheck` glyph and the `worlds.carryOver`
line (D-2). The rail (a right column on `lg+`, stacked below on mobile) shows the **selected**
world's `image`, `worlds.learnHeading`, and the three `learn` rows with lucide glyphs;
below `lg` it collapses to one divider-separated strip of the three titles with no bodies, per
the mobile mockup. The commit control is a **native form POST** — `<form method="POST"
action="/api/profiles/world">` with always-mounted hidden inputs `profileId` and `theme`
(the latter tracking `selected`), and a full-width `ChildButton` labelled `worlds.confirm`
that switches to `worlds.submitting` while submitting. Merge classes with `cn()` from
`@/lib/utils`. Any glyph is a lucide icon — no new artwork, so no
`public/illustrations/slice-map.md` entry.

#### 3. The page

**File**: `src/pages/app/worlds.astro` (new)

**Intent**: The Astro shell around the island — profile resolution, chrome, and the empty
state. Copy `upgrades.astro`'s head almost verbatim.

**Contract**: Resolve with `createClient(Astro.request.headers, Astro.cookies)` +
`resolvePageProfile`; `if (!resolved.profile && resolved.profileCount >= 2) return
Astro.redirect("/app")`; render `<EmptyStateCard />` when there is no profile (D-9). With a
profile, render `<AppShell heading={t.worlds.heading} subtitle={t.worlds.subtitle}
active="worlds" profile={{ name, avatarImage, level: business_level, wallet:
wallet_balance }}>` wrapping `<WorldPicker client:load profileId={profile.id}
currentTheme={profile.theme} />`. **No parent-PIN gate.**

#### 4. Widen the nav union (only)

**File**: `src/components/app/AppShell.astro`

**Intent**: Make `active="worlds"` type-legal. The `items` entry itself lands in Phase 3 (see
*Critical Implementation Details*).

**Contract**: `active: "dashboard" | "missions" | "shop" | "worlds" | "parent";` at `:38`.
Nothing else in this file changes in this phase; the four existing call sites need no edit.

### Success Criteria:

#### Automated Verification:

- New component suite passes: `npx vitest run tests/worlds-picker.test.tsx`
- Full unit suite green and above the Phase 1 count: `npm test`
- Lint + type-check clean: `npm run lint`
- `npx playwright test` green, with **no pre-existing spec newly failing**. Do **not** pin an
  absolute count: 15/15 is today's baseline (`npx playwright test --list` → *"Total: 15 tests
  in 6 files"*, 13 `desktop` + 2 `touch`), but **F5 is last in this run's implementation
  queue** (`F2 → F3 → F1 → F4 → F5`, run-log §*Implementation queue*) and each earlier
  feature's `/10x-e2e` step may add specs. Measure the count at the start of the phase and
  hold it — an absolute number here is an unsatisfiable criterion in an unattended run.

#### Manual Verification:

- `/app/worlds` matches `01-world-selection-web.png` at `lg+` and
  `01-world-selection-mobile.png` below `lg`: card grid, blue ring + check badge on the
  selected card, the shield reassurance line, the competency rail/strip, the full-width CTA
- The 2×2 grid reads as deliberate at 360px, 712px and 1440px — no orphan tile, no
  ballooning cards
- The child's current world is ringed on load; tapping another card moves the ring and
  updates the rail preview immediately
- Pressing **Start** lands on `/app/start` showing the new world, with the wallet, level
  and every owned upgrade unchanged
- No horizontal scroll at 360px

**Tests to write** — `tests/worlds-picker.test.tsx` (Testing Library + vitest, following
`tests/task-guardrail.test.tsx` / `tests/delete-account-section.test.tsx`):

> **Two locator facts about `SelectTile` that will otherwise cost the implementer a debugging
> cycle** (both verified in the component, not assumed):
>
> - Its button contains **both** the `<img alt>` and the `<span>{label}</span>`, so with
>   `alt={w.name}` + `label={w.name}` (the wizard's own usage, `CreateProfileWizard.tsx:254-256`)
>   the **accessible name is doubled** — `"Kawiarnia Kawiarnia"`. Testing Library matches a
>   string `name` against the **whole** accessible name, so `getByRole("button", { name: w.name })`
>   **fails**. Use a regex (`{ name: new RegExp(w.name) }`) — or pass `alt=""` and let the visible
>   label carry the name, which is also the more correct a11y choice here since the label is
>   right there. (Playwright's `getByRole` defaults to *substring* matching, which is why
>   `e2e/onboarding.spec.ts:73` works with `.first()` — do not generalise from it.)
> - `SelectTile.tsx:25` renders `aria-pressed={selected}` unconditionally, so an **unselected**
>   tile carries `aria-pressed="false"` — it never *drops* the attribute. Assert on the value,
>   never with `not.toHaveAttribute("aria-pressed")`.

1. renders one selectable tile per `WORLDS` entry, labelled with the world's name
2. pre-selects the profile's current theme — exactly one tile has `aria-pressed="true"`
3. pre-selects the fallback world when `currentTheme` is the DB default `'default'`
   (guards `worldForTheme`'s fallback reaching the UI)
4. moves the selection on click — the previously selected tile flips to `aria-pressed="false"`
5. the hidden `theme` input's value tracks the selection, and `profileId` is always mounted
6. renders `t.worlds.sameSkills` and `t.worlds.carryOver` (the honest-copy guarantee of D-2)
7. renders the three competency titles from `t.worlds.learn`

---

## Phase 3: Navigation entry

### Overview

Make the screen reachable. One `items` entry serves both the sidebar and the bottom bar.

### Changes Required:

#### 1. The nav entry

**File**: `src/components/app/AppShell.astro`

**Intent**: Add the fifth primary destination, now that its route exists (no dead nav).

**Contract**: import `Globe` from `lucide-react` (`:2`); add
`{ key: "worlds", href: "/app/worlds", label: t.nav.items.worlds, icon: Globe }` to `items`
(`:59-63`), positioned after `shop` so the parent entry stays last in `tabs`. Both navs pick
it up automatically — `items` feeds the sidebar loop and `tabs = [...items, parent]` feeds
the bottom bar. **Do not conditionally render either nav**; the `hidden` / `lg:hidden`
toggling is the binding constraint (`:12-19`).

#### 2. The label

**File**: `src/i18n/pl.ts`

**Intent**: Add the nav label alongside the existing four.

**Contract**: `nav.items.worlds: "Światy"` in the block at `:133-138`, whose comment at
`:124` already states *"only destinations that exist as routes are listed (no dead nav)"*.

### Success Criteria:

#### Automated Verification:

- New guard suite passes: `npx vitest run tests/nav-labels.test.ts`
- Full unit suite green and above the Phase 2 count: `npm test`
- Lint + type-check clean: `npm run lint`
- `npx playwright test` green with no pre-existing spec newly failing (same moving-baseline
  rule as Phase 2 — do not pin a count) — in particular `gameplay-restore.spec.ts` on the
  `touch` project, which renders the bottom bar at 712px with its new tab

#### Manual Verification:

- "Światy" appears once in the sidebar at `lg+` and once in the bottom bar below `lg` —
  never both at once (check the a11y tree, not just pixels)
- The entry is highlighted (`aria-current="page"`) on `/app/worlds` and not elsewhere
- The bottom bar is legible at **360px** and **712px**; "Panel rodzica" still readable.
  **Expect 6 tabs, not 5**: F4 (`world-progression-stages`) adds `t.nav.items.growth` and
  **precedes F5** in the run's implementation queue, so by the time this phase lands the bar
  is `Pulpit · Misje · Mój sklep · Światy · Rozwój świata · Panel rodzica`. (5 tabs only if
  F4 has not landed.) The arithmetic holds either way — see KR-3.
- Every other `/app` page still highlights its own entry

**Tests to write** — `tests/nav-labels.test.ts` (new, pure — no Supabase):

1. every `t.nav.items` value is unique
2. **no `t.nav.items` value is a substring of another** — the locator-hygiene invariant that
   has broken this project's tests before (D-6); this test is the reason the invariant stays
   true when a sixth entry is added
3. no `t.nav.items` value is a substring of, or contains, the strings live e2e `getByText`
   locators assert on `AppShell` pages (`t.start.walletLabel`, `t.upgradeShop.ownedTag`)

---

## Phase 4: Record the world on each purchase (option E)

### Overview

One write-only field that stops the attribution gap from growing. Nothing reads it yet;
nothing the child sees changes. **This is the phase that matters most for optionality** —
from the moment Phase 1 ships, `theme` is mutable, and a purchase recorded without a world
can never be attributed to one (D-1).

### Changes Required:

#### 1. The type

**File**: `src/types.ts`

**Intent**: Declare the optional sibling key on `ShopState` so the write is typed and the
intent is documented at the type.

**Contract**: `ShopState` gains `purchasedMeta?: Record<string, { world: string; at: string }>`
— keyed by upgrade id (unique: `canBuy` blocks re-buying), `world` the profile's world slug at
purchase time, `at` an ISO timestamp. **Optional**, so every legacy `{}` and `{ purchased: [] }`
row stays valid and `readPurchased` is untouched. Extend the docblock at `:85-91` to say the
field is **write-only in v1** and exists to preserve the per-world option.

#### 2. The write

**File**: `src/lib/services/child-profiles.ts`

**Intent**: Record the world alongside the purchase in the existing UPDATE. No extra query —
`buyUpgrade` already holds the full `current` row (`:222-225`).

**Contract**: In `buyUpgrade`'s UPDATE (`:246-252`, today
`shop_state: { ...current.shop_state, purchased: nextPurchased }`), the `shop_state` value
gains
`purchasedMeta: { ...(current.shop_state.purchasedMeta ?? {}), [upgrade.id]: { world: worldForTheme(current.theme).slug, at: new Date().toISOString() } }`.
**The inner spread is load-bearing:** naming `purchasedMeta` as an explicit key *shadows* the
outer `...current.shop_state`, so without it every purchase would discard the prior entries.
(The `?? {}` is required for the same reason `readPurchased` exists — `shop_state` is typed
non-optional but `{}` rows are legal forever.) Normalise through `worldForTheme(...).slug` so
the DB default `'default'` is stored as `kawiarnia`, never as `'default'`. `purchased` and
`wallet_balance` semantics are **unchanged** — this must not alter a single existing
assertion.

**Cross-feature note:** F4 also edits `child-profiles.ts` — `appendShiftLog`'s signature
(`:129`) and `recordShiftResult`'s call (`:187`) — and explicitly leaves `buyUpgrade`'s
`appendShiftLog` call (`:257-262`) alone. Different hunks from this phase's UPDATE, so no
conflict is expected; F5 lands second and rebases.

#### 3. Register the new jsonb key

**File**: `docs/reference/contract-surfaces.md`

**Intent**: Same convention as Phase 1 — `shop_state`'s documented shape is part of the
`## public.child_profiles` entry, and a new persisted key belongs in the registry.

**Contract**: in the **Columns** line, note that `shop_state` also carries an optional
`purchasedMeta` (`{ [upgradeId]: { world, at } }`), **write-only in v1**, written by
`buyUpgrade`, ignorable by every reader (`readPurchased` untouched). One sentence, no new H2.

### Success Criteria:

#### Automated Verification:

- Extended suite passes: `npx vitest run tests/upgrades-buy.test.ts` — **every pre-existing
  test in the file still green and unmodified**. Count them at the start of the phase rather
  than trusting a number: there are **11 today**, but `context/changes/world-progression-stages/plan.md`
  adds a twelfth to this exact file (asserting a purchase row's `earned` is `null`) and **F4
  lands before F5**. The invariant is "none edited, none red", not "exactly 11"
- Full unit suite green and above the Phase 3 count: `npm test`
- Lint + type-check clean: `npm run lint`
- `npx playwright test` green — `e2e/gameplay-restore.spec.ts` exercises the real buy path
- No migration file added
- `grep -q "purchasedMeta" docs/reference/contract-surfaces.md`

#### Manual Verification:

- Buy an upgrade in the app, inspect the row in Supabase Studio: `shop_state.purchased` is
  unchanged in shape, `shop_state.purchasedMeta` gained one entry with the correct slug

**Tests to write** — appended to `tests/upgrades-buy.test.ts`:

1. **records the world and a timestamp on purchase** — after a successful buy, the `admin`
   read shows `shop_state.purchasedMeta[<id>].world === <profile theme>` and a parseable
   ISO `at`
2. **normalises the DB default** — a profile whose stored `theme` is `'default'` records
   `world === "kawiarnia"`, never `"default"`
3. **leaves `purchased` untouched** — after two buys, `shop_state.purchased` is still the
   flat `string[]` in purchase order (regression guard for the file's existing tests and for
   `tests/cross-device-restore.test.ts:117`)

---

## Phase 5: Per-world overlay coordinates (option D) — DROPPABLE

### Overview

Fill the empty `WORLD_SLOTS` literal so owned-upgrade overlays sit correctly on the three
non-café plates. Pure data, purely presentational, no data change.

> **F4 (`world-progression-stages`) owns `src/components/child/ShopArt.tsx`** (D-11), and F4
> lands **before** F5. Per D-11's corrected trigger: **run this phase** if F4's landed diff to
> the file is the doc comment its plan describes (the expected case); **skip it entirely** only
> if F4 actually restructured the component or changed the base image `src` at `:42`. Never
> resolve a conflict in this file blindly — rebase. Nothing else in F5 depends on this phase:
> the world switch is lossless without it, and the mis-tuning is pre-existing (it already
> affects children who *created* a profile in `piekarnia`).

### Changes Required:

#### 1. The slot table

**File**: `src/components/child/ShopArt.tsx`

**Intent**: Populate the per-world coordinate overrides that the component already reads.
**Data only** — no new prop, no changed signature, no changed render tree.

**Contract**: `WORLD_SLOTS` (`:26`) gains one entry per non-default slug — `piekarnia`,
`galaktyczna-baza`, `sklep-ksiegarnia` — each mapping all six upgrade ids to a
`CSSProperties` percent position tuned against that world's `.webp` plate. `kawiarnia` is
**omitted** so it keeps falling through to `DEFAULT_SLOTS`, which was tuned against it. Every
value uses percent units and sets exactly one horizontal (`left`/`right`) and one vertical
(`top`/`bottom`) property, matching `DEFAULT_SLOTS`' shape, so the existing `placed` /
`unplaced` partition (`:37-38`) keeps working unchanged.

### Success Criteria:

#### Automated Verification:

- New suite passes: `npx vitest run tests/shop-art-slots.test.ts`
- Full unit suite green and above the Phase 4 count: `npm test`
- Lint + type-check clean: `npm run lint`
- The `ShopArt` diff is data-only, checked by a command that can actually see it:
  `git diff -U0 src/components/child/ShopArt.tsx | grep '^[+-]' | grep -v '^[+-][+-]'`
  shows **only** lines inside the `WORLD_SLOTS` literal — no `interface ShopArtProps`, no
  `export function ShopArt`, no JSX line. (`--stat` shows counts, not lines, and cannot
  evaluate this criterion.)

#### Manual Verification:

- With all six upgrades owned, `/app/start` and `/app/upgrades` place every overlay sensibly
  on each of the four world plates, at both `lg+` and mobile widths
- No overlay clips the art box edge or covers another overlay

**Tests to write** — `tests/shop-art-slots.test.ts` (new; the repo's **first** `ShopArt`
test):

1. every non-default `WORLD_SLUGS` entry has a `WORLD_SLOTS` table
2. every such table covers all six `UPGRADE_IDS` — a missing id would silently fall back to a
   coordinate tuned for a different plate
3. `kawiarnia` is absent from `WORLD_SLOTS` (it must fall through to `DEFAULT_SLOTS`)
4. every slot sets exactly one of `left`/`right` and exactly one of `top`/`bottom`, all
   values percent strings within 0–100

---

## Known risks

Recorded by `/10x-plan-review` — KR-1…KR-6 on 2026-08-22, KR-7 on 2026-08-23 (the run's second
review pass, after the first was killed by an API limit before saving its report; the report
that goes with the current text is `reviews/plan-review.md`, dated 2026-08-23). These are
**accepted, not fixed** — each is either a deliberate trade-off the reviewer declined to
overturn unattended, or a pre-existing condition F5 inherits rather than creates.

**KR-1 — A failed switch is silent to the child.** D-5 redirects every failure back to
`/app/worlds` with **no error param**, so the route is not an existence oracle. The cost: a
child presses **Start**, nothing visibly happens, and no message explains why. Because
`resolveActiveProfile` (`active-profile.ts:28`) destructures `{ data }` and **discards
`error`**, a transient DB failure is indistinguishable from "not your profile" — both are
silent no-ops. This mirrors `select.ts` exactly (the profile picker children already use), so
the reviewer kept the repo idiom rather than inventing a third posture unattended.
*If it needs fixing:* a single generic `?error=1` → one i18n string distinguishes **no**
outcomes and so leaks nothing, while giving the child feedback. That is a product call for
the maintainer, not an implementation detail.

**KR-2 — `buyUpgrade`'s UPDATE never checks affected rows.** `child-profiles.ts:246-254`
checks only `updateErr`; if the UPDATE matches zero rows it still returns a success wallet
balance that was never persisted. Ownership is proven by the read at `:223-226`, so this is
not an isolation hole — but it is a correctness gap Phase 4 edits *around*. **Phase 4 must not
try to fix it** (that is a behaviour change to the buy path, outside F5). `deleteChildProfile`
(`:114`) shows the better idiom, and `updateChildProfileTheme` uses it from the start.

**KR-3 — Six bottom tabs at 360px — the expected end state, not a hypothetical** (F4 precedes
F5 in the queue). F4's D-6 claims 6 tabs fit at the `touch` project's 712px and that 208px is
the hard minimum; **re-derived from the component itself during the 2026-08-23 review and
confirmed**: bar `px-2` = 16px, each tab `flex-1 min-w-0 … px-1` with a `size-6 shrink-0` icon
→ 24 + 8 = 32px floor, 6 × 32 + 16 = **208px**; at 712px each tab gets 116px. The e2e suite is
safe. At 360px
each tab is ~57px and "Panel rodzica" truncates hard. Accepted; `truncate` never changes the
accessible name, so locators hold. Shorten the **new** label before touching an existing one.

**KR-4 — The 2×2 grid's max width is unspecified.** D-3 says "capped so tiles do not balloon
on wide screens" without a number. Precedent to copy: `CreateProfileWizard.tsx:244` already
renders these same four worlds as `grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2`.
Manual criterion 2.6 (360/712/1440px) is the gate.

**KR-5 — No test pins the world slug strings.** `tests/data-lookups.test.ts:31-33` asserts
only that `WORLD_SLUGS` mirrors `WORLDS`, so renaming `sklep-ksiegarnia` would stay green in
CI and break live rows silently. Out of scope for F5 (D-3 forbids the rename anyway), but
worth knowing before anyone "tidies" the catalogue.

**KR-6 — CSRF posture is inherited, and it holds.** The new route is a native cross-origin-
reachable form POST with no token. The Supabase auth cookies are `sameSite: "lax"`
(`src/lib/supabase.ts:14`), which is **not** sent on a cross-site POST, so a forged submit
arrives unauthenticated and redirects to `/auth/signin`. Identical to `select.ts`,
`create.ts` and `delete.ts`. No action; recorded so it is not re-litigated.

**KR-7 — The write is account-scoped, not profile-scoped: a caller can aim it at their OWN
other child.** *(Recorded by the second `/10x-plan-review`, 2026-08-23, after tracing the
policies rather than the summary.)* **Cross-account is impossible, twice over** — this is the
requirement that matters and the plan meets it. `child_profiles` carries four per-operation
policies, all `to authenticated`, all predicated on `auth.uid() = account_id`
(`20260609120000_child_profiles_isolation.sql:78-104`), so (a) `resolveActiveProfile`'s
`.eq("id", …)` SELECT returns zero rows for a foreign id → the route bounces, and (b) even
if that gate were deleted, `child_profiles_update_own`'s `using` + `with check` would match
zero rows. Phase 1's isolation test asserts exactly this, through the service-role `admin`
client (L-002). Nothing rests on client input.

**But `child_profiles` RLS has the same account-scoped shape F2 found on `shift_log`**, so
within one account it does **not** separate siblings: nothing in the route pins `profileId`
to the *active* profile, and profile ids are already visible to the browser on
`/app/pick-profile` (its form posts one per profile). A crafted POST therefore changes a
sibling's world — and then redirects to `/app/start`, which still renders the *active*
profile, so the change is invisible to the person who made it. **Accepted, not fixed:**
`select.ts` and `delete.ts` take the same posture and already grant a strictly larger
capability on the same ids (become that sibling; delete that sibling), the effect here is a
cosmetic, reversible theme flip with no money and no cross-account exposure, and adding an
active-profile equality check would be a third posture no other route uses. *If it ever needs
fixing:* compare `parsed.data.profileId` against `readActiveProfileId(context.cookies)` and
redirect on mismatch — one line, no new concept. F2's `listRecentActivity` is the precedent
for treating intra-account separation as a real, separate concern.

## Testing Strategy

### Unit tests

Baseline is **299 as of the run's opening** and may only go up. **It is a floor, not a target,
and it will already have moved when F5 starts** — F5 is last in the queue (`F2 → F3 → F1 → F4
→ F5`) and F1–F4 each add tests. Every phase criterion is written as "≥ the count measured at
the start of the phase"; do not pin an absolute number anywhere. Per phase, F5 adds: Phase 1
`tests/profiles-world.test.ts` (6); Phase 2 `tests/worlds-picker.test.tsx` (7); Phase 3
`tests/nav-labels.test.ts` (3); Phase 4 extends `tests/upgrades-buy.test.ts` (+3); Phase 5
`tests/shop-art-slots.test.ts` (4) — **+23 from wherever the suite stands**. Run with `npm test`
(`vitest run`, `fileParallelism: false`); the local Supabase stack must be up for the
route-level suites.

The single most important test in this plan is Phase 1's **`rejects a foreign profileId and
leaves the other account's row untouched`**: per-account data isolation is the project's
highest-risk correctness requirement, and this route is the first ever to mutate a profile
row from a child-reachable surface.

### Browser-test candidates (for this run's `/10x-e2e` step)

Two risks genuinely need a browser. Both are for the `/10x-e2e` step to write — this plan
names them so that step has something concrete, and does **not** pre-write them.

1. **A world switch persists across a reload** *(the strongest single test; recommended
   first)*. Seed an account with `theme: "kawiarnia"` and `shopState: { purchased: ["sign"] }`
   via `e2e/helpers/accounts.ts` (`seedChildProfile` already accepts both — **no new fixture
   is needed**). Sign in, open **Światy** from the nav, select **Piekarnia**, press **Start**,
   land on `/app/start` and assert the world name reads "Piekarnia"; **reload** and assert it
   still does; then open `/app/upgrades` and assert `t.upgradeShop.ownedTag` still marks
   `sign` as owned. This covers persistence, the redirect target, and — crucially — the
   carry-over decision D-1 in the one place a child would notice it.
2. **The nav entry at touch width.** The `touch` Playwright project runs at 712px and is
   currently restricted to `gameplay-restore.spec.ts` by `playwright.config.ts`'s
   `testMatch`. Adding the new spec to that regex exercises the **5-tab bottom bar** (D-6)
   at the viewport that matters, and is the cheapest guard against the accepted layout risk.

Locator hygiene for whoever writes these: prefer `getByRole(..., { name })` — it matches the
**full** accessible name. Reserve `getByText` for strings verified against D-6's
substring analysis.

### Manual testing steps

1. Sign in as the demo account (`ui-polish-demo@example.test`), open **Światy** from the
   sidebar at `lg+` and from the bottom bar below `lg`.
2. Confirm the current world is ringed on load; select another and watch the rail update.
3. Press **Start**; confirm the landing on `/app/start`, the new world's art and name, and
   an unchanged wallet, level, skill bars and owned-upgrade overlays.
4. Reload; confirm the world persisted.
5. Buy an upgrade, then switch world again; confirm the upgrade is still owned and still
   drawn in the scene.
6. Sign in as a second account and confirm its child's world is unaffected throughout.
7. Check 360px for horizontal scroll and bottom-bar legibility.

## Performance Considerations

None material. The screen adds one SSR page that runs the same single `listChildProfiles`
query every other child page runs, and one island whose entire state is a selected slug. The
four world images are already committed and already served on `/app/start`; the rail's
preview reuses the same `.webp`, so it is a cache hit. The endpoint performs one SELECT
(ownership resolution) and one UPDATE.

## Migration Notes

**No migration.** `theme` is already `text not null default 'default'` with no CHECK
(`20260609120000_child_profiles_isolation.sql:55`); `child_profiles_update_own` (`:90-95`)
already permits the UPDATE; `shop_state` is jsonb with no shape constraint and the four RLS
policies are column-agnostic, so Phase 4's `purchasedMeta` needs no DDL either. See D-10 —
including what to do in the (not expected) event a future step concludes otherwise: RLS
policies ship in the same migration, granular per-operation and per-role (lesson L-001).

Nothing in this change is destructive, so the rollback path `prd-v3.md:131` requires is
simply reverting the commits: `theme` values written by the new route remain valid slugs that
every existing read already handles, and `purchasedMeta` is an ignorable extra jsonb key.

## References

- Research: `context/changes/world-selection-screen/research.md` (§1 the `purchased` coupling
  map, §2.4 the lossless-flip trace, §5 the five options, §6 the mockups)
- Standing brief: `context/runs/2026-08-22-autonomous-five/agent-contract.md`
- Parallel feature that owns `ShopArt`: `context/changes/world-progression-stages/`
- Source backlog entry: `context/changes/web-shell-and-mockup-parity/handoff.md` §4 B1
- Endpoint template: `src/pages/api/profiles/select.ts:41-47`; validation idiom:
  `src/pages/api/profiles/create.ts:25-30`
- Service idiom: `src/lib/services/child-profiles.ts:111-121`
- Test template: `tests/profiles-create.test.ts`
- Lessons: `context/foundation/lessons.md` L-001 (RLS in the same migration), L-002 (assert
  durable state, not the API response), L-003 (no inline literals — copy via `src/i18n/pl.ts`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Theme write path — service + endpoint

#### Automated

- [x] 1.1 New suite passes: `npx vitest run tests/profiles-world.test.ts` — ccb9c15
- [x] 1.2 Full unit suite green, test count ≥ the count measured at phase start (do not pin an absolute number): `npm test` — ccb9c15
- [x] 1.3 Lint + type-check clean: `npm run lint` — ccb9c15
- [x] 1.4 `tests/profiles-world.test.ts` contains the foreign-profileId isolation test asserting durable state via the service-role `admin` client — ccb9c15
- [x] 1.5 `grep -q "export const prerender = false" src/pages/api/profiles/world.ts` — ccb9c15
- [x] 1.6 `grep -q "profiles/world" docs/reference/contract-surfaces.md` — ccb9c15

#### Manual

- [x] 1.7 No migration file was added — ccb9c15

### Phase 2: The `/app/worlds` screen

#### Automated

- [x] 2.1 New component suite passes: `npx vitest run tests/worlds-picker.test.tsx` — e20f717
- [x] 2.2 Full unit suite green and above the Phase 1 count: `npm test` — e20f717
- [x] 2.3 Lint + type-check clean: `npm run lint` — e20f717
- [x] 2.4 `npx playwright test` green with no pre-existing spec newly failing (count measured at phase start, not pinned) — e20f717

#### Manual

- [x] 2.5 Screen matches the web and mobile mockups (grid, ring + badge, reassurance line, competency rail, CTA) — e20f717
- [x] 2.6 The 2×2 grid reads as deliberate at 360px, 712px and 1440px — e20f717
- [x] 2.7 Current world ringed on load; tapping another moves the ring and updates the rail — e20f717
- [x] 2.8 Start lands on `/app/start` with the new world and unchanged wallet/level/upgrades — e20f717
- [x] 2.9 No horizontal scroll at 360px — e20f717

### Phase 3: Navigation entry

#### Automated

- [x] 3.1 New guard suite passes: `npx vitest run tests/nav-labels.test.ts` — 02af7c5
- [x] 3.2 Full unit suite green and above the Phase 2 count: `npm test` — 02af7c5
- [x] 3.3 Lint + type-check clean: `npm run lint` — 02af7c5
- [x] 3.4 `npx playwright test` green with no pre-existing spec newly failing, including `touch` at 712px — 02af7c5

#### Manual

- [x] 3.5 "Światy" appears exactly once in the a11y tree at every viewport — 02af7c5
- [x] 3.6 The entry is highlighted on `/app/worlds` and nowhere else — 02af7c5
- [x] 3.7 The bottom bar (6 tabs once F4 has landed, 5 otherwise) is legible at 360px and 712px — 02af7c5
- [x] 3.8 Every other `/app` page still highlights its own entry — 02af7c5

### Phase 4: Record the world on each purchase (option E)

#### Automated

- [x] 4.1 Extended suite passes with every pre-existing test unmodified and green (count at phase start; F4 adds one): `npx vitest run tests/upgrades-buy.test.ts`
- [x] 4.2 Full unit suite green and above the Phase 3 count: `npm test`
- [x] 4.3 Lint + type-check clean: `npm run lint`
- [x] 4.4 `npx playwright test` green
- [x] 4.5 No migration file added
- [x] 4.6 `grep -q "purchasedMeta" docs/reference/contract-surfaces.md`

#### Manual

- [x] 4.7 A real purchase writes `shop_state.purchasedMeta` with the correct slug, leaving `purchased` unchanged in shape

### Phase 5: Per-world overlay coordinates (option D) — DROPPABLE

#### Automated

- [ ] 5.1 New suite passes: `npx vitest run tests/shop-art-slots.test.ts`
- [ ] 5.2 Full unit suite green and above the Phase 4 count: `npm test`
- [ ] 5.3 Lint + type-check clean: `npm run lint`
- [ ] 5.4 `git diff -U0 src/components/child/ShopArt.tsx | grep '^[+-]' | grep -v '^[+-][+-]'` shows only lines inside the `WORLD_SLOTS` literal — no signature, prop, or JSX line

#### Manual

- [ ] 5.5 All six overlays sit sensibly on each of the four world plates at both breakpoints
- [ ] 5.6 No overlay clips the art box edge or covers another overlay
