// @ts-check
import { defineConfig, envField } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
  site: "https://matmaverse.ariom.cloud",
  output: "server",
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    server: {
      // Allow Cloudflare quick-tunnel hosts (rotate on each restart)
      allowedHosts: [".trycloudflare.com"],
    },
  },
  // Standalone Node server (dist/server/entry.mjs) in a container on the VPS, behind Caddy (TLS) — Dockerfile.
  adapter: node({ mode: "standalone" }),
  // Caddy reaches the container over plain HTTP on 127.0.0.1:4401 and sends Host/X-Forwarded-Proto/-Host. Astro 6
  // trusts those headers only for hosts listed here; without it the request URL is http://localhost:4401/…, so the
  // CSRF origin check answers 403 to every form POST from https://matmaverse.ariom.cloud and the signup/resend
  // emailRedirectTo (built from the request origin) points at localhost. scripts/check-proxy-origin.mjs (CI) guards both.
  security: {
    allowedDomains: [{ hostname: "matmaverse.ariom.cloud", protocol: "https" }],
  },
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      // HMAC key for the short-lived parent-verified session marker (S-07). Set in
      // the server's env file on the VPS (/opt/apps/matmaverse/.env).
      // Optional so builds without it don't fail; the marker helpers throw / return
      // false only when it's absent (fail closed).
      PARENT_SESSION_SECRET: envField.string({ context: "server", access: "secret", optional: true }),
      // Service-role key (MAT-17) — powers exactly ONE operation: account
      // self-deletion (auth.admin.deleteUser). The most sensitive value in the
      // project: in production it lives only in the server env file
      // (infrastructure.md), never in the browser. Optional so builds without it
      // don't fail; createAdminClient() fails closed (null → route 503).
      SUPABASE_SERVICE_ROLE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      // Bearer secret for /api/keep-alive. Unused since production Supabase is
      // self-hosted on the VPS (no auto-pause): the scheduled keep-alive workflow
      // was removed and nothing calls the route.
      // Optional so builds without it don't fail; the route answers 401 when
      // it's absent (fails closed).
      CRON_SECRET: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
});
