import { cn } from "@/lib/utils";

/**
 * The child-surface card shell (S-13 primitive) — the `bg-card` + border +
 * soft-shadow language every mockup card uses. A class-builder rather than a
 * component so it composes into any element (.astro or .tsx) without
 * restructuring markup — extracting a wrapper component would risk splitting
 * native forms and keyed structures (plan invariant).
 */
export function childCard(radius: "2xl" | "3xl" = "2xl", className?: string): string {
  return cn("bg-card border-border border shadow-sm", radius === "3xl" ? "rounded-3xl" : "rounded-2xl", className);
}
