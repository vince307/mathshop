import { describe, expect, it } from "vitest";
import { generateTask } from "@/data/tasks";

/**
 * The task-type dispatcher (S-03). `/app/task` calls this to serve either a
 * counting or a change-making task. Dispatch is asserted deterministically via
 * an injected `pickType`; the default RNG is checked to reach both types.
 */

describe("generateTask", () => {
  it("dispatches to a counting task when pickType says counting", () => {
    expect(generateTask(1, () => "counting").type).toBe("counting");
  });

  it("dispatches to a change-making task when pickType says change_making", () => {
    expect(generateTask(1, () => "change_making").type).toBe("change_making");
  });

  it("produces both task types over many default draws", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(generateTask(1).type);
    expect(seen.has("counting")).toBe(true);
    expect(seen.has("change_making")).toBe(true);
  });
});
