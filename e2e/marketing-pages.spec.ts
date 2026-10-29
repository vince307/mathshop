import { expect, test, type Locator, type Page } from "@playwright/test";
import { WORLDS } from "../src/data/worlds";
import { deleteUser, provisionAccount, signInViaUI } from "./helpers/accounts";
import { t } from "./helpers/i18n";

/**
 * The public marketing pages (PR #28) render for both audiences, and the landing page's world
 * carousel lets a phone visitor reach every world.
 *
 * Risk MKT-1: a marketing route throws or loses its content. The pages read `Astro.locals.user`
 * (the CTA and header change for a signed-in parent), so each route is visited signed out AND
 * signed in — a page that only breaks for one audience is still broken.
 *
 * Risk MKT-2: on a narrow screen the carousel strip is wider than the viewport and its arrows are
 * the visible way to reach the hidden worlds. If the arrows stop scrolling, or stop at the wrong
 * card, worlds the app ships are unreachable on the landing page without a swipe.
 *
 * The contact form's `mailto:` link is pinned by `tests/contact-mailto.test.ts`: a mailto
 * navigation produces no request Playwright can observe.
 */

const pages = t.marketingPages;
const ROUTES = [
  { path: "/jak-to-dziala", title: pages.howItWorks.title, heading: pages.howItWorks.headingAccent },
  { path: "/swiaty", title: pages.worlds.title, heading: pages.worlds.headingAccent },
  { path: "/dla-rodzica", title: pages.parent.title, heading: pages.parent.headingAccent },
  { path: "/contact", title: pages.legal.contact.title, heading: pages.legal.contact.heading },
  { path: "/privacy", title: pages.legal.privacy.title, heading: pages.legal.privacy.heading },
  { path: "/terms", title: pages.legal.terms.title, heading: pages.legal.terms.heading },
] as const;

async function expectEveryRouteRenders(page: Page) {
  for (const route of ROUTES) {
    await page.goto(route.path);
    await expect(page, `${route.path} has the wrong title`).toHaveTitle(route.title);
    await expect(page.getByRole("heading", { level: 1 }), `${route.path} lost its heading`).toContainText(
      route.heading,
    );
  }
}

test("every marketing page renders for a signed-out visitor (Risk MKT-1)", async ({ page }) => {
  await expectEveryRouteRenders(page);
});

test("every marketing page renders for a signed-in parent (Risk MKT-1)", async ({ page }) => {
  const account = await provisionAccount("e2e-marketing");
  try {
    await signInViaUI(page, account.email);
    await page.waitForURL((url) => url.pathname.startsWith("/app"));
    await expectEveryRouteRenders(page);
  } finally {
    await deleteUser(account.id);
  }
});

test.describe("landing page world carousel on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the arrows reach every world the app ships (Risk MKT-2)", async ({ page }) => {
    await page.goto("/");
    const carousel = page.getByRole("region", { name: t.welcome.worlds.carouselLabel });
    const previous = page.getByRole("button", { name: t.welcome.worlds.previous });
    const next = page.getByRole("button", { name: t.welcome.worlds.next });

    await expect(previous).toBeDisabled();
    await expect(next).toBeEnabled();

    const seen = new Set<string>();
    for (let clicks = 0; clicks <= WORLDS.length; clicks++) {
      for (const world of WORLDS) {
        if (await isFullyInside(carousel.getByRole("img", { name: world.name, exact: true }), carousel)) {
          seen.add(world.slug);
        }
      }
      if (await next.isDisabled()) break;
      const before = await carousel.evaluate((strip) => strip.scrollLeft);
      await next.click();
      await expect.poll(() => carousel.evaluate((strip) => strip.scrollLeft)).toBeGreaterThan(before);
    }

    expect([...seen].sort()).toEqual(WORLDS.map(({ slug }) => slug).sort());
    await expect(previous).toBeEnabled();
    await expect(next).toBeDisabled();
  });
});

/** Whether `inner` lies horizontally inside `outer`'s visible box — both role-located, only measured. */
async function isFullyInside(inner: Locator, outer: Locator): Promise<boolean> {
  const [box, view] = await Promise.all([inner.boundingBox(), outer.boundingBox()]);
  if (!box || !view) return false;
  return box.x >= view.x - 1 && box.x + box.width <= view.x + view.width + 1;
}
