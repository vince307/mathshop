// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SHOP_ICONS, ShopGlyph } from "@/components/child/ShopGlyph";
import { UPGRADES } from "@/data/upgrades";

/**
 * The art-fallback totality guard (E1).
 *
 * `Upgrade.art` is optional, so an entry can ship with no picture at all. The
 * failure that would follow is SILENT: `ShopGlyph` renders a default sparkle
 * rather than throwing, so a catalogue entry that forgot both `art` and `icon`
 * would look almost right and read as somebody's deliberate choice. These
 * assertions make that state loud.
 *
 * They quantify over `UPGRADES` — never over a hardcoded list of icon keys — so
 * `six-worlds-catalogue` appending to `SHOP_ICONS` cannot turn them red, and a
 * new entry with no glyph cannot slip past them.
 */
describe("ShopGlyph coverage", () => {
  afterEach(cleanup);

  it("every catalogue entry resolves to committed art OR a mapped icon", () => {
    for (const upgrade of UPGRADES) {
      const resolved = upgrade.art !== undefined || (upgrade.icon !== undefined && upgrade.icon in SHOP_ICONS);
      expect(resolved, `"${upgrade.id}" has neither committed art nor a mapped ShopIconKey`).toBe(true);
    }
  });

  /**
   * Asks whether the key resolves to something that RENDERS, not merely to
   * something non-null (L-009). Lucide icons are `forwardRef` objects, so a
   * `typeof === "function"` check would fail on every valid entry while still
   * passing on a hand-written stub — the wrong question in both directions.
   */
  it("every mapped icon actually renders an svg", () => {
    for (const key of Object.keys(SHOP_ICONS) as (keyof typeof SHOP_ICONS)[]) {
      const { container, unmount } = render(<ShopGlyph icon={key} />);
      expect(container.querySelector("svg"), `SHOP_ICONS.${key} rendered no svg`).not.toBeNull();
      unmount();
    }
  });

  it("prefers committed art whenever it is set — the fallback never overrides real art", () => {
    const { container } = render(<ShopGlyph art="/illustrations/upgrade-sign.svg" icon="target" className="size-8" />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("/illustrations/upgrade-sign.svg");
    // Decorative in every call site — the entry's name is always adjacent as text.
    expect(img?.getAttribute("alt")).toBe("");
  });

  it("renders an svg glyph when there is no art", () => {
    const { container } = render(<ShopGlyph icon="percent" className="size-8" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("merges the call site's classes rather than dropping them", () => {
    const { container } = render(<ShopGlyph icon="percent" className="size-20 grayscale" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("class")).toContain("size-20");
    expect(svg?.getAttribute("class")).toContain("grayscale");
  });
});
