# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**MathShop** — a Polish-language web app that teaches math to children (ages 6–9 in v1) by framing every operation as running a small shop. The canonical product spec is `@context/foundation/prd-v2.md` (the post-pivot PRD); shaping notes in `@context/foundation/shape-notes.md`; the stack decision in `@context/foundation/tech-stack.md`. Read the PRD before building features — the entrepreneurship framing and the "math is never shown as a bare equation" rule are binding product constraints, not flavor.

## Design source of truth

The mockup sets directly under `assets/` are the **canonical UI/UX designs** — the binding source of truth for visual and layout decisions (screen structure, component placement, flow). When a feature has a matching mockup, build to the mockup, not to an improvised layout; the PRD governs behavior/copy, the mockups govern look-and-feel. Sets: `assets/matmaverse-auth-v2-{web,mobile}/` (login, register, **email-verification**, password-reset, **child-profile/avatar picker**, parent-PIN), `assets/matmaverse-ui-v2-{web,mobile}/` (world-selection, child-dashboard, change-mission, pricing-inventory, skill-path, parent-goals), and `assets/matmaverse-missing-screens-v3-{web,mobile}/` (world-progression, upgrades, mission-result, product-unlocked). Production-candidate art lives in `assets/atomic-assets-v2/` and `assets/atomic-assets-v3/` (manifests carry per-asset usage guidance); the screen↔function mapping is documented in `assets/app-docs-v2-llm-handoff/04_SCREENS_AND_DESIGN_MAPPING.md`.

**Standing permission — take what a feature needs from `assets/`.** You do not need to ask before reading `assets/`, or before copying/converting an asset out of it into the repo. When a feature needs art that exists there, pull it in rather than improvising a placeholder or stopping to ask. Three rules make that safe:

1. **Commit the asset, never the reference.** `assets/` is gitignored, so it is absent from a fresh clone, from CI, and from agent worktrees. **No code may resolve a path under `assets/`** — no import, `src=`, `fetch`, or filesystem read; it will resolve on the maintainer's machine and nowhere else. Copy or convert into committed `public/` and reference that. Naming an `assets/` path in a _comment_, to record where a committed file came from, is encouraged (see `src/data/stages.ts`).
2. **Record where it came from** in `public/illustrations/slice-map.md` — the register of every asset pulled out of `assets/`, with its source path and the crop box or resize used, so the step is reproducible. Match the existing batch's dimensions and encoding unless you say why you didn't.
3. **Pick from the manifests, don't guess.** `assets/atomic-assets-v{1,2,3}/manifest.json` carry `role` and `recommendedUse` per asset; `assets/app-docs-v2-llm-handoff/04_SCREENS_AND_DESIGN_MAPPING.md` maps screens to functions. Use them to choose the right asset instead of picking by filename.

Never `git add assets/` and never un-gitignore it — it also holds minified vendor JS that broke `eslint`.

**Caveat — local only.** These designs live only on the maintainer's machine. If `assets/` is absent (fresh clone, CI, cloud agent, worktree), the standing permission above cannot help: ask the maintainer to share the relevant mockup or to commit the asset, rather than guessing the layout or inventing a placeholder.

## Deployment

Production is **https://matmaverse.ariom.cloud**: a Docker container (`Dockerfile`, `@astrojs/node` standalone, `node dist/server/entry.mjs`, port 4401) on the owner's VPS behind Caddy; Supabase is self-hosted on the same VPS (stack `matmaverse-supabase`, configured in `ariom-infra` `server/supabase/matmaverse/compose.yml`). Operational details (secrets in the server's env file, logs, the `ariom-infra` server side) live in `@context/foundation/infrastructure.md` → "Current production: VPS"; the rest of that file is the original Vercel research, kept as history. Non-obvious rules:

- **`security.allowedDomains` in `astro.config.mjs` is load-bearing.** Caddy talks plain HTTP to the container; without it Astro sees `http://localhost:4401`, every form POST gets 403 from the origin check and signup e-mails redirect to localhost. `scripts/check-proxy-origin.mjs` (CI) guards it.
- **`@astrojs/node` is pinned to `10.1.1`**: 10.1.2+ need Astro 6.4. Bump both together.
- **Deploys only through CI**: `.github/workflows/deploy.yml` (after CI is green on `main`, or by hand with a full sha) builds `ghcr.io/vince307/matmaverse:<sha>`, pushes `supabase/migrations` (`migrate matmaverse`, after a `--dry-run`) and runs `apps-deploy` on the VPS. Migrations must stay backward-compatible with the deploy already in production; `tests/migrations-no-backslash.test.ts` guards the file contract. Rollback: `ssh apps-deploy@<host> rollback matmaverse`, owner or CI only; agents never deploy or roll back by hand. There are no preview deploys.
- `GET /api/health` is the container healthcheck: no Supabase, skipped by the middleware. Keep it that way.
- **Auth e-mail templates are served by the app**: the `Dockerfile` copies `supabase/templates` to `/email-templates/`, where GoTrue fetches them. Don't rename them or drop that line (`tests/email-templates-served.test.ts`).

## Commands

- `npm run dev` — dev server (Astro/Node)
- `npm run build` — production build (SSR)
- `npm run preview` — preview the production build
- `npm run start` — run the production build (`node dist/server/entry.mjs`; set `HOST`/`PORT`, e.g. `PORT=4401`)
- `docker build -t matmaverse:local .` — the production image
- `npm run lint` / `npm run lint:fix` — ESLint, type-checked rules
- `npm run format` — Prettier (astro + tailwind plugins)

Pre-commit (husky + lint-staged): `eslint --fix` on `*.{ts,tsx,astro}`, `prettier --write` on `*.{json,css,md}`.

## Architecture

**Every route under `src/pages/api/` must `export const prerender = false`** — otherwise it is statically built and breaks at runtime.

Auth is the spine of the app:

- `src/lib/supabase.ts` — SSR Supabase client (`@supabase/ssr`, cookie sessions). Secrets resolve through `astro:env/server` (`SUPABASE_URL`, `SUPABASE_KEY`), declared in `astro.config.mjs`'s `env.schema` — never read these via `import.meta.env`.
- `src/middleware.ts` — runs on every request, resolves the user into `context.locals.user`, and redirects unauthenticated hits to routes in `PROTECTED_ROUTES`. Gate a new route by adding it to that array.

MathShop requires **per-account data isolation** — one parent's child profiles must never be visible to another (PRD FR-012 / FR-015). When you add Supabase tables, enable row-level security with granular per-operation, per-role policies _in the same migration_. This is the highest-risk correctness requirement in the project; getting it wrong is a silent data leak, not a crash.

## Conventions

- Astro components for static/layout; React only where interactivity is needed. No Next.js directives (`"use client"` etc.).
- Merge Tailwind classes with `cn()` from `@/lib/utils` — never hand-concatenate class strings.
- Add shadcn components via `npx shadcn@latest add <name>` (they land in `src/components/ui/`).
- API routes: uppercase `GET` / `POST` exports; validate input with zod.
- Shared types in `src/types.ts`; extracted React hooks in `src/components/hooks/`; business logic in `src/lib/services/`.
- Supabase migrations live in `supabase/migrations/`, named `YYYYMMDDHHmmss_description.sql`.
- All user-visible strings are Polish, authored so a future locale can be added by swapping content, not editing code (PRD FR-013).
- **E2E tests:** the binding rules live in `@e2e/CLAUDE.md`.
- **Skill and agent working files stay local.** Plans, research, reviews, run logs and archives under `context/` (everything except `context/foundation/` and the review rubric `context/team/code-review-dod.md`) and `docs/superpowers/` are gitignored: write them, never commit them. A decision that must outlive the change goes into `context/foundation/` or `docs/reference/`.

## Local environment

- Local Supabase stack: `npx supabase start` (needs Docker; Studio at `http://localhost:54323`). Full setup steps in `@README.md`.
