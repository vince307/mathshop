---
change_id: world-economy-profit-rule
title: Profit rule — profit = max(0, revenue − cost), an 8-entry catalogue, and per-world decorations as the wallet sink
status: impl_reviewed
created: 2026-08-27
updated: 2026-08-27
archived_at: null
---

## Notes

Turn the one-term economy into a profit rule — profit = max(0, revenue − cost) with cost applied to a shift's revenue and never to the wallet — closing the catalogue at 8 entries and adding per-world decorations as the wallet's renewing sink, guarded by the no-trap / no-harm / no-dominance invariant sweeps and priced by a pacing model.

Feature **F1** of autonomous run `2026-08-27-world-economy`; backlog entry **E1**
(`context/foundation/backlog.md`, `## Ready`). Runs **first** in a serial stack with
**W1 `six-worlds-catalogue`** — not for a mechanical dependency (the D-3 copy fallback
decouples them) but because both edit `src/i18n/pl.ts`.

Design sources, all confirmed present on disk:

| path | what it carries |
| --- | --- |
| `docs/superpowers/specs/2026-08-27-world-economy-design.md` | the spec; D-11…D-13 |
| `context/foundation/shape-notes-world-economy.md` | rationale, rejected alternatives, D-1…D-13 |
| `context/foundation/backlog.md` | entries **E1** and **W1** |
| `context/runs/2026-08-27-world-economy/agent-contract.md` | run-binding rules and baseline |

**D-1…D-13 are settled.** A step that believes one is wrong writes a `## Known risks`
note or a `RETHINK` report — never a silent reversal.

---

## Verification of the backlog's claims (this step)

E1 carries **zero `[I]` tags** — `grep -c '\[I\]' context/foundation/backlog.md` finds
8, all of them in later entries (B-series, `:388–412`), none in E1 or W1. E1 states
outright: *"Inherited, re-check before planning: nothing."* That claim itself was
re-checked here, and the load-bearing `[V]` claims were re-read from source rather
than inherited. Anchors below are **symbols**, per L-006.

### Confirmed — re-read from source, 2026-08-27

- `earningsForShift(taskCount, cleanCount)` in `src/data/shift.ts` is genuinely
  **two-term**: `EARN_PER_TASK = 5`, `EARN_PER_CLEAN = 3`.
- `src/data/upgrades.ts` holds **6** entries; the five non-`sign` entries each carry
  `extraTasks: 1` and `MAX_BONUS_TASKS = 5`, so they sum to exactly the cap. Costs
  30+60+100+150+210+300 = **850 zł**.
- `canBuy`'s rung order is unknown → owned → world-level → skill → task-history →
  affordability, with the no-retro-lock property pinned in `tests/upgrades.test.ts`
  (`"owned short-circuits before the skill/history rungs (no retro-lock)"`).
- `businessLevelForShifts` = `1 + floor(n / SHIFTS_PER_LEVEL)`, `SHIFTS_PER_LEVEL = 3`;
  `max(requiredWorldLevel) = 3`, so the world-level gate is spent on shift 6.
- `ShopState` in `src/types.ts` is `{ purchased: string[]; purchasedMeta?: … }` — the
  optional-sibling precedent for `decorations?: string[]` is real.
- `ShiftScreen` already receives `purchased` (`ShiftScreenProps.purchased`), fed by
  `task.astro`'s `readPurchased(profile.shop_state)`.
- `src/data/stages.ts`'s module header carries the **ART DEVIATION** block verbatim as
  described: `Stage` has no `art` field, the rail renders from lucide + design tokens,
  and the upgrade path is recorded in the header. The precedent E1 is told to follow
  exists and says what the contract says it says.
- `e2e/growth.spec.ts` seeds `shopState: { purchased: ["sign", "shelf"] }` and asserts
  `t.growth.noNextUpgrade` (`"Masz już wszystkie ulepszenia dostępne na tym etapie."`).
  The regression the contract predicts is real.
- FR-008 / FR-010 / FR-011 / FR-012 / FR-013 in `context/foundation/prd-v3.md` say what
  is quoted; the ~3-shift first-purchase pacing signal is in `## Secondary`.
- `scripts/telemetry-harness/child-model.ts` exports `ChildModel { pBaseline,
  dropAtCeiling }`, `rng` (mulberry32), `pFirstTry`, and a three-cohort `MISS_MODEL`.
- `public/illustrations/` exists, holds `slice-map.md` and **six** `world-*.webp`
  (W1's art is committed); the six upgrade SVGs are there too. **No decoration art** —
  consistent with E1's claim.
- Nothing decreases `wallet_balance` except `buyUpgrade` in
  `src/lib/services/child-profiles.ts`.

### Corrections and additions — the plan must not inherit the backlog's phrasing

1. **`shopRunningCost` does not exist in the repo.** A repo-wide grep finds it only in
   `context/**` and `docs/superpowers/specs/**`. The backlog's `cost =
   shopRunningCost(investment ⊆ purchased)` is a **symbol to be written**, not one to be
   called. Same for `shopEffects`, `quantityMargin`, `accuracyMargin`, `requiredUpgrade`
   and `Decoration` — none exist yet.
2. **`ShiftScreen` receives the server's authoritative `earned` and throws it away.**
   `src/pages/api/shifts/complete.ts` returns `{ ok, earned, businessLevel, leveledUp }`,
   but `ShiftScreen`'s completion `useEffect` types the response as
   `{ leveledUp: boolean; businessLevel: number }` and displays its **own**
   client-computed `earningsForShift(taskCount, cleanCount)`, also using it for
   `canUpgrade` and `nextInfo.wallet`. Today the two agree by construction. **Under the
   profit rule they stop agreeing** — the client would show *revenue* while the wallet
   receives *profit* — unless the island either applies cost too or (better) starts
   reading `data.earned`. The backlog's "the island needs no new prop" is true and
   irrelevant; the island needs a **changed read**. Treat this as the highest-value
   correction in this file.
3. **`ShopArt`'s corner-row fallback is art-based, not icon-based.** `ShopArt` takes
   `{ world, purchased }`, derives from `UPGRADES.filter(...)`, and renders both the
   slotted layer and the unplaced corner row as `<img src={u.art}>`. An art-less
   `Decoration` cannot flow through it unchanged. "Decorations need no new UI system" is
   right about the *composition model* and wrong if read as "no code change": ShopArt
   needs a decorations source list, a lucide branch for entries with no `art`, and a new
   prop threaded from **both** call sites. Note also `Upgrade.art` is **required**
   (`art: string`), so `Decoration` sharing the `Upgrade` shape is not an option.
4. **The FR-013 "next thing" surface exists in three places, and each renders an
   `<img src={…art}>`:** `src/pages/app/start.astro` and `src/pages/app/growth.astro`
   (both computing `nextUpgrade(...)` independently) and `ShiftResults` via
   `ShiftScreen`'s `nextInfo`. D-11's premise is that decorations restore the next-thing
   card once the catalogue empties — so **whatever makes a decoration nameable by FR-013
   must also make it renderable in three surfaces that assume an art path today.** The
   backlog does not say this; it is a direct consequence of its own D-11 argument.
5. **The server can compute cost without a new parameter.** `recordShiftResult` reads the
   profile with `.select("*")`, so `current.shop_state` is already in hand at the point
   `earningsForShift` is called. No signature change is needed on the authority path.
6. **`shift_log.earned` is best-effort.** `appendShiftLog`'s header records that the
   insert is swallowed, so `sum(earned)` is already documented as approximate. The
   backlog's "starts recording profit, no backfill needed" holds, but the parent-report
   copy in `src/lib/services/reports.ts` already forbids reconciling it against
   `wallet_balance` — that guidance gets *more* load-bearing, not less, once the two
   quantities genuinely diverge.

### Mockups — absent, and no layout is being proposed here

`assets/` is gitignored and therefore absent from CI, fresh clones, and the worktrees
this run builds. **No mockup set was opened for this feature, and none exists for a
decoration.** E1's UI surface is small (a second list on the shop surface plus whatever
`ShopArt` composites), and any layout a later step proposes must be marked an **explicit
extrapolation** from `ShopArt`'s existing slot/corner-row language, never presented as
mockup-derived.

---

## Autonomous decisions

**1. Next step is `/10x-research world-economy-profit-rule`, not `/10x-plan`.**
*Chosen:* research. *Rejected:* `/10x-plan` (the skill's default) and `/10x-frame`.
*Why:* the corrections above are exactly the class of thing a plan written straight from
the backlog would get wrong — three of six touch symbols that do not exist yet, and one
(the discarded server `earned`) changes where profit must be computed. `/10x-frame` is
for suspect framing; the framing here was settled across D-1…D-13 by the maintainer and
is not open. *What would change the answer:* if a research step's findings would be
confined to re-reading `src/data/upgrades.ts` and `src/data/shift.ts` — both already read
in full here — plan directly and fold this file's corrections in as the research input.

**2. `change.md` carries a verification ledger, beyond the skill's minimal shape.**
*Chosen:* keep the frontmatter exactly as `/10x-new` specifies and put the corrections in
`## Notes`. *Rejected:* the bare intent-only Notes body the skill describes; a separate
`verification.md` (nothing downstream reads a filename no skill names). *Why:* the run
brief requires inherited claims to be corrected **in `change.md`** before they can reach a
plan, and `change.md` is the one file every later step opens. *What would change the
answer:* a research step that absorbs this ledger into `research.md` — after which this
section should be trimmed to a pointer rather than maintained twice.

**3. The two genuinely-open decisions are deferred to the plan, deliberately.**
Decoration count per world and W1's vocabulary question are named as open in the agent
contract. They are **not** decided here: `/10x-new` writes identity, and a count picked
before the pacing model (D-13) exists would be an invented number of exactly the kind the
contract forbids. *What would change the answer:* if the plan step also declines them,
the implementer must decide and record — they cannot be left open past implementation.

**4. No suite was run in this step.** This is a docs-lane step that wrote one file under
`context/changes/world-economy-profit-rule/` and touched no source. The contract's
baseline (548 vitest / 26 Playwright, lint and check clean at `91754ef`) is recorded as
**inherited and unobserved**; the first step that touches code re-measures it on its own
branch (L-005).
