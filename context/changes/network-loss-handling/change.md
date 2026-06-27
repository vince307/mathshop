---
change_id: network-loss-handling
roadmap_id: S-08
title: Network-loss mid-shift halts gracefully
status: preparing
created: 2026-06-14
updated: 2026-06-14
prd_refs: [FR-016]
---

# Change: Network-loss mid-shift halts gracefully

Slice S-08 from `context/foundation/roadmap.md`. If the browser loses network
connectivity mid-shift, the app shows a Polish in-world message
("Internet zniknął! Spróbuj za chwilę.") and halts. Pending mid-shift progress is
discarded. On reconnect, the child returns to the start screen with profile state
at the last shift-end the server recorded. v1 does NOT queue or sync mid-shift work
(explicit PRD non-goal) — detect, halt, message, no retry, no queue.

Prerequisite: S-04 (`full-shift-with-results`) — the shift loop and the shift-end
write must exist before there is anything to halt.

- Research: `research.md`
