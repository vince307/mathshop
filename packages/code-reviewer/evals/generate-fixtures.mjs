/**
 * One-shot fixture generator for the promptfoo eval set.
 *
 * Regenerates evals/fixtures/*.diff from git history. The committed .diff
 * files are the source of truth afterward — evals never read git at run time.
 * Full SHAs on purpose; short ones were a stage-2 hardening note.
 *
 * If a source object is missing (e.g. pr20's commit was never reachable from
 * a ref and got pruned on this clone), the script reports it and leaves the
 * committed file untouched: fixtures outlive their git sources.
 *
 * Run: node evals/generate-fixtures.mjs   (from packages/code-reviewer)
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const EVALS_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(EVALS_DIR, "fixtures");
const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

/**
 * git show -R emits swapped header lines (diff --git b/X a/X); review.ts's
 * pathFromHeader parses that as "unknown", hiding the file path from the
 * model. Rewrite the three header lines to canonical orientation. Everything
 * else (hunks, index line) stays byte-exact.
 */
function normalizeReversedHeaders(diff) {
  return diff
    .replace(/^diff --git b\/(\S+) a\/(\S+)$/gm, "diff --git a/$1 b/$2")
    .replace(/^--- b\//gm, "--- a/")
    .replace(/^\+\+\+ a\//gm, "+++ b/");
}

const FIXTURES = [
  {
    file: "07da072-parent-pin-config.diff",
    args: ["show", "--no-color", "--format=", "07da072387e6404acd9700ab4ddc00c9c871a9c8"],
    label: "known-bad config-class (parent-PIN gate)",
  },
  {
    file: "879315e-account-deletion-synced.diff",
    args: ["show", "--no-color", "--format=", "879315e65d1cb0853604488d0f6043c8366de51a"],
    label: "borderline should-pass (service-role + .env.example sync)",
  },
  {
    file: "d6c93d8-R-env-var-removed-from-ci.diff",
    args: ["show", "-R", "--no-color", "--format=", "d6c93d8e127dc97d40aa23132ac2a78f4c3fa47a"],
    label: "reversed: env var removed from CI",
    transform: normalizeReversedHeaders,
  },
  {
    file: "pr19-gate-setup.diff",
    args: [
      "diff",
      "--no-color",
      "6ab9b76419c089aa708daa082cf955a10741a2ea^1...6ab9b76419c089aa708daa082cf955a10741a2ea^2",
    ],
    label: "PR #19: gate-setup infra PR (documented false positive)",
  },
  {
    file: "pr20-supabase-key-rename.diff",
    // Dangling commit (PR #20 was closed, never merged; head survives only as
    // a loose object). This regeneration path dies with the object — the
    // committed fixture file is the durable copy.
    args: ["show", "--no-color", "--format=", "21f30b536c5ae3e9ba134d637cace6cd11f2812f"],
    label: "PR #20: SUPABASE_KEY -> SUPABASE_API_KEY rename without sync",
  },
  {
    file: "pr21-clean-docs.diff",
    args: [
      "diff",
      "--no-color",
      "02bb567d556d3d27648b5d7d8481136d613860e1^1...02bb567d556d3d27648b5d7d8481136d613860e1^2",
    ],
    label: "PR #21: clean docs-typo control",
  },
];

mkdirSync(FIXTURES_DIR, { recursive: true });

let failures = 0;
for (const { file, args, label, transform } of FIXTURES) {
  const target = join(FIXTURES_DIR, file);
  const res = spawnSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (res.error || res.status !== 0) {
    const reason = res.error ? res.error.message : res.stderr.trim();
    if (existsSync(target)) {
      console.log(`KEEP  ${file} — source object unavailable (${reason}); committed file stands`);
    } else {
      failures += 1;
      console.log(`FAIL  ${file} — source object unavailable and no committed copy (${reason})`);
    }
    continue;
  }
  const diff = transform ? transform(res.stdout) : res.stdout;
  if (existsSync(target) && readFileSync(target, "utf8") === diff) {
    console.log(`OK    ${file} — unchanged (${label})`);
    continue;
  }
  writeFileSync(target, diff);
  console.log(`WROTE ${file} (${label})`);
}

process.exit(failures > 0 ? 1 : 0);
