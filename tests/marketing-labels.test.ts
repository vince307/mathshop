import { describe, expect, it } from "vitest";
import { t } from "@/i18n";

/**
 * Locator hygiene for the signed-out marketing surfaces. Pure — no Supabase, no
 * DOM. Sibling of `tests/nav-labels.test.ts`, written for the same class of
 * break at a different surface.
 *
 * `getByText` matches SUBSTRINGS, so a new label that contains — or is contained
 * by — an existing one silently makes an unrelated locator ambiguous, and the
 * failure surfaces in a feature nobody touched (L-007).
 *
 * **This suite exists because that collision actually happened while the trust
 * badges were being written.** Mockup `03`'s first badge is titled "Bezpieczna
 * nauka", which is already `t.marketing.features[0].title`. `/auth/signup`
 * renders `AuthShell`, and therefore `FeatureList`, so shipping `03`'s wording on
 * both screens would have put one accessible name on the page twice. The two
 * sets were split — `trustSignup` for the screen that also shows the features,
 * `trustVerify` for the one that does not, which is what each mockup says
 * anyway — and this file is what keeps the NEXT added badge from re-colliding.
 *
 * **The pairing is per-surface, not global, and that is the whole point.**
 * Asserting `trustVerify` against `features` would be wrong: those two never
 * render on the same page, and forbidding the overlap would forbid the mockup's
 * own copy. So each set is checked against exactly what co-renders with it.
 */

/** Titles rendered by `FeatureList`, which `AuthShell` puts on every auth route. */
const featureTitles = t.marketing.features.map((f) => f.title);

/** Every string a `getByText`/`getByRole` locator could reach on `/auth/signup`. */
const SIGNUP_CO_RENDERED = [
  ...featureTitles,
  t.marketing.security,
  t.marketing.parentPanel,
  t.auth.signup.heading,
  t.auth.signup.signinLink,
  t.marketing.signupTagline,
];

/**
 * `/auth/confirm-email` renders no `AuthShell` — no feature blocks, no security
 * strip, no world strip. Only the page's own copy co-renders with its badges.
 */
const VERIFY_CO_RENDERED = [
  t.confirmEmail.checkEmail.heading,
  t.confirmEmail.nextStepValue,
  t.confirmEmail.protectsTitle,
];

/** `/auth/reset-password`'s panel heading, added alongside the badges (Phase 7). */
const RESET_CO_RENDERED = [...featureTitles, t.marketing.security, t.auth.reset.heading, t.auth.reset.backToSignin];

/**
 * The reset card's own closing line. It sits on the same page as the panel-wide
 * `marketing.security`, and the two say almost the same thing in almost the same
 * words — precisely the pair most likely to end up one containing the other.
 */
const RESET_CARD_HINT = t.auth.reset.protectHint;

/**
 * Every string a badge renders. `TrustBadges` paints `title` AND `body` as plain
 * `<p>` text, so both are reachable by `getByText` — but this suite checked only
 * titles, which left a live collision invisible: `trustVerify[0].body` was a
 * strict prefix of `t.marketing.security`. It was harmless purely because
 * `/auth/confirm-email` happens to render `TrustBadges` without `SecurityNote`,
 * and depending on that coincidence is the exact informality this file exists to
 * replace.
 */
function badgeStrings(set: readonly { title: string; body?: string }[]): string[] {
  return set.flatMap((badge) => (badge.body ? [badge.title, badge.body] : [badge.title]));
}

/**
 * The panel-wide security line, checked against EVERY badge set rather than only
 * the sets that share a page with it today. Passing a set to a different route is
 * a one-line change, and this string says almost exactly what a security badge
 * says — so it is the collision most likely to be introduced by accident.
 *
 * `featureTitles` are deliberately NOT in this list. `trustVerify[0].title` is
 * "Bezpieczna nauka", which IS `features[0].title` — mockup `03` reuses the
 * phrase on purpose (see this file's header). That identity is exactly why
 * `trustVerify` must stay off `AuthShell` routes, and `VERIFY_CO_RENDERED` is
 * what holds it to the surface it actually has. Folding feature titles in here
 * would re-litigate a recorded decision instead of catching a new mistake.
 */
const PORTABLE_COLLISION_RISK = [t.marketing.security];

function assertNoSubstringCollision(labels: readonly string[], coRendered: readonly string[], surface: string) {
  for (const label of labels) {
    for (const other of coRendered) {
      if (label === other) {
        throw new Error(`${surface}: "${label}" is rendered twice — one locator, two elements`);
      }
      expect(label.includes(other), `${surface}: badge "${label}" contains co-rendered "${other}"`).toBe(false);
      expect(other.includes(label), `${surface}: co-rendered "${other}" contains badge "${label}"`).toBe(false);
    }
  }
}

describe("trust-badge titles", () => {
  it("are unique inside each set", () => {
    for (const [name, set] of [
      ["trustSignup", t.marketing.trustSignup],
      ["trustVerify", t.marketing.trustVerify],
    ] as const) {
      const strings = badgeStrings(set);
      expect(new Set(strings).size, `${name} repeats a string`).toBe(strings.length);
    }
  });

  it("collide with nothing that co-renders on /auth/signup", () => {
    assertNoSubstringCollision(badgeStrings(t.marketing.trustSignup), SIGNUP_CO_RENDERED, "/auth/signup");
  });

  it("collide with nothing that co-renders on /auth/confirm-email", () => {
    assertNoSubstringCollision(badgeStrings(t.marketing.trustVerify), VERIFY_CO_RENDERED, "/auth/confirm-email");
  });

  it("collide with the panel-wide security line in no set, wherever it is used", () => {
    for (const [name, set] of [
      ["trustSignup", t.marketing.trustSignup],
      ["trustVerify", t.marketing.trustVerify],
    ] as const) {
      assertNoSubstringCollision(badgeStrings(set), PORTABLE_COLLISION_RISK, name);
    }
  });
});

describe("per-screen marketing headings", () => {
  it("collide with nothing that co-renders on /auth/reset-password", () => {
    assertNoSubstringCollision([t.marketing.resetHeading], RESET_CO_RENDERED, "/auth/reset-password");
  });

  it("keep the reset card's closing hint clear of everything else on that page", () => {
    assertNoSubstringCollision([RESET_CARD_HINT], RESET_CO_RENDERED, "/auth/reset-password (card hint)");
  });

  it("keep the signup tagline clear of the shared hero tagline", () => {
    // Both are `AuthShell` taglines; only one renders per route, but a substring
    // relationship would still make a cross-route locator ambiguous in a spec
    // that visits both.
    expect(t.marketing.signupTagline.includes(t.marketing.heroTagline)).toBe(false);
    expect(t.marketing.heroTagline.includes(t.marketing.signupTagline)).toBe(false);
  });
});
