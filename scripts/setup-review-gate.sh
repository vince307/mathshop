#!/usr/bin/env bash
# One-time (re-runnable) setup for the AI review merge gate — the reproducible
# record of the enforcement config. Requires: gh authenticated with admin on
# the repo. Safe to re-run: label creation is --force, the protection PUT is
# last-write-wins.
#
# Verification (the script performs step 1 itself at the end; 2-3 are manual):
#   1. `gh api repos/<repo>/branches/main/protection` shows contexts
#      ["ci","e2e","review"], strict=false, enforce_admins=false.
#   2. GitHub Settings -> Branches shows the rule on main; an open PR's merge
#      box lists all three required checks.
#   3. A PR with a failing `review` check reports mergeStateStatus=BLOCKED.
# Rollback: `gh api -X DELETE repos/<repo>/branches/main/protection`.
#
# Consumed by: .github/workflows/review.yml (the gate this script enforces);
# the ANTHROPIC_API_KEY Actions secret must exist for that workflow to run.
# Context: context/changes/ai-code-review-ci/ (stage 2 of ai-code-review).
set -euo pipefail

REPO="${1:-vince307/mathshop}"

echo "== Labels (ai-cr:*) on $REPO =="
gh label create "ai-cr:review" --repo "$REPO" --color 0075ca \
  --description "Re-run the AI review on this PR" --force
gh label create "ai-cr:passed" --repo "$REPO" --color 1a7f37 \
  --description "AI review verdict: pass" --force
gh label create "ai-cr:failed" --repo "$REPO" --color d73a4a \
  --description "AI review verdict: fail" --force

echo "== Branch protection on main =="
# The PUT below REPLACES the whole protection object: any setting configured
# outside this script (linear history, force-push blocks, extra contexts, ...)
# is reset by a re-run. Show the current state first so a re-run is a
# deliberate overwrite, not a silent one.
echo "-- Current protection (about to be replaced):"
gh api "repos/$REPO/branches/main/protection" --jq . 2>/dev/null \
  || echo "(none — branch not protected yet)"
# Solo-repo constraints, deliberately:
# - required_pull_request_reviews: null — the author cannot approve their own
#   PR; requiring approvals would deadlock every merge.
# - enforce_admins: false — admin bypass stays possible; the gate's job is to
#   make skipping a deliberate act, not impossible (requirements.md).
# - strict: false — no update-branch-before-merge friction for a solo flow.
gh api -X PUT "repos/$REPO/branches/main/protection" --input - <<'JSON'
{
  "required_status_checks": { "strict": false, "contexts": ["ci", "e2e", "review"] },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null
}
JSON

echo "== Verify =="
gh api "repos/$REPO/branches/main/protection" \
  --jq '{contexts: .required_status_checks.contexts, strict: .required_status_checks.strict, enforce_admins: .enforce_admins.enabled}'
echo "Done. Required checks on main: ci, e2e, review."
