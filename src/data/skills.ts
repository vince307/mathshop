/**
 * Skill-progress core (S-07). Pure and dependency-free (no i18n / React /
 * Supabase — mirrors `src/data/shift.ts` / `src/data/upgrades.ts`): the single
 * shared source of truth for competencies, the count→level ladder, and the
 * monotonic state merge. Imported by the client (display), the shift-complete
 * route (authority), and the buy route (decisions competency + gate), so all
 * sides agree by construction. Thresholds are first-guess named constants —
 * tune after kid-testing.
 */
import type { Competency, CompetencyProgress, SkillState } from "@/types";
import type { TaskType } from "@/data/tasks";

export type { Competency, CompetencyProgress, SkillState } from "@/types";

/** The competencies in canonical order — the closed set `readSkillState` fills. */
export const COMPETENCIES: readonly Competency[] = ["math", "money", "decisions"] as const;

/**
 * Which competency a shift task exercises: counting → math, change-making → money.
 * (The `decisions` competency accrues at purchase, not from a task — see the buy
 * path.) Total over `TaskType`, so it never returns `decisions`.
 */
export function competencyForTaskType(type: TaskType): Competency {
  return type === "counting" ? "math" : "money";
}

/**
 * Monotonic level ladder: the `firstTryCorrect` counts at which each successive
 * skill level is reached. A fresh profile (0 first-try) is level 0; passing the
 * first threshold is level 1, and so on. First-guess, tunable.
 */
export const SKILL_THRESHOLDS: readonly number[] = [3, 8, 15, 25, 40] as const;

/** Skill level = how many thresholds the first-try count has passed (0..len). */
export function skillLevel(firstTryCorrect: number): number {
  return SKILL_THRESHOLDS.filter((threshold) => firstTryCorrect >= threshold).length;
}

/** Coerce a persisted jsonb number to a safe non-negative integer (missing/garbage → 0). */
function safeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * A partial per-competency delta — the shape the shift POSTs (`{ math, money }`)
 * and the buy path adds (`{ decisions }`). Every field optional so callers name
 * only what they touch.
 */
export type SkillDelta = Partial<Record<Competency, Partial<CompetencyProgress>>>;

/**
 * Normalize the persisted `skill_state` (jsonb, possibly `{}`, missing keys, or
 * predating the column) into a fully-zeroed per-competency shape, so gate +
 * report code never has to null-check. Always returns a fresh object.
 */
export function readSkillState(skillState: unknown): SkillState {
  const src = (skillState ?? {}) as Partial<Record<Competency, Partial<CompetencyProgress>>>;
  const out = {} as SkillState;
  for (const competency of COMPETENCIES) {
    const row = src[competency] ?? {};
    out[competency] = {
      firstTryCorrect: safeCount(row.firstTryCorrect),
      completed: safeCount(row.completed),
      misses: safeCount(row.misses),
    };
  }
  return out;
}

/**
 * Fold a (capped, server-trusted) delta into the current state, per competency
 * and per field. **Monotonic by construction**: deltas are coerced non-negative
 * and added, so no field can ever decrease — this is what satisfies "spending /
 * attempts never regress skill progress" (PRD guardrail). Returns a fresh state.
 */
export function addSkillDelta(current: SkillState, delta: SkillDelta): SkillState {
  const base = readSkillState(current);
  const out = {} as SkillState;
  for (const competency of COMPETENCIES) {
    const d = delta[competency] ?? {};
    out[competency] = {
      firstTryCorrect: base[competency].firstTryCorrect + safeCount(d.firstTryCorrect),
      completed: base[competency].completed + safeCount(d.completed),
      misses: base[competency].misses + safeCount(d.misses),
    };
  }
  return out;
}

/** Derive the current level of every competency from its first-try count. */
export function skillLevelsFor(state: SkillState): Record<Competency, number> {
  const normalized = readSkillState(state);
  const out = {} as Record<Competency, number>;
  for (const competency of COMPETENCIES) {
    out[competency] = skillLevel(normalized[competency].firstTryCorrect);
  }
  return out;
}
