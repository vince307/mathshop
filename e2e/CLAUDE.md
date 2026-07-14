# E2E Testing Rules (Playwright)

These rules govern every spec in `e2e/`. They exist so generated tests are
stable by default — model new specs on `seed.spec.ts` (the exemplar) and follow
the plan/research in `context/changes/testing-e2e-playwright/`.

- Use `getByRole`, `getByLabel`, `getByText` as primary locators. Fall back to
  `getByTestId` only when accessibility attributes are ambiguous (none exist in
  `src/` today — if you need one, that's a product finding to surface first).
- Never use CSS selectors, XPath, or DOM structure for locating elements.
  Sanctioned exceptions (closed list — do not extend it by analogy):
  1. `waitForIslands()` in `helpers/hydration.ts` — an infrastructure wait on
     Astro island hydration, not an element locator.
  2. `context.clearCookies({ name: "parent_verified" })` in the parent-surfaces
     spec — the only way to simulate marker expiry without a 15-minute sleep.
     Do not poke other cookies by name.
  3. One positional `.first()` on the world-tile locator in the onboarding spec
     (composite accessible names make "Kawiarnia" ambiguous). Prefer
     `filter()`-scoped locators for any new ambiguity.
- Every user-visible string a locator matches comes from the i18n dictionary via
  `helpers/i18n.ts` (`t`, `fill`, `templateRegex`) — never hardcode Polish
  beyond data the test itself injects (e.g. a child name it typed).
- Each test must be independently runnable — own setup, action, assertion,
  cleanup (`try/finally` + `deleteUser`); no shared state between tests. Unique
  identifiers (UUID emails via `provisionAccount`) so parallel runs never collide.
- Never use `page.waitForTimeout()`. Wait for state: `expect(...).toBeVisible()`,
  `page.waitForURL()`, `waitForResponse()`. The gameplay 1.4 s beat is absorbed
  by waiting for the NEXT state text, never a sleep.
- Authenticate via `provisionAccount` (admin API — bypasses the signup IP rate
  limit) + `signInViaUI`. This project deliberately does NOT use `storageState`:
  the session-lifetime `active_profile` cookie makes persisted state lie about
  fresh-browser semantics (see research.md §Risk #2). Only the onboarding spec
  signs UP through the UI.
- Assert the business outcome (what the user durably sees), not implementation
  details or network response objects. Name every test after the risk it
  protects, and note the risk in the file's provenance header.
- Destructive flows (account deletion) run ONLY against a per-test throwaway
  account; cleanup must tolerate the account already being gone.
- Internal boundaries (auth, routing, DB) stay REAL — that's where integration
  risk hides. This app calls no external APIs from these flows; do not mock.
- Run a single spec with: `npx playwright test e2e/<file> --project=desktop`.
