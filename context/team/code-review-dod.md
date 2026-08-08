# Code Review Definition of Done — scoring rubric

Six criteria. Each is scored 1–10; the anchors below describe what "1" and "10" look like so scoring is not discretionary. The overall verdict is **fail** when any criterion scores below its threshold (default: 5), or when a `blocker`-severity finding exists regardless of scores.

This file is the single source of truth for review criteria. The review agent loads it as its rubric; humans can read it as a checklist. Mechanics (how the diff is obtained, where the verdict is posted) live elsewhere.

## 1. Implementation correctness

Does the change do what it claims, on the main path, edge cases, and error handling?

- **1**: logic is wrong or silently breaks existing behavior; error paths swallow failures; the described intent and the code disagree.
- **10**: correct on the main path and edge cases; failures are handled or explicitly surfaced; no unrelated behavior changes hidden in the diff.

## 2. Type safety & project idiom

TypeScript strictness and the conventions of this codebase: Astro 6 (islands, minimal client JS), React 19 components only where interactivity is needed, shadcn/radix + Tailwind for UI, zod for runtime validation at boundaries.

- **1**: `any`/casts to silence the compiler; React used for static content; ad-hoc CSS beside Tailwind; external input consumed without zod parsing; patterns contradict the surrounding code.
- **10**: types flow without assertions; Astro/React split follows the islands convention; UI built from existing components; all external input (API routes, forms, Supabase rows) validated with zod; reads like the surrounding code.

## 3. Complexity & size

Simplicity of the solution relative to the problem; reviewability of the change.

- **1**: new abstractions or dependencies for a problem the existing code already solves; a single PR mixes refactor + feature + config; dead code or speculative generality.
- **10**: smallest reasonable diff; reuses existing helpers/components; one concern per change; a reviewer can hold the whole diff in their head.

## 4. Test coverage proportional to risk

Not "are there tests" but "are the risky paths tested". Unit tests (vitest) for logic, e2e (Playwright) for user journeys, and the per-account isolation gate for anything touching data access.

- **1**: risky logic (auth, data access, billing-like flows, migrations) changed with no test delta; existing tests weakened or deleted to go green; tests assert implementation details instead of behavior.
- **10**: new risky paths have failing-first tests at the right level (unit vs e2e); anything touching RLS/data isolation extends the isolation test; low-risk changes are not over-tested for ceremony.

## 5. Security & data safety

Supabase/RLS discipline, secrets hygiene, and input trust boundaries.

- **1**: `SERVICE_ROLE_KEY` used in request-path code; RLS bypassed or new tables without policies; secrets or URLs hardcoded in the diff; user input concatenated into queries; auth checks in UI only, not in middleware/API; an auth/signing secret (e.g. an HMAC key) that falls back to an empty or constant default instead of failing closed — every signature becomes forgeable.
- **10**: anon key + RLS on the request path; new tables/columns ship with policies and an isolation-test extension; secrets only via env (`.env` locally, GitHub/Vercel secrets in CI); every trust boundary validates input server-side.

## 6. Config & deployment safety

The class of change that caused the 2h-downtime incident: astro.config, vercel.json, middleware, env variables, Supabase migrations, CI workflow edits.

- **1**: config change with no explanation of blast radius; renamed/removed env var without updating `.env.example`, CI, and Vercel; migration without rollback thought; middleware change untested against protected routes; build-affecting change merged without a successful `npm run build` in CI.
- **10**: config diffs state intent and blast radius in the PR description; env var changes are synchronized across `.env.example`, CI secrets, and deployment; migrations are additive or have an explicit down-path; middleware/routing changes covered by an e2e check; CI proves the build.

## Verdict rules

- **pass**: all criteria ≥ 5 and no blocker findings.
- **fail**: any criterion < 5, or any blocker finding (secret in diff, RLS bypass, broken build, an auth/signing secret that fails open instead of failing closed).
- Every finding names the file/line, the criterion it falls under, severity (`blocker` / `major` / `minor`), and a concrete suggested fix.
- The summary is 2–3 sentences of Markdown a human can act on — no restating the diff.
