---
project: "MathShop"
version: 2
status: draft
created: 2026-05-21
context_type: greenfield
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

# MathShop — Product Requirements Document (v2, post-pivot)

## Vision & Problem Statement

Most math apps drill arithmetic in a vacuum — "3 + 5 = ?" with no context. Children aged 6–10 disengage from practice because the math feels pointless: it never explains why a number matters. Parents look for an alternative and find a sea of generic quiz apps, can't tell which one actually teaches, and end up nagging the child to use whichever they picked. The math is technically "practiced" but not internalized.

The insight: when math is wrapped in a single coherent business narrative — the child runs their own little shop and every operation (counting, change-making, comparing prices, fractions of a cake) is a purposeful business task — children learn both math fluency AND early financial literacy (budgeting, decision-making, value-of-money). That dual-track payoff is what makes a parent pick this app over a generic quiz drill, and what makes a child want to come back without being nagged.

## User & Persona

### Primary persona: the child (ages 6–10, Polish primary school grades 1–3)

A child in early primary school in Poland. May still be an early reader, so the product relies heavily on icons, audio cues, animation, and minimal text. They reach for the app on a tablet or family laptop, probably handed over by a parent. They expect a game; they don't yet expect or want a "lesson." Their attention span is short (8–12 task shifts at a time) and they need a tangible sense of progress (coins, stars, the shop visibly growing) to keep coming back.

**v1 scope on the persona age band.** The full product targets ages 6–10. v1 ships content calibrated to grades 1–2 (ages 6–8) — counting, addition/subtraction in change-making. Grade-3 content for the 9–10 cohort (multiplication, division, fractions, measurement) is the largest single v2 feature and is named explicitly in `## Non-Goals`. The persona section keeps the 6–10 framing to preserve the product's full intent; the FR set narrows to the v1 deliverable.

### Secondary persona: the parent (account-holder, occasional surface)

A parent of a 6–10-year-old who creates the account, signs in to enable each play session, and may occasionally check what their child has been doing. Not a daily operator of the game itself, but a daily operator of the account in that the child cannot play until the parent has logged in on the device. Their bar is: "Does this actually teach math, or is it another gamification veneer over a quiz?" The MVP is not designed around parent supervision UX — but the choice of pedagogy (entrepreneurship framing, mistakes-as-learning) is the parent-facing argument that gets the app installed in the first place.

## Success Criteria

### Primary

- The entrepreneurship-framed shift works end-to-end: parent signs up for an account, creates a child profile (pre-set avatar), the child reaches the start screen with the first business unlocked, completes a single shift (5–10 procedurally generated tasks; length adapts to level) that mixes counting and change-making in business context (count coins in the till, process a sale and give correct change), sees a results screen showing total coins earned, stars (0–3 based on accuracy), and any visible shop growth that resulted — and on the next visit (same browser with the parent still logged in, OR parent re-logs-in from any device) finds the same profile and progress preserved exactly as left.

### Secondary

- A typical child in the target persona can earn 3 stars (a perfect shift) at least once within their first 5 shifts — a signal that the difficulty curve is calibrated for the target persona, not too easy and not too punishing.

### Guardrails

- Mistakes never feel punishing. Wrong answers produce encouraging, soft feedback (visual + textual) — no red flash, no buzzer sound, no "game over" screen, no loss of accumulated coins. Violating this regresses the whole product premise even if the math works.
- No PII tied to children. The only personal data collected is the parent's email (for account access). Child profile data is pre-set avatar + coins + level + shop state — none of it identifying. No analytics tied to a child profile, no third-party data sharing, no advertising trackers. Data exchanged over the network is encrypted in transit. No ads, no in-app purchases, no purchase prompts, no dark patterns. Coins are in-world only. Streak design is forgiving — one missed day does not reset progress.
- 100% Polish localization. Every user-visible string — UI labels, task prompts, feedback messages, error states, even alt text and any debug strings the child could see — is in Polish. No English leaks anywhere user-visible.

## User Stories

### US-01: Parent signs up and creates the first child profile

- **Given** a first-time visitor lands on the application URL with no existing account on this browser
- **When** the parent enters their email and completes the verification step, then picks a pre-set avatar in the "create first child profile" flow
- **Then** the parent's account is created, the first child profile is associated with that account, and the child is taken directly to the start screen with the lemonade-stand business unlocked

#### Acceptance Criteria

- The sign-up surface is in Polish and shows nothing about pedagogy, monetization, or third-party logins — it's a single email field plus the verification step.
- The "create first child profile" step appears immediately after verification and surfaces ~6 pre-set avatars; the parent picks one for the child. No text-input field is required to complete this step.
- After avatar selection, the child sees the start screen — not the parent. The parent's surface ends as soon as the first profile exists.
- The browser session remains authenticated across page reloads until the parent explicitly signs out (no automatic timeout in v1).

### US-02: Child completes their first shift end-to-end

- **Given** an authenticated parent session and a child profile already on the start screen with the lemonade-stand business shown
- **When** the child taps the lemonade-stand business to start their first shift (entry is wrapped in an in-world Polish narrative prompt — see FR-004)
- **Then** they complete a shift of 5–10 procedurally generated tasks (length adapts to their level — see FR-006) mixing counting and change-making in business context, receive a small acknowledgment on each correct answer and a supportive scaffolded retry after 1–2 wrong attempts, reach a results screen showing total coins earned (single shift-end payout), stars (0–3 based on accuracy), and any visible shop change if a level threshold was crossed — and on the next visit (same browser still authenticated, OR the parent re-logs-in from any device) they find their profile and progress preserved exactly as left

#### Acceptance Criteria

- Every task is rendered as a *business activity*, not a bare equation (e.g., "Mrs. Kowalski paid with 5 zł for an item that costs 3 zł — how much change do you give her?" — never "5 − 3 = ?").
- Counting tasks use visible, tappable objects (coins in the till, items on a shelf), not numerical inputs.
- Wrong answers produce a gentle "try again" with the same task. After 1–2 consecutive wrong attempts on the same task, a scaffolding hint surfaces (briefly highlights the relevant on-screen artifact). The child can attempt unlimited retries on a single task; the wrong-answer count is recorded for the star rating but the task always completes once correct.
- The results screen shows: total coins earned this shift (paid out once at shift end), stars (0–3 based on accuracy), and a visible shop change when a level threshold was crossed (new shelf, new sign element, or new decoration). The level number itself is tracked internally but the UI shows the literal shop growth, not an abstract integer.
- After the results screen, the child returns to the start screen with persisted state. Progress is tied to the child profile within the parent's account and is restored on cross-device login.
- If network connectivity is lost mid-shift, the app shows a Polish in-world message (e.g., "Internet zniknął! Spróbuj za chwilę.") and halts the shift. On reconnect, the child resumes from the last shift-end the application recorded.

## Functional Requirements

### Profiles & onboarding

- FR-001: User can create a child profile (after the parent account exists) by picking a pre-set avatar (one of ~6 named avatars, e.g., "Lis" the fox); the avatar's built-in Polish name doubles as the profile name. No text-input step. Priority: must-have
  > Socrates: Challenge — "Name field is too high a bar for pre-readers; the 3-step creation flow is friction before play." Resolution: dropped the text-input step; avatar selection IS the profile creation. Since v1 ships only one theme, no theme picker in the creation flow either (the data model still supports per-profile theme for v2).

- FR-002: User sees a friendly profile-picker scoped to the currently authenticated account whenever 2+ child profiles exist under it. Single-profile accounts skip the picker and go straight to the start screen. Priority: must-have
  > Socrates: Challenge — "A one-option picker every launch is friction." Resolution: show picker only when ≥2 profiles exist under the account.

### World & progression

- FR-003: User can start a shift from a simple in-world start screen showing the active business (the lemonade stand). The full visual world map is deferred to v2 (ships when 2+ locations exist). Priority: must-have
  > Socrates: Challenge — "World map is decorative with only one unlocked location; a Start Shift button is simpler and faster." Resolution: defer the map to v2; v1 ships a single-business start screen.

- FR-004: User can tap the active business to start a shift; the tap is wrapped in an in-world Polish narrative prompt (e.g., "Czas otworzyć sklep!"). Priority: must-have
  > Socrates: Challenge — "Bare tap-to-start is mechanical." Resolution: wrap the tap in an in-world prompt to keep the narrative active.

- FR-005: (Deferred to v2 alongside the world map; cascade from FR-003.) Priority: deferred
  > Socrates: Challenge — "Map is dropped in v1, so the locked-locations-on-map FR no longer applies." Resolution: dropped from v1 entirely; will be reintroduced in v2 with the map.

### Shift gameplay

- FR-006: User can complete a shift whose length adapts to their level. Lower-level (grade 1 equivalent) profiles play shorter shifts (~5–7 tasks); higher-level (grade 2 equivalent) profiles play longer shifts (~8–10 tasks). Each shift mixes counting and change-making tasks. Priority: must-have
  > Socrates: Challenge — "8–12 tasks may be too long for a 6-year-old's attention span." Resolution: shift length is adaptive — shorter for younger/lower-level, longer as the child progresses, all within the grades 1–2 band (see FR-007).

- FR-007: Task numbers are procedurally generated within the **grades 1–2 difficulty band (ages 6–8)** in v1. Grade 3 (ages 9–10) tasks — including the multiplication/division/fractions material from the original vision — are deferred to v2. Priority: must-have
  > Socrates: Challenge — "Grades 1–3 is too wide a band for one MVP." Resolution: narrow v1 to grades 1–2. Implication: the v1 deliverable serves ages 6–8; the original 6–10 persona is the v2 target. Logged in Open Questions.

- FR-008: User receives a small acknowledgment per correct answer (subtle animation; audio cues deferred to v2) and a bigger celebration at shift end. Tiered feedback prevents per-answer fanfare fatigue. Priority: must-have
  > Socrates: Challenge — "Constant per-answer celebration loses signal." Resolution: tiered feedback — small per task, large at shift end.

- FR-009: User can retry a wrong answer within a task without losing earned coins. After 1–2 consecutive wrong attempts on the same task, a gentle scaffolding hint surfaces (e.g., briefly highlights the relevant on-screen artifact such as the coin pile to count); retry + hint, not retry + silence. Wrong-answer count affects star rating but never blocks progression. Priority: must-have
  > Socrates: Challenge — "Unlimited silent retry risks rote tapping; the child learns to guess, not to think." Resolution: scaffolding hint after 1–2 misses — teach the strategy, not just the answer.

### Scoring & persistence

- FR-010: User earns coins for completing a shift; coins are paid out **once at shift end** as a single in-world payout (not per correct answer). Coin amount reflects the shift's accuracy and length. Priority: must-have
  > Socrates: Challenge — "Per-answer coin reward feels transactional and fragments focus." Resolution: single shift-end coin payout keeps math attention central; reward signal is concentrated where it pedagogically fits (end-of-work payout).

- FR-011: User receives a results screen showing total coins earned, stars (0–3 based on accuracy), and — when a level threshold is crossed — a **visible shop change** (new shelf, new sign element, new decoration). The level number is tracked internally but the UI shows literal shop growth as the reward, not an abstract integer. Priority: must-have
  > Socrates: Challenge — "Business level as a number is abstract for a 6-year-old." Resolution: surface level progression as visible shop growth (new shelf, new sign) rather than an integer. Reinforces ownership-as-pedagogy: the shop visibly grows because the child worked.

- FR-012: User's child-profile state — coins, completed-shift count, business level, and visible shop state — is preserved across sessions and across devices; once the parent authenticates on any device, the same per-profile progress is available exactly as left. Priority: must-have
  > Socrates: Original pre-pivot challenge raised concerns about on-device storage durability for multi-month child progress. Resolution after architecture pivot (2026-05-21): on-device storage was replaced by an off-device persistence model tied to a parent account; durability is now handled outside the user's device, and cross-device access becomes a feature rather than a constraint. Choice of specific storage backend is routed to the downstream stack-selection step.

### Localization

- FR-013: All user-visible text is in Polish in v1. Adding additional locales in a future version must be possible through content changes alone, without requiring source-code modifications. Priority: must-have
  > Socrates: Challenge — "Hardcoding Polish creates a costly rewrite if v2 needs other markets." Resolution: build the localization design so it accepts new locales as content, not code — cheap insurance.

### Accounts & resilience

- FR-014: User can sign up for a parent account by providing their email; the account is then accessible by logging back in from any device. The verification mechanism (magic link, password, or both) is a stack-shaped decision routed to the downstream stack-selection step. Priority: must-have

- FR-015: Once a parent is authenticated, the app surfaces a profile-picker scoped to that account's child profiles. Cross-device login (parent logs in on a different browser or device) restores the same profile set and the same per-profile progress — coins, business level, visible shop state, completed-shift count — exactly as left. Priority: must-have

- FR-016: If the browser loses network connectivity mid-shift, the app halts the shift gracefully and shows a Polish in-world message (e.g., "Internet zniknął! Spróbuj za chwilę."). Pending shift state is lost; on reconnect, the child resumes from the last shift-end the application recorded. v1 does not attempt to queue or sync mid-shift work — offline resilience is deferred to v2. Priority: must-have

## Non-Functional Requirements

- Animation feels continuous and smooth — no perceptible stutter, dropped frames, or visible loading hitches during any interaction on a mid-range tablet released within the last 3 years.
- All interactive targets — avatars, task tiles, answer choices, on-screen coins, the start-shift button — are large enough and spaced enough that a typical 6-year-old's tap reliably lands on the intended target. Adjacent tap targets cannot be hit by a single tap that lands between them.
- Cold-load from URL to the first interactive screen (profile-picker for an authenticated returning parent, or sign-up screen for a first-time visitor) completes in ≤ 3 seconds on a typical home broadband connection and a mid-range tablet released within the last 3 years.
- Child-facing interactions during a shift (submitting an answer, surfacing a hint, advancing to the next task, reaching the results screen) feel immediate to the child — no visible wait state — on a typical home broadband connection. Network delays from slower connections must not degrade the in-shift experience into unresponsive feedback.

## Business Logic

Every math task is rendered as a purposeful business activity inside a story-driven game, never as a bare equation, so the child practices math while running their shop.

The inputs the rule consumes are user-facing artifacts of the shop: a pile of coins the customer hands over, a sale that needs a receipt, a price tag versus a sticker on a supplier's box, a recipe that needs a measured ingredient. Every input is a thing the child sees inside the world, not a numerical prompt floating on a blank screen.

The output is an in-world action that completes a small business moment: change is given, a customer leaves happy, a supplier is picked, an ingredient is measured. The math is the means; the in-world resolution is the end. Correctness gates the in-world resolution but never gates the child's continued play — wrong answers produce a gentle retry with a scaffolding hint (see FR-009), not a dead end.

The child encounters the rule continuously throughout each shift. There is no moment in the product flow where math appears decontextualized — even the first onboarding interaction is framed as opening the shop, not as "let's do some math." The narrative is the wrapper for every operation, not an intro skin that gets stripped away once the lessons begin.

## Access Control

Parent-account-backed. A parent creates an account associated with their email. Each account holds one or more child profiles. The child plays under a chosen profile within the account; there is no separate child login. Two roles exist: `parent` (the account-holder, the only role that authenticates) and `child profile` (a play context inside a parent account, no separate login).

- On first visit (no account on this browser session), the visitor is taken to a sign-up flow: the parent provides their email and completes the verification step. The exact verification mechanism (magic link vs password) is a stack-shaped decision routed to the downstream stack-selection step.
- After sign-up, the parent is taken to a "create first child profile" flow — they pick a pre-set avatar. Adding more sibling profiles later is a one-tap action.
- On every subsequent visit, if the parent is already authenticated on that browser, the app shows a profile-picker scoped to that account. If not authenticated, the parent re-authenticates first and is then taken to the same picker. Cross-device login restores the same profiles and per-profile progress.
- Each child profile is fully isolated within the account: own avatar, own theme assignment, own coins, own business level, own visible shop state, own progress.
- The parent's email is the only PII collected. Child profile data carries no real names (avatars are pre-set), no birthdates, no other identifying fields.
- An unauthenticated visitor hitting any gated route (start screen, profile-picker, in-shift surface) is redirected to the sign-up / login screen. There is no anonymous play in v1 (see `## Non-Goals`).
- No parent-facing dashboard / progress reports / time limits / settings UI in the MVP. The parent's surfaces are: sign-up, login, profile-picker, sign-out. Deep parental supervision is v2 work.

## Non-Goals

- **No parent-facing dashboard / progress reports / time limits / settings UI in v1.** The MVP is pure child experience past the auth wall. Parental supervision UX is real work and deferring it lets us focus on the pedagogy. Adding it later is straightforward — read-only views over the existing account data.
- **No monetization mechanic — ever. No ads, no in-app purchases, no paywall, no "premium tier."** This is identity, not a deferred feature. The product would compromise its own pedagogy by carrying any of these.
- **No grade-3 math content in v1 — no multiplication, no division, no fractions, no measurement.** v1 covers grades 1–2 (counting, addition, subtraction in change-making). Grade-3 content is the largest single v2 expansion.
- **No gamification beyond coins + stars + visible shop growth in v1.** No daily streaks, no badges/achievements, no sibling leaderboard. Each of these is real UI + state-tracking work; v1 ships the core loop only, with these as v2 candidates.
- **No visual world map in v1.** The map is deferred to v2 once 2+ business locations exist (see FR-003). v1 ships a single-business start screen instead.
- **No second visual theme in v1.** A second theme (with different color palette, mascot, art direction) is v2 work. v1 ships one theme; the data model still carries a per-profile theme field so v2 can add the second without a schema change.
- **No avatar customizer in v1.** Avatars are pre-set (one of ~6 named avatars). Customization is v2 work.
- **No audio cues in v1.** Sound design (success chimes, ambient shop sounds, narration) is deferred to v2.
- **No offline / PWA shell in v1.** The app is a browser-loaded web application; network is required. A network blip mid-shift halts the shift gracefully (see FR-016). PWA conversion + offline play sit in v2 backlog and are explicitly out of v1 scope.
- **No anonymous play in v1.** Parents must sign up before any child profile exists. A "try without signing up" surface is deferred; launching with it broadens the privacy and abuse surface unnecessarily for an MVP.

## Open Questions

1. **Verification mechanism (magic link vs password vs both).** FR-014 leaves the auth verification path open — it's a stack-shaped decision routed to the downstream stack-selection step, not pinned in PRD. Owner: tech-stack-selector / user.

2. **Persona age narrowing (resolved upstream, carried forward for visibility).** Original vision: Polish kids 6–10 (grades 1–3). FR-007 narrowed the v1 difficulty band to grades 1–2 (ages 6–8). Resolved during shape on 2026-05-21: keep the persona at 6–10 to preserve the product's full intent; v1 ships content calibrated to ages 6–8 with grade-3 material as the largest v2 expansion. No action required for PRD; flagged for visibility.

3. **Architecture pivot — historical record.** v1 of this PRD reflected an on-device PWA shape with no cross-device persistence. v2 reflects a browser-loaded web app backed by off-device persistence with parent-account-based access. The pivot was made on 2026-05-21 after the initial PRD was generated. Old FR-012 ("on the device") was rewritten to off-device; new FRs FR-014/FR-015/FR-016 were added; the privacy guardrail was rewritten (only parent email is PII); offline / PWA conversion is now explicit v2 backlog. No action required for PRD; flagged for traceability.
