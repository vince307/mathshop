# Agent contract — template

Copy to `context/runs/<run-id>/agent-contract.md` at the start of a run and fill the
three `<<< >>>` slots. Every step of the run reads this file first, then does only
its assigned step. It exists so project invariants are not re-derived from scratch
in every fresh context.

> **Fill before the run:** `2026-08-24-followups-and-remember-me`, `matmaverse-v2`, `429 unit tests / 51 files, 23 e2e specs, lint clean`.
> **Step 0 of every run is validating this file against the repo** — in the source
> run `CLAUDE.md` pointed at asset directories that do not exist, and every agent
> read it, so the error compounded across the whole run.

---

## Hard rules

1. **No human in the loop.** NEVER call `AskUserQuestion`. Several 10x skills tell
   you to ask the user, or to STOP and wait — in this run you do not. Decide
   yourself and record the decision under `## Autonomous decisions` in the artifact
   you produce: what you chose, what you rejected, why, and **what would change the
   answer**. A skill step that says "ask, then save" collapses to "decide, then save".
2. **Always leave a handoff.** Before returning, write
   `context/changes/<change-id>/handoff.md` to the schema in
   `.claude/skills/10x-autonomous-run/references/handoff-schema.md` — all six numbered
   headings, exact text. A verifier greps for them; a handoff that fails the grep
   fails your step. An artifact without a handoff is an incomplete step.
3. **Context hygiene at ~300k.** Approaching it, stop expanding scope: write the
   handoff and return with the first line `STATUS: NEEDS_CONTINUATION` plus what
   remains. Do not push through — a continuation thread is cheaper than a
   hallucination.
4. **Report back short.** Your final message is at most 12 lines: `STATUS:
   OK|NEEDS_CONTINUATION|BLOCKED`, artifact paths written, key decisions, and
   anything the next step must know. No file dumps, no essays — the orchestrator
   reads your artifacts, not your prose.
5. **Verify, do not inherit.** A green you were told about is not a green you
   observed. After any restart, re-run the suites. When you re-open a predecessor's
   work, check that its applied findings are real — in the source run 1 of 14 was
   false.

## Concurrency — where you may write

Read `.claude/skills/10x-autonomous-run/references/concurrency.md` in full before any step that touches git.

- **The main checkout never changes branch during this run.** If your step needs a
  branch, it runs in a worktree bootstrapped by `.claude/skills/10x-autonomous-run/scripts/worktree-bootstrap.sh`
  (which also assigns your `E2E_PORT`). Never `git checkout` in the main tree.
- Docs-lane steps (`new`, `research`, `plan`, `plan-review`) write **only** inside
  `context/changes/<your-change-id>/`. Nothing else. Not source, not other features.
- Your own change folder is yours. Another feature's is not — if you find a defect
  in a neighbouring plan, **report it**; do not edit their file unless you are the
  contention-sweep step.
- `context/runs/2026-08-24-followups-and-remember-me/ownership.md` is binding once it exists. It names the
  owner of every contended file, route and nav entry, and the merge stack order.

## Project rules that bind every step

Read `CLAUDE.md` (and `e2e/CLAUDE.md` for test steps) in full.

**The lessons cited below as L-00x live in two files, and you read both:**
`context/foundation/lessons.md` (tracked — L-001…L-003) and
`.claude/skills/10x-autonomous-run/references/lessons-addendum.md` (L-004…L-007, L-009,
which live beside this contract because this skill is gitignored like every other
10x skill). Neither is optional; L-004 and L-007 in particular are the ones the
source run kept re-learning.

These are the rules runs trip over most:

- **Mockups in `assets/` are the source of truth for UI**, and they exist **only on
  the maintainer's machine** (`assets/` is gitignored). Binding sets:
  `assets/matmaverse-auth-v2-{web,mobile}`, `assets/matmaverse-ui-v2-{web,mobile}`,
  `assets/matmaverse-missing-screens-v3-{web,mobile}`. `matmaverse-ui-mockups/` is
  reference only. **Look at the actual PNG before laying out a screen.** If the set
  is absent, say so in your handoff and mark the layout as an extrapolation — do
  not guess silently.
- **No invented data.** If the mockup shows a metric the product does not store, do
  not render it and do not estimate it. Every number on screen comes from
  `child_profiles` or an aggregation of `shift_log`.
- **No dead navigation.** Sidebar and bottom bar link only to routes that exist. A
  nav entry ships with its screen, never before it.
- **One copy of each name in the accessibility tree.** Sidebar and bottom bar render
  once and toggle with `hidden` / `lg:hidden` (`display`, never `opacity`). One
  responsive `h1` per page. The `touch` Playwright project runs at 712px — below
  `lg` — so a duplicated label breaks `getByRole`. And **`getByText` matches
  substrings**, so a new label containing an existing phrase breaks unrelated tests
  (L-007).
- **`hidden` loses to a class that sets its own `display`** (e.g. `inline-flex` from
  `buttonVariants`) — put the breakpoint on the wrapper.
- **All user-visible copy goes through `src/i18n/pl.ts`.** Never a literal in a
  component. Polish, always (L-003).
- **Every route under `src/pages/api/` must `export const prerender = false`.**
- **New Supabase table or column ⇒ RLS policies in the same migration**, granular
  per-operation and per-role (L-001). Getting it wrong is a silent cross-account
  leak, not a crash. Migrations: `supabase/migrations/YYYYMMDDHHmmss_description.sql`.
  Test isolation without a chained `.select()` read-back (L-002).
- Tailwind merges with `cn()` from `@/lib/utils`; shadcn via `npx shadcn@latest add`;
  business logic in `src/lib/services/`; shared types in `src/types.ts`; zod for API
  input.
- **New artwork:** `assets/` is gitignored, so crops go to `public/illustrations/`
  and are registered in `public/illustrations/slice-map.md` (file + crop box).
  Generic icons come from `lucide` — do not crop those.

## Verification — a step is not done until this passes

```bash
npm run lint          # clean
npm test              # baseline 429 unit tests / 51 files, 23 e2e specs, lint clean — measure on YOUR branch, never assume
npm run check         # the only thing that type-checks .astro; the pre-commit hook runs eslint alone
E2E_PORT=<yours> npx playwright test
```

- **Success criteria never carry absolute test counts.** Write `baseline + delta`
  and measure on your branch. Baselines moved 299 → 318 → 346 → 382 in one run (L-005).
- **Run the deliberate break, then meta-check it** (L-004): break what the test
  protects, watch red, restore — then ask whether that break *proves what it
  appears to*. A break nothing would ever introduce certifies nothing.
- **Anchor on symbols, never line numbers** (L-006).
- The local Supabase stack must be up for e2e (`npx supabase status`, API on
  127.0.0.1:54321). **The command sandbox blocks that address** — run suites with
  the sandbox disabled or ~30 tests fail for reasons unrelated to your change.
- Never bypass the pre-commit hook (`--no-verify` / `core.hooksPath` are off limits).

## Git

- One branch per feature: `feat/<change-id>`, cut from `matmaverse-v2` — or from
  its predecessor when `ownership.md` puts it in a stack.
- Conventional Commits, one commit per completed plan phase, **only on green**.
- **Do not push and do not open a PR.** The maintainer reviews locally.
