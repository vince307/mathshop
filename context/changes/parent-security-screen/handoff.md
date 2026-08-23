# Handoff — parent-security-screen (F3)

**Standing brief for every step of this run:** `context/runs/2026-08-22-autonomous-five/agent-contract.md`.
Read it in full before doing anything. Run log and feature list:
`context/runs/2026-08-22-autonomous-five/run-log.md` (this is feature **F3**).

## State

**Implemented and reviewed.** All 3 phases, all 23 Progress rows `[x]`. `change.md` status is now
**`impl_reviewed`**.

Branch **`feat/parent-security-screen`**, cut from `feat/ui-polish` (`64e3373`). Nothing pushed, no PR.

| Commit | Phase | What landed |
| --- | --- | --- |
| `3d43c3c` | 1 — route contract | `currentPin` required on every change path, fail-closed `pinExists`, contract-surfaces entry, 6 net-new route tests |
| `f5417e8` | 2 — island + strings + mount | `ChangePinSection`, `parentPin.change*` keys, mounted on `/app/report`, 7 jsdom tests |
| `ae5fa42` | 3 — e2e | one browser journey in `e2e/parent-surfaces.spec.ts`, 15 → 16 runs |
| *(epilogue)* | — | final SHA write-back + `change.md` → `implemented` |
| *(this step)* | — | `reviews/impl-review.md`, `follow-ups/review-fixes.md`, `change.md` → `impl_reviewed` |

## Review verdict

**APPROVED — the branch is mergeable as-is.**
Full report: **`context/changes/parent-security-screen/reviews/impl-review.md`**.

**0 CRITICAL · 2 WARNING · 4 OBSERVATION.** Nothing was fixed in `src/` — there was nothing critical
to fix, and both WARNINGs are documentation/evidence items whose right home is a follow-up, not a
drive-by commit on a security branch whose value is a narrow, reviewable diff.

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING (F1) |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING (F2) |

### This was reviewed as a security change first

The reviewer did **not** take the implementer's claims on trust. Every one was re-derived:

- **The change gate holds.** `src/pages/api/parent/pin/set.ts` was traced branch by branch as an
  attacker: field omitted, empty string, `"null"`, wrong length, non-digits, a `File` part, a
  duplicated field, an array/object body, prototype-polluting keys, zod coercion, and `"0000"` (a
  valid-but-falsy-looking PIN). **All 400 before any comparison; none reaches `setPin`.** No `!`, no
  `?? ""`, no truthiness-gated verification — the early `return` at `:85` is the narrowing. **No
  caller holding only a marker can change the PIN.**
- **The throttle is real.** `verifyPin` is the sole reader of `pin_hash` in `src/` (grep-confirmed);
  no route compares a hash inline. A wrong `currentPin` increments through the atomic
  `register_pin_failure` RPC (`security invoker`, `where account_id = auth.uid()`); `locked_until` is
  checked before the hash, so a live lock refuses even the **correct** PIN. Route test 4b asserts
  exactly that.
- **`setPin`'s free throttle reset is closed, and this change is what closed it** — strictly better,
  not worse. (Nuance: that reset was in principle K1's only escape hatch, but no UI ever called it,
  so nothing practical was lost.)
- **First-time set is untouched and covered** — `tests/parent-pin-routes.test.ts:89` posts only `pin`
  and is unmodified in the diff. `pin_hash` is `not null`, so "row exists, no PIN" cannot strand
  onboarding.
- **Both deliberate breaks were re-run by the reviewer**, not taken from D14: the truthiness-gated
  shape and the verifyPin-skipped shape each turned exactly 2 tests red, on the right assertions,
  then restored (`git status --porcelain src/` clean).
- **Scope is clean.** No toggle in any form, "Bezpieczne środowisko" byte-identical and not renamed,
  no new route/endpoint/migration/nav entry, `hasPin`'s fail-open contract preserved exactly.

### Gates re-run this step (observed, not quoted)

Sandbox disabled (it blocks `127.0.0.1:54321`); no stray dev server on 4321/4322.

| Gate | Observed |
| --- | --- |
| `npm test` | **312 passed / 312** (40 files) |
| `npm run lint` | **clean** |
| `npm run check` | **0 errors, 0 warnings**, 8 pre-existing hints (the previous handoff said 10 — cosmetic miscount) |
| `npx playwright test` | **16 passed**, incl. `parent-surfaces.spec.ts:75 › change PIN` |

## The two WARNINGs, and where they are recorded

Both are in **`context/changes/parent-security-screen/follow-ups/review-fixes.md`** as executable fixes.

- **FU-1 (F1) — K1 lives only in the change folder, and its wording overstates the risk.** `plan.md`
  and this handoff both get relocated by `/10x-archive`; the durable doc this change *did* edit
  (`docs/reference/contract-surfaces.md`, new "Parent PIN routes" section) says nothing about the
  sticky counter. FU-1 supplies the exact bullet to paste. It also corrects K1's framing: verified
  against `verifyPin:104-131`, a **correct** PIN after the lock lapses resets `failed_attempts` to 0,
  so K1 is a *persistent one-guess-per-minute throttle*, **not** a permanent lockout. It becomes
  unrecoverable only together with K2 (forgot the PIN), which pre-dates this change entirely.
- **FU-2 (F2) — Progress row 2.6's evidence was deleted.** The 712px measurement came from a throwaway
  spec that was never committed, and `playwright.config.ts:51` scopes the `touch` project to
  `gameplay-restore.spec.ts`, so `/app/report` never renders below `lg` in CI. Row 2.9 by contrast is
  genuinely asserted in the committed e2e and is fine. FU-2 offers a one-regex standing guard or an
  honest restatement of the row.

Also recorded (low priority): **FU-3** — `pinExists`/`verifyPin` read `account_settings` with no
`.eq("account_id", …)`, resting entirely on RLS. Correct today; defence-in-depth only.
Explicitly **not doing**: the unguarded `request.formData()` (identical in all three PIN/delete routes)
and the `pinLabel`/`newPinLabel` substring (K6 — real, but the two can never co-render).

## Is it shippable with K1 open?

**Yes — stated plainly.** The realistic worst case is a parent who mistypes five times and is then
throttled to one attempt per minute until they get it right; a correct PIN always clears the counter,
and the damage is confined to their own account. That is a brute-force throttle behaving as designed,
seen from the outside. K1 should still be the next change — alongside or ahead of K2 — but it does not
gate this branch.

## Next command

**None for this feature — it is done.** The plan named exactly **one** browser-level risk (change PIN
→ clear the marker → old PIN rejected at the gate → new PIN admits) and it is **already covered and
green**: `e2e/parent-surfaces.spec.ts:75`, observed passing in this step's 16/16 run. **Do not run
`/10x-e2e parent-security-screen`** — there is no undriven browser risk, and FU-2's 712px gap is
evidence hygiene on an already-built layout, not a new risk to drive.

Recommended order from here:

1. Apply **FU-1** (10 minutes, docs) — the only item with real half-life.
2. Decide **FU-2** (widen `touch`'s `testMatch`, or restate row 2.6).
3. `/10x-archive parent-security-screen`.

## Risks carried forward

`plan.md` → `## Known risks` K1–K6, **with K1's wording superseded by FU-1** (throttle, not permanent
lockout). K2 (no forgot-PIN recovery) remains the highest-value follow-up and the reason D4 went the
strict way. K3 (`pinExists`'s `null` branch has no test — real-Supabase suite, no mocks), K4 (a PIN
change does not revoke a marker held in another browser), K5 (no domain-separation prefix on the
marker), K6 (label substring — confirmed inert) are unchanged.

## Notes for whoever runs the suites next

- The command sandbox blocks `127.0.0.1:54321` — run `npm test` / `npx playwright test` with it
  disabled, or ~30 tests fail for the wrong reason.
- A stray dev server on 4321/4322 makes four `gameplay-restore` runs fail spuriously. Check first.
- The unit baseline on this branch is **299**; it is **312** after this change. Feature F2's +19 landed
  on its own branch cut from the same parent — do not assume 318 here.
