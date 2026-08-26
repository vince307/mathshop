---
change_id: rf1-session-cookie-on-email-links
title: RF-1 — pin browser-session auth-cookie lifetime on the email-link paths
status: archived
created: 2026-08-26
updated: 2026-08-26
archived_at: 2026-08-26T19:32:15Z
---

## Notes

Closes **RF-1**, left open by `remember-me-on-login`
(`context/foundation/backlog.md` § Shipped → A3).

**The decision (made 2026-08-26, by the maintainer): keep the current
behaviour — the email-link paths yield a browser-session auth cookie — and pin
it with tests.** Rationale: 30 days is a choice the parent makes by ticking
"Zapamiętaj mnie" on a device they consider theirs. Clicking a link in an email
is not that choice, and this product's parent surface is PIN-gated precisely
because the device may be shared with the family. Session-scoped is the safe
default; `setRememberChoice(cookies, true)` in `confirm` / `update-password`
was considered and rejected.

### The backlog's description is stronger than the facts

Verified on `matmaverse-v2`, 2026-08-26:

- It is **not a sign-out**. `setAll` (`src/lib/supabase.ts:54`) stamps
  `maxAge: authCookieMaxAge(cookies)`, which is `undefined` without the marker →
  the auth cookie carries no `Max-Age` and dies with the browser session. The
  parent stays signed in; the session simply does not survive a browser restart.
- **`POST /api/auth/signup` is not affected in production.** With
  `enable_confirmations = true` (prod) `signUp` returns `session: null`, so the
  route writes no auth cookie at all. It only writes one on a local stack, where
  `supabase/config.toml:221` has confirmations off.
- The genuinely affected routes are **`GET /api/auth/confirm`** (`verifyOtp` —
  both `signup` verification and `recovery`) and
  **`POST /api/auth/update-password`**.
- When the marker is already present in that browser (the parent signed in with
  the box ticked earlier), both routes **inherit the 30 days**. The behaviour is
  already consistent; nothing about it was ever asserted.

So the real defect is the missing test, not the behaviour: a refactor of `setAll`
could flip this in either direction silently.

### Why `signup` gets no test

A signup test would assert the local-only configuration. Under prod config there
is no auth-cookie write to assert on, so the test would break the moment someone
flips `enable_confirmations` on locally to exercise the confirmation mail — a
test whose truth depends on a config toggle is worse than a documented sentence.
Covered in `docs/reference/contract-surfaces.md` instead.

## What shipped

No planning artefacts: the decision was the whole design question, and once it was
made the work was four assertions and two documents. Straight `/10x-new` →
implement, deliberately.

**Code changed: none.** `git diff src/` is empty — the behaviour under test was
already correct. That is the point of the change.

- `tests/remember-me-cookie.test.ts` — tests **8–11**, in a second `describe`.
  8/10 pin browser-session on a fresh browser (and that `confirm` mints no
  marker); 9/11 pin that an already-remembered browser keeps its 30 days, so the
  behaviour cannot drift in *either* direction. 11 also asserts the reset does not
  clear the marker — `signOut({ scope: "others" })` must not revoke this device.
- `docs/reference/contract-surfaces.md` — the "Reach beyond sign-in" bullet is
  rewritten from *accepted* to *decided*, with the corrected facts and an explicit
  "re-decide the policy, do not edit the tests" instruction; a new bullet records
  why `signup` is out of the surface.
- `context/foundation/backlog.md` — A3's `Left open (RF-1…)` note replaced with the
  closure and the two corrections.

### A trap in the jar, worth knowing before touching 10/11

`createCookieJar` is a `Map` keyed by cookie **name**, so the recovery hop's own
auth-cookie write would satisfy an assertion made after `update-password` — the
test would pass without `update-password` writing anything. Hence `carryOver()`
(replay into a fresh jar, values only) plus `freshAuthCookieWrite()`, which fails
if the matched cookie carries no `options` object, i.e. was never written by the
route under test.

### Verification

- `npm run test` — **544 passed / 57 files** (540/57 before; +4, all mine).
- `npm run lint` — clean. `npm run check` — 0 errors, 0 warnings (8 pre-existing
  hints in `src/pages/app.astro`, untouched).
- **Deliberate-break check, both directions, run and observed:**
  - `setRememberChoice(context.cookies, true)` in `confirm` → **8 and 10 red**, 9
    others green.
  - `authCookieMaxAge` forced to `undefined` → **2, 4, 9 and 11 red**.
  - Both breaks reverted; `git diff src/` verified empty afterwards.
- E2E not run: the diff contains no runtime code, so the browser envelope is
  unchanged by construction.
