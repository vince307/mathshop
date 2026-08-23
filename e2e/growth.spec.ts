import { expect, test } from "@playwright/test";
import { deleteUser, provisionAccount, seedChildProfile, signInViaUI } from "./helpers/accounts";
import { t } from "./helpers/i18n";

/**
 * The `/app/growth` screen and the nav entry that reaches it
 * (`context/changes/world-progression-stages/plan.md`, Phase 4 §2). Modeled on
 * e2e/seed.spec.ts.
 *
 * Runs in BOTH projects (desktop 1280 + touch 712 — see playwright.config.ts
 * `testMatch`), because the two risks it protects are viewport-shaped:
 *
 * - **Reachability.** `/app/growth` is server-rendered behind the shell; the
 *   only thing that makes it reachable is one entry in `AppShell`'s `items`,
 *   which feeds the desktop sidebar AND the mobile bottom bar. A route that
 *   exists but is unlinked (or linked to the wrong href) is invisible to a
 *   child, and no unit test drives a real click.
 * - **One name per nav, at every viewport.** Both navs are always in the DOM and
 *   toggled with `display` (`hidden` / `lg:hidden`). If that toggle ever regresses
 *   to `opacity`, or a third nav appears, every accessible name doubles and
 *   `getByRole` locators across the whole suite go ambiguous — a failure only a
 *   real browser at a real viewport can see. The touch run is also the fifth
 *   tab's fit check: five entries must sit in one row without pushing the
 *   document sideways.
 *
 * The stage ladder's arithmetic (`stageForLevel`, saturation, totality) is
 * covered in tests/stages.test.ts and is deliberately NOT re-asserted here.
 *
 * Locators use the FULL dictionary strings: name matching is substring-based,
 * and "Rozwój świata" (the nav entry) and "Rozwój sklepu" (the page's own h1)
 * share a prefix by design — a fragment locator would match both.
 */

/** The four catalogue stages, as the dictionary spells them (L-003 extended to tests). */
const stageNames = Object.values(t.stages).map((stage) => stage.name);

/** Every entry the shell's navigation offers — sidebar at `lg+`, bottom bar below. */
const navLabels = Object.values(t.nav.items);

/** A measurement of the whole document, not an element locator. */
const horizontalOverflow = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("the nav entry reaches the growth screen and the rail shows every stage (Risk E2E-F4-1)", async ({ page }) => {
  const account = await provisionAccount("e2e-growth-nav");
  try {
    // A fresh profile sits at business_level 1 → the first stage is current and
    // the other three are locked.
    await seedChildProfile(account.id, { name: "Iga" });
    await signInViaUI(page, account.email);
    await page.waitForURL((url) => url.pathname.startsWith("/app/start"));

    // The entry is a real anchor in whichever nav the viewport shows.
    await page.getByRole("link", { name: t.nav.items.growth, exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/app/growth");

    await expect(page.getByRole("heading", { name: t.growth.title, level: 1 })).toBeVisible();

    // All four stages are on the screen, each exactly once — the rail is ONE DOM
    // tree reflowed with utility classes, never a mobile copy plus a desktop copy.
    for (const name of stageNames) {
      await expect(page.getByText(name, { exact: true })).toHaveCount(1);
      await expect(page.getByText(name, { exact: true })).toBeVisible();
    }

    // Exactly one stage is marked "Aktualnie". Two would mean the ladder lost its
    // single-current invariant; zero would mean an uncapped level ran off the end.
    await expect(page.getByText(t.growth.current, { exact: true })).toHaveCount(1);
    // The current stage is the FIRST one for a fresh profile — proving the chip
    // tracks business_level rather than being pinned to a fixed node.
    await expect(page.getByRole("listitem").filter({ hasText: stageNames[0] })).toContainText(t.growth.current);

    // The entry marks itself as the current page; nothing else does.
    await expect(page.getByRole("link", { name: t.nav.items.growth, exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  } finally {
    await deleteUser(account.id);
  }
});

test("every nav entry stays uniquely reachable and the shell never scrolls sideways (Risk E2E-F4-2)", async ({
  page,
}) => {
  const account = await provisionAccount("e2e-growth-nav-fit");
  try {
    await seedChildProfile(account.id, { name: "Pola" });
    await signInViaUI(page, account.email);
    await page.goto("/app/growth");
    await expect(page.getByRole("heading", { name: t.growth.title, level: 1 })).toBeVisible();

    // Five entries, each resolvable by its FULL accessible name and present in
    // the accessibility tree exactly once — at 712 px that is the bottom bar
    // carrying the growth tab, at 1280 px the sidebar plus the pinned parent link.
    for (const label of navLabels) {
      const entry = page.getByRole("link", { name: label, exact: true });
      await expect(entry).toHaveCount(1);
      await expect(entry).toBeVisible();
    }

    // The five entries fit the primary nav's own box — measured on the element
    // `getByRole` found, not on a CSS-selected one. At 712 px this is the bottom
    // bar: five tabs in ONE row, no sideways scroll to reach the fifth.
    const primaryNav = page.getByRole("navigation", { name: t.nav.primaryLabel });
    await expect(primaryNav).toHaveCount(1);
    expect(await primaryNav.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);

    // …and the nav does not push the page itself sideways either.
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  } finally {
    await deleteUser(account.id);
  }
});
