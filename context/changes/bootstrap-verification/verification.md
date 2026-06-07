---
bootstrapped_at: 2026-05-21T23:11:00Z
starter_id: 10x-astro-starter
starter_name: 10x Astro Starter (Astro + Supabase + Cloudflare)
project_name: mathshop
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

Verbatim copy of `context/foundation/tech-stack.md` at scaffold time:

```yaml
---
starter_id: 10x-astro-starter
package_manager: npm
project_name: mathshop
hints:
  language_family: js
  team_size: solo
  deployment_target: vercel
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---
```

### Why this stack (from hand-off body)

The 10x Astro Starter bundles the exact stack MathShop needs for v1: Astro 6 as the meta-framework + React 19 for the animation-heavy interactive surfaces, TypeScript for explicit boundary contracts, Tailwind for utility styling, and Supabase for parent-account auth + child-profile persistence — the exact pieces named as preferences during shaping. Vercel is the deployment target (stated preference) rather than the starter's own first default (Cloudflare Pages); both are first-class for this starter. GitHub Actions handles CI with auto-deploy-on-merge for a tight solo-after-hours feedback loop, and the four-week MVP budget fits the starter's "<3-month, shipping-first" fit profile. The starter passes all four agent-friendly quality gates (typed, convention-based, popular in training, well-documented). Scaffolding confidence is first-class: expect a mostly-smooth setup with the occasional manual step (notably configuring Supabase row-level security up front so one parent's child profiles cannot leak into another's — a hard requirement for FR-012 and FR-015).

## Pre-scaffold verification

| Signal             | Value                                                                  | Severity | Notes                                                                                  |
| ------------------ | ---------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| npm package        | not run                                                                | n/a      | cmd_template starts with `git clone`; there is no `create-*` npm CLI to recency-check  |
| GitHub repo        | przeprogramowani/10x-astro-starter last pushed 2026-05-17               | fresh    | 4 days before scaffold (today: 2026-05-21); from card.docs_url; pushed_at via gh api   |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 22 items (18 files + 4 directories: `.env.example`, `.github/`, `.gitignore`, `.husky/`, `.nvmrc`, `.prettierrc.json`, `.vscode/`, `astro.config.mjs`, `CLAUDE.md.scaffold` (renamed from starter's CLAUDE.md), `components.json`, `eslint.config.js`, `node_modules/`, `package-lock.json`, `package.json`, `public/`, `README.md`, `src/`, `supabase/`, `tsconfig.json`, `wrangler.jsonc`)
**Conflicts (.scaffold siblings)**: `CLAUDE.md` (cwd's 7775-byte course/project CLAUDE.md preserved; starter's 3164-byte version landed as `CLAUDE.md.scaffold` for diff/inspection)
**.gitignore handling**: moved silently — cwd had no `.gitignore` before scaffolding
**.bootstrap-scaffold cleanup**: PARTIAL — directory retained because the `rm -rf .bootstrap-scaffold/.git/` step was denied by the harness permission system. Only the cloned `.git/` remains in `.bootstrap-scaffold/`; all other files moved up cleanly. Manual follow-up: `rm -rf .bootstrap-scaffold/` removes the leftover (it carries the starter's upstream git history, which is not wanted for the user's repo).

npm install (chained into the cmd_template) ran cleanly and added 774 packages in ~12s. npm itself flagged 10 vulnerabilities at install time — full breakdown in `## Post-scaffold audit` below.

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 1 HIGH, 9 MODERATE, 0 LOW
**Direct vs transitive**: 0/0/2/0 direct of total 0/1/9/0 (the 1 HIGH and 7 of the 9 MODERATE findings are transitive; only 2 MODERATE findings are on directly-declared dependencies)

#### CRITICAL findings

None.

#### HIGH findings

- **devalue** (transitive) — Svelte devalue: DoS via sparse array deserialization. Advisory: [GHSA-77vg-94rm-hx3p](https://github.com/advisories/GHSA-77vg-94rm-hx3p). CVSS 7.5 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H). Affected range: 5.6.3 – 5.8.0. Fix available via the upstream upgrade chain (run `npm audit fix` and verify; major-version upgrade may be required on a parent package). Reaches the project transitively (one of Astro/Cloudflare/Supabase's deep deps pulls it).

#### MODERATE findings

- **@astrojs/check** (direct) — pulled via `@astrojs/language-server`. Fix is semver-major (recommended fix downgrades to 0.9.2). Editor / IDE-only impact; runtime is unaffected. Range: ≥ 0.9.3.
- **@astrojs/language-server** (transitive) — pulled via `volar-service-yaml`. Same editor/IDE scope as above. Range: ≥ 2.14.0.
- **@cloudflare/vite-plugin** (transitive) — pulled via `miniflare`, `wrangler`, `ws`. Fix available. Range: ≤ 0.0.0-fff677e35 || 0.0.7 – 1.37.2.
- **miniflare** (transitive) — pulled via `ws`. Fix available. Range: ≤ 0.0.0-fff677e35 || 3.20250204.0 – 4.20260518.0.
- **volar-service-yaml** (transitive) — pulled via `yaml-language-server`. Range: ≤ 0.0.70.
- **wrangler** (direct) — pulled via `miniflare`. Fix available. Range: ≤ 0.0.0-kickoff-demo || 3.108.0 – 4.93.0.
- **ws** (transitive) — Uninitialized memory disclosure. Advisory: [GHSA-58qx-3vcg-4xpx](https://github.com/advisories/GHSA-58qx-3vcg-4xpx). CVSS 4.4. Affected range: 8.0.0 – 8.20.0. Fix available. Two copies in the tree: one under `@supabase/realtime-js/node_modules/ws` and one at `node_modules/ws`.
- **yaml** (transitive) — Stack Overflow via deeply nested YAML collections. Advisory: [GHSA-48c2-rrv3-qjmp](https://github.com/advisories/GHSA-48c2-rrv3-qjmp). CVSS 4.3. Affected range: 2.0.0 – 2.8.2. Fix available.
- **yaml-language-server** (transitive) — pulled via `yaml`. Editor / IDE scope; runtime unaffected. Fix available.

#### LOW / INFO findings

None.

#### Suggested next action

Most of the MODERATE findings are editor/IDE tooling (`@astrojs/check`, `@astrojs/language-server`, `volar-service-yaml`, `yaml-language-server`) or Cloudflare-only deps (`@cloudflare/vite-plugin`, `miniflare`, `wrangler`) — note that the user's deployment target is **Vercel**, so the Cloudflare-side findings have no production impact for this project and are candidates for removal once you've fully decided not to deploy via Cloudflare. The HIGH `devalue` finding is runtime-reachable and worth addressing first — try `npm audit fix` (non-major) and re-audit; if it remains, escalate to `npm audit fix --force` after backing up `package.json` and `package-lock.json`. None of this is gating, but the audit-trail recommends starting here.

## Hints recorded but not acted on

| Hint                       | Value                              |
| -------------------------- | ---------------------------------- |
| bootstrapper_confidence    | first-class                        |
| quality_override           | false                              |
| path_taken                 | standard                           |
| self_check_answers         | null                               |
| team_size                  | solo                               |
| deployment_target          | vercel                             |
| ci_provider                | github-actions                     |
| ci_default_flow            | auto-deploy-on-merge               |
| has_auth                   | true                               |
| has_payments               | false                              |
| has_realtime               | false                              |
| has_ai                     | false                              |
| has_background_jobs        | false                              |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- `rm -rf .bootstrap-scaffold/` to remove the leftover containing the starter's upstream git history (see scaffold log above).
- Review `CLAUDE.md.scaffold` against your existing `CLAUDE.md` and decide which version of each section to keep (or merge the starter's Astro/Supabase guidance into your project's instructions).
- Address the HIGH `devalue` finding first via `npm audit fix`; re-audit; decide what to do about the remaining MODERATE findings based on whether you keep or remove the Cloudflare-side dependencies (given Vercel is the chosen deployment target).
- Configure Supabase row-level security up front — per the hand-off `## Why this stack` note, this is load-bearing for FR-012 / FR-015 (parent-account isolation of child profiles).
