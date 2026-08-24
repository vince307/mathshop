---
date: 2026-08-22T18:28:33Z
researcher: Claude (autonomous run 2026-08-22-autonomous-five, step F5/research)
git_commit: 22ddebd9e20bad4ed23613cbfa2fcbd69cd8c7b5
branch: feat/ui-polish
repository: 10xDevs
topic: "What is actually coupled to child_profiles.theme and to shop_state.purchased, and what would breaking the one-time world choice cost?"
tags: [research, codebase, worlds, theme, shop-state, upgrades, world-selection, coupling-map]
status: complete
last_updated: 2026-08-22
last_updated_by: Claude (autonomous run)
---

# Research: the `theme` / `shop_state.purchased` coupling, and the cost of breaking the one-time world choice

**Date**: 2026-08-22T18:28:33Z
**Researcher**: Claude, autonomous run `context/runs/2026-08-22-autonomous-five/` (feature F5)
**Git Commit**: `22ddebd9e20bad4ed23613cbfa2fcbd69cd8c7b5`
**Branch**: `feat/ui-polish`
**Repository**: 10xDevs (MathShop / Matmaverse)

## Research Question

> What is actually coupled to `child_profiles.theme` and to `shop_state.purchased`, and what would
> breaking the one-time world choice cost — in data, in the shop's appearance, and in the child's
> sense of progress?

## Autonomous decisions

This step ran under `context/runs/2026-08-22-autonomous-five/agent-contract.md`: **no human in the
loop**. The `/10x-research` skill opens by asking the user for a research question and later wants to
narrow scope with `AskUserQuestion`. Neither was asked. Both were supplied by the orchestrating step
and are recorded here verbatim so a reader can audit what this document was aimed at.

- **Research question**: as quoted above. Chosen over the narrower "how do I build `/app/worlds`"
  because the screen is the cheap half — the previous step
  (`context/changes/world-selection-screen/handoff.md` §3) identified the shared purchase list as the
  headline risk, and a planner who gets the screen right and the data wrong ships a silent design
  hole.
- **Scope: deep, weighted to the coupling map, not the screen.** Six sweeps: (1) every read/write of
  `shop_state.purchased`, (2) every read/write of `theme` plus the world and upgrade catalogues,
  (3) the existing write path + routing + nav, (4) the test surface + PRD stance + prior decisions,
  (5) the binding mockups (read directly by this agent), (6) the non-repo design handoff under
  `assets/app-docs-v2-llm-handoff/`.
- **Rejected**: a surface-level pass that trusts the previous handoff's claim that `purchased` is
  world-agnostic. That claim turned out to be *true in form and misleading in consequence* — see
  §2 — and re-deriving it changed the shape of the options list.
- **Deliberately NOT decided here**: what happens to purchased upgrades when the world changes. §5
  lays the options out with consequences. Per the previous handoff (§3) and the contract, that
  decision belongs to `/10x-plan` and must be recorded there. A recommendation appears in the
  handoff, explicitly marked as overrulable.
- **What would change the answer**: if the planner decides F5 must ship 6 worlds rather than 4, the
  art-coherence argument in §2.4 gets stronger (a "Lepsza kasa" in a `laboratorium` is a worse fit
  than in a `piekarnia`) and option B in §5 becomes more attractive. If F4
  (`world-progression-stages`) lands first and rewrites `ShopArt`, §2.4 and §5 option D must be
  re-costed against the stage catalogue rather than against `DEFAULT_SLOTS`.

## Summary

Six findings, in order of how much they should move the plan.

1. **A theme flip is functionally lossless today.** `theme` is read in exactly three places, all
   render-time, all through `worldForTheme()`. **Nothing is denormalized from it** — not at profile
   creation, not on purchase, not on shift completion. Flip `kawiarnia` → `sklep-ksiegarnia` in the
   DB right now and every screen renders, every image resolves, the wallet, level, skills, shift
   length and purchase list are all still correct. There is no data corruption to defend against.
2. **The purchase list is world-neutral in form, and that is exactly the problem.** `shop_state`
   is `{ purchased: string[] }` — bare ids, **no world, no timestamp**
   (`src/lib/services/child-profiles.ts:250`). It is not that the data is wrong; it is that the data
   to partition purchases by world *was never captured*, so no retroactive per-world split is
   possible from this column alone. `shift_log.upgrade_purchased` timestamps purchases but also
   records no world.
3. **The visible cost of a switch is not "a coffee machine in a flower shop".** There is no
   café-specific upgrade in the catalogue — the six upgrades are generic retail vocabulary (`Szyld`,
   `Półka`, `Lepsza kasa`, `Miejsce na produkt`, `Magazynek`, `Więcej klientów`) with theme-neutral
   SVGs, deliberately (`src/data/upgrades.ts:8-9`; `public/illustrations/slice-map.md:25`). The real
   costs are (a) six overlay coordinates tuned against one background, (b) semantic strain on
   `galaktyczna-baza` only, and (c) — the one that actually matters — **the new world opens fully
   furnished and with nothing left to buy**.
4. **That third cost is the product risk, and the PRD has a lot to say about it even though it never
   mentions world switching.** `prd-v3.md:180` names "owned upgrades as the permanent, monotonic win"
   as *the chosen mitigation* for a 6-year-old reading a dropping wallet as loss.
   `prd-v3.md:76` and `shape-notes.md:152-154` make monotonic perceived progress a guardrail.
   **Reset-on-switch destroys precisely the mitigation the PRD names.** Carrying purchases forward
   preserves it but empties the loop the same document calls the point of the product.
5. **No migration is required for the screen itself.** `theme` already exists as
   `text not null default 'default'` with no CHECK constraint, and `child_profiles_update_own`
   (`supabase/migrations/20260609120000_child_profiles_isolation.sql:90-95`) already permits the
   write. Per-world purchases would *also* need no DDL — `shop_state` is jsonb and the RLS policies
   are column-agnostic — but it would need a **data-shape decision plus a legacy-row normalizer**,
   which is a migration-grade decision even without a migration file.
6. **The mockup draws 6 worlds; the catalogue ships 4**, and one of the 4 is named differently from
   the mockup (`Sklep księgarnia` in code vs `Sklep kolekcjonera` in the PNG). `/app/worlds` is
   **already gated** by `PROTECTED_ROUTES = ["/app"]` matched with `startsWith` — verified, no
   middleware edit. `src/i18n/pl.ts:169` already tells the parent *"Świat możesz zmienić później"* —
   the product has shipped the promise and not the feature.

---

## Detailed findings

### 1. The `shop_state.purchased` coupling map — every read and write

`shop_state` is `jsonb not null default '{"purchased": []}'::jsonb`. `ShopState` is declared at
`src/types.ts:92-94`. Nine production files touch `purchased`.

#### 1.1 Reads

| # | file:line | code | what it does | world-agnostic? |
|---|---|---|---|---|
| 1 | `src/data/upgrades.ts:116-119` | `export function readPurchased(shopState) { return shopState?.purchased ?? []; }` | the sole normalizer; `{}` and `null` → `[]` | **Form-agnostic, meaning-blind.** Returns bare ids that carry no world qualifier. This is the seam every other verdict hangs off. |
| 2 | `src/data/upgrades.ts:121-123` | `isOwned(id, purchased) => purchased.includes(id)` | membership test | Agnostic **only because the catalogue is global**. With per-world catalogues, `includes` cannot tell a café `register` from a bakery `register`. |
| 3 | `src/data/upgrades.ts:144-158` | `if (isOwned(upgrade.id, ctx.purchased)) return { ok: false, reason: "owned" };` | server-authoritative purchase gate | **Assumes the world never changes.** After a switch every previously-bought upgrade reads as already-owned in the new shop, so the new world is unbuyable. |
| 4 | `src/data/upgrades.ts:161-165` | `UPGRADES.filter((u) => !isOwned(u.id, ctx.purchased) && u.requiredWorldLevel <= ctx.businessLevel)` | the "next goal" shown on dashboard, shop rail, results screen | **Assumes the world never changes.** A child who owns all 6 gets `null` forever; a world switch restores nothing to aim at. |
| 5 | `src/data/upgrades.ts:168-171` | `purchased.reduce((n, id) => n + (getUpgrade(id)?.extraTasks ?? 0), 0)`, capped at `MAX_BONUS_TASKS = 5` | shift **length** | Agnostic in effect (a number). But the cap chains into `MAX_SHIFT_TASKS` (`src/data/shift.ts:30`) and the zod ceiling in `src/pages/api/shifts/complete.ts:25,26,41,42` — a second catalogue adding `extraTasks` without moving the cap makes legitimate shifts 400-reject. |
| 6 | `src/components/child/ShopArt.tsx:36-49` | `const owned = UPGRADES.filter((u) => isOwned(u.id, purchased));` … `<img src={world.image} …/>` + `<img src={u.art} …/>` at `WORLD_SLOTS[world.slug]?.[u.id] ?? DEFAULT_SLOTS[u.id]` | composites the grown shop | **The sharpest coupling — but positional, not pictorial.** See §2.4. `WORLD_SLOTS` is `{}` (line 26): the per-world hook exists and is empty, and it overrides *coordinates only*, never the image. |
| 7 | `src/components/child/UpgradeShop.tsx:49,56-60,234` | `const ctx = { walletBalance, businessLevel, purchased: owned, skillState };` … `<ShopArt world={world} purchased={owned} />` | partitions the catalogue into affordable / locked / owned | **Not agnostic.** `world` is threaded **only** to `ShopArt` (line 234) — it never reaches the catalogue filter, tile art or copy. Line 242's completion check `ownedList.length === UPGRADES.length` is against the global catalogue size. |
| 8 | `src/components/child/ShiftScreen.tsx:111-113` | `const next = nextUpgrade({ businessLevel: data.businessLevel, purchased });` | post-shift "next goal" card | **Not agnostic**, and `ShiftResults.tsx:74` renders `next.art` having received **no `world` prop at all**. |
| 9 | `src/pages/app/start.astro:42-43,68,107` | `const purchased = readPurchased(profile.shop_state);` · `{ label: t.start.statUpgrades, value: String(purchased.length) }` | dashboard: next-goal, the **"N ulepszeń"** stat tile, the shop scene | **Not agnostic.** `purchased.length` is shown to the child as *"your shop has N upgrades"* — a lifetime-global count that, after a switch, keeps counting the old world's furniture. Lines 57/179 index `t.upgrades[...]` unguarded rather than via `upgradeCopy()`. |
| 10 | `src/pages/app/upgrades.astro:28-29` | `const world = worldForTheme(profile.theme);` `const purchased = readPurchased(profile.shop_state);` | the shop page | **This is the coupling in two adjacent lines**: world and purchases are resolved side by side and *never reconciled*. Nothing checks that the purchased ids belong to that world. |
| 11 | `src/pages/app/task.astro:27-28,36` | `generateShift(profile.starting_level, shiftBonusTasks(purchased))` | shift length | Agnostic in effect; see #5 for the ceiling. |
| 12 | `src/lib/services/child-profiles.ts:228` | `const purchased = readPurchased(current.shop_state);` | authoritative read feeding `canBuy` | Same verdict as #3. |

Whole-row `select("*")` reads that carry `shop_state` without inspecting it:
`child-profiles.ts:95` (`listChildProfiles`), `:165` (`recordShiftResult`), `:223` (`buyUpgrade`),
`src/lib/services/active-profile.ts:28`. All hydrate `ChildProfile.shop_state: ShopState`
(`child-profiles.ts:40`) typed **non-optional** even though `{}` rows are legal forever — only
`readPurchased` (which accepts `Partial<ShopState> | null | undefined`) makes that safe. Any new
consumer reaching for `profile.shop_state.purchased` directly gets a lying type and a runtime
`undefined`.

#### 1.2 Writes

- **The only production write** — `src/lib/services/child-profiles.ts:238-253`:
  ```ts
  const nextPurchased = [...purchased, upgrade.id];
  const walletBalance = current.wallet_balance - upgrade.cost;
  await client.from("child_profiles").update({
    wallet_balance: walletBalance,
    shop_state: { ...current.shop_state, purchased: nextPurchased },
    skill_state: nextSkillState,
  }).eq("id", profileId);
  ```
  Append-only, whole-column rewrite that preserves unknown sibling keys. **It records no world and
  no timestamp.** This single line is why a per-world split cannot be reconstructed retroactively.
- **API entry** — `src/pages/api/upgrades/buy.ts:15`:
  `z.object({ profileId: z.uuid(), upgradeId: z.enum(UPGRADE_IDS) })`. `UPGRADE_IDS` is the global
  closed set; the route never sees `theme`, so it would accept a bakery-only id for a café profile
  the day catalogues diverge.
- **Migration-level** — `supabase/migrations/20260701130000_child_profiles_shop_state_default.sql:14`
  sets the default and explicitly declines to backfill: *"Existing pre-launch rows keep `{}` and are
  normalized in code."*
- **Test/e2e** — `e2e/helpers/accounts.ts:42,58` (`shopState?: { purchased: string[] }`),
  `e2e/gameplay-restore.spec.ts:88`, `tests/upgrades-buy.test.ts:64`.
  **Every seed hard-codes `theme: "kawiarnia"`** (`accounts.ts:54`, `upgrades-buy.test.ts:61`) —
  no test in the repo exercises `purchased` against a non-café world.
- **There is no reset path, no PATCH, no admin route, and no `theme`-change route.**

#### 1.3 `child_profiles` after all migrations

| Column | Type | Default / constraint |
|---|---|---|
| `id` | uuid | `gen_random_uuid()`, PK |
| `account_id` | uuid | not null, FK `auth.users(id) on delete cascade` |
| `name` | text | not null (child PII) |
| `age` | smallint | not null, `check (age between 6 and 9)` |
| `avatar` | text | not null |
| **`theme`** | **text** | **not null `default 'default'` — no CHECK, no FK, no enum** |
| `starting_level` | smallint | not null default 1 |
| `wallet_balance` | integer | not null default 0, `check (>= 0)` |
| `completed_shift_count` | integer | not null default 0, `check (>= 0)` |
| `business_level` | smallint | not null default 1, `check (>= 1)` |
| **`shop_state`** | **jsonb** | **not null `default '{"purchased": []}'::jsonb` — no shape constraint** |
| `skill_state` | jsonb | not null default `'{}'::jsonb` |
| `created_at` / `updated_at` | timestamptz | not null `default now()`, trigger-maintained |

There is **no XP column**; "progress" is `completed_shift_count` → `business_level`. Money is the
single `wallet_balance`. RLS (all four policies, column-agnostic, in the create migration
`20260609120000_child_profiles_isolation.sql:76-101`) has never been revised. Worth flagging for the
planner: `child_profiles_update_own` lets an authenticated parent write `shop_state` and
`wallet_balance` directly with their own anon-key session — server-authoritative pricing in
`buyUpgrade` is an **application** guarantee only, and `check (wallet_balance >= 0)` is the sole
DB-level money backstop.

#### 1.4 `business_level` and the reports path

`business_level` is **not** derived from `purchased`. `src/data/shift.ts:98-101`:
`businessLevelForShifts(n) = 1 + Math.floor(n / 3)`, uncapped, written at
`child-profiles.ts:171-181`. The dependency runs the other way: `business_level` gates purchases via
`upgrade.requiredWorldLevel` (`upgrades.ts:147,162`). **The field named `requiredWorldLevel` is
compared against a shift counter that has nothing to do with worlds** — a misnomer that hides the
single-world assumption, and a naming trap in the tests too (`tests/upgrades.test.ts:64,92-93` say
"world level" and mean `businessLevel`).

`src/lib/services/reports.ts` never reads `shop_state`. It reads
`shift_log.select("skills, upgrade_purchased")` (`:107-112`) and resolves each id against the same
global catalogue via `getUpgrade(id)` (`:23-29`). Two consequences: historical parent reports
**retroactively rewrite themselves** if catalogue metadata changes, and `shift_log.upgrade_purchased`
is `text null` with no FK and is written best-effort with errors swallowed
(`child-profiles.ts:127-137`) — so `shop_state.purchased` and the purchase history **can legitimately
diverge**. `shift_log` has no world column either; the parent report is world-blind by construction.

### 2. `theme`, the catalogues, and what actually renders after a flip

#### 2.1 `src/data/worlds.ts` (44 lines)

```ts
export interface World { slug: string; name: string; image: string; }
```
That is the **entire** per-world payload. No colours, no palette, no product names, no currency, no
copy, no per-world task flavour. Currency is globally "zł" (`src/i18n/pl.ts:211`).

Four worlds: `kawiarnia` / *Kawiarnia* (= `DEFAULT_WORLD`, the fallback for the `'default'` DB
value), `piekarnia` / *Piekarnia*, `galaktyczna-baza` / *Galaktyczna baza*, `sklep-ksiegarnia` /
*Sklep księgarnia*. The header comment (`worlds.ts:9-10`) records that the mockup labels the fourth
one **"Sklep kolekcjonera"** and that slug/art were reconciled to `sklep-ksiegarnia`.

**`WORLD_SLUGS` — confirmed, and with a caveat the planner needs.** It exists
(`worlds.ts:34`) and is typed `[string, ...string[]]`:
```ts
export const WORLD_SLUGS = WORLDS.map((w) => w.slug) as [string, ...string[]];
```
It is **not** a literal union — `WORLDS` is typed `readonly World[]` (widened) before `.map`, so the
`as const` contributes nothing to slug literal types. Its only production consumer is
`src/pages/api/profiles/create.ts:29`, and it uses **`refine`, not `z.enum`**, deliberately:
```ts
// Closed-set membership via refine (robust across zod versions).
theme: z.string().refine((v) => (WORLD_SLUGS as readonly string[]).includes(v)),
```
(Contrast `upgradeId: z.enum(UPGRADE_IDS)` at `buy.ts:17`. Both idioms exist in the repo; the
`theme` one is the deliberate choice, and a new endpoint should mirror it rather than switch to
`z.enum`, which would require slug literal types.) Also asserted by
`tests/data-lookups.test.ts:2,31-33`. **`DEFAULT_THEME` has zero consumers.**

#### 2.2 `src/data/upgrades.ts` — one shared catalogue, world-neutral by design

**Answer to "per world or one catalogue": one flat, shared, world-agnostic catalogue**, stated in
the file at `upgrades.ts:8-9` — *"v1 is a single shared catalog for the current single world
(per-world catalogs are the multi-world tranche)."* `Upgrade` (`:17-41`) has
`id, nameKey, cost, requiredWorldLevel, extraTasks, art, order, requiredSkill?, requiredTaskHistory?`
— **no world key anywhere**.

| id | copy (`src/i18n/pl.ts:269-274`) | cost | reqLevel | +tasks | art | extra gate |
|---|---|---|---|---|---|---|
| `sign` | Szyld — "Nowy szyld przyciąga wzrok." | 30 | 1 | 0 | `upgrade-sign.svg` | — |
| `shelf` | Półka — "Więcej miejsca na towar." | 60 | 1 | 1 | `upgrade-shelf.svg` | — |
| `register` | Lepsza kasa — "Sprawniejsza obsługa klientów." | 100 | 2 | 1 | `upgrade-register.svg` | skill `money` ≥ 1 |
| `slot` | Miejsce na produkt — "Dodatkowy produkt w ofercie." | 150 | 2 | 1 | `upgrade-slot.svg` | — |
| `storage` | Magazynek — "Zapas towaru pod ręką." | 210 | 3 | 1 | `upgrade-storage.svg` | — |
| `customers` | Więcej klientów — "Do sklepu zagląda więcej osób." | 300 | 3 | 1 | `upgrade-customers.svg` | task history `math` ≥ 8 |

**No upgrade's name or art assumes the café.** There is no "ekspres do kawy" anywhere in the repo —
the vocabulary is generic retail, and `public/illustrations/slice-map.md:25` states the intent
outright: the SVGs are *"scalable, **theme-neutral**, swappable for per-world art later."* Copy is
resolved through the tolerant `upgradeCopy(id)` (`src/i18n/index.ts:34-36`), which falls back to the
raw id for an unknown entry.

#### 2.3 Every read of `theme` — three, all render-time

| file:line | code | drives |
|---|---|---|
| `src/pages/app/start.astro:33` | `const world = profile ? worldForTheme(profile.theme) : null;` | `world.name` heading (`:103`), `<ShopArt world={world} …>` (`:107`) |
| `src/pages/app/task.astro:27` | `const world = worldForTheme(profile.theme);` | `AppShell subtitle` (`:42`), `<ShiftScreen world={world} …>` (`:54`) → `StoryHeader` chip |
| `src/pages/app/upgrades.astro:28` | `const world = profile ? worldForTheme(profile.theme) : null;` | `subtitle` (`:39`), `<UpgradeShop world={world} …>` (`:55`) → `ShopArt` |

**Nothing is denormalized from `theme`.** The creation insert (`child-profiles.ts:58-72`) writes
`account_id, name, age, avatar, theme, starting_level`, and `starting_level` derives from **age**
(`deriveStartingLevel(age)`, `create.ts:70`), not theme. The shift generator ignores the world
entirely (`counting-tasks.ts:50-57` hardcodes `objectType: "coin"`; task copy is generic "towar" /
"monety", `pl.ts:231-262`). The buy route never sees theme.

Non-profile `world` reads worth knowing: `src/i18n/pl.ts:112-117` `marketing.worlds` is a **second,
duplicated** list of the same four name+image pairs, in a **different order**, not derived from
`WORLDS`, rendered by `AuthShell.astro:81-84` and `Welcome.astro:85-88`.

#### 2.4 The concrete trace: café → bookshop with all six upgrades owned

`ShopArt.tsx:18-26` is the whole resolution logic:
```ts
const DEFAULT_SLOTS = { sign:{left:"10%",top:"6%"}, shelf:{left:"6%",top:"44%"},
  register:{right:"7%",top:"46%"}, slot:{left:"44%",bottom:"5%"},
  storage:{left:"6%",bottom:"7%"}, customers:{right:"6%",bottom:"7%"} };
const WORLD_SLOTS: Partial<Record<string, Partial<Record<string, CSSProperties>>>> = {};
```
`WORLD_SLOTS` is an **empty object literal** — the theme × upgrade-id table exists structurally with
zero entries, so every world (including `kawiarnia`) falls through to `DEFAULT_SLOTS`. Art is keyed
by **upgrade id alone** (`u.art`, a literal string in the catalogue). **There is no
`${world.slug}` in any `src=` anywhere in the codebase.**

So, flipping `theme` to `sklep-ksiegarnia` today:

- **Base image**: `/illustrations/world-sklep-ksiegarnia.webp` — exists (72 KB). All four slugs have
  a committed `.webp` (`world-kawiarnia` 42 KB, `world-piekarnia` 46 KB, `world-galaktyczna-baza`
  61 KB). **No broken image.**
- **Overlays**: the identical six SVGs at the identical six percent positions. No
  `upgrade-<world>-<id>.svg` variant exists or is looked up. The 4 × 6 cross product does not exist
  and is never requested.
- **Copy**: `world.name` flips to "Sklep księgarnia" in the heading, the AppShell subtitle and the
  `StoryHeader` chip. Upgrade names/descs are unchanged and already world-neutral.
- **Wallet, level, purchased list, skill state, next-upgrade nudge, shift length**: all unchanged and
  all still correct — none of them read `theme`.

**Verdict: a theme flip is functionally lossless.** The failure modes are, in ascending order of
seriousness:

1. *Aesthetic/positional.* Six coordinates tuned against one scene; `sign: {left:"10%",top:"6%"}` is
   "above the shop door", which is not where a door is on the space-base plate. `WORLD_SLOTS` is the
   seam that fixes this and it is one object literal away.
2. *Semantic, and only at one margin.* "Lepsza kasa" and "Więcej klientów" read fine in a bakery or
   a bookshop; they read oddly in `galaktyczna-baza`. This is a pre-existing strain of shipping one
   retail catalogue across four worlds — it is not created by the switch, only made visible by it.
3. **Motivational, and this is the real one.** After a switch the new world opens **fully furnished
   and unbuyable**: `canBuy` returns `owned` for everything (`upgrades.ts:145`), `nextUpgrade`
   returns `null` (`:163`), the dashboard nudge disappears (`start.astro:173`) and the shop rail
   falls to `t.upgradeShop.allOwned` (`UpgradeShop.tsx:242-243`). The child changes world to find a
   context they care about and arrives at a finished shop with no goal.

### 3. The write path to mirror

#### 3.1 `src/pages/api/profiles/create.ts` — how `theme` is set today

- `export const prerender = false;` (`:16`).
- Client obtained **inside the route**, not from `context.locals`:
  `createClient(context.request.headers, context.cookies)` (`:33`); on `null` → redirect with
  `t.auth.serverError.notConfigured`. Note: `context.locals.user` exists (middleware sets it) but
  **no API route uses it** — every route re-does `createClient(...)` + `auth.getUser()` (`:38-43`).
- Zod over **formData**, field by field (`:45-51`); `theme` validated by `refine` over `WORLD_SLUGS`
  (`:29`, quoted in §2.1).
- `account_id` from the session, never the client (`:63-71`); RLS `child_profiles_insert_own` is the
  backstop.
- Success: `setActiveProfileCookie(context.cookies, created.id)` then `redirect("/app")` (`:78-79`).
  Failure: always a redirect to `/app/new-profile?error=<encodeURIComponent(polish)>`, read back at
  `new-profile.astro:12`. Every response wrapped in `applyNoStore` (`src/lib/http.ts:19`).

#### 3.2 `select.ts` — the closest template for a form-POST world change

`prerender = false` (`:7`); `z.object({ profileId: z.uuid() })` (`:12-14`); formData (`:35-39`); on
parse failure → `redirect(PICKER)` with **no error param** (documented "no error leak", `:9`);
**ownership proven by re-resolving through the RLS client** (`:41-44`):
```ts
const profile = await resolveActiveProfile(supabase, parsed.data.profileId);
if (!profile) return applyNoStore(context.redirect(PICKER));
```
`delete.ts` is the alternative JSON-returning idiom, with a documented gate order
(`503 → 401 → 403 parent-PIN → 400 zod → 404 → 500 → 200`, `delete.ts:21-24`) and machine reasons
rather than i18n in the body. **Rule of thumb the repo follows:** form-POST + redirect when a full
page navigation follows (`create`, `select`); `json()` + status codes when a mounted island calls it
(`delete`, `upgrades/buy`). No route in the repo parses a JSON body.

#### 3.3 The wizard's world picker, and what is reusable

`src/components/child/CreateProfileWizard.tsx` (321 lines), mounted `client:load` at
`new-profile.astro:26`. It submits as a **native same-origin form POST**, not `fetch`
(`:98-103`), with always-mounted hidden inputs (`:105-108`) — the world field is
`<input type="hidden" name="theme" value={theme} />`. The picker itself (`:242-259`):
```tsx
<div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
  {WORLDS.map((w) => (
    <SelectTile key={w.slug} shape="card" selected={theme === w.slug}
      onSelect={() => { setTheme(w.slug); clearError("theme"); }}
      image={w.image} alt={w.name} label={w.name} />
  ))}
</div>
```
**`SelectTile` (`src/components/child/SelectTile.tsx:20-45`) is reusable as-is** — a generic
controlled component whose docblock already says `shape="card"` is for world tiles. The wizard
component is not (it is a 3-step create flow bound to `/api/profiles/create`). A worlds screen can be
pure Astro + a form POST per card (mirroring `pick-profile.astro:38-51`, which needs no React), or a
small island reusing `SelectTile` + `ChildButton` if the mockup's confirm step is wanted — and the
mockup does show one (see §6).

i18n already in place: `t.profileWizard.interestLabel` ("Zainteresowania", `pl.ts:165`),
`validation.interestRequired` ("Wybierz świat", `pl.ts:180`), and — **the shipped promise** —
`pl.ts:169` `note: "Świat możesz zmienić później. …"`.

#### 3.4 Service layer and the active profile

`src/lib/services/child-profiles.ts` contract (`:9-15`): every function takes the request-scoped SSR
client so queries run as the authenticated parent; **no manual `account_id` filtering**. Functions:
`createChildProfile:58`, `countChildProfiles:75`, `resolveLandingPath:87`, `listChildProfiles:94`,
`deleteChildProfile:111`, `appendShiftLog:127` (private), `recordShiftResult:157`, `buyUpgrade:212`.
`ChildProfile` at `:26-46` (`theme: string` at `:32`); `MAX_PROFILES_PER_ACCOUNT = 6` at `:55`.

The shape an `updateProfileTheme` should copy is `deleteChildProfile`'s single-statement idiom
(`:114`), which distinguishes not-owned from success without a prior read:
```ts
const { data, error } = await client.from("child_profiles").delete().eq("id", profileId).select("id");
if (error) return { error };
if (data.length === 0) return { failure: "not-found" };
```
Result vocabulary to mirror: `DeleteProfileResult = { ok: true } | { failure: "not-found" } |
{ error: PostgrestError }` (`:99`). (The heavier read-then-update shape is at `:165-184`.)

**Active profile**: `src/lib/services/active-profile.ts` — cookie `ACTIVE_PROFILE_COOKIE =
"active_profile"` (`:13`), documented as *"ONLY a profile id — a pointer, not a credential"*
(`:5-11`), session-lifetime, `httpOnly`, `sameSite: "lax"`. Helpers `resolveActiveProfile:23`,
`setActiveProfileCookie:33`, `readActiveProfileId:44`, `resolvePageProfile:56-64` (the fallback
ladder pages use, which matches the selection **inside** the owned list so a foreign id can never
resolve). **Implication:** a change-world endpoint should resolve the target server-side from the
cookie rather than trusting a client-sent `profileId`; if it does accept one (island-prop style, as
`buy.ts` does), the RLS `.eq("id", …)` update is still safe — it affects zero rows for a foreign id.

**No migration is needed for the write itself**: `child_profiles_update_own` already exists
(`20260609120000_child_profiles_isolation.sql:90-95`, `using` + `with check` on
`auth.uid() = account_id`).

### 4. Routing and navigation

**Gating — verified, stated plainly.** `src/middleware.ts:5` is
`const PROTECTED_ROUTES = ["/app"];` and `:42` matches with
`PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))`. **`/app/worlds` is
already gated. No middleware edit is required.** The middleware also sets `context.locals.user`
(`:26-36`), bounces authed users off the auth form pages (`:38-40`) and applies `applyNoStore` to
`/auth*`, `/api/auth*`, `/app*` (`:18-24,48-49`). It does **not** do parent-PIN gating or
active-profile resolution — both are per-page:

- Parent-PIN is page-local (`report.astro:28-29`). A `/app/worlds` screen is a **child** surface and
  should not carry it.
- The active profile is page-local; every child page repeats
  (`start.astro:28-31`, `upgrades.astro:23-26`, `task.astro:21-25`):
  ```ts
  const supabase = createClient(Astro.request.headers, Astro.cookies);
  const resolved = supabase ? await resolvePageProfile(supabase, Astro.cookies) : { profile: null, profileCount: 0 };
  if (!resolved.profile && resolved.profileCount >= 2) return Astro.redirect("/app");
  ```
  `task.astro` uses the stricter variant; `start`/`upgrades` render `<EmptyStateCard />` for the
  zero-profile branch instead of redirecting. The plan must pick one of these two postures.

**Nav.** `src/components/app/AppShell.astro`:
- union at `:36-38` — `active: "dashboard" | "missions" | "shop" | "parent";`
- `:59-65`:
  ```ts
  const items = [ {key:"dashboard",href:"/app/start",…}, {key:"missions",href:"/app/task",…},
                  {key:"shop",href:"/app/upgrades",…} ] as const;
  const tabs = [...items, {key:"parent",href:"/app/report",…}] as const;
  ```
- sidebar `:70` `hidden … lg:flex` (loop `:101-117`, parent pinned separately `:119-130`); bottom bar
  `:186-205` `lg:hidden` iterating `tabs`. Docblock `:12-19` states the binding constraint: **both
  navs always render and toggle purely with `hidden`/`lg:hidden`** so only one copy of each
  accessible name is in the a11y tree — do not conditionally render one.
- Call sites, all four: `start.astro:79` `dashboard`, `task.astro:43` `missions`,
  `upgrades.astro:40` `shop`, `report.astro:55` `parent`. No e2e spec references nav labels.

**Adding a fifth entry entails exactly:** widen the union (`:38`); add one object to `items` plus its
`lucide-react` icon import (`:2`); add `t.nav.items.worlds` to `src/i18n/pl.ts:133-138` (the block
whose comment at `:124` already states *"only destinations that exist as routes are listed (no dead
nav)"*); pass `active="worlds"` from the new page. The four existing call sites need **no edit** —
the union only widens. **Layout caveat:** because the mobile bar renders `tabs` (= `items` + parent),
a fifth `items` entry makes it a **5-tab** `justify-around` bar with `text-[0.7rem]` truncating
labels, alongside "Panel rodzica" and "Mój sklep". The mockup's own sidebar has seven entries, so the
mockup is no help here; this is a real layout decision for the plan.

### 5. The purchased-upgrades question — options with consequences

**Not decided here.** Laid out for the planner, who must choose one and record it.

**The two facts that frame every option:**
(a) the switch itself is functionally lossless (§2.4) — nothing is *broken* by carrying purchases
forward; (b) **the data to split purchases by world was never captured** (§1.2), so any per-world
option must decide what the existing flat list *means* for legacy rows.

**What the PRD actually says.** It never mentions world switching — it was written single-world
(`prd-v3.md:40,98`), and the archived plan that introduced `shop_state` deferred the question
explicitly (`context/archive/2026-07-01-upgrade-choice-and-growth/plan.md:30`). But its guardrails
constrain the answer hard:

- `prd-v3.md:76` — *"**Spending never regresses competence**: a child may spend funds, but spending
  never reduces their level, world level, or recorded skill progress."*
- `prd-v3.md:85` (US-01) — *"…all without ever reducing their level or skill progress."*
- `prd-v3.md:92` — *"on return the grown shop and purchase persist **for that profile**"* — note:
  profile-scoped, not world-scoped.
- `prd-v3.md:102` (FR-008) — *"spending reads as **acquiring a permanent upgrade**, not losing
  coins."*
- `shape-notes.md:152-154` — *"the permanent, monotonic win the child sees is the **owned upgrades +
  grown shop**, never a shrinking number"*; *"Progress the child perceives … is **always
  monotonic**."*
- `prd-v3.md:180` (open risk) — *"The 'wallet + owned-upgrades as the permanent win' framing is the
  **chosen mitigation** for the risk that a 6-year-old reads a dropping balance as losing progress."*
- The one line pointing the other way — `prd-v3.md:106` (FR-010): *"**The world** defines a small
  upgrade catalog (5–8 upgrades)"*, repeated at `shape-notes.md:160`. Grammatically the catalogue
  belongs to the world; the shipped implementation has one global catalogue.
- `prd-v3.md:131` — any data migration must carry existing state over **without loss**, with a
  rollback path.

**Non-repo design handoff** (`assets/app-docs-v2-llm-handoff/`, gitignored, product guidance not
PRD — weigh accordingly): its data model puts `unlockedUpgrades` on **`WorldState`** (per child ×
world) and `virtualBalance` on **`ChildProfile`** (global), and its `Upgrade` carries a `worldId`
(`05_BUSINESS_LOGIC_AND_DATA_MODEL.md:83-95,196-207`). `08_SHOP_AND_WORLD_PROGRESSION.md` maps the
same stage ladder onto six worlds with different objects per world, and states the rule
*"Wydanie wirtualnych środków nie może cofać poziomu dziecka ani poziomu świata"*. So the intended
end-state is **money global, purchases per world** — but that is the multi-world tranche's shape,
not a commitment binding on F5.

---

#### Option A — keep purchases global (status quo)

- **Data**: nothing changes. No migration, no shape change, no normalizer.
- **Child sees**: the new world's art with the same six overlay icons at the same six coordinates —
  coherent, because no upgrade is café-specific (§2.2), but positioned for a different scene. The
  dashboard still says "N ulepszeń" counting the old world's furniture (`start.astro:68`). **And the
  new world is finished on arrival**: nothing to buy, `nextUpgrade` → `null`, no goal, no nudge.
- **Build cost**: lowest. Screen + endpoint + nav only.
- **Forecloses**: nothing structurally — but it burns the *first* switch, which is the one that
  matters. A child who switches once and finds an empty loop may not switch again. It also silently
  ratifies "worlds are pure skins", which `06_GUARDRAILS_AND_PRODUCT_RULES.md:214` names as a
  product red flag (*"wszystkie światy są tylko skórką bez znaczenia edukacyjnego"*).

#### Option B — scope purchases per world

- **Data**: **no DDL required** — `shop_state` is jsonb and the RLS policies are column-agnostic. The
  shape becomes e.g. `{ purchased: string[], byWorld: { [slug]: string[] } }` or
  `{ worlds: { [slug]: { purchased: string[] } } }`. But three decisions become load-bearing:
  (1) what the **legacy flat list** means — the honest reading is "these belong to the profile's
  current `theme` at migration time", which is recoverable *because* `theme` has never been mutable;
  (2) whether to write a migration file at all (a jsonb backfill `update … set shop_state = …` is
  possible and would be non-destructive, or the normalizer can do it lazily in `readPurchased`);
  (3) **what happens to money already spent** — the PRD's "spending never regresses" line
  (`prd-v3.md:76`) argues the wallet must *not* be refunded (that would make the balance
  non-monotonic upward in a way that teaches the wrong lesson) but the child must also not be asked
  to re-earn 650 zł of furniture to make the new world habitable.
- **Child sees**: an honest new shop — empty, with a full goal ladder, and the old world's shop
  intact if they switch back. This is the only option where switching back is meaningful.
- **Build cost**: highest. Every consumer in §1.1 changes signature or call site (12 reads), the
  write at `child-profiles.ts:250`, `UPGRADE_IDS` validation in `buy.ts`, and the `purchased.length`
  stat. `tests/upgrades-buy.test.ts` (11 assertions on the flat shape) and
  `tests/cross-device-restore.test.ts:117` must be rewritten. Realistically a multi-phase plan.
- **Forecloses**: little; it is the direction the design handoff and FR-010 point. Its cost is that
  it front-loads the multi-world tranche's data work into a screen-shaped change — which may be the
  wrong slice boundary for F5.

#### Option C — reset on switch

- **Data**: `shop_state.purchased = []` on write. Trivial.
- **Child sees**: the furniture they earned disappears. **This is the option the PRD argues against
  most directly** — it removes the exact thing `prd-v3.md:180` designates as the permanent win and
  the named mitigation for the 6–9 age band, and violates the monotonic-perceived-progress guardrail
  (`shape-notes.md:152-154`). Refunding the coins does not repair it: `shape-notes.md:153` says the
  win is *the owned upgrades*, not the balance.
- **Build cost**: lowest of all.
- **Forecloses**: trust. Also creates an inconsistency the tests will surface —
  `shift_log.upgrade_purchased` history (and therefore the parent report,
  `tests/reports.test.ts:94`) still names upgrades the child no longer owns.
- Include it in the plan's record as **considered and rejected**, with the PRD lines cited; do not
  ship it.

#### Option D — keep purchases, re-skin per world

- **Data**: none. Purely presentational.
- **Child sees**: the same owned upgrades, drawn correctly for the new world — a `Półka` that looks
  like a bakery shelf on the bakery plate, positioned right. Fixes failure mode 1 and 2 from §2.4.
  **Does not fix failure mode 3** (nothing left to buy).
- **Build cost**: fill `WORLD_SLOTS` (`ShopArt.tsx:26`) with 4 × 6 coordinate entries — cheap; add
  per-world upgrade art — expensive, and `assets/` is gitignored so new crops must land in
  `public/illustrations/` and be registered in `slice-map.md`. Per-world *copy* would need the i18n
  key to gain a world dimension (`t.upgrades[id]` → `t.upgrades[world][id]`), touching
  `upgradeCopy()` and `WeeklyReport.tsx:227-230`.
- **Forecloses**: nothing. **Composes with A or B** — it is orthogonal, and the coordinate half
  (`WORLD_SLOTS`) is arguably the cheapest real improvement available in this change.

#### Option E — global now, but start recording the world on each purchase

- **Data**: `shop_state` gains sibling keys the write already preserves
  (`{ ...current.shop_state, purchased }` at `child-profiles.ts:250` keeps unknown keys), e.g.
  `purchasedMeta: { [id]: { world, at } }`; or `shift_log` gains a `world` column (that one *is* a
  migration, and F4 is already opening `shift_log` — see §8).
- **Child sees**: nothing. Behaviourally identical to option A.
- **Build cost**: one line in the write path plus a test; no consumer changes.
- **Forecloses**: nothing — it **preserves** option B. This is the answer to *"the data to partition
  was never captured"*: it stops the gap growing while the product decision matures.
- **Cost of not doing it**: every purchase made between now and the multi-world tranche is another
  row that can never be attributed to a world.

### 6. The mockups

Both PNGs were opened with the Read tool.

**`assets/matmaverse-ui-v2-web/01-world-selection-web.png`** — three-column shell: sidebar, content,
right rail.
- Header: **"Wybierz swój świat"** (large, bold) with sub-line **"Ucz się matematyki przez decyzje"**.
- **Grid: 3 columns × 2 rows = six world cards.** Each card is a white rounded panel: a rounded
  interior-scene image on top, then a row with a small coloured glyph + the world name in bold
  (Piekarnia · Kawiarnia · Galaktyczna baza · Sklep kolekcjonera · Salon kreatywny · Laboratorium
  wynalazków).
- **Selection marker**: the selected card (Kawiarnia) gets a **blue 2px ring around the whole card**
  plus a **blue circular white check badge at the image's top-right corner**. Unselected cards have
  no ring and no badge.
- **Footer line under the grid**, centred, with a small shield glyph: **"Każdy świat uczy tych samych
  umiejętności"** — the reassurance the change is *for*.
- **Right rail (the explanatory panel)**: a large preview image of the *currently selected* world,
  then the heading **"W tym świecie nauczysz się:"** and three icon+text rows —
  **Matematyka** ("Dodawaj, odejmuj, licz resztę i pracuj z cenami."), **Handel** ("Zarządzaj
  produktami, cenami i zyskami."), **Decyzje** ("Planuj inwestycje i rozwijaj swój biznes.") — then a
  full-width primary **"Start"** button with a chevron. So the mockup has an **explicit confirm
  step**: selecting a card updates the rail; the button commits.
- Top bar (existing chrome, not new): profile chip "Ania / Poziom 3" with a progress bar, a coin pill
  "126 zł", a bell with a badge. Sidebar shows seven entries with **"Światy"** active — note the
  mockup's sidebar (Start · Zadania · Mój sklep · Postępy · Nagrody · Światy · Panel rodzica) is
  richer than the shipped four; only "Światy" is in scope here, and the "no dead navigation" rule
  forbids adding the rest.

**`assets/matmaverse-ui-v2-mobile/01-world-selection-mobile.png`** — the reflow.
- Header block: **"Wybierz swój świat"** with sub-line **"Co chcesz dziś prowadzić?"** (different
  sub-line from web).
- **Grid: 2 columns × 3 rows, same six worlds**, cards are square art + bold centred label beneath.
  Selection marker identical: blue ring + blue check badge top-right.
- The right rail collapses to **one horizontal strip card** with three divider-separated items —
  icon + **Matematyka** | **Handel** | **Decyzje** — no descriptions.
- Full-width primary **"Dalej"** button at the bottom (web says "Start", mobile says "Dalej").
- Top: avatar + "Cześć, Ania!" + a "Poziom 3" chip + a "126 zł" coin pill. **No bottom tab bar is
  drawn** — the CTA occupies that space.
- The mobile card art is a *different style* from web: storefront/building icons rather than interior
  scenes. The shipped `world-*.webp` files are single images used for both.

**The count: the mockup draws SIX worlds, both web and mobile. The catalogue ships FOUR.** And the
naming diverges on one: the mockup's *"Sklep kolekcjonera"* is `sklep-ksiegarnia` / *"Sklep
księgarnia"* in code (`worlds.ts:9-10` documents the reconciliation). Missing entirely: *Salon
kreatywny* and *Laboratorium wynalazków* — no slug, no art. Per the run's **"no invented data"** rule
the plan must not draw placeholder worlds; it must state whether F5 ships 4 and treats the gap as
content work, or blocks. `assets/app-docs-v2-llm-handoff/04_SCREENS_AND_DESIGN_MAPPING.md:11-26`
confirms the screen's rules: no gender split, world chosen by interest, *"karta świata ma obraz,
nazwę i stan wyboru"*, *"panel podglądu wyjaśnia wartość edukacyjną"*.

### 7. The test surface

**Baseline verified**: 299 unit (`npm test` → `vitest run`; 297 static `it(`/`test(` + a 3-case
`it.each` at `tests/auth-confirm.test.ts:90`), 15 Playwright (13 specs on `desktop` + the 2
`gameplay-restore` tests re-run on `touch`, which is `devices["Galaxy Tab S4"]`). Configs:
`vitest.config.ts:34` (`tests/**/*.test.{ts,tsx}`, node env, `fileParallelism: false`),
`playwright.config.ts` (`testDir: "./e2e"`, `locale: "pl-PL"`, `touch` project restricted by
`testMatch: /gameplay-restore\.spec\.ts/`).

**World / `theme` coupled:**

- `tests/data-lookups.test.ts` — the only world-resolver suite. `:15` every slug resolves to itself;
  `:19` `worldForTheme("default") === DEFAULT_WORLD` (the DB column default); `:22` an unknown slug
  falls back; `:32` `WORLD_SLUGS` mirrors `WORLDS`. **Adding worlds 5–6 keeps this green**; renaming
  or removing a slug breaks it.
- `tests/profiles-create.test.ts:68,81` assert `theme` is written verbatim (`"kawiarnia"`,
  `"piekarnia"`); `:106-107` pins the closed-set rejection (`theme: "nope"` → redirect to
  `/app/new-profile?error=`). **A change-world endpoint should reuse the same closed set or this
  contract drifts.**
- `tests/task-guardrail.test.tsx:8,174` uses `DEFAULT_WORLD` only for the `World` shape — breaks only
  if `World` gains required fields.
- Seed-only `theme: "kawiarnia"` (not asserted): `shifts-complete.test.ts:57`, `app-router.test.ts:20`,
  `active-profile.test.ts:40`, `account-deletion.test.ts:42`, `profile-deletion.test.ts:44`,
  `upgrades-buy.test.ts:61`, `e2e/helpers/accounts.ts:54`.
- `tests/child-profiles-isolation.test.ts:26-40` declares the row interface (`theme: string;
  shop_state: Record<string, unknown>;`) — a shape change needs a type update.

**`purchased` coupled (the dense cluster — everything a per-world reshape breaks):**

- `tests/upgrades.test.ts` (24 tests) — pins the normalizer literally at `:38-41`
  (`readPurchased(undefined|null|{}|{purchased:[…]})`), the `owned` rung at `:62`, the level lock at
  `:64`, rung precedence at `:92-93`, `nextUpgrade` at `:126`.
- `tests/upgrades-buy.test.ts` (11 tests) — the **highest-count coupling to the flat shape**: seeds
  `shop_state: { purchased: … }` at `:64`, asserts the array at `:109,113,126,139,156,167,178,192,206,221,253`.
- `tests/cross-device-restore.test.ts:117` — `expect(profile?.shop_state.purchased).toEqual(["sign"])`.
  If purchases go per-world, this test must encode *which world's* purchases restore.
- `tests/reports.test.ts:94`, `tests/report-isolation.test.ts:56` — read
  `shift_log.upgrade_purchased`. **If the world change resets purchases, these historical rows still
  name them** — the inconsistency in §5 option C, surfaced by tests.
- `tests/shift-log-isolation.test.ts:91,104`; `tests/shifts-complete.test.ts:153,235`;
  `tests/i18n-helpers.test.ts:25-34` (the `upgradeCopy("ghost-upgrade")` tolerance a reset would rely
  on).
- `e2e/gameplay-restore.spec.ts:88` seeds `shopState: { purchased: ["sign"] }`, then asserts the
  next-goal string at `:111` and `t.upgradeShop.ownedTag` at `:113`; `:62-68` is the buy flow.
- **There is no test on `ShopArt`.**

**The wizard e2e and locator collisions.** `e2e/onboarding.spec.ts:20` is the only end-to-end wizard
run; its world locator is `:74`
`await page.getByRole("button", { name: WORLDS[0].name }).first().click();` — and that `.first()` is
one of only **three sanctioned positional exceptions** in `e2e/CLAUDE.md`. Two protections and one
hazard:

- The wizard page `/app/new-profile` **does not render `AppShell`** (only `start`, `task`, `upgrades`,
  `report` import it), so a new nav entry cannot land on that page. `:74` is safe.
- `getByRole(…, { name })` matches the **full** accessible name, so nav labels are low-risk.
- The hazard is `getByText`, which matches substrings: `e2e/seed.spec.ts:29`
  `getByText(t.start.walletLabel)` = "Portfel" on `/app/start`, and `gameplay-restore.spec.ts:113`
  `getByText(t.upgradeShop.ownedTag)` = "Masz to" on `/app/upgrades`. This class of break has
  happened before and is recorded at `context/changes/web-shell-and-mockup-parity/handoff.md:80-82`.
  Also note `src/i18n/pl.ts:180` already contains **"Wybierz świat"** — the mockup's heading is
  "Wybierz swój świat", which *contains* it as a substring; different pages today, but worth naming.
- `touch` runs only `gameplay-restore.spec.ts` (`/app/start` + `/app/upgrades` below `lg`), so the
  bottom tab bar is the visible nav there. A fifth tab changes that bar's layout under the exact
  viewport that project uses.

**Seeding: no new fixture is needed.** `e2e/helpers/accounts.ts:33-46` already exposes
`SeedProfileOptions { name, age, avatar, theme, walletBalance, completedShiftCount, businessLevel,
shopState }` with `seedChildProfile(accountId, options)`, defaulting `theme: "kawiarnia"` (`:54`) and
spreading `shop_state` only when provided (`:58`). **Both a theme and a purchased list are already
seedable for a world-switch e2e.** On the vitest side there is no shared profile-seeding helper —
each suite inlines its own (`shifts-complete.test.ts:54`, `upgrades-buy.test.ts:52`);
`tests/helpers/supabase.ts` provides `createSignedInUser`, `deleteUser`, `findUserIdByEmail` and the
service-role `admin` client.

### 8. Migration: needed or not

**For the screen and the theme write: no.** `theme` already exists (`text not null default
'default'`, no CHECK), and `child_profiles_update_own` already permits the UPDATE. Nothing new is
persisted.

**For per-world purchases (§5 option B): no DDL, but a data-shape decision that deserves the same
rigour.** `shop_state` is jsonb with no shape constraint, and the four `child_profiles` policies are
column-agnostic, so RLS needs no change (the same reasoning is already on record at
`context/archive/2026-06-30-visible-shop-growth/research.md:34` and
`context/archive/2026-07-01-upgrade-choice-and-growth/plan.md:73-75`). If the plan nevertheless wants
a migration file — for a backfill or a documented default change — it would look like the existing
`20260701130000_child_profiles_shop_state_default.sql`: a single `alter column … set default`, plus
(new) an idempotent `update public.child_profiles set shop_state = jsonb_build_object('worlds',
jsonb_build_object(theme, shop_state->'purchased')) where …`, with a header comment naming the four
existing policies and stating explicitly that no new policy is required and why. **`prd-v3.md:131`
requires a rollback path**, which for a jsonb reshape means keeping the legacy `purchased` key
readable rather than deleting it.

**For §5 option E (recording the world on each purchase):** a sibling jsonb key needs no migration at
all. A `shift_log.world` column *would* need one — and note F4 (`world-progression-stages`) is
already planning to open `shift_log` for an earnings column, so if both are wanted they should share
one migration rather than two.

## Code references

- `src/data/worlds.ts:12-43` — the entire world model: `{slug,name,image}`, 4 worlds, `WORLD_SLUGS`
  as `[string, ...string[]]`, `worldForTheme` fallback.
- `src/data/upgrades.ts:8-9` — "single shared catalog … per-world catalogs are the multi-world
  tranche"; `:46-105` the six upgrades; `:116-119` `readPurchased`; `:144-158` `canBuy`; `:161-165`
  `nextUpgrade`; `:168-171` `shiftBonusTasks`.
- `src/components/child/ShopArt.tsx:18-26` — `DEFAULT_SLOTS` and the **empty** `WORLD_SLOTS`;
  `:36-49` the composite render.
- `src/lib/services/child-profiles.ts:238-253` — the only `shop_state` write, recording no world and
  no timestamp; `:111-121` the single-statement update idiom to copy; `:157-184` the read-then-update
  idiom.
- `src/pages/api/profiles/create.ts:16,25-30,45-51,63-79` — `prerender`, the zod schema with
  `refine` over `WORLD_SLUGS`, formData parsing, session-derived `account_id`, cookie + redirect.
- `src/pages/api/profiles/select.ts:41-44` — ownership by re-resolution through the RLS client.
- `src/lib/services/active-profile.ts:13,56-64` — `active_profile` cookie and `resolvePageProfile`.
- `src/middleware.ts:5,42` — `PROTECTED_ROUTES = ["/app"]` matched with `startsWith`.
- `src/components/app/AppShell.astro:36-38,59-65,70,186-205` — the union, `items`/`tabs`, and the
  `hidden`/`lg:hidden` toggling.
- `src/i18n/pl.ts:133-138` nav copy · `:169` the shipped "Świat możesz zmienić później" promise ·
  `:180` "Wybierz świat" · `:269-274` upgrade copy · `:112-117` the duplicated marketing world list.
- `src/data/shift.ts:98-101` — `businessLevelForShifts`, uncapped, independent of purchases.
- `supabase/migrations/20260609120000_child_profiles_isolation.sql:55,76-101` — `theme` DDL and the
  four column-agnostic RLS policies.
- `supabase/migrations/20260630120000_child_profiles_add_gameplay_state.sql:19-29` /
  `20260701130000_child_profiles_shop_state_default.sql:14` — `shop_state` and its default.

## Architecture insights

- **The world is presentation; everything load-bearing is profile-scoped.** Level derives from shift
  count, skill state from task attempts, upgrade gates from skills and task history. The world
  contributes one image and one name. That is *why* a flip is lossless — and it is also the strongest
  in-code argument that the previous handoff's phrase "a change of costume, not a change of
  curriculum" is literally true today.
- **`requiredWorldLevel` is a misnomer** that has been hiding the single-world assumption in plain
  sight: it is compared against `business_level`, which counts shifts. Any per-world work should
  rename it or explicitly document that it is world-count-blind, or the next reader will assume the
  gate is world-aware.
- **Two independent records of the same fact.** `shop_state.purchased` (the durable set) and
  `shift_log.upgrade_purchased` (the timestamped history, best-effort, errors swallowed) can
  legitimately diverge, and nothing reconciles them. Any option that mutates `purchased` must say
  what it means for the history the parent report reads.
- **The empty `WORLD_SLOTS`** is the clearest statement of intent in the codebase: the author left
  the per-world seam in place and declined to fill it. It overrides coordinates only — a per-world
  *art* indirection has no seam at all and would be new structure.
- **The i18n dictionary already promises the feature** (`pl.ts:169`). This is not a new capability so
  much as an unpaid debt.

## Historical context (from prior changes)

- `context/changes/world-selection-screen/handoff.md` §3 — named this exact decision the headline
  risk and enumerated four options; §4 corrected the `PROTECTED_ROUTES` claim (confirmed here).
- `context/changes/web-shell-and-mockup-parity/handoff.md:147-161` (B1) — the source backlog entry:
  *"decyzja produktowa: co dzieje się z ulepszeniami i wyglądem sklepu po zmianie świata …
  to jest realna dziura projektowa, nie detal"*, and *"PRD zakłada też 6 światów; mamy 4"*. §3
  (`:65-90`) carries the no-invented-data / no-dead-nav / one-accessible-name rules and the
  "Portfel" substring-break anecdote (`:80-82`).
- `context/archive/2026-07-01-upgrade-choice-and-growth/plan.md:30,42,73-75,116-118` — the change
  that **introduced** `shop_state.purchased`: chose the flat shape, chose the tolerant normalizer,
  chose the single read + single UPDATE buy transaction, and **explicitly deferred** multi-world and
  per-world catalogues to the pillar-2 tranche.
- `context/archive/2026-06-30-visible-shop-growth/research.md:34,42-50` — established `shop_state` as
  a no-migration, no-new-RLS persistence slot and the `{slug,name,image}` world model. Its passive
  level-threshold growth was superseded by upgrade-driven growth; the render/RLS facts stand.
- `context/changes/world-progression-stages/handoff.md:88-94` (feature F4 of this same run, also
  un-researched) — warns that the shop grows today by compositing upgrade icons onto a base world
  scene and that a stage catalogue is a **new axis**: *"decide in the plan how it relates to
  `ShopArt` … rather than letting the two drift."* **F4 and F5 will collide in `ShopArt.tsx` if
  planned independently**, and F4 is already opening `shift_log` for a migration.
- `context/foundation/lessons.md` L-001 (RLS in the same migration), L-002 (test durable state, not
  the API response, when verifying a blocked write), L-003 (no inline literals — all copy via
  `src/i18n/pl.ts`). All three bear on this change.

## Related research

- `context/archive/2026-06-30-visible-shop-growth/research.md` — the world-art render path.
- `context/archive/2026-07-07-cross-device-economy-restore/` — the slice whose test now pins
  `shop_state.purchased` across devices.
- `context/archive/2026-07-01-skill-path-upgrade-gate/` — added the skill/history gates that make
  upgrade eligibility child-level rather than world-level.
- Non-repo design handoff (gitignored, product guidance, **not** the PRD):
  `assets/app-docs-v2-llm-handoff/04_SCREENS_AND_DESIGN_MAPPING.md:11-26`,
  `05_BUSINESS_LOGIC_AND_DATA_MODEL.md:83-95,196-207`, `08_SHOP_AND_WORLD_PROGRESSION.md`,
  `06_GUARDRAILS_AND_PRODUCT_RULES.md:214`.

## Open questions

1. **The purchased-upgrades decision itself** (§5). For the planner, not the implementer.
2. **4 worlds or 6.** The mockup draws 6; the catalogue has 4; two have no art and no slug. The plan
   must state which way it goes. Related: the fourth world's name diverges from the mockup
   (`Sklep księgarnia` vs `Sklep kolekcjonera`) — rename to match the mockup, or leave it?
3. **Confirm step or immediate write?** The mockup has an explicit CTA ("Start" on web, "Dalej" on
   mobile), which argues for select-then-commit, i.e. the `select.ts` form-POST-and-redirect idiom
   rather than a per-card write.
4. **The 5-tab mobile bar.** Adding "Światy" to `items` makes the bottom bar five tabs at the exact
   viewport the `touch` Playwright project uses. Acceptable, or does the entry belong somewhere else?
5. **Where does the screen redirect after a switch** — `/app/start` (so the child immediately sees
   the new world) or back to `/app/worlds`? `select.ts` redirects to `/app/start`.
6. **Zero-profile and multi-profile posture** on `/app/worlds`: the `EmptyStateCard` branch that
   `start.astro`/`upgrades.astro` use, or the redirect that `task.astro` uses?
7. **Should F5 and F4 share the `ShopArt` question**, and if F4 lands first, does its stage catalogue
   change the cost of §5 option D?
