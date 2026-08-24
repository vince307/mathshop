import { describe, expect, it } from "vitest";
import { isNoise, parseDiff } from "../packages/code-reviewer/noise";

/**
 * The review gate's pre-filter — the only thing standing between committed test
 * data and the review model. It gets its own test because the failure mode is
 * silent in both directions:
 *
 * 1. **strip too little** and a committed `.diff` reaches the model, which
 *    reviews the fixture's *content* as if it shipped. That blocked PR #24
 *    twice, once per model, and forced an admin bypass (L-004);
 * 2. **strip too much** and real code skips review entirely — a gate that
 *    passes everything looks exactly like a gate that works.
 *
 * Inputs are built as real diff text and run through `parseDiff`, not as
 * hand-written `DiffSegment` literals, so the header parsing that derives the
 * path is exercised too — that parser is what a crafted filename would attack.
 */

/** A text-file segment, shaped like `git show` writes it for a new file. */
function textDiff(path: string): string {
  return [
    `diff --git a/${path} b/${path}`,
    "new file mode 100644",
    "index 0000000..1111111",
    "--- /dev/null",
    `+++ b/${path}`,
    "@@ -0,0 +1 @@",
    "+content",
    "",
  ].join("\n");
}

/** A binary segment — the shape `public/**` art arrives in. */
function binaryDiff(path: string): string {
  return [
    `diff --git a/${path} b/${path}`,
    "new file mode 100644",
    "index 0000000..1111111",
    `Binary files /dev/null and b/${path} differ`,
    "",
  ].join("\n");
}

/** Parse one path's diff and answer the only question that matters. */
function stripped(diff: string): boolean {
  const segments = parseDiff(diff);
  expect(segments).toHaveLength(1);
  return isNoise(segments[0]);
}

describe("isNoise — committed diffs are data, not code", () => {
  it("strips an eval fixture, the case that forced the admin bypass", () => {
    expect(stripped(textDiff("packages/code-reviewer/evals/fixtures/07da072-parent-pin-config.diff"))).toBe(true);
  });

  it("strips a committed diff anywhere in the tree, not just under evals/fixtures/", () => {
    // The rule is about the file's content being a diff. A path-scoped rule
    // would let the same class back in from a new directory.
    expect(stripped(textDiff("docs/incident/2026-08-10-blocked-pr.diff"))).toBe(true);
    expect(stripped(textDiff("some-patch-at-the-root.patch"))).toBe(true);
  });

  it("strips regardless of extension case", () => {
    expect(stripped(textDiff("evidence/CAPTURE.DIFF"))).toBe(true);
  });

  it("keeps a source file whose name merely contains .diff", () => {
    // endsWith, not includes — `diff.ts` and `foo.diff.ts` are real code.
    expect(stripped(textDiff("src/lib/services/diff.ts"))).toBe(false);
    expect(stripped(textDiff("src/lib/foo.diff.ts"))).toBe(false);
  });
});

describe("isNoise — the three pre-existing classes still strip", () => {
  it("strips lockfiles in any directory", () => {
    expect(stripped(textDiff("package-lock.json"))).toBe(true);
    expect(stripped(textDiff("packages/code-reviewer/package-lock.json"))).toBe(true);
  });

  it("strips context/ churn", () => {
    expect(stripped(textDiff("context/changes/review-fixture-noise-strip/plan.md"))).toBe(true);
  });

  it("strips public/ binaries but keeps public/ text", () => {
    expect(stripped(binaryDiff("public/illustrations/shop.png"))).toBe(true);
    expect(stripped(textDiff("public/illustrations/slice-map.md"))).toBe(false);
  });
});

describe("isNoise — real code survives", () => {
  it("keeps the one file that must survive commit 5dee0cb", () => {
    // 5dee0cb adds six fixtures plus this script; after the strip it is all
    // that reaches the model — 106 lines instead of 1762.
    expect(stripped(textDiff("packages/code-reviewer/evals/generate-fixtures.mjs"))).toBe(false);
  });

  it("keeps ordinary application code", () => {
    expect(stripped(textDiff("src/pages/api/shifts/complete.ts"))).toBe(false);
    expect(stripped(textDiff(".github/workflows/review.yml"))).toBe(false);
  });
});

describe("isNoise — a whole diff filters down to its reviewable part", () => {
  it("keeps only the code when fixtures and docs travel with it", () => {
    // The shape of 5dee0cb in miniature: docs + fixtures + one real file.
    const diff = [
      textDiff("context/changes/code-review-evals/plan.md"),
      textDiff("packages/code-reviewer/evals/fixtures/pr19-gate-setup.diff"),
      textDiff("packages/code-reviewer/evals/fixtures/pr21-clean-docs.diff"),
      textDiff("packages/code-reviewer/evals/generate-fixtures.mjs"),
    ].join("");

    const segments = parseDiff(diff);
    const kept = segments.filter((s) => !isNoise(s));

    expect(segments).toHaveLength(4);
    expect(kept.map((s) => s.path)).toEqual(["packages/code-reviewer/evals/generate-fixtures.mjs"]);
  });
});
