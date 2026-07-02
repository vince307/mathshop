<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Skill-Path Upgrade Gate + Parent Weekly Report

- **Plan**: context/changes/skill-path-upgrade-gate/plan.md
- **Mode**: Deep
- **Date**: 2026-07-02
- **Verdict**: REVISE → SOUND after fixes (all 5 findings addressed)
- **Findings**: 1 critical, 2 warnings, 2 observations — all FIXED

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | FAIL |

## Grounding

13/13 paths ✓, 6/6 symbols ✓, brief↔plan ✓, Progress↔Phase 6/6 ✓, contract-surfaces ✓

## Findings

### F1 — Phase 2 breaks its own build/typecheck success criteria

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 §1 (BuyContext) vs Phase 3 (UpgradeShop)
- **Detail**: Phase 2 adds a required `skillState` to `BuyContext`, but the inline ctx builders that break live in files Phase 2 doesn't touch: `UpgradeShop.tsx:40` and `tests/upgrades.test.ts` (ctx at :38,47,50,53,56). Phase 2's Automated criteria (`npm run check`/`build`/`vitest run tests/upgrades.test.ts`) fail until those pass `skillState`, but the plan only updates UpgradeShop in Phase 3.
- **Fix A ⭐ Recommended**: Pull the BuyContext-consumer updates into Phase 2 (UpgradeShop ctx + upgrades.astro thread skillState; add skillState to upgrades.test.ts ctx objects). Phase 3 then only adds bars + copy.
  - Strength: Correct display from Phase 2 on; phase goes green.
  - Tradeoff: Phase 2 grows by ~2 files.
  - Confidence: HIGH — agent traced every BuyContext construction site.
  - Blind spot: None significant.
- **Fix B**: Make BuyContext.skillState optional, normalized in canBuy.
  - Strength: Phase 2 touches fewer files.
  - Tradeoff: Skill-gated upgrades wrongly show locked for qualified children until Phase 3.
  - Confidence: HIGH — but the wrong-display window is real.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — Phase 2 §3 added (thread skillState into UpgradeShop + upgrades.astro), tests updated in §4, Phase 3 realigned.

### F2 — Parent-PIN signed cookie needs a signing secret the plan never provisions

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 5 §2 (PIN routes / session marker)
- **Detail**: The plan sets a "signed, short-TTL parent_verified cookie", but there is no signing helper and no secret in `astro.config.mjs` env schema (only SUPABASE_URL / SUPABASE_KEY). Both the hashed PIN and signed cookie are net-new; signing needs a key the plan doesn't add.
- **Fix A ⭐ Recommended**: Provision a `PARENT_SESSION_SECRET` env var (access: "secret") + HMAC-sign the marker, httpOnly.
  - Strength: Follows the astro:env/server secret pattern used for SUPABASE_KEY; stateless.
  - Tradeoff: New Vercel env-var deploy-config item.
  - Confidence: HIGH — matches env.schema convention.
  - Blind spot: Secret rotation not addressed.
- **Fix B**: Opaque server-stored verification token in account_settings + httpOnly cookie, verify by lookup.
  - Strength: No new secret / deploy config.
  - Tradeoff: A DB read per report load + expiry cleanup.
  - Confidence: MED — adds state where a signed cookie is stateless.
  - Blind spot: Concurrent-device token handling unspecified.
- **Decision**: FIXED via Fix A — Phase 5 §2 now provisions PARENT_SESSION_SECRET in env.schema + HMAC-signs the httpOnly marker; deploy note added.

### F3 — Skill-delta trust: per-competency caps don't reconcile with the shift totals

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 §4 (complete.ts zod schema)
- **Detail**: The plan caps each per-competency skill field at MAX_SHIFT_TASKS independently; a tampered client could report math=15 AND money=15 from a 15-task shift, inflating skill ~2x. The POST already carries taskCount + cleanCount, so deltas are checkable: Σ completed ≤ taskCount, Σ firstTryCorrect ≤ cleanCount. The plan doesn't cross-check.
- **Fix**: Add a zod refine (or a check in recordShiftResult) reconciling the skills delta against the already-sent taskCount/cleanCount (sum bounds), rejecting mismatches; add a test case.
- **Decision**: FIXED — Phase 1 §4 now specifies the Σ-bound refine; Testing Strategy adds the inflated-delta rejection case.

### F4 — "Ties upgrade to skills exercised" is undefined for cost-only upgrades

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase 4 §3 / Phase 6 §2 (weekly report)
- **Detail**: FR-016 wants each unlocked upgrade tied to the skills it exercised. The plan derives the tie from the upgrade's requiredSkill/requiredTaskHistory, but most catalog upgrades are cost-only, so there's nothing to tie — the report would show blanks for them.
- **Fix**: Define the tie for ungated upgrades — e.g. tie to the competencies practiced in the same week ("general practice"), not just the requirement. Name it in Phase 4 §3.
- **Decision**: FIXED — Phase 4 §3 now specifies the cost-only fallback tie ("general practice"), no report blanks.

### F5 — PIN verify has no rate-limiting / lockout

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 5 §2 (verify route)
- **Detail**: A 4–6 digit PIN with unlimited attempts is brute-forceable. Harm is bounded (read-only, non-shaming report; soft gate), but the plan should decide explicitly.
- **Fix**: Either add a simple attempt throttle/lockout, or explicitly accept-and-document the risk given the soft-gate threat model.
- **Decision**: FIXED via throttle — Phase 5 §1 adds failed_attempts/locked_until columns, §2 adds the verify cooldown, test asserts lockout.
