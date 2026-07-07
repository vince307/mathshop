import type { CountingTask as CountingTaskInstance } from "@/types";
import type { World } from "@/data/worlds";
import { TaskScreen } from "@/components/child/TaskScreen";
import { StoryHeader } from "@/components/child/StoryHeader";
import type { TaskOutcome } from "@/components/hooks/useCoinTask";
import { t } from "@/i18n";

interface CountingTaskProps {
  task: CountingTaskInstance;
  world: World;
  onComplete?: (outcome: TaskOutcome) => void;
}

/**
 * Counting-task adapter (S-02). Maps a CountingTask onto the shared TaskScreen:
 * the child taps every coin in the till, so the target is the number of coins
 * shown. Behavior is unchanged from the original island — TaskScreen now owns
 * the tap/tally/retry/success mechanic.
 */
export default function CountingTask({ task, world, onComplete }: CountingTaskProps) {
  const copy = t.task[task.scenario];
  return (
    <TaskScreen
      coinCount={task.targetCount}
      target={task.targetCount}
      arrangement={task.arrangement}
      hintCopy={copy.hint}
      successCopy={copy.success}
      onComplete={onComplete}
      renderHeader={() => <StoryHeader world={world} story={copy.prompt} question={copy.question} />}
    />
  );
}
