# Handoff — `autonomous-run-follow-ups` (feature F1)

The `/10x-impl-review` step wrote this. The branch is **implemented, independently
re-verified and cleared to merge**: 0 critical, 2 warnings, 3 observations, every suite
green, every claimed number reconciled arithmetically against a baseline this step measured
itself. The one thing the next agent must not get wrong: **this worktree's `node_modules`
must stay a real directory, never the bootstrap script's symlink** — Vite refuses to serve
through it, so no island hydrates and every authenticated Playwright spec dies on a 30 s
timeout that reads exactly like a product bug. It is already a real directory here; do not
re-bootstrap over it. No merge order binds — `ownership.md` §2 puts F1 and F2 in separate
one-branch stacks, both cut from `matmaverse-v2` @ `282d264`.

## 1. State

| | |
|---|---|
| Branch | `feat/autonomous-run-follow-ups` |
| Cut from | `matmaverse-v2` @ `282d264` (**not** stacked) |
| Position in stack | F1 of 2, independent; merges any time |
| Commits / range | `282d264..HEAD` — seven phase commits `915bd85`…`c187b17`, two implement-epilogue commits (`20a1e96`, `1ff6dd3`), plus this review's commit |
| Pushed? | **no** |
| `change.md` status | `implemented` → **`impl_reviewed`** |
| `## Progress` rows remaining | **4** (`grep -c '^- \[ \]' plan.md`, re-run in this step) — all `#### Manual`, all device-dependent; see §5 |
| Working tree | clean apart from untracked `.e2e-port` (bootstrap output, never staged) |

Every deliberate break this step re-executed was restored and `git status --short` was
re-checked after each one; the tree carried no residue into the review commit.

## 2. Artifacts

| path | what it is |
|---|---|
| `context/changes/autonomous-run-follow-ups/reviews/impl-review.md` | the full review — verdicts table, the re-measured baseline arithmetic, the five re-executed breaks, the live-DB check, and findings F1–F5 |
| `context/changes/autonomous-run-follow-ups/follow-ups/review-fixes.md` | **new.** FU-R1 and FU-R2 (the two warnings), plus the four items carried forward from the implement step |
| `context/changes/autonomous-run-follow-ups/change.md` | **edited, one line.** `status: implemented` → `impl_reviewed` |
| `context/changes/autonomous-run-follow-ups/handoff.md` | this file (rewritten) |

**No source file was changed by this step.** There was no CRITICAL finding, so the triage
rule "CRITICAL → fix in code" never fired. `git diff 282d264..HEAD -- src/ tests/ e2e/ docs/`
is byte-identical to what the implement step committed.

## 3. Verification

**Both baselines were measured in this step**, in a throwaway detached worktree at the base
commit (`git worktree add --detach /tmp/claude/f1-baseline 282d264`), with the sandbox
disabled and `npx supabase status` reporting the API up on `127.0.0.1:54321`. The
implementer's figures were **not** accepted; they were reproduced.

| command | result |
|---|---|
| `npm test` (branch) | **433 passed / 51 files** (baseline **429 / 51**, measured here, **+4**) |
| `E2E_PORT=4330 npx playwright test` (branch) | **26 passed / 8 files** (baseline **23 runs**, measured here via `--list`, **+3**) |
| `npm run lint` (branch) | clean (baseline clean) |
| `npm run check` (branch) | **0 errors, 0 warnings, 8 hints** (baseline 0 / 0 / **9** — the −1 is the dead `import React` dropped from `WeeklyActivityChart.tsx`) |
| `git diff --stat 282d264..HEAD -- supabase/` | **empty** — no migration, as `ownership.md` §4 requires |

**The arithmetic, shown rather than asserted.** `git diff 282d264..HEAD -- tests/ e2e/`
adds exactly six test blocks: four `it()` (`tests/worlds-picker.test.tsx` ×2,
`tests/shop-art-slots.test.tsx` ×1, `tests/weekly-report-tiles.test.tsx` ×1) → 429 + 4 = 433;
and two `test()`, of which `e2e/growth.spec.ts`'s runs in **both** projects (`playwright.config.ts`'s
`touch` `testMatch: /(gameplay-restore|growth)\.spec\.ts/`) while `e2e/parent-weekly-report.spec.ts`'s
is desktop-only → 2 + 1 = 3 → 23 + 3 = 26. Both totals reconcile with no rounding.

### Deliberate breaks re-executed in this step — each restored, each meta-checked (L-004)

| break | went red | why that redness is evidence |
|---|---|---|
| Removed `role="img"` from `StageRail`'s three markers | Risk E2E-F4-1, **both** projects, `toHaveCount` "unexpected value 0" | The assertion resolves through the a11y tree — the exact surface the role removes. The other five `growth.spec.ts` runs stayed green, so the redness is isolated to the a11y claim, not to the page |
| Deleted `WorldPicker`'s `<form>`, keeping every child | 3 red / 6 passed in `tests/worlds-picker.test.tsx` | **Meta-check reproduced: the pre-phase test file (`git show 282d264:tests/worlds-picker.test.tsx`) run against the same broken component passes 7/7.** FU-1's original defect reproduced from scratch and confirmed genuinely closed |
| Repointed `WeeklyReport`'s `tasksThisWeek` at `upgrades.length` | `tests/weekly-report-tiles.test.tsx`, on the **tile-vs-bars comparison**, not the `toBe(9)` anchor | The 12 other tests across the two files stayed green — the pre-existing `EMPTY_WEEK` fixtures really were blind, and the redness lands on the decomposition, which is what AD-I4 claimed it strengthened |
| Dropped `WORLD_SLOTS[world.slug]?.` from `ShopArt`'s badge `style` | the new render case only | The four data `it()` blocks stayed green — confirming `unplaced` is invariant and only the inline style moves |
| Inverted the discriminant to `if (!("error" in result))`, log body neutralised | `tests/profiles-world.test.ts` own-profile test, on `Location`: received `"/app/worlds"`, expected `"/app/start"` | Confirms AD-I5 exactly: written literally the break reddens through a `TypeError` inside the log call; neutralised, it lands on the contracted redirect |

### Live-database check (Phase 7 asserts DB behaviour, so the file was not enough)

`select prosrc from pg_proc where proname='register_pin_failure'` on the running stack returns
`set failed_attempts = s.failed_attempts + 1, locked_until = case when s.failed_attempts + 1 >= p_max then now() + … end`
— increment-only, nothing decays it, and re-locking on the next single failure once the
threshold is passed. `src/lib/services/parent-pin.ts` writes `failed_attempts: 0` in exactly
two places (`setPin` and the correct-PIN path) and `LOCKOUT_MS` is `60_000`. **K1 as
documented is true against the live database, not merely against the migration file.**

### Predecessor claims checked rather than inherited

- **`src/components/app/AppShell.astro` and `src/components/child/ShopArt.tsx` are absent from
  `git diff --stat 282d264..HEAD`** — the net-zero constraint `ownership.md` places on F1 holds,
  verified against git objects.
- **L-007 re-run on this branch:** `growth.noNextUpgrade` checked in both directions against all
  **342** distinct ≥4-char double-quoted values in `src/i18n/pl.ts` — zero substrings, zero
  superstrings, exactly one occurrence.
- **Logging convention:** `src/pages/api/profiles/world.ts` matches `src/pages/api/auth/reset.ts`
  in shape and in its `// eslint-disable-next-line no-console` (required by
  `eslint.config.js`'s `"no-console": "warn"`). No logger module; no `profileId`, no theme.
- Of the implementer's claims re-tested here, **all held. None was false** — unlike the source
  run, where 1 of 14 was.

## 4. Next command

`none — ready to merge` (integration may proceed; the two warnings are follow-ups, not gates)

## 5. Open

- **FU-R1 (warning) — `e2e/parent-weekly-report.spec.ts`, the test
  `a seeded non-zero week renders live bars whose total matches the tasks tile (Risk E2E-3)`,
  its `page.getByText("9", { exact: true })` expectation.** It asserts one element *anywhere on
  the page* reads `"9"` and never joins it to the tile, where the plan contracted "the
  `statTasks` tile shows the seeded total". It **does** bite the plan's own break (re-verified
  red here), so it is not a false green — but it is weaker than contracted and brittle in the
  L-007 way. Fix in `follow-ups/review-fixes.md`.
- **FU-R2 (warning) — `tests/nav-labels.test.ts`, the `LIVE_E2E_STRINGS` const.** The new
  `getByText(t.growth.noNextUpgrade)` locator was not registered. Correct, because it passes
  `{ exact: true }` while both registered strings use non-exact `getByText` — but the exemption
  is unwritten. One clause in the doc-comment.
- **CROSS-PLAN, reported not edited — `context/changes/remember-me-on-login/plan.md`, the
  ownership paragraph naming `docs/reference/contract-surfaces.md`'s
  `## Parent PIN routes (RLS surface)` and `## set_updated_at()` sections.** It pins line
  numbers (58 / 69 / 90). F1's Phase 7 append has already shifted them — on this branch
  `## Account deletion` is at **70** and the file is **91** lines. L-006 with a live trigger.
  Not blocking: the same paragraph also describes the target semantically ("the file's last
  section, appended after `## set_updated_at()`"), so prose-following lands correctly. F1 may
  not write F2's change folder, so F2's next step must re-anchor it.
- **Four `#### Manual` Progress rows remain unticked** and need a human — `1.7` (the empty
  next-upgrade card reads as a finished thought), `1.8` (VoiceOver/NVDA announces "Etap 1".."Etap 4"),
  `2.5` (a screen reader names the competency list at 712 px), `6.6` (drawn `<svg>` bar heights
  match the seeded counts). Automated cover exists for the *observable* half of `1.7`, `1.8`
  and `2.5`; what no agent can perform is what is *spoken* and what *looks* finished.
- **Row `5.5` is ticked but its criterion names the browser** (observation F3). The implement
  step performed it at the route layer instead, and says so. The `"error" in result` branch of
  `src/pages/api/profiles/world.ts` still ships with no automated proof its log line fires
  (plan D3, accepted).
- **`e2e/helpers/accounts.ts` → `seedShiftWeek`** indexes `keys[weekday]` unguarded (observation
  F4) and is the first `e2e/` → `src/lib/services/` import in the repo (`weekDayKeys` from
  `../../src/lib/services/reports`, relative because `e2e/` has no `@/` alias). If `reports.ts`
  ever grows a server-only import, the Playwright workers break; today it is pure `Intl`.
- **`docs/reference/contract-surfaces.md` → `## public.shift_log`'s *Consumed by* line** still
  does not mention `seedShiftWeek` (plan observation O1). One-line append after F2 integrates.
- **Phase 1's `next === null` layout stays an explicit extrapolation** — the `/app/growth`
  mockup depicts no empty state and `assets/` is gitignored, so CI and a fresh clone cannot
  re-check it.

## 6. Autonomous decisions

`/10x-impl-review` calls `AskUserQuestion` twice per run (the post-report "how would you like
to proceed" gate, then once per finding during triage). All were decided here.

- **AD-R1 — Ran the review from a fresh detached worktree for the baseline rather than trusting
  the handoff's `429 / 23`.** *Chosen:* `git worktree add --detach /tmp/claude/f1-baseline
  282d264`, symlink `node_modules`, and re-measure both suites, then reconcile the deltas
  against a `grep` of the diff's added `it(`/`test(` blocks. *Rejected:* accepting the
  handoff's baseline, which agent-contract rule 5 forbids; *also rejected:* deriving the
  baseline by subtraction from the branch's own numbers, which is circular — it proves the
  implementer's arithmetic self-consistent, not correct. **What would change the answer:** if
  the base commit ever becomes expensive to check out (a native rebuild, a schema migration),
  fall back to counting added test blocks in the diff and say plainly that the baseline was
  derived, not observed.
- **AD-R2 — Triaged both warnings to `follow-ups/review-fixes.md` and merged CLEAR, instead of
  fixing them on this branch.** *Chosen:* the run brief's triage rule (CRITICAL → fix in code,
  WARNING → follow-ups) applied literally. Neither warning is a defect in shipped behaviour:
  FU-R1's assertion demonstrably reddens on the break it exists for, and FU-R2 is a comment.
  *Rejected:* fixing FU-R1 here — it would add an unreviewed edit to a green branch at the last
  gate, and the review that would have caught a mistake in it is the one making it.
  **What would change the answer:** if FU-R1's assertion had stayed **green** under the
  `tasksThisWeek` break, it would have been a false green — CRITICAL, fixed in code, and the
  merge blocked.
- **AD-R3 — Verdict APPROVED and `MERGE: CLEAR`, and the two warnings were not allowed to move
  either.** *Chosen:* gate on the brief's machine rule — BLOCKED iff ≥1 CRITICAL, an unmet
  success criterion, or a red suite. There are none: zero critical, every automated criterion
  re-run and reconciled here, four suites green. *Rejected:* letting a warning count nudge the
  verdict label, which is exactly the failure the brief names — in the source run two branches
  read NEEDS ATTENTION on a "≤2 warnings" rubric while both reviews said in prose the branch was
  mergeable. **What would change the answer:** a CRITICAL, a red suite, or an unmet automated
  criterion. The four pending `#### Manual` rows do **not** qualify — they are device-dependent
  by nature, disclosed, and unperformable by any agent; treating them as unmet criteria would
  make this branch permanently unmergeable in an unattended run.
- **AD-R4 — Reported F2's line-number anchors instead of correcting them.** *Chosen:* record the
  cross-plan defect in this handoff §5 and in the review, leaving F2's file untouched. *Rejected:*
  editing `context/changes/remember-me-on-login/plan.md`, which the agent contract's concurrency
  section forbids outright ("another feature's change folder is not yours — report it"). **What
  would change the answer:** if a contention-sweep step runs again before F2 implements, that
  step owns both folders and should fix it in place.
- **AD-R5 — `needsE2E` reported as false.** *Chosen:* every open risk on this branch is already
  covered by a green spec, and the brief states that a risk covered by a green spec does not
  qualify. The four residual manual rows need a **screen reader and human eyes**, which a browser
  driver cannot supply. *Rejected:* requesting an E2E pass for the `5.5`/D3 logging gap — a
  Playwright run cannot read a server-side `console.error` either, so it would not close it.
  **What would change the answer:** adopting FU-R1 would touch a spec and want one Playwright
  re-run — cheap, and it belongs to whoever takes the follow-up.
