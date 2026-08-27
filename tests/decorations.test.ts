/**
 * The renewing sink (E1 / D-11) — the data, the gate, and the buy path.
 *
 * Two things here are load-bearing beyond ordinary coverage:
 *
 * 1. **The per-world totality assertion.** Without it, a world shipping with an
 *    empty decoration set is SILENT at every layer: `nextPurchase` returns null,
 *    `/app/growth` falls back to `t.growth.noNextUpgrade`, and the suite stays
 *    green — the child is back in exactly the dead state D-11 exists to abolish.
 *    It is also the seam with `six-worlds-catalogue` (W1): W1's Phase 1 widens
 *    `WORLD_SLUGS` to six and turns this red, and only W1's Phase 4 (its
 *    decoration data) closes it. That is what makes W1's Phase 4 non-droppable.
 * 2. **The no-harm boundary.** A decoration must never acquire an economic
 *    effect. Asserted twice over — structurally (no decoration id contributes to
 *    `shopRunningCost`) and behaviourally (profit is bit-identical under any
 *    decoration subset), because the failure would otherwise be invisible.
 *
 * Route-level money integrity + isolation live in `tests/decorations-buy.test.ts`.
 */
import { describe, expect, it } from "vitest";
import {
  DECORATIONS,
  DECORATIONS_PER_WORLD,
  DECORATION_IDS,
  DECORATION_PRICES,
  canBuyDecoration,
  decorationsForWorld,
  getDecoration,
  nextPurchase,
  readDecorations,
} from "@/data/decorations";
import { UPGRADES, nextUpgrade, shopEffects, shopRunningCost } from "@/data/upgrades";
import { profitForShift } from "@/data/shift";
import { WORLD_SLUGS } from "@/data/worlds";
import { SHOP_ICONS } from "@/components/child/ShopGlyph";
import { referenceShift } from "../scripts/telemetry-harness/pacing";

const D_SWEEP = Array.from({ length: 21 }, (_, i) => i / 20);
const ALL_UPGRADE_IDS = UPGRADES.map((u) => u.id);

describe("the decoration catalogue", () => {
  /**
   * EVERY world has a full sink. A world with an empty set fails nowhere else —
   * see this file's header. This is the assertion that makes that state loud.
   */
  it("gives every world in WORLD_SLUGS a full decoration set", () => {
    for (const slug of WORLD_SLUGS) {
      expect(decorationsForWorld(slug).length, `world "${slug}" has no full decoration sink`).toBe(
        DECORATIONS_PER_WORLD,
      );
    }
    expect(DECORATIONS.length).toBe(WORLD_SLUGS.length * DECORATIONS_PER_WORLD);
  });

  it("has globally unique, world-prefixed ids", () => {
    expect(new Set(DECORATION_IDS).size).toBe(DECORATION_IDS.length);
    for (const decoration of DECORATIONS) {
      expect(decoration.id.startsWith(`${decoration.world}-`), `"${decoration.id}" is not world-prefixed`).toBe(true);
      expect(WORLD_SLUGS, `"${decoration.id}" names an unknown world`).toContain(decoration.world);
    }
  });

  it("prices every world's set on the same rising curve — no world is a better deal", () => {
    for (const slug of WORLD_SLUGS) {
      const costs = decorationsForWorld(slug).map((d) => d.cost);
      expect(costs, `world "${slug}" is priced off the shared curve`).toEqual([...DECORATION_PRICES]);
    }
  });

  /**
   * The structural half of no-harm: there is no field here for an effect. If this
   * ever needs relaxing, the relaxation belongs in `Upgrade`, not `Decoration`.
   */
  it("carries no economic field at all — the absence is the invariant", () => {
    for (const decoration of DECORATIONS) {
      const record = decoration as unknown as Record<string, unknown>;
      for (const field of ["extraTasks", "runningCost", "quantityMargin", "accuracyMargin", "requiredUpgrade"]) {
        expect(record[field], `"${decoration.id}" carries an economic field: ${field}`).toBeUndefined();
      }
    }
  });

  it("resolves every entry to a mapped glyph — none ships art in this batch", () => {
    for (const decoration of DECORATIONS) {
      expect(decoration.art, `"${decoration.id}" ships art; update the ART DEVIATION header`).toBeUndefined();
      expect(decoration.icon in SHOP_ICONS, `"${decoration.id}" has no mapped ShopIconKey`).toBe(true);
    }
  });

  it("never shares an id with a catalogue entry", () => {
    for (const id of DECORATION_IDS) expect(ALL_UPGRADE_IDS).not.toContain(id);
  });

  it("looks up by id and misses cleanly", () => {
    expect(getDecoration(DECORATION_IDS[0])?.id).toBe(DECORATION_IDS[0]);
    expect(getDecoration("nope")).toBeUndefined();
    expect(getDecoration("sign")).toBeUndefined();
  });
});

describe("readDecorations", () => {
  it("normalizes missing / null / empty / populated shop_state", () => {
    expect(readDecorations(undefined)).toEqual([]);
    expect(readDecorations(null)).toEqual([]);
    expect(readDecorations({})).toEqual([]);
    expect(readDecorations({ purchased: ["sign"] })).toEqual([]);
    expect(readDecorations({ purchased: [], decorations: ["kawiarnia-lampki"] })).toEqual(["kawiarnia-lampki"]);
  });
});

describe("canBuyDecoration", () => {
  const lampki = getDecoration("kawiarnia-lampki");
  const ctx = { walletBalance: 1000, world: "kawiarnia", decorations: [] as string[] };

  it("ok when affordable, in-world and unowned", () => {
    expect(canBuyDecoration(lampki, ctx)).toEqual({ ok: true });
  });
  it("unknown for a missing id", () => {
    expect(canBuyDecoration(getDecoration("nope"), ctx)).toEqual({ ok: false, reason: "unknown" });
  });
  it("owned when already bought — a decoration cannot be bought twice", () => {
    expect(canBuyDecoration(lampki, { ...ctx, decorations: ["kawiarnia-lampki"] })).toEqual({
      ok: false,
      reason: "owned",
    });
  });
  /**
   * A distinct reason, not a reuse of `"locked"` — which `UpgradeShop` renders as
   * "unlock at business level N", a number that has nothing to do with why this
   * buy failed.
   */
  it("wrong-world for a decoration from another world", () => {
    expect(canBuyDecoration(lampki, { ...ctx, world: "piekarnia" })).toEqual({ ok: false, reason: "wrong-world" });
  });
  it("insufficient when funds are below cost", () => {
    expect(canBuyDecoration(lampki, { ...ctx, walletBalance: (lampki?.cost ?? 0) - 1 })).toEqual({
      ok: false,
      reason: "insufficient",
    });
  });
  it("owned short-circuits the world rung — an owned decoration is never retro-locked", () => {
    expect(canBuyDecoration(lampki, { ...ctx, world: "piekarnia", decorations: ["kawiarnia-lampki"] })).toEqual({
      ok: false,
      reason: "owned",
    });
  });
  it("gates on PRICE alone besides the world — no level, no skill, no history", () => {
    // The premise of the whole sink: past the catalogue's end, money must always
    // buy something. Every one of this world's entries is buyable given funds.
    for (const decoration of decorationsForWorld("kawiarnia")) {
      expect(canBuyDecoration(decoration, { ...ctx, walletBalance: decoration.cost })).toEqual({ ok: true });
    }
  });
});

describe("nextPurchase", () => {
  const world = "kawiarnia";

  it("names an upgrade while one is left — a decoration never distracts from a real decision", () => {
    const next = nextPurchase({ businessLevel: 1, purchased: [], world, decorations: [] }, nextUpgrade);
    expect(next).toMatchObject({ kind: "upgrade", id: "sign" });
  });

  it("names the cheapest unowned decoration once the catalogue is exhausted", () => {
    const next = nextPurchase({ businessLevel: 99, purchased: ALL_UPGRADE_IDS, world, decorations: [] }, nextUpgrade);
    expect(next).toMatchObject({ kind: "decoration", cost: DECORATION_PRICES[0] });
    expect(next?.id.startsWith(`${world}-`)).toBe(true);
  });

  it("only ever names the CURRENT world's decorations", () => {
    for (const slug of WORLD_SLUGS) {
      const next = nextPurchase(
        { businessLevel: 99, purchased: ALL_UPGRADE_IDS, world: slug, decorations: [] },
        nextUpgrade,
      );
      expect(next?.id.startsWith(`${slug}-`), `world "${slug}" was offered a foreign decoration`).toBe(true);
    }
  });

  it("walks the whole world's set before going quiet", () => {
    const owned: string[] = [];
    for (let i = 0; i < DECORATIONS_PER_WORLD; i++) {
      const next = nextPurchase(
        { businessLevel: 99, purchased: ALL_UPGRADE_IDS, world, decorations: owned },
        nextUpgrade,
      );
      expect(next, `the sink went quiet after ${i} of ${DECORATIONS_PER_WORLD}`).not.toBeNull();
      owned.push(next?.id ?? "");
    }
    // Only now — catalogue AND this world's sink exhausted — is null the honest
    // answer. `e2e/growth.spec.ts` (Risk E2E-F4-3) reaches exactly this state.
    expect(
      nextPurchase({ businessLevel: 99, purchased: ALL_UPGRADE_IDS, world, decorations: owned }, nextUpgrade),
    ).toBeNull();
  });

  it("switching worlds renews the sink with owned upgrades untouched", () => {
    const cafeOwned = decorationsForWorld("kawiarnia").map((d) => d.id);
    const next = nextPurchase(
      { businessLevel: 99, purchased: ALL_UPGRADE_IDS, world: "piekarnia", decorations: cafeOwned },
      nextUpgrade,
    );
    expect(next).toMatchObject({ kind: "decoration" });
    expect(next?.id.startsWith("piekarnia-")).toBe(true);
  });
});

describe("no-harm — a decoration changes nothing but the picture", () => {
  /**
   * The structural boundary. `shopRunningCost` sums `runningCost` over CATALOGUE
   * entries; a decoration id misses `getUpgrade` and contributes 0 by
   * construction, with no field for it to read even if it were somehow reached.
   */
  it("no decoration id ever reaches the running cost", () => {
    expect(shopRunningCost(DECORATION_IDS)).toBe(0);
    expect(shopEffects(DECORATION_IDS)).toEqual({
      bonusTasks: 0,
      quantityMargin: 1,
      accuracyMargin: 1,
      runningCost: 0,
    });
  });

  /**
   * The behavioural boundary, swept: profit must be BIT-IDENTICAL with and
   * without any decoration set applied, over every catalogue subset and the whole
   * `d` grid. If a decoration ever gained an effect, this is what would catch it
   * even if the effect arrived through a path nobody thought of.
   */
  it("profit is bit-identical under any decoration subset, over every catalogue subset", () => {
    const decorationSets = [
      [],
      [DECORATION_IDS[0]],
      decorationsForWorld("kawiarnia").map((d) => d.id),
      [...DECORATION_IDS],
    ];
    let visits = 0;
    for (let mask = 0; mask < 1 << ALL_UPGRADE_IDS.length; mask++) {
      const owned = ALL_UPGRADE_IDS.filter((_, i) => (mask & (1 << i)) !== 0);
      for (const d of D_SWEEP) {
        const baseEffects = shopEffects(owned);
        const ref = referenceShift(d, baseEffects.bonusTasks);
        const base = profitForShift(ref.taskCount, ref.cleanCount, baseEffects);
        for (const decorations of decorationSets) {
          visits += 1;
          const withDecor = shopEffects([...owned, ...decorations]);
          const refDecor = referenceShift(d, withDecor.bonusTasks);
          expect(
            profitForShift(refDecor.taskCount, refDecor.cleanCount, withDecor),
            `HARM: decorations [${decorations.join(",")}] moved profit at d=${d} owning [${owned.join(",")}]`,
          ).toEqual(base);
        }
      }
    }
    expect(visits).toBe((1 << ALL_UPGRADE_IDS.length) * D_SWEEP.length * decorationSets.length);
  });
});
