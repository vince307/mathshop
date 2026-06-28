---
date: 2026-06-28T10:30:00Z
researcher: Claude (vince307)
git_commit: f1bdabe8b3da0e26d5b2885334a1aaeb4dce5984
branch: main
repository: 10xDevs
topic: "S-01b — first child profile (avatar-picker wizard) + child start screen + /app profile-count router"
tags: [research, codebase, child-profiles, rls, profile-wizard, start-screen, s-01b]
status: complete
last_updated: 2026-06-28
last_updated_by: Claude (vince307)
---

# Research: S-01b — first child profile wizard + child start screen + `/app` profile-count router

**Date**: 2026-06-28T10:30:00Z
**Researcher**: Claude (vince307)
**Git Commit**: f1bdabe8b3da0e26d5b2885334a1aaeb4dce5984
**Branch**: main
**Repository**: 10xDevs

## Research Question

What exists and what must be built for roadmap slice **S-01b**: a parent creates their first child profile (avatar-picker wizard), the child reaches a start screen (single business + in-world tap-to-start), and `/app` becomes the profile-count router (0 → wizard, 1 → start screen, 2+ → picker). Ground the plan in the live data layer, auth/gating, design system, and PRD constraints.

## Summary

S-01b is mostly **net-new frontend + one API write**, built on infrastructure that already exists:

- **Data layer is largely in place.** `public.child_profiles` already exists (Foundation F-01) with full per-account RLS (`id, account_id, avatar text, theme text, created_at, updated_at`) and an isolation test. The write path is a new `POST /api/profiles/create` route mirroring `src/pages/api/auth/signin.ts`; the count read is a request-scoped query in `app.astro`. **RLS scopes everything automatically** — no manual `account_id` filtering.
- **Design system is ready to consume.** Light MatmaVerse tokens, themed shadcn primitives, and committed `public/illustrations/` art are live. But `AuthShell` is **not** reusable here (it's a hardwired two-column auth layout); the reusable idiom is the signin **form-card** (`bg-card … rounded-2xl border p-8 shadow-sm`). Child-facing surfaces need an **oversized tap-target primitive** (shadcn's `lg` button tops out ~44px — too small per `prd-v2.md:146`).
- **Routing hook exists.** `src/pages/app.astro:11-16` is a documented "Part B extension point"; `src/middleware.ts:5` gates `/app`. New routes must be added to `PROTECTED_ROUTES`.

**⚠ One load-bearing conflict blocks planning** (see [Open Questions](#open-questions) Q1): the **PRD forbids child PII / names**, but the **archived S-01a plan records a product-owner override to collect the child's first name + age**, and the **`05-child-profile` mockup shows `Imię dziecka` (name) + `Wiek` (age) inputs**. This decides whether S-01b ships a **schema migration (name/age columns + PII handling)** or **no migration at all (avatar-only)**. It must be resolved before `/10x-plan`.

## Detailed Findings

### Data layer — `child_profiles` already exists (F-01)

- Table + RLS: `supabase/migrations/20260609120000_child_profiles_isolation.sql`. Columns: `id, account_id, avatar text not null, theme text not null default 'default', created_at, updated_at` (`:51-58`). Four per-operation policies, all `to authenticated`, predicate `auth.uid() = account_id`; INSERT uses `with check`, UPDATE uses both (`:78-101`). Shared `set_updated_at()` trigger created here, **reused** by later migrations (`:35-44`).
- The migration header is explicit (`:48-49, :60-61`): **minimal identity only, no child PII** ("avatar is a pre-set identifier, not a real name"); **gameplay state (coins/level/shift/shop) is deferred to S-04** under the same contract.
- Registered in `docs/reference/contract-surfaces.md:9-22`. RLS rules in `docs/reference/rls-isolation.md`; copy-skeleton in `docs/reference/rls-template.sql`.
- **No `src/lib/services/` exists yet** — S-01b would establish it. **zod is NOT installed** (`package.json` clean); existing auth routes hand-validate. CLAUDE.md mandates zod for API input → S-01b's create route is the first place to add it (install required).

### Write path — new `POST /api/profiles/create` (mirror signin.ts)

- Canonical shape from `src/pages/api/auth/signin.ts`: `export const prerender = false` (`:7`); `export const POST` (`:9`); read `context.request.formData()`; build client `createClient(context.request.headers, context.cookies)` (`:14`) with null-guard → redirect (`:15-17`); **redirect, never JSON**, wrapped in `applyNoStore(...)` (`:21,:24`); errors via `mapAuthError` + `@/i18n`. `signup.ts:22` derives `origin` from the request URL — pattern for redirect targets.
- Insert: `supabase.from("child_profiles").insert({ account_id: user.id, avatar, theme })`. **`account_id` derived server-side** from `context.locals.user.id` / `supabase.auth.getUser()`, **never client-supplied**; the `with check` policy enforces it regardless. Wrap success redirect in `applyNoStore(context.redirect("/app"))`.

### Read path — `/app` profile-count router

- `src/pages/app.astro:11-16` is the live extension point; current body is a placeholder signed-in card + signout.
- Count via the request-scoped client in frontmatter: `createClient(Astro.request.headers, Astro.cookies).from("child_profiles").select("*", { count: "exact", head: true })`. RLS scopes to the parent's rows; backed by `child_profiles_account_id_idx`. Branch **0 → wizard, 1 → start screen, 2+ → picker** (picker UI is S-07; S-01b only needs the branch to detect ≥2 and route somewhere sane).
- `src/middleware.ts`: `PROTECTED_ROUTES = ["/app"]` (`:5`); auth form pages redirect authed users to `/app` (`:38-40`); `startsWith` matching — keep new route prefixes non-overlapping. Both signin and confirm-email already funnel into `/app`.

### Auth-config note

- `supabase/config.toml`: `enable_signup = true`; **`[auth.email] enable_confirmations = false` locally** — signin works immediately after signup; `minimum_password_length = 6`. No child-profile seed data.

### Frontend surfaces & design-system reuse

- **AuthShell is NOT reusable** (`src/components/auth/AuthShell.astro:5-13`): hardwired two-column marketing+form auth layout (props `heading/accent/tagline`). The wizard (parent form) and start screen (child in-world) don't match it. Reuse the **form-card idiom** from `signin.astro:14` instead.
- **UI primitives** (`src/components/ui/`): `button, card, input, label, checkbox`. Button sizes top out at `lg h-11` (~44px) — the comment at `button.tsx:22` calls them "groundwork for the oversized-control rule," but a **new oversized `child`/`xl` size variant** (taller, larger text/padding, gold accent) is needed for 6–8yo tap targets. `input h-9` / `checkbox size-4` are likewise too small for child surfaces.
- **Tokens** (`src/styles/global.css`): `--radius 0.875rem`; primary `#2473F3`, bg `#F3F8FE`, ink `#2D374C`, gold `--accent` (coins); `Nunito Variable`.
- **i18n** (`src/i18n/pl.ts`): typed `as const` dict exported as `t`; namespaces `brand, auth, marketing, nav, welcome, confirmEmail, landing`. S-01b adds **`profileWizard`** and **`start`** namespaces. Avatar Polish `name`/`alt` belong in `src/data/avatars.ts` as content (not the dict). Import `t` directly in islands — don't thread strings through props.
- **Art** (`public/illustrations/`): `world-{piekarnia,kawiarnia,galaktyczna-baza,sklep-ksiegarnia}.png`, `coin.png`, `coin-stack.png` + `slice-map.md`. **Start screen can reuse `world-kawiarnia.png`** as the business + `coin.png` for a coin badge. **No avatar art exists** — `public/avatars/` must be created (slice ~6 child faces from `05-child-profile-web.png` per the slice-map convention).

### Mockups

- **Avatar/create-profile wizard — `05-child-profile-{web,mobile}.png`**: a **"Krok 2 z 3"** parent-facing form: heading "Dodaj profil dziecka", fields **Imię dziecka** (text input), **Wiek** (select), **Wybierz avatar** (row of ~6 circular faces, tap-select, check badge), **Zainteresowania** (2×2 world-card grid: Kawiarnia/Piekarnia/Galaktyczna baza/Sklep kolekcjonera), an auto-derived **"Poziom startowy" 6–9 lat** chip, primary CTA **"Dalej"**. Web wraps it in full parent app chrome (left nav, coin bar); mobile is a plain centered column. (Mockup brand reads "MathMarket" → now MatmaVerse.)
- **Start screen — closest is the hero region of `02-child-dashboard-web.png`**: a single business hero card ("Kawiarnia Ani") + child greeting ("Cześć, Aniu!") + coin badge + CTA **"Zacznij teraz →"**. The surrounding dashboard panels (skills, results, activity) are **later slices** — ignore them. `01-world-selection-web.png` is the **S-07** multi-world picker, NOT the S-01b start screen.

## Code References

- `supabase/migrations/20260609120000_child_profiles_isolation.sql:51-101` — table + 4 RLS policies + trigger.
- `docs/reference/contract-surfaces.md:9-22` — child_profiles surface registry.
- `docs/reference/rls-isolation.md`, `docs/reference/rls-template.sql` — the contract + copy-skeleton.
- `src/lib/supabase.ts:21` — `createClient(headers, cookies)` request-scoped SSR client.
- `src/lib/http.ts:19` — `applyNoStore(response)`.
- `src/pages/api/auth/signin.ts:7-24` — canonical form-POST → redirect route shape.
- `src/pages/app.astro:11-16` — Part B extension point (router goes here).
- `src/middleware.ts:5,38-46` — `PROTECTED_ROUTES`, auth-form redirect, gating.
- `src/components/auth/AuthShell.astro:5-13` — not-reusable two-column auth shell.
- `src/components/ui/button.tsx:21-27` — size variants (need an oversized child variant).
- `src/styles/global.css:9,78` — radius + Nunito; tokens.
- `src/i18n/pl.ts` — dictionary namespaces.
- `tests/child-profiles-isolation.test.ts:122-140` — INSERT-isolation (L-002) pattern.
- `tests/helpers/supabase.ts:33,44,63,74` — `admin`, `createSignedInUser`, `deleteUser`, `findUserIdByEmail`.
- `tests/helpers/astro.ts:31,78,119` — `createCookieJar`, `buildContext`, `runMiddleware` (route-level harness).

## Architecture Insights

- **RLS does the scoping** — reads/writes through the request-scoped client need no `account_id` filter; the policies + index handle isolation and lookup. The one rule that matters: **never trust a client-supplied `account_id`** — derive it from the session (L-001/L-002).
- **Repo mutation pattern is form-POST → API route → redirect**, wrapped in `applyNoStore`. An inline `.astro` server action would diverge from every existing mutation — use a route.
- **Test the route, not just the policy.** The RLS policy already has an isolation test; S-01b's value-add is a **route-level** test proving the create route writes only `auth.uid()`-owned rows and rejects a spoofed `account_id` (L-002 discipline: insert without chained `.select()`, verify durable state via the service-role `admin` client).
- **Child surfaces are a new design tier.** The auth/marketing primitives are sized for adults; S-01b introduces the first oversized child-primitive (per `prd-v2.md:146`), which Part B child slices (S-02+) will reuse.

## Historical Context (from prior changes)

- `context/archive/2026-06-26-parent-signup-first-profile-and-start-screen/plan.md:35` — S-01a "What We're NOT Doing" scopes to S-01b: "`child_profiles` schema migration (**child name / age / starting-level columns**), avatar registry + art, the profile-creation wizard, the create-profile API, the start screen, and the 0/1/2+ profile-count routing branch. Part A ships a placeholder `/app` that Part B turns into the count router."
- `…/plan.md:369-370` — **Decision of record (PRD override):** "the product owner chose to collect the child's first name, overriding the PRD privacy guardrail 'No PII tied to children / no real names.'" To be handled as "RLS-isolated, zod-validated, HTML-escaped PII."
- `…/plan.md:368` — child-primitive oversized controls (buttons/cards per `prd-v2.md:146`) deferred to S-01b.
- `…/research.md:107-112` — avatar registry shape `{id,name,image,alt}`; `id` is the DB contract (e.g. `"lis"`), already baked into the isolation test; app-layer (zod) enforces the closed set, not a DB enum.
- `context/archive/2026-06-27-matmaverse-design-system/` — the design system this slice builds on; child-primitive library explicitly deferred to here.
- Lessons: **L-001** (RLS in the same migration — applies *if* S-01b adds columns), **L-002** (assert durable state via service-role re-read), **L-003** (all user-visible strings from i18n).

## Related Research

- `context/archive/2026-06-26-parent-signup-first-profile-and-start-screen/research.md` — S-01a exploration (auth spine, avatar-registry sketch).
- `context/archive/2026-06-27-matmaverse-design-system/` — design-system change (tokens, primitives, AuthShell).

## Decisions (locked 2026-06-28, product owner)

These resolve the open questions below and bind `/10x-plan`:

- **D1 (resolves Q1) — Collect child name + age.** The wizard collects the child's first **name** + **age** + avatar, per the canonical `05-child-profile` mockup and the recorded S-01a product-owner override. This **consciously breaks** the PRD "no child PII" guardrail (`prd-v2.md:51,168`). Consequence: a `child_profiles` **schema migration** (add `name`, `age`, derived `starting_level` columns) under the **L-001** contract (RLS in the same migration, isolation test), with **zod validation + HTML-escaping** for the name (treat as RLS-isolated PII). Age → starting-level derivation per the mockup's "Poziom startowy 6–9 lat" chip.
- **D2 (resolves Q2) — Interests: show + persist into `theme`.** Render the "Zainteresowania" world grid (per mockup) and store the pick in the **existing `theme` column** — no new column. Full world-selection remains S-07; the start screen themes its business from `theme` (default → Kawiarnia).
- **D3 (resolves Q3) — Tap = in-world "coming soon" no-op.** Start screen renders the oversized "Czas otworzyć sklep!" prompt + tappable business; the tap shows a friendly **in-world placeholder** (no bare-math framing, `prd-v2.md:158`) until S-02 lands. The affordance + copy are real.
- **D4 (resolves Q4) — New `src/components/child/` primitive tier.** Build a dedicated child-primitive module (oversized button/card/tile per `prd-v2.md:146`) rather than only extending `button.tsx` — S-02+ child surfaces reuse it.

## Open Questions

> All four resolved above (D1–D4). Retained for the planner's context.

### Q1 (RESOLVED → D1: name + age) — Does S-01b collect the child's name + age (PII), or avatar-only?

Three sources disagree:

| Source | Says |
|---|---|
| **PRD v2** (`prd-v2.md` FR-001 `:88-89`, guardrail `:51,:168`) | **No child PII, no names, no text input.** Avatar's built-in Polish name IS the profile name. Rationale: text input is "too high a bar for pre-readers." |
| **Archived S-01a plan** (`plan.md:35,369-370`) | **Product-owner override** — collect child **first name + age + starting-level**; schema migration adds those columns; handle name as "RLS-isolated, zod-validated, HTML-escaped PII." |
| **`05-child-profile` mockup** (canonical UI per CLAUDE.md) | Shows **Imię dziecka** (name input) + **Wiek** (age select) + avatar + interests. |
| **Live F-01 schema** (`…isolation.sql:48-61`) | **Minimal identity, no PII**; avatar+theme only; state deferred to S-04. |

This swings the entire plan: **avatar-only** = no migration, no PII, faithful to the PRD's pre-reader rationale, but contradicts the mockup; **name+age** = a schema migration (under L-001), PII handling (escaping, the privacy guardrail consciously broken), age→starting-level derivation, but matches the mockup + the recorded override. **Must be decided before planning.**

### Q2 — Are "Zainteresowania" (world/interest selection) persisted in S-01b, or stubbed?

The `05` mockup collects an interest (world). The live schema has only `theme` (default `'default'`). World/interest selection overlaps **S-07 (world-selection)**. Decide: map the picked interest into `theme` now, persist a new column, or stub the field visually and defer persistence.

### Q3 — What does the start-screen tap do in S-01b?

FR-004 says the tap "starts a shift," but no shift loop exists until S-04. Confirm the v1 behavior: render the oversized "Czas otworzyć sklep!" affordance + in-world prompt, and have the tap **no-op / show a friendly "coming soon" in-world** until S-02+. (No bare-math framing anywhere — `prd-v2.md:158`.)

### Q4 — Oversized child primitive: extend `button.tsx` cva, or a new `src/components/child/` tier?

Add an `xl`/`child` size to the existing `buttonVariants` cva (cheap, reuses the variant API) vs. a dedicated child-primitive module (cleaner separation for the S-02+ child surfaces that will reuse it). A `/10x-plan` call, informed by how much child UI S-02+ will need.
