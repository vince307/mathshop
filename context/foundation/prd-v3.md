---
project: "MathShop"
version: 3
status: draft
created: 2026-07-01
context_type: brownfield
product_type: web-app
target_scale:
  users: large
  qps: low
  data_volume: medium
timeline_budget:
  delivery_weeks: null   # no fixed date — tranched delivery, economy-first lead tranche (see Open Questions #1)
  hard_deadline: null    # prior 2026-08-31 hard date dropped 2026-07-01
  after_hours_only: true
---

# MathShop — Product Requirements Document (v3, MathMarket re-baseline)

> Brownfield re-baseline of the shipped MathShop wedge (S-01..S-04) toward the fuller
> "MathMarket / Math Economy" vision. Supersedes `prd-v2.md`. Derived from
> `context/foundation/shape-notes.md` (2026-07-01 re-baseline shape).

## Current System Overview

**System purpose (one sentence):** MathShop is a Polish-language web app that teaches math to young children by framing every operation as running a small shop, so the math is always a purposeful business moment rather than a bare equation.

**Key architecture:** Server-rendered web application (Astro in full SSR mode) with interactive React islands for the child-facing gameplay; SSR routes run as serverless functions.

**Tech stack:** Astro 6 · React 19 · Tailwind 4 · shadcn/ui · Supabase (Postgres + auth + row-level security for per-account isolation) · deployed on Vercel (EU region `fra1`). All persisted state is keyed on (parent account, child profile) and protected by per-operation, per-role row-level-security policies.

**Current user base:** Polish children aged 6–8 (primary-school grades 1–2) as the players, and their parents as account holders. Early-stage product targeting a large audience at low query volume and medium data volume.

**Core functionality today (shipped S-01..S-04):**
- Parent email-backed account with sign-up, email verification, and login; cross-device access.
- Child profiles whose identity is a pre-set avatar (no typed name), each fully isolated within its owning account.
- Two math task types rendered inside shop narrative — counting (coins in the till) and change-making (give correct change) — with soft, non-punishing retry and a scaffolding hint after 1–2 misses.
- A full shift loop: 5–10 procedurally-generated tasks whose length adapts to level, a results screen showing total coins and 0–3 stars (accuracy-based), a single shift-end coin payout, and per-profile persistence that restores state across sessions and devices.
- An internally-tracked business level and a start-screen coin/level display.
- One world (the lemonade stand) and one visual theme.

## Problem Statement & Motivation

The shipped wedge proved the core hypothesis — entrepreneurship-framed practice makes a child finish a shift and want to come back — but it ships the **thinnest** cut of the pedagogy. Shop growth today is **passive and decorative**: when a level threshold is crossed, the shop changes on its own. The child earns an abstract number and never *decides* anything with what they earned; there is a single world, no tracking of which skills a child is actually building, and no way for a parent to see the learning behind the play.

The change is motivated now by a fuller product vision (the MathMarket design corpus) developed alongside the build, which the maintainer has chosen to re-baseline toward. That vision closes the gap on two co-equal pillars: making shop growth an **earned decision** (the child spends what they earn on upgrades they choose, and each choice is itself a math/decision moment), and offering **breadth of interest-worlds** so every child finds a context they care about. The cost of not changing is that the product keeps proving "a shift loop works" without ever proving its actual bet — that owning and growing a business is what makes the math feel purposeful.

## User & Persona

**Primary persona — the child (ages 6–9, Polish primary school).** A young, possibly early-reading child who reaches for the app on a family tablet or laptop and expects a game, not a lesson. Short attention span (a shift is a handful of task moments); needs a tangible, *owned* sense of progress. This re-baseline **widens** the served band from the shipped 6–8 to **6–9** — the extra cohort is reached through harder change-making and the new budgeting decisions rather than a new task type (full grade-3 formal content is a later tranche). Their experience changes most: after each shift they now decide how their shop grows.

**Secondary persona — the parent (account holder + occasional reviewer).** Creates the account and logs in to enable each session. New in this re-baseline: the parent gains a **minimal weekly report** that explains, in plain language, what the child practiced and which skill each unlocked upgrade exercised. Low-frequency reassurance and gentle steering — never a shaming or child-comparison surface. Existing parents keep their accounts and profiles unchanged.

## Success Criteria

### Primary

- The **earned-decision growth loop** works end-to-end in the child's world: the child completes a shift (counting + change-making, plus simple budgeting for the upper age band), earns **spendable funds** and stars, and on the results/upgrade surface is shown the upgrades they can now afford. The child **chooses one** — a framed in-world math/decision moment ("masz 126 zł: półka za 80 czy więcej klientów za 120?"). The chosen upgrade changes the shop **visibly** (new shelf/sign/decoration) **and functionally** (unlocks a new product, task type, or capacity), the choice persists, and the surface shows what the child is now saving toward. A parent can read a minimal weekly report tying each unlocked upgrade to the skills it exercised — for their own child only.

### Secondary

- **Loop-engagement signal:** a typical child chooses and buys at least one upgrade of their own within their first ~3 shifts — evidence the earn→choose→grow loop actually engages, not merely that shifts complete.
- **Calibration signal (carried):** a typical child in the 6–9 band can earn 3 stars (a perfect shift) at least once within their first 5 shifts.

### Guardrails

*(carried from the shipped product — still binding)*
- Mistakes never feel punishing: soft, encouraging retry with a scaffolding hint — no harsh failure signal and no loss of accumulated funds.
- No personal data tied to children: only the parent's email is personal data; all economy/world/skill state is non-identifying. No ads, no purchases, no purchase prompts, no dark patterns; funds are in-world only.
- 100% Polish, authored as swappable content so a future locale needs no source changes.
- **Per-account isolation preserved:** no account can ever read another account's child data — across every new kind of state this change introduces.
- **No regression of the shipped wedge:** existing auth, profile creation/picker, both task types, and the full shift + results + persistence continue to work unchanged for existing accounts.

*(new — specific to the economy)*
- **No casino mechanics:** no lootboxes, no random or chance-based unlocks, no timers, no streak pressure, no urgency/scarcity messaging, no rankings, no child-vs-child comparison. Upgrades have clear, predictable requirements.
- **Spending never regresses competence:** a child may spend funds, but spending never reduces their level, world level, or recorded skill progress — only the spendable balance moves, and only by the child's choice.
- **Growth must reinforce the math:** every upgrade is tied to a concrete skill or task history; a mechanic that doesn't strengthen "the math had a point" is simplified or deferred.

## User Stories

### US-01: Child earns funds and chooses how the shop grows

- **Given** a child playing their world has completed a shift and earned funds, so their balance now exceeds the cost of at least one available upgrade
- **When** they reach the results/upgrade surface and are shown the affordable upgrades alongside the locked ones
- **Then** they choose one upgrade in a framed in-world decision moment, their balance is debited, the shop changes visibly *and* unlocks a new product/task/capacity, the new state persists, and the surface shows what they're now saving toward next — all without ever reducing their level or skill progress.

**What was different before:** in the shipped product the shop grew *automatically* when a level threshold was crossed; the child made no choice and spent nothing. This story replaces that passive growth with a deliberate, earned decision.

#### Acceptance Criteria
- The upgrade choice is presented as a business decision in Polish, never as a bare store checkout.
- Affordable upgrades are selectable; locked ones show the single concrete missing requirement (funds / world level / skill / task history) — no random or chance-based unlocks.
- Buying an upgrade debits funds and applies **both** a visible change and a functional unlock; on return the grown shop and purchase persist for that profile.
- Spending funds never lowers the child's level, world level, or skill progress.
- A parent later reading the weekly report sees the unlocked upgrade tied to the skills it exercised — for their own child only.

## Scope of Change

Each item categorized as `[new]`, `[modified]`, `[preserved]`, or `[removed]`. FR ids are retained for downstream traceability. This is the **lead tranche** (economy-first, single world); deferred tranches are in Non-Goals.

**Earning & spending funds**
- `[modified]` (FR-007) The shift-end reward becomes a single **spendable** currency ("funds"); the shipped accumulating "coins" score is reinterpreted as this wallet. Stars remain a separate per-shift quality signal.
- `[new]` (FR-008) Funds accumulate across shifts and are never reduced except by a deliberate upgrade purchase; the balance is shown as a **wallet**, framed so that spending reads as acquiring a permanent upgrade, not losing coins.
- `[modified]` (FR-009) Procedurally-generated task numbers cover the widened 6–9 band (larger / occasional multi-step change-making); the **budgeting choose-upgrade decision** is the primary new math surface for the upper cohort.

**Upgrades & visible world growth**
- `[new]` (FR-010) The world defines a small **upgrade catalog** (5–8 upgrades), each with clear, predictable requirements: cost + world level + skill progress + completed task history. No random unlocks.
- `[new]` (FR-011) On the results/upgrade surface the child sees the upgrades they can afford and **chooses one to buy**, framed as an in-world math/decision moment; locked upgrades show what's still needed.
- `[new]` (FR-012) Buying an upgrade deducts its cost and applies a **visible** change plus a **functional** unlock (new product, task type, or capacity), and persists the new state; spending never reduces level or skill progress.
- `[new]` (FR-013) The start/results surface shows the **next** meaningful upgrade and the concrete amount still needed — factual, non-manipulative encouragement only.
- `[modified]` (FR-014) Visible shop growth (the paused S-05 outcome) is delivered as the **visual half** of a purchased upgrade, driven by chosen upgrades rather than a passive level threshold.
- `[removed]` Passive, automatic shop growth on crossing a level threshold — superseded by upgrade-driven growth.

**Skill path**
- `[new]` (FR-015) The system tracks per-competency **skill progress** derived from task attempts and surfaces it simply; it is **load-bearing** because upgrade requirements reference it, keeping world growth synchronized with learning.

**Parent insight**
- `[new]` (FR-016) A parent can read a **minimal weekly report** for their own child profile(s) — what was practiced, which upgrade was unlocked, and the skills it exercised — phrased educationally, read-only.

**Preserved (must keep working)**
- `[preserved]` (FR-001) Parent email account: sign-up, login, cross-device access to the same profiles.
- `[preserved]` (FR-002) Avatar-as-identity profile creation; profile-picker for accounts with 2+ profiles, skipped for single-profile accounts.
- `[preserved]` (FR-003) Counting and change-making tasks in shop narrative with soft retry + scaffolding hint.
- `[preserved]` (FR-004) A shift of 5–10 adaptive-length tasks with per-answer acknowledgment and a shift-end celebration.
- `[preserved]` (FR-005) Results screen with 0–3 stars; per-profile persistence across sessions/devices.
- `[preserved]` (FR-006) 100% Polish, authored as swappable content.
- `[preserved]` (FR-017) A mid-shift loss of connectivity halts the shift gracefully with a Polish in-world message; pending mid-shift progress is discarded and, on reconnect, the child resumes from the last state the system recorded. (Carried from prd-v2 FR-016; no offline queueing.)

## Constraints & Compatibility

- **Backward compatibility:** existing parent accounts, child profiles, and the shipped play surfaces (auth, profile creation/picker, both task types, the full shift + results) must continue to work unchanged. No existing user-facing behavior of the wedge regresses.
- **Data migration:** existing profile state (accumulated coins, business level, and the reserved shop state) must carry over **without loss** — accumulated coins become the new spendable wallet, and every existing profile receives a sane default world state (no upgrades purchased, base appearance). A rollback path must exist so a failed migration cannot corrupt or drop existing progress.
- **Preserved integrations / contracts:** the existing task → render → answer → feedback flow, the shift loop, the results screen, and the results-persistence path are **extended, not rewritten**; new economy state is written through the existing per-profile save path wherever possible rather than new parallel paths.
- **Preserved behavior — per-account isolation (inviolable):** every new kind of state (skill progress, upgrade catalog and purchases, world state) remains isolated to its owning account under the same isolation contract. The new parent weekly-report read path must be scoped so a parent can only ever read their own children's data; this is the natural place to re-exercise the cross-account isolation negative check.
- **Trust boundary (preserved):** funds, purchases, world-state changes, stars, and skill progress are determined by the system from trusted play data — never accepted as-is from the client — so a manipulated app cannot inflate a balance, grant an upgrade, or bypass a requirement.

## Business Logic Changes

This re-baseline **extends** the shipped domain rule; both rules hold together.

**Current rule (preserved):** *Every math task is rendered as a purposeful business activity inside a story-driven game, never as a bare equation — so the child practices math while running their shop.*

**Added rule (new — the re-baseline):** *Progress is an earned economy that the child steers, and growth is gated on learning.* Completing math tasks earns spendable funds; the child chooses upgrades from a catalog whose requirements — funds, world level, skill progress, and completed task history — are clear and predictable; buying an upgrade grows the world both visibly and functionally; because upgrade requirements include skill progress and task history, world growth stays synchronized with what the child has actually learned. Spending funds never regresses the child's level or competence.

**Conceptual model reconciliation (delta):** the shipped accumulating score becomes a single spendable wallet; the shipped business level is retained as the world level that gates upgrades; stars are unchanged as a per-shift quality signal; the previously-reserved shop state now records purchased upgrades, active appearance, product slots, and unlocked task types; and skill progress per competency is newly derived from task attempts. No new currency is introduced beyond renaming/repurposing the existing one.

## Access Control Changes

**No change to the authentication mechanism or role model — current model preserved.** Two roles remain: the **parent** account holder (signs up, logs in, opens the session that gates all play, cross-device) and the **child profile** (one of several inside an account, no separate login, no anonymous play).

**Additions, all under the existing per-account isolation contract (no new roles):**
- New per-profile state introduced by the economy, worlds, and skills is account-isolated exactly like existing profile state.
- The **parent weekly report** is a new *read* surface: a parent reads aggregated progress for **their own** child profiles only, and never for any other account. This is the one genuinely new access path; it re-exercises the cross-account isolation guarantee.
- Only the parent's email remains personal data; all new child state is non-identifying.

## Non-Goals

### True non-goals — not on the re-baseline roadmap
- **No monetization mechanic — ever.** No ads, purchases, paywall, or premium tier. Identity, not a deferred feature.
- **No casino mechanics.** No lootboxes, random/chance unlocks, timers, streak pressure, FOMO, rankings, or child comparison.
- **No real trading / market / stock / speculation.** For this age band the "market" idea stays a locked, far-future concept — never actual trading.
- **No full parent dashboard.** Only the minimal read-only weekly report ships; goal-setting, difficulty controls, time limits, and settings UI are out.
- **No anonymous play.** A parent signs up before any child profile exists.
- **No offline capability.** Network is required; a mid-shift drop halts gracefully.

### Deferred to later tranches — in the product's scope, NOT the lead tranche
*(Recorded so they don't leak into the first build. Final ordering + dependencies are the roadmap's job.)*
- **Multi-world selection (pillar 2)** — a world-selection surface plus the other 5 interest-worlds. The lead tranche ships the single existing world only.
- **Grade-3 formal content** — multiplication, division, fractions, measurement; widens the persona toward 6–10.
- **Pricing/inventory task types** — set-price→demand and manage-stock missions. The lead tranche's only new math is the budgeting choose-upgrade decision.
- **Audio cues** — sound on correct answers, shift end, and upgrade purchase.
- **Second visual theme** — a second skin for the world.
- **Richer parent report** — trends and recommendations beyond the minimal weekly view.

## Open Questions

1. **Delivery timeline is intentionally open (no fixed date).** The prior hard deadline (2026-08-31) was dropped 2026-07-01 in favor of tranched, after-hours delivery with the economy-first single-world tranche shipping first, then the deferred tranches in a roadmap-set order. `delivery_weeks` is therefore null. Owner: user / roadmap. Block: no.
2. **Lead-tranche build-cost risk (scope creep during shaping).** Keeping all four upgrade-requirement types makes the skill path load-bearing, and the parent weekly report was promoted to must-have — raising the lead tranche's cost above the leanest cut. If it is too large to plan cleanly, the natural split is (a) the economy loop (wallet + catalog + choose-upgrade + visible/functional growth), then (b) skill-path-as-gate + parent report. Owner: planning. Block: no.
3. **Tranche ordering + dependencies.** The rough order (multi-world · grade-3 · pricing/inventory · audio · theme · richer report) needs to be pinned with dependencies. Owner: user / roadmap. Block: no.
4. **Skill-progress taxonomy + progress function.** The exact set of competencies and how progress is computed from task attempts is a planning detail; the lead tranche needs only the subset the upgrade gates reference. Owner: planning. Block: no.
5. **Upgrade-choice framing mitigation is unproven with children.** The "wallet + owned-upgrades as the permanent win" framing is the chosen mitigation for the risk that a 6-year-old reads a dropping balance as losing progress; it should be validated with real children and iterated. Owner: user (kid-testing). Block: no.
6. **New-surface art + mockups are local-only.** The v3 progression assets and the 5 "missing screens" mockups (world-progression, upgrades, mission-result, product-unlocked, parent-weekly-report) are the design source of truth but are gitignored / not in the repo; any CI or cloud-agent session needs the maintainer to supply the specific assets. Owner: maintainer. Block: no (degrade to a described target).
