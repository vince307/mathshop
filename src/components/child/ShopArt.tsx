import type { CSSProperties } from "react";
import type { World } from "@/data/worlds";
import { UPGRADES, isOwned } from "@/data/upgrades";

interface ShopArtProps {
  world: World;
  purchased: string[];
}

/**
 * Growth-in-scene slots (S-13): each owned upgrade's art sits at a fixed spot
 * IN the shop scene — a szyld up top, the register mid-right, customers by the
 * door — so the shop itself visibly grows as the child buys (the mockups'
 * world-progression language) instead of a badge row in the corner. Percent
 * coordinates against the art box; per-world overrides can join the default
 * map as the art demands. An upgrade with no slot falls back to the corner row.
 */
const DEFAULT_SLOTS: Partial<Record<string, CSSProperties>> = {
  sign: { left: "10%", top: "6%" },
  shelf: { left: "6%", top: "44%" },
  register: { right: "7%", top: "46%" },
  slot: { left: "44%", bottom: "5%" },
  storage: { left: "6%", bottom: "7%" },
  customers: { right: "6%", bottom: "7%" },
};
const WORLD_SLOTS: Partial<Record<string, Partial<Record<string, CSSProperties>>>> = {};

/**
 * The shop as it visibly stands (S-06): the base world art plus each owned
 * upgrade composited into the scene (S-13). Shared by the start screen
 * (rendered statically in `.astro`) and the upgrades island (React), so both
 * surfaces show the same grown shop. Derives from the catalog by id — the
 * catalog is the single source of truth. The base image is above-the-fold, so
 * it is NOT lazy-loaded (mirrors the prior start-screen image).
 */
export function ShopArt({ world, purchased }: ShopArtProps) {
  const owned = UPGRADES.filter((u) => isOwned(u.id, purchased));
  const placed = owned.filter((u) => WORLD_SLOTS[world.slug]?.[u.id] ?? DEFAULT_SLOTS[u.id]);
  const unplaced = owned.filter((u) => !(WORLD_SLOTS[world.slug]?.[u.id] ?? DEFAULT_SLOTS[u.id]));
  return (
    <div className="relative">
      <img src={world.image} alt={world.name} className="aspect-[4/3] w-full object-contain p-2" />
      {placed.map((u) => (
        <span
          key={u.id}
          style={WORLD_SLOTS[world.slug]?.[u.id] ?? DEFAULT_SLOTS[u.id]}
          className="bg-card/90 border-border absolute flex size-10 items-center justify-center rounded-full border shadow-sm"
        >
          <img src={u.art} alt="" loading="lazy" className="size-7 object-contain" />
        </span>
      ))}
      {unplaced.length > 0 && (
        <div className="absolute bottom-2 left-2 flex flex-wrap gap-1.5">
          {unplaced.map((u) => (
            <span
              key={u.id}
              className="bg-card/90 border-border flex size-9 items-center justify-center rounded-full border shadow-sm"
            >
              <img src={u.art} alt="" loading="lazy" className="size-6 object-contain" />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
