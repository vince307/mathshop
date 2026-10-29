# 10x Astro Starter

![](./public/template.png)

A modern, opinionated starter template for building fast, accessible web applications.

## Tech Stack

- [Astro](https://astro.build/) v6 - Modern web framework with server-first rendering
- [React](https://react.dev/) v19 - UI library for interactive components
- [TypeScript](https://www.typescriptlang.org/) v5 - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) v4 - Utility-first CSS framework
- [Supabase](https://supabase.com/) - Authentication and backend-as-a-service
- [@astrojs/node](https://docs.astro.build/en/guides/integrations-guide/node/) - Standalone Node server, shipped as a Docker image to a VPS

## Prerequisites

- Node.js v22.14.0 (as specified in `.nvmrc`)
- npm (comes with Node.js)

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/przeprogramowani/10x-astro-starter.git
cd 10x-astro-starter
```

2. Install dependencies:

```bash
npm install
```

3. Set up Supabase and configure environment variables — see [Supabase Configuration](#supabase-configuration) below.

4. Run the development server:

```bash
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server (Astro/Node)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint with type-checked rules
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Run Prettier

## Project Structure

```md
.
├── src/
│ ├── layouts/ # Astro layouts
│ ├── pages/ # Astro pages
│ │ └── api/ # API endpoints
│ ├── components/ # UI components (Astro & React)
│ └── assets/ # Static assets
├── public/ # Public assets
```

## Supabase Configuration

This project uses [Supabase](https://supabase.com/) for authentication. Environment variables are declared via Astro's `astro:env` schema and are treated as **server-only secrets** — they are never exposed to the client.

### First-time setup (local, no cloud project needed)

Requires [Docker](https://www.docker.com/) and ~7 GB RAM.

1. Create your `.env` file:

```bash
cp .env.example .env
```

2. Initialize the local Supabase project (creates a `supabase/` config folder):

```bash
npx supabase init
```

3. Start the local stack (downloads Docker images on first run):

```bash
npx supabase start
```

4. Copy the credentials printed by the CLI into your `.env`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key from CLI output>
```

5. Apply the migrations and load the development seed (see below for the credentials it creates):

```bash
npm run db:reset
```

6. To stop the stack when done:

```bash
npx supabase stop
```

The local Studio UI is available at `http://localhost:54323`.

### Seeded local account

`supabase/seed.sql` provisions a ready-to-use account so you never have to sign up by hand after a reset. It is loaded automatically by `npm run db:reset` (and by the first `npx supabase start` on a fresh Docker volume), and can be re-applied on its own with `npm run db:seed` — it deletes and recreates its own rows, so re-running is safe.

| What       | Value                  |
| ---------- | ---------------------- |
| E-mail     | `rodzic@mathshop.test` |
| Password   | `haslo123`             |
| Parent PIN | `1234`                 |

The account owns two child profiles: **Ola** (age 7, Kawiarnia — a fresh, day-one profile) and **Kuba** (age 9, Galaktyczna baza — mid-progression: 120 zł, business level 3, two upgrades owned, and a week of `shift_log` history so the parent report and activity feed render with real data).

**Local only.** The seed writes a known password straight into `auth.users`; never run it against a hosted project.

### Using a cloud Supabase project instead

If you prefer to use a hosted Supabase project, add these variables to your `.env` file:

| Variable       | Description                                                |
| -------------- | ---------------------------------------------------------- |
| `SUPABASE_URL` | Project URL from Supabase dashboard → Settings → API       |
| `SUPABASE_KEY` | `anon` public key from Supabase dashboard → Settings → API |

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<anon-key>
```

### Email confirmation

Local and production diverge deliberately (local in `supabase/config.toml`, production in `ariom-infra`):

- **Local**: `enable_confirmations = false` — users sign in immediately after sign-up; the test suite depends on this. To manually test the email round-trip, flip it to `true`, restart the stack (`npx supabase stop && npx supabase start`), sign up, and read the Polish email in the local test inbox (Mailpit) at <http://localhost:54324>; flip back afterwards.
- **Production**: self-hosted Supabase on the VPS, configured in the `ariom-infra` repo (`server/supabase/matmaverse/compose.yml`: confirmations ON, SMTP from the Hostinger mailbox `hello@ariom.cloud` via `smtp.hostinger.com:465`, site URL and redirect allow-list; credentials in ariom-infra's `/opt/supabase/matmaverse/.env` on the server, never in this repo). GoTrue fetches the Polish templates from `https://matmaverse.ariom.cloud/email-templates/{confirmation,recovery}.html`, which the image serves from `supabase/templates/` (`Dockerfile`), so the templates still ship from this repo with every deploy. There is no `supabase config push` any more.

### Auth routes

| Route                 | Description                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| `/auth/signin`        | Email/password sign-in form                                             |
| `/auth/signup`        | Email/password sign-up form                                             |
| `/auth/confirm-email` | Post-signup "check your inbox" page                                     |
| `/dashboard`          | Example protected page (redirects to `/auth/signin` if unauthenticated) |

Route protection is handled in `src/middleware.ts`. Add paths to the `PROTECTED_ROUTES` array there to require authentication.

## Testing

Tests run on [Vitest](https://vitest.dev/). The current suite is an integration test that proves the per-account data-isolation (RLS) contract — one parent's child profiles must never be readable or writable by another (`tests/child-profiles-isolation.test.ts`).

It needs the **local Supabase stack** running. Running the isolation test:

1. Start the stack: `npx supabase start`
2. Apply migrations to a fresh DB: `npx supabase db reset`
3. Copy the local keys into `.env.test` (copy `.env.test.example` first), mapping `npx supabase status -o env` output:
   - `API_URL` → `SUPABASE_URL`
   - `ANON_KEY` → `SUPABASE_ANON_KEY`
   - `SERVICE_ROLE_KEY` → `SUPABASE_SERVICE_ROLE_KEY`
4. Run the suite: `npm run test`

The local-stack anon/service-role keys are fixed **public demo** JWTs (the same on every machine) — they are not secrets, so CI reads them straight from `supabase status` and `.env.test` is gitignored. Never reuse these keys for any deployed environment.

### E2E tests (Playwright)

Browser-level journey specs live in `e2e/` and run against `npm run dev` (:4321) + the local Supabase stack, reusing `.env.test`. One-time setup: `npx playwright install chromium`. Run with `npm run test:e2e` (or `npm run test:e2e:ui`); conventions and rules are in `e2e/CLAUDE.md`, the cookbook in `context/foundation/test-plan.md` §6.7.

## AI code review (local)

A local review agent (`packages/code-reviewer/`, isolated from the app's dependency tree) scores a git diff against the rubric in `context/team/code-review-dod.md` and emits a JSON verdict. It needs `ANTHROPIC_API_KEY` in `.env` (see `.env.example`).

One-time install (root `node_modules` stays untouched):

```bash
npm --prefix packages/code-reviewer ci
```

Review a branch:

```bash
git diff main...HEAD | npx --prefix packages/code-reviewer tsx packages/code-reviewer/review.ts
```

The verdict JSON lands on stdout; progress, scores, token usage, and cost on stderr. Exit codes: `0` pass, `1` fail, `2` setup or budget error (missing key, empty stdin, diff over 4000 post-strip lines) — never a review verdict. Default model is `claude-haiku-4-5`; override with `--model claude-sonnet-4-6` or the `REVIEW_MODEL` env var.

Prove the gate works (five historical commits, two hard assertions, ~$0.05 on Haiku):

```bash
npm --prefix packages/code-reviewer run fixtures
```

## Deployment

Production runs at **https://matmaverse.ariom.cloud**: a Docker container (`Dockerfile`, `@astrojs/node` standalone,
port 4401) on the owner's VPS behind Caddy, with self-hosted Supabase on the same VPS. The deploy job applies
`supabase/migrations` before the new image goes live. Details, secrets and rollback:
`context/foundation/infrastructure.md` → "Current production: VPS".

Run the production build locally:

```bash
npm run build
HOST=127.0.0.1 PORT=4401 npm run start          # node dist/server/entry.mjs
curl http://127.0.0.1:4401/api/health           # {"status":"ok"}
docker build -t matmaverse:local .              # the production image
```

Deploys are automatic: `.github/workflows/deploy.yml` runs after CI is green on `main`, builds and pushes
`ghcr.io/vince307/matmaverse:<sha>`, and deploys it over Tailscale through the server's `apps-deploy` command (which
health-checks the new container and falls back to the last good image on its own). To redeploy or roll to a given
commit, run the Deploy workflow by hand with its full sha. There are no preview deploys.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and PR to `main`: `astro check`, lint, build, the
Vitest suites against a local Supabase stack, the origin-behind-proxy check (`scripts/check-proxy-origin.mjs` against
the built server), the Playwright e2e suite, and a build of the Docker image. Configure `SUPABASE_URL` and
`SUPABASE_KEY` as repository secrets for the build step.

## License

MIT
