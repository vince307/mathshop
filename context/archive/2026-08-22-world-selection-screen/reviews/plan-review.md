<!-- PLAN-REVIEW-REPORT -->
# Plan Review: World-selection screen (`/app/worlds`) — F5

- **Plan**: `context/changes/world-selection-screen/plan.md`
- **Mode**: Deep
- **Date**: 2026-08-23
- **Verdict**: **REVISE** → **SOUND** after triage (all 8 findings resolved in-plan or recorded)
- **Findings**: 0 critical, 5 warnings, 3 observations

> **Run context.** This is the *second* plan-review pass on F5. The first was killed by an API
> session limit before it saved anything, so `reviews/` did not exist and `change.md` never
> advanced — but that pass **had** already applied edits into `plan.md` (the `## Known risks`
> block KR-1…KR-6 and several inline "plan-review correction" notes). This pass started from
> scratch and **verified those applied edits against the code rather than rubber-stamping
> them**; where they were right, that is recorded below as a verification, not a finding.
> Triage was performed by the reviewer under the run's agent contract (no human in the loop):
> CRITICAL would be fixed in-plan, WARNING fixed where clear and contained else recorded under
> `## Known risks`, OBSERVATION recorded.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING (3 findings — all cross-feature landing-order) |
| Plan Completeness | WARNING (5 findings — criteria phrasing and one test trap) |

## Grounding

`Grounding: 13/13 paths ✓, 12/12 symbols ✓, brief↔plan 1 drift (F8b, fixed)`

Paths checked on disk: `src/lib/services/child-profiles.ts`, `src/lib/services/active-profile.ts`,
`src/pages/api/profiles/{select,create}.ts`, `src/components/app/AppShell.astro`,
`src/components/child/{SelectTile,ShopArt,UpgradeShop,CreateProfileWizard}.tsx`,
`src/data/{worlds,upgrades}.ts`, `src/middleware.ts`, `src/i18n/pl.ts`, `src/types.ts`,
`src/pages/app/upgrades.astro`, `docs/reference/contract-surfaces.md`,
`supabase/migrations/20260609120000_child_profiles_isolation.sql`, and both binding mockups
(`assets/matmaverse-ui-v2-{web,mobile}/01-world-selection-*.png` — present, opened, read).

**Progress↔Phase mechanical contract: clean.** Exactly one `## Progress`; all five
`## Phase N: <name>` have matching `### Phase N: <name>`; all 37 success-criteria bullets have
matching `- [ ] N.M` rows (1.1–1.7, 2.1–2.9, 3.1–3.8, 4.1–4.7, 5.1–5.6); no checkbox outside
the Progress block.

**Contract surfaces** (`docs/reference/contract-surfaces.md` H2 grep): the plan touches
`## public.child_profiles`. It reports that surface accurately (four per-operation policies,
column-agnostic, `shop_state` jsonb reserved), renames nothing, and Phases 1 and 4 each carry a
registry amendment with a `grep -q` criterion. The `## Child-profile deletion (RLS surface)` H2
is correctly cited as the precedent for the new bullet.

---

## What was verified in code (not taken from the research summary)

These are the load-bearing claims the review was asked to attack. All held.

**1. Account scoping of the write — the project's highest-risk requirement. ✅ SOUND.**
`child_profiles` carries four per-operation policies, all `to authenticated`, all
`auth.uid() = account_id` (`20260609120000_child_profiles_isolation.sql:78-104`). The plan's
endpoint proves ownership **twice**: `resolveActiveProfile` (`active-profile.ts:23-30`) does
`.eq("id", …)` through the caller's RLS client, so a foreign id reads zero rows and bounces;
and `updateChildProfileTheme`'s `.update().eq("id", …).select("id")` would independently match
zero rows under `child_profiles_update_own`'s `using` + `with check`. **Nothing rests on client
input**, and Phase 1's `rejects a foreign profileId and leaves the other account's row
untouched` asserts durable state through the service-role `admin` client per L-002. The hostile
question ("what stops a caller passing someone else's `profileId`?") has a server-side answer at
two layers. → The one real gap is **intra-account**, not cross-account: see F6 / KR-7.

**2. D-1 — no upgrade is world-specific and a theme flip is render-time only. ✅ CONFIRMED.**
`Upgrade` (`upgrades.ts:16-41`) has **no world field**. `canBuy` (`:145`) and `nextUpgrade`
(`:161`) read only `{ walletBalance, businessLevel, purchased, skillState }` — `theme` appears
nowhere in the module. `theme` is read in exactly three places, all render-time, all via
`worldForTheme()`: `start.astro:36`, `task.astro:27`, `upgrades.astro:28`. `ShopArt` takes
`world.image` as its `src` (`:42`); no `${world.slug}` interpolation exists in any `src=`.
**`prd-v3.md:180` re-read as instructed**: it is **Open Question #5**, and it says the framing
"*should be validated with real children and iterated*" — an unproven mitigation, not a
requirement. The plan had already caught this and re-grounded the option-C rejection on
`prd-v3.md:92` ("*on return the grown shop and purchase persist **for that profile***"), which
is a genuine FR and does carry the weight. **The correction is fair and correctly applied**;
the residual citation slip is F8a. FR-010 (`:106`, "the world defines a small upgrade catalog")
does point the other way and the plan says so — the shipped code already declined it.

**3. D-2 — the motivational claim behind `t.worlds.carryOver`. ✅ TRUE, the copy is honest.**
Traced: `t.upgradeShop.allOwned` is gated on `ownedList.length === UPGRADES.length` — strictly
all six (`UpgradeShop.tsx:242`). `nextUpgrade` returns `null` whenever no *level-eligible*
unowned upgrade exists (`upgrades.ts:161-164`), which is a pre-existing state a level-1 child
already sees with no world switch involved. Since neither function reads `theme`, **a switch is
provably a no-op for the entire upgrade loop** — a mid-ladder child keeps their exact ladder,
prices, nudge and bar; a completionist carries across a finished state they already had. The
plan's precision correction to the research is right, and `t.worlds.carryOver` ("*Twój sklep i
kupione ulepszenia przenoszą się do nowego świata.*") is a true statement, not a lie told to a
child. No CRITICAL here.

**4. Zod against `WORLD_SLUGS`. ✅ CONFIRMED.** `WORLD_SLUGS = WORLDS.map(w => w.slug) as
[string, ...string[]]` (`worlds.ts:34`) — exactly the shape the plan assumes, and exactly why
`create.ts:29` uses `.refine((v) => (WORLD_SLUGS as readonly string[]).includes(v))` rather than
`z.enum` (no literal narrowing survives the `readonly World[]` widening). The migration confirms
**no DB CHECK on `child_profiles.theme`** (`text not null default 'default'`), and
`worldForTheme` is total, so a bad slug would render silently as `kawiarnia` rather than fail —
the plan states this and the refine is the only guard. An unknown slug cannot reach the DB.

**5. Navigation. ✅ CONFIRMED, and the label matches the mockup exactly.** The web mockup's own
sidebar reads **"Światy"** with a globe glyph — D-6 picked the mockup's word, not an invention.
Substring sweep of `src/i18n/pl.ts` for world copy returns four hits (`:104` "Świat
zainteresowań", `:156` "Avatar i świat", `:169` the promise, `:180` "Wybierz świat"); **none
contains "Światy" and "Światy" contains none of them.** Same for the four existing nav labels
and every live e2e `getByText`/`getByRole` string on `AppShell` pages. The heading "Wybierz swój
świat" does not contain `:180`'s "Wybierz świat" ("swój" sits between) — the plan's correction
of research §7 is right. `PROTECTED_ROUTES = ["/app"]` (`middleware.ts:5`) is matched with
`startsWith` at `:42`, so **`/app/worlds` is already gated and no middleware edit is needed** —
confirmed; the plan's explicit "do NOT edit the middleware" is well placed.
**Bottom-bar arithmetic re-derived from the component, not from F4's prose, and it holds**: bar
`px-2` = 16px; each tab `flex min-w-0 flex-1 … px-1` with a `size-6 shrink-0` icon → 24 + 8 =
**32px** floor; 6 × 32 + 16 = **208px**; at 712px each of six tabs gets **116px**. F4's number
is correct. `truncate` never changes the accessible name, so `getByRole` locators hold at 5 or
6 tabs. → What was *wrong* is that the plan assumed 5 tabs, when the queue makes 6 the real
number: F4.

**6. The 4-versus-6-worlds gap. ✅ deliberate and future-proof.** The mockup draws 6 in a 3×2
web grid; `WORLDS` ships 4 (`worlds.ts:26-31`) and worlds 5–6 have no slug and no committed art,
so no-invented-data forbids them. `grid-cols-2` at every breakpoint gives a clean 2×2 at four —
and would give a clean 3×2-rows layout at six without breaking; `lg:grid-cols-3` restores the
mockup in one class. The wizard already renders these same four worlds through the same
primitive (`CreateProfileWizard.tsx:244`), so the look is consistent with a shipped screen.

**7. D-11 / `ShopArt` boundary. ⚠️ the boundary is real but the plan mis-stated it — F3 below.**
`WORLD_SLOTS` at `ShopArt.tsx:26` is an empty literal, read at `:38/:39/:46` with
`?? DEFAULT_SLOTS`, so filling it is pure data and **dropping Phase 5 restores exactly today's
behaviour**. Nothing in Phases 1–4 depends on it and it is last — **genuinely droppable**. But
F4's plan says it "deliberately changes nothing structural" in `ShopArt` and lists its only edit
as "**`ShopArt` — doc comment only**", with the `stage.art ?? world.image` swap explicitly
deferred and unwritten.

**8. Landing order. ✅ F5 does not touch `src/lib/services/reports.ts`** — no occurrence of
`reports` anywhere in the plan, and the run-log's own three-way ordering note (`F2 → F1 → F4`
in that file) says the same. F5's true position: **last in the strictly-serial implementation
queue, `F2 (running) → F3 → F1 → F4 → F5`.** That single fact is what generates findings F1–F4
below — the plan was written as if it might land early.

---

## Findings

### F1 — Playwright criterion pins "15/15"; F5 lands last, after four other features' e2e steps

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 SC + Progress 2.4; Phase 3 SC + Progress 3.4
- **Detail**: `npx playwright test --list` reports **"Total: 15 tests in 6 files"** today, so the
  number is currently right. But F5 is **last** in the run's implementation queue, the per-feature
  pipeline's step 7 is `/10x-e2e` (which writes specs under `e2e/`), and F5's own Testing Strategy
  schedules two new browser tests plus a `playwright.config.ts` `testMatch` widening. Any spec
  landed by F1–F4 moves the count, at which point an automated criterion reading "still green at
  15/15" can never be satisfied — and `/10x-goal-implement` drives exactly these rows unattended.
  This is the same defect class caught as F1 in `dashboard-recent-activity`'s review (there it was
  "17 runs" against a real 15); the difference is that F2 could prove its count *couldn't* move
  and F5 cannot.
- **Fix**: Replace the pinned count with "green, no pre-existing spec newly failing; measure the
  count at the start of the phase", keeping 15 as a dated baseline with the `--list` evidence and
  the reason it will have moved.
- **Decision**: **FIXED** — both Success Criteria and both Progress rows rewritten.

### F2 — Phase 4 pins "all 11 pre-existing assertions"; F4 adds a 12th to that exact file, first

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 SC + Progress 4.1; Testing Strategy; Phase 4 test 3
- **Detail**: `tests/upgrades-buy.test.ts` has exactly **11** `it()` blocks today — the plan's
  count is accurate as of writing. But `context/changes/world-progression-stages/plan.md` names
  that file as one it edits and adds an assertion proving a purchase row's `earned` is `null`, and
  **F4 lands before F5**. The invariant the criterion is *reaching for* ("Phase 4 must not alter a
  single existing assertion") is right and valuable; the number attached to it is not durable.
- **Fix**: State the invariant as "every pre-existing test still green and unmodified — count them
  at phase start", noting 11 today and that F4 adds one.
- **Decision**: **FIXED** — criterion, Progress row, Testing Strategy and the Phase 4 test-3
  parenthetical all rewritten. A **cross-feature note** was also added to Phase 4 recording that
  F4 edits `child-profiles.ts` at `:129` and `:187` and deliberately leaves `buyUpgrade`'s
  `appendShiftLog` call (`:257-262`) alone — different hunks from Phase 4's UPDATE at `:246-252`,
  so no conflict is expected and F5 rebases as the second lander. That collision was not recorded
  anywhere in the plan before this review.

### F3 — D-11's skip trigger drops Phase 5 unconditionally, and for a reason F4's plan contradicts

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: `## Autonomous decisions` → D-11; Phase 5 blockquote
- **Detail**: D-11 says: "*If F4 has landed or is in flight on this file when Phase 5 comes up,
  skip Phase 5 and hand the coordinates to F4.*" Since F4 always lands first, that reads as "always
  skip" — and "hand the coordinates to F4" is then impossible, because F4 is already committed. It
  also over-states F4's claim on the file: F4's own D-5 says it "**deliberately changes nothing
  structural**" in `ShopArt` and its listed edit is "**`ShopArt` — doc comment only**"; the
  `ShopArt:42` → `stage.art ?? world.image` swap is explicitly deferred and unwritten. A
  doc-comment change cannot conflict with the `WORLD_SLOTS` literal, so the phase would be dropped
  for a collision that does not exist. (The *droppability* itself is sound and was verified —
  nothing depends on Phase 5, and dropping it restores today's behaviour exactly.)
- **Fix**: Replace the trigger with the condition that actually matters — run Phase 5 if F4's
  landed diff to the file is the doc comment; skip only if F4 restructured the component or changed
  the base image `src` (in which case the plates the coordinates were tuned against are gone).
- **Decision**: **FIXED** — D-11 and the Phase 5 blockquote both rewritten with the corrected
  trigger and the queue fact spelled out.

### F4 — Phase 3 verifies a "5-tab bottom bar"; the real bar at F5's landing has 6 tabs

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: D-6 accepted-risk paragraph; Phase 3 manual SC + Progress 3.7
- **Detail**: D-6 accepts "the bottom bar becomes 5 tabs with F5 alone" and Progress 3.7 asks the
  verifier to check "the 5-tab bottom bar". With F4 landed first, the bar is
  `Pulpit · Misje · Mój sklep · Światy · Rozwój świata · Panel rodzica` — six. A manual criterion
  that describes the wrong artefact invites either a false pass or a spurious "this doesn't match
  the plan" stop. The *arithmetic* is fine (re-derived above: 208px hard minimum, 116px per tab at
  712px), and `t.nav.items.growth = "Rozwój świata"` neither contains nor is contained by "Światy",
  so Phase 3's substring guard stays green — only the stated count was wrong.
- **Fix**: Say 6 (5 only if F4 has not landed) and name why.
- **Decision**: **FIXED** — D-6, KR-3, the Phase 3 manual criterion and Progress 3.7 updated; the
  208px/116px derivation is now recorded from the component rather than cited from F4's prose.

### F5 — Phase 2's tile tests cannot find the tiles as written: `SelectTile` doubles the accessible name

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 → "Tests to write", cases 1, 2, 4
- **Detail**: The island's contract passes `alt={w.name}` **and** `label={w.name}`, mirroring
  `CreateProfileWizard.tsx:254-256`. `SelectTile` renders both inside the same `<button>`
  (`SelectTile.tsx:37,41`), so the accessible name is **"Kawiarnia Kawiarnia"**. Testing Library
  matches a string `name` against the *whole* normalized accessible name, so the natural
  `getByRole("button", { name: w.name })` fails — while Playwright's `getByRole` defaults to
  substring matching, which is exactly why `e2e/onboarding.spec.ts:73` works (with `.first()`) and
  why the trap is easy to walk into by analogy. Separately, case 4's wording ("the previously
  selected tile **drops** `aria-pressed`") is wrong: `SelectTile.tsx:25` renders
  `aria-pressed={selected}` unconditionally, so an unselected tile carries `aria-pressed="false"`;
  a literal reading produces `not.toHaveAttribute("aria-pressed")`, which is red on correct code.
- **Fix**: Record both facts in the plan's test list, with the regex/`alt=""` options spelled out.
- **Decision**: **FIXED** — a locator-facts note added above the Phase 2 test list; case 4 reworded
  to "flips to `aria-pressed="false"`".

### F6 — The write is account-scoped, so a caller can aim it at their own other child's profile

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: D-5; Phase 1 endpoint contract
- **Detail**: Cross-account is impossible twice over (verified above) — the CRITICAL requirement is
  met. But `child_profiles` RLS has **the same account-scoped shape F2 found on `shift_log`**, and
  nothing in the route pins `profileId` to the *active* profile. Profile ids are already exposed to
  the browser on `/app/pick-profile` (its form posts one per profile), so a crafted POST changes a
  **sibling's** world — and then redirects to `/app/start`, which renders the *active* profile, so
  the change is invisible to whoever made it. Not a leak, and not a new exposure class:
  `select.ts` and `delete.ts` take the same posture on the same ids and already grant strictly
  larger capabilities (become that sibling; delete that sibling). The effect here is a cosmetic,
  reversible theme flip with no money involved.
- **Fix**: Record as an accepted risk with the one-line remedy, rather than inventing a third
  route posture unattended. (`parsed.data.profileId` vs `readActiveProfileId(context.cookies)`.)
- **Decision**: **RECORDED** as **KR-7** under `## Known risks`, with the policy evidence, the
  precedent, and the reversal fix.

### F7 — Phase 4's `purchasedMeta` write, as specified, would discard prior entries

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 → change 2, "Contract"
- **Detail**: The existing UPDATE is `shop_state: { ...current.shop_state, purchased: nextPurchased }`
  (`child-profiles.ts:246-252`). The plan writes the new key as `{ ...(existing), [upgrade.id]: … }`
  — correct — but then says "*the spread of `...current.shop_state` already preserves the key across
  future writes*", which is true only for writes that do **not** name the key. Naming `purchasedMeta`
  explicitly shadows the outer spread, so a reader who trusts the prose and drops the inner spread
  ships a field that only ever holds the most recent purchase. `(existing)` is also an unresolved
  placeholder in a document whose other contracts are literal.
- **Fix**: Write it out — `...(current.shop_state.purchasedMeta ?? {})` — and say why the inner
  spread and the `?? {}` are both load-bearing.
- **Decision**: **FIXED** — contract rewritten with the literal expression and the shadowing
  explanation.

### F8 — Two citation slips, one of which survived into the brief

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: D-1 (a); `plan-brief.md` decision table (b)
- **Detail**: (a) D-1 attributed "deliberately theme-neutral SVGs" to `src/data/upgrades.ts:8-9`;
  those lines actually say v1 ships one shared catalogue. The theme-neutral claim is real but lives
  at `public/illustrations/slice-map.md:25`, and the stronger evidence is structural anyway (`Upgrade`
  has no world field; `canBuy`/`nextUpgrade` never read `theme`). Content right, pointer wrong.
  (b) `plan-brief.md` still credited `prd-v3.md:180` with naming owned upgrades "*the*
  monotonic-progress mitigation" and with carrying the option-C rejection — the exact claim the plan
  itself had already corrected. The brief is what an implementer reads first, so the stale version
  is the one that would have been believed.
- **Fix**: Point both at the evidence that actually supports them.
- **Decision**: **FIXED** — D-1 rewritten to lead with the structural proof; the two brief rows
  re-grounded on `prd-v3.md:92` with `:180`'s Open-Question status named inline.

---

## Triage summary

```
Fixed in plan.md:   F1, F2, F3, F4, F5, F7, F8   (7)
Recorded as risk:   F6 → KR-7                    (1)
Skipped/dismissed:  none

► Verdict after fixes: REVISE → SOUND
```

Every fix is confined to `context/changes/world-selection-screen/` (`plan.md` and `plan-brief.md`).
No production file was touched, no branch created, no commit made.

## Autonomous decisions

Made by this review under the run's agent contract (`AskUserQuestion` never called).

1. **Nothing was graded CRITICAL, and the verdict is not RETHINK.** The two candidates the brief
   flagged in advance — the endpoint's account scoping, and D-2's motivational claim behind
   `t.worlds.carryOver` — were both traced to code and both **held**. Grading either CRITICAL to
   look thorough would have sent a sound plan back for a rewrite it does not need.
2. **F6 recorded, not fixed.** Adding an active-profile equality check to this one route would
   introduce a posture no other route in the repo uses, for a within-account cosmetic change that
   `select.ts` already out-classes. Recording it with its one-line remedy leaves the maintainer the
   product call. *Would change the answer:* if a route ever exposes another profile's **money or
   PII** from a child surface, this stops being cosmetic and the check ships.
3. **The three landing-order findings (F2/F3/F4) were fixed by re-anchoring the plan on the queue
   rather than by re-sequencing the run.** F5 stays last. Its plan now states the queue where each
   affected criterion lives, so an unattended implementer reads the right expectation at the point
   of use. *Would change the answer:* if the queue is re-ordered, these notes need re-checking —
   they name F4 explicitly, so a re-order is visible rather than silent.
4. **Phase 5 was kept, not deleted.** F3 could have been resolved by cutting the phase outright
   (it is droppable and F4 owns the file). Kept because the corrected trigger makes it runnable in
   the expected case, and the mis-tuned coordinates on the three non-café plates are a real,
   pre-existing defect that F5 makes far more reachable. *Would change the answer:* F4 landing a
   restructured `ShopArt` — the plan now says exactly that.
5. **`plan-brief.md` was edited as well as `plan.md`.** Strictly the review's remit is the plan,
   but the brief is the document an implementer opens first and it carried a decision rationale the
   plan had already retracted. Two rows changed; nothing else touched.
