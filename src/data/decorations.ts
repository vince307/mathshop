/**
 * Decorations — the renewing sink (E1 / D-11). Pure, client-safe and
 * dependency-free apart from the sibling catalogue (mirrors `src/data/stages.ts`
 * and `src/data/upgrades.ts`).
 *
 * **What this is for.** The upgrade catalogue is closed at eight entries and a
 * greedy player empties it in ~13 shifts; after that the wallet climbs forever
 * with nothing to buy, and FR-013's "next thing" card has nothing to name. That
 * dead state is what D-11 exists to abolish. Decorations renew it: they cost
 * money, they change the picture, and they change **nothing else**.
 *
 * **Zero economic effect, by construction and not by convention.** There is no
 * `extraTasks`, no margin, no `runningCost` field on `Decoration` — the absence
 * is structural, so a decoration cannot acquire an effect without someone
 * deliberately widening this type. It is also why decorations are legal under the
 * no-trap invariant while a zero-effect *catalogue* entry would not be: they are
 * never in `purchased`, so they never reach `shopRunningCost` or `canBuy`.
 *
 * **Two separate lists, and the separation is load-bearing.** Owned decorations
 * live in the optional `shop_state.decorations` sibling, never in
 * `shop_state.purchased`. A decoration id in `purchased` would reach
 * `shopRunningCost` and `canBuy` and recreate the very trap the invariant
 * forbids, by the back door. `tests/decorations.test.ts` asserts both halves.
 *
 * The import runs ONE WAY — this module imports `@/data/upgrades`; nothing in
 * `upgrades.ts` may import this back. That direction IS the no-harm invariant.
 *
 * ART DEVIATION FROM THE MOCKUP — deliberate, recorded, with an upgrade path.
 * **No decoration art exists.** All three `assets/atomic-assets-v{1,2,3}`
 * manifests were searched for `decor|plant|poster|lamp|banner|flower|sticker|
 * cosmetic|ozdob` and returned zero hits, and there is no mockup for a decoration
 * anywhere in the `matmaverse-*` sets. `art` is therefore optional and **unset in
 * the first batch**: every entry renders its `icon` through
 * `src/components/child/ShopGlyph.tsx` — lucide plus the app's own design tokens
 * — exactly the deviation `src/data/stages.ts` established. That is what lets a
 * world's set ship complete instead of blocking on 24 illustrations, and it is
 * why a placeholder asset was NOT committed: a placeholder reads as finished art
 * to everyone who did not write it, and somebody has to find and delete it later.
 * **To add art:** ship `public/illustrations/decoration-<id>.svg`, add its row to
 * `public/illustrations/slice-map.md` with the source path and crop box, and set
 * `art` here. Nothing else changes — `ShopGlyph` prefers `art` whenever it is set.
 *
 * There is deliberately **no `slot` field**. Decorations take `ShopArt`'s
 * documented corner-row fallback rather than percent coordinates tuned per world
 * plate, which is exactly what lets a set grow one entry at a time.
 */
import type { ShopIconKey } from "@/components/child/ShopGlyph";
import type { ShopState } from "@/types";
import { type BuyCheck, isOwned } from "@/data/upgrades";
import { WORLD_SLUGS } from "@/data/worlds";

export interface Decoration {
  /** World-prefixed and therefore globally unique, e.g. `"kawiarnia-lampki"`. */
  id: string;
  /** Owning world slug — a decoration is only buyable in its own world. */
  world: string;
  /** i18n key: resolved as `t.decorations[id]` — this file carries no literal copy (L-003). */
  nameKey: string;
  /** Cost in wallet funds (zl). The ONLY gate besides the world. */
  cost: number;
  /** Fallback glyph. See the ART DEVIATION block above. */
  icon: ShopIconKey;
  /** Committed art path. **Unset in the first batch** — see the ART DEVIATION block. */
  art?: string;
}

/**
 * The per-world price curve, shared by every world so no world is a better deal
 * than another (a child switching worlds must not be switching economies).
 *
 * Four steps, rising. Four rather than two because the recurring level-boundary
 * empty state needs something buyable in each ~3-shift band and an early band
 * yields ~130 zl; four rather than eight because the eventual art debt is
 * `worlds x count` and it already starts at zero. Total 480 zl per world against
 * a ~1160 zl catalogue.
 */
export const DECORATION_PRICES = [40, 80, 140, 220] as const;

/** How many decorations every world carries. Asserted per world in `tests/decorations.test.ts`. */
export const DECORATIONS_PER_WORLD = DECORATION_PRICES.length;

/** Build one world's four entries from its four icon choices, at the shared price curve. */
function setFor(world: string, entries: readonly [string, ShopIconKey][]): Decoration[] {
  return entries.map(([name, icon], i) => ({
    id: `${world}-${name}`,
    world,
    nameKey: `${world}-${name}`,
    cost: DECORATION_PRICES[i],
    icon,
  }));
}

/**
 * Every decoration, four per world. Each world's set is chosen to look like ITS
 * OWN place — a cafe's lamps are not a bookshop's — because the whole point of
 * the sink is that switching worlds renews it.
 */
export const DECORATIONS: readonly Decoration[] = [
  ...setFor("kawiarnia", [
    ["lampki", "lamp"],
    ["kwiaty", "flower"],
    ["obrazek", "frame"],
    ["fotel", "armchair"],
  ]),
  ...setFor("piekarnia", [
    ["wstazki", "ribbon"],
    ["rogaliki", "croissant"],
    ["tort", "cake"],
    ["kawiarenka", "coffee"],
  ]),
  ...setFor("galaktyczna-baza", [
    ["orbita", "orbit"],
    ["satelita", "satellite"],
    ["teleskop", "telescope"],
    ["rakieta", "rocket"],
  ]),
  ...setFor("sklep-ksiegarnia", [
    ["listek", "leaf"],
    ["zakladka", "feather"],
    ["zwoje", "scroll"],
    ["ksiegozbior", "book"],
  ]),
] as const;

/** Valid decoration ids — the closed set for app-layer (zod) validation. */
export const DECORATION_IDS = DECORATIONS.map((d) => d.id) as [string, ...string[]];

const BY_ID = new Map(DECORATIONS.map((d) => [d.id, d] as const));

export function getDecoration(id: string): Decoration | undefined {
  return BY_ID.get(id);
}

/** This world's decorations, in price order. Empty for a slug with no set. */
export function decorationsForWorld(slug: string): Decoration[] {
  return DECORATIONS.filter((d) => d.world === slug);
}

/**
 * Normalize the persisted `shop_state` to the owned-decoration id list
 * (missing → []). Mirrors `readPurchased`, and for the same reason: `shop_state`
 * is typed non-optional but `{}` rows are legal forever.
 */
export function readDecorations(shopState: Partial<ShopState> | null | undefined): string[] {
  return shopState?.decorations ?? [];
}

export interface DecorationBuyContext {
  walletBalance: number;
  /** The child's CURRENT world slug — a decoration from elsewhere is not for sale. */
  world: string;
  decorations: string[];
}

/**
 * Server-authoritative purchasability, reused by the buy route (authority) and
 * the shop screen (display) so they never disagree.
 *
 * Three rungs, in this order: already-owned, wrong world, affordability. **Price
 * is the only gate besides the world** — no level, no skill, no history. That is
 * D-11's whole premise: past the catalogue's end there must always be something
 * a child with money can buy.
 *
 * `"wrong-world"` is its own reason and not a reuse of `"locked"`, which
 * `UpgradeShop.lockedReason` renders as "unlock at business level N" — a level
 * number that has nothing to do with why this buy failed.
 */
export function canBuyDecoration(decoration: Decoration | undefined, ctx: DecorationBuyContext): BuyCheck {
  if (!decoration) return { ok: false, reason: "unknown" };
  if (isOwned(decoration.id, ctx.decorations)) return { ok: false, reason: "owned" };
  if (decoration.world !== ctx.world) return { ok: false, reason: "wrong-world" };
  if (ctx.walletBalance < decoration.cost) return { ok: false, reason: "insufficient" };
  return { ok: true };
}

/** The next thing to aim for, whichever list it comes from. */
export type NextThing =
  | { kind: "upgrade"; id: string; cost: number; art?: string; icon?: ShopIconKey }
  | { kind: "decoration"; id: string; cost: number; art?: string; icon?: ShopIconKey };

export interface NextPurchaseContext {
  businessLevel: number;
  purchased: string[];
  world: string;
  decorations: string[];
}

/**
 * The "next thing" the three FR-013 surfaces name: the cheapest level-eligible
 * unowned upgrade, or — once the catalogue is exhausted at this level — the
 * cheapest unowned decoration of the CURRENT world.
 *
 * Upgrades come first on purpose: they are the decision the product is about, and
 * a decoration must never distract from one the child can still make. Returning
 * null only when both lists are empty is what keeps the card a finished thought
 * instead of an empty state — see `e2e/growth.spec.ts` (Risk E2E-F4-3), which
 * reaches that last case deliberately.
 *
 * Takes `nextUpgrade` as an argument rather than importing it, so this module
 * needs no value import from the catalogue and the one-way rule above stays
 * mechanical rather than a promise.
 */
export function nextPurchase(
  ctx: NextPurchaseContext,
  nextUpgradeFor: (c: {
    businessLevel: number;
    purchased: string[];
  }) => { id: string; cost: number; art?: string; icon?: ShopIconKey } | null,
): NextThing | null {
  const upgrade = nextUpgradeFor({ businessLevel: ctx.businessLevel, purchased: ctx.purchased });
  if (upgrade) return { kind: "upgrade", id: upgrade.id, cost: upgrade.cost, art: upgrade.art, icon: upgrade.icon };
  const unowned = decorationsForWorld(ctx.world).filter((d) => !isOwned(d.id, ctx.decorations));
  if (unowned.length === 0) return null;
  const cheapest = unowned.reduce((a, b) => (b.cost < a.cost ? b : a));
  return { kind: "decoration", id: cheapest.id, cost: cheapest.cost, art: cheapest.art, icon: cheapest.icon };
}

/** Every world slug the sink must cover — re-exported so consumers need one import. */
export const DECORATION_WORLDS = WORLD_SLUGS;
