/**
 * Committed art for the signed-out surfaces — the auth split view (`AuthShell`)
 * and the landing page (`Welcome`).
 *
 * Every file listed here was copied **as-is** out of the local-only, gitignored
 * `assets/atomic-assets-v2/svg/` pack into `public/illustrations/`, because
 * `assets/` is absent from a fresh clone, from CI, and from the worktrees
 * `/10x-autonomous-run` builds — code that needs the art cannot reach the source.
 * Provenance and reproduction steps live in `public/illustrations/slice-map.md`.
 *
 * **Reference these as `<img src>`, never inline the SVG.** `feature-safety.svg`
 * and `parent-lock.svg` each declare `<linearGradient id="g">`, and
 * `brand-symbol.svg` declares `blue` / `green` / `gold`. SVG element ids are
 * document-global: inline two of these into one page and the later definition
 * silently wins for both, rendering one glyph with the other's gradient. As
 * `<img>` each file is its own document and the ids cannot collide. The cost is
 * that they cannot be recoloured through `currentColor` — acceptable, since
 * these are illustrations with fixed brand colours, not UI icons.
 *
 * Paths live here rather than in `src/i18n/pl.ts` because art is not locale
 * content: adding a second language must not mean restating every file path.
 * That makes `FEATURE_ICONS` a list running parallel to `t.marketing.features`,
 * which is exactly the shape that once let the marketing panel advertise four
 * worlds while the app shipped six — so `tests/auth-art.test.ts` pins the two to
 * the same length. Add a fourth feature and that test fails until its icon lands.
 */

/** Brand symbol beside the `t.brand` wordmark — shop front with a `zł` coin. */
export const BRAND_SYMBOL = "/illustrations/brand-symbol.svg";

/** Illustration heading the parent sign-in card — padlock with a figure on it. */
export const PARENT_LOCK = "/illustrations/parent-lock.svg";

/**
 * Feature-block icons, **index-aligned with `t.marketing.features`**: safety,
 * worlds, progress. Order is load-bearing and is asserted, not assumed.
 */
export const FEATURE_ICONS: readonly string[] = [
  "/illustrations/feature-safety.svg",
  "/illustrations/feature-worlds.svg",
  "/illustrations/feature-progress.svg",
] as const;

/**
 * Ambient background art. Decorative only — every consumer renders these
 * `aria-hidden`, `pointer-events-none`, and desktop-only.
 *
 * The two coins already shipped for the child-facing economy surfaces and are
 * alpha-keyed PNGs (see `slice-map.md` — do not clip them to a circle); the
 * chart is a copied SVG like the rest of this module.
 */
export const DECOR_COIN = "/illustrations/coin.png";
export const DECOR_COIN_STACK = "/illustrations/coin-stack.png";
export const DECOR_CHART = "/illustrations/decor-chart.svg";

/** Every path this module exposes — the set `tests/auth-art.test.ts` walks. */
export const MARKETING_ART: readonly string[] = [
  BRAND_SYMBOL,
  PARENT_LOCK,
  ...FEATURE_ICONS,
  DECOR_COIN,
  DECOR_COIN_STACK,
  DECOR_CHART,
] as const;
