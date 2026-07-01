---
project: "MathShop"
context_type: brownfield
created: 2026-07-01
updated: 2026-07-01
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "core re-baseline bet"
      decision: "Co-equal pillars — the upgrade economy (earn virtualBalance → choose an upgrade = a math/decision moment → world changes) AND multi-world breadth (every child finds an interest-context they care about) are both load-bearing, not one-supports-the-other."
    - topic: "persona age band"
      decision: "Widen v1 from 6–8 (grades 1–2) to 6–9, matching the MathMarket docs. Brings richer set-price / manage-stock / profit math for the 9-year-old cohort into scope."
    - topic: "change category"
      decision: "Brownfield re-baseline = multiple significant new modules layered on a shipped wedge (auth + profiles + task loop + shift results already live)."
  frs_drafted: 16
  quality_check_status: accepted
product_type: web-app
target_scale:
  users: large
  qps: low
  data_volume: medium
timeline_budget:
  delivery_weeks: null   # no fixed date — tranched delivery, economy-first as the lead tranche (Phase 3/6)
  hard_deadline: null    # hard 2026-08-31 date DROPPED 2026-07-01 in favor of incremental tranches
  after_hours_only: true
---

# MathShop (MathMarket re-baseline) — Shape Notes

> Brownfield re-baseline (2026-07-01). Supersedes the v1 wedge shape archived at
> `context/foundation/archive/shape-notes-2026-07-01-0129.md`. Source vision:
> `assets/app-docs-v2-llm-handoff/` + `assets/atomic-assets-v3-progression/` +
> `assets/math-economy-missing-screens-v3-*/` (local-only / gitignored).

## Current System

What exists today (shipped + archived through S-04):

- **Product:** MathShop — a Polish-language web app teaching math to children by framing every operation as running a small shop. Astro 6 SSR (`output: "server"`) + React 19 islands + Tailwind 4 + shadcn/ui, Supabase (Postgres + auth + row-level security), deployed on Vercel (region `fra1`).
- **Shipped capabilities (S-01..S-04):**
  - Parent email-backed auth (sign-up / sign-in / sign-out) with email verification; Polish-localized.
  - RLS-isolated child profiles — avatar *is* the identity (no text name input); per-account data isolation enforced by per-operation per-role policies (F-01 contract; CLAUDE.md's named highest-risk invariant).
  - Two task types in shop narrative: **counting** (tap coins in the till) and **change-making** (give correct change), with soft retry + scaffolding hint after 1–2 misses.
  - **Full shift loop:** 5–10 procedurally-generated tasks (length adapts to level), results screen with total coins + 0–3 stars (accuracy-based), single shift-end coin payout, per-profile persistence across same-browser sessions.
  - `business_level = 1 + floor(completedShiftCount / 3)`; start-screen coin/level HUD; `shop_state jsonb` column reserved (unused).
  - ONE world: the lemonade stand. One visual theme.
- **Users today:** Polish children 6–8 (grades 1–2) as the player; parent as account/setup holder with no daily surface.
- **Must preserve (guardrails this re-baseline cannot break):**
  - Per-account RLS isolation — one parent's child profiles never visible to another (FR-012/FR-015). Highest-risk correctness invariant; getting it wrong is a silent data leak.
  - The shipped auth / profile / task-rendering / shift-loop / results / persistence code and its contracts.
  - "Math is never shown as a bare equation" — binding product rule.
  - Soft, non-punishing feedback — no red flash, buzzer, "game over", or coin loss on wrong answers.
  - 100% Polish localization, authored as content (swappable locale, no source edits).
  - No monetization mechanic — ever (no ads, IAP, paywall, premium). Identity, not a deferred feature.

## Vision & Problem Statement

**The delta (why re-baseline):** The shipped v1 proved the wedge — entrepreneurship-framed practice makes a child finish a shift — but it ships the *thinnest* cut of the core pedagogy. Shop growth today is **passive and decorative**: cross a level threshold and the shop changes automatically. Math earns an abstract integer; the child never *decides* anything with what they earned.

The MathMarket vision closes that gap on **two co-equal pillars**:

1. **Shop growth becomes an earned decision, not decoration.** The child earns `virtualBalance` from shifts, then **chooses** an upgrade from a catalog (each with clear, predictable requirements — cost, world level, skill progress, completed mission types). The choice is *itself a math/decision moment* ("masz 126 zł: półka za 80 czy więcej klientów za 120?"), and the world changes visually + functionally because the child decided. This is doc 08's *najważniejsza decyzja produktowa*: math has a point because earnings buy things the child chose, and each upgrade unlocks new missions/products — synchronizing world progress with the skill path.
2. **Breadth of interest-worlds.** The child picks a world by *interest, not gender* — cafe, bakery, space base, collector shop, creative studio, invention lab. Every world teaches the same competencies through different narration, illustration, and examples, so every child finds a context they care about.

Supporting the two pillars: skill-path tracking (math / money / decisions / inventory / profit), simple pricing→demand→profit and product-unlock mechanics, and a **parent weekly report** that reframes world progress as *evidence of learning, not just play*.

The hard product rule is unchanged and strengthened: math never appears decontextualized, and progression must always reinforce *why* the math mattered — if a future UI or mechanic doesn't strengthen that connection, it is simplified or deferred (doc 08's closing rule).

**Working name:** the design corpus uses "MathMarket / Math Economy" as a *robocza nazwa* (working name, may change). The product keeps **MathShop** as its name for now; the logic is deliberately not over-coupled to the shop motif, since the product spans many interest-worlds.

## User & Persona

### Primary persona: the child (ages 6–9, Polish primary school grades 1–3)

A child in early primary school in Poland, possibly an early reader, so the product leans on icons, animation, and minimal text. They reach for the app on a tablet or family laptop, handed over by a parent. They expect a game, not a "lesson." Short attention span (a shift of ~5–10 task moments at a time); they need a tangible, *owned* sense of progress — coins they spend, upgrades they chose, a shop that grows because of their decisions — to come back without nagging.

**v1 age band (widened in re-baseline):** v1 now targets **6–9 (grades 1–3-ish math within reach)** rather than the shipped 6–8. The extra cohort brings set-price, manage-stock, and simple-profit reasoning into scope alongside counting + change-making. Full grade-3 formal content (multiplication, division, fractions, measurement) remains a later expansion — see `## Non-Goals`.

### Secondary persona: the parent (account-holder + occasional reviewer)

Creates the account, logs in to enable each session, and — newly in this re-baseline — can read a **weekly report** that explains, in plain language, what the child practiced and what each unlocked upgrade taught (e.g., "Ania odblokowała małą półkę; powiązane umiejętności: dodawanie, reszta, pieniądze"). Not a daily operator of the game; the report is a low-frequency reassurance + steering surface, never a child-shaming or comparison surface. The pedagogy (entrepreneurship framing, mistakes-as-learning) remains the parent-facing argument that gets the app installed.

## Access Control

**No change to the auth mechanism or role model — current model preserved.** The shipped two-role structure stays:

- `parent` — the account-holder. Signs up with email (verification on), logs in, and the session gates all play. Cross-device: logging in from any browser/device restores the same profiles + progress.
- `child profile` — one of several profiles inside an account, no separate login. The child plays within a session the parent opened. No anonymous play.

Each child profile remains fully isolated within the account (own avatar, theme, coins, level, and now: virtualBalance, world selection, skill progress, unlocked upgrades, world state), keyed on `(parent account, child profile)` and enforced by the F-01 RLS contract.

**Re-baseline additions, all riding the *same* RLS contract (no new roles):**

- New per-profile state introduced by the economy/worlds/skills (`virtualBalance`, `world_state`, `skill_progress`, `mission_attempt`, `unlocked_upgrades`) is account-isolated exactly like existing profile state — every new table/column ships its per-operation per-role RLS policy *in the same migration* (CLAUDE.md rule; L-001).
- The **parent weekly report** is a new *read* surface: a parent reads aggregated progress for **their own** child profiles only. It must be a read path scoped by the same isolation contract — a parent can never read another account's child data. This is the one genuinely new access path the re-baseline adds, and it is the natural place to re-exercise the isolation negative test.
- Only the parent's email remains PII. All new child-profile state (balance, upgrades, skill %, world) is non-identifying.

## Success Criteria

> **v1 cut (decided Phase 3):** *Economy-first, single world, holding the 2026-08-31 deadline.* v1 proves **pillar 1** (earned-decision shop growth) end-to-end in the existing single world. **Pillar 2** (multi-world selection across the 6 interest-worlds) stays co-equal in the product vision but is sequenced into the **next tranche**, because it can't be proven without new per-world content that doesn't fit the remaining ~8 after-hours weeks. This mirrors doc 08's own MVP recommendation (1 active world, 3 stages, 5–8 upgrades, upgrade-choice screen, parent report).

### Primary

- The **earned-decision growth loop** works end-to-end in the child's world: the child completes a shift (mixed counting + change-making, plus simple set-price for the upper age band) and earns **spendable funds** (the former "coins", now `virtualBalance`) + stars. On the results/upgrade surface the child sees the upgrades they can now afford and **chooses one** — a framed in-world math/decision moment ("masz 126 zł: półka za 80 czy więcej klientów za 120?"). The chosen upgrade changes the world **visibly** (new shelf/sign/decoration) **and functionally** (unlocks a new product / mission type / capacity), and the choice + new world state persist per profile. The child can see what they're saving toward next ("brakuje 18 zł do małej półki"). A parent can read a **minimal weekly report** tying each unlocked upgrade to the skills it exercised. All of this under the preserved per-account RLS isolation.

### Secondary

- **Engagement-of-the-loop signal:** a typical child spends earned funds on at least one upgrade of their choosing within their first ~3 shifts — evidence the earn→choose→grow loop actually engages, not just that shifts complete.
- **Calibration signal (carried from v1):** a typical 6–9-year-old can earn 3 stars (a perfect shift) at least once within their first 5 shifts — difficulty curve is right for the persona.

### Guardrails

*(carried from the shipped product — still binding)*

- Mistakes never feel punishing — no red flash, buzzer, "game over", or loss of accumulated funds. Wrong answers get soft, encouraging retry + scaffolding hint.
- No PII tied to children — only the parent's email is PII; all economy/world/skill state is non-identifying. Encrypted in transit. No ads, no IAP, no purchase prompts, no dark patterns. Funds are in-world only.
- 100% Polish, authored as swappable content (no source edits to add a locale).
- Per-account RLS isolation preserved across every new table/column.

*(new — specific to the economy, from MathMarket docs 02/06/08)*

- **No casino mechanics.** No lootboxes, no random/percentage-chance unlocks, no timers, no streak pressure, no FOMO ("Tylko dziś!"), no rankings, no child-vs-child comparison. Upgrades have **clear, predictable requirements** (cost + world level + skill progress + completed mission types).
- **Spending never regresses competence.** A child may spend funds on upgrades, but spending must never reduce the child's level, world level, or recorded skill progress (doc 08 rule).
- **Growth must reinforce the math.** Every upgrade is tied to a concrete skill/mission; if a mechanic doesn't strengthen "the math had a point", it is simplified or deferred (doc 08's closing rule).

### Timeline & delivery model

Decided 2026-07-01: the hard **2026-08-31 deadline is dropped** in favor of **tranched, no-fixed-date delivery** (after-hours). Reason: the re-baselined product the maintainer wants (economy + grade-3 + audio + second theme + eventually multi-world) is materially larger than any single deadline-boxed release, and forcing it into ~8 weeks would risk a half-migrated app (the brownfield trap). Instead:

- **Lead tranche = economy-first, single world** (the Success Criteria above) — proves the core bet (pillar 1) end-to-end and is shippable on its own.
- Subsequent tranches, each shippable independently, in rough priority order (final ordering set in the roadmap): **multi-world** (pillar 2) · **grade-3 content** (widens persona to 6–10) · **pricing/inventory task types** (set-price, manage-stock) · **audio cues** · **second visual theme** · **richer parent report**.

Acknowledgment: dropping the forcing function trades schedule certainty for scope integrity; the maintainer accepts delivering incrementally with no committed date. Each tranche must leave `main` shippable.

## Functional Requirements

> `Change:` tags — `preserved` = shipped capability that must keep working unchanged (defensive); `modified` = shipped capability whose behavior changes; `new` = capability that doesn't exist yet. Preserved FRs retain their Socrates resolutions from the archived v1 shape and are not re-challenged here.

### Preserved (shipped wedge — must keep working)

- FR-001: Parent can sign up with email, log in, and access the same account + profiles from any device. Priority: must-have. Change: preserved
- FR-002: User can create a child profile by picking a pre-set avatar (avatar = identity, no text-name step); accounts with 2+ profiles get a profile-picker on launch, single-profile accounts skip it. Priority: must-have. Change: preserved
- FR-003: Child can complete counting and change-making tasks rendered in shop narrative (never as a bare equation), with soft retry and a scaffolding hint after 1–2 misses. Priority: must-have. Change: preserved
- FR-004: Child completes a shift of 5–10 procedurally-generated tasks whose length adapts to level, with a per-correct-answer acknowledgment and a larger shift-end celebration. Priority: must-have. Change: preserved
- FR-005: Child receives a results screen with 0–3 stars based on accuracy; per-profile state persists and restores across sessions/devices. Priority: must-have. Change: preserved
- FR-006: All user-visible text is Polish, authored as content so a future locale is added without source-code changes. Priority: must-have. Change: preserved

### Economy: earning & spending funds

- FR-007: Child earns **spendable funds** (`virtualBalance`) at shift end, reflecting accuracy + shift length. The shipped "coins" score becomes this single spendable currency — there are not two currencies. Stars remain a separate per-shift quality signal. Priority: must-have. Change: modified
  > Socrates: Counter considered — "making the score spendable could feel like *losing* progress to a 6yo, colliding with the no-punishment guardrail." Resolution: keep one currency, but **mitigate by framing** — the funds balance is a *wallet*; the permanent, monotonic win the child sees is the **owned upgrades + grown shop**, never a shrinking number. Buying is gaining a thing, not losing coins. (Tied to FR-008, FR-012.)
- FR-008: Child's funds accumulate across shifts and are never reduced by a wrong answer or by anything except a deliberate upgrade purchase; the running balance is visible on the start/results surfaces, framed as a wallet (spending = acquiring a permanent upgrade, never a penalty). Priority: must-have. Change: new
  > Socrates: see FR-007 — the wallet framing + permanent owned-upgrades view is the mitigation for "spend feels like loss." Progress the child perceives (shop size, owned upgrades, level, skills) is always monotonic; only the spendable wallet moves down, and only by the child's own choice.
- FR-009: Procedurally-generated task numbers cover the 6–9 band — larger numbers / occasional multi-step change-making for the upper cohort, within the no-bare-equation rule. The **choose-upgrade budgeting decision** (FR-011) is the primary *new* math surface for the upper cohort. Priority: must-have. Change: modified
  > Socrates: Counter considered — "widening to 6–9 without a set-price task underserves the 9yo and makes the economy thin." Resolution: for v1, harder/multi-step change-making **plus** the budgeting decision in choose-upgrade (do I have enough? which is better value?) is sufficient new math. Dedicated **set-price→demand** and **manage-stock** task types are deferred to the pricing/inventory tranche (logged in Non-Goals / Open Questions).

### Upgrades & visible world growth

- FR-010: The world defines a small **upgrade catalog** (5–8 upgrades) — e.g. sign, shelf, better register, extra product slot, more customers — each with clear, predictable requirements: cost in funds + required world level + required skill progress + required completed mission types. No random/chance unlocks. Priority: must-have. Change: new
  > Socrates: Counter considered — "4 requirement types is too complex for a 6yo and too much to build in 8 weeks; gate on cost + level only." Resolution: **keep all 4 requirement types** — the skill-progress + mission-type gates are exactly what synchronizes world growth with *learning* (doc 08's central point); a cost-only catalog would regress to a shop game detached from math. Accepted cost: higher build + the skill-path (FR-015) becomes load-bearing, not optional. UI still shows the child only the *missing* requirement in plain language, not the full predicate.
- FR-011: On the results/upgrade surface, the child sees which upgrades they can now **afford and unlock**, and **chooses one to buy** — framed as an in-world math/decision moment ("masz X zł: A za 80 czy B za 120?"), not a store checkout. Locked upgrades show what's still needed. Priority: must-have. Change: new
  > Socrates: Counter considered — "a full upgrade-store screen is a big new surface." Resolution: stands — this *is* the v1 bet (pillar 1). The decision moment is the new-math payoff; it cannot be cut without cutting the re-baseline's reason to exist.
- FR-012: Buying an upgrade deducts its cost, applies its effects — a **visible** world-layer change (new shelf/sign/decoration) AND a **functional** unlock (new product, new mission type, or added capacity) — and persists the new world state per profile. Spending never reduces the child's level, world level, or skill progress. Priority: must-have. Change: new
  > Socrates: Counter considered — "visible + functional in one FR is two features." Resolution: stands — the visible change without a functional unlock is the old passive decoration we're explicitly replacing; both halves together are what make growth *mean* something. (Absorbs the paused S-05.)
- FR-013: The start/results surface shows the **next** meaningful upgrade and how much more the child needs ("brakuje 18 zł do małej półki"), as concrete, non-manipulative encouragement (no timers, no FOMO). Priority: must-have. Change: new
  > Socrates: Counter considered — "a 'you need 18 more' nudge edges toward manipulative pressure." Resolution: stands but bounded by the guardrail — concrete progress info only (factual gap to the next upgrade), never urgency/scarcity language; doc 08's allowed-message list governs the copy.
- FR-014: Visible shop growth (the paused S-05 outcome) is delivered as the *visual half* of FR-012 — driven by purchased upgrades / world state, not by a passive level threshold. Priority: must-have. Change: modified
  > Socrates: Counter considered — "S-05 already has research done for passive growth; reusing it is cheaper." Resolution: the S-05 *render-path / RLS / persistence* research stays valid and reusable, but its passive-level-threshold trigger is superseded by upgrade-driven growth. Cheaper-but-passive would ship the weak version of the mechanic we're re-baselining away from.

### Skill path (lite)

- FR-015: The system tracks per-competency **skill progress** (e.g. counting, money/change, decisions) from mission attempts, and surfaces the child's progress simply (icons / progress, age-appropriate). Used as an upgrade requirement input (FR-010) so world growth stays synchronized with learning. **Load-bearing in v1** (not optional) because FR-010 keeps the skill-progress requirement gate. Priority: must-have. Change: new
  > Socrates: Counter considered — "skill tracking is a whole subsystem; could be faked/deferred." Resolution: it can't be deferred once FR-010 gates upgrades on skill progress — the gate needs a real signal. Kept minimal: derive progress from existing mission-attempt data, surface lightly. This is the scope the 'keep all 4 requirement types' decision bought.

### Parent insight

- FR-016: Parent can read a **minimal weekly report** for their own child profile(s) — what was practiced, which upgrade was unlocked, and the skills it exercised — phrased educationally, never shaming or comparative. Read-only, scoped by the RLS isolation contract. Priority: must-have. Change: new
  > Socrates: Counter considered — "the report doesn't prove the child-side bet; cut it to protect the 8-week budget." Resolution: **promoted to must-have** — the parent-facing 'this is learning, not play' story is core to why a parent keeps the app, and it's the natural place to re-exercise the RLS isolation negative test (parent reads only their own child). Kept *minimal* (read-only, one screen) to bound the cost. Net v1 scope rises vs. the leanest cut — flagged as a budget risk in Open Questions.

## User Stories

### US-01: Child earns funds and chooses how the shop grows

- **Given** a child playing their world has completed a shift and earned funds (their balance now exceeds the cost of at least one available upgrade)
- **When** they reach the results/upgrade surface and are shown the affordable upgrades alongside the locked ones
- **Then** they choose one upgrade in a framed in-world decision moment, their balance is debited, the shop changes visibly *and* unlocks a new product/mission/capacity, the new world state persists, and the surface shows what they're now saving toward next — all without ever reducing their level or skill progress.

#### Acceptance criteria

- The upgrade choice is presented as a business decision in Polish ("masz 126 zł: półka za 80 czy więcej klientów za 120?"), never as a bare store/checkout.
- Affordable upgrades are selectable; locked ones show the concrete missing requirement (funds / world level / skill / mission type) — no random or chance-based unlocks.
- Buying debits funds and applies both a visible layer change and a functional unlock; on reload the purchased state and grown shop persist for that profile.
- Spending funds never lowers the child's level, world level, or skill progress.
- A parent reading the weekly report later sees the unlocked upgrade tied to the skills it exercised, for their own child only.

## Business Logic

This re-baseline **modifies and extends** the shipped domain rule. Both rules below hold together.

**Rule 1 (preserved):** Every math task is rendered as a purposeful business activity inside a story-driven game, never as a bare equation — so the child practices math while running their shop.

**Rule 2 (new — the re-baseline):** *Progress is an earned economy that the child steers, and growth is gated on learning.* Concretely: completing math missions earns **spendable funds**; the child **chooses** upgrades from a catalog whose requirements (funds + world level + skill progress + completed mission types) are clear and predictable; buying an upgrade grows the world **visibly and functionally** (new product / mission / capacity); because upgrade requirements include skill progress and mission history, **world growth stays synchronized with what the child has actually learned**. Spending funds never regresses the child's level or competence — only the spendable wallet moves down, and only by the child's choice.

The child encounters both rules continuously: every shift is in-world math (Rule 1), and every shift's payoff is *deciding how to grow the shop* with what was earned (Rule 2). There is no decontextualized math and no "points for points' sake" — the economy exists to make the math's purpose visible.

**Model reconciliation (shipped → re-baselined), to pin in planning:**
- shipped `coins` (accumulating score) → `virtualBalance` (spendable wallet). One currency.
- shipped `business_level = 1 + floor(shifts/3)` → retained as **worldLevel**, used as an upgrade requirement gate (`requiredWorldLevel`).
- shipped `stars` → unchanged (per-shift accuracy/quality signal).
- shipped `shop_state jsonb` (reserved, unused) → now carries **world state**: purchased upgrade ids, active visual layers, product slots, unlocked mission types.
- new: `skill_progress` (per competency, derived from mission attempts), an **upgrade catalog** definition, and the upgrade-purchase transaction.

**Authority rule (preserved invariant, L-002):** funds, purchases, world-state changes, stars, and skill progress are **server-authoritative** — computed and written server-side from trusted inputs, never accepted from the client. A tampered client cannot inflate its wallet, grant itself an upgrade, or skip a requirement. This mirrors how coins/stars are already computed server-side in `recordShiftResult`.

## Non-Functional Requirements

*(carried from the shipped product)*
- Animation feels continuous and smooth — no perceptible stutter or loading hitch during any interaction on a mid-range tablet released within the last 3 years. Extends to the new **upgrade-choice and world-growth** moments (the buy → shop-grows transition must feel rewarding, not janky).
- All interactive targets — avatars, task tiles, answer choices, on-screen coins, the start-shift button, and the new **upgrade tiles** — are large enough and spaced enough that a typical 6-year-old's tap reliably lands on the intended target; adjacent targets can't be hit by one tap.
- Cold-load from URL to the first interactive screen completes in ≤ 3 seconds on typical home broadband + a mid-range tablet.
- Child-facing requests during a shift (task submission, hint, results, **upgrade purchase**) round-trip with no perceptible wait; slower networks must not degrade the in-shift experience into unresponsive feedback.

*(new)*
- Loading the start/upgrade surfaces — which now read world state, the upgrade catalog, and skill progress — must not add a perceptible delay versus the shipped start screen (single profile read already loads the needed columns; avoid N+1).

## Constraints & Preserved Behavior

- **RLS contract is inviolable.** Every new table or column (`skill_progress`, upgrade catalog/purchase data, any `world_state` shape change) ships its per-operation per-role RLS policy **in the same migration** (CLAUDE.md rule; L-001). The parent weekly-report read path (FR-016) is scoped so a parent reads only their own children's data — the isolation negative test is re-exercised here.
- **Data migration must be non-destructive.** Existing `child_profiles` rows (coins, business_level, shop_state) must migrate cleanly: coins reinterpreted/renamed as the spendable wallet, `shop_state` populated to the new world-state shape with a sane default (no upgrades purchased, base layers). No existing profile loses progress.
- **Shipped contracts reused, not forked.** The task spec → render → answer → feedback contract, the shift loop, the results screen, and `recordShiftResult`'s server-authoritative compute-and-persist pattern are extended, not rewritten. The economy write rides the existing single profile UPDATE where possible (no extra round-trip), per the paused S-05 research.
- **API conventions preserved.** New endpoints `export const prerender = false`, validate input with zod, take nothing trust-bearing from the client (L-002), and reach rows by id under RLS (no client-supplied `account_id`).
- **No regression of the shipped wedge.** S-01..S-04 user-visible behavior (auth, profile creation/picker, both task types, the full shift + results + persistence) must continue to work unchanged for existing accounts.

## Product framing

- **Product type:** unchanged — web-app (Astro SSR + React islands on Supabase/Vercel). The re-baseline adds surfaces, not a new product form factor.
- **Scale:** unchanged — `large` user bucket, low QPS, medium data volume. Widening the persona from 6–8 to 6–9 (and later 6–10 with grade-3) does not move the scale bucket.
- **Delivery:** no fixed date; tranched (see Timeline & delivery model). After-hours only.

## Non-Goals

### True non-goals — not on the re-baseline roadmap

- **No monetization mechanic — ever.** No ads, IAP, paywall, premium tier. Identity, not a deferred feature.
- **No casino mechanics.** No lootboxes, random/chance unlocks, timers, streak pressure, FOMO, rankings, or child-vs-child comparison. (Also a Guardrail.)
- **No real trading / market / stock / crypto / speculation.** Doc 01/08 hard rule for this age band — even the "market" skill stays a locked, far-future module, never actual trading.
- **No full parent dashboard in the re-baseline.** Only the minimal read-only weekly report (FR-016) ships. Goal-setting, difficulty controls, time limits, and a settings UI are out. (A fuller parent panel is a *possible* far-future item but is not committed here.)
- **No anonymous play.** A parent must sign up before any child profile exists.
- **No offline / PWA shell.** Network required; a mid-shift drop halts gracefully (existing FR / S-08 intent). PWA + offline sync stay out.

### Deferred to later tranches — on the roadmap, NOT the lead tranche

*(These are explicitly IN the re-baselined product's scope but sequenced after the economy lead tranche — recorded here so they don't leak into the first build.)*

- **Multi-world selection (pillar 2)** — world-selection screen + the other 5 interest-worlds (bakery, space base, collector, studio, lab). The lead tranche ships the single existing world only.
- **Grade-3 formal content** — multiplication, division, fractions, measurement; widens the persona to 6–10. Own tranche (heaviest content item).
- **Pricing/inventory task types** — set-price→demand and manage-stock missions. Own tranche; the lead tranche's only new math is the budgeting choose-upgrade decision.
- **Audio cues** — correct-answer / shift-end / upgrade-purchase sound. Own tranche.
- **Second visual theme** — a second skin for the world (per-profile theme field already exists). Own tranche.
- **Richer parent report** — beyond the minimal FR-016 weekly view (trends, recommendations). Own tranche.

## Open Questions

1. **v1 budget risk (build-cost creep).** Even as the lead tranche, the economy scope grew during shaping: keeping **all 4 upgrade-requirement types** (FR-010) makes the **skill-path load-bearing** (FR-015), and the **parent weekly report was promoted to must-have** (FR-016). Watch this in `/10x-plan` — if the lead tranche is too big to plan cleanly, the natural split is (a) economy loop [wallet + catalog + choose-upgrade + visible/functional growth], then (b) skill-path-as-gate + parent report. Owner: user. Block: no.
2. **Tranche ordering.** The Timeline & delivery model lists a rough order (multi-world · grade-3 · pricing/inventory · audio · theme · richer report). Final ordering + dependencies are the roadmap's job (`/10x-roadmap`). Owner: user/roadmap. Block: no.
3. **Skill-path signal source.** FR-015 derives skill progress from mission attempts; the exact competency taxonomy + progress function is a planning detail. The MathMarket docs suggest math / money / decisions / inventory / profit — v1 needs only the subset the lead-tranche upgrade gates reference. Owner: planning. Block: no.

## Forward: tech-stack

Notes for downstream steps (NOT part of PRD) — the stack is already chosen and shipped (Astro 6 SSR · React 19 · Tailwind 4 · shadcn · Supabase Postgres+auth+RLS · Vercel fra1). No stack change. Relevant carry-forwards:

- The economy is **server-authoritative** on the existing Supabase pattern (`recordShiftResult` compute-and-persist); new upgrade-purchase logic extends the same single-UPDATE-under-RLS approach (paused S-05 research documents the exact render/persist path).
- New tables/columns (`skill_progress`, upgrade catalog/purchase, `world_state` shape) ship RLS policies in-migration; migrations are non-destructive over existing `child_profiles` rows.
- The v3 progression art (`assets/atomic-assets-v3-progression/` — 7 PNG illustrations + 22 SVG icons + 6 UI symbols) is the asset source for the economy surfaces; it is **local-only / gitignored**, so any CI/cloud-agent session needs the maintainer to supply the specific assets (per CLAUDE.md's assets caveat). Production PNGs must be committed under `public/` following the existing illustration pipeline.
- The 5 v3 "missing screens" mockups (world-progression, upgrades, mission-result, product-unlocked, parent-weekly-report) are the design source of truth for the new surfaces — same local-only caveat.

## Quality cross-check

Cross-check ran 2026-07-01 against the brownfield 7-check soft gate. All pass.

- **Access Control — present.** Preserved 2-role model (parent account + child profile, no separate child login); one new read path (parent weekly report) scoped by the same RLS isolation contract. No auth-mechanism change.
- **Business Logic — present.** Two coupled rules: Rule 1 (preserved) "every math task is a purposeful business activity, never a bare equation"; Rule 2 (new) "progress is an earned economy the child steers, with growth gated on learning." Not empty-CRUD.
- **Project artifacts — present.** Valid frontmatter; project MathShop; context_type brownfield; product_type/target_scale set; timeline dropped-date model recorded.
- **Timeline-cost acknowledgment — present.** Hard 2026-08-31 date dropped 2026-07-01 in favor of tranched no-date delivery; the scope-integrity-over-schedule tradeoff is explicitly accepted (Timeline & delivery model).
- **Non-Goals — present.** Split into true non-goals (no monetization ever, no casino mechanics, no real trading, no full parent dashboard, no anonymous play, no offline/PWA) and deferred-tranche backlog (multi-world, grade-3, pricing/inventory, audio, 2nd theme, richer report).
- **Preserved behavior — present.** Constraints & Preserved Behavior names the inviolable RLS contract, non-destructive data migration over existing profiles, reuse (not rewrite) of shipped task/shift/results contracts, API conventions, and no-regression of the S-01..S-04 wedge.

`checkpoint.quality_check_status: accepted`.
