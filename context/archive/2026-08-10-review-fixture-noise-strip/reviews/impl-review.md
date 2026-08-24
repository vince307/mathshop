<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Strip embedded diffs from review input

- **Plan**: `context/changes/review-fixture-noise-strip/plan.md`
- **Scope**: Phases 1–3 of 3 (full plan)
- **Date**: 2026-08-24
- **Verdict**: NEEDS ATTENTION → **RESOLVED** (4 fixed, 1 skipped as already-documented; all gates re-run green)
- **Findings**: 0 critical, 2 warnings, 3 observations

No FAIL and nothing blocking a merge. The verdict was NEEDS ATTENTION because of two warnings, the
first being a security-posture reduction recorded nowhere at review time. Both were fixed during
triage, along with two of the three observations; all gates were re-run green afterwards.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING → resolved in triage (F1, F2 fixed) |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Success criteria — re-verified independently

| Check | Result |
|---|---|
| `tsc --noEmit -p packages/code-reviewer` | OK |
| `npm run lint` | clean |
| `npm run check` | 0 errors, 0 warnings (188 files) |
| `npm test` | 428 passed / 51 files (429 after the triage fixes) |
| Replay `5dee0cb` | `12 file(s), 11 stripped as noise, 106 changed line(s)` |

## What passed that could have failed

- All six "What We're NOT Doing" boundaries respected: no `fixtures.ts` row, no rubric change,
  no model change, no vitest inside the package, `MAX_DIFF_LINES` untouched, no re-review of PR #24.
- Over-stripping risk checked against the real tree: no `patch-package`, and no `.diff`/`.patch`
  files exist outside the six eval fixtures, so the predicate strips nothing of value today.
- All four surfaces enumerating the strip list agree (`noise.ts`, both `review.ts` strings, `CLAUDE.md`).

## Findings

### F1 — Eval fixtures are model input, and they now escape review entirely

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `packages/code-reviewer/noise.ts:60`
- **Detail**: `promptfooconfig.yaml` declares `prompts: - "{{diff}}"` bound to
  `diff: file://fixtures/*.diff` — fixture contents are fed verbatim as the prompt to a model.
  This change removes those exact files from review. Before, the reviewer saw fixture content
  (badly — the bug being fixed); after, nobody sees it. Text placed inside a fixture, including
  prompt injection aimed at the eval grader, lands unreviewed.
  Two aggravating facts: `generate-fixtures.mjs` is explicitly one-shot — its header states the
  committed `.diff` files are "the source of truth afterward" and "fixtures outlive their git
  sources" (pr20's commit was already unreachable on some clones) — so fixtures are **not**
  reliably reproducible from git and nothing verifies them against their SHAs; and the residual
  risk is named in neither the plan's "What We're NOT Doing", nor L-008, nor the package
  `CLAUDE.md`. It was never weighed, only omitted.
  Mitigating: dev tooling only, no production path; evals run manually with explicit spend; fork
  PRs are skipped by the gate by policy.
- **Fix A ⭐ Recommended**: Record the residual risk where the decision lives (L-008 + package CLAUDE.md)
  - Strength: The tradeoff is correct — stripping is still right — but an unnamed risk cannot be
    revisited. L-008 carries the "how to apply"; this adds the missing "what you give up".
  - Tradeoff: Documents the gap without closing it.
  - Confidence: HIGH — the consumption path was verified in `promptfooconfig.yaml`, not inferred.
  - Blind spot: Does not stop a poisoned fixture; relies on the next reader.
- **Fix B**: Verify fixtures against their source SHAs in `fixtures.ts`
  - Strength: Turns "unreviewed" into "unreviewed but pinned" — drift from the source commit fails
    the harness.
  - Tradeoff: The generator documents that sources get pruned, so this would go red for reasons
    unrelated to tampering. Real new work, and partly re-litigates a settled design.
  - Confidence: MEDIUM — the pruning caveat is documented; current SHA reachability unchecked.
  - Blind spot: No cover for fixtures whose source was always synthetic.
- **Decision**: FIXED via Fix A — residual risk recorded in L-008 ("What you give up") and packages/code-reviewer/CLAUDE.md, both instructing a hand review of any new or edited fixture

### F2 — The strip reports a count, never the paths

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `packages/code-reviewer/review.ts:123`
- **Detail**: stderr prints `11 stripped as noise` and nothing more. Until now the stripped set was
  three fixed, well-known classes, so a count sufficed. This change makes stripping depend on a
  file's *name*: any path ending `.diff`/`.patch` leaves review, anywhere in the tree. Neither the
  CI log nor the PR comment can say which files those were — which is also what makes F1 hard to
  notice in practice.
- **Fix**: Print the stripped paths alongside the count (stderr only, no PR-comment change) —
  about two lines beside the existing write.
- **Decision**: FIXED — review.ts now prints each stripped path beneath the count; verified on 5dee0cb (all six fixtures named)

### F3 — CLAUDE.md now sends mixed signals about where the package is governed

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `packages/code-reviewer/CLAUDE.md:8,13`
- **Detail**: Line 8 says the package "is excluded from root ESLint and root tsconfig, and
  self-governs via its own `tsconfig.json`". New line 13 says its coverage lives in root vitest.
  Both true, but a reader cannot tell whether crossing that boundary was deliberate or an
  oversight. The reasoning lives in `evidence/replay-5dee0cb.md`, which `/10x-archive` will bury.
- **Fix**: One clause on line 13 stating the test sits in `tests/` deliberately — vitest needs no
  tsconfig membership, and the boundary was verified green.
- **Decision**: FIXED — CLAUDE.md line 13 states the test sits in tests/ deliberately, with the reason (vitest needs no tsconfig membership; boundary verified green)

### F4 — `changedLineCount` stayed behind in review.ts

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: `packages/code-reviewer/review.ts:38`
- **Detail**: `parseDiff` and `isNoise` moved to `noise.ts`; `changedLineCount` — the third
  function of the same concern, and the one producing the 1762→106 number the whole change is
  measured by — did not. Consequence: the offline test can assert which files survive but not the
  post-strip line count, so that number is only ever proven by the manual replay.
- **Fix**: Move `changedLineCount` to `noise.ts` and assert 106 in the test.
- **Decision**: FIXED — changedLineCount moved to noise.ts; test asserts a fat fixture contributes 0 of the post-strip line count

### F5 — Success criterion 3.1 was amended rather than met

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `context/changes/review-fixture-noise-strip/plan.md` (Progress 3.1)
- **Detail**: Recorded for completeness; already surfaced and decided during implementation. The
  criterion demanded a `lessons.md`-only diff; the p3 commit also carries three one-word
  `L-004`→`L-008` reference fixes forced by the numbering collision the plan itself predicted.
  Ticked with an inline amendment note — the deviation is visible in the plan, not rubber-stamped.
- **Fix**: None needed.
- **Decision**: SKIPPED — deviation already documented inline in the plan's Progress row and in the p3 commit; nothing to fix
