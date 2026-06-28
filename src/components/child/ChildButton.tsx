import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Oversized, child-accessible button — the first child-primitive (PRD oversized
 * tap-target rule, prd-v2.md:146). Min 64px tall with large text and generous
 * padding so a 6–8yo's tap reliably lands. The S-02+ child surfaces reuse this.
 */
interface ChildButtonProps extends React.ComponentProps<"button"> {
  variant?: "primary" | "gold" | "outline";
}

export function ChildButton({ className, variant = "primary", type = "button", ...props }: ChildButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-16 items-center justify-center gap-3 rounded-2xl px-8 text-xl font-bold shadow-sm transition-all",
        "focus-visible:ring-ring focus-visible:ring-4 focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:size-6 [&_svg]:shrink-0",
        variant === "primary" && "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "gold" && "bg-accent text-accent-foreground hover:bg-accent/90",
        variant === "outline" && "border-input text-foreground hover:bg-muted bg-background border-2",
        className,
      )}
      {...props}
    />
  );
}
