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

## Why this stack

The 10x Astro Starter bundles the exact stack MathShop needs for v1: Astro 6 as the meta-framework + React 19 for the animation-heavy interactive surfaces, TypeScript for explicit boundary contracts, Tailwind for utility styling, and Supabase for parent-account auth + child-profile persistence — the exact pieces named as preferences during shaping. Vercel is the deployment target (stated preference) rather than the starter's own first default (Cloudflare Pages); both are first-class for this starter. GitHub Actions handles CI with auto-deploy-on-merge for a tight solo-after-hours feedback loop, and the four-week MVP budget fits the starter's "<3-month, shipping-first" fit profile. The starter passes all four agent-friendly quality gates (typed, convention-based, popular in training, well-documented). Scaffolding confidence is first-class: expect a mostly-smooth setup with the occasional manual step (notably configuring Supabase row-level security up front so one parent's child profiles cannot leak into another's — a hard requirement for FR-012 and FR-015).
