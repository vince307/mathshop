# Strip embedded diffs from review input — Implementation Plan

## Overview

The AI review gate reads a unified diff and nothing else. When a PR commits a `.diff` file as test data, the reviewer sees the file's *content* — itself a diff — as live change and reviews it as production code. This has blocked merges twice, once per model, each time forcing a documented admin bypass.

The fix is mechanical: teach the gate's noise pre-filter that an embedded diff is data, not code. One predicate, extracted into an importable module so it can be proven by a free offline test, plus the lesson that keeps the class from being rediscovered.

## Current State Analysis

`packages/code-reviewer/review.ts` pre-filters the diff before the model sees it. `isNoise` (`review.ts:69-75`) strips three classes today:

```
package-lock.json (any directory)
context/**
public/** when binary
```

Everything else is concatenated and sent to the model, with the post-strip line count enforced against `MAX_DIFF_LINES = 4000` (`review.ts:21`).

**The failure.** PR #24 committed six `packages/code-reviewer/evals/fixtures/*.diff` files — deliberately known-bad historical diffs, the eval set's input data. Both models reviewed the fixture content as if it shipped:

- **Haiku** (`claude-haiku-4-5`, run 31420164043) — three criterion-6 blockers via the prompt's "absence is evidence" rule, demanding env-var synchronization for variables that exist only inside the fixture files. Its own summary conceded *"These are intentional test cases demonstrating known-bad patterns"* and blocked anyway.
- **Sonnet** (`claude-sonnet-4-6`, run 31420676881) — a criterion-5 blocker on the parent-PIN `PARENT_SESSION_SECRET ?? ""` fail-open embedded in `07da072-parent-pin-config.diff`, reasoning *"the fixture embeds real production code paths that ship with this PR."*

Both were fooled through their strongest lens, which is the evidence that this is not a prompt or model problem. Verbatim comments: `evidence/pr24-haiku-review-comment.md`, `evidence/pr24-sonnet-review-comment.md`.

**Measured impact on the commit that caused it** (`5dee0cb`, "fixture materialization (p1)" — computed offline, not estimated):

| | files kept | files stripped | lines to the model |
| --- | ---: | ---: | ---: |
| Today | 7 | 5 | **1762** |
| After this plan | 1 | 11 | **106** |

The single surviving file is `packages/code-reviewer/evals/generate-fixtures.mjs` — the only real code in that commit.

**Constraints discovered:**

- `isNoise` is **not exported**, and `review.ts` executes `await main()` at module top level (`review.ts:257`). Importing the file to test the predicate would run the CLI. Extraction is a precondition for any offline test, not a stylistic preference.
- The package has **no tests**. Root vitest is `include: ["tests/**/*.test.{ts,tsx}"]` (`vitest.config.ts`), root ESLint has `ignores: ["packages/**"]` (`eslint.config.js:82`), root `tsconfig.json` has `exclude: ["packages"]`. The package self-governs via its own tsconfig — `npx tsc --noEmit -p packages/code-reviewer`.
- Two strings hardcode the noise list and go stale silently: the system prompt's *"lockfiles and context/ docs were removed deliberately"* (`review.ts:104`) and the nothing-to-review stderr message (`review.ts:168`). Leaving them unsynchronized tells the model an incomplete list — a softer version of the same confusion.

## Desired End State

A PR that commits `.diff` or `.patch` files gets them stripped before the model sees them, exactly as `context/**` is stripped today. The predicate lives in its own module with a unit test that runs on every `npm test`, offline and free. The class is recorded in `lessons.md` so the next person meets it as a rule rather than as a blocked PR.

Verified by: `npm test` covers the predicate; replaying `5dee0cb` through the CLI prints `12 file(s), 11 stripped as noise, 106 changed line(s)`.

### Key Discoveries:

- **The end-to-end replay is free.** `review.ts` writes the `Diff: …` line (`review.ts:162`) *before* the API-key check (`review.ts:182`), and `process.loadEnvFile` never overrides a variable already set in the shell (`review.ts:139`). So `ANTHROPIC_API_KEY= git show 5dee0cb | npx tsx review.ts` prints the strip arithmetic and exits 2 on the key check, without one model call. This is what makes "offline test + one manual replay" a complete proof rather than a compromise.
- **`5dee0cb` is the ideal replay subject** — it is the actual commit that introduced the fixtures, and after the fix exactly one file survives, so the assertion is unambiguous.
- **`pathFromHeader` (`review.ts:42-56`) is already hardened** against a crafted filename smuggling itself into a stripped prefix: it finds the split where both sides of `a/X b/X` match. An extension-based predicate inherits that hardening and adds no new parsing.
- **A side effect worth having:** fixture files are large (one is 884 lines). A PR adding a few more would cross `MAX_DIFF_LINES` and exit **2** — a setup error, not a verdict. Stripping them removes that failure mode too.
- **Precedent for the report-only fixture row** is `3ba28eb` in `fixtures.ts:59-65` (`hard: null`); it is deliberately *not* being followed here — see "What We're NOT Doing".

## What We're NOT Doing

- **No new row in `fixtures.ts`.** The harness costs a real API call and only runs manually via `npm run fixtures`; the offline test plus one recorded replay covers the same ground for free and runs in CI. Decided explicitly (Q4), against the `3ba28eb` precedent.
- **No prompt or model change.** Both models failed through different lenses; that is the evidence the fix belongs in the pre-filter. The only prompt edit here is factual synchronization of the noise list.
- **No change to the rubric** (`context/team/code-review-dod.md`) — review standards are not what went wrong.
- **No vitest inside `packages/code-reviewer/`.** That would mean a new devDependency, a nested lockfile update, and CI wiring for a single test file.
- **No revisit of `MAX_DIFF_LINES`** — it improves as a side effect; changing the budget is a separate decision.
- **No retroactive re-review of PR #24.** It landed via documented admin bypass and is history.

## Implementation Approach

Three phases, ordered so the risk is isolated. Phase 1 is a pure extraction with a byte-identical outcome — if the root toolchain rejects the cross-boundary import, that surfaces before any logic has changed and the fallback is cheap. Phase 2 changes exactly one predicate and proves it. Phase 3 records the class.

The predicate is **extension-based** (`.diff`, `.patch`) rather than path-based. The property that fools the model is "this file's content is a diff", not "this file lives under `evals/fixtures/`" — a path rule would let the same class back in from a new location. Decided in planning (Q1).

## Critical Implementation Details

**Toolchain boundary.** Root `tsconfig.json` excludes `packages` and root ESLint ignores `packages/**`, but a test in `tests/` that imports `packages/code-reviewer/noise.ts` pulls that file into the root TypeScript program anyway — `exclude` filters the `include` globs, it does not stop an imported file from joining the program. The file will therefore be type-checked under `astro/tsconfigs/strict` in addition to the package's own config, and ESLint's `projectService: true` + `strictTypeChecked` will resolve its types while linting the test.

Two consequences bind the implementer:

- `noise.ts` must import nothing and must not use `.ts`-extension import specifiers (the package's `allowImportingTsExtensions` is not in effect under the root config). Keep it plain, self-contained TypeScript.
- The test must import it **extensionless** (`from "../packages/code-reviewer/noise"`) — root `moduleResolution` is `bundler`, and Vite resolves the extension.

`npm run check` and `npm run lint` are the gates where this shows up; both are Phase 1 success criteria for that reason. **Fallback if either goes red:** move the test into the package as `packages/code-reviewer/noise.test.ts` and add `"packages/code-reviewer/**/*.test.ts"` to root vitest's `include`. Vitest transpiles via esbuild and needs no tsconfig membership, so that variant sidesteps both tools entirely. Record which variant shipped and why.

---

## Phase 1: Extract the predicate into an importable module

### Overview

Move the diff parsing and the noise predicate out of the CLI entry point so they can be imported without executing `main()`. Behavior is unchanged — this phase must be provably a no-op.

### Changes Required:

#### 1. New predicate module

**File**: `packages/code-reviewer/noise.ts`

**Intent**: Hold `DiffSegment`, `pathFromHeader`, `parseDiff`, and `isNoise` — moved verbatim from `review.ts`, exported. Carrying `pathFromHeader` and `parseDiff` along keeps the predicate testable against real diff text rather than hand-built objects, which is what the Phase 2 test needs.

**Contract**: Exports `interface DiffSegment { path: string; text: string; binary: boolean }`, `parseDiff(diff: string): DiffSegment[]`, and `isNoise(segment: DiffSegment): boolean`. No imports, no side effects, no `.ts`-extension specifiers. The existing comment on `pathFromHeader` explaining the `" b/"` split hardening moves with the code — it documents a security property, not a style choice.

#### 2. CLI entry point

**File**: `packages/code-reviewer/review.ts`

**Intent**: Import the three symbols from `./noise.ts` and delete the moved definitions. Nothing else changes.

**Contract**: The package's own imports use explicit `.ts` extensions (`./schema.ts` at `review.ts:15`) — follow that convention here. The `segments` / `kept` / `strippedCount` pipeline at `review.ts:157-159` is untouched.

### Success Criteria:

#### Automated Verification:

- Package type-checks: `npx tsc --noEmit -p packages/code-reviewer`
- Root type-check stays clean: `npm run check`
- Root lint stays clean: `npm run lint`
- Root suite stays green at its current count: `npm test`

#### Manual Verification:

- Replaying the causal commit produces the **unchanged** arithmetic — `ANTHROPIC_API_KEY= git show 5dee0cb | npx tsx packages/code-reviewer/review.ts` prints `Diff: 12 file(s), 5 stripped as noise, 1762 changed line(s)` and exits 2 on the missing key. Any other number means the extraction was not a no-op.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Strip embedded diffs and prove it

### Overview

Extend the predicate to `.diff` and `.patch`, add the offline test that keeps it honest, and synchronize the two strings that describe the noise list to the reader and to the model.

### Changes Required:

#### 1. The predicate

**File**: `packages/code-reviewer/noise.ts`

**Intent**: Strip any segment whose path ends in `.diff` or `.patch`. A committed diff is test data or evidence; its content is a diff-within-a-diff, which the reviewer cannot distinguish from live change.

**Contract**: One added condition in `isNoise`, matching on the path's extension case-insensitively. Update the module's doc comment — it currently enumerates "lockfiles, `context/**` churn, public binaries" and is the closest thing to a specification of the strip contract.

#### 2. Offline regression test

**File**: `tests/review-noise.test.ts`

**Intent**: Prove the predicate on real diff text, free and offline, on every `npm test`. This is the change's only automated guard, so it must cover the class rather than one example.

**Contract**: Imports `parseDiff` and `isNoise` extensionless from `../packages/code-reviewer/noise`. Cases: a fixture path under `evals/fixtures/` is stripped; a `.patch` anywhere is stripped; a `.diff` outside the package is stripped (the path-independence that motivated the extension rule); the three pre-existing classes still strip; and a normal source file — in particular `generate-fixtures.mjs`, the file that must survive `5dee0cb` — is **kept**. Build inputs as diff text run through `parseDiff`, not as hand-constructed `DiffSegment` literals, so the test exercises the real header parsing.

#### 3. The two strings that describe the strip

**File**: `packages/code-reviewer/review.ts`

**Intent**: Keep the model and the operator told the truth about what was removed. The system prompt instructs the model not to penalize the change for the absence of pre-filtered files; an incomplete list there reintroduces a weaker form of the same false positive.

**Contract**: The system-prompt line at `review.ts:104` and the nothing-to-review stderr message at `review.ts:168` both enumerate the stripped classes; add embedded diffs to each.

#### 4. Package rules

**File**: `packages/code-reviewer/CLAUDE.md`

**Intent**: Record the strip contract and where it now lives, so the next person editing the reviewer does not re-inline the predicate or add a fourth copy of the noise list.

**Contract**: One bullet in the existing list, in the file's established voice: the pre-filter is `noise.ts`, embedded diffs are stripped as data, and the two prose strings in `review.ts` must be updated whenever the predicate changes.

### Success Criteria:

#### Automated Verification:

- New test passes and the suite count rises: `npm test`
- Package type-checks: `npx tsc --noEmit -p packages/code-reviewer`
- Root type-check and lint stay clean: `npm run check && npm run lint`

#### Manual Verification:

- Replaying the causal commit now prints `Diff: 12 file(s), 11 stripped as noise, 106 changed line(s)` — `ANTHROPIC_API_KEY= git show 5dee0cb | npx tsx packages/code-reviewer/review.ts`. Record the before/after lines in the commit message or `evidence/`.
- Deliberate-break check (L-002): revert the added condition, confirm `npm test` goes **red**, restore. A test that cannot fail proves nothing.
- Which test-location variant shipped — `tests/` or the package-local fallback — is recorded, with the reason.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Record the class as a lesson

### Overview

Two false-positive classes have now forced admin bypasses on this gate (PR #19: cross-file config state invisible to a diff-only reviewer; PR #24: fixtures-as-code). A gate that gets routinely bypassed stops being a gate. The lesson names the general rule.

### Changes Required:

#### 1. Lessons file

**File**: `context/foundation/lessons.md`

**Intent**: Add **L-004** — data that looks like code must be stripped before the review model, because the reviewer sees only the diff and cannot tell input data from change.

**Contract**: Follow the existing L-001…L-003 structure exactly: `## L-00N: <imperative rule>` followed by **Rule** / **Why** / **How to apply** paragraphs. Cite both bypasses as the evidence, point at `noise.ts` as the enforcement point, and state the general test — *would this file's content be misread as change if the reviewer only saw the diff?* Keep it to the length of its siblings: every agent in every `/10x-*` step reads this file, so verbosity has a running cost.

### Success Criteria:

#### Automated Verification:

- Nothing to run — prose only. Confirm no code changed in this phase: `git diff --stat` names only `context/foundation/lessons.md`.

#### Manual Verification:

- L-004 reads as a rule someone could apply to a file they have not seen, not as a retelling of PR #24.
- Numbering does not collide with the `L-004…L-007` used by the autonomous-run skill's `references/lessons-addendum.md`. If it does, take the next free number and say so — the two files are read together by every agent in a run.

---

## Testing Strategy

### Unit Tests:

- `tests/review-noise.test.ts` — the predicate, driven by real diff text through `parseDiff`. Covers: `.diff` under `evals/fixtures/`, `.patch` anywhere, `.diff` outside the package, the three pre-existing classes, and the must-be-kept case (`generate-fixtures.mjs`).

### Integration Tests:

- None added. The CLI's end-to-end path is covered by the free replay of `5dee0cb`, which exercises stdin → `parseDiff` → strip → line count without an API call.

### Manual Testing Steps:

1. Before Phase 2: `ANTHROPIC_API_KEY= git show 5dee0cb | npx tsx packages/code-reviewer/review.ts` → expect `12 file(s), 5 stripped as noise, 1762 changed line(s)`.
2. After Phase 2: the same command → expect `12 file(s), 11 stripped as noise, 106 changed line(s)`.
3. Deliberate break: revert the predicate condition, `npm test` must go red, restore.

## Performance Considerations

Strictly positive and worth stating: the replayed commit drops from 1762 to 106 reviewed lines — roughly a 94% cut in input tokens for that shape of PR, and it moves fixture-heavy changes well clear of the 4000-line budget that would otherwise exit 2.

## Migration Notes

None. No schema, no data, no config. The change is confined to the dev-tooling package plus one test and one lessons entry, and reverts cleanly by deleting the added condition.

## References

- Change identity and the fixtures-as-code write-up: `context/changes/review-fixture-noise-strip/change.md`
- Verbatim blocked reviews: `evidence/pr24-haiku-review-comment.md`, `evidence/pr24-sonnet-review-comment.md`
- The pre-filter today: `packages/code-reviewer/review.ts:69-75`
- Package-scoped rules: `packages/code-reviewer/CLAUDE.md`
- Report-only fixture-row precedent (deliberately not followed): `packages/code-reviewer/fixtures.ts:59-65`
- Prior admin bypass, same gate, different class: `context/changes/ai-code-review-ci/change.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Extract the predicate into an importable module

#### Automated

- [x] 1.1 Package type-checks: `npx tsc --noEmit -p packages/code-reviewer` — aedf9ef
- [x] 1.2 Root type-check stays clean: `npm run check` — aedf9ef
- [x] 1.3 Root lint stays clean: `npm run lint` — aedf9ef
- [x] 1.4 Root suite stays green at its current count: `npm test` — aedf9ef

#### Manual

- [x] 1.5 Replay of `5dee0cb` prints the unchanged `12 file(s), 5 stripped, 1762 lines` — aedf9ef

### Phase 2: Strip embedded diffs and prove it

#### Automated

- [x] 2.1 New test passes and the suite count rises: `npm test` — 5605dc3
- [x] 2.2 Package type-checks: `npx tsc --noEmit -p packages/code-reviewer` — 5605dc3
- [x] 2.3 Root type-check and lint stay clean: `npm run check && npm run lint` — 5605dc3

#### Manual

- [x] 2.4 Replay of `5dee0cb` prints `12 file(s), 11 stripped, 106 lines`; before/after recorded — 5605dc3
- [x] 2.5 Deliberate-break check: reverting the condition turns `npm test` red — 5605dc3
- [x] 2.6 Test-location variant (`tests/` or package-local fallback) recorded with its reason — 5605dc3

### Phase 3: Record the class as a lesson

#### Automated

- [x] 3.1 `git diff --stat` names only `context/foundation/lessons.md` — amended: also `noise.ts`, `CLAUDE.md`, `tests/review-noise.test.ts`, one word each, fixing the `L-004` references written in Phase 2 to `L-008` after the predicted numbering collision was confirmed — 23f8014

#### Manual

- [x] 3.2 L-004 reads as an applicable rule, not a retelling of PR #24 — 23f8014
- [x] 3.3 Numbering does not collide with the autonomous-run skill's `lessons-addendum.md` — 23f8014
