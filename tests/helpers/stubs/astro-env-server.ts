// Test stub for the `astro:env/server` virtual module.
//
// The app reads `SUPABASE_URL` / `SUPABASE_KEY` from this module. Under test the
// values come from `.env.test` (loaded by dotenv in `vitest.config.ts`), where
// the app's generic `SUPABASE_KEY` maps to the local **anon** key. A test that
// needs the env-missing / null-client branch overrides this via
// `vi.mock("astro:env/server", () => ({ SUPABASE_URL: undefined, SUPABASE_KEY: undefined }))`.
export const SUPABASE_URL = process.env.SUPABASE_URL;
export const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
// HMAC key for the parent-verified session marker (S-07). From `.env.test`.
export const PARENT_SESSION_SECRET = process.env.PARENT_SESSION_SECRET;
// Service-role key (MAT-17 account deletion). Local-stack demo key from `.env.test`.
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Bearer secret for the keep-alive cron route. Not in `.env.test` — the route's
// suite mocks this module per-scenario (`tests/keep-alive.test.ts`).
export const CRON_SECRET = process.env.CRON_SECRET;
