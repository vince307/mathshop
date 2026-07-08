/**
 * Business "worlds" — the closed set of interests the create-profile wizard
 * offers and the create-profile route validates as the `theme` value. `slug` is
 * stored in `child_profiles.theme`; the start screen resolves the themed
 * business art from it. Slugs match the committed `public/illustrations/`
 * stems, so `world-<slug>.webp` always resolves. The DB column default is
 * `'default'` → rendered as the fallback world (`kawiarnia`).
 *
 * (The `05` mockup labels the 4th interest "Sklep kolekcjonera"; the committed
 * art + slug are `sklep-ksiegarnia` — reconciled here to a single name↔slug↔art.)
 */
export interface World {
  slug: string;
  name: string;
  image: string;
}

/** Fallback world for the DB `theme` default ('default') / unknown values. */
export const DEFAULT_WORLD: World = {
  slug: "kawiarnia",
  name: "Kawiarnia",
  image: "/illustrations/world-kawiarnia.webp",
};
export const DEFAULT_THEME = DEFAULT_WORLD.slug;

export const WORLDS: readonly World[] = [
  DEFAULT_WORLD,
  { slug: "piekarnia", name: "Piekarnia", image: "/illustrations/world-piekarnia.webp" },
  { slug: "galaktyczna-baza", name: "Galaktyczna baza", image: "/illustrations/world-galaktyczna-baza.webp" },
  { slug: "sklep-ksiegarnia", name: "Sklep księgarnia", image: "/illustrations/world-sklep-ksiegarnia.webp" },
] as const;

/** Valid theme slugs — the closed set for app-layer (zod) validation. */
export const WORLD_SLUGS = WORLDS.map((w) => w.slug) as [string, ...string[]];

export function getWorld(slug: string): World | undefined {
  return WORLDS.find((w) => w.slug === slug);
}

/** Resolve a stored `theme` (incl. the DB default 'default') to a renderable world. */
export function worldForTheme(theme: string | null | undefined): World {
  return (theme ? getWorld(theme) : undefined) ?? DEFAULT_WORLD;
}
