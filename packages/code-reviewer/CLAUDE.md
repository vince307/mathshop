# packages/code-reviewer — agent rules

Directory-scoped rules for this package (precedent: `e2e/CLAUDE.md`). This is a **standalone Node CLI dev tool**, not part of the Astro app — most app conventions from the root `CLAUDE.md` deliberately do not apply here.

- **This is dev-tooling, not product AI.** `context/foundation/tech-stack.md`'s `has_ai: false` refers to the product; this package doesn't change that.
- **`process.env` / `process.loadEnvFile()` is correct here.** The app-side rule "secrets via `astro:env/server`" cannot apply — `astro:env` does not exist outside the Astro build. `ANTHROPIC_API_KEY` stays out of `astro.config.mjs`'s `env.schema`; the app must never depend on it.
- **Output is developer-facing English.** L-003 (all user-visible strings Polish via the i18n dictionary) is scoped to product UI; verdict JSON, findings, and stderr progress are not product UI.
- **`console`/stderr output is the point**, not a lint violation. The package is excluded from root ESLint (`eslint.config.js` ignores `packages/**`) and root tsconfig, and self-governs via its own `tsconfig.json`; type-check with `npx tsc --noEmit -p packages/code-reviewer`.
- **Dependencies stay in this package** — own `package.json` + committed nested `package-lock.json`, no npm workspaces. Never add `ai` / `@ai-sdk/*` / this package's deps to the root `package.json`; install with `npm --prefix packages/code-reviewer ci`.
- **Stay on the AI SDK v6 line** (`ai@^6.0.246`, `@ai-sdk/anthropic@^3.0.107`, dist-tag `ai-v6`) until the parked v7 migration happens. In v6: `generateText` + `output: Output.object({ schema })` (not the deprecated `generateObject`), result on `result.output`, tokens on `result.totalUsage`.
- **The rubric is loaded, never inlined.** Review criteria live in `context/team/code-review-dod.md`; changing review standards means editing that file, not this package. The verdict is recomputed mechanically in `schema.ts`'s `deriveVerdict` — the model's own `verdict` field never decides the exit code.
- **Exit-code contract:** `0` pass, `1` fail (the code failed review — nothing else), `2` setup/budget/API error. A missing env var must fail loudly as a setup error, never masquerade as a review failure.
