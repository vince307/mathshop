import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { childCard } from "@/components/child/childCard";

/**
 * The gentle feedback/status card (S-13 primitive — absorbed TaskScreen's
 * retry/success twins): a soft card that fades in, with an optional zoom for
 * the success beat. Always `role="status"` — never punishing, never red.
 */
export function FeedbackCard({ zoom = false, children }: { zoom?: boolean; children: ReactNode }) {
  return (
    <div
      role="status"
      className={cn(childCard("2xl", "animate-in fade-in max-w-sm p-4 text-center"), zoom && "zoom-in-95")}
    >
      {children}
    </div>
  );
}
