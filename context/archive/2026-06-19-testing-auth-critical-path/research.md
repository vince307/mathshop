---
date: 2026-06-19T22:32:05+0200
researcher: vince307
git_commit: f23d493899dba0e1a6773e6198a1081e5567eef0
branch: main
repository: 10xDevs
topic: "Phase 1 auth critical-path + session gating — grounding Risk #3 and #4 against current code"
tags: [research, codebase, auth, middleware, session-gating, onboarding, test-harness, vitest]
status: complete
last_updated: 2026-06-19
last_updated_by: vince307
---

# Research: Auth critical-path + session gating (test-plan Phase 1)

**Date**: 2026-06-19T22:32:05+0200
**Researcher**: vince307
**Git Commit**: f23d493899dba0e1a6773e6198a1081e5567eef0
**Branch**: main
**Repository**: 10xDevs

## Research Question

Ground test-plan **Phase 1** ("Auth critical-path + session gating") against current code so `/10x-plan` can write a QA spec. Phase 1 covers **Risk #3** (auth/session regression — valid parent logged out, or stale/anonymous session reaches a protected surface; gate fails open) and **Risk #4** (onboarding critical path: sign-up → verification → first-profile creation → start screen). Per the §2 Risk-Response brief, verify: middleware resolution of `context.locals.user`, the `PROTECTED_ROUTES` list, the `@supabase/ssr` cookie/session lifecycle, the signup/signin route contracts + redirect targets + zod schemas, where first-profile insert happens — plus the harness state (vitest config, Supabase test-client helper).

## Summary

Two findings reshape Phase 1 scope and must be settled in planning:

1. **The harness is much more built than test-plan §4 says.** §4 claims "Vitest installed but **no config file yet**." False. `vitest.config.ts` exists and is fully configured (node env, `.env.test` via dotenv, serial files, 30s timeouts); `.env.test` + `.env.test.example` exist with all three DB vars; and CI already spins a trimmed local Supabase, applies migrations, and runs `vitest run` as a **merge gate** (`.github/workflows/ci.yml`). What's actually missing is **request-level Astro scaffolding** (path-alias into Vitest, an `APIContext`/`Request`-with-cookies builder, a middleware harness, and an extracted Supabase test-client helper) — not basic Vitest setup. **§4 and the §3 Phase-1 "harness bootstrap" goal should be corrected to this narrower delta.**

2. **Three of Risk #4's four onboarding legs do not exist in code.** First-profile creation, the email-verification code exchange, and the MathShop start screen are **unbuilt** — they are gaps, not fragile paths, so there is nothing to test there yet. The *real* testable surface for Phase 1 is: middleware gating (Risk #3) + the signup/signin **API-route contracts** (the existing leg of Risk #4). The rest should be recorded as coverage debt that lands with the slices that build them (S-01/S-02), not forced into Phase 1.

A third decision is methodological: Risk #3's §2 anti-pattern explicitly forbids "over-mocking the Supabase client so the test asserts the mock, not the gate." But the middleware/route handlers have **no DI seam** and import Astro virtual modules (`astro:middleware`, `astro:env/server`). So the plan must choose between (a) mocking the Supabase client (fast, but the warned-against anti-pattern for #3) and (b) driving the real handlers against a real local Supabase session (high fidelity, reuses CI infra, but needs the missing request-level scaffolding). See **Open Questions**.

## Detailed Findings

### Risk #3 — Session gating (real, testable code)

**Middleware user resolution.** `src/middleware.ts:6-16` builds the server client and resolves the user with **`supabase.auth.getUser()`** — *not* `getSession()`:

```ts
const supabase = createClient(context.request.headers, context.cookies);
if (supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  context.locals.user = user ?? null;
} else {
  context.locals.user = null;
}
```

`getUser()` revalidates the JWT against GoTrue, so a tampered/stale cookie does not yield a forged user — this is the secure choice and is the part of the gate that needs *real* signal (mocking it asserts nothing). Note: `getUser()` is **not** wrapped in try/catch (`src/middleware.ts:10-13`) — a network throw rejects the request rather than silently authenticating.

**`PROTECTED_ROUTES` gating.** `src/middleware.ts:4` and `:18-22`:

```ts
const PROTECTED_ROUTES = ["/dashboard"];
...
if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
  if (!context.locals.user) {
    return context.redirect("/auth/signin");
  }
}
return next();
```

- Match is **`startsWith`** (prefix), no trailing-slash boundary: `/dashboard`, `/dashboard/*`, **and** `/dashboardXYZ` all gate. Negative-test candidate.
- The gate is **opt-in / fail-open by default**: a new route (e.g. the future play surface) is public unless its prefix is added. Worth a test that asserts the *intended* protected set, so a forgotten addition is caught.
- Anonymous hit → redirect to **`/auth/signin`** (`:20`).
- **No authenticated→auth-page redirect exists** anywhere — a logged-in parent can still load `/auth/signin` and `/auth/signup` (confirmed: those `.astro` pages never read `locals.user`).

**`@supabase/ssr` cookie lifecycle.** `src/lib/supabase.ts:5-24` uses the current **`getAll`/`setAll`** interface (not legacy get/set/remove):

```ts
return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
  cookies: {
    getAll() {
      return parseCookieHeader(requestHeaders.get("Cookie") ?? "").map(({ name, value }) => ({ name, value: value ?? "" }));
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value, options }) => { cookies.set(name, value, options); });
    },
  },
});
```

- No explicit cookie-name config and **no `httpOnly`/`secure`/`sameSite`/`path` hardening** in app code — names default to Supabase's `sb-<ref>-auth-token` scheme (possibly chunked `.0`/`.1`); all flags come from whatever `@supabase/ssr` passes to `setAll`.
- `createClient` **returns `null` when either secret is unset** (`src/lib/supabase.ts:6-8`) — the only fail-closed branch, and it makes the env-missing path deterministically reachable in tests.

**Sign-out.** `src/pages/api/auth/signout.ts:4-10`:

```ts
export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (supabase) { await supabase.auth.signOut(); }
  return context.redirect("/");
};
```

- **POST only**; **missing `export const prerender = false`** (CLAUDE.md requires it on every `src/pages/api/` route — latent risk, regression-note candidate).
- Cookie clearing is **implicit** via `signOut()` → `setAll` expiry; no explicit `cookies.delete`. Chunked cookies are a classic place for a stale fragment to survive.
- **Stale-session bug surface**: if env is missing, `createClient` is `null`, `signOut()` is skipped, and the user is redirected to `/` **with auth cookies intact** — a silent no-op sign-out.

### Risk #4 — Onboarding (mostly unbuilt; one real leg)

**Signup route** `src/pages/api/auth/signup.ts`:
- Reads `email`/`password` from `formData()` (`:5-7`), blind `as string`. **No zod** anywhere in `src/` (confirmed by grep). Server-side validation = none; the only checks are client-side in `SignUpForm.tsx:25-41` (bypassable).
- Calls `supabase.auth.signUp({ email, password })` (`:13`) — **no `options`, so no `emailRedirectTo`**.
- **Redirect-only contract** (never returns JSON): unconfigured → `/auth/signup?error=Supabase is not configured` (`:10-12`); any error (duplicate / weak / malformed all collapse here) → `/auth/signup?error=<encodeURIComponent(error.message)>` (`:15-17`); success → `/auth/confirm-email` (`:19`).

**Signin route** `src/pages/api/auth/signin.ts`: structurally identical — `formData`, no zod, `signInWithPassword` (`:13`), error → `/auth/signin?error=<raw message>` (`:15-17`), **success → `/`** (`:19`, *not* `/dashboard`).

**Email verification — unbuilt.** No `emailRedirectTo` set, **no `/auth/callback`/code-exchange route** exists. `src/pages/auth/confirm-email.astro` is **static informational text** that branches on `import.meta.env.DEV` (`:4`) and links to `/auth/signin` (`:31`); it consumes no code and establishes no session. A "verified" user only gets a session by later POSTing `/api/auth/signin`.

**First-profile creation — does not exist.** `grep child_profiles` matches **only** the migration `supabase/migrations/20260609120000_child_profiles_isolation.sql` — never `src/`. No `.insert(` calls in `src/`, no `src/lib/services/` dir, no profile API route, no profile form component. The table + RLS exist; nothing in the app writes to it.

**Start screen — does not exist.** Signin lands on `/` = `src/pages/index.astro`, which renders the scaffold `<Welcome />` (`:1-9`), identical logged-in/out. `src/pages/dashboard.astro` is the only gated page and is a placeholder (`:7-16`) showing `user.email` + a sign-out form, **unlinked** from `/` or signin. No `/play`, `/shop`, `/start`, `/app`, or onboarding route.

**Polish / no-English-leak.** **Nothing user-visible is Polish yet** (violates FR-013; current ground truth). All static strings and client validation messages are hardcoded English (`SignUpForm.tsx:25-41`, `SignInForm.tsx:20-27`). The real leak point: the server `?error=` value is the **raw Supabase `error.message`** (`signup.ts:16`, `signin.ts:16`) — e.g. "User already registered", "Invalid login credentials" — surfaced verbatim by `ServerError.tsx:7-15` with no mapping layer. This is both an English leak *and* a Supabase-version-coupled brittleness.

### Test-harness state (corrects test-plan §4)

**`vitest.config.ts` exists** (`/Users/kamilp/Dev/10xDevs/vitest.config.ts`):

```ts
loadEnv({ path: ".env.test" });            // :7  dotenv at config-eval time
export default defineConfig({ test: {
  environment: "node",                     // :11  good for route/middleware integration
  include: ["tests/**/*.test.ts"],         // :12
  fileParallelism: false,                  // :15  serial (real-user provisioning)
  testTimeout: 30_000, hookTimeout: 30_000 // :16-17
}});
```
No `setupFiles`, no `globalSetup`, **no `resolve.alias`/`vite-tsconfig-paths`** — so `@/*` is **not** wired into Vitest.

**Reference test** `tests/child-profiles-isolation.test.ts` (187 lines) — the reusable DB/RLS pattern: a service-role **admin** client for provisioning/teardown (`:52-54`), per-account **anon** clients signed in via password (`:71-77`), users created confirmed via `admin.auth.admin.createUser({ email_confirm: true })` (`:62-78`), torn down via `admin.auth.admin.deleteUser` relying on `ON DELETE CASCADE` (`:85-104`). It talks to the local **Supabase gateway** over HTTP (`http://127.0.0.1:54321`), not direct `pg`. It provides **zero** scaffolding for invoking Astro's own request pipeline.

**Env**: test vars are `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (`:36-45`), supplied by `.env.test` (local) or `$GITHUB_ENV` (CI). `.env.test.example` documents the `supabase status -o env` mapping; local anon/service-role keys are fixed public demo JWTs, not secrets. Note the split: `.env.example` (runtime) has only `SUPABASE_URL`/`SUPABASE_KEY` (consumed via `astro:env/server`) — a different concern from the test vars.

**No shared helper exists** — the client construction, `createSignedInUser()`, and `TestAccount` type are all inlined in the single test file. A second test must either duplicate or extract them.

**CI** `.github/workflows/ci.yml` (merge gate on push/PR to `main`): `npm ci` → `astro sync` → lint → build (build needs `SUPABASE_URL`/`SUPABASE_KEY` from GitHub secrets, `:22-24`) → start trimmed Supabase (`:32-35`) → `supabase db reset` to apply migrations (`:38-39`) → export local env into `$GITHUB_ENV` (`:40-50`) → `npm run test` (`:51-52`). `supabase/config.toml` sets `enable_confirmations = false` (`:209`), which is why admin-confirmed users work without an email round-trip.

**Missing for request-level Astro testing** (the true Phase-1 harness delta):
1. `@/*` alias into Vitest (`tsconfig.json:9-11` defines it; `vitest.config.ts` does not mirror it) — route/middleware imports of `@/lib/...` will fail to resolve as-is.
2. An `APIContext` builder (fake `request`, `cookies`, `locals`, `redirect`, `url`).
3. A `Request`-with-cookies builder so middleware can be exercised at request level.
4. A middleware harness to run `onRequest(context, next)` and assert redirects.
5. An extracted Supabase test-client / signed-in-session helper (lift from the isolation test).
6. Handling for the Astro virtual imports `astro:middleware` and `astro:env/server` when importing the real modules into Vitest.

## Code References

- `src/middleware.ts:4` — `PROTECTED_ROUTES = ["/dashboard"]`
- `src/middleware.ts:6-16` — user resolution via `getUser()`, fail-closed on null client
- `src/middleware.ts:18-22` — `startsWith` gate + redirect to `/auth/signin`
- `src/lib/supabase.ts:5-24` — `createServerClient` with `getAll`/`setAll`; returns `null` when secrets unset
- `src/pages/api/auth/signin.ts:5-19` — formData, `signInWithPassword`, success → `/`, error → raw-message redirect
- `src/pages/api/auth/signup.ts:5-19` — formData, `signUp` (no `emailRedirectTo`), success → `/auth/confirm-email`
- `src/pages/api/auth/signout.ts:4-10` — POST-only, implicit cookie clear, env-missing no-op, no `prerender = false`
- `src/pages/auth/confirm-email.astro:4,31` — static text, no code exchange
- `src/pages/index.astro:1-9`, `src/pages/dashboard.astro:7-16` — scaffold landing; placeholder gated page
- `src/components/auth/SignUpForm.tsx:25-41`, `SignInForm.tsx:20-27`, `ServerError.tsx:7-15` — English client strings + raw server-error rendering
- `vitest.config.ts:7-17` — node env, `.env.test`, serial, timeouts; no alias/setup
- `tests/child-profiles-isolation.test.ts:36-104` — reference provisioning/teardown pattern
- `.github/workflows/ci.yml:32-52` — Supabase provisioning + `vitest run` merge gate
- `supabase/config.toml:209` — `enable_confirmations = false`
- `tsconfig.json:9-11` — `@/*` → `./src/*` (not mirrored in Vitest)

## Architecture Insights

- **The gate's security lives in `getUser()`**, a real GoTrue round-trip — so the cheapest *real-signal* test for Risk #3 needs a real session, not a mocked client. Mocking the client tests the mock (the §2 anti-pattern).
- **No DI seam** anywhere: middleware and routes hard-import `createClient` from `@/lib/supabase`, which reads `astro:env/server`. Testability is currently achieved only by module-mocking — which collides with the #3 anti-pattern. A small testability refactor (inject/override the client, or a thin pure gating function) is worth weighing in the plan.
- **The gate is fail-open by default** (opt-in `PROTECTED_ROUTES`). The single most valuable Risk-#3 assertion set: anon → redirect, authed → pass, sign-out → gate re-triggers, *and* a guard on the intended protected set so a future play surface isn't silently public.
- **Risk #4 is a "validation + error-branch + redirect-target" contract test today**, not an end-to-end onboarding test — because verification/profile/start-screen are unbuilt. The durable-state lesson (L-002) still applies: assert the session actually exists after signin (a re-read), not just the redirect Location.
- **The harness already proves the expensive part works** (real local Supabase in CI as a merge gate). Phase 1's harness work is additive scaffolding for the Astro request layer, reusing that infra — not a from-scratch bootstrap.

## Historical Context (from prior changes)

- `context/foundation/lessons.md` **L-001** — every account-owned table ships RLS in the same migration; **L-002** — when testing a blocked write, assert durable state (service-role re-read), not the chained `.select()`/API response (false-green trap). L-002's "assert the durable state" principle transfers directly to Risk #4: after a successful signin, assert a real session/cookie, not just the 302.
- `supabase/migrations/20260609120000_child_profiles_isolation.sql` — the `child_profiles` table + four per-op RLS policies exist; **no app code writes to it** (Foundation F-01 `per-account-isolation-contract`, now archived).
- `docs/reference/rls-isolation.md` / `rls-template.sql` — the isolation contract referenced by test-plan §6.2 (Phase 2 surface, not Phase 1).

## Related Research

- `context/foundation/test-plan.md` §2 (Risk Response for #3/#4), §3 (Phase 1 row), §4 (Stack — **the "no config file yet" line is now stale**), §6.1/§6.3 (cookbook entries this phase fills in).
- `context/changes/network-loss-handling/research.md` — referenced by Risk #2 (Phase 3), not this phase.

## Open Questions (decisions for `/10x-plan`)

1. **Mock vs. real Supabase for Risk #3** — the central methodological call. Recommendation: drive the **real** middleware/handlers against a **real local Supabase session** (reuse CI infra + the isolation test's provisioning pattern, extracted into a shared helper). Mock only the pure-plumbing virtual imports (`astro:middleware` is ~identity; supply real local values for `astro:env/server`). This honors the §2 anti-pattern; pure client-mocking should be a deliberate fallback only if importing the real modules proves infeasible.
2. **Feasibility of importing the real Astro modules into Vitest** — can `src/middleware.ts` / the route handlers be imported under `environment: "node"` given `astro:middleware` and `astro:env/server`? If not cleanly, options are (a) `vi.mock` those two virtual ids, or (b) a tiny testability refactor extracting the gating decision + client creation behind an injectable seam. The plan should resolve this early — it gates everything else.
3. **Phase 1 scope correction** — restrict Risk #4 coverage to the **built** leg (signup/signin route contracts: missing-validation behavior, error branches, redirect targets, configured/unconfigured). Record email-verification exchange, first-profile creation, and start-screen as **coverage debt** tied to S-01/S-02, not Phase-1 tests. Confirm this is acceptable rather than expanding Phase 1 to build-then-test.
4. **Correct test-plan §4 and §3 Phase-1 goal** — §4 "no config file yet" is false; the Phase-1 "harness bootstrap" deliverable is the **request-level scaffolding delta** (alias wiring, `APIContext`/`Request` builders, middleware harness, extracted Supabase helper), not vitest setup. The plan's final sub-phase should update §4, §6.1, and §6.3.
5. **Bonus regressions worth a cheap test** — `signout.ts` missing `prerender = false`; the `startsWith` gate having no boundary (`/dashboardXYZ`); the raw-Supabase-`error.message` English leak through `?error=`. Decide which are in-scope for Phase 1 vs. logged as separate issues.
