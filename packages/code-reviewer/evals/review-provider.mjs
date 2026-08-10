/**
 * Custom promptfoo provider wrapping the review CLI.
 *
 * The rendered prompt (a unified git diff) is piped to review.ts on stdin —
 * promptfoo's exec: provider can't do that, and it treats the CLI's exit-1
 * "fail" verdict as a provider error. Here exit 0 and 1 are both valid,
 * graded outputs; exit 2 (setup/budget/API error) maps to a provider error
 * so infra failures show as errored cells, never as verdicts.
 *
 * Model selection: per-provider config { model } → REVIEW_MODEL env var,
 * which review.ts resolves at review.ts:143. No CLI changes needed.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const PKG_DIR = fileURLToPath(new URL("..", import.meta.url));

// review.ts stderr: "Tokens: 4756 in / 605 out | Cost: $0.0078 | Time: 8.0s"
const USAGE_RE = /Tokens: (\d+) in \/ (\d+) out \| Cost: \$([0-9.]+)/;

export default class ReviewProvider {
  constructor(options = {}) {
    this.model = options.config?.model;
    this.label = options.label ?? `review:${this.model}`;
  }

  id() {
    return `review-cli:${this.model}`;
  }

  async callApi(prompt) {
    return new Promise((resolve) => {
      const child = spawn(process.execPath, ["--import", "tsx", "review.ts"], {
        cwd: PKG_DIR,
        env: { ...process.env, REVIEW_MODEL: this.model },
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d) => (stdout += d));
      child.stderr.on("data", (d) => (stderr += d));
      child.on("error", (err) => resolve({ error: `spawn failed: ${err.message}` }));
      child.on("close", (code) => {
        if (code !== 0 && code !== 1) {
          resolve({ error: `review.ts exit ${code} (setup error, not a verdict): ${stderr.slice(-500)}` });
          return;
        }
        const usage = USAGE_RE.exec(stderr);
        resolve({
          output: stdout,
          metadata: { exitCode: code, model: this.model },
          ...(usage && {
            tokenUsage: {
              prompt: Number(usage[1]),
              completion: Number(usage[2]),
              total: Number(usage[1]) + Number(usage[2]),
            },
            cost: Number(usage[3]),
          }),
        });
      });
      child.stdin.write(prompt);
      child.stdin.end();
    });
  }
}
