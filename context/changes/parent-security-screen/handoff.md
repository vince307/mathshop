# Handoff — parent-security-screen (F3)

**Standing brief for every step of this run:** `context/runs/2026-08-22-autonomous-five/agent-contract.md`.
Read it in full before doing anything. Run log and feature list:
`context/runs/2026-08-22-autonomous-five/run-log.md` (this is feature **F3**).

## State

- `change.md` — status advanced `planned` → **`plan_reviewed`**.
- `research.md` — ground truth, unchanged (898 lines). Do not re-research it.
- `plan-brief.md` — **stale in two places** (see "Brief drift" below). `plan.md` wins.
- `plan.md` — **reviewed and amended in place**. 3 phases, 11 autonomous decisions (D1–D11)
  unchanged, plus a new `## Known risks` section (K1–K6).
- `reviews/plan-review.md` — **new**, the full deep review report (1 critical, 6 warnings,
  3 observations, with the triage decision recorded on each).
- No production code, no migration, no git branch, no security behaviour changed. Still on
  `feat/ui-polish`. This step touched only `plan.md`, `change.md`, and the new review file.

## Verdict

**REVISE → SOUND after fixes.** The approach is right; the details needed tightening. Six findings
were fixed directly in `plan.md`, one was recorded as a carried risk, three were recorded only. **Not
RETHINK** — no fresh `/10x-plan` is needed.

Dimension verdicts (pre-fix → post-fix): End-State Alignment PASS · Lean Execution PASS ·
Architectural Fitness PASS · Blind Spots **FAIL → PASS** (one recorded risk) · Plan Completeness
**WARNING → PASS**.

## Next command

```
/10x-implement parent-security-screen
```

## What the review verified and found sound

Checked against code, not against the plan's own summary:

- **The live hole is real and closing it breaks nothing.** `set.ts:31-34` checks the marker and falls
  straight to `setPin` — no PIN check at all. The only production client is `ParentPinGate.tsx:54`,
  which posts to `/set` only in `set` mode, which `parent-pin.astro:13-14` renders only when
  `hasPin()` is false. **No legitimate caller depends on marker-only change.** Exactly one test
  (`tests/parent-pin-routes.test.ts:83`) does, and the plan updates it deliberately.
- **The throttle is genuinely shared.** `verifyPin` is the only exported reader of `pin_hash`; the RPC
  is `security invoker`, `set search_path = ''`, pinned by `where s.account_id = auth.uid()`, and does
  the increment + lockout decision in one atomic UPDATE. `verifyPin` short-circuits on a live
  `locked_until` before any comparison. The route compares nothing itself.
- **First-time set is untouched**, verified across every seeding call site: `parent-pin-routes.test.ts`
  `:52 :63 :93 :104 :128`, all `setPin()` calls in `parent-pin.test.ts` / `account-deletion.test.ts` /
  `profile-deletion.test.ts`, and both e2e uses of `setPinAndLandOnReport` — all on PIN-less accounts.
- **Placement holds on every path.** `output: "server"`, no `prerender` on the page; middleware gates
  `/app` for auth; `report.astro:22-29` re-verifies the signed marker on **every render**, including a
  direct URL hit — absent/stale/tampered → redirect to `/app/parent-pin`. No cached or static path.
- **CSRF is fine and improves.** Auth cookies and the marker are both `httpOnly` + `sameSite: "lax"`,
  so a cross-site POST carries neither.
- **The scope collapse is honest.** Both PRD non-goals re-read (content correct, line numbers were
  wrong — fixed). Both mockup PNGs opened: web draws 4 toggles, mobile 3 — the "tell" is real. Neither
  mockup has a current-PIN field; both are `Wpisz 4 cyfry` + `Potwierdź PIN` inside a "Krok 3 z 3"
  wizard, i.e. first-time set. The web mockup's own footnote — *"PIN będzie wymagany przy zmianie
  ważnych ustawień"* — actively supports D4. The "Bezpieczne środowisko" card ships at
  `report.astro:87-103` and criterion 2.8 asserts it stays byte-identical.
- **Phase granularity is fail-safe.** Phase 1 is a pure tightening with no client on the affected path,
  so a stop after any phase leaves auth strictly stronger, never half-changed.

## What was fixed in `plan.md`

| # | Finding | Fix |
| --- | --- | --- |
| **F1** ❌ CRITICAL | The `currentPin` gate was specified as three independent `isChange` tests in a flat list, in a route the plan itself flags as a null/undefined minefield. The natural implementation needs a `currentPin!` assertion, and `if (isChange && currentPin) { verifyPin(…) }` — the obvious shape for an `optional()` field — is a **full bypass**: omit the field, skip the PIN check. A `=== null` absence check is dead code after the `?? undefined` normalisation. | Guard order rewritten as a **single `if (isChange) { … }` block** — presence check with early `return` (that `return` is the TS narrowing), then `verifyPin`, then same-as-current. Added a **STRUCTURAL REQUIREMENT** paragraph: no `!`, no `?? ""`, never gate `verifyPin` on truthiness ("the presence check must `return`, never `skip`"), plus the enumerated rejected shapes (omitted / empty / file part / wrong length). |
| **F2** ⚠️ | `hasPin` (`parent-pin.ts:57-60`) reads a query **error** as "no PIN" — which on this route means skip the marker guard *and* skip the `currentPin` requirement. Pre-existing, but this change makes it the sole gate separating "open onboarding" from "locked-down change". | New **Phase 1 §1b**: additive fail-closed `pinExists(client): Promise<boolean \| null>`; `hasPin` re-expressed over it so `parent-pin.astro:13` is untouched; `set.ts` returns `503` on `null`. Test gap stated (no mocks in this suite) → K3. |
| **F3** ⚠️ | No test proved a live `locked_until` rejects a change carrying the **correct** current PIN. Sharper: `setPin` unconditionally zeroes `failed_attempts`/`locked_until` (`:73`) — it and `verifyPin`'s success branch are the *only* two writers repo-wide — so any path reaching `setPin` while locked is a **free lockout reset**, and that path is live today. | Test 4 split; new **4b** asserts correct-PIN-during-lock → 429, `pin_hash` original, `failed_attempts` still ≥5, `locked_until` still future — labelled the throttle-reset-oracle assertion. `failed_attempts`-unchanged added to tests 2 and 7. Standing rule: every "did not change" assertion reads back through the **admin** client (L-002), because a status-only assertion would pass against a route that 400s and *then* writes. |
| **F5** ⚠️ | Test list said "7 new `it()`" while the criterion said "+6", and test 1 duplicated the `:83` case it also said to update. | Test 1 relabelled an explicit **in-place update** of `:83` ("do not add a second happy-path test"); tests 2–7 are the 6 net-new. Criterion reworded as a floor. |
| **F6** ⚠️ | PRD citations `:167` / `:170` were both wrong — the actual lines are **:158** and **:161**. Content was correct; the pointers were not. These are the load-bearing evidence for dropping 4 of the 5 scoped things. | Corrected, both quoted in full, drift flagged and auditable. Surfaced that `:161` also names **"settings UI"** as out — independently supporting D3. Recorded the direct PNG re-verification. |
| **F7** ⚠️ | The stated label constraint checked `t.deletion.accountPinLabel` but missed the real collision: `t.parentPin.pinLabel` = `"PIN (4–6 cyfr)"` **is** a substring of `newPinLabel` = `"Nowy PIN (4–6 cyfr)"`, and `getByLabel` matches substrings. | Label kept; collision documented with two containment rules (never `getByLabel(pinLabel)` in an `/app/report` context; rename `newPinLabel` if a `pinLabel` field ever lands there). → K6. |

Also added to Critical Implementation Details: (a) `setPin` is a throttle reset, so never move it
ahead of the change branch; (b) `getByRole("region", …)` resolves uniquely **only** because
`DeleteAccountSection.tsx:55` is a `<section>` with no accessible name — so the new section's
`aria-labelledby` is load-bearing for Phase 3, not decoration.

## What was deferred, and what the implementer must carry

New `## Known risks` section in `plan.md` (K1–K6). The two that matter:

1. **K1 — the sticky `failed_attempts` counter (was F4).** Verified: nothing resets the counter except
   a correct PIN or `setPin`. After 5 failures the 60 s lock lapses with the counter still ≥5, so the
   next wrong PIN re-locks instantly — one guess per minute, indefinitely. **This change creates a new
   way to reach that state** (a form where the current PIN is typed from memory), and with no
   forgot-PIN recovery that is the permanent-lockout scenario D4 exists to prevent, reached by
   accident. D7's decision to defer the RPC fix is right. **But D7's reversal trigger ("if manual
   testing shows it") depends on Manual testing step 3, which an unattended run does not execute** —
   so the plan now records K1 as *confirmed by reading, not pending discovery*, and names it the next
   change rather than something to wait and observe.
2. **K3 — `pinExists`'s `null` branch has no test.** The suite runs against real Supabase with no
   mocks, so the error path cannot be induced cheaply. It is a fail-closed defence-in-depth guard,
   verified by reading. Stated in the plan rather than hidden.

Also carried: K2 no forgot-PIN recovery · K4 a PIN change does not revoke a marker held in another
browser (per-cookie, ≤15 min, and that browser can no longer change the PIN again) · K5 the marker has
no domain-separation prefix · K6 the label substring collision.

**One thing has no test at all: F1's structure.** Manual criteria 1.7 (deliberate-break) and 1.8
(guard-order read) are the only enforcement, and **1.7 will not run in an unattended pass**. If the
implementer skips it, the STRUCTURAL REQUIREMENT paragraph is the entire defence. Read Phase 1 §1
before writing the route, and read the finished route top-to-bottom against
`account/delete.ts:41-64`.

## Recorded only (no plan change)

- **F8** — `### Success Criteria` / `#### Automated Verification` are written without the template's
  trailing colons. The `## Progress` block itself is fully well-formed (3 phases, 23 checkboxes,
  1.1–1.8 / 2.1–2.9 / 3.1–3.6, names matching the body headings verbatim, no stray checkboxes in phase
  bodies). No parse risk found for `/10x-implement`.
- **F9** — D9 (same-as-current) costs a reason code, a string, a client branch and a test to prevent a
  no-op. Rationale is honest and the ordering is right; it is just the one droppable thing. D9 already
  records the reversal condition.
- **F10** — `e2e/CLAUDE.md` does not *forbid* `getByTestId`; it permits it as a documented fallback
  when a11y attributes are ambiguous, preferring the ambiguity be surfaced as a product finding first
  (which is exactly what the Phase 2 `aria-labelledby` does). `clearCookies({ name: "parent_verified" })`
  **is** sanctioned verbatim, and specifically in `parent-surfaces.spec.ts` — where Phase 3 puts the
  new test. `page.waitForTimeout` **is** forbidden, as the plan says.

## Brief drift — `plan-brief.md` is stale in two places

It was not regenerated. `plan.md` is authoritative. The two divergences:

1. It says Phase 1 adds **"+7 route tests → ≥305"**. Correct is **6 net-new** (tests 2–7); test 1 is an
   in-place update of `:83`. The ≥305 floor is right.
2. It does not mention Phase 1 **§1b** (`pinExists`) or the `## Known risks` section.

## Phase structure (unchanged, with the review's amendments folded in)

| Phase | Delivers | Tests |
| --- | --- | --- |
| **1. Route contract** | `currentPin` on `POST /api/parent/pin/set` — optional at zod level, **required inside a single `if (isChange)` block** when a PIN exists. Plus fail-closed `pinExists` (§1b) and a `contract-surfaces.md` entry for the PIN routes. First-time set untouched. | 6 net-new route tests → ≥305 (from 299) |
| **2. Island + strings + mount** | `src/components/parent/ChangePinSection.tsx`, `parentPin.change*` keys in `src/i18n/pl.ts`, mounted on `/app/report` above the danger zone, `aria-labelledby` → `h2`. | +7 jsdom tests → ≥312 |
| **3. E2E** | One journey in `e2e/parent-surfaces.spec.ts`: change → clear marker → old PIN rejected at the gate → new PIN admits. | 15 → **16** Playwright runs |

**No migration. No new endpoint. No nav change. No `PROTECTED_ROUTES` edit.**

## Verification baselines (from the agent contract)

`npm run lint` clean · `npm test` **299** baseline, may only go up · `npx playwright test` **15**
runs baseline (16 after Phase 3; the new test is `desktop`-only — `touch`'s `testMatch` is scoped to
`gameplay-restore.spec.ts`). Local Supabase must be up for both suites. Demo account
`ui-polish-demo@example.test` / `test-password-123!`, PIN `2468`, profile "Ania".

## Autonomous decisions (this step)

Run: `context/runs/2026-08-22-autonomous-five` (feature F3). No human in the loop, so the
`10x-plan-review` skill's interactive triage prompt was **decided, not asked**.

- **Triaged every finding myself** under a fixed policy: CRITICAL → fix directly in `plan.md`;
  WARNING → fix if clear and contained, else record under `## Known risks`; OBSERVATION → record only.
  Rejected the alternative of saving the report with all decisions `PENDING`, which would have handed
  `/10x-implement` a plan with a known bypass shape still in it.
- **Fixed F2 rather than only recording it**, even though `hasPin`'s fail-open is pre-existing. The
  deciding factor: this change is what makes that predicate the sole gate between open onboarding and
  a locked-down change, and the fix is additive with zero behaviour change for the other caller.
  *Would change the answer:* if `pinExists` had required touching `parent-pin.astro`'s mode selection,
  it would have gone to `## Known risks` instead.
- **Did not regenerate `plan-brief.md`.** It is a derived 2-minute read, and regenerating it risks
  drift against a plan I had just amended in seven places. Recorded the two stale claims here instead.
  *Would change the answer:* if the next step were a human review rather than `/10x-implement`.
- **Did not rewrite D7.** F4 is a real risk but D7's *decision* (defer the RPC fix) survives scrutiny;
  only its reversal trigger was unreachable unattended. So the decision stands and the risk moved to
  `## Known risks` with the trigger problem stated. *Would change the answer:* if the sticky counter
  were reachable without a wrong PIN.
