import { describe, expect, it } from "vitest";
import { DEFAULT_WORLD, WORLDS, WORLD_SLUGS, getWorld, worldForTheme } from "@/data/worlds";
import { AVATARS, AVATAR_IDS, getAvatar } from "@/data/avatars";

/**
 * Pure resolver logic for the world/avatar lookups (previously partial
 * coverage). The load-bearing behavior is the FALLBACK path: a stored `theme`
 * or `avatar` id that no longer exists (renamed/removed) must resolve to a
 * renderable default rather than crash a start screen or profile card — the
 * same tolerance the report already relies on for stale upgrade ids.
 */

describe("worldForTheme — stored theme → renderable world (never throws)", () => {
  it("resolves every real slug to its own world", () => {
    for (const w of WORLDS) expect(worldForTheme(w.slug)).toBe(w);
  });

  it("falls back to the default world for the DB default, null, undefined, and unknown slugs", () => {
    expect(worldForTheme("default")).toBe(DEFAULT_WORLD); // the DB column default
    expect(worldForTheme(null)).toBe(DEFAULT_WORLD);
    expect(worldForTheme(undefined)).toBe(DEFAULT_WORLD);
    expect(worldForTheme("a-removed-world")).toBe(DEFAULT_WORLD);
    expect(worldForTheme("")).toBe(DEFAULT_WORLD);
  });

  it("getWorld returns undefined for an unknown slug (the raw lookup, no fallback)", () => {
    expect(getWorld("nope")).toBeUndefined();
    expect(getWorld(DEFAULT_WORLD.slug)).toBe(DEFAULT_WORLD);
  });

  it("WORLD_SLUGS mirrors WORLDS and includes the default", () => {
    expect(WORLD_SLUGS).toEqual(WORLDS.map((w) => w.slug));
    expect(WORLD_SLUGS).toContain(DEFAULT_WORLD.slug);
  });
});

describe("getAvatar — stored avatar id → avatar (or undefined for a stale id)", () => {
  it("resolves every real id", () => {
    for (const a of AVATARS) expect(getAvatar(a.id)).toBe(a);
  });

  it("returns undefined for an unknown id (callers render a graceful no-avatar state)", () => {
    expect(getAvatar("ghost")).toBeUndefined();
    expect(getAvatar("")).toBeUndefined();
  });

  it("AVATAR_IDS mirrors AVATARS and is non-empty (zod refine source for profile creation)", () => {
    expect(AVATAR_IDS).toEqual(AVATARS.map((a) => a.id));
    expect(AVATAR_IDS.length).toBeGreaterThan(0);
  });
});
