# Autonomous run — follow-ups & remember-me, 2026-08-24

Backlog source: `context/foundation/backlog.md`, entries H1, A3.
Standing brief for every step: `agent-contract.md` (same folder).
Process definition: `.claude/skills/10x-autonomous-run/references/process.md`.

**Written by the orchestrator only.** Subagents write their own change folders;
they never edit this file.

## Baseline — measured, not assumed

| | value |
|---|---|
| Base branch | `matmaverse-v2` at `282d264` |
| `npm test` | 51 files / **429 tests** passed (36.0s) |
| `npx playwright test` | **23 passed** (29.4s), projects `desktop` + `touch` |
| `npm run lint` / `npm run check` | lint clean · check **0 errors, 0 warnings, 9 hints** (188 files) |
| Rule-file validation (step 0) | FAIL → fixed → **PASS** (5 rule files, 56 paths, 0 missing) |

Measured on `matmaverse-v2` on 2026-08-24 with the sandbox disabled and Supabase
running on `127.0.0.1:54321`. Success criteria must be written as `baseline + delta`
and re-measured on the feature branch (L-005).

## Features

**F1 `autonomous-run-follow-ups`** (backlog H1, high value / low cost, **no
migration**). Ten concrete, already-triaged follow-up items from the previous run's
five `follow-ups/review-fixes.md` files — each names a file and a symbol. The three
leading items: the `nextUpgradeHeading` `<h2>` in `src/pages/app/growth.astro` sits
outside the `{next && …}` guard; the stage-ordinal `aria-label` in
`src/components/child/StageRail.astro` hangs on a `role=generic` span and is never
announced; `tests/weekly-report-tiles.test.tsx` never renders a non-zero chart beside
a non-zero tile. No mockup binds this entry — it is verification debt, not UI.
**Open decision for the planner:** one change vs. per-feature follow-up commits.

**F2 `remember-me-on-login`** (backlog A3, medium value / low cost, **no
migration**). A **session-policy decision before it is UI**. Mockup
`assets/matmaverse-auth-v2-{web,mobile}/01-parent-login-*` **[I]** — and `assets/`
is gitignored, so a worktree will not have it; the planner must not guess a layout.
**Open decision the planner must make and record:** what "remember me" changes
concretely (refresh-token lifetime, cookie `maxAge`, or both), what the unchecked
default is, and the security posture on a shared family device. If nothing can be
honestly implemented, the entry closes as a **documented non-goal** rather than
shipping a placebo checkbox — the project's own rule against decorative toggles.

## Status

| Feature | new | research | plan | plan-review | implement | impl-review | e2e | branch |
|---|---|---|---|---|---|---|---|---|
| F1 `autonomous-run-follow-ups` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | `feat/autonomous-run-follow-ups` |
| F2 `remember-me-on-login` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | `feat/remember-me-on-login` |

Legend: — pending · ▶ running · ✓ done · ! needs attention · ✗ dropped from the run

## Stack order and ownership

The docs lane is finished: **2 of 2 features planned, 0 dropped.** Every feature that
entered the run has a `change.md`, a `research.md` and a `plan.md` on disk. The
contention sweep has read both plans in full and what follows is binding from here on;
the orchestrator's earlier prior (F1 before F2) is superseded — full detail in
`ownership.md`.

### Stack order

```
[["autonomous-run-follow-ups"], ["remember-me-on-login"]]
```

Two stacks of one. Both branches are cut from `matmaverse-v2` @ `282d264` and build
**concurrently**. The reasons, stated as decisions rather than omissions:

- **NO EDGES EXIST.** This is a decision the sweep made and is recording, not a gap in
  the analysis. The two features are in separate stacks and build concurrently from
  `matmaverse-v2` @ `282d264`.
- **REJECTED PREREQUISITE (either direction).** Neither feature imports, calls or
  re-exports any symbol the other introduces. F2's new symbols
  (`REMEMBER_ME_COOKIE`, `REMEMBER_ME_MAX_AGE_SECONDS`, `setRememberChoice`,
  `authCookieMaxAge`, an exported `AUTH_COOKIE_RE`) have exactly three consumers, all
  of them F2's own; F1's new symbol (`seedShiftWeek`) has exactly one consumer, F1's
  own spec.
- **REJECTED PREFERENCE on `src/i18n/pl.ts`.** Both features append, but ~325 lines
  apart in different objects — F2's `rememberLabel` in `auth.signin` around line 17,
  F1's `noNextUpgrade` in `growth` around line 345. Git three-way-merges this cleanly,
  so serialising would buy nothing and cost a build cycle.
- **REJECTED PREFERENCE on `docs/reference/contract-surfaces.md`.** F1's hunk ends near
  line 68 (`## Parent PIN routes`); F2's begins after line 90 (a new H2 following
  `## set_updated_at()`). That leaves ~22 lines of untouched context between them —
  more than the default 3-line diff context, so it is not even an adjacent-hunk
  conflict.
- **REJECTED PREFERENCE from F2's `setAll` blast radius.** F2 makes every auth cookie a
  browser-session cookie, but `e2e/helpers/accounts.ts` imports its admin client from
  `tests/helpers/supabase.ts` (plain `supabase-js`, **not** `createClient`), so F1's
  seeder never crosses the seam; and a Playwright `BrowserContext` retains session
  cookies for its own lifetime, so `signInViaUI` is unaffected. Checked on disk, not
  assumed.
- **INTEGRATION-ORDER RULE (not a build edge; order left free).** Whichever feature
  lands second rebases and re-measures. If F1 lands first, F2's "baseline + 0" e2e
  delta is still correct but the total is no longer 23 — F1 adds 3 runs
  (`growth.spec.ts` +1 test × 2 projects, `parent-weekly-report.spec.ts` +1
  desktop-only).

### Contended resources

| Resource | Who | Ownership | Rule |
|---|---|---|---|
| `src/i18n/pl.ts` | F1 + F2 | SHARED, per-object | Append only, one key per entry, inside your own object. F1: `noNextUpgrade` in `growth:` (after `noUnlocks`). F2: `rememberLabel` in `auth.signin:`. Never restructure; re-run the both-directions L-007 check before committing. |
| `docs/reference/contract-surfaces.md` | F1 + F2 | SHARED, per-section | F1 owns `## Parent PIN routes (RLS surface)` (line 58, ends before `## Account deletion` at line 69) and appends one K1 bullet. F2 owns a NEW `## Auth cookie lifetime (session-policy surface)` appended after `## set_updated_at()` (ends line 90). Neither may touch the other's section. On a conflict inside a *Consumed by* / *Tests* line, KEEP BOTH SIDES — never `--ours`/`--theirs`. Nothing in `src/`, `tests/`, `e2e/` or CI reads this file, so a bad resolution fails silently and forever. |
| `e2e/helpers/accounts.ts` | F1 WRITES, F2 READS | F1, sole writer | F2 makes no edit (its plan says so twice; its research only reads). F1 appends `seedShiftWeek` after `signInViaUI` at EOF and edits no existing export. The append-only rule survives sole ownership **because of** F2's read: every authenticated F2 regression funnels through `signInViaUI`, so `getByLabel(emailLabel)`, `getByLabel(passwordLabel, {exact:true})` and `getByRole('button', {name: t.auth.signin.submit})` must not move. |
| `src/lib/supabase.ts` (`createClient`/`setAll`, `AUTH_COOKIE_RE`) | F2 only | F2 | F1 does not touch it. F2 may export `AUTH_COOKIE_RE` (module-private const, line 19) and set `maxAge` inside `setAll`. `maxAge` must **never** enter `AUTH_COOKIE_OPTIONS` — `clearAuthCookies` (line 51) spreads that object after its own `maxAge: 0` via a direct `cookies.set`, bypassing `setAll`, so it would silently break sign-out. |
| `src/lib/services/*` | F2 adds `remember-me.ts` (new) | F2 for the new file; NOBODY edits an existing one | F1 only READS `reports.ts` (`weekDayKeys`) and mirrors `child-profiles.ts` (`appendShiftLog`). `zoneOffsetMinutes` stays module-private — do not export it, do not copy it. |
| `src/components/**` | disjoint | per-file | F1: `child/StageRail.astro`, `child/WorldPicker.tsx`, `parent/WeeklyActivityChart.tsx`. F2: `auth/SignInForm.tsx` plus the first use of `ui/checkbox.tsx`. No overlap. |
| `src/components/app/AppShell.astro` | F1 transiently | F1 | **NET ZERO EDITS.** Phase 4's deliberate break mutates an `items[].href` and restores it; `git diff` on this file must be empty at every commit. |
| nav entries (AppShell `items`/`tabs`) | NEITHER | — | No feature adds a nav entry this run. `items` = 5, `tabs` = 6. No feature may add a 7th tab — it would invalidate the only fit evidence available. |
| routes under `src/pages/app/` | F1 only | F1 | F1: `growth.astro`. F2 touches no `/app/` route (its page is `src/pages/auth/signin.astro`). |
| `src/pages/api/**` | disjoint | per-file | F1: `api/profiles/world.ts`. F2: `api/auth/signin.ts`, `api/auth/signout.ts`. Both keep `export const prerender = false`. |
| `src/pages/auth/signin.astro` | F2 only | F2 | F2 deletes the standalone reset link; F1 does not touch `src/pages/auth/`. |
| `supabase/migrations/` | NEITHER | — | Uncontended and unwritten. The hard-serialized lane is CLOSED this run. See *migration author* below. |
| `src/types.ts` | NEITHER | — | Untouched by both plans. If a phase needs a shared type it appends only and says so in its handoff. |
| `tests/**` | disjoint | per-file | F1: `worlds-picker`, `shop-art-slots.test.ts` → `.tsx` (rename), `weekly-report-tiles`, `nav-labels`. F2: new `remember-me-cookie.test.ts`, new `signin-form.test.tsx`. Neither may edit `vitest.config.ts` — both use a per-file `// @vitest-environment jsdom` pragma. |
| `e2e/*.spec.ts` | F1 only | F1 | F1: `growth.spec.ts` (+1 test), `parent-weekly-report.spec.ts` (+1 test). F2 adds and edits no spec. |
| `playwright.config.ts` | NEITHER | — | Untouched. Its `touch` project's `testMatch` `/(gameplay-restore\|growth)\.spec\.ts/` is a fact BOTH plans' e2e deltas depend on; changing it mid-run makes both wrong. |

**BEHAVIOURAL COUPLING no plan owns.** F2 changes `setAll`, the write path for *every*
auth-cookie write, so post-F2 the auth cookie is a browser-session cookie unless
`remember_me=1`. Verified harmless to F1 (`accounts.ts` uses plain `supabase-js` admin,
not `createClient`; Playwright contexts retain session cookies). No action required —
it is recorded here so that a post-integration flake is not misattributed.

### Cross-plan fixes made by the sweep

Four defects were found and **fixed in place** in the plans themselves; each was
invisible to the plan's own author and visible only to a reader holding the other
plan.

- **CPD-1 — defect in F1, visible only to an F2 reader.** F1 asserted that
  `e2e/helpers/accounts.ts` is contended with F2, built decision D7 entirely on that
  premise (ending "F1 then rebases onto F2"), and repeated it in References. It is
  false: F2's *What We're NOT Doing* says "No changes to `e2e/helpers/accounts.ts`",
  AD-9 repeats it, and all three mentions in F2's `research.md` are READS of
  `signInViaUI`. F1 had misread a read dependency as a write collision. Unfixed, an
  implementer would have hunted for a `feat/remember-me-on-login` predecessor that will
  not exist, and serialised two independent features on a phantom. The bullet, D7 and
  the References entry were rewritten: the *decision* (append at EOF, edit no existing
  export) survives, the premise did not — the reason is now F2's read dependency on the
  locators.
- **CPD-2 — defect in F1, only this sweep could settle it.** F1's Phase 0 carried a
  live conditional: "If this branch is stacked on `feat/remember-me-on-login` (an
  `ownership.md` the sweep may yet write), the baseline is that branch's." Replaced with
  the resolved answer — not stacked, cut from `matmaverse-v2` — plus the two facts that
  justify it (the ~325-line i18n gap, different doc sections) and a restated L-005
  obligation to measure the baseline on the branch rather than inherit 429/51.
- **CPD-3 — defect in F2, only this sweep could settle it.** F2's Phase 3 criterion left
  the e2e count unresolved: "19 `test()` calls across 8 spec files while the contract
  states 23 e2e specs — the difference is PRESUMABLY the per-project multiplier." F1's
  plan holds the resolving fact (the `touch` project's `testMatch`). Verified on disk:
  19 `test()` calls + 4 touch re-runs (`gameplay-restore` 2 + `growth` 2) = **23 RUNS**;
  the contract's "23 e2e specs" is a run count. An unconfirmed guess inside a success
  criterion is a criterion nobody can check. The arithmetic was written out, with an
  explicit warning that it does **not** license writing 23 into a criterion, since F1
  concurrently adds 3 runs.
- **CPD-4 — defect in F2, highest severity, triggered by this very document.** F2's
  AD-8 said: "if `ownership.md` lands and assigns `docs/reference/contract-surfaces.md`
  exclusively to F1, Phase 3 loses its only code change and FOLDS INTO PHASE 2." F1 does
  claim that file, so an implementer skimming for "contract-surfaces.md" could plausibly
  conclude the contingency had fired. Phase 3 is where F2's **full Playwright run**
  lives — the only gate on `signInViaUI` after the sign-in form is restructured, and
  every authenticated spec in the repo funnels through it. Collapsing Phase 3 would have
  removed the one check standing between a moved form control and eight silently broken
  spec files. AD-8 was rewritten to record that ownership is per **section**, not per
  file (with line numbers), that F2 keeps its new H2, and that Phase 3 must not fold —
  naming the regression gate as the reason.

**Checked and found sound** — recorded so nobody re-derives them: (a) F1's claim that
`t.nav.items` has six keys while AppShell's `items` array holds five (`parent` is a
pinned sidebar link, spread into `tabs`) — verified on disk, so F1 Phase 4's correction
of the three stale "Five entries" comments is right; (b) both plans assert of each other
that `supabase/migrations/` is uncontended — both correct; (c) F2's claim that
`AUTH_COOKIE_RE` is module-private (line 19) and that `clearAuthCookies` bypasses
`setAll` — verified, so the "never put `maxAge` in `AUTH_COOKIE_OPTIONS`" warning is
real; (d) both plans already agreed on the contract-surfaces "keep both sides" conflict
rule.

**L-007 run by the sweep in BOTH directions with BOTH keys present** — this supersedes
each plan's solo check, since F1 checked 314 phrases before F2's key existed and F2
checked before F1's. Against all 351 distinct string values in `src/i18n/pl.ts`: F1's
"Masz juz wszystkie ulepszenia dostepne na tym etapie." — 0 existing values are a
substring of it, 0 contain it. F2's "Zapamietaj mnie" — 0 and 0. Cross-feature: neither
new label contains the other, and neither exists verbatim already. **CLEAR.** Still
re-run before committing, since the keys land on two branches that have not seen each
other.

**712px tab count.** The trigger condition ("if two features each add a nav entry") is
**not met** — neither feature adds one. AppShell `items` = 5, `tabs` = `[...items,
parent -> /app/report]` = 6, and 6 is what renders below `lg`. The bar holds, proven
rather than asserted: `e2e/growth.spec.ts` Risk E2E-F4-2 already loops
`Object.values(t.nav.items)` asserting `toHaveCount(1)` **and** `toBeVisible()` per
label in BOTH Playwright projects, and `growth.spec.ts` is one of the two files the
`touch` project matches — an overflowing or wrapped-out label would already be red. F1
Phase 4 strengthens that loop with per-entry `href` assertions; it adds no tab.

**Related L-007 hazard flagged for F2** (already covered by its own criteria; no plan
change needed): `t.auth.reset.heading` and `t.auth.reset.signinLinkLabel` are the SAME
string, "Nie pamietasz hasla?" (`pl.ts` lines 35 and 41). F2 moves the link into
`SignInForm.tsx` and deletes it from `signin.astro`, so `/auth/signin` must render it
exactly once — covered by F2's `grep -c` criterion (0 / 1) and component test 3.
`e2e/password-reset.spec.ts:90` locates the heading by `getByRole('heading')` on a
different page and is unaffected. Do not merge the two dictionary keys; they are two
surfaces that happen to share text.

### Migration author

**none.** No feature writes a migration this run, so the hard-serialized migration lane
is closed and no author is designated.

## Run log

- **2026-08-24** — Step 0 rule-file validation FAILED: `e2e/CLAUDE.md:5` pointed at
  `context/changes/testing-e2e-playwright/`, archived on 2026-07-12 to
  `context/archive/2026-07-12-testing-e2e-playwright/`. Fixed and committed as
  `282d264` **before** the run opened — every agent reads that file.
- **2026-08-24** — Preflight clean: tree clean, no stale worktrees, no dev server on
  4321/4322, Supabase API up. Baseline measured (above) and green.
- **2026-08-24** — Run opened on base `matmaverse-v2`, port base 4330.
- **2026-08-24** — Pipeline `wf_7218ab0d-347` died mid-flight in the docs lane: the
  background workflow was checkpointed at a session boundary and could not be
  re-adopted ("adopt scriptPath rejected"). **Nothing on disk was lost** — this is
  the failure mode §10 of the process anticipates. State at death: `/10x-new`
  complete for both features (`change.md` + `handoff.md` present for each; F2's
  artifact verifier returned pass), F1's `new` step still running with its artifacts
  already written. No worktrees created, no branches cut, main checkout untouched
  and still on `matmaverse-v2`.
- **2026-08-24** — Resumed via `resumeFromRunId: wf_7218ab0d-347`. Completed
  `agent()` calls replay from cache; the first unreached call and everything after it
  runs live.
- **2026-08-24** — **Docs lane finished: 2 of 2 features planned, 0 dropped.** Both F1
  and F2 have `change.md`, `research.md` and `plan.md` on disk. F2 did *not* close as a
  documented non-goal: its planner found a concrete, honest session-lifetime change
  (cookie `maxAge` on the auth-cookie write path, gated by a `remember_me` cookie), so
  it ships as normal code.
- **2026-08-24** — **Contention sweep complete; stack order is now binding.** Result:
  `[["autonomous-run-follow-ups"], ["remember-me-on-login"]]` — two stacks of one, no
  edges, both cut from `matmaverse-v2` @ `282d264` and building concurrently. This
  **supersedes** the orchestrator's prior decision to run F1 before F2 in a single
  stack; that note's own reversal condition (the sweep's DAG wins) has fired, and the
  reason is simply that no build edge exists in either direction. The sweep also found
  and fixed four cross-plan defects in place (CPD-1 through CPD-4 above), the most
  serious being CPD-4, where an F2 contingency clause would have led an implementer to
  collapse the phase containing F2's only full Playwright run. Migration author: none.
- **2026-08-24** — **Code lane finished: 2 of 2 features built, 0 blocked, 0 halted,
  0 dropped.** Both stacks ran concurrently to completion. F1
  `feat/autonomous-run-follow-ups` @ `8fc70f0`, 10 own commits, impl-review verdict
  **APPROVED** (0 critical, 2 warnings), merge check **CLEAR**. F2
  `feat/remember-me-on-login` @ `ead0d92`, 5 own commits, impl-review verdict
  **APPROVED** (0 critical, 3 warnings), merge check **CLEAR**. Neither wrote a
  migration. F2 did **not** close as a documented non-goal.
- **2026-08-24** — **Pre-integration obstacle, resolved without loss (AD-1).**
  `context/changes/autonomous-run-follow-ups/` and `context/changes/remember-me-on-login/`
  existed **untracked** in the main checkout (the docs lane wrote them there) while both
  branches carry committed copies; git would have refused the merge with "untracked
  working tree files would be overwritten". Both were backed up to
  `$TMPDIR/preint-backup/` and moved aside so the committed copies could land. Verified
  lossless: F2's untracked copy was byte-identical to its branch; F1's differed only by
  being **older** (status `implemented` vs the branch's `impl_reviewed`, and missing
  `reviews/impl-review.md` and `follow-ups/`).
- **2026-08-24** — **Integration branch cut:**
  `run/2026-08-24-followups-and-remember-me` from `matmaverse-v2` @ `282d264`. Merged
  `--no-ff` in the binding order: F1 @ `8fc70f0` -> merge commit `0a15b01`, then F2 @
  `ead0d92` -> merge commit `0b04bec`. **Zero conflicts on either merge**, exactly as
  `ownership.md` §2 predicted. `4f8271b` adds one further commit —
  `docs(reference): register seedShiftWeek as a shift_log writer` (AD-2, below). Not
  pushed, no PR, `main` untouched at `4cc2c1d`.
- **2026-08-24** — **Merge-only defect hunt: NONE FOUND**, reported as a positive
  finding rather than as silence. Eight named checks were run on the merged tree —
  the F2 `setAll` seam against F1's seeder and `signInViaUI`; L-007 in both directions
  on the merged dictionary (347 distinct values, 0/0 both ways); the 712px nav bar
  (`items` = 5, `tabs` = 6, unchanged); `AppShell.astro` net-zero (`git diff` empty);
  `maxAge` absent from `AUTH_COOKIE_OPTIONS`; `prerender = false` on all three touched
  API routes; the "Nie pamietasz hasla?" duplicate-string hazard (0 in `signin.astro`,
  rendered once from the component); and no migration / `src/types.ts` untouched. One
  **latent, not active** item: F1's own FU-R1 notes that
  `e2e/parent-weekly-report.spec.ts` Risk E2E-3 asserts `getByText("9", {exact:true})`
  page-wide; F2 adds nothing to `/app/report`, so it collides with nothing today.
- **2026-08-24** — **All five suites run twice** — on the merge result `0b04bec` and
  again on the final commit `4f8271b` (AD-4) — in the main checkout, sandbox disabled,
  Supabase up on `127.0.0.1:54321`. **All green on `4f8271b`**, every figure landing on
  its predicted `baseline + delta` with no unexplained residue. Table below.
- **2026-08-24** — Maintainer handoff written to
  `context/runs/2026-08-24-followups-and-remember-me/handoff.md`; it stands alone and
  needs no transcript. The run folder was never `git add`-ed and remains untracked, as
  required.

## Environment traps hit in this run

> Anything that cost time and did not look like what it was. Durable ones go to
> `.claude/skills/10x-autonomous-run/references/concurrency.md`; run-specific ones
> stay here.

- **A backgrounded workflow does not survive a session boundary in this setup.** The
  run was checkpointed and then refused re-adoption, which surfaces as a `failed`
  task notification rather than as a crash. The recovery is `resumeFromRunId`, and it
  is cheap — but the orchestrator must check disk before assuming loss, because the
  notification says nothing about what completed.
- `npx supabase status` reports three services stopped (`imgproxy`, `edge_runtime`,
  `pooler`). The API, DB and Studio are up and the baseline suites are green, so this
  is not a blocker — but an agent that needs an Edge Function will find it missing.
- **DURABLE — `worktree-bootstrap.sh` symlinks `node_modules` instead of installing
  it, and that is not enough.** Vite's `server.fs.allow` refuses to serve *through* the
  symlink, so **every island silently fails to hydrate** and every authenticated
  Playwright spec times out in a way that looks exactly like a product bug. **Both**
  feature agents hit it independently. The script's canary only collects **unit** tests
  and therefore cannot see it, reporting a healthy bootstrap. Compounding detail:
  `.gitignore` carries `node_modules/` with a trailing slash, which does **not** match a
  symlink. **Fix the script before the next run.** *Moved to
  `.claude/skills/10x-autonomous-run/references/concurrency.md` §3, where it corrects
  the standing "a symlink is enough" claim — that claim rested on a Vitest collection
  count, which never covered the dev server at all.*
- **Run-specific — untracked change folders block an integration merge.** The docs lane
  writes `context/changes/<id>/` into the main checkout while the code lane commits its
  own copy on the branch; the merge then refuses on "untracked working tree files would
  be overwritten". Cheap to resolve (back up, move aside, merge, compare), but it stops
  integration dead if you meet it unprepared. Recorded here rather than in
  `concurrency.md` because it is a property of how *this* run's two lanes were
  sequenced, not of concurrency in general.

## Process defects found at close (orchestrator, verifying artifacts not claims)

1. **Neither `impl-review.md` carries the `^MERGE:` gate line.** §8 of the process makes
   the merge gate a *machine-readable line at the end of the review artifact*, and the
   skill's own Step 5 check is `grep -l '^MERGE:' context/changes/*/reviews/impl-review.md`
   — that command returns **nothing** for this run. The verdict is not lost (it appears in
   both `handoff.md` files, in F1's `follow-ups/review-fixes.md`, and in the run handoff),
   so the gate was *decided* correctly; it simply was not *written where the gate lives*.
   Effect this run: none — I confirmed CLEAR/CLEAR by hand. Effect next run: the documented
   verification command silently reports zero mergeable branches. **Fix the impl-review step
   to emit the literal line, don't relax the check.**
2. **`worktree-bootstrap.sh` symlinks `node_modules` instead of installing it.** Surfaced
   inside F2's handoff as a defect that will bite *the next run's first worktree*: Vite's
   `server.fs.allow` refuses to serve through the symlink, and the script's vitest-only
   canary cannot detect it (vitest does not go through that path, Playwright does). Also
   `.gitignore` has `node_modules/` with a trailing slash, which does not match a symlink.
   Not a defect of anything this run shipped.

## Decisions the orchestrator made

> Cross-feature calls no single agent could see. Each with a reversal condition.

- **Closing verification was re-run by hand on `4f8271b`, not inherited from the pipeline's
  report** (§7.4, observed-not-remembered). lint clean · check 0 errors / 0 warnings / 8 hints
  (191 files) · `npm test` **443 / 53 files** · `npx playwright test` **26 passed**. Every
  figure matches the reported arithmetic exactly: 429+4+10=443, 51+0+2=53, 23+3+0=26, 9-1=8.

- **F1 before F2 in stack order.** F1 is pure verification debt with no migration and
  no product decision; F2 carries an open session-policy decision that may close it as
  a non-goal. Ordering F1 first means the cheap, certain value lands even if F2 is
  dropped. *Reversal: if the sweep finds F2 owns a file F1 must edit, the sweep's DAG
  wins — it reads both plans and this note does not.*
- **A3 may legitimately produce no code.** The backlog says so explicitly. A plan that
  concludes "documented non-goal" and closes the entry is a **success**, not a dropped
  feature, and must be reported as such. *Reversal: if the planner finds a concrete,
  honest session-lifetime change Supabase supports, it ships as normal.*
- **AD-1 — move the untracked change folders aside rather than merge over them.**
  Backed up to `$TMPDIR/preint-backup/` and verified lossless before cutting the
  integration branch; the branch copies were strictly the later state. *Reversal: if a
  backup had differed from its branch copy in any direction other than "older", the
  merge would have stopped for a human.*
- **AD-2 — actioned exactly one deferred follow-up at integration.** F1's impl-review
  left `## public.shift_log`'s *Consumed by* line in
  `docs/reference/contract-surfaces.md` without `seedShiftWeek`, recording that it was
  "left alone this run because the file is contended; worth a one-line append **after
  F2 integrates**". F2 has now integrated, so the stated precondition fired — and
  integration is the only step that *could* fire it. Commit `4f8271b` appends it,
  noting the 12:00Z Warsaw/DST pinning and the explicit `earned` (a null there flips
  `earningsKnown` to false and silently suppresses the parent's earnings tile).
  Rationale for acting rather than carrying: nothing in `src/`, `tests/`, `e2e/` or CI
  reads that file, so an omission fails silently and permanently. *Scope limit /
  reversal: I would NOT have touched it for any item whose deferral was not explicitly
  conditioned on the other feature integrating. No other follow-up was actioned.*
- **AD-3 — `--no-ff` on both merges.** Both would otherwise have fast-forwarded and
  flattened the run's two strands into one indistinguishable line, hiding the binding
  merge order. *Reversal: none sought; the history is the artifact.*
- **AD-4 — re-ran the entire suite after the one-line docs commit** rather than
  reasoning that Markdown cannot affect it. The verification table should describe the
  commit that ships, not its parent.
- **AD-5 — reported "no merge-only defect" as a positive finding** backed by eight
  named checks, so the absence is auditable. Green suites alone are weak evidence;
  §8 of `concurrency.md` exists because the merge is where cross-feature bugs appear.

## Environment note for every code-lane agent

`assets/` is gitignored and will **not** exist in a bootstrapped worktree. F2's
mockup reference is therefore unavailable to the implementing agent — per
`CLAUDE.md`, it must not guess the layout; the checkbox is one control on an existing
form and the *behaviour* is what this entry is about.

## Landed (2026-08-24)

The run is closed. `run/2026-08-24-followups-and-remember-me` @ `4f8271b` was
**fast-forwarded onto `matmaverse-v2`** — no merge commit was needed, and the
resulting tree hash is byte-identical to the commit whose suites were measured
green, so that verification carries over rather than being re-asserted.

- `matmaverse-v2` now at `210c54f`; `main` still untouched at `4cc2c1d`. Nothing pushed, no PR.
- Both change folders archived under `context/archive/2026-08-24-*` with `git mv`
  (history follows) and stamped `status: archived` / `archived_at: 2026-08-24`.
- Backlog closed out: `## Ready` is now **empty**, and both entries moved to a new
  `## Shipped` section carrying what landed and what each left open. **No entry in
  the backlog can feed an autonomous run today** — everything remaining needs
  `/10x-shape` → `/10x-prd` first.
- Both run worktrees removed; `git worktree list` is back to the main checkout alone.
- Re-verified after the archive commit: lint clean, **443 tests / 53 files**.

Still open, both needing a human and neither a defect:
1. F1's four `#### Manual` Progress rows (screen reader): 1.7, 1.8, 2.5, 6.6.
2. F2's **RF-1** session-policy question — see the archived handoff §5.

One unrelated leftover found while cleaning: `.claude/worktrees/agent-ab6940ebc43c8e6e6`,
526 MB, orphaned from the **previous** run — its `.git/worktrees/` entry is already
gone, so git cannot see it. Verified to hold nothing unique (its only file absent
from the current tree is `tests/shop-art-slots.test.ts`, the pre-rename copy of a
file F1 renamed to `.tsx`). Left in place for the maintainer to delete.

## Toolchain fixes applied after the run (2026-08-24)

Four defects this run exposed, fixed and self-tested. **All four files are under
`.claude/`, which is gitignored — these changes are local to this machine and will
not survive a fresh clone.** That is the known, accepted limitation in §10a, not an
oversight. Backup of the pre-change files: `/tmp/claude-501/skill-backup-4f8271b/`.

1. **The merge gate now gates.** `pipeline.workflow.js` used to `log()` a warning when
   the impl-review verifier failed and then merge on the reviewer's self-report. Both
   gates returned `pass: false` this run and both branches merged anyway. It now
   re-dispatches once to write the missing line, and forces `merge: BLOCKED` if the
   artifact still does not back the claim. `blocked` already excludes such branches
   from integration, so the whole chain now behaves as §8 always described.
2. **`RETHINK` is now enforced.** `gated()` discarded each step's report, so plan-review's
   `verdict` was computed and thrown away — a RETHINK plan would have gone straight to an
   implementer. `gated()` now returns the report and plan-review halts the feature.
3. **Drop reasons reach the return value.** `log()` is invisible to the orchestrator by
   design, so any reason living only in a log line did not exist. `dropped` and `blocked`
   now carry a `reason`, and each built feature carries `gateVerified`.
4. **`/10x-impl-review` emits the gate line, and its rubric is severity-based.** The
   `MERGE:` line existed only in the pipeline prompt, where it competed with the skill's
   own report template and lost. It is now part of that template. The "≤2 warnings"
   count rubric — overridden by hand in both of the last two runs — is now "does this
   warning change shipped behaviour?".
5. **`worktree-bootstrap.sh` provisions a real `node_modules`.** It symlinked, which is
   exactly the failure it existed to prevent; both worktrees this run had to be fixed by
   hand. It now uses APFS copy-on-write (`cp -Rc`), falling back to `npm ci`. **Measured:
   542 MB logical, 1 MB physical, ~26 s.** The disk argument for the symlink does not hold.

**The canary was decorative and had to be fixed twice** — see **L-009**, added to
`references/lessons-addendum.md`. The first replacement asked "does `astro` resolve from
inside the worktree?" and passed on a completely **empty** `node_modules`, because Node
walks *up* the tree and worktrees sit under the repo root. The same upward walk had been
fooling the original `vitest list` count canary all along: main and worktree both
collected 444 tests with nothing installed locally. **Two runs shipped on a bootstrap
check that validated nothing about the thing it was written to validate.** It was caught
only by deliberately breaking it (L-004) and noticing it stayed green. The check now
compares the *resolved absolute path* against the worktree.

Self-tested, all three cases observed rather than assumed:

| case | expected | observed |
|---|---|---|
| clean worktree | pass | `CANARY PASS` — resolves inside the worktree, 444/444 collected, exit 0 |
| empty `node_modules` | **fail** | `CANARY FAIL` naming the parent path it wrongly resolved to, exit 1 |
| symlinked `node_modules` | repaired, then pass | `removing symlinked node_modules` → cloned → `CANARY PASS`, exit 0 |

Self-test worktrees were removed; `git worktree list` is back to the two feature
worktrees from the run.

---

# RUN COMPLETE — 2026-08-24

| Feature | Branch | Own commits | Migration | Merge verdict |
|---|---|---|---|---|
| F1 `autonomous-run-follow-ups` (backlog H1) | `feat/autonomous-run-follow-ups` @ `8fc70f0` | 10 | none | **CLEAR** — merged, 0 conflicts (impl-review **APPROVED**, 0 critical / 2 warnings) |
| F2 `remember-me-on-login` (backlog A3) | `feat/remember-me-on-login` @ `ead0d92` | 5 | none | **CLEAR** — merged, 0 conflicts (impl-review **APPROVED**, 0 critical / 3 warnings) |

**Every feature that entered the run is accounted for: 2 built, 0 blocked, 0 dropped in
the docs lane, 0 halted in the code lane. Nothing was excluded.** Neither feature wrote
a migration — `git diff matmaverse-v2 -- supabase/` is empty.

Merge order — **not optional**:

1. `feat/autonomous-run-follow-ups` (F1, backlog H1) @ `8fc70f0` -> merge commit
   `0a15b01`, `--no-ff`, 10 own commits, **0 conflicts**.
2. `feat/remember-me-on-login` (F2, backlog A3) @ `ead0d92` -> merge commit `0b04bec`,
   `--no-ff`, 5 own commits, **0 conflicts**.
3. `4f8271b docs(reference): register seedShiftWeek as a shift_log writer` — one
   deferred F1 follow-up whose stated precondition ("after F2 integrates") fired at this
   step. Rationale in **AD-2** above.

Integration branch: `run/2026-08-24-followups-and-remember-me` @ `4f8271b`, cut from
`matmaverse-v2` @ `282d264`. **Not pushed, no PR, `main` untouched at `4cc2c1d`.**

**Conflicts: NONE.** Git reported zero on either merge, exactly as `ownership.md` §2
predicted. The two contended files were three-way-merged silently and carry **both**
sides:

- `src/i18n/pl.ts` — F2's `auth.signin.rememberLabel` (line 21) and F1's
  `growth.noNextUpgrade` (line 346) are ~325 lines apart in different objects. Merged
  file is **+2 vs base**, one line per feature.
- `docs/reference/contract-surfaces.md` — F1 appended one bullet inside
  `## Parent PIN routes (RLS surface)`; F2 appended a new
  `## Auth cookie lifetime (session-policy surface)` at EOF, with ~22 lines of untouched
  context between them (more than the 3-line default diff context). Merged file is
  **+17** (F1's 1 + F2's 16); all 8 H2 sections intact; neither feature's section edited
  by the other. **No `--ours` / `--theirs` was used anywhere.**

*Proof nothing was dropped:* for every non-docs file either branch touched,
`git diff <branch> HEAD -- <file>` is **empty** — byte-identical to the branch. The only
two files that differ from their branch are the two above, because each now also holds
the other feature's addition. That is the exact signature of a correct keep-both-sides
merge.

## Verification on the integration branch

All five commands run **twice** — on the merge result `0b04bec` and again on the final
commit `4f8271b` (AD-4) — in the main checkout, sandbox disabled, Supabase up on
`127.0.0.1:54321`. **ALL GREEN on `4f8271b`.**

| command | observed | base `282d264` | F1 | F2 | expected | ok |
|---|---|---|---|---|---|---|
| `npm run lint` | clean | clean | 0 | 0 | clean | yes |
| `npm run check` | 0 errors, 0 warnings, **8 hints** (191 files) | 0/0/9 (188 files) | -1 hint, +0 files | 0 hints, +3 files | 8 / 191 | yes |
| `npm test` | **443 passed** / 53 files (37.3s) | 429 / 51 | +4 tests, +0 files | +10 tests, +2 files | 443 / 53 | yes |
| `npm run build` | Complete (Vercel adapter) | ok | — | — | ok | yes |
| `npx playwright test` | **26 passed** / 8 files (29.2s) | 23 runs | +3 runs | +0 runs | 26 | yes |

**Arithmetic — every figure lands on its predicted value, no rounding, no residue:**

- **Unit tests** 429 + 4 + 10 = **443**. F1's 4 = `it()` blocks in
  `worlds-picker.test.tsx` (2), `shop-art-slots.test.tsx` (1),
  `weekly-report-tiles.test.tsx` (1). F2's 10 = its two new files,
  `remember-me-cookie.test.ts` (7 route-level) + `signin-form.test.tsx` (3).
- **Unit test files** 51 + 0 + 2 = **53**. F1 adds no test file:
  `tests/nav-labels.test.ts` already existed and was only edited, and
  `shop-art-slots.test.ts` -> `.tsx` is a rename (net zero).
- **E2E** 23 + 3 + 0 = **26 RUNS**. F1 adds two `test()` calls; `growth.spec.ts`'s runs
  in both projects (`playwright.config.ts`'s `touch` `testMatch`
  `/(gameplay-restore|growth)\.spec\.ts/`), `parent-weekly-report.spec.ts`'s is
  desktop-only -> 2 + 1 = 3. F2 adds and edits no spec; its e2e contribution is a
  regression gate, not a delta. `npx playwright test --list` independently confirms
  "Total: 26 tests in 8 files". **For the next contract:** the repo has 8 spec files, 19
  `test()` calls, **26 RUNS** — "N specs" has meant runs all along (this settles CPD-3).
- **`check` file count** 188 + 0 + 3 = **191**. The 3 are F2's
  `src/lib/services/remember-me.ts`, `tests/remember-me-cookie.test.ts`,
  `tests/signin-form.test.tsx`. `tsconfig` `include` is `["**/*"]`, so `tests/` and
  `e2e/` are type-checked too.
- **`check` hints** 9 - 1 = **8**. The -1 is entirely F1's dead `import React` dropped
  from `src/components/parent/WeeklyActivityChart.tsx` — predicted to the number by F1's
  own impl-review. The remaining 8 are pre-existing unused-symbol warnings in
  `src/pages/app.astro`, `child/SelectTile.tsx` and `parent/WeeklyReport.tsx`, none
  touched this run.

## Open — what a human still owns

Full checklist in `handoff.md`; this is the index.

**Needs a decision:**

- **F2 RF-1 — a real product decision.** `POST /api/auth/signup`,
  `GET /api/auth/confirm` (email verification **and** password recovery) and
  `POST /api/auth/update-password` all establish a session through `setAll` and none has
  a checkbox, so each now yields a **browser-session cookie** where it previously
  yielded 400 days: a parent who verifies their email or completes a password reset is
  signed out when the browser closes. Deliberate and documented, but **untested**, on a
  surface whose registered hazard is that every failure is silent. If unacceptable, the
  reversal is one call to `setRememberChoice(cookies, true)` **in the route concerned** —
  never a special case inside `setAll`, which cannot tell which route it is serving.
  Either way, **pin the chosen behaviour with a test.**

**Needs eyes and hands:**

- Four `#### Manual Progress` rows in F1's plan (1.7, 1.8, 2.5, 6.6) need a screen
  reader and eyes on `/app/growth` and `/app/report`. Checklist in
  `context/changes/autonomous-run-follow-ups/handoff.md` §5.
- F2's manual rows cover the rendered sign-in layout. `assets/` is gitignored and did
  not exist in the worktree, so the implementer could not see mockup
  `01-parent-login-*`. It did **not** guess a layout (the checkbox is one control added
  to an existing form), but the visual result is unverified against the design.

**Tooling — fix before the next run:** the `node_modules` symlink defect, in
*Environment traps* above and now in `concurrency.md` §3.

**Cheap / mechanical, left deliberately:** F1 FU-R1 (scope Risk E2E-3's total to the
`t.report.statTasks` tile instead of a page-wide `getByText("9")`); F1 FU-R2 (one clause
missing from `LIVE_E2E_STRINGS`' doc-comment in `tests/nav-labels.test.ts` — only
NON-EXACT locators need registering); F1 carried-forward (the `"error" in result` branch
of `src/pages/api/profiles/world.ts` has no automated proof its `console.error` fires,
plan D3 accepted; `seedShiftWeek` indexes `keys[weekday]` unguarded — ergonomics only,
it throws either way).

**Observations, no action expected:** F2 O1 — `src/lib/supabase.ts` imports
`authCookieMaxAge` from `src/lib/services/remember-me.ts`, inverting the usual layer
direction; no cycle today, it becomes one the moment a service needs `createClient`.
F2 O2 — the remembered window does not slide: `REMEMBER_ME_MAX_AGE_SECONDS` is fixed at
sign-in, so a parent continuously active past 30 days is downgraded to a session cookie
once (accepted as its AD-4).
