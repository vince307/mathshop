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

describe("t.growth — the growth screen's copy contract (F4)", () => {
  // The screen is Astro-rendered, so there is no component unit test; this asserts
  // the contract instead — every key the page and rail dereference exists and says
  // something, so a missing key is a red test rather than a blank card in a child's
  // face. (`growth.astro` / `StageRail.astro` carry no literal Polish — L-003.)
  const KEYS = [
    "title",
    "intro",
    "stagesHeading",
    "stageOrdinal",
    "current",
    "stateDone",
    "stateCurrent",
    "stateLocked",
    "maxStage",
    "unlocksHeading",
    "noUnlocks",
    "upgradesLink",
    "tipHeading",
    "tip",
  ] as const;

  it("defines every key the page and the rail reference, non-empty", () => {
    for (const key of KEYS) {
      expect(t.growth[key], key).toBeTypeOf("string");
      expect(t.growth[key].length, key).toBeGreaterThan(0);
    }
  });

  it("keeps the nav label distinct from the page heading in BOTH directions", () => {
    // `getByRole` name matching is substring-based, so containment either way
    // would make an e2e locator on this screen ambiguous — the nav label and the
    // page heading share a prefix and must share nothing more.
    expect(t.nav.items.growth).not.toContain(t.growth.title);
    expect(t.growth.title).not.toContain(t.nav.items.growth);
  });

  it("keeps the {n} placeholder in the stage ordinal", () => {
    expect(t.growth.stageOrdinal).toContain("{n}");
    expect(t.growth.stageOrdinal.replace("{n}", "3")).not.toContain("{n}");
  });
});
