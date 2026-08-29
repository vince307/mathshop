import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TOUCH_SPECS, touchTestMatch } from "../e2e/touch-specs";

/**
 * Membership guard for the `touch` Playwright project. Pure — no Supabase, no
 * DOM, no browser. Modeled on `tests/nav-labels.test.ts`.
 *
 * **Why this file exists.** A shrinking `testMatch` allowlist is silent.
 * Deliberately removing `worlds` from the alternation on 2026-08-27 produced
 * **27 passed, exit 0** — fully green, the only signal a hand-computed count
 * (`context/runs/2026-08-27-world-economy/run-log.md:353-361`). That was written
 * down as an open action and never closed. This suite closes it: the list can
 * still shrink, but now it goes red here first.
 *
 * **Division of labour.** This file guards MEMBERSHIP — which specs run at a
 * touch viewport, and that the regex built from them still discriminates. It
 * says nothing about what those specs assert. Behaviour at the viewport is
 * `e2e/growth.spec.ts` (Risk E2E-F4-2) and the specs' own business.
 */

/**
 * The expected set, DUPLICATED VERBATIM from `e2e/touch-specs.ts` on purpose.
 *
 * **Do not "simplify" this by importing the list twice** — the duplication IS
 * the mechanism. A single shared constant compared against itself asserts
 * nothing; two independent literals mean removing a spec from the touch project
 * takes two deliberate edits in two files, and a one-sided edit is a red test
 * instead of a quietly smaller run. Order-insensitive on purpose (sorted before
 * comparison), so reordering the alternation is not a false failure.
 */
const EXPECTED_TOUCH_SPECS = ["gameplay-restore", "growth", "worlds", "marketing-worlds"];

describe("touch project membership", () => {
  it("matches the expected set exactly", () => {
    expect([...TOUCH_SPECS].sort()).toEqual([...EXPECTED_TOUCH_SPECS].sort());
  });

  it("names only specs that exist on disk", () => {
    for (const name of TOUCH_SPECS) {
      const path = fileURLToPath(new URL(`../e2e/${name}.spec.ts`, import.meta.url));
      expect(existsSync(path), `touch project names e2e/${name}.spec.ts, which does not exist`).toBe(true);
    }
  });

  it("is actually wired into the touch project's testMatch", () => {
    // Read as TEXT, never imported: `playwright.config.ts` runs `loadEnv` and throws
    // on missing env at import time, which is the whole reason the list was extracted
    // into its own zero-dependency module.
    //
    // Without this the suite guards the wrong door. `TOUCH_SPECS` can stay pristine
    // while `testMatch:` is edited back to a hand-written literal — ONE line, in the
    // file this list used to live in — and the touch project shrinks silently with
    // every other assertion here still green. That is precisely the 2026-08-27 failure
    // mode wearing a different hat, so the chain is guarded end to end or not at all.
    const config = readFileSync(fileURLToPath(new URL("../playwright.config.ts", import.meta.url)), "utf8");
    expect(config, "playwright.config.ts must build the touch testMatch from touchTestMatch()").toMatch(
      /testMatch:\s*touchTestMatch\(\)/,
    );
  });

  it("builds an anchored regex that accepts every listed spec and rejects near-misses", () => {
    const testMatch = touchTestMatch();

    // Positive control first: a regex that matched NOTHING would satisfy the
    // rejection half below while proving nothing at all (L-009).
    for (const name of TOUCH_SPECS) {
      expect(testMatch.test(`e2e/${name}.spec.ts`), `e2e/${name}.spec.ts should be in the touch project`).toBe(true);
    }

    // The anchoring is what this project lost once already: an unanchored
    // substring match pulled `marketing-worlds.spec.ts` in by accident. Each
    // near-miss below is rejected by one anchor — `(?:^|/)` for the prefixed
    // names, `$` for the suffixed one. Over-matching is the worse failure
    // (L-008), so it is asserted against directly.
    for (const path of [
      "e2e/foo-growth.spec.ts",
      "e2e/notgrowth.spec.ts",
      "e2e/growth.spec.ts.bak",
      "e2e/growth-extra.spec.ts",
      "e2e/onboarding.spec.ts",
    ]) {
      expect(testMatch.test(path), `${path} should NOT be in the touch project`).toBe(false);
    }
  });
});
