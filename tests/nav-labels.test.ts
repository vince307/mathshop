import { describe, expect, it } from "vitest";
import { t } from "@/i18n";

/**
 * Locator hygiene for the shared `AppShell` nav (F5). Pure — no Supabase, no DOM.
 *
 * `getByText` matches SUBSTRINGS, so a new nav label that contains (or is
 * contained by) an existing string silently makes an unrelated locator ambiguous.
 * That class of break has bitten this project before
 * (`context/changes/web-shell-and-mockup-parity/handoff.md`), and it is invisible
 * until an e2e run goes red somewhere else entirely. This suite is the reason the
 * invariant survives the NEXT nav entry, not just this one.
 *
 * Both navs (sidebar at `lg+`, bottom tab bar below it) render from the SAME
 * `items` array and are toggled with `hidden` / `lg:hidden` — display, never
 * opacity — so exactly one copy of each name is in the a11y tree at any viewport.
 * These assertions are what keeps that array's labels unambiguous.
 */

const labels = Object.values(t.nav.items);

/** Strings live e2e `getByText` locators assert on pages that render `AppShell`. */
const LIVE_E2E_STRINGS = [t.start.walletLabel, t.upgradeShop.ownedTag];

describe("nav item labels", () => {
  it("are unique", () => {
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("contain no substring collisions with each other in either direction", () => {
    for (const a of labels) {
      for (const b of labels) {
        if (a === b) continue;
        expect(a.includes(b), `"${a}" contains "${b}"`).toBe(false);
      }
    }
  });

  it("collide with no live e2e locator string in either direction", () => {
    for (const label of labels) {
      for (const live of LIVE_E2E_STRINGS) {
        expect(label.includes(live), `nav label "${label}" contains e2e string "${live}"`).toBe(false);
        expect(live.includes(label), `e2e string "${live}" contains nav label "${label}"`).toBe(false);
      }
    }
  });
});
