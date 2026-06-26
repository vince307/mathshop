---
project: MathShop
researched_at: 2026-05-23
recommended_platform: Vercel
runner_up: Netlify
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6 (SSR) + React 19
  runtime: Node (Vercel Functions)
---

## Recommendation

**Deploy on Vercel.**

Vercel is the developer's recorded deploy target and a platform they already know, and for an Astro 6 SSR app it offers the cleanest Node-compatible runtime — no `workerd` quirks, which matters because MathShop's single highest-risk requirement is per-account data isolation (FR-012/FR-015) and the Cloudflare path puts that risk in the response-cache layer. The chosen trade-off is explicit: the developer ranked cost as the top priority, and Cloudflare wins on cost ($0 vs Vercel's $20/mo), but after seeing the `workerd`/Supabase session-bleed risk against an unfamiliar platform, the developer chose to pay $20/mo Pro to remove that entire risk class and stay on familiar ground for a solo, after-hours, 4-week MVP. This reconciles the divergence flagged in `CLAUDE.md` (scaffold ships Cloudflare; tech-stack records Vercel) **in favor of Vercel** — the scaffold's `@astrojs/cloudflare` adapter must be swapped to `@astrojs/vercel` v10 before any deploy work.

## Platform Comparison

Scored against the five agent-friendly criteria (`references/agent-friendly-criteria.md`). Hard filters applied first: persistent connections are **not** required (interview Q1 = No), so no serverless platform was dropped; the JS/TS runtime is supported everywhere, so no platform was filtered on runtime. All six were scored. Researched 2026-05-23 against current official docs.

| Platform | CLI-first | Managed/Serverless | Agent docs | Stable deploy API | MCP / Integration | Raw total |
|---|---|---|---|---|---|---|
| **Vercel** | Pass | Pass | Pass | Pass | Partial (MCP beta, read-only) | 9/10 |
| **Cloudflare Workers** | Pass | Pass | Pass | Pass | Partial (MCP, no GA label) | 9/10 |
| **Netlify** | Partial (rollback via publish) | Pass | Pass | Pass | Pass (official MCP) | 9/10 |
| **Render** | Pass | Pass | Pass | Pass | Pass (GA MCP) | 10/10 |
| **Railway** | Pass | Pass | Pass | Pass | Partial (MCP WIP) | 9/10 |
| **Fly.io** | Pass | Partial (Dockerfile/containers) | Partial (no llms.txt) | Partial (clunky rollback) | Partial (experimental) | 6/10 |

Per-platform notes:

- **Vercel** — `@astrojs/vercel` v10 (GA, Astro 6 peer) maps SSR routes to Vercel Functions. Full CLI: `vercel deploy`/`--prod`, `vercel rollback`, `vercel logs --follow`. Agent docs via `llms.txt`/`llms-full.txt`/`.md`. MCP is **beta, read-only**. Cost: Hobby is **non-commercial only**, so a real product must be on **Pro $20/mo**; 10k–100k req/mo sits inside Pro's included quotas.
- **Cloudflare Workers** — `@astrojs/cloudflare` v13 (already in the scaffold), Workers-only (Pages deprecated for new Astro projects). `wrangler` v4: `deploy`, `versions upload` (preview), `rollback`, `tail`. Best agent docs (`llms.txt` + "markdown for agents"). **Free tier covers projected traffic at $0** (100k req/**day** free). MCP servers exist but carry no GA/beta label. Risk: `workerd` ≠ Node — `@supabase/ssr` needs `nodejs_compat` + `compatibility_date ≥ 2024-09-23`, the client must be created per-request, and a cached `Set-Cookie` can bleed a session across users.
- **Netlify** — `@astrojs/netlify` v7 (GA), SSR → standard Netlify Functions. CLI deploy/preview/logs are clean; rollback is "Publish Deploy" (UI/API), hence Partial on CLI-first. **Official MCP server (GA-ish, no beta badge)**. Free 300-credit tier may cover the MVP; Pro is $20/mo. Node-compatible — none of the `workerd` quirks.
- **Render** — highest raw score. `@astrojs/node` Web Service (no Dockerfile), official CLI, **GA MCP (20+ tools)**, `llms.txt`. But the free tier spins down → 30–60s cold start (**breaks the ≤3s cold-load NFR**), forcing the **$7/mo Starter**, and it's outside the developer's familiarity set with no advantage over the serverless trio for a stateless app — so it missed the shortlist.
- **Railway** — `@astrojs/node`, Railpack auto-detect (no Dockerfile), `railway up`/`logs`/`redeploy` (no dedicated rollback). `llms-full.txt`. MCP bundled into the CLI ("work in progress"). Always-on container billing ≈ **$9/mo** (no true scale-to-zero by default). EU region = Amsterdam.
- **Fly.io** — cheapest always-on (~$2–4/mo) but **Partial across four criteria**: containers require a Dockerfile (higher ops burden), no `llms.txt`, clunky image-redeploy rollback, experimental MCP. Scale-to-zero cold start (~5s) risks the ≤3s NFR. Lowest fit for an agent-driven MVP.

### Shortlisted Platforms

#### 1. Vercel (Recommended)

Won on the developer's revealed priorities after the cross-check: familiarity (interview Q3) + the cleanest Node-compatible SSR (no `workerd`/Supabase session-bleed risk against the project's #1 correctness requirement) + alignment with the recorded tech-stack decision. The accepted cost: **$20/mo Pro** (Hobby is non-commercial), which loses on the stated cost priority but buys back a whole risk class for a solo after-hours dev on a 4-week clock.

#### 2. Netlify (Runner-up)

The clean fallback if the $20/mo Vercel floor becomes a blocker: same JAMstack-familiar, Node-compatible serverless model (no `workerd` quirks), an **official GA MCP server**, and a **free 300-credit tier** that may cover MVP traffic. The gap vs Vercel: rollback is publish-a-prior-deploy (dashboard/API) rather than a first-class CLI command, and it's a second platform to wire rather than the recorded target.

#### 3. Cloudflare Workers

The cost winner ($0 at projected traffic) and zero-migration (already in the scaffold), with the best agent docs and Astro 6's `workerd`-native `astro dev`. Dropped to third only because its `workerd`/Supabase risks land on MathShop's highest-risk requirement (per-account isolation) and the developer is unfamiliar with the platform — the explicit reason for swapping away during the cross-check. Remains the right choice if cost ever has to dominate again.

## Anti-Bias Cross-Check: Vercel

### Devil's Advocate — Weaknesses

1. **Hobby is non-commercial → $20/mo Pro is the real cost floor.** Vercel's fair-use guidelines bar commercial usage on the free tier; shipping a real product on Hobby risks an enforcement/suspension email. Per-seat if a collaborator is added.
2. **Default function region is US (iad1).** A Polish-only audience + EU Supabase means a transatlantic hop per SSR request unless an EU region (`fra1`/`arn1`) is pinned — directly against the "feels immediate" in-shift NFR.
3. **Cold starts on idle functions** add first-request latency that can breach the ≤3s cold-load NFR for a child's first tap of a session.
4. **`@astrojs/vercel` v10 churn:** removed `/serverless` and `/static` import paths and renamed config keys; Astro's own docs still show the deprecated `serverless` import — an agent copying canonical-looking snippets ships a failing build.
5. **Env-var wiring trap:** deployed functions don't read a local `.env`; secrets set via `vercel env` must reconcile with the project's `astro:env/server` typed schema, or a function 500s on `SUPABASE_URL` undefined.

### Pre-Mortem — How This Could Fail

The team deployed on Vercel because it was familiar and the recorded target. Six months later it was a quiet disaster of a different kind than Cloudflare would have been. First, the bill: they shipped on Hobby to "keep it free," then got a fair-use warning that commercial projects need Pro — $20/mo they'd explicitly wanted to avoid, surfacing at the worst budget moment. Second, latency: nobody changed the default function region, so every SSR render ran from US-East while Polish families and the EU Supabase project sat across the Atlantic; the "feels immediate" in-shift requirement degraded under real home-broadband conditions while the smooth-animation NFR held but the network waits didn't. Third, a routine `@astrojs/vercel` major bump renamed config keys, and the agent — following Astro docs that still referenced the removed `serverless` import — produced a build that failed in CI the night before a demo. None of these were fatal, each was avoidable, and together they eroded trust in the "safe, familiar" choice.

### Unknown Unknowns

- **"Hobby is free" is a trap for a real product** — the non-commercial clause makes the true floor $20/mo Pro. Budget it now, don't learn it from an enforcement email.
- **Default function region is US, not your users'** — pin `fra1`/`arn1` and co-locate Supabase in the EU, or eat a transatlantic round-trip that "works, just slowly" from everywhere.
- **Astro's Vercel docs lag the v10 adapter** (the maxDuration example still imports the removed `/serverless` path) — trust the adapter changelog over tutorial snippets.
- **Fluid compute is default-on and changed the limits** — Hobby max function duration is now 300s; older tables citing 10s/60s are the legacy non-fluid numbers. Don't design around stale timeouts.
- **`astro dev` reads `.env`; deployed functions need `vercel env`** — the gap only shows up after deploy. `vercel dev` exists but isn't needed for most of the loop.

## Operational Story

How Vercel actually operates day to day for this project. One concrete answer per line.

- **Preview deploys**: every `vercel` (no flag) and every push to a non-production branch / PR gets a unique preview URL via the Git integration. Protect previews with Vercel Authentication (Pro feature) so child/parent surfaces aren't publicly reachable pre-launch; fork PRs require explicit opt-in before they can deploy with secrets.
- **Secrets**: env vars live in the Vercel project across three scopes (Production / Preview / Development) and/or GitHub Secrets for the Actions workflow; pull them locally with `vercel env pull`. The Astro side reads them through `astro:env/server` (`SUPABASE_URL`, `SUPABASE_KEY`) — never `import.meta.env`. Rotate by `vercel env rm` + `vercel env add`, then redeploy. The Supabase service key is the most sensitive value — keep it Production-scoped only.
- **Rollback**: `vercel rollback [deployment-url]` reverts production to a prior deploy in seconds (`vercel rollback status` to confirm). Caveat: Supabase schema migrations do **not** roll back with the deploy — a bad migration needs its own down-migration; never couple an irreversible DB change to a deploy you might revert.
- **Approval**: human-gate promotion to production (`vercel --prod`) and rotation of the Supabase service key. An agent may create preview deploys, read logs, and run `vercel env pull` unattended.
- **Logs**: `vercel logs <deployment-url> --follow` for runtime (5-min live cap), `vercel inspect` for build details. The Vercel MCP server (beta, read-only) exposes deploys and logs as structured tools for Claude Code.

## Email Delivery (Supabase Auth)

Researched 2026-06-26 — full 9-provider comparison, no-domain matrix, and sources in `context/changes/parent-signup-first-profile-and-start-screen/research.md` → "Follow-up Research".

Transactional email (parent **email verification**, resend, future password reset) is sent via **Supabase Auth custom SMTP**, not the built-in mailer. Supabase's built-in SMTP only delivers to pre-authorized team addresses and is rate-limited to **2 messages/hour** (explicitly non-production), so a custom SMTP provider is **mandatory before launch**. Enabling custom SMTP raises the default to **30 messages/hour** (adjustable: Auth → Rate Limits).

**Provider decision: Brevo.** For this profile — <1k emails/mo, free-tier preferred, EU data residency + a signable DPA preferred (Polish children's app), and **no sending domain yet** — Brevo is the only provider that satisfies all four at once: free (**300/day**), EU/GDPR with a signable DPA, officially Supabase-listed, **and uniquely able to send to real recipients with zero DNS** (it rewrites `From` → `@brevosend.com` until a domain is authenticated). SMTP settings for the Supabase dashboard: Host `smtp-relay.brevo.com`, Port `587` (STARTTLS), Username = Brevo login, Password = SMTP master key.

**Launch prerequisites (blockers before production verification works):**
- Acquire + authenticate a **sending domain** (SPF + DKIM; DMARC recommended) — needed for the product regardless, and it removes Brevo's `@brevosend.com` From-rewrite + free-tier footer (both hurt parent trust + deliverability).
- Author the **Polish** confirmation/resend email templates in the dashboard (Auth → Email Templates; Supabase has no built-in localization — FR-013). The token_hash confirm route expects a link of the form `{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=signup`.
- Add the prod + preview `/api/auth/confirm` and `/app` URLs to the hosted project's **Redirect URLs** allow-list (local `supabase/config.toml` currently only allows `127.0.0.1:3000`).

**Cheaper steady-state swap (optional, once a domain exists):** **Amazon SES (Frankfurt / eu-central-1)** — ~$0.10/mo at this volume, EU region, AWS DPA — after the one-time sandbox-exit + DKIM work. **Mailjet** if ISO 27701 / SOC 2 certifications become decisive. **Avoid** SendGrid (no real free tier + KYC suspension risk); Resend/Scaleway can't send to real users without a verified domain (reconsider Resend's strong DX once a domain exists).

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Hobby is non-commercial → forced $20/mo Pro; shipping on Hobby risks suspension | Devil's advocate / Unknown unknowns | H | M | Budget Pro $20/mo from day one; never ship the commercial product on Hobby. |
| US default function region adds transatlantic latency for PL users + EU Supabase | Devil's advocate / Pre-mortem / Unknown unknowns | H | M | Pin functions to an EU region (`fra1`/`arn1`) in project settings or `vercel.json`; create the Supabase project in the EU. |
| Cold starts breach ≤3s cold-load / "feels immediate" NFR | Devil's advocate / Pre-mortem | M | M | Keep fluid compute on (default); minimize function bundle size; measure cold-load against the NFR on a preview before launch. |
| `@astrojs/vercel` v10 removed import paths/config keys; Astro docs still show the old `/serverless` import | Devil's advocate / Pre-mortem / Unknown unknowns | M | M | Import from `@astrojs/vercel`; trust the adapter changelog over tutorials; pin the adapter major version. |
| Env-var mis-wire (`vercel env` vs `astro:env/server`) → 500 on undefined `SUPABASE_URL` | Devil's advocate | M | H | Set vars in all three Vercel scopes; verify on a preview deploy before prod; keep the `astro:env` schema as the single typed source of truth. |
| Per-account data isolation leak (RLS) — the project's #1 correctness requirement | Research finding (platform-independent) | M | H | Enforce Supabase RLS with per-operation/per-role policies in the same migration (CLAUDE.md rule). Independent of platform; remains the top correctness item on any host. |
| Adapter divergence unreconciled (scaffold still on Cloudflare) blocks the first deploy | Research finding | H | M | Before any deploy/CI work: swap `astro.config.mjs` to `@astrojs/vercel`, remove `@astrojs/cloudflare`/`wrangler`/`wrangler.jsonc`, update `tech-stack.md` + the CLAUDE.md divergence note. |
| Production email delivery not configured (no SMTP provider/domain/Polish templates) blocks email verification at launch | Research finding (S-01a) | H | H | Wire **Brevo** custom SMTP (EU, free, zero-DNS) for dev; before launch acquire+authenticate a sending domain, author Polish templates, add prod `/api/auth/confirm` + `/app` redirect URLs. See §Email Delivery. |

## Getting Started

Validated against the project's pinned versions (Astro `^6.3.1`, scaffold currently on `@astrojs/cloudflare ^13.5.0` + `wrangler ^4.90.0`) and `@astrojs/vercel` v10 as of 2026-05-23.

1. **Reconcile the adapter divergence first.** Remove the Cloudflare toolchain and add the Vercel adapter:
   - `npm rm @astrojs/cloudflare wrangler`
   - `npx astro add vercel` (installs `@astrojs/vercel` v10 and rewrites `adapter:` in `astro.config.mjs`), or manually change `adapter: cloudflare()` → `adapter: vercel()` and `import vercel from "@astrojs/vercel"`.
   - Delete `wrangler.jsonc` and any Cloudflare-only `.dev.vars` usage; update `tech-stack.md` + the CLAUDE.md "Deployment-target divergence" section to record Vercel as resolved.
2. **Keep the SSR invariants.** Leave `output: "server"` in `astro.config.mjs`, and keep `export const prerender = false` on every `src/pages/api/` route (also required on any SSR-only page).
3. **Install + authenticate the CLI.** `npm i -g vercel` (or use `npx vercel`), then `vercel login`.
4. **Link and pin an EU region.** `vercel link`, then set the Functions region to `fra1` (Frankfurt) or `arn1` (Stockholm) in Project Settings → Functions (or `vercel.json` `"regions": ["fra1"]`) so SSR co-locates with EU users and an EU Supabase project.
5. **Wire secrets in all three scopes.** `vercel env add SUPABASE_URL` and `vercel env add SUPABASE_KEY` for Production, Preview, and Development; `vercel env pull` to mirror them locally. Confirm the app reads them via `astro:env/server`, not `import.meta.env`.
6. **Deploy.** `vercel` for a preview URL, then `vercel --prod` to promote. Local dev stays `astro dev` (no `vercel dev` needed for the normal loop). Roll back with `vercel rollback`; tail with `vercel logs <url> --follow`.

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup (GitHub Actions auto-deploy-on-merge is recorded in `tech-stack.md` but its wiring is a separate step)
- Production-scale architecture (multi-region, HA, DR)
