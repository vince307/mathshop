---
change_id: per-account-isolation-contract
roadmap_id: F-01
title: Per-account data isolation contract
status: impl_reviewed
created: 2026-06-09
updated: 2026-06-11
prd_refs: [Access Control, FR-012, FR-015]
---

# Change: Per-account data isolation contract

Foundation F-01 from `context/foundation/roadmap.md`. Establishes the RLS isolation
contract every later migration must follow: the first Supabase migration ships
`child_profiles` with per-operation, per-role RLS policies in the same file; a Vitest
integration test proves one parent's profiles are never readable or writable by another;
CI gates on that test; and the reusable template + name registry are documented.

- Plan: `plan.md`
- Brief: `plan-brief.md`
