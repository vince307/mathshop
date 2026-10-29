# Strip embedded diffs from review input — Plan Brief

> Full plan: `context/changes/review-fixture-noise-strip/plan.md`
> Evidence: `context/changes/review-fixture-noise-strip/evidence/pr24-{haiku,sonnet}-review-comment.md`

## What & Why

The AI review gate sees a unified diff and nothing else. When a PR commits a `.diff` file as test data, the reviewer reads that file's content — itself a diff — as live production code. It has blocked merges twice, once per model, each time forcing a documented admin bypass. A gate that gets routinely bypassed stops being a gate.

## Starting Point

`isNoise` in `packages/code-reviewer/review.ts:69` already strips three classes before the model sees anything: lockfiles, `context/**`, and binary `public/**`. Committed diffs are not among them. The predicate is unexported and `review.ts` runs `await main()` at import time, so nothing about it can be tested today — and the package has no tests at all.

## Desired End State

A PR that commits `.diff` or `.patch` files gets them stripped exactly as `context/**` is stripped today. The predicate lives in its own module behind a unit test that runs free and offline on every `npm test`. On the commit that caused the incident, the model's input drops from **1762 lines to 106** — the one file in it that is actually code.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Predicate shape | By extension (`.diff` / `.patch`) | The property that fools the model is "content is a diff", not "lives under `evals/fixtures/`" — a path rule lets the class back in from a new location. | Plan (Q1) |
| Where the proof lives | Extract `noise.ts`, unit test in `tests/` | Free, deterministic, runs in CI — the `fixtures.ts` harness costs an API call and only ever runs by hand. | Plan (Q2) |
| Fixture-harness row | None | The offline test plus one free CLI replay covers the same ground; keeps the change small as `change.md` asks. | Plan (Q4) |
| Prompt / model change | None | Both models failed through *different* lenses, which is the evidence the fix belongs in the pre-filter. | Change notes |
| Lesson | Add L-004 to `lessons.md` | Second bypass-forcing false-positive class on this gate; the knowledge dies at `/10x-archive` otherwise. | Plan (Q5) |

## Scope

**In scope:** extract `parseDiff`/`isNoise` into `packages/code-reviewer/noise.ts`; add the `.diff`/`.patch` condition; `tests/review-noise.test.ts`; synchronize the two strings in `review.ts` that enumerate the noise list; one bullet in the package `CLAUDE.md`; L-004 in `lessons.md`.

**Out of scope:** the review prompt and rubric; the model choice; a `fixtures.ts` row; vitest inside the package; `MAX_DIFF_LINES`; re-reviewing PR #24.

## Architecture / Approach

```
stdin diff ──▶ parseDiff ──▶ isNoise filter ──▶ model
                             (noise.ts)
                             lockfiles · context/** · binary public/** · *.diff *.patch ← new
```

The extraction exists only so the filter becomes importable — `review.ts` cannot be imported without running the CLI. Everything downstream (line budget, prompt, exit codes) is untouched.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Extract | `noise.ts` with the predicate exported; behavior provably identical | Root `tsconfig` excludes `packages` and ESLint ignores it, so a test importing across that boundary may upset `check`/`lint` — fallback recorded in the plan |
| 2. Strip + prove | `.diff`/`.patch` stripped, offline test, prose strings synced | A test that cannot fail; countered by an explicit deliberate-break step |
| 3. Lesson | L-004 in `lessons.md` | Numbering collision with the autonomous-run skill's `lessons-addendum.md` (L-004…L-007) |

**Prerequisites:** none — no migration, no Supabase, no running app. Node ≥22 and the repo checked out.
**Estimated effort:** one session; the code delta is roughly one predicate, one moved block, and one test file.

## Open Risks & Assumptions

- The cross-boundary import (`tests/` → `packages/`) is deliberately walled off by three tools. Phase 1 exists to hit that wall before any logic changes; the package-local fallback is specified.
- Extension-based stripping is broader than the evidence. A `.diff` file that was genuinely deployment-relevant would now skip review silently — judged acceptable, and named here so it can be revisited.
- L-004's number may collide with the autonomous-run skill's addendum; every agent reads both files, so the fix is to take the next free number, not to renumber.

## Success Criteria (Summary)

- A PR committing fixture diffs passes the gate on its own merits, with no admin bypass.
- Replaying `5dee0cb` prints `12 file(s), 11 stripped as noise, 106 changed line(s)`.
- Reverting the new condition turns `npm test` red.
