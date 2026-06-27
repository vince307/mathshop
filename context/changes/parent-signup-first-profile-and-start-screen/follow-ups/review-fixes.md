# Review follow-ups — parent-signup-first-profile-and-start-screen

Deferred items from the full-plan implementation review (2026-06-27). See `reviews/impl-review.md`.

## F2 — zod validation across all auth routes (cross-cutting)

**Origin:** review finding F2 (Pattern Consistency, OBSERVATION).

CLAUDE.md mandates zod input validation for API routes, but the auth routes
(`signin`, `signup`, `signout`, `confirm`, `resend`) are deliberately redirect-only
with no server-side validation — a pattern pinned by `tests/auth-routes.test.ts`
("no server-side validation: empty fields produce an error redirect, not a crash").

Adding zod to only the new routes (`confirm`/`resend`) would make them inconsistent
with their siblings. **Decision:** make it one cross-cutting change that adds zod to
**all** auth routes at once (and updates the no-validation pin), rather than piecemeal.
Not blocking S-01a.
