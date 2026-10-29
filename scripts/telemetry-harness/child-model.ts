/**
 * THE ASSUMPTION. This file is the whole reason the harness is a script and not
 * an LLM agent: the model of how a child errs is written down here, in one
 * place, as a function a reader can disagree with — rather than being implicit
 * in a language model's idea of a six-year-old.
 *
 * **Nothing in this file is evidence.** These numbers were not measured on a
 * child. They are a stated input, swept across a range so the OUTPUT tells you
 * how the engine responds to a class of player, not how a real child plays. Any
 * finding derived from a single run of this harness is a finding about
 * `MISS_MODEL`, not about children — see README.md § What this does not prove.
 */

/** Deterministic RNG (mulberry32) — same seed, same run. Reproducibility is the point. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ChildModel {
  /** Label that ends up in the profile name, so rows are filterable by cohort. */
  id: string;
  /** P(answers correctly on the first try) at the FLOOR of the difficulty scale (d = 0). */
  pBaseline: number;
  /**
   * How much of that probability is lost by the top of the scale (d = 1).
   * `pFirstTry(d) = pBaseline - dropAtCeiling * d`, clamped to [0.05, 0.99].
   *
   * A flat model (drop = 0) would make the sweep uninformative: the adaptive
   * engine's entire job is to move `d` toward a target first-try rate, and a
   * player whose accuracy ignores `d` gives it nothing to converge on. A linear
   * drop is the simplest shape that is not flat; it is not claimed to be the
   * real curve.
   */
  dropAtCeiling: number;
}

/**
 * The swept cohorts. Three points, deliberately spread wide enough that the
 * engine's response should differ visibly between them:
 *
 * - `p090` — a child comfortably above the engine's 80 % first-try target.
 *   Expect `d` to climb and pin at the age-band ceiling.
 * - `p075` — near the target. Expect `d` to wander without settling at an extreme.
 * - `p055` — below target. Expect `d` to fall toward the floor.
 *
 * If the recorded `difficulty` trajectories do NOT separate along these lines,
 * that is a finding about the engine and is worth more than the rows themselves.
 */
export const MISS_MODEL: readonly ChildModel[] = [
  { id: "p090", pBaseline: 0.95, dropAtCeiling: 0.3 },
  { id: "p075", pBaseline: 0.85, dropAtCeiling: 0.45 },
  { id: "p055", pBaseline: 0.7, dropAtCeiling: 0.6 },
] as const;

/** First-try probability for this cohort at difficulty `d ∈ [0,1]`. */
export function pFirstTry(model: ChildModel, d: number): number {
  return Math.min(0.99, Math.max(0.05, model.pBaseline - model.dropAtCeiling * d));
}

/**
 * Does this attempt miss before getting it right?
 *
 * The harness never makes a child fail a task permanently — the product has no
 * such state (retry is soft and the task stays solvable), so neither does this.
 * A "miss" is one wrong submission followed by the correct one, which is exactly
 * what `first_try = false, misses = 1` means in `task_attempt`.
 */
export function missesThisTask(model: ChildModel, d: number, next: () => number): boolean {
  return next() >= pFirstTry(model, d);
}
