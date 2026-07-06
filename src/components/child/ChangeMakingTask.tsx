import { useState } from "react";
import type { ChangeMakingTask as ChangeMakingTaskInstance } from "@/types";
import type { World } from "@/data/worlds";
import { TaskScreen } from "@/components/child/TaskScreen";
import type { TaskOutcome } from "@/components/hooks/useCoinTask";
import { SCATTER_MAX } from "@/data/counting-tasks";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

interface ChangeMakingTaskProps {
  task: ChangeMakingTaskInstance;
  world: World;
  onComplete?: (outcome: TaskOutcome) => void;
}

/** Shared narrative header: world chip, optional stage label, story (highlighted on hint), question. */
function StoryHeader({
  world,
  story,
  question,
  showHint,
  stageLabel,
}: {
  world: World;
  story: string;
  question: string;
  showHint: boolean;
  stageLabel?: string;
}) {
  return (
    <div className="text-center">
      <p className="text-primary text-sm font-bold tracking-wide uppercase">{world.name}</p>
      {stageLabel && (
        <p className="text-muted-foreground mt-1 text-xs font-bold tracking-wide uppercase">{stageLabel}</p>
      )}
      <p
        className={cn(
          "text-foreground mt-1 text-xl font-bold transition-colors",
          showHint && "bg-accent/30 rounded-lg px-2 py-1",
        )}
      >
        {story}
      </p>
      <p className="text-muted-foreground mt-1">{question}</p>
    </div>
  );
}

/**
 * Two-stage "stock then sell" orchestration (S-08). Stage 1: count the item's
 * `price` into the register from a tray of `stockCount`; stage 2: give the
 * `change` from `availableCount`. Each stage is its own `TaskScreen` (keyed, so
 * the board/retry/hint state remounts fresh), and the task's `onComplete` fires
 * once with the aggregate: first-try only if both stages were, misses summed.
 */
function StockAndChangeTask({ task, world, onComplete }: ChangeMakingTaskProps) {
  const [stageOne, setStageOne] = useState<TaskOutcome | null>(null);
  const copy = t.task.stock_and_change;
  // The generator always sets `stockCount` for this scenario; fall back defensively.
  const stockCount = task.stockCount ?? task.price + 1;

  if (stageOne === null) {
    const stage = copy.stage1;
    return (
      <TaskScreen
        key="stage-1"
        coinCount={stockCount}
        target={task.price}
        arrangement={stockCount <= SCATTER_MAX ? "scatter" : "rows_of_5"}
        hintCopy={stage.hint.replace("{price}", String(task.price))}
        successCopy={stage.success}
        onComplete={setStageOne}
        renderHeader={(showHint) => (
          <StoryHeader
            world={world}
            stageLabel={copy.stageLabel.replace("{step}", "1")}
            story={stage.story.replace("{price}", String(task.price))}
            question={stage.question}
            showHint={showHint}
          />
        )}
      />
    );
  }

  const stage = copy.stage2;
  return (
    <TaskScreen
      key="stage-2"
      coinCount={task.availableCount}
      target={task.change}
      arrangement={task.arrangement}
      hintCopy={stage.hint}
      successCopy={stage.success}
      onComplete={(stageTwo) => {
        const outcome = {
          firstTry: stageOne.firstTry && stageTwo.firstTry,
          misses: stageOne.misses + stageTwo.misses,
        };
        // Mirror useCoinTask's default completion for the standalone case.
        if (onComplete) onComplete(outcome);
        else window.location.href = "/app/start";
      }}
      renderHeader={(showHint) => (
        <StoryHeader
          world={world}
          stageLabel={copy.stageLabel.replace("{step}", "2")}
          story={stage.story.replace("{paid}", String(task.paid)).replace("{price}", String(task.price))}
          question={stage.question}
          showHint={showHint}
        />
      )}
    />
  );
}

/**
 * Change-making adapter (S-03). The child gives the customer their change by
 * tapping coins from a tray of `availableCount`, so the target is `change`. The
 * header tells the customer story (paid / price); when the hint surfaces, the
 * story line is highlighted to cue the count-up-from-price strategy (FR-009),
 * alongside the hint copy in the retry card. The two-stage `stock_and_change`
 * scenario (S-08, tier 3 only) routes to its own stage orchestrator.
 */
export default function ChangeMakingTask({ task, world, onComplete }: ChangeMakingTaskProps) {
  if (task.scenario === "stock_and_change") {
    return <StockAndChangeTask task={task} world={world} onComplete={onComplete} />;
  }
  const copy = t.task[task.scenario];
  const story = copy.story.replace("{paid}", String(task.paid)).replace("{price}", String(task.price));
  return (
    <TaskScreen
      coinCount={task.availableCount}
      target={task.change}
      arrangement={task.arrangement}
      hintCopy={copy.hint}
      successCopy={copy.success}
      onComplete={onComplete}
      renderHeader={(showHint) => (
        <StoryHeader world={world} story={story} question={copy.question} showHint={showHint} />
      )}
    />
  );
}
