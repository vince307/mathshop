import type { LucideIcon } from "lucide-react";
import {
  Armchair,
  Atom,
  Bell,
  BookOpen,
  Cake,
  Coffee,
  Croissant,
  Feather,
  FlaskConical,
  Flower2,
  Frame,
  Gift,
  Lamp,
  Leaf,
  Microscope,
  Moon,
  Orbit,
  Palette,
  PartyPopper,
  Percent,
  Ribbon,
  Rocket,
  Satellite,
  Scissors,
  Scroll,
  Sparkles,
  Spool,
  Star,
  Sticker,
  Sun,
  Target,
  Telescope,
  TreePine,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ART DEVIATION FROM THE MOCKUP — deliberate, recorded, with an upgrade path.
 *
 * `Upgrade.art` used to be a required string and five surfaces rendered
 * `<img src={…art}>`. The margin branch (E1 Phase 3) and every decoration
 * (`src/data/decorations.ts`) have **no committed art and none is coming in this
 * tranche** — all three `assets/atomic-assets-v{1,2,3}` manifests were searched
 * for `decor|plant|poster|lamp|banner|flower|sticker|cosmetic|ozdob` and returned
 * zero hits. So `art` became optional and an entry without it renders from lucide
 * plus the app's own design tokens.
 *
 * This is the sanctioned deviation `src/data/stages.ts` established (see its
 * header), not a workaround, and it is what lets a decoration set ship one entry
 * at a time instead of blocking on 24 illustrations. **A placeholder asset would
 * be worse**: it is a file somebody must later find and delete, and it reads as
 * finished art to everyone who did not write it.
 *
 * **To add art later:** ship `public/illustrations/upgrade-<id>.svg` (or
 * `decoration-<id>.svg`), add its row to `public/illustrations/slice-map.md` with
 * the source path and crop box, and set `art` on the entry. Nothing else changes —
 * this component prefers `art` whenever it is set, so the fallback simply goes
 * unused for that entry.
 *
 * **The map below is CLOSED but APPEND-EXTENSIBLE, and `ShopIconKey` is derived
 * from its own keys.** Adding one entry widens the union with no type edit, which
 * is what lets `six-worlds-catalogue` (W1) give its two worlds visibly different
 * decoration sets. Append, one entry per key; never restructure it, and never pin
 * it with an exhaustive literal list or a fixed-length tuple — the coverage
 * assertions quantify over `UPGRADES`/`DECORATIONS`, never over a hardcoded set
 * of keys.
 *
 * A plain component with no hooks and no state, so `.astro` pages render it
 * server-side with no `client:` directive.
 */
export const SHOP_ICONS = {
  // Catalogue — the margin branch (E1 Phase 3).
  target: Target,
  percent: Percent,
  // Decorations — kawiarnia.
  lamp: Lamp,
  flower: Flower2,
  frame: Frame,
  armchair: Armchair,
  // Decorations — piekarnia.
  cake: Cake,
  croissant: Croissant,
  ribbon: Ribbon,
  coffee: Coffee,
  // Decorations — galaktyczna-baza.
  rocket: Rocket,
  satellite: Satellite,
  orbit: Orbit,
  telescope: Telescope,
  // Decorations — sklep-ksiegarnia.
  book: BookOpen,
  scroll: Scroll,
  feather: Feather,
  leaf: Leaf,
  // Decorations — pracownia (W1). Appended per the note above: the craft world
  // reads as its own place only if it has craft objects, and E1's 16 held none.
  scissors: Scissors,
  spool: Spool,
  sticker: Sticker,
  // Spare vocabulary, deliberately unused by E1 — W1 appends its two worlds'
  // sets from here (and may add more keys) so each world reads as its own place.
  atom: Atom,
  bell: Bell,
  flask: FlaskConical,
  gift: Gift,
  microscope: Microscope,
  moon: Moon,
  palette: Palette,
  party: PartyPopper,
  sparkles: Sparkles,
  star: Star,
  sun: Sun,
  tree: TreePine,
} satisfies Record<string, LucideIcon>;

/** Every icon name the map carries. Derived, so appending a key widens it. */
export type ShopIconKey = keyof typeof SHOP_ICONS;

interface ShopGlyphProps {
  /** Committed art path, served raw from `public/`. Wins whenever it is set. */
  art?: string;
  /** Fallback glyph when there is no committed art. */
  icon?: ShopIconKey;
  /** Sizing/colour classes from the call site — merged with `cn()`, never concatenated. */
  className?: string;
}

/**
 * One entry's picture: its committed art if it has any, otherwise its mapped
 * lucide glyph. **One component for all five render sites** (`ShopArt`'s slotted
 * layer and corner row, `UpgradeShop`'s four card shapes, `growth.astro`,
 * `start.astro`, `ShiftResults`), so the fallback cannot drift between them.
 *
 * Decorative in every current call site — the entry's name is always adjacent as
 * text — so it is `aria-hidden` and carries an empty `alt`.
 */
export function ShopGlyph({ art, icon, className }: ShopGlyphProps) {
  if (art)
    return <img src={art} alt="" aria-hidden="true" loading="lazy" className={cn("object-contain", className)} />;
  const Glyph = icon ? SHOP_ICONS[icon] : Sparkles;
  return <Glyph aria-hidden="true" className={cn("text-primary", className)} />;
}
