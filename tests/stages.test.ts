import { describe, expect, it } from "vitest";
import { getStage, STAGE_IDS, STAGES, stageForLevel, unlocksForStage } from "@/data/stages";
import { businessLevelForShifts } from "@/data/shift";
import { UPGRADES } from "@/data/upgrades";

/**
 * The growth ladder (F4). This file is the **anti-drift mechanism** for the pair
 * `businessLevelForShifts` (uncapped, `1 + floor(n / SHIFTS_PER_LEVEL)`) and
 * `stageForLevel` (total, saturating). A comment saying "keep these in sync" is
 * not a mechanism; these assertions are.
 *
 * The two properties that matter most:
 *   - **Saturation, not capping.** `businessLevelForShifts` must stay unbounded —
 *     capping it makes `recordShiftResult`'s `leveledUp` permanently false and
 *     kills the level-up celebration forever. So a level far past the last
 *     threshold must still render: last stage, `atMax`, no overrun.
 *   - **Reachability.** Every stage must be reachable by the real formula, not
 *     just by a hand-picked level — a threshold that no shift count can ever hit
 *     is a stage no child will ever see.
 */

const stageIndexAfterShifts = (shifts: number) => stageForLevel(businessLevelForShifts(shifts)).index;

describe("STAGES catalogue", () => {
  it("has strictly increasing requiredLevels starting at 1", () => {
    expect(STAGES[0].requiredLevel).toBe(1); // a fresh profile is business_level 1
    for (let i = 1; i < STAGES.length; i += 1) {
      expect(STAGES[i].requiredLevel).toBeGreaterThan(STAGES[i - 1].requiredLevel);
    }
  });

  it("has 1-based, gapless `order` matching array position", () => {
    STAGES.forEach((stage, i) => {
      expect(stage.order).toBe(i + 1);
    });
  });

  it("STAGE_IDS mirrors STAGES and is non-empty", () => {
    expect(STAGE_IDS).toEqual(STAGES.map((s) => s.id));
    expect(STAGE_IDS.length).toBeGreaterThan(0);
    expect(new Set(STAGE_IDS).size).toBe(STAGE_IDS.length); // no duplicate ids
  });
});

describe("stageForLevel — total and saturating", () => {
  it("resolves each threshold to its own stage", () => {
    STAGES.forEach((stage, i) => {
      expect(stageForLevel(stage.requiredLevel).index).toBe(i);
      expect(stageForLevel(stage.requiredLevel).stage.id).toBe(stage.id);
    });
  });

  it("saturates on the last stage instead of overrunning", () => {
    const far = stageForLevel(999);
    expect(far.stage).toBe(STAGES[STAGES.length - 1]);
    expect(far.index).toBe(STAGES.length - 1);
    expect(far.atMax).toBe(true);
  });

  it("sets atMax exactly at the last index and nowhere else", () => {
    STAGES.forEach((stage, i) => {
      expect(stageForLevel(stage.requiredLevel).atMax).toBe(i === STAGES.length - 1);
    });
  });

  it("never throws and always returns a renderable stage for degenerate input", () => {
    for (const level of [0, -5, NaN, 1.5, Infinity, -Infinity]) {
      const progress = stageForLevel(level);
      expect(STAGES).toContain(progress.stage);
      expect(progress.index).toBeGreaterThanOrEqual(0);
      expect(progress.index).toBeLessThan(STAGES.length);
    }
    // Below the first threshold — and NaN, which fails every comparison — resolve
    // to the FIRST stage: a blank rail is worse than an honest "you're at the start".
    expect(stageForLevel(0).stage).toBe(STAGES[0]);
    expect(stageForLevel(-5).stage).toBe(STAGES[0]);
    expect(stageForLevel(NaN).stage).toBe(STAGES[0]);
    // A non-integer sits at the stage its floor has reached, never above it.
    expect(stageForLevel(1.5).stage).toBe(STAGES[0]);
    expect(stageForLevel(Infinity).atMax).toBe(true);
  });
});

describe("the ladder against the real shift formula", () => {
  it("is monotonic non-decreasing over 0..60 completed shifts", () => {
    for (let n = 1; n <= 60; n += 1) {
      expect(stageIndexAfterShifts(n)).toBeGreaterThanOrEqual(stageIndexAfterShifts(n - 1));
    }
  });

  it("starts a fresh profile (0 shifts) at the first stage", () => {
    expect(stageIndexAfterShifts(0)).toBe(0);
  });

  it("makes every stage reachable by the formula", () => {
    const reached = new Set(Array.from({ length: 61 }, (_, n) => stageIndexAfterShifts(n)));
    expect(reached.size).toBe(STAGES.length);
  });

  it("reports atMax exactly when the last stage has been reached", () => {
    for (let n = 0; n <= 60; n += 1) {
      const progress = stageForLevel(businessLevelForShifts(n));
      expect(progress.atMax).toBe(progress.index === STAGES.length - 1);
    }
  });

  it("keeps rendering the top stage far past it — the level is uncapped by design", () => {
    // 150 shifts = business_level 51. A cap would have made this a crash, a blank
    // rail, or a permanently-false `leveledUp`; saturation makes it stage 4.
    expect(businessLevelForShifts(150)).toBeGreaterThan(STAGES[STAGES.length - 1].requiredLevel);
    const progress = stageForLevel(businessLevelForShifts(150));
    expect(progress.stage.id).toBe(STAGES[STAGES.length - 1].id);
    expect(progress.atMax).toBe(true);
  });
});

describe("unlocksForStage", () => {
  it("returns exactly the upgrades gated at that stage's level", () => {
    for (const stage of STAGES) {
      const unlocks = unlocksForStage(stage);
      expect(unlocks.every((u) => u.requiredWorldLevel === stage.requiredLevel)).toBe(true);
      // Nothing gated at this level is left out — one source of truth, not two.
      expect(unlocks.map((u) => u.id)).toEqual(
        UPGRADES.filter((u) => u.requiredWorldLevel === stage.requiredLevel).map((u) => u.id),
      );
    }
  });

  it("returns an honest empty list for the terminal stage", () => {
    // Nothing in the catalogue gates on level 4 — the screen says so rather than
    // promising an unlock that does not exist.
    expect(unlocksForStage(STAGES[STAGES.length - 1])).toEqual([]);
  });

  it("partitions the catalogue without loss across all stages", () => {
    const covered = STAGES.flatMap((stage) => unlocksForStage(stage).map((u) => u.id));
    const gated = UPGRADES.filter((u) => STAGES.some((s) => s.requiredLevel === u.requiredWorldLevel));
    expect(new Set(covered)).toEqual(new Set(gated.map((u) => u.id)));
  });
});

describe("getStage", () => {
  it("resolves every catalogue id", () => {
    for (const stage of STAGES) expect(getStage(stage.id)).toBe(stage);
  });

  it("returns undefined for a ghost id instead of throwing", () => {
    expect(getStage("ghost-stage")).toBeUndefined();
    expect(getStage("")).toBeUndefined();
  });
});
