# Handoff — `world-selection-screen` (F5)

Updated by the `/10x-plan-review` step (2026-08-23) of the autonomous run
`context/runs/2026-08-22-autonomous-five/`. **Standing brief for every step of this run:
`context/runs/2026-08-22-autonomous-five/agent-contract.md` — read it in full before doing
anything.** It binds you: no human in the loop (never call `AskUserQuestion` — decide
yourself and record it under `## Autonomous decisions`), always leave an updated handoff,
report back in ≤ 12 lines.

---

## 1. State

| Item | Value |
| --- | --- |
| Change folder | `context/changes/world-selection-screen/` |
| `change.md` | **`status: plan_reviewed`** (advanced from `planned` by this step) |
| `research.md` | written — background; the plan supersedes it where they differ |
| `plan.md` | **REVIEWED (deep) and amended** — 5 phases, `## Progress` intact |
| `plan-brief.md` | written; 2 rows corrected by this review — read it first |
| **`reviews/plan-review.md`** | **NEW — the full report, 8 findings, all resolved** |
| Git branch | **not created** — no branch, no code, no migration |
| **Next command** | **`/10x-implement world-selection-screen`** (or `/10x-tdd`) — but see §6: F5 is **last** in the queue |

**Verdict: REVISE → SOUND after triage.** 0 CRITICAL, 5 WARNING, 3 OBSERVATION. Seven findings
were fixed directly in `plan.md`; one was recorded as an accepted risk (KR-7). The plan is
implementable as it now stands.

This step changed exactly four files, all inside the change folder: `reviews/plan-review.md`
(new), `plan.md`, `plan-brief.md`, and the `status:`/`updated:` lines in `change.md`. **No
production file was touched, no branch created, no commit made** — another feature
(`feat/dashboard-recent-activity`) was mid-implementation in the working tree throughout.

> **Note on the previous attempt.** An earlier plan-review pass was killed by an API session
> limit before saving anything, but it *had* already written edits into `plan.md` (the
> `## Known risks` block KR-1…KR-6 and several inline "plan-review correction" notes). This
> pass verified those against the code rather than trusting them — they held. The report now
> on disk is the authoritative one.

## 2. What the review checked hardest, and what it found

Everything below was traced in the code, not read off the research summary.

- **Account scoping of the new write — SOUND.** `child_profiles` carries four per-operation
  RLS policies, all `to authenticated`, all `auth.uid() = account_id`
  (`20260609120000_child_profiles_isolation.sql:78-104`). The endpoint proves ownership twice
  (the `resolveActiveProfile` read gate, and the UPDATE policy itself), and nothing rests on
  client input. Cross-account is impossible. **Not CRITICAL.**
- **D-2's motivational claim — TRUE.** `canBuy` (`upgrades.ts:145`) and `nextUpgrade` (`:161`)
  read only `{ walletBalance, businessLevel, purchased, skillState }`; `theme` appears nowhere
  in the module. A switch is provably a no-op for the whole upgrade loop, so the copy
  `t.worlds.carryOver` ships is honest. **Not CRITICAL.**
- **D-1 — confirmed from code.** `Upgrade` has **no world field**; `theme` is read in exactly
  three render-time places via `worldForTheme()`. `prd-v3.md:180` re-read: it is **Open
  Question #5** and explicitly unproven — the plan had already caught that and re-grounded the
  option-C rejection on `prd-v3.md:92`, which is a real FR. Fair.
- **Zod / `WORLD_SLUGS` — confirmed.** Typed `[string, ...string[]]` (`worlds.ts:34`), which is
  why `.refine` and not `z.enum`. There is **no DB CHECK on `theme`**, so this refine is the
  only guard — and it holds. An unknown slug cannot reach the DB.
- **Navigation — confirmed, and the label is the mockup's own.** The web mockup's sidebar
  literally reads **"Światy"** with a globe. No substring collision with any `pl.ts` string or
  any live e2e locator, in either direction. `PROTECTED_ROUTES = ["/app"]` + `startsWith`
  already gates `/app/worlds`; **no middleware edit**. Bottom-bar arithmetic re-derived from
  `AppShell.astro` rather than from F4's prose: 32px per-tab floor, **208px** for six tabs,
  **116px each at 712px** — F4's numbers are right.
- **4 vs 6 worlds — deliberate.** `grid-cols-2` at every breakpoint reads as a 2×2 block at
  four and does not break at six; `lg:grid-cols-3` restores the mockup when art lands.
- **`## Progress` — mechanically clean.** One heading, five matching `### Phase N`, all 37
  criteria have rows, no stray checkboxes.
- **F5 does not touch `src/lib/services/reports.ts`** — confirmed by grep. The F2/F1/F4
  three-way collision in that file does not involve F5 at all.

## 3. What was fixed in `plan.md` (do not re-litigate these)

| # | Was | Now |
| --- | --- | --- |
| F1 | Phase 2/3 demanded `npx playwright test` "still green at **15/15**" | Moving-baseline wording: green, no pre-existing spec newly failing, count measured at phase start. 15 kept as a dated baseline with `--list` evidence |
| F2 | Phase 4 demanded "all **11** pre-existing assertions" in `tests/upgrades-buy.test.ts` | "Every pre-existing test green and unmodified — count at phase start"; F4 adds a 12th to that file **before** F5 lands. A cross-feature note was added recording F4's edits to `child-profiles.ts` (`:129`, `:187`) vs Phase 4's (`:246-252`) |
| F3 | D-11: "if F4 has landed on `ShopArt`, skip Phase 5 and hand the coordinates to F4" | F4 always lands first, so that read as "always skip" — and handing anything over is impossible. F4's plan says it changes **only the doc comment** in that file. New trigger: **run** Phase 5 unless F4's landed diff restructured the component or changed the base `src` at `:42` |
| F4 | Phase 3 verified "the **5-tab** bottom bar" | 6 tabs is the expected state (F4 precedes F5); D-6, KR-3, the manual criterion and Progress 3.7 all updated, with the 208px/116px derivation now taken from the component |
| F5 | Phase 2 tests would not have found the tiles | `SelectTile` renders `alt` **and** `label` in one button → accessible name is doubled ("Kawiarnia Kawiarnia"), so RTL's whole-string `name` match fails; and `aria-pressed` is always present, never dropped. Both recorded above the test list |
| F7 | Phase 4's `purchasedMeta` write said the outer `...current.shop_state` spread preserves the key | It does not once the key is named explicitly. Contract now spells out `...(current.shop_state.purchasedMeta ?? {})` and why both the inner spread and the `?? {}` are load-bearing |
| F8 | Two citation slips (`upgrades.ts:8-9` for the theme-neutral-art claim; `prd-v3.md:180` in the brief) | Re-pointed at the evidence that actually supports them — D-1 now leads with the structural proof, and the brief's two rows are re-grounded on `prd-v3.md:92` |

## 4. What was deferred / recorded rather than fixed

- **KR-7 (new)** — the write is **account-scoped, not profile-scoped**. Cross-account is
  impossible; but nothing pins `profileId` to the *active* profile, and profile ids are already
  in the browser via `/app/pick-profile`, so a crafted POST can change a **sibling's** world —
  and the redirect to `/app/start` renders the active profile, so it is invisible to whoever did
  it. Accepted: `select.ts` / `delete.ts` grant strictly larger capabilities on the same ids, and
  the effect is a cosmetic reversible theme flip. One-line remedy recorded in the plan if it ever
  needs closing.
- **KR-1…KR-6** stand as before (silent failure redirect, `buyUpgrade`'s unchecked row count,
  6 tabs at 360px, the unspecified grid max-width, no test pinning world slug strings, CSRF).
  All re-read this pass; all still accurate. KR-3 and the preamble were amended.

## 5. Unresolved risks the implementer carries

1. **KR-7** — intra-account profile targeting (above). Not a leak; a product call.
2. **KR-1** — a failed switch is silent to the child (no error param, by design). Product call.
3. **KR-4** — the 2×2 grid's max width is still a judgement call; manual criterion 2.6
   (360/712/1440px) is the only gate. `CreateProfileWizard.tsx:244` is the precedent to copy.
4. **Phase 5's fate depends on F4's actual landed diff.** Expected: run it. Check the diff
   before deciding — the plan now says exactly what to look for.
5. **Both mockups are local-only** (`assets/` is gitignored). They are present on this machine
   and were opened during this review. **Open the PNGs before laying out Phase 2** — the plan
   assumes you have.

## 6. Position in the run, and the branch instruction

The run's implementation queue is strictly serial (one working tree):
**`F2 (running) → F3 → F1 → F4 → F5`.** F5 is **last**. Three of this review's fixes exist
solely because the plan had been written as though it might land early — do not undo them.

**Branch: cut `feat/world-selection-screen` from `feat/ui-polish`, NOT from whatever branch is
checked out.** At the time of writing the tree is on `feat/dashboard-recent-activity` with
uncommitted F2 work; branching from there would drag another feature's changes into F5.

```bash
git switch feat/ui-polish
git switch -c feat/world-selection-screen
```

Then one commit per completed plan phase, Conventional Commits, only on green. Do not push, do
not open a PR, never bypass the pre-commit hook.

## 7. Phases, unchanged in shape

1. **Service + endpoint** (no UI) — `updateChildProfileTheme` + `POST /api/profiles/world` +
   the `contract-surfaces.md` entry. `tests/profiles-world.test.ts` (6), containing the
   isolation test that asserts durable state through the service-role `admin` client (L-002).
2. **The screen** — the `worlds` i18n block (13 keys), `WorldPicker` island, `worlds.astro`,
   and the `AppShell` `active` union widening. `tests/worlds-picker.test.tsx` (7).
3. **Nav entry** — `items` + `nav.items.worlds = "Światy"`. `tests/nav-labels.test.ts` (3).
   **Phases 2 and 3 must land in the same session** — 2 alone leaves the screen URL-only.
4. **Option E** — `ShopState.purchasedMeta?`, one line in `buyUpgrade`. `tests/upgrades-buy.test.ts` +3.
5. **Option D — droppable** — `WORLD_SLOTS` data only. `tests/shop-art-slots.test.ts` (4).

Unit tests: **+23 from wherever the suite stands when F5 starts** (299 was the run's opening
baseline; F1–F4 land first). Do not pin absolute counts anywhere — that was finding F1.

## 8. Browser-test candidates for this run's `/10x-e2e` step

Named in the plan, not pre-written: (1) **a world switch persists across a reload** —
`seedChildProfile` already accepts `theme` and `shopState`, verified, no new fixture needed;
(2) **the nav entry at touch width** (712px), which requires widening `playwright.config.ts`'s
`testMatch` for the `touch` project.
