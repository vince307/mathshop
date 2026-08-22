# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**MathShop** — a Polish-language web app that teaches math to children (ages 6–9 in v1) by framing every operation as running a small shop. The canonical product spec is `@context/foundation/prd-v2.md` (the post-pivot PRD); shaping notes in `@context/foundation/shape-notes.md`; the stack decision in `@context/foundation/tech-stack.md`. Read the PRD before building features — the entrepreneurship framing and the "math is never shown as a bare equation" rule are binding product constraints, not flavor.

The codebase is the [10x-astro-starter](https://github.com/przeprogramowani/10x-astro-starter) scaffold. `CLAUDE.md.scaffold` is the starter's original AI-guidance file, kept as a sibling after bootstrap; delete it once you've confirmed everything useful is folded in here.

## Design source of truth

The mockup sets directly under `assets/` are the **canonical UI/UX designs** — the binding source of truth for visual and layout decisions (screen structure, component placement, flow). When a feature has a matching mockup, build to the mockup, not to an improvised layout; the PRD governs behavior/copy, the mockups govern look-and-feel. Sets: `assets/math-economy-auth-v2-{web,mobile}/` (login, register, **email-verification**, password-reset, **child-profile/avatar picker**, parent-PIN), `assets/math-economy-ui-v2-{web,mobile}/` (world-selection, child-dashboard, change-mission, pricing-inventory, skill-path, parent-goals), and `assets/math-economy-missing-screens-v3-{web,mobile}/` (world-progression, upgrades, mission-result, product-unlocked). Production-candidate art lives in `assets/atomic-assets-v2/` and `assets/atomic-assets-v3-progression/` (manifests carry per-asset usage guidance); the screen↔function mapping is documented in `assets/app-docs-v2-llm-handoff/04_SCREENS_AND_DESIGN_MAPPING.md`.

**Caveat — local only.** `assets/` is gitignored (it also holds minified vendor JS that broke `eslint`), so these designs are **not in the repo**: they live only on the maintainer's machine. A fresh clone, CI, or a cloud agent session will not have them. If the `assets/math-economy-*` sets are absent, ask the maintainer to share the relevant mockup rather than guessing the layout.

## Deployment

Target is **Vercel** — `astro.config.mjs` uses the `@astrojs/vercel` adapter (v10; SSR routes compile to Vercel Functions). The full decision, operational story, and risk register live in `@context/foundation/infrastructure.md`. Two non-obvious deploy gotchas captured there: pin the function region to the EU (`fra1`/`arn1`) — Vercel defaults to US, taxing the Polish audience + EU Supabase on every SSR request — and budget **Pro ($20/mo)**, since the Hobby tier is non-commercial-use only.

## Architecture

**Every route under `src/pages/api/` must `export const prerender = false`** — otherwise it is statically built and breaks at runtime.

Auth is the spine of the app:

- `src/lib/supabase.ts` — SSR Supabase client (`@supabase/ssr`, cookie sessions). Secrets resolve through `astro:env/server` (`SUPABASE_URL`, `SUPABASE_KEY`), declared in `astro.config.mjs`'s `env.schema` — never read these via `import.meta.env`.
- `src/middleware.ts` — runs on every request, resolves the user into `context.locals.user`, and redirects unauthenticated hits to routes in `PROTECTED_ROUTES`. Gate a new route by adding it to that array.

MathShop requires **per-account data isolation** — one parent's child profiles must never be visible to another (PRD FR-012 / FR-015). When you add Supabase tables, enable row-level security with granular per-operation, per-role policies *in the same migration*. This is the highest-risk correctness requirement in the project; getting it wrong is a silent data leak, not a crash.

## Conventions

- Astro components for static/layout; React only where interactivity is needed. No Next.js directives (`"use client"` etc.).
- Merge Tailwind classes with `cn()` from `@/lib/utils` — never hand-concatenate class strings.
- Add shadcn components via `npx shadcn@latest add <name>` (they land in `src/components/ui/`).
- API routes: uppercase `GET` / `POST` exports; validate input with zod.
- Shared types in `src/types.ts`; extracted React hooks in `src/components/hooks/`; business logic in `src/lib/services/`.
- Supabase migrations live in `supabase/migrations/`, named `YYYYMMDDHHmmss_description.sql`.
- All user-visible strings are Polish, authored so a future locale can be added by swapping content, not editing code (PRD FR-013).
- **E2E tests:** use the `/10x-e2e` skill; the binding rules live in `@e2e/CLAUDE.md`.

## Local environment

- Local Supabase stack: `npx supabase start` (needs Docker; Studio at `http://localhost:54323`). Full setup steps in `@README.md`.
