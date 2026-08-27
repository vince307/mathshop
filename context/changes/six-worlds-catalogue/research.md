---
date: 2026-08-27T14:46:08Z
researcher: Claude (autonomous run `2026-08-27-world-economy`, step `/10x-research`, feature F2)
git_commit: 91754efe5bfea9fb26ccc5e54a117faa6bc9fb51
branch: matmaverse-v2
repository: 10xDevs
topic: "W1 `six-worlds-catalogue` — what actually changes when `WORLDS` grows from four to six"
tags: [research, codebase, worlds, shop-art, i18n, decorations, world-picker]
status: complete
last_updated: 2026-08-27
last_updated_by: Claude (F2 research step)
---

# Research: `six-worlds-catalogue` — what actually changes when `WORLDS` grows from four to six

**Date**: 2026-08-27T14:46:08Z
**Researcher**: Claude — autonomous run `2026-08-27-world-economy`, step `/10x-research`, feature **F2**
**Git Commit**: `91754efe5bfea9fb26ccc5e54a117faa6bc9fb51`
**Branch**: `matmaverse-v2` (main checkout — docs lane; no branch cut, no source touched)
**Repository**: `10xDevs`

---

## Research Question

Backlog **W1** (`context/foundation/backlog.md` § `## Ready`) asks for two new worlds —
`pracownia` / *Pracownia* and `laboratorium` / *Laboratorium* — on already-committed
art, with no migration, each carrying its own decoration set (D-11).

`/10x-new`'s intake (`change.md`) named four surfaces the backlog entry does not:
a guaranteed regression in `tests/shop-art-slots.test.tsx`, a key-namespace collision
on `t.worlds`, world names living in `src/data/worlds.ts` rather than `src/i18n/pl.ts`,
and two tile grids that reflow at six. This step answers, against source:

1. **The blast radius** — every symbol that reads `WORLDS`, and which of them break,
   which reflow, and which are already six-proof.
2. **The `WORLD_SLOTS` regression** — exactly what two new slot tables must satisfy,
   with concrete coordinates derived from the two committed plates, and **who owns**
   the fill-in when F1 grows `UPGRADE_IDS`.
3. **The copy-fallback question (contract decision 3)** — what "ship on the fallback"
   really costs versus "write the vocabulary", measured in call sites, not in strings.
4. **The decoration question (contract decision 4)** — what W1 can decide on its own
   given F1 owns `src/data/decorations.ts`.
5. **The grids** — what the mockups actually draw at six, verified against the PNGs.

## Summary

**W1 is smaller than its intake feared and its ownership is cleaner than expected.**

- **Nine of the eleven `WORLDS` consumers are already six-proof.** `WorldPicker`,
  `CreateProfileWizard`, both profile API routes' zod `refine`, `worldForTheme`,
  `getWorld`, `WORLD_SLUGS`, `tests/data-lookups.test.ts`, `tests/worlds-picker.test.tsx`
  and `e2e/onboarding.spec.ts` all derive from `WORLDS` and need **no edit**. Two data
  edits and one component-comment rewrite are the whole core of the change.
- **Exactly one test goes red, and it is a data-completeness assertion, not a design
  problem.** `tests/shop-art-slots.test.tsx`, case *"gives every non-default world its
  own slot table"*, iterates `WORLD_SLUGS` and demands a `WORLD_SLOTS` entry per
  non-default slug. Two new slugs ⇒ two new tables. Its sibling case iterates
  `UPGRADE_IDS` across **every** table, which is the F1 coupling.
- **The `WORLD_SLOTS` ownership question has a clean answer that neither feature has to
  negotiate**, because the run is a *serial stack*: W1 branches off F1, so by the time
  W1 writes its two tables `UPGRADE_IDS` is already final. **F1 backfills the three
  existing tables with its new ids; W1 writes two complete new tables.** Nothing is
  shared, nothing is ordered after the fact.
- **"Ship on the copy fallback" (A1) costs W1 literally zero lines**, because
  `upgradeCopy(id)` in `src/i18n/index.ts` *is already* the neutral fallback. The
  design's `t.worlds[slug].upgrades[id] ?? t.upgrades[id]` describes a **future**
  extension. W1's only obligation is not to foreclose it. Adopting it instead is not a
  48-string edit — it is a **signature change threaded through 10 call sites in 5 files**,
  two of which (`ShiftResults.tsx`, `RecentActivity.astro`) have **no world in scope at
  all** and would need a new prop. That is the finding that settles A1 on cost, not taste.
- **The `t.worlds` collision is real but is not W1's to resolve.** `t.worlds` is the
  world-selection *screen* namespace, and its own header says the competency trio is
  "world-INDEPENDENT by design". If W1 writes no vocabulary, W1 never touches it.
- **Both mockups were opened and both confirm the reflow** — 3×2 web, 2×3 mobile. The
  shipped `grid-cols-2` **already is** the mobile mockup at six; only `lg:grid-cols-3`
  is missing, and `WorldPicker`'s own header comment names that exact class as the fix.
- **New, not in the intake: the *mobile* mockup labels world six plain "Laboratorium"** —
  the settled name, not the web mockup's "Laboratorium wynalazków". A3 is therefore
  half-confirmed by a mockup rather than merely a deviation from one.
- **`src/i18n/pl.ts` may not need to change at all under A1.** The only candidate edit
  is `t.marketing.worlds`, a hand-maintained four-entry marketing list that is *not*
  derived from `WORLDS` and is rendered by two `.astro` surfaces — one of which
  (`AuthShell.astro`) hardcodes `grid-cols-4` and goes ragged at six. That makes growing
  it a deliberate product+layout call, not a mechanical sync.

The single largest carried risk is **not** in W1's own surface: it is the coupling to F1
on `UPGRADE_IDS`, which the serial stack neutralises **only if W1 actually branches off
F1's branch** rather than off `matmaverse-v2`.

---

## Detailed Findings

### 1. The `WORLDS` blast radius — eleven consumers, two edits

`src/data/worlds.ts` exports `World`, `DEFAULT_WORLD`, `DEFAULT_THEME`, `WORLDS`,
`WORLD_SLUGS`, `getWorld`, `worldForTheme`. Every consumer, and its verdict:

| Consumer (file · symbol) | Reads | Verdict at six |
| --- | --- | --- |
| `src/components/child/WorldPicker.tsx` · default export | `WORLDS.map` | **Six-proof.** One tile per entry, keyed by slug. Needs a **class + comment** change only (§5). |
| `src/components/child/CreateProfileWizard.tsx` · default export | `WORLDS.map`, `WORLDS.find` | **Six-proof** logically; its grid goes ragged (§5). |
| `src/pages/api/profiles/create.ts` · `theme` in the zod schema | `WORLD_SLUGS` via `.refine` | **Six-proof.** The closed set widens automatically. |
| `src/pages/api/profiles/world.ts` · `theme` in the zod schema | `WORLD_SLUGS` via `.refine` | **Six-proof.** Its own header explains why `refine` was chosen over `z.enum` — the widened `[string, ...string[]]` type. |
| `src/lib/services/child-profiles.ts` · `buyUpgrade` (`purchasedMeta` write) | `worldForTheme` | **Six-proof.** Records whatever slug the profile carries. |
| `src/components/child/ShopArt.tsx` · `WORLD_SLOTS`, `ShopArt` | `world.slug`, `world.image` | **Breaks a test** — §2. The component itself is six-proof (silent fallback). |
| `src/pages/app/{start,growth,task,upgrades}.astro` | `worldForTheme(profile.theme)` | **Six-proof.** Total function, `?? DEFAULT_WORLD`. |
| `tests/data-lookups.test.ts` · `worldForTheme` / `WORLD_SLUGS` describes | iterates `WORLDS` | **Six-proof** — `for (const w of WORLDS)`, `WORLD_SLUGS).toEqual(WORLDS.map(...))`. |
| `tests/worlds-picker.test.tsx` · *"renders one selectable tile per WORLDS entry"* | iterates `WORLDS`, asserts `toHaveLength(WORLDS.length)` | **Six-proof.** Deliberately written against the array, not a literal 4. |
| `e2e/onboarding.spec.ts` (wizard walk) | `WORLDS[0].name` + `.first()` | **Six-proof.** New entries append; index 0 stays `Kawiarnia`. |
| `tests/shop-art-slots.test.tsx` | `WORLD_SLUGS`, `DEFAULT_THEME`, `UPGRADE_IDS` | **RED** — §2. |

**No test pins the literal count four**, and no test pins a world-name literal that a new
name could shadow. The archived F5 plan records the same property for the slug
(`context/archive/2026-08-22-world-selection-screen/plan.md`, §D-3): *"no test pins the
literal string `sklep-ksiegarnia`, so the type system will not catch a rename — the live
rows will."* The same holds for additions, in the safe direction.

**No migration, confirmed independently.** `child_profiles.theme` is declared
`text not null default 'default'` in
`supabase/migrations/20260609120000_child_profiles_isolation.sql`; no `check (` clause in
any of the twelve migration files references it. Validation is app-layer only, in the two
zod `refine`s above. Adding a world widens a closed set in code and nothing else.

**No new nav entry.** `t.nav.items.worlds` ("Światy") and the `/app/worlds` route already
ship; `e2e/growth.spec.ts`'s *Risk E2E-F4-2* already asserts six nav entries fit at 712px.
W1 adds **no** nav surface, so the no-dead-navigation and tab-arithmetic rules are inert here.

### 2. The `WORLD_SLOTS` regression — the one guaranteed red

`tests/shop-art-slots.test.tsx` holds four data assertions plus one render assertion. Two
of the four bite on W1:

- ***"gives every non-default world its own slot table"*** — iterates `WORLD_SLUGS`,
  `continue`s on `DEFAULT_THEME`, and requires `WORLD_SLOTS[slug]` to be defined.
  `WORLD_SLOTS` in `src/components/child/ShopArt.tsx` has exactly three keys today
  (`piekarnia`, `galaktyczna-baza`, `sklep-ksiegarnia`). **Two new slugs ⇒ red.**
- ***"covers all six upgrade ids in every table"*** — iterates
  `Object.entries(WORLD_SLOTS)` × `UPGRADE_IDS`. This is the **F1 coupling**: F1 adds two
  margin entries to the catalogue, so `UPGRADE_IDS` grows to eight and *every* table —
  the three existing ones as well as W1's two — needs the two new ids.

The other two (`kawiarnia` absent; exactly one of left/right and one of top/bottom as a
percent in 0–100) are the **shape contract** W1's new tables must satisfy.

**Ownership recommendation — and why it needs no negotiation.** The run is a *serial
stack*: W1's branch is cut from F1's, not from `matmaverse-v2`. Therefore:

- **F1 backfills the three existing tables** with the two ids it creates. It is the only
  feature that knows what they are, and it is the feature whose merge would otherwise
  leave the suite red on its own.
- **W1 writes two complete new tables** against whatever `UPGRADE_IDS` reads at its
  branch point — six ids if F1 slipped, eight if F1 landed. Either way the test is
  self-describing, so W1 cannot get the count wrong by accident.

This resolves the `change.md` item *"Whether that fill-in belongs to F1 or W1 is a
contention-sweep call"* without either feature editing the other's work. It belongs in
`context/runs/2026-08-27-world-economy/ownership.md` as: **`WORLD_SLOTS` — F1 owns the
existing three tables, W1 owns the two new ones; the file is append-per-key.**

**The test the render case protects, and a caution.** The file's own header records that
the four data assertions *cannot* see whether `ShopArt` still reads the table — dropping
the `WORLD_SLOTS[world.slug]?.` prefix leaves all four green — which is why the jsdom
render case at the bottom pins the inline `style`. That is an L-004 meta-check already
banked in the repo. **W1's deliberate break must therefore be the data break** (delete
one new table's `sign` entry, or the whole table, and watch the two iterating cases go
red), **not** a prefix removal, which would prove nothing about W1's contribution.

#### Concrete slot coordinates for the two new plates

Both committed plates were opened and measured for this step (converted to PNG via
`sharp`; the `.webp` files are 896×718 with alpha, verified with `sips`). The badge is
`size-10` (40px) in the slotted layer — roughly 4.5% of the art box's width — and the
percent is the badge's own edge offset.

**`world-pracownia.webp`** — a craft desk. Content spans roughly `x ∈ [12%, 90%]`,
`y ∈ [8%, 90%]`. Because it was `contain`-fitted from a 1.333 source into the 1.248
target, it carries a **transparent letterbox band of ≈3.2% at top and bottom**, which is
free margin. Focal mass: the fabric-roll shelf bottom-left, the pegboard and lamp
top-centre, the sewing machine centre-right, the mannequin far right, coins and a stool
bottom-left-of-centre, a basket and plant bottom-right.

```
pracownia: {
  sign:      { left:  "5%", top:    "4%"  },  // clear band above the roll shelf
  shelf:     { left:  "3%", top:    "34%" },  // left of the fabric shelf (starts x≈12%)
  register:  { right: "3%", top:    "22%" },  // above the mannequin's head (y≈24%)
  slot:      { left:  "45%", bottom: "3%" },  // empty floor under the desk
  storage:   { left:  "3%", bottom: "12%" },  // left of the coin stack (x≈18–32%)
  customers: { right: "4%", bottom: "6%"  },  // below the corner plant (pot ends y≈88%)
}
```

**`world-laboratorium.webp`** — an invention bench. Content spans roughly
`x ∈ [7%, 90%]`, `y ∈ [8%, 93%]`; `cover`-fitted from a near-identical aspect, so it
carries **no letterbox**. The largest clear region is the **top-left quadrant**
(`x < 20%`, `y < 40%`). Focal mass: blueprint board and gears top-centre-left, the glowing
bulb centre, an orbit toy top-right, a plant far left at mid-height, a stool bottom-centre,
a coin stack bottom-right (`x ≈ 72–90%`, `y ≈ 72–95%`).

```
laboratorium: {
  sign:      { left:  "4%", top:    "6%"  },  // the big empty top-left quadrant
  shelf:     { left:  "4%", top:    "26%" },  // left of the orange flask (starts x≈17%)
  register:  { right: "3%", top:    "12%" },  // right of the orbit toy (ends x≈85%)
  slot:      { left:  "45%", bottom: "2%" },  // under the stool legs (end y≈90%)
  storage:   { left:  "3%", bottom: "14%" },  // left of / below the plant pot
  customers: { right: "3%", bottom: "4%"  },  // right edge past the coin stack
}
```

**These are proposals, and they are an extrapolation** — there is no mockup showing
upgrade badges on either plate, and the existing three tables were tuned by eye. They
satisfy the four-assertion shape contract by construction. A planner should treat them as
a starting point and say so; an implementer should eyeball `/app/start` and `/app/growth`
with all upgrades owned before committing, exactly as
`context/archive/2026-08-22-world-selection-screen/plan.md` Phase 5 required.

**If F1 lands two margin entries**, both new tables need those ids too, in the same
whitespace budget. The clearest remaining margin in both plates is the **top-centre** band
(pracownia `y ≈ 4%`, `x ≈ 30–40%`; laboratorium `y ≈ 4%`, `x ≈ 30–45%`) and the
**bottom-centre-left** floor.

### 3. The copy fallback — what A1 actually costs, measured

**`upgradeCopy(id)` in `src/i18n/index.ts` already IS the neutral fallback.** Its body:

```ts
export function upgradeCopy(id: string): { name: string; desc: string } {
  return (t.upgrades as Record<string, { name: string; desc: string }>)[id] ?? { name: id, desc: "" };
}
```

It is world-blind by construction and guarded against an unknown id. `stageCopy` is its
twin. `tests/i18n-helpers.test.ts` pins both, including the ghost-id fallback.

**Consequence for contract decision 3.** "W1 ships on the fallback" means **W1 writes no
i18n key and no copy-resolution code at all.** The design's
`t.worlds[slug].upgrades[id] ?? t.upgrades[id]` is a **future** extension whose only claim
on W1 is *do not foreclose it* — and nothing in adding two `World` records does.

**What the alternative actually costs.** `upgradeCopy` is called at **10 sites in 5 files**:

| File · symbol | Calls | World in scope? |
| --- | --- | --- |
| `src/components/child/UpgradeShop.tsx` · `UpgradeShop` | 6 | **Yes** — takes a `world: World` prop |
| `src/pages/app/growth.astro` (frontmatter + template) | 3 | **Yes** — `const world = worldForTheme(profile.theme)` |
| `src/components/child/ShiftResults.tsx` · `ShiftResults` | 1 | **NO** — props are `earned`, `stars`, `leveledUp`, `canUpgrade`, `nextInfo` |
| `src/components/child/RecentActivity.astro` | 1 | **NO** — presentation-only; everything arrives resolved from `start.astro` |

So adopting per-world vocabulary is a **signature change plus two new props threaded from
two more call sites** (`ShiftScreen` → `ShiftResults`, `start.astro` → `RecentActivity`),
on top of the 6 × 8 strings. `RecentActivity.astro`'s header makes a point of the
component deriving nothing itself — threading a world through it is against its stated
design, not merely more code.

**This is the substantive case for A1 that the intake reached on content grounds.** The
intake was right for the right reason (48 strings of unsourced child-facing Polish is
invented product content); the cost evidence above makes it also the cheaper and less
invasive choice, and — decisively — the change is **purely additive later**, because the
fallback is where every id already resolves.

**The `t.worlds` collision, and why W1 need not resolve it.** `t.worlds` in
`src/i18n/pl.ts` is the world-selection *screen* namespace: `heading`, `subtitle`,
`sameSkills`, `carryOver`, `learnHeading`, `learn.{math,trade,decisions}`, `confirm`,
`submitting` — consumed by `WorldPicker` and `src/pages/app/worlds.astro`. Its header
comment states the competency trio is *"world-INDEPENDENT by design — that is the point —
so it is deliberately not keyed by slug."* Nesting `t.worlds.pracownia` beside
`t.worlds.heading` would put two different kinds of thing in one record. **Under A1 W1
writes nothing under `t.worlds`, so the collision is deferred, not inherited.** When
vocabulary is eventually written, the non-colliding homes are `t.worlds.bySlug[slug]` or a
sibling namespace (`t.worldUpgrades[slug]`); recording that is a `## Known risks` note, not
a W1 edit.

### 4. Decorations — what W1 can and cannot decide

Verified: **`src/data/decorations.ts` does not exist**, `Decoration` is not a type
anywhere in `src/`, `tests/` or `e2e/`, and `ShopState` in `src/types.ts` today is:

```ts
export interface ShopState {
  purchased: string[];
  purchasedMeta?: Record<string, { world: string; at: string }>;
}
```

`purchasedMeta?` is exactly the optional-sibling precedent the spec cites for
`decorations?: string[]` — its doc-comment says so in as many words ("Optional, so every
legacy `{}` and `{ purchased: [] }` row stays valid and `readPurchased` is untouched").
The no-migration claim is therefore structurally sound.

**`ShopArt` cannot render an art-less entry today.** Both its layers do
`<img src={u.art}>`, and `Upgrade.art` is a **required** `string`. Rendering a
decoration through lucide + design tokens (the contract's settled decision, following the
`ART DEVIATION` block at the head of `src/data/stages.ts`) needs a **new branch in
`ShopArt` plus a new prop threaded from three render sites**: `src/pages/app/start.astro`,
`src/pages/app/growth.astro`, and `UpgradeShop.tsx`. That is **F1's work** — F1 owns
`ShopArt`'s structural change; W1 owns only the `WORLD_SLOTS` data literal, which is the
same split the archived F4/F5 run used
(`context/archive/2026-08-22-world-selection-screen/plan-brief.md`: *"F4 owns it; F5
touches only the `WORLD_SLOTS` data literal, in a droppable phase"*).

**What that leaves W1 for contract decision 4.** W1 supplies **the two new worlds' entries
in F1's decoration list**, at whatever count and price curve F1 sets. W1 does not create
the module, the type, the persistence key, the buy path or the renderer. So A2's shape
("inherit N from F1; fall back to 3 if F1 leaves it unset") is the right shape, and the
research adds one sharpening: **if F1 is dropped from the run, W1 must not create
`src/data/decorations.ts` on its own** — an art-less, effect-free list with no sink, no
`shop_state.decorations` key and no buy route is dead code, and W1 would be inventing the
D-13 pacing model it was told not to invent. In that case W1 ships worlds-only and records
the decoration half as explicitly deferred.

### 5. The two grids, and the marketing strip

**Both mockups were opened for this step**, from `assets/` (present in the main checkout;
absent from the code lane's worktrees):

- `assets/matmaverse-ui-v2-web/01-world-selection-web.png` (1586×992) — **3 columns × 2
  rows**, a sticky preview + competency rail on the right, and the confirm CTA under the
  rail. Labels: *Piekarnia · Kawiarnia · Galaktyczna baza / Sklep kolekcjonera · Salon
  kreatywny · **Laboratorium wynalazków***.
- `assets/matmaverse-ui-v2-mobile/01-world-selection-mobile.png` (853×1844) — **2 columns
  × 3 rows**, no preview image, competencies collapsed to a one-row icon strip above the
  CTA. Labels: same, except world six is plain **"Laboratorium"**.

**Finding not in the intake — the mobile mockup uses the settled name.** `Laboratorium`
is what the mobile mockup itself draws. A3 ("keep Pracownia / Laboratorium") is therefore
not a deviation from the mockups on that half; it is a reconciliation *between* two
mockups, resolved toward the shorter label that the committed filename stem and the
`child_profiles.theme` value already carry. Only *Pracownia* vs *Salon kreatywny* remains
a genuine deviation, and it is the same class of reconciliation `src/data/worlds.ts`'s
header already records for `sklep-ksiegarnia` vs "Sklep kolekcjonera".

**`WorldPicker` — one class, one comment.** Today:

```
className="mx-auto grid max-w-2xl grid-cols-2 gap-3 sm:gap-4 lg:mx-0 lg:max-w-none"
```

`grid-cols-2` at six **is already the mobile mockup exactly** (2×3). Adding
`lg:grid-cols-3` produces the web mockup exactly (3×2). The component's own header names
that class as the planned fix and states a premise that this change falsifies:

> *"Only FOUR worlds exist in `WORLDS`; the mockup draws six. The two missing ones have no
> slug and no committed art, so rendering them would be invented data. `grid-cols-2` at
> every breakpoint is the honest reflow — a clean 2×2 at four, and it stays clean at six
> when the art lands (swap in `lg:grid-cols-3` then)."*

**Both sentences must be rewritten, not only the class** — leaving "the two missing ones
have no slug and no committed art" in place after shipping them is a comment that lies.

**`CreateProfileWizard` — a genuinely new call.** Its interest grid is
`grid-cols-2 sm:grid-cols-4 lg:grid-cols-2`, which at six gives a ragged **4 + 2** row in
the `sm`…`lg` band. The `lg:grid-cols-2` reflects the wizard being a narrow card at `lg`.
The minimal honest fix is `sm:grid-cols-3` (3×2 in the band, 2×3 below and above), which
matches both world-selection mockups' shapes and never leaves an orphan row. This grid has
its own mockup (`05` in the auth-v2 set) which was **not** opened for this step — the
planner should say the class is chosen by the no-orphan-row rule, not by mockup parity.

**`SelectTile`'s crop, and a lucky coincidence worth recording.** `SelectTile` renders
`<img className="size-full object-cover">` inside an `aspect-[4/3]` box. The plates are
896×718 ≈ 1.248 against a 1.333 box, so `object-cover` trims ≈3.2% off the top and bottom.
For `world-pracownia.webp` that is **exactly** the transparent letterbox `contain` added
(§2), so the tile shows the un-letterboxed illustration with no content loss. For
`world-laboratorium.webp` (`cover`-fitted, no band) the 3.2% trim clips a sliver of empty
canvas above the orbit toy and below the coin stack. **Neither plate loses focal content
in the tile.** No per-plate compensation is needed — this was a real risk and it does not
materialise.

**`t.marketing.worlds` — a product call, plus a hidden layout break.** It is a
hand-maintained four-entry `{ name, image }` list in `src/i18n/pl.ts`, **not** derived from
`WORLDS`, rendered by two surfaces:

- `src/components/Welcome.astro` — `grid grid-cols-2 gap-3 sm:gap-4`. **Six-proof**: 3 rows
  of 2, clean.
- `src/components/auth/AuthShell.astro` — `mt-6 hidden grid-cols-4 gap-3 lg:grid`.
  **Ragged at six** (4 + 2), and it is desktop-only, so a mobile smoke test would never
  see it.

No test or e2e spec references `t.marketing` at all, so **growing this list breaks nothing
and is checked by nothing** — the worst combination. Three defensible options: leave it at
four (a marketing sample, not a catalogue); grow to six and change `AuthShell`'s
`grid-cols-4` → `grid-cols-3`; or derive it from `WORLDS` and delete the duplication. The
planner must choose one **explicitly**; silently appending two entries ships a ragged
signed-out auth panel that nothing will catch.

---

## Code References

Anchored on symbols; line hints are of-the-moment (L-006).

- `src/data/worlds.ts` · `WORLDS`, `DEFAULT_WORLD`, `WORLD_SLUGS`, `worldForTheme` — the
  two-record edit; the header's `sklep-ksiegarnia` reconciliation is the precedent for A3.
- `src/components/child/ShopArt.tsx` · `WORLD_SLOTS` — the exported data literal that gains
  two tables; `DEFAULT_SLOTS` and the `ShopArt` function are **not** W1's to restructure.
- `tests/shop-art-slots.test.tsx` · *"gives every non-default world its own slot table"* and
  *"covers all six upgrade ids in every table"* — the two cases that go red.
- `src/components/child/WorldPicker.tsx` · the tile-grid `<div>` holding `WORLDS.map` (the
  `grid-cols-2` class) and the module header's "Only FOUR worlds exist" paragraph.
- `src/components/child/CreateProfileWizard.tsx` · the interest-picker `<div>` under
  `t.profileWizard.interestLabel` (`grid-cols-2 sm:grid-cols-4 lg:grid-cols-2`).
- `src/components/child/SelectTile.tsx` · `SelectTile` — `aspect-[4/3]` + `object-cover`.
- `src/i18n/index.ts` · `upgradeCopy` — the existing neutral fallback; `stageCopy` its twin.
- `src/i18n/pl.ts` · `t.worlds` (screen copy, header says "not keyed by slug"),
  `t.upgrades` (id-keyed catalogue copy), `t.marketing.worlds` (the hand-maintained list),
  `t.nav.items.worlds` (already ships).
- `src/components/auth/AuthShell.astro` · the world-card block (`hidden grid-cols-4 … lg:grid`).
- `src/components/Welcome.astro` · the world-card block (`grid grid-cols-2`).
- `src/types.ts` · `ShopState` and its `purchasedMeta?` doc-comment — the optional-sibling
  precedent for `decorations?: string[]`.
- `src/data/stages.ts` · the `ART DEVIATION FROM THE MOCKUP` header block — the exact
  template for how the decoration module records an art-absence deviation.
- `src/pages/api/profiles/create.ts` and `src/pages/api/profiles/world.ts` · the `theme`
  zod `refine` against `WORLD_SLUGS`; `world.ts`'s header explains the `refine`-not-`enum`
  choice.
- `supabase/migrations/20260609120000_child_profiles_isolation.sql` · the `theme` column
  (`text not null default 'default'`, no CHECK) — the no-migration proof.
- `public/illustrations/slice-map.md` § *"World cards, second batch (W1) — 2026-08-27"* —
  provenance and the `contain`/`cover` reasoning for the two plates.
- `e2e/growth.spec.ts` · *"the next-upgrade card stays a finished thought…" (Risk E2E-F4-3)*
  — F1's regression, listed here only so W1 does not re-seed it a second time.

## Architecture Insights

1. **Adding a world is a data edit because every consumer derives.** That is not an
   accident — the archived F5 change deliberately built `WorldPicker` and
   `CreateProfileWizard` to map `WORLDS` rather than hardcode tiles, and wrote
   `tests/worlds-picker.test.tsx` against `WORLDS.length` rather than `4`. W1 is the
   payoff for that discipline. The **one** place that did not derive —
   `t.marketing.worlds` — is precisely the one place that breaks silently.
2. **The two fallbacks in this codebase are load-bearing and already built.**
   `worldForTheme` is total (unknown/`'default'`/`null` → `DEFAULT_WORLD`) and
   `upgradeCopy`/`stageCopy` are guarded (unknown id → the raw id). Together they mean a
   world can exist with no bespoke copy and no bespoke art path and still render. That is
   what makes A1 free rather than merely cheap.
3. **`WORLD_SLOTS`'s silent fallback is the recurring hazard.** The test file's own header
   says it: a missing table does not crash, it renders a badge at coordinates tuned for a
   different plate. Every guard in that file exists because the failure is invisible. A
   planner must not "simplify" the two iterating assertions into a fixed list.
4. **Art-absence has an established, documented pattern in this repo** —
   `src/data/stages.ts`'s `ART DEVIATION` header: no `art` field, lucide + design tokens,
   and the upgrade path spelled out in the module header including the exact filename
   convention and the `slice-map.md` obligation. The contract's settled decision for
   decorations is that pattern applied again, which is why it is a *deviation*, not a
   workaround.
5. **Copy that would differ per world is deliberately absent from the product's promises.**
   `t.worlds.sameSkills` ("Każdy świat uczy tych samych umiejętności") and
   `t.worlds.carryOver` ("Twój sklep i kupione ulepszenia przenoszą się…") are rendered by
   `WorldPicker` and are honest **only** because nothing in the economy reads `theme`.
   D-11's per-world decorations are the first thing a world will own outright — and they
   remain honest because a decoration has no economic effect. W1 must not rewrite either
   string.
6. **Polish declension shapes the copy architecture.** `t.growth`'s header and
   `t.upgradeShop` both note that world names are stored nominative-only, so headings are
   world-neutral with the world name as a separate subtitle rather than inflected into a
   sentence. Two more nominative names change nothing — but any new copy W1 were tempted to
   write would inherit that constraint.

## Historical Context (from prior changes)

- `context/archive/2026-08-22-world-selection-screen/plan.md` § **D-3** — the decision that
  produced today's four-world grid: *"ship the four that exist. Do not block… When worlds
  5–6 land, `lg:grid-cols-3` restores the mockup's web layout in one class."* Its stated
  **reversal condition** is *"the maintainer supplies art + names for worlds 5 and 6"* —
  which the backlog's resolved MANUAL PRECONDITION did on 2026-08-27. **W1 is D-3's
  reversal being executed, not a new decision.**
- Same file, § D-3's tail — the rename caution: the **slug** must never change, because it
  is stored in live rows and the committed art resolves from it (`world-<slug>.webp`), and
  no test pins it. This is the load-bearing half of A3.
- `context/archive/2026-08-22-world-selection-screen/plan-brief.md` — the F4/F5 ownership
  split on `ShopArt`: *"F4 owns it; F5 touches only the `WORLD_SLOTS` data literal, in a
  droppable phase."* The same split is the right one for F1/W1 (§4).
- Same file, Phase 5 (*"Per-world overlay coordinates (option D) — DROPPABLE"*) — the
  original recipe for filling `WORLD_SLOTS`, including the verification step *"With all
  six upgrades owned, `/app/start` and `/app/upgrades` place every overlay sensibly"* and
  the three assertions that became `tests/shop-art-slots.test.tsx`.
- `context/archive/2026-08-22-world-progression-stages/` — the change that established
  `src/data/stages.ts`'s `ART DEVIATION` header and the lucide-plus-tokens rendering that
  the decoration decision now follows.
- `context/changes/world-economy-profit-rule/change.md` and `handoff.md` (F1, sibling, at
  identity stage) — records that `shopRunningCost`, `shopEffects`, `Decoration`,
  `quantityMargin`, `accuracyMargin` and `requiredUpgrade` **do not exist yet**, that
  `Upgrade.art` being required blocks an art-less entry, and that F1 carries the
  `e2e/growth.spec.ts` re-seed. Consistent with everything found here.

## Related Research

- `context/archive/2026-08-22-world-selection-screen/research.md` — the world-selection
  surface, `theme` mutability, and the `purchasedMeta` attribution rationale.
- `context/archive/2026-08-22-world-progression-stages/research.md` — `ShopArt`'s
  composition seam and the per-stage art upgrade path.
- `context/archive/2026-06-30-visible-shop-growth/research.md` — the original S-06/S-13
  shop-art model that `WORLD_SLOTS` extends.

## Open Questions

Each is a decision a plan must make; §6 records the ones this step decided.

1. **Does `t.marketing.worlds` grow to six?** Product call with a layout consequence
   (`AuthShell.astro`'s `grid-cols-4`). Nothing tests it. Recommended default: **leave it
   at four** and add a comment saying it is a marketing sample, not a mirror of `WORLDS` —
   the smallest change that cannot ship a ragged panel. Deriving it from `WORLDS` is the
   better long-term answer and a clean follow-up.
2. **`CreateProfileWizard`'s `sm` breakpoint** — `sm:grid-cols-3` is proposed from the
   no-orphan-row rule; the `05` auth-v2 mockup was not opened for this step and would
   settle it. Only the maintainer's checkout can see it.
3. **Whether F1's two margin entries exist at W1's branch point.** Determines whether W1's
   two tables carry six ids or eight. Self-describing at implementation time; no decision
   needed in advance.
4. **The slot coordinates themselves** are proposals from plate geometry, not from a
   mockup. They need an eyeball pass on `/app/start` with all upgrades owned.
5. **Whether the mockups' tile icons matter.** Both world-selection mockups draw a small
   glyph beside each tile label; `SelectTile` renders image + label only. This is a
   pre-existing divergence across all four shipped worlds, **not** W1's to fix — recorded
   so a reviewer does not read it as new drift.

---

## Autonomous decisions

Made in place of the skill's `AskUserQuestion` scope-clarification step and any other
prompt, per the run's agent contract, hard rule 1. Each carries its reversal condition.

### R1 — Scope, depth and focus were chosen from `change.md` and backlog W1, not asked

**Chosen:** *scope* = W1's own surface plus the F1 boundary, excluding F1's internals
(profit rule, invariant sweeps, pacing model, decoration module design); *depth* =
detailed, because four of the five research questions are "does this specific symbol
break"; *focus* = integration points and the code's own recorded history, over
architecture narrative.

**Rejected:** a surface overview (would have missed the `upgradeCopy` call-site count,
which is the finding that settles A1 on cost); and a scope covering F1's decoration
mechanics (F1's own research step owns that, and duplicating it invites two features to
design the same module).

**Why:** `change.md` had already converted the backlog entry into four named unknowns.
Research whose question is *"is this claim true of this symbol"* wants breadth of
verification, not depth of theory.

**What would change the answer:** if F1's research lands first and finds the decoration
module needs a per-world shape W1 must satisfy, W1's scope grows to include that shape.

### R2 — No sub-agents were spawned, because none are available in this context

**Chosen:** perform every read directly, in this context, and finish the document.

**Rejected:** waiting for sub-agents. `ToolSearch` for `Task` / `Agent` / `Explore`
returned **no matching deferred tools**; this step is itself a subagent and cannot spawn
subagents. `ListAgents` shows only unrelated peer sessions.

**Why:** the step brief warns that in the source run a research step reported "waiting for
the last agent" and died having written nothing. Announcing a wait for agents that cannot
exist is exactly that failure. The skill's parallel-agent instruction is an efficiency
mechanism, not a correctness requirement — the deliverable is `research.md`.

**What would change the answer:** a context where `Task` is available; the same
decomposition (blast radius · slot tables · i18n · decorations · history) would map onto
five agents cleanly.

### R3 — `WORLD_SLOTS` ownership: F1 backfills the three existing tables, W1 writes two new ones

**Chosen:** record this as the recommendation for
`context/runs/2026-08-27-world-economy/ownership.md`, rather than leaving it open as
`change.md` did.

**Rejected:** W1 filling all five tables (it would edit F1's rows and needs F1's ids
anyway); F1 filling all five (it would author coordinates for plates whose worlds do not
exist on its branch).

**Why:** the stack is serial — W1 branches from F1 — so W1 sees final `UPGRADE_IDS` and
neither feature has to guess. The split matches the archived F4/F5 precedent exactly, and
it keeps the file append-per-key, which is what makes it safe.

**What would change the answer:** the run splitting E1 and W1 into concurrent worktrees.
Then `WORLD_SLOTS` becomes a contended file and one feature must own the whole literal.

### R4 — A1 is affirmed, and strengthened from a content argument to a cost argument

**Chosen:** W1 writes **no** per-world catalogue vocabulary and **no** copy-resolution
code, because `upgradeCopy(id)` already is the fallback.

**Rejected:** W1 building the `t.worlds[slug].upgrades[id] ?? t.upgrades[id]` resolution
path so it "exists" for later. Building an extension point with zero consumers means
changing a signature at 10 call sites and threading a world prop into two components that
deliberately derive nothing — all to ship an unused branch.

**Why:** the fallback is not a thing to be built; it is the current behaviour. W1's
obligation is only not to foreclose it, and two `World` records cannot.

**What would change the answer:** the maintainer supplying per-world copy, or F1 deciding
to build the resolution path for its own two margin entries — in which case W1 consumes it
rather than authoring it, still writing no strings.

### R5 — If F1 is dropped from the run, W1 ships worlds-only and defers decorations entirely

**Chosen:** sharpen A2's fallback. A2 said "W1 fixes N itself and says so"; this step says
that if F1 does not land, **W1 must not create `src/data/decorations.ts` at all**.

**Rejected:** W1 creating an effect-free decoration list on its own.

**Why:** verified in source — `Decoration` does not exist, `ShopState` has no
`decorations` key, `Upgrade.art` is required so `ShopArt` cannot render an art-less entry,
and there is no buy path. A list with no sink, no persistence and no renderer is dead code,
and sizing it would mean inventing the D-13 pacing model the contract forbids W1 to invent.

**What would change the answer:** F1 landing (the expected case) — then W1 adds two worlds'
entries at F1's count and price curve, and A2 governs.

### R6 — A3 is affirmed, and the mockup evidence for it is now stronger than recorded

**Chosen:** keep `Pracownia` / `Laboratorium`, and record that the **mobile** mockup itself
labels world six "Laboratorium".

**Rejected:** treating both names as deviations from the mockups. Only *Pracownia* vs
*Salon kreatywny* is one.

**Why:** slug, filename stem and stored `theme` must stay identical, and the mobile mockup
independently uses the shorter label.

**What would change the answer:** nothing cheap — a rename after any profile stores the
theme is a data change, not a copy change.

### R7 — The `npm test` baseline was re-measured rather than inherited

**Chosen:** run the vitest suite on the main checkout (sandbox disabled, local Supabase up)
so the plan's `baseline + delta` criteria rest on an observation, per contract rule 5 and
L-005. Result: **548 passed / 548, 57 / 57 files**, matching the contract's recorded
baseline.

**Rejected:** inheriting the contract's number (a green I was told about is not a green I
observed); and running `playwright` (no `E2E_PORT` is assigned to a docs-lane step) or
`lint`/`check` (no source touched, so they cannot have moved).

**Why:** the branch W1 will actually measure against is F1's, not this one — but a verified
`matmaverse-v2` number is what lets the plan say *"measure the baseline on your branch"*
against something real.

**What would change the answer:** nothing; it is a measurement. The **planner must still
re-measure on F1's branch**, which will be higher.

### R8 — The skill's "present findings and ask for follow-ups" step was not honoured

**Chosen:** write `research.md`, advance `change.md` to `status: preparing`, write the
handoff, and return.

**Why:** run hard rule 1. The next command is recorded in the handoff's § 4 instead.
