import { describe, expect, it } from "vitest";
import { charsNeeded, t, upgradeCopy } from "@/i18n";
import { UPGRADES } from "@/data/upgrades";

/**
 * The two exported i18n helpers (previously 0% function coverage). Not
 * per-phrase copy tests (§7 exclusion) — these assert LOGIC: Polish plural-rule
 * selection and the guarded catalog-copy fallback that keeps a stale
 * `shift_log.upgrade_purchased` id from crashing a render.
 */

describe("charsNeeded — Polish plural forms", () => {
  it("selects one/few/many forms per the Polish plural rules", () => {
    expect(charsNeeded(1)).toBe("Jeszcze 1 znak"); // one
    expect(charsNeeded(2)).toBe("Jeszcze 2 znaki"); // few (2–4)
    expect(charsNeeded(4)).toBe("Jeszcze 4 znaki");
    expect(charsNeeded(5)).toBe("Jeszcze 5 znaków"); // many
    expect(charsNeeded(12)).toBe("Jeszcze 12 znaków"); // teens are many, not few
    expect(charsNeeded(22)).toBe("Jeszcze 22 znaki"); // x2–x4 above 20 → few again
  });
});

describe("upgradeCopy — guarded catalog copy resolver", () => {
  it("resolves name and desc for every real catalog id (L-003: catalog carries no copy)", () => {
    for (const upgrade of UPGRADES) {
      const copy = upgradeCopy(upgrade.id);
      expect(copy.name.length).toBeGreaterThan(0);
      expect(copy.desc.length).toBeGreaterThan(0);
      expect(copy).toBe(t.upgrades[upgrade.id as keyof typeof t.upgrades]);
    }
  });

  it("falls back to the raw id (never throws) for an id missing from the dictionary", () => {
    expect(upgradeCopy("ghost-upgrade")).toEqual({ name: "ghost-upgrade", desc: "" });
  });
});
