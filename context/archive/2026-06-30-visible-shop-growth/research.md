---
date: 2026-06-30T20:50:58+0200
researcher: vince307
git_commit: 4fe8def598d160f10985dc63a946f82542e15b72
branch: main
repository: vince307/mathshop
topic: "Visible shop growth on level-up (S-05) — render surfaces, asset pipeline, level-up signal flow"
tags: [research, codebase, s-05, shop-growth, child-profiles, illustrations, business-level]
status: complete
last_updated: 2026-06-30
last_updated_by: vince307
---

# Research: Visible shop growth on level-up (S-05)

**Date**: 2026-06-30T20:50:58+0200
**Researcher**: vince307
**Git Commit**: 4fe8def598d160f10985dc63a946f82542e15b72
**Branch**: main
**Repository**: vince307/mathshop

## Research Question

Ground the S-05 slice ("visible-shop-growth"): when a completed shift crosses a `business_level` threshold, the child should see a **visible change to the shop** — on the results screen and on the next start-screen visit. Map the render surfaces and `World` data model, the illustration/asset pipeline (to compare decoration-overlay vs per-level-base-art approaches), and the level-up signal + persistence flow (`business_level`, `shop_state`, `leveledUp`) that S-04 deliberately left as the S-05 hook.

> **Mockup status:** The maintainer has a canonical S-05 shop-growth mockup and will share it. The mockup governs the final visual axis (look-and-feel); this research grounds the code paths that any approach must use. Per `CLAUDE.md:11-15`, `assets/matma-verse/` is the binding visual source of truth but is **local-only / gitignored** — the relevant `math-economy-ui-v2-*` screens (`pricing-inventory`, `skill-path`) must be shared before plan-time visual decisions are finalized.

## Summary

Everything S-05 needs is already plumbed; this is primarily a **rendering + small persistence** slice, not a new-table slice.

- **The level-up moment is already known and delivered to the UI.** `recordShiftResult` computes `leveledUp = businessLevel > current.business_level` server-side and the route returns it; `ShiftResults.tsx:44` already renders a **text-only** "Twój sklep rośnie!" gated on `leveledUp`. That line is the literal S-05 hook — swap/augment it with shop art.
- **Shop art is a single static PNG per world** (`world-<slug>.png`, served raw from `public/illustrations/`), rendered in exactly one gameplay surface today: the business card at `start.astro:73-76`. There is **no level→image mapping anywhere**, and `ShiftResults` currently renders **no** world art (only generic `coin-stack.png`).
- **`shop_state jsonb` exists, is loaded everywhere (`select("*")`), and is read/written by nothing.** It was added by S-04 explicitly "reserved for S-05." It is the intended persistence slot for unlocked-upgrade state, requiring **no migration and no new RLS policy** (column-agnostic F-01 policies already cover it).
- **Two visual approaches differ mostly in asset cost** (decoration overlays ≈ reuse 4 base arts + D overlay PNGs + a compositing layer; per-level base art ≈ `4 × (N−1)` new full illustrations + a one-line resolver change). Both must land art in committed `public/illustrations/` (gitignored `assets/` won't ship to CI/Vercel) and follow the `world-<slug>…` naming stem.
- **The persistence write, if any, must reuse `recordShiftResult`'s existing single UPDATE** (reach by `id`, no `account_id` from client — L-001/L-002), and any unlock-derivation should be a **pure tunable in `src/data/shift.ts`** (or a new `src/data/shop.ts`) so the client celebration and the server write agree by construction, exactly as coins/stars do.

## Detailed Findings

### 1. Shop-art render surfaces & the `World` data model

**The `World` model** (`src/data/worlds.ts:12-16`): `{ slug, name, image }` — no per-level field. Adding level-aware art means extending this shape or deriving variant paths at render time.
- `WORLDS` = 4 worlds (kawiarnia [default], piekarnia, galaktyczna-baza, sklep-ksiegarnia), each `image: "/illustrations/world-<slug>.png"` (`worlds.ts:19-31`).
- `worldForTheme(theme)` always returns a `World` (fallback `DEFAULT_WORLD`); callers: `start.astro:8,22`, `task.astro:7,21` (`worlds.ts:41-43`).

**Every render surface for shop/world art or name:**
- **`src/pages/app/start.astro:73-76`** — the business card: `<img src={world.image} alt={world.name} class="aspect-[4/3] w-full object-cover" />` inside `overflow-hidden rounded-3xl border`. **Primary S-05 target** (the "next start-screen visit" requirement). Gated behind `profile && world` (`:43`).
- **`src/components/child/ShiftResults.tsx`** — **no shop art today** (docstring at `:12-17` says "no shop art — that's S-05"). Renders heading, stars (`:24-34`), generic `coin-stack.png` (`:38`), coins text, and the `leveledUp` text (`:44`). **Second S-05 target** (the "results screen" requirement). **Does not currently receive `world`** — the prop must be threaded from `ShiftScreen.tsx:80` (which has `world` in scope).
- `task.astro:39` / `ShiftScreen.tsx:34,117,119` — only forward `world` to the task adapters; render no image.
- `CountingTask.tsx:31`, `ChangeMakingTask.tsx:34` — render `world.name` text only (small uppercase header), no image.
- `AuthShell.astro:83-84` — renders `world.image` as decorative auth chrome (not gameplay).

**How `business_level` is surfaced today (the only level→UI mappings):**
- `start.astro:67-69` — a pill: `t.start.levelLabel.replace("{level}", String(profile.business_level))` → "Poziom sklepu {level}" (`pl.ts:169`). Coins badge beside it (`start.astro:62-66`, `coin.png`).
- `ShiftResults.tsx:44` — `{leveledUp && <p>{t.results.levelUp}</p>}` → "Twój sklep rośnie!" (`pl.ts:210`).

**Tailwind/animation conventions a "shop grows" reveal should follow:**
- Framed card art: `aspect-[4/3] w-full object-cover` in `rounded-3xl border overflow-hidden bg-card border-border shadow-sm`; free-standing icons: `object-contain` + `loading="lazy"`.
- `tw-animate-css` is wired (`src/styles/global.css:2`); the celebration animation already used in the target component is `animate-in zoom-in fill-current` (`ShiftResults.tsx:30`, on the stars). Mirror that for the shop reveal. Other examples: `TaskScreen.tsx:63,72`, `CoinBoard.tsx:27`.
- Merge classes with `cn()` from `@/lib/utils` (CLAUDE.md mandate); conditional pattern at `ShiftResults.tsx:28-31`.

### 2. Illustration / asset pipeline & conventions

- **All images are static files under `public/`, served verbatim — not imported/bundled.** Confirmed by `astro.config.mjs:10-27` (no image integration; only `tailwindcss()` Vite plugin). Every reference is a root-absolute string `"/illustrations/…"`, never an ESM import.
- **`public/illustrations/` (7 tracked files):** `world-{kawiarnia,piekarnia,galaktyczna-baza,sklep-ksiegarnia}.png` (~45–50 KB each), `coin.png` (10 KB), `coin-stack.png` (25 KB), `slice-map.md`. **No per-level or decoration variants exist.**
- **Naming contract** (`worlds.ts:5-6`): "Slugs match the committed `public/illustrations/` stems, so `world-<slug>.png` always resolves." Extending this is the path of least resistance for per-level art (`world-<slug>-l2.png`).
- **Precedent — `matmaverse-design-system` Phase 2 "Illustration asset pipeline"** (`context/archive/2026-06-27-matmaverse-design-system/plan.md:109-137`, commit `ca3b7d8`): art was **sliced as raster crops from flattened local-only mockup PNGs**, recorded in `public/illustrations/slice-map.md` with source file + crop box `(x0,y0,x1,y1)`; named with stable descriptive stems; kept lean (small icons rendered with lucide, not sliced); **committed to `public/` because `assets/` is gitignored and won't reach CI/Vercel** (`plan.md:49`, `plan-brief.md:47` flags raster-edge-quality as the named risk). PNGs are "swappable if true vector/source exports become available later" (`slice-map.md`).
- **`CLAUDE.md:11-15`** — `assets/matma-verse/` is the binding visual source of truth but local-only; "If `assets/matma-verse/` is absent, ask the maintainer to share the relevant mockup rather than guessing." The mockup set names `pricing-inventory` and `skill-path` — the screens most relevant to shop growth.
- **Lazy-load/perf:** per-`<img>`, hand-applied. `loading="lazy"` on small/off-screen images (`start.astro:63` coin, `SelectTile.tsx:37`); the above-the-fold world card omits it (`start.astro:74`). No image optimizer — file size is the only lever, managed by hand.

**Asset-cost facts per approach (visual axis to be confirmed by mockup):**

| | (A) Decoration overlays | (B) Per-level base art |
|---|---|---|
| New base art | 0 (reuse 4 `world-<slug>.png`) | `4 × (N−1)` full illustrations (3 tiers → 8 PNGs; 5 → 16) |
| Overlay/extra assets | D overlay PNGs (×4 if per-world) | 0 |
| Render code | compositing layer: base `<img>` → stacked container + absolutely-positioned overlays read from `shop_state`; needs per-world anchor coords (slice-map discipline) | one-line: resolver picks `world-<slug>-l{level}.png` by `business_level`; fits naming stem exactly |
| `shop_state` needed for render? | yes (which overlays unlocked) | no (level alone derives the path) |
| New source art the maintainer must produce | overlay props | additional full per-level states (ui-v2 mockups show one state per world today) |

### 3. Level-up signal & persistence flow (the S-05 hook)

**Derivation (server-authoritative):** `businessLevelForShifts(n) = 1 + floor(n / SHIFTS_PER_LEVEL)`, `SHIFTS_PER_LEVEL = 3` (`shift.ts:23,75-77`). `recordShiftResult` (`child-profiles.ts:89-113`) reads the row by `id` (RLS-scoped), increments `completed_shift_count`, recomputes `business_level`, persists, and returns `{ coinsEarned, businessLevel, leveledUp }` where `leveledUp = businessLevel > current.business_level` — **true exactly on the threshold-crossing shift.** The level write is idempotent-on-recompute (writes the recomputed level, not an increment), so it self-heals.

**Propagation:** route returns all three fields as JSON (`complete.ts:52-58`, `businessLevel` currently unused by client) → `ShiftScreen.tsx:70-72` reads only `leveledUp`, sets `Outcome` (coins/stars computed client-side from the same pure fns, `ShiftScreen.tsx:56-57`) → `ShiftResults.tsx:44` renders the text-only level-up line. **This is the UI hook to upgrade.**

**`shop_state`:** `jsonb not null default '{}'` (`migration:23`), typed `Record<string, unknown>` (`child-profiles.ts:36`), comment "Reserved for S-05" (`migration:37-38`). **Read/written by nothing** (grep confirms only the type field, the migration, and a duplicated test type). `select("*")` already loads it into every profile object; `recordShiftResult`'s UPDATE writes only coins/count/level and does **not** touch it.

**To use `shop_state` for unlocks (S-05):** define a concrete shape (e.g. `{ unlocked: string[] }`) on `ChildProfile`/`src/types.ts`; add a **pure unlock-derivation fn** alongside `businessLevelForShifts` (in `shift.ts` or a new `src/data/shop.ts`) so client + server agree; when `leveledUp`, merge the new unlocks into `shop_state` **in the existing `.update({...})`** (no extra round-trip — row already read at `child-profiles.ts:97`); optionally add `shopState` to the route JSON for the immediate results reveal. No migration, no new policy.

**Start-screen render path (confirmed, no new query):** `getMostRecentProfile` does `select("*")` (`child-profiles.ts:69-72`), so `start.astro:19-20` already has the full `ChildProfile` — including `business_level` and the unused `shop_state` — in scope. S-05 renders shop art from `profile.business_level` / `profile.shop_state` directly in the existing `world.image` block (`start.astro:72-76`), keyed off the same `worldForTheme(profile.theme)` already resolved at `:22`.

### 4. RLS contract S-05 must follow (L-001 / L-002)

`recordShiftResult` writes by `id` with **no `account_id` filter** — ownership enforced entirely by the F-01 `child_profiles_update_own` policy (`child-profiles.ts:80-109`; route note `complete.ts:9-13`). Must-follow rules for any S-05 `shop_state` write:
1. **Reuse the existing single UPDATE** (`child-profiles.ts:106-109`) — add `shop_state` to the same `.update({})`; compute from the already-read row. No second query.
2. **Reach by `.eq("id", profileId)` only** — RLS gates ownership (non-owner update → 0 rows).
3. **No client-supplied `account_id`** — keep the route zod schema (`complete.ts:14-20`) trusting nothing new from the client; derive everything server-side (like coins). (L-002, `lessons.md:13-19`.)
4. **No new policy, no new trigger, likely no new migration** — column-agnostic F-01 policies already cover `shop_state`; do **not** redefine `set_updated_at()`. (L-001, `lessons.md:5-11`; S-04 migration header `:6-9`.)
5. **Unlock derivation as a pure dual-import tunable** so celebration + persistence agree by construction (`shift.ts:1-7` pattern).

## Code References

- `src/data/worlds.ts:12-16,19-43` — `World` model, `WORLDS`, `worldForTheme`/`getWorld`
- `src/pages/app/start.astro:19-22,60-76` — profile load; coins+level HUD; **business card (primary S-05 surface)**
- `src/components/child/ShiftResults.tsx:12-17,24-44` — results celebration; **`leveledUp` text-only hook at `:44`**; no `world` prop yet
- `src/components/child/ShiftScreen.tsx:34,56-57,70-72,80` — reads `leveledUp`, computes coins/stars client-side, passes `Outcome`+`world` in scope
- `src/data/shift.ts:23,75-77,1-7` — `SHIFTS_PER_LEVEL`, `businessLevelForShifts`, dual-import purity contract
- `src/lib/services/child-profiles.ts:36,69-72,89-113` — `shop_state` type field; `getMostRecentProfile` `select("*")`; `recordShiftResult` compute+persist+`leveledUp`
- `src/pages/api/shifts/complete.ts:7,14-20,52-58` — `prerender=false`; zod; JSON incl. `businessLevel`/`leveledUp`
- `supabase/migrations/20260630120000_child_profiles_add_gameplay_state.sql:6-9,22-23,37-38` — RLS-already-covers note; `business_level` + `shop_state` columns; "reserved for S-05"
- `public/illustrations/` — `world-<slug>.png` ×4, `coin.png`, `coin-stack.png`, `slice-map.md` (no level/overlay variants)
- `astro.config.mjs:10-27` — no image bundler; `public/` served raw
- `src/styles/global.css:2` — `tw-animate-css` wired
- `src/i18n/pl.ts:169,210` — `start.levelLabel`, `results.levelUp`

## Architecture Insights

- **The "agree by construction" pattern is the backbone.** Coins/stars are pure fns in `shift.ts` imported by both client (display) and server (authoritative write); a tampered client can't inflate. S-05's unlock logic should adopt the same shape so the results reveal and the persisted `shop_state` never diverge.
- **Column-agnostic RLS makes gameplay-state additions cheap.** Adding/using `shop_state` needs no migration and no policy — the highest-risk part of the project (per-account isolation) is already handled for any new column. The cost center is art + render code, not data safety.
- **One profile load serves both surfaces.** `select("*")` + SSR load means the start screen already has every field; the results screen gets `leveledUp` (and could get `shopState`) over the existing single POST. No new endpoints, no N+1.
- **The slice is render-led.** The boolean and the persisted level already exist; S-05 is mostly: thread `world` (+ any unlock data) into `ShiftResults`, add a level/`shop_state`-keyed art layer to two JSX blocks, and produce the art assets. The biggest external dependency is **art direction** (mockup + assets), not engineering.

## Historical Context (from prior changes)

- `context/archive/2026-06-29-full-shift-with-results/plan.md:5,36,91` — S-04 explicitly scoped to "coins + stars only"; "No visible shop-art growth … New shelf/sign/decoration is **S-05**"; migration comment reserves `shop_state` for S-05.
- `context/archive/2026-06-29-full-shift-with-results/research.md:24,63,123` — product-owner confirmation S-04 = coins+stars; "store [`business_level`] so S-05 reads it directly … no shop art (S-05)."
- `context/archive/2026-06-29-full-shift-with-results/plan-brief.md:28,30,36` — "S-05 reads it directly"; "Visible shop growth is S-05."
- `context/archive/2026-06-27-matmaverse-design-system/plan.md:109-137,49` — the illustration asset-pipeline precedent (slice-from-mockup → `public/` → slice-map.md).
- `context/foundation/roadmap.md:135-146` — S-05 outcome (visible change on **results screen and next start-screen visit**; literal shop growth, not an integer); open unknown: "how many threshold tiers + what artwork ships for v1? … start with 2–3 tiers + minimum shop-growth assets" (owner: user, art direction).
- `context/foundation/lessons.md:5-19` — L-001 (RLS ships with the table, column-agnostic), L-002 (never take `account_id` from client; verify durable state).

## Related Research

- `context/archive/2026-06-29-full-shift-with-results/research.md` — S-04 persistence/scoring/results research (direct predecessor; established `business_level`/`shop_state` columns and the `leveledUp` signal).
- `context/archive/2026-06-27-matmaverse-design-system/` — design tokens + illustration pipeline (the art-production precedent S-05 must follow).

## Open Questions

1. **Visual axis (mockup-driven).** Decoration overlays (A) vs per-level base art (B) vs a hybrid — decided by the maintainer's S-05 mockup (pending share). Drives asset count and whether `shop_state` is needed for *rendering* (A needs it; B can derive from `business_level` alone).
2. **Tier count & art budget.** How many visible levels ship for v1 (roadmap suggests 2–3)? Sets `4 × (N−1)` for (B) or the overlay pool size for (A).
3. **`shop_state` shape.** If we persist unlocks: `{ unlocked: string[] }`, a tier→assets map, or derive purely from `business_level` at render (no persisted state)? Pure-derivation is simplest if the mapping is deterministic from level; `shop_state` earns its keep only if unlocks become non-deterministic (choices, randomized decorations) later.
4. **Results-vs-start consistency.** The reveal animation belongs on the results screen (the `leveledUp` moment); the start screen shows the persisted steady state. Confirm both read the *same* art-resolution function so they never disagree.
5. **Asset availability for CI/cloud.** New art must be committed to `public/illustrations/`; the source mockups are local-only. Production of the PNGs (slice-map entries, crop boxes) happens on the maintainer's machine — plan must account for that hand-off.
