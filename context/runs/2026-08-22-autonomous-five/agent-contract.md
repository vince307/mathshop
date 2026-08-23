# Agent contract — autonomous run 2026-08-22

Every step of this run executes in a **fresh subagent context**. This file is the
standing brief; read it first, then do only your assigned step.

## Hard rules

1. **No human in the loop.** NEVER call `AskUserQuestion`. Several 10x skills
   instruct you to ask the user or to STOP and wait — in this run you do not.
   Decide yourself, and record the decision under a `## Autonomous decisions`
   heading in the artifact you produce (what you chose, what you rejected, why,
   and what would change the answer). A skill step that says "ask, then save"
   collapses to "decide, then save".
2. **Always leave a handoff.** Before you return, write or update
   `context/changes/<change-id>/handoff.md`. It must let a zero-context reader
   resume: what is done, what files changed, what the next command is, what is
   still open. This is the single most important output of your step — an
   artifact without a handoff is an incomplete step.
3. **Context hygiene at 300k.** If your context approaches ~300k tokens, stop
   expanding scope: write the handoff, and return with the first line
   `STATUS: NEEDS_CONTINUATION` plus what remains. Do not push through — a
   continuation thread is cheaper than a hallucination.
4. **Report back short.** Your final message to the orchestrator is at most 12
   lines: `STATUS: OK|NEEDS_CONTINUATION|BLOCKED`, artifact paths written, key
   decisions, and anything the next step must know. No file dumps, no essays —
   the orchestrator reads your artifacts, not your prose.

## Project rules that bind every step

Read `CLAUDE.md` (and `e2e/CLAUDE.md` for test steps) in full. These are the ones
this run trips over most:

- **Mockups in `assets/` are the source of truth for UI.** They exist locally.
  `assets/math-economy-*` in CLAUDE.md is the older naming — on this machine the
  binding sets are `assets/matmaverse-auth-v2-{web,mobile}`,
  `assets/matmaverse-ui-v2-{web,mobile}` and
  `assets/matmaverse-missing-screens-v3-{web,mobile}`. `matmaverse-ui-mockups/`
  is **reference only**, not binding. Look at the actual PNG before you lay out a
  screen.
- **No invented data.** If the mockup shows a metric the product does not store,
  do not render it and do not estimate it. Every number on screen comes from
  `child_profiles` or an aggregation of `shift_log`. This rule has already been
  applied once across the app — do not regress it.
- **No dead navigation.** Sidebar and bottom bar link only to routes that exist.
  A nav entry ships with its screen, never before it.
- **One copy of each name in the accessibility tree.** Sidebar and bottom bar are
  rendered once and toggled with `hidden` / `lg:hidden` (`display`, never
  `opacity`). One responsive `h1` per page, not a mobile/desktop pair. The `touch`
  Playwright project runs at 712px — below `lg` — so a duplicated label breaks
  `getByRole` locators. Also: `getByText` matches substrings, so a new label that
  contains an existing phrase can break an unrelated test.
- **`hidden` loses against a class that sets its own `display`** (e.g. a button
  with `inline-flex` from `buttonVariants`) — put the breakpoint on the wrapper.
- **All user-visible copy goes through `src/i18n/pl.ts`.** Never a literal in a
  component. Polish, always.
- **Every route under `src/pages/api/` must `export const prerender = false`.**
- **New Supabase table or column ⇒ RLS policies in the same migration**, granular
  per-operation and per-role. This is the project's highest-risk requirement:
  getting it wrong is a silent cross-account data leak, not a crash.
  Migrations are named `supabase/migrations/YYYYMMDDHHmmss_description.sql`.
- Tailwind classes merge with `cn()` from `@/lib/utils`; shadcn components via
  `npx shadcn@latest add`; business logic in `src/lib/services/`; shared types in
  `src/types.ts`; zod for API input.
- **New artwork:** `assets/` is gitignored, so crops must be written to
  `public/illustrations/` and registered in `public/illustrations/slice-map.md`
  (file + crop box). Generic icons come from `lucide` — do not crop those.

## Verification (a step is not done until this passes)

```bash
npm run lint      # must be clean
npm test          # 299/299 was the baseline; your step may only add
npx playwright test   # 15/15 baseline (desktop + touch)
```

The local Supabase stack must be up for e2e (`npx supabase status`; API on
127.0.0.1:54321). Demo account: `ui-polish-demo@example.test` /
`test-password-123!`, parent PIN `2468`, profile "Ania". If the DB was reset,
`tests/helpers/supabase.ts` has admin helpers to recreate it.

Never bypass the pre-commit hook (`--no-verify` / `core.hooksPath` are off limits).

## Git

- One branch per feature, cut from `feat/ui-polish`: `feat/<change-id>`.
- Conventional Commits, one commit per completed plan phase, only on green.
- **Do not push and do not open a PR.** The maintainer reviews locally.
