---
project: "MathShop"
context_type: greenfield
created: 2026-05-21
updated: 2026-05-21
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "primary persona scope"
      decision: "The child (6–10) is the primary persona; parent is a setup helper, not a daily user."
    - topic: "pain category"
      decision: "Workflow friction (practice feels like a chore) + decision paralysis (parents can't tell which app teaches) + coordination overhead (parents nag kids to practice)."
    - topic: "insight / why-now"
      decision: "Entrepreneurship play teaches both math AND value-of-money / decision-making — dual pedagogical track (math fluency + early financial literacy) is the bet."
    - topic: "auth model"
      decision: "Local profile on-device, no auth, multi-profile. PWA-local storage. No accounts, no cloud sync, no email."
    - topic: "parent surface in MVP"
      decision: "None. MVP is pure child experience. A parent dashboard / progress peek is explicitly deferred to post-MVP."
    - topic: "sibling profiles"
      decision: "Multiple independent profiles on the same device. Profile-picker on launch. Each child has own avatar/theme/coins/level/badges. Optional light sibling leaderboard as motivator."
    - topic: "MVP scope discipline"
      decision: "Scoped down to a ~4-week after-hours slice. One theme (second deferred), two task types (counting + change-making — the most directly entrepreneurship-shaped), pre-set avatars instead of customizer, Polish text only (audio cues deferred). The vertical slice still proves the entrepreneurship-framed math premise end-to-end."
    - topic: "architecture pivot (post-shape, 2026-05-21)"
      decision: "Moved from PWA + on-device storage to web-app + cloud database. Parent creates an email-backed account that holds multiple child profiles; data persists in the database and is accessible from any device once the parent is logged in. Privacy guardrail rewritten: only parent email is PII; child-profile data remains non-PII (pre-set avatar names, coins, level — no real names). Offline operation and PWA shell are explicitly deferred to v2."
  frs_drafted: 15
  quality_check_status: accepted
product_type: web-app
target_scale:
  users: large
  qps: low
  data_volume: medium
timeline_budget:
  mvp_weeks: 4
  hard_deadline: 2026-08-31
  after_hours_only: true
---

# MathShop — Shape Notes

## Vision & Problem Statement

Most math apps drill arithmetic in a vacuum — "3 + 5 = ?" with no context. Children aged 6–10 disengage from practice because the math feels pointless: it never explains why a number matters. Parents look for an alternative and find a sea of generic quiz apps, can't tell which one actually teaches, and end up nagging the child to use whichever they picked. The math is technically "practiced" but not internalized.

The insight: when math is wrapped in a single coherent business narrative — the child runs their own little shop and every operation (counting, change-making, comparing prices, fractions of a cake) is a purposeful business task — children learn both math fluency AND early financial literacy (budgeting, decision-making, value-of-money). That dual-track payoff is what makes a parent pick this app over a generic quiz drill, and what makes a child want to come back without being nagged.

At 100x scale (large-bucket distribution, publicly accessible web app), the domain rule itself doesn't change — but the single-Polish-locale and the grades-1–2-only difficulty band become reach limits. The localization design (FR-013) is the hedge for the locale ceiling; grade-3 content (multiplication, division, fractions) is the most-requested v2 expansion at that scale.

## User & Persona

### Primary persona: the child (ages 6–10, Polish primary school grades 1–3)

A child in early primary school in Poland. May still be an early reader, so the product relies heavily on icons, audio cues, animation, and minimal text. They reach for the app on a tablet or family laptop, probably handed over by a parent. They expect a game; they don't yet expect or want a "lesson." Their attention span is short (8–12 task shifts at a time) and they need a tangible sense of progress (coins, stars, the shop visibly growing) to keep coming back.

**v1 scope on the persona age band.** The full product targets ages 6–10. v1 ships content calibrated to **grades 1–2 (ages 6–8)** — counting, addition/subtraction in change-making. Grade-3 content for the 9–10 cohort (multiplication, division, fractions, measurement) is the largest single v2 feature and is named explicitly in `## Non-Goals`. The persona section keeps the 6–10 framing to preserve the product's full intent; the FR set narrows to the v1 deliverable.

### Secondary persona: the parent (setup helper, not a daily user)

A parent of a 6–10-year-old who installs the app and may occasionally check what their child has been doing. Not a daily operator. Their bar is: "Does this actually teach math, or is it another gamification veneer over a quiz?" The MVP is not designed around parent supervision UX — but the choice of pedagogy (entrepreneurship framing, mistakes-as-learning) is the parent-facing argument that gets the app installed in the first place.

## Access Control

Parent-account-backed. A parent creates an account associated with their email. Each account holds one or more child profiles. The child plays under a chosen profile within the account; there is no separate child login.

- On first visit (no account on the device's browser session), the user is taken to a sign-up flow: parent enters their email and is authenticated. The exact verification mechanism (magic link vs password) is a stack-shaped decision routed to the tech-stack-selector step.
- After sign-up, the parent is taken to a "create first child profile" flow — pick a pre-set avatar (the avatar's built-in Polish name doubles as the profile name). Adding more profiles later (siblings) is a one-tap action in the account.
- On every subsequent visit, if the parent is already logged in on that browser, the app shows a profile-picker scoped to that account (one tap per profile to start playing). If not logged in, the parent re-authenticates and is taken to the same picker. Cross-device works: the parent logs in from a different browser or device and finds the same profiles and progress.
- Each child profile is fully isolated within the account: own avatar, own theme, own coins, own business level, own progress. Data lives in the cloud database, keyed on (parent account, profile).
- The parent's email is the only PII collected. Child profile data carries no real names (avatars are pre-set), no birthdates, no other identifying fields.
- No parent-facing dashboard / progress reports / time limits / settings UI in the MVP — see `## Non-Goals`. The parent's only surface is the sign-up / login / profile-picker flow; deep parental supervision is v2 work.

Role model: two roles — `parent` (the account-holder, who signs up and logs in) and `child profile` (one of several profiles inside an account, no separate login). Both roles touch the same authenticated session: child plays within a session the parent has opened. There is no anonymous play in v1.

## Success Criteria

### Primary

- The entrepreneurship-framed shift works end-to-end: parent signs up for an account, creates a child profile (pre-set avatar), the child reaches the start screen with the first business unlocked, completes a single shift (5–10 tasks, length adapts to level) that mixes counting and change-making in business context (count coins in the till, process a sale and give correct change), sees a results screen with coins, stars, and any visible shop growth — and on the next visit (same browser, parent still logged in OR parent re-logs-in from any device) finds the same profile and progress preserved.

### Secondary

- A typical 6–10-year-old can earn 3 stars (a perfect shift) at least once within their first 5 shifts — a signal that the difficulty curve is calibrated for the target persona, not too easy and not too punishing.

### Guardrails

- Mistakes never feel punishing. Wrong answers produce encouraging, soft feedback (visual + textual) — no red flash, no buzzer sound, no "game over" screen, no loss of accumulated coins. Violating this regresses the whole product premise even if the math works.
- No PII tied to children. The only personal data collected is the parent's email (for account access). Child profile data is pre-set avatar + coins + level + shop state — none of it identifying. No analytics tied to a child profile, no third-party data sharing, no advertising trackers. Data is encrypted in transit between browser and database. No ads, no in-app purchases, no purchase prompts, no dark patterns. Coins are in-world only. Streak design is forgiving — one missed day does not reset progress.
- 100% Polish localization. Every user-visible string — UI labels, task prompts, feedback messages, error states, even alt text and any debug strings the child could see — is in Polish. No English leaks anywhere user-visible.

### Timeline budget

- ~4 weeks of after-hours work to ship the scoped-down vertical slice (one theme, two task types, pre-set avatars, no audio). The second theme, the third task type (price comparison), the avatar customizer, and audio cues are explicit v2 work.

## Functional Requirements

### Profiles & onboarding

- FR-001: User can create a child profile by picking a pre-set avatar (one of ~6 named avatars, e.g., "Lis" the fox); the avatar's built-in Polish name doubles as the profile name. No text-input step. Priority: must-have
  > Socrates: Challenge — "Name field is too high a bar for pre-readers; the 3-step creation flow is friction before play." Resolution: dropped the text-input step; avatar selection IS the profile creation. Since v1 ships only one theme, no theme picker in the creation flow either (the data model still supports per-profile theme for v2).

- FR-002: User can pick an existing profile from a friendly profile-picker on launch when 2+ profiles exist. Single-profile devices launch straight into the start screen with no picker. Priority: must-have
  > Socrates: Challenge — "A one-option picker every launch is friction." Resolution: show picker only when ≥2 profiles exist.

### World & progression

- FR-003: User can start a shift from a simple in-world start screen showing the active business (the lemonade stand). The full visual world map is deferred to v2 (ships when 2+ locations exist). Priority: must-have
  > Socrates: Challenge — "World map is decorative with only one unlocked location; a Start Shift button is simpler and faster." Resolution: defer the map to v2; v1 ships a single-business start screen.

- FR-004: User can tap the active business to start a shift; the tap is wrapped in an in-world Polish narrative prompt (e.g., "Czas otworzyć sklep!"). Priority: must-have
  > Socrates: Challenge — "Bare tap-to-start is mechanical." Resolution: wrap the tap in an in-world prompt to keep the narrative active.

- ~~FR-005~~ — Deferred to v2 alongside the world map.
  > Socrates: Challenge — "Map is dropped in v1, so the locked-locations-on-map FR no longer applies." Resolution: dropped from v1 entirely; will be reintroduced in v2 with the map.

### Shift gameplay

- FR-006: User can complete a shift whose length adapts to their level. Lower-level (grade 1 equivalent) profiles play shorter shifts (~5–7 tasks); higher-level (grade 2 equivalent) profiles play longer shifts (~8–10 tasks). Each shift mixes counting and change-making tasks. Priority: must-have
  > Socrates: Challenge — "8–12 tasks may be too long for a 6-year-old's attention span." Resolution: shift length is adaptive — shorter for younger/lower-level, longer as the child progresses, all within the grades 1–2 band (see FR-007).

- FR-007: Task numbers are procedurally generated within the **grades 1–2 difficulty band (ages 6–8)** in v1. Grade 3 (ages 9–10) tasks — including the multiplication/division/fractions material from the seed — are deferred to v2. Priority: must-have
  > Socrates: Challenge — "Grades 1–3 is too wide a band for one MVP." Resolution: narrow v1 to grades 1–2. Implication: the v1 persona narrows to ages 6–8; the original 6–10 persona is the v2 target. Logged in Open Questions.

- FR-008: User receives a small acknowledgment per correct answer (subtle animation; audio cues deferred to v2) and a bigger celebration at shift end. Tiered feedback prevents per-answer fanfare fatigue. Priority: must-have
  > Socrates: Challenge — "Constant per-answer celebration loses signal." Resolution: tiered feedback — small per task, large at shift end.

- FR-009: User can retry a wrong answer within a task without losing earned coins. After 1–2 consecutive wrong attempts on the same task, a gentle scaffolding hint surfaces (e.g., briefly highlights the relevant on-screen artifact such as the coin pile to count); retry + hint, not retry + silence. Wrong-answer count affects star rating but never blocks progression. Priority: must-have
  > Socrates: Challenge — "Unlimited silent retry risks rote tapping; the child learns to guess, not to think." Resolution: scaffolding hint after 1–2 misses — teach the strategy, not just the answer.

### Scoring & persistence

- FR-010: User earns coins for completing a shift; coins are paid out **once at shift end** as a single in-world payout (not per correct answer). Coin amount reflects the shift's accuracy and length. Priority: must-have
  > Socrates: Challenge — "Per-answer coin reward feels transactional and fragments focus." Resolution: single shift-end coin payout keeps math attention central; reward signal is concentrated where it pedagogically fits (end-of-work payout).

- FR-011: User receives a results screen showing total coins earned, stars (0–3 based on accuracy), and — when a level threshold is crossed — a **visible shop change** (new shelf, new sign element, new decoration). The level number is tracked internally but the UI shows literal shop growth as the reward, not an abstract integer. Priority: must-have
  > Socrates: Challenge — "Business level as a number is abstract for a 6-year-old." Resolution: surface level progression as visible shop growth (new shelf, new sign) rather than an integer. Reinforces ownership-as-pedagogy: the shop visibly grows because the child worked.

- FR-012: User's profile, coins, completed-shift count, business level, and visible shop state persist in a cloud database keyed on (parent account, child profile), and are accessible from any device once the parent logs in. Priority: must-have
  > Socrates: Challenge (original, pre-pivot) — "localStorage is evicted more aggressively than IndexedDB; durability matters for multi-month child progress." Resolution after architecture pivot (2026-05-21): on-device storage was replaced by a cloud database tied to a parent account. Durability is now a database-operational concern; cross-device sync is now a feature, not a constraint.

### Localization

- FR-013: All user-visible text is in Polish in v1; adding additional locales in a future version must be possible through content changes alone, without requiring source-code modifications. Priority: must-have
  > Socrates: Challenge — "Hardcoding Polish creates a costly rewrite if v2 needs other markets." Resolution: build the localization design so it accepts new locales as content, not code — cheap insurance.

### Accounts & resilience (added post-pivot, 2026-05-21)

- FR-014: Parent can sign up for an account using their email and access it from any device by logging back in. The verification mechanism (magic link, password, or both) is a stack-shaped decision routed to tech-stack-selector. Priority: must-have

- FR-015: Once a parent is authenticated, they see a profile-picker scoped to their account containing all child profiles created under it. Cross-device login restores the same profile set and the same per-profile progress (coins, business level, visible shop state, completed-shift count). Priority: must-have

- FR-016: If the browser loses network connectivity mid-shift, the app halts the shift gracefully and shows a Polish in-world message (e.g., "Internet zniknął! Spróbuj za chwilę."). Pending shift state is lost; on reconnect, the child resumes from the last shift-end the database recorded. v1 does not attempt to queue or sync mid-shift work — offline resilience is deferred to v2. Priority: must-have

## Business Logic

Every math task is rendered as a purposeful business activity inside a story-driven game, never as a bare equation, so the child practices math while running their shop.

The inputs the rule consumes are user-facing artifacts of the shop: a pile of coins the customer hands over, a sale that needs a receipt, a price tag versus a sticker on a supplier's box, a recipe that needs a measured ingredient. Every input is a thing the child sees inside the world, not a numerical prompt floating on a blank screen.

The output is an in-world action that completes a small business moment: change is given, a customer leaves happy, a supplier is picked, an ingredient is measured. The math is the means; the in-world resolution is the end. Correctness gates the in-world resolution but never gates the child's continued play — wrong answers produce a gentle retry with a scaffolding hint (see FR-009), not a dead end.

The child encounters the rule continuously throughout each shift. There is no moment in the product flow where math appears decontextualized — even the first onboarding interaction is framed as opening the shop, not as "let's do some math." The narrative is the wrapper for every operation, not an intro skin that gets stripped away once the lessons begin.

## Non-Functional Requirements

- Animation feels continuous and smooth — no perceptible stutter, dropped frames, or visible loading hitches during any interaction on a mid-range tablet released within the last 3 years.
- All interactive targets — avatars, task tiles, answer choices, on-screen coins, the start-shift button — are large enough and spaced enough that a typical 6-year-old's tap reliably lands on the intended target. Adjacent tap targets cannot be hit by a single tap that lands between them.
- Cold-load from URL to the first interactive screen (profile-picker for an authenticated returning parent, or sign-up screen for a first-time visitor) completes in ≤ 3 seconds on a typical home broadband connection and a mid-range tablet released within the last 3 years.
- Child-facing requests during a shift (task submission, hint surfacing, results screen) round-trip with no perceptible wait on a typical home broadband connection. Slower networks should not degrade the in-shift experience into unresponsive feedback.

## Non-Goals

- **No parent-facing dashboard / progress reports / time limits / settings UI in v1.** The MVP is pure child experience. Parental supervision UX is real work and deferring it lets us focus on the pedagogy. (Adding it later is straightforward — read-only views over the existing local data.)
- **No monetization mechanic — ever. No ads, no in-app purchases, no paywall, no "premium tier."** This is identity, not a deferred feature. The product would compromise its own pedagogy by carrying any of these.
- **No grade-3 math content in v1 — no multiplication, no division, no fractions, no measurement.** v1 covers grades 1–2 (counting, addition, subtraction in change-making). Grade-3 content is the largest single v2 expansion (see Vision insight on reach at scale).
- **No gamification beyond coins + stars + visible shop growth in v1.** No daily streaks, no badges/achievements, no sibling leaderboard. Each of these is real UI + state-tracking work; v1 ships the core loop only, with these as v2 candidates.
- **No offline / PWA shell in v1.** The app is a browser-loaded web application; network is required. A network blip mid-shift halts the shift gracefully (see FR-016). PWA conversion + offline play sit in v2 backlog and are explicitly out of v1 scope.
- **No anonymous play in v1.** Parents must sign up before any child profile exists. "Try without signing up" surface is deferred — adding it later is straightforward, but launching with it broadens the privacy / abuse surface unnecessarily for an MVP.

## Open Questions

1. **Persona age narrowing.** Original vision: Polish kids 6–10 (grades 1–3). FR-007 narrowed the v1 difficulty band to grades 1–2 (ages 6–8). **Resolved (2026-05-21):** Keep the persona at 6–10 to preserve the product's full intent; v1 ships content calibrated to ages 6–8 with grade-3 material as the largest v2 expansion. The User & Persona section and the Non-Goals section both record this delta.

2. **Architecture pivot (PWA → web-app + cloud DB).** Original shape (2026-05-21 morning): single-device PWA, on-device storage, no auth, no cloud sync. **Resolved (2026-05-21 same day):** moved to a browser-loaded web app backed by a cloud database, with parent-account-based access (email-backed auth, multiple child profiles per account, cross-device login). Privacy guardrail rewritten (only parent email is PII). Offline behavior + PWA conversion deferred to v2. New FRs added: FR-014 (parent sign-up), FR-015 (cross-device login + profile-picker), FR-016 (graceful network-loss handling). Old FR-012 ("on the device") rewritten to cloud-backed. Tech-stack hints (Vercel hosting, Supabase database+auth) routed to Forward block for tech-stack-selector.

## Quality cross-check

Cross-check ran 2026-05-21 against the greenfield 6-check soft gate.

- Access Control — **present.** Parent-account-backed (email auth) with multiple child profiles per account; cross-device login; no separate child login. (Post-pivot 2026-05-21: changed from single-device local profile.)
- Business Logic — **present.** One-sentence rule locked: "Every math task is rendered as a purposeful business activity inside a story-driven game, never as a bare equation, so the child practices math while running their shop." Not empty-CRUD; rule is Workflow + Calculation shape (math gates in-world progression).
- Project artifacts — **present.** Valid frontmatter, project name (MathShop), context_type: greenfield, product_type, target_scale, timeline_budget all set.
- Timeline-cost acknowledgment — **present.** Cost was surfaced in Phase 3 (8–12-week original estimate flagged); user picked scope-down to 4 weeks. The scope-down choice IS the acknowledgment.
- Non-Goals — **present.** Post-pivot: no parent dashboard, no monetization ever, no grade-3 content in v1, no gamification beyond coins/stars/shop-growth, no world map in v1, no second theme/avatar customizer/audio in v1, no offline / PWA shell in v1, no anonymous play in v1.
- Preserved behavior — **n/a** (greenfield).

All 6 checks pass. `checkpoint.quality_check_status: accepted`.

## Forward: tech-stack

Notes for the downstream tech-stack-selector step (NOT part of PRD):

- Browser-loaded web application accessed via URL (no PWA shell, no offline support in v1).
- Cloud database backing all persisted state, keyed on (parent account, child profile).
- Email-backed parent authentication. The user surfaced Supabase as a likely choice for both database and auth — pin with tech-stack-selector. Magic-link vs password verification is part of the stack pick.
- Frontend deployment: the user surfaced Vercel as the preferred host — pin with tech-stack-selector.
- Localization design (per FR-013) accepts new locales as content swaps, not source-code changes. Pick a stack pattern that supports this without rework.
- Animation-heavy UI for a kid persona — the stack pick should accommodate smooth, performant animations on mid-range tablets.
- Two visual themes deferred to v2 — but the theming infrastructure should be in place from day one (per-profile theme field already in the data model).
- v2 backlog (not v1 stack pick): PWA conversion + offline play on top of the same database; child progress sync resilience across network blips.

## User Stories

### US-01: Child completes their first shift end-to-end

- **Given** a child has created a profile (display name, pre-set avatar, theme) and is looking at the world map with the lemonade-stand location unlocked
- **When** they tap the lemonade-stand to enter Shift 1
- **Then** they complete 8–12 mixed counting and change-making tasks in business context, receive celebratory feedback on every correct answer and supportive retry on every wrong one, reach a results screen showing total coins earned, stars (0–3 based on accuracy), and a business-level update — and on the next launch they find their profile and progress preserved exactly as left

#### Acceptance criteria

- Every task is rendered as a *business activity*, not a bare equation (e.g., "Mrs. Kowalski paid with 5 zł for an item that costs 3 zł — how much change do you give her?" — never "5 − 3 = ?").
- Counting tasks use visible, tappable objects (coins in the till, items on a shelf), not numerical inputs.
- Wrong answers produce a gentle "try again" with the same task; the child can attempt unlimited retries on a single task. The wrong-answer count is recorded for the star rating but the task always completes once correct.
- The results screen shows in this order: coins earned this shift, total coins, stars (0–3), and the business-level number (incrementing if a level threshold was crossed).
- After the results screen, the child returns to the world map with persisted state. Closing the PWA and reopening it on the same device restores the same profile state intact.
