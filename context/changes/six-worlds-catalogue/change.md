---
change_id: six-worlds-catalogue
title: Add the Pracownia and Laboratorium worlds, each with its own decoration set
status: impl_reviewed
created: 2026-08-27
updated: 2026-08-27
archived_at: null
---

## Notes

Close the PRD-v3-assumes-six / code-has-four gap by adding the `pracownia` and
`laboratorium` worlds — two `WORLDS` entries, their names, each world's own
decoration set (D-11) — on already-committed art and with **no migration**.

Backlog entry: **W1** in `context/foundation/backlog.md` § `## Ready`.
Design: `docs/superpowers/specs/2026-08-27-world-economy-design.md` §2a, §5.
Run: `context/runs/2026-08-27-world-economy/` — feature **F2**, second in a serial
stack behind **F1 `world-economy-profit-rule`** (both edit `src/i18n/pl.ts`).

---

## Intake verification — every W1 claim checked against this repo, 2026-08-27

The backlog tags W1's claims **[V]** rather than **[I]** and, unusually, **every
one of them held**. What the intake *added* is four surfaces W1's entry does not
name at all, one of which is a guaranteed test regression. Corrections and
additions below are the substance of this step.

### Confirmed as written

| Claim | Verdict |
| --- | --- |
| No migration — `child_profiles.theme` is `text not null default 'default'`, no CHECK | **Confirmed.** `supabase/migrations/20260609120000_child_profiles_isolation.sql`, the `theme` column in the `child_profiles` create. Grepping all 12 migration files for a `check (` touching `theme` returns nothing. Validation is app-layer only, in the `theme` field of the zod schemas in `src/pages/api/profiles/create.ts` and `src/pages/api/profiles/world.ts`, both `.refine`-ing against `WORLD_SLUGS`. |
| Six `world-*.webp` committed, all 896×718 with alpha | **Confirmed**, measured with `sips`: all six report `pixelWidth 896 / pixelHeight 718 / hasAlpha yes`. |
| Provenance recorded in `slice-map.md` | **Confirmed** — the W1 table maps `world-pracownia.webp` ← `creative-studio-world.png` (1448×1086, `contain`) and `world-laboratorium.webp` ← `invention-lab-world.png` (1402×1122, `cover`). |
| Slug = filename stem = `theme` value, no diacritics | **Confirmed** for both. |
| `WorldPicker.tsx` and `CreateProfileWizard.tsx` iterate `WORLDS`, not four hardcoded tiles | **Confirmed** — both map `WORLDS` into `SelectTile`. Neither needs a data edit. |
| The `t.worlds[slug].upgrades[id] ?? t.upgrades[id]` fallback makes vocabulary optional | **Confirmed as a design commitment** (spec §5, "the fallback is mandatory, not a convenience"). It does **not exist in code yet** — see the naming collision below. |
| Zero decoration art in any manifest | **Confirmed** — no `decor`/`plant`/`poster`/`lamp`/`banner`/`flower`/`sticker`/`cosmetic` asset in `atomic-assets-v1/v2/v3`. Handled by the contract's settled decision: no art, lucide + design tokens, the `src/data/stages.ts` "ART DEVIATION" header as the precedent. |

### Corrections and additions the backlog entry does not carry

1. **`tests/shop-art-slots.test.tsx` goes red the moment `WORLDS` grows — this is a
   guaranteed regression, not a risk.** Its first case, *"gives every non-default
   world its own slot table"*, iterates `WORLD_SLUGS` and asserts a `WORLD_SLOTS`
   entry exists for every slug except `DEFAULT_THEME`. `WORLD_SLOTS` in
   `src/components/child/ShopArt.tsx` today holds exactly `piekarnia`,
   `galaktyczna-baza`, `sklep-ksiegarnia`. **W1 must ship two new slot tables**,
   each covering every id in `UPGRADE_IDS`, each setting exactly one of
   `left`/`right` and one of `top`/`bottom` as a percent in 0–100 (the other three
   cases in that file). Note the coupling to F1: `UPGRADE_IDS` is derived from the
   catalogue, so if F1 lands two new entries, **all five** slot tables need them,
   not just W1's two. Whether that fill-in belongs to F1 or W1 is a contention-sweep
   call; W1 assumes it inherits a catalogue whose ids are already final.

2. **The design's copy path `t.worlds[slug].upgrades[id]` collides with an existing
   key that means something else.** `t.worlds` in `src/i18n/pl.ts` is today the
   *world-selection screen's copy namespace* — `heading`, `subtitle`, `sameSkills`,
   `carryOver`, `learnHeading`, `learn.{math,trade,decisions}`, `confirm`,
   `submitting` — consumed by `WorldPicker.tsx` and `src/pages/app/worlds.astro`. It
   is **not** keyed by slug, and its header comment says the competency trio is
   "world-INDEPENDENT by design". Nesting per-slug vocabulary directly under
   `t.worlds` would put `t.worlds.pracownia` beside `t.worlds.heading` in one
   record. The plan must pick a non-colliding home (e.g. `t.worlds.bySlug[slug]`, or
   a sibling namespace) and say so; the spec's snippet is shorthand, not a key path.

3. **World *names* are not in `src/i18n/pl.ts` — they are literals in
   `src/data/worlds.ts`.** The `name` field on each `WORLDS` entry carries
   "Kawiarnia", "Piekarnia", etc. directly. So "two i18n names" is the wrong shape
   for the edit: W1 adds two `World` records with inline names, exactly following
   the four that ship today. There is a *separate*, unrelated four-entry list at
   `t.marketing.worlds` (name + image), rendered by `Welcome.astro` and
   `AuthShell.astro` as the signed-out marketing strip. Whether that strip grows to
   six is a product call the plan must make explicitly — it duplicates `WORLDS` by
   hand and nothing keeps the two in sync.

4. **The picker grid must reflow, and the code already says how.** The
   `01-world-selection` mockups (both sets present on this machine and inspected)
   draw **six** worlds: 3×2 on web, 2×3 on mobile. `WorldPicker`'s header comment
   already anticipates this — *"a clean 2×2 at four, and it stays clean at six when
   the art lands (swap in `lg:grid-cols-3` then)"* — and that comment's premise
   ("the two missing ones have no slug and no committed art") becomes false with
   this change, so the comment itself must be rewritten, not just the class.
   Separately, `CreateProfileWizard`'s tile grid is `grid-cols-2 sm:grid-cols-4
   lg:grid-cols-2`, which at six worlds gives a ragged 4+2 row at `sm`; it has its
   own mockup and needs its own call.

5. **Mockup names differ from the settled names, deliberately.** The mockups label
   the two worlds **"Salon kreatywny"** and **"Laboratorium wynalazków"**; the
   settled, committed values are **Pracownia** and **Laboratorium**. This is the
   same reconciliation already recorded in `src/data/worlds.ts` for "Sklep
   kolekcjonera" vs `sklep-ksiegarnia`, and it is a documented deviation — see
   decision **A3** below.

6. **Visual parity with the shipped four is fine — a risk I expected and did not
   find.** `slice-map.md` describes the earlier four as "crops of a mockup sheet"
   and the two new ones as "whole illustrations, resized", which reads like the new
   plates might be transparent cutouts beside full-bleed scenes. Opening
   `world-kawiarnia.webp` and `world-pracownia.webp` shows both are alpha
   hero illustrations on transparency at the same 896×718. No treatment difference
   to compensate for.

7. **L-007 substring check, run rather than assumed.** Both new labels were tested
   against every human-readable string literal in `src/i18n/pl.ts`, in both
   directions: nothing existing contains "Pracownia" or "Laboratorium", and neither
   contains any existing label. Safe for `getByText` / `getByRole`.

### Mockups

`assets/` **is present in this checkout** (docs lane, main tree), so the layout
notes above are read off the real PNGs, not extrapolated. **The code lane cannot
see them** — `assets/` is gitignored and absent from the run's worktrees — so any
layout the plan specifies must be written out as explicit classes and prose, not as
"match the mockup".

---

## Autonomous decisions

Made in place of asking, per the run's agent contract. Each carries what would
change the answer.

### A1 — W1 ships on the copy fallback and writes **no** per-world catalogue vocabulary

*(the contract's open decision 3)*

**Chosen:** the two new worlds get a name, art, a `WORLD_SLOTS` table and a
decoration set, and resolve every catalogue entry's copy through the neutral
fallback. Zero of the 6 × 8 per-world strings are written.

**Rejected:** writing the full 6 × 8 vocabulary in W1.

**Why:** those 48 strings are Polish product copy for 6–9-year-olds with no mockup
source and no kid-testing behind them — inventing them autonomously is precisely
the "no invented data" line the contract draws. They would also be written against
a catalogue F1 is changing in the same stack, so they would be guesses about copy
that has just moved. And the fallback's awkward cases already ship today:
`galaktyczna-baza` renders "Lepsza kasa" and "Więcej klientów" now, so two more
worlds make the situation larger but not different in kind. Vocabulary is purely
additive on top of a mandatory fallback, so deferring it costs nothing structural.

**What would change the answer:** the maintainer supplying or approving the copy;
or kid-testing showing that neutral names actively confuse children in a
non-shop-shaped world (Laboratorium is the sharpest case). Either makes it a copy
change to `pl.ts` with no code change — which is the point of the fallback.

### A2 — decoration count per world is **inherited from F1, not chosen here**; the fallback if F1 leaves it unset is **3**

*(the contract's open decision 4)*

**Chosen:** W1's two worlds get exactly the same decoration count and price curve
that F1 `world-economy-profit-rule` establishes for the existing four. W1 does not
pick a number independently. If F1's plan somehow lands without fixing one, W1 uses
**3 per world**.

**Rejected:** W1 choosing its own N, and W1 blocking on F1's number.

**Why:** F1 owns `src/data/decorations.ts` and the D-13 pacing model that sizes the
wallet's sink against the reference shift — that model, not W1, is what prices N.
Diverging would also be the one way an effect-free decoration set could still
create an asymmetry between worlds: unequal *sink capacity* means unequal
"something to spend on", which is the exact failure D-11 exists to prevent. The
fallback of 3 is the smallest count that reads as a set rather than a pair while
still offering a choice, and with no art each entry costs one lucide icon plus one
name.

**What would change the answer:** F1's pacing model concluding the sink needs a
different size — in which case W1 follows F1 to the new number rather than keeping
3. If F1 is dropped from the run, W1 must fix N itself and say so.

### A3 — keep **Pracownia** / **Laboratorium**; do not adopt the mockups' names

**Chosen:** `pracownia` / "Pracownia" and `laboratorium` / "Laboratorium", matching
the committed filename stems and the value that goes into `child_profiles.theme`.

**Rejected:** the mockups' "Salon kreatywny" and "Laboratorium wynalazków".

**Why:** slug, filename stem and stored `theme` value must stay identical (backlog
W1), and single-word, diacritic-free names follow the `kawiarnia` / `piekarnia`
precedent so no transliteration step exists to get wrong. `src/data/worlds.ts`
already records this exact reconciliation for the fourth world. Renaming after
profiles exist is a data change, not a copy change.

**What would change the answer:** the maintainer preferring the mockup wording —
cheap **only** before any profile stores the theme, and even then it is a rename of
the slug, the two `public/illustrations/` files and their `slice-map.md` rows, not
just a string.

### A4 — next step is `/10x-research`, not `/10x-plan`

**Chosen:** `/10x-research six-worlds-catalogue`.

**Rejected:** going straight to `/10x-plan`; and stopping to ask, which the run
forbids.

**Why:** the intake turned up four code surfaces W1's entry never names — a
guaranteed test regression in `tests/shop-art-slots.test.tsx`, a key-namespace
collision on `t.worlds`, world names living in `worlds.ts` rather than `pl.ts`, and
two grid layouts to reflow. A plan written from the backlog entry alone would miss
all four. Research should also settle the F1/W1 boundary on `src/data/decorations.ts`
and `WORLD_SLOTS`, which is the plan's single largest unknown.

**What would change the answer:** F1's plan landing first and already resolving the
decoration-module and slot-table ownership — then research is mostly done and
planning could start from F1's artifacts.
