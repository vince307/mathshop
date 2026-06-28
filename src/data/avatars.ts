/**
 * Pre-set child avatars (FR-001). The closed set the create-profile flow offers
 * and the create-profile route validates against. `id` is a stable lowercase
 * slug — the value stored in `child_profiles.avatar`; `name`/`alt` are Polish
 * locale content (kept here, not in the i18n dictionary, since they pair with a
 * specific image asset). Art is sliced into `public/avatars/` — see
 * `public/avatars/slice-map.md`. Raster + swappable.
 *
 * Note: the mockup's avatar row has 5 faces but the selected one carries baked-in
 * selection chrome and was omitted; this is the clean v1 set. The avatar's name
 * does NOT double as the profile name in v1 — the child's name is collected
 * separately by the wizard (product-owner decision; see the change's research.md).
 */
export interface Avatar {
  /** Stable slug; stored in child_profiles.avatar. */
  id: string;
  /** Polish display label. */
  name: string;
  /** Public path to the avatar art. */
  image: string;
  /** Polish alt text for accessibility. */
  alt: string;
}

export const AVATARS: readonly Avatar[] = [
  { id: "kuba", name: "Kuba", image: "/avatars/kuba.png", alt: "Awatar dziecka z ciemnymi włosami" },
  { id: "zosia", name: "Zosia", image: "/avatars/zosia.png", alt: "Awatar dziecka z jasnymi włosami" },
  { id: "tomek", name: "Tomek", image: "/avatars/tomek.png", alt: "Awatar dziecka w okularach" },
  { id: "ola", name: "Ola", image: "/avatars/ola.png", alt: "Awatar dziewczynki z ciemnymi włosami" },
] as const;

/** The valid avatar ids — the closed set for app-layer (zod) validation. */
export const AVATAR_IDS = AVATARS.map((a) => a.id) as [string, ...string[]];

export function getAvatar(id: string): Avatar | undefined {
  return AVATARS.find((a) => a.id === id);
}
