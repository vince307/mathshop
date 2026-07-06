# Review follow-ups — upper-band-task-difficulty

From `reviews/impl-review.md` (2026-07-06 triage):

- [ ] **F4 (deferred)** — When the next migration touches `child_profiles`, update the stale
  `starting_level` column comment in the live schema (currently says "age 6–7 → 1, 8–9 → 2";
  reality since S-08 is "6–7 → 1, 8 → 2, 9 → 3"). Origin:
  `supabase/migrations/20260628120000_child_profiles_add_identity.sql:36`. Comment-only —
  do not ship a dedicated migration for this.
