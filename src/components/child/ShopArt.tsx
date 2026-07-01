import type { World } from "@/data/worlds";
import { UPGRADES, isOwned } from "@/data/upgrades";

interface ShopArtProps {
  world: World;
  purchased: string[];
}

/**
 * The shop as it visibly stands (S-06): the base world art plus a badge for each
 * owned upgrade, so the shop grows on screen as the child buys. Shared by the
 * start screen (rendered statically in `.astro`) and the upgrades island (React),
 * so both surfaces show the same grown shop. Derives the badge set from the
 * catalog by id — the catalog is the single source of truth. The base image is
 * above-the-fold, so it is NOT lazy-loaded (mirrors the prior start-screen image).
 */
export function ShopArt({ world, purchased }: ShopArtProps) {
  const owned = UPGRADES.filter((u) => isOwned(u.id, purchased));
  return (
    <div className="relative">
      <img src={world.image} alt={world.name} className="aspect-[4/3] w-full object-cover" />
      {owned.length > 0 && (
        <div className="absolute bottom-2 left-2 flex flex-wrap gap-1.5">
          {owned.map((u) => (
            <span
              key={u.id}
              className="bg-card/90 border-border flex size-9 items-center justify-center rounded-full border shadow-sm"
            >
              <img src={u.art} alt="" className="size-6 object-contain" />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
