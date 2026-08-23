<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: World-selection screen (`/app/worlds`) — F5

- **Plan**: `context/changes/world-selection-screen/plan.md`
- **Scope**: Phases 1–5 of 5 (all Progress rows `[x]`, 37/37)
- **Branch**: `feat/world-selection-screen`, 6 commits `ccb9c15` → `1833349`, cut from `feat/ui-polish` (does **not** stack on F1/F2/F4)
- **Date**: 2026-08-23
- **Verdict**: **NEEDS ATTENTION** — no blocker; the branch is **mergeable as-is**, the findings are test-hardening follow-ups
- **Findings**: 0 critical · 3 warnings · 6 observations
- **Reviewer note**: this review ran unattended under
  `context/runs/2026-08-22-autonomous-five/agent-contract.md`. The skill's interactive
  triage collapsed to "decide and record" — see `## Autonomous decisions`.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING (3 findings) |

## Verification actually re-run by this review (not accepted from the handoff)

| Check | Claimed | Measured here |
|---|---|---|
| `npm test` | 322 passed / 43 files | **322 passed (43 files)** ✅ |
| `npm run lint` | clean | **clean, no output** ✅ |
| `npm run check` | 0 errors / 0 warnings | **0 errors, 0 warnings, 8 hints** (170 files) ✅ |
| `npx playwright test` | 15 passed | **15 passed (25.6s)**, desktop 13 + touch 2 ✅ |
| New tests | +23 | 6 + 7 + 3 + 4 new = 20, `upgrades-buy` 11 → 14 = **+23**; 322 − 23 = 299 baseline ✅ |
| Migrations added | none | `git diff --name-only … -- supabase/` → **0 files** ✅ |
| `prerender = false` on the new route | yes | `src/pages/api/profiles/world.ts:9` ✅ |
| `grep profiles/world` / `grep purchasedMeta` in `contract-surfaces.md` | yes | both ✅ |
| Pre-existing `upgrades-buy` tests unmodified | yes | `git diff -U0` shows **3 removed lines, all in helpers** — no line inside any of the 11 pre-existing `it()` blocks ✅ |

### The isolation meta-check, re-run independently

The implementer's two deliberate breaks were **re-performed by this review**, not taken on
trust, and both reproduce exactly as reported. The file was restored byte-for-byte afterwards
(`git diff --stat` empty; `tests/profiles-world.test.ts` back to 6/6 green).

1. **Break 1 — delete the `resolveActiveProfile` ownership gate**, passing
   `parsed.data.profileId` straight to `updateChildProfileTheme`:
   → **6 passed (6)**. The suite does *not* bite. This is *correct behaviour*, not a false
   green: `child_profiles_update_own` (`using` + `with check` on `auth.uid() = account_id`)
   matches zero rows for a foreign id on its own, so the write genuinely cannot land. The
   in-route gate is defence-in-depth, and defence-in-depth that is removed leaves the
   security property intact — which is why the test stays green.
2. **Break 2 — additionally swap the caller's RLS-scoped client for `createAdminClient()`**
   (service-role, bypasses RLS):
   → **2 failed | 4 passed**. Red: `rejects a foreign profileId and leaves the other
   account's row untouched` (`expected '/app/start' to be '/app/worlds'`, i.e. account A's
   POST at account B's profile *succeeded*) and `does not leak existence`.

**Conclusion: the test bites on a real loss of scoping.** It is not a test that certifies
nothing. The residual gap — a break that removes the in-route gate is invisible to this suite
— is covered one layer down by `tests/child-profiles-isolation.test.ts:94` (`UPDATE isolation:
account B cannot modify account A's row`) and `:115` (gameplay-state variant), which pin the
policy itself. Route suite + policy suite together cover both proofs. Recorded as **F4**.

### KR-7 — neither closed nor widened (confirmed)

`src/pages/api/profiles/world.ts:57-60` takes an explicit `profileId`, resolves it through
`resolveActiveProfile` on the caller's own client, and writes `profile.id`. `resolveActiveProfile`
resolves **any** profile the account owns — so a crafted POST can still flip a *sibling's*
world, and `/app/start` then renders the *active* profile, hiding the change from whoever made
it. **This is exactly the posture `select.ts` (become that sibling) and `delete.ts` (delete
that sibling) already ship**, and both grant strictly larger capabilities on the same ids. No
`readActiveProfileId` equality check was added; no capability was widened. Unchanged, as
recorded. Cross-**account** remains impossible, proved twice and meta-checked above.

### D-1 / D-2 — the promise made to a child is structurally true

`t.worlds.carryOver` ("Twój sklep i kupione ulepszenia przenoszą się do nowego świata") is a
promise to a 6–9-year-old, so it was checked structurally, not anecdotally:

- **`theme` appears nowhere in `src/data/upgrades.ts`** (grep: zero hits). `canBuy`
  (`upgrades.ts:144`) reads `{ purchased, businessLevel, skillState }`; `nextUpgrade` (`:161`)
  reads `{ businessLevel, purchased }`. Neither can observe a world switch.
- A full `theme` / `worldForTheme` sweep of `src/` finds read sites only at render time
  (`start.astro:33`, `task.astro:27`, `upgrades.astro:28`, `worlds.astro:41`, the picker) plus
  the new write-only `purchasedMeta` line. Nothing is denormalized from `theme`.
- `updateChildProfileTheme` (`child-profiles.ts:137-146`) is a **single-column** UPDATE:
  `.update({ theme }).eq("id", profileId).select("id")`. `wallet_balance`, `business_level`,
  `shop_state` and `skill_state` are not in the statement and cannot be touched by it.

The switch is lossless **by construction**, not by luck. The implementer's runtime read-back
(`theme: piekarnia` with `wallet_balance: 126`, `business_level: 3`,
`purchased: ["sign","shelf"]`) is consistent with the code, and the code is what makes it hold
for every future row.

### Zod / `WORLD_SLUGS`

`worldSchema` (`world.ts:21-23`) is `z.object({ profileId: z.uuid(), theme: z.string().refine(v =>
WORLD_SLUGS.includes(v)) })` — `.refine`, not `z.enum`, matching `create.ts:29` and its recorded
rationale. There is **no DB CHECK on `child_profiles.theme`** and `worldForTheme` is total, so
this refine is the only thing between a client string and the column — and it is asserted
(`rejects a theme outside WORLD_SLUGS and writes nothing`, verified red-capable via break 2's
sibling cases). `export const prerender = false` present.

### The mockup correction — verified against the binding PNGs

Both mockups were opened during this review (`assets/matmaverse-ui-v2-{web,mobile}/01-world-selection-*.png`).

- **`01-world-selection-mobile.png` confirms the implementer's reading.** The mobile mockup has
  **no preview image and no "W tym świecie nauczysz się:" heading**; it keeps a single compact
  three-column strip — *Matematyka | Handel | Decyzje*, titles only, icon above, vertical
  dividers — directly above a full-width CTA. Making the preview + `learnHeading` `lg`-only is
  the **correct** reading, not a shortcut.
- **`01-world-selection-web.png`** shows the right rail exactly as built: preview image,
  `learnHeading`, three title+body rows, full-width `Start` CTA with a chevron; the shield line
  *"Każdy świat uczy tych samych umiejętności"* centred under the grid. It also draws the
  sidebar entry **"Światy" with a globe icon** — independently confirming Phase 3's label and
  `Globe` choice.
- Icon semantics match the mockup one-for-one (calculator / cart / signpost, blue / green /
  amber).
- Known, plan-recorded divergences, all deliberate: 4 worlds not 6 (D-3), CTA "Start" at both
  breakpoints where mobile draws "Dalej" (D-7), check badge bottom-right not top-right (D-8),
  and `t.worlds.carryOver` — an added line present in **neither** mockup, mandated by D-2 as
  the honest-copy guarantee.

### Navigation

`AppShell.astro:63` adds `{ key: "worlds", href: "/app/worlds", label: t.nav.items.worlds, icon: Globe }`
to the single `items` array after `shop`; `tabs = [...items, parent]` keeps parent last. The bar
therefore ships **5 tabs** on this branch. No middleware edit — `PROTECTED_ROUTES = ["/app"]`
matched with `startsWith` (`middleware.ts:5,42`) already gates `/app/worlds`, and the diff
touches no middleware file. **No conflict with F4**: F4 appends `growth` to the same array, so
the merged bar is 4 items + growth + parent = **6 tabs**, which is precisely the configuration
F4's step measured at 712px (16px `px-2` + 6 × 116px, `flex-1 min-w-0`, `truncate` on the label
span so the accessible name is never altered). The two features collide only as additive
one-line edits in `AppShell.astro:63` and `pl.ts:137` — resolve by keeping both entries, never
by renaming an existing tab.

### Phase 5 and the `ShopArt` boundary

`git diff -U0 … -- src/components/child/ShopArt.tsx` filtered for structural tokens returns
**only** the `WORLD_SLOTS` declaration line (with `export` prepended) and comment/data lines —
no `interface ShopArtProps`, no `export function ShopArt`, no JSX. The component's signature,
props and render tree are untouched, so F4's own work merges alongside it. Three tables
(`piekarnia`, `galaktyczna-baza`, `sklep-ksiegarnia`), six ids each, `kawiarnia` deliberately
absent so it falls through to `DEFAULT_SLOTS`. The added `export` is D-12-recorded and needed
by the new test.

### Pattern compliance and scope

`world.ts` is `select.ts` with the update swapped in — same gate order, same `applyNoStore` on
all five returns, same `const WORLDS = "/app/worlds"` bounce constant mirroring `const PICKER`,
same no-error-param posture. `worlds.astro` mirrors `upgrades.astro` line for line.
`WorldPicker.tsx` uses `cn()` at both merged-class sites, carries **zero** user-visible literals
(every string via `t.worlds.*`, L-003), and matches the `export default` + native-form-POST
island idiom. Service logic sits in `src/lib/services/child-profiles.ts`. 20 files in the diff,
6 of them this change's own process artifacts; nothing the plan did not ask for, and every
"What We're NOT Doing" boundary holds (no migration, no middleware edit, no `sklep-ksiegarnia`
rename, no `e2e/` spec — those are reserved for `/10x-e2e`).

## Findings

### F1 — `worlds-picker` does not bind the form target it claims to lock

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `tests/worlds-picker.test.tsx:35-39` (and the file docstring, `:10-12`)
- **Detail**: The docstring says the file "locks the POST payload", but nothing asserts
  `action="/api/profiles/world"` or `method="POST"`, and `hiddenInput()` locates inputs with
  `container.querySelector` — anywhere in the tree, not inside the form. Point the action at a
  wrong path, switch to `method="GET"` (which would put `theme`/`profileId` in the query string
  and commit nothing), or delete the `<form>` wrapper entirely, and **all seven tests stay
  green** while the screen silently stops switching worlds. Nothing asserts the submit control
  renders `t.worlds.confirm`, nor that `submitting` disables it.
- **Fix**: assert `container.querySelector("form")` has the expected `action` and `method`, and
  scope `hiddenInput` to that form element.
- **Decision**: FOLLOW-UP (recorded in `follow-ups/review-fixes.md`)

### F2 — `shop-art-slots` tests the table, never the lookup

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `tests/shop-art-slots.test.ts` (all 4 tests) vs `src/components/child/ShopArt.tsx:72,73,80`
- **Detail**: The suite validates the `WORLD_SLOTS` data literal and never renders `ShopArt`.
  The expression it exists to protect — `WORLD_SLOTS[world.slug]?.[u.id] ?? DEFAULT_SLOTS[u.id]`
  — is untested: delete the `WORLD_SLOTS[world.slug]?.` prefix on all three lines and every
  assertion still passes. That is exactly the "not a broken render, a quietly wrong one" failure
  the file's own docstring claims to pin. Consequence is cosmetic (badges land on café
  coordinates over a bakery plate), which is why this is a WARNING and not worse.
- **Fix**: add one jsdom render of `<ShopArt world={piekarnia} purchased={["sign"]} />` asserting
  the badge's inline `left`/`top` equal the `piekarnia` entry rather than `DEFAULT_SLOTS`.
- **Decision**: FOLLOW-UP

### F3 — `nav-labels` enforces none of the `AppShell` invariants it documents

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: `tests/nav-labels.test.ts:21-23`
- **Detail**: The file never imports or renders `AppShell`; it tests `Object.values(t.nav.items)`
  in isolation. Drop the `worlds` entry from `AppShell.astro:63`, point its `href` at a route
  that does not exist (dead nav — a standing project rule), or switch the `hidden`/`lg:hidden`
  nav toggle to `opacity` (breaking the "exactly one copy of each name in the a11y tree" rule
  the docstring cites) and all three tests stay green. Separately `LIVE_E2E_STRINGS` is a
  hand-curated two-element list with no mechanism keeping it in sync with the e2e suite, so the
  substring-collision guard it powers will drift silently. The substring invariant itself is
  genuinely useful and does hold today (checked: "Światy" neither contains nor is contained by
  F4's "Rozwój świata").
- **Fix A ⭐ Recommended**: export the `items`/`tabs` arrays from `AppShell.astro` (or lift them
  into a small module) and derive `labels` from them, so the test breaks when an entry is
  dropped or renamed.
  - Strength: turns three string assertions into a real nav guard at no runtime cost.
  - Tradeoff: touches a file F4 also edits — land it after F4 merges.
  - Confidence: MED — the array is `as const` inside the Astro frontmatter, so lifting it is a
    small refactor, not a one-liner.
  - Blind spot: whether F4's landed shape of `items` differs.
- **Fix B**: leave the unit test as an i18n guard and cover the one-copy/aria-current rules in
  the `/10x-e2e` step's touch-viewport spec instead.
  - Strength: tests the DOM where the DOM actually exists; the plan already names this spec.
  - Tradeoff: slower feedback, and the dead-nav/href check remains uncovered.
  - Confidence: HIGH — the plan's Testing Strategy already schedules that spec.
  - Blind spot: none significant.
- **Decision**: FOLLOW-UP

### F4 — the route suite does not bite on removing the in-route ownership gate

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `tests/profiles-world.test.ts` vs `src/pages/api/profiles/world.ts:57-60`
- **Detail**: Re-verified here (see the meta-check above): deleting the `resolveActiveProfile`
  gate leaves **6/6 green**, because RLS blocks independently. The route docblock's claim that
  ownership is "proven TWICE" is accurate, but only *one* of the two proofs is covered by this
  suite. The other is covered a layer down by `tests/child-profiles-isolation.test.ts:94,115`
  (UPDATE isolation at the policy level), so no coverage hole exists in aggregate — but nothing
  would flag the loss of the defence-in-depth layer itself. **The suite does bite on a real
  loss of scoping** (break 2 → 2 red), so it is not a vacuous test.
- **Fix**: none required. If ever wanted: a unit test that stubs the client and asserts the
  route never calls the service when `resolveActiveProfile` returns null.
- **Decision**: ACCEPTED — recorded, not fixed

### F5 — a failure and a DB error are handled identically, and neither is logged (KR-1)

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/pages/api/profiles/world.ts:61-63`
- **Detail**: `if (!("ok" in result))` collapses `{ failure: "not-found" }` and
  `{ error: PostgrestError }` into one silent redirect, and nothing is logged. The identical
  *response* is correct (oracle avoidance, KR-1 by design); the merged *handling* is what costs
  observability — a persistent DB failure looks exactly like a routine ownership bounce and is
  invisible in production. `delete.ts:46-47` discriminates the two.
- **Fix**: keep the identical redirect, but branch on `"error" in result` to log server-side.
- **Decision**: FOLLOW-UP

### F6 — `learnHeading` leaves the a11y tree below `lg`, unlabeling the competency list

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: `src/components/child/WorldPicker.tsx:89-90`
- **Detail**: `t.worlds.learnHeading` is `hidden lg:block`, so below `lg` it is removed from the
  accessibility tree, not merely from the viewport, leaving the competency `<ul>` unlabeled for
  a screen reader. Every other breakpoint toggle in the file is correctly `display`-based and
  no text renders twice at any width — verified; this is the one gap.
- **Fix**: `sr-only lg:not-sr-only` on the heading, or an `aria-label` on the `<ul>`.
- **Decision**: FOLLOW-UP

### F7 — `buyUpgrade` is read-modify-write on the whole `shop_state` blob (pre-existing)

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/lib/services/child-profiles.ts:252-296`
- **Detail**: No optimistic concurrency (no `updated_at` guard, no RPC): two concurrent buys are
  last-write-wins and one purchase plus its meta entry can vanish. Not a money exploit —
  `wallet_balance`, `shop_state` and `skill_state` are all written from one snapshot, so state
  stays internally consistent and nothing is granted free. **Pre-existing**; `purchasedMeta`
  inherits the window rather than widening it, and KR-2 explicitly told Phase 4 not to fix it
  here. The spread order itself is correct: outer `...current.shop_state`, then the explicit
  `purchased` / `purchasedMeta` keys, with the inner `...(current.shop_state.purchasedMeta ?? {})`
  restoring prior entries — and `tests/upgrades-buy.test.ts:295-311` genuinely fails without it.
- **Fix**: if ever hardened, move the buy into a `security definer` RPC doing read + debit in one
  statement. Out of scope for F5.
- **Decision**: ACCEPTED — pre-existing, out of scope

### F8 — `purchasedMeta.at` duplicates data `shift_log` already records

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: `src/lib/services/child-profiles.ts:291` vs `:300-305`
- **Detail**: `at: new Date().toISOString()` duplicates the `created_at` of the `appendShiftLog`
  row written five lines later with the same `upgrade_purchased` id. Only `world` is genuinely
  new information. Storing it in the mutable jsonb blob places write-only, reader-less data
  inside F7's read-modify-write window, where nothing can ever validate it. A `world` column on
  `shift_log` would give the same attribution, append-only, outside the blob — and F4 is already
  opening a `shift_log` migration (D-10 anticipated exactly this).
- **Fix**: consider migrating attribution to `shift_log.world` when the per-world-purchases
  change (option B) is actually taken; `purchasedMeta` is optional and ignorable until then.
- **Decision**: FOLLOW-UP (design note only — do not change F5)

### F9 — `CreateProfileWizard`'s world tiles now diverge from the new screen's a11y posture

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/components/child/CreateProfileWizard.tsx:255-256`
- **Detail**: `WorldPicker` passes `alt=""` so the visible label is the sole accessible name —
  the correct choice, and the reason `tests/worlds-picker.test.tsx` can use whole-string
  `getByRole` name matching. The wizard still passes `alt={w.name}` **and** `label={w.name}` for
  the identical `SelectTile`s, producing the doubled name "Kawiarnia Kawiarnia" that
  `e2e/onboarding.spec.ts:74` works around with `.first()`. The new screen is right; the wizard
  is now the odd one out.
- **Fix**: pass `alt=""` in the wizard too and drop the `.first()` workaround. Outside this
  branch's scope.
- **Decision**: FOLLOW-UP

## Autonomous decisions

Taken by this review step under the run's agent contract — no human in the loop,
`AskUserQuestion` never called. The skill's post-report prompt and its per-finding triage
questions collapsed to "decide and record".

- **Verdict is NEEDS ATTENTION, but the branch is mergeable as-is.** Three warnings in one
  dimension exceed the skill's "≤2 minor warnings ⇒ APPROVED" bar, so the honest label is
  NEEDS ATTENTION. None of the three touches shipped behaviour: they are tests that would not
  catch a *future* regression of something that is correct *today*. Nothing here blocks a
  merge; the follow-ups are test-hardening. Rejected: calling it APPROVED (it would understate
  three real coverage gaps) and calling it REJECTED (there is no failing check and no
  security, data-safety or drift issue).
- **No source fix applied.** The run's brief authorises fixing a CRITICAL finding directly when
  small and unambiguous. There are **no CRITICAL findings**, so `src/` is untouched by this
  step and the branch's five phase commits stand exactly as implemented. Every actionable
  finding went to `follow-ups/review-fixes.md`.
- **The two deliberate breaks were re-run rather than accepted.** Both were reverted
  immediately (`git diff --stat` empty, suite re-confirmed 6/6) and neither appears in any
  commit. Test accounts are torn down in `afterAll`, so break 2's foreign write left no residue.
- **Manual Progress rows were not re-walked in a browser.** 2.5–2.9, 3.5–3.8, 4.7 and 5.5–5.6
  were satisfied by the implementer's throwaway Playwright harnesses (deleted, in no commit).
  This review re-verified the two that can be checked without a browser and matter most: the
  mockup reading (both PNGs opened here — F5's `lg`-only correction is right) and the
  carry-over promise (traced structurally through `upgrades.ts` and the single-column UPDATE).
  The remainder — pixel layout at 360/712/1440 — is accepted on the implementer's evidence
  plus a structural overflow read (`min-w-0` / `flex-1` / `truncate` throughout, no fixed width
  below `lg`). Starting a second dev server was declined: another agent shares this machine and
  `playwright.config.ts` hard-codes `localhost:4321` with `reuseExistingServer`, so a stray
  server would silently test the wrong tree.
- **`playwright.config.ts` has no `E2E_PORT` support** on this branch — the handoff's advice to
  use one does not apply here. Port 4321 was confirmed free (`lsof`) immediately before the run
  and Playwright started and tore down its own server.
