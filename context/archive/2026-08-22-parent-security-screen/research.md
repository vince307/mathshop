---
date: 2026-08-22T20:17:27+02:00
researcher: Claude (autonomous run 2026-08-22-autonomous-five, step F3/research)
git_commit: 22ddebd9e20bad4ed23613cbfa2fcbd69cd8c7b5
branch: feat/ui-polish
repository: 10xDevs (github.com/vince307/mathshop)
topic: "How the parent PIN spine works end to end, and the smallest safe way to build the full 'Zabezpieczenia' screen on top of it"
tags: [research, codebase, parent-pin, security, account-settings, rls, mockup-parity]
status: complete
last_updated: 2026-08-22
last_updated_by: Claude (autonomous run)
---

# Research: the parent PIN spine and the "Zabezpieczenia" screen

**Date**: 2026-08-22T20:17:27+02:00
**Researcher**: Claude (autonomous run `context/runs/2026-08-22-autonomous-five`, step F3 research)
**Git Commit**: `22ddebd9e20bad4ed23613cbfa2fcbd69cd8c7b5`
**Branch**: `feat/ui-polish`
**Repository**: 10xDevs / mathshop

## Research Question

How does the parent PIN spine actually work end to end, and what is the smallest safe way to
build the full "Zabezpieczenia" screen — change PIN plus the mockup's protective options — on
top of it?

## Autonomous decisions

This run has no human in the loop (`context/runs/2026-08-22-autonomous-five/agent-contract.md`,
hard rule 1). The `/10x-research` skill opens by asking for a research question and then wants
`AskUserQuestion` to clarify scope. Both were decided, not asked:

- **Research question**: supplied verbatim above by the orchestrator.
- **Scope: deep.** Rejected "quick overview". This change sits on the app's only authentication
  gate below Supabase auth; a wrong assumption here is a real vulnerability, not a cosmetic bug.
  Focus areas chosen: **architecture, security invariants, integration points**. Rejected
  "history & evolution" as a primary focus, though prior-change archives were read where they
  record binding security decisions (they did — see Historical Context).
- **Method**: four parallel sub-agents (PIN lifecycle · marker + deletion precedent · schema,
  routing, nav, i18n · test surface), all read-only, all reporting `file:line`. The two mockup
  PNGs were opened by the main context rather than delegated, because the per-control
  enumeration is this step's most important output and must not arrive second-hand.
- **What would change these answers**: if the maintainer says the four "protective options" are
  meant to be real, persisted settings rather than reassurance copy, the §Mockup verdict table
  and the "no migration" conclusion both flip. That is a product call, not a research finding.

## Summary

**Six findings, in order of how much they change the plan.**

1. **The mockup is not a settings screen.** `06-parent-pin-security-*.png` draws **step 3 of a
   3-step onboarding wizard** ("Krok 3 z 3 · Konto rodzica → Profil dziecka → Bezpieczeństwo"),
   with `Wróć` / `Pomiń na razie` / `Zakończ konfigurację` at the foot. Its PIN half is
   *first-time set*, which `/app/parent-pin` already ships. F3 has to **adapt** it into a
   settings surface, not transcribe it.

2. **All four "Bezpieczne ustawienia" toggles are decorative, and the product has already said
   so once.** None can be backed by real behaviour (details and per-control verdicts in
   §"The mockup, control by control"). Two of the four are explicit PRD v3 **non-goals**. The
   previous UI pass already reached this conclusion and shipped exactly these four items as a
   **static "Bezpieczne środowisko" statements card** on `/app/report`
   (`src/pages/app/report.astro:88-101`, strings at `src/i18n/pl.ts:400-407`, with the comment
   *"Product guarantees, not measurements — safe to state without data."*). **The right-hand
   card of the mockup is therefore already built, correctly.**

3. **So F3's only genuinely new capability is "change PIN."** Everything else on the mockup
   either exists or must not exist.

4. **Change PIN needs no new endpoint.** `POST /api/parent/pin/set` already *is* the change-PIN
   route for a verified session: it refuses to overwrite an existing PIN without a valid
   `parent_verified` marker (403). **Confirmed by reading the code**, not the summary —
   `src/pages/api/parent/pin/set.ts:31-34`, quoted below.

5. **No migration is needed.** `account_settings` already carries `pin_hash`,
   `failed_attempts`, `locked_until`; nothing new needs storing. (What a migration *would*
   cost, if the planner overrules finding 2, is spelled out in §`account_settings`.)

6. **The one open decision is genuinely open**: the marker lives 15 minutes, so change-PIN
   inherits that trust window. My recommendation — **re-ask for the current PIN** — and the
   full argument are in §"The open decision". The planner closes it.

## Detailed Findings

### 1. The PIN lifecycle, end to end

All PIN logic lives in one service: `src/lib/services/parent-pin.ts` (174 lines). Nothing else
in `src/` touches `account_settings`.

#### Hashing — scrypt, per-PIN salt, constant-time compare

`src/lib/services/parent-pin.ts:33-46`:

```ts
33  function hashPin(pin: string): string {
34    const salt = randomBytes(16);
35    const derived = scryptSync(pin, salt, SCRYPT_KEYLEN);   // SCRYPT_KEYLEN = 64
36    return `${salt.toString("hex")}:${derived.toString("hex")}`;
37  }
40  function matchesPin(pin: string, stored: string): boolean {
41    const [saltHex, hashHex] = stored.split(":");
42    if (!saltHex || !hashHex) return false;
43    const expected = Buffer.from(hashHex, "hex");
44    const derived = scryptSync(pin, Buffer.from(saltHex, "hex"), expected.length);
45    return expected.length === derived.length && timingSafeEqual(expected, derived);
46  }
```

- `node:crypto` `scryptSync`, Node default cost params (no options object — N=16384, r=8, p=1).
- 16 random salt bytes per `setPin`; stored as `"<saltHex>:<hashHex>"` in a single `text` column.
- Verify derives at the *stored* hash's length (line 44), so the format survives a
  `SCRYPT_KEYLEN` change. Comparison is `timingSafeEqual` behind a length guard.
- `hashPin` and `matchesPin` are **module-private**. Only `setPin` (`:67`) and `verifyPin`
  (`:87`) are exported.

#### `verifyPin` — control flow and throttle

`src/lib/services/parent-pin.ts:87-120`. Returns
`VerifyResult = { ok: true } | { ok: false; reason: "no-pin" | "locked" | "wrong" | "error" }`
(`:79`).

1. `:88-91` — `select("account_id, pin_hash, failed_attempts, locked_until").limit(1)` with
   **no `.eq()`**. RLS (`auth.uid() = account_id`) is what scopes the row. Query error → `"error"`.
2. `:94` — no row → `"no-pin"`.
3. `:96-98` — **lockout is checked before the PIN is compared**:
   ```ts
   96  if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
   97    return { ok: false, reason: "locked" };
   98  }
   ```
4. `:100-106` — correct PIN resets the throttle
   (`.update({ failed_attempts: 0, locked_until: null })`) and returns `{ ok: true }`.
5. `:108-119` — wrong PIN calls the atomic RPC (never a JS read-modify-write):
   ```ts
   112  const { data: throttle, error: rpcErr } = (await client.rpc("register_pin_failure", {
   113    p_max: MAX_FAILED_ATTEMPTS,          // 5   (:20)
   114    p_lockout_seconds: Math.floor(LOCKOUT_MS / 1000),   // 60  (:22)
   115  })) as { data: { locked_until: string | null }[] | null; error: unknown };
   ```
   The 5th consecutive wrong PIN returns `"locked"` directly, not `"wrong"`.

#### `supabase/migrations/20260702120000_pin_failure_throttle_rpc.sql` — what the server does

Verbatim, lines 16-33:

```sql
create or replace function public.register_pin_failure(p_max integer, p_lockout_seconds integer)
returns table (failed_attempts integer, locked_until timestamptz)
language sql
security invoker
set search_path = ''
as $$
  update public.account_settings s
  set failed_attempts = s.failed_attempts + 1,
      locked_until = case
        when s.failed_attempts + 1 >= p_max then now() + (p_lockout_seconds * interval '1 second')
        else s.locked_until
      end,
      updated_at = now()
  where s.account_id = auth.uid()
  returning s.failed_attempts, s.locked_until;
$$;

grant execute on function public.register_pin_failure(integer, integer) to authenticated;
```

- **`security invoker`**, not definer — it runs under the caller's RLS, and
  `where s.account_id = auth.uid()` pins it to the caller's own row. Never takes an account id.
- `set search_path = ''` forces schema-qualified names.
- Grant: `execute` to `authenticated` only. No `anon`, no `service_role`.
- One row-locked `UPDATE`: increment, set `locked_until` **only** when the post-increment count
  reaches `p_max`, bump `updated_at`. `RETURNING` gives post-update values (hence the client's
  `throttle?.[0]?.locked_until` at `parent-pin.ts:117`).
- It was written to fix review finding F3 of S-07: the previous JS `SELECT`-then-`UPDATE` lost
  increments under a concurrent verify burst, letting an attacker exceed the 5-attempt cap.
- **The thresholds live in TypeScript, not in the DB** — the SQL takes them as arguments.

**Pre-existing defect worth flagging (not F3's to fix, but F3 makes it easy to hit):**
the RPC has **no reset path**, and lock expiry does not clear the counter. Only a correct PIN
(`parent-pin.ts:101-104`) or `setPin` (`:73`) resets `failed_attempts`. So once a parent has
5 failures, the 60-second lock lapses but the counter is still ≥ 5 — the very next wrong PIN
re-locks instantly. That is one guess per minute, forever, and **there is no forgot-PIN
recovery flow anywhere in the product** (open since the S-07 impl-review, never built).

#### PIN format validation

None in the service — `setPin`/`verifyPin` accept any string. Validation is the same regex in
four places: `api/parent/pin/set.ts:10`, `api/parent/pin/verify.ts:10`,
`api/account/delete.ts:15` (all `z.string().regex(/^\d{4,6}$/)`), and client-side in
`ParentPinGate.tsx:41`. Note the product accepts **4–6** digits; the mockup draws exactly 4 boxes.

#### The routes — `src/pages/api/parent/pin/` (exactly two files)

Both carry `export const prerender = false` and wrap every response in `applyNoStore(...)`.
Both take `FormData` (not JSON), field `pin`.

**`set.ts`** — guard order 503 → 401 → **403 reset-guard** → 400 → 500 → 200. The guard,
verbatim with its rationale comment (`src/pages/api/parent/pin/set.ts:18-34`):

```ts
18  // RESET GUARD: setting the FIRST PIN is open, but overwriting an EXISTING one
19  // requires a valid parent_verified marker — otherwise a child on the parent's
20  // logged-in device could POST here to silently reset the PIN and mint a marker,
21  // defeating the gate. Enforced server-side (not just in parent-pin.astro's mode).
...
31  if (await hasPin(supabase)) {
32    const marker = context.cookies.get(PARENT_VERIFIED_COOKIE)?.value;
33    if (!verifyMarker(marker, user.id)) return json(403, { ok: false, reason: "forbidden" });
34  }
```

**The previous step's finding is CONFIRMED against the code.** 403 fires exactly when: the
caller is authenticated, `hasPin()` is true, and `verifyMarker(cookie, user.id)` is false — i.e.
the marker is missing, malformed (not 3 dot-parts), signed for another account, expired,
tampered, **or `PARENT_SESSION_SECRET` is unconfigured**. Two details the planner needs:

- The guard runs **before** the body is parsed, so a 403 pre-empts a 400 on a malformed PIN.
- First-time set (no `account_settings` row) **skips the guard entirely** — open to any
  authenticated session, by design.

On success `set.ts:43` calls `setParentVerified(...)` — i.e. **a PIN change re-mints the marker
and extends the trust window** rather than revoking it.

**`verify.ts`** — status map at `:17`:
`{ locked: 429, "no-pin": 400, wrong: 401, error: 500 }`. Success mints the marker (`:37`).

#### The gate screen

`src/pages/app/parent-pin.astro` (29 lines) picks its mode at `:12-14`:

```astro
12  const supabase = createClient(Astro.request.headers, Astro.cookies);
13  const alreadyHasPin = supabase ? await hasPin(supabase) : false;
14  const mode = alreadyHasPin ? "enter" : "set";
```

It renders one island, `<ParentPinGate client:load mode={mode} />`
(`src/components/parent/ParentPinGate.tsx`, 139 lines). Fields: `pin` always; `confirm` only in
`set` mode — i.e. **the mockup's "Wpisz 4 cyfry" + "Potwierdź PIN" pair is already shipped**, as
two labelled password inputs rather than 4+4 boxes. Success hard-navigates to `/app/report`
(`:55-58`) — **there is no `redirect`/`next` query-param support anywhere**, so every bounce to
the gate loses its origin.

Two gaps in that island a change-PIN form must not inherit:
- `reasonToMessage` (`:25-36`) has **no case for `"forbidden"`** — a blocked reset renders the
  generic "Coś poszło nie tak." with no hint that re-verification is needed.
- The lockout has no countdown, no disabled state, no timer — just the static string
  `t.parentPin.errors.locked` (`src/i18n/pl.ts:368`), and the submit button stays enabled.

### 2. The `parent_verified` marker, in full

#### What it is

`src/lib/services/parent-pin.ts:133-140`:

```ts
export function signMarker(accountId: string, expiresAt: number): string {
  const secret = markerSecret();
  if (!secret) throw new Error("PARENT_SESSION_SECRET is not configured");
  const payload = `${accountId}.${expiresAt}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}
```

- Shape: `<accountId>.<expiresAtMillis>.<hexHmacSha256>` — three dot-separated parts, cleartext
  payload plus an HMAC tag.
- Secret: `PARENT_SESSION_SECRET` from `astro:env/server`, declared **`optional: true`** at
  `astro.config.mjs:29`. `markerSecret()` (`:129-131`) returns `null` when unset/empty, so
  **`verifyMarker` → false and `signMarker` → throws. Fail-closed by design** — a misconfigured
  prod blocks the parent area instead of silently opening it. (This was review finding F2 of S-07.)
- **Forgeable?** No, given the secret is set and secret. The account id is inside the signed
  payload, so a marker for account A is rejected for B (`:155`).

**Domain-separation gap the planner should know about:** the PIN marker signs the *bare*
`accountId.expiresAt`, with **no purpose prefix**. Its sibling, the password-reset marker
(`src/lib/services/password-reset.ts:28-51`), signs `pwreset:accountId:expiresAt` precisely so
the two cannot be cross-replayed — with a header comment saying so, and a test that proves
separation both ways (`tests/password-reset-marker.test.ts:72,82`). `parent_verified` occupies
the **unprefixed** signature space; any future marker must carry its own prefix.

#### Where it is stored — cookie attributes, verbatim

`src/lib/services/parent-pin.ts:164-174`:

```ts
export function setParentVerified(cookies: AstroCookies, accountId: string): void {
  const expiresAt = Date.now() + MARKER_TTL_MS;
  cookies.set(PARENT_VERIFIED_COOKIE, signMarker(accountId, expiresAt), {
    httpOnly: true,
    sameSite: "lax",
    secure: import.meta.env.PROD,
    path: "/",
    maxAge: Math.floor(MARKER_TTL_MS / 1000),
  });
}
```

| Attribute | Value |
| --- | --- |
| name | `parent_verified` (`:15`) |
| `httpOnly` | `true` |
| `secure` | `import.meta.env.PROD` — **true only in prod builds** |
| `sameSite` | `"lax"` |
| `path` | `"/"` |
| `maxAge` | `900` seconds |
| `expires` | not set |

It is a **cookie, not a Supabase session claim** — entirely independent of the auth session.

#### How `MARKER_TTL_MS = 15 * 60_000` is enforced — **both ways, independently**

1. Cookie `maxAge` = 900s (`:172`). Browser-side only; a client can keep sending an expired cookie.
2. **The authoritative check** — a server-side timestamp comparison inside `verifyMarker`
   (`:156-157`), against an expiry that is *inside the signed payload* and so cannot be
   extended without the secret:
   ```ts
   const exp = Number(expStr);
   if (!Number.isFinite(exp) || exp < Date.now()) return false;
   ```

Full `verifyMarker` check order (`:148-162`): secret present → cookie present → exactly 3 parts →
**account binding** → expiry → constant-time HMAC compare. The pre-HMAC checks compare
non-secret values, so the non-constant-time ordering leaks nothing.

#### Minted / read / cleared — every site

**Minted (2):** `api/parent/pin/verify.ts:37` (after a correct PIN under the throttle) and
`api/parent/pin/set.ts:43` (after a successful set — first-time **or** reset). Nothing else
mints. The previous step's second finding is confirmed.

**Read (4):** `app/report.astro:28-29` (page gate → redirect `/app/parent-pin`);
`api/parent/pin/set.ts:31-34` (reset guard → 403); `api/profiles/delete.ts:38-39` (→ 403);
`api/account/delete.ts:51-52` (→ 403).

**Cleared (2), both inline — there is no `clearParentVerified` helper:**
`api/auth/signout.ts:23` and `api/account/delete.ts:77`, both
`cookies.delete(PARENT_VERIFIED_COOKIE, { path: "/" })`. Note the sibling module *does* export
`clearResetMarker` (`password-reset.ts:89`); the PIN module never got one.

**Not cleared on PIN change** — `set.ts:43` re-mints instead.

### 3. The account-deletion precedent — the pattern a change-PIN form would copy

#### `src/pages/api/account/delete.ts`

Schema and body — `multipart/form-data` via `FormData`, two fields, **never an account id**
(`delete.ts:11-15`):

```ts
// PIN (4–6 digits) + the account e-mail retyped in the dialog. The e-mail is
// defense-in-depth against a mis-targeted request — the real gates are the
// marker and the fresh PIN. No account id is ever accepted from the client:
// the deletion target is strictly the session's own user (L-002).
const deleteSchema = z.object({ pin: z.string().regex(/^\d{4,6}$/), email: z.string().min(1) });
```

Guard sequence, in exact order:

| # | Line | Guard | Failure |
| --- | --- | --- | --- |
| 1 | 42-44 | RLS client **and** admin client non-null | `503 {ok:false}` |
| 2 | 46-49 | `supabase.auth.getUser()` | `401 {ok:false}` |
| 3 | 51-52 | **`verifyMarker(marker, user.id)`** | `403 {ok:false, reason:"forbidden"}` |
| 4 | 54-56 | zod | `400 {ok:false, reason:"invalid"}` |
| 5 | 58-60 | **`verifyPin(supabase, pin)`** — fresh, under the atomic throttle | `429` locked / `401` wrong / `400` no-pin / `500` error |
| 6 | 62-64 | e-mail retype, trimmed + case-insensitive | `400 {reason:"email-mismatch"}` |
| 7 | 66-67 | `admin.auth.admin.deleteUser(user.id)` | `500` |
| — | 79 | success | `200 {ok:true}` |

The route's own header states the security model (`delete.ts:30-35`):

> *Two privilege planes, strictly ordered: the request-scoped RLS client establishes WHO
> (session) and re-authenticates (marker + FRESH PIN under the atomic throttle — **a
> possibly-15-min-old marker alone is not enough for the nuclear option**); the service-role
> admin client then performs exactly one operation with the session-derived id.*

**Ordering subtlety worth copying:** the e-mail check runs *after* the PIN check, so a wrong PIN
always burns a throttle attempt — the e-mail cannot be used as a free pre-flight oracle.

#### `src/components/parent/DeleteAccountSection.tsx` (98 lines) + `ConfirmDeleteDialog.tsx` (133)

UX: a `border-destructive/30` section card on `/app/report` with heading, intro and a
`variant="destructive"` button; clicking opens an `AlertDialog` carrying (a) a **typed
confirmation** input that must exactly match the account e-mail, (b) an `extraFields` slot into
which the account flow injects a `type="password" inputMode="numeric"` PIN field, (c) a
`role="status"` error paragraph, (d) Cancel + destructive confirm. The confirm button is
`disabled={!armed || busy}` where `armed = typed.trim() === expectedText.trim()`
(`ConfirmDeleteDialog.tsx:54,125,127`); the dialog cannot be dismissed mid-request (`:57`).

Notably the **PIN field is not part of the arming condition** — only the typed e-mail arms the
button; an empty PIN reaches the server and fails zod.

Posting (`DeleteAccountSection.tsx:28-32`) — the typed string never leaves the browser; the
`email` sent is the server-rendered prop:

```ts
const body = new FormData();
body.set("pin", pin);
body.set("email", email);
const response = await fetch("/api/account/delete", { method: "POST", body });
```

Error surfacing — the full mapping (`DeleteAccountSection.tsx:33-52`):

| Case | Status / reason | User sees | i18n key |
| --- | --- | --- | --- |
| success | 200 | hard nav `/?deleted=1` | `t.deletion.accountDeleted` |
| marker missing/expired | 403 | **hard nav `/app/parent-pin`** | `t.deletion.sessionExpired` |
| lockout | 429 | inline | `t.deletion.errors.pinLocked` |
| wrong PIN | 401 + `reason:"wrong"` | inline | `t.deletion.errors.wrongPin` |
| session gone | 401, no `wrong` reason | inline | `t.deletion.sessionExpired` |
| wrong e-mail | 400 `email-mismatch` | inline | `t.deletion.errors.emailMismatch` |
| zod / 503 / 500 / network | — | inline | `t.deletion.genericError` |

with this comment on the 401 disambiguation (`:43-45`):

> *401 is "wrong PIN" only when the route says so; a 401 with no `wrong` reason means the
> session is already gone (e.g. a retry after the success response was lost) — "wrong PIN" would
> be a misleading message there.*

The component's own header names the doctrine (`DeleteAccountSection.tsx:13-21`):

> *The dialog stacks THREE gates the route re-verifies server-side: the parent_verified marker
> (page + route), the account e-mail retyped (typed confirmation), and the PIN entered FRESH —
> **a possibly-15-min-old marker alone must not arm the nuclear option**.*

And `src/pages/api/profiles/delete.ts:19-28` names the threat model explicitly:

> *403 no/invalid parent_verified marker (the PIN-reset lesson: a destructive mutation must
> never be open to any authed session — **a child on the parent's logged-in device is the threat
> model**)*

Mounted at `src/pages/app/report.astro:68`, last on the page at every width
(`order-last lg:order-none lg:col-span-2 lg:col-start-1 lg:row-start-2`), with a placement
comment saying stacking it above the ordinary actions on a phone would put deletion in the
reader's path.

The contract to reuse: `onConfirm: () => Promise<string | null>` — a Polish string on failure
(dialog stays open and shows it), `null` on success (dialog closes).

### 4. The mockup, control by control

Both PNGs were opened directly:
- `assets/matmaverse-auth-v2-web/06-parent-pin-security-web.png`
- `assets/matmaverse-auth-v2-mobile/06-parent-pin-security-mobile.png`

**What the screen actually is.** A **3-step onboarding wizard, step 3** — a "Krok 3 z 3" stepper
(Konto rodzica → Profil dziecka → Bezpieczeństwo), a left rail repeating the three steps plus a
"Bezpieczna nauka" reassurance card, and a footer of `← Wróć` / `Pomiń na razie` /
`Zakończ konfigurację`. Mobile is the same content stacked, minus the left rail. **It is not a
settings screen**, and its PIN half is first-time set, which `/app/parent-pin` already ships.

**Tell that the toggles are decoration, not controls:** the web mockup draws **four** toggles,
the mobile mockup draws **three** — "Kontrola poziomu trudności" is simply dropped for space. A
real setting cannot exist only at desktop width. Decorative reassurance can.

#### Every control the mockup draws — verdict table

| # | Control (mockup label) | What it draws | Can real behaviour back it today? | Verdict |
| --- | --- | --- | --- | --- |
| 1 | **"Wpisz 4 cyfry"** — 4 PIN boxes | new-PIN entry | **Yes.** `setPin` + `POST /api/parent/pin/set` (`parent-pin.ts:67`, `set.ts:22`). Already shipped as one labelled input at `/app/parent-pin` (`ParentPinGate.tsx:84-96`). Note the product accepts **4–6** digits, the mockup draws 4. | **SHIP** — as the "new PIN" field of a change-PIN form |
| 2 | **"Potwierdź PIN"** — 4 confirm boxes | retype | **Yes.** Client-side `pin !== confirm` → `t.parentPin.errors.mismatch` (`ParentPinGate.tsx:44-47`); already shipped in `set` mode. | **SHIP** |
| 3 | **"Brak reklam"** toggle (default on) — *"Gwarantujemy naukę bez reklam i nieodpowiednich treści."* | switch | **No.** PRD v3 Non-Goals: *"**No monetization mechanic — ever.** No ads, purchases, paywall, or premium tier. **Identity, not a deferred feature.**"* (`context/foundation/prd-v3.md:167`). There is no ad system, so the switch's "off" position is unimplementable and its "on" position is a no-op. Worse, a switch **implies ads can be turned on**, contradicting the product's identity. | **DECORATIVE — do not ship as a control.** Already correctly shipped as a statement: `t.report.safetyPoints[0]` = *"Brak reklam i zakupów w aplikacji."* |
| 4 | **"Dostosowane do wieku"** toggle (default on) — *"Treści i wyzwania dopasowane do wieku dziecka."* | switch | **No.** Age adaptation is unconditional, derived from `child_profiles.age` (check-constrained 6–9) and the frozen `starting_level` band (FR-007/FR-009, slice S-08). There is no "unadapted" content path to switch to, and no column to store the preference. | **DECORATIVE.** Already shipped as `t.report.safetyPoints[1]` = *"Treści dopasowane do wieku 6–9 lat."* |
| 5 | **"Raport tygodniowy"** toggle (default on) — *"**Otrzymuj** podsumowanie postępów i osiągnięć dziecka."* | switch | **No.** The report is a **pull** surface at `/app/report` (FR-016, read-only). "Otrzymuj" (*receive*) promises **scheduled e-mail delivery**: that needs a cron/scheduled function, a report e-mail template and a send path. None exists — the only outbound mail is Supabase's transactional auth mail. Persisting a boolean nothing consumes is a dead switch. | **NOT AS A TOGGLE.** If something must occupy this row, make it a **link to `/app/report`** — real navigation to a screen that exists. Statement form already ships as `safetyPoints[2]`/`[3]`. |
| 6 | **"Kontrola poziomu trudności"** toggle (web only; **absent on mobile**) — *"Ty decydujesz, jak trudne będą zadania i wyzwania."* | switch | **No — and it is a named PRD non-goal.** `context/foundation/prd-v3.md:170`: *"No full parent dashboard. Only the minimal read-only weekly report ships; goal-setting, **difficulty controls**, time limits, and settings UI are out."* Difficulty is frozen per profile in `child_profiles.starting_level`; nothing reads a parent override. | **DO NOT SHIP IN ANY FORM.** Not even as a statement — it would promise a control the product has decided against. |
| 7 | Info note — *"PIN będzie wymagany przy zmianie ważnych ustawień oraz w panelu rodzica."* | static text | Partially true today: the PIN gates `/app/report`, account deletion, profile deletion and PIN overwrite. | **SHIP** as static copy, reworded for a settings context. Compare the existing `t.parentPin.note:357`. |
| 8 | `Krok 3 z 3` stepper · `← Wróć` · `Pomiń na razie` · `Zakończ konfigurację` · left step rail | onboarding wizard chrome | N/A — a settings screen has no wizard | **NOT APPLICABLE** |
| 9 | Mobile footer — *"To chroni konto rodzica i dane dziecka."* | static text | true | **SHIP** as static copy if useful |
| 10 | Lock+shield hero illustration | art | `assets/` is gitignored; no crop exists in `public/illustrations/`. `slice-map.md:38` records the standing decision that shield/lock glyphs are **not sliced** — they are rendered with lucide (`ShieldCheck` is already used at `report.astro:90` and in `AppShell.astro`). | **USE `lucide`**, do not crop |

**Bottom line: 3 of the mockup's controls are real (new PIN, confirm PIN, and the copy around
them). All four "protective toggles" are decorative — and the product has already shipped their
honest form.** The maintainer made the same call once before on the same kind of control: the
"Zapamiętaj mnie" checkbox on the login mockup was deliberately **not** shipped, because without
a session-length decision *"byłby to atrapowy checkbox"* (a dummy checkbox) —
`context/changes/web-shell-and-mockup-parity/handoff.md:134-138`.

### 5. `account_settings` as it stands

`supabase/migrations/20260701160000_create_account_settings.sql` — **columns, verbatim (21-28):**

```sql
create table public.account_settings (
  account_id      uuid        primary key references auth.users (id) on delete cascade,
  pin_hash        text        not null,
  failed_attempts integer     not null default 0 check (failed_attempts >= 0),
  locked_until    timestamptz null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
```

There is **no separate `id`** — `account_id` *is* the PK, one row per account.

**RLS — enabled at line 39; all four policies verbatim (41-65):**

```sql
create policy account_settings_select_own
  on public.account_settings for select to authenticated
  using (auth.uid() = account_id);

-- INSERT uses WITH CHECK (not USING) — blocks inserting a row owned by someone else.
create policy account_settings_insert_own
  on public.account_settings for insert to authenticated
  with check (auth.uid() = account_id);

-- UPDATE uses BOTH USING and WITH CHECK (can't reassign owner).
create policy account_settings_update_own
  on public.account_settings for update to authenticated
  using (auth.uid() = account_id)
  with check (auth.uid() = account_id);

create policy account_settings_delete_own
  on public.account_settings for delete to authenticated
  using (auth.uid() = account_id);
```

Plus: trigger `account_settings_set_updated_at` (`before update`, reuses the shared
`public.set_updated_at()` from the F-01 migration); no explicit index beyond the PK; no
functions defined in this file.

**Later migrations touching it: exactly one, and it changes no shape** —
`20260702120000_pin_failure_throttle_rpc.sql` adds the `register_pin_failure` RPC (quoted in §1).
**No `ALTER TABLE`, no added column, no policy change has ever been applied.** The current
effective shape is exactly the create migration.

**Could the mockup's toggles be persisted without a migration?** **No** — there is no column for
any of them, and no jsonb blob on this table to hide them in (unlike `child_profiles.shop_state`).
Any persisted toggle needs `ALTER TABLE public.account_settings ADD COLUMN …`.

**But per §4 no toggle is worth shipping, so no migration is needed.** If the planner overrules
that and ships one anyway, the migration obligations are:

- Per `CLAUDE.md` and lesson **L-001**, **RLS must be settled in the same migration file**. The
  four existing policies are **column-agnostic** (`auth.uid() = account_id`), so an added column
  is already covered — but the migration must **say so explicitly in its header comment** rather
  than leave a reader to infer it, and the change must ship an isolation assertion
  (`tests/account-settings-isolation.test.ts` already exists to extend).
- `docs/reference/contract-surfaces.md:41-55` must be updated — the registry lists the exact
  column set and is the project's declared source of truth for load-bearing names.
- **There are no generated Supabase types anywhere in the repo.** The client is built untyped
  (`src/lib/supabase.ts:25`, no `Database` generic), and the only shape is a hand-written,
  *non-exported* interface at `parent-pin.ts:25-30`. **Adding a column produces zero compile
  errors** — nothing will remind anyone to update it.
- Naming: `supabase/migrations/YYYYMMDDHHmmss_description.sql`.

**One more trap:** `updated_at` is **not** a "PIN last changed" signal — `register_pin_failure`
bumps it on **every failed attempt** (SQL line 28). Rendering "PIN zmieniony: <date>" from it
would be invented data, which the agent contract forbids. A real "last changed" needs a
`pin_updated_at` column, i.e. a migration.

Other tables in the project, for completeness: `public.child_profiles` (child play-profiles, the
canonical RLS template) and `public.shift_log` (append-mostly per-shift history behind the weekly
report). Functions: `public.set_updated_at()` and `public.register_pin_failure(integer,integer)`.

### 6. Routing, gating and navigation

**Middleware** (`src/middleware.ts`, 50 lines):

```
 5  const PROTECTED_ROUTES = ["/app"];
10  const AUTH_FORM_PAGES = ["/auth/signin", "/auth/signup"];
```

- `PROTECTED_ROUTES` matches with **`startsWith`** (`:42`), so the single `"/app"` entry already
  covers `/app/report`, `/app/security`, and any other `/app/*` route. **A new parent screen
  needs NO change to `PROTECTED_ROUTES`.**
- Unauthenticated hit on `/app*` → `applyNoStore(context.redirect("/auth/signin"))` (`:44`),
  **with no `?next=`** — the original path is discarded.
- `AUTH_FORM_PAGES` matches exactly (`:38`), deliberately.

**The middleware does NOT check the PIN.** The parent gate is a **copy-pasted four-liner**, not a
shared helper — there is no `requireParent(context)`. `src/pages/app/report.astro:22-29`:

```astro
const supabase = createClient(Astro.request.headers, Astro.cookies);
if (!supabase) return Astro.redirect("/app/parent-pin");
const { data: { user } } = await supabase.auth.getUser();
const marker = Astro.cookies.get(PARENT_VERIFIED_COOKIE)?.value;
if (!user || !verifyMarker(marker, user.id)) return Astro.redirect("/app/parent-pin");
```

Every parent-gated surface repeats this: `report.astro:28-29`, `account/delete.ts:51-52`,
`profiles/delete.ts:38-39`, `parent/pin/set.ts:32-33`. **A new route that forgets it is
silently open to any logged-in session — including the child on the parent's device.**

**Full `/app` route surface:** `app.astro` (`/app`, profile-count router), and under
`src/pages/app/`: `new-profile`, `parent-pin`, `pick-profile`, `report`, `start`, `task`,
`upgrades`. `/app/report` is the **only** parent-gated page. 16 API routes, all with
`prerender = false` (verified individually).

**Navigation** — one component holds both navs: `src/components/app/AppShell.astro`. Entries at
`:59-65`:

```astro
const items = [
  { key: "dashboard", href: "/app/start",    label: t.nav.items.dashboard, icon: Home },
  { key: "missions",  href: "/app/task",     label: t.nav.items.missions,  icon: Target },
  { key: "shop",      href: "/app/upgrades", label: t.nav.items.shop,      icon: Store },
] as const;
const tabs = [...items, { key: "parent", href: "/app/report", label: t.nav.items.parent, icon: ShieldCheck }] as const;
```

- Sidebar (`lg+`) iterates `items`; the parent entry is a **hardcoded** `<a href="/app/report">`
  in the `mt-auto` footer block (`:119-130`), styled as a distinct zone.
- Bottom bar (below `lg`) iterates `tabs` — **4 tabs in a `justify-around` row** (`:186-205`).
- Adding an entry costs three coordinated edits: a string in `t.nav.items` (`pl.ts:133-138`), a
  push into `items`/`tabs`, and widening the `active` union (`AppShell.astro:38`).
- `/app/parent-pin`, `/app/new-profile`, `/app/pick-profile` do **not** use `AppShell`.

**Where the screen belongs — recommendation for the planner (not a decision I made):**

| Option | Cost | Risk |
| --- | --- | --- |
| **(a) New route `/app/security` + 5th nav tab** | new page; **copy the marker gate into frontmatter**; a 5th bottom tab crowds a 4-tab `justify-around` row; widen the `active` union; new `nav.items` string; new nav entry must ship with the screen (no-dead-navigation) | Forgetting the frontmatter gate = silently open parent screen. Contract's one-name-in-the-a11y-tree rule bites on a 5th tab. |
| **(b) A `ChangePinSection` island on `/app/report`** ⭐ | **zero routing work**; the page is already marker-gated, already the parent zone, already hosts `DeleteAccountSection` and the safety card; no nav change at all | Only that `/app/report`'s `h1` is "Raport tygodniowy" — the section needs its own `h2`. |

**(b) is markedly smaller**, and the product already promises it: `t.parentPin.note:357` reads
*"Za PIN-em znajdziesz raport tygodniowy **i ustawienia konta**"* — a promise currently only
half-kept by the deletion danger zone. Place `ChangePinSection` **above** `DeleteAccountSection`
(which is deliberately `order-last` at every width).

### 7. i18n

`src/i18n/pl.ts` is **506 lines**, one frozen object, and **the only locale** —
`src/i18n/index.ts:8-9` does `export type Dictionary = typeof pl; export const t: Dictionary = pl;`,
so `pl.ts` *is* the schema. Both `.astro` frontmatter and `.tsx` islands import `{ t }` directly;
strings are never threaded through props (stated at `pl.ts:7-8`).

Existing parent-zone cluster: `parentPin` (351-370), `report` (378-408), `deletion` (416-446).
`parentPin` already carries `pinLabel` ("PIN (4–6 cyfr)"), `confirmLabel` ("Powtórz PIN"),
`pending`, and `errors.{invalid,mismatch,wrong,locked,generic}` — a change-PIN form reuses
**all** of them. `deletion` carries `sessionExpired` ("Sesja rodzica wygasła. Podaj PIN jeszcze
raz."), `working`, `cancel`, `genericError` and `errors.{wrongPin,pinLocked}`.

**Where new strings belong.** Two shapes fit the file's conventions:

- ⭐ **If the screen ships as a section on `/app/report` (recommended)**: add flat
  `change*` keys inside the existing `parentPin` block (`351-370`) — `changeHeading`,
  `changeIntro`, `currentPinLabel`, `newPinLabel`, `changeSubmit`, `changeSuccess`, plus
  `errors.sameAsCurrent` if that rule is adopted. Keeps the reused labels adjacent to the new
  ones and matches the file's shallow-nesting habit (sub-objects only for `errors` maps).
- If it ships as its own route with its own heading, a **new top-level `security:` key inserted
  between `deletion` (ends 446) and `picker` (451)** matches the file's screen-per-key ordering
  (auth → nav → wizard → child play → parent zone → misc).

Either way the file's convention requires a **preceding 3-6 line `//` comment** naming the slice,
the guardrails, the interpolated placeholders and the standing
`Draft Polish — pending native-speaker review.` line (see `372-377`, `410-415`). Key names are
lowerCamelCase English identifiers with Polish *values* — "Zabezpieczenia" is a heading string,
never a key.

If a nav entry is added, `t.nav.items` (`133-138`) grows too.

### 8. Test surface

**How tests run.** `npm test` → `vitest run`; `vitest.config.ts:8` does `loadEnv({ path: ".env.test" })`,
`:31` includes `tests/**/*.test.{ts,tsx}`, `:34-36` sets `fileParallelism: false` and 30s timeouts,
and `:20-26` aliases `astro:middleware` / `astro:env/server` to stubs in `tests/helpers/stubs/`
— that is what lets **real route handlers** be imported under Vitest.
39 test files, **296 `it()` blocks**. `npx playwright test` → `playwright.config.ts`, `testDir:
"./e2e"`, projects **`desktop`** (Desktop Chrome 1280×720, everything) and **`touch`**
(Galaxy Tab S4, scoped by `testMatch: /gameplay-restore\.spec\.ts/`) — 6 specs, 13 `test()`
blocks, **15 executed runs**. The config hard-fails without `PARENT_SESSION_SECRET` (`:13-19`).

**The single most important thing to know: no PIN test mocks Supabase.** They act as real
signed-in users against the local stack so RLS is genuinely exercised.
`tests/helpers/supabase.ts:13-15` states the rule: *"The service-role admin client is used ONLY
to provision and tear down users — never to act as a user under test (that would bypass RLS)."*
Its API: `admin`, `createSignedInUser(prefix)`, `deleteUser(id)`, `findUserIdByEmail(email)`,
`url`, `anonKey`, `PASSWORD = "test-password-123!"`, `interface TestAccount`.

**What exists:**

| File | Covers |
| --- | --- |
| `tests/parent-pin.test.ts` | service layer: set/verify round-trip, hash-not-plaintext (`:34`), `no-pin` (`:48`), **5-strike lockout** (`:53`), cross-account isolation (`:67`), and 6 marker cases incl. **expired** (`:106`), wrong account, tampered, malformed |
| `tests/parent-pin-routes.test.ts` | route contracts. **The closest existing tests to change-PIN**: first-set open (`:52`), zod 400 (`:63`), **reset without marker → 403** (`:75`), **reset WITH marker → 200** (`:83`), 401 unauthenticated (`:93`); verify: 200+marker (`:110`), 401 wrong (`:117`), **429 after 5** (`:125`), 400 no-pin (`:141`), 400 invalid (`:152`) |
| `tests/account-settings-isolation.test.ts` | the RLS contract — 3 accounts, positive control + SELECT/UPDATE/DELETE/INSERT-on-behalf isolation, with account C deliberately row-less so an INSERT rejection can only be the `WITH CHECK` |
| `tests/account-deletion.test.ts` | marker+fresh-PIN on a destructive route; wrong PIN → 401 **and `failed_attempts >= 1` asserted via `admin`** (L-002 durable read-back) |
| `tests/password-reset-marker.test.ts` | TTL, expiry-extension refusal, cookie options, and **domain separation both ways** (`:72`, `:82`) |
| `tests/auth-session-gating.test.ts:88` | sign-out revokes the marker |
| `tests/delete-account-section.test.tsx` | jsdom, `vi.stubGlobal("fetch", …)`: the full status→copy/navigation map incl. **403 → `/app/parent-pin`** (`:91`) |
| `tests/confirm-delete-dialog.test.tsx` | the disabled-until-typed invariant, `extraFields` PIN slot (`:99`) |
| `e2e/parent-surfaces.spec.ts` | 2 tests: PIN-gate cookie lifecycle, account-deletion chain |

**The fake `APIContext`** lives in `tests/helpers/astro.ts:80` (`buildContext({url, method, formData, cookies, locals, headers})`), plus `createCookieJar()` (`:31`), `runMiddleware` (`:128`),
`reachedNext` (`:134`). The session-minting idiom `signedInJar(account)` is duplicated verbatim
in `tests/parent-pin-routes.test.ts:20-31` and `tests/account-deletion.test.ts:18-29`. Arming a
marker by hand: `jar.set(PARENT_VERIFIED_COOKIE, signMarker(accountId, Date.now() + 60_000))`.

**E2E binding rules** (`e2e/CLAUDE.md`, 56 lines): `getByRole`/`getByLabel`/`getByText` are
primary; **`getByTestId` is a fallback only, and none exist in `src/` today — needing one is "a
product finding to surface first"**; no CSS/XPath/DOM-structure selectors except three sanctioned
exceptions, one of which is *"`context.clearCookies({ name: "parent_verified" })` in the
parent-surfaces spec — the only way to simulate marker expiry without a 15-minute sleep. Do not
poke other cookies by name."*; every matched string comes from the dictionary via
`e2e/helpers/i18n.ts`; per-test provisioning with `try/finally` + `deleteUser`; **never
`page.waitForTimeout()`**; auth via `provisionAccount` + `signInViaUI` (no `storageState`, by
design); assert the business outcome; model new specs on `e2e/seed.spec.ts`.

The PIN-gate helper a change-PIN spec would reuse (`e2e/parent-surfaces.spec.ts:21-33`) fills
`getByLabel(t.parentPin.pinLabel)` / `getByLabel(t.parentPin.confirmLabel)` and clicks
`getByRole("button", { name: t.parentPin.setSubmit })`. PINs used: `"2468"` (`:40`), `"1357"`
(`:75`), wrong `"9999"` (`:58`). Errors read via `getByRole("alert")` (`:60`). **There is no
page-object class** — the convention is a module-local arrow function.

**Gaps a change-PIN flow would hit:**

- **`ParentPinGate.tsx` has no component test at all** — it is only exercised through e2e.
- **No PIN-seeding or lockout-clearing helper** in `tests/helpers/supabase.ts` or
  `e2e/helpers/accounts.ts`. Tests seed a PIN by calling `setPin` directly, by POSTing the real
  route, or by driving the UI. `account_settings` rows disappear via `deleteUser` (cascade).
- The lockout path is deliberately **not** e2e'd (`e2e/parent-surfaces.spec.ts:16` — "forced
  sleep"), so throttle interaction with a PIN change belongs in Vitest only.
- **Backward-compat trap:** `tests/parent-pin-routes.test.ts:52` asserts first-time set is open.
  If a `currentPin` field is added to `set.ts`'s zod schema as *required*, that test goes red —
  and, far worse, **real onboarding breaks**. `currentPin` must be optional at the schema level
  and required *conditionally* when `hasPin()` is true.
- **Locator collision to watch:** `/app/report` currently has one `role="alert"`-free island
  (`DeleteAccountSection` uses `role="status"`). Adding a `role="alert"` error to a change-PIN
  section on the same page is fine today, but two would make `getByRole("alert")` ambiguous. Also
  note the contract's warning that `getByText` matches substrings — a new label containing an
  existing phrase can break an unrelated locator.

**What a change-PIN flow would add**, following the conventions above:
- *grows* `tests/parent-pin-routes.test.ts` (the `describe("POST /api/parent/pin/set")` block),
  `tests/parent-pin.test.ts` (if a service function is added; also the natural home for
  "changing the PIN clears an active lockout", since `setPin` resets both counters at `:73`),
  `src/i18n/pl.ts`, and `e2e/parent-surfaces.spec.ts` (one journey test reusing
  `setPinAndLandOnReport`, with the new risk noted in the file's provenance header).
- *creates* `tests/change-pin-section.test.tsx` (jsdom, modelled on
  `tests/delete-account-section.test.tsx`) — the status→copy map including **403 → redirect**.

## The open decision (the planner's to close)

**Question.** `MARKER_TTL_MS = 15 * 60_000`. Must the change-PIN form additionally re-ask for the
**current** PIN, or is the marker alone enough?

**My recommendation: re-ask for the current PIN.** Reasoning, weighed as instructed:

*The threat model is named in the codebase itself* — `src/pages/api/profiles/delete.ts:19-28`:
*"a destructive mutation must never be open to any authed session — **a child on the parent's
logged-in device is the threat model**"*. That child, inside the 15-minute window, needs no PIN
at all to reach a marker-only change-PIN form.

*The blast radius is worse than it first looks, and arguably worse than deletion.* **There is no
forgot-PIN recovery flow** — it has been an open follow-up since the S-07 impl-review and was
never built. A hostile or accidental PIN change therefore locks the parent out of the parent
area **permanently**: no report, no account deletion, no gate. And unlike deletion, which is loud
(you are signed out and land on a farewell page), a changed PIN is **silent** — the parent finds
out the next time they try to get in, with no idea what happened.

*The precedent is directly on point.* `src/pages/api/account/delete.ts:33-35` already sets the
house rule for irreversible parent-zone actions in this exact codebase: *"a possibly-15-min-old
marker alone is not enough for the nuclear option"*, restated in
`DeleteAccountSection.tsx:17-18`. Change-PIN is in the same class. Choosing the weaker bar here
would be the project quietly contradicting a decision it already made and documented twice.

*The cost of the extra prompt is genuinely small.* The form already has two fields (new PIN +
confirm). Re-asking makes it three — not an extra screen, not an extra round trip, and the parent
is on a screen they deliberately opened. Set against a silent, unrecoverable lockout, the
trade is lopsided.

*The counter-argument, stated fairly:* the parent typed this same PIN less than 15 minutes ago to
get here, so the third field is pure friction for the overwhelmingly common case. If the product
later ships a forgot-PIN recovery path, that friction becomes harder to justify and this decision
should be revisited.

**Shape of the recommended implementation** (for the planner to accept or reject — **not
implemented in this step**):

- **No new endpoint.** Extend `POST /api/parent/pin/set` with an optional `currentPin` that is
  **required only when `hasPin()` is true**. First-time set stays open and unchanged (this is
  load-bearing — see the backward-compat trap in §8).
- Guard order copied verbatim from `account/delete.ts:41-64`: 503 → 401 → **403 marker** → 400
  zod → **`verifyPin(currentPin)`** mapped through the same `STATUS_FOR` vocabulary
  (429 locked / 401 wrong / 400 no-pin / 500 error) → `setPin(newPin)` → re-mint marker → 200.
  Note `verifyPin` brings the atomic throttle with it, so a guessing child is bounded — but see
  the counter-never-resets defect in §1, which this makes much easier to hit.
- Keep the marker re-mint on success (`set.ts:43`). With a fresh-PIN check it is defensible — the
  parent just proved the old PIN — but the plan should say so out loud rather than inherit it.
- Map **403 → `t.deletion.sessionExpired` + hard-nav to `/app/parent-pin`**, exactly as
  `DeleteAccountSection.tsx:37-39` does. Do **not** inherit `ParentPinGate.reasonToMessage`,
  which has no `"forbidden"` case and would show "Coś poszło nie tak."

**Sub-questions the planner should close in the same breath:** whether the new PIN must differ
from the current one; whether a successful change should *clear* rather than re-mint the marker
(the opposite choice — would need a `clearParentVerified` helper, mirroring
`password-reset.ts:89`); and whether to note (not fix) the never-resetting `failed_attempts`
counter as a follow-up.

## Code References

- `src/lib/services/parent-pin.ts:33-46` — scrypt hashing + constant-time compare
- `src/lib/services/parent-pin.ts:87-120` — `verifyPin`, lockout-before-compare, atomic RPC call
- `src/lib/services/parent-pin.ts:57-60` — `hasPin` (swallows query errors → reads as "no PIN")
- `src/lib/services/parent-pin.ts:129-162` — `markerSecret` fail-closed, `signMarker`, `verifyMarker`
- `src/lib/services/parent-pin.ts:164-174` — `setParentVerified`, the exact cookie flags
- `src/lib/services/parent-pin.ts:20-22` — `MAX_FAILED_ATTEMPTS = 5`, `LOCKOUT_MS = 60_000`
- `src/lib/services/parent-pin.ts:25-30` — the hand-written, non-exported `AccountSettingsRow`
- `src/pages/api/parent/pin/set.ts:18-34` — the reset guard + its rationale comment
- `src/pages/api/parent/pin/verify.ts:17` — the `STATUS_FOR` vocabulary
- `src/pages/app/parent-pin.astro:12-14` — set-vs-enter mode
- `src/components/parent/ParentPinGate.tsx:25-36,41-48,51-65` — reason map (no `"forbidden"`), pre-flight, submit
- `src/pages/api/account/delete.ts:11-15,41-64,69-79` — the marker+fresh-PIN+typed-email precedent
- `src/components/parent/DeleteAccountSection.tsx:13-21,27-52` — the doctrine comment and the error map
- `src/components/parent/ConfirmDeleteDialog.tsx:26-27,54,84-98,125-127` — `onConfirm` contract, arming, `extraFields`
- `src/pages/app/report.astro:22-29` — the copy-pasted parent gate
- `src/pages/app/report.astro:68,88-101` — deletion mount; the already-shipped safety statements card
- `src/middleware.ts:5,42-46` — `PROTECTED_ROUTES` prefix matching, no PIN check
- `src/components/app/AppShell.astro:38,59-65,119-130,186-205` — nav arrays, parent entry, bottom bar
- `src/i18n/pl.ts:351-370` — `parentPin` block (reusable labels + errors)
- `src/i18n/pl.ts:400-407` — `report.safetyHeading` / `safetyPoints` — the honest form of the mockup's toggles
- `src/i18n/pl.ts:416-446` — `deletion` block (`sessionExpired`, `errors.*`)
- `supabase/migrations/20260701160000_create_account_settings.sql:21-28,39-65` — columns + four RLS policies
- `supabase/migrations/20260702120000_pin_failure_throttle_rpc.sql:16-33` — the throttle RPC
- `astro.config.mjs:29` — `PARENT_SESSION_SECRET` declared `optional: true`
- `docs/reference/contract-surfaces.md:41-55` — the `account_settings` registry entry
- `tests/parent-pin-routes.test.ts:20-31,52,75,83` — session idiom + the closest existing change-PIN tests
- `tests/helpers/astro.ts:31,80` — `createCookieJar`, `buildContext`
- `e2e/parent-surfaces.spec.ts:21-33,51` — the gate helper and the sanctioned cookie-clear
- `context/foundation/prd-v3.md:167,170` — the two non-goals that kill toggles 3 and 6

## Architecture Insights

- **The parent gate is a convention, not a mechanism.** Four call sites each re-derive
  `cookies.get(PARENT_VERIFIED_COOKIE)` + `verifyMarker(marker, user.id)`. There is no
  `requireParent(context)` helper and no middleware entry. Every new parent surface is one
  forgotten paste away from being open to any logged-in session. Extracting that helper is the
  single highest-leverage refactor F3 could ship — and it is small.
- **Two privilege planes, strictly ordered** (`account/delete.ts`): the RLS client establishes
  *who* and re-authenticates; only then does any privileged action run, always on a
  session-derived id, never on a request-body id.
- **Fail-closed is the house style.** `markerSecret()` returns `null` rather than defaulting to
  `""`; `verifyMarker` → false; `signMarker` throws. A misconfigured prod blocks the parent area.
  The one exception is `hasPin` (`:57-60`), which swallows query errors and so **fails open into
  `"set"` mode** — a narrow but real fail-open direction, since `set.ts:31` re-runs the same call.
- **RLS does the scoping, not `.eq()`.** `verifyPin` and `hasPin` deliberately query without an
  account filter; the policies are the filter. The throttle RPC does the same with
  `where s.account_id = auth.uid()` and `security invoker`.
- **No generated database types anywhere.** Every table read is an untyped `.from("…")` plus a
  hand-written interface and a cast. Schema drift is invisible to the compiler.
- **The design system's honesty rule is already load-bearing.** `report.astro:87` — *"Product
  guarantees, not measurements — safe to state without data"* — and `pl.ts:394-397`, which
  records that the mockup's correctness %, daily chart and earnings *"have no source yet, so they
  are not rendered rather than estimated"*. The toggle verdicts in §4 are the same rule applied
  to controls instead of numbers.

## Historical Context (from prior changes)

- `context/archive/2026-07-01-skill-path-upgrade-gate/reviews/impl-review.md` — the origin of
  today's PIN security posture. **F1** created the reset guard (*"A child on the parent's
  logged-in device can reach /app/report AND silently reset the PIN"* → Fix A: require a marker
  to overwrite, keep first-time set open; explicitly noting *"a parent who forgets the PIN needs
  a recovery path (separate follow-up)"* — **still not built**). **F2** made the empty-secret case
  fail closed. **F3** replaced the JS read-modify-write throttle with `register_pin_failure`.
- `context/archive/2026-07-11-account-deletion/plan-brief.md:22` — the decision row:
  *"Account-delete re-auth | Marker + **fresh PIN entry** | Closes the 15-min stale-marker window
  with existing machinery"*. `research.md:139` framed it as an open question and recommended
  fresh-PIN "given the soft-gate caveat"; `plan.md:39` records *"No password re-verification …
  fresh PIN is the bar"*. This is the precedent the open decision must argue with, not around.
- `context/archive/2026-07-11-account-deletion/research.md:67` — *"**Middleware does NOT check the
  PIN** — any new deletion route/page must re-check `verifyMarker` itself"*. Same warning, one
  feature earlier.
- `context/changes/web-shell-and-mockup-parity/handoff.md:118-133` — the §4 A2 entry that opened
  F3, including the maintainer's own reading of `set.ts` and the 15-minute question. Its sibling
  entry **A3** ("Zapamiętaj mnie") is the governing precedent for §4's verdicts: the checkbox was
  **not** shipped because without a session-length decision *"byłby to atrapowy checkbox"*.
- `context/foundation/lessons.md` — **L-001** (RLS in the same migration, four per-operation
  policies, isolation test, register in `contract-surfaces.md`), **L-002** (assert the durable
  state, not the API response), **L-003** (no inline literals; all copy through `src/i18n`).

## Related Research

- `context/archive/2026-07-11-account-deletion/research.md` — the nearest prior exploration of
  this exact machinery (marker, throttle, gate pattern, status vocabulary).
- `context/archive/2026-07-01-skill-path-upgrade-gate/research.md` — where the PIN was specced.
- `context/changes/web-shell-and-mockup-parity/handoff.md` — the mockup-parity audit that
  produced this backlog and already mapped screens to mockups.

## Open Questions

1. **The change-PIN re-auth bar** — the decision above. Planner's to close, with reasoning
   recorded in the plan.
2. **Does the maintainer agree the four toggles are reassurance, not settings?** §4 says they
   are and shows they already ship as statements. If the maintainer wants any of them real, that
   is a product decision that reopens the migration question — and, for "Kontrola poziomu
   trudności", contradicts a written PRD non-goal.
3. **Forgot-PIN recovery does not exist** and has been an open follow-up since S-07. It is the
   reason a silent PIN change is unrecoverable. Out of F3's scope, but F3 is the moment it stops
   being theoretical — worth raising explicitly rather than inheriting.
4. **`failed_attempts` never resets on lock expiry** (§1). Pre-existing; a change-PIN form with a
   current-PIN field makes it much easier to hit. Note or fix — but decide, don't drift.
5. **Should F3 extract `requireParent(context)`?** Four copy-pasted gates today; a fifth is one
   forgotten paste from an open parent screen. Small, high-leverage, and strictly optional.
