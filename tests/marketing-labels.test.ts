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
      const titles = set.map((b) => b.title);
      expect(new Set(titles).size, `${name} repeats a title`).toBe(titles.length);
    }
  });

  it("collide with nothing that co-renders on /auth/signup", () => {
    assertNoSubstringCollision(
      t.marketing.trustSignup.map((b) => b.title),
      SIGNUP_CO_RENDERED,
      "/auth/signup",
    );
  });

  it("collide with nothing that co-renders on /auth/confirm-email", () => {
    assertNoSubstringCollision(
      t.marketing.trustVerify.map((b) => b.title),
      VERIFY_CO_RENDERED,
      "/auth/confirm-email",
    );
  });
});

describe("per-screen marketing headings", () => {
  it("collide with nothing that co-renders on /auth/reset-password", () => {
    assertNoSubstringCollision([t.marketing.resetHeading], RESET_CO_RENDERED, "/auth/reset-password");
  });

  it("keep the signup tagline clear of the shared hero tagline", () => {
    // Both are `AuthShell` taglines; only one renders per route, but a substring
    // relationship would still make a cross-route locator ambiguous in a spec
    // that visits both.
    expect(t.marketing.signupTagline.includes(t.marketing.heroTagline)).toBe(false);
    expect(t.marketing.heroTagline.includes(t.marketing.signupTagline)).toBe(false);
  });
});
