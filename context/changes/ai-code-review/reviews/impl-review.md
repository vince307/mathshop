<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Local AI Code Review Agent (Stage 1)

- **Plan**: context/changes/ai-code-review/plan.md
- **Scope**: Full plan (Phases 1–4)
- **Date**: 2026-08-08
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 3 observations

## Verdicts

| Dimension           | Verdict                                                              |
| ------------------- | -------------------------------------------------------------------- |
| Plan Adherence      | PASS                                                                 |
| Scope Discipline    | WARNING                                                              |
| Safety & Quality    | WARNING                                                              |
| Architecture        | PASS                                                                 |
| Pattern Consistency | WARNING                                                              |
| Success Criteria    | PASS (all automated re-run green; 3rd consecutive stable fixture sweep) |

## Findings

### F1 — Uncaught exceptions exit as code 1 (reads as "review failed")

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: packages/code-reviewer/review.ts:224
- **Detail**: `await main()` has no catch; parseArgs (unknown flag), loadEnvFile (malformed .env), and readStdin can throw. Uncaught exceptions make Node exit 1 — the code reserved exclusively for "the code failed review". A typo'd `--mode` flag reads as a red verdict downstream.
- **Fix**: `await main().catch((e) => fail(message, EXIT_SETUP))` so any unplanned throw lands on exit 2.
- **Decision**: FIXED — catch added at review.ts tail; verified: unknown `--mode` flag now exits 2 with "Unexpected error: Unknown option '--mode'".

### F2 — Non-diff garbage on stdin passes as exit 0

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: packages/code-reviewer/review.ts:147
- **Detail**: Non-empty input with no `diff --git ` header (wrong command piped, ANSI-colored output, truncated diff) parses to zero segments and falls into the "nothing to review" branch → exit 0. A broken pipeline silently reads as a green gate.
- **Fix**: If input is non-empty but parses to zero segments, exit 2 ("stdin does not look like a unified git diff"); keep exit 0 only for the all-segments-stripped-as-noise case.
- **Decision**: FIXED — zero-segment guard added after parseDiff; verified: garbage stdin exits 2, noise-only diff still exits 0.

### F3 — Path regex mis-splits filenames with spaces → noise-filter evasion

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: packages/code-reviewer/review.ts:46
- **Detail**: The lazy `diff --git` header regex takes the earliest space as the a/b separator, so a file named `evil b/context/x.ts` resolves to a `context/`-prefixed path and is stripped from review — a crafted filename can evade the gate (stage-2 relevance for third-party PRs). Innocent paths with spaces get mangled labels.
- **Fix A ⭐ Recommended**: Anchor to the b-side from the right — take the path after the LAST ` b/` occurrence in the header line.
  - Strength: Two-line change; kills earliest-space ambiguity for every git-generated unquoted header.
  - Tradeoff: Quoted/escaped-byte paths still bypass prefix checks; full fidelity needs the +++/--- parser.
  - Confidence: HIGH — header format is stable git plumbing.
  - Blind spot: Adversarial quoted paths (octal escapes) remain; note for stage 2.
- **Fix B**: Parse paths from `+++ b/…` / `--- a/…` lines; use `diff --git` only as segment delimiter.
  - Strength: Unambiguous even for quoted paths and /dev/null.
  - Tradeoff: Bigger parser rework; binary segments lack +++/--- lines, needing a fallback anyway.
  - Confidence: MED.
  - Blind spot: Untested against the repo's real diff corpus.
- **Decision**: FIXED via Fix A (extended) — `pathFromHeader` uses an equal-split check for non-rename headers (correct even when the filename contains ` b/`), right-anchored last-` b/` fallback for renames. Verified: `evil b/context/x.ts` is no longer stripped; real `context/` still is; space-containing rename parses. Quoted/octal-escaped paths remain a stage-2 note.

### F4 — Review standard encoded in the prompt, not the rubric file

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: packages/code-reviewer/review.ts:96 (buildSystemPrompt)
- **Detail**: The phase-3 bullet "a signing/HMAC secret falling back to a constant value … is a blocker" adds a blocker category beyond the rubric's enumerated examples, shaped around fixture 07da072 — while the package's own CLAUDE.md says review standards live in code-review-dod.md. The other tightening bullets (min-not-mean, absence-of-sync) interpret the rubric and are fine.
- **Fix A ⭐ Recommended**: Move the fail-open-secret sentence into code-review-dod.md (criterion-5 anchor / blocker examples); keep the prompt bullet as a generic calibration line.
  - Strength: Restores single-source-of-truth; standard becomes team-editable.
  - Tradeoff: Edits a team-owned file; re-run fixtures (~$0.05) to confirm the gate still goes red.
  - Confidence: HIGH — rubric text is what the model sees either way.
  - Blind spot: Whether the team wants rubric edits bundled into this change.
- **Fix B**: Leave in the prompt; record as a parked follow-up.
  - Strength: Zero risk to the just-proven fixture behavior.
  - Tradeoff: Package ships contradicting its own stated rule.
  - Confidence: MED.
  - Blind spot: Future rubric editors won't know the shadow rule exists.
- **Decision**: FIXED via Fix A, adapted — the standard now lives in code-review-dod.md (criterion-5 anchor + verdict-rule blocker examples). First attempt genericized the prompt bullet entirely and the gate regressed (07da072 passed again); the calibration sentence was restored as an explicit citation of the rubric's anchor, resolving the single-source-of-truth objection while keeping the gate red. Re-verified: full sweep green, 07da072 exit 1 / criterion-6 = 3 with identical scores to the stable runs.

### F5 — Fixture harness robustness (consolidated)

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: packages/code-reviewer/fixtures.ts:82–96
- **Detail**: (a) spawnSync launch failures (`res.error`) not inspected — missing git crashes the sweep with "failed: null" instead of counting as a setup failure; (b) `git show` lacks `--no-color`, so `color.diff=always` users get false "nothing to review" rows; (c) 7-char SHAs break on shallow CI clones (stage-2 concern).
- **Fix**: Check `res.error` in both helpers; add `--no-color` to gitShow; note full-SHA + fetch-depth for stage 2.
- **Decision**: FIXED — res.error checked in gitShow (throws with message) and runReview (counts as exit-2 row); gitShow failures now count as setup failures instead of crashing the sweep; `--no-color` added; SHA/fetch-depth recorded in change.md stage-2 notes.

### F6 — Stage-2 hardening notes (consolidated)

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: packages/code-reviewer/review.ts (various)
- **Detail**: Acceptable locally, record before the CI gate: unbounded stdin buffering before the budget guard; no `engines` field despite requiring Node ≥22 (loadEnvFile); loadEnvFile pulls the entire repo .env (service-role key, SMTP) into process.env; prompt-injection via diff content can still steer scores (inherent to LLM review).
- **Fix**: Add `"engines": {"node": ">=22"}` now; append the rest to the parked stage-2 notes in change.md.
- **Decision**: FIXED — engines field added; stdin bound, .env blast radius, prompt injection, SHAs, and quoted-path bypass all recorded under "Stage-2 hardening" in change.md's parked follow-ups.

### F7 — Unplanned @types/node devDependency

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: packages/code-reviewer/package.json:20
- **Detail**: Not in the plan's dependency contract, but required by the package tsconfig's `types: ["node"]` — benign and necessary.
- **Fix**: None — accept as-is.
- **Decision**: SKIPPED — accepted as-is (benign, required by the tsconfig).
