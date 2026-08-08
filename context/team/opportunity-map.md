# Opportunity Map

## Context

- **Project / context**: 10xDevs course project (`~/Dev/10xDevs`, Astro + Supabase) — solo work with AI agents
- **Data constraint**: mock / local / read-only / non-sensitive
- **Date**: 2026-08-06

## Map

| Signal | Existing / default response | Thin complement | First useful version | Data risk | Direction if valuable |
|---|---|---|---|---|---|
| Agent changes merged without systematic review (no review process) | GitHub PR review + branch protection (assumes a second human); generic SaaS reviewers | Review agent returning a structured verdict per diff | Local script `git diff \| npx tsx review.ts` → JSON, tested on past diffs | read-only | Internal tool → **Review / CI gate** |
| No hard "done" criteria (DoD) — merge decision is discretionary | PR templates, checklists (unenforced solo) | Explicit DoD as the agent's scoring rubric (5–6 criteria, anchored 1/10) | DoD markdown + manual checklist on 2–3 next changes | none | Review / CI gate (feeds the agent above) |
| Secrets scattered across files (`.env`, `supabase password.txt`) | `.gitignore` + `.env.example`, Vercel/Supabase secret stores, GitHub secret scanning, gitleaks | — (hygiene, not a missing feature) | One-time cleanup + optional gitleaks step in CI | real secrets — fix immediately | **Wait / no build** — use defaults |
| Tests/e2e run irregularly — regressions surface late | Standard CI (GitHub Actions: vitest + Playwright on PR) | Status check alongside the review gate | Single `.github/workflows/ci.yml` | none (watch test secrets in CI) | CI configuration, not a build |

## Recommended First Candidate

```text
Candidate:      AI code review gate with an explicit Definition of Done
Reads:          git diff (PR vs master) + DoD criteria file (+ optionally plan from context/changes/)
Returns:        structured JSON verdict: 1–10 score per criterion, pass/fail, Markdown summary
Does not do:    no code edits, no merging, does not replace tests (separate CI job),
                no business/architecture-fit judgement (not enough context in a diff)
Data risk:      read-only on own code; keep secrets out of diffs (see signal 3)
Direction:      Review / CI gate — local script → GHA workflow on PR → comment + label → merge gate
```

## Why This Candidate

Repeats on every change (and agents produce many), joins two sources (diff + DoD) and two roles (agent-author vs reviewer), the manual pain is real, it can be tested read-only on historical diffs, and it replaces no platform — GitHub remains the system of record. Clear growth path if it proves valuable. Signal 3 is immediate hygiene, signal 4 closes with one YAML file built alongside the pipeline.

## Next Direction If Valuable

Review / CI gate (10xDevs path A: M5L2 agent on Vercel AI SDK → M5L3 GitHub Actions pipeline with promptfoo evals). Next move chosen by the user: validate assumptions with `/10x-mom-test`, then shape if it survives.
