import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_WORLD, WORLDS } from "@/data/worlds";

/**
 * The slug↔stem↔`theme` invariant (W1) — the one every other surface assumes and
 * nothing checked.
 *
 * `World.slug` is stored verbatim in `child_profiles.theme`, `World.image` is
 * served raw from `public/`, and the two are supposed to be the SAME string:
 * `world-<slug>.webp`. Nothing enforced that. A typo'd stem does not crash and
 * does not fail a type check — it renders a broken `<img>` in three places (the
 * picker tile, the preview rail, the shop scene) and every existing test stays
 * green, because no other test reads `World.image` at all.
 *
 * Node environment (vitest's default) on purpose: this reads the real
 * `public/illustrations/` directory off disk, the way `tests/connectivity.test.ts`
 * pins its probe target against a real static asset and for the same reason — a
 * path assertion that never touches the filesystem cannot see a missing file.
 */

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

describe("the world catalogue's art", () => {
  it("derives every image path from the slug, with no exceptions", () => {
    for (const world of WORLDS) {
      expect(world.image, `world "${world.slug}" does not derive its image from its slug`).toBe(
        `/illustrations/world-${world.slug}.webp`,
      );
    }
  });

  it("ships a committed file for every world's image", () => {
    for (const world of WORLDS) {
      // `image` is an absolute URL path served from `public/`; strip the leading
      // slash so `join` does not treat it as an absolute filesystem path.
      const onDisk = join(publicDir, world.image.replace(/^\//, ""));
      expect(existsSync(onDisk), `"${world.slug}" points at a missing file: ${world.image}`).toBe(true);
    }
  });

  it("keeps every slug unique and URL-safe, so the URL and the DB value stay identical", () => {
    const slugs = WORLDS.map((w) => w.slug);
    expect(new Set(slugs).size, "duplicate world slug").toBe(slugs.length);
    for (const slug of slugs) {
      // Lowercase ASCII + hyphens only: no diacritics (which would need encoding
      // in the URL and would then differ from the stored `theme`), no uppercase.
      expect(slug, `slug "${slug}" is not URL-safe`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("includes the fallback world, so an unknown theme resolves to a real picture", () => {
    expect(WORLDS.map((w) => w.slug)).toContain(DEFAULT_WORLD.slug);
  });
});
