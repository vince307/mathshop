import { expect, test } from "@playwright/test";
import { deleteUser, provisionAccount, seedChildProfile, signInViaUI } from "./helpers/accounts";
import { t } from "./helpers/i18n";
import { decorationsForWorld } from "../src/data/decorations";

/** The world the empty-shop seed below runs in — its decorations are seeded as owned. */
const SEED_WORLD = "kawiarnia";

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
 *   real browser at a real viewport can see. The touch run additionally carries
 *   the two properties that break when the nav GROWS, and it carries them as
 *   assertions that can actually fail: every tab can genuinely RECEIVE A CLICK
 *   (a hit-test, not `toBeVisible()`), and no tab's label is CLIPPED by its own
 *   ellipsis. The description this header used to carry — "SIX tabs must sit in
 *   one row without pushing the document sideways" — was credited by three
 *   handoffs to an assertion that could not fail; see the loop below for what
 *   replaced it and why. (`t.nav.items` has six keys — dashboard, missions,
 *   shop, growth, worlds, parent. `AppShell`'s `items` array holds five: the
 *   sidebar renders the sixth, `parent`, as its own pinned link below them,
 *   while `tabs` spreads all six into the bottom bar. That is why the count
 *   reads as five in the component and six in the accessibility tree.)
 *
 * - **Where each nav entry POINTS.** This file owns the wiring half of the nav
 *   contract; `tests/nav-labels.test.ts` owns the dictionary half (uniqueness and
 *   substring hygiene) and can see nothing about `AppShell`, whose `items` /
 *   `tabs` are `.astro` frontmatter consts with no value export. The href map
 *   below is therefore hardcoded ON PURPOSE: the spec states the expected wiring
 *   independently of the component it is checking.
 *
 * - **An honest empty state.** The next-upgrade `<h2>` is unconditional, so when
 *   `nextUpgrade` returns null the card must still say something and must still
 *   offer the shop CTA. Only a rendered page can show that the heading, the
 *   sentence and the CTA co-exist; the `.astro` template has no unit-level guard
 *   (Risk E2E-F4-3).
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

/**
 * Where every nav entry must point. Hardcoded rather than imported: `AppShell`'s
 * `items` / `tabs` are `.astro` frontmatter consts with no value export, and even
 * if they were importable, a guard that reads its expectations from the thing it
 * is guarding proves nothing. Keys match `t.nav.items`.
 */
const NAV_HREFS = {
  dashboard: "/app/start",
  missions: "/app/task",
  shop: "/app/upgrades",
  growth: "/app/growth",
  worlds: "/app/worlds",
  parent: "/app/report",
} as const;

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

    // The stage-marker ordinals are actually ANNOUNCED, not merely labelled.
    // StageRail's markers carry `aria-label` on a <span>; without `role="img"`
    // that label is on role=generic and no browser exposes it. This assertion
    // resolves through the accessibility tree, which is exactly the surface the
    // missing role removed — a `getByText` assertion would stay green because the
    // `current` marker also renders the bare digit.
    await expect(page.getByRole("img", { name: t.growth.stageOrdinal.replace("{n}", "1"), exact: true })).toHaveCount(
      1,
    );
  } finally {
    await deleteUser(account.id);
  }
});

test("the next-upgrade card stays a finished thought when nothing is left to buy (Risk E2E-F4-3)", async ({ page }) => {
  const account = await provisionAccount("e2e-growth-empty");
  try {
    // Reaching the empty state now takes BOTH lists (E1 / D-11). `sign` and
    // `shelf` are still the only two upgrades with requiredWorldLevel 1, so owning
    // both at business_level 1 drives `nextUpgrade` to null — but `nextPurchase`
    // then falls through to this world's decorations, which are gated on price
    // alone and therefore always offerable. That fall-through is the whole point
    // of the sink, so the seed owns the world's decorations too.
    //
    // Anchored on `decorationsForWorld(SEED_WORLD)` rather than a hand-written id
    // list on purpose: `six-worlds-catalogue` and any future decoration batch
    // change the set, and a stale literal here would re-create exactly the silent
    // staleness this re-seed exists to fix (L-006).
    await seedChildProfile(account.id, {
      name: "Nela",
      businessLevel: 1,
      theme: SEED_WORLD,
      shopState: {
        purchased: ["sign", "shelf"],
        decorations: decorationsForWorld(SEED_WORLD).map((d) => d.id),
      },
    });
    await signInViaUI(page, account.email);
    await page.goto("/app/growth");
    await expect(page.getByRole("heading", { name: t.growth.title, level: 1 })).toBeVisible();

    // The heading is unconditional, so with no next upgrade the card must say
    // something rather than sit empty under its own title.
    await expect(page.getByText(t.growth.noNextUpgrade, { exact: true })).toBeVisible();

    // …and the shop CTA survives the empty state. It sits OUTSIDE the ternary
    // because /app/growth is this screen's only entrance to the shop; guarding
    // the whole section would delete it exactly when the child has money to spend.
    await expect(page.getByRole("link", { name: t.growth.upgradesLink, exact: true })).toBeVisible();
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

    // Six entries, each resolvable by its FULL accessible name, present in the
    // accessibility tree exactly once, and pointing at the route it names — at
    // 712 px that is the bottom bar carrying all six tabs, at 1280 px the sidebar
    // plus the pinned parent link. Presence alone was the whole assertion before;
    // an entry silently repointed at another route stayed green.
    let clippers = 0;
    for (const [key, label] of Object.entries(t.nav.items)) {
      const entry = page.getByRole("link", { name: label, exact: true });
      await expect(entry).toHaveCount(1);
      await expect(entry).toBeVisible();
      await expect(entry).toHaveAttribute("href", NAV_HREFS[key as keyof typeof NAV_HREFS]);

      // …and it can actually be CLICKED. `toBeVisible()` performs no hit-test,
      // so an element covered by an overlay still reports visible: f0587ad
      // records the dev toolbar occluding this very bottom bar while the link
      // "still reported visible and uniquely located" — which is precisely the
      // three assertions above, all green, over a tab no child could tap.
      //
      // `trial: true` runs Playwright's full actionability stack (visible,
      // stable, enabled, RECEIVES EVENTS) and then skips the action, so this
      // adds a hit-test without navigating. The receives-events check is the one
      // the toolbar defeated. Do not delete this as redundant with
      // `toBeVisible()` — that is exactly the mistake this replaces. The
      // explicit timeout keeps an occluded tab a fast, legible failure rather
      // than a 30 s test-level timeout.
      await entry.click({ trial: true, timeout: 10_000 });

      // Every tab's label must FIT ITS TAB. This replaces
      // `primaryNav.scrollWidth - clientWidth <= 0`, which could not fail: under
      // AppShell.astro's `flex-1 min-w-0` the tabs shrink to fit by construction
      // at any width and any tab count, so the old check was a tautology, not a
      // fit test. What actually breaks when the nav grows is the label.
      //
      // **Measure the label against the TAB's box, not against its own.** The
      // obvious form of this assertion — `span.scrollWidth > span.clientWidth`
      // on the element carrying `truncate` — is ALSO incapable of failing, for a
      // subtler reason: the anchor is `flex-col items-center`, so in the cross
      // axis the span sizes to its content and its scrollWidth and clientWidth
      // are equal by construction. Measured directly: a 315 px label inside a
      // 116 px tab still reported 0 overflow. It is the tab's content box that
      // constrains the label, so that is what the label is compared against.
      // (Consequence worth knowing: `truncate` on that span is inert — a label
      // too long for its tab overflows and overlaps its neighbours rather than
      // ellipsising. That is a product finding, not this spec's to fix.)
      //
      // This is a MEASUREMENT reached from the element `getByRole` located, the
      // same category as `horizontalOverflow` above and the assertion it
      // replaces — not element location, which is what e2e/CLAUDE.md restricts.
      // It is not a new sanctioned exception to that rule.
      //
      // The walk selects by COMPUTED STYLE, not by structure: the label element
      // is whichever descendant sets ellipsis + nowrap + hidden overflow (the
      // bottom bar's `truncate` span). The desktop sidebar renders its label as
      // a bare text node with nothing clipping it, so there is no such element
      // at 1280 px and nothing to measure — which the positive control after
      // this loop makes explicit rather than silent.
      const clip = await entry.evaluate((el) => {
        for (const node of [el, ...el.querySelectorAll("*")]) {
          const style = getComputedStyle(node);
          const clips = style.overflowX === "hidden" || style.overflowX === "clip";
          if (style.textOverflow === "ellipsis" && style.whiteSpace === "nowrap" && clips) {
            const tab = getComputedStyle(el);
            const inner = el.clientWidth - parseFloat(tab.paddingLeft) - parseFloat(tab.paddingRight);
            return node.scrollWidth - inner;
          }
        }
        return null;
      });

      if (clip !== null) {
        clippers += 1;
        expect(clip, `nav label "${label}" (${key}) does not fit its tab`).toBeLessThanOrEqual(0);
      }
    }

    // Positive control (L-009): without this, a walk that found nothing — a
    // typo'd style name, a refactor that drops `truncate` — would satisfy every
    // truncation assertion above by never running one, and the check would be
    // decorative. At 712 px all six tabs clip; at 1280 px none does, by
    // construction of the sidebar markup. Both are asserted, so a change to
    // EITHER nav's clipping behaviour is a finding rather than a silent
    // reduction in what this test measures.
    const entryCount = Object.keys(t.nav.items).length;
    expect(clippers, "expected every bottom-bar tab to clip its label, and no sidebar entry to").toBe(
      test.info().project.name === "touch" ? entryCount : 0,
    );

    // Exactly one nav carries the primary label at this viewport — the other
    // copy is `display: none` and out of the accessibility tree. (This survived
    // the assertion it used to serve: the vacuous `scrollWidth` measurement was
    // taken on this element.)
    const primaryNav = page.getByRole("navigation", { name: t.nav.primaryLabel });
    await expect(primaryNav).toHaveCount(1);

    // …and the nav does not push the page itself sideways. Kept: a
    // DOCUMENT-level measurement, so the flex tautology above does not apply to
    // it — a nav that genuinely overflowed the viewport would still show here.
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  } finally {
    await deleteUser(account.id);
  }
});
