// @ts-check
import { defineConfig, envField } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import vercel from "@astrojs/vercel";

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    server: {
      // Allow Cloudflare quick-tunnel hosts (rotate on each restart)
      allowedHosts: [".trycloudflare.com"],
    },
  },
  adapter: vercel(),
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      // HMAC key for the short-lived parent-verified session marker (S-07). Set on
      // Vercel Production scope (Preview would fail closed — no marker minting).
      // Optional so builds without it don't fail; the marker helpers throw / return
      // false only when it's absent (fail closed).
      PARENT_SESSION_SECRET: envField.string({ context: "server", access: "secret", optional: true }),
      // Service-role key (MAT-17) — powers exactly ONE operation: account
      // self-deletion (auth.admin.deleteUser). The most sensitive value in the
      // project: Vercel PRODUCTION scope only, never Preview/Development
      // (infrastructure.md), never the browser. Optional so builds without it
      // don't fail; createAdminClient() fails closed (null → route 503).
      SUPABASE_SERVICE_ROLE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
});
