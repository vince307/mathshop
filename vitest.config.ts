import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

// Integration tests run against the local Supabase stack. Credentials come from
// `.env.test` (copy `.env.test.example`, fill from `npx supabase status -o env`).
// Loaded here at config time so process.env is populated before any test runs.
loadEnv({ path: ".env.test" });

export default defineConfig({
  server: {
    host: true,
    allowedHosts: ["*.trycloudflare.com", ".trycloudflare.com"], // lub true, żeby wpuszczać wszystko
  },
  resolve: {
    alias: {
      // Mirror the tsconfig `@/*` → `./src/*` path alias so route/middleware
      // imports of `@/lib/...` resolve under Vitest (tsconfig paths are not
      // applied automatically).
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Astro virtual modules don't exist outside the Astro build. Stub them so
      // the real `src/middleware.ts` and route handlers import under node-env
      // Vitest without a production-code change. Individual tests can still
      // `vi.mock("astro:env/server", …)` to force the env-missing branch.
      "astro:middleware": fileURLToPath(new URL("./tests/helpers/stubs/astro-middleware.ts", import.meta.url)),
      "astro:env/server": fileURLToPath(new URL("./tests/helpers/stubs/astro-env-server.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The isolation + auth suites provision/delete real users; keep files serial
    // and give the DB round-trips room.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
