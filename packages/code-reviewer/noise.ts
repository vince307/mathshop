/**
 * Diff parsing and the noise pre-filter — the only part of the review pipeline
 * that decides what the model is allowed to see.
 *
 * Extracted from `review.ts` so it can be imported without executing the CLI
 * (`review.ts` calls `main()` at module top level). Keep this file free of
 * imports and of `.ts`-extension specifiers: a test outside the package pulls
 * it into the root TypeScript program, which does not enable
 * `allowImportingTsExtensions`.
 */

export interface DiffSegment {
  path: string;
  text: string;
  binary: boolean;
}

function pathFromHeader(line: string): string {
  const quoted = /"b\/(.+)"$/.exec(line);
  if (quoted) return quoted[1];
  const body = line.slice("diff --git ".length);
  // Non-rename headers repeat the same path ("a/X b/X"): find the split where the
  // two sides match — correct even when X itself contains " b/", so a crafted
  // filename cannot smuggle itself into a stripped prefix like context/.
  for (let i = body.indexOf(" b/"); i !== -1; i = body.indexOf(" b/", i + 1)) {
    if (body.slice(2, i) === body.slice(i + 3)) return body.slice(i + 3);
  }
  // Rename (a and b sides differ): right-anchor on the last separator.
  const last = body.lastIndexOf(" b/");
  return last === -1 ? "unknown" : body.slice(last + 3);
}

export function parseDiff(diff: string): DiffSegment[] {
  const chunks = diff.split(/^(?=diff --git )/m).filter((c) => c.startsWith("diff --git "));
  return chunks.map((text) => {
    const newline = text.indexOf("\n");
    const path = pathFromHeader(newline === -1 ? text : text.slice(0, newline));
    const binary = text.includes("\nBinary files ") || text.includes("\nGIT binary patch");
    return { path, text, binary };
  });
}

/**
 * Noise paths the model never sees: lockfiles, context/** churn, public
 * binaries, and committed diffs.
 *
 * The last class is not about where the file lives. A `.diff` or `.patch` in
 * the tree is input data — an eval fixture, captured evidence — but its content
 * is itself a diff, and a reviewer that only ever sees a diff cannot tell that
 * inner one from the change under review. It reviews the fixture as if it
 * shipped. That has blocked merges twice on this repo, once per model, each
 * time through the model's strongest lens: see L-008 in
 * `context/foundation/lessons.md`.
 */
export function isNoise(segment: DiffSegment): boolean {
  const { path, binary } = segment;
  if (path.split("/").pop() === "package-lock.json") return true;
  if (path.startsWith("context/")) return true;
  if (path.startsWith("public/") && binary) return true;
  if (/\.(diff|patch)$/i.test(path)) return true;
  return false;
}

/**
 * Lines the model is actually charged for: added and removed lines only, with
 * the `+++`/`---` file headers excluded. Lives here rather than in the CLI
 * because it measures the *output* of the strip — the number that says whether
 * the pre-filter did its job.
 */
export function changedLineCount(text: string): number {
  return text.split("\n").filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---) /.test(l)).length;
}
