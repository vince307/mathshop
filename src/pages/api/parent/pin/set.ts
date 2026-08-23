import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { applyNoStore } from "@/lib/http";
import {
  PARENT_VERIFIED_COOKIE,
  pinExists,
  setParentVerified,
  setPin,
  verifyMarker,
  verifyPin,
} from "@/lib/services/parent-pin";

export const prerender = false;

// `pin` is the NEW PIN; `currentPin` re-proves the EXISTING one on a change.
// Both 4–6 digits; account_id comes from the session (L-002). `currentPin` is
// `.optional()` at the schema level ONLY because first-time set has none — on a
// change path the route makes it mandatory (see THE CHANGE GATE below).
const setSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/),
  currentPin: z
    .string()
    .regex(/^\d{4,6}$/)
    .optional(),
});

function json(status: number, body: unknown): Response {
  return applyNoStore(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

// PIN-failure statuses mirror pin/verify.ts so the island can reuse its copy map.
const STATUS_FOR: Record<string, number> = { locked: 429, "no-pin": 400, wrong: 401, error: 500 };

// POST /api/parent/pin/set — set (first time) or CHANGE the parent PIN, then mark
// this session parent-verified so a first-time set flows straight into the report.
//
// CHANGE GUARD: setting the FIRST PIN is open, but overwriting an EXISTING one
// requires a valid parent_verified marker AND the current PIN re-proved fresh
// under the atomic throttle — the same bar `POST /api/account/delete` sets for
// the nuclear option ("a possibly-15-min-old marker alone is not enough",
// `src/pages/api/account/delete.ts:30-35`). Without the second factor a child on
// the parent's logged-in device could POST here inside the marker window and
// silently change the PIN, locking the parent out of their own parent zone with
// no recovery flow. Enforced server-side (not just in parent-pin.astro's mode).
export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return json(503, { ok: false });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json(401, { ok: false });

  // ONE fail-closed read, reused by the marker guard AND the change gate: two
  // calls could disagree, and the disagreement direction is "skip the currentPin
  // check". `null` is "could not tell" → refuse rather than fall through to the
  // open first-time-set path.
  const isChange = await pinExists(supabase);
  if (isChange === null) return json(503, { ok: false });

  if (isChange) {
    const marker = context.cookies.get(PARENT_VERIFIED_COOKIE)?.value;
    if (!verifyMarker(marker, user.id)) return json(403, { ok: false, reason: "forbidden" });
  }

  const form = await context.request.formData();
  // `FormData.get()` returns null for a missing part and `z.string().optional()`
  // rejects null — normalise to undefined BEFORE parsing. Consequence: a
  // `currentPin === null` test further down would be dead code, so the absence
  // check below reads the PARSED value's falsiness.
  const parsed = setSchema.safeParse({ pin: form.get("pin"), currentPin: form.get("currentPin") ?? undefined });
  if (!parsed.success) return json(400, { ok: false, reason: "invalid" });

  // THE CHANGE GATE — ONE block, three ordered steps. DO NOT restructure it into
  // separate `isChange` tests and never gate the verifyPin call on `currentPin`
  // being present (`if (isChange && currentPin)` is a full bypass: omit the field
  // and no PIN is ever checked). The early `return` below is the TypeScript
  // narrowing, which is why no `currentPin!` assertion or `?? ""` fallback is
  // needed — and an assertion is exactly what would silently survive a later edit
  // that drops the guard. Reaching `setPin` on a change path is therefore
  // structurally impossible unless `verifyPin` returned ok.
  if (isChange) {
    const currentPin = parsed.data.currentPin;
    if (!currentPin) return json(400, { ok: false, reason: "invalid" });

    // Fresh PIN, throttle included — wrong attempts count toward the lockout, and
    // a live lockout short-circuits here. That ordering also keeps `setPin` (which
    // zeroes failed_attempts/locked_until) out of reach while locked.
    const pinResult = await verifyPin(supabase, currentPin);
    if (!pinResult.ok) return json(STATUS_FOR[pinResult.reason] ?? 400, { ok: false, reason: pinResult.reason });

    // AFTER verifyPin, per `account/delete.ts:62` — the cheap comparison must
    // never be usable as a pre-flight that skips burning a throttle attempt.
    if (currentPin === parsed.data.pin) return json(400, { ok: false, reason: "same-as-current" });
  }

  const ok = await setPin(supabase, parsed.data.pin);
  if (!ok) return json(500, { ok: false });

  setParentVerified(context.cookies, user.id);
  return json(200, { ok: true });
};
