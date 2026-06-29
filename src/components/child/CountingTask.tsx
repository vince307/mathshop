import type { CountingTask as CountingTaskInstance } from "@/types";
import type { World } from "@/data/worlds";
import { TaskScreen } from "@/components/child/TaskScreen";
import { t } from "@/i18n";

interface CountingTaskProps {
  task: CountingTaskInstance;
  world: World;
}

/**
 * Counting-task adapter (S-02). Maps a CountingTask onto the shared TaskScreen:
 * the child taps every coin in the till, so the target is the number of coins
 * shown. Behavior is unchanged from the original island — TaskScreen now owns
 * the tap/tally/retry/success mechanic.
 */
export default function CountingTask({ task, world }: CountingTaskProps) {
  const copy = t.task[task.scenario];
  return (
    <TaskScreen
      coinCount={task.targetCount}
      target={task.targetCount}
      arrangement={task.arrangement}
      hintCopy={copy.hint}
      successCopy={copy.success}
      renderHeader={() => (
        <div className="text-center">
          <p className="text-primary text-sm font-bold tracking-wide uppercase">{world.name}</p>
          <p className="text-foreground mt-1 text-xl font-bold">{copy.prompt}</p>
          <p className="text-muted-foreground mt-1">{copy.question}</p>
        </div>
      )}
    />
  );
}
