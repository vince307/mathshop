import { expect, test } from "@playwright/test";
import { WORLDS } from "../src/data/worlds";

/**
 * The signed-out product advertises every world it actually ships
 * (Risk W1-E2E-2) — the gap the 2026-08-27 run surfaced at integration and
 * nothing could see from inside either feature.
 *
 * `t.marketing.worlds` used to be a hand-maintained SECOND copy of `WORLDS`:
 * four entries, no sync, no test, no e2e reader. `WORLDS` grew to six in W1 and
 * the marketing list did not, so the landing page and the auth panel kept
 * promising four worlds while the app shipped six. Nothing went red, because
 * nothing looked. That list is gone now — both surfaces map `WORLDS` directly —
 * and this spec is what keeps it gone: add a seventh world and these assertions
 * fail until the signed-out product shows it too.
 *
 * Signed OUT on purpose, and therefore accountless: this is the only risk in the
 * suite that lives entirely before authentication, so there is no
 * `provisionAccount`/`deleteUser` pair to balance and no state to clean up.
 *
 * World names come from `WORLDS`, not from the dictionary — the same import
 * `e2e/worlds.spec.ts` uses, and for the same reason: `src/data/worlds.ts` is
 * where a world's name↔slug↔art is reconciled to ONE string, so a name typed
 * into a locator here would be a fifth copy of exactly what this spec exists to
 * forbid. `exact: true` throughout, because `getByRole` names match substrings
 * (L-007) and world names are the label set this feature grows.
 *
 * Locates the `<img>` by its `alt`, not the caption text, because that is the
 * element that would silently 404 into an empty box while the caption below it
 * still read correctly.
 */

/** The `lg` breakpoint — below it `AuthShell`'s world strip is `hidden`, by design. */
const LG = 1024;

test("the landing page advertises every world the app ships (Risk W1-E2E-2)", async ({ page }) => {
  await page.goto("/");

  for (const world of WORLDS) {
    await expect(
      page.getByRole("img", { name: world.name, exact: true }),
      `the landing page does not advertise "${world.slug}"`,
    ).toBeVisible();
  }
});

test("the auth marketing panel advertises every world the app ships (Risk W1-E2E-2)", async ({ page }, testInfo) => {
  // The strip is `hidden … lg:grid` — the mobile mockup omits it deliberately,
  // so below `lg` there is nothing to assert and its absence is correct.
  test.skip(
    (testInfo.project.use.viewport?.width ?? 0) < LG,
    "AuthShell's world strip is desktop-only by design (hidden below lg)",
  );

  await page.goto("/auth/signin");

  for (const world of WORLDS) {
    await expect(
      page.getByRole("img", { name: world.name, exact: true }),
      `the auth panel does not advertise "${world.slug}"`,
    ).toBeVisible();
  }
});
