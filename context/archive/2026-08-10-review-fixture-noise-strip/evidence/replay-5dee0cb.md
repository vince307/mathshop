# Replay of `5dee0cb` — before and after the strip

`5dee0cb` ("feat(code-review-evals): fixture materialization (p1)") is the commit that
introduced the six eval fixtures and, with them, the fixtures-as-code false positive that
blocked PR #24 twice. It is the natural subject for an end-to-end check.

The replay costs **nothing**: `review.ts` writes the `Diff:` line before it checks for an
API key, and `process.loadEnvFile` never overrides a variable already set in the shell.
Blanking the key therefore prints the strip arithmetic and exits 2 on the setup guard,
without a single model call.

```bash
git show --no-color --format= 5dee0cb > /tmp/5dee0cb.diff
ANTHROPIC_API_KEY= ./packages/code-reviewer/node_modules/.bin/tsx \
  packages/code-reviewer/review.ts < /tmp/5dee0cb.diff
```

| Stage | Output | Exit |
| --- | --- | ---: |
| Before this change (`main` behaviour) | `Diff: 12 file(s), 5 stripped as noise, 1762 changed line(s) to review.` | 2 |
| After Phase 1 (pure extraction) | `Diff: 12 file(s), 5 stripped as noise, 1762 changed line(s) to review.` | 2 |
| After Phase 2 (`.diff`/`.patch` stripped) | `Diff: 12 file(s), 11 stripped as noise, 106 changed line(s) to review.` | 2 |

The Phase 1 row is the proof that the extraction was a no-op — the numbers had to be
identical, and they were.

After Phase 2 exactly one file survives: `packages/code-reviewer/evals/generate-fixtures.mjs`,
the only real code in that commit. Input to the model drops by 94%, and a fixture-heavy PR
no longer risks crossing `MAX_DIFF_LINES = 4000`, which would exit 2 — a setup error rather
than a verdict.

## Deliberate-break check (L-002)

With the `.diff`/`.patch` condition removed from `isNoise`, `tests/review-noise.test.ts`
fails **4 of 10** — precisely the four asserting the new behaviour:

- strips an eval fixture, the case that forced the admin bypass
- strips a committed diff anywhere in the tree, not just under `evals/fixtures/`
- strips regardless of extension case
- keeps only the code when fixtures and docs travel with it

The other six — the pre-existing classes and the must-be-kept cases — stay green, so the
break is localized to what the change actually added. Condition restored; 10/10 green.

## Test location

Shipped in `tests/` (root vitest), as planned. The plan carried a fallback — move the test
into the package and extend vitest's `include` — in case root `astro check` or ESLint
rejected the cross-boundary import, since root `tsconfig.json` excludes `packages` and
ESLint ignores `packages/**`. **The fallback was not needed:** `npm run check` reports
0 errors / 0 warnings (188 files, up from 187 — the test file joins the root program) and
`npm run lint` is clean.
