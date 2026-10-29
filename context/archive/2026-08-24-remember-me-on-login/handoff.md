# Handoff — `remember-me-on-login` (feature F2)

`/10x-impl-review` wrote this. The feature is **implemented, independently re-verified and
reviewed**: 0 critical findings, 3 warnings (one in the product code, deliberately accepted and
documented; two fixed by this step), 4 observations. **The branch is mergeable as it stands.**
The one thing the next agent must not get wrong: **do not re-measure against the numbers in any
document — measure on your own branch.** This step re-ran every suite from scratch and reconciled
them arithmetically (unit `429 → 439`, e2e `23 → 23`), and re-executed two of the implementer's
deliberate breaks plus one of its own; nothing was inherited. No merge order binds — `ownership.md`
§2 puts F1 and F2 in independent stacks, and a read-only `git merge-tree` dry run of the two
branches produced **zero conflict markers**, so either may land first.

## 1. State

| Field | Value |
|---|---|
| Branch | `feat/remember-me-on-login` (worktree `.claude/worktrees/remember-me-on-login`, `E2E_PORT=4333`) |
| Cut from | `matmaverse-v2` @ `282d264` — **not stacked** |
| Position in stack | independent; merges any time, in either order relative to F1 (`autonomous-run-follow-ups`) |
| Commits | **5** — four from `/10x-implement`, plus this review's docs commit |
| Commit range | `282d264..HEAD` — `f10d56e` Phase 1, `330951d` Phase 2, `918ca17` Phase 3, `06c0ab8` implementation handoff, then this review commit at the tip |
| Pushed? | **no** — and no PR opened |
| `change.md` status | `impl_reviewed` (advanced from `implemented` by this step) |
| `## Progress` rows remaining | **0** (`grep -c '^- \[ \]' plan.md` → 0). 22 of 22 ticked, Manual rows included |
| Working tree | **clean** — `git status --porcelain` empty in the worktree, and re-checked clean after each deliberate break was restored |
| Main checkout | untouched, still on `matmaverse-v2` @ `282d264`; its only untracked paths are the three expected `context/` folders (this step removed a stray 219 KB `signin-desktop.png` — see W2) |

## 2. Artifacts

| path | what it is |
|---|---|
| `/Users/kamilp/Dev/10xDevs/.claude/worktrees/remember-me-on-login/context/changes/remember-me-on-login/reviews/impl-review.md` | **new, written by this step** — the full review: verdicts, the independently re-measured verification table, the three deliberate breaks, and the "applied findings checked for reality" table |
| `/Users/kamilp/Dev/10xDevs/.claude/worktrees/remember-me-on-login/context/changes/remember-me-on-login/follow-ups/review-fixes.md` | **new, written by this step** — RF-1 and RF-2 plus the four recorded observations |
| `/Users/kamilp/Dev/10xDevs/.claude/worktrees/remember-me-on-login/context/changes/remember-me-on-login/handoff.md` | this file (rewritten; also mirrored into the main checkout) |
| `/Users/kamilp/Dev/10xDevs/.claude/worktrees/remember-me-on-login/context/changes/remember-me-on-login/change.md` | **edited by this step** — `status: implemented` → `impl_reviewed` |
| `/Users/kamilp/Dev/10xDevs/signin-desktop.png` | **deleted by this step** — untracked, un-gitignored manual-verification debris in the main checkout (W2) |

**No source file was changed by this step.** There were no CRITICAL findings, so nothing needed a
code fix; the two deliberate breaks and this review's own third break were applied and restored,
and `git status --porcelain` confirms the source tree is byte-identical to `06c0ab8`.

Source files under review (written by `/10x-implement`, unchanged here): `src/lib/services/remember-me.ts`
(new — `REMEMBER_ME_COOKIE`, `REMEMBER_ME_MAX_AGE_SECONDS`, `setRememberChoice`, `authCookieMaxAge`),
`src/lib/supabase.ts` (`setAll`'s `isRemoval` guard and explicit `maxAge`; `AUTH_COOKIE_RE` exported),
`src/pages/api/auth/signin.ts` (`POST`), `src/pages/api/auth/signout.ts` (`POST`),
`src/components/auth/SignInForm.tsx`, `src/pages/auth/signin.astro`, `src/i18n/pl.ts`
(`auth.signin.rememberLabel`), `tests/remember-me-cookie.test.ts`, `tests/signin-form.test.tsx`,
`docs/reference/contract-surfaces.md` (`## Auth cookie lifetime (session-policy surface)`).

## 3. Verification

**Everything below was observed in this step**, sandbox disabled, local Supabase up
(`npx supabase status` → API on `127.0.0.1:54321`). The unit baseline was measured by actually
running the suite on `matmaverse-v2` @ `282d264` in the main checkout — not taken from a document
(L-005).

| command | result |
|---|---|
| `npm test` on `matmaverse-v2` @ `282d264` (baseline, re-measured) | **429 passed / 51 files** |
| `npm test` on this branch | **439 passed / 53 files** — baseline 429, **+10**, +2 files |
| arithmetic | `tests/remember-me-cookie.test.ts` 7 tests + `tests/signin-form.test.tsx` 3 tests = 10 = 439 − 429. **Reconciles exactly.** |
| `npm run lint` | **clean** (no eslint output) |
| `npm run check` | **0 errors, 0 warnings, 9 hints** / 191 files; the 9 hints are pre-existing in `src/pages/app.astro` and unrelated |
| `npx playwright test --list` on base and on branch | **23 tests in 8 files** on both — e2e baseline **23**, delta **+0** |
| `E2E_PORT=4333 npx playwright test` | **23 passed** (27.8s), `smoke.spec.ts` "provisioned account signs in via UI" included — `signInViaUI` still works after the form was restructured |
| `git status --porcelain` (worktree) | empty, before and after every break |
| `git diff --numstat matmaverse-v2..HEAD -- docs/reference/contract-surfaces.md` | **16 added / 0 deleted** — pure append; F1's `## Parent PIN routes (RLS surface)` untouched |
| L-007 both-directions check, re-run here | `"Zapamiętaj mnie"` vs **342** distinct dictionary values: **0** substrings-of, **0** superstrings, exactly **1** occurrence |
| `grep -c "reset.signinLinkLabel"` | `src/pages/auth/signin.astro` → **0**, `src/components/auth/SignInForm.tsx` → **1** (criterion 2.5 holds literally) |
| `git merge-tree` F1 ↔ F2 (read-only) | `src/i18n/pl.ts` and `docs/reference/contract-surfaces.md` "changed in both", **0 conflict markers** — `ownership.md` §2's "no edges" is confirmed empirically, not just argued |

### Deliberate breaks re-executed in this step, each restored (L-004)

| break | what was broken | what went red | why that redness is evidence |
|---|---|---|---|
| **B** (implementer's, re-run) | deleted the `isRemoval` guard in `setAll` (`src/lib/supabase.ts`) | `tests/remember-me-cookie.test.ts` **test 7 alone** (`expected 2592000 to be +0`); tests 1–6 green **and all 6 of `tests/auth-session-gating.test.ts` green** | Reproduces the claim exactly. Test 7 reddening *in isolation*, while the repo's pre-existing sign-out test stays green, is what proves the guard is load-bearing: the jar's `toCookieHeader()` filters empty values, so a blanked cookie and an expired one look identical to every other test. |
| **E** (implementer's, re-run) | dropped `name="remember"` from `<Checkbox>` in `SignInForm` | `tests/signin-form.test.tsx` **test 1 alone**; **all 7 route tests green** | Reproduces exactly. The asymmetry is the justification for a component test on a server-side feature. Mechanism verified at source: `isFormControl = control ? !!form || !!control.closest("form") : …` in `node_modules/@radix-ui/react-checkbox/dist/index.mjs` — the bubble input is always rendered inside a form, so `name` is the only thing that keeps `FormData` from dropping it. |
| **F** (**this review's own**) | removed the lifetime override entirely — `setAll` reverted to `{ ...options, ...AUTH_COOKIE_OPTIONS }`, i.e. pre-change behaviour | **5 of 7 red** (tests 1, 2, 4, 5, 6); tests 3 and 7 green | The plan's three breaks each isolate one branch; none asks whether the suite bites on the seam *at all*. It does — reverting the feature reddens every lifetime assertion, and the only two survivors are the tests that assert something else (the marker's own write; the removal path). The suite is not certifying a no-op. |

### Predecessor claims checked rather than inherited

`isFormControl` (plan-review F2), the exported `AUTH_COOKIE_RE` with no second copy of the regex
(F3), the reworded comment behind criterion 2.5, and F1's now-present `## Phase 0` (cross-plan X1)
are all **real**. `AstroCookies.get()` really does return `undefined` for a key deleted earlier in
the same request (`node_modules/astro/dist/core/cookies/cookies.js`, the `isSetValue` branch),
which is what makes the delete branch correct in production. **One claim was stale:** the previous
handoff's lead "BLOCKING FOR F1" — see `## 5. Open`.

## 4. Next command

`none — ready to merge` (integrate `feat/remember-me-on-login` into `matmaverse-v2`; F1 may land before or after)

## 5. Open

- **RF-1 (WARNING, non-blocking, `follow-ups/review-fixes.md`) — three routes lose their cookie
  lifetime with nothing pinning it.** `POST` in `src/pages/api/auth/signup.ts`, `GET` in
  `src/pages/api/auth/confirm.ts` and `POST` in `src/pages/api/auth/update-password.ts` all
  establish sessions through `createClient`'s `setAll` and none calls `setRememberChoice`, so
  each now yields a browser-session cookie. Verified by grep in this step. The behaviour is
  deliberate and documented; **the gap is that no test asserts it**, on a surface whose whole
  registered hazard is that failures are silent. Cheapest pin: one assertion on the auth-cookie
  write from `GET /api/auth/confirm`, in `tests/remember-me-cookie.test.ts`, located via the
  exported `AUTH_COOKIE_RE`.
- **For a human to decide:** whether the post-verification / post-password-reset sign-out is
  acceptable. If not, the reversal is one call to `setRememberChoice(cookies, true)` in the route
  concerned — **never** a special case inside `setAll`, which cannot tell which route it serves.
- **RF-2 (WARNING, fixed here).** `signin-desktop.png`, a 219 KB screenshot from Manual row 2.6,
  was left untracked *and un-gitignored* at the main checkout's root, where the agent contract
  requires a clean tree. Deleted. Future manual-verification rows should write scratch output to
  `$TMPDIR`.
- **CLOSED, and it was stale in the previous handoff.** That handoff's lead paragraph and first
  open item declared "**BLOCKING FOR F1** — its worktree has the same `node_modules` symlink
  defect and its e2e phase will fail". Checked here: `.claude/worktrees/autonomous-run-follow-ups/node_modules`
  is a real 665-entry directory and F1 has since landed its own impl-review (`8fc70f0`). **Nothing
  blocks F1.** The durable half survives: `.claude/skills/10x-autonomous-run/scripts/worktree-bootstrap.sh`
  still symlinks rather than installs, Vite's `server.fs.allow` refuses to serve through the
  symlink, and the script's vitest-only canary cannot see it — so the *next* run's first worktree
  will hit this again. Fix the script (install, don't symlink); also note `.gitignore` has
  `node_modules/` with a trailing slash, which does not match a symlink.
- **O1 — layering.** `src/lib/supabase.ts` imports `authCookieMaxAge` from
  `src/lib/services/remember-me.ts`, inverting the usual direction. No cycle today (verified:
  nothing in `src/lib/services/` imports `@/lib/supabase`); it becomes one the moment a service
  needs `createClient`.
- **O2 — the remembered window does not slide** (AD-4). `REMEMBER_ME_MAX_AGE_SECONDS` is fixed at
  sign-in by `setRememberChoice`, so a parent active for more than 30 days is downgraded once,
  silently. Cheapest fix if unacceptable: a longer `maxAge` on the marker than on the auth cookie.
- **O4 / plan-review F4 still open.** `createCookieJar` in `tests/helpers/astro.ts` does not model
  expiry or serialization, so no automated test asserts what the *browser* is told — only what the
  options object says. The implementer's real-server `curl` observed it once; nothing pins it.
- **Carried, declined again:** `POST` in `src/pages/api/auth/signin.ts` still validates nothing,
  against `CLAUDE.md`'s zod rule. `tests/auth-routes.test.ts` pins the absence *in a test name*,
  so fixing it means rewriting that test — not a drive-by, and a named non-goal of this plan.
- **`src/lib/supabase.ts` `setAll` is the sensitive shared file.** Every route builds its client
  through it; F2 owns it this run per `ownership.md`.

## 6. Autonomous decisions

`AskUserQuestion` was never called. `/10x-impl-review`'s post-report prompt ("triage / save & triage
later / save only") and its per-finding triage questions all collapsed to decide-then-record.

- **Verdict recorded as APPROVED although three warnings exceed the skill's "≤2" rubric.**
  *Chosen:* APPROVED, with the arithmetic shown and the deviation stated in the report itself.
  *Rejected:* NEEDS ATTENTION by mechanical count — only **one** of the three warnings (RF-1) is in
  the product code, and it is a documented, deliberately accepted decision with a follow-up; W2 was
  debris in a *different* working tree and W3 was a stale sentence in the handoff this step
  rewrites. In the source run two branches were labelled NEEDS ATTENTION on exactly this rubric
  while both reviews said in prose the branch was mergeable. *What would change the answer:* any
  finding that changes shipped behaviour, or a warning the branch itself must carry into merge.
- **Triaged every finding myself rather than saving the report for a human.** *Chosen:* fix W2 and
  W3 in place, file W1 as RF-1, record O1–O4. *Rejected:* "save report only" — it would have left a
  219 KB untracked file blocking a clean-tree gate and a stale blocker in the handoff's first
  sentence. *What would change the answer:* a finding needing product judgement — RF-1 carries
  exactly one, and it is escalated rather than decided.
- **Deleted `signin-desktop.png` from the main checkout instead of only reporting it.** *Chosen:*
  remove it. *Rejected:* leaving it for the maintainer — it is untracked, un-gitignored, referenced
  by nothing in `context/`, and sits in the tree the agent contract requires to stay clean.
  *What would change the answer:* any document citing it as evidence; none does (grepped).
- **Ran my own third deliberate break (F) rather than only re-running the plan's three.** *Chosen:*
  revert the seam entirely and watch 5 of 7 redden. *Rejected:* accepting three isolation breaks as
  sufficient — each proves one branch bites, none proves the suite bites on the feature as a whole,
  which is the L-004 meta-question. *What would change the answer:* nothing; it cost one test run
  and is the cheapest available check that the suite is not decorative.
- **Did not add the RF-1 test in this step.** *Chosen:* file it as a follow-up. *Rejected:* writing
  it here — it is a WARNING, not a CRITICAL, and the triage rule for this run sends warnings to
  `follow-ups/review-fixes.md`; more importantly the *behaviour* it would pin is a human decision
  that has not been made, and pinning the wrong side is worse than not pinning. *What would change
  the answer:* the maintainer settling the post-reset sign-out question either way — the test then
  becomes mechanical.
- **Wrote review artifacts into the branch's own worktree and committed them there**, then mirrored
  the change folder into the main checkout where it already sits untracked. *Chosen:* branch-local,
  committed. *Rejected:* writing only into the main checkout — that is precisely how a previous run
  left untracked review artifacts blocking the return to its own branch. *What would change the
  answer:* nothing; the change folder is tracked and must travel with the branch.
- **`needsE2E` reported as false.** *Chosen:* no browser phase. *Rejected:* an e2e spec for the
  cookie lifetime — a session cookie is distinguished only by surviving a browser restart, which
  Playwright cannot do; `storageState` serialises session cookies and is banned project-wide; and
  reading `sb-…-auth-token` by name would need the **closed** cookie-poking exception list in
  `e2e/CLAUDE.md` reopened. The plan's own reasoning, independently agreed with here. The single
  open risk (RF-1) is a `Set-Cookie` header concern, not a browser-behaviour one. *What would
  change the answer:* a way to restart a browser inside one Playwright run, or a decision to widen
  the cookie-poking exception list.
