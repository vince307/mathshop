import type { ReactNode } from "react";
import type { World } from "@/data/worlds";
import { cn } from "@/lib/utils";

/**
 * Shared task narrative header (S-13 primitive — promoted out of
 * ChangeMakingTask; CountingTask's inline header was its strict subset): world
 * chip, optional stage label, story line (highlighted while the scaffolding
 * hint shows), and the question.
 *
 * Receipt emphasis (S-13): when `values` is given, the story is passed as the
 * RAW i18n template and each `{token}` renders as an oversized gold numeral
 * (gold = money in the design grammar) with a dashed receipt divider before
 * the question — the mockup's receipt language without any copy change.
 */
interface StoryHeaderProps {
  world: World;
  story: string;
  question: string;
  showHint?: boolean;
  stageLabel?: string;
  /** Interpolation values; presence switches the story into receipt emphasis. */
  values?: Record<string, number>;
}

function renderStory(story: string, values?: Record<string, number>): ReactNode {
  if (!values) return story;
  return story.split(/(\{[a-z]+\})/i).map((part, i) => {
    const token = /^\{([a-z]+)\}$/i.exec(part);
    if (token && token[1] in values) {
      return (
        <span key={i} className="text-accent px-0.5 align-baseline text-2xl font-extrabold">
          {values[token[1]]}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function StoryHeader({ world, story, question, showHint = false, stageLabel, values }: StoryHeaderProps) {
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
        {renderStory(story, values)}
      </p>
      {values && <div className="border-border mx-auto my-2 w-24 border-t-2 border-dashed" aria-hidden="true" />}
      <p className="text-muted-foreground mt-1">{question}</p>
    </div>
  );
}
