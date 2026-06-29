---
project: MathShop
version: 1
status: draft
created: 2026-06-09
updated: 2026-06-29
prd_version: 2
main_goal: speed
top_blocker: time
---

# Roadmap: MathShop

> Derived from `context/foundation/prd-v2.md` (v2) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

MathShop teaches math to Polish children (ages 6–8 in v1) by wrapping every operation inside a coherent business narrative: the child runs a small shop, and every counting, change-making, or pricing task is a purposeful business moment, not a bare equation. The dual-track payoff — math fluency plus early financial literacy (value-of-money, decision-making) — is what makes a parent pick this app over a generic quiz drill, and what makes a child come back without being nagged. The hard product rule: math never appears decontextualized, even in onboarding.

## North star

**S-04: Child completes a full shift end-to-end with results (coins + stars + persistence)** — the smallest slice whose successful delivery would prove the core product hypothesis (entrepreneurship-framed practice makes a 6-year-old finish a shift and want to come back). Tied to PRD §Success Criteria primary.

> The **north star** here is the smallest end-to-end slice whose successful delivery proves the product's core hypothesis — placed as early as Prerequisites allow, because everything else only matters if this one works. Visible shop growth on level-up (S-05) follows as the ownership-payoff polish; the validation milestone itself is S-04.

## At a glance

| ID    | Change ID                                    | Outcome (user can …)                                                                                | Prerequisites | PRD refs                                              | Status   |
| ----- | -------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------- | -------- |
| F-01  | per-account-isolation-contract               | (foundation) RLS template + first migration + isolation verification pattern                        | —             | §Access Control, FR-012, FR-015                       | done     |
| S-01  | parent-signup-first-profile-and-start-screen | Parent signs up in Polish, creates the first child profile, child reaches start screen              | F-01          | US-01, FR-001, FR-002, FR-003, FR-004, FR-013, FR-014 | done     |
| S-02  | counting-task-in-business-context            | Child completes a single counting task wrapped in shop narrative with soft retry                    | S-01          | US-02 (partial), FR-006, FR-007, FR-008, FR-009       | done     |
| S-03  | change-making-task-in-business-context       | Child completes a single change-making task wrapped in shop narrative with soft retry               | S-01          | US-02 (partial), FR-006, FR-007, FR-008, FR-009       | done     |
| S-04  | full-shift-with-results                      | Child completes a 5–10 task shift, sees results screen, state persists across same-browser sessions | S-02, S-03    | US-02, FR-006, FR-008, FR-010, FR-011, FR-012         | proposed |
| S-05  | visible-shop-growth                          | Child sees the shop visibly grow (new shelf / sign / decoration) when crossing a level threshold    | S-04          | US-02 AC, FR-011 (shop-change clause)                 | proposed |
| S-06  | cross-device-login                           | Parent logs in from a new device and sees the same profiles + per-profile progress                  | S-04          | FR-015, §Success Criteria (cross-device)              | proposed |
| S-07  | multi-profile-picker                         | Parent adds a second child profile; on next launch a profile-picker scoped to the account appears   | S-01          | FR-002, FR-015 (multi-profile)                        | proposed |
| S-08  | network-loss-handling                        | A network drop mid-shift halts the shift gracefully with a Polish in-world message                  | S-04          | FR-016                                                | proposed |
| S-09  | child-ui-polish                              | Built child surfaces (start, task, results) brought to MatmaVerse mockup fidelity + a child-primitive library | S-04          | §NFR (anim, tap targets), §Persona; ui-v2 mockups     | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                   | Chain                                              | Note                                                                              |
| ------ | ----------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------- |
| A      | Wedge & shift           | `F-01` → `S-01` → (`S-02` ∥ `S-03`) → `S-04`       | The must-have path to the north star — sequenced first under `main_goal: speed`.  |
| B      | Post-shift extensions   | `S-04` → {`S-05` / `S-06` / `S-08` / `S-09`} (parallel) | Extensions that depend only on S-04. S-09 (UI polish) touches shared child surfaces — sequence it last in the stream so it polishes settled screens, not moving ones. |
| C      | Multi-profile lifecycle | `S-01` → `S-07`                                    | Independent of the shift loop — can be planned in parallel with Stream A from S-01. |

## Baseline

What's already in place in the codebase as of `2026-06-09` (auto-researched + user-confirmed). Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6.3.1 + React 19 + Tailwind 4 + shadcn/ui Button; `src/pages/{index,dashboard}.astro`, `src/pages/auth/{signin,signup,confirm-email}.astro`, `src/components/auth/SignInForm.tsx`, `src/components/ui/button.tsx`.
- **Backend / API:** partial — Astro SSR (`output: "server"`) + 3 auth endpoints (`src/pages/api/auth/{signin,signup,signout}.ts`); no zod, no `src/lib/services/`, no other API surface.
- **Data:** absent — `supabase/config.toml` declares migrations but the directory is empty; no schema, no `child_profiles`, no ORM/query-builder dep in `package.json`.
- **Auth:** present (password-based) — `src/lib/supabase.ts` configures `@supabase/ssr`; `src/middleware.ts` gates `PROTECTED_ROUTES = ["/dashboard"]`; Supabase email confirmation enabled by default. Magic-link vs password is PRD Open Q#1 — the v1 default here is the existing password scaffold (see `## Open Roadmap Questions`).
- **Deploy / infra:** present — `@astrojs/vercel@10.0.7` adapter; `vercel.json` pins region `fra1`; GitHub → Vercel auto-deploy live; `.github/workflows/ci.yml` runs `npm run lint` + `npm run build` on push/PR to `main`; production at `https://mathshop.vercel.app` returns HTTP 200.
- **Observability:** absent — no logger, no Sentry/Datadog/OTel deps. Parked for v1 (see `## Parked`).

## Foundations

### F-01: Per-account data isolation contract

- **Outcome:** (foundation) RLS policy template established, first Supabase migration ships the `child_profiles` table with per-operation per-role RLS policies in the same file, and a reusable isolation verification test asserts that one parent's profiles are never readable by another. The pattern locks the contract every subsequent migration must follow.
- **Change ID:** per-account-isolation-contract
- **PRD refs:** §Access Control, FR-012 (per-profile state preserved), FR-015 (cross-device login restoring the same profile set), §Success Criteria guardrail "No PII tied to children"
- **Unlocks:** S-01 (needs the first table with RLS in place to write a profile); isolation verification path used by S-06 (cross-device negative test) and revalidated whenever S-04 extends the schema with shift state
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** RLS is `CLAUDE.md`'s named highest-risk correctness invariant — wrong policies mean a silent data leak, not a crash. Sequencing this as a discrete foundation (rather than folding into S-01) makes the pattern visible to every later migration author, and ensures the negative isolation test exists before any user-facing slice can rely on it.
- **Status:** done

## Slices

### S-01: Parent signs up in Polish and creates the first child profile

- **Outcome:** A first-time parent reaches `mathshop.vercel.app`, sees a Polish sign-up surface, completes email verification, picks one of ~6 pre-set avatars in the "create first child profile" flow, and the child lands on the start screen with the lemonade-stand business visible and an in-world tap-to-start prompt.
- **Change ID:** parent-signup-first-profile-and-start-screen
- **PRD refs:** US-01, FR-001, FR-002 (single-profile case — skip picker), FR-003, FR-004, FR-013, FR-014
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Verification mechanism (magic-link vs password vs both) — PRD §Open Questions #1. Owner: user. Block: no (the v1 default is the existing password scaffold; switching later is straightforward).
- **Risk:** This slice introduces three load-bearing v1 patterns: (a) Polish content authored as content, not hardcoded strings, to satisfy FR-013's "no source-code changes for v2 locales"; (b) the avatar-as-profile-identity pattern (no text input, per FR-001's accessibility rationale); (c) the first write under the F-01 RLS contract. Getting (a) wrong invalidates v2 locale expansion; getting (c) wrong means cross-account profile leaks. Largest slice in the must-have path — flagged for `/10x-plan` to weigh splitting if it exceeds plannable scope.
- **Split during planning:** **S-01a** (auth + email verification + Polish foundation) — implemented + reviewed (APPROVED), archived 2026-06-27 → `context/archive/2026-06-26-parent-signup-first-profile-and-start-screen/`. **S-01b** (child-profile schema + avatar registry + profile wizard + start screen + `/app` profile-count router) — implemented + reviewed (APPROVED), archived 2026-06-28 → `context/archive/2026-06-28-first-child-profile-and-start-screen/` (change id `first-child-profile-and-start-screen`). The MatmaVerse light design system (archived 2026-06-27) was sequenced between the two halves.
- **Status:** done — S-01a + S-01b both archived

### S-02: Child completes a counting task in business context

- **Outcome:** The child taps the lemonade stand and is shown a single counting task wrapped in shop narrative ("Ile monet leży w kasie?" with visible, tappable coins). Wrong taps produce a gentle "spróbuj jeszcze raz"; after 1–2 misses, a scaffolding hint briefly highlights the relevant artifact. Correct answer produces a small acknowledgment (subtle animation) and the task closes.
- **Change ID:** counting-task-in-business-context
- **PRD refs:** US-02 (partial — counting half), FR-006 (counting half), FR-007 (grades 1-2 procedural generation), FR-008 (per-answer acknowledgment), FR-009 (retry + scaffolding hint)
- **Prerequisites:** S-01
- **Parallel with:** S-03 (same Prereq, same task-rendering contract — different math operation)
- **Blockers:** —
- **Unknowns:**
  - What does "subtle animation" feel like to a 6-year-old vs. fanfare fatigue? — Owner: user (kid-testing). Block: no (ship a reasonable default; iterate after observation).
- **Risk:** First exercise of the business-narrative wrapper; the pedagogy depends on this feeling like running a shop, not like a math drill. The contract this slice establishes (task spec → rendered shop moment → answer collection → feedback) is what S-03 and the shift loop in S-04 will reuse.
- **Status:** done

### S-03: Child completes a change-making task in business context

- **Outcome:** The child is shown a single change-making task wrapped in shop narrative (e.g., "Pani Kowalska zapłaciła 5 zł za sok kosztujący 3 zł — ile reszty jej dasz?"). Same soft-retry / scaffolding-hint pattern as S-02. Correct answer closes the task with a small acknowledgment.
- **Change ID:** change-making-task-in-business-context
- **PRD refs:** US-02 (partial — change-making half), FR-006 (change-making half), FR-007, FR-008, FR-009
- **Prerequisites:** S-01
- **Parallel with:** S-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Same task-rendering contract as S-02 — extending it to a second operation type validates the contract is reusable before the shift loop in S-04 stress-tests it with mixed-type sequencing.
- **Status:** done

### S-04: Child completes a full shift end-to-end with results

**NORTH STAR.**

- **Outcome:** The child taps the lemonade stand, completes a 5–10 task shift (length adapts to level) mixing S-02-style counting and S-03-style change-making, sees a results screen showing total coins earned (single shift-end payout) and stars (0–3 based on accuracy), and returns to the start screen with profile state persisted. Re-opening the app on the same browser restores the same profile and progress.
- **Change ID:** full-shift-with-results
- **PRD refs:** US-02 (full), FR-006 (full shift), FR-008 (shift-end celebration), FR-010 (coins paid once at shift end), FR-011 (results screen with coins + stars), FR-012 (per-profile persistence)
- **Prerequisites:** S-02, S-03
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - How is "level" defined for the first profile (default starting level, threshold function)? — Owner: user. Block: no (ship a sensible default — level=1 maps to ~5 tasks, ~70% counting / ~30% change-making — iterate after observation).
- **Risk:** The validation milestone. Extends the `child_profiles` schema (or adds a sibling `profile_state` table) under F-01's RLS contract — the second test of whether the isolation pattern propagates. Combines two task types, shift-length adaptation, scoring, results-screen rendering, and persistence in one slice; if `/10x-plan` finds the scope too large, candidate split is "shift loop + persistence" then "results screen". But the user-visible outcome is one capability (a complete shift) — splitting would break vertical-first.
- **Status:** proposed

### S-05: Visible shop change on level-up

- **Outcome:** When a completed shift crosses a level threshold, the child sees a visible change to the shop (new shelf, new sign element, or new decoration) on the results screen and the next start-screen visit. The level number is tracked internally but the UI shows the literal shop growth, not an abstract integer.
- **Change ID:** visible-shop-growth
- **PRD refs:** US-02 AC ("a visible shop change when a level threshold was crossed"), FR-011 (visible shop change clause)
- **Prerequisites:** S-04
- **Parallel with:** S-06, S-08 (all post-S-04 extensions, sibling)
- **Blockers:** —
- **Unknowns:**
  - How many threshold tiers + what artwork ships for v1? — Owner: user (art direction). Block: no (start with 2–3 tiers + the minimum shop-growth assets that make the pedagogy land).
- **Risk:** This is the ownership-grows pedagogy completing the primary Success Criterion. Without it, the validation in S-04 proves "shift loop works" but not "ownership grows visibly". Defers the FULL Success Criterion landing by one slice — accepted under `main_goal: speed` because the wedge proof is in S-04, and shop-growth artwork can iterate independently.
- **Status:** proposed

### S-06: Cross-device login restores per-profile progress

- **Outcome:** A parent who completed shifts under profile A on Browser X signs in on Browser Y (or a phone) and sees the same profile A with the same coins, level, and visible shop state — exactly as left. A second parent (account B) signing in on the same physical device never sees account A's profiles or progress.
- **Change ID:** cross-device-login
- **PRD refs:** FR-015, §Success Criteria primary (cross-device persistence clause)
- **Prerequisites:** S-04
- **Parallel with:** S-05, S-08
- **Blockers:** —
- **Unknowns:** —
- **Risk:** This is the end-to-end exercise of F-01's RLS isolation contract under real cross-account, multi-device load. The negative test (account B cannot see account A's data) lives here and is the highest-impact correctness gate in the project. If it fails, every shipped slice that touched DB needs an audit. Sequenced immediately after S-04 (when the data layer has real state to exercise) and before S-07 (which multiplies profile rows per account).
- **Status:** proposed

### S-07: Multi-profile picker for accounts with 2+ children

- **Outcome:** A parent with one profile already created adds a second child profile (one-tap action from the parent surface, pick another pre-set avatar). On the next launch under that account, the app shows a profile-picker scoped to that account; tapping a profile takes the child to that profile's start screen with that profile's state. Single-profile accounts continue to skip the picker.
- **Change ID:** multi-profile-picker
- **PRD refs:** FR-002, FR-015 (multi-profile aspect), US-01 (extension when the account already has ≥2 profiles)
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-03, S-04, S-05, S-06, S-08 (depends only on S-01's profile-creation surface, runs alongside the whole shift loop)
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Stretches the F-01 isolation contract to multi-row-per-account (rather than the implicit single-row of S-01). RLS policies written in F-01 must already correctly scope on `(account_id, profile_id)` — if they only scoped on `account_id`, this slice would expose the gap. Treat S-07 as a contract-correctness verification slice in addition to a feature slice.
- **Status:** proposed

### S-08: Network-loss mid-shift halts gracefully

- **Outcome:** If the browser loses network connectivity mid-shift, the app shows a Polish in-world message ("Internet zniknął! Spróbuj za chwilę.") and halts. Pending mid-shift progress is discarded. On reconnect, the child returns to the start screen with profile state at the last shift-end the server recorded.
- **Change ID:** network-loss-handling
- **PRD refs:** FR-016
- **Prerequisites:** S-04
- **Parallel with:** S-05, S-06
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Last must-have FR; small but listed in PRD §Success Criteria's resilience clause. v1 does NOT attempt offline queueing (explicit PRD non-goal) — the slice is intentionally narrow: detect, halt, in-world message, no retry, no queue.
- **Status:** proposed

### S-09: Child UI/UX polish to mockup fidelity (design-system Part B)

- **Outcome:** The child surfaces built across S-01b–S-04 (start screen, counting task, change-making task, full-shift + results) are brought up to the canonical MatmaVerse mockup fidelity. Two parts: (a) a reusable **child-primitive component library** — the deferred design-system "Part B" — that absorbs and supersedes the ad-hoc primitives already shipped (`ChildButton`, `SelectTile`, and the counting-task's hand-built coin/tally/feedback visuals); (b) a visual/UX pass on each built child screen against the `assets/matma-verse` ui-v2 mockups (child-dashboard, change-mission, pricing-inventory as references). Pure visual/UX — no behavior, copy, or routing change (mirrors how the MatmaVerse design-system foundation restyled the auth surfaces without touching logic).
- **Change ID:** child-ui-polish
- **PRD refs:** §Non-Functional Requirements (smooth animation, oversized non-adjacently-hittable tap targets — prd-v2.md:145–148), §Persona (early-reader reliance on icons/animation/minimal text). Design source of truth: `assets/matma-verse/math-economy-ui-v2-{web,mobile}/` (CLAUDE.md).
- **Prerequisites:** S-04
- **Parallel with:** S-05, S-06, S-08 (sibling post-S-04 extensions) — but S-09 touches the same child surfaces, so sequence it **after** the others settle to avoid re-polishing.
- **Blockers:** —
- **Unknowns:**
  - Fidelity bar: pixel-faithful vs spirit-faithful, and which screens are in the v1 polish scope vs deferred. — Owner: user. Block: no (start with the core-loop surfaces — start, task, results — at spirit-faithful, iterate).
  - The mockups are **gitignored / local-only** (CLAUDE.md): a fresh clone / CI / cloud-agent session won't have them. — Owner: maintainer must share the relevant ui-v2 mockups for any agent doing this slice. Block: no (degrade to the maintainer describing the target).
- **Risk:** This is the design-system "Part B" finally tracked rather than leaking into each functional slice as just-enough UI. Sequenced post-S-04 deliberately: polishing before the core loop's surfaces exist means re-polishing. The net-new component library must **fold in** the existing ad-hoc primitives (don't fork a second button/tile system). Pure-visual scope keeps behavioral risk low, but it touches many files — best done when the core loop is stable and its screens have stopped moving.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                                    | Suggested issue title                                                | Ready for `/10x-plan` | Notes                                                       |
| ---------- | -------------------------------------------- | -------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------- |
| F-01       | per-account-isolation-contract               | Establish RLS isolation contract + first migration + isolation test  | yes                   | Run `/10x-plan per-account-isolation-contract` first        |
| S-01       | parent-signup-first-profile-and-start-screen | Polish parent sign-up + first child profile + start screen           | no                    | Unblocks when F-01 is done                                  |
| S-02       | counting-task-in-business-context            | Counting task in shop narrative with soft retry + scaffolding hint   | no                    | Unblocks when S-01 is done; parallel with S-03              |
| S-03       | change-making-task-in-business-context       | Change-making task in shop narrative with soft retry + scaffolding   | no                    | Unblocks when S-01 is done; parallel with S-02              |
| S-04       | full-shift-with-results                      | Full shift end-to-end with results screen + persistence (north star) | no                    | Unblocks when S-02 + S-03 are done                          |
| S-05       | visible-shop-growth                          | Visible shop change on level-up                                      | no                    | Unblocks when S-04 is done                                  |
| S-06       | cross-device-login                           | Cross-device login restores per-profile progress + isolation test    | no                    | Unblocks when S-04 is done; load-bearing isolation gate     |
| S-07       | multi-profile-picker                         | Add second profile + profile-picker for accounts with ≥2 profiles    | no                    | Unblocks when S-01 is done; parallel with the shift loop    |
| S-08       | network-loss-handling                        | Network-loss mid-shift halts gracefully with Polish in-world message | no                    | Unblocks when S-04 is done                                  |
| S-09       | child-ui-polish                              | Child UI/UX polish to mockup fidelity + child-primitive library      | no                    | Unblocks when S-04 is done; sequence last in Stream B       |

## Open Roadmap Questions

1. **Verification mechanism (magic-link vs password vs both).** PRD §Open Questions #1. The scaffold already has password-based Supabase auth wired (`src/lib/supabase.ts`, `src/pages/api/auth/{signin,signup,signout}.ts`) with email confirmation on. Under `main_goal: speed`, the recommended v1 default is to keep the existing password scaffold; magic-link is a v2 candidate. Owner: user. Block: S-01 only if the user wants to switch away from password before shipping; otherwise non-blocking.

## Parked

- **No parent-facing dashboard / progress reports / time limits / settings UI in v1** — PRD §Non-Goals. Parent surfaces in v1 are sign-up, login, profile-picker, sign-out. Dashboard is straightforward read-only views over existing account data and slots into v2.
- **No monetization mechanic — ever (no ads, no IAP, no paywall, no premium tier)** — PRD §Non-Goals. Identity, not a deferred feature.
- **No grade-3 math content in v1 (multiplication, division, fractions, measurement)** — PRD §Non-Goals + FR-007. Largest single v2 expansion.
- **No gamification beyond coins + stars + visible shop growth in v1** — PRD §Non-Goals. No daily streaks, no badges/achievements, no sibling leaderboard.
- **No visual world map in v1** — PRD §Non-Goals + FR-003 + dropped FR-005. Ships when 2+ business locations exist.
- **No second visual theme in v1** — PRD §Non-Goals. v1 ships one theme; data model already carries per-profile theme field.
- **No avatar customizer in v1** — PRD §Non-Goals. Avatars are pre-set (~6 named).
- **No audio cues in v1** — PRD §Non-Goals. Sound design (chimes, narration, ambient) is v2.
- **No offline / PWA shell in v1** — PRD §Non-Goals + FR-016 graceful network-loss only.
- **No anonymous play in v1** — PRD §Non-Goals. Parents must sign up before any child profile exists.
- **Production observability (Sentry/Datadog/OTel) in v1** — added under `main_goal: speed`; baseline reports observability absent and PRD does not gate launch on it. Vercel function logs are sufficient for v1 incident response. v2 candidate.

## Done

- **F-01: (foundation) RLS template + first migration + isolation verification pattern** — Archived 2026-06-11 → `context/archive/2026-06-09-per-account-isolation-contract/`. Lesson: L-001/L-002 (lessons.md).
- **S-01: Parent signs up in Polish and creates the first child profile** — Split into S-01a (auth + verification + Polish foundation, archived 2026-06-27) and S-01b (child-profile schema + avatar registry + wizard + start screen + `/app` router, archived 2026-06-28 → `context/archive/2026-06-28-first-child-profile-and-start-screen/`). Both APPROVED. Lesson: L-003 (i18n strings; lessons.md). Note: D1 product-owner override collects child name/age as RLS-isolated PII.
- **S-02: Child completes a counting task in business context** — Archived 2026-06-29 → `context/archive/2026-06-29-counting-task-in-business-context/`. Impl-review APPROVED (F1/F2/F3 fixed). Established the reusable task contract (spec → render → answer → feedback) S-03 and S-04 inherit. Lesson: —.
- **S-03: Child completes a change-making task in business context** — Archived 2026-06-29 → `context/archive/2026-06-29-change-making-task-in-business-context/`. Impl-review APPROVED (0 warnings). Generalized the task contract: `Task` union + shared `useCoinTask`/`CoinBoard`/`TaskScreen` core + polymorphic `/app/task` (counting ∥ change-making). Both task types + the rendering core now ready for the S-04 shift. Lesson: —.
