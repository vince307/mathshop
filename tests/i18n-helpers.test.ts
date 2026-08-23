import { describe, expect, it } from "vitest";
import { charsNeeded, stageCopy, t, tasksDone, upgradeCopy } from "@/i18n";
import { UPGRADES } from "@/data/upgrades";
import { STAGES } from "@/data/stages";

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

describe("tasksDone — Polish plural forms for the activity feed", () => {
  it("selects one/few/many forms per the Polish plural rules", () => {
    expect(tasksDone(1)).toBe("1 zadanie"); // one
    expect(tasksDone(2)).toBe("2 zadania"); // few (2–4)
    expect(tasksDone(4)).toBe("4 zadania");
    expect(tasksDone(5)).toBe("5 zadań"); // many
    expect(tasksDone(12)).toBe("12 zadań"); // teens are many, not few
    expect(tasksDone(22)).toBe("22 zadania"); // x2–x4 above 20 → few again
    expect(tasksDone(0)).toBe("0 zadań"); // the degenerate row never renders this, but must not crash
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

describe("stageCopy — guarded growth-stage copy resolver (F4)", () => {
  it("resolves name and desc for every real stage id (L-003: the catalogue carries no copy)", () => {
    for (const stage of STAGES) {
      const copy = stageCopy(stage.id);
      expect(copy.name.length).toBeGreaterThan(0);
      expect(copy.desc.length).toBeGreaterThan(0);
      expect(copy).toBe(t.stages[stage.id as keyof typeof t.stages]);
    }
  });

  it("falls back to the raw id (never throws) for a stage id missing from the dictionary", () => {
    expect(stageCopy("ghost-stage")).toEqual({ name: "ghost-stage", desc: "" });
  });
});
