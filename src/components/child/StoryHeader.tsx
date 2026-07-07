import type { World } from "@/data/worlds";
import { cn } from "@/lib/utils";

/**
 * Shared task narrative header (S-13 primitive — promoted out of
 * ChangeMakingTask; CountingTask's inline header was its strict subset): world
 * chip, optional stage label, story line (highlighted while the scaffolding
 * hint shows), and the question.
 */
interface StoryHeaderProps {
  world: World;
  story: string;
  question: string;
  showHint?: boolean;
  stageLabel?: string;
}

export function StoryHeader({ world, story, question, showHint = false, stageLabel }: StoryHeaderProps) {
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
