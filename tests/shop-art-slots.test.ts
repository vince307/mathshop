import { describe, expect, it } from "vitest";
import type { CSSProperties } from "react";
import { DEFAULT_THEME, WORLD_SLUGS } from "@/data/worlds";
import { UPGRADE_IDS } from "@/data/upgrades";
import { WORLD_SLOTS } from "@/components/child/ShopArt";

/**
 * Per-world overlay coordinates (F5, option D) — the repo's first `ShopArt` test.
 *
 * `ShopArt` composites each owned upgrade into the shop scene at a fixed percent
 * position, reading `WORLD_SLOTS[world.slug]?.[id] ?? DEFAULT_SLOTS[id]`. The
 * fallback is SILENT: a missing entry does not crash, it just places the badge at
 * a coordinate tuned for a different plate. So the risk here is not a broken
 * render, it is a quietly wrong one — which is exactly what these assertions pin.
 */

const slots = (slug: string) => WORLD_SLOTS[slug];

/** Percent strings only, and within the art box. */
function assertPercentInBox(value: unknown, label: string): void {
  expect(typeof value, `${label} must be a string`).toBe("string");
  const raw = value as string;
  expect(raw, `${label} must be a percent`).toMatch(/^\d+(\.\d+)?%$/);
  const n = Number.parseFloat(raw);
  expect(n, `${label} below 0`).toBeGreaterThanOrEqual(0);
  expect(n, `${label} above 100`).toBeLessThanOrEqual(100);
}

describe("ShopArt WORLD_SLOTS", () => {
  it("gives every non-default world its own slot table", () => {
    for (const slug of WORLD_SLUGS) {
      if (slug === DEFAULT_THEME) continue;
      expect(slots(slug), `no WORLD_SLOTS table for "${slug}"`).toBeDefined();
    }
  });

  it("covers all six upgrade ids in every table", () => {
    for (const [slug, table] of Object.entries(WORLD_SLOTS)) {
      for (const id of UPGRADE_IDS) {
        // A missing id silently falls back to a coordinate tuned for another plate.
        expect(table?.[id], `"${slug}" has no slot for upgrade "${id}"`).toBeDefined();
      }
    }
  });

  it("omits the default world so it keeps falling through to DEFAULT_SLOTS", () => {
    expect(WORLD_SLOTS[DEFAULT_THEME]).toBeUndefined();
  });

  it("sets exactly one of left/right and one of top/bottom, as percents in 0–100", () => {
    for (const [slug, table] of Object.entries(WORLD_SLOTS)) {
      for (const [id, style] of Object.entries<CSSProperties | undefined>(table ?? {})) {
        if (!style) throw new Error(`${slug}.${id} has no style`);
        const horizontal = (["left", "right"] as const).filter((k) => style[k] !== undefined);
        const vertical = (["top", "bottom"] as const).filter((k) => style[k] !== undefined);
        expect(horizontal, `${slug}.${id} horizontal`).toHaveLength(1);
        expect(vertical, `${slug}.${id} vertical`).toHaveLength(1);
        assertPercentInBox(style[horizontal[0]], `${slug}.${id}.${horizontal[0]}`);
        assertPercentInBox(style[vertical[0]], `${slug}.${id}.${vertical[0]}`);
      }
    }
  });
});
