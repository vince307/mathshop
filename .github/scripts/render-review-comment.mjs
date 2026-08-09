// Renders the AI review PR comment from the ai-reviewer action's outputs.
//
// Usage: node render-review-comment.mjs <review.json> <review.log> <exit-code>
//
// stdout: markdown starting with the upsert marker. Three shapes:
//   exit 0/1 with JSON  -> full review (verdict, scores table, findings, cost)
//   exit 0 without JSON -> minimal "nothing to review" pass note
//   exit 2              -> setup/budget error - explicitly not a code verdict
//
// Dependency-free Node >=22; developer-facing English by design (bot surface,
// not product UI - see packages/code-reviewer/CLAUDE.md).

import { readFileSync } from "node:fs";

export const MARKER = "<!-- ai-reviewer -->";

// Display names mirror the rubric criteria (context/team/code-review-dod.md)
// in schema.ts key order.
const CRITERIA = [
  ["correctness", "1. Implementation correctness"],
  ["typeIdiom", "2. Type safety & project idiom"],
  ["complexity", "3. Complexity & size"],
  ["testCoverage", "4. Test coverage proportional to risk"],
  ["security", "5. Security & data safety"],
  ["configDeployment", "6. Config & deployment safety"],
];

function readOrEmpty(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function footer(log) {
  const cost = /^Tokens: .*$/m.exec(log)?.[0];
  const model = /^Reviewing with (.+)\.\.\.$/m.exec(log)?.[1];
  const parts = [];
  if (cost) parts.push(`\`${cost}\``);
  if (model) parts.push(`model \`${model}\``);
  return parts.length > 0 ? `\n${parts.join(" · ")}\n` : "";
}

function couldNotRun(head, log, exitCode) {
  // Last lines of stderr carry the reason (budget "split this PR" message,
  // missing key, API failure) - surface them without dumping the whole log.
  // The log is diff-influenced, so it must not be able to close the fence
  // and render attacker markdown: the fence below is 4 backticks (legally
  // contains ``` lines), and runs of 4+ backticks are capped at 3.
  const tail = log
    .trim()
    .split("\n")
    .filter(Boolean)
    .slice(-8)
    .map((line) => line.replace(/`{4,}/g, "```"))
    .join("\n");
  return [
    `${head} — ⚠️ could not run`,
    "",
    `The review agent hit a **setup or budget error** (exit ${exitCode}). This is _not_ a code verdict — the code was not judged.`,
    "",
    "````",
    tail || "(no log output captured)",
    "````",
    "",
    "Fix the cause (or split an oversized PR), then re-run by adding the `ai-cr:review` label.",
    footer(log),
  ].join("\n");
}

export function render(json, log, exitCode) {
  const head = `${MARKER}\n## 🤖 AI Code Review`;

  // Only exit 0 may claim the noise-only pass: the CLI always emits JSON with
  // exit 1, so a non-zero code without JSON means the runner wrapper itself
  // failed - report it as a non-verdict error, never as a pass or a fail.
  if (exitCode === 2 || (exitCode !== 0 && json.trim() === "")) {
    return couldNotRun(head, log, exitCode);
  }

  if (json.trim() === "") {
    return [
      `${head} — ✅ pass (nothing to review)`,
      "",
      "The diff contains only noise paths (lockfiles, `context/`, binary assets) or is empty after stripping — there is no reviewable code change.",
      footer(log),
    ].join("\n");
  }

  // A truncated/malformed review.json must not crash the comment step - it
  // would skip the label and gate steps and leave the author with a bare
  // stack trace instead of the non-verdict error shape.
  let review;
  try {
    review = JSON.parse(json);
  } catch {
    return couldNotRun(head, log, exitCode);
  }
  const emoji = review.verdict === "pass" ? "✅" : "❌";

  const scores = [
    "| Criterion | Score |",
    "| --- | ---: |",
    ...CRITERIA.map(([key, label]) => `| ${label} | ${review.scores[key]}/10 |`),
  ].join("\n");

  const findings =
    review.findings.length === 0
      ? ""
      : [
          "",
          `### Findings (${review.findings.length})`,
          "",
          ...review.findings.map((f) => {
            const where = f.line > 0 ? `\`${f.file}:${f.line}\`` : `\`${f.file}\``;
            return [
              `- **[${f.severity}]** ${where} _(criterion ${f.criterion})_ — ${f.description}`,
              `  - Suggested fix: ${f.suggestedFix}`,
            ].join("\n");
          }),
        ].join("\n");

  return [
    `${head} — ${emoji} ${review.verdict.toUpperCase()}`,
    "",
    scores,
    findings,
    "",
    `> ${review.summary.replaceAll("\n", "\n> ")}`,
    footer(log),
  ].join("\n");
}

const [jsonPath, logPath, exitCodeArg] = process.argv.slice(2);
if (jsonPath === undefined || logPath === undefined || exitCodeArg === undefined) {
  console.error("Usage: node render-review-comment.mjs <review.json> <review.log> <exit-code>");
  process.exit(2);
}
process.stdout.write(`${render(readOrEmpty(jsonPath), readOrEmpty(logPath), Number(exitCodeArg))}\n`);
