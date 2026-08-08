import { z } from "zod";

/**
 * Output contract for the review agent — the zod schema is the single source
 * of truth, mirroring the verdict rules in context/team/code-review-dod.md.
 * Stage 2 (CI job, PR comments) depends on this shape.
 */

const score = (criterion: string) =>
  z
    .number()
    .int()
    .min(1)
    .max(10)
    .describe(`1-10 integer score for "${criterion}" per the rubric's anchored 1/10 descriptions.`);

export const ScoresSchema = z
  .object({
    correctness: score("1. Implementation correctness"),
    typeIdiom: score("2. Type safety & project idiom"),
    complexity: score("3. Complexity & size"),
    testCoverage: score("4. Test coverage proportional to risk"),
    security: score("5. Security & data safety"),
    configDeployment: score("6. Config & deployment safety"),
  })
  .describe("Per-criterion scores. Score strictly against the rubric anchors, not gut feeling.");

export const FindingSchema = z.object({
  file: z.string().describe("Repo-relative path of the file the finding is about, exactly as it appears in the diff."),
  line: z
    .number()
    .int()
    .min(0)
    .describe("Line number in the new version of the file the finding points at; 0 for file-level findings."),
  criterion: z.number().int().min(1).max(6).describe("Which rubric criterion (1-6) this finding falls under."),
  severity: z
    .enum(["blocker", "major", "minor"])
    .describe(
      "blocker = must not merge (secret in diff, RLS bypass, broken build); major = should fix before merge; minor = nice to fix.",
    ),
  description: z.string().describe("What is wrong and why it matters, in 1-2 sentences."),
  suggestedFix: z.string().describe("A concrete, actionable fix — name the change, not just the problem."),
});

export const ReviewSchema = z.object({
  scores: ScoresSchema,
  findings: z
    .array(FindingSchema)
    .describe("Every defect worth reporting. Empty array when the change is clean. No praise entries."),
  verdict: z
    .enum(["pass", "fail"])
    .describe("pass = every criterion scores >= 5 AND no blocker finding exists; otherwise fail."),
  summary: z
    .string()
    .describe("2-3 sentences of actionable Markdown a human can act on — no restating the diff."),
});

export type Scores = z.infer<typeof ScoresSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type Review = z.infer<typeof ReviewSchema>;

/**
 * Mechanical implementation of the rubric's verdict rules
 * (code-review-dod.md "Verdict rules"): the model proposes scores and
 * findings, but the CLI computes pass/fail — the computed value wins.
 */
export function deriveVerdict(scores: Scores, findings: Finding[]): "pass" | "fail" {
  const allAboveThreshold = Object.values(scores).every((s) => s >= 5);
  const hasBlocker = findings.some((f) => f.severity === "blocker");
  return allAboveThreshold && !hasBlocker ? "pass" : "fail";
}
