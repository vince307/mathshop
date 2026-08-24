# Handoff — `remember-me-on-login` (feature F2)

`/10x-plan-review` (deep) wrote this. The plan is **reviewed and approved for implementation**:
0 critical, 3 warnings (all fixed in `plan.md`), 2 observations (recorded below). **The one
thing the next agent must not get wrong:** the plan now states, in Current State Analysis
under *Blast radius beyond sign-in*, that this change also shortens the auth cookie on three
routes that have no checkbox (`signup`, `confirm`/`verifyOtp`, `update-password`). That is
deliberate and must not be "fixed" inside `setAll` — the seam cannot tell which route it is
serving. Also still binding from the previous step: the plan **overrides** research §C.3, and
the load-bearing test is the **ticked** refresh case (test 4, break D, AD-6). No merge order
binds yet — `context/runs/2026-08-24-followups-and-remember-me/ownership.md` still does not
exist.

## 1. State

| Field | Value |
|---|---|
| Branch | `matmaverse-v2` (main checkout, unchanged — docs-lane step, no branch cut, no `git checkout` run) |
| Cut from | n/a — `feat/remember-me-on-login` is cut by the implement step, in a worktree |
| Position in stack | not yet assigned; `ownership.md` **does not exist**. AD-9 self-declares F2's footprint and is overridden on sight if the sweep writes one |
| Commits | 0 |
| Commit range | n/a (HEAD still `282d264`) |
| Pushed? | **no** |
| `change.md` status | `plan_reviewed` (advanced from `planned` by this step; `updated: 2026-08-24` unchanged, same day) |
| `## Progress` rows remaining | **22** (`grep -c '^- \[ \]' context/changes/remember-me-on-login/plan.md` → 22; unchanged by this review — no criterion was added or removed) |
| Working tree | clean except the same three untracked `context/` folders as before. **No source file, test, migration or config created or modified.** |

## 2. Artifacts

| path | what it is |
|---|---|
| `/Users/kamilp/Dev/10xDevs/context/changes/remember-me-on-login/reviews/plan-review.md` | **new** — the full review: grounding line, 5 dimension verdicts, findings F1–F5 with fix/decision, and the cross-plan section (X1 plus the clean cross-checks, so the sweep does not re-derive them) |
| `/Users/kamilp/Dev/10xDevs/context/changes/remember-me-on-login/plan.md` | **edited, 5 targeted edits** — (1) Overview gains a *Scope correction*; (2) Current State Analysis gains the *Blast radius beyond sign-in* bullet; (3) Phase 2's **Trap** paragraph corrects the Radix mechanism; (4) Phase 1 §5 decides `export AUTH_COOKIE_RE` instead of "export or re-declare"; (5) Migration Notes split into two numbered fronts. Plus AD-3 narrowed and **AD-10** added. Phases, contracts, test tables and `## Progress` untouched. |
| `/Users/kamilp/Dev/10xDevs/context/changes/remember-me-on-login/change.md` | **edited** — `status: planned` → `plan_reviewed` only. No other line touched. |
| `/Users/kamilp/Dev/10xDevs/context/changes/remember-me-on-login/handoff.md` | this file |

No file outside `context/changes/remember-me-on-login/` was written (docs-lane rule). F1's
plan was **read but not edited** (neighbour-mandate rule).

## 3. Verification

| command | result |
|---|---|
| `npm test` | **not run in this step** — explicitly forbidden by the step brief (another agent may hold the tree; a measurement would be their in-flight state, not mine). The predecessor's `429 passed / 51 files` on `matmaverse-v2` @ `282d264` is therefore **inherited and unverified here**. Every plan criterion says *measure the baseline on this branch*, so nothing depends on it. |
| `npm run lint` / `npm run check` / `npx playwright test` | **not run** — same reason; this step wrote no code |
| Deliberate break | **none run** — nothing executable was produced. Recording the absence rather than borrowing a green (L-004). |
| Grounding — paths | **13/13** claimed existing paths verified by `ls -l`; `src/lib/services/remember-me.ts` correctly absent (the one new file) |
| Grounding — symbols (first-hand, this step) | `AUTH_COOKIE_OPTIONS`, `AUTH_COOKIE_RE` (confirmed **not** exported), `setAll`, `clearAuthCookies` in `src/lib/supabase.ts`; `setCookieOptions` / `removeCookieOptions` in `@supabase/ssr` 0.10.3 `cookies.js`; `DEFAULT_COOKIE_OPTIONS` — **no `expires` key**, which is what makes `maxAge: undefined` a real session cookie; `AstroCookies.get`'s `isSetValue` branch and `set`'s `Object.assign(serializeOptions, options)`; `cookie` 1.1.1's `if (cookie.maxAge !== undefined)`; `setActiveProfileCookie`'s option shape; `it("no server-side validation: …")` in `tests/auth-routes.test.ts`; `createCookieJar`'s `toCookieHeader()` empty-value filter |
| Grounding — the jar models what the plan needs | `createCookieJar.get` reads a single merged store, so it reproduces both semantics the design depends on: a value `set` earlier in the request is visible (test 2), and a `delete`d key returns `undefined` (test 6). Both match real `AstroCookies`. Tests 2 and 6 are therefore achievable as written. |
| Grounding — break B's stated asymmetry | verified by reading, not assumed: `toCookieHeader()` filters `value !== ""`, so removing the `isRemoval` guard leaves `tests/auth-session-gating.test.ts`'s sign-out test green. Test 7 really is the only coverage. |
| Grounding — Progress↔Phase mechanical contract | one `## Progress` at the bottom; 3 `## Phase N` ↔ 3 `### Phase N`, names identical; 22 criteria bullets ↔ 22 rows (6+2, 5+3, 5+1); no stray `- [ ]` in any phase body. **PASS** |
| L-005 sweep | no absolute count appears in any success criterion; every one reads `baseline + N` with an instruction to measure on-branch. **PASS** |
| L-007 re-run independently | all 395 quoted dictionary values in `src/i18n/pl.ts`: `"Zapamiętaj mnie"` has **0** superstrings and **0** substrings. `"Nie pamiętasz hasła?"` is `auth.reset.heading` **and** `auth.reset.signinLinkLabel` — the constraint Phase 2 §3 carries. **PASS** |
| Locator risk retired (was AD-3's largest unknown) | `dom-accessibility-api` 0.5.16 `isLabelableElement` includes `button`, and `getLabels` reads `element.labels`, implemented by jsdom 29 on `HTMLButtonElement` — so `getByRole("checkbox", { name })` resolves through `<Label htmlFor="remember">`. Verified by reading both packages. |
| e2e blast radius | `signInViaUI` (`e2e/helpers/accounts.ts`) submits via `getByRole("button", { name: t.auth.signin.submit })`; the Radix control exposes `role="checkbox"`, so it cannot become ambiguous. `waitForIslands` (`e2e/helpers/hydration.ts`) counts `astro-island` elements, which the new control does not add. No spec clicks the sign-in page's reset link (`grep` over `e2e/`: only `goto("/auth/reset-password")`). The plan's claim holds. |
| PKCE check (the sharpest version of finding F1) | **not applicable** — `src/pages/api/auth/confirm.ts` uses `token_hash` + `verifyOtp`; `exchangeCodeForSession` appears nowhere in `src/`, so no `-code-verifier` cookie is ever written through `setAll` |

## 4. Next command

`/10x-implement remember-me-on-login`

## 5. Open

- **Carried forward, still binding: the plan overrides research §C.3.** AD-6 in `plan.md`.
  Load-bearing test = the **ticked** refresh case (Phase 1 test 4); primary break = D.
  Reconciling the plan back to research reintroduces an L-004 false green.
- **New from this review (finding F1) — the change reaches three routes with no checkbox.**
  `POST /api/auth/signup`, `GET /api/auth/confirm` (`verifyOtp`, i.e. email verification *and*
  password recovery) and `POST /api/auth/update-password` all establish sessions through
  `setAll` in `src/lib/supabase.ts` and write no marker, so each moves from 400 days to a
  browser-session cookie. Accepted and now documented; the reversal is one call to
  `setRememberChoice` in `GET /api/auth/confirm`. **For a human to confirm**, since it means a
  parent who completes a password reset is signed out when the browser closes.
- **Finding F4, accepted: the marker's wire behaviour is unasserted.** `createCookieJar.delete`
  drops the entry; real `AstroCookies.delete` keeps it with `expires: new Date(0)`. Both give
  `get() === undefined`, so test 6 is sound — but neither the deletion `Set-Cookie` nor the
  marker's persistence is proven anywhere. Closes together with the plan's own stated uncovered
  break, via AD-5 (declare `cookie` as a devDependency, then assert the serialized header).
- **Finding F5, skipped: Phase 1's manual steps walk sign-in and sign-out only** — not the
  signup or confirm/recovery paths that F1 shows change silently. Not added, because this run
  has no human to execute manual rows.
- **`src/lib/supabase.ts` `createClient` / `setAll` is the sensitive shared file** — every
  route builds its client through it, and this step added one more edit to it
  (`export AUTH_COOKIE_RE`). F2 owns it per AD-9; nothing else in this run should touch it.
- **Carried forward: contention with F1 (`autonomous-run-follow-ups`) is resolved in both
  directions**, re-verified this step by reading F1's plan: F1 appends `seedShiftWeek` at end
  of `e2e/helpers/accounts.ts` and F2 touches that file not at all; F1 edits
  `## Parent PIN routes (RLS surface)` in `docs/reference/contract-surfaces.md` and F2 appends
  a brand-new H2.
- **Cross-plan defect found in F1's plan (X1), reported not edited.**
  `context/changes/autonomous-run-follow-ups/plan.md` has `### Phase 0: Branch baseline` in
  `## Progress` (rows 0.1, 0.2) with **no `## Phase 0` heading in the plan body** — an orphan
  Progress subsection, which `/10x-implement`'s Progress↔Phase matching treats as malformed.
  The rows are good practice (they are the L-005 baseline measurement); the fix is to add the
  `## Phase 0` block to the body, not to delete them. **The contention sweep owns this edit.**
- **Carried forward: the mockup is gitignored.** `assets/matmaverse-auth-v2-web/01-parent-login-web.png`
  was opened during planning and transcribed in `plan.md` § *Mockup (observed first-hand during
  planning)*. That paragraph is binding if the worktree lacks `assets/`.
- **Non-blocking follow-up, unchanged:** `src/pages/api/auth/signin.ts` `POST` still validates
  nothing, against `CLAUDE.md`'s zod rule. Declined here — `tests/auth-routes.test.ts`'s
  `it("no server-side validation: empty fields produce an error redirect, not a crash")` pins
  the absence *in its name*, so the fix would have to rewrite that test.

## 6. Autonomous decisions

`AskUserQuestion` was never called. `/10x-plan-review` prescribes an interactive triage loop
(one question per finding) plus a save/triage choice; both collapsed to decisions here. Full
text with reversal conditions is in `plan.md` § *Autonomous decisions* **AD-10** and in
`reviews/plan-review.md`.

- **Chose deep mode over `--quick`, and verified rather than delegated.** The step brief said
  "Review DEEP". The skill's Step 3 wants one general-purpose sub-agent; I verified the 5
  riskiest claims myself with direct reads of `node_modules` and `src/`, because every claim
  was a specific identifier in a specific file — cheaper and less lossy than a summarized
  sub-agent report. *Rejected:* the sub-agent, and `--quick`. *What would change the answer:*
  a plan whose risky claims are behavioural rather than textual — then a sub-agent that can run
  code earns its cost.
- **Triaged all three warnings as "fix in plan" rather than "accept risk".** Per the step
  brief, CRITICAL → fix, WARNING → fix if obvious. All three were obvious and narrowly scoped
  (a corrected paragraph, a decided coin-flip, a documented consequence). *Rejected:* filing F1
  as a follow-up — a plan cannot claim "and nothing else" in its Overview while quietly
  altering four flows. *What would change the answer:* if the maintainer judges the
  post-verification sign-out unacceptable, F1 becomes a fourth phase (one call plus a test),
  not a paragraph.
- **Did not run any suite, against rule 5 of the agent contract ("verify, do not inherit").**
  The step brief explicitly forbids it here — another agent may hold the tree. The narrower
  instruction wins; the inherited `429 / 51 files` is marked unverified in `## 3. Verification`
  rather than restated as observed, and no plan criterion depends on it. *What would change the
  answer:* nothing in this step. The implement step measures its own baseline on its own branch
  before Phase 1, which is what L-005 actually asks for.
- **Verdict SOUND, not REVISE.** Pre-fix the plan was REVISE (one HIGH-impact blind spot, two
  precision defects). All three are applied, so the document handed to `/10x-implement` is the
  fixed one. *Rejected:* reporting REVISE and leaving the fixes to the implementer — there is
  no human to re-review, so an unapplied finding is a lost finding. *What would change the
  answer:* a finding I could not fix without redesigning a phase; that stays REVISE and is
  named as such.
- **Did not edit F1's plan despite finding a CRITICAL-class defect in it (X1).** The agent
  contract reserves neighbour edits for the contention sweep. *Rejected:* fixing the orphan
  `### Phase 0` directly — it is two lines and tempting. *What would change the answer:* being
  dispatched as the sweep step; then X1 is mine to apply.
