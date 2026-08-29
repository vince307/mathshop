import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { FEATURE_ICONS, MARKETING_ART } from "@/data/marketing-art";
import { AUTH_ICONS } from "@/components/icons/authIcons";
import { t } from "@/i18n";

/**
 * The auth/onboarding art contract, over both halves of the atom set.
 *
 * **Group A — committed illustrations.** `src/data/marketing-art.ts` holds bare
 * URL-path strings served straight out of `public/`. A typo'd stem does not crash
 * and does not fail a type check — it renders an empty box while every other test
 * stays green, because nothing else reads these constants. Same failure mode
 * `tests/worlds-art.test.ts` was written for, same remedy: read the real
 * `public/` directory off disk, under vitest's default node environment.
 *
 * The length assertion is the more interesting one. `FEATURE_ICONS` is a list
 * running PARALLEL to `t.marketing.features` (art is not locale content, so the
 * paths cannot live in the dictionary). A parallel list with no sync and no
 * reader is precisely what let the marketing panel keep advertising four worlds
 * after the app grew to six — nothing went red, because nothing looked.
 *
 * **Group B — inlined UI icons.** `src/components/icons/authIcons.tsx` inlines
 * thirteen SVGs into one document. That is only safe while none of them declares
 * an element `id`: SVG ids are document-global, so two inlined atoms sharing one
 * would silently cross-render — one glyph wearing another's gradient, with no
 * error anywhere. It is exactly the hazard that forced the RETIRED atomic-pack
 * art to be `<img>`-only, and the only thing standing between this codebase and
 * its return is somebody pasting in the wrong file. So the guard renders every
 * registered icon and reads the output: no `id`, and at least one `currentColor`
 * (an icon with a baked colour is the other way inlining silently degrades — it
 * stops answering to its context and nobody notices until a dark surface).
 *
 * Rendering rather than grepping the source is deliberate (L-009): a grep proves
 * a string is absent from a FILE, which a component that exports the wrong thing
 * satisfies just as well. Rendering proves it about the thing that ships.
 */

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

/** Strip the leading slash so `join` does not read the path as absolute. */
const onDisk = (urlPath: string) => join(publicDir, urlPath.replace(/^\//, ""));

/** Every Group A path that is an SVG — the files whose markup we get to inspect. */
const groupASvgs = MARKETING_ART.filter((p) => p.endsWith(".svg"));

describe("the auth surfaces' committed illustrations (Group A)", () => {
  it("ships a committed file for every path it exposes", () => {
    for (const urlPath of MARKETING_ART) {
      expect(existsSync(onDisk(urlPath)), `marketing art points at a missing file: ${urlPath}`).toBe(true);
    }
  });

  it("serves every path from /illustrations/, so nothing resolves outside public/", () => {
    for (const urlPath of MARKETING_ART) {
      expect(urlPath, `"${urlPath}" is not served from /illustrations/`).toMatch(
        /^\/illustrations\/(auth\/)?[a-z0-9-]+\.(svg|png|webp)$/,
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

  it("carries no element id and no gradient, so any of them could be inlined later", () => {
    expect(groupASvgs.length, "no Group A SVGs found — the filter or the manifest is wrong").toBeGreaterThan(0);
    for (const urlPath of groupASvgs) {
      const markup = readFileSync(onDisk(urlPath), "utf8");
      expect(markup, `${urlPath} declares an element id — ids are document-global and collide`).not.toMatch(/\sid=/);
      expect(markup, `${urlPath} declares a gradient — gradients need ids, which collide`).not.toMatch(
        /<(linear|radial)Gradient/i,
      );
    }
  });
});

describe("the auth surfaces' inlined UI icons (Group B)", () => {
  const rendered = Object.entries(AUTH_ICONS).map(
    ([name, Icon]) => [name, renderToStaticMarkup(createElement(Icon, { className: "size-4" }))] as const,
  );

  it("registers every icon the module means to guard", () => {
    // A new export that never reaches AUTH_ICONS is guarded by nothing. Thirteen
    // is the set the change landed; growing it means updating this number, which
    // is the prompt to check the new icon meets the two rules below.
    expect(rendered.length, "AUTH_ICONS has changed size — confirm the new icon is id-free and currentColor").toBe(13);
  });

  it("renders an svg with a viewBox for every registered icon", () => {
    for (const [name, markup] of rendered) {
      expect(markup, `${name} did not render an <svg>`).toMatch(/^<svg\b/);
      expect(markup, `${name} renders without a viewBox and will not scale`).toMatch(/viewBox="/);
    }
  });

  it("declares no element id, so no two inlined icons can collide in one document", () => {
    for (const [name, markup] of rendered) {
      expect(markup, `${name} renders an element id — ids are document-global and collide when inlined`).not.toMatch(
        /\sid="/,
      );
    }
  });

  it("draws with currentColor, so each icon takes the colour of the context it sits in", () => {
    for (const [name, markup] of rendered) {
      expect(markup, `${name} bakes its colour and will not answer to a text-* class`).toMatch(/currentColor/);
    }
  });

  it("applies the caller's className to the root, so size-* and text-* reach the svg", () => {
    for (const [name, markup] of rendered) {
      expect(markup.slice(0, markup.indexOf(">")), `${name} drops className — it cannot be sized`).toMatch(/size-4/);
    }
  });
});
