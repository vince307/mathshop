# Integration handoff — run `2026-08-24-followups-and-remember-me`

**Branch: `run/2026-08-24-followups-and-remember-me` @ `4f8271b`**, cut from
`matmaverse-v2` @ `282d264`. Not pushed. No PR. `main` untouched. Both feature
worktrees are still on disk and untouched.

**Verdict: both features merged with ZERO conflicts, the full suite is green on the
final commit, and every branch total reconciles to the integration total exactly. No
merge-only defect was found.** That last sentence is a finding, not a gap — §3 lists
what was actually checked to earn it, because "the suites were green" is weaker
evidence than "the seam was inspected", and this run had a real seam.

---

## 1. What landed, in what order

Merge order was binding and came from `ownership.md` §2. Both merges used `--no-ff`,
so each feature's history stays legible as its own strand.

| # | Feature | Branch | Merge commit | Own commits | Conflicts |
|---|---|---|---|---|---|
| 1 | **F1** `autonomous-run-follow-ups` (backlog H1) | `feat/autonomous-run-follow-ups` @ `8fc70f0` | `0a15b01` | 10 (7 phase + 2 epilogue + 1 impl-review) | **0** |
| 2 | **F2** `remember-me-on-login` (backlog A3) | `feat/remember-me-on-login` @ `ead0d92` | `0b04bec` | 5 (3 phase + 1 handoff + 1 impl-review) | **0** |
| — | integration follow-up (see §5, AD-2) | — | `4f8271b` | 1 | — |

Excluded from the run: **nothing**. Both features that entered shipped.

**Neither feature wrote a migration.** `git diff matmaverse-v2 -- supabase/` is empty,
as `ownership.md` §4 required. Latest migration on disk is still
`20260822120000_shift_log_add_earned.sql`.

### Why there were no conflicts

`ownership.md` predicted this and was right on both counts. The two features share
exactly two files and zero symbols:

- **`src/i18n/pl.ts`** — F2's `auth.signin.rememberLabel` at line 21, F1's
  `growth.noNextUpgrade` at line 346. ~325 lines apart, in different objects. Git
  three-way-merged it silently; the merged file carries **both** (`git diff` vs base
  is `+2`, one line from each).
- **`docs/reference/contract-surfaces.md`** — F1 appended one bullet inside
  `## Parent PIN routes (RLS surface)`; F2 appended a whole new
  `## Auth cookie lifetime (session-policy surface)` at EOF. ~22 lines of untouched
  context between them, more than the 3-line default diff context. The merged file
  carries **both** (`+17` = F1's 1 + F2's 16), all eight H2 sections intact, neither
  section edited by the other feature.

**Nothing was silently dropped, and this is proven rather than asserted.** For every
non-docs file either branch touched, `git diff <branch> HEAD -- <file>` is empty —
i.e. byte-identical to the branch — *except* the two shared registries above, which
differ precisely because each now also holds the other feature's addition. That is the
exact signature of a correct keep-both-sides merge.

`context/runs/2026-08-24-followups-and-remember-me/` was never `git add`-ed and remains
untracked, as required.

---

## 2. Verification, with the arithmetic shown

All five commands were run **twice**: once on the merge result (`0b04bec`) and again on
the final commit (`4f8271b`), so the table below describes the tree that actually
ships. Run in the main checkout with the command sandbox disabled and local Supabase up
on `127.0.0.1:54321` (`npx supabase status` reports `imgproxy`, `edge_runtime` and
`pooler` stopped — pre-existing, and no suite needs them).

| command | result on `4f8271b` | base `282d264` | F1 delta | F2 delta | expected | reconciles |
|---|---|---|---|---|---|---|
| `npm run lint` | **clean** | clean | 0 | 0 | clean | ✅ |
| `npm run check` | **0 errors, 0 warnings, 8 hints** (191 files) | 0 / 0 / 9 (188 files) | **−1 hint**, +0 files | 0 hints, **+3 files** | 8 hints / 191 files | ✅ |
| `npm test` | **443 passed / 53 files** (37.3s) | 429 / 51 | **+4** tests, +0 files | **+10** tests, **+2** files | 443 / 53 | ✅ |
| `npm run build` | **Complete** (Vercel adapter) | ok | — | — | ok | ✅ |
| `npx playwright test` | **26 passed / 8 files** (29.2s) | 23 runs | **+3** runs | **+0** runs | 26 | ✅ |

### The arithmetic, spelled out

- **Unit tests: 429 + 4 + 10 = 443.** F1's four are `it()` blocks in
  `tests/worlds-picker.test.tsx` (×2), `tests/shop-art-slots.test.tsx` (×1) and
  `tests/weekly-report-tiles.test.tsx` (×1). F2's ten are its two new files,
  `tests/remember-me-cookie.test.ts` (7 route-level) + `tests/signin-form.test.tsx` (3).
- **Unit test FILES: 51 + 0 + 2 = 53.** F1 adds no test file — `tests/nav-labels.test.ts`
  already existed and was only edited, and `shop-art-slots.test.ts → .tsx` is a rename,
  net zero. F2 adds two.
- **E2E: 23 + 3 + 0 = 26 runs.** F1 adds two `test()` calls; `e2e/growth.spec.ts`'s runs
  in **both** projects because `playwright.config.ts`'s `touch` project carries
  `testMatch: /(gameplay-restore|growth)\.spec\.ts/`, while
  `e2e/parent-weekly-report.spec.ts`'s is desktop-only → 2 + 1 = 3. F2 adds and edits no
  spec; its e2e contribution is a **regression gate**, not a delta. `--list` on the
  merged branch confirms *"Total: 26 tests in 8 files"* independently of the run.
  (Restating `ownership.md` §6.5 for the next contract: the repo has **8 spec files, 19
  `test()` calls, 23 → now 26 RUNS**. "N specs" has meant runs all along.)
- **`check` file count: 188 + 0 + 3 = 191.** The 3 are F2's `src/lib/services/remember-me.ts`,
  `tests/remember-me-cookie.test.ts` and `tests/signin-form.test.tsx`. F1 contributes 0,
  for the same rename/edit reason as above. (`tsconfig.json` has `include: ["**/*"]`, so
  `tests/` and `e2e/` are type-checked too — the count is the whole tracked
  `.ts`/`.tsx`/`.astro` set, currently 192, less one.)
- **`check` hints: 9 − 1 = 8.** The −1 is entirely F1's: a dead `import React` dropped
  from `src/components/parent/WeeklyActivityChart.tsx`. **This is expected, not a
  regression** — F1's own impl-review predicted the exact number. The remaining 8 hints
  are pre-existing unused-symbol warnings in `src/pages/app.astro`,
  `src/components/child/SelectTile.tsx` and `src/components/parent/WeeklyReport.tsx`,
  none of them touched by this run.

Every figure lands on its predicted value with no rounding and no unexplained residue.

---

## 3. Merge-only defects: none — and what was checked to establish that

Integration is the only step that can see cross-feature defects, so a green suite alone
is not the answer. Each of the following was inspected on the **merged** tree:

1. **The one real behavioural seam.** F2 rewrites `setAll` in `src/lib/supabase.ts` —
   the write path for *every* auth-cookie write in the app — so the auth cookie is now a
   **browser-session** cookie unless `remember_me=1`. Every authenticated spec in the
   repo, including all of F1's, signs in through `signInViaUI`. **Verified on the merged
   tree, not inherited:** `e2e/helpers/accounts.ts` imports `admin` from
   `tests/helpers/supabase.ts`, which is plain `@supabase/supabase-js` and never
   `createClient`, so F1's `seedShiftWeek` seeder never crosses the seam; and a Playwright
   `BrowserContext` retains session cookies for its own lifetime, so `signInViaUI` is
   unaffected. `e2e/gameplay-restore.spec.ts` Risk #2 — the one spec that deliberately
   opens a *fresh* context and re-signs in — passes in both projects.
2. **L-007 substring check, re-run in both directions on the merged dictionary.** This
   is the first time it has ever run on a tree containing *both* keys (the sweep
   simulated it; each branch could only check its own). Against all **347** distinct
   string values in the merged `src/i18n/pl.ts`: for `growth.noNextUpgrade` — 0 existing
   values are a substring of it, 0 contain it; for `auth.signin.rememberLabel` — 0 and 0.
   Neither new label contains the other. Each appears exactly once in the dictionary.
   **Clear.**
3. **The 712px nav bar** — the failure mode that was the *only* merge-only bug in the
   source run (a sixth tab narrowed every tab and slid one under the dev toolbar, so a
   link that reported itself visible and unique timed out on click). **Neither feature
   adds a nav entry this run**: `items` = 5, `tabs` = 6, unchanged. `e2e/growth.spec.ts`
   Risk E2E-F4-2 loops every `t.nav.items` label asserting `toHaveCount(1)` **and**
   `toBeVisible()` **and** the right `href`, in both projects, and `growth.spec.ts` is
   one of the two files the 712px `touch` project matches. Green.
4. **`src/components/app/AppShell.astro` net-zero.** F1 Phase 4's deliberate break
   mutated an `items[].href` and restored it. `git diff matmaverse-v2 -- ` that file is
   **empty** on the integration branch, as `ownership.md` demanded at every commit.
5. **`maxAge` did not leak into `AUTH_COOKIE_OPTIONS`.** Read on the merged file: the
   lifetime lives only inside `setAll`, guarded by `isRemoval`, and `AUTH_COOKIE_OPTIONS`
   carries a comment saying why it must never go there. `clearAuthCookies` still spreads
   that object after its own `maxAge: 0` via a direct `cookies.set`. Sign-out intact.
6. **`export const prerender = false`** present on all three API routes either feature
   touched (`api/profiles/world.ts`, `api/auth/signin.ts`, `api/auth/signout.ts`).
7. **The `"Nie pamiętasz hasła?"` duplicate-string hazard.** F2 moved the reset link out
   of `src/pages/auth/signin.astro` into `SignInForm.tsx`. On the merged tree the string
   greps **0** times in `signin.astro`; the link renders once, from the component. The two
   dictionary keys that happen to share that text were correctly left unmerged.
8. **No migration from either feature**, and `src/types.ts` untouched by both — as
   `ownership.md` §4 and its `src/types.ts` row required.

---

## 4. What is still open

Nothing here blocks the merge. Both impl-reviews returned **`MERGE: CLEAR`** (F1: 0
critical / 2 warnings; F2: 0 critical / 3 warnings). Full text lives in each feature's
`follow-ups/review-fixes.md`.

### Needs a human — cannot be closed by any agent

- **F2 RF-1 carries a genuine product decision.** `POST /api/auth/signup`,
  `GET /api/auth/confirm` (email verification **and** password recovery) and
  `POST /api/auth/update-password` all establish a session through `setAll` and none has
  a checkbox, so **each now yields a browser-session cookie where it previously yielded
  400 days**. A parent who verifies their email or completes a password reset is signed
  out when the browser closes. This is deliberate and documented — but **untested**, on a
  surface whose registered hazard is that every failure is silent. Decide whether that
  sign-out is acceptable. If not, the reversal is one call to
  `setRememberChoice(cookies, true)` **in the route concerned** — never a special case
  inside `setAll`, which cannot tell which route it is serving. Either way, pin the
  chosen behaviour with a test.
- **Four `#### Manual` Progress rows in F1's plan (1.7, 1.8, 2.5, 6.6)** need a human
  with a screen reader and eyes on `/app/growth` and `/app/report`. Checklist in
  `context/changes/autonomous-run-follow-ups/handoff.md` §5.
- **F2's manual rows** cover the rendered sign-in layout. `assets/` is gitignored and did
  not exist in the worktree, so the implementer **could not see mockup
  `01-parent-login-*`**. It did not guess a layout — the checkbox is one control added to
  an existing form — but the visual result is unverified against the design. Worth a look.

### Cheap, mechanical, deferred by choice

- **F1 FU-R1** — `e2e/parent-weekly-report.spec.ts` Risk E2E-3 asserts
  `page.getByText("9", { exact: true })` **page-wide** instead of scoping the total to
  the `t.report.statTasks` tile. Not a false green (the review re-ran the break and it
  went red), but weaker than contracted and brittle: any future copy rendering a bare
  `"9"` on `/app/report` breaks it. **Checked at integration: F2 adds nothing to that
  page, so this is latent today, not active.**
- **F1 FU-R2** — one clause missing from `LIVE_E2E_STRINGS`' doc-comment in
  `tests/nav-labels.test.ts`: only **non-exact** locators need registering.
- **F1, carried from implement** — the `"error" in result` branch of
  `src/pages/api/profiles/world.ts` has no automated proof its `console.error` fires
  (plan D3, accepted); `seedShiftWeek` indexes `keys[weekday]` unguarded (ergonomics —
  it throws either way).
- **F2 O1** — `src/lib/supabase.ts` imports `authCookieMaxAge` from
  `src/lib/services/remember-me.ts`, inverting the usual layer direction. No cycle today;
  it becomes one the moment a service needs `createClient`.
- **F2 O2** — the remembered window does not slide. `REMEMBER_ME_MAX_AGE_SECONDS` is
  fixed at sign-in, so a parent continuously active past 30 days is downgraded to a
  session cookie once. Accepted as AD-4.

### Tooling defect this run hit twice — worth fixing before the next run

**`.claude/skills/10x-autonomous-run/scripts/worktree-bootstrap.sh` symlinks
`node_modules` instead of installing it.** Vite's `server.fs.allow` refuses to serve
through the symlink, so **every island silently fails to hydrate and every authenticated
Playwright spec times out in a way that looks exactly like a product bug.** The script's
canary only collects unit tests and cannot see it. Both feature agents hit it and both
worked around it locally. Also note `.gitignore` has `node_modules/` with a trailing
slash, which does **not** match a symlink. The next run's first worktree will hit this
again unless the script installs rather than links.

---

## 5. Autonomous decisions made at this step

Each with what would change the answer.

**AD-1 — moved two untracked change folders aside before cutting the branch, rather than
merging over them.** `context/changes/autonomous-run-follow-ups/` and
`context/changes/remember-me-on-login/` existed **untracked** in the main checkout (the
docs lane wrote them there), while both branches carry committed copies. Git would have
refused the merge with *"untracked working tree files would be overwritten"*. I copied
both to `$TMPDIR/preint-backup/`, moved them out of the tree, then merged — so the
**committed** copies landed. *Verified this lost nothing:* F2's untracked copy was
byte-identical to its branch; F1's differed only by being **older** (`status:
implemented` vs the branch's `status: impl_reviewed`, and missing
`reviews/impl-review.md` and `follow-ups/`). The branch copy is strictly the later state
in both cases. *What would change the answer:* if a main-checkout copy had held content
absent from its branch, it would have needed merging in by hand, not discarding.

**AD-2 — closed one deferred follow-up on the integration branch (commit `4f8271b`),
and only one.** F1's impl-review left `## public.shift_log`'s *Consumed by* line in
`docs/reference/contract-surfaces.md` without `seedShiftWeek` — the first test-side
writer, and the only writer anywhere that sets `created_at` explicitly — recording
"**left alone this run because the file is contended; worth a one-line append after F2
integrates**". F2 has now integrated, so the deferral condition has fired, and **this
step is the only one that could fire it**. I appended the line, noting the `12:00Z`
Warsaw/DST pinning and the explicit `earned` (a `null` there flips `earningsKnown` to
`false` and silently suppresses the parent's earnings tile). *Why act rather than
carry it:* nothing in `src/`, `tests/`, `e2e/` or CI reads this file, so an omission
fails silently and permanently — it is the one class of debt a test can never recover.
*What would change the answer:* I would **not** have touched this file for any item
whose deferral was not explicitly conditioned on the other feature integrating. No
other follow-up in either list was actioned; §4 is untouched work, deliberately left
for you.

**AD-3 — `--no-ff` on both merges.** Both branches were ahead of a base that had not
moved, so both would have fast-forwarded and the run's two strands would have flattened
into one indistinguishable line of 15 commits. `--no-ff` keeps each feature's history
attributable and makes the merge order visible in `git log --graph` — which matters
because that order was binding. *What would change the answer:* nothing here; a linear
history was never a requirement of this run.

**AD-4 — re-ran the entire suite after the one-line docs commit rather than reasoning
that Markdown cannot affect it.** It cannot, and it did not. But the verification table
is the artifact you will trust, and it should describe the commit that ships, not its
parent. Cost: ~2 minutes. (Contract rule 5: verify, do not inherit.)

**AD-5 — reported "no merge-only defect" as a positive finding backed by §3, rather
than as silence.** The source run's integration step found the run's only real bug, so
an integration report that simply says "green" is indistinguishable from one that did
not look. §3 lists eight specific things inspected on the merged tree — including the
one seam that genuinely spans both features — so you can audit the *absence*.
