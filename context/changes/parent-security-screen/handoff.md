# Handoff — parent-security-screen (F3)

**Standing brief for every step of this run:** `context/runs/2026-08-22-autonomous-five/agent-contract.md`.
Read it in full before doing anything. Run log and feature list:
`context/runs/2026-08-22-autonomous-five/run-log.md` (this is feature **F3**).

## State

**Implemented — all 3 phases, all 23 Progress rows `[x]`.** `change.md` status is now `implemented`.

Branch **`feat/parent-security-screen`**, cut from `feat/ui-polish` (`64e3373`) — *not* from
`feat/dashboard-recent-activity`, which happened to be checked out. Nothing pushed, no PR.

| Commit | Phase | What landed |
| --- | --- | --- |
| `3d43c3c` | 1 — route contract | `currentPin` required on every change path, fail-closed `pinExists`, contract-surfaces entry, 6 net-new route tests |
| `f5417e8` | 2 — island + strings + mount | `ChangePinSection`, `parentPin.change*` keys, mounted on `/app/report`, 7 jsdom tests |
| `ae5fa42` | 3 — e2e | one browser journey in `e2e/parent-surfaces.spec.ts`, 15 → 16 runs |
| *(epilogue)* | — | final SHA write-back + `change.md` → `implemented` |

## What shipped

**The hole is closed.** Before this change, `POST /api/parent/pin/set` overwrote an existing PIN on a
**marker alone** — a possibly-15-minute-old cookie. A child on the parent's logged-in device could
POST inside that window and silently change the PIN, and with no forgot-PIN recovery (K2) that is a
permanent, silent lockout from the parent zone. It now requires the marker **and** the current PIN,
re-proved through the shared atomic throttle — the bar `POST /api/account/delete` already sets.

- `src/pages/api/parent/pin/set.ts` — the change gate. **One `if (isChange)` block**: presence check
  with an early `return` (that `return` is the TypeScript narrowing), then `verifyPin`, then
  same-as-current. No `!`, no `?? ""`, no truthiness-gated verification. `STATUS_FOR` added, matching
  `verify.ts:17` verbatim.
- `src/lib/services/parent-pin.ts` — additive `pinExists(client): Promise<boolean | null>`, fail-closed
  (query error → `null` → the route answers 503). `hasPin` re-expressed over it; its contract and its
  one caller (`parent-pin.astro:13`) are untouched.
- `src/components/parent/ChangePinSection.tsx` — three PIN fields; status→copy map copied from
  `DeleteAccountSection` (F5 lesson included: a 401 is "wrong PIN" only with `reason: "wrong"`);
  403 → hard-nav back to the gate. `aria-labelledby` → its `h2`, so it exposes `role="region"`.
- `src/i18n/pl.ts` — `parentPin.change*` + `errors.sameAsCurrent`, inside the existing `parentPin` block.
- `src/pages/app/report.astro` — mounted at `lg:row-start-2`; deletion → `row-start-3`, aside →
  `lg:row-span-3`. The "Bezpieczne środowisko" card is untouched.
- `docs/reference/contract-surfaces.md` — new **"Parent PIN routes (RLS surface)"** section recording
  both gate orders, the first-set-open vs change-requires-both split, and the `STATUS_FOR` vocabulary.
- Tests: `tests/parent-pin-routes.test.ts` (`:83` updated in place + 6 net-new),
  `tests/change-pin-section.test.tsx` (new, 7), `e2e/parent-surfaces.spec.ts` (+1 journey).

**No migration, no new endpoint, no nav change, no `PROTECTED_ROUTES` edit** — exactly as planned.

## Verification actually observed

Run with the command sandbox disabled (it blocks `127.0.0.1:54321`; ~30 tests fail for the wrong
reason otherwise). No stray dev server on 4321/4322 — checked before starting.

| Gate | Baseline measured on this branch | After |
| --- | --- | --- |
| `npm test` | **299 passed (39 files)** | **312 passed (40 files)** — 305 after Phase 1, 312 after Phase 2, unchanged by Phase 3 |
| `npm run lint` | clean | **clean** |
| `npm run check` (astro) | — | **0 errors, 0 warnings** (10 pre-existing hints in `src/pages/app.astro`) |
| `npx playwright test` | **15 passed** | **16 passed** (the new test is `desktop`-only) |

The plan's floors were ≥305 after Phase 1 and ≥312 after Phase 2 — both met exactly.

Extra checks run: the new spec passed **3 consecutive runs** (3.5); an admin `listUsers` sweep found
**0 leaked** `e2e-pinchange-*` / `e2e-tmp712-*` / `pinsetlock-*` users (3.6).

## Deliberate-break evidence (the security tests can fail)

Run **before** the Phase 1 commit, both shapes the plan review named, red then restored to green:

1. **Truthiness-gated verification** — presence check deleted, `verifyPin` wrapped in
   `if (currentPin) { … }`. This is F1's exact "natural implementation" and a full bypass.
   **Red:** *"a marker WITHOUT currentPin no longer changes the PIN: 400 'invalid', nothing written,
   no attempt burnt"* (got 200) — the anti-bypass assertion — plus *"same-as-current"* as a cascade.
2. **`verifyPin` skipped** on the change path, presence check kept (criterion 1.7's own wording).
   **Red:** *"a wrong currentPin is 401 'wrong' and burns exactly one throttle attempt"* and
   *"the throttle locks the change path, and a LIVE lock rejects even the CORRECT current PIN"*.

Restored → **16/16** in that file, **305/305** overall at the time.

**Hostile re-read of the shipped route** (each is a way in, each is closed): field omitted → `null` →
`?? undefined` → `!currentPin` → 400 before any comparison. Empty string / non-digits / wrong length /
a file part → zod 400. A literal `null` cannot survive `FormData`, and `"null"` fails the regex. Note
`"0000"` is a *truthy* string, so the falsiness check cannot reject a valid PIN. Wrong value →
`verifyPin` → 401 + one burnt attempt. Live lock, even with the **correct** PIN → 429, and `setPin`
(which zeroes `failed_attempts`/`locked_until`) is never reached, so the free-throttle-reset path that
was live before this change is gone. `pinExists` error → 503 before anything. **The only way to reach
`setPin` on a change path is a `verifyPin` that returned `ok`.**

## Autonomous decisions taken this step

Recorded in full under `plan.md` → `## Autonomous decisions` as **D12–D15**:

- **D12** — the skill's four interactive gates (manual confirmation, dirty paths, commit message, next
  phase) were decided, not asked, per the agent contract. Staging was by explicit path only: the tree
  carries four other features' `context/changes/` folders plus `context/runs/`.
- **D13** — route test 4 ships as **one** `it()` carrying both the 4a and 4b assertions, because 4b
  must run inside the same live 60-second lock window 4a creates. Net-new count is therefore exactly
  6 → 305, which is the plan's floor.
- **D14** — the deliberate-break check was run in **both** bypass shapes (see above).
- **D15** — the two browser-only manual criteria were **executed, not waived**. 2.9 falls out of the
  Phase 3 e2e (success copy + URL still `/app/report`). 2.6 was measured with a throwaway spec at
  712px — top offsets report `20` → change PIN `195` → rail `432` → danger zone `787`, and
  `scrollWidth === clientWidth === 712`. That spec was deleted and never committed. 2.7/2.8 were
  settled statically. **2.6 and 2.9 therefore carry the Phase 3 SHA**, not Phase 2's.

Two small adaptations, neither a plan deviation: `pinExists` returns `data.length > 0` rather than
`(data?.length ?? 0) > 0` (the `?? 0` is unreachable after the error check and
`@typescript-eslint/no-unnecessary-condition` rejects it), and the island types its submit handler
`SubmitEvent<HTMLFormElement>` because `@typescript-eslint/no-deprecated` rejects `FormEvent` —
matching `ParentPinGate.tsx:37`.

## Next command

```
/10x-impl-review parent-security-screen
```

## What the reviewer should look at first

1. **The change gate in `set.ts`** — F1's structure has **no test of its own**. Criteria 1.7 and 1.8
   plus the STRUCTURAL REQUIREMENT comment in the route are its entire defence. Read it top-to-bottom
   against `account/delete.ts:41-64`; the orders match step for step, with the change-only
   conditionality and one extra fail-closed 503 for `pinExists`.
2. **Test 4's second half** — the throttle-reset oracle. If a future refactor moves `setPin` ahead of
   the change branch, that assertion is the only thing that goes red.
3. **`hasPin` vs `pinExists`** — every security-critical caller must use `pinExists`. `hasPin` keeps
   its fail-open contract for `parent-pin.astro` only (K3).

## Risks carried forward (unchanged by this step)

`plan.md` → `## Known risks` K1–K6. The two that should drive the next change:

- **K1 — the sticky `failed_attempts` counter.** Nothing resets it but a correct PIN or `setPin`, so
  after 5 failures the 60 s lock lapses with the counter still ≥5 and the next wrong PIN re-locks
  instantly — one guess per minute, indefinitely. **This change adds a new way to reach that state**
  (a form where the current PIN is typed from memory). Confirmed by reading, not pending discovery;
  D7's reversal trigger was never going to fire in an unattended run. It needs a migration to
  `register_pin_failure`, deliberately kept out of the commit that adds a new *caller* of that RPC.
- **K2 — no forgot-PIN recovery.** The reason D4 went the strict way and the reason K1 has no escape
  hatch. Highest-value follow-up; if it ships, revisit D4.

Also open: K3 (`pinExists`'s `null` branch has no test — real-Supabase suite, no mocks), K4 (a PIN
change does not revoke a marker held in another browser), K5 (the marker has no domain-separation
prefix), K6 (`t.parentPin.pinLabel` is a substring of `newPinLabel` — safe only while the two never
co-render; the new tests and the e2e all locate by `newPinLabel`).

## Notes for whoever runs the suites next

- The command sandbox blocks `127.0.0.1:54321` — run `npm test` / `npx playwright test` with it
  disabled, or ~30 tests fail for the wrong reason.
- A stray dev server on 4321/4322 makes four `gameplay-restore` runs fail spuriously. Check before
  blaming a change.
- The unit baseline on this branch is **299** (feature F2's +19 landed on its own branch, cut from the
  same parent). Do not assume 318 here.
