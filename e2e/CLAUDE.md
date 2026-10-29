# E2E Testing Rules (Playwright)

These rules govern every spec in `e2e/`. They exist so generated tests are
stable by default — model new specs on `seed.spec.ts` (the exemplar) and follow
the plan/research in `context/archive/2026-07-12-testing-e2e-playwright/`.

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
  4. The computed-style walk in `growth.spec.ts`'s nav-fit assertion
     (`[el, ...el.querySelectorAll("*")]`, Risk E2E-F4-2). It MEASURES a label
     against its tab, starting from an element `getByRole` located; the
     descendant is picked by computed style (`text-overflow: ellipsis` +
     `white-space: nowrap` + hidden overflow), never by tag, class or position,
     so reparenting or restyling the span cannot silently break it.
     **The line this draws:** measurement reached from a role-located element is
     allowed; structural SELECTION is still banned. `querySelectorAll` is not a
     licence to locate — if you are choosing an element by what it IS rather than
     reading a number off it, this exception does not cover you.
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

## Workflow and tooling boundaries

**Use the `/10x-e2e` skill** — it is the single source of truth for the workflow
(risk → seed test + rules → generate → review against the five anti-patterns →
re-prompt → verify). Its `references/` carry the full rules, anti-patterns, seed
pattern, and prompt-template. The rules above are the hard constraints that hold
even before you invoke it.

- **DOM (snapshot) is the default.** Vision (`--caps=vision`) is a supplement for
  visual-only risks (layout, z-index, animation); for pixel regression prefer
  deterministic tools (`toMatchSnapshot`, Argos, Lost Pixel).
- **Healer helps on selectors, harms on logic.** A changed selector → healer
  re-finds it (route through PR review). A changed business behavior → healer
  masks the bug, so a failing test there is a finding, not a thing to auto-fix.
