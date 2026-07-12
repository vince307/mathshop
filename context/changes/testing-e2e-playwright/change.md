---
change_id: testing-e2e-playwright
title: E2E browser layer with Playwright (test-plan rollout Phase 5)
status: implementing
created: 2026-07-12
updated: 2026-07-12
archived_at: null
---

## Notes

Open a change folder for rollout Phase 5 of context/foundation/test-plan.md: "E2E browser layer (Playwright)".
Risks covered: #2 (shift-state durability — user-visible cross-context restore), #4 (onboarding critical path — browser/deployed-shape half), #6 (gameplay loop in a real browser), plus the parent PIN-gate / account-deletion danger-zone surface.
Test types planned: e2e (Playwright against local dev server + local Supabase); Playwright bootstrap (config, fixtures, reuse of tests/helpers provisioning).
Risk response intent:

- #4: prove signup → email verification → first child profile → start screen completes in a real browser (real cookies, cross-page redirects, hydrated forms); do NOT duplicate the request-level route contracts already covered by tests/auth-routes.test.ts — e2e asserts the journey glue.
- #2: prove a completed shift's coins/level/shop state is visible after closing and reopening in a FRESH browser context; assert on the re-read UI state, never on a network response object.
- #6: prove the mission → counting/change-making tasks → shift end → results loop completes via real taps and timers (island hydration); soft-failure invariants stay component-level — e2e asserts the journey, not feedback styling.
- Parent surfaces: prove the PIN gate blocks/admits correctly and the account-deletion danger zone arms as designed in a real browser; destructive flows run only against disposable per-test accounts.

Constraints: locators getByRole/getByLabel/getByText first; never page.waitForTimeout (wait for state); every test independent with unique ids + cleanup (CLAUDE.md /10x-e2e hard rules). Browser-level phases of the resulting plan are driven by /10x-e2e, not /10x-implement.
