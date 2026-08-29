import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { FEATURE_ICONS, MARKETING_ART } from "@/data/marketing-art";
import { t } from "@/i18n";

/**
 * The signed-out surfaces' art contract.
 *
 * `src/data/marketing-art.ts` holds bare URL-path strings served straight out of
 * `public/`. A typo'd stem does not crash and does not fail a type check — it
 * renders an empty box on `/` and `/auth/signin` while every other test stays
 * green, because nothing else reads these constants. Same failure mode
 * `tests/worlds-art.test.ts` was written for, same remedy: read the real
 * `public/` directory off disk, under vitest's default node environment.
 *
 * The length assertion is the more interesting one. `FEATURE_ICONS` is a list
 * running PARALLEL to `t.marketing.features` (art is not locale content, so the
 * paths cannot live in the dictionary). A parallel list with no sync and no
 * reader is precisely what let the marketing panel keep advertising four worlds
 * after the app grew to six — nothing went red, because nothing looked. This is
 * what looks: add a fourth feature and the icon list must grow with it.
 */

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

/** Strip the leading slash so `join` does not read the path as absolute. */
const onDisk = (urlPath: string) => join(publicDir, urlPath.replace(/^\//, ""));

describe("the signed-out surfaces' art", () => {
  it("ships a committed file for every path it exposes", () => {
    for (const urlPath of MARKETING_ART) {
      expect(existsSync(onDisk(urlPath)), `marketing art points at a missing file: ${urlPath}`).toBe(true);
    }
  });

  it("serves every path from /illustrations/, so nothing resolves outside public/", () => {
    for (const urlPath of MARKETING_ART) {
      expect(urlPath, `"${urlPath}" is not served from /illustrations/`).toMatch(
        /^\/illustrations\/[a-z0-9-]+\.(svg|png|webp)$/,
      );
    }
  });

  it("keeps one feature icon per marketing feature", () => {
    expect(
      FEATURE_ICONS.length,
      "FEATURE_ICONS and t.marketing.features have drifted — every feature needs its icon",
    ).toBe(t.marketing.features.length);
  });

  it("gives each feature its own icon, so no two blocks render the same glyph", () => {
    expect(new Set(FEATURE_ICONS).size, "duplicate feature icon").toBe(FEATURE_ICONS.length);
  });
});
