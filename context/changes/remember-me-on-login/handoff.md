# Handoff — `remember-me-on-login` (feature F2)

`/10x-implement` wrote this. **All three phases are implemented, verified and committed** on
`feat/remember-me-on-login`; all 22 `## Progress` rows are ticked, including every Manual row
(none were deferred — each was genuinely performed against a real server or a real browser).
**The one thing the next agent must not get wrong:** `.claude/skills/10x-autonomous-run/scripts/worktree-bootstrap.sh`
symlinks `node_modules` to the main checkout, and **Vite refuses to serve through that symlink**,
so nothing hydrates and *every* Playwright spec fails on a 30s timeout that looks exactly like a
product bug. This branch fixed it with a real `npm ci` inside the worktree. **F1's worktree has
the same defect and its e2e phase will fail until it does the same.** No merge order binds —
`ownership.md` puts F1 and F2 in independent stacks, either may land first.

## 1. State

| Field | Value |
|---|---|
| Branch | `feat/remember-me-on-login` (in worktree `.claude/worktrees/remember-me-on-login`) |
| Cut from | `matmaverse-v2` @ `282d264` — **not stacked**; `ownership.md` §2 puts F1 and F2 in two independent stacks of one |
| Position in stack | independent; merges any time, in either order relative to F1 |
| Commits | **4** — one per plan phase (each on green), plus this docs commit |
| Commit range | `282d264..HEAD` — `f10d56e` Phase 1, `330951d` Phase 2, `918ca17` Phase 3, then one docs commit on top (its SHA is the branch tip; not pinned here because this file is inside it) |
| Pushed? | **no** — and no PR opened |
| `change.md` status | `implemented` (advanced from `plan_reviewed` by this step) |
| `## Progress` rows remaining | **0** (`grep -c '^- \[ \]' plan.md` → 0). 22 of 22 ticked, Manual rows included |
| Working tree | **clean** (`git status --porcelain` empty). `node_modules/` is a real directory now and correctly gitignored |

## 2. Artifacts

| path | what it is |
|---|---|
| `/Users/kamilp/Dev/10xDevs/.claude/worktrees/remember-me-on-login/src/lib/services/remember-me.ts` | **new** — owns `REMEMBER_ME_COOKIE`, `REMEMBER_ME_MAX_AGE_SECONDS` (30d), `setRememberChoice`, `authCookieMaxAge`. Module doc states why it is deliberately **unsigned**, unlike its two marker siblings |
| `/Users/kamilp/Dev/10xDevs/.claude/worktrees/remember-me-on-login/src/lib/supabase.ts` | **edited** — `setAll` gains the `isRemoval` guard and the explicit `maxAge`; `AUTH_COOKIE_RE` gains `export`; `AUTH_COOKIE_OPTIONS`' doc gains the "never put `maxAge` here" warning |
| `/Users/kamilp/Dev/10xDevs/.claude/worktrees/remember-me-on-login/src/pages/api/auth/signin.ts` | **edited** — `POST` calls `setRememberChoice(context.cookies, form.has("remember"))` after the `!supabase` guard, before `signInWithPassword` |
| `/Users/kamilp/Dev/10xDevs/.claude/worktrees/remember-me-on-login/src/pages/api/auth/signout.ts` | **edited** — `POST` deletes `REMEMBER_ME_COOKIE` alongside `ACTIVE_PROFILE_COOKIE` / `PARENT_VERIFIED_COOKIE` |
| `/Users/kamilp/Dev/10xDevs/.claude/worktrees/remember-me-on-login/src/components/auth/SignInForm.tsx` | **edited** — the checkbox + reset-link row between the password `FormField` and `ServerError` |
| `/Users/kamilp/Dev/10xDevs/.claude/worktrees/remember-me-on-login/src/pages/auth/signin.astro` | **edited** — the standalone reset link deleted (it moved into the form) |
| `/Users/kamilp/Dev/10xDevs/.claude/worktrees/remember-me-on-login/src/i18n/pl.ts` | **edited, append-only** — one key, `rememberLabel: "Zapamiętaj mnie"`, inside `auth.signin` |
| `/Users/kamilp/Dev/10xDevs/.claude/worktrees/remember-me-on-login/tests/remember-me-cookie.test.ts` | **new** — 7 route-level tests, real routes + real local Supabase |
| `/Users/kamilp/Dev/10xDevs/.claude/worktrees/remember-me-on-login/tests/signin-form.test.tsx` | **new** — 3 jsdom component tests; carries a file-local `ResizeObserver` stub |
| `/Users/kamilp/Dev/10xDevs/.claude/worktrees/remember-me-on-login/docs/reference/contract-surfaces.md` | **edited, pure append** — new H2 `## Auth cookie lifetime (session-policy surface)` after `## set_updated_at()`. 0 deleted lines |
| `/Users/kamilp/Dev/10xDevs/.claude/worktrees/remember-me-on-login/context/changes/remember-me-on-login/plan.md` | **edited** — 22 `## Progress` rows ticked, each annotated with what was actually measured |
| `/Users/kamilp/Dev/10xDevs/.claude/worktrees/remember-me-on-login/context/changes/remember-me-on-login/change.md` | **edited** — `status: plan_reviewed` → `implemented` |
| `/Users/kamilp/Dev/10xDevs/.claude/worktrees/remember-me-on-login/context/changes/remember-me-on-login/handoff.md` | this file (also copied to the main checkout) |

The whole change folder was copied from the main checkout into the worktree and committed in
Phase 1 — `context/changes/` is tracked, and the docs must travel with the branch.

## 3. Verification

Baseline measured **on this branch before Phase 1**, per L-005: **429 unit tests / 51 files**,
**23 Playwright runs / 8 spec files**. Not inherited — re-measured after the worktree bootstrap.

| command | result |
|---|---|
| `npm run lint` | **clean** (observed after every phase; 6 self-inflicted errors were fixed, never suppressed) |
| `npm run check` | **clean** — 0 errors, 0 warnings, 9 pre-existing hints (191 files) |
| `npm test` | **439 passed / 53 files** (baseline 429 / 51, **+10**: 7 route + 3 component) |
| `E2E_PORT=4333 npx playwright test` | **23 passed** (baseline 23, **+0** — this change adds no spec). Includes `smoke.spec.ts` "provisioned account signs in via UI", i.e. `signInViaUI` still works after the form was restructured |
| `git status --porcelain` | empty |
| `git diff docs/reference/contract-surfaces.md` | pure append — **0 deleted lines**; F1's `## Parent PIN routes (RLS surface)` byte-identical |
| L-007 substring check, re-run on this branch | `"Zapamiętaj mnie"` vs all **351** distinct dictionary values: 0 superstrings, 0 substrings, not already present |
| `grep -c "reset.signinLinkLabel"` | `signin.astro` → **0**, `SignInForm.tsx` → **1** (criterion 2.5) |

### Deliberate breaks — all four run, all restored, each meta-checked (L-004)

| break | what was broken | what went red | why that redness is evidence |
|---|---|---|---|
| **B** | deleted `setAll`'s `isRemoval` guard | **test 7 only**; tests 1–6 green **and all of `tests/auth-session-gating.test.ts` green** | The meta-check is the *second* half: the pre-existing sign-out test stays green because the jar's `toCookieHeader()` filters empty values, so a blanked cookie and an expired one are indistinguishable to it. Test 7 going red **alone** is what proves the guard is load-bearing rather than defensive decoration. |
| **C** | `setRememberChoice`'s `false` branch made a no-op | **test 6 only** | Test 6 is the only test exercising the previously-remembered path. Nothing else reddened, so it isolates exactly what it claims. |
| **D** | threaded `remember` through `createClient` as an argument instead of persisting the marker | **test 4 only**; tests 1, 2, 3, **5**, 6, 7 green | The realistic wrong implementation, and it **confirmed AD-6 against research §C.3**: research predicted the *unticked* refresh case (test 5) would redden. It did not — absence-of-marker is the default branch, so the unticked case is refresh-stable by construction. Only the *remembered* session silently downgrades. Had the plan inherited research's design, this break would have proved nothing. |
| **E** | dropped `name="remember"` from `<Checkbox>` | **component test 1 only**; **all 7 route tests green** | The asymmetry is the whole point: the feature becomes a silent browser no-op that the entire server-side suite passes. This is the justification for adding a component test to a server-side feature. A plausible edit, too — the shadcn example carries no `name`. |

### Manual rows — performed, not deferred

- **1.7 / 1.8** — against a real `npm run dev` server + curl, reading actual `Set-Cookie` headers.
  Without `remember`: `sb-127-auth-token=…; Path=/; HttpOnly; SameSite=Lax` — **no `Max-Age`**.
  With it: `…; Max-Age=2592000` plus `remember_me=1; Max-Age=2592000`. Sign-out:
  `sb-127-auth-token=; Max-Age=0` and `remember_me=deleted; Expires=Thu, 01 Jan 1970`.
  **This also closes the gap AD-5 accepted** — the header-level `serialize()` step is now
  *observed*, not merely read out of `node_modules`.
- **2.6 / 2.7 / 2.8** — in a real browser. Geometry via `getBoundingClientRect` at **1440, 712
  and 375 px**: one single-line row (h=20), checkbox+label left, link right-aligned to the row,
  above the submit button, no sideways scroll at any width, exactly **one** reset link on the
  page. Tab order: password → show-password toggle → checkbox → link → submit; **Space** toggles
  and does **not** submit; clicking the label toggles and removes `remember` from the `FormData`.
- The mockup `assets/matmaverse-auth-v2-web/01-parent-login-web.png` was **opened first-hand this
  step** from the main checkout and matches the built row. Not an inherited description.

## 4. Next command

`/10x-impl-review remember-me-on-login`

## 5. Open

- **BLOCKING FOR F1 — the worktree bootstrap breaks every browser spec.**
  `.claude/skills/10x-autonomous-run/scripts/worktree-bootstrap.sh` symlinks `node_modules` to the
  main checkout. Vite's `server.fs.allow` resolves the realpath and refuses
  (`"The request id … is outside of Vite serving allow list"`), so `@astrojs/react/dist/client.js`
  404s, **no island hydrates**, and every Playwright spec dies on a 30s timeout that is
  indistinguishable from a product bug. Measured here: `password-reset.spec.ts` went
  2 failed (30.1s each) → **2 passed (1.6s / 2.2s)** after `rm node_modules && npm ci` in the
  worktree. The script's canary does not catch this because it only counts vitest collection,
  which resolves through the symlink fine. **Fix for the script:** install rather than symlink, or
  add the main checkout to `server.fs.allow`. Also note `.gitignore` has `node_modules/` with a
  trailing slash, which does **not** match a symlink — so `git add -A` stages the symlink as a
  file (it did here; caught and amended out before the Phase 1 commit landed).
- **For a human to decide: three routes lose their 400-day cookie with no checkbox.**
  `POST /api/auth/signup`, `GET /api/auth/confirm` (`verifyOtp` — email verification **and**
  password recovery) and `POST /api/auth/update-password` all establish sessions through `setAll`
  and write no marker, so each now yields a browser-session cookie. Concretely: a parent who
  completes a password reset is signed out when the browser closes. Deliberate and documented in
  `plan.md` *Blast radius beyond sign-in* and in the new contract-surface section. Reversal is one
  call to `setRememberChoice(cookies, true)` in the route concerned — **never** a special case
  inside `setAll`, which cannot tell which route it is serving.
- **New, unplanned: `tests/signin-form.test.tsx` carries a file-local `ResizeObserver` stub.**
  jsdom implements none and Radix's `useSize` constructs one on mount, so the component threw
  before any assertion ran. Stubbed in-file because `ownership.md` forbids editing
  `vitest.config.ts` this run. **Follow-up for whoever owns test infra:** this is the repo's first
  Radix component under test, and the next one will hit the same wall — the stub belongs in a
  shared vitest setup file, not copied per test file.
- **Carried, unchanged: `src/pages/api/auth/signin.ts` `POST` still validates nothing**, against
  `CLAUDE.md`'s zod rule. Declined again here — `tests/auth-routes.test.ts`'s
  `it("no server-side validation: empty fields produce an error redirect, not a crash")` pins the
  absence *in its name*, so fixing it means rewriting that test. Not a drive-by.
- **Carried: the marker does not slide** (AD-4). A parent using the app continuously for more than
  30 days will, once, be signed out after closing the browser. Cheapest fix if judged
  unacceptable: give `REMEMBER_ME_MAX_AGE_SECONDS`' marker a longer `maxAge` than the auth cookie.
- **Still open from plan review, now partly closed:** finding F4 said the marker's *wire* behaviour
  was unasserted. The real-server `Set-Cookie` inspection above observed it, but **no automated
  test asserts it** — the jar still does not model expiry. `tests/remember-me-cookie.test.ts` test 3
  remains an options assertion by design (AD-5).
- **`src/lib/supabase.ts` `setAll` is the sensitive shared file.** Every route builds its client
  through it. F2 owns it this run per `ownership.md`; nothing else should touch it.

## 6. Autonomous decisions

`AskUserQuestion` was never called. `/10x-implement`'s manual-confirmation gate, its dirty-path
question, its commit-message approval and its between-phase prompts all collapsed to
decide-then-proceed.

- **Replaced the bootstrap's `node_modules` symlink with a real `npm ci`.** *Chosen:* fix the
  worktree so the e2e gate measures the product. *Rejected:* (a) adding `server.fs.allow` to
  `astro.config.mjs` — that is a source change that would ship to production to work around a
  local harness defect; (b) running the suite against the main checkout's dev server —
  `playwright.config.ts`'s own comment warns that a reused foreign server silently tests the wrong
  tree; (c) reporting the 23 timeouts as failures — they were harness artifacts and reporting them
  as product bugs would have been the worst outcome. *What would change the answer:* if the
  bootstrap script is fixed to install rather than symlink, this step disappears.
- **Performed every Manual row instead of leaving it as a human checklist.** The step brief allows
  leaving Manual rows unticked, but all six were mechanically performable — curl against a real dev
  server for the `Set-Cookie` rows, a real browser for the layout/keyboard rows. *Rejected:*
  ticking them unverified (forbidden), and leaving them for a human (they were the only checks on
  the header-level and keyboard behaviour, and both found real confirmation). *What would change
  the answer:* a row needing human judgement — "does this *look* right" — which 2.6 was rewritten
  into geometry to avoid.
- **Stubbed `ResizeObserver` file-locally rather than in a shared vitest setup.** *Chosen:* the
  in-file stub. *Rejected:* editing `vitest.config.ts`, which `ownership.md` puts off-limits to
  both features this run. *What would change the answer:* a second Radix component under test —
  then the duplication outweighs the ownership rule and it should move to a setup file, as a
  change of its own.
- **Reworded a source comment so criterion 2.5's `grep -c` holds literally.** The comment in
  `SignInForm.tsx` originally named `t.auth.reset.signinLinkLabel`, making the count 2, not 1.
  *Chosen:* reword the comment to `the signinLinkLabel and heading keys under t.auth.reset`.
  *Rejected:* re-interpreting the criterion as "1 render plus prose" — a mechanical criterion that
  needs a footnote to pass is no longer mechanical. *What would change the answer:* nothing; the
  comment says the same thing.
- **Kept the plan's `options?.maxAge` snippet as `options.maxAge`.** ESLint's
  `no-unnecessary-condition` rejects the optional chain because `options` is non-nullish in
  `@supabase/ssr`'s callback type. *Chosen:* follow the type. *Rejected:* an eslint-disable to
  preserve the plan's literal text. *What would change the answer:* the library widening that
  parameter to optional.
- **Did not fix the pre-existing `signin.ts` zod gap, and did not touch F1's files.** The first is
  a named non-goal in the plan; the second is the contract's neighbour rule. The cross-plan defect
  X1 (F1's orphan `### Phase 0`) is **still unfixed** and still belongs to the sweep — I re-read
  F1's plan only to confirm it, and edited nothing.
