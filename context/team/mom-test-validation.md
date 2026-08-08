# Mom Test Validation Plan

## Input Idea

AI code review gate with an explicit Definition of Done (candidate from `context/team/opportunity-map.md`): agent reviews each PR diff against DoD criteria, returns a structured verdict, eventually gates merges in CI. Solo context — the builder is also the target user, so validation ran as a behavioral self-audit interview instead of external interviews.

## Hypotheses

- **User/role**: solo developer driving AI agents on the 10xDevs course project (later: any team in the same situation).
- **Friction**: agent-authored changes reach master without enforced review or hard criteria; regressions surface late.
- **Current workaround**: `/code-review` run manually in the harness (Claude Code) — discretionary, not enforced; no CI running tests on PR.
- **Risky assumptions**: (1) regressions stem from missing review rather than missing CI tests; (2) verdicts will actually be read, not merged past; (3) AI review catches the class of bugs that hurt; (4) gate maintenance cost < cost of fixing after the fact.
- **Evidence already present** (from the self-audit, 2026-08-07):
  - Last regression: a configuration issue took down the whole app — **~2h downtime**. Reviewer, CI test, or usage would each have caught it.
  - **5/5 recent merges** went in on trust — no human diff inspection.
  - Frequency: ~1 broken-master incident in the last month.
  - Workaround exists (`/code-review` locally) but is optional and inconsistently applied.

## Critique

- "No code review" is half solution-framing; the base problem is "errors surface late and cost real downtime". The audit sharpened it further: review *exists* but is **unenforced** — the missing piece is a non-skippable gate, not another optional tool.
- Cheapest-fix ladder check: the last incident (config issue) would also have been caught by plain CI tests, which don't exist yet. A tests-on-PR workflow is floor 1; the AI review gate is floor 2. Building floor 2 without floor 1 would overweight the fancy part.
- Existing-good-enough check: GitHub branch protection + required status checks are the enforcement mechanism — the build should plug into them, not reinvent them.
- Honest caveat: incident frequency is low (~1/month), but severity is high (hours of downtime) and change volume from agents is growing. Educational value (M5L2–L3, 10xChampion) is real but was kept separate from the problem verdict.

## Interview Guide

(Compressed to a self-audit; questions asked and answered in-conversation.)

1. Walk through the last regression that reached production — what, how long to find, cost? → config issue, 2h downtime.
2. Would review/CI/tests have caught it? → yes, all of the above.
3. Of the last 5 merges, how many diffs did you inspect? → 0; all on trust.
4. Broken-master frequency last month? → ~1 incident.
5. Actual ritual between "agent done" and "git push"? → run review in the harness.
6. Prior attempts and why they didn't stick? → local `/code-review`; exists but discretionary, nothing enforces it.

Optional follow-ups for future team interviews: same questions 1–6 aimed at teammates' recent incidents and workarounds.

## Survey

(Optional — for broader signal from the course community / future teammates; 8 questions.)

1. Screener: do you merge AI-agent-authored changes into a shared branch at least weekly? (yes/no)
2. In the last month, how many times did a broken change reach your main branch? (0 / 1 / 2–4 / 5+)
3. Last time it happened, what caught it? (CI / human review / users / monitoring / other)
4. What did the last incident cost? (nothing / <1h / 1–4h / a day+ / customer impact)
5. Of your last 5 merges, how many diffs did a human read end-to-end? (0–5)
6. Do you run any AI review today? (no / manually, sometimes / manually, always / automated in CI)
7. What stops you from reviewing consistently? (open)
8. Describe the most recent change you merged on trust and why. (open)

## Decision Criteria

- **Proceed**: pain recurs with real cost (≥1 incident/month, hours-level impact) AND the manual workaround is demonstrably skipped under normal conditions. **Met**: 2h downtime incident, 5/5 merges unreviewed despite the workaround existing.
- **Narrow scope**: build as a thin PR pipeline — phase 1: CI running tests on PR (floor); phase 2: AI review job with DoD verdict; enforcement via existing branch protection / required checks. Skip for now: plan-adherence review, business/architecture fit, multi-repo distribution.
- **Do not build yet**: if all recent incidents were catchable by plain tests alone and review adds no marginal catch — partially true for the last incident, hence tests-first ordering inside the same pipeline.
- **Try existing tool/process first**: branch protection + required status checks are adopted as the enforcement layer, not rebuilt; local `/code-review` remains the pre-push habit but is no longer the safety net.

## Verdict

**GO — with tests-first ordering.** The problem survived contact with past behavior: real cost, honest evidence that optional review does not happen. Proceed to build (M5L2 → M5L3): the pipeline's first job is plain CI tests, the second is the AI review gate with DoD. `/10x-shape` is optional here — the scope is already narrow and M5L2/M5L3 provide the build path.
