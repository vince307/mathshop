---
project: MathShop
version: 1
status: draft
created: 2026-07-01
updated: 2026-07-07
prd_version: 3
main_goal: market-feedback
top_blocker: capacity
---

# Roadmap: MathShop (MathMarket re-baseline)

> Derived from `context/foundation/prd-v3.md` (v3, MathMarket brownfield re-baseline) + verified codebase baseline.
> Supersedes the v1-wedge roadmap archived at `context/foundation/archive/2026-07-01-roadmap.md`.
> Edit-in-place; archive when superseded. Slices are listed in dependency order; the "At a glance" table is the index.

## Vision recap

MathShop teaches math to Polish children (6–9) by framing every operation as running a small shop — math is never a bare equation. The shipped thin slice (S-01…S-04) proved a child will finish a shift, but it delivered the thinnest cut of the pedagogy: shop growth was passive and decorative. This re-baseline makes growth an **earned decision** — the child spends what they earn on upgrades they *choose*, and each choice is itself a math/decision moment — synchronized with what they've actually learned. Delivery is **tranched** with no fixed date; the economy loop ships first, then breadth (worlds, grade-3, pricing, audio, theme).

## North star

**S-06: Child chooses an upgrade that visibly + functionally grows the shop** — the smallest end-to-end slice that proves the core hypothesis: that *deciding how to grow the business with earned funds* is what makes the math feel purposeful (US-01 + prd-v3 Primary criterion).

> "North star" here means the smallest end-to-end slice whose successful delivery would prove the product's core hypothesis — placed as early as its prerequisites allow, because everything else only matters if this one works. S-06 needs the wallet (S-05) first, so S-05 is the immediate move; S-06 is the milestone it unlocks.

## At a glance

| ID   | Change ID                    | Outcome (user can …)                                                                 | Prerequisites | PRD refs                              | Status   |
| ---- | ---------------------------- | ------------------------------------------------------------------------------------ | ------------- | ------------------------------------- | -------- |
| F-01 | per-account-isolation-contract | (foundation) RLS isolation contract + first migration + isolation verification pattern | —             | §Access Control, FR-001–006 preserved | done     |
| S-01 | parent-signup-first-profile-and-start-screen | Parent signs up in Polish, creates first child profile, child reaches start screen | F-01          | FR-001, FR-002, FR-006                | done     |
| S-02 | counting-task-in-business-context | Child completes a counting task in shop narrative with soft retry                | S-01          | FR-003                                | done     |
| S-03 | change-making-task-in-business-context | Child completes a change-making task in shop narrative with soft retry       | S-01          | FR-003                                | done     |
| S-04 | full-shift-with-results      | Child completes a full shift, sees results (coins + stars), state persists            | S-02, S-03    | FR-004, FR-005                        | done     |
| S-05 | spendable-funds-wallet       | Child earns spendable funds and sees a wallet that carries across shifts              | S-04          | FR-007, FR-008                        | done     |
| S-06 | upgrade-choice-and-growth    | Child chooses an affordable upgrade; the shop changes visibly + functionally          | S-05          | US-01, FR-010, FR-011, FR-012, FR-013, FR-014 | done |
| S-07 | skill-path-upgrade-gate      | Child's upgrades gate on skill progress; growth stays synced to learning              | S-06          | FR-015, FR-010                        | done |
| S-08 | upper-band-task-difficulty   | Older child (up to 9) gets appropriately harder counting / change-making tasks        | S-04          | FR-009                                | done     |
| S-09 | minimal-parent-weekly-report | Parent reads a minimal weekly report of their own child's practice + unlocks          | S-06, S-07    | FR-016                                | done     |
| S-10 | cross-device-economy-restore | Parent logs in on a new device and sees the same funds, upgrades, and grown shop      | S-06          | FR-001, FR-005, FR-012                | proposed |
| S-11 | multi-profile-picker         | Parent adds a 2nd child profile; a scoped profile-picker appears on next launch        | S-01          | FR-002                                | done     |
| S-12 | network-loss-handling        | A network drop mid-shift halts gracefully with a Polish in-world message               | S-04          | FR-017                                | done     |
| S-13 | child-ui-polish              | Built child surfaces (incl. the new economy screens) brought to mockup fidelity        | S-06          | US-01, §Non-Functional Requirements   | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering lives in the dependency graph below; this table is the proposed reading order across parallel tracks. Because the #1 blocker is **capacity**, the parallel tracks (B, C, D) matter: their `ready` heads (S-08, S-11, S-12) can be picked up alongside the economy chain.

| Stream | Theme                    | Chain                                                          | Note                                                                                       |
| ------ | ------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| A      | Economy loop (the bet)   | `F-01` → `S-01` → (`S-02` ∥ `S-03`) → `S-04` → `S-05` → `S-06`★ → `S-07` → `S-09` | The must-do path to the north star (★). Sequenced first under `main_goal: market-feedback`. |
| B      | Task difficulty          | `S-08`                                                        | Parallel from `S-04`; independent of the economy state — a `ready` capacity lever.          |
| C      | Account lifecycle & sync | `S-11` · `S-10`                                               | `S-11` parallel from `S-01` (ready now); `S-10` joins after `S-06` (restores economy state).|
| D      | Resilience & polish      | `S-12` · `S-13`                                               | `S-12` parallel from `S-04` (ready now); `S-13` sequenced last — polishes settled surfaces. |

## Baseline

What's in place as of `2026-07-01` (verified). Foundations/slices below assume these and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 SSR + React 19 islands; child surfaces in `src/components/child/*` (task, shift, results, start); i18n in `src/i18n/pl.ts`.
- **Backend / API:** present — auth routes + `src/pages/api/profiles/create.ts` + `src/pages/api/shifts/complete.ts` (server-authoritative shift scoring).
- **Data:** present — 3 migrations (`child_profiles` isolation → identity → gameplay_state incl. reserved `shop_state`); `src/lib/services/child-profiles.ts`; domain in `src/data/{shift,leveling,worlds,...}.ts`.
- **Auth:** present — `src/lib/supabase.ts` (@supabase/ssr) + `src/middleware.ts` + per-account RLS policies.
- **Deploy / infra:** present — `.github/workflows/ci.yml`; Vercel `fra1`.
- **Observability:** absent — no logger/Sentry/OTel. Parked for now.

## Foundations

### F-01: Per-account data isolation contract

- **Outcome:** (foundation) RLS policy template established; first migration shipped `child_profiles` with per-operation per-role RLS in the same file; a reusable isolation verification test asserts one parent's profiles are never readable by another. The contract every later migration follows.
- **Change ID:** per-account-isolation-contract
- **PRD refs:** §Access Control Changes, FR-001–006 (preserved), Constraints & Compatibility (isolation inviolable)
- **Unlocks:** every DB-touching slice; the isolation negative-test path re-exercised by S-06 (new economy state) and S-09/S-10 (parent read + cross-device)
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** RLS is the project's named highest-risk invariant — wrong policies are a silent data leak. Establishing the pattern as a discrete foundation makes it visible to every later migration author. Each new economy table (S-05…S-09) ships its RLS in-migration under this contract (L-001) rather than a big shared migration.
- **Status:** done

## Slices

### S-01: Parent signs up in Polish and creates the first child profile

- **Outcome:** A first-time parent signs up (email + verification) in Polish, picks a pre-set avatar in the create-first-profile flow, and the child lands on the start screen.
- **Change ID:** parent-signup-first-profile-and-start-screen
- **PRD refs:** FR-001, FR-002, FR-006
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Established the Polish-as-content pattern and the first write under the RLS contract. Archived (S-01a auth + S-01b profile/start).
- **Status:** done

### S-02: Child completes a counting task in business context

- **Outcome:** The child taps the stand and completes a single counting task in shop narrative with soft retry + scaffolding hint.
- **Change ID:** counting-task-in-business-context
- **PRD refs:** FR-003
- **Prerequisites:** S-01
- **Parallel with:** S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** First exercise of the business-narrative task wrapper; established the task spec → render → answer → feedback contract S-03/S-04 reuse.
- **Status:** done

### S-03: Child completes a change-making task in business context

- **Outcome:** The child completes a single change-making task in shop narrative with the same soft-retry / hint pattern.
- **Change ID:** change-making-task-in-business-context
- **PRD refs:** FR-003
- **Prerequisites:** S-01
- **Parallel with:** S-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Generalized the task contract to a second operation type (shared `useCoinTask`/`CoinBoard`/`TaskScreen` + polymorphic `/app/task`).
- **Status:** done

### S-04: Child completes a full shift end-to-end with results

- **Outcome:** The child completes a 5–10 task shift (adaptive length) mixing counting + change-making, sees a results screen (total coins + 0–3 stars), and profile state persists across sessions.
- **Change ID:** full-shift-with-results
- **PRD refs:** FR-004, FR-005
- **Prerequisites:** S-02, S-03
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** The prior north star (the earlier thin-slice proof). Extended the schema (`business_level`, reserved `shop_state`) under the RLS contract; established the server-authoritative `recordShiftResult` compute-and-persist pattern the economy slices extend.
- **Status:** done

### S-05: Child earns spendable funds and sees a wallet

- **Outcome:** At shift end the child earns **spendable funds** (the shipped accumulating "coins" reinterpreted as a wallet); the balance carries across shifts, is shown on the start + results surfaces, and is framed as a wallet (never decreasing except by a future purchase). Server computes the payout; a client cannot inflate it.
- **Change ID:** spendable-funds-wallet
- **PRD refs:** FR-007, FR-008 (advances US-01)
- **Prerequisites:** S-04
- **Parallel with:** S-08, S-11, S-12
- **Blockers:** —
- **Unknowns:**
  - Non-destructive migration of existing profiles' coins → wallet with a rollback path — Owner: planning. Block: no.
  - Exact funds formula (accuracy × length) vs. the shipped coin formula — Owner: planning. Block: no.
- **Risk:** The precursor to the whole economy. Small and self-contained, but it re-keys the shipped coin field; the migration must not drop existing progress. Sequenced first in Stream A because S-06 can't offer a purchase without a spendable balance. Extends `recordShiftResult` rather than adding a parallel write path.
- **Status:** done

### S-06: Child chooses an upgrade that visibly + functionally grows the shop  **(NORTH STAR)**

- **Outcome:** On the results/upgrade surface the child sees the upgrades they can afford (from a small catalog gated on funds + world level) alongside locked ones, and **chooses one to buy** — a framed in-world decision ("masz 126 zł: półka za 80 czy więcej klientów za 120?"). Buying debits funds and applies **both** a visible change (new shelf/sign/decoration) and a functional unlock (new product / task type / capacity), persists the new world state, and shows what the child is saving toward next. Spending never lowers level or skill progress.
- **Change ID:** upgrade-choice-and-growth  *(supersedes the paused `visible-shop-growth`; its `research.md` render/persist findings remain reusable)*
- **PRD refs:** US-01, FR-010 (cost + world-level gates), FR-011, FR-012, FR-013, FR-014
- **Prerequisites:** S-05
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Catalog size + which upgrades ship for the single world (doc 08 suggests 5–8) — Owner: user (art/product). Block: no.
  - The v3 progression art + "upgrades / product-unlocked" mockups are local-only / gitignored — Owner: maintainer supplies. Block: no (degrade to a described target).
  - "Spend feels like loss" mitigation (wallet + owned-upgrades framing) is unproven with kids — Owner: user (kid-testing). Block: no.
- **Risk:** The bet. Biggest single slice in the tranche (catalog + choose-UI + apply-effects + growth art + persistence). Under `main_goal: market-feedback` it is sequenced as early as its one prerequisite allows, to surface the core hypothesis' risk first. Skill-gating is deliberately deferred to S-07 so the loop can ship and be validated with cost+level gates only.
- **Status:** done

### S-07: Upgrades gate on skill progress; growth stays synced to learning

- **Outcome:** The system tracks per-competency **skill progress** derived from task attempts, surfaces it simply, and uses it (plus completed task history) as an additional upgrade requirement — so some upgrades unlock only once the child has demonstrably practiced the relevant skill. World growth is now synchronized with learning, not just funds.
- **Change ID:** skill-path-upgrade-gate
- **PRD refs:** FR-015, FR-010 (skill + task-history gates)
- **Prerequisites:** S-06
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Competency taxonomy + progress function (doc 08 suggests math / money / decisions) — Owner: planning. Block: no.
- **Risk:** Deepens the loop into doc 08's "growth reinforces learning" goal. Sequenced after the loop ships (S-06) so the bet is validated before adding the learning-synchronization layer. Becomes load-bearing because FR-010 references its signal — it cannot be faked.
- **Status:** done

### S-08: Older child gets appropriately harder tasks (6–9 band)

- **Outcome:** Procedurally-generated task numbers widen to the 6–9 band — larger numbers and occasional multi-step change-making for the upper cohort — within the no-bare-equation rule.
- **Change ID:** upper-band-task-difficulty
- **PRD refs:** FR-009
- **Prerequisites:** S-04
- **Parallel with:** S-05, S-11, S-12
- **Blockers:** —
- **Unknowns:**
  - Number-range curve per age/level for the added cohort — Owner: user (kid-testing). Block: no.
- **Risk:** Touches task generation, not economy state, so it parallelizes cleanly with the economy chain — a useful capacity lever. Low risk; extends existing generators.
- **Status:** done

### S-09: Parent reads a minimal weekly report

- **Outcome:** A parent reads a minimal, read-only weekly report for **their own** child profile(s): what was practiced, which upgrade was unlocked, and the skills it exercised — phrased educationally, never shaming or comparative.
- **Change ID:** minimal-parent-weekly-report
- **PRD refs:** FR-016
- **Prerequisites:** S-06, S-07
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - The "parent-weekly-report" mockup is local-only / gitignored — Owner: maintainer supplies. Block: no.
- **Risk:** The one genuinely new *read* access path — the natural place to re-exercise the isolation negative test (parent reads only their own child). Depends on S-06/S-07 for something meaningful to report. Kept minimal to bound cost.
- **Status:** done

### S-10: Cross-device login restores the economy state

- **Outcome:** A parent who grew a shop under profile A on one device signs in on another and sees the same funds, purchased upgrades, grown shop, and skill progress — exactly as left. A second account on the same device never sees account A's data.
- **Change ID:** cross-device-economy-restore
- **PRD refs:** FR-001, FR-005, FR-012
- **Prerequisites:** S-06
- **Parallel with:** S-09
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Exercises the RLS isolation contract under real cross-account, multi-device load *with the new economy state included*. The negative test (account B can't see account A) is the highest-impact correctness gate; sequenced once there is real economy state to restore.
- **Status:** proposed

### S-11: Multi-profile picker for accounts with 2+ children

- **Outcome:** A parent adds a second child profile (one-tap, pick another avatar); on next launch a profile-picker scoped to that account appears. Single-profile accounts still skip the picker.
- **Change ID:** multi-profile-picker
- **PRD refs:** FR-002
- **Prerequisites:** S-01
- **Parallel with:** S-05, S-08, S-12
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Stretches the isolation contract to multi-row-per-account. Independent of the economy loop — a `ready` capacity lever that can run alongside Stream A.
- **Status:** done

### S-12: Network-loss mid-shift halts gracefully

- **Outcome:** If the browser loses connectivity mid-shift, the app shows a Polish in-world message ("Internet zniknął! Spróbuj za chwilę.") and halts; pending mid-shift progress is discarded; on reconnect the child returns to the last server-recorded state.
- **Change ID:** network-loss-handling
- **PRD refs:** FR-017 (graceful mid-shift network-loss halt), §Non-Goals (no offline)
- **Prerequisites:** S-04
- **Parallel with:** S-05, S-08, S-11
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Narrow resilience slice (detect, halt, in-world message, no queue). A change folder already exists (`context/changes/network-loss-handling/`). Independent of the economy — parallelizable. Traces to FR-017 (carried from prd-v2 FR-016, re-added to prd-v3 as a preserved requirement).
- **Status:** done

### S-13: Child UI/UX polish to mockup fidelity (incl. economy surfaces)

- **Outcome:** The built child surfaces — start, task, results, and the new economy screens (wallet, choose-upgrade, grown shop) — are brought to canonical MatmaVerse / v3-progression mockup fidelity, plus a reusable child-primitive library that absorbs the ad-hoc primitives (`ChildButton`, `SelectTile`, coin visuals). Pure visual/UX — no behavior or copy change.
- **Change ID:** child-ui-polish
- **PRD refs:** US-01 (polishes the surfaces its flow runs through), §Non-Functional Requirements (smooth animation, oversized tap targets), §User & Persona (early-reader reliance on icons/animation)
- **Prerequisites:** S-06
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Fidelity bar (pixel- vs spirit-faithful) and which screens are in scope — Owner: user. Block: no.
  - The MatmaVerse + v3 mockups are local-only / gitignored — Owner: maintainer supplies. Block: no.
- **Risk:** Sequenced last deliberately — polishing before the economy surfaces settle means re-polishing. The child-primitive library must fold in, not fork, the shipped ad-hoc primitives. Pure-visual scope keeps behavioral risk low but touches many files.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                    | Suggested issue title                                                  | Ready for `/10x-plan` | Notes                                              |
| ---------- | ---------------------------- | --------------------------------------------------------------------- | --------------------- | -------------------------------------------------- |
| F-01       | per-account-isolation-contract | RLS isolation contract + first migration + isolation test           | no                    | Done / archived                                    |
| S-01       | parent-signup-first-profile-and-start-screen | Polish parent sign-up + first child profile + start screen | no                    | Done / archived                                    |
| S-02       | counting-task-in-business-context | Counting task in shop narrative                                   | no                    | Done / archived                                    |
| S-03       | change-making-task-in-business-context | Change-making task in shop narrative                         | no                    | Done / archived                                    |
| S-04       | full-shift-with-results      | Full shift + results + persistence                                     | no                    | Done / archived                                    |
| S-05       | spendable-funds-wallet       | Earn spendable funds + wallet (coins → wallet migration)               | yes                   | Run `/10x-plan spendable-funds-wallet` — unlocks S-06 |
| S-06       | upgrade-choice-and-growth    | Choose-upgrade → visible + functional shop growth (north star)         | no                    | Unblocks when S-05 done; absorbs paused visible-shop-growth |
| S-07       | skill-path-upgrade-gate      | Skill-progress tracking + skill-gated upgrades                         | no                    | Unblocks when S-06 done                            |
| S-08       | upper-band-task-difficulty   | Harder tasks for the 6–9 upper band                                    | yes                   | Parallel; run `/10x-plan upper-band-task-difficulty` |
| S-09       | minimal-parent-weekly-report | Minimal read-only parent weekly report                                 | no                    | Unblocks when S-06 + S-07 done; isolation read test |
| S-10       | cross-device-economy-restore | Cross-device login restores funds/upgrades/shop                        | no                    | Unblocks when S-06 done; load-bearing isolation gate |
| S-11       | multi-profile-picker         | Add 2nd profile + scoped profile-picker                                | yes                   | Parallel; run `/10x-plan multi-profile-picker`     |
| S-12       | network-loss-handling        | Graceful mid-shift network-loss halt                                   | yes                   | Parallel; change folder already exists             |
| S-13       | child-ui-polish              | Child UI polish to mockup fidelity + primitive library                 | no                    | Unblocks when S-06 done; sequence last             |

## Open Roadmap Questions

1. **New-surface art + mockups are local-only.** The v3 progression assets and the 5 "missing screens" mockups (world-progression, upgrades, mission-result, product-unlocked, parent-weekly-report) are the design source of truth but are gitignored / not in the repo. Owner: maintainer. Block: no — but any CI/cloud-agent session on S-06/S-09/S-13 needs them supplied (degrade to a described target otherwise).
2. **Lead-tranche split if S-06 is too big to plan.** Keeping cost+level+skill+task-history gates makes S-06 + S-07 heavy. If `/10x-plan spendable-funds-wallet`→`upgrade-choice-and-growth` reveals S-06 is too large, split it: (a) catalog + choose-UI + visible growth, then (b) functional unlock. Owner: planning. Block: no.
3. **Tranche ordering for the deferred set.** The Parked future tranches (multi-world, grade-3, pricing/inventory, audio, 2nd theme, richer report) need their own FRs (re-shape / PRD) before they can be sliced. Order + dependencies TBD when the economy tranche lands. Owner: user. Block: no.
4. **"Spend feels like loss" mitigation is unvalidated.** The wallet + owned-upgrades framing is the chosen mitigation; validate with real children and iterate. Owner: user (kid-testing). Block: no.

## Parked

### True non-goals (per prd-v3 §Non-Goals)
- **No monetization — ever** (ads / IAP / paywall / premium). Identity, not a deferred feature.
- **No casino mechanics** (lootboxes, random unlocks, timers, streaks, rankings, child comparison).
- **No real trading / market / speculation** for this age band.
- **No full parent dashboard** — only the minimal weekly report (S-09) ships; goal-setting / difficulty controls / settings out.
- **No anonymous play.** **No offline / PWA shell** (network required; S-12 halts gracefully).
- **No production observability (Sentry/OTel) yet** — Vercel logs suffice; v-later candidate.

### Future tranches (in the product's scope; deferred — need their own FRs before slicing)
- **Multi-world selection (pillar 2)** — world-selection surface + the other 5 interest-worlds. The largest post-economy tranche; re-shape → PRD FRs → roadmap slices when ready.
- **Grade-3 content** — multiplication / division / fractions / measurement; widens persona toward 6–10.
- **Pricing/inventory task types** — set-price→demand, manage-stock.
- **Audio cues** — correct-answer / shift-end / upgrade-purchase sound.
- **Second visual theme** — a second skin for the world (per-profile theme field already exists).
- **Richer parent report** — trends + recommendations beyond the minimal S-09 view.

## Done

- **F-01: Per-account data isolation contract** — Archived 2026-06-11 → `context/archive/2026-06-09-per-account-isolation-contract/`. Lesson: L-001 / L-002 (lessons.md).
- **S-01: Parent signs up in Polish and creates the first child profile** — Split S-01a (archived 2026-06-27) + S-01b (archived 2026-06-28 → `context/archive/2026-06-28-first-child-profile-and-start-screen/`). Lesson: L-003.
- **S-02: Child completes a counting task in business context** — Archived 2026-06-29 → `context/archive/2026-06-29-counting-task-in-business-context/`.
- **S-03: Child completes a change-making task in business context** — Archived 2026-06-29 → `context/archive/2026-06-29-change-making-task-in-business-context/`.
- **S-04: Child completes a full shift end-to-end with results** — Archived 2026-06-30 → `context/archive/2026-06-29-full-shift-with-results/`.
- **S-05: Child earns spendable funds and sees a wallet that carries across shifts** — Archived 2026-07-01 → `context/archive/2026-07-01-spendable-funds-wallet/`. Lesson: —.
- **S-06: Child chooses an upgrade that visibly + functionally grows the shop** — Archived 2026-07-01 → `context/archive/2026-07-01-upgrade-choice-and-growth/`. Lesson: —.
- **S-07: Upgrades gate on skill progress; growth stays synced to learning** — Archived 2026-07-02 → `context/archive/2026-07-01-skill-path-upgrade-gate/`. Lesson: —.
- **S-08: Older child (up to 9) gets appropriately harder counting / change-making tasks** — Archived 2026-07-06 → `context/archive/2026-07-02-upper-band-task-difficulty/`. Lesson: —.
- **S-09: Parent reads a minimal weekly report of their own child's practice + unlocks** — Archived 2026-07-06 → `context/archive/2026-07-06-minimal-parent-weekly-report/`. Lesson: —.
- **S-11: Parent adds a 2nd child profile; a scoped profile-picker appears on next launch** — Archived 2026-07-06 → `context/archive/2026-07-06-multi-profile-picker/`. Lesson: —.
- **S-12: If the browser loses connectivity mid-shift, the app shows a Polish in-world message ("Internet zniknął! Spróbuj za chwilę.") and halts; pending mid-shift progress is discarded; on reconnect the child returns to the last server-recorded state.** — Archived 2026-07-07 → `context/archive/2026-06-14-network-loss-handling/`. Lesson: —.
