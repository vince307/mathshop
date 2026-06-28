<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: MatmaVerse Design System

- **Plan**: context/changes/matmaverse-design-system/plan.md
- **Scope**: Full plan (Phases 1–5)
- **Date**: 2026-06-28
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Both review sub-agents independently concluded "approve". No drift on any planned
change; the `?error=` pass-through, the resend `<form action="/api/auth/resend">`,
and the `isAutoConfirmed` branch are all preserved; the i18n diff is purely additive.
Automated criteria green: lint, build, 29/29 tests, no `bg-cosmic` in `src/`.

## Findings

### F1 — `"use client"` directive in checkbox.tsx

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/ui/checkbox.tsx:1
- **Detail**: shadcn-default `"use client"` directive violates CLAUDE.md ("No Next.js directives"). Sibling primitives don't carry it. Landed in Phase 3.
- **Fix**: Delete the `"use client"` line.
- **Decision**: FIXED

### F2 — Orphaned i18n keys after restyle

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/i18n/pl.ts:19 (noAccount), :27 (hasAccount)
- **Detail**: Restyled signin/signup use only `signupLink`/`signinLink`; `noAccount`/`hasAccount` are now unused dead copy. Harmless.
- **Fix**: Remove the two unused keys (or keep for a future lead-in).
- **Decision**: SKIPPED

### F3 — Hero `<h2>` precedes page `<h1>` in DOM order

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture (a11y)
- **Location**: AuthShell.astro:55 (h2) vs signin/signup.astro:19 (h1)
- **Detail**: Marketing-panel hero was an `<h2>` rendered before the form-card `<h1>` in DOM order. Minor heading-order nit.
- **Fix**: Demote the hero to a styled `<p>`, leaving the form-card `<h1>` as the sole heading.
- **Decision**: FIXED

### F4 — Pre-existing English scaffold strings

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: Topbar.astro:18,20,29–32; Welcome.astro (body copy)
- **Detail**: Topbar had English literals ("Sign in/out", "App", "Not signed in") and Welcome.astro kept English starter copy. The plan left scaffold copy out of scope — not drift, but it clashes with the Polish-only i18n rule.
- **Fix**: Recorded as lesson L-003 (i18n-source all user-visible strings) AND localized — added `nav` + `welcome` i18n namespaces; Topbar and Welcome now source all strings from `t`. Welcome feature icons switched from inline SVG to lucide-react.
- **Decision**: FIXED + ACCEPTED-AS-RULE: L-003 (all user-visible strings come from the i18n dictionary)

### F5 — Unused asset coin-stack.png

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: public/illustrations/coin-stack.png
- **Detail**: Sliced in Phase 2 and catalogued in slice-map.md but unreferenced (AuthShell uses coin.png only). Harmless; available for Part B.
- **Fix**: Keep it (catalogued, useful for Part B).
- **Decision**: SKIPPED (kept by choice)

## Triage summary

- **Fixed**: F1, F3, F4 (F4 also recorded as rule L-003)
- **Skipped**: F2, F5
- Post-triage verification: lint clean, build green, 29/29 tests pass.
