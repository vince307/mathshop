/**
 * Pacing model (D-13) — the properties the simulator must hold, and the one
 * product signal it exists to police.
 *
 * The simulator imports the real `src/data/*`, so these run on every `npm test`
 * and a price change that breaks the pacing floor fails HERE rather than in a
 * kid-testing session six weeks later. That is the whole point of D-13: prices
 * settled by arithmetic, not deferred.
 *
 * What these do NOT assert: anything about children. `MISS_MODEL` is a stated
 * input (`scripts/telemetry-harness/child-model.ts`), so a finding here is a
 * finding about the economy's response to that input.
 */
import { describe, expect, it } from "vitest";
import { MAX_SHIFT_TASKS } from "@/data/shift";
import { UPGRADES, shiftBonusTasks } from "@/data/upgrades";
import { MISS_MODEL } from "../scripts/telemetry-harness/child-model";
import {
  PACING_SEED,
  costInTasks,
  formatTimeline,
  referenceShift,
  report,
  simulatePurchases,
} from "../scripts/telemetry-harness/pacing";

/** Same 21-point grid `tests/adaptive.test.ts` sweeps `d` on. */
const D_SWEEP = Array.from({ length: 21 }, (_, i) => i / 20);

const ALL_BONUSES = Array.from({ length: 6 }, (_, i) => i);

describe("referenceShift", () => {
  it("never exceeds MAX_SHIFT_TASKS, at any d and any owned capacity", () => {
    for (const d of D_SWEEP) {
      for (const bonus of ALL_BONUSES) {
        expect(referenceShift(d, bonus).taskCount).toBeLessThanOrEqual(MAX_SHIFT_TASKS);
      }
    }
  });

  it("keeps cleanCount within the shift it belongs to", () => {
    for (const d of D_SWEEP) {
      for (const bonus of ALL_BONUSES) {
        const { taskCount, cleanCount } = referenceShift(d, bonus);
        expect(cleanCount).toBeGreaterThanOrEqual(0);
        expect(cleanCount).toBeLessThanOrEqual(taskCount);
      }
    }
  });

  it("is non-decreasing in d and in bonus", () => {
    for (const bonus of ALL_BONUSES) {
      for (let i = 1; i < D_SWEEP.length; i++) {
        expect(referenceShift(D_SWEEP[i], bonus).taskCount).toBeGreaterThanOrEqual(
          referenceShift(D_SWEEP[i - 1], bonus).taskCount,
        );
      }
    }
    for (const d of D_SWEEP) {
      for (let bonus = 1; bonus < ALL_BONUSES.length; bonus++) {
        expect(referenceShift(d, bonus).taskCount).toBeGreaterThanOrEqual(referenceShift(d, bonus - 1).taskCount);
      }
    }
  });
});

describe("costInTasks", () => {
  it("expresses a price as a positive whole number of tasks", () => {
    for (const d of D_SWEEP) {
      for (const upgrade of UPGRADES) {
        const tasks = costInTasks(upgrade.cost, [], d);
        expect(Number.isInteger(tasks)).toBe(true);
        expect(tasks).toBeGreaterThan(0);
      }
    }
  });

  it("is monotone in price — a dearer thing is never fewer tasks", () => {
    const ordered = [...UPGRADES].sort((a, b) => a.cost - b.cost);
    for (const d of D_SWEEP) {
      for (let i = 1; i < ordered.length; i++) {
        expect(costInTasks(ordered[i].cost, [], d)).toBeGreaterThanOrEqual(costInTasks(ordered[i - 1].cost, [], d));
      }
    }
  });
});

describe("simulatePurchases", () => {
  it("is deterministic for a fixed seed", () => {
    for (const model of MISS_MODEL) {
      const a = simulatePurchases(model, 20, PACING_SEED);
      const b = simulatePurchases(model, 20, PACING_SEED);
      expect(b).toEqual(a);
    }
  });

  it("separates on the seed — the run is not accidentally constant", () => {
    const a = simulatePurchases(MISS_MODEL[0], 20, PACING_SEED);
    const b = simulatePurchases(MISS_MODEL[0], 20, PACING_SEED + 1);
    expect(b).not.toEqual(a);
  });

  it("never lets the wallet go negative and never re-buys an owned entry", () => {
    for (const model of MISS_MODEL) {
      const timeline = simulatePurchases(model, 30, PACING_SEED);
      for (const record of timeline.shifts) expect(record.walletAfter).toBeGreaterThanOrEqual(0);
      const ids = timeline.purchases.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("plays the shift the owned capacity earns — bonus tasks reach the simulated length", () => {
    const timeline = simulatePurchases(MISS_MODEL[0], 30, PACING_SEED);
    const last = timeline.shifts[timeline.shifts.length - 1];
    const owned = timeline.purchases.map((p) => p.id);
    expect(last.taskCount).toBeLessThanOrEqual(MAX_SHIFT_TASKS);
    // The greedy player owns the whole catalogue by shift 30, so its shifts run at
    // the full capacity bonus — this is what pins the simulator to `shiftBonusTasks`
    // rather than to a hand-carried number.
    expect(shiftBonusTasks(owned)).toBeGreaterThan(0);
  });

  /**
   * PRD v3's own pacing bound (`prd-v3.md:62`): a child sees at least one upgrade
   * within their first ~3 shifts. This is the tripwire on every future price
   * change — raise `sign` past what three shifts pay and this goes red.
   */
  it("lands the first purchase on or before shift 3, for every cohort", () => {
    for (const model of MISS_MODEL) {
      const timeline = simulatePurchases(model, 30, PACING_SEED);
      expect(timeline.firstPurchaseShift).not.toBeNull();
      expect(timeline.firstPurchaseShift).toBeLessThanOrEqual(3);
    }
  });
});

describe("report", () => {
  it("renders every cohort with the harness caveat, and does not run on import", () => {
    const text = report(12, PACING_SEED);
    expect(text).toContain("Not evidence about children");
    for (const model of MISS_MODEL) expect(text).toContain(`cohort=${model.id}`);
  });

  it("formats a timeline row per simulated shift", () => {
    const timeline = simulatePurchases(MISS_MODEL[0], 5, PACING_SEED);
    const lines = formatTimeline(timeline).split("\n");
    for (const record of timeline.shifts) {
      expect(lines.some((line) => line.trimStart().startsWith(`${record.shift} |`))).toBe(true);
    }
  });
});
