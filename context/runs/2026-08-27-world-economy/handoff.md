# Integration handoff — run `2026-08-27-world-economy`

**Status: MERGED AND GREEN.** Both features are on one integration branch, the full
suite passes on it, and the count arithmetic reconciles exactly against each branch's
contribution.

| | |
|---|---|
| **Integration branch** | `run/2026-08-27-world-economy` @ **`455de2b`** |
| **Cut from** | `matmaverse-v2` @ `ba1c1a7` |
| **Features landed** | 2 of 2 — E1 `world-economy-profit-rule`, W1 `six-worlds-catalogue` |
| **Excluded** | none |
| **Merge conflicts** | **zero** — see §2 for why, and for what that costs you |
| **Merge-only defects** | **none found**, and §2 explains why none was structurally possible |
| **Autonomous edits by this step** | one, commit `455de2b` (a comment move E1 scheduled for exactly this moment) — §5 |
| **Not pushed. No PR. `main` untouched.** | `git push` was never run; `main` is where you left it |
| **Working tree** | clean. `context/runs/2026-08-27-world-economy/` is **untracked**, deliberately, and was never `git add`ed |

---

## 1. What landed, in what order

The merge order was binding — `ownership.md` §2 upgraded the orchestrator's *preference*
edge to a **prerequisite**, because W1 imports `Decoration` and `ShopIconKey` from E1,
turns E1's per-world totality assertion red, and sizes two `WORLD_SLOTS` tables to an
`UPGRADE_IDS` that only E1 grows to eight.

```
matmaverse-v2 @ ba1c1a7
  └── c333f36  merge(run): land F1 world-economy-profit-rule
        └── d27bfb3  merge(run): land F2 six-worlds-catalogue
              └── 455de2b  docs(i18n): re-home the S-06 catalogue comment (RF-4)   ← this step's own edit
```

**1. `feat/world-economy-profit-rule` (E1)** — 6 commits, 33 code files, +3183 / −70.
A shift now pays **profit**, not revenue (`profitForShift`, D-11); the catalogue closes
at **eight** with a `precision` + `margin` branch; decorations become the **renewing
sink** (`src/data/decorations.ts`, 4 per world at 40/80/140/220) living in the optional
`shop_state.decorations` sibling — never in `purchased`; new route
`POST /api/decorations/buy`; new `ShopGlyph` art fallback; the pacing harness
(`scripts/telemetry-harness/pacing.ts`) derives the reference shift per D-13.

**2. `feat/six-worlds-catalogue` (W1)** — 5 commits, 10 code files, +265 / −7.
**Pracownia** and **Laboratorium** join `WORLDS` (six worlds); both world grids reflow;
two new `WORLD_SLOTS` tables; 8 more decorations and their 8 `t.decorations` keys; new
`e2e/worlds.spec.ts` and `tests/worlds-art.test.ts`; `playwright.config.ts`'s `touch`
`testMatch` extended to a three-way alternation.

**No migration** — neither feature ships one, as `ownership.md` §1e predicted for two
independently-correct reasons. `shop_state` is jsonb and gained an optional sibling;
`child_profiles.theme` is `text not null` with no CHECK constraint, so a sixth world
widens a zod refine in code and nothing else.

---

## 2. Conflicts — and the honest reason there were none

**Conflicts: zero. Files needing a resolution: zero.** I never typed `--ours` or
`--theirs` because git never asked.

That is not luck, and it is worth understanding before you read the verification table
as stronger evidence than it is:

- **W1's branch was cut from E1's**, so E1's commits are ancestors of W1's. The second
  merge was a fast-forward of content git had already reconciled.
- The four genuinely-contended registries — `src/i18n/pl.ts`,
  `src/components/child/ShopArt.tsx`, `src/components/child/ShopGlyph.tsx`,
  `src/data/decorations.ts` — were each edited by **both** features, and each carries
  both symbol sets, because W1 appended to E1's landed text rather than to a sibling copy.
- **The merged tree is byte-identical to `feat/six-worlds-catalogue`'s tree.**
  `git diff --stat feat/six-worlds-catalogue HEAD` (before `455de2b`) is empty. The three
  docs-only commits `matmaverse-v2` picked up after `91754ef` were already present on the
  feature branch with identical content, so even the add/add resolved silently.

**The consequence you should hold onto:** because W1's branch already *was* the
integration tree, W1's own verification was effectively an integration verification, and
there was no merge-only surface for a cross-feature defect to hide in. The source run's
merge-only bug (six nav tabs squeezing a link under the dev toolbar) had a real
two-lane merge to appear in. **This run had one serial stack, so that class of bug had
nowhere to live.** I still ran the full suite and the checks below — but I am telling you
that a green here is a *confirmation*, not an independent discovery, and I would rather
you knew that than over-read the table.

I verified the registries carry both symbol sets anyway, by inspection rather than by
trusting the clean merge:

| Registry | Both sets present? |
|---|---|
| `src/i18n/pl.ts` → `t.decorations` | **24 keys** — E1's 16 + W1's 8. `t.nav.items` still **6**. |
| `WORLD_SLOTS` (`ShopArt.tsx`) | `piekarnia`, `galaktyczna-baza`, `sklep-ksiegarnia` (E1) + `pracownia`, `laboratorium` (W1). `kawiarnia` still absent, still falling through to `DEFAULT_SLOTS`. `DEFAULT_SLOTS` carries all 8 ids incl. E1's `precision`/`margin`. |
| `src/data/decorations.ts` | **24 entries, 6 worlds × 4**, all on the shared 40/80/140/220 curve. Zero id overlap with `UPGRADE_IDS`. |
| `SHOP_ICONS` / `ShopIconKey` | union of both features' icon appends; derived as `keyof typeof SHOP_ICONS`, so W1's append widened it with no type edit. |
| `playwright.config.ts` `touch` `testMatch` | `/(gameplay-restore\|growth\|worlds)\.spec\.ts/` — **all three alternatives**. |
| `docs/reference/contract-surfaces.md` | both of E1's sections present (`decorations` on `child_profiles`, `earned`-carries-profit + no-row-for-decorations on `shift_log`). W1 correctly wrote nothing. |
| `src/types.ts` | `ShopState.decorations?: string[]` present, appended. |

---

## 3. Verification on the integration branch

Every command run in the **main checkout**, on `run/2026-08-27-world-economy`, with the
**sandbox disabled** (the contract's trap: the sandbox blocks `127.0.0.1:54321` and
~30 E2E tests fail for reasons unrelated to the code). Local Supabase confirmed up first.

| command | result | exit |
|---|---|---|
| `npm run lint` | clean | **0** |
| `npm run check` | **0 errors, 0 warnings, 8 hints, 213 files** | **0** |
| `npm test` | **633 passed / 633, 63 / 63 files** | **0** |
| `npm run build` | Vercel adapter bundled, server built | **0** |
| `npx playwright test` | **28 passed / 28** | **0** |

All five re-run **after** commit `455de2b` and green again at HEAD.

### The arithmetic, and it reconciles exactly

Baseline is the contract's, measured by the maintainer on `matmaverse-v2` @ `91754ef`.
`ba1c1a7` adds only `context/changes/**` docs, so the baseline carries over unchanged.

| | vitest tests | vitest files | Playwright | `check` files |
|---|---|---|---|---|
| baseline (`matmaverse-v2`) | 548 | 57 | 26 | 202 |
| **+ E1** (measured on its branch) | +81 | +5 | +0 | +9 |
| **+ W1** (measured on its branch, over E1) | +4 | +1 | +2 | +2 |
| **expected on the merge** | **633** | **63** | **28** | **213** |
| **observed on the merge** | **633** ✓ | **63** ✓ | **28** ✓ | **213** ✓ |

`548 + 81 + 4 = 633` · `57 + 5 + 1 = 63` · `26 + 0 + 2 = 28` · `202 + 9 + 2 = 213`.

The line-level diff reconciles to the unit as well — the pure merge `d27bfb3` against
`ba1c1a7`, code only (`':!context'`), is **39 files, +3448 / −77**, against E1's
**33 files, +3183 / −70** and W1's **10 files, +265 / −7**:
`3183 + 265 = 3448` ✓ · `70 + 7 = 77` ✓ · `33 + 10 − 4 overlapping files = 39` ✓
(the four overlaps are exactly the four contended registries named in §2).

### The deliberate break — run at integration, on the one thing a bad merge would have broken silently

`ownership.md` warns that a lost `testMatch` alternative is **silent**: the spec still
runs, desktop-only, at the one viewport that cannot carry its risk. So I broke exactly
that, on the merged tree, to find out whether my green could tell the difference.

Removed `worlds` from the `touch` alternation → `npx playwright test` reported
**27 passed, exit 0**. Fully green. Nothing failed. The only signal that anything was
wrong was the *count*, 27 against the expected 28.

Restored; re-confirmed `e2e/worlds.spec.ts` runs under **both** `[desktop]` and `[touch]`,
and the full run is back to 28.

**This is the load-bearing result of the whole step.** It means the arithmetic in the
table above is not ceremony — it is the *only* instrument that would have caught a bad
resolution in that file, and it is why "the suite is green" was never sufficient here.

### Cross-feature checks the suite cannot see

- **L-007 two-direction substring sweep** re-run programmatically on the merged
  dictionary: all **35** labels this run introduced, against every string in `pl.ts`,
  both directions. **One** containment, and it is the one E1 already logged as **RF-2**:
  `t.results.costLabel` ("Koszt sklepu: {cost} zł") is a superstring of
  `t.upgradeShop.costLabel` ("{cost} zł"). Verified inert — the two are rendered by
  `ShiftResults.tsx` and `UpgradeShop.tsx`, which never appear in one tree, and the only
  test locating either (`tests/shift-screen.test.tsx`) matches the full filled string.
  Reproducing E1's own finding independently is the useful part; no new hit.
- **Nav tabs: still six**, unchanged by both features, and `e2e/growth.spec.ts`'s
  data-driven `scrollWidth` assertion (Risk E2E-F4-2) passed in the `touch` project at
  712px. This is the source run's merge-only bug, checked rather than assumed.
- **The known E1 regression repair holds.** `e2e/growth.spec.ts:126` (Risk E2E-F4-3) is
  re-seeded against `decorationsForWorld(SEED_WORLD)` with `SEED_WORLD = "kawiarnia"`, so
  W1's two new worlds cannot touch it — and the assertion the test exists for is intact:
  `t.growth.noNextUpgrade` **and** the surviving shop CTA. The seed is world-agnostic by
  construction, so the next decoration batch will not silently stale it.
- **`prerender = false`** present on `src/pages/api/decorations/buy.ts`.
- **No decoration id in `WORLD_SLOTS`**, no decoration id in `UPGRADE_IDS`, and the
  `purchased` / `decorations` separation intact — the invariants `ownership.md` said to
  reject an implementation over.

---

## 4. What needs your hand

Nothing blocks the branch. In rough priority:

1. **`t.marketing.worlds` is stale at four against six — and it is user-visible.**
   `src/i18n/pl.ts:118`. It is a hand-maintained duplicate of `WORLDS` that nothing
   syncs or tests, and it is rendered in **two** places, not the one W1's handoff named:
   `AuthShell.astro:79` (`hidden grid-cols-4 … lg:grid` — the auth split view) **and**
   `Welcome.astro:83` (`grid-cols-2` — the signed-out landing, all viewports). So the
   signed-out product currently advertises four worlds while the app ships six.
   Both new art files are **already committed** (`public/illustrations/world-pracownia.webp`,
   `world-laboratorium.webp`), so the fix is two dictionary entries plus a column-count
   decision. **Do the list and `AuthShell`'s `grid-cols-4` in one change** or the desktop
   strip goes ragged 4+2, unnoticed. `Welcome.astro`'s `grid-cols-2` absorbs six as three
   rows with no class change. I left this alone deliberately: it is a marketing-copy and
   layout decision against a mockup drawn for four, `ownership.md` §1a put it outside both
   features' write surface, and it is not a merge defect — it is equally true on either
   feature branch.
2. **Eleven human-checklist items across the two features** — five from E1, six from W1 —
   all visual judgement no assertion settles. Both handoffs enumerate them
   (`context/changes/*/handoff.md` §5). E1's five in particular need the app running: the
   results `zysk` against the `/app/start` wallet delta, both margins under "Wkrótce" with
   the branch reason, whether the lucide glyphs read at the same weight as the illustrated
   art, and a world switch renewing the sink with upgrades intact.
3. **Copy needs a native-speaker pass.** All 24 `t.decorations` names, E1's four
   `t.results` labels, `t.upgrades.{precision,margin}`, and
   `t.upgradeShop.decorationsHint` were authored unattended. Also queued for that pass:
   `t.growth.noNextUpgrade` is now slightly imprecise (it says *ulepszenia* but fires when
   decorations are exhausted too) and was kept **verbatim on purpose**, because
   `e2e/growth.spec.ts` asserts it with `{ exact: true }`.
4. **No mockup exists** for a decoration, the three-number results breakdown, the shop's
   decoration section, or a six-tile world grid, and `assets/` is absent from both
   worktrees (gitignored). Every one of those layouts is an **explicit extrapolation** —
   the E2E and this integration step did not read them as mockup-derived and neither
   should you.
5. **Ten open follow-ups**, none critical, itemised in the two branches' review files —
   `context/changes/world-economy-profit-rule/follow-ups/review-fixes.md` (RF-1…RF-4) and
   `context/changes/six-worlds-catalogue/follow-ups/review-fixes.md` (F1…F6). The two
   sharpest: **RF-1**, the dominance sweep in `tests/economy-invariants.test.ts` judges a
   branch by its best entry, so raising `precision.cost` to 400 leaves all six invariant
   cases green; and **W1-F3**, the badge-placement evidence for the two new `WORLD_SLOTS`
   tables is not reproducible (the probe was deleted).
6. **Branch disposal.** Nothing was pushed and no PR was opened. Three worktrees are
   still on disk and idle (`.claude/worktrees/{world-economy-profit-rule,six-worlds-catalogue}`),
   and the run folder is untracked — delete it when you are done reading, or keep it; it
   survives branch switches precisely because it is untracked.

---

## 5. Autonomous decisions this step made

> Each with what would change the answer.

**AD-1 — Fixed E1's RF-4 on the integration branch (commit `455de2b`).**
E1's handoff scheduled one follow-up explicitly for *"after W1 merges"*: the
`// Upgrade catalog names (S-06)` header was orphaned above the new `decorations:`
namespace when E1 appended, and moving it mid-stack would have manufactured a conflict in
the run's hottest append-only file. **This is the first tree where both features are
present**, so I did it. Comment-only — no key added, moved, renamed, or removed; the
three lines now sit above `upgrades:` where they belong. All five commands re-run green
afterwards. *Reversal:* `git revert 455de2b` — it touches nothing but a comment.

**AD-2 — Did NOT fix the stale `t.marketing.worlds` list**, despite it being the most
user-visible inconsistency the merged branch ships (see §4.1). It is not a merge-only
defect (it is equally stale on either feature branch), `ownership.md` §1a explicitly put
it outside both features' write surface, and growing a four-card strip to six is a copy
and layout decision against a mockup I cannot see. Writing marketing copy unattended and
guessing a grid class is exactly the kind of silent design drift this run's rules exist to
prevent. *Reversal:* if you would rather it just track `WORLDS`, the durable fix is a
`nameKey` on `World` plus a derived strip — which is also W1's open follow-up **F2**, and
which would retire the duplicate rather than re-sync it.

**AD-3 — Ran the deliberate break on `playwright.config.ts`'s alternation rather than on
a data invariant.** Both features' reviews already broke their own data assertions. The
one thing *integration* uniquely owns is conflict resolution in shared registries, and the
alternation is the registry where a bad resolution is invisible to every exit code. It
returned 27/28-green, which is the result §3 turns on. *Reversal:* none needed; the break
was reverted and re-verified. If you want a second one, the highest-value target is
`tests/decorations.test.ts`'s per-world totality assertion — deleting W1's two worlds from
`DECORATIONS` should turn **four** cases red, not one (W1's finding F6 corrected
`ownership.md` §CPD-2 on this, and seeing fewer than four means something weakened it).

**AD-4 — Reported the zero-conflict merge as weak evidence rather than strong.** I could
have written "merged cleanly, full suite green, no cross-feature defects" and been
literally accurate. Because W1's branch was cut from E1's, the merged tree is
byte-identical to W1's branch, so the integration suite re-ran a verification W1 had
already effectively performed. Saying so costs the report some shine and is the only
version that lets you calibrate how much the green is worth. *Reversal:* none — but if
a future run splits into genuine parallel lanes, integration recovers its power as an
independent check, and that is when this section should read differently.

---

## 6. Reproducing this

```bash
git checkout run/2026-08-27-world-economy     # 455de2b
npx supabase status                            # API must be up on 127.0.0.1:54321
# run the suite with the command sandbox DISABLED — it blocks 127.0.0.1:54321,
# which reads like "Supabase is down" and costs ~30 unrelated E2E failures
npm run lint && npm run check && npm test && npm run build
npx playwright test                            # expect 28, and check the number, not just the colour
```
