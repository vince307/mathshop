/**
 * Local AI code review agent (stage 1).
 *
 * Usage: git diff main...HEAD | npx tsx review.ts [--model <id>]
 *
 * stdout: exactly one JSON document (the verdict).
 * stderr: progress, scores, summary, token usage, cost.
 * Exit codes: 0 = pass, 1 = fail, 2 = setup/budget/API error (never a verdict).
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, Output } from "ai";
import { ReviewSchema, deriveVerdict } from "./schema.ts";

const EXIT_PASS = 0;
const EXIT_FAIL = 1;
const EXIT_SETUP = 2;

const DEFAULT_MODEL = "claude-haiku-4-5";
const MAX_DIFF_LINES = 4000;
const MAX_OUTPUT_TOKENS = 4096;

// USD per million tokens. Cost is computed client-side — the SDK returns tokens only.
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
};

// Paths resolve relative to this file, not process.cwd(), so the CLI works
// from repo root and from inside the package alike.
const REPO_ROOT = new URL("../../", import.meta.url);
const RUBRIC_PATH = fileURLToPath(new URL("context/team/code-review-dod.md", REPO_ROOT));
const ENV_PATH = fileURLToPath(new URL(".env", REPO_ROOT));

interface DiffSegment {
  path: string;
  text: string;
  binary: boolean;
}

function parseDiff(diff: string): DiffSegment[] {
  const chunks = diff.split(/^(?=diff --git )/m).filter((c) => c.startsWith("diff --git "));
  return chunks.map((text) => {
    const header = /^diff --git (?:a\/|"a\/)?(?:.*?) (?:b\/|"b\/)?(.+?)"?$/m.exec(text);
    const path = header?.[1] ?? "unknown";
    const binary = text.includes("\nBinary files ") || text.includes("\nGIT binary patch");
    return { path, text, binary };
  });
}

/** Noise paths the model never sees: lockfiles, context/** churn, public binaries. */
function isNoise(segment: DiffSegment): boolean {
  const { path, binary } = segment;
  if (path.split("/").pop() === "package-lock.json") return true;
  if (path.startsWith("context/")) return true;
  if (path.startsWith("public/") && binary) return true;
  return false;
}

function changedLineCount(text: string): number {
  return text.split("\n").filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---) /.test(l)).length;
}

async function readStdin(): Promise<string> {
  const parts: Buffer[] = [];
  for await (const chunk of process.stdin) {
    parts.push(chunk as Buffer);
  }
  return Buffer.concat(parts).toString("utf8");
}

function buildSystemPrompt(rubric: string): string {
  return [
    "You are a code review agent for this repository. Review the unified git diff",
    "provided by the user strictly against the rubric below — it is your single",
    "source of truth for criteria, score anchors, and verdict rules.",
    "",
    "Rules:",
    "- Score every criterion 1-10 as an integer, anchored to the rubric's 1/10 descriptions.",
    "- Report findings only for defects visible in the diff; every finding names the",
    "  file, the line in the new version, the criterion (1-6), a severity, and a concrete fix.",
    "- The diff has been pre-filtered: lockfiles and context/ docs were removed deliberately;",
    "  do not penalize the change for their absence.",
    "- You only see the diff — do not invent problems about code you cannot see;",
    "  when the diff gives no signal for a criterion, score it 7 and move on.",
    "- Summary: 2-3 sentences of actionable Markdown. English. No praise padding.",
    "",
    "--- RUBRIC ---",
    "",
    rubric,
  ].join("\n");
}

function fail(message: string, code: number): never {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { model: { type: "string" } } });

  // process.loadEnvFile never overrides variables already set in the shell.
  if (existsSync(ENV_PATH)) process.loadEnvFile(ENV_PATH);

  const modelId = values.model ?? process.env.REVIEW_MODEL ?? DEFAULT_MODEL;

  if (process.stdin.isTTY) {
    fail("Usage: git diff main...HEAD | npx tsx review.ts [--model <id>]\nNo diff on stdin.", EXIT_SETUP);
  }
  const rawDiff = await readStdin();
  if (rawDiff.trim() === "") {
    fail("Usage: git diff main...HEAD | npx tsx review.ts [--model <id>]\nstdin was empty.", EXIT_SETUP);
  }

  const segments = parseDiff(rawDiff);
  const kept = segments.filter((s) => !isNoise(s));
  const strippedCount = segments.length - kept.length;
  const diff = kept.map((s) => s.text).join("");
  const lines = changedLineCount(diff);

  process.stderr.write(
    `Diff: ${String(segments.length)} file(s), ${String(strippedCount)} stripped as noise, ` +
      `${String(lines)} changed line(s) to review.\n`,
  );

  if (kept.length === 0 || lines === 0) {
    process.stderr.write("Nothing to review after stripping noise paths (lockfiles, context/, public binaries).\n");
    process.exit(EXIT_PASS);
  }

  // Budget guard runs before any API concern (including the key check) so an
  // oversized diff is always reported as such, never masked by setup errors.
  if (lines > MAX_DIFF_LINES) {
    fail(
      `Refusing to review: ${String(lines)} changed lines after stripping exceeds the ` +
        `${String(MAX_DIFF_LINES)}-line budget. Split the change or review it by hand.`,
      EXIT_SETUP,
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    fail(
      "ANTHROPIC_API_KEY is not set (checked the environment and the repo-root .env). " +
        "This is a setup error, not a review verdict. Get a key from the Anthropic Console " +
        "and add it to .env — see .env.example.",
      EXIT_SETUP,
    );
  }

  let rubric: string;
  try {
    rubric = readFileSync(RUBRIC_PATH, "utf8");
  } catch {
    fail(`Rubric not found at ${RUBRIC_PATH}. This is a setup error.`, EXIT_SETUP);
  }

  process.stderr.write(`Reviewing with ${modelId}...\n`);
  const started = Date.now();

  const anthropic = createAnthropic({ apiKey });
  let result;
  try {
    result = await generateText({
      model: anthropic(modelId),
      system: buildSystemPrompt(rubric),
      prompt: diff,
      temperature: 0,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      output: Output.object({ schema: ReviewSchema }),
    });
  } catch (error) {
    fail(`Model call failed after SDK retries: ${error instanceof Error ? error.message : String(error)}`, EXIT_SETUP);
  }

  const review = result.output;
  const verdict = deriveVerdict(review.scores, review.findings);

  const usage = result.totalUsage;
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  const price = PRICES[modelId] as { input: number; output: number } | undefined;
  const cost = price ? (inputTokens * price.input + outputTokens * price.output) / 1_000_000 : null;
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  process.stderr.write(`\nScores:\n`);
  for (const [key, value] of Object.entries(review.scores)) {
    process.stderr.write(`  ${key.padEnd(18)} ${String(value)}/10\n`);
  }
  process.stderr.write(`Findings: ${String(review.findings.length)}\n`);
  process.stderr.write(`Verdict: ${verdict}\n`);
  process.stderr.write(`Summary: ${review.summary}\n`);
  process.stderr.write(
    `Tokens: ${String(inputTokens)} in / ${String(outputTokens)} out | ` +
      `Cost: ${cost === null ? `unknown (no price table entry for ${modelId})` : `$${cost.toFixed(4)}`} | ` +
      `Time: ${seconds}s\n`,
  );

  process.stdout.write(`${JSON.stringify({ ...review, verdict }, null, 2)}\n`);
  process.exit(verdict === "pass" ? EXIT_PASS : EXIT_FAIL);
}

await main();
