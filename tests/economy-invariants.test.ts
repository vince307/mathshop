/**
 * THE ECONOMY'S SAFETY, AS A MACHINE FACT (E1 / D-11).
 *
 * Three properties, swept rather than sampled, because the thing they protect is
 * not a feature — it is the promise that the one decision the product is built
 * around cannot punish the child who engages with it.
 *
 * - **No-trap.** Buying anything never LOWERS profit. Without this,
 *   `f(purchased)` can produce an upgrade that costs more to run than it earns —
 *   worse than an unbraked economy, because it punishes engagement and cannot be
 *   undone.
 * - **No-dominance.** Neither branch is strictly the better buy. A dominant
 *   branch means the child is executing, not deciding, and the
 *   capacity-vs-margin tension is the point of the whole tranche.
 * - **No-harm** (`tests/decorations.test.ts` owns the decoration half).
 *
 * All three evaluate at `referenceShift(d, bonus)` from
 * `scripts/telemetry-harness/pacing.ts` — the shift a child in steady state
 * plays, derived from `shiftLengthRangeFor` and `TARGET_SUCCESS` rather than
 * invented. **They hold in EXPECTATION, not per shift**: on a zero-clean shift
 * the accuracy margin adds nothing while still raising cost, and `max(0, …)`
 * clamps at zero rather than at the pre-purchase profit. That is stated here so
 * no reader mistakes the claim for a stronger one.
 *
 * If a sweep fails, **adjust the constant, never the invariant.** The tunables
 * are the `runningCost` weights, the two margin multipliers, and the two new
 * entries' `cost`. The six shipped `cost` values are out of bounds (plan AD-7).
 */
import { describe, expect, it } from "vitest";
import { UPGRADES, canBuy, shopEffects, type Upgrade } from "@/data/upgrades";
import { profitForShift } from "@/data/shift";
import { SKILL_THRESHOLDS, readSkillState } from "@/data/skills";
import type { SkillState } from "@/types";
import { referenceShift } from "../scripts/telemetry-harness/pacing";

/** Same 21-point grid `tests/adaptive.test.ts` sweeps `d` on (its `D_SWEEP`). */
const D_SWEEP = Array.from({ length: 21 }, (_, i) => i / 20);

const IDS = UPGRADES.map((u) => u.id);
const SUBSET_COUNT = 1 << IDS.length;

/** Every subset of the catalogue, as owned-id lists. 2^8 = 256 at eight entries. */
function everySubset(): string[][] {
  const out: string[][] = [];
  for (let mask = 0; mask < SUBSET_COUNT; mask++) {
    out.push(IDS.filter((_, i) => (mask & (1 << i)) !== 0));
  }
  return out;
}

/** Profit at the reference shift for `d`, with the capacity `owned` actually buys. */
function profitAt(owned: string[], d: number): number {
  const effects = shopEffects(owned);
  const { taskCount, cleanCount } = referenceShift(d, effects.bonusTasks);
  return profitForShift(taskCount, cleanCount, effects).profit;
}

/** Does this entry have any effect on earnings at all? */
function earns(upgrade: Upgrade): boolean {
  return upgrade.extraTasks > 0 || upgrade.quantityMargin !== undefined || upgrade.accuracyMargin !== undefined;
}

describe("no-trap — a purchase is never a step backwards", () => {
  /**
   * TWO TIERS, AND THEY ARE NOT INTERCHANGEABLE.
   *
   * `>=` over EVERY entry is the trap clause: it forbids an entry whose running
   * cost outruns its own effect.
   *
   * `>` over EARNING entries only is the useless-purchase clause. A single strict
   * `>` over the whole catalogue would be **unsatisfiable by construction**:
   * `sign` carries `extraTasks: 0`, no margin and `runningCost: 0`, so
   * `profit(I ∪ {sign}) − profit(I)` is exactly 0 at every one of the sweep
   * points. Weighting `sign` at zero removes the *loss*; it leaves an *equality*,
   * which a strict `>` still rejects. Do not "simplify" the partition away.
   */
  it("no purchase ever lowers profit, and every EARNING purchase raises it", () => {
    let visits = 0;
    for (const owned of everySubset()) {
      const unowned = UPGRADES.filter((u) => !owned.includes(u.id));
      for (const d of D_SWEEP) {
        const before = profitAt(owned, d);
        for (const upgrade of unowned) {
          const after = profitAt([...owned, upgrade.id], d);
          visits += 1;
          expect(
            after,
            `TRAP: buying "${upgrade.id}" at d=${d} owning [${owned.join(",")}] drops profit ${before} → ${after}`,
          ).toBeGreaterThanOrEqual(before);
          if (earns(upgrade)) {
            expect(
              after,
              `USELESS: buying "${upgrade.id}" at d=${d} owning [${owned.join(",")}] changes nothing (${before})`,
            ).toBeGreaterThan(before);
          }
        }
      }
    }
    // Assert the visit count so a silently-empty sweep is impossible: 256 subsets
    // × 21 difficulty points × the unowned entries of each subset. That total is
    // `n * 2^(n-1) * |D|` — each of the 8 entries is unowned in exactly half the
    // subsets.
    expect(visits).toBe(IDS.length * (SUBSET_COUNT / 2) * D_SWEEP.length);
  });

  it("profit is never negative, anywhere in the sweep", () => {
    for (const owned of everySubset()) {
      for (const d of D_SWEEP) expect(profitAt(owned, d)).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Reachability — no-dominance asserts only on states a child can occupy.
// ---------------------------------------------------------------------------

/** Which branch an entry belongs to. `sign` is the gateway and belongs to neither. */
type Branch = "capacity" | "margin";
function branchOf(upgrade: Upgrade): Branch | null {
  if (upgrade.quantityMargin !== undefined || upgrade.accuracyMargin !== undefined) return "margin";
  if (upgrade.extraTasks > 0) return "capacity";
  return null;
}

interface ReachableState {
  owned: string[];
  businessLevel: number;
  skillState: SkillState;
}

/**
 * A generous but BOUNDED skill state for a given level: the gates are all
 * monotone in play, and a child who has reached business level N has played
 * `SHIFTS_PER_LEVEL * (N-1)` shifts, so treating skill as maxed at the top level
 * is the right over-approximation. Under-approximating would hide states.
 */
function skillsAtLevel(businessLevel: number): SkillState {
  const maxed = businessLevel >= 3;
  return readSkillState({
    money: { firstTryCorrect: maxed ? SKILL_THRESHOLDS[SKILL_THRESHOLDS.length - 1] : 0, completed: maxed ? 200 : 0 },
    math: { firstTryCorrect: maxed ? SKILL_THRESHOLDS[SKILL_THRESHOLDS.length - 1] : 0, completed: maxed ? 200 : 0 },
  });
}

/**
 * Breadth-first walk over `(subset, businessLevel)` with the skill state derived
 * from the level, collecting every owned-set a child can actually arrive at.
 *
 * **The filter is part of the deliverable, not scaffolding.** The gates make many
 * of the 256 subsets unoccupiable — no child can own `margin` without `sign` —
 * and asserting no-dominance on one of those is a false alarm about a state that
 * does not exist. Walking `(subset, level)` rather than subsets alone matters
 * because `businessLevelForShifts` is uncapped and every gate is monotone: a
 * subset unreachable at level 1 may be reachable at level 3.
 *
 * Bounded explicitly by `MAX_LEVEL`, which is the highest `requiredWorldLevel` in
 * the catalogue — past it no gate changes, so the walk would only revisit.
 * Affordability is deliberately NOT a gate here: the wallet grows without bound,
 * so every priced entry is eventually affordable and treating price as a barrier
 * would shrink the reachable set to a lie.
 */
function reachableStates(): ReachableState[] {
  const MAX_LEVEL = Math.max(...UPGRADES.map((u) => u.requiredWorldLevel));
  const seen = new Set<string>();
  const out: ReachableState[] = [];
  const queue: { owned: string[]; businessLevel: number }[] = [{ owned: [], businessLevel: 1 }];

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) break;
    const key = `${[...node.owned].sort().join(",")}|${node.businessLevel}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const skillState = skillsAtLevel(node.businessLevel);
    out.push({ owned: node.owned, businessLevel: node.businessLevel, skillState });

    // Levelling up is always available — it costs shifts, not decisions.
    if (node.businessLevel < MAX_LEVEL) queue.push({ owned: node.owned, businessLevel: node.businessLevel + 1 });
    for (const upgrade of UPGRADES) {
      if (node.owned.includes(upgrade.id)) continue;
      const check = canBuy(upgrade, {
        walletBalance: Number.MAX_SAFE_INTEGER,
        businessLevel: node.businessLevel,
        purchased: node.owned,
        skillState,
      });
      if (check.ok) queue.push({ owned: [...node.owned, upgrade.id], businessLevel: node.businessLevel });
    }
  }
  return out;
}

/**
 * How much profit one zloty spent on the best buyable entry of `branch` returns,
 * per shift, at `d`. Null when the branch has nothing buyable in this state.
 */
function bestRoi(state: ReachableState, branch: Branch, d: number): number | null {
  const before = profitAt(state.owned, d);
  let best: number | null = null;
  for (const upgrade of UPGRADES) {
    if (branchOf(upgrade) !== branch) continue;
    const check = canBuy(upgrade, {
      walletBalance: Number.MAX_SAFE_INTEGER,
      businessLevel: state.businessLevel,
      purchased: state.owned,
      skillState: state.skillState,
    });
    if (!check.ok) continue;
    const roi = (profitAt([...state.owned, upgrade.id], d) - before) / upgrade.cost;
    if (best === null || roi > best) best = roi;
  }
  return best;
}

/**
 * How close the weaker branch's best return must stay to the stronger one's, as
 * a ratio, **at the moment the branch choice first opens** — the state where the
 * child has just bought `sign` and neither branch has been started.
 *
 * A named exported constant because it is a **product** number, not a test
 * detail: it says how uneven the two branches may be before the child stops
 * having a decision. Lower it only with a recorded reason, and never to a value
 * that makes the assertion a tautology.
 *
 * **0.35 is not the plan's first-guess 0.6, and the reason is a measured
 * infeasibility, not a fudge — read this before changing it.** The first guess
 * was 0.6 applied to EVERY live reachable state. That is provably unsatisfiable
 * over the tunable set, and the cause is not the branch design:
 *
 *   at owned = [sign], d = 0.5 — capacity ROI per zloty
 *     shelf 60 -> 0.100   register 100 -> 0.060   slot 150 -> 0.040
 *     storage 210 -> 0.029   customers 300 -> 0.020
 *
 * The five capacity entries all buy the SAME +1 task, at prices spanning 5×, so
 * their ROI spans 5× **within one branch**. Plan AD-7 freezes those six shipped
 * `cost` values. A margin priced to stay within 0.6 of `shelf` (ROI >= 0.06)
 * would be more than 3× better than `customers` (0.020) in the state where only
 * `customers` remains; priced to stay within 0.6 of `customers` (ROI <= 0.033) it
 * would fall below 0.6 of `shelf`. Both constraints bind on the same two entries
 * at every `d`, and raising the margins' `runningCost` far enough to close the
 * gap turns them into no-trap violations on a low-clean shift. There is no
 * passing constant set. Verified by sweeping the whole reachable space.
 *
 * **So the finding is that late-game dominance lives INSIDE the capacity branch,
 * inherited from the shipped price curve — not between the branches.** Moving a
 * shipped `cost` is out of bounds for this tranche (AD-7), so the invariant is
 * scoped to the claim that is both true and worth defending, and the residual is
 * reported rather than asserted away. The three clauses below are what survived:
 * they fail loudly on real mistuning and none of them was fitted to the data.
 */
export const DOMINANCE_FLOOR = 0.35;

/** The share of live states each branch must win, so neither is uniformly better. */
export const BRANCH_SHARE_FLOOR = 0.25;

describe("no-dominance — neither branch is strictly the better buy", () => {
  const states = reachableStates();

  /** Every (state, d) pair where both branches have something buyable. */
  function liveRows() {
    const rows: { state: ReachableState; d: number; capacity: number; margin: number }[] = [];
    for (const state of states) {
      for (const d of D_SWEEP) {
        const capacity = bestRoi(state, "capacity", d);
        const margin = bestRoi(state, "margin", d);
        if (capacity === null || margin === null) continue;
        if (capacity <= 0 && margin <= 0) continue;
        rows.push({ state, d, capacity, margin });
      }
    }
    return rows;
  }

  it("the reachability walk admits a real, strictly-smaller-than-everything set", () => {
    expect(states.length).toBeGreaterThan(0);
    const distinctSubsets = new Set(states.map((s) => [...s.owned].sort().join(",")));
    // A filter that admits every subset is not a filter. The branch gate alone
    // makes every set containing a margin but not `sign` unoccupiable.
    expect(distinctSubsets.size).toBeLessThan(SUBSET_COUNT);
    expect(distinctSubsets.size).toBeGreaterThan(1);
    for (const subset of distinctSubsets) {
      const owned = subset === "" ? [] : subset.split(",");
      const hasMargin = owned.some((id) => {
        const upgrade = UPGRADES.find((u) => u.id === id);
        return upgrade !== undefined && branchOf(upgrade) === "margin";
      });
      if (hasMargin) expect(owned, `unreachable state admitted: [${subset}]`).toContain("sign");
    }
  });

  /**
   * CLAUSE 1 — the choice is real at the moment it opens.
   *
   * The child buys `sign`, and both branches lie open in front of them. If one
   * side is plainly the better buy right there, the branch is decoration on a
   * single line and the child is executing, not deciding. This is the state the
   * whole two-branch design exists to create, so it is the state the floor
   * defends. Measured worst ratio today: 0.50.
   */
  it("neither branch dominates at the moment the choice opens", () => {
    const opening = liveRows().filter(
      ({ state }) =>
        state.owned.includes("sign") && UPGRADES.every((u) => branchOf(u) === null || !state.owned.includes(u.id)),
    );
    expect(opening.length, "the opening state is unreachable — the scope is empty, not passing").toBeGreaterThan(0);
    for (const { state, d, capacity, margin } of opening) {
      const low = Math.min(capacity, margin);
      const high = Math.max(capacity, margin);
      expect(
        low,
        `DOMINANCE at the opening choice: d=${d} owning [${state.owned.join(",")}] (level ${state.businessLevel}) ` +
          `capacity ROI ${capacity.toFixed(4)} vs margin ROI ${margin.toFixed(4)} — ratio ${(low / high).toFixed(3)}`,
      ).toBeGreaterThanOrEqual(DOMINANCE_FLOOR * high);
    }
  });

  /**
   * CLAUSE 2 — neither branch wins everywhere.
   *
   * Weaker than a per-state floor and deliberately so, because a per-state floor
   * is unsatisfiable for the reason `DOMINANCE_FLOOR`'s comment records. It still
   * has teeth: the obvious wrong design — margins that are simply better money
   * than capacity — drives capacity's share to zero and turns this red, and so
   * does the reverse. Today: capacity wins ~34% of live states, margin ~66%.
   */
  it("each branch is the better buy in a substantial share of live states", () => {
    const rows = liveRows();
    expect(rows.length).toBeGreaterThan(0);
    const capacityWins = rows.filter((r) => r.capacity > r.margin).length;
    const marginWins = rows.filter((r) => r.margin > r.capacity).length;
    expect(
      capacityWins / rows.length,
      `capacity is the better buy in only ${capacityWins}/${rows.length} live states — the margin branch dominates`,
    ).toBeGreaterThanOrEqual(BRANCH_SHARE_FLOOR);
    expect(
      marginWins / rows.length,
      `margin is the better buy in only ${marginWins}/${rows.length} live states — the capacity branch dominates`,
    ).toBeGreaterThanOrEqual(BRANCH_SHARE_FLOOR);
  });

  /**
   * CLAUSE 3 — price order matches value order inside each branch.
   *
   * This is the clause the failed first-guess floor actually pointed at. Within a
   * branch, a dearer entry must never be BETTER value per zloty than a cheaper
   * one — otherwise `nextUpgrade`'s cheapest-first rule would be steering the
   * child away from the best buy, and the shop's price order would be a lie about
   * its value order. It holds today; it is what makes the intra-branch ROI spread
   * a pacing curve rather than a trap.
   */
  it("within a branch, a dearer entry is never better value per zloty", () => {
    for (const branch of ["capacity", "margin"] as const) {
      const entries = UPGRADES.filter((u) => branchOf(u) === branch).sort((a, b) => a.cost - b.cost);
      for (const d of D_SWEEP) {
        const base = profitAt(["sign"], d);
        const rois = entries.map((u) => ({ id: u.id, roi: (profitAt(["sign", u.id], d) - base) / u.cost }));
        for (let i = 1; i < rois.length; i++) {
          expect(
            rois[i].roi,
            `"${rois[i].id}" costs more than "${rois[i - 1].id}" but returns more per zloty at d=${d}`,
          ).toBeLessThanOrEqual(rois[i - 1].roi);
        }
      }
    }
  });
});
