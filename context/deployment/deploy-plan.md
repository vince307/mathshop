# MathShop — Deployment Record

> Persisted hand-off from the first **Plan Mode deploy** (lesson Module 1, L5). Source of the decision: `@context/foundation/infrastructure.md`; stack: `@context/foundation/tech-stack.md`.

## Status — Git → GitHub → Vercel integration wired · 2026-06-07

- **Platform:** Vercel (Hobby) · scope `kamilps-projects` · project **`mathshop`**
- **Adapter:** `@astrojs/vercel@10.0.7` · Astro 6 SSR (`output: "server"`)
- **Public URL:** https://mathshop.vercel.app → **HTTP 200**
- **Deployment target:** `production` (current deployment id: `dpl_C2UPURzQzUd5Ngw4FtmymwGgXzpW`; first deploy was `dpl_B2hYavrnMpu5JMMMvKvct1mNRYdp` on 2026-05-23)
- **SSR function `_render` region:** **`fra1`** (Frankfurt) — pinned via `vercel.json`
- **Supabase project:** `mathshop` · ref `hozkukbsfdcrbszgdxbg` · region **Central EU (Frankfurt = `eu-central-1`)** — co-located with `fra1`
  - URL: https://hozkukbsfdcrbszgdxbg.supabase.co
  - Dashboard: https://supabase.com/dashboard/project/hozkukbsfdcrbszgdxbg
  - Org: `vercel_icfg_jMPTVYTZyA3CsULluZMdHQl1` (Vercel-Supabase marketplace integration org)
  - DB password: stored locally by the developer (Supabase doesn't retain it after creation)

### Aliases
| Alias | Anon access |
|---|---|
| https://mathshop.vercel.app | **200 (public)** |
| https://mathshop-kamilps-projects.vercel.app | 401 (Vercel Deployment Protection) |
| https://mathshop-vince307-1297-kamilps-projects.vercel.app | 401 (Vercel Deployment Protection) |

## Verification (2026-06-06 — Supabase wired)

| Route | Result |
|---|---|
| `GET /` | 200 |
| `GET /dashboard` | 302 → `/auth/signin` (middleware gate works) |
| `GET /auth/signin` | 200 |
| `GET /auth/signup` | 200 |

`x-vercel-id: arn1::fra1::…` confirms edge → **fra1** function routing. Supabase env is reaching the function — `createServerClient` doesn't throw, so `/` 200 is **positive evidence** that `SUPABASE_URL`/`SUPABASE_KEY` are wired correctly (a missing/malformed URL would surface as a 500, not a 200, since the client now constructs unconditionally).

### Smoke-test baseline (2026-05-23, no backend) — preserved for traceability

Initial deploy verified Astro 6 SSR runs on Vercel, EU region pinned, and the null-Supabase guard works (no 500s with env unset). That guard is now dormant since secrets are present.

## Repo config backing this deploy

- `astro.config.mjs` — `adapter: vercel()` (`@astrojs/vercel` v10), `output: "server"`
- `vercel.json` — `{ "regions": ["fra1"] }`
- `.gitignore` — ignores `.vercel`, `.env`, `supabase password.txt`, `.wrangler/` (legacy)
- `.vercel/project.json` — links cwd to `kamilps-projects/mathshop`

## Git integration (2026-06-07)

- **Repo:** https://github.com/vince307/mathshop · **PRIVATE** · default branch `main`
- **Owner:** `vince307` · remote `origin` uses SSH (`git@github.com:vince307/mathshop.git`)
- **Initial commit:** `7de02bc` — "chore: bootstrap MathShop scaffold" (Conventional Commits convention established)
- **Vercel ↔ GitHub:** connected (`vercel git connect` confirmed *"vince307/mathshop is already connected"*). From now on:
  - push to a non-`main` branch / open a PR → **preview deploy** with a unique URL
  - merge to `main` → **production deploy** to `mathshop.vercel.app`
  - `vercel deploy` from CLI continues to work; with Git connected, deploys are linked back to commit SHAs
- **GitHub Actions CI** (`.github/workflows/ci.yml`): runs `lint` + `build` on push/PR to `main`; secrets configured at the repo level:
  | Secret | Source |
  |---|---|
  | `SUPABASE_URL` | same as Vercel env |
  | `SUPABASE_KEY` | same as Vercel env (anon public) |
- **`master` → `main`:** ci.yml branch targets updated from the scaffold's `master` to the modern `main`.

## Deviation from the approved plan

The plan scoped a **preview**; the CLI deployed to **production**. Cause: the project has **no Git connection**, and Vercel defaults a no-Git `vercel deploy` to production. Harmless for an empty smoke-test app (no real content, no Supabase, no users, no custom domain), but the "human-gate production" intent was bypassed. **Resolved 2026-05-23 (user decision): keep this as the production baseline** — it becomes the real production once Supabase is wired and we redeploy. To restore real preview/prod separation, set up Git → Vercel integration (see follow-ups) so future `vercel deploy` creates previews and only merges-to-main publish production.

## Secrets wired (Vercel project `mathshop`)

| Variable | Production | Preview | Development |
|---|---|---|---|
| `SUPABASE_URL` | ✅ Encrypted | ✅ Encrypted | ✅ Encrypted |
| `SUPABASE_KEY` | ✅ Encrypted | ✅ Encrypted | ✅ Encrypted |

`SUPABASE_KEY` = Supabase **anon public** key (`@supabase/ssr` `createServerClient` uses anon + cookie sessions; **never** put the `service_role` key here — it bypasses RLS).

Local mirror: `vercel env pull --environment=development .env` produced a gitignored `.env` with the same values plus a Vercel-managed `VERCEL_OIDC_TOKEN` (harmless for this app; provided automatically by Vercel for OIDC-based integrations).

## Explicitly deferred (not done yet)

- **Vercel Pro** upgrade (Hobby is non-commercial; required before a public commercial launch).
- Custom domain.
- End-to-end auth flow check with a real sign-up (Supabase **email confirmation is on by default**, so a brand-new sign-up redirects to "check your inbox" rather than logging in directly — that's correct behavior; turn it off in Supabase → Authentication → Email if undesired for local testing).
- First Supabase migration (`supabase/migrations/`) for the parent-account/child-profile schema. **The moment any table is added, RLS policies (per-operation, per-role) must land in the same migration** — the project's #1 correctness requirement per `CLAUDE.md` (FR-012/FR-015).
- Local cleanup: delete the on-disk `.wrangler/` cache (gitignored, but no longer needed) and consider moving `supabase password.txt` into a password manager (also gitignored).
- Smoke-test the preview pipeline: push a throwaway branch (e.g. `chore/preview-smoke`) to confirm Vercel creates a preview URL and comments it on a PR.

## Follow-up commands (next session)

```bash
# 1. First migration — must include RLS policies for any table added
npx supabase link --project-ref hozkukbsfdcrbszgdxbg     # link the local CLI to the hosted project
npx supabase migration new <name>                        # author the migration + RLS in the same file
npx supabase db push                                     # apply to the hosted project

# 2. Smoke-test the preview pipeline (any throwaway change works)
git checkout -b chore/preview-smoke
# ... make a trivial edit ...
git commit -am "chore: trigger preview"
git push -u origin chore/preview-smoke
gh pr create --fill                                      # Vercel should comment the preview URL on the PR
```

## Ops quick-reference

- **Rollback:** `vercel rollback <deployment-url>` (or `vercel redeploy <url>`)
- **Logs:** `vercel logs <url>`
- **Remove this deployment:** `vercel remove mathshop --yes`
- **Promote a preview to prod (later):** `vercel --prod`
