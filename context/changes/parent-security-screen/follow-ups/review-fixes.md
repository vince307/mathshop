# Follow-up fixes — parent-security-screen

Raised by the implementation review (`../reviews/impl-review.md`, 2026-08-23, verdict **APPROVED**).

**None of these blocks the merge.** There are **no CRITICAL findings**; the change gate itself was
re-derived as an attacker and held. These are documentation and evidence-hygiene items plus one
defence-in-depth nit. Each is written so it can be executed without re-reading the review.

---

## FU-1 — Record K1 (sticky `failed_attempts`) in the durable doc, and correct its wording

**From:** F1 (⚠️ WARNING). **Effort:** ~10 minutes, docs only.

### 1a. Add the limitation to `docs/reference/contract-surfaces.md`

The change added a *"Parent PIN routes (RLS surface)"* section (after the `account_settings` block,
around line 57). It documents the gate order and the `STATUS_FOR` vocabulary but not the throttle's
one-way counter. Append a bullet to that section:

```markdown
- **Known limitation — the failure counter does not decay.** `register_pin_failure` only ever
  increments; nothing resets `failed_attempts` except a **correct** PIN (`parent-pin.ts:118-124`) or
  `setPin` (`:90`). So once an account passes 5 failures the 60 s lock lapses with the counter still
  ≥ 5 and the next wrong PIN re-arms a full cooldown — a persistent one-guess-per-minute throttle
  until a correct PIN is entered. A correct PIN always clears it, so this is degraded UX, not a
  lockout; it becomes unrecoverable only for a parent who has genuinely forgotten the PIN, because
  **there is no forgot-PIN recovery flow**. Note that `POST /api/parent/pin/set` used to double as a
  free lockout reset (any marker-holder reaching `setPin` cleared the counter); the change gate
  deliberately closed that, so the counter now has exactly one reset path. Fixing the decay needs a
  migration to `register_pin_failure` and is deliberately not bundled with a change that adds a new
  caller of that RPC.
```

**Why here:** `plan.md` and `handoff.md` both live in `context/changes/parent-security-screen/`, which
`/10x-archive` relocates into `context/archive/`. `contract-surfaces.md` is the durable doc a future
implementer of this route actually opens — and this change already edits it.

### 1b. Correct K1's framing in `plan.md`

`plan.md:923` heads K1 *"turns a mistyped current PIN into a permanent 1-guess-per-minute lockout"*,
and the body calls it "permanent … for ever". Verified against `verifyPin`
(`src/lib/services/parent-pin.ts:104-131`): `locked_until` is checked first, and after it lapses a
**correct** PIN matches and resets `failed_attempts` to 0 and `locked_until` to null. Rewrite as:

> …turns a mistyped current PIN into a **persistent one-guess-per-minute throttle that lasts until a
> correct PIN is entered**. It is unrecoverable only in combination with K2 (no forgot-PIN recovery),
> i.e. for a parent who has actually forgotten the PIN — which is true with or without this change.

**Why it matters:** the overstated version invites an over-scoped fix (session versioning, recovery
tokens) for what is a counter-decay migration.

---

## FU-2 — Give `/app/report` a committed browser guard below `lg`, or stop claiming one

**From:** F2 (⚠️ WARNING). **Effort:** one regex, or one sentence.

Progress row 2.6 (`plan.md:1022`) is ticked with SHA `ae5fa42`, but the throwaway spec that measured it
(`e2e/_tmp712.spec.ts`) was deleted uncommitted — so `ae5fa42` contains nothing that demonstrates the
row. And `playwright.config.ts:51` scopes the `touch` project to
`testMatch: /gameplay-restore\.spec\.ts/`, so `/app/report` never renders below `lg` in CI at all.

**Option A (preferred — a standing guard).** Widen the `touch` project:

```ts
// playwright.config.ts:51
testMatch: /(gameplay-restore|parent-surfaces)\.spec\.ts/,
```

Then run `npx playwright test` and record the new total (expect **19**: 16 + 3 `parent-surfaces`
tests at 712px). **Verify before committing** — the account-deletion test in that file drives a radix
`AlertDialog` and has never been exercised at tablet width; if it is flaky or slow there, scope the
touch run to the change-PIN test instead (`grep`/`testMatch` on the title) rather than reverting the
whole idea. Update the plan's Phase 3 criterion, which currently states 16 as the expected total.

**Option B (cheap and honest).** Leave the config alone and restate row 2.6 as:

```
- [x] 2.6 At 712px the report reads report → change PIN → rail → danger zone, nothing overflows —
      ae5fa42 (observed once in a throwaway spec, deleted; NOT asserted — no committed regression guard)
```

Do **not** leave it as-is: a bare `[x]` against a SHA whose commit holds no evidence is the failure
mode the Progress convention exists to prevent.

---

## FU-3 — Filter `account_settings` reads by `account_id` as well as by RLS

**From:** F3 (💡 OBSERVATION). **Effort:** ~5 minutes. **Low priority — defence in depth only.**

`pinExists` (`src/lib/services/parent-pin.ts:65-68`) and `verifyPin` (`:105-109`) both do
`.select(…).limit(1)` with no `.eq("account_id", …)`, so correctness rests entirely on the RLS
policies. It is correct today. But `pinExists` is now a **security gate** (its `false` means "skip the
marker guard and skip the `currentPin` requirement"), and this codebase constructs a service-role
client one directory away (`src/pages/api/account/delete.ts` → `createAdminClient()`). Handed one,
`limit(1)` would return an arbitrary account's row.

Add the explicit filter to both, using the existing helper — never a client-supplied id (L-002):

```ts
const accountId = await currentUserId(client);
if (!accountId) return null;                       // pinExists: fail closed
// … .select("account_id").eq("account_id", accountId).limit(1)
```

`setPin` (`:86-87`) already follows exactly this shape. `tests/account-settings-isolation.test.ts` and
`tests/parent-pin.test.ts` are the regression net; neither should need editing.

---

## Not doing (recorded so it is not re-litigated)

- **F4 — `await request.formData()` is unguarded** (`set.ts:67`): a non-form body surfaces as a 500
  instead of a 400 `invalid`. Not exploitable (it is after the marker guard, before any comparison,
  and writes nothing) and **verbatim the existing pattern** in `account/delete.ts:53` and
  `parent/pin/verify.ts`. If it is ever fixed it should be fixed on all three routes in one change,
  not here.
- **F5 — `t.parentPin.pinLabel` is a substring of `newPinLabel`** (K6): confirmed real, confirmed
  inert — the two labels cannot co-render (`/app/report` redirects to `/app/parent-pin` without a
  marker) and no test locates by `pinLabel` on the report page. If a future screen renders both, the
  fix is `getByLabel(t.parentPin.pinLabel, { exact: true })`, not a rename.
