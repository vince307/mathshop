import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Large selectable tile for the wizard's avatar and interest pickers — a
 * child-primitive (oversized, non-adjacently-hittable tap target per
 * prd-v2.md:146). Selection is UI state: a ring + check badge, never baked into
 * the source art. `shape="circle"` for avatars, `"card"` for world tiles.
 */
interface SelectTileProps {
  selected: boolean;
  onSelect: () => void;
  image: string;
  alt: string;
  label?: string;
  shape?: "circle" | "card";
}

export function SelectTile({ selected, onSelect, image, alt, label, shape = "card" }: SelectTileProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="group flex flex-col items-center gap-2 rounded-2xl p-2 transition-all focus-visible:outline-none"
    >
      <span
        className={cn(
          "bg-card relative block overflow-hidden border-2 shadow-sm transition-all",
          shape === "circle" ? "size-20 rounded-full sm:size-24" : "aspect-[4/3] w-full rounded-2xl",
          selected
            ? "border-primary ring-primary/30 ring-4"
            : "border-border group-hover:border-primary/50 group-focus-visible:border-primary",
        )}
      >
        <img src={image} alt={alt} loading="lazy" className="size-full object-cover" />
        {selected && (
          <span className="bg-primary text-primary-foreground absolute right-1 bottom-1 inline-flex size-6 items-center justify-center rounded-full shadow">
            <Check className="size-4" />
          </span>
        )}
      </span>
      {label && (
        <span className={cn("text-sm font-semibold", selected ? "text-primary" : "text-foreground")}>{label}</span>
      )}
    </button>
  );
}
