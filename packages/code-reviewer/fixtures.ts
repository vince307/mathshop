/**
 * Fixture harness: pipes historical commits through the review CLI and checks
 * expectations — the "prove the gate goes red" meta-check (L-002 generalized)
 * and the seed of the future promptfoo eval set.
 *
 * Hard assertions (fail the run):
 *   07da072  known-bad config-class change -> exit 1 AND configDeployment < 5
 *   9ee3a49  trivially clean 1-line fix    -> exit 0
 * Report-only rows (printed, never fail the run on verdict differences):
 *   3ba28eb  lockfile-noise exerciser (post-strip line count + cost)
 *   d6c93d8 (reversed)  1-line env-var removal from CI (expected criterion-6 fail)
 *   879315e  borderline should-pass (service-role change that did sync .env.example)
 * Any exit-2 row is a harness/setup failure and fails the run regardless of tier.
 *
 * Full sweep costs ~$0.05 on Haiku. Run: npm run fixtures
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { Review } from "./schema.ts";

const PKG_DIR = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

interface Fixture {
  sha: string;
  reversed: boolean;
  label: string;
  expectation: string;
  hard: ((r: Result) => string | null) | null;
}

interface Result {
  exitCode: number;
  review: Review | null;
  diffLine: string;
  costLine: string;
}

const FIXTURES: Fixture[] = [
  {
    sha: "07da072",
    reversed: false,
    label: "known-bad config-class (parent-PIN gate)",
    expectation: "exit 1 AND configDeployment < 5",
    hard: (r) => {
      if (r.exitCode !== 1) return `expected exit 1, got ${String(r.exitCode)}`;
      const c6 = r.review?.scores.configDeployment;
      if (c6 === undefined || c6 >= 5) return `expected configDeployment < 5, got ${String(c6)}`;
      return null;
    },
  },
  {
    sha: "9ee3a49",
    reversed: false,
    label: "trivially clean (1-line timestamp fix)",
    expectation: "exit 0",
    hard: (r) => (r.exitCode === 0 ? null : `expected exit 0, got ${String(r.exitCode)}`),
  },
  {
    sha: "3ba28eb",
    reversed: false,
    label: "lockfile-noise exerciser",
    expectation: "report: post-strip line count + cost",
    hard: null,
  },
  {
    sha: "d6c93d8",
    reversed: true,
    label: "reversed: env var removed from CI",
    expectation: "report: expected criterion-6 fail",
    hard: null,
  },
  {
    sha: "879315e",
    reversed: false,
    label: "borderline should-pass (service-role + .env.example sync)",
    expectation: "report: pass, or justified findings",
    hard: null,
  },
];

function gitShow(sha: string, reversed: boolean): string {
  const args = ["show", sha, "--format="];
  if (reversed) args.splice(2, 0, "-R");
  const res = spawnSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (res.status !== 0) throw new Error(`git show ${sha} failed: ${res.stderr}`);
  return res.stdout;
}

function runReview(diff: string): Result {
  const res = spawnSync(process.execPath, ["--import", "tsx", "review.ts"], {
    cwd: PKG_DIR,
    input: diff,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  let review: Review | null = null;
  try {
    review = JSON.parse(res.stdout) as Review;
  } catch {
    // exit-2 and nothing-to-review paths emit no stdout JSON — that's expected.
  }
  const stderr = res.stderr;
  return {
    exitCode: res.status ?? 2,
    review,
    diffLine: /^Diff: .*$/m.exec(stderr)?.[0] ?? "",
    costLine: /^Tokens: .*$/m.exec(stderr)?.[0] ?? "",
  };
}

let hardFailures = 0;
let setupFailures = 0;

for (const fixture of FIXTURES) {
  const name = fixture.reversed ? `${fixture.sha} (-R)` : fixture.sha;
  console.log(`\n=== ${name} — ${fixture.label}`);
  console.log(`    expectation: ${fixture.expectation}`);
  const result = runReview(gitShow(fixture.sha, fixture.reversed));
  const scores = result.review
    ? Object.entries(result.review.scores)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(" ")
    : "(no verdict JSON)";
  console.log(`    ${result.diffLine}`);
  console.log(`    exit ${String(result.exitCode)} | ${scores}`);
  if (result.costLine) console.log(`    ${result.costLine}`);
  if (result.review && result.review.findings.length > 0) {
    for (const f of result.review.findings) {
      console.log(`    [${f.severity}] c${String(f.criterion)} ${f.file}:${String(f.line)} — ${f.description}`);
    }
  }

  if (result.exitCode === 2) {
    setupFailures += 1;
    console.log(`    RESULT: SETUP FAILURE (exit 2 — the pipeline broke, not the verdict)`);
    continue;
  }
  if (fixture.hard) {
    const failure = fixture.hard(result);
    if (failure) {
      hardFailures += 1;
      console.log(`    RESULT: HARD ASSERTION FAILED — ${failure}`);
    } else {
      console.log(`    RESULT: hard assertion OK`);
    }
  } else {
    console.log(`    RESULT: report-only row`);
  }
}

console.log(
  `\n${String(hardFailures)} hard assertion failure(s), ${String(setupFailures)} setup failure(s) across ${String(FIXTURES.length)} fixtures.`,
);
process.exit(hardFailures + setupFailures > 0 ? 1 : 0);
