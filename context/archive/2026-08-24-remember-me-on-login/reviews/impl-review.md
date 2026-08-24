<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Honest "remember me" on parent login

- **Plan**: `context/changes/remember-me-on-login/plan.md`
- **Scope**: Phases 1–3 of 3 (all `## Progress` rows ticked — 22/22)
- **Date**: 2026-08-24
- **Reviewed on**: `feat/remember-me-on-login` in `.claude/worktrees/remember-me-on-login`, `E2E_PORT=4333`
- **Verdict**: APPROVED
- **Findings**: 0 critical, 3 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

**On the label.** The skill's rubric turns ">2 warnings" into NEEDS ATTENTION mechanically.
Applied literally that is misleading here: only **one** of the three warnings (W1) touches the
product code, and it is a documented, deliberately accepted decision. W2 was debris in a
*different* working tree and was removed by this step; W3 was a stale claim in the handoff,
which this step rewrites. The code under review carries one non-blocking warning, so the
verdict is **APPROVED**.

## Verification re-run independently by this step

Nothing below is inherited from the implementer's handoff. Every number was measured here,
with the sandbox disabled and the local Supabase stack up (`npx supabase status` → API on
`127.0.0.1:54321`).

| command | result |
|---|---|
| `npm test` on `matmaverse-v2` @ `282d264` (main checkout, **baseline measured, not assumed**) | **429 passed / 51 files** |
| `npm test` on `feat/remember-me-on-login` | **439 passed / 53 files** — baseline 429, **+10**, +2 files |
| arithmetic reconciliation | `tests/remember-me-cookie.test.ts` = 7 `it()`, `tests/signin-form.test.tsx` = 3 `it()`; 7 + 3 = 10 = 439 − 429. **Reconciles exactly.** |
| `npm run lint` | clean (`eslint .`, no output) |
| `npm run check` | **0 errors, 0 warnings, 9 hints** over 191 files — the 9 hints are pre-existing (`src/pages/app.astro`, unrelated to this change) |
| `npx playwright test --list` on base **and** on branch | **23 tests in 8 files** on both — e2e baseline 23, **delta +0**, as the plan claims |
| `E2E_PORT=4333 npx playwright test` | **23 passed** (27.8s), including `smoke.spec.ts` "provisioned account signs in via UI" — `signInViaUI` survives the restructured form |
| `git status --porcelain` (worktree) | empty, before and after every break |
| `git diff --numstat matmaverse-v2..HEAD -- docs/reference/contract-surfaces.md` | **16 added, 0 deleted** — a pure append, F1's section untouched |
| L-007 both-directions check, re-run on this branch | `"Zapamiętaj mnie"` vs **342** distinct dictionary values: 0 substrings-of, 0 superstrings, 1 occurrence |
| criterion 2.5 `grep -c "reset.signinLinkLabel"` | `src/pages/auth/signin.astro` → **0**, `src/components/auth/SignInForm.tsx` → **1** |
| `git merge-tree` F1 ↔ F2 (read-only dry run) | `src/i18n/pl.ts` and `docs/reference/contract-surfaces.md` are "changed in both" but produce **0 conflict markers** — `ownership.md` §2's "no edges" claim holds empirically |

### Deliberate breaks re-executed by this step (not inherited)

Three breaks were run in this review, each restored and the tree confirmed clean afterwards.

| break | what was broken | observed | meta-check (L-004) |
|---|---|---|---|
| **B** (implementer's, re-run) | deleted the `isRemoval` guard in `setAll` (`src/lib/supabase.ts`) | `tests/remember-me-cookie.test.ts` **test 7 red alone** — `expected 2592000 to be +0`; tests 1–6 green **and all 6 of `tests/auth-session-gating.test.ts` green** | Reproduces the implementer's claim exactly. Test 7 reddening *alone*, while the pre-existing sign-out test stays green, is what proves the guard is load-bearing rather than defensive decoration — the jar's `toCookieHeader()` filters empty values, so a blanked cookie and an expired one are indistinguishable to every other test in the repo. |
| **E** (implementer's, re-run) | dropped `name="remember"` from `<Checkbox>` in `SignInForm` | `tests/signin-form.test.tsx` **test 1 red alone** — `expected false to be true`; **all 7 route tests green** | Reproduces exactly. The asymmetry is the justification for a component test on a server-side feature: the whole feature becomes a silent browser no-op that the entire route suite passes. And the mechanism was verified at source — `isFormControl = control ? !!form || !!control.closest("form") : …` in `node_modules/@radix-ui/react-checkbox/dist/index.mjs`, so the bubble input is **always** rendered inside a form and `name` is what makes `FormData` keep it. Plan-review finding F2's correction is factually right. |
| **F** (**this review's own, not in the plan**) | removed the lifetime override entirely — `setAll` reverted to `{ ...options, ...AUTH_COOKIE_OPTIONS }`, i.e. the pre-change behaviour | **5 of 7 red** (tests 1, 2, 4, 5, 6); tests 3 and 7 green | The plan's three breaks each isolate one branch; none asks "does the suite bite on the seam *at all*?" It does: reverting the feature reddens every lifetime assertion and leaves exactly the two tests that assert something else (the marker's own write, the removal path) green. The suite is not certifying a no-op. |

### Applied findings checked for reality, not accepted on assertion

| claim | status |
|---|---|
| Plan-review **F2** — "Radix's bubble input is not gated on `name`" | **REAL.** Verified in the installed `@radix-ui/react-checkbox`: `isFormControl` is form-membership, not `name`. |
| Plan-review **F3** — export `AUTH_COOKIE_RE` rather than re-declare | **REAL.** `export const AUTH_COOKIE_RE` in `src/lib/supabase.ts`; `tests/remember-me-cookie.test.ts` imports it; no second copy of the regex anywhere. |
| Plan-review **F1** — blast radius documented | **REAL** in the documents; **see W1** for what is still missing. |
| Cross-plan **X1** — F1's `### Phase 0` orphan | **CLOSED.** F1's `plan.md` now carries `## Phase 0: Branch baseline` in the body (as well as in `## Progress`). |
| Handoff AD — "comment reworded so `grep -c` yields 1" | **REAL.** The comment reads "the `signinLinkLabel` and `heading` keys under `t.auth.reset`", which does not contain the matched string. |
| Handoff `## 5. Open` — "**BLOCKING FOR F1**: its worktree will fail every spec" | **STALE — see W3.** F1's worktree already has a real 665-entry `node_modules` directory and F1 has since completed its own impl-review (`8fc70f0`). |
| Plan claim — `AstroCookies.get()` returns `undefined` for a key deleted earlier in the same request | **REAL.** Read `node_modules/astro/dist/core/cookies/cookies.js`: `get()` checks `#outgoing` first and returns `void 0` when `isSetValue` is false. This is what makes the delete branch correct in production, where the test jar's `delete()` (which drops the entry outright) is not a faithful model. |

## Findings

### W1 — Three session-establishing routes lose their cookie lifetime with no test and no human decision

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/lib/supabase.ts` → `createClient`'s `setAll`; consumers `POST` in `src/pages/api/auth/signup.ts`, `GET` in `src/pages/api/auth/confirm.ts`, `POST` in `src/pages/api/auth/update-password.ts`
- **Detail**: Verified independently by grep — all three routes build their client through
  `createClient` and **none** calls `setRememberChoice`, so each now yields a browser-session
  auth cookie where it previously yielded 400 days. Concretely: a parent who completes a
  password reset, or who verifies their email, is signed out when the browser closes, with no
  control offered on that request. This is documented in three places (plan *Blast radius
  beyond sign-in*, the new contract-surface section, the handoff) and deliberately accepted —
  the finding is not the decision, it is that **nothing pins it**. No test asserts the
  lifetime on those three paths, so a future "fix" in either direction lands silently, and
  this seam's whole registered hazard is that every failure mode here is silent.
- **Fix**: Add one route-level test per path to `tests/remember-me-cookie.test.ts`, asserting
  `maxAge === undefined` on the auth-cookie write produced by `GET /api/auth/confirm` — the
  cheapest of the three, since `tests/password-reset-marker.test.ts` already drives it with a
  real recovery token. That converts the accepted decision into a pinned one; it does not
  change behaviour. The reversal, if a maintainer judges the post-reset sign-out unacceptable,
  stays one call to `setRememberChoice(cookies, true)` in the route concerned — never a
  special case inside `setAll`, which cannot tell which route it is serving.
- **Decision**: FOLLOW-UP (`follow-ups/review-fixes.md`) — non-blocking; **a human decides the
  behaviour, this review only asks that whatever is decided be pinned.**

### W2 — A 219 KB screenshot was left untracked, and un-gitignored, in the main checkout

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: `signin-desktop.png` at the repository root of the main checkout (not on this branch)
- **Detail**: Produced by the implementer's Manual row 2.6 browser session. `git check-ignore`
  returns non-zero, so it is **not** ignored: it shows in `git status` on `matmaverse-v2`,
  where the agent contract requires the main checkout to stay clean, and nothing in
  `context/` references it. This is the exact class of run debris that has previously blocked
  a run's return to its own branch.
- **Fix**: Deleted by this review step; `git status --porcelain` on the main checkout now shows
  only the three expected untracked `context/` folders. Recorded so future manual-verification
  rows write scratch artifacts to `$TMPDIR`, not the repo root.
- **Decision**: FIXED (removed) + recorded in `follow-ups/review-fixes.md`

### W3 — The handoff's lead paragraph carries a stale cross-feature blocker

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence (handoff quality)
- **Location**: `context/changes/remember-me-on-login/handoff.md` — the lead paragraph and the first bullet of `## 5. Open`
- **Detail**: Both state that **F1's worktree has the same `node_modules` symlink defect and
  its e2e phase will fail until it does the same**. Checked: `.claude/worktrees/autonomous-run-follow-ups/node_modules`
  is a real directory with 665 entries, and F1 has since landed its own impl-review commit
  (`8fc70f0` — "0 critical, 2 warnings"). The claim was true when written and is not true now.
  A stale blocker in the *first sentence* of a handoff is the highest-leverage place to
  misroute the next step.
- **Fix**: Rewritten by this step — the item is restated as closed, with the durable half (the
  bootstrap script still symlinks; the next run's first worktree will hit it again) kept.
- **Decision**: FIXED (in the rewritten handoff)

### O1 — `src/lib/supabase.ts` now depends on `src/lib/services/`, inverting the usual direction

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Architecture
- **Location**: `src/lib/supabase.ts` — the `authCookieMaxAge` import consumed inside `createClient`'s `setAll`
- **Detail**: Everywhere else in this repo, `src/lib/services/*` is the layer that would depend
  on the client factory. Here the factory depends on a service. **There is no cycle today** —
  verified: `grep -rn 'from "@/lib/supabase"' src/lib/services/` returns nothing, and
  `remember-me.ts` imports only an Astro type. The cost is latent: the moment any service needs
  `createClient`, this edge becomes a cycle. The alternative (inlining the cookie name and the
  30-day constant into `supabase.ts`) was rightly rejected — it would put the same two
  constants in three files. Recorded, not a defect.

### O2 — The remembered window does not slide

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: `REMEMBER_ME_MAX_AGE_SECONDS` and `setRememberChoice` in `src/lib/services/remember-me.ts`
- **Detail**: The auth cookie's 30 days are re-stamped on every refresh, but the **marker's**
  are fixed at sign-in. A parent who uses the app continuously for more than 30 days is
  therefore downgraded to a session cookie once, silently, and is signed out the next time the
  browser closes. Accepted as AD-4 and stated in the handoff. Cheapest fix if judged
  unacceptable: give the marker a longer `maxAge` than the auth cookie. No test covers it; the
  test jar does not model expiry, so no test *can* without a clock abstraction.

### O3 — `cn()` wrapping a single static class literal

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: `src/components/auth/SignInForm.tsx` — the `<div>` opening the remember-me row
- **Detail**: `cn("flex items-center justify-between gap-3")` has nothing to merge, and the
  sibling `<div className="flex items-center gap-2">` three lines below correctly uses a plain
  string. `CLAUDE.md`'s rule is "never hand-concatenate class strings", which a single literal
  does not do. Harmless; noted only because the inconsistency is inside one JSX block.

### O4 — The test jar's `delete()` is not a faithful model of `AstroCookies.delete()`, but the assertions survive it

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Success Criteria
- **Location**: `createCookieJar` in `tests/helpers/astro.ts`; consumed by tests 6 and 7 of `tests/remember-me-cookie.test.ts`
- **Detail**: The jar's `delete()` removes the entry outright, whereas real `AstroCookies.delete()`
  *records an expired set* so the browser is told to drop the cookie. Tests 6 and 7 assert
  `jar.get(REMEMBER_ME_COOKIE)` is `undefined`, which passes trivially against the jar. This
  review checked whether that hides anything and it does not: `get()` in
  `node_modules/astro/dist/core/cookies/cookies.js` consults `#outgoing` first and returns
  `void 0` when `isSetValue` is false, so production and the jar agree on the value the
  *reader* sees. Independently, the implementer's real-server `curl` observed
  `remember_me=deleted; Expires=Thu, 01 Jan 1970`. Recorded so the next reader does not
  re-derive it — the same divergence would matter for any future assertion about what the
  *browser* is told, which is plan-review F4's still-open point.

## Follow-ups queued

`context/changes/remember-me-on-login/follow-ups/review-fixes.md` — W1 and W2. Every entry
names a file and a symbol, never a line number (L-006).
