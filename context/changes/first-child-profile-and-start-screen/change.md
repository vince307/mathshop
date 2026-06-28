---
change_id: first-child-profile-and-start-screen
title: First child profile wizard and child start screen (S-01b)
status: implemented
created: 2026-06-28
updated: 2026-06-28
archived_at: null
---

## Notes

Roadmap slice **S-01b** — the second half of the S-01 split (`context/foundation/roadmap.md`, `### S-01`). S-01a (auth + email verification + Polish foundation) is implemented, reviewed, and archived (`context/archive/2026-06-26-parent-signup-first-profile-and-start-screen/`).

**Scope (from roadmap S-01 split note):** child-profile schema + avatar registry + profile wizard + child start screen + `/app` profile-count router.

**Prerequisite — met:** F-01 per-account isolation contract (`per-account-isolation-contract`) is in place; the first `child_profiles` write here must follow it. See lessons **L-001** (RLS in the same migration) and **L-002** (INSERT-isolation test pattern).

**Builds on:** the MatmaVerse light design system (archived `2026-06-27-matmaverse-design-system/`) — child surfaces are built on it, not restyled later. Child-primitive component library (oversized tap targets, etc.) was explicitly deferred from the design-system change to this Part B.

**PRD refs:** US-01, FR-001, FR-002 (single-profile case — skip picker), FR-003, FR-004, FR-013, FR-014. Design source: `assets/matma-verse/math-economy-auth-v2-*/05-child-profile` (avatar picker) + `math-economy-ui-v2-*` child surfaces (local-only mockups).
