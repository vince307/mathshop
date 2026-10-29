/**
 * THE PACING MODEL (D-13). A pure, browser-free, Supabase-free simulation of how
 * a shop's economy pays out over a run of shifts — the arithmetic that decides
 * whether a price is reachable, and how long the catalogue takes to empty.
 *
 * It imports `src/data/*` rather than restating it, so a price change, a new
 * upgrade or a changed length curve re-runs this model automatically on the next
 * `npm test`. It consumes the harness's existing `child-model.ts` rather than
 * writing a second assumption file: `MISS_MODEL` stays the one place a reader can
 * disagree with how a child errs.
 *
 * **Nothing here is evidence about children.** Same caveat as `child-model.ts`
 * and README.md § *What this does NOT prove*: the accuracy curve is a stated
 * input, so the output says how the **economy** responds to a class of player —
 * not what a real child does. A finding from this file is a finding about
 * `MISS_MODEL` and the price list, never about a six-year-old.
 *
 * Two exports carry beyond the report:
 * - `referenceShift` is the shift the economy invariants in
 *   `tests/economy-invariants.test.ts` evaluate at. It is **derived, not
 *   invented**: the length band comes from `shiftLengthRangeFor` and the accuracy
 *   from `TARGET_SUCCESS`, the rate the adaptive engine already steers toward.
 * - `costInTasks` expresses a price in **tasks solved**, which is the natural unit
 *   for a product whose currency is mathematics.
 *
 * `report()` never runs on import — this module is imported by tests.
 */
import {
  type DifficultyState,
  type ScoredTask,
  ceilingForLevel,
  foldShiftOutcomes,
  seedDifficultyFor,
  shiftLengthRangeFor,
  TARGET_SUCCESS,
} from "@/data/adaptive";
import {
  MAX_SHIFT_TASKS,
  businessLevelForShifts,
  createShiftSource,
  lengthDifficulty,
  planShift,
  profitForShift,
} from "@/data/shift";
import { UPGRADES, canBuy, shiftBonusTasks, shopEffects } from "@/data/upgrades";
import { canBuyDecoration, decorationsForWorld } from "@/data/decorations";
import { DEFAULT_THEME, WORLD_SLUGS } from "@/data/worlds";
import { competencyForTaskType, readSkillState } from "@/data/skills";
import type { SkillState } from "@/types";
import { type ChildModel, MISS_MODEL, missesThisTask, rng } from "./child-model";

/**
 * The shift the economy is measured at, at difficulty `d` with `bonus` capacity
 * tasks owned.
 *
 * Both inputs are load-bearing elsewhere and neither is invented here:
 * `shiftLengthRangeFor(d)` is the real length band, and `TARGET_SUCCESS` is the
 * first-try rate `nextDifficulty` converges on — i.e. the definition of a child in
 * steady state. The midpoint of the band is the shift a settled player plays.
 */
export function referenceShift(d: number, bonus: number): { taskCount: number; cleanCount: number } {
  const { min, max } = shiftLengthRangeFor(d);
  const taskCount = Math.min(MAX_SHIFT_TASKS, Math.round((min + max) / 2) + bonus);
  return { taskCount, cleanCount: Math.round(TARGET_SUCCESS * taskCount) };
}

/**
 * What one reference shift pays a shop owning `purchased` — revenue, cost and
 * the profit the wallet actually receives (E1's `profit = max(0, revenue - cost)`).
 *
 * The module's SINGLE payout call site on purpose: the timeline, `costInTasks`
 * and the idle-wallet check all read it, so the pacing model can never disagree
 * with the rule the wallet is credited by.
 */
export function shiftPayout(
  purchased: string[],
  taskCount: number,
  cleanCount: number,
): { revenue: number; cost: number; profit: number } {
  return profitForShift(taskCount, cleanCount, shopEffects(purchased));
}

/**
 * A price expressed in **tasks solved** at the reference shift for a shop owning
 * `purchased`, at difficulty `d`. Rounded up: a child cannot solve two thirds of a
 * task. Returns `Infinity` when a shift pays nothing, which is the honest answer —
 * an unreachable price, not a very large number.
 */
export function costInTasks(price: number, purchased: string[], d: number): number {
  const { taskCount, cleanCount } = referenceShift(d, shiftBonusTasks(purchased));
  const { profit } = shiftPayout(purchased, taskCount, cleanCount);
  if (profit <= 0 || taskCount <= 0) return Infinity;
  return Math.ceil(price / (profit / taskCount));
}

/** One purchase the simulated player made, and when. */
export interface PurchaseEvent {
  /** 1-based shift index after which the purchase happened. */
  shift: number;
  /** The world the child was in when they bought it. */
  world: string;
  id: string;
  cost: number;
  /** Price at the moment of purchase, in tasks solved. */
  inTasks: number;
}

/** One simulated shift's economics. */
export interface ShiftRecord {
  /** 1-based. */
  shift: number;
  businessLevel: number;
  /** The world the shop was in for this shift. */
  world: string;
  /** `lengthDifficulty` at the shift's open — the number the length band was drawn from. */
  difficulty: number;
  taskCount: number;
  cleanCount: number;
  revenue: number;
  cost: number;
  profit: number;
  walletAfter: number;
  bought: string[];
  /**
   * How many things were buyable **after** this shift's purchases were made.
   * Zero is fine while the child is simply saving; zero when the wallet COULD
   * afford something is the idle wallet D-11 exists to abolish.
   */
  buyableAfter: number;
  /**
   * The cheapest thing still unowned and reachable from THIS world, or null when
   * nothing is left here. `buyableAfter === 0` is honest exactly when the wallet
   * is below this.
   */
  cheapestRemaining: number | null;
}

export interface PurchaseTimeline {
  cohort: string;
  seed: number;
  shifts: ShiftRecord[];
  purchases: PurchaseEvent[];
  /** 1-based shift after which the FIRST purchase happened, or null if none. */
  firstPurchaseShift: number | null;
  /** 1-based shift after which the catalogue was fully owned, or null if never. */
  catalogueEmptiedShift: number | null;
  /**
   * 1-based shift after which the catalogue AND every reachable world's sink were
   * exhausted, or null if never. Past this point the wallet is genuinely idle —
   * the state `t.growth.noNextUpgrade` names and `e2e/growth.spec.ts` seeds.
   */
  everythingOwnedShift: number | null;
  /** 1-based shifts at which the player moved on to a new world. */
  worldSwitches: { shift: number; from: string; to: string }[];
}

export interface SimulateOptions {
  /** Frozen `starting_level` — fixes the age band's difficulty seed and ceiling. */
  startingLevel?: number;
  /**
   * The worlds the simulated player moves through, in order. Defaults to the
   * shipped set starting at the default theme.
   *
   * **Modelling the world change is not embellishment.** The sink renews PER
   * WORLD: exhaust one world's four decorations and the wallet is idle until the
   * child moves, which `/app/worlds` invites them to do and `t.worlds` promises is
   * lossless. A simulation pinned to one world would show a dead wallet the
   * product does not actually have, and "the wallet is never idle" could not be
   * stated at all.
   */
  worlds?: readonly string[];
}

/** A fully zeroed `SkillState`, via the shipped normalizer (no second copy of the shape). */
function zeroSkills(): SkillState {
  return readSkillState({});
}

/**
 * Walk `shifts` shifts for one cohort with a greedy **buy the cheapest buyable
 * thing** policy, using the real `planShift` / `createShiftSource` /
 * `foldShiftOutcomes` / `canBuy` — not a restatement of them.
 *
 * Deterministic in `seed`: one mulberry32 stream drives both the miss draws and
 * the per-shift plan seeds, so a re-run replays the identical timeline. That is
 * what lets a property test assert on the output at all.
 *
 * The greedy policy is deliberately the **least** patient player: it spends the
 * moment it can. A pacing floor that holds for this player holds for a saver too,
 * and the failure mode the model exists to catch — a wallet with nothing to buy —
 * shows up soonest under it.
 */
export function simulatePurchases(
  model: ChildModel,
  shifts: number,
  seed: number,
  options: SimulateOptions = {},
): PurchaseTimeline {
  const startingLevel = options.startingLevel ?? 1;
  const worlds = options.worlds ?? [DEFAULT_THEME, ...WORLD_SLUGS.filter((slug) => slug !== DEFAULT_THEME)];
  let worldIndex = 0;
  const ceiling = ceilingForLevel(startingLevel);
  const next = rng(seed);

  let difficulty: DifficultyState = seedDifficultyFor(startingLevel);
  let skillState = zeroSkills();
  let wallet = 0;
  let completedShifts = 0;
  const purchased: string[] = [];
  const decorations: string[] = [];

  const records: ShiftRecord[] = [];
  const purchases: PurchaseEvent[] = [];
  let catalogueEmptiedShift: number | null = null;
  let everythingOwnedShift: number | null = null;
  const worldSwitches: { shift: number; from: string; to: string }[] = [];

  /** This world's decorations the wallet could buy right now. */
  const buyableDecorationsIn = (slug: string, walletBalance: number) =>
    decorationsForWorld(slug).filter(
      (decoration) => canBuyDecoration(decoration, { walletBalance, world: slug, decorations }).ok,
    );
  /** Has this world's sink been fully drained? (An empty set counts as drained.) */
  const worldExhausted = (slug: string) =>
    decorationsForWorld(slug).every((decoration) => decorations.includes(decoration.id));

  for (let shift = 1; shift <= shifts; shift++) {
    const openD = lengthDifficulty(difficulty);
    const bonus = shiftBonusTasks(purchased);
    // Real plan + real type draw. `planShift`'s seed comes off the same stream, so
    // the whole run stays a pure function of `seed`.
    const plan = planShift(difficulty, ceiling, bonus, Math.floor(next() * 0xffffffff));
    const { types } = createShiftSource(plan);

    const scored: ScoredTask[] = [];
    let running = difficulty;
    for (let index = 0; index < plan.length; index++) {
      const competency = competencyForTaskType(types[index]);
      const firstTry = !missesThisTask(model, running[competency], next);
      scored.push({ index, competency, firstTry });
      // The client folds a growing prefix after every task so the NEXT one is
      // drawn at the `d` the last answer produced — mirror that, or the miss
      // draws would ignore in-shift adaptation entirely.
      running = foldShiftOutcomes(difficulty, scored, ceiling);
    }

    const taskCount = plan.length;
    const cleanCount = scored.filter((task) => task.firstTry).length;
    const { revenue, cost, profit } = shiftPayout(purchased, taskCount, cleanCount);
    wallet += profit;
    completedShifts += 1;
    difficulty = running;

    // Skill accrual mirrors the completion route: every task counts as completed,
    // a first-try one also raises `firstTryCorrect`.
    const bumped = { ...skillState };
    for (const task of scored) {
      const entry = bumped[task.competency];
      bumped[task.competency] = {
        completed: entry.completed + 1,
        firstTryCorrect: entry.firstTryCorrect + (task.firstTry ? 1 : 0),
        // The product's soft retry is exactly one miss before the correct answer
        // (`missesThisTask`'s own contract), so a non-first-try task is one miss.
        misses: entry.misses + (task.firstTry ? 0 : 1),
      };
    }
    skillState = bumped;

    const levelAfter = businessLevelForShifts(completedShifts);
    const bought: string[] = [];
    for (;;) {
      const ctx = { walletBalance: wallet, businessLevel: levelAfter, purchased, skillState };
      const affordable = UPGRADES.filter((upgrade) => canBuy(upgrade, ctx).ok);
      if (affordable.length > 0) {
        const pick = affordable.reduce((a, b) => (b.cost < a.cost ? b : a));
        wallet -= pick.cost;
        purchased.push(pick.id);
        bought.push(pick.id);
        purchases.push({
          shift,
          world: worlds[worldIndex],
          id: pick.id,
          cost: pick.cost,
          inTasks: costInTasks(pick.cost, purchased, openD),
        });
        // A purchase credits the `decisions` competency, exactly as `buyUpgrade` does.
        skillState = {
          ...skillState,
          decisions: {
            completed: skillState.decisions.completed + 1,
            firstTryCorrect: skillState.decisions.firstTryCorrect + 1,
            misses: skillState.decisions.misses,
          },
        };
        continue;
      }
      // The catalogue is exhausted (or nothing in it is affordable yet) — spend
      // into the sink instead. UPGRADES FIRST is deliberate and mirrors
      // `nextPurchase`: a decoration must never consume money the child could
      // have put toward a real decision. A decoration buy credits NO `decisions`
      // (AD-6), so nothing is bumped here.
      // Move on when this world is drained and another is left. `/app/worlds`
      // invites exactly this and `t.worlds` promises it is lossless — the shop and
      // its upgrades come along. Modelling it is what makes the sink RENEWING
      // rather than merely larger.
      while (worldExhausted(worlds[worldIndex]) && worldIndex < worlds.length - 1) {
        worldSwitches.push({ shift, from: worlds[worldIndex], to: worlds[worldIndex + 1] });
        worldIndex += 1;
      }
      const buyableDecorations = buyableDecorationsIn(worlds[worldIndex], wallet);
      if (buyableDecorations.length === 0) break;
      const pick = buyableDecorations.reduce((a, b) => (b.cost < a.cost ? b : a));
      wallet -= pick.cost;
      decorations.push(pick.id);
      bought.push(pick.id);
      purchases.push({
        shift,
        world: worlds[worldIndex],
        id: pick.id,
        cost: pick.cost,
        inTasks: costInTasks(pick.cost, purchased, openD),
      });
    }

    if (catalogueEmptiedShift === null && purchased.length === UPGRADES.length) catalogueEmptiedShift = shift;
    if (
      everythingOwnedShift === null &&
      purchased.length === UPGRADES.length &&
      worlds.every((slug) => worldExhausted(slug))
    ) {
      everythingOwnedShift = shift;
    }

    const currentWorld = worlds[worldIndex];
    const afterCtx = { walletBalance: wallet, businessLevel: levelAfter, purchased, skillState };
    // What this child could buy RIGHT NOW if they had the money: unowned catalogue
    // entries their level already allows, plus THIS world's unowned decorations.
    // Scoped to the current world on purpose — another world's set is not for sale
    // until the child moves there, and counting it would make the idle-wallet check
    // fire on a state that is not actually idle.
    const remainingCosts = [
      ...UPGRADES.filter((u) => !purchased.includes(u.id) && u.requiredWorldLevel <= levelAfter).map((u) => u.cost),
      ...decorationsForWorld(currentWorld)
        .filter((decoration) => !decorations.includes(decoration.id))
        .map((decoration) => decoration.cost),
    ];
    records.push({
      shift,
      businessLevel: levelAfter,
      world: currentWorld,
      difficulty: openD,
      taskCount,
      cleanCount,
      revenue,
      cost,
      profit,
      walletAfter: wallet,
      bought,
      buyableAfter:
        UPGRADES.filter((upgrade) => canBuy(upgrade, afterCtx).ok).length +
        buyableDecorationsIn(currentWorld, wallet).length,
      cheapestRemaining: remainingCosts.length > 0 ? Math.min(...remainingCosts) : null,
    });
  }

  return {
    cohort: model.id,
    seed,
    shifts: records,
    purchases,
    firstPurchaseShift: purchases.length > 0 ? purchases[0].shift : null,
    catalogueEmptiedShift,
    everythingOwnedShift,
    worldSwitches,
  };
}

/** Default seed for the report and for the tests' determinism check. */
export const PACING_SEED = 20260827;

/** How many shifts the report walks by default — past the catalogue's end on every cohort. */
export const REPORT_SHIFTS = 30;

/** Render one cohort's timeline as a fixed-width table. */
export function formatTimeline(timeline: PurchaseTimeline): string {
  const head =
    `cohort=${timeline.cohort} seed=${timeline.seed} ` +
    `firstPurchase=${timeline.firstPurchaseShift ?? "never"} ` +
    `catalogueEmptied=${timeline.catalogueEmptiedShift ?? "never"} ` +
    `everythingOwned=${timeline.everythingOwnedShift ?? "never"} ` +
    `worldSwitches=${timeline.worldSwitches.map((w) => `${w.shift}:${w.to}`).join(" ") || "none"}`;
  const rows = timeline.shifts.map(
    (r) =>
      `  ${String(r.shift).padStart(3)} | lvl ${r.businessLevel} | ${r.world.padEnd(17)} | d=${r.difficulty.toFixed(2)} | ` +
      `${String(r.cleanCount).padStart(2)}/${String(r.taskCount).padStart(2)} | ` +
      `rev ${String(r.revenue).padStart(3)} - ${String(r.cost).padStart(3)} = ${String(r.profit).padStart(3)} | ` +
      `wallet ${String(r.walletAfter).padStart(4)} | buyable ${r.buyableAfter} | ${r.bought.join(",") || "-"}`,
  );
  const prices = timeline.purchases.map(
    (p) => `  ${p.id}: ${p.cost} zl = ${p.inTasks} tasks (shift ${p.shift}, ${p.world})`,
  );
  return [
    head,
    "  shift | level | world | d | clean/tasks | revenue - cost = profit | wallet | buyable | bought",
    ...rows,
    "  prices in tasks solved, at the reference shift of the moment:",
    ...prices,
  ].join("\n");
}

/**
 * The whole report as a string: one timeline per `MISS_MODEL` cohort, plus the
 * harness caveat. Returns rather than prints, so a test can read it and a caller
 * can decide where it goes.
 *
 * **Never runs on import** — `tests/pacing.test.ts` imports this module.
 */
export function report(shifts = REPORT_SHIFTS, seed = PACING_SEED): string {
  const blocks = MISS_MODEL.map((model) => formatTimeline(simulatePurchases(model, shifts, seed)));
  return [
    "PACING MODEL (D-13) — how the ECONOMY responds to a class of player.",
    "Not evidence about children: the accuracy curve is MISS_MODEL, a stated input,",
    "never measured on a child. See scripts/telemetry-harness/README.md.",
    "",
    ...blocks,
  ].join("\n");
}
