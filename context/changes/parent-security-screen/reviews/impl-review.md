<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Parent PIN change ("Zabezpieczenia")

- **Plan**: `context/changes/parent-security-screen/plan.md`
- **Scope**: all 3 phases (23/23 Progress rows `[x]`), commits `3d43c3c` · `f5417e8` · `ae5fa42` · `3e2a510`, branch `feat/parent-security-screen` cut from `feat/ui-polish` (`64e3373`)
- **Date**: 2026-08-23
- **Reviewed as**: a **security change first**, a feature second — every implementer claim below was re-derived, not taken on trust
- **Verdict**: **APPROVED** — mergeable as-is; two non-blocking follow-ups recorded
- **Findings**: 0 critical · 2 warnings · 4 observations

## Autonomous decisions taken this step

Run `context/runs/2026-08-22-autonomous-five` has no human in the loop (agent contract, hard rule 1),
so the skill's closing prompt ("Triage findings / Save & triage later / Save only") and its per-finding
triage questions were **decided, not asked**.

- **Chose "save the report, then self-triage".** Rejected leaving findings PENDING for a human.
- **Chose to fix nothing in `src/`.** The standing brief permits direct fixes on this branch for
  CRITICAL findings only, when small and unambiguous. **There are no CRITICAL findings.** Both
  WARNINGs are documentation/evidence items whose right home is a follow-up, not a drive-by commit on
  a security branch whose whole value is a narrow, reviewable diff.
- **Chose not to raise a blocker over K1.** See F1: the risk is real but the plan's own framing
  ("permanent lockout") overstates it, and correcting the framing is worth more than blocking.
- **What would change the answer:** a reachable bypass of the change gate (none found), or a red gate
  (all four gates observed green).

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING (F1) |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING (F2) |

► **Overall: APPROVED**

---

## Part 1 — The security re-derivation (the part that matters)

I mounted my own attack on `src/pages/api/parent/pin/set.ts` as it now stands, tracing **every** branch
rather than the happy path. The question asked: *can any caller holding a valid `parent_verified`
marker but NOT the current PIN change that PIN?*

**Answer: no. I could not find a path.**

### The handler, branch by branch

| # | Line | Guard | Failure mode | Reachable bypass? |
|---|---|---|---|---|
| 1 | `:47-48` | `createClient` → 503 | no RLS client | no |
| 2 | `:50-53` | `auth.getUser()` → 401 | no session | no |
| 3 | `:59-60` | `pinExists` → `null` → **503** | DB error | no — **fail-closed**; `null` never falls through to the open first-set path |
| 4 | `:62-65` | `isChange` → `verifyMarker` → 403 | stale/forged/absent marker | no — HMAC + account binding + expiry, `timingSafeEqual` |
| 5 | `:67` | `request.formData()` | non-form body throws → 500 | no (see F4) |
| 6 | `:72-73` | zod → 400 `invalid` | any malformed part | no |
| 7 | `:83-84` | `const currentPin = parsed.data.currentPin` | — | — |
| 8 | `:85` | `if (!currentPin) return 400` — **early return** | field omitted | no |
| 9 | `:90-91` | `verifyPin` under the atomic throttle | wrong / locked / no-pin / error | no |
| 10 | `:96` | `currentPin === pin` → 400 `same-as-current` | no-op change | no — and it is **after** 9, so it cannot be a free pre-flight |
| 11 | `:99` | `setPin` | — | reachable on a change path **only** after a `verifyPin` that returned `ok` |

### Hostile inputs — each tried, each closed

| Input | Where it dies | Attempt burnt? |
|---|---|---|
| `currentPin` omitted | `FormData.get()` → `null` → `?? undefined` → zod passes (`.optional()`) → **`!currentPin` → 400** | no |
| `currentPin=""` | zod regex `^\d{4,6}$` → 400 | no |
| `currentPin="null"` | zod regex → 400 | no |
| literal `null` | cannot survive `FormData`; normalised to `undefined` before parse | no |
| wrong length (`"12"`, `"1234567"`) | zod regex → 400 | no |
| non-digits (`"12a4"`, `" 1234"`) | zod regex → 400 | no |
| a **File** part (`form.get` returns `File`) | `z.string()` rejects → 400 | no |
| **duplicated** `currentPin` field | `FormData.get()` returns the **first** value; that same value is what `verifyPin` checks — no split-brain | as normal |
| array / object body | `FormData` is flat; `getAll` is never used; zod `z.string()` does not coerce | n/a |
| `__proto__` / `constructor` keys | never read; the parse input is a fresh object literal with two fixed keys; zod strips unknowns | n/a |
| `"0000"` (a *valid* PIN that is falsy-looking) | **truthy string** — the `!currentPin` check cannot swallow it | as normal |
| wrong `currentPin` | `verifyPin` → 401 `wrong` | **yes, exactly one** |
| correct `currentPin`, live lock | `verifyPin` short-circuits on `locked_until` → 429 | no (already locked) |

**Type confusion / zod coercion:** none available. `z.string()` is non-coercing; `.optional()` accepts
`undefined` only, never `null`; the regex is fully anchored and JavaScript's `$` matches end-of-input
(no Python-style trailing-newline hole). The only two shapes `parsed.data.currentPin` can hold at
`:84` are `undefined` or a 4–6 digit string.

**No `!` assertion, no `?? ""`, no truthiness-gated verification** — confirmed by reading. The early
`return` at `:85` *is* the TypeScript narrowing, which is the structurally right choice: a
`currentPin!` would have survived a later edit that drops the guard.

### The throttle is real — verified, not assumed

- `verifyPin` (`src/lib/services/parent-pin.ts:104-131`) is the **only** exported reader of `pin_hash`;
  `matchesPin`/`hashPin` are module-private. `grep` over `src/` confirms **no route compares a hash
  inline** — the only three `verifyPin` call sites are `pin/set.ts:90`, `pin/verify.ts:34`,
  `account/delete.ts:59`.
- Wrong PIN → `register_pin_failure` RPC — one row-locked `UPDATE`, `security invoker`, pinned by
  `where s.account_id = auth.uid()` (`supabase/migrations/20260702120000_...sql:22-30`). Atomic, and
  it cannot touch another account's row.
- `locked_until` is checked **before** `matchesPin`, so a live lock refuses even the correct PIN.
- **Test 4b is the oracle** and it is real: `tests/parent-pin-routes.test.ts:157-186` drives 5 wrong
  attempts to 429, then submits the **correct** PIN and asserts 429 with `pin_hash` unchanged,
  `failed_attempts ≥ 5` and `locked_until` still in the future.

**`setPin`'s throttle reset — better, worse, or unchanged?** The implementer's claim holds, with one
nuance they did not state.

- `setPin` (`parent-pin.ts:85-96`) unconditionally writes `failed_attempts: 0, locked_until: null`.
- **Before** this change: a marker-holder could POST `/api/parent/pin/set` on an existing PIN, reach
  `setPin`, and silently clear a live lockout — a free throttle reset. **This change closes it**:
  `verifyPin` now stands in front, and a live lock returns 429 before `setPin` is reached.
- **So: strictly better.** *Nuance:* that free reset was also, in principle, the only in-app escape
  from K1's sticky counter — but it was never reachable by a real parent (no UI called that path; the
  plan and `tests/parent-pin-routes.test.ts:83` both record it as direct-POST-only), so closing it is
  not a practical regression. Recorded in F1.

### First-time set is untouched — verified

`isChange === false` skips the marker guard **and** the whole change gate, exactly as before. Covered
by `tests/parent-pin-routes.test.ts:89-97` ("first-time set is open, stores the PIN, and mints a
parent_verified marker"), which posts **only** a `pin` field via the untouched `setCtx` helper. That
test is unmodified in the diff and passes. `account_settings.pin_hash` is `not null`, so
`pinExists === true` always implies a usable hash — there is no "row exists but no PIN" state that
could strand onboarding.

### Deliberate-break check — re-run by me, independently

I did not take D14 on trust. I re-applied **both** break shapes to the shipped route and ran
`tests/parent-pin-routes.test.ts`, then restored (`git checkout --`; `git status --porcelain src/`
clean afterwards, both times).

| Break | Result | Tests that went red |
|---|---|---|
| **1. Truthiness-gated verification** — presence check deleted, `verifyPin` wrapped in `if (currentPin) {…}` (F1's "natural implementation", a full bypass) | **2 failed / 14 passed** | *"a marker WITHOUT currentPin no longer changes the PIN: 400 'invalid', nothing written, no attempt burnt"* and *"a new PIN equal to the current one is 400 'same-as-current', checked AFTER verifyPin"* |
| **2. `verifyPin` skipped** on the change path, presence check kept | **2 failed / 14 passed** | *"a wrong currentPin is 401 'wrong' and burns exactly one throttle attempt"* and *"the throttle locks the change path, and a LIVE lock rejects even the CORRECT current PIN"* |

Both reproduce D14 **exactly as reported**. The security tests can fail, and they fail on the right
assertions. This is the strongest evidence in the change and it holds up.

### Gates — run by me, on this branch, this session

Sandbox disabled (it blocks `127.0.0.1:54321`); no stray dev server on 4321/4322; Supabase REST
answering 200.

| Gate | Claimed | **Observed** |
|---|---|---|
| `npm test` | 299 → 312 | **312 passed / 312 (40 files)**, 34.9s ✅ |
| `npm run lint` | clean | **clean**, no output ✅ |
| `npm run check` | 0 errors / 0 warnings | **0 errors, 0 warnings, 8 hints** (all pre-existing, `src/pages/app.astro`) ✅ — the handoff says "10 hints"; the tool reports 8. Cosmetic miscount, no impact. |
| `npx playwright test` | 15 → 16 | **16 passed** (28.1s), incl. `parent-surfaces.spec.ts:75 › change PIN` ✅ |

Every claim reproduced.

---

## Findings

### F1 — K1 (the sticky `failed_attempts` counter) is recorded only inside the change folder, and its severity is overstated

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `context/changes/parent-security-screen/plan.md:923-942` (K1), `docs/reference/contract-surfaces.md:57-66` (where it is absent)
- **Detail**:
  Two separate problems, one finding.

  **(a) Where it lives.** K1 is recorded in `plan.md → ## Known risks` and in `handoff.md`. Both are
  correct per project convention — but both live in `context/changes/parent-security-screen/`, which
  `/10x-archive` moves wholesale into `context/archive/`. This change *did* edit the one durable,
  repo-level doc that a maintainer reads when touching this surface —
  `docs/reference/contract-surfaces.md`, new section *"Parent PIN routes (RLS surface)"* — and that
  section documents the gate order, the first-set/change split and the `STATUS_FOR` vocabulary, but
  **says nothing about the sticky counter**. `grep failed_attempts docs/` returns only the column
  listing. So the one place a future implementer of this route will actually look does not carry the
  risk this change made easier to reach.

  **(b) The framing is wrong, in the safe direction for shipping.** K1 says a mistyped current PIN
  turns into "a permanent 1-guess-per-minute lockout" and, with K2, "a permanent lockout with no
  recovery path". I traced `verifyPin` (`parent-pin.ts:104-131`) and that is **not** what happens:
  `locked_until` is checked first, and once the 60 s has lapsed a **correct** PIN matches and resets
  `failed_attempts` to 0 and `locked_until` to null (`:118-124`). So a parent who *remembers* their
  PIN waits ≤60 s and is back in, with the counter cleared. K1 is a **degraded rate limit** (one guess
  per minute) that persists only while the parent keeps guessing wrong — it is **not** an
  unrecoverable state. The genuinely unrecoverable state is **K2** (forgot the PIN entirely), which
  pre-dates this change completely and is untouched by it.
- **Is the feature shippable with K1 open? YES — stated plainly.** The realistic worst case is a
  parent who mistypes five times and is then throttled to one attempt per minute until they get it
  right. That is annoying, not destructive; it affects only their own account; and it is the *correct*
  behaviour of a brute-force throttle seen from the outside. K1 should still be the next change
  (alongside or ahead of K2), but it does not gate this branch.
- **Fix**: add a two-line *"Known limitation"* bullet under the new "Parent PIN routes (RLS surface)"
  section of `docs/reference/contract-surfaces.md`, naming the sticky counter, its one reset path
  (a correct PIN, or `setPin`), and the fact that this route deliberately no longer offers the second;
  and correct K1's wording in `plan.md` from "permanent lockout" to "persistent 1-guess-per-minute
  throttle until a correct PIN is entered; unrecoverable only when combined with K2".
  - Strength: puts the risk in the doc this change already touched, so the next person to edit the
    route reads it without excavating an archived change folder; and stops an overstated risk from
    driving an over-scoped fix later.
  - Tradeoff: two docs edited; the plan's risk register is amended after the fact.
  - Confidence: HIGH — verified by reading `verifyPin`'s reset branch and by `grep` over `docs/`.
  - Blind spot: I did not empirically drive a 6th-attempt-after-expiry cycle against the live DB
    (it needs a 60 s wall-clock wait); the conclusion is from the code path plus test 4b's observed
    behaviour.
- **Decision**: DEFERRED → `follow-ups/review-fixes.md` (documentation change; not CRITICAL, so not
  fixed directly on this branch)

### F2 — Criterion 2.6's browser evidence was deleted; `/app/report` has zero committed coverage below `lg`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `context/changes/parent-security-screen/plan.md:1022` (row 2.6), `playwright.config.ts:50-53`
- **Detail**:
  Row 2.6 ("at 712px the report reads report → change PIN → rail → danger zone, nothing overflows") is
  ticked with the **`ae5fa42` (p3)** SHA, but the artifact that proved it — `e2e/_tmp712.spec.ts` —
  was deleted and never committed. So the commit named by the row contains nothing that demonstrates
  it. Compounding this: `playwright.config.ts:51` scopes the `touch` project with
  `testMatch: /gameplay-restore\.spec\.ts/`, so `parent-surfaces.spec.ts` — and therefore the entire
  `/app/report` page including the new card — **never runs below `lg` in CI**. The new e2e is
  `desktop`-only, which the plan itself acknowledges at Phase 3.

  **Judgement on whether that is acceptable evidence:** as a *one-time observation* it is honest and
  better than an unchecked box — the implementer measured real offsets (`20 / 195 / 432 / 787`) and
  `scrollWidth === clientWidth === 712`, and I independently confirmed the DOM order those numbers
  imply (`report.astro:56-84`: report → `ChangePinSection` → `<aside>`, with the danger zone carrying
  `order-last`). As *regression protection* it is worth nothing. The row asserts a property of a
  layout that any future grid edit can break silently.

  I judge the **evidence acceptable for row 2.9** (the committed e2e genuinely asserts the success line
  and the unchanged URL — `parent-surfaces.spec.ts:92-93`) and **not acceptable for row 2.6**, which
  should either become an assertion or stop claiming a SHA.
- **Fix**: widen the `touch` project to `testMatch: /(gameplay-restore|parent-surfaces)\.spec\.ts/` so
  the change-PIN journey also runs at 712px (19 runs), **or**, if that cost is unwanted, restate row
  2.6 as "observed once at `ae5fa42`, not asserted — no committed regression guard".
  - Strength: the first option converts a one-shot observation into a standing guard on the page's
    only phone-width layout risk, at the price of ~3 extra runs.
  - Tradeoff: `parent-surfaces.spec.ts` provisions and deletes accounts per test; running it twice
    doubles that churn and lengthens the suite.
  - Confidence: HIGH — `playwright.config.ts:51` is the whole mechanism and the change is one regex.
  - Blind spot: I have not run `parent-surfaces.spec.ts` under the `touch` project, so I cannot
    promise the radix dialog test in that file passes at 712px — that is exactly why it is a
    follow-up rather than a drive-by edit.
- **Decision**: DEFERRED → `follow-ups/review-fixes.md`

### F3 — `pinExists` and `verifyPin` rely on RLS alone; neither filters by `account_id`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/lib/services/parent-pin.ts:65-68` (new), `:105-109` (pre-existing)
- **Detail**: Both do `.from("account_settings").select(…).limit(1)` with **no** `.eq("account_id", …)`,
  taking `data[0]` / `data.length > 0`. Correct today: the client is the request-scoped RLS client and
  the four policies pin every operation to `auth.uid() = account_id`. But `limit(1)` over an
  unfiltered select means the *safety* of both functions is entirely the policy's, with no
  defence-in-depth in the code. This codebase already constructs a service-role client one directory
  away (`account/delete.ts` → `createAdminClient()`); if either function were ever handed one, it
  would silently read an **arbitrary** account's row. `pinExists` is new code that copies the shape
  from `hasPin`, so this is inherited, not introduced — flagging it because `pinExists` is now a
  security gate and `hasPin` was not.
- **Fix**: add `.eq("account_id", accountId)` to both, sourcing `accountId` from `currentUserId(client)`
  (the helper already exists at `:49-54` and `setPin` already uses it) — belt-and-braces over RLS,
  never client input (L-002).
- **Decision**: DEFERRED → `follow-ups/review-fixes.md` (low priority; touches a pre-existing function)

### F4 — `await context.request.formData()` is unguarded: a non-form body is a 500, not a 400

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/pages/api/parent/pin/set.ts:67`
- **Detail**: A POST with `Content-Type: application/json` (or a truncated multipart body) makes
  `formData()` reject; nothing catches it, so Astro surfaces a 500 where the contract says 400
  `invalid`. **Not a bypass** — it happens after the marker guard and long before any comparison, and
  no state is written. It is also **verbatim the existing pattern**: `account/delete.ts:53` and
  `parent/pin/verify.ts` do exactly the same. Noting it so the route is not mistakenly credited with
  hardening it, and so a future `try/catch` lands on all three at once rather than one.
- **Fix**: none here — if it is worth fixing it is worth fixing across all three routes in one change.
- **Decision**: SKIPPED (pre-existing, consistent, non-exploitable)

### F5 — Locator hygiene: `pinLabel` really is a substring of `newPinLabel`; no live collision, guarded only by convention

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/i18n/pl.ts:358` vs `:372`
- **Detail**: Verified against the dictionary: `pinLabel = "PIN (4–6 cyfr)"` is an exact substring of
  `newPinLabel = "Nowy PIN (4–6 cyfr)"`, so `getByLabel(pinLabel)` would match both if they ever
  co-rendered. **They cannot today**: `pinLabel` lives only in `ParentPinGate` on `/app/parent-pin`,
  and `/app/report` redirects to that page whenever the marker is absent — the two pages are mutually
  exclusive by construction. The three labels *inside* the new card are mutually non-substring
  (`"Obecny PIN"` / `"Nowy PIN (4–6 cyfr)"` / `"Powtórz nowy PIN"`), and both new test files locate by
  the specific labels, never by `pinLabel` — `tests/change-pin-section.test.tsx:17-18` even documents
  why. **Accessibility tree at 712px:** `ChangePinSection` renders exactly once with no
  `hidden`/`lg:hidden` responsive duplication, one `<h2>` (`:95`), and the page's only `<h1>` comes
  from `AppShell.astro:152` — so one copy of each name at every width. Confirmed statically; the
  `getByRole("region", { name })` scope resolves uniquely in the passing e2e, which is the empirical
  half of the same proof.
- **Fix**: none needed. If a future screen ever renders the gate and the change card together, the fix
  is `getByLabel(t.parentPin.pinLabel, { exact: true })`, not a rename.
- **Decision**: SKIPPED (K6 confirmed accurate and currently inert)

### F6 — Scope discipline is clean; the "not doing" list was respected exactly

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: `git diff --name-status 64e3373 HEAD` (15 files: 6 change-folder docs, 9 real)
- **Detail**: Checked every guardrail from `## What We're NOT Doing` against the diff, and it holds:
  **no** toggle in any form (decorative or persisted); the **"Bezpieczne środowisko" card is
  byte-identical** — the only edit inside `report.astro`'s rail is the `<aside>`'s
  `lg:row-span-2 → lg:row-span-3`, which is the grid bookkeeping the plan itself mandates, and it is
  **not** renamed to the mockup's "Bezpieczne ustawienia"; **no** `/app/security` route, **no** fifth
  nav tab, **no** new endpoint, **no** migration, **no** `PROTECTED_ROUTES` edit, **no**
  `requireParent()` extraction (D6), **no** `getByTestId`, **no** artwork (the card's icon is
  `lucide`'s `KeyRound`). `src/lib/services/parent-pin.ts` gained `pinExists` **additively** —
  `hasPin`'s fail-open contract is preserved exactly (`(await pinExists(c)) === true`, so `null` still
  reads as `false`) and its one caller (`parent-pin.astro:13`) is untouched. Recording this as a
  positive finding because "nothing crept in" is a result the reviewer was asked to certify, not an
  absence of one.
- **Fix**: none.
- **Decision**: NO ACTION

---

## Success criteria audit

All 23 Progress rows re-checked. **21 are backed by evidence I reproduced.** Two are commentary:

| Row | Status | Evidence I observed |
|---|---|---|
| 1.1 / 2.1 / 3.3 lint | ✅ | `npm run lint` clean |
| 1.2 ≥305 · 2.2 ≥312 · 3.4 | ✅ | `npm test` → **312/312**, 40 files |
| 1.3 route tests incl. first-time set | ✅ | file green; the `:89` first-set case is unmodified in the diff |
| 1.4 `parent-pin.test.ts` / isolation unmodified | ✅ | both untouched in `git diff --name-status`, both green |
| 1.5 / 2.5 / 3.1 playwright | ✅ | **16 passed**, incl. the new `parent-surfaces.spec.ts:75` |
| 1.6 `prerender = false` | ✅ | `set.ts:14` |
| **1.7 deliberate break** | ✅✅ | **re-run by me in both shapes — 2 red each, correct assertions, restored clean** |
| 1.8 guard order vs `delete.ts:41-64` | ✅ | matches step for step (503 → 401 → 403 → 400 zod → `verifyPin` → second check → action), plus one extra fail-closed 503 for `pinExists` and the change-only conditionality |
| 2.3 / 2.4 island tests, no literals | ✅ | 7 tests green; `ChangePinSection.tsx` carries no Polish literal — every string via `copy.*` / `t.deletion.*` |
| **2.6 712px layout** | ⚠️ | **see F2** — evidence deleted, no committed guard |
| 2.7 one `h1` | ✅ | only `AppShell.astro:152`; the card is `<h2>` |
| 2.8 safety card byte-identical | ✅ | confirmed in `git diff` |
| 2.9 success line, no navigation | ✅ | genuinely asserted at `parent-surfaces.spec.ts:92-93` |
| 3.2 existing e2e unmodified | ✅ | both pass; the diff only adds |
| 3.5 / 3.6 stability, no leaked users | ✅ (inherited) | not re-run; my own full pass was green and provisions/deletes in `finally` |

## What I checked that the plan did not ask for

- Re-derived the whole change gate as an attacker (table above), including duplicated fields,
  `File` parts, prototype-polluting keys and zod coercion — no path found.
- Confirmed `register_pin_failure` is `security invoker` and `where s.account_id = auth.uid()`, so the
  new caller cannot throttle a foreign account.
- Confirmed `account_settings.pin_hash` is `not null`, closing the "row exists, no hash" edge that
  would otherwise have stranded onboarding behind a `no-pin` 400.
- Confirmed `verifyPin` is the sole reader of `pin_hash` in `src/` and that no route compares inline.
- Re-ran **both** deliberate breaks rather than trusting D14.
