---
change_id: change-making-task-in-business-context
title: Child completes a change-making task in business context
status: impl_reviewed
created: 2026-06-29
updated: 2026-06-29
archived_at: null
---

## Notes

Roadmap slice **S-03** (parallel sibling of S-02, prereq S-01 — both done). The child is shown a single change-making task wrapped in shop narrative (e.g., "Pani Kowalska zapłaciła 5 zł za sok kosztujący 3 zł — ile reszty jej dasz?"), with the same soft-retry + scaffolding-hint pattern as S-02. Correct answer closes the task with a small acknowledgment.

Reuses the task contract S-02 just established: the `CountingTask` discriminated union (`src/types.ts`), the generator pattern (`src/data/counting-tasks.ts`), the `t.task[scenario]` i18n convention, the `/app/task` page, and the tap-to-count island feedback model. Likely adds a `ChangeMakingTask` member to the task-type union and a `change_making` scenario/generator. Stateless (no persistence — that's S-04). PRD refs: US-02 (change-making half), FR-006/007/008/009.
