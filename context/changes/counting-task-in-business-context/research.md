---
date: 2026-06-29T18:12:13+0200
researcher: vince307
git_commit: f42d76026d33375dedba8efdb33a6aa0f93447de
branch: main
repository: mathshop
topic: "Design/plan counting tasks that drive child math + economics development (roadmap slice S-02)"
tags: [research, codebase, s-02, counting-task, gameplay, pedagogy, i18n, design-system]
status: complete
last_updated: 2026-06-29
last_updated_by: vince307
---

# Research: Counting task in business context (S-02)

**Date**: 2026-06-29T18:12:13+0200
**Researcher**: vince307
**Git Commit**: f42d760 (`f42d76026d33375dedba8efdb33a6aa0f93447de`)
**Branch**: main
**Repository**: mathshop

## Research Question

Design/plan **counting tasks** that drive a child's math *and* economics (entrepreneurship/financial-literacy) development, grounded in the article *"Czy dzieci mogą uczyć się przedsiębiorczości"* (zskrolowka.pl) and the MathShop PRD. Scope was clarified to the **S-02 task family** (the single counting task S-02 ships, designed so its task-spec → render → answer → feedback contract is reusable by S-03 change-making and S-04 the full shift), with **balanced** emphasis on codebase integration and pedagogy/economics design.

## Summary

**This change is roadmap slice S-02** (`context/foundation/roadmap.md:94-105`), the next must-have slice in the wedge path (`F-01 → S-01 → (S-02 ∥ S-03) → S-04`). Its predecessor S-01 is **done and archived**; S-02 is **unblocked**.

Three findings shape the plan:

1. **The gameplay loop is greenfield, but the seam is clean.** Everything below the start screen — any task model, tappable-coin widget, retry/hint logic, success acknowledgment — does not exist yet. The single, deliberate plug-in point is the no-op `onClick` in `src/components/child/StartShiftButton.tsx` (its docstring literally says "a no-op until the shift loop lands (S-02+)"). S-02 builds the first real gameplay surface, replacing or extending that island.

2. **The house style is established and binding.** The Astro-page-loads-data / React-island-does-interaction split, the `src/components/child/` primitive tier (`ChildButton`, `SelectTile`), the `src/i18n/pl.ts` nested-namespace dictionary, the gold `--accent` coin token, the `role="status"` feedback idiom, and the L-001/L-002/L-003 lessons all pre-date S-02 and constrain it. S-02 should add **no inline strings**, **no new middleware**, and **likely no migration** (coins/level/results persistence is explicitly S-04's territory).

3. **The central design decision is "tap-to-count vs multiple-choice."** The PRD's hardest counting-specific rule — *"Counting tasks use visible, tappable objects (coins in the till, items on a shelf), not numerical inputs"* (`prd-v2.md:78`) — collides with the canonical task-screen mockup (`assets/matma-verse/.../03-change-mission`), which uses 3-tile multiple-choice. For a **counting** task the central artifact area must become the *interactive counting surface* (tap each object, running tally), not a numeric answer picker. This is the one place the existing mockup cannot be copied wholesale, and it is the pedagogical heart of the slice.

The article adds no new mechanics but **confirms the existing pedagogy**: children 6–8 learn entrepreneurship through play-based mini-shops, role-play (seller/customer), "value of hard work," and mistakes-as-learning in a safe environment — exactly MathShop's framing. Its concrete contribution is the *business meaning of counting*: stock-taking, counting the till, verifying a delivery, fulfilling an order — the entrepreneurial reasons a child counts.

## Detailed Findings

### Area 1 — Where S-02 plugs in (live codebase, greenfield gameplay)

**The /app router & start screen exist; the shift loop is a stub.**
- `src/pages/app.astro:1-17` — profile-count router (gated by middleware): `0 profiles → /app/new-profile`, `≥1 → /app/start` via `resolveLandingPath` (`src/lib/services/child-profiles.ts:57-59`).
- `src/pages/app/start.astro` — owns the start screen. Frontmatter loads `getMostRecentProfile(supabase)` (line 19), resolves themed business art via `worldForTheme(profile.theme)` (line 21) and avatar via `getAvatar` (line 22). Renders the **single themed business card** as presentational (non-interactive) Astro markup at lines 60-63, and mounts the tap affordance island at line 67.
- **`src/components/child/StartShiftButton.tsx` — THE S-02 SEAM.** A `client:load` React island; docstring (lines 6-11): *"tapping shows a friendly in-world 'coming soon' message — a no-op until the shift loop lands (S-02+)."* Today its `onClick` (lines 20-22) just toggles a `role="status"` "coming soon" card (`t.start.comingSoonTitle` / `t.start.comingSoon`, lines 28-33). **This no-op is where S-02 launches the counting task** — either by routing to a new `src/pages/app/<task>.astro` or by swapping the island for a task-launcher.

**No gameplay state in the schema (and S-02 likely needs none).**
- `supabase/migrations/20260609120000_child_profiles_isolation.sql` — creates `public.child_profiles` (`id`, `account_id` FK→`auth.users` `on delete cascade`, `avatar`, `theme`, `created_at`, `updated_at`), RLS enabled with four per-op policies (lines 78-101), shared `set_updated_at()` trigger fn (lines 35-44). **Line 48-49 comment: "gameplay state (coins, level, shift count, shop state) is added later by S-04."**
- `supabase/migrations/20260628120000_child_profiles_add_identity.sql:22-29` — adds `name text not null`, `age smallint not null` (check 6–9), `starting_level smallint not null default 1`.
- **There is no `coins`, `level`, `shift_count`, or `shop_state` column.** If S-02 stays stateless (recommended — a single task that announces a result but persists nothing), it touches no migration.

**Data layer & types.**
- `src/lib/services/child-profiles.ts` — `ChildProfile` interface (lines 22-32), `createChildProfile`, `countChildProfiles`, `getMostRecentProfile`, `resolveLandingPath`. All take the request-scoped SSR client; **RLS scopes rows — no manual `account_id` filtering**.
- `src/data/leveling.ts` — `deriveStartingLevel(age)` (lines 7-9); docstring: *"real gameplay leveling is S-04."* Pure, client-safe.
- **No `src/types.ts` exists** despite the CLAUDE.md convention — domain types live inline in `src/lib/services/` and `src/data/*.ts` (`World`, `Avatar`). A new `CountingTask` type is a decision point: create `src/types.ts` (per convention) or follow the current `src/data/` pattern.

**Greenfield confirmation:** an exhaustive search for `shift|counting|coin|monet|kasie|task|exercise|gameplay|zmiana` across `src/` and `supabase/` returns only the stub button, the start-screen copy/comments, `leveling.ts`, and narrative strings. **No task model, coin-render component, tappable-coin widget, retry/hint logic, success component, task-result table, or task API route exists.**

### Area 2 — House style the counting island must conform to

**Astro/React split (binding).** Astro page = static chrome + SSR data loading in frontmatter; React island = the interactive task only. Import `t` and data **directly inside the island** — do not thread strings/data through props (the only prop ever passed in the codebase is `serverError` from a query param). Islands use `export default function`, mounted with `client:load`.

**Child-primitive tier — reuse, don't reinvent** (`src/components/child/`):
- `ChildButton.tsx` — canonical oversized tap target: `min-h-16` (64px), `rounded-2xl px-8 text-xl font-bold`, strong `focus-visible:ring-4`, variants `primary | gold | outline`. Reuse for the "Sprawdź" submit and any tap control. (shadcn `button` tops at 44px — **too small** per `prd-v2.md:146`; use it only for parent/chrome surfaces.)
- `SelectTile.tsx` — large selectable tile, `shape="circle"|"card"`, selection shown as **UI state only** (`ring-4` + check badge, `aria-pressed`), never baked into art, non-adjacently hittable. **This is the model for "tap the items to count" tiles.**

**Styling:** merge classes with `cn()` (`src/lib/utils.ts:4-6`) — never hand-concatenate. Tokens only, no raw hex (`src/styles/global.css :root`, oklch): coin/reward = **`--accent` gold `#F3BE5D`**, brand = `--primary` blue `#2473F3`, `--card` white, `--foreground` ink, `--radius 0.875rem`. Typography: Nunito Variable via `font-sans`. Card idiom: `bg-card text-card-foreground border-border rounded-2xl border p-6 shadow-sm`. Child page layout wrapper: `bg-background flex min-h-screen flex-col items-center px-4 py-10` with a `max-w-md` column. Committed assets `public/illustrations/coin.png` + `coin-stack.png` already exist.

**i18n (L-003 — zero inline literals, CI-enforced via lint rule + `astro check`):**
- All strings in `src/i18n/pl.ts` as one `export const pl = {...} as const`; `src/i18n/index.ts` re-exports `t: Dictionary`. Add a **new top-level namespace** for the task (e.g. `task:` / `counting:`) as a sibling of `start` (`pl.ts:162-169`).
- Interpolation by string `.replace()` with `{name}`-style tokens, at the call site.
- **Polish pluralization** helper `charsNeeded(n)` (`index.ts:25-27`, `Intl.PluralRules("pl")`, one/few/many) — reuse the pattern for "N monet / moneta / monety".
- **Content paired with an image asset goes in `src/data/`** (like `avatars.ts`/`worlds.ts`), not the dictionary; pure UI copy goes in `pl.ts`.

**Feedback/animation seeds (mostly greenfield):**
- Success/acknowledgment: the only existing pattern is the `role="status"` revealed card (`StartShiftButton.tsx:28-33`) — model the "correct!" acknowledgment on it.
- `tw-animate-css` is imported (`global.css:2`) — `animate-*` utilities are available, but nothing animates yet beyond hover/focus transitions. No success animation, confetti, or hint-pulse exists; S-02 introduces it. Keep it deterministic if it'll be E2E'd.
- Hint highlighting: no pattern yet; closest device is `SelectTile`'s `ring-4` — a ring is the established "draw attention here" idiom (FR-009 wants it to highlight "the coin pile to count").

**Routing/gating:** `/app/*` is already protected by `src/middleware.ts` `PROTECTED_ROUTES` via `startsWith("/app")` — a new `src/pages/app/<task>.astro` inherits gating with **no middleware change** (mind the `startsWith` no-boundary gotcha — don't create `/apple`). No-store headers auto-apply under `/app`.

**If S-02 ever persists (it likely should not):** L-001 four-policy RLS template ships in the *same* migration (`account_id uuid not null references auth.users(id) on delete cascade`; INSERT `with check`, UPDATE both; reuse `set_updated_at()`, don't redefine); L-002 isolation test inserts *without* a chained `.select()` and verifies durable state via a service-role client; register the surface in `docs/reference/contract-surfaces.md`. API routes follow `src/pages/api/profiles/create.ts` (`prerender = false`, zod closed-set `.refine`, `account_id` from session not client, form-POST → redirect).

### Area 3 — Pedagogy & economics design (article + PRD + mockups)

**The binding render contract (PRD §Business Logic, `prd-v2.md:150-158`; US-02 AC `:77-82`):**
- Inputs = **user-facing shop artifacts** (a pile of coins, items on a shelf), never a number on a blank screen.
- Output = an **in-world action** that completes a business moment ("the math is the means; the in-world resolution is the end").
- Correctness gates the *resolution*, never *play* — wrong answer → gentle retry + scaffolding hint after 1–2 misses (FR-009, `:116`), never a dead end.
- Counting-specific AC (the hard one): **"visible, tappable objects … not numerical inputs"** (`:78`). This decides tap-to-count over type-a-number.

**Difficulty & feedback rules:** grades 1–2 / ages 6–8 only, procedurally generated (FR-006/007); per-correct = *small* acknowledgment, big celebration only at shift end (FR-008); **coins paid once at shift end, not per task** (FR-010) — so a counting task **must not show a per-question coin payout**; mistakes never punishing — no red flash/buzzer/"game over" (Guardrails `:50`). Tap targets large + spaced so "adjacent tap targets cannot be hit by a single tap that lands between them" (NFR `:146`). In-shift interactions feel immediate — **no per-tap network round-trip**; submit once per task.

**What the article contributes** (`https://zskrolowka.pl/czy-dzieci-moga-uczyc-sie-przedsiebiorczosci`): a general-interest piece, no academic citations, but it *validates* MathShop's pedagogy — entrepreneurship is learnable from young ages through play-based mini-shops, role-play (seller / customer / investor), home "shop selling toys," "managing finances and recognizing the value of hard work," and **learning through experience and mistakes / safe risk-taking / failure-as-learning**. It references Junior Achievement and Monopoly/Game-of-Life as age-scaled tools. Net: it adds **no new mechanic** but reinforces (a) mistakes-as-learning (already FR-009/Guardrails) and (b) that *counting in a shop* is itself an authentic entrepreneurial act.

**The business meaning of counting** (synthesized — counting's payoff is *knowing the state of your business*, not arithmetic):
- Taking stock / inventory — "how many do I have left?"
- Counting the till — "how much cash to start/end with?"
- Verifying inputs — "did the supplier deliver what I paid for?"
- Fulfilling output accurately — "did I give the customer the right quantity?"

Parent-facing line (the install argument): change-making teaches arithmetic-with-money; **counting teaches the prerequisite habit of measuring what you have before you act.** Reward copy should reflect that ("Teraz wiesz, ile masz w kasie!"), not generic math praise.

**Candidate v1 counting scenarios (numbers ≤ ~20; Polish drafts — verify with a native speaker):**
1. **Count the till before opening** — "Policz monety w kasie, zanim otworzysz sklep." (opening float; matches FR-009's "coin pile" hint)
2. **Stock-take a shelf** — "Ile butelek soku zostało na półce?" (inventory; reuse shelf art + "Zapas" vocab)
3. **Customers in the queue** — "Ilu klientów czeka w kolejce?" (demand)
4. **Restock delivery check** — "Dostawca przywiózł skrzynkę. Policz, ile ciastek dostałeś." (verify delivery)
5. **Count the day's takings** — "Koniec dnia! Policz, ile monet zarobiłeś." (closing the till)
6. **Fulfil an order** — "Klient prosi o 6 babeczek. Włóż tyle do pudełka." (tap-to-target; output *is* an in-world action — strongest fit to §Business Logic)

Recommended v1 set: **#1, #2, #4, #6** — covers the four counting *meanings* (opening float, inventory, delivery-in, order-out) and reuses existing coin/shelf/box art.

**Developmental UI rules for 6–8 counting (tie each to the tappable-objects rule):**
- *One-to-one correspondence:* each object tappable exactly once with immediate persistent feedback (lifts/dims/checks) + a running tally that increments per tap — tap-to-count *enforces* one-to-one as the child does it.
- *Cardinality:* after the last tap, surface the running total prominently (last count word = the total).
- *Subitizing:* ≤5 can be scattered; for >10 group into rows of 5/10 so a grade-2 child counts-on by groups.
- *Count range:* grade 1 → ~10; grade 2 → ~20. Never exceed ~20 in v1.
- *Two input models:* **(a) count-and-confirm** (tap each → "Sprawdź") for "how many are there?"; **(b) tap-to-target** (tap items into a container until they match a requested quantity) for order-fulfilment. Prefer these over multiple-choice for counting.
- *Spacing:* ≥48px targets, ≥16px gaps as a starting point (verify on-device per NFR `:146`).

### Area 4 — Mockups (present locally, but ahead of v1 scope)

**Correction to CLAUDE.md:** it states `assets/matma-verse/` is "not in the repo / likely absent." In **this** local environment the directory **is present** (24 PNGs, web + mobile). It remains gitignored, so CI / a fresh clone / a cloud session will not have it — but locally it was usable and was used for this research.

**Caveat — the mockups overshoot v1.** They depict a richer, later product: a "Kawiarnia Ani" café theme, a multi-world selector, a parent panel, skill bars, and a "Ceny i zapasy" pricing screen — several of which the PRD explicitly defers to v2 (world map, second theme, parent dashboard). **Treat them as visual-language source of truth, not as v1 scope.**

Relevant screens (`assets/matma-verse/math-economy-ui-v2-{web,mobile}/`):
- **`03-change-mission-*`** — the de-facto **task-screen template** (closest structural analog to a counting task): top mission-title bar + progress dots ("Zadanie 2 z 5") + coin balance; centre character/customer with the in-world setup + question; bottom answer area + a single **"Sprawdź"** button (answer gated, submitted once); web right-rail "Wskazówka" (hint) card. **But it uses 3-tile multiple-choice** — which conflicts with the counting "tappable objects, not numerical inputs" rule. For counting, the centre artifact area becomes the interactive counting surface.
- **`04-pricing-inventory-*`** ("Ceny i zapasy") — the **stock/inventory visual grammar**: product rows (Sok / Ciastka / Kakao) each with a "Zapas" count (18, 10, 4) + coin stacks. Source for "count the stock / count the till" scenarios.
- **`02-child-dashboard-*`** — shop interior ("Kawiarnia") with shelves, coin balance "126 zł", "Polish reszte dla klienta" card. Establishes shop-interior backdrop + coin-sprite style.
- **`01-world-selection-web`** — v2-only world map (deferred); confirms HUD styling, out of v1 scope.

## Proposed task-spec data shape (synthesized starting point)

Designed to plug into the task-screen template and the FR-007 procedural-generation requirement. Field names in English (code); all `*Key` values resolve to **Polish** content (FR-013 — keep them in a content/locale map, not inline).

```ts
// Synthesized recommendation — one counting task instance (S-02), reusable by S-03/S-04
interface CountingTask {
  id: string;
  type: "counting";
  scenario:
    | "count_till"      // monety w kasie (opening float)
    | "count_shelf"     // zapas na półce (inventory)
    | "count_queue"     // klienci w kolejce (demand)
    | "count_delivery"  // dostawa (verify delivery)
    | "count_takings"   // utarg na koniec dnia (closing till)
    | "fulfill_order";  // włóż N do pudełka (order-out, tap-to-target)

  inputMode: "count_and_confirm" | "tap_to_target";
  objectType: "coin" | "bottle" | "cookie" | "cupcake" | "customer" | "jar";

  targetCount: number;        // true answer (count_and_confirm) OR requested qty (tap_to_target); 1–20, band-clamped
  availableCount?: number;    // tap_to_target only: objects available to tap (≥ targetCount) so child must stop at target
  arrangement: "scatter" | "rows_of_5" | "rows_of_10";  // subitizing/grouping hint

  choiceOptions?: number[];   // only if a scenario falls back to multiple-choice (omit for pure tap-to-count)

  narrativePromptKey: string; // Polish key, e.g. "task.count_till.prompt"
  questionKey: string;        // e.g. "task.count_till.question" → "Ile monet jest w kasie?"
  successCopyKey: string;     // e.g. "Świetnie! Wiesz, ile masz w kasie."
  hintArtifact: "object_pile";
  hintCopyKey: string;        // e.g. "Dotknij każdą monetę po kolei i licz."
  difficultyTier: 1 | 2;      // drives targetCount range + arrangement
}
```

Generation rules (synthesized): pick `scenario` → pick a consistent `objectType` → roll `targetCount` from the tier range (tier 1: 3–10, tier 2: 6–20) → choose `arrangement` (`scatter` if ≤5, else `rows_of_5/10`) → for `fulfill_order` set `availableCount = targetCount + rand(1..4)` → resolve `*Key` fields from the Polish content map. **No coin reward per task** (FR-010 — payout aggregates at shift end).

## Code References

- `src/components/child/StartShiftButton.tsx:6-33` — the S-02 seam (no-op `onClick`, `role="status"` feedback idiom)
- `src/pages/app/start.astro:18-68` — start-screen SSR loader + business card + island mount
- `src/pages/app.astro:1-17` — profile-count router (`resolveLandingPath`)
- `src/components/child/ChildButton.tsx` — oversized tap target (reuse for "Sprawdź"/controls)
- `src/components/child/SelectTile.tsx` — tap-select tile (model for tappable count objects)
- `src/i18n/pl.ts:162-169` — `start` namespace (add a sibling `task`/`counting` namespace here)
- `src/i18n/index.ts:25-27` — `charsNeeded(n)` Polish-plural helper to mirror
- `src/data/{worlds,avatars,leveling}.ts` — art-paired content lives here, not in the dictionary
- `src/styles/global.css` `:root` — design tokens (`--accent` gold = coin color)
- `src/middleware.ts:5` — `PROTECTED_ROUTES = ["/app"]` (`/app/*` already gated)
- `src/lib/services/child-profiles.ts:22-65` — service pattern (request-scoped client, RLS-scoped)
- `src/pages/api/profiles/create.ts` — API route + zod template (only if persistence is ever added)
- `supabase/migrations/20260609120000_child_profiles_isolation.sql` — RLS template; `:48-49` note that gameplay state is S-04
- `docs/reference/{contract-surfaces.md,rls-template.sql,rls-isolation.md}` — contract registry + RLS canon
- `tests/child-profiles-isolation.test.ts` — isolation-test model (L-002)
- `assets/matma-verse/math-economy-ui-v2-{web,mobile}/03-change-mission-*.png` — task-screen template (local-only, MC variant)
- `assets/matma-verse/math-economy-ui-v2-*/04-pricing-inventory-*.png` — stock/inventory visual grammar

## Architecture Insights

- **Vertical-slice greenfield with a single seam.** S-02 is the first gameplay surface; it has exactly one integration point (the start-screen island's no-op) and otherwise builds fresh — low coupling, but it *establishes* the task contract (spec → render → answer → feedback) that S-03 and S-04 inherit. Getting that contract reusable is the slice's architectural job, beyond just shipping one task.
- **Statelessness keeps S-02 in its lane.** Coins/level/results/persistence are S-04 by explicit design (`...isolation.sql:48-49`, roadmap). S-02 should announce a result ephemerally and persist nothing → no migration, no RLS surface, no new API route. This keeps the slice small and avoids stepping on S-04.
- **The pedagogy lives in the input model, not the copy.** "Tap each object, running tally, confirm" *is* the one-to-one-correspondence lesson; multiple-choice would hollow it out into recognition. The single most consequential decision in the plan is rejecting the mockup's MC tiles for a tap-to-count surface for the counting task type.
- **Polish-first is structurally enforced** (L-003 lint + `astro check` in CI). New copy must be authored as a `pl.ts` namespace from the start; pluralized counts must use `Intl.PluralRules`.

## Historical Context (from prior changes)

- `context/archive/2026-06-28-first-child-profile-and-start-screen/` — S-01b: built `/app` router, child-profile schema, avatar registry, the start screen, and the `StartShiftButton` placeholder S-02 extends. Decision **D1**: `child_profiles.name`/`age` are a conscious child-PII override (escaped text only, never `set:html`, never logged/URL'd). Decision **D4**: a dedicated `src/components/child/` primitive tier (not extensions of shadcn `button`) that "S-02+ reuses." Impl-review **F1** (null-client redirect to `/auth/signin`), **F2** (CI now runs `astro check` + a no-inline-literal lint rule).
- `context/archive/2026-06-27-matmaverse-design-system/` — the light MatmaVerse theme (oklch tokens, Nunito, child primitives); child-primitive *library* was deferred to a "Part B," so S-02 will author some of its own visuals (tappable coins, success animation) within these tokens. `coin-stack.png` was committed but is currently unused ("kept for Part B").
- `context/foundation/lessons.md` — **L-001** (RLS four-policy same-migration), **L-002** (test durable state, not a chained `.select()`), **L-003** (no inline literals; all strings via `src/i18n`). L-001/L-002 apply only if S-02 persists (it shouldn't); L-003 applies unconditionally.
- `context/foundation/roadmap.md:94-117` — S-02 is parallel with **S-03** (change-making, same task-rendering contract, different operation) and feeds **S-04** (the north-star full shift). The roadmap names S-02's job: establish the contract "task spec → rendered shop moment → answer collection → feedback" that S-03/S-04 reuse.

## Related Research

- `context/archive/2026-06-28-first-child-profile-and-start-screen/research.md` — start-screen + `/app` router research (the surface S-02 extends).
- `context/archive/2026-06-27-matmaverse-design-system/` — design-system design spec (tokens, primitives) at `docs/superpowers/specs/2026-06-27-matmaverse-design-system-design.md`.

## Resolved Decisions

Settled with the product owner on 2026-06-29 (post-research). These are **inputs to `/10x-plan`, not open items.**

1. **Answer input model → tap-to-count.** The child taps each object; a running tally increments per tap; then presses "Sprawdź". **No multiple-choice path in S-02** (not even a fallback) — the tapping *is* the one-to-one-correspondence lesson, and it honors `prd-v2.md:78`. The canonical `03-change-mission` mockup's 3-tile MC is therefore **not** copied for the answer surface; only its outer chrome (mission bar, progress, "Sprawdź", hint card) is reused. Build: a tappable-object surface, per-tap visual feedback (object lifts/dims/checks), a running tally, and the gated "Sprawdź" submit.
2. **Scenario breadth → one scenario, reusable contract.** S-02 ships **`count_till`** ("Policz monety w kasie") end-to-end only — but the task-spec type, render, answer-collection, and feedback are built as a **reusable contract** S-03 (change-making) and S-04 (full shift) inherit. The full scenario taxonomy (#2 shelf, #4 delivery, #6 order) and the procedural generator are **deferred to S-04**. `count_till` is chosen because FR-009's hint example ("highlight the coin pile to count") maps to it exactly and it reuses the committed `coin.png` asset.
3. **Mounting → dedicated `/app/<task>.astro` page.** The start-screen tap navigates to a new Astro page under `/app` (inherits middleware gating for free, keeps the SSR-loads / island-interacts boundary clean, and is the natural home for the S-04 shift loop). The `StartShiftButton` no-op is replaced with navigation to that route. Mind the `startsWith("/app")` no-boundary gotcha when naming the route.
4. **Persistence → none (stateless).** S-02 announces the task result ephemerally and persists nothing. No migration, no RLS surface, no API route — coins/level/results are S-04 by explicit design. L-001/L-002 do **not** apply to this slice; **L-003 (no inline literals) applies unconditionally.**
5. **`CountingTask` type location → create `src/types.ts`.** Per the CLAUDE.md "shared types in `src/types.ts`" convention (the file is currently missing). The task type is domain-level and shared across S-02/S-03/S-04, so this is the right slice to establish the file rather than hiding it inline in `src/data/`.
6. **Success acknowledgment → ship a subtle default, iterate.** A small scale/pop + checkmark on the object and a brief `role="status"` "correct!" card (modeled on `StartShiftButton.tsx:28-33`); **no per-task confetti/coin payout** (big celebration + payout is shift-end, S-04, per FR-008/FR-010). Calibration vs fanfare-fatigue is non-blocking, to be tuned by kid-testing.

## Remaining Flags (non-blocking)

- **Polish copy is draft.** All `count_till` prompt/question/success/hint strings must be authored as a new `pl.ts` namespace (per L-003) and **verified by a native speaker** before shipping.
- **Stale CLAUDE.md note.** CLAUDE.md says `assets/matma-verse/` is absent; it is present locally (gitignored). Recommend correcting the wording while keeping the "absent in CI / cloud sessions" warning. Owner: maintainer (can be folded into this change or handled separately).
