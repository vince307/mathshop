import type { ChangeMakingTask as ChangeMakingTaskInstance } from "@/types";
import type { World } from "@/data/worlds";
import { TaskScreen } from "@/components/child/TaskScreen";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

interface ChangeMakingTaskProps {
  task: ChangeMakingTaskInstance;
  world: World;
}

/**
 * Change-making adapter (S-03). The child gives the customer their change by
 * tapping coins from a tray of `availableCount`, so the target is `change`. The
 * header tells the customer story (paid / price); when the hint surfaces, the
 * story line is highlighted to cue the count-up-from-price strategy (FR-009),
 * alongside the hint copy in the retry card.
 */
export default function ChangeMakingTask({ task, world }: ChangeMakingTaskProps) {
  const copy = t.task.give_change;
  const story = copy.story.replace("{paid}", String(task.paid)).replace("{price}", String(task.price));
  return (
    <TaskScreen
      coinCount={task.availableCount}
      target={task.change}
      arrangement={task.arrangement}
      hintCopy={copy.hint}
      successCopy={copy.success}
      renderHeader={(showHint) => (
        <div className="text-center">
          <p className="text-primary text-sm font-bold tracking-wide uppercase">{world.name}</p>
          <p
            className={cn(
              "text-foreground mt-1 text-xl font-bold transition-colors",
              showHint && "bg-accent/30 rounded-lg px-2 py-1",
            )}
          >
            {story}
          </p>
          <p className="text-muted-foreground mt-1">{copy.question}</p>
        </div>
      )}
    />
  );
}
