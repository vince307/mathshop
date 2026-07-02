import type { SkillState } from "@/types";
import { COMPETENCIES, skillProgress } from "@/data/skills";
import { t } from "@/i18n";

/**
 * Child-facing skill progress (S-07): one oversized bar per competency showing the
 * current level and how far it has climbed toward the next, derived purely from
 * `skill_state` via `skillProgress`. Every label routes through `t.skills.*`
 * (L-003). Warm and factual — a mirror of learning, never a manipulative streak
 * or urgency device (guardrail).
 */
export function SkillBars({ skillState }: { skillState: SkillState }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-foreground text-lg font-bold">{t.skills.heading}</h2>
      <ul className="flex flex-col gap-4">
        {COMPETENCIES.map((competency) => {
          const { level, fraction, atMax } = skillProgress(skillState[competency].firstTryCorrect);
          const percent = Math.round(fraction * 100);
          return (
            <li key={competency} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-foreground font-bold">{t.skills[competency]}</span>
                <span className="text-primary text-sm font-bold">
                  {atMax ? t.skills.maxLabel : t.skills.levelLabel.replace("{level}", String(level))}
                </span>
              </div>
              <div
                className="bg-secondary/50 h-4 w-full overflow-hidden rounded-full"
                role="progressbar"
                aria-label={t.skills[competency]}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
              >
                <div className="bg-accent h-full rounded-full transition-all" style={{ width: `${percent}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
