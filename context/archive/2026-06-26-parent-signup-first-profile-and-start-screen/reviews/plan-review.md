<!-- PLAN-REVIEW-REPORT -->
# Plan Review: S-01a — Parent Signup + Email Verification + Polish Auth Foundation

- **Plan**: context/changes/parent-signup-first-profile-and-start-screen/plan.md
- **Mode**: Deep
- **Date**: 2026-06-26
- **Verdict**: REVISE → **SOUND** (all 4 findings fixed in plan during triage 2026-06-26)
- **Findings**: 1 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | FAIL |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding
8/8 existing paths ✓; createClient signature confirmed (src/lib/supabase.ts:5 — setAll has cookies only, no Response); 4 call sites (middleware, signin, signup, signout); nothing currently sets response headers; brief↔plan ✓; Progress↔Phase mapping consistent.

## Findings

### F1 — Anti-cache headers can't be applied inside setAll

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Architectural Fitness
- **Location**: Phase 3 §1 + Critical Implementation Details
- **Detail**: The plan says "fix supabase.ts's setAll to apply the headers argument." But createClient(requestHeaders, cookies) gives setAll only AstroCookies — no Response handle; setAll runs during getUser()/verifyOtp() before a Response exists. The anti-CDN-cache headers (Cache-Control/Expires/Pragma) cannot be set from inside setAll. Cookie hardening (secure/httpOnly/sameSite) IS doable there. 4 call sites confirmed; nothing sets response headers today.
- **Fix A ⭐ Recommended**: Apply headers at the response level — middleware on the next() Response when auth cookies were written; auth/confirm routes on their redirect Response (helper). Keep cookie hardening in setAll.
  - Strength: No createClient signature change; headers set where a Response exists.
  - Tradeoff: Logic in 2–3 spots (mitigate with a helper).
  - Confidence: HIGH — matches Astro middleware/route Response exposure.
  - Blind spot: Middleware must detect when a token refresh wrote cookies.
- **Fix B**: Thread a header-setter/context into createClient and apply headers in setAll.
  - Strength: Single choke point.
  - Tradeoff: Touches createClient + all 4 call sites + the test harness (buildContext/cookie-jar must expose a header sink).
  - Confidence: MED — wider blast radius.
  - Blind spot: Phase-1 harness wasn't built to capture response headers.
- **Decision**: FIXED via Fix A — Phase 3 §1 rewritten to set anti-cache headers at the response level (middleware + auth/confirm routes via a helper); cookie hardening stays in setAll.

### F2 — Phase 4 verification test strategy is unverified

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 4 §4 + Critical Implementation Details
- **Detail**: Tests the confirm route via admin.generateLink({type:"signup"}) + verifyOtp while keeping enable_confirmations=false locally. Unverified interplay (the research's flagged wrinkle): with confirmations off, signUp auto-confirms (normal flow never hits the confirm route), and it's unconfirmed GoTrue accepts verifyOtp for a generateLink signup token under that config. Also the verifyOtp `type` enum (signup vs email) must match the template/generateLink; manual 4.5 shows no email unless confirmations are temporarily on. If it fails, Phase 4 has no automated test path.
- **Fix**: Spike it before building Phase 4 (~15 min) — confirm generateLink + verifyOtp establishes a session against the local stack; if it fails, fall back to a dedicated test file that sets enable_confirmations=true for that suite (or PKCE cookie-capture). Note in 4.5 that manual inbucket testing needs confirmations temporarily enabled.
- **Decision**: FIXED — added spike-first + fallback + the type-enum note to Phase 4 Critical Implementation Details; flagged the manual-inbucket confirmations prerequisite.

### F3 — emailRedirectTo redundant with the token_hash template flow

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4
- **Detail**: With the custom token_hash template, the confirmation URL is template-controlled and the confirm route hardcodes its /app redirect, so emailRedirectTo=/app ({{ .RedirectTo }}) is unused.
- **Fix**: Drive the post-confirm target from a `next` param the route reads, or drop emailRedirectTo and state the redirect is hardcoded.
- **Decision**: FIXED — confirm route now reads a `next` param (default /app); emailRedirectTo → `{{ .RedirectTo }}` → template `&next=` is the single source.

### F4 — /dashboard left dead-but-gated

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 5
- **Detail**: Part A lands on /app; the scaffold src/pages/dashboard.astro stays gated, and PRD Non-Goals forbids a parent dashboard.
- **Fix**: Remove dashboard.astro (+ its intent) in Phase 5, or note it's intentionally retained for now.
- **Decision**: FIXED — added Phase 5 §5: delete dashboard.astro, drop /dashboard from PROTECTED_ROUTES, repoint gating tests to /app.
