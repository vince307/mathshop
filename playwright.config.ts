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

const BASE_URL = "http://localhost:4321";

export default defineConfig({
  testDir: "./e2e",
  // Backend-identity probe — fails loudly if a reused dev server points at a
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
      // pin WebKit). Scoped to the gameplay spec per the plan's 2×-runtime decision.
      name: "touch",
      testMatch: /gameplay-restore\.spec\.ts/,
      use: { ...devices["Galaxy Tab S4"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // The app reads SUPABASE_KEY (anon) via astro:env/server; .env.test carries
      // it as SUPABASE_ANON_KEY — map explicitly for the dev-server child.
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_KEY: process.env.SUPABASE_ANON_KEY ?? "",
      PARENT_SESSION_SECRET: process.env.PARENT_SESSION_SECRET ?? "",
      // Without the service-role key the account-deletion endpoint answers 503.
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  },
});
