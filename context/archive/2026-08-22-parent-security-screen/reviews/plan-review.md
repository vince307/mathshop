<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Parent PIN change ("Zabezpieczenia") Implementation Plan

- **Plan**: `context/changes/parent-security-screen/plan.md`
- **Mode**: Deep (security review — this plan changes authentication behaviour and will be implemented unattended)
- **Date**: 2026-08-22
- **Verdict**: **REVISE → SOUND after fixes** (all findings triaged in this run; see Triage summary)
- **Findings**: 1 critical, 6 warnings, 3 observations

> **Autonomous run.** `context/runs/2026-08-22-autonomous-five/agent-contract.md` hard rule 1: no
> human in the loop. The skill's interactive triage was **decided, not asked** — every finding was
> triaged by the reviewer under the standing policy: CRITICAL fixed directly in `plan.md`, WARNING
> fixed if clear and contained else recorded under `## Known risks`, OBSERVATION recorded only.

## Verdicts

| Dimension | Verdict (pre-fix) | After fixes |
|-----------|-------------------|-------------|
| End-State Alignment | PASS | PASS |
| Lean Execution | PASS | PASS |
| Architectural Fitness | PASS | PASS |
| Blind Spots | **FAIL** (F1 critical; F2, F3, F4) | PASS with 1 recorded risk (K1) |
| Plan Completeness | **WARNING** (F5, F6, F7) | PASS |

► Overall: **REVISE** → **SOUND** after the applied fixes.

## Grounding

Grounding: 12/12 paths ✓, 9/9 symbols ✓, brief↔plan ✓, Progress↔Phase ✓ (3 phases, 21 criteria, all
mapped, no stray checkboxes in phase bodies), contract-surfaces H2 sweep ✓ (`public.account_settings`
hit — plan reports its shape accurately and changes nothing about it).

## What was verified, and held

These are the security questions this review was specifically asked to answer. All were checked
against code, not against the plan's own summary.

1. **The live hole is real, and closing it breaks no legitimate caller.**
   `src/pages/api/parent/pin/set.ts:31-34` checks the marker and then falls straight through to
   `setPin` at `:40`. There is **no** PIN check on that path today. The only production client is
   `src/components/parent/ParentPinGate.tsx:54`, which posts to `/set` **only** when
   `mode === "set"`, and `src/pages/app/parent-pin.astro:13-14` renders `set` mode **only** when
   `hasPin()` is false. So nothing in `src/` has ever exercised the marker-only change path. Exactly
   one test depends on it (`tests/parent-pin-routes.test.ts:83`), and the plan updates it
   deliberately with its own replacement assertion. **No CRITICAL finding here** — the plan treats the
   closure as a deliberate behaviour change with its own tests (route tests 1 and 2).

2. **The throttle is genuinely shared, not re-implemented.** The plan routes `currentPin` through
   `verifyPin` (`src/lib/services/parent-pin.ts:87-120`) — the only exported function that reads
   `pin_hash` (`matchesPin`/`hashPin` are module-private). Its wrong branch calls
   `register_pin_failure`, verified at
   `supabase/migrations/20260702120000_pin_failure_throttle_rpc.sql:16-33` as `security invoker`,
   `set search_path = ''`, pinned by `where s.account_id = auth.uid()`, doing the increment and the
   lockout decision in **one** atomic UPDATE. `verifyPin` also short-circuits on a live `locked_until`
   *before* any comparison. The route compares nothing itself.

3. **First-time set is genuinely untouched.** `isChange` is false when no row exists, so the marker
   guard, the `currentPin` requirement and `verifyPin` are all skipped — byte-identical behaviour.
   Confirmed unaffected: `tests/parent-pin-routes.test.ts:52` (the load-bearing onboarding case),
   `:63`, `:93`, the `describe("POST /api/parent/pin/verify")` seed at `:104`, the lockout suite's
   seed at `:128`, every `setPin()` call in `tests/parent-pin.test.ts`, `tests/account-deletion.test.ts`
   and `tests/profile-deletion.test.ts`, and both e2e uses of `setPinAndLandOnReport`
   (`e2e/parent-surfaces.spec.ts:43`, `:78`) — all on freshly provisioned, PIN-less accounts.

4. **Placement holds on every path.** `/app/report` is SSR (`astro.config.mjs:11` `output: "server"`,
   no `prerender` on the page). `src/middleware.ts:5` gates all of `/app` for **auth**;
   `src/pages/app/report.astro:22-29` *additionally* re-verifies the signed marker on **every render**,
   including a direct URL hit — absent, expired or tampered marker → `Astro.redirect("/app/parent-pin")`.
   There is no cached or static path to the page. The island therefore cannot render outside the gate,
   and the route it calls carries the gate independently.

5. **CSRF posture is sound and improves.** Both the Supabase auth cookies (`src/lib/supabase.ts:13-15`)
   and the `parent_verified` marker (`parent-pin.ts:167-173`) are `httpOnly` + `sameSite: "lax"`, so a
   cross-site form POST carries neither → 401 or 403 before any state change. Requiring `currentPin`
   raises the bar further.

6. **The scope collapse is honest, not convenient.** Both PRD non-goals were re-read: PRD v3 **:158**
   (*"No monetization mechanic — ever…"*) and **:161** (*"No full parent dashboard. Only the minimal
   read-only weekly report ships; goal-setting, difficulty controls, time limits, and settings UI are
   out."*). Content matches the plan's claims exactly; only the line numbers were wrong (F6). `:161`
   independently rules out an `/app/security` settings shell, which *strengthens* D3. Both mockup PNGs
   were opened: web draws **4** toggles, mobile **3** (`Kontrola poziomu trudności` is desktop-only) —
   the plan's central "tell" is correct. Neither mockup draws a current-PIN field; both show
   `Wpisz 4 cyfry` + `Potwierdź PIN` inside a "Krok 3 z 3" wizard, so the mockup is first-time set, not
   a change form. The web mockup's own footnote — *"PIN będzie wymagany przy zmianie ważnych ustawień
   oraz w panelu rodzica"* — actively supports D4. The "Bezpieczne środowisko" card ships today at
   `src/pages/app/report.astro:87-103` with `t.report.safetyHeading` + `safetyPoints` in `src/i18n/pl.ts`,
   and the plan leaves it byte-identical (Phase 2 manual criterion 2.8 asserts exactly that).

7. **Phase granularity is correct and fail-safe.** Each phase is independently committable and
   independently green. Phase 1 is a pure **tightening** with no client on the affected path, so
   stopping after it leaves auth strictly stronger, never half-changed. Phase 2 adds the only client
   of the new field. Phase 3 adds a browser test and changes no product code. There is no ordering in
   which a stopped run leaves an open door.

## Findings

### F1 — The `currentPin` gate is specified loosely enough that a natural implementation bypasses it

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it (the fix is narrow, but it is the security gate)
- **Dimension**: Blind Spots
- **Location**: Phase 1 → #1 The route → "Guard order, each a hard stop", steps 5–7
- **Detail**: The plan as written is *correct* — step 5 hard-stops with 400 when `isChange` is true and
  `currentPin` is absent. But it is specified as three independent tests of `isChange` (steps 5, 6, 7)
  in a flat list, in the same route the plan simultaneously warns is a null/undefined minefield
  (`FormData.get()` returns `null`; `z.string().optional()` rejects `null`; normalise with
  `?? undefined`). That combination is exactly how this gate ships broken:
  - `parsed.data.currentPin` is `string | undefined`, and TypeScript will **not** narrow it across a
    separate `if (isChange && !currentPin) return`. A flat implementation therefore *forces* either
    `currentPin!` or `currentPin ?? ""` — and a non-null assertion is precisely what silently survives
    a later edit that removes the guard above it.
  - If step 6 is written as `if (isChange && parsed.data.currentPin) { verifyPin(…) }` — the natural
    shape when the field is `optional()` — and step 5's presence check is ever written against `null`
    (`currentPin === null`), that check is **dead code**, because `?? undefined` guarantees it is never
    `null`. Result: omit the field and the PIN check is skipped entirely. Full bypass, with a marker
    only. This is the exact scenario the review was asked to hunt for.
  - Three separate `isChange` tests are three chances to get one wrong; nothing structural prevents
    reaching `setPin` on a change path with no `verifyPin`.
- **Fix ⭐ (applied)**: Replace the flat steps 5–7 with a **single `if (isChange) { … }` block**
  containing, in order: (a) `const currentPin = parsed.data.currentPin;` + early `return json(400)`
  when falsy — this `return` is the narrowing; (b) `verifyPin` + `STATUS_FOR` mapping; (c) the
  same-as-current comparison. Add an explicit **STRUCTURAL REQUIREMENT** paragraph forbidding non-null
  assertions and `?? ""` fallbacks, forbidding any truthiness-gated `verifyPin` call ("the presence
  check must `return`, never `skip`"), noting that a `=== null` absence check is dead code after the
  normalisation, and enumerating the rejected shapes (omitted → 6a; empty string, file part, non-digits,
  wrong length → zod).
  - Strength: makes the bypass *structurally* unreachable rather than merely prohibited — TypeScript
    narrowing does the enforcement, so `setPin` cannot be reached on a change path without `verifyPin`
    having returned `ok`.
  - Tradeoff: none material; it is the same shape as `account/delete.ts:54-64`, one nesting level deeper.
  - Confidence: HIGH — verified against the actual zod/`FormData` semantics in the route.
  - Blind spot: no test can prove the *structure*; Phase 1 manual criterion 1.7 (deliberate-break) and
    1.8 (top-to-bottom read) are the enforcement, and 1.7 will not run unattended (see F4).
- **Decision**: **FIXED** — `plan.md` Phase 1 §1 guard order rewritten.

### F2 — `hasPin`'s fail-open is now the sole gate separating "open first-time set" from "locked-down change"

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 1 → guard order step 3; "Known issues inherited, not widened"
- **Detail**: `hasPin` (`src/lib/services/parent-pin.ts:57-60`) destructures only `{ data }` and returns
  `(data?.length ?? 0) > 0` — a query **error** reads as "no PIN". On `set.ts` "no PIN" means *skip the
  marker guard **and** skip the `currentPin` requirement*, i.e. a transient DB/network error on that one
  select opens the whole change path to any authenticated session. The plan acknowledges this and
  hoists `hasPin` to a single call so the two guards cannot disagree — good, and necessary — but a
  single call to a fail-open predicate is still a fail-open gate. Pre-existing, yes; but this change is
  what makes it load-bearing for a real user-facing form, and "inherited" is not the same as "safe".
  Not exploitable at will (the attacker cannot induce the error selectively), which is why this is a
  WARNING and not a CRITICAL.
- **Fix ⭐ (applied)**: Add Phase 1 §1b — an **additive** `pinExists(client): Promise<boolean | null>`
  in `parent-pin.ts` returning `null` on query error; re-express `hasPin` as
  `(await pinExists(client)) === true` so its contract and every existing caller
  (`parent-pin.astro:13`) are untouched; `set.ts` calls `pinExists` and returns `503` on `null`.
  - Strength: fail-closed on the security-critical path, ~6 lines, zero behaviour change elsewhere,
    no signature change to `hasPin`.
  - Tradeoff: the `null` branch is untestable in this suite (real Supabase, no mocks) — stated
    explicitly in the plan and recorded as K3 rather than hidden.
  - Confidence: HIGH — verified `hasPin`'s only callers are `set.ts:31` and `parent-pin.astro:13`.
  - Blind spot: `parent-pin.astro` keeps the fail-open, so a query error there renders `set` mode; the
    hardened route now rejects that submission (400/403) — annoying, not unsafe.
- **Decision**: **FIXED** — `plan.md` Phase 1 §1b added; residual recorded as K3.

### F3 — No test proves the lock blocks a change carrying the *correct* current PIN — and `setPin` is a throttle-reset oracle

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 → #2 Route tests, test 4
- **Detail**: Two linked gaps.
  - The plan's five anti-bypass tests cover wrong-PIN increments and the 5-attempt lockout, but nothing
    asserts that a **live `locked_until` rejects a change request carrying the correct `currentPin`**.
    `verifyPin:96-98` does short-circuit on the lock, so the behaviour is inherited — but "inherited"
    is precisely what a route test exists to pin. The review brief asked for exactly this.
  - The sharper reason it matters: **`setPin` unconditionally writes `failed_attempts: 0,
    locked_until: null`** (`parent-pin.ts:73`). Verified repo-wide: it and `verifyPin`'s correct-PIN
    branch are the *only* two writers of `failed_attempts`. So **any** path that reaches `setPin` while
    locked is a free lockout reset — and today that path is live (a marker-only POST to
    `/api/parent/pin/set` clears the throttle outright). The new guard order closes it, but the plan
    never names the property, so a future reordering could silently reopen it with every test still
    green.
  - Two smaller versions of the same gap: test 2 (no `currentPin` → 400) asserts `pin_hash` unchanged
    but not `failed_attempts` unchanged; test 7 (no marker → 403) asserts neither.
- **Fix ⭐ (applied)**: Split test 4 into 4a (5th wrong attempt → 429, `pin_hash` original) and **4b**
  (correct `currentPin` **during** the live lock → 429 `"locked"`, `pin_hash` original,
  `failed_attempts` still ≥ 5, `locked_until` still in the future), labelled in the plan as *the
  throttle-reset-oracle assertion* with the `parent-pin.ts:73` reasoning inline. Add
  `failed_attempts` unchanged to tests 2 and 7. Add a standing rule above the list: every
  "did not change" assertion reads back through the service-role `admin` client (L-002), because a
  status-only assertion would pass against a route that returns 400 and *then* writes the PIN. Mirror
  the property in Critical Implementation Details ("never move `setPin` ahead of the change branch").
  - Strength: converts an inherited behaviour into a pinned contract, and names the invariant a future
    refactor would otherwise break invisibly.
  - Tradeoff: one extra `it()` (the count criterion is a floor, so this is absorbed).
  - Confidence: HIGH — RPC body and both `failed_attempts` writers read directly.
  - Blind spot: 4b must run inside the 60 s window; if it proves timing-flaky the fix is to assert the
    lock via an admin read of `locked_until` rather than by wall-clock.
- **Decision**: **FIXED** — `plan.md` Phase 1 §2 tests 2, 4, 7 and the read-back rule.

### F4 — The sticky `failed_attempts` counter turns a mistyped current PIN into a permanent lockout, and D7's reversal trigger cannot fire in an unattended run

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: D7; Manual testing step 3
- **Detail**: Verified: `register_pin_failure` has no decay, and nothing anywhere resets
  `failed_attempts` except a correct PIN or `setPin`. So once an account crosses 5 failures, the 60 s
  lock lapses with the counter still ≥ 5 and the *next* wrong PIN immediately re-arms a full cooldown —
  one guess per minute, indefinitely. This change **creates a new way to reach that state**: a form
  where the current PIN is typed from memory. With no forgot-PIN recovery (K2), a parent who mistypes
  five times lands in exactly the permanent-lockout scenario D4 was designed to prevent — reached by
  accident rather than by a hostile child. D7's decision to defer the fix is sound (fixing it means
  changing the same RPC this change newly calls, which would make a throttle test failure ambiguous).
  The problem is D7's *reversal trigger*: "if the Phase 3 e2e or manual testing shows a parent can hit
  the sticky lockout in normal use". The only surface that would show it is **Manual testing step 3**,
  which an unattended run does not execute — so the trigger would silently never fire.
- **Fix**: not contained here (it is a migration to the RPC this change newly calls — deferring it is
  right). **Recorded as K1** under a new `## Known risks` section, reframed from "pending discovery"
  to **"confirmed by reading"**, with the explicit note that D7's trigger will not fire unattended and
  that K1 should become the next change rather than something the implementer waits to observe.
- **Decision**: **RECORDED** — `plan.md` `## Known risks` K1.

### F5 — Route-test list double-counts: "7 new `it()`" against a "+6" success criterion, and test 1 duplicates the case it says to update

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 → #2 Route tests; Phase 1 Success Criteria
- **Detail**: The section lists "New `it()` blocks: 1–7" and *then* separately says to **update** the
  existing `it("reset succeeds WITH a valid marker …")` at `:83`. But test 1 ("change with a valid
  marker + correct `currentPin` → 200; the new PIN verifies and the old one 401s") **is** the updated
  `:83`. Following the text literally yields 7 additions plus an update = 306+, while the success
  criterion says "at least 305 (299 baseline + 6 new; test 1 replaces the updated `:83` case)". An
  implementer resolving this the other way ships a duplicated happy-path test and an unexplained count
  mismatch against a criterion an unattended gate will check numerically.
- **Fix (applied)**: Relabel test 1 as an explicit **in-place UPDATE** of `:83` with "do not add a
  second happy-path change test", making tests 2–7 the 6 net-new blocks. Reword the criterion as a
  floor: "299 baseline + **6 net-new**… If test 4 is split into two `it()` blocks the count is 306 —
  the criterion is a floor, not an equality."
- **Decision**: **FIXED**.

### F6 — Both PRD non-goal citations point at the wrong lines

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Scope collapse §3
- **Detail**: The plan cites "PRD v3:167" for the monetization non-goal and "PRD v3:170" for difficulty
  controls. The actual lines are **158** and **161**. The *content* is exactly as claimed — this is
  citation drift, not misrepresentation. But these two citations are the load-bearing evidence for
  dropping four of the five things this change was scoped to build, and the plan explicitly invites the
  maintainer to overrule from that paragraph. Evidence a reviewer cannot follow to the stated line is
  evidence that reads as unchecked.
- **Fix (applied)**: Corrected to `:158` / `:161`, both quoted in full, each flagged
  *"Re-verified 2026-08-22"* with the old number named so the drift is auditable. Also surfaced that
  `:161` names **"settings UI"** as out — which independently supports D3's rejection of an
  `/app/security` shell. Separately recorded the direct re-verification of the 4-vs-3 toggle "tell"
  against both PNGs, and the absence of a current-PIN field in either mockup.
- **Decision**: **FIXED**.

### F7 — The stated label-substring constraint checks the wrong string; the real collision is with `t.parentPin.pinLabel`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 → #1 Dictionary, "Constraint (load-bearing)"
- **Detail**: The plan requires the three new labels to be mutually non-substring and non-substring of
  `t.deletion.accountPinLabel` (`"PIN rodzica"`) — both of which hold. It misses the one that actually
  collides: `t.parentPin.pinLabel` is `"PIN (4–6 cyfr)"`, a case-insensitive **substring** of the
  proposed `newPinLabel = "Nowy PIN (4–6 cyfr)"`. Since Playwright's `getByLabel` matches substrings,
  `getByLabel(t.parentPin.pinLabel)` would match the new-PIN field. Harmless **today** only because the
  two never co-render (`pinLabel` lives on `ParentPinGate` at `/app/parent-pin`; its three uses at
  `e2e/parent-surfaces.spec.ts:27, :58, :63` are all on the gate page) — but the plan asserts a
  constraint it did not actually check, which is how the assertion stops protecting anything.
- **Fix (applied)**: Kept the label (the Polish is right) and documented the collision explicitly with
  the two containment rules: never use `getByLabel(t.parentPin.pinLabel)` in an `/app/report` context,
  and if a `pinLabel` field ever lands on the report page, rename `newPinLabel` rather than papering
  over it with `exact:` at each call site. Recorded as K6.
- **Decision**: **FIXED**.

### F8 — Success-criteria headings omit the template's trailing colons

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Completeness
- **Location**: all three phases
- **Detail**: `/10x-plan`'s template emits `### Success Criteria:` / `#### Automated Verification:` /
  `#### Manual Verification:` with colons; the plan writes them without. The canonical `## Progress`
  block — the part `/10x-implement` actually parses — is fully well-formed: exactly one `## Progress`
  heading at the bottom, one `### Phase N: <name>` per phase with names matching the body headings
  verbatim, every criteria bullet mapped to a `- [ ] N.M` entry (1.1–1.8, 2.1–2.9, 3.1–3.6), and no
  checkboxes anywhere in the phase bodies. No parse risk identified.
- **Decision**: **RECORDED ONLY** — cosmetic; not worth churning the plan.

### F9 — D9 (same-as-current) buys a small amount for a string, a status and a test

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Lean Execution
- **Location**: D9; Phase 1 guard step 6c; Phase 2 `errors.sameAsCurrent`
- **Detail**: Rejecting `currentPin === pin` costs a reason code, a dictionary key, a client branch and
  a route test, to prevent a no-op that would otherwise report success and re-mint the marker. The
  rationale is honest and the ordering (after `verifyPin`, per `delete.ts:62`) is right, so this is not
  a defect — just the one place the plan could be leaner if the extra error state proves noisy. D9
  already records that reversal condition and says removing it touches nothing else.
- **Decision**: **RECORDED ONLY**.

### F10 — "What We're NOT Doing" slightly overstates the `getByTestId` prohibition

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Completeness
- **Location**: What We're NOT Doing
- **Detail**: The plan says `e2e/CLAUDE.md` is binding that testids are not to be added. The file
  actually *permits* `getByTestId` as a documented fallback ("only when accessibility attributes are
  ambiguous (none exist in `src/` today — if you need one, that's a product finding to surface first)").
  The plan's practical conclusion is right and the stricter reading is harmless here — and the Phase 2
  `aria-labelledby` requirement is precisely the "surface it as a product finding" move the rules
  prefer. Worth noting only so the implementer does not treat a genuine ambiguity as unfixable.
  (`context.clearCookies({ name: "parent_verified" })` **is** sanctioned verbatim, and specifically
  in the parent-surfaces spec — which is exactly where Phase 3 puts the new test. `page.waitForTimeout`
  **is** forbidden, as the plan says.)
- **Decision**: **RECORDED ONLY**.

## Triage summary

```
Fixed in plan.md:  F1 (critical), F2, F3, F5, F6, F7          (6)
Recorded as risk:  F4 → Known risks K1                        (1)
Recorded only:     F8, F9, F10                                (3)

► Verdict after fixes: REVISE → SOUND
```

### Edits applied to `plan.md`

| Section | Change |
|---|---|
| Scope collapse §3 | PRD citations corrected `:167`→`:158`, `:170`→`:161`, both quoted; 4-vs-3 toggle tell and the absent current-PIN field re-verified against both PNGs (F6) |
| Critical Implementation Details | New bullet: `setPin` is a throttle reset, so `verifyPin` must gate every path reaching it (F3). New bullet: `getByRole("region")` is unique only because `DeleteAccountSection`'s `<section>` has no accessible name — so the `aria-labelledby` is load-bearing for Phase 3 |
| Phase 1 §1 (the route) | Guard order rewritten: single `if (isChange)` block with early-`return` narrowing, plus a STRUCTURAL REQUIREMENT paragraph enumerating the bypass shapes (F1) |
| Phase 1 §1b (new) | Additive fail-closed `pinExists`; `hasPin` re-expressed over it; `503` on `null`; test gap stated (F2) |
| Phase 1 §2 (route tests) | Test 1 relabelled an in-place update of `:83`; test 4 split with the new 4b lock/oracle assertion; `failed_attempts` assertions added to tests 2 and 7; admin read-back rule stated; untouched cases enumerated by line (F3, F5) |
| Phase 1 Success Criteria | Test count reworded as a floor with the correct arithmetic (F5) |
| Phase 2 §1 (dictionary) | `t.parentPin.pinLabel` collision documented with two containment rules (F7) |
| D4 | Mockup footnote *"PIN będzie wymagany przy zmianie ważnych ustawień"* added as supporting evidence |
| `## Known risks` (new) | K1 sticky lockout · K2 no recovery · K3 `hasPin` fail-open residual · K4 cross-browser marker · K5 marker prefix · K6 label collision (F4) |
| "Known issues inherited" | Cross-referenced to `## Known risks` so there is one source of truth |

## Risks the implementer must carry

- **K1** — the sticky `failed_attempts` counter. Confirmed by reading, not pending discovery. Five
  mistyped current-PIN attempts put a parent at one guess per minute indefinitely, with no recovery.
  Deferred deliberately; should be the next change.
- **K3** — `pinExists`'s `null` branch has no test (real-Supabase suite, no mocks). Verified by reading.
- **F1's structure is enforced by reading, not by a test.** Manual criteria 1.7 (deliberate-break) and
  1.8 (guard-order read) are the only checks, and 1.7 will not run in an unattended pass. If the
  implementer skips them, the STRUCTURAL REQUIREMENT paragraph is the whole defence.
