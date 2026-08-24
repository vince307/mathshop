# Handoff — `autonomous-run-follow-ups` (feature F1)

The `/10x-implement` step wrote this. All seven phases are **implemented, verified and
committed on green** on `feat/autonomous-run-follow-ups`, seven commits, nothing pushed. The
one thing the next agent must not get wrong: **this worktree's `node_modules` had to be
replaced with a real directory** — the bootstrap script symlinks it, and Vite refuses to serve
files outside its allow-list through a symlink, so **every island silently fails to hydrate and
every authenticated Playwright spec times out in a way that looks exactly like a product bug**.
The bootstrap canary does not catch this (it only collects unit tests). No merge order binds:
`ownership.md` puts F1 and F2 in separate concurrent stacks, both cut from `matmaverse-v2`.

## 1. State

| | |
|---|---|
| Branch | `feat/autonomous-run-follow-ups` |
| Cut from | `matmaverse-v2` @ `282d264` (**not** stacked — `ownership.md` §2 gives F1 and F2 separate one-branch stacks) |
| Position in stack | F1 of 2, independent; merges any time |
| Commits / range | **7**, `282d264..c187b17` (`915bd85`, `589c638`, `0cf5fb5`, `256bd10`, `ee0a886`, `aebac59`, `c187b17`) — one per plan phase, each on green |
| Pushed? | **no** |
| `change.md` status | `plan_reviewed` → **`implemented`** |
| `## Progress` rows remaining | **4** (`grep -c '^- \[ \]' plan.md`) — all `#### Manual`, all device-dependent; see §5 |
| Working tree | clean apart from untracked `.e2e-port` (bootstrap output, not gitignored — deliberately never staged) and `test-results/` |

Phase 0 is a no-commit phase; its rows `0.1`/`0.2` are ticked without a SHA, which is the
plan's own contract for an empty-diff phase.

## 2. Artifacts

| path | what it is |
|---|---|
| `src/i18n/pl.ts` | **edited, one append.** `growth.noNextUpgrade` added immediately after `noUnlocks`. Append-only; no key moved. |
| `src/pages/app/growth.astro` | **edited.** The `<section>` opening with `<h2>{t.start.nextUpgradeHeading}</h2>` now ternaries `{next ? …card… : <p>{t.growth.noNextUpgrade}</p>}`; the `<a href="/app/upgrades">` CTA stays outside the guard. The savings-bar `<div>` inside the `{savingPercent !== null && (` guard gains `aria-hidden="true"`. |
| `src/components/child/StageRail.astro` | **edited.** `role="img"` added to all three state-marker `<span>`s (the `done`, `current`, `locked` branches) that already carried `aria-label={t.growth.stageOrdinal…}`; the marker comment now describes what the code does. |
| `src/components/child/WorldPicker.tsx` | **edited, one attribute.** `aria-label={t.worlds.learnHeading}` on the competency `<ul>` (the one following the `hidden … lg:block` `<p>`). |
| `src/components/child/ShopArt.tsx` | **not modified** — only broken and restored during Phase 3's deliberate break. `git diff` against the base is empty for this file. |
| `src/components/app/AppShell.astro` | **not modified** — broken twice and restored in Phase 4. Confirmed empty diff before the Phase 4 commit, per `ownership.md`'s explicit requirement. |
| `src/pages/api/profiles/world.ts` | **edited.** New `if ("error" in result)` branch logging `console.error("[profiles/world] updateChildProfileTheme failed", { code, message })` before the unchanged `applyNoStore(context.redirect(WORLDS))`. `export const prerender = false` untouched. |
| `src/components/parent/WeeklyActivityChart.tsx` | **edited, one deletion.** The dead `import React from "react";` removed (`tsconfig.json` sets `"jsx": "react-jsx"`). |
| `tests/worlds-picker.test.tsx` | **edited.** New `pickerForm()` helper; `hiddenInput()` re-rooted at the `<form>`; **+2 `it()` blocks** (form action/method/submit-containment; competency-list accessible name). |
| `tests/shop-art-slots.test.ts` → `tests/shop-art-slots.test.tsx` | **renamed + edited.** `// @vitest-environment jsdom` pragma, four data blocks unchanged, **+1 render case** asserting `piekarnia`'s `sign` badge at `left: 7%` / `top: 10%`. |
| `tests/nav-labels.test.ts` | **edited, header comment only.** States that this suite owns the *dictionary* half and points at `e2e/growth.spec.ts` Risk E2E-F4-2 for the wiring half. No assertion changed. |
| `tests/weekly-report-tiles.test.tsx` | **edited.** `child()` gains an optional `daily` parameter defaulting to `EMPTY_WEEK` (additive); **+1 `it()`** reading the `statTasks` tile figure *and* the sr-only bar list out of the DOM and comparing them to each other. |
| `e2e/helpers/accounts.ts` | **edited, append-only.** `seedShiftWeek` appended after `signInViaUI` at EOF; one new import (`weekDayKeys` from `../../src/lib/services/reports`). **No existing export touched** — `signInViaUI`'s locators are unmoved, which is what F2's read dependency needs. |
| `e2e/growth.spec.ts` | **edited.** New `NAV_HREFS` map (replaces `navLabels`); per-entry `toHaveAttribute("href", …)` folded into Risk E2E-F4-2's existing loop; `getByRole("img", …)` folded into Risk E2E-F4-1; **+1 test** (Risk E2E-F4-3, the empty state); all **three** stale "five entries" mentions corrected to six with the reason the component counts five. |
| `e2e/parent-weekly-report.spec.ts` | **edited.** **+1 desktop test** (Risk E2E-3, seeded non-zero week); the header paragraph that said a seeded-week variant is "deliberately NOT here" replaced with the risk it now covers. |
| `docs/reference/contract-surfaces.md` | **edited, one bullet appended** inside `## Parent PIN routes (RLS surface)`, after its `**Tests:**` line. F2's section untouched. |
| `context/changes/autonomous-run-follow-ups/plan.md` | **edited.** 32 of 36 `## Progress` rows flipped, each carrying its phase's commit SHA. Phase bodies untouched. |
| `context/changes/autonomous-run-follow-ups/change.md` | **edited, two lines.** `status: implemented`, `updated: 2026-08-24`. |
| `context/changes/autonomous-run-follow-ups/handoff.md` | this file (rewritten) |

The whole change folder (`change.md`, `research.md`, `plan.md`, `plan-brief.md`,
`reviews/plan-review.md`) was copied into the worktree and committed in Phase 1 — it existed
only as untracked files in the main checkout. No neighbouring change folder was touched. No
migration was written (`supabase/migrations/` unchanged, as `ownership.md` §4 requires).

## 3. Verification

**Baseline measured on this branch at `282d264` before Phase 1**, with the sandbox disabled and
`npx supabase status` reporting the API up on `127.0.0.1:54321`: **429 unit tests / 51 files**,
**23 Playwright runs / 8 files** (`desktop` 19, `touch` 4), `npm run lint` clean,
`npm run check` 0 errors / 0 warnings / 9 hints. It coincides with the run contract's figure,
but it was re-measured, not inherited.

| command | result |
|---|---|
| `npm test` (final, Phase 7) | **433 passed / 51 files** (baseline 429, **+4**) — Phase 2 +2, Phase 3 +1, Phase 6 +1; Phases 1, 4, 5, 7 +0 as planned |
| `E2E_PORT=4330 npx playwright test` (final, Phase 7) | **26 passed / 8 files** (baseline 23, **+3**) — `growth.spec.ts` +1 test × 2 projects, `parent-weekly-report.spec.ts` +1 desktop-only. The desktop-only asymmetry is `playwright.config.ts`'s `touch` `testMatch: /(gameplay-restore\|growth)\.spec\.ts/`, unchanged. |
| `npm run lint` (final) | clean |
| `npm run check` (final) | 0 errors, 0 warnings, **8 hints** (was 9 — the dropped dead `React` import in `WeeklyActivityChart.tsx`) |

**Worktree infrastructure defect found and fixed — this is the most transferable finding.**
`worktree-bootstrap.sh` symlinks `node_modules` to the main checkout. Vite then refuses every
request under that path (`"The request id … is outside of Vite serving allow list"`), including
`@astrojs/react/dist/client.js`, so **no island hydrates**. Effect: `signInViaUI` fills the
sign-in form, clicks submit, and nothing happens — every authenticated spec dies on a 30 s
timeout that reads as a product bug. All 6 `growth.spec.ts` runs failed this way, *including the
two that predate this change*, which is what identified it as infrastructure. Fixed by
`rm node_modules && cp -Rc <main>/node_modules ./node_modules` (APFS clonefile, ~6 s, 552 MB).
Confirmed by `e2e/smoke.spec.ts`: 3/4 → 4/4, the one failure being exactly the sign-in test.
The bootstrap canary cannot catch this — it only counts collected unit tests, which the symlink
does not affect. **A separate lint gotcha:** `npm run lint` reports 55 false errors in a fresh
worktree until `npm run check` (i.e. `astro sync`) has generated `.astro/types.d.ts`. Run
`check` before `lint` on a new worktree.

### Deliberate breaks — each run, meta-checked, restored

| phase | break | went red | why that redness is evidence (L-004) |
|---|---|---|---|
| 1A | removed `role="img"` from `StageRail`'s three markers | Risk E2E-F4-1, **both** projects | The assertion resolves through the a11y tree, the exact surface the missing role removed. The `aria-label` text is still in the DOM, so no text- or attribute-based assertion could see it. Nothing renders the literal "Etap 1" — only the label — so `getByText` would be red in *both* states and certify nothing. |
| 1B | reverted to `{next && (…)}` | Risk E2E-F4-3, both projects | Failed on the `noNextUpgrade` sentence. **Meta-checked against the failure snapshot:** `Zobacz ulepszenia` was still present on the page, so the redness isolates the missing sentence rather than a collapsed section. |
| 2A | deleted the `<form>` element, keeping every child | 3 tests | **Meta-checked by running the pre-phase test file against the broken component: 7/7 green.** That is the defect FU-1 reported, reproduced — the picker was completely inert and the suite said nothing. |
| 2B | removed the `<ul>`'s `aria-label` | 1 test | The existing `getByText(t.worlds.learnHeading)` assertion stayed **green** (8 passed), proving only a role+name query can observe the loss — the same thing a screen reader below `lg` sees. |
| 3 | dropped `WORLD_SLOTS[world.slug]?.` from `ShopArt`'s badge `style` | the new render case only | The four pre-existing data assertions stayed **green**, and the badge-count assertion also passed — confirming the plan's warning that `unplaced` is invariant and that any partition- or count-based assertion would certify nothing. Only the inline `style` moves. |
| 4 | repointed `worlds` at `/app/start` in `AppShell`'s `items` | Risk E2E-F4-2, both projects | **Meta-checked: the pre-phase spec passed 6/6 against the same break.** Destination was genuinely uncovered before this phase. |
| 4 (meta) | removed the `worlds` entry from `items` entirely | pre-phase spec **already red**, both projects | Confirms FU-3's premise was false at the suite level, which is why `src/data/nav.ts` was not extracted (D6). |
| 5 | inverted the discriminant to `if (!("error" in result))` | `tests/profiles-world.test.ts` own-profile test | **The first attempt was a weaker break than the plan predicted** — it threw a `TypeError` inside the log call before reaching the redirect, proving only that the branch was entered. Re-run with the log body neutralised so the break isolates the contract: then it failed on `expected '/app/worlds' to be '/app/start'`, exactly as planned — the ok path misclassified as the error path. |
| 5 (rejected break, per plan row 5.4) | repointed the `"error"` branch's redirect away from `WORLDS` | **stayed green, 6/6** | Verified empirically rather than asserted. The branch is unreachable in that suite, so this is the textbook decorative break — recorded so nobody re-derives it. |
| 6 | repointed `tasksThisWeek` at `upgrades.length` | the new decomposition test | **Meta-checked: the pre-phase test file passed 8/8 against the same break** — every fixture used `EMPTY_WEEK` and no upgrades, so the tile read 0 either way. **The assertion was also restructured mid-phase:** as first written it failed on a hardcoded `9`, which is two independent value checks that happen to agree; it now reads both the tile figure and the bar list out of the DOM and compares them to each other, plus a `toBe(9)` anchor so a both-sides-collapse cannot satisfy the equality. |
| 6 (seeder) | `created_at` at `22:30Z` instead of `12:00Z` — the time-of-day a naive "today minus N days" UTC recipe carries | Risk E2E-3's per-weekday assertions | **Demonstrable on the run's own date after all** (2026-08-24, machine `Europe/Warsaw`, 14:24 UTC — the two civil dates agree, so the clock alone would not have shown it). Every row drifted one day forward. **The important second-order finding: the week TOTAL stayed 9, so the tile-vs-bars sum assertion stayed green** — a total-only test would have been blind to the exact hazard the plan named, which is why the per-weekday label assertions are in the test. |

**Progress contract re-checked after all edits:** one `## Progress`; zero `- [ ]` outside it;
4 remaining rows all under `#### Manual`.

**L-007 re-run on this branch, not inherited:** `growth.noNextUpgrade` =
`"Masz już wszystkie ulepszenia dostępne na tym etapie."` checked in **both** directions against
all 320 distinct ≥4-char string values in `src/i18n/pl.ts` — **zero collisions**, and the value
appears exactly once. (F2's `rememberLabel` is not on this branch; `ownership.md` §5 already ran
the check with both keys present.)

## 4. Next command

`/10x-impl-review autonomous-run-follow-ups`

## 5. Open

- **Four `#### Manual` Progress rows are genuinely unperformable by an agent and are left
  unticked. Human checklist:**
  1. `1.7` — `/app/growth` with a profile owning `sign` + `shelf` at `business_level` 1: the
     next-upgrade card reads as a finished thought and the shop CTA is still reachable.
     (Automated cover exists: Risk E2E-F4-3 asserts both the sentence and the CTA; what is
     unverified is whether it *looks* finished.)
  2. `1.8` — VoiceOver/NVDA on the stage rail announces "Etap 1".."Etap 4", not bare digits.
     Playwright's `getByRole("img", …)` proves the name is in the a11y tree; only a real screen
     reader proves what is spoken.
  3. `2.5` — at 712 px a screen reader announces the competency list with its heading text.
  4. `6.6` — `/app/report` for a seeded account: the **drawn bar heights** match the seeded
     counts. The e2e test asserts the sr-only list values and the earnings tile's presence; the
     `<svg>` geometry itself is unasserted.
- **Row `7.3` was ticked** — it is a document-comprehension check ("can a reader answer *does
  waiting out the lock reset my attempt budget?* from the document alone"), which is verifiable
  by reading. The appended bullet states it in those words.
- **`src/pages/api/profiles/world.ts`, the `"error" in result` branch, still ships with no
  automated proof its log line fires** (plan D3, unchanged). It was proven **once, by hand**
  during this step: `updateChildProfileTheme` in `src/lib/services/child-profiles.ts` was
  temporarily forced to return `{ error }`, and the real route emitted
  `[profiles/world] updateChildProfileTheme failed { code: 'FORCED', … }` while `Location`
  stayed `/app/worlds` — both halves of the manual step, at the route layer rather than the
  browser. The forcing edit was reverted; nothing guards it going forward.
- **`e2e/helpers/accounts.ts` now imports from `src/lib/services/reports`** (`weekDayKeys`), the
  first `e2e/` → `src/lib/services/` import in the repo. It uses the relative form
  (`../../src/lib/services/reports`) because `e2e/` has no `@/` alias, matching
  `e2e/helpers/i18n.ts`. If `reports.ts` grows a server-only import this breaks the Playwright
  workers; today it is pure `Intl` arithmetic.
- **`seedShiftWeek` is the first test-side writer that sets `shift_log.created_at` explicitly.**
  `docs/reference/contract-surfaces.md` → `## public.shift_log`'s *Consumed by* line does not
  mention it (plan observation O1, left alone deliberately — that line tracks `src/` consumers
  and the file is contended this run). Worth a one-line append after F2 integrates.
- **Phase 1's `next === null` layout remains an explicit extrapolation.** The `/app/growth`
  mockup depicts no empty state and `assets/` is gitignored, so nobody on a fresh clone or in CI
  can re-check it.
- **Not adopted, still open:** the `world.name`-rendered-three-times a11y duplication in
  `growth.astro` (plan D8 refused it — it needs a product call about which copy is canonical and
  it moves text `e2e/growth.spec.ts` locates), and the ~18 other non-blocking items in the five
  archived `follow-ups/review-fixes.md` files.
- **Carried from the plan-review step, still true — F2 `remember-me-on-login`'s Phase 1
  criterion pins the unit baseline inline as "429 / 51 files on `matmaverse-v2` @ `282d264`".**
  That is correct *for F2's own branch*, since `ownership.md` puts it in an independent stack
  cut from the same commit. It becomes wrong the moment F2 rebases onto F1 — this branch's unit
  delta is **+4** and its e2e delta is **+3**. Reported, not edited (F1 may not write F2's
  change folder).

## 6. Autonomous decisions

`/10x-implement` calls `AskUserQuestion` four times per phase — the manual-confirmation gate,
the dirty-path question, commit-message approval, and the between-phase prompt. All were decided
here. The three that were purely procedural (approve every drafted Conventional Commit message
as proposed; continue straight to the next phase without clearing context; stage only the
touched-file set) are recorded once rather than 21 times.

- **AD-I1 — Replaced the worktree's symlinked `node_modules` with a real clone instead of
  editing `astro.config.mjs`.** *Chosen:* `cp -Rc` the main checkout's `node_modules` into the
  worktree (APFS clonefile: 6 s, no extra disk). *Rejected:* adding the main checkout's path to
  `vite.server.fs.allow` in `astro.config.mjs` — that is a tracked, shared config file, the edit
  would have hard-coded one machine's absolute path, and it would have shipped in a commit as a
  permanent change to satisfy a temporary environment problem. *Also rejected:* `npm ci` in the
  worktree (minutes instead of seconds, and it can resolve differently from the main tree).
  **What would change the answer:** if the maintainer wants worktrees to work out of the box,
  the fix belongs in `worktree-bootstrap.sh` (clone rather than symlink, or clone just the paths
  Vite serves) — not in the repo's Astro config.
- **AD-I2 — Ran the whole plan without stopping at the manual-verification gate.** *Chosen:*
  treat automated green as sufficient to commit each phase, and surface the four unperformable
  manual rows as a checklist in §5. *Rejected:* stopping after Phase 1 to wait for a human,
  which is what the skill literally instructs — in a no-human run that stalls the feature
  indefinitely. *Also rejected:* ticking the manual rows anyway, which would have made the plan
  claim screen-reader verification that never happened. **What would change the answer:**
  nothing within this run; a human reviewing the branch should walk §5's four items before merge.
- **AD-I3 — Set `change.md` to `implemented` with four Manual rows still pending.** *Chosen:*
  advance the status, because every phase's code is written, verified and committed on green,
  and the remaining rows need a screen reader or human eyes that no agent has. *Rejected:*
  leaving it at `implementing` — the straggler gate's "Pause" option — which would block
  `/10x-archive` forever on checks the pipeline structurally cannot perform. **What would change
  the answer:** if the maintainer treats `implemented` as asserting *all* Progress rows are
  done, the honest alternative is a separate status (`implemented_pending_manual`); the four
  rows are listed in §5 either way.
- **AD-I4 — Strengthened Phase 6's contracted assertion mid-phase instead of accepting it.**
  The plan contracted "assert (a) the number printed in the `statTasks` tile and (b) that the
  sr-only items sum to the same number". Written literally against the constant `9`, the
  deliberate break did go red — but as two independent value checks that happened to agree, not
  as a decomposition. *Chosen:* read both sides out of the DOM and assert
  `tileValue === barSum`, keeping `toBe(9)` as an anchor. *Rejected:* accepting the literal form
  because the break was red — precisely the trap L-004 names, and the same shape the plan-review
  step caught in Phase 5. **What would change the answer:** nothing; this is strictly stronger
  and the plan's own words ask for "the same number", which the comparison expresses directly.
- **AD-I5 — Replaced Phase 5's break with a sharper variant after meta-checking the first.**
  Inverting the discriminant as written reddens via a `TypeError` inside the new
  `console.error`, which proves the branch is entered but never exercises the redirect.
  *Chosen:* re-run with the log body neutralised so the failure lands on
  `Location: /app/worlds` vs `/app/start` — the contract the plan predicted. *Rejected:*
  reporting the `TypeError` as the contracted redness. Both variants are recorded in §3.
  **What would change the answer:** nothing; the production behaviour under that mistake really
  would be a crash, so both readings are true and the sharper one is the more informative.
- **AD-I6 — Verified Phase 6's date-dependent seeder break by changing the time-of-day rather
  than waiting for a hazardous date.** Plan row `6.5` allowed recording honestly that the break
  may not be demonstrable on the run's own date, and it was not: the machine is `Europe/Warsaw`
  and at 14:24 UTC the UTC and Warsaw civil dates agree. *Chosen:* seed at `22:30Z` — the
  time-of-day a naive "today minus N days" recipe carries when a child plays at 00:30 Warsaw —
  which reproduces the exact drift on today's date. *Rejected:* recording "not demonstrable
  today", which was permitted but weaker, and mocking the clock, which the e2e layer cannot do
  for the database's `created_at`. **What would change the answer:** if the seeder is ever
  changed to derive the time-of-day from `now`, this break becomes clock-dependent again and the
  honest-record fallback applies.
- **AD-I7 — Committed the change folder onto the branch in Phase 1.** It existed only as
  untracked files in the main checkout, so the branch would otherwise carry code with no plan.
  *Rejected:* leaving it untracked (the plan's SHA write-backs would have nowhere to live and
  `/10x-archive`'s uncommitted-paths gate would refuse). `context/runs/` was **not** copied — it
  is the orchestrator's, not this feature's. **What would change the answer:** if the run
  intends change folders to live only in the main checkout, drop that path from the Phase 1
  commit; nothing else in the branch depends on it.
- **AD-I8 — Left `.e2e-port` untracked and unstaged in every commit.** It is bootstrap output
  and is not covered by `.gitignore`. *Chosen:* the dirty-path prompt's "stage only the planned
  set". *Rejected:* committing it (machine-specific) and adding it to `.gitignore` (a tracked
  shared file this feature does not own). **What would change the answer:** if the maintainer
  wants it ignored, `.gitignore` is the right home and it belongs to whoever owns the bootstrap
  script, not to F1.
