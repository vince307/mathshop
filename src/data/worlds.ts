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
 *
 * Second reconciliation, worlds five and six (W1). The `01-world-selection`
 * **web** mockup labels them "Salon kreatywny" and "Laboratorium wynalazków";
 * the **mobile** mockup of the same set labels world six plain "Laboratorium".
 * The committed names are **Pracownia** and **Laboratorium** because slug,
 * `public/illustrations/world-<slug>.webp` stem and the stored `theme` value
 * must stay ONE string — `tests/worlds-art.test.ts` pins exactly that. So the
 * difference from the web mockup's longer labels is a deliberate name↔slug↔art
 * reconciliation, not drift.
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
  // Worlds five and six (W1) — APPENDED, never inserted: `e2e/onboarding.spec.ts`
  // walks `WORLDS[0]` and `WORLD_SLUGS` order is asserted against `WORLDS.map`.
  { slug: "pracownia", name: "Pracownia", image: "/illustrations/world-pracownia.webp" },
  { slug: "laboratorium", name: "Laboratorium", image: "/illustrations/world-laboratorium.webp" },
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
