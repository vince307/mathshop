# Skill-Path Upgrade Gate + Parent Weekly Report — Plan Brief

> Full plan: `context/changes/skill-path-upgrade-gate/plan.md`
> Research: `context/changes/skill-path-upgrade-gate/research.md`

## What & Why

Roadmap **S-07**: make world growth gated on *learning*, not just funds. Track a per-competency **skill-progress** signal (math / money / decisions) derived from task attempts, use it plus **completed task history** as extra upgrade requirements alongside S-06's cost + world-level gates (FR-010, FR-015), and give the parent a **weekly report** (FR-016) that ties each unlocked upgrade to the skills it exercised. This closes the "growth reinforces the math" guardrail the shipped loop only gestured at.

## Starting Point

S-06 shipped the earn→choose→grow loop and deliberately left the seams: `canBuy` already returns a reason union over a trusted context bag, and `child_profiles`' RLS is column-agnostic so a new column is cheap. But the skill signal, though present in `ShiftScreen`'s accumulator (task `type` + `firstTry`), is thrown away before the shift POST; there is no history anywhere (only current aggregates), and no parent surface, PIN, or list-all-profiles fn exists at all.

## Desired End State

Playing shifts visibly raises per-competency skill (monotonically); a couple of catalog upgrades require a skill level or task-history threshold and show the one concrete missing requirement when locked; spending never lowers skill. A parent enters a PIN and reads a weekly report for their own children only — what was practiced and which upgrade the week's play unlocked, tied to the skills it exercised.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Scope | Gate + parent report in one plan | S-07's outcome names both; gate is the load-bearing core, report is the payoff | Research |
| Structure | One plan, gate phases (1–3) then report (4–6) | Deliver the low-risk gate early; report reuses the same skill data | Plan |
| Gate on | Both skill + task-history, applied sparingly (~2 upgrades) | Matches FR-010's full tuple without over-gating the loop | Plan |
| Competencies | Three: math, money, decisions | Matches shipped tasks + doc-08 framing; decisions ties the loop to learning | Plan |
| Progress fn | Monotonic count → level thresholds | Naturally satisfies "spending never regresses"; maps cleanly to gate + bars | Plan |
| Persistence | `skill_state` jsonb column + new `shift_log` table | Gate stays cheap (column, no policy); report gets real history (L-001 table) | Research/Plan |
| History grain | Per-shift aggregate rows | Cheap; answers "practiced this week" + "which upgrade unlocked" | Plan |
| Parent gate | New route + parent-PIN (new `account_settings` table) | Keeps the report genuinely parent-only | Plan |
| Signal grain | Include miss counts (widen `TaskOutcome`) | Richer signal for the progress fn + report | Plan |

## Scope

**In scope:** skill-progress model (pure fns + `skill_state` column); miss-count capture; skill folded server-side at shift-complete + decisions at purchase; skill + task-history upgrade requirements on ~2 catalog entries; child skill bars + locked-reason copy; per-shift `shift_log` history table; weekly aggregation; parent-PIN gate (`account_settings`); PIN-gated `/app/report`.

**Out of scope:** new task types / `inventory`·`profit` competencies; child-vs-parent identity; per-task history rows; ratio/decay progress; retro-locking owned upgrades; gating every upgrade; any report beyond a read-only weekly summary.

## Architecture / Approach

Learning-signal first, then gate, then parent read surface. Pure `src/data/skills.ts` (competencies, thresholds, monotonic merge) is imported by client display, the shift-complete route (authority), and the buy route — "agree by construction". Skill folds into the *existing single UPDATE* in `recordShiftResult` (math/money) and `buyUpgrade` (decisions). The gate reads `skill_state` into `canBuy`'s context and adds `skill-locked`/`history-locked` rungs after `locked`, before `insufficient`. The report reads a new RLS-isolated `shift_log`, gated by a new RLS-isolated `account_settings` PIN.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Skill model + persistence | Pure fns, `skill_state` column, miss capture, shift folds skill server-side | Trust posture of client-reported deltas (mirror wallet) |
| 2. Gate extension | Skill + task-history requirements in `canBuy`; decisions accrues at purchase | Ladder ordering must not break S-06 gates |
| 3. Child skill surfacing | Skill bars + locked-reason/next-requirement copy | L-003 (all copy via i18n) |
| 4. History log + aggregation | `shift_log` table (L-001) + per-shift logging + weekly rollup | New-table isolation (L-001/L-002) |
| 5. Parent-PIN gate | `account_settings` table + set/verify + session marker | New auth surface; PIN hashing + isolation |
| 6. Parent weekly report | PIN-gated `/app/report` tying upgrades to skills | Cross-account read isolation (report is the new read path) |

**Prerequisites:** S-06 (done, archived). Local Supabase stack for integration tests. Parent-PIN mockup (`math-economy-auth-v2`) is local-only — ask maintainer if absent.
**Estimated effort:** ~5–7 sessions across 6 phases; the report half (4–6) is roughly 60% of the work (two new RLS tables + a new surface).

## Open Risks & Assumptions

- **Trust posture:** per-competency skill deltas are client-reported and server-capped/accumulated — the *same* posture as today's `taskCount`/`cleanCount`→wallet path, not fully trustless. Acceptable for a kids app; the server owns the progress function + monotonic merge. Decisions competency is fully server-side.
- **Parent-PIN is a genuinely new auth surface** — the largest single scope element. If Phase 5+6 prove too big, they can split into a follow-up change (gate half still fully closes the FR-010/FR-015 requirement).
- **Threshold ladder + which upgrades to gate** are first-guess/tunable; need kid-testing.
- **No child-vs-parent identity** means the PIN is a soft gate; a determined child could learn it. Report is read-only + non-shaming, which bounds the harm.

## Success Criteria (Summary)

- Playing shifts raises per-competency skill monotonically and persists; a skill/history-locked upgrade unlocks only once earned; spending never lowers skill.
- Account B can neither read nor write A's skills, history, or PIN (isolation tests + meta-checks green).
- Behind the PIN, a parent reads a weekly report for their own children only, tying unlocked upgrades to the skills exercised — Polish, educational, non-shaming.
