import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

// Integration tests run against the local Supabase stack. Credentials come from
// `.env.test` (copy `.env.test.example`, fill from `npx supabase status -o env`).
// Loaded here at config time so process.env is populated before any test runs.
loadEnv({ path: ".env.test" });

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The isolation suite provisions/deletes real users; keep files serial and
    // give the DB round-trips room.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
