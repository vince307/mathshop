import { expect, test } from "@playwright/test";
import { deleteUser, provisionAccount, seedChildProfile, signInViaUI } from "./helpers/accounts";
import { t } from "./helpers/i18n";
import { WORLDS } from "../src/data/worlds";

/**
 * `/app/worlds` at six worlds (W1 · Risk W1-E2E-1) — the one thing in this
 * feature only a real browser can see.
 *
 * Growing `WORLDS` from four to six is data, and every consumer derives, so
 * vitest covers all of it. What vitest cannot see is the **reflow**: six tiles
 * in a `grid-cols-2 … lg:grid-cols-3` grid, at a viewport where the third column
 * does not exist. A grid that overflows still renders every tile in the DOM and
 * still passes every unit assertion — the child just cannot reach the ones that
 * fell off the side.
 *
 * Runs in BOTH projects (desktop 1280 + touch 712 — see `playwright.config.ts`'s
 * `touch` `testMatch`, whose alternation this spec's name was ADDED to). The
 * touch run is the one that carries the risk; the desktop run is what proves the
 * `lg:grid-cols-3` half. Without the config edit this file would run desktop-only,
 * at the one viewport where six tiles in three columns trivially fit — a test
 * that cannot fail for the reason it exists.
 *
 * **Overflow is measured on the GRID element, never on `document`.** The app's
 * bottom bar is `position: fixed`, and a fixed or clipped ancestor hides its
 * subtree's overflow from a document-level measurement entirely — the exact trap
 * `world-progression-stages` hit, where a bar overflowed by 96px while
 * `document.documentElement.scrollWidth` stayed perfectly clean (L-004). The grid
 * is reached by walking one level up from a role-located tile, not by a CSS
 * selector: `SelectTile` renders the `<button>` as the grid's direct child.
 *
 * Locators use `exact: true` on the full dictionary/world name. `getByText` and
 * inexact names match substrings (L-007), and world names are the one label set
 * this feature grows.
 *
 * **A meta-check banked here so nobody re-learns it (L-004).** The obvious break
 * for the overflow assertion — force `grid-cols-6` at the touch width — does NOT
 * exercise it. Tailwind's `grid-cols-6` is `repeat(6, minmax(0, 1fr))`, whose
 * tracks shrink to nothing, so the grid never scrolls and the COLUMN-COUNT
 * assertion below carries the failure while the overflow number stays 0. The
 * break that actually removes this protection gives the tracks a floor —
 * `grid-cols-[repeat(6,minmax(9rem,1fr))]`, i.e. tiles that cannot shrink, which
 * is also the plausible real regression (someone sets a minimum tile size). Under
 * that edit the overflow expectation is the one that goes red. Use it, not
 * `grid-cols-6`, if you ever need to prove this assertion still bites.
 */

/** The `lg` breakpoint, where `lg:grid-cols-3` takes over from `grid-cols-2`. */
const LG = 1024;

test("every world tile fits the grid at this viewport, uniquely named (Risk W1-E2E-1)", async ({ page }) => {
  const account = await provisionAccount("e2e-worlds-grid");
  try {
    await seedChildProfile(account.id, { name: "Ola", theme: "pracownia" });
    await signInViaUI(page, account.email);
    await page.goto("/app/worlds");
    await expect(page.getByRole("heading", { name: t.worlds.heading, exact: true })).toBeVisible();

    // One tile per world, and each accessible name resolves to exactly ONE
    // control. `WorldPicker` passes `alt=""` precisely so the visible label is
    // the whole accessible name; a duplicate would make every locator on this
    // screen ambiguous at the touch width, where both navs are in the DOM.
    for (const world of WORLDS) {
      const tile = page.getByRole("button", { name: world.name, exact: true });
      await expect(tile, `"${world.name}" is not uniquely named on /app/worlds`).toHaveCount(1);
      await expect(tile).toBeVisible();
    }

    const viewport = page.viewportSize();
    if (!viewport) throw new Error("no viewport size — this spec is viewport-shaped and cannot run headless-less");

    // The grid's OWN overflow. `.evaluate` walks one level up from the tile
    // button to its grid parent — DOM traversal from a role locator, not a CSS
    // selector for finding an element (e2e/CLAUDE.md's locator rule).
    const gridOverflow = await page.getByRole("button", { name: WORLDS[0].name, exact: true }).evaluate((tile) => {
      const grid = tile.parentElement;
      if (!grid) throw new Error("the world tile has no parent — the grid moved");
      return grid.scrollWidth - grid.clientWidth;
    });
    expect(gridOverflow, "the world grid scrolls sideways at this viewport").toBe(0);

    // Every tile is inside the viewport horizontally — the failure a child would
    // actually feel, and the one an overflow number alone can under-report.
    const boxes = [];
    for (const world of WORLDS) {
      const box = await page.getByRole("button", { name: world.name, exact: true }).boundingBox();
      if (!box) throw new Error(`"${world.name}" has no box`);
      expect(box.x, `"${world.name}" starts off the left edge`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `"${world.name}" runs past the right edge`).toBeLessThanOrEqual(viewport.width);
      boxes.push(box);
    }

    // The reflow itself: 3 columns at `lg+` (the web mockup's 3×2), 2 below it
    // (the mobile mockup's 2×3). Columns are counted as distinct tile left edges
    // in the first row, so this reads the rendered layout, not the class string.
    const expectedColumns = viewport.width >= LG ? 3 : 2;
    const firstRowTop = Math.min(...boxes.map((b) => b.y));
    const columns = new Set(boxes.filter((b) => Math.abs(b.y - firstRowTop) < 4).map((b) => Math.round(b.x)));
    expect(columns.size, `expected ${expectedColumns} columns at ${viewport.width}px`).toBe(expectedColumns);

    // The CTA survives the taller grid — it is the only way to commit a choice.
    const confirm = page.getByRole("button", { name: t.worlds.confirm, exact: true });
    await expect(confirm).toBeVisible();
    const confirmBox = await confirm.boundingBox();
    expect(confirmBox?.x ?? -1, "the confirm CTA starts off the left edge").toBeGreaterThanOrEqual(0);
    expect(
      (confirmBox?.x ?? 0) + (confirmBox?.width ?? 0),
      "the confirm CTA runs past the right edge",
    ).toBeLessThanOrEqual(viewport.width);
  } finally {
    await deleteUser(account.id);
  }
});
