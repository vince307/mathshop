/**
 * The continuous difficulty scale (adaptive-task-engine P3). Pure and
 * dependency-free — no React, no Supabase, no i18n — mirroring
 * `src/data/skills.ts`: the page generates from it, the shift-completion route
 * recomputes from it, and both must agree by construction rather than by two
 * hand-kept copies.
 *
 * `d ∈ [0, 1]` per competency replaces the three frozen tiers. The scale is
 * **calibrated, not invented**: `d = 0` reproduces today's tier-1 parameters
 * exactly, `d = 0.5` tier 2, `d = 1` tier 3, and every generator parameter
 * interpolates piecewise-linearly between those three anchors. That exactness is
 * what lets phases 3–4 ship with the child seeing nothing change — including the
 * four e2e executions that assert on the tier-1 earnings/star envelope, where one
 * task of drift in shift length silently flips which upgrade is affordable.
 *
 * All tunables here are **first-guess named constants**. They need kid-testing;
 * P1's telemetry (`task_attempt`) exists precisely so they can be tuned on
 * evidence instead of re-guessed.
 */
import type { PlayCompetency } from "@/types";

export type { PlayCompetency } from "@/types";

/** Floor of the scale — today's tier-1 parameter set. */
export const DIFFICULTY_MIN = 0;
/** Ceiling of the scale — today's tier-3 parameter set. */
export const DIFFICULTY_MAX = 1;

/**
 * Canonical order of the competencies difficulty is held per — the closed set
 * `readDifficultyState` fills. `decisions` is absent because it accrues at
 * purchase, not from a task, so there is no task difficulty to adapt.
 */
export const ADAPTIVE_COMPETENCIES: readonly PlayCompetency[] = ["math", "money"] as const;

/**
 * Persisted per-competency difficulty, held in `child_profiles.difficulty_state`
 * jsonb — deliberately **outside** `skill_state`, which is documented monotonic
 * and gates upgrades (S-07). `d` is not monotonic; putting it there would either
 * break that guarantee or be silently dropped by `readSkillState`, which
 * reconstructs its rows from a fixed three-field shape.
 */
export type DifficultyState = Record<PlayCompetency, number>;

/** Clamp any value onto the scale. Non-finite input floors to `DIFFICULTY_MIN`. */
export function clampDifficulty(d: number): number {
  if (!Number.isFinite(d)) return DIFFICULTY_MIN;
  return Math.min(DIFFICULTY_MAX, Math.max(DIFFICULTY_MIN, d));
}

/**
 * Map a profile's stored `starting_level` (1|2|3, see `deriveStartingLevel`) to a
 * legacy difficulty tier. Out-of-range values clamp into the band.
 *
 * **This is now a seeding concern only.** It lives here rather than in
 * `counting-tasks.ts` because its one remaining caller is `seedDifficultyFor`:
 * age is the best first approximation of a fresh profile's difficulty, and stops
 * being the source of truth the moment play begins. (It also has to live below
 * the generators to keep the import graph acyclic — they now import this module.)
 */
export function tierForLevel(startingLevel: number): 1 | 2 | 3 {
  return startingLevel >= 3 ? 3 : startingLevel >= 2 ? 2 : 1;
}

/**
 * Where each legacy tier sits on the continuous scale. These three points are the
 * calibration: `acrossTiers` reproduces a tier's parameters EXACTLY at its anchor,
 * so `seedDifficultyFor(1)` is indistinguishable from today's tier-1 generation.
 */
export const TIER_ANCHOR: Record<1 | 2 | 3, number> = { 1: 0, 2: 0.5, 3: 1 };

/**
 * A fresh (or never-adapted) profile's difficulty, per competency. Both start at
 * the same point — nothing yet distinguishes a child's counting from their
 * change-making; play is what separates them.
 */
export function seedDifficultyFor(startingLevel: number): DifficultyState {
  const seed = TIER_ANCHOR[tierForLevel(startingLevel)];
  return { math: seed, money: seed };
}

/**
 * Upper bound on `d` for a profile, derived from its (frozen) `starting_level`.
 * This is the **pedagogical guardrail**: no streak of perfect answers may carry a
 * child past their age band.
 *
 * Levels 1–2 share a ceiling on purpose. The grades 1–2 band is "never exceed
 * ~20" (FR-007) and that is precisely tier 2's parameter set, so `d = 0.5` is the
 * band ceiling for both — a level-1 child can grow into the tier-2 envelope, a
 * level-2 child is already at the top of theirs and can only move down. Tier 3
 * (age 9) is the only cohort the ≤ 25 widening applies to. Consequence, accepted
 * and recorded in the plan's Open Risks: a child who genuinely outgrows their band
 * cannot be promoted, because `starting_level` is frozen by an S-04 guardrail.
 */
export function ceilingForLevel(startingLevel: number): number {
  return tierForLevel(startingLevel) >= 3 ? TIER_ANCHOR[3] : TIER_ANCHOR[2];
}

/**
 * Normalize the persisted `difficulty_state` (jsonb, possibly `{}`, missing keys,
 * or predating the column) into a fully-populated shape, exactly as
 * `readSkillState` does for skills — missing, malformed or off-scale values fall
 * back to the `starting_level`-derived seed, and everything is clamped into
 * `[0, ceilingForLevel(startingLevel)]`.
 *
 * Unlike `readSkillState` this takes `startingLevel` explicitly: it is never used
 * as a zeroed accumulator, so there is no call site the extra argument costs.
 * Always returns a fresh object.
 */
export function readDifficultyState(state: unknown, startingLevel: number): DifficultyState {
  const src = (state ?? {}) as Partial<Record<PlayCompetency, unknown>>;
  const seed = seedDifficultyFor(startingLevel);
  const ceiling = ceilingForLevel(startingLevel);
  const out = {} as DifficultyState;
  for (const competency of ADAPTIVE_COMPETENCIES) {
    const raw = src[competency];
    // Off-scale or non-numeric means the value was never ours — fall back to the
    // seed rather than to a clamp of garbage, then bound by the age band.
    const onScale =
      typeof raw === "number" && Number.isFinite(raw) && raw >= DIFFICULTY_MIN && raw <= DIFFICULTY_MAX
        ? raw
        : seed[competency];
    out[competency] = Math.min(ceiling, Math.max(DIFFICULTY_MIN, onScale));
  }
  return out;
}

/**
 * Piecewise-linear interpolation across the three tier anchors: `t1` at `d = 0`,
 * `t2` at `d = 0.5`, `t3` at `d = 1`, rounded to a whole number. Rounding is what
 * makes each anchor land on its legacy tier value exactly.
 */
function acrossTiers(d: number, t1: number, t2: number, t3: number): number {
  const x = clampDifficulty(d);
  const mid = TIER_ANCHOR[2];
  if (x <= mid) return Math.round(t1 + (t2 - t1) * (x / mid));
  return Math.round(t2 + (t3 - t2) * ((x - mid) / (DIFFICULTY_MAX - mid)));
}

/**
 * Inclusive count band for a counting task at difficulty `d` (was `COUNT_RANGE`).
 * The band — not a single value — is deliberate: at a fixed `d` a child would
 * otherwise be shown the same number over and over.
 */
export function countRangeFor(d: number): { min: number; max: number } {
  return { min: acrossTiers(d, 3, 6, 10), max: acrossTiers(d, 10, 20, 25) };
}

/** Max change (paid − price) at difficulty `d` (was `CHANGE_CAP`). */
export function changeCapFor(d: number): number {
  return acrossTiers(d, 5, 10, 15);
}

/** Ceiling for the amount paid at difficulty `d` (was `PAID_MAX`). */
export function paidMaxFor(d: number): number {
  return acrossTiers(d, 10, 20, 30);
}

/**
 * Round a picked value and clamp it into an inclusive band — the absolute safe
 * bound every generator applies on top of its picker, so a misbehaving or
 * adversarial picker can never produce an out-of-band task.
 *
 * **Non-finite input floors to `min` rather than clamping.** `Math.max(min, NaN)`
 * is `NaN`, so the naive clamp silently passes a broken picker straight through
 * into `targetCount` — and a task whose answer is `NaN` can never be completed
 * (`isCorrect` compares for equality), stranding the child mid-shift with no
 * error and no way out. Failing to the easiest legal task is the only safe
 * direction here.
 */
export function clampToBand(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Inclusive task-count band for a shift at difficulty `d` (was `SHIFT_LENGTH`, FR-006). */
export function shiftLengthRangeFor(d: number): { min: number; max: number } {
  return { min: acrossTiers(d, 5, 8, 9), max: acrossTiers(d, 7, 10, 12) };
}

/**
 * The `d` at or above which the two-stage `stock_and_change` scenario becomes
 * admissible (S-08).
 *
 * This is a **scenario-admission** bound and it is unlike every other guard here.
 * Warm-up, the post-miss cooldown, the per-shift drift clamp and
 * `ceilingForLevel` all bound the MAGNITUDE of the numbers; none of them can keep
 * a multi-step task away from a six-year-old. Today's `difficultyTier === 3` test
 * makes the scenario *structurally* unreachable below level 3; a threshold makes
 * it reachable by drift, so the invariant below is what restores that guarantee:
 *
 *     ceilingForLevel(2) < TWO_STAGE_THRESHOLD
 *
 * asserted in `tests/adaptive.test.ts`. Set above the grades 1–2 band ceiling with
 * margin, and below the tier-3 anchor so a struggling level-3 child drops back to
 * single-stage rather than being pinned to a task shape they are losing on.
 */
export const TWO_STAGE_THRESHOLD = 0.75;

/**
 * The first-try success rate the engine steers toward. ~0.8 keeps a child mostly
 * winning while still meeting something they have to work at.
 */
export const TARGET_SUCCESS = 0.8;

/**
 * How far one scored task can move `d`. **Asymmetric by construction**: a miss
 * moves `d` down `ADAPT_RATE * TARGET_SUCCESS` (0.04) while a clean answer moves
 * it up only `ADAPT_RATE * (1 - TARGET_SUCCESS)` (0.01) — four times as fast down
 * as up. With a child that asymmetry is the point: back off quickly, tighten
 * cautiously.
 */
export const ADAPT_RATE = 0.05;

/** Most `d` may move across ONE shift. One bad session can't sink a profile; one lucky streak can't launch it. */
export const MAX_SHIFT_DRIFT = 0.15;

/**
 * How much easier the shift's closing task is generated (the "end on a win"
 * guard). A named constant rather than a tier step, because the scale is
 * continuous. The task still scores and still records telemetry — only its
 * generation difficulty is lowered.
 */
export const FINAL_TASK_RELIEF = 0.1;

/** The only thing the adaptation rule reads from an outcome — `misses` is deliberately excluded. */
export interface DifficultyOutcome {
  firstTry: boolean;
}

/** Everything the four guards need that a single outcome does not carry. */
export interface DifficultyContext {
  /** 0-based position, within the shift, of the task being folded. Index 0 is the warm-up. */
  index: number;
  /** `d` for this competency at the START of the shift — the drift clamp's anchor. */
  shiftStartDifficulty: number;
  /** Age-band bound, from `ceilingForLevel`. */
  ceiling: number;
  /** Whether the PREVIOUS task in this shift was missed — the post-miss cooldown. */
  afterMiss: boolean;
}

/**
 * Fold one scored task into `d`:
 *
 *     d += ADAPT_RATE * (observed − TARGET_SUCCESS)
 *
 * with `observed ∈ {0, 1}` from `firstTry`. Because a miss costs four times what
 * a success earns, the fixed point of the rule is a first-try rate of
 * `TARGET_SUCCESS`.
 *
 * **`misses` is deliberately not in the rule.** A task missed five times is a
 * stronger signal than one missed once and it is tempting to weight it — but that
 * weighting would be a guess. `misses` is recorded in `task_attempt` instead, and
 * the rule gets tuned on real data. This is the whole reason P1 shipped first.
 *
 * Four guards sit on top, in this order:
 *  1. **Warm-up** — the shift's first task never moves `d`; the child needs to
 *     settle in before being measured.
 *  2. **Post-miss cooldown** — the task straight after a missed one can only lower
 *     `d`, never raise it. Without this the engine oscillates.
 *  3. **Per-shift drift clamp** — `|d − shiftStart| ≤ MAX_SHIFT_DRIFT`.
 *  4. **Age-band ceiling** — the pedagogical guardrail; also floors at 0.
 *
 * Pure: same inputs, same output. That is what lets the server recompute `d` from
 * the reported attempts in P5 instead of trusting a client-supplied value.
 */
export function nextDifficulty(d: number, outcome: DifficultyOutcome, context: DifficultyContext): number {
  const bound = (value: number) => Math.min(context.ceiling, Math.max(DIFFICULTY_MIN, value));
  // Guard 1 — warm-up. Still bounded, so a profile loaded above a lowered ceiling
  // is corrected rather than carried.
  if (context.index <= 0) return bound(d);

  let delta = ADAPT_RATE * ((outcome.firstTry ? 1 : 0) - TARGET_SUCCESS);
  // Guard 2 — post-miss cooldown.
  if (context.afterMiss && delta > 0) delta = 0;

  // Guard 3 — per-shift drift clamp, measured from where the shift started.
  const drifted = Math.min(
    context.shiftStartDifficulty + MAX_SHIFT_DRIFT,
    Math.max(context.shiftStartDifficulty - MAX_SHIFT_DRIFT, d + delta),
  );
  // Guard 4 — age band.
  return bound(drifted);
}

/**
 * A seeded pseudo-random source. `pick` matches the generators' existing
 * injectable picker signature exactly, so a seed threads through the whole
 * generation chain without any generator knowing it is being replayed — which is
 * what makes P4's lazy client-side generation reproducible from a single number
 * the server sends.
 */
export interface SeededRandom {
  /** Inclusive integer pick, matching `(min, max) => number`. */
  pick: (min: number, max: number) => number;
  /** Bernoulli draw — binds to `pickTwoStage`'s `() => boolean` signature. */
  chance: (probability: number) => boolean;
}

/**
 * mulberry32 — a 32-bit PRNG chosen for being tiny, dependency-free and
 * deterministic across engines (the server draws task 1 and the client draws the
 * rest from the same seed, so "same everywhere" is a correctness requirement, not
 * a nicety). Not cryptographic, and it does not need to be: the worst a child can
 * do by predicting it is know their next task.
 */
export function createSeededRandom(seed: number): SeededRandom {
  let state = Math.floor(seed) >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    pick: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (probability) => next() < probability,
  };
}
