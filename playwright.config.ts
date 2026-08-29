import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// E2E runs against `npm run dev` (:4321) + the local Supabase stack. Credentials
// come from `.env.test` (same file the vitest suite uses; copy `.env.test.example`,
// fill from `npx supabase status -o env`). Loaded at config time so both the test
// workers (provisioning helpers) and the webServer child inherit them.
loadEnv({ path: ".env.test" });

// Fail fast on harness misconfig — the app is fail-closed (missing env degrades
// to 503s/redirects), so a half-populated .env.test would masquerade as product
// bugs inside journey specs.
for (const name of ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "PARENT_SESSION_SECRET"]) {
  if (!process.env[name]) {
    throw new Error(
      `E2E setup: ${name} is missing. Copy .env.test.example to .env.test and fill from \`npx supabase status -o env\`.`,
    );
  }
}

// Port is overridable so two checkouts/worktrees can run e2e side by side. With
// `reuseExistingServer` on, a dev server left running by another checkout would
// otherwise be silently reused and the suite would test THAT tree, not this one.
//
// Choosing a port EXPLICITLY is therefore also a statement that reuse is unwanted:
// the whole point of E2E_PORT is isolation, and a stale server squatting on the
// chosen port defeats it silently. Landing the follow-up accepted (and never
// landed) in the world-progression-stages review —
// `context/archive/2026-08-22-world-progression-stages/follow-ups/review-fixes.md:115-116`.
const EXPLICIT_PORT = process.env.E2E_PORT !== undefined;
const PORT = process.env.E2E_PORT ?? "4321";
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Precondition probes — fail loudly, before any spec, if a reused dev server is
  // serving Astro's dev toolbar (it occludes the mobile bottom nav) or points at a
  // different Supabase stack than .env.test (see e2e/global-setup.ts).
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  // Per-test throwaway accounts make parallelism safe; cap workers so the shared
  // local Supabase stack and the single dev server stay comfortable.
  workers: 4,
  retries: process.env.CI ? 2 : 0,
  forbidOnly: !!process.env.CI,
  // CI keeps the html report on disk so the failure-artifact step has
  // something to upload (the default CI reporter is `dot`, which writes nothing).
  reporter: process.env.CI ? [["html", { open: "never" }], ["dot"]] : "list",
  use: {
    baseURL: BASE_URL,
    locale: "pl-PL",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Touch/tablet viewport — Chromium-engine preset (NOT an iPad preset; those
      // pin WebKit). Deliberately scoped to the specs whose risk is viewport-shaped
      // (the plan's 2×-runtime decision), not to the whole suite. EXTEND the
      // alternation when adding one (`|worlds`); never replace it.
      //
      // ANCHORED, and that is load-bearing. This alternation used to be an
      // unanchored substring match, so `marketing-worlds.spec.ts` joined this
      // project purely because its name ENDS in `worlds.spec.ts` — coverage
      // acquired by accident, and silently lost to a rename. Same class as L-007,
      // one layer down. `(?:^|\/)` pins the filename to a path segment and `$`
      // pins the end, so a spec runs here because someone listed it and for no
      // other reason. Verify any edit with `npx playwright test --project=touch
      // --list`: dropping a name here does NOT go red, it just quietly runs fewer
      // tests and still exits 0 — the run of 2026-08-27 proved exactly that.
      name: "touch",
      testMatch: /(?:^|\/)(gameplay-restore|growth|worlds|marketing-worlds)\.spec\.ts$/,
      use: { ...devices["Galaxy Tab S4"] },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    // Reuse is a LOCAL convenience only, and it is the reason the `env` block below
    // is not self-enforcing: on the reuse path Playwright returns before it ever
    // launches a process, so NONE of these variables are applied — availability is
    // just an HTTP probe of `url`, which any `npm run dev` satisfies. That is why
    // e2e/global-setup.ts asserts the dev toolbar is actually absent rather than
    // trusting ASTRO_DEV_TOOLBAR_DISABLED to have reached the server.
    //
    // `!EXPLICIT_PORT` closes the worktree half (see EXPLICIT_PORT above); the probe
    // closes the default-:4321 half, which this flag deliberately does NOT cover.
    reuseExistingServer: !process.env.CI && !EXPLICIT_PORT,
    timeout: 120_000,
    env: {
      // The app reads SUPABASE_KEY (anon) via astro:env/server; .env.test carries
      // it as SUPABASE_ANON_KEY — map explicitly for the dev-server child.
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_KEY: process.env.SUPABASE_ANON_KEY ?? "",
      PARENT_SESSION_SECRET: process.env.PARENT_SESSION_SECRET ?? "",
      // Without the service-role key the account-deletion endpoint answers 503.
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      // Astro's dev toolbar is a fixed bottom-centre overlay that intercepts
      // clicks on the mobile bottom nav. Which tab it covers depends on how many
      // tabs there are, so it silently breaks a different test each time the nav
      // grows. Off for the harness only.
      ASTRO_DEV_TOOLBAR_DISABLED: "true",
    },
  },
});
