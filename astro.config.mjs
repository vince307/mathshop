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
      // Vercel (Production + Preview). Optional so builds without it don't fail;
      // the marker helpers fall back to an empty key only when it's absent.
      PARENT_SESSION_SECRET: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
});
