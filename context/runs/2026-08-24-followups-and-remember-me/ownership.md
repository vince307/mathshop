# Shared-resource ownership — run `2026-08-24-followups-and-remember-me`

Written by the **contention sweep** after both plans existed and **before any
implementation starts**, by one agent that read both plans at once. **Binding** on every
implementer and on conflict resolution at integration. Where it disagrees with a plan, it
wins — but every disagreement found this run was fixed in the offending plan in place
(§3), so no live contradiction remains.

Base branch: `matmaverse-v2` @ `282d264`. Features in scope:

| id | change-id | branch |
|---|---|---|
| **F1** | `autonomous-run-follow-ups` | `feat/autonomous-run-follow-ups` |
| **F2** | `remember-me-on-login` | `feat/remember-me-on-login` |

**Headline: these two features are genuinely independent.** They share **two** files
(`src/i18n/pl.ts`, `docs/reference/contract-surfaces.md`), in disjoint regions hundreds of
lines apart, and **zero** symbols. They are therefore in **separate stacks and build
concurrently**. Nothing here is serialised out of caution.

---

## 1. Contended resources

"Contended" below means *both features name the resource*, not that both write it. Rows
marked **read-only for X** are the dangerous ones — the source run's worst collision
surfaced because a read dependency was invisible to the writer.

| Resource | Features | Owner | Rule for everyone else |
|---|---|---|---|
| `src/i18n/pl.ts` | F1, F2 | **shared, per-object** | Append only, one key per entry, inside your own object. **F1**: `noNextUpgrade` in `growth:` (after `noUnlocks`, ≈ line 345). **F2**: `rememberLabel` in `auth.signin:` (≈ line 17). ~325 lines apart — clean 3-way merge. Never restructure. Re-run the both-directions L-007 check before committing (§5). |
| `docs/reference/contract-surfaces.md` | F1, F2 | **shared, per-section** | **F1 owns `## Parent PIN routes (RLS surface)`** (line 58, ends before `## Account deletion` line 69) — appends one K1 bullet, edits nothing else. **F2 owns a new `## Auth cookie lifetime (session-policy surface)`**, appended after `## set_updated_at()` (file's last section, ends line 90). Neither may touch the other's section. On any conflict in a *Consumed by* / *Tests* line, **keep both sides** — never `--ours`/`--theirs`. Nothing in `src/`, `tests/`, `e2e/` or CI reads this file, so a bad resolution fails silently and forever. |
| `e2e/helpers/accounts.ts` | F1 writes, **F2 reads** | **F1, sole writer** | F2 makes **no edit** here (its plan says so twice; its research only reads). F1 **appends** `seedShiftWeek` after `signInViaUI` at EOF and edits **no existing export**. The append-only rule survives sole ownership *because of F2's read*: every authenticated F2 regression funnels through `signInViaUI`, so `getByLabel(emailLabel)`, `getByLabel(passwordLabel, {exact:true})` and `getByRole("button", { name: t.auth.signin.submit })` must not move. |
| `src/lib/supabase.ts` (`createClient`/`setAll`, `AUTH_COOKIE_RE`) | F2 only | **F2** | F1 does not touch it. F2 may add `export` to `AUTH_COOKIE_RE` (module-private `const`, line 19) and set `maxAge` inside `setAll`. **`maxAge` must never enter `AUTH_COOKIE_OPTIONS`** — `clearAuthCookies` (line 51) spreads that object *after* its own `maxAge: 0` via a direct `cookies.set`, not through `setAll`, so it would silently break sign-out. |
| `src/lib/services/*` | F2 adds `remember-me.ts` (new) | **F2** for the new file; **nobody** edits an existing one | No existing service is written this run. F1 **reads** `reports.ts` (`weekDayKeys`) and mirrors `child-profiles.ts` (`appendShiftLog`) — read-only, no edit. `zoneOffsetMinutes` is module-private and stays that way; do not export it, do not copy it. |
| `src/components/**` | disjoint | per-file | **F1**: `child/StageRail.astro`, `child/WorldPicker.tsx`, `parent/WeeklyActivityChart.tsx`. **F2**: `auth/SignInForm.tsx`, plus first use of `ui/checkbox.tsx`. No overlap. |
| `src/components/app/AppShell.astro` | F1 (transiently) | **F1** | **Net zero edits.** F1 Phase 4's deliberate break mutates an `items[].href` and restores it. Commit only with the file unchanged; `git diff` on it must be empty at every commit. |
| nav entries (`AppShell.astro` `items` / `tabs`) | **neither** | — | **No feature adds a nav entry this run.** `items` = 5, `tabs` = 6. See §5 for the 712px count. F1 only *asserts* the existing wiring; F2 does not touch nav at all. |
| routes under `src/pages/app/` | F1 only | **F1** | F1: `growth.astro`. F2 touches no `/app/` route (its page is `src/pages/auth/signin.astro`). |
| `src/pages/api/**` | disjoint | per-file | **F1**: `api/profiles/world.ts`. **F2**: `api/auth/signin.ts`, `api/auth/signout.ts`. No overlap. Both must keep `export const prerender = false`. |
| `src/pages/auth/signin.astro` | F2 only | **F2** | F2 deletes the standalone reset link. F1 does not touch `src/pages/auth/`. |
| `supabase/migrations/` | **neither** | — | **Uncontended. No migration this run.** See §4. |
| `src/types.ts` | **neither** | — | Untouched by both plans. If a phase discovers it needs a shared type, it appends only, and says so in its handoff. |
| `tests/**` | disjoint | per-file | **F1**: `worlds-picker.test.tsx`, `shop-art-slots.test.ts`→`.tsx` (rename), `weekly-report-tiles.test.tsx`, `nav-labels.test.ts`. **F2**: new `remember-me-cookie.test.ts`, new `signin-form.test.tsx`. No overlap. Neither may edit `vitest.config.ts` — both use a per-file `// @vitest-environment jsdom` pragma. |
| `e2e/*.spec.ts` | F1 only | **F1** | F1: `growth.spec.ts` (+1 test), `parent-weekly-report.spec.ts` (+1 test). F2 adds **no spec** and edits none — it re-runs the suite as a regression gate. |
| `playwright.config.ts` | **neither** | — | Untouched. `touch` project's `testMatch: /(gameplay-restore|growth)\.spec\.ts/` is a fact both plans depend on; do not change it mid-run or both features' e2e deltas become wrong. |

### The one cross-feature *behavioural* coupling, recorded because no plan owns it

F2 changes `setAll`, the write path for **every** auth-cookie write in the app, so after F2
integrates the auth cookie is a **browser-session** cookie unless `remember_me=1`. This is
deliberate and documented in F2's *Blast radius beyond sign-in*.

**It does not endanger F1**, and the sweep checked rather than assumed:
`e2e/helpers/accounts.ts` imports `admin` from `tests/helpers/supabase.ts` — plain
`@supabase/supabase-js`, **not** `createClient` — so F1's seeder never crosses the seam. And
a Playwright `BrowserContext` retains session cookies for its own lifetime, so
`signInViaUI` is unaffected. **No action for F1.** Recorded so a post-integration flake is
not misattributed.

---

## 2. Stack order — binding

```
matmaverse-v2 @ 282d264
├─ feat/autonomous-run-follow-ups   (F1)  ── independent stack, merges any time
└─ feat/remember-me-on-login        (F2)  ── independent stack, merges any time
```

**Two stacks of one. Both cut from `matmaverse-v2`. Built concurrently.**

### Edges

**There are none.** Stated explicitly, with the reasons the candidates were rejected — an
absent edge is a decision, not an oversight:

- **No PREREQUISITE edge.** Neither feature imports, calls or re-exports any symbol the
  other introduces. F2's new symbols (`REMEMBER_ME_COOKIE`, `REMEMBER_ME_MAX_AGE_SECONDS`,
  `setRememberChoice`, `authCookieMaxAge`, an exported `AUTH_COOKIE_RE`) have exactly three
  consumers, all F2's own. F1's new symbol (`seedShiftWeek`) has exactly one consumer,
  F1's own spec.
- **No PREFERENCE edge on `src/i18n/pl.ts`.** Two appends ~325 lines apart in different
  objects. Git three-way-merges this without a conflict; serialising to avoid it would buy
  nothing and cost a full build cycle.
- **No PREFERENCE edge on `docs/reference/contract-surfaces.md`.** F1's hunk ends near line
  68; F2's begins after line 90. ~22 lines of untouched context between them — more than
  the default 3-line diff context, so not even an adjacent-hunk conflict.
- **No PREFERENCE edge from the `setAll` blast radius.** Checked above: F1's e2e path never
  crosses F2's seam.

### Integration order (whichever lands first — the sweep does not fix it)

The second to integrate rebases onto the first and **re-measures**. Both plans measure
`baseline + delta` on their own branch (L-005), so a rebase is mechanical. Two things the
second-to-land must do:

1. **Re-measure the e2e baseline after rebasing.** If F1 lands first, F2's `baseline + 0`
   is measured against a suite that grew by **3 runs** (`growth.spec.ts` +1 test × 2
   projects, `parent-weekly-report.spec.ts` +1 desktop-only). +0 is still the correct
   *delta*; the total is not 23 any more.
2. **Re-run the L-007 both-directions check** with the other feature's key present. The
   sweep already ran it with **both** keys in place — see §5 — so this is confirmation, not
   discovery.

---

## 3. Cross-plan defects

Four defects, each visible only to a reader of the *other* plan. **All four were fixed in
place, in the offending plan, by this sweep** (marked in-file as
*"corrected/resolved in place by the contention sweep, 2026-08-24"*). No defect was left as
a note for someone else to apply.

### CPD-1 — F1 asserts a contention that does not exist (`e2e/helpers/accounts.ts`)

- **Wrong plan:** F1.
- **What was wrong:** *Critical Implementation Details* opened with "**`e2e/helpers/accounts.ts`
  is contended with F2 `remember-me-on-login`**", and AD **D7** was built entirely on that
  premise, ending "*What would change the answer:* `ownership.md` … assigning the file to F2
  — F1 then **rebases onto F2**". The *References* section repeated it.
- **Why only an F2 reader sees it:** F2's *What We're NOT Doing* says "**No changes to
  `e2e/helpers/accounts.ts`**" and AD-9 says it touches the file "not at all". The sweep
  checked F2's `research.md` too: its three mentions of the file are all *reads* of
  `signInViaUI`. F1 misread a **read dependency** as a **write collision**.
- **Blast radius if unfixed:** an F1 implementer, or the integrator, would have gone looking
  for a `feat/remember-me-on-login` predecessor to rebase onto — a branch that will not
  exist in F1's stack — and would have serialised two independent features on a phantom.
- **Fixed in place:** the *Critical Implementation Details* bullet, **D7** and the
  *References* entry were all rewritten. The **decision survives, the premise did not**:
  `seedShiftWeek` is still appended at EOF with no existing export edited, but now for the
  correct reason — F2 *reads* `signInViaUI`, so its locators must not move.

### CPD-2 — F1 Phase 0 branches from a predecessor that will never exist

- **Wrong plan:** F1.
- **What was wrong:** Phase 0 carried "**If this branch is stacked on
  `feat/remember-me-on-login`** (an `ownership.md` the sweep may yet write), the baseline is
  that branch's". A conditional whose condition only this document can settle.
- **Why only a cross-reader sees it:** settling it requires knowing F2's full footprint.
- **Fixed in place:** replaced with the resolved answer — **not stacked, cut from
  `matmaverse-v2`** — including the two facts that justify it (the ~325-line i18n gap, the
  different doc sections) and a restated L-005 obligation to *measure* the baseline on the
  branch rather than inherit `429 / 51`.

### CPD-3 — F2 leaves the e2e-count discrepancy unresolved while F1 holds the answer

- **Wrong plan:** F2.
- **What was wrong:** Phase 3's criterion said "a grep found 19 `test(` calls across 8 spec
  files while the run's agent contract states '23 e2e specs' — the difference is
  **presumably** the per-project multiplier".
- **Why only an F1 reader sees it:** F1's Phase 6 states the resolving fact outright —
  `playwright.config.ts`'s `touch` project carries
  `testMatch: /(gameplay-restore|growth)\.spec\.ts/`. The sweep verified it on disk:
  **19 `test()` calls + 4 touch re-runs (`gameplay-restore` 2 + `growth` 2) = 23 runs.** The
  contract's "23 e2e specs" is a *run* count. F2's guess was right; it just never got
  confirmed, and an unconfirmed guess in a success criterion is a criterion nobody can check.
- **Fixed in place:** the arithmetic is now written out — **with the explicit warning that
  it does not license writing 23 into a criterion**, since F1 concurrently adds 3 runs.

### CPD-4 — F2's AD-8 contains a contingency that, once `ownership.md` exists, would delete its own regression gate

- **Wrong plan:** F2. **Highest-severity of the four.**
- **What was wrong:** AD-8's *What would change the answer* read: "if `ownership.md` lands
  and assigns `docs/reference/contract-surfaces.md` **exclusively to F1**, Phase 3 loses its
  only code change and **folds into Phase 2** as a pure verification step."
- **Why only a cross-reader sees it:** the trigger is this document. An implementer who saw
  "`ownership.md` landed" and skimmed for "contract-surfaces.md" could plausibly conclude
  the contingency had fired — F1 *does* claim that file — and collapse Phase 3. Phase 3 is
  where F2's **full Playwright run** lives, and that run is the **only** gate on
  `signInViaUI` after the sign-in form is restructured. Every authenticated spec in the repo
  funnels through it. Collapsing Phase 3 would have removed the one check standing between a
  moved form control and eight silently broken spec files.
- **Fixed in place:** AD-8 now records that ownership is **per section, not per file** (with
  the line numbers), that F2 **keeps** its new H2 section, and that **Phase 3 must not fold
  into Phase 2** — naming the regression gate as the reason.

### Checked and found sound (recorded so the next reader does not re-derive them)

- F1's claim that `t.nav.items` has **six** keys while `AppShell`'s `items` array holds
  **five** (the sixth, `parent`, is a pinned sidebar link and is spread into `tabs`) —
  **verified on disk**. F1's Phase 4 correction of the three stale "Five entries" comments
  is right.
- Both plans independently say `supabase/migrations/` is uncontended — **verified**, and
  each asserts it of the other correctly.
- F2's claim that `AUTH_COOKIE_RE` is module-private (line 19) and that `clearAuthCookies`
  bypasses `setAll` — **verified**; the "never put `maxAge` in `AUTH_COOKIE_OPTIONS`"
  warning is real.
- Both plans' `contract-surfaces.md` conflict rule ("keep both sides") already agreed.

---

## 4. Migration author

**`none`.**

`supabase/migrations/` is **uncontended and unwritten this run**. Both plans state it
explicitly (F1 *Migration Notes*: "No Supabase migration"; F2 *What We're NOT Doing*: "No
migration, no new table, no new column"), and the sweep confirmed neither plan's *Changes
Required* names a migration file. Latest migration on disk stays
`20260822120000_shift_log_add_earned.sql`.

**The serialized lane is therefore closed for this run.** If a phase discovers it needs
schema, it **does not write one**:

1. Stop; the item leaves its change (F1's `change.md` AD-1 already specifies this reversal).
2. Say so in the handoff and name the table/column.
3. The migration becomes its own change with its own author — because L-001 requires RLS
   policies **in the same migration**, granular per-operation and per-role, and two
   concurrent agents each authoring one is exactly how a policy gap ships silently.

---

## 5. Nav entries and the 712px tab count (L-007)

### Tab count at the `touch` viewport — the bar holds, unchanged

**Neither feature adds a nav entry.** The trigger condition for this check ("if two features
each add a nav entry") is **not met**, so the check is a confirmation of the shipped state
rather than a new-risk assessment.

Measured in `src/components/app/AppShell.astro`:

- `items` = **5** (`dashboard` `/app/start`, `missions` `/app/task`, `shop` `/app/upgrades`,
  `growth` `/app/growth`, `worlds` `/app/worlds`) — the desktop sidebar list.
- `tabs` = `[...items, parent → /app/report]` = **6** — the bottom bar, i.e. what renders at
  712px (below `lg`).

**The bar holds at 6, and this is proven, not asserted:** `e2e/growth.spec.ts` Risk E2E-F4-2
already loops `Object.values(t.nav.items)` and asserts `toHaveCount(1)` **and**
`toBeVisible()` per label in **both** Playwright projects, and `growth.spec.ts` is one of the
two files the `touch` project matches. A 6-tab bar that overflowed or wrapped a label out of
view would already be red. F1 Phase 4 *strengthens* this loop with a per-entry `href`
assertion; it does not add a tab. **No feature may add a 7th tab this run** — a 7th would
invalidate the only fit evidence available and needs its own layout decision.

Also binding on F1: `AppShell.astro` must show an **empty `git diff`** at every commit
(Phase 4's `href` mutation is a deliberate break and must be restored).

### L-007 substring check — run in **both directions**, by the sweep, with **both** keys present

Executed against every double-quoted string value in `src/i18n/pl.ts` (**351 distinct
values**), for each new label, in both directions, plus the two new labels against each
other:

| New label | Existing values that are a **substring of** it | Existing values that **contain** it |
|---|---|---|
| **F1** `growth.noNextUpgrade` = `"Masz już wszystkie ulepszenia dostępne na tym etapie."` | **0** | **0** |
| **F2** `auth.signin.rememberLabel` = `"Zapamiętaj mnie"` | **0** | **0** |

- **Cross-feature:** neither new label contains the other. **No collision.**
- Neither label already exists verbatim in the dictionary.
- **Result: clear in both directions, for both features, with both keys present.** This
  supersedes each plan's own solo check (F1 checked against 314 phrases before F2's key
  existed; F2 checked before F1's).

**Still re-run it before committing.** The keys land on two branches that have not seen each
other. A one-line node script over `src/i18n/pl.ts` is the whole cost.

### One L-007 hazard neither feature creates but F2 must not re-create

`t.auth.reset.heading` and `t.auth.reset.signinLinkLabel` are the **same string**,
`"Nie pamiętasz hasła?"` (lines 35 and 41). F2 moves the link into `SignInForm.tsx` and
deletes it from `signin.astro`. **`/auth/signin` must render that string exactly once**
afterwards — F2's Phase 2 criterion (`grep -c` → `0` in `signin.astro`, `1` in
`SignInForm.tsx`) and its component test 3 (`getAllBy…`, assert length 1) both cover it.
`e2e/password-reset.spec.ts:90` locates `t.auth.reset.heading` by `getByRole("heading")` on
`/auth/reset-password` — a different page and a different role, so it is unaffected. Do not
"tidy" the two dictionary keys into one; they are two surfaces that happen to share text.

---

## 6. Rules that outlive this run

Candidates for `.claude/skills/10x-autonomous-run/references/lessons-addendum.md` so the
next run starts from them:

1. **`docs/reference/contract-surfaces.md` is permanently append-per-section.** Two runs in
   a row have now had two features land in it. Standing rule: claim a **section**, never the
   file; append a *new* H2 rather than editing a neighbour's; on conflict in a *Consumed by*
   / *Tests* line **keep both sides**. Nothing in `src/`, `tests/`, `e2e/` or CI reads it, so
   a bad resolution fails silently and permanently — this file cannot be protected by tests,
   only by discipline.
2. **`src/i18n/pl.ts` is permanently append-only, one key per entry, inside your own
   object.** Two appends in different objects merge cleanly; one restructure ruins every
   concurrent branch.
3. **A *read* dependency is not a *write* contention — and the distinction must be written
   down.** F1 lost a decision (D7) and nearly a stack edge to reading "F2 uses
   `signInViaUI`" as "F2 edits `accounts.ts`". Ownership rows should mark read-only
   dependents explicitly: they impose "do not move this symbol", not "do not both write".
   Both constraints are real; only one implies serialisation.
4. **Never write a `What would change the answer` clause whose trigger is `ownership.md`
   itself, unless the fallback is safe.** CPD-4 is the pattern: a plan pre-authorised
   deleting its own regression gate on a condition the sweep would later half-satisfy. If a
   plan must name that contingency, it states the *minimum* that survives it — here, "the
   full Playwright run stays wherever the section goes".
5. **Reconcile "N specs" against the per-project multiplier once, at contract time.** Both
   plans burned words on 19-vs-23. `e2e/` has **8 spec files**, **19 `test()` calls**, and
   the `touch` project re-runs exactly `gameplay-restore` + `growth` → **23 runs**. Future
   agent contracts should say "23 e2e **runs** (19 tests, 2 files re-run by `touch`)".
6. **The contention sweep must read each plan's `research.md` when a plan claims another
   plan's footprint.** CPD-1 was only fully settled by grepping F2's research and finding
   all three mentions were reads. Plans describe themselves accurately and each other
   loosely.
