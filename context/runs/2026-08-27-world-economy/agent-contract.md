# Agent contract — run `2026-08-27-world-economy`

**Every step of this run reads this file first, then does only its assigned step.**
It exists so project invariants are not re-derived from scratch in every fresh
context. All slots below are filled and measured — nothing here is a placeholder.

Run folder: `context/runs/2026-08-27-world-economy/` · Process: `.claude/skills/10x-autonomous-run/references/process.md`

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
- `context/runs/2026-08-27-world-economy/ownership.md` is binding once it exists. It names the
  owner of every contended file, route and nav entry, and the merge stack order.

## Project rules that bind every step

Read `CLAUDE.md` (and `e2e/CLAUDE.md` for test steps) in full.

**The lessons cited below as L-00x live in two files, and you read both:**
`context/foundation/lessons.md` (tracked — L-001…L-003) and
`.claude/skills/10x-autonomous-run/references/lessons-addendum.md` (L-004…L-007,
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
npm test              # baseline 548 passed / 57 files — measure on YOUR branch, never assume
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

---

## This run — binding specifics (read before planning anything)

### Baseline, measured on `matmaverse-v2` @ `91754ef`, sandbox disabled

| command | result |
|---|---|
| `npm run lint` | exit 0 |
| `npm run check` | exit 0 — 0 errors, 0 warnings, 8 hints, 202 files |
| `npm test` (vitest) | **548 passed / 548**, 57 / 57 files |
| `npx playwright test` | **26 passed / 26** |
| rule-file validation (step 0) | PASS — 6 rule files, 83 paths, 0 missing |

Every success criterion in every plan is written as **`baseline + delta`** against
these numbers and **measured on your own branch** (L-005). Never an absolute count.

### Design sources — read them, do not re-derive them

- Spec: `docs/superpowers/specs/2026-08-27-world-economy-design.md` (carries **D-11…D-13**).
- Rationale and rejected alternatives: `context/foundation/shape-notes-world-economy.md` (**D-1…D-13**).
- Backlog entries **E1** and **W1**: `context/foundation/backlog.md` under `## Ready`.

**Do not re-litigate D-1…D-13.** Each was posed and settled by the maintainer. If
your step believes one is wrong, that is a `## Known risks` note or a `RETHINK`
report — never a silent reversal.

### Four decisions the planner must NOT invent — read them from the sources above

1. **The reference shift for the invariant sweeps.** No longer open: **D-13's
   pacing model derives it**. A planner neither invents a number nor leaves it implicit.
2. **How a decoration renders when no decoration art exists.** Settled by the
   `src/data/stages.ts` precedent, and it is a documented deviation, not a
   workaround: `Decoration` carries **`art?: string`, unset in the first batch**;
   decorations render from **lucide + the app's design tokens** through `ShopArt`'s
   documented corner-row fallback; the **module header records the art upgrade path**
   exactly as `stages.ts:17–31` does. **Neither a placeholder asset nor halting the
   run is acceptable.**
3. **Whether W1 writes per-world catalogue vocabulary** (6 × 8 strings) or ships on
   the mandatory `t.worlds[slug].upgrades[id] ?? t.upgrades[id]` fallback and grows
   into it. Genuinely open — **choose explicitly and record it**, because the
   fallback exists precisely so this is a choice.
4. **How many decorations each world gets in the first batch**, given the art does
   not exist yet. Genuinely open — **choose explicitly and record it.**

Decisions 3 and 4 go under `## Autonomous decisions` with the reversal condition.

### Invariants a reviewer must REJECT an implementation over

- **Cost is NEVER a wallet debit.** `wallet -= rent` breaks **FR-008**
  (`prd-v3.md:102`, no reduction of funds outside a purchase);
  `wallet += max(0, revenue − cost)` does not, because cost applies to a shift's
  revenue and `profit ≥ 0`. Reject a wallet debit on FR-008 grounds. This is
  settled — a wallet debit does not require a `prd-v4`, it is simply out.
- **Decorations NEVER enter `shop_state.purchased`.** In `purchased` they would
  reach `shopRunningCost` and `canBuy` and recreate the very trap the no-trap
  invariant exists to forbid. They live in the **optional sibling
  `decorations?: string[]`** in the same jsonb.
- **The catalogue ends at eight entries** — 1 unlock (`sign`) + 5 capacity + 2
  margin. Decorations are a **second, separate list**, out of `investment`, out of
  `purchased`, and out of FR-010's 5–8 bound.
- **No migration.** `shop_state.purchased` stays a flat global id list and gains
  the optional `decorations?: string[]` sibling in the same jsonb — the precedent
  `purchasedMeta?` set. Every legacy `{}` and `{ purchased: [] }` row stays valid.

### Known regression — handle it deliberately, do not delete the assertion

`e2e/growth.spec.ts:122` (*Risk E2E-F4-3*) seeds `purchased: ["sign","shelf"]` at
`business_level 1` to reach the empty-shop state. **After D-11 decorations are
always buyable at price-only gating, so that seed stops producing an empty shop and
the test goes red.** `t.growth.noNextUpgrade` must still exist for the case where a
world's decorations are also exhausted. **Re-seed the state** — own the level-1
catalogue entries **and** the world's decorations — and preserve the property the
test was written to defend: **the shop CTA survives the empty state, because
`/app/growth` is the only entrance to the shop.**

### Stack, not two lanes

E1 and W1 run as **one serial stack, E1 first**. Not because W1 depends on E1's
mechanics — the D-3 copy fallback deliberately decouples them — but because **both
edit `src/i18n/pl.ts`** and concurrent worktrees would collide there. E1 first also
means W1 names the eight catalogue entries **once**, instead of six and then two more.
