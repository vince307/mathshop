# Follow-ups — `remember-me-on-login`

Non-blocking items raised by `/10x-impl-review` on 2026-08-24. Nothing here blocks the
merge of `feat/remember-me-on-login`. Every item names a **file and a symbol**, never a
line number (L-006).

## RF-1 — Pin the cookie lifetime on the three routes that have no checkbox

- **Source**: impl-review **W1** (⚠️ WARNING, Safety & Quality)
- **Where**: `src/lib/supabase.ts` → `createClient`'s `setAll` is the seam; the unpinned
  consumers are `POST` in `src/pages/api/auth/signup.ts`, `GET` in
  `src/pages/api/auth/confirm.ts`, and `POST` in `src/pages/api/auth/update-password.ts`.
  The test file to extend is `tests/remember-me-cookie.test.ts`.
- **What**: All three establish a session through `setAll` and none calls
  `setRememberChoice`, so each now yields a **browser-session** auth cookie where it
  previously yielded 400 days. A parent who completes a password reset or verifies their
  email is signed out when the browser closes. The behaviour is deliberate and documented
  (plan *Blast radius beyond sign-in*; the `## Auth cookie lifetime (session-policy surface)`
  section of `docs/reference/contract-surfaces.md`); **what is missing is any test**. This
  surface's registered hazard is that every failure here is silent, so an unpinned path is
  exactly where a future change lands unnoticed.
- **Suggested**: one route-level test asserting `maxAge === undefined` on the auth-cookie
  write produced by `GET /api/auth/confirm` — the cheapest of the three, because
  `tests/password-reset-marker.test.ts` already drives that route with a real recovery
  token. Locate the write with the exported `AUTH_COOKIE_RE`, never a hard-coded ref.
- **Human decision this carries**: if the post-verification / post-reset sign-out is judged
  unacceptable, the reversal is one call to `setRememberChoice(cookies, true)` **in the
  route concerned** — never a special case inside `setAll`, which cannot tell which route
  it is serving. Either way the chosen behaviour should end up pinned by the test above.

## RF-2 — Manual-verification scratch artifacts must not land in the repo root

- **Source**: impl-review **W2** (⚠️ WARNING, Scope Discipline) — **already fixed**, recorded so it does not recur
- **Where**: repository root of the main checkout; the practice belongs with whoever writes
  `## Manual Verification` rows in a plan (here, `plan.md` Phase 2 rows 2.6–2.8).
- **What**: the implementer's browser-geometry step wrote `signin-desktop.png` (219 KB) to
  the repo root. `git check-ignore` returns non-zero — it is not ignored — so it surfaced in
  `git status` on `matmaverse-v2`, which the agent contract requires to stay clean, and
  nothing in `context/` referenced it. This review deleted it.
- **Suggested**: write manual-verification scratch output to `$TMPDIR`, or add a screenshot
  glob to `.gitignore` if such artifacts are wanted at all. Do not attach them to a change
  folder unless a document actually cites them.

## Recorded observations (no action expected)

- **O1** — `src/lib/supabase.ts` imports `authCookieMaxAge` from `src/lib/services/remember-me.ts`,
  inverting the usual layer direction. No cycle exists today (nothing in `src/lib/services/`
  imports `@/lib/supabase`); it becomes one the moment a service needs `createClient`.
- **O2** — the remembered window does not slide: `REMEMBER_ME_MAX_AGE_SECONDS` is fixed at
  sign-in by `setRememberChoice`, so a parent active for more than 30 days is downgraded to a
  session cookie once. Accepted as AD-4.
- **O3** — `cn()` wraps a single static class literal on the remember-me row `<div>` in
  `src/components/auth/SignInForm.tsx`; nothing to merge.
- **O4** — `createCookieJar` in `tests/helpers/astro.ts` deletes entries outright while real
  `AstroCookies.delete()` records an expired set. Checked and harmless for the current
  assertions (`AstroCookies.get()` returns `undefined` in both models), but it is why
  plan-review **F4** — "no automated test asserts what the *browser* is told" — remains open.
