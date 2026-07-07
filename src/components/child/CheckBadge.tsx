import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The mini selected-state check disc (S-13 primitive — absorbed the near-twins
 * in CoinBoard and SelectTile). Position/size come from the caller so each
 * instance keeps its exact current geometry.
 */
export function CheckBadge({ className, iconClassName = "size-3" }: { className?: string; iconClassName?: string }) {
  return (
    <span
      className={cn(
        "bg-primary text-primary-foreground absolute inline-flex items-center justify-center rounded-full shadow",
        className,
      )}
    >
      <Check className={iconClassName} />
    </span>
  );
}
