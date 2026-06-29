<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Counting Task in Business Context (S-02)

- **Plan**: context/changes/counting-task-in-business-context/plan.md
- **Scope**: Full plan (Phase 1 + 2 of 2)
- **Date**: 2026-06-29
- **Verdict**: APPROVED (2 low-impact warnings worth a quick fix)
- **Findings**: 0 critical · 2 warnings · 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Automated criteria re-run clean: `check` (0 errors) · `lint` · 12/12 tests · `build`.
Drift agent: full MATCH, zero scope creep, all "NOT Doing" guardrails respected.

## Findings

### F1 — setTimeout redirect not cleaned up on unmount

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Reliability)
- **Location**: src/components/child/CountingTask.tsx:46-48
- **Detail**: The success path calls `window.setTimeout(... href="/app/start", 1400)` inside the click handler with no `clearTimeout` on unmount. If the island unmounts within the 1.4s window (fast nav, dev strict-mode double-invoke), the timer still fires a forced redirect. Low practical risk; leaked-timer pattern.
- **Fix**: Drive the redirect from a `useEffect` keyed on `status === "correct"` returning a `clearTimeout` cleanup, instead of `setTimeout` in the handler.
- **Decision**: FIXED (Fix now — redirect moved to useEffect w/ clearTimeout; 155b74f follow-up)

### F2 — every coin shares the accessible name "Moneta"

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (Accessibility)
- **Location**: src/components/child/CountingTask.tsx:88 (aria-label)
- **Detail**: All coin buttons carry the identical `aria-label` "Moneta". A screen-reader user counting 12 coins hears "Moneta, pressed / Moneta…" with no positional tracking — undercuts the counting interaction for AT users.
- **Fix A ⭐ Recommended**: Add a positional index to the label ("Moneta 1", "Moneta 2"…) via a `{n}`-interpolated i18n key, mirroring the `tally` pattern.
  - Strength: Each coin individually identifiable; stays in i18n; serves the counting goal.
  - Tradeoff: One new key + interpolation at the call site.
  - Confidence: HIGH — same `.replace("{n}", …)` pattern already in the file.
  - Blind spot: Polish form fixed ("Moneta N") — fine here.
- **Fix B**: Leave as-is (decorative-count model).
  - Strength: Zero change; visual tally + aria-live convey total to most users.
  - Tradeoff: AT users can't track which coin is counted.
  - Confidence: MED — acceptable for MVP, but a real a11y gap.
  - Blind spot: No AT user testing done.
- **Decision**: FIXED (Fix A — indexed aria-label "Moneta {n}")

### F3 — coin tap-targets are 56px, under the ~64px child guideline

- **Severity**: OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (Tap-target, prd-v2.md:146)
- **Location**: src/components/child/CountingTask.tsx:83 (size-14)
- **Detail**: Coins are `size-14` (56px) vs ChildButton's `min-h-16` (64px) floor. Mitigated by `gap-4` (16px) non-adjacent spacing; 56px is a deliberate trade-off to fit up to 20 coins in `max-w-md`.
- **Fix**: Bump to `size-16` and let the grid wrap, OR document 56px as an intentional exception.
- **Decision**: FIXED (bump coins to size-16 / 64px)

### F4 — CountingTask dropped the planned *Key fields

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/types.ts:18-21
- **Detail**: Plan listed `promptKey/questionKey/successKey/hintKey`; impl uses the scenario value as the i18n key (`t.task[scenario]`). Cleaner, satisfies the same no-literal-copy intent, documented in-code. Plan said "at least" those fields, so within latitude.
- **Fix**: None — accept as a documented, justified simplification.
- **Decision**: ACCEPTED (justified, documented simplification — no change)

### F5 — sibling start.astro handles a null client differently

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/app/task.astro:18-21 vs src/pages/app/start.astro
- **Detail**: task.astro redirects on null Supabase client (`/auth/signin`); start.astro renders a fallback card. task.astro's redirect is the safer pattern — the divergence is in the older sibling, not here.
- **Fix**: Optionally align start.astro to redirect too (out of this change's scope).
- **Decision**: SKIPPED (out of scope — start.astro alignment deferred)
