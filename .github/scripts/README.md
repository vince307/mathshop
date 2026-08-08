# .github/scripts

Dependency-free Node helpers used by workflow steps. They are deliberately
outside the root ESLint project service (`eslint.config.js` ignores
`.github/scripts/**` — same fencing as `packages/**`): the root config runs
type-checked rules against `tsconfig.json`, which does not cover this
directory, and adding a per-directory toolchain for two small scripts is not
worth the moving parts.

Quality bar in lieu of lint: scripts here must be plain Node >=22 with no
dependencies, pass `node --check`, and carry a usage comment at the top.
They are exercised by the `review` job on every PR
(`.github/workflows/review.yml`), which consumes `render-review-comment.mjs`
with the `ANTHROPIC_API_KEY` Actions secret via the `ai-reviewer` composite
action.

- `render-review-comment.mjs` — renders the AI review PR comment from the
  `ai-reviewer` action's outputs (three shapes: full review / noise-only pass
  / setup-error). Test locally against `render-review-comment.fixture.json`.
- `render-review-comment.fixture.json` — sample CLI output for exercising the
  renderer; not consumed at runtime.
