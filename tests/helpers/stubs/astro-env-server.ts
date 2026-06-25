// Test stub for the `astro:env/server` virtual module.
//
// The app reads `SUPABASE_URL` / `SUPABASE_KEY` from this module. Under test the
// values come from `.env.test` (loaded by dotenv in `vitest.config.ts`), where
// the app's generic `SUPABASE_KEY` maps to the local **anon** key. A test that
// needs the env-missing / null-client branch overrides this via
// `vi.mock("astro:env/server", () => ({ SUPABASE_URL: undefined, SUPABASE_KEY: undefined }))`.
export const SUPABASE_URL = process.env.SUPABASE_URL;
export const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
