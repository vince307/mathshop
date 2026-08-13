---
change_id: password-reset
title: Parent password reset — request page, Polish recovery email, marker-gated update
status: implementing
created: 2026-08-13
updated: 2026-08-13
archived_at: null
---

## Notes

parent password recovery slice: request page (mockup 04), Polish recovery email via Brevo, recovery-marker-gated set-new-password page, sign out other devices. Design approved in brainstorming: reuse existing /api/auth/confirm (type=recovery), HMAC marker modeled on parent_verified with domain separation, enumeration-safe responses, full loop including production config push + prod proof.

### Approved design (brainstorming, 2026-08-13)

**Origin.** Surfaced while debugging the 2026-08-13 "activation link never arrived" report: the root cause was Supabase enumeration protection swallowing a re-signup of an already-confirmed address, and the fix's escape hatch ("zaloguj się") only helps a parent who still remembers their password. There is no recovery route at all — a gap already recorded as deferred in `context/archive/2026-07-10-production-email-delivery/` (research.md:42, plan.md:31).

**Surfaces**

| Path | Kind | Role |
|---|---|---|
| `/auth/reset-password` | page (AuthShell + card, mockup `04`) | "Nie pamiętasz hasła?" — email field, `Wyślij link` |
| `/api/auth/reset` | POST | `resetPasswordForEmail(email, { redirectTo: ${origin}/auth/update-password })` |
| `/api/auth/confirm` | **existing**, extended | on `type=recovery` success, mints the reset marker |
| `/auth/update-password` | page (derived from signin/signup vocabulary) | new password + repeat |
| `/api/auth/update-password` | POST | `updateUser` → `signOut({ scope: "others" })` → clear marker |
| `/auth/signin` | existing | gains the "Nie pamiętasz hasła?" link |

Plus `supabase/templates/recovery.html` (Polish), template + redirect-URL wiring in `config.toml` for local **and** `[remotes.production]`, and new i18n under `auth.reset` / `auth.updatePassword` reusing signup's existing validation strings.

**Flow.** Request → `resetPasswordForEmail` → back to `/auth/reset-password?sent=1`. The email links to
`{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next={{ .RedirectTo }}` — byte-compatible with `confirmation.html`, so the existing confirm-route contract and its tests hold. `verifyOtp` mints the session, the route sets the marker, lands on `/auth/update-password`. POST validates, updates, revokes other devices, clears the marker, redirects to `/app`.

**Decisions**

- **Approach B — recovery-marked page** (chosen over a plain session gate). Rationale: this app already refuses to trust a bare session for sensitive actions — that is exactly why the parent-PIN gate exists on deletion and the report. A bare session silently changing the account password would be *less* protected than viewing a weekly report.
- **Domain separation.** The marker signs `pwreset:${accountId}:${exp}`, not `${accountId}.${exp}`, so a `parent_verified` marker can never be replayed as a reset marker or vice versa — shared `PARENT_SESSION_SECRET`, disjoint signature spaces. Separate cookie name, 15-minute TTL, httpOnly, fails closed without the secret (mirrors `src/lib/services/parent-pin.ts:138-159`).
- **Both** the page and the mutating POST check the marker — a page-only check would leave the route open.
- **Sign out other devices** (`signOut({ scope: "others" })`): a reset triggered by suspected compromise must kill the intruder's session, otherwise it gives false comfort. Accepted cost: a parent signed in on a family tablet must sign in again.
- **Enumeration stays closed**, consistent with the same-day signup fix: identical response for known and unknown addresses — "Jeśli konto z tym adresem istnieje, wysłaliśmy link do zmiany hasła."
- **Missing mockup** for the set-new-password screen: derive from existing auth vocabulary (AuthShell + card, `FormField` / `PasswordToggle` / `SubmitButton`, signup's validation copy) rather than invent a new design language.

**Definition of done.** The full loop including production: a parent resets on https://mathshop.vercel.app, receives a Polish recovery email via Brevo, sets a new password, and lands signed in — proven with a real production round-trip on a `+suffix` address, exactly as the confirmation email was proven in July.

**Middleware trap.** `src/middleware.ts:10` bounces authenticated parents off `AUTH_FORM_PAGES` (`/auth/signin`, `/auth/signup`). `/auth/update-password` must **not** join that list — the recovery hop lands there *with* a session, so adding it would silently break the whole flow at the last step. `/auth/reset-password` is a judgement call left to the plan: bouncing a signed-in parent to `/app` is defensible (they don't need recovery), but it forecloses "change my password while signed in", which this slice does not build.

**Error handling.** Rate limits (prod `max_frequency = 1m0s`) map to the existing Polish "Zbyt wiele prób…" via `resendFailureMessage`. Expired marker → `/auth/reset-password` with "link wygasł, poproś o nowy". Missing session or marker → `/auth/signin`.

**Testing.** vitest: marker helper (sign/verify/expiry/tamper/cross-purpose replay); request route (identical response for existing vs unknown address); update route (no marker → refused *and* password durably unchanged; valid → new password signs in, **old password fails**, a second device's session dies). e2e: full journey via `admin.generateLink({ type: "recovery" })`, the inbox-free technique `onboarding.spec.ts` already uses. Plus a local Mailpit round-trip for the template, and a deliberate-break check on the marker assertions.

**Open questions for `/10x-research`**

1. Does `signOut({ scope: "others" })` behave correctly through the `@supabase/ssr` cookie client — specifically, does the current session survive it?
2. Does `[auth.email.template.recovery]` need its own `subject` key in `config.toml`, or is it inherited?
3. How does `otp_expiry` (currently 3600) interact with the 15-minute marker TTL for a slow parent — where exactly does the flow break, and is the resulting Polish message the right one?
