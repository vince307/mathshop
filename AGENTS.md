# Repository Guidelines

MathShop is a Polish-language, server-rendered web app (Astro 6 + React 19 islands, Tailwind 4, Supabase auth) that teaches early-primary math by framing every operation as running a small shop. Product spec: `@context/foundation/prd-v2.md`. Full project guidance: `@CLAUDE.md`.

## Hard rules

- **Per-account data isolation is the top correctness requirement.** One parent's child profiles must never be visible to another (PRD FR-012 / FR-015). Enable Supabase row-level security with per-operation, per-role policies in the *same* migration that adds a table — a missed policy is a silent data leak, not a crash.
- **Every route under `src/pages/api/` must `export const prerender = false`**, or it is statically built and fails at runtime.
- **Deployment target is Vercel** via the `@astrojs/vercel` adapter (`astro.config.mjs`); SSR routes compile to Vercel Functions. Decision + risk register: `@context/foundation/infrastructure.md`. Pin the function region to the EU (`fra1`/`arn1`) and budget Pro ($20/mo) — the Hobby tier is non-commercial-use only.
- **All user-visible strings are Polish**, authored so a future locale swaps via content, not code (FR-013).
- Read secrets through `astro:env/server` (`SUPABASE_URL`, `SUPABASE_KEY`) — never `import.meta.env`.

## Project Structure

- `src/pages/` — routes; `src/pages/api/auth/` — auth endpoints; `src/pages/auth/` — auth pages.
- `src/components/` — `.astro` for static/layout, React `.tsx` only for interactivity; `ui/` holds shadcn ("new-york") components.
- `src/lib/` — `supabase.ts` (SSR client), `utils.ts` (`cn()`); put extracted business logic in `src/lib/services/`.
- `src/middleware.ts` — resolves the user into `context.locals.user`, gates `PROTECTED_ROUTES`.
- `context/foundation/` — product and stack docs; `supabase/migrations/` — schema.

## Build, Test, and Development Commands

- `npm run dev` — dev server (Astro/Node)
- `npm run build` / `npm run preview` — production build / preview
- `npm run lint` / `npm run lint:fix` — ESLint with type-checked rules
- `npm run format` — Prettier

No test runner is configured yet; wire one before relying on `npm test`. Pre-commit (husky + lint-staged) auto-fixes staged files — see `@package.json`.

## Coding Style & Conventions

- Node 22.14.0 (`.nvmrc`); `@/*` → `./src/*`.
- Merge Tailwind classes with `cn()` from `@/lib/utils`; never hand-concatenate. No `"use client"` directives.
- API routes export uppercase `GET` / `POST` and validate input with zod. Add shadcn components via `npx shadcn@latest add <name>`.
- Shared types in `src/types.ts`; React hooks in `src/components/hooks/`; migrations named `YYYYMMDDHHmmss_description.sql`.

## Commits & CI

No git history exists yet — establish a convention (e.g. Conventional Commits) before the first push. CI (`@.github/workflows/ci.yml`) runs lint + build on push and PR to `master`, and needs `SUPABASE_URL` / `SUPABASE_KEY` repository secrets.
