/**
 * Named shop growth stages (F4). Client-safe and dependency-free apart from the
 * sibling upgrade catalogue (mirrors `src/data/upgrades.ts` / `src/data/shift.ts`):
 * no React, no Astro, no Supabase, so the same module serves a server-rendered
 * page today and an island later.
 *
 * This gives `child_profiles.business_level` a **name**. Thresholds are expressed
 * in the `business_level` domain, never in completed-shift counts, so
 * `SHIFTS_PER_LEVEL` (`src/data/shift.ts`) stays the single tuning knob and the
 * ladder cannot drift from the formula. `businessLevelForShifts` is deliberately
 * **uncapped** — capping it would make `recordShiftResult`'s `leveledUp` flag
 * permanently false and silence the level-up celebration forever. Saturation
 * happens here instead, in `stageForLevel`, at the presentation layer.
 * The thresholds are first-guess defaults — adjust after kid-testing; the
 * monotonicity/reachability invariants are locked in `tests/stages.test.ts`.
 *
 * ART DEVIATION FROM THE MOCKUP — deliberate, recorded, with an upgrade path.
 * The mockup shows a colour thumbnail per stage, but per-stage world artwork
 * exists for **zero** of the four worlds (the one asset that looks like it is a
 * single café-only composite of three stages with a baked-in connector). `Stage`
 * therefore has no `art` field, and the rail renders state with lucide icons plus
 * the app's own design tokens. To add art later: add `art?: string` here, ship
 * `public/illustrations/stage-<world>-<stageId>.webp` crops with `slice-map.md`
 * rows (`assets/` is gitignored, so crops must be committed under `public/`), and
 * flip `ShopArt`'s base `src` to `stage.art ?? world.image`. Same deliberation
 * covers two copy deviations in `t.stages` — do not "fix" them back to the
 * mockup: `oferta`'s name is world-neutral rather than the mockup's café-specific
 * one (which would tell a child in the bakery that their shop is now a café), and
 * `popyt`'s description does not promise the mockup's demand missions, because
 * demand missions do not exist. The strings themselves live in `src/i18n/pl.ts`
 * (L-003) — this file quotes none of them, deliberately.
 */
import type { Upgrade } from "@/data/upgrades";
import { UPGRADES } from "@/data/upgrades";

export interface Stage {
  /** Copy is resolved as `t.stages[id]` — the catalogue carries no literal copy (L-003). */
  id: string;
  /** Minimum `business_level` at which this stage is the current one. */
  requiredLevel: number;
  /** Display / progression order, 1-based. */
  order: number;
}

/**
 * The four stages, ordered. `requiredLevel` must stay **strictly increasing and
 * start at 1** — a fresh profile is `business_level = 1` and must resolve to the
 * first stage, never to nothing.
 */
export const STAGES: readonly Stage[] = [
  { id: "stolik", requiredLevel: 1, order: 1 },
  { id: "stoisko", requiredLevel: 2, order: 2 },
  { id: "oferta", requiredLevel: 3, order: 3 },
  { id: "popyt", requiredLevel: 4, order: 4 },
] as const;

/** Valid stage ids — the closed set for app-layer validation. */
export const STAGE_IDS = STAGES.map((s) => s.id) as [string, ...string[]];

const BY_ID = new Map(STAGES.map((s) => [s.id, s] as const));

export function getStage(id: string): Stage | undefined {
  return BY_ID.get(id);
}

/**
 * Where a level sits on the ladder. Mirrors `skillProgress`'s `{ …, atMax }`
 * shape (`src/data/skills.ts`) so the terminal case is a fact the caller reads,
 * not a comparison it has to re-derive.
 */
export interface StageProgress {
  stage: Stage;
  /** Index into `STAGES`. */
  index: number;
  /** True at the last stage — the caller renders no further node and no next-stage bar. */
  atMax: boolean;
}

/**
 * The highest stage whose `requiredLevel` is met. **Total and non-throwing by
 * contract**: a level below the first threshold, a negative, a non-integer, `NaN`
 * or `Infinity` all resolve to something renderable. This is what lets a child at
 * `business_level` 50 see stage 4 as current — no phantom fifth node, no bar that
 * can never fill — instead of a crash or a blank rail.
 */
export function stageForLevel(level: number): StageProgress {
  let index = 0;
  for (let i = 0; i < STAGES.length; i += 1) {
    // `NaN` fails every comparison, so it falls through to index 0 — intended.
    if (level >= STAGES[i].requiredLevel) index = i;
  }
  return { stage: STAGES[index], index, atMax: index === STAGES.length - 1 };
}

/**
 * The upgrades a stage unlocks, derived from the upgrade catalogue rather than a
 * second hand-maintained list — so "what this stage unlocks" has exactly one
 * source of truth. Returns `[]` at the terminal stage: nothing in `UPGRADES`
 * gates on level 4, and an honest empty is better than an invented promise.
 */
export function unlocksForStage(stage: Stage): readonly Upgrade[] {
  return UPGRADES.filter((u) => u.requiredWorldLevel === stage.requiredLevel);
}
