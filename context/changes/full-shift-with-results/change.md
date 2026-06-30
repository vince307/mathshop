---
change_id: full-shift-with-results
title: Child completes a full shift end-to-end with results and persistence
created: 2026-06-29
status: implemented
updated: 2026-06-30
archived_at: null
---

## Notes

Roadmap slice **S-04 — the NORTH STAR** (`context/foundation/roadmap.md`). Prereqs S-02 + S-03 done. The validation milestone: the smallest end-to-end slice proving the core product hypothesis.

The child taps the business, completes a **5–10 task shift** (length adapts to level) mixing S-02 counting and S-03 change-making, sees a **results screen** showing total coins earned (single shift-end payout) and stars (0–3 by accuracy), and returns to the start screen with **state persisted**. Re-opening on the same browser restores the same profile + progress.

Key new ground vs S-02/S-03 (which were stateless):
- **First gameplay persistence** — coins, completed-shift count, business level, shop state. New migration/table under the **F-01 RLS contract** (L-001: four per-op policies same migration; L-002: isolation test inserts without chained `.select()`, verify durable state). `child_profiles_isolation.sql:48-49` flags gameplay state as S-04's job.
- **Shift loop** composing the existing `Task` union + `generateTask` + shared `TaskScreen` core into a sequence of 5–10 tasks.
- **Scoring**: coins paid once at shift end (FR-010); stars 0–3 from accuracy (FR-011); shift length adapts to level (FR-006).
- **Results screen** (FR-011) — coins + stars + visible shop change on level threshold (the literal shop-growth clause is S-05; S-04 shows coins + stars).

PRD refs: US-02 (full), FR-006, FR-008, FR-010, FR-011, FR-012. Bigger than S-02/S-03 — likely warrants `/10x-research` first (persistence + RLS + scoring + results, with a possible plan-time split: shift loop + persistence, then results screen). Open question from roadmap: how "level" is defined for the first profile (default level, threshold function) — ship a sensible default, iterate.
