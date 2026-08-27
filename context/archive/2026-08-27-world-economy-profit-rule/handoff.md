# Handoff — `world-economy-profit-rule` (feature F1)

`/10x-impl-review` wrote this. **The branch is implemented, independently
re-verified and cleared to merge: 0 CRITICAL, 3 WARNING, 5 OBSERVATION, all four
suites green measured in the review step itself.** The one thing the next agent
must not get wrong: **the review found a real coverage gap in the headline
deliverable — the dominance sweep judges a branch by its best entry, so a single
badly-priced catalogue entry ships with nothing red (RF-1). It is a follow-up, not
a blocker, because today's constants pass on merit.** Merge order still binds:
**F1 before W1 `six-worlds-catalogue`**, and W1 branches from **this** branch.

## 1. State

| field | value |
| --- | --- |
| Branch | `feat/world-economy-profit-rule` |
| Cut from | `matmaverse-v2` @ `91754ef` |
| Worktree | `.claude/worktrees/world-economy-profit-rule` (E2E_PORT **4330**) |
| Position in stack | **F1, first of 2** — `six-worlds-catalogue` (W1) branches from here and merges after |
| Commits | **8**, `502c798..HEAD` — six code phases, one docs commit carrying the change folder, one review commit |
| Pushed? | **no**. No PR. |
| `change.md` status | `impl_reviewed` |
| `## Progress` rows remaining | **0** (`grep -c '^- \[ \]' plan.md` = 0; 39 of 39 ticked, each with its commit sha) |
| Working tree | **clean** in the worktree after the review commit. The change folder is committed on **both** `feat/world-economy-profit-rule` and `matmaverse-v2` with byte-identical content, so the merge is an identical add/add (AD-16, preserved by this step). `context/changes/six-worlds-catalogue/` and `context/runs/2026-08-27-world-economy/` are **not mine** and were left untouched. |

## 2. Artifacts

Written or changed **by this review step** only. The implementation's own artifact
list is unchanged and remains in the plan's `## Progress` rows and the phase commits.

| path | what it is |
| --- | --- |
| `context/changes/world-economy-profit-rule/reviews/impl-review.md` | **new** — the full report: verdicts table, the four deliberate breaks re-executed here, the live-database migration check, the predecessor-finding spot-check, 8 findings, 3 cross-plan defects, and the machine-read `MERGE:` gate |
| `context/changes/world-economy-profit-rule/follow-ups/review-fixes.md` | **new** — RF-1…RF-4 plus two carried items, each naming a file and a **symbol** |
| `context/changes/world-economy-profit-rule/handoff.md` | rewritten (this file) |
| `context/changes/world-economy-profit-rule/change.md` | `status: implemented` → `impl_reviewed` |

**No source file was changed by this review.** Every deliberate break was restored
and `git diff --quiet` confirmed clean after each. No CRITICAL finding existed, so
nothing needed fixing in code on this branch.

## 3. Verification

Baseline **re-measured in this step, not inherited** (contract rule 5): `npm test`
on the main checkout's `matmaverse-v2` gave **548 passed / 57 files**, which is
exactly the run contract's stated baseline and exactly the commit this branch was
cut from. Sandbox disabled, local Supabase up (API on `127.0.0.1:54321`).

| command | result (observed in this step) |
| --- | --- |
| `npm test` (baseline, `matmaverse-v2`) | **548 passed / 57 files** — the baseline, re-measured |
| `npm test` (this branch) | **629 passed / 62 files** — baseline 548 / 57, **+81 tests, +5 files** |
| `npm run check` | **exit 0 — 0 errors, 0 warnings, 8 hints, 211 files** (baseline 202 files, +9) |
| `npm run lint` | **exit 0**, clean |
| `E2E_PORT=4330 npx playwright test` | **26 passed / 26** — baseline 26, **+0** |

**The arithmetic reconciles and was checked, not accepted.** 548 + 81 = 629 ✓.
The plan's six per-phase deltas sum to the same 81 (12 + 11 + 16 + 6 + 33 + 3) ✓.
57 + 5 = 62 files ✓. No number in the implementer's handoff had to be rounded.

**Four deliberate breaks re-executed by this step** (L-004 — each with what went
red and why that redness is evidence for *that* claim). All restored, tree clean.

1. `recordShiftResult`: `const earned = profit` → `= revenue`. Red on exactly two
   cases in `tests/shifts-complete.test.ts` (`expected 48 to be 44`; `expected 42
   to be 36`), while `tests/economy-invariants.test.ts` stayed **green** —
   independently confirming that FR-008 monotonicity certifies nothing about the
   profit rule, because both revenue and profit only grow the wallet.
2. `customers.runningCost` 2 → 40. Red with the exact recorded message: *TRAP:
   buying "customers" at d=0 owning [] drops profit 45 → 13*.
3. `e2e/growth.spec.ts` seed `.slice(1)`. Both Playwright projects red on
   `getByText('Masz już wszystkie ulepszenia dostępne na tym etapie.', { exact: true })`.
4. Deleted `piekarnia`'s whole decoration set. **Four** cases red in
   `tests/decorations.test.ts` while `tests/pacing.test.ts` stayed green —
   confirming both that the W1 seam is load-bearing and that the never-idle pacing
   assertion cannot see a drained world.

**Two extra breaks run to meta-check the sweeps themselves** (this is where RF-1
came from): pricing the whole margin branch out (`precision` 900, `margin` 1200)
turns dominance clauses 1, 2 and 3 red — but raising **only** `precision` to 400
leaves all six invariant cases **green**, because `bestRoi` takes the branch
maximum. Separately, restoring `margin.cost` to the 180 first guess turns clause 3
red exactly as AD-11 claims, so the one constant that moved moved for a true reason.

**Migration checked against the LIVE database, not just the file.**
`git diff --name-only 91754ef..HEAD -- supabase/` is empty. On the running stack,
`child_profiles.shop_state` is `jsonb NOT NULL DEFAULT '{"purchased": []}'` and the
only CHECK constraints on the table are `age 6–9`, `completed_shift_count >= 0`,
`business_level >= 1`, `wallet_balance >= 0` — **nothing constrains `shop_state`'s
shape**, so the optional `decorations?: string[]` sibling genuinely needs no
migration and every legacy row stays valid. No new RLS surface (L-001 not engaged);
`tests/decorations-buy.test.ts` § *"L-002 spoof"* verifies the cross-account block
through a service-role read-back of the durable row, not a chained `.select()`.

**Predecessor findings verified, not inherited.** All seven FIXED plan-review
findings were checked in code. Six hold as written. The seventh (F3, no-dominance)
produced the branch's one real deviation — `DOMINANCE_FLOOR` 0.35 in three scoped
clauses instead of 0.6 everywhere — and that deviation **holds**: clause 1 measures
a worst ratio of 0.50 against a 0.35 floor and clause 2 measures 34%/66% against a
25% floor, so neither was fitted to the data, and both bite when the branch is
genuinely mispriced.

## 4. Next command

`/10x-e2e world-economy-profit-rule` — or, if the run's E2E step is skipped, none; ready to merge.

## 5. Open

- **RF-1 — the dominance sweep judges a branch by its best entry.**
  `tests/economy-invariants.test.ts` → `bestRoi`. Raising `precision.cost` to 400
  leaves all six invariant cases green. Add a per-entry clause; derive its floor
  with headroom, never fit it. Watch that the capacity branch's AD-7-frozen 5%
  price spread may make a tight floor unsatisfiable there — report the residual,
  do not weaken the clause. Full detail in `follow-ups/review-fixes.md`.
- **RF-2 — `t.results.costLabel` ("Koszt sklepu: {cost} zł") is a superstring of
  `t.upgradeShop.costLabel` ("{cost} zł").** `src/i18n/pl.ts`. The only substantive
  hit in a 408-string, two-direction L-007 sweep run in this step. Harmless today
  (no screen renders both); the lesson is that Progress row 3.5's grep covered only
  Phase 3's strings.
- **RF-3 — the decoration tile renders `lockedByFunds` for every rejection reason.**
  `src/components/child/UpgradeShop.tsx` → the decorations `<section>`'s
  `check.ok ? … : …` branch. Correct by construction today; unpinned.
- **RF-4 — the `// Upgrade catalog names (S-06)` comment in `src/i18n/pl.ts` is
  orphaned above the new `decorations:` namespace.** Cosmetic. **Do it after W1
  merges** — that file is the run's hottest append-only surface.
- **`ShopIconKey` is exported from `src/components/child/ShopGlyph.tsx`, NOT from
  `src/data/decorations.ts`** as the plan and `ownership.md` §1a both wrote.
  `decorations.ts` imports it type-only and does not re-export. **W1 must import it
  from `@/components/child/ShopGlyph`**, and appending to `SHOP_ICONS` widens the
  union with no type edit at all — twelve spare keys are already mapped for this.
- **W1's Phase 1 turns FOUR cases red in `tests/decorations.test.ts`, not one** —
  the per-world totality case drags three siblings with it (verified by break #4).
  Seeing fewer than four means something weakened F1's assertion; that is a finding
  against W1, per CPD-2.
- **W1 must not re-seed `e2e/growth.spec.ts`.** F1's repair anchors on
  `decorationsForWorld(SEED_WORLD)` with `SEED_WORLD = "kawiarnia"`, so W1's two new
  worlds change nothing there.
- **Carried from implementation, unchanged and still open:** `t.growth.noNextUpgrade`
  is imprecise (says *ulepszenia*, fires for decorations too) and is kept verbatim
  because `e2e/growth.spec.ts` asserts it with `{ exact: true }`; the first purchase
  lands on shift 1 rather than ~3 (AD-7 reports rather than fixes it — reversing
  means raising `sign` to ~60–70 and re-running every affordability assertion in
  `e2e/gameplay-restore.spec.ts`); the 16 `t.decorations` names and
  `t.upgradeShop.decorationsHint` were authored unattended and want a native-speaker
  pass; `buyDecoration` inherits `buyUpgrade`'s read-then-write race, backstopped by
  the live `wallet_balance >= 0` constraint.
- **Human checklist (five items) still outstanding** — each has a named automated
  stand-in in the plan's Progress rows, and this review broke two of those
  stand-ins to confirm they bite. What is left is visual judgement only: the results
  `zysk` against the `/app/start` wallet delta; both margins under "Wkrótce" with the
  branch reason at level 3 without `sign`; whether the lucide glyphs read at the same
  weight as the illustrated ones; the exhausted-catalogue next-thing card naming a
  current-world decoration; and a world switch renewing the sink with upgrades intact.
- **No mockup exists** for a decoration, the three-number results breakdown, or the
  shop's decoration section, and `assets/` is absent from the worktree. All three
  layouts are **explicit extrapolations** — this review did not read them as
  mockup-derived and neither should the E2E or integrate step.

## 6. Autonomous decisions

Made by **this review step**, in place of asking a human (run rule 1). The
implementation's AD-1…AD-16 are unchanged; AD-10 and AD-11 were verified rather
than re-decided (see §3).

- **RD-1 — verdict APPROVED and `MERGE: CLEAR`, with three warnings standing.**
  *Chosen:* judge the warnings by weight, not by count, and ask of each whether it
  changes what the shipped product does. RF-1 is a coverage gap behind constants
  that pass on merit; RF-2 is a latent locator ambiguity on screens that never
  co-render; RF-3 is an unreachable copy branch. None changes shipped behaviour, so
  none blocks. *Rejected:* `NEEDS ATTENTION` because three warnings exceed a
  "≤2 minor" rubric — that is exactly the count-based mislabel the skill and the
  step brief both name, and in the source run it mislabelled two mergeable branches.
  *What would change the answer:* any one of the three turning out to change shipped
  behaviour — most plausibly RF-1, if a sweep showed a shipped entry already sitting
  below a defensible per-entry floor. That would make it CRITICAL and block.
- **RD-2 — RF-1 is filed as a WARNING follow-up rather than fixed in code here.**
  *Chosen:* report it, with the reproduction and the proposed clause. *Rejected:*
  writing the fourth clause on this branch — the skill's triage says CRITICAL fixes
  in code, WARNING goes to follow-ups, and the honest floor is **not yet measured**;
  landing a guessed constant into the tranche's headline deliverable would be
  precisely the fitted-to-the-data move `DOMINANCE_FLOOR`'s own header forbids.
  Also rejected: raising it to CRITICAL — nothing that ships is mispriced, verified
  by clause 3 catching the one real mistuning (AD-11) when I reintroduced it.
  *What would change the answer:* a measured `ENTRY_FLOOR` that today's constants
  fail. Then it is a CRITICAL and the branch is BLOCKED until the price moves.
- **RD-3 — `needsE2E` is false.** *Chosen:* no browser phase is warranted by
  anything this review found. All three warnings are unit-level or copy-level, the
  repaired Risk E2E-F4-3 is green **and** meta-checked by my own seed break, and the
  five human-checklist items are visual judgement no Playwright assertion settles.
  *Rejected:* requesting E2E for the decoration buy path — `tests/decorations-buy.test.ts`
  already drives the real route against the real database, including the L-002 spoof
  with a service-role read-back, so a browser adds nothing but flake. *What would
  change the answer:* the run deciding the new `/app/upgrades` decoration section
  needs a rendered-at-712px check for the L-007/duplicate-accessible-name traps —
  that genuinely needs a browser, and it is the one E2E worth writing.
- **RD-4 — the review artifacts are committed on the feature branch AND mirrored
  onto `matmaverse-v2` in the main checkout, byte-identical.** *Chosen:* extend
  AD-16's established pattern to the two new files. *Rejected:* committing only in
  the worktree (leaves the main checkout with an untracked `reviews/impl-review.md`
  and `follow-ups/`, and `git merge` then aborts with *"untracked working tree files
  would be overwritten"* — the exact failure the step brief warns about); and writing
  the review into the main checkout only (the verifier greps the worktree). `git add`
  was scoped to `context/changes/world-economy-profit-rule/` alone; the neighbouring
  `context/changes/six-worlds-catalogue/` and `context/runs/2026-08-27-world-economy/`
  belong to other steps and were left exactly as found. *What would change the
  answer:* an orchestrator convention that `context/changes/` stays untracked until
  the integrate step commits it in one sweep — then the worktree commit alone is
  right and the main checkout should be left entirely alone.
