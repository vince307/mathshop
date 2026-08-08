---
change_id: ai-code-review-ci
title: Wire the stage-1 review agent into GitHub Actions as a merge gate
status: implementing
created: 2026-08-08
updated: 2026-08-08
archived_at: null
---

## Notes

wiring the stage-1 review agent into GitHub Actions as a merge gate, based on @context/changes/ai-code-review-ci/requirements.md

**Known false-positive class (seed for `code-review-evals`):** diff-only review flags "unsynchronized" config (criterion 6) when the referenced files (`review.yml`, `action.yml`, Actions secret) already exist on `main` and are deliberately untouched by the PR — the "absence is evidence" prompt rule cannot see cross-file state outside the diff. Hit live on PR #19 (the gate's own setup PR, blocked twice, landed via documented admin bypass). Remedies parked: PR title/body as model context; eval fixture from PR #19's diff.

**Ops note:** `gh pr edit --add-label` fails on this repo (GraphQL projectCards deprecation) — use `gh api -X POST .../issues/N/labels` instead (what the workflow uses).
