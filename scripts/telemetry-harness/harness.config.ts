import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

/**
 * Standalone Playwright config for the telemetry harness.
 *
 * Deliberately separate from `playwright.config.ts`: that config's `testDir` is
 * `./e2e`, and the harness must NOT be picked up by `npm run test:e2e`. It seeds
 * accounts it never deletes (the rows are the deliverable), which is correct
 * here and would be a defect in the test suite.
 *
 * Same env contract as the e2e config — `.env.test`, the local Supabase stack,
 * and `npm run dev` on :4321.
 */
loadEnv({ path: ".env.test" });

for (const name of ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "PARENT_SESSION_SECRET"]) {
  if (!process.env[name]) {
    throw new Error(
      `harness: ${name} is missing. Copy .env.test.example to .env.test and fill from \`npx supabase status -o env\`.`,
    );
  }
}

const PORT = process.env.E2E_PORT ?? "4321";
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: ".",
  // Reuses the e2e backend-identity probe: without it a dev server started from
  // `.env` instead of `.env.test` would silently write telemetry into a
  // different Supabase stack than the one report.sql reads.
  globalSetup: "../../e2e/global-setup.ts",
  fullyParallel: true,
  // One worker per cohort. Each persona drives its own browser through ~20
  // shifts; more workers than this starves the single dev server and the shared
  // local Supabase stack, which shows up as flaky navigation, not as speed.
  workers: 3,
  // A retry would replay a persona's shifts into the SAME account and double-count
  // its rows. Data generation must not retry.
  retries: 0,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    locale: "pl-PL",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
