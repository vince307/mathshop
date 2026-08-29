/**
 * Committed illustration art for the auth/onboarding surfaces — Group A of the
 * atom set.
 *
 * Every file listed here was copied **as-is** out of the local-only, gitignored
 * per-screen extraction `assets/matmaverse-auth-v2-web/` into
 * `public/illustrations/auth/`, because `assets/` is absent from a fresh clone,
 * from CI, and from the worktrees `/10x-autonomous-run` builds — code that needs
 * the art cannot reach the source. Provenance table:
 * `public/illustrations/slice-map.md`.
 *
 * **The atom set splits by colour authority, not by file type.** This module owns
 * the half whose colours belong to the DESIGN — brand mark, feature glyphs,
 * coins, heroes, decor — rendered `<img src>` and never recoloured by a consumer.
 * The other half lives in `src/components/icons/authIcons.tsx`: UI icons whose
 * colour belongs to the CONTEXT they sit in, authored with `currentColor` and
 * therefore inlined, because `currentColor` in a standalone SVG document has
 * nothing to inherit from and would render black through an `<img>`.
 *
 * (The retired atomic-pack art carried a third constraint — colliding
 * `<linearGradient id="g">` declarations that forced `<img>` even for UI icons.
 * The extraction declares no `id` in any of its 41 files, so that constraint is
 * gone; `tests/auth-art.test.ts` keeps it gone.)
 *
 * Paths live here rather than in `src/i18n/pl.ts` because art is not locale
 * content: adding a second language must not mean restating every file path.
 * That makes `FEATURE_ICONS` a list running parallel to `t.marketing.features`,
 * which is exactly the shape that once let the marketing panel advertise four
 * worlds while the app shipped six — so `tests/auth-art.test.ts` pins the two to
 * the same length. Add a fourth feature and that test fails until its icon lands.
 */

/** Brand symbol beside the `t.brand` wordmark — shop front with a `zł` coin. */
export const BRAND_SYMBOL = "/illustrations/auth/brand-mark.svg";

/** Illustration heading the parent sign-in card — a parent beside a locked shield. */
export const PARENT_LOCK = "/illustrations/auth/hero-parent-security.svg";

/**
 * Feature-block icons, **index-aligned with `t.marketing.features`**: safety,
 * worlds, progress. Order is load-bearing and is asserted, not assumed.
 */
export const FEATURE_ICONS: readonly string[] = [
  "/illustrations/auth/feature-safety.svg",
  "/illustrations/auth/feature-worlds.svg",
  "/illustrations/auth/feature-progress.svg",
] as const;

/** Blue circular tick — selected tiles, trust badges, the "why it matters" panel. */
export const BADGE_CHECK = "/illustrations/auth/badge-check.svg";

/**
 * Card heroes. All three are PNG because the extraction ships no SVG equivalent.
 *
 * `HERO_EMAIL` and `HERO_RESET` are keyed by near-white removal, which punched
 * out the white letter/card *inside* each illustration. That hole is invisible on
 * a `bg-card` surface and shows as a pale rectangle on the page background — so
 * **both belong inside a card, and only inside a card**. `HERO_PIN` keys cleanly
 * and is safe anywhere. See `public/illustrations/slice-map.md`.
 */
export const HERO_EMAIL = "/illustrations/auth/hero-email.png";
export const HERO_RESET = "/illustrations/auth/hero-reset.png";
export const HERO_PIN = "/illustrations/auth/hero-pin.png";

/**
 * Ambient background art. Decorative only — every consumer renders these
 * `aria-hidden`, `pointer-events-none`, desktop-only and behind the content, in a
 * container with `overflow-hidden` so nothing overhanging can scroll the body.
 *
 * These are the extraction's SVG coins, NOT the alpha-keyed
 * `/illustrations/coin.png` rasters — those stay where they are, hardcoded by
 * four child-facing surfaces (`CoinBoard`, `HudChip`, `UpgradeShop`,
 * `ShiftResults`) and out of this change's scope.
 */
export const DECOR_COIN = "/illustrations/auth/coin.svg";
export const DECOR_COIN_STACK = "/illustrations/auth/coin-stack.svg";
export const DECOR_CHART = "/illustrations/auth/decor-chart.svg";
export const DECOR_RECEIPT = "/illustrations/auth/decor-receipt.svg";
export const DECOR_PATH = "/illustrations/auth/decor-path.svg";

/** Every path this module exposes — the set `tests/auth-art.test.ts` walks. */
export const MARKETING_ART: readonly string[] = [
  BRAND_SYMBOL,
  PARENT_LOCK,
  ...FEATURE_ICONS,
  BADGE_CHECK,
  HERO_EMAIL,
  HERO_RESET,
  HERO_PIN,
  DECOR_COIN,
  DECOR_COIN_STACK,
  DECOR_CHART,
  DECOR_RECEIPT,
  DECOR_PATH,
] as const;
